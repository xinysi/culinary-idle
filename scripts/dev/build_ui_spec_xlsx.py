# -*- coding: utf-8 -*-
"""生成《全 UI 改版规范（中国风金属/木牌）》Excel。

数据来源（全部实测，不是我凭印象写）：
  scripts/dev/ui-inventory.json —— 逐页（105 页）用真实浏览器枚举控件族，
  记录每个控件的实测几何（宽×高）与计算样式（圆角/描边/内边距/字号/底色/阴影/毛玻璃/状态）。
本表把 3573 个实测控件收敛成：
  · 226 个「族|类名」变体 —— 每个变体的专属尺寸、9-slice、材质配方、提示词（表 4）
  · 930 个「页面×族」组合 —— 每页用到哪些控件、各自尺寸（表 5）
用法：python scripts/dev/build_ui_spec_xlsx.py
"""
import json, re, os, sys, collections, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
XLSX_SKILL_DIR = os.environ.get("XLSX_SKILL_DIR") or r"C:\Users\xin'si\.zcode\cli\plugins\cache\zcode-plugins-official\spreadsheets\0.1.7\skills\xlsx"
sys.path.insert(0, os.path.join(XLSX_SKILL_DIR, "templates"))
sys.path.insert(0, XLSX_SKILL_DIR)  # base.py 内部会 `from templates.palettes import ...` ⇒ 技能根目录也要在 path 上
import base as B  # noqa
from base import *  # noqa
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

# ⚠️ 不能调 use_palette_explicit("aesop")：palettes.py 用了 PEP 604（`str | list`，需 Python ≥3.10），
#    本机是 3.9 ⇒ ImportError。等价做法：直接覆盖模块常量（base.py 的工厂在**调用时**读这些全局变量，
#    所以覆盖 B.PRIMARY 就能生效）。取 design.md §2.3 的 aesop（沙岩/大地色）主色，与木牌铜饰同调。
B.PRIMARY = "3D3229"
B.PRIMARY_LIGHT = "E4DCCF"
B.SECONDARY = "E4DCCF"
B.HEADER_TEXT = "F7F1E6"

INV = json.load(open(os.path.join(ROOT, "scripts/dev/ui-inventory.json"), encoding="utf-8"))
OUT = os.path.join(ROOT, "docs", "UI改版规范_木牌铜饰_v1.xlsx")
STYLE_NAME = "山海匠作 · 木牌铜饰"

# ────────────────────────── 页面中文名（从数据模块抽，别手抄）──────────────────────────
fg = open(os.path.join(ROOT, "src/game/data/featureGroups.js"), encoding="utf-8").read()
VIEW_NAME = {v: n for n, v in re.findall(r"name: '([^']+)',\s*\n?\s*view: '([A-Za-z]+)'", fg)}
sk = open(os.path.join(ROOT, "src/game/data/skills.js"), encoding="utf-8").read()
for sid, nm in re.findall(r"(\w+):\s*\{\s*\n?\s*name: '([^']+)'", sk):
    VIEW_NAME.setdefault(sid, nm)

# ────────────────────────── 现行 CSS 变量（表 3 的底表）──────────────────────────
css = open(os.path.join(ROOT, "src/styles/main.css"), encoding="utf-8").read()
def tokens_in(block_head):
    i = css.index(block_head)
    body = css[i:css.index("}", i)]
    return dict(re.findall(r"(--[\w-]+):\s*([^;]+);", body))
LIGHT = tokens_in(":root {")
DARK = tokens_in("html[data-theme='dark']")

# ────────────────────────── 控件族 → 材质配方 / 提示词 / 新几何 ──────────────────────────
# recipe: 材质配方（这四层怎么叠）；subject: 提示词主体；neg: 该族额外负向；slice: 9-slice 边距
FAM = {
    "按钮": dict(
        recipe="桦木横纹底板 + 黄铜 1px 描边 + 顶部 1px 内高光（rgba(255,242,205,.55)）+ 硬投影 0 2px 0 rgba(60,40,20,.22)",
        subject="横向长方形小木牌按钮，四角 3px 圆角，铜边等宽内收，无文字无图标",
        slice=10, radius=3, border=1),
    "主按钮": dict(
        recipe="朱漆底板（#9E2B25）+ 鎏金 1.5px 描边（#E8C766）+ 顶部内高光 + 硬投影 0 2px 0 rgba(60,20,10,.28)",
        subject="横向长方形漆器按钮，四角 3px 圆角，描金边，无文字",
        slice=10, radius=3, border=2),
    "图标按钮": dict(
        recipe="小圆木片（无明显木纹、只留细纹）+ 铜边 1px + 无内高光（面积太小会脏）",
        subject="正方形小木片按钮，四角 3px 圆角，细铜边，无符号无图标",
        slice=8, radius=3, border=1),
    "页签": dict(
        recipe="木牌页签：常态=半透明素木（alpha .72）、选中=实木底 + 左上/右上各一颗 3px 铜钉 + 鎏金描边 1.5px",
        subject="横向长方形木牌页签，四角 3px 圆角，无文字",
        slice=10, radius=3, border=1),
    "卡片": dict(
        recipe="宣纸底（#F5EDDC，纸纤维极淡）+ 木框 4px（深檀 #7A5636）+ 内高光 1px + 投影 0 2px 0 rgba(60,40,20,.18)",
        subject="竖向长方形宣纸卡片，木框四边等宽，四角 6px 圆角，纸面留白，无内容",
        slice=16, radius=6, border=4, corners="四角 12×12 铜包角（仅大卡）"),
    "面板": dict(
        recipe="大漆木板（朱漆或墨漆，按主题）+ 四角 12×12 铜包角 + 内高光 + 投影 0 3px 0 rgba(40,25,15,.24)",
        subject="竖向长方形漆器大面板，四角 8px 圆角，四角铜包角，无内容",
        slice=20, radius=8, border=3),
    "弹窗": dict(
        recipe="漆器大板 + 铜包角 + 外圈 2px 暗木描边 + 更重投影 0 8px 20px rgba(30,20,10,.35)（唯一允许「浮起」的层）",
        subject="居中弹窗框，四角 8px 圆角，顶部一条 4px 铜饰横档，无内容",
        slice=24, radius=8, border=3),
    "徽章": dict(
        recipe="小铜牌（哑光 #C9A227）+ 深色凹刻字位（字色 --badge-ink）+ 无投影（贴在别的器物上）",
        subject="横向小长方形铜牌徽章，四角 3px 圆角，边缘内凹 1px，无文字",
        slice=8, radius=3, border=1),
    "进度条": dict(
        recipe="槽 = 内凹铜槽（#8A6D1F 暗铜 + 内阴影 0 1px 2px rgba(0,0,0,.35)）；填充 = 釉面朱漆/青釉，顶部 1px 高光",
        subject="极扁长条形内凹铜槽，两端 3px 圆角，槽内空，无刻度",
        slice=6, radius=3, border=1),
    "输入框": dict(
        recipe="内凹纸槽（比周围凹 1px）+ 铜边 1px + 聚焦时铜边变鎏金 2px + 光标用墨色",
        subject="横向长方形内凹纸槽输入框，四角 3px 圆角，无文字无光标",
        slice=10, radius=3, border=1),
    "下拉": dict(
        recipe="同输入框，右侧留 24px 铜色箭头位（箭头为独立素材，不烘进底板）",
        subject="横向长方形内凹纸槽下拉框，右侧一块小铜片箭头位，无文字",
        slice=10, radius=3, border=1),
    "复选框": dict(
        recipe="小方木牌 + 铜边；勾选=铜钉压入（内阴影）+ 鎏金勾",
        subject="14×14 正方形小木牌复选框，四角 3px 圆角，无符号",
        slice=8, radius=3, border=1),
    "表格": dict(
        recipe="竹简纹横条行（斑竹细纹、行间 1px 深木分隔线）+ 表头为朱漆木条 + 数字右对齐用等宽数字",
        subject="横向长方形竹简木条（表格一行），两端平直，无文字",
        slice=8, radius=0, border=0),
    "日志行": dict(
        recipe="极淡纸纹行 + 左侧 3px 铜条（按日志级别换色：info=铜 / warn=朱 / gain=鎏金）",
        subject="横向细长纸条行，左端一小段铜色竖条，无文字",
        slice=8, radius=2, border=0),
    "物品图": dict(
        recipe="圆角方框底（宣纸）+ 1px 铜边；不描画物品本身（物品图另有 2427 张素材，本规范不管）",
        subject="正方形物品图底座，圆角 4px，细铜边，中间留空",
        slice=8, radius=4, border=1),
    "区块标题": dict(
        recipe="无底板；左侧 3px 木色竖条 + 标题字用墨字、字距 +0.02em",
        subject="（纯排版元素，不需要素材）",
        slice=0, radius=0, border=0),
}
NEG = ("玻璃拟态 / 毛玻璃模糊、霓虹发光、镜面反射、3D 透视或斜视、渐变彩虹、纯白高光爆点、"
       "卡通粗描边、赛博朋克、现代扁平几何、任何文字/数字/字母/水印/署名、背景投影到画面里")

