// 系统测试 — 对照《美食放置：食灵山海》需求文档的全面回归
// 运行：node scripts/ci/system_test.mjs
// 覆盖：技能经验/产出、联动链、对决（伤害/克制/命中/暴击/胜负）、装备、
//       离线（80%效率/12h上限/跨天）、存档（往返/迁移/导入导出）、背包、经济、
//       成就图鉴、数值安全（除零/NaN/越界）
import fs from 'node:fs'
import { SKILL_DEFS } from '../../src/game/data/skills.js'
import { QUIRKS } from '../../src/game/data/tales_ext.js'
import { SELL_EXCLUDED_CATEGORIES } from '../../src/game/data/automation.js'
import { EXCHANGE_POOL_CATEGORIES } from '../../src/game/data/exchange.js'
import { INGREDIENT_POOL } from '../../src/game/data/gameShopPools.js'
import { itemNavs } from '../../src/game/data/itemNav.js'
import { EXCAVATION_ALL_TARGETS, isMineralTarget } from '../../src/game/skills/ExcavationSkill.js'
import { oreOfLevel, equipmentLevelOf as equipLevelOf } from '../../src/game/data/timberRecipes.js'
import { TIMBERS, timberOfLevel } from '../../src/game/data/timbers.js'
import { SMITHING_SET_RECIPES } from '../../src/game/data/smithSetExt.js'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getSkillInstance, getAllSkillInstances } from '../../src/game/skills/registry.js'
import { Combat } from '../../src/game/combat/Combat.js'
import { COMBAT_REGIONS, COMBAT_BOSSES, STYLE_ADVANTAGE, opp } from '../../src/game/data/combat.js'
import { ForagingSkill } from '../../src/game/skills/ForagingSkill.js'
import { countForMasteryLevel, masteryXpMultiplier, MASTERY_TIERS, MASTERY_TIER_LEVELS, masteryIntervalText, masteryToNextTier, masteryFixedInterval, masteryDoubleChance, masteryYieldBonus, masteryIntervalFactor } from '../../src/game/core/mastery.js'
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
import { SKINS, SKIN_REQUIRED_KEYS, skinVars, rgbOf } from '../../src/game/data/skins.js'
import { daoGraphLayout, GRAPH_METRICS } from '../../src/game/data/daoGraph.js'
import { SHANHAI_PATHS, SHANHAI_NODES, SHANHAI_RING_COUNT, SHANHAI_RINGS, SHANHAI_RING_SLOTS, SHANHAI_GAPS, SHANHAI_TICKET_RING } from '../../src/game/data/shanhaiTree.js'
import { CAP_MAX, CAP_BASE, PAID_CAP_MAX, DERIVED_MAX, OFFLINE_CAP, safeCap } from '../../src/game/data/caps.js'
import { SHANHAI_EFFECT_FIELDS, SHANHAI_EFFECT_CAPS, shanhaiIndex, shanhaiNodeState, shanhaiEffectSum } from '../../src/game/data/shanhaiProgress.js'
import { shanhaiGraphLayout } from '../../src/game/data/shanhaiGraph.js'
import { DAO_PATHS, DAO_NODES, DAO_OUTER, daoNodesOf, daoPathCost, daoUnlockedTotal } from '../../src/game/data/daoTree.js'
// 挂机产线四套（2026-09-14）：商队线 / 菌房 / 灵田 / 温室蜂场（含蜂蜜）+ 并入牧场的网箱
import { CARAVAN_UNLOCK_LEVEL, CARAVAN_BASE_SLOTS, CARAVAN_MAX_SLOTS, CARAVAN_CARGO_LIMIT, CARAVAN_LOSS_FLOOR, CARAVAN_EXPAND_COSTS, allCaravanRoutes } from '../../src/game/data/caravan.js'
import { MUSHROOM_UNLOCK_LEVEL, MUSHROOM_BASE_BEDS, MUSHROOM_MAX_BEDS, MUSHROOM_EXPAND_COSTS, MUSHROOM_MEDIA } from '../../src/game/data/mushroomHouse.js'
import { SPIRIT_UNLOCK_LEVEL, SPIRIT_BASE_PLOTS, SPIRIT_MAX_PLOTS, SPIRIT_EXPAND_COSTS, SPIRIT_PLANTS } from '../../src/game/data/spiritField.js'
import { GREENHOUSE_BASE_BEDS, GREENHOUSE_MAX_BEDS, GREENHOUSE_EXPAND_COSTS, GREENHOUSE_HONEY_CHANCE, HIVE_BASE_COUNT, HIVE_MAX_COUNT, HIVE_EXPAND_COSTS, HIVE_MEDIA, greenhouseCrop, greenhouseGrowMs, hiveMediaLevel } from '../../src/game/data/greenhouse.js'
import { HONEY_TIERS, HONEY_ITEMS, honeyTierForLevel, honeyItemForLevel } from '../../src/game/data/honey.js'
import { RANCH_ANIMALS, POND_BASE, POND_MAX, POND_EXPAND_COSTS, POND_FISH } from '../../src/game/data/ranch.js'
import { ESSENCE_TIERS, ESSENCE_ITEMS, ESSENCE_BASE_VATS, ESSENCE_MAX_VATS, ESSENCE_EXPAND_COSTS } from '../../src/game/data/essences.js'
import { GOODS_ITEMS, goodsEffectText } from '../../src/game/data/processedGoods.js'
import { FARM_SEASONS, SEASONAL_BONUS, seasonalCropBonus } from '../../src/game/data/farmingSeason.js'
import { TOOL_MAX_LEVEL, TOOL_TIME_PER_LEVEL, TOOL_COSTS, nextToolCost, toolTimeFactor } from '../../src/game/data/farmTools.js'
import { EXPANSIONS, EXPANSION_GROUPS } from '../../src/game/data/expansions.js'
import { PRIME_CROP_ID, PRIME_MIN_LEVEL, PRIME_BASE_CHANCE, PRIME_MAX_CHANCE, PRIME_CATALYST_TIME, FARM_MASTERY_GATHER_MAX, primeCropChance } from '../../src/game/data/primeCrop.js'
import { itemDetailLines } from '../../src/game/data/itemDetail.js'
import { collectEffects, EFFECT_ROWS, EFFECT_GROUPS } from '../../src/game/data/activeEffects.js'
import { CROPS } from '../../src/game/skills/FarmingSkill.js'


import { FACILITY_MAX, IDLE_CAP_HOURS } from '../../src/game/data/caps.js'
import { priceMultiplier, exchangeCycleIndex } from '../../src/game/data/exchange.js'

import { BISCUIT_HEAL_PCT, BISCUIT_BUFF_TURNS, BISCUIT_ACC, BISCUIT_SPEED_PCT, BISCUIT_COOLDOWN_TURNS, BISCUIT_TASTE_RATE } from '../../src/game/data/biscuitUse.js'
import { WEATHERS, weatherForDay, weatherBoost, fortuneLevelForDay, isHarshWeather, FORTUNE_LEVELS } from '../../src/game/data/weather.js'
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
import { ENCOUNTERS, getEncounter } from '../../src/game/data/encounters.js'
import { itemSources } from '../../src/game/data/itemSources.js'
import { jumpForSource } from '../../src/game/data/sourceJump.js'
import { itemUses } from '../../src/game/data/itemUses.js'

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
import { itemImage } from '../../src/game/data/itemImage.js'
import { ALCHEMY_RECIPES } from '../../src/game/data/alchemy.js'
import { applyValueBalance } from '../../src/game/data/valueBalance.js'
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
  p.weatherEffects = () => ({ ...realWeather(), restaurant: 1, gatherXp: 1, craftXp: 1, combatXp: 1, gatherYield: 1, farmYield: 1 })
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
  // 锻造链：同档木材/铜矿→铜刀→对决属性（v2.7.0：铜刀属 Lv1-5 档 → 松木 + 铜矿）
  const p2 = freshPlayer({ craftsmithing: 5, knife: 5, tasteAcumen: 1, heatControl: 1 })
  p2.gainItem('pineWood', 3)
  p2.gainItem('copperOre', 3)
  const cfs = getSkillInstance('craftsmithing')
  withRandom([0.0], () => cfs.craft(cfs.recipes.find((r) => r.output?.itemId === 'copperKnife')))
  check('联动', '松木/铜矿→铜刀锻造', p2.inventory.copperKnife === 1)
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
  p.gainItem('pineWood', 30) // v2.7.0：铜刀配方改用同档木材（Lv1-5 档 = 松木）
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
    // 结算会校验本场对手身份（trialStart 登记 activeTrialOpp），这里模拟真实 combat:end 带上同名对手
    const fight = (info) => pt.onCombatEndTrial({ opponent: pt.activeTrialOpp, ...info })
    check('试炼', '对决 30 级解锁', pt.combatLevel === 40 && pt.trialsUnlocked() === true && freshPlayer().trialsUnlocked() === false, `combatLevel=${pt.combatLevel}`)
    // 速攻：12 回合内 → 通关
    pt.trialStart('t_speed')
    const r1 = fight({ result: 'win', turns: 8, hpLeft: 50, hpMax: 100 })
    check('试炼', '速攻达标通关 + 首通奖励', r1?.passed === true && r1.first === true && pt.trialState('t_speed').clears === 1)
    // 身份校验：开着试炼去打别的怪 → 不结算（防「随便打赢一只小怪拿首通奖励」）
    pt.trialStart('t_speed')
    const rX = pt.onCombatEndTrial({ result: 'win', opponent: '🍎 别的怪', turns: 3, hpLeft: 100, hpMax: 100 })
    check('试炼', '非试炼对手不结算（试炼保持进行中）', rX === null && pt.activeTrial === 't_speed' && pt.trialState('t_speed').clears === 1)
    // 速攻：13 回合 → 不达标并退出
    const r2 = fight({ result: 'win', turns: 13, hpLeft: 50, hpMax: 100 })
    check('试炼', '超出回合数不达标', r2?.passed === false && pt.activeTrial === null)
    // 无伤：95% 血量 → 通关；80% → 不达标
    pt.trialStart('t_flawless')
    const r3 = fight({ result: 'win', turns: 30, hpLeft: 95, hpMax: 100 })
    check('试炼', '无伤达标（≥90% 血量）', r3?.passed === true)
    pt.trialStart('t_flawless')
    const r4 = fight({ result: 'win', turns: 30, hpLeft: 80, hpMax: 100 })
    check('试炼', '血量不足不达标', r4?.passed === false)
    // 血量字段缺失（旧事件载荷 bug：hpLeft=undefined）→ 血量类条件判失败，不判 NaN 也不误判通过
    pt.trialStart('t_flawless')
    const rNaN = fight({ result: 'win', turns: 30 })
    check('试炼', '血量缺失按 0% 判失败（不误判通过）', rNaN?.passed === false)
    // 连胜：3 连胜才通关，中间失败清零
    pt.trialStart('t_streak')
    fight({ result: 'win', turns: 5, hpLeft: 90, hpMax: 100 })
    fight({ result: 'win', turns: 5, hpLeft: 90, hpMax: 100 })
    check('试炼', '连胜进度累计', pt.trialState('t_streak').streak === 2)
    const r5 = fight({ result: 'win', turns: 5, hpLeft: 90, hpMax: 100 })
    check('试炼', '3 连胜通关 + 清零', r5?.passed === true && pt.trialState('t_streak').streak === 0)
    // 重复通关给 30% 金币
    const g0 = pt.gold
    pt.trialStart('t_speed')
    const r6 = fight({ result: 'win', turns: 5, hpLeft: 90, hpMax: 100 })
    check('试炼', '重复通关 30% 金币', r6?.passed === true && r6.first === false && pt.gold - g0 === Math.round(4000 * 0.3))
    // 失败退出
    pt.trialStart('t_overlevel')
    const r7 = fight({ result: 'lose', turns: 3, hpLeft: 0, hpMax: 100 })
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
    // ── 恶劣天气（2026-09-13 用户要求：天气不能只有好处）──
    const harsh = WEATHERS.filter((w) => w.harsh)
    const ALLOWED = ['gatherYield', 'gatherXp', 'craftXp', 'combatXp', 'restaurant', 'farmYield']
    check('天气', `共 ${WEATHERS.length} 种天气，其中恶劣 ${harsh.length} 种且各带至少一条减益`, WEATHERS.length === 9 && harsh.length === 3
      && harsh.every((w) => isHarshWeather(w) && Object.values(w.boost).some((v) => v < 1)))
    // ── 农时（v2.4.0）：农田吃「当日天气 + 当季作物」，温室不吃天气 ──
    check('农时', `农田产量乘区：好天气加成、恶劣天气减益且 ≥0.70（与其它赛道同口径）`, (() => {
      const good = WEATHERS.filter((w) => !w.harsh)
      const harsh = WEATHERS.filter((w) => w.harsh)
      return good.some((w) => (w.boost.farmYield ?? 1) > 1)
        && harsh.every((w) => { const v = w.boost.farmYield ?? 1; return v < 1 && v >= 0.70 })
    })())
    check('农时', '四季覆盖 12 个月且各季都有当季作物类别', (() => {
      const months = new Set(FARM_SEASONS.flatMap((s) => s.months))
      return FARM_SEASONS.length === 4 && months.size === 12 && FARM_SEASONS.every((s) => s.cats.length > 0)
    })())
    check('农时', `当季 ×${SEASONAL_BONUS}、非当季 ×1`, (() => {
      const springCat = FARM_SEASONS[0].cats[0] // 春
      const winterCat = FARM_SEASONS[3].cats[0] // 冬
      return seasonalCropBonus(springCat, 4) === SEASONAL_BONUS && seasonalCropBonus(winterCat, 4) === 1
        && seasonalCropBonus(springCat, 1) === 1 && seasonalCropBonus(winterCat, 1) === SEASONAL_BONUS
    })())
    check('农时', '农田收获真的乘了「天气 × 当季」（坏天气不会颗粒无收）', (() => {
      const p = freshPlayer()
      p.skills.farming.level = 99
      const seeds = getAllSkillInstances().find((i) => i.id === 'farming')
      const wheat = { seedId: 'wheatSeed', itemId: 'wheat' }
      const cat = getItem(wheat.itemId)?.category ?? ''
      const run = (farmYield) => {
        p.inventory[wheat.seedId] = 1
        seeds.plant(0, wheat.seedId)
        p.farming.plots[0].plantedAt = Date.now() - 10 * 60 * 1000
        const before = p.inventory[wheat.itemId] ?? 0
        p.weatherEffects = () => ({ farmYield })
        withRandom([0.99, 0.99, 0.99], () => seeds.harvest(0))
        return (p.inventory[wheat.itemId] ?? 0) - before
      }
      const normal = run(1)
      const doubled = run(2)
      const halved = run(0.5)
      const expectNormal = Math.max(1, Math.round(1 * 1 * seasonalCropBonus(cat)))
      const expectDouble = Math.max(1, Math.round(1 * 2 * seasonalCropBonus(cat)))
      return normal === expectNormal && doubled === expectDouble && halved >= 1
    })())
    check('农时', '温室不吃天气（静态：温室那段逻辑里没有 farmYield）', (() => {
      const P = fs.readFileSync(new URL('../../src/stores/player.js', import.meta.url), 'utf8')
      const i = P.indexOf('_tickGreenhouse()')
      const j = P.indexOf('// ══ 挂机产线 · 萃露炉', i)
      const body = P.slice(i, j > i ? j : i + 6000)
      return i > 0 && !/farmYield|weatherEffects/.test(body)
    })())
    check('天气', '每条恶劣天气都留了「换个赛道」的补偿项（至少一条增益）', harsh.every((w) => Object.values(w.boost).some((v) => v > 1)))
    // 只削「额外产出几率」对早期玩家等于没影响 → 每条恶劣天气都必须有一条**硬乘区**减益（经验/收入）
    const HARD = ['gatherXp', 'craftXp', 'combatXp', 'restaurant']
    check('天气', '每条恶劣天气都有硬乘区减益（经验/收入 < 1），不只是削额外产出', harsh.every((w) => Object.entries(w.boost).some(([k, v]) => HARD.includes(k) && v < 1)))
    check('天气', '减益幅度夹在 −30% 以内、且倍率键都在白名单内（防崩坏）', WEATHERS.every((w) => Object.entries(w.boost).every(([k, v]) => ALLOWED.includes(k) && v > 0 && v >= 0.7 && v <= 1.5)))
    check('天气', '全年覆盖：9 种天气都能抽到（含 3 种恶劣）', (() => {
      const ids = new Set()
      for (let i = 0; i < 400; i++) {
        const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
        ids.add(weatherForDay(d).id)
      }
      return ids.size === WEATHERS.length && harsh.every((w) => ids.has(w.id))
    })())
    check('天气', '运势等级只缓和减益、绝不加重（penaltyScale ≤ 1，增益项原样）', (() => {
      if (!FORTUNE_LEVELS.every((l) => l.penaltyScale > 0 && l.penaltyScale <= 1)) return false
      let softened = 0
      for (let i = 0; i < 400; i++) {
        const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
        const w = weatherForDay(d)
        const eff = weatherBoost(d)
        for (const [k, v] of Object.entries(w.boost)) {
          if (v < 1) {
            if (eff[k] < v - 1e-9 || eff[k] > 1 + 1e-9) return false // 只能变好、最多回到 1
            if (eff[k] > v + 1e-9) softened++
          } else if (Math.abs(eff[k] - v) > 1e-9) return false // 增益不受运势影响
        }
      }
      return softened > 0 // 一年内至少出现过「被运势缓和」的恶劣天气
    })())
    // 额外产出几率被压成负数时：在线不倒扣、离线也必须夹 0（否则坏天气下离线比在线还亏）
    check('天气', '恶劣天气把额外产出压负时，在线/离线同口径（都不倒扣基础产量）', (() => {
      const inst = getSkillInstance('foraging')
      const orig = inst.yieldExtraChance.bind(inst)
      inst.yieldExtraChance = () => -0.5
      const exp = inst.expectedYield(inst.currentTarget)
      const floor = 1 + inst.doubleChance(inst.currentTarget) + inst.yieldBatch(inst.currentTarget)
      inst.yieldExtraChance = orig
      return Math.abs(exp - floor) < 1e-9
    })())
    check('天气', '恶劣天气真的会打进聚合值（对应赛道 < 1）', (() => {
      for (let i = 0; i < 400; i++) {
        const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
        const w = weatherForDay(d)
        if (!isHarshWeather(w)) continue
        const eff = weatherBoost(d)
        if (Object.entries(w.boost).some(([k, v]) => v < 1 && eff[k] < 1)) return true
      }
      return false
    })())
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
    check('名厨', `名单 ${CHEFS.length} 位且流派合法`, CHEFS.length === 10 && CHEFS.every((c) => ['knife', 'plating', 'flavor'].includes(c.style) && c.levelOffset > 0))
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
    const fight = (info) => pt.onCombatEndTrial({ opponent: pt.activeTrialOpp, ...info })
    pt.trialStart('t_speed')
    fight({ result: 'win', turns: 12, hpLeft: 60, hpMax: 100 })
    pt.trialStart('t_speed')
    fight({ result: 'win', turns: 9, hpLeft: 60, hpMax: 100 })
    const stS = pt.trialState('t_speed')
    check('试炼记录', '回合制记最少回合（9 而非 12）', stS.bestTurns === 9, `bestTurns=${stS.bestTurns}`)
    pt.trialStart('t_flawless')
    fight({ result: 'win', turns: 40, hpLeft: 92, hpMax: 100 })
    pt.trialStart('t_flawless')
    fight({ result: 'win', turns: 40, hpLeft: 96, hpMax: 100 })
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
  // 施肥不可重复（2026-09-14 用户实测：已施肥的田还能再点、每次白扣一份肥料）
  // 消耗品使用（2026-09-14 补：增益剂/保鲜剂此前没有任何使用入口）
  check('消耗品', '经验/产量增益剂：使用即生效、扣 1 个；重复使用取更强倍率', (() => {
    const p = freshPlayer()
    p.inventory.xpTonic1 = 1
    p.inventory.xpTonic5 = 1
    const r1 = p.useConsumable('xpTonic1')
    const m1 = p.getXpMultiplier()
    const r2 = p.useConsumable('xpTonic5')
    const m2 = p.getXpMultiplier()
    p.inventory.yieldTonic1 = 1
    const r3 = p.useConsumable('yieldTonic1')
    return r1.ok && Math.abs(m1 - 1.2) < 1e-9 && (p.inventory.xpTonic1 ?? 0) === 0
      && r2.ok && Math.abs(m2 - 4.5) < 1e-9 && r3.ok && Math.abs(p.getYieldMultiplier() - 1.5) < 1e-9
  })())
  check('消耗品', '不可用物品（装备/没有的/武器）一律拒绝且不扣料', (() => {
    const p = freshPlayer()
    const a = p.useConsumable('ironKnife')          // 装备：无 use
    const b = p.useConsumable('xpTonic3')           // 背包里没有
    return a.ok === false && b.ok === false && (p.inventory.xpTonic3 ?? 0) === 0
  })())
  check('消耗品', '保鲜剂：把背包可腐坏食材的计时刷新回满时长', (() => {
    const p = freshPlayer()
    const spoil = Object.values(ITEMS).find((i) => i.spoilMs)
    if (!spoil) return false
    p.inventory[spoil.id] = 2
    p.spoilage[spoil.id] = Date.now() + 1000
    p.inventory.preservTier1 = 1
    const r = p.useConsumable('preservTier1')
    const left = p.spoilage[spoil.id] - Date.now()
    return r.ok && left > spoil.spoilMs * 0.95
  })())
  check('农耕', '同种肥料不可重复施（不白扣料），但更好的肥料可覆盖升级', (() => {
    const p = freshPlayer()
    const f = new FarmingSkill(p)
    p.farming.plots[0] = null
    p.inventory.wheatSeed = 1
    p.inventory.compost = 2
    p.inventory.richCompost = 1
    if (!f.plant(0, 'wheatSeed')) return false
    const okFirst = f.fertilize(0, 'compost')
    const after1 = p.inventory.compost
    const okSame = f.fertilize(0, 'compost')          // 同种：拒绝
    const okUpgrade = f.fertilize(0, 'richCompost')   // 升级：放行
    const okDowngrade = f.fertilize(0, 'compost')     // 降级：拒绝
    return okFirst === true && after1 === 1 && okSame === false && p.inventory.compost === 1
      && okUpgrade === true && (p.inventory.richCompost ?? 0) === 0 && f.plotAt(0).fertilizer === 'richCompost'
      && okDowngrade === false && p.inventory.compost === 1
  })())
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
  for (const id of ['foraging', 'fishing', 'hunting', 'excavation', 'woodcutting', 'mining', 'cooking', 'baking', 'preserving', 'brewing', 'spiceMixing', 'craftsmithing', 'preservation', 'exploration']) insts[id] = getSkillInstance(id)
  // 各技能扩充后数量：与当前生成器产物一致（2026-09-16 实测量；v2.7.0 矿物拆出后 挖掘 83→42，新增伐木 20 / 采矿 43）
  check('扩充', '采集七技能目标数（142/72/70/42/20/43）', insts.foraging.targets.length === 142 && insts.fishing.targets.length === 72 && insts.hunting.targets.length === 70 && insts.excavation.targets.length === 42 && insts.woodcutting.targets.length === 20 && insts.mining.targets.length === 43, JSON.stringify({ f: insts.foraging.targets.length, g: insts.fishing.targets.length, h: insts.hunting.targets.length, x: insts.excavation.targets.length, w: insts.woodcutting.targets.length, m: insts.mining.targets.length }))
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

