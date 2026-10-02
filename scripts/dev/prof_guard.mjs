// 量准 content_sync_audit 那条新守卫的耗时构成
import fs from 'node:fs'
import { stripComments } from '../ci/lib/comments.mjs'

const t0 = Date.now()
const files = []
const walk = (d) => { for (const n of fs.readdirSync(d)) { const p = d + '/' + n; const st = fs.statSync(p); if (st.isDirectory()) walk(p); else if (/\.(vue|js)$/.test(n)) files.push([p, st.size]) } }
walk('src/game/data'); walk('src/views'); walk('src/components')
const js = files.filter(([p]) => p.endsWith('.js'))
const vue = files.filter(([p]) => p.endsWith('.vue'))
const jsBytes = js.reduce((a, b) => a + b[1], 0)
console.log('文件：js ' + js.length + ' 个 / ' + (jsBytes / 1048576).toFixed(1) + ' MB，vue ' + vue.length + ' 个')

const t1 = Date.now()
let stripped = 0
for (const [p] of js) stripped += stripComments(fs.readFileSync(p, 'utf8')).length
const t2 = Date.now()
console.log('stripComments 全部 js：' + (t2 - t1) + 'ms（产出 ' + (stripped / 1048576).toFixed(1) + ' MB）')

// 最大的几个 js 文件（若耗时集中在这里，就是它们）
const big = js.sort((a, b) => b[1] - a[1]).slice(0, 5)
for (const [p, sz] of big) {
  const t = Date.now()
  stripComments(fs.readFileSync(p, 'utf8'))
  console.log('  ' + (Date.now() - t) + 'ms  ' + (sz / 1024).toFixed(0) + 'KB  ' + p)
}
console.log('总计 ' + (Date.now() - t0) + 'ms')
