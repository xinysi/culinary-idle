// 美食探索（Culinary Exploration）— 需求文档 §3.4.3
// 对应 Melvor 偷窃：选择目标探索/偷师，有成功率；
// 成功获得稀有食材/道具/金币，失败被「抓住」损失金币（金币不足则损失 生命值）。

import { Skill } from './Skill.js'
import { EventBus } from '../core/EventBus.js'
import { masteryLevelFromCount, masteryLevelProgress, masteryXpMultiplier, masteryDoubleChance, masteryIntervalFactor, masteryFixedInterval } from '../core/mastery.js'
import { itemName } from '../data/items.js'
import { EXPLORATION_TARGETS_ALL } from '../data/explorationTargets.js'
import { exploreSuccessChance as exploreDifficultyMult, exploreLootChance } from '../data/difficulty.js' // 全局难度系数（唯一缩放出口）
import { exploreSuccessChance as exploreChanceOf, exploreInitialChance, exploreBandOf } from '../data/explorationBalance.js'
import { EXPLORE_GEAR_ITEMS, EXPLORE_GEAR_DROP_CHANCE } from '../data/explorationGear.js'

const SUCCESS_PER_LEVEL = 0.015
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

  /** 该卡片的精通等级（0~100）——成功率的「精通补足」与精通档位都读它 */
  masteryLevelOf(target = this.currentTarget) {
    if (!target) return 0
    return masteryLevelFromCount(this.mastery[target.id] ?? 0)
  }

  /** 精通进度（当前档内 次数/所需）——卡片上的精通条与「x / N 次」（与采集页同名同义） */
  masteryProgress(target = this.currentTarget) {
    return masteryLevelProgress(this.mastery?.[target?.id] ?? 0)
  }

  /** 专属装备带来的成功率增量（0~0.10）：四件的 `exploreSuccessPP` 合计 ÷100 */
  gearSuccessPP() {
    const sum = this.player.equippedStats?.exploreSuccessPP ?? 0
    return Math.max(0, Number(sum) || 0) / 100
  }

  /**
   * 成功率 —— **唯一出口**（2026-09-27 用户③⑤ 改版）。
   *
   * ① 初始成功率 = `baseSuccess × 段位因子`：**段 1 ×1.00、逐段线性降到段 10 ×0.00**
   *    （「初始成功率随等级段逐渐下降至 0%」；冻结数据里的 baseSuccess 一个字节没动）
   * ② 精通补足：单卡精通 0~100 → +0~60 个百分点（末段卡片靠它起步）
   * ③ 精通池补足：池里程碑的 `successPP`（整技能口径）
   * ④ 🔴 **上限 90%**（用户要求「最大成功率到 90%」）—— ①②③ 相加后先夹在这里
   * ⑤ 专属装备在**上限之外**相加（第一套 +5%、第二套 +10%）⇒ 满配正好补足到 100%
   *
   * 细节与常量见 `data/explorationBalance.js`；显示点（`ExplorationView`）读的就是本方法 ⇒ 同源。
   * `exploreDifficultyMult`（全局桶，现 ×1）乘在最终值上，留一个整档微调口。
   */
  successChance(target = this.currentTarget) {
    if (!target) return 0
    const pool = this.player.masteryPoolBonus?.(this.id)?.successPP ?? 0
    const v = exploreChanceOf(target, {
      masteryLevel: this.masteryLevelOf(target),
      poolSuccessPP: pool,
      gearPP: this.gearSuccessPP(),
    })
    return exploreDifficultyMult(v)
  }

  /** 卡片上「初始」那一行（不含精通/装备），UI 用它解释「这一段为什么成功率低」 */
  initialChance(target = this.currentTarget) {
    return target ? exploreInitialChance(target) : 0
  }

  /** 当前目标属于第几段（1~10） */
  bandOf(target = this.currentTarget) {
    return target ? exploreBandOf(target.reqLevel) : 1
  }

  /**
   * 探索间隔：与其他技能**同一套精通档位**（2026-09-27 用户②「跟其它技能一样采用精通档位」）：
   * 精通 ≥5 间隔 ×2/3、≥10 ×1/2，≥20 起有「固定间隔」作为**上限**（取更快者，不会让卡片变慢）。
   */
  intervalMs(target = this.currentTarget) {
    if (!target) return 0
    const sec = target.intervalSec
    const lv = this.masteryLevelOf(target)
    const byRatio = sec * masteryIntervalFactor(lv)
    const fixedSec = masteryFixedInterval(lv)
    const useFixed = fixedSec != null && fixedSec < byRatio
    return (useFixed ? fixedSec : byRatio) * 1000
  }

  /** 精通档位说明用：当前走的是「固定间隔」还是「比例」口径（与采集页同源） */
  intervalMode(target = this.currentTarget) {
    if (!target) return 'ratio'
    const lv = this.masteryLevelOf(target)
    const fixedSec = masteryFixedInterval(lv)
    if (fixedSec == null) return 'ratio'
    return fixedSec < target.intervalSec * masteryIntervalFactor(lv) ? 'fixed' : 'ratio'
  }

  /** 双倍产出概率（精通档位 + 精通池的 doublePP）——与采集同一条口径 */
  doubleChance(target = this.currentTarget) {
    const mLevel = this.masteryLevelOf(target)
    const poolPP = (this.player.masteryPoolBonus?.(this.id)?.doublePP ?? 0) / 100
    return Math.min(1, masteryDoubleChance(mLevel) + poolPP)
  }

  /**
   * 单条战利品的实际概率。
   * 🔴 **金币条目走原值**（用户明确要求「除了金币」）：`type === 'gold'` 直接返回 `entry.chance`。
   * 在线掷骰、离线期望、页面显示三处都必须调它，否则会「显示 28% 实际 14%」。
   */
  lootChance(entry) {
    return entry?.type === 'gold' ? (entry.chance ?? 0) : exploreLootChance(entry?.chance ?? 0)
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
    // 🔴 精通次数**每次动作都加**（成功与否都算，2026-09-27 用户确认）：
    //    末段卡片的初始成功率是 0%，若只在成功时计精通，那张卡就永远练不起来（死卡）。
    //    与 Melvor 同口径（偷窃也按尝试计精通）。**这一条是「0% 起步靠精通提高」成立的前提。**
    this.player.addMastery(this.id, target.id, 1)
    if (Math.random() < this.successChance(target)) {
      // 成功：结算掉落
      const gained = []
      const doubled = Math.random() < this.doubleChance(target) // 精通档位/池的双倍产出（与采集同口径）
      for (const entry of target.loot) {
        if (Math.random() >= this.lootChance(entry)) continue
        let qty = entry.min === undefined ? 1 : entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1))
        if (doubled && entry.type !== 'gold') qty *= 2 // 金币不翻倍（用户「除了金币」的口径一致）
        if (entry.type === 'gold') {
          this.player.gainGold(qty)
          gained.push(`金币×${qty}`)
        } else {
          this.player.gainItem(entry.itemId, qty)
          gained.push(`${itemName(entry.itemId)}×${qty}`) // 掉落物品用中文名（此前误用英文 id）
        }
      }
      // 专属装备（2026-09-27 用户⑥）：每次**成功探索**按 0.01% 掷一次，四件等概率
      if (Math.random() < EXPLORE_GEAR_DROP_CHANCE) {
        const gear = EXPLORE_GEAR_ITEMS[Math.floor(Math.random() * EXPLORE_GEAR_ITEMS.length)]
        this.player.gainItem(gear.id, 1)
        gained.push(`✨${gear.name}`)
      }
      // 卡片经验（2026-09-09 修复）：此前误用 addXp，少了 ×60 卡片系数与精通倍率 → 满级时长
      // 比同类采集慢约 12 倍（基准 64 天 vs 5 天）。改用 addCardXp，与采集/制作同口径。
      this.addCardXp(target.xp, masteryXpMultiplier(this.masteryLevelOf(target)), target.reqLevel)
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
    const xpMult = masteryXpMultiplier(this.masteryLevelOf(target))
    const doubleFactor = 1 + this.doubleChance(target) // 双倍产出的期望倍数（与在线掷骰同口径）
    let gold = 0
    const items = {}
    for (const entry of target.loot ?? []) {
      const avgQty = entry.min === undefined ? 1 : (entry.min + (entry.max ?? entry.min)) / 2
      // 与实际掷骰同源（含难度系数；金币走原值），否则离线收益会与在线不一致
      const expected = ok * this.lootChance(entry) * avgQty
      if (entry.type === 'gold') { gold += expected; continue }
      const qty = Math.round(expected * doubleFactor)
      if (qty > 0) items[entry.itemId] = (items[entry.itemId] ?? 0) + qty
    }
    // 专属装备同样按期望给（0.01% × 成功次数，通常四舍五入为 0，但口径必须与在线一致）
    const gearExpected = ok * EXPLORE_GEAR_DROP_CHANCE
    if (gearExpected > 0) {
      const per = gearExpected / EXPLORE_GEAR_ITEMS.length
      for (const g of EXPLORE_GEAR_ITEMS) {
        const qty = Math.round(per)
        if (qty > 0) items[g.id] = (items[g.id] ?? 0) + qty
      }
    }
    return { actions, exp, xpMult, items, gold: Math.round(gold) }
  }
}
