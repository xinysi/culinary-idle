# -*- coding: utf-8 -*-
"""⚠️ **已被取代，不要重跑**（2026-09-25 标注）。

2026-09-23 起食客立绘改成了**专门出的「纯洋红底」20 张**（见 `key_patrons.py`），本脚本是那之前的
过渡方案：把对决用的 248 张（近白底）去白边后**输出到同一个 `guests/` 目录**。
⇒ 重跑它会把好的 patron 立绘覆盖成旧的敌人图。**当前它是惰性的**（`pool_ids()` 只匹配 `'enemy_*_NN'`，
而 `restaurantFaces.js` 早已改成 `patron_*` ⇒ 读不到清单、直接退出），留着只为追溯「白边怎么去」的做法。
新食客出图请走：`docs/ui-pixel/食客立绘_出图提示词.md` → `patrons-raw/` → `key_patrons.py`。

—— 以下为原说明 ——
餐厅食客立绘：把「白底残留」从半透明边缘里减掉（2026-09-23 用户：「人物内部有没抠干净的吗」）。

背景：`public/images/enemies/` 那 248 张是按「近白背景 → 外缘 1~2px 抗锯齿白边压成半透明」处理的
（见 `process_enemy_images.py` 的说明）。这种做法在**深色**背景上会露馅：半透明像素里还混着白，
合成出来就是人物外圈一层浅色晕 —— 看着像「没抠干净」。

做法（标准去白底/去 matte，alpha un-premultiply）：对每个 0 < a < 255 的像素，
假设它 = 前景×(a/255) + 白×(1-a/255)，反解前景色：
    c' = (c − 255·(1−a/255)) / (a/255)
再夹到 0~255；顺带把 a 很小又很亮的孤立像素直接清成透明（去掉 1px 白圈）。
**只输出到新目录**，不动 `public/images/enemies/`（那是对决在用的图，不能改）。

用法： python scripts/dev/dealpha_guests.py            # 读 restaurantFaces.js 的清单，写 public/images/restaurant/guests/
      python scripts/dev/dealpha_guests.py --size 384   # 顺手降采样（默认 512，保持与源图一致）
"""
import argparse, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FACES_JS = os.path.join(ROOT, 'src', 'game', 'data', 'restaurantFaces.js')
SRC_DIR = os.path.join(ROOT, 'public', 'images', 'enemies')
OUT_DIR = os.path.join(ROOT, 'public', 'images', 'restaurant', 'guests')


def pool_ids():
    """立绘清单的唯一来源是 restaurantFaces.js（组件与脚本都不许另抄一份）"""
    txt = open(FACES_JS, encoding='utf-8').read()
    return re.findall(r"'(enemy_[A-Za-z]+_\d{2})'", txt)


def dealpha(im: Image.Image) -> tuple[Image.Image, int]:
    """去掉白底 matte。返回 (处理后图像, 被修正的像素数)"""
    im = im.convert('RGBA')
    px = im.load()
    W, H = im.size
    fixed = 0
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if a < 24 and r > 200 and g > 200 and b > 200:
                px[x, y] = (r, g, b, 0)     # 1px 的浅色孤立边，直接清掉
                fixed += 1
                continue
            if a == 255:
                continue
            f = a / 255.0
            nr = int(max(0, min(255, (r - 255 * (1 - f)) / f)))
            ng = int(max(0, min(255, (g - 255 * (1 - f)) / f)))
            nb = int(max(0, min(255, (b - 255 * (1 - f)) / f)))
            if (nr, ng, nb) != (r, g, b):
                fixed += 1
            px[x, y] = (nr, ng, nb, a)
    return im, fixed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--size', type=int, default=512, help='输出边长（默认 512，与源图一致）')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    ids = pool_ids()
    if not ids:
        print('❌ 没从 restaurantFaces.js 读到立绘清单'); sys.exit(1)
    os.makedirs(OUT_DIR, exist_ok=True)
    total_fixed = 0
    rows = []
    for i, id_ in enumerate(ids, 1):
        src = os.path.join(SRC_DIR, id_ + '.png')
        if not os.path.exists(src):
            print('⚠️ 缺源图', id_); continue
        im, fixed = dealpha(Image.open(src))
        if a.size and a.size != im.size:
            im = im.resize((a.size, a.size), Image.BOX)
        out = os.path.join(OUT_DIR, id_ + '.png')
        if not a.dry_run:
            im.save(out, optimize=True)
        total_fixed += fixed
        rows.append((id_, fixed, os.path.getsize(src) // 1024, (os.path.getsize(out) // 1024) if not a.dry_run else 0))
    print('处理 %d 张，累计修正边缘像素 %d' % (len(rows), total_fixed))
    for r in rows[:5]:
        print('   %-34s 修正 %5d 源 %4dKB → 出 %4dKB' % r)
    if len(rows) > 5:
        print('   …其余 %d 张省略' % (len(rows) - 5))
    if a.dry_run:
        print('（--dry-run：没有写文件）')


if __name__ == '__main__':
    main()
