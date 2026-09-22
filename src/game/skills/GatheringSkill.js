// 采集类技能基类 — 需求文档 §3.1
// 核心机制：选择目标 → 定时产出食材 + 经验
// - 间隔 = 基础间隔 − 等级加成 − 工具加成（装备系统接入前 toolBonus 为 0）
// - 双倍产出：基础 1%，随专精等级提升（§3.1.1）
// - 弹药消耗（狩猎 §3.1.3）：ammoItemId 配置后，每次动作消耗对应道具，弹药不足不累积计时
// - 离线收益：computeOffline（§10.2.2，80% 效率）

import { Skill, CARD_XP_SCALE } from './Skill.js'
import { EventBus } from '../core/EventBus.js'
import { masteryLevelFromCount, masteryDoubleChance, masteryIntervalFactor, masteryFixedInterval, masteryXpMultiplier, masteryLevelProgress, masteryYieldBonus } from '../core/mastery.js'
import { applyGatherXp } from './xpBalance.js'
import { targetLevelXpMult } from '../core/growthRate.js' // 低目标经验减半：显示（效率）与结算同源

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

  /** 当前选择的采集目标（§3.1 每技能独立目标，多技能并行）
   *  ⚠️ 兜底（v2.7.0）：若存档里的目标 id 已不在本技能的目标表里（例如「矿物从挖掘独立为采矿」这类
   *  目标集合变更），**回退到本技能的第一个目标**而不是返回 null——返回 null 是静默停产：
   *  `tick` 直接 return、`computeOffline` 返回 null、并行挂机列表也把它剔除，玩家只会看到「技能不干活了」。 */
  get currentTarget() {
    const targetId = this.player.getSkillTarget?.(this.id) ?? this.player.activeTarget
    const hit = this.targets.find((t) => t.itemId === targetId)
    if (hit) return hit
    if (targetId != null && this.targets.length) return this.targets[0]
    return null
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

  /**
   * 目标实际间隔（毫秒）：基础 − 等级加成 − 工具加成，再乘精通比例因子（<5 为 1、5~9 减 1/3、≥10 减半）；
   * 精通 ≥20 时固定间隔（masteryFixedInterval）作为**上限**参与，取更快者：`min(固定, 比例口径)`。
   *
   * ⚠️ 2026-09-12 修：此前是「精通 ≥20 直接整段换成固定值」，那会让 367 个采集目标里 **51%（187 个）**
   * 在精通 19→20 时反而变慢（最差 3.0s 基础目标：1.5s → 3.6s，2.4 倍），而玩家看到的只是"精通升了却变慢"。
   * 固定值本意是给「基础间隔很长」的目标兜底提速（那些才是后期真正刷的目标，8s 基础在精通 100 时 2.0s），
   * 不该顺手把「基础间隔短」的目标一起拖慢。改成取更快者后：0 个目标比 19 级慢，慢目标的数值维持原标定。
   */
  intervalMs(target = this.currentTarget) {
    if (!target) return 0
    const levelBonus = Math.floor((this.level - 1) / 10) * LEVEL_SPEED_BONUS_PER_10
    const lv = this.masteryLevel(target)
    const sec = Math.max(target.intervalSec - levelBonus - this.toolBonusSec, MIN_INTERVAL_SECONDS)
    const byRatio = sec * masteryIntervalFactor(lv)
    const fixedSec = masteryFixedInterval(lv)
    const base = fixedSec != null ? Math.min(fixedSec, byRatio) : byRatio
    // 增益剂「采集间隔」乘区（菌灵露·Ⅴ+ / 鲍汁）：挂在唯一的间隔出口上、**乘在最终结果**上，
    // 这样「精通固定间隔」那一支也吃得到加成（只在某一条分支里乘会静默漏掉一半情况）。
    return base * (this.player.getGatherMultiplier?.() ?? 1) * 1000
  }

  /** 当前间隔由哪一支决定：'fixed'（精通固定值更快）或 'ratio'（比例口径更快）——UI 标注用 */
  intervalSource(target = this.currentTarget) {
    if (!target) return 'ratio'
    const lv = this.masteryLevel(target)
    const fixedSec = masteryFixedInterval(lv)
    if (fixedSec == null) return 'ratio'
    const levelBonus = Math.floor((this.level - 1) / 10) * LEVEL_SPEED_BONUS_PER_10
    const sec = Math.max(target.intervalSec - levelBonus - this.toolBonusSec, MIN_INTERVAL_SECONDS)
    return fixedSec < sec * masteryIntervalFactor(lv) ? 'fixed' : 'ratio'
  }

  /** 双倍产出几率：按该卡片精通档位（0/5%/15%/25%/50%），无精通时保留基础 1%
   *  + 精通池里程碑的整技能 +doublePP 百分点（2026-09-19）。
   *  ⚠️ 池加成**只挂在这里**：`performAction`（在线）与 `expectedYield`（离线）都读它 ⇒ 天然同源。 */
  doubleChance(target = this.currentTarget) {
    if (!target) return 0
    const mLevel = this.masteryLevel(target)
    const poolPP = (this.player.masteryPoolBonus?.(this.id)?.doublePP ?? 0) / 100
    return Math.min(1, Math.max(BASE_DOUBLE_CHANCE, masteryDoubleChance(mLevel)) + poolPP)
  }

  /** 精通保底批量（50 级 +1 / 100 级 +2）：写死数量、不靠随机（2026-09-09）
   *  + 山海食经的「固定数值」奖励（v2.1）：同样是写死数量、按技能给，**必须在这里加**
   *  （`yieldQuantity` 与 `expectedYield` 都读它 → 在线/离线同口径，避免历史那种两条路径漂移）。 */
  yieldBatch(target = this.currentTarget) {
    const mastery = target ? masteryYieldBonus(this.masteryLevel(target)) : 0
    const shanhai = this.player.shanhaiEffects?.().flatYield?.[this.id] ?? 0
    return mastery + shanhai
  }

  /** 「额外产出 1 个」的总几率（可 >1，调用方按上限 +1 处理）：奥义「丰收祝福」（§3.4.1）+ 产量增益剂（§3.4.2）
   *  + 公会被动（§13）+ 菜系图谱 + 节庆 + 食神信仰 + 天气 + 今日运势 + 荣誉殿堂 */
  yieldExtraChance(target = this.currentTarget) {
    // 精通联动（v2.5.0）：把该物品「农耕精通」的成果算进采集——每 10 级 +2%、上限 +20%。
    // 挂在 yieldExtraChance 上（`yieldQuantity` 与 `expectedYield` 都读它 ⇒ 在线/离线同口径），
    // 对基础 1 件/次的动作来说，+0.20 几率 ≈ 产出 +20%，正是「越会种、越会采」。
    const farmLink = this.player?.farmMasteryGatherChance?.(target?.itemId) ?? 0
    const aoji = this.player.gastronomyEffects?.() ?? {}
    const yPct = aoji.yieldPct ?? 0
    const guildPct = this.player.guildEffects?.()?.yieldPct ?? 0
    const insightPct = this.player.insightEffects?.()?.yieldPct ?? 0 // 菜系图谱（2026-09-09）
    const yMult = this.player.getYieldMultiplier?.() ?? 1
    const festPct = ((this.player.festivalBoost?.()?.gatherYield ?? 1) - 1) // 节庆（2026-09-10）
    const patronPct = (this.player.patronEffects?.()?.yieldPct ?? 0) / 100 // 食神信仰：农神/窖神（2026-09-10）
    const wxPct = ((this.player.weatherEffects?.()?.gatherYield ?? 1) - 1) // 天气（2026-09-10）
    const luckyPct = target ? (this.player.luckyItemBonus?.(target.itemId) ?? 0) : 0 // 今日运势·幸运食材
    const honorPct = (this.player.honorState?.()?.perks?.gatherPct ?? 0) / 100 // 荣誉殿堂（2026-09-10）
    const daoPct = (this.player.daoEffects?.()?.yieldPct ?? 0) / 100 // 厨神之路·采撷之道（v2.0）
    // 副业·采掘器具（v2.13.0）：**只对采矿生效**的附产率（采矿原本没有附产）。
    // 挂在这里 ⇒ `yieldQuantity`（在线）与 `expectedYield`（离线）都会读到，无需另做同源处理。
    // 注意：`yieldQuantity` 会把总额外几率夹在 1（单次最多多给 1 个）⇒ 本项在极高产量加成下会被自然摊薄。
    const miningGear = this.id === 'mining' ? (this.player.sidelineEffectTotal?.('miningExtraPP') ?? 0) / 100 : 0
    return yPct / 100 + guildPct / 100 + insightPct / 100 + festPct + patronPct + wxPct + luckyPct + honorPct + daoPct + (yMult - 1) + farmLink + miningGear
  }

  /** 产量加成后的数量：精通保底批量 + 各百分比来源的额外产出，以额外产出几率折算 */
  yieldQuantity(qty, target = this.currentTarget) {
    const batch = this.yieldBatch(target)
    const extraChance = Math.min(1, this.yieldExtraChance(target)) // 单次动作最多多给 1 个
    if (extraChance <= 0) return qty + batch
    return qty + batch + (Math.random() < extraChance ? 1 : 0)
  }

  /**
   * 单次动作的期望产出（离线结算用，与在线 `yieldQuantity` 同源，避免两条路径漂移）。
   * ⚠️ 额外产出几率**下限夹 0**：恶劣天气（2026-09-13）等来源会让 `yieldExtraChance` 变成负数，
   *    在线路径 `yieldQuantity` 在 `extraChance <= 0` 时直接返回基础产量（不倒扣），
   *    所以离线也必须 `max(0, …)` —— 否则坏天气下「离线比在线还亏」，两条路径又不一致了（C16 守这类漂移）。
   */
  expectedYield(target = this.currentTarget) {
    return (1 + this.doubleChance(target)) + this.yieldBatch(target) + Math.max(0, Math.min(1, this.yieldExtraChance(target)))
  }

  /** 单次动作的卡片精通经验倍数（在线在 award() 里作为 mult 传给 addCardXp；离线需同样带上） */
  xpMultOf(target = this.currentTarget) {
    return masteryXpMultiplier(this.masteryLevel(target))
  }

  /**
   * 该目标的**实际效率**（技能经验/小时）＝ 卡片经验 × 精通经验倍率 × 3600 ÷ 实际间隔。
   *
   * 🔴 这是玩家横向比较目标时**唯一需要的数字**，也是「换更高级资源」这条设计意图的可见化：
   *   卡片上原本只有「基础经验」与「间隔」两列，玩家得自己心算「经验 ÷ 间隔 × 精通倍率」，
   *   而精通倍率只在 ≥5 级时才显示、且间隔有「固定档取更快者」的分支 —— 心算很容易得出反的结论。
   *   实测（`scripts/sim/target_choice.mjs`）：同精通下最高级目标是最低卡的 ×8.5~×26.9，
   *   「跟等级换」比「全程蹲最低级卡片」24h 多拿 ×9.2 经验，是全局最强的成长杠杆。
   * ⚠️ 乘 `CARD_XP_SCALE` 是为了与技能经验条同口径（`Skill.addCardXp` 也乘它）；
   *   倍率关系不受影响，但**数字要与玩家在经验条上看到的对得上**，否则又是一个「页面骗人」。
   * ⚠️ 含增益剂带来的间隔乘区（`intervalMs` 里已乘），所以它会随增益剂波动 —— 这是对的，
   *   玩家比较目标时本来就在同一个时刻比较。
   */
  xpPerHour(target = this.currentTarget) {
    if (!target) return 0
    const sec = this.intervalMs(target) / 1000
    if (!(sec > 0)) return 0
    // 低目标经验减半（2026-09-22）：效率必须与结算同源 —— 不然卡片写着「880 万/时」而实际只到账 440 万，
    // 正是本项目最忌的「显示与结算不一致」（`system_test` 的「目标效率」那条就是拿它与真实引擎对账的）。
    const lowMult = targetLevelXpMult(this.level, target.reqLevel, this.topTargetLevel)
    return (target.xpPerAction * CARD_XP_SCALE * lowMult * masteryXpMultiplier(this.masteryLevel(target))) / sec * 3600
  }

  /** 当前**已解锁**目标里效率最高的那个（未解锁的不参与，避免给玩家「换过去更快」的错误引导） */
  bestUnlockedTarget() {
    let best = null
    let bestRate = -1
    for (const t of this.targets) {
      if (this.level < t.reqLevel) continue
      const r = this.xpPerHour(t)
      if (r > bestRate) {
        bestRate = r
        best = t
      }
    }
    return best
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
    // 轶事进度不在这里写：addMastery 已经按**正确键** `gather:<技能id>:<物品id>` 记过一笔
    // （看见 StoryView 的 storyProg / tales 生成器的 unlock 口径）。
    // 这里原先还有一句 `bumpStory('gather', target.itemId)` → 键成了 `gather:<物品id>`，
    // 没有任何消费方读得到，只会往存档里灌垃圾键（2026-09-18 删）。
    this.player.addMastery(this.id, target.itemId, 1)
    const expGained = this.addCardXp(target.xpPerAction, masteryXpMultiplier(this.masteryLevel(target)), target.reqLevel)
    EventBus.emit('skill:action', { skillId: this.id, itemId: target.itemId, qty, expGained, ...flags, timestamp: Date.now() })
  }

  /**
   * 离线结算（§10.2.2）：actions = floor(duration / interval × efficiency)
   * 每次动作的期望产出与经验都走与在线同一套公式（expectedYield / xpMultOf）——离线只该「速率打 8 折」，
   * 不该因为走了另一条算式而丢掉精通保底产量、产量加成与精通经验倍数（此前实测离线产出只有在线的 1/2~1/3）。
   * 返回 { actions, exp, xpMult, items, consumed? }
   */
  computeOffline(durationMs, efficiency) {
    const target = this.currentTarget
    if (!target || this.level < target.reqLevel) return null
    const interval = this.intervalMs(target)
    if (interval <= 0) return null

    const actions = Math.floor((durationMs / interval) * efficiency)
    if (actions <= 0) return null

    const exp = actions * target.xpPerAction
    const xpMult = this.xpMultOf(target)
    const items = {}
    const expectedQty = Math.round(actions * this.expectedYield(target))
    if (expectedQty > 0) items[target.itemId] = expectedQty
    return { actions, exp, xpMult, items }
  }
}