# 每个变体该出哪些状态图（决定工作量；区块标题是纯排版元素、不需要素材）
def states_of(fam, cls):
    if fam == "区块标题":
        return []
    if fam in ("进度条", "表格", "日志行", "物品图"):
        return ["常态"]
    base = ["常态", "悬停", "按下", "禁用"]
    if fam in ("页签", "按钮", "主按钮") or "chip" in cls or "tab" in cls:
        base += ["选中"]
    if "lock" in cls or "locked" in cls:
        base += ["锁定"]
    return base

def fam_of(f):
    return FAM.get(f, FAM["卡片"])

def fam_extra_neg(f):
    if f in ("按钮", "主按钮"):
        return "圆角大于 6px、胶囊形、纯色无纹理、按钮内已含文字"
    if f in ("卡片", "面板", "弹窗"):
        return "栅格线、分栏线、内容区已画好、双语标题"
    if f == "进度条":
        return "刻度线、数值、圆头（大圆角）"
    if f in ("输入框", "下拉"):
        return "已输入的文本、光标、占位文字"
    return ""

# ────────────────────────── 汇总实测（族|类名）→ 专属尺寸 ──────────────────────────
V = collections.defaultdict(lambda: dict(n=0, pages=set(), w=[], h=[], rad=collections.Counter(),
                                         font=collections.Counter(), pad=collections.Counter(),
                                         border=collections.Counter(), bg=collections.Counter(),
                                         glass=0, shadow=0, state=collections.Counter(), text=""))
for pg in INV["pages"]:
    for c in pg["controls"]:
        k = (c["family"], c["cls"] or c["tag"])
        a = V[k]
        a["n"] += 1
        a["pages"].add(pg.get("skill") or pg["view"])
        a["w"].append(c["w"]); a["h"].append(c["h"])
        a["rad"][c["radius"]] += 1; a["font"][c["font"]] += 1; a["pad"][c["pad"]] += 1
        a["border"][c["border"]] += 1; a["bg"][c["bg"]] += 1
        a["glass"] += 1 if c["glass"] else 0
        a["shadow"] += 1 if c["shadow"] else 0
        if c["state"]:
            a["state"][c["state"]] += 1
        if not a["text"] and c["text"]:
            a["text"] = c["text"][:18]

def mode_size(a):
    return collections.Counter((round(w), round(h)) for w, h in zip(a["w"], a["h"])).most_common(1)[0][0]

def pagekey(p):
    return p.get("skill") or p["view"]

def pagename(p):
    k = pagekey(p)
    if p.get("skill"):
        return f"技能页·{VIEW_NAME.get(p['skill'], p['skill'])}"
    return VIEW_NAME.get(k, k)

# 出图总量（每个变体该出几张状态图之和）
TOTAL_ART = sum(len(states_of(f, c)) for (f, c) in V)
NO_ART = sum(1 for (f, c) in V if not states_of(f, c))

# 页面×族 汇总
PF = collections.defaultdict(lambda: dict(n=0, cls=collections.Counter(), sizes=collections.Counter(), state=collections.Counter()))
for pg in INV["pages"]:
    for c in pg["controls"]:
        k = (pagekey(pg), c["family"])
        a = PF[k]
        a["n"] += 1
        a["cls"][c["cls"] or c["tag"]] += 1
        a["sizes"][(round(c["w"]), round(c["h"]))] += 1
        if c["state"]:
            a["state"][c["state"]] += 1

def prompt_for(fam, cls, size, state="常态"):
    F = fam_of(fam)
    return (f"【主体】{F['subject']}｜尺寸 {size[0]}×{size[1]}px（@2x 导出 {size[0]*2}×{size[1]*2}px）\n"
            f"【材质】{F['recipe']}\n"
            f"【状态】{state}\n"
            f"【风格】{STYLE_NAME}：中国风手作器物，哑光漆面与实木质感，正投影正交视图\n"
            f"【光照】顶光偏左 15°，铜件一条 45° 高光带（宽度 = 控件高 18%），木纹不反光\n"
            f"【构图】正视图居中，控件占画面 80%，四周留 {max(8, F['slice'])}px 透明边距，背景透明\n"
            f"【输出】PNG-24 透明背景、@2x、无文字")

