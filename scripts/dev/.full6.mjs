import fs from 'node:fs'
const P = 'scripts/sim/full_run.mjs'
let s = fs.readFileSync(P, 'utf8')
const log = []
const repl = (a, b, tag) => { if (!s.includes(a)) { log.push('❌ ' + tag); return } s = s.split(a).join(b); log.push('✅ ' + tag) }

// ① 补回 import（我重写文件时弄丢了 ⇒ 对决段抛错）
repl(`import { createSkillInstances, getSkillInstance } from '../../src/game/skills/registry.js'`,
`import { createSkillInstances, getSkillInstance, getAllSkillInstances } from '../../src/game/skills/registry.js'
import { COMBAT_REGIONS } from '../../src/game/data/combat.js'`, '补回 COMBAT_REGIONS import')

// ② 技能列表改为**从注册表派生**（不再手写 id —— 上一版「腌制」写错 id 就是手写清单的错）
repl(`const NAME = { foraging: '采摘', fishing: '垂钓', hunting: '狩猎', excavation: '挖掘', mining: '采矿', woodcutting: '伐木', farming: '农耕' }
const GATHER = Object.keys(NAME)`,
`// 🔴 不手写技能 id：从注册表派生（谁有 targets 谁是采集、谁有 crops 谁是农耕、谁有 recipes 谁是制作）
const ALL = Object.values(getAllSkillInstances() ?? {})
const GATHER = ALL.filter((i) => i?.targets && i?.crops === undefined && i?.recipes === undefined).map((i) => i.id)
const FARM = ALL.filter((i) => i?.crops).map((i) => i.id)
const CRAFT = ALL.filter((i) => i?.recipes).map((i) => i.id)
// 中文名从 SKILL_DEFS 取（同样不手抄）
const { SKILL_DEFS } = await import('../../src/game/data/skills.js')
const NAME = Object.fromEntries(Object.entries(SKILL_DEFS ?? {}).map(([k, v]) => [k, v?.name ?? k]))
console.log('（派生清单）采集 ' + GATHER.length + ' 条 · 农耕 ' + FARM.length + ' 条 · 制作 ' + CRAFT.length + ' 条')`, '技能清单改为派生')

// ③ 农耕：补显式首播（autoFarm 只管收种，**首播要有种子**）
repl(`const per = Math.max(1, Math.floor(HOURS / GATHER.length))`,
`/** 农耕：首播 + 收获（抄 growth_sim 的农田驱动思路：先 plant 再 tick） */
function driveFarm(skillId, capMs) {
  const inst = getSkillInstance(skillId)
  if (!inst?.crops) return { ok: false, why: '没有 crops' }
  let ms = 0
  const seedOf = (c) => c.seedId
  while (ms < capMs) {
    const lv = p.skills[skillId]?.level ?? 1
    const c = [...inst.crops].filter((x) => (x.reqLevel ?? 0) <= lv).sort((a, b) => (b.reqLevel ?? 0) - (a.reqLevel ?? 0))[0]
    if (!c) return { ok: false, why: 'Lv' + lv + ' 没有可用作物', hours: ms / 3600000, level: p.skills[skillId]?.level }
    // 没有种子就先弄一颗（草料：不给免费种子 ⇒ 没种子就是"卡在种子"——这正是要量的东西）
    if ((p.inventory?.[seedOf(c)] ?? 0) < 1) {
      const anySeed = Object.keys(p.inventory ?? {}).find((k) => k.endsWith('Seed') && p.inventory[k] > 0)
      if (!anySeed) return { ok: false, why: '没有任何种子（采集掉落没攒下种子）', hours: ms / 3600000, level: p.skills[skillId]?.level }
      for (let i = 0; i < inst.maxPlots; i++) if (!inst.plotAt?.(i)) inst.plant?.(i, anySeed)
    } else {
      for (let i = 0; i < inst.maxPlots; i++) if (!inst.plotAt?.(i)) inst.plant?.(i, seedOf(c))
    }
    inst.tick(10000)
    ms += 10000
    SIM_NOW += 10000
  }
  return { ok: true, hours: ms / 3600000, level: p.skills[skillId]?.level }
}

const per = Math.max(1, Math.floor(HOURS / GATHER.length))`, '农耕显式首播')

// ④ 跑农耕（原先的采集循环只跑 GATHER ⇒ 农耕被漏在清单外就没人跑）
repl(`const blocked = rows.filter(([, r]) => !r.ok)`,
`for (const id of FARM) {
  const r = driveFarm(id, per * 3600000)
  rows.push([id, r])
  console.log((NAME[id] ?? id).padEnd(8) + (r.ok ? '✅ 有产出 ' : '⚠️ 卡住 ').padEnd(10) + ((r.hours ?? 0).toFixed(1) + 'h').padEnd(11) + (r.level ?? '—') + (r.why ? '  ← ' + r.why : ''))
}
const blocked = rows.filter(([, r]) => !r.ok)`, '跑农耕')

// ⑤ 制作清单也用派生（删掉手写那行）
repl(`const CRAFT = ['cooking', 'baking', 'brewing', 'spiceMixing', 'preserves', 'craftsmithing']`, '', '删掉手写制作清单')

let done = false
for (let i = 0; i < 5; i++) { try { fs.writeFileSync(P, s, 'utf8'); done = true; break } catch (e) { await new Promise((r) => setTimeout(r, 600)) } }
log.push(done ? '✅ 写盘' : '❌ 写盘失败')
console.log(log.join('\n'))
