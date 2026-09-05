// 食材保鲜（Preservation）— 需求文档 §3.4.2
// 保鲜剂：防止食材腐坏（§5.4 高级海鲜/肉类 24h 腐坏，使用后刷新计时）
// 增益剂：临时提升技能经验获取速度 / 产量（§3.4.2）
// 道具效果统一由 player.useItem 处理（items.js 的 use 字段）
// 保鲜/增益剂按食灵 5 阶级规则：3 系列（保鲜剂/经验增益剂/产量增益剂）× 5 阶级（Ⅰ~Ⅴ），
// 覆盖 lv 1~99 连续等级段，契约材料用低阶通用 盐矿/稻米，buff 随 reqLevel 单调递增（preserveTiers.js）。

import { ProductionSkill } from './ProductionSkill.js'
import { PRESERVE_TIER_RECIPES } from '../data/preserveTiers.js'
import { balanceRecipeLevels } from './recipeBalance.js'

// 肥料（堆肥/肥沃堆肥）保留在保鲜技能，不参与 5 阶级。
const FERTILIZER_RECIPES = [
  { id: 'compost', name: '堆肥', category: '肥料', reqLevel: 12, xp: 100, successChance: 0.9, ingredients: { potato: 5 }, output: { itemId: 'compost', qty: 1 } },
  { id: 'richCompost', name: '肥沃堆肥', category: '肥料', reqLevel: 35, xp: 220, successChance: 0.85, ingredients: { compost: 2, chili: 2, apple: 3 }, output: { itemId: 'richCompost', qty: 1 } },
]

export const PRESERVATION_RECIPES = [...FERTILIZER_RECIPES, ...PRESERVE_TIER_RECIPES]

export class PreservationSkill extends ProductionSkill {
  constructor(player) {
    super('preservation', player, balanceRecipeLevels([...PRESERVATION_RECIPES]))
  }
}
