// 料理对决引擎 — 需求文档 §4
// 自动回合制（基础 2.4s/回合，§4.1）；属性面板见 §4.2；克制三角 +15%（§3.3/§11.2）
// 道具：食物回血（3 回合冷却，§4.5）、酱料增益 10 回合、饮品 增益（酒类有醉酒 负面效果）
// 失败惩罚：随机丢失一件已装备装备（非硬核模式，§4.1）

import { STYLE_INFO, STYLE_ADVANTAGE } from '../data/combat.js'
import { getItem, itemName } from '../data/items.js'
import { getSkillInstance } from '../skills/registry.js'
import { EventBus } from '../core/EventBus.js'

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

// 获胜经验分段倍率（2026-09-06 曲线修正）：经验产出 O(L²) 跟不上经验需求 2^(L/7) 指数，
// 后期（60+）按对手等级逐段补强，使 ×1 基准下 99 级从 ~6600 小时压到 ~700 小时量级：
// L≤40 维持原速率（前期体验不动），40 之后每 10 级档位递进。
function winXpBoost(level) {
  if (level <= 40) return 1
  if (level <= 50) return 1.1
  if (level <= 60) return 1.5
  if (level <= 70) return 2.2
  if (level <= 80) return 3.5
  if (level <= 90) return 6
  if (level <= 99) return 9
  return 12
}

