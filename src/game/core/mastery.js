// 精通（mastery）系统 — 每个卡片独立的精通等级 0~100
// 精通通过「获得次数」累加：每次触发该卡片产出/制作，该卡片精通次数 +1。
// 精通升级所需次数（阶梯，2026-09-09 降速：总次数 7500 → 3750，正反馈更密）：1-25 每级 8 次；
// 26-50 每级 22 次；51-75 每级 45 次；76-100 每级 75 次。
// 精通档位效果（**下表是「实际生效值」**，经验列已含 `MASTERY_XP_BONUS_SCALE` 缩放；曲线形状见 `masteryXpMultiplierRaw`）：
//   5 级：经验×1.05、双倍 1%、间隔减 1/3；10 级：×1.1、5%、减半；20 级：×1.2、10%、固定 3.6s；
//   30 级：×1.3、15%、3.2s；40 级：×1.45、20%、3.0s；50 级：×1.6、30%、2.8s；60 级：×1.75、40%、2.6s；
//   70 级：×1.9、50%、2.4s；80 级：×2.1、60%、2.2s；90 级：×2.3、70%、2.1s；100 级：×2.5、80%、2.0s。
// ⚠️ 改经验列的两个入口：**形状**改 `masteryXpMultiplierRaw`、**整体强度**改 `MASTERY_XP_BONUS_SCALE`。
//    （2026-09-09 上限 ×20→×8；2026-09-21 再经 SCALE=0.5 收到 ×2.5。`system_test` C27 有硬编码绊线钉住边界值。）
// ⚠️ 别在页面里手抄这张表：`MasteryHelp.vue` 读的是 `MASTERY_TIERS`（由函数派生，C27 校验逐格一致）。

export const MASTERY_LEVEL_CAP = 100

/** 升到第 lv 级所需次数（lv 从 1 起）。返回该级的升级门槛次数（2026-09-09 降为约 1/2）。 */
function masteryLevelReq(lv) {
  if (lv <= 0) return 0
  if (lv <= 25) return 8
  if (lv <= 50) return 22
  if (lv <= 75) return 45
  return 75
}

/** 累计达到精通等级 level 所需的总次数 */
export function countForMasteryLevel(level) {
  if (level <= 0) return 0
  let c = 0
  for (let lv = 1; lv <= level; lv++) c += masteryLevelReq(lv)
  return c
}

/** 由累计次数 count 反推当前精通等级（0~100） */
export function masteryLevelFromCount(count) {
  if (!(count > 0)) return 0
  let level = 0
  for (let lv = 1; lv <= MASTERY_LEVEL_CAP; lv++) {
    if (count >= countForMasteryLevel(lv)) level = lv
    else break
  }
  return level
}

/** 当前精通等级内的累计次数（用于进度显示） */
export function masteryLevelProgress(count) {
  const level = masteryLevelFromCount(count)
  if (level >= MASTERY_LEVEL_CAP) return { level, current: countForMasteryLevel(level), needed: countForMasteryLevel(level), progress: 1 }
  const base = countForMasteryLevel(level)
  const next = countForMasteryLevel(level + 1)
  return { level, current: count - base, needed: next - base, progress: Math.min(1, (count - base) / (next - base)) }
}

/** 精通等级对应的双倍概率（新档位：5→1%、10→5%、20→10%、30→15%、40→20%、50→30%、60→40%、70→50%、80→60%、90→70%、100→80%） */
export function masteryDoubleChance(level) {
  if (level >= 100) return 0.8
  if (level >= 90) return 0.7
  if (level >= 80) return 0.6
  if (level >= 70) return 0.5
  if (level >= 60) return 0.4
  if (level >= 50) return 0.3
  if (level >= 40) return 0.2
  if (level >= 30) return 0.15
  if (level >= 20) return 0.1
  if (level >= 10) return 0.05
  if (level >= 5) return 0.01
  return 0
}

/** 精通等级对应的采集间隔因子（比例）：<5 为 1；5~9 减 1/3（×2/3）；≥10 减半（×1/2）。
 *  ≥20 仍取 1/2 —— 固定间隔（masteryFixedInterval）只作「上限」叠加（取更快者），
 *  不再整段替换比例口径（2026-09-12 修：整段替换会让 51% 的目标在精通 19→20 时反而变慢，最差 2.4 倍）。 */
export function masteryIntervalFactor(level) {
  if (level >= 10) return 0.5
  if (level >= 5) return 2 / 3
  return 1
}

/** 精通等级对应的固定采集间隔（秒）：≥20 返回固定值，否则 null（该档无固定值）。
 *  语义是**上限**（取更快者，见 GatheringSkill.intervalMs），不是整段替换：固定值给「基础间隔长」的目标提速，
 *  基础间隔短的目标继续走「基础÷2」，因此精通升级永远不会让同一张卡变慢。2026-09-09 定值、2026-09-12 改为取更快者。 */
