# 物品图入库工具（图片处理，不是数据生成器：不产出 js 数据、不参与 gen_drift_audit）
#
# 用途：把 AI 生成的 2048x2048「无背景」PNG 处理成游戏用的 64x64 RGBA 物品图。
#
# ⚠️ 源图四个坑（两批实测都一样，别再踩）：
#   1. 名字写着「无背景」，实际是 **mode=RGB（没有 alpha 通道）**，背景是四边连片的近白 ⇒ 必须自己去背。
#   2. **右下角有一处浅灰水印**（min(R,G,B) 约 211~238），四个 ~50x50 的小字块。
#   3. **物体下方有一片很淡的灰色投影**（min 约 200~240），会一直漫到物体之外很远。
#      ⚠️ ②③ 都比「近白」暗，所以**不能被当成背景**；而「放宽近白阈值」是错的做法 ——
#      浅色主体（木长桌、木餐盘的受光面）会跟着一起被吃掉。
#      ⇒ 正解是**按亮度找主体核心，再取最大连通域**：主体核心的 min(R,G,B) 中位只有 17~62（实测 10 张），
#        而水印与投影都在 200 以上，一刀切干净。阈值在 150~200 之间面积几乎不变（实测），故取 185 很稳。
#   4. **物体外圈有 1~2px 抗锯齿白边**：若直接最近邻降采样（2048→64 是 32 倍），
#      白边会被零星采成「白点」散在物体周围（用户实测报过「图鉴里还能看到白色的东西」）。
#
# 处理链：
#   ① 核心 = min(R,G,B) <= CORE_T（185）→ 连通域标注 → **只留最大的一块**（水印/投影/游离白点全在这步丢掉）
#   ② 补洞：填上主体内部的浅色区（碗内壁、桌面受光面这类被主体包住的亮区）
#   ③ 膨胀 RIM px 把抗锯齿边缘收回来（2048 尺度下 4px ≈ 64 尺度下 0.13px，可忽略）
#   ④ 裁到 bbox → 补成外接正方形 → 缩到 64x64
#      默认用 **BOX（面积平均）**：二值 alpha 经面积平均后边缘自然得到 1px 抗锯齿，比最近邻干净；
#      同源的 20 档木材用的是最近邻（边缘更硬），要完全对齐可用 --resample nearest。
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

WHITE_MIN = 235    # 仅用于 --stats 估算背景占比
CORE_T = 185       # 主体核心：min(R,G,B) <= 此值算实心（水印与淡投影都在 200 以上）
RIM = 4            # 主体外围膨胀量（px，原图尺度），用于收回抗锯齿边缘
OUT_SIZE = 64
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'images', 'items', 'food')


def body_mask(mn, core_t=CORE_T, rim=RIM):
    """主体掩码：最大连通域 → 补洞 → 膨胀收回抗锯齿边。返回 (mask, 连通域数, 丢弃块数)"""
    core = mn <= core_t
    lab, n = ndimage.label(core, structure=np.ones((3, 3)))
    if n == 0:
        return None, 0, 0
    sizes = np.bincount(lab.ravel())[1:]
    k = int(np.argmax(sizes)) + 1
    body = lab == k
    body = ndimage.binary_fill_holes(body)
    if rim > 0:
        body = ndimage.binary_dilation(body, iterations=rim)
    return body, n, n - 1


def analyze(path):
    arr = np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
    mn = arr.min(axis=2)
    body, n, dropped = body_mask(mn)
    bg_pct = float((mn >= WHITE_MIN).mean())
    return arr, mn, body, n, dropped, bg_pct


def build(path, core_t=CORE_T, rim=RIM):
    arr = np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
    mn = arr.min(axis=2)
    body, _n, dropped = body_mask(mn, core_t, rim)
    if body is None:
        return None, 0, 0
    rgba = np.dstack([arr.astype(np.uint8), np.where(body, 255, 0).astype(np.uint8)])
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
    ap.add_argument('--sheet', default=None)
    ap.add_argument('--core-t', type=int, default=CORE_T)
    ap.add_argument('--resample', choices=['box', 'nearest', 'lanczos', 'both'], default='box')
    args = ap.parse_args()

    files = [f for f in os.listdir(args.src) if f.lower().endswith('.png')]
    files.sort(key=lambda f: os.path.getmtime(os.path.join(args.src, f)))
    if len(files) != len(args.map):
        print('❌ 源图 %d 张，映射表 %d 个名称 —— 数量不匹配，中止（不写任何文件）' % (len(files), len(args.map)))
        return 1

    if args.stats:
        for i, f in enumerate(files, 1):
            arr, mn, body, n, dropped, bg_pct = analyze(os.path.join(args.src, f))
            if body is None:
                print('{:>2}  {:<34} 找不到主体'.format(i, f))
                continue
            med = int(np.median(mn[body]))
            print('{:>2}  {:<34} 近白{:.0f}%  连通域{}个(丢弃{})  主体占画布{:.1f}%  主体亮度中位{}'.format(
                i, f, bg_pct * 100, n, dropped, body.mean() * 100, med))
        return 0

    os.makedirs(OUT_DIR, exist_ok=True)
    md5s, rows = {}, []
    for i, (f, name) in enumerate(zip(files, args.map), 1):
        sq, side, dropped = build(os.path.join(args.src, f), args.core_t)
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

