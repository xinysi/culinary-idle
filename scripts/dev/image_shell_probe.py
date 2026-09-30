"""全库扫描（第二判据）：**「只剩外壳」检测** —— 把不透明区域腐蚀 2px，看还剩多少。
实心物体剩 70%+；被去背挖空、只剩一圈描边的会掉到个位数（`宣纸` 就是这样）。
⚠️ 天生很细的东西（刀刃/箭/线香/网）也会低 ⇒ 仍是**排名**，要人眼复核。"""
import glob
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'images', 'items')
OUTTXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'docs', '图片体检-外壳扫描.txt')

rows = []
for p in glob.glob(os.path.join(ROOT, '**', '*.png'), recursive=True):
    try:
        im = Image.open(p)
    except Exception:
        continue
    if im.size != (64, 64):
        continue
    a = np.asarray(im.convert('RGBA'))[:, :, 3]
    op = a > 8
    n = op.sum()
    if n < 20:
        continue
    er = ndimage.binary_erosion(op, structure=np.ones((3, 3)), iterations=2, border_value=0)
    rows.append((er.sum() / float(n), n / 4096.0, os.path.relpath(p, ROOT)))

rows.sort()
os.makedirs(os.path.dirname(OUTTXT), exist_ok=True)
with open(OUTTXT, 'w', encoding='utf-8') as f:
    f.write('全库物品图「只剩外壳」扫描（2026-09-30）\n')
    f.write('判据：不透明区域腐蚀 2px 后剩余比例。实心物体 ≥70%；只剩外壳的 <10%。\n')
    f.write('⚠️ 天生细长的（刀/箭/线香/网）也会低 ⇒ 排名，人眼复核。共 %d 张。\n\n' % len(rows))
    f.write('%-10s %-10s %s\n' % ('腐蚀后剩余', '实心占比', '文件'))
    for r, s, rel in rows[:200]:
        f.write('%-10.1f%% %-10.1f%% %s\n' % (r * 100, s * 100, rel))
print('报告 →', OUTTXT)

top = rows[:48]
S, PAD, COLS = 96, 8, 8
FONT = ImageFont.truetype(r'C:\Windows\Fonts\msyh.ttc', 12)
rowsn = (len(top) + COLS - 1) // COLS
im = Image.new('RGB', (COLS * (S + PAD) + PAD, rowsn * (S + 24) + PAD), (30, 21, 15))
d = ImageDraw.Draw(im)
for i, (r, s, rel) in enumerate(top):
    x, y = PAD + (i % COLS) * (S + PAD), PAD + (i // COLS) * (S + 24)
    src = Image.open(os.path.join(ROOT, rel)).convert('RGBA').resize((S, S), Image.LANCZOS)
    bg = Image.new('RGB', (S, S), (30, 21, 15))
    bg.paste(src, (0, 0), src)
    im.paste(bg, (x, y))
    d.text((x, y + S + 2), '%s %.0f%%' % (os.path.basename(rel)[:-4][:7], r * 100), fill=(250, 240, 230), font=FONT)
out = os.path.join(os.path.dirname(ROOT), '..', '.shell.png')
im.save(out)
print('拼图 → public/.shell.png')
