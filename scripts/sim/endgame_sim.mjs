// 端局 BOSS 曲线验证 — 满配玩家（99 级 + 5 转生 + 神话装）挑战 90-101 级 BOSS
// 运行：node scripts/sim/endgame_sim.mjs
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances } from '../../src/game/skills/registry.js'
import { Combat } from '../../src/game/combat/Combat.js'
import { COMBAT_BOSSES } from '../../src/game/data/combat.js'
import { towerFloor } from '../../src/game/data/battleTower.js'
import { ITEMS } from '../../src/game/data/items.js'
import { totalXpForLevel } from '../../src/game/core/Experience.js'

setActivePinia(createPinia())
const player = usePlayerStore()
player.newGame()
// 满配：对决五技能 99 级 + 5 次转生（+50% 经验，等级上限 120）
for (const id of ['tasteAcumen', 'knife', 'plating', 'flavor', 'heatControl']) {
  player.setSkillState(id, { level: 120, exp: totalXpForLevel(120), prestiges: 5 })
}
createSkillInstances(player)
// 神话/传说装备：星辰刀(weapon) + 鎏金瓶(amulet) + 藏宝瓮(offhand) + 龙鳞围裙(body) + 琉璃帽(helmet)
const gear = { weapon: 'smith_ext_30', amulet: 'smith_ext2_30', offhand: 'treasureUrn', body: 'smith_ext2_26', helmet: 'smith_ext2_28' }
for (const [slot, id] of Object.entries(gear)) {
  player.gainItem(id, 1)
  player.equip(id)
}
player.inventory.godFeast = 20 // 顶级料理（最大回血）
player.settings.autoEat = true
player.settings.autoEatThreshold = 90

const combat = new Combat(player)
const targets = COMBAT_BOSSES.filter((b) => b.level >= 90)
console.log('═══ 端局 BOSS 胜率（满配：99 级×5转生 + 神话装 + 食神盛宴 ×40 场）═══')
console.log(`玩家：品鉴 ${player.skills.tasteAcumen.level}（HP ${player.maxHp}） 攻 ${combat.playerStats().attack} 防 ${combat.playerStats().defense}`)
for (const b of targets) {
  let wins = 0
  for (let i = 0; i < 40; i++) {
    if (player.combat.hp <= 0) player.setCombat({ hp: player.maxHp })
    combat.start(b)
    let g = 0
    while (combat.inFight && g++ < 2000) combat.tick(200)
    if (combat.result === 'win') wins++
  }
  const pct = Math.round((wins / 40) * 100)
  const ok = pct >= 60 ? '✅' : pct >= 30 ? '⚠️' : '❌'
  console.log(`  ${ok} ${b.name}（L${b.level}）：胜率 ${pct}%`)
}

// ── 挑战塔曲线（2026-09-12 补）──
// 塔的 def 若与 hp/atk 用同一个几何 g 爬坡，会在饱和减伤 def/(def+100) 下变成「打不动」的死墙
// （实测原口径：F90 只剩 6/20、F100 起 0/20）。每层必须「满血开局」——否则量到的是新档遗留的
// 10 点 HP，会得出假墙（曾据此误判 F70 就不可通过）。
// 塔段单独换「8 槽全满配」：上面 BOSS 段只装了 5 槽（攻 395/防 286），拿它量塔会低估玩家，
// 把「装备没装满」误读成「塔是死墙」。这里每槽取全库主属性最高的装备。
{
  const score = (x) => (x.stats?.attack ?? 0) + (x.stats?.defense ?? 0) + (x.stats?.hpBonus ?? 0) / 4
  for (const slot of ['weapon', 'offhand', 'body', 'helmet', 'amulet', 'ring', 'legs', 'boots']) {
    let best = null
    for (const it of Object.values(ITEMS)) {
      if (it.type !== 'equipment' || it.slot !== slot) continue
      if (!best || score(it) > score(best)) best = it
    }
    if (best) { player.gainItem(best.id, 1); player.equip(best.id) }
  }
}
console.log('\n═══ 挑战塔各层胜率（8 槽满配 · 每层满血开局 · 10 场）═══')
console.log(`塔段玩家：攻 ${Math.round(combat.playerStats().attack)} 防 ${Math.round(combat.playerStats().defense)} HP ${Math.round(player.maxHp)}`)
console.log('层   守塔人L  hp     def   eva   胜率')
for (const floor of [50, 70, 90, 100, 110, 130, 200]) {
  const o = towerFloor(floor, player.combatLevel)
  let wins = 0
  for (let i = 0; i < 10; i++) {
    player.setCombat({ hp: player.maxHp })
    combat.start(o)
    let g = 0
    while (combat.inFight && g++ < 3000) combat.tick(200)
    if (combat.result === 'win') wins++
  }
  console.log(`${String(floor).padEnd(4)} L${String(o.level).padEnd(6)} ${String(o.hp).padEnd(6)} ${String(o.def).padEnd(5)} ${String(Math.round(o.eva)).padEnd(5)} ${wins}/10`)
}
