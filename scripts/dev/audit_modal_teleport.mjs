// 扫「弹窗没有 Teleport」的同类问题：
// 祖先卡片上的 `backdrop-filter` 会把 `position: fixed` 变成「相对该祖先定位」⇒ 弹窗错位
// （项目在 MasteryHelp 上记过这条）。规范做法：弹窗用 `<Teleport to="body">`。
import fs from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const walk = (d, out = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (f.endsWith('.vue')) out.push(p)
  }
  return out
}
const bad = []
const okList = []
for (const p of walk(join(ROOT, 'src'))) {
  const rel = relative(ROOT, p).replace(/\\/g, '/')
  const s = fs.readFileSync(p, 'utf8')
  if (!/class="modal-backdrop"/.test(s)) continue
  const hasTp = /<Teleport to="body">/.test(s)
  ;(hasTp ? okList : bad).push(rel)
}
console.log(`有弹窗的 .vue 共 ${bad.length + okList.length} 个`)
console.log('\n✅ 已用 Teleport（规范写法）：\n  ' + (okList.join('\n  ') || '（无）'))
console.log('\n❌ 没包 Teleport（要逐个确认它渲染在视图根部、祖先没有 backdrop-filter）：\n  ' + bad.join('\n  '))
