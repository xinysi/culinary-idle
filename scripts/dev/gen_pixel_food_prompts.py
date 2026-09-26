# -*- coding: utf-8 -*-
"""像素美食风 · 全站 UI 出图提示词生成器（2026-09-23）

用户要求：新的一套 UI，**覆盖所有页面 UI 与元素**、**不规则形状**、**像素美食风**，要详细提示词。

🔴 这份提示词是**派生**的，不是手抄的 —— 所有尺寸/页数/元素数都从下面这些真实来源算出来：
  · `scripts/dev/ui-inventory.json` —— 真实浏览器逐页枚举：105 页 / 3573 个控件 / 14 个控件族 / 226 个「族|类名」变体
  · `src/game/data/featureGroups.js` —— 左栏功能磁贴（现为 emoji）
  · `src/views/MinigamesView.vue` —— 27 款小游戏（现为 emoji）
  · `src/game/data/skills.js` —— 38 个技能（技能页图标位 = emoji）
  · `public/images/ui-food-pixel/manifest.json` —— 用户今天已生成的 32 件像素套（本套的对照基准）

产出（都在 `docs/`，本地、**绝不入库**）：
  · docs/ui-pixel/像素美食UI_出图提示词_v1.md    人读 + 可复制
  · docs/ui-pixel/像素美食UI_出图提示词_v1.json  机读（供 pixelize_ui.py 与批量脚本用）

用法：python scripts/dev/gen_pixel_food_prompts.py
"""
import collections
import json
import re
from pathlib import Path

# 本地开发脚本，读写目标一律是**字面量常量路径**（不接受任何外部参数）
OUT_DIR = Path(r"D:\plays\lmew\docs\ui-pixel")
MD_PATH = OUT_DIR / "像素美食UI_出图提示词_v1.md"
JSON_PATH = OUT_DIR / "像素美食UI_出图提示词_v1.json"

# 只读数据源（同样是字面量）
INVENTORY_PATH = Path(r"D:\plays\lmew\scripts\dev\ui-inventory.json")
FEATURE_GROUPS_PATH = Path(r"D:\plays\lmew\src\game\data\featureGroups.js")
SKILLS_PATH = Path(r"D:\plays\lmew\src\game\data\skills.js")
MINIGAMES_PATH = Path(r"D:\plays\lmew\src\views\MinigamesView.vue")

# ══════════════════════════════════════════════════════════════════════════════
# 一、像素网格（这套东西的地基，所有尺寸都由它推出）
# ══════════════════════════════════════════════════════════════════════════════
# 1 逻辑像素 = 2 css px；导出 = css × 2 ⇒ **1 逻辑像素 = 4 导出像素**
LOGICAL_CSS = 2
EXPORT_SCALE = 2
GRID = LOGICAL_CSS * EXPORT_SCALE          # 4

# 色板：像素美食（浅色套）。前 8 色是主色板，其余是点缀/语义色。
PALETTE_LIGHT = [
    ("描边", "OUTLINE", "#1A1208", "近黑暖调，所有件的统一轮廓色（唯一允许的近黑色）"),
    ("奶白", "CREAM", "#F8E8C8", "面类件的亮阶：饼干、面皮、奶酪的主体色"),
    ("奶油", "BUTTER", "#F8D8B8", "面类件的基色：比奶白低一阶，用于内里/凹陷"),
    ("烤饼棕", "TOAST", "#D89868", "中阶棕：面包皮、烤过的边缘"),
    ("深烤棕", "TOAST_D", "#A86838", "暗阶棕：底部阴影、焦边"),
    ("蛋黄黄", "YOLK", "#F8C848", "高光/进度/金币；也是「已获」的正向色"),
    ("番茄红", "TOMATO", "#D82818", "强调色：主按钮、选中页签、警告"),
    ("深番茄", "TOMATO_D", "#A81808", "番茄红的暗阶（按下态/阴影）"),
    ("海苔绿", "NORI", "#5A7A2A", "成功态/已完成（少量使用）"),
    ("芝麻灰", "SESAME", "#B8B8A8", "禁用/锁定件的中性色"),
]
PALETTE_DARK = [
    ("描边", "OUTLINE", "#E8D0A0", "深色下描边反过来用亮暖金，否则轮廓在暗底上消失"),
    ("奶白", "CREAM", "#4A3828", "原亮阶 → 深烤棕系"),
    ("奶油", "BUTTER", "#3A2C1E", "原基色 → 更深一阶"),
    ("烤饼棕", "TOAST", "#2A2018", "原中阶 → 接近底色（深色下面类件要压得很暗）"),
    ("深烤棕", "TOAST_D", "#1C1410", "原暗阶 → 页面底色"),
    ("蛋黄黄", "YOLK", "#E8B838", "语义色**原样保留**（深色下继续用黄/红，才认得出来）"),
    ("番茄红", "TOMATO", "#C82818", "语义色原样保留"),
    ("深番茄", "TOMATO_D", "#901808", "—"),
    ("海苔绿", "NORI", "#7A9A4A", "深色下略提亮以保对比"),
    ("芝麻灰", "SESAME", "#6A6A60", "—"),
]

# ══════════════════════════════════════════════════════════════════════════════
# 二、风格锚（每张图都带；三段可整段复制）
# ══════════════════════════════════════════════════════════════════════════════
STYLE_CN = (
    "像素美食风（Pixel Food UI）：16-bit 像素游戏的 UI 素材，正投影正视（无透视、无斜视）。"
    "整幅画面由**可见的粗像素方格**构成 —— 每个逻辑像素是一个实心方块，边缘是**硬阶梯**，"
    "没有抗锯齿、没有模糊、没有半透明羽化、没有抖动（dithering）。"
    "材质是**食物做的**：饼干、烤面包、奶酪、面皮、番茄酱、蛋液、海苔、竹帘、木砧板 —— "
    "但**只体现在颜色与颗粒上**，不许把控件画成具体可辨认的食物造型（不是画一块真饼干，是「饼干色的方块」）。"
    "轮廓**不规则**：四边长度不等、四角切得不一样深、边缘有 1~2 处被咬掉/烤焦的小缺口。"
)

STYLE_EN = (
    "pixel art game UI asset, 16-bit retro style, single flat 2D front view (orthographic, straight-on), "
    "drawn on a coarse visible pixel grid, every logical pixel a crisp solid square, hard stair-stepped edges, "
    "strictly no anti-aliasing, no blur, no soft gradient, no dithering, no noise, "
    "at most 8 flat colors in the whole image, one thick 1-logical-pixel near-black outline around the silhouette, "
    "single flat light source from the top-left with only a 2-step shade (base tone plus a darker tone on the "
    "bottom and right edges), warm baked-food material colors (biscuit tan, toast brown, cream cheese white, "
    "egg-yolk yellow, tomato red, seaweed green), "
    "irregular hand-placed silhouette: the four sides have slightly different lengths, the four corners are cut "
    "to different depths, one or two small bite-marks or burnt notches sit along the edges, "
    "isolated on a fully transparent background, centered, no text, no letters, no numbers, no watermark"
)

NEG_EN = (
    "anti-aliasing, smooth curve, rounded corner, blurry, soft edges, gradient, dithering, noise, film grain, "
    "realistic, photo, 3D render, isometric, perspective, drop shadow, cast shadow, glow, bloom, bevel, emboss, "
    "chrome, plastic gloss, neon, reflection, "
    "perfectly symmetric, mathematically regular rectangle, uniform stroke width, vector art, flat design, "
    "material design, generic UI kit, "
    "text, letters, numbers, logo, signature, watermark, ui screenshot, mockup, button label, "
    "character, human, face, hands, animal, plate of real food, food photograph, "
    "background scene, wall, floor, sky, checkerboard, any background colour"
)

# ══════════════════════════════════════════════════════════════════════════════
# 三、不规则 8 手法 + 三档幅度（把「不规则」变成能写进提示词的词）
# ══════════════════════════════════════════════════════════════════════════════
IRREGULAR_ALL = [
    ("四角不等深", "四个角各切掉不同阶数的阶梯（例如左上 2 阶、右上 1 阶、右下 3 阶、左下不切）"),
    ("边缘咬口", "一条边上啃进 1~2 处 1~2 逻辑像素深的缺口，像被咬过一口"),
    ("线宽交替", "外轮廓线在 1 逻辑像素与 2 逻辑像素之间交替，不是均匀等宽"),
    ("边长不等", "对边长度不相等，整体轻微偏心（不是数学矩形）"),
    ("端点收锋", "条状件的两端收成阶梯斜口，不是平口"),
    ("焦边斑块", "轮廓内侧贴 1~2 处 1 逻辑像素的深色斑（烤焦/酱渍）"),
    ("碎屑外溢", "轮廓外侧散落 1~2 个孤立像素（面包屑），只在边料区内"),
    ("压扁偏移", "整块形状的上下边不平行，像被压过一下"),
]
IRREGULAR_BIG = [0, 1, 2, 6]      # 卡片/面板/弹窗/立绘框
IRREGULAR_MID = [0, 1, 5, 4]      # 按钮/页签/输入框/进度槽/勋章/物品格
IRREGULAR_SMALL = [0, 3]          # 徽章/勾/锁/箭头/小图标：只做 1 像素级不对称，**不许咬口**（缩到实机就糊）
IRREGULAR_NOTE = {
    "big": "撕边幅度 = 3~4 逻辑像素（12~16 导出像素）",
    "mid": "撕边幅度 = 2 逻辑像素（8 导出像素）",
    "small": "幅度 = 1 逻辑像素（4 导出像素）；**小件绝不做咬口与碎屑**",
}

