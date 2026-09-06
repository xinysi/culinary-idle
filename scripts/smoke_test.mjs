// 核心逻辑冒烟测试（无头）
// ⚠️ 2026-09 起为 legacy 参考（旧经验曲线/旧数值快照，未逐项同步）；CI 门禁请用 system_test.mjs（184 项全绿）
import { totalXpForLevel, xpRequiredForLevelUp, levelFromXp, xpProgress } from '../src/game/core/Experience.js'
import { computeOfflineProgress } from '../src/game/core/OfflineProgress.js'
import { ForagingSkill } from '../src/game/skills/ForagingSkill.js'
import { FishingSkill } from '../src/game/skills/FishingSkill.js'
import { HuntingSkill } from '../src/game/skills/HuntingSkill.js'
import { ExcavationSkill } from '../src/game/skills/ExcavationSkill.js'
import { FarmingSkill } from '../src/game/skills/FarmingSkill.js'
import { CookingSkill } from '../src/game/skills/CookingSkill.js'
import { BakingSkill } from '../src/game/skills/BakingSkill.js'
import { PreservingSkill } from '../src/game/skills/PreservingSkill.js'
import { BrewingSkill } from '../src/game/skills/BrewingSkill.js'
import { SpiceMixingSkill } from '../src/game/skills/SpiceMixingSkill.js'
import { CraftsmithingSkill } from '../src/game/skills/CraftsmithingSkill.js'
import { Combat } from '../src/game/combat/Combat.js'
import { COMBAT_REGIONS, STYLE_ADVANTAGE } from '../src/game/data/combat.js'
import { createSkillInstances, getSkillInstance } from '../src/game/skills/registry.js'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../src/stores/player.js'
import { SpiritSummoningSkill } from '../src/game/skills/SpiritSummoningSkill.js'
import { ExplorationSkill } from '../src/game/skills/ExplorationSkill.js'
import { generateArenaOpponents } from '../src/game/data/arena.js'
import { EventBus } from '../src/game/core/EventBus.js'
import { CROPS } from '../src/game/skills/FarmingSkill.js'
import { SHOP_ITEMS } from '../src/game/data/shop.js'
import { getItem } from '../src/game/data/items.js'
import { ITEMS } from '../src/game/data/items.js'

let failures = 0
function check(name, cond, detail = '') {
  if (cond) console.log(`  ok  ${name}`)
  else {
    failures++
    console.log(`FAIL  ${name} ${detail}`)
  }
}

// ── 工具 ─────────────────────────────────────────────
const realRandom = Math.random
const realNow = Date.now
function withRandom(seq, fn) {
  let i = 0
  Math.random = () => seq[Math.min(i++, seq.length - 1)]
  try {
    return fn()
  } finally {
    Math.random = realRandom
  }
}
const ALL_SKILL_IDS = [
  'foraging', 'fishing', 'hunting', 'excavation', 'farming',
  'cooking', 'baking', 'preserving', 'brewing', 'spiceMixing', 'craftsmithing',
  'knife', 'heatControl', 'flavorArtistry', 'plating', 'tasteAcumen', 'spiritSummoning',
  'gastronomy', 'preservation', 'exploration',
]
function makePlayer(skillId, level = 1, extra = {}) {
  const skills = {}
  for (const sid of ALL_SKILL_IDS) {
    skills[sid] = { level: sid === skillId ? level : 1, exp: 0, mastery: {} }
  }
  return {
    skills,
    inventory: {},
    activeTarget: null,
    farming: { plots: [] },
    settings: { xpMultiplier: 1, autoEat: false, autoEatThreshold: 50, soundEnabled: false, maxParallelIdle: 0 },
    gainItem: (id, qty) => (this.inventory[id] = (this.inventory[id] ?? 0) + qty),
    // 2026-09：技能链回调（craft/采集 → 轶事/加成/经验曲线）
    bumpStory: () => {},
    spiritEffects: () => ({}),
    gastronomyEffects: () => ({}),
    guildEffects: () => ({}),
    getXpMultiplier: () => 1,
    xpTotalForLevel: (l) => totalXpForLevel(l),
    setSkillState: (id, patch) => Object.assign(skills[id] ?? (skills[id] = { level: 1, exp: 0, mastery: {}, prestiges: 0 }), patch),
    ...extra,
  }
}

// 1. 经验曲线（§11.1；2026-09 重做：99 级总 28.82 亿，1→2 需 18,364）
console.log('— 经验曲线 —')
check('1→99 总经验 ≈ 28.82 亿', Math.abs(totalXpForLevel(99) - 2_882_176_383) < 1000, `got ${totalXpForLevel(99)}`)
check('1→2 需 18,364 XP', xpRequiredForLevelUp(1) === 18_364, `got ${xpRequiredForLevelUp(1)}`)
check('levelFromXp(99级总经验) = 99', levelFromXp(totalXpForLevel(99)) === 99)
check('xpProgress(0) → level 1 progress 0', xpProgress(0).level === 1 && xpProgress(0).progress === 0)
check('xpProgress(100) → level 2', xpProgress(100).level === 2)

