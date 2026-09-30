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
# 形态学闭运算核（`_fill_and_clean` 用）：把噪点/细栅栏焊上，让洪水填充跨得过去。
# 🔴 **2026-09-30 实测：它对小图（64×64）是有害的** —— 那批源图的描边只有 1~2px，
#    5×5 闭运算会把描边**焊穿**，于是主体的**浅色内部**（肉块的浅色截面、鱼腹、果子果肉、
#    菌盖的浅色部分）与画布外的背景连成一片、被一起填掉 ⇒ 出来是「只剩一圈外壳」的空心图。
#    ⇒ 64×64 这类小图用 `--closing 0`（不闭）或 3；大图（1600²）保持默认 5。
CLOSING = 5
EDGE_T0 = 200        # 软边基准：外缘带内 min<=200 视为全不透明，min>=255 视为全透明
EDGE_BAND = 2        # 软边带宽（px，原图尺度）
KEEP_RATIO = 0.01    # 丢掉面积小于「最大连通域 × 此比例」的孤立块
MIN_KEEP_PX = 256
OUT_SIZE = 64
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'images', 'items', 'food')


def body_mask(mn, chroma, white_only=False):
    """主体掩码（浅色底）：色度感知的背景候选 → 边缘洪水填充 → 去掉小块。返回 (mask, 丢弃块数)

    🔴 `white_only=True`（`--bg white`）时**只把近白算背景**，不再把「淡且中性」也当背景。
    为什么需要它（2026-09-30 实测）：默认那条 `(chroma <= CHROMA_MAX) & (mn >= SHADOW_MIN)` 是为
    **AI 出图的淡灰投影/水印**加的，但主体**自己也可能是淡的**（银耳、藕、霜果、肉块的浅色截面）
    ⇒ 这些像素被判成背景后，只要与画布外的背景连通（小图上 5×5 闭运算会把细描边焊穿）
    就会被整块填掉 = **空心图**。它是「按需档位」，默认行为一个字节没改（旧批次不受影响）。
    """
    cand = (mn >= WHITE_MIN) if white_only else ((mn >= WHITE_MIN) | ((chroma <= CHROMA_MAX) & (mn >= SHADOW_MIN)))
    return _fill_and_clean(cand)


# ── 深色底分支（2026-09-29 立，用户那批 16 件装备图：1600² RGB WebP、**近黑底 + 蓝色发光描边**）──
# 为什么要单独一条：上面那条链按「近白背景」判候选，深色底下它会判出「主体占画布 100%」
# （实测：背景候选 0~7%、主体亮度中位 7~33）⇒ 整张原图被当成主体缩下去，出来是**带黑底的方块**。
# 深色底的正确判据是它的镜像：**近黑且中性**才是背景候选，其余全留。
# 发光描边天然是「亮」的 ⇒ 它不会被判成候选 ⇒ 从画布边缘的洪水填充**跨不过描边**，
# 于是「描边 + 主体内部（含主体自身的深色部分）」整块被保住 —— 这正是我们要的
# （与浅色链里那句「被物体包住的白色高光不连边 ⇒ 保住」是同一条原理）。
DARK_MAX = 48        # 「近黑」上限（实测这批角底色 0~37）
DARK_CHROMA = 14     # 中性度上限（这批底色 chroma ≤ 12；描边是蓝的、chroma 很高 ⇒ 不会误判成背景）
GLOW_FULL = 120      # 亮度 ≥ 此值的边缘像素算「实心发光」；之间按亮度给软 alpha（保住外圈光晕）


def body_mask_dark(mx, chroma):
    """深色底的主体掩码：近黑中性 + 边缘洪水填充（其余全部保留）

    🔴 额外一步「亮度过筛」（2026-09-29 实测加的）：这类图的主体一定**自带发光描边或高光**
    （描边是这套画风的核心），而近黑底上那些没被去掉的残留（噪点团、主体外的暗部碎块）
    **一个亮像素都没有**（实测：陨砂踏鞋 / 天罡华冠 周围留黑斑，就是它们）。
    ⇒ 丢掉「整块不含 ≥ GLOW_FULL 亮像素」的内容块。**别把这一步搬到浅色分支**：
    浅色链的主体完全可以是暗的（如玄玉参深绿、太初神木暗红），过筛会把主体本身删掉。
    """
    body, dropped = _fill_and_clean((mx <= DARK_MAX) & (chroma <= DARK_CHROMA))
    if body is None:
        return None, dropped
    lab, n = ndimage.label(body, structure=np.ones((3, 3)))
    if n <= 1:
        return body, dropped
    bright = mx >= GLOW_FULL
    keep = []
    for i in range(1, n + 1):
        sel = lab == i
        if bright[sel].any():
            keep.append(i)
    if not keep:                       # 全都不亮 ⇒ 宁可原样返回（由调用方的「找不到主体」兜底）
        return body, dropped
    kept = np.isin(lab, keep)
    return kept, dropped + (n - len(keep))