# ══════════════════════════════════════════════════════════════════════════════
# 四、通用件（覆盖 226 个变体 / 14 个控件族）
#    css = 参考显示尺寸（偶数）· slice = 九宫格边（导出像素，GRID 的倍数）· pull = 可拉伸
# ══════════════════════════════════════════════════════════════════════════════
def S(id_, cn, shape_cn, css, slice_px, pull, class_, material_cn, material_en, usage, dark=True):
    return dict(id=id_, cn=cn, shape_cn=shape_cn, css=css, slice=slice_px, pull=pull, cls=class_,
                mat_cn=material_cn, mat_en=material_en, usage=usage, dark=dark)


SLOTS = [
    # ── 面类（大件，可九宫格拉伸）────────────────────────────────────────────
    S("FRAME_CARD", "饼干卡片框", "一张四方饼干片，四角各切掉不同阶数的阶梯",
      (240, 80), 16, True, "big",
      "烤饼干：奶白面身 + 烤饼棕外圈 + 深烤棕焦边；表面只有极淡的 1 像素颗粒（不许成片纹理）",
      "a baked biscuit sheet: cream body, toast-brown rim, dark-brown burnt edge, only a few single-pixel specks",
      "卡片族 493 个 / 105 页全用"),
    S("FRAME_PANEL", "烤面包面板框", "一整块厚吐司片，一条长边切得比另一条更深",
      (260, 60), 16, True, "big",
      "厚吐司：比卡片深一阶的烤饼棕基色 + 深烤棕底边 + 一条浅色烤纹",
      "a thick toast slab: one shade darker than the biscuit, dark-brown bottom edge, one light toasted stripe",
      "面板族 259 个 / 侧栏、主内容区、抽屉、底部胶囊"),
    S("FRAME_MODAL", "木砧板弹窗框", "一块木砧板，四角是圆钝的阶梯（唯一允许「圆」的地方）",
      (280, 200), 16, True, "big",
      "木砧板：烤饼棕木身 + 深烤棕木纹线（只沿一条边）+ 顶部一小块番茄红印记",
      "a wooden cutting board: toast-brown wood, dark grain lines along one edge, one small tomato-red stamp on top",
      "弹窗（唯一保留一层纸背透光的件）"),
    S("FRAME_PORTRAIT", "立绘相框", "方形相框，内圈留出四边不等的留白",
      (64, 64), 8, True, "mid",
      "相框：深烤棕框条 + 内侧 1 逻辑像素奶白衬边（衬托 512px 立绘）",
      "a square picture frame: dark-brown bars with a 1-pixel cream inner liner",
      "立绘位：区域 56 / 首领 64 / 战斗屏 64 / 竞技场 / 厨师卡"),
    S("ITEM_SLOT", "物品格底板", "竹帘小方格，四边各有一处 1 像素缺口",
      (52, 52), 8, True, "mid",
      "竹帘：奶白底 + 单向竹条线（沿短边贯通，1 逻辑像素）+ 深烤棕四角",
      "a bamboo mat cell: cream base with single-pixel bamboo slats running one way, dark-brown corners",
      "物品图底板 79 个 / 48 页；物品图本身是已有的 32/64px 精灵"),
    # ── 按钮 / 页签（中件）──────────────────────────────────────────────────
    S("FRAME_BTN", "小饼干按钮框", "小方块饼干，三个角切 1 阶、一个角不切",
      (100, 24), 8, True, "mid",
      "小方块饼干：奶白面身 + 烤饼棕下沿；悬停靠 CSS 提亮，不另出图",
      "a small square cracker: cream face with a toast-brown lower lip",
      "按钮族 840 个 + 图标按钮族 105 个 / 105 页全用"),
    S("FRAME_BTN_PRIMARY", "番茄酱主按钮框", "压扁的番茄酱块，边缘有一圈外溢的酱边",
      (120, 32), 8, True, "mid",
      "番茄酱块：番茄红实心 + 深番茄右下暗阶 + 一圈不规则外溢酱边（由暗阶像素簇构成）",
      "a flattened tomato-sauce patty: solid tomato red, darker red on the bottom-right, an irregular sauce rim",
      "主按钮族 173 个 / 85 页（全站最大面积的强调色）"),
    S("FRAME_TAB", "面皮页签框（常态）", "一片饺子皮，左右两端收成阶梯斜口",
      (100, 24), 8, True, "mid",
      "饺子皮：奶油基色 + 奶白上沿 + 深烤棕下沿；中段只留平色",
      "a dumpling wrapper strip: butter base, cream top lip, dark-brown bottom lip",
      "页签族 840 个 / 105 页全用（7 个页签家族共用）"),
    S("FRAME_TAB_ON", "番茄酱页签框（选中）", "同面皮，但整片染上番茄酱",
      (100, 24), 8, True, "mid",
      "染了番茄酱的饺子皮：番茄红基色 + 蛋黄黄高光边 + 深番茄下沿",
      "a dumpling wrapper soaked in tomato sauce: tomato-red base, egg-yolk highlight rim, darker red bottom",
      "页签选中态（两种约定：.active 与 btn-primary）"),
    S("FRAME_INPUT", "手擀面输入框框", "一根被压扁的长面条，围成扁框",
      (180, 26), 8, True, "mid",
      "手擀面：奶白基色 + 深烤棕 1 逻辑像素内沿；聚焦态不另出图（CSS 把内沿染番茄红）",
      "a flattened hand-rolled noodle ring: cream base with a 1-pixel dark-brown inner rim",
      "输入框族 10 个 / 10 页；下拉族 10 个共用（箭头另出 ICON_ARROW）"),
    S("FRAME_FOCUS", "聚焦小框", "一圈 1 像素的番茄红虚线阶梯",
      (24, 16), 4, True, "mid",
      "番茄红虚线框：线段与空隙各 1 逻辑像素，四角断开不闭合",
      "a tomato-red dashed pixel ring: 1-pixel dashes with 1-pixel gaps, corners left open",
      "输入框/徽章聚焦态（替代 box-shadow: 0 0 0 2px）"),
    # ── 进度（可拉伸 + 平铺）───────────────────────────────────────────────
    S("FRAME_BAR_SLOT", "酱汁空槽", "两根平行的面条夹出一条槽，两端收锋",
      (224, 18), 8, True, "mid",
      "空槽：奶油基色内凹 + 上下各一根 1 逻辑像素深烤棕面条；**整条贯通**（拉伸后仍是直线）",
      "an empty sauce trough: butter base with one dark-brown noodle line along the top and one along the bottom",
      "进度条族 161 个 / 61 页（血条/经验/精通/饱食）"),
    S("TEX_BAR_FILL", "汤汁平铺纹理", "8×8 逻辑像素的横向汤汁条纹（不是九宫格，是平铺）",
      (8, 8), 0, True, "small",
      "半透明汤汁横纹：透明底 + 两行 50% 白、一行 25% 黑的横向 1 像素纹；下方垫 CSS 纯色即成任意色进度条",
      "a translucent sauce stripe tile: two rows of 50% white and one row of 25% black over transparency",
      "8 种进度填充色 × 一套纹理（比出 8 张图省 7 张）"),
    S("SCROLL_THUMB", "滚动条滑块", "一截短面条，两端收成阶梯",
      (8, 32), 4, True, "small",
      "短面条滑块：烤饼棕基色 + 深烤棕上下端",
      "a short noodle scrollbar thumb: toast-brown base with dark-brown ends",
      "全站自定义滚动条（侧栏/主滚动/抽屉）"),
    # ── 小件（固定尺寸，一张图 = 一个元素）────────────────────────────────
    S("SEAL_BOWL", "食印·碗", "一枚方形食物戳印，四角切 1 阶", (18, 18), 0, False, "small",
      "印面：番茄红底 + 奶白线稿碗形（印面挖白）+ 边缘 1 像素晕开",
      "a square food stamp: tomato-red face, cream line-art bowl carved out of it, 1-pixel bleed on the rim",
      "采集类主按钮 / 标题左印"),
    S("SEAL_CHOP", "食印·筷（长印）", "竖长的签形戳印", (16, 20), 0, False, "small",
      "长印：番茄红底 + 两根奶白筷子剪影", "a tall stamp: tomato-red face with two cream chopsticks",
      "页签选中 / 菜单签（比例 0.8，勿改成方印）"),
    S("SEAL_SPOON", "食印·勺", "方形戳印，一角多切 1 阶", (18, 18), 0, False, "small",
      "印面：番茄红底 + 奶白勺剪影", "a square stamp: tomato-red face with a cream spoon",
      "制作 / 副业类"),
    S("SEAL_POT", "食印·锅", "方形戳印，一边带小柄", (18, 18), 0, False, "small",
      "印面：番茄红底 + 奶白锅剪影（带柄）", "a square stamp: tomato-red face with a cream cooking pot",
      "烹饪 / 对决 / 塔"),
    S("SEAL_TEAPOT", "食印·茶壶", "方形戳印，壶嘴伸出边界", (18, 18), 0, False, "small",
      "印面：番茄红底 + 奶白茶壶剪影", "a square stamp: tomato-red face with a cream teapot",
      "酒肆 / 饮品 / 灶君"),
    S("SEAL_STEAMER", "食印·蒸笼", "方形戳印，顶部有蒸气缺口", (18, 18), 0, False, "small",
      "印面：番茄红底 + 奶白蒸笼剪影（两层）", "a square stamp: tomato-red face with a cream bamboo steamer",
      "烘焙 / 保鲜"),
    S("BADGE_S", "小徽章（印泥块）", "14×14 的不规则小酱块", (14, 14), 0, False, "small",
      "小酱块：蛋黄黄底 + 深烤棕 1 像素边；**只做一角多切 1 阶**，不许咬口",
      "a tiny irregular sauce blob: egg-yolk base with a 1-pixel dark-brown edge",
      "徽章族 347 个 / 89 页（状态片、减半标签、最佳记录）"),
    S("BADGE_M", "中徽章", "18×18 的小酱块", (18, 18), 0, False, "small",
      "同上放大一档", "same blob, one step larger", "徽章族中档（效果片 33 个）"),
    S("BADGE_L", "大徽章", "22×22 的小酱块，边缘多一处焦斑", (22, 22), 0, False, "small",
      "同上，加一处 1 像素焦斑", "same blob, larger, with one 1-pixel burnt speck",
      "状态片 29 个 / 页签红点 42 个"),
    S("CHECK_OFF_S", "复选框未选（小）", "16×16 的手捏小方饼干", (16, 16), 0, False, "small",
      "未选：奶油底 + 深烤棕 1 像素框，四角各缺 1 个像素",
      "an unchecked tiny square cracker: butter base with a 1-pixel dark-brown frame missing one pixel at each corner",
      "复选框族 5 个 / 任务列表"),
    S("CHECK_ON_S", "复选框已选（小）", "同上 + 番茄酱的勾", (16, 16), 0, False, "small",
      "已选：同上 + 番茄红 1 逻辑像素阶梯勾（**不加底块填充**）",
      "the same cracker with a tomato-red stepped pixel check mark",
      "复选框族 5 个 / 任务列表"),
    S("CHECK_OFF_M", "复选框未选（大）", "22×22 的手捏小方饼干", (22, 22), 0, False, "small",
      "同上放大一档", "same, one step larger", "任务中心 / 设置页"),
    S("CHECK_ON_M", "复选框已选（大）", "同上 + 番茄酱的勾", (22, 22), 0, False, "small",
      "同上放大一档 + 番茄红阶梯勾", "same, larger, with the tomato-red stepped check",
      "任务中心 / 设置页"),
    S("LOCK_PIXEL", "像素锁", "14×14 的饼干色小挂锁", (14, 14), 0, False, "small",
      "芝麻灰锁体 + 深烤棕锁梁；替代现在的 🔒 emoji",
      "a tiny sesame-grey padlock with a dark-brown shackle",
      "锁定态（未解锁技能/皮肤/内容）"),
    S("ICON_ARROW", "下拉箭头", "12×12 的阶梯三角", (12, 12), 0, False, "small",
      "深烤棕阶梯三角，边线 1 逻辑像素", "a dark-brown stair-stepped triangle",
      "下拉族 10 个 / 排序与筛选"),
    S("ICON_CLOSE", "关闭叉", "12×12 的阶梯叉", (12, 12), 0, False, "small",
      "深烤棕阶梯叉；悬停态 CSS 染番茄红", "a dark-brown stair-stepped cross",
      "弹窗 / 抽屉 / 提示条关闭"),
    S("MEDAL_L", "大勋章", "48×48 的奖章（带不规则边缘的圆牌）",
      (48, 48), 0, False, "small",
      "奖章：蛋黄黄盘面 + 烤饼棕外圈 + 番茄红缎带缺角；盘面留一块空位放评分数字（数字**不烘进图**）",
      "a medal: egg-yolk disc, toast-brown ring, tomato-red ribbon notch, blank centre for a number",
      "赛季 / 成就 / 称号 / 里程碑（262 成就 + 122 称号 + 40 赛季共用一张）"),
    # ── 线类与装饰（可拉伸）───────────────────────────────────────────────
    S("LINE_ROW", "行分隔线", "一根面条（水平贯通）", (128, 2), 0, True, "small",
      "面条线：深烤棕 1 逻辑像素，每 2 逻辑像素断 1 像素（虚线）；横向拉伸",
      "a single noodle line: dark brown, 1 pixel on and 1 pixel off, stretched horizontally",
      "表格族 33 个 / 25 页；日志行"),
    S("LINE_STROKE_RED", "竖笔·番茄", "一段 1 逻辑像素宽的番茄红竖条", (2, 24), 0, True, "small",
      "番茄红竖笔，两端各收 1 个像素", "a tomato-red vertical pixel stroke with 1-pixel tapered ends",
      "区块标题族 218 个 / 73 页（左侧竖标）"),
    S("LINE_STROKE_AMBER", "竖笔·蛋黄", "同上的蛋黄黄版", (2, 24), 0, True, "small",
      "蛋黄黄竖笔", "the same stroke in egg-yolk yellow", "日志级别 / 次级标题"),
    S("LINE_STROKE_TOAST", "竖笔·烤棕", "同上的深烤棕版", (2, 24), 0, True, "small",
      "深烤棕竖笔", "the same stroke in dark brown", "中性分隔"),
    S("STEAM_CURVE", "蒸气曲线", "一条 1 逻辑像素的阶梯蒸气，两端平收", (128, 8), 0, True, "small",
      "奶白 1 像素阶梯曲线（宽自适应，preserveAspectRatio=none）",
      "a cream 1-pixel stepped steam curve, flat at both ends",
      "面板顶部 / 弹窗台头 / 表格上方"),
    S("TEX_SHINE", "流光平铺", "16×16 的斜向高光条纹（平铺，配 stats-num 的流光动效）",
      (16, 16), 0, True, "small",
      "透明底 + 一条 3 像素宽的 25% 白斜纹（45° 阶梯）；配 CSS animation 横扫",
      "a translucent diagonal highlight tile: 25% white, 3 pixels wide, stair-stepped at 45 degrees",
      "重要数值/标题的流光（沿用现有 stats-num 的两层机制）"),
    S("BG_TILE", "背景平铺", "64×64 的食物碎屑纹样（面包屑/芝麻/香草叶）",
      (64, 64), 0, True, "small",
      "页面底色 + 极稀的碎屑：底色 = 奶油，碎屑 = 烤饼棕/蛋黄黄，**每 64px 只有 4~6 个 1 像素点**",
      "a page background tile: butter base with only 4-6 single-pixel crumbs of toast brown and egg yolk",
      "全站页面底色（15 皮肤仍改 CSS 变量，位图只管颗粒）"),
    # ── 语义小图标（替代 emoji，见 §7 图标集）────────────────────────────
    S("COIN_PIXEL", "游戏币", "16×16 的圆角梯形金币（阶梯圆）", (16, 16), 0, False, "small",
      "金币：蛋黄黄盘面 + 深烤棕 1 像素边 + 一处高光像素；替代 💰",
      "a pixel coin: egg-yolk disc, dark-brown 1-pixel rim, one highlight pixel",
      "小游戏币 / 金币奖励（现在用 emoji）"),
    S("TICKET_PIXEL", "抽卡券", "24×24 的冰淇淋棍形纸签", (24, 24), 0, False, "small",
      "纸签：奶白签身 + 番茄红斜纹 + 深烤棕边缘缺口；替代 🎟️",
      "a pixel ticket: cream body, tomato-red diagonal stripe, dark-brown notches",
      "觅珍抽卡券 / 赛季券（现在用 emoji）"),
    S("CHEST_PIXEL", "宝箱", "32×32 的木箱 + 番茄红缎带", (32, 32), 0, False, "small",
      "宝箱：烤饼棕箱体 + 深烤棕箱缝 + 番茄红缎带 + 蛋黄黄锁扣；替代 🎁",
      "a pixel treasure chest: toast-brown box, dark seams, tomato-red ribbon, egg-yolk clasp",
      "竞技场 5 连胜宝箱 / 签到 / 里程碑"),
    S("LETTER_PIXEL", "信封", "24×24 的奶白信封", (24, 24), 0, False, "small",
      "信封：奶白纸身 + 深烤棕折线 + 番茄红封蜡；替代 📬",
      "a pixel envelope: cream paper, dark-brown fold lines, tomato-red wax seal",
      "信箱 / 厨友访问"),
]

