# -*- coding: utf-8 -*-
"""生成《全 UI 改版规范（纸白食印 · 新中式 + 美食元素·中等档）》Excel。

数据来源（全部实测，不是手写）：scripts/dev/ui-inventory.json
  —— 逐页（105 页）用真实浏览器枚举控件族，记录每个控件的实测几何（宽×高）与
     计算样式（圆角/描边/内边距/字号/底色/阴影/毛玻璃/状态），共 3573 个控件行。
收敛结果：226 个「族|类名」变体（表 4：专属尺寸 + CSS 实现要点）、930 个「页面×族」组合（表 5）。

核心结论（与已被否掉的 v0「木牌铜饰」最大的不同）：
  扁平纸面 = border + border-radius + box-shadow + linear-gradient ⇒ **0 张位图、0 个九宫格**，
  只需 12 个内联 SVG 当美食元素装饰，且全部 currentColor 染色（15 皮肤自动跟随）。
用法：python scripts/dev/build_ui_spec_xlsx.py
"""
import json, re, os, sys, collections, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
XLSX_SKILL_DIR = os.environ.get("XLSX_SKILL_DIR") or r"C:\Users\xin'si\.zcode\cli\plugins\cache\zcode-plugins-official\spreadsheets\0.1.7\skills\xlsx"
sys.path.insert(0, os.path.join(XLSX_SKILL_DIR, "templates"))
sys.path.insert(0, XLSX_SKILL_DIR)  # base.py 内部会 `from templates.palettes import ...`
import base as B  # noqa
from base import *  # noqa
from openpyxl import Workbook
from openpyxl.styles import Alignment

# ⚠️ 不能调 use_palette_explicit("aesop")：palettes.py 用了 PEP 604（需 Python ≥3.10），本机 3.9。
#    等价做法：直接覆盖模块常量（base.py 的工厂在调用时读全局）。取「纸白食印」的墨色做主色。
B.PRIMARY = "2B2622"
B.PRIMARY_LIGHT = "EFE7DA"
B.SECONDARY = "EFE7DA"
B.HEADER_TEXT = "FBF7F0"

INV = json.load(open(os.path.join(ROOT, "scripts/dev/ui-inventory.json"), encoding="utf-8"))
OUT = os.path.join(ROOT, "docs", "UI改版规范_纸白食印_v1.xlsx")
STYLE_NAME = "纸白食印 · 新中式（美食元素·中等档）"

# ────────────────────────── 页面中文名（从数据模块抽，别手抄）──────────────────────────
fg = open(os.path.join(ROOT, "src/game/data/featureGroups.js"), encoding="utf-8").read()
VIEW_NAME = {v: n for n, v in re.findall(r"name: '([^']+)',\s*\n?\s*view: '([A-Za-z]+)'", fg)}
sk = open(os.path.join(ROOT, "src/game/data/skills.js"), encoding="utf-8").read()
for sid, nm in re.findall(r"(\w+):\s*\{\s*\n?\s*name: '([^']+)'", sk):
    VIEW_NAME.setdefault(sid, nm)

# ────────────────────────── 现行 CSS 变量（表 3 底表）──────────────────────────
css = open(os.path.join(ROOT, "src/styles/main.css"), encoding="utf-8").read()
def tokens_in(head):
    i = css.index(head)
    return dict(re.findall(r"(--[\w-]+):\s*([^;]+);", css[i:css.index("}", i)]))
LIGHT, DARK = tokens_in(":root {"), tokens_in("html[data-theme='dark']")

