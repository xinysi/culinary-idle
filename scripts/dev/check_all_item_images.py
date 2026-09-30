"""全库物品图入库后的体检（只读）：
  ① 每件物品的图**在不在**（与 itemImage 约定对账）
  ② 实心度过低（<25%）的清单 —— 对细长物（刀/箭/竿/链）是正常的，要人眼复核
  ③ 与 git HEAD 里的旧图比：实心度掉 25% 以上的（可能新图更空）
  ④ 尺寸/模式/两两不同
输出：docs/图片体检-入库后.txt
"""
import glob
import json
import os
import subprocess
import sys
from io import BytesIO

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'docs', '图片体检-入库后.txt')


def read_json(p):
    raw = open(p, 'rb').read()
    return json.loads(raw.decode('utf-16') if raw[:2] in (b'\xff\xfe', b'\xfe\xff') else raw.decode('utf-8'))


def solid(im):
    a = np.asarray(im.convert('RGBA'))[:, :, 3]
    return float((a > 8).mean())


def main():
    items = read_json(os.path.join(ROOT, 'scripts', 'dev', '.items.json'))
    missing, low, worse, sig = [], [], [], set()
    for it in items:
        p = os.path.join(ROOT, 'public', it['img']) if it['img'] else None
        if not p or not os.path.exists(p):
            missing.append('%s (%s)' % (it['name'], it['img']))
            continue
        im = Image.open(p)
        if im.size != (64, 64) or im.mode != 'RGBA':
            missing.append('%s 尺寸/模式不对 %s %s' % (it['name'], im.size, im.mode))
        s = solid(im)
        sig.add(hash(im.tobytes()))
        old = None
        try:
            blob = subprocess.run(['git', 'show', 'HEAD:%s' % os.path.relpath(p, ROOT).replace('\\', '/')],
                                  cwd=ROOT, capture_output=True).stdout
            old = solid(Image.open(BytesIO(blob)))
        except Exception:                            # noqa: BLE001
            pass
        if s < 0.25:
            low.append((it['name'], s, old))
        if old and s < old * 0.75:
            worse.append((it['name'], old, s))

    L = ['入库后全库体检（2026-09-30 全库重出）', '',
         '物品 %d 件；缺图/异常 %d；实心<25%% %d 件；比旧图掉 25%% 以上 %d 件；不同图 %d 张' %
         (len(items), len(missing), len(low), len(worse), len(sig)), '']
    L += ['══ 缺图/异常 ══'] + ['  ✗ ' + m for m in missing[:30]]
    L += ['', '══ 实心<25%%（多为天生细长，需人眼复核）══']
    L += ['  %-16s 新 %5.1f%%  旧 %s' % (n, s * 100, '%.1f%%' % (o * 100) if o else '无') for n, s, o in sorted(low, key=lambda x: x[1])[:60]]
    L += ['', '══ 比旧图更空（掉 25%% 以上）══']
    L += ['  %-16s 旧 %5.1f%% → 新 %5.1f%%' % (n, o * 100, s * 100) for n, o, s in sorted(worse, key=lambda x: x[2] / max(x[1], 1e-6))[:40]]
    open(OUT, 'w', encoding='utf-8').write('\n'.join(L))
    print(L[2])
    print('→', OUT)


if __name__ == '__main__':
    sys.exit(main())
