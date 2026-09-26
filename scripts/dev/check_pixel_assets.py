# -*- coding: utf-8 -*-
"""像素美食 UI · 第 4 步：验收清单（规范 §11.2 里**能自动查的那几条**）。

为什么要自动查：这一批已经翻过车，而且是「静态看着对、上机才露馅」的那种：
  · 深色套出图模型画成了**浅色+深色对照图**，降采样后上半张被拉伸进控件 → 整个深色套废掉；
  · 主按钮中心被画了一枚**煎蛋**，`fill` 把它拉成一坨黄摊在控件正中（违反 §2 规则 4）；
  · FRAME_TAB_ON_dark 还把「透明棋盘格」当背景**画成了像素** → 背景不再透明。
上面三条都能在**像素层面**判死，不靠肉眼。所以每次出图 / pixelize 之后跑一遍。

查什么（逐条对应 §11.2）：
  1. 导出尺寸 == 规范 JSON 的 `export`，且宽高都是 4 的倍数
  2. 每个 4×4 块是纯色 ⇒ 确实是最近邻整数放大出来的（没被插值糊过）
  3. 整幅 ≤ 8 色
  4. 四角全透明（挡「白底 / 棋盘格底」）
  5. 九宫格件的**中心区**没有「成块的装饰」（挡「中心煎蛋」，判据见 `centre_defects`）
  6. 深色套整体偏暗（挡「深色套其实是浅色」）

另外**只报不改**地打印每条边的实际厚度，方便和 §2 规则 3 的档位（16/8/4 导出像素）对一下。

用法：python scripts/dev/check_pixel_assets.py            # 报告
      python scripts/dev/check_pixel_assets.py --strict   # 有不合格即 exit 1
"""
import json
import sys
from collections import Counter
from pathlib import Path

from PIL import Image

GRID = 4
# 🔴 与 `pixelize_ui.py` 的 `GRID_OVERRIDE` 是同一组：技能 38 + 分组头 8 按 GRID=2 出图，
#    这里查「最近邻整数放大」就得按 2×2 块查 —— 否则 4×4 块必然跨两个逻辑像素、全批假违规。
GRID_OVERRIDE = {"ICON_SKILL": 2, "ICON_GROUP": 2}
# 改用 CSS 效果、不出位图的件（与 `pixelize_ui.py` 同一组）：它们不在 out/ 里，跳过不判
CSS_BACKGROUND_IDS = {"BG_TILE", "TEX_BAR_FILL"}
SPEC_PATH = Path(r"D:\plays\lmew\docs\ui-pixel\像素美食UI_出图提示词_v1.json")
ICON_MANIFEST = Path(r"D:\plays\lmew\docs\ui-pixel\icons.json")
OUT_DIR = Path(r"D:\plays\lmew\docs\ui-pixel\out")

CORNER = 3                 # 四角取 3×3 判透明
MAX_COLORS = 8
BASE_SHARE_MIN = 0.85      # 面芯底色占比下限（实测「中心有煎蛋」时只有 0.135）
BLOB_MIN = 48              # 只用于「最大残差块」的信息输出
BLOB_SHARE = 0.003
BAND_COVER = 0.80          # 一行/列里这么大比例是异色 ⇒ 贯通线/明暗带，不算残差
DARK_MAX_LUMA = 110        # 深色套不透明像素的平均亮度上限
EDGE_MIN = 0.25            # 四边最外 slice 厚那条的不透明占比下限（拉伸后边框还看得见）
ACCENT_IDS = ("FRAME_BTN_PRIMARY", "FRAME_TAB_ON")   # §11.4 的强调色件：深浅都必须是番茄红
ACCENT_RG = 50             # 判「红」的通道差：R 要比 G/B 各大这么多


