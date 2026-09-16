// 木材档位（v2.7.0，2026-09-16 新增）——「伐木」技能的产物，**每 5 级一档、共 20 档**，
// 与厨具锻造的 20 个装备品质套**严格一一对应**（铜 1-5 / 铁 6-10 / … / 萤 96-100），
// 于是「75 级装备要用 75 级的木材」成立（Lv71-75 的琉璃套 ↔ 琉璃木）。
//
// 为什么是 20 档：装备是严格每 5 级一套（`smithSetExt.js` 的 20 套覆盖 Lv1-100），
// 而矿物从 Lv16 起就是「一矿对一套」的同名分档（钢矿@16 … 鎏金矿@76）——木材按同一粒度分档，
// 才与既有材料体系同构（`timberOfLevel()` 是配方改档与强化按档消耗的唯一查询入口）。
//
// 与既有 `木材`（id `wood`，value 4）的关系：**`木材` 保持原样、用途一律不动**
// （采摘 50% 附产、炼金、奇遇、公会任务、对决掉落都还在用它），它是「通用低级木料」；
// 本模块的 20 档木材是**伐木技能的产物**，供锻造与强化按档取用。两者不互相替代。
//
// schema 约束（`item_triple_audit.mjs` 的 STRUCT_KEYS 白名单）：只能用
// id/name/type/category/tier/value/stackable/maxStack —— 不要加自定义字段。
// 类别沿用 `material`：自动豁免「自动出售」（`automation.js` 的 SELL_EXCLUDED_CATEGORIES）
// 与交易所货池，且不需要在 `itemDetail.js` 的 CATEGORY_LABEL 里新增标签。

/** 每档 5 级，档位序号 0..19 → 等级区间 [5i+1, 5i+5] */
export const TIMBER_BAND = 5

/**
 * 20 档木材。字段：
 * - `id` / `name`：物品 id 与中文名（图片按中文名寻址：public/images/items/food/{name}.png）
 * - `level`：该档的**起始等级**（= 对应装备套的区间起点，也是采集目标的 reqLevel）
 * - `value`：≈ `valueBalance` 的价值曲线 `2 + 2.5×level`，会被该曲线的 ±30% 带校正（同级材料齐平）
 */
export const TIMBERS = [
  { id: 'pineWood', name: '松木', level: 1, value: 6 },
  { id: 'cedarWood', name: '杉木', level: 6, value: 18 },
  { id: 'birchWood', name: '桦木', level: 11, value: 30 },
  { id: 'elmWood', name: '榆木', level: 16, value: 42 },
  { id: 'oakWood', name: '橡木', level: 21, value: 55 },
  { id: 'camphorWood', name: '樟木', level: 26, value: 67 },
  { id: 'nanmuWood', name: '楠木', level: 31, value: 80 },
  { id: 'rosePearWood', name: '花梨木', level: 36, value: 92 },
  { id: 'redSandalWood', name: '紫檀木', level: 41, value: 105 },
  { id: 'ebonyWood', name: '乌木', level: 46, value: 117 },
  { id: 'ironwoodTimber', name: '铁力木', level: 51, value: 130 },
  { id: 'bogWood', name: '阴沉木', level: 56, value: 142 },
  { id: 'fragrantRosewood', name: '降香木', level: 61, value: 155 },
  { id: 'borneolWood', name: '龙脑木', level: 66, value: 167 },
  { id: 'glazeWood', name: '琉璃木', level: 71, value: 180 },
  { id: 'giltWood', name: '鎏金木', level: 76, value: 192 },
  { id: 'starWood', name: '星辰木', level: 81, value: 205 },
  { id: 'moonWood', name: '月华木', level: 86, value: 217 },
  { id: 'voidWood', name: '太虚木', level: 91, value: 230 },
  { id: 'primalWood', name: '太初神木', level: 96, value: 242 },
]

/** 物品定义（`items.js` 合并进 ITEMS） */
export const TIMBER_ITEMS = TIMBERS.map((t) => ({
  id: t.id,
  name: t.name,
  type: 'ingredient',
  category: 'material',
  tier: Math.min(10, Math.ceil(t.level / 10)),
  value: t.value,
  stackable: true,
  maxStack: 9999,
}))

/** 伐木技能的采集目标（20 条，等级 = 各档起始等级） */
export const WOODCUTTING_TARGETS = TIMBERS.map((t) => ({
  itemId: t.id,
  reqLevel: t.level,
  xpPerAction: 10 + (t.level - 1) * 3.2,
  intervalSec: 3.0 + (t.level - 1) * 0.045,
}))

/** 某个等级落在哪一档（0..19）：Lv1-5→0、Lv71-75→14、Lv96-100→19 */
export function timberIndexForLevel(level) {
  const lv = Math.max(1, Math.min(100, Math.floor(level || 1)))
  return Math.min(TIMBERS.length - 1, Math.floor((lv - 1) / TIMBER_BAND))
}

/** 某个等级对应的木材档（返回 { id, name, level }）——配方改档与强化消耗的唯一入口 */
export function timberOfLevel(level) {
  return TIMBERS[timberIndexForLevel(level)]
}

/** 某个装备品质套的等级区间（用于文案与守卫） */
export function timberBandOf(index) {
  const t = TIMBERS[index]
  if (!t) return null
  return { ...t, from: t.level, to: Math.min(100, t.level + TIMBER_BAND - 1) }
}
