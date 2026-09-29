// 农耕精通轴探针（本地开发脚本，2026-09-29）：查清 `mastery_axis.mjs farming` 为何跑不出数。
// 只做一件事：把「每张卡刷到精通 100」的循环逐卡打点，看它卡在哪一步、每卡真实点数与墙钟耗时。
// 用法：node scripts/dev/farm_mastery_probe.mjs [--cards N] [--ticks N]
//
// 🔴 2026-09-29 踩到的坑（本文件的修正理由）：`tick()` 的自动收种会**用原地块的种子补种**
//    ⇒ 换卡时若不清地，20 块地会一直种着上一张卡，新卡的精通次数**永远是 0**、跑到 guard 上限。
//    同理，等级升到够种目标卡之后也必须清一次地（否则地里还是过渡作物的种子）。
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getSkillInstance } from '../../src/game/skills/registry.js'
import { countForMasteryLevel, masteryLevelFromCount } from '../../src/game/core/mastery.js'
import { CROPS } from '../../src/game/skills/FarmingSkill.js'

setActivePinia(createPinia())
const p = usePlayerStore()
let SIM_NOW = Date.now()
const REAL_NOW = Date.now
Date.now = () => SIM_NOW

const argv = process.argv.slice(2)
const cardIdx = argv.indexOf('--cards')
const MAXCARDS = cardIdx >= 0 ? Number(argv[cardIdx + 1]) || 0 : 0
const tickIdx = argv.indexOf('--ticks')
const MAXTICKS = tickIdx >= 0 ? Number(argv[tickIdx + 1]) || 0 : 0

p.newGame()
p.settings.xpMultiplier = 5
p.marketBoost = () => ({ restaurant: 2, gatherXp: 1.5, craftXp: 1, combatXp: 1 })
createSkillInstances(p)
p.inventory.trap = 99999999
SIM_NOW = REAL_NOW()

const inst = getSkillInstance('farming')
const need = countForMasteryLevel(100)
const cards = [...CROPS].sort((a, b) => a.reqLevel - b.reqLevel)
const use = MAXCARDS ? cards.slice(0, MAXCARDS) : cards
console.log(`耕地块数 maxPlots=${inst.maxPlots} · 作物 ${cards.length} 种 · 每卡目标 ${need} 次`)
console.log(`探针限制：--cards=${MAXCARDS || 'all'} --ticks=${MAXTICKS || 'unlimited'}`)

const clearAll = () => { for (let i = 0; i < inst.plots.length; i++) p.clearPlot(i) }

let ms = 0
let totalTicks = 0
let plantedCropId = null
for (const c of use) {
  const t0 = performance.now()
  const m0 = ms
  let guard = 0
  clearAll()
  plantedCropId = null
  while ((inst.mastery[c.itemId] ?? 0) < need && guard++ < 400000 && !(MAXTICKS && guard > MAXTICKS)) {
    const lv = p.skills.farming.level ?? 1
    const pick = lv >= c.reqLevel ? c : [...cards].filter((x) => x.reqLevel <= lv).sort((a, b) => b.reqLevel - a.reqLevel)[0]
    if (!pick) { console.log(`  ⛔ ${c.itemId} req=${c.reqLevel}：无可用作物（等级 ${lv}）`); break }
    if (pick.itemId !== plantedCropId) { clearAll(); plantedCropId = pick.itemId } // 🔴 过渡作物→目标作物也要清地
    p.inventory[pick.seedId] = 999999
    for (let i = 0; i < inst.maxPlots; i++) if (!inst.plotAt(i)) inst.plant(i, pick.seedId)
    inst.tick(10000)
    ms += 10000
    totalTicks++
    SIM_NOW += 10000
    if (guard % 20000 === 0) {
      console.log(`  … ${c.itemId} tick=${guard} 精通次数=${inst.mastery[c.itemId] ?? 0} 等级=${p.skills.farming.level} 实种=${pick.itemId} 地块已种=${inst.plots.filter(Boolean).length} 墙钟=${((performance.now() - t0) / 1000).toFixed(1)}s`)
    }
  }
  console.log(`${c.itemId.padEnd(18)} req=${String(c.reqLevel).padStart(3)} 精通次数=${String(inst.mastery[c.itemId] ?? 0).padStart(5)}/${need} 游戏时长=${((ms - m0) / 3600000).toFixed(2)}h 墙钟=${((performance.now() - t0) / 1000).toFixed(1)}s 等级=${p.skills.farming.level}`)
  if (MAXTICKS && guard > MAXTICKS) { console.log('（探针 ticks 上限到，提前结束）'); break }
}
console.log(`总游戏时长 ${(ms / 3600000).toFixed(2)}h（${(ms / 86400000).toFixed(1)} 天）· 累计 tick=${totalTicks} · 精通等级（每卡）= ${masteryLevelFromCount(need)}`)