# ────────────────────────── 控件族 → CSS 要点 / 美食元素 / 状态 / 提示词 ──────────────────────────
FAM = {
    "按钮": dict(
        css="border:1px solid var(--copper); background:var(--paper-lift); border-radius:3px; box-shadow:var(--shade-soft)；悬停→底色 #fff + 线色加深 8%；按下→底色 #F3EDE3 + 去投影",
        food="—（按钮不挂装饰，靠颜色区分主次）",
        subject="圆角矩形扁平纸面按钮，1px 细描边，无文字无图标，纯色背景",
        extra_neg="圆角大于 6px、拟物高光、木纹或金属质感、按钮内已含文字",
        slice=8, radius=3),
    "主按钮": dict(
        css="background:var(--vermilion); color:#FFF8F2; border-radius:3px; box-shadow:0 2px 6px rgba(166,55,31,.18)；左侧 8px 处预留 18×18 食印位",
        food="食印（碗 / 锅 / 茶壶，按功能线选一枚）",
        subject="圆角矩形扁平实心按钮（朱红 #A6371F），无文字，纯色背景",
        extra_neg="渐变、描边、拟物高光；朱红以外的任何颜色",
        slice=8, radius=3),
    "图标按钮": dict(
        css="同按钮，尺寸更方；内部留 2px 呼吸位；图标用线稿 SVG（1.8px 笔锋）",
        food="—",
        subject="小型方形扁平纸面按钮，1px 细描边，无符号，纯色背景",
        extra_neg="圆角大于 4px、填充底、拟物高光",
        slice=8, radius=3),
    "页签": dict(
        css="常态：transparent 底 + var(--ink-sub) 字；选中：var(--paper-lift) 底 + 1px var(--copper) + var(--vermilion) 字 + 左侧 2px 朱红竖标（border-left）",
        food="选中态可挂长食印（筷）当「菜单签」",
        subject="圆角矩形页签底（纸面白底、1px 细描边、左端 2px 竖条位），无文字",
        extra_neg="木牌/铜牌质感、厚边框、倒角装饰",
        slice=8, radius=3),
    "卡片": dict(
        css="background:#fff; border:1px solid #EBE3D6; border-radius:4px; box-shadow:var(--shade-soft)；右下角叠加 6% 不透明水印 SVG",
        food="餐具水印（餐盘 / 蒸笼 / 筷架，6% 不透明，右下角）",
        subject="圆角矩形纸卡（纯白纸面、极淡 1px 描边），右下角一枚 6% 透明度的餐具线稿水印，卡内留白无内容",
        extra_neg="木纹、纸张褶皱、栅格线、内容区已画好；水印超过 10% 不透明度",
        slice=12, radius=4),
    "面板": dict(
        css="background:var(--paper); border:1px solid var(--copper); border-radius:6px；顶部一条蒸气曲线（SVG，宽自适应，preserveAspectRatio=none）",
        food="蒸气曲线（面板顶部，55% 不透明）",
        subject="大块纸面面板，1px 细描边，顶部一条极淡的曲线装饰，无内容",
        extra_neg="木纹、拟物镶边、双描边、多重投影",
        slice=16, radius=6),
    "弹窗": dict(
        css="background:#fff; border:1px solid var(--copper); border-radius:6px; box-shadow:0 10px 30px rgba(60,45,30,.14) + backdrop-filter:blur(8px)（全站唯一保留的一层模糊）；顶部一条 2px 朱红短横",
        food="蒸气曲线或食印（二选一，放台头）",
        subject="居中纸面弹窗，1px 细描边，顶部一条短朱红横条，无内容",
        extra_neg="重阴影堆叠、玻璃彩虹、边框发光",
        slice=20, radius=6),
    "徽章": dict(
        css="background:var(--primary-soft); color:#7A5B2E; border-radius:3px；无描边无投影",
        food="—（徽章太小，不挂装饰）",
        subject="小圆角标签块（淡米色底 #EFE7DA），无描边，无文字",
        extra_neg="描边、投影、渐变、圆角大于 4px",
        slice=6, radius=3),
    "进度条": dict(
        css="槽：background:#EDE6DA + inset 0 1px 2px rgba(120,80,40,.18) + 圆角 4px；填充：linear-gradient(90deg,#C24A2A,#E08A3C) + inset 0 1px 0 rgba(255,240,220,.75)",
        food="汤汁渐变（液体感由渐变承担，不加装饰）",
        subject="极扁长条进度槽（淡米底、内凹），两端 4px 圆角，无刻度无文字",
        extra_neg="刻度线、数值、圆角大于 4px、金属或木纹质感",
        slice=6, radius=4),
    "输入框": dict(
        css="background:#fff; border:1px solid var(--copper); border-radius:3px；聚焦：border-color var(--vermilion) + box-shadow 0 0 0 2px rgba(166,55,31,.12)",
        food="—",
        subject="圆角矩形扁平输入框（纯白纸面、1px 细描边），无文字无光标",
        extra_neg="内阴影、拟物凹槽、渐变底",
        slice=8, radius=3),
    "下拉": dict(
        css="同输入框；右端 20px 处放线稿箭头 SVG（不烘进底色）",
        food="—",
        subject="圆角矩形下拉框（纯白纸面、1px 细描边），右端一块小箭头位，无文字",
        extra_neg="立体下拉箭头、渐变、描边发光",
        slice=8, radius=3),
    "复选框": dict(
        css="纸白小方 + 1px 铜线 + 圆角 3px；勾选：朱红线稿勾（SVG，2.2px 笔锋 currentColor），**不加填充色块**",
        food="线稿勾（朱红，13px）",
        subject="14×14 圆角小方框（纸面、1px 细描边），内部完全空白",
        extra_neg="实心填充、3D 勾、拟物按压",
        slice=6, radius=3),
    "表格": dict(
        css="无底色；行间「筷子双线」= border-top 1px + ::before 再一条 1px（间距 3px，纯 CSS）；行高 <24px 退回单线；表头 1px 朱红下边框",
        food="筷子双线（表格行、日志行）",
        subject="（纯排版元素，用 CSS 双线分隔，不需要出图）",
        extra_neg="",
        slice=0, radius=0),
    "日志行": dict(
        css="无底色；左侧 2px 竖标按级别换色（info var(--copper) / warn var(--amber) / gain var(--vermilion)）",
        food="—（竖标由颜色承担）",
        subject="（纯排版元素，左侧一小段竖条 + 文字，不需要出图）",
        extra_neg="",
        slice=0, radius=0),
    "物品图": dict(
        css="background:#fff; border:1px solid #EBE3D6; border-radius:4px；右下角可叠 6% 水印（蒸笼）",
        food="餐具水印（蒸笼 / 筷架，6% 不透明）",
        subject="正方形物品图底座（纯白纸面、1px 极淡描边、4px 圆角），中间留空",
        extra_neg="木纹、描边加粗、圆角大于 6px",
        slice=8, radius=4),
    "区块标题": dict(
        css="无底板；左侧 2px 朱红短竖标（border-left）+ 墨字 13px/600 + letter-spacing .02em",
        food="—（竖标由颜色承担）",
        subject="（纯排版元素，不需要出图）",
        extra_neg="",
        slice=0, radius=0),
}
NEG = ("木纹材质、木牌/铜牌器物、拟物高光与硬投影（0 Npx 0 这类）、毛玻璃模糊（弹窗除外）、霓虹发光、"
       "3D 透视或斜视、渐变彩虹、赛博朋克、卡通粗描边、emoji 表情、任何文字/数字/字母/水印/署名、"
       "画面里带背景或投影（要纯色或透明背景）")
