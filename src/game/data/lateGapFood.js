// Lv101-119「末段空档」内容（2026-09-30，用户授权的扩充批）—— 手写扩展模块
// （照 `lateGameFood.js` / `timbers.js` 的形态），**不碰任何生成器产物**。
//
// 为什么要有这一批：把「采集目标 / 农耕作物 / 制作配方 / 探索目标」四类内容**按等级**摆开后量出
// **7 个等级一件内容都没有**（Lv101 / 103 / 107 / 109 / 113 / 115 / 119），而它们正落在
// Lv101-120 这段吃掉全站 86.2% 经验的长路里。本批**每级 6 件**（4 原料 + 2 成品）把那 7 级填满，
// 且**每件原料都被成品吃掉**（不留「做出来没处用」的东西，见文件末尾的覆盖表）。
//
// 🔴 数值口径（全部从既有曲线的**实测尾部**顺势外推，不发明新公式）：
//   · 物品价值 = round(5 + 3.2×等级)（与 lateGameFood.js 同一条线；`applyValueBalance` 还会再夹一次）
//   · 采集 xpPerAction：沿上一批那条斜率续（采摘 620@102→780@112 ⇒ +16/级；其余同理），interval 8s 顶格
//   · 制作 xp = 等级 × 14、成功率 = max(0.5, (0.92 − 等级×0.0035) 取两位)
//   · 料理 heal：烹饪 15+8×等级 · 烘焙 12+6×等级 + 回合回复 round(2+0.19×等级)×4 · 饮品 12+7×等级
//   · 作物 growSec / xp 沿上一批尾部（1140@102 → 1260@112 ⇒ +12/级、+10/级）
//   · **材料等级 ≤ 配方等级 + 5**：成品与主料同级 ⇒ 恒成立（`recipeBalance` 对它们是恒等变换）
//
// 图片：public/images/items/food/<中文名>.png（种子在 items/seed/），与本模块的中文名逐字对应。

