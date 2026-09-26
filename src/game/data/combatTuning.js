// 战斗深度 v1（2026-09-26）—— 三件事的**唯一出口**；冻结数据（`combat.js` 的 248 个敌人）一字不改。
//
// 起因（用户「开始优化，改加新东西还是要加」之前的体检）：用真实引擎量了一遍，暴露三个结构性问题 ——
//   ① **命中/闪避不可堆**：玩家命中 = `10 + 技能等级 + 装备命中`（+1/级），而敌人闪避 = `4 + 1.5×等级`
//      ⇒ 命中率随等级**退化**（L1 70% → L120 45%），装备在 L120 只给 +22 命中，玩家**没有任何杆杆**。
//      后果实测：越级战里「命中率」是唯一瓶颈 —— +223% 的伤害加成只值 ×1.01（伤害早就够了，在等命中）。
//   ② **敌人不吃任何状态**：7 条状态（灼烧/中毒/束缚/醉酒/料理回血/道具增益/饼干）**全部只打在玩家身上**，
//      玩家对敌人**不能施加任何东西** ⇒ 战斗里没有「互动」，只有单方面挨打。
//   ③ **除风格三角外没有相性维度**：风格的唯一作用是 ±15% 伤害。
//
// 处置：全部走**读取点**，接口集中在本模块（与 `enemyScaling.js` / `difficulty.js` / `materialCost.js`
// 同一纪律）。想调某一条的强度只改本文件的常量；想整体回退把 `COMBAT_DEPTH_V1` 设 false。
import { STYLE_ADVANTAGE } from './combat.js'

/** 总开关（回退用）：false ⇒ 命中回到加法形态、不施加任何状态、不显示抗性 */
export const COMBAT_DEPTH_V1 = true

// ── ① 命中/闪避的「可堆」形态 ─────────────────────────────────────────────
// 形态：`(10 + 技能等级 + 平面加成) × (1 + min(装备命中, CAP) / ACC_GEAR_DIV)`
//   · 装备命中为 0 时**与旧公式逐值相等**（裸装/早期完全不变 ⇒ 不破坏既有标定）
//   · 装备命中越多乘区越大 ⇒ 「堆命中」第一次成为真实选择（顺带救活「命中」词条与命中类宝石）
//   · 平面加成（酱料 +攻/饼干 +8）留在括号内：它在所有等级都还有意义，不会被等级稀释成 0
// 🔴 **必须有上限**：装备命中是**加法属性**，而词条+宝石+强化把它堆到几百是常态
//    （实测：专堆命中时 `equippedStats.accuracy` 可达 ~450，而等级项只有 130）。
//    首版没有上限 ⇒ 堆满命中把命中率推到 **90%**（而旧加法形态同配置是 76%）—— 杠杆过头了。
//    封顶后：随手配装 ≈52% · 专堆命中 ≈74%（+22pp，有感但不失控）。
export const ACC_GEAR_DIV = 40
export const EVA_GEAR_DIV = 40
export const ACC_GEAR_CAP = 120
export const EVA_GEAR_CAP = 120

// ── ② 玩家 → 敌人的状态（风格三态）────────────────────────────────────────
// 风格既有「±15% 伤害」，再给每个风格一个**专属状态**（近战流血 / 远程破防 / 魔法灼烧，与流派语义一致）。
// ⚠️ 这是玩家第一次能对敌人施加东西 —— 此前 7 条状态全打在自己身上。
export const STYLE_STATUS = { knife: 'bleed', plating: 'dBreak', flavor: 'burn' }

export const STATUS_INFO = {
  bleed: { id: 'bleed', name: '割伤', icon: '🩸', kind: 'dot', desc: '每回合按你攻击力的一定比例掉血' },
  dBreak: { id: 'dBreak', name: '破防', icon: '🛡️', kind: 'debuff', desc: '防御力下降，你后续的攻击打得更疼' },
  burn: { id: 'burn', name: '灼烧', icon: '🔥', kind: 'dot', desc: '每回合按你攻击力的一定比例掉血' },
}

/** 触发率：基础 + 风格等级成长，封顶；再乘敌人的抗性（见 `statusTriggerChance`）
 *  ⚠️ 上限必须**在等级范围内真的咬得住**：`0.22 + 等级×0.0022` 在满级 120 时是 0.484
 *     ⇒ 上限取 0.45（约 L105 起封顶）。守卫有一条断言「满级触到上限」，防它又变成死代码。 */