# ────────────────────────── 建表 ──────────────────────────
wb = Workbook()
wb.properties.creator = "Z.ai"

def sheet(name, title, headers, rows, max_width=34, min_width=8, col_start=2):
    ws = wb.create_sheet(name)
    last = col_start + len(headers) - 1
    setup_sheet(ws, title=title, last_col=last)
    for j, h in enumerate(headers, col_start):
        ws.cell(row=4, column=j, value=h)
    style_header_row(ws, row_num=4, col_start=col_start, col_end=last)
    for i, r in enumerate(rows):
        for j, v in enumerate(r, col_start):
            ws.cell(row=5 + i, column=j, value=v)
        style_data_row(ws, row_num=5 + i, col_start=col_start, col_end=last, row_index=i)
        for j in range(col_start, last + 1):
            ws.cell(row=5 + i, column=j).alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
    # ⚠️ max_width 必须按表给：提示词/说明这类长文本列若压在 34 字宽，会把行高顶到 300pt
    #    （第一版就是这样：226 行每行 262~310pt，整张表没法浏览）。长文本列给到 60~80 字宽，
    #    行高自然落到 2~4 行（40~70pt），而 auto_fit_row_heights 仍保证不裁切。
    auto_fit_columns(ws, min_width=min_width, max_width=max_width, header_row=4, data_start_row=5)
    auto_fit_row_heights(ws, header_row=4, data_start_row=5)
    return ws

# 提示词按 4 段分列（主体/材质/风格光照/构图输出）——既避免一行 300pt，也方便逐段复用
def prompt_parts(fam, size, state="常态"):
    F = fam_of(fam)
    return [
        f"{F['subject']}｜尺寸 {size[0]}×{size[1]}px（@2x 导出 {size[0]*2}×{size[1]*2}px）",
        F["recipe"],
        f"{STYLE_NAME}：中国风手作器物，哑光漆面与实木质感，正投影正交视图；顶光偏左 15°，"
        f"铜件一条 45° 高光带（宽度 = 控件高 18%），木纹不反光",
        f"正视图居中，控件占画面 80%，四周留 {max(8, F['slice'])}px 透明边距，背景透明；"
        f"PNG-24 透明背景、@2x、无文字；状态：{state}",
    ]

# ① 说明
now = datetime.date.today().isoformat()
n_ctl = len(V); n_pf = len(PF); n_pages = len(INV["pages"])
rows1 = [
    ["交付物", "《全 UI 改版规范》——中国风金属/木牌（木牌铜饰）"],
    ["版本 / 日期", f"v1 / {now}"],
    ["数据来源", "scripts/dev/ui-inventory.json（真实浏览器逐页量测：105 页 × 16 控件族，非手写）"],
    ["覆盖范围", f"{n_pages} 个页面（55 个功能页 + 38 个技能页 + 顶栏/底栏等）× 16 个控件族"],
    ["量测规模", f"实测控件 {sum(a['n'] for a in V.values())} 个 → 收敛为 {n_ctl} 个「族|类名」变体、{n_pf} 个「页面×族」组合"],
    ["量测视口", f"{INV['meta']['viewport']['width']}×{INV['meta']['viewport']['height']}（桌面端；窄屏规则见「交付与切片」表）"],
    ["提示词规模", f"控件族规范 {n_ctl} 行，每行 4 段正向（主体+尺寸 / 材质 / 风格光照 / 构图输出）+ 1 条负向 ⇒ 共 {n_ctl*4} 段正向、{n_ctl} 条负向，全部可直接复制"],
    ["出图总量", f"1:1 口径（每个变体各出各的状态）{TOTAL_ART} 张 —— **不推荐**；推荐「帧纹分离」方案只需 24 张（见「精简方案」表），另有 {NO_ART} 个变体是纯排版元素、不需要素材"],
    ["", ""],
    ["本表怎么用", "① 先读「风格总纲」定调 → ② 「Token 映射」接线（保证 15 皮肤与深色不崩）→ ③ 「控件族规范」按 226 行逐个出素材 → ④ 「页面×控件」核对每页用到哪些、多大 → ⑤ 「提示词模板」批量生成 → ⑥ 「交付与切片」交付与接入"],
    ["最重要的约束", "换皮不改版式：规范尺寸 = 现测尺寸（表 4「规范尺寸」列）。尺寸一旦改动，e2e-layout 布局守卫与 32000+ 元素扫描会立刻 FAIL，需重新核对。"],
    ["第二条硬约束", "素材必须可染色：纹理/形状导出灰度 + alpha，颜色一律走 CSS 变量 ⇒ 一张图服务 15 套皮肤 + 深色模式。烘死颜色的素材会让 15 套皮肤一起失效。"],
    ["第三条硬约束", "与现有 token 体系对接，不新增色相：木/铜/漆/纸四色的浅深两套都必须写进 main.css 的 :root 与 html[data-theme='dark']。"],
    ["", ""],
    ["分表导航", "风格总纲 / Token 映射 / 控件族规范（226 行，含专属尺寸与提示词）/ 页面×控件（930 行）/ 提示词模板 / 交付与切片"],
    ["生成脚本", "scripts/dev/build_ui_spec_xlsx.py（底表 ui-inventory.mjs 可随时重跑，量测会随改版自动更新）"],
    ["校验", "openpyxl audit + scan + validate（本表无公式 ⇒ 不需要 recalc）"],
]
sheet("说明", "全 UI 改版规范 · 说明", ["项", "内容"], rows1, max_width=90)