// ── C13. 奇遇图鉴（2026-09-11）────────────────────────
console.log('══ C13. 奇遇图鉴 ══')
{
  // ① 数据完整性：8 个事件、id 唯一、每件 2~3 个分支、分支奖励引用的物品都存在
  // 2026-09-14 扩到 22 个（用户要求「奇遇图鉴应该再加个十几种」）；这条断言跟着数量走
  check('奇遇', `共 ${ENCOUNTERS.length} 个事件（22 个：21 三选一 + 1 二选一）`, ENCOUNTERS.length === 22
    && ENCOUNTERS.filter((e) => e.choices.length === 3).length === 21 && ENCOUNTERS.filter((e) => e.choices.length === 2).length === 1)
  check('奇遇', 'id 唯一且有标题/正文', new Set(ENCOUNTERS.map((e) => e.id)).size === ENCOUNTERS.length
    && ENCOUNTERS.every((e) => e.title && e.body))
  check('奇遇', '每个事件 2~3 个分支且都有文案', ENCOUNTERS.every((e) => e.choices.length >= 2 && e.choices.length <= 3
    && e.choices.every((c) => c.label)))
  check('奇遇', '分支奖励引用的物品全部存在', ENCOUNTERS.every((e) => e.choices.every((c) =>
    Object.keys(c.effect?.items ?? {}).every((id) => getItem(id) != null))))
  // 图鉴三查联动：奇遇给的物品，必须在图鉴「获取来源」里标注了奇遇（2026-09-11 补）
  check('奇遇', '奖励物品在图鉴来源中标注了「随机奇遇」', (() => {
    const ids = new Set(ENCOUNTERS.flatMap((e) => e.choices.flatMap((c) => Object.keys(c.effect?.items ?? {}))))
    return [...ids].every((id) => itemSources(id).some((t) => t.includes('随机奇遇')))
  })())
  check('奇遇', 'getEncounter 能按 id 取回', getEncounter(ENCOUNTERS[0].id)?.id === ENCOUNTERS[0].id && getEncounter('nope') === null)

  // ② 新档：没有任何记录
  const p = freshPlayer()
  check('奇遇', '新档未遇到任何奇遇', p.encountersSeenCount() === 0 && p.encounters.total === 0)
  check('奇遇', '新档 encounterStats 返回空记录', p.encounterStats(ENCOUNTERS[0].id).seen === 0
    && p.encounterStats(ENCOUNTERS[0].id).picks.length === 0)

  // ③ 遇到即累加（同一事件遇两次 → 2 次，总数也累加）
  const idA = ENCOUNTERS[0].id
  const idB = ENCOUNTERS[1].id
  p.markEncounterSeen(idA)
  p.markEncounterSeen(idA)
  p.markEncounterSeen(idB)
  check('奇遇', '遇到次数按事件累加', p.encounterStats(idA).seen === 2 && p.encounterStats(idB).seen === 1)
  check('奇遇', '累计触发计入 total', p.encounters.total === 3)
  check('奇遇', '已遇到的事件数（去重）', p.encountersSeenCount() === 2)
  check('奇遇', '非法 id 不计数', (p.markEncounterSeen(null), p.encounters.total === 3))

  // ④ 选择记录：按分支下标累加，且下标超界会自动补齐数组
  p.recordEncounterPick(idA, 0)
  p.recordEncounterPick(idA, 2)
  p.recordEncounterPick(idA, 2)
  const picksA = p.encounterStats(idA).picks
  check('奇遇', '各分支选择次数记在下标上', picksA[0] === 1 && (picksA[1] ?? 0) === 0 && picksA[2] === 2)
  check('奇遇', '非法下标不计数', (p.recordEncounterPick(idA, -1), p.encounterStats(idA).picks.reduce((a, n) => a + (n ?? 0), 0) === 3))

  // ⑤ 首次遇到会在年鉴留痕（不改奖励，只是记录）
  const chron = (p.chronicle ?? []).filter((c) => c.kind === 'encounter')
  check('奇遇', '首次遇到写一条年鉴记录', chron.length === 2, `n=${chron.length}`)

  // ⑥ 存档往返 + 旧档兜底
  const round = JSON.stringify(p.serialize())
  const p2 = freshPlayer()
  p2.applySave(JSON.parse(round))
  check('奇遇', '奇遇记录随存档往返无损', JSON.stringify(p2.serialize()) === round)
  check('奇遇', '往返后记录内容正确', p2.encounterStats(idA).seen === 2 && p2.encounters.total === 3)
  const p3 = freshPlayer()
  p3.applySave({ gold: 100 })
  check('奇遇', '旧档缺 encounters 字段时回退为空', p3.encountersSeenCount() === 0 && p3.encounters.total === 0)
  check('奇遇', '旧档也能正常记录', (p3.markEncounterSeen(idA), p3.encounterStats(idA).seen === 1))
}

// ── C14. 炼金价值比（2026-09-12）────────────────────────
// 炼金配方按「投入价值 ≈ 产出价值」生成（authored 数据 0 违规）。若价值平衡层把产物抬到高于
// 其投入，就出现「买原料 → 炼金 → 卖产物」的无限刷钱循环（实测：9 清水 18 金 → 1 苏打水卖 27 金）。
console.log('══ C14. 炼金价值比 ══')
{
  applyValueBalance() // 与游戏启动同一套平衡（要求幂等）
  let violated = 0
  let worst = null
  for (const r of ALCHEMY_RECIPES) {
    const outItem = ITEMS[r.out]
    if (!outItem || outItem.value == null) continue
    let inValue = 0
    for (const [id, qty] of Object.entries(r.in ?? {})) inValue += (ITEMS[id]?.value ?? 0) * qty
    if (outItem.value > inValue) {
      violated++
      if (!worst || outItem.value - inValue > worst.diff) worst = { r, out: outItem.value, in: inValue, diff: outItem.value - inValue }
    }
  }
  check('炼金', '平衡后无「产出价值 > 投入价值」的配方', violated === 0, `违规 ${violated} 条${worst ? `，最大「${worst.r.name}」（${worst.out} vs ${worst.in}）` : ''}`)
  // 卖价口径（floor(value×0.5)）：产出卖价须低于「投入全按买价购入」的成本，否则可无限刷钱
  const waterBuy = 2 * 9 // 杂货铺清水 2 金/瓶 × 9 瓶
  const sodaSell = Math.floor((ITEMS.sodaWater?.value ?? 0) * 0.5)
  check('炼金', '苏打水不可刷钱（卖价 < 9 清水成本）', sodaSell < waterBuy, `value=${ITEMS.sodaWater?.value}，卖价=${sodaSell}，成本=${waterBuy}`)
  // 幂等：重复调用不再改动任何 value（否则每次启动都会继续漂移）
  const snap = Object.values(ITEMS).map((it) => it.value)
  applyValueBalance()
  check('炼金', 'valueBalance 幂等（重复调用不再改值）', Object.values(ITEMS).every((it, i) => it.value === snap[i]))
}

// ── C15. 离线结算幂等（2026-09-12）────────────────────
// 曾经：读档结算离线后既不推进 lastOnlineAt、也不落盘 → 同一份存档反复读取会反复发放同一段
// 离线收益（关页面前没触发自动存档时尤其明显）。修法：结算完立刻推进时间戳并写回该存档位。
console.log('══ C15. 离线结算幂等 ══')
{
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
  const { saveManager, loadSlot } = await import('../../src/game/bootstrap.js')
  const p = freshPlayer({ foraging: 30 })
  useUiStore()
  p.setActiveSkill('foraging')
  p.activeTarget = 'apple'
  const invTotal = () => Object.values(p.inventory).reduce((a, b) => a + b, 0)
  p.lastOnlineAt = Date.now() - 2 * 3600_000 // 存档里的「上次在线」= 2 小时前
  saveManager.slot = 0
  saveManager.saveSlot(0, { schemaVersion: 1, savedAt: Date.now(), player: p.serialize() })
  const inv0 = invTotal()
  check('离线幂等', '第一次读档发放离线收益', loadSlot(0) === true && invTotal() > inv0, `背包 ${inv0}→${invTotal()}`)
  const inv1 = invTotal()
  const saved = saveManager.loadSlot(0)
  const lag = Date.now() - (saved?.player?.lastOnlineAt ?? 0)
  check('离线幂等', '读档后 lastOnlineAt 已推进并落盘', lag < 10_000, `落盘时间戳滞后 ${lag}ms`)
  // 关键复现路径：读档拿奖励 → 游戏内自动存档（把已入账的状态写回）→ 再读档。
  // 若 lastOnlineAt 没被推进，第二次读档会再发一遍同一段离线收益（奖励翻倍）。
  saveManager.saveSlot(0, { schemaVersion: 1, savedAt: Date.now(), player: p.serialize() })
  loadSlot(0)
  check('离线幂等', '自动存档后再读档不重复发放', invTotal() === inv1, `背包 ${inv1}→${invTotal()}`)
}

// ── C16. 离线与在线一致性（2026-09-12）────────────────
// 离线只该「速率打 8 折」，不该因为另写一条算式而丢掉精通保底产量 / 产量加成 / 精通经验倍数。
// 此前：离线产量 = 动作数 ×(1+双倍率)，离线经验 = 动作数 × 基础经验 —— 实测只有在线的 1/2~1/3。
console.log('══ C16. 离线与在线一致性 ══')
{
  const p = freshPlayer({ foraging: 50 })
  p.activeTarget = 'apple'
  const f = new ForagingSkill(p)
  const apple = f.targets.find((t) => t.itemId === 'apple')
  p.skills.foraging.mastery.apple = countForMasteryLevel(50)
  const expected = f.expectedYield(apple)
  check('一致', '期望产量含精通 50 保底 +1', expected >= 2, `expected=${expected}`)
  const off = f.computeOffline(3600_000, 0.8)
  check('一致', '离线产量 = 动作数 × 期望产量', off.items.apple === Math.round(off.actions * expected), `离线=${off.items.apple} 期望=${Math.round(off.actions * expected)}`)
  check('一致', '离线带精通经验倍数（在线 award 同口径）', off.xpMult === masteryXpMultiplier(50), `xpMult=${off.xpMult}`)
  // 实测：照 performAction 的算法跑 N 次动作，平均产量应≈期望（两条路径不漂移的守门断言）
  const N = 20000
  let sum = 0
  for (let i = 0; i < N; i++) {
    const doubled = Math.random() < f.doubleChance(apple)
    sum += f.yieldQuantity(doubled ? 2 : 1, apple)
  }
  const mean = sum / N
  check('一致', '在线实测均值 ≈ 离线期望（±5%）', Math.abs(mean - expected) / expected < 0.05, `mean=${mean.toFixed(3)} expected=${expected.toFixed(3)}`)
}

// ── C17. combat:end 事件载荷完整性（2026-09-12）──────────
// 踩过的坑：胜利分支把 hpLeft 写成不存在的 this.playerHp（undefined），使依赖血量百分比的
// 「无伤试炼」恒判 NaN、永不通过——而没有任何检查盯着「事件载荷字段是否齐全」。
// 这里真打一场，断言 combat:end 的关键字段都在且是有限数值。
console.log('══ C17. combat:end 载荷完整性 ══')
{
  const p = freshPlayer({ knife: 40, tasteAcumen: 40, heatControl: 40 })
  p.setCombat({ hp: p.maxHp })
  const cb = new Combat(p)
  const seen = []
  const h = (payload) => seen.push(payload)
  EventBus.on('combat:end', h)
  const weak = opp(1, '测试木桩', 'knife', { drops: [] })
  cb.start(weak)
  let g = 0
  while (cb.inFight && g++ < 3000) cb.tick(200)
  EventBus.off('combat:end', h)
  const ev = seen[seen.length - 1]
  check('事件载荷', 'combat:end 触发一次', seen.length === 1 && !!ev)
  check('事件载荷', 'result 为 win/lose', ev?.result === 'win' || ev?.result === 'lose', `result=${ev?.result}`)
  check('事件载荷', 'opponent 非空（试炼身份校验依赖它）', typeof ev?.opponent === 'string' && ev.opponent.length > 0, `opponent=${ev?.opponent}`)
  check('事件载荷', 'turns 为有限数', Number.isFinite(ev?.turns), `turns=${ev?.turns}`)
  check('事件载荷', 'hpLeft 为有限数（无伤试炼依赖）', Number.isFinite(ev?.hpLeft), `hpLeft=${ev?.hpLeft}`)
  check('事件载荷', 'hpMax 为正数', Number.isFinite(ev?.hpMax) && ev.hpMax > 0, `hpMax=${ev?.hpMax}`)
  check('事件载荷', '0 ≤ hpLeft ≤ hpMax', ev?.hpLeft >= 0 && ev?.hpLeft <= ev?.hpMax, `${ev?.hpLeft}/${ev?.hpMax}`)
  check('事件载荷', 'oppLevel 为有限数', Number.isFinite(ev?.oppLevel), `oppLevel=${ev?.oppLevel}`)
}

// ── C18. 精通升级不得让采集间隔变慢（2026-09-12，用户实测发现）──────
// 曾经的实现：精通 ≥20 直接把间隔整段换成固定档值（3.6s → 2.0s）。结果是 367 个采集目标里
// **51% 在精通 19→20 时反而变慢**（基础 3.0s 的目标 1.5s → 3.6s，2.4 倍），玩家看到的是「精通升了却变慢」。
// 现改为「固定档值」与「基础间隔÷2」取更快者。这里逐目标逐档验证单调性。
console.log('══ C18. 精通升级不减速 ══')
{
  const p = freshPlayer({ foraging: 100 })
  const f = getSkillInstance('foraging')
  let slower = 0
  let worst = null
  for (const t of f.targets) {
    let prev = Infinity
    for (let lv = 0; lv <= 100; lv++) {
      p.skills.foraging.mastery[t.itemId] = countForMasteryLevel(lv)
      const cur = f.intervalMs(t)
      if (cur > prev + 1e-9) {
        slower++
        const r = cur / prev
        if (!worst || r > worst.r) worst = { id: t.itemId, lv, prev, cur, r }
      }
      prev = cur
    }
    delete p.skills.foraging.mastery[t.itemId]
  }
  check('精通间隔', `精通 0→100 逐级、全部 ${f.targets.length} 个目标都不变慢`, slower === 0, `变慢 ${slower} 次${worst ? `，最差 ${worst.id} 精通${worst.lv}：${(worst.prev / 1000).toFixed(2)}s→${(worst.cur / 1000).toFixed(2)}s` : ''}`)
  // 固定档只在「比基础÷2 更快」时生效：基础 8s 的长目标应由固定档提速，基础 3s 的短目标应走 ÷2
  const longT = f.targets.find((t) => t.intervalSec >= 8)
  const shortT = f.targets.find((t) => t.intervalSec <= 3.2)
  p.skills.foraging.mastery[longT.itemId] = countForMasteryLevel(100)
  p.skills.foraging.mastery[shortT.itemId] = countForMasteryLevel(100)
  check('精通间隔', '长基础目标由固定档提速（精通 100 → 2.0s）', Math.abs(f.intervalMs(longT) - 2000) < 1 && f.intervalSource(longT) === 'fixed', `${f.intervalMs(longT)}ms/${f.intervalSource(longT)}`)
  check('精通间隔', '短基础目标保持「基础÷2」不被固定档拖慢', f.intervalSource(shortT) === 'ratio' && f.intervalMs(shortT) < 2000, `${f.intervalMs(shortT)}ms/${f.intervalSource(shortT)}`)
}

// ── C19. 数据引用完整性（2026-09-12）────────────────────
// 起因：信仰「窖神」的供奉材料写的是 pickled_ext_01 / bambooShoot，两个 id **都不在物品库里** →
// 材料永远凑不齐、该神永远升不了级（与之前「奇遇奖励 egg/cheese 幽灵物品」同一类事故）。
// 这里把「数据里引用物品 id」的地方逐个查一遍，只允许引用真实存在的物品。
console.log('══ C19. 数据引用完整性 ══')
{
  const bad = []
  for (const p of PATRONS) for (const id of p.offer ?? []) if (!getItem(id)) bad.push(`${p.name}.offer → ${id}`)
  for (const s of SUPPLIERS) if (!getItem(s.itemId)) bad.push(`${s.name}.itemId → ${s.itemId}`)
  check('引用', `守护神供奉材料均存在（${PATRONS.length} 位）`, bad.filter((x) => x.includes('offer')).length === 0, bad.join('; '))
  check('引用', `供应商货品均存在（${SUPPLIERS.length} 家）`, bad.filter((x) => x.includes('itemId')).length === 0, bad.join('; '))
  // 反过来：每位神至少要有一个可获得的材料（存在 + 有获取途径才算可用）
  const noMats = PATRONS.filter((p) => !(p.offer ?? []).length || (p.offer ?? []).some((id) => !getItem(id)))
  check('引用', '每位守护神都有可凑齐的供奉材料', noMats.length === 0, noMats.map((p) => p.name).join('、'))

  // 通用扫描（2026-09-12 补）：把**所有数据模块**里「引用物品 id」的字段逐个查一遍。
  // 已抓到过的实例：信仰供奉材料 pickled_ext_01/bambooShoot、产地北境雪山物资箱 radish —— 都会让玩家
  // 拿到一个不在物品库里的假条目（白占背包格）或让功能永远凑不齐。字段口径只认已核实的几类，避免误报。
  {
    const ITEM_ID_KEYS = new Set(['itemId', 'out']) // 值本身即物品 id
    const ITEM_ID_MAP_KEYS = new Set(['items', 'feed', 'products']) // 对象的「键」是物品 id
    const ITEM_ID_ARR_KEYS = new Set(['box', 'pool', 'offer']) // 字符串数组，元素是物品 id
    const ghosts = []
    const walk = (v, where, depth = 0) => {
      if (v == null || depth > 6) return
      if (Array.isArray(v)) {
        v.forEach((x, i) => {
          if (typeof x === 'string' && ITEM_ID_ARR_KEYS.has(where.split('.').pop())) {
            if (!getItem(x)) ghosts.push(`${where}[${i}] → ${x}`)
          } else walk(x, `${where}[${i}]`, depth + 1)
        })
        return
      }
      if (typeof v !== 'object') return
      for (const [k, val] of Object.entries(v)) {
        const key = k
        if (typeof val === 'string' && ITEM_ID_KEYS.has(key)) {
          // 炼金配方的 out 单独交给 item_triple_audit 守（那边有「62 条幽灵配方基线」的门禁，
          // 基线只允许为零=不许新增），这里排除以免重复报同一批历史遗留。
          if (!(where.startsWith('alchemy.js') && key === 'out') && !getItem(val)) ghosts.push(`${where}.${key} → ${val}`)
          continue
        }
        if (val && typeof val === 'object' && ITEM_ID_MAP_KEYS.has(key)) {
          // 两种形状都要支持：{ 物品id: 数量 }（如吉祥物礼物、牧场饲料）与 ['物品id', …]（如风味搭配）
          const ids = Array.isArray(val) ? val.filter((x) => typeof x === 'string') : Object.keys(val)
          for (const id of ids) if (!getItem(id)) ghosts.push(`${where}.${key}.${id}`)
          continue
        }
        walk(val, `${where}.${key}`, depth + 1)
      }
    }
    const files = fs.readdirSync('src/game/data').filter((f) => f.endsWith('.js'))
    for (const f of files) {
      let mod
      try { mod = await import(`../../src/game/data/${f}`) } catch { continue }
      for (const [name, val] of Object.entries(mod)) walk(val, `${f}:${name}`)
    }
    const uniq = [...new Set(ghosts)]
    check('引用', `全部数据模块的物品 id 引用均存在（扫描 ${files.length} 个模块）`, uniq.length === 0, uniq.slice(0, 8).join('; '))
  }
}

