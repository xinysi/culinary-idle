// 副业·陶艺 / 编织 / 刺绣 / 蜡烛制作（v2.10.0）——四个构造函数，配方来自 `data/sidelineWorks.js`。
// 与木工同型：`ProductionSkill` 子类 ⇒ 制作队列 / 精通档位 / 厨房笔记 / 自动续队全部自动生效。
// 配方平衡用 `raiseRecipeLevels`：基材是同档木材、辅料都满足「等级 ≤ 配方 + 5」，
// 该函数对它们是**恒等变换**（C33 有「技能构造后零漂移」断言）。

import { ProductionSkill } from './ProductionSkill.js'
import { raiseRecipeLevels } from './recipeBalance.js'
import { SIDELINE_RECIPES } from '../data/sidelineWorks.js'

export class PotterySkill extends ProductionSkill {
  constructor(player) {
    super('pottery', player, raiseRecipeLevels(SIDELINE_RECIPES.pottery))
  }
}

export class WeavingSkill extends ProductionSkill {
  constructor(player) {
    super('weaving', player, raiseRecipeLevels(SIDELINE_RECIPES.weaving))
  }
}

export class EmbroiderySkill extends ProductionSkill {
  constructor(player) {
    super('embroidery', player, raiseRecipeLevels(SIDELINE_RECIPES.embroidery))
  }
}

export class CandleMakingSkill extends ProductionSkill {
  constructor(player) {
    super('candles', player, raiseRecipeLevels(SIDELINE_RECIPES.candles))
  }
}
