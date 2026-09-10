// 采集类技能基类 — 需求文档 §3.1
// 核心机制：选择目标 → 定时产出食材 + 经验
// - 间隔 = 基础间隔 − 等级加成 − 工具加成（装备系统接入前 toolBonus 为 0）
// - 双倍产出：基础 1%，随专精等级提升（§3.1.1）
// - 弹药消耗（狩猎 §3.1.3）：ammoItemId 配置后，每次动作消耗对应道具，弹药不足不累积计时
// - 离线收益：computeOffline（§10.2.2，80% 效率）

import { Skill } from './Skill.js'
import { EventBus } from '../core/EventBus.js'
import { masteryLevelFromCount, masteryDoubleChance, masteryIntervalFactor, masteryFixedInterval, masteryXpMultiplier, masteryLevelProgress, masteryYieldBonus } from '../core/mastery.js'
import { applyGatherXp } from './xpBalance.js'

export const BASE_DOUBLE_CHANCE = 0.01 // 1%
const MASTERY_DOUBLE_PER_LEVEL = 0.0005
const MAX_DOUBLE_CHANCE = 0.25
const LEVEL_SPEED_BONUS_PER_10 = 0.15 // 每 10 级 −0.15s
const MIN_INTERVAL_SECONDS = 0.5

export class GatheringSkill extends Skill {
  /**
   * @param {string} id
   * @param {object} player
   * @param {Array<{itemId:string, reqLevel:number, xpPerAction:number, intervalSec:number}>} targets 按等级排序的目标表
   * @param {object} [opts]
   * @param {string} [opts.ammoItemId] 每次动作消耗的道具 id（弹药）
   */
  constructor(id, player, targets, opts = {}) {
    super(id, player)
    this.targets = [...targets].sort((a, b) => a.reqLevel - b.reqLevel)
    applyGatherXp(this.targets) // 经验随等级递增（消除高等级目标给低经验的倒挂）
    this.toolBonusSec = 0 // 工具加成（厨具装备系统接入后生效）
    this.ammoItemId = opts.ammoItemId ?? null
    this.ammoPerAction = 1
    this.timerMs = 0
    this.cycleStartAt = performance.now() // 本产出周期起点（绝对时间戳，进度条 rAF 用；随 timerMs 反推，单调不回拉）
    this.actionsDone = 0
    this._outOfAmmo = false
  }

  get type() {
    return 'gathering'
  }

  /** 当前选择的采集目标（§3.1 每技能独立目标，多技能并行） */
  get currentTarget() {
    const targetId = this.player.getSkillTarget?.(this.id) ?? this.player.activeTarget
    return this.targets.find((t) => t.itemId === targetId) ?? null
  }

  /** 手动暂停（§3.1 停止/继续） */
  get paused() {
    return this.player.isSkillPaused?.(this.id) ?? false
  }

  /** 距下一次产出的进度 0~1（进度条用） */
  get progressPct() {
    const t = this.currentTarget
    if (!t || this.level < t.reqLevel) return 0
    const iv = this.intervalMs(t)
    return iv > 0 ? Math.min(1, this.timerMs / iv) : 0
  }

  /** 当前卡片精通等级（0~100），由该卡片累计获得次数反推 */
  masteryLevel(target = this.currentTarget) {
    if (!target) return 0
    return masteryLevelFromCount(this.mastery[target.itemId] ?? 0)
  }

  /** 当前卡片精通进度：{ level, current(本级内次数), needed(升下1级需次数), progress(0~1) } */
  masteryProgress(target = this.currentTarget) {
    if (!target) return { level: 0, current: 0, needed: 50, progress: 0 }
    return masteryLevelProgress(this.mastery[target.itemId] ?? 0)
  }

  /** 目标实际间隔（毫秒）：基础 − 等级加成 − 工具加成；
   *  精通≥20 级直接用固定间隔（masteryFixedInterval）；5/10 级用比例因子（减 1/3、减半） */
  intervalMs(target = this.currentTarget) {
    if (!target) return 0
    const levelBonus = Math.floor((this.level - 1) / 10) * LEVEL_SPEED_BONUS_PER_10
    const lv = this.masteryLevel(target)
    const fixedSec = masteryFixedInterval(lv)
    if (fixedSec != null) return Math.max(fixedSec, MIN_INTERVAL_SECONDS) * 1000
    const sec = Math.max(target.intervalSec - levelBonus - this.toolBonusSec, MIN_INTERVAL_SECONDS)
    return sec * masteryIntervalFactor(lv) * 1000
  }

  /** 双倍产出几率：按该卡片精通档位（0/5%/15%/25%/50%），无精通时保留基础 1% */
  doubleChance(target = this.currentTarget) {
    if (!target) return 0
    const mLevel = this.masteryLevel(target)
    return Math.max(BASE_DOUBLE_CHANCE, masteryDoubleChance(mLevel))
  }

