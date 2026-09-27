// 探针：美食探索的精通档位/池/装备接线是否真的生效（2026-09-27 用户①②③⑤⑥）
// 用法：node scripts/dev/exploration_balance_probe.mjs
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getAllSkillInstances } from '../../src/game/skills/registry.js'
import { countForMasteryLevel, masteryIntervalFactor, masteryFixedInterval, masteryDoubleChance } from '../../src/game/core/mastery.js'
import { exploreBandOf, exploreBandFactor, EXPLORE_SUCCESS_CAP } from '../../src/game/data/explorationBalance.js'
import { EXPLORE_GEAR_ITEMS, EXPLORE_GEAR_DROP_CHANCE, exploreSetTotalPP } from '../../src/game/data/explorationGear.js'

setActivePinia(createPinia())
const p = usePlayerStore()
p.newGame()
createSkillInstances(p)
const ex = getAllSkillInstances().find((s) => s.id === 'exploration')
const cnt = countForMasteryLevel

console.log('=== ① 成功率：初始（= 基础 × 段位因子）→ 精通 → 装备 ===')
console.log('段 | 目标        | 基础  | 初始  | 精50  | 精100 | 精100+每套装备')
for (const band of [1, 2, 3, 5, 7, 9, 10]) {
  const t = ex.targets.find((x) => exploreBandOf(x.reqLevel) === band)
  if (!t) continue
  ex.mastery[t.id] = 0; const a = ex.successChance(t)
  const raw0 = t.baseSuccess
  ex.mastery[t.id] = cnt(50); const b = ex.successChance(t)
  ex.mastery[t.id] = cnt(100); const c = ex.successChance(t)
  const realGear = ex.gearSuccessPP.bind(ex)
  ex.gearSuccessPP = () => 0.05
  const d1 = ex.successChance(t)
  ex.gearSuccessPP = () => 0.10
  const d2 = ex.successChance(t)
  ex.gearSuccessPP = realGear
  console.log(` ${String(band).padStart(2)} | ${t.name.padEnd(10)} | ${(raw0 * 100).toFixed(1).padStart(5)}% | ${(a * 100).toFixed(1).padStart(5)}% | ${(b * 100).toFixed(1).padStart(5)}% | ${(c * 100).toFixed(1).padStart(5)}% | ${(d1 * 100).toFixed(1)}% → ${(d2 * 100).toFixed(1)}%`)
}
console.log(` 上限（不含装备）EXPLORE_SUCCESS_CAP = ${EXPLORE_SUCCESS_CAP * 100}%`)

console.log('=== ② 精通档位：间隔 / 双倍（与采集同一套表）===')
const t1 = ex.targets[0]
for (const lv of [0, 5, 10, 20, 50, 100]) {
  ex.mastery[t1.id] = cnt(lv)
  console.log(` 精通 ${String(lv).padStart(3)} → 间隔 ${(ex.intervalMs(t1) / 1000).toFixed(2)}s（因子 ${masteryIntervalFactor(lv)} / 固定 ${masteryFixedInterval(lv)}，走 ${ex.intervalMode(t1)}）· 双倍 ${(ex.doubleChance(t1) * 100).toFixed(0)}%`)
}
ex.mastery[t1.id] = 0

console.log('=== ③ 精通池（整技能口径）：池加成的成功率百分点 ===')
const cards = ex.targets.length
for (const pct of [0.05, 0.12, 0.30, 0.60, 0.99]) {
  p.skills[ex.id].masteryPool = Math.round(pct * 600 * cards)
  const b = p.masteryPoolBonus?.(ex.id) ?? {}
  console.log(` 池 ${(pct * 100).toFixed(0).padStart(3)}% → ${b.tier?.name ?? '未达'}：成功率 +${b.successPP ?? 0}pp · 双倍 +${b.doublePP ?? 0}pp · 经验 +${b.xpPct ?? 0}%`)
}

console.log('=== ④ 掉落：物品 ÷4、金币不动；专属装备 0.01% ===')
for (const l of ex.targets[0].loot.slice(0, 3)) {
  console.log(` ${l.type === 'gold' ? '金币' : '物品'} 原 ${(l.chance * 100).toFixed(1)}% → 实际 ${(ex.lootChance(l) * 100).toFixed(2)}%`)
}
console.log(` 专属装备掉落率 ${(EXPLORE_GEAR_DROP_CHANCE * 100).toFixed(3)}% · 共 ${EXPLORE_GEAR_ITEMS.length} 件`)
for (const s of ['flavorTrail', 'relicHunt']) console.log(`  套装 ${s} 合计 +${exploreSetTotalPP(s)}pp`)
console.log(' 四件的属性键:', EXPLORE_GEAR_ITEMS.map((g) => `${g.name}: ${JSON.stringify(g.stats)}`).join(' / '))