FOOD_NOTE = ("美食元素（克制使用）：可选一枚单色线稿食印（碗/筷/勺/锅/茶壶/蒸笼之一）或一条极淡蒸气曲线；"
             "装饰面积不超过画面 6%，绝不许把控件做成食物造型")

def states_of(fam, cls):
    """这个变体有几种视觉状态（决定 CSS 要写几个态；纯排版元素只需常态）"""
    if fam in ("区块标题", "表格", "日志行", "物品图", "进度条"):
        return ["常态"]
    base = ["常态", "悬停", "按下", "禁用"]
    if fam in ("页签", "按钮", "主按钮") or "chip" in cls or "tab" in cls:
        base += ["选中"]
    if "lock" in cls or "locked" in cls:
        base += ["锁定"]
    return base

def fam_of(f):
    return FAM.get(f, FAM["卡片"])

def prompt_parts(fam, size, state="常态"):
    """如需为某族出「参考图」（本方案默认不需要，控件用 CSS 写），这四段可直接拼成提示词"""
    F = fam_of(fam)
    return [
        f"{F['subject']}｜尺寸 {size[0]}×{size[1]}px（@2x 导出 {size[0]*2}×{size[1]*2}px）",
        f"{F['css']}；{FOOD_NOTE}",
        f"{STYLE_NAME}：现代新中式扁平纸面，克制留白，正投影正交视图；无纹理、无高光、无硬投影；"
        f"配色仅用 纸白 #FAF7F2 / 纯白 #FFFFFF / 铜线 #C9AE86 / 墨字 #2B2622 / 朱红 #A6371F",
        f"正视图居中，控件占画面 80%，四周留 {max(8, F['slice'])}px 透明边距，背景透明；"
        f"PNG-24 或 SVG、@2x、无文字；状态：{state}",
    ]

# ────────────────────────── 汇总实测（族|类名）→ 专属尺寸 ──────────────────────────
V = collections.defaultdict(lambda: dict(n=0, pages=set(), w=[], h=[], rad=collections.Counter(),
                                         font=collections.Counter(), pad=collections.Counter(),
                                         glass=0, text=""))
for pg in INV["pages"]:
    for c in pg["controls"]:
        a = V[(c["family"], c["cls"] or c["tag"])]
        a["n"] += 1
        a["pages"].add(pg.get("skill") or pg["view"])
        a["w"].append(c["w"]); a["h"].append(c["h"])
        a["rad"][c["radius"]] += 1; a["font"][c["font"]] += 1; a["pad"][c["pad"]] += 1
        a["glass"] += 1 if c["glass"] else 0
        if not a["text"] and c["text"]:
            a["text"] = c["text"][:18]

def mode_size(a):
    return collections.Counter((round(w), round(h)) for w, h in zip(a["w"], a["h"])).most_common(1)[0][0]

def pagekey(p):
    return p.get("skill") or p["view"]

def pagename(p):
    return f"技能页·{VIEW_NAME.get(p['skill'], p['skill'])}" if p.get("skill") else VIEW_NAME.get(pagekey(p), pagekey(p))

PF = collections.defaultdict(lambda: dict(n=0, cls=collections.Counter(), sizes=collections.Counter()))
for pg in INV["pages"]:
    for c in pg["controls"]:
        a = PF[(pagekey(pg), c["family"])]
        a["n"] += 1
        a["cls"][c["cls"] or c["tag"]] += 1
        a["sizes"][(round(c["w"]), round(c["h"]))] += 1

NO_ASSET = sum(1 for (f, c) in V if f in ("表格", "日志行", "区块标题"))
GLASS_CTL = sum(a["glass"] for a in V.values())
ALL_CTL = sum(a["n"] for a in V.values())

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
    auto_fit_columns(ws, min_width=min_width, max_width=max_width, header_row=4, data_start_row=5)
    auto_fit_row_heights(ws, header_row=4, data_start_row=5)
    return ws

now = datetime.date.today().isoformat()
n_ctl, n_pf, n_pages = len(V), len(PF), len(INV["pages"])

# ① 说明
rows1 = [
    ["交付物", "《全 UI 改版规范》——" + STYLE_NAME],
    ["版本 / 日期", f"v1 / {now}；v0「木牌铜饰」已废弃（太土、纹理太重）"],
    ["数据来源", "scripts/dev/ui-inventory.json —— 真实浏览器逐页量测（105 页 × 16 控件族），非手写"],
    ["覆盖范围", f"{n_pages} 个页面（55 功能页 + 38 技能页 + 顶栏/底栏）× 16 控件族"],
    ["量测规模", f"实测控件 {ALL_CTL} 个 → 收敛为 {n_ctl} 个「族|类名」变体、{n_pf} 个「页面×族」组合"],
    ["量测视口", f"{INV['meta']['viewport']['width']}×{INV['meta']['viewport']['height']}（桌面端；窄屏规则见「交付与切片」）"],
    ["🔴 素材口径", f"**0 张位图、0 个九宫格**：扁平纸面用 CSS 画（border/radius/shadow/gradient），只需 **12 个内联 SVG** 当美食元素；其中 {NO_ASSET} 个变体不需要任何素材"],
    ["🔴 避免的坑", "控件尺寸一律沿用现测尺寸（表 4「实测尺寸」列）。尺寸一改，e2e-layout 的 103 页扫描立刻红"],
    ["🔴 皮肤约束", "所有颜色走 token，SVG 装饰用 currentColor ⇒ 15 套皮肤 + 深色模式自动跟随，不需要为任何皮肤出素材"],
    ["", ""],
    ["分表导航", "风格总纲（定调）· Token 映射（接线）· 控件族规范（226 行：专属尺寸 + CSS 要点 + 美食元素）· 页面×控件（930 行）· 提示词模板（只需 12 个 SVG）· 素材方案 · SVG 资产清单 · 交付与切片"],
    ["本表怎么用", "① 读风格总纲定调 → ② 按 Token 映射改 main.css（浅深两套）→ ③ 写 .ui-paper/.ui-ink/.ui-seal 三个基类 → ④ 照「控件族规范」逐族替换 → ⑤ 用「页面×控件」核对每页用到哪些、各多大 → ⑥ 按「交付与切片」的 6 步顺序接入，每步跑守卫"],
    ["生成脚本", "scripts/dev/build_ui_spec_xlsx.py（底表 ui_inventory.mjs 可随时重跑，改版后量测自动更新）"],
    ["校验", "openpyxl audit + scan + validate 全过（本表无公式 ⇒ 不需要 recalc）"],
    ["样张", "docs/ui-mockup/风格样张-新中式美食-三档浓度.png（最右列 = 本方案按真实密度铺开的样子）"],
    ["实测补充", f"全站 {ALL_CTL} 个控件里 {GLASS_CTL} 个（{round(GLASS_CTL/ALL_CTL*100)}%）带毛玻璃 —— 新方案只在弹窗保留一层，其余改不透明纸面"],
]
sheet("说明", "全 UI 改版规范 · 说明", ["项", "内容"], rows1, max_width=90)