// 2. 采摘（§3.1.1）
console.log('— 采摘 —')
const forP = makePlayer('foraging', 1)
forP.gainItem = (id, qty) => (forP.inventory[id] = (forP.inventory[id] ?? 0) + qty)
forP.activeTarget = 'apple'
forP.addMastery = (s, it, n) => { forP.skills[s].mastery[it] = (forP.skills[s].mastery[it] ?? 1) + n }
forP.setSkillState = (id, patch) => Object.assign(forP.skills[id], patch)
forP.xpTotalForLevel = (l) => totalXpForLevel(l)
const forage = new ForagingSkill(forP)
withRandom([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], () => {
  forage.tick(3000)
  forage.tick(3000)
  forage.tick(3000)
})
check('3s×3 → 3 次动作', forage.actionsDone === 3, `got ${forage.actionsDone}`)
check('苹果 = 3（无双倍）', forP.inventory.apple === 3, `got ${forP.inventory.apple}`)
check('XP = 30', forP.skills.foraging.exp === 30, `got ${forP.skills.foraging.exp}`)
check('双倍触发（random<0.01）', (() => {
  const p2 = makePlayer('foraging', 1)
  p2.gainItem = (id, q) => (p2.inventory[id] = (p2.inventory[id] ?? 0) + q)
  p2.addMastery = (s, it, n) => { p2.skills[s].mastery[it] = (p2.skills[s].mastery[it] ?? 1) + n }
  p2.setSkillState = (id, patch) => Object.assign(p2.skills[id], patch)
  p2.xpTotalForLevel = (l) => totalXpForLevel(l)
  p2.activeTarget = 'apple'
  const f2 = new ForagingSkill(p2)
  withRandom([0.001], () => f2.tick(3000)) // 双倍判定命中
  return p2.inventory.apple === 2
})(), 'double drop')

// 3. 垂钓（§3.1.2）：成功率 / 失败经验 / 稀有鱼
console.log('— 垂钓 —')
const fishP = makePlayer('fishing', 1)
fishP.gainItem = (id, qty) => (fishP.inventory[id] = (fishP.inventory[id] ?? 0) + qty)
fishP.addMastery = (s, it, n) => { fishP.skills[s].mastery[it] = (fishP.skills[s].mastery[it] ?? 1) + n }
fishP.setSkillState = (id, patch) => Object.assign(fishP.skills[id], patch)
fishP.xpTotalForLevel = (l) => totalXpForLevel(l)
fishP.activeTarget = 'crucian'
const fishing = new FishingSkill(fishP)
withRandom([0.1, 0.5], () => fishing.performAction(fishing.currentTarget)) // 成功(0.1<0.55)，非双倍非稀有
check('成功 → 鲫鱼 ×1', fishP.inventory.crucian === 1, `got ${fishP.inventory.crucian}`)
check('成功 → XP 10', fishP.skills.fishing.exp === 10, `got ${fishP.skills.fishing.exp}`)
withRandom([0.9], () => fishing.performAction(fishing.currentTarget)) // 失败
check('失败 → 无鱼', fishP.inventory.crucian === 1, `got ${fishP.inventory.crucian}`)
check('失败 → +2 XP（20%）', fishP.skills.fishing.exp === 12, `got ${fishP.skills.fishing.exp}`)
withRandom([0.1, 0.001], () => fishing.performAction(fishing.currentTarget)) // 成功 + 稀有
check('稀有 → 金龙鱼 ×1', fishP.inventory.goldenDragonFish === 1, `got ${fishP.inventory.goldenDragonFish}`)

// 4. 狩猎（§3.1.3）：弹药
console.log('— 狩猎 —')
const huntP = makePlayer('hunting', 1)
huntP.gainItem = (id, qty) => (huntP.inventory[id] = (huntP.inventory[id] ?? 0) + qty)
huntP.spendItem = (id, qty) => { const h = huntP.inventory[id] ?? 0; if (h < qty) return false; huntP.inventory[id] = h - qty; return true }
huntP.addMastery = (s, it, n) => { huntP.skills[s].mastery[it] = (huntP.skills[s].mastery[it] ?? 1) + n }
huntP.setSkillState = (id, patch) => Object.assign(huntP.skills[id], patch)
huntP.xpTotalForLevel = (l) => totalXpForLevel(l)
huntP.activeTarget = 'rabbitMeat'
huntP.inventory.trap = 3
const hunting = new HuntingSkill(huntP)
let ammoEvent = 0
EventBus.on('skill:outofammo', () => ammoEvent++)
withRandom([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], () => {
  hunting.tick(3000) // 1 次
  hunting.tick(3000) // 2 次
  hunting.tick(3000) // 3 次 → 陷阱耗尽
  hunting.tick(6000) // 无弹药：不累积计时
})
check('3 次动作后陷阱耗尽', huntP.inventory.trap === 0, `got ${huntP.inventory.trap}`)
check('兔肉 = 3', huntP.inventory.rabbitMeat === 3, `got ${huntP.inventory.rabbitMeat}`)
check('无弹药时不再动作', hunting.actionsDone === 3, `got ${hunting.actionsDone}`)
check('发出 outofammo 事件', ammoEvent >= 1, `got ${ammoEvent}`)