# ② 风格总纲
rows2 = [
    ["风格名", STYLE_NAME, "一句话：把界面从「悬浮的毛玻璃」换成「摆在案头的木牌与铜件」"],
    ["", "", ""],
    ["材质第 1 层 · 底板", "桦木（浅）／深檀（深）／朱漆·墨漆（重点）／宣纸（内容面）", "四选一，按控件重要性递增：内容面用纸、交互件用木、重点件用漆"],
    ["材质第 2 层 · 边饰", "黄铜描边 1~2px，左上亮 #E3C87A → 右下暗 #8A6D1F 线性过渡", "唯一允许的渐变（金属反射），其余一律纯色"],
    ["材质第 3 层 · 内高光", "顶部 1px 亮线 rgba(255,242,205,.55)", "统一「顶光」，让所有控件像同一张桌上的器物"],
    ["材质第 4 层 · 投影", "0 2px 0 rgba(60,40,20,.22) 硬投影（非模糊）", "器物落在桌面；只有弹窗允许模糊投影"],
    ["", "", ""],
    ["光照", "正投影（正交、零透视）、顶光偏左 15°、材质哑光不反光", "AI 生成素材时的硬性要求：凡出现斜视/透视即退回重出"],
    ["铜件高光", "45° 高光带，宽度 = 控件高度 18%，位置固定在 30% 处", "所有铜边/铜钉共用同一条高光，风格才统一"],
    ["", "", ""],
    ["色 · 桦木底", "#E8D3AE", "浅色主题的控件底板（卡片用宣纸 #F5EDDC 更浅一档）"],
    ["色 · 木纹", "#C8A97A", "横纹，透明度 45%，纹理素材走 mask 染色"],
    ["色 · 深檀", "#7A5636", "深色主题底板 / 卡片木框"],
    ["色 · 黄铜", "亮 #E3C87A / 中 #C9A227 / 暗 #8A6D1F", "描边、铜钉、包角、徽章底"],
    ["色 · 朱漆", "#9E2B25", "主按钮、表头、选中态"],
    ["色 · 鎏金", "#E8C766", "选中描边、进度填充高光、稀有强调"],
    ["色 · 宣纸", "#F5EDDC", "内容卡片底、输入框底"],
    ["色 · 墨字", "#33291F（浅底）／#F5EDDC（深底）", "正文字色（现行 NEUTRAL_900 #37352F 的近亲，避免纯黑）"],
    ["", "", ""],
    ["几何 · 圆角", "小控件 3px · 卡片/面板 6px · 弹窗 8px · 表格行 0px", "取代现行的 10 种圆角（实测 6/0/10/9/999/4/8/50%/5/14px 混用）"],
    ["几何 · 胶囊例外", "现圆角 999px 的四类控件保留胶囊：top-nav-market（107×22）· dock-pill（77×30）· effect-chip（61×18）· loadout-chip（217×23）", "它们语义是「标签/胶囊」而不是「木牌」，改成直角会让顶栏与底栏失去轻量感；其余一律按上方四档圆角"],
    ["几何 · 描边", "常态 1px 铜 · 强调 1.5~2px 鎏金 · 内凹件 1px 暗铜", "禁止 3px 以上粗描边（会像贴纸）"],
    ["几何 · 内边距", "按钮横向 10px / 纵向 4px；卡片 12px；面板 16px", "与现行实测一致（不改变版式）"],
    ["几何 · 字阶", "11 / 12 / 13 / 14px 四档，行高 1.45", "取代现行的 7 档（含 13.3333px 与 16.38px 两个非整数值）"],
    ["", "", ""],
    ["状态 · 常态", "木纹 100%、铜边 1px、硬投影 0 2px 0", "基准"],
    ["状态 · 悬停", "上移 1px、投影 0 3px 0、铜边亮度 +8%、木纹亮度 +6%", "用位移表达「被手指按住前的抬升」"],
    ["状态 · 按下", "下移 1px、投影压平 0 1px 0、内阴影 0 1px 2px rgba(0,0,0,.25)、铜边暗 10%", "位移量必须与悬停反向，手感才成立"],
    ["状态 · 禁用", "去饱和 60% + 不透明度 .55 + 移除投影，保留纹理", "不许只降 opacity：文字会看不清（现行禁用态就偏浅）"],
    ["状态 · 选中/开启", "底板换漆面 + 鎏金描边 1.5px + 左上/右上铜钉各一颗 3px", "页签选中、开关开启、列表选中统一用这一套"],
    ["状态 · 锁定", "亚麻斜纹蒙层（45°、alpha .28）+ 中部挂锁位", "替换现行的 🔒 emoji 角标（但 emoji 可保留在文字里）"],
    ["", "", ""],
    ["动效", "位移 120ms ease-out；铜色亮度 160ms；禁用「缩放」与「旋转」", "器物不缩放（缩放属于玻璃/卡片语言）"],
    ["", "", ""],
    ["现状问题（实测）", "3573 个控件里圆角有 10 种、字号 7 种、控件高度 12 档、58% 带毛玻璃", "证据：ui-inventory.json。统一的目标就是把这张表收敛到「4 圆角 / 4 字阶 / 4 材质」"],
    ["现状问题（实测）", "近似白底色写了 6 遍：rgba(255,252,246,.3/.85/.86)、rgba(255,251,244,.86) 等", "同一层玻璃用了 4 个几乎相同的白 —— 统一后只留 2 个（纸面 / 纸面-深色），全部走 token"],
    ["现状问题（实测）", "毛玻璃覆盖 58% 控件但强度不一（backdrop-filter 从 6px 到 20px）", "新风格只在「弹窗」一处保留模糊（纸背透光），其余改为不透明材质，顺带降低渲染成本"],
    ["", "", ""],
    ["🔴 皮肤硬约束", "15 套皮肤 + 深色模式靠 CSS 变量换色", "任何素材不得烘死颜色：纹理与形状走 mask（灰度当遮罩）+ background-color: var(--x)"],
    ["🔴 深色硬约束", "每个新 token 必须浅深两套都定义", "只写 :root 会深色下回落到浅色值（本项目已踩过 --warn-soft 这一坑）"],
    ["🔴 构建硬约束", "构建期 CSS 压缩器会改写规则（lightningcss）", "新样式写完后必须跑 css_output_audit.mjs，确认毛玻璃/边框在 dist 里没被改写"],
]
sheet("风格总纲", f"风格总纲 · {STYLE_NAME}", ["项", "规范", "说明 / 理由"], rows2, max_width=70)

# ③ Token 映射
def newval(tok):
    m = {
        "--primary": ("木牌主色 → 朱漆", "#9E2B25", "#C0392B", "主按钮底、选中态底、强调文字"),
        "--primary-rgb": ("同上三元组（给 rgba() 用）", "158, 43, 37", "192, 57, 43", "任何 rgba(var(--primary-rgb), α) 都读它"),
        "--primary-soft": ("浅木底", "#F0DFC0", "#4A3A2A", "次要按钮底、标签底"),
        "--primary-strong": ("深木色（文字用）", "#7A3B2E", "#E8C766", "浅底上的强调文字"),
        "--border": ("木/铜分隔线", "rgba(122, 86, 54, .38)", "rgba(227, 200, 122, .28)", "分隔线与描边（原来偏灰，改成木棕）"),
        "--glass-rgb": ("纸面三元组（沿用同名，语义改为「纸」）", "255, 252, 246", "42, 35, 32", "纸面底色的 alpha 基座"),
        "--muted": ("次要字色（墨的浅色）", "#7A6A56", "#B9A98E", "副标题、说明文字"),
        "--good-soft / --good-strong": ("青釉（成功）", "#DCEBD8 / #2F6B3A", "#31402F / #9BD3A0", "成功态、已完成徽章"),
        "--warn-soft / --warn-strong": ("铜锈（警告）", "#F3E3C2 / #8A6D1F", "#3D2C14 / #E3C87A", "警告徽章、低目标减半标签"),
        "--tint-rgb": ("木色三元组（给 rgba 用）", "122, 86, 54", "200, 169, 122", "浅蒙层、锁定底"),
    }
    return m.get(tok, ("沿用现语义 + 材质化", LIGHT.get(tok, "—"), DARK.get(tok, "—"), "保持同名，只换取值"))