  /** 产量加成后的数量：精通保底批量（2026-09-09）+ 奥义「丰收祝福」（§3.4.1）+ 产量增益剂（§3.4.2）+ 公会被动（§13），以额外产出几率折算 */
  yieldQuantity(qty, target = this.currentTarget) {
    const batch = target ? masteryYieldBonus(this.masteryLevel(target)) : 0
    const aoji = this.player.gastronomyEffects?.() ?? {}
    const yPct = aoji.yieldPct ?? 0
    const guildPct = this.player.guildEffects?.()?.yieldPct ?? 0
    const insightPct = this.player.insightEffects?.()?.yieldPct ?? 0 // 菜系图谱（2026-09-09）
    const yMult = this.player.getYieldMultiplier?.() ?? 1
    const festPct = ((this.player.festivalBoost?.()?.gatherYield ?? 1) - 1) // 节庆（2026-09-10）
    const patronPct = (this.player.patronEffects?.()?.yieldPct ?? 0) / 100 // 食神信仰：农神/窖神（2026-09-10）
    const extraChance = yPct / 100 + guildPct / 100 + insightPct / 100 + festPct + patronPct + (yMult - 1)
    if (extraChance <= 0) return qty + batch
    return qty + batch + (Math.random() < extraChance ? 1 : 0)
  }

  /** 弹药是否充足 */
  get outOfAmmo() {
    return this.ammoItemId ? (this.player.inventory[this.ammoItemId] ?? 0) < this.ammoPerAction : false
  }

  _canAffordAmmo() {
    return !this.ammoItemId || (this.player.inventory[this.ammoItemId] ?? 0) >= this.ammoPerAction
  }

  tick(deltaMs) {
    const target = this.currentTarget
    if (!target) return
    if (this.level < target.reqLevel) return // 等级不足不产出（UI 上目标显示锁定）
    if (this.paused) return // 手动停止（§3.1）

    // 弹药不足：不累积计时，仅提示一次
    if (!this._canAffordAmmo()) {
      if (!this._outOfAmmo) {
        this._outOfAmmo = true
        EventBus.emit('skill:outofammo', { skillId: this.id, itemId: this.ammoItemId })
      }
      return
    }
    this._outOfAmmo = false

    this.timerMs += deltaMs
    const interval = this.intervalMs(target)
    let guard = 0
    while (this.timerMs >= interval && guard++ < 300) {
      this.timerMs -= interval
      this.performAction(target)
    }
    // 单帧多段产出上限保护
    if (guard >= 300) this.timerMs = 0
    // 用真实时刻反推本周期起点（= 当前时刻 − 本周期已过有效时间），保证进度条 rAF 绝对时间单调推进、不随引擎采样回拉
    this.cycleStartAt = performance.now() - this.timerMs
  }

  /** 一次动作：消耗弹药 + 产出（子类可覆盖以自定义成功率/特殊掉落） */
  performAction(target) {
    this.actionsDone++
    if (this.ammoItemId) this.player.spendItem(this.ammoItemId, this.ammoPerAction)
    const doubled = Math.random() < this.doubleChance(target)
    const qty = this.yieldQuantity(doubled ? 2 : 1)
    this.award(target, qty, { doubled })
  }

  /** 发放产出：物品 + 专精 + 经验 + 事件（子类复用） */
  award(target, qty, flags = {}) {
    if (qty > 0) this.player.gainItem(target.itemId, qty)
    this.player.addMastery(this.id, target.itemId, 1)
    this.player.bumpStory('gather', target.itemId)
    const expGained = this.addCardXp(target.xpPerAction, masteryXpMultiplier(this.masteryLevel(target)))
    EventBus.emit('skill:action', { skillId: this.id, itemId: target.itemId, qty, expGained, ...flags, timestamp: Date.now() })
  }

  /**
   * 离线结算（§10.2.2）：actions = floor(duration / interval × efficiency)
   * 物品数量按期望产出（含平均双倍率）计算；返回 { actions, exp, items, consumed? }
   */
  computeOffline(durationMs, efficiency) {
    const target = this.currentTarget
    if (!target || this.level < target.reqLevel) return null
    const interval = this.intervalMs(target)
    if (interval <= 0) return null

    const actions = Math.floor((durationMs / interval) * efficiency)
    if (actions <= 0) return null

    const exp = actions * target.xpPerAction
    const items = {}
    const expectedQty = Math.round(actions * (1 + this.doubleChance(target)))
    if (expectedQty > 0) items[target.itemId] = expectedQty
    return { actions, exp, items }
  }
}