// 5. 挖掘（§3.1.4）：化石
console.log('— 挖掘 —')
const excP = makePlayer('excavation', 1)
excP.gainItem = (id, qty) => (excP.inventory[id] = (excP.inventory[id] ?? 0) + qty)
excP.addMastery = (s, it, n) => { excP.skills[s].mastery[it] = (excP.skills[s].mastery[it] ?? 1) + n }
excP.setSkillState = (id, patch) => Object.assign(excP.skills[id], patch)
excP.xpTotalForLevel = (l) => totalXpForLevel(l)
excP.activeTarget = 'potato'
const excav = new ExcavationSkill(excP)
withRandom([0.5, 0.01], () => excav.performAction(excav.currentTarget)) // 化石判定命中
check('土豆 ×1 + 化石食材 ×1', excP.inventory.potato === 1 && excP.inventory.fossilIngredient === 1, JSON.stringify(excP.inventory))

// 6. 农耕（§3.1.5）：种植 / 生长 / 收获 / 枯萎
console.log('— 农耕 —')
const farmP = makePlayer('farming', 1)
farmP.gainItem = (id, qty) => (farmP.inventory[id] = (farmP.inventory[id] ?? 0) + qty)
farmP.spendItem = (id, qty) => { const h = farmP.inventory[id] ?? 0; if (h < qty) return false; farmP.inventory[id] = h - qty; return true }
farmP.addMastery = (s, it, n) => { farmP.skills[s].mastery[it] = (farmP.skills[s].mastery[it] ?? 1) + n }
farmP.setSkillState = (id, patch) => Object.assign(farmP.skills[id], patch)
farmP.xpTotalForLevel = (l) => totalXpForLevel(l)
farmP.setPlot = (i, plot) => { while (farmP.farming.plots.length <= i) farmP.farming.plots.push(null); farmP.farming.plots[i] = plot }
farmP.clearPlot = (i) => { if (i < farmP.farming.plots.length) farmP.farming.plots[i] = null }
farmP.inventory.wheatSeed = 3
const farm = new FarmingSkill(farmP)
let t = 1_000_000
Date.now = () => t
check('初始 4 块农田', farm.maxPlots === 4, `got ${farm.maxPlots}`)
check('等级 1 不能种辣椒（需 20 级）', farm.canPlant(0, 'chiliSeed') === false)
check('可以种小麦', farm.canPlant(0, 'wheatSeed') === true)
farm.plant(0, 'wheatSeed')
check('种子消耗 1 个', farmP.inventory.wheatSeed === 2, `got ${farmP.inventory.wheatSeed}`)
t += 45_000 // 45s
check('生长 50%', Math.abs(farm.plotProgress(0) - 0.5) < 0.01, `got ${farm.plotProgress(0)}`)
check('未成熟不可收获', farm.harvest(0) === false)
t += 50_000 // 累计 95s > 90s
check('已成熟', farm.isMature(0) === true)
withRandom([0.9], () => farm.tick(16)) // 枯萎判定未触发（0.9 > 0.03）
check('收获 → 小麦 ×1', farm.harvest(0) === true && farmP.inventory.wheat === 1, JSON.stringify(farmP.inventory))
check('收获 → +25 XP', farmP.skills.farming.exp === 25, `got ${farmP.skills.farming.exp}`)
check('地块清空', farm.plotAt(0) === null)
farm.plant(0, 'wheatSeed')
t += 90_000
withRandom([0.001], () => farm.tick(16)) // 枯萎判定触发
check('枯萎判定', farm.plotAt(0)?.withered === true)
check('枯萎清理无产出', farm.harvest(0) === true && (farmP.inventory.wheat ?? 0) === 1, JSON.stringify(farmP.inventory))
Date.now = realNow

// 7. 烹饪（§3.2.1）：成功 / 失败
console.log('— 烹饪 —')
const cookP = makePlayer('cooking', 1)
cookP.gainItem = (id, qty) => (cookP.inventory[id] = (cookP.inventory[id] ?? 0) + qty)
cookP.spendItem = (id, qty) => { const h = cookP.inventory[id] ?? 0; if (h < qty) return false; cookP.inventory[id] = h - qty; return true }
cookP.addMastery = (s, it, n) => { cookP.skills[s].mastery[it] = (cookP.skills[s].mastery[it] ?? 1) + n }
cookP.setSkillState = (id, patch) => Object.assign(cookP.skills[id], patch)
cookP.xpTotalForLevel = (l) => totalXpForLevel(l)
cookP.inventory.potato = 5
const cooking = new CookingSkill(cookP)
const roast = cooking.recipes.find((r) => r.id === 'roastPotato')
check('材料不足时不能制作', (() => {
  const p2 = makePlayer('cooking', 1)
  p2.gainItem = () => {}
  p2.spendItem = () => false
  p2.setSkillState = (id, patch) => Object.assign(p2.skills[id], patch)
  p2.xpTotalForLevel = (l) => totalXpForLevel(l)
  const c2 = new CookingSkill(p2)
  return c2.craft(roast) === 'denied'
})())
withRandom([0.5], () => cooking.craft(roast)) // 0.5 < 0.9 成功
check('成功 → 烤土豆 ×1', cookP.inventory.roastPotato === 1, `got ${cookP.inventory.roastPotato}`)
check('成功 → 土豆剩 3', cookP.inventory.potato === 3, `got ${cookP.inventory.potato}`)
check('成功 → +30 XP', cookP.skills.cooking.exp === 30, `got ${cookP.skills.cooking.exp}`)
withRandom([0.95], () => cooking.craft(roast)) // 失败
check('失败 → 无产出', cookP.inventory.roastPotato === 1, `got ${cookP.inventory.roastPotato}`)
check('失败 → 材料仍消耗', cookP.inventory.potato === 1, `got ${cookP.inventory.potato}`)
check('失败 → +15 XP（半额）', cookP.skills.cooking.exp === 45, `got ${cookP.skills.cooking.exp}`)

