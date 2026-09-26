// 反例验证：越级重击（C60）——逐个注入真缺陷 → 跑 system_test → 断言 FAIL 且点名 → 还原。
// 用法：node scripts/dev/verify_c60.mjs      （每次注入跑一遍 system_test；共 9 例）
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const P = (rel) => join(root, rel)

function inject(rel, from, to) {
  const orig = readFileSync(P(rel), 'utf8')
  const n = orig.split(from).length - 1
  if (n !== 1) throw new Error(`${rel} 锚点匹配 ${n} 次（期望 1）：${from.slice(0, 60)}`)
  writeFileSync(P(rel), orig.replace(from, to), 'utf8')
}

const T = 'src/game/data/combatTuning.js'
const C = 'src/game/combat/Combat.js'

const CASES = [
  {
    name: '① 取消防越级阈值（gap ≤ 1 也触发 ⇒ 同等级战斗被改动，全部标定作废）',
    rel: T,
    from: 'export const HEAVY_GAP_FREE = 1.15', to: 'export const HEAVY_GAP_FREE = 0',
    expect: '恒不触发',
  },
  {
    name: '② 去掉幅度封顶（越级越多无限涨 ⇒ 数值失控）',
    rel: T,
    from: '  return Math.min(HEAVY_PCT_CAP, over * HEAVY_PCT_SLOPE)',
    to: '  return over * HEAVY_PCT_SLOPE',
    expect: '单调不减',
  },
  {
    name: '③ 斜率写负（越级越多反而越轻 —— 规则方向反了）',
    rel: T,
    from: 'export const HEAVY_PCT_SLOPE = 0.35', to: 'export const HEAVY_PCT_SLOPE = -0.35',
    expect: '单调不减',
  },
  {
    name: '④ 概率不封顶（gap 一大就每回合必中）',
    rel: T,
    from: '  return Math.min(HEAVY_CHANCE_CAP, over * HEAVY_CHANCE_SLOPE)',
    to: '  return over * HEAVY_CHANCE_SLOPE',
    expect: '触发概率恒 ≤ 1',
  },
  {
    name: '⑤ 重击不吃受击减免（玩家的反制失效）',
    rel: T,
    from: '  return Math.max(1, Math.floor(raw * (1 - (Number(damageTakenPct) || 0) / 100)))',
    to: '  void damageTakenPct\n  return Math.max(1, raw)',
    expect: '受击减免',
  },
  {
    name: '⑥ 致命线推到很远（gap 6 才致命 ⇒ 「越级 4 倍」不再有风险）',
    rel: T,
    from: 'export const HEAVY_PCT_CAP = 1.4', to: 'export const HEAVY_PCT_CAP = 0.2',
    expect: '一击致命',
  },
  {
    name: '⑦ 去掉「一次/场」的守卫（同一场能连打两次重击）',
    rel: C,
    from: '    if (!this.heavyFired && hch > 0 && Math.random() < hch) {',
    to: '    if (hch > 0 && Math.random() < hch) {',
    expect: '一场只触发一次',
  },
  {
    name: '⑧ 引擎不再调用它（新机制其实没接上）',
    rel: C,
    from: '    if (!this.heavyFired && hch > 0 && Math.random() < hch) {',
    to: '    if (false && hch > 0 && Math.random() < hch) {',
    expect: '掷中即触发',
  },
  {
    name: '⑩ 去掉「概率 0 就不掷」的短路（同等级也会白吃一个随机数 ⇒ 逐次一致被破坏）',
    rel: C,
    from: '    if (!this.heavyFired && hch > 0 && Math.random() < hch) {',
    to: '    if (!this.heavyFired && Math.random() < hch) {',
    expect: 'hch > 0',
  },
  {
    name: '⑨ 详情页手写文案（显示不再走唯一出口）',
    rel: 'src/views/CombatView.vue',
    from: '  return b ? heavyText(b.level, player.combatLevel) : null',
    to: "  return b ? `越级风险：可能被打死` : null",
    expect: '不手写文案',
  },
]

const run = () => {
  try {
    return { code: 0, out: execFileSync(process.execPath, ['scripts/ci/system_test.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }) }
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

const backups = new Map()
let okAll = true
for (const c of CASES) {
  if (!backups.has(c.rel)) backups.set(c.rel, readFileSync(P(c.rel), 'utf8'))
  try { inject(c.rel, c.from, c.to) } catch (e) { console.log(`⚠ ${c.name} —— 注入失败：${e.message}`); okAll = false; continue }
  const r = run()
  const hit = r.code !== 0 && r.out.includes('FAIL') && r.out.includes(c.expect)
  console.log(`${hit ? '✅' : '❌'} ${c.name} → ${r.code === 0 ? 'system_test 仍全绿（假绿！）' : 'FAIL'}，点名含「${c.expect}」= ${r.out.includes(c.expect)}`)
  if (!hit) {
    okAll = false
    console.log(r.out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 4).join('\n'))
  }
  writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
}
for (const [rel, content] of backups) writeFileSync(P(rel), content, 'utf8')

const back = run()
const clean = back.code === 0 && /失败 0/.test(back.out)
console.log(`${clean ? '✅' : '❌'} 还原后 system_test 全绿（${(back.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}）`)
console.log(okAll && clean ? `\n反例验证通过：${CASES.length} 个注入缺陷全部被点名，还原后恢复全绿` : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)
