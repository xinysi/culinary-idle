# -*- coding: utf-8 -*-
"""对决敌人立绘：把 1024×1024 原图批量处理成游戏用图（2026-09-21）

复用 `scripts/gen/process_item_images.py` 的同一套抠底/裁剪/降采样逻辑（单一来源，别抄第二份）：
  · 背景判定：近白 或（低色度且亮），**只去掉与画布边缘连通的那部分** ⇒ 被身体包住的白色（厨师帽/手套/泡沫）不会被啃
  · 外缘 1~2px 抗锯齿白边按白度压成半透明
  · 裁到 alpha 包围盒 → 补成正方形 → 预乘 alpha 面积平均（BOX）缩到目标尺寸

尺寸口径（2026-09-21 第三轮定稿 **512×512**，用 `--size 512`；不传 `--size` 时按前缀自动：
`boss_`/`chef_` 取 256、其余 128 —— 那只是**兜底**，正式出图请显式 `--size 512`）。
🔴 为什么是 512：立绘显示尺寸已放大到 卡片 140~168 / 战斗屏 176，用户报「主角、敌人、卡片都糊糊的」。
  实测根因**两条**：① 256 源图在 DPR≥1.5 的屏幕上不够用（176×1.5 = 264 > 256）；② CSS 里的
  `image-rendering: pixelated` 在**降采样**时是最近邻 —— 512→176 会丢掉 2/3 的像素，变成锯齿。
  ⇒ 源图 512 + **不要**给立绘加 pixelated（`system_test` C51 有断言钉住这两条）。
文件名沿用原名（`enemy_<regionId>_<两位序>.webp` / `boss_<key>.webp`），与生成器给出的名字清单一一对应。

⚠️ **输出格式是 WebP（q92），不是 PNG**（2026-09-25 图片瘦身）：248 张 512×512 从 31.7MB 压到 6.5MB，
分辨率一点没降（卡片显示 140~176px，战斗屏 176px）。档位口径唯一出口 = `scripts/dev/image_quality.py`；
游戏侧读图路径在 `src/game/data/enemyImage.js`（`.webp`），两边必须一致，否则图出了不显示。

用法：
  python scripts/dev/process_enemy_images.py --src D:\\plays\\lmew_art\\enemies-1024 --out public/images/enemies
  python scripts/dev/process_enemy_images.py --src <目录> --out <目录> --dry-run
"""
import argparse, importlib.util, os, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from image_quality import PORTRAIT_Q, save_webp  # noqa: E402  档位唯一出口

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

def load_pipeline():
    spec = importlib.util.spec_from_file_location('pii', os.path.join(ROOT, 'scripts', 'gen', 'process_item_images.py'))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--resample', choices=['box', 'nearest'], default='box')
    # 0 = 自动（boss_/chef_ 前缀 256，其余 128，**兜底用**）；显式给值则全部按该尺寸出图。
    # 2026-09-21 定稿 512（卡片 140~168 / 战斗屏 176 显示；DPR 2 下也是原生像素）。
    ap.add_argument('--size', type=int, default=0, help='统一输出边长（0 = 按前缀自动）')
    args = ap.parse_args()

    m = load_pipeline()
    os.makedirs(args.out, exist_ok=True)
    files = sorted(f for f in os.listdir(args.src) if f.lower().endswith('.png'))
    done, skipped, failed = 0, 0, []
    for f in files:
        size = args.size or (256 if f.startswith(('boss_', 'chef_')) else 128)
        dst = os.path.join(args.out, os.path.splitext(f)[0] + '.webp')
        try:
            sq, side, dropped = m.build(os.path.join(args.src, f))
            if sq is None:
                failed.append((f, '整张被判为背景'))
                continue
            m.OUT_SIZE = size
            out = m.downsample(sq, args.resample)
            if not args.dry_run:
                save_webp(out, dst, PORTRAIT_Q)
            done += 1
            if done % 40 == 0:
                print(f'  …{done}/{len(files)}')
        except Exception as e:
            failed.append((f, str(e)))
    print(f'完成 {done} 张（跳过 {skipped}）{"（dry-run 未写盘）" if args.dry_run else ""}')
    if failed:
        print('失败：')
        for f, why in failed[:10]:
            print('  ', f, why)

if __name__ == '__main__':
    main()
