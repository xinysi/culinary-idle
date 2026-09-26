# 处理 docs/items-seed-raw/ 的 1024×1024 种子原图 → public/images/items/seed/{中文名}.png（64×64 透明底）
#   python scripts/dev/process_seed_images.py            # 全量处理
#   python scripts/dev/process_seed_images.py --dry      # 只核对文件名匹配，不写文件
# 规则：非透明像素 bbox → 补成正方形（居中）→ 内容缩放到画布 84% → 居中落到 64×64（LANCZOS）
import os
import sys
from PIL import Image

ROOT = r'D:\plays\lmew'
RAW = os.path.join(ROOT, r'docs\items-seed-raw')
OUT = os.path.join(ROOT, r'public\images\items\seed')
SIZE = 64
FILL = 0.84  # 主体占画布比例（与提示词口径一致）

dry = '--dry' in sys.argv
files = sorted(f for f in os.listdir(RAW) if f.lower().endswith('.png'))
print('原图:', len(files))

# 与种子名录核对（199 颗：185 张已配 + _seed 占位；多/少都要报）
from pathlib import Path
existing = set(os.listdir(OUT))
missing = [f for f in files if f not in existing]
print('落盘后新增:', len(missing))

if dry:
    sys.exit(0)

done, skipped = 0, []
for f in files:
    im = Image.open(os.path.join(RAW, f)).convert('RGBA')
    bbox = im.getbbox()  # 非零（含 alpha=0 但颜色非零的像素很少见，可接受）
    if not bbox:
        skipped.append(f + '(全透明)')
        continue
    crop = im.crop(bbox)
    # 补成正方形（内容居中）
    w, h = crop.size
    side = max(w, h)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(crop, ((side - w) // 2, (side - h) // 2), crop)
    # 缩放：内容（含自身留白）放到 FILL 占比
    scale = SIZE * FILL / side
    new_side = max(1, round(side * scale))
    crop2 = sq.resize((new_side, new_side), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    off = (SIZE - new_side) // 2
    canvas.paste(crop2, (off, off), crop2)
    canvas.save(os.path.join(OUT, f), 'PNG', optimize=True)
    done += 1

print(f'完成 {done} 张 → {OUT}')
if skipped:
    print('跳过:', '; '.join(skipped))