# ② 风格总纲
rows2 = [
    ["风格名", STYLE_NAME, "一句话：白纸黑字的一张菜谱 —— 留白为主，朱红只点关键处，美食元素当印章用"],
    ["为什么换掉木牌", "v0 的木牌+黄铜+木纹在 3573 个控件这种密度下变成噪音，硬投影 0 2px 0 又显旧", "复盘：器物拟物适合少数大控件（面板/弹窗），不适合「每张卡片、每个按钮」都上一遍"],
    ["", "", ""],
    ["底子 · 纸与墨", "纸白 #FAF7F2（页面底）· 纯白 #FFFFFF（卡片面）· 墨字 #2B2622 · 次要字 #7C7268", "只有纸与墨两种色；靠留白与一档亮度差分层面，不靠描边"],
    ["底子 · 铜线", "1px #C9AE86（深色 #D8BE93），只用于描边与分隔（永不填充）", "细到像铅笔线；线宽只有 1px（强调用 2px 朱红竖标）"],
    ["底子 · 朱红", "朱红 #A6371F，只出现在：选中态、主按钮、食印、左侧竖标、进度填充", "🔴 **全屏朱红面积 <2%** —— 这条是「不土」的关键，v0 就是死在色块太多"],
    ["底子 · 琥珀", "琥珀 #E08A3C，只做汤汁渐变终点与警告竖标", "不单独当控件底色"],
    ["底子 · 淡米", "淡米 #EFE7DA，用于徽章底、进度槽、按下态底", "第三层灰面，替代现在散落的 6 种近似白"],
    ["", "", ""],
    ["美食元素 · 食印", "朱红圆角方印 + 线稿剪影（碗/筷/勺/锅/茶壶/蒸笼 6 枚 SVG）", "用在侧栏选中、主按钮左侧、重要标记。这是本风格的「签名」"],
    ["美食元素 · 蒸气曲线", "1 条 SVG 曲线（铜线 55%，preserveAspectRatio=none 宽度自适应）", "面板顶部、弹窗台头，替代生硬的 1px 分隔线"],
    ["美食元素 · 餐具水印", "餐盘/蒸笼/筷架 3 枚线稿，**6% 不透明度**，贴在卡片与物品图右下角", "几乎看不见，但整屏铺开有一点厨房气质；超过 10% 就变脏"],
    ["美食元素 · 筷子双线", "两条 1px 淡铜线，间距 3px（纯 CSS，无素材）", "只用于表格行与日志行；行高 <24px 退回单线"],
    ["美食元素 · 汤汁进度", "填充 = 朱红→琥珀渐变 + 顶部 1px 液面高光（纯 CSS）", "进度条是看得最多的控件，用「汤汁」给它一点温度"],
    ["美食元素 · 线稿勾与铜锁", "勾（13px / 2.2px 笔锋 / 朱红）· 锁（线稿铜匙造型 / 灰褐）", "替换现在的 🔒 emoji 角标与粗体勾"],
    ["🔴 元素使用纪律", "同一屏最多出现 2 类美食元素（例如食印 + 汤汁）；蒸气与水印不同时用", "克制来自「少用几种」，而不是「每种都用得很淡」"],
    ["", "", ""],
    ["几何 · 圆角", "小控件 3px · 卡片 4px · 面板与弹窗 6px · 表格行 0px", "取代现行的 10 种圆角（实测 6/0/10/9/999/4/8/50%/5/14px 混用）"],
    ["几何 · 描边", "常态 1px 铜线 · 选中 1px 铜线 + 2px 朱红左标 · 禁用 1px var(--tint-rgb)", "禁止 ≥2px 的粗描边（纸面语言里粗边=贴纸）"],
    ["几何 · 投影", "常态 0 1px 2px rgba(70,50,30,.05)；悬停 0 2px 6px；弹窗 0 10px 30px rgba(60,45,30,.14)", "取消硬投影 —— 那是最显旧的一处"],
    ["几何 · 内边距", "按钮横向 10px / 纵向 4px；卡片 10px；面板 12px", "与现行实测一致（不改变版式）"],
    ["几何 · 字阶", "11 / 12 / 13 / 14px 四档，行高 1.55", "取代现行的 7 档（含 13.3333px 与 16.38px 两个非整数值）"],
    ["", "", ""],
    ["状态 · 常态", "白面 + 1px 铜线 + 极柔投影", "基准"],
    ["状态 · 悬停", "底色转纯白 + 铜线加深 8% + 投影 0 2px 6px", "纸面「被照亮」，不做位移（纸不像按钮会弹）"],
    ["状态 · 按下", "底色转淡米 #F3EDE3 + 移除投影（像被按进桌面）", "与悬停反向：一亮一暗"],
    ["状态 · 禁用", "去饱和 60% + 不透明度 45% + 铜线转灰", "不许只降 opacity：文字会看不见"],
    ["状态 · 选中/开启", "白面 + 铜线 + **朱红字** + 左侧 2px 朱红竖标；重要项加一枚食印", "页签、开关、列表选中、当前目标统一用这一套"],
    ["状态 · 锁定", "线稿铜锁（灰褐）+ 文字 #A09079；不加蒙层", "纸面语言里蒙层会造出第二层灰，改用「锁 + 灰字」"],
    ["", "", ""],
    ["动效", "底色/线色过渡 140ms ease-out；不做位移、不做缩放", "纸不动，只有颜色与投影变化"],
    ["", "", ""],
    ["现状问题（实测）", "3573 个控件里圆角 10 种、字号 7 种、控件高度 12 档、58% 带毛玻璃", "证据：ui-inventory.json。统一目标：4 圆角 / 4 字阶 / 1 线宽 / 3 个面"],
    ["现状问题（实测）", "近似白底色写了 6 遍：rgba(255,252,246,.3/.85/.86)、rgba(255,251,244,.86) 等", "统一后只留 3 个面（纸白/纯白/淡米），全部走 token"],
    ["现状问题（实测）", "毛玻璃覆盖 58% 控件且强度不一（backdrop-filter 6~20px）", "新方案只在弹窗保留一层模糊（纸背透光），其余改为不透明纸面 ⇒ 顺带省一大笔渲染开销"],
    ["", "", ""],
    ["🔴 皮肤硬约束", "15 套皮肤靠 CSS 变量换色", "本方案天然满足：颜色全是 token、SVG 用 currentColor ⇒ 换皮肤只改变量，零素材重做"],
    ["🔴 深色硬约束", "每个新 token 必须浅深两套都定义", "深色 = 墨底纸字（#1C1A17 / #26231F / #F2EDE4 / 铜线 #D8BE93）；只写 :root 会回落到浅色值"],
    ["🔴 构建硬约束", "构建期 CSS 压缩会改写规则（lightningcss 实测踩过）", "改完必须跑 css_output_audit.mjs，确认剩下那一处毛玻璃与 SVG 背景没被改写"],
    ["🟢 本方案最大优点", "**0 位图、0 九宫格**：控件外观 = border + border-radius + box-shadow + gradient", "从 v0 的 24 张位图（1:1 口径 870 张）降到 12 个内联 SVG；无缩放失真、无 @2x、无包体积问题"],
]
sheet("风格总纲", f"风格总纲 · {STYLE_NAME}", ["项", "规范", "说明 / 理由"], rows2, max_width=70)

