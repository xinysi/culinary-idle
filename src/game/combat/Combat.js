// 料理对决引擎 — 需求文档 §4
// 自动回合制（基础 2.4s/回合，§4.1）；属性面板见 §4.2；克制三角 +15%（§3.3/§11.2）
// 道具：食物回血（3 回合冷却，§4.5）、酱料增益 10 回合、饮品 增益（酒类有醉酒 负面效果）
// 失败惩罚：随机丢失一件已装备装备（非硬核模式，§4.1）

import { STYLE_INFO, STYLE_ADVANTAGE } from '../data/combat.js'
import { getItem, itemName } from '../data/items.js'
import { getSkillInstance } from '../skills/registry.js'
import { EventBus } from '../core/EventBus.js'
import { BISCUIT_HEAL_PCT, BISCUIT_BUFF_TURNS, BISCUIT_ACC, BISCUIT_SPEED_PCT, BISCUIT_COOLDOWN_TURNS } from '../data/biscuitUse.js'
import { COMBAT_SPEED_FLOOR_SEC, combatTurnIntervalSec, combatSpeedAtCap, COMBAT_RESPAWN_SEC } from '../data/caps.js' // 攻速地板常量单一来源
import { tunerOver } from '../data/tuner.js'
import { combatXpPerSkill, hitXpFor } from '../data/combatXpCurve.js' // 经验口径（按伤害 + 开局爬坡）单一来源
import { scaledEnemy } from '../data/enemyScaling.js' // 血量分档（读取点系数，冻结数据不动）
import { dropChance } from '../data/difficulty.js' // 全局难度系数：掉落概率的唯一缩放出口（数据层不动）
// 战斗深度 v1（2026-09-26）：命中/闪避的可堆形态 + 玩家对敌人的状态 + 敌人抗性
// ⚠️ 三个机制的**全部常量**都在那个模块里，这里只调它的出口函数，不写字面量（守卫会扫）
import {
  COMBAT_DEPTH_V1, ACC_GEAR_DIV, EVA_GEAR_DIV, ACC_GEAR_CAP, EVA_GEAR_CAP,
  STYLE_STATUS, STATUS_INFO, STATUS_TURNS,
  statusTriggerChance, dotDamage, brokenDef, resistedStatusOf,
  heavyPct, heavyChance, heavyDamage,
} from '../data/combatTuning.js'

const FOOD_COOLDOWN_TURNS = 3 // §4.5 料理冷却 3 回合
const DRUNK_TURNS = 5 // 醉酒 负面效果 持续 5 回合
const FLAVOR_COST = 10 // 调味冲击消耗（§3.3.3）
const FLAVOR_REGEN = 5
const FLAVOR_MAX = 100
const MYSTERY_BUFFS = [
  { atk: 8 },
  { accuracy: 10 },
  { defense: 6 },
  { critChance: 0.1 },
  { atk: 5, accuracy: 5 },
]

// 获胜经验的分段补强曲线已搬到 `data/combatXpCurve.js`（经验口径唯一来源）——
// 那里同时负责「按造成的伤害给经验」的新口径与「同等级击杀 = 旧值」的等价性。
// ⚠️ 别再在这里写第二份曲线：C46b 守卫断言「引擎里不得再出现 winXpBoost 的副本」。

let instance = null
export function setCombatInstance(c) {
  instance = c
}
export function getCombat() {
  return instance
}

/**
 * 命中/闪避的「等级项 + 装备项」合成（战斗深度 v1 的 ①）
 *   · 开（默认）：`等级项 × (1 + min(装备, CAP) / DIV)` —— 装备为 0 时与旧公式**逐值相等**，堆装备才有意义
 *     上限不可省：装备命中是加法属性，词条+宝石+强化能把它堆到几百，不封顶会把命中率推到 90%（见 combatTuning 注释）
 *   · 关（回退）：`等级项 + 装备` —— **与 2026-09-26 之前的旧公式逐值相等**，所以它是一个**真回退**开关
 */
function accTerm(levelPart, gearValue, div, cap) {
  const g = Number(gearValue) || 0
  if (!COMBAT_DEPTH_V1) return levelPart + g
  return g === 0 ? levelPart : levelPart * (1 + Math.min(g, cap) / div)
}

export class Combat {
  constructor(player) {
    this.player = player
    this.inFight = false
    this.opponent = null
    this.opponentHp = 0
    this.oppStyle = null
    this.bossPhase = 1
    this.turnTimer = 0
    this.turnCount = 0
    this.log = []
    this.buffs = { atk: 0, accuracy: 0, defense: 0, evasion: 0, critChance: 0 }
    this.buffTurns = 0
    this.drunkTurns = 0
    this.slowTurns = 0
    this.regenTurns = 0
    this.regenPerTurn = 0
    this.burnTurns = 0
    this.poisonTurns = 0
    this.foodCooldown = 0
    this.biscuitCooldown = 0 // 能量饼干冷却（2026-09-10）
    this.biscuitSpeedPct = 0 // 「精力充沛」攻速加成，随 buffTurns 归零
    this.biscuitTurns = 0 // 饼干自己的增益计时（2026-09-22：不再与酱料共用 buffTurns）
    this.buffDelta = { item: {}, biscuit: {} } // 各来源各贡献了多少，到期时按来源精确扣除
    this.damageDealt = 0 // 本场对敌人造成的**有效伤害**（经验口径用，2026-09-22）
    this.respawnUntil = 0 // 击杀后的重生间隔（(b)，仅胜利时设置）
    this.result = null // win | lose
    // 战斗深度 v1：**敌人身上**的状态剩余回合（此前敌人不吃任何状态）
    this.enemyStatus = { bleed: 0, dBreak: 0, burn: 0 }
    this.statusApplied = 0 // 本场成功施加状态的次数（统计/守卫用）
    this.heavyFired = false // 本场是否已经打出过越级重击（一次/场，防连续两次直接秒杀）
  }

