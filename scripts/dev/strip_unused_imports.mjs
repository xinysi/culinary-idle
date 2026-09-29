// 一次性清理工具（本地脚本，不入库）：按 `unused_import_audit` 的判据删掉未使用的 import。
//
// 为什么要有它：`.vue` 里 30+ 处未使用 import，逐个手改容易改坏 import 语句的逗号/花括号。
// **判据只有一份** —— 直接 import 守卫的 `findUnused()`，避免「检测」与「删除」两套逻辑漂移
// （本项目正是不动就漂的那类东西：守卫说 A 未用、删除脚本删 B）。
//
// 用法：
//   node scripts/dev/strip_unused_imports.mjs          # 只报告，不写盘
//   node scripts/dev/strip_unused_imports.mjs --apply  # 写盘
//
// 删除规则：
//   · 命名导入 `{ a, b }` 里删掉未使用的那一项；**全空则整条 import 删掉**
//   · 默认导入 / `* as NS` 未使用 → 整条删掉
//   · 保留原有缩进与其余项的原样文本（只删、不重排），改完必须过 build + 守卫
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findUnused } from '../ci/unused_import_audit.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const APPLY = process.argv.includes('--apply')
const { unused } = findUnused()

/** 按文件分组：file -> Set(未使用的本地绑定名) */
const byFile = new Map()
for (const { file, name } of unused) {
  if (!byFile.has(file)) byFile.set(file, new Set())
  byFile.get(file).add(name)
}

/** 把一条 import 语句里未使用的绑定删掉；返回 null 表示整条删除 */
function stripOne(stmt, dead) {
  const m = stmt.match(/^import\s+([\s\S]*?)\s+from\s*(['"][^'"]+['"])$/)
  if (!m) return stmt
  const [, clause, mod] = m
  const braceStart = clause.indexOf('{')
  const braceEnd = clause.lastIndexOf('}')
  const hasBraces = braceStart >= 0 && braceEnd > braceStart
  const before = (hasBraces ? clause.slice(0, braceStart) : clause).trim().replace(/,$/, '')
  const kept = []
  // 默认导入 / 命名空间导入
  if (before) {
    const ns = before.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/)
    const local = ns ? ns[1] : before
    if (!dead.has(local)) kept.push(before)
  }
  // 花括号里的命名导入（保留原样文本，只丢未使用项）
  if (hasBraces) {
    const items = clause.slice(braceStart + 1, braceEnd).split(',')
      .map((s) => s.trim()).filter(Boolean)
      .filter((s) => {
        const local = s.match(/\bas\s+([A-Za-z_$][\w$]*)$/) ?? s.match(/^([A-Za-z_$][\w$]*)$/)
        return local ? !dead.has(local[1]) : true
      })
    if (items.length) kept.push(`{ ${items.join(', ')} }`)
  }
  if (!kept.length) return null
  return `import ${kept.join(', ')} from ${mod}`
}

let changedFiles = 0
let removed = 0
for (const [file, dead] of byFile) {
  const p = resolve(ROOT, file)
  const raw = readFileSync(p, 'utf8')
  let out = ''
  let last = 0
  const re = /import\s+[\s\S]*?\s+from\s*['"][^'"]+['"]/g
  let m
  while ((m = re.exec(raw))) {
    const stmt = m[0]
    const isInScript = raw.lastIndexOf('<script', m.index) > raw.lastIndexOf('</script>', m.index)
    const next = isInScript ? stripOne(stmt, dead) : stmt
    if (next === stmt) continue
    out += raw.slice(last, m.index)
    out += next ?? ''
    last = m.index + stmt.length
    removed++
  }
  if (!last) continue
  out += raw.slice(last)
  // 整条被删时可能留下一个空行 —— 收成一行，别让 diff 里出现「删了 import 却多一空行」
  out = out.replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n')
  if (APPLY) writeFileSync(p, out, 'utf8')
  changedFiles++
  console.log(`${APPLY ? '改了' : '会改'} ${file}：删 ${dead.size} 个 —— ${[...dead].join(', ')}`)
}
console.log(`\n${APPLY ? '已写盘' : '（试跑，未写盘）'}：${changedFiles} 个文件 / ${removed} 条 import 语句被改写`)
if (!APPLY) console.log('确认无误后加 --apply 再跑一次')