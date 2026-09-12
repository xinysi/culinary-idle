// 狩猎（Hunting）— 需求文档 §3.1.3
// 对应 Melvor 采矿的位置感 + 战斗训练感。
// 核心机制：每次狩猎消耗 1 个「陷阱」（弹药，杂货铺购买；后续可由其他技能制作），
// 弹药不足则不产出；野鸡有 15% 额外掉落野鸡蛋。

import { GatheringSkill } from './GatheringSkill.js'
import { GATHERING_EXT } from '../data/expansion1.js'
import { GATHERING_EXT2 } from '../data/expansion2.js'
import { EventBus } from '../core/EventBus.js'
import { masteryXpMultiplier } from '../core/mastery.js'

export const HUNTING_TARGETS = [
  { itemId: 'rabbitMeat', reqLevel: 1, xpPerAction: 10, intervalSec: 3.0 },
  { itemId: 'pheasantMeat', reqLevel: 8, xpPerAction: 18, intervalSec: 3.5 },
  { itemId: 'boarMeat', reqLevel: 15, xpPerAction: 30, intervalSec: 4.0 },
  { itemId: 'venison', reqLevel: 25, xpPerAction: 50, intervalSec: 4.5 },
  { itemId: 'goatMeat', reqLevel: 35, xpPerAction: 75, intervalSec: 5.0 },
  { itemId: 'bisonMeat', reqLevel: 45, xpPerAction: 105, intervalSec: 5.5 },
  { itemId: 'crocodileMeat', reqLevel: 55, xpPerAction: 140, intervalSec: 6.0 },
  { itemId: 'bearMeat', reqLevel: 65, xpPerAction: 185, intervalSec: 6.5 },
  { itemId: 'mammothMeat', reqLevel: 80, xpPerAction: 260, intervalSec: 7.0 },
  { itemId: 'dragonMeat', reqLevel: 95, xpPerAction: 400, intervalSec: 8.0 },
]

const PHESANT_EGG_CHANCE = 0.15

export class HuntingSkill extends GatheringSkill {
  constructor(player) {
    super('hunting', player, [...HUNTING_TARGETS, ...GATHERING_EXT.hunting, ...GATHERING_EXT2.hunting], { ammoItemId: 'trap' })
  }

  performAction(target) {
    this.actionsDone++
    if (this.ammoItemId) this.player.spendItem(this.ammoItemId, this.ammoPerAction)

    const doubled = Math.random() < this.doubleChance(target)
    const qty = this.yieldQuantity(doubled ? 2 : 1)
    this.player.gainItem(target.itemId, qty)
    this.player.addMastery(this.id, target.itemId, 1)
    const expGained = this.addCardXp(target.xpPerAction, masteryXpMultiplier(this.masteryLevel(target)))

    // 野鸡额外掉落野鸡蛋
    let extraItem = null
    if (target.itemId === 'pheasantMeat' && Math.random() < PHESANT_EGG_CHANCE) {
      this.player.gainItem('pheasantEgg', 1)
      extraItem = 'pheasantEgg'
    }

    EventBus.emit('skill:action', {
      skillId: this.id,
      itemId: target.itemId,
      qty,
      doubled,
      expGained,
      outcome: 'hunt',
      extraItem,
      timestamp: Date.now(),
    })
  }

  /** 离线结算：动作数受持有陷阱数量约束，返回 consumed 供启动时扣减 */
  computeOffline(durationMs, efficiency) {
    const result = super.computeOffline(durationMs, efficiency)
    if (!result) return null
    const traps = this.player.inventory.trap ?? 0
    const actions = Math.min(result.actions, traps)
    if (actions <= 0) return null
    const exp = actions * (result.exp / result.actions)
    const items = {}
    const expectedQty = Math.round(actions * this.expectedYield()) // 与在线同源（含精通保底产量/产量加成）
    if (expectedQty > 0) items[this.currentTarget.itemId] = expectedQty
    return { actions, exp: Math.floor(exp), xpMult: result.xpMult ?? 1, items, consumed: { trap: actions } }
  }
}
