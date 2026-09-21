// 获取来源跳转表快照 / 比对（开发工具，不进 CI；CI 的正确性断言在 item_triple_audit 里）
//
// 用途：`sourceJump.js` 是「前缀锚定 → 首次命中的子串扫描」两级判定、**顺序敏感**，
// 改它很容易顺手改坏别的来源串。改前后各跑一次 dump、再 diff，就能确认「改动只有预期的那些」。
//
// 用法（在仓库根目录）：
//   node scripts/dev/jump_table_snapshot.mjs dump .jump-before.json
//   ……改 sourceJump.js / itemSources.js……
//   node scripts/dev/jump_table_snapshot.mjs dump .jump-after.json
//   node scripts/dev/jump_table_snapshot.mjs diff .jump-before.json
//
// 落地视图会把 LogView 的历史子页迁移也算进去（log+quest → quests），否则比的是中间态。
import { writeFileSync, readFileSync } from 'node:fs'
import { itemSources, sourceIds } from '../../src/game/data/itemSources.js'
import { jumpForSource } from '../../src/game/data/sourceJump.js'

const MIGRATED = { quest: 'quests', achieve: 'achievements', title: 'achievements' }

function resolve(s) {
  const t = jumpForSource(s)
  if (!t) return null
  if (t.skill) return `${t.view}:${t.skill}`
  if (t.view === 'log' && t.logTab && MIGRATED[t.logTab]) return MIGRATED[t.logTab]
  if (t.view === 'log' && t.logTab) return `log/${t.logTab}`
  return t.view
}

const table = {}
for (const id of sourceIds()) for (const s of itemSources(id)) table[s] = resolve(s)

const mode = process.argv[2] ?? 'dump'
const file = process.argv[3] ?? '.jump-snapshot.json'

if (mode === 'dump') {
  writeFileSync(file, JSON.stringify(table, null, 1), 'utf8')
  const vals = {}
  for (const v of Object.values(table)) vals[v] = (vals[v] ?? 0) + 1
  console.log('来源串总数:', Object.keys(table).length, '→ 已写入', file)
  console.log('落地目标分布:')
  Object.entries(vals).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`))
} else {
  const before = JSON.parse(readFileSync(file, 'utf8'))
  const keys = new Set([...Object.keys(before), ...Object.keys(table)])
  const changed = []
  for (const k of keys) if (before[k] !== table[k]) changed.push([k, before[k], table[k]])
  console.log('改动条数:', changed.length)
  changed
    .sort((a, b) => String(a[1]).localeCompare(String(b[1])) || a[0].localeCompare(b[0]))
    .forEach(([k, b, a]) => console.log(`  ${String(b)}  →  ${String(a)}   ${k}`))
  console.log('\n请逐条确认「每条都是预期的」；出现意料之外的改动说明新规则抢了别的来源串。')
}
