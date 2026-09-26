# -*- coding: utf-8 -*-
"""素材后处理流水线：改色 → 裁切 → 缩放 → 导出 color/mask + manifest.json

输入：C:\\Users\\xin'si\\.zcode\\workspace\\default\\lmew\\ui-paper-source（1024² 原始出图）
输出：D:\\plays\\lmew\\public\\images\\ui2\\<族>\\<形态>_<状态>_<w>x<h>@2x_{color,mask}.png + manifest.json

三条规则（依据「UI改版规范_纸白食印」的复检结论）：
  ① 改色：把偏色统一到规范色板（朱红 #A6371F / 铜线 #C9AE86 / 琥珀 #E08A3C / 墨 #2B2622），
     按像素亮度做 shade 倍率，**保留原笔触明暗**，只换色相。
  ② 可九宫格拉伸的帧（pull）：裁到内容后不缩放到目标尺寸（中段由 CSS 拉伸），
     只把最长边压到 MAX_SIDE 以内，并量出「边缘墨厚 + 撕边摆幅」作为 9-slice 边距。
  ③ 不可拉伸的小件（固定尺寸）：等比缩放到目标 @2x（不拉伸、不裁形状），居中放画布。

安全写法：
  · 路径根是**模块常量**（不读环境变量、不读命令行参数）；
  · 每一段过 `SAFE_SEG` 白名单（只允许字母数字与 `_ - @ . x` ⇒ 不可能出现 `..` 或分隔符）；
  · 拼接后 `resolve()` 再做**包含性校验**：结果必须落在允许根目录内，否则抛错；
  · 落盘只用 `Image.save()` 与 `Path.write_text()`（不用 open()），全部经 `safe_join()`。

用法：python scripts/dev/build_ui_assets.py
"""
import io
import json
import os
import re
from pathlib import Path

from PIL import Image, ImageOps

SRC_ROOT = Path(r"C:\Users\xin'si\.zcode\workspace\default\lmew\ui-paper-source")
DST_ROOT = Path(r"D:\plays\lmew\docs\ui-assets\ui2")
# 🔴 产物**故意不放 `public/`**：`public/` 会被整份拷进 dist（在线版 + exe 都带上），
#    而这一层换肤已被用户否掉并整层还原 ⇒ 1.6MB 素材没必要进每个构建包。
#    哪天再启用，把 DST_ROOT 改回 `public/images/ui2` 即可（CSS 里引的也是这个相对路径）。
MAX_SIDE = 512
SAFE_SEG = re.compile(r"^[A-Za-z0-9_@x.-]+$")
BG_TOLERANCE = 42             # 与背景色差多少算「装饰」（纸纹颗粒在此阈值内）
LINE_TOLERANCE = 18           # 弱对比：只用来认「整条贯通」的线性纹样
LINE_COVER = 0.8              # 一行/一列里有多大比例是纹样才算「贯通」
PATCH = 48                    # 补中心用的干净纸底补丁边长（源像素）

# 中心区不能被九宫格拉伸的帧 ⇒ 整张拉伸（背景图 100% 100%）。
# 判据：中心区**沿拉伸方向本来就有渐变/单轴图形**，九宫格会把它揉成一团。
#   FRAME_BAR_FILL = 一笔左深红→右琥珀的**笔刷**（还有一道高光），必须整条拉伸。
STRETCH_ITEMS = {"FRAME_BAR_FILL"}

VERMILION = (166, 55, 31)     # 朱红 #A6371F
COPPER = (201, 174, 134)      # 铜线 #C9AE86
AMBER = (224, 138, 60)        # 琥珀 #E08A3C
INK = (43, 38, 34)            # 墨 #2B2622

