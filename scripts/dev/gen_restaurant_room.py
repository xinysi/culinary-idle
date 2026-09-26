# -*- coding: utf-8 -*-
"""餐厅内景底图 · 出图 + 像素化（规格：`docs/ui-pixel/餐厅内景_出图提示词.md`）。

与 UI 控件那套的区别（所以单独一个脚本，不塞进 pixelize_ui.py）：
  · **满幅背景**：不裁内容外框、不留透明边、不许有 alpha（规格 §1「不透明，不要透明背景」）；
  · **色数 16~24**（规格 §1），不是 UI 件的 ≤8；
  · 尺寸固定 **1152×448**（逻辑 288×112，每块 4×4），按规格 §1 的降采样口径；
  · 提示词**直接从规格 md 的 §4 代码块里读**，不在这里抄一遍（抄一遍就会两边漂）。

画布档位：实测这个接口**接受任意尺寸**，所以直接按规格的 2.571:1 出（2304×896 = 导出 ×2），
不必像 UI 件那样在 1.5:1 里画横条再拉伸 —— 满幅背景一旦被拉伸，墙地比例就全错了。

用法：
  python scripts/dev/gen_restaurant_room.py --dry-run   # 只打印提示词与尺寸，不发请求
  python scripts/dev/gen_restaurant_room.py             # 出图（已存在则跳过）
  python scripts/dev/gen_restaurant_room.py --force     # 重出
环境变量：AIDJ_API_KEY
"""
import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SPEC_MD = ROOT / "docs" / "ui-pixel" / "餐厅内景_出图提示词.md"
WORK = ROOT / "docs" / "ui-pixel" / "restaurant"
RAW = WORK / "room-raw.png"
OUT_EXPORT = ROOT / "public" / "images" / "restaurant" / "room.png"

EXPORT = (1152, 448)          # 规格 §1
GRID = 4                      # 每个逻辑像素 4×4 → 逻辑 288×112
COLORS = 24                   # 规格：16~24 色
REQUEST = "2304x896"          # 导出 ×2（每逻辑像素 8×8 原始像素，够降采样）
RETRIES = 4

# 🔴 墙地分界必须落在这一行（规格 §2 的硬数字：地平线 y=278，占 62%）。
# 两次出图都把分界放在 45% 上下（大约 200 行）—— 模型对「房间」的先验就是分界居中偏上，
# 提示词里写死数字也压不过来（把硬数字放到最后一段试过，第二次仍是 45%）。
# 所以这里**按规格把分界搬到 278**：把出图的墙区与地板区各自竖向缩放到目标高度再拼回去。
# 内容不动、只改高度分配；地平线错位会让餐位「站到墙里」，这一条不能靠运气。
JUNCTION_ROW = 278
RAIL_ROW = 222
BASEBOARD_ROW = 258

# 复用 UI 那套已验证的安全传输（ALLOWED_HOSTS / certifi / 禁跳转 / key 只进请求头）
_spec = importlib.util.spec_from_file_location("gen", HERE / "gen_pixel_food_assets.py")
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)


# 复核发现出图**没按规格的构图**走（第一版：墙地分界在 45% 而非 62%、左端留空区摆了木桶），
# 所以把规格 §2 的**硬数字**再以「最后一段」追加一次 —— 放在最后才压得住前面的描述，
# 这是这一整套出图反复验证过的：靠后的指令权重更高。
ROOM_FIX_EN = (
    "COMPOSITION IS A HARD REQUIREMENT, to be measured on the 1152x448 canvas: the wall fills the "
    "TOP 62% and the floor the BOTTOM 38%; the wall/floor junction sits at row 278, NOT higher. "
    "Inside the wall: chair-rail at row 222, baseboard rows 258-277. The wall band from row 125 to "
    "row 222 must be COMPLETELY EMPTY plain wall - no lamp glow, no light spill, no objects, no "
    "signs, no decorations; keep the hanging lamp and all of its halo entirely above row 100. The "
    "floor from row 300 downward, plus the whole left end below the junction (x 0-300) and the "
    "middle of the floor, must stay COMPLETELY EMPTY bare floor - no props, no furniture, no "
    "barrels, no crates. Background props go ONLY in the narrow strip rows 278-320 between x 320 "
    "and x 860. Palette: wall #d8bb92 (upper part slightly darker, #b08f68), floor #a9744a "
    "receding to #7a5133 then #523522, warm light #f2c98a. Keep the whole image LIGHT and warm - "
    "not a dark orange room. The wall surface must be SMOOTH FLAT plaster with at most a very "
    "subtle fine vertical grain - NO drips, NO wet streaks, NO long vertical runs or hanging "
    "marks of any kind. The floor must show THREE distinct horizontal depth bands of decreasing "
    "brightness toward the back: the farthest band darkest, the middle band medium, the nearest "
    "band lightest. FINALLY, prop placement is strict: the 2-3 background props must sit ONLY "
    "between x 320 and x 860, near the middle of the picture, all together in one small group. "
    "The left 300 pixels and the outer 5% at both the far left and the far right must contain NO "
    "props at all - no barrels, no sacks, no crates, no plants at the edges of the frame."
)


