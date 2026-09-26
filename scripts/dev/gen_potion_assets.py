# -*- coding: utf-8 -*-
"""按「Potion Craft 风」自绘**不规则** UI 素材（原创，不含任何它的美术）。

用户要求（2026-09-23）：「原素材是不规则的，你也要这样」——所以这里每个件都是**手绘感**的：
  · 轮廓用**抖线**（沿法线扰动 + 断笔），不是直线/标准圆角；
  · 边缘**撕开**（锯齿缺口，深浅不一）；
  · 边框线宽**忽粗忽细**，四角不齐；
  · 纸面有纤维与霉点；条状件两端是笔头收锋。

🔴 关键约束：**不规则必须落在九宫格切片内，中段必须平整** —— 否则拉伸时纹样会被抹开
   （见 AGENTS「纸白食印」那节：`fill` 中段会被整片拉伸）。所以：
     书页 512² 切 56 · 纸条 320×80 切 48/20 · 笔刷 512×96 切 60/14 · 标签 160×80 切 20
   中段只留「平色 + 一条水平线」，两端才是手绘的。

用法：python scripts/dev/gen_potion_assets.py
产出：docs/potion-try/mine/*.png（本地；接入时才拷进 public/images/ui-potion/）
"""
import math
import pathlib
import random

from PIL import Image, ImageDraw, ImageFilter

OUT = pathlib.Path(r"D:\plays\lmew\docs\potion-try\mine")
SEED = 20260923
# 色板 = Potion Craft UI 纹理的实测众数（见 potion_recon.py / 记忆 potion-craft-style-ref）
INK = (48, 24, 0)            # #301800 轮廓
SHEET = (192, 168, 120)      # #C0A878 羊皮纸
SHEET_L = (216, 192, 144)    # #D8C090
SHEET_D = (168, 136, 90)     # #A88860
WOOD = (110, 74, 40)         # #6E4A28
RUST = (192, 120, 48)        # #C07830
STONE = (86, 74, 56)         # 石雕托架基色


# ── 手绘工具 ────────────────────────────────────────────────────────────────
def wobble(pts, rng, amp=3.0, seg=14):
    """把折线重采样成抖线：沿法线加平滑噪声（低频起伏 + 高频毛刺）。"""
    out = []
    n = len(pts)
    phase = rng.random() * math.tau
    for i in range(n):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        dist = math.hypot(x1 - x0, y1 - y0)
        steps = max(2, int(dist / seg))
        for s in range(steps):
            t = s / steps
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            nx, ny = -(y1 - y0) / (dist or 1), (x1 - x0) / (dist or 1)
            k = i + t                                     # 沿轮廓的位置
            off = amp * (math.sin(k * 0.35 + phase) * 0.6 + rng.uniform(-0.5, 0.5))
            out.append((x + nx * off, y + ny * off))
    return out


def torn(pts, rng, depth=5.0, step=9):
    """把轮廓改成**撕边**：每隔一段往内啃一个随机深度的三角缺口。"""
    out = []
    n = len(pts)
    for i in range(n):
        x, y = pts[i]
        out.append((x, y))
        if i % step == 0 and rng.random() < 0.55:
            x2, y2 = pts[(i + 1) % n]
            mx, my = (x + x2) / 2, (y + y2) / 2
            # 往图形内侧啃（重心方向）
            gx = sum(p[0] for p in pts) / n
            gy = sum(p[1] for p in pts) / n
            d = math.hypot(gx - mx, gy - my) or 1
            d_ = rng.uniform(depth * .4, depth)
            out.append((mx + (gx - mx) / d * d_, my + (gy - my) / d * d_))
    return out


