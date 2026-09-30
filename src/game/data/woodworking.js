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

import { timberOfLevel } from './timbers.js'

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
  // Lv101-120「补档」两件（2026-09-29 用户授权批）：木直接点名本批新木（玄铁杉/天罡沉香，
  // 见 lateGameFood.js——20 档木材体系与装备套对应、只到 Lv100，是冻结口径）。
  // 每件的手工装潢效果由下面 CRAFTED_DECOR 的曲线公式自动续上（12.1% / 13.1%）。
  { level: 102, id: 'divineCouch', name: '太初神榻', wood: 'late_wood_01', woodQty: 5, tier: '传说' },
  { level: 112, id: 'agarwoodAltar', name: '天罡香案', wood: 'late_wood_02', woodQty: 5, tier: '传说' },
  // 副业「同物变体」三件（2026-09-30，体检 §7「不足 4」的 T3）：给**基底天罡香案（Lv112）**加
  // ·精 / ·珍 / ·御（Lv114 / 117 / 120），木沿用基底那一档（天罡沉香 Lv112 ≤ 114+5 ✓），数量 6/7/8。
  // 物品 / 配方 / 手工装潢三处由上面的 `.map()` 与 `CRAFTED_DECOR` 曲线**自动派生**，无需另写。
  { level: 114, id: 'agarwoodAltarFine', name: '天罡香案·精', wood: 'late_wood_02', woodQty: 6, tier: '传说' },
  { level: 117, id: 'agarwoodAltarRare', name: '天罡香案·珍', wood: 'late_wood_02', woodQty: 7, tier: '传说' },
  { level: 120, id: 'agarwoodAltarRoyal', name: '天罡香案·御', wood: 'late_wood_02', woodQty: 8, tier: '传说' },
]

// ── 档位加密（v2.29.7，2026-09-30 用户口径：「同样的时长但不枯燥」）────────────────────
// 与「副业 16 支」同一套口径（完整说明见 `sidelineWorks.js` 顶部那段）：木工 10 件基底也是
// **10 级/件**，每两档之间插一档「**·良**」（Lv6/16/…/86），**图沿用基底那张**（零美术）。
// 🔴 **加密档不进 `CRAFTED_DECOR`**（它不是手工装潢）⇒ 手工装潢的件数与合计（+65%）一个都不变，
//    「手工装潢效果严格递增」那条守卫也不受影响。它的去处与其它加密档一致：**量产阶梯 + 半价回收**。
// ⚠️ 这段**必须排在 `CRAFTED_DECOR` 之前**：那样下面那层 `.filter((it) => !it.densified)` 才是
//    **承重的**（漏掉就真的会凭空多出 9 件装潢）。排在后面的话过滤只是装饰，反例验证抓不到它。
// 只加密 **Lv1~91 那段平原**（补档 102/112 与同物变体 114/117/120 本来就够密）。
const DENSIFY_SUFFIX = '·良'
{
  const out = []
  for (let i = 0; i < WOODWORK_ITEMS_DEF.length; i++) {
    const it = WOODWORK_ITEMS_DEF[i]
    out.push(it)
    const next = WOODWORK_ITEMS_DEF[i + 1]
    if (next && next.level <= 91 && next.level - it.level >= 10) {
      // 木材取**自己那一档**（`timberOfLevel(等级)`，不是沿用基底那档）——同档木材是不变量，
      // 有守卫按「|木材档位 − 配方等级| ≤ 4」逐条查（沿用基底会让 Lv6 的配方用 Lv1 的木材而 FAIL）。
      const lvMid = it.level + 5
      out.push({ ...it, level: lvMid, id: `${it.id}Fine`, name: `${it.name}${DENSIFY_SUFFIX}`, wood: timberOfLevel(lvMid).id, densified: true })
    }
  }
  WOODWORK_ITEMS_DEF.length = 0
  WOODWORK_ITEMS_DEF.push(...out)
}

/**
 * 手工装潢：每件木器对应一件装潢，效果（餐厅收入 %）随等级递增。
 * ⚠️ v2.10.1（2026-09-17 用户要求「300 件装潢的加成应该下调，加成比手工的太多了」）：
 *   商店 300 件的合计从 +469% 压到 **+209%**（改生成器的曲线），同时把手工从 0.6~4.2（合计 +24）
 *   抬到 **2~11（合计 +65）** —— 于是手工在装潢总乘区里从 **4% 升到 ~24%**，10 件就能顶商店 300 件的三成，
 *   且单件（2%~11%）明显强于商店最贵的那件（1.3%）。要再调只改这一个系数即可整体平移。
 */
export const CRAFTED_DECOR = [
  // 木柴堆（2026-09-25 用户拍板）：**直接吃「木材」×10** 的手工装潢 —— 给采摘附产（50%）的
  // 无限木材一个**限流消耗口**（每档一次、全场效果最低，不会变成刷钱管线）。
  // ⚠️ 放在数组最前（effect 1.5 < 木碗架 2.0），保住「手工装潢效果严格递增」的守卫不变量；
  // 它不是木器（woodPile 不进 WOODWORK_ITEMS_DEF），是唯一一条吃基础木材的手工装潢。
  {
    id: 'decor_hand_woodPile',
    name: '🪚 木柴堆',
    category: 'handmade',
    price: null,
    effect: 1.5,
    craftedFrom: { itemId: 'wood', qty: 10 },
  },
  // ⚠️ `.filter` 是**显式**的（不靠「加密通行在下面、此处已求值」这种顺序巧合）：
  //   加密档「·良」不是手工装潢（见下面「档位加密」一段），漏掉这层过滤就会凭空多出 9 件装潢、
  //   把手工装潢合计与「效果严格递增」一起改写。
  ...WOODWORK_ITEMS_DEF.filter((it) => !it.densified).map((it) => ({
    id: `decor_hand_${it.id}`,
    name: `🪚 ${it.name}`,
    category: 'handmade', // 不进商店的 category 页签（DECOR_CATEGORIES 里没有它）
    price: null, // 不可金币购买：只能用手工品做
    effect: Math.round((2 + (it.level - 1) * 0.1) * 10) / 10,
    craftedFrom: { itemId: it.id, qty: 1 },
    wood: it.wood,
  })),
]

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
  // 加密档：**与基底共用同一张图**（零美术；显式 `image` 优先于按名字拼路径，见 itemImage.js）
  ...(it.densified ? { image: `images/items/food/${encodeURIComponent(it.name.slice(0, -DENSIFY_SUFFIX.length))}.png` } : {}),
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
