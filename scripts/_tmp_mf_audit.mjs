import { ITEMS } from '../src/game/data/items.js'
import { itemImage } from '../src/game/data/itemImage.js'
// 复刻组件 IMG_POOL
const POOL = Object.values(ITEMS)
  .filter((i) => ['ingredient', 'food', 'spice'].includes(i.type) && itemImage(i.id))
  .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh'))
  .map((i) => i.id)
  .slice(0, 64)
console.log('IMG_POOL 长度:', POOL.length, '（11×11 需要 60 对）')
const MODES = { 2: 2, 3: 4, 4: 8, 5: 12, 6: 18, 7: 24, 8: 32, 9: 40, 10: 50, 11: 60 }
for (const [size, pairs] of Object.entries(MODES)) {
  const cap = size * size / 2
  const poolOk = pairs <= POOL.length
  const capOk = pairs <= cap
  console.log(`${size}×${size}: pairs=${pairs} 容量=${cap} 池可满足=${poolOk} 格容量足够=${capOk} ${poolOk && capOk ? 'OK' : 'FAIL'}`)
}
