# 物品图入库工具（图片处理，不是数据生成器：不产出 js 数据、不参与 gen_drift_audit）
#
# 用途：把 AI 生成的 2048x2048「无背景」PNG 处理成游戏用的 64x64 RGBA 物品图。
#
# ⚠️ 源图五个坑（三批实测都一样，别再踩）：
#   1. 名字写着「无背景」，实际是 **mode=RGB（没有 alpha 通道）**，背景是四边连片的近白 ⇒ 必须自己去背。
#   2. **右下角有一处浅灰水印**（min(R,G,B) 约 211~238，四个 ~50x50 的小字块）。
#   3. **物体下方有一片很淡的灰色投影**，会漫到物体之外很远（实测有一块 **44546px** 的游离残片）。
#   4. **物体外圈有 1~2px 抗锯齿白边**：2048→64 是 **32 倍**降采样，用**最近邻**会把白边零星采成
#      「白点」散在物体周围——**用户三批都报过这个**（「图鉴里还能看到白色的东西」）。
#   5. ⚠️ **浅色主体**（浅蓝的叠布、粉白的香薰烛）本体比「近白阈值」之外的任何**亮度**判据都亮：
#      早先用「亮度核心 min<=185 取最大连通域」时，这两张的主体被漏掉、只留下一条**残片**
#      （v2.10.0 实测：棉麻叠布只剩 1.6%、香薰浮烛只剩 5.9%）。**亮度单独分不开「浅色物体」与「灰投影」。**
#
# ✅ 真正干净的分开方式 = **色度（chroma = max−min）**：
#   实测主体（无论多浅）的色度中位 **43~171**，而背景/投影/水印只有 **2~5**（中性灰）。
#   于是「要去掉的背景」= 近白 **或**（淡 **且** 中性灰）：
#       bg_cand = (min >= 235) | (chroma <= 10 且 min >= 190)
#   再从画布边缘做连通域洪水填充（只去与边缘相连的那部分），即可：
#     · 灰投影/水印 → 落进候选域且连边 ⇒ 去掉 ✓
#     · 浅蓝的布 / 粉白的烛 → 色度够高 ⇒ 不是候选 ⇒ 保住整只 ✓
#     · 被物体包住的白色高光 → 不连边 ⇒ 保住 ✓
#
# 处理链：
#   ① 色度感知的背景候选 → 从边缘洪水填充 → 得到**真实轮廓**（不需要补洞/膨胀，也不再依赖亮度核心）
#   ② 丢掉面积过小的孤立块（残余噪点；正常图 0~30 个，坏图才会到几百）
#   ③ 外缘 2px 带内按白度给软 alpha（把抗锯齿白边压成半透明）
#   ④ 裁到 alpha 包围盒 → 补成外接正方形 → **预乘 alpha 的面积平均（BOX）**缩到 64x64
#
# 用法：
#   python scripts/gen/process_item_images.py --src <目录> --stats     # 只看统计
#   python scripts/gen/process_item_images.py --src <目录> --dry-run   # 处理但不写盘
#   python scripts/gen/process_item_images.py --src <目录>             # 真写盘
#   python scripts/gen/process_item_images.py --src <目录> --sheet out.png --resample both

import argparse
import hashlib
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

# 源目录 → 目标文件名（按**修改时间升序**一一对应；顺序由调用方给定，脚本不猜）
DEFAULT_MAP = [
    '木碗架', '木勺架', '木调料架', '木餐盘', '木酒架',
    '木屏风', '木长桌', '木雕挂屏', '木香案', '神木供案',
]

WHITE_MIN = 235      # 近白：直接算背景
SHADOW_MIN = 190     # 「淡」的下限（配合低色度 → 投影/水印）
CHROMA_MAX = 10      # 色度 ≤ 此值算中性灰
EDGE_T0 = 200        # 软边基准：外缘带内 min<=200 视为全不透明，min>=255 视为全透明
EDGE_BAND = 2        # 软边带宽（px，原图尺度）
KEEP_RATIO = 0.01    # 丢掉面积小于「最大连通域 × 此比例」的孤立块
MIN_KEEP_PX = 256
OUT_SIZE = 64
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'images', 'items', 'food')


