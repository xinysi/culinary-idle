// Lv101-120「补档」内容（2026-09-29，用户授权的扩充批）—— 手写扩展模块（照 `freshMats.js`/`timbers.js` 的形态），
// **不碰任何生成器产物**（`gen_expansion*.mjs` 的输出已上硬门禁，重跑会改写冻结层）。
//
// 为什么要有这一批：全站 Lv101-120 是 20 级零内容的空档（采集顶档 99 / 制作顶档 99 / 副业顶档 91），
// 而内容密度方向与 Melvor 相反（它越后期越密）。本批把 7 支采集 + 4 支制作 + 16 支副业的顶档推进到 112/118/120。
//
// 🔴 数值口径（全部从**既有曲线的实测尾部**外推，不发明新公式）：
//   · 物品价值 = round(5 + 3.2×等级)（实测 苤蓝@99 = 322 = 5+3.2×99 ✓）；副业产物走副业自己的
//     `round(2 + 2.5×等级)`（`sidelineWorks.js` 同款，由那边的追加循环生成，不在本模块）。
//   · 采集 xpPerAction / intervalSec：按各技能**现有顶档的实测尾部**顺势外推（采摘 500@90 → 620@102），
//     interval 不超过全站上限 8s。
//   · 制作 xp = 等级 × 14（实测 部队锅@99 = 1386 = 99×14 ✓；`xpBalance.applyCraftXp` 的下限 25+13×等级 兜底）；
//     成功率 = max(0.5, round((0.92 − 等级×0.0035)×100)/100)（`gen_expansion2.mjs` 同款公式）。
//   · 料理 heal：烹饪 15+8×等级（807@99 ✓）· 烘焙 12+6×等级 + 回合回复 round(2+0.19×等级)×4（21@99 ✓）·
//     饮品 12+7×等级（705@99 ✓）。
//   · 副业配方 xp = 25+13×等级、成功率 = max(0.55, 0.95−0.0044×等级)（`sidelineWorks.js` 同款）。
//   · 配方等级与材料等级满足「材料获取等级 ≤ 配方等级 + 5」：Lv102 档吃 Lv102 料 ✓、Lv112 档吃 Lv112 料 ✓
//     （`recipeBalance.js` 的材料锚会自动登记本模块的目标 —— 它读的就是被 push 过的这些数组）。
//
// 🔴 消费方覆盖（图鉴三查的「可用于制作」）：每件新原料都 ≥2 条配方吃它（霜降香榧 6 条、九畹灵芝 6 条、
//   玄铁杉/天罡沉香各 16 条……），见文件末尾的覆盖注释。
//
// 图片：public/images/items/food/<中文名>.png（种子在 items/seed/），与本模块的中文名逐字对应。

