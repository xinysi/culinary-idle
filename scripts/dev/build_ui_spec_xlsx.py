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
STYLE_NAME = "纸白食印 · 新中式（美食元素·丰富档）"

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
FOOD_NOTE = ("美食元素（丰富档：全部启用）：食印（碗/筷/勺/锅/茶壶/蒸笼）· 蒸气曲线 · 餐具水印 · 筷子双线 · 汤汁渐变；"
             "装饰同样不许把控件做成食物造型，但允许更明显的笔触与手感")

# 素材形态：这族的元素长什么样、能不能九宫格拉伸、要出几档尺寸
#   pull=True  → 边缘不规则但**中段可拉伸**（走九宫格）：一张图覆盖该族所有尺寸
#   pull=False → 一整块不可拉伸的不规则件（一张图 = 一个元素，尺寸固定）：按尺寸档出图
FORM = {
    "卡片":   dict(pull=True,  form="手撕宣纸片：四边毛糙、略有起伏，四角不规整；纸面有极淡纤维", sizes="1 张（九宫格）"),
    "面板":   dict(pull=True,  form="整张大宣纸：一边或两边的撕边更明显；顶部可留一条蒸气曲线", sizes="1 张（九宫格）"),
    "弹窗":   dict(pull=True,  form="手撕纸片 + 顶部一块朱红小印（印泥晕染边）", sizes="1 张（九宫格）"),
    "按钮":   dict(pull=True,  form="毛笔一笔画成的方框：四边粗细不均、起收笔有飞白", sizes="1 张（九宫格，高度靠 CSS 不变）"),
    "主按钮": dict(pull=True,  form="朱红印泥块：边缘毛糙外扩、内里实心，像按在纸上的印章", sizes="1 张（九宫格）"),
    "图标按钮": dict(pull=True, form="小方印泥块（同主按钮但更小更方）", sizes="1 张（九宫格）"),
    "页签":   dict(pull=True,  form="竹签剪影：左右两端斜切不齐、签面有竹节；选中态另出一张（签面染朱、带一枚指纹印）", sizes="2 张（常态 + 选中）"),
    "徽章":   dict(pull=False, form="小块印泥：形状不规则、边缘晕开，像随手盖的章", sizes="3 档（13px / 18px / 22px 高）"),
    "进度条": dict(pull=True,  form="墨线双勾的细槽（上下两根手绘线）+ 汤汁填充（末端有自然的液面收口）", sizes="2 张（槽 + 填充，横向九宫格）"),
    "输入框": dict(pull=True,  form="手绘方框：四边略歪、线头出锋，像铅笔随手框的", sizes="1 张（九宫格）"),
    "下拉":   dict(pull=True,  form="同输入框 + 右端一枚手绘小三角", sizes="1 张（九宫格）"),
    "复选框": dict(pull=False, form="手绘小方框（四角不齐）+ 勾选态一枚朱红手写勾", sizes="2 档（16px / 22px）"),
    "表格":   dict(pull=True,  form="无需整图：两条手绘墨线（筷子双线）横向拉伸", sizes="1 张（一条线，横向九宫格）"),
    "日志行": dict(pull=True,  form="无需整图：左侧一段手绘竖笔（按级别染色）", sizes="1 张（一段竖笔）"),
    "物品图": dict(pull=True,  form="手撕小方纸片 + 右下角一枚餐具水印", sizes="1 张（九宫格）"),
    "区块标题": dict(pull=False, form="无需整图：左侧一段朱红手绘竖笔", sizes="1 张（一段竖笔）"),
}
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

# 提示词分 4 段（出「不规则轮廓单图」用；控件也可以走 A 路线用 SVG 滤镜做，那样不需要提示词）
def prompt_parts(fam, size, state="常态"):
    F = FAM.get(fam, FAM["卡片"])
    M = FORM.get(fam, FORM["卡片"])
    return [
        f"{F['subject']}，但**轮廓必须是不规则的**：{M['form']}｜尺寸 {size[0]}×{size[1]}px（@2x 导出 {size[0]*2}×{size[1]*2}px）",
        f"{F['css']}（若出图：这些数值就是画面里要体现的比例 —— 1px 线、3~6px 圆角量级、极柔投影）；{FOOD_NOTE}",
        f"{STYLE_NAME}：现代新中式手作纸感，水墨与印泥质感，克制留白；正投影正交视图（无透视、无斜视）；"
        f"只用 纸白 #FAF7F2 / 纯白 #FFFFFF / 铜线 #C9AE86 / 墨字 #2B2622 / 朱红 #A6371F / 琥珀 #E08A3C 六色",
        f"正视图居中，元素占画面 80%，四周留 {max(10, F['slice'])}px 透明边距，背景透明；"
        f"PNG-24（带 alpha）或 SVG、@2x、无文字；状态：{state}",
    ]

# 负向：不规则单图要强调「别给我规整矩形」（这是它与普通 UI 出图最大的差别）
NEG_IRREGULAR = ("完美矩形、笔直的边、数学对称、圆角规整、AI 常见的均匀描边、几何图形感、"
                 "塑料质感、金属高光、霓虹、3D 阴影与浮雕、渐变彩虹、通用 UI 素材库风格、"
                 "emoji、文字/数字/字母/水印/署名、背景或投影（要透明背景）")

def prompt_irregular(fam, cls, size, state="常态"):
    """按「一张图 = 一个元素」出的完整提示词（可直接粘贴）"""
    F = FAM.get(fam, FAM["卡片"])
    M = FORM.get(fam, FORM["卡片"])
    return "\n".join([
        f"【主体】{F['subject']}；**轮廓不规则**：{M['form']}",
        f"【尺寸】{size[0]}×{size[1]}px（导出 @2x：{size[0]*2}×{size[1]*2}px）；{'可九宫格拉伸' if M['pull'] else '不可拉伸（按此尺寸整张出）'}",
        f"【材质】{F['css']}",
        f"【风格】{STYLE_NAME}：现代新中式手作纸感，水墨与印泥质感",
        f"【光照】正投影（无透视、无斜视），不反光，允许极柔的一层落影",
        f"【构图】正视图居中，元素占画面 80%，四周留 {max(10, F['slice'])}px 透明边距",
        f"【输出】PNG-24 带 alpha（或 SVG）、@2x、无文字、状态：{state}",
        f"【负向】{NEG_IRREGULAR}",
    ])

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

