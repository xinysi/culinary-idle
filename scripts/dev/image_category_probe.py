"""按**类别**系统性找「被去背挖空」的图：同类物品本该有相近的「腐蚀后剩余」，
明显掉队的（< 该类中位数 × 0.6，且该类中位数本身就 ≥50%）就是嫌疑。

为什么要按类别：同一条判据对「天生细长」（刀/链/网/草）也低 ⇒ 只有**跟自己同类比**才有意义。
（2026-09-30 用户发现 `贝壳扣` 也是受害者 —— 它所在的类别上次没手工比过。）
"""
import glob
import json
import os
import statistics

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..', 'public', 'images', 'items')
_cats_path = os.path.join(HERE, '..', '..', '.cats.json')
if not os.path.exists(_cats_path):                   # 自足：缺了就自己重导一次（避免「跑不起来」）
    import subprocess
    with open(_cats_path, 'w', encoding='utf-8') as _f:
        subprocess.run(['node', os.path.join(HERE, 'dump_item_cats.mjs')], stdout=_f, check=True)
_raw = open(_cats_path, 'rb').read()
# PowerShell 的 `>` 重定向写的是 UTF-16LE（带 BOM）⇒ 两种都试一次（这个坑本项目踩过多次）
CATS = json.loads(_raw.decode('utf-16') if _raw[:2] in (b'\xff\xfe', b'\xfe\xff') else _raw.decode('utf-8'))
OUT = os.path.join(HERE, '..', '..', 'docs', '图片体检-按类别异常.txt')

# 物品名 → 图的路径
img = {}
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
    rgb = np.asarray(im.convert('RGB')).astype(np.int16)
    mx = rgb.max(axis=2)[op]
    mn = rgb.min(axis=2)[op]
    sat = float((mx - mn).mean()) if mx.size else 0.0        # 存活像素的平均饱和度
    val = float(mx.mean()) if mx.size else 0.0                # 平均亮度
    img[os.path.basename(p)[:-4]] = (n / 4096.0, er.sum() / float(n), sat, val)

groups = {}
for it in CATS:
    if it['name'] in img:
        groups.setdefault(it['category'] or '(无类别)', []).append((it['name'], img[it['name']]))

lines = []
lines.append('按类别体检：同类别内「腐蚀后剩余」掉队的（2026-09-30）')
lines.append('判据：该类中位数 ≥50%（即该类本该是实心的）且 本件 < 中位数×0.6 ⇒ 嫌疑')
lines.append('')
suspects = []
for cat, members in sorted(groups.items()):
    if len(members) < 3:
        continue
    med = statistics.median([s for _, (_, s, _, _) in members])
    if med < 0.5:
        continue                                    # 该类天生细长（刀/链/网），不参与
    # 只有「**淡色**外壳」才是去背挖空的指纹：链条/香草/虾蟹虽然也细，但存活像素是**饱和色**
    bad = [(nm, so, su, st, va) for nm, (so, su, st, va) in members if su < med * 0.6 and st < 55]
    if not bad:
        continue
    lines.append('══ 类别 %s（%d 件，中位剩余 %.0f%%）══' % (cat, len(members), med * 100))
    for nm, so, su, st, va in sorted(bad, key=lambda x: x[2]):
        lines.append('   ✗ %-16s 实心 %5.1f%%  腐蚀后剩 %5.1f%%  饱和 %4.0f 亮度 %3.0f' % (nm, so * 100, su * 100, st, va))
        suspects.append((cat, nm, so, su, st))
    lines.append('')
lines.append('共 %d 件嫌疑。' % len(suspects))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf-8').write('\n'.join(lines))
print('报告 →', OUT)
print('嫌疑 %d 件' % len(suspects))