def luma(rgb):
    r, g, b = rgb
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def load_targets():
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    targets = {
        s["id"]: {"export": tuple(s["export"]), "slice": s.get("slice") or 0,
                  "pull": bool(s.get("pull")), "dark": bool(s.get("dark_variant"))}
        for s in spec["slots"]
    }
    # 图标不在 slots[] 里（尺寸在 icons.json）；都是固定尺寸件，且都要求 1:1
    if ICON_MANIFEST.exists():
        for entry in json.loads(ICON_MANIFEST.read_text(encoding="utf-8")):
            targets[entry["id"]] = {"export": tuple(entry["export"]), "slice": 0,
                                    "pull": False, "dark": False, "icon": True}
    return targets


def blobs(grid, gw, gh, min_area):
    """8 邻域连通域面积 ≥ min_area 的块数（保留给需要「成块装饰」判定的场合）。"""
    seen = bytearray(gw * gh)
    found = 0
    for sy in range(gh):
        for sx in range(gw):
            i = sy * gw + sx
            if not grid[i] or seen[i]:
                continue
            stack = [i]
            seen[i] = 1
            area = 0
            while stack:
                cur = stack.pop()
                area += 1
                cx, cy = cur % gw, cur // gw
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < gw and 0 <= ny < gh:
                            j = ny * gw + nx
                            if grid[j] and not seen[j]:
                                seen[j] = 1
                                stack.append(j)
            if area >= min_area:
                found += 1
    return found


def face_colour(px, w, h):
    """面芯色 = 正中 25% 区域的众数（九宫格件的「中心区底色」就是它）。"""
    win = [(x, y)
           for y in range(int(h * 0.375), int(h * 0.625))
           for x in range(int(w * 0.375), int(w * 0.625))]
    got = Counter(px[x, y][:3] for x, y in win if px[x, y][3] > 0)
    return got.most_common(1)[0][0] if got else None