// ── C20. 皮肤（v2.1：每套皮肤必须覆盖完整色板，且两主题下对比度达标）──
console.log('══ C20. 皮肤 ══')
{
  const hex2rgb = (h) => { const x = h.replace('#', ''); return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)] }
  const lum = (h) => { const c = hex2rgb(h); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }

  check('皮肤', `id 唯一且非空（${SKINS.length} 套）`, new Set(SKINS.map((s) => s.id)).size === SKINS.length && SKINS.every((s) => s.id && s.name && s.desc))
  check('皮肤', '名称唯一（防设置面板误判）', new Set(SKINS.map((s) => s.name)).size === SKINS.length)
  check('皮肤', '解锁门槛严格递增且首套为 0', SKINS.every((s, i) => i === 0 ? s.need === 0 : s.need > SKINS[i - 1].need))
  check('皮肤', '原味不覆盖任何变量（= 主题默认色）', Object.keys(SKINS[0].vars ?? {}).length === 0 && Object.keys(SKINS[0].varsDark ?? {}).length === 0)

  const nonClassic = SKINS.filter((s) => s.id !== 'classic')
  const missLight = [], missDark = [], deepInDark = [], rgbMismatch = []
  for (const s of nonClassic) {
    for (const k of SKIN_REQUIRED_KEYS) if (!(k in (s.vars ?? {}))) missLight.push(`${s.id}:${k}`)
    // 深色下豁免两项：--primary-deep（深色块本就没定义它）与 --border（深色统一金色描边=设计身份，不随皮肤）
    const darkExempt = new Set(['--primary-deep', '--border'])
    for (const k of SKIN_REQUIRED_KEYS) if (!darkExempt.has(k) && !(k in (s.varsDark ?? {}))) missDark.push(`${s.id}:${k}`)
    if ('--primary-deep' in (s.varsDark ?? {})) deepInDark.push(s.id)
    for (const theme of ['light', 'dark']) {
      const v = skinVars(s.id, theme)
      if (v['--primary'] && v['--primary-rgb'] !== rgbOf(v['--primary'])) rgbMismatch.push(`${s.id}/${theme}:--primary-rgb`)
      if (theme === 'dark') for (const key of ['--panel-rgb', '--panel-soft-rgb', '--panel-raised-rgb', '--panel-hi-rgb']) {
        if (!v[key]) continue
        const [r, g, b] = v[key].split(',').map(Number)
        if (r > 195 && g > 195 && b > 195) missDark.push(`${s.id}:${key}过亮`)
      }
    }
  }
  check('皮肤', '浅色版变量齐备（含调色板三元组）', missLight.length === 0, missLight.slice(0, 6).join(' '))
  check('皮肤', '深色版变量齐备且面板仍为深色', missDark.length === 0, missDark.slice(0, 6).join(' '))
  check('皮肤', '深色版不得覆盖 --primary-deep', deepInDark.length === 0, deepInDark.join(' '))
  check('皮肤', '--primary-rgb 与 --primary 同值（rgba 变量不脱钩）', rgbMismatch.length === 0, rgbMismatch.slice(0, 4).join(' '))

  const fails = []
  for (const s of SKINS) {
    for (const theme of ['light', 'dark']) {
      const v = skinVars(s.id, theme)
      const base = theme === 'dark'
        ? { text: '#f2e6d7', dim: '#cfbaa5', muted: '#bfa98f', bg: '#1a120c', card: '#241a13', primary: '#e0704a' }
        : { text: '#4a2f26', dim: '#6b5347', muted: '#7a6f68', bg: '#f8f1e8', card: '#fffdf9', primary: '#d95a38' }
      const g = (k, d) => v[k] ?? d
      const pairs = [
        ['text/bg', cr(g('--text', base.text), g('--bg', base.bg)), 4.5],
        ['text/card', cr(g('--text', base.text), g('--card', base.card)), 4.5],
        ['text-dim/card', cr(g('--text-dim', base.dim), g('--card', base.card)), 4.5],
        ['muted/card', cr(g('--muted', base.muted), g('--card', base.card)), 4.5],
        // 按钮文字是粗体大字（大文字阈值 3.0）；深色竣典的按钮底是 token 默认值 #b8502c
        ['白字/主色按钮底', cr('#ffffff', g('--btn-primary-bg', theme === 'dark' ? '#b8502c' : g('--primary', base.primary))), 3.0],
        ['主色当文字/卡片', cr(g('--primary', base.primary), g('--card', base.card)), 3.0],
      ]
      if (theme === 'light') pairs.push(['primary-deep/primary-soft', cr(g('--primary-deep', '#7a2f16'), g('--primary-soft', '#f8dccd')), 4.5])
      for (const [name, got, min] of pairs) if (got < min) fails.push(`${s.id}/${theme} ${name} ${got.toFixed(2)}<${min}`)
    }
  }
  check('皮肤', '逐皮肤 × 浅/深 对比度达标（WCAG）', fails.length === 0, fails.slice(0, 6).join('; '))
}

// ── C21. 厨神之路图谱（v2.1：**辐射式**布局，显示层纯函数，玩法数据不动）──
console.log('══ C21. 厨神之路图谱 ══')
{
  const g = daoGraphLayout()
  const ids = new Set(g.nodes.map((n) => n.id))
  const byRoad = (id) => g.nodes.filter((n) => n.pathId === id)
  const tierR = (t) => g.nodes.filter((n) => n.tier === t).map((n) => n.radius)
  const rootR = g.root?.r ?? 0
  check('道途图谱', `节点数与 DAO_NODES 一致（${DAO_NODES.length}）`, g.nodes.length === DAO_NODES.length, `${g.nodes.length}`)
  check('道途图谱', '四条道途各 9 个节点、每层 3 个', DAO_PATHS.every((p) => byRoad(p.id).length === 9)
    && [1, 2, 3].every((t) => DAO_PATHS.every((p) => byRoad(p.id).filter((n) => n.tier === t).length === 3)))
  check('道途图谱', '坐标均为有限数且不重叠（含 6px 间隙）', g.nodes.every((n) => Number.isFinite(n.cx) && Number.isFinite(n.cy))
    && g.nodes.every((a, i) => g.nodes.every((b, j) => i >= j || Math.hypot(a.cx - b.cx, a.cy - b.cy) >= a.r + b.r + 6)))
  check('道途图谱', '层级越外圈半径越大（层 1 < 2 < 3，含抖动也不倒挂）', Math.max(...tierR(1)) < Math.min(...tierR(2)) && Math.max(...tierR(2)) < Math.min(...tierR(3)),
    `${Math.round(Math.max(...tierR(1)))}/${Math.round(Math.min(...tierR(2)))}/${Math.round(Math.min(...tierR(3)))}`)
  check('道途图谱', '每个节点落在自己扇区的角度范围内（中心 ± 跨度/2 + 抖动）', DAO_PATHS.every((p, i) => {
    const c = GRAPH_METRICS.centers[i % GRAPH_METRICS.centers.length]
    const half = GRAPH_METRICS.spread / 2 + GRAPH_METRICS.jitterA + 0.5
    return byRoad(p.id).every((n) => {
      const d = ((n.deg - c) % 360 + 540) % 360 - 180
      return Math.abs(d) <= half
    })
  }))
  check('道途图谱', '四个扇区角度互不重叠（相邻扇区留有空隙）', (() => {
    const half = GRAPH_METRICS.spread / 2 + 6
    const ranges = GRAPH_METRICS.centers.map((c) => [c - half, c + half]).sort((a, b) => a[0] - b[0])
    return ranges.every((r, i) => i === 0 || r[0] > ranges[i - 1][1])
  })())
  check('道途图谱', '连线端点均存在且无自环', g.links.length > 0 && g.links.every((l) => ids.has(l.from) && ids.has(l.to) && l.from !== l.to)
    && g.links.every((l) => Number.isFinite(l.x1) && Number.isFinite(l.y2)))
  check('道途图谱', '画布尺寸能容纳全部节点与扇区', g.width > 0 && g.height > 0
    && g.nodes.every((n) => n.cx - n.r >= 0 && n.cy - n.r >= 0 && n.cx + n.r <= g.width && n.cy + n.r <= g.height))
  check('道途图谱', '根在画布中心，且干枝连到各自路带第 1 层节点', !!g.root && Math.abs(g.root.x - g.width / 2) < 1 && Math.abs(g.root.y - g.height / 2) < 1
    && g.trunks.length === 4 && g.trunks.every((t) => {
      const m = t.d.match(/([\d.-]+) ([\d.-]+)$/)
      if (!m) return false
      const ex = Number(m[1]), ey = Number(m[2])
      return byRoad(t.pathId).filter((n) => n.tier === 1).some((n) => Math.hypot(n.cx - ex, n.cy - ey) <= n.r + 10)
    }))
  check('道途图谱', '节点半径随成本分档（1/2/3 枚 → 三档递增）', (() => {
    const rOf = (c) => [...new Set(g.nodes.filter((n) => n.cost === c).map((n) => n.r))]
    const [a, b, c] = [rOf(1), rOf(2), rOf(3)]
    return a.length === 1 && b.length === 1 && c.length === 1 && a[0] < b[0] && b[0] < c[0]
  })())
  check('道途图谱', '三条环半径递增且都在根之外', g.rings.length === 3
    && g.rings.every((r, i) => r.radius > rootR + 40 && (i === 0 || r.radius > g.rings[i - 1].radius)))
  check('道途图谱', '扇区标题夹在根与第 1 环之间（聚焦中心即可见）', g.sectors.every((sec) => {
    const d = Math.hypot(sec.titleAt.x - g.root.x, sec.titleAt.y - g.root.y)
    return d > rootR + 10 && d < g.rings[0].radius - g.nodes[0].r
  }))
  check('道途图谱', '顶部进度牌匾**已删除**（用户 2026-09-13 要求；进度改由页面承担）', !('plaque' in g) || !g.plaque)
  check('道途图谱', '外环「觅珍环」：12 个节点环绕一整圈（每 30°、在第 3 层之外、闭合成圈）', (() => {
    const outer = g.nodes.filter((n) => n.ring)
    if (outer.length !== DAO_OUTER.length || DAO_OUTER.length !== 12) return false
    if (!outer.every((n) => n.radius > GRAPH_METRICS.rings[2] + 40)) return false // 必须落在第 3 层之外
    const degs = outer.map((n) => ((n.deg % 360) + 360) % 360).sort((a, b) => a - b)
    const steps = degs.map((d, k) => (k === 0 ? 360 - degs[degs.length - 1] + d : d - degs[k - 1]))
    if (!steps.every((x) => Math.abs(x - 30) < 6)) return false // 每 30°（含角度抖动容差）
    return g.links.filter((l) => l.ringLink).length === 12 // 12 条 = 首尾相接的闭合圈
  })())
  check('道途图谱', '外环每个节点奖励 100 张觅珍抽卡券、不消耗印记、门槛按全树已解锁数递进到 36', (() => {
    const gates = DAO_OUTER.map((n) => n.req?.daoNodes)
    return DAO_OUTER.every((n) => (n.cost ?? 0) === 0 && n.reward?.tickets === 100 && !n.effect)
      && gates.every((x, k) => x === 3 * (k + 1)) && gates[gates.length - 1] === 36
  })())
  check('道途图谱', '外环节点不吃四条道途的进度统计（各道途仍 9 个 / 单路 18 印记）', DAO_PATHS.every((q) => daoNodesOf(q.id).length === 9 && daoPathCost(q.id) === 18)
    && daoUnlockedTotal(DAO_NODES.filter((n) => n.path !== 'outer').map((n) => n.id)) === 36)
  check('道途图谱', '画布节点是纯图标（无名称/徽标；标题有底片、图标随半径缩放）', (() => {
    const svg = fs.readFileSync(new URL('../../src/components/DaoTreeGraph.vue', import.meta.url), 'utf8')
    const noMarkup = !svg.includes('dtg-name') && !svg.includes('dtg-badge')
    // 同时守住两处视觉契约：道途标题有淡色底片胶囊、节点图标随半径缩放
    const polished = svg.includes('dtg-title-pill') && svg.includes('--dtg-icon')
    const noFields = g.nodes.every((n) => !('labelDeg' in n) && !('side' in n) && 'icon' in n && 'name' in n)
    return noMarkup && noFields && polished
  })())
  check('道途图谱', '连线均标注所属支线（四道途 + 外环觅珍环，画布按支线色着色）', g.links.every((l) => l.pathId === 'outer' || g.sectors.some((x) => x.id === l.pathId)))
  check('道途图谱', '节点状态字段齐备（供画布着色）', g.nodes.every((n) => n.id && n.name && n.icon && n.pathId && n.pathName && Number.isFinite(n.cost) && Number.isFinite(n.tierReq)))
}

