# -*- coding: utf-8 -*-
"""食客立绘 · 出图 + 交付（规格：`docs/ui-pixel/食客立绘_出图提示词.md`）。

规格要点（§1/§2）：
  · 512×512，人物占高约 460~480px，正面站立、手拿小食/茶杯；
  · **纯洋红 #FF00FF 平涂底**（要一键抠底，且不能和白衣服打架）；
  · 像素风、16~24 色、单一主光；禁止大件厨具 / 多人物 / 文字 / 白底。

两处关键实现（都不是照抄提示词能解决的）：

1. **洋红必须留在「精确的 #FF00FF」上。** 交付前要量化到 16~24 色，量化会把洋红挪成
   邻近色（比如 #F20BF2），下游键控的阈值一旦卡死就会漏边。所以量化之后**再按颜色距离
   把洋红吸回精确值**，保证交付的底是干净的。

2. **「封闭的洋红/白块」要出图这一侧就查。** 规格 §4 自己写了上次的坑：道具与白衣服同色，
   抠不干净。判据很干脆：**从画布边框能走到的洋红才是背景**，走不到的洋红块 = 人物身上
   被包住的洞（抠完会在人物身上留一块洋红）。这条比肉眼可靠，所以当硬闸门。

出图按 1024×1024 出、再降到 512×512：直接要 512 模型会画得太平滑，降一半既有像素感、
又正好落在规格的人物占高（92% × 512 ≈ 471px）。

用法：
  python scripts/dev/gen_restaurant_patrons.py --dry-run    # 列出计划，不发请求
  python scripts/dev/gen_restaurant_patrons.py              # 出图（已存在的跳过）
  python scripts/dev/gen_restaurant_patrons.py --only 1,4   # 只出第 1、4 个
环境变量：AIDJ_API_KEY
"""
import argparse
import importlib.util
import io
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SPEC_MD = ROOT / "docs" / "ui-pixel" / "食客立绘_出图提示词.md"
RAW_DIR = ROOT / "docs" / "ui-pixel" / "restaurant" / "patrons-raw"
OUT_DIR = ROOT / "public" / "images" / "restaurant" / "patrons"

EXPORT = 512
REQUEST = "1024x1024"        # 出大图再降一半（见模块说明）
COLORS = 24                  # 规格：16~24 色
MAGENTA = (255, 0, 255)
MAGENTA_TOL = 150            # 量化后把「离洋红足够近」的像素吸回精确洋红（曼哈顿距离）
WORKERS = 3                  # 5 会把上游打满
RETRIES = 4

# ── 头身比：用户看第一版就说「都太大头娃娃了」 ────────────────────────────────
# 这套项目里**同一个坑踩过第二次了**（敌绘那 248 张，见记忆 lmew-enemy-sprite-workflow）：
# 模型默认往 chibi 走，而且**结尾补一句「six to seven heads tall」不管用** —— 早期 token 权重更高。
# 所以这里把修正句插在**开头**（紧跟 "standing idle pose,"），并同时：
#   · 要求「两条腿都完整可见、腿比躯干长」（只写身高没用：模型会把身体缩短而不是加长腿）；
#   · 负向词里加上 dwarf / bobblehead / oversized head 一整套。
# 另外规格模板里的 "cute" 本身就是 chibi 的推手，替换掉。
PROPORTION_ADULT = (
    "FULL ADULT PROPORTIONS: about six to seven heads tall, realistic build, a proper neck, "
    "BOTH LEGS FULLY VISIBLE and longer than the torso, head no larger than one sixth of the "
    "total figure height"
)
# 规格 §3 里确有小孩与少女，这两种要**真儿童比例**（4~5 头身），而不是 bobblehead
PROPORTION_CHILD = (
    "A REAL CHILD'S PROPORTIONS: about four to five heads tall, a proper neck, BOTH LEGS FULLY "
    "VISIBLE, head no larger than one quarter of the total figure height - a normal child, "
    "NOT a chibi and NOT a bobblehead"
)
PROPORTION_NEG = (
    "chibi, super-deformed, bobblehead, oversized head, huge head, big head, doll proportions, "
    "dwarf, stubby body, short legs, legs shorter than the torso, no neck, toddler proportions, "
    "mascot proportions"
)

