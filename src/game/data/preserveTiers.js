// 保鲜/增益剂 5 阶级（3 系列 × 5 阶级 = 15）— 生成器 gen_preserve_tiers.mjs 产出，勿手改。
// 每系列（保鲜剂/经验增益剂/产量增益剂）× 5 阶级（Ⅰ~Ⅴ），覆盖 lv 1~99 连续等级段；
// 契约材料用低阶通用 盐矿/稻米（食灵阶级规则），buff 数值随 reqLevel 单调递增。
export const PRESERVE_TIER_ITEMS = [
  { id: 'preservTier1', name: '保鲜剂·Ⅰ', type: 'consumable', category: 'buff', tier: 1, value: 55, use: {"refreshSpoilMs":86400000}, image: 'images/items/tool/保鲜剂.png' },
  { id: 'preservTier2', name: '保鲜剂·Ⅱ', type: 'consumable', category: 'buff', tier: 2, value: 115, use: {"refreshSpoilMs":345600000}, image: 'images/items/tool/保鲜剂.png' },
  { id: 'preservTier3', name: '保鲜剂·Ⅲ', type: 'consumable', category: 'buff', tier: 3, value: 175, use: {"refreshSpoilMs":777600000}, image: 'images/items/tool/保鲜剂.png' },
  { id: 'preservTier4', name: '保鲜剂·Ⅳ', type: 'consumable', category: 'buff', tier: 4, value: 235, use: {"refreshSpoilMs":1382400000}, image: 'images/items/tool/保鲜剂.png' },
  { id: 'preservTier5', name: '保鲜剂·Ⅴ', type: 'consumable', category: 'buff', tier: 5, value: 295, use: {"refreshSpoilMs":2160000000}, image: 'images/items/tool/保鲜剂.png' },
  { id: 'xpTonic1', name: '经验增益剂·Ⅰ', type: 'consumable', category: 'buff', tier: 1, value: 55, use: {"buffXp":{"mult":1.2,"minutes":30}}, image: 'images/items/tool/经验增益剂.png' },
  { id: 'xpTonic2', name: '经验增益剂·Ⅱ', type: 'consumable', category: 'buff', tier: 2, value: 115, use: {"buffXp":{"mult":2,"minutes":75}}, image: 'images/items/tool/经验增益剂.png' },
  { id: 'xpTonic3', name: '经验增益剂·Ⅲ', type: 'consumable', category: 'buff', tier: 3, value: 175, use: {"buffXp":{"mult":2.8,"minutes":110}}, image: 'images/items/tool/经验增益剂.png' },
  { id: 'xpTonic4', name: '经验增益剂·Ⅳ', type: 'consumable', category: 'buff', tier: 4, value: 235, use: {"buffXp":{"mult":3.6,"minutes":150}}, image: 'images/items/tool/经验增益剂.png' },
  { id: 'xpTonic5', name: '经验增益剂·Ⅴ', type: 'consumable', category: 'buff', tier: 5, value: 295, use: {"buffXp":{"mult":4.5,"minutes":195}}, image: 'images/items/tool/经验增益剂.png' },
  { id: 'yieldTonic1', name: '产量增益剂·Ⅰ', type: 'consumable', category: 'buff', tier: 1, value: 55, use: {"buffYield":{"mult":1.5,"minutes":30}}, image: 'images/items/tool/产量增益剂.png' },
  { id: 'yieldTonic2', name: '产量增益剂·Ⅱ', type: 'consumable', category: 'buff', tier: 2, value: 115, use: {"buffYield":{"mult":2.2,"minutes":75}}, image: 'images/items/tool/产量增益剂.png' },
  { id: 'yieldTonic3', name: '产量增益剂·Ⅲ', type: 'consumable', category: 'buff', tier: 3, value: 175, use: {"buffYield":{"mult":3,"minutes":110}}, image: 'images/items/tool/产量增益剂.png' },
  { id: 'yieldTonic4', name: '产量增益剂·Ⅳ', type: 'consumable', category: 'buff', tier: 4, value: 235, use: {"buffYield":{"mult":3.8,"minutes":150}}, image: 'images/items/tool/产量增益剂.png' },
  { id: 'yieldTonic5', name: '产量增益剂·Ⅴ', type: 'consumable', category: 'buff', tier: 5, value: 295, use: {"buffYield":{"mult":4.5,"minutes":195}}, image: 'images/items/tool/产量增益剂.png' },
]
export const PRESERVE_TIER_RECIPES = [
  { id: 'preservRecipe1', name: '保鲜剂·Ⅰ', category: '保鲜', reqLevel: 5, xp: 90, successChance: 0.9, ingredients: {"saltOre":3,"rice":6}, output: { itemId: 'preservTier1', qty: 1 } },
  { id: 'preservRecipe2', name: '保鲜剂·Ⅱ', category: '保鲜', reqLevel: 25, xp: 350, successChance: 0.84, ingredients: {"saltOre":6,"rice":10}, output: { itemId: 'preservTier2', qty: 1 } },
  { id: 'preservRecipe3', name: '保鲜剂·Ⅲ', category: '保鲜', reqLevel: 45, xp: 610, successChance: 0.78, ingredients: {"saltOre":8,"rice":14}, output: { itemId: 'preservTier3', qty: 1 } },
  { id: 'preservRecipe4', name: '保鲜剂·Ⅳ', category: '保鲜', reqLevel: 65, xp: 870, successChance: 0.72, ingredients: {"saltOre":11,"rice":18}, output: { itemId: 'preservTier4', qty: 1 } },
  { id: 'preservRecipe5', name: '保鲜剂·Ⅴ', category: '保鲜', reqLevel: 85, xp: 1130, successChance: 0.66, ingredients: {"saltOre":13,"rice":22}, output: { itemId: 'preservTier5', qty: 1 } },
  { id: 'xpRecipe1', name: '经验增益剂·Ⅰ', category: '增益', reqLevel: 5, xp: 90, successChance: 0.9, ingredients: {"saltOre":3,"rice":6}, output: { itemId: 'xpTonic1', qty: 1 } },
  { id: 'xpRecipe2', name: '经验增益剂·Ⅱ', category: '增益', reqLevel: 25, xp: 350, successChance: 0.84, ingredients: {"saltOre":6,"rice":10}, output: { itemId: 'xpTonic2', qty: 1 } },
  { id: 'xpRecipe3', name: '经验增益剂·Ⅲ', category: '增益', reqLevel: 45, xp: 610, successChance: 0.78, ingredients: {"saltOre":8,"rice":14}, output: { itemId: 'xpTonic3', qty: 1 } },
  { id: 'xpRecipe4', name: '经验增益剂·Ⅳ', category: '增益', reqLevel: 65, xp: 870, successChance: 0.72, ingredients: {"saltOre":11,"rice":18}, output: { itemId: 'xpTonic4', qty: 1 } },
  { id: 'xpRecipe5', name: '经验增益剂·Ⅴ', category: '增益', reqLevel: 85, xp: 1130, successChance: 0.66, ingredients: {"saltOre":13,"rice":22}, output: { itemId: 'xpTonic5', qty: 1 } },
  { id: 'yieldRecipe1', name: '产量增益剂·Ⅰ', category: '增益', reqLevel: 5, xp: 90, successChance: 0.9, ingredients: {"saltOre":3,"rice":6}, output: { itemId: 'yieldTonic1', qty: 1 } },
  { id: 'yieldRecipe2', name: '产量增益剂·Ⅱ', category: '增益', reqLevel: 25, xp: 350, successChance: 0.84, ingredients: {"saltOre":6,"rice":10}, output: { itemId: 'yieldTonic2', qty: 1 } },
  { id: 'yieldRecipe3', name: '产量增益剂·Ⅲ', category: '增益', reqLevel: 45, xp: 610, successChance: 0.78, ingredients: {"saltOre":8,"rice":14}, output: { itemId: 'yieldTonic3', qty: 1 } },
  { id: 'yieldRecipe4', name: '产量增益剂·Ⅳ', category: '增益', reqLevel: 65, xp: 870, successChance: 0.72, ingredients: {"saltOre":11,"rice":18}, output: { itemId: 'yieldTonic4', qty: 1 } },
  { id: 'yieldRecipe5', name: '产量增益剂·Ⅴ', category: '增益', reqLevel: 85, xp: 1130, successChance: 0.66, ingredients: {"saltOre":13,"rice":22}, output: { itemId: 'yieldTonic5', qty: 1 } },
]
export const PRESERV_TIER_META = {
 "preservTier1": {
  "series": "preserv",
  "name": "保鲜剂",
  "tier": 1,
  "roman": "Ⅰ",
  "reqLevel": 5
 },
 "preservTier2": {
  "series": "preserv",
  "name": "保鲜剂",
  "tier": 2,
  "roman": "Ⅱ",
  "reqLevel": 25
 },
 "preservTier3": {
  "series": "preserv",
  "name": "保鲜剂",
  "tier": 3,
  "roman": "Ⅲ",
  "reqLevel": 45
 },
 "preservTier4": {
  "series": "preserv",
  "name": "保鲜剂",
  "tier": 4,
  "roman": "Ⅳ",
  "reqLevel": 65
 },
 "preservTier5": {
  "series": "preserv",
  "name": "保鲜剂",
  "tier": 5,
  "roman": "Ⅴ",
  "reqLevel": 85
 },
 "xpTonic1": {
  "series": "xp",
  "name": "经验增益剂",
  "tier": 1,
  "roman": "Ⅰ",
  "reqLevel": 5
 },
 "xpTonic2": {
  "series": "xp",
  "name": "经验增益剂",
  "tier": 2,
  "roman": "Ⅱ",
  "reqLevel": 25
 },
 "xpTonic3": {
  "series": "xp",
  "name": "经验增益剂",
  "tier": 3,
  "roman": "Ⅲ",
  "reqLevel": 45
 },
 "xpTonic4": {
  "series": "xp",
  "name": "经验增益剂",
  "tier": 4,
  "roman": "Ⅳ",
  "reqLevel": 65
 },
 "xpTonic5": {
  "series": "xp",
  "name": "经验增益剂",
  "tier": 5,
  "roman": "Ⅴ",
  "reqLevel": 85
 },
 "yieldTonic1": {
  "series": "yield",
  "name": "产量增益剂",
  "tier": 1,
  "roman": "Ⅰ",
  "reqLevel": 5
 },
 "yieldTonic2": {
  "series": "yield",
  "name": "产量增益剂",
  "tier": 2,
  "roman": "Ⅱ",
  "reqLevel": 25
 },
 "yieldTonic3": {
  "series": "yield",
  "name": "产量增益剂",
  "tier": 3,
  "roman": "Ⅲ",
  "reqLevel": 45
 },
 "yieldTonic4": {
  "series": "yield",
  "name": "产量增益剂",
  "tier": 4,
  "roman": "Ⅳ",
  "reqLevel": 65
 },
 "yieldTonic5": {
  "series": "yield",
  "name": "产量增益剂",
  "tier": 5,
  "roman": "Ⅴ",
  "reqLevel": 85
 }
}
