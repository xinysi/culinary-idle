// 狩猎（Hunting）— 需求文档 §3.1.3
// 对应 Melvor 采矿的位置感 + 战斗训练感。
// 核心机制：每次狩猎消耗 1 个「陷阱」（弹药，杂货铺购买；后续可由其他技能制作），
// 弹药不足则不产出；野鸡有 15% 额外掉落野鸡蛋。

import { GatheringSkill } from './GatheringSkill.js'
import { GATHERING_EXT } from '../data/expansion1.js'
import { GATHERING_EXT2 } from '../data/expansion2.js'
import { EventBus } from '../core/EventBus.js'
import { masteryXpMultiplier } from '../core/mastery.js'
import { gatherExtraChance } from '../data/difficulty.js' // 全局难度系数（附产概率）

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
  // ── 后期补档（2026-09-19）：把 61-99 段的平均间距 3.2 → ~2.4（对齐参照作 Melvor 的收官密度 2.6）──
  // intervalSec 取本技能后期实测的恒定值 8.0；xpPerAction = `10 + 5×reqLevel`（与所有后期目标一致）。
  { itemId: 'cougarMeat', reqLevel: 69, xpPerAction: 355, intervalSec: 8.0 },
  { itemId: 'rhinoMeat', reqLevel: 84, xpPerAction: 430, intervalSec: 8.0 },
  { itemId: 'yetiMeat', reqLevel: 97, xpPerAction: 495, intervalSec: 8.0 },
]

const PHESANT_EGG_CHANCE = 0.15

export class HuntingSkill extends GatheringSkill {
  constructor(player) {
    super('hunting', player, [...HUNTING_TARGETS, ...GATHERING_EXT.hunting, ...GATHERING_EXT2.hunting], { ammoItemId: 'trap' })
  }

  /** 副业·制箭：**不消耗陷阱**的概率（0~0.9，封顶防「永不耗箭」）——只读累计产出，绝不读技能等级 */
  get ammoSaveChance() {
    const pct = this.player.sidelineEffectTotal?.('huntSavePct') ?? 0
    return Math.max(0, Math.min(0.9, pct / 100))
  }

  performAction(target) {
    this.actionsDone++
    // 省箭时本次不扣陷阱（制箭每件 +2%、量产阶梯每档 +1.5%）
    if (this.ammoItemId && Math.random() >= this.ammoSaveChance) this.player.spendItem(this.ammoItemId, this.ammoPerAction)

    const doubled = Math.random() < this.doubleChance(target)
    const qty = this.yieldQuantity(doubled ? 2 : 1)
    this.player.gainItem(target.itemId, qty)
    this.player.addMastery(this.id, target.itemId, 1)
    const expGained = this.addCardXp(target.xpPerAction, masteryXpMultiplier(this.masteryLevel(target)))

    // 野鸡额外掉落野鸡蛋
    let extraItem = null
    if (target.itemId === 'pheasantMeat' && Math.random() < gatherExtraChance(PHESANT_EGG_CHANCE)) {
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

  /** 离线结算：动作数受持有陷阱数量约束（**制箭省箭会放宽这个上限**），返回 consumed 供启动时扣减 */
  computeOffline(durationMs, efficiency) {
    const result = super.computeOffline(durationMs, efficiency)
    if (!result) return null
    const traps = this.player.inventory.trap ?? 0
    const save = this.ammoSaveChance
    // 省箭 ⇒ 同样的陷阱能支撑更多次动作（每件 +2% 概率不耗 ⇒ 期望耗箭 = 动作数 ×(1−save)）
    const usable = Math.floor(save > 0 ? traps / (1 - save) : traps)
    const actions = Math.min(result.actions, usable)
    if (actions <= 0) return null
    const exp = actions * (result.exp / result.actions)
    const items = {}
    const expectedQty = Math.round(actions * this.expectedYield()) // 与在线同源（含精通保底产量/产量加成）
    if (expectedQty > 0) items[this.currentTarget.itemId] = expectedQty
    const consumedTraps = Math.max(1, Math.round(actions * (1 - save)))
    return { actions, exp: Math.floor(exp), xpMult: result.xpMult ?? 1, items, consumed: { trap: consumedTraps } }
  }
}
