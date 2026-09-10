// 套餐与定食（2026-09-10 新增）— 给「餐厅菜单」补上成品侧的搭配玩法。
// 设计约束（纯读取层）：
//   ① 只读 player.restaurant.menu 与既有料理的 category，不改菜单结构、不改任何物品数据；
//   ② 无新增存档状态——「当前生效的套餐」由菜单实时推导（凑齐即生效，多套达标取最高）；
//   ③ 加成只接既有的餐厅小时收入与外卖单价，不新增数值层。
import { getItem } from './items.js'

/** 套餐加成在「外卖单价」上的折算比例（外卖只有一半效果） */
export const SET_MEAL_TAKEOUT_RATIO = 0.5

/**
 * 套餐定义：need 为需要的料理大类（每类至少 1 道不同料理）
 * bonus 为餐厅小时收入加成（百分比）
 */
export const SET_MEALS = [
  { id: 'sm_home', icon: '🍚', name: '家常套餐', need: ['主食', '主菜'], bonus: 8, desc: '一饭一菜，最朴素的组合' },
  { id: 'sm_soup', icon: '🍲', name: '汤菜套餐', need: ['主菜', '汤品'], bonus: 8, desc: '主菜配汤，荤素相济' },
  { id: 'sm_sweet', icon: '🍰', name: '收尾套餐', need: ['主菜', '甜点'], bonus: 10, desc: '咸后一口甜，舌头才肯罢休' },
  { id: 'sm_tea', icon: '🍪', name: '下午茶套餐', need: ['baking', '甜点'], bonus: 10, desc: '焙烤点心配甜食，午后的小生意' },
  { id: 'sm_three', icon: '🥘', name: '三菜套系', need: ['主食', '主菜', '汤品'], bonus: 14, desc: '有饭有菜有汤，正经一顿饭' },
  { id: 'sm_full', icon: '🍱', name: '全席套系', need: ['主食', '主菜', '甜点'], bonus: 16, desc: '从主食一路吃到甜点' },
  { id: 'sm_grand', icon: '👑', name: '豪华全席', need: ['主食', '主菜', '汤品', '甜点'], bonus: 22, desc: '四类齐备，一桌宴席的排面' },
]

const MEAL_INDEX = new Map(SET_MEALS.map((m) => [m.id, m]))

/** 菜单里各料理大类的「在菜单中出现的次数」（按出现的不同料理数计） */
export function menuCategoryCount(menu = []) {
  const out = {}
  for (const id of menu) {
    if (!id) continue
    const it = getItem(id)
    if (!it || it.type !== 'food') continue
    out[it.category] = (out[it.category] ?? 0) + 1
  }
  return out
}

/** 某套餐是否能被该菜单凑齐 */
export function mealSatisfied(meal, cats) {
  return (meal?.need ?? []).every((c) => (cats[c] ?? 0) > 0)
}

/** 某套餐还缺哪些大类（已凑齐 → 空数组） */
export function mealMissing(meal, cats) {
  return (meal?.need ?? []).filter((c) => (cats[c] ?? 0) === 0)
}

/**
 * 当前菜单生效的套餐：凑齐的全取，加成最高的一套生效
 * → { meal, bonus, satisfied: [meal...] }
 */
export function activeSetMeal(menu = []) {
  const cats = menuCategoryCount(menu)
  const satisfied = SET_MEALS.filter((m) => mealSatisfied(m, cats))
  satisfied.sort((a, b) => b.bonus - a.bonus)
  const meal = satisfied[0] ?? null
  return { meal, bonus: meal?.bonus ?? 0, satisfied }
}

/** 菜单 → 全部套餐的达标情况（页面用） */
export function setMealBoard(menu = []) {
  const cats = menuCategoryCount(menu)
  const active = activeSetMeal(menu)
  return SET_MEALS.map((m) => ({
    ...m,
    ok: mealSatisfied(m, cats),
    missing: mealMissing(m, cats),
    active: active.meal?.id === m.id,
  }))
}

/** 外形加成倍率（餐厅小时收入） */
export function setMealMult(bonus) {
  return 1 + Math.max(0, bonus ?? 0) / 100
}
