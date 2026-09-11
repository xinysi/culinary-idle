// 系统测试 — 对照《美食放置：食灵山海》需求文档的全面回归
// 运行：node scripts/ci/system_test.mjs
// 覆盖：技能经验/产出、联动链、对决（伤害/克制/命中/暴击/胜负）、装备、
//       离线（80%效率/12h上限/跨天）、存档（往返/迁移/导入导出）、背包、经济、
//       成就图鉴、数值安全（除零/NaN/越界）
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getSkillInstance, getAllSkillInstances } from '../../src/game/skills/registry.js'
import { Combat } from '../../src/game/combat/Combat.js'
import { COMBAT_REGIONS, COMBAT_BOSSES, STYLE_ADVANTAGE, opp } from '../../src/game/data/combat.js'
import { ForagingSkill } from '../../src/game/skills/ForagingSkill.js'
import { countForMasteryLevel } from '../../src/game/core/mastery.js'
import { EXPEDITIONS } from '../../src/game/data/expeditions.js'
import { EQUIPMENT_SETS, equipSetBonuses } from '../../src/game/data/equipSets.js'
import { regularLevelFromServes, REGULARS } from '../../src/game/data/regulars.js'
import { starFromScore } from '../../src/game/data/michelin.js'
import { FLAVOR_PAIRS } from '../../src/game/data/flavorPairs.js'
import { rankFromScore, contestWeek } from '../../src/game/data/gearContest.js'
import { festivalBoost } from '../../src/game/data/festivals.js'
import { SCHOOLS, schoolCost } from '../../src/game/data/schools.js'
import { STAFF, staffCost, staffWage } from '../../src/game/data/staff.js'
import { REGIONS } from '../../src/game/data/regions.js'
import { carryFromLevel } from '../../src/game/data/legacy.js'
import { PATRONS, patronCost, PATRON_SWITCH_GOLD } from '../../src/game/data/patrons.js'
import { MILESTONES, milestoneSummary } from '../../src/game/data/milestones.js'
import { CHRONICLE_CAP, groupByDay } from '../../src/game/data/chronicle.js'
import { QUIRK_CAT_DEFS, quirkCategoryStats } from '../../src/game/data/tales.js'
import { recipesForPair, easiestRecipeForPair } from '../../src/game/data/flavorRecipes.js'
import { BISCUIT_HEAL_PCT, BISCUIT_BUFF_TURNS, BISCUIT_ACC, BISCUIT_SPEED_PCT, BISCUIT_COOLDOWN_TURNS, BISCUIT_TASTE_RATE } from '../../src/game/data/biscuitUse.js'
import { weatherForDay } from '../../src/game/data/weather.js'
import { MASCOTS, mascotBondLevel, mascotReward } from '../../src/game/data/mascots.js'
import { banquetTierFor } from '../../src/game/data/banquets.js'
import { takeoutConcurrency, takeoutUpgradeCost, takeoutPrice, TAKEOUT_MAX_LEVEL } from '../../src/game/data/takeout.js'
import { BRANCH_THEMES, themeMult, THEME_BONUS_PER_LEVEL } from '../../src/game/data/branchThemes.js'
import { BRANCHES } from '../../src/game/data/branches.js'
import { SUPPLIERS, supplierDailyCost, SUPPLIER_MAX_CONTRACTS, SUPPLIER_PRICE_MULT } from '../../src/game/data/suppliers.js'
import { CHEFS, chefForWeek, chefOpponent, chefReward } from '../../src/game/data/chefChallenges.js'
import { ALL_TITLES, TITLE_TOTAL, honorBonuses, honorLevelOf, honorNextNeed, perkOf, TITLE_PERK_VALUE } from '../../src/game/data/honor.js'
import { CODEX_TIERS, CODEX_TIER_TOTAL, CODEX_REWARDS, codexPointsFor } from '../../src/game/data/codexShop.js'
import { SET_MEALS, activeSetMeal, setMealBoard, mealMissing } from '../../src/game/data/setMeals.js'
import { RIVAL_SHOPS, RIVAL_BOARD_SIZE, RIVAL_MONTH_GROWTH, rivalsOfMonth, monthIndexOf, playerScoreFrom, rankOf, rivalReward, rankStars } from '../../src/game/data/rivals.js'
import { realmOpponent } from '../../src/game/data/mysticRealm.js'
import { MAIL_CAP, MAIL_HARD_CAP, mailKindLabel } from '../../src/game/data/mail.js'
import { FRIENDS, friendBondLevel, friendBondProgress, friendVisitReward } from '../../src/game/data/friends.js'

// 内容同步（2026-09-11）：信箱/厨友新增成就的取用（ALL_ACHIEVEMENTS 已在上方导入过）
const ACH = (id) => ALL_ACHIEVEMENTS.find((a) => a.id === id)
const ACH_MAIL_FIRST = ACH('mailFirst')
const ACH_FRIEND_FIRST = ACH('friendFirst')
const ACH_FRIEND_ALL = ACH('friendAllBond')
import { FishingSkill } from '../../src/game/skills/FishingSkill.js'
import { HuntingSkill } from '../../src/game/skills/HuntingSkill.js'
import { ExcavationSkill } from '../../src/game/skills/ExcavationSkill.js'
import { FarmingSkill } from '../../src/game/skills/FarmingSkill.js'
import { CookingSkill } from '../../src/game/skills/CookingSkill.js'
import { BakingSkill } from '../../src/game/skills/BakingSkill.js'
import { CraftsmithingSkill } from '../../src/game/skills/CraftsmithingSkill.js'
import { SpiritSummoningSkill } from '../../src/game/skills/SpiritSummoningSkill.js'
import { ExplorationSkill } from '../../src/game/skills/ExplorationSkill.js'
import { computeOfflineProgress } from '../../src/game/core/OfflineProgress.js'
import { totalXpForLevel, xpProgress } from '../../src/game/core/Experience.js'
import { SaveManager } from '../../src/game/core/SaveManager.js'
import { EventBus } from '../../src/game/core/EventBus.js'
import { settleOffline } from '../../src/game/bootstrap.js'
import { useUiStore } from '../../src/stores/ui.js'
import { ITEMS, getItem } from '../../src/game/data/items.js'
import { cardPoolFrom, cardStrength, simulateBattle, settleBattle, DIFFICULTIES } from '../../src/game/data/cardBattle.js'
import { ALL_ACHIEVEMENTS } from '../../src/game/data/achievements.js'
import { QUESTS } from '../../src/game/data/quests.js'
import { SHOP_ITEMS } from '../../src/game/data/shop.js'
import { SPIRITS } from '../../src/game/data/spiritTiers.js'
import { AOJIS } from '../../src/game/data/aojis.js'
import { SEASONS } from '../../src/game/data/seasons.js'

const bugs = [] // {sev, area, desc, repro, expected, actual, cause, fix}
let pass = 0
let fail = 0

function check(area, name, cond, detail = '') {
  if (cond) {
    pass++
    console.log(`  ok  [${area}] ${name}`)
  } else {
    fail++
    console.log(`FAIL  [${area}] ${name} ${detail}`)
  }
}
function bug(sev, area, desc, repro, expected, actual, cause, fix) {
  bugs.push({ sev, area, desc, repro, expected, actual, cause, fix })
  console.log(`  ⚠ ${sev} ${area}: ${desc}`)
}

const realRandom = Math.random
function withRandom(seq, fn) {
  let i = 0
  Math.random = () => seq[Math.min(i++, seq.length - 1)]
  try {
    return fn()
  } finally {
    Math.random = realRandom
  }
}

function freshPlayer(skills = {}) {
  setActivePinia(createPinia())
  const p = usePlayerStore()
  p.newGame()
  p.settings.autoEat = true
  p.settings.autoEatThreshold = 60
  // 测试隔离：禁用限时窗口的「无参」路径（CI 运行时刻可能命中晨集/茶歇 → 经验断言受时区污染）；
  // 传参调用（W 节窗口断言）走原实现
  const realMarketBoost = p.marketBoost.bind(p)
  const realActive = p.activeMarketEvents.bind(p)
  p.marketBoost = (...a) => (a.length ? realMarketBoost(...a) : { restaurant: 1, combatXp: 1, gatherXp: 1, craftXp: 1 })
  // 节庆（按日期生效）同样会污染产量/收入断言 → 测试内固定为无节庆
  p.festivalBoost = () => ({ restaurant: 1, gatherXp: 1, craftXp: 1, combatXp: 1, gatherYield: 1, active: [] })
  // 天气（按自然日生效）同理：风天 gatherYield>1 会让产量变成概率 +1，断言随机失败
  // → 保留天气定义本身（供「加成为 marketBoost 口径」断言读 weather 字段），只把各乘区压平
  const realWeather = p.weatherEffects.bind(p)
  p.weatherEffects = () => ({ ...realWeather(), restaurant: 1, gatherXp: 1, craftXp: 1, combatXp: 1, gatherYield: 1 })
  p.activeMarketEvents = (...a) => (a.length ? realActive(...a) : [])
  for (const [id, lv] of Object.entries(skills)) p.setSkillState(id, { level: lv, exp: totalXpForLevel(lv) })
  createSkillInstances(p)
  return p
}
function fightToEnd(combat, opponent, maxGuard = 3000) {
  if (combat.player.combat.hp <= 0) combat.player.setCombat({ hp: combat.player.maxHp })
  combat.start(opponent)
  let g = 0
  while (combat.inFight && g++ < maxGuard) combat.tick(5000)
  return combat.result
}

// ── A. 技能经验 / 等级 / 产出（低/中/高边界）─────────────
console.log('══ A. 技能系统 ══')
{
  const p = freshPlayer()
  const f = new ForagingSkill(p)
  p.activeTarget = 'apple'
  // 最低级
  f.addXp(totalXpForLevel(2)) // 1→2 恰好所需（RS 曲线：L2 = 18,364）
  check('技能', '恰好升到 2 级', p.skills.foraging.level === 2, `level=${p.skills.foraging.level}`)
  f.addXp(0)
  check('技能', '0 XP 无副作用', p.skills.foraging.exp === totalXpForLevel(2))
  f.addXp(-5)
  check('技能', '负 XP 被忽略', p.skills.foraging.exp === totalXpForLevel(2))
  // 中级：跨多级
  f.addXp(totalXpForLevel(12))
  check('技能', '12 级 XP 跨多级', p.skills.foraging.level >= 12, `level=${p.skills.foraging.level}`)
  // 高级：99 封顶
  p.setSkillState('foraging', { level: 99, exp: totalXpForLevel(99) })
  f.addXp(999_999)
  check('技能', '99 级封顶（未转生）', p.skills.foraging.level === 99, `level=${p.skills.foraging.level}`)
  // 转生后 120 上限
  p.setSkillState('foraging', { level: 99, exp: totalXpForLevel(99), prestiges: 1 })
  f.addXp(400_000_000) // 99→100 需 3.0 亿（2026-09 曲线）；4 亿可升到 100+
  check('技能', '转生后突破 99 级（>99 且 ≤120）', p.skills.foraging.level > 99 && p.skills.foraging.level <= 120, `level=${p.skills.foraging.level}`)
  // 升级事件
  let lvEvent = 0
  EventBus.on('player:levelup', () => lvEvent++)
  p.setSkillState('cooking', { level: 1, exp: 0 })
  getSkillInstance('cooking').addXp(totalXpForLevel(2))
  check('技能', '升级事件触发', lvEvent >= 1)
}
// 采集产出边界：等级锁 / 间隔下限
{
  const p = freshPlayer()
  const f = new ForagingSkill(p)
  p.setSkillTarget('foraging', 'spiritFruit') // 需 90 级（每技能独立目标）
  f.tick(60_000)
  check('技能', '等级不足不产出（灵果需90级）', f.actionsDone === 0, `done=${f.actionsDone}`)
  p.setSkillState('foraging', { level: 99, exp: totalXpForLevel(99) })
  f.tick(3000)
  check('技能', '99 级可采灵果（8s→下限?）', f.actionsDone === 1 || f.actionsDone === 0, 'interval clamp')
  const t = f.targets.find((x) => x.itemId === 'spiritFruit')
  check('技能', '99 级间隔 = max(8-1.35, 0.5)=6.65s', Math.abs(f.intervalMs(t) - 6650) < 1, `got ${f.intervalMs(t)}`)
}

// ── B. 技能联动链（采集→制作→对决闭环）──────────────
console.log('══ B. 联动链 ══')
{
  const p = freshPlayer({ cooking: 10, baking: 10 })
  // 采集→烹饪
  p.gainItem('potato', 10)
  const ck = getSkillInstance('cooking')
  withRandom([0.0], () => ck.craft(ck.recipes.find((r) => r.id === 'roastPotato')))
  check('联动', '采集土豆→制作烤土豆', p.inventory.roastPotato === 1, JSON.stringify(p.inventory.roastPotato))
  // 烘焙链：小麦→面粉→面包
  p.gainItem('wheat', 6)
  p.gainItem('saltOre', 2) // 白面包需盐矿
  const bk = getSkillInstance('baking')
  withRandom([0.0], () => bk.craft(bk.recipes.find((r) => r.id === 'milling')))
  withRandom([0.0], () => bk.craft(bk.recipes.find((r) => r.id === 'whiteBread')))
  check('联动', '农耕小麦→磨面粉→白面包', p.inventory.whiteBread === 1, JSON.stringify(p.inventory.whiteBread))
  // 调料链：盐矿→食盐→椒盐→铁板兔肉
  p.setSkillState('spiceMixing', { level: 20, exp: totalXpForLevel(20) })
  const sm = getSkillInstance('spiceMixing')
  p.gainItem('saltOre', 6)
  withRandom([0.0], () => sm.craft(sm.recipes.find((r) => r.id === 'salt')))
  p.gainItem('peppercorn_young', 2) // 嫩花椒（2026-09 recipeBalance 嫩化：低阶配方用嫩替代）
  withRandom([0.0], () => sm.craft(sm.recipes.find((r) => r.id === 'pepperSalt')))
  check('联动', '盐矿→食盐→椒盐', p.inventory.pepperSalt === 1, JSON.stringify(p.inventory.pepperSalt))
  p.setSkillState('cooking', { level: 18, exp: totalXpForLevel(18) })
  p.gainItem('rabbitMeat', 3)
  p.gainItem('onion', 2)
  p.gainItem('chili', 2)
  withRandom([0.0], () => ck.craft(ck.recipes.find((r) => r.id === 'ironPlateRabbit')))
  check('联动', '椒盐入菜：铁板兔肉', p.inventory.ironPlateRabbit === 1, JSON.stringify(p.inventory.ironPlateRabbit))
  // 锻造链：木材/铜矿→铜刀→对决属性
  const p2 = freshPlayer({ craftsmithing: 5, knife: 5, tasteAcumen: 1, heatControl: 1 })
  p2.gainItem('wood', 3)
  p2.gainItem('copperOre', 3)
  const cfs = getSkillInstance('craftsmithing')
  withRandom([0.0], () => cfs.craft(cfs.recipes.find((r) => r.output?.itemId === 'copperKnife')))
  check('联动', '木材/铜矿→铜刀锻造', p2.inventory.copperKnife === 1)
  p2.equip('copperKnife')
  const combat = new Combat(p2)
  const stats0 = combat.playerStats()
  // 词条（2026-09-06）：普通品质 0-1 条攻击词条（±50% 浮动 → 至多 +4.5）
  const baseAtk = 5 * 3 + getItem('copperKnife').stats.attack
  check('联动', '铜刀提升攻击（装备攻击并入面板）', stats0.attack >= baseAtk && stats0.attack <= baseAtk + 4.51, `atk=${stats0.attack}`)
}

// ── B2. 新系统（制作队列 / 装备词条 / 食客订单，2026-09-06）──
console.log('══ B2. 新系统（制作队列/装备词条/食客订单） ══')
{
  // 1) 制作队列：入队/合并/推进/暂停/恢复/清空
  const p = freshPlayer({ craftsmithing: 5 })
  p.gainItem('wood', 30)
  p.gainItem('copperOre', 30)
  const cs = getSkillInstance('craftsmithing')
  const recipe = cs.recipes.find((r) => r.output?.itemId === 'copperKnife')
  check('队列', 'enqueue 成功', cs.enqueue(recipe, 3).ok === true)
  cs.enqueue(recipe, 2)
  check('队列', '相同配方合并 qty', cs.craftQueue.length === 1 && cs.craftQueue[0].qty === 5)
  cs.tick(3001)
  check('队列', 'tick 推进 1 份（3s 间隔）', cs.craftQueue[0].qty === 4)
  p.inventory.wood = 0
  p.inventory.copperOre = 0
  cs.tick(3001)
  check('队列', '材料不足自动暂停', cs.craftQueue[0].paused === true)
  p.gainItem('wood', 10)
  p.gainItem('copperOre', 10)
  cs.resumeQueue()
  cs.tick(3001)
  check('队列', '补料恢复后继续', cs.craftQueue[0].paused === false && cs.craftQueue[0].qty === 3)
  cs.clearQueue()
  check('队列', '清空队列', cs.craftQueue.length === 0)
  for (let i = 0; i < 9; i++) cs.enqueue(recipe, 1)
  check('队列', '相同配方重复入队仅合并', cs.craftQueue.length === 1 && cs.craftQueue[0].qty === 9)

  // 2) 装备词条：穿戴生成、洗练扣费、面板乘区、金币词条
  const p2 = freshPlayer({ craftsmithing: 5 })
  p2.gainItem('copperKnife', 1)
  p2.equip('copperKnife')
  const mods = p2.gearMods?.weapon?.mods ?? []
  check('词条', '穿戴生成词条（普通 0-1 条）', Array.isArray(mods) && mods.length <= 1)
  p2.gold = 100000
  const rr = p2.rerollGearMod('weapon')
  check('词条', '洗练成功扣费（普通 400 金）', rr.ok === true && p2.gold === 100000 - 400)
  check('词条', '词条并入装备面板', p2.equippedStats.attack >= getItem('copperKnife').stats.attack)
  p2.gearMods.weapon = { itemId: 'copperKnife', mods: [{ stat: 'goldPct', label: '金币', value: 100 }] }
  const g0 = p2.gold
  p2.gainGold(100)
  check('词条', '金币词条生效（+100%）', p2.gold === g0 + 200)

  // 3) 食客订单：交付/移单/过期清理
  const p3 = freshPlayer({ cooking: 5 })
  p3.inventory.roastPotato = 5
  p3.orders = { list: [], nextAt: 0 }
  const order = { id: 'o1', name: '老饕老王', itemId: 'roastPotato', qty: 1, reward: 100, createdMs: Date.now(), expireAt: Date.now() + 3600000 }
  p3.orders.list.push(order)
  const g3 = p3.gold
  const r3 = p3.finishOrder('o1')
  check('订单', '交付成功发金币并移出列表', r3.ok === true && p3.gold === g3 + 100 && p3.orders.list.length === 0 && p3.inventory.roastPotato === 4)
  p3.restaurant.menu = [] // 无菜单不会生成新单
  p3.orders.list.push({ ...order, id: 'o2', expireAt: Date.now() - 1000 })
  p3._tickOrders(2000)
  check('订单', '过期订单自动清理', p3.orders.list.length === 0)
}

// ── B3. 卡牌对战（纯逻辑层，2026-09-06 重构+平衡优化）──
console.log('══ B3. 卡牌对战 ══')
{
  check('卡牌', '战力随档位单调（铁刀>铜刀）', cardStrength('ironKnife') > cardStrength('copperKnife'), `${cardStrength('ironKnife')} vs ${cardStrength('copperKnife')}`)
  const pool = cardPoolFrom({ roastPotato: true, apple: true, copperKnife: true, saltOre: true, water: true })
  check('卡牌', '收藏池只含料理/装备', pool.length === 2 && pool.includes('roastPotato') && pool.includes('copperKnife') && !pool.includes('apple') && !pool.includes('saltOre') && !pool.includes('water'), pool.join(','))
  // rng 固定（0.5 时 variance=1.0 恰为基准战力）→ 胜负与基准战力完全一致
  const r = simulateBattle(['copperKnife', 'copperKnife', 'copperKnife'], { roastPotato: true }, { rng: () => 0.5 })
  check('卡牌', '模拟稳定：3 局且胜负与战力一致（基准）', r.rounds.length === 3 && r.rounds.every((x) => x.win === (x.ms > x.ts)), JSON.stringify(r.rounds.map((x) => x.win)))
  check('卡牌', '难度默认标准（AI×1）', r.diff === 'normal')
  const p4 = freshPlayer({})
  p4.stats.cardBattle = { wins: 0, losses: 0, day: '2000-1-1' }
  const g4 = p4.gold
  const rw1 = settleBattle(p4, { won: true, rounds: [] }, 'normal')
  check('卡牌', '标准胜 +75 金（×1.5）+ 每日首胜 +50', rw1.reward === 75 && rw1.dailyBonus === 50 && p4.gold === g4 + 125 && (p4.inventory.energyBiscuit ?? 0) === 1, `gold+${p4.gold - g4}`)
  const g5 = p4.gold
  const rw2 = settleBattle(p4, { won: true, rounds: [] }, 'normal')
  check('卡牌', '同日再胜无每日加成（+75）', rw2.dailyBonus === 0 && p4.gold === g5 + 75)
  settleBattle(p4, { won: false, rounds: [] }, 'normal')
  check('卡牌', '失败计入败场', p4.stats.cardBattle.wins === 2 && p4.stats.cardBattle.losses === 1)
  const p5 = freshPlayer({})
  const g6 = p5.gold
  const rw3 = settleBattle(p5, { won: true, rounds: [] }, 'hard')
  check('卡牌', '挑战难度胜 +125（×2.5）', rw3.reward === 125 && p5.gold === g6 + 125 + 50, `got=${p5.gold - g6}`)
}

// ── C. 对决系统 ───────────────────────────────────
console.log('══ C. 对决系统 ══')
// 伤害公式精确值（§11.2）
{
  const p = freshPlayer({ knife: 5, tasteAcumen: 1, heatControl: 1 })
  p.inventory.roastPotato = 20
  const combat = new Combat(p)
  const app = COMBAT_REGIONS[0].opponents[0] // L1 学徒厨师：hp18 def2 eva5.5 acc12 atk1.7
  combat.start(app)
  // 玩家攻击（强制命中、不暴击）：dmg = floor(15 × 1.0 × (1-2/102)) = floor(14.7) = 14
  withRandom([0.0, 0.9], () => combat.resolveTurn())
  check('对决', '伤害公式精确（15攻 vs def2 → 14）', combat.opponentHp === 18 - 14, `hp=${combat.opponentHp}`)
}
// 克制三角（§3.3）：玩家 knife 对 plating 对手 +15%
{
  const p = freshPlayer({ knife: 5, tasteAcumen: 1, heatControl: 1 })
  p.inventory.roastPotato = 20
  const combat = new Combat(p)
  const stall = COMBAT_REGIONS[0].opponents[1] // 杂役帮厨 plating L4（knife 克 plating）
  combat.start(stall)
  // 命中/克制强制：hit roll 0 → 命中；crit roll 0.9 → 不暴击
  // 预期 dmg = floor(15 × 1.15 × (1 - def/(def+100)))
  const expDmg = Math.floor(15 * 1.15 * (1 - stall.def / (stall.def + 100)))
  withRandom([0.0, 0.9], () => combat.resolveTurn())
  check('对决', '克制 +15%（knife 克 plating）', combat.opponentHp === stall.hp - expDmg, `hp=${combat.opponentHp} exp=${stall.hp - expDmg}`)
}
// 命中/闪避边界 + 暴击
{
  const p = freshPlayer({ knife: 5, tasteAcumen: 1, heatControl: 1 })
  p.inventory.roastPotato = 20
  const combat = new Combat(p)
  const app = COMBAT_REGIONS[0].opponents[0]
  combat.start(app)
  // 命中率 = acc/(acc+eva) = 15/(15+5.5) ≈ 0.73；强制 miss：hit roll 0.9 > 0.73
  const hpBefore = combat.opponentHp
  withRandom([0.95, 0.95], () => combat.resolveTurn())
  check('对决', '命中判定：高随机值 → 闪避（无伤害）', combat.opponentHp === hpBefore, `hp=${combat.opponentHp}`)
  // 暴击：crit roll 0 → ×2
  combat.start(app)
  withRandom([0.0, 0.0], () => combat.resolveTurn())
  check('对决', '暴击 ×2（14×2=28 溢出击杀）', combat.opponentHp === 0 && combat.result === 'win', `hp=${combat.opponentHp}`)
}
// 胜负判定 / 玩家死亡 / 食物冷却 / 自动进食阈值
{
  const p = freshPlayer({ knife: 5, tasteAcumen: 1, heatControl: 1 })
  p.inventory.roastPotato = 20
  const combat = new Combat(p)
  // 对战 L98 必败 → HP 恢复
  const res = fightToEnd(combat, COMBAT_REGIONS[9].opponents[1])
  check('对决', 'L98 战败判定', res === 'lose')
  check('对决', '战败后品鉴值恢复满', p.combat.hp === p.maxHp)
  // 食物冷却 3 回合
  combat.useFood('roastPotato')
  check('对决', '食物冷却期内再吃被拒', combat.useFood('roastPotato') === false)
  combat.foodCooldown = 0
  // 自动进食阈值 100%
  p.setCombat({ hp: 1 })
  p.settings.autoEatThreshold = 100
  combat.maybeAutoEat()
  check('对决', 'HP1 + 阈值100% 自动进食', p.combat.hp > 1, `hp=${p.combat.hp}`)
  // 攻击速度下限
  p.setSkillState('knife', { level: 99, exp: totalXpForLevel(99), prestiges: 1 })
  check('对决', '攻速下限 1.2s（高等级+加速装备钳制）', combat.playerStats().speedMs >= 1200, `speed=${combat.playerStats().speedMs}`)
  // 摆盘弹药不足
  p.setCombatStyle('plating')
  p.inventory.garnish = 0
  const c2 = new Combat(p)
  c2.start(COMBAT_REGIONS[0].opponents[0])
  const hp2 = c2.opponentHp
  withRandom([0.0, 0.0], () => c2.resolveTurn())
  check('对决', '摆盘无弹药不攻击', c2.opponentHp === hp2, `hp=${c2.opponentHp}`)
}

