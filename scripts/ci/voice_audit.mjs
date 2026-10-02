// 面向玩家的「开发者腔 / 内部术语」审计 —— 从 scripts/dev/voice_scan.mjs 移植（那版实测 0.54s）。
// 🔴 移植时保留它的**关键写法**（这才是不慢的原因）：
//    · 按**文件**剥一次注释（stripComments），不是按行/按字面量反复剥；
//    · 每行只做**一次**文本提取（.vue 取标签外文本；.js 取整行的字面量集合），
//      绝不「对每个字面量再跑一遍带正则的 scanText」——我第一版那样写让 content_sync_audit 从 1.8s 涨到 29s。
// 判据：命中即失败并把命中点打出来（含「哪个词」），并打印**扫描条数**（防「扫 0 条也 ok」）。
import fs from 'node:fs'
import { stripComments } from './lib/comments.mjs'

const DEV = /(按批次|副业线|门槛表|注册表|唯一出口|读取点|消费方|口径|实测|系数|乘区|独占品|量级|待接线|未接线|数据层)/
// 内部工具：本来就是给运营与开发者看的，白名单放行
const SKIP = /(TunerPanel|DevPanel)\.vue$/
// ⚠️ 刻意不收「扩展 N 批」：那是 aojisGates 里内部分批的标签（数据键、不展示），
//    而它**该被拦的地方**（那段门槛说明文案）由 system_test 的专条断言钉住。

const hits = []
let scanned = 0
const push = (f, line, text, why) => hits.push(`${f}:${line} 「${text.slice(0, 44)}」(含「${why}」)`)

function scanVue(f, raw) {
  const tm = raw.match(/<template>([\s\S]*)<\/template>/)
  if (!tm) return
  const tpl = tm[1].replace(/<!--[\s\S]*?-->/g, '')          // HTML 注释
  tpl.split('\n').forEach((raw2, i) => {
    // ① 标签外文本（一次提取）
    const textOnly = raw2.replace(/<[^>]*>/g, ' ').replace(/\{\{[\s\S]*?\}\}/g, ' ').replace(/:[a-zA-Z-]+="[^"]*"/g, ' ')
    if (/[\u4e00-\u9fa5]/.test(textOnly)) { scanned++; const m = textOnly.match(DEV); if (m) push(f, i + 1, textOnly.trim(), m[1]) }
    // ② 会展示的属性（一次提取）
    for (const a of raw2.matchAll(/(?:title|placeholder|aria-label)="([^"]*)"/g)) {
      const v = a[1]
      if (v.includes('{{') || /^[a-zA-Z_$]/.test(v.trim()) || !/[\u4e00-\u9fa5]/.test(v)) continue
      scanned++; const m = v.match(DEV); if (m) push(f, i + 1, v.trim(), m[1])
    }
  })
}

function scanJs(f, raw) {
  const body = stripComments(raw)                            // 每个文件只剥一次
  body.split('\n').forEach((ln, i) => {
    if (!/[\u4e00-\u9fa5]/.test(ln)) return                  // 便宜判断
    const lits = ln.match(/'([^']{6,})'|"([^"]{6,})"|`([^`]{6,})`/g)
    if (!lits) return
    const text = lits.join(' ')
    scanned++
    const m = text.match(DEV)
    if (m) push(f, i + 1, text.replace(/['"`]/g, ''), m[1])
  })
}

const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = dir + '/' + name
    const st = fs.statSync(p)
    if (st.isDirectory()) { walk(p); continue }
    if (!/\.(vue|js)$/.test(name)) continue
    if (SKIP.test(p)) continue
    const raw = fs.readFileSync(p, 'utf8')
    if (name.endsWith('.vue')) scanVue(p, raw)
    else scanJs(p, raw)
  }
}
const t0 = Date.now()
walk('src/game/data'); walk('src/views'); walk('src/components')
const ms = Date.now() - t0

// 基线：当前实测扫描条数（改代码后若骤降说明扫描器坏了 —— 这条就是「扫 0 条也 ok」的解药）
const BASE = 15000
console.log(`语音审计：扫描 ${scanned} 条 / 命中 ${hits.length} 处 / 用时 ${ms}ms（基线 ≥${BASE}）`)
if (scanned < BASE) { console.log(`❌ FAIL 扫描条数骤降（${scanned} < ${BASE}）—— 扫描器可能坏了`); process.exit(1) }
if (hits.length) {
  console.log('❌ FAIL 面向玩家的话里出现开发者腔/内部术语：')
  for (const h of hits.slice(0, 12)) console.log('   ' + h)
  if (hits.length > 12) console.log(`   …还有 ${hits.length - 12} 处`)
  process.exit(1)
}
console.log('✅ PASS')
