import fs from 'node:fs'
const P = 'scripts/sim/full_run.mjs'
let s = fs.readFileSync(P, 'utf8')
const log = []
const repl = (a, b, tag) => { if (!s.includes(a)) { log.push('❌ ' + tag); return } s = s.split(a).join(b); log.push('✅ ' + tag) }

// ① 抄 growth_sim 的**设置段**（只抄设置，不抄"送陷阱/料理/种子"——那是它的前提，这里是本测试要量的东西）
repl(`p.newGame()
createSkillInstances(p)`,
`p.newGame()
// 抄 growth_sim 的设置段（**只抄设置，不送资源** —— 送资源正是在这里要被量出来的东西）
p.settings.autoFarm = true      // 缺这行 ⇒ 农田不种不收（上一版农耕一直 1 级就是这个原因 ✗）
p.settings.autoEat = true
p.settings.autoEatThreshold = 60
createSkillInstances(p)`, '设置段（autoFarm 等）')

// ② 制作段：能做就入队（材料只能来自前面采集出来的产出 ⇒ 缺料会当场暴露）
repl(`const NAME = { foraging:`, `/** 制作：能做就入队（**不给免费材料**：料只来自上面采集的产出）*/
function driveCraft(skillId, capMs) {
  const inst = getSkillInstance(skillId)
  if (!inst?.recipes) return { ok: false, why: '没有该技能实例/配方' }
  let ms = 0, made = 0
  while (ms < capMs) {
    const lv = p.skills[skillId]?.level ?? 1
    const r = [...inst.recipes].filter((x) => (x.reqLevel ?? 0) <= lv).sort((a, b) => (b.reqLevel ?? 0) - (a.reqLevel ?? 0))[0]
    if (!r) return { ok: false, why: 'Lv' + lv + ' 没有可用配方', hours: ms / 3600000, made }
    if (typeof inst.enqueue === 'function') inst.enqueue(r, 1)
    const lv0 = p.skills[skillId]?.level
    inst.tick(10000)
    ms += 10000
    SIM_NOW += 10000
    made++
    if (p.skills[skillId]?.level === lv0 && made > 360 && ms > 3600000) break // 一小时没升过级 ⇒ 大概率缺料
  }
  return { ok: true, hours: ms / 3600000, level: p.skills[skillId]?.level, made }
}

const NAME = { foraging:`, '制作段')

// ③ 跑制作 + 对决，并打出完整的卡点表
repl(`console.log('终点不变量：金币 ' + Math.round(p.gold ?? 0) + ' · 图鉴 ' + Object.keys(p.collected ?? {}).length + ' 件 · 背包种类 ' + Object.keys(p.inventory ?? {}).length)`,
`// ④ 制作线（材料只来自上面采集出来的产出 ⇒ 这里卡住就是供应链卡住）
const CRAFT = ['cooking', 'baking', 'brewing', 'spiceMixing', 'preserves', 'craftsmithing']
console.log('')
console.log('制作线      结果      耗时        等级')
for (const id of CRAFT) {
  const r = driveCraft(id, Math.floor(HOURS / CRAFT.length) * 3600000)
  const nm = { cooking: '烹饪', baking: '烘焙', brewing: '酿造', spiceMixing: '调料调配', preserves: '腌制', craftsmithing: '厨具锻造' }[id] ?? id
  console.log(nm.padEnd(10) + (r.ok ? '✅ 有产出 ' : '⚠️ 卡住 ').padEnd(10) + ((r.hours ?? 0).toFixed(1) + 'h').padEnd(11) + (r.level ?? '—') + (r.why ? '  ← ' + r.why : ''))
}

// ⑤ 对决：打得过就打（不吃免费料理 ⇒ 这是它真实的样子）
let combatLv = 0, fights = 0
try {
  const start = p.combatLevel ?? 1
  for (let i = 0; i < 400; i++) {
    const regions = COMBAT_REGIONS.filter((r) => (r.reqLevel ?? 0) <= (p.combatLevel ?? 1))
    const last = regions[regions.length - 1]
    const opp = (last?.opponents ?? []).filter((o) => (o.level ?? 0) <= (p.combatLevel ?? 1)).pop()
    if (!opp || !p.combat) break
    p.combat.start(opp); fights++
    let g = 0
    while (p.combat.inFight && g++ < 400) { p.combat.tick(5000); SIM_NOW += 5000 }
  }
  combatLv = p.combatLevel ?? 1
  console.log('')
  console.log('对决：起始 ' + start + ' 级 → 打完 ' + fights + ' 场后 ' + combatLv + ' 级')
} catch (e) { console.log('对决段抛错：' + String(e).slice(0, 80)) }

console.log('')
console.log('终点不变量：金币 ' + Math.round(p.gold ?? 0) + ' · 图鉴 ' + Object.keys(p.collected ?? {}).length + ' 件 · 背包种类 ' + Object.keys(p.inventory ?? {}).length)`, '制作 + 对决段')

let done = false
for (let i = 0; i < 5; i++) { try { fs.writeFileSync(P, s, 'utf8'); done = true; break } catch (e) { await new Promise((r) => setTimeout(r, 600)) } }
log.push(done ? '✅ 写盘' : '❌ 写盘失败')
console.log(log.join('\n'))