// ── 物品定义（24 件：批次一原料 11 + 批次二矿木 4 + 制作产物 9）──────────────
// 副业 32 件产物与木工 2 件木器分别在 sidelineWorks.js / woodworking.js 里随各自的家族体系生成。
export const LATE_ITEMS = [
  // 采摘（fruit / vegetable / fungus）—— 紫苏玉笋刻意放 Lv102（不是 108）：它是两条 Lv102 副业配方的辅料，
  // 材料锚 108 会把配方抬到 103（raiseRecipeLevels 的「材料 ≤ 配方+5」标准），压到 102 才能全批停在设计档位。
  { id: 'late_for_01', name: '霜降香榧', type: 'ingredient', category: 'fruit', tier: 10, value: 331, stackable: true, maxStack: 9999 },
  { id: 'late_for_02', name: '紫苏玉笋', type: 'ingredient', category: 'vegetable', tier: 10, value: 331, stackable: true, maxStack: 9999 },
  { id: 'late_for_03', name: '九畹灵芝', type: 'ingredient', category: 'fungus', tier: 10, value: 363, stackable: true, maxStack: 9999 },
  // 垂钓（seafood）
  { id: 'late_fish_01', name: '银鳞龙鱼', type: 'ingredient', category: 'seafood', tier: 10, value: 331, stackable: true, maxStack: 9999 },
  { id: 'late_fish_02', name: '玄鲲须', type: 'ingredient', category: 'seafood', tier: 10, value: 363, stackable: true, maxStack: 9999 },
  // 狩猎（meat）
  { id: 'late_hun_01', name: '霜甲犀牛', type: 'ingredient', category: 'meat', tier: 10, value: 331, stackable: true, maxStack: 9999 },
  { id: 'late_hun_02', name: '雪鬃牦牛', type: 'ingredient', category: 'meat', tier: 10, value: 363, stackable: true, maxStack: 9999 },
  // 挖掘（root）
  { id: 'late_exc_01', name: '地髓晶', type: 'ingredient', category: 'root', tier: 10, value: 331, stackable: true, maxStack: 9999 },
  { id: 'late_exc_02', name: '无根玉参', type: 'ingredient', category: 'root', tier: 10, value: 363, stackable: true, maxStack: 9999 },
  // 农耕（fruit / legume + 种子）
  { id: 'late_far_01', name: '霜蜜瓜', type: 'ingredient', category: 'fruit', tier: 10, value: 331, stackable: true, maxStack: 9999 },
  { id: 'late_far_01Seed', name: '霜蜜瓜种子', type: 'seed', category: '种植产物', tier: 10, value: 33, stackable: true, maxStack: 9999 },
  { id: 'late_far_02', name: '紫府仙豆', type: 'ingredient', category: 'legume', tier: 10, value: 363, stackable: true, maxStack: 9999 },
  { id: 'late_far_02Seed', name: '紫府仙豆种子', type: 'seed', category: '种植产物', tier: 10, value: 36, stackable: true, maxStack: 9999 },
  // 采矿（mineral）/ 伐木（material）—— 它们同时是 16 支副业新档的副料
  { id: 'late_min_01', name: '星陨砂', type: 'ingredient', category: 'mineral', tier: 10, value: 331, stackable: true, maxStack: 9999 },
  { id: 'late_min_02', name: '赤霄陨铁', type: 'ingredient', category: 'mineral', tier: 10, value: 363, stackable: true, maxStack: 9999 },
  { id: 'late_wood_01', name: '玄铁杉', type: 'ingredient', category: 'material', tier: 10, value: 331, stackable: true, maxStack: 9999 },
  { id: 'late_wood_02', name: '天罡沉香', type: 'ingredient', category: 'material', tier: 10, value: 363, stackable: true, maxStack: 9999 },
  // 烹饪（food / 汤品·主菜）
  { id: 'late_coo_01', name: '龙涎煨汤', type: 'food', category: '汤品', tier: 10, value: 338, stackable: true, maxStack: 9999, heal: 847 },
  { id: 'late_coo_02', name: '霜炙犀牛肋', type: 'food', category: '主菜', tier: 10, value: 360, stackable: true, maxStack: 9999, heal: 903 },
  { id: 'late_coo_03', name: '山海八珍羹', type: 'food', category: '汤品', tier: 10, value: 383, stackable: true, maxStack: 9999, heal: 959 },
  // 烘焙（food / baking，带回合回复）
  { id: 'late_bak_01', name: '星霜酥', type: 'food', category: 'baking', tier: 10, value: 344, stackable: true, maxStack: 9999, heal: 648, regen: { perTurn: 22, turns: 4 } },
  { id: 'late_bak_02', name: '紫府豆糕', type: 'food', category: 'baking', tier: 10, value: 376, stackable: true, maxStack: 9999, heal: 708, regen: { perTurn: 24, turns: 4 } },
  // 酿造（drink / wine·tea）
  { id: 'late_bre_01', name: '松风酿', type: 'drink', category: 'wine', tier: 10, value: 351, stackable: true, maxStack: 9999, heal: 768 },
  { id: 'late_bre_02', name: '无根玉露', type: 'drink', category: 'tea', tier: 10, value: 379, stackable: true, maxStack: 9999, heal: 831 },
  // 香料（spice / seasoning —— 与既有香料同形：纯调味料，无战斗字段）
  { id: 'late_spi_01', name: '九转三味粉', type: 'spice', category: 'seasoning', tier: 10, value: 357, stackable: true, maxStack: 9999 },
  { id: 'late_spi_02', name: '九畹天香', type: 'spice', category: 'seasoning', tier: 10, value: 389, stackable: true, maxStack: 9999 },
]

