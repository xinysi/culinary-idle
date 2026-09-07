import fs from 'node:fs'
import { ITEMS } from '../src/game/data/items.js'
import { itemImage } from '../src/game/data/itemImage.js'
const POOL = Object.values(ITEMS)
  .filter((i) => ['ingredient', 'food', 'spice'].includes(i.type) && itemImage(i.id))
  .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh'))
  .map((i) => i.id)
  .slice(0, 64)
let bad = 0
for (const id of POOL) {
  const url = itemImage(id)
  const file = url ? 'public/' + decodeURIComponent(url) : null
  if (!file || !fs.existsSync(file)) { bad++; console.log('MISSING:', id, file) }
}
console.log(`检查 ${POOL.length} 个物品图片文件，缺失 ${bad} 个`)