# ③ Token 映射
M = {
    "--primary": ("朱红（强调色）", "#A6371F", "#B8452C", "选中字 / 主按钮底 / 左竖标 / 进度填充"),
    "--primary-rgb": ("同上三元组（给 rgba 用）", "166, 55, 31", "184, 69, 44", "聚焦外发光 rgba(var(--primary-rgb), .12)"),
    "--primary-soft": ("淡米（第三层灰面）", "#EFE7DA", "#2A2622", "徽章底 / 进度槽 / 按下态底"),
    "--primary-strong": ("深棕（可读的强调字）", "#7A3B2E", "#E7C9A8", "淡米底上的强调文字"),
    "--border": ("铜线（描边与分隔）", "#C9AE86", "#D8BE93", "1px 描边 / 筷子双线 / 蒸气曲线"),
    "--glass-rgb": ("纸面三元组（沿用同名，语义改为「纸」）", "255, 255, 255", "28, 26, 23", "卡片面 = rgba(var(--glass-rgb), .92)"),
    "--muted": ("次要字（铅笔灰）", "#7C7268", "#A79C8E", "副标题 / 说明 / 行标签"),
    "--good-soft / --good-strong": ("青葱绿（成功）", "#E4EEE4 / #3F7A52", "#25301F / #9FD3A8", "成功态 / 已完成"),
    "--warn-soft / --warn-strong": ("琥珀（警告）", "#F6E7CF / #8A5A1F", "#3A2A16 / #E0A85C", "警告徽章 / 低目标减半标签"),
    "--tint-rgb": ("纸灰三元组", "124, 114, 104", "167, 156, 142", "禁用线 / 锁定字"),
}
rows3 = []
for tok in sorted(set(list(LIGHT.keys()) + list(M.keys()))):
    if tok.startswith("--skin"):
        continue
    sem, light, dark, use = M.get(tok, ("沿用现语义 + 纸面化", LIGHT.get(tok, "—"), DARK.get(tok, "—"), "保持同名，只换取值"))
    rows3.append([tok, LIGHT.get(tok, "—"), sem, light, dark, use])