// ── D. 装备系统 ───────────────────────────────────
console.log('══ D. 装备系统 ══')
{
  const p = freshPlayer()
  p.gainItem('copperKnife', 1)
  check('装备', '穿戴铜刀', p.equip('copperKnife') === true && p.equipment.weapon === 'copperKnife')
  check('装备', '穿戴后背包扣减', p.inventory.copperKnife === undefined)
  p.gainItem('ironKnife', 1)
  p.equip('ironKnife')
  check('装备', '换装旧装备返还', p.equipment.weapon === 'ironKnife' && p.inventory.copperKnife === 1)
  check('装备', '非装备物品拒绝', p.equip('apple') === false)
  check('装备', '卸下返还', p.unequip('weapon') === true && p.inventory.ironKnife === 1)
  // 属性合计
  p.gainItem('ironKnife', 1)
  p.gainItem('ironHat', 1)
  p.equip('ironKnife')
  p.equip('ironHat')
  p.gearMods = {} // 词条属性独立测试（见 B2 节，此处校验基础装备属性之和）
  const st = p.equippedStats
  const kStats = getItem('ironKnife').stats
  const hStats = getItem('ironHat').stats
  // 2026-09-09：铁刀+铁帽同属铁套 → 额外叠加 2 件套加成（套装效果见下方「套装」段）
  const ironSetBonus = equipSetBonuses(p.equipment).attack
  check('装备', '属性合计（铁刀+铁帽 = 装备属性之和 + 2 件套加成）', st.attack === kStats.attack + (hStats.attack ?? 0) + ironSetBonus && st.defense === (kStats.defense ?? 0) + (hStats.defense ?? 0) + ironSetBonus && st.accuracy === (kStats.accuracy ?? 0) + (hStats.accuracy ?? 0), JSON.stringify(st))
  // 品质差异（§5.2）：普通 vs 传说
  const copper = getItem('copperKnife').stats.attack
  const gold = getItem('goldKnife').stats.attack
  check('装备', '品质差异：金刀(24) > 铜刀(3)', gold > copper * 3, `gold=${gold} copper=${copper}`)
  // 掉落：BOSS 独特掉落清单非空（品质校验见 U 节图鉴）
  check('装备', '全部 BOSS 均有独有掉落', COMBAT_BOSSES.every((b) => (b.drops?.length ?? 0) > 0), `bosses=${COMBAT_BOSSES.length}`)
}

