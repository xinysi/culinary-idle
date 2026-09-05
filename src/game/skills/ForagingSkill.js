// 采摘（Foraging）— 需求文档 §3.1.1
// 对应 Melvor 伐木；数据来自文档食材表（等级/基础经验/采摘间隔）

import { GatheringSkill } from './GatheringSkill.js'
import { EventBus } from '../core/EventBus.js'
import { GATHERING_EXT } from '../data/expansion1.js'
import { GATHERING_EXT2 } from '../data/expansion2.js'
import { FRESH_TARGETS } from '../data/freshMats.js'
import { SEED_MAP } from '../data/farmSeeds.js'
import { masteryXpMultiplier } from '../core/mastery.js'

export const FORAGING_TARGETS = [
  { itemId: 'apple', reqLevel: 1, xpPerAction: 10, intervalSec: 3.0 },
  { itemId: 'carrot', reqLevel: 5, xpPerAction: 15, intervalSec: 3.2 },
  { itemId: 'tomato', reqLevel: 10, xpPerAction: 25, intervalSec: 3.5 },
  { itemId: 'strawberry', reqLevel: 20, xpPerAction: 40, intervalSec: 4.0 },
  { itemId: 'grape', reqLevel: 30, xpPerAction: 60, intervalSec: 4.5 },
  { itemId: 'pineapple', reqLevel: 40, xpPerAction: 90, intervalSec: 5.0 },
  { itemId: 'mango', reqLevel: 50, xpPerAction: 130, intervalSec: 5.5 },
  { itemId: 'durian', reqLevel: 60, xpPerAction: 180, intervalSec: 6.0 },
  { itemId: 'matsutake', reqLevel: 70, xpPerAction: 250, intervalSec: 6.5 },
  { itemId: 'truffle', reqLevel: 80, xpPerAction: 350, intervalSec: 7.0 },
  { itemId: 'spiritFruit', reqLevel: 90, xpPerAction: 500, intervalSec: 8.0 },
  // ── 批量新增基础原料采摘目标（供饮品/酱料/调料配方对齐）──
  { itemId: 'barley', reqLevel: 8, xpPerAction: 22, intervalSec: 3.4 },
  { itemId: 'mint', reqLevel: 10, xpPerAction: 25, intervalSec: 3.5 },
  { itemId: 'chrysanthemum', reqLevel: 12, xpPerAction: 30, intervalSec: 3.7 },
  { itemId: 'rose', reqLevel: 15, xpPerAction: 36, intervalSec: 3.8 },
  { itemId: 'teaLeaf', reqLevel: 18, xpPerAction: 42, intervalSec: 4.1 },
  { itemId: 'watermelon', reqLevel: 22, xpPerAction: 50, intervalSec: 4.2 },
  { itemId: 'hamimelon', reqLevel: 26, xpPerAction: 62, intervalSec: 4.6 },
  { itemId: 'osmanthus', reqLevel: 34, xpPerAction: 92, intervalSec: 5.2 },
  { itemId: 'milk', reqLevel: 20, xpPerAction: 45, intervalSec: 4.1 },
  { itemId: 'sodaWater', reqLevel: 30, xpPerAction: 66, intervalSec: 4.6 },
  { itemId: 'ume', reqLevel: 24, xpPerAction: 55, intervalSec: 4.4 },
  { itemId: 'winterMelon', reqLevel: 28, xpPerAction: 66, intervalSec: 4.7 },
  { itemId: 'rosella', reqLevel: 30, xpPerAction: 72, intervalSec: 4.8 },
  { itemId: 'jasmine', reqLevel: 32, xpPerAction: 80, intervalSec: 5.0 },
  { itemId: 'bayberry', reqLevel: 38, xpPerAction: 105, intervalSec: 5.4 },
  { itemId: 'banana', reqLevel: 36, xpPerAction: 98, intervalSec: 5.3 },
  { itemId: 'greenBeans', reqLevel: 12, xpPerAction: 28, intervalSec: 3.6 },
  { itemId: 'cucumber', reqLevel: 12, xpPerAction: 28, intervalSec: 3.6 },
  { itemId: 'soybean', reqLevel: 14, xpPerAction: 32, intervalSec: 3.7 },
  { itemId: 'sesame', reqLevel: 16, xpPerAction: 38, intervalSec: 3.9 },
  { itemId: 'mushroom', reqLevel: 20, xpPerAction: 46, intervalSec: 4.1 },
  { itemId: 'mustard', reqLevel: 26, xpPerAction: 60, intervalSec: 4.5 },
  { itemId: 'pepper', reqLevel: 30, xpPerAction: 66, intervalSec: 4.6 },
  { itemId: 'redBean', reqLevel: 22, xpPerAction: 50, intervalSec: 4.2 },
  { itemId: 'lotusSeed', reqLevel: 34, xpPerAction: 92, intervalSec: 5.2 },
  { itemId: 'celery', reqLevel: 18, xpPerAction: 42, intervalSec: 4.1 },
  { itemId: 'cumin', reqLevel: 28, xpPerAction: 65, intervalSec: 4.6 },
  { itemId: 'fennel', reqLevel: 30, xpPerAction: 70, intervalSec: 4.7 },
  { itemId: 'bayLeaf', reqLevel: 32, xpPerAction: 78, intervalSec: 4.9 },
  { itemId: 'clove', reqLevel: 36, xpPerAction: 96, intervalSec: 5.3 },
  { itemId: 'cardamom', reqLevel: 38, xpPerAction: 104, intervalSec: 5.4 },
  { itemId: 'tsaoKo', reqLevel: 40, xpPerAction: 112, intervalSec: 5.5 },
  { itemId: 'amomum', reqLevel: 42, xpPerAction: 120, intervalSec: 5.6 },
  { itemId: 'licorice', reqLevel: 44, xpPerAction: 128, intervalSec: 5.7 },
  { itemId: 'chenpi', reqLevel: 46, xpPerAction: 136, intervalSec: 5.8 },
  { itemId: 'turmeric', reqLevel: 48, xpPerAction: 146, intervalSec: 5.9 },
  { itemId: 'greenPeppercorn', reqLevel: 50, xpPerAction: 156, intervalSec: 6.0 },
  { itemId: 'sansho', reqLevel: 52, xpPerAction: 168, intervalSec: 6.1 },
  { itemId: 'seaweed', reqLevel: 54, xpPerAction: 180, intervalSec: 6.2 },
  { itemId: 'thyme', reqLevel: 56, xpPerAction: 192, intervalSec: 6.3 },
  { itemId: 'oregano', reqLevel: 58, xpPerAction: 204, intervalSec: 6.4 },
  { itemId: 'sage', reqLevel: 60, xpPerAction: 218, intervalSec: 6.5 },
  { itemId: 'parsley', reqLevel: 62, xpPerAction: 232, intervalSec: 6.6 },
  { itemId: 'dill', reqLevel: 64, xpPerAction: 248, intervalSec: 6.7 },
]

