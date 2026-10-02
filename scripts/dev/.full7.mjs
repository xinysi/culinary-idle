import fs from 'node:fs'
const P = 'scripts/sim/full_run.mjs'
let s = fs.readFileSync(P, 'utf8')
const log = []
const repl = (a, b, tag) => { if (!s.includes(a)) { log.push('❌ ' + tag); return } s = s.split(a).join(b); log.push('✅ ' + tag) }

// ① 补 Combat 的 import（引擎实例要从模块 new 出来；`p.combat` 只是**状态对象**）
repl(`import { COMBAT_REGIONS } from '../../src/game/data/combat.js'`,
`import { COMBAT_REGIONS } from '../../src/game/data/combat.js'
import { Combat } from '../../src/game/combat/Combat.js'`, 'Combat import')

// ② 造引擎实例（抄 growth_sim：new 一个，而不是读 p.combat —— 那是状态对象，第三次踩这个坑了）
repl(`let combatLv = 0, fights = 0
try {
  const start = p.combatLevel ?? 1`,
`let combatLv = 0, fights = 0
try {
  // ⚠️ p.combat 是**状态对象**不是引擎实例（与 p.branches 同类）⇒ 引擎要 new 出来
  const combat = new Combat(p)
  const start = p.combatLevel ?? 1`, '引擎实例 new 出来')

// ③ 三处调用改成实例上的
s = s.replace(`    if (!opp || !p.combat) break
    p.combat.start(opp); fights++
    let g = 0
    while (p.combat.inFight && g++ < 400) { p.combat.tick(5000); SIM_NOW += 5000 }`,
`    if (!opp || !combat) break
    if (!combat.start(opp)) break   // start 返回 false = 被重生门/条件挡住
    fights++
    let g = 0
    while (combat.inFight && g++ < 400) { combat.tick(5000); SIM_NOW += 5000 }`)
log.push('✅ 对决调用改到实例上')

let done = false
for (let i = 0; i < 5; i++) { try { fs.writeFileSync(P, s, 'utf8'); done = true; break } catch (e) { await new Promise((r) => setTimeout(r, 600)) } }
log.push(done ? '✅ 写盘' : '❌ 写盘失败')
console.log(log.join('\n'))