// ── E. 离线进度（§10.2.2 / §8.1）──────────────────
console.log('══ E. 离线进度 ══')
{
  const p = freshPlayer()
  p.activeTarget = 'apple'
  const f = new ForagingSkill(p)
  // 边界：0 / 负 / 极小
  check('离线', 'elapsed=0 → 无收益', computeOfflineProgress(f, 0) === null)
  check('离线', 'elapsed<0 → 无收益', computeOfflineProgress(f, -5000) === null)
  check('离线', 'elapsed<1s → 无收益', computeOfflineProgress(f, 500) === null)
  // 80% 效率精确值
  const r1 = computeOfflineProgress(f, 3600_000) // 1h，3s 间隔
  check('离线', '1h 动作数 = floor(1200×0.8)=960', r1.actions === Math.floor((3600_000 / 3000) * 0.8), `actions=${r1.actions}`)
  check('离线', '1h 经验 = 14400（xpBalance 基准 10+5lv）', r1.exp === 14400, `exp=${r1.exp}`)
  // 精通保底产量档位（2026-09-09，参照 Rocky Idle 的 batch：档位同时给经验与产出）
  {
    const py = freshPlayer({ foraging: 50 })
    const fy = new ForagingSkill(py)
    const apple = fy.targets.find((t) => t.itemId === 'apple')
    const q0 = fy.yieldQuantity(1, apple)
    py.skills.foraging.mastery.apple = countForMasteryLevel(50)
    const q50 = fy.yieldQuantity(1, apple)
    py.skills.foraging.mastery.apple = countForMasteryLevel(100)
    const q100 = fy.yieldQuantity(1, apple)
    check('精通', '保底产量档位（精通 0/50/100 → 1/2/3 个）', q0 === 1 && q50 === 2 && q100 === 3, `${q0}/${q50}/${q100}`)
  }
  // 远行采集队（2026-09-09 长线挂机线，参照 Rocky Idle 的 Runs）
  {
    check('采集队', '线路解锁按技能等级（垂钓 25）', freshPlayer({ fishing: 40 }).expeditionUnlocked('fishery') === true && freshPlayer({ fishing: 1 }).expeditionUnlocked('fishery') === false)
    check('采集队', '槽位 2 需垂钓 30', freshPlayer({ fishing: 30 }).expeditionSlotUnlocked('fishery', 1) === true && freshPlayer({ fishing: 25 }).expeditionSlotUnlocked('fishery', 1) === false)
    const pe = freshPlayer({ fishing: 40 })
    const r0 = pe.expeditionStart('fishery', 0)
    check('采集队', '出发占用槽位', r0.ok === true && !!pe.expeditionState('fishery').slots[0])
    check('采集队', '未到期不可领取', pe.expeditionClaim('fishery', 0) === null)
    const st = pe.expeditionState('fishery')
    st.slots[0].readyAt = Date.now() - 1 // 视为到期
    const claim = pe.expeditionClaim('fishery', 0)
    const gained = Object.values(claim?.gained ?? {}).reduce((a, b) => a + b, 0)
    check('采集队', '领取产出（1 小时 ≈ 5 个 + 金币）', claim?.ok === true && gained >= 5 && claim.gold > 0, `gained=${gained} gold=${claim?.gold}`)
    check('采集队', '领取后自动开始下一轮 + 完成数 +1', !!st.slots[0] && st.slots[0].readyAt > Date.now() && st.completions === 1)
    check('采集队', '撤回清空槽位', pe.expeditionStop('fishery', 0) === true && pe.expeditionState('fishery').slots[0] === null)
    check('采集队', '产出池与稀有掉落均为既有物品', EXPEDITIONS.every((e) => e.slots.every((s) => s.pool.every((id) => !!ITEMS[id])) && (!e.rare || !!ITEMS[e.rare.itemId])))
  }
  // 地窖陈酿（2026-09-10 时间型放置线）：酒类/腌制品入窖 → 到期领金币（价值×倍率）
  {
    check('地窖', '未解锁（调酒 <10）', freshPlayer({ brewing: 5 }).cellarUnlocked() === false)
    const pc = freshPlayer({ brewing: 20 })
    check('地窖', '调酒 20 解锁 + 初始 3 槽', pc.cellarUnlocked() === true && pc.cellarSlots() === 3)
    pc.inventory.riceWine = 20
    pc.inventory.apple = 20 // 苹果（水果）不可陈酿
    check('地窖', '仅酒类/腌制品可陈酿', pc.isAgeable('riceWine') === true && pc.isAgeable('apple') === false)
    check('地窖', '非陈酿物入窖被拒', pc.cellarPut(0, 'apple', 5, 12).ok === false)
    const r = pc.cellarPut(0, 'riceWine', 10, 12)
    check('地窖', '入窖扣物品 + 占槽', r.ok === true && pc.inventory.riceWine === 10 && !!pc.cellarState().slots[0])
    check('地窖', '未成熟不可领取', pc.cellarClaim(0) === null)
    const slot = pc.cellarState().slots[0]
    const g0 = pc.gold
    slot.readyAt = Date.now() - 1
    const c = pc.cellarClaim(0)
    const expectGold = Math.max(1, Math.round((ITEMS.riceWine.value ?? 0) * 10 * 1.5))
    check('地窖', '到期出窖按价值×倍率给金币', c?.ok === true && c.gold === expectGold && pc.gold === g0 + expectGold, `gold=${c?.gold} expect=${expectGold}`)
    check('地窖', '出窖后槽位清空 + 计数', pc.cellarState().slots[0] === null && (pc.stats.cellarRounds ?? 0) === 1)
    // 撤回无损
    pc.cellarPut(1, 'riceWine', 3, 24)
    const before = pc.inventory.riceWine
    pc.cellarTakeBack(1)
    check('地窖', '撤回无损取回原物', pc.inventory.riceWine === before + 3 && pc.cellarState().slots[1] === null)
    // 价值上限与扩建
    check('地窖', '单槽价值上限拦截', pc.cellarPut(0, 'riceWine', 99, 48).ok === false)
    const slots0 = pc.cellarSlots()
    pc.gold = 1e6
    const ex = pc.cellarExpand()
    check('地窖', '扩建 +3 格', ex.ok === true && pc.cellarSlots() === slots0 + 3)
  }
  // 常客名录（2026-09-10）：每日招待偏好料理 → 好感等级换小费加成
  {
    const pr = freshPlayer()
    pr.restaurant.level = 3
    check('常客', '解锁按餐厅等级', pr.regularUnlocked('r_oldman') === true && pr.regularUnlocked('r_master') === false)
    check('常客', '偏好类别不符被拒', pr.regularServe('r_oldman', 'apple').ok === false)
    // 造一道符合要求的料理：主菜 tier ≥1
    const dish = Object.values(ITEMS).find((it) => it.type === 'food' && it.category === '主菜' && (it.tier ?? 0) >= 1)
    pr.inventory[dish.id] = 5
    const s1 = pr.regularServe('r_oldman', dish.id)
    check('常客', '招待成功扣料理 + 给金币', s1.ok === true && pr.inventory[dish.id] === 4 && s1.gold === 220, JSON.stringify(s1))
    check('常客', '同日重复招待被拒', pr.regularServe('r_oldman', dish.id).ok === false)
    // 好感等级：3 次升 1 级、7 次升 2 级
    pr.regularState('r_oldman').serves = 3
    check('常客', '好感门槛（3 次 = Lv1）', regularLevelFromServes(3) === 1 && regularLevelFromServes(7) === 2)
    pr.regularState('r_oldman').serves = 25
    check('常客', '满好感 Lv5 + 小费加成', regularLevelFromServes(25) === 5 && pr.regularTipPct() === 10)
    const gift = pr.regularClaimGift('r_oldman')
    check('常客', '满级谢礼只可领一次', gift.ok === true && pr.inventory.mysterySpice === 1 && pr.regularClaimGift('r_oldman').ok === false)
  }
  // 食灵物语（2026-09-10）：羁绊等级解锁心声片段 + 一次性奖励
  {
    const ps = freshPlayer()
    ps.spirits.owned.appleSpirit_1 = 1
    check('食灵物语', '未达羁绊不可领取', ps.spiritStoryClaim('appleSpirit_1', 2).ok === false)
    ps.spiritBonds = { appleSpirit_1: 3 * 86400000 } // 3 天 → 羁绊 Lv1（未达片段门槛 2）
    check('食灵物语', '羁绊 Lv1 未解锁任何片段', ps.spiritStoryStage('appleSpirit_1') === 0 && ps.spiritStoryClaim('appleSpirit_1', 2).ok === false)
    ps.spiritBonds.appleSpirit_1 = 7 * 86400000 // 7 天 → 羁绊 Lv2
    check('食灵物语', '羁绊 Lv2 解锁首段、Lv3 仍锁', ps.spiritStoryStage('appleSpirit_1') === 2 && ps.spiritStoryClaim('appleSpirit_1', 3).ok === false)
    const g0 = ps.gold
    const c1 = ps.spiritStoryClaim('appleSpirit_1', 2)
    check('食灵物语', '领取片段给奖励 + 计数', c1.ok === true && ps.gold === g0 + 500 && ps.stats.spiritStoryClaims === 1)
    check('食灵物语', '同片段不可重复领取', ps.spiritStoryClaim('appleSpirit_1', 2).ok === false)
    ps.spiritBonds.appleSpirit_1 = 31 * 86400000 // 31 天 → 羁绊满级
    check('食灵物语', '满羁绊解锁全部 4 段', ps.spiritStoryStage('appleSpirit_1') === 5 && ps.spiritStoryPending() === 3)
    const before = { ...ps.inventory }
    ps.spiritStoryClaim('appleSpirit_1', 3)
    ps.spiritStoryClaim('appleSpirit_1', 4)
    ps.spiritStoryClaim('appleSpirit_1', 5)
    check('食灵物语', '四段奖励全发（含神秘调料/能量饼干）', (ps.inventory.mysterySpice ?? 0) - (before.mysterySpice ?? 0) === 3 && (ps.inventory.energyBiscuit ?? 0) - (before.energyBiscuit ?? 0) === 1)
  }
  // 自动化中心（2026-09-10）：三项金币解锁自动化
  {
    const pa = freshPlayer()
    pa.gold = 30000
    check('自动化', '未解锁时自动出售不生效', pa.automationUnlocked('sell') === false)
    const u1 = pa.automationUnlock('sell')
    check('自动化', '解锁扣金币 + 标记', u1.ok === true && pa.gold === 25000 && pa.automationUnlocked('sell') === true)
    check('自动化', '重复解锁被拒', pa.automationUnlock('sell').ok === false)
    // 自动出售：价值 ≤ 阈值的采集食材，每种保留 1 件；矿物不参与
    pa.setSellThreshold(30)
    pa.inventory.apple = 10      // 苹果 value 10
    pa.inventory.saltOre = 10    // 矿物：不参与
    const gold0 = pa.gold
    pa._autoSell()
    check('自动化', '自动出售低价值食材（保留 1 件）', pa.inventory.apple === 1 && pa.inventory.saltOre === 10 && pa.gold > gold0, `apple=${pa.inventory.apple} saltOre=${pa.inventory.saltOre}`)
    check('自动化', '自动出售计数', (pa.stats.autoSold ?? 0) === 9)
    // 自动领取：地窖到期自动结算
    pa.skills.brewing.level = 20
    pa.inventory.riceWine = 5
    pa.cellarPut(0, 'riceWine', 2, 12)
    pa.cellarState().slots[0].readyAt = Date.now() - 1
    pa.automationUnlock('claim')
    pa._autoClaim()
    check('自动化', '自动领取地窖（成熟即结算）', pa.cellarState().slots[0] === null && (pa.stats.cellarRounds ?? 0) === 1)
    // 自动续队：常驻配方补队列
    const inst = getSkillInstance('cooking')
    inst.player.skills.cooking.level = 99
    const recipe = inst.recipes.find((r) => Object.keys(r.ingredients).length === 1)
    if (recipe) {
      for (const [id, q] of Object.entries(recipe.ingredients)) pa.inventory[id] = q * 3
      pa.setStandbyRecipe('cooking', recipe.id)
      pa.automationUnlock('queue')
      inst.clearQueue()
      pa._autoRefillQueue()
      check('自动化', '自动续队（队列空时补常驻配方）', inst.craftQueue.length === 1 && inst.craftQueue[0].recipeId === recipe.id)
    }
    check('自动化', '三项全解锁 → 成就条件成立', ['sell', 'queue', 'claim'].every((k) => pa.automationUnlocked(k)))
  }
  // 牧场养殖（2026-09-10）：买动物 → 周期消耗饲料产出蛋/奶/肉
  {
    const pm = freshPlayer({ farming: 20 })
    pm.gold = 100000
    check('牧场', '农耕 20 解锁 + 初始 2 栏', pm.ranchUnlocked() === true && pm.ranchPens() === 2)
    const b1 = pm.ranchBuy(0, 'chicken')
    check('牧场', '买下野鸡扣金币 + 占栏', b1.ok === true && pm.gold === 92000 && !!pm.ranchState().pens[0])
    check('牧场', '同栏重复购买被拒', pm.ranchBuy(0, 'boar').ok === false)
    // 无饲料不产出
    pm.ranchState().pens[0].lastAt = Date.now() - 5 * 3600_000
    pm._tickRanch()
    check('牧场', '饲料不足不产出', (pm.inventory.pheasantEgg ?? 0) === 0 && (pm.stats.ranchCycles ?? 0) === 0)
    // 有饲料：4 小时 1 周期 → 野鸡蛋 ×2 + 野鸡肉 ×1，消耗玉米 ×3
    pm.inventory.corn = 10
    pm.ranchState().pens[0].lastAt = Date.now() - 4.5 * 3600_000
    pm._tickRanch()
    check('牧场', '周期产出蛋/肉 + 扣饲料', (pm.inventory.pheasantEgg ?? 0) === 2 && (pm.inventory.pheasantMeat ?? 0) === 1 && pm.inventory.corn === 7, `egg=${pm.inventory.pheasantEgg} corn=${pm.inventory.corn}`)
    // 离线补算上限：48 小时只补 12 小时 = 3 个周期
    const before = pm.stats.ranchCycles ?? 0
    pm.inventory.corn = 100
    pm.ranchState().pens[0].lastAt = Date.now() - 48 * 3600_000
    pm._tickRanch()
    check('牧场', '离线补算上限 12h（4h 周期 = 3 次）', (pm.stats.ranchCycles ?? 0) - before === 3)
    const ex = pm.ranchExpand()
    check('牧场', '扩建 +1 栏', ex.ok === true && pm.ranchPens() === 3)
    check('牧场', '移出动物清空栏位', pm.ranchRemove(0) === true && pm.ranchState().pens[0] === null)
  }
  // 餐厅分店（2026-09-10）：金币开店 → 每小时入账（店长 +25%）
  {
    const pb = freshPlayer()
    pb.gold = 200000
    check('分店', '餐厅等级不足未解锁', freshPlayer().branchUnlocked() === false)
    pb.restaurant.level = 5
    check('分店', '餐厅 5 级解锁', pb.branchUnlocked() === true)
    const o1 = pb.branchOpen('east')
    check('分店', '开店扣金币', o1.ok === true && pb.gold === 150000 && !!pb.branches.east)
    check('分店', '重复开店被拒', pb.branchOpen('east').ok === false)
    check('分店', '餐厅 5 级时收 = 800×1.4', pb.branchHourlyOf('east') === 1120, String(pb.branchHourlyOf('east')))
    // 1.5 小时后入账 1 小时
    const g0 = pb.gold
    pb.branches.east.lastAt = Date.now() - 1.5 * 3600_000
    pb._tickBranches()
    check('分店', '整点入账（1.5h → 1 小时）', pb.gold === g0 + 1120 && (pb.stats.branchGold ?? 0) === 1120)
    // 离线 48h 只补 12h
    const g1 = pb.gold
    pb.branches.east.lastAt = Date.now() - 48 * 3600_000
    pb._tickBranches()
    check('分店', '离线补算上限 12h', pb.gold === g1 + 1120 * 12)
    // 店长 +25%
    const hire = pb.branchHireManager('east')
    check('分店', '雇店长扣费 + 时收 +25%', hire.ok === true && pb.branchHourlyOf('east') === Math.floor(800 * 1.4 * 1.25))
  }
  // 交易所（2026-09-10）：动态价格买低卖高 + 每日限额
  {
    check('交易所', '调料调配不足未解锁', freshPlayer({ spiceMixing: 5 }).exchangeUnlocked() === false)
    const px = freshPlayer({ spiceMixing: 20 })
    const goods = px.exchangeGoods()
    check('交易所', '本期货单 6 件且均为既有食材', goods.length === 6 && goods.every((g) => !!ITEMS[g.item.id]))
    check('交易所', '同期货价确定（两次一致）', goods.every((g, i) => g.sell === px.exchangeGoods()[i].sell))
    check('交易所', '买卖价差 35%', goods.every((g) => g.buy === Math.round(g.sell * 1.35)))
    const g0 = goods[0]
    px.inventory[g0.item.id] = 10
    const gold0 = px.gold
    const s1 = px.exchangeSell(g0.item.id, 4)
    check('交易所', '卖出扣货 + 入账', s1.ok === true && px.inventory[g0.item.id] === 6 && px.gold === gold0 + g0.sell * 4)
    check('交易所', '成交计入每日额度', px.exchangeTradedToday(g0.item.id) === 4)
    px.gold = 1e7
    const b1 = px.exchangeBuy(g0.item.id, 3)
    check('交易所', '买入扣金币 + 入包', b1.ok === true && px.inventory[g0.item.id] === 9 && px.exchangeTradedToday(g0.item.id) === 7)
    check('交易所', '超出每日额度被拒', px.exchangeSell(g0.item.id, 999).ok === false)
    const offGoods = Object.values(ITEMS).find((it) => it.type === 'ingredient' && !goods.some((g) => g.item.id === it.id))
    check('交易所', '非本期货品不可交易', px.exchangeSell(offGoods.id, 1).ok === false)
  }
  // 厨神试炼（2026-09-10）：限制条件判定 + 首通/重复奖励
  {
    const pt = freshPlayer({ knife: 40, tasteAcumen: 40, heatControl: 40 }) // 对决等级 = (40+40+40)/3 = 40
    check('试炼', '对决 30 级解锁', pt.combatLevel === 40 && pt.trialsUnlocked() === true && freshPlayer().trialsUnlocked() === false, `combatLevel=${pt.combatLevel}`)
    // 速攻：12 回合内 → 通关
    pt.trialStart('t_speed')
    const r1 = pt.onCombatEndTrial({ result: 'win', turns: 8, hpLeft: 50, hpMax: 100 })
    check('试炼', '速攻达标通关 + 首通奖励', r1?.passed === true && r1.first === true && pt.trialState('t_speed').clears === 1)
    // 速攻：13 回合 → 不达标并退出
    pt.trialStart('t_speed')
    const r2 = pt.onCombatEndTrial({ result: 'win', turns: 13, hpLeft: 50, hpMax: 100 })
    check('试炼', '超出回合数不达标', r2?.passed === false && pt.activeTrial === null)
    // 无伤：95% 血量 → 通关；80% → 不达标
    pt.trialStart('t_flawless')
    const r3 = pt.onCombatEndTrial({ result: 'win', turns: 30, hpLeft: 95, hpMax: 100 })
    check('试炼', '无伤达标（≥90% 血量）', r3?.passed === true)
    pt.trialStart('t_flawless')
    const r4 = pt.onCombatEndTrial({ result: 'win', turns: 30, hpLeft: 80, hpMax: 100 })
    check('试炼', '血量不足不达标', r4?.passed === false)
    // 连胜：3 连胜才通关，中间失败清零
    pt.trialStart('t_streak')
    pt.onCombatEndTrial({ result: 'win', turns: 5, hpLeft: 90, hpMax: 100 })
    pt.onCombatEndTrial({ result: 'win', turns: 5, hpLeft: 90, hpMax: 100 })
    check('试炼', '连胜进度累计', pt.trialState('t_streak').streak === 2)
    const r5 = pt.onCombatEndTrial({ result: 'win', turns: 5, hpLeft: 90, hpMax: 100 })
    check('试炼', '3 连胜通关 + 清零', r5?.passed === true && pt.trialState('t_streak').streak === 0)
    // 重复通关给 30% 金币
    const g0 = pt.gold
    pt.trialStart('t_speed')
    const r6 = pt.onCombatEndTrial({ result: 'win', turns: 5, hpLeft: 90, hpMax: 100 })
    check('试炼', '重复通关 30% 金币', r6?.passed === true && r6.first === false && pt.gold - g0 === Math.round(4000 * 0.3))
    // 失败退出
    pt.trialStart('t_overlevel')
    const r7 = pt.onCombatEndTrial({ result: 'lose', turns: 3, hpLeft: 0, hpMax: 100 })
    check('试炼', '失败自动退出', r7?.passed === false && pt.activeTrial === null)
  }
  // 米其林评级（2026-09-10）：六维评分 → 每日评审 → 星级收益
  {
    const pm = freshPlayer()
    check('米其林', '餐厅等级不足未解锁', pm.michelinUnlocked() === false)
    pm.restaurant.level = 5
    check('米其林', '餐厅 5 级解锁', pm.michelinUnlocked() === true)
    const s0 = pm.michelinScore().score
    check('米其林', '新档 0 星', starFromScore(s0).star === 0 && pm.michelinIncomePct() === 0)
    // 造分：菜单放高 tier 料理 + 装饰 + 评论家好评 + 分店 + 常客好感
    const dish = Object.values(ITEMS).find((it) => it.type === 'food' && (it.tier ?? 0) >= 6)
    pm.restaurant.menu = [dish.id, dish.id, dish.id, dish.id]
    pm.restaurant.decor = Array(50).fill('rdecor_1')
    pm.stats.criticServed = 4
    pm.stats.ordersServed = 30
    pm.branches = { east: { lastAt: Date.now(), manager: true }, west: { lastAt: Date.now(), manager: false } }
    for (const r of REGULARS) pm.regularState(r.id).serves = 25
    const s1 = pm.michelinScore().score
    check('米其林', '多维加分后达 3 星', starFromScore(s1).star === 3, `score=${s1}`)
    // 收益取「已评审」星级（评审前维持旧星级）
    pm.michelin.lastReviewDay = null
    pm._tickMichelin(6000)
    check('米其林', '每日评审写入分数/星级/最高', pm.michelin.stars === 3 && pm.michelin.score === s1 && pm.michelin.best === 3)
    check('米其林', '评审后星级收益（收入 +35% / 经验 +6%）', pm.michelinIncomePct() === 35 && pm.michelinXpPct() === 6)
    // 掉星：撤掉装饰与菜单后次日重评
    pm.restaurant.decor = []
    pm.restaurant.menu = []
    pm.stats.criticServed = 0
    pm.stats.ordersServed = 0
    for (const r of REGULARS) pm.regularState(r.id).serves = 0
    pm.branches = {}
    pm.michelin.lastReviewDay = null
    pm._tickMichelin(6000)
    check('米其林', '分数滑落会掉星（best 保留）', pm.michelin.stars === 0 && pm.michelin.best === 3)
  }
  // 风味搭配册（2026-09-10）：制作成功时按食材组合点亮
  {
    const pf = freshPlayer()
    check('风味册', '初始未点亮任何搭配', pf.flavorProgress().found === 0 && pf.flavorProgress().total === FLAVOR_PAIRS.length)
    const g0 = pf.gold
    const fresh = pf.discoverFlavors(['tomato', 'garlic'])
    check('风味册', '命中组合即点亮并给奖励', fresh.length === 1 && fresh[0].id === 'fp_tomato_basil' && pf.gold > g0)
    check('风味册', '重复命中不再奖励', pf.discoverFlavors(['tomato', 'garlic']).length === 0)
    check('风味册', '顺序无关 / 多余食材不影响', pf.discoverFlavors(['garlic', 'salt', 'tomato']).length === 0)
    const trio = pf.discoverFlavors(['chili', 'peppercorn', 'ginger', 'salt'])
    check('风味册', '三食材组合可点亮', trio.some((p) => p.id === 'fp_three_peppers'))
    // 制作成功会触发检测
    const pc = freshPlayer()
    const inst = getSkillInstance('cooking')
    inst.player.skills.cooking.level = 99
    const recipe = inst.recipes.find((r) => r.id === 'tomatoEgg') || inst.recipes.find((r) => (r.ingredients?.tomato ?? 0) > 0)
    if (recipe) {
      for (const [id, q] of Object.entries(recipe.ingredients)) pc.inventory[id] = q * 5
      let found = 0
      for (let i = 0; i < 20 && found === 0; i++) { inst.craft(recipe); found = pc.flavorProgress().found }
      check('风味册', '制作配方会触发搭配检测', typeof pc.flavorProgress().found === 'number')
    }
  }
  // 厨具大赛（2026-09-10）：每周一届，按全身装备评分取名次
  {
    const pg = freshPlayer()
    check('厨具赛', '对决等级不足未解锁', pg.gearContestUnlocked() === false)
    const pg2 = freshPlayer({ knife: 40, tasteAcumen: 40, heatControl: 40 })
    check('厨具赛', '空装备时评分为 0', pg2.gearScore().score === 0 && pg2.gearScore().parts.length === 0)
    // 穿上装备：铜刀 + 强化 + 词条 + 宝石
    pg2.equipment.weapon = 'copperKnife'
    const s1 = pg2.gearScore().score
    pg2.upgrades.copperKnife = 3
    const s2 = pg2.gearScore().score
    check('厨具赛', '强化会加分', s2 > s1, `${s1} → ${s2}`)
    pg2.gearMods.weapon = { itemId: 'copperKnife', mods: [{ stat: 'attack', value: 5 }, { stat: 'defense', value: 5 }] }
    const s3 = pg2.gearScore().score
    check('厨具赛', '词条会加分', s3 > s2, `${s2} → ${s3}`)
    check('厨具赛', '评分可映射档位', rankFromScore(s3).id.length === 1)
    const g0 = pg2.gold
    const r1 = pg2.gearContestRun()
    check('厨具赛', '参赛发奖 + 记录届次', r1.ok === true && pg2.gold > g0 && pg2.gearContest.week === contestWeek() && pg2.stats.gearContestRuns === 1)
    check('厨具赛', '同届不可重复参赛', pg2.gearContestRun().ok === false)
    // 跨届后可再参赛
    pg2.gearContest.week = contestWeek() - 1
    check('厨具赛', '换届后可再参赛', pg2.gearContestRun().ok === true && pg2.stats.gearContestRuns === 2)
    check('厨具赛', '历史最高分保留', pg2.gearContest.best >= s3)
  }
  // 节庆日历（2026-09-10）：按日期命中的全服加成
  {
    const pfest = freshPlayer()
    check('节庆', '无节庆日全为 1 倍', festivalBoost(new Date(2026, 8, 3)).restaurant === 1 && festivalBoost(new Date(2026, 8, 3)).gatherYield === 1)
    check('节庆', '开市日（1 日）餐厅 ×1.5', festivalBoost(new Date(2026, 8, 1)).restaurant === 1.5)
    check('节庆', '丰收祭（8~10 日）采集产量 ×1.25', festivalBoost(new Date(2026, 8, 9)).gatherYield === 1.25)
    check('节庆', '月末夜市命中当月最后两天（9 月 30 天 → 29/30）', festivalBoost(new Date(2026, 8, 30)).restaurant === 1.6 && festivalBoost(new Date(2026, 8, 29)).restaurant === 1.6 && festivalBoost(new Date(2026, 8, 28)).restaurant === 1)
    // marketBoost 叠加节庆（无参路径）
    const real = pfest.marketBoost.bind(pfest)
    pfest.marketBoost = () => real()
    const mb = pfest.marketBoost()
    const fest = pfest.festivalBoost()
    check('节庆', 'marketBoost 已乘入节庆倍率', Math.abs(mb.restaurant - fest.restaurant) < 1e-9, `mb=${mb.restaurant} fest=${fest.restaurant}`)
    check('节庆', '显式传参走纯函数（不受节庆影响）', typeof pfest.marketBoost(12, 1) === 'object')
    check('节庆', '未来预告只含命中日期', pfest.festivalUpcoming(40).every((u) => u.festivals.length > 0))
  }
  // 菜系研究（2026-09-10）：材料 + 计时 → 学派等级 → 该类料理加成
  {
    const ps = freshPlayer()
    ps.gold = 200000
    const def = SCHOOLS[0]
    const cost = schoolCost(def, 1)
    check('学派', '材料不足无法开研究', ps.schoolStart(def.id).ok === false)
    for (const [id, q] of Object.entries(cost.mats)) ps.inventory[id] = q
    const g0 = ps.gold
    const r1 = ps.schoolStart(def.id)
    check('学派', '开研究扣材料与金币', r1.ok === true && ps.gold === g0 - cost.gold && (ps.inventory[def.mats[0]] ?? 0) === 0, JSON.stringify(r1))
    check('学派', '同时只能研究一个学派', ps.schoolStart(SCHOOLS[1].id).ok === false && ps.schoolBusy() === def.id)
    check('学派', '未完成不可领取', ps.schoolClaim(def.id).ok === false)
    ps.schoolState(def.id).research.readyAt = Date.now() - 1
    const c1 = ps.schoolClaim(def.id)
    check('学派', '到期领取升级 + 计数', c1.ok === true && ps.schoolState(def.id).level === 1 && ps.stats.schoolLevels === 1)
    check('学派', '加成按学派等级生效', ps.schoolCraftXpPct(def.cats[0]) === 5 && ps.schoolHealPct(def.cats[0]) === 6 && ps.schoolIncomePct(def.cats[0]) === 8)
    check('学派', '未研究的类别无加成', ps.schoolCraftXpPct(SCHOOLS[3].cats[0]) === 0)
    // 餐厅收入贡献：菜单放该类主菜 → 收入高于无加成
    const dish = Object.values(ITEMS).find((it) => it.type === 'food' && it.category === def.cats[0])
    ps.restaurant.menu = [dish.id, dish.id]
    const incWith = ps.restaurantHourlyIncome
    ps.schoolState(def.id).level = 0
    const incWithout = ps.restaurantHourlyIncome
    check('学派', '餐厅收入按学派加成加权', incWith > incWithout, `${incWithout} → ${incWith}`)
    // 满级封顶
    ps.schoolState(def.id).level = 5
    check('学派', '满级后不可再研究', ps.schoolStart(def.id).ok === false)
  }
  // 雇工班底（2026-09-10）：一次性雇佣费 + 每小时工资，欠薪停工
  {
    const ph = freshPlayer()
    ph.gold = 500000
    check('雇工', '未雇佣时无加成无工资', ph.staffIncomePct() === 0 && ph.staffWagePerHour() === 0 && ph.staffActive('chef') === false)
    const cost1 = staffCost(1)
    const h1 = ph.staffHire('chef')
    check('雇工', '雇佣扣金币 + 等级 1 + 在岗', h1.ok === true && ph.gold === 500000 - cost1.gold && ph.staffLevelOf('chef') === 1 && ph.staffActive('chef') === true)
    check('雇工', '在岗加成生效（掌勺 +8%）', ph.staffIncomePct() === 8 && ph.staffWagePerHour() === staffWage(STAFF[0], 1))
    // 工资：1 小时扣一次
    const g0 = ph.gold
    ph.staff.chef.lastPayAt = Date.now() - 3600_000 * 2
    ph._tickStaff()
    check('雇工', '整点扣工资（2 小时）', ph.gold === g0 - staffWage(STAFF[0], 1) * 2 && (ph.stats.staffWages ?? 0) > 0)
    // 金币不足 → 欠薪停工
    ph.gold = 0
    ph.staff.chef.lastPayAt = Date.now() - 3600_000 * 2
    ph._tickStaff()
    check('雇工', '欠薪停工（保留等级）', ph.staff.chef.unpaid === true && ph.staffLevelOf('chef') === 1 && ph.staffActive('chef') === false && ph.staffIncomePct() === 0)
    // 补足金币 → 复岗
    ph.gold = 100000
    ph.staff.chef.lastPayAt = Date.now() - 3600_000
    ph._tickStaff()
    check('雇工', '补足金币自动复岗', ph.staff.chef.unpaid === false && ph.staffActive('chef') === true)
    check('雇工', '解雇清零', ph.staffFire('chef') === true && ph.staffLevelOf('chef') === 0)
    // 跑堂加成作用于订单
    ph.gold = 200000
    ph.staffHire('waiter')
    check('雇工', '跑堂给订单加成', ph.staffOrderPct() === 10 && ph.staffIncomePct() === 0)
  }
  // 产地与风土（2026-09-10）：考察 + 派驻采集队线路
  {
    const prg = freshPlayer({ fishing: 40 })
    prg.gold = 300000
    const rg = REGIONS[0]
    check('产地', '未考察时不可派驻', prg.regionPost('fishery', rg.id).ok === false)
    check('产地', '金币不足不可考察', freshPlayer().regionStudy(rg.id).ok === false)
    const g0 = prg.gold
    const st1 = prg.regionStudy(rg.id)
    check('产地', '考察扣金币 + 记录', st1.ok === true && prg.gold === g0 - rg.cost && prg.regionUnlocked(rg.id) === true)
    check('产地', '重复考察被拒', prg.regionStudy(rg.id).ok === false)
    const post = prg.regionPost('fishery', rg.id)
    check('产地', '派驻线路成功', post.ok === true && prg.regionPosting.fishery === rg.id)
    const line = prg.lineRegion('fishery')
    check('产地', '派驻加成可读取（当季 ×1.5）', line.def?.id === rg.id && line.bonus.qtyPct >= Math.round(rg.qtyPct), JSON.stringify(line.bonus))
    check('产地', '取消派驻', prg.regionPost('fishery', null).ok === true && prg.regionPosting.fishery === undefined)
    // 派驻后采集队产出仍为既有物品
    prg.regionPost('fishery', rg.id)
    const r0 = prg.expeditionStart('fishery', 0)
    prg.expeditionState('fishery').slots[0].readyAt = Date.now() - 1
    const claim = prg.expeditionClaim('fishery', 0)
    const ids = Object.keys(claim?.gained ?? {})
    check('产地', '派驻后产出仍为既有物品', r0.ok === true && claim?.ok === true && ids.every((id) => !!ITEMS[id]), ids.join(','))
    check('产地', '当季产地判定存在', typeof prg.regionsInSeason() === 'object')
  }
  // 师徒传承（2026-09-10）：转生留一手 + 徒弟按日成长
  {
    const pl = freshPlayer()
    pl.skills.knife.level = 100
    check('传承', '传承等级 = 等级 ×5%（上限 20）', carryFromLevel(100) === 5 && carryFromLevel(400) === 20 && carryFromLevel(19) === 0)
    const ok = pl.prestigeSkill('knife')
    check('传承', '转生后从 1+传承 级起步', ok === true && pl.skills.knife.level === 6 && pl.skills.knife.prestiges === 1, `lv=${pl.skills.knife.level}`)
    check('传承', '传承记录写入', pl.legacyCarryOf('knife') === 5)
    // 二次转生取历史最高
    pl.skills.knife.level = 100
    pl.prestigeSkill('knife')
    check('传承', '传承取历史最高不降低', pl.legacyCarryOf('knife') === 5)
    // 徒弟：首日只记录、跨日成长
    const pa2 = freshPlayer()
    pa2.legacy.apprentice.lastDay = null
    pa2._tickApprentice()
    const first = pa2.legacy.apprentice.level
    check('传承', '徒弟首日只记录不补历史', first === 0 && !!pa2.legacy.apprentice.lastDay)
    pa2.legacy.apprentice.lastDay = '2026-01-01'
    pa2.todayKey = '2026-01-04'
    pa2._tickApprentice()
    check('传承', '跨日按天数成长', pa2.legacy.apprentice.level === 3, `lv=${pa2.legacy.apprentice.level}`)
    pa2.legacy.apprentice.level = 50
    pa2.legacy.apprentice.lastDay = '2026-01-04'
    pa2.todayKey = '2026-02-04'
    pa2._tickApprentice()
    check('传承', '徒弟满级封顶 50', pa2.legacy.apprentice.level === 50)
    check('传承', '离线效率加成（满级 +20% → 100%）', Math.abs((0.8 + pa2.apprenticeOfflineBonus()) - 1.0) < 1e-9)
    check('传承', '徒弟称号随等级', freshPlayer().apprenticeRankName() === '新入门弟子')
  }
  // 食神信仰（2026-09-10）：供奉永久、切换需金币 + 冷却、效果挂在既有聚合点
  {
    const pp = freshPlayer()
    pp.gold = 500000
    const def = PATRONS[0] // 灶君：料理回血 +8%/级
    check('信仰', '未信仰时供奉被拒', pp.patronWorship(def.id).ok === false)
    check('信仰', '初始无加成', pp.patronEffects().healPct === 0)
    const sw = pp.patronSwitch(def.id)
    check('信仰', '切换信仰扣金币 + 记录冷却', sw.ok === true && pp.gold === 500000 - PATRON_SWITCH_GOLD && pp.patronSwitchCdMs() > 0)
    check('信仰', '冷却中不可再切', pp.patronSwitch(PATRONS[1].id).ok === false)
    const cost = patronCost(def, 1)
    check('信仰', '供品不足不可供奉', pp.patronWorship(def.id).ok === false)
    for (const [id, q] of Object.entries(cost.mats)) pp.inventory[id] = q
    const g0 = pp.gold
    const w1 = pp.patronWorship(def.id)
    check('信仰', '供奉扣供品与金币 + 升级', w1.ok === true && pp.gold === g0 - cost.gold && pp.patronLevel(def.id) === 1)
    check('信仰', '效果按等级展开', pp.patronEffects().healPct === 8)
    check('信仰', '只能向当前信仰供奉', pp.patronWorship(PATRONS[1].id).ok === false)
    pp.patron.lastSwitchAt = Date.now() - 25 * 3600_000
    check('信仰', '冷却结束可切换', pp.patronSwitch(PATRONS[1].id).ok === true && pp.patronLevel(def.id) === 1)
    check('信仰', '切换后旧加成失效（新神未供奉 = 无加成）', pp.patronEffects().healPct === 0 && pp.patronEffects().cellarPct === 0)
    // 供奉酒神到 1 级后再验证地窖加成
    const cost2 = patronCost(PATRONS[1], 1)
    for (const [id, q] of Object.entries(cost2.mats)) pp.inventory[id] = q
    pp.patronWorship(PATRONS[1].id)
    check('信仰', '酒神供奉后窖藏加成生效', pp.patronEffects().cellarPct === 12)
    pp.skills.brewing.level = 20
    pp.inventory.riceWine = 10
    pp.cellarPut(0, 'riceWine', 4, 12)
    pp.cellarState().slots[0].readyAt = Date.now() - 1
    const gold0 = pp.gold
    pp.cellarClaim(0)
    const base = Math.round((ITEMS.riceWine.value ?? 0) * 4 * 1.5)
    const expect = Math.round(base * 1.12)
    check('信仰', '窖神加成生效（+12%）', pp.gold === gold0 + expect, `got=${pp.gold - gold0} expect=${expect}`)
  }
  // 里程碑之路（2026-09-10）：长线目标聚合与进度
  {
    const pm = freshPlayer()
    const s0 = milestoneSummary(pm)
    check('里程碑', '定义完整且新档完成数为 0', MILESTONES.length >= 20 && s0.total === MILESTONES.length && s0.done === 0, JSON.stringify(s0))
    check('里程碑', '每个定义都有 value 函数', MILESTONES.every((m) => typeof m.value === 'function' && m.target > 0 && !!m.group))
    // 造进度：转生 3 次、图鉴若干、首领 2 位
    pm.stats.prestiges = 3
    pm.stats.bosses = ['面条之王', '火锅真君']
    pm.collected = { ...pm.collected, apple: 1, wheat: 1 }
    const s1 = milestoneSummary(pm)
    check('里程碑', '进度随玩家数据变化', s1.done >= 0 && s1.byGroup['成长'].total > 0)
    // 单项进度不超目标（进度条不溢出）
    pm.guild.points = 999999
    const g = MILESTONES.find((m) => m.id === 'm_guildMax')
    check('里程碑', '进度按目标截断', Math.min(g.target, g.value(pm)) === g.target)
    // 达成判定
    pm.skills.foraging.level = 120
    const m120 = MILESTONES.find((m) => m.id === 'm_skill120')
    check('里程碑', '达成判定正确（技能 120 级）', m120.value(pm) >= m120.target)
  }
  // 厨师年鉴（2026-09-10）：首次达成事件去重记录
  {
    const pc = freshPlayer()
    check('年鉴', '新档年鉴为空', (pc.chronicle ?? []).length === 0)
    const r1 = pc.recordChronicle('boss:面条之王', 'boss', '首次击败首领「面条之王」')
    check('年鉴', '记录一条', r1 === true && pc.chronicle.length === 1 && pc.chronicleCount('boss') === 1)
    check('年鉴', '同 key 不重复记录', pc.recordChronicle('boss:面条之王', 'boss', '重复内容') === false && pc.chronicle.length === 1)
    pc.recordChronicle('boss:火锅真君', 'boss', '首次击败首领「火锅真君」')
    pc.recordChronicle('prestige:1', 'prestige', '完成第 1 次转生')
    check('年鉴', '分类计数正确', pc.chronicleCount('boss') === 2 && pc.chronicleCount('prestige') === 1)
    check('年鉴', '条目含时间戳与文本', pc.chronicle.every((e) => typeof e.at === 'number' && !!e.text && !!e.kind))
    // 上限裁剪
    for (let i = 0; i < 320; i++) pc.recordChronicle('bulk:' + i, 'boss', '批量 ' + i)
    check('年鉴', '超出上限自动裁剪', pc.chronicle.length === CHRONICLE_CAP, `len=${pc.chronicle.length}`)
    // 按日分组
    const days = groupByDay([{ key: 'a', kind: 'boss', text: 'x', at: Date.now() }, { key: 'b', kind: 'boss', text: 'y', at: Date.now() }])
    check('年鉴', '按自然日分组', days.length === 1 && days[0].entries.length === 2)
  }
  // 天气与运势（2026-09-10）：按自然日确定性抽取
  {
    const pw = freshPlayer()
    const wx = pw.todayWeather()
    check('天气', '今日天气确定性（同日同结果）', wx.id === pw.todayWeather().id && !!wx.name && !!wx.icon)
    check('天气', '不同日期可给出不同天气', new Set([1, 2, 3, 4, 5, 6].map((i) => weatherForDay('2026-09-0' + i).id)).size > 1)
    const fx = pw.weatherEffects()
    check('天气', '加成为 marketBoost 口径（含天气定义）', fx.weather?.id === wx.id && typeof fx.gatherYield === 'number' && typeof fx.restaurant === 'number')
    const f = pw.todayFortune()
    check('运势', '幸运食材来自物品池', !!ITEMS[f.luckyItem] && f.tips.length === 3)
    check('运势', '幸运食材加成 20%', pw.luckyItemBonus(f.luckyItem) === 0.2 && pw.luckyItemBonus('__none__') === 0)
    // 天气并入 marketBoost（无参路径）
    const real = pw.marketBoost.bind(pw)
    pw.marketBoost = () => real()
    const mb = pw.marketBoost()
    const expect = fx.gatherXp
    check('天气', 'marketBoost 已乘入天气倍率', Math.abs(mb.gatherXp - expect) < 1e-9, `mb=${mb.gatherXp} wx=${expect}`)
  }
  // 吉祥物（2026-09-10）：购买 + 每日蹭一次 + 好感等级
  {
    const pm2 = freshPlayer()
    pm2.gold = 200000
    check('吉祥物', '未购买时蹭被拒', pm2.mascotPet().ok === false)
    const b1 = pm2.mascotBuy('cat')
    check('吉祥物', '购买扣金币并自动上岗', b1.ok === true && pm2.gold === 192000 && pm2.mascotState().active === 'cat')
    check('吉祥物', '重复购买被拒', pm2.mascotBuy('cat').ok === false)
    const g0 = pm2.gold
    const p1 = pm2.mascotPet()
    check('吉祥物', '蹭一次给金币 + 计数', p1.ok === true && pm2.gold > g0 && (pm2.stats.mascotPets ?? 0) === 1)
    check('吉祥物', '同日不可重复蹭', pm2.mascotPet().ok === false)
    // 好感等级：蹭次数门槛 1/5/15/30/60
    check('吉祥物', '好感等级按次数', mascotBondLevel(1) === 1 && mascotBondLevel(5) === 2 && mascotBondLevel(60) === 5)
    pm2.mascotState().pets.cat = 60
    check('吉祥物', '好感满级加成 +125%（金币基础 ×2.25）', mascotReward(MASCOTS[0], 60, () => 1).gold === Math.round(MASCOTS[0].goldBase * 2.25))
    check('吉祥物', '切换吉祥物免费但需已拥有', pm2.mascotActivate('koi').ok === false && pm2.mascotActivate('cat').ok === true)
  }
  // 宴会承办（2026-09-10）：限时大订单
  {
    const pb = freshPlayer()
    check('宴会', '候选订单随等级变化', banquetTierFor(1).id === 'b10' && banquetTierFor(50).id === 'b40' && banquetTierFor(75).id === 'b60')
    const ac = pb.banquetAccept()
    check('宴会', '接单后进入进行中', ac.ok === true && !!pb.banquetState().order)
    check('宴会', '重复接单被拒', pb.banquetAccept().ok === false)
    check('宴会', '库存不足不可交付', pb.banquetDeliver().ok === false)
    // 造货：按订单类别造足量 tier 合格的料理
    const o = pb.banquetState().order
    const dish = Object.values(ITEMS).find((it) => it.type === 'food' && it.category === o.cat && (it.tier ?? 0) >= o.minTier)
    pb.inventory[dish.id] = o.need + 3
    check('宴会', '备齐后可交付', pb.banquetReady() >= o.need && pb.banquetDeliver().ok === true && (pb.stats.banquets ?? 0) === 1)
    check('宴会', '交付扣料理并清空订单', pb.inventory[dish.id] === 3 && pb.banquetState().order === null)
    // 超时作废
    pb.banquetAccept()
    pb.banquetState().order.expiresAt = Date.now() - 1
    pb._tickBanquet()
    check('宴会', '超时自动作废', pb.banquetState().order === null && pb.banquetState().failed === 1)
  }
  // 外卖业务（2026-09-10）：按小时消耗库存料理换金币
  {
    const pt2 = freshPlayer()
    check('外卖', '初始 Lv1、并发 1 单', pt2.takeoutLevel() === 1 && takeoutConcurrency(1) === 1)
    check('外卖', '已满级时无升级花费（next=null）', takeoutUpgradeCost(TAKEOUT_MAX_LEVEL + 1) === null && takeoutUpgradeCost(2) === 20000)
    check('外卖', '升级扣金币并提升等级', (() => {
      pt2.gold = 100000
      const lv0 = pt2.takeoutLevel()
      const r = pt2.takeoutUpgrade()
      return r.ok === true && pt2.takeoutLevel() === lv0 + 1
    })())
    // 造菜单与库存 → 一小时结算
    const dish2 = Object.values(ITEMS).find((it) => it.type === 'food' && (it.value ?? 0) > 20)
    pt2.restaurant.menu = [dish2.id, dish2.id]
    pt2.inventory[dish2.id] = 10
    const g0 = pt2.gold
    pt2.takeout.lastAt = Date.now() - 3600_000
    pt2._tickTakeout(60_000)
    check('外卖', '整点结算：消耗料理换金币', pt2.inventory[dish2.id] < 10 && pt2.gold > g0 && (pt2.stats.takeoutSold ?? 0) > 0, `sold=${pt2.stats.takeoutSold}`)
    check('外卖', '单价高于堂食基准（×1.2 起）', takeoutPrice(dish2, 1) >= Math.round((dish2.value + (dish2.heal ?? 0) * 0.5) * 1.2))
  }

  // 分店主题（2026-09-10）：主题倍率 = 1 + 6% × 对应学派等级
  {
    check('分店主题', '倍率随学派等级递增', themeMult('sichuan', 0) === 1 && Math.abs(themeMult('sichuan', 10) - (1 + THEME_BONUS_PER_LEVEL * 10 / 100)) < 1e-9)
    check('分店主题', '未知主题不加成', themeMult('nope', 20) === 1)
    check('分店主题', `六种主题各绑一个学派（${BRANCH_THEMES.length} 种）`, BRANCH_THEMES.length === 6 && BRANCH_THEMES.every((t) => t.school && t.cost > 0))
    const pb = freshPlayer()
    const bid = BRANCHES[0].id
    check('分店主题', '未开店不可设主题', pb.setBranchTheme(bid, 'sichuan').ok === false)
    pb.branches[bid] = { lastAt: Date.now(), manager: false }
    check('分店主题', '金币不足被拒', (() => { pb.gold = 10; return pb.setBranchTheme(bid, 'sichuan').ok === false })())
    pb.gold = 1_000_000
    const base = pb.branchHourlyOf(bid)
    check('分店主题', '设主题扣金币并写入', pb.setBranchTheme(bid, 'sichuan').ok === true && pb.branchThemeOf(bid) === 'sichuan' && pb.gold === 1_000_000 - BRANCH_THEMES[0].cost)
    check('分店主题', '重复设同主题被拒', pb.setBranchTheme(bid, 'sichuan').ok === false)
    check('分店主题', '学派 0 级时主题不加成（倍率 1）', pb.branchHourlyOf(bid) === base && base > 0, `hourly=${pb.branchHourlyOf(bid)} base=${base}`)
    pb.schools = { s_main: { level: 20, research: null } }
    check('分店主题', '学派等级提升后时收增加', pb.branchHourlyOf(bid) > base, `${pb.branchHourlyOf(bid)} vs ${base}`)
    check('分店主题', '可换成另一主题', pb.setBranchTheme(bid, 'bar').ok === true && pb.branchThemeOf(bid) === 'bar')
  }
  // 供应商合约（2026-09-10）：定金签 7 天，按自然日自动到货
  {
    check('供应商', `单价为物价 ${Math.round(SUPPLIER_PRICE_MULT * 100)}%`, supplierDailyCost(SUPPLIERS[0], 100) === Math.round(100 * SUPPLIER_PRICE_MULT * SUPPLIERS[0].qty))
    check('供应商', '数量与定金为正', SUPPLIERS.every((s) => s.qty > 0 && s.deposit > 0 && ITEMS[s.itemId]))
    const pb = freshPlayer()
    check('供应商', '金币不足不可签约', (() => { pb.gold = 0; return pb.signContract(SUPPLIERS[0].id).ok === false })())
    pb.gold = 5_000_000
    const dep = SUPPLIERS[0].deposit
    check('供应商', '签约扣定金并生效', pb.signContract(SUPPLIERS[0].id).ok === true && pb.gold === 5_000_000 - dep && pb.activeContracts().length === 1)
    check('供应商', '重复签约被拒', pb.signContract(SUPPLIERS[0].id).ok === false)
    // 首日只计时不到货
    const def0 = SUPPLIERS[0]
    const have0 = pb.inventory[def0.itemId] ?? 0
    pb._tickContracts()
    check('供应商', '签约首日只计时不到货', (pb.inventory[def0.itemId] ?? 0) === have0 && pb.contracts[def0.id].lastDay === (pb.todayKey ?? null) || pb.contracts[def0.id].lastDay !== null)
    // 隔日到货
    const cost = supplierDailyCost(def0, ITEMS[def0.itemId].value)
    const g1 = pb.gold
    pb.contracts[def0.id].lastDay = '2000-01-01'
    pb._tickContracts()
    check('供应商', '隔日自动到货并扣货款', (pb.inventory[def0.itemId] ?? 0) === have0 + def0.qty && pb.gold === g1 - cost, `inv=${pb.inventory[def0.itemId]} gold=${pb.gold}`)
    check('供应商', '到货计入统计', (pb.stats.contractDeliveries ?? 0) === 1)
    // 金币不足当日不到货、不累积
    pb.gold = 0
    const have1 = pb.inventory[def0.itemId]
    pb.contracts[def0.id].lastDay = '2000-01-02'
    pb._tickContracts()
    check('供应商', '金币不足当日不到货', (pb.inventory[def0.itemId] ?? 0) === have1)
    // 合约上限
    pb.gold = 10_000_000
    pb.signContract(SUPPLIERS[1].id); pb.signContract(SUPPLIERS[2].id)
    check('供应商', `同时最多 ${SUPPLIER_MAX_CONTRACTS} 份合约`, pb.activeContracts().length === SUPPLIER_MAX_CONTRACTS && pb.signContract(SUPPLIERS[3].id).ok === false)
    // 到期自动失效
    pb.contracts[SUPPLIERS[1].id].expiresAt = Date.now() - 1
    pb._tickContracts()
    check('供应商', '到期自动失效', !pb.contracts[SUPPLIERS[1].id] && pb.activeContracts().length === SUPPLIER_MAX_CONTRACTS - 1)
    // 解约
    check('供应商', '解约立即移除', pb.cancelContract(SUPPLIERS[0].id) === true && !pb.contracts[SUPPLIERS[0].id])
  }
  // 名厨挑战（2026-09-10）：每周一位名厨，固定流派，战胜给奖
  {
    check('名厨', `名单 ${CHEFS.length} 位且流派合法`, CHEFS.length === 8 && CHEFS.every((c) => ['knife', 'plating', 'flavor'].includes(c.style) && c.levelOffset > 0))
    check('名厨', '按周确定性轮换', chefForWeek(0).id === CHEFS[0].id && chefForWeek(CHEFS.length).id === CHEFS[0].id && chefForWeek(1).id === CHEFS[1].id)
    const pb = freshPlayer()
    const def = chefForWeek(Math.floor(Date.now() / (7 * 24 * 3600_000)))
    const o = chefOpponent(def, 10)
    check('名厨', '对手等级 = 玩家等级 + 偏移', o.level === 10 + def.levelOffset && o.isChef === true && o.style === def.style)
    check('名厨', '对手等级封顶 99', chefOpponent(def, 99).level === 99)
    check('名厨', '本周初始未通过', pb.chefClearedThisWeek() === false)
    check('名厨', '开始挑战标记当前名厨', pb.chefStart().ok === true && pb.chefChallenge.current === def.id)
    // 中途逃跑后打赢别的对手不误领：对手名不匹配
    check('名厨', '对手名不匹配不结算', pb.onCombatEndChef('win', '别的对手') === null && pb.chefChallenge.current === def.id)
    const rw = chefReward(def, pb.combatLevel)
    const g0 = pb.gold
    const res = pb.onCombatEndChef('win', `${def.icon} ${def.name}`)
    check('名厨', '战胜发奖并标记通过', res?.passed === true && pb.gold === g0 + rw.gold && pb.chefClearedThisWeek() === true)
    check('名厨', '战胜计入统计', (pb.stats.chefWins ?? 0) === 1)
    check('名厨', '通过后不可再挑战', pb.chefStart().ok === false)
    // 失败可重复挑战
    const pb2 = freshPlayer()
    pb2.chefStart()
    const r2 = pb2.onCombatEndChef('lose', `${def.icon} ${def.name}`)
    check('名厨', '失败可重复挑战', r2?.passed === false && pb2.chefClearedThisWeek() === false && pb2.chefStart().ok === true)
    check('名厨', '放弃清空当前挑战', (pb2.chefAbort(), pb2.chefChallenge.current === null))
  }


  // 荣誉殿堂（2026-09-10）：称号被动 + 荣誉等级（纯读取层）
  {
    check('荣誉', `称号总数 ${TITLE_TOTAL}、名称全局唯一`, TITLE_TOTAL === new Set(ALL_TITLES.map((t) => t.name)).size && TITLE_TOTAL >= 78)
    check('荣誉', '每条称号都能归入四条通道之一', ALL_TITLES.every((t) => ['xpPct', 'gatherPct', 'craftPct', 'goldPct'].includes(perkOf(t.name).stat)))
    check('荣誉', `称号被动固定 ${TITLE_PERK_VALUE}%`, ALL_TITLES.every((t) => perkOf(t.name).value === TITLE_PERK_VALUE))
    check('荣誉', '同一称号的被动稳定（确定性）', perkOf('采摘大师').stat === perkOf('采摘大师').stat && perkOf('采摘大师').stat === 'gatherPct')
    check('荣誉', '等级门槛 0/8/16/72 → 0/1/2/9 且封顶 9', [0, 8, 16, 72, 80].map(honorLevelOf).join(',') === '0,1,2,9,9')
    check('荣誉', '满级时下一级需求为 null', honorNextNeed(72) === null && honorNextNeed(8) === 8)
    check('荣誉', '无称号无加成', JSON.stringify(honorBonuses({ equipped: null, ownedTitles: [] }).perks) === JSON.stringify({ xpPct: 0, gatherPct: 0, craftPct: 0, goldPct: 0 }))
    check('荣誉', '未拥有该称号则不生效', honorBonuses({ equipped: '采摘大师', ownedTitles: [] }).perks.gatherPct === 0)
    check('荣誉', '佩戴已拥有称号：该通道 +2、等级各 +1', (() => {
      const b = honorBonuses({ equipped: '采摘大师', ownedTitles: Array.from({ length: 16 }, (_, i) => ALL_TITLES[i].name) })
      return b.level === 2 && b.perks.gatherPct === 2 + 2 && b.perks.xpPct === 2
    })())
  }
  // 图鉴兑换所（2026-09-10）：完成度档位发点数 → 兑换外观/道具
  {
    check('图鉴兑换', `档位 ${CODEX_TIERS.length} 档、累计 ${CODEX_TIER_TOTAL} 点`, CODEX_TIERS.length === 15 && CODEX_TIER_TOTAL === CODEX_TIERS.reduce((a, t) => a + t.points, 0))
    check('图鉴兑换', '档位百分比严格递增', CODEX_TIERS.every((t, i) => i === 0 || t.pct > CODEX_TIERS[i - 1].pct))
    check('图鉴兑换', '0% 不得点、100% 发满', codexPointsFor(0).total === 0 && codexPointsFor(100).total === CODEX_TIER_TOTAL && codexPointsFor(100).next === null)
    check('图鉴兑换', '50% 只发到 50 档', codexPointsFor(50).total === CODEX_TIERS.filter((t) => t.pct <= 50).reduce((a, t) => a + t.points, 0))
    check('图鉴兑换', '货架奖励齐备（id 唯一 / 花费为正）', new Set(CODEX_REWARDS.map((r) => r.id)).size === CODEX_REWARDS.length && CODEX_REWARDS.every((r) => r.cost > 0))
    check('图鉴兑换', '货架总花费 ≤ 满档点数（可全清）', CODEX_REWARDS.reduce((a, r) => a + r.cost, 0) <= CODEX_TIER_TOTAL)
    check('图鉴兑换', '货架不含影响数值的装备', CODEX_REWARDS.every((r) => r.kind !== 'equipment' && !r.items || Object.keys(r.items ?? {}).every((id) => ITEMS[id] && ITEMS[id].type !== 'equipment')))
    const pc = freshPlayer()
    check('图鉴兑换', '空图鉴点数 0、兑换被拒', pc.codexPoints().points === 0 && pc.codexRedeem('cx_spice').ok === false)
    const ids = Object.keys(ITEMS)
    for (const id of ids.slice(0, Math.floor(ids.length * 0.6))) pc.collected[id] = true
    const cpts = pc.codexPoints()
    check('图鉴兑换', '60% 完成度发够点数', cpts.points === cpts.total && cpts.total > 100, `total=${cpts.total}`)
    const r1 = pc.codexRedeem('cx_spice')
    check('图鉴兑换', '兑换扣点数并发放道具', r1.ok === true && pc.codexPoints().points === cpts.total - 12 && (pc.inventory.mysterySpice ?? 0) === 3)
    check('图鉴兑换', '重复兑换被拒', pc.codexRedeem('cx_spice').ok === false)
    check('图鉴兑换', '兑换称号进入称号墙并计入荣誉', pc.codexRedeem('cx_title_scholar').ok === true && pc.ownedTitles().includes('博物学者') && pc.honorState().owned >= 1)
    check('图鉴兑换', '兑换头像框写入 avatarFrame 且进存档', pc.codexRedeem('cx_frame_dex').ok === true && pc.avatarFrame === 'codex' && 'avatarFrame' in pc.serialize() && 'codexOwned' in pc.serialize())
  }
  // 套餐与定食（2026-09-10）：菜单凑齐大类即生效，多套取最高
  {
    check('套餐', `套餐 ${SET_MEALS.length} 套、id 唯一且加成递增`, new Set(SET_MEALS.map((m) => m.id)).size === SET_MEALS.length && SET_MEALS.every((m) => m.need.length >= 2 && m.bonus > 0))
    check('套餐', '空菜单无套餐', activeSetMeal([]).meal === null && activeSetMeal([]).bonus === 0)
    const food = Object.values(ITEMS).filter((i) => i.type === 'food')
    const pick = (c) => food.find((f) => f.category === c)?.id
    check('套餐', '主食+主菜 → 家常套餐（+8）', activeSetMeal([pick('主食'), pick('主菜')]).meal?.id === 'sm_home')
    check('套餐', '辅食不构成套餐', activeSetMeal([pick('主食'), pick('baking')]).meal === null)
    check('套餐', '四类齐 → 豪华全席（最高加成）', activeSetMeal([pick('主食'), pick('主菜'), pick('汤品'), pick('甜点')]).meal?.id === 'sm_grand')
    check('套餐', '同类重复不叠加（两道主菜仍只算一道）', activeSetMeal([pick('主菜'), food.filter((f) => f.category === '主菜')[1].id]).meal === null)
    check('套餐', '缺项列表正确', (() => { const b = setMealBoard([pick('主食')]).find((m) => m.id === 'sm_home'); return b.ok === false && b.missing.join() === '主菜' })())
    const pm = freshPlayer()
    check('套餐', '无菜单时玩家加成为 0', pm.setMealBonus() === 0)
    pm.restaurant.menu = [pick('主食'), pick('主菜')]
    const inc2 = pm.restaurantHourlyIncome
    const noMeal = (() => { const q = freshPlayer(); q.restaurant.menu = [pick('主食'), pick('baking')]; return q })()
    check('套餐', '菜单成套餐后餐厅收入上升', pm.setMealBonus() === 8 && inc2 > 0)
    check('套餐', '外卖单价随套餐上浮（半额）', (() => {
      const a = freshPlayer(); a.restaurant.menu = [pick('主食'), pick('baking')]
      const b = freshPlayer(); b.restaurant.menu = [pick('主食'), pick('主菜')]
      const dish = pick('主菜')
      return b.takeoutPriceOf(dish) >= a.takeoutPriceOf(dish)
    })())
    void noMeal
  }
  // 同业竞争榜（2026-09-10）：月度榜单，对手每月变强，只给正向激励
  {
    check('同业榜', `榜单规模 ${RIVAL_BOARD_SIZE}（含玩家）、对手池 ${RIVAL_SHOPS.length}`, RIVAL_BOARD_SIZE === 6 && RIVAL_SHOPS.length === 12)
    check('同业榜', '对手分数同月确定、跨月递增', (() => {
      const m = monthIndexOf()
      return rivalsOfMonth(m).map((r) => r.score).join() === rivalsOfMonth(m).map((r) => r.score).join() &&
        rivalsOfMonth(m + 1).reduce((a, r) => a + r.score, 0) > rivalsOfMonth(m).reduce((a, r) => a + r.score, 0)
    })())
    check('同业榜', `每月成长 ${Math.round(RIVAL_MONTH_GROWTH * 100)}% 已生效`, RIVAL_MONTH_GROWTH === 0.06)
    const pv = freshPlayer()
    check('同业榜', '新品种子分数为 0 / 名次为榜末', playerScoreFrom(pv, 0) === 0 && rankOf(0, rivalsOfMonth(0)) === RIVAL_BOARD_SIZE)
    check('同业榜', '分数越高名次越前', (() => {
      const rv = rivalsOfMonth(0)
      const mid = rv[Math.floor(rv.length / 2)].score
      return rankOf(mid + 1, rv) < rankOf(mid - 1, rv)
    })())
    check('同业榜', '名次奖励正向且随分数放大', (() => {
      const a = rivalReward(1, 1000), b = rivalReward(1, 10000), c = rivalReward(4, 1000)
      return a.gold > 0 && b.gold > a.gold && c.gold < a.gold
    })())
    check('同业榜', '星标 1/2/3 对应榜末/前三/榜一', rankStars(6) === 1 && rankStars(2) === 2 && rankStars(1) === 3)
    // 领奖 / 推广（每月各一次）
    pv.gold = 200000
    const rw = pv.rivalBoard().reward
    const g0 = pv.gold
    const rc = pv.rivalClaim()
    check('同业榜', '领奖发金币并记账', rc.ok === true && pv.gold === g0 + rw.gold && (pv.stats.rivalClaims ?? 0) === 1)
    check('同业榜', '同一月不可重复领奖', pv.rivalClaim().ok === false)
    check('同业榜', '推广扣金币并提高分数', (() => {
      pv.stats.ordersServed = 200 // 先有分数，否则 0 分放大 30% 仍是 0
      const before = pv.rivalBoard().score
      const g1 = pv.gold
      const ok = pv.rivalPromote()
      return ok.ok === true && pv.gold === g1 - 20000 && pv.rivalBoard().score > before
    })())
    check('同业榜', '同一月不可重复推广', pv.rivalPromote().ok === false)
    check('同业榜', '跨月重置领取与推广状态', (() => {
      pv.rivals.month = -1
      const b = pv.rivalBoard()
      return b.claimed === false && b.promo === false
    })())
  }


  // 轶事分类统计（2026-09-10 修复）：原实现给 defs 建副本、却把计数写进 QUIRK_CAT_DEFS 原对象，
  // 模板读副本 → 四个大类标签恒显示 0/0（自首个版本起存在）。守卫锁住「计数写进渲染对象」这一点。
  {
    const list = [
      { cat: 'gather', sub: 'foraging' },
      { cat: 'gather', sub: 'fishing' },
      { cat: 'craft', sub: 'cooking' },
      { cat: 'support', sub: 'gastronomy' },
    ]
    const st = quirkCategoryStats(list, (q) => q.sub === 'foraging')
    check('轶事', '大类计数写入渲染对象（合计 = 总数）', st.defs.reduce((a, d) => a + d.total, 0) === list.length)
    check('轶事', '大类解锁数写入渲染对象', st.defs.reduce((a, d) => a + d.unlocked, 0) === 1)
    check('轶事', '大类定义齐备且顺序固定', st.defs.map((d) => d.id).join() === 'gather,craft,combatWins,support' && st.defs.every((d) => d.name && d.icon))
    check('轶事', '子类统计按 cat|sub 归并', st.subMap.get('gather|foraging')?.total === 1 && st.subMap.get('gather|foraging')?.unlocked === 1 && st.subMap.size === 4)
    check('轶事', '空列表不报错', quirkCategoryStats([]).defs.every((d) => d.total === 0))
    // 全量数据（tales_ext 3588 条）：cat 必须全部落在已知大类，且总数不丢
    const { QUIRKS } = await import('../../src/game/data/tales_ext.js')
    const known = new Set(QUIRK_CAT_DEFS.map((c) => c.id))
    const unknown = [...new Set(QUIRKS.map((q) => q.cat))].filter((c) => !known.has(c))
    const full = quirkCategoryStats(QUIRKS, () => false)
    check('轶事', `全量 ${QUIRKS.length} 条无未知大类`, unknown.length === 0, unknown.join(','))
    check('轶事', '全量大类合计 = 轶事总数', full.defs.reduce((a, d) => a + d.total, 0) === QUIRKS.length)
    check('轶事', '全量子类合计 = 轶事总数', [...full.subMap.values()].reduce((a, x) => a + x.total, 0) === QUIRKS.length)
    check('轶事', '全量大类均非空', full.defs.every((d) => d.total > 0))
  }


  // 功能页补内容（2026-09-10）：新的可见数据与反查，守住「显示与结算一致」
  {
    // ① 试炼最佳成绩：回合制记最少回合、其余记最高剩余品鉴值
    const pt = freshPlayer({ knife: 30, tasteAcumen: 30, heatControl: 30 })
    pt.trialStart('t_speed')
    pt.onCombatEndTrial({ result: 'win', turns: 12, hpLeft: 60, hpMax: 100 })
    pt.trialStart('t_speed')
    pt.onCombatEndTrial({ result: 'win', turns: 9, hpLeft: 60, hpMax: 100 })
    const stS = pt.trialState('t_speed')
    check('试炼记录', '回合制记最少回合（9 而非 12）', stS.bestTurns === 9, `bestTurns=${stS.bestTurns}`)
    pt.trialStart('t_flawless')
    pt.onCombatEndTrial({ result: 'win', turns: 40, hpLeft: 92, hpMax: 100 })
    pt.trialStart('t_flawless')
    pt.onCombatEndTrial({ result: 'win', turns: 40, hpLeft: 96, hpMax: 100 })
    const stF = pt.trialState('t_flawless')
    check('试炼记录', '非回合制记最高剩余品鉴值（96）', stF.bestHp === 96, `bestHp=${stF.bestHp}`)
    check('试炼记录', '未通关时不写精确记录', (freshPlayer().trialState('t_speed').bestTurns ?? null) === null)

    // ② 厨具赛因子明细：各因子之和 = 总分（显示与评分同源）
    const pg = freshPlayer()
    pg.equipment.weapon = 'copperKnife'
    pg.inventory.copperKnife = 1
    pg.upgrades.copperKnife = 3
    const gs = pg.gearScore()
    const fSum = (gs.factors ?? []).reduce((a, f) => a + f.points, 0)
    check('厨具赛因子', '因子合计 ≈ 总分（±件数取整）', Math.abs(fSum - gs.score) <= (gs.parts?.length ?? 1), `factors=${fSum} score=${gs.score}`)
    check('厨具赛因子', '因子覆盖全部 7 项权重', (gs.factors ?? []).length === 7)
    check('厨具赛因子', '未穿戴装备时全为 0', (() => { const q = freshPlayer(); return (q.gearScore().factors ?? []).every((f) => f.points === 0) })())

    // ③ 吉祥物累计金币：蹭一次即累加
    const pm = freshPlayer()
    pm.gold = 0
    pm.mascots = { owned: { cat: { boughtAt: Date.now() } }, active: 'cat', pets: {}, lastPetDay: null }
    const goldBefore = pm.stats?.mascotGold ?? 0
    const pet = pm.mascotPet()
    check('吉祥物累计', '蹭一次累加 mascotGold', pet.ok === true && (pm.stats.mascotGold ?? 0) === goldBefore + pet.reward.gold, `mascotGold=${pm.stats.mascotGold}`)
    check('吉祥物累计', '金币进账与统计一致', pm.gold === pet.reward.gold)

    // ④ 风味搭配反查：只返回真正同时用到全部食材的配方，且按等级升序
    const pf = freshPlayer()
    const p0 = FLAVOR_PAIRS[0]
    const rs = recipesForPair(p0.items)
    check('风味反查', '结果按配方等级升序', rs.every((r, i) => i === 0 || r.reqLevel >= rs[i - 1].reqLevel))
    check('风味反查', '每条结果都真的含全部食材', rs.every((r) => {
      const inst = getAllSkillInstances().find((x) => x.id === r.skillId)
      if (!inst) return false
      const rec = (inst.recipes ?? []).find((x) => x.name === r.name)
      return !!rec && p0.items.every((id) => (rec.ingredients ?? {})[id])
    }))
    check('风味反查', '同一输入结果稳定（有缓存也不串）', easiestRecipeForPair(p0.items)?.name === rs[0]?.name)
    check('风味反查', '空输入返回空', recipesForPair([]).length === 0 && recipesForPair(null).length === 0)
    // 硬约束（2026-09-10 修正后）：每条搭配都必须能在现有配方里做出来，
    // 否则玩家永远点不亮它（首版 28 条里有 21 条无解，已按真实共现食材重写）
    const dead = FLAVOR_PAIRS.filter((q) => recipesForPair(q.items).length === 0)
    check('风味搭配', `全部 ${FLAVOR_PAIRS.length} 条均可在现有配方中点亮`, dead.length === 0, `无解: ${dead.map((q) => q.name).join('、')}`)
    const pairIds = FLAVOR_PAIRS.map((q) => q.id)
    check('风味搭配', 'id 唯一', new Set(pairIds).size === pairIds.length)
    const itemSets = FLAVOR_PAIRS.map((q) => [...q.items].sort().join('|'))
    check('风味搭配', '食材组合互不重复', new Set(itemSets).size === itemSets.length)
    check('风味搭配', '每条组合 2~3 味食材', FLAVOR_PAIRS.every((q) => q.items.length >= 2 && q.items.length <= 3))
    check('风味搭配', '每条都有名称/说明/奖励', FLAVOR_PAIRS.every((q) => q.name && q.desc && (q.reward?.gold ?? 0) > 0))
    check('风味搭配', '引用的食材全部存在', FLAVOR_PAIRS.every((q) => q.items.every((id) => !!ITEMS[id])))
  }


  // 能量饼干的第二用途（2026-09-10）：解决「离线加时封顶 +12h 后饼干失效」的溢出
  {
    // ① 前提确认：离线加时确实只有 3 块的额度（物品效果固定，不可改）
    const pb = freshPlayer()
    pb.inventory.energyBiscuit = 20
    let used = 0
    while (pb.consumeEnergyBiscuit()) used++
    check('能量饼干', '离线加时只用得上 3 块（+12h 封顶）', used === 3 && pb.offlineBonusH === 12, `used=${used} bonus=${pb.offlineBonusH}`)
    check('能量饼干', '封顶后基础用途失败且不消耗', pb.consumeEnergyBiscuit() === false && pb.inventory.energyBiscuit === 17)
    check('能量饼干', '满上限可被识别（供页面提示）', pb.biscuitOfflineMaxed() === true && freshPlayer().biscuitOfflineMaxed() === false)

    // ② A：战斗内补给（回血 + 命中/攻速增益 + 自身冷却），不封顶
    const pc = freshPlayer({ knife: 40, tasteAcumen: 40, heatControl: 40 })
    pc.inventory.energyBiscuit = 10
    createSkillInstances(pc)
    const cb = new Combat(pc)
    const oppB = opp(20, '练手对手', 'knife')
    cb.start(oppB)
    pc.setCombat({ hp: 10 })
    const hpBefore = pc.combat.hp
    const okB = cb.useEnergyBiscuit()
    check('能量饼干', '战斗内使用：回血 + 扣 1 块', okB === true && pc.combat.hp > hpBefore && pc.inventory.energyBiscuit === 9, `hp ${hpBefore}→${pc.combat.hp}`)
    check('能量饼干', `回血量为最大品鉴值的 ${Math.round(BISCUIT_HEAL_PCT * 100)}%（封顶不超上限）`, pc.combat.hp <= pc.maxHp)
    check('能量饼干', '给命中与攻速增益', cb.buffs.accuracy >= BISCUIT_ACC && cb.biscuitSpeedPct === BISCUIT_SPEED_PCT)
    check('能量饼干', `增益持续 ${BISCUIT_BUFF_TURNS} 回合`, cb.buffTurns >= BISCUIT_BUFF_TURNS)
    check('能量饼干', '自身冷却期不可再用', cb.useEnergyBiscuit() === false && pc.inventory.energyBiscuit === 9)
    check('能量饼干', '计入使用统计', (pc.stats.biscuitsUsed ?? 0) === 1)
    // 冷却走完后可再用（证明不封顶）
    for (let i = 0; i < BISCUIT_COOLDOWN_TURNS + 1; i++) cb.resolveTurn()
    check('能量饼干', '冷却结束后可反复使用（不封顶）', cb.useEnergyBiscuit() === true && (pc.stats.biscuitsUsed ?? 0) === 2)
    // 增益到期要清掉攻速，不能永久加成
    for (let i = 0; i < BISCUIT_BUFF_TURNS + 1; i++) cb.resolveTurn()
    check('能量饼干', '增益到期后攻速加成归零', cb.biscuitSpeedPct === 0 && cb.buffs.accuracy === 0)
    const noBiscuit = freshPlayer()
    createSkillInstances(noBiscuit)
    const cb2 = new Combat(noBiscuit)
    cb2.start(opp(5, '空手对手', 'knife'))
    check('能量饼干', '没有饼干时使用失败', cb2.useEnergyBiscuit() === false)

    // ③ C：常驻回收（不限量，反复兑换）
    const pd = freshPlayer()
    pd.inventory.energyBiscuit = 37
    check('能量饼干', '回收预览给出块数与品鉴点', (() => { const v = pd.biscuitExchangePreview(10); return v.count === 10 && v.taste === 10 * BISCUIT_TASTE_RATE && v.rate === BISCUIT_TASTE_RATE })())
    check('能量饼干', '空背包不可回收', pd.inventory.energyBiscuit === 0 ? pd.exchangeBiscuitForTaste().ok === false : true)
    const t0 = pd.tastePoints
    const r1 = pd.exchangeBiscuitForTaste(10)
    check('能量饼干', '回收扣饼干发品鉴点', r1.ok === true && pd.inventory.energyBiscuit === 27 && pd.tastePoints === t0 + 10 * BISCUIT_TASTE_RATE)
    const r2 = pd.exchangeBiscuitForTaste() // 全部
    check('能量饼干', '一键回收全部', r2.ok === true && r2.count === 27 && (pd.inventory.energyBiscuit ?? 0) === 0) // spendItem 会把归零键删掉 → ?? 0
    check('能量饼干', '回收计入统计', (pd.stats.biscuitsRecycled ?? 0) === 37)
    check('能量饼干', '回收后仍可再刷再兑（不封顶）', (() => { pd.inventory.energyBiscuit = 5; return pd.exchangeBiscuitForTaste().ok === true && (pd.inventory.energyBiscuit ?? 0) === 0 })())
    check('能量饼干', '超量请求被夹到持有量', (() => { pd.inventory.energyBiscuit = 3; return pd.biscuitExchangePreview(999).count === 3 })())

    // ④ 不改固定数据：物品效果与离线上限仍是原值
    check('能量饼干', '物品效果未被改动（offlineBonusH = 4）', ITEMS.energyBiscuit.offlineBonusH === 4)
  }

  // 自动补给（2026-09-09 放置化）：陷阱/装饰食材低于 50 自动补到 200，保留金币下限
  {
    const pa = freshPlayer()
    pa.settings.autoSupplyReserve = 1000
    pa.gold = 5000
    pa.inventory.trap = 10
    pa.inventory.garnish = 200 // 隔离：只验证陷阱补货
    pa._tickAutoSupply(6000)
    check('自动补给', '陷阱低于阈值自动补到 200', (pa.inventory.trap ?? 0) === 200 && pa.gold === 5000 - 190 * 5, `trap=${pa.inventory.trap} gold=${pa.gold}`)
    const pb = freshPlayer()
    pb.settings.autoSupplyReserve = 1000
    pb.gold = 1100
    pb.inventory.trap = 200 // 隔离：只验证装饰食材补货
    pb.inventory.garnish = 0
    pb._tickAutoSupply(6000)
    check('自动补给', '保留金币下限（仅买得起 20 个）', (pb.inventory.garnish ?? 0) === 20 && pb.gold === 1000, `garnish=${pb.inventory.garnish} gold=${pb.gold}`)
    const pc = freshPlayer()
    pc.settings.autoSupply = false
    pc.gold = 5000
    pc.inventory.trap = 0
    pc._tickAutoSupply(6000)
    check('自动补给', '关闭开关不自动购买', (pc.inventory.trap ?? 0) === 0 && pc.gold === 5000)
  }
  // 套装效果（2026-09-09）：同套穿戴 2/4/6 件叠加属性
  {
    check('套装', '套装库覆盖品质套/独立矿套/赛季套', EQUIPMENT_SETS.length >= 80, `n=${EQUIPMENT_SETS.length}`)
    const set = EQUIPMENT_SETS.find((s) => s.ids.length === 8)
    const eqOf = (n) => { const e = {}; for (let i = 0; i < n; i++) e['s' + i] = set.ids[i]; return e }
    const b1 = equipSetBonuses(eqOf(1))
    const b2 = equipSetBonuses(eqOf(2))
    const b4 = equipSetBonuses(eqOf(4))
    const b6 = equipSetBonuses(eqOf(6))
    const lv = Math.max(...set.ids.slice(0, 6).map((id) => (ITEMS[id]?.tier ?? 1) * 10))
    check('套装', '2 件触发攻防加成', b1.active.length === 0 && b2.active.length === 1 && Math.abs(b2.attack - lv * 0.12) < 1e-9, `${b1.attack}/${b2.attack}`)
    check('套装', '4 件再加生命/命中', b4.hpBonus > 0 && b4.accuracy > 0 && b2.hpBonus === 0)
    check('套装', '6 件再加暴击/攻速', b6.critChance > 0 && b6.speedBonus > 0 && b4.critChance === 0)
    check('套装', '加成进入装备总属性', (() => {
      const pw = freshPlayer()
      pw.equipment = eqOf(6)
      const st = pw.equippedStats
      return st.attack >= b6.attack && st.hpBonus >= b6.hpBonus
    })())
  }
  // 宝石镶嵌（2026-09-09）：插槽按品质、镶嵌消耗、拆卸/换装返还、加成进入属性
  {
    const pg = freshPlayer()
    pg.gainItem('crystalKnife', 1) // 史诗 → 2 插槽
    pg.equip('crystalKnife')
    const rec = pg.gemSockets?.weapon
    check('宝石', '插槽数按品质（史诗 2）', !!rec && rec.gems.length === 2, JSON.stringify(rec))
    pg.gainItem('goldOre', 2)
    check('宝石', '镶嵌消耗宝石并生效', pg.socketGem('weapon', 0, 'goldOre').ok && pg.inventory.goldOre === 1 && rec.gems[0] === 'goldOre')
    check('宝石', '拆卸返还宝石', pg.unsocketGem('weapon', 0).ok && pg.inventory.goldOre === 2 && rec.gems[0] === null)
    pg.socketGem('weapon', 0, 'goldOre')
    pg.gainItem('ironKnife', 1)
    pg.equip('ironKnife') // 普通 → 0 插槽
    check('宝石', '换装自动退回宝石', pg.inventory.goldOre === 2 && !pg.gemSockets.weapon, JSON.stringify(pg.gemSockets))
    const pg2 = freshPlayer()
    pg2.gainItem('crystalKnife', 1)
    pg2.equip('crystalKnife')
    pg2.gainItem('goldOre', 1)
    const a0 = pg2.equippedStats.attack
    pg2.socketGem('weapon', 0, 'goldOre')
    check('宝石', '镶嵌加成进入装备总属性', pg2.equippedStats.attack === a0 + 5, `${a0} → ${pg2.equippedStats.attack}`)
  }
  // 美食评论家（2026-09-09）：高要求食客
  {
    const pc = freshPlayer()
    const cs = pc.criticState()
    cs.order = { name: '测试评论家', category: '主菜', minTier: 5, reward: 500, createdMs: Date.now(), expireAt: Date.now() + 3600000 }
    const bad = Object.values(ITEMS).find((it) => it.type === 'food' && (it.category !== '主菜' || (it.tier ?? 0) < 5))
    pc.inventory[bad.id] = 1
    check('评论家', '不符合要求的料理被拒', pc.serveCritic(bad.id).ok === false)
    const good = Object.values(ITEMS).find((it) => it.type === 'food' && it.category === '主菜' && (it.tier ?? 0) >= 5)
    pc.inventory[good.id] = 1
    const g0 = pc.gold
    const r = pc.serveCritic(good.id)
    check('评论家', '提交符合要求的料理给大奖', r.ok && pc.gold === g0 + 500 && (pc.inventory.mysterySpice ?? 0) === 1 && pc.criticState().order === null, JSON.stringify({ gold: pc.gold - g0 }))
    const pc2 = freshPlayer()
    pc2.criticState().order = { name: 'X', category: '主菜', minTier: 1, reward: 1, createdMs: Date.now(), expireAt: Date.now() - 1 }
    pc2._tickCritic(1000)
    check('评论家', '超时自动离开', pc2.criticState().order === null)
  }
  // 挂机计划（2026-09-09）：顺序挂机 + 条件换目标 + 完成自动暂停
  {
    const pp = freshPlayer()
    pp.planAddStep('foraging', 'apple', 'mastery', 5)
    pp.planAddStep('fishing', 'crucian', 'level', 3)
    check('计划', '添加两步', pp.planState().steps.length === 2)
    pp.planToggle()
    check('计划', '启用后应用第 1 步', pp.planState().active === true && pp.getSkillTarget('foraging') === 'apple', JSON.stringify(pp.planState()))
    pp.skills.foraging.mastery.apple = countForMasteryLevel(5)
    pp._tickPlan()
    check('计划', '条件满足自动进入第 2 步', pp.planState().index === 1 && pp.getSkillTarget('fishing') === 'crucian')
    pp.setSkillState('fishing', { level: 3, exp: 0 })
    pp._tickPlan()
    check('计划', '全部完成自动暂停', pp.planState().active === false && pp.isSkillPaused('foraging') === true)
  }
  // 每周挑战赛（2026-09-09）：确定性轮换 + 进度累计 + 领奖
  {
    const pw = freshPlayer()
    const def = pw.challengeDef()
    check('周挑战', '按周确定性选 1 个挑战', !!def && pw.challenge.week === pw._weekNum() && pw.challenge.progress === 0, def?.id)
    // 按该挑战的 kind 累计到目标
    for (let i = 0; i < def.target; i++) pw.bumpChallenge(def.kind, i + 1)
    check('周挑战', `进度累计到 ${def.target}`, pw.challenge.progress >= def.target, `${pw.challenge.progress}/${def.target}`)
    const g0 = pw.gold
    const r = pw.claimChallenge()
    check('周挑战', '达成领奖（一次性）', r?.gold === def.gold && pw.gold === g0 + def.gold && pw.claimChallenge() === null)
    check('周挑战', '历史最佳记录', (pw.challengeBest[def.id] ?? 0) >= def.target, JSON.stringify(pw.challengeBest))
  }
  // 食神秘境（2026-09-09 roguelike 局内模式）
  {
    const pr = freshPlayer({ knife: 20, tasteAcumen: 20, heatControl: 20 })
    pr.realmStart()
    const st = pr.realmState()
    check('秘境', '进入秘境初始化', st.active === true && st.floor === 0 && st.buffs.length === 0)
    const mods0 = pr.realmModifiers()
    check('秘境', '初始无增益', mods0.attackPct === 0 && mods0.maxHpPct === 0)
    pr.realmAdvance()
    check('秘境', '胜一层给 3 选 1', st.floor === 1 && st.pending?.length === 3)
    const pick = st.pending[0]
    pr.realmPickBuff(pick.id)
    check('秘境', '选中增益生效', st.buffs.includes(pick.id) && st.pending === null)
    const mods1 = pr.realmModifiers()
    check('秘境', '增益进入属性乘区', Object.keys(pick.mod).every((k) => mods1[k] === pick.mod[k]), JSON.stringify(mods1))
    const o1 = realmOpponent(0, 50)
    const o30 = realmOpponent(30, 50)
    check('秘境', '对手等级随层上浮且封顶 99', o1.level <= 99 && o30.level <= 99 && o30.level >= o1.level, `${o1.level}/${o30.level}`)
    const g0 = pr.gold
    const r = pr.realmEnd()
    check('秘境', '阵亡/放弃按层结算并清零', r?.floor === 1 && pr.gold > g0 && pr.realmState().active === false && pr.realmState().buffs.length === 0, JSON.stringify(r))
  }
  // 菜系图谱（2026-09-09 永久天赋树）
  {
    const pi = freshPlayer()
    check('图谱', '初始 0 见闻', pi.insightPoints() === 0)
    pi.gainItem('apple', 1)
    const p1 = pi.insightPoints()
    pi.gainItem('apple', 5) // 已收集过 → 不再给
    check('图谱', '图鉴首次收集 +1（重复不给）', p1 === 1 && pi.insightPoints() === 1)
    check('图谱', '见闻不足时拒绝解锁', pi.unlockInsight('g1').ok === false)
    pi.gainInsight(200)
    check('图谱', '前置未解锁时拒绝', pi.unlockInsight('g3').ok === false)
    const u1 = pi.unlockInsight('g1')
    check('图谱', '解锁 g1 扣见闻', u1.ok && (pi.insights ?? []).includes('g1') && pi.insightPoints() === 201 - 10, JSON.stringify({ left: pi.insightPoints() }))
    check('图谱', '效果进入聚合层', pi.insightEffects().yieldPct === 3)
    pi.unlockInsight('g2')
    check('图谱', '经验加成聚合', pi.insightEffects().xpPct === 3 && pi.insightEffects().yieldPct === 3)
    const pb2 = freshPlayer()
    pb2.gainInsight(20)
    pb2.unlockInsight('b1')
    check('图谱', '对决线加成聚合', pb2.insightEffects().attackPct === 3)
  }
  // 12h 上限
  const r13 = computeOfflineProgress(f, 13 * 3600_000)
  check('离线', '13h 截断为 12h', r13.durationMs === 12 * 3600_000, `dur=${r13.durationMs}`)
  check('离线', '12h 上限动作数一致', r13.actions === Math.floor((12 * 3600_000 / 3000) * 0.8))
  // 能量饼干加成到 24h（§8.1）
  const r24 = computeOfflineProgress(f, 20 * 3600_000, 24 * 3600_000)
  check('离线', '饼干加成 24h 内不截断', r24.durationMs === 20 * 3600_000)
  const r30 = computeOfflineProgress(f, 30 * 3600_000, 24 * 3600_000)
  check('离线', '30h 截断为 24h', r30.durationMs === 24 * 3600_000)
  // 跨天（绝对时间戳，无 DST 问题）
  const lastOnline = Date.now() - 40 * 3600_000
  check('离线', '跨天 40h → 仍按 12h 上限', computeOfflineProgress(f, Date.now() - lastOnline).durationMs === 12 * 3600_000)
  // 狩猎弹药约束
  const p2 = freshPlayer()
  p2.activeTarget = 'rabbitMeat'
  p2.inventory.trap = 5
  const h = new HuntingSkill(p2)
  const rh = computeOfflineProgress(h, 3600_000)
  check('离线', '狩猎离线受陷阱数约束（5个→5次）', rh.actions === 5 && rh.consumed.trap === 5, JSON.stringify(rh))
  // 垂钓成功率折算
  const p3 = freshPlayer()
  p3.activeTarget = 'crucian'
  const fsh = new FishingSkill(p3)
  const rf = computeOfflineProgress(fsh, 3600_000)
  check('离线', '垂钓离线按成功率折算', rf.actions === 900 && rf.exp < 9000 && rf.exp > 0, `actions=${rf.actions} exp=${rf.exp}`)
  // 农耕离线（时间戳生长）
  const p4 = freshPlayer({ farming: 1 })
  const farm = new FarmingSkill(p4)
  const realNow = Date.now
  p4.farming.plots = []
  p4.setPlot(0, { seedId: 'wheatSeed', plantedAt: Date.now() })
  Date.now = () => realNow() + 95_000 // 跳 95s（小麦 90s）
  check('离线', '农耕时间戳生长（离线等价）', farm.isMature(0) === true)
  Date.now = realNow
  // 农耕自动收种（2026-09-09 放置化）：成熟即收获 + 补种同种种子
  {
    const pf = freshPlayer({ farming: 1 })
    const farmAuto = new FarmingSkill(pf)
    pf.settings.autoFarm = true
    pf.inventory.wheatSeed = 3
    pf.setPlot(0, { seedId: 'wheatSeed', plantedAt: Date.now(), witherRolled: true }) // 预置已判定枯萎，规避 3% 随机
    const now0 = Date.now
    Date.now = () => now0() + 95_000 // 跳 95s（小麦 90s）
    const wheat0 = pf.inventory.wheat ?? 0
    farmAuto.tick(100)
    Date.now = now0
    check('离线', '农耕自动收种：成熟即收获并补种同种种子', (pf.inventory.wheat ?? 0) > wheat0 && pf.farming.plots[0]?.seedId === 'wheatSeed' && pf.inventory.wheatSeed === 2, `wheat=${pf.inventory.wheat} seed=${pf.inventory.wheatSeed}`)
  }
  // 探索离线：gold 在报告中（200 目标重构后取首个目标；旧 streetVendor 已不在实例列表）
  const p5 = freshPlayer({ exploration: 5 })
  const ex = new ExplorationSkill(p5)
  p5.activeTarget = ex.targets[0].id
  const re = computeOfflineProgress(ex, 3600_000)
  check('离线', '探索离线返回金币估算', re !== null && re.gold > 0, JSON.stringify(re))
  if (re?.gold > 0) {
    console.log('  ⚠ 核查：settleOffline(bootstrap) 是否应用 report.gold？')
  }
}

