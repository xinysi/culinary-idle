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
  // 挂机产线四套（2026-09-14）
  caravan: { label: '商队', icon: '🐫' },
  mushroom: { label: '菌房', icon: '🍄' },
  // ⚠️ 2026-10-01 修：这一行原先写的是 `spirit`，与上面「食灵」**重名**（对象字面量后写的赢）
  //    ⇒ 食灵物语的记录一直被显示成「灵田」。灵田改用独立 kind `field`。
  field: { label: '灵田', icon: '🌿' },
  bee: { label: '蜂场', icon: '🐝' },
  essence: { label: '萃露', icon: '🧪' },
  // ⚠️ 2026-10-01 补：`player.js` 记录奇遇时用的就是 `encounter`，但表里没有 ⇒ 年鉴那行退化成
  //    兜底 `label: k`、直接印英文 id（用户实测「年鉴里显示 encounter」）。
  encounter: { label: '奇遇', icon: '❓' },
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
