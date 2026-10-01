// 对账：全项目每处 `recordChronicle(key, kind, ...)` 的**第 2 参数**，必须都在 `CHRONICLE_KINDS` 里有中文 label
// （否则年鉴那行会退化成兜底 `label: k` ⇒ 直接印英文 id —— 用户实测「年鉴里显示 encounter」就是这样来的）。
import fs from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const walk = (d, out = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (f.endsWith('.js')) out.push(p)
  }
  return out
}
const kinds = new Set()
for (const p of walk(join(ROOT, 'src'))) {
  const src = fs.readFileSync(p, 'utf8')
  for (const m of src.matchAll(/recordChronicle\??\.?\(([^)]*)\)/g)) {
    // 取第 2 个实参里的字符串字面量（可能是 'boss' 也可能是三元里的两个字面量）
    const args = m[1].split(',')
    const second = args.slice(1).join(',')
    for (const s of second.matchAll(/'([a-zA-Z_]+)'/g)) kinds.add(s[1])
  }
}
const { CHRONICLE_KINDS, CHRONICLE_KIND_KEYS } = await import('../../src/game/data/chronicle.js')
const table = new Set(Object.keys(CHRONICLE_KINDS))
const missing = [...kinds].filter((k) => !table.has(k)).sort()
const unused = [...CHRONICLE_KIND_KEYS].filter((k) => !kinds.has(k)).sort()
console.log('源码里用到的 kind：', [...kinds].sort().join(', '))
console.log('表内键：', [...table].sort().join(', '))
console.log('\n❌ 表里缺 label（会印英文 id）：', missing.join(', ') || '无')
console.log('⚠️ 表里有、但没人记录（列在筛选项里会常年 0）：', unused.join(', ') || '无')
process.exit(missing.length ? 1 : 0)