rows3 = []
for tok in sorted(set(list(LIGHT.keys()) + ["--primary", "--primary-rgb", "--primary-soft", "--primary-strong", "--border", "--glass-rgb", "--muted", "--good-soft", "--good-strong", "--warn-soft", "--warn-strong", "--tint-rgb"])):
    if tok.startswith("--skin") or tok in ("--shadow",):
        continue
    sem, light, dark, use = newval(tok)
    rows3.append([tok, LIGHT.get(tok, "—"), sem, light, dark, use])
rows3 += [
    ["（新增）--wood-base / --wood-grain", "—", "木牌底板与纹理色", "#E8D3AE / #C8A97A", "#4A3A2A / #6B5A45", "木牌控件底、木纹 mask 的着色源"],
    ["（新增）--brass / --brass-dim", "—", "黄铜描边两档", "#C9A227 / #8A6D1F", "#D9B657 / #9A7B2A", "所有描边、铜钉、包角"],
    ["（新增）--lacquer / --gilt", "—", "朱漆与鎏金", "#9E2B25 / #E8C766", "#B23A2E / #F0D68A", "主按钮、选中态、稀有强调"],
    ["（新增）--paper / --paper-ink", "—", "宣纸面与纸上墨字", "#F5EDDC / #33291F", "#2A2320 / #F5EDDC", "内容卡面、正文色"],
    ["（新增）--plaque-shadow", "—", "硬投影（器物落桌）", "0 2px 0 rgba(60,40,20,.22)", "0 2px 0 rgba(0,0,0,.45)", "统一投影，替代现有 4 种模糊阴影"],
]
sheet("Token 映射", "Token 映射 · 旧变量 → 新材质（15 皮肤与深色都必须跟着改）",
      ["现有 CSS 变量", "现值（浅色）", "新风格语义", "新取值（浅色）", "新取值（深色）", "用途 / 注意"], rows3, max_width=56)

# ④ 控件族规范（226 行）
rows4 = []
for i, ((fam, cls), a) in enumerate(sorted(V.items(), key=lambda kv: (-len(kv[1]["pages"]), kv[0][0], kv[0][1])), 1):
    F = fam_of(fam)
    w, h = mode_size(a)
    ws_ = sorted({round(x) for x in a["w"]})
    hs_ = sorted({round(x) for x in a["h"]})
    rng = f"{min(ws_)}~{max(ws_)}×{min(hs_)}~{max(hs_)}"
    r0 = a["rad"].most_common(1)[0][0]
    f0 = a["font"].most_common(1)[0][0]
    p0 = a["pad"].most_common(1)[0][0]
    b0 = a["border"].most_common(1)[0][0]
    st_list = states_of(fam, cls)
    states = " / ".join(st_list) if st_list else "—（纯排版，无素材）"
    slice_ = F["slice"]
    rows4.append([
        i, fam, cls, len(a["pages"]), a["n"],
        f"{w}×{h}", rng, r0, f0, p0, f"{r0} → {F['radius']}px",
        f"{w*2}×{h*2}", slice_, f"{slice_}/{slice_}/{slice_}/{slice_}",
        len(st_list), states,
        F["recipe"],
        *prompt_parts(fam, (w, h)),   # 提示词分 4 列（主体 / 材质 / 风格光照 / 构图输出）
        NEG + ("；" + fam_extra_neg(fam) if fam_extra_neg(fam) else ""),
        f"{'毛玻璃' if a['glass'] > a['n'] / 2 else '实色'}（现）→ {F['radius']}px 圆角 + {'纸面' if fam in ('卡片','面板','弹窗','输入框','下拉') else '木牌' if fam in ('按钮','图标按钮','页签','复选框') else '铜件' if fam == '徽章' else '竹简' if fam == '表格' else '—'}",
        a["text"] or "",
    ])
sheet("控件族规范", "控件族规范 · 每个变体的专属尺寸与素材提示词（226 个变体）",
      ["#", "族", "变体类名", "出现页数", "实例数", "实测尺寸（常见）", "实测尺寸范围", "现圆角", "现字号", "现内边距",
       "圆角 → 新", "导出尺寸 @2x", "9-slice 边距(px)", "slice 四边", "出图张数", "状态图清单", "材质配方（四层叠加）",
       "提示词·① 主体+尺寸", "提示词·② 材质", "提示词·③ 风格与光照", "提示词·④ 构图与输出（含状态句）",
       "负向提示词", "材质归属（现→新）", "代表文案"], rows4, max_width=60)

# ⑤ 页面×控件（930 行）
rows5 = []
LAY = {pagekey(p): p.get("layout", {}) for p in INV["pages"]}
for (page, fam), a in sorted(PF.items(), key=lambda kv: (kv[0][0], kv[0][1])):
    F = fam_of(fam)
    top = a["sizes"].most_common(2)
    sz = " ；".join(f"{w}×{h}（{n} 个）" for (w, h), n in top)
    rng_w = f"{min(w for w, _ in a['sizes'])}~{max(w for w, _ in a['sizes'])}"
    lay = LAY.get(page, {})
    g = lay.get("grid", {}) or {}
    note = ""
    if g.get("cols"):
        note = f"网格 {g['cols']} 列 · 单卡 {g.get('cardW')}×{g.get('cardH')}"
    elif fam == "面板" and lay.get("mainW"):
        note = f"主内容区宽 {lay['mainW']}"
    rows5.append([
        pagename({"view": page}) if not page.startswith("skill") else f"技能页·{VIEW_NAME.get(page, page)}",
        page, fam, a["n"], " / ".join(c for c, _ in a["cls"].most_common(2)),
        sz, f"{rng_w}px 区间", " / ".join(s for s, _ in a["state"].most_common(3)) or "常态",
        F["radius"], note,
    ])
sheet("页面×控件", "页面 × 控件清单（每页用到哪些控件族、各多大）",
      ["页面", "视图 key / 技能 id", "控件族", "该页数量", "代表类名", "实测尺寸（最常见的两档）", "宽度区间", "状态", "新圆角", "页面布局备注"], rows5, max_width=52)