export const WOOD_CHANCE = 0.5 // 50% 附带产出木材（厨具锻造原料 §3.2.6）
export const SEED_CHANCE = 0.1 // 10% 附带产出本作物种子（农耕种子掉落 §3.1.5）

export class ForagingSkill extends GatheringSkill {
  constructor(player) {
    super('foraging', player, [...FORAGING_TARGETS, ...GATHERING_EXT.foraging, ...GATHERING_EXT2.foraging, ...FRESH_TARGETS.foraging])
  }

  performAction(target) {
    this.actionsDone++
    const doubled = Math.random() < this.doubleChance(target)
    const qty = this.yieldQuantity(doubled ? 2 : 1)
    this.player.gainItem(target.itemId, qty)
    this.player.addMastery(this.id, target.itemId, 1)
    const expGained = this.addCardXp(target.xpPerAction, masteryXpMultiplier(this.masteryLevel(target)))

    const extras = []
    if (Math.random() < WOOD_CHANCE) {
      this.player.gainItem('wood', 1)
      extras.push('wood')
    }
    // 10% 掉落本作物种子（仅对可种作物）
    const seedId = SEED_MAP[target.itemId]
    if (seedId && Math.random() < SEED_CHANCE) {
      this.player.gainItem(seedId, 1)
      extras.push(seedId)
    }
    const extraItem = extras.length ? extras.join(',') : null

    EventBus.emit('skill:action', {
      skillId: this.id,
      itemId: target.itemId,
      qty,
      doubled,
      expGained,
      outcome: 'gather',
      extraItem,
      timestamp: Date.now(),
    })
  }

  /** 离线结算：产出含期望木材/种子 */
  computeOffline(durationMs, efficiency) {
    const result = super.computeOffline(durationMs, efficiency)
    if (!result) return null
    const woods = Math.round(result.actions * WOOD_CHANCE)
    if (woods > 0) result.items.wood = woods
    const seedId = SEED_MAP[this.currentTarget?.itemId]
    if (seedId) {
      const seeds = Math.round(result.actions * SEED_CHANCE)
      if (seeds > 0) result.items[seedId] = seeds
    }
    return result
  }
}