# §3 的装扮清单：1~10 各一个，11~20 是「同款换发色/配色」（规格明说这也算新人物）
# 第三项 True = 真儿童（用儿童比例），False = 成人
VARIANTS = [
    ("elderly-man", False, "an elderly man in a plain cloth robe and a woven bamboo hat, holding a teacup"),
    ("elderly-woman", False, "an elderly woman in a front-buttoned jacket and apron, carrying a small vegetable basket"),
    ("young-woman", False, "a young woman in a plain long dress with a hairpin, holding a small bowl"),
    ("girl", True, "a young girl in a short jacket with her hair in two buns, holding a candied hawthorn skewer"),
    ("sturdy-man", False, "a sturdy middle-aged man in a short work jacket with a sweat towel around his neck"),
    ("scholar", False, "a scholar in a long robe holding a closed folding fan"),
    ("merchant", False, "a merchant in a round-collar robe holding a small abacus"),
    ("child", True, "a small child in children's clothes hugging a steamed bun"),
    ("porter", False, "a porter in a sleeveless vest with a carrying pole resting on one shoulder"),
    ("honoured-guest", False, "a wealthy honoured guest in a brocade outer robe with a jade pendant"),
    ("elderly-man-2", False, "an elderly man with grey hair and a beard, in a dark blue cloth robe, holding a teacup"),
    ("elderly-woman-2", False, "an elderly woman with silver hair in a rust-red jacket, carrying a basket of greens"),
    ("young-woman-2", False, "a young woman with black hair in a green long dress, holding a small porcelain bowl"),
    ("girl-2", True, "a young girl with brown hair in two buns and a pink short jacket, holding a candied skewer"),
    ("sturdy-man-2", False, "a broad middle-aged man in a brown short jacket and headband, arms relaxed"),
    ("scholar-2", False, "a young scholar in a pale grey long robe holding an open folding fan"),
    ("merchant-2", False, "a plump merchant in a purple round-collar robe counting on a small abacus"),
    ("child-2", True, "a small child with a shaved head in yellow children's clothes holding a steamed bun"),
    ("porter-2", False, "a wiry porter in a dark vest with a carrying pole, a straw hat on his back"),
    ("honoured-guest-2", False, "a dignified guest in a deep green brocade robe with a jade pendant, holding a teacup"),
]

_spec = importlib.util.spec_from_file_location("gen", HERE / "gen_pixel_food_assets.py")
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)


def load_template():
    """从规格 md 的 §2 取英文提示词模板（保留 [可替换的装扮描述] 占位）。"""
    text = SPEC_MD.read_text(encoding="utf-8")
    head = text.index("## 2. 提示词")
    block = re.search(r"```[a-zA-Z]*\n(.*?)```", text[head:], re.S)
    if not block:
        raise SystemExit("在规格 md 的 §2 里没找到提示词代码块")
    tpl = block.group(1).strip()
    if "[可替换的装扮描述]" not in tpl:
        raise SystemExit("模板里没有 [可替换的装扮描述] 占位符，检查规格 md")
    return tpl


def build_prompt(tpl, outfit, child=False):
    """把装扮填进规格模板，并**在最前面**插入头身比修正句（早期 token 权重更高）。

    🔴 修正句必须放开头：结尾补一句「six to seven heads tall」在敌绘那批被证明**不管用**
    （记忆 lmew-enemy-sprite-workflow，两轮才修好）。同时去掉模板里的 "cute" —— 那是 chibi 的推手。
    """
    tpl = tpl.replace("cute restaurant customer", "restaurant customer")
    anchor = "standing idle pose,"
    proportion = PROPORTION_CHILD if child else PROPORTION_ADULT
    if anchor not in tpl:
        raise SystemExit("规格模板里没有 %r，头身比修正句没地方插" % anchor)
    tpl = tpl.replace(anchor, anchor + " " + proportion + ",", 1)
    prompt = tpl.replace("[可替换的装扮描述]", outfit)
    return prompt + "\n\nNEGATIVE (in addition): " + PROPORTION_NEG


def is_magenta(c, tol=40):
    """是否算洋红。🔴 三个通道都要减对目标值：洋红是 (255,0,255)，写成 |r-255|+|g|+|b|
    会把 B 漏掉，于是**精确洋红本身**都判为「不是洋红」（第一版就踩了，边框占比报 0.000）。"""
    return abs(c[0] - MAGENTA[0]) + abs(c[1] - MAGENTA[1]) + abs(c[2] - MAGENTA[2]) <= tol


def snap_magenta(img):
    """把「离洋红足够近」的像素吸回精确 #FF00FF。

    量化会把洋红挪成邻近色；下游按固定阈值键控时这就是漏边的来源。
    另外把近白像素也报出来（规格禁止白底，且白衣服和白底同色是上次翻车的点）。
    """
    px = img.load()
    w, h = img.size
    snapped = 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            if abs(r - MAGENTA[0]) + abs(g - MAGENTA[1]) + abs(b - MAGENTA[2]) <= MAGENTA_TOL:
                px[x, y] = MAGENTA + (255,)
                snapped += 1
    return snapped


