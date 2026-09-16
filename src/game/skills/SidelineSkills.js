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

// ── v2.12.0 第一批：五支「干净轴」副业（同样只是构造函数，配方来自 sidelineWorks.js）──
export class FletchingSkill extends ProductionSkill {
  constructor(player) {
    super('fletching', player, raiseRecipeLevels(SIDELINE_RECIPES.fletching))
  }
}

export class NetmakingSkill extends ProductionSkill {
  constructor(player) {
    super('netmaking', player, raiseRecipeLevels(SIDELINE_RECIPES.netmaking))
  }
}

export class IncenseSkill extends ProductionSkill {
  constructor(player) {
    super('incense', player, raiseRecipeLevels(SIDELINE_RECIPES.incense))
  }
}

export class FestivalGoodsSkill extends ProductionSkill {
  constructor(player) {
    super('festivalGoods', player, raiseRecipeLevels(SIDELINE_RECIPES.festivalGoods))
  }
}

export class JadecraftSkill extends ProductionSkill {
  constructor(player) {
    super('jadecraft', player, raiseRecipeLevels(SIDELINE_RECIPES.jadecraft))
  }
}

// ── v2.13.0 第二批 ──
export class GoodsTagSkill extends ProductionSkill {
  constructor(player) {
    super('goodsTag', player, raiseRecipeLevels(SIDELINE_RECIPES.goodsTag))
  }
}

export class MiningGearSkill extends ProductionSkill {
  constructor(player) {
    super('miningGear', player, raiseRecipeLevels(SIDELINE_RECIPES.miningGear))
  }
}