# 体检结论（2026-09-23 实检 33 个 png：量尺寸/透明/长宽比 + 放大与实机尺寸各看一遍）
INSPECT = {
    "FRAME_CARD": "✅ 合格：手撕边清楚（内容 921×507），缩到 214×331 仍成立",
    "FRAME_PANEL": "✅ 合格：撕边比卡更明显，正是「大宣纸」要的效果",
    "FRAME_MODAL": "✅ 合格：手撕纸 + 顶部朱红小印，位置对",
    "FRAME_BTN": "🔧 仍未改（文件时间还是 12:22）：线是**暗红 #801008**，比朱红还深。规范要按钮用 1px 铜线 —— 满屏红框会破「朱红面积 <2%」并与主按钮抢眼。两条路：① 线色改铜线 #C9AE86；② 干脆不要这张，按钮用 CSS `border:1px solid var(--copper)`（省一张素材）",
    "FRAME_BTN_RED": "✅ 合格：朱红 #a02810 ≈ 规范 #A6371F，作为全站唯一大面积朱红正好",
    "FRAME_INPUT": "✅ 合格：墨褐 #504030 手绘方框，缩到 170×24 仍像铅笔随手框的",
    "FRAME_BAR_SLOT": "✅ 合格：手绘双线槽（897×55），横向九宫格拉伸即可",
    "FRAME_BAR_FILL": "✅ 合格：红烧汤汁渐变（905×203，色相朱红→橙），拉伸到 8~16px 高很自然",
    "FRAME_TAB": "🟡 已改善但仍偏薄：内容 937×199（笔画高度只占画面 1/5），当 75×29 的页签底会是一条细铜线。**建议改用法**：侧栏页签用 CSS 底板（纸白 + 1px 铜边 + 左侧 2px 朱红竖标），这张当作「页签底部铜线 / 分隔装饰」用；若一定要片状底，需重画成有签面的片",
    "FRAME_TAB_ON": "🟡 同上（红色版 937×255）。另注意它是**纯红 #c01800**（见「红色不统一」一条）",
    "SEAL_BOWL": "✅ 合格：印泥边缘晕开 + 白线稿碗，18px 下仍一眼可辨",
    "SEAL_CHOP": "🟡 形状是**长条形章**（内容 303×845，比例 0.36）⇒ 规范侧改：目标尺寸由 32×40 改为 **20×56**（竖长印），按原比例用",
    "SEAL_SPOON": "✅ 合格",
    "SEAL_POT": "✅ 合格",
    "SEAL_TEAPOT": "✅ 合格",
    "SEAL_STEAMER": "✅ 合格",
    "BADGE_S/M/L": "✅ 已改好：现在是印泥块（内容 601×331 / 623×413 / 611×399），不再是食物插画 ⇒ 建议按**可九宫格拉伸**用（毛边固定、中段拉伸），这样 32×13 / 45×22 / 76×22 三档都不变形。⚠️ 颜色是**纯红 #c0~#d0 0000**（见「红色不统一」）",
    "CHECK_ON/OFF": "🔧 两处：① **同族两档不同色**（CHECK_OFF_S 是墨 #383030、CHECK_OFF_M 是红 #b02008）需统一；② 建议未选中的**框**用铜线、只留勾为朱红，更守「朱红面积 <2%」",
    "LOCK_LINEWORK": "✅ 形态合格（线稿锁 + 匙孔，墨色 #201818）⇒ 规范侧改：它是**竖长件**（491×743，比例 0.66），按**高度**渲染（`height:13px; width:auto`）而不是塞进 26×26 方框",
    "STEAM_LINE": "✅ 合格：手绘曲线（901×101），宽度自适应拉伸即可",
    "LINE_CHOPSTICK": "🔧 颜色是**砖红 #b83828** ⇒ 表格行与日志行会满屏红线，破「朱红面积 <2%」。建议改铜线 #C9AE86 或墨色",
    "LINE_STROKE": "🟡 三色都有锋 ✓，但色值偏深：铜 #985018（规范 #C9AE86 更浅）、琥珀 #b87008、红 #b81008 ⇒ 建议整体提亮一档，否则在纸白底上发闷",
    "WM_PLATE": "✅ 合格：线稿餐盘（727×741），6% 用时会隐约成形",
    "WM_STEAMER": "✅ 合格：线稿蒸笼（683×741）",
    "WM_CHOPREST": "🟡 形状偏横（897×567，比例 1.58）⇒ 规范侧改：目标尺寸由 96×96 改为 **96×60**",
}

# 用户已生成素材（public/images/ui/，45 个 png + manifest.json，命名 <形态>_<状态>_<w>x<h>@2x_{color,mask}.png）
UI_DIR = os.path.join(ROOT, "public/images/ui")
EXISTING = set()
if os.path.isdir(UI_DIR):
    for dp, _dn, fn in os.walk(UI_DIR):
        for f in fn:
            if f.endswith(".png"):
                EXISTING.add(f)