def _fill_and_clean(cand):
    """从画布边缘洪水填充 cand → 反相得到内容，再丢掉面积过小的孤立块。返回 (mask, dropped)。

    ⚠️ 填充前先对 cand 做一次**形态学闭合**（2026-09-29 实测加的）：深色底那批图有极轻的颗粒噪点，
    会把「近黑中性」的候选掩码切成几百个碎片（实测某张丢弃小块 **976** 个）——碎片之间那些
    略超阈值的像素成了**细栅栏**，洪水填充跨不过去 ⇒ 主体周围留一圈没被去掉的黑斑。
    闭合（先膨胀后腐蚀）把这些细栅栏焊上；顺带焊上发光描边上偶尔的 1px 断口（防填充漏进主体内部）。
    🔴 `border_value=1` 不能省：默认把画布**外**当成空 ⇒ 腐蚀会把掩码在画布边缘啃掉一圈，
    于是背景连通块**不再触边**（实测 `触边标签=0`）⇒ 整张图被判成「内容」、裁切边长变成 1600。
    """
    if CLOSING > 0:
        cand = ndimage.binary_closing(cand, structure=np.ones((CLOSING, CLOSING)), border_value=1)
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
    return np.isin(lab2, keep), n2 - len(keep)


def _masks(path):
    arr = np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
    mn = arr.min(axis=2)
    chroma = arr.max(axis=2) - mn
    return arr, mn, chroma


# ── 已带 alpha 的源图（2026-09-29 立，用户那批 `newwq/` 是**真·透明底 RGBA**）──
# 这类图**不需要去背**：alpha 就是掩码（而且它自带的抗锯齿比我们重新描的软边更准）。
# ⚠️ 两条不能省的细节：
#   ① 绝不能用 `_masks()`（它 `convert('RGB')` 会把 alpha **平铺成黑底**）⇒ 单独读 RGBA；
#   ② 不套用 EDGE_BAND 软边那一步（原图 alpha 已经抗锯齿，再压一次会把边缘啃细一圈）。
def _alpha_mask(path):
    im = Image.open(path)
    if 'A' not in im.getbands():
        raise RuntimeError('%s 没有 alpha 通道（--bg alpha 只用于真透明底的源图）' % path)
    a = np.asarray(im.convert('RGBA')).astype(np.int16)
    return a[:, :, :3], a[:, :, 3]


def analyze(path, bgmode='light'):
    if bgmode == 'alpha':
        arr, al = _alpha_mask(path)
        mn = arr.min(axis=2)
        body = al > 8
        lab, n = ndimage.label(body, structure=np.ones((3, 3)))
        dropped = 0
        if n > 1:
            sizes = np.bincount(lab.ravel())[1:]
            floor = max(MIN_KEEP_PX, sizes.max() * KEEP_RATIO)
            keep = [i + 1 for i, s in enumerate(sizes) if s >= floor]
            body = np.isin(lab, keep)
            dropped = n - len(keep)
        return arr, mn, body, dropped, float((~body).mean())
    arr, mn, chroma = _masks(path)
    mx = arr.max(axis=2)
    if bgmode == 'dark':
        body, dropped = body_mask_dark(mx, chroma)
        bg_pct = float(((mx <= DARK_MAX) & (chroma <= DARK_CHROMA)).mean())
    elif bgmode == 'white':
        body, dropped = body_mask(mn, chroma, white_only=True)
        bg_pct = float((mn >= WHITE_MIN).mean())
    else:
        body, dropped = body_mask(mn, chroma)
        bg_pct = float(((mn >= WHITE_MIN) | ((chroma <= CHROMA_MAX) & (mn >= SHADOW_MIN))).mean())
    return arr, mn, body, dropped, bg_pct


