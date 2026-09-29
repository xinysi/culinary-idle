// 反例验证：美食探索 Lv102-120 扩展（C75）—— 注入真缺陷 → 跑 system_test → 断言 FAIL 且点名 → 还原。
// 用法：node scripts/dev/verify_c75.mjs        （4 例 × ~28 秒 ≈ 2 分钟）
//      node scripts/dev/verify_c75.mjs 2      （只跑指定序号）
// ⚠️ 与其它 verify 脚本一样：锚点单行优先；**绝不并发跑两个反例脚本**（会互相踩文件）。
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const P = (rel) => join(root, rel)
const CRLF = String.fromCharCode(13, 10)

function injectText(rel, from, to) {
  const orig = readFileSync(P(rel), 'utf8')
  const fold = (t) => (orig.includes(CRLF) ? t.replace(/\n/g, CRLF) : t)
  from = fold(from)
  to = fold(to)
  const n = orig.split(from).length - 1
  if (n !== 1) throw new Error(`${rel} 锚点匹配 ${n} 次（期望 1）：${from.slice(0, 60)}`)
  writeFileSync(P(rel), orig.replace(from, to), 'utf8')
}

const CASES = [
  {
    name: '① 扩展把目标等级压回 100 以内（段位系数就不再是 0 ⇒ 与末段口径脱节）',
    rel: 'src/game/data/lateExplore.js',
    from: "  [102, '霜果集', [58, 174]",
    to: "  [92, '霜果集', [58, 174]",
    expect: 'Lv102~120 每 2 级一件',
  },
  {
    name: '② 掉落塞超纲物品（Lv112 的赤霄陨铁掉给 Lv102 目标 ⇒ 112 > 102+5）',
    rel: 'src/game/data/lateExplore.js',
    from: "[['late_for_02', 0.35], ['late_fish_01', 0.28]]],\n  [104",
    to: "[['late_min_02', 0.35], ['late_fish_01', 0.28]]],\n  [104",
    expect: '等级带 ≤ 目标+5',
  },
  {
    name: '③ 概率自创取值（0.5 不在既有 {0.28/0.35} 里 ⇒ 难度系数桶口径被绕开）',
    rel: 'src/game/data/lateExplore.js',
    from: "[['late_for_02', 0.35], ['late_fish_01', 0.28]]],\n  [104",
    to: "[['late_for_02', 0.5], ['late_fish_01', 0.28]]],\n  [104",
    expect: '概率沿用既有',
  },
  {
    name: '④ 副作用导入漏接（`spoilBalance` 不 import 扩展 ⇒ 那张表在它眼里仍是 200 条）',
    rel: 'src/game/data/spoilBalance.js',
    from: "import './lateExplore.js' // 副作用：扩展目标（腐坏时长曲线按目标表算，漏了会少算新档）\n",
    to: '',
    // 🔴 这条最初是**记录性**用例（当时确实抓不到：C75 走的是 system_test 自己的 import）。
    //    补上 C75 第 ⑤ 条「静态断言：消费方必须引用 lateExplore」之后，它变成正式用例。
    expect: '消费方都显式导入了扩展模块',
  },
]

const run = () => {
  try {
    return { code: 0, out: execFileSync(process.execPath, ['scripts/ci/system_test.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }) }
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

const ONLY = process.argv.slice(2).map(Number).filter((n) => n >= 1)
const PICK = CASES.map((c, i) => [c, i + 1]).filter(([, i]) => (ONLY.length ? ONLY.includes(i) : true))

const backups = new Map()
let okAll = true
for (const [c, idx] of PICK) {
  if (!backups.has(c.rel)) backups.set(c.rel, readFileSync(P(c.rel), 'utf8'))
  try { injectText(c.rel, c.from, c.to) } catch (e) { console.log(`⚠ ${c.name} —— 注入失败：${e.message}`); okAll = false; continue }
  const r = run()
  if (c.recordOnly) {
    console.log(`${r.code === 0 ? '⚠' : 'ℹ'} ${String(idx).padStart(2)}. ${c.name} → ${r.code === 0 ? '全绿（证实盲区）' : 'FAIL（有意外的守卫抓到了）'}`)
  } else {
    const hit = r.code !== 0 && r.out.includes('FAIL') && r.out.includes(c.expect)
    console.log(`${hit ? '✅' : '❌'} ${String(idx).padStart(2)}. ${c.name} → ${r.code === 0 ? 'system_test 仍全绿（假绿！）' : 'FAIL'}，点名含「${c.expect}」= ${r.out.includes(c.expect)}`)
    if (!hit) {
      okAll = false
      console.log(r.out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 4).join('\n'))
    }
  }
  writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
}
for (const [rel, content] of backups) writeFileSync(P(rel), content, 'utf8')

const back = run()
const clean = back.code === 0 && /失败 0/.test(back.out)
console.log(`${clean ? '✅' : '❌'} 还原后 system_test 全绿（${(back.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}）`)
console.log(okAll && clean ? `\n反例验证通过：${PICK.length} 个注入缺陷全部被点名，还原后恢复全绿` : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)