# 深色第二套：只给「面类」件（语义色件不出深色版）
DARK_SLOTS = [s["id"] for s in SLOTS if s["dark"] and s["id"].startswith("FRAME_")] + \
             ["BG_TILE", "ITEM_SLOT", "SCROLL_THUMB"]

# ══════════════════════════════════════════════════════════════════════════════
# 五、图标隐喻词表（按关键词命中 → 食物隐喻；命中不到就用兜底）
# ══════════════════════════════════════════════════════════════════════════════
METAPHOR = [
    # 先放具体的（首次命中即返回），再放泛化的
    (r"笨鸟|鸟|飞", "一只展翅的小鸟（面团身子 + 饼干翅膀）"),
    (r"打地鼠|地鼠", "一朵从面团里冒出来的蘑菇"),
    (r"接汤|传菜|上菜", "一个托盘 + 一碗汤"),
    (r"猜菜名", "一个盖着的碗 + 问号"),
    (r"连连看|消消乐|凑凑消|凑凑|消", "一对一模一样的食材"),
    (r"贪吃蛇|蛇", "一条弯成 S 形的面条"),
    (r"吃豆人|豆", "一个张着嘴的豆子小圆饼"),
    (r"拼图|拼", "拼在一起的饼干块"),
    (r"扫雷|雷", "一朵蘑菇 + 一面小旗"),
    (r"滑冰|冰", "一块方冰 + 一片冰刀刃"),
    (r"2048|方块", "三块摞起来的糖块"),
    (r"自动化|机械", "一只机械爪 + 饼干齿轮"),
    (r"地窖|酒窖|窖", "一只木酒桶 + 一点苔藓"),
    (r"牧场|畜|栏", "一段木栅栏 + 一只奶桶"),
    (r"笔记|记录|回顾|年鉴|册", "一本翻开的册子 + 一支羽毛笔"),
    (r"菜系|研究|图谱|知识|讲堂", "一块小黑板 + 一截粉笔"),
    (r"评级|评分|榜|排行", "三颗星 + 一段缎带"),
    (r"班底|分店|常客|同业", "一张小圆桌 + 两把椅子"),
    (r"宴会|席|节庆", "一张摆了几个盘子的长桌"),
    (r"里程碑|传承|故事", "一座小石碑 + 卷轴"),
    (r"腌制|腌|泡", "一个陶坛 + 几粒盐"),
    (r"刀工|切", "一把菜刀 + 一块砧板"),
    (r"火候", "一簇火苗 + 一把锅铲"),
    (r"摆盘", "一个盘子 + 一把小镊子"),
    (r"品鉴|品味|鉴", "一只小杯 + 一颗星"),
    (r"探索|探|寻", "一张地图 + 一个罗盘"),
    (r"陶艺|陶", "一个陶轮 + 一个陶罐"),
    (r"编织|织", "一根纺锤 + 一团线"),
    (r"刺绣|绣", "一根针 + 一缕丝线"),
    (r"蜡烛|蜡", "一根蜡烛 + 一簇火苗"),
    (r"制箭|箭", "一支箭 + 一片羽毛"),
    (r"制网|网", "一张渔网"),
    (r"香道|香", "一支线香 + 一缕烟"),
    (r"年货|年", "一个红封袋"),
    (r"玉作|玉", "一块玉石 + 一柄凿子"),
    (r"造纸|纸", "一叠纸 + 一方水槽"),
    (r"制皂|皂", "一块皂 + 几团泡沫"),
    (r"采|摘|果|蔬", "一颗带叶的果子剪影"),
    (r"钓|鱼|水|海", "一条鱼 + 一枚水滴"),
    (r"猎|肉|禽|野", "一支箭 + 一块肉排"),
    (r"挖|掘|薯|根", "一把小铲 + 一块根茎"),
    (r"木|伐|林|板", "一段圆木 + 一把斧"),
    (r"矿|石|铁|宝", "一把镐 + 一块矿石"),
    (r"农|田|种|耕|苗", "一株嫩芽 + 一畦田"),
    (r"烹|饪|炒|锅|灶", "一口锅 + 铲"),
    (r"烘|烤|面包|面团", "一个面包 + 麦穗"),
    (r"酿|酒|饮|茶|壶", "一只酒壶 / 茶壶"),
    (r"保|鲜|藏|罐", "一个玻璃罐 + 封盖"),
    (r"锻|铁|铸|炉", "一个铁砧 + 火花"),
    (r"炼|金|药|丹|灵", "一只药剂瓶 + 气泡"),
    (r"食灵|契约|召唤", "一枚符纸 + 小灵火"),
    (r"塔|试炼|爬", "一座阶梯塔 + 旗"),
    (r"决|斗|战|敌|竞技|名厨", "两把交叉的菜刀"),
    (r"赛|大|厨神|排行榜", "一座奖杯 + 缎带"),
    (r"季|活动|限时", "一片叶子 + 沙漏"),
    (r"商|买|卖|交易|价|行情", "一枚金币 + 天平"),
    (r"珍|馐|阁|礼包", "一个盖着的餐盘"),
    (r"信|邮|箱|邮", "一个信封 + 蜡封"),
    (r"友|厨友|邻|访", "两个碰杯的小杯"),
    (r"宠|吉祥|灶君|动物", "一只爪印 + 小旗"),
    (r"天|气|运|势|节", "一朵云 + 一颗太阳"),
    (r"图鉴|册|收集|卡", "一本摊开的册子"),
    (r"经|山|海|树|谱", "一棵树 + 卷轴"),
    (r"成|称号|荣誉|奖", "一枚勋章 + 缎带"),
    (r"任|务|待办|清单|目标", "一块小木板 + 钉子"),
    (r"小|游戏|戏|趣|乐", "一枚骰子 + 笑口面饼"),
    (r"币|金|钱|券|票", "一枚金币 / 一张券"),
    (r"宝|箱|奖|领", "一只宝箱"),
    (r"设|置|配|选项|调", "一把扳手 + 齿轮（食物化：饼干齿轮）"),
    (r"搜|查|筛|找", "一把放大镜 + 一片叶"),
    (r"签|到|日|每|定", "一页日历 + 红点"),
    (r"统|计|数|报|析", "一张图表 + 尺"),
    (r"指|南|攻|略|明|帮", "一卷书 + 问号叶"),
    (r"效|果|增|益|状", "一串闪光 + 小瓶"),
    (r"产|线|挂|机|厂", "一条传送带 + 齿轮"),
    (r"库|存|背|包|仓", "一只麻布袋"),
    (r"装|备|穿|武", "一件围裙 / 一把刀"),
    (r"温|室|花|蜂|蜜", "一朵花 + 一滴蜜"),
    (r"远|行|采|购|队", "一辆小车 + 箱子"),
    (r"骑|马|驮|运输", "一匹马剪影 + 货袋"),
    (r"祭|坛|神|祈|愿", "一座小祭坛 + 香"),
    (r"牌|徽|印|章|纹", "一枚印章"),
]
METAPHOR_FALLBACK = "一个与功能语义最近的食物/厨具小物（如小锅、勺子、食材）"