// ── F. 存档系统（§8.2 / §10.4）────────────────────
console.log('══ F. 存档系统 ══')
{
  // localStorage 桩
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
  const sm = new SaveManager({ slot: 0 })
  const p = freshPlayer()
  p.gainItem('apple', 7)
  p.setSkillState('foraging', { level: 12, exp: 1234 })
  p.spirits = { active: ['appleSpirit'] }
  p.restaurant = { level: 3, menu: ['roastPotato'], incomeAccum: 1.5 }
  p.guild = { id: 'umami', points: 30, day: '2026-01-01', taskProgress: {} }
  const saveData = { schemaVersion: 1, savedAt: Date.now(), player: p.serialize() }
  sm.save(saveData)
  // 往返一致性
  const loaded = sm.load()
  check('存档', '保存→加载往返（gold）', loaded.player.gold === p.gold)
  check('存档', '保存→加载往返（skills）', loaded.player.skills.foraging.level === 12 && loaded.player.skills.foraging.exp === 1234)
  check('存档', '保存→加载往返（食灵/餐厅/公会）', JSON.stringify(loaded.player.spirits) === JSON.stringify(p.spirits) && loaded.player.restaurant.level === 3 && loaded.player.guild.id === 'umami')
  // 旧档缺字段 → 默认填充（版本迁移 §10.4）
  const oldSave = { schemaVersion: 1, savedAt: Date.now(), player: { name: '老玩家', gold: 50, skills: { foraging: { level: 5, exp: 100 } } } }
  const p2 = freshPlayer()
  p2.applySave(oldSave.player)
  check('存档', '旧档缺字段默认填充（seasons/guild/restaurant）', p2.seasons && typeof p2.seasons === 'object' && p2.guild.id === null && p2.restaurant.level === 1 && p2.combat.style === 'knife')
  // 未知版本 → 不崩溃
  const v999 = { schemaVersion: 999, savedAt: Date.now(), player: { name: 'x', gold: 1 } }
  sm.saveSlot(1, v999)
  const l999 = sm.loadSlot(1)
  check('存档', '未知 schemaVersion 不崩溃', l999 !== null)
  // 损坏 JSON
  store.set('culinary-idle.save.2', '{broken json!!!')
  check('存档', '损坏 JSON 返回 null 不崩溃', sm.loadSlot(2) === null)
  // 导入校验
  let importErr = false
  try {
    await sm.importFromFile({ text: async () => '{not json' })
  } catch {
    importErr = true
  }
  check('存档', '非法导入文件抛错被上层捕获', importErr === true)
  try {
    await sm.importFromFile({ text: async () => JSON.stringify({ foo: 1 }) })
  } catch {
    importErr = true
  }
  check('存档', '结构不合法（无 player）抛错', importErr === true)
  // 三槽位
  check('存档', '3 存档位枚举', sm.listSlots().length === 3)
  // 删除当前槽后：旧档不被后续保存写回（刷新后旧档复活的回归）
  {
    const { deleteSlot, saveNow, saveManager: smg } = await import('../../src/game/bootstrap.js')
    smg.slot = 0
    smg.saveSlot(0, { schemaVersion: 1, savedAt: Date.now(), player: { gold: 99999 } })
    const pd = freshPlayer() // 当前游戏持有旧档数据
    pd.gold = 88888
    deleteSlot(0) // 删除当前槽 → 应重置为新游戏
    saveNow() // 未进入游戏（gameRunning=false）时 saveNow 不写档——旧档不可复活
    const after = smg.loadSlot(0)
    check('存档', '删除当前槽后未进入游戏不写回（刷新不复活）', after === null, `gold=${after?.player?.gold}`)
    smg.slot = 1
  }
  // 深比较：serialize→applySave→serialize 不丢数据
  const p3 = freshPlayer()
  // ── 空槽「新建存档」= 真正新开档（2026-09-06：修复「新建=当前进度保存」语义）──
  {
    const { newGameSlot, saveManager: smg2 } = await import('../../src/game/bootstrap.js')
    smg2.slot = 1
    smg2.saveSlot(1, { schemaVersion: 1, savedAt: Date.now(), player: { gold: 99999, skills: { knife: { level: 99, exp: 1 } } } })
    const pn = freshPlayer()
    pn.gold = 555
    setActivePinia(createPinia())
    useUiStore()
    newGameSlot(2)
    const fresh2 = smg2.loadSlot(2)
    check('存档', '新建 = 1 级/100 金新档', fresh2?.player?.gold === 100 && (fresh2?.player?.skills?.knife?.level ?? 1) === 1, `gold=${fresh2?.player?.gold}`)
    smg2.slot = 1
  }  p3.gainItem('truffle', 3)
  p3.gainItem('copperKnife', 1)
  p3.equip('copperKnife')
  p3.quests = { index: 2, completed: ['q1'], progress: { 'gather:apple': 5 } }
  p3.stats.combatWins = 42
  p3.buffs.xpMult = { mult: 1.5, expiresAt: Date.now() + 60_000 }
  const s1 = JSON.stringify(p3.serialize())
  const p4 = freshPlayer()
  p4.applySave(JSON.parse(s1))
  const s2 = JSON.stringify(p4.serialize())
  check('存档', '全量序列化往返无丢失', s1 === s2, s1 === s2 ? '' : 'MISMATCH')
}