def border_thickness(px, w, h, face):
    """四边中线上「从画布边走到面芯色」的距离 —— 即实际画出来的边料厚度。

    🔴 必须**量出来**而不是直接拿 slice 当中心区边界：出图模型画的边料普遍比 §2 规则 3
    的档位厚（实测 16 导出像素 vs 档位 8），厚出来的那截正好落在 slice 内圈、是要被拉伸
    的部分。若按 slice 取中心区，量到的全是边料的内侧渐变，每张都会假违规。
    """
    def depth(seq):
        for i, (x, y) in enumerate(seq):
            r, g, b, a = px[x, y]
            if a > 0 and (r, g, b) == face:
                return i
        return len(seq)

    return (depth([(w // 2, y) for y in range(h)]),
            depth([(w // 2, h - 1 - y) for y in range(h)]),
            depth([(x, h // 2) for x in range(w)]),
            depth([(w - 1 - x, h // 2) for x in range(w)]))


def centre_defects(px, w, h, inset, face):
    """面芯（会被九宫格铺满控件的那一片）问题清单。inset = 实测四边边料厚度。

    🔴 为什么不数色数、也不按连通块判「装饰」：出图模型给的「平面」带**极淡明暗**，
    量化到 8 色后会分成 2~3 条色带 —— 那是明暗不是装饰，按色数或小块都会假违规。
    真正稳的判据是**底色占比**：实测「主按钮正中一枚煎蛋」时占比掉到 0.135，
    而正常面芯都在 0.90 以上。所以这里用「异色残差占比」当硬判据，
    再把最大残差块当**信息**打出来（方便看它是不是一枚煎蛋）。

    异色残差里先排除**整行/整列贯通**的（≥80%）—— 规范 §2 规则 4 明确允许
    中心区有一条沿拉伸方向贯通的线，那类像素不该算进残差。
    """
    problems, notes = [], []
    top, bottom, left, right = inset
    x0, y0, x1, y1 = left, top, w - right, h - bottom
    cw, ch = x1 - x0, y1 - y0
    if cw < 4 or ch < 4:
        return ["实测边料把画布吃完了（面芯只剩 %dx%d）" % (cw, ch)], notes
    inner = [(x, y) for y in range(y0, y1) for x in range(x0, x1)]
    counts = Counter(px[x, y][:3] for x, y in inner if px[x, y][3] > 0)
    if not counts:
        return ["面芯全是透明的（九宫格拉伸后控件正中会漏底）"], notes
    base = counts.most_common(1)[0][0]
    clear = sum(1 for x, y in inner if px[x, y][3] == 0)

    grid = bytearray(cw * ch)
    for y in range(ch):
        for x in range(cw):
            r, g, b, a = px[x0 + x, y0 + y]
            if a == 0 or (r, g, b) != base:
                grid[y * cw + x] = 1
    for y in range(ch):
        if sum(grid[y * cw + x] for x in range(cw)) >= cw * BAND_COVER:
            for x in range(cw):
                grid[y * cw + x] = 0
    for x in range(cw):
        if sum(grid[y * cw + x] for y in range(ch)) >= ch * BAND_COVER:
            for y in range(ch):
                grid[y * cw + x] = 0
    residual = sum(grid)
    share = 1.0 - residual / len(inner)
    notes.append("面芯 %dx%d 底色占比 %.3f" % (cw, ch, share))
    if share < BASE_SHARE_MIN:
        problems.append("面芯被画满：底色占比 %.3f < %.2f（八成是中心有装饰）"
                        % (share, BASE_SHARE_MIN))
    # 面芯透明：**只报不改**。立绘相框这类件中心本来就该透（立绘要透出来），
    # 九宫格 fill 会把中心那片铺满，中心全透明才是缺陷 —— 所以只在「几乎全透明」时判失败。
    if clear > len(inner) * 0.5:
        problems.append("面芯 %.0f%% 是透明的（控件正中会漏底）" % (100.0 * clear / len(inner)))
    elif clear:
        notes.append("面芯透明 %.1f%%" % (100.0 * clear / len(inner)))

    biggest = largest_blob(grid, cw, ch)
    if biggest >= max(BLOB_MIN, int(cw * ch * BLOB_SHARE)):
        notes.append("最大残差块 %d 像素" % biggest)
    return problems, notes


def largest_blob(grid, gw, gh):
    """最大连通域面积。"""
    seen = bytearray(gw * gh)
    best = 0
    for sy in range(gh):
        for sx in range(gw):
            i = sy * gw + sx
            if not grid[i] or seen[i]:
                continue
            stack = [i]
            seen[i] = 1
            area = 0
            while stack:
                cur = stack.pop()
                area += 1
                cx, cy = cur % gw, cur // gw
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < gw and 0 <= ny < gh:
                            j = ny * gw + nx
                            if grid[j] and not seen[j]:
                                seen[j] = 1
                                stack.append(j)
            best = max(best, area)
    return best


def reaches_edges(px, w, h, band):
    """四条边最外 band(=slice) 像素的不透明占比 —— 那一条正是被九宫格拉伸的部分。

    🔴 不能只看最外 1~2 行：规范 §4 要的就是**不规则轮廓**（四边长度不等、上下边不平行），
    小件的顶部最外几行本来就只有两端角上有墨（实测 FRAME_TAB 最外 4 行仅 8/200）。
    按最外 2 行判会把这个设计特征判成缺陷；按 slice 厚的一条判才对得上「拉伸后看不看得见边框」。
    """
    frac = {}
    for name, seq in (
        ("上", [(x, y) for y in range(band) for x in range(w)]),
        ("下", [(x, y) for y in range(h - band, h) for x in range(w)]),
        ("左", [(x, y) for y in range(h) for x in range(band)]),
        ("右", [(x, y) for y in range(h) for x in range(w - band, w)]),
    ):
        frac[name] = sum(1 for x, y in seq if px[x, y][3] > 0) / len(seq)
    return frac


def check(path, target):
    problems, notes = [], []
    stem = path.stem.replace("@2x", "")
    slot_id = stem[:-5] if stem.endswith("_dark") else stem
    dark = stem.endswith("_dark")
    im = Image.open(path).convert("RGBA")
    w, h = im.size

    if (w, h) != target["export"]:
        problems.append("尺寸 %dx%d ≠ 规范 %dx%d" % (w, h, *target["export"]))
    if w % GRID or h % GRID:
        problems.append("宽高不是 %d 的倍数" % GRID)

    px = im.load()
    opaque = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] > 0]
    if not opaque:
        return ["整张图都是透明的"], notes
    colors = Counter(px[x, y][:3] for x, y in opaque)
    if len(colors) > MAX_COLORS:
        problems.append("用色 %d > %d" % (len(colors), MAX_COLORS))
    notes.append("%d 色" % len(colors))

    # 网格完整性：每个逻辑像素块必须是同一色（最近邻放大的必要条件）
    grid = GRID
    for prefix, g in GRID_OVERRIDE.items():
        if slot_id.startswith(prefix):
            grid = g
    if w % grid == 0 and h % grid == 0:
        broken = 0
        for by in range(0, h, grid):
            for bx in range(0, w, grid):
                if len({px[bx + dx, by + dy] for dx in range(grid) for dy in range(grid)}) > 1:
                    broken += 1
        if broken:
            problems.append("%d 个 %d×%d 块不是纯色（不是最近邻整数放大）" % (broken, grid, grid))

    # 四角透明：**只对九宫格件查**。
    # 判据的本意是「形状外是不是还糊着一层不透明矩形底」（真踩过：出图把透明棋盘格画成了像素）。
    # 但纹理件（1×12 的线、4×4 的汤汁）与印面件（§5 的 SEAL_* 本就是「方形戳印、四角切阶」）
    # 本来就该填满画布，对它们查四角只会全批假违规 ⇒ 只报信息。
    corners = [(0, 0), (w - CORNER, 0), (0, h - CORNER), (w - CORNER, h - CORNER)]
    solid = sum(1 for cx, cy in corners
                if max(px[cx + dx, cy + dy][3] for dx in range(CORNER) for dy in range(CORNER)) > 0)
    # 🔴 只有当边料**厚到能切出角**（≥2 逻辑像素）时才要求四角透明：
    # FRAME_FOCUS(12×8, slice 4) 与 SCROLL_THUMB(4×16, slice 4) 的边料就是 1 个逻辑像素，
    # 也就是整个形状本身 —— 它们的画布角上必然是墨，要求「角透明」在几何上不可能成立。
    is_frame = target["pull"] and target["slice"] >= 2 * GRID
    if is_frame:
        if solid:
            problems.append("%d/4 个角不透明（九宫格件应是透明背景 + 不规则剪影）" % solid)
    elif slot_id.startswith("ICON_"):
        # 🔴 图标一定是**抠底的剪影**，四角不允许全不透明 —— 2026-09-23 验收提的守卫：
        #    ICON_GROUP_01 当时是**白底没抠掉**（0% 透明像素、主色 #FAFAFA 占 89%），
        #    深色面板上就是一块白方片，而「四角只提示不判」让它全绿放过。
        #    实测只命中 ICON_GROUP_01（其余 159 个 ICON 都至少有一个透明角），不误伤。
        #    ⚠️ 别把这条加给 SEAL_*（食印是实心戳章）与 TEX_*/LINE_*（纹理与线条）。
        if solid == 4:
            problems.append("图标四角全不透明 —— 白底/浅底没抠掉（图标必须是透明底剪影）")
        else:
            notes.append("四角 %d/4 不透明（图标，≥1 个透明角即可）" % solid)
    elif solid:
        notes.append("四角 %d/4 不透明（边料仅 %d 逻辑像素 / 非九宫格件，不判）"
                     % (solid, target["slice"] / GRID if target["slice"] else 0))

    # 九宫格件：实测边料厚度 → 面芯检查；并确认边料真的画到了画布边缘
    s = target["slice"]
    if target["pull"] and s:
        edges = reaches_edges(px, w, h, s)
        notes.append("贴边 " + "/".join("%s%.2f" % (k, v) for k, v in edges.items()))
        weak = [k for k, v in edges.items() if v < EDGE_MIN]
        if weak:
            problems.append("边料没画到画布边缘：%s（九宫格会切到透明）" % "、".join(weak))
        face = face_colour(px, w, h)
        if face is None:
            problems.append("整张图都是透明的")
        else:
            inset = border_thickness(px, w, h, face)
            notes.append("边厚 上%d/下%d/左%d/右%d（档位目标 %d）" % (*inset, s))
            if max(inset) > s * 1.5:
                notes.append("⚠️ 边料比档位厚，超出 slice 的那截会被拉伸")
            p, n = centre_defects(px, w, h, inset, face)
            problems += p
            notes += n

    # 平铺件：**必须按平铺后的样子判**（只看单张图永远发现不了这个缺陷）。
    # 规范要 BG_TILE 只带颗粒（「页面底色 + 每 64px 只有 4~6 个 1 像素点」，颜色仍由 15 套皮肤
    # 的 CSS 变量给），可是出图会照着提示词里的「轮廓不规则」给它画一圈焦边 ——
    # 单看挺好看，平铺出来就是一片边框格子的「吐司阵」，底色全废。
    # 判据：最外 1 像素那一圈必须以**面芯底色**为主，否则平铺必有网格缝。
    if slot_id == "BG_TILE":
        face = face_colour(px, w, h)
        if face is not None:
            ring = ([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)]
                    + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
            same = sum(1 for x, y in ring if px[x, y][:3] == face)
            frac = same / len(ring)
            notes.append("外圈为底色 %.2f" % frac)
            if frac < 0.8:
                problems.append("外圈不是底色（%.2f）⇒ 平铺会出现网格缝，底色件不该有边框" % frac)

    # 强调色件：深浅两套的表色都必须是番茄红（§3.2 语义色原样保留）
    if slot_id in ACCENT_IDS:
        face = face_colour(px, w, h)
        if face is None:
            problems.append("整张图都是透明的")
        else:
            r, g, b = face
            notes.append("表色 #%02X%02X%02X" % (r, g, b))
            if not (r > g + ACCENT_RG and r > b + ACCENT_RG):
                problems.append("强调色件不是番茄红（表色 #%02X%02X%02X）⇒ 深色下认不出来" % (r, g, b))

    # 深色套要真的暗
    if dark:
        mean_luma = sum(luma(px[x, y][:3]) for x, y in opaque) / len(opaque)
        notes.append("平均亮度 %.0f" % mean_luma)
        if mean_luma > DARK_MAX_LUMA:
            problems.append("深色套偏亮：平均亮度 %.0f > %d" % (mean_luma, DARK_MAX_LUMA))
    return problems, notes


def main():
    strict = "--strict" in sys.argv
    targets = load_targets()
    files = sorted(OUT_DIR.glob("*@2x.png"))
    if not files:
        print("out/ 里还没有 @2x.png，先跑 pixelize_ui.py")
        return 0
    bad = 0
    for path in files:
        stem = path.stem.replace("@2x", "")
        slot_id = stem[:-5] if stem.endswith("_dark") else stem
        if slot_id not in targets:
            print("？ %-30s 文件名对不上任何 ID，跳过" % path.name)
            continue
        if slot_id in CSS_BACKGROUND_IDS:
            continue
        problems, notes = check(path, targets[slot_id])
        print("%s %-30s %s" % ("✅" if not problems else "❌", path.name, " · ".join(notes)))
        for p in problems:
            print("     ↳ %s" % p)
        bad += bool(problems)
    print("\n受检 %d 张，不合格 %d 张" % (len(files), bad))
    return 1 if (bad and strict) else 0


if __name__ == "__main__":
    sys.exit(main())
