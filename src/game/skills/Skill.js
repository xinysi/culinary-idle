// 技能基类 — 需求文档 §3：等级 / 经验 / 专精
// 等级上限 100，转生后突破至 120（§3）
// 经验加成来源（乘法叠加）：食灵（§3.3.6）→ 奥义（§3.4.1）→ 转生加成（每层 +20%）→ 增益剂（§3.4.2）
// 设计：level / exp / mastery 一律从 player store 读取（store 是唯一数据源），
// 实例自身只保留运行时状态（actionsDone、timerMs 等，不持久化）。

import { EventBus } from '../core/EventBus.js'
import { getSkillDef } from '../data/skills.js'

export const MAX_LEVEL = 100
export const PRESTIGE_MAX_LEVEL = 120
const PRESTIGE_XP_BONUS = 0.2 // 每次转生 +20% 经验（2026-09 调高：100→120 曲线偏肝，提升转生收益）
// 数值平衡：卡片经验统一缩放系数。采集目标/制作配方/作物等「卡片」给予的经验统一放大，
// 以匹配新的经验曲线（99→100 = 3亿），保持各卡片相对差异、不逐条改数据。
// CARD_XP_SCALE = 60 时，单技能挂机满级约 9 天（接受精通间隔/双倍加成后约 7~8 天）。
export const CARD_XP_SCALE = 60

export class Skill {
  /**
   * @param {string} id 技能 id（对应 data/skills.js）
   * @param {object} player Pinia player store 实例（仅通过其 action 读写状态，避免循环依赖）
   */
  constructor(id, player) {
    this.id = id
    this.player = player
    this.def = getSkillDef(id)
  }

  get level() {
    return this.player.skills[this.id]?.level ?? 1
  }

  get exp() {
    return this.player.skills[this.id]?.exp ?? 0
  }

  get mastery() {
    return this.player.skills[this.id]?.mastery ?? {}
  }

  get category() {
    return this.def.category
  }

  /** 转生层数（§3：每层 +20% 经验，解锁 120 级） */
  get prestiges() {
    return this.player.skills[this.id]?.prestiges ?? 0
  }

  /** 当前等级上限：转生过 → 120，否则 99 */
  get maxLevel() {
    return this.prestiges > 0 ? PRESTIGE_MAX_LEVEL : MAX_LEVEL
  }

  /** 加卡片经验：采集/制作/作物等「卡片」给予的经验，统一乘以 CARD_XP_SCALE 后走 addXp；
   *  mult 为卡片精通经验倍数（默认 1），作为 addXp 的独立成长线传入（与设置倍率取较大、不叠加）。 */
  addCardXp(base, mult = 1) {
    if (!(base > 0)) return 0
    return this.addXp(base * CARD_XP_SCALE, mult > 0 ? mult : 1)
  }

  /** 加经验：应用全部加成后处理升级，写回玩家状态
   *  mult：卡片精通经验倍数（2026-09 独立成长线）——与『设置经验倍率』取较大、不叠乘（设置倍率只作用于非精通部分） */
  addXp(amount, mult = 1) {
    if (!(amount > 0)) return 0
    const prevExp = Math.floor(this.exp)

    // 食灵经验加成（%）
    const spiritPct = this.player.spiritEffects?.()?.xpPct?.[this.id] ?? 0
    // 奥义「海量知识」全经验加成（%）
    const aojiPct = this.player.gastronomyEffects?.()?.xpPct ?? 0
    // 公会被动经验加成（§13）
    const guildPct = this.player.guildEffects?.()?.xpPct?.[this.id] ?? 0
    // 转生加成（每层 +20%）
    const prestigeMult = 1 + this.prestiges * PRESTIGE_XP_BONUS
    // 增益剂经验倍率（§3.4.2）
    const tonicMult = this.player.getXpMultiplier?.() ?? 1
    // 设置里的全局经验倍率（设置面板：1/10/50/100/250/500/1000）
    const settingsMult = this.player.settings?.xpMultiplier ?? 1
    // 设置倍率与精通倍数不叠加：取较大（精通独立成长线，设置倍率只作用于非精通部分）
    const growthMult = Math.max(settingsMult, mult > 0 ? mult : 1)
    // 对决类技能高级加速（平衡：RS 曲线 60+ 过陡，战斗经验 +4%/级，仅对决类；
    // 2026-09-06 曲线修正：起点 75→60，与获胜经验分段倍率（60 级档 ×1.5 起）衔接，中段不再断崖）
    const catchup = this.def.category === 'combat' ? 1 + Math.max(0, this.level - 60) * 0.04 : 1
    // 夜市狂潮（2026-09-06）：12-20 点对决类经验 ×1.5
    const marketMult = this.def.category === 'combat' ? (this.player.marketBoost?.() ?? { combatXp: 1 }).combatXp : 1

    let exp = this.exp + amount * (1 + spiritPct / 100 + aojiPct / 100 + guildPct / 100) * prestigeMult * tonicMult * growthMult * catchup * marketMult
    let level = this.level
    let leveled = false
    while (level < this.maxLevel && exp >= this.player.xpTotalForLevel(level + 1)) {
      level++
      leveled = true
    }
    // 满级后钳制经验（§3：等级上限处的经验不继续累积）
    if (level >= this.maxLevel) exp = Math.min(exp, this.player.xpTotalForLevel(this.maxLevel))
    if (leveled) {
      EventBus.emit('player:levelup', { skillId: this.id, level })
    }
    this.player.setSkillState(this.id, { level, exp: Math.floor(exp) })
    return Math.floor(exp) - prevExp
  }

  /** 每帧推进（毫秒）。子类按需覆盖 */
  tick(deltaMs) {}
}