rows3 += [
    ["（新增）--paper", "—", "页面底色（纸白）", "#FAF7F2", "#1C1A17", "最底层；卡片面比它再白一档"],
    ["（新增）--paper-lift", "—", "卡片 / 输入框面", "#FFFFFF", "#26231F", "靠这一档亮度差分层，不靠描边"],
    ["（新增）--ink / --ink-sub", "—", "墨字与次要字", "#2B2622 / #7C7268", "#F2EDE4 / #A79C8E", "正文与说明；深色下互为反相"],
    ["（新增）--copper", "—", "铜线", "#C9AE86", "#D8BE93", "所有 1px 描边与分隔线（永不填充）"],
    ["（新增）--amber", "—", "琥珀（汤汁终点 / 警告）", "#E08A3C", "#E0A85C", "只做渐变终点与警告竖标"],
    ["（新增）--vermilion", "—", "朱红（强调，= --primary 别名）", "#A6371F", "#B8452C", "语义别名，换皮肤只改一处"],
    ["（新增）--shade-soft", "—", "极柔投影", "0 1px 2px rgba(70,50,30,.05)", "0 1px 2px rgba(0,0,0,.5)", "替代现有 4 种模糊阴影；弹窗另有一条 0 10px 30px"],
    ["（可删）毛玻璃强度变量", "—", "backdrop-filter 强度", "（仅弹窗保留 1 处 8px）", "同左", "其余 58% 的毛玻璃控件改为不透明纸面"],
]
sheet("Token 映射", "Token 映射 · 旧变量 → 纸白食印（15 皮肤与深色都必须跟着改）",
      ["现有 CSS 变量", "现值（浅色）", "新风格语义", "新取值（浅色）", "新取值（深色）", "用途 / 注意"], rows3, max_width=56)

# ④ 控件族规范（226 行）
rows4 = []
for i, ((fam, cls), a) in enumerate(sorted(V.items(), key=lambda kv: (-len(kv[1]["pages"]), kv[0][0], kv[0][1])), 1):
    F = fam_of(fam)
    w, h = mode_size(a)
    ws_, hs_ = sorted({round(x) for x in a["w"]}), sorted({round(x) for x in a["h"]})
    st = states_of(fam, cls)
    r0 = a["rad"].most_common(1)[0][0]
    rows4.append([
        i, fam, cls, len(a["pages"]), a["n"],
        f"{w}×{h}", f"{min(ws_)}~{max(ws_)}×{min(hs_)}~{max(hs_)}",
        r0, a["font"].most_common(1)[0][0], a["pad"].most_common(1)[0][0],
        f"{r0} → {F['radius']}px",
        " / ".join(st) if st else "—",
        F["css"], F["food"], a["text"] or "",
        prompt_parts(fam, (w, h))[0],
        NEG + ("；" + F["extra_neg"] if F.get("extra_neg") else ""),
    ])
sheet("控件族规范", "控件族规范 · 226 个变体的专属尺寸 + CSS 实现要点（控件靠 CSS，出图非必需）",
      ["#", "族", "变体类名", "出现页数", "实例数", "实测尺寸（常见）", "实测尺寸范围", "现圆角", "现字号", "现内边距",
       "圆角 → 新", "状态清单（CSS 要写几个态）", "CSS 实现要点", "美食元素位", "代表文案",
       "如需出参考图·主体句", "负向提示词"], rows4, max_width=60)

# ⑤ 页面×控件（930 行）
LAY = {pagekey(p): p.get("layout", {}) for p in INV["pages"]}
rows5 = []
for (page, fam), a in sorted(PF.items(), key=lambda kv: (kv[0][0], kv[0][1])):
    F = fam_of(fam)
    sz = " ；".join(f"{w}×{h}（{n} 个）" for (w, h), n in a["sizes"].most_common(2))
    lay = LAY.get(page, {}) or {}
    g = lay.get("grid", {}) or {}
    note = f"网格 {g['cols']} 列 · 单卡 {g.get('cardW')}×{g.get('cardH')}" if g.get("cols") else (
        f"主内容区宽 {lay.get('mainW')}" if fam == "面板" and lay.get("mainW") else "")
    rows5.append([
        f"技能页·{VIEW_NAME.get(page, page)}" if page.startswith("skill") or page in VIEW_NAME and page not in ("skill",) and False else pagename({"view": page}) if not page.startswith("skill") else f"技能页·{VIEW_NAME.get(page, page)}",
        page, fam, a["n"], " / ".join(c for c, _ in a["cls"].most_common(2)),
        sz, f"{min(w for w, _ in a['sizes'])}~{max(w for w, _ in a['sizes'])}px 区间",
        F["radius"], F["food"], note,
    ])
sheet("页面×控件", "页面 × 控件清单（每页用到哪些控件族、各多大、有没有美食元素位）",
      ["页面", "视图 key / 技能 id", "控件族", "该页数量", "代表类名", "实测尺寸（最常见的两档）",
       "宽度区间", "新圆角", "美食元素位", "页面布局备注"], rows5, max_width=52)