# 通用动作图标**不做食物隐喻**（它们是符号，不是物件）——按「像素字形」描述
ACTION_GLYPH = {
    "关闭": "一个 12×12 的阶梯叉（X），线宽 2 逻辑像素",
    "返回": "一个左指阶梯箭头 + 一截短横",
    "设置": "一个饼干齿轮（六齿、中心 1 像素孔）",
    "搜索": "一个放大镜（圆圈用阶梯画）+ 短柄",
    "筛选": "三层漏斗形（阶梯三角堆叠）",
    "刷新": "一段带箭头的圆弧（阶梯画），箭头一像素",
    "确认": "一个番茄红阶梯勾",
    "取消": "一个深烤棕阶梯叉",
    "信息": "一个圆圈 + 中间一竖（i 形，无字母）",
    "警告": "一个阶梯三角 + 中间一竖",
    "问号帮助": "一个圆圈 + 一个阶梯问号（允许问号，它是符号不是文字）",
    "加号": "一个十字（横竖各 2 逻辑像素宽）",
    "减号": "一截粗横（2 逻辑像素高）",
    "上移": "一个上指阶梯箭头",
    "下移": "一个下指阶梯箭头",
    "排序": "三条长短不一的横线 + 一个箭头",
    "展开": "一个下指阶梯三角",
    "收起": "一个上指阶梯三角",
    "复制": "两块叠起来的方饼干（后面一块只露边）",
    "删除": "一个垃圾桶（带一处不规则缺口）",
    "锁定": "同 §5 的 `LOCK_PIXEL`（不必重出）",
    "已解锁": "一把开口的挂锁（同上的开锁态）",
    "邮件已读": "一个信封 + 一道斜光（表示已读）",
    "领取": "一个向下伸出的手掌（阶梯画）+ 一枚金币",
    "播放": "一个右指阶梯三角",
    "暂停": "两根等宽竖条",
    "音量": "一个阶梯喇叭 + 两道弧线",
    "太阳（浅色）": "一个蛋黄黄太阳（八向阶梯光芒）",
    "月亮（深色）": "一个奶白月牙（阶梯画）",
    "用户": "一个圆头 + 一段肩膀（像素剪影）",
}


def metaphor_of(name):
    for pat, m in METAPHOR:
        if re.search(pat, name):
            return m
    return METAPHOR_FALLBACK


# ══════════════════════════════════════════════════════════════════════════════
# 六、数据源（全部从源码/实测产物读，不手抄）
# ══════════════════════════════════════════════════════════════════════════════
INV = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))

# 页面中文名（featureGroups 是权威清单）
FG_SRC = FEATURE_GROUPS_PATH.read_text(encoding="utf-8")
VIEW_NAME = {}
for nm, vw in re.findall(r"name: '([^']+)',\s*\n?\s*view: '([A-Za-z]+)'", FG_SRC):
    VIEW_NAME.setdefault(vw, nm)
SK_SRC = SKILLS_PATH.read_text(encoding="utf-8")
for sid, nm in re.findall(r"(\w+):\s*\{\s*\n?\s*id: '\w+',\s*name: '([^']+)'", SK_SRC):
    VIEW_NAME.setdefault(sid, nm)

# ① 功能磁贴（左栏「功能」页签）—— 每格 + 分组头
TILES = []
for icon, name, view in re.findall(r"icon: '([^']+)',\s*name: '([^']+)',\s*view: '([A-Za-z]+)'", FG_SRC):
    TILES.append(dict(icon=icon, name=name, view=view, kind="功能磁贴"))
for icon, name in re.findall(r"\{\s*\n?\s*id: '\w+',\s*\n?\s*icon: '([^']+)',\s*\n?\s*name: '([^']+)',", FG_SRC):
    TILES.append(dict(icon=icon, name=name, view="", kind="功能分组头"))

