"""把 `D:\\迅雷下载\\bjt` 的 210 张背景（105 场景 × 昼/夜）转成游戏用的 WebP。

档位依据（2026-10-01 实测）：
  · 源是 1920×1080 **PNG**，单张 2.8~4.4MB（总 728MB，不可能直接入库）；
  · 三档实测（启动页/采摘夜/山海）：WebP@1920 q82 = 283~421KB、**@1600 q78 = 197~298KB**、@1440 q75 = 152~237KB、
    JPEG@1600 q85 = 359~474KB（比 WebP 还大）；
  · 而**三块面板不透明度 82~88%** ⇒ 背景大部分被盖住，只有页头/缝隙看得见 ⇒ 取 **1600×900 / q78**（≈240KB 均值、全量 ≈50MB）。
    改档位只改下面 SIZE/Q 两个常量。

输出：`public/images/bg/<场景>.webp`（白天）+ `<场景>_night.webp`（夜晚）。
"""
import os
import sys

from PIL import Image

SRC = r'D:\迅雷下载\bjt'
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUTDIR = os.path.join(ROOT, 'public', 'images', 'bg')
SIZE, Q = 1600, 78


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith('.png'))
    if len(files) % 2:
        print('⚠️ 文件数 %d 不是偶数（昼夜应成对）' % len(files))
    total = 0
    for i, f in enumerate(files, 1):
        scene = f.replace('_夜晚_1920x1080.png', '').replace('_1920x1080.png', '')
        night = '_夜晚_' in f
        dst = os.path.join(OUTDIR, '%s%s.webp' % (scene, '_night' if night else ''))
        im = Image.open(os.path.join(SRC, f)).convert('RGB')
        im = im.resize((SIZE, round(im.height * SIZE / im.width)), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=Q, method=6)
        total += os.path.getsize(dst)
        if i % 20 == 0 or i == len(files):
            print('  … %d/%d  累计 %.1fMB' % (i, len(files), total / 1048576), flush=True)
    print('完成 %d 张 → %s（平均 %.0fKB，合计 %.1fMB）' % (len(files), OUTDIR, total / len(files) / 1024, total / 1048576))
    return 0


if __name__ == '__main__':
    sys.exit(main())