# 新版素材 ID → (旧文件匹配片段, 复用结论)
REUSE = {
    "FRAME_CARD": ("paper_card", "🔧 需重出：现为规整圆角矩形 + 4px 深棕粗边；改成手撕纸（3.5~4px 撕边）且边线降到 1px 铜线"),
    "FRAME_PANEL": ("lacquer_panel", "🔧 需重出：现在是漆器木牌；改成一整张大宣纸（撕边更明显）"),
    "FRAME_MODAL": ("modal_frame", "🔧 需重出：加顶部朱红小印（印泥晕染边）"),
    "FRAME_BTN": ("plaque_normal", "🔧 需重出：现在是黄铜厚边 + 平铺木纹（最土的一张）；改成毛笔一笔画成的方框"),
    "FRAME_BTN_RED": ("lacquer_plaque", "🔧 需重出：朱漆木牌 → 印泥块（边缘毛糙外扩、内里实心）"),
    "FRAME_INPUT": ("paper_slot", "🔧 需重出：改成手绘歪框（四边略歪、线头出锋）"),
    "FRAME_BAR": ("copper_groove", "🔧 部分复用：bar_fill 的汤汁色可留；槽改成上下两根手绘墨线"),
    "FRAME_TAB": ("tab_on", "🔧 需重出：改成竹签剪影（两端斜切不齐 + 竹节），另出常态一张"),
    "SEAL_BOWL": ("", "➕ 新增：6 枚食印是本风格的签名，旧素材里没有"),
    "SEAL_CHOP": ("", "➕ 新增"),
    "SEAL_SPOON": ("", "➕ 新增"),
    "SEAL_POT": ("", "➕ 新增"),
    "SEAL_TEAPOT": ("", "➕ 新增"),
    "SEAL_STEAMER": ("", "➕ 新增"),
    "BADGE_S/M/L": ("brass_tag", "🔧 需重出：铜牌 → 印泥块（形状不规则、边缘晕开），并补 13 / 18 / 22px 三档"),
    "CHECK_ON/OFF": ("checkbox_tiny", "🔧 需重出：手绘方框（四角不齐）+ 朱红手写勾；沿用 16 / 22px 两档"),
    "LOCK_LINEWORK": ("lock", "✅ 可直接复用：线稿锁本就是单色线稿（换成灰褐 + 匙孔更明显即可）"),
    "STEAM_LINE": ("", "➕ 新增：一条手绘蒸气曲线（宽自适应）"),
    "LINE_CHOPSTICK": ("bamboo_row", "🔧 转化：竹简行的横条改成「一条手绘墨线」，用时叠两条当筷子双线"),
    "LINE_STROKE": ("", "➕ 新增：三段手绘竖笔（红/铜/琥珀），也可用 CSS 边框代替"),
    "WM_PLATE": ("", "➕ 新增：餐盘水印（6% 不透明度使用）"),
    "WM_STEAMER": ("", "➕ 新增：蒸笼水印"),
    "WM_CHOPREST": ("", "➕ 新增：筷架水印"),
}
# 旧素材里新版不再需要的
OBSOLETE = [
    ("parts/nail_16x16 · parts/corner_48x48", "❌ 不再需要：新方案没有铜钉与包角（那是木牌器物语言）"),
    ("tex/wood_tile · tex/brass_tile · tex/bamboo_tile", "❌ 不再需要：新方案不贴纹理，纸面是素色（只有纸纹可选保留）"),
    ("tex/paper_tile", "🟡 可选保留：若想要一点纸纤维质感，保留它并以 6% 叠加"),
    ("common/disabled_veil", "✅ 保留：禁用蒙层通用，不受风格变化影响"),
    ("icon-btn/icon_chip_tiny", "✅ 基本可复用：小方片形态与新版「小方印泥块」接近，改成印泥毛边即可"),
    ("parts/arrow · parts/check", "✅ 保留：手绘箭头与勾本来就是线稿，符合新方向"),
]

ART = [
    # 可九宫格拉伸的不规则帧（一张覆盖该族所有尺寸）
    ["FRAME_CARD", "手撕宣纸卡帧", "卡片（117 变体）", "可拉伸", "1 张", "撕边 3.5~4px；四边毛糙、四角不齐；纸面极淡纤维。**白纸 + 透明边**，颜色交由 CSS", "覆盖 214×331 到 1148×802 全部卡片尺寸"],
    ["FRAME_PANEL", "大宣纸面板帧", "面板（9 变体）", "可拉伸", "1 张", "撕边 4px；一边或两边更明显；顶部可留蒸气位", "左栏 / 右栏抽屉 / 底栏胶囊面板共用"],
    ["FRAME_MODAL", "弹窗纸片帧", "弹窗（1 类）", "可拉伸", "1 张", "撕边 4px + 顶部一块朱红小印（印泥晕染边）", "唯一保留一层模糊（纸背透光）的层"],
    ["FRAME_BTN", "毛笔框按钮帧", "按钮（20 变体）", "可拉伸", "1 张", "一笔画成的方框：四边粗细不均、起收笔飞白；平均线宽 1px", "高度由 CSS 决定，靠九宫格纵向拉伸"],
    ["FRAME_BTN_RED", "朱红印泥按钮帧", "主按钮 / 图标按钮", "可拉伸", "1 张", "印泥块：边缘毛糙外扩、内里实心；朱红 #A6371F", "全站唯一的大面积朱红"],
    ["FRAME_INPUT", "手绘输入框帧", "输入框 / 下拉（23 变体）", "可拉伸", "1 张", "四边略歪、线头出锋（像铅笔随手框的）", "聚焦态不另出图，改用 CSS 把线色转朱红"],
    ["FRAME_BAR", "墨线槽 + 汤汁填充", "进度 / 血 / 经验条（8 变体）", "可拉伸", "2 张", "槽：上下两根手绘墨线；填充：红烧汤汁渐变、末端自然收口", "只有 8~12px 高，横向拉伸即可"],
    ["FRAME_TAB", "竹签页签（常态 + 选中）", "页签（105 页都在用）", "可拉伸", "2 张", "竹签剪影：两端斜切不齐、签面有竹节；选中态签面染朱 + 一枚指纹印", "侧栏 38+ 个页签共用这两张"],
    # 不可拉伸的不规则小件（一张图 = 一个元素）
    ["SEAL_BOWL", "食印 · 碗", "主按钮 / 采集类", "固定", "1 张", "18×18；朱红印面 + 白色线稿剪影（印面挖白），边缘晕开", "6 枚食印里最常用的一枚"],
    ["SEAL_CHOP", "食印 · 筷（长印）", "菜单签页签选中", "固定", "1 张", "**20×56 竖长印**（按素材比例 0.36 定，勿塞方框）", "与方形印区分「页签」与「按钮」"],
    ["SEAL_SPOON", "食印 · 勺", "制作 / 副业类", "固定", "1 张", "18×18", "区分采集线与制作线"],
    ["SEAL_POT", "食印 · 锅", "烹饪 / 对决", "固定", "1 张", "18×18", "取「灶」意"],
    ["SEAL_TEAPOT", "食印 · 茶壶", "地窖 / 饮品", "固定", "1 张", "18×18", "酒窖、陈酿、茶类"],
    ["SEAL_STEAMER", "食印 · 蒸笼", "烘焙 / 保鲜", "固定", "1 张", "18×18", "蒸制类功能"],
    ["BADGE_S/M/L", "徽章印泥块（3 档）", "徽章 / 状态片（35 变体）", "固定", "3 张", "13 / 18 / 22px 高；形状不规则、边缘晕开，像随手盖的章", "🔴 小件不加撕边，只保留印泥毛边（否则糊）"],
    ["CHECK_ON/OFF", "手绘复选框（2 档）", "复选框 / 任务列表", "固定", "4 张", "16 / 22px；未选：手绘方框（四角不齐）；选中：朱红手写勾 + 框", "替换现在的粗体勾与 ✓ 字符"],
    ["LOCK_LINEWORK", "线稿铜锁", "锁定态", "固定", "1 张", "**按高度渲染 height:13px / width:auto**（素材 491×743 是竖长件）", "替换 🔒 emoji"],
    ["STEAM_LINE", "蒸气曲线", "面板顶部 / 弹窗台头 / 表格上方", "可拉伸", "1 张", "宽自适应 ×8，手绘 1px 曲线，两端平收", "preserveAspectRatio=none"],
    ["LINE_CHOPSTICK", "筷子双线", "表格行 / 日志行", "可拉伸", "1 张", "一条手绘墨线，横向拉伸；用时叠两条、间距 3px", "行高 <24px 用单条"],
    ["LINE_STROKE", "手绘竖笔（红/铜/琥珀）", "区块标题 / 日志级别 / 页签选中", "可拉伸", "3 张", "2px 宽、15~30px 高；起收笔有锋", "三种颜色；也可用 CSS 边框代替"],
    ["WM_PLATE", "水印 · 餐盘", "卡片右下角", "固定", "1 张", "62×62，线稿，6% 不透明度使用", "整屏铺开形成「一桌菜」的暗示"],
    ["WM_STEAMER", "水印 · 蒸笼", "面板 / 弹窗角", "固定", "1 张", "72×72，与餐盘二选一", "别同时出现"],
    ["WM_CHOPREST", "水印 · 筷架", "物品图底座", "固定", "1 张", "**96×60**（素材是横件）", "只在物品图小方框里用"],
]