def load_prompt():
    """从规格 md 的 §4 取英文提示词（第一个代码块），保持「规格是唯一出处」。"""
    text = SPEC_MD.read_text(encoding="utf-8")
    head = text.index("## 4. 提示词")
    block = re.search(r"```[a-zA-Z]*\n(.*?)```", text[head:], re.S)
    if not block:
        raise SystemExit("在规格 md 的 §4 里没找到提示词代码块")
    prompt = block.group(1).strip()
    if "NEGATIVE" not in prompt:
        raise SystemExit("取到的提示词里没有 NEGATIVE 段，检查一下规格 md")
    # 把负向段挪到最末（它本来在最后，追加正向的硬数字后再补一句负向）
    return prompt + "\n\n" + ROOM_FIX_EN


def find_junction(img):
    """找出图里实际画出来的墙地分界行：相邻两行平均色差最大的一行。"""
    im = img.convert("RGB")
    w, h = im.size
    px = im.load()
    step = max(1, w // 200)

    def mean(y):
        xs = range(0, w, step)
        return [sum(px[x, y][i] for x in xs) / len(xs) for i in range(3)]

    return max(range(1, h), key=lambda y: sum(abs(a - b) for a, b in zip(mean(y), mean(y - 1))))


def align_junction(img, target=JUNCTION_ROW):
    """把出图的墙区/地板区各自竖向缩放到规格指定高度，让分界正好落在导出图的 target 行。

    🔴 行号要**换算到出图自己的高度**再切：出图是 2304×896，导出是 1152×448，
       直接把「278」当成出图里的行号用，分界会跑到 31%（第一版就是这么错的）。
    只改高度分配，不裁也不擦内容。返回 (新图, 出图原本的分界行, 换算后的目标行)。
    """
    im = img.convert("RGB")
    w, h = im.size
    src_j = find_junction(im)
    if src_j < 8 or src_j > h - 8:
        raise SystemExit("找不到合理的墙地分界（第 %d 行），检查出图" % src_j)
    scaled_target = max(8, min(h - 8, round(target * h / EXPORT[1])))
    wall = im.crop((0, 0, w, src_j)).resize((w, scaled_target), Image.LANCZOS)
    floor = im.crop((0, src_j, w, h)).resize((w, h - scaled_target), Image.LANCZOS)
    out = Image.new("RGB", (w, h))
    out.paste(wall, (0, 0))
    out.paste(floor, (0, scaled_target))
    return out, src_j, scaled_target


def pixelize_room(img):
    """满幅背景：对齐分界 → BOX 到逻辑尺寸 → 量化 → NEAREST ×4；并强制不透明。"""
    lw, lh = EXPORT[0] // GRID, EXPORT[1] // GRID
    if abs(img.width / img.height - EXPORT[0] / EXPORT[1]) > 0.01:
        raise SystemExit("出图比例 %dx%d 与导出 %dx%d 差太多，会被拉变形"
                         % (img.width, img.height, *EXPORT))
    aligned, src_j, scaled_target = align_junction(img)
    src = aligned.convert("RGBA")

    # ① 降到逻辑尺寸（BOX = 按逻辑像素取平均）
    small = src.resize((lw, lh), Image.BOX)

    # ② 量化到 16~24 色（满幅背景没有透明处，直接量化）
    pal = small.convert("RGB").quantize(colors=COLORS, method=Image.MAXCOVERAGE).convert("RGB")

    # ③ 最近邻整数放大回导出尺寸；满幅背景，alpha 一律不透明
    out = pal.resize(EXPORT, Image.NEAREST).convert("RGBA")
    out.putalpha(Image.new("L", EXPORT, 255))
    used = len({p[:3] for p in out.getdata()})
    return out, used, src_j, scaled_target


def audit(img):
    """按规格 §5 的验收清单逐条量（能自动量的都量出来，剩下的留给人眼）。"""
    px = img.convert("RGB").load()
    w, h = img.size
    rows, notes, problems = [], [], []

    # 1 墙地分界（地平线）应在高度 62% 左右：找相邻两行平均色差最大的一行
    def row_mean(y):
        return [sum(px[x, y][i] for x in range(0, w, 4)) / len(range(0, w, 4)) for i in range(3)]
    diffs = [(y, sum(abs(a - b) for a, b in zip(row_mean(y), row_mean(y - 1))))
             for y in range(1, h)]
    horizon = max(diffs, key=lambda t: t[1])[0]
    pct = horizon / h * 100
    notes.append("墙地分界 y=%d（%.0f%%，目标 62%%）" % (horizon, pct))
    if not 55 <= pct <= 69:
        problems.append("地平线在 %.0f%%，规格要 62%% 左右 —— 餐位会站到墙里" % pct)
    rows.append(horizon)

    # 2/3/4 「留空」判据：**找物件，不是找纹理**。
    #   旧版的「局部异色密度」把木纹、地板缝、灯光斜照全算成杂物（实测 0.28~0.55 全无区分度）。
    #   规格真正在意的是「有没有桌子/道具」——所以这里按**颜色偏离该区中位色**来找块，
    #   再要求它连成片（≥6 块）才算一个物件；木纹与柔光是近似色/渐变，不会被算进来。
    def clutter(y0, y1, x0, x1, tol=45, min_cluster=6):
        blocks = {}
        for by in range(y0, y1 - GRID, GRID):
            for bx in range(x0, x1 - GRID, GRID):
                vals = [px[x, y] for y in range(by, by + GRID) for x in range(bx, bx + GRID)]
                blocks[(bx, by)] = [sum(v[i] for v in vals) / len(vals) for i in range(3)]
        if not blocks:
            return 0.0, 0
        med = sorted(tuple(v) for v in blocks.values())
        med = med[len(med) // 2]
        far = {k for k, v in blocks.items() if sum(abs(a - b) for a, b in zip(v, med)) > tol}
        # 连通成片的才算物件
        seen, groups = set(), 0
        for cell in far:
            if cell in seen:
                continue
            stack, size = [cell], 0
            seen.add(cell)
            while stack:
                cx, cy = stack.pop()
                size += 1
                for dx, dy in ((GRID, 0), (-GRID, 0), (0, GRID), (0, -GRID)):
                    nb = (cx + dx, cy + dy)
                    if nb in far and nb not in seen:
                        seen.add(nb)
                        stack.append(nb)
            if size >= min_cluster:
                groups += 1
        return len(far) / len(blocks), groups

    wall_busy, wall_groups = clutter(125, 222, 60, w - 60)
    notes.append("墙中段（菜单板/装潢/挂钟区）：异色块 %.2f，成片物件 %d 个"
                 % (wall_busy, wall_groups))
    if wall_groups:
        problems.append("墙中段有 %d 个成片物件 —— 放不下一排菜单板+装潢图标" % wall_groups)

    mid_busy, mid_groups = clutter(horizon + 30, h - 10, int(w * 0.30), int(w * 0.78))
    left_busy, left_groups = clutter(horizon + 20, h - 10, 0, 300)
    notes.append("下半部中间：异色块 %.2f，物件 %d 个 ｜ 左端：异色块 %.2f，物件 %d 个"
                 % (mid_busy, mid_groups, left_busy, left_groups))
    if mid_groups:
        problems.append("下半部中间有 %d 个成片物件 —— 会与餐桌打架" % mid_groups)
    if left_groups:
        problems.append("左端下半部有 %d 个成片物件 —— 吧台与厨师没地方放" % left_groups)

    # 6 色数与硬边（每个 4×4 块必须纯色 = 真是最近邻放大）
    colors = len({px[x, y] for y in range(h) for x in range(w)})
    broken = 0
    for by in range(0, h, GRID):
        for bx in range(0, w, GRID):
            if len({px[bx + dx, by + dy] for dx in range(GRID) for dy in range(GRID)}) > 1:
                broken += 1
    notes.append("用色 %d（规格 16~24）" % colors)
    if not 12 <= colors <= 24:
        problems.append("用色 %d 不在 16~24 区间" % colors)
    if broken:
        problems.append("%d 个 4×4 块不是纯色（不是最近邻放大）" % broken)

    # 7 地板三排明度递减
    def luma(y):
        return sum(0.2126 * px[x, y][0] + 0.7152 * px[x, y][1] + 0.0722 * px[x, y][2]
                   for x in range(0, w, 4)) / len(range(0, w, 4))
    floor_h = h - horizon
    bands = [luma(horizon + int(floor_h * f)) for f in (0.15, 0.5, 0.85)]
    notes.append("地板三排亮度 远%.0f → 中%.0f → 近%.0f" % tuple(bands))
    if not (bands[2] > bands[1] > bands[0] - 2):
        problems.append("地板没有「近亮远暗」的三排分层")
    return notes, problems


def main():
    ap = argparse.ArgumentParser(description="餐厅内景底图（出图 + 像素化）")
    ap.add_argument("--force", action="store_true", help="已存在也重出")
    ap.add_argument("--dry-run", action="store_true", help="只打印，不发请求")
    args = ap.parse_args()

    prompt = load_prompt()
    print("规格：%s" % SPEC_MD.name)
    print("提示词 %d 字符（取自 §4 代码块）" % len(prompt))
    print("画布 %s → 导出 %dx%d（逻辑 %dx%d，%d 色）"
          % (REQUEST, *EXPORT, EXPORT[0] // GRID, EXPORT[1] // GRID, COLORS))
    print("产出：%s" % OUT_EXPORT)
    if args.dry_run:
        print("\n--- 提示词全文 ---\n%s" % prompt)
        return 0

    WORK.mkdir(parents=True, exist_ok=True)
    OUT_EXPORT.parent.mkdir(parents=True, exist_ok=True)
    if RAW.exists() and not args.force:
        print("\n原始出图已存在，跳过（--force 重出）")
    else:
        last = None
        for attempt in range(RETRIES):
            try:
                RAW.write_bytes(gen.call_api(prompt, size=REQUEST))
                print("\n出图 OK：%s（%.0fKB）" % (RAW.name, RAW.stat().st_size / 1024))
                break
            except Exception as exc:  # noqa: BLE001 —— 上游会 502/503，退避重试
                last = exc
                print("  第 %d 次失败：%s" % (attempt + 1, str(exc)[:140]))
                if attempt < RETRIES - 1:
                    import time
                    time.sleep(10 * (attempt + 1))
        else:
            raise SystemExit("出图失败：%s" % last)

    out, used, src_j, scaled_target = pixelize_room(Image.open(RAW))
    out.save(OUT_EXPORT)
    src_h = Image.open(RAW).height
    print("像素化完成：%s（%dx%d，%d 色，%.0fKB）"
          % (OUT_EXPORT, *out.size, used, OUT_EXPORT.stat().st_size / 1024))
    print("墙地分界：出图原本在第 %d/%d 行（%.0f%%）→ 按规格搬到第 %d/%d 行（%.0f%%）"
          % (src_j, src_h, src_j / src_h * 100,
             scaled_target, src_h, scaled_target / src_h * 100))

    notes, problems = audit(out)
    print("\n——— 规格 §5 验收 ———")
    for n in notes:
        print("  · %s" % n)
    if problems:
        print("\n❌ %d 条不合格：" % len(problems))
        for p in problems:
            print("  ↳ %s" % p)
    else:
        print("\n✅ 能自动量的都过了；剩下「单一光源方向」只能人眼看样张")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
