"""全库物品图总览：每张 48px，按目录分组、每组一页 —— 人眼过一遍「有没有主体残缺」。
孔洞扫描只抓「封闭孔洞」，抓不到「少了一半但连通外部」的残缺 ⇒ 必须要人眼看一遍。"""
import glob
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'images', 'items')
OUTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public')

files = sorted(glob.glob(os.path.join(ROOT, '**', '*.png'), recursive=True))
files = [f for f in files if Image.open(f).size == (64, 64)]
print('共 %d 张' % len(files))

S, PAD, COLS, ROWS = 48, 5, 20, 14                 # 每页 280 张
FONT = ImageFont.truetype(r'C:\Windows\Fonts\msyh.ttc', 9)
per = COLS * ROWS
pages = (len(files) + per - 1) // per
for p in range(pages):
    chunk = files[p * per:(p + 1) * per]
    im = Image.new('RGB', (COLS * (S + PAD) + PAD, ROWS * (S + 13) + PAD), (30, 21, 15))
    d = ImageDraw.Draw(im)
    for i, f in enumerate(chunk):
        x, y = PAD + (i % COLS) * (S + PAD), PAD + (i // COLS) * (S + 13)
        src = Image.open(f).convert('RGBA').resize((S, S), Image.LANCZOS)
        bg = Image.new('RGB', (S, S), (30, 21, 15))
        bg.paste(src, (0, 0), src)
        im.paste(bg, (x, y))
        d.text((x, y + S + 1), os.path.basename(f)[:-4][:6], fill=(220, 210, 200), font=FONT)
    out = os.path.join(OUTDIR, '.all%d.png' % (p + 1))
    im.save(out)
    print('第 %d 页 %d 张 → %s' % (p + 1, len(chunk), out))
