// 技能基类 — 需求文档 §3：等级 / 经验 / 专精
// 等级上限 100，转生后突破至 120（§3）
// 经验加成来源：**加法层**（食灵/奥义/公会/图谱/米其林/荣誉/厨神之路/食神/精通池，各自 +0~17%）
// 与**乘法层**（转生 每层 +20% / 增益剂 / 卡片精通或设置倍率 取较大 / 对决补正 / 限时窗口）——
// 乘法层先相乘、再经 `dampXpStack` 统一阻尼（2026-09-21，见 core/growthRate.js）。
// 设计：level / exp / mastery 一律从 player store 读取（store 是唯一数据源），
// 实例自身只保留运行时状态（actionsDone、timerMs 等，不持久化）。

import { EventBus } from '../core/EventBus.js'
import { getSkillDef } from '../data/skills.js'
import { dampXpStack, targetLevelXpMult, isLowTarget } from '../core/growthRate.js'
import { tunerOver } from '../data/tuner.js'

export const MAX_LEVEL = 100
export const PRESTIGE_MAX_LEVEL = 120

/** 等级上限的**唯一口径**（2026-09-25 抽出）：转生过（prestiges>0）→ 120，否则 100。
 *  技能实例的 maxLevel getter、开发者面板「🩺 体检」的等级越界检查都从这里取，别各写一遍三元。 */