# 素材张数（从清单算，避免手写数字漂移）
ART2 = []
for row in ART:
    frag = REUSE.get(row[0], ("", ""))
    # ⚠️ 片段要能排除同族里更具体的文件：'plaque_normal' 会同时命中 'lacquer_plaque_normal'
    EXCL = {"plaque_normal": "lacquer"}
    ex = EXCL.get(frag[0], "")
    hit = sorted(f for f in EXISTING if frag[0] and frag[0] in f and (not ex or ex not in f)) if frag[0] else []
    col1 = (hit[0].replace("@2x_color.png", "").replace("@2x_mask.png", "") + "（color+mask 各 1）") if hit else "—（无对应文件）"
    ART2.append(list(row) + [col1, frag[1] or "➕ 新增", INSPECT.get(row[0], "—")])
for _o in OBSOLETE:
    ART2.append(["（旧素材处置）", _o[0], "旧方案遗留", "—", "—", "—", "—", "已存在（见左）", _o[1], "—"])

ART_TOTAL = sum(int(__import__("re").search(r"(\d+)", str(a[4])).group(1)) for a in ART)
ART_GROUPS = len(ART)
ART_PULL = sum(1 for a in ART if a[3] == "可拉伸")
ART_FIXED = ART_GROUPS - ART_PULL


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
    ["🔴 素材口径", f"**丰富档 + 不规则单图**：{ART_GROUPS} 组素材 ⇒ 出图 {ART_TOTAL} 张（其中 {ART_PULL} 组是可九宫格拉伸的帧，覆盖该族全部尺寸）；另有 A 路线（SVG 滤镜）可做到 0 位图。详见「素材清单」「路线取舍」"],
    ["🔴 避免的坑", "控件尺寸一律沿用现测尺寸（表 4「实测尺寸」列）。尺寸一改，e2e-layout 的 103 页扫描立刻红"],
    ["🔴 染色约束", "素材一律出「白纸 + 透明线」（灰度/alpha），颜色交给 token ⇒ 15 套皮肤 + 深色模式自动跟随；只有朱红印泥块允许本色"],
    ["", ""],
    ["分表导航", "风格总纲（定调）· Token 映射（接线）· 控件族规范（226 行：专属尺寸 + 材质要点 + **完整出图提示词**）· 页面×控件（930 行）· 提示词模板 · 素材清单（31 组）· 路线取舍 · SVG 资产清单 · 交付与切片"],
    ["本表怎么用", "① 读风格总纲定调 → ② 按 Token 映射改 main.css（浅深两套）→ ③ 写 .ui-paper/.ui-ink/.ui-seal 三个基类 → ④ 照「控件族规范」逐族替换 → ⑤ 用「页面×控件」核对每页用到哪些、各多大 → ⑥ 按「交付与切片」的 6 步顺序接入，每步跑守卫"],
    ["生成脚本", "scripts/dev/build_ui_spec_xlsx.py（底表 ui_inventory.mjs 可随时重跑，改版后量测自动更新）"],
    ["校验", "openpyxl audit + scan + validate 全过（本表无公式 ⇒ 不需要 recalc）"],
    ["样张", "docs/ui-mockup/风格样张-新中式美食-三档浓度.png（最右列 = 本方案按真实密度铺开的样子）"],
    ["实测补充", f"全站 {ALL_CTL} 个控件里 {GLASS_CTL} 个（{round(GLASS_CTL/ALL_CTL*100)}%）带毛玻璃 —— 新方案只在弹窗保留一层，其余改不透明纸面"],
]
sheet("说明", "全 UI 改版规范 · 说明", ["项", "内容"], rows1, max_width=90)