def build(path, bgmode='light'):
    if bgmode == 'alpha':
        arr, al = _alpha_mask(path)
        mn = arr.min(axis=2)
        _, _, body, dropped, _ = analyze(path, 'alpha')
        if body is None:
            return None, 0, 0
        # 原图 alpha 直接当输出 alpha（保留它自带的抗锯齿），只把「被判掉的孤立小块」抹零
        alpha = np.where(body, np.asarray(Image.open(path).convert('RGBA')).astype(np.int16)[:, :, 3], 0).astype(np.float32)
        return _finish(arr, alpha, dropped)

    arr, mn, body, dropped, _ = analyze(path, bgmode)
    if body is None:
        return None, 0, 0
    alpha = np.where(body, 255.0, 0.0)
    # 外缘带：主体里、但离背景 EDGE_BAND px 以内的像素 → 压成半透明（去锯齿边）
    #  · 浅色底按**白度**（越白越透明）
    #  · 深色底按**亮度**（越暗越透明）——这样发光描边外圈那层光晕保留成半透明，
    #    而不是被硬切成一条直边（这批图的观感主要靠那圈光）
    band = body & ndimage.binary_dilation(~body, iterations=EDGE_BAND)
    if band.any():
        if bgmode == 'dark':
            mx = arr.max(axis=2).astype(np.float32)
            soft = np.clip((mx - DARK_MAX) / float(GLOW_FULL - DARK_MAX), 0.0, 1.0) * 255.0
        else:
            soft = np.clip((255.0 - mn) / float(255 - EDGE_T0), 0.0, 1.0) * 255.0
        alpha = np.where(band, np.minimum(alpha, soft), alpha)
    return _finish(arr, alpha, dropped)


def _finish(arr, alpha, dropped):
    """裁到 alpha 包围盒 → 补成外接正方形（三种底色分支共用）。"""
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
    ap.add_argument('--out', default=None, help='输出目录，默认 items/food；装备图传 items/equipment')
    ap.add_argument('--stats', action='store_true')
    # 2026-09-29：深色底（近黑 + 发光描边那类图，实测角底色 0~37）走反相分支；默认仍是浅色链
    ap.add_argument('--bg', choices=['light', 'dark', 'alpha', 'white'], default='light',
                    help='源图底色：light（近白 + 淡中性，默认）| dark（近黑，主体靠发光描边勾勒）| '
                         'alpha（真·透明底 RGBA，直接用源图 alpha）| '
                         '**white**（只把近白算背景 —— 主体本身发白/发淡的图必须用它，'
                         '否则主体的浅色内部会被当背景填掉 ⇒ 空心图；2026-09-30 实测）')
    ap.add_argument('--closing', type=int, default=None,
                    help='形态学闭运算核边长（默认 5；**64×64 这类小图请用 0 或 3** —— '
                         '5 会把 1~2px 的描边焊穿，导致主体浅色内部与外部背景连通而被填掉）')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--sort', choices=['mtime', 'name'], default='mtime')
    ap.add_argument('--filter', default=None, help='只处理文件名含该子串的图（跳过旧批次残留）')
    ap.add_argument('--sheet', default=None)
    ap.add_argument('--resample', choices=['box', 'nearest', 'lanczos', 'both'], default='box')
    args = ap.parse_args()
    if args.closing is not None:
        global CLOSING
        CLOSING = args.closing

    # 2026-09-29：也收 `.webp`（用户那批 AI 出图导出的是 1600×1600 **RGB WebP**——
    # 与 PNG 那批同一种情况：写着「无背景」其实没有 alpha、背景是四边连片近白 ⇒ 同一条去背链适用）。
    files = [f for f in os.listdir(args.src) if f.lower().endswith(('.png', '.webp'))]
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
            arr, mn, body, dropped, bg_pct = analyze(os.path.join(args.src, f), args.bg)
            if body is None:
                print('{:>2}  {:<34} 找不到主体'.format(i, f))
                continue
            med = int(np.median(mn[body]))
            print('{:>2}  {:<34} 背景候选{:.0f}%  丢弃小块{:<4} 主体占画布{:.1f}%  主体亮度中位{}'.format(
                i, f, bg_pct * 100, dropped, body.mean() * 100, med))
        return 0

    out_dir = args.out or OUT_DIR
    os.makedirs(out_dir, exist_ok=True)
    md5s, rows = {}, []
    for i, (f, name) in enumerate(zip(files, args.map), 1):
        sq, side, dropped = build(os.path.join(args.src, f), args.bg)
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
            out.save(os.path.join(out_dir, name + '.png'))
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

