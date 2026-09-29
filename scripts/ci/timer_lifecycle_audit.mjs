// 定时器生命周期审计（2026-09-28 立，CI 亦执行）
//
// 背景：2026-09-28 全量体检抓到**两处「离开页面后自己开打」**（同一个病）：
//   · `TowerView.vue`：自动爬楼胜利后延时开下一场；而卸载钩子把 `fighting=false` + `combat.stop()` ——
//     待触发回调的守卫（`没在打`）因此**恰好成立** ⇒ 离开塔页 1.8 秒后真的 `startFight()`。
//   · `CombatView.vue`：持久战胜利后 500ms 再打一场，定时器没存引用，卸载只解绑了 EventBus。
//   两处的代价都不是崩溃，而是**白耗料理/品鉴点**，并且因为 `combat:end` 已解绑 ⇒ 那一场没人结算。
//
// 判据（这条能精确命中上面两处，且实测在现有代码上**零误报**）：
//   凡是回调里**会再次启动玩法**（引用 `start*` 函数）的 `setTimeout`，其句柄必须被**跟踪**：
//   `x = setTimeout(...)` 赋值，或 `arr.push(setTimeout(...))` 收进一个会被清空的集合。
//   —— 被跟踪的两种写法实测只有 3 个文件命中：TowerView（赋值，已修）· CombatView（赋值，已修）·
//      SequenceView（push 进 `timers`，`onUnmounted` 里 `clearTimers()` 逐个 clearTimeout）。
//   🔴 **不要**把规则放宽成「凡 setTimeout 必须有 clearTimeout」：实测 29 个 .vue 里 18 个不满足，
//      绝大多数是无害的一次性延迟（动画/提示），放宽只会得到一条需要大名单的噪声断言。
//
// 本审计钉四件事：
//   A. **会重启玩法的定时器必须被跟踪**（赋值或 push）—— 这条是上面两个真缺陷的正面判据
//   B. **setInterval 必须配对 clearInterval**（本项目既有性质，实测 24 款小游戏全平衡；钉住它防回归）
//   C. **具名回归点**：TowerView/CombatView 必须在卸载时 clearTimeout 自己那个句柄
//   D. **扫描器自证**：扫到的定时器条数不得骤低（否则 A 会因为「一处都没扫到」而恒真）
//
// 反例验证：`node scripts/dev/verify_binding.mjs 9 10`（把两处改回「裸 setTimeout」⇒ A/C 各自 FAIL 并点名）。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments } from './lib/comments.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const fails = []
const ok = []
const check = (name, cond, detail = '') => (cond ? ok.push(name) : fails.push(`${name}${detail ? '  ← ' + detail : ''}`))

function walk(dir, out = []) {
  for (const e of readdirSync(join(root, dir))) {
    const rel = `${dir}/${e}`
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out)
    else if (e.endsWith('.vue')) out.push(rel)
  }
  return out
}
// 只扫 `<script>` 块（模板/样式里的引号会带偏括号配对与「是不是字符串」的判断）
const read = (p) => {
  let txt = readFileSync(join(root, p), 'utf8')
  txt = [...txt.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')
  return stripComments(txt)
}
/** 把字符串内容抹成空串，避免字符串里的括号带偏配对 */
const blankStrings = (s) => s.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, '""')

/** 取出每个 setTimeout(...) 的实参文本与起始下标（做括号配对，忽略字符串内的括号）
 *  🔴 **下标必须与切片用的是同一份文本**：`blankStrings` 会把 `'abc'` 压成 `""`、**改变长度**，
 *  首版拿「压过之后的 at」去切「没压过的原文」⇒ 往前 60 字符取到的根本不是赋值语句，
 *  连**已经修好的** TowerView/CombatView 都被判「句柄未被跟踪」（守卫自伤）。
 *  所以本函数只接受**已压过**的文本，调用方也用同一份去切片。 */
