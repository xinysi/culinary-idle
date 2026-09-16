// 木工（Woodworking）— 副业大类第一支（v2.9.0，2026-09-16）
//
// 定位（用户 2026-09-16 决策）：**副业不产食材，产「餐厅经营侧的乘区与独占品」**。
// 木工吃「伐木」产出的 20 档木材 → 做出 10 件木器 → 每件木器可以**做成一件手工装潢**，
// 手工装潢走既有的「餐厅装潢」体系（`restaurant.decor` 是 id 数组、收入按 effect 累加），
// 因此**收入公式、排序、面板全都不用改**，只是把「装潢只能金币买」变成「能自己打」。
//
// 三条铁律对齐：
// 1. **副业不吃食灵经验**（食灵的技能域是白名单，木工不在其中）；**不入山海食经**（线↔技能白名单）。
// 2. 木器是**采集拿不到的独占物**（只有木工能做），且**不进任何材料池**（交易所/觅珍/礼包/珍馐阁）
//    —— 与 `material` 同一套「口径单一来源」纪律。
// 3. 配方材料一律是**该等级档位的木材**（每 10 级一件，正好覆盖 20 档木材的前 10 档），
//    满足「材料获取等级 ≤ 物品等级 + 5」，因此 `balanceRecipeLevels` 不会裁剪它们。

/** 木器类别标签（`itemDetail.CATEGORY_LABEL` 需同步加 `furniture: '木器'`） */
export const WOODWORK_CATEGORY = 'furniture'

/** 10 件木器：等级 / 名称 / 材料（同档木材）/ 说明 */
export const WOODWORK_ITEMS_DEF = [
  { level: 1, id: 'bowlRack', name: '木碗架', wood: 'pineWood', woodQty: 2, tier: '入门' },
  { level: 11, id: 'spoonRack', name: '木勺架', wood: 'birchWood', woodQty: 2, tier: '基础' },
  { level: 21, id: 'spiceRack', name: '木调料架', wood: 'oakWood', woodQty: 3, tier: '基础' },
  { level: 31, id: 'woodenPlate', name: '木餐盘', wood: 'nanmuWood', woodQty: 3, tier: '进阶' },
  { level: 41, id: 'wineRack', name: '木酒架', wood: 'redSandalWood', woodQty: 3, tier: '进阶' },
  { level: 51, id: 'foldingScreen', name: '木屏风', wood: 'ironwoodTimber', woodQty: 4, tier: '高阶' },
  { level: 61, id: 'longTable', name: '木长桌', wood: 'fragrantRosewood', woodQty: 4, tier: '高阶' },
  { level: 71, id: 'carvedPanel', name: '木雕挂屏', wood: 'glazeWood', woodQty: 4, tier: '名贵' },
  { level: 81, id: 'incenseTable', name: '木香案', wood: 'starWood', woodQty: 5, tier: '名贵' },
  { level: 91, id: 'sacredAltar', name: '神木供案', wood: 'voidWood', woodQty: 5, tier: '传说' },
]

/** 手工装潢：每件木器对应一件装潢，效果（餐厅收入 %）随等级递增（0.6→4.2，合计 +24.0%） */
export const CRAFTED_DECOR = WOODWORK_ITEMS_DEF.map((it) => ({
  id: `decor_hand_${it.id}`,
  name: `🪚 ${it.name}`,
  category: 'handmade', // 不进商店的 category 页签（DECOR_CATEGORIES 里没有它）
  price: null, // 不可金币购买：只能用手工品做
  effect: Math.round((0.6 + (it.level - 1) * 0.04) * 10) / 10,
  craftedFrom: { itemId: it.id, qty: 1 },
  wood: it.wood,
}))

/** 木工物品（合并进 ITEMS） */
export const WOODWORKING_ITEMS = WOODWORK_ITEMS_DEF.map((it) => ({
  id: it.id,
  name: it.name,
  type: 'ingredient',
  category: WOODWORK_CATEGORY,
  tier: Math.min(10, Math.ceil(it.level / 10)),
  // 价值贴着 valueBalance 的曲线（2 + 2.5×level），会被该曲线的 ±30% 带校正
  value: Math.round(2 + it.level * 2.5),
  stackable: true,
  maxStack: 9999,
}))

/** 木工配方（制作类：与锻造同型，成功率随等级递减；经验贴近「25 + 等级×13」基准） */
export const WOODWORKING_RECIPES = WOODWORK_ITEMS_DEF.map((it) => ({
  id: `ww_${it.id}`,
  name: it.name,
  category: '木器',
  reqLevel: it.level,
  xp: Math.round(25 + it.level * 13),
  successChance: Math.max(0.55, 0.95 - it.level * 0.0044),
  ingredients: { [it.wood]: it.woodQty },
  output: { itemId: it.id, qty: 1 },
}))

/** 木器 → 对应手工装潢 id（UI 与守卫共用） */
export function decorOfWoodwork(itemId) {
  return CRAFTED_DECOR.find((d) => d.craftedFrom?.itemId === itemId) ?? null
}
