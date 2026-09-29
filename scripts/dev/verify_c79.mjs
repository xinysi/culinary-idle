// 反例验证：农田基础产出件数（C79，2026-09-29 A1）
// 用法：node scripts/dev/verify_c79.mjs        （全部例 × ~22 秒）
//      node scripts/dev/verify_c79.mjs 3
// ⚠️ 纪律：锚点单行优先；**绝不并发跑两个反例脚本**；跑完 grep 扫注入标记。
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
  from = fold(from); to = fold(to)
  const n = orig.split(from).length - 1
  if (n !== 1) throw new Error(`${rel} 锚点匹配 ${n} 次（期望 1）：${from.slice(0, 60)}`)
  writeFileSync(P(rel), orig.replace(from, to), 'utf8')
}

const FARM = 'src/game/skills/FarmingSkill.js'
const VIEW = 'src/views/FarmingView.vue'

const CASES = [
  {
    name: '① 常数被改回 1（等于把这条改动关掉）',
    rel: FARM,
    from: 'export const FARM_BASE_YIELD = 2',
    to: 'export const FARM_BASE_YIELD = 1',
    expect: '基础件数常数 = 2',
  },
  {
    name: '② 产出式退回字面量 1（常数成了摆设，实际仍出 1 件）',
    rel: FARM,
    from: 'let qty = FARM_BASE_YIELD + farmBonus',
    to: 'let qty = 1 + farmBonus',
    expect: '不是字面量 1',
  },
  {
    name: '③ 农耕页退回手写 1（卡片写着 1 件、实际 2 件 = 显示与结算不一致）',
    rel: VIEW,
    from: 'const base = FARM_BASE_YIELD + masteryYieldBonus(m)',
    to: 'const base = 1 + masteryYieldBonus(m)',
    expect: '期望件数',
  },
  {
    name: '④ 常数被偷偷加码到 3（超出授权的改动）',
    rel: FARM,
    from: 'export const FARM_BASE_YIELD = 2',
    to: 'export const FARM_BASE_YIELD = 3',
    expect: '基础件数常数 = 2',
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
  try {
    injectText(c.rel, c.from, c.to)
  } catch (e) {
    console.log(`⚠ ${c.name} —— 注入失败：${e.message}`)
    okAll = false
    writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
    continue
  }
  const r = run()
  const failLines = r.out.split('\n').filter((l) => l.startsWith('FAIL'))
  const named = failLines.some((l) => l.includes(c.expect))
  const hit = r.code !== 0 && named
  console.log(`${hit ? '✅' : '❌'} ${String(idx).padStart(2)}. ${c.name} → ${r.code === 0 ? '守则仍全绿（注入没被抓住）' : 'FAIL'}，FAIL 行点名含「${c.expect}」= ${named}`)
  if (!hit) {
    okAll = false
    console.log(failLines.slice(0, 4).join('\n') || '（没有任何 FAIL 行）')
  }
  writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
}

const back = run()
const clean = back.code === 0 && /失败 0/.test(back.out)
console.log(`${clean ? '✅' : '❌'} 还原后 system_test 全绿（${(back.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}）`)
console.log(okAll && clean ? `\n反例验证通过：${PICK.length} 个注入缺陷全部被点名，还原后恢复全绿` : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)