export function masteryFixedInterval(level) {
  if (level >= 100) return 2.0
  if (level >= 90) return 2.1
  if (level >= 80) return 2.2
  if (level >= 70) return 2.4
  if (level >= 60) return 2.6
  if (level >= 50) return 2.8
  if (level >= 40) return 3.0
  if (level >= 30) return 3.2
  if (level >= 20) return 3.6
  return null
}

/** 精通档位的保底产量加成（2026-09-09，参照 Rocky Idle 的 batch 机制：档位同时给经验与产出）
 *  50 级起每次动作额外 +1 个产物、100 级 +2（叠加在双倍几率之上，作用于采集/农耕/制作） */
export function masteryYieldBonus(level) {
  if (level >= 100) return 2
  if (level >= 50) return 1
  return 0
}

/**
 * 精通「经验收益」的缩放系数（2026-09-21 用户要求「升级太快，可能是加成太高」）。
 *
 * 作用方式：`1 + (原始倍数 - 1) × 本系数` —— 而不是把整条曲线乘一遍。
 * 这样保证三件事：① 精通 0 仍是 ×1（缩整条会让低档掉到 ×1 以下，等于**精通越高越差**）；
 * ② 曲线仍严格单调不减（C27 的「升级永远不会变差」断言仍成立）；③ 改动只有**一个数字**。
 *
 * 为什么下调：实测精通给的收益是**两段**——经验 ×1.6~×4，**外加动作间隔减半（再 ×2）**，合计最高 ≈×8；
 * 而采摘从 Lv1 到 Lv90 的**整条目标阶梯才 ×18.8**（见 `scripts/sim/camp_vs_optimal.mjs`）。
 * ⇒ 精通吃掉了约 40% 的阶梯，于是「蹲点把一张卡刷满」的收益盖过「换更高等级目标」，
 *   前 50 级两者只差 1.0~1.3×（实测），玩家没有换目标的理由，等级也推得太快。
 * 取 0.5 后：上界 ×4 → **×2.5**，Lv30 档 ×1.6 → **×1.3**（两条曲线见下方档位表，`MasteryHelp` 会自动跟着变）。
 * ⚠️ 想再调快慢/难度 **只改这一个数**（0 = 精通完全不给经验加成；1 = 回到旧口径）。
 */
export const MASTERY_XP_BONUS_SCALE = 0.5

/** 精通等级的**原始**经验倍数（未缩放）。改曲线**形状**改这里；改整体强度改 `MASTERY_XP_BONUS_SCALE`。
 *  5→×1.1、10→×1.2、20→×1.4、30→×1.6、40→×1.9、50→×2.2、60→×2.5、70→×2.8、80→×3.2、90→×3.6、100→×4 */
export function masteryXpMultiplierRaw(level) {
  if (level >= 100) return 4
  if (level >= 90) return 3.6
  if (level >= 80) return 3.2
  if (level >= 70) return 2.8
  if (level >= 60) return 2.5
  if (level >= 50) return 2.2
  if (level >= 40) return 1.9
  if (level >= 30) return 1.6
  if (level >= 20) return 1.4
  if (level >= 10) return 1.2
  if (level >= 5) return 1.1
  return 1
}

/** 精通等级对应的**实际**经验倍数（全项目唯一出口，20 个消费点都调它 ⇒ 引擎与页面不会漂移）。
 *  2026-09-21 起 = `1 + (原始 - 1) × MASTERY_XP_BONUS_SCALE`（默认 0.5 ⇒ 上界 ×2.5）。
 *  历史：2026-09-09 曾把原始上限从 ×20 降到 ×4；本轮是第二次降速。 */
export function masteryXpMultiplier(level) {
  return 1 + (masteryXpMultiplierRaw(level) - 1) * MASTERY_XP_BONUS_SCALE
}

