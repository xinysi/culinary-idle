# -*- coding: utf-8 -*-
"""放大看关键几张素材（按内容裁剪 → 放大到接近实机尺寸），判断撕边/形状是否成立。
用法：python scripts/dev/inspect_assets.py
"""
import os
from PIL import Image, ImageDraw
import platform

D = os.environ.get("SRC", r"C:\Users\xin'si\.zcode\workspace\default\lmew\ui-paper-source")
OUT = r"D:\plays\lmew\docs\ui-mockup\素材体检-关键几张.png"


def crop(name, thresh=40):
    im = Image.open(os.path.join(D, name)).convert("RGBA")
    px = im.load()
    W, H = im.size
    xs, ys = [], []
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            if px[x, y][3] > thresh:
                xs.append(x); ys.append(y)
    if not xs:
        return im
    return im.crop((max(0, min(xs) - 8), max(0, min(ys) - 8), min(W, max(xs) + 9), min(H, max(ys) + 9)))


items = [("FRAME_TAB.png", (75, 29)), ("FRAME_TAB_ON.png", (75, 29)), ("BADGE_S.png", (32, 13)), ("BADGE_M.png", (45, 22)),
         ("BADGE_L.png", (76, 22)), ("FRAME_BTN.png", (70, 24)), ("CHECK_ON_S.png", (16, 16)), ("SEAL_BOWL.png", (18, 18))]
cols, cell = 4, 300
rows = (len(items) + cols - 1) // cols
cv = Image.new("RGBA", (cols * cell, rows * cell + 30), (246, 244, 240, 255))
d = ImageDraw.Draw(cv)
d.text((8, 8), "关键几张 · 按内容裁剪后放大（棋盘=透明；标注为「原内容尺寸 → 规范实机尺寸」）", fill=(40, 35, 30, 255))
for i, (n, box) in enumerate(items):
    cx, cy = (i % cols) * cell, (i // cols) * cell + 30
    for yy in range(cy, cy + cell, 12):
        for xx in range(cx, cx + cell, 12):
            if ((xx - cx) // 12 + (yy - cy) // 12) % 2 == 0:
                d.rectangle([xx, yy, xx + 11, yy + 11], fill=(228, 224, 216, 255))
    im = crop(n)
    k = min((cell - 40) / im.width, (cell - 60) / im.height, 6)
    im2 = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.NEAREST)
    cv.alpha_composite(im2, (cx + (cell - im2.width) // 2, cy + (cell - im2.height) // 2))
    d.text((cx + 6, cy + cell - 16), f"{n.replace('.png','')}（原 {im.width}×{im.height} → 实机 {box[0]}×{box[1]}）", fill=(90, 84, 76, 255))
cv.convert("RGB").save(OUT, quality=95)
print("saved", OUT, cv.size)