# ⑥ 提示词模板
rows6 = [
    ["结构模板", "【主体】…｜【材质】…｜【状态】…｜【风格】…｜【光照】…｜【构图】…｜【输出】…", "七段固定顺序；同族只改「尺寸」与「状态」两个变量，其余原样复制 ⇒ 整套素材风格才一致"],
    ["变量 1 · 尺寸", "控件实测宽×高（表 4「实测尺寸」列）；导出写 @2x（×2）", "别改尺寸去适配素材 —— 素材适配尺寸"],
    ["变量 2 · 状态", "常态 / 悬停 / 按下 / 禁用 / 选中 / 锁定", "六态都出；悬停与按下是同一素材的位移 + 亮度差，可只出常态再用 CSS 变换（省 2 张图）"],
    ["变量 3 · 材质", "取表 4「材质配方」列，同族固定", "换族才换材质，不要每个按钮单独描述材质"],
    ["变量 4 · 边距", "透明边距 = 9-slice 边距", "边距不够时九宫格拉伸会出现铜边断裂"],
    ["", "", ""],
    ["状态追加句 · 用法", "把 ④ 段末尾的「状态：常态」替换成下表任一句，即可得到该状态的出图提示词", "其余三段不动；同族同状态必须用**同一随机种子**，否则木纹密度不一致（同屏会看出拼接感）"],
    ["状态追加句 · 常态", "状态：常态 —— 完整、干净、无任何交互痕迹", "最基础的底座，其余状态都从它派生"],
    ["状态追加句 · 悬停", "状态：悬停 —— 整体上移 1px，投影加深为 0 3px 0，铜边亮度 +8%，木纹亮度 +6%，其余同常态", "靠位移表达「手指按上去之前」的抬升"],
    ["状态追加句 · 按下", "状态：按下 —— 整体下沉 1px，投影压平为 0 1px 0，铜边变暗 10%，内阴影 0 1px 2px rgba(0,0,0,.25)", "位移方向必须与悬停相反，手感才成立"],
    ["状态追加句 · 禁用", "状态：禁用 —— 去饱和 60%、不透明度 55%，移除投影，但保留木纹与铜边轮廓（不要整片发白）", "现行禁用态偏浅到看不清字，这次明确要求保留轮廓"],
    ["状态追加句 · 选中", "状态：选中/开启 —— 底板换漆面（朱漆或墨漆），描边改鎏金 1.5px，左上与右上各加一颗 3px 铜钉", "页签选中、开关开启、列表选中统一用这一套"],
    ["状态追加句 · 锁定", "状态：锁定 —— 表面蒙一层 45° 亚麻斜纹（alpha 28%），中部留出挂锁位，木纹仍可见", "替换现行的 🔒 角标（文字里的 emoji 可保留）"],
    ["", "", ""],
    ["参数建议", "采样：DPM++ 2M Karras / 步数 28~32 / CFG 6~7 / 尺寸 = 导出尺寸（不要依赖放大）", "国风材质对 CFG 敏感：>8 会出描边硬边与过饱和"],
    ["参数建议", "构图固定「正视图 / 居中 / 占画面 80%」", "同一族的素材必须由同一组参数产出，否则木纹密度会不一致"],
    ["参数建议", "同一批只改提示词的「尺寸/状态」两处，种子固定", "种子变化会让木纹随机 ⇒ 同屏控件纹理互斥"],
    ["", "", ""],
    ["示例 1 · 小按钮（常态）", prompt_for("按钮", "btn btn-sm", (70, 24)), "表 4 中 269 个 btn-sm 实例可直接用这一条"],
    ["示例 2 · 小按钮（按下）", prompt_for("按钮", "btn btn-sm", (70, 24), "按下：整体下沉 1px、铜边变暗、投影压平"), "与常态同种子，仅按提示词描述状态差异"],
    ["示例 3 · 主按钮（朱漆）", prompt_for("主按钮", "btn btn-primary", (216, 31)), "全站唯一允许的大面积朱漆 + 鎏金"],
    ["示例 4 · 卡片（宣纸木框）", prompt_for("卡片", "gather-card", (214, 331)), "目标卡/配方卡共用；大卡四角加铜包角"],
    ["示例 5 · 面板（漆器大板）", prompt_for("面板", "app-sidebar", (250, 900)), "左栏、右栏抽屉、底部胶囊面板共用"],
    ["示例 6 · 弹窗框", prompt_for("弹窗", "modal-card", (520, 360)), "唯一允许模糊投影与纸背透光的一层"],
    ["示例 7 · 进度条槽", prompt_for("进度条", "progress-bar", (220, 8)), "槽与填充分开出：槽 1 张 + 填充 1 张（填充可用纯色 + 高光条）"],
    ["示例 8 · 页签（选中）", prompt_for("页签", "sidebar-tab", (75, 29), "选中：实木底 + 鎏金描边 + 左右各一颗铜钉"), "侧栏 38+ 个页签共用这一张"],
    ["", "", ""],
    ["批量生成顺序", "① 页签 → ② 按钮（常态/悬停/按下/禁用）→ ③ 徽章 → ④ 进度条 → ⑤ 输入/下拉/复选 → ⑥ 卡片 → ⑦ 面板 → ⑧ 弹窗", "从共用最广的元件开始，风格最容易稳住"],
    ["验收一图流", "把 8 类素材拼成一张对照图（同台面、同光照），肉眼确认：木纹密度一致、铜色一致、投影方向一致", "任何一张与其余不一致 ⇒ 只重出那一张，不要整套重跑"],
]
sheet("提示词模板", "提示词模板（给 AI 绘图；同族只改尺寸与状态）",
      ["项", "内容 / 可直接复制的提示词", "说明"], rows6, max_width=95)

