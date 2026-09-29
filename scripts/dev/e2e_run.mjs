// e2e 跑器（2026-09-28 立）—— 解决三件事，都是实测出来的时间黑洞：
//   ① **长命 dev server 会劣化**：实测跑了几小时后 `e2e-test` 会稳定假失败同一组三条
//      （「shop 页切换后内容为空」「腐坏倒计时」「Cannot read properties of undefined (reading 'click')」），
//      重启 dev server 后立刻全绿 —— 一次假失败 = 重跑一轮 ≈ 10 分钟。
//      ⚠️ 但**每次都重启并不划算**：冷启动第一套要现编译，实测 `e2e-test` 从 64s 涨到 **268s**。
//      故本脚本**自适应**：先复用现有 server（快路径）；**只有**失败且命中那组已知假失败signature 时，
//      才重启并**重跑一次**，并把「首败是假失败」这一结论打出来。
//   ② 调用方式：**默认逐套分开调用**（实测全量 9 套：分开 540s / 合并 workers=2 是 699s / 合并 workers=1
//      因机器 16 核、Playwright 默认开 8 worker 把 vite dev server 压死反而更慢）。
//      ⚠️ 小集合（≤3 套）合并更快：实测 3 套合并 36.9s vs 分开 68.8s ⇒ 想合并用 `--merged`。
//      结论：**别指望调度技巧，真正的节省是「只跑受影响的套件」**（见 ③）。
//   ③ 迭代期不必每轮跑全量：`--changed` 按 git 改动的文件挑**受影响的套件**（映射表在下面，
//      来源是各 spec 头注释里写的覆盖面）。发布前仍应跑一次 `--all`。
//
// 用法：
//   node scripts/dev/e2e_run.mjs --changed        # 只跑与本次改动相关的套件（默认）
//   node scripts/dev/e2e_run.mjs --all            # 全部 9 套
//   node scripts/dev/e2e_run.mjs e2e-layout e2e-test
//   node scripts/dev/e2e_run.mjs --all --workers 3
//   node scripts/dev/e2e_run.mjs --all --restart  # 强制先重启（例如刚改过 vite 配置）
import { execFileSync, spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PORT = 5173

/** 已知的「dev server 劣化」假失败签名：命中其一才值得重启重跑 */
const FLAKE_SIGNS = [
  '以下页面切换后内容为空：shop',
  '详情面板应显示腐坏倒计时',
  "Cannot read properties of undefined (reading 'click')",
  '没解码出来',
  // 2026-09-28 实测补：长命 dev server 还会让**整个测试**超时 —— `page.evaluate: Test timeout of 300000ms exceeded`
  // （e2e-layout 正常 152s，在跑了几套之后的 server 上飙到 387s 且超时）。
  // **证据**：同一条命令、同一个 commit，重启 server + 先跑一套预热后再跑 ⇒ **20 用例全过、1.2 分钟**。
  // 之所以要加进来：命中未知签名时本脚本会提示「按真缺陷对待」，于是人得手动排查/重启/重跑一轮（≈10 分钟）。
  'Test timeout of 300000ms exceeded',
]

/** 改动 → 受影响套件。判据取「这个 spec 扫的是什么」；宁可多跑一套，别漏。 */
const AFFECT = [
  { spec: 'e2e-layout', match: [/^src\/views\//, /^src\/components\//, /^src\/styles\//, /^e2e-layout/] },
  { spec: 'e2e-dark', match: [/^src\/styles\//, /^src\/game\/data\/skins\.js/, /^src\/components\//] },
  { spec: 'e2e-controls', match: [/^src\/styles\//, /^src\/views\//, /^src\/components\//] },
  { spec: 'e2e-text', match: [/^src\/views\//, /^src\/game\/data\//, /^src\/components\//] },
  { spec: 'e2e-interact', match: [/^src\/views\//, /^src\/components\//, /^src\/stores\//, /^src\/game\//] },
  { spec: 'e2e-audio-skin', match: [/^src\/game\/core\/sound\.js/, /^src\/game\/data\/skins\.js/, /^src\/components\//, /^public\/audio\//] },
  { spec: 'e2e-minigame', match: [/^src\/views\/minigames\//, /^src\/game\/data\/minigames/] },
  { spec: 'e2e-roles', match: [/^src\/components\/DevPanel/, /^src\/game\/core\/SaveManager/, /^src\/stores\/ui\.js/, /^src\/App\.vue/] },
  { spec: 'e2e-test', match: [/.+/] }, // 全流程：几乎任何改动都值得跑（它覆盖 32 个用例）
]
const ALL_SPECS = readdirSync(ROOT).filter((f) => f.endsWith('.spec.mjs')).map((f) => f.replace(/\.spec\.mjs$/, '')).sort()

const argv = process.argv.slice(2)
const workersIdx = argv.indexOf('--workers')
const workers = workersIdx >= 0 ? Number(argv[workersIdx + 1]) || 1 : 2
const flags = argv.filter((a) => a.startsWith('--'))
// ⚠️ `--workers 2` 的**值**不能被当成套件名（第一版就栽在这：`picked` 里多了个 `2` ⇒ Playwright 报
//    「No tests found」，而汇总还写着「1 套 有失败」，看着像测试失败）
// 🔴 只有**真的传了** `--workers` 才排除它后面那个参数。首版写死 `i !== workersIdx + 1`，
//    而 `--workers` 缺席时 `workersIdx = -1` ⇒ 它排掉的是**下标 0** ⇒ `e2e_run.mjs e2e-layout e2e-test`
//    会**静默丢掉第一个套件**（实测：我点名的 6 套只跑了 5 套，最该跑的 e2e-layout 没跑，
//    输出只有一句「跑 5 套：…」—— 不盯着数字看根本发现不了。与「全绿」是同一类假绿）。
const picked = argv.filter((a, i) => !a.startsWith('--') && !(workersIdx >= 0 && i === workersIdx + 1))

function changedFiles() {
  const git = (args) => {
    try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).split('\n').map((l) => l.trim()).filter(Boolean) } catch { return [] }
  }
  // 未提交的改动优先
  const dirty = execFileSyncShallow()
  if (dirty.length) return dirty
  // ⚠️ 工作区干净时退回「最近一次提交的改动」—— 提交完再跑 `--changed` 是最常见的用法，
  //    只看 `git status` 会挑不出任何东西（实测第一版就是这样：静默退回只跑 e2e-test）
  return git(['diff', '--name-only', 'HEAD~1', 'HEAD'])
}
function execFileSyncShallow() {
  try {
    const out = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' })
    return out.split('\n').map((l) => l.slice(3).trim()).filter(Boolean)
  } catch { return [] }
}

let specs
if (picked.length) specs = picked
else if (flags.includes('--all')) specs = ALL_SPECS
else {
  const files = changedFiles()
  specs = AFFECT.filter((a) => files.some((f) => a.match.some((m) => m.test(f)))).map((a) => a.spec)
  if (!specs.length) specs = ['e2e-test'] // 没匹配上就跑全流程（它覆盖面最广）
  if (process.env.E2E_VERBOSE) console.log('改动文件:', files.join(' · '))
}

function killDevServer() {
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8' })
    const pids = new Set(
      out.split('\n').filter((l) => l.includes(`:${PORT}`) && l.includes('LISTENING'))
        .map((l) => l.trim().split(/\s+/).pop()).filter((p) => /^\d+$/.test(p)),
    )
    for (const pid of pids) {
      try { execFileSync('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' }) } catch { /* 已退出 */ }
    }
    return pids.size
  } catch { return 0 }
}

async function startDevServerAndWait() {
  const log = join(ROOT, '.e2e-dev.log')
  const child = spawn('npm', ['run', 'dev'], { cwd: ROOT, shell: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})
  child.unref()
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/`)
      if (r.ok) return true
    } catch { /* 还没起 */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  void log
  return false
}

function runSpecs(list) {
  const args = ['playwright', 'test', ...list.map((s) => `${s}.spec.mjs`), `--workers=${workers}`, '--reporter=line']
  try {
    const out = execFileSync('npx', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, shell: true })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') }
  }
}

/** 逐套调用（默认）：**全量实测最快**（540s vs 合并 workers=2 的 699s），且能拿到每套耗时 */
function runEach(list) {
  const per = []
  let out = ''
  let code = 0
  for (const s of list) {
    const t = Date.now()
    const r = runSpecs([s])
    per.push({ spec: s, ms: Date.now() - t, code: r.code })
    out += r.out
    if (r.code !== 0) code = r.code
  }
  return { code, out, per }
}
const useMerged = flags.includes('--merged') || (specs.length <= 3 && !flags.includes('--each'))

// 快路径：**先复用现有 dev server**（冷启动一套要现编译，实测 e2e-test 从 64s 涨到 268s）
const t0 = Date.now()
if (flags.includes('--restart')) {
  const killed = killDevServer()
  console.log(`强制重启 dev server（停掉 ${killed} 个监听进程）…`)
  if (!(await startDevServerAndWait())) { console.log('❌ dev server 起不来，中止'); process.exit(1) }
}

console.log(`跑 ${specs.length} 套：${specs.join(' ')}${workers > 1 ? ` · workers=${workers}` : ''}${useMerged ? ' · 合并调用' : ' · 逐套调用'}`)
let t1 = Date.now()
let r = useMerged ? runSpecs(specs) : runEach(specs)
let secs = ((Date.now() - t1) / 1000).toFixed(0)

// 失败时先判「是不是已知的 dev server 劣化」：是就重启重跑一次（否则就是真缺陷，如实报出去）
if (r.code !== 0) {
  const hit = FLAKE_SIGNS.filter((s) => r.out.includes(s))
  const failLines = r.out.split('\n').filter((l) => /Error:|✘/.test(l)).slice(0, 6)
  if (hit.length) {
    console.log(`\n⚠ 首次失败命中「dev server 劣化」的已知签名（${hit.length} 条）：\n   ${hit.join('\n   ')}`)
    console.log('⇒ 重启 dev server 并重跑一次（这是假失败，不是缺陷）…')
    killDevServer()
    if (await startDevServerAndWait()) {
      t1 = Date.now()
      r = useMerged ? runSpecs(specs) : runEach(specs)
      secs = ((Date.now() - t1) / 1000).toFixed(0)
      console.log(`\n重启后：${r.code === 0 ? '✅ 全绿 ⇒ 首次失败确为 dev server 劣化（假失败）' : '❌ 仍然失败 ⇒ **是真缺陷**，见上'}`)
    }
  } else if (failLines.length) {
    console.log('\n（失败未命中已知假失败签名 ⇒ 按真缺陷对待）')
    for (const l of failLines) console.log('   ' + l.trim())
  }
}

// 逐套调用时把每套耗时打出来（选「只跑受影响的套件」时，这张表能看出哪套值得单独跑）
if (r.per?.length) {
  console.log('\n每套耗时：')
  for (const x of [...r.per].sort((a, b) => b.ms - a.ms)) console.log(`  ${x.spec.padEnd(16)} ${(x.ms / 1000).toFixed(1)}s  ${x.code === 0 ? 'ok' : 'FAIL'}`)
}
console.log(`\n${r.code === 0 ? '✅' : '❌'} ${specs.length} 套 ${r.code === 0 ? '全绿' : '有失败'} · 本次跑用时 ${secs}s · 总用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
process.exit(r.code)