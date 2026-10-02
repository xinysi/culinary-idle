// 并行跑全套 CI 脚本（2026-09-28 立）。
//
// 为什么：18 个脚本彼此**完全独立**（各读源码/各建自己的 Pinia），原先在 CI 与本地都是**串行**。
// 实测串行合计 **57s**（15 个时），其中 `system_test` 独占 27s（47%）、`continuity_test` 13s；
// 2026-09-28 新增 3 条接线守卫（各 <1s，合计不到 2s）。
// 并发受限执行后 ≈ **30s**（下限由最慢的那个脚本决定）——省得不多，但顺带给出**耗时表**，
// 以后「哪个脚本变慢了」一眼看得见（此前只能靠感觉）。
//
// 用法：
//   node scripts/ci/run_all.mjs                      # 核心 18 个（并发 4，约 27s）
//   node scripts/ci/run_all.mjs --jobs 8             # 指定并发
//   node scripts/ci/run_all.mjs --with-build         # 另加需要 dist/ 的两条（先自行 npm run build）
//   node scripts/ci/run_all.mjs --slow               # 另加 exe_image_audit（132s，查打包产物）
//   node scripts/ci/run_all.mjs system_test audit_sync   # 只跑指定几个
//
// ⚠️ 判据是**退出码**，不是输出尾部有没有红字（本项目踩过：`| tail` 漏掉 FAIL 行，本地以为全绿）。
//    失败时本脚本把该脚本输出里的 FAIL 行打出来，不必再去翻日志。
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CI_DIR = join(ROOT, 'scripts', 'ci')

/** 清单以 `scripts/ci/*.mjs` 为准（除本文件），免得再维护一份手写列表 */
const ALL = readdirSync(CI_DIR)
  .filter((f) => f.endsWith('.mjs') && f !== 'run_all.mjs')
  .map((f) => f.replace(/\.mjs$/, ''))
  .sort()

// 分三组（依据是**依赖关系**，不是猜测；与 .github/workflows/ci.yml 的步骤划分一致）：
//   · CORE：不依赖构建产物，随时可跑（= CI workflow 的 Simulation suites 那一步 + action_sweep）
//   · POST_BUILD：**必须先 `npm run build`**（要读 dist/），否则结果无意义
//     （css_output_audit 比对产物里的 CSS；dev_panel_audit 断言产物里没有 DevPanel chunk）
//   · SLOW：查 Electron 打包产物，**本地很慢**（实测 132.8s，比其它全部加起来还贵），
//     只在需要时单独跑（`--slow`）
const CORE = [
  'chain_reaction_test', 'xp_log_audit', 'system_test', 'season_check', 'system_test2', 'buff_test', 'continuity_test',
  'audit_sync', 'content_sync_audit', 'item_triple_audit', 'minigame_ui_audit',
  'voice_audit',
  'difficulty_audit', 'image_path_audit', 'bgm_audit', 'gen_drift_audit',
  'template_binding_audit', 'action_sweep',
  // 2026-09-28 立：全量体检抓到的三类「不报错、也不生效」的接线缺陷，各配一条守卫
  'event_wiring_audit',    // 凡有 EventBus.on 必有 emit（抓死监听）
  'effect_binding_audit',  // 效果登记表 p.NAME 必须存在于真实 store（抓 ?.() 掩盖的错名）
  'timer_lifecycle_audit', // 会重启玩法的 setTimeout 句柄必须被跟踪 + setInterval 必须配对
  'unused_import_audit',   // `.vue` 里导入了却没用的符号（本项目没有 eslint，这类噪声此前无人管）
  'ui_tick_audit',         // 10Hz 引擎节拍只给该给的人（显式名单 + 慢节拍不许开太快）
]
const POST_BUILD = ['css_output_audit', 'dev_panel_audit']
const SLOW = ['exe_image_audit']

const argv = process.argv.slice(2)
const jobsIdx = argv.indexOf('--jobs')
const jobs = jobsIdx >= 0 ? Math.max(1, Number(argv[jobsIdx + 1]) || 4) : 4
const picked = argv.filter((a, i) => !a.startsWith('--') && i !== jobsIdx + 1)
let scripts = picked.length ? picked : [...CORE]
if (!picked.length && argv.includes('--with-build')) scripts = [...CORE, ...POST_BUILD]
if (!picked.length && argv.includes('--slow')) scripts = [...CORE, ...SLOW]

const missing = scripts.filter((s) => !ALL.includes(s))
if (missing.length) { console.log(`❌ 未知脚本：${missing.join(', ')}（可选：${ALL.join(', ')}）`); process.exit(1) }

function runOne(name) {
  const t0 = Date.now()
  let out = ''
  let code = 0
  try {
    out = execFileSync(process.execPath, [join(CI_DIR, `${name}.mjs`)], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 })
  } catch (e) {
    code = e.status ?? 1
    out = (e.stdout ?? '') + (e.stderr ?? '')
  }
  const fails = out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 4)
  const result = out.match(/通过 \d+ \/ 失败 \d+/)?.[0] ?? null
  return { name, code, ms: Date.now() - t0, fails, result }
}

const results = []
let next = 0
async function worker() {
  while (next < scripts.length) {
    const i = next++
    results[i] = runOne(scripts[i])
  }
}
await Promise.all(Array.from({ length: Math.min(jobs, scripts.length) }, worker))

console.log('\n脚本                        用时      结果')
for (const r of [...results].sort((a, b) => b.ms - a.ms)) {
  console.log(`${r.name.padEnd(26)} ${String((r.ms / 1000).toFixed(1) + 's').padStart(8)}  ${r.code === 0 ? (r.result ?? 'ok') : `FAIL(${r.code})`}`)
}
const bad = results.filter((r) => r.code !== 0)
for (const b of bad) for (const l of b.fails) console.log(`  ${b.name}: ${l}`)
const wall = Math.max(...results.map((r) => r.ms)) / 1000
const serial = results.reduce((a, r) => a + r.ms, 0) / 1000
console.log(`\n${results.length} 个脚本 · 串行合计 ${serial.toFixed(1)}s · 并发 ${jobs} ⇒ 墙钟 ${wall.toFixed(1)}s+`)
console.log(bad.length ? `❌ ${bad.length} 个失败：${bad.map((b) => b.name).join(', ')}` : '✅ 全部通过')
process.exit(bad.length ? 1 : 0)