let instance = null
export function setCombatInstance(c) {
  instance = c
}
export function getCombat() {
  return instance
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
    this.result = null // win | lose
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

  /** 玩家实时属性（§4.2） */
  playerStats() {
    const eq = this.player.equippedStats
    const sl = this.styleLevel
    const heat = this.player.skills.heatControl?.level ?? 1
    const drunkPenalty = this.drunkTurns > 0 ? 0.15 : 0
    const gEff = this.player.gastronomyEffects?.() ?? {}
    const speedPct = Number(gEff.speedPct) || 0
    const speedBonus = Number(eq.speedBonus) || 0
    const baseSpeed = Math.max(1.2, (2.4 - sl * 0.02 - speedBonus) * (1 - speedPct / 100))
    return {
      hp: this.player.combat.hp,
      maxHp: this.player.maxHp,
      attack: sl * 3 + eq.attack + this.buffs.atk,
      accuracy: Math.max(1, Math.floor((10 + sl + eq.accuracy + this.buffs.accuracy) * (1 - drunkPenalty))),
      defense: heat + eq.defense + this.buffs.defense,
      evasion: Math.floor(5 + heat * 0.5 + eq.evasion + this.buffs.evasion),
      critChance: Math.min(0.05 + (Number(eq.critChance) || 0) + this.buffs.critChance, 0.8),
      speedMs: Math.floor(baseSpeed * 1000 * (this.slowTurns > 0 ? 1.5 : 1)),
      flavorEnergy: this.player.combat.flavorEnergy,
    }
  }

  logLine(text, kind = 'info') {
    this.log.push({ text, kind, turn: this.turnCount })
    if (this.log.length > 80) this.log.shift()
  }

  start(opponent) {
    this.opponent = opponent
    this.opponentHp = opponent.hp
    this.oppStyle = opponent.style
    this.bossPhase = 1
    this.inFight = true
    this.turnTimer = 0
    this.turnStartAt = performance.now() // 本回合起点（绝对时间戳，战斗进度条 rAF 用）
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
    this.result = null
    this.logLine(`⚔️ 对决开始：${opponent.name}（等级 ${opponent.level}，${opponent.styleName}）`)
    EventBus.emit('combat:start', { opponent: opponent.name })
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
    if (this.buffTurns > 0) {
      this.buffTurns--
      if (this.buffTurns === 0) this.buffs = { atk: 0, accuracy: 0, defense: 0, evasion: 0, critChance: 0 }
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

    // 甜品女王：每回合回血
    if (o.mechanic?.regen && this.opponentHp > 0) {
      const heal = Math.max(1, Math.floor(o.level * 0.35))
      this.opponentHp = Math.min(o.hp, this.opponentHp + heal)
      this.logLine('🍰 甜品女王恢复 ' + heal + ' 生命值', 'dim')
    }

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
    // 选背包中回血最高的料理
    let best = null
    for (const [id, qty] of Object.entries(this.player.inventory)) {
      if (qty <= 0) continue
      const item = getItem(id)
      if (item?.type === 'food' && item.heal && (!best || item.heal > best.heal)) best = item
    }
    if (best) this.useFood(best.id, true)
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
    const reduction = o.def / (o.def + 100)
    // 伤害加成：食灵（§3.3.6 dmgPct/styleDmgPct）+ 奥义（§3.4.1 dmgPct/styleDmgPct）
    const seff = this.player.spiritEffects?.() ?? {}
    const gEff = this.player.gastronomyEffects?.() ?? {}
    const dmgPct = (seff.dmgPct ?? 0) + (gEff.dmgPct ?? 0) + (seff.styleDmgPct?.[style] ?? 0) + (gEff.styleDmgPct?.[style] ?? 0) + ((this.player.guildEffects?.() ?? {}).dmgPct ?? 0)
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
    this.opponentHp = Math.max(0, this.opponentHp - dmg)
    getSkillInstance(this.styleSkillId)?.addXp(4) // 每次命中 +4（与受击经验对齐）
    this.logLine(`${crit ? '💥 暴击！' : '⚔️'} 对 ${o.name} 造成 ${dmg} 伤害${advantage ? '（克制 +15%）' : ''}`)

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
    const gEff = this.player.gastronomyEffects?.() ?? {}
    const defensePct = gEff.defensePct ?? 0
    let dmg = Math.max(1, Math.floor(atk * (advantage ? 1.15 : 1) * (1 - p.defense / (p.defense + 100)) * (1 - defensePct / 100)))
    let crit = false
    if (Math.random() < o.crit) {
      dmg *= 2
      crit = true
    }
    // 火锅真君：施加灼烧
    if (o.mechanic?.burn && Math.random() < 0.5) {
      this.burnTurns = 3
      this.logLine('🔥 火锅真君：你被灼烧了（每回合损失 生命值）！', 'warn')
    }
    // 黑暗料理王：施加中毒
    if (o.mechanic?.poison && Math.random() < 0.5) {
      this.poisonTurns = 3
      this.logLine('☠️ 黑暗料理王：你中毒了（治疗效果减半）！', 'warn')
    }
    this.damagePlayer(dmg, `${crit ? '💥 对方暴击！' : '🩸'} 受到 ${dmg} 伤害`)
    getSkillInstance('heatControl')?.addXp(4) // 每次受击 +4（防御经验，与命中对齐）
    getSkillInstance('tasteAcumen')?.addXp(2) // 品鉴力：每次受击 +2（生命值 经验，Melvor 式）
  }

  damagePlayer(dmg, label) {
    const old = this.player.combat.hp
    const hp = Math.max(0, old - dmg)
    this.player.setCombat({ hp })
    this.logLine(`${label}（生命值 ${old} → ${hp}）`)
    if (hp <= 0) this.lose()
  }

  /** 胜利：金币 + 技能经验 + 掉落（§4.4） */
  win() {
    this.inFight = false
    this.result = 'win'
    const o = this.opponent
    const gold = 5 + o.level * 3
    this.player.gainGold(gold)
    // 击杀经验（2026-09-06 曲线修正）：三技能系数拉齐为 0.25/0.25/0.25（总量仍为 0.75L²，
    // 消除“火候 0.2 系数拖慢对决等级”的隐性瓶颈），并按 winXpBoost 分段补强后期产出
    const boost = winXpBoost(o.level)
    const xpStyle = Math.floor((o.level * 9.7 + o.level * o.level * 0.25) * boost)
    const xpTaste = Math.floor((o.level * 9.7 + o.level * o.level * 0.25) * boost)
    const xpHeat = Math.floor((o.level * 9.7 + o.level * o.level * 0.25) * boost)
    getSkillInstance(this.styleSkillId)?.addXp(xpStyle)
    getSkillInstance('tasteAcumen')?.addXp(xpTaste)
    getSkillInstance('heatControl')?.addXp(xpHeat)
    const drops = []
    for (const d of o.drops ?? []) {
      if (Math.random() < d.chance) {
        const qty = d.qty ?? 1
        this.player.gainItem(d.itemId, qty)
        drops.push({ itemId: d.itemId, qty })
      }
    }
    this.player.onCombatWin?.({ name: o.name, level: o.level, isBoss: !!o.isBoss })
    const dropText = drops.length ? '，掉落：' + drops.map((d) => `${itemName(d.itemId)} ×${d.qty}`).join('、') : ''
    const xpText = `，经验：${STYLE_INFO[this.styleId].name} +${xpStyle}、品鉴力 +${xpTaste}、火候 +${xpHeat}`
    this.logLine(`🏆 胜利！获得 ${gold} 金币${xpText}${dropText}`, 'win')
    EventBus.emit('combat:end', { result: 'win', opponent: o.name, gold, drops, isBoss: !!o.isBoss })
  }

  /** 失败：随机丢失一件已装备装备（§4.1 非硬核），品鉴值恢复 */
  lose() {
    this.inFight = false
    this.result = 'lose'
    // 败场经验（2026-09-06 曲线修正）：获胜大额的 30%（鼓励挑战强敌与越级，
    // 不再是「输了一无所获」的全抛）
    const o = this.opponent
    if (o) {
      const boost = winXpBoost(o.level)
      const lostXp = Math.floor((o.level * 9.7 + o.level * o.level * 0.25) * boost * 0.3)
      getSkillInstance(this.styleSkillId)?.addXp(lostXp)
      getSkillInstance('tasteAcumen')?.addXp(lostXp)
      getSkillInstance('heatControl')?.addXp(lostXp)
    }
    const slots = Object.keys(this.player.equipment).filter((s) => this.player.equipment[s])
    let lost = null
    if (slots.length) {
      const slot = slots[Math.floor(Math.random() * slots.length)]
      lost = this.player.equipment[slot]
      this.player.unequip(slot)
      this.player.spendItem(lost, 1) // 物品被夺走（不返还）
    }
    this.player.setCombat({ hp: this.player.maxHp })
    this.player.onCombatLose?.() // 败场统计（§13）
    this.logLine(`💀 你被打败了……${lost ? `失去了 ${itemName(lost)}` : ''}（品鉴值已恢复）`, 'lose')
    // 硬核模式（§4.1/§8.2）：死亡即删档（由 bootstrap 处理）
    if (this.player.hardcore) {
      EventBus.emit('hardcore:death', {})
      this.logLine('☠️ 硬核模式：死亡即删档！', 'lose')
    }
    EventBus.emit('combat:end', { result: 'lose', opponent: this.opponent.name, lost })
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
    for (const [k, v] of Object.entries(item.buff)) {
      if (k !== 'duration') this.buffs[k] = (this.buffs[k] ?? 0) + v
    }
    this.buffTurns = Math.max(this.buffTurns, item.buff.duration ?? 10)
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
      for (const [k, v] of Object.entries(item.buff)) {
        if (k !== 'duration') this.buffs[k] = (this.buffs[k] ?? 0) + v
      }
      this.buffTurns = Math.max(this.buffTurns, item.buff.duration ?? 8)
      this.logLine(`🍷 ${item.name} 提供增益 ${item.buff.duration ?? 8} 回合`)
    }
    if (item.drunk) {
      this.drunkTurns = DRUNK_TURNS
      this.logLine(`🥴 醉意上头：命中率下降 15%（${DRUNK_TURNS} 回合）`, 'warn')
    }
    return true
  }

  /** 神秘调料：随机效果（§3.2.5） */
  useMysterySpice() {
    if ((this.player.inventory.mysterySpice ?? 0) < 1) return false
    this.player.spendItem('mysterySpice', 1)
    const 增益 = MYSTERY_BUFFS[Math.floor(Math.random() * MYSTERY_BUFFS.length)]
    for (const [k, v] of Object.entries(增益)) this.buffs[k] = (this.buffs[k] ?? 0) + v
    this.buffTurns = Math.max(this.buffTurns, 10)
    // 用中文显示随机增益（数值不变，只改提示文案）
    const LABEL = { atk: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', speed: '攻速' }
    const gainText = Object.entries(增益).map(([k, v]) => `${LABEL[k] ?? k} +${(k === 'critChance' ? Math.round(v * 100) : v)}`).join('、')
    this.logLine(`🪄 神秘调料生效：随机增益 ${gainText}（10 回合）`)
    return true
  }
}
