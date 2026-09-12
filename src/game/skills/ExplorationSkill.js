// 美食探索（Culinary Exploration）— 需求文档 §3.4.3
// 对应 Melvor 偷窃：选择目标探索/偷师，有成功率；
// 成功获得稀有食材/道具/金币，失败被「抓住」损失金币（金币不足则损失 生命值）。

import { Skill } from './Skill.js'
import { EventBus } from '../core/EventBus.js'
import { masteryLevelFromCount, masteryXpMultiplier } from '../core/mastery.js'
import { itemName } from '../data/items.js'
import { EXPLORATION_TARGETS_ALL } from '../data/explorationTargets.js'

const SUCCESS_PER_LEVEL = 0.015
const MAX_SUCCESS = 0.95
const MIN_SUCCESS = 0.25
const FAIL_HP_PCT = 0.1

export class ExplorationSkill extends Skill {
  constructor(player) {
    super('exploration', player)
    this.targets = [...EXPLORATION_TARGETS_ALL].sort((a, b) => a.reqLevel - b.reqLevel)
    this.timerMs = 0
    this.cycleStartAt = performance.now() // 本产出周期起点（绝对时间戳，进度条 rAF 用）
    this.actionsDone = 0
  }

  get type() {
    return 'exploration'
  }

  get currentTarget() {
    const targetId = this.player.getSkillTarget?.(this.id) ?? this.player.activeTarget
    return this.targets.find((t) => t.id === targetId) ?? null
  }

  /** 成功率：基础 + 等级差（§3.4.3） */
  successChance(target = this.currentTarget) {
    if (!target) return 0
    return Math.min(Math.max(target.baseSuccess + (this.level - target.reqLevel) * SUCCESS_PER_LEVEL, MIN_SUCCESS), MAX_SUCCESS)
  }

  intervalMs(target = this.currentTarget) {
    return target ? target.intervalSec * 1000 : 0
  }

  /** 手动暂停（§3.1 停止/继续） */
  get paused() {
    return this.player.isSkillPaused?.(this.id) ?? false
  }

  /** 距下一次探索的进度 0~1（进度条用） */
  get progressPct() {
    const t = this.currentTarget
    if (!t || this.level < t.reqLevel) return 0
    const iv = this.intervalMs(t)
    return iv > 0 ? Math.min(1, this.timerMs / iv) : 0
  }

  tick(deltaMs) {
    const target = this.currentTarget
    if (!target) return
    if (this.level < target.reqLevel) return
    if (this.paused) return // 手动停止
    this.timerMs += deltaMs
    const interval = this.intervalMs(target)
    let guard = 0
    while (this.timerMs >= interval && guard++ < 100) {
      this.timerMs -= interval
      this.performAction(target)
    }
    if (guard >= 100) this.timerMs = 0
    this.cycleStartAt = performance.now() - this.timerMs
  }

  performAction(target) {
    this.actionsDone++
    if (Math.random() < this.successChance(target)) {
      // 成功：结算掉落
      const gained = []
      for (const entry of target.loot) {
        if (Math.random() >= entry.chance) continue
        const qty = entry.min === undefined ? 1 : entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1))
        if (entry.type === 'gold') {
          this.player.gainGold(qty)
          gained.push(`金币×${qty}`)
        } else {
          this.player.gainItem(entry.itemId, qty)
          gained.push(`${itemName(entry.itemId)}×${qty}`) // 掉落物品用中文名（此前误用英文 id）
        }
      }
      this.player.addMastery(this.id, target.id, 1)
      // 卡片经验（2026-09-09 修复）：此前误用 addXp，少了 ×60 卡片系数与精通倍率 → 满级时长
      // 比同类采集慢约 12 倍（基准 64 天 vs 5 天）。改用 addCardXp，与采集/制作同口径。
      this.addCardXp(target.xp, masteryXpMultiplier(masteryLevelFromCount(this.mastery[target.id] ?? 0)))
      this.player.onExplorationSuccess()
      // 掉落清单用中文描述的字符串（extraGain）；itemId 仍是目标 id，仅用于计数，不再当物品名拼接日志
      EventBus.emit('skill:action', { skillId: this.id, itemId: target.id, qty: 1, outcome: 'explore', timestamp: Date.now(), extraGain: gained.length ? gained.join('、') : null })
    } else {
      // 失败：被抓住 → 损失金币（不足则损失 生命值）
      let penalty = ''
      if (this.player.spendGold(target.failGold)) {
        penalty = `损失 ${target.failGold} 金币`
      } else {
        const dmg = Math.max(1, Math.floor(this.player.maxHp * FAIL_HP_PCT))
        this.player.setCombat({ hp: Math.max(0, this.player.combat.hp - dmg) })
        penalty = `损失 ${dmg} 品鉴值`
      }
      EventBus.emit('skill:action', { skillId: this.id, itemId: target.id, qty: 0, outcome: 'explorefail', penalty, timestamp: Date.now() })
    }
  }

  /** 离线：按期望成功率折算（§10.2.2）——掉落同样按期望给（此前只报经验与金币，物品一件不给），
   *  经验带上卡片精通倍数（在线 performAction 里就是这么算的），并返回 xpMult 供结算时传入 */
  computeOffline(durationMs, efficiency) {
    const target = this.currentTarget
    if (!target || this.level < target.reqLevel) return null
    const interval = this.intervalMs(target)
    const actions = Math.floor((durationMs / interval) * efficiency)
    if (actions <= 0) return null
    const rate = this.successChance(target)
    const ok = Math.round(actions * rate)
    const exp = ok * target.xp
    const xpMult = masteryXpMultiplier(masteryLevelFromCount(this.mastery[target.id] ?? 0))
    let gold = 0
    const items = {}
    for (const entry of target.loot ?? []) {
      const avgQty = entry.min === undefined ? 1 : (entry.min + (entry.max ?? entry.min)) / 2
      const expected = ok * (entry.chance ?? 0) * avgQty
      if (entry.type === 'gold') { gold += expected; continue }
      const qty = Math.round(expected)
      if (qty > 0) items[entry.itemId] = (items[entry.itemId] ?? 0) + qty
    }
    return { actions, exp, xpMult, items, gold: Math.round(gold) }
  }
}
