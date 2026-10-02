// 运营驾驶舱 —— **只读聚合引擎**（2026-10-02 新角色 ops）
//
// 🔒 只读契约（系统测试有断言）：本文件所有函数**不得修改 player / 存档任何一个字段**。
//    它们只调用 store 的 getter 与只读 action（restaurantHourlyIncome / branchHourlyOf / goldGainPct …），
//    把结果拼成面板用的行。tick 类 action、gain* 类 action **一个都不许出现在这里**。
//
// ⚠️ 不 import telemetry.js（它经 devFlag 读 import.meta.env，在 node CI 里会抛）——
//    漏斗数据由调用方传入（浏览器传 readTelemetry()，CI 传桩）。
import { ITEMS } from '../data/items.js'
import { ALL_ACHIEVEMENTS } from '../data/achievements.js'
import { BRANCHES } from '../data/branches.js'
import { contentByBand, contentGaps } from './opsCadence.js'

/** 进度概览：一组"这台机器上这份存档走到哪了"的标量 */
export function progressOverview(player) {
  const achCount = (player?.achievements ?? []).length
  const colCount = Object.keys(player?.collected ?? {}).length
  return {
    gold: Math.round(player?.gold ?? 0),
    gameCoins: Math.round(player?.gameCoins ?? 0),
    tastePoints: Math.round(player?.tastePoints ?? 0),
    maxLevel: player?.maxSkillLevel?.() ?? 1,
    gatherLevels: player?.gatherLevels ?? 0,
    craftLevels: player?.craftLevels ?? 0,
    supportLevels: player?.supportLevels ?? 0,
    prestiges: player?.stats?.prestiges ?? 0,
    towerFloor: player?.tower?.floor ?? 0,
    towerBest: player?.tower?.best ?? 0,
    michelinStars: player?.michelin?.stars ?? 0,
    michelinScore: player?.michelin?.score ?? 0,
    achievements: { count: achCount, total: ALL_ACHIEVEMENTS.length },
    collected: { count: colCount, total: Object.keys(ITEMS).length },
    offlineHours: player?.offlineMaxHours?.() ?? 0,
  }
}

/**
 * 新手漏斗：把本机埋点的「首次达成」排成一条时间线（开局后第几秒到达）。
 * @param telemetry readTelemetry() 的返回（或桩：{ startedAt, firsts }）
 * @param marks     FIRST_MARKS（由调用方传入，避免本模块依赖 telemetry.js）
 */
export function funnelRows(telemetry, marks = []) {
  const started = telemetry?.startedAt ?? null
  return marks.map((m) => {
    const at = telemetry?.firsts?.[m.id] ?? null
    return {
      id: m.id,
      label: m.label,
      at,
      seconds: started && at ? Math.round((at - started) / 1000) : null,
      done: at != null,
    }
  })
}

/** 漏斗完成度（已达成的里程碑数 / 总数） */
export function funnelProgress(rows) {
  const done = rows.filter((r) => r.done).length
  return { done, total: rows.length, pct: rows.length ? done / rows.length : 0 }
}

/**
 * 经济水位（**按小时的可见部分**）：餐厅本体 + 已开分店。
 * ⚠️ 刻意不含地窖/商队/订单（它们是整点/归队/随机的**块状**收入，硬摊成时收会误导）——
 *    卡片标题写清口径，别让玩家以为这就是全部时收。
 */
export function economyRows(player) {
  const rows = []
  const rest = Math.round(player?.restaurantHourlyIncome ?? 0)
  if (rest > 0) rows.push({ id: 'restaurant', label: '餐厅本体', goldPerHour: rest })
  for (const def of BRANCHES) {
    if (!player?.branches?.[def.id]) continue
    const g = Math.round(player.branchHourlyOf?.(def.id) ?? 0)
    if (g > 0) rows.push({ id: `branch:${def.id}`, label: `${def.icon ?? ''} ${def.name}`, goldPerHour: g })
  }
  const total = rows.reduce((a, r) => a + r.goldPerHour, 0)
  for (const r of rows) r.pct = total ? r.goldPerHour / total : 0
  return { rows, total, goldGainPct: player?.goldGainPct?.() ?? 0 }
}

/** 道具 TopN：按「数量 × 单价」排序的持有量（只看背包，不含仓库/冷库） */
export function topItems(player, n = 8) {
  const inv = player?.inventory ?? {}
  const rows = []
  for (const [id, qty] of Object.entries(inv)) {
    const it = ITEMS[id]
    if (!it || !qty) continue
    const value = it.value ?? 0
    rows.push({ id, name: it.name ?? id, qty, value, total: value * qty })
  }
  rows.sort((a, b) => b.total - a.total)
  return rows.slice(0, Math.max(1, n))
}

/** 一次性算齐驾驶舱要的块（面板直接绑它） */
export function collectDashboard(player, { telemetry = null, marks = [] } = {}) {
  const funnel = funnelRows(telemetry, marks)
  const cadence = contentByBand()
  return {
    overview: progressOverview(player),
    funnel,
    funnelProgress: funnelProgress(funnel),
    economy: economyRows(player),
    topItems: topItems(player, 8),
    cadence,
    cadenceGaps: contentGaps(cadence),
  }
}
