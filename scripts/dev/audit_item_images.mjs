// 物品图清点审计（双向对账）：
//   ① 每个物品按 `itemImage()` 算出的路径，**文件到底在不在**（缺图 = 漏）
//   ② 磁盘上 `public/images/items/**` 里有没有**没有任何物品对应**的孤儿图（= 多出来的）
//   ③ 顺带把「物品 → 图片路径」全量导出（给全库提示词生成器用）
// 用法：node scripts/dev/audit_item_images.mjs [--json out.json]
import { createPinia, setActivePinia } from 'pinia'
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const IMG_ROOT = join(ROOT, 'public', 'images')

setActivePinia(createPinia())
const { usePlayerStore } = await import('../../src/stores/player.js')
usePlayerStore().newGame()
const { ITEMS } = await import('../../src/game/data/items.js')
const { itemImage } = await import('../../src/game/data/itemImage.js')

// ① 物品 → 图
const rows = []
const missing = []
// ⚠️ `itemImage()` 返回的是 **URL**（中文被百分号编码）⇒ 查文件前必须 `decodeURIComponent`，
//    否则会把 2700 多张**本来就在**的图全报成「缺图」（本脚本第一版就是这么错的）。
for (const it of Object.values(ITEMS)) {
  const url = itemImage(it.id)
  const rel = url ? decodeURIComponent(url.split('?')[0]) : null
  const ok = rel ? existsSync(join(ROOT, 'public', rel)) : false
  rows.push({ id: it.id, name: it.name, type: it.type, category: it.category ?? '', img: rel, hasFile: ok })
  if (!ok) missing.push(`${it.id} ${it.name}（${it.type}/${it.category}）→ ${rel ?? '无路径'}`)
}

// ② 磁盘 → 物品（只看 items/ 下的）
const onDisk = []
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(png|webp|jpg)$/i.test(f)) onDisk.push(p)
  }
}
walk(join(IMG_ROOT, 'items'))
const used = new Set(rows.filter((r) => r.hasFile).map((r) => r.img))
const orphans = onDisk.map((p) => relative(join(ROOT, 'public'), p).replace(/\\/g, '/')).filter((r) => !used.has(r))

// ③ 概览
const byDir = {}
for (const p of onDisk) {
  const d = relative(join(IMG_ROOT, 'items'), p).replace(/\\/g, '/').split('/')[0]
  byDir[d] = (byDir[d] ?? 0) + 1
}
console.log('══ 物品图清点审计 ══')
console.log(`物品总数（ITEMS）           = ${rows.length}`)
console.log(`其中有图片文件              = ${rows.filter((r) => r.hasFile).length}`)
console.log(`🔴 缺图（物品有、文件没有） = ${missing.length}`)
for (const m of missing.slice(0, 40)) console.log('   ✗ ' + m)
console.log(`\npublic/images/items 下文件  = ${onDisk.length}`)
console.log(`按子目录：${Object.entries(byDir).sort().map(([k, v]) => `${k}=${v}`).join('  ')}`)
console.log(`🔴 孤儿图（文件有、物品没有）= ${orphans.length}`)
for (const o of orphans.slice(0, 40)) console.log('   ✗ ' + o)

const outIdx = process.argv.indexOf('--json')
if (outIdx >= 0 && process.argv[outIdx + 1]) {
  writeFileSync(process.argv[outIdx + 1], JSON.stringify(rows, null, 0), 'utf8')
  console.log(`\n已导出物品→图片映射 → ${process.argv[outIdx + 1]}`)
}