# ⑥ 提示词模板（本方案只需 12 个 SVG）
rows6 = [
    ["本方案需要提示词吗", "**基本不需要**：控件外观由 CSS 画（表 4「CSS 实现要点」列），不出图", "v0 的 226×4 段提示词是给「位图控件」准备的；换成纸面风格后只剩 12 个装饰 SVG 值得让 AI 起草"],
    ["什么时候用", "想让 AI 先起草「食印剪影 / 蒸气曲线 / 餐具水印 / 勾 / 锁」的线稿时", "控制类的参考图提示词保留在表 4 最后两列"],
    ["", "", ""],
    ["线稿通用模板", "单色线稿图标，{主体}，{笔锋}，正投影正交视图，无填充（或仅印面填充），无阴影无渐变，线条端点圆润，居中构图，四周留 20% 白边，纯白或透明背景，输出 SVG（或黑白 PNG 便于手动描摹）", "线稿要「一眼认得出」：最粗 ≤2.2px、最细 ≥1.5px，否则缩到 13px 就糊"],
    ["素材 1 · 食印", "单色线稿图标，一只中式汤碗（碗口一道弧线 + 底部圈足），白色剪影放在 18×18 朱红圆角方印上，笔锋 2px", "剪影是「印面挖白」：做的时候印面红、剪影白/透明"],
    ["素材 2 · 蒸气曲线", "一条横向细曲线，两端平收，中间两处柔和起伏（像锅盖缝里升起的蒸汽），1px 线宽，单色", "会被 preserveAspectRatio=none 拉伸，所以要「怎么拉都好看」，别做复杂细节"],
    ["素材 3 · 餐具水印", "单色线稿，一个俯视餐盘（两个同心圆 + 左右各一道短横线代表筷架），笔锋 2px，无阴影", "最终以 6% 不透明度使用；做的时候要看「很淡时是否还有形」"],
    ["素材 4 · 线稿勾", "单色线稿，一个手写感的对勾（起笔略粗、收笔尖），笔锋 2.2px，端点圆润", "要有「一笔写成」的手感，不要数学对称"],
    ["素材 5 · 线稿铜锁", "单色线稿，一把中式小铜锁（方形锁体 + 半圆锁梁 + 一枚小匙孔），笔锋 1.8px，无填充", "钥匙孔是识别点，别省"],
    ["", "", ""],
    ["线稿类参数建议", "CFG 5~6 · 步数 20~24 · 纯黑白输出 · 关闭所有质感/光影词", "线稿越少细节越好；AI 容易加立体感与渐变"],
    ["线稿类负向词", "渐变、阴影、立体感、拟物高光、多彩、纹理、噪点、文字、水印、复杂背景、超过两种线宽", "注意：这与表 4 给控件的负向词是两套（那套是位图控件用的）"],
    ["", "", ""],
    ["验收一图流", "把 12 个 SVG 排成一张对照图，缩到实机尺寸（13~18px）看：能否一眼认出、是否有两个糊成一团", "小尺寸下认不出就简化笔画，而不是放大"],
]
sheet("提示词模板", "提示词模板（本方案只需 12 个装饰 SVG；控件由 CSS 画）", ["项", "内容 / 可直接复制", "说明"], rows6, max_width=95)

# ⑦ 素材方案
rows7 = [
    ["结论", "本方案 **0 张位图、0 个九宫格**，只需 **12 个内联 SVG**（单色线稿，currentColor 染色）", "控件外观 = border + border-radius + box-shadow + linear-gradient；v0 要 870 张是因为它把「材质」当成了外观"],
    ["CSS 承担 7 类原本的「出图活」", "① 全部控件的底/线/圆角/投影 ② 汤汁渐变与液面高光 ③ 筷子双线 ④ 页签左侧 2px 朱红竖标 ⑤ 日志级别竖标 ⑥ 弹窗唯一一层模糊 ⑦ 悬停/按下/禁用三态", "这些在 v0 里都是位图"],
    ["SVG 承担", "6 枚食印 + 1 条蒸气 + 3 枚水印 + 1 勾 + 1 锁 = 12 个（见「SVG 资产清单」）", "全部内联、全部 currentColor ⇒ 换皮肤自动跟随"],
    ["可选位图", "纸纹平铺 256×256 @6% 不透明度（若想再省：连它也不做，纯色纸面也成立）", "全方案唯一可能的一张位图"],
    ["推荐执行顺序", "① 写 .ui-paper / .ui-ink / .ui-seal 三个基类 → ② 换页签与按钮 → ③ 拿采摘页验收观感 → ④ 铺开到 105 页", "没有素材等待期，可以先看结果再决定要不要加水印那一档"],
    ["验收", "拼一屏真实页面核对：朱红面积 <2% · 同屏美食元素 ≤2 类 · 无纹理噪点 · 各排卡片高度齐整", "样张：docs/ui-mockup/风格样张-新中式美食-三档浓度.png（最右列 = 本方案）"],
]
sheet("素材方案", "素材方案（0 位图 + 12 个内联 SVG）", ["项", "做法 / 数量", "说明"], rows7, max_width=70)

# ⑧ SVG 资产清单
SVG_ASSETS = [
    ["SEAL_BOWL", "食印 · 碗", "主按钮 / 采集类页签选中", "18×18 印 + 11×11 剪影", "朱红印面 + currentColor 剪影", "最常用的一枚；剪影是「印面挖白」"],
    ["SEAL_CHOP", "食印 · 筷（长印）", "菜单签式页签选中", "16×20", "同上", "长印像菜谱的插入标记，与方形印区分「页签」与「按钮」"],
    ["SEAL_SPOON", "食印 · 勺", "制作 / 副业类", "18×18", "同上", "与碗区分采集线与制作线"],
    ["SEAL_POT", "食印 · 锅", "烹饪 / 对决", "18×18", "同上", "取「灶」意，战斗与烹饪共用"],
    ["SEAL_TEAPOT", "食印 · 茶壶", "地窖 / 饮品", "18×18", "同上", "酒窖、陈酿、茶类功能"],
    ["SEAL_STEAMER", "食印 · 蒸笼", "烘焙 / 保鲜", "18×18", "同上", "蒸制类功能"],
    ["STEAM_LINE", "蒸气曲线", "面板顶部 / 弹窗台头", "宽自适应 ×8", "var(--copper) 55%", "preserveAspectRatio=none；一条通吃所有宽度"],
    ["WATERMARK_PLATE", "水印 · 餐盘", "卡片右下角", "62×62", "6% 不透明", "整屏铺开形成「一桌菜」的暗示；>10% 会脏"],
    ["WATERMARK_STEAMER", "水印 · 蒸笼", "面板 / 弹窗角", "72×72", "6% 不透明", "与餐盘二选一，别同时出现"],
    ["WATERMARK_CHOPREST", "水印 · 筷架", "物品图底座", "48×48", "6% 不透明", "只在物品图那种小方框里用"],
    ["CHECK_STROKE", "线稿勾", "复选框 / 任务列表", "13×13", "朱红 2.2px 笔锋", "替换现在的粗体勾与 ✓ 字符"],
    ["LOCK_LINEWORK", "线稿铜锁", "锁定态", "13×13", "灰褐 1.8px", "替换现在的 🔒 emoji 角标"],
]
sheet("SVG 资产清单", "内联 SVG 资产清单（12 个；单色线稿，currentColor 染色）",
      ["ID", "名称", "用途", "尺寸", "上色方式", "注意"], SVG_ASSETS, max_width=52)