// 8. 烘焙（§3.2.2）
console.log('— 烘焙 —')
const bakeP = makePlayer('baking', 3) // 白面包需 3 级
bakeP.gainItem = (id, q) => (bakeP.inventory[id] = (bakeP.inventory[id] ?? 0) + q)
bakeP.spendItem = (id, q) => { const h = bakeP.inventory[id] ?? 0; if (h < q) return false; bakeP.inventory[id] = h - q; return true }
bakeP.addMastery = () => {}
bakeP.setSkillState = (id, patch) => Object.assign(bakeP.skills[id], patch)
bakeP.xpTotalForLevel = (l) => totalXpForLevel(l)
bakeP.inventory.wheat = 3
const baking = new BakingSkill(bakeP)
const milling = baking.recipes.find((r) => r.id === 'milling')
withRandom([0.5], () => baking.craft(milling))
check('磨面粉：小麦×1 → 面粉×2', bakeP.inventory.flour === 2 && bakeP.inventory.wheat === 2, JSON.stringify(bakeP.inventory))
bakeP.inventory.saltOre = 2
withRandom([0.5], () => baking.craft(baking.recipes.find((r) => r.id === 'whiteBread')))
check('白面包制作成功', bakeP.inventory.whiteBread === 1, JSON.stringify(bakeP.inventory))
check('白面包带持续回血 regen', getItem('whiteBread').regen?.turns === 3, JSON.stringify(getItem('whiteBread').regen))

// 9. 腌制 / 调酒 / 调料（§3.2.3-3.2.5）
console.log('— 腌制 / 调酒 / 调料 —')
const makeProd = (skillId, SkillCls, inv) => {
  const p = makePlayer(skillId, 1)
  p.gainItem = (id, q) => (p.inventory[id] = (p.inventory[id] ?? 0) + q)
  p.spendItem = (id, q) => { const h = p.inventory[id] ?? 0; if (h < q) return false; p.inventory[id] = h - q; return true }
  p.addMastery = () => {}
  p.setSkillState = (id, patch) => Object.assign(p.skills[id], patch)
  p.xpTotalForLevel = (l) => totalXpForLevel(l)
  Object.assign(p.inventory, inv)
  return { p, sk: new SkillCls(p) }
}
const pres = makeProd('preserving', PreservingSkill, { cabbage: 2, saltOre: 3, chili: 1 })
withRandom([0.5], () => pres.sk.craft(pres.sk.recipes.find((r) => r.id === 'pickledCabbage')))
check('腌白菜成功', pres.p.inventory.pickledCabbage === 1, JSON.stringify(pres.p.inventory))
check('酱油带对决 buff', getItem('soySauce').buff?.duration === 10)
const brew = makeProd('brewing', BrewingSkill, { apple: 3, water: 2 })
withRandom([0.5], () => brew.sk.craft(brew.sk.recipes.find((r) => r.id === 'appleJuice')))
check('苹果汁成功', brew.p.inventory.appleJuice === 1, JSON.stringify(brew.p.inventory))
check('酒类带醉酒标记', getItem('riceWine').drunk === true)
const spice = makeProd('spiceMixing', SpiceMixingSkill, { saltOre: 2, peppercorn: 1 })
withRandom([0.5], () => spice.sk.craft(spice.sk.recipes.find((r) => r.id === 'salt')))
check('食盐成功', spice.p.inventory.salt === 2, JSON.stringify(spice.p.inventory))

