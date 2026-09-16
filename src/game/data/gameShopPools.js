// 游戏商店礼包池（2026-09-09）：商店发货与图鉴来源索引共用，避免两处定义漂移
import { ITEMS, getItem } from './items.js'

// 稀有食材池（盲盒）
export const RARE_POOL = ['spiritFruit', 'dragonRoot', 'truffle', 'lingzhi'].filter((id) => !!getItem(id))
// 全部可种作物种子（神秘种子袋）
export const SEED_POOL = Object.values(ITEMS).filter((i) => i.type === 'seed').map((i) => i.id)
// 成品料理（珍馐料理礼包）
export const FOOD_POOL = Object.values(ITEMS).filter((i) => i.type === 'food').map((i) => i.id)
// 调料（精酿调料礼包）
export const SPICE_POOL = Object.values(ITEMS).filter((i) => i.type === 'spice').map((i) => i.id)
// 矿石/宝石（锻造矿材礼包）
export const MINERAL_POOL = Object.values(ITEMS)
  .filter((i) => i.category === 'mineral' || /矿|Ore|fossil/.test((i.name ?? '') + i.id))
  .map((i) => i.id)
// 普通食材（鲜味食材礼包，不含稀有与矿物）
export const INGREDIENT_POOL = Object.values(ITEMS)
  // v2.7.4：排除 material（含 20 档木材）——与交易所货池/商队货/自动出售同一口径，
  // 避免「鲜味食材礼包」变成跳过伐木拿高阶木头的捷径（描述也只写蔬菜/鲜肉/水产）
  .filter((i) => i.type === 'ingredient' && !RARE_POOL.includes(i.id) && i.category !== 'mineral' && i.category !== 'material')
  .map((i) => i.id)