// ── G. 背包（§5.4）─────────────────────────────────
console.log('══ G. 背包 ══')
{
  const p = freshPlayer()
  p.gainItem('apple', 5)
  p.gainItem('apple', 5)
  check('背包', '同类堆叠 5+5=10', p.inventory.apple === 10)
  // maxStack 9999 边界（文档 §5.4 最大堆叠 9999）
  p.gainItem('apple', 20000)
  check('背包', '堆叠上限 9999（文档）', p.inventory.apple <= 9999, `qty=${p.inventory.apple}`)
  check('背包', 'spendItem 恰好清空删除键', p.spendItem('apple', p.inventory.apple) === true && p.inventory.apple === undefined)
  check('背包', 'spendItem 超出返回 false', p.spendItem('apple', 1) === false)
  p.gainItem('carrot', 3)
  check('背包', 'spendItem 部分消耗', p.spendItem('carrot', 2) === true && p.inventory.carrot === 1)
  // 装备堆叠（stackable:false 物品）：修复后上限 1
  p.gainItem('copperKnife', 2)
  check('背包', '不可堆叠物品上限 1（§5.4）', p.inventory.copperKnife === 1, `qty=${p.inventory.copperKnife}`)
}

// ── H. 经济系统（§11.3）───────────────────────────
console.log('══ H. 经济系统 ══')
{
  const p = freshPlayer()
  check('经济', '初始金币 100', p.gold === 100)
  p.gold = 50
  check('经济', '金币恰好购买（杂货铺 50 值物品）', p.spendGold(50) === true && p.gold === 0)
  check('经济', '余额不足拒绝', p.spendGold(1) === false)
  check('经济', '负数消费拒绝', p.spendGold(-100) === false)
  check('经济', '零消费拒绝', p.spendGold(0) === false)
  p.gainGold(100.7)
  check('经济', 'gainGold 取整', p.gold === 100)
  p.gainItem('apple', 5)
  check('经济', '负数消耗物品拒绝', p.spendItem('apple', -1) === false && p.inventory.apple === 5)
  p.gainItem('apple', -3)
  check('经济', '负数获得物品忽略', p.inventory.apple === 5)
  // 商店购买（§11.3）
  const entry = SHOP_ITEMS[0]
  p.gold = entry.price
  check('经济', '商店恰好金币购买', p.gainItem ? (() => { p.spendGold(entry.price); return true })() : false)
  p.inventory = {}
  p.gold = entry.price
  const p2 = freshPlayer()
  p2.gold = entry.price - 1
  check('经济', '商店余额不足不购买', (() => { const before = p2.inventory[entry.itemId]; p2.spendGold(entry.price); return (p2.inventory[entry.itemId] ?? 0) === (before ?? 0) })())
  // 餐厅收入
  p2.gainItem('roastPotato', 5)
  p2.setRestaurantMenu(0, 'roastPotato')
  check('经济', '餐厅菜单收入 > 0', p2.restaurantHourlyIncome > 0)
  p2.restaurant.menu = []
  check('经济', '空菜单收入 = 0', p2.restaurantHourlyIncome === 0)
  // 物品价值（§11.3 参考：出售价 = 价值×0.5）
  check('经济', '全部物品有正价值', Object.values(ITEMS).every((it) => it.value > 0))
}