// 10. 厨具锻造 + 穿戴（§3.2.6 / §5.1）
console.log('— 厨具锻造 / 装备 —')
const smith = makeProd('craftsmithing', CraftsmithingSkill, { wood: 3, copperOre: 3, ironOre: 4 })
const ck = smith.sk.recipes.find((r) => r.id === 'copperKnife')
withRandom([0.5], () => smith.sk.craft(ck))
check('铜刀锻造成功', smith.p.inventory.copperKnife === 1, JSON.stringify(smith.p.inventory))
const eqPlayer = {
  skills: { tasteAcumen: { level: 1, exp: 0, mastery: {} }, knife: { level: 1, exp: 0, mastery: {} } },
  inventory: { copperKnife: 1 },
  equipment: { weapon: null, helmet: null, body: null, legs: null, boots: null, offhand: null, amulet: null, ring: null },
  gold: 100,
  farming: { plots: [] },
  gainItem: function (id, q) { this.inventory[id] = (this.inventory[id] ?? 0) + q },
  spendItem: function (id, q) { const h = this.inventory[id] ?? 0; if (h < q) return false; if (h === q) delete this.inventory[id]; else this.inventory[id] = h - q; return true },
}
// 用真实 store 逻辑简化验证：直接测 equip/unequip 语义
check('穿戴铜刀（weapon 槽）', (() => {
  const item = getItem('copperKnife')
  if (item.slot !== 'weapon') return false
  if (!eqPlayer.spendItem('copperKnife', 1)) return false
  eqPlayer.equipment.weapon = 'copperKnife'
  return eqPlayer.equipment.weapon === 'copperKnife' && eqPlayer.inventory.copperKnife === undefined
})(), 'equip semantics')

// 11. 附产物掉落（木材/矿石）
console.log('— 附产物 —')
check('采摘 8% 木材（random 命中）', (() => {
  const p2 = makePlayer('foraging', 1)
  p2.gainItem = (id, q) => (p2.inventory[id] = (p2.inventory[id] ?? 0) + q)
  p2.addMastery = () => {}
  p2.setSkillState = (id, patch) => Object.assign(p2.skills[id], patch)
  p2.xpTotalForLevel = (l) => totalXpForLevel(l)
  p2.activeTarget = 'apple'
  const f2 = new ForagingSkill(p2)
  withRandom([0.5, 0.001], () => f2.performAction(f2.currentTarget))
  return p2.inventory.wood === 1
})(), 'wood drop')
check('挖掘 6% 铜矿（random 命中）', (() => {
  const p2 = makePlayer('excavation', 1)
  p2.gainItem = (id, q) => (p2.inventory[id] = (p2.inventory[id] ?? 0) + q)
  p2.addMastery = () => {}
  p2.setSkillState = (id, patch) => Object.assign(p2.skills[id], patch)
  p2.xpTotalForLevel = (l) => totalXpForLevel(l)
  p2.activeTarget = 'potato'
  const e2 = new ExcavationSkill(p2)
  withRandom([0.5, 0.9, 0.001, 0.9], () => e2.performAction(e2.currentTarget)) // 化石不中、铜矿中、铁矿不中
  return p2.inventory.copperOre === 1 && !p2.inventory.ironOre && !p2.inventory.fossilIngredient
})(), 'copper drop')

// 12. 料理对决（§4）
console.log('— 料理对决 —')
const combatP = makePlayer('knife', 5)
combatP.skills.tasteAcumen = { level: 1, exp: 0, mastery: {} }
combatP.skills.heatControl = { level: 1, exp: 0, mastery: {} }
combatP.skills.plating = { level: 1, exp: 0, mastery: {} }
combatP.skills.flavorArtistry = { level: 1, exp: 0, mastery: {} }
combatP.gainItem = (id, q) => (combatP.inventory[id] = (combatP.inventory[id] ?? 0) + q)
combatP.spendItem = (id, q) => { const h = combatP.inventory[id] ?? 0; if (h < q) return false; if (h === q) delete combatP.inventory[id]; else combatP.inventory[id] = h - q; return true }
combatP.gold = 100
combatP.gainGold = (n) => { combatP.gold += n }
combatP.unequip = (slot) => { const id = combatP.equipment[slot]; if (!id) return false; combatP.equipment[slot] = null; combatP.gainItem(id, 1); return true }
combatP.addMastery = () => {}
combatP.setSkillState = (id, patch) => Object.assign(combatP.skills[id], patch)
combatP.xpTotalForLevel = (l) => totalXpForLevel(l)
combatP.setCombat = (patch) => Object.assign(combatP.combat, patch)
combatP.maxHp = 10
combatP.equippedStats = { attack: 0, accuracy: 0, defense: 0, evasion: 0, critChance: 0, hpBonus: 0, speedBonus: 0 }
combatP.settings = { autoEat: true, autoEatThreshold: 50 }
combatP.equipment = {}
combatP.combat = { style: 'knife', hp: 10, flavorEnergy: 50 }
combatP.inventory.roastPotato = 5
createSkillInstances(combatP)
const fight = new Combat(combatP)
const apprentice = COMBAT_REGIONS[0].opponents[0]
let wins = 0
for (let i = 0; i < 5; i++) {
  fight.start(apprentice)
  let g = 0
  while (fight.inFight && g++ < 2000) fight.tick(5000)
  if (fight.result === 'win') wins++
}
check('5 战学徒厨师（刀工5级+烤土豆）胜 ≥ 4', wins >= 4, `wins=${wins}`)
check('胜利奖励金币', combatP.gold > 0, `gold=${combatP.gold}`)
check('品鉴力获得经验', combatP.skills.tasteAcumen.exp > 0, `exp=${combatP.skills.tasteAcumen.exp}`)
check('刀工获得经验', combatP.skills.knife.exp > 0, `exp=${combatP.skills.knife.exp}`)
fight.start(COMBAT_REGIONS[9].opponents[1]) // 深渊守卫 L98
let g2 = 0
while (fight.inFight && g2++ < 3000) fight.tick(5000)
check('对 L98 深渊守卫战败', fight.result === 'lose', `result=${fight.result}`)
check('战败后品鉴值恢复', combatP.combat.hp === combatP.maxHp, `hp=${combatP.combat.hp}`)
check('克制三角：刀工克摆盘 / 摆盘克调味 / 调味克刀工', STYLE_ADVANTAGE.knife === 'plating' && STYLE_ADVANTAGE.plating === 'flavor' && STYLE_ADVANTAGE.flavor === 'knife')
check('战败随机丢失一件装备', (() => {
  combatP.inventory = { roastPotato: 5 } // 清掉之前对决可能掉落的装备，避免误判
  combatP.equipment = { weapon: 'copperKnife', helmet: null }
  fight.start(COMBAT_REGIONS[9].opponents[1])
  let g = 0
  while (fight.inFight && g++ < 3000) fight.tick(5000)
  return fight.result === 'lose' && !combatP.equipment.weapon && !combatP.inventory.copperKnife
})(), JSON.stringify(combatP.equipment))