# ② 小游戏（**27 款** —— 先在源码里切出 `const GAMES = [...]` 这一段再匹配，
#    不能整文件扫 `{ id, emoji, name }`：AGENTS 记录过「按目录文件数数成 28」的错，
#    权威口径是 GAMES 数组本身的长度，而这个文件里还有别的同形对象）
MINIGAMES_SRC = MINIGAMES_PATH.read_text(encoding="utf-8")
GAMES_BLOCK = MINIGAMES_SRC.split("const GAMES = [", 1)[1].split("\n]", 1)[0]
GAMES = [dict(icon=m, name=n, view="minigames", kind="小游戏")
         for m, n in re.findall(r"\{ id: '(?:[\w]+)', emoji: '([^']+)', name: '([^']+)'", GAMES_BLOCK)]

# ③ 技能（38 个，技能页顶部的 icon 位）
SKILLS = [dict(icon="", name=n, view=sid, kind="技能")
          for sid, n, _cat in re.findall(
              r"(\w+):\s*\{\s*\n?\s*id: '\w+',\s*name: '([^']+)',\s*category: '(\w+)'", SK_SRC)]

# ④ 顶部导航（105 页共用的带 emoji 的入口）
_raw_top = []
for p in INV["pages"]:
    for c in p["controls"]:
        if "top-nav" in (c["cls"] or "") and c["text"]:
            _raw_top.append(c["text"])
TOPBAR = [t for t, n in collections.Counter(_raw_top).most_common() if n >= 40]

# ⑤ 通用动作图标（手列：这些是全站固定动作，不在任何数据表里）
ACTIONS = ["关闭", "返回", "设置", "搜索", "筛选", "刷新", "确认", "取消", "信息", "警告", "问号帮助",
           "加号", "减号", "上移", "下移", "排序", "展开", "收起", "复制", "删除", "锁定", "已解锁",
           "邮件已读", "领取", "播放", "暂停", "音量", "太阳（浅色）", "月亮（深色）", "用户"]

# ⑥ 页面矩阵（105 页）
FAM2SLOT = {
    "页签": "FRAME_TAB + FRAME_TAB_ON",
    "按钮": "FRAME_BTN",
    "主按钮": "FRAME_BTN_PRIMARY",
    "图标按钮": "FRAME_BTN",
    "卡片": "FRAME_CARD",
    "面板": "FRAME_PANEL（+ STEAM_CURVE）",
    "徽章": "BADGE_S / BADGE_M / BADGE_L",
    "进度条": "FRAME_BAR_SLOT + TEX_BAR_FILL",
    "输入框": "FRAME_INPUT（+ FRAME_FOCUS）",
    "下拉": "FRAME_INPUT + ICON_ARROW",
    "复选框": "CHECK_OFF_S / CHECK_ON_S（大档 M）",
    "表格": "LINE_ROW",
    "日志行": "LINE_STROKE_TOAST / STEAM_CURVE",
    "区块标题": "LINE_STROKE_RED",
    "物品图": "ITEM_SLOT（物品图本身已有 32/64px 精灵）",
}


def page_key(p):
    return p.get("skill") or p["view"]


PAGE_NAME = {}
for p in INV["pages"]:
    k = page_key(p)
    PAGE_NAME[k] = ("技能页 · " + VIEW_NAME.get(k, k)) if p.get("skill") else VIEW_NAME.get(k, k)


def page_rows():
    out = []
    for p in INV["pages"]:
        k = page_key(p)
        fams = collections.Counter()
        sizes = collections.defaultdict(list)
        for c in p["controls"]:
            fams[c["family"]] += 1
            sizes[c["family"]].append((round(c["w"]), round(c["h"])))
        top = []
        for f, n in fams.most_common():
            sz = collections.Counter(sizes[f]).most_common(1)[0]
            top.append("%d×%d（%d 个）" % (sz[0][0], sz[0][1], n))
        need = []
        for f in fams:
            s = FAM2SLOT.get(f)
            if s and s not in need:
                need.append(s)
        out.append(dict(key=k, name=PAGE_NAME.get(k, k), n=sum(fams.values()),
                        fams=list(fams), need=need, top=top[:4]))
    return out


PAGES = page_rows()

# ══════════════════════════════════════════════════════════════════════════════
# 七、提示词拼装（同一个模板 + 每件自己的材质 → 整套观感一致）
# ══════════════════════════════════════════════════════════════════════════════
def grid_of(slot):
    cw, ch = slot["css"]
    ew, eh = cw * EXPORT_SCALE, ch * EXPORT_SCALE
    return ew, eh, ew // GRID, eh // GRID


def irregular_of(slot):
    keys = {"big": IRREGULAR_BIG, "mid": IRREGULAR_MID, "small": IRREGULAR_SMALL}[slot["cls"]]
    return "；".join("%s —— %s" % (IRREGULAR_ALL[i][0], IRREGULAR_ALL[i][1]) for i in keys)


