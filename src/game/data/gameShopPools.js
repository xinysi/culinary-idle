// 游戏商店礼包池（2026-09-09）：商店发货与图鉴来源索引共用，避免两处定义漂移
import { ITEMS, getItem } from './items.js'
import { WOODWORK_CATEGORY } from './woodworking.js'

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
/**
 * 珍馐阁（金币应急购买）的售卖口径 —— **单一来源**，视图与图鉴来源登记共用。
 * 除装备/食灵外，还要**排除「产线独占品」**（类别 buff / supply）：
 * 蜂蜜只能来自温室蜂场、菌灵露只能来自萃露炉、精耕作物只能来自农耕、加工品只能来自牧场/网箱 ——
 * 金币商店若能直接买到它们，等于绕过整条产线，图鉴的「获取来源」也会因此说谎。
 * （v2.8.1 实测踩到：登记珍馐阁时才发现商店一直在卖 8 档蜂蜜与 8 档菌灵露。）
 */
export const DELUXE_EXCLUDED_CATEGORIES = ['buff', 'supply', WOODWORK_CATEGORY]
export const deluxeSellable = (it) =>
  !!it && it.type !== 'equipment' && it.type !== 'spirit' && !DELUXE_EXCLUDED_CATEGORIES.includes(it.category)

// 普通食材（鲜味食材礼包，不含稀有与矿物）
export const INGREDIENT_POOL = Object.values(ITEMS)
  // v2.7.4：排除 material（含 20 档木材）——与交易所货池/商队货/自动出售同一口径，
  // 避免「鲜味食材礼包」变成跳过伐木拿高阶木头的捷径（描述也只写蔬菜/鲜肉/水产）
  // v2.9.0：同样排除 furniture（木器）——它是副业木工的独占产物，礼包若能开出来就等于绕过整条技能线
  .filter((i) => i.type === 'ingredient' && !RARE_POOL.includes(i.id) && i.category !== 'mineral' && i.category !== 'material' && i.category !== WOODWORK_CATEGORY)
  .map((i) => i.id)
