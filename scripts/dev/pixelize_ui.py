# -*- coding: utf-8 -*-
"""把出图模型的原始 PNG「强制像素化」到本套的网格上（像素美食 UI 流水线第 3 步）。

为什么需要这一步：出图模型**按不出精确的像素网格** —— 它会给一张 1024~1536 的大图、
边缘带抗锯齿、颜色有几百种。轻则「看着像像素画但一放大全是糊边」，
重则九宫格拼出来的边框不是整数逻辑像素、实机上半像素错位。

步骤（与 `docs/ui-pixel/像素美食UI_出图提示词_v1.md` §11.1 一致）：
  1. 读 `raw/<ID>.png`，**裁到内容外框**（出图会给一张比元素大的透明画布）
  2. 按件分几何：九宫格件 / 纹理件**拉伸填满**导出画布（四条边必须贴边），
     固定尺寸件（徽章/食印/图标）**等比居中**（不许变形）
  3. 降到**逻辑尺寸**（导出 ÷ 4）：🔴 **分两级**降 —— 先到逻辑的 3 倍（LANCZOS + 量化 24
     保留色簇），再用 BOX 降到逻辑尺寸。一步降到位会把小件糊成一团：7×7 逻辑像素的
     徽章一步从 1024 降下来只剩一团色块，分两级才留得住形状。
  4. alpha 二值化（≥128 → 255），去掉半透明羽化
  5. 调色板量化到 ≤8 色（透明处的杂色不参与，免得污染调色板）
  6. 最近邻整数放大 4× 回导出尺寸

🔴 「裁到内容外框」不能改成按目标比例居中裁：九宫格件一旦被居中裁掉上下两条边，
   边框在实机里就只剩左右两条 —— 而模型的画布比例只有 1:1 / 1.5:1 / 2:3 三档，
   几乎每件都和导出比例不一致，居中裁必然裁到边。

尺寸不靠手抄：目标导出尺寸、slice、pull 都从出图提示词脚本产出的 JSON 里读
（`像素美食UI_出图提示词_v1.json` 的 `slots[]`；图标读 `icons.json`）—— 变了这里自动跟着变。

用法：
  python scripts/dev/pixelize_ui.py           # 处理 raw/ 下所有能对上 ID 的图
  python scripts/dev/pixelize_ui.py --colors 6
命名约定：`FRAME_CARD.png`（浅色）· `FRAME_CARD_dark.png`（深色套），后缀 _dark 会保留在输出名里。
"""
import json
import sys
from pathlib import Path

from PIL import Image

GRID = 4                      # 每个逻辑像素 = 4 导出像素（= 1 逻辑像素 2 css px × 导出 2 倍）
DEFAULT_COLORS = 8            # 提示词里承诺的「整幅 ≤8 色」
MID_FACTOR = 3                # 中间档 = 逻辑尺寸的几倍（分级降采样，见 docstring 第 3 步）
MID_COLORS = 24               # 中间档的用色数（先把色簇收拢，再落到 8 色）
ALPHA_FLOOR = 8               # 认定「这里是内容」的 alpha 下限

# 🔴 细档覆盖：技能 38 + 分组头 8 的 css 只有 18×18，按 §2 规则 1（1 逻辑像素 = 2 css px）
#    只剩 9×9 逻辑像素 —— 带描边的双色物件在 9×9 里放不下，实测就是一团色块（重写提示词
#    也只能从「认不出」推到「勉强像」）。这 46 个改用 GRID=2（18 逻辑像素）后形状立刻认得出，
#    对照见 `docs/ui-pixel/图标集_网格对比.png`。
#    规则 1 的初衷（导出 = css 的整数倍 ⇒ `image-rendering: pixelated` 不会被插值）仍然满足，
#    代价只是像素块小一档。**想回到严格 4：把下面这个字典改成 {} 即可。**
GRID_OVERRIDE = {"ICON_SKILL": 2, "ICON_GROUP": 2}      # ID 前缀 → 逻辑像素 = 导出 ÷ 该值