# ⑦ 交付与切片
rows7 = [
    ["目录结构", "public/images/ui/{tabs,btn,icon-btn,badge,progress,input,check,card,panel,modal,table,log}/", "按族分目录，与表 4 的「族」列一一对应"],
    ["命名规则", "<族>_<变体>_<状态>_<宽>x<高>@2x[_mask].png 例：btn/plaque_normal_140x48@2x_mask.png", "mask 后缀 = 灰度遮罩版（供染色）"],
    ["导出格式", "PNG-24 + alpha，@2x；单张 ≤ 40KB（木纹用 256×256 可平铺贴图，别整块大图）", "体积直接进 exe 包（当前附件 213MB），纹理必须可平铺复用"],
    ["染色方案", "纹理/高光/阴影层 → 灰度 + alpha，CSS 上色：mask-image: url(...); background-color: var(--wood-base)", "一张图服务 15 皮肤 + 深色模式，这是唯一可持续的做法"],
    ["彩色件", "只有「黄铜」与「朱漆」两处允许带本色：导出 3 档明度（亮/中/暗），用 --brass / --lacquer 三值切换", "其余一律去色"],
    ["9-slice 参数", "CSS: border-image-source: url(…); border-image-slice: {N} fill; border-image-width: {N}px; border-image-repeat: stretch;", "{N} 取表 4「9-slice 边距」列；`fill` 必须有，否则中间会被清空"],
    ["窄屏（390px）规则", "同族素材复用；仅「卡片网格」由 5 列 → 2 列，「面板」改为抽屉；控件尺寸不变", "e2e-layout 在 390px 会扫 103 页，改版后必须重跑"],
    ["深色模式", "同一套素材 + 深色 token；木纹不变、铜色提亮 12%、纸面换墨色", "不许为深色单独出一套素材（维护会崩）"],
    ["", ""],
    ["接入顺序（建议 7 步）", "① 落 token（浅深两套 + 15 皮肤映射）→ ② CSS 四件套基类（.ui-plaque / .ui-paper / .ui-brass）→ ③ 页签 → ④ 按钮 → ⑤ 徽章/进度 → ⑥ 卡片/面板 → ⑦ 弹窗与表格", "每步跑一次守卫，别攒到最后一起改"],
    ["每步必须跑的守卫", "node scripts/ci/css_output_audit.mjs（构建期 CSS 压缩会改写规则）· npx playwright test e2e-layout.spec.mjs（裁切/竖排）· e2e-dark.spec.mjs（5 皮肤 × 浅深对比度）· e2e-text.spec.mjs（标记裸露）", "四条里任何一条红都别继续下一步"],
    ["禁止事项", "① 素材烘死颜色 ② 只写 :root 不写深色 ③ 用 !important 覆盖 ④ 改控件尺寸 ⑤ 新增第 5 种圆角/字阶 ⑥ 直接改 public/images/items（物品图不在本次范围）", "第 ⑥ 条：物品图 2427 张 + 立绘另有一套规范，别混进来"],
    ["", ""],
    ["验收清单 1", "规格：每种控件都能在表 4 找到「尺寸 + 材质 + 提示词」三件套，且实际素材与规范一致", "抽 8 类逐项对表"],
    ["验收清单 2", "一致性：同屏不出现两种木纹密度、两种铜色、两种投影方向", "拼对照图看"],
    ["验收清单 3", "皮肤：15 套皮肤 × 浅深 = 30 种组合下，控件文字对比度 ≥ 4.5:1（e2e-dark 的判据）", "皮肤越花越容易出事，务必逐皮肤跑"],
    ["验收清单 4", "功能：无被裁控件、无逐字竖排、无标记裸露、构建产物与源码一致", "四条守卫全绿"],
    ["验收清单 5", "性能：每页素材请求数与新增长度记一笔（纹理要可平铺、要缓存）", "建议改版前后各量一次首屏"],
    ["", ""],
    ["范围说明", "本次只换「外壳」：按钮/卡片/面板/框/进度条/页签/徽章/输入/表格/日志。不含：物品图 2427 张、立绘 248 张、小游戏内部画面、山海食经画布", "那三块各有独立规范，另立交付"],
]
sheet("交付与切片", "交付、切片与接入规范", ["项", "内容", "说明"], rows7, max_width=95)

if "Sheet" in wb.sheetnames:
    wb.remove(wb["Sheet"])  # 去掉 openpyxl 自动建的空白首表

# ⑧ 精简方案（870 → 24 张）
ART = [
    ["FRAME_WOOD", "小木牌帧（浅桦木 + 铜边 1px + 顶内高光）", "小木牌", "20 个变体：按钮 / 图标按钮 / 页签 / 复选框", "200×48", "6px", "常态", "最常见的交互件；宽度靠 border-image 横向拉伸覆盖，不用逐尺寸出图"],
    ["FRAME_LACQUER", "漆牌帧（朱漆 + 鎏金边）", "漆牌", "3 个变体：主按钮全族", "240×64", "6px", "常态", "全站唯一大面积朱漆，必须独立出（材质不同不能与小木牌互代）"],
    ["FRAME_BRASS", "铜牌帧（哑光铜 + 内凹字位）", "铜牌", "35 个变体：全部徽章 / 状态片 / 标签", "140×44", "4px", "常态", "边距给小（4px）是为了让 16~22px 高的小徽章也不失真"],
    ["FRAME_PAPER_SLOT", "纸槽帧（内凹纸面 + 铜边）", "纸槽", "23 个变体：输入框 / 下拉 / 物品图底座", "360×52", "6px", "常态", "聚焦态不单独出图，用 CSS 把铜边换鎏金"],
    ["FRAME_COPPER_GROOVE", "铜槽帧（内凹暗铜）", "铜槽", "8 个变体：进度槽 / 分段槽", "448×36", "4px", "常态", "槽本身没有状态，填充另算"],
    ["FRAME_BAMBOO", "竹简条帧", "竹简", "1~2 个变体：表格行 / 日志行变体", "400×44", "6px", "常态", "行数多但材质一致，一张足够"],
    ["FRAME_PAPER_CARD", "宣纸卡帧（纸面 + 深檀木框 4px）", "宣纸木框", "117 个变体：所有卡片类（含目标卡 / 配方卡 / 面板条目）", "480×160", "12px", "常态", "覆盖面最大的一张；9-slice 让 214×331 与 1148×802 共用同一素材"],
    ["FRAME_LACQUER_PANEL", "漆板帧（大面板 + 四角铜包角）", "漆板", "9 个变体：左栏 / 右栏抽屉 / 底栏胶囊面板", "520×120", "16px", "常态", "边距大，因为铜包角必须整块保留、不能被拉伸"],
    ["FRAME_MODAL", "弹窗框（漆板 + 顶部铜横档 + 重投影）", "漆板", "1 类：所有弹窗", "560×400", "24px", "常态", "唯一允许模糊投影的一层；横档必须独立成帧，不能与漆板共代"],
    ["STATE_TAB_ON", "页签选中帧（实木底 + 鎏金边 + 左右铜钉）", "小木牌", "页签选中态", "200×48", "6px", "选中", "选中是玩家最需要一眼看到的反馈，值得一张专图"],
    ["STATE_SWITCH_ON", "开关开启帧（漆面 + 铜钉）", "漆牌", "开关 / 复选框选中态", "120×40", "6px", "选中", "与页签选中同一套语言，但底色是漆面"],
    ["STATE_DISABLED", "禁用蒙层（半透明灰罩，全族复用）", "通用", "226 个变体的禁用态", "64×64", "32px", "禁用", "🔴 一张蒙层替代 226 张禁用图：CSS 叠一层即可，且能保证禁用观感统一"],
    ["TEX_WOOD", "木纹平铺（横纹）", "通用纹理", "所有木牌 / 卡片面", "256×256", "可平铺", "—", "用 background-repeat，不要拉伸：平铺才能保证木纹密度一致"],
    ["TEX_PAPER", "纸纤维平铺（极淡）", "通用纹理", "卡片面 / 输入框面", "256×256", "可平铺", "—", "同上"],
    ["TEX_BAMBOO", "竹纹平铺（斑竹）", "通用纹理", "表格行 / 日志行", "256×256", "可平铺", "—", "同上"],
    ["TEX_BRASS", "铜拉丝平铺", "通用纹理", "所有铜件高光带", "128×128", "可平铺", "—", "铜的高光方向必须全站一致，用同一张"],
    ["PART_NAIL", "铜钉", "配件", "选中态点缀", "16×16", "—", "—", "8×8 的圆钉 + 高光"],
    ["PART_CORNER", "铜包角", "配件", "大卡 / 面板 / 弹窗四角", "48×48", "—", "—", "24×24 的 L 形包角，四个角靠 CSS rotate 复用同一张"],
    ["PART_ARROW", "下拉箭头", "配件", "所有下拉框", "40×24", "—", "—", "不烘进底板，换皮肤时也能单独换"],
    ["PART_LOCK", "挂锁", "配件", "锁定态", "48×48", "—", "—", "替换现有 🔒 角标"],
    ["PART_CHECK", "勾选勾", "配件", "复选框 / 任务列表", "28×28", "—", "—", "笔画要粗到 16px 下不糊"],
    ["BAR_FILL", "进度填充条（釉面 + 顶部高光）", "铜槽", "所有进度 / 血 / 经验条填充", "8×8", "可平铺", "—", "只有 8px 高，直接一张 1px 宽的横条横向平铺最省"],
    ["TINY_CHECK", "复选小件（16×16 精确图）", "配件", "复选框本体", "32×32", "—", "常态", "小于 20px 的控件用 9-slice 会让铜边比例失真，出精确图"],
    ["TINY_ICONBTN", "图标小片（16×17 精确图）", "小木牌", "顶栏图标按钮 / 状态片图标", "34×34", "—", "常态", "同上；这类共 2 个变体，不值得为它调基材边距"],
]