# ② 风格总纲
rows2 = [
    ["风格名", STYLE_NAME, "一句话：白纸黑字的一张菜谱，但每一件都是手作 —— 手撕纸、毛笔框、印泥块、竹签"],
    ["档位", "**丰富档**：食印 / 蒸气曲线 / 餐具水印 / 筷子双线 / 汤汁进度 / 线稿勾锁 —— 六类美食元素全部启用", "上一轮样张里的「克制档 / 中等档」不再考虑；丰富档的代价是素材更多、必须靠纪律控制噪音"],
    ["为什么换掉木牌", "v0 的木牌+黄铜+木纹在 3573 个控件这种密度下变成噪音，硬投影又显旧", "复盘：器物拟物适合少数大控件，不适合「每张卡片、每个按钮」都上一遍"],
    ["", "", ""],
    ["🔴 这次的核心变化", "**元素可以是不规则图形，也可以是一张图充当元素**（不再要求用 CSS 画矩形）", "素材从「装饰 SVG」升级为「控件本体图」；好处是笔触与手感可控，代价是必须控制出图数量（见「素材清单」）"],
    ["两条实现路线", "**A 路线**：SVG 滤镜（feTurbulence + feDisplacementMap）把矩形变成手撕边 ⇒ 0 素材、任意尺寸；**B 路线**：每族一张不规则轮廓图 ⇒ 观感最讲究", "建议混合：**帧与小件走 B（8 + 12 张），动态/多尺寸的走 A**；两条路线的视觉参数必须对齐（撕边幅度 3~4px、毛糙频率一致）"],
    ["撕边幅度基准", "大件（卡片/面板/弹窗）：位移 3.5~4px；中件（按钮/输入框）：2~2.5px；小件（徽章/复选）：≤1.5px", "幅度必须按控件尺寸递减 —— 统一用 4px 会让 13px 的徽章糊成一团"],
    ["", "", ""],
    ["底子 · 纸与墨", "纸白 #FAF7F2（页面底）· 纯白 #FFFFFF（卡片面）· 墨字 #2B2622 · 次要字 #7C7268", "只有纸与墨两种色；靠留白与一档亮度差分层面，不靠描边"],
    ["底子 · 铜线", "1px #C9AE86（深色 #D8BE93），只用于描边与分隔（永不填充）", "细到像铅笔线；手绘线可以粗细不均，但**平均**线宽只有 1px"],
    ["底子 · 朱红", "朱红 #A6371F，只出现在：选中态、主按钮、食印、左侧竖标、进度填充", "🔴 **全屏朱红面积 <2%** —— 这条是「不土」的保险丝，v0 死在色块太多"],
    ["底子 · 琥珀 / 淡米", "琥珀 #E08A3C（汤汁终点、警告）· 淡米 #EFE7DA（徽章底、槽、按下态）", "琥珀不做控件底色；淡米是第三层灰面，替代现在散落的 6 种近似白"],
    ["", "", ""],
    ["美食元素 · 食印", "朱红圆角方印 + 白色线稿剪影（碗/筷/勺/锅/茶壶/蒸笼 6 枚）；**印面边缘要晕开**", "侧栏选中、主按钮左侧、重要标记；这是本风格的「签名」"],
    ["美食元素 · 蒸气曲线", "手绘细曲线（铜线 55%，preserveAspectRatio=none 宽度自适应）", "面板顶部、弹窗台头，替代生硬的 1px 分隔线"],
    ["美食元素 · 餐具水印", "餐盘 / 蒸笼 / 筷架 3 枚线稿，**6% 不透明度**，贴卡片与物品图右下角", "几乎看不见，整屏铺开有一点厨房气质；超过 10% 就变脏"],
    ["美食元素 · 筷子双线", "两条手绘墨线（不是直尺线），间距 3px", "只用于表格行与日志行；行高 <24px 退回单线"],
    ["美食元素 · 汤汁进度", "填充 = 红烧汤汁渐变（朱红→琥珀）+ 末端自然收口 + 顶部 1px 液面高光", "进度条是看得最多的控件，用「汤汁」给它温度"],
    ["美食元素 · 线稿勾与铜锁", "手写感对勾（起笔粗收笔尖，朱红）· 线稿铜锁（方形锁体 + 匙孔）", "替换现在的 🔒 emoji 角标与粗体勾"],
    ["🔴 元素使用纪律", "同一屏最多出现 2 类美食元素；**撕边只出现在大件与中件**（卡片/面板/按钮/输入框），小件（徽章/勾/锁/进度）保持干净", "丰富档最容易犯的错：把撕边也加到 13px 的徽章上 ⇒ 糊成一团"],
    ["", "", ""],
    ["几何 · 圆角与边", "不规则本身就是「圆角」：大件撕边 3.5~4px、中件 2~2.5px、小件 ≤1.5px；表格行 0", "取代现行的 10 种规整圆角（6/0/10/9/999/4/8/50%/5/14px 混用）"],
    ["几何 · 描边", "手绘 1px 铜线（可粗细不均）· 选中 1px + 2px 朱红手绘左标 · 禁用线转灰", "禁止 ≥2px 的均匀粗描边（那会立刻变成「素材库风格」）"],
    ["几何 · 投影", "常态 0 1px 2px rgba(70,50,30,.05)；悬停 0 2px 6px；弹窗 0 10px 30px rgba(60,45,30,.14)", "取消硬投影 —— 那是最显旧的一处"],
    ["几何 · 内边距", "按钮横向 10px / 纵向 4px；卡片 10px；面板 12px", "与现行实测一致（不改变版式）"],
    ["几何 · 字阶", "11 / 12 / 13 / 14px 四档，行高 1.55；标题字可加 letter-spacing .02em", "取代现行的 7 档（含 13.3333px 与 16.38px 两个非整数值）"],
    ["", "", ""],
    ["状态 · 常态", "不规则纸面 + 手绘铜线 + 极柔投影", "基准"],
    ["状态 · 悬停", "底色转纯白 + 线色加深 8% + 投影 0 2px 6px", "纸面「被照亮」，不做位移"],
    ["状态 · 按下", "底色转淡米 #F3EDE3 + 移除投影（像被按进桌面）", "与悬停反向：一亮一暗"],
    ["状态 · 禁用", "去饱和 60% + 不透明度 45% + 线转灰；**保留撕边轮廓**", "不许只降 opacity：文字会看不见"],
    ["状态 · 选中/开启", "白面 + 手绘线 + **朱红字** + 左侧 2px 朱红手绘竖标；重要项加一枚食印", "页签、开关、列表选中、当前目标统一用这一套"],
    ["状态 · 锁定", "线稿铜锁（灰褐）+ 文字 #A09079；不加蒙层", "纸面语言里蒙层会造第二层灰"],
    ["", "", ""],
    ["动效", "底色/线色过渡 140ms ease-out；不做位移、不做缩放", "纸不动，只有颜色与投影变化"],
    ["", "", ""],
    ["现状问题（实测）", "3573 个控件里圆角 10 种、字号 7 种、控件高度 12 档、58% 带毛玻璃", "证据：ui-inventory.json。统一目标：3 档撕边 / 4 字阶 / 1 线宽 / 3 个面"],
    ["现状问题（实测）", "近似白底色写了 6 遍：rgba(255,252,246,.3/.85/.86)、rgba(255,251,244,.86) 等", "统一后只留 3 个面（纸白/纯白/淡米），全部走 token"],
    ["现状问题（实测）", "毛玻璃覆盖 58% 控件且强度不一（backdrop-filter 6~20px）", "新方案只在弹窗保留一层模糊（纸背透光），其余改为不透明纸面 ⇒ 顺带省渲染开销"],
    ["", "", ""],
    ["🔴 皮肤的额外要求", "不规则图**不能烘死颜色**：出「白纸 + 透明线」的灰度版，线色/底色由 CSS 上色", "15 套皮肤：换皮肤 = 改 token；若素材自带墨色，深色模式下就会与背景糊在一起"],
    ["🔴 深色硬约束", "每个新 token 必须浅深两套都定义", "深色 = 墨底纸字（#1C1A17 / #26231F / #F2EDE4 / 铜线 #D8BE93）；只写 :root 会回落到浅色值"],
    ["🔴 构建硬约束", "构建期 CSS 压缩会改写规则（lightningcss 实测踩过）", "改完必须跑 css_output_audit.mjs"],
    ["🟡 两条路线怎么选", "A：2 段 SVG 滤镜 + 12 个 SVG ⇒ 0 位图、任意尺寸，但笔触随机；B：8 张可拉伸帧 + 12 个不可拉伸小件 ⇒ 观感可控", "建议混合（见「素材清单」）：帧走 B、动态件走 A；两者撕边幅度按上表对齐"],
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
        f"{r0} → 撕边 {F['radius']}px",
        " / ".join(st) if st else "—",
        F["css"], F["food"],
        f"{FORM.get(fam, FORM['卡片'])['form']}｜{'可九宫格拉伸' if FORM.get(fam, FORM['卡片'])['pull'] else '不可拉伸'}｜{FORM.get(fam, FORM['卡片'])['sizes']}",
        a["text"] or "",
        prompt_irregular(fam, cls, (w, h)),
        NEG_IRREGULAR,
    ])
