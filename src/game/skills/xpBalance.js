// 经验平衡：采集/制作经验随技能等级递增，避免“高等级目标/配方给低经验”的倒挂。
// 用“随等级递增的基准下限”，只把低于基准的目标/配方经验抬到基准，不降低（不破坏升级节奏）。
// 2026-09-09：采集斜率 5→12（对齐 Rocky Idle 的「高等级资源基础经验差主导」设计）——
// 让「解锁后换更高级目标」比「蹲在最低级目标刷精通」更划算，配合精通降速一起抑制蹲点策略。
export const xpGather = (level) => 10 + level * 5 // 采集一次经验基准
export const xpCraft = (level) => 25 + level * 13 // 制作一次经验基准

export function applyGatherXp(targets) {
  for (const t of targets) if (t.xpPerAction != null) t.xpPerAction = Math.max(t.xpPerAction, xpGather(t.reqLevel))
}

export function applyCraftXp(recipes) {
  for (const r of recipes) if (r.xp != null) r.xp = Math.max(r.xp, xpCraft(r.reqLevel))
}
