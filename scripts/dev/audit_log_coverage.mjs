// 日志覆盖对账：技能**实际发出的 outcome** vs 日志渲染 switch 里**有专门文案的 case**。
// 差集 = 那些动作只能落到 default 文案（信息被抹平），也顺带查出「一个事件都不发」的动作。
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => fs.readFileSync(join(ROOT, p), 'utf8')

// ① 技能里所有 `outcome: 'xxx'` 字面量（含 `outcome: cond ? 'a' : 'b'` 里的）
const emitted = new Map()
const files = fs.readdirSync(join(ROOT, 'src/game/skills')).filter((f) => f.endsWith('.js'))
for (const f of files) {
  const src = read('src/game/skills/' + f)
  for (const m of src.matchAll(/outcome:\s*'([a-zA-Z]+)'/g)) {
    if (!emitted.has(m[1])) emitted.set(m[1], [])
    emitted.get(m[1]).push(f.replace('Skill.js', ''))
  }
  // 三元写法：outcome: cond ? 'a' : 'b'
  for (const m of src.matchAll(/outcome:\s*[^,\n]*\?\s*'([a-zA-Z]+)'\s*:\s*'([a-zA-Z]+)'/g)) {
    for (const o of [m[1], m[2]]) { if (!emitted.has(o)) emitted.set(o, []); if (!emitted.get(o).includes(f)) emitted.get(o).push(f.replace('Skill.js', '')) }
  }
}
// ② 日志 switch 里的 case
const boot = read('src/game/bootstrap.js')
const cases = new Set([...boot.matchAll(/case '([a-zA-Z]+)':/g)].map((m) => m[1]))

const all = [...emitted.keys()].sort()
console.log('技能发出的 outcome 共', all.length, '种：')
for (const o of all) {
  const ok = cases.has(o)
  console.log(`${ok ? '✅' : '❌'} ${o.padEnd(12)} ← ${[...new Set(emitted.get(o))].join(', ')}${ok ? '' : '   （没有专门文案，落到 default）'}`)
}
console.log('\nswitch 里有、但没见谁发：', [...cases].filter((c) => !emitted.has(c)).join(', ') || '无')
