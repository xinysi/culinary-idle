// 对决经验口径：**按造成的伤害**（2026-09-22 用户「abc 都做」→ (a)）
//
// 🔴 为什么必须连带做这一条：本作改前的口径是「**按击杀、按敌人等级固定给**」，
//    于是「敌人血量」与「经验」完全脱钩 ⇒ **给敌人加血（(c)）会直接砍掉每小时经验**，
//    等于拿「练级变慢」换「打得更久」。参考作 Melvor Idle 的做法正好相反：
//    「打得越多伤害、经验越多」+「打太快反而浪费在重生上」⇒ 在那边**买血量不亏经验**。
//
// 口径（一条路，不分数据驱动/设计驱动）：
//    XP = min(实际造成伤害, 怪物血量, 该等级期望血量 × 2) × k(等级) × (胜 ? 1 : 0.3)
//   · `k(等级) = 旧口径同等级击杀 XP ÷ 该等级期望血量` ⇒ **同等级打赢一场 = 与改前一模一样**，
//     所以「战斗三技能 ~6 天」那套成长标定**不动**（守卫逐级断言偏差 <5%）。
//   · 上限用「期望血量 ×2」而不是「怪物血量」：冻结数据里血量≈期望血量，所以区域/首领**吃满**；
//     而塔/秘境/竞技场的血量是**为难度设计的**（塔 F1000 血量是期望值的 ~18 倍）——
//     若按实际血量给经验，深塔会变成唯一最优练级点（实测约 23 倍于区域）。
//     封在 ×2 之后：深塔 XP/小时 ≈ 最优区域刷怪（约 29M/h 对 28.6M/h），既不通胀也不亏。
//     ⚠️ ×2 这个上限**必须 ≥ 血量分档的最大倍率**（`enemyScaling.js` 的 ×2），
//        否则 (c) 会撞上限、重新变成「加血亏经验」（守卫有断言）。
//   · 溢出伤害不给经验（与 Melvor 同）：`min(伤害, 血量)`。
export const XP_DAMAGE_CAP_MULT = 2

/** 旧口径（按击杀）的同等级击杀经验 —— **从 `Combat.js` 搬来，这里是唯一来源** */
export function winXpBoost(level) {
  if (level <= 40) return 1
  if (level <= 50) return 1.1
  if (level <= 60) return 1.5
  if (level <= 70) return 2.2
  if (level <= 80) return 3.5
  if (level <= 90) return 6
  if (level <= 99) return 12
  return 16
}
/** 旧口径下「打赢一个同等级敌人」三技能**各自**获得的经验 */
export function xpKillBaseline(level) {
  const lv = Math.max(1, Number(level) || 1)
  return (lv * 9.7 + lv * lv * 0.45) * winXpBoost(lv)
}

// ── 期望血量（由**冻结数据**派生，不代表任何单个敌人）───────────────────────
// 取「等级 ±10 内所有敌人的血量中位」，超出数据范围时**夹到最近端**（不外推，
// 否则塔/秘境的 140 级会得到虚高的期望值，进而把经验上限抬飞）。
import { COMBAT_REGIONS, COMBAT_BOSSES } from './combat.js'

const ALL_ENEMIES = (() => {
  const list = []
  for (const r of COMBAT_REGIONS) for (const o of r.opponents) list.push({ level: o.level, hp: o.hp })
  for (const b of COMBAT_BOSSES) list.push({ level: b.level, hp: b.hp })
  return list.sort((a, b) => a.level - b.level)
})()