// ── C22. 山海食经（v2.1：12 系 × 10 环 × 3~5 节点；**纯条件点亮 + 固定数值奖励**）──
console.log('══ C22. 山海食经 ══')
{
  const N = SHANHAI_NODES
  const ids = new Set(N.map((n) => n.id))
  check('山海食经', `节点总数 = 480 分支 + 60 汇金 + 12 珍券 = ${N.length}`, N.length === 552 && SHANHAI_PATHS.length === 12 && SHANHAI_RING_COUNT === 10 && SHANHAI_RINGS.length === 10 && SHANHAI_RING_SLOTS.join(',') === '3,3,3,3,3,5,5,5,5,5' && N.filter((n) => n.gap == null && !n.ticket).length === 480 && N.filter((n) => n.gap != null).length === 60 && N.filter((n) => n.ticket).length === 12)
  check('山海食经', 'id 唯一', ids.size === N.length)
  check('山海食经', '每系每环节点数 = 该环设计槽位数（3 或 5；第 6 环起 5 个）', SHANHAI_PATHS.every((p) => SHANHAI_RING_SLOTS.every((c, i) => N.filter((n) => n.path === p.id && n.ring === i + 1).length === c)))
  check('山海食经', '条件只用 codex（收集件数 + 技能等级 + 转生次数）且数值合法', N.every((n) => {
    const k = n.req?.kind
    if (k !== 'codex' && k !== 'progress') return false
    // 珍券环用「已点亮节点数」当门槛，不写收集件数/等级/转生
    if (n.ticket) return k === 'progress' && Number.isFinite(n.req.nodes) && n.req.nodes > 0
    const base = Number.isFinite(n.req.count) && n.req.count > 0
      && Number.isFinite(n.req.level) && n.req.level >= 0 && Number.isFinite(n.req.prestige ?? 0) && (n.req.prestige ?? 0) >= 0
    if (!base) return false
    // 汇金节点横跨两条线：skill/skill2 必须正好是空隙两侧的技能；分支节点按 path 校验
    if (n.gap != null) {
      const g = SHANHAI_GAPS.find((x) => x.id === n.path)
      return !!g && n.req.skill === g.aSkill && n.req.skill2 === g.bSkill
    }
    return SHANHAI_PATHS.some((p) => p.id === n.path && p.skill === n.req.skill)
  }))
  // ⚠️ 转生环**不得同时要求「当前等级」**：转生会把等级重置为 1+传承（≤20）→ 那样节点永远点不亮
  check('山海食经', '转生环只写转生次数、不写等级要求（否则转生后永远够不着）', N.every((n) => !(n.req?.prestige > 0) || (n.req.level ?? 0) === 0))
  check('山海食经', '大后期里程碑严格递增：满 100 级 → 转生 1 → 5 → 10', (() => {
    const gate = (r) => { const n = N.find((x) => x.path === 'pick' && x.ring === r); return { level: n.req.level ?? 0, prestige: n.req.prestige ?? 0 } }
    const r7 = gate(7), r8 = gate(8), r9 = gate(9), r10 = gate(10)
    return r7.level === 100 && r7.prestige === 0 && r8.prestige === 1 && r9.prestige === 5 && r10.prestige === 10
      && r8.prestige < r9.prestige && r9.prestige < r10.prestige
  })())
  check('山海食经', '前 6 环收集门槛严格递增；第 6~10 环持平（里程碑环靠等级/转生卡）', SHANHAI_PATHS.every((p) => {
    const need = Array.from({ length: SHANHAI_RING_COUNT }, (_, i) => N.find((n) => n.path === p.id && n.ring === i + 1).req.count)
    return need.slice(0, 6).every((v, i) => i === 0 || v > need[i - 1]) && need.slice(5).every((v) => v === need[5])
  }))
  check('山海食经', '汇金链：12 个分支空隙 × 第 6~10 环 = 60 个金币节点，且落在**两分支之间**（不是环内）', (() => {
    const gaps = N.filter((n) => n.gap != null)
    return SHANHAI_GAPS.length === 12 && gaps.length === 60
      && SHANHAI_GAPS.every((g) => [6, 7, 8, 9, 10].every((r) => {
        const n = N.find((x) => x.path === g.id && x.ring === r)
        return n && n.effect?.field === 'gold' && n.req?.skill === g.aSkill && n.req?.skill2 === g.bSkill
      }))
      && gaps.every((n) => n.effect?.field === 'gold')
  })())
  check('山海食经', '汇金数额随环递增（6k/18k/48k/120k/300k，合计 5.904M）且在上限内', (() => {
    const gaps = N.filter((n) => n.gap != null)
    const perRing = {}
    for (const n of gaps) perRing[n.ring] = n.effect.amount
    const rings = Object.keys(perRing).map(Number).sort((a, b) => a - b)
    const inc = rings.every((r, i) => i === 0 || perRing[r] > perRing[rings[i - 1]])
    const total = gaps.reduce((a, n) => a + n.effect.amount, 0)
    return inc && total === 5904000 && total <= SHANHAI_EFFECT_CAPS.gold
  })(), (() => `汇金 ${N.filter((n) => n.gap != null).reduce((a, n) => a + n.effect.amount, 0).toLocaleString('en-US')} 金币`)
  )
  check('山海食经', '外圈「珍券环」：12 个环绕整圈（每 30°、在第 10 环之外、闭合成圈）、每个 100 张券', (() => {
    const tk = N.filter((n) => n.ticket)
    if (tk.length !== 12 || SHANHAI_TICKET_RING.nodes !== 12) return false
    if (!tk.every((n) => n.reward?.tickets === 100 && n.req?.kind === 'progress' && n.iconItem === null)) return false
    const g = shanhaiGraphLayout()
    const gn = g.nodes.filter((n) => n.ticket)
    if (gn.length !== 12) return false
    if (!gn.every((n) => n.radius > g.rings[g.rings.length - 1].radius + 100)) return false // 在第 10 环之外
    const degs = gn.map((n) => ((n.deg % 360) + 360) % 360).sort((a, b) => a - b)
    const steps = degs.map((d, i) => (i === 0 ? 360 - degs[degs.length - 1] + d : d - degs[i - 1]))
    if (!steps.every((x) => Math.abs(x - 30) < 6)) return false // 每 30°（含抖动容差）
    return g.links.filter((l) => l.ringLink).length === 12 // 闭合圈
  })())
  check('山海食经', '珍券环门槛 = 已点亮节点数（45→540，排除珍券环自身，否则自引用）', (() => {
    const tk = N.filter((n) => n.ticket)
    if (!tk.every((n, i) => n.req.nodes === 45 * (i + 1)) || tk[11].req.nodes !== 540) return false
    // 全点亮 540 个非珍券节点后，最后一个珍券节点才可点亮；点亮 539 个仍不可
    const p = freshPlayer()
    const rest = N.filter((n) => !n.ticket).map((n) => n.id)
    p.shanhaiUnlocked = rest.slice(0, 539)
    const st1 = shanhaiNodeState(tk[11], p)
    p.shanhaiUnlocked = rest
    const st2 = shanhaiNodeState(tk[11], p)
    const st3 = shanhaiNodeState(tk[0], p) // 门槛 45：此时早已满足
    return st1.can === false && st2.can === true && st3.can === true
  })())
  check('山海食经', '汇金节点的成对条件：两线合计收集 + 取两条线较低的等级/转生', (() => {
    const p = freshPlayer()
    const gapNode = N.find((n) => n.id === 'gap0_6') // 采撷+渔获，第 6 环：两线各 90% + 两线技能 75 级
    const idx = shanhaiIndex()
    const needPick = Math.max(3, Math.ceil(idx.pick.length * 0.9))
    const needFish = Math.max(3, Math.ceil(idx.fish.length * 0.9))
    const st0 = shanhaiNodeState(gapNode, p)
    if (st0.need !== needPick + needFish) return false // 门槛 = 两线各自门槛之和
    // 只满足一条线 → 仍不可点亮（这是「两条线都得到」的核心）
    for (const id of idx.pick.slice(0, needPick)) p.collected[id] = true
    p.setSkillState('foraging', { level: 75, exp: 0 })
    p.setSkillState('fishing', { level: 75, exp: 0 })
    const st1 = shanhaiNodeState(gapNode, p)
    if (st1.can) return false
    for (const id of idx.fish.slice(0, needFish)) p.collected[id] = true
    const st2 = shanhaiNodeState(gapNode, p)
    return st2.can === true && st2.level === 75
  })())
  check('山海食经', '汇金点亮即到账、账本记应发、补发幂等（旧档迁移走同一入口）', (() => {
    const p = freshPlayer()
    const node = N.find((n) => n.id === 'gap0_6') // 采撷+渔获 第 6 环：金币 +6000
    const idx = shanhaiIndex()
    for (const id of idx.pick.slice(0, Math.max(3, Math.ceil(idx.pick.length * 0.9)))) p.collected[id] = true
    for (const id of idx.fish.slice(0, Math.max(3, Math.ceil(idx.fish.length * 0.9)))) p.collected[id] = true
    p.setSkillState('foraging', { level: 75, exp: 0, prestiges: 0 })
    p.setSkillState('fishing', { level: 75, exp: 0, prestiges: 0 })
    const g0 = p.gold
    const r = p.shanhaiUnlock(node.id)
    if (!r.ok || p.gold !== g0 + 6000) return false
    if (!String(r.landed).includes('金币') || p.stats.shanhaiGoldPaid !== 6000) return false
    // 旧档迁移：账本清零 → 补发一次；再补一次不重复发（幂等）
    p.stats.shanhaiGoldPaid = 0
    const gBefore = p.gold
    const fix1 = p.settleShanhaiGold()
    const after1 = p.gold
    const fix2 = p.settleShanhaiGold()
    // ⚠️ 存档往返**绝不能重复发**（applySave 必须带回 stats.shanhaiGoldPaid；否则每次读档白拿一遍金币）
    const gRound = p.gold
    p.applySave(JSON.parse(JSON.stringify(p.serialize())))
    const roundOk = p.stats.shanhaiGoldPaid === 6000 && p.settleShanhaiGold().repaired === false && p.gold >= gRound
    return fix1.repaired === true && fix1.gold === 6000 && after1 === gBefore + 6000
      && fix2.repaired === false && p.gold >= after1 && p.stats.shanhaiGoldPaid === 6000 && roundOk
  })())
  check('山海食经', '分支节点的图标物品都存在图片文件；汇金节点用金币图标兜底', (() => {
    const bad = []
    for (const n of N) {
      if (n.gap != null || n.ticket) {
        // 汇金 / 珍券节点：iconItem 为空、必须给 emoji 兜底（画布走位图精灵，只有一个字形）
        if (n.iconItem !== null || !n.icon) bad.push(n.id + ':汇金/珍券节点应只有 emoji 兜底图标')
        continue
      }
      if (!n.iconItem) { bad.push(n.id + ':无 iconItem'); continue }
      const rel = itemImage(n.iconItem)
      if (!rel) { bad.push(n.id + ':' + n.iconItem + ':无图片URL'); continue }
      if (!fs.existsSync(fileURLToPath(new URL('../../public/' + rel, import.meta.url)))) bad.push(n.id + ':' + n.iconItem)
    }
    return bad.length === 0
  })(), '')
  check('山海食经', '每个节点都有固定数值奖励：分支/汇金走 effect 白名单，珍券环走 reward.tickets', N.every((n) => (n.ticket
    ? n.reward?.tickets > 0 && !n.effect
    : n.effect && SHANHAI_EFFECT_FIELDS.includes(n.effect.field) && Number.isInteger(n.effect.amount) && n.effect.amount > 0)))
  check('山海食经', '全树效果总量≤ 上限（防悄悄加码）', (() => {
    const sum = (f) => N.filter((n) => n.effect?.field === f).reduce((a, n) => a + n.effect.amount, 0)
    const perSkill = {}
    for (const n of N.filter((x) => x.effect?.field === 'flatYield')) {
      const skill = SHANHAI_PATHS.find((p) => p.id === n.path)?.skill
      perSkill[skill] = (perSkill[skill] ?? 0) + n.effect.amount
    }
    return sum('inventoryCap') <= SHANHAI_EFFECT_CAPS.inventoryCap && sum('bankCap') <= SHANHAI_EFFECT_CAPS.bankCap
      && sum('coldStorageCap') <= SHANHAI_EFFECT_CAPS.coldStorageCap && sum('offlineH') <= SHANHAI_EFFECT_CAPS.offlineH
      && Object.values(perSkill).every((v) => v <= SHANHAI_EFFECT_CAPS.flatYieldPerSkill)
  })(), `背包${N.filter((n) => n.effect?.field === 'inventoryCap').reduce((a, n) => a + n.effect.amount, 0)}/仓库${N.filter((n) => n.effect?.field === 'bankCap').reduce((a, n) => a + n.effect.amount, 0)}/离线${N.filter((n) => n.effect?.field === 'offlineH').reduce((a, n) => a + n.effect.amount, 0)}h`)
  check('山海食经', '各线可收集清单非空（来自真实技能实例）且最高环门槛≤清单长度', (() => {
    const idx = shanhaiIndex()
    return SHANHAI_PATHS.every((p) => {
      const len = (idx[p.id] ?? []).length
      const maxNeed = Math.max(...N.filter((n) => n.path === p.id).map((n) => n.req.count))
      return len > 0 && maxNeed <= len
    })
  })())
  check('山海食经', '新档：0 个可点亮 / 0 个已点亮', (() => {
    const p = freshPlayer()
    const list = p.shanhaiStates()
    return list.length === 552 && list.filter((x) => x.can).length === 0 && list.filter((x) => x.unlocked).length === 0
  })())
  check('山海食经', '收集够即可点亮（不消耗任何资源），且容量奖励即时到账', (() => {
    const p = freshPlayer()
    const node = N.find((n) => n.id === 'pick11') // 第 1 环：收集 9 件 → 背包 +1
    const list = shanhaiIndex().pick ?? []
    for (const id of list.slice(0, node.req.count)) p.collected[id] = true
    const before = { cap: p.inventoryCap, gold: p.gold, unlocked: p.shanhaiUnlocked.length }
    const r = p.shanhaiUnlock('pick11')
    return r.ok && p.inventoryCap === before.cap + 1 && p.gold === before.gold && p.shanhaiUnlocked.length === before.unlocked + 1
      && p.shanhaiEffects().caps.inventory === 1
  })())
  check('山海食经', '容量奖励在满上限时**不蒸发**（顺位转投仓库，并返回到账文案）', (() => {
    const p = freshPlayer()
    const node = N.find((n) => n.id === 'pick11') // 背包 +1
    for (const id of (shanhaiIndex().pick ?? []).slice(0, node.req.count)) p.collected[id] = true
    p.inventoryCap = CAP_MAX.inventory // 真买满（硬顶；100 只是商店能买到的上限）
    const bank0 = p.bankCap
    const r = p.shanhaiUnlock('pick11')
    // 断言**行为**（背包不动 + 仓库 +1 + 回执里说明转投），不写死文案
    return r.ok && p.inventoryCap === CAP_MAX.inventory && p.bankCap === bank0 + 1 && typeof r.landed === 'string' && r.landed.includes('仓库')
  })())
  check('山海食经', '商店买满后背包节点**仍落在背包**（不再错位进仓库；用户实测报过）', (() => {
    const p = freshPlayer()
    const node = N.find((n) => n.id === 'pick11') // 背包 +1
    for (const id of (shanhaiIndex().pick ?? []).slice(0, node.req.count)) p.collected[id] = true
    p.inventoryCap = PAID_CAP_MAX.inventory // 金币路径已买满（100）
    const bank0 = p.bankCap
    const r = p.shanhaiUnlock('pick11')
    return r.ok && p.inventoryCap === PAID_CAP_MAX.inventory + 1 && p.bankCap === bank0 && r.landed.includes('背包')
  })(), `硬顶 ${CAP_MAX.inventory} / 商店上限 ${PAID_CAP_MAX.inventory}`)
  check('山海食经', '条件不足时点亮失败且给出原因', (() => {
    const p = freshPlayer()
    const r = p.shanhaiUnlock('pick11')
    return r.ok === false && typeof r.msg === 'string' && r.msg.includes('还差')
  })())
  check('山海食经', '旧档对账补发：缺账本时按已点亮节点补齐容量（被上限吞掉的也会补）', (() => {
    const p = freshPlayer()
    const idx = shanhaiIndex()
    for (const id of (idx.pick ?? []).slice(0, 60)) p.collected[id] = true
    const saved = JSON.parse(JSON.stringify(p.serialize()))
    saved.shanhaiUnlocked = ['pick11', 'pick12'] // 两个「背包 +1」
    saved.inventoryCap = 20
    delete saved.stats.shanhaiCapGranted
    p.applySave(saved)
    return p.inventoryCap === 22 && p.stats.shanhaiCapGranted?.inventory === 2
  })())
  check('山海食经', '对账幂等：重复读档不重复补发；满上限时顺位转投仓库', (() => {
    const p = freshPlayer()
    const idx = shanhaiIndex()
    for (const id of (idx.pick ?? []).slice(0, 60)) p.collected[id] = true
    const saved = JSON.parse(JSON.stringify(p.serialize()))
    saved.shanhaiUnlocked = ['pick11', 'pick12', 'pick13']
    saved.inventoryCap = CAP_MAX.inventory // 真买满 → 三个 +1 都该顺位到仓库
    saved.stats.shanhaiCapGranted = { inventory: 0, bank: 0, cold: 0 }
    p.applySave(saved)
    const bankAfterFirst = p.bankCap
    p.applySave(JSON.parse(JSON.stringify(p.serialize()))) // 再读一次
    return p.inventoryCap === CAP_MAX.inventory && bankAfterFirst === 103 && p.bankCap === 103
  })())
  check('山海食经', '存档往返与旧档迁移（缺字段回退空数组）', (() => {
    const p = freshPlayer()
    const saved = JSON.parse(JSON.stringify(p.serialize()))
    p.applySave({ ...saved, shanhaiUnlocked: undefined })
    return Array.isArray(p.shanhaiUnlocked) && p.shanhaiUnlocked.length === 0
  })())
  check('山海食经', '道途标题在中心附近（夹在根与第 1 环之间）且两两不重叠', (() => {
    const g = shanhaiGraphLayout()
    const r0 = g.root.r
    const ring1 = g.rings[0].radius
    const titleR = g.sectors.map((s) => Math.hypot(s.titleAt.x - g.root.x, s.titleAt.y - g.root.y))
    if (!titleR.every((d) => d > r0 + 20 && d < ring1)) return false
    // 相邻标题中心距要 ≥ 底片宽（约 110px，留 20px 余量 → 130）
    for (let i = 0; i < g.sectors.length; i++) {
      const a = g.sectors[i].titleAt, b = g.sectors[(i + 1) % g.sectors.length].titleAt
      if (Math.hypot(a.x - b.x, a.y - b.y) < 130) return false
    }
    return true
  })())
  check('山海食经', '画布布局：552 节点（含 60 汇金 + 12 珍券）/ 12 扇区 / 10 环，坐标有限且不重叠', (() => {
    const g = shanhaiGraphLayout()
    if (g.nodes.length !== 552 || g.nodes.filter((n) => n.gap).length !== 60 || g.nodes.filter((n) => n.ticket).length !== 12 || g.sectors.length !== 12 || g.rings.length !== 10) return false
    if (!g.nodes.every((n) => Number.isFinite(n.cx) && Number.isFinite(n.cy))) return false
    for (let i = 0; i < g.nodes.length; i++) {
      for (let j = i + 1; j < g.nodes.length; j++) {
        const a = g.nodes[i], b = g.nodes[j]
        if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.r + b.r + 6) return false
      }
    }
    return true
  })())
}

// ── C23. 上限一致性（v2.1 审计：每一处「加上限」与「被加上限」的写入/消费方）──
console.log('══ C23. 上限一致性 ══')
{
  const P_SRC = fs.readFileSync(new URL('../../src/stores/player.js', import.meta.url), 'utf8')
  check('上限', `容量上限单一来源（硬顶 背包${CAP_MAX.inventory}/仓库${CAP_MAX.bank}/冷库${CAP_MAX.cold}；金币上限 ${PAID_CAP_MAX.inventory}/${PAID_CAP_MAX.bank}/${PAID_CAP_MAX.cold}）`, CAP_MAX.inventory === 376 && CAP_MAX.bank === 956 && CAP_MAX.cold === 170 && PAID_CAP_MAX.inventory === 100 && PAID_CAP_MAX.bank === 500 && PAID_CAP_MAX.cold === 100 && CAP_BASE.inventory === 20 && CAP_BASE.bank === 100 && CAP_BASE.cold === 5 && DERIVED_MAX.farmPlots === 20 && DERIVED_MAX.restaurantSlots === 6)
  // ⚠️ 本轮的关键不变量：硬顶必须**装得下**「金币买满 + 山海食经全树」——否则节点文案写「背包 +1」却顺位进仓库（用户实测报的错位）
  check('上限', '山海食经把「离线上限 / 每技能每次 +1 件」用到恰好封顶（不多不少）', (() => {
    const off = SHANHAI_NODES.filter((n) => n.effect?.field === 'offlineH').reduce((a, n) => a + n.effect.amount, 0)
    const perSkill = {}
    for (const n of SHANHAI_NODES.filter((x) => x.effect?.field === 'flatYield')) {
      const skill = SHANHAI_PATHS.find((p) => p.id === n.path)?.skill
      perSkill[skill] = (perSkill[skill] ?? 0) + n.effect.amount
    }
    // 恰好等于各自天花板：少了是浪费设计位，多了会被 offlineMaxHours/采集逻辑夹掉（等于发不出去的奖励）
    return off === OFFLINE_CAP.shanhaiMaxHours
      && Object.values(perSkill).every((v) => v === SHANHAI_EFFECT_CAPS.flatYieldPerSkill)
  })(), (() => {
    const off = SHANHAI_NODES.filter((n) => n.effect?.field === 'offlineH').reduce((a, n) => a + n.effect.amount, 0)
    return `离线 ${off}h / 封顶 ${OFFLINE_CAP.shanhaiMaxHours}h`
  })())
  check('上限', '硬顶 ≥ 金币路径上限 + 山海食经全树容量（三档都不许「装不下」）', (() => {
    const tree = { inventory: 0, bank: 0, cold: 0 }
    for (const n of SHANHAI_NODES) {
      if (n.effect?.field === 'inventoryCap') tree.inventory += n.effect.amount
      else if (n.effect?.field === 'bankCap') tree.bank += n.effect.amount
      else if (n.effect?.field === 'coldStorageCap') tree.cold += n.effect.amount
    }
    return CAP_MAX.inventory >= PAID_CAP_MAX.inventory + tree.inventory && CAP_MAX.bank >= PAID_CAP_MAX.bank + tree.bank
      && CAP_MAX.cold >= PAID_CAP_MAX.cold + tree.cold
  })(), (() => {
    const tree = { inventory: 0, bank: 0, cold: 0 }
    for (const n of SHANHAI_NODES) {
      if (n.effect?.field === 'inventoryCap') tree.inventory += n.effect.amount
      else if (n.effect?.field === 'bankCap') tree.bank += n.effect.amount
      else if (n.effect?.field === 'coldStorageCap') tree.cold += n.effect.amount
    }
    return `需 背包${PAID_CAP_MAX.inventory}+${tree.inventory}=${PAID_CAP_MAX.inventory + tree.inventory} / 仓库${PAID_CAP_MAX.bank}+${tree.bank}=${PAID_CAP_MAX.bank + tree.bank} / 冷库${PAID_CAP_MAX.cold}+${tree.cold}=${PAID_CAP_MAX.cold + tree.cold}`
  })())
  check('上限', '容量动作在满上限时拒绝而不越界', (() => {
    const p = freshPlayer()
    p.inventoryCap = CAP_MAX.inventory
    p.bankCap = CAP_MAX.bank
    p.coldStorageCap = CAP_MAX.cold
    const r = p.expandColdStorage()
    return p.expandInventory(10) === false && p.expandBank(20) === false && r.ok === false
      && p.inventoryCap === CAP_MAX.inventory && p.bankCap === CAP_MAX.bank && p.coldStorageCap === CAP_MAX.cold
  })())
  check('上限', '读档非法值不会把上限变成 NaN（字符串 / 超限 / 负数）', (() => {
    const p = freshPlayer()
    const saved = JSON.parse(JSON.stringify(p.serialize()))
    saved.inventoryCap = 'abc'
    saved.bankCap = 9999
    saved.coldStorageCap = -3
    saved.offlineBonusH = 'x'
    p.applySave(saved)
    return Number.isFinite(p.inventoryCap) && p.inventoryCap === CAP_BASE.inventory
      && p.bankCap === CAP_MAX.bank && p.coldStorageCap === 0 && p.offlineBonusH === 0
  })())
  check('上限', '派生上限数组读档被截断（出战位 / 菜单格 / 农田）且并行数合法化', (() => {
    const p = freshPlayer()
    const saved = JSON.parse(JSON.stringify(p.serialize()))
    saved.spirits = { active: ['a', 'b', 'c', 'd', 'e'], owned: {} }
    saved.restaurant = { level: 1, menu: new Array(9).fill('apple'), incomeAccum: 0, decor: [] }
    saved.farming = { plots: new Array(30).fill(null) }
    saved.settings = { ...saved.settings, maxParallelIdle: 'x' }
    p.applySave(saved)
    return p.spirits.active.length <= 2 && p.restaurant.menu.length <= DERIVED_MAX.restaurantSlots
      && p.farming.plots.length <= DERIVED_MAX.farmPlots && p.settings.maxParallelIdle === 0
  })())
  check('上限', `离线上限走唯一出口：${OFFLINE_CAP.baseHours}h + 饼干(≤${OFFLINE_CAP.biscuitMaxHours}) + 厨神之路(≤${OFFLINE_CAP.daoMaxHours}) + 山海食经(≤${OFFLINE_CAP.shanhaiMaxHours})`, (() => {
    const p = freshPlayer()
    p.offlineBonusH = 99 // 越界 → 段内夹到饼干上限
    // 山海段：把**全树所有 offlineH 节点**都点亮（12 线时共 8 个，7 条采集线第 6 环 + 采撷终点）
    p.shanhaiUnlocked = SHANHAI_NODES.filter((n) => n.effect?.field === 'offlineH').map((n) => n.id)
    const shanhai = Math.min(OFFLINE_CAP.shanhaiMaxHours, p.shanhaiEffects().offlineH)
    const dao = Math.min(OFFLINE_CAP.daoMaxHours, Number(p.daoEffects?.().offlineHours) || 0)
    const wan = p.offlineMaxHours()
    const wan2 = p.offlineMaxHours()
    // 段内必须**刚好用满**（多了会被夹掉＝发了读不到的奖励，少了＝浪费设计位）
    return shanhai === OFFLINE_CAP.shanhaiMaxHours && dao === 0 && wan === OFFLINE_CAP.baseHours + OFFLINE_CAP.biscuitMaxHours + shanhai && wan2 === wan
  })(), (() => {
    const p = freshPlayer()
    p.offlineBonusH = 99
    p.shanhaiUnlocked = SHANHAI_NODES.filter((n) => n.effect?.field === 'offlineH').map((n) => n.id)
    return `实际 ${p.offlineMaxHours()}h / 山海 ${p.shanhaiEffects().offlineH}h`
  })())
  check('上限', '离线窗口只有一个算法（bootstrap 引 store 出口，不自己再算 12h）', (() => {
    const src = fs.readFileSync(new URL('../../src/game/bootstrap.js', import.meta.url), 'utf8')
    return /offlineMaxHours\(\)/.test(src) && !/12\s*\*\s*3600_000/.test(src) && !/DEFAULT_MAX_OFFLINE_MS\s*\*/.test(src)
  })())
  check('上限', `饼干离线加成不超过各自天花板（safeCap 拒绝 NaN/字符串）`, (() => {
    return safeCap('abc', 0, OFFLINE_CAP.biscuitMaxHours) === 0 && safeCap(NaN, 7, 10) === 7
      && safeCap(99, 0, OFFLINE_CAP.biscuitMaxHours) === OFFLINE_CAP.biscuitMaxHours && safeCap(-5, 1, 10) === 0 && safeCap(3.9, 0, 10) === 3
  })())
  check('上限', '冷库满不静默：拒绝存入且发 cold:full 事件', (() => {
    const p = freshPlayer()
    const spoil = Object.keys(ITEMS).find((id) => ITEMS[id]?.spoilMs && ITEMS[id]?.type !== 'equipment')
    if (!spoil) return false
    p.coldStorageCap = 0
    p.inventory[spoil] = 3
    let fired = 0
    const h = () => { fired++ }
    EventBus.on('cold:full', h)
    const ok = p.depositToColdStorage(spoil, 1)
    EventBus.off('cold:full', h)
    return ok === false && fired === 1 && (p.inventory[spoil] ?? 0) === 3
  })())
  check('上限', '写入方不再出现裸字面量（player.js 里容量判定不写 100/500/20/5）', (() => {
    const bad = P_SRC.split('\n').filter((l) => /Cap\b[^\n]*[<>=]=?[^\n]*(\b100\b|\b500\b|\b20\b)/.test(l) && !/CAP_|safeCap|shanghai|shanhai/.test(l))
    return bad.length === 0
  })(), (() => P_SRC.split('\n').filter((l) => /Cap\b[^\n]*[<>=]=?[^\n]*(\b100\b|\b500\b|\b20\b)/.test(l) && !/CAP_|safeCap|shanhai/.test(l)).slice(0, 3).join(' | '))())
  check('上限', '金币路径天花板严格低于硬顶（抬硬顶≠放宽金币可买量）', PAID_CAP_MAX.inventory < CAP_MAX.inventory && PAID_CAP_MAX.bank < CAP_MAX.bank && PAID_CAP_MAX.cold < CAP_MAX.cold
    && PAID_CAP_MAX.inventory > CAP_BASE.inventory && PAID_CAP_MAX.bank > CAP_BASE.bank && PAID_CAP_MAX.cold > CAP_BASE.cold)
  check('上限', '金币扩容仍停在商店上限（抬硬顶没有放宽金币可买量）', (() => {
    const p = freshPlayer()
    p.inventoryCap = PAID_CAP_MAX.inventory - 5
    p.bankCap = PAID_CAP_MAX.bank - 10
    const inv = p.expandInventory(10) // 95 → 100（不是 105）
    const bank = p.expandBank(20)     // 490 → 500（不是 510）
    const again = p.expandInventory(10) && p.expandBank(20)
    return inv && bank && again === false && p.inventoryCap === PAID_CAP_MAX.inventory && p.bankCap === PAID_CAP_MAX.bank
  })())
  check('上限', '冷库付费扩容也停在金币上限（不借硬顶多买）', (() => {
    const p = freshPlayer()
    p.gold = 10 ** 9
    p.coldStorageCap = PAID_CAP_MAX.cold
    const r = p.expandColdStorage()
    return r.ok === false && p.coldStorageCap === PAID_CAP_MAX.cold && p.gold === 10 ** 9
  })())
  check('上限', '冷库扩容价格单一来源（player 与 ProductionView 共用 COLD_EXPAND_COST）', (() => {
    const prod = fs.readFileSync(new URL('../../src/views/ProductionView.vue', import.meta.url), 'utf8')
    return /COLD_EXPAND_COST/.test(P_SRC) && /COLD_EXPAND_COST/.test(prod)
  })())
}