# 深色版重映射（只给「纸面帧」出：卡片/面板/弹窗/输入框/按钮）
# 🔴 为什么不能只把改色目标换成深色：纸是**亮**的、铜线比纸**暗**；
#    在深色下要反过来（深纸 + 亮金线）。单纯按亮度乘系数只会把线也压暗 ⇒ 线在深纸上消失。
#    所以按「饱和度」分流：暖色低饱和的是纸、中饱和的是线。
DARK_PAPER = (36, 26, 19)     # 深色 --card (#241a13)
DARK_GOLD = (216, 180, 120)   # 深色下的暖金线
# 🔴 饱和度分流必须留**死区**：奶油纸的饱和度是 0.065，而线是 0.30~0.35。
#    第一版把阈值写成 0.22 且线性 → 纸拿到 0.065/0.22 = 30% 的金料 ⇒ 每张纸被抬高并泛黄：
#    实测深色卡片纸面 (77,60,41)、弹窗 (97,77,53)，而主题深色卡是 (36,26,19) —— **亮了 2~2.7 倍**，
#    整屏变成「深底上一块块浅棕」＝用户说的「深色模式更丑」。现在低于 LO 一律 0 金料。
DARK_LINE_SAT_LO = 0.14
DARK_LINE_SAT_HI = 0.30

# 纸面色调对齐：把纸面中位色拉到目标色（保留 35% 的相对纹理起伏）
# 为什么必须做：素材纸面是 (240,234,224)，比主题浅色卡 #fffdf9 还**暗且灰** ⇒ 卡片边界看着像灰渍
# （用户报「好丑」）。对齐之后「纸只是多了一圈撕边」，原来的明暗层级/对比度契约完全不变。
PAPER_TONE_LIGHT = (253, 249, 242)   # ≈ 主题 --card #fffdf9，略暖
PAPER_TONE_KEEP = 0.35               # 保留多少纹理起伏（1=原样，0=全平）
ALPHA_KNEE = 96                      # alpha 低于此 → 全透明（吃掉素材烤进去的灰晕）
ALPHA_SHOULDER = 235                 # alpha 高于此 → 全不透明（纸面变实、边缘更利落）

# 哪些族需要出深色版（纸面类）。朱红印泥/徽章/勾/进度填充是**语义色**，
# 在深色下继续用朱红是对的（深色主题的 --primary 也是暖橙），所以不重映射。
PAPER_FAMILIES = {"card", "panel", "modal", "input", "btn"}

# (源名, 族, 状态, 目标 CSS 尺寸, 可拉伸, 改色目标)
ITEMS = [
    ("FRAME_CARD", "card", "normal", (214, 331), True, None),
    ("FRAME_PANEL", "panel", "normal", (250, 420), True, None),
    ("FRAME_MODAL", "modal", "normal", (300, 200), True, None),
    ("FRAME_BTN", "btn", "normal", (70, 24), True, COPPER),
    ("FRAME_BTN_RED", "btn", "primary", (216, 31), True, VERMILION),
    ("FRAME_INPUT", "input", "normal", (170, 24), True, None),
    ("FRAME_BAR_SLOT", "progress", "slot", (220, 8), True, None),
    ("FRAME_BAR_FILL", "progress", "fill", (140, 8), True, None),
    ("FRAME_TAB", "tabs", "normal", (75, 29), True, COPPER),
    ("FRAME_TAB_ON", "tabs", "on", (75, 29), True, VERMILION),
    ("LINE_CHOPSTICK", "table", "line", (200, 4), True, COPPER),
    ("LINE_STROKE_RED", "parts", "stroke-red", (3, 30), True, VERMILION),
    ("LINE_STROKE_COPPER", "parts", "stroke-copper", (3, 30), True, COPPER),
    ("LINE_STROKE_AMBER", "parts", "stroke-amber", (3, 30), True, AMBER),
    ("STEAM_LINE", "parts", "steam", (300, 8), True, COPPER),
    ("BADGE_S", "badge", "normal", (32, 13), False, VERMILION),
    ("BADGE_M", "badge", "normal", (45, 22), False, VERMILION),
    ("BADGE_L", "badge", "normal", (76, 22), False, VERMILION),
    ("CHECK_OFF_S", "check", "off", (16, 16), False, COPPER),
    ("CHECK_OFF_M", "check", "off", (22, 22), False, COPPER),
    ("CHECK_ON_S", "check", "on", (16, 16), False, VERMILION),
    ("CHECK_ON_M", "check", "on", (22, 22), False, VERMILION),
    ("LOCK_LINEWORK", "parts", "lock", (13, 13), False, INK),
    ("SEAL_BOWL", "parts", "seal-bowl", (18, 18), False, VERMILION),
    ("SEAL_CHOP", "parts", "seal-chop", (20, 56), False, VERMILION),
    ("SEAL_SPOON", "parts", "seal-spoon", (18, 18), False, VERMILION),
    ("SEAL_POT", "parts", "seal-pot", (18, 18), False, VERMILION),
    ("SEAL_TEAPOT", "parts", "seal-teapot", (18, 18), False, VERMILION),
    ("SEAL_STEAMER", "parts", "seal-steamer", (18, 18), False, VERMILION),
    ("WM_PLATE", "parts", "wm-plate", (62, 62), False, INK),
    ("WM_STEAMER", "parts", "wm-steamer", (72, 72), False, INK),
    ("WM_CHOPREST", "parts", "wm-choprest", (48, 30), False, INK),
]


