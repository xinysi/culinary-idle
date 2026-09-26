# -*- coding: utf-8 -*-
"""按「Potion Craft 风」实测色板生成**自己画的**程序化纹理（羊皮纸 / 橄榄斑驳底 / 木条）。

⚠️ 为什么是「自己画」而不是直接用它游戏里的图：那套美术是 Warp Zone / niceplay 的版权资产，
   抄进公开仓库和发行包会有法律问题。风格（**色板与材质配方**）不受版权保护，素材本身受。
   所以：色值从它的纹理里**量出来**（见 potion_recon.py + 本轮实测记录），纹理我们自己生成。

用法：python scripts/dev/gen_potion_textures.py
产出：docs/potion-try/*.png（本地；接入时才拷进 public/images/ui-potion/）
"""
import pathlib
# ⚠️ 这里**故意**用 `random` 而不是 `secrets`：这是画纹理的像素噪声，不是加密用途；
#    固定种子是为了「同一份脚本任何时候跑出来一模一样」（项目可复现约定）。
#    安全扫描会把它报成「弱随机数」——属误报，别改成 secrets（那样纹理每次都不同）。
import random

from PIL import Image, ImageDraw, ImageFilter

OUT = pathlib.Path(r"D:\plays\lmew\docs\potion-try")
BASE = 256          # 单块基础尺寸（最后镜像成 2×2 = 512 的无缝块）
SEED = 20260923     # 固定种子：同一份脚本任何时候跑出来一样（与项目「可复现」约定一致）

# 实测色板（Potion Craft UI 纹理的量化众数，见本轮记录）
GROUND = (120, 96, 48)        # #786030 橄榄褐底
GROUND_D = (96, 72, 24)       # #604818 暗
GROUND_L = (144, 128, 60)     # #908040 亮斑（芥末）
SHEET = (192, 168, 120)       # #C0A878 羊皮纸
SHEET_L = (216, 192, 144)     # #D8C090
SHEET_D = (168, 136, 90)      # #A88860
WOOD = (110, 74, 40)          # #6E4A28 木
INK = (48, 24, 0)             # #301800 轮廓墨褐
RUST = (192, 120, 48)         # #C07830 锈橙


def _noise_layer(size, blobs, colors, radius, rng):
    """在透明层上撒若干半透明圆斑 —— 用来做斑驳/纤维。"""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(blobs):
        r = rng.randint(radius[0], radius[1])
        x = rng.randint(-r, size + r)
        y = rng.randint(-r, size + r)
        c = rng.choice(colors)
        a = rng.randint(18, 64)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(c[0], c[1], c[2], a))
    return layer


def make_tile(base_rgb, blob_colors, *, blobs=900, radius=(3, 26), blur=1.6,
              speck=None, speck_n=0, rng=None):
    rng = rng or random.Random(SEED)
    im = Image.new("RGBA", (BASE, BASE), (base_rgb[0], base_rgb[1], base_rgb[2], 255))
    im.alpha_composite(_noise_layer(BASE, blobs, blob_colors, radius, rng))
    im = im.filter(ImageFilter.GaussianBlur(blur))
    if speck_n:
        d = ImageDraw.Draw(im)
        for _ in range(speck_n):                      # 纸上的霉点/纤维（小而硬，不模糊）
            x, y = rng.randrange(BASE), rng.randrange(BASE)
            r = rng.randint(1, 2)
            c = rng.choice(speck)
            d.ellipse((x - r, y - r, x + r, y + r), fill=(c[0], c[1], c[2], rng.randint(40, 110)))
    # 镜像成 2×2 → 无缝（对边像素互为镜像，平铺看不出接缝）
    out = Image.new("RGBA", (BASE * 2, BASE * 2))
    out.paste(im, (0, 0))
    out.paste(im.transpose(Image.FLIP_LEFT_RIGHT), (BASE, 0))
    out.paste(im.transpose(Image.FLIP_TOP_BOTTOM), (0, BASE))
    out.paste(im.transpose(Image.ROTATE_180), (BASE, BASE))
    return out


def make_wood(height=32, width=512, rng=None):
    """一条木架/木牌：横向木纹 + 顶部高光 + 底部暗边（Potion Craft 的 HoverSlot 就是这个读法）。"""
    rng = rng or random.Random(SEED + 7)
    im = Image.new("RGBA", (width, height), (WOOD[0], WOOD[1], WOOD[2], 255))
    d = ImageDraw.Draw(im)
    for x in range(0, width, 3):                       # 竖纹
        a = rng.randint(0, 46)
        d.line((x, 0, x, height), fill=(INK[0], INK[1], INK[2], a), width=1)
    for i in range(height):                            # 上亮下暗
        k = i / max(1, height - 1)
        a = int(46 * (1 - k))
        d.line((0, i, width, i), fill=(255, 226, 170, a), width=1)
        d.line((0, height - 1 - i, width, height - 1 - i), fill=(INK[0], INK[1], INK[2], int(30 * (1 - k))))
    return im.filter(ImageFilter.GaussianBlur(0.6))


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)
    # ① 橄榄褐斑驳底（整屏背景）
    make_tile(GROUND, [GROUND_D, GROUND_L, (104, 88, 40)], blobs=1100, radius=(6, 40), blur=2.2).save(OUT / "ground-olive.png")
    # ② 羊皮纸（卡片/面板/按钮的纸面）——带纤维与霉点
    make_tile(SHEET, [SHEET_L, SHEET_D, (200, 176, 132)], blobs=1000, radius=(4, 30), blur=1.8,
              speck=[SHEET_D, (140, 108, 64)], speck_n=260).save(OUT / "parchment.png")
    # ③ 木条（架/选中态/页签）
    make_wood().save(OUT / "wood-strip.png")
    for f in sorted(OUT.glob("*.png")):
        print("生成", f.name, Image.open(f).size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