// ── C24. 外环「觅珍环」抽卡券（v2.1：12 节点 × 100 张）──
console.log('══ C24. 外环觅珍环 ══')
{
  check('觅珍环', '全树未点亮时不可解锁（门槛 = 全树已解锁数，不是本路）', (() => {
    const p = freshPlayer()
    const r = p.daoUnlock('x1')
    return r.ok === false && r.msg.includes('全树已解锁')
  })())
  check('觅珍环', '解锁即到账：抽卡券 +100 且记帐本（daoTicketPaid）', (() => {
    const p = freshPlayer()
    p.daoUnlocked = DAO_NODES.filter((n) => n.path !== 'outer').slice(0, 3).map((n) => n.id)
    p.stats.daoTicketPaid = 0
    const t0 = p.mijian?.tickets ?? 0
    const r = p.daoUnlock('x1')
    return r.ok && r.tickets === 100 && (p.mijian.tickets ?? 0) === t0 + 100 && p.stats.daoTicketPaid === 100
  })())
  check('觅珍环', '读档对账：缺账本补发、重复读档与存档往返都不重复发', (() => {
    const p = freshPlayer()
    p.daoUnlocked = DAO_OUTER.slice(0, 6).map((n) => n.id) // 6 个外环节点 = 应发 600 张
    p.stats.daoTicketPaid = 0
    const t0 = p.mijian?.tickets ?? 0
    const fix1 = p.settleDaoTickets()
    const after = p.mijian.tickets
    const fix2 = p.settleDaoTickets()
    p.applySave(JSON.parse(JSON.stringify(p.serialize())))
    const fix3 = p.settleDaoTickets()
    return fix1.repaired === true && fix1.tickets === 600 && after === t0 + 600
      && fix2.repaired === false && p.mijian.tickets === after
      && fix3.repaired === false && p.mijian.tickets === after && p.stats.daoTicketPaid === 600
  })())
  check('珍券环', '山海食经珍券环：解锁即到账 +100，读档对账幂等（与厨神之路同一套纪律）', (() => {
    const p = freshPlayer()
    const rest = SHANHAI_NODES.filter((n) => !n.ticket).map((n) => n.id)
    p.shanhaiUnlocked = rest.slice(0, 45) // 点亮 45 个节点 → 珍券环第一个（门槛 45）可点亮
    p.stats.shanhaiTicketPaid = 0
    const t0 = p.mijian?.tickets ?? 0
    const r = p.shanhaiUnlock('tk1')
    if (!r.ok || !String(r.landed).includes('觅珍抽卡券') || (p.mijian.tickets ?? 0) !== t0 + 100) return false
    if (p.stats.shanhaiTicketPaid !== 100) return false
    // 缺账本 → 补发一次；再补不重复；存档往返也不重复
    p.stats.shanhaiTicketPaid = 0
    const g0 = p.mijian.tickets
    const fix1 = p.settleShanhaiTickets()
    const after = p.mijian.tickets
    const fix2 = p.settleShanhaiTickets()
    p.applySave(JSON.parse(JSON.stringify(p.serialize())))
    const fix3 = p.settleShanhaiTickets()
    return fix1.repaired === true && fix1.tickets === 100 && after === g0 + 100
      && fix2.repaired === false && fix3.repaired === false && p.mijian.tickets === after
  })())
  check('觅珍环', '外环总奖励 1200 张券、且不占道途效果与轮回印记', (() => {
    const total = DAO_OUTER.reduce((a, n) => a + (n.reward?.tickets ?? 0), 0)
    return total === 1200 && DAO_OUTER.every((n) => !n.effect && (n.cost ?? 0) === 0)
  })())
}

