# -*- coding: utf-8 -*-
"""种子专属图标 · 出图 + 归一化交付（规格：`docs/种子专属图片提示词.md`）。

规格要点（§0/§1/§2）：
  · 落盘 `public/images/items/seed/{种子中文名}.png`，**64×64 透明底**；
  · 风格锚点 = 现有物品图（food/苹果.png 那套）：**厚描边卡通 + 高光**，不是严格像素风；
  · 管线已接好（itemImage.js 优先读专属图、缺失回落 _seed.png）—— **配一张生效一张**。

后处理配方（照锚点量出来的，不是猜的）：
  · 锚点 64×64、**alpha 二值**（只有 0/255）、约 30 色、内容占画布 66~69%；
  · 所以：裁内容外框 → 两级 LANCZOS 降采样 → 量化 32 色 → alpha 二值化(≥128)
    → 内容最长边归一到 44px（68%）→ 居中贴上 64×64 透明画布。
  · 不做 NEAREST 整数放大：锚点本身就不是严格 2×2 网格（24% 的块不纯），它的小颗粒感
    来自「低分辨率 + 少色 + 硬 alpha」，不是来自逻辑网格。

提示词**直接从规格 md 解析**（§3 的 `- **X.png**` + 反引号行），199 条不手抄、不改写
—— 规格是唯一出处。出图 1024×1024 透明底，服务实测支持（gpt-image-2）。

用法：
  python scripts/dev/gen_seed_icons.py --dry-run          # 只解析并列计划
  python scripts/dev/gen_seed_icons.py --limit 3          # 先出 3 张试观感
  python scripts/dev/gen_seed_icons.py                    # 全量（已存在的跳过，可反复跑填坑）
  python scripts/dev/gen_seed_icons.py --names 小麦种子,薄荷种子 --force
环境变量：AIDJ_API_KEY
"""
import argparse
import importlib.util
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SPEC_MD = ROOT / "docs" / "种子专属图片提示词.md"
RAW_DIR = ROOT / "docs" / "items-seed-raw"
OUT_DIR = ROOT / "public" / "images" / "items" / "seed"

EXPORT = 64
FILL = 44                    # 内容最长边目标（锚点 42~44px = 66~69%）
COLORS = 32                  # 锚点实测 ~30 色
RENDER = "1024x1024"
WORKERS = 4
RETRIES = 4

_spec = importlib.util.spec_from_file_location("gen", HERE / "gen_pixel_food_assets.py")
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)


def parse_spec():
    """从规格 md 解析 (文件名, 提示词) 列表。格式：`- **X.png**（…）` 下一行反引号提示词。"""
    text = SPEC_MD.read_text(encoding="utf-8")
    pairs = re.findall(r"\*\*(.+?\.png)\*\*[^\n]*\n\s*`([^`]+)`", text)
    if not pairs:
        raise SystemExit("规格 md 里一条都没解析到，检查 §3 的格式")
    names = [n for n, _ in pairs]
    dup = {n for n in names if names.count(n) > 1}
    if dup:
        raise SystemExit("规格里有重复文件名：%s" % "、".join(sorted(dup)[:6]))
    return pairs


