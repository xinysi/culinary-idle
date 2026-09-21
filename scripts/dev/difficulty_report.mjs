// 难度系数数值验收：走真实代码路径，对比「数据基准值」与「实际生效值」
// 难度系数数值报告（开发工具，不进 CI；CI 的断言在 scripts/ci/difficulty_audit.mjs）
//
// 用途：改完 src/game/data/difficulty.js 的系数/下限后跑一次，直观看到「每个系统实际变成多少」。
// 特点：走**真实数据 + 真实出口函数**，不是手抄几个示例值 —— 所以它不是文档，是当前生效值的快照。
//
// 用法（仓库根目录）：node scripts/dev/difficulty_report.mjs
// 关注点：① 六个桶是否都真的降了 ② 金币那一节必须纹丝不动 ③ 边界不变量（永不抬高 / 0 保持 0）
import { COMBAT_REGIONS, COMBAT_BOSSES } from '../../src/game/data/combat.js'
import { EXPLORATION_TARGETS_ALL } from '../../src/game/data/explorationTargets.js'
import { MASCOTS, mascotItemChance } from '../../src/game/data/mascots.js'
import { greenhouseHoneyChance } from '../../src/game/data/greenhouse.js'
import { DIFFICULTY, dropChance, craftSuccessChance, exploreSuccessChance, exploreLootChance, otherChance, gatherExtraChance, scaleChance } from '../../src/game/data/difficulty.js'

const p = (x) => `${(x * 100).toFixed(2)}%`
const row = (label, before, after) => {
  const mult = before > 0 ? (after / before).toFixed(2) : '—'
  console.log(`  ${label.padEnd(34)} ${p(before).padStart(9)} → ${p(after).padStart(9)}   ×${mult}`)
}

console.log('══ 系数表 ══')
console.log(' ', JSON.stringify(DIFFICULTY))

console.log('\n══ 1. 对决掉落（÷5，下限 1%）══')
const opp = []
for (const r of COMBAT_REGIONS) for (const o of r.opponents ?? []) for (const d of o.drops ?? []) opp.push(d.chance)
const boss = []
for (const b of COMBAT_BOSSES) for (const d of b.drops ?? []) boss.push(d.chance)
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length
row('区域对手掉落·均值', avg(opp), avg(opp.map(dropChance)))
row('区域对手掉落·最高', Math.max(...opp), dropChance(Math.max(...opp)))
row('区域对手掉落·最低', Math.min(...opp), dropChance(Math.min(...opp)))
row('首领掉落·均值', avg(boss), avg(boss.map(dropChance)))

console.log('\n══ 2. 制作成功率（÷2，下限 8%）—— 取各技能最小/最大基准值 ══')
for (const v of [0.5, 0.72, 0.9, 1.0]) row(`基准 successChance=${v}`, v, craftSuccessChance(v))

console.log('\n══ 3. 美食探索（成功率 ÷2 / 物品战利品 ÷2）══')
const bs = EXPLORATION_TARGETS_ALL.map((t) => t.baseSuccess)
const items = []
for (const t of EXPLORATION_TARGETS_ALL) for (const l of t.loot ?? []) if (l.type !== 'gold') items.push(l.chance)
row('baseSuccess·均值', avg(bs), avg(bs.map(exploreSuccessChance)))
row('baseSuccess·最低', Math.min(...bs), exploreSuccessChance(Math.min(...bs)))
row('物品战利品·均值', avg(items), avg(items.map(exploreLootChance)))
row('物品战利品·最低', Math.min(...items), exploreLootChance(Math.min(...items)))

console.log('\n══ 4. 金币必须**完全不变**（用户明确要求）══')
const goldLoot = []
for (const t of EXPLORATION_TARGETS_ALL) for (const l of t.loot ?? []) if (l.type === 'gold') goldLoot.push(l.chance)
const uniq = [...new Set(goldLoot)]
console.log('  探索·金币战利品 概率取值集合:', JSON.stringify(uniq), '（应恒为 0.7，不经缩放）')
const failGold = [...new Set(EXPLORATION_TARGETS_ALL.map((t) => t.failGold))].sort((a, b) => a - b)
console.log('  探索·失败扣金币 取值:', failGold.slice(0, 6), '…', failGold.slice(-2), '（无概率，未动）')
console.log('  吉祥物金币: 由 goldBase×好感决定，`mascotItemChance` 只作用于物品 ↓')

console.log('\n══ 5. 其它功能页（÷2）══')
row('吉祥物礼物·平均 itemChance', avg(MASCOTS.map((m) => m.itemChance)), avg(MASCOTS.map((m) => mascotItemChance(m))))
row('温室蜂蜜', 0.1, greenhouseHoneyChance())
row('采集附产·采摘木材', 0.5, gatherExtraChance(0.5))
row('采集附产·挖掘铜矿', 0.5, gatherExtraChance(0.5))
row('采集附产·挖掘铁矿', 0.3, gatherExtraChance(0.3))
row('采集附产·化石', 0.02, gatherExtraChance(0.02))
row('采集附产·狩猎野鸡蛋', 0.15, gatherExtraChance(0.15))
row('随机奇遇触发', 0.002, otherChance(0.002))

console.log('\n══ 6. 三个不变量（scaleChance 的边界）══')
const inv = [
  ['0 保持 0（不被下限抬成 1%）', scaleChance(0, 0.2, 0.01) === 0],
  ['负数保持 0', scaleChance(-1, 0.2, 0.01) === 0],
  ['NaN 保持 0', scaleChance(NaN, 0.2, 0.01) === 0],
  ['永不抬高（0.005→0.005）', scaleChance(0.005, 0.2, 0.01) === 0.005],
  ['下限只托底（0.03→0.01，不是 0.006）', scaleChance(0.03, 0.2, 0.01) === 0.01],
  ['正常缩放（0.3→0.06）', Math.abs(scaleChance(0.3, 0.2, 0.01) - 0.06) < 1e-9],
  ['永不超原值', [0.001, 0.02, 0.5, 0.9].every((v) => scaleChance(v, 0.5, 0.01) <= v)],
]
for (const [name, ok] of inv) console.log(`  ${ok ? '✓' : '❌'} ${name}`)
console.log('\n' + (inv.every(([, ok]) => ok) ? '✓ 边界不变量全部成立' : '❌ 有边界不变量不成立'))