// 13. 新系统（真实 Pinia store）：任务 / 成就 / 转生 / 奥义 / 腐坏 / 食灵
console.log('— 新系统（真实 store）—')
setActivePinia(createPinia())
const p = usePlayerStore()
p.newGame()
p.inventoryCap = 100 // 测试集需容纳 22+ 种物品（§5.4 默认 20 格）
p.bankCap = 500

// 主线任务链（§7.2）
const questBumps = [
  ['gather', 'apple', 10], ['harvest', 'wheat', 3], ['gather', 'crucian', 5], ['gather', 'rabbitMeat', 5],
  ['gather', 'potato', 5], ['gather', 'saltOre', 5], ['craft', 'roastPotato', 5], ['craft', 'whiteBread', 3],
  ['craft', 'soySauce', 2], ['craft', 'copperKnife', 1], ['combatWin', 'any', 3], ['boss', '面条之王', 1], ['explore', 'any', 5],
]
for (const [kind, param, qty] of questBumps) {
  for (let i = 0; i < qty; i++) p.bumpQuest(kind, param)
}
check('主线任务推进（前 12 个完成）', p.quests.index === 12 && p.quests.completed.length === 12, `index=${p.quests.index}`)
check('主线任务奖励金币累计（100+2670）', p.gold === 2770, `gold=${p.gold}`)
p.setSkillState('foraging', { level: 30 })
p.setSkillState('cooking', { level: 30 })
p.setSkillState('knife', { level: 30 })
p.syncQuestProgress()
check('q13（3 技能 30 级）完成 → 全部任务通关', p.quests.index === 13, `index=${p.quests.index}`)
check('q13 奖励神秘调料', (p.inventory.mysterySpice ?? 0) === 2, JSON.stringify(p.inventory.mysterySpice))

// 成就（§6.1）
p.stats.combatWins = 1
p.checkAchievements()
check('成就 firstWin 解锁', p.achievements.includes('firstWin'), JSON.stringify(p.achievements))
check('firstWin 奖励金币', p.gold >= 100 + 50 + 150)
for (const id of ['crucian', 'carp', 'perch', 'salmon', 'tuna', 'eel', 'lobster', 'crab', 'abalone', 'seaCucumber', 'bluefin', 'grouper', 'goldenDragonFish']) p.gainItem(id, 1)
p.checkAchievements()
check('allFish 成就解锁 → 渔夫之戒', p.achievements.includes('allFish') && p.inventory.fishermanRing === 1, JSON.stringify(p.achievements))
check('图鉴完成度 > 0', p.collectionPct > 0, `pct=${p.collectionPct}`)

// 转生（§3：99 → 120）
p.setSkillState('foraging', { level: 99, exp: 1000 })
check('99 级可转生', p.prestigeSkill('foraging') === true)
check('转生后重置为 1 级', p.skills.foraging.level === 1 && p.skills.foraging.prestiges === 1, JSON.stringify(p.skills.foraging))
check('转生后上限 120', p.getMaxLevel('foraging') === 120)
const pForage = new ForagingSkill(p)
pForage.addXp(83)
check('转生 +10% 经验（83 → 约 91）', p.skills.foraging.exp >= 90, `exp=${p.skills.foraging.exp}`)

// 奥义（§3.4.1）
p.gainTastePoints(100)
p.toggleAoji('sharpBlade')
check('激活锋利之刃', p.gastronomy.active.includes('sharpBlade'))
p.drainAoji(10_000) // 0.5/s × 10s = 5 点
check('奥义消耗品鉴点数', p.tastePoints === 95, `points=${p.tastePoints}`)
p.gainTastePoints(2)
p.tastePoints = 3 // 直接设置以测试耗尽关闭
p.drainAoji(10_000) // 需消耗 5 点 > 持有 3 → 归零关闭
check('点数耗尽自动全部关闭', p.gastronomy.active.length === 0 && p.tastePoints === 0, `points=${p.tastePoints} active=${p.gastronomy.active.length}`)

