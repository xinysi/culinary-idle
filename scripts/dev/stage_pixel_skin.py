# -*- coding: utf-8 -*-
"""像素美食 UI · 第 5 步：把 out/ 的 212 张素材**摆好并生成接入用的 CSS 层**。

做三件事（全部是**新增**，不动 main.css 一行）：
  1. 素材从 `docs/ui-pixel/out/` 拷到 `public/images/ui-food-pixel/`
     （老的 32 件那套先挪到 `_superseded-old-set/`，它的 manifest 已被本套取代）
  2. 生成 `public/images/ui-food-pixel/manifest.json`（ID → 文件 / 尺寸 / slice / 用法）
  3. 生成 `src/styles/pixel-skin.css` —— 按**实机控件族类名**（.card 371 处、.btn 569 处、
     .badge 163 处…）把素材接到 border-image 上，并按 §11.3 的三条硬规则写：
       · 只加 `border-image-*`，**绝不动 `border-width`**（布局只认 border-width ⇒ 内容盒不缩）
       · 换肤一律去圆角（border-radius: 0）
       · `image-rendering: pixelated` 只在这套范围内开，**立绘不加**（512px 立绘开了会碎）
     底纹用 CSS 效果（不是 BG_TILE 位图，见 `docs/ui-pixel/底纹_CSS片段.md`）。

🔴 **本脚本不会把这个 CSS 引进 main.css** —— 那一行由人决定什么时候加
（`@import './pixel-skin.css';` 放在 main.css 末尾即可整层启用/删除，这是这套东西能一键回退的关键）。
生成完先跑 `scripts/dev/shot_pixel_skin.mjs` 用真实类名验证一遍再启用。

用法：python scripts/dev/stage_pixel_skin.py
"""
import json
import shutil
from pathlib import Path

ROOT = Path(r"D:\plays\lmew")
SPEC_PATH = ROOT / "docs" / "ui-pixel" / "像素美食UI_出图提示词_v1.json"
ICON_MANIFEST = ROOT / "docs" / "ui-pixel" / "icons.json"
OUT_DIR = ROOT / "docs" / "ui-pixel" / "out"
ASSET_DIR = ROOT / "public" / "images" / "ui-food-pixel"
SKIN_CSS = ROOT / "src" / "styles" / "pixel-skin.css"

# 不出位图的件（底纹走 CSS 效果，见 docs/ui-pixel/底纹_CSS片段.md）
CSS_BACKGROUND_IDS = {"BG_TILE"}

# 控件族 → 素材。九宫格件写 (ID, slice, css 边框宽)；固定尺寸件写 (ID, None)。
#
# 🔴 选择器**必须来自实测清单**（`scripts/dev/ui-inventory.json`，浏览器逐页量的），
#    不能照文档里的族名猜 —— 第一版我按文档猜了 `.tab` / `.slot`，而 main.css 里
#    **根本没有这两个类**（真实类名是 `.sidebar-tab` / `.slot-card`），接上去等于没接。
#    下面括号里的例数就是从清单里数出来的。
FAMILIES = [
    (".card, .gather-card", "FRAME_CARD", "frame"),                  # 卡片 493 例
    (".sidebar.app-sidebar, .main-scroll", "FRAME_PANEL", "frame"),  # 面板 259 例
    (".panel-box, .dialog", "FRAME_MODAL", "frame"),
    (".btn, .btn-sm", "FRAME_BTN", "frame"),                         # 按钮 840 例（btn btn-sm 269）
    (".btn-primary, .style-btn", "FRAME_BTN_PRIMARY", "frame"),      # 主按钮 173 例
    (".sidebar-tab, .top-nav-btn", "FRAME_TAB", "frame"),            # 页签 840 例
    (".sidebar-tab.active, .top-nav-btn.active", "FRAME_TAB_ON", "frame"),
    (".plot-select, .cellar-qty, .ex-input, .gv-search", "FRAME_INPUT", "frame"),  # 输入框 10 例
    (".ui-check", "CHECK_OFF_S", "fixed"),                           # 复选框 5 例
    (".badge", "BADGE_M", "fixed"),                                  # 徽章 347 例
    (".best-flag, .xp-low-chip", "BADGE_S", "fixed"),
    (".effect-chip", "BADGE_L", "fixed"),
    (".medal", "MEDAL_L", "fixed"),
]