export const STATUS_TRIGGER_BASE = 0.22
export const STATUS_TRIGGER_PER_LEVEL = 0.0022
export const STATUS_TRIGGER_MAX = 0.45
export const STATUS_TURNS = 3
/** 割伤/灼烧：每回合伤害 = 玩家攻击 × 该比例 */
export const DOT_PCT = 0.08
/** 破防：敌人防御 ×(1 − 该比例) */
export const BREAK_PCT = 0.2

// ── ③ 敌人抗性（相性维度）────────────────────────────────────────────────
// 规则：**被克制的一方，抵抗克制方的那个状态**。
//   `STYLE_ADVANTAGE = { knife: 'plating', plating: 'flavor', flavor: 'knife' }`（knife 克 plating）
//   ⇒ 摆盘流敌人抗「割伤」（刀工的状态）· 调味流抗「破防」（摆盘的状态）· 刀工流抗「灼烧」（调味的状态）。
// 为什么这样定：让「用克制风格」不再是唯一正解 —— 拿 +15% 伤害，代价是状态被抗；
//   换风格则状态全额生效、但没有伤害加成。**这才叫相性维度**（此前只有单向的 ±15%）。
export const RESIST_MULT = 0.5 // 普通对手：触发率减半
export const BOSS_RESIST_MULT = 0 // 首领：完全免疫（首领机制已够多，不再被状态剥一层）

/** 克制 `enemyStyle` 的那个风格（= 敌人被谁克） */
export function counterStyleOf(enemyStyle) {
  return Object.entries(STYLE_ADVANTAGE).find(([, beaten]) => beaten === enemyStyle)?.[0] ?? null
}

/** 敌人抵抗的状态 id（null = 无抗性） */
export function resistedStatusOf(enemyStyle) {
  const counter = counterStyleOf(enemyStyle)
  return counter ? STYLE_STATUS[counter] : null
}

/** 敌人对该状态的抗性倍率（1 = 无抗性 · 0.5 = 触发率减半 · 0 = 免疫） */
export function resistMultFor(enemy, statusId) {
  if (!enemy || resistedStatusOf(enemy.style) !== statusId) return 1
  return enemy.isBoss ? BOSS_RESIST_MULT : RESIST_MULT
}

/**
 * 本次攻击施加状态的触发率（0 = 不施加）
 * @param styleLevel 当前风格的技能等级
 * @param enemy      对手对象（读 `style` 与 `isBoss`）
 * @param styleId    玩家当前风格
 */
export function statusTriggerChance(styleLevel, enemy, styleId) {
  if (!COMBAT_DEPTH_V1) return 0
  const statusId = STYLE_STATUS[styleId]
  if (!statusId || !enemy) return 0
  const base = Math.min(STATUS_TRIGGER_MAX, STATUS_TRIGGER_BASE + (Number(styleLevel) || 1) * STATUS_TRIGGER_PER_LEVEL)
  return base * resistMultFor(enemy, statusId)
}

/** 割伤/灼烧的每回合伤害（按玩家攻击派生 ⇒ 随进度自然缩放，不必另做一条曲线） */
export function dotDamage(playerAttack) {
  return Math.max(1, Math.floor((Number(playerAttack) || 0) * DOT_PCT))
}

/** 破防后的敌人防御（引擎与界面必须都调它，否则「卡片写 90 防、打起来按 72 算」） */
export function brokenDef(baseDef) {
  if (!COMBAT_DEPTH_V1) return baseDef
  return Math.max(0, Math.round((Number(baseDef) || 0) * (1 - BREAK_PCT)))
}

/** 给界面用的一行抗性说明（战斗屏与对手详情共用；**不许在 .vue 里手写这句话**） */
export function resistText(enemy) {
  const sid = resistedStatusOf(enemy?.style)
  if (!sid) return ''
  return enemy.isBoss ? `免疫「${STATUS_INFO[sid].name}」` : `对「${STATUS_INFO[sid].name}」有抗性`
}

