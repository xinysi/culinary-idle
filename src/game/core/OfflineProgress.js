// 离线收益计算 — 需求文档 §10.2.2
// 基础离线 12 小时，效率 80%；只结算当前正在进行的技能。
// 上限可通过「能量饼干」道具延长（后续迭代，预留 maxOfflineMs 参数）。

export const DEFAULT_MAX_OFFLINE_MS = 12 * 60 * 60 * 1000 // 12 小时
export const OFFLINE_EFFICIENCY = 0.8

/**
 * @param {import('../skills/Skill.js').Skill} instance 正在运行的技能实例
 * @param {number} elapsedMs 距上次在线的毫秒数
 * @param {number} [maxOfflineMs]
 * @returns {null | { durationMs, actions, exp, items: Record<string, number> }}
 */
export function computeOfflineProgress(instance, elapsedMs, maxOfflineMs = DEFAULT_MAX_OFFLINE_MS) {
  if (!instance || typeof instance.computeOffline !== 'function') return null

  const durationMs = Math.min(Math.max(elapsedMs, 0), maxOfflineMs)
  if (durationMs < 1_000) return null

  // 师徒传承（2026-09-10）：徒弟等级提升离线收益效率（0.8 → 最高 1.0）
  const bonus = instance.player?.apprenticeOfflineBonus?.() ?? 0
  const efficiency = Math.min(1, OFFLINE_EFFICIENCY + bonus)
  const result = instance.computeOffline(durationMs, efficiency)
  if (!result) return null
  return { durationMs, ...result }
}

/** 格式化时长：毫秒 → "X小时 Y分钟" */
export function formatDuration(ms) {
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) return `${m} 分钟`
  if (m <= 0) return `${h} 小时`
  return `${h} 小时 ${m} 分钟`
}