def slice_note(slot):
    if not slot["slice"]:
        return "固定件：一张图 = 一个元素，**不拉伸**，按导出尺寸原样使用"
    return ("九宫格：slice %dpx（= %d 逻辑像素，四边相同）；border-image-width %dpx；"
            "🔴 **不规则必须收在四个角的 slice 方格里、fill 中心区必须是纯平底色**；"
            "四条边的**中段要画成「恒定剖面」**（一条直线或一个重复单元）——"
            "边带中段只有一根轴被缩放，画在那里的缺口会被拉成长斜纹"
            % (slot["slice"], slot["slice"] // GRID, slot["slice"] // EXPORT_SCALE))


def pad_of(slot):
    return 8 if slot["cls"] == "big" else (4 if slot["cls"] == "mid" else 2)


def prompt_cn(slot, dark=False):
    ew, eh, lw, lh = grid_of(slot)
    cw, ch = slot["css"]
    pal = PALETTE_DARK if dark else PALETTE_LIGHT
    pal_txt = "、".join("%s %s" % (cn, hexv) for cn, _, hexv, _ in pal[:8])
    mat = slot["mat_cn"]
    if dark:
        mat += ("（**深色套**：把面类基色换成深烤棕系 %s / %s / %s，描边换成亮暖金 %s；"
                "番茄红与蛋黄黄**原样保留**）" % (PALETTE_DARK[2][2], PALETTE_DARK[3][2],
                                                 PALETTE_DARK[4][2], PALETTE_DARK[0][2]))
    return "\n".join([
        "【主体】%s —— %s" % (slot["cn"], slot["shape_cn"]),
        "【像素网格】画布 %d×%d 导出像素 = %d×%d 逻辑像素；**每个逻辑像素 = %d×%d 导出像素**；"
        "硬阶梯边缘，无抗锯齿、无抖动" % (ew, eh, lw, lh, GRID, GRID),
        "【尺寸】css 显示 %d×%dpx，导出 @2x %d×%dpx；%s" % (cw, ch, ew, eh, slice_note(slot)),
        "【材质】%s" % mat,
        "【轮廓不规则】%s｜幅度：%s" % (irregular_of(slot), IRREGULAR_NOTE[slot["cls"]]),
        "【光照】左上单一光源；同一材质只用 2 阶明暗（基色 + 右下暗阶），不反光、不加高光描边",
        "【配色】整幅 ≤8 色：%s" % pal_txt,
        "【构图】正视图居中，元素占画布 90%%，四周留 %d 导出像素（%d 逻辑像素）透明边距；"
        "背景**全透明**（不许任何底色、棋盘格、投影）" % (pad_of(slot), pad_of(slot) // GRID),
        "【风格】%s" % STYLE_CN,
        "【输出】PNG-24 带 alpha、%d×%d、无文字 / 数字 / 水印 / 署名" % (ew, eh),
    ])


def prompt_en(slot, dark=False):
    ew, eh, lw, lh = grid_of(slot)
    mat = slot["mat_en"]
    if dark:
        mat += (", recoloured for a DARK theme: swap the pale food tones for very dark roasted browns "
                "and make the outline a bright warm gold, keep tomato red and egg-yolk yellow unchanged")
    return (
        "%s; %s; canvas is %dx%d logical pixels, drawn at %dx nearest-neighbour integer scale (%dx%d export pixels); "
        "the corner slice is %d export pixels on all four sides; %s; %s"
        % (STYLE_EN, mat, lw, lh, GRID, ew, eh, slot["slice"] or 0,
           "nine-patch tile: the centre region must be a flat solid tone with at most one straight line running "
           "along the stretch axis, absolutely no decoration or specks in the centre" if slot["slice"]
           else "a single fixed-size element, not meant to be stretched",
           "irregular silhouette with a bite mark and uneven corner cuts" if slot["cls"] != "small"
           else "only a 1-pixel asymmetry, no bite marks")
    )


def build_json():
    return dict(
        meta=dict(
            style="像素美食风 · 不规则形状（Pixel Food UI，irregular pixel shapes）",
            version="v1 · 2026-09-23",
            grid=dict(logical_css=LOGICAL_CSS, export_scale=EXPORT_SCALE, export_per_logical=GRID,
                      rule="所有 css 尺寸必须为偶数、导出尺寸必须是 4 的倍数、slice 必须是 4 的倍数"),
            counts=dict(pages=len(PAGES), controls=sum(p["n"] for p in PAGES),
                        families=len({f for p in PAGES for f in p["fams"]}),
                        slots=len(SLOTS), dark_slots=len(DARK_SLOTS),
                        tiles=len(TILES), games=len(GAMES), skills=len(SKILLS),
                        topbar=len(TOPBAR), actions=len(ACTIONS)),
            style_cn=STYLE_CN, style_en=STYLE_EN, neg_en=NEG_EN,
            palette_light=[dict(cn=a, en=b, hex=c, use=d) for a, b, c, d in PALETTE_LIGHT],
            palette_dark=[dict(cn=a, en=b, hex=c, use=d) for a, b, c, d in PALETTE_DARK],
        ),
        slots=[dict(id=s["id"], cn=s["cn"], css=list(s["css"]), export=list(grid_of(s)[:2]),
                    logical=[grid_of(s)[2], grid_of(s)[3]], slice=s["slice"], pull=s["pull"],
                    class_=s["cls"], usage=s["usage"], dark_variant=(s["id"] in DARK_SLOTS),
                    prompt_cn=prompt_cn(s), prompt_en=prompt_en(s),
                    prompt_cn_dark=(prompt_cn(s, True) if s["id"] in DARK_SLOTS else None),
                    neg_en=NEG_EN) for s in SLOTS],
        icons=[dict(kind=i["kind"], name=i["name"], view=i["view"], emoji=i["icon"],
                    metaphor=metaphor_of(i["name"])) for i in (TILES + SKILLS + GAMES)],
        actions=[dict(name=a, glyph=ACTION_GLYPH.get(a, "标准像素图标（深烤棕平描边）")) for a in ACTIONS],
        pages=PAGES,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 八、Markdown 输出
# ══════════════════════════════════════════════════════════════════════════════
def md():
    L = []
    a = L.append
    tot = sum(p["n"] for p in PAGES)
    nfam = len({f for p in PAGES for f in p["fams"]})
    nicon = len(TILES) + len(SKILLS) + len(GAMES) + len(ACTIONS)
    nall = len(SLOTS) + len(DARK_SLOTS) + nicon
    a("# 像素美食风 · 全站 UI 出图提示词 v1")
    a("")
    a("> 目标：**一套覆盖全站 %d 个页面、%d 个控件、%d 个控件族的像素美食风 UI**，"
      "所有形状都是**不规则**的（不是圆角矩形）。" % (len(PAGES), tot, nfam))
    a("> 本文所有尺寸 / 页数 / 元素数都由真实数据派生：`scripts/dev/ui-inventory.json`（浏览器逐页实测）"
      "+ `featureGroups.js` / `MinigamesView.vue` / `skills.js`。")
    a("> 重新生成：`python scripts/dev/gen_pixel_food_prompts.py`")
    a("")
    a("## 0. 怎么用（三步）")
    a("")
    a("**第一步：先出 3 张样张，不要一次性出全量。**"
      "本项目吃过两次亏 —— 两套风格都是「先接全站再给用户看」，结果都被否、整层还原。"
      "先出这三张、在同一页样张里按 1:1 实机尺寸并排看（浅色 + 深色各一遍）：")
    a("")
    a("1. `FRAME_CARD`（卡片，最常见、面积最大）")
    a("2. `FRAME_BTN` + `FRAME_BTN_PRIMARY`（按钮，与文字贴得最近）")
    a("3. `FRAME_TAB` + `FRAME_TAB_ON`（页签，105 页全在用的 840 个）")
    a("")
    a("**第二步：按 §5 出全量**（%d 个通用件，其中 %d 个要深浅两套），再按 §7 出图标集（%d 个）。"
      % (len(SLOTS), len(DARK_SLOTS), nicon))
    a("")
    a("**第三步：过一遍后处理**（`scripts/dev/pixelize_ui.py`）把 AI 出图**强制对齐到像素网格**"
      "（降采样到逻辑尺寸 → 调色板量化到 ≤8 色 → 最近邻整数放大回导出尺寸），"
      "再跑 `check_slice_safety.py` 验「中心区没有装饰」。")
    a("")
    a("> 提示词是**中英对照**：中文段用于你自己核对，英文段用于粘贴给出图模型。")
    a("")
    a("---")
    a("")
    a("## 1. 全局风格锚（每张图都带）")
    a("")
    a("### 1.1 中文风格说明")
    a("")
    a("```")
    a(STYLE_CN)
    a("```")
    a("")
    a("### 1.2 英文正向锚（粘进 prompt 的第一段）")
    a("")
    a("```")
    a(STYLE_EN)
    a("```")
    a("")
    a("### 1.3 英文负向锚（粘进 negative prompt）")
    a("")
    a("```")
    a(NEG_EN)
    a("```")
    a("")
    a("---")
    a("")
    a("## 2. 像素网格与九宫格：7 条硬规则")
    a("")
    a("| # | 规则 | 为什么 |")
    a("| --- | --- | --- |")
    a("| 1 | **1 逻辑像素 = 2 css px，导出 = css × 2** ⇒ **1 逻辑像素 = 4 导出像素** | "
      "css px 与设备像素都是整数倍关系时，像素方格才不会被浏览器插值成一格大一格小 |")
    a("| 2 | **所有 css 尺寸必须是偶数、导出尺寸必须是 4 的倍数、`slice` 必须是 4 的倍数** | "
      "否则边框宽度不是整数逻辑像素，九宫格拼出来会半像素错位（像素风最常见的破功点） |")
    a("| 3 | **边框厚度只有三档**：大件 16 / 中件 8 / 小件 4 导出像素（= 4 / 2 / 1 逻辑像素） | "
      "档位写死，避免出现 3px、6px、9px 这种「不是逻辑像素倍数」的魔法数字 |")
    a("| 4 | 🔴 **不规则只能落在「四个角的 slice 方格」里**；四条边的**中段必须画成恒定剖面**（直线或一个重复单元） | "
      "边带中段**只有一根轴被缩放**，画在那里的缺口会被拉成长斜纹 —— 实测 848px 宽的卡片右上角就是一大片斜纹（2026-09-23 验收） |")
    a("| 5 | 🔴 **`fill` 中心区必须是纯平底色**，至多一条沿拉伸方向贯通的 1 逻辑像素线 | "
      "`border-image-slice: N fill` 会把中心区**整片拉伸铺满控件**；画在中心的戳印会变成弹窗正中一大块红 |")
    a("| 6 | **小件不许撕边**（徽章 / 勾 / 锁 / 箭头 / 图标只做 1 像素级不对称） | "
      "13px 的徽章上撕 2 逻辑像素，缩到实机就糊成一团 |")
    a("| 7 | **深色要出第二套位图**（`_dark.png`），只给「面类」件；语义色件不出 | "
      "位图颜色是烘死的，深色下纸白面会与暗底糊在一起；印泥 / 勾 / 进度填充是**语义色**，深色下继续用番茄红才对 |")
    a("")
    a("**尺寸换算示例**（`FRAME_CARD`）：css 240×80 → 导出 480×160 = **120×40 逻辑像素**，"
      "每个逻辑像素 4×4 导出像素，slice 16（= 4 逻辑像素）。")
    a("")
    a("---")
    a("")
    a("## 3. 色板（像素美食）")
    a("")
    a("### 3.1 浅色套")
    a("")
    a("| 色 | 代号 | 值 | 用途 |")
    a("| --- | --- | --- | --- |")
    for cn, en, hexv, use in PALETTE_LIGHT:
        a("| %s | `%s` | `%s` | %s |" % (cn, en, hexv, use))
    a("")
    a("### 3.2 深色套")
    a("")
    a("| 色 | 代号 | 值 | 用途 |")
    a("| --- | --- | --- | --- |")
    for cn, en, hexv, use in PALETTE_DARK:
        a("| %s | `%s` | `%s` | %s |" % (cn, en, hexv, use))
    a("")
    a("🔴 **两套色板的分流原则**：面类色（奶白 / 奶油 / 烤饼棕 / 深烤棕）**换掉**；"
      "语义色（番茄红 = 强调、蛋黄黄 = 正向 / 进度、海苔绿 = 成功）**原样保留** —— "
      "否则深色下主按钮就不红了、玩家认不出来。")
    a("")
    a("---")
    a("")
    a("## 4. 「不规则」怎么写进提示词（8 个手法 + 三档幅度）")
    a("")
    a("| 手法 | 怎么写 |")
    a("| --- | --- |")
    for k, v in IRREGULAR_ALL:
        a("| %s | %s |" % (k, v))
    a("")
    a("| 档位 | 用在哪 | 幅度 |")
    a("| --- | --- | --- |")
    a("| 大件 | 卡片 / 面板 / 弹窗 / 立绘框 | %s |" % IRREGULAR_NOTE["big"])
    a("| 中件 | 按钮 / 页签 / 输入框 / 进度槽 / 物品格 / 勋章 | %s |" % IRREGULAR_NOTE["mid"])
    a("| 小件 | 徽章 / 勾 / 锁 / 箭头 / 图标 | %s |" % IRREGULAR_NOTE["small"])
    a("")
    a("**参考写法**（可直接用）：`四角切角深度不同，左上是 2 阶、右上 1 阶、右下 3 阶、左下不切；"
      "上边中间有一处 1 逻辑像素深的咬口；轮廓线在 1 与 2 逻辑像素之间交替`。")
    a("")
    a("---")
    a("")
    a("## 5. 通用件清单（%d 件，覆盖 226 个变体 / 14 个控件族）" % len(SLOTS))
    a("")
    a("每件都给了**可直接复制的完整提示词**（中文 + 英文）。同族只需替换尺寸与状态，**不要重写风格段**。")
    a("")
    a("| ID | 名称 | css | 导出 | 逻辑 | slice | 形式 | 覆盖 | 深色版 |")
    a("| --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    for s in SLOTS:
        ew, eh, lw, lh = grid_of(s)
        a("| `%s` | %s | %d×%d | %d×%d | %d×%d | %s | %s | %s | %s |"
          % (s["id"], s["cn"], s["css"][0], s["css"][1], ew, eh, lw, lh,
             (str(s["slice"]) if s["slice"] else "—"),
             ("九宫格" if s["pull"] and s["slice"] else ("整条拉伸" if s["pull"] else "固定")),
             s["usage"], ("✅" if s["id"] in DARK_SLOTS else "—")))
    a("")
    for s in SLOTS:
        ew, eh, lw, lh = grid_of(s)
        a("### `%s` · %s" % (s["id"], s["cn"]))
        a("")
        a("- 尺寸：css %d×%d → 导出 %d×%d = 逻辑 %d×%d；slice %s；%s"
          % (s["css"][0], s["css"][1], ew, eh, lw, lh,
             (str(s["slice"]) if s["slice"] else "—"),
             ("九宫格可拉伸" if s["slice"] else ("整条拉伸" if s["pull"] else "固定尺寸"))))
        a("- 用在：%s" % s["usage"])
        a("- 深色第二套：%s" % ("需要（`%s_dark.png`）" % s["id"] if s["id"] in DARK_SLOTS else "不需要（语义色件）"))
        a("")
        a("**提示词（中文 · 直接复制）**")
        a("")
        a("```")
        a(prompt_cn(s))
        a("```")
        a("")
        a("**Prompt (English)**")
        a("")
        a("```")
        a(prompt_en(s))
        a("")
        a("Negative: " + NEG_EN)
        a("```")
        if s["id"] in DARK_SLOTS:
            a("")
            a("**深色版提示词（中文）**")
            a("")
            a("```")
            a(prompt_cn(s, True))
            a("```")
        a("")
    a("---")
    a("")
    a("## 6. 深色第二套（共 %d 件）" % len(DARK_SLOTS))
    a("")
    a("需要出深色版的件：%s。" % "、".join("`%s`" % i for i in DARK_SLOTS))
    a("")
    a("**只改一句话就够了**（追加到正向提示词末尾，其余段一字不改）：")
    a("")
    a("```")
    a("同一个形状，深色主题版：把面类基色换成深烤棕系（#3A2C1E / #2A2018 / #1C1410），"
      "描边换成亮暖金 #E8D0A0；番茄红与蛋黄黄**保持原样**。其余（像素网格、不规则手法、透明背景）完全一致。")
    a("```")
    a("")
    a("```")
    a("the same shape, DARK theme variant: swap the pale food tones for very dark roasted browns "
      "(#3A2C1E / #2A2018 / #1C1410) and make the outer outline a bright warm gold #E8D0A0; "
      "keep tomato red and egg-yolk yellow exactly as they are. Everything else identical.")
    a("```")
    a("")
    a("---")
    a("")
    a("## 7. 图标集（%d 个 —— 「覆盖所有页面元素」主要就靠这一块）" % nicon)
    a("")
    a("现状：左栏功能磁贴（%d）、技能页（%d）、小游戏（%d）、顶部导航（%d）**全部用 emoji 当图标**，"
      "这是之前两次「丑」里的一部分（emoji 与像素画风不搭），也是这套像素素材最该顺手解决的事。"
      % (len(TILES), len(SKILLS), len(GAMES), len(TOPBAR)))
    a("")
    a("### 7.1 图标通用提示词模板（尺寸四档）")
    a("")
    a("| 用在哪 | css | 导出 | 逻辑 | 个数 |")
    a("| --- | --- | --- | --- | --- |")
    a("| 功能磁贴 | 54×54 | 108×108 | 27×27 | %d |" % len(TILES))
    a("| 技能页顶部 | 18×18 | 36×36 | 9×9 | %d |" % len(SKILLS))
    a("| 小游戏入口 | 24×24 | 48×48 | 12×12 | %d |" % len(GAMES))
    a("| 顶部导航 | 24×24 | 48×48 | 12×12 | %d |" % len(TOPBAR))
    a("| 通用动作 | 16×16 | 32×32 | 8×8 | %d |" % len(ACTIONS))
    a("")
    a("```")
    a("【主体】一枚像素食物风功能图标：「{名称}」；用一个**食物/厨具的隐喻**表达 —— {隐喻}")
    a("【像素网格】画布 {导出}×{导出} 导出像素 = {逻辑}×{逻辑} 逻辑像素；每个逻辑像素 = 4×4 导出像素")
    a("【材质】同色板：奶白主体 + 深烤棕描边 + 最多一处番茄红或蛋黄黄点缀")
    a("【光照】左上单一光源，2 阶明暗")
    a("【构图】正视图居中，四周留 2 逻辑像素透明边距，背景全透明")
    a("【轮廓】只做 1 像素级不对称（一角多切 1 阶）")
    a("【输出】PNG-24 带 alpha、无文字 / 数字 / 水印")
    a("（正向锚与负向锚照抄 §1.2 / §1.3）")
    a("```")
    a("")
    a("### 7.2 功能磁贴（%d 个）" % len(TILES))
    a("")
    a("| # | 名称 | 现 emoji | 视图 | 隐喻（填进提示词） |")
    a("| --- | --- | --- | --- | --- |")
    for i, t in enumerate(TILES, 1):
        a("| %d | %s | %s | `%s` | %s |" % (i, t["name"], t["icon"], t["view"] or "—", metaphor_of(t["name"])))
    a("")
    a("### 7.3 技能（%d 个）" % len(SKILLS))
    a("")
    a("| # | 技能 | 隐喻 |")
    a("| --- | --- | --- |")
    for i, t in enumerate(SKILLS, 1):
        a("| %d | %s | %s |" % (i, t["name"], metaphor_of(t["name"])))
    a("")
    a("### 7.4 小游戏（%d 款）" % len(GAMES))
    a("")
    a("| # | 游戏 | 现 emoji | 隐喻 |")
    a("| --- | --- | --- | --- |")
    for i, t in enumerate(GAMES, 1):
        a("| %d | %s | %s | %s |" % (i, t["name"], t["icon"], metaphor_of(t["name"])))
    a("")
    a("### 7.5 顶部导航入口（%d 个，105 页共用）" % len(TOPBAR))
    a("")
    for t in TOPBAR:
        a("- `%s`" % t)
    a("")
    a("### 7.6 通用动作图标（%d 个）" % len(ACTIONS))
    a("")
    a("⭐ 这一组**不做食物隐喻** —— 它们是符号不是物件，硬拗成食物反而认不出来。"
      "统一「深烤棕平描边 + 阶梯画」，只有勾 / 警告 / 太阳月亮 用语义色。")
    a("")
    a("| # | 动作 | 画成什么（填进提示词） |")
    a("| --- | --- | --- |")
    for i, x in enumerate(ACTIONS, 1):
        a("| %d | %s | %s |" % (i, x, ACTION_GLYPH.get(x, "标准像素图标（深烤棕平描边）")))
    a("")
    a("---")
    a("")
    a("## 8. 页面专属件（14 个控件族之外的）")
    a("")
    a("这些不是九宫格控件，是**每个页面自己的图形位**，都要单独出图：")
    a("")
    a("| 件 | 实测尺寸 | 现在是什么 | 提示词要点 |")
    a("| --- | --- | --- | --- |")
    a("| 立绘相框 `FRAME_PORTRAIT` | 56 / 64px | 立绘外的卡片边 | 已含在 §5（64×64 九宫格） |")
    a("| 物品格 `ITEM_SLOT` | 40~52px | 物品图底板 | 已含在 §5（52×52 九宫格） |")
    a("| 食灵图位 | 56×56 / 104×104 | 食灵精灵图（已有素材） | 只出一张「蛋壳 / 陶罐」底板，精灵图不重出 |")
    a("| 装备槽 | 见页面矩阵 | 装备栏格子 | 用 `ITEM_SLOT` 的 48×48 版本 |")
    a("| 大赛风格按钮 | 327×71 | 流派选择大按钮 | 用 `FRAME_BTN_PRIMARY`（可九宫格，不用另出） |")
    a("| 竞技场容器 | 848×411 | 容器 | 用 `FRAME_CARD`；对手立绘复用现有 512 立绘 |")
    a("| 塔楼层指示 | — | 塔的层数牌 | 一块木牌 + 阶梯刻痕（导出 96×96） |")
    a("| 赛季徽记 | — | 赛季图标 | 40 季共用一枚，季度数字由 CSS 叠加（**数字不烘进图**） |")
    a("| 天气图标 | — | 9 种天气 emoji | 云 / 雨 / 雪 / 风 / 雾 / 晴 / 雷 / 沙 / 花各一枚，导出 48×48 |")
    a("| 状态图标 | — | 血 / 经验 / 精通 / 饱食的图标 | 心 / 星 / 书 / 碗各一枚，导出 32×32 |")
    a("")
    a("---")
    a("")
    a("## 9. 页面覆盖矩阵（%d 页 —— 每页要跑哪几条提示词）" % len(PAGES))
    a("")
    a("`控件数` 是该页实测的控件实例数；`需要的件` 是这一页要用到的素材 ID；"
      "`实测尺寸` 是本页最常见的几族控件在这页的真实尺寸（**出图前先看这一列**："
      "九宫格一张图覆盖所有尺寸，只有固定件才需要按页微调）。")
    a("")
    a("| 页面 | 视图 key | 控件数 | 需要的件 | 实测尺寸（最常见的几族） |")
    a("| --- | --- | --- | --- | --- |")
    for p in sorted(PAGES, key=lambda x: -x["n"]):
        a("| %s | `%s` | %d | %s | %s |"
          % (p["name"], p["key"], p["n"], " + ".join(p["need"]) or "—", "；".join(p["top"]) or "—"))
    a("")
    a("---")
    a("")
    a("## 10. 与「已生成的 32 件像素套」的 5 处数值差异")
    a("")
    a("现有那套（`public/images/ui-food-pixel/`）**风格方向是对的**，但下面 5 处尺寸不满足 §2 的网格规则，"
      "实机拼装时会半像素错位，本套已统一：")
    a("")
    a("| 件 | 现有 | 本套 | 为什么改 |")
    a("| --- | --- | --- | --- |")
    a("| `FRAME_TAB` / `FRAME_TAB_ON` | slice 6 | slice 8 | 6 不是 4 的倍数 → 边框不是整数逻辑像素 |")
    a("| `FRAME_INPUT` | slice 6 | slice 8 | 同上 |")
    a("| `FRAME_BTN_RED`（本套改名 `FRAME_BTN_PRIMARY`） | slice 9 | slice 8 | 9 是奇数，也不是 4 的倍数 |")
    a("| `BADGE_S` / `LOCK_LINEWORK` | 导出 26×26 | 导出 28×28 | 26 不是 4 的倍数（26/4 = 6.5 逻辑像素） |")
    a("| `LINE_CHOPSTICK` | 导出 256×3 | 导出 256×4（`LINE_ROW`） | 3 像素高的线不是整数逻辑像素 → 半像素行抖动 |")
    a("")
    a("另外旧套**缺两类**：**深色第二套**（%d 件）与**图标集**（%d 个），本套都补上了。" % (len(DARK_SLOTS), nicon))
    a("")
    a("---")
    a("")
    a("## 11. 后处理与验收")
    a("")
    a("### 11.1 为什么必须后处理")
    a("")
    a("出图模型**按不出精确的像素网格**：它会给一张 1024 的大图、边缘带抗锯齿、颜色有几百种。"
      "下面这套后处理能把它**强制**变成规整像素图（可复现、不靠手感）：")
    a("")
    a("1. 生成时按 §5 给的导出尺寸的 **4~8 倍**出图（例：要 480×160 就出 1920×640，透明底）")
    a("2. 降采样到**逻辑尺寸**（480×160 → 120×40，BOX 滤波）")
    a("3. **调色板量化**到 ≤8 色（保留 alpha）")
    a("4. 最近邻整数放大回导出尺寸（×4 → 480×160）")
    a("5. alpha 二值化（≥128 → 255，其余 → 0），去掉半透明羽化")
    a("")
    a("`scripts/dev/pixelize_ui.py` 就是这五步：输入 `docs/ui-pixel/raw/<ID>.png`，"
      "输出 `docs/ui-pixel/out/<ID>@2x.png`（尺寸自动从本套 JSON 读，**不会手抄错**）。")
    a("")
    a("### 11.2 验收清单")
    a("")
    a("- [ ] 导出尺寸 == 本套 JSON 里的 `export`（差一个像素都会让网格错位）")
    a("- [ ] 导出宽高都是 **4 的倍数**")
    a("- [ ] 整幅 ≤ 8 色（量化后数一下）")
    a("- [ ] 背景**全透明**（不许有白底、棋盘格、投影）")
    a("- [ ] 九宫格件的**中心区是纯平底色**：`python scripts/dev/check_slice_safety.py`")
    a("- [ ] 在 1:1 实机尺寸下看一遍（不看放大图）：`node scripts/dev/preview_ui_assets.mjs`（把 `UI` 指向新目录）")
    a("- [ ] 浅深两套都在全站跑一遍：`npx playwright test e2e-layout.spec.mjs`（控件被裁 / 文字竖排两类缺陷）")
    a("- [ ] 深色可读性：`npx playwright test e2e-dark.spec.mjs`")
    a("")
    a("### 11.3 接入时的三条硬规则（都是踩出来的）")
    a("")
    a("1. **只加 `border-image-*`，绝不动 `border-width`** —— 绘制区由 `border-image-width` 决定，"
      "布局只认 `border-width` ⇒ 内容盒一个像素不缩、换行与内边距全不变（这是能一次接 89 个 `.card`、"
      "131 个 `.btn` 而 103 页布局全绿的前提）。")
    a("2. **换肤一律去圆角**（`border-radius: 0`），否则圆角会把 `border-image` 的角切掉。")
    a("3. **`image-rendering: pixelated` 只在这一套的范围内开**：像素 UI 件是 1:1 或整数倍，开了才不糊；"
      "**立绘不许开**（512px 立绘开了会碎，AGENTS 有明文）。")
    a("")
    a("### 11.4 强调色件有两条路线（二选一，**建议按件分开选**）")
    a("")
    a("| 路线 | 做法 | 好处 | 代价 | 建议用在 |")
    a("| --- | --- | --- | --- | --- |")
    a("| A 位图烘色 | 直接出番茄红 / 蛋黄黄的位图 | 像素阴影完整、最好看 | **不跟 15 套皮肤**（换皮肤它不红） | 面类件（卡片 / 面板 / 弹窗） |")
    a("| B mask + CSS 染色 | 另出一张**白色形状 + alpha** 的遮罩，CSS 用 "
      "`background-color: var(--primary); mask-image: url(...)` | 跟 15 套皮肤与深色 | 只剩平色、丢掉像素阴影 | "
      "强调色件（主按钮 / 页签选中 / 进度填充 / 徽章） |")
    a("")
    a("> `docs/ui-assets/ui2/manifest.json` 里已有 `mask` 字段的现成做法（纸白那套就是 mask + CSS 染色），"
      "直接照它的 `paste_css()` 抄。")
    a("")
    a("---")
    a("")
    a("## 12. 不在本套内（以及为什么）")
    a("")
    a("| 项 | 数量 | 为什么不放进这套 | 要覆盖的话怎么做 |")
    a("| --- | --- | --- | --- |")
    a("| 敌人 / 厨师立绘 | 248 + 2 | 现为 512px 非像素风；AGENTS 明令立绘**不许** `image-rendering: pixelated` | "
      "另立「像素立绘」专项，按 512 → 像素网格重出（工作量大，建议先只做首批 20 个看观感） |")
    a("| 物品图 | 2000+ 张 | 已是 32/64px 像素精灵（与现有物品画风一致） | **不需要重出**，换 UI 后反而更协调 |")
    a("| 字体 | — | 像素风要配像素字体才完整 | 可选：`fusion-pixel-font`（缝合像素字体，**OFL-1.1**，"
      "8/10/12px 三档 CJK 齐全）。⚠️ 像素字体**只能在整数倍下用**：正文 12px、标题 24px，"
      "**不许出现 13 / 14px**（会糊）；先用一页样张试可读性再全站铺 |")
    a("")
    a("---")
    a("")
    a("## 附录：本套统计（自动生成，可核对）")
    a("")
    a("| 项 | 数量 |")
    a("| --- | --- |")
    a("| 页面 | %d |" % len(PAGES))
    a("| 控件实例 | %d |" % tot)
    a("| 控件族 | %d |" % nfam)
    a("| 通用件 | %d（其中需深色第二套 %d） |" % (len(SLOTS), len(DARK_SLOTS)))
    a("| 图标 | %d（磁贴 %d + 技能 %d + 小游戏 %d + 动作 %d） |"
      % (nicon, len(TILES), len(SKILLS), len(GAMES), len(ACTIONS)))
    a("| 合计要出的图 | %d 张 |" % nall)
    a("")
    return "\n".join(L)


def main():
    # 输出目录必须先存在，且两个目标文件都必须落在它下面（字面量路径，不接受外部参数）
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if MD_PATH.parent.resolve() != OUT_DIR.resolve() or JSON_PATH.parent.resolve() != OUT_DIR.resolve():
        raise SystemExit("输出路径校验失败：" + str(OUT_DIR))
    data = build_json()
    c = data["meta"]["counts"]

    # 自检一：网格规则（导出尺寸与 slice 都必须是 4 的倍数，否则九宫格会半像素错位）
    bad = [s["id"] for s in data["slots"]
           if s["export"][0] % GRID or s["export"][1] % GRID or s["slice"] % GRID]
    if bad:
        raise SystemExit("违反像素网格规则的件：" + "、".join(bad))

    # 自检二：与记录基线对表（漂了说明数据变了，文档里的数字要重新核）
    baseline = dict(pages=105, controls=3573, families=14, tiles=63, games=27, skills=38)
    drift = {k: (v, c[k]) for k, v in baseline.items() if c[k] != v}
    if drift:
        print("⚠️ 与记录基线不一致（文档结论需要复核）：",
              "；".join("%s 基线%d→实际%d" % (k, a, b) for k, (a, b) in drift.items()))

    JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    MD_PATH.write_text(md(), encoding="utf-8")
    print("已生成：")
    print(" ", MD_PATH)
    print(" ", JSON_PATH)
    print("统计：", c)
    print("合计要出的图：%d" % (c["slots"] + c["dark_slots"] + c["tiles"] + c["skills"] + c["games"] + c["actions"]))


if __name__ == "__main__":
    main()
