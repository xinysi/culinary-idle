// 穷尽扫描：玩家可见文案里的「开发腔」。
// 与上一版的区别：用项目自己的 stripComments（三态扫描）先把注释去掉，
// 再**逐字符**抽字符串字面量（' " `，含模板串里的 ${} 插值也一并剥），所以不会把注释当代码。
import fs from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { stripComments } from '../ci/lib/comments.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const walk = (d, out = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(js|vue)$/.test(f)) out.push(p)
  }
  return out
}
/** 抽字符串字面量（返回 {s, line}） */
function literals(src) {
  const out = []
  let line = 1
  let i = 0
  const n = src.length
  let q = null
  let buf = ''
  let start = 1
  while (i < n) {
    const c = src[i]
    if (c === '\n') line++
    if (q) {
      if (c === '\\') { buf += src[i + 1] ?? ''; i += 2; continue }
      if (c === q) { out.push({ s: buf, line: start }); q = null; buf = ''; i++; continue }
      buf += c
      i++
      continue
    }
    if (c === '"' || c === "'" || c === '`') { q = c; start = line; buf = ''; i++; continue }
    i++
  }
  return out
}
// 开发腔词（收紧到「几乎不可能出现在玩家文案里」的那些）
const PAT = /(实测|平衡系数|成本系数|数值口径|数据对齐|已按|现已|门控|§\s?\d|守卫|断言|假绿|反例验证|回归测试|口径说明|与[^，。；]{0,10}一致|中位数|TODO|FIXME|待定|本轮|上轮|下轮|v\d+\.\d+\.\d+|20\d\d-\d\d-\d\d|接口|字段|解耦|复用|单例|缓存|缓存|配置项|参数|默认值|上限值|概率桶|难度桶|乘区)/
const hits = []
for (const p of walk(join(ROOT, 'src'))) {
  const rel = relative(ROOT, p).replace(/\\/g, '/')
  if (rel.startsWith('src/game/dev/')) continue // 开发者面板（玩家看不到）
  const src = stripComments(fs.readFileSync(p, 'utf8'))
  for (const { s, line } of literals(src)) {
    if (!/[\u4e00-\u9fa5]/.test(s)) continue
    const m = s.match(PAT)
    if (m) hits.push({ file: rel, line, word: m[0], text: s })
  }
}
const byFile = new Map()
for (const h of hits) { if (!byFile.has(h.file)) byFile.set(h.file, []); byFile.get(h.file).push(h) }
console.log(`命中 ${hits.length} 处 / ${byFile.size} 个文件\n`)
for (const [f, list] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`━━ ${f}（${list.length}）`)
  for (const h of list) console.log(`   :${h.line}  [${h.word}]  ${h.text.replace(/\s+/g, ' ').slice(0, 150)}`)
}
