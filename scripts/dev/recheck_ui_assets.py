# -*- coding: utf-8 -*-
"""UI 素材复检：内容包围盒 / 长宽比 / 主色判定 + 两张体检图（原图、实机尺寸、关键放大）。
用法：python scripts/dev/recheck_ui_assets.py
"""
import os, collections
from PIL import Image, ImageDraw

D = os.environ.get("SRC", r"C:\Users\xin'si\.zcode\workspace\default\lmew\ui-paper-source")
OUT = r"D:\plays\lmew\docs\ui-mockup"

# 规范目标（@2x 或实机像素）与是否可九宫格拉伸
SPEC = {
    "FRAME_CARD": (428, 662, True), "FRAME_PANEL": (500, 840, True), "FRAME_MODAL": (600, 400, True),
    "FRAME_BTN": (140, 48, True), "FRAME_BTN_RED": (432, 62, True), "FRAME_TAB": (150, 58, True),
    "FRAME_TAB_ON": (150, 58, True), "FRAME_INPUT": (340, 48, True), "FRAME_BAR_SLOT": (440, 16, True),
    "FRAME_BAR_FILL": (280, 16, True), "STEAM_LINE": (600, 16, True), "LINE_CHOPSTICK": (400, 8, True),
    "LINE_STROKE_RED": (6, 60, True), "LINE_STROKE_COPPER": (6, 60, True), "LINE_STROKE_AMBER": (6, 60, True),
    "BADGE_S": (64, 26, False), "BADGE_M": (90, 44, False), "BADGE_L": (152, 44, False),
    "CHECK_OFF_S": (32, 32, False), "CHECK_OFF_M": (44, 44, False), "CHECK_ON_S": (32, 32, False),
    "CHECK_ON_M": (44, 44, False), "LOCK_LINEWORK": (26, 26, False), "SEAL_BOWL": (36, 36, False),
    "SEAL_CHOP": (32, 40, False), "SEAL_SPOON": (36, 36, False), "SEAL_POT": (36, 36, False),
    "SEAL_TEAPOT": (36, 36, False), "SEAL_STEAMER": (36, 36, False),
    "WM_PLATE": (124, 124, False), "WM_STEAMER": (144, 144, False), "WM_CHOPREST": (96, 96, False),
}

PALETTE = {"纸白": (250, 247, 242), "纯白": (255, 255, 255), "墨": (43, 38, 34),
           "铜线": (201, 174, 134), "朱红": (166, 55, 31), "琥珀": (224, 138, 60), "淡米": (239, 231, 218)}


def nearest(rgb):
    best, bd = None, 1e9
    for name, c in PALETTE.items():
        d = sum((a - b) ** 2 for a, b in zip(rgb, c))
        if d < bd:
            bd, best = d, name
    return best, int(bd ** 0.5)


def analyse(name):
    im = Image.open(os.path.join(D, name)).convert("RGBA")
    W, H = im.size
    px = im.load()
    xs, ys = [], []
    cols = collections.Counter()
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            r, g, b, a = px[x, y]
            if a > 40:
                xs.append(x); ys.append(y)
                cols[(r // 24 * 24, g // 24 * 24, b // 24 * 24)] += 1
    if not xs:
        return None
    bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
    dom = cols.most_common(1)[0][0]
    domname, dist = nearest(dom)
    return dict(size=(W, H), box=(min(xs), min(ys), max(xs), max(ys)), content=(bw, bh),
                aspect=bw / bh, dom=dom, domname=domname, dist=dist, colors=len(cols))


print(f"{'素材':<20}{'画布':>11}{'内容':>13}{'长宽比':>8}{'目标比':>8}{'目标尺寸':>10}  主色 / 判定")
rep = {}
for f in sorted(os.listdir(D)):
    if not f.endswith(".png") or f.startswith("_"):
        continue
    key = f[:-4]
    a = analyse(f)
    if not a:
        print(f"{key:<20} 空图")
        continue
    rep[key] = a
    size_s = "%d×%d" % a["size"]
    cont_s = "%d×%d" % a["content"]
    t = SPEC.get(key)
    if t:
        tr = t[0] / t[1]
        ratio = a["aspect"] / tr
        if t[2]:
            verdict = "可九宫格拉伸（形状不必等比）"
        else:
            verdict = "✅ 形状相符" if 0.75 < ratio < 1.35 else "⚠️ 形状偏差 %.2f×" % ratio
        print(f"{key:<20}{size_s:>11}{cont_s:>13}{a['aspect']:>8.2f}{tr:>8.2f}{('%d×%d' % (t[0], t[1])):>10}  {a['domname']} · {verdict}")
    else:
        print(f"{key:<20}{size_s:>11}{cont_s:>13}{a['aspect']:>8.2f}{'—':>8}{'（未登记）':>10}  {a['domname']}")

def cell_sheet(items, cell, cols, path, title, fit):
    rows = (len(items) + cols - 1) // cols
    cv = Image.new("RGBA", (cols * cell, rows * cell + 30), (246, 244, 240, 255))
    d = ImageDraw.Draw(cv)
    d.text((8, 8), title, fill=(40, 35, 30, 255))
    for i, (name, box) in enumerate(items):
        cx, cy = (i % cols) * cell, (i // cols) * cell + 30
        for yy in range(cy, cy + cell, 12):
            for xx in range(cx, cx + cell, 12):
                if ((xx - cx) // 12 + (yy - cy) // 12) % 2 == 0:
                    d.rectangle([xx, yy, xx + 11, yy + 11], fill=(228, 224, 216, 255))
        im = Image.open(os.path.join(D, name)).convert("RGBA")
        bx = im.getbbox()
        if bx:
            im = im.crop(bx)
        if fit and box:
            tw, th = box
        else:
            k = (cell - 30) / max(im.size)
            tw, th = max(1, int(im.width * k)), max(1, int(im.height * k))
        im2 = im.resize((max(1, tw), max(1, th)), Image.LANCZOS)
        cv.alpha_composite(im2, (cx + (cell - im2.width) // 2, cy + (cell - im2.height) // 2))
        label = name.replace(".png", "") + (f"  {box[0]}×{box[1]}" if box else "")
        d.text((cx + 6, cy + cell - 16), label, fill=(90, 84, 76, 255))
    cv.convert("RGB").save(path, quality=95)
    print("saved", path, cv.size)


files = [f for f in sorted(os.listdir(D)) if f.endswith(".png") and not f.startswith("_")]
cell_sheet([(f, None) for f in files], 168, 6, os.path.join(OUT, "素材复检-原图.png"), "复检：全部素材（缩略）", False)

REAL = [("FRAME_TAB.png", (75, 29)), ("FRAME_TAB_ON.png", (75, 29)), ("BADGE_S.png", (32, 13)),
        ("BADGE_M.png", (45, 22)), ("BADGE_L.png", (76, 22)), ("FRAME_BTN.png", (70, 24)),
        ("CHECK_ON_S.png", (16, 16)), ("SEAL_BOWL.png", (18, 18)), ("FRAME_CARD.png", (214, 331)),
        ("FRAME_BTN_RED.png", (216, 31)), ("FRAME_INPUT.png", (170, 24)), ("FRAME_BAR_SLOT.png", (220, 8))]
cell_sheet(REAL, 380, 4, os.path.join(OUT, "素材复检-实机尺寸.png"),
           "复检：按实机尺寸（标注为该控件在页面上的真实像素）", True)