// ══════════════════════════════════════════════════════════════════════
// 精通池（技能级共享 · 2026-09-19 参照 Melvor Idle 的 Mastery Pool）
//
// 为什么加它：同一套数据在两边是不同性质的资产。
//   Melvor 的精通经验公式里含「该技能的精通**总**等级」项 ⇒ **横向练得越宽，精通涨得越快**；
//   而且每次精通经验有 25% 另进技能级池，池在 10/25/50/95% 给**整个技能**发加成。
//   本作的精通**严格按卡**（×1→×2.5、3750 次满级），全项目没有任何技能级共享
//   ⇒ 实测（`scripts/sim/target_choice.mjs`）「择优换目标」只比「蹲最低级卡片」快 **×1.07**（12h）/ ×1.25（24h），
//   **玩家没有「横向铺开」的理由**。采摘 142 个目标里同档最多挤 15 件——那些横向冗余本该是资产。
//
// 本作的实现（不是照搬，是按本作的计数式精通改写）：
//   · 入池：每次动作的**精通次数**有 `MASTERY_POOL_GAIN_RATE` 也记进该技能的池（与 Melvor 的 25% 同口径）；
//   · 上限：**按该技能卡片数派生**（`MASTERY_POOL_PER_CARD` × 卡片数），不手抄 —— 卡片多的技能池也大；
//   · 里程碑：10/25/50/95% 四档给**整个技能**的双倍产出 / 制作成功率 / （最高档）经验加成；
//   · 🔴 **里程碑只在池 ≥ 阈值时生效**（花掉就失去）—— 这是 Melvor 这套的精髓：
//     它给的是「持续参与」的压力，而不是一次性解锁（对比本作山海食经的「点亮即永久」）；
//   · 池点数可 **1:1 补给任意卡片**的精通（受「该卡距满级还差多少」夹取，不浪费）。
//
// ⚠️ 平衡口径：加成**以「产量/成功率」为主、经验只放最高档且封顶 +5%** ——
//    因为 Lv99 所需时长是标定过的，不能因为新系统整体位移。
//    ⚠️ 该基准 2026-09-21 两轮上浮：①「精通经验收益 ×0.5 + 经验倍率档位封顶」⇒ 采集 34.8h→44.2h；
//      ②「成长阻尼 ×0.75（乘法叠区，见 `core/growthRate.js`）」⇒ 基准列再 +8~20%（采摘 44.2h→**47.4h**）、满配列 +18~42%
//      （精通这层也在叠区里：×2.5 实际按 ×2.125 计入）。
//      重测见 `scripts/sim/growth_sim.mjs`（量「改动前」把 `XP_STACK_DAMPING` 临时设 1）。
//    改这张表前先看 C49 的「加成上限」断言与那道 `xpPct ≤ 5` 的夹取。

/** 池上限 = 该技能卡片数 × 本常量。取 600 是**推导值**：
 *  一张卡满精通要 3750 次（`countForMasteryLevel(100)`），入池率 25% ⇒ 填满池需 `4 × 600 × 卡片数` 次动作，
 *  而「把该技能所有卡都练满」需 `3750 × 卡片数` 次 ⇒ 池满 ≈ 完成全技能精通的 **64%**（4×600/3750）。
 *  即「95% 里程碑 ≈ 该技能精通做了六成」，既有长线又不至于永远够不到。 */
export const MASTERY_POOL_PER_CARD = 600

/** 每次动作的精通次数里，有多大比例同时记进技能池（对齐 Melvor 的 25%） */
export const MASTERY_POOL_GAIN_RATE = 0.25

/** 池里程碑（按池的填充百分比）。⚠️ 效果是**整技能**口径，且只在池 ≥ 该阈值时生效。 */
export const MASTERY_POOL_TIERS = [
  { pct: 0.10, name: '初通', doublePP: 1, successPP: 0, xpPct: 0 },
  { pct: 0.25, name: '熟练', doublePP: 2, successPP: 1, xpPct: 0 },
  { pct: 0.50, name: '通达', doublePP: 3, successPP: 3, xpPct: 0 },
  { pct: 0.95, name: '圆满', doublePP: 5, successPP: 5, xpPct: 5 },
]

/** 池上限（卡片数为 0/未知时返回 0 —— 调用方**绝不能**拿 0 去截断已存池值，否则会丢档） */
export function masteryPoolCap(cardCount) {
  const n = Number(cardCount)
  return Number.isFinite(n) && n > 0 ? Math.round(n * MASTERY_POOL_PER_CARD) : 0
}

/** 池填充百分比 0~1（上限未知时用 1 兜底，避免显示成 NaN/Infinity） */
export function masteryPoolPct(pool, cardCount) {
  const cap = masteryPoolCap(cardCount)
  const p = Number(pool)
  if (!(p > 0)) return 0
  if (!(cap > 0)) return 0
  return Math.min(1, p / cap)
}

/** 当前达成的里程碑**下标**（未达任何档返回 -1）。池跌破阈值时随之回落 —— 这是设计意图，不是 bug。 */
export function masteryPoolTierIndex(pool, cardCount) {
  const pct = masteryPoolPct(pool, cardCount)
  let idx = -1
  for (let i = 0; i < MASTERY_POOL_TIERS.length; i++) if (pct >= MASTERY_POOL_TIERS[i].pct) idx = i
  return idx
}

