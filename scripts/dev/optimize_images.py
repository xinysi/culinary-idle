# -*- coding: utf-8 -*-
"""图片瘦身（2026-09-25：用户报「刷新后去图片多的地方会慢慢加载」）。

只处理**重、且由代码单点寻址**的四组素材，其余 3000+ 张 64×64 图标（平均 3KB）一律不动：

  组                     原格式  处理
  images/enemies         PNG     → WebP q92（**分辨率不动**：512 源图，卡片显示 140~176px）
  images/restaurant/guests PNG   → WebP q92（餐厅立绘最大显示 ~315px，512 源图保持）
  images/restaurant/patrons PNG  → WebP q92
  images/items/pt        JPG     → 最长边 1600 + WebP q82（源 3072²，棋盘里最多显示 ~600px）
  images/wk-bg.jpg       JPG     → 宽 1280 + WebP q82（canvas 背景，源 2848×1600）

判据（改前实测，见对话记录）：按**实际显示尺寸**比对，q90 立绘 47.6dB（普通）/39.5dB（最复杂 BOSS），
>45dB 属肉眼无差；必须先把立绘**合成到游戏底色**再比 —— 直接比 RGBA 会因为「透明区里 PNG 存的是任意
RGB、编码器会归零」而得出「无损只有 10.9dB」的假结论。

用法：
  python scripts/dev/optimize_images.py            # 试跑，只报告体积变化，不写任何文件
  python scripts/dev/optimize_images.py --apply    # 真转：写 .webp，原图**移到** --store 目录（默认仓外备份区）
⚠️ 原图不删只移：`--store` 默认 `D:\\plays\\lmew_beifen\\images-src-<日期>`，想回退直接搬回来。
"""
import argparse
import glob
import os
import shutil
import sys

from PIL import Image

from image_quality import BG_MAX, BG_Q, PHOTO_MAX, PHOTO_Q, PORTRAIT_Q, save_webp

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # 仓库根

# (相对目录, 匹配, 质量, 最长边上限 or None)——档位取自 image_quality（唯一出口）
GROUPS = [
    ('public/images/enemies', '*.png', PORTRAIT_Q, None),
    ('public/images/restaurant/guests', '*.png', PORTRAIT_Q, None),
    ('public/images/items/pt', '*.jpg', PHOTO_Q, PHOTO_MAX),
]
# ⚠️ 有意不处理 `public/images/restaurant/patrons/`（616KB / 20 张）：**全仓库无人引用**
#    （`restaurantFaces.js` 只读 `guests/`，那是 key_patrons.py 抠洋红底后的成品；patrons/ 里的文件名
#    是 `01-elderly-man.png` 这种旧命名，属中间产物）。它是仓库卫生问题，不是加载问题，留着等用户拍板。
# (源文件, 输出文件, 质量, 宽上限)
SPECIAL = [
    ('public/images/wk-bg.jpg', 'public/images/wk-bg.webp', BG_Q, BG_MAX),
]
# ⛔ **四张壁纸（bg-start / bg-start-night / bg-sidebar / bg-sidebar-night）有意不转**（2026-09-26 实测后放弃）：
#    它们是 cover 铺满用的、**不能缩尺寸**；而只换编码的收益极差 —— 按实际显示尺寸量：
#      bg-start：q82 414KB（省 32%，PSNR 36.9dB）· q88 550KB（省 9%）· **q92 680KB（比原 JPG 还大 12%）**
#      bg-sidebar：q82 453KB（省 28%）· q88 590KB（省 7%）· q92 730KB（大 15%）
#    ⇒ 这批 JPEG 本来就压得很紧，而同分辨率下 WebP 对照片只省 28% 左右（同 `items/pt` 那条结论）；
#      再叠加「大片平滑天空/墙面渐变最容易被有损编码搞出色带」的风险，性价比为负。想真省只能上 AVIF
#      （同质量约再省一半，但要额外编码器、且 Pillow 10 不支持），属另一件事。