def safe_join(root: Path, *segments: str) -> Path:
    """把若干段拼到 root 下，并保证结果落在 root 内（白名单 + 包含性校验）。"""
    for seg in segments:
        if not isinstance(seg, str) or not SAFE_SEG.match(seg):
            raise ValueError(f"path segment rejected: {seg!r}")
    root_resolved = root.resolve()
    joined = root_resolved.joinpath(*segments).resolve()
    if joined != root_resolved and not str(joined).startswith(str(root_resolved) + os.sep):
        raise ValueError(f"path escapes allowed root: {joined}")
    return joined


def read_image(name: str) -> Image.Image:
    """读源图：先 read_bytes 再交给 PIL（避免把路径交给 open 类调用）。"""
    src = safe_join(SRC_ROOT, f"{name}.png")
    if not src.is_file():
        raise FileNotFoundError(name)
    return Image.open(io.BytesIO(src.read_bytes())).convert("RGBA")


def ink_bbox(im: Image.Image, thresh: int = 40):
    """按 alpha 阈值求内容包围盒。
    ⚠️ 不能用 PIL 的 getbbox()：它把「几乎全透明」的抗锯齿/压缩噪点也算进去
    （实测 FRAME_INPUT 真实内容 911×241 被撑成 952×506），会让边缘偏移量整体失真。
    """
    alpha = im.getchannel("A").point(lambda v: 255 if v > thresh else 0)
    return alpha.getbbox()


def recolor(im: Image.Image, target) -> Image.Image:
    """按像素亮度给目标色乘 shade（0.55~1.15），alpha 原样保留。"""
    if target is None:
        return im
    px = im.load()
    W, H = im.size
    lums = []
    for y in range(0, H, 3):
        for x in range(0, W, 3):
            r, g, b, a = px[x, y]
            if a > 60:
                lums.append(0.299 * r + 0.587 * g + 0.114 * b)
    lums.sort()
    ref = max(lums[int(len(lums) * 0.85)] if lums else 255.0, 1.0)
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            shade = min(1.15, max(0.55, lum / ref))
            px[x, y] = (int(target[0] * shade), int(target[1] * shade), int(target[2] * shade), a)
    return im