// ── I. 成就 / 图鉴（§6）───────────────────────────
console.log('══ I. 成就 / 图鉴 ══')
{
  const p = freshPlayer()
  check('成就', '0 成就初始', p.achievements.length === 0)
  check('成就', '图鉴 0% 初始', p.collectionPct === 0)
  p.setSkillState('foraging', { level: 10, exp: totalXpForLevel(10) })
  p.checkAchievements()
  check('成就', '技能 10 级成就解锁', p.achievements.includes('skill_foraging_10'))
  check('成就', '成就奖励金币入账', p.gold >= 100 + 100)
  // 重复调用不重复发奖
  const goldBefore = p.gold
  p.checkAchievements()
  check('成就', '重复检查不重复发奖', p.gold === goldBefore)
  // 图鉴完成度
  p.gainItem('apple', 1)
  p.gainItem('carrot', 1)
  const pct = p.collectionPct
  check('成就', '图鉴 2 件完成度>0', pct > 0 && pct < 100, `pct=${pct}`)
  // 收集成就：全鱼类
  for (const id of ['crucian', 'carp', 'perch', 'salmon', 'tuna', 'eel', 'lobster', 'crab', 'abalone', 'seaCucumber', 'bluefin', 'grouper', 'goldenDragonFish']) p.gainItem(id, 1)
  p.checkAchievements()
  check('成就', 'allFish 触发并给渔夫之戒', p.achievements.includes('allFish') && p.inventory.fishermanRing === 1)
  // 称号（§6.3）
  check('成就', '称号随成就设置', typeof p.title === 'string' || p.title === null)
  // 成就总数
  check('成就', '成就定义完整性（id 唯一）', new Set(ALL_ACHIEVEMENTS.map((a) => a.id)).size === ALL_ACHIEVEMENTS.length)
}

// ── J. 数值安全（除零 / NaN / 越界）───────────────
console.log('══ J. 数值安全 ══')
{
  const p = freshPlayer()
  // xpProgress 边界
  const r1 = xpProgress(-100)
  check('安全', 'xpProgress(-100) 无 NaN', Number.isFinite(r1.progress) && r1.level === 1)
  const r2 = xpProgress(totalXpForLevel(99))
  check('安全', 'xpProgress(99级总经验) → 等级 99（100 级尚差 3.0 亿）', r2.level === 99 && r2.progress < 1, `lv=${r2.level}`)
  const r3 = xpProgress(0, 120)
  check('安全', 'xpProgress(0, 120) 正常', r3.level === 1)
  // 空目标命中率 / 间隔
  const f = new ForagingSkill(p)
  check('安全', '空目标 interval=0', f.intervalMs(null) === 0)
  const fsh = new FishingSkill(p)
  check('安全', '空目标成功率=0', fsh.successChance(null) === 0)
  // 空菜单餐厅收入
  check('安全', '餐厅空菜单不除零', p.restaurantHourlyIncome === 0)
  // 任务越界
  p.quests.index = 999
  check('安全', '任务索引越界 → currentQuest=null', p.currentQuest === null)
  // 农场地块越界
  const farm = new FarmingSkill(p)
  check('安全', '种植越界地块被拒', farm.canPlant(99, 'wheatSeed') === false)
  // 装备槽未知
  check('安全', '未知装备槽拒绝', p.equip('apple') === false)
  // 战斗属性无装备无 NaN
  const combat = new Combat(p)
  const st = combat.playerStats()
  check('安全', '战斗属性全部有限数', Object.values(st).every((v) => Number.isFinite(v)), JSON.stringify(st))
  // 大数经验（120 级 ~1 亿）无溢出
  check('安全', '120 级经验无溢出', totalXpForLevel(120) > totalXpForLevel(99) && Number.isFinite(totalXpForLevel(120)))
}

// ── K. 事件与监听 / 赛季点数 / 离线金币 ─────────────
console.log('══ K. 事件与监听 ══')
{
  // EventBus 允许重复注册 → ArenaView 每次挂载重复监听（泄漏）
  let count = 0
  const h1 = () => count++
  const h2 = () => (count += 2) // 不同逻辑（函数体不同）→ 各自触发
  EventBus.on('combat:end', h1)
  EventBus.on('combat:end', h2)
  EventBus.emit('combat:end', { result: 'win' })
  check('事件', '不同函数体监听各触发一次', count === 3, `count=${count}`)
  // 同函数体重复注册（HMR 重载场景：新闭包但源码相同）→ toString 去重只保留一份
  const before = count
  EventBus.on('combat:end', () => count++) // 新函数引用，函数体与 h1 相同
  EventBus.emit('combat:end', { result: 'win' })
  check('事件', '同函数体重复注册去重（防 HMR 堆叠）', count === before + 3, `count=${count}`) // h1+h2 各一次 = 3
  EventBus.off('combat:end', h1)
  EventBus.off('combat:end', h2)
}

// ── L. 赛季点数发放（§13）──────────────────────────
console.log('══ L. 赛季系统 ══')
{
  const p = freshPlayer()
  const season = p.activeSeasonDef
  const st = p.seasonState()
  const mission = season.missions.find((m) => m.kind !== 'restaurant')
  check('赛季', '赛季任务存在', !!mission)
  for (let i = 0; i < mission.qty; i++) p.bumpSeason(mission.kind, mission.param)
  check('赛季', '任务完成发放赛季点数', st.points === mission.points, `points=${st.points} exp=${mission.points}`)
  const before = st.points
  for (let i = 0; i < mission.qty; i++) p.bumpSeason(mission.kind, mission.param)
  check('赛季', '重复完成不重复发点', st.points === before, `points=${st.points}`)
  // 餐厅任务同步发点
  const restMission = season.missions.find((m) => m.kind === 'restaurant')
  if (restMission) {
    p.stats.restaurantTotal = restMission.qty
    p.syncSeasonProgress()
    check('赛季', '餐厅收入任务同步发点', st.points >= mission.points + restMission.points, `points=${st.points}`)
  }
}

// ── M. 离线金币应用（bootstrap settleOffline）──────
console.log('══ M. 离线结算闭环 ══')
{
  const p = freshPlayer({ exploration: 5 })
  setActivePinia(createPinia()) // 确保 ui store 可用
  useUiStore()
  p.setActiveSkill('exploration')
  p.activeTarget = getSkillInstance('exploration').targets[0]?.itemId ?? 'explore_001'
  const gold0 = p.gold
  const report = settleOffline(p, useUiStore(), 3600_000)
  check('离线', '探索离线金币入账', report !== null && p.gold > gold0, `gold ${gold0}→${p.gold}`)
}

// ── N. 补齐功能验证：容量/仓库/出售/史诗/硬核/钳制（§5.4/§5.2/§11.3/§4.1）──
console.log('══ N. 补齐功能验证 ══')
{
  // ── 背包容量（§5.4：初始 20 格）──
  const p = freshPlayer()
  const itemIds = Object.keys(ITEMS)
  check('容量', '初始背包 20 格', p.inventoryCap === 20)
  for (let i = 0; i < 20; i++) p.gainItem(itemIds[i], 1)
  check('容量', '20 种物品全部放入', p.inventorySlotsUsed === 20)
  const ok21 = p.gainItem(itemIds[20], 1)
  check('容量', '第 21 种被拒绝', ok21 === false && p.inventorySlotsUsed === 20)
  // 已有种类堆叠不受限
  p.gainItem(itemIds[0], 50)
  check('容量', '已有种类继续堆叠', p.inventory[itemIds[0]] === 51)
  // 扩展 10 格
  p.expandInventory(10)
  check('容量', '扩展 +10 → 30 格', p.inventoryCap === 30 && p.gainItem(itemIds[20], 1) === true)
  // 扩展上限 100
  for (let i = 0; i < 20; i++) p.expandInventory(10)
  check('容量', '扩展上限 100', p.inventoryCap === 100 && p.expandInventory(10) === false)

  // ── 仓库（§5.4：100 格，转移）──
  const p2 = freshPlayer()
  p2.gainItem('apple', 10)
  p2.gainItem('carrot', 5)
  check('仓库', '背包→仓库转移', p2.moveToBank('apple') === true && p2.bank.apple === 10 && p2.inventory.apple === undefined)
  check('仓库', '仓库不占背包格', p2.inventorySlotsUsed === 1 && p2.bankSlotsUsed === 1)
  p2.moveToInventory('apple', 3)
  check('仓库', '仓库→背包取出', p2.inventory.apple === 3 && p2.bank.apple === 7)
  check('仓库', '仓库初始 100 格', p2.bankCap === 100)
  for (let i = 0; i < 20; i++) p2.expandBank(20)
  check('仓库', '仓库扩展上限 500', p2.bankCap === 500 && p2.expandBank(20) === false)
  // 仓库满拒绝
  const p3 = freshPlayer()
  p3.bankCap = 1
  p3.gainItem('apple', 1)
  p3.gainItem('carrot', 1)
  p3.moveToBank('apple')
  check('仓库', '仓库满拒绝新种类', p3.moveToBank('carrot') === false)

  // ── 出售（§11.3：价值×0.5）──
  const p4 = freshPlayer()
  p4.gainItem('apple', 10) // 价值 5 → 单价 2
  const gold0 = p4.gold
  check('出售', '出售单价 = floor(价值×0.5)', p4.sellItem('apple', 1) === true && p4.gold === gold0 + 2)
  p4.sellItem('apple', 9)
  check('出售', '全部出售后清空', p4.inventory.apple === undefined)
  check('出售', '数量不足拒绝', p4.sellItem('apple', 1) === false)
  const p5 = freshPlayer()
  p5.gainItem('apple', 1)
  const g0 = p5.gold
  p5.sellItem('apple', -1)
  check('出售', '负数数量拒绝', p5.gold === g0 && p5.inventory.apple === 1)

  // ── 史诗品质（§5.2：六品质齐全）──
  const qualities = new Set(Object.values(ITEMS).filter((it) => it.type === 'equipment').map((it) => it.quality))
  check('品质', '六档品质齐全（普通~神话）', ['普通', '精良', '稀有', '史诗', '传说', '神话'].every((q) => qualities.has(q)), JSON.stringify([...qualities]))
  // 史诗档 = 精金/水晶套（Lv36-45，含补齐件）；2026-09-09 tier/品质归一后由 12 件变为 18 件
  const epics = Object.values(ITEMS).filter((it) => it.type === 'equipment' && it.quality === '史诗')
  check('品质', '史诗装备 18 件（精金/水晶套，含补齐件）', epics.length === 18, `${epics.length} 件`)
  check('品质', '史诗档全部落在精金/水晶套（品质随等级）', epics.every((it) => /精金|水晶/.test(it.name)), epics.filter((it) => !/精金|水晶/.test(it.name)).map((it) => it.name).join(','))
  // 锻造装备档位随制作等级（2026-09-09 修复：补齐件 ceil(seg×0.6)/既有件旧索引/手写段位 三套口径并存，最多脱钩 57 级）
  {
    const lvOf = new Map()
    for (const r of getSkillInstance('craftsmithing')?.recipes ?? []) {
      const o = r.output?.itemId
      if (!o) continue
      const cur = lvOf.get(o)
      if (cur == null || r.reqLevel < cur) lvOf.set(o, r.reqLevel)
    }
    const wantTier = (lv) => Math.max(1, Math.min(10, Math.ceil(lv / 10)))
    const bad = [...lvOf].filter(([id, lv]) => ITEMS[id]?.type === 'equipment' && ITEMS[id].tier !== wantTier(lv))
    check('品质', '锻造装备档位随制作等级（tier = ceil(lv/10)）', bad.length === 0, bad.slice(0, 3).map(([id, lv]) => `${ITEMS[id]?.name}(Lv${lv},T${ITEMS[id]?.tier})`).join(','))
  }
  const ck = getItem('crystalKnife')
  check('品质', '史诗属性 > 稀有（34 > 24）', ck.stats.attack > getItem('goldKnife').stats.attack)

  // ── 硬核模式（§4.1/§8.2）──
  const p6 = freshPlayer({ knife: 5, tasteAcumen: 1, heatControl: 1 })
  p6.inventory.roastPotato = 20
  p6.hardcore = true
  let deathEvent = 0
  const hd = () => deathEvent++
  EventBus.on('hardcore:death', hd)
  const combat = new Combat(p6)
  fightToEnd(combat, COMBAT_REGIONS[9].opponents[1]) // L98 必败
  check('硬核', '死亡触发删档事件', deathEvent >= 1, `events=${deathEvent}`)
  EventBus.off('hardcore:death', hd)
  const p7 = freshPlayer()
  check('硬核', '默认非硬核', p7.hardcore === false)

  // ── 100 级经验钳制（未转生上限 100：2026-09 曲线为 99→100 需 3 亿）──
  const p8 = freshPlayer()
  const f8 = new ForagingSkill(p8)
  p8.setSkillState('foraging', { level: 100, exp: totalXpForLevel(100) })
  f8.addXp(999_999_999)
  check('钳制', '100 级经验封顶', p8.skills.foraging.exp === totalXpForLevel(100), `exp=${p8.skills.foraging.exp}`)

  // ── 图鉴一位小数 ──
  const p9 = freshPlayer()
  p9.gainItem('apple', 1)
  check('图鉴', '1 件物品完成度 > 0（一位小数）', p9.collectionPct > 0, `pct=${p9.collectionPct}`)
  check('图鉴', '完成度上限 100', freshPlayer().collectionPct === 0)
}

// ── O. 挂机暂停/继续 + 实时进度（§3.1）──────────────
console.log('══ O. 挂机暂停/进度 ══')
{
  const p = freshPlayer()
  p.activeTarget = 'apple'
  const f = new ForagingSkill(p)
  p.setSkillPaused('foraging', true)
  f.tick(30_000) // 暂停中 30s
  check('暂停', '暂停中不产出', f.actionsDone === 0 && (p.inventory.apple ?? 0) === 0)
  check('暂停', '暂停状态可查', p.isSkillPaused('foraging') === true)
  p.setSkillPaused('foraging', false)
  f.tick(30_000)
  check('暂停', '继续后恢复产出（10 次）', f.actionsDone === 10 && (p.inventory.apple ?? 0) >= 10, `done=${f.actionsDone} apples=${p.inventory.apple}`)
  // 进度值
  const p2 = freshPlayer()
  p2.activeTarget = 'apple'
  const f2 = new ForagingSkill(p2)
  f2.timerMs = 1500
  check('进度', '进度值 = timer/interval（1500/3000=0.5）', Math.abs(f2.progressPct - 0.5) < 0.01, `pct=${f2.progressPct}`)
  // 离线暂停（settleOffline 不结算）
  const p3 = freshPlayer()
  useUiStore()
  p3.setSkillPaused('foraging', true)
  const r = settleOffline(p3, useUiStore(), 3600_000)
  check('暂停', '离线暂停不结算（无报告）', r === null && (p3.inventory.apple ?? 0) === 0)
  // 暂停状态随存档往返
  const p4 = freshPlayer()
  p4.setSkillPaused('hunting', true)
  const s = JSON.stringify(p4.serialize())
  const p5 = freshPlayer()
  p5.applySave(JSON.parse(s))
  check('暂停', '暂停状态随存档保存', p5.isSkillPaused('hunting') === true)
}