// ── 物品定义（46 件：原料 28 + 成品 14 + 种子 4）────────────────────────────
export const GAP_ITEMS = [
  // ── 采摘（fruit / vegetable / fungus）──
  { id: 'gap_for_101', name: '霜髓莓', type: 'ingredient', category: 'fruit', tier: 10, value: 328, stackable: true, maxStack: 9999 },
  { id: 'gap_for_103', name: '紫霜菌', type: 'ingredient', category: 'fungus', tier: 10, value: 335, stackable: true, maxStack: 9999 },
  { id: 'gap_for_107', name: '玉髓笋', type: 'ingredient', category: 'vegetable', tier: 10, value: 347, stackable: true, maxStack: 9999 },
  { id: 'gap_for_109', name: '白泽霜果', type: 'ingredient', category: 'fruit', tier: 10, value: 354, stackable: true, maxStack: 9999 },
  { id: 'gap_for_113', name: '九天玉果', type: 'ingredient', category: 'fruit', tier: 10, value: 367, stackable: true, maxStack: 9999 },
  { id: 'gap_for_115', name: '雪魄银耳', type: 'ingredient', category: 'fungus', tier: 10, value: 373, stackable: true, maxStack: 9999 },
  { id: 'gap_for_119', name: '九转灵芝', type: 'ingredient', category: 'fungus', tier: 10, value: 386, stackable: true, maxStack: 9999 },
  // ── 挖掘（root）──
  { id: 'gap_exc_101', name: '寒髓薯', type: 'ingredient', category: 'root', tier: 10, value: 328, stackable: true, maxStack: 9999 },
  { id: 'gap_exc_103', name: '九幽寒参', type: 'ingredient', category: 'root', tier: 10, value: 335, stackable: true, maxStack: 9999 },
  { id: 'gap_exc_107', name: '玄玉薯', type: 'ingredient', category: 'root', tier: 10, value: 347, stackable: true, maxStack: 9999 },
  { id: 'gap_exc_109', name: '霜玉薯', type: 'ingredient', category: 'root', tier: 10, value: 354, stackable: true, maxStack: 9999 },
  { id: 'gap_exc_113', name: '赤霄玉薯', type: 'ingredient', category: 'root', tier: 10, value: 367, stackable: true, maxStack: 9999 },
  { id: 'gap_exc_115', name: '雪玉藕', type: 'ingredient', category: 'root', tier: 10, value: 373, stackable: true, maxStack: 9999 },
  { id: 'gap_exc_119', name: '九转玉髓', type: 'ingredient', category: 'root', tier: 10, value: 386, stackable: true, maxStack: 9999 },
  // ── 垂钓（seafood）──
  { id: 'gap_fish_101', name: '冰纹鲈', type: 'ingredient', category: 'seafood', tier: 10, value: 328, stackable: true, maxStack: 9999 },
  { id: 'gap_fish_103', name: '寒潭鲫', type: 'ingredient', category: 'seafood', tier: 10, value: 335, stackable: true, maxStack: 9999 },
  { id: 'gap_fish_107', name: '玄冰鲟', type: 'ingredient', category: 'seafood', tier: 10, value: 347, stackable: true, maxStack: 9999 },
  { id: 'gap_fish_109', name: '霜鳞鲤', type: 'ingredient', category: 'seafood', tier: 10, value: 354, stackable: true, maxStack: 9999 },
  { id: 'gap_fish_115', name: '琥珀金鳟', type: 'ingredient', category: 'seafood', tier: 10, value: 373, stackable: true, maxStack: 9999 },
  // ── 狩猎（meat）──
  { id: 'gap_hun_103', name: '玄霜兔', type: 'ingredient', category: 'meat', tier: 10, value: 335, stackable: true, maxStack: 9999 },
  { id: 'gap_hun_107', name: '冰原雪雁', type: 'ingredient', category: 'meat', tier: 10, value: 347, stackable: true, maxStack: 9999 },
  { id: 'gap_hun_109', name: '白泽霜鹿', type: 'ingredient', category: 'meat', tier: 10, value: 354, stackable: true, maxStack: 9999 },
  { id: 'gap_hun_113', name: '赤霄锦鸡', type: 'ingredient', category: 'meat', tier: 10, value: 367, stackable: true, maxStack: 9999 },
  { id: 'gap_hun_119', name: '九转赤鹿', type: 'ingredient', category: 'meat', tier: 10, value: 386, stackable: true, maxStack: 9999 },
  // ── 农耕（grain + 种子）──
  { id: 'gap_far_101', name: '雪晶麦', type: 'ingredient', category: 'grain', tier: 10, value: 328, stackable: true, maxStack: 9999 },
  { id: 'gap_far_101Seed', name: '雪晶麦种子', type: 'seed', category: '种植产物', tier: 10, value: 33, stackable: true, maxStack: 9999 },
  { id: 'gap_far_113', name: '九天玉茭', type: 'ingredient', category: 'grain', tier: 10, value: 367, stackable: true, maxStack: 9999 },
  { id: 'gap_far_113Seed', name: '九天玉茭种子', type: 'seed', category: '种植产物', tier: 10, value: 37, stackable: true, maxStack: 9999 },
  { id: 'gap_far_115', name: '琥珀金稻', type: 'ingredient', category: 'grain', tier: 10, value: 373, stackable: true, maxStack: 9999 },
  { id: 'gap_far_115Seed', name: '琥珀金稻种子', type: 'seed', category: '种植产物', tier: 10, value: 37, stackable: true, maxStack: 9999 },
  { id: 'gap_far_119', name: '九转金稻', type: 'ingredient', category: 'grain', tier: 10, value: 386, stackable: true, maxStack: 9999 },
  { id: 'gap_far_119Seed', name: '九转金稻种子', type: 'seed', category: '种植产物', tier: 10, value: 39, stackable: true, maxStack: 9999 },
  // ── 烹饪（food：汤品 / 主菜）──
  { id: 'gap_coo_101', name: '雪麦鲈鱼汤', type: 'food', category: '汤品', tier: 10, value: 332, stackable: true, maxStack: 9999, heal: 823 },
  { id: 'gap_coo_103', name: '寒参菌羹', type: 'food', category: '汤品', tier: 10, value: 339, stackable: true, maxStack: 9999, heal: 839 },
  { id: 'gap_coo_107', name: '玄冰鲟脍', type: 'food', category: '主菜', tier: 10, value: 351, stackable: true, maxStack: 9999, heal: 871 },
  { id: 'gap_coo_107b', name: '玉薯雁脯', type: 'food', category: '主菜', tier: 10, value: 351, stackable: true, maxStack: 9999, heal: 871 },
  { id: 'gap_coo_109', name: '霜鹿果炙', type: 'food', category: '主菜', tier: 10, value: 358, stackable: true, maxStack: 9999, heal: 887 },
  { id: 'gap_coo_109b', name: '霜玉鲤羹', type: 'food', category: '汤品', tier: 10, value: 358, stackable: true, maxStack: 9999, heal: 887 },
  { id: 'gap_coo_113', name: '锦鸡玉果盏', type: 'food', category: '主菜', tier: 10, value: 371, stackable: true, maxStack: 9999, heal: 919 },
  { id: 'gap_coo_119', name: '赤鹿金稻饭', type: 'food', category: '主菜', tier: 10, value: 390, stackable: true, maxStack: 9999, heal: 967 },
  // ── 烘焙（food：baking，带回合回复）──
  { id: 'gap_bak_101', name: '霜髓薯糕', type: 'food', category: 'baking', tier: 10, value: 332, stackable: true, maxStack: 9999, heal: 618, regen: { perTurn: 21, turns: 4 } },
  { id: 'gap_bak_103', name: '霜兔鱼酥', type: 'food', category: 'baking', tier: 10, value: 339, stackable: true, maxStack: 9999, heal: 630, regen: { perTurn: 22, turns: 4 } },
  { id: 'gap_bak_115', name: '金稻鳟鱼炊', type: 'food', category: 'baking', tier: 10, value: 377, stackable: true, maxStack: 9999, heal: 702, regen: { perTurn: 24, turns: 4 } },
  // ── 酿造（drink：果酒 / 茶饮）──
  { id: 'gap_bre_113', name: '玉茭雪酿', type: 'drink', category: 'wine', tier: 10, value: 371, stackable: true, maxStack: 9999, heal: 803 },
  { id: 'gap_bre_115', name: '银耳玉藕露', type: 'drink', category: 'tea', tier: 10, value: 377, stackable: true, maxStack: 9999, heal: 817 },
  { id: 'gap_bre_119', name: '九转玉髓露', type: 'drink', category: 'tea', tier: 10, value: 390, stackable: true, maxStack: 9999, heal: 845 },
]

