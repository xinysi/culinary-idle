import fs from 'node:fs'
const p = 'scripts/sim/full_run.mjs'
let s = fs.readFileSync(p, 'utf8')
const log = []
const repl = (a, b, tag) => { if (!s.includes(a)) { log.push('❌ ' + tag); return } s = s.split(a).join(b); log.push('✅ ' + tag) }

// ① 虚拟时钟：抄 growth_sim —— 引擎读 Date.now()，不推时钟就"没有时间流逝"，tick 自然不产出
repl(`import { CROPS } from '../../src/game/skills/FarmingSkill.js'`,
`import { CROPS } from '../../src/game/skills/FarmingSkill.js'

// 🔴 **必须替换全局时钟**（抄 growth_sim.mjs 的做法）：引擎的时间闸门读 Date.now()，
//    不推它 = 「没有时间流逝」⇒ tick 再多次也不产出（我第一版就是卡在这，48h 零进展 ✗）。
let SIM_NOW = Date.now()
const REAL_NOW = Date.now
Date.now = () => SIM_NOW`, '虚拟时钟')

// ② 步长改小（growth_sim 用 10 秒；大步长可能被内部闸门截断）
repl(`const STEP_MIN = 10            // 每步推进 10 分钟游戏时间`,
`const STEP_SEC = 10            // 每步推进 10 秒游戏时间（与 growth_sim 同粒度）\nconst TICK = STEP_SEC * 1000`, '步长改 10 秒')

// ③ 目标 id 取 itemId 在前（growth_sim 的写法），并推进时钟
repl(`      const tid = best && (best.id ?? best.itemId ?? best.seedId)
      if (tid) p.setSkillTarget?.(inst.id, tid)   // ⚠️ 走 store 的出口（实例上没有 setTarget）
      inst.tick(dt)`,
`      const tid = best && (best.itemId ?? best.id ?? best.seedId)  // ⚠️ itemId 在前（growth_sim 的写法）
      if (tid) p.setSkillTarget?.(inst.id, tid)
      inst.tick(TICK)
      SIM_NOW += TICK`, '目标 id + 推时钟')

// ④ 每步只推进 10 秒 ⇒ 步数要放大（默认 288 步 × 10s = 48 分钟；改成按小时换算）
repl(`const STEPS = Number(process.argv[process.argv.indexOf('--steps') + 1] || 0) || 288 // 288×10min = 48h`,
`const HOURS = Number(process.argv[process.argv.indexOf('--hours') + 1] || 0) || 24
const STEPS = Math.round(HOURS * 3600 / 10)   // 每步 10 秒`, '步数按小时算')

// ⑤ 制作与战斗的 tick 也统一用 TICK + 推时钟；记录点按小时换算
s = s.replace(`        inst.tick(dt)\n      }`, `        inst.tick(TICK)\n      }`)
s = s.replace(`  const dt = STEP_MIN * MIN`, `  const dt = TICK`)
s = s.replace(`  // ④ 每 12 步（2 小时）记一次\n  if (step % 12 === 0) {`, `  // ④ 每 720 步（2 小时）记一次\n  if (step % 720 === 0) {`)
s = s.replace(`    s.hour = step * STEP_MIN / 60`, `    s.hour = +(step * STEP_SEC / 3600).toFixed(1)`)
s = s.replace(`console.log(\`新档起步 → 模拟 \${STEPS * STEP_MIN / 60} 小时（每步 \${STEP_MIN} 分钟，策略=挑最高档/能做就做/打得过就打）\\n\`)`,
  `console.log(\`新档起步 → 模拟 \${HOURS} 小时（每步 \${STEP_SEC} 秒，虚拟时钟，策略=挑最高档/能做就做/打得过就打）\\n\`)`)
s = s.replace(`  p.combat.start?.(opp)`, `  if (SIM_NOW <= Date.now()) SIM_NOW += 0\n      p.combat.start?.(opp)`)
fs.writeFileSync(p, s, 'utf8')
log.push('✅ 写盘')
console.log(log.join('\n'))