/** 该技能当前的精通池加成（整技能口径）。池低于 10% 时全为 0。 */
export function masteryPoolBonus(pool, cardCount) {
  const idx = masteryPoolTierIndex(pool, cardCount)
  if (idx < 0) return { tierIdx: -1, tier: null, doublePP: 0, successPP: 0, xpPct: 0 }
  const t = MASTERY_POOL_TIERS[idx]
  return { tierIdx: idx, tier: t, doublePP: t.doublePP, successPP: t.successPP, xpPct: Math.min(5, t.xpPct) }
}

/** 下一个里程碑（已满返回 null）——UI 显示「距下一档还差多少」 */
export function nextMasteryPoolTier(pool, cardCount) {
  const idx = masteryPoolTierIndex(pool, cardCount)
  const next = MASTERY_POOL_TIERS[idx + 1]
  if (!next) return null
  const cap = masteryPoolCap(cardCount)
  return { tier: next, need: Math.max(0, next.pct * cap - (Number(pool) || 0)) }
}

/** 把池点数补给一张卡：返回**实际补给量**（受池余额与「该卡距满级还差多少」双重夹取） */
export function poolSpendAmount(pool, cardCount, moved) {
  const have = Math.max(0, Number(pool) || 0)
  const mv = Math.max(0, Math.floor(Number(moved) || 0))
  return Math.max(0, Math.min(have, mv))
}

// ── 精通「横向铺开」奖励（2026-09-19）──────────────────────────────────
// 🔴 这才是 Melvor 让「练得多」比「蹲一张卡」划算的**真正机制**，别只移植池：
//    Melvor 的精通经验公式里含「该技能的**精通总等级**」项 ⇒ 一个物品练得越广，**所有**物品都练得越快。
//    本作若只加池（池按动作数线性累积、与铺不铺开无关），蹲点照样不吃亏 —— 等于没解决量测到的问题
//    （「择优换目标」只比「蹲最低级卡片」快 ×1.07，见 `scripts/sim/target_choice.mjs`）。
// ⇒ 精通次数获取倍率 = 1 + 广度 × MASTERY_BREADTH_MAX，广度 = 该技能各卡精通等级之和 ÷ (卡片数 × 满级)。
//    满广度时精通快 1.5 倍；只练一张卡时约等于 1.0（一张满级卡贡献 100/(卡片数×100) 的广度）。
// ⚠️ 倍率上界由常量钉死（守卫 C49 断言 ≤ 1.5），避免与池的 25% 叠加后把精通速度放大到失控。
export const MASTERY_BREADTH_MAX = 0.5

/** 广度倍率：totalLevels = 该技能各卡精通等级**之和**，cardCount = 该技能卡片数 */
export function masteryBreadthMultiplier(totalLevels, cardCount) {
  const n = Math.max(0, Number(cardCount) || 0)
  const max = n * MASTERY_LEVEL_CAP
  if (!(max > 0)) return 1
  const frac = Math.max(0, Math.min(1, (Number(totalLevels) || 0) / max))
  return 1 + frac * MASTERY_BREADTH_MAX
}

// ── 档位阶梯（展示用，2026-09-16 新增）────────────────────────────────
// ⚠️ 这张表**必须保持派生**（直接由上面那组函数算出来），不要在页面里手写数字：
//    `MasteryHelp.vue`（采集页 / 制作页 / 厨房笔记共用的「📖 精通档位说明」）读的就是它。
//    在此之前 GatheringView 里手抄过一份 11 行档位表，改平衡时极易只改一处、页面照旧骗人
//    （system_test C27 会校验本表与函数逐格一致、且组件里不再出现手写档位数字）。
export const MASTERY_TIER_LEVELS = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

export const MASTERY_TIERS = MASTERY_TIER_LEVELS.map((level) => ({
  level,
  xpMult: masteryXpMultiplier(level),
  double: masteryDoubleChance(level),
  batch: masteryYieldBonus(level),
  intervalFactor: masteryIntervalFactor(level),
  fixedInterval: masteryFixedInterval(level),
}))

/** 下一个档位（已满级返回 null） */
export function nextMasteryTier(level) {
  return MASTERY_TIERS.find((t) => t.level > level) ?? null
}

/** 距离下一档还差多少次（已满级返回 null） */
export function masteryToNextTier(level, count) {
  const t = nextMasteryTier(level)
  if (!t) return null
  return { tier: t, remaining: Math.max(0, countForMasteryLevel(t.level) - (count ?? 0)) }
}

/** 档位表里「采集间隔」一列的中文口径（仅采集类卡片有意义；制作类不显示该列） */
export function masteryIntervalText(tier) {
  if (tier.intervalFactor >= 1) return '不变'
  if (tier.intervalFactor > 0.5 && tier.fixedInterval == null) return '减 1/3'
  if (tier.fixedInterval == null) return '减半'
  return `≤ ${tier.fixedInterval.toFixed(1)}s`
}
