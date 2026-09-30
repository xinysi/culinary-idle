// 导出「全库提示词生成器」需要的物品字段（只读，JSON 打到 stdout）：
//   { id, name, type, category, categoryLabel, level, img }
// level 取生成器产物 `ITEM_LEVEL`（掉落/等级表）；取不到的空着。
import { createPinia, setActivePinia } from 'pinia'
setActivePinia(createPinia())
const { usePlayerStore } = await import('../../src/stores/player.js')
usePlayerStore().newGame()
const { ITEMS } = await import('../../src/game/data/items.js')
const { itemImage } = await import('../../src/game/data/itemImage.js')
const { CATEGORY_LABEL } = await import('../../src/game/data/itemDetail.js')
let ITEM_LEVEL = {}
try { ({ ITEM_LEVEL } = await import('../../src/game/data/combatLoot.js')) } catch { /* 可选 */ }

const out = Object.values(ITEMS).map((it) => ({
  id: it.id,
  name: it.name,
  type: it.type ?? '',
  category: it.category ?? '',
  categoryLabel: CATEGORY_LABEL[it.category] ?? '',
  level: ITEM_LEVEL[it.id] ?? null,
  // ⚠️ 必须走 `itemImage()`（唯一出口，按 type/name 推导 + 加版本号）；
  //    直接读 `it.image` 的话绝大多数物品是 undefined（它们不手写这个字段），
  //    批量入库脚本就会把它们全跳过（2026-09-30 实测踩过）。
  img: itemImage(it.id) ? decodeURIComponent(itemImage(it.id).split('?')[0]) : null,
}))
console.log(JSON.stringify(out))
