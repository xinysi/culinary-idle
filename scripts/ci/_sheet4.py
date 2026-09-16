# 把四个文件夹的图各排成一张对照图（按修改时间升序，带序号），供人工辨认后命名
import os
import tempfile
from PIL import Image, ImageDraw

TMP = tempfile.gettempdir()
GROUPS = [('ty', '陶艺'), ('bz', '编织'), ('cx', '刺绣'), ('nz', '蜡烛')]
CELL = 150

for key, label in GROUPS:
    d = os.path.join(r'D:\迅雷下载', key)
    files = [f for f in os.listdir(d) if f.lower().endswith('.png')]
    files.sort(key=lambda f: os.path.getmtime(os.path.join(d, f)))
    cols = 5
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new('RGB', (CELL * cols, CELL * rows), (240, 240, 242))
    dr = ImageDraw.Draw(sheet)
    names = []
    for i, f in enumerate(files):
        im = Image.open(os.path.join(d, f)).convert('RGB')
        im.thumbnail((CELL - 22, CELL - 22), Image.LANCZOS)
        x = (i % cols) * CELL + (CELL - im.width) // 2
        y = (i // cols) * CELL + 18
        sheet.paste(im, (x, y))
        dr.text(((i % cols) * CELL + 5, (i // cols) * CELL + 3), '#%d  %s' % (i + 1, f[-7:-4]), fill=(20, 20, 20))
    p = os.path.join(TMP, 'sheet_%s.png' % key)
    sheet.save(p)
    print('%s（%s）%d 张 -> %s' % (key, label, len(files), p))