# 纹理/线条件：导出就是一条要被拉伸或平铺的纹样，**必须四边贴满**，
# 不然拉伸后控件上会出现透明缝（§5 里「形式 = 整条拉伸」的那些）。
STRETCH_IDS = {
    "TEX_BAR_FILL", "TEX_SHINE", "BG_TILE", "STEAM_CURVE",
    "LINE_ROW", "LINE_STROKE_RED", "LINE_STROKE_AMBER", "LINE_STROKE_TOAST",
}

# 🔴 改用 CSS 效果、**不出位图**的件（2026-09-23 用户定的）。
# BG_TILE 是页面最底层，规范要它「只带颗粒、颜色交给 15 套皮肤变量」；可出图会照着提示词里的
# 「轮廓不规则」给它画一圈焦边，平铺整页就成了吐司方阵（深色版是满墙煎蛋，还带煎蛋味）。
# 换成 `background-color: var(--page)` + 一张只有 5 个 1×1 像素点的透明小图 ——
# 没有接缝、换肤自动跟着变色、少一个大文件。片段见 `docs/ui-pixel/底纹_CSS片段.md`。
CSS_BACKGROUND_IDS = {"BG_TILE", "TEX_BAR_FILL"}

# 🔴 叠加纹理（`url(...) repeat` 压在 CSS 给的进度色上）本该走这条路：**两条常规做法都不能用**——
#   · 不能裁内容外框：它是「几行横纹 + 其余全透明」，裁到内容就只剩横纹那几条，
#     再拉到 16×16 就把条纹比例整个改了，铺出来不是那个纹理；
#   · 不能二值化 alpha：它靠 50% / 25% 的半透明才盖不住底色，二值化会把条纹直接删掉。
# **但 2026-09-23 实测出图根本画不出这个纹样**：给「半透明横纹叠加纹理」的提示词，
# 它照样画了一张披萨（番茄 + 煎蛋 + 香草）—— 与 BG_TILE 同一类失败（食物先验压过描述）。
# 所以 TEX_BAR_FILL 也改走 CSS（`repeating-linear-gradient`，见 docs/ui-pixel/底纹_CSS片段.md），
# 这一组现在没有成员；机制留着，将来真需要「非食物」的叠加纹时还能用。
OVERLAY_IDS = set()
ALPHA_LEVELS = ((32, 0), (96, 64), (176, 128), (256, 255))   # alpha 分档：0 / 25% / 50% / 100%

SPEC_PATH = Path(r"D:\plays\lmew\docs\ui-pixel\像素美食UI_出图提示词_v1.json")
ICON_MANIFEST = Path(r"D:\plays\lmew\docs\ui-pixel\icons.json")
RAW_DIR = Path(r"D:\plays\lmew\docs\ui-pixel\raw")
OUT_DIR = Path(r"D:\plays\lmew\docs\ui-pixel\out")


def load_targets():
    """ID → {export, slice, pull}（从规范 JSON 读，不手抄）。

    图标不在 `slots[]` 里，尺寸读 `icons.json`（出图脚本在发请求前就写好的一份清单）；
    图标都是固定尺寸件，所以 slice 0 / pull False。
    """
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    targets = {
        s["id"]: {"export": tuple(s["export"]), "slice": s.get("slice") or 0,
                  "pull": bool(s.get("pull"))}
        for s in spec["slots"]
    }
    if ICON_MANIFEST.exists():
        for entry in json.loads(ICON_MANIFEST.read_text(encoding="utf-8")):
            targets[entry["id"]] = {"export": tuple(entry["export"]), "slice": 0, "pull": False}
    return targets


def content_box(img):
    """内容外框：alpha 不为空的最小包围盒（模型给的画布通常比元素大一圈）。"""
    alpha = img.getchannel("A").point(lambda v: 255 if v > ALPHA_FLOOR else 0)
    box = alpha.getbbox()
    if box is None:
        raise ValueError("整张图都是透明的，检查一下出图是不是失败了")
    return img.crop(box)