sheet("控件族规范", "控件族规范 · 226 个变体的专属尺寸 + 材质要点 + 出图提示词（丰富档·不规则单图）",
      ["#", "族", "变体类名", "出现页数", "实例数", "实测尺寸（常见）", "实测尺寸范围", "现圆角", "现字号", "现内边距",
       "圆角 → 新", "状态清单", "材质与实现要点", "美食元素位", "素材形态（不规则方式 · 可拉伸性 · 张数）", "代表文案",
       "出图提示词（完整·可直接复制）", "负向提示词"], rows4, max_width=70)

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
    ["本方案要不要提示词", "**要**：丰富档把控件本体做成了「不规则单图」，所以每个族都要出图（表 4 每行都带一条完整提示词）", "与上一版（控件用 CSS、只需 12 个装饰 SVG）不同 —— 这次是「一张图 = 一个元素」"],
    ["提示词在哪", "**「控件族规范」表最后一列**：226 行每行一条完整提示词，已按该变体的实测尺寸与状态填好", "直接复制即可；同族只需替换「尺寸」与「状态」两个值"],
    ["", "", ""],
    ["七段结构", "【主体】控件名 + **轮廓必须是不规则的**：具体怎么不规则｜【尺寸】实测尺寸与 @2x｜【材质】CSS 数值即比例｜【风格】纸白食印 · 现代新中式手作纸感｜【光照】正投影、无透视｜【构图】居中、占 80%、透明边距｜【输出】PNG-24 alpha、@2x、无文字", "顺序固定；同族只改尺寸与状态两处 ⇒ 整套素材观感才一致"],
    ["🔴 不规则是怎么表达的", "不许写「圆角矩形」：要写「手撕宣纸片，四边毛糙、略有起伏、四角不齐」「毛笔一笔画成的方框，四边粗细不均、起收笔有飞白」「印泥块：边缘毛糙外扩、内里实心」", "这是本次提示词与普通 UI 素材最大的差别：普通出图会给你一个规整圆角矩形"],
    ["🔴 撕边幅度", "大件 3.5~4px · 中件 2~2.5px · 小件 ≤1.5px（徽章/勾/锁不加撕边）", "提示词里要写明，否则 AI 会对 13px 的徽章也给你撕边，缩到实机就糊成一团"],
    ["🔴 尺寸要写进去", "写「尺寸 70×24px（@2x 导出 140×48px）」，并要求「元素占画面 80%、四周留透明边距」", "不写尺寸，AI 会给你 1024×1024 的方图，九宫格边距全错"],
    ["", "", ""],
    ["染色要求（关键）", "在提示词里加一句：「**白纸 + 透明线**，线色与底色留空由调用方上色」（只有朱红印泥块允许本色）", "15 套皮肤：素材自带墨色的话，深色模式下会和背景糊在一起"],
    ["生成参数建议", "CFG 5~6（>7 会出均匀描边，立刻变素材库风格）· 步数 24~28 · 尺寸就用导出尺寸 · **同族固定随机种子**", "种子一变，撕边的随机纹路就变，同屏会出现两种纸质"],
    ["负向词（已内置在表 4）", "完美矩形、笔直的边、数学对称、圆角规整、均匀描边、几何图形感、塑料质感、金属高光、霓虹、3D 浮雕、渐变彩虹、通用 UI 素材库风格、emoji、文字/水印、背景或投影", "线稿类（食印/水印/勾/锁）用另一条：另加「立体感、多彩、纹理、噪点」"],
    ["", "", ""],
    ["验收一图流", "把同族的常态/悬停/按下/禁用排一行，缩到实机尺寸看：撕边幅度是否随尺寸递减、是否都不像规整矩形、同族纸质是否一致", "任何一张与其余不一致 ⇒ 只重出那一张，别整套重跑"],
]
sheet("提示词模板", "提示词模板（本方案只需 12 个装饰 SVG；控件由 CSS 画）", ["项", "内容 / 可直接复制", "说明"], rows6, max_width=95)