  get styleId() {
    return this.player.combat.style
  }
  get styleSkillId() {
    return STYLE_INFO[this.styleId].skillId
  }
  get styleLevel() {
    return this.player.skills[this.styleSkillId]?.level ?? 1
  }
  get styleName() {
    return STYLE_INFO[this.styleId].name
  }

  /** 玩家实时属性（§4.2）；食神秘境局内增益（2026-09-09）仅在秘境激活时叠加
   *  ⚠️ 2026-09-22 收口三件事：
   *    · `maxHp` **直接取 store 的唯一口径**（`player.maxHp` 已含道树/图谱/秘境的全部 %），
   *      这里**不再乘第二遍**（此前道树 % 被算两次、图谱 % 只在战斗里生效、料理回血又按未加成的值封顶）。
   *    · 回合间隔走 `caps.js` 的 `combatTurnIntervalSec()`（地板常量单一来源），并暴露 `speedAtCap`。
   *    · 受伤减免（奥义 defensePct）暴露成 `damageTakenPct`，`opponentAttack` 与界面读同一个值。 */
  playerStats() {
    const eq = this.player.equippedStats
    const sl = this.styleLevel
    const heat = this.player.skills.heatControl?.level ?? 1
    const drunkPenalty = this.drunkTurns > 0 ? 0.15 : 0
    const gEff = this.player.gastronomyEffects?.() ?? {}
    const realm = this.player.realmModifiers?.() ?? null
    const insight = this.player.insightEffects?.() ?? {} // 菜系图谱永久加成（2026-09-09）
    const dao = this.player.daoEffects?.() ?? {} // 厨神之路·厨武之道（v2.0）
    const atkPct = (realm?.attackPct ?? 0) + (insight.attackPct ?? 0)
    const defPct = (realm?.defensePct ?? 0) + (insight.defensePct ?? 0)
    // 攻速加成：奥义 + 秘境 + 能量饼干「精力充沛」+ 酱料/饮品的 `buff.speed`（2026-09-22 起真被消费）
    const speedPct = (Number(gEff.speedPct) || 0) + (realm?.speedPct ?? 0) + (this.biscuitSpeedPct || 0) + (Number(this.buffs.speed) || 0)
    const speedBonus = Number(eq.speedBonus) || 0
    const atCap = combatSpeedAtCap(sl, speedBonus)
    return {
      hp: this.player.combat.hp,
      maxHp: this.player.maxHp, // 唯一口径：外面那一层 % 已在 store 的 getter 里乘过
      attack: (sl * 3 + eq.attack + this.buffs.atk) * (1 + atkPct / 100),
      // ⚠️ 战斗深度 v1：命中/闪避改成 `等级项 × (1 + 装备项 / DIV)`（装备为 0 时**逐值等于旧公式**
      //    `10 + sl + eq.accuracy`）。为什么必须改：敌人闪避是 `4 + 1.5×等级`，而玩家命中只 +1/级
      //    ⇒ 命中率从 L1 的 70% 退化到 L120 的 45%，且装备只能给 +22（**玩家没有杆杆可拉**）。
      //    平面加成（酱料/饼干的 +命中）留在括号里，避免被等级稀释成 0。
      accuracy: Math.max(1, Math.floor(accTerm(10 + sl + this.buffs.accuracy, eq.accuracy, ACC_GEAR_DIV, ACC_GEAR_CAP) * (1 - drunkPenalty) * (1 + (realm?.accuracyPct ?? 0) / 100))),
      defense: (heat + eq.defense + this.buffs.defense) * (1 + defPct / 100),
      evasion: Math.floor(accTerm(5 + heat * 0.5 + this.buffs.evasion, eq.evasion, EVA_GEAR_DIV, EVA_GEAR_CAP) * (1 + (realm?.evasionPct ?? 0) / 100)),
      critChance: Math.min(0.05 + (Number(eq.critChance) || 0) + this.buffs.critChance + (realm?.critChance ?? 0) + (dao.critPct ?? 0) / 100, 0.8),
      speedMs: Math.floor(combatTurnIntervalSec(sl, speedBonus, speedPct) * 1000 * (this.slowTurns > 0 ? 1.5 : 1)),
      speedAtCap: atCap, // 已在地板上 ⇒ 一切「攻速 +%」当前都是零效果（界面据此提示，别再让玩家白花品鉴点）
      speedFloorMs: COMBAT_SPEED_FLOOR_SEC * 1000,
      damageTakenPct: Number(gEff.defensePct) || 0, // 受伤减免（奥义「铜墙铁壁」等），界面与 opponentAttack 同一来源
      flavorEnergy: this.player.combat.flavorEnergy,
    }
  }

  logLine(text, kind = 'info') {
    this.log.push({ text, kind, turn: this.turnCount })
    if (this.log.length > 80) this.log.shift()
  }

