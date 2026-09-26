import { tunerOver } from '../data/tuner.js'
// 成长速度总闸（2026-09-21）——**乘法叠区的阻尼**，全局唯一出口。
//
// 起因（用户实测提问）：「采摘一直采苹果就能很快把技能等级拉到几十级，这个速度会不会太快了？
// 我看另外两个游戏也不会这样，可能是给的buff和加成太多太高的原因」。实测（`scripts/sim/xp_multiplier_breakdown.mjs`）：
// 加法层 9 个（食灵/奥义/公会/图谱/米其林/食神/荣誉/厨神之路/精通池）单独打开各自只有 +0~17%，
// 真正撑起上限的是**乘法层**——设置面板倍率 / 增益剂 / 转生 / 精通卡片倍率 / 限时窗口，全部叠加实测 **×312**。
//
// 为什么是「对乘积做阻尼」而不是「压低某一层」：
// 1. **档位阶梯必须保持有意义**：直接砍 `PRESTIGE_XP_BONUS` 或给增益剂设上限，会让「高转生」「高阶增益剂」
//    与小档位拉平（4.5 封到 3.6 ⇒ Ⅴ 档与 Ⅳ 档等价、玩家没有理由再去做高阶货）——项目里所有阶梯都要求严格单调。
//    阻尼作用在**乘积**上 ⇒ 家族内部各档位的相对差距**一分不变**，只是整体被压缩。
// 2. **渐进**：`damp(1.2) = 1.15`（前期几乎不动）、`damp(13.5) = 10.4`（后期才咬）——
//    新档零加成的成长速度不变，被压的只有「已经堆满乘区」的那一段。
// 3. **永不产生惩罚**：结果恒 ≥ 1，且对输入严格单调递增 ⇒ 「转生更多会不会反而更慢」这类倒退不可能发生。
//
// ⚠️ 改这个常数前先跑 `scripts/sim/growth_sim.mjs`（满级时长基准）与 `scripts/ci/system_test.mjs` 的 C53 组
//   （阻尼公式 / 恒 ≥1 / 单调 / 行为断言：真实 XP 比值 == 阻尼后的比值）。
// ⚠️ 展示面：`Skill.addXp` 是唯一消费点；「效果总览」有一条登记项（`activeEffects.js` 的 `xpStackDamping`）
//   把「叠区相乘 → 阻尼折减」这件事告诉玩家，否则玩家自己乘出来的数与实际到账对不上。

/** 乘法叠区超出 1 的部分按此系数计入（0.75 = 超出部分打七五折） */
export const XP_STACK_DAMPING = 0.75

/**
 * 乘法叠区阻尼：`1 + (stack − 1) × XP_STACK_DAMPING`。
 * @param {number} stack 各乘法层（转生 × 增益剂 × 精通或设置倍率 × 对决补正 × 限时窗口）的乘积
 */
export function dampXpStack(stack) {
  const p = Number(stack)
  if (!Number.isFinite(p) || p <= 1) return 1
  return 1 + (p - 1) * tunerOver('xpDamping', XP_STACK_DAMPING, 0, 1)
}

// ── 低目标经验衰减（2026-09-22 用户要求）────────────────────────────────────────
// 「所有技能、副业，如果正在进行的目标等级小于技能等级 5 级及以上，获得的经验减半，
//   鼓励玩家去挂对应等级段的目标」
//
// 为什么需要它：采集/制作的经验**不随目标等级递增**到足以抵消「低阶目标更快」的程度 ——
// 高级目标只是把间隔略微拉长，于是一直蹲最低阶目标（苹果/小麦）反而是最优解，
// 玩家没有理由换目标（实测见 `skills/xpBalance.js` 与 `scripts/sim/camp_vs_optimal.mjs`）。
// 这条规则把「蹲低阶」直接砍掉一半经验，让「挑当前最高档的目标」变成明显更优。
//
// 🔴 参照系必须**夹到「该技能最高可用目标等级」**（`lowTargetRefLevel`）：
//    副业的最高配方只到 Lv91、多数技能到 Lv99~100，而技能上限是 99（转生后 120）——
//    不夹的话，副业 96 级、以及转生后的 100~120 段会出现「**所有**目标都被判低目标」的退化
//    （明明已经做到自己能做的最高档，却处处减半）。夹过之后规则的含义才是「挑你这一档最高的目标」。
//
// ⚠️ 唯一出口：`Skill.addCardXp(base, mult, targetLevel)` —— 采集/制作/探索/农耕/副业/离线
//    全部卡片经验都从那里过。**新增给卡片经验的系统必须从那里走**并在 `targetLevel` 位置传入目标等级
//    （忘了传 ⇒ 不减半 = 静默失效，`template`/`system_test` 的 C54 有「每个调用点都传了等级」的静态断言）。
// ⚠️ 不作用于：对决类技能（`Combat.js` 的 `addXp`）—— 那里经验**已经是按伤害、按敌人等级**给的
//    （打低级怪本来就只有零头），再叠一层减半等于罚两次；也对精通次数、精通池、里程碑点数**完全无影响**。

