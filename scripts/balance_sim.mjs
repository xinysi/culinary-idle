// 平衡模拟 — 用真实 Combat 引擎验证：区域/BOSS 解锁节奏 + 关键对局胜率
// 运行：node .toolchain/balance_sim.mjs
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../src/stores/player.js'
import { Combat } from '../src/game/combat/Combat.js'
import { COMBAT_REGIONS, COMBAT_BOSSES } from '../src/game/data/combat.js'
import { createSkillInstances } from '../src/game/skills/registry.js'
import { totalXpForLevel } from '../src/game/core/Experience.js'
import { getItem } from '../src/game/data/items.js'

setActivePinia(createPinia())
const player = usePlayerStore()
player.newGame()
player.settings.autoEat = true
player.settings.autoEatThreshold = 60
createSkillInstances(player)
const combat = new Combat(player)

function giveFood(n = 50) {
  player.inventory.roastPotato = n
  player.inventory.whiteBread = n
  player.inventory.strawberryCake = n
}
function levelOf(id) {
  return player.skills[id]?.level ?? 1
}
function runFight(opponent) {
  if (player.combat.hp <= 0) player.setCombat({ hp: player.maxHp })
  combat.start(opponent)
  let g = 0
  while (combat.inFight && g++ < 4000) combat.tick(5000)
  return combat.result
}
function bestOpponentFor(cl) {
  // 选已解锁区域里，等级最接近（不超过 +5）的最强对手
  let best = null
  for (const r of COMBAT_REGIONS) {
    if (r.reqLevel > cl) break
    for (const o of r.opponents) {
      if (o.level <= cl + 5 && (!best || o.level > best.level)) best = o
    }
  }
  return best
}

// ── 1. 关键对局胜率 ──
console.log('═══ 胜率检查（各 40 场，自动进食开）═══')

function winRate(label, setup, opponent, fights = 40) {
  let wins = 0
  for (let i = 0; i < fights; i++) {
    setup()
    if (runFight(opponent) === 'win') wins++
  }
  const pct = Math.round((wins / fights) * 100)
  console.log(`  ${label}: ${pct}%`)
  return pct
}

// L1 白板 vs 学徒厨师（L1）
const fresh = () => {
  player.newGame()
  player.settings.autoEat = true
  player.settings.autoEatThreshold = 60
  createSkillInstances(player)
  giveFood(20)
}
winRate('L1 白板+食物 vs 学徒厨师 L1', fresh, COMBAT_REGIONS[0].opponents[0])

// 对决 10 级 vs 小吃摊主 L12
const cl10 = () => {
  player.newGame()
  player.settings.autoEat = true
  player.settings.autoEatThreshold = 60
  createSkillInstances(player)
  giveFood(50)
  player.setSkillState('tasteAcumen', { level: 10, exp: totalXpForLevel(10) })
  player.setSkillState('knife', { level: 10, exp: totalXpForLevel(10) })
  player.setSkillState('heatControl', { level: 10, exp: totalXpForLevel(10) })
  player.setCombat({ hp: player.maxHp })
}
winRate('对决10（铜装） vs 小吃摊主 L12', cl10, COMBAT_REGIONS[1].opponents[0])

// 对决 20 级（铁装） vs 川菜师傅 L30
const cl20 = () => {
  player.newGame()
  player.settings.autoEat = true
  player.settings.autoEatThreshold = 60
  createSkillInstances(player)
  giveFood(50)
  for (const id of ['tasteAcumen', 'knife', 'heatControl']) player.setSkillState(id, { level: 20, exp: totalXpForLevel(20) })
  player.equipment.weapon = 'ironKnife'
  player.equipment.offhand = 'ironPot'
  player.equipment.body = 'ironApron'
  player.equipment.helmet = 'ironHat'
  player.equipment.amulet = 'ironBottle'
  player.setCombat({ hp: player.maxHp })
}
winRate('对决20（铁装） vs 川菜师傅 L30', cl20, COMBAT_REGIONS[2].opponents[1])

// 对决 25（铁装） vs 面条之王 BOSS
const cl25 = () => {
  player.newGame()
  player.settings.autoEat = true
  player.settings.autoEatThreshold = 60
  createSkillInstances(player)
  giveFood(50)
  for (const id of ['tasteAcumen', 'knife', 'heatControl']) player.setSkillState(id, { level: 25, exp: totalXpForLevel(25) })
  player.equipment.weapon = 'ironKnife'
  player.equipment.offhand = 'ironPot'
  player.equipment.body = 'ironApron'
  player.equipment.helmet = 'ironHat'
  player.equipment.amulet = 'ironBottle'
  player.setCombat({ hp: player.maxHp })
}
winRate('对决25（铁装） vs BOSS 面条之王', cl25, COMBAT_BOSSES[0])

// ── 2. 解锁节奏：从 0 开始刷，统计达到各区域/BOSS 门槛的击杀数 ──
console.log('═══ 解锁节奏（从 1 级白板开始，只刷当前最强可胜对手）═══')
player.newGame()
player.settings.autoEat = true
player.settings.autoEatThreshold = 60
createSkillInstances(player)
giveFood(500)

const THRESHOLDS = [10, 20, 25, 30, 40, 50, 55, 60, 65, 70, 75, 80, 85, 90, 92, 99]
const milestoneKills = {}
let kills = 0
let loses = 0
let maxFights = 12000
const t0 = Date.now()
while (kills < maxFights) {
  const cl = player.combatLevel
  for (const t of THRESHOLDS) {
    if (cl >= t && milestoneKills[t] === undefined) milestoneKills[t] = kills
  }
  if (Object.keys(milestoneKills).length === THRESHOLDS.length) break
  // BOSS 解锁时优先打 BOSS（经验更多）
  const boss = COMBAT_BOSSES.find((b) => b.level <= cl)
  const opp = boss ?? bestOpponentFor(cl)
  if (!opp) break
  const res = runFight(opp)
  kills++
  if (res !== 'win') loses++
}
// 补充最终等级
const finalCl = player.combatLevel
console.log(`  总对决 ${kills} 场 · 战败 ${loses} 场 · 最终对决等级 ${finalCl} · 耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
console.log(`  最终：品鉴 ${levelOf('tasteAcumen')} / 刀工 ${levelOf('knife')} / 火候 ${levelOf('heatControl')}`)
for (const t of THRESHOLDS) {
  console.log(`  对决等级 ${t}：${milestoneKills[t] === undefined ? '未达成（>8000场）' : `${milestoneKills[t]} 场`}`)
}
// BOSS 门槛（对决等级 = BOSS 等级）
for (const b of COMBAT_BOSSES) {
  const reached = milestoneKills[b.level] !== undefined
  console.log(`  BOSS ${b.name}（对决${b.level}）：${reached ? `约 ${milestoneKills[b.level]} 场` : '8000 场内未达成'}`)
}
