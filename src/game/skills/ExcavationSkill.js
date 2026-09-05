// 挖掘（Excavation）— 需求文档 §3.1.4
// 对应 Melvor 采矿；挖掘物与解锁等级对齐文档，经验/间隔为按同难度档位设计的数值。
// 核心机制：矿物盐是调料调配的基础资源；有 2% 几率额外挖到「化石食材」（远古食谱原料）。

import { GatheringSkill } from './GatheringSkill.js'
import { EventBus } from '../core/EventBus.js'
import { GATHERING_EXT } from '../data/expansion1.js'
import { GATHERING_EXT2 } from '../data/expansion2.js'
import { SEED_MAP } from '../data/farmSeeds.js'
import { SMITH_ORE_TARGETS } from '../data/smithOres.js'
import { masteryXpMultiplier } from '../core/mastery.js'

export const EXCAVATION_TARGETS = [
  { itemId: 'potato', reqLevel: 1, xpPerAction: 10, intervalSec: 3.0 },
  { itemId: 'sweetPotato', reqLevel: 5, xpPerAction: 16, intervalSec: 3.3 },
  { itemId: 'saltOre', reqLevel: 10, xpPerAction: 25, intervalSec: 3.6 },
  { itemId: 'onion', reqLevel: 20, xpPerAction: 40, intervalSec: 4.0 },
  { itemId: 'garlic', reqLevel: 30, xpPerAction: 60, intervalSec: 4.4 },
  { itemId: 'ginger', reqLevel: 40, xpPerAction: 85, intervalSec: 4.8 },
  { itemId: 'yam', reqLevel: 50, xpPerAction: 115, intervalSec: 5.2 },
  { itemId: 'lingzhi', reqLevel: 60, xpPerAction: 150, intervalSec: 5.6 },
  { itemId: 'ginseng', reqLevel: 75, xpPerAction: 215, intervalSec: 6.2 },
  { itemId: 'dragonRoot', reqLevel: 90, xpPerAction: 320, intervalSec: 7.0 },
]

export const FOSSIL_ITEM_ID = 'fossilIngredient'
const FOSSIL_CHANCE = 0.02 // 2%
const COPPER_CHANCE = 0.5 // 50% 附带铜矿（厨具锻造 §3.2.6）
const IRON_CHANCE = 0.3 // 30% 附带铁矿
const SEED_CHANCE = 0.1 // 10% 附带产出本作物种子（农耕种子掉落 §3.1.5）

export class ExcavationSkill extends GatheringSkill {
  constructor(player) {
    super('excavation', player, [...EXCAVATION_TARGETS, ...GATHERING_EXT.excavation, ...GATHERING_EXT2.excavation, ...SMITH_ORE_TARGETS])
  }

  performAction(target) {
    this.actionsDone++
    const doubled = Math.random() < this.doubleChance(target)
    const qty = this.yieldQuantity(doubled ? 2 : 1)
    this.player.gainItem(target.itemId, qty)
    this.player.addMastery(this.id, target.itemId, 1)
    const expGained = this.addCardXp(target.xpPerAction, masteryXpMultiplier(this.masteryLevel(target)))

    let extraItem = null
    const extras = []
    if (Math.random() < FOSSIL_CHANCE) {
      this.player.gainItem(FOSSIL_ITEM_ID, 1)
      extraItem = FOSSIL_ITEM_ID
      extras.push(FOSSIL_ITEM_ID)
    }
    if (Math.random() < COPPER_CHANCE) {
      this.player.gainItem('copperOre', 1)
      extras.push('copperOre')
    }
    if (Math.random() < IRON_CHANCE) {
      this.player.gainItem('ironOre', 1)
      extras.push('ironOre')
    }
    // 10% 掉落本作物种子（仅对可种作物；矿物目标无种子自动跳过）
    const seedId = SEED_MAP[target.itemId]
    if (seedId && Math.random() < SEED_CHANCE) {
      this.player.gainItem(seedId, 1)
      extras.push(seedId)
    }
    if (extras.length > 1) extraItem = extras.join(',')

    EventBus.emit('skill:action', {
      skillId: this.id,
      itemId: target.itemId,
      qty,
      doubled,
      expGained,
      outcome: 'dig',
      extraItem,
      timestamp: Date.now(),
    })
  }

  /** 离线结算：产出含期望化石/矿石数量 */
  computeOffline(durationMs, efficiency) {
    const result = super.computeOffline(durationMs, efficiency)
    if (!result) return null
    const fossils = Math.round(result.actions * FOSSIL_CHANCE)
    if (fossils > 0) result.items[FOSSIL_ITEM_ID] = fossils
    const coppers = Math.round(result.actions * COPPER_CHANCE)
    if (coppers > 0) result.items.copperOre = coppers
    const irons = Math.round(result.actions * IRON_CHANCE)
    if (irons > 0) result.items.ironOre = irons
    const seedId = SEED_MAP[this.currentTarget?.itemId]
    if (seedId) {
      const seeds = Math.round(result.actions * SEED_CHANCE)
      if (seeds > 0) result.items[seedId] = seeds
    }
    return result
  }
}