// ── 采集目标（28 条）──────────────────────────────────────────────────────
// 由各技能文件 push 进**它导出的那张基础表**（FORAGING_TARGETS 等）——
// itemSources / valueBalance / recipeBalance / itemNav / 探索都要读那些表 ⇒ 一处 push、多处同步。
export const GAP_GATHER = {
  foraging: [
    { itemId: 'gap_for_101', reqLevel: 101, xpPerAction: 604, intervalSec: 8.0 },
    { itemId: 'gap_for_103', reqLevel: 103, xpPerAction: 636, intervalSec: 8.0 },
    { itemId: 'gap_for_107', reqLevel: 107, xpPerAction: 700, intervalSec: 8.0 },
    { itemId: 'gap_for_109', reqLevel: 109, xpPerAction: 732, intervalSec: 8.0 },
    { itemId: 'gap_for_113', reqLevel: 113, xpPerAction: 796, intervalSec: 8.0 },
    { itemId: 'gap_for_115', reqLevel: 115, xpPerAction: 828, intervalSec: 8.0 },
    { itemId: 'gap_for_119', reqLevel: 119, xpPerAction: 892, intervalSec: 8.0 },
  ],
  excavation: [
    { itemId: 'gap_exc_101', reqLevel: 101, xpPerAction: 534, intervalSec: 7.6 },
    { itemId: 'gap_exc_103', reqLevel: 103, xpPerAction: 557, intervalSec: 7.6 },
    { itemId: 'gap_exc_107', reqLevel: 107, xpPerAction: 603, intervalSec: 7.7 },
    { itemId: 'gap_exc_109', reqLevel: 109, xpPerAction: 626, intervalSec: 7.7 },
    { itemId: 'gap_exc_113', reqLevel: 113, xpPerAction: 672, intervalSec: 7.8 },
    { itemId: 'gap_exc_115', reqLevel: 115, xpPerAction: 695, intervalSec: 7.8 },
    { itemId: 'gap_exc_119', reqLevel: 119, xpPerAction: 741, intervalSec: 7.8 },
  ],
  fishing: [
    { itemId: 'gap_fish_101', reqLevel: 101, xpPerAction: 528, intervalSec: 8.0 },
    { itemId: 'gap_fish_103', reqLevel: 103, xpPerAction: 552, intervalSec: 8.0 },
    { itemId: 'gap_fish_107', reqLevel: 107, xpPerAction: 600, intervalSec: 8.0 },
    { itemId: 'gap_fish_109', reqLevel: 109, xpPerAction: 624, intervalSec: 8.0 },
    { itemId: 'gap_fish_115', reqLevel: 115, xpPerAction: 696, intervalSec: 8.0 },
  ],
  hunting: [
    { itemId: 'gap_hun_103', reqLevel: 103, xpPerAction: 574, intervalSec: 8.0 },
    { itemId: 'gap_hun_107', reqLevel: 107, xpPerAction: 630, intervalSec: 8.0 },
    { itemId: 'gap_hun_109', reqLevel: 109, xpPerAction: 658, intervalSec: 8.0 },
    { itemId: 'gap_hun_113', reqLevel: 113, xpPerAction: 714, intervalSec: 8.0 },
    { itemId: 'gap_hun_119', reqLevel: 119, xpPerAction: 798, intervalSec: 8.0 },
  ],
}