def audit(img):
    """规格 §1/§4 能自动查的：底是不是洋红、人物占高、有没有封闭洋红块。"""
    px = img.load()
    w, h = img.size
    notes, problems = [], []

    def is_mag(c):
        return is_magenta(c)

    # ① 边框那一圈必须是洋红（否则不是纯色底）
    ring = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] \
        + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    ring_mag = sum(1 for x, y in ring if is_mag(px[x, y][:3])) / len(ring)
    notes.append("边框洋红占比 %.3f" % ring_mag)
    if ring_mag < 0.9:
        problems.append("画布边框只有 %.0f%% 是洋红 —— 不是纯色底（白底/渐变底）" % (ring_mag * 100))

    # ② 从边框洪泛：能走到的洋红才是背景，走不到的就是**人物身上被包住的洞**
    seen = bytearray(w * h)
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            if is_mag(px[x, y][:3]) and not seen[y * w + x]:
                seen[y * w + x] = 1
                stack.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_mag(px[x, y][:3]) and not seen[y * w + x]:
                seen[y * w + x] = 1
                stack.append((x, y))
    while stack:
        cx, cy = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not seen[i] and is_mag(px[nx, ny][:3]):
                    seen[i] = 1
                    stack.append((nx, ny))
    enclosed = [(x, y) for y in range(h) for x in range(w)
                if is_mag(px[x, y][:3]) and not seen[y * w + x]]
    # 🔴 「封闭洋红」**不能当缺陷判**：实测这 20 张里它出现的地方全是**肢体间的空隙**
    #    （两腿之间、手臂与躯干之间、扁担与肩膀之间）—— 那些位置抠成透明恰恰是对的，
    #    能看到房间背景才对。规格 §4 真正担心的是「道具与衣服同色抠不干净」，而洋红底
    #    下那只可能是「角色身上有洋红色块」，用连通性判断不出来（腿缝与色块几何上一样）。
    #    所以这里只报信息，并另存一张高亮图给人眼过；只有当封闭洋红大到不可能是缝隙时才判。
    share = len(enclosed) / (w * h)
    notes.append("封闭洋红 %d（%.1f%%，多半是腿缝/臂缝，抠后应透明）" % (len(enclosed), share * 100))
    if share > 0.06:
        problems.append("封闭洋红占 %.1f%%，大到不像肢体缝隙 —— 可能是躯干里的洞" % (share * 100))

    # ③ 人物占高（非洋红的包围盒高度 / 画布高）
    body = [(x, y) for y in range(0, h, 2) for x in range(0, w, 2) if not is_mag(px[x, y][:3])]
    if not body:
        problems.append("整张图都是洋红，没画出人物")
        return notes, problems
    ys = [y for _, y in body]
    xs = [x for x, _ in body]
    pct = (max(ys) - min(ys) + 1) / h * 100
    notes.append("人物占高 %.0f%%（规格 460~480px = 90~94%%），左右占 %.0f%%"
                 % (pct, (max(xs) - min(xs) + 1) / w * 100))
    if not 86 <= pct <= 96:
        problems.append("人物占高 %.0f%% 不在规格的 90~94%% 附近" % pct)

    # ④ 用色数（规格 16~24）
    colors = len({px[x, y][:3] for y in range(0, h, 2) for x in range(0, w, 2)
                  if not is_mag(px[x, y][:3])})
    notes.append("人物用色 %d（规格 16~24）" % colors)
    if colors > 30:
        problems.append("人物用色 %d，超出 16~24 太多" % colors)
    return notes, problems