// ── 采集目标（12 条：6 支技能各 2 档）───────────────────────────────────────
// 由各技能文件 push 进**它导出的那张基础表**（ForagingSkill.FORAGING_TARGETS 等）——
// itemSources / valueBalance / recipeBalance / itemNav 读的都是这些表 ⇒ 一处 push、四处同步。
export const LATE_GATHER = {
  foraging: [
    { itemId: 'late_for_01', reqLevel: 102, xpPerAction: 620, intervalSec: 8.0 },
    { itemId: 'late_for_02', reqLevel: 102, xpPerAction: 620, intervalSec: 8.0 },
    { itemId: 'late_for_03', reqLevel: 112, xpPerAction: 780, intervalSec: 8.0 },
  ],
  fishing: [
    { itemId: 'late_fish_01', reqLevel: 102, xpPerAction: 540, intervalSec: 8.0 },
    { itemId: 'late_fish_02', reqLevel: 112, xpPerAction: 660, intervalSec: 8.0 },
  ],
  hunting: [
    { itemId: 'late_hun_01', reqLevel: 102, xpPerAction: 560, intervalSec: 8.0 },
    { itemId: 'late_hun_02', reqLevel: 112, xpPerAction: 700, intervalSec: 8.0 },
  ],
  excavation: [
    { itemId: 'late_exc_01', reqLevel: 102, xpPerAction: 545, intervalSec: 7.6 },
    { itemId: 'late_exc_02', reqLevel: 112, xpPerAction: 660, intervalSec: 7.8 },
  ],
  mining: [
    { itemId: 'late_min_01', reqLevel: 102, xpPerAction: 440, intervalSec: 8.0 },
    { itemId: 'late_min_02', reqLevel: 112, xpPerAction: 520, intervalSec: 8.0 },
  ],
  woodcutting: [
    { itemId: 'late_wood_01', reqLevel: 102, xpPerAction: 350, intervalSec: 7.4 },
    { itemId: 'late_wood_02', reqLevel: 112, xpPerAction: 430, intervalSec: 7.6 },
  ],
}

// ── 农耕作物（2 条 + 种子映射）─────────────────────────────────────────────
// growSec 沿既有尾部（1080@99 → 1140/1260）；xp 同 `xpBalance.xpCraft` 家族取 800/900（高于下限即可）。
export const LATE_CROPS = [
  { itemId: 'late_far_01', seedId: 'late_far_01Seed', reqLevel: 102, growSec: 1140, xp: 800 },
  { itemId: 'late_far_02', seedId: 'late_far_02Seed', reqLevel: 112, growSec: 1260, xp: 900 },
]

// 种子映射（采摘/挖掘的「附产种子」与图鉴来源串都读 `farmSeeds.js` 的 SEED_MAP ⇒ 并进同一个对象）。
// farmSeeds.js 是零 import 的纯数据文件，这里 mutate 它导出的常量对象与 items.js 合并物品是同一套做法。
import { SEED_MAP } from './farmSeeds.js'
Object.assign(SEED_MAP, {
  late_far_01: 'late_far_01Seed',
  late_far_02: 'late_far_02Seed',
})

/** 商店上架的种子（`shop.js` push 进 SHOP_ITEMS；价格沿既有尾部 97@99 → 100/110） */
export const LATE_SEED_SHOP = [
  { itemId: 'late_far_01Seed', price: 100 },
  { itemId: 'late_far_02Seed', price: 110 },
]

// ── 制作配方（9 条：烹饪 3 · 烘焙 2 · 酿造 2 · 香料 2）─────────────────────
// 公式集中在下面两个小函数（与 gen_expansion2.mjs 同款），别在每条里手抄数字。
const prodXp = (lv) => lv * 14
const prodSuccess = (lv) => Math.max(0.5, Math.round((0.92 - lv * 0.0035) * 100) / 100)

export const LATE_PROD = {
  cooking: [
    { id: 'cook_late_01', name: '龙涎煨汤', category: '汤品', reqLevel: 104, xp: prodXp(104), successChance: prodSuccess(104), ingredients: { late_fish_01: 2, late_for_01: 1, water: 1 }, output: { itemId: 'late_coo_01', qty: 1 } },
    { id: 'cook_late_02', name: '霜炙犀牛肋', category: '主菜', reqLevel: 111, xp: prodXp(111), successChance: prodSuccess(111), ingredients: { late_hun_01: 2, chili: 1, garlic: 1 }, output: { itemId: 'late_coo_02', qty: 1 } },
    { id: 'cook_late_03', name: '山海八珍羹', category: '汤品', reqLevel: 118, xp: prodXp(118), successChance: prodSuccess(118), ingredients: { late_fish_02: 1, late_for_03: 1, late_exc_01: 1, late_for_02: 1 }, output: { itemId: 'late_coo_03', qty: 1 } },
  ],
  baking: [
    { id: 'bake_late_01', name: '星霜酥', category: 'baking', reqLevel: 106, xp: prodXp(106), successChance: prodSuccess(106), ingredients: { late_far_01: 2, late_for_01: 1 }, output: { itemId: 'late_bak_01', qty: 1 } },
    { id: 'bake_late_02', name: '紫府豆糕', category: 'baking', reqLevel: 116, xp: prodXp(116), successChance: prodSuccess(116), ingredients: { late_far_02: 2, rice: 1 }, output: { itemId: 'late_bak_02', qty: 1 } },
  ],
  brewing: [
    { id: 'brew_late_01', name: '松风酿', category: '果酒', reqLevel: 108, xp: prodXp(108), successChance: prodSuccess(108), ingredients: { late_for_01: 2, water: 1 }, output: { itemId: 'late_bre_01', qty: 1 } },
    { id: 'brew_late_02', name: '无根玉露', category: '茶饮', reqLevel: 117, xp: prodXp(117), successChance: prodSuccess(117), ingredients: { late_exc_02: 2, water: 1 }, output: { itemId: 'late_bre_02', qty: 1 } },
  ],
  spiceMixing: [
    { id: 'spice_late_01', name: '九转三味粉', category: 'seasoning', reqLevel: 110, xp: prodXp(110), successChance: prodSuccess(110), ingredients: { late_exc_01: 1, vermilionGrass: 2, chili: 1 }, output: { itemId: 'late_spi_01', qty: 1 } },
    { id: 'spice_late_02', name: '九畹天香', category: 'seasoning', reqLevel: 120, xp: prodXp(120), successChance: prodSuccess(120), ingredients: { late_for_03: 2, late_exc_02: 1 }, output: { itemId: 'late_spi_02', qty: 1 } },
  ],
}