// ── 农耕作物（4 条 + 种子映射）────────────────────────────────────────────
export const GAP_CROPS = [
  { itemId: 'gap_far_101', seedId: 'gap_far_101Seed', reqLevel: 101, growSec: 1128, xp: 790 },
  { itemId: 'gap_far_113', seedId: 'gap_far_113Seed', reqLevel: 113, growSec: 1272, xp: 910 },
  { itemId: 'gap_far_115', seedId: 'gap_far_115Seed', reqLevel: 115, growSec: 1296, xp: 930 },
  { itemId: 'gap_far_119', seedId: 'gap_far_119Seed', reqLevel: 119, growSec: 1344, xp: 970 },
]

// 种子映射（采摘/挖掘的「附产种子」与图鉴来源串都读 `farmSeeds.js` 的 SEED_MAP ⇒ 并进同一个对象）
import { SEED_MAP } from './farmSeeds.js'
Object.assign(SEED_MAP, {
  gap_far_101: 'gap_far_101Seed',
  gap_far_113: 'gap_far_113Seed',
  gap_far_115: 'gap_far_115Seed',
  gap_far_119: 'gap_far_119Seed',
})

/** 商店上架的种子（`shop.js` 合并进 SHOP_ITEMS；价格沿既有尾部 97@99 → 102/106） */
export const GAP_SEED_SHOP = [
  { itemId: 'gap_far_101Seed', price: 102 },
  { itemId: 'gap_far_113Seed', price: 106 },
  { itemId: 'gap_far_115Seed', price: 108 },
  { itemId: 'gap_far_119Seed', price: 112 },
]

// ── 制作配方（14 条：烹饪 8 · 烘焙 3 · 酿造 3）─────────────────────────────
// 公式与 lateGameFood.js 同款（别在每条里手抄数字）。
const prodXp = (lv) => lv * 14
const prodSuccess = (lv) => Math.max(0.5, Math.round((0.92 - lv * 0.0035) * 100) / 100)

