// 敌人血量分档系数（2026-09-22 用户「abc 都做」→ (c)）
//
// 🔴 铁律：**敌人数据是冻结数据**（`combat.js` 的等级/属性/掉落/机制一律不许改）⇒
//    血量调整只能在**读取点**乘系数，做法与挑战塔难度档（`applyTowerTier`）、
//    全局难度系数（`difficulty.js`）同一套路：数据一个字节不动、想回退只改这张表。
//
// 依据（实测 `scripts/sim/enemy_ttk.mjs`，真实引擎、同等级白板玩家）：
//   · 改前全部 248 个敌人：单场**中位 6.0s**；L1~20 段只有 4.8s、最快的几个只要 **2 回合（4 秒）**；
//     L81~101 已经 10.8s（9 回合）。
//   · 参考作 Melvor Idle：练级击杀普遍「数秒~数十秒」，且它有 3 秒重生 + 按伤害给经验，
//     所以玩家会主动挑「血厚到打不死太快」的怪；本作这两条原本都没有。
//   ⇒ 偏短的是**低中段**，目标把它们拉到 8~12 秒。
//
// 为什么 L61+ 不动（倍率 = 1）：实测**血量 ×3 会多出 12 个「打不赢」的敌人**
//   （L81+ 从 10.8s 变 32.4s，同时出现硬墙）——后期本来就不短，再加就成了卡关。
// ⚠️ 倍率表的最大值（2）必须 ≤ `combatXpCurve.js` 的 `XP_DAMAGE_CAP_MULT`（也是 2），
//    否则「加血」会撞上经验上限、重新变成「打得更久但经验不涨」（守卫有断言）。
export const ENEMY_HP_BANDS = [
  { maxLevel: 20, mult: 2 }, // 2 回合 → 4 回合左右
  { maxLevel: 40, mult: 1.8 }, // 5.4s → ~9s
  { maxLevel: 60, mult: 1.5 }, // 6.2s → ~8.5s
  { maxLevel: Infinity, mult: 1 }, // L61+ 不动（已经 7~11s，且加血会造墙）
]

/** 该等级敌人的血量倍率 */
export function enemyHpMult(level) {
  const lv = Number(level) || 1
  for (const b of ENEMY_HP_BANDS) if (lv <= b.maxLevel) return b.mult
  return 1
}

/**
 * 血量加成后的敌人副本（**纯函数**：不改传入对象 —— 冻结数据的铁律）
 * ⚠️ 界面显示与开打**必须用同一个副本**，否则就是「卡片写 120 血、打起来 240 血」的
 *    显示/结算不一致（本项目的头号忌讳）⇒ 列表与 `Combat.start()` 都走这一个函数。
 * 🔴 **幂等**：已经加过血的副本（带 `__scaled` 标记）原样返回 —— 否则「列表先缩放、
 *    引擎再缩放一次」会变成 ×4。困难模式的副本是从已缩放的对手 `{...opponent}` 派生的，
 *    自带标记 ⇒ 是「分档 ×1.5」而不是「分档² ×1.5」。
 */
export function scaledEnemy(opponent) {
  if (!opponent) return opponent
  if (opponent.__scaled) return opponent
  const m = enemyHpMult(opponent.level)
  if (m === 1) return { ...opponent, __scaled: true, hpMult: 1 }
  return { ...opponent, __scaled: true, hp: Math.max(1, Math.round((opponent.hp ?? 1) * m)), baseHp: opponent.hp, hpMult: m }
}

/** 分档说明（界面/文档共用，避免各处手抄倍率） */
export function enemyScalingText() {
  const parts = []
  let from = 1
  for (const b of ENEMY_HP_BANDS) {
    if (b.mult === 1) break
    const to = b.maxLevel === Infinity ? '∞' : b.maxLevel
    parts.push(`L${from}~${to} ×${b.mult}`)
    from = b.maxLevel + 1
  }
  return parts.join(' · ')
}