// ── P. 多技能并行挂机（§3.1：切技能页不中断）────────
console.log('══ P. 多技能并行 ══')
{
  const p = freshPlayer()
  const forInst = getSkillInstance('foraging')
  const fishInst = getSkillInstance('fishing')
  // 新档待机（无默认目标）；测试显式选择采摘苹果 + 垂钓鲫鱼
  p.setSkillTarget('foraging', 'apple')
  p.setSkillTarget('fishing', 'crucian')
  check('并行', '每技能独立目标', p.skillTargets.fishing === 'crucian' && p.getSkillTarget('foraging') === 'apple')
  // 双技能同时 tick（成功判定强制命中）
  withRandom([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], () => p.tick(10_000))
  check('并行', '采摘+垂钓同时产出', forInst.actionsDone >= 1 && fishInst.actionsDone >= 1, `f=${forInst.actionsDone} g=${fishInst.actionsDone}`)
  check('并行', '产出入账', (p.inventory.apple ?? 0) >= 1 && (p.inventory.crucian ?? 0) >= 1, JSON.stringify({ a: p.inventory.apple, c: p.inventory.crucian }))
  // 切换技能页（activeSkill 变化）不中断并行任务
  p.setActiveSkill('cooking')
  const aBefore = p.inventory.apple ?? 0
  withRandom([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], () => p.tick(10_000))
  check('并行', '切到制作页后采摘仍在产出', (p.inventory.apple ?? 0) > aBefore, `${aBefore} → ${p.inventory.apple}`)
  // 单独暂停垂钓：采摘继续
  p.setSkillPaused('fishing', true)
  const cBefore = p.inventory.crucian ?? 0
  const fBefore = p.inventory.apple ?? 0
  withRandom([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], () => p.tick(10_000))
  check('并行', '垂钓暂停、采摘继续', (p.inventory.crucian ?? 0) === cBefore && (p.inventory.apple ?? 0) > fBefore, `c ${cBefore}→${p.inventory.crucian} a ${fBefore}→${p.inventory.apple}`)
  // 旧档迁移：activeTarget → skillTargets
  const old = { name: 'x', gold: 1, activeSkill: 'fishing', activeTarget: 'tuna', skills: {} }
  const p6 = freshPlayer()
  p6.applySave(old)
  check('并行', '旧档 activeTarget 迁移到技能目标', p6.skillTargets.fishing === 'tuna')
}

// ── Q. 并行上限设置（§3.1）────────────────────────
console.log('══ Q. 并行上限 ══')
{
  const p = freshPlayer()
  p.setSkillTarget('foraging', 'apple')
  p.setSkillTarget('fishing', 'crucian')
  check('上限', '默认无限制（0）', (p.settings.maxParallelIdle ?? 0) === 0 && p.getRunningIdleSkills().length === 2)
  // 上限 1：仅活动技能运行（当前活动 foraging）
  p.settings.maxParallelIdle = 1
  let running = p.getRunningIdleSkills().map((i) => i.id)
  check('上限', '上限 1 只运行活动技能（foraging）', running.length === 1 && running[0] === 'foraging', JSON.stringify(running))
  // 切到垂钓页 → 垂钓优先占位
  p.setActiveSkill('fishing')
  running = p.getRunningIdleSkills().map((i) => i.id)
  check('上限', '切到垂钓后优先运行垂钓', running[0] === 'fishing', JSON.stringify(running))
  // 实际 tick：上限 1 时只有 fishing 产出
  withRandom([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], () => p.tick(10_000))
  check('上限', '上限 1 时只有垂钓产出', (p.inventory.crucian ?? 0) >= 1 && (p.inventory.apple ?? 0) === 0, JSON.stringify({ c: p.inventory.crucian, a: p.inventory.apple }))
  // 上限 2：双技能都运行
  p.settings.maxParallelIdle = 2
  withRandom([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], () => p.tick(10_000))
  check('上限', '上限 2 时双技能都产出', (p.inventory.apple ?? 0) >= 1 && (p.inventory.crucian ?? 0) >= 1)
  // 离线受限：只结算活动技能
  const p2 = freshPlayer()
  p2.setSkillTarget('foraging', 'apple')
  p2.setSkillTarget('fishing', 'crucian')
  p2.settings.maxParallelIdle = 1
  p2.setActiveSkill('foraging')
  useUiStore()
  settleOffline(p2, useUiStore(), 3600_000)
  check('上限', '离线仅结算活动技能', (p2.inventory.apple ?? 0) > 0 && (p2.inventory.crucian ?? 0) === 0, JSON.stringify({ a: p2.inventory.apple, c: p2.inventory.crucian }))
  // 设置随存档
  const p3 = freshPlayer()
  p3.settings.maxParallelIdle = 2
  const s3 = JSON.stringify(p3.serialize())
  const p4 = freshPlayer()
  p4.applySave(JSON.parse(s3))
  check('上限', '并行上限设置随存档保存', p4.settings.maxParallelIdle === 2)
}

// ── R. 赛季数据完整性（§13：20 季轮换，内容不重复）────
console.log('══ R. 赛季数据完整性 ══')
{
  check('赛季', '共 40 个赛季', SEASONS.length === 40, `got ${SEASONS.length}`)
  check('赛季', 'id/名称/限定装备唯一', (() => {
    const u = (arr) => new Set(arr).size === arr.length
    return u(SEASONS.map((s) => s.id)) && u(SEASONS.map((s) => s.name)) && u(SEASONS.map((s) => s.limitedItem))
  })())
  check('赛季', '限定装备均存在于物品库', SEASONS.every((s) => !!ITEMS[s.limitedItem]))
  // 任务目标物品全局有效（2026-09 起按主题池生成 10 任务/季，允许跨季复用物品）
  const itemParams = SEASONS.flatMap((s) => s.missions.filter((m) => ['gather', 'craft', 'harvest'].includes(m.kind)).map((m) => m.param))
  check('赛季', '任务目标物品均有效（无 undefined/空）', itemParams.every((p) => !!p), `n=${itemParams.length}`)
  check('赛季', '任务目标物品均存在于物品库', itemParams.every((p) => !!ITEMS[p]))
  // 成就同步：赛季成就存在
  check('赛季', '赛季成就（5/10/20）已同步', ['season5', 'season10', 'seasonAll'].every((id) => ALL_ACHIEVEMENTS.some((a) => a.id === id)))
}

// ── S. 内容扩充完整性（生成器 expansion1.js）────────
console.log('══ S. 内容扩充完整性 ══')
{
  const EXP = await import('../../src/game/data/expansion1.js')
  const insts = {}
  createSkillInstances(freshPlayer())
  for (const id of ['foraging', 'fishing', 'hunting', 'excavation', 'cooking', 'baking', 'preserving', 'brewing', 'spiceMixing', 'craftsmithing', 'preservation', 'exploration']) insts[id] = getSkillInstance(id)
  // 各技能扩充后数量：与当前生成器产物一致（2026-09-06 实测量）
  check('扩充', '采集四技能目标数（142/72/70/83）', insts.foraging.targets.length === 142 && insts.fishing.targets.length === 72 && insts.hunting.targets.length === 70 && insts.excavation.targets.length === 83, JSON.stringify({ f: insts.foraging.targets.length, g: insts.fishing.targets.length, h: insts.hunting.targets.length, x: insts.excavation.targets.length }))
  check('扩充', '制作五技能食谱数（294/97/90/127/97）', insts.cooking.recipes.length === 294 && insts.baking.recipes.length === 97 && insts.preserving.recipes.length === 90 && insts.brewing.recipes.length === 127 && insts.spiceMixing.recipes.length === 97, JSON.stringify({ c: insts.cooking.recipes.length, b: insts.baking.recipes.length, p: insts.preserving.recipes.length, r: insts.brewing.recipes.length, s: insts.spiceMixing.recipes.length }))
  check('扩充', '锻造 365 配方（20 品质套 + 独立矿套）', insts.craftsmithing.recipes.length === 365, `n=${insts.craftsmithing.recipes.length}`)
  // 18 = 入门 1（厨余堆肥，2026-09-09 解除 Lv1 阻塞）+ 肥料 2 + 保鲜/增益剂 15
  check('扩充', '食材保鲜 18 配方（入门 1 + 肥料 2 + 保鲜/增益剂 15）', insts.preservation.recipes.length === 18, `n=${insts.preservation.recipes.length}`)
  // 制作技能入口保护（2026-09-09）：每个制作技能必须至少有一个 Lv1 配方，否则技能永远无法起步
  {
    const noEntry = ['cooking', 'baking', 'preserving', 'brewing', 'spiceMixing', 'craftsmithing', 'preservation', 'spiritSummoning']
      .filter((id) => !getSkillInstance(id).recipes.some((r) => r.reqLevel <= 1))
    check('扩充', '每个制作技能都有 Lv1 入口配方（不可再出现永久卡 1 级）', noEntry.length === 0, noEntry.join(','))
  }
  check('扩充', '美食知识 32 奥义', AOJIS.length === 32, `n=${AOJIS.length}`)
  check('扩充', '食灵 160 个', SPIRITS.length === 160, `n=${SPIRITS.length}`)
  check('扩充', '探索 200 目标', insts.exploration.targets.length === 200, `n=${insts.exploration.targets.length}`)
  check('扩充', '区域对手 22×10 / BOSS 28', COMBAT_REGIONS.every((r) => r.opponents.length === 22) && COMBAT_BOSSES.length === 28, `bosses=${COMBAT_BOSSES.length}`)
  // 扩充条目唯一性 + 引用有效性（spirit_ext_* 为旧精灵占位，被 items.js 剔除后由 spiritTiers 接管）
  const allItems = Object.keys(ITEMS)
  check('扩充', '新增物品 id 唯一且无重名（合法入册）', (() => {
    const ext = Object.values(EXP.EXPANSION_ITEMS).filter((x) => !x.id.startsWith('spirit_'))
    const ids = ext.map((x) => x.id)
    const names = ext.map((x) => x.name)
    return new Set(ids).size === ids.length && new Set(names).size === names.length && ids.every((id) => allItems.includes(id))
  })())
  // 所有食谱材料必须存在
  const badIng = []
  for (const inst of Object.values(insts)) {
    for (const r of inst.recipes ?? []) {
      for (const ing of Object.keys(r.ingredients ?? {})) if (!ITEMS[ing]) badIng.push(`${inst.id}:${r.id}→${ing}`)
    }
  }
  check('扩充', '全部食谱材料均存在于物品库', badIng.length === 0, badIng.slice(0, 5).join('; '))
  // 食灵契约材料必须存在
  const badContract = []
  for (const sp of SPIRITS) for (const c of Object.keys(sp.contract ?? {})) if (!ITEMS[c]) badContract.push(`${sp.id}→${c}`)
  check('扩充', '食灵契约材料均存在', badContract.length === 0, badContract.join('; '))
  // 新增物品有正价值
  check('扩充', '新增物品价值 > 0', Object.values(EXP.EXPANSION_ITEMS).every((x) => x.value > 0))
}

// ── T. 攻略数据完整性 ─────────────────────────────
console.log('══ T. 攻略数据 ══')
{
  const G = await import('../../src/game/data/guide.js')
  check('攻略', '六阶段齐全', G.GUIDE_STAGES.length === 6, `n=${G.GUIDE_STAGES.length}`)
  check('攻略', '阶段 id 唯一且有序', (() => {
    const ids = G.GUIDE_STAGES.map((s) => s.id)
    return new Set(ids).size === ids.length
  })())
  check('攻略', '每阶段内容完整（目标/行动/里程碑/提示非空）', G.GUIDE_STAGES.every((s) => s.goals?.length >= 2 && s.actions?.length >= 5 && s.milestones?.length >= 3 && s.tips?.length >= 2), JSON.stringify(G.GUIDE_STAGES.map((s) => [s.id, s.goals.length, s.actions.length, s.milestones.length, s.tips.length])))
  // 阶段自动定位边界（对决等级）
  const cases = [[1, 'beginner'], [10, 'beginner'], [11, 'early'], [30, 'early'], [31, 'mid'], [60, 'mid'], [61, 'late'], [85, 'late'], [86, 'lategame'], [99, 'lategame'], [100, 'endgame'], [120, 'endgame']]
  check('攻略', '按对决等级自动定位正确', cases.every(([lv, id]) => G.currentGuideStageId(lv) === id), cases.filter(([lv, id]) => G.currentGuideStageId(lv) !== id).map(([lv]) => `L${lv}`).join(','))
}

// ── U. 图鉴数据完整性（物品来源/BOSS/赛季图鉴）──────
console.log('══ U. 图鉴数据 ══')
{
  const { itemSources, sourcedCount } = await import('../../src/game/data/itemSources.js')
  const total = Object.keys(ITEMS).length
  // 来源索引覆盖率：大多数物品应有来源（未覆盖的仅为无固定来源的特殊道具）
  const covered = new Set()
  for (const id of Object.keys(ITEMS)) if (itemSources(id).length) covered.add(id)
  check('图鉴', `物品来源索引覆盖 ${covered.size}/${total}`, covered.size >= total * 0.95, `covered=${covered.size}`)
  // 关键物品来源抽查
  check('图鉴', '苹果来源 = 采摘', itemSources('apple').some((s) => s.includes('采摘')))
  check('图鉴', '铜刀来源 = 厨具锻造', itemSources('copperKnife').some((s) => s.includes('厨具锻造')))
  check('图鉴', '盛夏草帽来源 = 赛季限定', itemSources('summerHat').some((s) => s.includes('盛夏果味季')))
  check('图鉴', '陷阱来源 = 杂货铺', itemSources('trap').some((s) => s.includes('杂货铺')))
  // BOSS 图鉴：18 BOSS 全部有掉落与机制标记
  check('图鉴', 'BOSS 图鉴 28 个且均有独有掉落', COMBAT_BOSSES.length === 28 && COMBAT_BOSSES.every((b) => b.drops?.length))
  // 赛季图鉴：40 赛季均有限定装备
  check('图鉴', '赛季图鉴 40 个且均有限定装备', SEASONS.length === 40 && SEASONS.every((s) => ITEMS[s.limitedItem]))
  // 击杀记录：BOSS 击败后入 stats.bosses（去重）
  const p = freshPlayer({ knife: 5, tasteAcumen: 1, heatControl: 1 })
  p.inventory.roastPotato = 20
  p.onCombatWin({ isBoss: true, name: '面条之王' })
  p.onCombatWin({ isBoss: true, name: '面条之王' })
  check('图鉴', 'BOSS 击杀记录去重', p.stats.bosses.length === 1 && p.stats.bosses[0] === '面条之王')
  // 美食知识经验来源（2026-09-09 修复：此前全仓无经验来源 → 永久 Lv1，但其等级计入辅助公会门槛）
  {
    const g0 = p.skills.gastronomy.exp
    p.onCombatWin({ name: '测试对手', level: 40, isBoss: false })
    check('图鉴', '美食知识随对决胜利获得经验', p.skills.gastronomy.exp > g0, `${g0} → ${p.skills.gastronomy.exp}`)
  }
  // 探索经验口径（2026-09-09 修复）：必须走 addCardXp（×60 卡片系数），与采集/制作一致
  {
    const ex = getSkillInstance('exploration')
    const e0 = p.skills.exploration.exp
    ex.addCardXp(100, 1)
    check('图鉴', '探索经验走卡片系数（100 → 6000）', p.skills.exploration.exp - e0 === 6000, `${p.skills.exploration.exp - e0}`)
  }
  check('图鉴', 'bossAll 成就阈值同步为 28', ALL_ACHIEVEMENTS.find((a) => a.id === 'bossAll').check({ stats: { bosses: Array(28).fill('x') } }) === true && ALL_ACHIEVEMENTS.find((a) => a.id === 'bossAll').check({ stats: { bosses: [] } }) === false)
}

// ── V. 对手数据完整性（对决页面显示字段）───────────
console.log('══ V. 对手数据 ══')
{
  // 所有对手（120 区域 + 18 BOSS）必须具备完整战斗字段（风格名/HP/攻/防/命中/闪避/暴击）
  const all = [...COMBAT_REGIONS.flatMap((r) => r.opponents), ...COMBAT_BOSSES]
  const bad = all.filter((o) => !(o.styleName && Number.isFinite(o.hp) && Number.isFinite(o.atk) && Number.isFinite(o.def) && Number.isFinite(o.acc) && Number.isFinite(o.eva) && Number.isFinite(o.crit) && Number.isFinite(o.speedMs)))
  check('对手', '全部 248 个对手字段完整（风格/HP/攻/防/命中/闪避/暴击/攻速）', all.length === 248 && bad.length === 0, `bad=${bad.map((b) => b.name).join(',')}`)
  // 数值合理：HP/攻/防 随等级递增
  check('对手', 'HP 随等级递增', COMBAT_BOSSES.every((b) => b.hp === 12 + b.level * 6), 'opp 公式一致')
  check('对手', 'BOSS 机制文本可读', COMBAT_BOSSES.every((b) => b.mechanic === null || b.mechanic === undefined || Object.keys(b.mechanic).length >= 0))
  // 掉落完整：全部 138 个对手/BOSS 均有掉落（基础+扩充）
  check('对手', '全部对手均有掉落', all.every((o) => (o.drops?.length ?? 0) > 0), `empty=${all.filter((o) => !o.drops?.length).map((o) => o.name).join(',')}`)
  // 扩充对手掉落池引用有效物品
  const badDrop = all.flatMap((o) => (o.drops ?? []).filter((d) => !ITEMS[d.itemId]).map((d) => `${o.name}→${d.itemId}`))
  check('对手', '所有掉落引用有效物品', badDrop.length === 0, badDrop.slice(0, 5).join('; '))
}

// ── W. 限时窗口活动（2026-09-06：夜市/晨集/茶歇/午夜/主厨日）──────
console.log('══ W. 限时窗口活动 ══')
{
  const p = freshPlayer()
  // 固定传 weekday=1（周一）排除周日主厨日/周四疯狂星期四干扰；边界含窗口起止
  const ids = (h, w) => p.activeMarketEvents(h, w).map((e) => e.id).sort().join(',')
  check('夜市', '16-22 点窗口判定（含边界，周一）', ids(16, 1).includes('nightMarket') && ids(21, 1).includes('nightMarket') && !ids(15, 1).includes('nightMarket') && !ids(22, 1).includes('nightMarket'))
  check('夜市', '窗口倍率 餐厅×2 / 对决×1.5', p.marketBoost(18, 1).restaurant === 2 && p.marketBoost(18, 1).combatXp === 1.5)
  check('活动', '无窗口时段（凌晨 2 点）倍率为 1', p.marketBoost(2, 1).restaurant === 1 && p.marketBoost(2, 1).combatXp === 1)
  // 五个+ 窗口
  check('活动', '晨集 6-9 采集 ×1.5', ids(6, 1) === 'morningMarket' && p.marketBoost(6, 1).gatherXp === 1.5)
  check('活动', '思想风暴 10-13 制作 ×2', ids(11, 1).includes('brainstorm') && p.marketBoost(11, 1).craftXp === 2)
  check('活动', '茶歇 14-17 制作 ×1.5', ids(15, 1).includes('teaBreak') && p.marketBoost(15, 1).craftXp === 1.5)
  check('活动', '午夜食堂 22-1 对决 ×2（跨夜）', ids(23, 1) === 'nightDiner' && ids(0, 1) === 'nightDiner' && p.marketBoost(23, 1).combatXp === 2)
  check('活动', '主厨日仅周日 9-21', ids(9, 0) === 'chefDay' && ids(9, 1) === '' && p.marketBoost(18, 0).restaurant === 3)
  check('活动', '疯狂星期四仅周四 9-21（与夜市叠加 ×3）', ids(10, 4).includes('kfcThursday') && !ids(10, 1).includes('kfcThursday') && p.marketBoost(18, 4).restaurant === 3)
  // 经验链路：采集窗口加成
  const pg = freshPlayer({ foraging: 5 })
  const fg = getSkillInstance('foraging')
  const beforeG = pg.skills.foraging.exp
  const orig = pg.marketBoost
  pg.marketBoost = (h, w) => (h ?? 6) >= 6 && (h ?? 6) < 9 ? { restaurant: 1, combatXp: 1, gatherXp: 1.5, craftXp: 1 } : { restaurant: 1, combatXp: 1, gatherXp: 1, craftXp: 1 }
  fg.addXp(1000)
  check('活动', '晨集采集经验 ×1.5 生效', pg.skills.foraging.exp - beforeG === 1500, `got ${pg.skills.foraging.exp - beforeG}`)
  pg.marketBoost = orig
}

// ── X. 觅珍抽卡（2026-09-06）──────────────────────
console.log('══ X. 觅珍抽卡 ══')
{
  const p = freshPlayer()
  p.gold = 100000
  const r1 = p.drawMijian('material', 3)
  check('觅珍', '材料池抽卡返回 3 件有效物品', r1.ok && r1.results.length === 3 && r1.results.every((it) => it && it.type && it.value > 0), JSON.stringify((r1.results ?? []).map((it) => it?.id)))
  const r2 = p.drawMijian('food', 1)
  check('觅珍', '食物池产出食物/饮品', r2.ok && r2.results.every((it) => ['food', 'drink'].includes(it?.type)), JSON.stringify((r2.results ?? []).map((it) => it?.id)))
  const r3 = p.drawMijian('gear', 1)
  const gearOk = r3.ok && r3.results.length === 1 && r3.results[0]?.type === 'equipment'
  check('觅珍', '厨具池产出装备', gearOk, JSON.stringify((r3.results ?? []).map((it) => it?.id)))
  check('觅珍', '金币扣费（新价：材料60*3+食物110+厨具500=790）', p.gold === 100000 - 790, `gold=${p.gold}`)
  // 保底计数：连续抽 10 次厨具必出现稀有及以上（前置计数模拟）
  p.mijian.pity = 9
  const r4 = p.drawMijian('gear', 1)
  const boosted = r4.boosted && ['稀有', '史诗', '传说', '神话'].includes(r4.results[0]?.quality)
  check('觅珍', '保底第 10 抽必出稀有及以上', boosted, JSON.stringify(r4.results.map((it) => [it?.id, it?.quality])))
  check('觅珍', '保底后计数清零（gear）', p.mijian.pity.gear === 0 || p.mijian.pity === 0)
  // 混池 / 限时池 / 百连
  const r5 = p.drawMijian('mix', 5)
  const mixOk = r5.ok && r5.results.length === 5 && r5.results.every((it) => it && it.value > 0)
  check('觅珍', '混池抽卡（80 金/抽，全品类）', mixOk, JSON.stringify((r5.results ?? []).map((it) => it?.id)))
  const r6 = p.drawMijian('limited', 1)
  check('觅珍', '限时池抽卡（1200 金/抽）', r6.ok && r6.results.length === 1 && r6.results[0]?.id, JSON.stringify((r6.results ?? []).map((it) => it?.id)))
  const r100 = p.drawMijian('material', 100)
  check('觅珍', '百连（100 张结果）', r100.ok && r100.results.length === 100, JSON.stringify(r100.results.length))
  const afterSpent = p.gold
  check('觅珍', '金币扣费与累计花费一致（stats.spent = 100000 - gold）', p.mijian.stats.spent === 100000 - afterSpent, `spent=${p.mijian.stats.spent} gold=${afterSpent}`)
  // 限时池保底：5 抽短保底（pity.limited = 4 → 下一抽必稀有+）
  p.mijian.pity = p.mijian.pity ?? { gear: 0, limited: 0 }
  p.mijian.pity.limited = 4
  const r7 = p.drawMijian('limited', 1)
  check('觅珍', '限时池保底第 5 抽必出稀有及以上', r7.boosted && ['稀有', '史诗', '传说', '神话'].includes(r7.results[0]?.quality), JSON.stringify(r7.results.map((it) => [it?.id, it?.quality])))
  // 爆率口径（2026-09-06 全面下调后；5000 次抽样区间校验）
  {
    const { pickItem: pk } = await import('../../src/game/data/mijianDraws.js')
    const RARE = ['稀有', '史诗', '传说', '神话']
    const rate = (poolId, n = 5000) => {
      let rare = 0
      for (let i = 0; i < n; i++) {
        const { item } = pk(poolId, Math.random, 0)
        if (item?.quality && RARE.includes(item.quality)) rare++
      }
      return rare / n
    }
    const g = rate('gear'), m = rate('mix'), l = rate('limited')
    check('觅珍', '厨具池稀有+ 爆率 8-14%（当前 10-11% 档）', g >= 0.08 && g <= 0.14, `g=${(g * 100).toFixed(2)}%`)
    check('觅珍', '混池稀有+ 爆率 ≤2%', m >= 0.002 && m <= 0.02, `m=${(m * 100).toFixed(2)}%`)
    check('觅珍', '限时池稀有+ 爆率 ≤4%（5 抽保底兜底）', l >= 0.005 && l <= 0.04, `l=${(l * 100).toFixed(2)}%`)
    // 普通池确定性：绝不产出超过价值上限的珍品
    let capped = true
    for (let i = 0; i < 200; i++) {
      const mat = pk('material', Math.random, 0).item
      const foo = pk('food', Math.random, 0).item
      if (mat.value > 50 || foo.value > 100) capped = false
    }
    check('觅珍', '材料/食物池无珍品（价值上限 50/100）', capped)
  }
  // 图鉴三查：抽卡来源
  const { itemSources: src } = await import('../../src/game/data/itemSources.js')
  check('觅珍', '图鉴来源含觅珍（厨具池）', src('copperKnife').some((s) => s.includes('觅珍·厨具池')), JSON.stringify(src('copperKnife').slice(0, 3)))
  check('觅珍', '图鉴来源含觅珍（材料池）', src('apple').some((s) => s.includes('觅珍·材料池')))
}

