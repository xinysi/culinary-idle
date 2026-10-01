// 并行挂机槽位（2026-09-29 立）——**唯一出口**。
//
// 🔴 为什么要收：`maxParallelIdle = 0` 表示**无限制**（默认），于是玩家第一天就把 7 条采集线 + 探索全挂上
//   ⇒ 总时长 = max（35 天）而不是 Σ（112 天）—— 实测这条路把总时长压 **3.2×**，是**比 buff 更大的杠杆**。
//   同时它也把「练什么」这个决策整个抹掉了（Melvor / Rocky 都是**一次只能练一个技能**，那正是它们的核心循环）。
//
// 处置：槽位改成**进度奖励** —— 起步 1 槽，其余靠三条轴解锁（最多 8 槽 = 7 条采集线 + 探索）。
//   ⚠️ **并行挂机调度是本作论文题目里的特性**（《…离线结算与并行挂机调度》），所以**不是删掉它**，
//   而是把它从「开局全开」改成「玩出来的」；设置面板里那个选择仍然保留（只用来**再限低**，不能再突破进度上限）。
//
// 三条轴刻意选「不受 XP 加成压缩」或「一次性」的：
//   · 山海点亮数（收集件数 + 等级 + 精通，见 shanhaiProgress）
//   · 成就数（一次性达成，与倍率无关）
//   · 转生次数（**注意**：转生本身会被经验加成加速，所以它只作为一档、且门槛低；主力是前两条）
export const PARALLEL_SLOT_BASE = 1

/** 解锁表：`slots` = 解锁到几槽；`need` 里任一项达标即可（三条轴各给两档） */
export const PARALLEL_SLOT_UNLOCKS = [
  { slots: 2, kind: 'shanhai', need: 30, label: '山海食经点亮 30 个节点' },
  { slots: 3, kind: 'achievements', need: 20, label: '解锁 20 个成就' },
  { slots: 4, kind: 'prestige', need: 1, label: '任一技能转生 1 次' },
  { slots: 5, kind: 'shanhai', need: 200, label: '山海食经点亮 200 个节点' },
  { slots: 6, kind: 'achievements', need: 80, label: '解锁 80 个成就' },
  { slots: 7, kind: 'prestige', need: 5, label: '任一技能转生 5 次' },
  { slots: 8, kind: 'shanhai', need: 400, label: '山海食经点亮 400 个节点' },
]

/** 从玩家状态取三条轴的当前值（`s` 可以是 store 或 `$state`） */
export function parallelMetrics(s) {
  const shanhai = (s?.shanhaiUnlocked ?? []).length
  const achievements = (s?.achievements ?? []).length
  let prestige = 0
  for (const st of Object.values(s?.skills ?? {})) prestige = Math.max(prestige, st?.prestiges ?? 0)
  return { shanhai, achievements, prestige }
}

/** 已解锁的槽位数（起步 1，最多 8） */
export function unlockedParallelSlots(s) {
  const m = parallelMetrics(s)
  let slots = PARALLEL_SLOT_BASE
  for (const u of PARALLEL_SLOT_UNLOCKS) if ((m[u.kind] ?? 0) >= u.need) slots = Math.max(slots, u.slots)
  return slots
}

/** 下一档解锁（全解锁后返回 null）——设置面板用它显示「还差什么」 */
export function nextParallelUnlock(s) {
  const m = parallelMetrics(s)
  for (const u of PARALLEL_SLOT_UNLOCKS) if ((m[u.kind] ?? 0) < u.need) return { ...u, have: m[u.kind] ?? 0 }
  return null
}

/** 实际生效的槽位上限：设置面板只能**再限低**，不能突破进度上限（`0` = 用满进度上限） */
export function effectiveParallelSlots(s) {
  const setting = Number(s?.settings?.maxParallelIdle ?? 0) || 0
  const cap = unlockedParallelSlots(s)
  return setting > 0 ? Math.min(setting, cap) : cap
}