def convert(src, dst, quality, max_side):
    return save_webp(Image.open(src), dst, quality, max_side)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='真正写文件（默认只试跑）')
    ap.add_argument('--store', default=r'D:\plays\lmew_beifen\images-src-20260925',
                    help='原图移到这里（不删除）')
    args = ap.parse_args()

    jobs = []  # (src, dst, quality, max_side)
    for rel, pat, q, mx in GROUPS:
        d = os.path.join(ROOT, rel)
        for f in sorted(glob.glob(os.path.join(d, pat))):
            jobs.append((f, os.path.splitext(f)[0] + '.webp', q, mx))
    for s, o, q, mx in SPECIAL:
        jobs.append((os.path.join(ROOT, s), os.path.join(ROOT, o), q, mx))

    before = after = 0
    by_group = {}
    skipped = 0
    for src, dst, q, mx in jobs:
        if not os.path.exists(src):
            # 幂等：源已转并移走、目标是这次要产出的文件 ⇒ 跳过（脚本中途失败后可直接重跑）
            if os.path.exists(dst):
                skipped += 1
                continue
            print('!! 缺源文件且没有对应产物', src)
            sys.exit(1)
        src_size = os.path.getsize(src)  # ⚠️ 必须在 move 之前取（第一版在 move 之后取，必崩）
        before += src_size
        g = os.path.relpath(os.path.dirname(src), ROOT)
        by_group.setdefault(g, [0, 0, 0])
        by_group[g][0] += 1
        by_group[g][1] += src_size
        if args.apply:
            dim = convert(src, dst, q, mx)
            size = os.path.getsize(dst)
            after += size
            by_group[g][2] += size
            # 原图移出仓库（不是删除）
            rel = os.path.relpath(src, ROOT)
            keep = os.path.join(args.store, rel)
            os.makedirs(os.path.dirname(keep), exist_ok=True)
            shutil.move(src, keep)
        else:
            # 试跑：编码到内存量体积
            import io
            buf = io.BytesIO()
            im = Image.open(src)
            keep_alpha = im.mode in ('RGBA', 'LA', 'P') or 'transparency' in im.info
            im = im.convert('RGBA' if keep_alpha else 'RGB')
            if mx and max(im.size) > mx:
                sc = mx / max(im.size)
                im = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
            im.save(buf, 'WEBP', quality=q, method=6)
            after += len(buf.getvalue())
            by_group[g][2] += len(buf.getvalue())

    print(('【已应用】' if args.apply else '【试跑】') + f' 共 {len(jobs) - skipped} 个文件' + (f'（另有 {skipped} 个是上次已转好、跳过）' if skipped else ''))
    for g, (n, b, a) in sorted(by_group.items()):
        print(f'  {g:<34} {n:>4} 个 · {b/1048576:>7.2f} MB → {a/1048576:>6.2f} MB  （省 {(1-a/b)*100:>4.1f}%）')
    if before:
        print(f'  合计 {"":<30} {len(jobs) - skipped:>4} 个 · {before/1048576:>7.2f} MB → {after/1048576:>6.2f} MB  （省 {(1-after/before)*100:>4.1f}%）')
    # 现状盘点（源已被移走时上面是空的）——重跑这个脚本也当「看一眼现在什么状态」用
    print('  ── 现存 WebP 盘点 ──')
    tot_n = tot_s = 0
    for rel, pat, q, mx in GROUPS:
        out_pat = os.path.join(ROOT, rel, '*.webp')
        fs = sorted(glob.glob(out_pat))
        s = sum(os.path.getsize(f) for f in fs)
        tot_n += len(fs); tot_s += s
        print(f'  {rel:<38} {len(fs):>4} 个 · {s/1048576:>6.2f} MB')
    wf = os.path.join(ROOT, 'public/images/wk-bg.webp')
    if os.path.exists(wf):
        print(f'  public/images/wk-bg.webp{"":<25}    1 个 · {os.path.getsize(wf)/1048576:>6.2f} MB')
        tot_n += 1; tot_s += os.path.getsize(wf)
    print(f'  {"合计":<38} {tot_n:>4} 个 · {tot_s/1048576:>6.2f} MB')
    if args.apply:
        print('  原图已移至：' + args.store)


if __name__ == '__main__':
    main()