/** 目标等级比技能等级低这么多级（及以上）⇒ 卡片经验按 `LOW_TARGET_XP_MULT` 计 */
export const LOW_TARGET_GAP = 5
/** 低目标的经验系数（0.5 = 减半） */
export const LOW_TARGET_XP_MULT = 0.5

/** 把「可能是空值」的等级读成数字：null / undefined / '' / NaN / ≤0 一律返回 NaN（= 拿不到等级） */
function toLevel(v) {
  // 🔴 必须先挡 null/undefined/''：`Number(null) === 0`、`Number('') === 0` —— 直接 Number() 会把
  //    「没给等级」读成 0 级，于是 `0 <= 参照−5` 恒真 ⇒ **本来该不减半的反而被减半**
  //    （2026-09-22 探针实测：离线 `currentTarget?.reqLevel ?? null` 在拿不到目标时把经验砍了一半）。
  if (v === null || v === undefined || v === '') return NaN
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : NaN
}

/**
 * 衰减的参照等级 = `min(技能等级, 该技能最高可用目标等级)`。
 * `topTargetLevel` 拿不到（无目标表的技能）时退回技能等级本身。
 */
export function lowTargetRefLevel(skillLevel, topTargetLevel) {
  const s = toLevel(skillLevel)
  if (!Number.isFinite(s)) return NaN
  const t = toLevel(topTargetLevel)
  return Number.isFinite(t) ? Math.min(s, t) : s
}

/** 这个目标/配方是否属于「低目标」（比参照等级低 5 级及以上）。等级拿不到 ⇒ 不算（不误罚） */
export function isLowTarget(skillLevel, targetLevel, topTargetLevel = null) {
  const lv = toLevel(targetLevel)
  if (!Number.isFinite(lv)) return false
  const ref = lowTargetRefLevel(skillLevel, topTargetLevel)
  if (!Number.isFinite(ref)) return false
  return lv <= ref - tunerOver('lowTargetGap', LOW_TARGET_GAP, 1, 20)
}

/** 低目标衰减系数：`isLowTarget` ? `LOW_TARGET_XP_MULT` : 1 */
export function targetLevelXpMult(skillLevel, targetLevel, topTargetLevel = null) {
  return isLowTarget(skillLevel, targetLevel, topTargetLevel) ? tunerOver('lowTargetMult', LOW_TARGET_XP_MULT, 0, 1) : 1
}

/** 规则说明（**唯一文案出口**：界面与指南都读它，别再手写「低 5 级」「减半」） */
export const LOW_TARGET_NOTE = `正在做的目标/配方比技能等级低 ${LOW_TARGET_GAP} 级及以上时，卡片经验 ×${LOW_TARGET_XP_MULT}（挑本档最高级的目标才满经验）。参照的是「你这个技能能做到的最高档」，所以顶档目标永远不会被罚。`

/** 卡片上的紧凑标签（**从系数派生**，改 `LOW_TARGET_XP_MULT` 时它自己跟着变）
 *  ⚠️ 用它、不要在页面里写死 `−50%`；它挂在「经验」那一行的数值旁，**不进卡片头部** ——
 *  徽章塞进头部（名字那一格）时，窄卡上会整枚换行、把各卡行高顶得参差不齐（2026-09-23 用户截图报的排版乱）。 */
export const LOW_TARGET_CHIP = `−${Math.round((1 - LOW_TARGET_XP_MULT) * 100)}%`


