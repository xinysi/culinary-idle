// 食灵召唤（Spirit Summoning）— 需求文档 §3.3.6
// 制作「食灵契约」（消耗高级食材+调料）召唤食灵；同时可携带 2 个出战。
// 契约即物品：craft 出食灵物品 = 召唤成功；出战切换由 player.setSpiritActive 管理。
// 食灵被动效果在 player.spiritEffects 聚合，作用于采集/烹饪经验、对决、垂钓、农耕。

import { ProductionSkill } from './ProductionSkill.js'
import { SPIRITS } from '../data/spirits.js'
import { balanceRecipeLevels } from './recipeBalance.js'

export const SPIRIT_RECIPES = SPIRITS.map((sp) => ({
  id: `contract_${sp.id}`,
  name: `${sp.name}契约`,
  category: '食灵',
  reqLevel: sp.reqLevel,
  xp: sp.reqLevel * 14,
  successChance: 0.9,
  ingredients: sp.contract,
  output: { itemId: sp.id, qty: 1 },
}))

export class SpiritSummoningSkill extends ProductionSkill {
  constructor(player) {
    super('spiritSummoning', player, balanceRecipeLevels(SPIRIT_RECIPES))
  }

  get type() {
    return 'spirit'
  }
}
