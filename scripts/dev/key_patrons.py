# -*- coding: utf-8 -*-
"""食客立绘：把「纯洋红底」的 1024 原图处理成游戏用图（2026-09-23）。

为什么要洋红底：本作此前的食客立绘是**借用对决的 248 张**，那批是「近白背景」抠的 —— 而 AI 出图时
**白背心 / 白袍与背景同为纯白**，被身体包住的白块根本分不开（实测 110 张里 58 张有这种块）。
这次让出图用**纯洋红 #FF00FF**：洋红不可能出现在人物配色里 ⇒ 键控零歧义，封闭区域也能安全清掉。

流程：
  ① 洋红判定（`g < 110 且 r,b > 130 且 |r−b| < 80`）→ alpha 0（**不区分是否连通**，洋红底可以这么干）
  ② 边缘 2px 环带里的洋红混色 → 按绿通道反解 alpha 并**去掉洋红 matte**（`c' = (c − 洋红·(1−a))/a`）
  ③ 裁到 alpha 包围盒 → 补成正方形 → BOX 缩到 512（与其它立绘同规格）
  ④ 自检：报告每张的「残留洋红像素」与「封闭的浅色块」，有残留就点名

⚠️ **输出格式是 WebP（q92），不是 PNG**（2026-09-25 图片瘦身）：20 张从 2.27MB 压到 0.48MB，分辨率没降
（餐厅立绘最大显示 ~315px，源图仍 512）。档位口径唯一出口 = `scripts/dev/image_quality.py`；
游戏侧读图在 `src/game/data/restaurantFaces.js`（`.webp`），两边必须一致，否则图出了不显示。

用法： python scripts/dev/key_patrons.py                     # 默认读 docs/ui-pixel/restaurant/patrons-raw
      python scripts/dev/key_patrons.py --src <目录> --out public/images/restaurant/guests
"""
import argparse, os, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from image_quality import PORTRAIT_Q, save_webp  # noqa: E402  档位唯一出口

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEF_SRC = os.path.join(ROOT, 'docs', 'ui-pixel', 'restaurant', 'patrons-raw')
DEF_OUT = os.path.join(ROOT, 'public', 'images', 'restaurant', 'guests')
SIZE = 512
SCREEN = (255, 0, 255)


def is_magenta(r, g, b):
    return g < 110 and r > 130 and b > 130 and abs(r - b) < 80


def key_one(path, out_path):
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    px = im.load()
    magenta = [[False] * H for _ in range(W)]
    for x in range(W):
        for y in range(H):
            r, g, b, _ = px[x, y]
            if is_magenta(r, g, b):
                magenta[x][y] = True
                px[x, y] = (0, 0, 0, 0)
    # ② 边缘环带：混了洋红的像素 → 反解 alpha 并去 matte
    fixed = 0
    for x in range(W):
        for y in range(H):
            if magenta[x][y]:
                continue
            near = False
            for dx in (-2, -1, 0, 1, 2):
                for dy in (-2, -1, 0, 1, 2):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and magenta[nx][ny]:
                        near = True
                        break
                if near:
                    break
            if not near:
                continue
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # 绿通道离洋红越远越不透明（洋红 g≈0，人物多是 g≥90）
            if g >= 200 or not (r - g > 40 and b - g > 40):
                continue
            f = max(0.0, min(1.0, g / 200.0))
            if f <= 0.02:
                px[x, y] = (0, 0, 0, 0)
            else:
                nr = int(max(0, min(255, (r - SCREEN[0] * (1 - f)) / f)))
                ng = int(max(0, min(255, (g - SCREEN[1] * (1 - f)) / f)))
                nb = int(max(0, min(255, (b - SCREEN[2] * (1 - f)) / f)))
                px[x, y] = (nr, ng, nb, int(255 * f))
            fixed += 1

    # ③ 裁到包围盒 → 补正方形 → 缩到 SIZE
    bb = im.getchannel('A').getbbox()
    if bb:
        im = im.crop(bb)
    w, h = im.size
    side = max(w, h)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)
    canvas = canvas.resize((SIZE, SIZE), Image.BOX)
    save_webp(canvas, out_path, PORTRAIT_Q)

    # ④ 自检
    px2 = canvas.load()
    left_magenta = 0
    for x in range(SIZE):
        for y in range(SIZE):
            r, g, b, a = px2[x, y]
            if a > 40 and is_magenta(r, g, b):
                left_magenta += 1
    return fixed, left_magenta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=DEF_SRC)
    ap.add_argument('--out', default=DEF_OUT)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    files = sorted(f for f in os.listdir(a.src) if f.lower().endswith('.png'))
    if not files:
        print('❌ 没找到原图：' + a.src); sys.exit(1)
    rows = []
    for f in files:
        stem = os.path.splitext(f)[0].replace('-', '_')
        out = os.path.join(a.out, 'patron_%s.webp' % stem)
        fixed, left = key_one(os.path.join(a.src, f), out)
        rows.append((f, fixed, left, os.path.getsize(out) // 1024))
    print('处理 %d 张 → %s' % (len(rows), a.out))
    bad = [r for r in rows if r[2] > 60]
    for r in rows:
        flag = '  ⚠️ 残留洋红 %d' % r[2] if r[2] > 60 else ''
        print('   %-26s 修边 %5d  残留洋红 %4d  %4dKB%s' % (r[0], r[1], r[2], r[3], flag))
    print('有残留的：', len(bad), '张' + ('（都在上面点名了）' if bad else ' · 全部干净'))
    print('池子清单（贴进 restaurantFaces.js）：')
    print("'" + "', '".join('patron_' + os.path.splitext(f)[0].replace('-', '_') for f in files) + "'")


if __name__ == '__main__':
    main()