const median = (arr) => {
  if (!arr.length) return 1
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const HP_CACHE = new Map()
/** 该等级的**期望敌人血量**（±10 级中位；超出数据范围夹到端点） */
export function expectedEnemyHpAt(level) {
  const lv = Math.max(1, Math.round(Number(level) || 1))
  if (HP_CACHE.has(lv)) return HP_CACHE.get(lv)
  const near = ALL_ENEMIES.filter((e) => Math.abs(e.level - lv) <= 10).map((e) => e.hp)
  let hp = near.length ? median(near) : null
  if (hp == null) {
    // 数据只到 101 级：更高等级夹到最高一段的期望值（不外推）
    const maxLv = ALL_ENEMIES[ALL_ENEMIES.length - 1]?.level ?? lv
    const pool = ALL_ENEMIES.filter((e) => Math.abs(e.level - maxLv) <= 10).map((e) => e.hp)
    hp = median(pool)
  }
  HP_CACHE.set(lv, hp)
  return hp
}
/** 每点伤害换多少经验（= 旧口径同等级击杀 XP ÷ 期望血量） */
export function xpPerDamage(level) {
  return xpKillBaseline(level) / expectedEnemyHpAt(level)
}
/** 本次战斗「可计经验的伤害」：不超过怪物血量、也不超过「期望血量 ×2」 */
export function creditableDamage(level, damage, oppMaxHp) {
  const d = Math.max(0, Number(damage) || 0)
  const hpCap = Math.max(1, Number(oppMaxHp) || 1)
  const levelCap = Math.max(1, expectedEnemyHpAt(level) * XP_DAMAGE_CAP_MULT)
  return Math.min(d, hpCap, levelCap)
}
/**
 * 一场战斗结算给**单个技能**的经验（三技能各拿一份，与旧口径一致）
 * @param win 胜场 100%；败场 30%（保留项目原有设计，也给「自杀式刷级」一个抑制度）
 * @param playerLevel 玩家自己的对决等级（不给则按敌等级算，保持旧调用兼容）
 */
export function combatXpPerSkill(level, damage, oppMaxHp, win, playerLevel = level) {
  const credited = creditableDamage(level, damage, oppMaxHp)
  return Math.floor(credited * xpPerDamage(level) * earlyCombatXpMult(playerLevel) * (win ? 1 : 0.3))
}

// ── 开局爬坡（2026-09-26 用户 ⑦：「1 级打 1 级敌人多久到 2 级，是不是所需时间过长」）────────
// 🔴 **实测出来的问题**：`xpKillBaseline` 这条曲线是**按大后期标定**的（L99 一场 64,449 经验、
//    升一级约 4,655 场——那是设计口径），但它在低等级**掉得太慢**（L1 只有 10 经验），
//    而经验需求是 RS 形状 ×221 的指数（**L1→L2 就要 18,365**）⇒ 两头对不上：
//    实测真新档（铜刀 + 2 份饭）打新手厨房的 1 级敌人：**约 318 场 / 2.6 小时**才到 2 级，
//    而同一时间采摘早就 2 级了（1.1 分钟）—— 差两个数量级。
//    参照 Melvor Idle：L2 需 83 经验、杂鱼 5~20 经验/只 ⇒ **5~15 只**。
// 🔴 **所以这条爬坡只治「开局」，大后期一个字节不动**：
//      `1 + A·e^{-(等级-1)/τ}`，A=40、τ=5 ⇒ L1 ×41 → L5 ×19 → L10 ×7.6 → L20 ×1.9 → L30 ×1.12 → L40 ×1.01。
//    选**指数衰减**而不是「L20 之前 ×N、之后 ×1」的硬台阶：后者会在 L20 处制造一个
//    「突然慢 30%」的断崖（玩家能感觉到「这一级怎么变难了」）。这里 L40 只残余 1%，对
//    「战斗三技能 ~6 天」那套标定（大后期占绝对多数）的影响可忽略，而开局从 2.6 小时 → 几分钟。
// ⚠️ 只压/提**系统给的基准**，与难度系数那套同一纪律：不改 `xpKillBaseline`（它是冻结基线，
//    守卫逐级钉着），而是在**读取点**乘。命中经验（`hitXpFor`）也走同一个乘区 ——
//    开局阶段「每次命中 +4」比击杀奖励占比更大（实测 L1 一场 58 经验里 44 来自命中），
//    只提击杀那一侧等于没修。
export const EARLY_XP_TOP_LEVEL = 20
/** L1 处的额外倍率（总倍率 = 1 + A） */
export const EARLY_XP_BOOST_A = 40
/** 衰减尺度（级）：越大则爬坡拖得越长 */
export const EARLY_XP_BOOST_TAU = 5
/** 开局经验倍率：≥20 级恒为 1（非法/缺失输入按 1 处理，不惩罚） */
export function earlyCombatXpMult(level) {
  const lv = Number(level)
  if (!Number.isFinite(lv) || lv <= 0 || lv >= EARLY_XP_TOP_LEVEL) return 1
  return 1 + EARLY_XP_BOOST_A * Math.exp(-(lv - 1) / EARLY_XP_BOOST_TAU)
}
/** 每次**命中**给风格技能的经验（原写死 4）—— 唯一出口，与击杀经验同乘区 */
export const HIT_XP_BASE = 4
export function hitXpFor(playerLevel) {
  return Math.max(1, Math.round(HIT_XP_BASE * earlyCombatXpMult(playerLevel)))
}