def process(raw_path):
    """1024 原图 → 64×64 交付图（裁内容 → 两级降采样 → 量化 → 硬 alpha → 归一居中）。"""
    im = Image.open(raw_path).convert("RGBA")
    alpha = im.getchannel("A").point(lambda v: 255 if v > 8 else 0)
    box = alpha.getbbox()
    if box is None:
        raise ValueError("整张图全透明")
    im = im.crop(box)

    # 两级降采样：先到 2× 目标（保留色簇），再落到最终尺寸（模糊的杂色在量化前收拢）
    mid = max(FILL * 2, 96)
    scale = mid / max(im.size)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))),
                   Image.LANCZOS)
    # 量化（透明处不参与选色）
    a = im.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
    rgb = im.convert("RGB")
    px, mp = rgb.load(), a.load()
    counts = {}
    for y in range(rgb.height):
        for x in range(rgb.width):
            if mp[x, y]:
                counts[px[x, y]] = counts.get(px[x, y], 0) + 1
    if not counts:
        raise ValueError("内容全透明")
    base = max(counts, key=counts.get)
    for y in range(rgb.height):
        for x in range(rgb.width):
            if not mp[x, y]:
                px[x, y] = base
    rgb = rgb.quantize(colors=max(COLORS, 48), method=Image.MAXCOVERAGE).convert("RGB")

    scale = FILL / max(im.size)
    small = rgb.resize((max(1, round(rgb.width * scale)), max(1, round(rgb.height * scale))),
                       Image.LANCZOS)
    a = a.resize(small.size, Image.LANCZOS).point(lambda v: 255 if v >= 128 else 0)
    rgb = small.quantize(colors=COLORS, method=Image.MAXCOVERAGE).convert("RGB")

    canvas = Image.new("RGBA", (EXPORT, EXPORT), (0, 0, 0, 0))
    rgba = rgb.convert("RGBA")
    rgba.putalpha(a)
    canvas.paste(rgba, ((EXPORT - rgba.width) // 2, (EXPORT - rgba.height) // 2), rgba)
    return canvas


def audit(img):
    """能自动查的：尺寸 / 四角透明 / 内容占比 / 用色数 / alpha 二值。"""
    notes, problems = [], []
    if img.size != (EXPORT, EXPORT):
        problems.append("尺寸 %s ≠ 64×64" % (img,))
    a = img.getchannel("A")
    corners = [a.getpixel((0, 0)), a.getpixel((EXPORT - 1, 0)),
               a.getpixel((0, EXPORT - 1)), a.getpixel((EXPORT - 1, EXPORT - 1))]
    if any(corners):
        problems.append("四角不透明 %s（背景没抠干净）" % corners)
    box = a.point(lambda v: 255 if v > 0 else 0).getbbox()
    if box:
        w = box[2] - box[0]
        h = box[3] - box[1]
        fill = max(w, h) / EXPORT * 100
        notes.append("内容 %dx%d（占 %.0f%%）" % (w, h, fill))
        if not 55 <= fill <= 80:
            problems.append("内容占比 %.0f%% 偏离锚点的 66~69%% 太多" % fill)
    op = {p[:3] for p in img.getdata() if p[3] > 0}
    notes.append("%d 色" % len(op))
    if len(op) > COLORS + 8:
        problems.append("用色 %d 超出锚点量级（~30）" % len(op))
    vals = set(a.getdata())
    if not vals <= {0, 255}:
        problems.append("alpha 不是二值（%d 档）" % len(vals))
    return notes, problems


def one(name, prompt, force):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    raw = RAW_DIR / name
    if (OUT_DIR / name).exists() and not force:
        return name, "skip（已交付）"
    if not raw.exists() or force:
        last = None
        for attempt in range(RETRIES):
            try:
                raw.write_bytes(gen.call_api(prompt, size=RENDER))
                break
            except Exception as exc:  # noqa: BLE001 —— 上游会 502/503
                last = exc
                if attempt < RETRIES - 1:
                    time.sleep(9 * (attempt + 1))
        else:
            return name, "FAILED: %s" % str(last)[:110]
    try:
        out = process(raw)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        out.save(OUT_DIR / name)
        return name, "ok"
    except Exception as exc:  # noqa: BLE001
        return name, "FAILED: %s" % str(exc)[:110]


def main():
    ap = argparse.ArgumentParser(description="种子专属图标（出图 + 归一化）")
    ap.add_argument("--limit", type=int, help="只出前 N 张（试观感用）")
    ap.add_argument("--names", help="只出这几个（逗号分隔中文名，不带 .png）")
    ap.add_argument("--force", action="store_true", help="已交付的也重出")
    ap.add_argument("--dry-run", action="store_true", help="只解析并列计划")
    args = ap.parse_args()

    pairs = parse_spec()
    print("规格：%s —— 解析到 %d 条" % (SPEC_MD.name, len(pairs)))
    if args.names:
        want = {n.strip() + ".png" for n in args.names.split(",")}
        missing = want - {n for n, _ in pairs}
        if missing:
            raise SystemExit("规格里没有：%s" % "、".join(sorted(missing)))
        pairs = [p for p in pairs if p[0] in want]
    if args.limit:
        pairs = pairs[:args.limit]
    done = sum(1 for n, _ in pairs if (OUT_DIR / n).exists())
    print("计划 %d 张（其中 %d 张已交付会跳过）→ %s" % (len(pairs), done, OUT_DIR))
    if args.dry_run:
        for n, p in pairs[:5]:
            print("  %-14s %s…" % (n, p[:46]))
        print("  …")
        return 0

    results = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(one, n, p, args.force): n for n, p in pairs}
        for i, fut in enumerate(as_completed(futures), start=1):
            name, status = fut.result()
            results.append((name, status))
            print("[%3d/%d] %-16s %s" % (i, len(pairs), name, status), flush=True)

    print("\n——— 验收 ———")
    bad = 0
    for n, _ in pairs:
        f = OUT_DIR / n
        if not f.exists():
            continue
        notes, problems = audit(Image.open(f).convert("RGBA"))
        if problems:
            bad += 1
            print("❌ %-16s %s" % (n, " · ".join(notes)))
            for p in problems:
                print("     ↳ %s" % p)
    ok = sum(1 for n, _ in pairs if (OUT_DIR / n).exists())
    print("\n交付 %d/%d，不合格 %d" % (ok, len(pairs), bad))
    total = len(list(OUT_DIR.glob("*.png")))
    print("seed/ 目录现有 %d 张（规格目标 200，含 _seed）" % total)
    print("下一步：node scripts/ci/item_triple_audit.mjs")
    return 1 if (bad or ok < len(pairs)) else 0


if __name__ == "__main__":
    sys.exit(main())