// ── 副业新档（16 支 × 2 档）的**数据**在这里、**展开**在 sidelineWorks.js ─────────
// 副业产物的物品定义/配方/SIDEWORKS 记录都由 sidelineWorks 的 DEFS 循环按同一形状生成，
// 所以这里只放「行」：[key, level, 中文名, 副料 id, 木数量, 副料数量]——与 DEFS rows 同构，
// 但木不走 timberOfLevel（那 20 档只覆盖到 Lv100），直接点名本批的新木。
export const LATE_SIDELINE_ROWS = [
  // 木工不在此列（它的作品=手工装潢，走 woodworking.js 的 WOODWORK_ITEMS_DEF）
  ['pottery', 102, '星陨陶鼎', 'late_min_01', 5, 2], ['pottery', 112, '赤霄釉瓮', 'late_min_02', 5, 2],
  ['weaving', 102, '紫苏罗衣', 'late_for_02', 5, 2], ['weaving', 112, '九畹云锦', 'late_for_03', 5, 2],
  ['embroidery', 102, '霜林绣卷', 'late_for_01', 5, 2], ['embroidery', 112, '九畹天绣', 'late_for_03', 5, 2],
  ['candles', 102, '霜犀银烛', 'late_hun_01', 5, 2], ['candles', 112, '雪鬃龙烛', 'late_hun_02', 5, 2],
  ['fletching', 102, '星陨猎弩', 'late_min_01', 5, 2], ['fletching', 112, '赤霄神弩', 'late_min_02', 5, 2],
  ['netmaking', 102, '玉笋沉网', 'late_for_02', 5, 2], ['netmaking', 112, '玄鲲天网', 'late_fish_02', 5, 2],
  ['incense', 102, '霜榧线香', 'late_for_01', 5, 2], ['incense', 112, '九畹仙篆', 'late_for_03', 5, 2],
  ['festivalGoods', 102, '霜蜜礼盒', 'late_far_01', 5, 2], ['festivalGoods', 112, '紫府仙礼', 'late_far_02', 5, 2],
  ['jadecraft', 102, '银鳞玉环', 'late_fish_01', 5, 2], ['jadecraft', 112, '玄鲲琼璧', 'late_fish_02', 5, 2],
  ['goodsTag', 102, '霜甲令牌', 'late_hun_01', 5, 2], ['goodsTag', 112, '雪鬃金牌', 'late_hun_02', 5, 2],
  ['miningGear', 102, '星陨神镐', 'late_min_01', 5, 2], ['miningGear', 112, '赤霄天镐', 'late_min_02', 5, 2],
  ['papermaking', 102, '霜果纸镇', 'late_for_01', 5, 2], ['papermaking', 112, '九畹宝笈', 'late_for_03', 5, 2],
  ['instrument', 102, '霜犀鼓', 'late_hun_01', 5, 2], ['instrument', 112, '雪鬃箜篌', 'late_hun_02', 5, 2],
  ['soapmaking', 102, '星陨净皂', 'late_min_01', 5, 2], ['soapmaking', 112, '赤霄贡皂', 'late_min_02', 5, 2],
  ['exchequer', 102, '银鳞宝钞', 'late_fish_01', 5, 2], ['exchequer', 112, '玄鲲金券', 'late_fish_02', 5, 2],
]

/** 副业新档用的木（等级 → 木 id）：102 档玄铁杉、112 档天罡沉香 */
export const LATE_SIDELINE_WOOD = { 102: 'late_wood_01', 112: 'late_wood_02' }
