// 探针：低目标经验衰减（2026-09-22）——用真实 store + 真实技能实例验证行为。
// 用法：node scripts/dev/low_target_probe.mjs
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getSkillInstance } from '../../src/game/skills/registry.js'
import { LOW_TARGET_GAP, LOW_TARGET_XP_MULT, lowTargetRefLevel } from '../../src/game/core/growthRate.js'

setActivePinia(createPinia())
const player = usePlayerStore()
createSkillInstances(player)

// ⚠️ 必须同时给 prestiges —— 否则 maxLevel 仍是 99，经验会被钳到 xpTotalForLevel(99)、
// 量出巨大负值（第一版就踩了，还误判成「参照系没夹住」）。level > 99 一定带 prestiges。
const setLv = (id, level) => player.setSkillState(id, { level, exp: player.xpTotalForLevel(level), prestiges: level > 99 ? 1 : 0 })
/** 用真实 addCardXp 量一次到账经验（base 取大值，避开 Math.floor 噪声） */
const gain = (inst, base, targetLevel) => {
  const before = inst.exp
  inst.addCardXp(base, 1, targetLevel)
  return inst.exp - before
}
const ratio = (a, b) => (b ? (a / b).toFixed(3) : 'n/a')

console.log('══ 常数 ══')
console.log(`LOW_TARGET_GAP=${LOW_TARGET_GAP}  LOW_TARGET_XP_MULT=${LOW_TARGET_XP_MULT}`)

console.log('\n══ 逐技能：参照系（顶档）与「最高档目标是否被误罚」══')
const ids = ['foraging', 'mining', 'fishing', 'hunting', 'excavation', 'farming', 'exploration', 'cooking', 'woodworking', 'candles', 'preservation', 'pottery']
let bad = 0
for (const id of ids) {
  const inst = getSkillInstance(id)
  const list = inst.targets ?? inst.recipes ?? inst.crops ?? []
  const top = inst.topTargetLevel
  const hi = list.find((x) => x.reqLevel === top)
  const lo = list.find((x) => x.reqLevel <= top - 2 * LOW_TARGET_GAP)
  const out = []
  for (const lv of [Math.min(99, top), Math.min(120, top + 10)]) {
    setLv(id, lv)
    const ref = lowTargetRefLevel(lv, inst.topTargetLevel)
    const hiGain = hi ? gain(inst, 1000, hi.reqLevel) : 0
    const loGain = lo ? gain(inst, 1000, lo.reqLevel) : 0
    const ok = loGain > 0 && Math.abs(loGain / hiGain - LOW_TARGET_XP_MULT) < 0.01
    if (!ok) bad++
    out.push(`技能${lv}(参照${ref}): 顶档+${hiGain} 低档(Lv${lo?.reqLevel})+${loGain} = ${ratio(loGain, hiGain)}×/0.5 ${ok ? '✓' : '✗'}`)
  }
  console.log(`${id.padEnd(13)} top=${String(top).padStart(3)}  ${out.join('   |   ')}`)
}
console.log(bad === 0 ? '⇒ 所有技能在 99 级与「超过顶档」时，顶档目标都未被罚、低档目标都恰好减半 ✓' : `⇒ ✗ 有 ${bad} 项不符`)

console.log('\n══ 边界：低 3 / 4 / 5 / 6 级 ══')
{
  const inst = getSkillInstance('foraging')
  setLv('foraging', 50) // 参照 = min(50, 99) = 50
  const base = gain(inst, 1000, 50) // 满经验基准（Lv50 自身）
  for (const gap of [2, 3, 4, 5, 6, 20]) {
    const tlv = 50 - gap
    const g = gain(inst, 1000, tlv)
    const r = g / base
    const want = gap >= LOW_TARGET_GAP ? LOW_TARGET_XP_MULT : 1
    console.log(`低 ${String(gap).padStart(2)} 级（目标 Lv${tlv}）→ ${r.toFixed(3)}× （期望 ${want}）${Math.abs(r - want) < 0.005 ? '✓' : '✗'}`)
  }
  console.log(`等级拿不到（null/NaN）⇒ 不减半：${gain(inst, 1000, null) / base === 1 ? '✓' : '✗'}（但**生产代码每个调用点都必须传**，见 C54 静态断言）`)
}

console.log('\n══ 蹲低阶 vs 挑顶档：折算经验/秒（减半后的真实取舍）══')
for (const id of ['foraging', 'cooking', 'mining']) {
  const inst = getSkillInstance(id)
  const list = inst.targets ?? inst.recipes ?? []
  setLv(id, 60)
  const ref = lowTargetRefLevel(60, inst.topTargetLevel)
  const rows = []
  for (const x of list) {
    const base = x.xpPerAction ?? x.xp
    if (!base || x.reqLevel > 60) continue
    const eff = base * (x.reqLevel <= ref - LOW_TARGET_GAP ? LOW_TARGET_XP_MULT : 1)
    const sec = (inst.intervalMs ? inst.intervalMs(x) : 3000) / 1000
    rows.push({ lv: x.reqLevel, name: x.name ?? x.output?.itemId ?? x.itemId, rate: eff / sec, low: x.reqLevel <= ref - LOW_TARGET_GAP })
  }
  const best = [...rows].sort((a, b) => b.rate - a.rate)[0]
  const bestLow = [...rows.filter((r) => r.low)].sort((a, b) => b.rate - a.rate)[0]
  console.log(`${id.padEnd(10)} 最优：Lv${best.lv} ${best.name} ${best.low ? '（低档）' : '（高档）✓'}  ${best.rate.toFixed(2)}/s · 低档里最快的是 Lv${bestLow?.lv} ${bestLow?.rate.toFixed(2)}/s = ${ratio(bestLow?.rate, best.rate)}× 于最优`)
}