export function levelCapFor(prestiges = 0) {
  return prestiges > 0 ? PRESTIGE_MAX_LEVEL : MAX_LEVEL
}
// 导出供「效果总览」按同一口径展示（此前 activeEffects 里又硬写了一遍 0.2，属于两处真相）
export const PRESTIGE_XP_BONUS = 0.2 // 每次转生 +20% 经验（2026-09 调高：100→120 曲线偏肝，提升转生收益）
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

  /** 当前等级上限（口径在下面的 levelCapFor；转生过 → 120，否则 100） */
  get maxLevel() {
    return levelCapFor(this.prestiges)
  }

  /** 加卡片经验：采集/制作/作物等「卡片」给予的经验，统一乘以 CARD_XP_SCALE 后走 addXp；
   *  mult 为卡片精通经验倍数（默认 1），作为 addXp 的独立成长线传入（与设置倍率取较大、不叠加）。
   *  targetLevel 为该目标/配方的等级（`reqLevel`）——**低目标经验衰减的唯一接线点**（见 growthRate.js）。
   *  ⚠️ 精通池最高里程碑（95%）给该技能 +xpPct% 卡片经验，**必须加在这里**：
   *     在线（`award()` / `craft()`）与离线（`bootstrap.settleOffline` 的 `inst.addCardXp(r.exp, …)`）
   *     都走这一个出口 ⇒ 天然同源，不会出现「离线吃不到池加成」。 */
  addCardXp(base, mult = 1, targetLevel = null) {
    if (!(base > 0)) return 0
    // 夹 5%：池加成是全技能口径，不能因为新系统把标定过的升级时长整体位移
    const poolXpPct = Math.min(5, this.player.masteryPoolBonus?.(this.id)?.xpPct ?? 0)
    const b = poolXpPct > 0 ? base * (1 + poolXpPct / 100) : base
    // 低目标经验衰减（2026-09-22）：目标比「你能做到的最高档」低 5 级及以上 ⇒ 经验减半。
    // 乘在这里（而非让各调用点自己乘）⇒ 采集/制作/探索/农耕/副业/离线全部同源，且加成的日志数字
    // （返回的 expGained）与实际到账一致。规则与常数见 core/growthRate.js。
    const lowMult = targetLevelXpMult(this.level, targetLevel, this.topTargetLevel)
    return this.addXp(b * CARD_XP_SCALE * lowMult * tunerOver('cardXpScale', 1, 0.1, 10), mult > 0 ? mult : 1)
  }

  /** 该技能「最高可用目标/配方等级」——低目标衰减的参照系（`lowTargetRefLevel` 会与技能等级取小）。
   *  采集类读 `targets`、制作类（含副业）读 `recipes`、农耕读 `crops`；都没有的技能（对决类、食灵）
   *  退回技能等级。没有它的话，副业 96 级 / 转生后 100+ 会出现「所有目标都被判低目标」的退化。 */
  get topTargetLevel() {
    const list = this.targets ?? this.recipes ?? this.crops ?? null
    if (!Array.isArray(list) || !list.length) return this.level
    // 缓存：界面每张卡都要问一次（列表最多 365 条），不缓存就成了渲染热点（全表扫 × 卡片数）。
    // 键用「列表身份 + 条数」—— 只有列表真的换了/长了才重算（扩充模块会往 targets/recipes 追加）。
    const c = this._topLvCache
    if (c && c.list === list && c.n === list.length) return c.v
    let m = 0
    for (const x of list) {
      const lv = Number(x?.reqLevel)
      if (Number.isFinite(lv)) m = Math.max(m, lv)
    }
    const v = m > 0 ? m : this.level
    this._topLvCache = { list, n: list.length, v }
    return v
  }

  /** 界面用：这个目标/配方是否吃「低目标经验减半」（视图统一读它，别各自手写 0.5/5 —— 
   *  否则页面写着「满经验」而实际减半，正是本项目最忌的「显示与结算不一致」）。 */
  isLowTargetLevel(targetLevel) {
    return isLowTarget(this.level, targetLevel, this.topTargetLevel)
  }

  /** 加经验：应用全部加成后处理升级，写回玩家状态
   *  mult：卡片精通经验倍数（2026-09 独立成长线）——与『设置经验倍率』取较大、不叠乘（设置倍率只作用于非精通部分） */
  addXp(amount, mult = 1) {
    if (!(amount > 0)) return 0
    amount = amount * tunerOver('globalXp', 1, 0, 20) // 运营调参：全局经验倍率（会话内存，基线 1）
    const prevExp = Math.floor(this.exp)

    // 食灵经验加成（%）
    const spiritPct = this.player.spiritEffects?.()?.xpPct?.[this.id] ?? 0
    // 奥义「海量知识」全经验加成（%）
    const aojiPct = this.player.gastronomyEffects?.()?.xpPct ?? 0
    // 公会被动经验加成（§13）：辅助型公会写数值型 xpPct（全技能），其余公会写 { skillId: pct }
    const guildXp = this.player.guildEffects?.()?.xpPct
    const guildPct = typeof guildXp === 'number' ? guildXp : (guildXp?.[this.id] ?? 0)
    // 菜系图谱永久加成（2026-09-09）
    const insightPct = this.player.insightEffects?.()?.xpPct ?? 0
    // 米其林星级全技能经验加成（2026-09-10）
    const michelinPct = this.player.michelinXpPct?.() ?? 0
    // 荣誉殿堂（2026-09-10）：称号被动 + 荣誉等级
    const honorPct = this.player.honorState?.()?.perks?.xpPct ?? 0
    // 厨神之路（v2.0）：全技能 + 按类别的采集/制作加成
    const dao = this.player.daoEffects?.() ?? {}
    const daoPct = (dao.allXpPct ?? 0) + (this.def.category === 'gathering' ? (dao.gatherXpPct ?? 0) : 0) + (this.def.category === 'production' ? (dao.craftXpPct ?? 0) : 0)
    // 食神信仰（2026-09-10）：书神全技能 + 刀灵/猎神等定向技能
    const patronFx = this.player.patronEffects?.() ?? {}
    const patronPct = (patronFx.xpPct ?? 0) + (patronFx.xpSkills?.[this.id] ?? 0)
    // 转生加成（每层 +20%）
    const prestigeMult = 1 + this.prestiges * tunerOver('prestigeXpBonus', PRESTIGE_XP_BONUS, 0, 1)
    // 增益剂经验倍率（§3.4.2）
    const tonicMult = this.player.getXpMultiplier?.() ?? 1
    // 设置里的全局经验倍率（档位唯一口径在 caps.js 的 XP_MULTIPLIER_OPTIONS，现为 1/2/3/5）
    const settingsMult = this.player.settings?.xpMultiplier ?? 1
    // 设置倍率与精通倍数不叠加：取较大（精通独立成长线，设置倍率只作用于非精通部分）
    const growthMult = Math.max(settingsMult, mult > 0 ? mult : 1)
    // 对决类技能高级加速（平衡：RS 曲线 60+ 过陡，战斗经验 +4%/级，仅对决类；
    // 2026-09-06 曲线修正：起点 75→60，与获胜经验分段倍率（60 级档 ×1.5 起）衔接，中段不再断崖）
    const catchup = this.def.category === 'combat' ? 1 + Math.max(0, this.level - 60) * 0.04 : 1
    // 限时窗口活动（2026-09-06）：夜市/晨集/茶歇/午夜按技能类别乘区（可叠加聚合）
    const market = this.player.marketBoost?.() ?? {}
    const marketMult =
      this.def.category === 'combat' ? (market.combatXp ?? 1)
      : this.def.category === 'gathering' ? (market.gatherXp ?? 1)
      : this.def.category === 'production' ? (market.craftXp ?? 1)
      : 1

    // 乘法叠区（2026-09-21）：上面这几层**先相乘、再统一阻尼**（唯一出口 `dampXpStack`）。
    // 阻尼作用在乘积上而不是某一层上 ⇒ 各条阶梯（转生层数、增益剂档位）的档间差距一分不变、
    // 只是整体被压缩；低乘区几乎不动（×1.2 → ×1.15），只有乘区堆高时才明显（×13.5 → ×10.4）。
    // ⚠️ 别改成「逐层乘阻尼」——那等价于把每层的系数都调低，高档位就白做了（见 growthRate.js 的说明）。
    const expMult = dampXpStack(prestigeMult * tonicMult * growthMult * catchup * marketMult)

    let exp = this.exp + amount * (1 + spiritPct / 100 + aojiPct / 100 + guildPct / 100 + insightPct / 100 + michelinPct / 100 + patronPct / 100 + honorPct / 100 + daoPct / 100) * expMult
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