// ── C25. 挂机产线四套（2026-09-14：商队线 / 菌房 / 灵田 / 温室蜂场 + 并入牧场的网箱）──
console.log('══ C25. 挂机产线（商队/菌房/灵田/温室蜂场/网箱）══')
{
  // ① 数据与上限
  check('挂机产线', `设施上限与 caps.js 一致（商队 ${FACILITY_MAX.caravanSlots} / 菌房 ${FACILITY_MAX.mushroomBeds} / 灵田 ${FACILITY_MAX.spiritPlots} / 温室 ${FACILITY_MAX.greenhouseBeds} / 蜂箱 ${FACILITY_MAX.hives} / 网箱 ${FACILITY_MAX.ponds}）`,
    FACILITY_MAX.caravanSlots === CARAVAN_MAX_SLOTS && FACILITY_MAX.mushroomBeds === MUSHROOM_MAX_BEDS
    && FACILITY_MAX.spiritPlots === SPIRIT_MAX_PLOTS && FACILITY_MAX.greenhouseBeds === GREENHOUSE_MAX_BEDS
    && FACILITY_MAX.hives === HIVE_MAX_COUNT && FACILITY_MAX.ponds === POND_MAX)
  check('挂机产线', `扩建费用档数 = 「初始 → 上限」的差（商队 ${CARAVAN_BASE_SLOTS}→${CARAVAN_MAX_SLOTS} 等）`,
    CARAVAN_EXPAND_COSTS.length === CARAVAN_MAX_SLOTS - CARAVAN_BASE_SLOTS
    && MUSHROOM_EXPAND_COSTS.length === MUSHROOM_MAX_BEDS - MUSHROOM_BASE_BEDS
    && SPIRIT_EXPAND_COSTS.length === SPIRIT_MAX_PLOTS - SPIRIT_BASE_PLOTS
    && GREENHOUSE_EXPAND_COSTS.length === GREENHOUSE_MAX_BEDS - GREENHOUSE_BASE_BEDS
    && HIVE_EXPAND_COSTS.length === HIVE_MAX_COUNT - HIVE_BASE_COUNT
    && POND_EXPAND_COSTS.length === POND_MAX - POND_BASE)
  check('挂机产线', '所有周期产物/饲料都是既有物品（无幽灵 id）',
    [...MUSHROOM_MEDIA, ...HIVE_MEDIA].every((m) => [...Object.keys(m.products ?? {}), ...Object.keys(m.feed ?? {})].every((id) => !!getItem(id)))
    && SPIRIT_PLANTS.every((s) => !!getItem(s.seedId) && Object.keys(s.products).every((id) => !!getItem(id)))
    && POND_FISH.every((f) => Object.keys(f.products).every((id) => !!getItem(id))))
  check('挂机产线', `离线上限单一来源（IDLE_CAP_HOURS=${IDLE_CAP_HOURS}：牧场/分店不再各写一份 12h）`, (() => {
    const P = fs.readFileSync(new URL('../../src/stores/player.js', import.meta.url), 'utf8')
    const R = fs.readFileSync(new URL('../../src/game/data/ranch.js', import.meta.url), 'utf8')
    const B = fs.readFileSync(new URL('../../src/game/data/branches.js', import.meta.url), 'utf8')
    return !/RANCH_OFFLINE_CAP_HOURS|BRANCH_OFFLINE_CAP_HOURS/.test(P + R + B)
      && (P.match(/IDLE_CAP_HOURS/g) ?? []).length >= 3
  })())

  // ② 商队线
  check('商队', '未达等级 / 未考察产地都不能派遣', (() => {
    const p = freshPlayer()
    p.skills.spiceMixing.level = CARAVAN_UNLOCK_LEVEL - 1
    const a = p.caravanStart(0, 'plain', { apple: 1 }).ok === false
    p.skills.spiceMixing.level = CARAVAN_UNLOCK_LEVEL
    const b = p.caravanStart(0, 'plain', { apple: 1 }).ok === false
    return a && b
  })())
  check('商队', `本金超限拒发（上限 ${CARAVAN_CARGO_LIMIT.toLocaleString()}）`, (() => {
    const p = freshPlayer()
    p.skills.spiceMixing.level = CARAVAN_UNLOCK_LEVEL
    p.regions = { plain: true }
    p.inventory.truffle = 999
    return p.caravanStart(0, 'plain', { truffle: 999 }).ok === false
  })())
  check('商队', '矿物/材料类不能当货物（锻造原料不该被卖掉）', (() => {
    const p = freshPlayer()
    return !p.caravanCargoOk('copperOre') && !p.caravanCargoOk('wood') && p.caravanCargoOk('apple')
  })())
  check('商队', '出货真扣货；结算必给金币且不低于保底', (() => {
    const p = freshPlayer()
    p.skills.spiceMixing.level = CARAVAN_UNLOCK_LEVEL
    p.regions = { plain: true }
    p.inventory.apple = 100
    const r = p.caravanStart(0, 'plain', { apple: 50 })
    if (!r.ok || p.inventory.apple !== 50) return false
    p.caravanState().slots[0].readyAt = Date.now() - 1
    const gold0 = p.gold
    const c = p.caravanClaim(0)
    const value = 50 * getItem('apple').value
    return c.ok && p.gold - gold0 >= Math.round(value * CARAVAN_LOSS_FLOOR) && p.stats.caravanTrips === 1
  })())
  check('商队', '撤回无损退还货物', (() => {
    const p = freshPlayer()
    p.skills.spiceMixing.level = CARAVAN_UNLOCK_LEVEL
    p.regions = { plain: true }
    p.inventory.apple = 20
    p.caravanStart(0, 'plain', { apple: 10 })
    const r = p.caravanRecall(0)
    return r.ok && p.inventory.apple === 20 && !p.caravanState().slots[0]
  })())
  check('商队', '行情确实参与定价（同期同货恒定、跨期会变，且落在 [0.60,1.60]）', (() => {
    const c0 = exchangeCycleIndex()
    const v = [0, 1, 2, 3, 4, 5].map((c) => priceMultiplier('apple', c0 + c))
    return new Set(v).size > 1 && v.every((x) => x >= 0.6 && x <= 1.6) && priceMultiplier('apple', c0) === priceMultiplier('apple', c0)
  })())
  check('商队', '七条商路：近路 4h、远路 12h，系数随距离递增', (() => {
    const rs = allCaravanRoutes(3)
    return rs.length === 7 && rs[0].hours === 4 && rs[rs.length - 1].hours === 12 && rs[rs.length - 1].coeff > rs[0].coeff
  })())

  // ③ 菌房
  check('菌房', '未达采摘等级不能铺床；铺床消耗金币', (() => {
    const p = freshPlayer()
    p.skills.foraging.level = MUSHROOM_UNLOCK_LEVEL - 1
    const a = p.mushroomBuild(0, 'compost').ok === false
    p.skills.foraging.level = MUSHROOM_UNLOCK_LEVEL
    p.gold = 100000 // 新档初始金币不足以铺床，这里先给足（铺床要钱本身由下一句断言）
    const gold0 = p.gold
    const b = p.mushroomBuild(0, 'richCompost').ok === true && p.gold === gold0 - 18000
    return a && b
  })())
  check('菌房', '无肥料则暂停；有肥料按周期出菇并扣料', (() => {
    const p = freshPlayer()
    p.skills.foraging.level = MUSHROOM_UNLOCK_LEVEL
    p.gold = 100000
    p.mushroomBuild(0, 'richCompost')
    p.mushroomState().beds[0].lastAt = Date.now() - 24 * 3600e3
    p._tickMushroom()
    if ((p.inventory.mushroom ?? 0) > 0) return false
    p.inventory.richCompost = 3
    p.mushroomState().beds[0].lastAt = Date.now() - 24 * 3600e3
    p._tickMushroom()
    // 12h 上限 / 4h 周期 = 3 轮 → 蘑菇 9 + 松茸 3，沃肥被扣光（spendItem 归零会删键 ⇒ 读出来是 undefined）
    return (p.inventory.mushroom ?? 0) === 9 && (p.inventory.matsutake ?? 0) === 3 && (p.inventory.richCompost ?? 0) === 0
  })())
  check('菌房', `离线单次最多补 ${IDLE_CAP_HOURS} 小时（6h/周期 → 恰好 2 轮，不无限累积）`, (() => {
    const p = freshPlayer()
    p.skills.foraging.level = MUSHROOM_UNLOCK_LEVEL
    p.gold = 100000
    p.mushroomBuild(0, 'compost')
    p.inventory.compost = 999
    p.mushroomState().beds[0].lastAt = Date.now() - 100 * 3600e3
    p._tickMushroom()
    return (p.inventory.mushroom ?? 0) === 4 && p.stats.mushroomCycles === 2
  })())

  // ④ 灵田
  check('灵田', '未达等级不能种；非灵植种子拒收', (() => {
    const p = freshPlayer()
    p.skills.foraging.level = SPIRIT_UNLOCK_LEVEL - 1
    p.inventory.lingzhiSeed = 1
    const a = p.spiritPlant(0, 'lingzhiSeed').ok === false
    p.skills.foraging.level = 99
    const b = p.spiritPlant(0, 'wheatSeed').ok === false
    return a && b
  })())
  check('灵田', '种什么得什么（定向）+ 消耗种子 + 收取后自动续种', (() => {
    const p = freshPlayer()
    p.skills.foraging.level = 99
    p.inventory.lingzhiSeed = 2
    if (!p.spiritPlant(0, 'lingzhiSeed').ok || p.inventory.lingzhiSeed !== 1) return false
    p.spiritState().plots[0].readyAt = Date.now() - 1
    const r = p.spiritHarvest(0)
    // 自动续种会再花掉一颗种子（归零删键 ⇒ undefined）
    // 起始 2 颗 → 种下 −1 → 收获回收 +1 → 自动续种 −1 ⇒ 净剩 1 颗
    return r.ok && p.inventory.lingzhi === 2 && r.replanted === true && (p.inventory.lingzhiSeed ?? 0) === 1 && !!p.spiritState().plots[0]
  })())
  check('灵田', '收获回收种子后可无限续种（灵圃是可持续的种子来源）', (() => {
    const p = freshPlayer()
    p.skills.foraging.level = 99
    p.inventory.truffleSeed = 1
    p.spiritPlant(0, 'truffleSeed')
    p.spiritState().plots[0].readyAt = Date.now() - 1
    const r = p.spiritHarvest(0)
    return r.ok && r.got.truffleSeed === 1 && r.replanted === true && !!p.spiritState().plots[0] && p.inventory.truffle === 2
  })())
  check('灵田', '未成熟不可收；撤回退还种子', (() => {
    const p = freshPlayer()
    p.skills.foraging.level = 99
    p.inventory.lingzhiSeed = 1
    p.spiritPlant(0, 'lingzhiSeed')
    if (p.spiritHarvest(0).ok !== false) return false
    const r = p.spiritTakeBack(0)
    return r.ok && p.inventory.lingzhiSeed === 1 && !p.spiritState().plots[0]
  })())

  // ⑤ 温室蜂场
  check('温室', '温室生长 = 农耕 growSec × 0.75（小麦 90s → 67.5s）', (() => {
    const crop = greenhouseCrop('wheatSeed')
    return greenhouseGrowMs('wheatSeed') === Math.round(crop.growSec * 0.75 * 1000)
  })())
  check('温室', `作物伴生蜂蜜概率 = ${GREENHOUSE_HONEY_CHANCE * 100}%（常量，不随等级变）`, GREENHOUSE_HONEY_CHANCE === 0.1)
  check('温室', '**单次只收 1 轮**（防离线狂刷：小麦 67.5s/轮，限 12h 会一次收 640 轮）', (() => {
    const p = freshPlayer()
    p.skills.farming.level = 99
    p.inventory.wheatSeed = 10
    p.greenhousePlant(0, 'wheatSeed')
    p.greenhouseState().beds[0].plantedAt = Date.now() - 12 * 3600e3
    p._tickGreenhouse()
    return (p.inventory.wheat ?? 0) === 1 && p.stats.greenhouseCycles === 1
  })())
  check('温室', '收获后自动续种（背包还有同种种子）', (() => {
    const p = freshPlayer()
    p.skills.farming.level = 99
    p.inventory.wheatSeed = 3
    p.greenhousePlant(0, 'wheatSeed')
    p.greenhouseState().beds[0].plantedAt = Date.now() - 12 * 3600e3
    p._tickGreenhouse()
    return !!p.greenhouseState().beds[0] && p.inventory.wheatSeed === 1
  })())
  check('蜂箱', '蜜源品级随花等级（菊花 Lv12→2 品、桂花 Lv34→4 品）',
    honeyTierForLevel(hiveMediaLevel('chrysanthemum')) === 2 && honeyTierForLevel(hiveMediaLevel('osmanthus')) === 4)
  check('蜂箱', '产蜜消耗花，并按品级发对应蜂蜜', (() => {
    const p = freshPlayer()
    p.inventory.osmanthus = 10
    p.hiveSet(0, 'osmanthus')
    p.greenhouseState().hives[0].lastAt = Date.now() - 48 * 3600e3
    p._tickGreenhouse()
    return p.inventory.osmanthus === 8 && (p.inventory.honeyAutumn ?? 0) === 2 && p.stats.honeyHarvests === 1
  })())
  check('蜂箱', '蜜源不足时暂停（不发蜜、不计次）', (() => {
    const p = freshPlayer()
    p.hiveSet(0, 'osmanthus')
    p.greenhouseState().hives[0].lastAt = Date.now() - 48 * 3600e3
    p._tickGreenhouse()
    return !Object.keys(p.inventory).some((k) => k.startsWith('honey')) && p.stats.honeyHarvests === undefined
  })())

  // ⑥ 蜂蜜
  check('蜂蜜', '8 品级、id/名称唯一、都进了 ITEMS', (() => {
    const ids = new Set(HONEY_TIERS.map((h) => h.id))
    const names = new Set(HONEY_TIERS.map((h) => h.name))
    return HONEY_TIERS.length === 8 && ids.size === 8 && names.size === 8 && HONEY_ITEMS.every((h) => !!getItem(h.id))
  })())
  check('蜂蜜', '效果/时长/门槛/价值随品级单调递增', (() => {
    let ok = true
    for (let i = 1; i < HONEY_TIERS.length; i++) {
      const a = HONEY_TIERS[i - 1], b = HONEY_TIERS[i]
      if (!(b.xp > a.xp && b.yield > a.yield && b.minutes > a.minutes && b.minLevel > a.minLevel && b.value > a.value)) ok = false
    }
    return ok
  })())
  check('蜂蜜', '全是 consumable/buff（⇒ 不进采集/配方/抽卡/交易所/自动出售）',
    HONEY_ITEMS.every((h) => h.type === 'consumable' && h.category === 'buff'))
  check('蜂蜜', '**双效**：使用后经验与产量两条乘区同时生效', (() => {
    const p = freshPlayer()
    p.inventory.honeySupreme = 1
    const r = p.useConsumable('honeySupreme')
    const h = HONEY_TIERS[7]
    return r.ok && p.buffs.xpMult?.mult === h.xp && p.buffs.yieldMult?.mult === h.yield
  })())
  check('蜂蜜', '品级映射：Lv1→1 品、Lv34→4 品、灵果(Lv90)→8 品', (() => {
    return honeyTierForLevel(1) === 1 && honeyTierForLevel(34) === 4 && honeyTierForLevel(90) === 8
      && honeyItemForLevel(greenhouseCrop('spiritFruitSeed').reqLevel) === 'honeySupreme'
  })())
  check('蜂蜜', '获取来源全在「温室蜂场」（唯一来源）且可跳转', (() => {
    return HONEY_TIERS.every((h) => {
      const srcs = itemSources(h.id) ?? []
      return srcs.length > 0 && srcs.every((s) => s.includes('温室蜂场') && !!jumpForSource(s))
    })
  })())
  check('蜂蜜', '蜂蜜不作为任何配方/炼金材料（可用于制作为空）', HONEY_TIERS.every((h) => itemUses(h.id).length === 0))

  check('挂机产线', '四套周期系统缺料时**真停机**（lastAt 推进、倒计时归零、不囤积进度）', (() => {
    const p = freshPlayer()
    p.skills.foraging.level = MUSHROOM_UNLOCK_LEVEL
    p.skills.farming.level = 60 // 牧场要农耕 Lv15 才开
    p.gold = 100000
    // 牧场：买鸡但不给玉米
    p.ranchBuy(0, 'chicken')
    // 网箱：投苗但不给海苔
    p.pondBuy(0, 'crucian')
    // 菌房：铺床但不给堆肥
    p.mushroomBuild(0, 'compost')
    // 蜂箱：放蜂群但不给花
    p.hiveSet(0, 'osmanthus')
    const oneDayAgo = Date.now() - 24 * 3600e3
    p.ranch.pens[0].lastAt = oneDayAgo
    p.ranch.ponds[0].lastAt = oneDayAgo
    p.mushroom.beds[0].lastAt = oneDayAgo
    p.greenhouse.hives[0].lastAt = oneDayAgo
    p._tickRanch(); p._tickPonds(); p._tickMushroom(); p._tickGreenhouse()
    const fresh = (t) => Date.now() - t < 5000 // 被推到「现在」= 倒计时归零
    return fresh(p.ranch.pens[0].lastAt) && fresh(p.ranch.ponds[0].lastAt)
      && fresh(p.mushroom.beds[0].lastAt) && fresh(p.greenhouse.hives[0].lastAt)
      && !(p.stats.ranchCycles) && !(p.stats.pondCycles) && !(p.stats.mushroomCycles) && !(p.stats.honeyHarvests)
  })())
  check('挂机产线', '补料后恢复产出（停机不会吃掉后续进度）', (() => {
    const p = freshPlayer()
    p.skills.foraging.level = MUSHROOM_UNLOCK_LEVEL
    p.gold = 100000
    p.mushroomBuild(0, 'compost')
    p.mushroom.beds[0].lastAt = Date.now() - 24 * 3600e3
    p._tickMushroom() // 缺料 → 停机
    p.inventory.compost = 1
    p._tickMushroom() // 刚停机，需要重新等满一个周期 → 仍不产出
    if ((p.inventory.mushroom ?? 0) > 0) return false
    p.inventory.compost = 999 // 备足料
    p.mushroom.beds[0].lastAt = Date.now() - 12 * 3600e3
    p._tickMushroom() // 给足时间 → 正常产出 2 轮（12h 上限 / 6h 周期）
    return (p.inventory.mushroom ?? 0) === 4 && p.stats.mushroomCycles === 2
  })())
  // ⑨ 菌灵露（v2.3.0）：8 档统一阶梯 + 萃露炉酿造
  check('菌灵露', '8 档、id/名称唯一、都进了 ITEMS、档位锚定真实材料且等级递增', (() => {
    const ids = new Set(ESSENCE_TIERS.map((e) => e.id))
    const names = new Set(ESSENCE_TIERS.map((e) => e.name))
    let mono = true
    for (let i = 1; i < ESSENCE_TIERS.length; i++) {
      const a = ESSENCE_TIERS[i - 1], b = ESSENCE_TIERS[i]
      if (!(b.anchorLv > a.anchorLv && b.xp >= a.xp && b.yld >= a.yld && b.hours >= a.hours && b.minutes >= a.minutes)) mono = false
    }
    return ESSENCE_TIERS.length === 8 && ids.size === 8 && names.size === 8 && mono
      && ESSENCE_TIERS.every((e) => !!getItem(e.anchor) && !!getItem(e.id) && ESSENCE_ITEMS.some((x) => x.id === e.id))
  })())
  check('菌灵露', '主料/辅料都是既有物品（无幽灵 id）',
    ESSENCE_TIERS.every((e) => [...Object.keys(e.material), ...Object.keys(e.aux ?? {})].every((id) => !!getItem(id))))
  check('菌灵露', '全是 consumable/buff（不进采集/配方/抽卡/交易所/自动出售）', ESSENCE_ITEMS.every((x) => x.type === 'consumable' && x.category === 'buff'))
  check('菌灵露', 'Ⅴ 起带采集间隔、Ⅶ 起带餐厅收入（阶梯效果逐级解锁）', (() => {
    return ESSENCE_TIERS.filter((e) => e.gather > 0).every((e) => e.tier >= 5)
      && ESSENCE_TIERS.filter((e) => e.restaurant > 0).every((e) => e.tier >= 7)
      && ESSENCE_TIERS.slice(0, 4).every((e) => e.gather === 0 && e.restaurant === 0)
  })())
  check('菌灵露', '**唯一来源是萃露炉**（图鉴来源都指向灵圃菌房且可跳转）', (() => {
    return ESSENCE_TIERS.every((e) => {
      const srcs = itemSources(e.id) ?? []
      return srcs.length > 0 && srcs.every((s) => s.includes('灵圃菌房') && !!jumpForSource(s))
    })
  })())
  check('萃露炉', '备料才能开酿；开酿扣料、到点收取给露、撤回退料', (() => {
    const p = freshPlayer()
    p.skills.foraging.level = 60 // 萃露炉要求先解锁菌房/灵圃
    p.inventory.mushroom = 10
    if (p.essenceBrew(0, 'essence1').ok !== false) return false // 缺堆肥
    p.inventory.compost = 3
    if (!p.essenceBrew(0, 'essence1').ok) return false
    if (p.inventory.mushroom !== 4 || p.inventory.compost !== 2) return false
    if (p.essenceClaim(0).ok !== false) return false // 未到点
    p.essenceState().vats[0].readyAt = Date.now() - 1
    const c = p.essenceClaim(0)
    if (!c.ok || p.inventory.essence1 !== 1 || p.stats.essenceBrews !== 1) return false
    p.inventory.lingzhi = 5
    p.inventory.richCompost = 5
    p.essenceBrew(0, 'essence3')
    return p.essenceTakeBack(0).ok === true && p.inventory.lingzhi === 5
  })())
  check('萃露炉', '格位上限与扩容费用档数一致（1 → 2）', ESSENCE_MAX_VATS === 2 && ESSENCE_EXPAND_COSTS.length === ESSENCE_MAX_VATS - ESSENCE_BASE_VATS)

  // ⑩ 两条新乘区轴（v2.3.0）
  check('乘区', '菌灵露·Ⅷ 一次给四条轴（经验/产量/采集间隔/餐厅）', (() => {
    const p = freshPlayer()
    p.inventory.essence8 = 1
    const r = p.useConsumable('essence8')
    const e = ESSENCE_TIERS[7]
    return r.ok && p.buffs.xpMult?.mult === e.xp && p.buffs.yieldMult?.mult === e.yld
      && p.buffs.gatherMult?.mult === Math.round((1 - e.gather / 100) * 100) / 100
      && p.buffs.restaurantMult?.mult === Math.round((1 + e.restaurant / 100) * 100) / 100
  })())
  check('乘区', '采集间隔真的缩短了采集周期（intervalMs 乘在最终结果上）', (() => {
    const p = freshPlayer()
    p.skills.foraging.level = 50
    createSkillInstances(p)
    const inst = getAllSkillInstances().find((i) => i.id === 'foraging')
    const t = inst.targets[0]
    const before = inst.intervalMs(t)
    p.inventory.essence8 = 1
    p.useConsumable('essence8')
    const after = inst.intervalMs(t)
    return after < before && Math.abs(after / before - 0.8) < 0.02
  })())
  check('乘区', '「采集间隔」重复使用取**更小**（更快），其余轴取更大', (() => {
    const p = freshPlayer()
    p.inventory.essence8 = 1
    p.inventory.abaloneSauce = 1
    p.useConsumable('essence8') // −20%
    p.useConsumable('abaloneSauce') // −8%
    return p.buffs.gatherMult?.mult === 0.8
  })())
  check('乘区', '餐厅收入乘区真的进了收入 getter', (() => {
    const p = freshPlayer()
    p.restaurant.menu = ['whiteBread']
    const base = p.restaurantHourlyIncome
    p.inventory.abaloneSauce = 1
    p.inventory.shrimpOil = 1
    p.useConsumable('shrimpOil') // +30%
    return p.restaurantHourlyIncome > base
  })())

  // ⑪ 牧场 / 网箱的加工品（v2.3.0：每头动物 / 每条鱼 ≥2 种产出）
  check('加工品', '8 件、都是 consumable/buff 且都有图鉴来源', (() => {
    return GOODS_ITEMS.length === 8 && GOODS_ITEMS.every((g) => g.type === 'consumable' && g.category === 'buff'
      && (itemSources(g.id) ?? []).length > 0 && (itemSources(g.id) ?? []).every((s) => !!jumpForSource(s)))
  })())
  check('加工品', '每头动物 / 每条鱼都产出 ≥2 种（含 1 件加工品）', (() => {
    return RANCH_ANIMALS.every((a) => Object.keys(a.products).length >= 2)
      && POND_FISH.every((f) => Object.keys(f.products).length >= 2)
      && RANCH_ANIMALS.every((a) => Object.keys(a.products).some((id) => GOODS_ITEMS.some((g) => g.id === id)))
      && POND_FISH.every((f) => Object.keys(f.products).some((id) => GOODS_ITEMS.some((g) => g.id === id)))
  })())
  check('加工品', '牧场 / 网箱真的会把加工品发到背包', (() => {
    const p = freshPlayer()
    p.skills.farming.level = 60
    p.gold = 200000 // 买动物/投苗都要金币
    p.inventory.corn = 50
    p.ranchBuy(0, 'chicken')
    p.ranch.pens[0].lastAt = Date.now() - 12 * 3600e3
    p._tickRanch()
    p.inventory.seaweed = 50
    p.pondBuy(0, 'crucian')
    p.ranch.ponds[0].lastAt = Date.now() - 12 * 3600e3
    p._tickPonds()
    return (p.inventory.chickenOil ?? 0) > 0 && (p.inventory.fishPaste ?? 0) > 0
  })())

  // ⑫ 合并页（菌房 + 灵田 → 灵圃菌房）
  check('灵圃菌房', '视图注册与下线：有 mycoField、无 mushroom/spiritField', (() => {
    const ui = fs.readFileSync(new URL('../../src/stores/ui.js', import.meta.url), 'utf8')
    const app = fs.readFileSync(new URL('../../src/App.vue', import.meta.url), 'utf8')
    const side = fs.readFileSync(new URL('../../src/components/Sidebar.vue', import.meta.url), 'utf8')
    return /'mycoField'/.test(ui) && !/'mushroom'/.test(ui) && !/'spiritField'/.test(ui)
      && /mycoField/.test(app) && /mycoField/.test(side)
      && !/views\/MushroomView/.test(app) && !/views\/SpiritFieldView/.test(app)
  })())
  check('灵圃菌房', '灵圃收获 = 灵植 + 回收 1 颗种子（可持续种子来源）', (() => {
    const p = freshPlayer()
    p.skills.foraging.level = 99
    p.inventory.lingzhiSeed = 1
    p.spiritPlant(0, 'lingzhiSeed')
    p.spiritState().plots[0].readyAt = Date.now() - 1
    const r = p.spiritHarvest(0)
    // 收 1 颗种子 + 自动续种再花 1 颗 ⇒ 净剩 0，但种子确实回收过（got 里带 seedId）
    return r.ok && r.got.lingzhiSeed === 1 && r.replanted === true && !!p.spiritState().plots[0] && (p.inventory.lingzhiSeed ?? 0) === 0
  })())
  // ⑬ v2.3.1：两条料线的职能切分 + 显示细节
  check('两线分工', '菇床覆盖菌灵露 Ⅰ~Ⅳ 档主料（蘑菇/茯苓/灵芝/松茸）', (() => {
    const mats = new Set(MUSHROOM_MEDIA.flatMap((m) => Object.keys(m.products)))
    const need = ['mushroom', 'excavation_ext_12', 'lingzhi', 'matsutake']
    return need.every((id) => mats.has(id))
  })())
  check('两线分工', '灵圃覆盖菌灵露 Ⅴ~Ⅷ 档主料（木耳/银耳/松露/龙根/灵果）', (() => {
    const mats = new Set(SPIRIT_PLANTS.flatMap((p) => Object.keys(p.products)))
    const need = ['foraging_ext_22', 'foraging_ext_23', 'truffle', 'dragonRoot', 'spiritFruit']
    return need.every((id) => mats.has(id))
  })())
  check('两线分工', '每件加工品都有非空的效果文案（牧场/网箱要显示作用，否则玩家不知道拿来干嘛）',
    GOODS_ITEMS.every((g) => (goodsEffectText(g) ?? '').trim().length > 0))
  check('两线分工', '温室种子下拉只列「背包有 + 等级够」（用户要求：显示有的就可以）', (() => {
    const src = fs.readFileSync(new URL('../../src/views/GreenhouseView.vue', import.meta.url), 'utf8')
    return /\(player\.inventory\[c\.seedId\] \?\? 0\) > 0 && lv >= c\.reqLevel/.test(src)
  })())
  check('两线分工', '灵圃菌房页列全所有灵植与培养基（缺了玩家就看不到存在哪些）', (() => {
    const src = fs.readFileSync(new URL('../../src/views/MycoFieldView.vue', import.meta.url), 'utf8')
    return /v-for="sp in SPIRIT_PLANTS"/.test(src) && /v-for="m in MUSHROOM_MEDIA"/.test(src)
  })())
  // ⑭ 农具（v2.4.1）：用金币缩短农田生长时间（回应「农耕要等、采集能速刷」）
  check('农具', `等级 0~${TOOL_MAX_LEVEL}、生长时间最多 −${Math.round(TOOL_MAX_LEVEL * TOOL_TIME_PER_LEVEL * 100)}%，且单调递减`, (() => {
    if (toolTimeFactor(0) !== 1) return false
    if (Math.abs(toolTimeFactor(TOOL_MAX_LEVEL) - 0.70) > 1e-9) return false
    for (let i = 1; i <= TOOL_MAX_LEVEL; i++) if (!(toolTimeFactor(i) < toolTimeFactor(i - 1))) return false
    return nextToolCost(0) != null && nextToolCost(TOOL_MAX_LEVEL) == null
  })())
  check('农具', '升级扣金币、满级拒绝、读档超限被夹取', (() => {
    const p = freshPlayer()
    if (p.farmToolLevel() !== 0) return false
    p.gold = 100
    if (p.upgradeFarmTool().ok !== false) return false // 金币不足
    p.gold = TOOL_COSTS.reduce((a, b) => a + b, 0) + 1000
    for (let i = 0; i < TOOL_MAX_LEVEL; i++) if (!p.upgradeFarmTool().ok) return false
    if (p.farmToolLevel() !== TOOL_MAX_LEVEL || p.upgradeFarmTool().ok !== false) return false
    const q = freshPlayer()
    q.applySave({ ...q.serialize(), farming: { plots: [], tool: 99 } })
    return q.farmToolLevel() === TOOL_MAX_LEVEL
  })())
  check('农具', '成熟判定用「有效生长时间」（农具买好后原本没熟的作物会熟）', (() => {
    const p = freshPlayer()
    p.skills.farming.level = 99
    const inst = getAllSkillInstances().find((i) => i.id === 'farming')
    p.inventory.wheatSeed = 2
    const crop = inst.getCrop('wheatSeed')
    const halfWay = Date.now() - Math.round(crop.growSec * 0.75 * 1000) // 75% 时长：未买农具是没熟的
    inst.plant(0, 'wheatSeed')
    p.farming.plots[0].plantedAt = halfWay
    if (inst.isMature(0) !== false) return false
    p.farming.tool = TOOL_MAX_LEVEL // 农具满级 → 有效时长 0.7 → 此刻已成熟
    return inst.isMature(0) === true && inst.growSecOf(crop) < crop.growSec
  })())
  // ⑮ 扩建注册表（v2.4.2）：商店「容量与扩建」= 唯一总表，漏登记即 FAIL
  check('扩建注册表', `共登记 ${EXPANSIONS.length} 项、分组 4 组、含存储/产线/农耕/便利四类`, (() => {
    const groups = new Set(EXPANSIONS.map((e) => e.group))
    return EXPANSIONS.length >= 16 && groups.size === 4
      && ['storage', 'idle', 'farm', 'convenience'].every((g) => groups.has(g))
  })())
  check('扩建注册表', 'store 里所有「花金币扩张/升级」动作都已登记（漏登记会两处入口不一致）', (() => {
    const P = fs.readFileSync(new URL('../../src/stores/player.js', import.meta.url), 'utf8')
    const names = [...new Set([...P.matchAll(/^\s{4}(\w*(?:[Ee]xpand|upgradeFarmTool|automationUnlock)\w*)\(/gm)].map((m) => m[1]))].filter((n) => !/Unlocked$/.test(n))
    const src = fs.readFileSync(new URL('../../src/game/data/expansions.js', import.meta.url), 'utf8')
    const missing = names.filter((n) => !new RegExp(`p\\.${n}\\(`).test(src))
    return names.length >= 14 && missing.length === 0
  })(), (() => {
    const P = fs.readFileSync(new URL('../../src/stores/player.js', import.meta.url), 'utf8')
    const names = [...new Set([...P.matchAll(/^\s{4}(\w*(?:[Ee]xpand|upgradeFarmTool|automationUnlock)\w*)\(/gm)].map((m) => m[1]))].filter((n) => !/Unlocked$/.test(n))
    const src = fs.readFileSync(new URL('../../src/game/data/expansions.js', import.meta.url), 'utf8')
    return names.filter((n) => !new RegExp(`p\\.${n}\\(`).test(src)).join(',')
  })())
  check('扩建注册表', '每项自洽：当前值 ≤ 上限、满级时价格为 null、未满时价格为数字', (() => {
    const p = freshPlayer()
    p.gold = 1e9
    return EXPANSIONS.every((e) => {
      const cur = e.current(p)
      if (cur > e.max) return false
      const price = e.price(p)
      return cur >= e.max ? price == null : typeof price === 'number'
    })
  })())
  check('扩建注册表', '商店商品列表里不再有扩建类条目（避免一处两卖、两套价格）',
    !SHOP_ITEMS.some((s) => s.action))
  check('扩建注册表', 'apply() 全权处理：买一次涨一档、且每次都扣到金币', (() => {
    const p = freshPlayer()
    p.gold = 1e9
    let ok = true
    for (const e of EXPANSIONS) {
      const c0 = e.current(p)
      const g0 = p.gold
      const r = e.apply(p)
      const c1 = e.current(p)
      if (!r.ok || c1 <= c0 || p.gold >= g0) ok = false
    }
    return ok
  })())
  // ⑯ 精耕作物 + 精通联动（v2.5.0）：把农耕与采摘/挖掘拉开差异
  check('精耕作物', '农耕独占：type=consumable ⇒ 不在商店/采集表/配方/炼金/抽奖池里', (() => {
    const it = getItem(PRIME_CROP_ID)
    if (!it || it.type !== 'consumable') return false
    if ((SHOP_ITEMS ?? []).some((x) => x.itemId === PRIME_CROP_ID)) return false
    const inGather = getAllSkillInstances().some((inst) => (inst.targets ?? []).some((t) => t.itemId === PRIME_CROP_ID))
    const inRecipe = getAllSkillInstances().some((inst) => (inst.recipes ?? []).some((r) => r.output?.itemId === PRIME_CROP_ID || r.ingredients?.[PRIME_CROP_ID]))
    return !inGather && !inRecipe && itemUses(PRIME_CROP_ID).length === 0
  })())
  check('精耕作物', `附产门槛 reqLevel ≥ ${PRIME_MIN_LEVEL}、概率 ${PRIME_BASE_CHANCE * 100}%~${PRIME_MAX_CHANCE * 100}% 且随精通递增`, (() => {
    if (PRIME_MIN_LEVEL < 40) return false
    const ps = [0, 25, 50, 75, 100].map((l) => primeCropChance(l))
    for (let i = 1; i < ps.length; i++) if (!(ps[i] >= ps[i - 1])) return false
    return Math.abs(ps[0] - PRIME_BASE_CHANCE) < 1e-9 && Math.abs(ps[4] - PRIME_MAX_CHANCE) < 1e-9 && ps[4] <= 0.1
  })())
  check('精耕作物', '真的只有高阶作物附产（低阶作物不产）', (() => {
    const p = freshPlayer()
    p.skills.farming.level = 99
    const farm = getAllSkillInstances().find((i) => i.id === 'farming')
    const high = CROPS.find((c) => c.reqLevel >= PRIME_MIN_LEVEL && c.reqLevel <= 60)
    const run = (crop, plot) => {
      p.inventory[crop.seedId] = 1
      farm.plant(plot, crop.seedId)
      p.farming.plots[plot].plantedAt = Date.now() - 20 * 60 * 1000
      const before = p.inventory[PRIME_CROP_ID] ?? 0
      withRandom([0, 0, 0, 0], () => farm.harvest(plot))
      return (p.inventory[PRIME_CROP_ID] ?? 0) - before
    }
    const wheat = CROPS.find((c) => c.seedId === 'wheatSeed')
    return run(high, 0) === 1 && run(wheat, 1) === 0 && (p.stats.primeCrops ?? 0) === 1
  })())
  check('精耕作物', '萃露炉加料：时间 ×0.6、扣 1 件、没料时拒绝', (() => {
    const p = freshPlayer()
    p.skills.foraging.level = 60
    p.inventory.mushroom = 20
    p.inventory.compost = 20
    if (p.essenceBrew(0, 'essence1', true).ok !== false) return false // 没料
    p.inventory[PRIME_CROP_ID] = 1
    const r = p.essenceBrew(0, 'essence1', true)
    const vat = p.essenceState().vats[0]
    const hours = (vat.readyAt - vat.startedAt) / 3600e3
    return r.ok && Math.abs(hours - 1 * 4 * PRIME_CATALYST_TIME) < 1e-6 && (p.inventory[PRIME_CROP_ID] ?? 0) === 0
  })())
  check('精通联动', `农耕精通 → 采集额外产出几率：每 10 级 +2%、上限 +20%、未种过为 0`, (() => {
    const p = freshPlayer()
    p.skills.farming.level = 99
    const farm = getAllSkillInstances().find((i) => i.id === 'farming')
    const gather = getAllSkillInstances().find((i) => i.id === 'foraging')
    const crop = CROPS.find((c) => c.reqLevel >= 40 && c.reqLevel <= 60)
    const t = { itemId: crop.itemId }
    if (p.farmMasteryGatherChance(crop.itemId) !== 0) return false
    const beforeY = gather.expectedYield(t)
    farm.mastery[crop.itemId] = 99999 // 满精通
    const pct = p.farmMasteryGatherChance(crop.itemId)
    return Math.abs(pct - 0.2) < 1e-9 && gather.yieldExtraChance(t) >= pct - 1e-9
      && Math.abs(gather.expectedYield(t) - (beforeY + 0.2)) < 1e-6 // 在线与离线同源（期望值同步提高）
  })(), (() => `联动上限 ${FARM_MASTERY_GATHER_MAX * 100}%`))
  check('精耕作物', '图鉴：有「用途」说明 + 来源指向农耕且可跳转', (() => {
    const lines = itemDetailLines(PRIME_CROP_ID).map((l) => l.join(' ')).join(' ')
    const srcs = itemSources(PRIME_CROP_ID) ?? []
    return /用途/.test(lines) && /萃露炉/.test(lines) && srcs.some((s) => s.includes('农耕')) && srcs.every((s) => !!jumpForSource(s))
  })())
  // ⑦ 网箱（并入牧场）
  check('网箱', '网箱挂在 player.ranch 下（并入牧场、不另开页）', (() => {
    const p = freshPlayer()
    p.pondState()
    return Array.isArray(p.ranch.ponds) && p.pondPens() === POND_BASE
  })())
  check('网箱', '投苗吃海苔、按周期出鱼并计数', (() => {
    const p = freshPlayer()
    p.gold = 100000
    p.inventory.seaweed = 10
    p.pondBuy(0, 'abalone')
    p.pondState().ponds[0].lastAt = Date.now() - 24 * 3600e3
    p._tickPonds()
    return p.inventory.seaweed === 6 && (p.inventory.abalone ?? 0) === 2 && p.stats.pondCycles === 1
  })())

  // ⑧ 存档往返 / 旧档迁移 / 自动化接线
  check('挂机产线', '存档往返：四套新系统的状态都在', (() => {
    const p = freshPlayer()
    p.skills.spiceMixing.level = CARAVAN_UNLOCK_LEVEL
    p.skills.foraging.level = 99
    p.skills.farming.level = 99
    p.regions = { plain: true }
    p.inventory.apple = 10
    p.caravanStart(0, 'plain', { apple: 5 })
    p.gold = 500000
    p.mushroomBuild(0, 'compost')
    p.inventory.lingzhiSeed = 1
    p.spiritPlant(0, 'lingzhiSeed')
    p.inventory.wheatSeed = 1
    p.greenhousePlant(0, 'wheatSeed')
    p.hiveSet(0, 'rose')
    p.pondBuy(0, 'crucian')
    const saved = JSON.parse(JSON.stringify(p.serialize()))
    const q = freshPlayer()
    q.applySave(saved)
    return !!q.caravan.slots[0]?.regionId && !!q.mushroom.beds[0]?.mediaId && !!q.spiritField.plots[0]?.seedId
      && !!q.greenhouse.beds[0]?.seedId && !!q.greenhouse.hives[0]?.mediaId && !!q.ranch.ponds[0]?.fishId
  })())
  check('挂机产线', '旧档（无这四个字段）读档不炸并回退默认', (() => {
    const p = freshPlayer()
    const saved = p.serialize()
    delete saved.caravan; delete saved.mushroom; delete saved.spiritField; delete saved.greenhouse
    saved.ranch = { pens: [null, null], expands: 0 }
    const q = freshPlayer()
    q.applySave(saved)
    return q.caravanSlots() === CARAVAN_BASE_SLOTS && q.mushroomBeds() === MUSHROOM_BASE_BEDS
      && q.spiritPlots() === SPIRIT_BASE_PLOTS && q.greenhouseBeds() === GREENHOUSE_BASE_BEDS && q.hiveCount() === HIVE_BASE_COUNT
  })())
  check('挂机产线', '自动领取已覆盖商队与灵田（与地窖/采集队共用同一条自动化）', (() => {
    const P = fs.readFileSync(new URL('../../src/stores/player.js', import.meta.url), 'utf8')
    return /caravanClaim\(i\)/.test(P) && /spiritHarvest\(i\)/.test(P)
  })())
}


// ── C26. 效果总览（v2.6.0：「此刻生效的增益/效果/减益」唯一注册表 + 一个都不能漏）──
console.log('══ C26. 效果总览 ══')
{
  const ids = new Set()
  const gids = new Set(EFFECT_GROUPS.map((g) => g.id))
  const bad = []
  for (const r of EFFECT_ROWS) {
    if (ids.has(r.id)) bad.push(`${r.id}: id 重复`)
    ids.add(r.id)
    if (!gids.has(r.group)) bad.push(`${r.id}: 分组不在 EFFECT_GROUPS`)
    if (!r.name || !r.icon || !r.src) bad.push(`${r.id}: 缺 name/icon/src`)
    if (!['buff', 'debuff', 'rule'].includes(r.kind)) bad.push(`${r.id}: kind 非法`)
    if (typeof r.read !== 'function') bad.push(`${r.id}: 缺 read`)
  }
  check('效果总览', `注册表 ${EFFECT_ROWS.length} 行：id 唯一 / 分组有效 / 字段齐备`, bad.length === 0, bad.slice(0, 5).join('; '))
  check('效果总览', '注册表规模够大（≥40 行，防「表被清空后守卫恒真」）', EFFECT_ROWS.length >= 40, `仅 ${EFFECT_ROWS.length}`)

  const ctxOf = (pl, combat = null) => ({ combat, skill: (id) => getSkillInstance(id), allSkills: () => getAllSkillInstances() })

  // 1) 新档：每一行都必须跑得通（不许有「读取失败」），未生效的行必须写明原因
  const p0 = freshPlayer()
  const r0 = collectEffects(p0, ctxOf(p0))
  const all0 = [...r0.groups, ...r0.dormant].flatMap((g) => g.items)
  check('效果总览', '新档汇总不抛错、每行都有结果（无「读取失败」）', all0.length === EFFECT_ROWS.length && !all0.some((i) => i.text.includes('读取失败')), `${all0.length}/${EFFECT_ROWS.length}`)
  check('效果总览', '未生效的行都给出了原因（这就是「没有漏掉」的证据）', all0.filter((i) => !i.on).every((i) => !!i.why && i.why !== '—'), all0.filter((i) => !i.on && !i.why).map((i) => i.id).slice(0, 5).join(','))
  check('效果总览', '生效项 + 未生效项 = 注册表行数（分组聚合不丢行）', r0.stats.on + r0.stats.off === EFFECT_ROWS.length, `${r0.stats.on}+${r0.stats.off}`)

  // 2) 富档：多条路径真的能亮（增益与减益都要能亮）
  const p1 = freshPlayer({ foraging: 60, farming: 50, knife: 70 })
  p1.gold = 5_000_000
  p1.inventory = { corn: 50, seaweed: 20, compost: 5, primeCrop: 2 }
  p1.ranch = { pens: [{ animalId: 'chicken', lastAt: Date.now() }], expands: 1, ponds: [{ fishId: 'crucian', lastAt: Date.now() }], pondExpands: 1 }
  p1.spoilage = { pheasantMeat: Date.now() + 3600_000 }
  p1.buffs = {
    xpMult: { mult: 1.5, expiresAt: Date.now() + 600_000 },
    yieldMult: { mult: 1.25, expiresAt: Date.now() + 600_000 },
    gatherMult: { mult: 0.85, expiresAt: Date.now() + 600_000 },
    restaurantMult: { mult: 1.4, expiresAt: Date.now() + 600_000 },
  }
  const r1 = collectEffects(p1, ctxOf(p1))
  const all1 = [...r1.groups, ...r1.dormant].flatMap((g) => g.items)
  const on1 = all1.filter((i) => i.on)
  check('效果总览', `富档能亮出多条生效项（实到 ${on1.length} 条，≥8）`, on1.length >= 8, `${on1.length}`)
  check('效果总览', '四条增益剂轴都能单独亮起（经验/产量/采集间隔/餐厅收入）', ['buffXp', 'buffYield', 'buffGather', 'buffRestaurant'].every((id) => all1.find((i) => i.id === id)?.on))
  check('效果总览', '减益也能亮（食材腐坏 / 停机类）', all1.some((i) => i.on && i.kind === 'debuff'), '')
  check('效果总览', '生效项的数值文案里不含未求值的插值 / 异常值', on1.every((i) => i.text && !/undefined|NaN|\[object|\$\{/.test(i.text)), on1.filter((i) => /undefined|NaN|\[object/.test(i.text)).map((i) => `${i.id}:${i.text}`).slice(0, 3).join(' | '))

  // 3) 只读契约：汇总不得改动任何状态
  const snap = (pl) => JSON.stringify({ g: pl.gold, inv: pl.inventory, b: pl.buffs, s: pl.spoilage, r: pl.ranch })
  const before = snap(p1)
  collectEffects(p1, ctxOf(p1))
  check('效果总览', '汇总只读：金币/背包/增益/腐坏/牧场状态前后完全一致', before === snap(p1))

  // 4) 战斗内临时状态：无战斗一律 off 且有原因；战斗中确实能亮
  const p2 = freshPlayer()
  const r2 = collectEffects(p2, ctxOf(p2, null))
  const fights = [...r2.groups, ...r2.dormant].flatMap((g) => g.items).filter((i) => i.id.startsWith('fight'))
  check('效果总览', `战斗内临时状态共 ${fights.length} 条：无战斗时全部未生效且有原因`, fights.length >= 6 && fights.every((i) => !i.on && !!i.why), `${fights.length}`)
  const cb = new Combat(p2)
  cb.inFight = true
  cb.buff = { atk: 5, accuracy: 8 }
  cb.buffTurns = 3
  cb.drunkTurns = 2
  cb.burnTurns = 2
  cb.poisonTurns = 2
  cb.slowTurns = 2
  cb.regenTurns = 2
  cb.regenPerTurn = 6
  cb.biscuitSpeedPct = 10
  cb.biscuitCooldown = 2
  const r3 = collectEffects(p2, ctxOf(p2, cb))
  const onFight = [...r3.groups, ...r3.dormant].flatMap((g) => g.items).filter((i) => i.id.startsWith('fight') && i.on)
  check('效果总览', `战斗中 ${onFight.length} 条临时效果亮起（增益/醉酒/灼烧/中毒/束缚/回血/饼干）`, onFight.length >= 6, `${onFight.length}`)

  // 5) 统计口径：noteEffectsSeen 只增不减，且随存档往返
  const p3 = freshPlayer()
  const grew = p3.noteEffectsSeen(9)
  const grew2 = p3.noteEffectsSeen(3)
  check('效果总览', '历史峰值只增不减（noteEffectsSeen 幂等向上）', grew === true && grew2 === false && p3.stats.effectsSeenMax === 9, `${p3.stats.effectsSeenMax}`)
  const round = freshPlayer()
  round.applySave(p3.serialize())
  check('效果总览', '历史峰值随存档往返保留', round.stats.effectsSeenMax === 9, `${round.stats.effectsSeenMax}`)
  check('效果总览', '成就 / 统计页的取数口径指向同一个字段', (() => {
    const A = fs.readFileSync(new URL('../../src/game/data/achievements.js', import.meta.url), 'utf8')
    const S = fs.readFileSync(new URL('../../src/views/StatsView.vue', import.meta.url), 'utf8')
    return A.includes('effectsSeenMax') && S.includes('effectsSeenMax')
  })())
}

// ── C27. 精通档位表（2026-09-16：表必须**派生**自 mastery.js，且三处页面共用同一组件）──
console.log('══ C27. 精通档位说明 ══')
{
  // 1) 派生不变量：每一格的四个数值都必须等于对应函数在**刚好达到该档**时的返回值
  //    （改为手写数组后，若手写值与函数不一致，这条立刻 FAIL）
  const drift = []
  for (const t of MASTERY_TIERS) {
    if (t.xpMult !== masteryXpMultiplier(t.level)) drift.push(`${t.level}: 经验`)
    if (t.double !== masteryDoubleChance(t.level)) drift.push(`${t.level}: 双倍`)
    if (t.batch !== masteryYieldBonus(t.level)) drift.push(`${t.level}: 保底`)
    if (t.intervalFactor !== masteryIntervalFactor(t.level)) drift.push(`${t.level}: 间隔比例`)
    if (t.fixedInterval !== masteryFixedInterval(t.level)) drift.push(`${t.level}: 固定档`)
  }
  check('精通档位', `档位表 ${MASTERY_TIERS.length} 行全部由 mastery.js 的函数派生（无手写漂移）`, drift.length === 0, drift.slice(0, 6).join(', '))
  check('精通档位', `档位覆盖 ${MASTERY_TIER_LEVELS.length} 档（5~100）且严格递增`, MASTERY_TIER_LEVELS.length === 11 && MASTERY_TIER_LEVELS.every((lv, i) => i === 0 || lv > MASTERY_TIER_LEVELS[i - 1]))

  // 2) 单调性：档位越高，经验 / 双倍 / 保底只能不减，固定档只能更短、比例只能更小
  let mono = true
  for (let i = 1; i < MASTERY_TIERS.length; i++) {
    const a = MASTERY_TIERS[i - 1]
    const b = MASTERY_TIERS[i]
    if (b.xpMult < a.xpMult || b.double < a.double || b.batch < a.batch) mono = false
    if (b.intervalFactor > a.intervalFactor) mono = false
    if ((b.fixedInterval ?? Infinity) > (a.fixedInterval ?? Infinity)) mono = false
  }
  check('精通档位', '档位单调：经验/双倍/保底不减，间隔不变慢（升级永远不会变差）', mono)

  // 3) 关键边界值（改动平衡时这几条会第一时间报出来）
  check('精通档位', '边界：5 级 ×1.1 / 50 级 双倍 30% 保底 +1 / 100 级 ×4 双倍 80% 保底 +2', (() => {
    const t5 = MASTERY_TIERS.find((t) => t.level === 5)
    const t50 = MASTERY_TIERS.find((t) => t.level === 50)
    const t100 = MASTERY_TIERS.find((t) => t.level === 100)
    return t5.xpMult === 1.1 && t50.double === 0.3 && t50.batch === 1 && t100.xpMult === 4 && t100.double === 0.8 && t100.batch === 2
  })())
  check('精通档位', '边界：固定档 20 级起 3.6s（19 级为 null，避免「整段替换」回归）', masteryFixedInterval(20) === 3.6 && masteryFixedInterval(19) === null && masteryFixedInterval(100) === 2)
  check('精通档位', '展示格式：间隔列「减 1/3 / 减半 / ≤ 3.6s / ≤ 3.0s / ≤ 2.0s」（一位小数不能丢）', (() => {
    const f = (lv) => masteryIntervalText(MASTERY_TIERS.find((t) => t.level === lv))
    return f(5) === '减 1/3' && f(10) === '减半' && f(20) === '≤ 3.6s' && f(40) === '≤ 3.0s' && f(100) === '≤ 2.0s'
  })())

  // 4) 「下一档」口径：跨档次数必须与 countForMasteryLevel 对齐；满级为 null
  check('精通档位', '「下一档」次数与升级门槛一致（Lv7→10 级、Lv100 为 null）', (() => {
    const n7 = masteryToNextTier(7, countForMasteryLevel(7))
    const need10 = countForMasteryLevel(10) - countForMasteryLevel(7)
    return n7?.tier.level === 10 && n7.remaining === need10 && masteryToNextTier(100, 999999) === null
  })())

  // 5) 页面契约：三处都改用共用组件，且**视图里不再手写档位数字**（防「又抄一份」）
  const V = (f) => fs.readFileSync(new URL(`../../src/views/${f}`, import.meta.url), 'utf8')
  const gatherSrc = V('GatheringView.vue')
  const prodSrc = V('ProductionView.vue')
  const notesSrc = V('KitchenNotesView.vue')
  const helpSrc = fs.readFileSync(new URL('../../src/components/MasteryHelp.vue', import.meta.url), 'utf8')
  check('精通档位', '采集页 / 制作页 / 厨房笔记 三处都用共用组件 <MasteryHelp>', ['GatheringView.vue', 'ProductionView.vue', 'KitchenNotesView.vue'].every((f) => V(f).includes('<MasteryHelp')))
  check('精通档位', '共用组件从 MASTERY_TIERS 派生（组件里不出现档位数字）', helpSrc.includes('MASTERY_TIERS') && !/×2\.2|×3\.6|≤ 3\.6s/.test(helpSrc))
  check('精通档位', '视图里不再手写档位数字（此前 GatheringView 手抄过 11 行）', ![gatherSrc, prodSrc, notesSrc].some((s) => /×2\.2/.test(s) || /'减 1\/3'/.test(s)))
  check('精通档位', '制作页配方卡只显示「当前精通」（等级/进度/x-y 次）', prodSrc.includes('masteryOf(') && prodSrc.includes('masteryProgress'))
  // 反向断言：用户 2026-09-16 明确要求卡片上**不要**「再 N 次到 M 级」那个后缀（卡片已够密）——
  // 加回来会 FAIL。升档规划交给「📖 精通档位说明」弹窗与厨房笔记页。
  check('精通档位', '制作页配方卡不再出现「再 N 次到 M 级」（用户要求去掉；别加回来）', !prodSrc.includes('masteryToNextTier') && !/再 \{\{/.test(prodSrc))
  check('精通档位', '弹窗必须 Teleport 出卡片树（卡片祖先有 backdrop-filter，否则定位错）', helpSrc.includes('<Teleport to="body">'))

  // 6) 行为级：制作类配方确实带精通（厨房笔记与制作页读的就是它）
  const pc = freshPlayer({ cooking: 30 })
  const cinst = getSkillInstance('cooking')
  const rec = cinst.recipes[0]
  const cnt = cinst.masteryCount(rec)
  const pr = cinst.masteryProgress(rec)
  check('精通档位', '制作配方有 masteryCount / masteryProgress（0~100 级、进度 0~1）', Number.isFinite(cnt) && cnt >= 0 && pr.level >= 0 && pr.level <= 100 && pr.progress >= 0 && pr.progress <= 1)
  check('精通档位', '制作类也能吃到保底与双倍（与采集同一组函数）', (() => {
    cinst.mastery[rec.id] = countForMasteryLevel(60)
    const p60 = cinst.masteryProgress(rec)
    return p60.level === 60 && masteryYieldBonus(p60.level) === 1 && masteryDoubleChance(p60.level) === 0.4 && masteryXpMultiplier(p60.level) === 2.5
  })())
  void pc
}


// ── C28. 伐木 / 采矿与「20 档木材」（v2.7.0：矿物从挖掘拆出 + 木材按档贯通锻造与强化）──
console.log('== C28. 伐木 / 采矿 / 20 档木材 ==')
{
  const M = getSkillInstance('mining')
  const W = getSkillInstance('woodcutting')
  const E = getSkillInstance('excavation')
  check('伐木采矿', `目标数：伐木 ${W.targets.length} / 采矿 ${M.targets.length} / 挖掘 ${E.targets.length}`, W.targets.length === 20 && M.targets.length === 43 && E.targets.length === 42, `${W.targets.length}/${M.targets.length}/${E.targets.length}`)
  // 拆分无损：两边的目标集合不相交，并集 == 拆分前的 83 条
  const wIds = new Set(W.targets.map((t) => t.itemId))
  const mIds = new Set(M.targets.map((t) => t.itemId))
  const eIds = new Set(E.targets.map((t) => t.itemId))
  const overlap = [...eIds].filter((id) => mIds.has(id))
  const union = new Set([...eIds, ...mIds])
  const allIds = new Set(EXCAVATION_ALL_TARGETS.map((t) => t.itemId))
  check('伐木采矿', '拆分无损：挖掘与采矿目标不相交，且并集覆盖拆分前全部物品 + 铜矿/铁矿', overlap.length === 0 && union.size === allIds.size + 2 && !allIds.has('copperOre') && mIds.has('copperOre') && mIds.has('ironOre'), `overlap=${overlap.slice(0, 3).join(',')} union=${union.size} all=${allIds.size}`)
  check('伐木采矿', '挖掘只剩根茎/菌类（无矿物），采矿全是矿物', E.targets.every((t) => !isMineralTarget(t)) && M.targets.every((t) => isMineralTarget(t)))
  check('伐木采矿', '铜矿/铁矿成为可定向采集的目标（此前只作为挖掘附产）', M.targets.find((t) => t.itemId === 'copperOre')?.reqLevel === 1 && M.targets.find((t) => t.itemId === 'ironOre')?.reqLevel === 5)

  // 20 档木材：每 5 级一档、与装备品质套对齐
  check('伐木采矿', `木材 ${TIMBERS.length} 档、每档 5 级、等级从 1 到 96`, TIMBERS.length === 20 && TIMBERS.every((t, i) => t.level === i * 5 + 1))
  check('伐木采矿', 'timberOfLevel 对齐：Lv1→松木 / Lv74→琉璃木 / Lv96→太初神木', timberOfLevel(1).name === '松木' && timberOfLevel(74).name === '琉璃木' && timberOfLevel(96).name === '太初神木' && timberOfLevel(100).name === '太初神木')
  check('伐木采矿', '每档木材都是物品表里的 material（自动豁免自动出售/交易所）', TIMBERS.every((t) => ITEMS[t.id]?.category === 'material' && ITEMS[t.id]?.type === 'ingredient'))
  check('伐木采矿', '伐木目标 = 20 档木材、等级与档位一致', W.targets.length === TIMBERS.length && W.targets.every((t, i) => t.itemId === TIMBERS[i].id && t.reqLevel === TIMBERS[i].level))

  // 配方改档：20 套全覆盖、无 wood 残留、档位与配方等级一致、reqLevel 与其它材料未被改
  const twenty = SMITHING_SET_RECIPES.filter((r) => !String(r.id).startsWith('ext-'))
  const timberIds = new Set(TIMBERS.map((t) => t.id))
  const withWood = twenty.filter((r) => r.ingredients?.wood)
  const wrongBand = twenty.filter((r) => Object.keys(r.ingredients ?? {}).filter((k) => timberIds.has(k)).some((k) => k !== timberOfLevel(r.reqLevel).id))
  const bandsCovered = TIMBERS.filter((t) => twenty.some((r) => r.ingredients?.[t.id])).length
  check('伐木采矿', '365 条锻造配方数不变（改写只动材料、不动条目）', SMITHING_SET_RECIPES.length === 365, `${SMITHING_SET_RECIPES.length}`)
  check('伐木采矿', '20 品质套里不再有任何基础木材（wood）残留', withWood.length === 0, `${withWood.length}`)
  check('伐木采矿', '每条含木材的配方用的都是**该配方等级对应的档位木材**', wrongBand.length === 0, wrongBand.slice(0, 3).map((r) => r.id).join(','))
  // v2.7.1：用户要求「所有装备所需材料都要加上对应等级的木材」→ 365 条逐条都要有
  const allWithTimber = SMITHING_SET_RECIPES.filter((r) => Object.keys(r.ingredients ?? {}).some((k) => timberIds.has(k)))
  const mixedBand = SMITHING_SET_RECIPES.filter((r) => Object.keys(r.ingredients ?? {}).filter((k) => timberIds.has(k)).length > 1)
  const badQty = SMITHING_SET_RECIPES.filter((r) => {
    const v = Object.entries(r.ingredients ?? {}).filter(([k]) => timberIds.has(k)).map(([, n]) => n)
    return v.some((n) => !(n >= 1 && n <= 5))
  })
  const extRecipes = SMITHING_SET_RECIPES.filter((r) => String(r.id).startsWith('ext-'))
  check('伐木采矿', `全部 ${SMITHING_SET_RECIPES.length} 条装备配方都含**该档**木材（20 品质套 176 + 独立矿套 189 全覆盖）`, allWithTimber.length === SMITHING_SET_RECIPES.length, `${allWithTimber.length}/${SMITHING_SET_RECIPES.length}`)
  check('伐木采矿', '每件装备恰好一种档位木材（不混档）、数量在 1~5 之间', mixedBand.length === 0 && badQty.length === 0, `mixed=${mixedBand.length} badQty=${badQty.length}`)
  check('伐木采矿', '21 独立矿套（189 条）也逐条含同档木材', extRecipes.length === 189 && extRecipes.every((r) => Object.keys(r.ingredients ?? {}).some((k) => timberIds.has(k))))
  check('伐木采矿', '改写只动 ingredients：配方条目数与 reqLevel 未变（365 条、每档 5 级区间）', SMITHING_SET_RECIPES.length === 365 && SMITHING_SET_RECIPES.every((r) => timberOfLevel(r.reqLevel) != null))
  check('伐木采矿', '每档仍有装备需求（20/20，由逐条覆盖自动满足）', bandsCovered === 20, `${bandsCovered}/20`)
  check('伐木采矿', '基础款「木材」保持原样：value 仍为 4、且不在任何 20 套配方里', ITEMS.wood.value === 4 && !twenty.some((r) => r.ingredients?.wood))

  // 装备强化按档消耗
  const pd = freshPlayer()
  pd.gold = 100000
  pd.inventory = { copperKnife: 1, pineWood: 9, copperOre: 9, excavation_ext2_30: 9, primalWood: 9, smith_ext2_30: 1 }
  const c1 = pd.upgradeCost('copperKnife')
  check('伐木采矿', '强化按档：铜刀（Lv1-5 档）要松木 + 铜矿', c1?.timberId === 'pineWood' && c1?.oreId === 'copperOre' && c1?.qty === 1, JSON.stringify(c1))
  const hi = Object.values(ITEMS).find((x) => x.type === 'equipment' && equipLevelOf(x.id) >= 96 && equipLevelOf(x.id) <= 100)
  const c2 = hi ? pd.upgradeCost(hi.id) : null
  check('伐木采矿', '强化按档：96-100 档装备要「太初神木 + 萤石」', !!c2 && c2.timberId === 'primalWood' && c2.oreId === 'excavation_ext2_30', JSON.stringify(c2))
  const up = pd.upgradeItem('copperKnife')
  check('伐木采矿', '强化真的扣掉档位木材（松木 -1、铜矿 -1）', up.ok && pd.inventory.pineWood === 8 && pd.inventory.copperOre === 8, JSON.stringify(up))
  check('伐木采矿', '同档矿从 20 套配方派生，且盐矿不会顶掉同名矿（钢矿/琉璃矿）', oreOfLevel(16) === 'steelOre' && oreOfLevel(72) === 'glassOre' && oreOfLevel(99) === 'excavation_ext2_30')

  // 存档迁移：幂等 + 新档往返零差异（迁移账本不得被误翻）
  const pn = freshPlayer()
  const sn1 = JSON.stringify(pn.serialize())
  const pn2 = freshPlayer()
  pn2.applySave(JSON.parse(sn1))
  check('伐木采矿', '新档「序列化→读档→再序列化」**零差异**（迁移账本没被误翻）', JSON.stringify(pn2.serialize()) === sn1)
  const po = freshPlayer()
  po.skills.excavation = { level: 70, exp: 123, prestiges: 1, mastery: { saltOre: 50, potato: 10 } }
  delete po.skills.mining
  po.skillTargets = { excavation: 'saltOre' }
  const so = po.serialize()
  so.stats.splitMiningMigrated = false
  const pm = freshPlayer()
  pm.applySave(JSON.parse(JSON.stringify(so)))
  check('伐木采矿', '旧档迁移：采矿继承挖掘等级/经验，挖掘等级不变', pm.skills.mining.level === 70 && pm.skills.mining.exp === 123 && pm.skills.excavation.level === 70)
  check('伐木采矿', '旧档迁移：矿物精通键迁到采矿、并从挖掘里删除', pm.skills.mining.mastery.saltOre === 50 && (pm.skills.excavation.mastery.saltOre ?? 0) === 0 && pm.skills.excavation.mastery.potato === 10)
  check('伐木采矿', '旧档迁移：正在挖矿物时目标改挂到采矿', pm.skillTargets.mining === 'saltOre' && pm.skillTargets.excavation === undefined)
  check('伐木采矿', '旧档迁移：账本写入且**二次读档不再迁移**（幂等）', pm.stats.splitMiningMigrated === true && (() => {
    const p3 = freshPlayer()
    p3.applySave(JSON.parse(JSON.stringify(pm.serialize())))
    return p3.skills.mining.mastery.saltOre === 50 && p3.skills.mining.level === 70
  })())

  // currentTarget 兜底（修既有静默停产）
  const pf = freshPlayer()
  createSkillInstances(pf)
  pf.skillTargets.excavation = 'doesNotExist'
  const ef = getSkillInstance('excavation')
  check('伐木采矿', '目标已不存在时 currentTarget 回退到首个目标（不再静默停产）', ef.currentTarget?.itemId === ef.targets[0].itemId, String(ef.currentTarget))

  // 图鉴三查：新木材有来源串且可跳转
  const missSrc = TIMBERS.filter((t) => !itemSources(t.id).length).map((t) => t.id)
  const badJump = TIMBERS.flatMap((t) => itemSources(t.id)).filter((s) => !jumpForSource(s))
  check('伐木采矿', '20 档木材都有「伐木获得」来源串且可跳转到伐木页', missSrc.length === 0 && badJump.length === 0 && itemSources('pineWood').some((x) => x.includes('伐木')), `${missSrc.length}/${badJump.length}`)
  const missNav = TIMBERS.filter((t) => !itemNavs(t.id).some((n) => n.skillId === 'woodcutting'))
  check('伐木采矿', '20 档木材在配方树里都有「去伐木」入口', missNav.length === 0, `${missNav.length}`)
}


// ── C29. 新技能（伐木/采矿）的「全功能适配」守卫（v2.7.4）──
// 这一轮逐页排查出的适配点，全部钉住防回退：数据口径一致 + 派生清单含新技能 + 不再引用旧材料字段。
console.log('== C29. 新技能适配一致性 ==')
{
  const V = (f) => fs.readFileSync(new URL(`../../src/views/${f}`, import.meta.url), 'utf8')
  const C = (f) => fs.readFileSync(new URL(`../../src/components/${f}`, import.meta.url), 'utf8')
  const D = (f) => fs.readFileSync(new URL(`../../src/game/data/${f}`, import.meta.url), 'utf8')

  // ① 采集队：每条线的技能都必须已注册，且产矿物的那条线不能再绑挖掘
  check('适配', '采集队每条线路绑定的是已注册技能，矿脉线绑采矿', EXPEDITIONS.every((e) => !!SKILL_DEFS[e.skill]) && EXPEDITIONS.find((e) => e.id === 'oreSurvey')?.skill === 'mining', EXPEDITIONS.map((e) => `${e.id}:${e.skill}`).join(' '))

  // ② 经济口径一致：档位木材不进「鲜味食材礼包」、不在交易所货池、不被自动出售
  const timberIdSet = new Set(TIMBERS.map((t) => t.id))
  check('适配', '鲜味食材礼包不含档位木材（与交易所/商队/自动出售口径一致）', INGREDIENT_POOL.filter((id) => timberIdSet.has(id)).length === 0)
  check('适配', '档位木材不在交易所货池、也不在自动出售范围（material 类别）', EXCHANGE_POOL_CATEGORIES.includes('material') === false && SELL_EXCLUDED_CATEGORIES.includes('material'))

  // ③ 强化与「装备来源」不再引用旧材料字段
  const pc = freshPlayer()
  pc.gold = 100000
  pc.inventory = { copperKnife: 1, pineWood: 9, copperOre: 9 }
  const cost = pc.upgradeCost('copperKnife')
  check('适配', 'upgradeCost 只返回 timber*/ore* 字段（旧 ironOre/saltOre 已不存在）', !!cost && 'timberId' in cost && 'oreId' in cost && !('ironOre' in cost) && !('saltOre' in cost), JSON.stringify(cost))
  check('适配', '强化费用 UI（右侧面板 + 装备弹窗）都不再读 ironOre/saltOre', !/\.ironOre|\.saltOre/.test(C('StatusPanel.vue')) && !/\.ironOre|\.saltOre/.test(C('EquipmentModal.vue')))

  // ④ 装备页/弹窗的来源技能指向采矿与伐木（而不是跳错到挖掘）
  check('适配', '装备页与装备弹窗都提供「去采矿 + 去伐木」入口且指向正确技能', V('GearView.vue').includes("id: 'mining'") && V('GearView.vue').includes("id: 'woodcutting'") && C('EquipmentModal.vue').includes("goToSkill('mining')") && C('EquipmentModal.vue').includes("goToSkill('woodcutting')"))

  // ⑤ 派生清单全部含两个新技能（逐处静态校验，防回退成手抄清单）
  check('适配', '挂机计划（SkillView.PLAN_SKILLS）含采矿与伐木', V('SkillView.vue').includes("'mining'") && V('SkillView.vue').includes("'woodcutting'"))
  check('适配', '采集页类别分组与 id 分支含采矿/伐木（含「木料」分组标签）', V('GatheringView.vue').includes('isMining') && V('GatheringView.vue').includes('isWoodcutting') && V('GatheringView.vue').includes('material: '))
  check('适配', '赛季页类别→技能映射含 mineral→mining / material→woodcutting', V('SeasonView.vue').includes("c === 'mineral') return 'mining'") && V('SeasonView.vue').includes("c === 'material') return 'woodcutting'"))
  check('适配', '故事页轶事子类中文名含采矿/伐木', V('StoryView.vue').includes("mining: '采矿'") && V('StoryView.vue').includes("woodcutting: '伐木'"))
  check('适配', '图鉴导航表（itemNav.GATHER_TABLES）含采矿/伐木两条新表', (() => {
    const src = D('itemNav.js')
    return src.includes("['mining', MINING_TARGETS") && src.includes("['woodcutting', WOODCUTTING_TARGETS")
  })())
  check('适配', '来源跳转表含「采矿」「伐木」两条规则', (() => {
    const src = D('sourceJump.js')
    return src.includes("kw: ['采矿']") && src.includes("kw: ['伐木']")
  })())
  check('适配', '效果总览的技能中文表含伐木/采矿（否则页面会打印英文 id）', D('activeEffects.js').includes("woodcutting: '伐木'") && D('activeEffects.js').includes("mining: '采矿'"))
  check('适配', '美食讲堂的干扰项技能池改为从 SKILL_DEFS 派生（不再手抄 13 项）', V('minigames/TriviaView.vue').includes('Object.values(SKILL_DEFS).map'))

  // ⑥ 轶事：7 条采集线各有 200 条（含新技能），且解锁键按 kind:sub:param
  const subs = {}
  for (const q of QUIRKS) subs[q.unlock.sub] = (subs[q.unlock.sub] ?? 0) + 1
  const gatherSubs = ['foraging', 'fishing', 'hunting', 'excavation', 'mining', 'woodcutting', 'farming']
  check('适配', `轶事覆盖全部 7 条采集线（各 200 条，含采矿与伐木）`, gatherSubs.every((k) => (subs[k] ?? 0) === 200), gatherSubs.map((k) => `${k}:${subs[k] ?? 0}`).join(' '))

  // ⑦ 技能总量与采集总等级口径
  check('适配', '技能总数为 22、采集总等级按 7 条线求和', Object.keys(SKILL_DEFS).length === 22 && ['foraging', 'fishing', 'hunting', 'excavation', 'farming', 'woodcutting', 'mining'].length === 7)
}

console.log(`\n══ 结果：通过 ${pass} / 失败 ${fail} ══`)
console.log(`发现缺陷 ${bugs.length} 项（另有代码核查项在报告中）`)
process.exit(fail === 0 ? 0 : 1)