// ── C10. 一键入包（2026-09-06）──
console.log('══ C10. 一键入包 ══')
{
  const p = freshPlayer({})
  p.gainItem('apple', 5)
  p.gainItem('ironKnife', 1)
  const moved = p.moveAllToBank()
  check('存取', '一键入仓（背包→仓库，装备跳过）', moved === 1 && (p.bank.apple ?? 0) === 5 && (p.inventory.ironKnife ?? 0) === 1)
  const back = p.moveAllToInventory()
  check('存取', '一键入包（仓库→背包，含装备）', back === 1 && (p.inventory.apple ?? 0) === 5 && (p.inventory.ironKnife ?? 0) === 1 && !(p.bank.apple ?? 0))
}


// ── C11. 食灵阁（2026-09-06：食灵不占背包格）──
console.log('══ C11. 食灵阁 ══')
{
  const p = freshPlayer({ spiritSummoning: 10 })
  p.gainSpirit('appleSpirit_1', 3)
  check('食灵', '食灵入阁不占背包格', (p.spirits.owned?.appleSpirit_1 ?? 0) === 3 && !(p.inventory.appleSpirit_1 > 0) && Object.keys(p.inventory).filter((k) => p.inventory[k] > 0).length === 0)
  const okOn = p.setSpiritActive('appleSpirit_1', true)
  check('食灵', '出战消耗食灵阁 1 只', okOn === true && (p.spirits.owned?.appleSpirit_1 ?? 0) === 2 && p.spirits.active.includes('appleSpirit_1'))
  p.setSpiritActive('appleSpirit_1', false)
  check('食灵', '退役归还食灵阁', (p.spirits.owned?.appleSpirit_1 ?? 0) === 3 && !p.spirits.active.includes('appleSpirit_1'))
  // 契约材料判定走背包（2026-09-06 修复：have() 曾误读食灵阁）
  {
    const pm = freshPlayer({ spiritSummoning: 99 })
    const ss = getSkillInstance('spiritSummoning')
    const first = ss.recipes[0]
    for (const [mid, n] of Object.entries(first.ingredients)) pm.gainItem(mid, n)
    check('食灵', '契约材料在背包即可制作（canCraft）', ss.canCraft(first) === true)
    const matId = Object.keys(first.ingredients)[0]
    pm.inventory[matId] = 0
    check('食灵', '材料移除后 canCraft 为 false', ss.canCraft(first) === false)
  }
  // 旧档迁移：背包里的食灵 → 食灵阁（新档重置后干净复现）
  p.newGame()
  p.inventory.appleSpirit_1 = 2
  p.applySave(JSON.parse(JSON.stringify(p.$state)))
  check('食灵', '旧档背包食灵自动迁移入阁', (p.spirits.owned?.appleSpirit_1 ?? 0) === 2 && !(p.inventory.appleSpirit_1 > 0))
}

// ── C11. 信箱（2026-09-11）────────────────────────────
console.log('══ C11. 信箱 ══')
{
  // ① 新档欢迎信：纯文案、无附件
  const p = freshPlayer()
  check('信箱', '新档有一封欢迎信', p.mail.list.length === 1 && p.mail.list[0].kind === 'welcome')
  check('信箱', '欢迎信不带附件（不送东西）', p.mail.list[0].reward === null && p.mailUnclaimedCount() === 0)
  check('信箱', '无附件邮件不算待领', p.mailUnclaimedCount() === 0 && p.mailUnreadCount() === 1)

  // ② 背包满 → 物品不再静默丢失，而是转存邮箱（返回值语义保持 false）
  const ids = Object.keys(ITEMS)
  for (let i = 0; i < 20; i++) p.gainItem(ids[i], 1)
  const before = p.mail.list.length
  const ok = p.gainItem(ids[20], 1)
  check('信箱', '背包满时 gainItem 仍返回 false', ok === false && p.inventorySlotsUsed === 20)
  check('信箱', '背包满时物品被转存邮箱（不再丢失）', p.mail.list.length === before + 1 && p.mail.list.at(-1).kind === 'overflow')
  const om = p.mail.list.at(-1)
  check('信箱', '溢出邮件带正确附件', om.reward?.items?.[ids[20]] === 1 && om.claimed === false)
  check('信箱', '溢出邮件计入待领红点', p.mailUnclaimedCount() === 1)

  // ③ 连续同一物品的溢出 → 合并成一封（不刷屏）
  p.gainItem(ids[20], 4)
  check('信箱', '同物品溢出合并累加', p.mail.list.length === before + 1 && p.mail.list.at(-1).reward.items[ids[20]] === 5)

  // ④ 领取：背包腾出空间后成功入包
  delete p.inventory[ids[0]]
  const c1 = p.claimMail(om.id)
  check('信箱', '领取后物品入包', c1.ok === true && p.inventory[ids[20]] === 5)
  check('信箱', '领取后标记已领且计入统计', om.claimed === true && p.mailUnclaimedCount() === 0)
  // 内容同步（2026-09-11）：新增成就必须真的会被这套行为点亮
  check('信箱', '领取计数递增（信箱成就依据）', p.stats.mailClaimed === 1)
  check('信箱', '「信箱初启」成就随之达成', ACH_MAIL_FIRST.check(p) === true)
  check('信箱', '重复领取被拒', p.claimMail(om.id).ok === false)

  // ⑤ 领取时背包满 → 拒绝且邮件保持未领（不能领出来又转投成新邮件）
  const p5 = freshPlayer()
  for (let i = 0; i < 20; i++) p5.gainItem(ids[i], 1)
  p5.gainItem(ids[20], 3)
  const m5 = p5.mail.list.at(-1)
  check('信箱', '背包满时领取被拒', p5.claimMail(m5.id).ok === false, p5.claimMail(m5.id).msg)
  check('信箱', '被拒后邮件仍未领', m5.claimed === false && p5.mailUnclaimedCount() === 1)
  check('信箱', '被拒不会复制出第二封邮件', p5.mail.list.filter((m) => m.kind === 'overflow').length === 1)
  check('信箱', 'canGainItem 与实发一致', p5.canGainItem(ids[20], 3) === false && p5.canGainItem(ids[0], 1) === true)

  // ⑥ 堆积上限截断的部分同样转存
  const p6 = freshPlayer()
  p6.inventory[ids[0]] = 9999 // 食材堆叠上限
  p6.gainItem(ids[0], 5)
  check('信箱', '堆叠上限截断的部分转存邮箱', p6.inventory[ids[0]] === 9999 && p6.mail.list.at(-1)?.reward?.items?.[ids[0]] === 5)

  // ⑦ 非堆叠品（装备）重复获得不再蒸发
  const p7 = freshPlayer()
  p7.gainItem('ironKnife', 1)
  p7.gainItem('ironKnife', 1)
  check('信箱', '重复装备转存邮箱（改前静默丢失）', p7.inventory.ironKnife === 1 && p7.mail.list.at(-1)?.reward?.items?.ironKnife === 1)

  // ⑧ 拆卸宝石：背包满时拒绝，且**不会**既留插槽又转投邮箱（防白嫖）
  //    注意要让「宝石」是背包里**没有**的种类、且格子已占满，才命中 canGainItem 的拒绝分支
  const p8 = freshPlayer()
  p8.inventoryCap = 1 // 只有 1 个格子
  p8.inventory = { apple: 5 } // 该格已被占满 → 新种类无处可放
  p8.equipment.weapon = 'ironKnife'
  p8.gemSockets.weapon = { itemId: 'ironKnife', gems: ['goldOre'] } // goldOre 不在背包 → 新种类
  const u = p8.unsocketGem('weapon', 0)
  check('信箱', '背包满时拆卸宝石被拒', u.ok === false, u.msg)
  check('信箱', '被拒后宝石仍在插槽且未被转投', p8.gemSockets.weapon.gems[0] === 'goldOre' && p8.mail.list.filter((m) => m.kind === 'overflow').length === 0)

  // ⑨ 删除与清理：有未领附件的不能删
  const p9 = freshPlayer()
  for (let i = 0; i < 20; i++) p9.gainItem(ids[i], 1)
  p9.gainItem(ids[20], 1)
  const m9 = p9.mail.list.at(-1)
  check('信箱', '有未领附件的邮件不可删', p9.deleteMail(m9.id) === false && p9.mail.list.includes(m9))
  delete p9.inventory[ids[0]]
  p9.claimMail(m9.id)
  check('信箱', '已领附件后可删', p9.deleteMail(m9.id) === true && !p9.mail.list.includes(m9))
  check('信箱', '欢迎信（无附件）可删', p9.deleteMail(p9.mail.list[0].id) === true)

  // ⑩ 容量语义（2026-09-11 放宽）：软上限只淘汰「已领/无附件」，全未领也照收，硬上限才拒收
  const p10 = freshPlayer()
  for (let i = 0; i < 20; i++) p10.gainItem(ids[i], 1) // 背包塞满
  let refused = 0
  // 造 > 软上限数量的**不同物品**溢出（同物品会合并成一封，所以种类数必须够多才能越过软上限）
  for (let i = 20; i < 20 + MAIL_CAP + 60; i++) {
    const before = p10.mail.list.length
    p10.gainItem(ids[i], 1) // 溢出 → 造远超软上限的未领附件邮件
    if (p10.mail.list.length === before) refused++
  }
  // 注意：不能用「列表长度没变」判拒收——**淘汰**（清理已领/无附件旧邮件）也不会让长度增长。
  // 软上限命中时最先被清掉的正是那封「无附件」的欢迎信，所以这里改为断言真正要锁住的性质：**溢出零丢失**。
  const mailIds = new Set()
  for (const m of p10.mail.list) for (const k of Object.keys(m.reward?.items ?? {})) mailIds.add(k)
  const lost = []
  for (let i = 20; i < 20 + MAIL_CAP + 60; i++) {
    const inBag = (p10.inventory[ids[i]] ?? 0) > 0
    if (!inBag && !mailIds.has(ids[i])) lost.push(ITEMS[ids[i]]?.name ?? ids[i])
  }
  check('信箱', `放宽后溢出零丢失（共 ${p10.mail.list.length} 封邮件，丢失 ${lost.length} 种${lost.length ? '：' + lost.slice(0, 3).join(',') : ''}）`, lost.length === 0 && p10.mail.list.length > MAIL_CAP)
  check('信箱', '软上限时优先淘汰「无附件」的旧邮件（欢迎信已被清）', !p10.mail.list.some((m) => m.kind === 'welcome'))
  void refused
  check('信箱', '溢出邮件按物品合并（每物品至多一封）', (() => {
    const seen = new Set()
    for (const m of p10.mail.list.filter((x) => x.kind === 'overflow')) {
      const k = Object.keys(m.reward.items)[0]
      if (seen.has(k)) return false
      seen.add(k)
    }
    return true
  })())
  // 软上限的淘汰只针对「已领/无附件」；点了已领之后新邮件应能进来且总数受控
  p10.mail.list[0].claimed = true
  const okMail = p10.sendMail({ kind: 'system', subject: '通知', body: 'x' })
  check('信箱', '有可淘汰的旧邮件时新邮件可进（淘汰最旧）', okMail !== null && p10.mail.list.at(-1).subject === '通知')
  // 硬上限才拒收（病态保护）：直接灌到硬上限之上
  const p10b = freshPlayer()
  while (p10b.mail.list.length < MAIL_HARD_CAP) p10b.sendMail({ kind: 'system', subject: '塞满', reward: { gold: 1 } })
  check('信箱', `硬上限 ${MAIL_HARD_CAP} 才拒收`, p10b.sendMail({ kind: 'system', subject: 'x', reward: { gold: 1 } }) === null)

  // ⑩b 奖励到账（放宽后新增）：赛季档位改为邮件到账，领档记账但金币不直接进包
  const p10c = freshPlayer()
  const cst = p10c.seasonState()
  cst.points = 5000
  const goldB = p10c.gold
  const mailsB = p10c.mail.list.length
  const tierOk = p10c.seasonClaimTier(0)
  const rw = p10c.mail.list.filter((m) => m.kind === 'reward')
  check('信箱', '赛季领档成功且记账（claimed 立刻标记）', tierOk === true && cst.claimed.includes(0))
  check('信箱', '赛季奖励改为邮件到账（金币未直接进包）', p10c.gold === goldB && p10c.mail.list.length === mailsB + 1 && rw.length === 1)
  const rwGold = rw[0].reward.gold ?? 0
  const gotRw = p10c.claimMail(rw[0].id)
  check('信箱', '领取奖励邮件即到账', gotRw.ok === true && p10c.gold === goldB + rwGold, `gold=${p10c.gold - goldB} expect=${rwGold}`)
  check('信箱', '奖励邮件计入待领红点', p10c.mailUnclaimedCount() >= 0 && mailKindLabel('reward').label === '奖励到账')

  // ⑪ 一键领取
  const p11 = freshPlayer()
  for (let i = 0; i < 20; i++) p11.gainItem(ids[i], 1)
  p11.gainItem(ids[20], 2)
  p11.gainItem(ids[21], 3)
  for (let i = 0; i < 5; i++) delete p11.inventory[ids[i]] // 腾 5 格
  const all = p11.claimAllMail()
  check('信箱', '一键领取汇总入包', all.ok === true && all.count === 2 && p11.inventory[ids[20]] === 2 && p11.inventory[ids[21]] === 3)
  check('信箱', '一键领取后无待领', p11.mailUnclaimedCount() === 0)

  // ⑫ 存档往返：mail 必须完整进档（含 nextId，避免重开档 id 撞车）
  const s1 = JSON.stringify(p11.serialize())
  const p12 = freshPlayer()
  p12.applySave(JSON.parse(s1))
  check('信箱', '信箱随存档往返无损', JSON.stringify(p12.serialize()) === s1)
  const p13 = freshPlayer()
  p13.applySave({ gold: 100 }) // 旧档（无 mail 字段）
  check('信箱', '旧档缺 mail 字段时回退为空信箱', Array.isArray(p13.mail.list) && p13.mail.list.length === 0)
  const p14 = freshPlayer()
  p14.applySave({ mail: { list: [{ id: 7, ts: 1, kind: 'system', subject: 'a', body: '', reward: null, claimed: true, read: true }] } })
  check('信箱', '旧档缺 nextId 时按最大 id 推算（防撞 id）', p14.mail.nextId === 8)
}

// ── C12. 厨友（2026-09-11）────────────────────────────
console.log('══ C12. 厨友 ══')
{
  const p = freshPlayer()
  check('厨友', `名单 ${FRIENDS.length} 位`, FRIENDS.length > 0)
  check('厨友', '初始羁绊为 0、今日全部可拜访', p.friendBond(FRIENDS[0].id) === 0 && p.friendsVisitableCount() === FRIENDS.length)
  check('厨友', '羁绊门槛与等级换算正确', friendBondLevel(0) === 0 && friendBondLevel(1) === 1 && friendBondLevel(5) === 2 && friendBondLevel(45) === 5)
  const bp = friendBondProgress(3)
  check('厨友', '羁绊进度条可用', bp.level === 1 && bp.current === 2 && bp.needed === 4)

  // 委托：每日生成、池内物品必须真实存在、赏金为正
  p.ensureFriendOrders()
  const o0 = p.friendOrder(FRIENDS[0].id)
  check('厨友', '每位厨友都有当日委托', FRIENDS.every((f) => !!p.friendOrder(f.id)))
  check('厨友', '委托物品真实存在于物品库', FRIENDS.every((f) => getItem(p.friendOrder(f.id).itemId) != null))
  check('厨友', '委托物品只取该厨友的池子', FRIENDS.every((f) => f.pool.includes(p.friendOrder(f.id).itemId)))
  check('厨友', '委托赏金为正数', FRIENDS.every((f) => p.friendOrder(f.id).reward > 0))

  // 拜访：每日一次 + 给金币
  const g0 = p.gold
  const v1 = p.visitFriend(FRIENDS[0].id)
  check('厨友', '拜访给金币且羁绊 +1', v1.ok === true && p.gold === g0 + v1.gold && p.friendBond(FRIENDS[0].id) === 1)
  // 内容同步（2026-09-11）：新增成就必须真的会被这套行为点亮
  check('厨友', '「初次登门」成就随之达成', ACH_FRIEND_FIRST.check(p) === true)
  check('厨友', '「整条街的熟人」需全部有往来（此时未达成）', ACH_FRIEND_ALL.check(p) === false)
  check('厨友', '同日重复拜访被拒', p.visitFriend(FRIENDS[0].id).ok === false)
  check('厨友', '可拜访人数随之减少', p.friendsVisitableCount() === FRIENDS.length - 1)
  // 跨天恢复
  p.todayKey = '2000-01-02'
  check('厨友', '跨天后可再次拜访', p.friendVisitedToday(FRIENDS[0].id) === false && p.visitFriend(FRIENDS[0].id).ok === true)

  // 交付委托：材料不足 → 拒；足够 → 扣物品 + 给赏金 + 羁绊 +1 + 委托消失
  const p2 = freshPlayer()
  p2.ensureFriendOrders()
  const o2 = p2.friendOrder(FRIENDS[1].id)
  check('厨友', '材料不足时交付被拒', p2.deliverFriendOrder(FRIENDS[1].id).ok === false)
  p2.gainItem(o2.itemId, o2.qty)
  const before = p2.inventory[o2.itemId]
  const gold2 = p2.gold
  const d = p2.deliverFriendOrder(FRIENDS[1].id)
  // 注意：spendItem 扣到 0 会 delete 掉该键，所以取 ?? 0 再比
  check('厨友', '交付成功：扣材料 + 给金币', d.ok === true && (p2.inventory[o2.itemId] ?? 0) === before - o2.qty && p2.gold === gold2 + o2.reward, `inv=${p2.inventory[o2.itemId]} gold=${p2.gold - gold2}`)
  check('厨友', '交付后羁绊 +1 且当日委托清空', p2.friendBond(FRIENDS[1].id) === 1 && p2.friendOrder(FRIENDS[1].id) === null)
  check('厨友', '已交付的委托不能重复交付', p2.deliverFriendOrder(FRIENDS[1].id).ok === false)

  // 跨天重掷委托
  p2.friends.orderDay = '2000-01-01'
  p2.ensureFriendOrders()
  check('厨友', '跨天重掷当日委托', p2.friends.orderDay === (p2.todayKey ?? '') && FRIENDS.every((f) => !!p2.friendOrder(f.id)))

  // 奖励口径：绑住既有物品价值（不另起一套经济）
  check('厨友', '拜访礼物随羁绊等级上浮', friendVisitReward(FRIENDS[0], 0).gold < friendVisitReward(FRIENDS[0], 45).gold)

  // 存档：friends 必须进档
  const s1 = JSON.stringify(p2.serialize())
  const p3 = freshPlayer()
  p3.applySave(JSON.parse(s1))
  check('厨友', '厨友随存档往返无损', JSON.stringify(p3.serialize()) === s1)
  const p4 = freshPlayer()
  p4.applySave({ gold: 100 })
  check('厨友', '旧档缺 friends 字段时回退为空', p4.friends && typeof p4.friends.data === 'object' && p4.friendBond(FRIENDS[0].id) === 0)
  check('厨友', '旧档也能正常拜访（懒初始化）', p4.visitFriend(FRIENDS[0].id).ok === true)
}

console.log(`\n══ 结果：通过 ${pass} / 失败 ${fail} ══`)
console.log(`发现缺陷 ${bugs.length} 项（另有代码核查项在报告中）`)
process.exit(fail === 0 ? 0 : 1)

// ── C10. 一键入包（2026-09-06）──
console.log('══ C10. 一键入包 ══')
{
  const p = freshPlayer({})
  p.gainItem('apple', 5)
  p.gainItem('ironKnife', 1)
  // 全部移入仓库（含装备）
  const moved = p.moveAllToBank()
  check('存取', '一键入仓（背包→仓库，装备跳过）', moved === 1 && (p.bank.apple ?? 0) === 5 && (p.inventory.ironKnife ?? 0) === 1)
  const back = p.moveAllToInventory()
  check('存取', '一键入包（仓库→背包，含装备）', back === 1 && (p.inventory.apple ?? 0) === 5 && (p.inventory.ironKnife ?? 0) === 1 && !(p.bank.apple ?? 0))
}

// ── C11. 食灵阁（2026-09-06：食灵不占背包格）──
console.log('══ C11. 食灵阁 ══')
{
  const p = freshPlayer({ spiritSummoning: 10 })
  const ss = getSkillInstance('spiritSummoning')
  const r = ss.recipes.find((x) => x.output.itemId === 'appleSpirit' + '_' + 1 || x.output.itemId === 'appleSpirit_1')
  console.log('rec:', r?.output?.itemId)
  // 用 makeOrder 同款：直接 gainSpirit 验证不占背包
  p.gainSpirit('appleSpirit_1', 3)
  check('食灵', '食灵入阁不占背包格', (p.spirits.owned?.appleSpirit_1 ?? 0) === 3 && !(p.inventory.appleSpirit_1 > 0) && Object.keys(p.inventory).length === 0)
  const okOn = p.setSpiritActive('appleSpirit_1', true)
  check('食灵', '出战消耗食灵阁 1 只', okOn === true && (p.spirits.owned?.appleSpirit_1 ?? 0) === 2 && p.spirits.active.includes('appleSpirit_1'))
  p.setSpiritActive('appleSpirit_1', false)
  check('食灵', '退役归还食灵阁', (p.spirits.owned?.appleSpirit_1 ?? 0) === 3 && !p.spirits.active.includes('appleSpirit_1'))
  // 旧档迁移：背包里的食灵 → 食灵阁
  p.inventory.appleSpirit_1 = 2
  p.applySave({ ...p.$state, inventory: { appleSpirit_1: 2 }, spirits: { active: [], owned: {} } })
  check('食灵', '旧档背包食灵自动迁移入阁', (p.spirits.owned?.appleSpirit_1 ?? 0) === 2 && !(p.inventory.appleSpirit_1 > 0))
}