// 食灵（§3.3.6）
p.gainItem('appleSpirit', 1)
check('食灵出战（苹果精灵）', p.setSpiritActive('appleSpirit', true) === true)
check('出战消耗物品', p.inventory.appleSpirit === undefined)
check('食灵效果聚合（采摘+5%）', p.spiritEffects().xpPct.foraging === 5, JSON.stringify(p.spiritEffects()))
p.gainItem('wheatSpirit', 1)
p.gainItem('fishSpirit', 1)
check('第二个食灵出战', p.setSpiritActive('fishSpirit', true) === true)
check('第三个被拒（满 2 个）', p.setSpiritActive('wheatSpirit', true) === false)
p.setSpiritActive('appleSpirit', false)
check('召回返还物品', p.inventory.appleSpirit === 1, JSON.stringify(p.inventory))

// 保鲜 / 腐坏（§5.4 / §3.4.2）
p.gainItem('lobster', 2)
check('腐坏计时建立', typeof p.spoilage.lobster === 'number', JSON.stringify(p.spoilage))
let spoilEvent = 0
EventBus.on('spoilage:spoil', () => spoilEvent++)
p.checkSpoilage(Date.now() + 25 * 3600_000)
check('过期腐坏清除', p.inventory.lobster === undefined && spoilEvent >= 1, JSON.stringify(p.inventory))
p.gainItem('lobster', 2)
p.gainItem('preservative', 1)
const r = p.useItem('preservative')
check('保鲜剂使用成功', r.ok === true, JSON.stringify(r))
p.checkSpoilage(Date.now() + 23 * 3600_000)
check('保鲜后 23h 未腐坏', p.inventory.lobster === 2, JSON.stringify(p.inventory))
p.gainItem('xpTonic', 1)
p.useItem('xpTonic')
check('经验增益剂生效 ×1.5', p.getXpMultiplier() === 1.5, `mult=${p.getXpMultiplier()}`)

// 食灵契约制作（§3.3.6）
const spiritP = makePlayer('spiritSummoning', 5)
spiritP.gainItem = (id, q) => (spiritP.inventory[id] = (spiritP.inventory[id] ?? 0) + q)
spiritP.spendItem = (id, q) => { const h = spiritP.inventory[id] ?? 0; if (h < q) return false; if (h === q) delete spiritP.inventory[id]; else spiritP.inventory[id] = h - q; return true }
spiritP.addMastery = () => {}
spiritP.setSkillState = (id, patch) => Object.assign(spiritP.skills[id], patch)
spiritP.xpTotalForLevel = (l) => totalXpForLevel(l)
spiritP.inventory.apple = 10
spiritP.inventory.saltOre = 2
const ss = new SpiritSummoningSkill(spiritP)
const appleContract = ss.recipes.find((r) => r.id === 'contract_appleSpirit')
withRandom([0.5], () => ss.craft(appleContract))
check('苹果精灵契约制作成功', spiritP.inventory.appleSpirit === 1, JSON.stringify(spiritP.inventory))

// 探索（§3.4.3）
const expP = makePlayer('exploration', 5)
expP.gainItem = (id, q) => (expP.inventory[id] = (expP.inventory[id] ?? 0) + q)
expP.gainGold = (n) => { expP.gold += n }
expP.spendGold = (n) => { if (n > expP.gold) return false; expP.gold -= n; return true }
expP.addMastery = () => {}
expP.setSkillState = (id, patch) => Object.assign(expP.skills[id], patch)
expP.xpTotalForLevel = (l) => totalXpForLevel(l)
expP.onExplorationSuccess = () => { expP.explored = (expP.explored ?? 0) + 1 }
expP.maxHp = 10
expP.setCombat = (patch) => Object.assign(expP.combat, patch)
expP.combat = { hp: 10 }
expP.gold = 50
const expSkill = new ExplorationSkill(expP)
expP.activeTarget = 'streetVendor'
withRandom([0.1, 0.1, 0.1, 0.1], () => expSkill.performAction(expSkill.currentTarget)) // 成功 + 全掉落
check('探索成功获得金币', expP.gold > 50, `gold=${expP.gold}`)
check('探索成功计数', expP.explored === 1, `explored=${expP.explored}`)
const goldBefore = expP.gold
withRandom([0.95], () => expSkill.performAction(expSkill.currentTarget)) // 失败（成功率 91%）
check('探索失败损失金币', expP.gold === goldBefore - 5, `gold=${expP.gold}`)

// 战斗联动：食灵回血 / 奥义伤害 / 品鉴点数（真实 store）
p.setSkillState('knife', { level: 5 })
p.inventory.roastPotato = 5
p.gainItem('lingzhiSpirit', 1)
p.setSpiritActive('lingzhiSpirit', true)
p.toggleAoji('godPower')
p.gainTastePoints(50)
const realCombat = new Combat(p)
let winCount = 0
for (let i = 0; i < 3; i++) {
  realCombat.start(COMBAT_REGIONS[0].opponents[0])
  let g = 0
  while (realCombat.inFight && g++ < 2000) realCombat.tick(5000)
  if (realCombat.result === 'win') winCount++
}
check('奥义+食灵下 3 战全胜', winCount === 3, `wins=${winCount}`)
check('对决胜利计数', p.stats.combatWins >= 4, `wins=${p.stats.combatWins}`)
check('品鉴点数入账', p.tastePoints >= 3, `points=${p.tastePoints}`)
check('战斗日志含灵芝回血', realCombat.log.some((l) => l.text.includes('灵芝')), 'regen log')