def hand_line(draw, pts, color, rng, width=2.4, jitter=1.2):
    """手绘线：线段拆小步，位置与线宽都抖（忽粗忽细、断笔）。"""
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        steps = max(3, int(math.hypot(x1 - x0, y1 - y0) / 3))
        for s in range(steps):
            t = s / steps
            x = x0 + (x1 - x0) * t + rng.uniform(-jitter, jitter)
            y = y0 + (y1 - y0) * t + rng.uniform(-jitter, jitter)
            w = max(1, int(round(width + rng.uniform(-0.35, 0.35))))   # 只微抖：跳笔/大抖会变成「珠子链」
            draw.ellipse((x - w, y - w, x + w, y + w), fill=color)


def paper_tex(size, rng, base=SHEET):
    """纸面：**噪点放大**做的柔和起伏 + 边缘暗带。

    前两版的坑：① 画大圆斑 ⇒ 像奶牛花纹；② 画小圆斑 ⇒ 像海绵。
    正解是「低频起伏」——生成一块 1/8 尺寸的噪点再放大，混色时只给极低比例，
    于是纸面几乎是平的、但不着色不匀，跟真纸一样。
    """
    w, h = size
    small = Image.new("L", (max(4, w // 8), max(4, h // 8)))
    small.putdata([rng.randint(0, 255) for _ in range(small.width * small.height)])
    big = small.resize(size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(max(2, w // 90)))
    tint = Image.merge("RGBA", (
        big.point(lambda v: int(SHEET_L[0] + (SHEET_D[0] - SHEET_L[0]) * v / 255)),
        big.point(lambda v: int(SHEET_L[1] + (SHEET_D[1] - SHEET_L[1]) * v / 255)),
        big.point(lambda v: int(SHEET_L[2] + (SHEET_D[2] - SHEET_L[2]) * v / 255)),
        Image.new("L", size, 255),
    ))
    im = Image.blend(Image.new("RGBA", size, base + (255,)), tint, 0.10)
    d = ImageDraw.Draw(im)
    for _ in range(150):                                  # 少量霉点
        d.point((rng.randrange(w), rng.randrange(h)), fill=SHEET_D + (rng.randint(40, 80),))
    band = Image.new("L", size, 0)
    ImageDraw.Draw(band).rectangle((0, 0, w, h), outline=255, width=max(5, w // 26))
    band = band.filter(ImageFilter.GaussianBlur(max(4, w // 42)))
    im.paste(Image.new("RGBA", size, (92, 66, 30, 255)), (0, 0), band.point(lambda v: int(v * 0.30)))
    return im


def shape_mask(size, pts, blur=1.1):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m.filter(ImageFilter.GaussianBlur(blur))


# ── 四件套 ─────────────────────────────────────────────────────────────────
def make_page(size=512, slice_=56):
    """书页/面板：抖线轮廓 + 撕边 + 手绘边框（不规则全在 slice 内，中段平整）。"""
    rng = random.Random(SEED + 1)
    s = size
    r = 16
    # 圆角矩形的**抖**轮廓（先直边点集，再扰动）
    pts = []
    for x in range(r, s - r, 26):
        pts.append((x, 2)); pts.append((x, s - 2))
    for y in range(r, s - r, 26):
        pts.append((2, y)); pts.append((s - 2, y))
    pts = [(r, 2), (s - r, 2), (s - 2, r), (s - 2, s - r), (s - r, s - 2), (r, s - 2), (2, s - r), (2, r)]
    outline = torn(wobble(pts, rng, amp=1.8, seg=18), rng, depth=3.2, step=9)

    sheet = paper_tex((s, s), rng)
    sheet.putalpha(shape_mask((s, s), outline))

    # 手绘内框：往里缩 8~12px 的一圈抖线（宽度忽粗忽细）
    inner = [(x * 0.965 + s * 0.0175, y * 0.965 + s * 0.0175) for (x, y) in outline]
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    hand_line(ImageDraw.Draw(layer), wobble(inner, rng, amp=2.0, seg=16) + [wobble(inner, rng, amp=2.0, seg=16)[0]],
              INK + (150,), rng, width=2.2, jitter=1.1)
    sheet.alpha_composite(layer)

    # 落影：形状整体下移 2px 的暗版，垫在底下
    shadow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 90), (0, 0), shape_mask((s, s), [(x + 2, y + 3) for (x, y) in outline], blur=2.2))
    out = Image.alpha_composite(shadow, sheet)
    return out


def make_btn(w=320, h=80, hover=False, slice_x=48, slice_y=20):
    """纸条按钮：两端**撕口 + 收锋**，中间平（只留上下两条手绘线）。"""
    rng = random.Random(SEED + 2)
    base = SHEET_L if hover else SHEET
    pts = [(2, h * 0.18), (w - 2, h * 0.12), (w - 2, h * 0.88), (2, h * 0.9)]
    pts = [(w * 0.02, h * 0.16), (w * 0.16, h * 0.05), (w * 0.5, h * 0.02), (w * 0.84, h * 0.05), (w * 0.98, h * 0.16),
           (w * 0.99, h * 0.5), (w * 0.98, h * 0.84), (w * 0.84, h * 0.95), (w * 0.5, h * 0.98), (w * 0.16, h * 0.95),
           (w * 0.02, h * 0.84), (w * 0.01, h * 0.5)]
    outline = torn(wobble(pts, rng, amp=2.0, seg=12), rng, depth=3.0, step=8)
    sheet = paper_tex((w, h), rng, base)
    sheet.putalpha(shape_mask((w, h), outline))
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    inner = [(x * 0.9 + w * 0.05, y * 0.82 + h * 0.09) for (x, y) in outline]
    hand_line(d, wobble(inner, rng, amp=1.6, seg=12) + [wobble(inner, rng, amp=1.6, seg=12)[0]], INK + (140,), rng, width=1.9)
    sheet.alpha_composite(layer)
    sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sh.paste((0, 0, 0, 80), (0, 0), shape_mask((w, h), [(x + 1, y + 2) for (x, y) in outline], blur=2.0))
    return Image.alpha_composite(sh, sheet)


def make_brush(w=512, h=96, slice_x=60, slice_y=14):
    """锈棕笔刷条（选中态/主操作）。

    第一版是「沿中心线等距排竖线」⇒ 出来是个带竖条纹的梭形（一看就假）。
    笔刷的正解是**长短不一、粗细不一、互相重叠的横扫**：中间厚、两端毛、整体是一条不齐的带子，
    不是两头尖的梭。两端只收到 0.72 倍（留毛边），再按噪声打碎 alpha。"""
    rng = random.Random(SEED + 3)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cy = h / 2
    for _ in range(190):
        t = rng.random()
        x0 = w * rng.uniform(0.02, 0.72)
        ln = w * rng.uniform(0.10, 0.34)
        edge = min(t, 1 - t)
        thick = h * (0.30 + 0.10 * math.sin(t * 5.7)) * (0.72 + 0.28 * min(1, edge * 4))
        y0 = cy + math.sin(t * 7.3 + 0.7) * (h * 0.05) + rng.uniform(-2.2, 2.2)
        c = rng.choice([RUST, (206, 132, 54), (170, 100, 38), (150, 86, 30)])
        d.line((x0, y0, min(w * 0.98, x0 + ln), y0 + rng.uniform(-3, 3)),
               fill=c + (rng.randint(70, 165),), width=int(max(4, thick)))
    im = im.filter(ImageFilter.GaussianBlur(0.8))
    a = im.getchannel("A").point(lambda v: 0 if v < 44 else (255 if v > 168 else int((v - 44) * 1.72)))
    im.putalpha(a)
    return im


def make_tag(w=160, h=80, slice_=20):
    """小标签：小纸片，四边撕。"""
    rng = random.Random(SEED + 4)
    pts = [(6, 6), (w - 6, 4), (w - 4, h - 6), (4, h - 4)]
    outline = torn(wobble(pts, rng, amp=1.6, seg=10), rng, depth=2.6, step=7)
    sheet = paper_tex((w, h), rng, SHEET_L)
    sheet.putalpha(shape_mask((w, h), outline))
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    inner = [(x * .88 + w * .06, y * .84 + h * .08) for x, y in outline]
    hand_line(ImageDraw.Draw(layer), wobble(inner, rng, amp=1.4, seg=10) + [wobble(inner, rng, amp=1.4, seg=10)[0]],
              INK + (110,), rng, width=1.6)
    sheet.alpha_composite(layer)
    return sheet


def make_diamond(size=40, filled=False):
    """分段刻度用的菱形（手绘：四条抖边）。空芯 = 描边，实芯 = 填色。"""
    rng = random.Random(SEED + 5)
    c = size / 2
    pts = [(c, 3), (size - 3, c), (c, size - 3), (3, c)]
    outline = wobble(pts, rng, amp=1.3, seg=6)
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if filled:
        d.polygon(outline, fill=(70, 34, 8, 255))
        hand_line(d, outline + [outline[0]], (28, 14, 2, 200), rng, width=1.4)
    else:
        hand_line(d, outline + [outline[0]], (150, 120, 76, 220), rng, width=1.7)
    return im


def make_shelf(w=132, h=76):
    """石雕托架（原创简写）：上横板 + 下收的弧腹 + 两道刻痕。

    第一版画成「梯形 + 三道横线」⇒ 读起来是块带条纹的墓碑。托架的识别点是**上宽下收的弧**
    与横板的分界，所以按剪影来画，刻痕只落在腹上。"""
    rng = random.Random(SEED + 6)
    # 托架剪影：上横板 + 竖直背 + 内凹的弧（第三版：前两版分别是「条纹墓碑」和「碗」）
    pts = [(4, 4), (w - 4, 4), (w - 6, 16), (w * 0.60, 16), (w * 0.50, h * 0.52),
           (w * 0.40, h - 6), (5, h - 6)]
    pts = pts[:1] + [(w - 4, 4), (w - 6, 16), (w * 0.60, 16), (w * 0.50, h * 0.52),
                     (w * 0.40, h - 6), (5, h - 6), (4, h * 0.5)]
    outline = torn(wobble(pts, rng, amp=1.6, seg=10), rng, depth=3.0, step=6)
    body = Image.new("RGBA", (w, h), STONE + (255,))
    d = ImageDraw.Draw(body)
    for i in range(h):                                     # 上亮下暗的石面
        k = i / (h - 1)
        d.line((0, i, w, i), fill=(int(STONE[0] + 30 * (1 - k)), int(STONE[1] + 28 * (1 - k)), int(STONE[2] + 24 * (1 - k)), 255))
    hand_line(d, wobble([(8, 22), (w - 10, 21)], rng, 1.2, 10), (30, 24, 14, 190), rng, width=2.0)   # 横板与腹的分界
    hand_line(d, wobble([(w * 0.30, h - 26), (w * 0.70, h - 27)], rng, 1.2, 10), (30, 24, 14, 130), rng, width=1.6)
    body.putalpha(shape_mask((w, h), outline))
    hand_line(ImageDraw.Draw(body), outline + [outline[0]], (24, 18, 10, 200), rng, width=2.0)
    sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sh.paste((0, 0, 0, 95), (0, 0), shape_mask((w, h), [(x + 2, y + 3) for x, y in outline], blur=2.4))
    return Image.alpha_composite(sh, body)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    items = {
        "page.png": make_page(),
        "btn.png": make_btn(),
        "btn-hover.png": make_btn(hover=True),
        "brush.png": make_brush(),
        "tag.png": make_tag(),
        "tick-empty.png": make_diamond(40, False),
        "tick-full.png": make_diamond(40, True),
        "shelf.png": make_shelf(),
    }
    for name, im in items.items():
        im.save(OUT / name)
        print("  生成 %-16s %dx%d" % (name, im.width, im.height))
    print("→", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