# ⑧ 素材清单（丰富档，两条路线）
rows8 = [
    ["A 路线（零素材）", "2 段 SVG 滤镜 + 12 个装饰 SVG ⇒ **0 位图**", "滤镜：feTurbulence(baseFrequency .028/.06) + feDisplacementMap(scale 4) 就能把矩形变手撕边；小件把 scale 降到 1.5。缺点：笔触随机、不可控、不能用 AI 出笔触"],
    ["B 路线（本表按此出图）", f"{ART_GROUPS} 组素材 ⇒ 实际出图 {ART_TOTAL} 张；其中 {ART_PULL} 组是可九宫格拉伸的帧（覆盖全部尺寸），{ART_FIXED} 组是不可拉伸的小件", "观感最讲究、笔触可控；代价是要出图，且必须遵守「撕边幅度按尺寸递减」"],
    ["建议的混合方案", f"帧与不可拉伸小件走 B（{ART_PULL} + {ART_FIXED} 组）；纯装饰类（蒸气曲线/筷子双线/竖笔）用 CSS 边框或内联 SVG 即可，不必出图", "既拿到手绘质感，又不至于为每条分隔线出图"],
    ["出图总量", f"共 {ART_TOTAL} 张（含徽章 3 档、复选 2 档×2 态、竖笔 3 色）；若只做核心 8 帧 + 6 食印 + 3 水印 = 17 张也能先跑起来", "对照：v0 木牌方案 24 张位图 / 1:1 口径 870 张"],
    ["🔴 染色纪律", "所有不规则图出「**白纸 + 透明线**」或「灰度 + alpha」，颜色由 CSS token 上色", "15 套皮肤：素材若自带墨色，深色模式下会和背景糊在一起；只有朱红印泥块允许本色"],
    ["🔴 撕边幅度", "大件 3.5~4px · 中件 2~2.5px · 小件 ≤1.5px（徽章/勾/锁不加撕边）", "统一用 4px 会让 13px 的徽章糊成一团 —— 这是丰富档最容易踩的坑"],
    ["推荐执行顺序", "① 先出 4 张定调：FRAME_CARD / FRAME_BTN / FRAME_BTN_RED / SEAL_BOWL → ② 拼一屏真实页面确认手作感 → ③ 再补其余", "31 张的量下，先定调几乎不花成本"],
    ["验收", "拼一屏核对：朱红 <2% · 同屏美食元素 ≤2 类 · 撕边幅度按尺寸递减 · 各排卡片高度齐整", "样张：docs/ui-mockup/风格样张-丰富档-不规则元素-两路线.png"],
]
sheet("素材清单", "素材清单（丰富档 · 不规则单图；A 路线 0 素材 / B 路线约 31 张）",
      ["素材 ID", "素材名", "覆盖范围（实测）", "可拉伸性", "张数", "形态与要点", "备注",
     "现有文件（public/images/ui/）", "复用结论（按磁盘上真实文件核对）", "体检结论（2026-09-23 实检 33 个 png）"], ART2, max_width=62)
sheet("路线取舍", "两条实现路线的取舍与纪律", ["项", "做法 / 数量", "说明"], rows8, max_width=70)

