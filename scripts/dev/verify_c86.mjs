// 反例验证：C54 扩组 —— 「低目标衰减的参照系 = 玩家**能用的最高档**」（2026-09-30 体检修的）
//   覆盖三条出口：判定函数（`isLowTargetLevel`）· 结算（`Skill.addCardXp`）· 显示（`ProductionSkill.xpPerHour`）。
// 用法：node scripts/dev/verify_c86.mjs        （全部例）
//      node scripts/dev/verify_c86.mjs 2      （只跑第 2 例；改完锚点小范围复验用）
// ⚠️ 纪律（沿用 verify_c80/81/83）：锚点单行优先、多行锚点兼容 CRLF；**绝不并发跑两个反例脚本**；
//    跑完 grep 扫注入残留（本脚本每例结束都还原，末尾再整体复跑一次确认全绿）。
// 🔴 判据：注入不进去（锚点过期）= **失败**；注入了却「守卫全绿」= **反例无效**；只认 `FAIL` 行里的点名。
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
  const f = fold(from), t = fold(to)
  const n = orig.split(f).length - 1
  if (n !== 1) throw new Error(`${rel} 锚点匹配 ${n} 次（期望 1）：${from.slice(0, 70)}`)
  writeFileSync(P(rel), orig.replace(f, t), 'utf8')
}

const SKILL = 'src/game/skills/Skill.js'
const RATE = 'src/game/core/growthRate.js'
const PROD = 'src/game/skills/ProductionSkill.js'
const EXPECT = '参照系 = 玩家**能用的最高档**'
/** 结算/显示两条出口的点名（补的行为断言） */
const EXPECT_BEHAVIOR = '结算与显示**都必须同源'

const CASES = [
  {
    // 退回「表内最高档」当参照 —— 就是这条缺陷本身
    name: '① 结算参照改回表内最高档（= 回到 2026-09-30 之前的缺陷）',
    rel: SKILL,
    from: '    const lowMult = targetLevelXpMult(this.level, targetLevel, this.topUsableTargetLevel)',
    to: '    const lowMult = targetLevelXpMult(this.level, targetLevel, this.topTargetLevel)',
    expect: EXPECT_BEHAVIOR,
  },
  {
    name: '② 参照不按等级过滤（一律取表内最小档 ⇒ 中高段全都不减半，规则被改哑）',
    rel: SKILL,
    from: '    const v = best > 0 ? best : (Number.isFinite(minLv) ? minLv : this.level)',
    to: '    const v = Number.isFinite(minLv) ? minLv : this.level',
    expect: EXPECT,
  },
  {
    name: '③ 缓存键漏掉等级（换个等级仍拿旧参照 ⇒ 界面与结算都可能失真）',
    rel: SKILL,
    from: '    if (c && c.list === list && c.n === list.length && c.lv === this.level) return c.v',
    to: '    if (c && c.list === list && c.n === list.length) return c.v',
    expect: EXPECT,
  },
  {
    // 制作类的「配方效率」（卡片上那个 /时 数字）没跟着换 ⇒ 卡片按表内最高档算、结算按能用的最高档算
    name: '④ 显示侧没跟着换（卡片「配方效率」仍按表内最高档判 ⇒ 显示与结算不一致）',
    rel: PROD,
    from: '    const lowMult = targetLevelXpMult(this.level, recipe.reqLevel, this.topUsableTargetLevel)',
    to: '    const lowMult = targetLevelXpMult(this.level, recipe.reqLevel, this.topTargetLevel)',
    expect: EXPECT_BEHAVIOR,
  },
  {
    name: '⑤ 规则被改哑：低 5 级也不减半（GAP 调到 999）',
    rel: RATE,
    from: 'export const LOW_TARGET_GAP = 5',
    to: 'export const LOW_TARGET_GAP = 999',
    expect: '低 5 级起减半',
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
    console.log(`⚠ ${c.name} —— 注入失败（锚点过期，按失败处理）：${e.message}`)
    okAll = false
    writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
    continue
  }
  const r = run()
  const failLines = r.out.split('\n').filter((l) => l.startsWith('FAIL'))
  const named = failLines.some((l) => l.includes(c.expect))
  const hit = r.code !== 0 && named
  console.log(`${hit ? '✅' : '❌'} ${String(idx).padStart(2)}. ${c.name} → ${r.code === 0 ? '守卫仍全绿（注入没被抓住）' : 'FAIL'}，点名含「${c.expect}」= ${named}`)
  if (!hit) {
    okAll = false
    console.log(failLines.slice(0, 6).join('\n') || '（没有任何 FAIL 行）')
  }
  writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
}

const back = run()
const clean = back.code === 0 && /失败 0/.test(back.out)
console.log(`${clean ? '✅' : '❌'} 还原后 system_test 全绿（${(back.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}）`)
console.log(okAll && clean ? `\n反例验证通过：${PICK.length} 个注入缺陷全部被点名，还原后恢复全绿` : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)
