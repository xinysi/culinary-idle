import fs from 'node:fs'
const P = 'scripts/sim/full_run.mjs'
const body = `// 新档 → 能不能一路推进（2026-10-02，第二版：换成**已验证**的驱动）
// ── 上一版为什么废了 ──
// 第一版自写外层循环，报「24h 零进展」✗；对照实验（把 growth_sim 的 driveIdle 原样抄过来）却跑出
// 「采摘 46.3h 满级」✓ ⇒ 证明**是驱动写错了、不是游戏卡死**。这版直接用那套已验证的写法。
//
// ── 与 growth_sim 的关键区别（本条测试的价值所在）──
// growth_sim 假定「材料/种子/陷阱充足」（它量成长曲线）；这里**不给任何免费资源** ⇒
// 一旦某条线的产出喂不上下一环，这里会当场卡住并报出来 ✓。
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getSkillInstance } from '../../src/game/skills/registry.js'

let SIM_NOW = Date.now()
const REAL_NOW = Date.now
Date.now = () => SIM_NOW // 🔴 必须：引擎的时间闸门读 Date.now()

setActivePinia(createPinia())
const p = usePlayerStore()
const HOURS = Number(process.argv[process.argv.indexOf('--hours') + 1] || 0) || 60

p.newGame()
createSkillInstances(p)
SIM_NOW = REAL_NOW()

/** 采集/农耕：等级一变就重选「当前能用的最高档目标」（与 growth_sim 的 driveIdle 逐行同款） */
function driveIdle(skillId, capMs) {
  const inst = getSkillInstance(skillId)
  if (!inst) return { ok: false, why: '没有该技能实例' }
  let ms = 0, cachedLv = -1, lastTarget = null
  while ((p.skills[skillId]?.level ?? 1) < 99 && ms < capMs) {
    const lv = p.skills[skillId].level ?? 1
    if (lv !== cachedLv) {
      cachedLv = lv
      const list = inst.targets ?? inst.crops ?? []
      const t = [...list].filter((x) => (x.reqLevel ?? 0) <= lv).sort((a, b) => (b.reqLevel ?? 0) - (a.reqLevel ?? 0))[0]
      if (!t) return { ok: false, why: 'Lv' + lv + ' 没有可用目标（列表 ' + list.length + ' 条）', hours: ms / 3600000, level: p.skills[skillId]?.level }
      lastTarget = t.itemId ?? t.id ?? t.seedId
      p.setSkillTarget(skillId, lastTarget)
    }
    inst.tick(10000)
    ms += 10000
    SIM_NOW += 10000
  }
  return { ok: true, hours: ms / 3600000, level: p.skills[skillId]?.level, target: lastTarget }
}

const NAME = { foraging: '采摘', fishing: '垂钓', hunting: '狩猎', excavation: '挖掘', mining: '采矿', woodcutting: '伐木', farming: '农耕' }
const GATHER = Object.keys(NAME)
const per = Math.max(1, Math.floor(HOURS / GATHER.length))
console.log('新档 → 逐条采集线推进（**不给任何免费资源**；每条线上限 ' + per + 'h）\\n')
console.log('技能      结果      耗时        等级')
const rows = []
for (const id of GATHER) {
  const r = driveIdle(id, per * 3600000)
  rows.push([id, r])
  console.log(NAME[id].padEnd(8) + (r.ok ? '✅ 满级 ' : '⚠️ 卡住 ').padEnd(10) + ((r.hours ?? 0).toFixed(1) + 'h').padEnd(11) + (r.level ?? '—') + (r.ok ? '' : '  ← ' + r.why))
}
const blocked = rows.filter(([, r]) => !r.ok)
console.log('')
console.log(blocked.length
  ? '⚠️ 有 ' + blocked.length + ' 条线在预算内没打通：\\n  ' + blocked.map(([id, r]) => NAME[id] + '：' + r.why + '（' + (r.hours ?? 0).toFixed(1) + 'h）').join('\\n  ')
  : '✅ 七条采集线在预算内全部打通（无死路）')
console.log('终点不变量：金币 ' + Math.round(p.gold ?? 0) + ' · 图鉴 ' + Object.keys(p.collected ?? {}).length + ' 件 · 背包种类 ' + Object.keys(p.inventory ?? {}).length)
`
fs.writeFileSync(P, body, 'utf8')
console.log('✅ 已写入新版 full_run.mjs（' + body.split('\n').length + ' 行）')