def body_mask(mn, chroma):
    """主体掩码：色度感知的背景候选 → 边缘洪水填充 → 去掉小块。返回 (mask, 丢弃块数)"""
    cand = (mn >= WHITE_MIN) | ((chroma <= CHROMA_MAX) & (mn >= SHADOW_MIN))
    lab, _ = ndimage.label(cand, structure=np.ones((3, 3)))
    border = set(lab[0, :].tolist()) | set(lab[-1, :].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    border.discard(0)
    bg = np.isin(lab, list(border)) if border else np.zeros_like(cand)
    content = ~bg
    lab2, n2 = ndimage.label(content, structure=np.ones((3, 3)))
    if n2 == 0:
        return None, 0
    sizes = np.bincount(lab2.ravel())[1:]
    floor = max(MIN_KEEP_PX, sizes.max() * KEEP_RATIO)
    keep = [i + 1 for i, s in enumerate(sizes) if s >= floor]
    dropped = n2 - len(keep)
    return np.isin(lab2, keep), dropped


def _masks(path):
    arr = np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
    mn = arr.min(axis=2)
    chroma = arr.max(axis=2) - mn
    return arr, mn, chroma


def analyze(path):
    arr, mn, chroma = _masks(path)
    body, dropped = body_mask(mn, chroma)
    bg_pct = float(((mn >= WHITE_MIN) | ((chroma <= CHROMA_MAX) & (mn >= SHADOW_MIN))).mean())
    return arr, mn, body, dropped, bg_pct


def build(path):
    arr, mn, body, dropped, _ = analyze(path)
    if body is None:
        return None, 0, 0
    alpha = np.where(body, 255.0, 0.0)
    # 外缘带：主体里、但离背景 2px 以内的像素 → 按白度压成半透明（去掉抗锯齿白边）
    band = body & ndimage.binary_dilation(~body, iterations=EDGE_BAND)
    if band.any():
        soft = np.clip((255.0 - mn) / float(255 - EDGE_T0), 0.0, 1.0) * 255.0
        alpha = np.where(band, np.minimum(alpha, soft), alpha)
    rgba = np.dstack([arr.astype(np.uint8), alpha.astype(np.uint8)])
    im = Image.fromarray(rgba, 'RGBA')
    bbox = im.getchannel('A').getbbox()
    if not bbox:
        return None, 0, dropped
    im = im.crop(bbox)
    w, h = im.size
    side = max(w, h)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - w) // 2, (side - h) // 2))
    return sq, float(side), dropped