# ⑨ 交付与切片
rows9 = [
    ["交付形态", "**不是位图，是 CSS + 内联 SVG**：无需 9-slice、无 @2x、无缩放失真、不增包体积", "与 v0（24 张位图）最大的不同"],
    ["CSS 三个基类", ".ui-paper（纸面：底色 + 1px 铜线 + 圆角 + 极柔投影）· .ui-ink（墨字三档层级）· .ui-seal（食印容器）", "所有控件由这三个基类组合，变体只改圆角档与内边距"],
    ["SVG 存放", "12 个装饰 SVG 直接内联进 Vue SFC，用 currentColor 上色", "不要引外部 .svg：内联才能被 CSS 变量染色，也免一次请求"],
    ["命名", "SEAL_BOWL / SEAL_CHOP / SEAL_SPOON / SEAL_POT / SEAL_TEAPOT / SEAL_STEAMER · STEAM_LINE · WATERMARK_PLATE / STEAMER / CHOPREST · CHECK_STROKE · LOCK_LINEWORK", "12 个全部列名，避免各处各画一份"],
    ["染色与皮肤", "换皮肤 = 改 --paper / --paper-lift / --ink / --copper / --vermilion / --amber 六个数", "15 套皮肤 + 深色自动跟随，零素材重做"],
    ["深色模式", "墨底纸字：--paper #1C1A17 / --paper-lift #26231F / --ink #F2EDE4 / --copper #D8BE93", "朱红在深色下提亮到 #B8452C，否则暗底上发闷"],
    ["窄屏（390px）", "控件尺寸不变；卡片网格 5 列 → 2 列；左栏改抽屉；**美食元素自动减一档**（只留食印，隐藏蒸气与水印）", "小屏装饰最容易变噪音，这条写进媒体查询"],
    ["接入顺序（6 步）", "① 落 token（浅深两套 + 15 皮肤映射）→ ② 三个基类 → ③ 页签与按钮 → ④ 徽章/进度/输入/复选 → ⑤ 卡片与面板（含水印）→ ⑥ 弹窗、表格双线、日志竖标", "每步跑一次守卫，别攒到最后"],
    ["每步必跑的守卫", "css_output_audit.mjs（构建期 CSS 压缩会改写规则，实测踩过）· e2e-layout.spec.mjs（裁切/竖排）· e2e-dark.spec.mjs（5 皮肤 × 浅深对比度）· e2e-text.spec.mjs（标记裸露）", "四条里任何一条红都别继续下一步"],
    ["禁止事项", "① 木纹/铜牌/拟物高光 ② 硬投影 0 Npx 0 ③ 朱红面积 >2% ④ 新增圆角/字阶档位 ⑤ 用 emoji 当图标 ⑥ 改控件尺寸", "第 ⑥ 条：尺寸一改，e2e-layout 的 103 页扫描立刻红"],
    ["验收 1 · 观感", "整屏朱红面积 <2% · 同屏美食元素 ≤2 类 · 无纹理噪点 · 各排卡片高度齐整", "拼一屏真实页面看"],
    ["验收 2 · 一致性", "4 种圆角 / 4 档字阶 / 1 种线宽 / 3 个面；不再出现第三种灰白", "可用 scripts/dev/style_fingerprint.mjs 逐页对指纹"],
    ["验收 3 · 皮肤", "15 套 × 浅深 30 种组合对比度 ≥ 4.5:1；朱红提亮后仍可读", "e2e-dark 的判据"],
    ["验收 4 · 功能", "无被裁控件、无逐字竖排、无标记裸露、构建产物与源码一致", "四条守卫全绿"],
    ["范围说明", "本次只换「外壳」：按钮/卡片/面板/框/进度条/页签/徽章/输入/表格/日志。不含物品图 2427 张、立绘 248 张、小游戏内部画面、山海食经画布", "那三块各有独立规范，另立交付"],
]
sheet("交付与切片", "交付、接入与验收规范（CSS 实现，无位图）", ["项", "内容", "说明"], rows9, max_width=95)

if "Sheet" in wb.sheetnames:
    wb.remove(wb["Sheet"])
wb.save(OUT)
print("saved:", OUT)
print("sheets:", wb.sheetnames)
print(f"rows: 说明 {len(rows1)} · 风格总纲 {len(rows2)} · Token {len(rows3)} · 控件族 {len(rows4)} · 页面×控件 {len(rows5)} · 提示词 {len(rows6)} · 素材方案 {len(rows7)} · SVG {len(SVG_ASSETS)} · 交付 {len(rows9)}")
