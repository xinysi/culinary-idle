"""全尺寸物品图体检（2026-09-30 第二版）—— 覆盖 64×64 **与 32×32**（上一版只扫 64×64，漏了 625 张）。

判据（按尺寸归一，32×32 用 1px 腐蚀、64×64 用 2px）：
  ① 腐蚀后剩余 = 去掉边缘一圈后还剩多少 ⇒ 只剩外壳的会接近 0
  ② 存活像素的平均饱和度 ⇒ 「淡色外壳」（白纸/白布/白皂）才是被去背挖空的指纹，
     链条/香草/虾蟹虽然也「细」，但它们是**饱和色**，不算
  ③ 与**同类别**比（按 ITEMS.category 分组）：同类本该相近，掉队的才是受害者
输出：docs/图片体检-全尺寸.txt
"""
import glob
import json
import os
import statistics
import subprocess

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
OUTROOT = os.path.join(HERE, '..', '..')
IMG = os.path.join(OUTROOT, 'public', 'images', 'items')
CATS_JSON = os.path.join(OUTROOT, '.cats.json')
if not os.path.exists(CATS_JSON):
    with open(CATS_JSON, 'w', encoding='utf-8') as f:
        subprocess.run(['node', os.path.join(HERE, 'dump_item_cats.mjs')], stdout=f, check=True)
raw = open(CATS_JSON, 'rb').read()
CATS = json.loads(raw.decode('utf-16') if raw[:2] in (b'\xff\xfe', b'\xfe\xff') else raw.decode('utf-8'))

stats = {}
sizes = {}
for p in glob.glob(os.path.join(IMG, '**', '*.png'), recursive=True):
    sub = os.path.basename(os.path.dirname(p))
    if sub == 'pt':
        continue
    im = Image.open(p)
    w, h = im.size
    sizes[(sub, f'{w}x{h}')] = sizes.get((sub, f'{w}x{h}'), 0) + 1
    a = np.asarray(im.convert('RGBA'))[:, :, 3]
    op = a > 8
    n = op.sum()
    if n < 10:
        continue
    it = 1 if w <= 32 else 2                      # 腐蚀半径按尺寸归一
    er = ndimage.binary_erosion(op, structure=np.ones((3, 3)), iterations=it, border_value=0)
    rgb = np.asarray(im.convert('RGB')).astype(np.int16)
    mx = rgb.max(axis=2)[op]; mn = rgb.min(axis=2)[op]
    stats[os.path.basename(p)[:-4]] = (w, n / float(w * h), er.sum() / float(n), float((mx - mn).mean()))

groups = {}
for c in CATS:
    if c['name'] in stats:
        groups.setdefault(c['category'] or '(无类别)', []).append(c['name'])

L = ['全尺寸物品图体检（2026-09-30）—— 覆盖 64×64 与 32×32',
     '判据：同类别比「腐蚀后剩余」；且存活像素平均饱和度 <55（淡色外壳才判嫌疑）', '']
L.append('图片尺寸分布：' + '  '.join(f'{k[0]}/{k[1]}={v}' for k, v in sorted(sizes.items())))
L.append('')
sus = []
for cat, members in sorted(groups.items()):
    if len(members) < 3:
        continue
    med = statistics.median([stats[n][2] for n in members])
    if med < 0.5:
        continue
    bad = [n for n in members if stats[n][2] < med * 0.6 and stats[n][3] < 55]
    if not bad:
        continue
    L.append(f'══ 类别 {cat}（{len(members)} 件，中位剩余 {med*100:.0f}%）══')
    for n in sorted(bad, key=lambda x: stats[x][2]):
        w, so, er, st = stats[n]
        L.append(f'   ✗ {n:<16} {w}×{w}  实心 {so*100:5.1f}%  腐蚀后剩 {er*100:5.1f}%  饱和 {st:4.0f}')
        sus.append((cat, n, w, so, er, st))
    L.append('')
L.append(f'共 {len(sus)} 件嫌疑（{len(stats)} 张图参与）。')
open(os.path.join(OUTROOT, 'docs', '图片体检-全尺寸.txt'), 'w', encoding='utf-8').write('\n'.join(L))
print('图 %d 张参与；嫌疑 %d 件 → docs/图片体检-全尺寸.txt' % (len(stats), len(sus)))
print('尺寸分布：', {f'{k[0]}/{k[1]}': v for k, v in sorted(sizes.items())})