// ── ④ 越级重击（2026-09-26 第二批：补上「续航墙」）────────────────────────────
// 问题（实测）：自动进食按**上限的 50%** 触发且免费，而敌人每回合只打掉你上限的 ~2.5%
//   ⇒ **没有任何敌人能一击打死你**（连首领的 `instantKill` 上限也是 `hp×0.8`，从满血打不死）
//   ⇒ 实测 L60 的满配玩家能 100% 打赢 **L860** 的敌人（Δ+800），到 Δ+1000 才崩。
// 对照 Melvor：怪的「单次最大伤害」是**显式数值**，`max hit ≥ 当前血量` 就秒杀，
//   自动进食在受伤之后才触发、救不回来 —— 那才是它的难度来源（公平性来自**信息 + 玩家选择**，不是机制温柔）。
// 处置：按**等级差**派生的重击 —— `gap = 敌人等级 / 玩家等级`，`gap ≤ 1` 时**恒为 0**。
//   ⇒ **同等级战斗一个字节不变**（TTK／成长标定／塔的第一段全都不动），只有「越级」才产生风险。
//   ⇒ 塔的对手等级 = 玩家级 + ⌊(层−1)/4⌋ 且封顶 140，gap 最多 ~2.3 ⇒ 塔那边只是「更硬一点」，
//     塔的墙仍由 `g` 提供（本批复测确认墙位没动）。
export const HEAVY_GAP_FREE = 1.15 // 越级不足 15% 不触发（61 级打 60 级这种不算越级）
export const HEAVY_PCT_SLOPE = 0.35 // 每 1.0 倍等级差 → +35% 玩家血量上限
export const HEAVY_PCT_CAP = 1.4 // 上限 140% 玩家血量上限（⇒ 越级约 4 倍等级就会被一击秒）
export const HEAVY_CHANCE_SLOPE = 0.12 // 每 1.0 倍等级差 → +12% 概率
export const HEAVY_CHANCE_CAP = 0.35

/** 等级差（敌人等级 ÷ 玩家等级；玩家等级 0/非法时按 1 算） */
export function levelGap(enemyLevel, playerLevel) {
  const p = Math.max(1, Number(playerLevel) || 1)
  return Math.max(0, Number(enemyLevel) || 0) / p
}

/** 越级重击：一次能打掉「玩家血量上限」的百分比（0 = 不触发这类攻击） */
export function heavyPct(enemyLevel, playerLevel) {
  if (!COMBAT_DEPTH_V1) return 0
  const over = levelGap(enemyLevel, playerLevel) - HEAVY_GAP_FREE
  if (over <= 0) return 0
  return Math.min(HEAVY_PCT_CAP, over * HEAVY_PCT_SLOPE)
}

/** 每次敌人攻击触发越级重击的概率 */
export function heavyChance(enemyLevel, playerLevel) {
  if (!COMBAT_DEPTH_V1) return 0
  const over = levelGap(enemyLevel, playerLevel) - HEAVY_GAP_FREE
  if (over <= 0) return 0
  return Math.min(HEAVY_CHANCE_CAP, over * HEAVY_CHANCE_SLOPE)
}

/**
 * 越级重击的伤害（按**玩家血量上限**的百分比算，不吃防御的饱和减伤 —— 否则高防玩家又把它吃干）
 * ⚠️ 但**吃「受击减免」**（奥义「铜墙铁壁」等，属性面板那一行的同一个值）⇒ 玩家有明确的反制手段。
 */
export function heavyDamage(playerMaxHp, enemyLevel, playerLevel, damageTakenPct = 0) {
  const pct = heavyPct(enemyLevel, playerLevel)
  if (pct <= 0) return 0
  const raw = Math.floor((Number(playerMaxHp) || 0) * pct)
  return Math.max(1, Math.floor(raw * (1 - (Number(damageTakenPct) || 0) / 100)))
}

/** 给界面用的越级风险提示（对手详情/战斗屏共用；null = 无风险 ⇒ 不显示这一行） */
export function heavyText(enemyLevel, playerLevel) {
  const pct = heavyPct(enemyLevel, playerLevel)
  if (pct <= 0) return null
  const c = heavyChance(enemyLevel, playerLevel)
  const lethal = pct >= 1 ? '（可一击致命）' : ''
  return `越级风险：${Math.round(c * 100)}% 概率打出重击，最高 ${Math.round(pct * 100)}% 你的血量上限${lethal}`
}
