// 食材保鲜 Ⅵ/Ⅶ 阶（2026-09-29，成长平衡体检 §9.1 的 5-A / T1）—— **手写扩展模块**。
//
// 为什么另开一个模块、而不是往 `preserveTiers.js` 里加：
//   那份是**生成器产物**（`scripts/gen/gen_preserve_tiers.mjs`）且已上硬门禁
//   （`gen_drift_audit` 的 KNOWN_DRIFT，重跑会改写冻结层）。新增内容的当代落点是
//   **手写扩展模块 + 在底部 push**（先例：`aojiSideline.js` / `lateGameFood.js` / `pickles.js`）。
//
// 为什么加这两阶：体检量出「食材保鲜」是**全站最疏的一条线** —— 8 个内容点、末件 Lv85、
//   `Lv45→64` 与 `Lv65→84` 各空 20 级、**`Lv86→120` 空 35 级**（级/件 8.0 → 20.0 → 40.0）。
//   Ⅵ = **Lv105**、Ⅶ = **Lv120**，把这段空白切成两段。
//
// 🔴 硬约束（交接文档 T1 点名，别违反）：**增益剂的乘数不许再抬。**
//   `xpTonic5` / `yieldTonic5` 的 **×4.5** 正是成长平衡体检四档矩阵里「**单一 buff**」档的口径，
//   抬乘数会让整张矩阵、以及「叠区二级饱和」（`XP_SPEEDUP_CAP_BANDS` ×6/×10/×14）的标定一起作废。
//   ⇒ Ⅵ/Ⅶ **只加时长**（乘数保持 4.5）；保鲜剂那条可以继续抬 `refreshSpoilMs`（它不影响成长速度）。
//
// 口径**逐项沿用原表**（这样同系列看起来是一条连续的曲线，不会突然跳档）：
//   · 保鲜剂 `refreshSpoilMs` = n² 天（1 / 4 / 9 / 16 / 25 ⇒ Ⅵ = **36 天**、Ⅶ = **49 天**）
//   · `value` 每阶 +60（…235 / 295 ⇒ **355 / 415**）
//   · `xp` 每阶 +260（…870 / 1130 ⇒ **1390 / 1650**）
//   · `successChance` 每阶 −0.06（…0.72 / 0.66 ⇒ **0.60 / 0.54**）
//   · 材料沿用 **盐矿 + 稻米**（低阶通用料 ⇒「材料获取等级 ≤ 配方等级 + 5」恒成立；
//     且盐矿属**矿物**，被 `recipeBalance` 忽略 ⇒ 对这两条新配方是恒等变换）
//
// 图片：**五个阶级共用同一张图**（`images/items/tool/保鲜剂.png` 等 3 张）⇒ 加阶**不需要新图**
//   （见 `docs/new_zy/02-美术提示词-完整.md` §2：那三张提示词只在「想让高阶一眼看出更高级」时才用）。
//
// ⚠️ 配方**逐条写全、不用循环/工厂展开**：与 `preserveTiers.js` 同一形态，也让
//   `difficulty_audit` 的「成功率字段」条数基线（`+6`）与配方条数一一对应 —— 用工厂会把
//   6 条压成 2 处字面量，基线就得写成「+2 处」，读的人会以为少加了配方。
//   （⚠️ 那条守卫扫的是**源码文本**、不剥注释 ⇒ 注释里也别按「字段名 + 冒号」的写法举例，
//    否则会被数进去，本轮实测踩过一次。）
const DAY_MS = 86400000

export const PRESERVE_TIER_EXT_ITEMS = [
  // ── 保鲜剂（刷新背包食材腐坏计时 + 冷库续时）──
  { id: 'preservTier6', name: '保鲜剂·Ⅵ', type: 'consumable', category: 'buff', tier: 6, value: 355, use: { refreshSpoilMs: 36 * DAY_MS }, image: 'images/items/tool/保鲜剂.png' },
  { id: 'preservTier7', name: '保鲜剂·Ⅶ', type: 'consumable', category: 'buff', tier: 7, value: 415, use: { refreshSpoilMs: 49 * DAY_MS }, image: 'images/items/tool/保鲜剂.png' },
  // ── 经验增益剂（乘数封在 Ⅴ 阶的 ×4.5，只加时长）──
  { id: 'xpTonic6', name: '经验增益剂·Ⅵ', type: 'consumable', category: 'buff', tier: 6, value: 355, use: { buffXp: { mult: 4.5, minutes: 260 } }, image: 'images/items/tool/经验增益剂.png' },
  { id: 'xpTonic7', name: '经验增益剂·Ⅶ', type: 'consumable', category: 'buff', tier: 7, value: 415, use: { buffXp: { mult: 4.5, minutes: 360 } }, image: 'images/items/tool/经验增益剂.png' },
  // ── 产量增益剂（同上）──
  { id: 'yieldTonic6', name: '产量增益剂·Ⅵ', type: 'consumable', category: 'buff', tier: 6, value: 355, use: { buffYield: { mult: 4.5, minutes: 260 } }, image: 'images/items/tool/产量增益剂.png' },
  { id: 'yieldTonic7', name: '产量增益剂·Ⅶ', type: 'consumable', category: 'buff', tier: 7, value: 415, use: { buffYield: { mult: 4.5, minutes: 360 } }, image: 'images/items/tool/产量增益剂.png' },
]

export const PRESERVE_TIER_EXT_RECIPES = [
  { id: 'preservRecipe6', name: '保鲜剂·Ⅵ', category: '保鲜', reqLevel: 105, xp: 1390, successChance: 0.6, ingredients: { saltOre: 15, rice: 26 }, output: { itemId: 'preservTier6', qty: 1 } },
  { id: 'preservRecipe7', name: '保鲜剂·Ⅶ', category: '保鲜', reqLevel: 120, xp: 1650, successChance: 0.54, ingredients: { saltOre: 17, rice: 30 }, output: { itemId: 'preservTier7', qty: 1 } },
  { id: 'xpRecipe6', name: '经验增益剂·Ⅵ', category: '增益', reqLevel: 105, xp: 1390, successChance: 0.6, ingredients: { saltOre: 15, rice: 26 }, output: { itemId: 'xpTonic6', qty: 1 } },
  { id: 'xpRecipe7', name: '经验增益剂·Ⅶ', category: '增益', reqLevel: 120, xp: 1650, successChance: 0.54, ingredients: { saltOre: 17, rice: 30 }, output: { itemId: 'xpTonic7', qty: 1 } },
  { id: 'yieldRecipe6', name: '产量增益剂·Ⅵ', category: '增益', reqLevel: 105, xp: 1390, successChance: 0.6, ingredients: { saltOre: 15, rice: 26 }, output: { itemId: 'yieldTonic6', qty: 1 } },
  { id: 'yieldRecipe7', name: '产量增益剂·Ⅶ', category: '增益', reqLevel: 120, xp: 1650, successChance: 0.54, ingredients: { saltOre: 17, rice: 30 }, output: { itemId: 'yieldTonic7', qty: 1 } },
]