# 🔴 **不给「内容类」小件挂九宫格帧**（2026-09-23 用户指出「明显堆叠、乱七八糟」后定的）：
#   18px 的技能图标 / 40px 的物品图 / 8px 高的进度条，本来都长在卡片里面 ——
#   再各包一层撕边框，就是「卡片框里套图标框、套进度条框」。
#   实测（audit_pixel_skin_stack.mjs）：一页 247 个元素挂了帧、91% 有帧祖先、最深 3 层，其中
#   skill-icon 38 + item-img 31 + progress-bar/mastery-bar 69 就是这个深度的来源。
#   处置：图标/物品图沿用 main.css 原有边框；进度条只留 CSS 槽 + 填充（见 bar_fill_rules）。
#   ⚠️ 以后想恢复某一件，**只挂给「最外层容器」**，别整类挂上（下面那条防回归规则会拦）。
NO_FRAME_GUARD = """
/* ── 内层一律不挂帧（防回归）────────────────────────────────────────────
 * 小件是**内容**不是容器：让撕边框包住它们，一页会堆到 3 层、看着像一摞纸板。
 * 这条用「帧元素的后代」表达，比逐个列类名耐维护 —— 以后新增控件也不会再套进去。
 * 门槛（node scripts/dev/audit_pixel_skin_stack.mjs）：挂帧元素 ≤60 · 嵌套 ≈0 · 无旧阴影残留。 */
:is(.main-scroll, .sidebar, .card, .gather-card, .dock-panel)
  :is(.skill-icon, .item-img, .progress-bar, .mastery-bar, .bar, .ui-check,
      .badge, .effect-chip, .loadout-chip, .status-chip, .inv-bartop) {
  border-image: none;
}
"""

DARK_BG = "#1C1410"
LIGHT_BG = "#FBF3E4"
SPECK_LIGHT = "%23D89868"
SPECK_DARK = "%236B5433"


def speck_url(colour):
    """64×64 透明底小图，只画 5 个 1×1 像素点（规范：「每 64px 只有 4~6 个 1 像素点」）。

    🔴 点色只能**烘进 SVG**：data URI 里的 SVG 读不到外层文档的 CSS 变量，
    `fill='var(--speck)'` 是不生效的。所以浅深各生成一张，底色才走 `var(--page)`。
    """
    dots = [(7, 13), (41, 5), (23, 37), (55, 29), (14, 53)]
    rects = "".join("%%3Crect x='%d' y='%d' width='1' height='1' fill='%s'/>" % (x, y, colour)
                    for x, y in dots)
    return ("url(\"data:image/svg+xml,%%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' "
            "height='64'%%3E%s%%3C/svg%%3E\")" % rects.replace("%3C", "%3C").replace("%3E", "%3E"))


def bg_grain_rules():
    """底纹：底色走 var(--page)，颗粒点烘在图里（浅深各一张）。"""
    def block(indent, url):
        return "\n".join([
            "%sbackground-color: var(--page);" % indent,
            "%sbackground-image: %s;" % (indent, url),
            "%sbackground-repeat: repeat;" % indent,
            "%sbackground-size: 64px 64px;" % indent,
        ])

    sel = ".bg-grain,\n.app-layout,\n.app-body"
    dark_sel = ", ".join("html[data-theme='dark'] " + s.strip() for s in sel.split(","))
    return (
        "/* 页面底纹：几乎全平 + 每 64px 五个 1×1 像素点。没有接缝，换皮肤底色自动跟着变。\n"
        " * 这是 BG_TILE 的替代（不出位图），理由见 docs/ui-pixel/底纹_CSS片段.md */\n"
        + sel + " {\n" + block("  ", speck_url(SPECK_LIGHT)) + "\n}\n\n"
        + dark_sel + " {\n" + block("  ", speck_url(SPECK_DARK)) + "\n}\n"
    )


def load():
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    slots = {s["id"]: s for s in spec["slots"]}
    icons = json.loads(ICON_MANIFEST.read_text(encoding="utf-8")) if ICON_MANIFEST.exists() else []
    return spec, slots, icons


def stage_assets():
    """把 out/ 下所有 @2x.png 拷进 public/；不是本套的东西先挪到 _superseded-old-set/。

    🔴 判断「是不是本套的」按**文件名**来，不能一律「清空再拷」—— 那样重跑一次就会把
    刚拷进去的 212 张又当成老东西挪走（第二遍跑时踩到过）。
    """
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    legacy = ASSET_DIR / "_superseded-old-set"
    keep = {p.name for p in OUT_DIR.glob("*@2x.png")} | {"manifest.json"}
    moved = 0
    for item in list(ASSET_DIR.iterdir()):
        if item.name == legacy.name or item.name in keep:
            continue
        legacy.mkdir(parents=True, exist_ok=True)
        shutil.move(str(item), str(legacy / item.name))
        moved += 1
    copied = 0
    for png in sorted(OUT_DIR.glob("*@2x.png")):
        shutil.copy2(png, ASSET_DIR / png.name)
        copied += 1
    return copied, moved


