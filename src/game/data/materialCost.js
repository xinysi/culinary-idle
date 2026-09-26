import { tunerOver } from './tuner.js'
// 制作材料成本的全局系数（2026-09-21）——**唯一出口**
//
// 起因（用户要求）：「砍一点，然后增加所需材料数量」——提高配方所需材料数量，让「挂机收原料」
// 重新成为制作侧的瓶颈（放置刷刷刷）。
//
// ⚠️ 为什么不直接改数据：AGENTS 铁律 §4 把「物品的配方（reqLevel/材料）」列为**已固定**项，
//   且 2026-09 曾因重生成探索掉落连锁改动物品等级/配方等级，导致材料-产物失衡、效果倒挂。
//   所以这里沿用「原始数据 + 单一缩放出口」的做法（与 `difficulty.js` 同一套纪律）：
//   数据层（`COOKING_RECIPES`/`SIDELINE_RECIPES`/… 里的 `ingredients`）**一个字节都不动**，
//   只在读取时按系数放大 ⇒ 想调回 ×1 或调大只改这一个常量。
//
// 🔴 唯一出口纪律：任何「检查材料够不够、扣材料、显示材料需求、按材料算价值」的地方
//   **都必须调本模块**，不许再直接读 `recipe.ingredients` 的数量（守卫 C53 有静态断言）。
//   已接线：ProductionSkill(canCraft/craft/风味搭配) · ProductionView(maxCraft/配方卡片)
//           · LogView(图鉴配方卡片) · RecipeTreeModal(配方树) · flavorRecipes(用量)
//           · itemSources(来源串) · itemUses(可用于制作的用量) · valueBalance(副业产物价值)
//   ⚠️ 炼金（`ALCHEMY_RECIPES` 的 `in`）**刻意不纳入**：炼金产物价值由 `applyAlchemyRatioCap`
//      按「投入价值」反推，放大投入会静默给一批产物重新定价（连带动按 value 筛的觅珍/交易所货池）。
//      要改炼金得单独评估，别在这里顺手加。
//   ⚠️ 采集/农耕的「种子·肥料·陷阱·箭矢」用量是**采集侧**数据（`ammoPerAction`/`spendItem`），
//      不属于「配方材料」，同样不在本系数内。

/** 材料成本系数（1 = 原始数据；2 = 所需材料翻倍） */
export const MATERIAL_COST_MULT = 2

/**
 * 单件材料数量：按系数放大，至少 1、四舍五入（原始数量都是正整数，×2 后仍是整数）。
 * 非法/非正输入返回 0（调用方据此跳过该材料，与 `spendItem` 的「0 不扣」口径一致）。
 */
export function materialQty(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.max(1, Math.round(n * tunerOver('materialCost', MATERIAL_COST_MULT, 1, 8)))
}

/** 生效材料表 `{ itemId: qty }`（纯函数：**不改动传进来的配方对象**，返回值每次都是新对象） */
export function effIngredients(recipe) {
  const out = {}
  for (const [id, q] of Object.entries(recipe?.ingredients ?? {})) {
    const v = materialQty(q)
    if (v > 0) out[id] = v
  }
  return out
}

/** 该配方一件成品的材料件数合计（守卫与统计口径） */
export function materialTotal(recipe) {
  let n = 0
  for (const q of Object.values(effIngredients(recipe))) n += q
  return n
}

/** 「材料串」（如「松木×4+铁矿×4」）——来源串/图鉴/配方说明共用同一口径与格式 */
export function materialText(recipe, nameOf = (id) => id) {
  return Object.entries(effIngredients(recipe))
    .map(([id, q]) => `${nameOf(id)}×${q}`)
    .join('+')
}