rows8 = [
    ["问题", "按 226 个变体 1:1 出图是 870 张 —— 其中大量是「同材质、只差尺寸/状态」的重复", "实测：226 变体只对应 36 组「基材 × 高度档」，而宽度本来就该由 9-slice 拉伸解决"],
    ["", "", ""],
    ["方案 A（1:1）", "870 张", "226 变体 × 各自状态全出。好处：每一处都能单独微调。代价：工作量 33 倍，且同材质控件之间会出现细微不一致（反而与「统一风格」的目标相反）"],
    ["方案 B（档位归并）", "144 张（全状态）/ 72 张（常态+禁用）/ 36 张（只出常态）", "宽度交给 9-slice、高度归到 9 档、同材质合并。仍为每个尺寸档出图"],
    ["方案 C（帧纹分离，推荐）", "24 张", "① 基材帧 8 张（9-slice 拉伸覆盖所有尺寸）② 状态件 4 张（选中×2 / 禁用蒙层 / 弹窗）③ 平铺纹理 4 张（木/纸/竹/铜）④ 配件 5 张（铜钉/包角/箭头/挂锁/勾）⑤ 极小组件 2 张精确图 ⑥ 进度填充 1 张"],
    ["", "", ""],
    ["方案 C 的三个关键杠杆", "① 宽度交给 border-image 横向拉伸（木纹是横纹，横向拉伸只改变线的长度、不改变间距 ⇒ 看不出来）", "这是最大的一笔省：原本 226 个变体里有 100+ 只是宽度不同"],
    ["", "② 悬停 / 按下改用 CSS（transform: translateY ±1px + filter: brightness），不出图", "省掉每族 2 张；且手感参数集中在 CSS，一处改、全站生效"],
    ["", "③ 禁用态用**一张半透明灰罩**全族复用，而不是每个控件出一张禁用图", "省 226 张 → 1 张，且禁用观感天然统一"],
    ["", "", ""],
    ["🔴 什么不能合", "① 八种基材之间不能互代（木/漆/铜/纸/槽/竹/卡/板 材质不同）② 主按钮的朱漆必须独立 ③ 页签选中与开关开启各需一张（铜钉位置不同）④ 弹窗多一条铜横档 ⑤ 高 <20px 的控件仍需 2 张精确小图（9-slice 会让铜边比例失真）", "这些是「合并后会看出错」的清单，别为了省图把它们也合掉"],
    ["🔴 条形类不出图", "8~18px 高的进度条 / 血条 / 经验条：内凹槽与釉面填充用纯 CSS（内阴影 + 圆角 + 渐变）实现，0 素材", "实测这类共 12 个变体、最高只有 18px —— 这个高度上看不出铜边，出图是浪费"],
    ["", "", ""],
    ["推荐执行顺序", "先出 4 张定调：FRAME_WOOD（小木牌）· FRAME_PAPER_CARD（宣纸卡）· TEX_WOOD（木纹）· PART_NAIL（铜钉）⇒ 拼一张对照图确认风格 ⇒ 再批量出剩余 20 张", "24 张的工作量下，先定调用例的成本几乎为零；比 870 张全做完才发现方向不对稳得多"],
    ["落地注意", "素材是【帧】（9-slice，带铜边与内高光）+【纹理】（平铺）两层叠加，所以 CSS 里每个控件是 background-image 两张：先平铺纹理、再 border-image 帧", "顺序不能反：帧必须在上层，否则铜边会被纹理盖住"],
]

sheet("精简方案", "出图精简方案（870 张 → 24 张）", ["项", "做法 / 数量", "说明"], rows8, max_width=70)
sheet("素材清单 24 张", "推荐方案的完整素材清单（24 张；每张覆盖多少变体来自实测）",
      ["素材 ID", "素材名", "基材", "覆盖范围（实测）", "素材尺寸 @2x", "9-slice 边距", "需要出的状态", "为什么这样定 / 注意"], ART, max_width=66)

wb.save(OUT)
print("saved:", OUT)
print(f"sheets: {wb.sheetnames}")
print(f"rows: 说明 {len(rows1)} · 风格总纲 {len(rows2)} · Token {len(rows3)} · 控件族 {len(rows4)} · 页面×控件 {len(rows5)} · 提示词 {len(rows6)} · 交付 {len(rows7)}")
