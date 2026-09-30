"""全库扫描：物品图里有没有「被不透明像素包围的透明孔洞」= 去背把主体挖空的指纹。

判据：把透明像素分两类——
  · **连到画布边**的透明 = 正常背景（去背目标，理应是它）
  · **不与边连通**的透明 = 主体内部的孔洞 ⇒ 正常物品接近 0；被挖空时极大
（注意：某些物品**天生有孔**（玉环/渔网/篮把…），所以这份输出是**排名**、要人眼复核。）
"""
import glob
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'images', 'items')
rows = []
for p in glob.glob(os.path.join(ROOT, '**', '*.png'), recursive=True):
    try:
        im = Image.open(p)
    except Exception:
        continue
    if im.size != (64, 64):
        continue
    a = np.asarray(im.convert('RGBA'))[:, :, 3]
    opaque = a > 8
    if not opaque.any():
        continue
    transp = ~opaque
    lab, _ = ndimage.label(transp, structure=np.ones((3, 3)))
    border_ids = set(lab[0, :].tolist()) | set(lab[-1, :].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    border_ids.discard(0)
    enclosed = transp & ~np.isin(lab, list(border_ids)) if border_ids else transp
    hole = enclosed.mean()                      # 孔洞占整张 64×64 的比例
    solid = opaque.mean()
    rows.append((hole, solid, os.path.relpath(p, ROOT), im.size))

rows.sort(reverse=True)
print('扫到 %d 张 64×64 物品图' % len(rows))
print('\n孔洞占比最高的 40 张（>2% 才列；正常物品应接近 0）：')
n = 0
for hole, solid, rel, _ in rows[:400]:
    if hole < 0.02:
        break
    n += 1
    if n <= 40:
        print('  %5.1f%%  实心 %5.1f%%  %s' % (hole * 100, solid * 100, rel))
print('\n孔洞 >2%% 的共 %d 张；>10%% 的 %d 张；>25%% 的 %d 张' % (
    n, sum(1 for h, _, _, _ in rows if h > 0.10), sum(1 for h, _, _, _ in rows if h > 0.25)))
