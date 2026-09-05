// 垂钓（Fishing）— 需求文档 §3.1.2
// 对应 Melvor 钓鱼；鱼种与解锁等级对齐文档，经验/间隔为按同难度档位设计的数值。
// 核心机制：成功率受等级和钓竿影响（钓竿=装备，后续接入），失败也获得 20% 经验；
// 稀有鱼（金龙鱼）极低概率掉落（0.5%）。

import { GatheringSkill } from './GatheringSkill.js'
import { GATHERING_EXT } from '../data/expansion1.js'
import { GATHERING_EXT2 } from '../data/expansion2.js'
import { EventBus } from '../core/EventBus.js'
import { masteryXpMultiplier } from '../core/mastery.js'

export const FISHING_TARGETS = [
  { itemId: 'crucian', reqLevel: 1, xpPerAction: 10, intervalSec: 3.2 },
  { itemId: 'carp', reqLevel: 5, xpPerAction: 16, intervalSec: 3.6 },
  { itemId: 'perch', reqLevel: 10, xpPerAction: 26, intervalSec: 4.0 },
  { itemId: 'salmon', reqLevel: 15, xpPerAction: 38, intervalSec: 4.4 },
  { itemId: 'tuna', reqLevel: 25, xpPerAction: 58, intervalSec: 4.8 },
  { itemId: 'eel', reqLevel: 35, xpPerAction: 82, intervalSec: 5.2 },
  { itemId: 'lobster', reqLevel: 45, xpPerAction: 112, intervalSec: 5.6 },
  { itemId: 'crab', reqLevel: 55, xpPerAction: 150, intervalSec: 6.0 },
  { itemId: 'abalone', reqLevel: 65, xpPerAction: 195, intervalSec: 6.4 },
  { itemId: 'seaCucumber', reqLevel: 75, xpPerAction: 250, intervalSec: 6.8 },
  { itemId: 'bluefin', reqLevel: 85, xpPerAction: 320, intervalSec: 7.2 },
  { itemId: 'grouper', reqLevel: 95, xpPerAction: 450, intervalSec: 8.0 },
]

export const RARE_FISH_ID = 'goldenDragonFish'
const RARE_CHANCE = 0.005 // 0.5%
const BASE_SUCCESS = 0.55 // 目标等级时的成功率
const SUCCESS_PER_LEVEL = 0.015 // 每高 1 级 +1.5%
const MAX_SUCCESS = 0.95
const FAIL_XP_RATIO = 0.2 // 失败获得 20% 经验

export class FishingSkill extends GatheringSkill {
  constructor(player) {
    super('fishing', player, [...FISHING_TARGETS, ...GATHERING_EXT.fishing, ...GATHERING_EXT2.fishing])
  }

  /** 成功率：55% 基础 + 等级差加成 + 鱼灵加成，封顶 99% */
  successChance(target = this.currentTarget) {
    if (!target) return 0
    const base = Math.min(BASE_SUCCESS + (this.level - target.reqLevel) * SUCCESS_PER_LEVEL, MAX_SUCCESS)
    const accPct = this.player.spiritEffects?.()?.fishingAccPct ?? 0
    return Math.min(base + accPct / 100, 0.99)
  }

  performAction(target) {
    this.actionsDone++
    if (Math.random() < this.successChance(target)) {
      // 稀有鱼：替换本次产出
      if (Math.random() < RARE_CHANCE) {
        this.player.gainItem(RARE_FISH_ID, 1)
        this.player.addMastery(this.id, target.itemId, 1)
        const expGained = this.addCardXp(target.xpPerAction * 2, masteryXpMultiplier(this.masteryLevel(target)))
        EventBus.emit('skill:action', {
          skillId: this.id,
          itemId: RARE_FISH_ID,
          qty: 1,
          expGained,
          outcome: 'rare',
          timestamp: Date.now(),
        })
        return
      }
      const doubled = Math.random() < this.doubleChance(target)
      const qty = this.yieldQuantity(doubled ? 2 : 1)
      this.player.gainItem(target.itemId, qty)
      this.player.addMastery(this.id, target.itemId, 1)
      const expGained = this.addCardXp(target.xpPerAction, masteryXpMultiplier(this.masteryLevel(target)))
      EventBus.emit('skill:action', {
        skillId: this.id,
        itemId: target.itemId,
        qty,
        doubled,
        expGained,
        outcome: 'catch',
        timestamp: Date.now(),
      })
    } else {
      // 失败：无产出，20% 经验
      this.player.addMastery(this.id, target.itemId, 1)
      const expGained = this.addCardXp(target.xpPerAction * FAIL_XP_RATIO, masteryXpMultiplier(this.masteryLevel(target)))
      EventBus.emit('skill:action', {
        skillId: this.id,
        itemId: target.itemId,
        qty: 0,
        expGained,
        outcome: 'miss',
        timestamp: Date.now(),
      })
    }
  }

  /** 离线结算：按期望成功率折算产出与经验 */
  computeOffline(durationMs, efficiency) {
    const target = this.currentTarget
    if (!target || this.level < target.reqLevel) return null
    const interval = this.intervalMs(target)
    if (interval <= 0) return null

    const actions = Math.floor((durationMs / interval) * efficiency)
    if (actions <= 0) return null

    const rate = this.successChance(target)
    const ok = Math.round(actions * rate)
    const rare = Math.round(ok * RARE_CHANCE)
    const normal = ok - rare
    const exp = Math.floor(normal * target.xpPerAction + (actions - ok) * target.xpPerAction * FAIL_XP_RATIO)

    const items = {}
    if (normal > 0) items[target.itemId] = normal
    if (rare > 0) items[RARE_FISH_ID] = rare
    return { actions, exp, items }
  }
}
