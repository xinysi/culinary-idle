// 导出「物品名 → 类别」给图片体检用（只读，把 JSON 打到 stdout）。
import { createPinia, setActivePinia } from 'pinia'
setActivePinia(createPinia())
const { usePlayerStore } = await import('../../src/stores/player.js')
usePlayerStore().newGame()
const { ITEMS } = await import('../../src/game/data/items.js')
const out = Object.values(ITEMS).map((it) => ({ name: it.name, category: it.category ?? '', type: it.type ?? '' }))
console.log(JSON.stringify(out))