def build_manifest(slots, icons):
    entries = []
    for png in sorted(OUT_DIR.glob("*@2x.png")):
        stem = png.stem.replace("@2x", "")           # FRAME_CARD / FRAME_CARD_dark
        dark = stem.endswith("_dark")
        slot_id = stem[:-5] if dark else stem
        slot = slots.get(slot_id)
        icon = next((i for i in icons if i["id"] == slot_id), None)
        if slot is None and icon is None:
            continue
        export = tuple(slot["export"]) if slot else tuple(icon["export"])
        entries.append({
            "id": stem,
            "kind": "深色套" if dark else ("图标" if icon else "通用件"),
            "name": slot["cn"] if slot else icon["name"],
            "size": list(export),
            "css_size": [export[0] // 2, export[1] // 2],
            "slice_px": (slot.get("slice") or 0) if slot else 0,
            "pull": bool(slot.get("pull")) if slot else False,
            "usage": slot["usage"] if slot else icon.get("kind", ""),
            # ⚠️ png.name 本身就带 `@2x.png`，后面再拼一次 `.png` 会得到 `X@2x.png.png`
            #    —— 212 条 file 字段全部 404（2026-09-23 验收抓出，已就地修正）
            "file": "images/ui-food-pixel/%s" % png.name,
        })
    (ASSET_DIR / "manifest.json").write_text(
        json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")
    return entries


def asset_path(stem):
    """CSS 里引用素材的路径：**跟 main.css 保持同一套写法**（`../../public/images/...`，
    相对 src/styles/ 解析）。写成 web 根路径 `/images/...` 在预检页里会 404 —— 那是两套解析规则，
    同项目里必须统一成一套。"""
    return "../../public/images/ui-food-pixel/%s@2x.png" % stem


def frame_rule(selector, stem, slice_px):
    width = slice_px // 2          # 导出像素 → css px（导出 = css × 2）
    return (
        "%s {\n"
        "  /* 只碰 border-image-*：绘制区由 border-image-width 定，布局仍只认 border-width */\n"
        "  border-style: solid;\n"
        "  /* 🔴 第四个值用 round，**不能用 stretch**：九宫格的边带中段只有一根轴被缩放，\n"
        "   * 而这张帧的撕边是整条边分布的 ⇒ 拉到 848px 宽时右上角会被拉成一大片斜纹\n"
        "   * （240px 参考尺寸看不出来，按实机尺寸拼才暴露）。round 让碎边重复出现、看着\n"
        "   * 是刻意的；repeat 也能平铺但末端会被截断。2026-09-23 验收抓出。 */\n"
        "  border-image: url('%s') %d fill / %dpx round;\n"
        "  border-radius: 0;\n"
        "  image-rendering: pixelated;\n"
        "  /* ↓ 撤旧轮廓：三条都是「叠出来的丑」的来源（2026-09-23 用户指出「明显堆叠」）\n"
        "   * border-color 透明：border-width 保持不动（布局一个像素不变），只让那 1px 旧直线消失\n"
        "   * box-shadow 关掉：旧柔影 + 新撕边 = 双重轮廓，看着糊\n"
        "   * background 清掉：元素自带的半透明白底会铺满整个 border box，从撕边的透明缺口里\n"
        "   *   透出一圈「方角光晕」（像一张方纸垫在撕纸下面）；面改由素材的 fill 出 */\n"
        "  border-color: transparent;\n"
        "  box-shadow: none;\n"
        "  background-color: transparent;\n"
        "  background-image: none;\n"
        "}" % (selector, asset_path(stem), slice_px, width))


def fixed_rule(selector, stem):
    return (
        "%s {\n"
        "  background-image: url('%s');\n"
        "  background-size: 100%% 100%%;\n"
        "  background-repeat: no-repeat;\n"
        "  border-radius: 0;\n"
        "  image-rendering: pixelated;\n"
        "}" % (selector, asset_path(stem)))


def bar_fill_rules():
    """进度填充的「汤汁横纹」：CSS 效果，不出位图。

    规范 §3.1 把它描述成「50% 透明度白色横纹两行 + 25% 透明度黑色横纹一行」——
    这本来就是**几何**，不是画。而实测出图面对这个描述会画成一张披萨（食物先验压过描述，
    与 BG_TILE 同一类失败），所以和底纹一样改走 CSS：颜色仍由 `--bar-color` 给，
    横纹只是叠在上面的一层，**8 种进度色都能染色**，也不会有半个像素的接缝。
    """
    stripes = (
        "repeating-linear-gradient(to bottom,\n"
        "    rgba(255,255,255,0.50) 0, rgba(255,255,255,0.50) 1px,\n"
        "    rgba(255,255,255,0.00) 1px, rgba(255,255,255,0.00) 3px,\n"
        "    rgba(0,0,0,0.25) 3px, rgba(0,0,0,0.25) 4px,\n"
        "    rgba(255,255,255,0.00) 4px, rgba(255,255,255,0.00) 5px)"
    )
    return (
        "/* 进度填充：底色走 --bar-color，上面叠一层 CSS 横纹（TEX_BAR_FILL 的替代，不出位图）\n"
        " * —— 血条红 / 经验绿 / 精通紫各自都能透出来，不会像不透明位图那样盖成同一种棕。\n"
        " * 理由与复现见 docs/ui-pixel/底纹_CSS片段.md */\n"
        ".progress-bar-fill,\n.mastery-bar-fill {\n"
        "  background-color: var(--bar-color, #D82818);\n"
        "  background-image: " + stripes + ";\n"
        "  background-size: 4px 4px;\n"
        "}\n"
    )


def build_css(slots, icons):
    have = {p.stem.replace("@2x", "") for p in OUT_DIR.glob("*@2x.png")}
    lines = [
        "/* 像素美食 UI · 接入层（**自动生成**，别手改；改 scripts/dev/stage_pixel_skin.py）",
        " *",
        " * 启用：在 src/styles/main.css 末尾加一行  @import './pixel-skin.css';",
        " * 回退：删掉那一行即可 —— 这一层不修改 main.css 的任何既有规则，也不动布局。",
        " *",
        " * 三条硬规则（§11.3，都是踩出来的）：",
        " *   ① 只加 border-image-*，绝不动 border-width（内容盒一个像素不缩、换行不变）",
        " *   ② 换肤一律去圆角（border-radius: 0），否则圆角会把 border-image 的角切掉",
        " *   ③ image-rendering: pixelated 只在本层开；**立绘不加**（512px 立绘开了会碎）",
        " */",
        "",
        ":root {",
        "  /* 页面底色：15 套皮肤各给一份（底纹不用位图，见 docs/ui-pixel/底纹_CSS片段.md） */",
        "  --page: %s;" % LIGHT_BG,
        "}",
        "html[data-theme='dark'] {",
        "  --page: %s;" % DARK_BG,
        "}",
        "",
        bg_grain_rules(),
        "",
        bar_fill_rules(),
        "",
        NO_FRAME_GUARD,
        "",
    ]
    skipped = []
    for selector, slot_id, kind in FAMILIES:
        slot = slots.get(slot_id)
        if slot is None or slot_id not in have:
            skipped.append(slot_id)
            continue
        if kind == "frame":
            if not slot.get("slice"):
                skipped.append(slot_id)
                continue
            lines.append(frame_rule(selector, slot_id, slot["slice"]))
        else:
            lines.append(fixed_rule(selector, slot_id))
        lines.append("")
        # 深色第二套（§6 共 14 件；这里只给拥有的那几件出覆盖规则）
        if slot.get("dark_variant") and (slot_id + "_dark") in have:
            dark_sel = "html[data-theme='dark'] " + ", html[data-theme='dark'] ".join(
                s.strip() for s in selector.split(","))
            lines.append(frame_rule(dark_sel, slot_id + "_dark", slot["slice"]) if kind == "frame"
                         else fixed_rule(dark_sel, slot_id + "_dark"))
            lines.append("")
    lines.append("/* 图标（158 个）按 data-icon 挂，逐个用属性选择器，避免 158 条类名 */")
    for icon in icons:
        if icon["id"] not in have:
            continue
        lines.append(
            "[data-icon='%s'] {\n"
            "  background-image: url('%s');\n"
            "  background-size: 100%% 100%%;\n"
            "  background-repeat: no-repeat;\n"
            "  image-rendering: pixelated;\n"
            "}" % (icon["id"], asset_path(icon["id"])))
    return "\n".join(lines) + "\n", skipped


def main():
    spec, slots, icons = load()
    copied, moved = stage_assets()
    entries = build_manifest(slots, icons)
    css, skipped = build_css(slots, icons)
    SKIN_CSS.parent.mkdir(parents=True, exist_ok=True)
    SKIN_CSS.write_text(css, encoding="utf-8")

    print("素材：拷入 %d 张 → %s" % (copied, ASSET_DIR))
    if moved:
        print("      老那套 %d 项挪到 %s" % (moved, ASSET_DIR / "_superseded-old-set"))
    print("清单：manifest.json（%d 条）" % len(entries))
    print("CSS 层：%s（%.1fKB）" % (SKIN_CSS, SKIN_CSS.stat().st_size / 1024))
    if skipped:
        print("⚠️ 这些素材不在 out/ 里，没接：%s" % "、".join(skipped))
    print("\n🔴 **没有**动 main.css —— 启用只加一行 @import，回退删掉那一行。")
    print("启用前先验：node scripts/dev/shot_pixel_skin.mjs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