def edge_metrics(im: Image.Image) -> dict:
    """量「不可拉伸的边缘区」有多大。素材分两类，量法不同：
      · 实心件（卡片/面板/弹窗/印泥块/徽章…）：中间也是墨 ⇒ 边缘区 = **撕边摆幅**（轮廓相对包围盒的最大内缩）
      · 空心件（按钮框/输入框/槽/线…）：中间透明 ⇒ 边缘区 = **线厚 + 摆幅**
    返回 tear / thickness / filled / box。
    """
    px = im.load()
    W, H = im.size
    box = ink_bbox(im)
    if not box:
        return dict(tear=0, thickness=0, filled=False, box=(0, 0, W, H))
    x0, y0, x1, y1 = box
    filled = px[(x0 + x1) // 2, (y0 + y1) // 2][3] > 40
    x_last, y_last = min(x1, W) - 1, min(y1, H) - 1
    xstep = max(1, (x1 - x0) // 40)
    ystep = max(1, (y1 - y0) // 40)
    xs = range(x0 + (x1 - x0) // 5, x0 + (x1 - x0) * 4 // 5, xstep)
    ys = range(y0 + (y1 - y0) // 5, y0 + (y1 - y0) * 4 // 5, ystep)

    def first_down(x, lo, hi):
        for t in range(lo, hi):
            if px[x, t][3] > 40:
                return t
        return None

    def first_up(x, lo, hi):
        for t in range(lo, hi, -1):
            if px[x, t][3] > 40:
                return t
        return None

    def first_right(y, lo, hi):
        for t in range(lo, hi):
            if px[t, y][3] > 40:
                return t
        return None

    top_off, bot_off, left_off = [], [], []
    for x in xs:
        t = first_down(x, y0, min(y1, H))
        if t is not None:
            top_off.append(t - y0)
        b = first_up(x, y_last, y0)
        if b is not None:
            bot_off.append(y_last - b)
    for y in ys:
        l = first_right(y, x0, min(x1, W))
        if l is not None:
            left_off.append(l - x0)
    tear = max([0] + top_off + bot_off + left_off)

    # 空心件再量线厚：中间列从上往下连续墨长
    thickness = 0
    if not filled:
        xm = (x0 + x1) // 2
        t = first_down(xm, y0, min(y1, H))
        if t is not None:
            n = 0
            while t < min(y1, H) and px[xm, t][3] > 40:
                n += 1
                t += 1
            thickness = n
    return dict(tear=tear, thickness=thickness, filled=filled, box=box)


def dominant_bg(im: Image.Image):
    """背景色 = **不透明像素**的量化众数（纸 / 木牌 / 朱红底板自适应）。

    ⚠️ 必须跳过近乎全透明的像素：RGBA 直接 convert('RGB') 会把透明处变黑，
    于是「大片透明的按钮/输入框/进度条」会被判成黑底，整张素材都成了「装饰」。
    """
    rgba = im.convert("RGBA")
    if max(rgba.size) > 256:
        rgba = rgba.resize((128, 128))
    counts, total = {}, 0
    for r, g, b, a in rgba.getdata():
        if a < 200:
            continue
        total += 1
        counts[(r // 12, g // 12, b // 12)] = counts.get((r // 12, g // 12, b // 12), 0) + 1
    if total == 0:
        return None
    k = max(counts, key=counts.get)
    return (k[0] * 12 + 6, k[1] * 12 + 6, k[2] * 12 + 6)


def accent_grid(im: Image.Image, rect, bg, tol: int):
    """矩形区内的「装饰掩码」（bytearray，1 = 与背景色差 > tol 且不透明）。"""
    x0, y0, x1, y1 = rect
    W, H = x1 - x0, y1 - y0
    px = im.load()
    grid = bytearray(W * H)
    for y in range(H):
        row = y * W
        for x in range(W):
            r, g, b, a = px[x0 + x, y0 + y]
            if a >= 128 and abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > tol:
                grid[row + x] = 1
    return grid, W, H


def grid_integral(grid: bytearray, W: int, H: int):
    """积分图（summed area），让「任意窗口内的装饰像素数」变成 O(1)。"""
    sat = [0] * ((W + 1) * (H + 1))
    for y in range(H):
        run = 0
        for x in range(W):
            run += grid[y * W + x]
            sat[(y + 1) * (W + 1) + (x + 1)] = sat[y * (W + 1) + (x + 1)] + run
    return sat


def window_sum(sat, W, x, y, pw, ph):
    stride = (W + 1)
    return (sat[(y + ph) * stride + (x + pw)] - sat[y * stride + (x + pw)]
            - sat[(y + ph) * stride + x] + sat[y * stride + x])


def linear_bands(im: Image.Image, rect, bg, cover: float = LINE_COVER, tol: int = LINE_TOLERANCE):
    """找出**整条贯通**的线性纹样（木牌的两道槽线、平行线脚），返回 (row_ok, col_ok)。

    🔴 这类纹样不该被当「装饰」清掉：它们**沿拉伸方向贯通**，九宫格把中心区拉长/压扁后
    仍然是同样的直线（只是粗细按轴缩放）。第一版没做这一步，木牌中间被补掉一段槽线
    ⇒ 渲染出来槽线断了一截、还留一块颜色不同的补丁（2026-09-23 实测）。
    """
    grid, W, H = accent_grid(im, rect, bg, tol)
    rows = [0] * H
    cols = [0] * W
    for y in range(H):
        row = y * W
        for x in range(W):
            if grid[row + x]:
                rows[y] += 1
                cols[x] += 1
    return ([r >= W * cover for r in rows], [c >= H * cover for c in cols])


def mask_out_bands(grid: bytearray, W: int, H: int, row_ok, col_ok):
    """把「贯通线性纹样」所占的行/列从装饰掩码里抹掉（它们不是装饰）。"""
    for y in range(H):
        if row_ok[y]:
            for x in range(W):
                grid[y * W + x] = 0
    for x in range(W):
        if col_ok[x]:
            for y in range(H):
                grid[y * W + x] = 0


def grid_blobs(grid: bytearray, W: int, H: int, rect, min_area: int):
    """连通域（8 邻域），返回原图坐标 [(x0,y0,x1,y1,area)]。"""
    x0o, y0o = rect[0], rect[1]
    seen = bytearray(W * H)
    out = []
    for sy in range(H):
        for sx in range(W):
            i = sy * W + sx
            if not grid[i] or seen[i]:
                continue
            stack = [i]
            seen[i] = 1
            ax0 = ax1 = sx
            ay0 = ay1 = sy
            area = 0
            while stack:
                j = stack.pop()
                area += 1
                jx, jy = j % W, j // W
                if jx < ax0: ax0 = jx
                if jx > ax1: ax1 = jx
                if jy < ay0: ay0 = jy
                if jy > ay1: ay1 = jy
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = jx + dx, jy + dy
                        if 0 <= nx < W and 0 <= ny < H:
                            k = ny * W + nx
                            if grid[k] and not seen[k]:
                                seen[k] = 1
                                stack.append(k)
            if area >= min_area:
                out.append((ax0 + x0o, ay0 + y0o, ax1 + 1 + x0o, ay1 + 1 + y0o, area))
    return out


def tile_mirror(patch: Image.Image, size):
    """把补丁**镜像平铺**（避免接缝；纸纹是随机的，镜像看不出周期）。"""
    pw, ph = patch.size
    block = Image.new("RGBA", (pw * 2, ph * 2))
    block.paste(patch, (0, 0))
    block.paste(ImageOps.mirror(patch), (pw, 0))
    block.paste(ImageOps.flip(patch), (0, ph))
    block.paste(ImageOps.mirror(ImageOps.flip(patch)), (pw, ph))
    out = Image.new("RGBA", size)
    for y in range(0, size[1], ph * 2):
        for x in range(0, size[0], pw * 2):
            out.paste(block, (x, y))
    return out


def clean_center(im: Image.Image, slice_px: int):
    """抹掉**中心区**里的紧凑装饰，用同材质的干净补丁补上。返回 (im, 备注列表)。

    🔴 为什么必须做：`border-image-slice: N fill` 会把中心区整片当作背景铺满控件，
    于是画在中心区的装饰会被拉伸并挪到控件中部 —— 弹窗正中突然一大块朱红、卡片右下角糊成一团。
    装饰应当由**独立小件**（SEAL_* / WM_* / STEAM_LINE）用 CSS 摆放，不该烤进可拉伸的边框里。
    （2026-09-23 实测：弹窗朱印 89×91、面板蒸气曲线 228×23、卡片筷子水印 62×60 全部落在 fill 区。）
    """
    w, h = im.size
    rect = (slice_px, slice_px, w - slice_px, h - slice_px)
    if rect[2] - rect[0] < 16 or rect[3] - rect[1] < 16:
        return im, []
    bg = dominant_bg(im)
    if bg is None:
        return im, []
    # ⚠️ 必须**迭代**：一条曲线（蒸气/水印）常断成几段，粗细不一 —— 一轮只清最大的那截，
    #    剩下的细尾巴照样会被拉伸（面板素材第一版就留了一截在中心区）。
    notes = []
    for _round in range(4):
        grid, W, H = accent_grid(im, rect, bg, BG_TOLERANCE)
        row_ok, col_ok = linear_bands(im, rect, bg)
        mask_out_bands(grid, W, H, row_ok, col_ok)
        blobs = grid_blobs(grid, W, H, rect, max(40, int(W * H * 0.001)))
        if not blobs:
            return im, notes
        patch = pick_patch(im, rect, grid, W, H, bg)
        if patch is None:
            notes.append("中心区找不到干净纸底，未清理")
            return im, notes
        for (bx0, by0, bx1, by1, area) in blobs:
            grow = 4 + _round * 2
            x0 = max(rect[0], bx0 - grow); y0 = max(rect[1], by0 - grow)
            x1 = min(rect[2], bx1 + grow); y1 = min(rect[3], by1 + grow)
            paste_feathered(im, patch, (x0, y0, x1, y1))
            notes.append(f"{area}px@({bx0},{by0})-({bx1},{by1})")
    grid, W, H = accent_grid(im, rect, bg, BG_TOLERANCE)
    row_ok, col_ok = linear_bands(im, rect, bg)
    mask_out_bands(grid, W, H, row_ok, col_ok)
    left = grid_blobs(grid, W, H, rect, max(40, int(W * H * 0.001)))
    if left:
        notes.append(f"仍有 {len(left)} 处未清净（共 {sum(b[4] for b in left)}px）")
    return im, notes


def pick_patch(im: Image.Image, rect, grid, W: int, H: int, bg):
    """挑一块**强对比一像素都没有、弱对比也最少**的纸底补丁（此时装饰还在 ⇒ 补丁不含装饰）。"""
    sat = grid_integral(grid, W, H)
    sat_weak = grid_integral(accent_grid(im, rect, bg, LINE_TOLERANCE)[0], W, H)
    best, best_key = None, None
    for cy in range(0, max(1, H - PATCH + 1), 6):
        for cx in range(0, max(1, W - PATCH + 1), 6):
            if window_sum(sat, W, cx, cy, PATCH, PATCH) > 0:
                continue
            key = (window_sum(sat_weak, W, cx, cy, PATCH, PATCH),
                   (cx - W / 2) ** 2 + (cy - H / 2) ** 2)
            if best_key is None or key < best_key:
                best_key, best = key, (rect[0] + cx, rect[1] + cy)
    if best is None:
        return None
    return im.crop((best[0], best[1], best[0] + PATCH, best[1] + PATCH))


def paste_feathered(im: Image.Image, patch: Image.Image, rect, feather: int = 3):
    """把镜像平铺的补丁贴进 rect，边缘 3px 羽化；**透明处保持透明**（空心件不外溢）。"""
    x0, y0, x1, y1 = rect
    tw, th = x1 - x0, y1 - y0
    tiled = tile_mirror(patch, (tw, th))
    tp, ip = tiled.load(), im.load()
    for y in range(th):
        for x in range(tw):
            # 目的像素：这里只做「不透明 + 换底色」，不会新增覆盖范围
            dst = ip[x0 + x, y0 + y]
            if dst[3] < 128:      # 空心件的透明内部不动
                continue
            d = min(x, y, tw - 1 - x, th - 1 - y)
            k = 1.0 if d >= feather else (d + 0.5) / feather
            src = tp[x, y]
            ip[x0 + x, y0 + y] = (
                int(dst[0] * (1 - k) + src[0] * k),
                int(dst[1] * (1 - k) + src[1] * k),
                int(dst[2] * (1 - k) + src[2] * k),
                max(dst[3], int(dst[3] * (1 - k) + src[3] * k)),
            )


def sharpen_alpha(im: Image.Image, knee: int = ALPHA_KNEE, shoulder: int = ALPHA_SHOULDER):
    """alpha 重映射：吃掉素材烤进去的**灰晕**、把纸面做实。

    AI 出图的纸沿着一圈半透明灰影（那是它自己的投影），叠到真页面上就是「一圈脏」；
    同时纸面 alpha 在 240~254 之间抖动 ⇒ 背景从纸里透出来，卡片发灰。
    knee 以下直接透明、shoulder 以上直接不透明、中间线性过渡（保留撕边的抗锯齿）。
    """
    lut = [0] * 256
    for v in range(256):
        if v <= knee:
            lut[v] = 0
        elif v >= shoulder:
            lut[v] = 255
        else:
            lut[v] = int(round((v - knee) * 255 / (shoulder - knee)))
    im.putalpha(im.getchannel("A").point(lut))
    return im


def tone_match(im: Image.Image, target, keep: float = PAPER_TONE_KEEP):
    """把**纸面**中位色平移到 target，只保留 keep 比例的相对纹理起伏。

    🔴 只动「纸」：亮度比 ≥0.94 → 完全变换；≤0.86（铜线/墨线/阴影）→ **原样保留**。
    第一版对所有像素一视同仁，结果铜线也被按 35% 压缩 ⇒ 线几乎消失（纸和线都变成一个色）。
    做法：每通道乘「相对中位的比值」的 keep 次方（`new = target · ratio^keep`），比线性拉伸稳。
    """
    W, H = im.size
    src = im.load()
    xs = range(W // 4, W * 3 // 4, 2)
    ys = range(H // 4, H * 3 // 4, 2)
    chans = [[], [], []]
    for y in ys:
        for x in xs:
            r, g, b, a = src[x, y]
            if a >= 200:
                chans[0].append(r); chans[1].append(g); chans[2].append(b)
    if not chans[0]:
        return im
    med = [max(1, sorted(c)[len(c) // 2]) for c in chans]
    med_lum = max(1.0, 0.299 * med[0] + 0.587 * med[1] + 0.114 * med[2])
    out = Image.new("RGBA", (W, H))
    dst = out.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = src[x, y]
            if a == 0:
                continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            ratio_l = lum / med_lum
            w = 0.0 if ratio_l <= 0.86 else min(1.0, (ratio_l - 0.86) / 0.08)
            new = [min(255, int(target[i] * ((max(1, v) / med[i]) ** keep)))
                   for i, v in enumerate((r, g, b))]
            dst[x, y] = tuple(
                [int(v + (new[i] - v) * w) for i, v in enumerate((r, g, b))] + [a])
    return out


def paper_finish(im: Image.Image) -> Image.Image:
    """纸面族的收尾：边缘做实 + 纸色对齐。两步都在别的函数里，这里只按顺序调用。"""
    return tone_match(sharpen_alpha(im), PAPER_TONE_LIGHT)


def dark_variant(im: Image.Image) -> Image.Image:
    """纸面帧的深色版：深纸 + 亮金线（按饱和度分流，见 DARK_PAPER 处注释）。"""
    W, H = im.size
    src = im.load()
    out = Image.new("RGBA", (W, H))
    dst = out.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = src[x, y]
            if a == 0:
                continue
            mx, mn = max(r, g, b), min(r, g, b)
            sat = 0.0 if mx == 0 else (mx - mn) / mx
            lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
            # 死区：纸（sat≈0.065）拿 0 金料，线（sat≥0.30）拿满
            w = 0.0 if sat <= DARK_LINE_SAT_LO else min(
                1.0, (sat - DARK_LINE_SAT_LO) / (DARK_LINE_SAT_HI - DARK_LINE_SAT_LO))
            base = tuple(c * (0.90 + 0.20 * lum) for c in DARK_PAPER)
            dst[x, y] = tuple(
                [int(base[i] * (1 - w) + DARK_GOLD[i] * w) for i in range(3)] + [a])
    return out


def process(name: str, family: str, state: str, css_size, pull: bool, color):
    im = recolor(read_image(name), color)
    metrics = edge_metrics(im)
    box = metrics["box"]
    im = im.crop(box)
    if pull:
        k = min(1.0, MAX_SIDE / max(im.size))
        if k < 1.0:
            im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
        # 细线类（槽 / 筷子线 / 竖笔 / 蒸气）：短边 < 48px ⇒ **整条拉伸**，不做九宫格
        # （一根 4px 高的手绘线用九宫格没有意义；而它们的形状本来只沿一个方向变化）
        thin = min(im.size) < 64
        if thin or name in STRETCH_ITEMS:
            note = ("细线类：整条拉伸（短边 < 64px 不做九宫格）" if thin
                    else "中心区含笔刷渐变，整条拉伸（九宫格会把渐变揉成一团）")
            return im, metrics, 0, {"background-size": "100% 100%", "background-repeat": "no-repeat",
                                    "note": note}, []
        slice_px = max(6, int(round((metrics["tear"] + metrics["thickness"] + 3) * k)))
        im, cleaned = clean_center(im, slice_px)
        # 纸面族：边缘做实（吃掉烤进去的灰晕）+ 纸色对齐主题卡色（见两处常量注释）
        # ⚠️ 放在 clean_center 之后：清理用的是**原色**判定，先换色会让背景众数判错。
        if family in PAPER_FAMILIES:
            im = paper_finish(im)
        # 🔴 边框宽必须**按该轴的显示缩放**换算，不能四边一个数：
        #    切图里的撕边是绝对像素（横向边量的是宽、纵向边量的是高），而控件两个轴的缩放比不同
        #    （如卡片 512×281 → 214×331 是 x0.42 / y1.18）。第一版只按高度算再除以 2，
        #    结果撕边被压到自然尺寸的 1/5 —— 渲染出来就是「一张没有边的白纸」，铜线几乎看不见。
        kx = css_size[0] / im.width
        ky = css_size[1] / im.height
        bt = max(2.0, round(slice_px * ky, 1))
        br = max(2.0, round(slice_px * kx, 1))
        css = {"border-image-slice": f"{slice_px} fill", "border-image-width": f"{bt}px {br}px",
               "border-image-repeat": "stretch"}
    else:
        tw, th = css_size[0] * 2, css_size[1] * 2
        ar_src, ar_dst = im.width / im.height, tw / th
        if ar_src > ar_dst:
            nw, nh = tw, max(1, int(round(tw / ar_src)))
        else:
            nh, nw = th, max(1, int(round(th * ar_src)))
        im = im.resize((nw, nh), Image.LANCZOS)
        canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
        canvas.alpha_composite(im, ((tw - nw) // 2, (th - nh) // 2))
        im = canvas
        slice_px = 0
        cleaned = []
        # ⚠️ 导出的画布是 css_size 的 @2x（如徽章 64×26 对应 32×13）⇒ 这里**只能写 100% 100%**。
        #    第一版写成导出像素（64px 26px），而元素盒子是 32×13 ⇒ 背景按 2 倍画、被盒子裁掉，
        #    屏幕上只剩图案中间那一小块（与 v0 的 manifest 约定也不同：它是 `100% 100%`）。
        css = {"background-size": "100% 100%", "background-repeat": "no-repeat",
               "note": f"元素盒子设为 {css_size[0]}×{css_size[1]}px（文件是它的 @2x），背景铺满"}
    return im, metrics, slice_px, css, cleaned


def main() -> None:
    dst_root = DST_ROOT.resolve()
    dst_root.mkdir(parents=True, exist_ok=True)
    # 导出前清掉本目录上一次的 png（只删 .png，避免尺寸变化留下残留文件）
    for old in dst_root.rglob("*.png"):
        if old.is_file():
            old.unlink()
    manifest, report = [], []
    for name, family, state, css_size, pull, color in ITEMS:
        try:
            im, metrics, slice_px, css, cleaned = process(name, family, state, css_size, pull, color)
        except FileNotFoundError:
            report.append((name, "缺文件"))
            continue
        out_w, out_h = im.size
        stem = f"{name.lower()}_{state}_{out_w}x{out_h}@2x"
        color_file = safe_join(dst_root, family, f"{stem}_color.png")
        mask_file = safe_join(dst_root, family, f"{stem}_mask.png")
        color_file.parent.mkdir(parents=True, exist_ok=True)
        im.save(color_file)
        mask = Image.new("RGBA", im.size, (255, 255, 255, 0))
        mask.putalpha(im.getchannel("A"))
        mask.save(mask_file)
        # 深色版：CSS 里用 html[data-theme='dark'] 换源（位图染色做不到，只能出两版）
        dark_rel = None
        if family in PAPER_FAMILIES:
            dark_file = safe_join(dst_root, family, f"{stem}_dark.png")
            dark_variant(im).save(dark_file)
            dark_rel = f"images/ui2/{family}/{stem}_dark.png"
        box = metrics["box"]
        manifest.append({
            "id": name, "family": family, "state": state, "pull": pull,
            "form": "手作不规则轮廓" if pull else "固定尺寸小件",
            "css_size": list(css_size), "export_size": [out_w, out_h], "slice_px": slice_px,
            "src_metrics": {"tear": metrics["tear"], "thickness": metrics["thickness"],
                            "filled": metrics["filled"], "content": [box[2] - box[0], box[3] - box[1]]},
            "mask": f"images/ui2/{family}/{stem}_mask.png",
            "colour": f"images/ui2/{family}/{stem}_color.png",
            "colour_dark": dark_rel,
            "center_cleaned": cleaned,
            "css": css,
        })
        kind = "实心" if metrics["filled"] else "空心"
        extra = ("　中心已清装饰：" + "；".join(cleaned)) if cleaned else ""
        report.append((name, f"{out_w}×{out_h} slice={slice_px} {kind} "
                             f"tear={metrics['tear']} 线厚={metrics['thickness']}{extra}"))

    manifest_file = safe_join(dst_root, "manifest.json")
    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"导出 {len(manifest)} 组 → {dst_root}")
    for name, line in report:
        print(f"  {name:<22}{line}")


if __name__ == "__main__":
    main()