export const GAP_PROD = {
  cooking: [
    { id: 'cook_gap_101', name: '雪麦鲈鱼汤', category: '汤品', reqLevel: 101, xp: prodXp(101), successChance: prodSuccess(101), ingredients: { gap_fish_101: 2, gap_far_101: 1, water: 1 }, output: { itemId: 'gap_coo_101', qty: 1 } },
    { id: 'cook_gap_103', name: '寒参菌羹', category: '汤品', reqLevel: 103, xp: prodXp(103), successChance: prodSuccess(103), ingredients: { gap_for_103: 1, gap_exc_103: 1, water: 1 }, output: { itemId: 'gap_coo_103', qty: 1 } },
    { id: 'cook_gap_107', name: '玄冰鲟脍', category: '主菜', reqLevel: 107, xp: prodXp(107), successChance: prodSuccess(107), ingredients: { gap_for_107: 1, gap_fish_107: 2 }, output: { itemId: 'gap_coo_107', qty: 1 } },
    { id: 'cook_gap_107b', name: '玉薯雁脯', category: '主菜', reqLevel: 107, xp: prodXp(107), successChance: prodSuccess(107), ingredients: { gap_exc_107: 2, gap_hun_107: 1, garlic: 1 }, output: { itemId: 'gap_coo_107b', qty: 1 } },
    { id: 'cook_gap_109', name: '霜鹿果炙', category: '主菜', reqLevel: 109, xp: prodXp(109), successChance: prodSuccess(109), ingredients: { gap_for_109: 2, gap_hun_109: 2, chili: 1 }, output: { itemId: 'gap_coo_109', qty: 1 } },
    { id: 'cook_gap_109b', name: '霜玉鲤羹', category: '汤品', reqLevel: 109, xp: prodXp(109), successChance: prodSuccess(109), ingredients: { gap_exc_109: 2, gap_fish_109: 1, water: 1 }, output: { itemId: 'gap_coo_109b', qty: 1 } },
    { id: 'cook_gap_113', name: '锦鸡玉果盏', category: '主菜', reqLevel: 113, xp: prodXp(113), successChance: prodSuccess(113), ingredients: { gap_for_113: 2, gap_hun_113: 1, garlic: 1 }, output: { itemId: 'gap_coo_113', qty: 1 } },
    { id: 'cook_gap_119', name: '赤鹿金稻饭', category: '主菜', reqLevel: 119, xp: prodXp(119), successChance: prodSuccess(119), ingredients: { gap_hun_119: 2, gap_far_119: 2, rice: 1 }, output: { itemId: 'gap_coo_119', qty: 1 } },
  ],
  baking: [
    { id: 'bake_gap_101', name: '霜髓薯糕', category: 'baking', reqLevel: 101, xp: prodXp(101), successChance: prodSuccess(101), ingredients: { gap_for_101: 2, gap_exc_101: 2 }, output: { itemId: 'gap_bak_101', qty: 1 } },
    { id: 'bake_gap_103', name: '霜兔鱼酥', category: 'baking', reqLevel: 103, xp: prodXp(103), successChance: prodSuccess(103), ingredients: { gap_hun_103: 1, gap_fish_103: 2 }, output: { itemId: 'gap_bak_103', qty: 1 } },
    { id: 'bake_gap_115', name: '金稻鳟鱼炊', category: 'baking', reqLevel: 115, xp: prodXp(115), successChance: prodSuccess(115), ingredients: { gap_fish_115: 1, gap_far_115: 2 }, output: { itemId: 'gap_bak_115', qty: 1 } },
  ],
  brewing: [
    { id: 'brew_gap_113', name: '玉茭雪酿', category: '果酒', reqLevel: 113, xp: prodXp(113), successChance: prodSuccess(113), ingredients: { gap_exc_113: 2, gap_far_113: 2, water: 1 }, output: { itemId: 'gap_bre_113', qty: 1 } },
    { id: 'brew_gap_115', name: '银耳玉藕露', category: '茶饮', reqLevel: 115, xp: prodXp(115), successChance: prodSuccess(115), ingredients: { gap_for_115: 1, gap_exc_115: 2, water: 1 }, output: { itemId: 'gap_bre_115', qty: 1 } },
    { id: 'brew_gap_119', name: '九转玉髓露', category: '茶饮', reqLevel: 119, xp: prodXp(119), successChance: prodSuccess(119), ingredients: { gap_for_119: 1, gap_exc_119: 2, water: 1 }, output: { itemId: 'gap_bre_119', qty: 1 } },
  ],
}

// ── 覆盖表（守卫与人工核对共用）：每件原料的消费方 ────────────────────────────
// 采摘 7 / 挖掘 7 / 垂钓 5 / 狩猎 5 / 农耕 4 = 28 件原料，**全部**被上面 14 条配方吃掉：
//   101 霜髓莓→薯糕 · 寒髓薯→薯糕 · 冰纹鲈→鱼汤 · 雪晶麦→鱼汤
//   103 紫霜菌→菌羹 · 九幽寒参→菌羹 · 玄霜兔→鱼酥 · 寒潭鲫→鱼酥
//   107 玉髓笋→鲟脍 · 玄玉薯→雁脯 · 玄冰鲟→鲟脍 · 冰原雪雁→雁脯
//   109 白泽霜果→果炙 · 霜玉薯→鲤羹 · 白泽霜鹿→果炙 · 霜鳞鲤→鲤羹
//   113 九天玉果→玉果盏 · 赤霄玉薯→雪酿 · 赤霄锦鸡→玉果盏 · 九天玉茭→雪酿
//   115 雪魄银耳→玉藕露 · 雪玉藕→玉藕露 · 琥珀金鳟→鳟鱼炊 · 琥珀金稻→鳟鱼炊
//   119 九转灵芝→玉髓露 · 九转玉髓→玉髓露 · 九转赤鹿→金稻饭 · 九转金稻→金稻饭
export const GAP_ITEM_IDS = GAP_ITEMS.map((it) => it.id)