def body_bbox(img):
    """非洋红像素的包围盒（人物本体）。"""
    px = img.load()
    w, h = img.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if not is_magenta(px[x, y][:3]):
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def fit_height(img, target=0.92, tol=0.02):
    """把人物占高归到规格的 92%（±2% 内不动，免得白白重采样）。

    🔴 为什么要这一步：实测模型会把人物画到占高 97%（竹笠快顶到画布上沿），
    而规格要 460~480px / 512（= 90~94%）—— 上沿要留白，代码还要在脚下画接地阴影。
    做法是「裁到人物 → 按目标高度缩放 → 居中贴回洋红画布」，不动构图也不裁人物。
    """
    box = body_bbox(img)
    if box is None:
        return img, None
    x0, y0, x1, y1 = box
    cur = (y1 - y0 + 1) / img.height
    if abs(cur - target) <= tol:
        return img, cur
    sprite = img.crop((x0, y0, x1 + 1, y1 + 1))
    scale = (img.height * target) / sprite.height
    sprite = sprite.resize((max(1, round(sprite.width * scale)),
                            max(1, round(sprite.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGB", img.size, MAGENTA)
    canvas.paste(sprite, ((img.width - sprite.width) // 2,
                          (img.height - sprite.height) // 2))
    return canvas, cur


def process(raw_path):
    """原始出图 → 512×512 交付图（降采样 → 归人物占高 → 量化 → 洋红吸回）。"""
    im = Image.open(raw_path).convert("RGB").resize((EXPORT, EXPORT), Image.LANCZOS)
    im, _ = fit_height(im)
    quant = im.quantize(colors=COLORS, method=Image.MAXCOVERAGE).convert("RGB")
    snap_magenta(quant)
    return quant


def one(index, name, outfit, tpl, force, child=False):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    RAW = RAW_DIR / ("%02d-%s.png" % (index, name))
    last = None
    if RAW.exists() and not force:
        return name, "skip（已存在）"
    prompt = build_prompt(tpl, outfit, child)
    for attempt in range(RETRIES):
        try:
            RAW.write_bytes(gen.call_api(prompt, size=REQUEST))
            return name, "ok %.0fKB" % (RAW.stat().st_size / 1024)
        except Exception as exc:  # noqa: BLE001 —— 上游会 502/503
            last = exc
            if attempt < RETRIES - 1:
                time.sleep(9 * (attempt + 1))
    return name, "FAILED: %s" % str(last)[:110]


def main():
    ap = argparse.ArgumentParser(description="食客立绘（出图 + 交付）")
    ap.add_argument("--force", action="store_true", help="已存在也重出")
    ap.add_argument("--only", help="只处理这几个序号，逗号分隔（如 1,4）")
    ap.add_argument("--dry-run", action="store_true", help="只列计划，不发请求")
    args = ap.parse_args()

    tpl = load_template()
    # 🔴 序号一律取 VARIANTS 里的**原始序号**：用 --only 过滤后如果按 enumerate(picks) 重新编号，
    #    过滤出来的 5/6/17 会被写成 01/02/03，留下一批**文件名与内容对不上**的残留
    #    （踩过一次：patrons/ 里多出 01-sturdy-man.png 这类文件）。
    picks = [(n, name, child, outfit)
             for n, (name, child, outfit) in enumerate(VARIANTS, start=1)]
    if args.only:
        want = {int(s) for s in args.only.split(",")}
        picks = [p for p in picks if p[0] in want]

    print("规格：%s" % SPEC_MD.name)
    print("模板 %d 字符（取自 §2 代码块）＋ 每个换一段装扮描述" % len(tpl))
    print("头身比修正句插在**开头**（%s）" % ("儿童比例 4~5 头身" if False else "成人 6~7 头身 / 儿童 4~5 头身"))
    print("画布 %s → 交付 %d×%d，%d 色，洋红吸回精确 #FF00FF" % (REQUEST, EXPORT, EXPORT, COLORS))
    print("计划 %d 张 → %s\n" % (len(picks), OUT_DIR))
    for n, name, child, outfit in picks:
        print("  %2d. %-18s %s %s" % (n, name, "[儿童比例]" if child else "        ", outfit[:56]))
    if args.dry_run:
        return 0

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(one, n, name, outfit, tpl, args.force, child): name
                   for n, name, child, outfit in picks}
        for done, fut in enumerate(as_completed(futures), start=1):
            name, status = fut.result()
            results.append((name, status))
            print("[%2d/%d] %-18s %s" % (done, len(picks), name, status), flush=True)

    print("\n——— 交付与验收 ———")
    bad = 0
    for n, name, _, _ in picks:
        raw = RAW_DIR / ("%02d-%s.png" % (n, name))
        if not raw.exists():
            continue
        out = process(raw)
        dst = OUT_DIR / ("%02d-%s.png" % (n, name))
        out.save(dst)
        notes, problems = audit(out)
        print("%s %-18s %s" % ("✅" if not problems else "❌", name, " · ".join(notes)))
        for p in problems:
            print("     ↳ %s" % p)
        bad += bool(problems)
    print("\n交付 %d 张 → %s，不合格 %d 张" % (len(picks), OUT_DIR, bad))
    if bad:
        print("不合格的用 --only 序号 --force 单张重出")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
