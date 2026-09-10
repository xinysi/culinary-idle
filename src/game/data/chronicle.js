// 厨师年鉴（2026-09-10 新增）— 个人编年史：把所有「首次达成」按时间线记下来。
// 设计约束：纯新增层（只记录事件文本与时间戳），不新增物品、不改动任何固定数据；条目上限 300 条。

export const CHRONICLE_CAP = 300

/** 事件类别（用于筛选与配色） */
export const CHRONICLE_KINDS = {
  boss: { label: '首领', icon: '👑' },
  prestige: { label: '转生', icon: '♻️' },
  michelin: { label: '餐厅', icon: '⭐' },
  realm: { label: '秘境', icon: '🏯' },
  tower: { label: '挑战塔', icon: '🗼' },
  arena: { label: '竞技场', icon: '🏆' },
  trial: { label: '试炼', icon: '🏅' },
  contest: { label: '厨具赛', icon: '🃏' },
  school: { label: '研究', icon: '📜' },
  branch: { label: '分店', icon: '🏬' },
  spirit: { label: '食灵', icon: '✨' },
  seasonal: { label: '赛季', icon: '🎪' },
}

export const CHRONICLE_KIND_KEYS = Object.keys(CHRONICLE_KINDS)

/** 把时间戳格式化为「YYYY-MM-DD HH:mm」 */
export function fmtChronicleTime(ms) {
  const d = new Date(ms ?? Date.now())
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 按自然日分组（返回 [{ day, entries }] 倒序） */
export function groupByDay(entries = []) {
  const map = new Map()
  for (const e of entries) {
    const day = fmtChronicleTime(e.at).slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day).push(e)
  }
  return [...map.entries()].map(([day, list]) => ({ day, entries: list.sort((a, b) => b.at - a.at) })).sort((a, b) => (a.day < b.day ? 1 : -1))
}