rows9 = [
    ["交付形态", "**不规则单图（B）+ SVG 滤镜（A）混合**：帧与小件出图，动态装饰用 CSS/SVG", "比 v0（24 张位图）多 7 张，但换来「每一件都是手作」的观感"],
    ["CSS 三个基类", ".ui-paper（纸面：不规则帧 + 极柔投影）· .ui-ink（墨字三档层级）· .ui-seal（印泥容器）", "所有控件由这三个基类组合；变体只改尺寸与内边距"],
    ["🔴 色值统一（复检发现）", "印泥/选中/勾/筷子线用的是**纯红 #c0~#d0 0000**，而主按钮是 #a02810；两者并排会明显「一个塑料红、一个砖红」⇒ 统一压到 **朱红 #A6371F**（印泥可略深 #9E2B25）；铜线统一 **#C9AE86**、墨统一 **#2B2622**",
     "改色比重画省事：出图时改色值，或用脚本批量替换色相（素材是纯色块，替换安全）；复检脚本 `scripts/dev/recheck_ui_assets.py` 会打印每张的主色，改完再跑一遍即可核对"],
    ["🔴 切图流水线（新素材必须做）", "新素材全是 **1024×1024 的原始出图**，不能直接进项目。三步：① 按 alpha>40 裁到内容包围盒；② 等比缩放到规范的目标 @2x 尺寸（表 4「导出尺寸」/「素材清单」目标尺寸列）；③ 四周补**透明安全边** ≥ 9-slice 边距（大件 24px、中件 12px）后导出",
     "已实测：33 个 png 全部 1024²、均为 RGBA 透明底；内容包围盒长宽比与目标的比值见「素材体检」记录 —— 可九宫格拉伸的帧不必等比，但**不可拉伸的小件必须等比**（徽章/勾/锁/食印/水印）"],
    ["⚠️ 素材目录里混进了别的文件", "`ui-paper-source/server-chain.pem`（一份 TLS 证书链）+ `_smoke.png`（冒烟测试图）不是素材，移出该目录、**不要入库**",
     "证书链文件留在源码目录里既无意义也会引起安全审查（本仓库是公开的）"],
    ["命名与 manifest（沿用你现有约定）", "文件名：`<族>/<形态>_<状态>_<w>x<h>@2x_color.png` + `_mask.png`；`public/images/ui/manifest.json` 每条含 id / family / size / slice_px / mask / colour / css{border-image-slice,width,repeat}",
     "与你已生成的 45 个文件完全一致 ⇒ 生成脚本不用改，只把「形态名」换掉（plaque→brush_frame、paper_card→torn_paper_card、brass_tag→seal_badge…），并在 manifest 里**新增两个字段**：`form`（不规则方式）与 `pull`（true=可九宫格拉伸 / false=固定尺寸）"],
    ["由此产生的复用结论", f"你已生成的 {len(EXISTING)} 个 png 里：✅ 可复用/保留 {sum(1 for a in ART2 if str(a[-1]).startswith('✅'))} 组 · 🔧 需重出 {sum(1 for a in ART2 if str(a[-1]).startswith('🔧'))} 组 · ➕ 新版新增 {sum(1 for a in ART2 if str(a[-1]).startswith('➕'))} 组 · 🟡 可选 {sum(1 for a in ART2 if str(a[-1]).startswith('🟡'))} 组 · ❌ 不再需要 {sum(1 for a in ART2 if str(a[-1]).startswith('❌'))} 组", "详见「素材清单」最后两列（逐条按磁盘上的真实文件名核对）"],
    ["九宫格用法", "border-image-slice: {N} fill; border-image-repeat: stretch —— {N} 取「素材清单」的撕边幅度 ×3（如 4px 撕边用 12）", "`fill` 必须有，否则中间会被清空；**不规则边必须落在 slice 区域内**才能保持不变形"],
    ["不可拉伸件用法", "background-image + background-size: 100% 100%（按实测尺寸出图，一张一个控件）", "徽章 3 档、勾 2 档、食印 6 枚、水印 3 枚 —— 这些本来就尺寸固定"],
    ["染色与皮肤", "换皮肤 = 改 --paper / --paper-lift / --ink / --copper / --vermilion / --amber 六个数", "素材出「白纸 + 透明线」，颜色全交给 token ⇒ 15 套皮肤 + 深色自动跟随"],
    ["深色模式", "墨底纸字：--paper #1C1A17 / --paper-lift #26231F / --ink #F2EDE4 / --copper #D8BE93", "朱红在深色下提亮到 #B8452C，否则暗底上发闷"],
    ["窄屏（390px）", "控件尺寸不变；卡片网格 5 → 2 列；左栏改抽屉；**撕边幅度减半、水印与蒸气隐藏**", "小屏上撕边最容易变噪点"],
    ["接入顺序（6 步）", "① 落 token → ② 三个基类 + 九宫格接上帧 → ③ 页签与按钮 → ④ 徽章/进度/输入/复选 → ⑤ 卡片与面板（含水印）→ ⑥ 弹窗、筷子双线、竖笔", "每步跑一次守卫，别攒到最后"],
    ["每步必跑的守卫", "css_output_audit.mjs（构建期 CSS 压缩会改写规则）· e2e-layout.spec.mjs（裁切/竖排）· e2e-dark.spec.mjs（5 皮肤 × 浅深对比度）· e2e-text.spec.mjs（标记裸露）", "四条里任何一条红都别继续下一步"],
    ["禁止事项", "① 破例用规整矩形 ② 条撕边加到小件上 ③ 朱红面积 >2% ④ 素材烘死墨色 ⑤ 新增圆角/字阶档位 ⑥ 用 emoji 当图标 ⑦ 改控件尺寸", "第 ⑦ 条：尺寸一改，e2e-layout 的 103 页扫描立刻红"],
    ["验收 1 · 观感", "整屏朱红 <2% · 同屏美食元素 ≤2 类 · 撕边幅度按尺寸递减 · 各排卡片高度齐整", "拼一屏真实页面看"],
    ["验收 2 · 一致性", "三档撕边 / 4 档字阶 / 1 种线宽 / 3 个面；不规则笔触来自同一套参数（同 seed）", "可用 scripts/dev/style_fingerprint.mjs 逐页对指纹"],
    ["验收 3 · 皮肤", "15 套 × 浅深 30 种组合对比度 ≥ 4.5:1；素材为白纸+透明线时可正确染色", "e2e-dark 的判据"],
    ["验收 4 · 功能", "无被裁控件、无逐字竖排、无标记裸露、九宫格拉伸无断裂、构建产物与源码一致", "四条守卫全绿；九宫格断裂需人眼看一眼"],
    ["范围说明", "本次只换「外壳」：按钮/卡片/面板/框/进度条/页签/徽章/输入/表格/日志。不含物品图 2427 张、立绘 248 张、小游戏内部画面、山海食经画布", "那三块各有独立规范，另立交付"],
]
sheet("交付与切片", "交付、接入与验收规范（不规则单图 + 九宫格）", ["项", "内容", "说明"], rows9, max_width=95)
if "Sheet" in wb.sheetnames:
    wb.remove(wb["Sheet"])
wb.save(OUT)
print("saved:", OUT)
print("sheets:", wb.sheetnames)
print(f"rows: 说明 {len(rows1)} · 风格总纲 {len(rows2)} · Token {len(rows3)} · 控件族 {len(rows4)} · 页面×控件 {len(rows5)} · 提示词 {len(rows6)} · 桌面素材 {len(ART)} · 路线取舍 {len(rows8)} · 交付 {len(rows9)}")
