// 反例验证：战斗深度 v1（C59）——逐个注入真缺陷 → 跑 system_test → 断言 FAIL 且点名 → 还原。
// 用法：node scripts/dev/verify_c59.mjs      （每次注入跑一遍 system_test；共 10 例）
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
    name: '① 去掉装备命中封顶（杠杆失控，实测能把命中率推到 90%）',
    rel: T,
    from: 'export const ACC_GEAR_CAP = 120', to: 'export const ACC_GEAR_CAP = 999999',
    expect: '仍被封顶',
  },
  {
    name: '② 触发率上限设成 0.99（在等级范围内永远咬不住 ⇒ 死上限）',
    rel: T,
    from: 'export const STATUS_TRIGGER_MAX = 0.45', to: 'export const STATUS_TRIGGER_MAX = 0.99',
    expect: '满级真的触到上限',
  },
  {
    name: '③ 抗性表写反（让敌人抗「它自己的风格」的状态，而不是它被克的那个）',
    rel: T,
    from: 'export function resistedStatusOf(enemyStyle) {\n  const counter = counterStyleOf(enemyStyle)\n  return counter ? STYLE_STATUS[counter] : null\n}',
    to: 'export function resistedStatusOf(enemyStyle) {\n  return STYLE_STATUS[enemyStyle] ?? null\n}',
    expect: '抗性表',
  },
  {
    name: '④ 首领抗性写成和普通一样（首领不再免疫）',
    rel: T,
    from: 'export const BOSS_RESIST_MULT = 0', to: 'export const BOSS_RESIST_MULT = 0.5',
    expect: '首领一定低于普通',
  },
  {
    name: '⑤ 破防只写在界面（引擎的 enemyDef 不读 dBreak ⇒ 显示降防、结算没降）',
    rel: C,
    from: '    return COMBAT_DEPTH_V1 && this.enemyStatus.dBreak > 0 ? brokenDef(base) : base',
    to: '    return base',
    expect: '破防生效时敌人防御下降',
  },
  {
    name: '⑥ 状态改成叠加而不是刷新（高频攻击把 DoT 叠成无限）',
    rel: C,
    from: '    this.enemyStatus[statusId] = STATUS_TURNS // 刷新而不是叠加（避免高频攻击把 DoT 叠成无限）',
    to: '    this.enemyStatus[statusId] = (this.enemyStatus[statusId] ?? 0) + STATUS_TURNS',
    expect: '刷新回合数',
  },
  {
    name: '⑦ 命中后不再施加状态（新机制其实没接上）',
    rel: C,
    from: '    if (COMBAT_DEPTH_V1 && this.opponentHp > 0) this.tryApplyStatus(o)',
    to: '    if (false && this.opponentHp > 0) this.tryApplyStatus(o)',
    expect: '命中后能对敌人施加状态',
  },
  {
    name: '⑧ DoT 不计入 damageDealt（经验口径与伤害脱钩）',
    rel: C,
    from: '    const effDmg = Math.min(dmg, this.opponentHp)\n    this.damageDealt = (this.damageDealt ?? 0) + effDmg\n    this.opponentHp = Math.max(0, this.opponentHp - dmg)\n    this.logLine(`${label}（对手生命值 ${this.opponentHp + effDmg} → ${this.opponentHp}）`)',
    to: '    const effDmg = Math.min(dmg, this.opponentHp)\n    this.opponentHp = Math.max(0, this.opponentHp - dmg)\n    this.logLine(`${label}（对手生命值 ${this.opponentHp + effDmg} → ${this.opponentHp}）`)',
    expect: '计入 damageDealt',
  },
  {
    name: '⑨ 战斗屏手写状态名（显示不再走唯一出口）',
    rel: 'src/components/CombatArena.vue',
    from: '{{ STATUS_INFO[id].icon }} {{ STATUS_INFO[id].name }} {{ left }}',
    to: '{{ STATUS_INFO[id].icon }} 割伤 {{ left }}',
    expect: '不手写状态名',
  },
  {
    name: '⑩ 冻结的敌人数据被动过（acc 全 +1）',
    rel: 'src/game/data/combat.js',
    from: '    acc: 10 + level * 2,', to: '    acc: 11 + level * 2,',
    expect: '冻结基线',
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