  /**
   * 施加增益（**按来源分别记账**，2026-09-22）：
   * 问题：原先所有增益共用一个 `buffTurns`，且到期时把 `this.buffs` 整个清零 ⇒
   *   ① 饼干的攻速会被「之后用的那瓶 10 回合酱料」顺带延长（自己的 5 回合形同虚设）；
   *   ② 反过来先酱料后饼干时，酱料的属性也会跟着饼干的节奏走。
   * 现在每个来源各自记「贡献了多少」，各自到期时**只扣自己那份**。
   * ⚠️ 同来源内部仍是「取最长」（连喝两瓶 10 回合酱料 = 10 回合，不是 20），这是原有的设计口径。
   */
  addBuff(source, obj, turns) {
    const dst = this.buffDelta[source] ?? (this.buffDelta[source] = {})
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'duration') continue
      this.buffs[k] = (this.buffs[k] ?? 0) + v
      dst[k] = (dst[k] ?? 0) + v
    }
    const t = Math.max(1, Math.round(Number(turns) || 1))
    if (source === 'biscuit') this.biscuitTurns = Math.max(this.biscuitTurns, t)
    else this.buffTurns = Math.max(this.buffTurns, t)
  }

  /** 某来源的增益到期：只扣掉它自己贡献的那部分 */
  expireBuff(source) {
    const src = this.buffDelta[source] ?? {}
    for (const [k, v] of Object.entries(src)) this.buffs[k] = (this.buffs[k] ?? 0) - v
    this.buffDelta[source] = {}
    if (source === 'biscuit') this.biscuitSpeedPct = 0
  }

  /** 增益剩余回合（界面显示用：两个来源取较长者） */
  buffTurnsLeft() {
    return Math.max(this.buffTurns, this.biscuitTurns)
  }

  /**
   * 开始一场对决。
   * ① **血量分档**（(c)，2026-09-22）：入场前套一层 `scaledEnemy()` 运行时副本 ——
   *    冻结的敌人数据一个字节不动（与塔的难度档同一做法）。⚠️ 界面列表与这里必须用
   *    **同一个** `scaledEnemy()`，否则会出现「卡片写 120 血、打起来 240 血」。
   * ② **重生间隔**（(b)）：击杀后 `COMBAT_RESPAWN_SEC` 秒内拒绝开打（返回 false），
   *    由界面显示倒计时。**只有胜利**才设这个门。
   * @returns {boolean} 是否真的开打（false = 还在重生间隔里）
   */
  start(opponent) {
    if (this.respawnLeftMs() > 0) {
      this.logLine(`⏳ 敌人重生中（还剩 ${(this.respawnLeftMs() / 1000).toFixed(1)}s）`, 'warn')
      return false
    }
    const o = scaledEnemy(opponent)
    this.opponent = o
    this.opponentHp = o.hp
    this.oppStyle = o.style
    this.bossPhase = 1
    this.inFight = true
    this.turnTimer = 0
    this.turnStartAt = performance.now() // 本回合起点（绝对时间戳，战斗进度条 rAF 用）
    this.turnCount = 0
    this.damageDealt = 0
    this.log = []
    this.buffs = { atk: 0, accuracy: 0, defense: 0, evasion: 0, critChance: 0 }
    this.buffTurns = 0
    this.drunkTurns = 0
    this.slowTurns = 0
    this.regenTurns = 0
    this.regenPerTurn = 0
    this.burnTurns = 0
    this.poisonTurns = 0
    this.foodCooldown = 0
    this.biscuitCooldown = 0 // 能量饼干冷却（2026-09-10）
    this.biscuitSpeedPct = 0 // 「精力充沛」攻速加成，随 buffTurns 归零
    this.biscuitTurns = 0
    this.buffDelta = { item: {}, biscuit: {} }
    this.result = null
    this.enemyStatus = { bleed: 0, dBreak: 0, burn: 0 } // 敌人身上的状态（每场清零；首领的免疫在施加时判定）
    this.statusApplied = 0
    this.heavyFired = false
    this.logLine(`⚔️ 对决开始：${o.name}（等级 ${o.level}，${o.styleName}）`)
    EventBus.emit('combat:start', { opponent: o.name })
    return true
  }

  /** 击杀后的重生剩余毫秒（0 = 可以开打）。界面据此显示倒计时/禁用按钮 */
  respawnLeftMs() {
    const left = (this.respawnUntil ?? 0) - performance.now()
    return left > 0 ? left : 0
  }

  stop() {
    this.inFight = false
  }

  tick(deltaMs) {
    if (!this.inFight) return
    this.turnTimer += deltaMs
    const speed = this.playerStats().speedMs
    let guard = 0
    while (this.turnTimer >= speed && guard++ < 300) {
      this.turnTimer -= speed
      this.resolveTurn()
      if (!this.inFight) return
    }
    // 用真实时刻反推本回合起点（= 当前时刻 − 本回合已过有效时间），保证战斗进度条 rAF 绝对时间单调推进
    this.turnStartAt = performance.now() - this.turnTimer
  }

  resolveTurn() {
    this.turnCount++
    const p = this.playerStats()
    const o = this.opponent

    // 回合开始状态结算
    if (this.foodCooldown > 0) this.foodCooldown--
    if (this.biscuitCooldown > 0) this.biscuitCooldown--
    if (this.buffTurns > 0) {
      this.buffTurns--
      if (this.buffTurns === 0) this.expireBuff('item') // 只扣「酱料/饮品/调料」那一份
    }
    if (this.biscuitTurns > 0) {
      this.biscuitTurns--
      if (this.biscuitTurns === 0) this.expireBuff('biscuit') // 饼干自己的命中/攻速到期（不被酱料延长）
    }
    if (this.drunkTurns > 0) this.drunkTurns--
    if (this.slowTurns > 0) this.slowTurns--
    if (this.regenTurns > 0) {
      this.regenTurns--
      this.player.setCombat({ hp: Math.min(p.maxHp, this.player.combat.hp + this.regenPerTurn) })
    }
    if (this.burnTurns > 0) {
      this.burnTurns--
      this.damagePlayer(Math.max(1, Math.floor(o.level * 0.5)), '🔥 灼烧')
    }
    if (this.poisonTurns > 0) {
      this.poisonTurns--
      this.damagePlayer(Math.max(1, Math.floor(o.level * 0.6)), '☠️ 中毒')
    }
    if (this.styleId === 'flavor') {
      this.player.setCombat({ flavorEnergy: Math.min(FLAVOR_MAX, this.player.combat.flavorEnergy + FLAVOR_REGEN) })
    }

    // 食灵每回合效果（§3.3.6）：灵芝回血 / 龙息代价
    const seff = this.player.spiritEffects?.() ?? {}
    if (seff.healPerTurnPct) {
      const heal = Math.max(1, Math.floor(p.maxHp * seff.healPerTurnPct / 100))
      this.player.setCombat({ hp: Math.min(p.maxHp, this.player.combat.hp + heal) })
      this.logLine(`🍄 灵芝精灵回复 ${heal} 生命值`, 'dim')
    }
    if (seff.loseHpPerTurnPct) {
      const cost = Math.max(1, Math.floor(p.maxHp * -seff.loseHpPerTurnPct / 100))
      this.damagePlayer(cost, '🐉 龙息精灵代价')
      if (!this.inFight) return
    }
    // 食神秘境增益：每回合回血（2026-09-09）
    const realmHeal = this.player.realmModifiers?.()?.healPerTurnPct ?? 0
    if (realmHeal > 0) {
      const heal = Math.max(1, Math.floor(p.maxHp * realmHeal / 100))
      this.player.setCombat({ hp: Math.min(p.maxHp, this.player.combat.hp + heal) })
      this.logLine(`🏯 秘境祝福回复 ${heal} 生命值`, 'dim')
    }

    // 甜品女王：每回合回血
    if (o.mechanic?.regen && this.opponentHp > 0) {
      const heal = Math.max(1, Math.floor(o.level * 0.35))
      this.opponentHp = Math.min(o.hp, this.opponentHp + heal)
      this.logLine('🍰 甜品女王恢复 ' + heal + ' 生命值', 'dim')
    }

    // 战斗深度 v1：**敌人身上**的状态结算（与玩家侧 burn/poison 同口径：先扣回合数再算伤害）
    // 三个状态里 bleed/burn 是 DoT（按玩家攻击派生），dBreak 只改防御（在 playerAttack 里读）
    this.settleEnemyStatus()

    // 分子料理博士：每回合随机变换风格（克制关系动态变化）
    if (o.mechanic?.randomStyle) {
      const styles = ['knife', 'plating', 'flavor']
      this.oppStyle = styles[Math.floor(Math.random() * styles.length)]
    }

    // 玩家攻击
    if (this.inFight) this.playerAttack(o)
    // 对手攻击
    if (this.inFight) this.opponentAttack(o)
    // 自动进食（§4.5）：在对手攻击后判断，血量降到阈值当回合立即吃料理，避免延迟到下回合
    this.maybeAutoEat()
  }

  maybeAutoEat() {
    const s = this.player.settings
    // 自动进食不受手动料理冷却限制（§4.5）：血量低于阈值当回合立即补血，避免 3 回合才回一次
    if (!s.autoEat) return
    const hp = this.player.combat.hp
    const max = this.player.maxHp
    if (max <= 0 || hp / max > (s.autoEatThreshold ?? 50) / 100) return
    // 优先吃玩家在「战备」里点选的那味料理（settings.autoEatItem，2026-09-21 用户要求
    // 「点击选择食物为当前自动进食的食物」）：指定的是**策略**而不是「只准吃这个」——
    // 指定品吃光/没带时回落到「回血最高」，否则自动进食会静默停摆。
    const picked = s.autoEatItem ? getItem(s.autoEatItem) : null
    if (picked?.type === 'food' && picked.heal && (this.player.inventory[s.autoEatItem] ?? 0) > 0) {
      this.useFood(picked.id, true)
      return
    }
    // 选背包中回血最高的料理
    let best = null
    for (const [id, qty] of Object.entries(this.player.inventory)) {
      if (qty <= 0) continue
      const item = getItem(id)
      if (item?.type === 'food' && item.heal && (!best || item.heal > best.heal)) best = item
    }
    if (best) this.useFood(best.id, true)
  }

  // ── 只读展示用getter（2026-09-19，供属性面板）─────────────────────────
  // ⚠️ 这两个只是把**既有公式里的常量**暴露给界面，不参与任何计算、不改公式：
  //    属性面板要显示「伤害减免」与「暴击伤害」，重算一遍会让界面与战斗出现两套真相
  //    （改公式时忘改界面 ⇒ 页面显示的数字与实际伤害不符）。
  /** 暴击倍率。与 playerAttack 里 `dmg *= 2` 同源；C51 有「此值 == 公式里的字面量」断言 */
  critMultiplier() {
    return 2
  }

  /** 减伤率 = def/(def+100)。与 playerAttack（看对手 def）与对手攻击（看玩家 defense）同一口径 */
  reductionPct(def) {
    const d = Number(def) || 0
    return d / (d + 100)
  }

  /** 克制倍率。与两处 `advantage ? 1.15 : 1`（玩家/对手）同源；C51 有「此值 == 公式里的字面量」断言 */
  advantageMultiplier() {
    return 1.15
  }

  playerAttack(o) {
    const style = this.styleId

    // 弹药 / 能量消耗（§3.3.3 / §3.3.4）
    if (style === 'plating') {
      if (!this.player.spendItem('garnish', 1)) {
        this.logLine('🎨 装饰食材不足，摆盘攻击落空！', 'warn')
        return
      }
    } else if (style === 'flavor') {
      if (this.player.combat.flavorEnergy < FLAVOR_COST) {
        this.logLine('✨ 调味能量不足，攻击落空！', 'warn')
        return
      }
      this.player.setCombat({ flavorEnergy: this.player.combat.flavorEnergy - FLAVOR_COST })
    }

    const p = this.playerStats()
    // 命中判定（§11.2）
    const hitChance = p.accuracy / (p.accuracy + o.eva)
    if (Math.random() > hitChance) {
      this.logLine('💨 攻击被对方闪避了！', 'dim')
      return
    }
    // 克制加成（§3.3）
    const advantage = STYLE_ADVANTAGE[style] === this.oppStyle
    const typeBonus = advantage ? 1.15 : 1
    // 破防（战斗深度 v1）：敌人防御下降后，减伤公式按**下降后的值**算 —— 引擎与界面同源（`enemyDef()`）
    const oDef = this.enemyDef()
    const reduction = oDef / (oDef + 100)
    // 伤害加成：食灵（§3.3.6 dmgPct/styleDmgPct）+ 奥义（§3.4.1 dmgPct/styleDmgPct）
    const seff = this.player.spiritEffects?.() ?? {}
    const gEff = this.player.gastronomyEffects?.() ?? {}
    const dmgPct = (seff.dmgPct ?? 0) + (gEff.dmgPct ?? 0) + (seff.styleDmgPct?.[style] ?? 0) + (gEff.styleDmgPct?.[style] ?? 0) + ((this.player.guildEffects?.() ?? {}).dmgPct ?? 0) + (this.player.daoEffects?.()?.dmgPct ?? 0)
    let dmg = Math.max(1, Math.floor(p.attack * typeBonus * (1 - reduction) * (1 + dmgPct / 100)))
    // 暴击
    let crit = false
    if (Math.random() < p.critChance) {
      dmg *= 2
      crit = true
    }
    // 初代食神阶段加成（对手防御下降→换为攻击上升）
    if (o.mechanic?.phases && this.bossPhase > 1) {
      // 阶段体现在对手攻击上（opponentAttack 中处理），此处略
    }
    // 有效伤害（用于「按伤害给经验」的口径）：溢出部分不计
    const effDmg = Math.min(dmg, this.opponentHp)
    this.damageDealt = (this.damageDealt ?? 0) + effDmg
    this.opponentHp = Math.max(0, this.opponentHp - dmg)
    getSkillInstance(this.styleSkillId)?.addXp(hitXpFor(this.player.combatLevel)) // 每次命中（基准 4；开局爬坡见 combatXpCurve）
    this.logLine(`${crit ? '💥 暴击！' : '⚔️'} 对 ${o.name} 造成 ${dmg} 伤害${advantage ? '（克制 +15%）' : ''}`)

    // 战斗深度 v1：命中后按风格尝试给敌人挂状态（对手已被打死则不挂 —— 否则日志会出现「先击杀再挂状态」）
    if (COMBAT_DEPTH_V1 && this.opponentHp > 0) this.tryApplyStatus(o)

    // 面条之王：每 5 回合降攻速
    if (o.mechanic?.slowEvery && this.turnCount % o.mechanic.slowEvery === 0) {
      this.slowTurns = 3
      this.logLine('🍜 面之束缚：你的攻速降低了！', 'warn')
    }
    // 中华一番：奥义·发光料理 秒杀（概率与伤害随 BOSS 等级上升）
    if (o.mechanic?.instantKill && this.turnCount % 12 === 0 && Math.random() < Math.min(0.5, 0.15 + o.level * 0.003)) {
      const dmg2 = Math.floor(this.player.combat.hp * Math.min(0.8, 0.3 + o.level * 0.005))
      this.logLine('✨ 中华一番发动奥义·发光料理！', 'warn')
      this.damagePlayer(dmg2, `被秒杀招式命中 ${dmg2}`)
    }

    if (this.opponentHp <= 0) {
      this.win()
      return
    }
    // 初代食神阶段判定
    if (o.mechanic?.phases) {
      const ratio = this.opponentHp / o.hp
      if (ratio < 0.33 && this.bossPhase < 3) {
        this.bossPhase = 3
        this.logLine('👑 初代食神进入第三阶段！', 'warn')
      } else if (ratio < 0.66 && this.bossPhase < 2) {
        this.bossPhase = 2
        this.logLine('👑 初代食神进入第二阶段！', 'warn')
      }
    }
  }

  opponentAttack(o) {
    const p = this.playerStats()
    let hitChance = o.acc / (o.acc + p.evasion)
    if (Math.random() > hitChance) {
      this.logLine('🛡️ 你闪避了对方的攻击！', 'dim')
      return
    }
    // 对手阶段攻击加成
    let atk = o.atk
    if (o.mechanic?.phases) atk *= this.bossPhase * 0.4 + 0.6 // 阶段1:1.0 阶段2:1.4 阶段3:1.8
    // 对手克制玩家
    const advantage = STYLE_ADVANTAGE[this.oppStyle] === this.styleId
    const defensePct = p.damageTakenPct ?? 0 // 与属性面板「受击减免」同一来源
    let dmg = Math.max(1, Math.floor(atk * (advantage ? 1.15 : 1) * (1 - p.defense / (p.defense + 100)) * (1 - defensePct / 100)))
    let crit = false
    if (Math.random() < o.crit) {
      dmg *= 2
      crit = true
    }
    // 火锅真君：施加灼烧（伤害值与结算同源：`o.level * 0.5`，把数字写进日志，别再让玩家猜）
    if (o.mechanic?.burn && Math.random() < 0.5) {
      this.burnTurns = 3
      this.logLine(`🔥 火锅真君：你被灼烧了（每回合损失 ${Math.max(1, Math.floor(o.level * 0.5))} 生命值）！`, 'warn')
    }
    // 黑暗料理王：施加中毒
    if (o.mechanic?.poison && Math.random() < 0.5) {
      this.poisonTurns = 3
      this.logLine('☠️ 黑暗料理王：你中毒了（治疗效果减半）！', 'warn')
    }
    // 越级重击（战斗深度 v1 第 ④ 件，2026-09-26）：按**等级差**派生 —— 同等级恒为 0
    //   ⇒ 同等级战斗一个字节不变；只有「越级」才有被一击打残/秒的风险（Melvor 的「最大伤害」逻辑）
    //   冷却：一次重击后本场不再触发（避免连续两次直接秒杀，玩家至少能退）
    //   ⚠️ `hch > 0` 短路不可省：先掷再判会**白吃一个 Math.random()**，把后面的命中/暴击随机序列整体
    //    挪一位 ⇒ 「同等级零影响」就只剩概率上的零影响、不再逐次一致（实测 p10/p90 会漂 ~0.2s）
    const hch = heavyChance(o.level, this.player.combatLevel)
    if (!this.heavyFired && hch > 0 && Math.random() < hch) {
      const hd = heavyDamage(p.maxHp, o.level, this.player.combatLevel, defensePct)
      if (hd > 0) {
        this.heavyFired = true
        this.logLine(`💢 ${o.name} 越级重击！（${Math.round(heavyPct(o.level, this.player.combatLevel) * 100)}% 你的血量上限 · 本场只触发一次）`, 'warn')
        this.damagePlayer(hd, '💢 越级重击')
        if (!this.inFight) return
        getSkillInstance('heatControl')?.addXp(hitXpFor(this.player.combatLevel))
        getSkillInstance('tasteAcumen')?.addXp(Math.max(1, Math.round(hitXpFor(this.player.combatLevel) / 2)))
        return // 本回合不再叠加普通伤害（重击就是这一回合的那一下）
      }
    }
    this.damagePlayer(dmg, `${crit ? '💥 对方暴击！' : '🩸'} 受到 ${dmg} 伤害`)
    getSkillInstance('heatControl')?.addXp(hitXpFor(this.player.combatLevel)) // 每次受击（基准 4，与命中对齐）
    getSkillInstance('tasteAcumen')?.addXp(Math.max(1, Math.round(hitXpFor(this.player.combatLevel) / 2))) // 品鉴力：受击的一半（Melvor 式）
  }

  damagePlayer(dmg, label) {
    const old = this.player.combat.hp
    const hp = Math.max(0, old - dmg)
    this.player.setCombat({ hp })
    this.logLine(`${label}（生命值 ${old} → ${hp}）`)
    if (hp <= 0) this.lose()
  }

  // ── 战斗深度 v1：玩家 → 敌人的状态（2026-09-26）────────────────────────────
  // 此前敌人**不吃任何状态**（7 条状态全打在玩家身上）⇒ 战斗只有单方面挨打。现在三种风格各带一个状态。

  /** 敌人身上的状态剩余回合（界面读它画徽章） */
  enemyStatusLeft() {
    return { ...this.enemyStatus }
  }

  /** 敌人当前的**有效防御**（破防后下降）。引擎与界面读同一个出口，避免「卡片写 90 防、打起来按 72 算」 */
  enemyDef() {
    const base = this.opponent?.def ?? 0
    return COMBAT_DEPTH_V1 && this.enemyStatus.dBreak > 0 ? brokenDef(base) : base
  }

  /** 对敌人造成伤害（DoT 与普攻共用；保持「按伤害给经验」的口径 —— DoT 伤害也算 `damageDealt`） */
  damageEnemy(dmg, label) {
    if (!this.opponent || this.opponentHp <= 0) return
    const effDmg = Math.min(dmg, this.opponentHp)
    this.damageDealt = (this.damageDealt ?? 0) + effDmg
    this.opponentHp = Math.max(0, this.opponentHp - dmg)
    this.logLine(`${label}（对手生命值 ${this.opponentHp + effDmg} → ${this.opponentHp}）`)
    if (this.opponentHp <= 0) this.win()
  }

  /** 每回合结算敌人身上的状态（先扣回合数、再算 DoT；重复施加是**刷新回合数**而不是叠加） */
  settleEnemyStatus() {
    if (!COMBAT_DEPTH_V1 || !this.enemyStatus) return
    const p = this.playerStats()
    for (const id of ['bleed', 'burn']) {
      if (this.enemyStatus[id] > 0) {
        this.enemyStatus[id]--
        const dmg = dotDamage(p.attack)
        this.damageEnemy(dmg, `${STATUS_INFO[id].icon} ${STATUS_INFO[id].name}`)
        if (!this.inFight) return
      }
    }
    if (this.enemyStatus.dBreak > 0) this.enemyStatus.dBreak--
  }

  /**
   * 命中后按当前风格尝试施加状态（战斗深度 v1 的 ②③）
   * 触发率 = `statusTriggerChance()`（已含敌人抗性：被克方减半 / 首领免疫）
   * @returns {boolean} 是否施加成功（守卫与统计用）
   */
  tryApplyStatus(o) {
    if (!COMBAT_DEPTH_V1) return false
    const statusId = STYLE_STATUS[this.styleId]
    if (!statusId) return false
    const p = statusTriggerChance(this.styleLevel, o, this.styleId)
    if (p <= 0 || Math.random() >= p) return false
    this.enemyStatus[statusId] = STATUS_TURNS // 刷新而不是叠加（避免高频攻击把 DoT 叠成无限）
    this.statusApplied++
    const info = STATUS_INFO[statusId]
    const extra = statusId === 'dBreak' ? `（对手防御 ${o.def} → ${this.enemyDef()}）` : `（每回合 ${dotDamage(this.playerStats().attack)}）`
    this.logLine(`${info.icon} 施加「${info.name}」给 ${o.name}${extra}`, 'warn')
    return true
  }

  /** 胜利：金币 + 技能经验 + 掉落（§4.4） */
  win() {
    this.inFight = false
    this.result = 'win'
    const o = this.opponent
    const gold = 5 + o.level * 3
    this.player.gainGold(gold)
    // 🔴 击杀经验（2026-09-22 口径改为**按造成的伤害**，见 `data/combatXpCurve.js`）：
    //    旧口径「按击杀、按等级固定给」使「给敌人加血」= 直接砍每小时经验；
    //    新口径 `min(有效伤害, 怪物血量, 期望血量×2) × k(等级)` 保证
    //    ① 同等级打赢一场的 XP 与改前**一模一样**（成长标定不动）；
    //    ② 血量翻倍 ⇒ 打出的伤害翻倍 ⇒ 经验跟着翻倍（所以 (c) 加血不亏经验）；
    //    ③ 溢出伤害与「自杀式刷级」都不占便宜（败场仍按 30%）。
    const xpEach = combatXpPerSkill(o.level, this.damageDealt, o.hp, true, this.player.combatLevel)
    getSkillInstance(this.styleSkillId)?.addXp(xpEach)
    getSkillInstance('tasteAcumen')?.addXp(xpEach)
    getSkillInstance('heatControl')?.addXp(xpEach)
    const xpStyle = xpEach
    const xpTaste = xpEach
    const xpHeat = xpEach
    // 击杀后的重生间隔（(b)：只惩罚一击秒杀，长战斗几乎无感）
    this.respawnUntil = performance.now() + tunerOver('respawnSec', COMBAT_RESPAWN_SEC, 0, 10) * 1000
    const drops = []
    for (const d of o.drops ?? []) {
      // 概率走全局难度系数（÷5，下限 1%）；`DropList.vue` 显示的是**同一个函数**的结果，两边不会差
      if (Math.random() < dropChance(d.chance)) {
        const qty = d.qty ?? 1
        this.player.gainItem(d.itemId, qty)
        drops.push({ itemId: d.itemId, qty })
      }
    }
    // 困难模式首杀额外奖励（2026-09-06；不纳入正常 BOSS 记录/成就口径）
    if (o.isHard) {
      const baseName = o.name.replace(/·困难$/, '')
      const list = this.player.stats.hardBosses ?? []
      if (!list.includes(baseName)) {
        this.player.stats.hardBosses = [...list, baseName]
        const hg = 50 + o.level * 10
        this.player.gainGold(hg)
        this.logLine(`👑 困难模式首杀「${baseName}」！额外 +${hg} 金币`, 'win')
      }
    }
    this.player.onCombatWin?.({ name: o.name, level: o.level, isBoss: !!o.isBoss })
    const dropText = drops.length ? '，掉落：' + drops.map((d) => `${itemName(d.itemId)} ×${d.qty}`).join('、') : ''
    const xpText = `，经验：${STYLE_INFO[this.styleId].name} +${xpStyle}、品鉴力 +${xpTaste}、火候 +${xpHeat}`
    this.logLine(`🏆 胜利！获得 ${gold} 金币${xpText}${dropText}`, 'win')
    // hpLeft 必须是「当前剩余品鉴值」：早期误写成不存在的 this.playerHp（undefined），
    // 使依赖血量百分比的厨神试炼「无伤试炼」恒判 NaN → 永不通过
    EventBus.emit('combat:end', { result: 'win', opponent: o.name, gold, drops, isBoss: !!o.isBoss, turns: this.turnCount, hpLeft: this.player.combat.hp, hpMax: this.playerStats().maxHp, oppLevel: o.level })
  }

  /** 失败：随机丢失一件已装备装备（§4.1 非硬核），品鉴值恢复 */
  lose() {
    this.inFight = false
    this.result = 'lose'
    // 败场经验：同样按**造成的伤害**算、系数 30%（保留原设计：打了一半也有收获，
    // 但不鼓励「自杀式刷级」——没打完就打折，且败场在区域/首领里还要掉装备）
    const o = this.opponent
    if (o) {
      const lostXp = combatXpPerSkill(o.level, this.damageDealt, o.hp, false, this.player.combatLevel)
      getSkillInstance(this.styleSkillId)?.addXp(lostXp)
      getSkillInstance('tasteAcumen')?.addXp(lostXp)
      getSkillInstance('heatControl')?.addXp(lostXp)
    }
    const slots = Object.keys(this.player.equipment).filter((s) => this.player.equipment[s])
    let lost = null
    // 🔴 2026-09-19：**可无限重复刷的 PvE 不再夺走装备**（挑战塔 / 食神秘境）。
    // 原因（实测）：夺走装备 + 无限刷 = **死亡螺旋** —— 输一场掉一件装备，而强化/词条/宝石是按**装备 id** 记的，
    // 一掉就全部失效 → 属性阶梯下滑 → 更容易输 → 再掉。塔里实测同一层因此给出 100%/76%/38%/0% 四种结果。
    // 现改为：塔/秘境战败只**清空品鉴点**（奥义随之熄灭，张力仍在），区域对决 / 首领 / 竞技场保留原惩罚。
    const repeatable = !!(this.opponent?.isTower || this.opponent?.isRealm)
    if (slots.length && !repeatable) {
      const slot = slots[Math.floor(Math.random() * slots.length)]
      lost = this.player.equipment[slot]
      this.player.unequip(slot, { destroy: true }) // 物品被夺走：就地销毁，不回背包（否则背包满时会转投信箱，可从信箱找回）
    } else if (repeatable) {
      this.player.setCombat({ flavorEnergy: 0 })
      this.player.tastePoints = 0 // 品鉴点清空 → 已激活的奥义随下一帧 drainAoji 全部熄灭
    }
    this.player.setCombat({ hp: this.player.maxHp })
    this.player.onCombatLose?.() // 败场统计（§13）
    this.logLine(
      `💀 你被打败了……${lost ? `失去了 ${itemName(lost)}` : (repeatable ? '（塔/秘境不夺装备，但品鉴点清空）' : '')}（品鉴值已恢复）`,
      'lose',
    )
    // 硬核模式（§4.1/§8.2）：死亡即删档（由 bootstrap 处理）
    if (this.player.hardcore) {
      EventBus.emit('hardcore:death', {})
      this.logLine('☠️ 硬核模式：死亡即删档！', 'lose')
    }
    EventBus.emit('combat:end', { result: 'lose', opponent: this.opponent.name, lost, turns: this.turnCount, hpLeft: 0, hpMax: this.playerStats().maxHp, oppLevel: this.opponent.level })
  }

  /** 使用料理：回血 + 持续回血（§4.5，冷却 3 回合） */
  useFood(itemId, silent = false) {
    const item = getItem(itemId)
    if (!item?.heal) return false
    // 手动（silent=false）受 3 回合料理冷却；自动进食（silent=true）不受限，按血量阈值即时补血
    if (this.foodCooldown > 0 && !silent) {
      this.logLine(`🍽️ 料理冷却中（剩 ${this.foodCooldown} 回合）`, 'warn')
      return false
    }
    if (!this.player.spendItem(itemId, 1)) return false
    if (!silent) this.foodCooldown = FOOD_COOLDOWN_TURNS
    let heal = item.heal
    if (this.poisonTurns > 0) heal = Math.floor(heal / 2)
    // 奥义「盛宴之主」：料理回血 +50%（§3.4.1）
    const healPct = this.player.gastronomyEffects?.()?.healPct ?? 0
    if (healPct > 0) heal = Math.floor(heal * (1 + healPct / 100))
    // 菜系研究（2026-09-10）：该学派料理回血加成
    const schoolPct = this.player.schoolHealPct?.(item.category) ?? 0
    if (schoolPct > 0) heal = Math.floor(heal * (1 + schoolPct / 100))
    // 食神信仰：灶君料理回血（2026-09-10）
    const patronHealPct = this.player.patronEffects?.()?.healPct ?? 0
    if (patronHealPct > 0) heal = Math.floor(heal * (1 + patronHealPct / 100))
    const old = this.player.combat.hp
    const newHp = Math.min(this.player.maxHp, old + heal)
    this.player.setCombat({ hp: newHp })
    if (item.regen) {
      this.regenTurns = item.regen.turns
      this.regenPerTurn = item.regen.perTurn
    }
    this.logLine(`🍽️ 食用 ${item.name}：+${newHp - old} 生命值${item.regen ? '（持续回血）' : ''}`)
    return true
  }

  /** 使用酱料：10 回合属性增益（§4.5） */
  useSauce(itemId) {
    const item = getItem(itemId)
    if (!item?.buff) return false
    if (!this.player.spendItem(itemId, 1)) return false
    this.addBuff('item', item.buff, item.buff.duration ?? 10)
    this.logLine(`🌶️ 使用 ${item.name}：获得增益 ${item.buff.duration ?? 10} 回合`)
    return true
  }

  /** 使用饮品：果汁回血 / 茶饮恢复调味能量 / 酒类增益 + 醉酒（§3.2.4） */
  useDrink(itemId) {
    const item = getItem(itemId)
    if (!item || item.type !== 'drink') return false
    if (!this.player.spendItem(itemId, 1)) return false
    if (item.heal) {
      const old = this.player.combat.hp
      const newHp = Math.min(this.player.maxHp, old + item.heal)
      this.player.setCombat({ hp: newHp })
      this.logLine(`🥤 饮用 ${item.name}：+${newHp - old} 生命值`)
    } else if (item.flavorEnergy) {
      this.player.setCombat({ flavorEnergy: Math.min(FLAVOR_MAX, this.player.combat.flavorEnergy + item.flavorEnergy) })
      this.logLine(`🍵 饮用 ${item.name}：+${item.flavorEnergy} 调味能量`)
    }
    if (item.buff) {
      this.addBuff('item', item.buff, item.buff.duration ?? 8)
      this.logLine(`🍷 ${item.name} 提供增益 ${item.buff.duration ?? 8} 回合`)
    }
    if (item.drunk) {
      this.drunkTurns = DRUNK_TURNS
      this.logLine(`🥴 醉意上头：命中率下降 15%（${DRUNK_TURNS} 回合）`, 'warn')
    }
    return true
  }

  /** 能量饼干：战斗内「能量补给」（2026-09-10 新增第二用途）
   *  回品鉴值 + 数回合精力充沛（命中/攻速）；自身冷却，与料理冷却互不影响。
   *  不封顶（可反复使用，靠冷却控制节奏）——给离线时长封顶后溢出的饼干一个出口。 */
  useEnergyBiscuit() {
    if ((this.player.inventory.energyBiscuit ?? 0) < 1) return false
    if (this.biscuitCooldown > 0) {
      this.logLine(`🍪 能量饼干冷却中（剩 ${this.biscuitCooldown} 回合）`, 'warn')
      return false
    }
    const p = this.playerStats()
    this.player.spendItem('energyBiscuit', 1)
    const heal = Math.floor(p.maxHp * BISCUIT_HEAL_PCT)
    const before = this.player.combat.hp
    const after = Math.min(p.maxHp, before + heal)
    this.player.setCombat({ hp: after })
    // 命中/攻速走**饼干自己的计时**（`biscuitTurns`）：不和酱料/饮品共用 buffTurns，
    // 于是「先喝 10 回合的酒再吃饼干」不会把饼干加成拉长到 10 回合（2026-09-22 修）。
    this.addBuff('biscuit', { accuracy: BISCUIT_ACC }, BISCUIT_BUFF_TURNS)
    this.biscuitSpeedPct = BISCUIT_SPEED_PCT
    this.biscuitCooldown = BISCUIT_COOLDOWN_TURNS
    this.player.stats.biscuitsUsed = (this.player.stats.biscuitsUsed ?? 0) + 1
    this.logLine(`🍪 能量补给：回复 ${after - before} 品鉴值，命中 +${BISCUIT_ACC}、攻速 +${BISCUIT_SPEED_PCT}%${p.speedAtCap ? '（⚠️ 已到攻速上限，攻速部分无效果）' : ''}（${BISCUIT_BUFF_TURNS} 回合）`)
    EventBus.emit('combat:biscuit', { heal: after - before })
    return true
  }

  /** 神秘调料：随机效果（§3.2.5） */
  useMysterySpice() {
    if ((this.player.inventory.mysterySpice ?? 0) < 1) return false
    this.player.spendItem('mysterySpice', 1)
    const 增益 = MYSTERY_BUFFS[Math.floor(Math.random() * MYSTERY_BUFFS.length)]
    this.addBuff('item', 增益, 10)
    // 用中文显示随机增益（数值不变，只改提示文案）
    const LABEL = { atk: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', speed: '攻速' }
    const gainText = Object.entries(增益).map(([k, v]) => `${LABEL[k] ?? k} +${(k === 'critChance' ? Math.round(v * 100) : v)}`).join('、')
    this.logLine(`🪄 神秘调料生效：随机增益 ${gainText}（10 回合）`)
    return true
  }
}