// 14. §13 扩展（真实 store）：餐厅 / 公会 / 赛季 / 竞技场
console.log('— §13 扩展 —')
setActivePinia(createPinia())
const p2 = usePlayerStore()
p2.newGame()

// 餐厅经营
p2.gainItem('roastPotato', 5)
check('餐厅菜单上菜', p2.setRestaurantMenu(0, 'roastPotato') === true)
check('餐厅初始 2 菜单位', p2.restaurantSlots === 2)
const hourly = p2.restaurantHourlyIncome
check('餐厅小时收入 > 0', hourly > 0, `hourly=${hourly}`)
p2._tickRestaurant(3600_000)
check('餐厅 1 小时收入入账', p2.stats.restaurantTotal >= Math.floor(hourly) && p2.gold >= 100 + Math.floor(hourly), `total=${p2.stats.restaurantTotal}`)
check('重复上菜被拒', p2.setRestaurantMenu(1, 'roastPotato') === false)
p2.gold = 100000
check('餐厅升级', p2.upgradeRestaurant() === true && p2.restaurant.level === 2)

// 公会
check('加入鲜味联盟', p2.joinGuild('umami') === true)
check('公会被动（产量 +5%）', p2.guildEffects().yieldPct === 5)
p2.bumpGuild('gather', 'apple', 'foraging')
check('公会任务进度累计', p2.guild.taskProgress['umami_1'] === 1)
for (let i = 0; i < 30; i++) p2.bumpGuild('harvest', 'wheat', 'farming')
check('公会任务完成得点数', p2.guild.points === 20, `points=${p2.guild.points}`)
check('公会商店兑换', p2.guildShopBuy('xpTonic') === true && p2.guild.points === 5)
check('公会点数不足被拒', p2.guildShopBuy('mysterySpice') === false)

// 赛季
const season = p2.activeSeasonDef
check('活跃赛季存在', !!season?.id, JSON.stringify(season))
p2.bumpSeason('gather', 'strawberry') // 不依赖具体赛季，验证不崩
const st = p2.seasonState()
check('赛季状态初始化', typeof st.missionProgress === 'object' && Array.isArray(st.claimed))
st.points = 90
const claimedBefore = st.claimed.length
const tierIdx = st.claimed.includes(0) ? 1 : 0
check('赛季奖励领取', p2.seasonClaimTier(tierIdx) === true && st.claimed.length === claimedBefore + 1)

// 竞技场（本地镜像）
const arenaOpps = generateArenaOpponents(1)
check('竞技场生成 10 名镜像对手', arenaOpps.length === 10 && arenaOpps[0].isPvp === true)
p2.onArenaEnd(true, '测试对手', 10)
p2.onArenaEnd(true, '测试对手', 10)
p2.onArenaEnd(false, '测试对手', 10)
check('竞技场战绩（2 胜后败，连胜清零最佳 2）', p2.stats.arena.wins === 2 && p2.stats.arena.currentStreak === 0 && p2.stats.arena.bestStreak === 2, JSON.stringify(p2.stats.arena))

// 15. 注册表与数据一致性
console.log('— 注册表 / 数据 —')
const regP = makePlayer('foraging', 1)
regP.gainItem = () => {}
regP.addMastery = () => {}
regP.setSkillState = (id, patch) => Object.assign(regP.skills[id], patch)
regP.xpTotalForLevel = (l) => totalXpForLevel(l)
regP.setPlot = (i, p) => { regP.farming.plots[i] = p }
regP.clearPlot = () => {}
createSkillInstances(regP)
check('20 个技能实例（11 制作/采集 + 9 对决/辅助）', ALL_SKILL_IDS.every((id) => getSkillInstance(id)), 'missing instance')
check('每种作物都有种子在商店', CROPS.every((c) => SHOP_ITEMS.some((s) => s.itemId === c.seedId)), 'missing seed in shop')
check('烹饪 110 个食谱（基础 50 + 扩充 60）', cooking.recipes.length === 110, `got ${cooking.recipes.length}`)
check('饮品 99（含 20 种调味能量茶饮）/ 调料 84（含 9 种香料）/ 装备 467（含扩充×2 + 赛季套装）', (() => {
  const types = { drink: 0, spice: 0, equipment: 0 }
  for (const it of Object.values(ITEMS)) if (types[it.type] !== undefined) types[it.type]++
  return types.drink === 99 && types.spice === 84 && types.equipment === 467
})(), JSON.stringify({ d: Object.values(ITEMS).filter((x) => x.type === 'drink').length, s: Object.values(ITEMS).filter((x) => x.type === 'spice').length, e: Object.values(ITEMS).filter((x) => x.type === 'equipment').length }))

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
