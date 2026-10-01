// 列出 1-100 的探索目标：等级 / 现名 / 掉落物（中文名）。给「按掉落改名」用。
import { createPinia, setActivePinia } from 'pinia'
setActivePinia(createPinia())
const { usePlayerStore } = await import('../../src/stores/player.js')
usePlayerStore().newGame()
const { EXPLORATION_TARGETS_ALL } = await import('../../src/game/data/explorationTargets.js')
const { ITEMS } = await import('../../src/game/data/items.js')

const rows = EXPLORATION_TARGETS_ALL.filter((t) => !String(t.id).startsWith('explore_late_'))
  .map((t) => ({
    id: t.id,
    lv: t.reqLevel,
    name: t.name,
    items: t.loot.filter((l) => l.type === 'item').map((l) => ITEMS[l.itemId]?.name ?? l.itemId),
    gold: (t.loot.find((l) => l.type === 'gold') ?? {}),
  }))
console.log('共', rows.length, '个目标（非晚期）')
for (const r of rows) console.log([r.lv, r.id, r.name, r.items.join('/')].join('\t'))
console.error('等级区间', Math.min(...rows.map((r) => r.lv)), '~', Math.max(...rows.map((r) => r.lv)))
