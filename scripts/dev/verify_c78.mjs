// 反例验证：制作队列「追赶」+ 日志合并（C78，2026-09-29 B1）
// 用法：node scripts/dev/verify_c78.mjs         （全部例 × ~22 秒）
//      node scripts/dev/verify_c78.mjs 3 5      （只跑指定序号）
// ⚠️ 纪律（AGENTS 记过）：锚点单行优先；**绝不并发跑两个反例脚本**；跑完 grep 扫一遍注入标记。
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

const PS = 'src/game/skills/ProductionSkill.js'
const UI = 'src/stores/ui.js'
const BOOT = 'src/game/bootstrap.js'

const CASES = [
  {
    name: '① 退回「每次只做 1 次」（后台被降速时慢 20 倍）',
    rel: PS,
    from: '    let guard = 0\n    while (this._queueAccum >= CRAFT_QUEUE_INTERVAL_MS && guard < CRAFT_CATCHUP_MAX) {',
    to: '    let guard = 0\n    while (this._queueAccum >= CRAFT_QUEUE_INTERVAL_MS && guard < 1) {',
    expect: '连做 30 次',
  },
  {
    name: '② 追赶上限被抹掉（一次心跳做上千次）',
    rel: PS,
    from: 'export const CRAFT_CATCHUP_MAX = 300',
    to: 'export const CRAFT_CATCHUP_MAX = 1000',
    expect: '追赶上限 = 300',
  },
  {
    name: '③ 撞上限后不清余量（积压留到下一次心跳 ⇒ 无限爆发）',
    rel: PS,
    from: '    if (guard >= CRAFT_CATCHUP_MAX) this._queueAccum = 0',
    to: '    if (false) this._queueAccum = 0',
    expect: '且不把积压留到下一次心跳',
  },
  {
    name: '④ 余量清零（回到旧的「每次 _queueAccum = 0」，白丢最多 100ms/件）',
    rel: PS,
    from: '      this._queueAccum -= CRAFT_QUEUE_INTERVAL_MS\n      head.qty--',
    to: '      this._queueAccum = 0\n      head.qty--',
    expect: '余数保留',
  },
  {
    name: '⑤a 材料不足那一刻不清积压（补料后会一次性爆发几十次）',
    rel: PS,
    from: '        head.paused = true // 制作：材料不足；练习：等级不够（转生把等级打回 6 级时会遇到）\n        this._queueAccum = 0',
    to: '        head.paused = true // 制作：材料不足；练习：等级不够（转生把等级打回 6 级时会遇到）\n        this._queueAccum = this._queueAccum',
    expect: '停下的那一刻清空积压',
  },
  {
    name: '⑤b 暂停期间继续囤积时间（第二条防线：迟早会爆发）',
    rel: PS,
    from: '      if (!head || head.paused) {\n        this._queueAccum = 0 // 暂停中不囤积时间（补料/升级后从零起算，避免一恢复就爆发）',
    to: '      if (!head || head.paused) {\n        this._queueAccum = this._queueAccum // 暂停中不囤积时间（补料/升级后从零起算，避免一恢复就爆发）',
    expect: '暂停期间继续心跳也不许囤积',
  },
  {
    name: '⑥ 制作日志退回 pushLog（一次 999 份 = 999 行，日志被刷爆）',
    rel: BOOT,
    from: '    if (isCraft) ui.pushOrMergeLog(msg, kind, `${outcome}|${skillId}|${e.recipeId ?? itemId}`, { exp: expNum })',
    to: '    if (isCraft) ui.pushLog(msg, kind)',
    expect: '走合并出口',
  },
  {
    name: '⑦ 合并忽略窗口（把半天前的记录续上，变成「连续 ×999」的假汇总）',
    rel: UI,
    from: '        if (last && last.mergeKey === mergeKey && now - last.ts <= windowMs) {',
    to: '        if (last && last.mergeKey === mergeKey) {',
    expect: '超出合并窗口',
  },
  {
    name: '⑧ 合并时经验不累加（一行「连续 ×12」旁边挂单次经验 = 显示与结算不一致）',
    rel: UI,
    from: '          last.mergeExp = (last.mergeExp ?? 0) + (exp > 0 ? exp : 0)',
    to: '          last.mergeExp = exp > 0 ? exp : 0',
    expect: '经验**累加**',
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
  // 判据必须只在 **FAIL 行**里找点名（断言通过时也会把名字打在 ok 行上）
  const failLines = r.out.split('\n').filter((l) => l.startsWith('FAIL'))
  const named = failLines.some((l) => l.includes(c.expect))
  const hit = r.code !== 0 && named
  console.log(`${hit ? '✅' : '❌'} ${String(idx).padStart(2)}. ${c.name} → ${r.code === 0 ? '守则仍全绿（注入没被抓住）' : 'FAIL'}，FAIL 行点名含「${c.expect}」= ${named}`)
  if (!hit) {
    okAll = false
    console.log(failLines.slice(0, 4).join('\n') || `（没有任何 FAIL 行；输出末尾：${r.out.split('\n').slice(-3).join(' | ')}）`)
  }
  writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
}

const back = run()
const clean = back.code === 0 && /失败 0/.test(back.out)
console.log(`${clean ? '✅' : '❌'} 还原后 system_test 全绿（${(back.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}）`)
console.log(okAll && clean ? `\n反例验证通过：${PICK.length} 个注入缺陷全部被点名，还原后恢复全绿` : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)
