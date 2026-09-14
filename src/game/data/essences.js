// 菌灵露（2026-09-14 新增，v2.3.0）— 「灵圃菌房」页的核心产出：**8 档统一阶梯**。
//
// 设计动机（用户 2026-09-14 反馈）：原先的「灵田产稀有材料」与采集完全重叠，且量级差 3~4 个数量级
// （灵芝：灵田 2 件/天 vs 挖掘约 15,400 件/天）⇒ 产线没有存在意义。
// 改法：产线不再产**材料**，而是把采集来的材料**加工成采集拿不到的乘区物品**——
// 乘区作用在那条 10⁴/天 的基数上才有价值；同时「无限采集」从缺点变成燃料（采集越多 → 精华越多）。
//
// 阶梯锚定真实等级（解决「四个灵植等级不统一」）：8 档分别对应 8 种真实材料的采集等级，覆盖 Lv20 → Lv90，
// 与蜂蜜的 8 品级同构。Ⅰ~Ⅷ 的效果单调递增；Ⅴ 起追加「采集间隔」、Ⅶ 起追加「餐厅收入」。
//
// 约束：不新增 schema 键；全部 type=consumable / category=buff ⇒ 三套平衡系统都不碰、数值可自定死。
// ⚠️ 本模块**不得** import `items.js`（见文件末尾 essenceCostText 的注释：会造成循环依赖）。

/** 8 档：material = 主料（决定档位锚点），aux = 辅料（用菌房自己的产出/肥料） */
export const ESSENCE_TIERS = [
  { tier: 1, id: 'essence1', name: '菌灵露·Ⅰ', anchor: 'mushroom', anchorLv: 20, material: { mushroom: 6 }, aux: { compost: 1 }, hours: 4, minutes: 30, xp: 1.3, yld: 1.25, gather: 0, restaurant: 0, value: 60 },
  { tier: 2, id: 'essence2', name: '菌灵露·Ⅱ', anchor: 'excavation_ext_12', anchorLv: 38, material: { excavation_ext_12: 4 }, aux: { compost: 2 }, hours: 8, minutes: 45, xp: 1.5, yld: 1.4, gather: 0, restaurant: 0, value: 130 },
  { tier: 3, id: 'essence3', name: '菌灵露·Ⅲ', anchor: 'lingzhi', anchorLv: 60, material: { lingzhi: 3 }, aux: { richCompost: 2 }, hours: 12, minutes: 60, xp: 1.8, yld: 1.6, gather: 0, restaurant: 0, value: 210 },
  { tier: 4, id: 'essence4', name: '菌灵露·Ⅳ', anchor: 'matsutake', anchorLv: 70, material: { matsutake: 2 }, aux: { richCompost: 3 }, hours: 16, minutes: 75, xp: 2.1, yld: 1.85, gather: 0, restaurant: 0, value: 290 },
  { tier: 5, id: 'essence5', name: '菌灵露·Ⅴ', anchor: 'foraging_ext_22', anchorLv: 71, material: { foraging_ext_22: 2 }, aux: { richCompost: 4 }, hours: 20, minutes: 90, xp: 2.5, yld: 2.1, gather: 6, restaurant: 0, value: 380 },
  { tier: 6, id: 'essence6', name: '菌灵露·Ⅵ', anchor: 'foraging_ext_23', anchorLv: 75, material: { foraging_ext_23: 2 }, aux: { richCompost: 5 }, hours: 24, minutes: 120, xp: 2.9, yld: 2.4, gather: 10, restaurant: 0, value: 470 },
  { tier: 7, id: 'essence7', name: '菌灵露·Ⅶ', anchor: 'truffle', anchorLv: 80, material: { truffle: 2 }, aux: { richCompost: 6 }, hours: 36, minutes: 150, xp: 3.4, yld: 2.8, gather: 15, restaurant: 25, value: 580 },
  { tier: 8, id: 'essence8', name: '菌灵露·Ⅷ', anchor: 'spiritFruit', anchorLv: 90, material: { dragonRoot: 2, spiritFruit: 2 }, aux: {}, hours: 48, minutes: 180, xp: 4.0, yld: 3.3, gather: 20, restaurant: 50, value: 720 },
]

/** 供 items.js 合并（use 里只写实际生效的键；采集间隔以「倍率 <1」表示，便于与其它乘区统一） */
export const ESSENCE_ITEMS = ESSENCE_TIERS.map((e) => {
  const use = {
    buffXp: { mult: e.xp, minutes: e.minutes },
    buffYield: { mult: e.yld, minutes: e.minutes },
  }
  if (e.gather > 0) use.buffGather = { mult: Math.round((1 - e.gather / 100) * 100) / 100, minutes: e.minutes }
  if (e.restaurant > 0) use.buffRestaurant = { mult: Math.round((1 + e.restaurant / 100) * 100) / 100, minutes: e.minutes }
  return {
    id: e.id,
    name: e.name,
    type: 'consumable',
    category: 'buff',
    tier: e.tier,
    value: e.value,
    stackable: true,
    maxStack: 9999,
    use,
    image: `images/items/tool/${e.name}.png`,
  }
})

const ESSENCE_INDEX = new Map(ESSENCE_TIERS.map((e) => [e.id, e]))
/** 主料 id → 档位（材料 → 能酿哪一档） */
const ESSENCE_BY_MATERIAL = new Map()
for (const e of ESSENCE_TIERS) for (const mid of Object.keys(e.material)) ESSENCE_BY_MATERIAL.set(mid, e)

export function getEssence(id) {
  return ESSENCE_INDEX.get(id) ?? null
}

/** 该材料能酿出的档位（未登记返回 null） */
export function essenceForMaterial(itemId) {
  return ESSENCE_BY_MATERIAL.get(itemId) ?? null
}

/**
 * 投入文案（主料 + 辅料）。
 * ⚠️ 本模块**不能 import items.js**：`items.js` 会在模块顶层读 `ESSENCE_ITEMS` 合并物品表，
 * 一旦形成 `items → essences → items` 的循环，谁先被导入谁就会拿到 TDZ 里的 ESSENCE_ITEMS 而崩
 * （2026-09-14 实测：achievements → essences → items 这条链就触发了）。
 * 因此物品名交给调用方传进来（视图里有 getItem）。
 */
export function essenceCostText(e, nameOf = (id) => id) {
  const parts = Object.entries(e.material).map(([id, q]) => `${nameOf(id)}×${q}`)
  const aux = Object.entries(e.aux ?? {}).map(([id, q]) => `${nameOf(id)}×${q}`)
  return [...parts, ...aux].join(' + ') || '无'
}

/** 效果文案（经验/产量/采集间隔/餐厅） */
export function essenceEffectText(e) {
  const parts = [`经验 ×${e.xp}`, `产量 ×${e.yld}`]
  if (e.gather > 0) parts.push(`采集间隔 −${e.gather}%`)
  if (e.restaurant > 0) parts.push(`餐厅收入 +${e.restaurant}%`)
  return parts.join(' · ')
}

/** 萃露炉：格位与扩建 */
export const ESSENCE_BASE_VATS = 1
export const ESSENCE_MAX_VATS = 2
export const ESSENCE_EXPAND_COSTS = [60000]

export function nextEssenceExpandCost(vats) {
  return ESSENCE_EXPAND_COSTS[vats - ESSENCE_BASE_VATS] ?? null
}
