// 本地埋点：记录「首次达成」的时间戳（开发者面板的「埋点」页签 + 论文实验数据）
//
// 目的：论文里要论证「新手期正反馈密度」，就得有「第一次采集 / 第一次制作 / 首个首领……
// 分别发生在开局后多久」。这些数据**离线可用、不联网、只写本机 localStorage**。
//
// 只在开发者模式（DEV_PANEL_ENABLED）下采集，生产构建里这些订阅根本不会被注册。
// ⚠️ 不进存档：`serialize()` 里没有它，所以它不会污染存档、也不会被读档覆盖。
import { EventBus } from '../core/EventBus.js'
import { DEV_PANEL_ENABLED } from './devFlag.js'

const KEY = 'culinary-idle.dev.telemetry'
const VERSION = 1

/** 首次达成的定义：`event` 命中且 `when(payload)` 为真时记一次（只记第一次） */
export const FIRST_MARKS = [
  { id: 'game_started', label: '开始游戏', event: null },
  { id: 'first_gather', label: '第一次采集产出', event: 'skill:action', when: (p) => p?.qty > 0, match: 'gather' },
  { id: 'first_craft', label: '第一次制作成功', event: 'skill:action', when: (p) => p?.qty > 0, match: 'craft' },
  { id: 'first_combat_win', label: '第一场对决胜利', event: 'combat:end', when: (p) => p?.result === 'win' },
  { id: 'first_loss', label: '第一次战败', event: 'combat:end', when: (p) => p?.result === 'lose' },
  { id: 'first_boss', label: '第一个首领', event: 'combat:end', when: (p) => p?.result === 'win' && p?.isBoss },
  { id: 'first_achievement', label: '第一个成就', event: 'achievement:unlock' },
  { id: 'first_mastery', label: '第一次专精升级', event: 'mastery:levelup' },
  { id: 'first_offline', label: '第一次离线结算', event: 'dev:offline' },
  { id: 'first_prestige', label: '第一次转生', event: 'dev:prestige' },
  { id: 'first_season_claim', label: '第一次领取赛季奖励', event: 'dev:season' },
]

const CRAFT_SKILLS = new Set(['cooking', 'baking', 'preserving', 'brewing', 'spiceMixing', 'craftsmithing'])

let installed = false
let cache = null

function blank() {
  return { version: VERSION, startedAt: null, runNo: 1, firsts: {}, counters: {}, recent: [] }
}

export function readTelemetry() {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? { ...blank(), ...JSON.parse(raw) } : blank()
  } catch { cache = blank() }
  return cache
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* 满/隐私模式：忽略 */ }
}

/** 记录一次「首次达成」（已记过就不再覆盖 —— 首次时间是实验数据，不能被后续覆盖） */
export function markFirst(id, atMs = Date.now()) {
  if (!DEV_PANEL_ENABLED) return
  const t = readTelemetry()
  if (!t.startedAt) t.startedAt = atMs
  if (!t.firsts[id]) {
    t.firsts[id] = atMs
    const def = FIRST_MARKS.find((m) => m.id === id)
    t.recent.unshift({ at: atMs, text: `首次达成：${def?.label ?? id}` })
    t.recent = t.recent.slice(0, 50)
  }
  persist()
}

export function bumpCounter(key, n = 1) {
  if (!DEV_PANEL_ENABLED) return
  const t = readTelemetry()
  t.counters[key] = (t.counters[key] ?? 0) + n
  persist()
}

/** 手动记一条时间线（开发者面板里的「打点」按钮） */
export function pushMark(text, atMs = Date.now()) {
  if (!DEV_PANEL_ENABLED) return
  const t = readTelemetry()
  t.recent.unshift({ at: atMs, text })
  t.recent = t.recent.slice(0, 50)
  persist()
}

/** 新开一局：runNo+1，但**保留**历史首次达成（跨局对比是论文要看的东西） */
export function beginRun() {
  if (!DEV_PANEL_ENABLED) return
  const t = readTelemetry()
  t.runNo = (t.runNo ?? 1) + 1
  persist()
}

export function resetTelemetry() {
  cache = blank()
  persist()
}

/** 导出成 JSON 字符串（论文用：可直接粘进表格） */
export function exportTelemetryCsv() {
  const t = readTelemetry()
  const rows = [['标记', '说明', '开局后(秒)', '绝对时间']]
  for (const m of FIRST_MARKS) {
    const at = t.firsts[m.id]
    rows.push([m.id, m.label, at && t.startedAt ? ((at - t.startedAt) / 1000).toFixed(1) : '', at ? new Date(at).toLocaleString() : '未达成'])
  }
  return rows.map((r) => r.join(',')).join('\n')
}

/** 安装订阅（幂等）。只在该构建包含开发者面板时执行。 */
export function initTelemetry(player) {
  if (!DEV_PANEL_ENABLED || installed) return
  installed = true
  const t = readTelemetry()
  if (!t.startedAt) { t.startedAt = Date.now(); persist() }

  const hit = (id) => markFirst(id)

  for (const def of FIRST_MARKS) {
    if (!def.event) continue
    EventBus.on(def.event, (payload) => {
      if (def.when && !def.when(payload)) return
      if (def.match === 'gather' && !(payload?.qty > 0 && !CRAFT_SKILLS.has(payload?.skillId))) return
      if (def.match === 'craft' && !CRAFT_SKILLS.has(payload?.skillId)) return
      hit(def.id)
    })
  }
  // 等级里程碑：每 10 级记一条（用现有事件，避免轮询）
  EventBus.on('skill:action', () => {
    const skills = player?.skills ?? {}
    for (const [id, s] of Object.entries(skills)) {
      const lv = s?.level ?? 1
      for (const step of [10, 25, 50, 75, 100]) {
        if (lv >= step) markFirst(`lvl_${id}_${step}`)
      }
    }
  })
}