function timeoutCalls(blanked) {
  const out = []
  const re = /setTimeout\s*\(/g
  let m
  while ((m = re.exec(blanked))) {
    let i = m.index + m[0].length - 1
    let depth = 0
    let j = i
    for (; j < blanked.length; j++) {
      if (blanked[j] === '(') depth++
      else if (blanked[j] === ')') { depth--; if (!depth) break }
    }
    out.push({ at: m.index, arg: blanked.slice(i, j + 1) })
  }
  return out
}

let totalTimeouts = 0
let totalIntervals = 0
const vue = walk('src')

// ── A. 会重启玩法的定时器必须被跟踪 ──
{
  const bad = []
  for (const f of vue) {
    const txt = read(f)
    const blanked = blankStrings(txt)
    for (const c of timeoutCalls(blanked)) {
      totalTimeouts++
      // 判据：回调体里引用了 `start*`（再次启动玩法/回合/战斗）
      if (!/\bstart[A-Z_]/.test(c.arg)) continue
      // 跟踪 = 赋值给变量，或 push 进一个集合（后者要求本文件真的有 clearTimeout 把它清掉）
      const pre = blanked.slice(Math.max(0, c.at - 60), c.at)
      const assigned = /[A-Za-z_$][\w$.]*\s*=\s*$/.test(pre)
      const pushed = /\.push\(\s*$/.test(pre)
      const hasClear = /\bclearTimeout\s*\(/.test(blanked)
      if (!(assigned || (pushed && hasClear))) bad.push(`${f}（回调调用了 ${(c.arg.match(/\bstart[A-Z_]\w*/) ?? ['start*'])[0]}，句柄未被跟踪）`)
    }
    totalIntervals += (txt.match(/\bsetInterval\s*\(/g) ?? []).length
  }
  check('A. 会再次启动玩法的 setTimeout 句柄都被跟踪（赋值 / push 进会被清空的集合）',
    bad.length === 0, bad.join('；'))
}

// ── B. setInterval 必须配对 clearInterval ──
{
  const bad = []
  for (const f of vue) {
    const txt = read(f)
    const iv = (txt.match(/\bsetInterval\s*\(/g) ?? []).length
    const cl = (txt.match(/\bclearInterval\s*\(/g) ?? []).length
    if (iv > 0 && cl === 0) bad.push(`${f}（setInterval ×${iv}，全文件无 clearInterval）`)
  }
  check('B. 凡用 setInterval 的 .vue 都有 clearInterval（防离场后还在跑的循环）', bad.length === 0, bad.join('；'))
}

// ── C. 具名回归点（这两处是本轮真缺陷，逐一钉住）──
{
  const tower = read('src/views/TowerView.vue')
  check('C. TowerView：自动爬楼的定时器句柄被赋值保存（不是裸 setTimeout）',
    /climbTimer\s*=\s*setTimeout\s*\(/.test(tower))
  check('C. TowerView：卸载时 clearTimeout(climbTimer)（否则 fighting=false 会放行它）',
    /onBeforeUnmount\(\(\)\s*=>\s*\{[\s\S]{0,400}?clearTimeout\(climbTimer\)/.test(tower))
  const cv = read('src/views/CombatView.vue')
  check('C. CombatView：持久战的两次延时都走 schedulePersist（内部赋值保存句柄）',
    /persistTimer\s*=\s*setTimeout\s*\(/.test(cv) && !/^\s*setTimeout\(\(\)\s*=>\s*startNextOpponent/m.test(cv))
  check('C. CombatView：卸载时 clearTimeout(persistTimer)',
    /onBeforeUnmount\(\(\)\s*=>\s*\{[\s\S]{0,300}?clearTimeout\(persistTimer\)/.test(cv))
}

// ── D. 扫描器自证 ──
check('D. 扫描器自证：扫到的 setTimeout ≥ 40 处（过少说明 .vue 的 script 块没被读到，A 会假绿）',
  totalTimeouts >= 40, `实际 ${totalTimeouts}`)
check('D. 扫描器自证：扫到的 setInterval ≥ 15 处', totalIntervals >= 15, `实际 ${totalIntervals}`)

console.log('══ 定时器生命周期审计（离场后不许还在跑）══')
for (const n of ok) console.log('  ok  ' + n)
for (const n of fails) console.log('FAIL  ' + n)
console.log(`\n扫描 .vue ${vue.length} 个 / setTimeout ${totalTimeouts} 处 / setInterval ${totalIntervals} 处`)
console.log(`通过 ${ok.length} / 失败 ${fails.length}`)
process.exit(fails.length ? 1 : 0)