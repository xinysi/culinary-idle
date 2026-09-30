// 逐级盘查：每一级都有哪些内容（采集目标 / 农耕作物 / 制作配方 / 探索目标）—— 按等级摆开。
// 用途：找「零内容等级」与「最疏的一段」；2026-09-30 就是靠它量出 Lv101/103/107/109/113/115/119 为空，
// 从而定出「末段空档」那批（46 件）。跑法：`node scripts/dev/level_content_probe.mjs`
import { createPinia, setActivePinia } from 'pinia'
setActivePinia(createPinia())
const { usePlayerStore } = await import('../../src/stores/player.js')
const p = usePlayerStore()
p.newGame()
const { createSkillInstances, getAllSkillInstances } = await import('../../src/game/skills/registry.js')
createSkillInstances(p)
const { EXPLORATION_TARGETS_ALL } = await import('../../src/game/data/explorationTargets.js')

const byLevel = new Map()
const add = (lv, tag) => {
  if (!Number.isFinite(lv) || lv < 95 || lv > 120) return
  if (!byLevel.has(lv)) byLevel.set(lv, [])
  byLevel.get(lv).push(tag)
}
for (const inst of getAllSkillInstances()) {
  for (const t of inst.targets ?? []) add(Number(t.reqLevel), `${inst.id}:目标`)
  for (const c of inst.crops ?? []) add(Number(c.reqLevel), `${inst.id}:作物`)
  for (const r of inst.recipes ?? []) add(Number(r.reqLevel), `${inst.id}:配方`)
}
for (const t of EXPLORATION_TARGETS_ALL) add(Number(t.reqLevel), '探索')

console.log('等级   件数  内容（按技能归并）')
for (let lv = 95; lv <= 120; lv++) {
  const list = byLevel.get(lv) ?? []
  const kinds = [...new Set(list.map((s) => s.split(':')[0]))]
  console.log(`${String(lv).padStart(3)}   ${String(list.length).padStart(3)}   ${kinds.join(' ') || '—— 空 ——'}`)
}
const empty = []
for (let lv = 95; lv <= 120; lv++) if (!byLevel.has(lv)) empty.push(lv)
console.log('\n95~120 里完全空的等级：', empty.join(', ') || '（无）')
