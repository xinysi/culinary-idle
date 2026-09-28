// 并行「注入-验证」执行器（2026-09-28 立）——各反例脚本（verify_c*.mjs）共用。
//
// 为什么需要：反例验证的纪律是「每个注入缺陷都必须让守卫 FAIL 并点名」，而**每个注入都要跑一遍
// 完整 `system_test`（实测 27s）**。verify_c67 有 22 个注入 ⇒ 算上基线，**25 × 27s ≈ 11 分钟**，
// 这是整条发布流程里最贵、且**完全可并行**的一段（彼此独立：各自改文件、各自跑一次）。
//
// 做法：每个并发槽位建一份**仓库副本**（只复制跑 system_test 需要的 `src/`、`scripts/`、
// `e2e-*.spec.mjs`、`package.json`、`README.md`），并用 **junction 链到真仓库的 `node_modules`**
// （Windows 下 `fs.symlinkSync(..., 'junction')` 不需要管理员权限；复制 node_modules 是 276MB，太贵）。
// 每个槽位串行处理分到的注入（注入 → 跑 → 还原），跑完删掉副本。
//
// ⚠️ 三条不变量：
//   ① **注入失败（锚点不匹配）必须记为失败**，不能静默跳过（本地反例脚本一直这么做，继续保持）；
//   ② 每个槽位用**自己的副本**，绝不并发改同一份工作区（否则互相污染、得出假结论）；
//   ③ 最后必须**在真仓库里再跑一次基线**，确认还原干净（副本删掉不等于真仓库没被动过）。
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const COPY_ENTRIES = ['src', 'scripts', 'package.json', 'README.md'] // ⚠️ 别拷 public/images（2400+ 张图，system_test 用不到，白拷几十 MB × 槽位数）

/** 建一份可跑 system_test 的仓库副本（src/scripts/根文件 + junction 到 node_modules） */
function makeWorktree() {
  const dir = mkdtempSync(join(tmpdir(), 'verify-'))
  for (const rel of COPY_ENTRIES) {
    const from = join(REPO_ROOT, rel)
    if (!existsSync(from)) continue
    cpSync(from, join(dir, rel), { recursive: true })
  }
  symlinkSync(join(REPO_ROOT, 'node_modules'), join(dir, 'node_modules'), 'junction')
  return dir
}

function runOnce(cwd) {
  try {
    const out = execFileSync(process.execPath, ['scripts/ci/system_test.mjs'], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') }
  }
}

/** 按文件实际换行折叠锚点（`bootstrap.js` 是 CRLF、`player.js` 是 LF —— 照抄 LF 会「匹配 0 次」） */
function injectAt(root, rel, from, to) {
  const p = join(root, rel)
  const orig = readFileSync(p, 'utf8')
  const norm = (s) => (orig.includes('\r\n') ? s.replace(/\r?\n/g, '\r\n') : s.replace(/\r?\n/g, '\n'))
  const f = norm(from)
  const t = norm(to)
  const n = orig.split(f).length - 1
  if (n !== 1) throw new Error(`锚点匹配 ${n} 次（期望 1）：${f.slice(0, 60)}`)
  writeFileSync(p, orig.replace(f, t), 'utf8')
  return orig
}

/**
 * 跑一组反例。
 * @param {string} title 人类可读标题（打印用）
 * @param {Array<{name:string,rel:string,from:string,to:string,expect:string}>} cases
 * @param {{workers?:number, baseline?:boolean}} opts
 * @returns {boolean} 是否全部通过（含还原后基线）
 */
export async function runCases(title, cases, opts = {}) {
  const workers = Math.max(1, Math.min(opts.workers ?? 6, cases.length))
  const t0 = Date.now()
  console.log(`\n══ ${title}：${cases.length} 个注入 · 并发 ${workers} ══`)

  // 基线（真仓库里先跑一次，应当全绿）
  const base = runOnce(REPO_ROOT)
  const baseOk = base.code === 0 && /失败 0/.test(base.out)
  console.log(`${baseOk ? '✅' : '❌'} 基线：${(base.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}`)

  // 把 cases 分给 workers 个槽位，每个槽位处理自己被分到的那批（槽内串行、槽间并行）
  const buckets = Array.from({ length: workers }, () => [])
  cases.forEach((c, i) => buckets[i % workers].push({ ...c, idx: i }))
  const results = new Array(cases.length)

  await Promise.all(buckets.map(async (bucket, wi) => {
    if (!bucket.length) return
    let dir
    try {
      dir = makeWorktree()
      for (const c of bucket) {
        const label = `[w${wi}] ${c.idx + 1}/${cases.length}`
        try {
          injectAt(dir, c.rel, c.from, c.to)
        } catch (e) {
          results[c.idx] = { ok: false, why: `注入失败：${e.message}` }
          console.log(`⚠ ${c.name} —— 注入失败：${e.message}`)
          continue
        }
        const r = runOnce(dir)
        const hit = r.code !== 0 && r.out.includes('FAIL') && r.out.includes(c.expect)
        results[c.idx] = { ok: hit, why: r.code === 0 ? 'system_test 仍全绿（假绿！）' : 'FAIL 但未点名' }
        console.log(`${hit ? '✅' : '❌'} ${String(c.idx + 1).padStart(2, '0')} ${c.name} → ${hit ? 'FAIL 并点名' : results[c.idx].why}`)
        void label
      }
    } finally {
      if (dir) rmSync(dir, { recursive: true, force: true })
    }
  }))

  // 还原后基线（真仓库）
  const back = runOnce(REPO_ROOT)
  const clean = back.code === 0 && /失败 0/.test(back.out)
  const secs = ((Date.now() - t0) / 1000).toFixed(0)
  const allOk = cases.every((_, i) => results[i]?.ok)
  console.log(`${clean ? '✅' : '❌'} 还原后基线全绿（${(back.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}）· 用时 ${secs}s`)
  console.log(allOk && clean && baseOk
    ? `\n反例验证通过：${cases.length} 个注入全部被点名（并发 ${workers}，用时 ${secs}s）`
    : '\n反例验证失败，见上')
  return allOk && clean && baseOk
}