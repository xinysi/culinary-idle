// 端局 BOSS 曲线验证 — 满配玩家（99 级 + 5 转生 + 神话装）挑战 90-101 级 BOSS
// 运行：node scripts/endgame_sim.mjs
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../src/stores/player.js'
import { createSkillInstances } from '../src/game/skills/registry.js'
import { Combat } from '../src/game/combat/Combat.js'
import { COMBAT_BOSSES } from '../src/game/data/combat.js'
import { totalXpForLevel } from '../src/game/core/Experience.js'

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