def downsample(sq, mode):
    """预乘 alpha 后再缩放，避免边缘被采样成白/黑点"""
    a = np.asarray(sq).astype(np.float32)
    al = a[:, :, 3:4] / 255.0
    pm = Image.fromarray(np.clip(a[:, :, :3] * al, 0, 255).astype(np.uint8), 'RGB')
    am = Image.fromarray(a[:, :, 3].astype(np.uint8), 'L')
    filt = {'box': Image.BOX, 'nearest': Image.NEAREST, 'lanczos': Image.LANCZOS}[mode]
    p = np.asarray(pm.resize((OUT_SIZE, OUT_SIZE), filt)).astype(np.float32)
    q = np.asarray(am.resize((OUT_SIZE, OUT_SIZE), filt)).astype(np.float32) / 255.0
    rgb = np.zeros_like(p)
    nz = q > 0.004
    rgb[nz] = np.clip(p[nz] / q[nz][:, None], 0, 255)
    out = np.dstack([rgb.astype(np.uint8), (q * 255.0).round().astype(np.uint8)])
    return Image.fromarray(out, 'RGBA')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--map', nargs='*', default=DEFAULT_MAP)
    ap.add_argument('--stats', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--sort', choices=['mtime', 'name'], default='mtime')
    ap.add_argument('--filter', default=None, help='只处理文件名含该子串的图（跳过旧批次残留）')
    ap.add_argument('--sheet', default=None)
    ap.add_argument('--resample', choices=['box', 'nearest', 'lanczos', 'both'], default='box')
    args = ap.parse_args()

    files = [f for f in os.listdir(args.src) if f.lower().endswith('.png')]
    if args.filter:
        files = [f for f in files if args.filter in f]
    if args.sort == 'name':
        # 按文件名里的**最大数字**排序（`(10)` 要排在 `(2)` 之后）——
        # 用户按技能分文件夹给图时，文件名自带序号，比 mtime 更可靠
        import re as _re
        def _num(f):
            ns = _re.findall(r'\d+', f)
            return int(ns[-1]) if ns else 0
        files.sort(key=_num)
    else:
        files.sort(key=lambda f: os.path.getmtime(os.path.join(args.src, f)))
    if len(files) != len(args.map):
        print('❌ 源图 %d 张，映射表 %d 个名称 —— 数量不匹配，中止（不写任何文件）' % (len(files), len(args.map)))
        return 1

    if args.stats:
        for i, f in enumerate(files, 1):
            arr, mn, body, dropped, bg_pct = analyze(os.path.join(args.src, f))
            if body is None:
                print('{:>2}  {:<34} 找不到主体'.format(i, f))
                continue
            med = int(np.median(mn[body]))
            print('{:>2}  {:<34} 背景候选{:.0f}%  丢弃小块{:<4} 主体占画布{:.1f}%  主体亮度中位{}'.format(
                i, f, bg_pct * 100, dropped, body.mean() * 100, med))
        return 0

    os.makedirs(OUT_DIR, exist_ok=True)
    md5s, rows = {}, []
    for i, (f, name) in enumerate(zip(files, args.map), 1):
        sq, side, dropped = build(os.path.join(args.src, f))
        if sq is None:
            print('❌ 第 %d 张找不到主体（阈值过激？）：%s' % (i, f))
            return 1
        modes = ['box', 'nearest'] if args.resample == 'both' else [args.resample]
        outs = {m: downsample(sq, m) for m in modes}
        out = outs['box'] if 'box' in outs else outs[modes[0]]
        md5 = hashlib.md5(out.tobytes()).hexdigest()
        md5s.setdefault(md5, []).append(name)
        opaque = sum(1 for p in out.getdata() if p[3] > 8) / float(OUT_SIZE * OUT_SIZE)
        semi = sum(1 for p in out.getdata() if 8 < p[3] < 247) / float(OUT_SIZE * OUT_SIZE)
        print('{:>2}  {:<34} -> {:<8} 裁切边长{:<5} 丢弃孤立块{:<3} 实心{:>3.0f}% 软边{:>2.0f}%  md5={}'.format(
            i, f, name + '.png', int(side), dropped, opaque * 100, semi * 100, md5[:8]))
        if not args.dry_run:
            out.save(os.path.join(OUT_DIR, name + '.png'))
        if args.sheet:
            rows.append((name, outs))

    dup = {k: v for k, v in md5s.items() if len(v) > 1}
    print('重复图:', dup if dup else '无（%d 张两两不同）' % len(files))

    if args.sheet and rows:
        cols = len(rows[0][1])
        cell = 128 + 8
        sheet = Image.new('RGBA', (cell * cols + 8, cell * len(rows) + 8), (26, 26, 30, 255))
        for ri, (_name, outs) in enumerate(rows):
            for ci, (_m, im) in enumerate(outs.items()):
                sheet.alpha_composite(im.resize((128, 128), Image.NEAREST), (8 + ci * cell, 8 + ri * cell))
        sheet.save(args.sheet)
        print('对照图:', args.sheet, '（列顺序:', list(rows[0][1].keys()), '）')
    return 0


if __name__ == '__main__':
    sys.exit(main())