def place(img, w, h, stretch):
    """把内容外框按目标几何放到 w×h 画布上。

    stretch=True（九宫格件/纹理件）：拉伸填满，四条边贴住画布边缘。
    stretch=False（固定尺寸件）：等比缩放后居中，四周留透明边。
    """
    if stretch:
        return img.resize((w, h), Image.LANCZOS)
    scale = min(w / img.width, h / img.height)
    tw = max(1, min(w, int(round(img.width * scale))))
    th = max(1, min(h, int(round(img.height * scale))))
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.paste(img.resize((tw, th), Image.LANCZOS), ((w - tw) // 2, (h - th) // 2))
    return canvas


def binarize_alpha(img):
    return img.getchannel("A").point(lambda v: 255 if v >= 128 else 0)


def _mode_color(rgb, mask):
    """不透明像素的众数色（量化时要用它填掉透明处，免得透明处的杂色污染色板）。"""
    px, mp = rgb.load(), mask.load()
    counts = {}
    for y in range(rgb.height):
        for x in range(rgb.width):
            if mp[x, y]:
                color = px[x, y]
                counts[color] = counts.get(color, 0) + 1
    if not counts:
        raise ValueError("整张图都是透明的，检查一下出图是不是失败了")
    return max(counts, key=counts.get)


def _quantize(rgb, mask, colors):
    """把透明处填成众数色后量化，返回量化后的 RGB 图。"""
    base = _mode_color(rgb, mask)
    px, mp = rgb.load(), mask.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            if not mp[x, y]:
                px[x, y] = base
    return rgb.quantize(colors=colors, method=Image.MAXCOVERAGE).convert("RGB")


def grid_for(slot_id):
    """该件每个逻辑像素是几个导出像素（默认 GRID，少数小件走 GRID_OVERRIDE）。"""
    for prefix, grid in GRID_OVERRIDE.items():
        if slot_id.startswith(prefix):
            return grid
    return GRID


def pixelize(img, export_w, export_h, colors, stretch, grid=GRID):
    """按步骤做像素化，返回 (新图, 实际用色数)。"""
    lw, lh = max(1, export_w // grid), max(1, export_h // grid)
    content = content_box(img.convert("RGBA"))

    # ① 分两级降到逻辑尺寸：中间档（3× 逻辑）先收拢色簇，再 BOX 降到逻辑尺寸
    mid = place(content, lw * MID_FACTOR, lh * MID_FACTOR, stretch)
    mid_mask = binarize_alpha(mid)
    mid_rgb = _quantize(mid.convert("RGB"), mid_mask, max(colors, MID_COLORS))

    small = mid_rgb.resize((lw, lh), Image.BOX)
    mask = mid_mask.resize((lw, lh), Image.BOX).point(lambda v: 255 if v >= 128 else 0)

    # ② 落到 ≤colors 色
    small_rgb = _quantize(small, mask, colors)

    # ③ 最近邻整数放大回导出尺寸，合成二值 alpha
    out = small_rgb.resize((export_w, export_h), Image.NEAREST).convert("RGBA")
    out.putalpha(mask.resize((export_w, export_h), Image.NEAREST))
    used = {p[:3] for p in out.getdata() if p[3] > 0}
    return out, len(used)


def quantize_alpha(alpha, grid):
    """把 alpha 归到几档（0 / 25% / 50% / 100%），保留半透明 —— 叠加纹理靠它才盖不住底色。"""
    lookup = []
    for value in range(256):
        out = 0
        for edge, level in ALPHA_LEVELS:
            if value < edge:
                out = level
                break
        lookup.append(out)
    return alpha.point(lookup)


def pixelize_overlay(img, export_w, export_h, colors, grid=GRID):
    """叠加纹理：整张画布（不裁内容）→ 量化 RGB + 多档 alpha → 最近邻放大。

    与 `pixelize()` 的关键差别：① 不裁内容外框；② alpha 不二值化。
    """
    lw, lh = max(1, export_w // grid), max(1, export_h // grid)
    src = img.convert("RGBA")

    # 整张画布分两级降到逻辑尺寸（与常规路径同样的两级，只是不做 content_box 裁剪）
    mid = src.resize((lw * MID_FACTOR, lh * MID_FACTOR), Image.LANCZOS)
    mid_alpha = quantize_alpha(mid.getchannel("A"), grid)
    mid_rgb = _quantize(mid.convert("RGB"), mid_alpha, max(colors, MID_COLORS))

    small = mid_rgb.resize((lw, lh), Image.BOX)
    alpha = quantize_alpha(mid_alpha.resize((lw, lh), Image.BOX), grid)
    small_rgb = _quantize(small, alpha, colors)

    out = small_rgb.resize((export_w, export_h), Image.NEAREST).convert("RGBA")
    out.putalpha(alpha.resize((export_w, export_h), Image.NEAREST))
    used = {p[:3] for p in out.getdata() if p[3] > 0}
    return out, len(used)


def main():
    colors = DEFAULT_COLORS
    if "--colors" in sys.argv:
        colors = int(sys.argv[sys.argv.index("--colors") + 1])

    targets = load_targets()
    if not RAW_DIR.is_dir():
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        print("已建好输入目录（把出图结果放进来再跑一次）：", RAW_DIR)
        print("期望文件名形如：FRAME_CARD.png / FRAME_CARD_dark.png（共 %d 个 ID）" % len(targets))
        return 0
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    files = sorted(p for p in RAW_DIR.iterdir() if p.suffix.lower() == ".png")
    if not files:
        print("raw/ 里还没有 PNG。期望文件名形如 FRAME_CARD.png（可用的 ID 见规范 JSON）。")
        return 0

    ok, skipped, failed, css_skipped = 0, [], [], []
    for src in files:
        stem = src.stem
        dark = stem.endswith("_dark")
        slot_id = stem[:-5] if dark else stem
        if slot_id not in targets:
            skipped.append(src.name)
            continue
        if slot_id in CSS_BACKGROUND_IDS:
            css_skipped.append(src.name)
            continue
        target = targets[slot_id]
        ew, eh = target["export"]
        # 九宫格件与纹理件必须拉伸填满（四条边贴边），固定尺寸件等比居中（不许变形）
        stretch = slot_id in STRETCH_IDS or (target["pull"] and target["slice"] > 0)
        grid = grid_for(slot_id)
        try:
            if slot_id in OVERLAY_IDS:
                out, used = pixelize_overlay(Image.open(src), ew, eh, colors, grid)
                mode = "叠加纹理(不裁/留半透明)"
            else:
                out, used = pixelize(Image.open(src), ew, eh, colors, stretch, grid)
                mode = "拉伸" if stretch else "等比居中"
        except ValueError as exc:
            failed.append("%s（%s）" % (src.name, exc))
            continue
        name = "%s%s@2x.png" % (slot_id, "_dark" if dark else "")
        out.save(OUT_DIR / name)
        flag = "" if used <= colors else "  ⚠️ 用色 %d > %d" % (used, colors)
        print("%-34s %s → %dx%d（逻辑 %d×%d，%d 色，%s）%s"
              % (src.name, name, ew, eh, ew // grid, eh // grid, used, mode, flag))
        ok += 1

    print("\n完成 %d 个，输出目录：%s" % (ok, OUT_DIR))
    if css_skipped:
        print("改用 CSS 效果、不出位图的：%s（见 docs/ui-pixel/底纹_CSS片段.md）"
              % "、".join(css_skipped))
    if skipped:
        print("跳过的（文件名对不上任何 ID）：%s" % "、".join(skipped))
        print("可用的 ID 列表来自：%s" % SPEC_PATH)
    if failed:
        print("失败的：%s" % "、".join(failed))
    print("下一步：python scripts/dev/check_pixel_assets.py，再用样张按 1:1 实机尺寸看一遍。")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
