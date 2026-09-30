// 系统测试 — 对照《美食放置：食灵山海》需求文档的全面回归
// 运行：node scripts/ci/system_test.mjs
// 覆盖：技能经验/产出、联动链、对决（伤害/克制/命中/暴击/胜负）、装备、
//       离线（80%效率/12h上限/跨天）、存档（往返/迁移/导入导出）、背包、经济、
//       成就图鉴、数值安全（除零/NaN/越界）
import fs from 'node:fs'
// 「不许出现某某写法」的静态断言必须先剥注释：本项目踩过两次（`bgm_audit` 被「已删 🔊」那句注释
// 弄成恒 FAIL）——注释里写「不要手写 3750」本身就会让 `/3750/` 命中，属于同一个坑。
import { stripComments, stripHtmlComments } from './lib/comments.mjs'
import { otherChance } from '../../src/game/data/difficulty.js' // 轴比值守卫的分母也要走难度系数出口
import { MIJIAN_POOLS, poolItems } from '../../src/game/data/mijianDraws.js'
import { DAILY_POOL, WEEKLY_POOL, DAILY_BONUS } from '../../src/game/data/dailyTasks.js'
import { GUILDS } from '../../src/game/data/guilds.js'
import { SKILL_DEFS, SKILL_CATEGORIES } from '../../src/game/data/skills.js'
import { QUIRKS } from '../../src/game/data/tales_ext.js'
import { deluxeSellable } from '../../src/game/data/gameShopPools.js'
import { materialFoodItems } from '../../src/game/data/mijianDraws.js'
import { SEED_MAP } from '../../src/game/data/farmSeeds.js'
import { STAGE_INFO } from '../../src/game/data/spiritStories.js'
import { GEAR_RANKS } from '../../src/game/data/gearContest.js'
import { TRIALS } from '../../src/game/data/trials.js'
import { CHALLENGES } from '../../src/game/data/weeklyChallenge.js'
import { COMBAT_REGIONS, COMBAT_BOSSES, STYLE_ADVANTAGE, opp } from '../../src/game/data/combat.js'
import { GUILD_SHOP } from '../../src/game/data/guilds.js'
import { sourceIds } from '../../src/game/data/itemSources.js'
import { ITEM_LEVEL } from '../../src/game/data/combatLoot.js' // 材料等级优先查这张表（见 materialLevelOf）
import { SELL_EXCLUDED_CATEGORIES } from '../../src/game/data/automation.js'
import { EXCHANGE_POOL_CATEGORIES } from '../../src/game/data/exchange.js'
import { INGREDIENT_POOL } from '../../src/game/data/gameShopPools.js'
import { itemNavs } from '../../src/game/data/itemNav.js'
import { EXCAVATION_ALL_TARGETS, MINING_TARGETS, isMineralTarget } from '../../src/game/skills/ExcavationSkill.js'
import { oreOfLevel, equipmentLevelOf as equipLevelOf } from '../../src/game/data/timberRecipes.js'
import { TIMBERS, timberOfLevel } from '../../src/game/data/timbers.js'
import { SMITHING_SET_RECIPES } from '../../src/game/data/smithSetExt.js'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getSkillInstance, getAllSkillInstances } from '../../src/game/skills/registry.js'
import { scaledEnemy } from '../../src/game/data/enemyScaling.js' // C59：与战斗同源的血量分档出口
import { Combat, setCombatInstance } from '../../src/game/combat/Combat.js'
import { ForagingSkill } from '../../src/game/skills/ForagingSkill.js'
import { countForMasteryLevel, masteryXpMultiplier, masteryXpMultiplierRaw, MASTERY_XP_BONUS_SCALE, MASTERY_TIERS, MASTERY_TIER_LEVELS, masteryIntervalText, masteryToNextTier, masteryFixedInterval, masteryDoubleChance, masteryYieldBonus, masteryIntervalFactor } from '../../src/game/core/mastery.js'
import { XP_STACK_DAMPING, dampXpStack, LOW_TARGET_GAP, LOW_TARGET_XP_MULT, lowTargetRefLevel, targetLevelXpMult } from '../../src/game/core/growthRate.js'
import { PRESTIGE_XP_BONUS } from '../../src/game/skills/Skill.js'
import { MATERIAL_COST_MULT, materialQty, effIngredients, materialTotal } from '../../src/game/data/materialCost.js'
import { EXPEDITIONS } from '../../src/game/data/expeditions.js'
import { EQUIPMENT_SETS, equipSetBonuses, equipSetOf } from '../../src/game/data/equipSets.js'
import { LATE_GEAR_IDS } from '../../src/game/data/lateGear.js'
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
import { CAP_MAX, CAP_BASE, PAID_CAP_MAX, STORAGE_BASE, STORAGE_MAX, STORAGE_PAID_MAX, DERIVED_MAX, OFFLINE_CAP, OFFLINE_LEVEL_STEPS, offlineBaseHoursForLevel, safeCap, XP_MULTIPLIER_OPTIONS, safeXpMultiplier } from '../../src/game/data/caps.js'
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
import { CROPS, FARM_BASE_YIELD } from '../../src/game/skills/FarmingSkill.js'


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
// 副业四支（v2.10.0）——SPIRITS / itemImage / SHANHAI_NODES / CARAVAN_* / SELL_* 均已在别处导入，勿重复
import { skillCategoriesOfTab } from '../../src/game/data/skills.js'
import { WOODWORKING_ITEMS, WOODWORKING_RECIPES, CRAFTED_DECOR, WOODWORK_CATEGORY, decorOfWoodwork } from '../../src/game/data/woodworking.js'
import { RESTAURANT_DECOR, RESTAURANT_DECOR_BY_ID, DECOR_TOTAL } from '../../src/game/data/restaurantDecor.js'
import { CARAVAN_CARGO_TYPES, CARAVAN_EXCLUDE_CATEGORIES } from '../../src/game/data/caravan.js'
import {
  SIDELINE_ITEMS, SIDELINE_RECIPES, SIDELINE_WORKS, SIDELINE_SKILL_LIST, SIDELINE_SKILL_IDS,
  SIDELINE_ITEM_CATEGORIES, SIDELINE_AXES, SIDELINE_AXIS_TOTALS, sidelineWorkOf,
  SIDELINE_PRODUCTS, SIDELINE_LADDERS, SIDELINE_LADDER_SKILL_IDS, LADDER_TIERS,
  pointsOfLevel, ladderTierOf, ladderNextOf, ladderTotalOf, sidelineSkillOfItem, LADDER_AXIS_LABEL,
} from '../../src/game/data/sidelineWorks.js'
import { CELLAR_SLOT_VALUE_BASE, CELLAR_SLOT_VALUE_MAX } from '../../src/game/data/caps.js'
import {
  MARKET_EVENTS, activeMarketEvents as activeMarketEventsPure, marketEventsWithNightExtension,
  nightMarketEndHour, NIGHT_MARKET_MAX_EXTRA_HOURS, NIGHT_MARKET_BASE_MULT, NIGHT_MARKET_MAX_EXTRA_MULT,
} from '../../src/game/data/marketEvents.js'
import { MICHELIN_FACTORS } from '../../src/game/data/michelin.js'
import { nextOrderDelay } from '../../src/game/data/restaurantOrders.js'
import { sellPriceOf, buyPriceOf } from '../../src/game/data/exchange.js'
import { makeOrder } from '../../src/game/data/restaurantOrders.js'
import { APPRENTICE_MAX_LEVEL } from '../../src/game/data/legacy.js'
import { SKILL_CN } from '../../src/game/data/activeEffects.js'

/** 木器图片是否存在（图鉴的 @error 会静默隐藏破图，只有查文件才能发现缺图） */
const imgExists = (id) => {
  const rel = itemImage(id)
  return !!rel && fs.existsSync(fileURLToPath(new URL('../../public/' + rel, import.meta.url)))
}
/** 某档木材的等级（C32 校验「木器配方吃的是同档木材」用） */
const timberLevelOf = (id) => TIMBERS.find((t) => t.id === id)?.level ?? null
/** 某物品的最低获取等级（C33 校验辅料不超纲用；解析「XX获得（LvN 解锁）」来源串，非数值断言） */
/**
 * 材料的「获取等级」：**优先查生成的物品等级表**（`combatLoot.ITEM_LEVEL`），查不到才退回解析来源串。
 * ⚠️ 2026-09-27：图鉴来源串里的等级已从「表内原始等级」改成与配方卡一致的**生效等级**（原先 68 条对不上），
 *   于是「把显示文案当数据用」的做法会让本守卫误判 —— 实测它先把 `preserving_ext_26` 读成生效 Lv90，
 *   再拿它去卡一条 Lv81 的副业配方（原始表里那条是 85，本来不超纲）。
 *   **显示文案不是数据源**：能查等级表就查等级表，解析不到才退而求其次。
 */
const materialLevelOf = (id) => {
  if (ITEM_LEVEL[id] != null) return ITEM_LEVEL[id]
  const ms = itemSources(id).map((s) => s.match(/Lv(\d+)/)).filter(Boolean).map((m) => parseInt(m[1], 10))
  return ms.length ? Math.min(...ms) : null
}

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
import { totalXpForLevel, xpProgress, xpRequiredForLevelUp } from '../../src/game/core/Experience.js'
import { migrateGearMods, GEAR_MODS_MAX } from '../../src/game/data/gearMods.js' // C39 词条按装备 id 存
import { NEWBIE_STEPS, NEWBIE_TOTAL, rewardText } from '../../src/game/data/newbieChain.js' // C40 新手目标链
import { initCelebrations } from '../../src/game/core/celebrations.js' // C41 大反馈演出
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

/**
 * 读仓库根下的源文件（路径写全，如 `'src/views/SkillView.vue'`）。
 * 「不许出现某某写法」类静态断言**必须先剥注释**（注释里举例说明本身就会让正则命中）；
 * C62~C64 三块共用它 —— 原先它们各自写 `rd(...)`，而 `rd` 是**别的块**里的局部常量，
 * 结果整块在运行到那一行时抛 `ReferenceError`（等于这几十条断言一条都没跑过）。
 */
const rdSrc = (p) => stripHtmlComments(stripComments(fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')))

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
  // ⚠️ 材料一律按**生效用量**发放（`effIngredients`，含全局材料系数）：手写原始数量会在调系数时集体失效
  const grantMats = (pl, rec) => { for (const [mid, q] of Object.entries(effIngredients(rec))) pl.gainItem(mid, q) }
  const rSalt = sm.recipes.find((r) => r.id === 'salt')
  grantMats(p, rSalt)
  withRandom([0.0], () => sm.craft(rSalt))
  const rPepperSalt = sm.recipes.find((r) => r.id === 'pepperSalt') // 嫩花椒（2026-09 recipeBalance 嫩化：低阶配方用嫩替代）
  grantMats(p, rPepperSalt)
  withRandom([0.0], () => sm.craft(rPepperSalt))
  check('联动', '盐矿→食盐→椒盐', p.inventory.pepperSalt === 1, JSON.stringify(p.inventory.pepperSalt))
  p.setSkillState('cooking', { level: 18, exp: totalXpForLevel(18) })
  const rRabbit = ck.recipes.find((r) => r.id === 'ironPlateRabbit')
  grantMats(p, rRabbit)
  withRandom([0.0], () => ck.craft(rRabbit))
  check('联动', '椒盐入菜：铁板兔肉', p.inventory.ironPlateRabbit === 1, JSON.stringify(p.inventory.ironPlateRabbit))
  // 锻造链：同档木材/铜矿→铜刀→对决属性（v2.7.0：铜刀属 Lv1-5 档 → 松木 + 铜矿）
  const p2 = freshPlayer({ craftsmithing: 5, knife: 5, tasteAcumen: 1, heatControl: 1 })
  const cfs = getSkillInstance('craftsmithing')
  const rKnife = cfs.recipes.find((r) => r.output?.itemId === 'copperKnife')
  grantMats(p2, rKnife)
  withRandom([0.0], () => cfs.craft(rKnife))
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
  //    ⚠️ 2026-09-18 起词条**按装备 id 存**（`{ [itemId]: { mods, at } }`），不再是 `gearMods[slot]`；
  //    旧写法 `p2.gearMods?.weapon?.mods ?? []` 会恒为空数组、断言变成空断言（本轮据此改口径）。
  const p2 = freshPlayer({ craftsmithing: 5 })
  p2.gainItem('copperKnife', 1)
  p2.equip('copperKnife')
  const mods = p2.gearModsOf('copperKnife')
  check('词条', '穿戴生成词条（普通 0-1 条）', Array.isArray(mods) && mods.length <= 1)
  p2.gold = 100000
  const rr = p2.rerollGearMod('weapon')
  check('词条', '洗练成功扣费（普通 400 金）', rr.ok === true && p2.gold === 100000 - 400)
  check('词条', '词条并入装备面板', p2.equippedStats.attack >= getItem('copperKnife').stats.attack)
  p2.gearMods.copperKnife = { mods: [{ stat: 'goldPct', label: '金币', value: 100 }], at: Date.now() }
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
  const app = COMBAT_REGIONS[0].opponents[0] // L1 学徒厨师：hp18 def2 eva5.5 acc12 atk1.7（血量分档后 ×2 = 36）
  combat.start(app)
  // 玩家攻击（强制命中、不暴击）：dmg = floor(15 × 1.0 × (1-2/102)) = floor(14.7) = 14
  // ⚠️ 基准血量取**引擎里的那一份**（，已含血量分档），别再写死 18 —— 
  //    否则每次调分档表都要回来改这条「测伤害公式」的断言（C46b 已单独钉住分档本身）
  const maxHp = combat.opponent.hp
  withRandom([0.0, 0.9], () => combat.resolveTurn())
  check('对决', '伤害公式精确（15攻 vs def2 → 14）', combat.opponentHp === maxHp - 14, `hp=${combat.opponentHp}（上限 ${maxHp}）`)
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
  const stallMax = combat.opponent.hp // 引擎口径（含血量分档）
  check('对决', '克制 +15%（knife 克 plating）', combat.opponentHp === stallMax - expDmg, `hp=${combat.opponentHp} exp=${stallMax - expDmg}`)
}
// 命中/闪避边界 + 暴击
{
  const p = freshPlayer({ knife: 5, tasteAcumen: 1, heatControl: 1 })
  p.inventory.roastPotato = 20
  const combat = new Combat(p)
  const app = COMBAT_REGIONS[0].opponents[0]
  combat.start(app)
  // 命中率 = acc/(acc+eva) = 15/(15+5.5) ≈ 0.73；强制 miss：hit roll 0.9 > 0.73
  // （本段只测命中/暴击判定，不关心血量；暴击那条断言的是「溢出击杀」，对血量免疫）
  const hpBefore = combat.opponentHp
  withRandom([0.95, 0.95], () => combat.resolveTurn())
  check('对决', '命中判定：高随机值 → 闪避（无伤害）', combat.opponentHp === hpBefore, `hp=${combat.opponentHp}`)
  // 暴击：crit roll 0 → ×2（断言**伤害倍率**，不再绑定「28 能秒掉 L1 敌人」——
  // 血量分档后 L1 是 36 血，28 秒不掉；这条测的是暴击，不是血量）
  combat.start(app)
  const hpB = combat.opponentHp
  withRandom([0.0, 0.0], () => combat.resolveTurn())
  const critDmg = hpB - combat.opponentHp
  check('对决', '暴击 ×2（期望 28 伤害：14×2；血量不足时按剩余血量夹取）', critDmg === Math.min(28, hpB), `dmg=${critDmg}（攻击前血量 ${hpB}）`)
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
  // 🍲 指定自动进食的料理（2026-09-21 用户要求「点击选择食物为当前自动进食的食物」）
  //    ⚠️ 这里用**行为断言**而不是源码扫描：扫 `picked?.type === 'food'` 这类字样的断言是假绿的
  //    ——实测把判定改成 `null && s.autoEatItem`（永远不生效）照样 PASS（反例验证抓到的）。
  {
    const foods = Object.values(ITEMS).filter((i) => i.type === 'food' && i.heal).sort((a, b) => a.heal - b.heal)
    const weak = foods[0]
    const strong = foods[foods.length - 1]
    const qtyOf = (id) => p.inventory[id] ?? 0
    p.inventory[weak.id] = 3
    p.inventory[strong.id] = 3
    p.settings.autoEatItem = weak.id
    p.setCombat({ hp: 1 })
    combat.foodCooldown = 0
    const w0 = qtyOf(weak.id)
    const s0 = qtyOf(strong.id)
    combat.maybeAutoEat()
    check('对决', '指定的料理优先被自动吃掉（不再永远挑回血最高的那味）',
      qtyOf(weak.id) === w0 - 1 && qtyOf(strong.id) === s0, `弱 ${qtyOf(weak.id)}/${w0} · 强 ${qtyOf(strong.id)}/${s0}`)
    // 指定品吃光 → 必须回落「回血最高」，而不是从此不开饭（静默停摆）
    p.inventory[weak.id] = 0
    p.setCombat({ hp: 1 })
    combat.foodCooldown = 0
    const s1 = qtyOf(strong.id)
    combat.maybeAutoEat()
    check('对决', '指定料理吃光后回落「回血最高」（自动进食不会静默停摆）', qtyOf(strong.id) === s1 - 1, `强 ${qtyOf(strong.id)}/${s1}`)
    // 脏 id（存档里塞了不存在的物品/非料理）同样只回落，不抛错
    p.settings.autoEatItem = '__nope__'
    p.setCombat({ hp: 1 })
    combat.foodCooldown = 0
    const s2 = qtyOf(strong.id)
    combat.maybeAutoEat()
    check('对决', 'autoEatItem 是脏 id 时回落而不是报错', qtyOf(strong.id) === s2 - 1, `强 ${qtyOf(strong.id)}/${s2}`)
    p.settings.autoEatItem = null
  }
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
    check('采集队', '线路解锁按技能等级（垂钓 12，2026-09-18 由 25 下调）', freshPlayer({ fishing: 40 }).expeditionUnlocked('fishery') === true && freshPlayer({ fishing: 11 }).expeditionUnlocked('fishery') === false)
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
    pg2.gearMods.copperKnife = { mods: [{ stat: 'attack', value: 5 }, { stat: 'defense', value: 5 }], at: Date.now() } // 词条按装备 id 存（2026-09-18）
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
      // 基础件数走**唯一出口**（2026-09-29 由 1 提到 2，见 FARM_BASE_YIELD 的说明）——守卫不手抄那个 1
      const expectNormal = Math.max(1, Math.round(FARM_BASE_YIELD * 1 * seasonalCropBonus(cat)))
      const expectDouble = Math.max(1, Math.round(FARM_BASE_YIELD * 2 * seasonalCropBonus(cat)))
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
    const def = chefForWeek(clockWeekNum())   // ⚠️ 测试自己也别重抄周算法：走单一出口（2026-09-26）
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
    check('同业榜', '对手分数同月确定、跨年递增', (() => {
      const m = monthIndexOf()
      const same = rivalsOfMonth(m).map((r) => r.score).join() === rivalsOfMonth(m).map((r) => r.score).join()
      const sum = (k) => rivalsOfMonth(k).reduce((a, r) => a + r.score, 0)
      // 🔴 不能拿「相邻两期」比合计（2026-09-28 修）：每月上场的是**轮换后的不同 5 家**
      //    （`RIVAL_SHOPS[(monthIndex*3 + i*2) % n]`），换人就会让合计变小 —— 实测相邻 1 期
      //    「递增」只在 31/61 期成立（约掷硬币），这条断言自 2026-09-10 起一直是**半个闰年就红一次**，
      //    直到 09-28 本地 00:00 换到第 9 期才第一次真红。跨 12 期成长 1+0.06×12 = ×1.72，
      //    远超每月 ±12% 抖动与换人影响（实测 61/61 期都成立）⇒ 用它钉「越往后越强」。
      return same && sum(m + 12) > sum(m) && sum(m + 24) > sum(m + 12)
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
    // 全量数据（tales_ext 3988 条）：cat 必须全部落在已知大类，且总数不丢
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
    // 2026-09-22：饼干改走**自己的计时** `biscuitTurns`（原先与酱料共用 `buffTurns`，
    // 会被之后用的一瓶 10 回合酱料顺带延长到 10 回合）⇒ 断言改成看它自己的计数
    check('能量饼干', `增益持续 ${BISCUIT_BUFF_TURNS} 回合（饼干自己的计时，不与酱料共用）`,
      cb.biscuitTurns >= BISCUIT_BUFF_TURNS && cb.buffTurns === 0)
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
    // 🔴 2026-09-21 用户报「我图里现在穿了石墨两件，右边好像没检测到」——
    //    根因：矿套其实每套 **9 件**（8 件 `inip{矿}_*` + 1 件单独定义的 `graphiteAmulet` 这类同族饰品），
    //    而登记用的正则只认 `inip` 前缀 ⇒ **21 个矿套每套都漏了一件**，穿两件只算一件、2 件套不触发。
    //    ① 每套矿套必须收全同族单件；② 全库不许再有「名字属于某套、却不属于任何套」的孤儿装备。
    const inipSets = EQUIPMENT_SETS.filter((x) => x.key.startsWith('inip'))
    const missingSingle = inipSets.filter((x) => {
      const mineral = x.key.replace(/^inip/, '')
      const single = ['Ring', 'Amulet', 'Necklace', 'Bracelet', 'Earring'].map((suf) => mineral + suf).find((id) => ITEMS[id]?.type === 'equipment')
      return single && !x.ids.includes(single)
    })
    check('套装', `每个矿套都收全同族单件（${inipSets.length} 套）`, missingSingle.length === 0,
      missingSingle.map((x) => x.name).join('、') + ' 漏了同族饰品')
    check('套装', '矿套的每套件数 == 8 件 inip + 同族单件（不许多不许少）', (() => {
      const bad = inipSets.filter((x) => {
        const mineral = x.key.replace(/^inip/, '')
        const single = ['Ring', 'Amulet', 'Necklace', 'Bracelet', 'Earring'].map((suf) => mineral + suf).filter((id) => ITEMS[id]?.type === 'equipment').length
        return x.ids.length !== 8 + single
      })
      return bad.map((x) => `${x.name}(${x.ids.length})`)
    })().length === 0, '件数不对的矿套见上')
    check('套装', '没有「名字属于某套却不在套里」的孤儿装备', (() => {
      const registered = new Set(EQUIPMENT_SETS.flatMap((x) => x.ids))
      const orphan = []
      for (const [id, it] of Object.entries(ITEMS)) {
        if (it.type !== 'equipment' || !it.name || registered.has(id)) continue
        // Lv101-120「补档」装备线（16 件，lateGear.js）**刻意不是套装**：它们是「同一档同一主题的四件」，
        // 不带套装加成（`equipSets.js` 的 2/4/6 件加成会再抬战力 ⇒ 塔的墙再被推深）。
        // 名字与既有赛季套同前缀（如 天罡/赤霄）纯属主题撞车 —— 这里是**明确豁免**，不是遗漏。
        if (LATE_GEAR_IDS.includes(id)) continue
        const hit = EQUIPMENT_SETS.find((x) => {
          const pre = x.name.replace(/套装$/, '')
          return pre.length >= 2 && it.name.startsWith(pre) && x.ids.some((y) => ITEMS[y]?.name?.startsWith(pre))
        })
        if (hit) orphan.push(`${it.name}→${hit.name}`)
      }
      return orphan
    })().length === 0, '孤儿装备（前几个）：见上')
    // 用户的**原始场景**（行为断言）：只穿石墨护符 + 石墨戒指 → 必须触发 1 个 2 件套
    check('套装', '只穿「石墨护符 + 石墨戒指」就会触发石墨套装 2 件（用户实测场景）', (() => {
      const pb = freshPlayer()
      pb.equipment = { weapon: null, helmet: null, body: null, legs: null, boots: null, offhand: null, amulet: 'graphiteAmulet', ring: 'inipgraphite_Ring' }
      const b = equipSetBonuses(pb.equipment)
      return b.active.length === 1 && b.active[0].name.includes('石墨') && b.active[0].count === 2
    })(), '穿两件石墨没触发套装')
    // 相邻矿名不许串套（`^tin` 会误吞 `titaniumAmulet` —— 所以补件用的是精确拼 id 而不是前缀正则）
    check('套装', '相邻矿名不串套（锡护符只在锡套、钛护符只在钛套）',
      equipSetOf('tinAmulet')?.key === 'iniptin' && equipSetOf('titaniumAmulet')?.key === 'iniptitanium',
      `${equipSetOf('tinAmulet')?.key} / ${equipSetOf('titaniumAmulet')?.key}`)
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
  // settings.autoEatItem（2026-09-21「战备」里点选自动进食的料理）：脏 id 必须在**读档时**被过滤，
  // 合法料理原样保留。⚠️ 行为断言 —— 「源码里有 getItem(st.autoEatItem) 这行」会被
  // 「那行还在、只是不再生效」蒙过去（反例验证抓到的：把过滤那行删掉，字样检查照样 PASS）。
  {
    const foodId = Object.values(ITEMS).find((i) => i.type === 'food' && i.heal).id
    const save = JSON.parse(s1)
    save.settings.autoEatItem = foodId
    const pk = freshPlayer()
    pk.applySave(save)
    check('存档', 'autoEatItem 是合法料理时读档保留', pk.settings.autoEatItem === foodId, `→ ${pk.settings.autoEatItem}`)
    save.settings.autoEatItem = '__nope__'
    const pk2 = freshPlayer()
    pk2.applySave(save)
    check('存档', 'autoEatItem 是脏 id 时读档被过滤（回落到「回血最高」）', pk2.settings.autoEatItem === null, `→ ${pk2.settings.autoEatItem}`)
    // 非料理（有物品但 type 不是 food）同样不算数：指定了也不会被自动吃
    const nonFood = Object.values(ITEMS).find((i) => i.type !== 'food' && !i.heal).id
    save.settings.autoEatItem = nonFood
    const pk3 = freshPlayer()
    pk3.applySave(save)
    check('存档', 'autoEatItem 指向非料理物品时也被过滤', pk3.settings.autoEatItem === null, `→ ${pk3.settings.autoEatItem}（${nonFood}）`)
  }
}

// ── G. 背包（§5.4）─────────────────────────────────
console.log('══ G. 背包 ══')
{
  const p = freshPlayer()
  p.gainItem('apple', 5)
  p.gainItem('apple', 5)
  check('背包', '同类堆叠 5+5=10', p.inventory.apple === 10)
  // 堆叠上限：2026-09-22 用户要求抬到 **100 亿**（stackRules.STACK_MAX；数据里的 9999 只是历史默认值）
  const { STACK_MAX, shortCount, effectiveStackCap } = await import('../../src/game/data/stackRules.js')
  p.gainItem('apple', 20000)
  check('背包', `堆叠上限 = STACK_MAX（${STACK_MAX}，20000 件照收）`, p.inventory.apple === 20010, `qty=${p.inventory.apple}`)
  p.spendItem('apple', p.inventory.apple)
  p.gainItem('apple', STACK_MAX)
  check('背包', '能真的堆到 100 亿（JS 安全整数，不用 32 位运算）', p.inventory.apple === STACK_MAX, `qty=${p.inventory.apple}`)
  check('背包', '超上限的部分转信箱而不是丢（再发 1 件 → 背包仍 100 亿）', p.gainItem('apple', 1) === false && p.inventory.apple === STACK_MAX)
  check('背包', '数量缩写：1e10 显示为「100.00亿」', shortCount(STACK_MAX) === '100.00亿' && shortCount(389100) === '38.91万', `${shortCount(STACK_MAX)} / ${shortCount(389100)}`)
  check('背包', 'spendItem 恰好清空删除键', p.spendItem('apple', p.inventory.apple) === true && p.inventory.apple === undefined)
  check('背包', 'spendItem 超出返回 false', p.spendItem('apple', 1) === false)
  p.gainItem('carrot', 3)
  check('背包', 'spendItem 部分消耗', p.spendItem('carrot', 2) === true && p.inventory.carrot === 1)
  // 装备堆叠（2026-09-22 用户：「有什么办法让没有词条的装备可堆叠」）：
  //   · **无词条**的装备可堆叠（上限 STACK_MAX）——装备的词条按 itemId 存、镶嵌按槽位存 ⇒ 堆叠不会丢状态
  //   · 一旦该 id 洗练出词条，上限立刻回到 1
  p.inventory.copperKnife = 0
  p.gainItem('copperKnife', 5)
  check('背包', '无词条的装备可堆叠（一次发 5 件 → 5 件都在）', p.inventory.copperKnife === 5, `qty=${p.inventory.copperKnife}`)
  check('背包', '生效上限走唯一出口 effectiveStackCap（无词条装备 = STACK_MAX）',
    p.stackCapOf('copperKnife') === STACK_MAX && effectiveStackCap({ type: 'equipment' }, false) === STACK_MAX)
  p.gearMods = { ...(p.gearMods ?? {}), copperKnife: { mods: [{ stat: 'attack', value: 1 }], at: Date.now() } }
  check('背包', '有词条的装备上限回到 1（不能再进）', p.stackCapOf('copperKnife') === 1 && p.gainItem('copperKnife', 1) === false, `cap=${p.stackCapOf('copperKnife')}`)
  check('背包', '已堆起来的那一堆不会被强行拆分（上限只限制「还能不能再进」）', p.inventory.copperKnife === 5)
  check('背包', 'gainBlockReason 与 stackCapOf 同源（有词条时报 stack）', p.gainBlockReason('copperKnife', 1) === 'stack')
  p.gearMods = {}
  check('背包', '物品数据一字未动（装备仍是 stackable:false，规则在运行时层）', (() => {
    const mk = fs.readFileSync(new URL('../../src/game/data/items.js', import.meta.url), 'utf8')
    return /stackable: false, slot: 'weapon'/.test(mk)
  })())
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
  // 战斗属性无装备无 NaN（2026-09-22：playerStats 里多了两个**派生**字段——`speedAtCap` 布尔、
  // `speedFloorMs` 上限值——它们不是战斗数值，只喂界面提示，故按「数值字段必须有限」判定）
  const combat = new Combat(p)
  const st = combat.playerStats()
  const NON_NUMERIC = new Set(['speedAtCap'])
  check('安全', '战斗属性全部有限数', Object.entries(st).every(([k, v]) => NON_NUMERIC.has(k) || Number.isFinite(v)), JSON.stringify(st))
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
  // 存储合一（2026-09-20）：厨藏基线 = 原背包 20 + 原仓库 100 = 120
  check('容量', `初始厨藏 ${STORAGE_BASE} 格（= 原背包 20 + 原仓库 100）`, p.inventoryCap === STORAGE_BASE)
  for (let i = 0; i < STORAGE_BASE; i++) p.gainItem(itemIds[i], 1)
  check('容量', `${STORAGE_BASE} 种物品全部放入`, p.inventorySlotsUsed === STORAGE_BASE)
  const okNext = p.gainItem(itemIds[STORAGE_BASE], 1)
  check('容量', '再多一种被拒绝（转信箱）', okNext === false && p.inventorySlotsUsed === STORAGE_BASE)
  // 已有种类堆叠不受限
  p.gainItem(itemIds[0], 50)
  check('容量', '已有种类继续堆叠', p.inventory[itemIds[0]] === 51)
  // 扩展 10 格
  p.expandInventory(10)
  check('容量', `扩展 +10 → ${STORAGE_BASE + 10} 格`, p.inventoryCap === STORAGE_BASE + 10 && p.gainItem(itemIds[STORAGE_BASE], 1) === true)
  // 存储合一（2026-09-20）：金币路径天花板 = 独立标定的 STORAGE_PAID_MAX（2026-09-20 用户要求 600 → 2500）
  for (let i = 0; i < 400; i++) p.expandInventory(10)
  check('容量', `扩展上限 ${STORAGE_PAID_MAX}（商店厨藏扩容上限，用户 2026-09-20 要求提到 2500）`,
    p.inventoryCap === STORAGE_PAID_MAX && p.expandInventory(10) === false, `实得 ${p.inventoryCap}`)

  // ── 存储合一（2026-09-20：用户要求「只有一个厨藏」）──
  const p2 = freshPlayer()
  p2.gainItem('apple', 10)
  check('存储', '转移类动作已退化为 no-op（没有第二个池子）',
    p2.moveToBank('apple') === false && p2.moveToInventory('apple') === false && p2.bankSlotsUsed === 0)
  check('存储', `只有一套容量：厨藏 ${STORAGE_BASE} 格起步（= 原背包 20 + 原仓库 100），仓库字段恒空`,
    p2.inventoryCap === STORAGE_BASE && Object.keys(p2.bank).length === 0)
  for (let i = 0; i < 400; i++) p2.expandBank(20) // 「仓库扩容」这件商品现在也加厨藏容量
  check('存储', `两件扩容商品加同一个池：可达 ${STORAGE_PAID_MAX}`,
    p2.inventoryCap === STORAGE_PAID_MAX && p2.expandBank(20) === false, `实得 ${p2.inventoryCap}`)
  // 存储合一后「满」只发生在厨藏：满格时新种类拒绝（并转信箱，见信箱那组）
  const p3 = freshPlayer()
  p3.inventoryCap = 1
  p3.gainItem('apple', 1)
  check('存储', '厨藏满时新种类不再进背包（转信箱由信箱那组覆盖）',
    p3.gainItem('carrot', 1) === false && !(('carrot') in p3.inventory))

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

// ⚠️ 下面 5 处 `withRandom([0.02, …])` 的取值**不能改回 0.5**：它是在桩掉随机数做「强制命中」，
//    而**垂钓是采集类里唯一的概率闸门**（55% 基础，经全局难度系数后 ≈27.5%）——
//    0.5 已经**高于**这个成功率，会判定成失败 ⇒ 一条鱼都没有（2026-09-21 引入难度系数时踩到）。
//    0.02 同时也高于稀有鱼概率（≈0.25%），保证掉的是普通鱼而不是金龙鱼。
// ── P. 多技能并行挂机（§3.1：切技能页不中断）────────
console.log('══ P. 多技能并行 ══')
{
  const p = freshPlayer()
  // ⚠️ 2026-09-29：槽位改成**进度奖励**（起步 1 槽）⇒ 想验「多技能真并行」必须先解锁到 2 槽。
  //    这里用「山海点亮 30」这一档（解锁表在 `parallelSlots.js`）；本块验的是**并行机制本身**，
  //    槽位火箭式的门槛另有 Q 块专测。
  p.shanhaiUnlocked = Array.from({ length: 30 }, (_, i) => `n${i}`)
  const forInst = getSkillInstance('foraging')
  const fishInst = getSkillInstance('fishing')
  // 新档待机（无默认目标）；测试显式选择采摘苹果 + 垂钓鲫鱼
  p.setSkillTarget('foraging', 'apple')
  p.setSkillTarget('fishing', 'crucian')
  check('并行', '每技能独立目标', p.skillTargets.fishing === 'crucian' && p.getSkillTarget('foraging') === 'apple')
  // 双技能同时 tick（成功判定强制命中）
  withRandom([0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02], () => p.tick(10_000))
  check('并行', '采摘+垂钓同时产出', forInst.actionsDone >= 1 && fishInst.actionsDone >= 1, `f=${forInst.actionsDone} g=${fishInst.actionsDone}`)
  check('并行', '产出入账', (p.inventory.apple ?? 0) >= 1 && (p.inventory.crucian ?? 0) >= 1, JSON.stringify({ a: p.inventory.apple, c: p.inventory.crucian }))
  // 切换技能页（activeSkill 变化）不中断并行任务
  p.setActiveSkill('cooking')
  const aBefore = p.inventory.apple ?? 0
  withRandom([0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02], () => p.tick(10_000))
  check('并行', '切到制作页后采摘仍在产出', (p.inventory.apple ?? 0) > aBefore, `${aBefore} → ${p.inventory.apple}`)
  // 单独暂停垂钓：采摘继续
  p.setSkillPaused('fishing', true)
  const cBefore = p.inventory.crucian ?? 0
  const fBefore = p.inventory.apple ?? 0
  withRandom([0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02], () => p.tick(10_000))
  check('并行', '垂钓暂停、采摘继续', (p.inventory.crucian ?? 0) === cBefore && (p.inventory.apple ?? 0) > fBefore, `c ${cBefore}→${p.inventory.crucian} a ${fBefore}→${p.inventory.apple}`)
  // 旧档迁移：activeTarget → skillTargets
  const old = { name: 'x', gold: 1, activeSkill: 'fishing', activeTarget: 'tuna', skills: {} }
  const p6 = freshPlayer()
  p6.applySave(old)
  check('并行', '旧档 activeTarget 迁移到技能目标', p6.skillTargets.fishing === 'tuna')
}

// ── Q. 并行槽位（§3.1；**2026-09-29 起是「进度奖励」**：起步 1 槽、靠山海/成就/转生解锁到 8）────
// 为什么改：`maxParallelIdle = 0`（无限）会让总时长 = max（35 天）而不是 Σ（112 天）—— 实测压 3.2×，
// 是比 buff 更大的杠杆，也把「练什么」这个决策整个抹掉。设置面板那个选择从此只能**再限低**。
console.log('══ Q. 并行槽位 ══')
{
  const { unlockedParallelSlots, effectiveParallelSlots, nextParallelUnlock } = await import('../../src/game/data/parallelSlots.js')
  const p = freshPlayer()
  p.setSkillTarget('foraging', 'apple')
  p.setSkillTarget('fishing', 'crucian')
  check('并行槽', '新档起步 1 槽（旧的「无限制」已收）', unlockedParallelSlots(p) === 1, String(unlockedParallelSlots(p)))
  check('并行槽', '起步 1 槽时只跑活动技能（默认活动 = foraging）',
    p.getRunningIdleSkills().length === 1 && p.getRunningIdleSkills()[0].id === 'foraging')
  check('并行槽', '下一档解锁提示存在（面板要告诉玩家差什么）',
    nextParallelUnlock(p)?.slots === 2 && nextParallelUnlock(p).kind === 'shanhai', JSON.stringify(nextParallelUnlock(p)))
  // 进度解锁：山海 30 → 2 槽；再 +成就 20 → 3 槽；再 +转生 1 → 4 槽
  p.shanhaiUnlocked = Array.from({ length: 30 }, (_, i) => `n${i}`)
  check('并行槽', '山海点亮 30 ⇒ 解锁 2 槽、两条线都跑',
    unlockedParallelSlots(p) === 2 && p.getRunningIdleSkills().length === 2)
  p.achievements = Array.from({ length: 20 }, (_, i) => `a${i}`)
  check('并行槽', '+成就 20 ⇒ 3 槽', unlockedParallelSlots(p) === 3)
  p.skills.foraging.prestiges = 1
  check('并行槽', '+转生 1 次 ⇒ 4 槽', unlockedParallelSlots(p) === 4)
  // 设置只能**再限低**，不能突破进度
  p.settings.maxParallelIdle = 1
  check('并行槽', '自限 1 ⇒ 生效 1（只跑活动技能）', effectiveParallelSlots(p) === 1 && p.getRunningIdleSkills().length === 1)
  p.settings.maxParallelIdle = 8
  check('并行槽', '🔴 自限 8 但只解锁 4 ⇒ 生效被进度夹到 4（不能再突破）',
    effectiveParallelSlots(p) === 4, String(effectiveParallelSlots(p)))
  check('并行槽', '0 = 用满已解锁槽位（不再是「无限制」）',
    effectiveParallelSlots({ settings: { maxParallelIdle: 0 }, shanhaiUnlocked: p.shanhaiUnlocked, achievements: p.achievements, skills: p.skills }) === 4)
  // tick 行为：生效 1 时只有活动技能产出
  p.settings.maxParallelIdle = 1
  p.setActiveSkill('fishing')
  const before = { c: p.inventory.crucian ?? 0, a: p.inventory.apple ?? 0 }
  withRandom([0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02], () => p.tick(10_000))
  check('并行槽', '生效 1 时只有活动技能（垂钓）产出',
    (p.inventory.crucian ?? 0) > before.c && (p.inventory.apple ?? 0) === before.a,
    JSON.stringify({ c: p.inventory.crucian, a: p.inventory.apple }))
  // 离线同样只结算生效槽位内的技能
  const p2 = freshPlayer()
  p2.setSkillTarget('foraging', 'apple')
  p2.setSkillTarget('fishing', 'crucian')
  p2.setActiveSkill('foraging')
  useUiStore()
  settleOffline(p2, useUiStore(), 3600_000)
  check('并行槽', '离线也只结算生效槽位内的技能（起步 1 槽 ⇒ 只有活动技能）',
    (p2.inventory.apple ?? 0) > 0 && (p2.inventory.crucian ?? 0) === 0, JSON.stringify({ a: p2.inventory.apple, c: p2.inventory.crucian }))
  // 设置随存档；且脏值被夹回合法档位
  const p3 = freshPlayer()
  p3.settings.maxParallelIdle = 2
  const p4 = freshPlayer()
  p4.applySave(JSON.parse(JSON.stringify(p3.serialize())))
  check('并行槽', '自限值随存档保存', p4.settings.maxParallelIdle === 2)
  const dirty = JSON.parse(JSON.stringify(p3.serialize()))
  dirty.settings.maxParallelIdle = 999
  const p5 = freshPlayer()
  p5.applySave(dirty)
  check('并行槽', '脏档（999）被夹回合法档位（0 = 用满进度上限）', p5.settings.maxParallelIdle === 0, String(p5.settings.maxParallelIdle))
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
  check('扩充', '采集七技能目标数（145/78/75/51/22/45；2026-09-29 补档 +13）', insts.foraging.targets.length === 145 && insts.fishing.targets.length === 78 && insts.hunting.targets.length === 75 && insts.excavation.targets.length === 51 && insts.woodcutting.targets.length === 22 && insts.mining.targets.length === 45, JSON.stringify({ f: insts.foraging.targets.length, g: insts.fishing.targets.length, h: insts.hunting.targets.length, x: insts.excavation.targets.length, w: insts.woodcutting.targets.length, m: insts.mining.targets.length }))
  check('扩充', '制作五技能食谱数（297/99/93/129/99；腌制 90→93 见 pickles.js；2026-09-29 补档 +9）', insts.cooking.recipes.length === 297 && insts.baking.recipes.length === 99 && insts.preserving.recipes.length === 93 && insts.brewing.recipes.length === 129 && insts.spiceMixing.recipes.length === 99, JSON.stringify({ c: insts.cooking.recipes.length, b: insts.baking.recipes.length, p: insts.preserving.recipes.length, r: insts.brewing.recipes.length, s: insts.spiceMixing.recipes.length }))
  check('扩充', '锻造 381 配方（20 品质套 + 独立矿套 365 + 2026-09-29 补档装备线 16）', insts.craftsmithing.recipes.length === 381, `n=${insts.craftsmithing.recipes.length}`)
  // 24 = 入门 1（厨余堆肥，2026-09-09 解除 Lv1 阻塞）+ 肥料 2 + 保鲜/增益剂 15
  //      + Ⅵ/Ⅶ 阶 6（preserveTiersExt.js，2026-09-29 体检 §9.1 的 5-A）
  check('扩充', '食材保鲜 24 配方（入门 1 + 肥料 2 + 保鲜/增益剂 15 + Ⅵ/Ⅶ 阶 6）', insts.preservation.recipes.length === 24, `n=${insts.preservation.recipes.length}`)
  // 制作技能入口保护（2026-09-09）：每个制作技能必须至少有一个 Lv1 配方，否则技能永远无法起步
  {
    const noEntry = ['cooking', 'baking', 'preserving', 'brewing', 'spiceMixing', 'craftsmithing', 'preservation', 'spiritSummoning']
      .filter((id) => !getSkillInstance(id).recipes.some((r) => r.reqLevel <= 1))
    check('扩充', '每个制作技能都有 Lv1 入口配方（不可再出现永久卡 1 级）', noEntry.length === 0, noEntry.join(','))
  }
  // 2026-09-27 用户⑧：32 → 42（+10 条副业线，见 aojiSideline.js）
  check('扩充', '美食知识 42 奥义（32 原有 + 10 副业线）', AOJIS.length === 42, `n=${AOJIS.length}`)
  check('扩充', '食灵 160 个', SPIRITS.length === 160, `n=${SPIRITS.length}`)
  check('扩充', '探索 210 目标（生成器 200 + 2026-09-29 手写扩展 10：Lv102~120 每 2 级一件）', insts.exploration.targets.length === 210, `n=${insts.exploration.targets.length}`)
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
  // 期望值走阻尼出口：窗口 ×1.5 是先相乘、再按 `dampXpStack` 折减（2026-09-21 成长阻尼）⇒ 实际 ×1.375
  check('活动', `晨集采集经验 ×1.5 生效（经成长阻尼后 ×${dampXpStack(1.5)}）`, pg.skills.foraging.exp - beforeG === dampXpStack(1.5) * 1000, `got ${pg.skills.foraging.exp - beforeG}`)
  pg.marketBoost = orig
}

import { weekNum as clockWeekNum } from '../../src/game/core/clockKeys.js'
// ── C56. 日历口径单一出口（2026-09-26 用户「一起做」：日/周重置口径不统一）──
// 背景：审计发现同一天里并存**四种**周算法、两种锚点 —— 每日按本地午夜，而周常/厨具赛/名厨是
// `floor(Date.now()/7天)`（锚在**周四 00:00 UTC**）、美食讲堂问答又是「UTC + 元旦」那一套；
// 赛季与宿敌是 Unix 纪元锚点。玩家看到的边界互相错开（周任务在周四早八点换）。
// 现统一为「一切边界落在**本地午夜**」，出口 = `src/game/core/clockKeys.js`。
console.log('══ C56. 日历口径单一出口 ══')
{
  const { todayKey, weekNum, weekKey, weekStart, localAligned } = await import('../../src/game/core/clockKeys.js')
  // ① 行为：周序号只在**本地周一 00:00** 变，周内稳定
  const mon = weekStart(Date.now())
  const before = mon.getTime() - 1
  const t1 = mon.getTime()
  const t2 = mon.getTime() + 6.9 * 86400000
  const t3 = mon.getTime() + 7 * 86400000
  check('日历', 'weekNum 只在本地周一 00:00 变（周一前一毫秒 vs 周一零时换周、周内稳定、下周一再换）',
    weekNum(before) !== weekNum(t1) && weekNum(t1) === weekNum(t2) && weekNum(t2) !== weekNum(t3),
    `${weekNum(before)} → ${weekNum(t1)} → ${weekNum(t3)}`)
  check('日历', 'weekKey = 本周一的本地日期（YYYY-MM-DD）且与 weekNum 同源',
    /^\d{4}-\d{2}-\d{2}$/.test(weekKey(Date.now())) && weekNum(Date.now()) === Math.floor(weekStart(Date.now()).getTime() / 86400000))
  check('日历', 'todayKey 是本地日期（与 Date 的本地分量一致，不是 UTC）', (() => {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    return todayKey(d.getTime()) === `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  })())
  check('日历', 'localAligned 把时间轴平移到本地（= now + 时区偏移，东八区 +8h）', (() => {
    const now = Date.now()
    const off = -new Date(now).getTimezoneOffset() * 60000
    return localAligned(now) === now + off
  })())
  // ② 唯一出口：src 里不许再出现「按 7 天取模 / 604800000 / 元旦 UTC 锚点」的周算法（clockKeys 自己除外）
  const WEEK_PATTERNS = [
    /7 \* 24 \* 3600_000/,           // 旧的 epoch 周（周常/厨具赛/名厨三处）
    /604800000/,                     // Trivia 的第四种
    /Date\.UTC\(\s*now\.getFullYear\(\),\s*0,\s*1\s*\)/, // 「元旦 UTC」锚点
  ]
  const ALLOW = ['clockKeys.js']     // 出口自身
  const bad = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`
      if (e.isDirectory()) { walk(full); continue }
      if (!/\.(js|mjs|vue)$/.test(e.name) || ALLOW.some((a) => full.endsWith(a))) continue
      const src = fs.readFileSync(full, 'utf8')
      for (const re of WEEK_PATTERNS) if (re.test(src)) bad.push(`${full.replace(/.*\/src\//, 'src/')} ← ${re}`)
    }
  }
  walk(new URL('../../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  check('日历', '全站没有第二份「周」算法（唯一出口 = clockKeys.js；含 epoch 周与元旦 UTC 锚点两种写法）',
    bad.length === 0, bad.slice(0, 4).join(' | '))
  // ③ 接线：玩家/厨具赛/名厨/讲堂四处必须与出口同一个值
  const { usePlayerStore: UPS } = await import('../../src/stores/player.js')
  const { createPinia: CP, setActivePinia: SAP } = await import('pinia')
  SAP(CP())
  const pp = UPS(); pp.newGame()
  const { contestWeek } = await import('../../src/game/data/gearContest.js')
  check('日历', '玩家 _weekNum / 厨具赛 contestWeek / 出口 weekNum 三处同值（同源）',
    pp._weekNum() === weekNum() && contestWeek() === weekNum(),
    `player=${pp._weekNum()} gear=${contestWeek()} clock=${weekNum()}`)
  // ④ 赛季相位与「剩余时长」必须同源（两处口径不一致会整整错一个周期）
  const { activeSeasonId, seasonRemainingMs } = await import('../../src/game/data/seasons.js')
  const sid = activeSeasonId()
  const left = seasonRemainingMs(sid)
  check('日历', '赛季剩余时长在 (0, 总周期] 内且与活跃赛季自洽（相位同源）',
    left > 0 && left <= 90 * 86400000, `${sid} 剩 ${(left / 86400000).toFixed(2)} 天`)
}

// ── C57. 小游戏触屏操控（2026-09-26 用户「一起做」复审：检查清单那条其实是**过期项**）──
// 清单 §10.5 原写「canvas 类小游戏（贪吃蛇/2048/方块）依赖方向键，窄屏触屏操控方案未设计——待拍板」。
// 逐款实测核对后：**七款依赖键盘的小游戏全都已经有屏幕按键**（蛇/2048/吃豆/冰道是四向、方块还带旋转/软降/直落、
// 跳跳鸟有点击 flap、水果合成是 pointerdown 拖放）⇒ 那条只需改成「已具备 + 加守卫防回退」，不是待办。
// 本守卫按「键盘动作 ↔ 屏幕按键」成对断言：谁把屏幕按键删了（只留键盘），这里立刻 FAIL。
console.log('══ C57. 小游戏触屏操控 ══')
{
  const TOUCH = {
    'SnakeView.vue': [/'ArrowLeft'/, /'ArrowRight'/, /'ArrowUp'/, /'ArrowDown'/],
    'Kitchen2048View.vue': [/move\('left'\)/, /move\('right'\)/, /move\('up'\)/, /move\('down'\)/],
    'PacmanView.vue': [/'ArrowLeft'/, /'ArrowRight'/, /'ArrowUp'/, /'ArrowDown'/],
    'IceSlideView.vue': [/move\(0\)/, /move\(1\)/, /move\(2\)/, /move\(3\)/],
    'TetrisView.vue': [/tryMove\(-1/, /tryMove\(1/, /tryRotate\(/, /softDropOnce\(|hardDrop\(/],
    'FlappyBirdView.vue': [/flap\(\)/],
    'FruitMergeView.vue': [/@pointerdown="onPointerDown"/],
  }
  const missing = []
  for (const [file, patterns] of Object.entries(TOUCH)) {
    const src = fs.readFileSync(new URL(`../../src/views/minigames/${file}`, import.meta.url), 'utf8')
    for (const re of patterns) if (!re.test(src)) missing.push(`${file} 少了 ${re}`)
  }
  check('小游戏触屏', '每款依赖键盘的小游戏都保留着屏幕按键（蛇/2048/吃豆/冰道/方块/跳跳鸟/水果合成）',
    missing.length === 0, missing.slice(0, 4).join(' | '))
}
// ── C58. 浅色主题对比度（2026-09-26 用户「一起做」：那条「29 处不达标、从未被守卫量过」）──
// 先量后改：写了个**按真实 DOM 算有效背景**的审计（`scripts/dev/light_dom_contrast.mjs`，
// 沿祖先链把半透明底逐层合成、排除 emoji/渐变文字/渐变底三类假阳性）⇒ 实测 classic 浅色 **28 处**
// 不达标（与记忆里的「29 处」吻合），根因只有**三对 token**：
//   ① `.player-gold` 的 `--gold` 压金光底 3.42（14 处）⇒ 改用 `--gold-strong`（该 token 本就是为此造的）4.79
//   ② `--muted` 压卡片底 4.09（8 处）⇒ 浅色 `--muted` #7a6f68→#6e645c（4.83）+ 皮肤浅色的 mix 权重 0.38→0.30
//   ③ 主色当文字 `--primary` 压浅底 3.72（6 处：`.mp-pct`/`.bgm-tbtn--play`/`.arena-vs`/`.loadout-chip-name`/`.attr-col-head`）
//      ⇒ 一律改用 `--primary-strong`（5.19）
// 改后 classic / sakura / amber 三皮肤浅色实测 **0 处**。
// 本守卫**不需要浏览器**：直接拿 15 皮肤的浅色调色板算那几对（改了 token 或权重立刻 FAIL）。
console.log('══ C58. 浅色主题对比度 ══')
{
  const css = fs.readFileSync(new URL('../../src/styles/main.css', import.meta.url), 'utf8')
  const pick = (name) => {
    const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
    return m ? m[1] : null
  }
  const { skinVars, SKINS } = await import('../../src/game/data/skins.js')
  const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
  const ratio = (a, b) => { const l1 = lum(hex2rgb(a)), l2 = lum(hex2rgb(b)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }
  // 底色锚点取自实测（classic 浅色：卡片 --panel-raise #f0eae2 / 页面 --bg #fffbf4 / 金光底 / 粉底）
  const SURF = { card: '#f0eae2', page: '#fffbf4', goldChip: '#f8efd9', pinkChip: '#fae4da' }
  const base = {
    '--muted': pick('muted'), '--text-dim': pick('text-dim'), '--gold-strong': pick('gold-strong'),
    '--primary-strong': pick('primary-strong'), '--primary-soft': pick('primary-soft'), '--text': pick('text'),
    // 2026-09-28 补两对（制作类页面浅色扫描查出，见下面那条注释）
    '--bad-strong': pick('bad-strong'), '--bad-soft': pick('bad-soft'),
  }
  check('浅色对比度', `根 token 齐全（muted/text-dim/gold-strong/primary-strong/bad-strong/primary-soft 都能解析到）`,
    Object.values(base).every((v) => v), JSON.stringify(base))
  const bad = []
  for (const s of SKINS) {
    const v = { ...base, ...(skinVars(s.id, 'light') ?? {}) }
    const hexOf = (x) => (typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x.trim()) ? x.trim() : null)
    const pairs = [
      ['muted × 卡片底', hexOf(v['--muted']), SURF.card, 4.5],
      ['muted × 粉底', hexOf(v['--muted']), SURF.pinkChip, 4.5],
      ['text-dim × 卡片底', hexOf(v['--text-dim']), SURF.card, 4.5],
      ['gold-strong × 金光底', hexOf(v['--gold-strong']), SURF.goldChip, 4.5],
      ['primary-strong × 页面底', hexOf(v['--primary-strong']), SURF.page, 4.5],
      // 🔴 2026-09-28 补：**压在自家 soft 底上的小字**也要算 —— 上面 5 对全是「深档压卡片底」，
      //    而胶囊/缺料标记是「压在自己那层淡底上」，那层的对比度天然更低。
      //    实测（制作类页面的浅色扫描）：`.ing.lacking` 的 `--bad` 压 `--bad-soft` = **3.33**、
      //    `.effect-chip` 的 `--primary-strong` 压 `--primary-soft` = **4.27**（amber），两处都 <4.5。
      //    改法沿用本项目口径：**文字用深档**（`--bad-strong`）或**回到正文字色**（`--text`）。
      ['bad-strong × bad-soft（缺料标记）', hexOf(v['--bad-strong']), hexOf(v['--bad-soft']), 4.5],
      ['text × primary-soft（效果胶囊）', hexOf(v['--text']), hexOf(v['--primary-soft']), 4.5],
    ]
    for (const [label, fg, bg, need] of pairs) {
      if (!fg || !bg) { bad.push(`${s.id}: ${label} 取不到色值`); continue }
      const r = ratio(fg, bg)
      if (r < need) bad.push(`${s.id}: ${label} ${r.toFixed(2)} < ${need}`)
    }
  }
  check('浅色对比度', `15 皮肤 × 7 对（含「压自家 soft 底」的缺料标记与效果胶囊）全部 ≥4.5`,
    bad.length === 0, bad.slice(0, 5).join(' | '))
  // 🔴 上面那两条只算了 **token 之间** 的比值 ⇒ 它挡不住「规则里写错 token」
  //    （把 `.ing.lacking` 的 `--bad-strong` 改回 `--bad`，token 对照样合格、守卫照样绿 —— 实测反例）。
  //    所以这里再看**规则本身用的是哪个 token**：压 soft 底的小字必须用深档 / 正文字色。
  const block = (sel) => {
    const i = css.indexOf(sel)
    return i < 0 ? '' : css.slice(i, css.indexOf('}', i))
  }
  check('浅色对比度', '压 soft 底的规则用的是合格 token（缺料标记 --bad-strong / 效果胶囊 --text）',
    /color:\s*var\(--bad-strong\)/.test(block('.ing.lacking')) && !/color:\s*var\(--bad\)\s*;/.test(block('.ing.lacking')) &&
      /color:\s*var\(--text\)/.test(block('.effect-chip')) && !/color:\s*var\(--primary-strong\)\s*;/.test(block('.effect-chip')),
    `lacking=${block('.ing.lacking').replace(/\s+/g, ' ').slice(-60)} · chip=${block('.effect-chip').replace(/\s+/g, ' ').slice(-60)}`)
}

// ── C59. 战斗深度 v1（2026-09-26 用户「开始优化，改加新东西还是要加」）──
// 起因是三处体检结论：① 命中/闪避**不可堆**（命中率随等级从 70% 退化到 45%，装备只能给 +22，
// 且越级战里唯一瓶颈就是命中 —— 实测 +223% 伤害加成只值 ×1.01）；② 敌人**不吃任何状态**
// （7 条状态全打在玩家身上）；③ 除风格三角外**没有相性维度**。
// 新增三件（全部走读取点，冻结的 248 个敌人一字未改）：
//   ① 命中/闪避 = `(等级项) × (1 + 装备项 / DIV)` —— **装备为 0 时逐值等于旧公式**，堆装备才有意义
//   ② 风格三态：刀工→割伤 · 摆盘→破防 · 调味→灼烧（玩家第一次能对敌人施加东西）
//   ③ 敌人抗性：**被克方抵抗克制方的状态**（普通减半 / 首领免疫）⇒ 用克制风格拿伤害就别想要状态
console.log('══ C59. 战斗深度 v1 ══')
{
  const T = await import('../../src/game/data/combatTuning.js')
  const { STATUS_INFO, STYLE_STATUS, COMBAT_DEPTH_V1, ACC_GEAR_DIV, EVA_GEAR_DIV } = T

  // A. 常量与形状
  check('战斗深度', '总开关为 true（上线态；关掉只能是临时 A/B，不许留在仓库里）', COMBAT_DEPTH_V1 === true, `COMBAT_DEPTH_V1=${COMBAT_DEPTH_V1}`)
  check('战斗深度', '两个坡度除数都是正数（防除零/防写成负数把装备变成负收益）',
    ACC_GEAR_DIV > 0 && EVA_GEAR_DIV > 0, `ACC=${ACC_GEAR_DIV} EVA=${EVA_GEAR_DIV}`)
  // 🔴 上限必须有：装备命中是**加法属性**，词条+宝石+强化能堆到几百。首版没有上限 ⇒ 堆满命中命中率 90%
  //    （旧加法形态同配置 76%）—— 杠杆过头。这条钉住「堆到极限也不会失控」。
  const { ACC_GEAR_CAP, EVA_GEAR_CAP } = T
  check('战斗深度', '两个装备项上限都是正数且小于「堆满值」（防上限形同虚设）',
    ACC_GEAR_CAP > 0 && EVA_GEAR_CAP > 0 && ACC_GEAR_CAP <= 200 && EVA_GEAR_CAP <= 200,
    `ACC=${ACC_GEAR_CAP} EVA=${EVA_GEAR_CAP}`)
  const styleIds = ['knife', 'plating', 'flavor']
  check('战斗深度', '三种风格各有一个状态，且都在 STATUS_INFO 里登记（id/name/icon/desc 齐备）',
    styleIds.every((s) => STYLE_STATUS[s] && STATUS_INFO[STYLE_STATUS[s]]?.name && STATUS_INFO[STYLE_STATUS[s]]?.icon && STATUS_INFO[STYLE_STATUS[s]]?.desc),
    styleIds.map((s) => `${s}→${STYLE_STATUS[s]}`).join(' '))
  const stArr = styleIds.map((s) => STYLE_STATUS[s])
  check('战斗深度', '三个状态互不相同（防「三个风格其实是同一个状态」）', new Set(stArr).size === 3, stArr.join(','))

  // B. 抗性表（3×3 穷举：每个敌人风格唯一对应一个被抗状态，且恰好是被它克的那个风格的状态）
  const resistRows = styleIds.map((foe) => {
    const counter = Object.entries(STYLE_ADVANTAGE).find(([, beaten]) => beaten === foe)?.[0]
    return { foe, counter, expect: STYLE_STATUS[counter], got: T.resistedStatusOf(foe) }
  })
  check('战斗深度', '抗性表：敌人抵抗的 = 「克制它的那个风格」的状态（3 种风格逐个核对）',
    resistRows.every((r) => r.got === r.expect),
    resistRows.map((r) => `${r.foe}←${r.counter} 抗${r.got}`).join(' · '))
  check('战斗深度', '抗性倍率：普通对手减半、首领免疫，且首领一定低于普通（防写反）',
    T.RESIST_MULT === 0.5 && T.BOSS_RESIST_MULT === 0 && T.BOSS_RESIST_MULT < T.RESIST_MULT,
    `普通 ${T.RESIST_MULT} / 首领 ${T.BOSS_RESIST_MULT}`)

  // C. 触发率：随等级单调上升 + 封顶 + 被抗减半 + 首领免疫为 0
  const at = (lv, enemy, style) => T.statusTriggerChance(lv, enemy, style)
  const plain = { style: 'flavor' } // 调味流敌 ⇒ 抗「破防」，不抗刀工的「割伤」
  const res = { style: 'plating' } // 摆盘流敌 ⇒ 抗刀工的「割伤」
  // 上限必须**在等级范围内真的咬得住**（首版把上限设成 0.55，而满级 120 只到 0.484 ⇒ 上限是死代码）
  check('战斗深度', '触发率随等级上升、且**满级真的触到上限**（防上限成为死代码）',
    at(1, plain, 'knife') < at(100, plain, 'knife') && at(120, plain, 'knife') === T.STATUS_TRIGGER_MAX,
    `L1 ${at(1, plain, 'knife')} · L100 ${at(100, plain, 'knife')} · L120 ${at(120, plain, 'knife')} · 上限 ${T.STATUS_TRIGGER_MAX}`)
  // 减半要拿**未封顶的基准值**比（L100 还没到上限，所以 0.44/2=0.22 才对）
  const baseAt100 = Math.min(T.STATUS_TRIGGER_MAX, T.STATUS_TRIGGER_BASE + 100 * T.STATUS_TRIGGER_PER_LEVEL)
  check('战斗深度', '被抗时触发率恰好减半；首领为 0（免疫）',
    Math.abs(at(100, res, 'knife') - baseAt100 * 0.5) < 1e-9 && at(100, { ...res, isBoss: true }, 'knife') === 0,
    `基准 ${baseAt100} → 被抗 ${at(100, res, 'knife')} · 首领 ${at(100, { ...res, isBoss: true }, 'knife')}`)
  check('战斗深度', '未知风格 / 空对手返回 0（防「undefined 也能挂状态」）',
    at(100, null, 'knife') === 0 && at(100, plain, 'nope') === 0)

  // D. 形态等价（**这条是全批最重要的一条**）：装备为 0 时不能改变既有标定
  {
    const p = freshPlayer()
    for (const id of ['tasteAcumen', 'heatControl', 'knife', 'plating', 'flavorArtistry']) p.skills[id].level = 60
    p.equipment = Object.fromEntries(['weapon', 'offhand', 'helmet', 'body', 'legs', 'boots', 'amulet', 'ring'].map((s) => [s, null]))
    p.gearMods = {}; p.gemSockets = {}; p.upgrades = {}
    const cb = new Combat(p)
    cb.buffs = { atk: 0, accuracy: 0, defense: 0, evasion: 0, critChance: 0 }
    const ps = cb.playerStats()
    check('战斗深度', '裸装时命中与**旧公式**逐值相等（10 + 风格等级）⇒ 早期标定不受影响',
      ps.accuracy === 10 + 60, `实到 ${ps.accuracy} · 旧式 ${10 + 60}`)
    check('战斗深度', '裸装时闪避与旧公式逐值相等（5 + 火候×0.5）',
      ps.evasion === Math.floor(5 + 60 * 0.5), `实到 ${ps.evasion} · 旧式 ${Math.floor(5 + 60 * 0.5)}`)
    // 有装备命中时必须**严格更高**（否则「可堆」是假的），且等于旧式 ×(1+g/DIV)
    const gearId = Object.values(ITEMS).find((i) => i.type === 'equipment' && i.slot === 'weapon' && (i.stats?.accuracy ?? 0) > 0)?.id
    if (gearId) {
      p.equipment.weapon = gearId
      const g = ITEMS[gearId].stats.accuracy
      const ps2 = cb.playerStats()
      const want = Math.floor((10 + 60) * (1 + g / ACC_GEAR_DIV))
      check('战斗深度', '装备命中 > 0 时命中按乘区提高（堆命中真的有感）',
        ps2.accuracy === want && ps2.accuracy > ps.accuracy, `${ps.accuracy} → ${ps2.accuracy}（期望 ${want}，装备 +${g}）`)
    } else {
      check('战斗深度', '存在带命中的武器（否则「堆命中」无从谈起）', false, '全库找不到带 accuracy 的武器')
    }
    // 封顶：把**词条**给一个 10000 的命中（走 equippedStats 的加法路径），命中不得超过
    // `(等级项) × (1 + CAP/DIV)` —— 防「堆满命中把命中率推到 90%」
    if (gearId) {
      p.equipment.weapon = gearId
      p.gearMods[gearId] = { itemId: gearId, mods: [{ stat: 'accuracy', value: 10000 }] }
      const capped = cb.playerStats().accuracy
      const ceiling = Math.floor((10 + 60) * (1 + ACC_GEAR_CAP / ACC_GEAR_DIV))
      check('战斗深度', `装备命中堆到 10000 时仍被封顶（≤${ceiling}，不会失控）`,
        capped === ceiling, `实到 ${capped} · 上限 ${ceiling}`)
      p.gearMods = {}
      p.equipment.weapon = null
    }
  }

  // E. 行为（真实引擎）：挂状态 / DoT 掉血 / 破防降防 / 到期恢复 / 刷新不叠加 / 击杀当回合不挂
  {
    const p = freshPlayer()
    for (const id of ['tasteAcumen', 'heatControl', 'knife', 'plating', 'flavorArtistry']) p.skills[id].level = 60
    const cb = new Combat(p)
    setCombatInstance(cb)
    p.inventory.garnish = 99999
    const e = scaledEnemy(opp(60, 'C59敌', 'flavor')) // 调味流敌 ⇒ 不抗「割伤」
    const hitAlways = () => {
      p.combat.style = 'knife'
      p.setCombat({ hp: p.maxHp, flavorEnergy: 100 })
      cb.respawnUntil = 0
      cb.start(e)
    }
    // 用「直接调用 tryApplyStatus」把随机性拿掉，只验证结算是否正确
    hitAlways()
    let applied = 0
    for (let i = 0; i < 400 && applied === 0; i++) if (cb.tryApplyStatus(e)) applied++
    check('战斗深度', '真实引擎：命中后能对敌人施加状态（割伤）', applied === 1 && cb.enemyStatus.bleed === T.STATUS_TURNS,
      `enemyStatus=${JSON.stringify(cb.enemyStatus)}`)
    // 刷新不叠加（**必须先把状态预置好再掷**：首版只连掷两次、靠随机决定，注入「叠加」缺陷时
    // 第二次有 65% 概率没触发 ⇒ 守卫恒真 = 假绿。反例验证 ⑥ 抓出来的）
    cb.enemyStatus.bleed = T.STATUS_TURNS
    let again = 0
    for (let i = 0; i < 400 && again === 0; i++) if (cb.tryApplyStatus(e)) again++
    check('战斗深度', '重复施加是**刷新回合数**、不是叠加（防「高频攻击把 DoT 叠成无限」）',
      cb.enemyStatus.bleed === T.STATUS_TURNS && again === 1,
      `预置 ${T.STATUS_TURNS} ⇒ 再施加一次后 ${cb.enemyStatus.bleed}（叠加则会翻倍）`)
    // DoT：跑一回合，敌人掉血恰好 = dotDamage(攻击)
    const before = cb.opponentHp
    const atk = cb.playerStats().attack
    cb.settleEnemyStatus()
    const dealt = before - cb.opponentHp
    check('战斗深度', '割伤每回合按玩家攻击派生掉血（且计入 damageDealt ⇒ 经验口径一致）',
      dealt >= T.dotDamage(atk) && cb.damageDealt > 0, `掉 ${dealt}（dotDamage=${T.dotDamage(atk)}）· damageDealt=${cb.damageDealt}`)
    // 破防：降防 → 到期恢复
    hitAlways()
    cb.enemyStatus.dBreak = T.STATUS_TURNS
    check('战斗深度', '破防生效时敌人防御下降（引擎与界面同源出口 enemyDef）',
      cb.enemyDef() < e.def && cb.enemyDef() === T.brokenDef(e.def), `base ${e.def} → ${cb.enemyDef()}`)
    cb.enemyStatus.dBreak = 0
    check('战斗深度', '破防到期后防御回到原值（不是永久减益）', cb.enemyDef() === e.def, `${cb.enemyDef()} vs ${e.def}`)
    // 首领免疫
    const boss = COMBAT_BOSSES.find((b) => b.style === 'plating')
    if (boss) {
      hitAlways()
      const b2 = scaledEnemy(boss)
      let n = 0
      for (let i = 0; i < 400; i++) if (cb.tryApplyStatus(b2)) n++
      check('战斗深度', `首领免疫状态（${boss.name}）`, n === 0, `400 次尝试施加 ${n} 次`)
    }
  }

    // F. 显示同源 + 冻结数据零改动
  {
    // 🔴 **调用点断言**：上面那些 `tryApplyStatus` 是**直接调函数**，证明不了「引擎真的会调它」——
    //    反例验证 ⑦ 把调用点改成 `if (false && ...)`，守卫依然全绿（典型的「只测函数、不测接线」）。
    //    所以这里静态钉住调用点在 `playerAttack` 内、在命中分支之后、且带 `opponentHp > 0` 门。
    const engineSrc = fs.readFileSync(new URL('../../src/game/combat/Combat.js', import.meta.url), 'utf8')
    const atkBody = engineSrc.slice(engineSrc.indexOf('  playerAttack('), engineSrc.indexOf('  opponentAttack('))
    check('战斗深度', '引擎真的会在命中后调用施加逻辑（调用点在 playerAttack 内，且对手未死才挂）',
      /if \(COMBAT_DEPTH_V1 && this\.opponentHp > 0\) this\.tryApplyStatus\(o\)/.test(atkBody),
      atkBody.includes('tryApplyStatus') ? '调用点存在但门条件不符' : 'playerAttack 里根本没有调用点')
    check('战斗深度', '敌人状态在每回合被结算（settleEnemyStatus 在 resolveTurn 里被调用）',
      /this\.settleEnemyStatus\(\)/.test(engineSrc.slice(engineSrc.indexOf('  resolveTurn()'), engineSrc.indexOf('  maybeAutoEat()'))),
      'resolveTurn 里没有结算调用')
  }
  {
    const arena = fs.readFileSync(new URL('../../src/components/CombatArena.vue', import.meta.url), 'utf8')
    const logv = fs.readFileSync(new URL('../../src/views/LogView.vue', import.meta.url), 'utf8')
    const cv = fs.readFileSync(new URL('../../src/views/CombatView.vue', import.meta.url), 'utf8')
    check('战斗深度', '战斗屏调 combatTuning 的出口（STATUS_INFO/resistText），不手写状态名',
      /STATUS_INFO/.test(arena) && /resistText/.test(arena) && !/割伤|破防/.test(arena.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')), 'CombatArena.vue')
    check('战斗深度', '对手详情（对决页 · 首领图鉴）都展示抗性，且文案来自同一个出口',
      /resistText/.test(cv) && /resistText/.test(logv), 'CombatView.vue + LogView.vue')
    // 🔴 抗性行**不许挂在 `v-if="selected.mechanic"` 门里**：区域对手的 mechanic 恒为 null（机制只有首领有），
    //    而区域才是练级的常打目标 ⇒ 挂进去等于「最需要看抗性的 220 个敌人反而看不到」。
    check('战斗深度', '对决页的抗性行是独立一行（不挂在「机制」那行的 mechanic 门里）',
      /v-if="resistOf\(selected\)"/.test(cv), 'CombatView.vue 里找不到独立的抗性行')
    // 冻结数据：combat.js 不得反向依赖本模块（数据层只被读、不去读别人的开关）
    const raw = fs.readFileSync(new URL('../../src/game/data/combat.js', import.meta.url), 'utf8')
    check('战斗深度', '冻结的敌人数据层不反向 import combatTuning（只被读取，不去读开关）',
      !/combatTuning/.test(raw), 'src/game/data/combat.js')
    // 敌人基线：248 个敌人的 acc+eva 合计与 hp 合计（**本批只动读取点，数据一个字节没动**）
    // hp 合计 87906 与 AGENTS 里那条既有冻结基线同源，互为交叉验证
    const allE = [...COMBAT_REGIONS.flatMap((r) => r.opponents), ...COMBAT_BOSSES]
    const sumAccEva = allE.reduce((a, o) => a + o.acc + o.eva, 0)
    const sumHp = allE.reduce((a, o) => a + o.hp, 0)
    check('战斗深度', `248 个敌人的 acc+eva 合计与 hp 合计仍是冻结基线（${sumAccEva} / ${sumHp}）`,
      sumAccEva === 53030.5 && sumHp === 87906, `实到 ${sumAccEva} / ${sumHp}`)
  }
}

// ── C60. 越级重击（2026-09-26 第二批：补上体检里的「续航墙」）──
// 问题（实测）：自动进食按**上限的 50%** 触发且免费，而敌人每回合只打掉你上限的 ~2.5%
//   ⇒ 没有任何敌人能一击打死你（连首领 `instantKill` 的上限也是 hp×0.8）⇒ L60 满配能 100%
//   打赢 **L860** 的敌人（Δ+800）。对照 Melvor：怪的「单次最大伤害」是显式数值，`max hit ≥ 当前血量`
//   就秒杀，自动进食在受伤之后才触发、救不回来 —— 那才是它的难度来源。
// 处置：按**等级差**派生的重击，`gap ≤ 1.15` 时**恒为 0** ⇒ **同等级战斗一个字节不变**。
console.log('══ C60. 越级重击 ══')
{
  const T = await import('../../src/game/data/combatTuning.js')
  const { levelGap, heavyPct, heavyChance, heavyDamage, heavyText, isHeavyLethal, HEAVY_GAP_FREE, HEAVY_PCT_CAP, HEAVY_CHANCE_CAP } = T

  // A. 同等级与以下：恒为 0（这是「不破坏既有标定」的全部依据）
  const free = []
  for (const [e, pl] of [[1, 1], [60, 60], [120, 120], [69, 60], [60, 120], [1, 120]]) {
    if (heavyPct(e, pl) !== 0 || heavyChance(e, pl) !== 0) free.push(`L${e}/L${pl}`)
  }
  check('越级重击', `同等级及以下的对手**恒不触发**（gap ≤ ${HEAVY_GAP_FREE} ⇒ 0）—— TTK／成长标定不受影响`,
    free.length === 0, free.join(',') || '6 组全为 0（含 61 打 60、120 打 60 这类不越级的）')

  // B. 单调 + 封顶 + 非法输入
  const pcts = [1.2, 1.5, 2, 3, 4, 5, 10].map((g) => heavyPct(g * 60, 60))
  const mono = pcts.every((v, i) => i === 0 || v >= pcts[i - 1])
  check('越级重击', '重击幅度随等级差**单调不减**且封顶（不会越级越多反而越轻）',
    mono && pcts[pcts.length - 1] === HEAVY_PCT_CAP, `${pcts.map((v) => Math.round(v * 100) + '%').join(' → ')}`)
  check('越级重击', '非法输入不炸也不误伤（敌人等级 0/负、玩家等级 0/NaN ⇒ 按 1 或不触发）',
    heavyPct(0, 60) === 0 && heavyPct(-5, 60) === 0 && heavyPct(60, 0) > 0 && Number.isFinite(heavyPct(60, NaN)),
    `0/60=${heavyPct(0, 60)} · -5/60=${heavyPct(-5, 60)} · 60/0=${heavyPct(60, 0).toFixed(2)}`)

  // D. 致命线：gap 到 4 倍等级时，重击应当 ≥ 血量上限（这才是「有风险」）
  const lethalGap = (() => { for (let g = 1.2; g < 8; g += 0.005) if (heavyPct(60 * g, 60) >= 1) return g; return null })()
  check('越级重击', '越级约 4 倍等级时重击足以一击致命（否则「越级有风险」只是话术）',
    lethalGap !== null && lethalGap <= 4.1, `致命线 gap ≈ ${lethalGap?.toFixed(3)}（L60 打 ${Math.round(60 * (lethalGap ?? 0))}）`)
  // 🔴 致命性必须**真的致命**：首版 `floor(上限 × pct)`，4 倍等级时 pct=0.9975 ⇒ `floor(600×0.9975)=598`，
  //    而上限 600 ⇒ **永远差 2 点打不到 0** —— 设计上是「一击致命」，实测变成「打剩 0.25% 血、
  //    再靠有没有饭 + 下回合补刀决定生死」。致命线落在 gap 4.007、我按 4.0 宣传，差的 0.007 就是那 2 点血。
  {
    const maxHp = 600
    const at = (gap) => heavyDamage(maxHp, gap * 60, 60, 0)
    const lt = (gap) => isHeavyLethal(maxHp, gap * 60, 60, 0)
    const g5 = 5.0
    check('越级重击', 'pct ≥ 1 时伤害**严格大于**血量上限（从满血一击必死，不再受取整余数影响）',
      at(g5) > maxHp && lt(g5) === true, `gap ${g5}：伤害 ${at(g5)} vs 上限 ${maxHp}`)
    check('越级重击', 'pct < 1 时**不**判为致命（濒死 ≠ 必死 —— 文案不能替结算下重话）',
      !lt(4.0) && at(4.0) < maxHp, `gap 4.0：伤害 ${at(4.0)} vs 上限 ${maxHp} ⇒ isHeavyLethal=${lt(4.0)}`)
    // 文案与结算同源：文案说「对你是一击致命」时，结算必须真的能一击打死满血玩家
    let mismatch = []
    for (const gap of [2, 3, 4, 4.5, 5, 8]) {
      const t = heavyText(gap * 60, 60, maxHp, 0) ?? ''
      const saysLethal = /一击致命/.test(t)
      if (saysLethal !== lt(gap)) mismatch.push(`gap ${gap}: 文案=${saysLethal} 结算=${lt(gap)}`)
    }
    check('越级重击', '「对你是一击致命」这句与结算**逐格同源**（文案说致命 ⇒ 结算真的打得死满血）',
      mismatch.length === 0, mismatch.join(' | ') || '6 档全一致')
    // 受击减免让「致命」变回「不致命」⇒ 文案也要跟着变（否则玩家白堆减伤）
    const t50 = heavyText(5 * 60, 60, maxHp, 50) ?? ''
    check('越级重击', '堆了受击减免后，文案不再说「一击致命」（同一个人、同一个怪，结论随配置变）',
      !/一击致命/.test(t50) && !isHeavyLethal(maxHp, 5 * 60, 60, 50), `减伤 50% 时文案「${t50}」`)
  }

  // D. 受击减免能减它（玩家有明确反制手段；且与属性面板那一行同一个值）
  const full = heavyDamage(1000, 300, 60, 0)
  const halved = heavyDamage(1000, 300, 60, 50)
  check('越级重击', '「受击减免」能减重击（面板那一行的同一个值 ⇒ 玩家的反制是有效的）',
    halved === Math.floor(full * 0.5) && halved < full, `0% 时 ${full} → 50% 时 ${halved}`)

  // E. 引擎接线：真的会在对手攻击里触发，且**一次/场**
  {
    const engineSrc = fs.readFileSync(new URL('../../src/game/combat/Combat.js', import.meta.url), 'utf8')
    const atkBody = engineSrc.slice(engineSrc.indexOf('  opponentAttack('), engineSrc.indexOf('  damagePlayer('))
    check('越级重击', '引擎在对手攻击里调用它（调用点在 opponentAttack 内，且带「概率 0 就不掷」的短路）',
      /heavyChance\(/.test(atkBody) && /this\.heavyFired/.test(atkBody) && /hch > 0 && Math\.random\(\)/.test(atkBody),
      'opponentAttack 里找不到调用，或缺了 `hch > 0` 短路（会白吃一个随机数 ⇒ 同等级不再逐次一致）')
    // 行为：造一个「巨大等级差」的战斗，重击必须真的打出来
    const p = freshPlayer()
    for (const id of ['tasteAcumen', 'heatControl', 'knife', 'plating', 'flavorArtistry']) p.skills[id].level = 20
    const cb = new Combat(p)
    setCombatInstance(cb)
    // 行为：造一个「巨大等级差 + 打不死玩家」的局面，用**固定随机序列**让掷骰确定性
    //   ⚠️ 首版让玩家正常挨打 ⇒ 第一回合就被秒（L20 打 L400），整场只有**一次**掷骰机会
    //   ⇒ 「12 场都该触发」是错的期望（实测 1/12，那正是 65% 不触发的正常结果）。
    //   现在把敌人攻击设成 0（重击按**玩家血量上限**算、与敌人攻击无关）⇒ 玩家能活很多回合；
    //   再用 withRandom 把掷骰钉死 ⇒ 完全确定。
    const far = { ...scaledEnemy(opp(400, 'C60越级敌', 'plating')), atk: 0, hp: 999999 } // gap = 20
    const runOne = () => {
      p.setCombat({ hp: p.maxHp, flavorEnergy: 100 })
      cb.respawnUntil = 0
      cb.start(far)
      let t = 0
      while (cb.inFight && t < 300) { cb.resolveTurn(); t++ }
      return cb
    }
    let fired = 0
    withRandom([0], () => { runOne(); if (cb.heavyFired) fired++ }) // 0 < 0.35 ⇒ 必中
    check('越级重击', '真实引擎：巨大等级差下**掷中即触发**（掷骰钉死 ⇒ 确定性，不靠运气）',
      fired === 1, `${fired}/1 场触发（此局面重击 ≥100% 上限 ⇒ 一击必杀，日志应有「越级重击！」）`)
    // 概率必须封顶（直接用纯函数断言 ⇒ 确定性）
    //   ⚠️ 首版用「钉一个大随机数 ⇒ 应当不触发」来测这条 —— **那是假绿**：把 Math.random 钉成 0.99
    //   会让**更前面**的命中判定先失败（`0.99 > hitChance`）⇒ 根本走不到重击那一步，看起来「没触发」。
    const chances = [1.2, 1.5, 2, 3, 5, 10, 50].map((g) => heavyChance(g * 60, 60))
    check('越级重击', `触发概率恒 ≤ 1 且封顶（${HEAVY_CHANCE_CAP}）—— 防「越级一多就每回合必中」`,
      chances.every((v) => v <= 1) && chances[chances.length - 1] === HEAVY_CHANCE_CAP,
      chances.map((v) => v.toFixed(2)).join(' → '))
    // 一场只触发一次：**用一个非致命的等级差 + 每回合补满血**，让玩家能活过重击
    //   （否则第一发就结束战斗 —— 首版就是这么假绿的：致命局里「只触发一次」与「守卫存在」无法区分）
    //   ⚠️ 只数公告那一行：`damagePlayer(hd, '💢 越级重击')` 也会写一行带这四个字的日志，
    //   首版把两行都数进去 ⇒ 误报「一场触发 2 次」（是测试计数错，不是引擎错）。
    const near = { ...scaledEnemy(opp(60, 'C60近敌', 'plating')), atk: 0, hp: 999999 } // gap 3.0 ⇒ 重击 65% 上限
    let announcements = 0
    withRandom([0.01], () => { // 0.01 能过命中判定、也能过重击掷骰 ⇒ 每回合都该触发（若无守卫）
      p.setCombat({ hp: p.maxHp, flavorEnergy: 100 })
      cb.respawnUntil = 0
      cb.start(near)
      let t = 0
      while (cb.inFight && t < 40) {
        cb.resolveTurn()
        t++
        if (cb.inFight) p.setCombat({ hp: p.maxHp }) // 补满血 ⇒ 能反复承受这次重击（132 伤害 / 上限 200）
        announcements = Math.max(announcements, cb.log.filter((l) => /越级重击！/.test(l.text)).length)
      }
    })
    check('越级重击', '一场只触发一次（防「连续两次直接秒杀、玩家连退都来不及」）',
      announcements === 1, `连打 40 回合（每回合补满血，若去掉守卫就该每回合都触发）公告累计 ${announcements} 次`)
  }

  // F. 显示同源：详情页那行与引擎用同一个出口
  {
    const cv = fs.readFileSync(new URL('../../src/views/CombatView.vue', import.meta.url), 'utf8')
    const arena = fs.readFileSync(new URL('../../src/components/CombatArena.vue', import.meta.url), 'utf8')
    check('越级重击', '对决页与战斗屏都展示越级风险，且走 combatTuning 的出口（不手写文案）',
      /heavyText/.test(cv) && /heavyText/.test(arena) &&
      !/越级风险：/.test(cv.replace(/<!--[\s\S]*?-->/g, '')) && !/越级风险：/.test(arena.replace(/<!--[\s\S]*?-->/g, '')),
      'CombatView.vue + CombatArena.vue')
  }
}

console.log('══ C61. 美食奥义栏（对决组合框第三栏）══')
{
  // 2026-09-26 用户要求：「给对决风格组合框再加一栏：美食奥义，只放战斗相关的美食奥义」
  const { AOJIS } = await import('../../src/game/data/aojis.js')
  const COMBAT_EFFECT_KEYS = ['dmgPct', 'styleDmgPct', 'defensePct', 'speedPct', 'maxHpBonus', 'healPct']
  const byEffect = AOJIS.filter((a) => Object.keys(a.effect ?? {}).some((k) => COMBAT_EFFECT_KEYS.includes(k)))
  const byCategory = AOJIS.filter((a) => ['攻击', '防御'].includes(a.category))
  // 组件按 category 过滤；这条断言保证「按分类筛」与「按效果字段筛」**永远等价**（新增奥义时分类写错立刻 FAIL）
  check('美食奥义栏', `按 category（攻击/防御）筛 == 按战斗效果字段筛（各 ${byCategory.length} / ${byEffect.length} 条）`,
    byCategory.length === byEffect.length && byCategory.every((a) => byEffect.includes(a)),
    `分类筛 ${byCategory.length} · 效果筛 ${byEffect.length} · 只被分类选中的 ${byCategory.filter((a) => !byEffect.includes(a)).map((a) => a.id).join(',') || '无'}`)
  const nonCombat = AOJIS.filter((a) => !byEffect.includes(a))
  check('美食奥义栏', `非战斗奥义（采集类 ${nonCombat.length} 条）**不得**出现在这一栏里`,
    nonCombat.every((a) => !['攻击', '防御'].includes(a.category)),
    nonCombat.map((a) => `${a.id}:${a.category}`).join(' · '))

  const panel = fs.readFileSync(new URL('../../src/components/CombatPanel.vue', import.meta.url), 'utf8')
  const tmpl = panel.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')
  // 🔴 上面那条比的是**数据**；下面这条比的是**组件里的过滤白名单** —— 反例验证 ①② 证明了只比数据是假绿：
  //    把组件里的 COMBAT_CATEGORIES 改成 ['攻击']（漏 12 条防御）或把 filter 换成 `() => true`（塞进采集类），
  //    数据侧断言照样全绿。所以组件那一份必须单独钉：白名单**等于**数据算出来的分类集合，且过滤表达式真的用它。
  const compCats = (panel.match(/const COMBAT_CATEGORIES = \[([^\]]*)\]/)?.[1] ?? '')
    .split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean).sort()
  const dataCats = [...new Set(byEffect.map((a) => a.category))].sort()
  check('美食奥义栏', `组件里的分类白名单 == 数据算出来的战斗分类集合（${JSON.stringify(compCats)}）`,
    compCats.length > 0 && JSON.stringify(compCats) === JSON.stringify(dataCats),
    `组件 ${JSON.stringify(compCats)} vs 数据 ${JSON.stringify(dataCats)}`)
  check('美食奥义栏', '过滤表达式真的按分类白名单过滤（防「换成恒真 / 换别的字段」）',
    /AOJIS\.filter\(\(a\) => COMBAT_CATEGORIES\.includes\(a\.category\)\)/.test(panel),
    'CombatPanel.vue 里的 AOJIS.filter 不再按 COMBAT_CATEGORIES 过滤')
  check('美食奥义栏', '栏标题与「战斗相关 N 条」副标题都在（数量是**算出来的**，不是手写死的）',
    /combatAojis\.length/.test(tmpl) && /战斗相关/.test(tmpl), 'CombatPanel.vue')
  check('美食奥义栏', '效果文案取自奥义数据（desc），不在模板里手写',
    /a\.desc/.test(tmpl) && !/伤害 \+10%/.test(tmpl), 'CombatPanel.vue')
  // 只读 + 跳转：奥义开关归「美食知识」页 ⇒ 这里不许出现第二个开关入口（项目规矩：同一件事只留一个操作入口）
  check('美食奥义栏', '这一栏是**只读参考**（不写 gastronomy.active，只跳转）—— 防第二个开关入口',
    !/gastronomy\.active\s*=/.test(tmpl) && !/gastronomy\.active\.(push|splice)/.test(tmpl) && /goGastronomy/.test(tmpl),
    'CombatPanel.vue 里出现了对 gastronomy.active 的写操作')
  check('美食奥义栏', '跳「美食知识」带 skill 子目标（先 setActiveSkill 再 setView —— 只 setView 会跳到当前在练的技能页）',
    /setActiveSkill\('gastronomy'\)[\s\S]{0,90}setView\('skill'\)/.test(panel), 'goGastronomy 的实现顺序')
  // 布局：组合框要真有第三栏（grid 五列：左 1fr / 虚线 / 属性 1.4fr / 虚线 / 奥义）
  const css61 = fs.readFileSync(new URL('../../src/styles/main.css', import.meta.url), 'utf8')
  check('美食奥义栏', '组合框是 5 列网格，且窄屏仍降级为单列',
    /\.combat-combo\s*\{[^}]*grid-template-columns:\s*1fr 1px 1\.4fr 1px [\d.]+fr/.test(css61) &&
    /@media \(max-width: 720px\)\s*\{[\s\S]{0,200}\.combat-combo\s*\{[^}]*grid-template-columns:\s*1fr/.test(css61),
    'main.css 的 .combat-combo')
}

console.log('══ X. 觅珍抽卡 ══')
{
  const p = freshPlayer()
  p.gold = 100000
  const r1 = p.drawMijian('material', 3)
  check('觅珍', '材料池抽卡返回 3 个结果，且其中物品都是有效材料（金币档见下）', r1.ok && r1.results.length === 3 && r1.results.every((it) => (it?.gold > 0) || (it?.type && it.value > 0)), JSON.stringify((r1.results ?? []).map((it) => it?.id ?? ('gold' + it?.gold))))
  const r2 = p.drawMijian('food', 1)
  check('觅珍', '食物池产出的物品都是食物/饮品', r2.ok && r2.results.filter((it) => !it?.gold).every((it) => ['food', 'drink'].includes(it?.type)), JSON.stringify((r2.results ?? []).map((it) => it?.id ?? ('gold' + it?.gold))))
  const r3 = p.drawMijian('gear', 1)
  const gearOk = r3.ok && r3.results.length === 1 && r3.results[0]?.type === 'equipment'
  check('觅珍', '厨具池产出装备', gearOk, JSON.stringify((r3.results ?? []).map((it) => it?.id)))
  // 垫底档会返还金币（材料/食物池）⇒ 扣费口径 = 花费 − 返还
  const refund1 = (r1.gold ?? 0) + (r2.gold ?? 0)
  check('觅珍', '金币扣费（材料60*3+食物110+厨具500=790，扣掉垫底档返还）', p.gold === 100000 - 790 + refund1, `gold=${p.gold} refund=${refund1}`)
  // 保底计数：连续未出稀有+ → 到保底抽数必出（2026-09-22 规格：厨具池 40 抽；pity 结构为 {rare, myth}）
  p.mijian.pity = { mix: { rare: 0, myth: 0 }, gear: { rare: 39, myth: 0 }, limited: { rare: 0, myth: 0 } }
  const r4 = p.drawMijian('gear', 1)
  const boosted = r4.boosted && ['稀有', '史诗', '传说', '神话'].includes(r4.results[0]?.quality)
  check('觅珍', '保底第 40 抽必出稀有及以上', boosted, JSON.stringify(r4.results.map((it) => [it?.id, it?.quality])))
  check('觅珍', '保底后 rare 计数清零（gear）', p.mijian.pity.gear.rare === 0)
  // 混池 / 限时池 / 百连
  const r5 = p.drawMijian('mix', 5)
  const mixOk = r5.ok && r5.results.length === 5 && r5.results.filter((it) => !it?.gold).every((it) => it && it.value > 0)
  check('觅珍', '混池抽卡（80 金/抽，全品类）', mixOk, JSON.stringify((r5.results ?? []).map((it) => it?.id)))
  const r6 = p.drawMijian('limited', 1)
  check('觅珍', '限时池抽卡（1200 金/抽）', r6.ok && r6.results.length === 1 && r6.results[0]?.id, JSON.stringify((r6.results ?? []).map((it) => it?.id)))
  const r100 = p.drawMijian('material', 100)
  check('觅珍', '百连（100 张结果）', r100.ok && r100.results.length === 100, JSON.stringify(r100.results.length))
  const afterSpent = p.gold
  const refundAll = (r1.gold ?? 0) + (r2.gold ?? 0) + (r5.gold ?? 0) + (r100.gold ?? 0)
  check('觅珍', '金币扣费与累计花费一致（stats.spent = 花费 − 返还 − 剩余）', p.mijian.stats.spent === 100000 + refundAll - afterSpent, `spent=${p.mijian.stats.spent} gold=${afterSpent} refund=${refundAll}`)
  // 限时池保底：40 抽（rare = 39 → 下一抽必稀有+；神话计数别先撞线）
  p.mijian.pity = { mix: { rare: 0, myth: 0 }, gear: { rare: 0, myth: 0 }, limited: { rare: 39, myth: 0 } }
  const r7 = p.drawMijian('limited', 1)
  check('觅珍', '限时池保底第 40 抽必出稀有及以上', r7.boosted && ['稀有', '史诗', '传说', '神话'].includes(r7.results[0]?.quality), JSON.stringify(r7.results.map((it) => [it?.id, it?.quality])))
  // 爆率口径（2026-09-06 全面下调后；抽样区间校验）
  {
    const { pickItem: pk } = await import('../../src/game/data/mijianDraws.js')
    const RARE = ['稀有', '史诗', '传说', '神话']
    const N = 20000
    // 🔴 抽样校验必须**可复现**（2026-09-22 第二次踩这个坑）：用固定种子的 LCG，不用 `Math.random` ——
    //    否则每次样本都不同，而「以期望值 ±max(0.35pp,4σ) 判定」的前提（期望值本身正确）一旦错，
    //    就会变成**间歇性假失败**（CI 实测混池出现过 1.69%；而它的真实基础爆率是 **1.59%**，
    //    按 2.1% 建的带子下界 1.69% 正好压在边界上 ⇒ 偶发红）。
    //    换种子 RNG 后测量值恒定 ⇒ 可以**断言定值**（比区间更强），任何池子/权重改动立刻可见。
    const lcg = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }
    const rate = (poolId, n = 50000) => {
      const rng = lcg(20260922)
      let rare = 0
      for (let i = 0; i < n; i++) {
        const { item } = pk(poolId, rng, 0)
        if (item?.quality && RARE.includes(item.quality)) rare++
      }
      return rare / n
    }
    // 每次传 pity=0 ⇒ 软保底/硬保底都不参与，量的就是**基础爆率**（= 公示表那一列）
    // ±0.15pp 只用于吸收池成员变动带来的真实位移（种子样本本身是确定的）
    const near = (x, p) => Math.abs(x - p) <= 0.0010 // 种子样本已确定 ⇒ 收紧到 0.1pp（权重一改就报）
    const g = rate('gear'), m = rate('mix'), l = rate('limited')
    check('觅珍', '厨具池基础稀有+ 爆率 = 品质权重本身 4%（种子 50k 样本实测 4.010%）', near(g, 0.0401), `g=${(g * 100).toFixed(3)}%`)
    check('觅珍', '限时池基础稀有+ 爆率 = 80% × 1.5% = 1.2%（种子 50k 样本实测 1.152%）', near(l, 0.01152), `l=${(l * 100).toFixed(3)}%`)
    // ⚠️ 混池基础稀有+ 的构成：正常分支（10%）× 4% + 低档分支（25%）里的低阶稀有装备 ——
    //    这是规格「低档物品 = 价值最低 20% 的固定集合」的必然结果（公示表的装备列只描述正常分支）。
    //    2026-09-25 混池正常分支 35%→10% 后，真实值 **0.866%**（种子 50k、在**游戏真实池状态**下实测；
    //    低档分支贡献 ≈0.47%——价值平衡会移动低档集合的构成，权重/价值一改这里就要重新钉）。
    //    ⚠️ 拿裸 import 的模块去量会得到不同值 —— 池子按 value 筛，而 `applyValueBalance()` 会改 value 并清缓存，
    //    没跑平衡前的那份池子成员不同（见「浏览器侧验证坑」那条同类教训）。
    check('觅珍', '混池基础稀有+ 爆率 = 0.866%（正常分支 0.4% + 低档分支里的低阶稀有装备 ≈0.47%；种子 50k 实测）', near(m, 0.00866), `m=${(m * 100).toFixed(3)}%`)
    // 🔴 回收率上限（2026-09-26 新增）：回收率 = (金币返还 + 物品价值×0.5) ÷ 池价。
    //    为什么要钉：这条数**唯一的作用是当套利上限** —— 只要 <100%，就不存在「金币 → 抽卡 → 再卖 → 金币」的闭环。
    //    ⚠️ 它**不是「抽卡值不值」的度量**（2026-09-26 用户订正：「抽卡本来就是付出和赌」）：玩家买的是物品与
    //    那一把的概率，返金只是垫底结果。所以断言写的是「≤30%」这条线，不是「必须落在某区间」。
    //    而它**只能靠测量**得到（低档分支对回收的贡献 ≈0，正常分支的价值取决于池成员 value ⇒
    //    任何池成员 / 分支权重 / 返金比例的改动都会移动它，静态读常量看不出来）。
    //    35%→20% 之前：混池 37.8%（顶破旧标定带 30~40% 的上沿）、食物 23.2%、材料 22.6%；
    //    之后五池全部 ≤30%（厨具 15.0 / 限时 11.3 无返金档，本来就不受影响）。
    //    种子定值断言 ⇒ 谁把返金或分支调回去，这一条立刻点名（±0.5pp 只吸收池成员变动的位移）。
    const recycle = (poolId, n = 50000) => {
      const rng = lcg(20260922)
      const def = MIJIAN_POOLS.find((x) => x.id === poolId)
      let back = 0
      for (let i = 0; i < n; i++) {
        const r = pk(poolId, rng, 0)
        if (r?.gold) back += r.gold
        else if (r?.item) back += (r.item.value ?? 0) * 0.5
      }
      return back / n / (def?.price || 1)
    }
    //    ⚠️ 本断言量的是 **CI 环境**的值（这段之前**还没有** applyValueBalance，池成员按原始 value 筛）；
    //    线上启动时跑过平衡（bootstrap.js），同口径实测 **材料 16.5 / 食物 17.2 / 厨具 15.0 / 混池 28.0 / 限时 11.3**
    //    （scripts/sim/mijian_economy.mjs）。两边差 ≤0.6pp，且都 <30% —— **判据是 30% 这条线**，定值只是"改动立刻可见"。
    //    若哪天在更早的位置加了 applyValueBalance（或重排段落），这几个数会整体挪 0.5pp 左右 ⇒ 按实测重新钉。
    const RECYCLE = { material: 0.1654, food: 0.1721, gear: 0.1552, mix: 0.2772, limited: 0.1116 }
    for (const [pid, exp] of Object.entries(RECYCLE)) {
      const r = recycle(pid)
      check('觅珍', `回收率：${pid} = ${(exp * 100).toFixed(1)}%（种子 50k 定值 ±0.5pp，且必须 ≤30%）`,
        Math.abs(r - exp) <= 0.005 && r <= 0.30, `实测 ${(r * 100).toFixed(2)}%`)
    }
    // 普通池确定性：绝不产出超过价值上限的珍品（金币档不算物品，跳过）
    let capped = true
    for (let i = 0; i < 200; i++) {
      const mat = pk('material', Math.random, 0)
      const foo = pk('food', Math.random, 0)
      const matV = mat.gold ? 0 : (mat.item?.value ?? 0)
      const fooV = foo.gold ? 0 : (foo.item?.value ?? 0)
      if (matV > 50 || fooV > 100) capped = false
    }
    check('觅珍', '材料/食物池无珍品（价值上限 50/100）', capped)
  }
  // ── 分支 / 双保底 / 软保底 / 公示表（2026-09-22 用户给的完整规格）──
  {
    const MJ = await import('../../src/game/data/mijianDraws.js')
    const { BRANCH, MIX_BRANCH, branchOf, BRANCH_POOLS, REFUND_PCT, refundOf, cheapTier, poolItems, pickItem } = MJ
    // ② 三档分支与固定返金（规格「通用前置规则 #5」+「池子总览表」）
    //    2026-09-25 用户拍板「混池调低」：混池正常分支=纯装备（高价值）把回收率顶到 51.3%，
    //    单独改为 65/25/10（当时返金 35% ⇒ 回收率 ≈33.6%）；材料/食物仍 40/25/35。
    //    2026-09-26 用户「不能让觅珍回收率太大，不然还是能刷钱」⇒ 只下调返金档 35% → 20%
    //    （低档物品对回收的贡献 ≈0，所以返金档是回收率的唯一大杠杆），五池回收率全部 ≤30%。
    check('觅珍', '三档分支 = 材料/食物 40% 返金 / 25% 低档 / 35% 正常；混池专用 65/25/10（各自相加 == 100%）',
      BRANCH.gold === 0.4 && BRANCH.cheap === 0.25 && BRANCH.normal === 0.35 &&
      MIX_BRANCH.gold === 0.65 && MIX_BRANCH.cheap === 0.25 && MIX_BRANCH.normal === 0.1 &&
      branchOf('material') === BRANCH && branchOf('food') === BRANCH && branchOf('mix') === MIX_BRANCH &&
      Math.abs(BRANCH.gold + BRANCH.cheap + BRANCH.normal - 1) < 1e-9 &&
      Math.abs(MIX_BRANCH.gold + MIX_BRANCH.cheap + MIX_BRANCH.normal - 1) < 1e-9,
      `BRANCH=${JSON.stringify(BRANCH)} MIX=${JSON.stringify(MIX_BRANCH)}`)
    check('觅珍', '分支池 = 材料/食物/混池（装备池不返金、每抽必出装备）', BRANCH_POOLS.join(',') === 'material,food,mix', BRANCH_POOLS.join(','))
    check('觅珍', '返金固定 20% 抽卡成本、**按整数落地**：材料 12 / 食物 22 / 混池 16（金币引擎会 floor）',
      REFUND_PCT === 0.2 && refundOf(60) === 12 && refundOf(110) === 22 && refundOf(80) === 16 &&
      Number.isInteger(refundOf(110)),
      `${refundOf(60)} / ${refundOf(110)} / ${refundOf(80)}`)
    check('觅珍', '低档物品 = 池内价值最低的 20%（按件取整，至少 1 件；判据并列安全）', (() => {
      const t = cheapTier('material')
      const all = poolItems('material')
      const tIds = new Set(t.map((x) => x.id))
      const maxT = Math.max(...t.map((x) => x.value ?? 0))
      return t.length === Math.max(1, Math.floor(all.length * 0.2)) && all.filter((x) => !tIds.has(x.id)).every((x) => (x.value ?? 0) >= maxT)
    })())
    // ② 双保底表（规格「池子总览表」的保底类型列）
    check('觅珍', '双保底上限：混池 50/300 · 厨具 40/200 · 限时 40/200（材料/食物无装备保底）',
      MJ.PITY_RULES.mix.rare === 50 && MJ.PITY_RULES.mix.myth === 300 &&
      MJ.PITY_RULES.gear.rare === 40 && MJ.PITY_RULES.gear.myth === 200 &&
      MJ.PITY_RULES.limited.rare === 40 && MJ.PITY_RULES.limited.myth === 200 &&
      MJ.pityRuleOf('material') === null && MJ.pityRuleOf('food') === null)
    check('觅珍', '保底命中分布：混池 70/22/7/1 · 厨具与限时 65/24/9/2（两张不同的表）',
      JSON.stringify(MJ.PITY_RULES.mix.table) === JSON.stringify({ 稀有: 70, 史诗: 22, 传说: 7, 神话: 1 }) &&
      JSON.stringify(MJ.PITY_RULES.gear.table) === JSON.stringify({ 稀有: 65, 史诗: 24, 传说: 9, 神话: 2 }) &&
      MJ.PITY_RULES.gear.table === MJ.PITY_RULES.limited.table)
    // ③ 软保底：保底前 10 抽线性提升，且**不会到 100%**（否则硬保底与它的分布表就成了死代码）
    const softAt = (pool, c) => MJ.softRareP(pool, c)
    check('觅珍', '软保底区间 = 保底前 10 抽（厨具第 30~39 抽；混池第 40~49 抽）',
      softAt('gear', 29) === null && softAt('gear', 30) !== null && softAt('gear', 39) !== null && softAt('gear', 40) === null &&
      softAt('mix', 39) === null && softAt('mix', 40) !== null && softAt('mix', 49) !== null)
    check('觅珍', '软保底线性单调递增，末抽 = SOFT_MAX_P（<100%，给硬保底留缺口）',
      softAt('gear', 30) < softAt('gear', 35) && softAt('gear', 35) < softAt('gear', 39) &&
      Math.abs(softAt('gear', 39) - MJ.SOFT_MAX_P) < 1e-9 && MJ.SOFT_MAX_P < 1 && MJ.SOFT_MAX_P >= 0.5,
      `soft(30)=${softAt('gear', 30).toFixed(3)} soft(39)=${softAt('gear', 39).toFixed(3)}`)
    check('觅珍', 'scaleRareShare：把稀有+ 占比抬到目标值，且表内比例（稀有:史诗:传说:神话）保持',
      (() => {
        const t = MJ.scaleRareShare(MJ.QUALITY_WEIGHT, 0.6)
        const share = MJ.rareUpShare(t)
        const ratio = (tab, q) => tab[q] / Object.entries(tab).filter(([k]) => MJ.RARE_UP.includes(k)).reduce((a, [, w]) => a + w, 0)
        return Math.abs(share - 0.6) < 1e-9 && Math.abs(ratio(t, '稀有') - ratio(MJ.QUALITY_WEIGHT, '稀有')) < 1e-9
      })())
    // ④ 行为：分支占比 ≈40/25/35，返金固定；材料/食物池不出装备
    let gold = 0, cheap = 0, item = 0, goldSum = 0
    for (let i = 0; i < 4000; i++) {
      const r = pickItem('material', Math.random, 0, 0)
      if (r.gold) { gold++; goldSum += r.gold }
      else if (r.cheap) cheap++
      else item++
    }
    const pr = (n) => n / 4000
    check('觅珍', '行为：材料池 4000 抽里 返金≈40% / 低档≈25% / 物品≈35%（各 ±5%）',
      Math.abs(pr(gold) - 0.4) < 0.05 && Math.abs(pr(cheap) - 0.25) < 0.05 && Math.abs(pr(item) - 0.35) < 0.05,
      `返金 ${(pr(gold) * 100).toFixed(1)}% / 低档 ${(pr(cheap) * 100).toFixed(1)}% / 物品 ${(pr(item) * 100).toFixed(1)}%`)
    check('觅珍', '行为：返金金额恒为 12 金（固定 20% 池价，不是区间）', goldSum === gold * 12, `sum=${goldSum} n=${gold}`)
    check('觅珍', '行为：材料/食物池各 1000 抽不出任何装备（无装备分支）', (() => {
      for (const id of ['material', 'food']) {
        for (let i = 0; i < 1000; i++) {
          const r = pickItem(id, Math.random, 0, 0)
          if (r.item?.type === 'equipment') return false
        }
      }
      return true
    })())
    // ⑤ 状态机（真跑 drawMijian）：扣费即计数、神话优先、只清对应计数
    const st = freshPlayer()
    st.gold = 1e12
    st.mijian = { pity: null, stats: { pulls: 0, spent: 0, gearRare: 0 }, history: [], tickets: 0 }
    // ⚠️ 这里**不能**断言「两个计数都 == 1」：一次抽卡若**自然出货稀有+**，代码会把 rare 计数清零
    //    （既定口径：）⇒ 装备池 4% 的几率让这条断言失败（CI 实测偶发红过一次）。
    //    正确的口径是：**myth 必 +1**（只被神话保底清），**rare = 自然/保底出货 ? 0 : 1**。
    const g1st = st.drawMijian('gear', 1)
    const up1st = ['稀有', '史诗', '传说', '神话'].includes(g1st.results[0]?.quality)
    check('觅珍', '状态机：扣了金币就计数（神话必 +1；这一抽若本身就是稀有+ 则 rare 计数清零 —— 自然出货也清计数）',
      st.mijian.pity.gear.myth === 1 && st.mijian.pity.gear.rare === (up1st ? 0 : 1),
      `q=${g1st.results[0]?.quality} pity=${JSON.stringify(st.mijian.pity.gear)}`)
    st.mijian.pity.gear = { rare: 39, myth: 199 }
    const rMyth = st.drawMijian('gear', 1)
    check('觅珍', '状态机：神话保底优先于稀有保底（同时满足时出神话，且**只清 myth**）',
      rMyth.results[0]?.quality === '神话' && st.mijian.pity.gear.myth === 0 && st.mijian.pity.gear.rare !== 0,
      `q=${rMyth.results[0]?.quality} pity=${JSON.stringify(st.mijian.pity.gear)}`)
    st.mijian.pity.gear = { rare: 39, myth: 0 }
    const rRare = st.drawMijian('gear', 1)
    check('觅珍', '状态机：稀有保底出稀有+，且只清 rare',
      ['稀有', '史诗', '传说', '神话'].includes(rRare.results[0]?.quality) && st.mijian.pity.gear.rare === 0,
      `q=${rRare.results[0]?.quality} pity=${JSON.stringify(st.mijian.pity.gear)}`)
    // ⑥ 公示表 = 分支 × 品质权重（规格里那张「单次抽卡最终概率」表）
    const odds = MJ.allPoolOdds()
    const find = (id) => odds.find((o) => o.id === id)
    const pctOf = (id, q) => find(id).final.find((f) => f.raw === q)?.pct
    check('觅珍', `公示表：混池 普通装备 ${pctOf('mix', '普通')}% / 稀有 ${pctOf('mix', '稀有')}% / 神话 ${pctOf('mix', '神话')}%（= 10% × 品质权重，2026-09-25 混池调低）`,
      pctOf('mix', '普通') === 8.2 && pctOf('mix', '稀有') === 0.27 && pctOf('mix', '神话') === 0.005)
    check('觅珍', `公示表：限时池 普通装备 ${pctOf('limited', '普通')}% / 稀有 ${pctOf('limited', '稀有')}% / 神话 ${pctOf('limited', '神话')}%（= 80% × 品质权重）`,
      pctOf('limited', '普通') === 72 && pctOf('limited', '稀有') === 0.96 && pctOf('limited', '神话') === 0.008)
    check('觅珍', `公示表：厨具池 = 品质权重本身（${pctOf('gear', '普通')}% / ${pctOf('gear', '稀有')}%）`,
      pctOf('gear', '普通') === 82 && pctOf('gear', '稀有') === 2.7)
    check('觅珍', '公示表：材料/食物池没有装备行（无装备分支）',
      find('material').final.length === 0 && find('food').final.length === 0)
    check('觅珍', '公示表：各池 final 之和 == 装备分支占比（混池 10% / 厨具 100% / 限时 80%）',
      Math.abs(find('mix').final.reduce((a, f) => a + f.pct, 0) - 10) < 0.02 &&
      Math.abs(find('gear').final.reduce((a, f) => a + f.pct, 0) - 100) < 0.02 &&
      Math.abs(find('limited').final.reduce((a, f) => a + f.pct, 0) - 80) < 0.02,
      `mix=${find('mix').final.reduce((a, f) => a + f.pct, 0).toFixed(3)} gear=${find('gear').final.reduce((a, f) => a + f.pct, 0).toFixed(3)} lim=${find('limited').final.reduce((a, f) => a + f.pct, 0).toFixed(3)}`)
    check('觅珍', '公示面板：每池都带 desc（池卡描述从常量算出来），有装备分支的池才带保底/软保底明细',
      odds.every((o) => typeof o.desc === 'string' && o.desc.length > 8) &&
      ['mix', 'gear', 'limited'].every((id) => find(id).pity && find(id).soft) &&
      ['material', 'food'].every((id) => !find(id).pity))
    // 页面不许另写一份概率数字：MijianView 只能从 poolOdds 取
    const mv = fs.readFileSync(new URL('../../src/views/MijianView.vue', import.meta.url), 'utf8')
    check('觅珍', '公示面板接的是数据源（MijianView 用 allPoolOdds()，且没有手写旧保底/旧返金文案）',
      /allPoolOdds\(\)/.test(mv) && !/保底 10 抽|保底 5 抽|每 10 抽保底|55% 返还|22% 一档/.test(mv))
    // ⑦ 旧档迁移（三种历史形态都要能读）
    check('觅珍', '旧档迁移：数字 → gear.rare；{gear,limited} → 各组 rare；新形态原样',
      JSON.stringify(MJ.migratePity(7).gear) === JSON.stringify({ rare: 7, myth: 0 }) &&
      MJ.migratePity({ gear: 9, limited: 3 }).limited.rare === 3 &&
      MJ.migratePity({ mix: { rare: 5, myth: 2 } }).mix.myth === 2 &&
      JSON.stringify(MJ.migratePity(null)) === JSON.stringify(MJ.EMPTY_PITY()))
    check('觅珍', '池成员口径仍是 poolItems（图鉴三查用同一份）',
      ['material', 'food', 'gear', 'mix', 'limited'].every((id) => poolItems(id).length > 0))
  }
  // 图鉴三查：抽卡来源
  const { itemSources: src } = await import('../../src/game/data/itemSources.js')
  check('觅珍', '图鉴来源含觅珍（厨具池）', src('copperKnife').some((s) => s.includes('觅珍·厨具池')), JSON.stringify(src('copperKnife').slice(0, 3)))
  check('觅珍', '图鉴来源含觅珍（材料池）', src('apple').some((s) => s.includes('觅珍·材料池')))
}

// ── C9b. 运营调参层（2026-09-25 第四角色「运营调参员」）──
// 红线：默认零影响（覆盖为空时与基线逐字节等价）；覆盖只在会话内存（CI 本进程用完必须复位）；
// 难度类夹取上限 = 基线（「只能更难或复原」，保住 difficulty「永不抬高」叙事）。
{
  const T = await import('../../src/game/data/tuner.js')
  const D = await import('../../src/game/data/difficulty.js')
  const MC = await import('../../src/game/data/materialCost.js')
  const GR = await import('../../src/game/core/growthRate.js')
  T.tunerResetAll()
  try {
    // ① 默认零影响：覆盖为空时，所有读取点与基线等价
    check('调参', '默认零影响：掉落/材料/阻尼/低目标/精通全部等于基线',
      D.dropChance(0.1) === D.scaleChance(0.1, 0.2, 0.01) &&
      MC.materialQty(3) === Math.max(1, Math.round(3 * 2)) &&
      GR.dampXpStack(5) === 1 + (5 - 1) * 0.75 &&
      GR.targetLevelXpMult(30, 20, 40) === 0.5)
    // ② 覆盖生效：把对决掉落从 0.2 调到 0.1（更难）
    T.tunerSet('diffDrop', 0.1)
    check('调参', '覆盖生效：diffDrop=0.1 时 dropChance 随之减半',
      Math.abs(D.dropChance(0.5) - 0.05) < 1e-9, `dropChance(0.5)=${D.dropChance(0.5)}`)
    // ③ 夹取：难度类不能比基线简单（上限 = 基线）
    T.tunerSet('diffDrop', 0.5)
    check('调参', '夹取：diffDrop=0.5（> 基线 0.2）被夹回基线，掉落不会比原数据更简单',
      Math.abs(D.dropChance(0.5) - 0.1) < 1e-9, `dropChance(0.5)=${D.dropChance(0.5)}`)
    // ④ 材料成本覆盖
    T.tunerSet('materialCost', 4)
    check('调参', '覆盖生效：materialCost=4 时单件用量 ×4', MC.materialQty(3) === 12, `qty=${MC.materialQty(3)}`)
    // ⑤ 阻尼覆盖：0 = 关掉叠区阻尼
    T.tunerSet('xpDamping', 0)
    check('调参', '覆盖生效：xpDamping=0 时叠区无阻尼（damp(5)=1）', GR.dampXpStack(5) === 1, `damp=${GR.dampXpStack(5)}`)
    // ⑥ 复位：resetAll 后回到基线
    T.tunerResetAll()
    check('调参', '复位：resetAll 后全部回基线',
      D.dropChance(0.5) === 0.1 && MC.materialQty(3) === 6 && GR.dampXpStack(5) === 4)
    // ⑦ 低目标衰减覆盖
    T.tunerSet('lowTargetMult', 1)
    check('调参', '覆盖生效：lowTargetMult=1 = 关掉低目标衰减', GR.targetLevelXpMult(30, 20, 40) === 1)
  } finally {
    T.tunerResetAll() // 🔴 必须复位：后续区块与其它守卫都跑在「无覆盖」基线上
  }
  check('调参', '复位确认：finally 后覆盖为空', T.tunerActiveKeys().length === 0)
  // ── 扩充旋钮（战斗节奏 / 全局经验 / 离线上限）──
  {
    const ES = await import('../../src/game/data/enemyScaling.js')
    const CAPS = await import('../../src/game/data/caps.js')
    T.tunerResetAll()
    try {
      // 敌人血量倍率：L30 基础 100 → 分档 ×1.8 = 180；override 0.5 → 90
      T.tunerSet('enemyHp', 0.5)
      check('调参', 'enemyHp=0.5：L30 敌人 100 血 → 分档 ×1.8 再 ×0.5 = 90',
        ES.scaledEnemy({ level: 30, hp: 100 }).hp === 90, `hp=${ES.scaledEnemy({ level: 30, hp: 100 }).hp}`)
      T.tunerResetKey('enemyHp')
      check('调参', 'enemyHp 复原：回到分档值 180', ES.scaledEnemy({ level: 30, hp: 100 }).hp === 180)
      // 攻速衰减：0.008 → L40 间隔 2.4−0.32=2.08；到顶等级 ceil(1.2/0.008)=150
      T.tunerSet('atkSpeedDecay', 0.008)
      check('调参', 'atkSpeedDecay=0.008：L40 间隔 2.08、到顶等级 150',
        Math.abs(CAPS.combatTurnIntervalSec(40) - 2.08) < 1e-9 && CAPS.combatSpeedCapLevel() === 150,
        `iv=${CAPS.combatTurnIntervalSec(40)} cap=${CAPS.combatSpeedCapLevel()}`)
      T.tunerResetKey('atkSpeedDecay')
      // 离线上限：override 直接给定小时数
      const pf = freshPlayer()
      T.tunerSet('offlineHours', 48)
      check('调参', 'offlineHours=48：离线上限覆盖为 48h（基线不含加成 ' + CAPS.OFFLINE_CAP.baseHours + 'h）',
        pf.offlineMaxHours() === 48, `h=${pf.offlineMaxHours()}`)
      T.tunerResetAll()
      // 全局经验倍率：cooking 实例 addXp ×3
      const inst2 = getSkillInstance('cooking')
      const lv = inst2.level
      const e0 = inst2.exp
      inst2.addXp(500)
      const d0 = inst2.exp - e0
      T.tunerSet('globalXp', 3)
      const e1 = inst2.exp
      inst2.addXp(500)
      const d1 = inst2.exp - e1
      T.tunerResetAll()
      check('调参', 'globalXp=3：addXp 实得经验 ×3（未升级前线性段）',
        Math.abs(d1 - d0 * 3) < 0.5 && d0 === 500, `d0=${d0} d1=${d1} lv=${lv}`)
    } finally {
      T.tunerResetAll()
    }
  }
  // ── 扩展旋钮 2（2026-09-25 第二批：抽卡经济 / 转生加成 / 卡片经验 / 低目标判定 / 攻速地板）──
  {
    const MJ = await import('../../src/game/data/mijianDraws.js')
    const GR2 = await import('../../src/game/core/growthRate.js')
    const CAPS2 = await import('../../src/game/data/caps.js')
    T.tunerResetAll()
    try {
      // 低目标判定差：Lv30 做 Lv26 —— 默认差 5 ⇒ 不算低目标；调到 2 ⇒ 算
      check('调参', 'lowTargetGap：默认 5 级时 Lv26 不算低目标，覆盖为 2 后算',
        GR2.isLowTarget(30, 26, 40) === false && (T.tunerSet('lowTargetGap', 2), GR2.isLowTarget(30, 26, 40) === true))
      T.tunerResetKey('lowTargetGap')
      // 攻速地板：L100 原始 0.8s —— 默认地板 1.2 抬回 1.2；地板 0.5 时放行到 0.8
      check('调参', 'speedFloor：L100 默认被 1.2s 地板钉住，地板改 0.5 后放行到 0.8s',
        Math.abs(CAPS2.combatTurnIntervalSec(100) - 1.2) < 1e-9 && (T.tunerSet('speedFloor', 0.5), Math.abs(CAPS2.combatTurnIntervalSec(100) - 0.8) < 1e-9))
      T.tunerResetKey('speedFloor')
      // 返金比例：混池 80 价 × 20% = 16；改 10% ⇒ 8
      check('调参', 'refundPct：混池返金 16 → 10% 时 8 金（整数落地）',
        MJ.refundOf(80) === 16 && (T.tunerSet('refundPct', 0.1), MJ.refundOf(80) === 8))
      T.tunerResetKey('refundPct')
      // 混池正常分支：派生返金档，三者恒为 1
      T.tunerSet('mixNormal', 0.3)
      const mb = MJ.branchOf('mix')
      check('调参', 'mixNormal=0.3：返金档派生为 0.45（1 − 0.25 低档 − 0.3 正常，三者相加 = 1）',
        Math.abs(mb.normal - 0.3) < 1e-9 && Math.abs(mb.gold - 0.45) < 1e-9 && Math.abs(mb.gold + mb.cheap + mb.normal - 1) < 1e-9)
      T.tunerResetKey('mixNormal')
      check('调参', 'mixNormal 复位：回到基线 65/25/10', MJ.branchOf('mix').normal === 0.1 && MJ.branchOf('mix').gold === 0.65)
      // 保底抽数：厨具 40 → 10；混池 50 → 20（且夹在神话保底之前）
      check('调参', 'gearPity/mixPity：厨具 40→10、混池 50→20（夹取上限 = 神话保底 − 1）',
        MJ.pityRuleOf('gear').rare === 40 && MJ.pityRuleOf('mix').rare === 50 &&
        (T.tunerSet('gearPity', 10), T.tunerSet('mixPity', 20), MJ.pityRuleOf('gear').rare === 10 && MJ.pityRuleOf('mix').rare === 20))
      T.tunerSet('gearPity', 9999)
      check('调参', '保底抽数夹取：9999 被夹到神话保底 − 1（200−1=199，稀有保底不会永不触发）', MJ.pityRuleOf('gear').rare === 199, `rare=${MJ.pityRuleOf('gear').rare}`)
      T.tunerResetAll()
      // 软保底上限：混池第 49 抽的概率应随 SOFT_MAX_P 下降
      const soft49a = MJ.softRareP('mix', 49)
      T.tunerSet('softMaxP', 0.3)
      const soft49b = MJ.softRareP('mix', 49)
      check('调参', 'softMaxP：第 49 抽软保底概率随上限下降（0.9 → 0.3 时变小）', soft49b < soft49a, `${soft49a?.toFixed(3)} → ${soft49b?.toFixed(3)}`)
      T.tunerResetAll()
      // 限时池装备率：公示与结算同源
      const limA = MJ.allPoolOdds().find((o) => o.id === 'limited').gearPct
      T.tunerSet('limitedGearPct', 0.5)
      const limB = MJ.allPoolOdds().find((o) => o.id === 'limited').gearPct
      check('调参', 'limitedGearPct：限时池装备率公示值 80 → 50（与结算同一出口）', limA === 80 && limB === 50, `${limA} → ${limB}`)
      T.tunerResetAll()
      // 卡片经验整体缩放：addCardXp 实得经验按倍率变化
      const ck2 = getSkillInstance('cooking')
      const e2a = ck2.exp
      ck2.addCardXp(100, 1, 1)
      const d2a = ck2.exp - e2a
      T.tunerSet('cardXpScale', 2)
      const e2b = ck2.exp
      ck2.addCardXp(100, 1, 1)
      const d2b = ck2.exp - e2b
      check('调参', 'cardXpScale：卡片经验 ×2 后同额经验实得翻倍', Math.abs(d2b - d2a * 2) < 0.5 && d2a > 0, `${d2a} → ${d2b}`)
      T.tunerResetAll()
      // 转生加成：每层 +20% → +50% 时同额经验按阻尼乘积比值放大
      const ck3 = getSkillInstance('cooking')
      ck3.player.skills[ck3.id].prestiges = 1
      const e3a = ck3.exp
      ck3.addXp(1000)
      const d3a = ck3.exp - e3a
      T.tunerSet('prestigeXpBonus', 0.5)
      const e3b = ck3.exp
      ck3.addXp(1000)
      const d3b = ck3.exp - e3b
      const want = (1 + 0.5 * 0.75) / (1 + 0.2 * 0.75) // dampXpStack(1.5)/dampXpStack(1.2)
      check('调参', 'prestigeXpBonus：每层 +20%→+50% 后同额经验放大（经阻尼乘积，比值 = damp(1.5)/damp(1.2)）',
        Math.abs(d3b / d3a - want) < 0.02, `比值 ${(d3b / d3a).toFixed(3)} vs 期望 ${want.toFixed(3)}`)
      ck3.player.skills[ck3.id].prestiges = 0
    } finally {
      T.tunerResetAll()
    }
  }
  // ── 旋钮 ↔ 读取点一致性（2026-09-25 立）────────────────────────────────────────────
  // 🔴 起因：首版有**两个滑杆在游戏内空转** —— 面板 ROWS 写 `diffExploreLoot` / `diffGatherExtra`，
  //    读取点写 `diffExploreloot` / `diffGatherextra`（只差首字母大小写）。`tunerOver` 是**按名字查表**，
  //    查不到名字就静默返回基线 ⇒ 拖滑杆只有面板自己变、引擎一点没动，而「零副作用校验」与上面全部 C9b
  //    断言照样全绿（**又是「显示与结算不一致」，这次发生在调参工具自己身上**）。
  //    两条静态断言把「面板 → 读取点」两个方向钉死，再加一条行为断言确认那两个旋钮真的接到了引擎。
  {
    const fs2 = await import('node:fs')
    const panel = fs2.readFileSync(new URL('../../src/components/TunerPanel.vue', import.meta.url), 'utf8')
    const rowsBlock = panel.slice(panel.indexOf('const ROWS = ['), panel.indexOf('const GROUPS = ['))
    const rowKeys = [...rowsBlock.matchAll(/key: '([A-Za-z]+)'/g)].map((m) => m[1])
    const readKeys = new Set()
    const { stripComments } = await import('./lib/comments.mjs')
    const walk = (dir) => {
      for (const e of fs2.readdirSync(dir, { withFileTypes: true })) {
        const p = dir + '/' + e.name
        if (e.isDirectory()) { walk(p); continue }
        // 🔴 排除面板自身：它在「影响链 / 零副作用校验」里也调 tunerOver 给自己的预览取数
        //    （见 `tunerOver('globalXp', 1, 0, 20)`）—— 算进来正好会让「面板自己变、引擎没动」假绿。
        if (p === 'src/components/TunerPanel.vue') continue
        if (!/\.(js|vue|mjs)$/.test(e.name)) continue
        // 剥注释：`tuner.js` 的用法注释里就写着 `tunerOver('key', …)`，不剥会扫出一个不存在的「隐藏旋钮 key」
        const code = stripComments(fs2.readFileSync(p, 'utf8'))
        // 第一个实参可能是字面量、也可能是三元（`mijianDraws.js`：`poolId === 'mix' ? 'mixPity' : 'gearPity'`）
        // ⇒ 取「第一个逗号前」的实参文本，抽出其中**所有**引号标识符；先把 `=== 'xxx'` 这种比较字面量剔掉，
        //   否则 `'mix'`（池名）会被当成一个旋钮名扫进来（首版就是这么多出一条「未暴露：mix」的假失败）。
        for (const call of code.matchAll(/tunerOver\(([^,;)]*)/g)) {
          const arg = call[1].replace(/[=!]==?\s*'[A-Za-z]+'/g, '')
          for (const k of arg.matchAll(/'([A-Za-z]+)'/g)) readKeys.add(k[1])
        }
      }
    }
    walk('src')
    const dead = rowKeys.filter((k) => !readKeys.has(k))
    check('调参', `旋钮接线：面板 ${rowKeys.length} 个 key 都有读取点（没有空转滑杆）`, dead.length === 0, `空转：${dead.join('/') || '—'}`)
    const hidden = [...readKeys].filter((k) => !rowKeys.includes(k))
    check('调参', `旋钮接线：${readKeys.size} 个读取点都由面板暴露（没有只能改代码的隐藏旋钮）`, hidden.length === 0, `未暴露：${hidden.join('/') || '—'}`)
    // 行为断言：那两个**曾经空转**的旋钮现在真的改到引擎（两条都落在「减半」桶上）
    T.tunerResetAll()
    const lootBase = D.exploreLootChance(0.4)
    const extraBase = D.gatherExtraChance(0.4)
    T.tunerSet('diffExploreLoot', 0.01)
    T.tunerSet('diffGatherExtra', 0.005)
    const lootTuned = D.exploreLootChance(0.4)
    const extraTuned = D.gatherExtraChance(0.4)
    T.tunerResetAll()
    check('调参', '行为：diffExploreLoot / diffGatherExtra 真的改到引擎（曾因大小写不匹配而空转）',
      lootTuned < lootBase && extraTuned < extraBase && D.exploreLootChance(0.4) === lootBase && D.gatherExtraChance(0.4) === extraBase,
      `探索战利品 ${lootBase}→${lootTuned} · 采集附产 ${extraBase}→${extraTuned}`)
  }
}

// ── C10. 一键入包（2026-09-06）──
console.log('══ C10. 一键入包 ══')
{
  const p = freshPlayer({})
  p.gainItem('apple', 5)
  p.gainItem('ironKnife', 1)
  const moved = p.moveAllToBank()
  check('存取', '一键入仓/入包已退化为 no-op（存储合一后无意义）',
    p.moveAllToBank() === 0 && p.moveAllToInventory() === 0 && (p.inventory.apple ?? 0) === 5)
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
    for (const [mid, n] of Object.entries(effIngredients(first))) pm.gainItem(mid, n)
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
  for (let i = 0; i < STORAGE_BASE; i++) p.gainItem(ids[i], 1)
  const before = p.mail.list.length
  const ok = p.gainItem(ids[STORAGE_BASE], 1)
  check('信箱', '厨藏满时 gainItem 仍返回 false', ok === false && p.inventorySlotsUsed === STORAGE_BASE)
  check('信箱', '背包满时物品被转存邮箱（不再丢失）', p.mail.list.length === before + 1 && p.mail.list.at(-1).kind === 'overflow')
  const om = p.mail.list.at(-1)
  check('信箱', '溢出邮件带正确附件', om.reward?.items?.[ids[STORAGE_BASE]] === 1 && om.claimed === false)
  check('信箱', '溢出邮件计入待领红点', p.mailUnclaimedCount() === 1)

  // ③ 连续同一物品的溢出 → 合并成一封（不刷屏）
  p.gainItem(ids[STORAGE_BASE], 4)
  check('信箱', '同物品溢出合并累加', p.mail.list.length === before + 1 && p.mail.list.at(-1).reward.items[ids[STORAGE_BASE]] === 5)

  // ④ 领取：背包腾出空间后成功入包
  delete p.inventory[ids[0]]
  const c1 = p.claimMail(om.id)
  check('信箱', '领取后物品入包', c1.ok === true && p.inventory[ids[STORAGE_BASE]] === 5)
  check('信箱', '领取后标记已领且计入统计', om.claimed === true && p.mailUnclaimedCount() === 0)
  // 内容同步（2026-09-11）：新增成就必须真的会被这套行为点亮
  check('信箱', '领取计数递增（信箱成就依据）', p.stats.mailClaimed === 1)
  check('信箱', '「信箱初启」成就随之达成', ACH_MAIL_FIRST.check(p) === true)
  check('信箱', '重复领取被拒', p.claimMail(om.id).ok === false)

  // ⑤ 领取时背包满 → 拒绝且邮件保持未领（不能领出来又转投成新邮件）
  const p5 = freshPlayer()
  for (let i = 0; i < STORAGE_BASE; i++) p5.gainItem(ids[i], 1)
  p5.gainItem(ids[STORAGE_BASE], 3)
  const m5 = p5.mail.list.at(-1)
  check('信箱', '背包满时领取被拒', p5.claimMail(m5.id).ok === false, p5.claimMail(m5.id).msg)
  check('信箱', '被拒后邮件仍未领', m5.claimed === false && p5.mailUnclaimedCount() === 1)
  check('信箱', '被拒不会复制出第二封邮件', p5.mail.list.filter((m) => m.kind === 'overflow').length === 1)
  check('信箱', 'canGainItem 与实发一致', p5.canGainItem(ids[STORAGE_BASE], 3) === false && p5.canGainItem(ids[0], 1) === true)

  // ⑥ 堆积上限截断的部分同样转存（2026-09-22：上限抬到 100 亿 ⇒ 用「差 3 件到顶」构造截断）
  const p6 = freshPlayer()
  const { STACK_MAX } = await import('../../src/game/data/stackRules.js')
  p6.inventory[ids[0]] = STACK_MAX - 3
  p6.gainItem(ids[0], 5)
  check('信箱', '堆叠上限截断的部分转存邮箱', p6.inventory[ids[0]] === STACK_MAX && p6.mail.list.at(-1)?.reward?.items?.[ids[0]] === 2,
    `qty=${p6.inventory[ids[0]]} mail=${p6.mail.list.at(-1)?.reward?.items?.[ids[0]]}`)

  // ⑦ 上限为 1 的物品（**有词条的装备**）重复获得不再蒸发
  //    2026-09-22 语义变化：无词条装备现在可堆叠 ⇒ 只有「已洗练出词条」的装备才是上限 1 的那一类。
  const p7 = freshPlayer()
  p7.gearMods = { ironKnife: { mods: [{ stat: 'attack', value: 2 }], at: Date.now() } }
  p7.gainItem('ironKnife', 1)
  p7.gainItem('ironKnife', 1)
  check('信箱', '上限 1 的物品（有词条装备）重复获得转存邮箱（改前静默丢失）',
    p7.inventory.ironKnife === 1 && p7.mail.list.at(-1)?.reward?.items?.ironKnife === 1,
    `qty=${p7.inventory.ironKnife} mail=${p7.mail.list.at(-1)?.reward?.items?.ironKnife}`)
  // ⑦b 无词条装备则直接堆起来（不再进信箱）
  const p7b = freshPlayer()
  const mailBefore = (p7b.mail?.list ?? []).length // 新档自带欢迎信，所以比「封数不变」而不是「为 0」
  p7b.gainItem('ironKnife', 1)
  p7b.gainItem('ironKnife', 1)
  check('信箱', '无词条装备可堆叠 ⇒ 不进信箱（封数不变）',
    p7b.inventory.ironKnife === 2 && (p7b.mail?.list ?? []).length === mailBefore,
    `qty=${p7b.inventory.ironKnife} mail=${(p7b.mail?.list ?? []).length}(before=${mailBefore})`)

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
  for (let i = 0; i < STORAGE_BASE; i++) p9.gainItem(ids[i], 1)
  p9.gainItem(ids[STORAGE_BASE], 1)
  const m9 = p9.mail.list.at(-1)
  check('信箱', '有未领附件的邮件不可删', p9.deleteMail(m9.id) === false && p9.mail.list.includes(m9))
  delete p9.inventory[ids[0]]
  p9.claimMail(m9.id)
  check('信箱', '已领附件后可删', p9.deleteMail(m9.id) === true && !p9.mail.list.includes(m9))
  check('信箱', '欢迎信（无附件）可删', p9.deleteMail(p9.mail.list[0].id) === true)

  // ⑩ 容量语义（2026-09-11 放宽）：软上限只淘汰「已领/无附件」，全未领也照收，硬上限才拒收
  const p10 = freshPlayer()
  for (let i = 0; i < STORAGE_BASE; i++) p10.gainItem(ids[i], 1) // 背包塞满
  let refused = 0
  // 造 > 软上限数量的**不同物品**溢出（同物品会合并成一封，所以种类数必须够多才能越过软上限）
  for (let i = STORAGE_BASE; i < STORAGE_BASE + MAIL_CAP + 60; i++) {
    const before = p10.mail.list.length
    p10.gainItem(ids[i], 1) // 溢出 → 造远超软上限的未领附件邮件
    if (p10.mail.list.length === before) refused++
  }
  // 注意：不能用「列表长度没变」判拒收——**淘汰**（清理已领/无附件旧邮件）也不会让长度增长。
  // 软上限命中时最先被清掉的正是那封「无附件」的欢迎信，所以这里改为断言真正要锁住的性质：**溢出零丢失**。
  const mailIds = new Set()
  for (const m of p10.mail.list) for (const k of Object.keys(m.reward?.items ?? {})) mailIds.add(k)
  const lost = []
  for (let i = STORAGE_BASE; i < STORAGE_BASE + MAIL_CAP + 60; i++) {
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
  for (let i = 0; i < STORAGE_BASE; i++) p11.gainItem(ids[i], 1)
  p11.gainItem(ids[STORAGE_BASE], 2)
  p11.gainItem(ids[STORAGE_BASE + 1], 3)
  for (let i = 0; i < 5; i++) delete p11.inventory[ids[i]] // 腾 5 格
  const all = p11.claimAllMail()
  check('信箱', '一键领取汇总入包', all.ok === true && all.count === 2 && p11.inventory[ids[STORAGE_BASE]] === 2 && p11.inventory[ids[STORAGE_BASE + 1]] === 3)
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
  // ⚠️ 大后期环**不得要求「当前等级」**：转生会把等级重置为 1+传承（≤20）→ 要求等级就永远点不亮。
  //    （2026-09-29 起第 8~10 环的门槛是「精通总级数」，同样与当前等级无关。）
  check('山海食经', '第 8~10 环不要求当前等级（转生会重置等级；它们靠精通总级数卡）',
    N.every((n) => (n.ring ?? 0) < 8 || (n.req?.level ?? 0) === 0))
  // ⚠️ 第 8~10 环的门槛轴 **2026-09-29 从「转生次数」改成「精通总级数比例」**（60% → 80% → 100%）：
//    转生/等级是**经验轴**（实测满 buff 压 59×），精通是**动作轴**（只压 1.11×）——
//    长线挂动作轴才不会被高配玩家一小时刷完。判据仍要求**严格递增**（这条断言的本意不变）。
  check('山海食经', '大后期里程碑严格递增：满 100 级 → 精通 60% → 80% → 100%', (() => {
    const gate = (r) => { const n = N.find((x) => x.path === 'pick' && x.ring === r); return { level: n.req.level ?? 0, masteryPct: n.req.masteryPct ?? 0 } }
    const r7 = gate(7), r8 = gate(8), r9 = gate(9), r10 = gate(10)
    return r7.level === 100 && r7.masteryPct === 0 && r8.masteryPct === 0.6 && r9.masteryPct === 0.8 && r10.masteryPct === 1
      && r8.masteryPct < r9.masteryPct && r9.masteryPct < r10.masteryPct
  })())
  check('山海食经', '前 6 环收集门槛严格递增；第 6~10 环持平（里程碑环靠等级/精通卡）', SHANHAI_PATHS.every((p) => {
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
    // 存储合一（2026-09-20）：原「仓库」这一档容量奖励现在也落在同一个厨藏容量上
    p.inventoryCap = STORAGE_MAX // 真买满（硬顶）
    const cap0 = p.inventoryCap
    const r = p.shanhaiUnlock('pick11')
    // 断言**行为**（容量不变 + 顺位落到厨藏那一档 + 回执给文案），不写死文案
    return r.ok && p.inventoryCap === cap0 && typeof r.landed === 'string' && !r.landed.includes('背包')
  })())
  check('山海食经', '商店买满后背包节点**仍落在背包**（不再错位进仓库；用户实测报过）', (() => {
    const p = freshPlayer()
    const node = N.find((n) => n.id === 'pick11') // 背包 +1
    for (const id of (shanhaiIndex().pick ?? []).slice(0, node.req.count)) p.collected[id] = true
    p.inventoryCap = STORAGE_PAID_MAX // 金币路径已买满（2500）
    const r = p.shanhaiUnlock('pick11')
    return r.ok && p.inventoryCap === STORAGE_PAID_MAX + 1 && r.landed.includes('厨藏')
  })(), `硬顶 ${STORAGE_MAX} / 商店上限 ${STORAGE_PAID_MAX}`)
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
  check('山海食经', '对账幂等：重复读档不重复补发（存储合一后顺位都落在同一厨藏容量）', (() => {
    const p = freshPlayer()
    const idx = shanhaiIndex()
    for (const id of (idx.pick ?? []).slice(0, 60)) p.collected[id] = true
    const saved = JSON.parse(JSON.stringify(p.serialize()))
    saved.shanhaiUnlocked = ['pick11', 'pick12', 'pick13']
    // 存储合一（2026-09-20）：满上限后三个 +1 顺位落进**同一个厨藏容量**（不再有「转投仓库」）
    saved.inventoryCap = STORAGE_MAX + 300 // 故意超硬顶：容量本身也会被 safeCap 夹回
    saved.stats.shanhaiCapGranted = { inventory: 0, bank: 0, cold: 0 }
    p.applySave(saved)
    const capAfterFirst = p.inventoryCap
    p.applySave(JSON.parse(JSON.stringify(p.serialize()))) // 再读一次
    return p.inventoryCap === capAfterFirst && p.inventoryCap === STORAGE_MAX
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
  check('上限', '合并后硬顶 ≥ 商店厨藏上限 + 山海食经全树容量（抬金币上限必须同步抬硬顶）', (() => {
    let tree = 0
    for (const n of SHANHAI_NODES) {
      if (n.effect?.field === 'inventoryCap' || n.effect?.field === 'bankCap') tree += n.effect.amount
    }
    return STORAGE_MAX >= STORAGE_PAID_MAX + tree && STORAGE_PAID_MAX > 600
  })(), `厨藏硬顶 ${STORAGE_MAX} / 商店上限 ${STORAGE_PAID_MAX}`)
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
    p.inventoryCap = STORAGE_MAX
    p.bankCap = 0
    p.coldStorageCap = CAP_MAX.cold
    const r = p.expandColdStorage()
    return p.expandInventory(10) === false && p.expandBank(20) === false && r.ok === false
      && p.inventoryCap === STORAGE_MAX && p.bankCap === 0 && p.coldStorageCap === CAP_MAX.cold
  })())
  check('上限', '读档非法值不会把上限变成 NaN（字符串 / 超限 / 负数）', (() => {
    const p = freshPlayer()
    const saved = JSON.parse(JSON.stringify(p.serialize()))
    saved.inventoryCap = 'abc'
    saved.storageMerged = false // 走旧档迁移路径：bankCap 会被并入厨藏容量
    saved.coldStorageCap = -3
    saved.offlineBonusH = 'x'
    p.applySave(saved)
    return Number.isFinite(p.inventoryCap) && p.inventoryCap === STORAGE_BASE
      && p.bankCap === 0 && p.coldStorageCap === 0 && p.offlineBonusH === 0
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
  check('上限', `离线上限走唯一出口：基础(12~20，按最高技能等级) + 饼干(≤${OFFLINE_CAP.biscuitMaxHours}) + 厨神之路(≤${OFFLINE_CAP.daoMaxHours}) + 山海食经(≤${OFFLINE_CAP.shanhaiMaxHours})`, (() => {
    const p = freshPlayer()
    p.offlineBonusH = 99 // 越界 → 段内夹到饼干上限
    // 山海段：把**全树所有 offlineH 节点**都点亮（12 线时共 8 个，7 条采集线第 6 环 + 采撷终点）
    p.shanhaiUnlocked = SHANHAI_NODES.filter((n) => n.effect?.field === 'offlineH').map((n) => n.id)
    const shanhai = Math.min(OFFLINE_CAP.shanhaiMaxHours, p.shanhaiEffects().offlineH)
    const dao = Math.min(OFFLINE_CAP.daoMaxHours, Number(p.daoEffects?.().offlineHours) || 0)
    const wan = p.offlineMaxHours()
    const wan2 = p.offlineMaxHours()
    // 段内必须**刚好用满**（多了会被夹掉＝发了读不到的奖励，少了＝浪费设计位）
    // ⚠️ 基础那段读**派生值**（2026-09-29 起按最高技能等级分档），不写 OFFLINE_CAP.baseHours——
    //    否则本断言在满级玩家口径下会变成「自比自」的假绿。
    return shanhai === OFFLINE_CAP.shanhaiMaxHours && dao === 0 && wan === p.offlineBaseHours() + OFFLINE_CAP.biscuitMaxHours + shanhai && wan2 === wan
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
    p.inventoryCap = STORAGE_PAID_MAX - 5
    const inv = p.expandInventory(10) // 595 → 600（不是 605）
    const bank = p.expandBank(20)     // 同一池：600 已满 → false，不越界
    const again = p.expandInventory(10) && p.expandBank(20)
    return inv === true && bank === false && again === false && p.inventoryCap === STORAGE_PAID_MAX
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

// ── C23b. 经验倍率档位封顶（2026-09-21）──────────────────────────────
// 起因：这一项原先是 1/10/…/**1000×** 的玩家可随时切换的下拉，实测（scripts/sim/xp_multiplier_breakdown.mjs）
// 它是**单层贡献最大的一项**（×10 档单独就 ×11），与增益剂/转生相乘后总乘区达 ×312，
// 于是「采摘 1→99 = 44.2h」这种标定过的时长会被一个下拉框一键抹平。
// 现收成有界加速档；本组钉住「档位唯一来源 + 读档夹取 + 旧档不会带着 ×1000 继续跑」。
console.log('══ C23b. 经验倍率档位封顶 ══')
{
  const pXM = freshPlayer() // 默认档必须是 ×1
  check('倍率档位', `档位由 caps.js 单一来源导出且最高 ≤ 5（当前 ${JSON.stringify(XP_MULTIPLIER_OPTIONS)}）`,
    Array.isArray(XP_MULTIPLIER_OPTIONS) && XP_MULTIPLIER_OPTIONS[0] === 1
      && XP_MULTIPLIER_OPTIONS.every((v, i) => i === 0 || v > XP_MULTIPLIER_OPTIONS[i - 1])
      && Math.max(...XP_MULTIPLIER_OPTIONS) <= 5)
  check('倍率档位', '默认档是 ×1（新档/缺字段都不能默默加速）',
    pXM.settings.xpMultiplier === 1 && safeXpMultiplier(undefined) === 1 && safeXpMultiplier(null) === 1 && safeXpMultiplier(NaN) === 1)
  check('倍率档位', '读档夹取：旧档的 10/50/100/250/500/1000 一律夹到最高合法档（不会带着 ×1000 继续跑）',
    [10, 50, 100, 250, 500, 1000, 99999].every((v) => safeXpMultiplier(v) === Math.max(...XP_MULTIPLIER_OPTIONS)))
  check('倍率档位', '读档夹取：非法档夹到「不超过它的最大合法档」，负数/字符串回退 1',
    safeXpMultiplier(4) === 3 && safeXpMultiplier(2.5) === 2 && safeXpMultiplier(0) === 1
      && safeXpMultiplier(-5) === 1 && safeXpMultiplier('abc') === 1 && safeXpMultiplier('3') === 3)
  check('倍率档位', '设置面板的下拉**不手写档位**（引用 XP_MULTIPLIER_OPTIONS，否则改档位会漏改面板）', (() => {
    const panel = fs.readFileSync(new URL('../../src/components/SettingsPanel.vue', import.meta.url), 'utf8')
    return /XP_MULTIPLIER_OPTIONS/.test(panel) && /v-for="m in XP_MULTIPLIER_OPTIONS"/.test(panel)
      && !/<option :value="1000"/.test(panel)
  })())
  check('倍率档位', 'applySave 真的调用了夹取（否则旧档的 ×1000 会原样进来）',
    /safeXpMultiplier\(/.test(fs.readFileSync(new URL('../../src/stores/player.js', import.meta.url), 'utf8')))
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
      + fs.readFileSync(new URL('../../src/game/data/featureGroups.js', import.meta.url), 'utf8') // 磁贴清单在这
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
  //    ⚠️ 这几个数是**故意硬编码**的「绊线」：改精通曲线/强度时会立刻 FAIL，逼你确认是有意为之。
  //       别改成「从函数派生」——那会变成恒真断言，等于不设防。
  //       2026-09-21 更新：经验列引入 MASTERY_XP_BONUS_SCALE(0.5) 后，5 级 ×1.1→×1.05、100 级 ×4→×2.5。
  check('精通档位', '边界：5 级 ×1.05 / 50 级 双倍 30% 保底 +1 / 100 级 ×2.5 双倍 80% 保底 +2', (() => {
    const t5 = MASTERY_TIERS.find((t) => t.level === 5)
    const t50 = MASTERY_TIERS.find((t) => t.level === 50)
    const t100 = MASTERY_TIERS.find((t) => t.level === 100)
    return t5.xpMult === 1.05 && t50.double === 0.3 && t50.batch === 1 && t100.xpMult === 2.5 && t100.double === 0.8 && t100.batch === 2
  })())
  // 3b) 精通经验收益的**缩放机制**（2026-09-21 立）：钉住系数、来源关系与两条不变量
  check('精通档位', `经验收益缩放：MASTERY_XP_BONUS_SCALE === ${MASTERY_XP_BONUS_SCALE}（改它=改整体成长速度，必须有意为之）`,
    Math.abs(MASTERY_XP_BONUS_SCALE - 0.5) < 1e-9)
  check('精通档位', '缩放关系：实际 = 1 + (原始 − 1) × 系数（逐格核对）', (() => {
    const bad = []
    for (const lv of [0, 4, 5, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
      const expect = 1 + (masteryXpMultiplierRaw(lv) - 1) * MASTERY_XP_BONUS_SCALE
      if (Math.abs(masteryXpMultiplier(lv) - expect) > 1e-9) bad.push(`Lv${lv}`)
    }
    return bad.length === 0
  })())
  check('精通档位', '缩放不破坏两条不变量：精通 0 仍是 ×1（不会「越精通越差」）+ 整条曲线仍单调不减', (() => {
    if (masteryXpMultiplier(0) !== 1) return false
    let prev = 0
    for (let lv = 0; lv <= 100; lv++) {
      const v = masteryXpMultiplier(lv)
      if (v < prev - 1e-9 || v < 1 - 1e-9) return false
      prev = v
    }
    return true
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
    return p60.level === 60 && masteryYieldBonus(p60.level) === 1 && masteryDoubleChance(p60.level) === 0.4 && masteryXpMultiplier(p60.level) === 1.75
  })())
  void pc
}


// ── C28. 伐木 / 采矿与「20 档木材」（v2.7.0：矿物从挖掘拆出 + 木材按档贯通锻造与强化）──
console.log('== C28. 伐木 / 采矿 / 20 档木材 ==')
{
  const M = getSkillInstance('mining')
  const W = getSkillInstance('woodcutting')
  const E = getSkillInstance('excavation')
  check('伐木采矿', `目标数：伐木 ${W.targets.length} / 采矿 ${M.targets.length} / 挖掘 ${E.targets.length}（2026-09-29 补档各 +2）`, W.targets.length === 22 && M.targets.length === 45 && E.targets.length === 51, `${W.targets.length}/${M.targets.length}/${E.targets.length}`)
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
  // 2026-09-29 补档：目标表 = 20 档木材（逐一对应档位）+ 末尾追加的 2 档新木（玄铁杉 102 / 天罡沉香 112，
  //    不在档位表里 —— 档位体系与装备套一一对应、冻结到 Lv100，见 lateGameFood.js / timbers.js）
  check('伐木采矿', '伐木目标 = 20 档木材逐一对应档位 + 末尾 2 条补档新木（102/112）',
    W.targets.length === TIMBERS.length + 2 &&
      W.targets.slice(0, TIMBERS.length).every((t, i) => t.itemId === TIMBERS[i].id && t.reqLevel === TIMBERS[i].level) &&
      W.targets.slice(-2).map((t) => t.reqLevel).join(',') === '102,112')

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
  check('适配', '强化费用 UI（右侧面板 + 装备页）都不再读 ironOre/saltOre', !/\.ironOre|\.saltOre/.test(C('StatusPanel.vue')) && !/\.ironOre|\.saltOre/.test(V('EquipmentView.vue')))

  // ④ 装备页/弹窗的来源技能指向采矿与伐木（而不是跳错到挖掘）
  check('适配', '图鉴装备页与装备页都提供「去采矿 + 去伐木」入口且指向正确技能', V('GearView.vue').includes("id: 'mining'") && V('GearView.vue').includes("id: 'woodcutting'") && V('EquipmentView.vue').includes("goToSkill('mining')") && V('EquipmentView.vue').includes("goToSkill('woodcutting')"))

  // ⑤ 派生清单全部含两个新技能（逐处静态校验，防回退成手抄清单）
  const rd2 = (f) => fs.readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')
  // 2026-09-27 用户⑩：挂机计划整块从 SkillView 搬到 （底栏 🗓 胶囊弹出）⇒ 断言跟着搬，
  // 同时把「技能页不许再有计划卡」也钉住（搬回去等于把用户的要求撤掉）。
  check('适配', '挂机计划（PlanPanel 的 PLAN_SKILLS）含采矿与伐木，且技能页不再有计划卡',
    rd2('src/components/PlanPanel.vue').includes("'mining'") && rd2('src/components/PlanPanel.vue').includes("'woodcutting'") && !V('SkillView.vue').includes('plan-card'))
  // 2026-09-19：分段口径由「挖掘/采矿/伐木按类别、其余每 5 级」统一成 10 级「时代」（见 C48）。
  // 这条原先是「类别分组含木料标签」，现在改成查**同一意图**的两件事：每技能文案分支仍在、分组走单一实现。
  check('适配', '采集页含采矿/伐木的 id 分支，且分段走统一的 levelEras（不再是类别分组）',
    V('GatheringView.vue').includes('isMining') && V('GatheringView.vue').includes('isWoodcutting') &&
    V('GatheringView.vue').includes('levelEras(') && !V('GatheringView.vue').includes('CAT_SECTION_LABEL'))
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

  // ⑦ 技能总量与采集总等级口径（v2.9.0：+副业·木工 → 23 个技能 / 5 大类）
  check('适配', '技能总数为 38、5 大类、采集总等级按 7 条线求和', Object.keys(SKILL_DEFS).length === 38 && SKILL_CATEGORIES.length === 5 && ['foraging', 'fishing', 'hunting', 'excavation', 'farming', 'woodcutting', 'mining'].length === 7)
}


const WOOD_IDS = new Set(TIMBERS.map((t) => t.id))
const MINING_IDS = new Set(MINING_TARGETS.map((t) => t.itemId))

// ── C30. 新技能「内容适配」守卫（v2.8.0：任务 / 采集队 / 产地 / 炼金 / 觅珍 全链同步）──
console.log('== C30. 新技能内容适配 ==')
{
  const D = (f) => fs.readFileSync(new URL(`../../src/game/data/${f}`, import.meta.url), 'utf8')

  // ① 主线任务：两个新技能各有专属任务（q501+ 手工续写在生成器产物末尾，param 一律 itemId）
  const newQuests = QUESTS.filter((q) => Number(String(q.id).slice(1)) >= 501)
  const qSkills = { woodcutting: false, mining: false }
  for (const q of newQuests) for (const o of q.objectives ?? []) {
    if (WOOD_IDS.has(o.param)) qSkills.woodcutting = true
    if (MINING_IDS.has(o.param)) qSkills.mining = true
  }
  check('内容适配', `主线任务新增 ${newQuests.length} 条且覆盖伐木/采矿两类目标`, newQuests.length >= 8 && qSkills.woodcutting && qSkills.mining, JSON.stringify(qSkills))
  check('内容适配', '主线任务 id 全局唯一', (() => { const s2 = new Set(); return QUESTS.every((q) => (s2.has(q.id) ? false : (s2.add(q.id), true))) })())
  check('内容适配', '主线任务的 param 都是真实物品（只查用物品 id 的 kind：gather/craft/harvest）', QUESTS.every((q) => (q.objectives ?? []).every((o) => !['gather', 'craft', 'harvest'].includes(o.kind) || ['any', undefined].includes(o.param) || !!ITEMS[o.param])))

  // ② 每日 / 周常 / 公会任务
  check('内容适配', '每日池与周常池都含伐木、采矿两条定向任务', DAILY_POOL.some((t) => t.param === 'woodcutting') && DAILY_POOL.some((t) => t.param === 'mining') && WEEKLY_POOL.some((t) => t.param === 'woodcutting') && WEEKLY_POOL.some((t) => t.param === 'mining'))
  check('内容适配', '公会「采集」任务含伐木 ×N 与开采矿石 ×N（kind=skill, param=技能 id）', (() => {
    const t = GUILDS.find((g) => g.id === 'harvestField')?.tasks ?? []
    return t.some((x) => x.kind === 'skill' && x.param === 'woodcutting') && t.some((x) => x.kind === 'skill' && x.param === 'mining')
  })())

  // ③ 采集队：6 条线（新增伐木队），池/稀有物品真实、技能已注册
  const ty = EXPEDITIONS.find((e) => e.id === 'timberYard')
  check('内容适配', '采集队新增「伐木队」且绑定伐木技能与 4 个槽位', !!ty && ty.skill === 'woodcutting' && ty.slots.length === 4, JSON.stringify(ty?.skill))
  check('内容适配', '伐木队的产出池按档覆盖木材（低/中/高三段各 ≥2 档）', (() => {
    if (!ty) return false
    const ids = new Set(ty.slots.flatMap((x) => x.pool))
    return ['pineWood', 'birchWood'].every((i) => ids.has(i)) && ['nanmuWood', 'redSandalWood'].every((i) => ids.has(i)) && ['glazeWood', 'starWood'].every((i) => ids.has(i))
  })())
  check('内容适配', '采集队共 6 条线，且每条线的 pool/rare 都是真实物品、skill 已注册', EXPEDITIONS.length === 6 && EXPEDITIONS.every((e) => !!SKILL_DEFS[e.skill]) && EXPEDITIONS.every((e) => e.slots.every((x) => x.pool.every((id) => !!ITEMS[id]))))

  // ④ 产地：至少两个产地的物资箱含木材（派驻采集队会带回），且 box 物品真实
  const woodRegions = REGIONS.filter((r) => (r.box ?? []).some((id) => WOOD_IDS.has(id)))
  check('内容适配', `产地物资箱含木材（${woodRegions.length} 个产地），且 box 物品全部真实`, woodRegions.length >= 2 && REGIONS.every((r) => (r.box ?? []).every((id) => !!ITEMS[id])), woodRegions.map((r) => r.name).join('/'))
  check('内容适配', '产地 box 物品在图鉴里同时登记「派驻产出」与「商队特产」两条来源', (() => {
    const r = REGIONS.find((x) => (x.box ?? []).includes('pineWood')) ?? REGIONS.find((x) => (x.box ?? []).length)
    if (!r) return false
    const id = r.box[0]
    const src = itemSources(id)
    return src.some((s) => s.includes('派驻产出')) && src.some((s) => s.includes('商队线'))
  })())

  // ⑤ 炼金：木材链存在、覆盖 20 档、且**每条满足投入价值 ≥ 产出价值**（否则 applyAlchemyRatioCap 会静默削值）
  const woodAl = ALCHEMY_RECIPES.filter((r) => WOOD_IDS.has(r.out))
  check('内容适配', `炼金新增木材链 ${woodAl.length} 条，覆盖 20 档木材`, woodAl.length >= 19 && new Set(woodAl.map((r) => r.out)).size >= 19)
  check('内容适配', '木材链每条都满足「投入价值总和 ≥ 产出价值」（防静默削值）', woodAl.every((r) => {
    const inV = Object.entries(r.in).reduce((a, [k, q]) => a + (ITEMS[k]?.value ?? 0) * q, 0)
    return (ITEMS[r.out]?.value ?? 0) <= inV
  }))
  check('内容适配', '炼金配方 id 唯一（物品存在性由 item_triple_audit 的幽灵白名单管）', (() => { const s2 = new Set(); return ALCHEMY_RECIPES.every((r) => (s2.has(r.id) ? false : (s2.add(r.id), true))) })())

  // ⑥ 觅珍：**图鉴登记的来源必须与池子成员完全一致**（本轮修的就是这里漏了 cap → 370 件假来源）
  const poolMismatch = []
  for (const pool of MIJIAN_POOLS) {
    if (pool.id === 'mix' || pool.id === 'limited') continue
    const members = new Set(poolItems(pool.id).map((i) => i.id))
    const claimed = new Set(Object.keys(ITEMS).filter((id) => itemSources(id).some((s) => s.includes(`觅珍·${pool.name}`))))
    for (const id of members) if (!claimed.has(id)) poolMismatch.push(`缺登记:${id}`)
    for (const id of claimed) if (!members.has(id)) poolMismatch.push(`假来源:${id}`)
  }
  check('内容适配', '觅珍：图鉴登记的池成员与池子实际成员完全一致（无假来源/无漏登记）', poolMismatch.length === 0, poolMismatch.slice(0, 6).join(' '))
  check('内容适配', '觅珍普通池不含超上限物品（cap 语义：value ≤ 50/100）', poolItems('material').every((i) => i.value <= 50) && poolItems('food').every((i) => i.value <= 100))
  check('内容适配', '池缓存会在价值平衡后失效（否则「谁先 import」决定池子成员，实测踩过）', D('valueBalance.js').includes('resetMijianPoolCache()') && D('mijianDraws.js').includes('export function resetMijianPoolCache()'))

  // ⑦ 轶事：挖掘子类不再含矿物，矿物归采矿（v2.8.0 把生成器源头改成地面目标）
  const exTales = QUIRKS.filter((q) => q.unlock.sub === 'excavation')
  const miTales = QUIRKS.filter((q) => q.unlock.sub === 'mining')
  check('内容适配', `挖掘轶事 ${exTales.length} 条里不再有矿物 param`, exTales.length === 200 && exTales.every((q) => !MINING_IDS.has(q.unlock.param)))
  check('内容适配', `采矿轶事 ${miTales.length} 条覆盖矿物（含盐矿/同名矿）`, miTales.length === 200 && miTales.some((q) => q.unlock.param === 'saltOre') && miTales.some((q) => q.unlock.param === 'steelOre'))
  check('内容适配', '旧的「矿物轶事补记旧键」兼容补丁已删除（挖掘轶事不再含矿物 → 无需补记）', !fs.readFileSync(new URL('../../src/stores/player.js', import.meta.url), 'utf8').includes('LEGACY_EXCAVATION_MINERALS'))
}


// ── C31. 图鉴「获取来源」完整性（v2.8.1：全量比对发现 ≥20 个系统从没登记过，全补）──
// 这一节把「能把物品给到玩家的系统」逐个钉住：它的物品集合必须都能在对应关键词的来源里找到。
console.log('== C31. 图鉴来源完整性 ==')
{
  const ids = sourceIds()
  const has = (id, kw) => itemSources(id).some((x) => x.includes(kw))

  // ① 按数据驱动的系统逐个核对（每条都是「该系统能给的所有物品都必须有对应来源串」）
  const checks = []
  checks.push(['珍馐阁', Object.values(ITEMS).filter(deluxeSellable).map((it) => it.id), '珍馐阁'])
  checks.push(['公会商店', GUILD_SHOP.map((g) => g.itemId), '公会商店'])
  checks.push(['区域对手掉落', [...new Set(COMBAT_REGIONS.flatMap((r) => (r.opponents ?? []).flatMap((o) => (o.drops ?? []).map((d) => d.itemId))))], '区域对手'])
  checks.push(['每日任务奖励', DAILY_POOL.flatMap((t) => Object.keys(t.items ?? {})), '每日任务'])
  checks.push(['周常任务奖励', WEEKLY_POOL.flatMap((t) => Object.keys(t.items ?? {})), '周常任务'])
  checks.push(['每日全清礼包', Object.keys(DAILY_BONUS.items ?? {}), '每日任务全清'])
  checks.push(['每周挑战赛', CHALLENGES.flatMap((c) => Object.keys(c.items ?? {})), '每周挑战赛'])
  checks.push(['厨神试炼', TRIALS.flatMap((t) => Object.keys(t.reward?.items ?? {})), '厨神试炼'])
  checks.push(['厨具大赛', GEAR_RANKS.flatMap((r) => Object.keys(r.items ?? {})), '厨具大赛'])
  checks.push(['风味搭配', FLAVOR_PAIRS.flatMap((x) => Object.keys(x.reward?.items ?? {})), '风味搭配'])
  checks.push(['食灵物语', Object.values(STAGE_INFO).flatMap((x) => Object.keys(x.reward?.items ?? {})), '食灵物语'])
  checks.push(['采集/挖掘附产种子', Object.values(SEED_MAP).filter(Boolean), '附产物（10%）'])
  const miss = []
  for (const [name, list, kw] of checks) {
    for (const id of new Set(list)) if (id && !has(id, kw)) miss.push(`${name}:${id}`)
  }
  check('来源完整性', `${checks.length} 个「此前未登记」的系统，其全部物品都有对应来源串`, miss.length === 0, miss.slice(0, 6).join(' '))

  // ② 觅珍：三池 + 混池 + 限时池（混池/限时池 v2.8.1 才补上）
  const mixMiss = [...materialFoodItems(60), ...materialFoodItems(150)].filter((it) => !has(it.id, '觅珍'))
  check('来源完整性', '觅珍混池/限时池的非装备分支成员都有「觅珍·…（抽卡）」来源', mixMiss.length === 0, mixMiss.slice(0, 5).map((i) => i.id).join(' '))

  // ③ 交易所：登记集合必须与「运行时按 value 筛出的货池」完全一致（惰性登记不变量）
  const pool = Object.values(ITEMS).filter((it) => it.type === 'ingredient' && EXCHANGE_POOL_CATEGORIES.includes(it.category) && (it.value ?? 0) >= 20 && (it.value ?? 0) <= 300)
  const exMiss = pool.filter((it) => !has(it.id, '交易所'))
  const exFake = ids.filter((id) => has(id, '交易所') && !pool.some((it) => it.id === id))
  check('来源完整性', '交易所：登记集合与运行时货池完全一致（惰性登记 + 版本失效）', exMiss.length === 0 && exFake.length === 0, `缺 ${exMiss.length} / 假 ${exFake.length}`)

  // ④ 任何物品的来源串都不重复（本轮实测有 78 件重复显示两遍 → add() 已去重）
  const dups = []
  for (const id of ids) {
    const list = itemSources(id)
    if (new Set(list).size !== list.length) dups.push(id)
  }
  check('来源完整性', '全部物品的来源串无重复（add() 去重不变量）', dups.length === 0, dups.slice(0, 5).join(' '))

  // ⑤ 登记的是真实物品：SOURCES 的键必须都在 ITEMS 里，**唯一例外是已知的幽灵炼金配方产物**
  const ghosts = new Set(ALCHEMY_RECIPES.map((r) => r.out))
  const bad = ids.filter((id) => !ITEMS[id] && !ghosts.has(id))
  check('来源完整性', '来源索引只登记真实物品（幽灵炼金产物为已知白名单例外）', bad.length === 0, bad.slice(0, 5).join(' '))

  // ⑥ 珍馐阁不得售卖「产线独占品」：蜂蜜/菌灵露/精耕作物/加工品只能来自各自的产线
  const exclusive = [
    ...HONEY_TIERS.map((h) => h.id), ...ESSENCE_TIERS.map((e) => e.id), PRIME_CROP_ID,
    ...GOODS_ITEMS.map((g) => g.id),
  ]
  const soldExclusive = exclusive.filter((id) => deluxeSellable(ITEMS[id]))
  const claimedExclusive = exclusive.filter((id) => has(id, '珍馐阁'))
  check('来源完整性', `珍馐阁不售卖 ${exclusive.length} 件产线独占品（蜂蜜/菌灵露/精耕作物/加工品）`, soldExclusive.length === 0 && claimedExclusive.length === 0, `在售 ${soldExclusive.length} / 误登记 ${claimedExclusive.length}`)
  check('来源完整性', '珍馐阁的售卖口径是单一来源（视图与图鉴登记共用 deluxeSellable）', (() => {
    const view = fs.readFileSync(new URL('../../src/views/ZhenXiuView.vue', import.meta.url), 'utf8')
    const src = fs.readFileSync(new URL('../../src/game/data/itemSources.js', import.meta.url), 'utf8')
    return view.includes('deluxeSellable(') && src.includes('deluxeSellable(')
  })())

  // ⑦ 木材/矿石：至少要有「采集 + 一个下游系统」两类来源（防止将来又退回只剩一两种）
  const woodOk = ['pineWood', 'elmWood', 'glazeWood', 'primalWood'].every((id) => itemSources(id).some((x) => x.includes('伐木')) && itemSources(id).some((x) => x.includes('珍馐阁')))
  check('来源完整性', '木材既有「伐木获得」也有下游来源（珍馐阁）——不再是孤零零一两种', woodOk)
}

// ── C32. 副业·木工（v2.9.0：独立第三页签的技能，吃伐木木材 → 木器 → 手工装潢）──
console.log('══ C32. 副业·木工 ══')
{
  // ① 技能本体：已注册实例、类型为 production、落在 sideline 大类、有图标
  const inst = getSkillInstance('woodworking')
  const def = SKILL_DEFS.woodworking
  check('副业·木工', '技能已注册实例且类型为 production（复用 ProductionView 与制作队列/精通）',
    inst?.type === 'production' && inst?.id === 'woodworking' && typeof inst?.craft === 'function')
  check('副业·木工', '技能落在 sideline 大类、有中文名与图标',
    def?.category === 'sideline' && !!def?.name && !!def?.icon && def.icon !== '•', `${def?.category}/${def?.icon}`)

  // ② 页签分组：skill 页签 4 类 / side 页签只有 1 类（左栏第三页签）
  const skillTabCats = skillCategoriesOfTab('skills')
  const sideTabCats = skillCategoriesOfTab('side')
  check('副业·木工', '左栏页签分组：技能 4 类 / 副业 1 类，且分类总数守恒（不重不漏）',
    skillTabCats.length === 4 && sideTabCats.length === 1 && sideTabCats[0].id === 'sideline' && skillTabCats.length + sideTabCats.length === SKILL_CATEGORIES.length)

  // ②b **跨文件契约（2026-09-17 实测踩过）**：`SKILL_CATEGORIES[].tab` 的取值必须与 Sidebar.vue 里
  //     `sideTab` 的 key 完全一致 —— 早先这里写单数 `'skill'`、侧栏判的是 `'skills'`，
  //     于是**点任何技能都会把三个列表全部隐藏、左栏空白**（v2.9.0 引入，v2.10.1 修）。
  //     断言方式：从 Sidebar 源码抽出全部 `sideTab === 'X'` 字面量，要求每个 tab 值都在其中。
  const sidebarSrc2 = fs.readFileSync(new URL('../../src/components/Sidebar.vue', import.meta.url), 'utf8')
  const sideTabKeys = [...new Set([...sidebarSrc2.matchAll(/sideTab === '([a-zA-Z]+)'/g)].map((m) => m[1]))]
  const catTabs = [...new Set(SKILL_CATEGORIES.map((c) => c.tab))]
  check('副业·木工', `页签 key 与侧栏一致（SKILL_CATEGORIES.tab ⊂ Sidebar 的 ${sideTabKeys.length} 个 sideTab 取值）`,
    sideTabKeys.length >= 3 && catTabs.every((t) => sideTabKeys.includes(t)) && catTabs.every((t) => skillCategoriesOfTab(t).length > 0),
    `catTabs=${catTabs.join(',')} 不在侧栏里的=${catTabs.filter((t) => !sideTabKeys.includes(t)).join(',')}`)

  // ③ 木器物品：10 件、id 唯一、类别为 furniture（与材料 material 区分）
  const badItems = []
  for (const it of WOODWORKING_ITEMS) {
    if (!ITEMS[it.id]) badItems.push(`${it.id}: 未合并进 ITEMS`)
    else if (it.type !== 'ingredient' || it.category !== WOODWORK_CATEGORY) badItems.push(`${it.id}: type/category 非 ingredient/furniture`)
  }
  // v2.29.7「档位加密」：15 件基底/补档/变体之外，Lv1~91 的平原上每两档之间再插一档「·良」（+9 件）
  const woDensified = WOODWORKING_ITEMS.filter((i) => i.name.endsWith('·良'))
  check('副业·木工', `木器共 ${WOODWORKING_ITEMS.length} 件（15 基底/补档/变体 + 9 加密档「·良」）、全部并入 ITEMS 且类别为木器（furniture）`,
    WOODWORKING_ITEMS.length === 24 && woDensified.length === 9 && new Set(WOODWORKING_ITEMS.map((i) => i.id)).size === 24 && badItems.length === 0, badItems.join('; '))
  check('副业·木工', '每件木器都有图片文件（占位图也算，但文件必须真实存在）',
    WOODWORKING_ITEMS.every((it) => imgExists(it.id)), WOODWORKING_ITEMS.filter((it) => !imgExists(it.id)).map((i) => i.name).join('、'))
  // 木器价值 == 木材投入合计（v2.10.1：多余木器半价卖回即等于把木材整包卖掉）
  applyValueBalance()
  const wvBad = WOODWORKING_RECIPES.filter((r) => {
    // 价值不变量必须与**生效材料**同源（材料系数改的是用量 ⇒ 这里读原始数量会让不变量名存实亡）
    const want = Math.max(1, Math.round(Object.entries(effIngredients(r)).reduce((a, [id, q]) => a + (ITEMS[id]?.value ?? 0) * q, 0)))
    return ITEMS[r.output.itemId]?.value !== want
  })
  check('副业·木工', '10 件木器的价值 == 其木材投入合计（半价卖出即等于把木材整包卖掉）',
    wvBad.length === 0, wvBad.map((r) => r.id).join(','))

  // ④ 配方：每 10 级一件、材料是该档木材、数量 2~5、产物是自己
  const bandTimbers = new Set([...TIMBERS.map((t) => t.id), 'late_wood_01', 'late_wood_02']) // 补档两件新木合法（lateGameFood.js）
  const rBad = []
  for (const r of WOODWORKING_RECIPES) {
    const mats = Object.keys(r.ingredients ?? {})
    if (mats.length !== 1 || !bandTimbers.has(mats[0])) rBad.push(`${r.id}: 材料不是单一档位木材（${mats.join('+')}）`)
    else {
      const lv = ITEMS[mats[0]] ? timberLevelOf(mats[0]) : null
      if (lv != null && Math.abs(lv - r.reqLevel) > 4) rBad.push(`${r.id}: 木材 Lv${lv} 与配方 Lv${r.reqLevel} 不同档`)
      const q = r.ingredients[mats[0]]
      // 2~8：补档两件是 5、T3「同物变体」三件按档递增到 6/7/8（变体材料更贵 ⇒ 价值自动更高）
      if (!(q >= 2 && q <= 8)) rBad.push(`${r.id}: 数量 ${q} 不在 2~8`)
    }
    if (!ITEMS[r.output?.itemId]) rBad.push(`${r.id}: 产物不存在`)
  }
  check('副业·木工', `配方 ${WOODWORKING_RECIPES.length} 条：材料均为同档木材、数量 2~8、产物存在`, rBad.length === 0, rBad.slice(0, 4).join('; '))
  check('副业·木工', '配方等级：基底每 10 级一件（Lv1,11,…,91）+ 加密档 Lv6/16/…/86（把平原做成 5 级/件）+ 补档 102/112 + 同物变体 114/117/120，严格递增',
    WOODWORKING_RECIPES.map((r) => r.reqLevel).join(',') === '1,6,11,16,21,26,31,36,41,46,51,56,61,66,71,76,81,86,91,102,112,114,117,120')

  // ⑤ 启动重算不改动这些配方（raiseRecipeLevels 必须对它们是恒等变换）
  const liveRecipes = inst.recipes
  const drift = []
  for (const r of WOODWORKING_RECIPES) {
    const live = liveRecipes.find((x) => x.id === r.id)
    if (!live) { drift.push(`${r.id}: 实例里没有`); continue }
    if (live.reqLevel !== r.reqLevel) drift.push(`${r.id}: reqLevel ${r.reqLevel}→${live.reqLevel}`)
    if (JSON.stringify(live.ingredients) !== JSON.stringify(r.ingredients)) drift.push(`${r.id}: 材料被改写`)
  }
  check('副业·木工', '技能构造后配方零漂移（材料已同档，平衡函数对它是恒等变换）', drift.length === 0, drift.slice(0, 4).join('; '))

  // ⑥ 独占品口径：木器不得出现在任何抽卡池 / 礼包池 / 交易所 / 商队货舱 / 自动出售
  const woodIds = new Set(WOODWORKING_ITEMS.map((i) => i.id))
  const poolLeak = []
  for (const p of MIJIAN_POOLS) for (const it of poolItems(p.id)) if (woodIds.has(it.id)) poolLeak.push(`${p.id}:${it.name}`)
  for (const it of materialFoodItems(Infinity)) if (woodIds.has(it.id)) poolLeak.push(`素材池:${it.name}`)
  for (const id of INGREDIENT_POOL) if (woodIds.has(id)) poolLeak.push(`食材礼包:${id}`)
  check('副业·木工', '木器不进任何抽卡池（觅珍 5 池 + 素材池）与食材礼包池（独占品不得有捷径）', poolLeak.length === 0, poolLeak.slice(0, 4).join(' '))
  const traded = WOODWORKING_ITEMS.filter((it) => EXCHANGE_POOL_CATEGORIES.includes(it.category) || CARAVAN_CARGO_TYPES.includes(it.category) && !CARAVAN_EXCLUDE_CATEGORIES.includes(it.category))
  check('副业·木工', '木器不进交易所货池、不能当商队货物、不被自动出售', traded.length === 0 && SELL_EXCLUDED_CATEGORIES.includes(WOODWORK_CATEGORY), `traded=${traded.length}`)

  // ⑦ 木器不进山海食经、也不吃食灵经验加成（用户 2026-09-16 的两条设计决策）
  const shanhaiSkills = new Set(SHANHAI_NODES.map((n) => n.req?.skill).filter(Boolean).concat(SHANHAI_NODES.map((n) => n.req?.skill2).filter(Boolean)))
  check('副业·木工', '木工不进入山海食经（线↔技能白名单，加线会改写已定稿的节点布局）', !shanhaiSkills.has('woodworking'))
  const spiritXp = SPIRITS.filter((s) => (s.effect?.xpPct ?? {})['woodworking'] != null)
  check('副业·木工', `副业不吃食灵经验加成（${SPIRITS.length} 只食灵的经验域都不含木工）`, spiritXp.length === 0, spiritXp.map((s) => s.id).join(','))

  // ⑧ 手工装潢：10 件、效果严格递增、来源指向真实木器、并入装潢索引
  const cBad = []
  for (const d of CRAFTED_DECOR) {
    if (!RESTAURANT_DECOR_BY_ID[d.id]) cBad.push(`${d.id}: 未并入 RESTAURANT_DECOR_BY_ID`)
    const dsrc = d.craftedFrom?.itemId
    if (!d.craftedFrom || (dsrc !== 'wood' && !woodIds.has(dsrc))) cBad.push(`${d.id}: craftedFrom 指向的不是木器/木材`)
    if (d.price != null) cBad.push(`${d.id}: 手工装潢不该有金币价`)
    if (!(d.effect > 0)) cBad.push(`${d.id}: effect 非正`)
  }
  const effects = CRAFTED_DECOR.map((d) => d.effect)
  check('副业·木工', `手工装潢 ${CRAFTED_DECOR.length} 件：并入装潢索引、来源为木器或基础木材、无金币价、效果为正（补档 +2、T3 变体 +3）`, CRAFTED_DECOR.length === 16 && cBad.length === 0, cBad.slice(0, 4).join('; '))
  check('副业·木工', '手工装潢效果严格递增（等级越高越强，无倒挂）', effects.every((v, i) => i === 0 || v > effects[i - 1]), effects.join(','))
  check('副业·木工', `装潢总数 = 商店 ${RESTAURANT_DECOR.length} + 手工 ${CRAFTED_DECOR.length}（分母用 DECOR_TOTAL，避免做满后显示 305/300）`,
    DECOR_TOTAL === RESTAURANT_DECOR.length + CRAFTED_DECOR.length && RESTAURANT_DECOR.length === 300)

  // ⑨ player.craftDecor 的四种返回语义 + 真的加收入
  const p = freshPlayer({ woodworking: 30 })
  const p0 = freshPlayer({ woodworking: 30 }) // 新档无木器
  check('副业·木工', '未持有木器时 craftDecor 返回 denied（不给装潢）',
    p0.craftDecor(CRAFTED_DECOR[0].id) === 'denied' && !(p0.restaurant.decor ?? []).includes(CRAFTED_DECOR[0].id))
  check('副业·木工', '非法目标（非手工装潢 id）返回 bad，不会白拿',
    p.craftDecor('decor_1') === 'bad' && p.craftDecor('不存在的id') === 'bad')
  const target = CRAFTED_DECOR.find((d) => d.craftedFrom.itemId === 'bowlRack')
  // ⚠️ 新档菜单是空的 → 时收恒为 0，乘多少装饰都还是 0。要验证「装潢真的抬了收入」，
  //    必须先挂一道菜（这也是既有装潢测试的做法）。
  p.restaurant.menu = ['roastPotato']
  const before = p.restaurantHourlyIncome
  p.inventory[target.craftedFrom.itemId] = 2
  const res = p.craftDecor(target.id)
  const after = p.restaurantHourlyIncome
  check('副业·木工', '持有木器时 craftDecor 成功：消耗 1 件木器、装潢入库、餐厅时收上升',
    res === 'ok' && p.inventory[target.craftedFrom.itemId] === 1 && (p.restaurant.decor ?? []).includes(target.id) && after > before,
    `${res} 木器余 ${p.inventory[target.craftedFrom.itemId]} 收入 ${before.toFixed(1)}→${after.toFixed(1)}`)
  check('副业·木工', '重复制作返回 owned 且不再扣木器（幂等，不重复计数）',
    p.craftDecor(target.id) === 'owned' && p.inventory[target.craftedFrom.itemId] === 1)
  // 木柴堆（2026-09-25 用户拍板）：唯一一条**直接吃基础木材 ×10** 的手工装潢 —— 木材的限流消耗口
  const pw = freshPlayer({ woodworking: 1 })
  pw.inventory.wood = 10
  pw.restaurant.menu = ['roastPotato']
  const wBefore = pw.restaurantHourlyIncome
  const wRes = pw.craftDecor('decor_hand_woodPile')
  check('副业·木工', '木柴堆：木材×10 可直接做成手工装潢（消耗 10 木材、收入上升、重复返回 owned）',
    wRes === 'ok' && (pw.inventory.wood ?? 0) === 0 && (pw.restaurant.decor ?? []).includes('decor_hand_woodPile') &&
    pw.restaurantHourlyIncome > wBefore && pw.craftDecor('decor_hand_woodPile') === 'owned',
    `${wRes} wood余${pw.inventory.wood ?? 0} 收入 ${wBefore.toFixed(1)}→${pw.restaurantHourlyIncome.toFixed(1)}`)

  // ⑩ 存档往返：手工装潢随 restaurant.decor 一起存下来
  const saved = p.serialize()
  const p2 = freshPlayer()
  p2.applySave(saved)
  check('副业·木工', '存档往返后手工装潢仍在且仍计入收入（走既有 restaurant.decor 数组，无新存档字段）',
    (p2.restaurant.decor ?? []).includes(target.id) && p2.restaurantHourlyIncome > 0,
    `decor=${(p2.restaurant.decor ?? []).length} 收入=${p2.restaurantHourlyIncome.toFixed(1)}`)

  // ⑪ 图鉴三查：详细作用 / 可用于制作 / 获取来源三条都要到位
  const gBad = []
  for (const it of WOODWORKING_ITEMS) {
    const lines = itemDetailLines(it.id).map((l) => l.join('')).join('|')
    if (!itemSources(it.id).some((s) => s.includes('木工'))) gBad.push(`${it.id}: 来源缺「木工制作」`)
    const uses = itemUses(it.id)
    if (it.name.endsWith('·良')) {
      // 加密档**不是手工装潢**（v2.29.7）⇒ 三查的判据换成「量产阶梯」这一条；同时反向钉住
      // 「它不该有装潢」（否则等于凭空多出 9 件装潢、把手工合计与效果递增一起改写）。
      if (!lines.includes('量产阶梯')) gBad.push(`${it.id}: 详细作用缺「量产阶梯」`)
      if (!uses.some((u) => u.kind === 'ladder')) gBad.push(`${it.id}: 可用于制作缺「量产阶梯」`)
      if (decorOfWoodwork(it.id)) gBad.push(`${it.id}: 加密档不该有手工装潢`)
    } else {
      if (!lines.includes('手工装潢')) gBad.push(`${it.id}: 详细作用缺「做成手工装潢」`)
      if (!uses.some((u) => u.kind === 'decor' && u.outputId === decorOfWoodwork(it.id)?.id)) gBad.push(`${it.id}: 可用于制作缺装潢`)
    }
  }
  check('副业·木工', '图鉴三查：木器的详细作用 / 可用于制作（基底→装潢、加密档→量产阶梯）/ 获取来源（木工制作）三处齐全', gBad.length === 0, gBad.slice(0, 4).join('; '))
  check('副业·木工', '木器与手工装潢的来源串都能跳转（图鉴里不是死文本）',
    jumpForSource('木工制作（松木×2，Lv1 可学）')?.skill === 'woodworking' && !!jumpForSource('餐厅装潢'))
  check('副业·木工', '木材的「可用于制作」已含木工配方（下游真的接上了）',
    itemUses('pineWood').some((u) => WOODWORKING_ITEMS.some((it) => it.id === u.outputId)))

  // ⑫ 内容同步：公会 / 每日 / 周常任务都有一条木工，且 kind 有处理分支
  const gTask = GUILDS.some((g) => (g.tasks ?? []).some((t) => t.kind === 'skill' && t.param === 'woodworking'))
  const dTask = DAILY_POOL.some((t) => t.param === 'woodworking')
  const wTask = WEEKLY_POOL.some((t) => t.param === 'woodworking')
  check('副业·木工', '公会 / 每日 / 周常三处任务都有木工条目，且 param 是已注册技能',
    gTask && dTask && wTask && !!SKILL_DEFS.woodworking)
}

// ── C33. 副业四支（v2.10.0：陶艺/编织/刺绣/蜡烛 —— 各接一条经营侧乘区出口）──
console.log('══ C33. 副业四支（陶艺/编织/刺绣/蜡烛）══')
{
  // ① 技能本体：四个都已注册实例、类型 production、落在 sideline 大类、有图标
  const sBad = []
  for (const s of SIDELINE_SKILL_LIST) {
    const inst = getSkillInstance(s.id)
    const def = SKILL_DEFS[s.id]
    if (inst?.type !== 'production') sBad.push(`${s.id}: 实例类型非 production`)
    if (!def || def.category !== 'sideline') sBad.push(`${s.id}: 不在 sideline 大类`)
    if (!def?.icon || def.icon === '•') sBad.push(`${s.id}: 缺图标`)
    if (!(inst?.recipes?.length > 0)) sBad.push(`${s.id}: 无配方`)
  }
  check('副业四支', `四个技能都已注册（production / sideline / 有图标 / 有配方）`, sBad.length === 0, sBad.join('; '))
  check('副业四支', `副业共 16 支，SKILL_DEFS 里 sideline 计数一致`,
    Object.values(SKILL_DEFS).filter((d) => d.category === 'sideline').length === 16 && SIDELINE_SKILL_IDS.length === 15)

  // ② 物品与作品：id 唯一、类别在「副业独占清单」内、每件都并入 ITEMS；
  //    **非加密档**必须有作品定义（加密档「·良」的去处是量产阶梯 —— 见 sidelineWorks 的硬约束①）
  const iBad = []
  const densItems = SIDELINE_ITEMS.filter((i) => i.name.endsWith('·良'))
  for (const it of SIDELINE_ITEMS) {
    if (!ITEMS[it.id]) iBad.push(`${it.id}: 未并入 ITEMS`)
    if (!SIDELINE_ITEM_CATEGORIES.includes(it.category)) iBad.push(`${it.id}: 类别不在独占清单`)
    if (!sidelineWorkOf(it.id) && !it.name.endsWith('·良')) iBad.push(`${it.id}: 既不是作品也不是加密档`)
  }
  check('副业四支', `产物共 ${SIDELINE_ITEMS.length} 件（223 基底/补档/变体 + ${densItems.length} 加密档「·良」）、id 唯一、类别合法、非加密档均有作品定义`,
    SIDELINE_ITEMS.length === 356 && densItems.length === 133 && new Set(SIDELINE_ITEMS.map((i) => i.id)).size === 356 && iBad.length === 0, iBad.slice(0, 4).join('; '))
  check('副业四支', `${SIDELINE_ITEMS.length} 件产物都有图片文件（加密档与基底共用同一张）`, SIDELINE_ITEMS.every((it) => imgExists(it.id)),
    SIDELINE_ITEMS.filter((it) => !imgExists(it.id)).map((i) => i.name).join('、'))

  // ②c 🔴 **档位加密的核心不变量**（v2.29.7，2026-09-30 用户口径「同样的时长但不枯燥」）：
  //    加密档必须是「**级差 5 的同物**·良」、与基底**共用同一张图**（零美术）、辅料与基底完全相同、
  //    **不登记为作品**（⇒ 各轴「作品数 × 每件加成」一分不差、硬顶不用动）、且真的能进量产阶梯。
  //    ——这几条就是「不加时长、不加数值，只加密度」的全部含义，缺一条这个改动就变味了。
  {
    const dBad = []
    for (const it of densItems) {
      const baseName = it.name.replace(/·良$/, '') // 「·良」是两个字符（间隔号 + 良）
      const base = SIDELINE_ITEMS.find((x) => x.name === baseName)
      if (!base) { dBad.push(`${it.name}: 找不到基底`); continue }
      const rIt = SIDELINE_RECIPES[sidelineSkillOfItem(it.id).skill].find((r) => r.output.itemId === it.id)
      const rBase = SIDELINE_RECIPES[sidelineSkillOfItem(base.id).skill].find((r) => r.output.itemId === base.id)
      if (rIt.reqLevel - rBase.reqLevel !== 5) dBad.push(`${it.name}: 级差 ${rIt.reqLevel - rBase.reqLevel} ≠ 5`)
      if (itemImage(it.id) !== itemImage(base.id)) dBad.push(`${it.name}: 与基底不是同一张图`)
      const auxOf = (r) => Object.entries(r.ingredients).filter(([k]) => !TIMBERS.some((t) => t.id === k))
      if (JSON.stringify(auxOf(rIt)) !== JSON.stringify(auxOf(rBase))) dBad.push(`${it.name}: 辅料与基底不一致`)
      if (sidelineWorkOf(it.id)) dBad.push(`${it.name}: 加密档不该登记为作品`)
      if (!SIDELINE_PRODUCTS[sidelineSkillOfItem(it.id).skill].some((x) => x.itemId === it.id)) dBad.push(`${it.name}: 不在量产阶梯产物表里`)
    }
    check('副业四支', `🔴 加密档 ${densItems.length} 件：级差 5 的同物 · 与基底同图 · 辅料一致 · **不登记作品** · 能进量产阶梯`,
      dBad.length === 0, dBad.slice(0, 4).join('; '))
    // 作品数口径：必须数 **SIDELINE_WORKS 的条数**（加密档有配方但不是作品）——写成配方数会虚报
    const wBad = SIDELINE_SKILL_LIST.filter((s) => s.works !== Object.values(SIDELINE_WORKS).filter((w) => w.skill === s.id).length)
    check('副业四支', '各支「作品数」= SIDELINE_WORKS 条数（**不是配方数**：加密档有配方、不是作品）',
      wBad.length === 0 && SIDELINE_SKILL_LIST.every((s) => s.works <= 15), wBad.map((s) => `${s.id}:${s.works}`).join(','))
  }
  // ②b 产物价值 = 配方材料价值合计（v2.10.1：让「多做出来的」半价卖回时不亏）
  // 2026-09-21：材料用量改走全局系数 ⇒ 这里也必须用 `effIngredients`（同源），
  // 否则「材料翻倍但产物价值没跟上」会让这条不变量名存实亡（守卫反而助长静默失效）。
  applyValueBalance()
  const vBad = []
  for (const def of SIDELINE_SKILL_LIST) for (const r of SIDELINE_RECIPES[def.id]) {
    const want = Math.max(1, Math.round(Object.entries(effIngredients(r)).reduce((a, [id, q]) => a + (ITEMS[id]?.value ?? 0) * q, 0)))
    const got = ITEMS[r.output.itemId]?.value
    if (got !== want) vBad.push(`${r.id}: ${got}≠${want}`)
  }
  check('副业四支', `${SIDELINE_ITEMS.length} 件产物的价值 == 其配方材料价值合计（半价卖出即等于把材料整包卖掉）`, vBad.length === 0, vBad.slice(0, 4).join('; '))

  // ③ 配方：基材是该档木材、辅料等级 ≤ 配方+5、产物是自己、等级严格递增且落在阶梯上
  const rBad = []
  // 基材 = 20 档木材 ∪ 补档两件新木（2026-09-29：102 档玄铁杉 / 112 档天罡沉香，lateGameFood.js；
  //  档位木材体系与装备套一一对应、冻结到 Lv100，所以新档的木走点名而不是 timberOfLevel）
  const bands = new Set([...TIMBERS.map((t) => t.id), 'late_wood_01', 'late_wood_02'])
  for (const def of SIDELINE_SKILL_LIST) {
    const recs = SIDELINE_RECIPES[def.id]
    const lvls = recs.map((r) => r.reqLevel)
    if (!lvls.every((v, i) => i === 0 || v > lvls[i - 1])) rBad.push(`${def.id}: 等级非严格递增`)
    for (const r of recs) {
      const mats = Object.keys(r.ingredients ?? {})
      const wood = mats.find((m) => bands.has(m))
      if (!wood) { rBad.push(`${r.id}: 基材不是档位木材（${mats.join('+')}）`); continue }
      const wl = timberLevelOf(wood)
      if (wl > r.reqLevel + 5) rBad.push(`${r.id}: 木材 Lv${wl} 超纲（配方 Lv${r.reqLevel}）`)
      for (const m of mats) {
        const ml = materialLevelOf(m)
        if (ml != null && ml > r.reqLevel + 5) rBad.push(`${r.id}: 辅料 ${m} Lv${ml} 超纲`)
      }
      if (!ITEMS[r.output?.itemId]) rBad.push(`${r.id}: 产物不存在`)
    }
  }
  check('副业四支', '46 条配方：基材为该档木材（含补档新木）、全部材料等级 ≤ 配方+5、产物存在、等级严格递增', rBad.length === 0, rBad.slice(0, 4).join('; '))

  // ④ 启动重算零漂移：raiseRecipeLevels 对它们是恒等变换（材料本已达标，不该被抬级/删料）
  const drift = []
  for (const def of SIDELINE_SKILL_LIST) {
    const inst = getSkillInstance(def.id)
    for (const r of SIDELINE_RECIPES[def.id]) {
      const live = inst.recipes.find((x) => x.id === r.id)
      if (!live) { drift.push(`${r.id}: 实例里没有`); continue }
      if (live.reqLevel !== r.reqLevel) drift.push(`${r.id}: reqLevel ${r.reqLevel}→${live.reqLevel}`)
      if (JSON.stringify(live.ingredients) !== JSON.stringify(r.ingredients)) drift.push(`${r.id}: 材料被改写`)
    }
  }
  check('副业四支', '技能构造后 38 条配方零漂移（平衡函数对它们是恒等变换）', drift.length === 0, drift.slice(0, 4).join('; '))

  // ⑤ 独占品口径：不进任何抽卡池 / 礼包池 / 交易所 / 商队 / 自动出售
  const ids = new Set(SIDELINE_ITEMS.map((i) => i.id))
  const leak = []
  for (const p of MIJIAN_POOLS) for (const it of poolItems(p.id)) if (ids.has(it.id)) leak.push(`${p.id}:${it.name}`)
  for (const it of materialFoodItems(Infinity)) if (ids.has(it.id)) leak.push(`素材池:${it.name}`)
  for (const id of INGREDIENT_POOL) if (ids.has(id)) leak.push(`食材礼包:${id}`)
  for (const it of SIDELINE_ITEMS) {
    if (EXCHANGE_POOL_CATEGORIES.includes(it.category)) leak.push(`交易所:${it.name}`)
    if (CARAVAN_CARGO_TYPES.includes(it.category) && !CARAVAN_EXCLUDE_CATEGORIES.includes(it.category)) leak.push(`商队:${it.name}`)
  }
  check('副业四支', '178 件产物不进抽卡池/礼包池/交易所/商队，也不被自动出售',
    leak.length === 0 && SIDELINE_ITEM_CATEGORIES.every((c) => SELL_EXCLUDED_CATEGORIES.includes(c)), leak.slice(0, 4).join(' '))

  // ⑥ 两条设计决策：不吃食灵经验、不进山海食经
  check('副业四支', '四支都不吃食灵经验加成（160 只食灵的经验域都不含它们）',
    SPIRITS.every((s) => SIDELINE_SKILL_IDS.every((id) => (s.effect?.xpPct ?? {})[id] == null)))
  const shanhaiSkills2 = new Set(SHANHAI_NODES.flatMap((n) => [n.req?.skill, n.req?.skill2]).filter(Boolean))
  check('副业四支', '四支都不进入山海食经（线↔技能白名单）', SIDELINE_SKILL_IDS.every((id) => !shanhaiSkills2.has(id)))

  // ⑦ 四个出口真的接上了：各做一件，对应的那条数值必须变化
  const p = freshPlayer()
  p.restaurant.menu = ['roastPotato'] // 新档菜单为空 → 时收恒 0，乘多少小费都还是 0
  const baseTip = p.restaurantHourlyIncome
  const baseCellar = p.cellarSlotValueMax()
  const baseSign = p.michelinScore().score
  const baseNight = p.nightMarketExtraHours()
  const axisBad = []
  const probes = [
    ['pottery_1', 'cellarValue', () => p.cellarSlotValueMax() > baseCellar, `地窖单槽上限 ${baseCellar}→${p.cellarSlotValueMax()}`],
    ['weaving_1', 'tipPct', () => p.restaurantHourlyIncome > baseTip, `餐厅时收 ${baseTip.toFixed(1)}→${p.restaurantHourlyIncome.toFixed(1)}`],
    ['embroidery_1', 'michelinScore', () => p.michelinScore().score > baseSign, `米其林评分 ${baseSign}→${p.michelinScore().score}`],
    ['candles_1', 'nightHours', () => p.nightMarketExtraHours() > baseNight, `夜市延长 ${baseNight}→${p.nightMarketExtraHours()}`],
  ]
  for (const [itemId, axis, changed, detail] of probes) {
    p.inventory[itemId] = 1
    const res = p.craftWork(itemId)
    if (res !== 'ok') axisBad.push(`${itemId}: craftWork=${res}`)
    else if (!changed()) axisBad.push(`${itemId}: 做了但 ${axis} 没变（${detail}）`)
  }
  check('副业四支', '四条出口都真的接上了（做一件 → 对应数值立刻变化）', axisBad.length === 0, axisBad.join('; '))
  check('副业四支', '米其林评分的「招牌绣屏」分项（副业侧）已接上，且既有六维权重未被改动',
    p.michelinScore().parts.some((x) => x.id === 'sign' && x.points === SIDELINE_AXES.michelinScore.perItem)
    && MICHELIN_FACTORS.slice(0, 6).map((f) => f.id).join(',') === 'menu,decor,orders,critic,regulars,branches')

  // ⑧ craftWork 的四种语义 + 幂等 + 消耗
  p.inventory['pottery_1'] = 2
  check('副业四支', '重复做同一件返回 owned 且不再扣物品（幂等）',
    p.craftWork('pottery_1') === 'owned' && p.inventory['pottery_1'] === 2)
  check('副业四支', '非法目标返回 bad、背包没有时返回 denied',
    p.craftWork('apple') === 'bad' && p.craftWork('pottery_91') === 'denied')
  p.inventory['pottery_11'] = 1
  const res11 = p.craftWork('pottery_11')
  // 消耗最后一件时 spendItem 会**删掉该键**（不是置 0），故用 ?? 0 判断
  check('副业四支', '做成作品会消耗 1 件产物',
    res11 === 'ok' && (p.inventory['pottery_11'] ?? 0) === 0 && (p.sidelineWorks ?? []).includes('pottery_11'))

  // ⑨ 满配：38 件作品做完 **且五支阶梯喂满** 后的合计与硬顶
  //   （v2.11.0：硬顶 = 基础 16,000 + 陶艺作品 15,000 + 陶艺阶梯 9,000 = 40,000，三者缺一都到不了）
  const full = freshPlayer()
  full.restaurant.menu = ['roastPotato']
  for (const it of SIDELINE_ITEMS) { full.inventory[it.id] = 1; full.craftWork(it.id) }
  for (const l of SIDELINE_LADDERS) {
    const list = SIDELINE_PRODUCTS[l.skill]
    const top = list[list.length - 1]
    full.inventory[top.itemId] = Math.ceil(LADDER_TIERS[LADDER_TIERS.length - 1] / top.points)
    full.feedSideline(l.skill)
  }
  check('副业四支', `满配合计（作品+阶梯）：地窖上限 ${full.cellarSlotValueMax()}（硬顶 ${CELLAR_SLOT_VALUE_MAX}）· 小费 +${full.tipBonusPct()}% · 招牌 +${full.michelinSignScore()} 分 · 夜市 ×${full.nightMarketMult().toFixed(2)}+${full.nightMarketExtraHours()}h`,
    full.sidelineWorks.length === 223 && full.cellarSlotValueMax() === CELLAR_SLOT_VALUE_MAX
    && full.tipBonusPct() === SIDELINE_AXIS_TOTALS.tipPct.total + full.sidelineLadderTotal('tipPct')
    && full.michelinSignScore() === SIDELINE_AXIS_TOTALS.michelinScore.total + full.sidelineLadderTotal('michelinScore')
    && full.nightMarketExtraHours() === NIGHT_MARKET_MAX_EXTRA_HOURS
    && SIDELINE_LADDERS.every((l) => full.sidelineLadderTier(l.skill) === LADDER_TIERS.length),
    `${full.sidelineWorks.length} 件 / 各支档位 ${SIDELINE_LADDERS.map((l) => full.sidelineLadderTier(l.skill)).join(',')}`)

  // ⑩ 蜡烛真的改变了命中判定（同一小时，延长前后结论不同），且不溢出上限
  const nightOn = (h, ev) => activeMarketEventsPure(h, 1, ev).some((e) => e.id === 'nightMarket')
  const fullEv = marketEventsWithNightExtension(NIGHT_MARKET_MAX_EXTRA_HOURS)
  check('副业四支', '蜡烛延长真的改变命中判定：23:00 基础不命中 → 满配蜡烛后命中',
    !nightOn(23, MARKET_EVENTS) && nightOn(23, fullEv))
  // 结束小时 = 基础 22 + 延长量（=30 表示次日 06:00）；`nightMarketEndHour` 跨夜时返回 24+尾段
  check('副业四支', `满配后夜市窗口 = 16:00~次日 ${22 + NIGHT_MARKET_MAX_EXTRA_HOURS - 24}:00（蜡烛作品数 ×1h；03:00 命中、12:00 不命中，不是全天）`,
    nightOn(3, fullEv) && !nightOn(12, fullEv) && nightMarketEndHour(fullEv) === 22 + NIGHT_MARKET_MAX_EXTRA_HOURS)
  check('副业四支', '延长量被夹在 0~上限（存档里出现超限值也不会把窗口拉成全天）',
    nightMarketEndHour(marketEventsWithNightExtension(999)) === 22 + NIGHT_MARKET_MAX_EXTRA_HOURS
    && marketEventsWithNightExtension(-5) === MARKET_EVENTS && marketEventsWithNightExtension(0) === MARKET_EVENTS)

  // ⑪ 存档往返：作品进档、旧档回退空数组、非法 id 被过滤
  const s1 = JSON.stringify(full.serialize())
  const p2 = freshPlayer()
  p2.applySave(JSON.parse(s1))
  check('副业四支', '作品随存档往返无损（含各轴派生值一致）',
    JSON.stringify(p2.serialize()) === s1 && p2.cellarSlotValueMax() === full.cellarSlotValueMax() && p2.sidelineEffectTotal('tipPct') === full.tipBonusPct())
  const p3 = freshPlayer()
  p3.applySave({ gold: 100 })
  check('副业四支', '旧档缺 sidelineWorks 字段时回退为空数组', Array.isArray(p3.sidelineWorks) && p3.sidelineWorks.length === 0)
  const p4 = freshPlayer()
  p4.applySave({ sidelineWorks: ['pottery_1', '不存在的id', 123] })
  check('副业四支', '读档时过滤掉非法/不存在 id（不污染加成合计）',
    p4.sidelineWorks.length === 1 && p4.sidelineWorks[0] === 'pottery_1' && p4.cellarSlotValueMax() === CELLAR_SLOT_VALUE_BASE + 1500)

  // ⑫ 图鉴三查 + 效果总览登记 + 内容同步
  const gBad = []
  for (const it of SIDELINE_ITEMS) {
    const lines = itemDetailLines(it.id).map((l) => l.join('')).join('|')
    if (!itemSources(it.id).some((s) => s.includes('制作'))) gBad.push(`${it.id}: 来源缺「制作」`)
    const uses = itemUses(it.id)
    if (it.name.endsWith('·良')) {
      // 加密档（v2.29.7）：**不是作品** ⇒ 去处记在「量产阶梯」那一行（与木工加密档同一套判据）
      if (!lines.includes('量产阶梯')) gBad.push(`${it.id}: 详细作用缺「量产阶梯」`)
      if (!uses.some((u) => u.kind === 'ladder')) gBad.push(`${it.id}: 可用于制作缺「量产阶梯」`)
    } else {
      if (!lines.includes('做成')) gBad.push(`${it.id}: 详细作用缺「做成…作品」`)
      if (!uses.some((u) => u.kind === 'work')) gBad.push(`${it.id}: 可用于制作缺作品`)
    }
  }
  check('副业四支', '图鉴三查：详细作用 / 可用于制作（基底→作品、加密档→量产阶梯）/ 获取来源 三处齐全', gBad.length === 0, gBad.slice(0, 4).join('; '))
  check('副业四支', '四个技能的中文名都在效果总览的 SKILL_CN 里（文案不露内部 id）',
    SIDELINE_SKILL_IDS.every((id) => !!SKILL_CN[id]))
  check('副业四支', '效果总览登记了四条副业效果行（一个都不能漏）',
    SIDELINE_SKILL_IDS.every((id) => EFFECT_ROWS.some((r) => (r.view ?? '').endsWith(id))))
  const gBad2 = []
  for (const s of SIDELINE_SKILL_LIST) {
    if (!GUILDS.some((g) => (g.tasks ?? []).some((t) => t.kind === 'skill' && t.param === s.id))) gBad2.push(`${s.id}: 公会无任务`)
    if (!DAILY_POOL.some((t) => t.param === s.id) && !WEEKLY_POOL.some((t) => t.param === s.id)) gBad2.push(`${s.id}: 每日/周常无任务`)
  }
  check('副业四支', '四支在公会与每日/周常任务里都有条目，且 param 是已注册技能',
    gBad2.length === 0 && SIDELINE_SKILL_IDS.every((id) => !!SKILL_DEFS[id]), gBad2.join('; '))
}

// ── C34. 副业量产阶梯（v2.11.0：产物按数量喂进深阶梯 —— 回答「练满级做出几十万件、绝大多数用不掉」）──
console.log('══ C34. 副业量产阶梯 ══')
{
  // ① 阶梯表本身：12 档、严格递增、末档 = 设计值、五支各一条（含木工）
  check('量产阶梯', `阶梯 ${LADDER_TIERS.length} 档、严格递增、末档 ${LADDER_TIERS.at(-1)}`,
    LADDER_TIERS.length === 12 && LADDER_TIERS.every((v, i) => i === 0 || v > LADDER_TIERS[i - 1]) && LADDER_TIERS.at(-1) === 250000)
  check('量产阶梯', '十六支各一条阶梯（含木工），档位增量均为正且轴合法',
    SIDELINE_LADDERS.length === 16 && SIDELINE_LADDERS.every((l) => l.perTier > 0 && !!LADDER_AXIS_LABEL[l.axis])
    && SIDELINE_LADDER_SKILL_IDS.includes('woodworking') && SIDELINE_LADDERS.every((l) => !!SKILL_DEFS[l.skill]))

  // ② 计点：按档位加权（Lv1 = 1、Lv91 = 10），五支（含木工）的产物都登记了点数与归属
  check('量产阶梯', '计点按档位加权：Lv1 = 1 点、Lv11 = 2 点、Lv91 = 10 点',
    pointsOfLevel(1) === 1 && pointsOfLevel(11) === 2 && pointsOfLevel(91) === 10)
  const prodBad = []
  for (const l of SIDELINE_LADDERS) {
    const list = SIDELINE_PRODUCTS[l.skill]
    if (!list || !list.length) { prodBad.push(`${l.skill}: 无产物表`); continue }
    for (const p of list) {
      if (!ITEMS[p.itemId]) prodBad.push(`${l.skill}:${p.itemId} 不存在`)
      if (!(p.points >= 1)) prodBad.push(`${l.skill}:${p.itemId} 点数非法`)
      if (sidelineSkillOfItem(p.itemId)?.skill !== l.skill) prodBad.push(`${p.itemId} 反查归属错`)
    }
  }
  check('量产阶梯', `十六支共 ${Object.values(SIDELINE_PRODUCTS).flat().length} 件产物都有点数与归属（含木工）`, prodBad.length === 0, prodBad.slice(0, 4).join('; '))

  // ③ 档位函数：边界与封顶
  check('量产阶梯', '档位函数：0 点 = 0 档、10 点 = 1 档、满档 = 12、超限值不越界',
    ladderTierOf(0) === 0 && ladderTierOf(9) === 0 && ladderTierOf(10) === 1 && ladderTierOf(250000) === 12 && ladderTierOf(9e9) === 12)
  check('量产阶梯', '下一档提示：未满给差值、已满返回 null',
    ladderNextOf(0).need === 10 && ladderNextOf(0).left === 10 && ladderNextOf(250000) === null)
  check('量产阶梯', '阶梯加成 = 档位 × 每档增量（末档合计与设计值一致）',
    SIDELINE_LADDERS.every((l) => ladderTotalOf(l.skill, 250000) === Math.round(l.perTier * 12 * 1000) / 1000))

  // ④ feedSideline：扣物品数 == 加点数、只增不减、空背包给原因、非法 id 不抛错
  const q = freshPlayer()
  q.inventory['pottery_1'] = 7
  q.inventory['pottery_91'] = 3
  const f1 = q.feedSideline('pottery')
  check('量产阶梯', '投入会真的扣掉产物并按档位加点（7×1 + 3×10 = 37 点）',
    f1.ok && f1.fed === 10 && f1.points === 37 && (q.inventory['pottery_1'] ?? 0) === 0 && (q.inventory['pottery_91'] ?? 0) === 0
    && q.sidelinePointsOf('pottery') === 37, JSON.stringify({ fed: f1.fed, points: f1.points }))
  check('量产阶梯', '投入只增不减（再投空背包不会减少点数）',
    (() => { const r = q.feedSideline('pottery'); return r.ok === false && r.reason === 'empty' && q.sidelinePointsOf('pottery') === 37 })())
  check('量产阶梯', '非法技能 id 返回 bad，不抛错',
    q.feedSideline('foraging').ok === false && q.feedSideline('不存在的技能').reason === 'bad')

  // ⑤ 🔑 **反「读当前技能等级」**（行为断言，比源码扫描稳）——
  //    prestigeSkill 会把满 100 级打出 carry=⌊100×0.05⌋=5 ⇒ 回到 6 级；
  //    若任何轴的派生读了「当前等级」，转生就会**自罚**（玩家会永远不敢转生这五支）。
  //    断言方式：把五支的等级全改成 1，六条轴的派生值必须**一分不变**。
  const rich = freshPlayer()
  rich.restaurant.menu = ['roastPotato']
  for (const l of SIDELINE_LADDERS) {
    rich.inventory[SIDELINE_PRODUCTS[l.skill][0].itemId] = 40
    rich.feedSideline(l.skill)
    rich.inventory[SIDELINE_PRODUCTS[l.skill][0].itemId] = 1
    rich.craftWork(SIDELINE_PRODUCTS[l.skill][0].itemId)
  }
  const axisSnapshot = (pl) => ['cellarValue', 'tipPct', 'michelinScore', 'nightHours', 'nightMult', 'decorPct']
    .map((a) => pl.sidelineEffectTotal(a)).join(',')
    + '|' + pl.cellarSlotValueMax() + '|' + pl.tipBonusPct() + '|' + pl.michelinSignScore() + '|'
    + pl.nightMarketMult().toFixed(3) + '|' + pl.restaurantHourlyIncome.toFixed(4)
  const beforeLevels = axisSnapshot(rich)
  for (const l of SIDELINE_LADDERS) rich.setSkillState(l.skill, { level: 1, exp: 0 })
  check('量产阶梯', '🔑 五支技能等级全改成 1 后，六条轴的派生值一分不变（**绝不读「当前技能等级」**——否则转生 = 自罚）',
    axisSnapshot(rich) === beforeLevels, `改前 ${beforeLevels.slice(0, 50)}… / 改后 ${axisSnapshot(rich).slice(0, 50)}…`)
  const prestige = freshPlayer()
  prestige.setSkillState('pottery', { level: 100, exp: totalXpForLevel(100) })
  const beforePrestige = prestige.cellarSlotValueMax()
  prestige.prestigeSkill('pottery')
  check('量产阶梯', '🔑 转生陶艺后（等级回落）地窖上限**不下降**，且还能继续投入阶梯',
    prestige.skills.pottery.prestiges === 1 && prestige.cellarSlotValueMax() === beforePrestige
    && (() => { prestige.inventory['pottery_1'] = 30; const r = prestige.feedSideline('pottery'); return r.ok && prestige.sidelinePointsOf('pottery') === 30 })(),
    `转生前 ${beforePrestige} → 转生后 ${prestige.cellarSlotValueMax()}`)

  // ⑥ 蜡烛：**时长**仍封顶 +8h（阶梯只加倍率、不加时长）
  const candle = freshPlayer()
  // 喂到**满档**（250,000 点）：用蜡烛最高档产物（Lv85 = 9 点/件）
  const candleTop = SIDELINE_PRODUCTS.candles.slice(-1)[0]
  candle.inventory[candleTop.itemId] = Math.ceil(LADDER_TIERS.at(-1) / candleTop.points)
  candle.feedSideline('candles')
  check('量产阶梯', `蜡烛阶梯只加**倍率**、不加时长（时长仍封顶 +${NIGHT_MARKET_MAX_EXTRA_HOURS}h；倍率 ×2 → ×${candle.nightMarketMult().toFixed(2)}）`,
    candle.nightMarketExtraHours() === 0 && candle.sidelineLadderTier('candles') === LADDER_TIERS.length
    && candle.nightMarketMult() === NIGHT_MARKET_BASE_MULT + NIGHT_MARKET_MAX_EXTRA_MULT)
  check('量产阶梯', '蜡烛倍率真的进了聚合乘区，且只在该窗口生效（13:00 不命中夜市）', (() => {
    const ev = candle.marketEventsNow()
    return ev.find((e) => e.id === 'nightMarket').effect.restaurant === candle.nightMarketMult()
      && activeMarketEventsPure(13, 1, ev).every((e) => e.id !== 'nightMarket')
      && activeMarketEventsPure(17, 1, ev).some((e) => e.id === 'nightMarket')
  })())
  check('量产阶梯', '基础活动表（MARKET_EVENTS）未被就地改写（延长/加倍的都只是副本）',
    MARKET_EVENTS.find((e) => e.id === 'nightMarket').effect.restaurant === 2
    && JSON.stringify(MARKET_EVENTS.find((e) => e.id === 'nightMarket').hours) === '[[16,22]]')

  // ⑦ 硬顶：陶艺满配（作品 15,000 + 阶梯 9,000）== CELLAR_SLOT_VALUE_MAX
  const cap = freshPlayer()
  for (const it of SIDELINE_ITEMS.filter((x) => x.category === 'pottery')) { cap.inventory[it.id] = 1; cap.craftWork(it.id) }
  cap.inventory['pottery_91'] = 25000
  cap.feedSideline('pottery')
  check('量产阶梯', `陶艺满配（作品 + 阶梯）正好等于地窖硬顶 ${CELLAR_SLOT_VALUE_MAX.toLocaleString()}，不越界`,
    cap.cellarSlotValueMax() === CELLAR_SLOT_VALUE_MAX)

  // ⑧ 存档：随 stats 往返、旧档回退 0、脏值不炸
  const save = JSON.stringify(q.serialize())
  const back = freshPlayer()
  back.applySave(JSON.parse(save))
  check('量产阶梯', '累计点随存档往返无损（stats.sidelinePoints）', back.sidelinePointsOf('pottery') === 37 && JSON.stringify(back.serialize()) === save)
  const old = freshPlayer()
  old.applySave({ gold: 100 })
  check('量产阶梯', '旧档缺 sidelinePoints → 五支全 0、不报错',
    SIDELINE_LADDER_SKILL_IDS.every((s) => old.sidelinePointsOf(s) === 0) && old.sidelineLadderTier('pottery') === 0)
  const junk = freshPlayer()
  junk.applySave({ stats: { sidelinePoints: { pottery: '哈哈', weaving: -5, candles: null } } })
  check('量产阶梯', '存档里是字符串/负数/null 时不炸且不产生 NaN',
    Number.isFinite(junk.cellarSlotValueMax()) && Number.isFinite(junk.sidelineEffectTotal('tipPct')))

  // ⑨ 效果总览登记（含木工那条）+ 图鉴三查（kind:'ladder'）
  check('量产阶梯', '效果总览登记了五条副业效果行（四支 + 木工阶梯，一个都不能漏）',
    SIDELINE_LADDER_SKILL_IDS.every((id) => EFFECT_ROWS.some((r) => (r.view ?? '').endsWith(id))))
  const uBad = []
  for (const l of SIDELINE_LADDERS) for (const p of SIDELINE_PRODUCTS[l.skill]) {
    const lines = itemDetailLines(p.itemId).map((x) => x.join('')).join('|')
    if (!lines.includes('量产阶梯')) uBad.push(`${p.itemId}: 详细作用缺量产阶梯`)
    if (!itemUses(p.itemId).some((u) => u.kind === 'ladder')) uBad.push(`${p.itemId}: 可用于制作缺阶梯`)
  }
  check('量产阶梯', '图鉴三查：全部产物（含木工 10 件木器）都登记了「量产阶梯」用途', uBad.length === 0, uBad.slice(0, 4).join('; '))

  // ⑩ 面板源码断言（防「数据加了页面没接」这类静默失效）
  const panelSrc2 = fs.readFileSync(new URL('../../src/components/SidelineWorkPanel.vue', import.meta.url), 'utf8')
  check('量产阶梯', '作品面板真的接了阶梯（含「投入」动作与档位展示）',
    panelSrc2.includes('feedSideline(') && panelSrc2.includes('sidelineLadderTier(') && panelSrc2.includes('LADDER_TIERS'))
  // 木工也必须有作品层（2026-09-17 用户实测报「木工这里虚线上面没显示」：
  //  木工原先没有作品层，只剩一条悬空的虚线。现补上「木器 → 手工装潢」的就地入口，这里钉住它别再消失）
  check('量产阶梯', '作品面板对木工也有作品层（走 craftDecor，不是 craftWork），且分隔虚线只在真有作品层时出现',
    panelSrc2.includes('craftDecor(') && panelSrc2.includes('isWoodworking') && panelSrc2.includes('sw-ladder--sep')
    && panelSrc2.includes("rows.length > 0"))
  // 副业页**平铺**（2026-09-17 用户要求「副业的卡片去掉等级段分类和折叠，因为物品不多」）：
  // 产物只有 8~10 件，按等级段切十段 + 默认全部折叠 = 每次进来都看不到东西。
  const prodSrc = fs.readFileSync(new URL('../../src/views/ProductionView.vue', import.meta.url), 'utf8')
  // ⚠️ 2026-09-19：等级段体系由「折叠手风琴」改成「顶部标签页」(
  //    `v-if="!flatMode && sections.length > 1"` 的 .era-tabs + 只渲染 activeSec) ⇒ 这里跟着改判据；
  //    副业要保证的仍是「不切段、不折叠、一次全平铺」。
  check('量产阶梯', '副业制作页走平铺（不分等级段、不折叠、隐藏等级段标签栏），且十六支都在平铺名单里',
    prodSrc.includes('flatMode') && prodSrc.includes('SIDELINE_LADDER_SKILL_IDS')
    && prodSrc.includes('v-if="!flatMode && sections.length > 1"')
    && !prodSrc.includes('toggleSection') && !prodSrc.includes('isOpen(')
    && SIDELINE_LADDER_SKILL_IDS.length === 16)

  // ⑪ **比值守卫**（把「满加成后会不会平衡崩坏」变成可执行断言）：
  //    对每条轴算「满配/空配」的放大，超阈值即 FAIL —— 以后谁想把某一支偷偷调高一档，CI 直接拦住。
  const RICH = freshPlayer()
  RICH.restaurant.menu = ['roastPotato']
  for (const l of SIDELINE_LADDERS) {
    for (const p of SIDELINE_PRODUCTS[l.skill]) { RICH.inventory[p.itemId] = 1; if (p.itemId in SIDELINE_WORKS) RICH.craftWork(p.itemId) }
    const top = SIDELINE_PRODUCTS[l.skill].slice(-1)[0]
    RICH.inventory[top.itemId] = Math.ceil(LADDER_TIERS.at(-1) / top.points)
    RICH.feedSideline(l.skill)
  }
  const ratioRow = []
  const ratioBad = []
  const ratios = [
    ['装潢加成%(木工)', RICH.sidelineLadderTotal('decorPct'), 24, 1.25],
    ['小费%(编织)', RICH.sidelineLadderTotal('tipPct'), 18, 1.6],
    ['夜市倍率倍数(蜡烛)', RICH.nightMarketMult() / NIGHT_MARKET_BASE_MULT, 1.18, 1.25],
  ]
  for (const [name, got, expect, capMul] of ratios) {
    ratioRow.push(`${name} ${got.toFixed(2)}`)
    if (!(got <= expect * capMul + 1e-9) || !(got >= expect * 0.9)) ratioBad.push(`${name}=${got}（设计≈${expect}，上限 ${capMul}×）`)
  }
  ratioRow.push(`地窖上限 ${RICH.cellarSlotValueMax()}`)
  if (RICH.cellarSlotValueMax() !== CELLAR_SLOT_VALUE_MAX) ratioBad.push(`地窖上限 ${RICH.cellarSlotValueMax()} ≠ 硬顶 ${CELLAR_SLOT_VALUE_MAX}`)
  const signPct = RICH.michelinSignScore() / 620 // 3★ 门槛
  ratioRow.push(`招牌占3★ ${(signPct * 100).toFixed(0)}%`)
  // 2026-09-30 T3「同物变体」给刺绣 +3 作品（+36 分）⇒ 占比 43%→48%；
  // 阈值回到设计的**原始意图 50%**（「副业招牌分**不满三星的一半**，不能独自把招牌刷满」）。
  if (!(signPct <= 0.5)) ratioBad.push(`招牌分占 3★ 门槛 ${(signPct * 100).toFixed(0)}% > 50%`)
  check('量产阶梯', `比值守卫：五条轴的满配放大都在阈值内（${ratioRow.join(' · ')}）`, ratioBad.length === 0, ratioBad.join('; '))
}

// ── C35. 副业第二批「干净轴」五支（v2.12.0：制箭/制网/香道/年货/玉作）──
console.log('══ C35. 副业干净轴五支 ══')
{
  const NEW5 = ['fletching', 'netmaking', 'incense', 'festivalGoods', 'jadecraft']
  const AXIS_OF = { fletching: 'huntSavePct', netmaking: 'rareFishPP', incense: 'orderSpeedPct', festivalGoods: 'festivalPct', jadecraft: 'gemPct' }

  // ① 五支都已注册、各有 10 件产物与一条阶梯、类别在独占清单内
  const bad = []
  for (const id of NEW5) {
    const inst = getSkillInstance(id)
    const def = SKILL_DEFS[id]
    if (inst?.type !== 'production') bad.push(`${id}: 实例非 production`)
    if (!def || def.category !== 'sideline') bad.push(`${id}: 不在 sideline`)
    if (!def?.icon || def.icon === '•') bad.push(`${id}: 缺图标`)
    // 15 = 10 基底 + 2 补档 + 3 同物变体；v2.29.7 档位加密再 +9（Lv1~91 的平原做成 5 级/件）
    if ((SIDELINE_PRODUCTS[id] ?? []).length !== 24) bad.push(`${id}: 产物数 ${SIDELINE_PRODUCTS[id]?.length}`)
    if (!SIDELINE_LADDERS.some((l) => l.skill === id && l.axis === AXIS_OF[id])) bad.push(`${id}: 阶梯/轴不对`)
    if (!SIDELINE_AXES[AXIS_OF[id]]) bad.push(`${id}: 轴 ${AXIS_OF[id]} 未定义`)
  }
  check('干净轴五支', '五支都已注册（production / sideline / 图标 / 24 件产物 / 各一条阶梯；补档 +2、T3 变体 +3、加密档 +9）', bad.length === 0, bad.join('; '))
  check('干净轴五支', '五支的 120 件产物都有图片，且五个新类别都在「副业独占清单」里（否则会漏进抽卡/礼包池）',
    NEW5.every((id) => SIDELINE_PRODUCTS[id].every((p) => imgExists(p.itemId)))
    && ['huntingGear', 'fishingGear', 'incense', 'gift', 'jade'].every((c) => SIDELINE_ITEM_CATEGORIES.includes(c) && SELL_EXCLUDED_CATEGORIES.includes(c)))

  // ② 🔑 每条轴都真的接上了：满配后**实际读取点**必须变化
  const rich5 = freshPlayer()
  rich5.restaurant.menu = ['roastPotato']
  for (const id of NEW5) {
    for (const p of SIDELINE_PRODUCTS[id]) { rich5.inventory[p.itemId] = 1; rich5.craftWork(p.itemId) }
    const top = SIDELINE_PRODUCTS[id].slice(-1)[0]
    rich5.inventory[top.itemId] = Math.ceil(LADDER_TIERS.at(-1) / top.points)
    rich5.feedSideline(id)
  }
  const hunt = getSkillInstance('hunting')
  const fish = getSkillInstance('fishing')
  check('干净轴五支', `制箭已接上狩猎（省箭 ${(hunt.ammoSaveChance * 100).toFixed(0)}%，设计 ≈38%）`, hunt.ammoSaveChance > 0.36 && hunt.ammoSaveChance <= 0.9)
  check('干净轴五支', `制网已接上垂钓（稀有率 ${(fish.rareChance * 100).toFixed(2)}%，设计 ≈0.47%）`, fish.rareChance > 0.004 && fish.rareChance <= 0.05)
  check('干净轴五支', `香道已接上订单到访（提速 +${rich5.sidelineEffectTotal('orderSpeedPct')}%，设计 ≈27%）`, rich5.sidelineEffectTotal('orderSpeedPct') > 25)
  check('干净轴五支', `年货已接上节庆（放大 +${rich5.sidelineEffectTotal('festivalPct')}%，设计 ≈19.6%）`, rich5.sidelineEffectTotal('festivalPct') > 19)
  check('干净轴五支', `玉作已接上宝石（+${rich5.sidelineEffectTotal('gemPct')}%，设计 ≈33%）`, rich5.sidelineEffectTotal('gemPct') > 32)

  // ③ 行为断言：不只是「数值存在」，要真的改变行为
  check('干净轴五支', '省箭真的放宽了离线动作上限（同样 100 个陷阱 → 期望动作数更多，且扣箭不超过持有）', (() => {
    // ⚠️ 狩猎首个目标要 Lv8 ⇒ 必须给足等级，否则 computeOffline 直接返回 null（新档 Lv1 测不出来）
    // ⚠️ 新档没有选目标 ⇒ currentTarget 为 null ⇒ computeOffline 直接返回 null（设计如此：先选目标才有产出）
    const a = freshPlayer({ hunting: 50 }); a.inventory.trap = 100; createSkillInstances(a)
    a.setSkillTarget('hunting', getSkillInstance('hunting').targets[0].itemId)
    const bare = getSkillInstance('hunting').computeOffline(3600_000, 0.8)
    const b2 = freshPlayer({ hunting: 50 }); b2.inventory.trap = 100
    for (const p of SIDELINE_PRODUCTS.fletching) { b2.inventory[p.itemId] = 1; b2.craftWork(p.itemId) }
    createSkillInstances(b2)
    b2.setSkillTarget('hunting', getSkillInstance('hunting').targets[0].itemId)
    const withSave = getSkillInstance('hunting').computeOffline(3600_000, 0.8)
    return !!bare && !!withSave && withSave.actions > bare.actions && withSave.consumed.trap <= 100
  })())
  check('干净轴五支', '年货只放大节庆的**增益**、对任何 ≤1 的值一分不动（不会被减益反向放大）', (() => {
    // ⚠️ 不能用 freshPlayer()：它把 festivalBoost **打桩成「无节庆」**（返回全 1），会把本断言测成恒真/恒假
    setActivePinia(createPinia())
    const p2 = usePlayerStore()
    p2.newGame()
    p2.stats.sidelinePoints = { ...p2.stats.sidelinePoints, festivalGoods: LADDER_TIERS.at(-1) }
    const d = new Date(2026, 0, 1) // 01-01 开市日 ×1.5
    const raw = festivalBoost(d)
    const boosted = p2.festivalBoost(d)
    const gains = Object.keys(raw).filter((k) => typeof raw[k] === 'number' && raw[k] > 1)
    return gains.length > 0 && gains.every((k) => boosted[k] > raw[k])
      && Object.keys(raw).every((k) => !(typeof raw[k] === 'number' && raw[k] <= 1) || boosted[k] === raw[k])
  })())
  // ⚠️ 采样量必须够大：理论比值 1/1.27 = 0.7874，与阈值 0.8 只差 1.6%。
  //    原先取 300 时均值相对标准误 ≈ 2.4% ⇒ **约 13% 的概率误报 FAIL**（2026-09-18 实测 400 次试验
  //    不达标的占 13%，而中位数 0.7875 完全正确）——CI 会因此随机变红。
  //    20000 次把标准误压到 ~0.3%，阈值外还有 ~4σ，误报率降到万分之一量级。
  check('干净轴五支', '订单到访间隔真的缩短（提速 27% → 均值缩短 ≥20%；单次抽样是随机的，故比均值）', (() => {
    const N = 20000
    let a = 0
    let b = 0
    for (let i = 0; i < N; i++) { a += nextOrderDelay(0); b += nextOrderDelay(27) }
    return b / a < 0.8
  })())

  // ④ 五支都不读「当前技能等级」（与 C34 同口径的行为断言）
  const snap = (pl) => NEW5.map((id) => pl.sidelineEffectTotal(AXIS_OF[id])).join(',') + '|' + getSkillInstance('hunting').ammoSaveChance
  const before5 = snap(rich5)
  for (const id of NEW5) rich5.setSkillState(id, { level: 1, exp: 0 })
  check('干净轴五支', '🔑 五支等级全改成 1 后，五条轴的派生值与省箭率一分不变（绝不读「当前技能等级」）',
    snap(rich5) === before5, `${before5} → ${snap(rich5)}`)

  // ⑤ 比值守卫（与 C34 同口径，五条新轴）
  const rows = []
  const badR = []
  for (const [name, got, expect, cap, unit] of [
    // ⚠️ 设计值 2026-09-30 随 T3「同物变体」上移（每支作品 12 → 15 件 ⇒ 各轴满配 ×1.25；
    //    与 2026-09-29 补档同一次处置：内容增加带来的轴增长，按实测值刷新设计基线）。
    ['省箭%', rich5.sidelineEffectTotal('huntSavePct'), 48, 1.15, '%'],
    // ⚠️ 分母必须走**同一个难度系数出口**：写死的 0.005 是难度系数引入前的基准值，
    //    不改会算出 0.0047/0.005 = 0.94× 这种假倍数（同 system_test2 的公会 buff 那条坑）
    ['稀有率倍数', fish.rareChance / otherChance(0.005), 2.08, 1.15, '×'],
    ['订单提速%', rich5.sidelineEffectTotal('orderSpeedPct'), 34.5, 1.2, '%'],
    ['节庆放大%', rich5.sidelineEffectTotal('festivalPct'), 24.6, 1.2, '%'],
    ['宝石效果%', rich5.sidelineEffectTotal('gemPct'), 40.5, 1.3, '%'],
  ]) {
    rows.push(`${name} ${got.toFixed(2)}${unit}`)
    if (!(got <= expect * cap + 1e-6) || !(got >= expect * 0.9)) badR.push(`${name}=${got}（设计≈${expect}，上限 ${cap}×）`)
  }
  check('干净轴五支', `比值守卫：五条新轴的满配放大都在阈值内（${rows.join(' · ')}）`, badR.length === 0, badR.join('; '))

  // ⑥ 存档往返 + 旧档回退
  const save5 = JSON.stringify(rich5.serialize())
  const back5 = freshPlayer()
  back5.applySave(JSON.parse(save5))
  check('干净轴五支', '五支的累计点随存档往返无损，且旧档回退 0',
    NEW5.every((id) => back5.sidelinePointsOf(id) === rich5.sidelinePointsOf(id))
    && (() => { const o = freshPlayer(); o.applySave({ gold: 1 }); return NEW5.every((id) => o.sidelinePointsOf(id) === 0) })())

  // ⑦ 内容同步：图鉴三查 + 效果总览 + 任务
  const g5 = []
  for (const id of NEW5) for (const p of SIDELINE_PRODUCTS[id]) {
    if (!itemUses(p.itemId).some((u) => u.kind === 'ladder')) g5.push(`${p.itemId}: 缺阶梯用途`)
    if (!itemSources(p.itemId).some((s) => s.includes(SKILL_DEFS[id].name))) g5.push(`${p.itemId}: 来源缺技能名`)
  }
  check('干净轴五支', '图鉴三查：50 件产物的「可用于制作（阶梯）」与「获取来源（技能名）」都齐备', g5.length === 0, g5.slice(0, 4).join('; '))
  check('干净轴五支', '效果总览登记了五条新行（一个都不能漏）',
    NEW5.every((id) => EFFECT_ROWS.some((r) => (r.view ?? '').endsWith(id))))
  check('干净轴五支', '五支在公会与每日/周常任务里都有条目',
    NEW5.every((id) => GUILDS.some((g) => (g.tasks ?? []).some((t) => t.param === id)))
    && NEW5.every((id) => DAILY_POOL.some((t) => t.param === id) || WEEKLY_POOL.some((t) => t.param === id)))
}

// ── C36. 副业 v2.13.0 第二批（货签 → 交易所卖出价 / 采掘器具 → 采矿附产）──
console.log('══ C36. 副业第二批二支 ══')
{
  const NEW2 = ['goodsTag', 'miningGear']
  const AXIS2 = { goodsTag: 'tagSellPct', miningGear: 'miningExtraPP' }

  // ① 注册与数据
  const bad = []
  for (const id of NEW2) {
    const inst = getSkillInstance(id)
    if (inst?.type !== 'production') bad.push(`${id}: 实例非 production`)
    if (SKILL_DEFS[id]?.category !== 'sideline') bad.push(`${id}: 不在 sideline`)
    if (!SKILL_DEFS[id]?.icon || SKILL_DEFS[id].icon === '•') bad.push(`${id}: 缺图标`)
    if ((SIDELINE_PRODUCTS[id] ?? []).length !== 24) bad.push(`${id}: 产物数不为 24（补档 +2、T3 变体 +3、加密档 +9）`)
    if (!SIDELINE_LADDERS.some((l) => l.skill === id && l.axis === AXIS2[id])) bad.push(`${id}: 阶梯/轴不对`)
    if (!SIDELINE_PRODUCTS[id].every((p) => imgExists(p.itemId))) bad.push(`${id}: 缺图`)
  }
  check('第二批二支', '两支都已注册（production / sideline / 图标 / 24 件产物 / 各一条阶梯 / 图片齐备）', bad.length === 0, bad.join('; '))
  check('第二批二支', '两个新类别都在「副业独占清单」里（否则会漏进抽卡/礼包池，v2.12.0 踩过）',
    ['goodsTag', 'miningGear'].every((c) => SIDELINE_ITEM_CATEGORIES.includes(c) && SELL_EXCLUDED_CATEGORIES.includes(c)))

  // ② 🔑 两条轴都真的接上了（满配后读取点变化）
  const rich2 = freshPlayer({ mining: 60 })
  rich2.restaurant.menu = ['roastPotato']
  for (const id of NEW2) {
    for (const p of SIDELINE_PRODUCTS[id]) { rich2.inventory[p.itemId] = 1; rich2.craftWork(p.itemId) }
    const top = SIDELINE_PRODUCTS[id].slice(-1)[0]
    rich2.inventory[top.itemId] = Math.ceil(LADDER_TIERS.at(-1) / top.points)
    rich2.feedSideline(id)
  }
  const tagPct = rich2.sidelineEffectTotal('tagSellPct')
  check('第二批二支', `货签已接上交易所（卖出价 +${tagPct}%，设计 ≈33%）`, tagPct > 32)
  // 卖出价：同一件物品、同一期次，加成前后必须更高
  const goods = { id: 'apple', value: 100 }
  check('第二批二支', '交易所卖出价真的变高（同物品同期次对比），且买入价随之水涨船高（价差口径不变）', (() => {
    const base = sellPriceOf(goods, 7, 0)
    const boosted = sellPriceOf(goods, 7, tagPct)
    const buyBase = buyPriceOf(goods, 7)
    return boosted > base && buyBase > base
  })())
  check('第二批二支', '卖出价加成被夹在 0~50%（极端存档值不会把卖出价拉爆）',
    sellPriceOf(goods, 7, 9999) === sellPriceOf(goods, 7, 50) && sellPriceOf(goods, 7, -5) === sellPriceOf(goods, 7, 0))

  // ③ 采矿附产：**只对采矿生效**，且在线/离线同源
  const mine = getSkillInstance('mining')
  const mineChance = mine.yieldExtraChance()
  const nonMine = getSkillInstance('foraging').yieldExtraChance()
  check('第二批二支', `采矿附产已接上（采矿额外产出几率 ${mineChance.toFixed(2)} ≥ 0.38；**其它采集线不受影响**）`,
    mineChance >= 0.37 && nonMine < mineChance)
  check('第二批二支', '采矿附产是**在线/离线同源**的（两者都读 yieldExtraChance ⇒ expectedYield 同步变化）', (() => {
    const a = freshPlayer({ mining: 60 })
    a.setActiveSkill('mining'); createSkillInstances(a)
    const bare = getSkillInstance('mining').expectedYield()
    const b2 = freshPlayer({ mining: 60 }); b2.setActiveSkill('mining')
    for (const p of SIDELINE_PRODUCTS.miningGear) { b2.inventory[p.itemId] = 1; b2.craftWork(p.itemId) }
    createSkillInstances(b2)
    return getSkillInstance('mining').expectedYield() > bare
  })())

  // ④ 不读当前等级
  const snap = (pl) => NEW2.map((id) => pl.sidelineEffectTotal(AXIS2[id])).join(',')
  const before2 = snap(rich2)
  for (const id of NEW2) rich2.setSkillState(id, { level: 1, exp: 0 })
  check('第二批二支', '🔑 两支等级改成 1 后，两条轴的派生值一分不变（绝不读「当前技能等级」）', snap(rich2) === before2)

  // ⑤ 比值守卫
  const rows = []
  const badR = []
  for (const [name, got, expect, cap] of [
    // 设计值同 T3 上移（作品 12 → 15）
    ['卖出价%', tagPct, 40.5, 1.2],
    ['采矿附产%', rich2.sidelineEffectTotal('miningExtraPP'), 48, 1.15],
  ]) {
    rows.push(`${name} ${got}`)
    if (!(got <= expect * cap) || !(got >= expect * 0.9)) badR.push(`${name}=${got}（设计≈${expect}）`)
  }
  check('第二批二支', `比值守卫：两条新轴在阈值内（${rows.join(' · ')}）`, badR.length === 0, badR.join('; '))

  // ⑥ 存档 / 图鉴三查 / 效果总览 / 任务
  const save2 = JSON.stringify(rich2.serialize())
  const back2 = freshPlayer()
  back2.applySave(JSON.parse(save2))
  check('第二批二支', '累计点随存档往返无损，旧档回退 0',
    NEW2.every((id) => back2.sidelinePointsOf(id) === rich2.sidelinePointsOf(id))
    && (() => { const o = freshPlayer(); o.applySave({ gold: 1 }); return NEW2.every((id) => o.sidelinePointsOf(id) === 0) })())
  const g2 = []
  for (const id of NEW2) for (const p of SIDELINE_PRODUCTS[id]) {
    if (!itemUses(p.itemId).some((u) => u.kind === 'ladder')) g2.push(`${p.itemId}: 缺阶梯用途`)
    if (!itemSources(p.itemId).some((s) => s.includes(SKILL_DEFS[id].name))) g2.push(`${p.itemId}: 来源缺技能名`)
  }
  check('第二批二支', '图鉴三查：20 件产物的「可用于制作（阶梯）」与「获取来源（技能名）」齐备', g2.length === 0, g2.slice(0, 4).join('; '))
  check('第二批二支', '效果总览登记了两条新行（货签 / 采掘器具，一个都不能漏）',
    NEW2.every((id) => EFFECT_ROWS.some((r) => (r.view ?? '').endsWith(id))))
  check('第二批二支', '两支在公会与每日/周常任务里都有条目',
    NEW2.every((id) => GUILDS.some((g) => (g.tasks ?? []).some((t) => t.param === id)))
    && NEW2.every((id) => DAILY_POOL.some((t) => t.param === id) || WEEKLY_POOL.some((t) => t.param === id)))
}

// ── C37. 副业 v2.14.0 第三批（造纸/乐器/制皂/钱庄）—— 四支都接在**既有系统的既有数值**上 ──
console.log('══ C37. 副业第三批四支 ══')
{
  const NEW4 = ['papermaking', 'instrument', 'soapmaking', 'exchequer']
  const AXIS4 = { papermaking: 'apprenticePP', instrument: 'favorGainPct', soapmaking: 'orderGoldPct', exchequer: 'goldGainPct' }

  // ① 注册与数据
  const bad = []
  for (const id of NEW4) {
    if (getSkillInstance(id)?.type !== 'production') bad.push(`${id}: 实例非 production`)
    if (SKILL_DEFS[id]?.category !== 'sideline') bad.push(`${id}: 不在 sideline`)
    if (!SKILL_DEFS[id]?.icon || SKILL_DEFS[id].icon === '•') bad.push(`${id}: 缺图标`)
    if ((SIDELINE_PRODUCTS[id] ?? []).length !== 24) bad.push(`${id}: 产物数不为 24（补档 +2、T3 变体 +3、加密档 +9）`)
    if (!SIDELINE_LADDERS.some((l) => l.skill === id && l.axis === AXIS4[id])) bad.push(`${id}: 阶梯/轴不对`)
    if (!SIDELINE_PRODUCTS[id].every((p) => imgExists(p.itemId))) bad.push(`${id}: 缺图`)
  }
  check('第三批四支', '四支都已注册（production / sideline / 图标 / 24 件产物 / 各一条阶梯 / 图片齐备）', bad.length === 0, bad.join('; '))
  check('第三批四支', '四个新类别都在「副业独占清单」里（否则会漏进抽卡/礼包池）',
    ['stationery', 'instrument', 'soap', 'voucher'].every((c) => SIDELINE_ITEM_CATEGORIES.includes(c) && SELL_EXCLUDED_CATEGORIES.includes(c)))

  // ② 满配（作品 + 阶梯）
  const rich4 = freshPlayer({ cooking: 5 })
  rich4.restaurant.menu = ['roastPotato']
  // 徒弟要练满（否则基础加成是 0，测不出「上限被顶到 20% 以上」）
  rich4.legacy.apprentice.level = APPRENTICE_MAX_LEVEL
  for (const id of NEW4) {
    for (const p of SIDELINE_PRODUCTS[id]) { rich4.inventory[p.itemId] = 1; rich4.craftWork(p.itemId) }
    const top = SIDELINE_PRODUCTS[id].slice(-1)[0]
    rich4.inventory[top.itemId] = Math.ceil(LADDER_TIERS.at(-1) / top.points)
    rich4.feedSideline(id)
  }

  // ③ 四条轴都真的接上了（读**实际数值**，不只是派生值）
  check('第三批四支', `造纸已接上师徒（徒弟离线效率 ${(rich4.apprenticeOfflineBonus() * 100).toFixed(1)}% > 基础封顶 20%）`,
    rich4.apprenticeOfflineBonus() > 0.2 && rich4.apprenticeOfflineBonus() <= 0.4)
  check('第三批四支', `乐器已接上好感（增速 +${rich4.sidelineEffectTotal('favorGainPct')}%，设计 ≈27%）`, rich4.sidelineEffectTotal('favorGainPct') > 26)
  check('第三批四支', '好感写入**收敛到唯一出口 favorGain**（源码里不再有绕过它的直写）', (() => {
    const src = fs.readFileSync(new URL('../../src/stores/player.js', import.meta.url), 'utf8')
    // 允许 favorGain 内部那一处，其余直写一律算漏网
    const direct = [...src.matchAll(/favor\.xp = /g)].length
    return direct === 1 && src.includes('favorGain(n)')
  })())
  check('第三批四支', '好感倍率真的生效（同样事件，满配比空档涨得多）', (() => {
    const a = freshPlayer({ cooking: 5 })
    const b2 = freshPlayer({ cooking: 5 })
    b2.stats.sidelinePoints = { ...b2.stats.sidelinePoints, instrument: LADDER_TIERS.at(-1) }
    a.favorGain(100)
    b2.favorGain(100)
    return b2.restaurant.favor.xp > a.restaurant.favor.xp
  })())
  check('第三批四支', `制皂已接上订单赏金（+${rich4.sidelineEffectTotal('orderGoldPct')}%，设计 ≈19.6%）`, rich4.sidelineEffectTotal('orderGoldPct') > 19)
  check('第三批四支', '订单赏金真的进了 makeOrder（同玩家、多次取均值，满配更高）', (() => {
    const a = freshPlayer({ cooking: 5 })
    a.restaurant.menu = ['roastPotato']; a.inventory.roastPotato = 50
    const b2 = freshPlayer({ cooking: 5 })
    b2.restaurant.menu = ['roastPotato']; b2.inventory.roastPotato = 50
    b2.stats.sidelinePoints = { ...b2.stats.sidelinePoints, soapmaking: LADDER_TIERS.at(-1) }
    let sa = 0; let sb = 0
    for (let i = 0; i < 300; i++) {
      sa += makeOrder(a, a.sidelineEffectTotal('orderGoldPct'))?.reward ?? 0
      sb += makeOrder(b2, b2.sidelineEffectTotal('orderGoldPct'))?.reward ?? 0
    }
    return sb > sa
  })())
  // ⚠️ 钱庄要「10 件作品 + 12 档阶梯」齐全才到 15.2%（只看阶梯是 7.2%）——这正是夹取的用武之地
  check('第三批四支', `钱庄已接上金币获取（派生 ${rich4.sidelineEffectTotal('goldGainPct').toFixed(1)}% → 出口夹到 ${rich4.goldGainPct()}%，实际到账同口径）`, (() => {
    const g0 = rich4.gold
    rich4.gainGold(1000)
    return rich4.goldGainPct() === 15 && rich4.sidelineEffectTotal('goldGainPct') > 15 && rich4.gold - g0 === 1150
  })())
  check('第三批四支', '金币获取被夹在 15% 内（存档里阶梯点塞到天文数字也不会通胀）', (() => {
    const p2 = freshPlayer()
    p2.stats.sidelinePoints = { ...p2.stats.sidelinePoints, exchequer: 999999999 }
    const g0 = p2.gold
    p2.gainGold(1000)
    // 阶梯封顶 12 档 ⇒ 7.2%；再把作品补齐才到 15.2%，两者都不超过 15%
    return p2.goldGainPct() <= 15 && p2.gold - g0 === 1072
  })())

  // ④ 不读当前等级
  const snap = (pl) => NEW4.map((id) => pl.sidelineEffectTotal(AXIS4[id])).join(',') + '|' + pl.apprenticeOfflineBonus().toFixed(4)
  const before4 = snap(rich4)
  for (const id of NEW4) rich4.setSkillState(id, { level: 1, exp: 0 })
  check('第三批四支', '🔑 四支等级改成 1 后，四条轴与徒弟效率一分不变（绝不读「当前技能等级」）', snap(rich4) === before4)

  // ⑤ 比值守卫
  const rows = []
  const badR = []
  for (const [name, got, expect, cap] of [
    // 设计值同 T3 上移（作品 12 → 15）
    ['徒弟效率pp', rich4.sidelineEffectTotal('apprenticePP'), 18, 1.4],
    ['好感增速%', rich4.sidelineEffectTotal('favorGainPct'), 34.5, 1.2],
    ['订单赏金%', rich4.sidelineEffectTotal('orderGoldPct'), 24.6, 1.25],
    ['金币获取%', rich4.sidelineEffectTotal('goldGainPct'), 19.2, 1.0], // 出口仍夹 15%，这里比的是**轴合计**
  ]) {
    rows.push(`${name} ${got}`)
    if (!(got <= expect * cap + 1e-6)) badR.push(`${name}=${got} 超阈值（设计≈${expect}，上限 ${cap}×）`)
  }
  check('第三批四支', `比值守卫：四条新轴都在阈值内（${rows.join(' · ')}）`, badR.length === 0, badR.join('; '))

  // ⑥ 存档 / 图鉴三查 / 效果总览 / 任务
  const save4 = JSON.stringify(rich4.serialize())
  const back4 = freshPlayer()
  back4.applySave(JSON.parse(save4))
  check('第三批四支', '累计点随存档往返无损，旧档回退 0',
    NEW4.every((id) => back4.sidelinePointsOf(id) === rich4.sidelinePointsOf(id))
    && (() => { const o = freshPlayer(); o.applySave({ gold: 1 }); return NEW4.every((id) => o.sidelinePointsOf(id) === 0) })())
  const g4 = []
  for (const id of NEW4) for (const p of SIDELINE_PRODUCTS[id]) {
    if (!itemUses(p.itemId).some((u) => u.kind === 'ladder')) g4.push(`${p.itemId}: 缺阶梯用途`)
    if (!itemSources(p.itemId).some((s) => s.includes(SKILL_DEFS[id].name))) g4.push(`${p.itemId}: 来源缺技能名`)
  }
  check('第三批四支', '图鉴三查：40 件产物的「可用于制作（阶梯）」与「获取来源（技能名）」齐备', g4.length === 0, g4.slice(0, 4).join('; '))
  check('第三批四支', '效果总览登记了四条新行（造纸/乐器/制皂/钱庄，一个都不能漏）',
    NEW4.every((id) => EFFECT_ROWS.some((r) => (r.view ?? '').endsWith(id))))
  check('第三批四支', '四支在公会与每日/周常任务里都有条目',
    NEW4.every((id) => GUILDS.some((g) => (g.tasks ?? []).some((t) => t.param === id)))
    && NEW4.every((id) => DAILY_POOL.some((t) => t.param === id) || WEEKLY_POOL.some((t) => t.param === id)))
}

// ── C38. 经验条「转生后为负」（2026-09-18 用户实测报出）──
// 转生「师徒传承」把等级抬到 1+carry 而 exp 归零 ⇒ exp 低于本级的累计基线，
// 原先 xpProgress 算 current = exp - base 直接是负数（实测 level=6/exp=0 → -113,528、progress -3.74），
// 侧栏文案变成「-113,528 / 30,372」。修法见 Experience.js 的 xpProgress。
console.log('══ C38. 经验条负值守卫 ══')
{
  const total = (lv) => totalXpForLevel(lv)
  const bad = []
  // ① 全量不变量：任何 (等级, 经验) 组合都不许返回负 current / 越界 progress
  for (const lv of [1, 2, 6, 21, 50, 99, 100, 120]) {
    for (const exp of [0, 1, total(lv) - 1, total(lv), total(lv) + 1, total(lv + 1), total(lv + 1) * 2]) {
      if (!Number.isFinite(exp) || exp < 0) continue
      const r = xpProgress(exp, 120, lv)
      if (r.current < 0) bad.push(`lv${lv}/exp${exp}: current=${r.current}`)
      if (!(r.progress >= 0 && r.progress <= 1)) bad.push(`lv${lv}/exp${exp}: progress=${r.progress}`)
      if (r.needed < 0) bad.push(`lv${lv}/exp${exp}: needed=${r.needed}`)
    }
  }
  check('经验条负值', '任意等级/经验组合下 current ≥ 0、progress ∈ [0,1]、needed ≥ 0（含转生态 exp=0）', bad.length === 0, bad.slice(0, 4).join('; '))

  // ② 转生态（转生产物：level = 1+carry、exp = 0）的真实口径
  const zero = xpProgress(0, 120, 6)
  check('经验条负值', `转生态（等级 6 / 经验 0）显示「0 / ${total(7).toLocaleString()}」而不是负数`,
    zero.current === 0 && zero.needed === total(7) && zero.progress === 0,
    `current=${zero.current} needed=${zero.needed} progress=${zero.progress}`)

  // ③ 进度条必须在「升级判定那一刻」刚好满格（与 Skill.addXp 的 exp >= xpTotalForLevel(level+1) 同源）
  check('经验条负值', '进度条在 exp 达到下一级基线时恰好 100%（与 Skill.addXp 的升级条件同源）',
    xpProgress(total(7), 120, 6).progress === 1)

  // ④ 正常态零回归：exp 正好等于本级基线时，与旧公式逐值一致
  const norm = xpProgress(total(6), 120, 6)
  check('经验条负值', '正常态（exp = 本级基线）口径不变：current=0、needed = 本级区间',
    norm.current === 0 && norm.needed === total(7) - total(6), `current=${norm.current} needed=${norm.needed}`)

  // ⑤ 调用点必须把「等级」传进去：不传 level 时 xpProgress 会用 levelFromXp(exp) 反推，
  //    而转生技能是「等级 6 / exp 0」⇒ 反推得 1 级，条子按 1 级口径算、exp 一过 1→2 门槛就顶到 100%
  const badCall = []
  for (const [name, rel] of [['Sidebar.vue', '../../src/components/Sidebar.vue'], ['SkillView.vue', '../../src/views/SkillView.vue']]) {
    const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8')
    // ⚠️ 参数里有嵌套括号（skillState(...)），不能用 /xpProgress\(([^)]*)\)/ 那样截到第一个 ')' —— 必须按括号配平取整段
    for (const m of src.matchAll(/xpProgress\(/g)) {
      let i = m.index + m[0].length, depth = 1
      while (i < src.length && depth > 0) { if (src[i] === '(') depth++; else if (src[i] === ')') depth--; i++ }
      const args = src.slice(m.index + m[0].length, i - 1).trim()
      if (!/\.level\s*$/.test(args)) badCall.push(`${name}: xpProgress(${args.replace(/\s+/g, ' ')}) 没把等级传进去`)
    }
  }
  check('经验条负值', '两个调用点都把等级（权威值）传进 xpProgress', badCall.length === 0, badCall.join('; '))

  // ⑥ 真跑一次转生（满 100 级 → 转生）：等级落到 1+传承，且**经验 = 该等级的累计基线**
  //    （2026-09-18 用户确认：传承保留的等级连基线经验一起给，于是到下一级只需本级区间）
  const pl = freshPlayer()
  pl.setSkillState('knife', { level: 100, exp: total(100), prestiges: 0 })
  const ok = pl.prestigeSkill('knife')
  const st = pl.skillState('knife')
  const after = xpProgress(st.exp, pl.getMaxLevel('knife'), st.level)
  check('经验条负值', '转生后：等级 = 1+传承、经验 = 该等级基线、经验条从 0 起步',
    ok === true && st.level === 1 + pl.legacyCarryOf('knife') && st.exp === total(st.level)
    && after.current === 0 && after.needed === total(st.level + 1) - total(st.level) && after.progress === 0,
    `level=${st.level} exp=${st.exp} current=${after.current} needed=${after.needed}`)

  // ⑦ 老档迁移：2026-09-18 之前转生过的档是「等级 6 / 经验 0」，读档时要抬到基线（否则首屏还是负数）
  const pLegacy = freshPlayer()
  const saveLegacy = JSON.parse(JSON.stringify(pLegacy.serialize()))
  saveLegacy.skills.knife = { level: 6, exp: 0, mastery: {}, prestiges: 1 }
  saveLegacy.skills.foraging = { level: 12, exp: total(12), mastery: {}, prestiges: 0 } // 正常档：不许被动到
  const pMig = freshPlayer()
  pMig.applySave(saveLegacy)
  const migKnife = pMig.skillState('knife')
  const migFor = pMig.skillState('foraging')
  check('经验条负值', '老档（转生后 exp 被清零）读档即补到该等级基线；正常档的经验一动不动',
    migKnife.exp === total(6) && migFor.exp === total(12) && xpProgress(migKnife.exp, 120, 6).progress === 0,
    `knife: ${migKnife.exp}（应 ${total(6)}）· foraging: ${migFor.exp}（应 ${total(12)}）`)
}

// ── C39. 装备词条改为「按装备 id 存」（2026-09-18 用户选择：换穿不重掷、洗练永久）──
// 旧口径是 `gearMods[槽位] = { itemId, mods }`：换穿同槽位的另一件再换回来会**重掷**，
// 于是花金币洗练出的结果会被换装抹掉（用户实测报出）。新口径 `gearMods[itemId] = { mods, at }`。
console.log('══ C39. 装备词条按装备 id 存 ══')
{
  const W = Object.values(ITEMS).filter((i) => i.type === 'equipment' && i.slot === 'weapon')
  const p = freshPlayer()
  const A = W.find((i) => i.id === 'copperKnife') ?? W[0]
  const B = W.find((i) => i.id !== A.id && i.id === 'ironKnife') ?? W.find((i) => i.id !== A.id)
  p.gainItem(A.id, 3)
  p.gainItem(B.id, 1)

  // ① 换穿 A → B → A：A 的词条必须原样还在（旧口径这里会重掷）
  p.equip(A.id)
  const aMods = JSON.stringify(p.gearModsOf(A.id))
  p.unequip(A.slot)
  p.equip(A.id)
  const afterReWear = JSON.stringify(p.gearModsOf(A.id))
  p.unequip(A.slot)
  p.equip(B.id)
  const bMods = JSON.stringify(p.gearModsOf(B.id))
  p.equip(A.id)
  check('词条按装备存', '卸下再穿 / 换穿别的再换回：同一件装备的词条一字不变',
    afterReWear === aMods && JSON.stringify(p.gearModsOf(A.id)) === aMods && p.gearModsOf(B.id).length === JSON.parse(bMods).length,
    `A: ${aMods} → ${afterReWear} → ${JSON.stringify(p.gearModsOf(A.id))}`)

  // ② 洗练结果必须经得起换装（旧口径会被抹掉）
  p.gold = 1e6
  const rr = p.rerollGearMod(A.slot)
  const rolled = JSON.stringify(p.gearModsOf(A.id))
  p.unequip(A.slot)
  p.equip(B.id)
  p.equip(A.id)
  check('词条按装备存', '洗练出的词条在「换成别的再换回来」之后仍在（花金币的结果不会被换装抹掉）',
    rr.ok === true && JSON.stringify(p.gearModsOf(A.id)) === rolled, `${rolled} → ${JSON.stringify(p.gearModsOf(A.id))}`)

  // ③ 装备**不可堆叠**（同类上限 1 件）⇒「按装备 id 存」与「按件存」语义等价：
  //    不存在「背包里两件同款各掷一套词条」的场景 —— 这正是选「按 id 存」的依据
  const pDup = freshPlayer()
  pDup.gainItem(A.id, 5)
  const dupQty = pDup.inventory[A.id] ?? 0
  // 2026-09-22 语义更新：无词条装备**可堆叠**了（用户要求），所以「同款两件各不相同」不可能发生
  // 靠的是**新不变量**：一旦该 id 有词条，上限立刻回到 1（永远只可能有一件带词条的）
  check('词条按装备存', '不变量：有词条 ⇒ 上限 1（不会出现「同款两件各自带不同词条」）；无词条才可堆叠',
    getItem(A.id).stackable === false && dupQty === 5 &&
    (() => { pDup.gearMods = { [A.id]: { mods: [{ stat: 'attack', value: 1 }], at: Date.now() } }; return pDup.stackCapOf(A.id) === 1 && pDup.gainItem(A.id, 1) === false })(),
    `数据里 stackable=${getItem(A.id).stackable}（规则在运行时层） 无词条时堆到 ${dupQty} 件`)

  // ④ 只有「穿戴中」的词条才进属性合计
  const pOff = freshPlayer()
  pOff.gainItem('goldKnife', 1)
  pOff.gainItem('ironKnife', 1)
  pOff.gearMods.goldKnife = { mods: [{ stat: 'attack', label: '攻击', value: 999 }], at: 0 }
  pOff.gearMods.ironKnife = { mods: [{ stat: 'attack', label: '攻击', value: 777 }], at: 0 }
  pOff.equip('goldKnife')
  const withGold = pOff.equippedStats.attack
  pOff.equip('ironKnife') // 换穿：goldKnife 脱下，它的词条不该再计入
  const withIron = pOff.equippedStats.attack
  check('词条按装备存', '未穿戴装备的词条不生效（换下后不再计入、换上的计入）',
    withGold >= 999 && withIron < 999 && withIron >= 777, `goldKnife=${withGold} → ironKnife=${withIron}`)

  // ⑤ 旧档迁移（按槽位 → 按装备）且幂等
  const legacy = { weapon: { itemId: 'copperKnife', mods: [{ stat: 'attack', label: '攻击', value: 7 }] }, helmet: { itemId: 'ironHat', mods: [] } }
  const mig = migrateGearMods(legacy)
  const mig2 = migrateGearMods(mig)
  check('词条按装备存', '旧档（gearMods[槽位]）迁移到按装备 id，且再迁一次不变（幂等）',
    mig.copperKnife?.mods?.[0]?.value === 7 && mig.ironHat !== undefined && !mig.weapon && JSON.stringify(mig2) === JSON.stringify(mig),
    JSON.stringify(mig))

  // ⑥ 读档链路：旧档走 applySave 后词条仍然生效（不只是迁移函数单测）
  //    ⚠️ serialize()/applySave() 吃的是「玩家对象本身」，没有外层 player 包裹（bootstrap 传的是 data.player）
  const pOld = freshPlayer()
  const saveOld = JSON.parse(JSON.stringify(pOld.serialize()))
  saveOld.equipment.weapon = 'copperKnife'
  saveOld.inventory.copperKnife = 1
  saveOld.gearMods = { weapon: { itemId: 'copperKnife', mods: [{ stat: 'attack', label: '攻击', value: 33 }] } }
  const pBack = freshPlayer()
  pBack.applySave(saveOld)
  check('词条按装备存', '旧档经 applySave 后词条已迁移并生效（读档链路，不只看迁移函数）',
    pBack.gearModsOf('copperKnife').some((m) => m.value === 33) && !pBack.gearMods.weapon,
    JSON.stringify(pBack.gearMods))

  // ⑦ 记录条数有上限（防存档无限膨胀），且当前穿戴的永远保留
  const ALL_EQ = Object.values(ITEMS).filter((i) => i.type === 'equipment')
  const pCap = freshPlayer()
  pCap.gainItem('copperKnife', 1)
  for (const it of ALL_EQ) pCap.ensureGearMods(it.id) // 先塞满（远超上限）
  pCap.equip('copperKnife')
  for (const it of ALL_EQ) pCap.ensureGearMods(it.id) // 再走一轮，触发剪枝
  const capped = Object.keys(pCap.gearMods).length
  check('词条按装备存', `词条记录被剪枝到 ≤ ${GEAR_MODS_MAX} 条（实测 ${capped} / 装备共 ${ALL_EQ.length} 件），且当前穿戴的保留`,
    capped <= GEAR_MODS_MAX && !!pCap.gearMods.copperKnife && ALL_EQ.length > GEAR_MODS_MAX,
    `capped=${capped} equippedKept=${!!pCap.gearMods.copperKnife}`)

  // ⑧ 存档往返无损
  const pRt = freshPlayer()
  pRt.gainItem('goldKnife', 1)
  pRt.equip('goldKnife')
  pRt.gearMods.goldKnife = { mods: [{ stat: 'critChance', label: '暴击', value: 0.05 }], at: 123 }
  const back = freshPlayer()
  back.applySave(JSON.parse(JSON.stringify(pRt.serialize())))
  check('词条按装备存', '词条随存档往返无损（含值精度与 stat）',
    JSON.stringify(back.gearModsOf('goldKnife')) === JSON.stringify(pRt.gearModsOf('goldKnife')), JSON.stringify(back.gearMods))

  // ⑨ 源码纪律：掷词条只允许发生在「补记录」与「洗练」两处（别再冒出第三个调用点偷偷重掷）
  const PS = fs.readFileSync(new URL('../../src/stores/player.js', import.meta.url), 'utf8')
  const rollCalls = [...PS.matchAll(/rollGearMods\(/g)].length
  check('词条按装备存', 'player.js 里 rollGearMods 只在 ensureGearMods 与 rerollGearMod 两处调用（唯一重掷入口）',
    rollCalls === 2, `实际 ${rollCalls} 处`)

  // ⑩ 玩家可读文案与新口径一致（旧文案「换装会重掷」会误导）
  const GV = fs.readFileSync(new URL('../../src/views/GearView.vue', import.meta.url), 'utf8')
  const GD = fs.readFileSync(new URL('../../src/game/data/guide.js', import.meta.url), 'utf8')
  check('词条按装备存', '装备总览与攻略总览都不再写「换装（会）重掷」',
    !/换装会重掷|换装重掷/.test(GV) && !/换装会重掷|换装重掷/.test(GD))
}

// ── C40. 新手目标链（2026-09-18，留存改进 ①：把开局 30 分钟塞满小高潮）──
// 20 步 · 每步即时奖励 · 幂等账本（guide.claimed）· 无死路 · 轨迹供「首 30 分钟漏斗」统计
console.log('══ C40. 新手目标链 ══')
{
  // ① 结构：20 步、id 唯一、字段齐备
  const ids = NEWBIE_STEPS.map((s) => s.id)
  const bad = []
  if (NEWBIE_TOTAL !== 20) bad.push(`步数为 ${NEWBIE_TOTAL}（应为 20）`)
  if (new Set(ids).size !== ids.length) bad.push('id 有重复')
  for (const s of NEWBIE_STEPS) {
    if (!s.id || !s.label || !s.where || !s.view) bad.push(`${s.id}: 缺 id/label/where/view`)
    if (typeof s.check !== 'function') bad.push(`${s.id}: check 不是函数`)
  }
  check('新手链', '20 步 · id 唯一 · 每步都有 label/where/view/check', bad.length === 0, bad.join('; '))

  // ② 奖励：物品必须存在、数量为正整数、金额有上限（防有人把奖励调成天文数字破坏经济）
  const badR = []
  let totalGold = 0
  for (const s of NEWBIE_STEPS) {
    const g = s.reward?.gold ?? 0
    totalGold += g
    if (g < 0 || !Number.isFinite(g)) badR.push(`${s.id}: 金币非法 ${g}`)
    for (const [id, q] of Object.entries(s.reward?.items ?? {})) {
      if (!getItem(id)) badR.push(`${s.id}: 物品 ${id} 不存在`)
      if (!(q > 0) || !Number.isInteger(q)) badR.push(`${s.id}: ${id} 数量非法 ${q}`)
    }
    if (rewardText(s.reward) === '') badR.push(`${s.id}: 奖励文案为空`)
  }
  check('新手链', '奖励只用既有物品、数量为正整数、文案非空', badR.length === 0, badR.slice(0, 4).join('; '))

  // ②b 长线步只能在链尾（2026-09-18 用户实测报出：⑬「采集队」要技能 25 级，链子在中段被卡死、后面十几步永不显示）
  const longIdx = NEWBIE_STEPS.map((s, i) => (s.long ? i : -1)).filter((i) => i >= 0)
  check('新手链', `长线目标（long: true）只允许出现在链尾两步内（实测位置 ${longIdx.join('/')}）`,
    longIdx.every((i) => i >= NEWBIE_TOTAL - 2),
    longIdx.filter((i) => i < NEWBIE_TOTAL - 2).map((i) => `${NEWBIE_STEPS[i].id} 在第 ${i + 1} 步`).join('; '))
  // 每个长线步的 label 必须写明是长线（免得玩家以为「马上就差这一步」）
  check('新手链', '长线步的文案里带「长线」标注',
    longIdx.every((i) => NEWBIE_STEPS[i].label.includes('长线')))
  // ②c 🔴 武器必须在「赢得第一场对决」**之前**发（2026-09-26 实测后立的守卫）
  //     为什么：空手打第一场是**必败**的 —— 真新档打「灶台学徒」实测胜率 **0%**（400 场 0 胜），
  //     而只带 2 份烤土豆（原 n03 奖励口径）也只有 **49%**（抛硬币、单场 55 秒）。把铜刀提前到 n03 后
  //     同一场 **100%**。谁把它挪回「赢了才发」，开局第一步就会重新变成抽奖 —— 这条断言就是拦这个。
  {
    const i03 = NEWBIE_STEPS.findIndex((s) => s.id === 'n03')
    const i04 = NEWBIE_STEPS.findIndex((s) => s.id === 'n04')
    const knife = NEWBIE_STEPS[i03]?.reward?.items?.copperKnife
    check('新手链', '武器在第 ③ 步就发（必须早于 ④「赢得第一场对决」；空手首战实测 0% 胜）',
      !!knife && i03 >= 0 && i04 >= 0 && i03 < i04, `n03 铜刀=${knife ?? '无'} · 位置 ${i03} < ${i04}`)
    check('新手链', '首战前至少给 2 份回血料理（③+④ 合计，与实测口径一致）', (() => {
      const heal = ['roastPotato']
      const n = NEWBIE_STEPS.slice(0, Math.max(0, i04) + 1)
        .flatMap((s) => Object.entries(s.reward?.items ?? {}))
        .filter(([id]) => heal.includes(id))
        .reduce((a, [, q]) => a + q, 0)
      return n >= 2
    })())
  }
  check('新手链', `奖励总额有上限（实测 ${totalGold.toLocaleString()} 金币 ≤ 20,000）`, totalGold <= 20000, `totalGold=${totalGold}`)

  // ③ 判定不许抛错（含极端空状态）
  const empty = freshPlayer()
  const throwAt = []
  for (const s of NEWBIE_STEPS) {
    try { s.check(empty) } catch (e) { throwAt.push(`${s.id}: ${e.message}`) }
  }
  check('新手链', '全部判定在空档上可执行且不抛错', throwAt.length === 0, throwAt.join('; '))

  // ④ 新档：一步都不该完成（横幅要显示第 1 步，否则「开局即通关」）
  const p0 = freshPlayer()
  check('新手链', '新档 syncNewbieChain() = 0 且停在第 1 步', p0.syncNewbieChain() === 0 && p0.guide.step === 0 && !!p0.newbieCurrent())

  // ⑤ 无死路：把全部条件造到满足，迭代推进后必须 20 步全完成（逐步测量会误报，必须迭代到不动点）
  const pA = freshPlayer()
  const { ITEMS: ALL_ITEMS } = await import('../../src/game/data/items.js')
  const rare = Object.keys(ALL_ITEMS).find((k) => ALL_ITEMS[k].type === 'equipment' && ['稀有', '史诗', '传说', '神话'].includes(ALL_ITEMS[k].quality))
  pA.gainItem('copperKnife', 1); pA.equip('copperKnife')
  pA.skillTargets.foraging = { itemId: 'apple', startedAt: Date.now() }
  pA.skillTargets.mining = { itemId: 'saltOre', startedAt: Date.now() }
  for (let i = 0; i < 45; i++) pA.collected['probe' + i] = true
  pA.storyProgress['craft:x'] = 1
  pA.stats.combatWins = 1
  pA.restaurant.menu = ['roastPotato']
  pA.stats.arena.wins = 1
  pA.guild.id = 'cook'
  pA.seasons[1] = { points: 20, claimed: [20] }
  pA.regulars.r1 = { serves: 1, lastDay: null, giftClaimed: false }
  pA.expeditions.line1 = { completions: 1, slots: [] }
  pA.stats.totalGoldEarned = 12000
  pA.stats.explorations = 1
  pA.upgrades.copperKnife = 1
  pA.gearMods.ironKnife = { mods: [], at: 1 }
  pA.gainItem(rare, 1); pA.equip(rare)
  let rounds = 0, moved = true
  while (moved && rounds < 40) { moved = pA.syncNewbieChain() > 0; rounds++ }
  check('新手链', `条件齐备后 20 步全部可达且 done=true（迭代 ${rounds} 轮，无死路）`,
    pA.guide.done === true && pA.guide.claimed.length === NEWBIE_TOTAL && pA.guide.step === NEWBIE_TOTAL,
    `done=${pA.guide.done} claimed=${pA.guide.claimed.length} step=${pA.guide.step}`)

  // ⑥ 幂等：反复调用不再发奖
  const goldAfter = pA.gold
  for (let i = 0; i < 30; i++) pA.syncNewbieChain()
  check('新手链', '连调 30 次不再重复发奖（金币不变、claimed 不增）',
    pA.gold === goldAfter && pA.guide.claimed.length === NEWBIE_TOTAL, `gold ${goldAfter} → ${pA.gold}`)

  // ⑦ 轨迹：每步一条、有相对时刻（漏斗统计的原料）
  check('新手链', 'guide.trace 每步一条且带相对时刻（漏斗原料）',
    pA.guide.trace.length === NEWBIE_TOTAL && pA.guide.trace.every((t) => typeof t.id === 'string' && Number.isFinite(t.at) && t.at >= 0),
    JSON.stringify(pA.guide.trace.slice(0, 2)))

  // ⑧ 存档往返 + 旧档兼容（旧档只有 { step, done }）
  const back = freshPlayer()
  back.applySave(JSON.parse(JSON.stringify(pA.serialize())))
  check('新手链', '链子进度随存档往返无损（claimed/step/trace）',
    back.guide.claimed.length === NEWBIE_TOTAL && back.guide.step === NEWBIE_TOTAL && back.guide.trace.length === NEWBIE_TOTAL)
  const oldSave = JSON.parse(JSON.stringify(pA.serialize()))
  oldSave.guide = { step: 0, done: false }
  const pOld = freshPlayer()
  pOld.applySave(oldSave)
  check('新手链', '旧档（guide 只有 step/done）读档后子字段补齐、且已满足的步会补推进（不会永久卡在第 1 步）',
    Array.isArray(pOld.guide.claimed) && Array.isArray(pOld.guide.trace) && pOld.syncNewbieChain() > 0,
    JSON.stringify(pOld.guide))
}

// ── C41. 左上两条提示的分级与「一次性大反馈」（2026-09-18，留存改进 ⑤⑥）──
console.log('══ C41. 功能页分级 + 大反馈演出 ══')
{
  const SIDEBAR = fs.readFileSync(new URL('../../src/components/Sidebar.vue', import.meta.url), 'utf8')
  // 磁贴清单（含 unlock 门槛）2026-09-21 起住在 featureGroups.js —— 凡按 `view: '…'` 扫磁贴的断言都读它，
  // 只扫 Sidebar.vue 会变成空集（gates.length >= 10 会先炸，但一开始就改对更好）。
  const FG = fs.readFileSync(new URL('../../src/game/data/featureGroups.js', import.meta.url), 'utf8')

  // ① ⑤ 分级：磁贴的 unlock 必须**复用 store 的既有访问器**（不发明新阈值），且开关存在
  const gates = [...FG.matchAll(/view: '(\w+)'[^}]*unlock: \(p\) => p\.(\w+)\(\)/g)].map((m) => ({ view: m[1], acc: m[2] }))
  const missing = gates.filter((g) => !new RegExp(`${g.acc}\\(\\)\\s*\\{`).test(fs.readFileSync(new URL('../../src/stores/player.js', import.meta.url), 'utf8')))
  check('功能页分级', `带解锁门槛的磁贴都复用了 store 的既有访问器（实测 ${gates.length} 个：${gates.map((g) => g.view).join('/')}）`,
    gates.length >= 10 && missing.length === 0, missing.map((m) => `${m.view}→${m.acc}`).join('; '))
  check('功能页分级', '有「显示全部」开关（settings.showAllFeatures 进存档，随时能放出来）',
    /settings\.showAllFeatures/.test(SIDEBAR) || /showAllFeatures: false/.test(fs.readFileSync(new URL('../../src/stores/player.js', import.meta.url), 'utf8')))
  // 未解锁的磁贴必须是**收起**而不是置灰不可点（置灰会让新玩家反复点）
  check('功能页分级', '模板按 tileVisible 过滤磁贴（收起而不是置灰）', /v-for="it in g\.items\.filter\(\(it\) => tileVisible\(it\)\)"/.test(SIDEBAR))
  // 无门槛的核心页永远可见（否则老玩家/测试会找不到入口）
  const always = ['shop', 'quests', 'mail', 'achievements', 'log', 'milestones']
  check('功能页分级', `无门槛的核心页（${always.join('/')}）没有被误加 unlock`,
    always.every((v) => !new RegExp(`view: '${v}'[^}]*unlock`).test(FG)))

  // ② ⑥ 大反馈：两个账本存在、且**各只演一次**（行为断言：监听 → 触发两次 → 只收到一次）
  const pC = freshPlayer()
  const seen = []
  const fakeUi = { celebrate: (x) => seen.push(x) }
  const off = initCelebrations(pC, fakeUi)
  EventBus.emit('player:prestige', { skillId: 'knife', prestiges: 1, carry: 5 })
  EventBus.emit('player:prestige', { skillId: 'knife', prestiges: 2, carry: 5 })
  EventBus.emit('season:claim', { name: '第一季', seasonName: '第一季', tier: '奖励 10', full: false })
  EventBus.emit('season:claim', { name: '第一季', seasonName: '第一季', tier: '奖励 10', full: true })
  EventBus.emit('season:claim', { name: '第二季', seasonName: '第二季', tier: '奖励 10', full: true })
  off()
  check('大反馈', '首次转生只演一次（连发两次事件只收到一个；演出内容对得起这个时刻）',
    seen.filter((x) => x.icon === '♻️').length === 1 && /转生/.test(seen.find((x) => x.icon === '♻️')?.title ?? ''))
  check('大反馈', '首次赛季满档只演一次（半满不演；两个赛季都满也只演第一次）',
    seen.filter((x) => x.icon === '🎪').length === 1,
    JSON.stringify(seen.map((x) => x.icon)))
  check('大反馈', '账本已写进 stats（随存档往返，不会每次开局重演）',
    pC.stats.prestigeCelebrated === true && pC.stats.seasonFullCelebrated === true)
  const backC = freshPlayer()
  backC.applySave(JSON.parse(JSON.stringify(pC.serialize())))
  check('大反馈', '两个账本随存档往返保留（旧档缺失时回退 false → 该演的那次仍会演）',
    backC.stats.prestigeCelebrated === true && backC.stats.seasonFullCelebrated === true
    && freshPlayer().stats.prestigeCelebrated === false)
  // 注销后不再接收（App 卸载时的清理）
  EventBus.emit('player:prestige', { skillId: 'knife', prestiges: 3, carry: 5 })
  check('大反馈', '注销后不再接收事件（onUnmounted 会调用返回的注销函数）', seen.length === 2)
}
// ══════════ C42：战败惩罚按「可重复性」分级（2026-09-19 立）══════════
// 起因：塔/秘境是**可无限重复**的 PvE，而战败会**永久销毁一件随机装备** ⇒ 与强化/词条/宝石（按装备 id 记）
// 叠加成**死亡螺旋**：输一场掉一件 → 属性阶梯下滑 → 更容易输。实测同一层因此给出 100%/76%/38%/0% 四种结果。
// 现规则：可重复的 PvE（isTower / isRealm）战败只清品鉴点，不夺装备；**区域对决/首领/竞技场保留重罚**。
{
  const { Combat } = await import('../../src/game/combat/Combat.js')
  const { towerFloor } = await import('../../src/game/data/battleTower.js')
  const gearCount = (p) => Object.values(p.equipment).filter(Boolean).length
  const mk = () => {
    const p = freshPlayer(); p.gold = 1e6
    for (const [slot, id] of Object.entries({ weapon: 'copperKnife', helmet: 'copperHat', body: 'copperApron' })) { p.gainItem(id, 1); p.equip(id) }
    return p
  }
  /** 让玩家必输：不强化、不开自动进食、每回合压到 1 点 HP */
  const forceLose = (p, opp) => {
    for (const id of Object.values(p.equipment).filter(Boolean)) p.upgrades[id] = 0
    p.settings.autoEat = false
    const c = new Combat(p)
    for (let i = 0; i < 3000; i++) {
      p.setCombat({ hp: 1 })
      c.start(opp)
      let g = 0
      while (c.inFight && g++ < 4000) c.tick(200)
      if (c.result === 'lose') return true
    }
    return false
  }
  {
    const p = mk(); p.tastePoints = 500
    const before = gearCount(p)
    const lost = forceLose(p, towerFloor(50, 60))
    check('战败惩罚', '塔里战败**不夺装备**（避免死亡螺旋）', lost && gearCount(p) === before, `${before} → ${gearCount(p)}`)
    check('战败惩罚', '塔里战败清空品鉴点（奥义随之熄灭，张力仍在）', p.tastePoints === 0, `tastePoints=${p.tastePoints}`)
  }
  {
    const p = mk()
    const before = gearCount(p)
    const opp = { name: '秘境守关', level: 120, hp: 99999, atk: 9999, def: 400, eva: 200, acc: 400, critChance: 0.5, speed: 1, style: 'knife', isRealm: true, drops: [] }
    const lost = forceLose(p, opp)
    check('战败惩罚', '秘境战败**不夺装备**（同上）', lost && gearCount(p) === before, `${before} → ${gearCount(p)}`)
  }
  {
    const p = mk()
    const before = gearCount(p)
    const opp = { name: '区域强者', level: 120, hp: 99999, atk: 9999, def: 400, eva: 200, acc: 400, critChance: 0.5, speed: 1, style: 'knife', drops: [] }
    const lost = forceLose(p, opp)
    check('战败惩罚', '区域对决战败**仍夺走一件装备**（一次性挑战保留重罚）', lost && gearCount(p) === before - 1, `${before} → ${gearCount(p)}`)
  }
}

// ══════════ C43：日历硬门与挑战时点（2026-09-19 参照 Rocky Idle 立）══════════
// 起因：实测参考作 Rocky Idle 的构建产物里**完全没有赛季/日历机制**（只有离线上限），长线 100% 是努力门；
// 而本作曾把「主线毕业」锁在 8 个不同赛季（=112 天，努力无法缩短），且把唯一的可重复挑战（塔）锁在对决 99。
// ⚠️ 本组用**行为断言**（造存档 → 读判定），不用源码扫描：第一版只比较「需求数字 ≤ 单季档位数」，
//    结果把计数语义改回「不同赛季」时**守卫仍然绿**（反例验证抓到的），等于没设防。
{
  const { STORY, storyReqCur } = await import('../../src/game/data/story.js')
  const { SEASONS } = await import('../../src/game/data/seasons.js')
  const { TOWER_UNLOCK_LEVEL } = await import('../../src/game/data/battleTower.js')
  const tiersPerSeason = Math.max(...SEASONS.map((x) => x.tiers?.length ?? 0))
  // ① 行为：只在**一个赛季**里领满档位，故事里的赛季需求就该被满足（⇒ 不存在日历硬门）
  const p1 = freshPlayer()
  p1.seasons = { summer: { claimed: [1, 2, 3, 4, 5, 6, 7, 8] } }
  const needMax = Math.max(...STORY.flatMap((ch) => (ch.requirements ?? []).filter((r) => r.kind === 'seasons').map((r) => r.need)))
  const cur = storyReqCur(p1, 'seasons')
  check('日历门', `单季领满档位即满足故事的最高赛季需求（需 ${needMax}，实得 ${cur}）——无日历硬门`,
    cur >= needMax, `单季 8 档只得 ${cur}（说明仍在按「不同赛季数」计数 ⇒ 112 天硬门回来了）`)
  // ② 数字侧兜底：需求本身不能超过单季档位数
  check('日历门', `故事赛季需求 ≤ 单季档位数（${tiersPerSeason}）`, needMax <= tiersPerSeason, `最高需求 ${needMax}`)
  // ③ 塔必须在中后期解锁（≤ 对决 60），不能退回大后期
  check('挑战时点', `挑战塔在中后期就解锁（对决 ${TOWER_UNLOCK_LEVEL} ≤ 60）`, TOWER_UNLOCK_LEVEL <= 60, `当前 ${TOWER_UNLOCK_LEVEL}`)
  // ④ 任务侧的赛季语义必须与文案同义。**2026-09-29 起是「累计领奖次数」**（与故事同口径）：
//    原先文案写「达到 N 季」而实现按**不同赛季**计数 —— 那是「必须等 N×14 天」的日历硬门，努力无法缩短。
//    两条断言：① 一季领满即满足 q27（去日历门的**效果**）；② 两季各 2 档记 4 次而不是 2 季（口径的**判据**）。
{
  const { QUESTS } = await import('../../src/game/data/quests.js')
  const qSeason = QUESTS.filter((q) => (q.objectives ?? []).some((o) => o.kind === 'seasons'))
  check('日历门', '任务侧赛季文案写明「累计」（与实现同义；旧文案写「达到 N 季」已改）',
    qSeason.every((q) => /累计/.test(q.desc ?? '')))
  // ① 效果：只在**一个**赛季里领满 10 档 ⇒ qty=2 的那条任务当场完成（日历门没了）
  const p2 = freshPlayer()
  p2.seasons = { summer: { claimed: Array.from({ length: 10 }, (_, i) => i + 1) } }
  const qSmall = qSeason.find((q) => q.objectives[0].qty <= 10) ?? qSeason[0]
  p2.quests.index = QUESTS.findIndex((q) => q.id === qSmall.id)
  p2.syncQuestProgress()
  check('日历门', `一季领满 10 档即完成「${qSmall.name}」（去日历门的效果）`,
    (p2.quests.completed ?? []).includes(qSmall.id), `completed=${JSON.stringify(p2.quests.completed)}`)
  // ② 口径：两季各领 2 档 ⇒ 记 **4 次**（累计）而不是 2 季（不同赛季）
  const qBig = qSeason.find((q) => q.objectives[0].qty >= 3)
  if (qBig) {
    const p3 = freshPlayer()
    p3.seasons = { a: { claimed: [1, 2] }, b: { claimed: [3, 4] } }
    p3.quests.index = QUESTS.findIndex((q) => q.id === qBig.id)
    p3.syncQuestProgress()
    const got = p3.quests.progress['seasons:total']
    check('日历门', '任务侧赛季进度是**累计次数**（两季各 2 档 ⇒ 4，而不是 2 季）',
      got === 4, `实际 ${got}（4 = 累计口径；2 = 退回「不同赛季数」= 日历门回来了）`)
  }
  // ③ 三个赛季成就（2026-09-29 从「不同赛季数」改成累计领奖次数）：成对断言，别只改数据不守
  {
    const { ALL_ACHIEVEMENTS } = await import('../../src/game/data/achievements.js')
    const seasonAch = ['season5', 'season10', 'seasonAll'].map((id) => ALL_ACHIEVEMENTS.find((a) => a.id === id)).filter(Boolean)
    check('日历门', '三个赛季成就的文案都写明「累计」（与实现同义）',
      seasonAch.length === 3 && seasonAch.every((a) => /累计/.test(a.desc ?? '')), seasonAch.map((a) => a.desc).join(' / '))
    const pa = freshPlayer()
    pa.seasons = { summer: { claimed: Array.from({ length: 10 }, (_, i) => i + 1) } } // 一季领满 10 档
    const ok5 = ALL_ACHIEVEMENTS.find((a) => a.id === 'season5')?.check(pa)
    // seasonAll 要 40 次 ⇒ 一季 10 档还不够（这正是「是努力门、不是日历门」的判据：多领几季就能到）
    const okAll1 = ALL_ACHIEVEMENTS.find((a) => a.id === 'seasonAll')?.check(pa)
    const pb = freshPlayer()
    pb.seasons = Object.fromEntries(Array.from({ length: 4 }, (_, s) => [`s${s}`, { claimed: Array.from({ length: 10 }, (_, i) => i + 1) }]))
    const okAll4 = ALL_ACHIEVEMENTS.find((a) => a.id === 'seasonAll')?.check(pb)
    check('日历门', '季节成就按累计领奖次数判：一季 10 档 ⇒ 达成 season5、未达 seasonAll；4 季 × 10 档 ⇒ 达成 seasonAll',
      ok5 === true && okAll1 === false && okAll4 === true, `season5=${ok5} seasonAll(1季)=${okAll1} seasonAll(4季)=${okAll4}`)
  }
}
}
// ══════════ C44：挑战塔深层的「命名 / 奖励」随深度增长（2026-09-19 参照 Rocky Idle 加深）══════════
// 背景：实测真满配可推到 F1000+，而原本的命名只到 130 层、里程碑金币是**线性**（F1000 仅 2 万，
// 对后期时收 138 万/小时毫无意义）⇒ 「推得更深」没有回报。加深后：金币随深度**平方**增长、
// 每 25 层给觅珍券（货币）、每 100 层给「深潜礼包」、命名延伸到 1000 层。
// ⚠️ 本组第一条断言（奖励物品 id 必须存在）**当场抓住了我自己的错**：第一版把券写成 `items.mijianTicket`，
//    而券是货币（`player.mijian.tickets`）不是物品 → 会给玩家一个幽灵物品。**这类「发了个不存在的物品」
//    必须由守卫拦**（与图鉴三查的幽灵引用同类）。
{
  const { towerMilestone, towerFloorName, towerFloor } = await import('../../src/game/data/battleTower.js')
  const { ITEMS } = await import('../../src/game/data/items.js')
  const probe = [10, 50, 60, 100, 250, 500, 1000] // ⚠️ 只能放 10 的倍数（其余返回 null，第一版塞了 25 就崩了）
  const ms = probe.map((f) => towerMilestone(f))
  // ① 奖励里的物品 id 全部存在（幽灵物品拦截）
  const ghost = []
  for (const m of ms) for (const id of Object.keys(m.items ?? {})) if (!ITEMS[id]) ghost.push(`F${m.floor}:${id}`)
  check('塔深层', '里程碑奖励的物品 id 全部存在（无幽灵物品）', ghost.length === 0, ghost.join(', '))
  // ② 金币随深度单调不减，且深层显著高于浅层（线性的老口径 F1000 只有 2 万）
  const golds = ms.map((m) => m.gold)
  const mono = golds.every((g, i) => i === 0 || g >= golds[i - 1])
  check('塔深层', '里程碑金币随深度单调不减', mono, JSON.stringify(golds))
  check('塔深层', `深层里程碑回报有意义（F500 ≥ 10 万、F1000 ≥ 50 万；实测后期时收约 138 万/小时）`,
    towerMilestone(500).gold >= 100000 && towerMilestone(1000).gold >= 500000,
    `F500=${towerMilestone(500).gold} F1000=${towerMilestone(1000).gold}`)
  // ③ 深层给非金币奖励：觅珍券（货币字段，不是物品）+ 深潜礼包
  check('塔深层', '每 25 层给觅珍券、每 100 层给深潜礼包（券走 tickets 字段）',
    ms.every((m) => (m.floor % 25 === 0 ? m.tickets > 0 : true)) && towerMilestone(1000).tickets > towerMilestone(100).tickets,
    `F100=${towerMilestone(100).tickets} F1000=${towerMilestone(1000).tickets}`)
  check('塔深层', '非 10 的倍数没有里程碑', towerMilestone(123) === null)
  // ④ 命名延伸到 1000 层：不同百层段名字互不相同，且能覆盖到 1000+
  const names = [200, 300, 500, 800, 1000].map((f) => towerFloorName(f))
  check('塔深层', '楼层名覆盖到 1000 层且各段不重名', new Set(names).size === names.length && !!towerFloorName(1200),
    names.join(' / '))
  // ⑤ 深层对手确实更强（否则「深度」是假的）
  const lo = towerFloor(100, 100), hi = towerFloor(1000, 100)
  check('塔深层', '对手属性随层数增长（hp/atk 爬坡、def 封顶后仍不降）',
    hi.hp > lo.hp && hi.atk > lo.atk && hi.def >= lo.def, `F100 hp${Math.round(lo.hp)} → F1000 hp${Math.round(hi.hp)}`)
  // ⑥ 🔴 **两段爬坡：陡尾段必须真的更陡**（2026-09-26 重标定，用户「后期还有挑战吗」）
  //    为什么必须钉：塔的难度全在 `g` 这一条曲线上，而它是**纯函数**、改一个数字就能让深层重新变成
  //    「零挑战走廊」（前科：单一斜率 0.012 时满配的 50% 深度在 F1520，F400~F1500 全是 100% 胜）。
  //    静态断言只能钉形状（真正的墙要用 sim 量，见 battleTower.js 里的复测命令与 AGENTS 塔节）。
  const gOf = (f) => {
    const t = towerFloor(f, 120)
    return t.hp / (12 + t.level * 6) // 反解 g（hp = (12 + level×6) × g）
  }
  const gNear = (f) => gOf(f + 4) - gOf(f) // 相邻 4 层的 g 增量（= 该段斜率×4）
  const kShallow = gNear(100), kDeep = gNear(1000)
  check('塔深层', 'hp/atk 爬坡是两段且陡尾段更陡（F~100 段平缓、F~1000 段明显更陡）',
    kDeep > kShallow * 1.3, `F100 段 +${kShallow.toFixed(3)}/4层 vs F1000 段 +${kDeep.toFixed(3)}/4层`)
  check('塔深层', '第一段（≤F250）与设计口径一致（L60 主战场：F250 的 g 仍在 3.9~4.1）',
    Math.abs(gOf(250) - 3.988) < 0.05, `F250 g=${gOf(250).toFixed(3)}`)
  check('塔深层', '深层对手量级（F1000 的 hp ≥ F400 的 2.4 倍：把「零挑战走廊」压回设计深度）',
    towerFloor(1000, 120).hp >= towerFloor(400, 120).hp * 2.4,
    `F400 hp${towerFloor(400, 120).hp} → F1000 hp${towerFloor(1000, 120).hp}（×${(towerFloor(1000, 120).hp / towerFloor(400, 120).hp).toFixed(2)}）`)
  // ⑦ 🔴 **券的总产出：三档设计深度下必须 ≥3600**（2026-09-26 重标定后补的补偿守卫）
  //    为什么：`towerFloor` 改两段后可达深度回退（标准 F1520→F1050 · 精英 ~984→560 · 极限 ~717→360）
  //    ⇒ 券总产出一度掉到 **1913（−58%）**，而券是「后期稀缺的真货币」（塔节 ② 的设计说明）。
  //    补偿方式 = 每 25 层 / 每 100 层的**发放量翻倍**（`towerMilestone`）⇒ **3820**。
  //    这条守卫拦两件事：① 谁把发放量改回去；② 谁将来又动 `towerFloor` 的斜率却没重算券。
  //    ⚠️ 深度 F1050/F560/F360 是 **sim 实测值**（`tower_sim --tier-id`），不是代码常量 ——
  //    哪天真的重标定使深度变化，按新实测重钉这三个数（改数字，不要放宽 ≥3600 这条线）。
  {
    const TICKET_DEPTHS = [['标准', 1050, 1], ['精英', 560, 1.5], ['极限', 360, 2]]
    const per = TICKET_DEPTHS.map(([name, to, mult]) => {
      let t = 0
      for (let f = 10; f <= to; f += 10) t += towerMilestone(f, mult)?.tickets ?? 0
      return `${name} ${t}`
    })
    const ticketTotal = TICKET_DEPTHS.reduce((sum, [, to, mult]) => {
      let t = 0
      for (let f = 10; f <= to; f += 10) t += towerMilestone(f, mult)?.tickets ?? 0
      return sum + t
    }, 0)
    check('塔深层', `三档设计深度下的券总产出 ≥3600（实测 ${ticketTotal}；深度 F1050/F560/F360 为 sim 实测值）`,
      ticketTotal >= 3600, `${per.join(' · ')} ⇒ 合计 ${ticketTotal}`)
  }
}

// ══════════ C45：食神秘境的「档位」（2026-09-19 参照 Rocky Idle 的 Runs 立）══════════
// 参考作的 Runs 是**分档**的（`runs_tiers` + 每档倍率 `this_tier: Nx`），通关推进档位 ⇒ 挑战与回报同步抬升。
// 本作秘境原口径只有「逐层 3 选 1 + 按层结算」、对手等级**封顶 99**、奖励线性小额、无跨局进度 ⇒ 打久了没目标。
// 现已补：档位（1..10，倍率 ×1..×3.25，同时乘对手属性与本局奖励）、升档目标（通过 6/10/…/38 层）、深层券。
{
  const { REALM_TIER_MAX, REALM_TIER_GATES, realmTierMult, realmTierGoal, realmTierCapFor, realmTierUnlocked, realmReward, realmOpponent, realmOpponentLevel } =
    await import('../../src/game/data/mysticRealm.js')
  const { ITEMS } = await import('../../src/game/data/items.js')
  const { totalXpForLevel } = await import('../../src/game/core/Experience.js')
  // ① 倍率单调递增、以 1 为起点、封顶可算
  const mults = Array.from({ length: REALM_TIER_MAX }, (_, i) => realmTierMult(i + 1))
  check('秘境档位', `倍率随档位单调递增且从 ×1 起（${mults[0]} → ×${mults[mults.length - 1]}）`,
    mults[0] === 1 && mults.every((m, i) => i === 0 || m > mults[i - 1]))
  check('秘境档位', `升档目标随档位递增（${realmTierGoal(1)} → ${realmTierGoal(REALM_TIER_MAX)} 层）`,
    realmTierGoal(REALM_TIER_MAX) > realmTierGoal(1))
  // ② 奖励随档位与层数增长；深层给券（货币字段 tickets，不是物品）；无幽灵物品
  const r1 = realmReward(20, 1), r10 = realmReward(20, 10)
  check('秘境档位', '同一层数下奖励随档位放大', r10.gold > r1.gold && r10.tickets > r1.tickets, `${r1.gold}/${r1.tickets} → ${r10.gold}/${r10.tickets}`)
  const ghost = []
  for (const f of [5, 20, 40]) for (const t of [1, 5, 10]) for (const id of Object.keys(realmReward(f, t).items ?? {})) if (!ITEMS[id]) ghost.push(`${f}/${t}:${id}`)
  check('秘境档位', '结算奖励的物品 id 全部存在（无幽灵物品）', ghost.length === 0, ghost.join(', '))
  // ③ 对手随档位变强（只抬血会让高层变成「磨」，故攻防同抬）；等级不再封顶 99
  const o1 = realmOpponent(20, 99, 1, () => 0.1), o10 = realmOpponent(20, 99, 10, () => 0.1)
  check('秘境档位', '同层对手属性随档位提升（hp 与 atk 都涨）', o10.hp > o1.hp && o10.atk > o1.atk, `hp ${Math.round(o1.hp)}→${Math.round(o10.hp)} atk ${Math.round(o1.atk)}→${Math.round(o10.atk)}`)
  check('秘境档位', '对手等级上限由 99 抬到 140（与挑战塔同口径）', realmOpponentLevel(40, 120, 10) > 99, `实得 ${realmOpponentLevel(40, 120, 10)}`)
  // ④ 行为：结算达标即升档、封顶不再升、旧档归一化、脏值夹取、存档往返
  const p1 = freshPlayer()
  check('秘境档位', '新档从第 1 档开始', p1.realmTier() === 1)
  p1.realmStart(); for (let i = 0; i < realmTierGoal(1); i++) p1.realmAdvance()
  const end1 = p1.realmEnd()
  check('秘境档位', `通过 ${realmTierGoal(1)} 层即升到第 2 档`, p1.realmTier() === 2 && end1.tierUp?.to === 2, JSON.stringify(end1.tierUp))
  const p2 = freshPlayer(); p2.realm = { active: false, floor: 0, buffs: [], best: 3, pending: null }
  check('秘境档位', '旧档没有 tier 字段时回退第 1 档（不炸）', p2.realmTier() === 1)
  const p3 = freshPlayer(); p3.realm = { active: false, floor: 0, buffs: [], best: 3, pending: null, tier: 99 }
  // 🔴 口径 2026-09-29 变了：11 档起挂等级门槛 ⇒ **生效档位**夹到「当前等级能开的最高档」，
  //    而**存储值**仍夹到 REALM_TIER_MAX（不清洗，转生掉级期间只降低生效档、等级回来即恢复）。
  check('秘境档位', '脏值 tier 被夹到「当前等级能开的最高档」（存储值不越界、生效值不越权）',
    p3.realmState().tier === REALM_TIER_MAX && p3.realmTier() === realmTierCapFor(p3.combatLevel),
    `存储 ${p3.realmState().tier} 生效 ${p3.realmTier()} 上限 ${realmTierCapFor(p3.combatLevel)}`)
  {
    // 门槛（11~13 档 = Lv105/110/115）：低等级夹在 10、达标逐档放开、非法等级不放行
    const gateOk = REALM_TIER_GATES.every((g) =>
      realmTierCapFor(g.level) === g.tier && realmTierCapFor(g.level - 1) === g.tier - 1
      && realmTierUnlocked(g.tier, g.level) && !realmTierUnlocked(g.tier, g.level - 1))
    check('秘境档位', '门槛：第 11/12/13 档分别在对决 Lv105/110/115 解锁，低一级不放行；前 10 档一直开放',
      gateOk && realmTierCapFor(1) === 10 && realmTierCapFor(0) === 10
      && realmTierCapFor(null) === 10 && realmTierCapFor(NaN) === 10 && realmTierCapFor('abc') === 10
      && !realmTierUnlocked(NaN, 200) && !realmTierUnlocked(null, 200),
      REALM_TIER_GATES.map((g) => `${g.tier}@Lv${g.level}`).join(' '))
    // 行为：**存储档位高于当前等级能开的档**时，按低档打、且不再继续往上升
    const pg = freshPlayer(); pg.realm = { active: false, floor: 0, buffs: [], best: 0, pending: null, tier: 13 }
    const effLow = pg.realmTier()
    pg.realmStart(); for (let i = 0; i < 60; i++) pg.realmAdvance()
    const r = pg.realmEnd()
    check('秘境档位', '掉级期间：生效档降到 10、结算按生效档发奖、且不继续升档；存储值保留 13（等级回来即恢复）',
      effLow === 10 && r.tierUp === null && pg.realmState().tier === 13,
      `生效 ${effLow} 结算升档 ${JSON.stringify(r.tierUp)} 存储 ${pg.realmState().tier}`)
    // 🔴 这条才是「11 档起真有门槛」的判别式：低等级玩家把第 10 档刷穿 60 层（目标 42）
    //    **存储档位也不许升进 11** —— 只看「生效档」抓不到「升进去了但被夹回 10」的那种写法。
    const pl = freshPlayer(); pl.realm = { active: false, floor: 0, buffs: [], best: 0, pending: null, tier: 10 }
    pl.realmStart(); for (let i = 0; i < 60; i++) pl.realmAdvance()
    pl.realmEnd()
    check('秘境档位', '等级不够时不许升进第 11 档（存储档位也停在 10）',
      pl.realmState().tier === 10 && pl.realmTier() === 10,
      `存储 ${pl.realmState().tier} 生效 ${pl.realmTier()}`)
  }
  const p4 = freshPlayer(); p4.realm = { active: false, floor: 0, buffs: [], best: 3, pending: null, tier: 4 }
  const back4 = freshPlayer(); back4.applySave(JSON.parse(JSON.stringify(p4.serialize())))
  check('秘境档位', '档位随存档往返保留（含 serialize/applySave 三处）', back4.realmTier() === 4, `实得 ${back4.realmTier()}`)
  const p5 = freshPlayer({ knife: 115, tasteAcumen: 115, heatControl: 115 })
  p5.realm = { active: false, floor: 0, buffs: [], best: 3, pending: null, tier: REALM_TIER_MAX }
  p5.realmStart(); for (let i = 0; i < 60; i++) p5.realmAdvance()
  p5.realmEnd()
  check('秘境档位', '满档后不再继续升（封顶）', p5.realmTier() === REALM_TIER_MAX && p5.realmState().tier === REALM_TIER_MAX,
    `生效 ${p5.realmTier()} / 上限 ${REALM_TIER_MAX}`)
  void totalXpForLevel
}

// ══════════ C45b：后期难度的「可自选化 + 失败代价 + 续航可见」（2026-09-22）══════════
// 起因：实测 248 个敌人全部零败（中位 6.0 秒击杀）、塔在 F1000→F1200 之间从 100% 胜率掉到 20%（80pp 悬崖）
// ⇒ 「难」这件事在玩家侧是不可见的：没有档位、败了不掉进度、奥义停摆也不知道为什么打不动。
// 处置（用户 2026-09-22 批准「按合理平衡的方式改」）：
//   ① 难度档 **运行时叠加**（`applyTowerTier`）—— 敌人冻结数据一个字节不动，想加难只改 `TOWER_TIERS`；
//   ② 塔从第 5 层起被击退**退一层**（`onTowerLose`，`best` 纪录永不回退）；
//   ③ 战斗面板显示奥义续航（`aojiUpkeep`），且必须与真实扣点**同源**（否则又是「显示与结算不一致」）。
{
  const { TOWER_TIERS, towerTierOf, towerTierUnlocked, applyTowerTier, towerMilestoneKey, towerMilestone, towerFloor, TOWER_FLOOR_DROP_FROM } =
    await import('../../src/game/data/battleTower.js')
  const { AOJIS } = await import('../../src/game/data/aojis.js')
  /** 该玩家**当前实际生效**的对手属性倍率（= towerOpp 的 hp ÷ 同层无档位的 hp；用于钉「结算路径也走了出口」） */
  const topOppMult = (pl) => {
    const floor = Math.max(1, pl.tower?.floor ?? 1)
    const raw = towerFloor(floor, pl.combatLevel)
    const got = pl.towerOpp()
    return raw?.hp ? got.hp / raw.hp : 1
  }

  // ① 档位表本身：id 唯一、属性倍率与奖励倍率**同名同值**、标准档是第一档（= 默认，旧档回退目标）
  const ids = TOWER_TIERS.map((t) => t.id)
  check('难度档', `档位 id 唯一、不少于三档、带门槛的档位等级严格递增（${ids.join(' / ')}）`,
    ids.length >= 3 && new Set(ids).size === ids.length
    && TOWER_TIERS.filter((t) => t.reqLevel > 0).every((t, i, a) => i === 0 || t.reqLevel > a[i - 1].reqLevel),
    ids.join(' / '))
  check('难度档', '属性倍率严格递增且标准档 = ×1', TOWER_TIERS[0].mult === 1 && TOWER_TIERS.every((t, i) => i === 0 || t.mult > TOWER_TIERS[i - 1].mult), TOWER_TIERS.map((t) => t.mult).join(' / '))
  check('难度档', '每一档的属性倍率与奖励倍率相等（难 1.5 倍 ⇒ 奖励也 1.5 倍，不出现「更难但没多拿」）',
    TOWER_TIERS.every((t) => t.rewardMult === t.mult))
  check('难度档', '脏档/空档回退标准档（不产生越界倍率）', towerTierOf('nope').id === ids[0] && towerTierOf(undefined).id === ids[0] && towerTierOf(null).id === ids[0])
  // ①b 解锁门槛（2026-09-29 新增第 4 档「饕餮」= 末段 101-120 的零美术满足点，需对决 Lv105）
  {
    const gated = TOWER_TIERS.filter((t) => t.reqLevel > 0)
    check('难度档', '带门槛的档位：未达标一律不解锁，达标即解锁（唯一出口 towerTierUnlocked）',
      gated.length >= 1
      && gated.every((t) => !towerTierUnlocked(t.id, t.reqLevel - 1) && towerTierUnlocked(t.id, t.reqLevel) && towerTierUnlocked(t.id, 200))
      // 无门槛档位任何时候都解锁（前三档口径不变）
      && TOWER_TIERS.filter((t) => !t.reqLevel).every((t) => towerTierUnlocked(t.id, 1) && towerTierUnlocked(t.id, 0)),
      gated.map((t) => `${t.id}@Lv${t.reqLevel}`).join(' '))
    check('难度档', '非法等级不解锁（NaN / null / 字符串非数字）',
      gated.every((t) => !towerTierUnlocked(t.id, NaN) && !towerTierUnlocked(t.id, null) && !towerTierUnlocked(t.id, 'abc')),
      gated.map((t) => t.id).join(' '))
    // 🔴 行为：未解锁的档位**切不进去**，且**转生掉级后自动退回标准档**（读的时候也要复核，不能只在选择那一刻校验）
    {
      const tp = freshPlayer({ knife: 110, tasteAcumen: 110, heatControl: 110 })
      const high = gated[gated.length - 1]
      const setOk = tp.setTowerTier(high.id).id === high.id
      const atHigh = tp.towerTier().id === high.id
      // 掉等级（模拟转生）→ 读的时候必须回退
      tp.setSkillState('knife', { level: 40, exp: 0 })
      tp.setSkillState('tasteAcumen', { level: 40, exp: 0 })
      tp.setSkillState('heatControl', { level: 40, exp: 0 })
      const afterDrop = tp.towerTier().id
      const oppMult = topOppMult(tp)
      check('难度档', '门槛行为：达标可切 / 未达标切不进 / 掉级后自动回标准档（且对手倍率同步回 ×1）',
        setOk && atHigh && afterDrop === 'standard' && Math.abs(oppMult - 1) < 1e-9,
        `切=${setOk} 在位=${atHigh} 掉级后=${afterDrop} 对手倍率=${oppMult}`)
      const tp2 = freshPlayer({ knife: 40, tasteAcumen: 40, heatControl: 40 })
      const lockedSet = tp2.setTowerTier(high.id).id
      check('难度档', '未达标时 setTowerTier 拒绝切换（存档手改 / 旧前端也绕不过去）', lockedSet === 'standard', `实得 ${lockedSet}`)
    }
  }

  // ② `applyTowerTier` 是**纯函数**且只乘属性：不改传入的冻结对手对象、不动等级与掉落、不引入 NaN
  const base = towerFloor(50, 100)
  const snapshot = JSON.stringify(base)
  const elite = applyTowerTier(base, 'elite'), extreme = applyTowerTier(base, 'extreme')
  check('难度档', '叠加难度档**不修改**传入的对手对象（冻结数据不可被就地改写）', JSON.stringify(base) === snapshot)
  // ⚠️ hp/def/eva 会 `Math.round`（这三个在别处以整数使用与显示），atk 保留小数 ⇒ 断言用「取整后相等」而不是裸乘
  const mulOk = (o, m) => ['hp', 'atk', 'def', 'eva'].every((k) =>
    (k === 'atk' ? o[k] === base[k] * m : o[k] === Math.round(base[k] * m)))
  check('难度档', '精英/极限档把 hp/atk/def/eva 全部乘上倍率（整数属性取整）',
    mulOk(elite, 1.5) && mulOk(extreme, 2) && ['hp', 'atk', 'def', 'eva'].every((k) => elite[k] > base[k] && extreme[k] > elite[k]),
    `hp ${Math.round(base.hp)} → ${Math.round(elite.hp)} / ${Math.round(extreme.hp)}`)
  check('难度档', '档位不改变对手等级与掉落（等级一致才能「同层同等级、只是更硬」）',
    elite.level === base.level && extreme.level === base.level && JSON.stringify(elite.drops) === JSON.stringify(base.drops))
  check('难度档', '标准档属性与原始对手逐字段一致（×1 不引入任何漂移）',
    JSON.stringify(applyTowerTier(base, 'standard')) === snapshot)
  check('难度档', '对手属性无 NaN（倍率作用后仍是可结算的数）', ['hp', 'atk', 'def', 'eva', 'crit'].every((k) => Number.isFinite(extreme[k])))

  // ③ 里程碑按档放大：**金币与券乘以倍率，物品数量一件不加**（物品翻倍会直接破物品经济）
  const m1 = towerMilestone(100, 1), m2 = towerMilestone(100, 2)
  check('难度档', '里程碑金币与抽卡券随档位倍率放大', m2.gold === m1.gold * 2 && m2.tickets === m1.tickets * 2, `${m1.gold}/${m1.tickets} → ${m2.gold}/${m2.tickets}`)
  check('难度档', '里程碑**物品**数量不随档位变化（奖励放大只走金币与券，不动物品产出）',
    JSON.stringify(m2.items) === JSON.stringify(m1.items), JSON.stringify(m2.items))
  check('难度档', '非法奖励倍率回退 ×1（0/负数/NaN/字符串都不会把奖励清零或放大）',
    [0, -1, NaN, 'x', undefined].every((v) => towerMilestone(100, v).gold === m1.gold))
  check('难度档', '里程碑换算带档位标识（同层不同档各记一笔；标准档沿用裸层号以兼容旧档）',
    towerMilestoneKey(100, 'standard') === 100 && towerMilestoneKey(100, 'elite') === 'elite:100')

  // ④ 行为（真实 store）：切档生效、按档发奖、重复不重发、按档分别记账、失败退层、best 不回退
  const tp = freshPlayer()
  check('难度档', '新档默认标准档', tp.towerTier().id === 'standard')
  tp.setTowerTier('elite')
  check('难度档', '切档后 towerTier() 立即生效（页面选择与结算同源）', tp.towerTier().id === 'elite')
  tp.tower = { floor: 10, best: 9, rewarded: [], tier: 'elite' }
  const g0 = tp.gold
  tp.onTowerWin(10)
  check('难度档', '精英档里程碑按 ×1.5 发金币（不是按标准档发）', tp.gold - g0 === towerMilestone(10, 1.5).gold, `实发 ${tp.gold - g0}，标准档应为 ${towerMilestone(10, 1).gold}`)
  const g1 = tp.gold
  tp.onTowerWin(10) // 同档重复通过同一层（页面重复发事件时）
  check('难度档', '同一档位同一层的里程碑只发一次', tp.gold === g1)
  tp.setTowerTier('extreme')
  const rExt = tp.towerMilestoneClaimed(10)
  check('难度档', '已领判定按**当前档位**的键（精英已领 ≠ 极限已领）', rExt === false)
  const g2 = tp.gold
  tp.onTowerWin(10)
  check('难度档', '换档后同一层按新档位再记一笔并发 ×2 奖励（各档分别记账）', tp.gold - g2 === towerMilestone(10, 2).gold)
  // ⚠️ 这条是**唯一能区分两套键**的断言：标准档领过 F10 之后切到精英档，该层必须判为「未领」。
  //    写成 `rewarded.includes(floorNum)`（丢掉档位前缀）时它同样返回 true ⇒ 本断言 FAIL。
  //    （第一版只查「精英已领 ≠ 极限已领」，两者键都带前缀、**永远不会相撞** ⇒ 反例验证时是假绿。）
  const tp2 = freshPlayer()
  tp2.tower = { floor: 11, best: 10, rewarded: [], tier: 'standard' }
  tp2.onTowerWin(10)
  const claimedStd = tp2.towerMilestoneClaimed(10)
  tp2.setTowerTier('elite')
  check('难度档', '标准档领过的层，切到精英档必须判为「未领」（键带档位前缀，不是裸层号）',
    claimedStd === true && tp2.towerMilestoneClaimed(10) === false,
    `标准档 ${claimedStd} / 切档后 ${tp2.towerMilestoneClaimed(10)}`)
  // 旧档兼容：老存档 `rewarded` 里是**裸层号**
  const oldP = freshPlayer()
  oldP.tower = { floor: 20, best: 19, rewarded: [10], tier: 'standard' }
  check('难度档', '旧档（rewarded 为裸层号）的「已领」判定仍然成立（老玩家不会被重发）', oldP.towerMilestoneClaimed(10) === true)
  // 失败代价
  const lp1 = freshPlayer()
  lp1.tower = { floor: 10, best: 10, rewarded: [], tier: 'standard' }
  const d1 = lp1.onTowerLose(10)
  check('难度档', `第 ${TOWER_FLOOR_DROP_FROM} 层起被击退退一层`, d1.dropped === true && lp1.tower.floor === 9, `floor=${lp1.tower.floor}`)
  check('难度档', '被击退**不抹掉**最高层纪录', lp1.tower.best === 10)
  const lp2 = freshPlayer()
  lp2.tower = { floor: 3, best: 3, rewarded: [], tier: 'standard' }
  const d2 = lp2.onTowerLose(3)
  check('难度档', `低层（< ${TOWER_FLOOR_DROP_FROM}）被击退不扣层（不惩罚新手）`, d2.dropped === false && lp2.tower.floor === 3)
  const lp3 = freshPlayer()
  lp3.tower = { floor: 1, best: 8, rewarded: [], tier: 'standard' }
  lp3.onTowerLose(1)
  check('难度档', '层号不会被退到 0 以下', lp3.tower.floor >= 1)
  // 存档往返（tier 三处齐备）
  const sp = freshPlayer()
  sp.setTowerTier('extreme')
  const spBack = freshPlayer()
  spBack.applySave(JSON.parse(JSON.stringify(sp.serialize())))
  check('难度档', '难度档随存档往返保留（defaultState/serialize/applySave 三处）', spBack.towerTier().id === 'extreme', `实得 ${spBack.towerTier().id}`)
  const spDirty = freshPlayer()
  spDirty.applySave({ ...sp.serialize(), tower: { floor: 5, best: 4, rewarded: [], tier: 'bogus' } })
  check('难度档', '存档里的脏档位被夹回标准档（不炸、也不产生越界倍率）', spDirty.towerTier().id === 'standard')

  // ⑤ 奥义续航：显示与扣点**必须同源**（否则又是「页面写能撑 10 分钟、实际 3 分钟就熄火」）
  const ap = freshPlayer()
  const a0 = AOJIS[0], a1 = AOJIS[1] // 0.5 + 0.6 = 1.1/秒（**小数**费率：扣点是「累积后取整」，不会超前扣）
  const aInt = AOJIS.find((x) => Number.isInteger(x.costPerSec) && x.costPerSec > 0) // 1.0/秒，用于精确断言
  ap.gastronomy.active = [a0.id, a1.id]
  ap.tastePoints = 600
  ap._aojiActivatedAt = { [a0.id]: 1, [a1.id]: 1 } // 远古时间 ⇒ 已过 10 秒宽限期
  const up = ap.aojiUpkeep()
  const expect = a0.costPerSec + a1.costPerSec
  check('续航', '续航面板的「每秒消耗」与结算出口 `aojiCostPerSec()` 同源', up.costPerSec === ap.aojiCostPerSec() && up.costPerSec === expect, `显示 ${up.costPerSec} / 出口 ${ap.aojiCostPerSec()} / 应为 ${expect}`)
  check('续航', '剩余秒数 = 品鉴点 ÷ 每秒消耗（向下取整）', up.secondsLeft === Math.floor(600 / expect), `实得 ${up.secondsLeft}`)
  check('续航', '点数充裕时不报警（阈值 60 秒以内才提示）', up.low === false && up.active.length === 2)
  const ap2 = freshPlayer()
  ap2.gastronomy.active = [a0.id]
  ap2.tastePoints = 20 // 20 ÷ 0.5 = 40 秒 ⇒ 应进入低警告
  ap2._aojiActivatedAt = { [a0.id]: 1 }
  check('续航', '撑不到 1 分钟时进入低警告状态（深塔连战最该看到的提示）', ap2.aojiUpkeep().low === true && ap2.aojiUpkeep().secondsLeft === 40, JSON.stringify(ap2.aojiUpkeep()))
  const ap3 = freshPlayer()
  ap3.gastronomy.active = [aInt.id]
  ap3.tastePoints = 100
  ap3._aojiActivatedAt = { [aInt.id]: 1 }
  const before = ap3.tastePoints
  ap3.drainAoji(1000) // 跑满 1 秒
  check('续航', `跑满 1 秒正好扣掉「每秒消耗」（费率 ${aInt.costPerSec}/秒 ⇒ 实扣 ${aInt.costPerSec}）`, before - ap3.tastePoints === aInt.costPerSec, `实扣 ${before - ap3.tastePoints}`)
  for (let i = 0; i < 9; i++) ap3.drainAoji(1000)
  check('续航', '连跑 10 秒的扣点总量 = 速率 × 10（面板速率就是真实速率）', before - ap3.tastePoints === aInt.costPerSec * 10, `实扣 ${before - ap3.tastePoints}`)
  // 小数费率：1 秒只扣整数部分（余数结转，不四舍五入超前扣费）
  const ap4 = freshPlayer()
  ap4.gastronomy.active = [a0.id]
  ap4.tastePoints = 100
  ap4._aojiActivatedAt = { [a0.id]: 1 }
  ap4.drainAoji(1000)
  check('续航', `小数费率（${a0.costPerSec}/秒）首秒只扣 ${Math.floor(a0.costPerSec)}，余数结转到下一秒（不超前扣）`,
    100 - ap4.tastePoints === Math.floor(a0.costPerSec), `实扣 ${100 - ap4.tastePoints}`)
  const ap5 = freshPlayer()
  ap5.tastePoints = 5
  ap5.gastronomy.active = [a0.id]
  ap5._aojiActivatedAt = { [a0.id]: 1 }
  ap5.drainAoji(60000)
  check('续航', '品鉴点耗尽后奥义全部熄灭（界面上的「还能撑多久」是硬约束，不是参考值）', ap5.gastronomy.active.length === 0 && ap5.tastePoints === 0)
}

// ══════════ C45c：战斗 × buff/加成 的口径收口（2026-09-22，源自 combat_buff_audit 体检）══════════
// 体检（`scripts/sim/combat_buff_audit.mjs`，真实引擎 134 项）查出并修掉的问题，逐条钉住：
//   ① 「品鉴值上限」曾有三套口径：道树 % 被算两次、图谱 % 只在战斗里生效、料理回血又按未加成的值封顶；
//   ② 「攻速 +%」撞 1.2s 硬下限后零效果，而界面上毫无提示（玩家为 4 个奥义白付品鉴点）；
//   ③ 奥义「受到伤害 -15%」在界面上完全不可见；④ buff 的 critChance 显示成 0.1 而不是 10%；
//   ⑤ 灼烧日志缺伤害数字；⑥ 饼干加成会被「之后用的酱料」顺带延长；⑦ 任何未消费的 buff 键都会静默无效。
{
  const fsMod = await import('node:fs')
  const { COMBAT_SPEED_FLOOR_SEC, COMBAT_SPEED_DECAY_PER_LEVEL, COMBAT_SPEED_GEAR_GAP_SHARE, combatTurnIntervalSec, combatSpeedAtCap, combatSpeedCapLevel, gearSpeedEffective } =
    await import('../../src/game/data/caps.js')
  const { Combat } = await import('../../src/game/combat/Combat.js')
  const { ITEMS } = await import('../../src/game/data/items.js')
  const { DAO_NODES } = await import('../../src/game/data/daoTree.js')
  const { INSIGHT_NODES } = await import('../../src/game/data/insightTree.js')
  const { REALM_BUFFS } = await import('../../src/game/data/mysticRealm.js')
  const { AOJIS } = await import('../../src/game/data/aojis.js')
  const rd = (p) => fsMod.readFileSync(p, 'utf8')

  // ① 品鉴值上限：**一个数**（store getter = 战斗口径），且每个来源只乘一次
  const withSources = (apply) => {
    const p = freshPlayer()
    p.skills.knife.level = 80
    p.skills.tasteAcumen.level = 80
    const base = p.maxHp
    apply(p)
    const c = new Combat(p)
    return { store: p.maxHp, combat: c.playerStats().maxHp, base }
  }
  const daoHpNode = DAO_NODES.find((n) => (n.effect?.maxHpPct ?? 0) > 0)
  const insHpNode = INSIGHT_NODES.find((n) => (n.effect?.maxHpPct ?? 0) > 0)
  const r1 = withSources((p) => { p.daoUnlocked = [daoHpNode.id] })
  const r2 = withSources((p) => { p.insights = [insHpNode.id] })
  const r3 = withSources((p) => { p.realm = { active: true, floor: 1, buffs: ['hp15'], best: 0, pending: null } })
  const once = (r, pct) => Math.abs(r.combat / r.base - (1 + pct / 100)) < 0.02
  check('战斗口径', '品鉴值上限：store 与战斗**同一个数**（不再各乘一遍）',
    [r1, r2, r3].every((r) => Math.abs(r.store - r.combat) <= 1),
    `道树 ${r1.store}/${r1.combat} · 图谱 ${r2.store}/${r2.combat} · 秘境 ${r3.store}/${r3.combat}`)
  check('战斗口径', `品鉴值上限：每个来源只乘一次（道树 +${daoHpNode.effect.maxHpPct}%、图谱 +${insHpNode.effect.maxHpPct}%、秘境 +15%）—— 修前道树被算两次`,
    once(r1, daoHpNode.effect.maxHpPct) && once(r2, insHpNode.effect.maxHpPct) && once(r3, 15),
    `实测比 道树 ${(r1.combat / r1.base).toFixed(3)} · 图谱 ${(r2.combat / r2.base).toFixed(3)} · 秘境 ${(r3.combat / r3.base).toFixed(3)}`)
  // 回血封顶：从「差 10 点满血」吃一口，必须补到**战斗上限**（修前料理按未加成的 store 值封顶 ⇒
  // 秘境带 hp15 时最小值会把玩家**从 910 拉回 800**，比饿着还差）
  {
    const p = freshPlayer()
    p.skills.tasteAcumen.level = 80
    p.realm = { active: true, floor: 1, buffs: ['hp15'], best: 0, pending: null }
    const c = new Combat(p)
    const cap = Math.round(c.playerStats().maxHp)
    const food = Object.values(ITEMS).filter((it) => it.type === 'food' && (it.heal ?? 0) >= 50).sort((a, b) => b.heal - a.heal)[0]
    p.inventory[food.id] = 5
    c.inFight = true
    p.setCombat({ hp: cap - 10 })
    c.useFood(food.id, true)
    const foodTop = p.combat.hp
    check('战斗口径', '回血封顶一致：料理补到**战斗上限**（修前封在未加成的 store 值上，甚至会把血拉低）',
      Math.abs(foodTop - cap) <= 1, `料理补到 ${foodTop}，战斗上限 ${cap}（起始 ${cap - 10}）`)
  }

  // ② 攻速：地板常量单一来源 + 撞顶必须被标记（界面据此提示）
  const combatSrc = rd('src/game/combat/Combat.js')
  check('战斗口径', '攻速地板常量只有一处（`caps.js` 的 `COMBAT_SPEED_FLOOR_SEC`），引擎与界面都引用它',
    /COMBAT_SPEED_FLOOR_SEC/.test(combatSrc) && /combatTurnIntervalSec/.test(combatSrc) && !/Math\.max\(1\.2/.test(combatSrc),
    'Combat.js 里不得再出现写死的 1.2')
  const capP = freshPlayer()
  capP.skills.knife.level = 80
  const capC = new Combat(capP)
  const capSt = capC.playerStats()
  check('战斗口径', `撞顶标记：等级 80（原始间隔 ${combatTurnIntervalSec(80, 0, 0).toFixed(2)}s ≤ 下限 ${COMBAT_SPEED_FLOOR_SEC}s）⇒ speedAtCap 必须为 true`,
    capSt.speedAtCap === true && capSt.speedFloorMs === COMBAT_SPEED_FLOOR_SEC * 1000, JSON.stringify({ cap: capSt.speedAtCap, floor: capSt.speedFloorMs }))
  const lowP = freshPlayer()
  lowP.skills.knife.level = 30
  check('战斗口径', `未撞顶时不误报（等级 30 ⇒ 原始间隔 ${combatTurnIntervalSec(30, 0, 0).toFixed(2)}s > 下限 ⇒ speedAtCap 为 false）`,
    new Combat(lowP).playerStats().speedAtCap === false)
  // ── 攻速曲线：**到顶等级**与「曲线常量单一来源」（2026-09-22 用户报「吃颗饼干就顶了」后把衰减压平）──
  // ⚠️ 判断源码前必须 **stripComments**：Combat.js 第 2 行的注释就写着「基础 2.4s/回合」，
  //    不剥注释的话 `/\b2\.4\b/` 会拿注释当真代码（首版就是这么误判的）。
  const { stripComments } = await import('./lib/comments.mjs')
  const combatCode = stripComments(combatSrc)
  check('战斗口径', '攻速曲线常量单一来源（`caps.js` 定义衰减与基准；引擎里不得再出现 2.4 / 0.02 这类字面量）',
    /COMBAT_SPEED_DECAY_PER_LEVEL/.test(rd('src/game/data/caps.js')) && /combatTurnIntervalSec/.test(combatCode)
      && !/\b2\.4\b/.test(combatCode) && !/0\.02/.test(combatCode),
    `当前衰减 ${COMBAT_SPEED_DECAY_PER_LEVEL}/级`)
  // 🔴 2026-09-26 用户①「硬下限依然会通过装备很快到达」⇒ 装备攻速改成**软上限**
  //    （最多关掉「等级曲线 → 地板」剩余距离的一半）⇒ 到顶等级**与装备无关**，一律 L75。
  check('战斗口径', `到顶等级 = L${combatSpeedCapLevel(0)}，且**带攻速装也是同一级**（装备不再是撞地板的原因；改前是 75/66/57/38）`,
    combatSpeedCapLevel(0) === 75 && combatSpeedCapLevel(0.15) === 75 && combatSpeedCapLevel(0.3) === 75 && combatSpeedCapLevel(0.6) === 75,
    `实得 ${combatSpeedCapLevel(0)}/${combatSpeedCapLevel(0.15)}/${combatSpeedCapLevel(0.3)}/${combatSpeedCapLevel(0.6)}`)
  check('战斗口径', '到顶边界：L74 未到顶、L75 刚好到顶（级数边界不能差一级）',
    combatSpeedAtCap(74, 0) === false && combatSpeedAtCap(75, 0) === true,
    `L74=${combatSpeedAtCap(74, 0)} L75=${combatSpeedAtCap(75, 0)}`)
  check('战斗口径', '**满级仍是 1.2s 顶**（L120 间隔 == 地板 ⇒ 毕业时长标定与塔的墙不受影响）',
    combatTurnIntervalSec(120, 0, 0) === COMBAT_SPEED_FLOOR_SEC && combatTurnIntervalSec(120, 0, 25) === COMBAT_SPEED_FLOOR_SEC)
  // 用户报的那件事本身：单吃一颗 +10% 饼干**不该**在 L60 就顶满（旧曲线 0.02 时 L54 就顶）
  check('战斗口径', '用户报的场景：单颗 +10% 饼干在 L60 仍有效（旧曲线 L54 起就顶满）、到 L74 仍有效',
    combatTurnIntervalSec(60, 0, 10) < combatTurnIntervalSec(60, 0, 0) && combatTurnIntervalSec(74, 0, 10) < combatTurnIntervalSec(74, 0, 0),
    `L60 ${combatTurnIntervalSec(60, 0, 0).toFixed(2)}→${combatTurnIntervalSec(60, 0, 10).toFixed(2)}s`)
  // 前期几乎不动（改曲线不能顺手把 L1~L30 也改了）
  check('战斗口径', '前期不受影响（L1 与 L30 的间隔与旧曲线偏差 <5%）',
    Math.abs(combatTurnIntervalSec(1, 0, 0) - 2.38) < 0.05 && Math.abs(combatTurnIntervalSec(30, 0, 0) - 1.92) < 0.05,
    `L1 ${combatTurnIntervalSec(1, 0, 0).toFixed(2)}s · L30 ${combatTurnIntervalSec(30, 0, 0).toFixed(2)}s`)
  check('战斗口径', '`combatSpeedAtCap()` 与引擎判定同源（同一个函数，不是两套阈值）',
    combatSpeedAtCap(80, 0) === true && combatSpeedAtCap(30, 0) === false && combatSpeedAtCap(50, 0.6) === false,
    `30 级 ⇒ ${combatSpeedAtCap(30, 0)}（未撞顶）· 50 级 + 0.6s 装 ⇒ ${combatSpeedAtCap(50, 0.6)}（**不再**因装备撞顶）`)
  // 装备软上限的三条不变量：低等级足额 · 永不越界 · 单调（多穿一件不会更慢）
  {
    check('战斗口径', `装备软上限常数在 [0,1] 内（现 ${COMBAT_SPEED_GEAR_GAP_SHARE}）`,
      COMBAT_SPEED_GEAR_GAP_SHARE >= 0 && COMBAT_SPEED_GEAR_GAP_SHARE <= 1)
    check('战斗口径', '低等级装备**足额（或仅差一丝）生效**：L1 剩余距离 1.184s ⇒ 0.6s 装实得 ≥98%（不是一上来就打折）',
      gearSpeedEffective(1, 0.6) >= 0.6 * 0.98 && Math.abs(gearSpeedEffective(1, 0.15) - 0.15) < 1e-9,
      `L1：0.6→${gearSpeedEffective(1, 0.6).toFixed(3)}（上限 ${(1.184 * COMBAT_SPEED_GEAR_GAP_SHARE).toFixed(3)}）· 0.15→${gearSpeedEffective(1, 0.15).toFixed(3)}`)
    check('战斗口径', '高等级装备**吃不掉最后一半**（L60：0.6s 装实得 0.12s；改前是全额 0.6s ⇒ 直接把间隔压到地板）',
      Math.abs(gearSpeedEffective(60, 0.6) - 0.12) < 1e-9 && combatTurnIntervalSec(60, 0.6) > COMBAT_SPEED_FLOOR_SEC,
      `L60：实得 ${gearSpeedEffective(60, 0.6).toFixed(3)}s · 间隔 ${combatTurnIntervalSec(60, 0.6).toFixed(2)}s`)
    check('战斗口径', '装备实得**永不超过剩余距离的一半**（枚举 1~120 级 × 含非法输入）',
      [0, 0.15, 0.3, 0.6, 1.2, -1, NaN].every((g) =>
        Array.from({ length: 120 }, (_, i) => i + 1).every((lv) =>
          gearSpeedEffective(lv, g) <= Math.max(0, 2.4 - lv * COMBAT_SPEED_DECAY_PER_LEVEL - COMBAT_SPEED_FLOOR_SEC) * COMBAT_SPEED_GEAR_GAP_SHARE + 1e-9)),
      '装备不能把间隔压到地板以下')
    check('战斗口径', '间隔随装备单调不增（穿得越多不会反而更慢）',
      [1, 20, 50, 74].every((lv) => combatTurnIntervalSec(lv, 0.6) <= combatTurnIntervalSec(lv, 0.3) + 1e-9 && combatTurnIntervalSec(lv, 0.3) <= combatTurnIntervalSec(lv, 0) + 1e-9))
    check('战斗口径', '引擎里没有第二份装备折扣（`gearSpeedEffective` 只在 caps.js）',
      !/gearSpeedEffective/.test(combatCode) && /gearSpeedEffective/.test(rd('src/game/data/caps.js')))
  }
  check('战斗口径', '回合间隔公式是唯一出口（同参数下与引擎 speedMs 一致）',
    new Combat(lowP).playerStats().speedMs === Math.floor(combatTurnIntervalSec(30, 0, 0) * 1000))
  // 界面侧接线（撞顶提示的三处：属性面板 / 奥义页 / 饼干按钮）
  const panelSrc = rd('src/components/CombatPanel.vue')
  const arenaSrc = rd('src/components/CombatArena.vue')
  const gastroSrc = rd('src/views/GastronomyView.vue')
  check('战斗口径', '撞顶提示接线齐备（属性面板写「已到上限」· 奥义页给攻速类奥义挂警告 · 饼干按钮标「已到上限」）',
    /已到上限/.test(panelSrc) && /speedAtCap/.test(panelSrc) && /speedWasted/.test(gastroSrc) && /badge-warn/.test(gastroSrc) && /speedAtCap/.test(arenaSrc),
    '缺一处玩家就会看到「点了没变化」')
  // ③ 受伤减免（奥义 defensePct）暴露给界面，且 opponentAttack 与界面读同一个值
  const takenP = freshPlayer()
  takenP.skills.knife.level = 80
  const aojiDef = AOJIS.find((a) => (a.effect?.defensePct ?? 0) > 0)
  takenP.gastronomy.active = [aojiDef.id]
  takenP._aojiActivatedAt = { [aojiDef.id]: 1 }
  takenP.tastePoints = 99999
  const takenC = new Combat(takenP)
  check('战斗口径', `奥义「${aojiDef.name}」的受伤减免暴露成 damageTakenPct（界面「受击减免」行读它）`,
    takenC.playerStats().damageTakenPct === aojiDef.effect.defensePct && /damageTakenPct/.test(panelSrc) && /受击减免/.test(panelSrc),
    `damageTakenPct=${takenC.playerStats().damageTakenPct}`)
  // ⚠️ 上面那条只查「文本存在」——把整行的**条件**改成 `...(false` 时它照样 PASS（首版反例验证就漏了）。
  //    这里补上「条件必须是 `takenPct.value > 0`」的断言，让「悄悄禁用这一行」也会 FAIL。
  check('战斗口径', '「受击减免」行是**按条件真的渲染出来**的（不是被 `...(false` 之类悄悄禁用）',
    /takenPct\.value > 0/.test(panelSrc))

  // ④ buff 文案：critChance 按百分比显示
  check('战斗口径', '增益行把 critChance 显示成百分比（修前面板写 +0.1、日志写 +10）',
    /critChance' \? Math\.round\(Number\(v\) \* 100\)/.test(panelSrc))
  check('战斗口径', '增益行为 0 值时不出「+0」噪声（buff 到期扣回 0 之后仍会显示）',
    /\(Number\(v\) \|\| 0\) !== 0/.test(panelSrc))

  // ⑤ 灼烧日志必须带伤害数字（与结算同一个 `o.level * 0.5`）
  check('战斗口径', '灼烧日志带伤害数字（修前是「每回合损失 生命值」，数字空洞）',
    /每回合损失 \$\{Math\.max\(1, Math\.floor\(o\.level \* 0\.5\)\)\} 生命值/.test(combatSrc))

  // ⑥ 饼干自己的增益计时：不被酱料延长、到期只扣自己那份
  {
    const { opp } = await import('../../src/game/data/combat.js')
    /** 造一个打不死也打不死的「桩」对手，好让 resolveTurn 能连着跑几回合 */
    const dummy = (c) => {
      c.opponent = opp(20, '计时桩', 'flavor', { hp: 1e7 })
      c.oppStyle = 'flavor'
      c.opponentHp = 1e7
      c.inFight = true
    }
    const p = freshPlayer()
    p.skills.knife.level = 80
    p.skills.tasteAcumen.level = 80
    const c = new Combat(p)
    dummy(c)
    p.inventory.energyBiscuit = 3
    p.setCombat({ hp: 1e6, flavorEnergy: 100 })
    const sauce = Object.values(ITEMS).find((it) => it.buff && !it.drunk && it.type !== 'drink' && (it.buff.duration ?? 0) >= 10)
    p.inventory[sauce.id] = 3
    c.useSauce(sauce.id) // 先来一瓶 10 回合酱料
    const accFromSauce = c.buffs.accuracy
    c.useEnergyBiscuit() // 再吃饼干（自身 5 回合）
    const accAfterBoth = c.buffs.accuracy
    for (let i = 0; i < 5; i++) c.resolveTurn() // 跑 5 回合：饼干应到期，酱料还在
    const biscuitGone = c.biscuitTurns === 0 && c.biscuitSpeedPct === 0
    const sauceKept = c.buffs.accuracy === accFromSauce && accAfterBoth === accFromSauce + BISCUIT_ACC
    const sauceStillOn = c.buffTurns > 0
    check('战斗口径', '饼干增益按**自己的**回合数到期（5 回合），不被 10 回合的酱料延长；且到期只扣自己那份（酱料属性仍在）',
      biscuitGone && sauceKept && sauceStillOn,
      JSON.stringify({ biscuitGone, sauceKept, sauceStillOn, accFromSauce, accAfterBoth, buffTurns: c.buffTurns }))
    // 反方向：饼干剩余回合不该被后来的酱料拉长
    const p2 = freshPlayer()
    p2.skills.knife.level = 80
    const c2 = new Combat(p2)
    dummy(c2)
    p2.inventory.energyBiscuit = 3
    p2.inventory[sauce.id] = 3
    c2.useEnergyBiscuit()
    c2.useSauce(sauce.id)
    check('战斗口径', '饼干剩余回合不被后来的酱料拉长（`biscuitTurns` 与 `buffTurns` 是两个计数）',
      c2.biscuitTurns === 5 && c2.buffTurns >= 10, JSON.stringify({ biscuit: c2.biscuitTurns, item: c2.buffTurns }))
    check('战斗口径', '界面显示的增益回合取两个来源的较大者（`buffTurnsLeft()`）',
      c2.buffTurnsLeft() === Math.max(c2.buffTurns, c2.biscuitTurns) && /buffTurnsLeft/.test(panelSrc))
  }

  // ⑦ buff 键必须是引擎真消费的键（静默无效的防护：`speed` 现在真变速，其余不许出现）
  {
    const CONSUMED = new Set(['atk', 'accuracy', 'defense', 'evasion', 'critChance', 'speed', 'duration'])
    const offenders = []
    for (const it of Object.values(ITEMS)) {
      if (!it.buff || typeof it.buff !== 'object') continue
      for (const k of Object.keys(it.buff)) if (!CONSUMED.has(k)) offenders.push(`${it.id}.${k}`)
    }
    check('战斗口径', `物品数据里的每个 buff 键都被引擎消费（扫描 ${Object.values(ITEMS).filter((i) => i.buff).length} 件带 buff 的物品）`,
      offenders.length === 0, offenders.slice(0, 6).join(', '))
    // `speed` 键必须真的进攻速（否则「加个 speed 酱料」会静默无效）
    const spP = freshPlayer()
    spP.skills.knife.level = 30
    const spC = new Combat(spP)
    const before = spC.playerStats().speedMs
    spC.addBuff('item', { speed: 20 }, 3)
    const after = spC.playerStats().speedMs
    check('战斗口径', '`buff.speed` 真的缩短回合间隔（此前只有标签表里有 speed、引擎不读 ⇒ 静默无效）',
      after < before, `${before} → ${after}ms`)
  }
}

// ══════════ C46b：敌人节奏三件套（(a) 按伤害给经验 · (b) 击杀重生间隔 · (c) 低中段血量分档）══════════
// 背景（2026-09-22 用户「关于打敌人，太快结束战斗的应该提高血量吧」→ 对比 Melvor/Rocky 后「abc 都做」）：
//   实测改前 248 个敌人同等级中位 6.0s（L1~20 只有 4.8s、最快 2 回合），而参考作 Melvor 的练级击杀
//   普遍「数秒~数十秒」，且那边有 **3 秒重生 + 按伤害给经验**（所以「一击秒杀」是亏的）。
//   本作原本两条都没有 ⇒ 秒杀是纯赚。三件事**必须成套**：(c) 加血会按比例砍掉每小时击杀，
//   只有 (a) 把经验改成「按造成的伤害」之后，「加血」才不亏经验（这正是参考作的设计）。
{
  const fsMod2 = await import('node:fs')
  const { scaledEnemy, enemyHpMult, enemyScalingText, ENEMY_HP_BANDS } = await import('../../src/game/data/enemyScaling.js')
  const { combatXpPerSkill, xpKillBaseline, expectedEnemyHpAt, creditableDamage, XP_DAMAGE_CAP_MULT, xpPerDamage } = await import('../../src/game/data/combatXpCurve.js')
  const { COMBAT_REGIONS, COMBAT_BOSSES } = await import('../../src/game/data/combat.js')
  const { COMBAT_RESPAWN_SEC } = await import('../../src/game/data/caps.js')
  const { Combat: CombatCls } = await import('../../src/game/combat/Combat.js')
  const rd = (p) => fsMod2.readFileSync(p, 'utf8') // 本块自带的读文件小工具（C45c 里的 rd 是块级作用域）

  // (c) 分档表本身
  check('敌人节奏', `血量分档：倍率单调不增、满级为 1、最高倍率（${Math.max(...ENEMY_HP_BANDS.map((b) => b.mult))}）≤ 经验伤害上限倍率（${XP_DAMAGE_CAP_MULT}）—— 否则加血会亏经验`,
    ENEMY_HP_BANDS.every((b, i) => i === 0 || b.mult <= ENEMY_HP_BANDS[i - 1].mult) && ENEMY_HP_BANDS[ENEMY_HP_BANDS.length - 1].mult === 1
      && Math.max(...ENEMY_HP_BANDS.map((b) => b.mult)) <= XP_DAMAGE_CAP_MULT, enemyScalingText())
  check('敌人节奏', `分档生效区间：L1×${enemyHpMult(1)} · L20×${enemyHpMult(20)} · L30×${enemyHpMult(30)} · L50×${enemyHpMult(50)} · L61×${enemyHpMult(61)}（后期不动）`,
    enemyHpMult(1) === 2 && enemyHpMult(20) === 2 && enemyHpMult(21) === 1.8 && enemyHpMult(41) === 1.5 && enemyHpMult(61) === 1)
  // `scaledEnemy` 必须是纯函数 + 幂等（列表先缩放、引擎再缩放 = ×4 的坑）
  const sample = COMBAT_REGIONS[0].opponents[0]
  const before = JSON.stringify(sample)
  const once = scaledEnemy(sample)
  const twice = scaledEnemy(once)
  check('敌人节奏', '`scaledEnemy` 是纯函数（不改传入的冻结数据）、幂等（重复调用不再乘一次）',
    JSON.stringify(sample) === before && twice === once && once.hp === Math.max(1, Math.round(sample.hp * enemyHpMult(sample.level))),
    `hp ${sample.hp} → ${once.hp}（×${once.hpMult}）→ 再调用仍 ${twice.hp}`)
  // 引擎入场也必须套分档（任何调用点都绕不过去）
  {
    const p0 = freshPlayer()
    p0.skills.knife.level = 1
    const c0 = new CombatCls(p0)
    const o0 = COMBAT_REGIONS[0].opponents[0]
    c0.start(o0)
    check('敌人节奏', '引擎入场时幂等地再确认一次分档（`Combat.start` 里套 `scaledEnemy`）—— 任何调用点都绕不过去',
      c0.opponentHp === scaledEnemy(o0).hp && o0.hp !== c0.opponentHp, `数据 ${o0.hp} → 入场 ${c0.opponentHp}`)
    c0.inFight = false
  }
  // 冻结数据基线：敌人血量一个字节都不能动（改血量只能走读取点）
  const flat = [...COMBAT_REGIONS.flatMap((r) => r.opponents), ...COMBAT_BOSSES]
  check('敌人节奏', `冻结的敌人数据未被改动（248 个敌人血量合计基线 = 87906）`,
    flat.length === 248 && flat.reduce((s, e) => s + e.hp, 0) === 87906, `实得 ${flat.length} 个 / 合计 ${flat.reduce((s, e) => s + e.hp, 0)}`)

  // (a) 经验口径：同等级击杀 == 旧口径（成长标定不动）；加血后成比例上升（不亏经验）
  // ⚠️ 必须用**写死的冻结基线**比对，不能拿 `xpKillBaseline()` 当参照 —— 那是自比自：
  //    把曲线整体 ×1.3 时两边一起变、比值恒为 1 ⇒ 首版反例验证时就抓不住（假绿）。
  // 🔴 2026-09-26 用户 ⑦ 之后分两段钉（**这是有意改数值，不是回归**）：
  //    · L20 起**仍是旧基线**——那是「战斗三技能 ~6 天」标定与塔/秘境 XP 口径的锚点，一个字节没动；
  //    · L1~L19 是**新加的开局爬坡**后的实测值（改前 L1 只有 10，要 318 场才到 2 级）。
  const XP_PINS_LATE = { 20: 374, 40: 1108, 60: 3303, 100: 87520 } // 改动前实测值（2026-09-22）
  const XP_PINS_EARLY = { 1: 416, 2: 715, 5: 1133, 10: 1080, 15: 846 } // 开局爬坡后实测值（2026-09-26）
  const pinsBad = Object.entries({ ...XP_PINS_LATE, ...XP_PINS_EARLY }).filter(([lv, xp]) => {
    const l = Number(lv)
    const hp = expectedEnemyHpAt(l)
    return combatXpPerSkill(l, hp, hp, true) !== xp
  })
  check('敌人节奏', '经验口径分两段：**L20 起 == 改动前基线**（L20=374 / L40=1108 / L60=3303 / L100=87520 ⇒ 成长标定不动）· L1~L15 是开局爬坡后的实测值',
    pinsBad.length === 0, pinsBad.map(([lv, xp]) => `L${lv} 期望 ${xp} 实得 ${combatXpPerSkill(Number(lv), expectedEnemyHpAt(Number(lv)), expectedEnemyHpAt(Number(lv)), true)}`).join(', '))
  // 开局爬坡本身的三条不变量（同一批：用户 ⑦「1 级打 1 级敌人要多久到 2 级」）
  {
    const { earlyCombatXpMult, hitXpFor, EARLY_XP_TOP_LEVEL, EARLY_XP_BOOST_A, HIT_XP_BASE } = await import('../../src/game/data/combatXpCurve.js')
    check('敌人节奏', `开局爬坡：≥L${EARLY_XP_TOP_LEVEL} 恒为 ×1（大后期标定不受影响）`,
      earlyCombatXpMult(20) === 1 && earlyCombatXpMult(60) === 1 && earlyCombatXpMult(120) === 1 && earlyCombatXpMult(999) === 1)
    check('敌人节奏', '开局爬坡单调递减且连续（2~19 级逐级下降，不存在「某一级突然更难」的断崖）',
      Array.from({ length: 18 }, (_, i) => i + 2).every((lv) => earlyCombatXpMult(lv) < earlyCombatXpMult(lv - 1) && earlyCombatXpMult(lv) / earlyCombatXpMult(lv - 1) > 0.7))
    check('敌人节奏', `非法/缺失等级按 ×1 处理（不惩罚）：null/undefined/''/0/-5/NaN`,
      [null, undefined, '', 0, -5, NaN].every((v) => earlyCombatXpMult(v) === 1))
    check('敌人节奏', `命中经验**同乘区**（L1 应为 ${Math.round(HIT_XP_BASE * (1 + EARLY_XP_BOOST_A))}，L20 回到基准 ${HIT_XP_BASE}）——只提击杀那一侧等于没修`,
      hitXpFor(1) === Math.round(HIT_XP_BASE * (1 + EARLY_XP_BOOST_A)) && hitXpFor(20) === HIT_XP_BASE && hitXpFor(60) === HIT_XP_BASE)
    check('敌人节奏', '引擎的命中/受击经验走同一个出口（`Combat.js` 里不得再出现裸字面量 `addXp(4)` / `addXp(2)`）',
      !/addXp\(4\)/.test(stripComments(rd('src/game/combat/Combat.js'))) && !/addXp\(2\)/.test(stripComments(rd('src/game/combat/Combat.js'))) && /hitXpFor/.test(rd('src/game/combat/Combat.js')))
    // 用户 ⑦ 的那条数：真新档打 1 级敌人**十几场**到 2 级（改前 318 场）
    const need = xpRequiredForLevelUp(1)
    const perFight = combatXpPerSkill(1, 36, 36, true, 1) + hitXpFor(1) * 5 // 1 级对手 36 血、约 5~7 次命中
    check('敌人节奏', `开局不再是劝退线：L1→L2 从改前的 300+ 场降到 <25 场（按 36 血对手 + 命中经验估）`,
      need / perFight < 25, `约 ${(need / perFight).toFixed(1)} 场（需要 ${need} 经验 / 每场约 ${perFight}）`)
  }
  check('敌人节奏', '溢出伤害不计经验（`creditableDamage` 夹在怪物血量内）',
    creditableDamage(50, 99999, 300) === Math.min(300, expectedEnemyHpAt(50) * XP_DAMAGE_CAP_MULT))
  check('敌人节奏', `塔/秘境这类「为难度设计的血量」被封顶（≤ 期望血量 ×${XP_DAMAGE_CAP_MULT}）⇒ 深塔不会变成唯一练级点`,
    creditableDamage(140, 11066, 11066) === expectedEnemyHpAt(140) * XP_DAMAGE_CAP_MULT, String(creditableDamage(140, 11066, 11066)))
  const midLv = 40
  const baseXp = combatXpPerSkill(midLv, expectedEnemyHpAt(midLv), expectedEnemyHpAt(midLv), true)
  const scaledHp = Math.round(expectedEnemyHpAt(midLv) * enemyHpMult(midLv))
  const scaledXp = combatXpPerSkill(midLv, scaledHp, scaledHp, true)
  check('敌人节奏', `(a)+(c) 中性：血量 ×${enemyHpMult(midLv)} 后击杀经验也 ×${enemyHpMult(midLv)}（所以「加血」不砍每小时经验）`,
    Math.abs(scaledXp / baseXp - enemyHpMult(midLv)) < 0.02, `${baseXp} → ${scaledXp}`)
  check('敌人节奏', '败场经验是胜场的 30%（保留原设计，也抑制「自杀式刷级」）',
    combatXpPerSkill(midLv, scaledHp, scaledHp, false) === Math.floor(scaledHp * xpPerDamage(midLv) * 0.3))
  check('敌人节奏', '引擎里不再有 winXpBoost 的第二份副本（曲线只在 `combatXpCurve.js`）',
    !/function winXpBoost/.test(rd('src/game/combat/Combat.js')) && /winXpBoost/.test(rd('src/game/data/combatXpCurve.js')))

  // (b) 重生间隔：胜利才设门、门内拒绝开打（返回 false）、失败不设门
  {
    const { opp } = await import('../../src/game/data/combat.js')
    const p = freshPlayer()
    p.skills.knife.level = 60
    p.skills.tasteAcumen.level = 60
    p.skills.heatControl.level = 60
    const c = new CombatCls(p)
    const dummyO = opp(5, '木桩', 'flavor', { hp: 1 })
    check('敌人节奏', '开打守卫：间隔内 `start()` 返回 false（引擎强制，任何调用点都绕不过去）',
      c.start(dummyO) === true && c.inFight === true)
    // 打死它 → 胜利 → 设门
    let guard = 0
    while (c.inFight && guard++ < 50) c.resolveTurn()
    check('敌人节奏', `击杀后进入重生间隔（${COMBAT_RESPAWN_SEC}s），且此时 ` +
      '`start()` 被拒绝', c.result === 'win' && c.respawnLeftMs() > 0 && c.start(dummyO) === false,
      `left=${Math.round(c.respawnLeftMs())}ms`)
    check('敌人节奏', '重生倒计时与常量同源（≤ COMBAT_RESPAWN_SEC 且 > 0）',
      c.respawnLeftMs() <= COMBAT_RESPAWN_SEC * 1000 && c.respawnLeftMs() > COMBAT_RESPAWN_SEC * 1000 - 500)
    // 等门开
    c.respawnUntil = performance.now() - 1
    check('敌人节奏', '间隔走完后可以再开打（门是临时的，不会永久锁死）', c.start(dummyO) === true)
    c.inFight = false
    // 失败不设门
    const p2 = freshPlayer()
    p2.skills.knife.level = 1
    const c2 = new CombatCls(p2)
    c2.start(opp(5, '木桩2', 'flavor', { hp: 999999, atk: 9999 }))
    let g2 = 0
    while (c2.inFight && g2++ < 200) c2.resolveTurn()
    check('敌人节奏', '失败**不设**重生间隔（怪物还在原地，被反杀不该再罚时间）', c2.result === 'lose' && c2.respawnLeftMs() === 0)
  }

  // 界面接线（显示 = 结算 = 说明）
  const cv = rd('src/views/CombatView.vue')
  const ar = rd('src/components/CombatArena.vue')
  const av = rd('src/views/ArenaView.vue')
  const lv2 = rd('src/views/LogView.vue')
  const tw = rd('src/views/TowerView.vue')
  check('敌人节奏', '血量分档接线齐备（区域/首领列表 · 竞技场榜单 · 首领图鉴 都走同一个 `scaledEnemy`）',
    // ⚠️ 必须**数出现次数 ≥2**（区域列表 + 首领列表各一处）：首版只查「有没有 `.map(scaledEnemy)`」，
    //    反例验证时只改掉区域列表那一处、首领列表那处照样命中 ⇒ 假绿（与「受击减免」同一类坑）。
    (cv.match(/\.map\(scaledEnemy\)/g) ?? []).length >= 2 && /scaledEnemy/.test(av) && /scaledEnemy\(b\)/.test(lv2),
    `CombatView 里出现 ${(cv.match(/\.map\(scaledEnemy\)/g) ?? []).length} 处（需 ≥2：区域 + 首领）`)
  check('敌人节奏', '页面上写明了规则（分档 + 重生间隔 + 经验改按伤害）——不然就是暗改',
    /enemyScalingText\(\)/.test(cv) && /重生间隔/.test(cv) && /按造成的伤害/.test(cv))
  check('敌人节奏', '重生倒计时在战斗屏可见，且与引擎同一个出口（`respawnLeftMs`）',
    /respawnLeftMs/.test(ar) && /重生中/.test(ar) && /respawnLeftMs/.test(tw))
}

// ══════════ C46：采集目标「效率」的可见性与正确性（2026-09-19）══════════
// 起因：`scripts/sim/target_choice.mjs` 实测出本作「换更高级资源」**已经是最强的成长杠杆**
// —— 同精通下最高级目标是最低卡的 ×8.5~×26.9；从 Lv1 起 12h「跟等级换」比「全程蹲最低级卡片」
// 多拿 ×4.0 经验（Lv50 起 24h 是 ×9.2）。也就是说：这条**不需要改数值**，缺的是「玩家看不出来」。
// 采集卡片上原本只有「基础经验」与「间隔」两列 ⇒ 玩家要自己心算「经验 ÷ 间隔 × 精通倍率」，
// 而精通倍率只在 ≥5 级才显示、间隔还有「固定档取更快者」分支 —— 心算极易得出反的结论。
// 故新增 `GatheringSkill.xpPerHour()`（唯一出口）与 `bestUnlockedTarget()`，卡片上显示「效率 / ⚡ 最优」。
{
  const { CARD_XP_SCALE } = await import('../../src/game/skills/Skill.js')
  const { masteryXpMultiplier, countForMasteryLevel } = await import('../../src/game/core/mastery.js')
  const { readFileSync } = await import('node:fs')

  const p = freshPlayer({ foraging: 40 })
  const inst = getSkillInstance('foraging')
  const t = inst.targets.find((x) => x.itemId === 'grape') // reqLevel 30，Lv40 时已解锁
  check('目标效率', '用于测的样本目标存在且已解锁', !!t && t.reqLevel <= 40, t?.itemId)

  // ① 公式：经验 × 精通倍率 × CARD_XP_SCALE × 3600 ÷ 实际间隔（独立重算对照）
  // 低目标经验减半（2026-09-22）：grape reqLevel 30 而技能 40 级 ⇒ 低目标，两侧都要带系数
  const lowR = inst.isLowTargetLevel(t.reqLevel) ? LOW_TARGET_XP_MULT : 1
  const recompute = () =>
    (t.xpPerAction * lowR * CARD_XP_SCALE * masteryXpMultiplier(inst.masteryLevel(t))) / (inst.intervalMs(t) / 1000) * 3600
  check('目标效率', '效率 == 卡片经验×精通倍率×3600÷实际间隔', Math.abs(inst.xpPerHour(t) - recompute()) < 1e-6,
    `${inst.xpPerHour(t)} vs ${recompute()}`)
  // 与经验条同口径：必须乘 CARD_XP_SCALE，否则页面数字与玩家在经验条上看到的对不上（又是一个「页面骗人」）
  // 两边都要带低目标系数（grape reqLevel 30 而技能 40 级 ⇒ 低目标），否则比值里混进 0.5（2026-09-22）
  const lowT = inst.isLowTargetLevel(t.reqLevel) ? LOW_TARGET_XP_MULT : 1
  const withoutScale = (t.xpPerAction * lowT * masteryXpMultiplier(inst.masteryLevel(t))) / (inst.intervalMs(t) / 1000) * 3600
  check('目标效率', '效率按 CARD_XP_SCALE 与技能经验条同口径',
    Math.abs(inst.xpPerHour(t) / withoutScale - CARD_XP_SCALE) < 1e-6, `倍数 ${inst.xpPerHour(t) / withoutScale}`)

  // ② 精通越高效率越高（用真实精通次数，不写死倍率）
  inst.mastery[t.itemId] = 0
  const rateLow = inst.xpPerHour(t)
  inst.mastery[t.itemId] = countForMasteryLevel(100)
  const rateHigh = inst.xpPerHour(t)
  inst.mastery[t.itemId] = 0
  check('目标效率', '同目标精通 100 的效率严格高于精通 0', rateHigh > rateLow, `${Math.round(rateLow)} → ${Math.round(rateHigh)}`)

  // ③ bestUnlockedTarget()：穷举对照 + **未解锁的不参与**
  const best = inst.bestUnlockedTarget()
  const unlocked = inst.targets.filter((x) => x.reqLevel <= inst.level)
  const maxRate = Math.max(...unlocked.map((x) => inst.xpPerHour(x)))
  check('目标效率', '「当前最优」确实是已解锁目标里效率最高的（穷举对照）',
    !!best && inst.xpPerHour(best) >= maxRate - 1e-6, `${best?.itemId} ${Math.round(inst.xpPerHour(best))} vs ${Math.round(maxRate)}`)
  p.setSkillState('foraging', { level: 1, exp: 0 })
  const bestAt1 = inst.bestUnlockedTarget()
  const lockedTop = [...inst.targets].sort((a, b) => inst.xpPerHour(b) - inst.xpPerHour(a))[0]
  check('目标效率', '未解锁的目标不参与评选（否则会引导玩家「换过去」，而其实换不过去）',
    !!bestAt1 && bestAt1.reqLevel <= 1 && lockedTop.reqLevel > 1,
    `Lv1 选出 ${bestAt1?.itemId}(需 ${bestAt1?.reqLevel})，全局最高是 ${lockedTop.itemId}(需 ${lockedTop.reqLevel})`)

  // ④ 🔴 行为断言：**实测一小时拿到的经验 == 页面显示的效率**（这才是「数字没骗人」的证明）
  //    冻结 addMastery 让精通倍率在一小时里恒定，从而可以精确对照（否则精通会在过程中涨，实测值天然偏高）。
  //    ⚠️ 经验必须读 `skill.exp` **自身**：它是**绝对累计值**（`addXp` 用 `exp >= xpTotalForLevel(level+1)` 判升级、
  //      升级时不重置），再叠加一次 `xpTotalForLevel(level)` 就重复计了一遍（本守卫第一版就是这么错的，
  //      实测值虚高 1.94 倍、差点被当成「公式写错」）。
  const p2 = freshPlayer({ foraging: 40 })
  const inst2 = getSkillInstance('foraging')
  const t2 = inst2.targets.find((x) => x.itemId === 'grape')
  inst2.mastery[t2.itemId] = 0
  p2.setSkillTarget('foraging', t2.itemId)
  p2.addMastery = () => {} // 冻结精通，隔离公式
  const before = p2.skills.foraging.exp
  for (let i = 0; i < 360; i++) inst2.tick(10000) // 360 × 10s = 1 小时
  const gained = p2.skills.foraging.exp - before
  const shown = inst2.xpPerHour(t2)
  check('目标效率', '实测挂机 1 小时拿到的经验 == 卡片显示的效率（±3%，页面数字与引擎同源）',
    shown > 0 && Math.abs(gained / shown - 1) < 0.03, `实测 ${Math.round(gained)} vs 显示 ${Math.round(shown)}（比 ${(gained / shown).toFixed(4)}）`)

  // ⑤ 接线：视图必须真的用了这一对方法，且标记有自己的样式（塞进两列行里会被挤成竖排）
  const view = readFileSync(new URL('../../src/views/GatheringView.vue', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../../src/styles/main.css', import.meta.url), 'utf8')
  check('目标效率', '采集页卡片调用了 xpPerHour 与 bestUnlockedTarget（否则算出来也没人显示）',
    /instance\.xpPerHour\(/.test(view) && /bestUnlockedTarget/.test(view), '视图里缺其中之一')
  check('目标效率', '「⚡ 最优」标记有独立样式且 nowrap（两列卡片里会竖排）',
    /\.best-flag\s*{/.test(css) && /\.best-flag\s*{[^}]*white-space:\s*nowrap/.test(css))
}

// ══════════ C47：配方「效率」的可见性与正确性（2026-09-19，C46 的制作侧对照）══════════
// `scripts/sim/recipe_choice.mjs` 实测：制作侧梯级**比采集更陡**（同精通最高/最低是 ×19~×48，采集是 ×8.5~×27），
// 「择优换配方」比「蹲最低级配方」多拿 ×14.6~×20.7。而**「跟着解锁无脑换」只拿到择优的一半到四分之三**
// （锻造差 4 倍）—— 因为刚解锁的配方成功率最低（失败只得半额经验），玩家却**看不出来**：
// 配方卡片上原本只有「经验」一列，要自己乘精通倍率**还要乘成功率**，而成功率随等级差每级 +2%、
// 各配方基础值又不同（0.6~0.9）⇒ 心算必错。
// ⚠️ 制作侧与采集侧还有一处结构差异必须钉住：**队列节奏与配方等级无关**（固定 3 秒），
//   而采集的间隔随目标等级变长 —— 所以这里的效率读 `CRAFT_QUEUE_INTERVAL_MS`，不能写死 3000。
{
  const { CARD_XP_SCALE } = await import('../../src/game/skills/Skill.js')
  const { CRAFT_QUEUE_INTERVAL_MS } = await import('../../src/game/skills/ProductionSkill.js')
  const { masteryXpMultiplier, countForMasteryLevel } = await import('../../src/game/core/mastery.js')
  const { readFileSync } = await import('node:fs')

  const p = freshPlayer({ cooking: 99 })
  const inst = getSkillInstance('cooking')
  const r = inst.recipes[0] // 烤土豆：reqLevel 1，Lv99 时成功率封顶 98%

  // ① 公式：期望经验 × 学派加成 × CARD_XP_SCALE × 精通倍率 × 3600 ÷ 队列节奏（独立重算）
  const succ = inst.successChance(r)
  const expXp = r.xp * (succ + (1 - succ) * 0.5)
  // 低目标经验减半（2026-09-22）：烤土豆 reqLevel 1 而技能 99 级 ⇒ 是低目标，效率也减半（显示与结算同源）
  const lowMult = inst.isLowTargetLevel(r.reqLevel) ? LOW_TARGET_XP_MULT : 1
  const recompute = () => (expXp * lowMult * CARD_XP_SCALE * masteryXpMultiplier(inst.masteryLevel(r))) / (CRAFT_QUEUE_INTERVAL_MS / 1000) * 3600
  check('配方效率', '效率 == 期望经验×精通倍率×3600÷队列节奏', Math.abs(inst.xpPerHour(r) - recompute()) < 1e-6,
    `${inst.xpPerHour(r)} vs ${recompute()}`)
  // ② 🔴 成功率必须算进去：效率必须**严格小于**「零失败假设」的效率（这是「有没有乘成功率」的判据）
  const noFail = (r.xp * lowMult * CARD_XP_SCALE * masteryXpMultiplier(inst.masteryLevel(r))) / (CRAFT_QUEUE_INTERVAL_MS / 1000) * 3600
  check('配方效率', '效率已折算成功率（失败只得半额经验）——必须严格小于「零失败」的效率',
    succ < 1 && inst.xpPerHour(r) < noFail, `成功率 ${(succ * 100).toFixed(0)}%：显示 ${Math.round(inst.xpPerHour(r))} < 零失败 ${Math.round(noFail)}`)
  check('配方效率', '未解锁（等级不够）时成功率不参与显示成负数', !(inst.xpPerHour(r) < 0))

  // ③ 精通越高效率越高
  inst.mastery[r.id] = 0
  const rateLow = inst.xpPerHour(r)
  inst.mastery[r.id] = countForMasteryLevel(100)
  const rateHigh = inst.xpPerHour(r)
  inst.mastery[r.id] = 0
  check('配方效率', '同配方精通 100 的效率严格高于精通 0', rateHigh > rateLow, `${Math.round(rateLow)} → ${Math.round(rateHigh)}`)

  // ④ bestUnlockedRecipe()：穷举对照 + **未解锁的不参与**
  const best = inst.bestUnlockedRecipe()
  const unlocked = inst.recipes.filter((x) => x.reqLevel <= inst.level)
  const maxRate = Math.max(...unlocked.map((x) => inst.xpPerHour(x)))
  check('配方效率', '「当前最优」确实是已解锁配方里效率最高的（穷举对照）',
    !!best && inst.xpPerHour(best) >= maxRate - 1e-6, `${best?.id} ${Math.round(inst.xpPerHour(best))} vs ${Math.round(maxRate)}`)
  p.setSkillState('cooking', { level: 1, exp: 0 })
  const bestAt1 = inst.bestUnlockedRecipe()
  const lockedTop = [...inst.recipes].sort((a, b) => inst.xpPerHour(b) - inst.xpPerHour(a))[0]
  check('配方效率', '未解锁的配方不参与评选（否则会引导玩家「做这个」，而其实做不了）',
    !!bestAt1 && bestAt1.reqLevel <= 1 && lockedTop.reqLevel > 1,
    `Lv1 选出 ${bestAt1?.id}(需 ${bestAt1?.reqLevel})，全局最高是 ${lockedTop.id}(需 ${lockedTop.reqLevel})`)

  // ⑤ 🔴 行为断言：**按真实 3 秒节奏做一小时，拿到的经验 == 卡片显示的效率**。
  //    取 Lv99 + 最低级配方（等级差加成拉满），冻结 addMastery 让精通倍率恒定。
  //    ⚠️ **容差按实际成功率动态算**（2026-09-21 改）：这条是统计对照，噪声来自二项分布——
  //      σ = 0.5·√(p(1−p)/n) / (p + (1−p)·0.5)（成功得满额、失败得半额，故分子带 0.5 系数），取 max(1.5%, 4σ)。
  //      原先写死 ±1.5%，是因为当时取的配方「成功率被 MAX_SUCCESS 钉在 98%」、3σ 只有 0.6%；
  //      引入全局难度系数后该配方成功率变成 49%、3σ ≈ 2.9%，写死的 1.5% 会被纯噪声打穿（实测差 1.6%）。
  //      动态容差的好处：以后调难度系数不用回来改这个数字。
  //    分工不变：这条查「**量级/节奏/缩放/缓存**」这类结构性错误（错就错 ≥30%）；
  //      「成功率有没有折算进去」的**精确判据是上面第 ② 条**（严格小于零失败口径）。别把这一条当成成功率的守卫。
  const p2 = freshPlayer({ cooking: 99 })
  const inst2 = getSkillInstance('cooking')
  const r2 = inst2.recipes[0]
  inst2.mastery[r2.id] = 0
  for (const id of Object.keys(r2.ingredients ?? {})) p2.inventory[id] = 1e9
  p2.addMastery = () => {}
  const before = p2.skills.cooking.exp
  const CRAFTS = Math.round(3600000 / CRAFT_QUEUE_INTERVAL_MS) // 一小时能做多少次
  for (let i = 0; i < CRAFTS; i++) inst2.craft(r2)
  const gained = p2.skills.cooking.exp - before
  const shown = inst2.xpPerHour(r2)
  const succNow = inst2.successChance(r2)
  const sigma = (0.5 * Math.sqrt((succNow * (1 - succNow)) / CRAFTS)) / (succNow + (1 - succNow) * 0.5)
  const tol = Math.max(0.015, 4 * sigma)
  check('配方效率', `按真实节奏做满 1 小时拿到的经验 == 卡片显示的效率（±${(tol * 100).toFixed(1)}% = max(1.5%, 4σ)，页面数字与引擎同源）`,
    shown > 0 && Math.abs(gained / shown - 1) < tol,
    `实测 ${Math.round(gained)} vs 显示 ${Math.round(shown)}（比 ${(gained / shown).toFixed(4)}，成功率 ${(succNow * 100).toFixed(1)}%、σ=${(sigma * 100).toFixed(2)}%、共 ${CRAFTS} 次）`)

  // ⑥ 队列节奏是唯一来源 + **等级变化后效率要跟着变**（不是把首次算的结果缓存住）
  //    ⚠️ 必须按**当前**状态重算：断言 ④ 把等级改回了 1，若这里还跟开头的旧值比，FAIL 的是守卫不是代码
  //      （本守卫第一版就是这么错的）。
  p.setSkillState('cooking', { level: 99, exp: 0 })
  const s2 = inst.successChance(r)
  const fresh = (r.xp * (s2 + (1 - s2) * 0.5) * (inst.isLowTargetLevel(r.reqLevel) ? LOW_TARGET_XP_MULT : 1) * CARD_XP_SCALE * masteryXpMultiplier(inst.masteryLevel(r))) / (CRAFT_QUEUE_INTERVAL_MS / 1000) * 3600
  check('配方效率', '等级变化后效率跟着变（读的是当前成功率，不是缓存值）；队列节奏走唯一常量',
    Math.abs(inst.xpPerHour(r) - fresh) < 1e-6 && CRAFT_QUEUE_INTERVAL_MS === 3000,
    `实得 ${Math.round(inst.xpPerHour(r))} vs 重算 ${Math.round(fresh)}，常量 ${CRAFT_QUEUE_INTERVAL_MS}ms`)

  // ⑦ 接线：制作页必须真的显示了效率，且复用采集页那套 nowrap 标记样式
  const view = readFileSync(new URL('../../src/views/ProductionView.vue', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../../src/styles/main.css', import.meta.url), 'utf8')
  check('配方效率', '制作页卡片调用了 xpPerHour 与 bestUnlockedRecipe（否则算出来也没人显示）',
    /instance\.xpPerHour\(/.test(view) && /bestUnlockedRecipe/.test(view), '视图里缺其中之一')
  check('配方效率', '「⚡ 最优」在制作页复用同一套 nowrap 样式（两列卡片里会竖排）',
    /best-flag/.test(view) && /\.best-flag\s*{[^}]*white-space:\s*nowrap/.test(css))
}


// ══════════ C48：等级「时代」分段（2026-09-19）══════════
// 起因：用户观察参照作「每个技能从 1 级到满级物品很少，但能撑起整段」，问本作能不能也这样、要不要加上限。
// 实测（Rocky 的 `index-*.js` 逐条抠 `skillReq`）：它采集类每技能 **9~11 件资源跨 Lv1→105~115**（每件扛 11~14 级）；
// 本作反过来：采摘 142 个目标却只有 59 个不同等级（同档最多 15 件）⇒ 列表**同时承担了纵向梯级与横向原料库**两个职责。
// 结论：**不改数值、不改上限**（本作「内容↔上限」的尾巴比例 20/120=17% 已与 Rocky 的 11~21/126=9~17% 一致，
// 抬上限只会把尾巴变成 26/126=21% 且零新内容），改为把列表按竖向读：10 级一档「时代」+ 该档最高级产出命名。
{
  const { ERA_SPAN, levelEras, eraLabel, eraLabelOf, eraProgress } = await import('../../src/game/data/levelEras.js')
  const { readFileSync } = await import('node:fs')

  check('等级时代', `档位跨度对齐 Rocky 的「每件资源扛 11~14 级」（ERA_SPAN = ${ERA_SPAN}）`, ERA_SPAN === 10)

  // ① 纯函数：守恒 / 段内等级合法 / 段升序不重叠 / 有限输入不抛
  const GATHER = ['foraging', 'woodcutting', 'mining', 'fishing', 'hunting', 'excavation']
  const PROD = ['cooking', 'baking', 'preserving', 'brewing', 'spiceMixing', 'craftsmithing', 'spiritSummoning']
  const problems = []
  const eraCounts = []
  for (const id of [...GATHER, ...PROD]) {
    const inst = getSkillInstance(id)
    const list = inst?.targets ?? inst?.recipes ?? []
    if (!list.length) { problems.push(`${id}: 无症状列表`); continue }
    const lv = (x) => x.reqLevel
    const idOf = (x) => x.itemId ?? x.id
    const eras = levelEras(list, lv, idOf)
    eraCounts.push({ id, n: eras.length, kind: inst?.targets ? '采集' : '制作' })
    const sum = eras.reduce((s, e) => s + e.list.length, 0)
    if (sum !== list.length) problems.push(`${id}: 守恒 ${sum}≠${list.length}`)
    for (const e of eras) {
      for (const it of e.list) if (lv(it) < e.from || lv(it) > e.to) problems.push(`${id}: ${idOf(it)} 等级 ${lv(it)} 落在 ${e.label} 之外`)
      if (e.label !== eraLabel(e.from, e.to)) problems.push(`${id}: 标签 ${e.label} 与 from/to 不一致`)
      // topId 必须是该段**最高等级**的那件（穷举对照）
      const max = Math.max(...e.list.map(lv))
      if (lv(e.list.find((x) => String(idOf(x)) === e.topId)) !== max) problems.push(`${id}: ${e.label} 的 topId 不是该段最高级`)
    }
    for (let i = 1; i < eras.length; i++) {
      if (eras[i].from - eras[i - 1].from !== ERA_SPAN) problems.push(`${id}: 第 ${i} 段与上一段不相邻`)
    }
  }
  check('等级时代', '分段守恒（不丢不重）· 段内等级合法 · topId = 该段最高级', problems.length === 0, problems.slice(0, 4).join(' | '))
  check('等级时代', '空输入返回空数组（视图可安全遍历，不抛错）', levelEras([], (x) => x, (x) => x).length === 0)

  // ② 🔴 核心设计断言：**每个技能的时代数 ≈ Rocky 的 9~11 档**（这就是「列表按纵向读」的量化判据）
  // 2026-09-29 补档：采集/制作顶档推进到 112~120 ⇒ 十年段从 10 段变 12 段（8~12 档）。
  //  Rocky 对照是「9~11 件资源」的量级判据，12 段仍同一量级；真正的退化（回 5 级一段）由下一条 >15 拦。
  const bad = eraCounts.filter((e) => e.n < 8 || e.n > 12)
  check('等级时代', `每个技能的时代数落在 8~12 档（对照 Rocky 的 9~11 件资源；补档后顶档 112~120）`,
    bad.length === 0, bad.map((e) => `${e.id}=${e.n}`).join(', '))
  // 旧口径（5 级一段、或类别分组）会切出远多于 11 段 ⇒ 这条能抓住「回退到细粒度分组」
  const fine = eraCounts.filter((e) => e.n > 15)
  check('等级时代', '没有技能退化成细粒度分段（>15 段 = 又变回 5 级一档/平铺）', fine.length === 0, fine.map((e) => `${e.id}=${e.n}`).join(', '))

  // ③ 进度口径：满精通计数（eraProgress）要对得上
  const p = freshPlayer({ cooking: 60 })
  const inst = getSkillInstance('cooking')
  const sec = levelEras(inst.recipes, (r) => r.reqLevel, (r) => r.id)[0]
  for (const r of sec.list) inst.mastery[r.id] = 0
  const zero = eraProgress(sec.list, (r) => inst.masteryLevel(r)).done
  for (const r of sec.list) inst.mastery[r.id] = 999999 // 远超满级所需次数
  const full = eraProgress(sec.list, (r) => inst.masteryLevel(r)).done
  check('等级时代', '时代进度：全 0 精通记 0，全满精通记满（口径同 mastery 满级 100）',
    zero === 0 && full === sec.list.length, `零精通 ${zero} / 满精通 ${full} / 共 ${sec.list.length}`)

  // ④ 接线：两个页面都走**同一个**实现（各写一份的话改粒度会只改一处）
  const gv = readFileSync(new URL('../../src/views/GatheringView.vue', import.meta.url), 'utf8')
  const pv = readFileSync(new URL('../../src/views/ProductionView.vue', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../../src/styles/main.css', import.meta.url), 'utf8')
  check('等级时代', '采集页与制作页都调用 levelEras（共用单一实现）',
    /levelEras\(/.test(gv) && /levelEras\(/.test(pv), '有一个页面没用')
  check('等级时代', '旧口径已清除：两个视图里不再有「按 5 级一段」的 / 5 * 5 写法',
    !/\/\s*5\)\s*\*\s*5/.test(gv) && !/\/\s*5\)\s*\*\s*5/.test(pv))
  check('等级时代', '时代名有独立样式且 nowrap（段标题是 flex 行，换行会挤掉右侧计数）',
    /\.era-name\s*{/.test(css) && /\.era-name\s*{[^}]*white-space:\s*nowrap/.test(css))

  // ⑤ 🔴 反向查标签必须与正向分段一致（配方树「去做」靠它展开目标段）
  //    回归现场：`sectionLabelOf()` 原先自己按 5 级算标签，粒度改成 10 级后它算出旧标签，
  //    `toggleSection(旧标签)` 打不开任何一段 ⇒ 跳转静默失效（不报错、不白屏）。
  const revProblems = []
  for (const id of [...GATHER, ...PROD]) {
    const inst = getSkillInstance(id)
    const list = inst?.targets ?? inst?.recipes ?? []
    if (!list.length) continue
    const labels = new Set(levelEras(list, (x) => x.reqLevel, (x) => x.itemId ?? x.id).map((e) => e.label))
    for (const it of list) {
      const lab = eraLabelOf(it.reqLevel)
      if (!labels.has(lab)) revProblems.push(`${id}: Lv${it.reqLevel} → ${lab} 不是真实存在的段`)
    }
  }
  check('等级时代', '按单个等级反查出的段标签真实存在（配方树「去做」跳转不会打不开段）',
    revProblems.length === 0, revProblems.slice(0, 3).join(' | '))
  check('等级时代', '制作页的反查走 eraLabelOf（不再自己按 5 级算标签）',
    /eraLabelOf\(/.test(readFileSync(new URL('../../src/views/ProductionView.vue', import.meta.url), 'utf8')))
}

// ══════════ C49：精通池（2026-09-19，参照 Melvor Idle 的 Mastery Pool）══════════
// 起因：真实量测（`scripts/sim/target_choice.mjs`）显示本作精通**严格按卡**、没有任何技能级共享
// ⇒ 「择优换目标」只比「蹲最低级卡片」快 ×1.07（12h）/×1.25（24h），**玩家没有横向铺开的理由**；
// 而参照作 Melvor 的精通经验公式含「该技能精通总等级」项 + 25% 入池 ⇒ 结构上奖励铺开。
// 本作按计数式精通改写：25% 入池、上限按卡片数派生、10/25/50/95% 四档给整技能加成、
// **且只在池 ≥ 阈值时生效**（花掉就掉档 = 持续参与压力，不是一次性解锁）、池点数可 1:1 补给任意卡片。
{
  const M = await import('../../src/game/core/mastery.js')
  const { readFileSync } = await import('node:fs')

  // ① 派生：上限必须是「卡片数 × 常量」，不是任何地方写死的数字
  check('精通池', `池上限 = 卡片数 × MASTERY_POOL_PER_CARD(${M.MASTERY_POOL_PER_CARD})，且对 0/非法输入返回 0`,
    M.masteryPoolCap(10) === 10 * M.MASTERY_POOL_PER_CARD && M.masteryPoolCap(0) === 0 && M.masteryPoolCap(undefined) === 0,
    `实得 ${M.masteryPoolCap(10)} / ${M.masteryPoolCap(0)}`)

  const p = freshPlayer({ foraging: 30 })
  const inst = getSkillInstance('foraging')
  const t = inst.targets.find((x) => x.itemId === 'grape')
  const cap = p.masteryPoolCapOf('foraging')
  check('精通池', '店内的池上限与卡片数一致（142 个目标 ⇒ 上限为 142×常量）',
    cap === p.masteryCardCount('foraging') * M.MASTERY_POOL_PER_CARD && cap > 0, `卡片数 ${p.masteryCardCount('foraging')} 上限 ${cap}`)

  // ② 入池率（行为断言：真的跑一次 addMastery，看池涨了多少）
  p.skills.foraging.masteryPool = 0
  p.addMastery('foraging', 'apple', 1)
  // 🔴 断言里**钉字面量 0.25，不读常量**：第一版写成「观测值 == 常量」是**恒真**的
  //   （改常量时两边一起变），反例验证把入池率改成 100% 它照样绿 —— 假绿守卫。
  //   设计常量就该像 `ERA_SPAN === 10` / `CRAFT_QUEUE_INTERVAL_MS === 3000` 那样被钉住。
  check('精通池', '每次动作的精通次数按 25% 入池（行为断言，钉字面量）',
    p.skills.foraging.masteryPool === 0.25 && M.MASTERY_POOL_GAIN_RATE === 0.25,
    `实得池 +${p.skills.foraging.masteryPool}，常量 ${M.MASTERY_POOL_GAIN_RATE}`)
  // 上限夹取
  p.addMastery('foraging', 'apple', cap * 10)
  check('精通池', '灌爆后池被夹在上限（不越界）', p.skills.foraging.masteryPool === cap, `实得 ${p.skills.foraging.masteryPool} / 上限 ${cap}`)

  // ③ 里程碑：四档单调不减；**池掉到阈值以下加成必须随之消失**（这是 Melvor 这套的精髓，不是 bug）
  const bonusAt = (f) => { p.skills.foraging.masteryPool = cap * f; return p.masteryPoolBonus('foraging') }
  const b6 = bonusAt(0.06), b10 = bonusAt(0.10), b25 = bonusAt(0.25), b50 = bonusAt(0.50), b95 = bonusAt(0.95)
  check('精通池', '低于首个里程碑（10%）时没有任何加成',
    b6.tierIdx === -1 && b6.doublePP === 0 && b6.xpPct === 0, `6% 档位 ${b6.tierIdx}`)
  check('精通池', '四档加成单调不减且档位依次递进',
    b10.tierIdx === 0 && b25.tierIdx === 1 && b50.tierIdx === 2 && b95.tierIdx === 3 &&
    b10.doublePP <= b25.doublePP && b25.doublePP <= b50.doublePP && b50.doublePP <= b95.doublePP &&
    b10.xpPct <= b25.xpPct && b25.xpPct <= b50.xpPct && b50.xpPct <= b95.xpPct,
    `${b10.doublePP}/${b25.doublePP}/${b50.doublePP}/${b95.doublePP}pp`)
  const b30 = bonusAt(0.30), b20 = bonusAt(0.20)
  check('精通池', '🔴 池跌破阈值后加成消失（花掉 > 攒着 的取舍成立，不是永久解锁）',
    b30.successPP > b20.successPP || b30.doublePP > b20.doublePP,
    `30% → ${b30.successPP}/${b30.doublePP} vs 20% → ${b20.successPP}/${b20.doublePP}`)
  check('精通池', `经验加成封顶 ≤ 5%（不得把标定过的升级时长整体位移）`, b95.xpPct <= 5, `实得 ${b95.xpPct}%`)

  // ④ 补给：1:1、双向夹取（不超过池余额 / 不超过该卡距满级所需）
  p.skills.foraging.masteryPool = 500
  p.skills.foraging.mastery = {}
  const moved = p.spendMasteryPool('foraging', 'apple', 300)
  check('精通池', '补给是 1:1（花 300 点 = 卡片精通 +300 次，池 −300）',
    moved === 300 && p.skills.foraging.mastery.apple === 300 && p.skills.foraging.masteryPool === 200,
    `实得 moved=${moved} 卡=${p.skills.foraging.mastery.apple} 池=${p.skills.foraging.masteryPool}`)
  const bigMoved = p.spendMasteryPool('foraging', 'apple', 1e9)
  check('精通池', '补给不超过池余额（不会凭空造点）',
    bigMoved === 200 && p.skills.foraging.masteryPool === 0, `实得 ${bigMoved} / 余 ${p.skills.foraging.masteryPool}`)
  p.skills.foraging.masteryPool = 1e6
  const toMax = p.spendMasteryPool('foraging', 'apple', 1e9)
  const maxCount = M.countForMasteryLevel(M.MASTERY_LEVEL_CAP)
  check('精通池', '补给不超过该卡距满精通所需（把池倒进已练满的卡里会蒸发）',
    p.skills.foraging.mastery.apple === maxCount && toMax === maxCount - 500, `卡=${p.skills.foraging.mastery.apple} 需=${maxCount}`)
  check('精通池', '已满精通的卡片再补给无效（返回 0）', p.spendMasteryPool('foraging', 'apple', 100) === 0)

  // ⑤ 🔴 在线/离线同源：加成必须走「唯一出口」——双倍挂在 doubleChance（expectedYield 也读它）、
  //    经验挂在 addCardXp（离线 bootstrap 也走它）⇒ 离线不会吃不到池加成。
  const inst2 = getSkillInstance('foraging')
  p.skills.foraging.masteryPool = 0
  inst2.mastery[t.itemId] = 0
  const yield0 = inst2.expectedYield(t)
  const xp0 = inst2.addCardXp(10, 1)
  p.skills.foraging.masteryPool = cap * 0.95
  const yield95 = inst2.expectedYield(t)
  const xp95 = inst2.addCardXp(10, 1)
  check('精通池', '池 95% 时「期望产量」上升（离线走 expectedYield，与在线同源）',
    yield95 > yield0, `${yield0.toFixed(3)} → ${yield95.toFixed(3)}`)
  check('精通池', '池 95% 时 addCardXp 的经验 +5%（离线也走这个出口）',
    Math.abs(xp95 / xp0 - 1.05) < 0.02, `比 ${(xp95 / xp0).toFixed(4)}`)
  // 跨技能隔离：foraging 的池不能影响 fishing
  const fish = getSkillInstance('fishing')
  const fishT = fish.targets[0]
  const fishBefore = fish.doubleChance(fishT)
  p.skills.foraging.masteryPool = cap * 0.95
  check('精通池', '池是**技能级**的，不影响其它技能（foraging 的池不改 fishing 的双倍）',
    fish.doubleChance(fishT) === fishBefore, `${fishBefore} → ${fish.doubleChance(fishT)}`)

  // ⑥ 存档：池嵌在 skills 里 ⇒ 必须随 serialize/applySave 往返；旧档缺字段回退 0
  p.skills.foraging.masteryPool = 12345
  const q = freshPlayer({ foraging: 30 })
  q.applySave(JSON.parse(JSON.stringify(p.serialize())))
  check('精通池', '池随存档往返保留（嵌在 skills 内，与 storyProgress 那类坑同源）',
    q.skills.foraging.masteryPool === 12345, `实得 ${q.skills.foraging.masteryPool}`)
  const legacy = JSON.parse(JSON.stringify(p.serialize()))
  delete legacy.skills.foraging.masteryPool
  const q2 = freshPlayer({ foraging: 30 })
  q2.applySave(legacy)
  check('精通池', '旧档没有 masteryPool 字段时回退 0（不炸、不 NaN）', q2.skills.foraging.masteryPool === 0, `实得 ${q2.skills.foraging.masteryPool}`)

  // ⑧-b 补给按钮的「禁用原因」必须说准是哪一种（2026-09-22 线上核验发现）
  //     起因：修好「模板里用了脚本里没定义的名字」后按钮真的定位到卡片了，但**池为 0 时显示「该卡已满精通」**——
  //     那是假的（新档的烤土豆一次都没练过，卡片并没满）。三种原因必须分开：没选卡片 / 卡片已满 / 池里空。
  {
    const bar = stripComments(readFileSync(new URL('../../src/components/MasteryPoolBar.vue', import.meta.url), 'utf8'))
    check('精通池', '补给按钮的文案有**三分支**（先选一个 / 该卡已满精通 / 精通池是空的）',
      /先选一个\$\{isCraft/.test(bar) && /need <= 0 \? '该卡已满精通'/.test(bar) && bar.includes("'精通池是空的'"))
    check('精通池', '三分支的**判据顺序**正确：先判有没有卡片，再判卡片是否已满（池空是最后的兜底）',
      /!cardKey \? `先选一个\$\{isCraft/.test(bar) && /: \(need <= 0 \? '该卡已满精通' : '精通池是空的'\)/.test(bar))
    check('精通池', '禁用时的 tooltip 说明了「池里还没点数」以及点数从哪来（含入池率）',
      /每次动作有 \$\{Math\.round\(MASTERY_POOL_GAIN_RATE \* 100\)\}% 的精通次数会记进池里/.test(bar) && bar.includes('MASTERY_POOL_GAIN_RATE'))
  }

  // ⑧ 精通「横向铺开」奖励（Melvor 让铺开划算的**真正机制**——只移植池是不够的）
  check('精通池', `广度倍率：0 广度 = ×1、满广度 = ×${1 + M.MASTERY_BREADTH_MAX}（上界钉死）、越界被夹取`,
    M.masteryBreadthMultiplier(0, 20) === 1 &&
    Math.abs(M.masteryBreadthMultiplier(2000, 20) - (1 + M.MASTERY_BREADTH_MAX)) < 1e-9 &&
    M.masteryBreadthMultiplier(9e9, 20) === 1 + M.MASTERY_BREADTH_MAX &&
    M.masteryBreadthMultiplier(500, 0) === 1,
    `实得 ${M.masteryBreadthMultiplier(9e9, 20)} / 卡片数为 0 时 ${M.masteryBreadthMultiplier(500, 0)}`)

  // 行为断言：同一张新卡，在高广度档下每次动作拿到的精通必须更多（倍数 ≈ 广度倍率之比）
  const mk = (fill) => {
    const z = freshPlayer({ foraging: 30 })
    z.skills.foraging.mastery = {}
    z.skills.foraging.masteryPool = 0
    if (fill > 0) for (const t of inst.targets.slice(0, fill)) z.skills.foraging.mastery[t.itemId] = maxCount
    const zz = freshPlayer({ foraging: 30 })
    zz.applySave(JSON.parse(JSON.stringify(z.serialize()))) // 走一遍读档 ⇒ 广度缓存重算，贴近真实
    zz.skills.foraging.mastery.apple = 0
    zz.skills.foraging.masteryPool = 0
    const b = zz.masteryBreadthOf('foraging')
    zz.addMastery('foraging', 'apple', 100)
    return { mult: b.multiplier, total: b.total, gain: zz.skills.foraging.mastery.apple }
  }
  const lowB = mk(0), highB = mk(120)
  check('精通池', '🔴 练得越广、精通涨得越快（同一张新卡 100 次动作，高广度档拿到的精通更多）',
    highB.gain > lowB.gain && Math.abs(highB.gain / lowB.gain - highB.mult / lowB.mult) < 0.02,
    `低广度 total=${lowB.total} 倍率=${lowB.mult.toFixed(3)} 得 ${lowB.gain.toFixed(1)}；高广度 total=${highB.total} 倍率=${highB.mult.toFixed(3)} 得 ${highB.gain.toFixed(1)}`)

  // 广度是**派生值**：不得进存档（进了就会「存档里的派生值过期后悄悄骗人」）
  const ser = JSON.stringify(p.serialize())
  check('精通池', '广度是派生值、不进存档（只存 raw 精通次数与池）',
    !/breadth/i.test(ser) && /masteryPool/.test(ser), '存档里出现了派生键')
  // 换档必须清缓存：新档的广度不能沿用上一档
  const freshSlot = freshPlayer({ foraging: 30 })
  check('精通池', '广度缓存随 newGame 清空（换档后不沿用上一档的广度）',
    freshSlot.masteryBreadthOf('foraging').total === 0, `实得 ${freshSlot.masteryBreadthOf('foraging').total}`)

  // ⑨ 🔴 精通次数必须是整数（2026-09-19 用户实测报「次数怎么有小数点」）
  //    广度倍率（×1.03~1.5）直接乘进次数会让卡片显示 `7.000246478873233 / 8 次`。
  //    现在用「整数计数 + 小数进位」：进位存 skills[id].masteryCarry，只把整数部分记进卡片。
  const pInt = freshPlayer({ foraging: 30 })
  for (const t of inst.targets.slice(0, 120)) pInt.skills.foraging.mastery[t.itemId] = maxCount
  const zInt = freshPlayer({ foraging: 30 })
  zInt.applySave(JSON.parse(JSON.stringify(pInt.serialize())))
  zInt.skills.foraging.mastery.apple = 0
  zInt.skills.foraging.masteryCarry = 0
  const multInt = zInt.masteryBreadthOf('foraging').multiplier
  let badInt = 0
  for (let i = 0; i < 300; i++) {
    zInt.addMastery('foraging', 'apple', 1)
    if (!Number.isInteger(zInt.skills.foraging.mastery.apple)) badInt++
  }
  check('精通池', '🔴 精通次数始终是整数（广度倍率用「小数进位」吸收，不写进卡片计数）',
    badInt === 0 && multInt > 1.3 && Number.isInteger(zInt.skills.foraging.mastery.apple),
    `倍率 ${multInt.toFixed(3)} 下出现小数 ${badInt} 次，最终值 ${zInt.skills.foraging.mastery.apple}`)
  check('精通池', '进位被保留且随存档往返（不是丢弃，也不是累到卡片上）',
    zInt.skills.foraging.masteryCarry >= 0 && zInt.skills.foraging.masteryCarry < 1 &&
    (() => { const w = freshPlayer({ foraging: 30 }); w.applySave(JSON.parse(JSON.stringify(zInt.serialize()))); return Math.abs(w.skills.foraging.masteryCarry - zInt.skills.foraging.masteryCarry) < 1e-9 })(),
    `进位 ${zInt.skills.foraging.masteryCarry}`)
  // 旧档里已经被写成小数的次数，读档时必须修回整数（幂等）
  const legacyFrac = JSON.parse(JSON.stringify(zInt.serialize()))
  legacyFrac.skills.foraging.mastery.apple = 7.000246478873233
  const w2 = freshPlayer({ foraging: 30 })
  w2.applySave(legacyFrac)
  check('精通池', '旧档里的小数次数读档自动修成整数（幂等，不留小数）',
    w2.skills.foraging.mastery.apple === 7 && Number.isInteger(w2.skills.foraging.mastery.apple),
    `实得 ${w2.skills.foraging.mastery.apple}`)

  // ⑩ 技能页上方的堆叠（用户 2026-09-19 反馈「目标列表被压到很下面」）
  //    池卡默认**一行**：档位表与规则收进「详情」，不常驻占三行。（断言放在 ⑦ 之后，那里才读到组件源码）
  // ⑦ 接线与「不手抄数字」
  const bar = readFileSync(new URL('../../src/components/MasteryPoolBar.vue', import.meta.url), 'utf8')
  const gv = readFileSync(new URL('../../src/views/GatheringView.vue', import.meta.url), 'utf8')
  const pv = readFileSync(new URL('../../src/views/ProductionView.vue', import.meta.url), 'utf8')
  const help = readFileSync(new URL('../../src/components/MasteryHelp.vue', import.meta.url), 'utf8')
  check('精通池', '采集页与制作页都挂了精通池状态条',
    /MasteryPoolBar/.test(gv) && /MasteryPoolBar/.test(pv))
  check('精通池', '说明弹窗（MasteryHelp）已写进精通池口径',
    /MASTERY_POOL_TIERS/.test(help) && /精通池/.test(help))
  check('精通池', '状态条里的「满精通所需次数」是从函数派生的，没有手写数字',
    /countForMasteryLevel\(/.test(stripComments(bar)) && !/3750/.test(stripComments(bar)),
    '手写数字会让页面与函数各自演化')

  // ⑩ 技能页上方的堆叠（用户 2026-09-19 反馈「目标列表被压到很下面」）
  //    池卡默认**一行**：档位表与规则收进「详情」，不常驻占三行。
  check('精通池', '池卡默认收起成一行（档位表与规则由「详情」展开，不再常驻堆叠）',
    /expanded = ref\(false\)/.test(bar) && /v-if="expanded"/.test(bar) && /详情/.test(bar))
  // 2026-09-27 用户⑩：计划卡整块搬去 `PlanPanel.vue` ⇒ 这条空态断言跟着换文件（判据不变：
  // 提示并进标题行，下面不许再挂一个 `<p v-else>` 重复占一行）。
  check('精通池', '空态「挂机计划」的提示已并入标题行（不再多占一行）',
    !/还没有步骤[\s\S]{0,300}?<p v-else/.test(readFileSync(new URL('../../src/components/PlanPanel.vue', import.meta.url), 'utf8')))
}

// ══════════ C50：后期等级带补档（2026-09-19，第 1 批「挖掘」7 件）══════════
// 起因：实测「每档等级带的相邻间距」后期变疏，与参照作 Melvor Idle（收官 2.6 级/件）形状相反；
//   最严重的是挖掘：`…68, 75, 90` ⇒ 75→90 有 15 级空档、91-99 一件都没有。
// 本批 7 件（岩髓根/玉髓根/云芝/血芝/太岁/朱草/玄玉参）把 61-99 段平均间距 7.3→3.5、最大空档 15→7、最深 90→99。
// 本组断言把「修好的形状」钉住，防回退；同时校验新物品在 ITEMS / ITEM_LEVEL / 图鉴来源 / 图片 四处都齐备。
{
  const { ITEMS } = await import('../../src/game/data/items.js')
  const { ITEM_LEVEL: LV_TABLE } = await import('../../src/game/data/combatLoot.js')
  const { itemSources } = await import('../../src/game/data/itemSources.js')
  const { existsSync } = await import('node:fs')
  const NEW = [
    ['rockCoreRoot', '岩髓根', 78], ['jadePithRoot', '玉髓根', 81], ['cloudFungus', '云芝', 84],
    ['bloodFungus', '血芝', 87], ['taiSui', '太岁', 93], ['vermilionGrass', '朱草', 96], ['mysticRoot', '玄玉参', 99],
  ]
  const ex = getSkillInstance('excavation')
  const lvs = [...new Set(ex.targets.map((t) => t.reqLevel))].sort((a, b) => a - b)
  const late = lvs.filter((l) => l >= 61 && l <= 99) // 段按字面取 61-99：2026-09-29 补档的 102/112 不在此段（它们的形状由 C73 钉）
  const gap = (late.at(-1) - late[0]) / (late.length - 1)
  const maxGap = Math.max(...late.slice(1).map((x, i) => x - late[i]))
  check('后期补档', `挖掘 61-99 段的平均间距 ≤ 3.5（实测 ${gap.toFixed(2)}，补档前是 7.3）`, gap <= 3.5, `实得 ${gap.toFixed(2)}`)
  check('后期补档', `挖掘最大空档 ≤ 7 级（实测 ${maxGap}，补档前是 15）`, maxGap <= 7, `实得 ${maxGap}`)
  check('后期补档', `挖掘最深目标 ≥ Lv99（补档前止步 Lv90，91-99 全空）`, lvs.at(-1) >= 99, `实得 Lv${lvs.at(-1)}`)

  const missing = []
  for (const [id, name, lv] of NEW) {
    const it = ITEMS[id]
    if (!it) { missing.push(`${id} 不在 ITEMS`); continue }
    if (it.name !== name) missing.push(`${id} 名称 ${it.name}≠${name}`)
    if (it.type !== 'ingredient' || !['root', 'fungus'].includes(it.category)) missing.push(`${id} 类目 ${it.category} 不是 root/fungus`)
    if (LV_TABLE[id] !== lv) missing.push(`${id} ITEM_LEVEL ${LV_TABLE[id]}≠${lv}`)
    if (!existsSync(new URL(`../../public/images/items/food/${name}.png`, import.meta.url))) missing.push(`${id} 缺图片 ${name}.png`)
    const src = itemSources(id)
    if (!src.some((s) => s.includes('挖掘获得') && s.includes(`Lv${lv}`))) missing.push(`${id} 图鉴来源缺「挖掘获得（Lv${lv} 解锁）」`)
  }
  check('后期补档', '7 件新物品在 ITEMS / ITEM_LEVEL / 图片 / 图鉴来源 四处齐备', missing.length === 0, missing.slice(0, 4).join(' | '))
  // 名称与 id 唯一（本批的名称是逐个查重后定的，回退或重名会在这里被抓住）
  const all = Object.values(ITEMS)
  check('后期补档', '新增的 7 个名称与 id 全局唯一', new Set(all.map((i) => i.name)).size === all.length && new Set(all.map((i) => i.id)).size === all.length)
  // 山海食经掘藏线：件数与门槛必须跟着件数走（否则「N 件可收集」的文案与难度都会说谎）
  const { SHANHAI_NODES } = await import('../../src/game/data/shanhaiTree.js')
  const dig = SHANHAI_NODES.filter((n) => n.pathId === 'excavation' || String(n.id).startsWith('dig'))
  const lastDig = dig.length ? Math.max(...dig.map((n) => (n.req?.count ?? 0))) : 0
  check('后期补档', `山海食经掘藏线的件数已按 49 件重新标定（最高门槛 ${lastDig} ≤ 49 且 > 42）`, lastDig > 42 && lastDig <= 49, `实得 ${lastDig}`)

  // ── 第 2 批：垂钓 +4 / 狩猎 +3（2026-09-19）──
  const NEW2 = [
    ['kaluga', '鳇鱼', 63, 'fishing'], ['lionfish', '狮鱼', 73, 'fishing'],
    ['blackMarlin', '黑枪鱼', 80, 'fishing'], ['humpheadWrasse', '苏眉鱼', 90, 'fishing'],
    ['cougarMeat', '美洲狮肉', 69, 'hunting'], ['rhinoMeat', '犀牛肉', 84, 'hunting'], ['yetiMeat', '雪怪肉', 97, 'hunting'],
  ]
  const miss2 = []
  for (const [id, name, lv, skill] of NEW2) {
    const it = ITEMS[id]
    if (!it) { miss2.push(`${id} 不在 ITEMS`); continue }
    if (it.name !== name) miss2.push(`${id} 名称 ${it.name}≠${name}`)
    if (ITEM_LEVEL[id] !== lv) miss2.push(`${id} ITEM_LEVEL ${ITEM_LEVEL[id]}≠${lv}`)
    if (!existsSync(new URL(`../../public/images/items/food/${name}.png`, import.meta.url))) miss2.push(`${id} 缺图片`)
    const label = skill === 'fishing' ? '垂钓获得' : '狩猎获得'
    if (!itemSources(id).some((s) => s.includes(label) && s.includes(`Lv${lv}`))) miss2.push(`${id} 图鉴来源缺「${label}（Lv${lv} 解锁）」`)
  }
  check('后期补档', '第 2 批（垂钓 4 + 狩猎 3）在 ITEMS / ITEM_LEVEL / 图片 / 图鉴来源 四处齐备', miss2.length === 0, miss2.slice(0, 4).join(' | '))
  // 间距成果：垂钓 61-99 由 3.5 → **2.53**、狩猎 3.2 → **2.53**（实测值；先前我预估的 ~2.4 偏乐观，以实测为准）
  for (const [skill, limit, before] of [['fishing', 2.6, 3.5], ['hunting', 2.6, 3.2]]) {
    const lvs2 = [...new Set(getSkillInstance(skill).targets.map((t) => t.reqLevel))].filter((l) => l >= 61 && l <= 99).sort((a, b) => a - b) // 段按字面 61-99（补档 102/112 由 C73 钉）
    const g = (lvs2.at(-1) - lvs2[0]) / (lvs2.length - 1)
    check('后期补档', `${skill} 61-99 段平均间距 ≤ ${limit}（实测 ${g.toFixed(2)}，补档前是 ${before}）`, g <= limit, `实得 ${g.toFixed(2)}`)
  }
  // 🔴 伐木那 4 张「可选」已取消：20 档木材是**刚性 5 级网格**（`timberIndexForLevel(lv) = ⌊(lv−1)/5⌋`，
  //    且 `timberOfLevel` 是配方改档与强化消耗的**唯一入口**）⇒ 在 59/69/79/89 插档会让 Lv56-100 全档错位，
  //    那是改锻造与强化的平衡（冻结层），不是加内容。这条断言把「网格未被破坏」钉住。
  const { TIMBERS, TIMBER_BAND, timberIndexForLevel } = await import('../../src/game/data/timbers.js')
  check('后期补档', '伐木仍是 20 档刚性 5 级网格（未插档，保住「N 级装备用 N 级木材」的对齐）',
    TIMBERS.length === 20 && TIMBER_BAND === 5 && TIMBERS.every((t, i) => t.level === 1 + i * TIMBER_BAND) &&
    timberIndexForLevel(59) === Math.floor(58 / 5),
    `档数 ${TIMBERS.length} / 跨度 ${TIMBER_BAND} / 第 12 档 level=${TIMBERS[11]?.level}`)
}

// ══════════ C51：对决页重做（2026-09-19，参照 Melvor Idle 的战斗界面）══════════
// 四项：① 属性面板拆「进攻/防御」两栏，并把**界面上原先看不到但公式里真实存在**的
//   「伤害减免」(def/(def+100)) 与「暴击伤害」(×2) 显示出来；② 掉落由弹窗改**页内常驻列表**
//   （`DropList.vue`，对决页与竞技场共用，删掉两份重复的 `Teleport` 弹窗）；
//   ③ 页内加装备槽概览 + 常驻战备（料理/酱料/饮品 + 自动进食开关）；
//   ④ 风格做成整列按钮并标注「克制 X」。
// ⚠️ 关键的**非恒真**断言是第 3 条：`critMultiplier()` 返回的数字必须等于 `playerAttack` 里
//    `dmg *= N` 里的 N —— 否则界面显示的「暴击伤害」会与真实伤害不符（改公式忘改界面 = 静默不一致）。
{
  const { readFileSync } = await import('node:fs')
  const { stripComments } = await import('./lib/comments.mjs')
  const rd = (p) => stripComments(readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8'))
  const panel = rd('components/CombatPanel.vue')
  const view = rd('views/CombatView.vue')
  const arena = rd('views/ArenaView.vue')
  const engine = rd('game/combat/Combat.js')
  const drop = rd('components/DropList.vue')

  // ① 两栏 + 两个此前缺失的数值
  const need = ['进攻', '防御', '伤害减免', '暴击伤害']
  check('对决页', '属性面板含「进攻/防御」两栏与「伤害减免」「暴击伤害」两个中文标签',
    need.every((k) => panel.includes(k)), need.filter((k) => !panel.includes(k)).join('、') + ' 缺失')
  check('对决页', '「伤害减免」「暴击伤害」的数值取自引擎只读 getter（不在组件里重算公式）',
    panel.includes('reductionPct') && panel.includes('critMultiplier') && engine.includes('reductionPct(def)') && engine.includes('critMultiplier()'),
    '组件或引擎缺 getter')

  // ② 掉落常驻列表：两处共用同一组件，页面里不再有掉落弹窗
  check('对决页', '掉落改用共用组件 DropList，且对决页/竞技场两处都引它',
    drop.includes('drop-list') && view.includes("from '../components/DropList.vue'") && arena.includes("from '../components/DropList.vue'"),
    '组件未建或未两处共用')
  check('对决页', '对决页与竞技场都不再保留掉落弹窗（无 dropModal / 无 Teleport 弹窗）',
    !view.includes('dropModal') && !arena.includes('dropModal') && !view.includes('<Teleport') && !arena.includes('<Teleport'),
    '仍有残留弹窗')
  check('对决页', 'DropList 显示的掉落概率与数量与数据字段一致（chance/qty）',
    drop.includes('d.chance') && drop.includes('d.qty'), 'chance/qty 未展示')

  // ③ 装备槽 + 常驻战备（自动进食开关必须真有消费方，否则就是「静默失效」那一家）
  // ⚠️ 2026-09-19：这块已抽成共用组件 `CombatLoadout.vue`，断言要跟着改文件 —— 否则会变成
  //    「组件搬走了、断言还在旧文件里找」的恒 FAIL（或者更糟：断言放宽成什么都不查）。
  const loadout = rd('components/CombatLoadout.vue')
  // ⚠️ 2026-09-19：装备槽按用户要求搬到「怪物详情」下面 ⇒ 独立成 `EquipmentSlots.vue`，
  //    这条断言跟着指到新文件（组件搬走而断言留在旧文件里 = 恒 FAIL 或变空转）。
  const eqSlots = rd('components/EquipmentSlots.vue')
  check('对决页', '装备槽概览的槽位取自 player.equipment（不另抄一份槽位清单）',
    eqSlots.includes('player.equipment') && eqSlots.includes('SLOT_LABEL'), '槽位来源不对')
  check('对决页', '自动进食开关写回 settings.autoEat，且引擎里确有消费方（非死开关）',
    loadout.includes('player.settings.autoEat =') && engine.includes('s.autoEat'), '开关无消费方')
  // 2026-09-21 用户要求「点击选择食物为当前自动进食的食物」：指定的料理 id 必须
  // 写进 settings.autoEatItem、引擎真的读它、读档过滤脏 id、默认值是 null。
  // ⚠️ 「优先吃指定的那味 / 吃光回落」由下面的**行为断言**（对决节）把关，这里只查接线与存档口径。
  check('对决页', '战备里点选料理会写进 settings.autoEatItem，且引擎按 id 取用',
    loadout.includes('player.settings.autoEatItem =') && engine.includes('s.autoEatItem'),
    '指定的料理没有消费方（点选等于白点）')
  const pstore = rd('stores/player.js')
  check('对决页', 'settings.autoEatItem 三处齐备（默认值 + 存档往返 + 读档过滤脏 id）',
    // ⚠️ 要求**赋值式过滤**（`st.autoEatItem = null`）而不是「出现过 getItem(st.autoEatItem)」：
    //    后者在「过滤那行被删、只剩取水那行」时照样 PASS（反例验证抓到的假绿）。
    //    「过滤真的生效」由上面「存档」节的 pb 行为断言把关。
    /autoEatItem: null/.test(pstore) && /if \(st\.autoEatItem[\s\S]{0,90}st\.autoEatItem = null/.test(pstore),
    '默认值/读档校验缺失')
  check('对决页', '战备面板常驻料理/酱料/饮品与自动进食开关（不再只在战斗中显示）',
    loadout.includes('combat-loadout') && loadout.includes('availableFoods') && loadout.includes('availableSauces') && loadout.includes('availableDrinks'),
    '战备未常驻')

  // ③c 敌人立绘（2026-09-21）：248 张图必须**在磁盘上真实存在**且是 RGBA、尺寸对。
  //     起因：`<img>` 的 @error 会静默隐藏破图（图鉴/卡片都不会报错），只有查文件才发现缺图/坏图。
  //     与「山海食经 400/400 节点图标」同一条纪律：数据里的 imgKey ↔ 磁盘文件必须一一对应。
  check('对决页', '248 个敌人立绘都在磁盘上且是 512×512 带透明的 WebP', (() => {
    const enemies = [...COMBAT_REGIONS.flatMap((r) => r.opponents), ...COMBAT_BOSSES]
    const noKey = enemies.filter((o) => !o.imgKey)
    if (noKey.length) return { ok: false, why: `${noKey.length} 个敌人没有 imgKey` }
    const bad = []
    for (const o of enemies) {
      const rel = `images/enemies/${o.imgKey}.webp`
      const abs = new URL(`../../public/${rel}`, import.meta.url)
      if (!fs.existsSync(fileURLToPath(abs))) { bad.push(`${o.name} 缺 ${rel}`); continue }
      const buf = fs.readFileSync(abs)
      // WebP 头（2026-09-25 从 PNG 换过来）：RIFF....WEBP 之后第一个 chunk 是 'VP8X'（扩展格式）。
      //   VP8X 载荷从第 20 字节起：1 字节 flags（bit4 = 0x10 表示有 alpha 通道）+ 3 字节保留 +
      //   3 字节「画布宽 − 1」（小端）+ 3 字节「画布高 − 1」。
      //   ⚠️ 必须走 VP8X 而不是 VP8：只有 VP8X 才带 alpha 标志位，而我们这些立绘是**透明背景**
      //   （丢了 alpha 会在深色卡上显示成一块实心方块）。实测 PIL q92 + RGBA 输出的正是 VP8X/ALPH 结构。
      if (buf.slice(0, 4).toString('ascii') !== 'RIFF' || buf.slice(8, 12).toString('ascii') !== 'WEBP') { bad.push(`${o.name} 不是 WebP`); continue }
      if (buf.slice(12, 16).toString('ascii') !== 'VP8X') { bad.push(`${o.name} 不是扩展 WebP（无 VP8X，多半丢了 alpha 通道）`); continue }
      const w = buf.readUIntLE(24, 3) + 1, h = buf.readUIntLE(27, 3) + 1
      const want = 512 // 2026-09-21 第三轮定稿 512：卡片立绘 140~168、战斗屏 176 在 DPR 2 下也原生清晰
      // ⚠️ 别退回 256：256 源图在 DPR≥1.5 的屏幕上不够用，就是用户报的「主角/敌人/卡片都糊糊的」
      if (!(buf[20] & 0x10)) bad.push(`${o.name} 没有 alpha 通道`)
      else if (w !== want || h !== want) bad.push(`${o.name} 尺寸 ${w}×${h}（应为 ${want}）`)
    }
    return { ok: bad.length === 0, why: bad.slice(0, 6).join('；') + (bad.length > 6 ? ` …共 ${bad.length} 处` : '') }
  })().ok, (() => {
    const enemies = [...COMBAT_REGIONS.flatMap((r) => r.opponents), ...COMBAT_BOSSES]
    const bad = []
    for (const o of enemies) {
      const abs = new URL(`../../public/images/enemies/${o.imgKey}.webp`, import.meta.url)
      if (o.imgKey && !fs.existsSync(fileURLToPath(abs))) bad.push(o.name)
    }
    return bad.slice(0, 6).join('、')
  })())
  // 🔍 「降采样不许用最近邻」（2026-09-21 用户报「形象都糊糊的」后立）：
  //    立绘源图 512 显示 140~176 ⇒ 降采样，`image-rendering: pixelated` 会掉像素出锯齿。
  //    pixelated 只留给 1:1 / 整数倍放大的小图标（物品图、游戏币）——这里只钉立绘这三处。
  check('对决页', '立绘样式不许用 image-rendering: pixelated（降采样会出锯齿）', (() => {
    const files = ['components/CombatArena.vue', 'views/CombatView.vue', 'components/CombatLoadout.vue']
    // 剥掉注释再查：这几处都写着「不要加 pixelated」的说明文字，直接搜全文会恒 FAIL（注释顶掉断言的坑）
    const bad = files.filter((f) => /image-rendering:\s*pixelated/.test(rd(f)))
    return bad
  })().length === 0, '立绘样式仍用最近邻缩放')
  check('对决页', '立绘源图是 512（三处 CSS 都按 176/140 显示，源图必须更大）', (() => {
    const fs2 = rd('components/CombatArena.vue')
    return /width:\s*176px/.test(fs2)
  })(), '战斗屏立绘尺寸变了，记得同步守卫')

  check('对决页', '立绘路径只在 enemyImage() 里拼、且组件用它（不许手写 /images/enemies/）', (() => {
    const helper = rd('game/data/enemyImage.js')
    const used = ['views/CombatView.vue', 'components/CombatArena.vue'].every((f) => /enemyImage\(/.test(rd(f)))
    const noHardcode = !/['"`]\/images\/enemies\//.test(rd('views/CombatView.vue')) && !/['"`]\/images\/enemies\//.test(rd('components/CombatArena.vue'))
    return helper.includes('images/enemies/') && used && noHardcode
  })(), '组件里手写了立绘路径，或没走 enemyImage()')

  // ③b 「其它要战斗的也同步」（2026-09-19 用户要求，2026-09-20 换成 CombatPanel 口径）：
  //     `CombatPanel` 已经把「战斗屏（CombatArena）+ 日志/战备（CombatLog/CombatLoadout）+ 风格/属性」
  //     打成一包，所以**战斗页只要用 CombatPanel 就等于复用了那一套**；直接引 CombatArena+CombatLoadout
  //     也算合规（旧写法）。页面里一律不许再有自己的血条/日志副本。
  //     ⚠️ 必须同时查「import 了」**和「真的用了」**：只查 `includes('CombatArena')` 会被 import 行蒙过去
  //     （反例验证时抓到的：把 `<CombatArena />` 换回自建战斗框后，import 还在 ⇒ 该断言照样 PASS）。
  const battlePages = [
    'components/CombatPanel.vue', 'views/CombatView.vue', 'views/ArenaView.vue', 'views/TowerView.vue',
    'views/TrialsView.vue', 'views/ChefChallengeView.vue', 'views/MysticRealmView.vue',
  ]
  const notShared = battlePages.filter((f) => {
    const src2 = rd(f)
    if (/<CombatPanel\s*\/>/.test(src2)) return false // ✅ 用共用面板（内含战斗屏 + 日志/战备）
    // ⚠️ 战斗屏现在带 #corner 插槽（战备摆左上角，2026-09-21）⇒ 不能只认自闭合的 `<CombatArena />`
    return !/<CombatArena[\s>]/.test(src2) || !/<CombatLoadout\s*\/>/.test(src2)
  })
  check('对决页', `七个战斗页面都复用共用的战斗 UI（CombatPanel 或 CombatArena + CombatLoadout）`,
    notShared.length === 0, notShared.join('、') + ' 未同步')
  const dupBattle = battlePages.filter((f) => /battle-split|class="card combat-battle"/.test(rd(f)))
  check('对决页', '各战斗页不再自建血条/日志副本（无 battle-split / combat-battle）',
    dupBattle.length === 0, dupBattle.join('、') + ' 仍自建战斗框')
  // 日志已拆成 `CombatLog.vue`（用户要求它只占半行、与战备并排）⇒ 骨架断言跟着拆
  const logCmp = rd('components/CombatLog.vue')
  const arenaCmp = rd('components/CombatArena.vue') // 上面那段重构时被顺手删掉的引用，补回来
  check('对决页', '战斗屏组件含「进度条 + 双方对峙」（梅尔沃式骨架）',
    arenaCmp.includes('arena-bar') && arenaCmp.includes('arena-stage'), '战斗屏骨架缺件')
  // 用户 2026-09-21：未选对手时右侧那一格改成「主角形象的镜像翻转」
  check('对决页', '未选对手时对手位显示主角立绘的镜像（不是空 emoji 格）',
    /enemyImage\(combat\?\.opponent\) \?\? chefImage/.test(arenaCmp)
    && /arena-portrait--mirror/.test(arenaCmp) && /scale: -1 1/.test(arenaCmp),
    '镜像回落缺失（或用了 transform 会被呼吸动画覆盖）')
  check('对决页', '战斗日志已独立成 CombatLog，不再塞在战斗屏里',
    logCmp.includes('battle-log') && !arenaCmp.includes('arena-log'), '日志仍在战斗屏内')
  // 🔀 2026-09-21 用户要求「战备移到（战斗屏）左上角红框位置、战斗日志移到装备位置、装备移到战斗日志位置」：
  //    ① 战备进战斗屏顶行左侧（CombatArena 必须开 #corner 插槽，且 CombatPanel 真的塞了 CombatLoadout）
  check('对决页', '战备摆在战斗屏左上角（CombatArena 的 #corner 插槽 + CombatPanel 传 CombatLoadout）',
    /<slot name="corner"/.test(arenaCmp) && /class="arena-corner"/.test(arenaCmp)
    && /<template #corner>[\s\S]{0,120}<CombatLoadout \/>/.test(panel),
    '战备不在战斗屏左上角')
  //    ② 战斗日志在右栏（原装备槽位置）；左栏（CombatPanel）里不许再留日志，否则就是两份
  check('对决页', '战斗日志搬到右栏（六个战斗页的 .combat-page-side 内都是 CombatLog）', (() => {
    const pages = ['views/CombatView.vue', 'views/ArenaView.vue', 'views/TowerView.vue', 'views/TrialsView.vue', 'views/ChefChallengeView.vue', 'views/MysticRealmView.vue']
    const bad = pages.filter((f) => !/<CombatLog \/>/.test(rd(f)) || !/class="combat-page-side"/.test(rd(f)))
    return bad
  })().length === 0, (() => {
    const pages = ['views/CombatView.vue', 'views/ArenaView.vue', 'views/TowerView.vue', 'views/TrialsView.vue', 'views/ChefChallengeView.vue', 'views/MysticRealmView.vue']
    return pages.filter((f) => !/<CombatLog \/>/.test(rd(f))).join('、') + ' 右栏没有战斗日志'
  })())
  check('对决页', '战斗日志不再留在左栏（CombatPanel 里没有 CombatLog，日志只有一份）',
    !panel.includes('CombatLog') && !/class="combat-bottom"/.test(panel), '左栏仍有日志副本')
  //    ③ 装备槽回到左栏（CombatPanel 里），且**八个槽位排成一排**（写死 8 列，不用 auto-fill —— 它会折行）
  check('对决页', '装备槽摆在左栏（CombatPanel 内，与战斗屏同屏）',
    /<EquipmentSlots \/>/.test(panel), '装备槽不在左栏')
  check('对决页', '装备槽一排 8 格（写死 8 列、窄屏降 4 列）',
    /repeat\(8, minmax\(0, 1fr\)\)/.test(eqSlots) && /repeat\(4, minmax\(0, 1fr\)\)/.test(eqSlots), '等于 8 格的列数没写死')
  check('对决页', '装备槽已从战备卡里移出（加载项里不再含 .eq-slot）',
    !loadout.includes('eq-slot') && eqSlots.includes('eq-slot'), '装备仍在战备卡')

  // ③c 对决页只留战斗相关：不出现「挂机计划」与「食神秘境」两块（2026-09-19 用户要求）
  check('对决页', '对决页不再显示「食神秘境」入口卡',
    !view.includes('realm-card') && !view.includes('食神秘境'), '仍有秘境卡')
  const skillView = rd('views/SkillView.vue')
  // 2026-09-27 用户⑩：挂机计划整块搬到底栏胶囊（PlanPanel.vue）⇒ 这条断言改了判据：
  // 不再是「技能页用 v-if 藏起来」，而是「**技能页里根本没有它**」（底栏与技能页无关，天然不会出现在对决页），
  // 顺带要求 PlanPanel 确实挂在底栏（否则计划就成了没有入口的死功能）。
  check('对决页', '「挂机计划」不在技能页（已搬到底栏胶囊；对决页因此天然不会再出现它）',
    !skillView.includes('plan-card') && /PlanPanel/.test(rd('components/BottomDock.vue')),
    '挂机计划又回到技能页，或底栏没有挂它')

  // ③e App.vue（2026-09-19 用户要求）：「两条常驻提示」从内容顶部移到中间列底栏；
  //     「中间底部状态条」直接去掉（它右侧那排装备槽已由 EquipmentSlots 承担）。
  const appSrc = rd('App.vue')
  // 判据用**位置**而不是切片：`head-strips` 现在在 `</main>` 之前（是底栏），切到 `</main>` 会把它也框进去。
  // 真正的契约是「它不在滚动区开头、不在第一个视图组件之前」。
  const iScroll = appSrc.indexOf('class="main-scroll"')
  const iFirstView = appSrc.indexOf('<ShopView')
  const iStrips = appSrc.indexOf('class="head-strips"')
  check('对决页', '两条常驻提示已移出内容滚动区顶部（每页正文从最顶端开始）',
    iStrips > iScroll && iStrips > iFirstView && iFirstView > 0, `strips@${iStrips} scroll@${iScroll} view@${iFirstView}`)
  check('对决页', '中间底部状态条已删除（无 .bottom-nav）',
    !appSrc.includes('bottom-nav') && !rd('styles/main.css').includes('bottom-nav'), '底栏残留')
  check('对决页', '底栏位置给 BGM 胶囊留了让位宽度（padding-right）',
    /\.head-strips \{[\s\S]{0,400}padding-right/.test(rd('styles/main.css')), '未给胶囊让位')

  // ③d 属性说明改悬浮（2026-09-19 用户「描述太多了」）：常显行必须消失，换成 follow-tooltip
  check('对决页', '属性说明改为悬浮显示（不再常显 .attr-hint 行）',
    !panel.includes('attr-hint') && panel.includes('follow-tooltip') && panel.includes('bindTip'),
    '说明仍是常显')

  // ④ 风格整列 + 克制标注（标注里带「伤害 +N%」，N 取自引擎 getter，见下方非恒真断言）
  check('对决页', '风格按钮标注「克制 X」且取自 STYLE_ADVANTAGE，并标出克制伤害加成',
    panel.includes('克制') && panel.includes('STYLE_ADVANTAGE[s]') && panel.includes('advPct'), '缺克制标注')

  // ⑤ 非恒真：界面显示的暴击倍率 == 伤害公式里的字面量（**两处**：玩家暴击、对手暴击）
  const crits = [...engine.matchAll(/dmg \*=\s*(\d+)/g)].map((m) => m[1])
  const mGetter = engine.match(/critMultiplier\(\)\s*\{\s*return (\d+)/)
  check('对决页', `暴击倍率：getter(${mGetter?.[1] ?? '?'}) == 伤害公式 dmg *= [${crits.join(', ')}]（改公式必须同步 getter）`,
    crits.length >= 2 && !!mGetter && crits.every((c) => c === mGetter[1]),
    `公式 [${crits.join(', ')}] vs getter ${mGetter?.[1]}`)
  // 减伤口径：公式两处（看对手 def / 看玩家 defense）+ getter 一处，共 3 处「/(x+100)」形态
  // ⚠️ 正则要容 `o.def` 这种带点号的属性名（写成 `\w+` 会只匹配到 getter 里的 `d`，恒 FAIL）
  const redForms = (engine.match(/\(\s*[\w.]+\s*\+\s*100\s*\)/g) ?? []).length
  check('对决页', `减伤口径 def/(def+100) 在引擎里保持同源（含 getter 共 ${redForms} 处）`, redForms >= 3, `只找到 ${redForms} 处`)
  // 同样非恒真：风格按钮上标的「伤害 +N%」== 两处 `advantage ? 1.15 : 1` 里的 1.15
  const advs = [...engine.matchAll(/advantage \?\s*([\d.]+)\s*:\s*1/g)].map((m) => m[1])
  const mAdv = engine.match(/advantageMultiplier\(\)\s*\{\s*return ([\d.]+)/)
  check('对决页', `克制倍率：getter(${mAdv?.[1] ?? '?'}) == 伤害公式 advantage ? [${advs.join(', ')}]（改公式必须同步 getter）`,
    advs.length >= 2 && !!mAdv && advs.every((a) => a === mAdv[1]),
    `公式 [${advs.join(', ')}] vs getter ${mAdv?.[1]}`)
}

// ══════════ C52：采集/制作「默认只展开当前等级段」（2026-09-19 用户要求）══════════
// 起因：默认全部折叠时，玩家每次进页只看到一排时代标题、得先点开才知道自己能采/能做什么。
// 本组把「默认展开当前段」钉住，重点是**别静默回退到最后一段**（这个 bug 真发生过：
// `ProductionView` 的 sections 映射只留了 label/era/list、把 from/to 丢了 ⇒ 1 级玩家默认展开 Lv91-100）。
{
  const { readFileSync } = await import('node:fs')
  const { stripComments } = await import('./lib/comments.mjs')
  const { levelEras, currentEraLabel, eraLabel: eraLab } = await import('../../src/game/data/levelEras.js')
  const items = [1, 5, 11, 12, 25, 95, 100, 111, 120].map((lv) => ({ reqLevel: lv, id: `i${lv}` }))
  const secs = levelEras(items, (t) => t.reqLevel, (t) => t.id)
  const pick = (lv) => currentEraLabel(secs, lv)
  check('等级段', `currentEraLabel 按等级命中正确的段（1→${pick(1)} / 12→${pick(12)} / 120→${pick(120)}）`,
    pick(1) === eraLab(1, 10) && pick(12) === eraLab(11, 20) && pick(120) === secs[secs.length - 1].label,
    `1→${pick(1)} 12→${pick(12)} 120→${pick(120)}`)
  check('等级段', 'currentEraLabel 的兜底是「低于第一段→第一段」「空表→null」，不是无脑最后一段',
    currentEraLabel(secs, 0) === secs[0].label && currentEraLabel([], 5) === null,
    `0→${currentEraLabel(secs, 0)} 空表→${currentEraLabel([], 5)}`)
  const rd2 = (p2) => stripComments(readFileSync(new URL(`../../src/${p2}`, import.meta.url), 'utf8'))
  const gv = rd2('views/GatheringView.vue')
  const pv = rd2('views/ProductionView.vue')
  check('等级段', '采集页与制作页都按「当前等级段」算默认展开（都引 currentEraLabel）',
    gv.includes('currentEraLabel') && pv.includes('currentEraLabel'), '有页面没接')
  // 🔴 反向验证过的：把 `from: sec.from` 删掉 → 该断言 FAIL（它就是那个 bug 的成因）
  check('等级段', '制作页的 sections 保留了 from/to（丢了会静默回退到最后一段）',
    /from:\s*sec\.from/.test(pv) && /to:\s*sec\.to/.test(pv), '边界字段被丢弃')
  // 用户 2026-09-19 第二次澄清后的**最终形态**：等级段 = 顶部标签页，**只显示当前段的卡片**、
  // 没有折叠、点标签切换。（第一版做成「十个段标题 + 只展开当前段」被用户否掉：那样还得滚。）
  const tabsOk = (src2) => src2.includes('era-tabs') && src2.includes('selectEra') && src2.includes('activeSec')
  const noAccordion = (src2) => !src2.includes('toggleSection') && !src2.includes('isOpen(')
  check('等级段', '采集页与制作页都改成「顶部标签页 + 只渲染当前段」',
    tabsOk(gv) && tabsOk(pv), '有页面还留在旧形态')
  check('等级段', '两页都已无折叠手风琴（toggleSection / isOpen 全清）',
    noAccordion(gv) && noAccordion(pv), '仍有折叠残留')
  check('等级段', '默认段 = 当前等级所在段（selectedEra 初始值取 currentEraLabel）',
    /selectedEra\s*=\s*ref\(eraDefault\(\)\)|selectedEra\s*=\s*ref\(currentEraLabel/.test(gv) &&
    /selectedEra\s*=\s*ref\([\s\S]{0,60}?eraDefault\(\)/.test(pv), '默认段不是当前段')
  // 「去做」跳转必须改成**切标签页**（旧实现是 toggleSection(标签)，现在没有折叠可开）
  check('等级段', '制作页「去做」跳转 = 切到目标配方所在段（selectEra + sectionLabelOf）',
    /selectEra\(sectionLabelOf\(/.test(pv), '跳转没改成切段')
}

// ══════════ C53：成长阻尼 + 材料成本系数（2026-09-21，用户「砍一点，然后增加所需材料数量」）══════════
{
  const { readdirSync, readFileSync } = await import('node:fs')
  const CAL_TOTAL = 7462 // 生成器产物的原始材料件数合计（2026-09-21 标定：含烹饪/烘焙/腌制/调酒/调料/锻造/保鲜/食灵/副业）
  const CAL_TOTAL_LATE = 1976 // 补档/扩展批新增配方的原始材料件数合计：459（09-29 补档）+ 264（保鲜 Ⅵ/Ⅶ）+ 516（T3 同物变体 48 条）+ 737（v2.29.7 副业档位加密 142 条：15 支各 9 + 木工 9）
  const CAL_COUNT = 1502 // 同上：配方条数（09-29 补档 +57：制作 9 + 副业 30 + 木工 2 + 装备线 16；保鲜 Ⅵ/Ⅶ +6；T3 同物变体 45 + 3 = +48；v2.29.7 档位加密 +142）
  const c53 = (rel) => stripComments(readFileSync(new URL(`../../src/${rel}`, import.meta.url), 'utf8'))

  // ── A. 成长阻尼：乘法叠区（转生 × 增益剂 × 精通或设置 × 对决补正 × 限时窗口）先相乘、再统一折减 ──
  check('成长阻尼', '常数 XP_STACK_DAMPING = 0.75（改它=全局成长速度变化，必须同步 sim 基准与 AGENTS §成长速度）',
    XP_STACK_DAMPING === 0.75, `实际 ${XP_STACK_DAMPING}`)
  check('成长阻尼', '公式 damp(p) = 1 + (p − 1) × 系数：×1.2→×1.15 / ×3→×2.5 / ×13.5→×10.375',
    Math.abs(dampXpStack(1.2) - 1.15) < 1e-9 && Math.abs(dampXpStack(3) - 2.5) < 1e-9 && Math.abs(dampXpStack(13.5) - 10.375) < 1e-9,
    `${dampXpStack(1.2)} / ${dampXpStack(3)} / ${dampXpStack(13.5)}`)
  check('成长阻尼', '不产生惩罚：p ≥ 1 ⇒ 1 ≤ damp(p) ≤ p（永远只是「少拿」而不是「倒扣」）',
    [1, 1.2, 3, 13.5, 300].every((v) => dampXpStack(v) >= 1 && dampXpStack(v) <= v))
  check('成长阻尼', '严格单调递增（堆更多乘区绝不会更慢，防「转生反而变慢」类倒退）',
    [1, 1.2, 2, 3, 5, 13.5, 101, 300, 1e4].every((v, i, arr) => i === 0 || dampXpStack(v) > dampXpStack(arr[i - 1])))
  check('成长阻尼', '渐进：低乘区几乎不动（×1.2 只降 4.2%）／高乘区才明显（×101 → ×76，降 24.8%）',
    Math.abs(1 - dampXpStack(1.2) / 1.2) < 0.05 && Math.abs(1 - dampXpStack(101) / 101) > 0.2,
    `×1.2 降 ${(1 - dampXpStack(1.2) / 1.2).toFixed(3)}｜×101 降 ${(1 - dampXpStack(101) / 101).toFixed(3)}`)
  check('成长阻尼', '非法输入回退 ×1（NaN / 0 / 负数都不会污染经验计算）',
    dampXpStack(NaN) === 1 && dampXpStack(0) === 1 && dampXpStack(-5) === 1 && dampXpStack(undefined) === 1)

  // 行为断言（真实引擎）：授予经验之比必须等于**阻尼后**的比值 —— 而不是各层原值之比
  {
    const grantXp = (prestiges, tonicMult) => {
      const pp = freshPlayer()
      // ⚠️ 等级取 90：**故意的** —— 二级饱和（C71）在 Lv≤70 会把 13.5 的叠区夹到 10.037，
      //    而这条断言的**意图**是「两处乘区按乘积折减、不是逐层折减」，必须在**未被饱和**的区间量。
      //    （Lv71+ 的上界是 14 > 10.375 ⇒ 原样通过；饱和本身由 C71 的四条不变量 + 行为断言守。）
      pp.setSkillState('cooking', { level: 90, exp: 0, prestiges })
      if (tonicMult) pp.buffs.xpMult = { mult: tonicMult, expiresAt: Date.now() + 60_000 }
      const inst = getSkillInstance('cooking')
      pp.setSkillState('cooking', { level: 90, exp: 0 })
      return inst.addXp(10000, 1)
    }
    const base = grantXp(0)
    const pre10 = grantXp(10)
    const tonic = grantXp(0, 4.5)
    const both = grantXp(10, 4.5)
    check('成长阻尼', '行为：转生 10 层的实际经验 = 阻尼后的 ×2.5（不是 ×3.0）',
      Math.abs(pre10 / base - dampXpStack(1 + 10 * PRESTIGE_XP_BONUS)) < 1e-6,
      `实际 ×${(pre10 / base).toFixed(3)} ≠ ×${dampXpStack(1 + 10 * PRESTIGE_XP_BONUS)}`)
    check('成长阻尼', '行为：增益剂 ×4.5 的实际经验 = 阻尼后的 ×3.625（不是 ×4.5）',
      Math.abs(tonic / base - dampXpStack(4.5)) < 1e-6, `实际 ×${(tonic / base).toFixed(3)} ≠ ×${dampXpStack(4.5)}`)
    check('成长阻尼', '🔴 行为：两处乘区叠加（3.0 × 4.5 = 13.5）按**乘积**折减（×10.375），不是逐层折减（2.5 × 3.625 = 9.06）',
      Math.abs(both / base - dampXpStack(13.5)) < 1e-6 && Math.abs(both / base - dampXpStack(3) * dampXpStack(4.5)) > 0.5,
      `实际 ×${(both / base).toFixed(3)}`)
  }
  check('成长阻尼', '各层原值一分未动（PRESTIGE_XP_BONUS 仍是 0.2：转生 +20%/层 的承诺没被砍，砍的是叠区）',
    PRESTIGE_XP_BONUS === 0.2)
  {
    const sk = c53('game/skills/Skill.js')
    check('成长阻尼', 'Skill.addXp 里是「先相乘再阻尼」（dampXpStack(a * b * …)）',
      /dampXpStack\(\s*prestigeMult\s*\*\s*tonicMult\s*\*\s*growthMult\s*\*\s*catchup\s*\*\s*marketMult\s*\)/.test(sk))
    check('成长阻尼', '🔴 反向：不得逐层乘阻尼（那是「把每层系数都调低」，会让高阶档位白做）',
      !/dampXpStack\(prestigeMult\)\s*\*/.test(sk) && !/\*\s*dampXpStack\(tonicMult\)/.test(sk))
  }
  check('成长阻尼', '效果总览已登记（否则玩家自己乘出来的数与实际到账对不上）',
    c53('game/data/activeEffects.js').includes("id: 'xpStackDamping'"))
  check('成长阻尼', '转生那条展示不再硬写 0.2（改用 Skill.js 导出的 PRESTIGE_XP_BONUS，消掉第二真相）',
    /PRESTIGE_XP_BONUS \* st\.prestiges/.test(c53('game/data/activeEffects.js')))

  // ── B. 材料成本系数：原始数据 + 单一缩放出口（数据层一个字节都不动）──
  check('材料成本', '常数 MATERIAL_COST_MULT = 2（改它=全局材料需求变化，必须同步 AGENTS §材料成本）',
    MATERIAL_COST_MULT === 2, `实际 ${MATERIAL_COST_MULT}`)
  check('材料成本', 'materialQty：至少 1、四舍五入；非法/非正输入 → 0（0 表示跳过该材料）',
    materialQty(1) === 2 && materialQty(3) === 6 && materialQty(0) === 0 && materialQty(-1) === 0 && materialQty(NaN) === 0 && materialQty('x') === 0)
  {
    const rc = getSkillInstance('cooking')?.recipes?.[0] ?? SIDELINE_RECIPES.pottery[0]
    const before = JSON.stringify(rc.ingredients)
    const a = effIngredients(rc)
    const b = effIngredients(rc)
    check('材料成本', 'effIngredients 是纯函数：不改动传入的配方对象、两次调用结果一致',
      JSON.stringify(rc.ingredients) === before && JSON.stringify(a) === JSON.stringify(b))
    check('材料成本', 'effIngredients：件数 = 原始 × 系数、key 与原始完全一致（缩放不改变材料种类）',
      JSON.stringify(Object.keys(a).sort()) === JSON.stringify(Object.keys(rc.ingredients).sort()) &&
      Object.entries(rc.ingredients).every(([id, q]) => a[id] === materialQty(q)) &&
      materialTotal(rc) === Object.values(a).reduce((x, y) => x + y, 0))
  }
  {
    // 冻结基线：全部制作配方（技能实例口径，已含 recipeBalance/timberRecipes 的变换）的原始材料件数合计。
    // 这是「没人在数据层偷偷加材料」的绊线：改了 ingredients 的数量 → 立刻 FAIL。
    const pTot = freshPlayer()
    let tot = 0
    let n = 0
    for (const inst of getAllSkillInstances()) {
      if (inst.type !== 'production') continue
      for (const r of inst.recipes ?? []) {
        n++
        for (const q of Object.values(r.ingredients ?? {})) tot += q
      }
    }
    check('材料成本', '原始数据未被改写（冻结数据铁律）：全部制作配方的材料件数合计 == 生成器基线 + 补档',
      tot === CAL_TOTAL + CAL_TOTAL_LATE, `实际 ${tot}（配方 ${n} 条；生成器基线 ${CAL_TOTAL} + 补档 ${CAL_TOTAL_LATE}）`)
    check('材料成本', `配方条数基线未变（CAL_COUNT 条：材料系数只放大数量，不增删配方）`, n === CAL_COUNT, `实际 ${n}`)
  }
  {
    // 🔴 唯一出口静态断言：全 src 里「按数量读/遍历 .ingredients」只允许这 3 个文件
    //    （materialCost.js = 出口自身；recipeBalance/timberRecipes = 模块加载期的等级/木材改写层，与数量无关）
    // ⚠️ 三种写法都要抓（第一版只抓 Object.entries/keys，反例验证时 `v-for="… in r.ingredients"` 漏掉了：
    //    把制作页显示改回原始数量，守卫依然全绿 —— 假绿）：
    //    ① Object.entries/keys(x.ingredients)  ② v-for="… in x.ingredients"  ③ x.ingredients[mid] 取数量
    const RAW_PATTERNS = [
      /Object\.(entries|keys)\([^)]*\.ingredients/,
      /v-for="[^"]*\bin\s+[\w.$?[\]()]*\.ingredients\b/,
      /\.ingredients\s*\??\.?\s*\[/,
    ]
    const ALLOW = ['materialCost.js', 'recipeBalance.js', 'timberRecipes.js']
    const offenders = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = new URL(`${e.name}${e.isDirectory() ? '/' : ''}`, dir)
        if (e.isDirectory()) { walk(p); continue }
        if (!/\.(js|vue)$/.test(e.name)) continue
        const src = stripComments(readFileSync(p, 'utf8'))
        if (RAW_PATTERNS.some((re) => re.test(src)) && !ALLOW.includes(e.name)) offenders.push(e.name)
      }
    }
    walk(new URL('../../src/', import.meta.url))
    check('材料成本', '🔴 唯一出口：不许再按数量读/遍历 recipe.ingredients（只能用 effIngredients/materialText）',
      offenders.length === 0, offenders.join('、'))
    const need = {
      'game/skills/ProductionSkill.js': 'effIngredients',
      'views/ProductionView.vue': 'effIngredients',
      'views/LogView.vue': 'effIngredients',
      'components/RecipeTreeModal.vue': 'effIngredients',
      'game/data/itemSources.js': 'materialText',
      'game/data/itemUses.js': 'effIngredients',
      'game/data/valueBalance.js': 'effIngredients',
      'game/data/flavorRecipes.js': 'effIngredients',
      'game/data/cookingFest.js': 'effIngredients',
    }
    const missing = Object.entries(need).filter(([f, sym]) => !c53(f).includes(sym)).map(([f]) => f)
    check('材料成本', '9 处消费/显示/派生点都已接线到唯一出口（漏一处=显示与实际不一致）',
      missing.length === 0, missing.join('、'))
  }
  {
    // 行为：只够「原始用量」的材料做不了；补到 ×2 才能做；一次制作恰好扣掉生效用量
    const pm = freshPlayer()
    const inst = getSkillInstance('cooking')
    const rc = inst.recipes[0]
    const eff = effIngredients(rc)
    pm.setSkillState('cooking', { level: rc.reqLevel, exp: 0 })
    for (const [id, q] of Object.entries(rc.ingredients)) pm.inventory[id] = q
    const rawEnough = inst.canCraft(rc)
    for (const [id, q] of Object.entries(eff)) pm.inventory[id] = q
    const effEnough = inst.canCraft(rc)
    const beforeSnapshot = Object.fromEntries(Object.keys(eff).map((id) => [id, pm.inventory[id] ?? 0]))
    inst.craft(rc)
    const spent = Object.entries(eff).every(([id, q]) => (pm.inventory[id] ?? 0) === Math.max(0, beforeSnapshot[id] - q))
    check('材料成本', '行为：只够原始用量的材料**做不了**（canCraft=false）——这条在改前是「能做」',
      rawEnough === false && Object.keys(rc.ingredients).length > 0, `rawEnough=${rawEnough}`)
    check('材料成本', '行为：补到生效用量后可以做，且一次制作恰好扣掉生效用量',
      effEnough === true && spent, `effEnough=${effEnough} spent=${spent}`)
  }
  {
    // 图鉴三查侧：来源串与「可用于制作」的用量都必须是生效用量
    const r0 = SIDELINE_RECIPES.pottery[0]
    const outId = r0.output.itemId
    const [mid, mq] = Object.entries(r0.ingredients)[0]
    const nm = getItem(mid)?.name ?? mid
    const srcs = itemSources(outId).join('｜')
    check('材料成本', `图鉴来源串用生效用量（${nm}×${mq} → ×${mq * MATERIAL_COST_MULT}）`,
      srcs.includes(`${nm}×${mq * MATERIAL_COST_MULT}`), srcs.slice(0, 90))
    const uses = itemUses(mid).filter((u) => u.outputId === outId)
    check('材料成本', '图鉴「可用于制作」的用量 == effIngredients（不再显示原始数量）',
      uses.length > 0 && uses.every((u) => u.qty === effIngredients(r0)[mid]), JSON.stringify(uses.map((u) => u.qty)))
    check('材料成本', '炼金刻意未纳入（AlchemyView 不引用材料系数：产物价值由投入价值反推，放大投入会静默重新定价）',
      !c53('views/AlchemyView.vue').includes('materialCost'))
  }
}

// ══════════ C71：叠区二级饱和（2026-09-29，用户「游玩时长因为 buff 被缩短不解决吗」）══════════
// 背景：四层相乘原始上限 101×、阻尼后 76× ⇒ 全技能并行满级被压缩 **59×**（无buff 35 天 → 满buff 14.3h）。
// 处置**不是**「砍各层幅度」（算过：把原始乘积 101 → 18.3 需要每层超出部分砍到 f≈0.48，会无差别拖慢早期玩家、
// 要重写约 15 处玩家可见承诺、且治不了「转生层数无上限」），而是**在 dampXpStack 之后按等级夹上界、超界部分只按尾巴计入**。
{
  const { xpSpeedupCap, capXpSpeedup, XP_SPEEDUP_CAP_BANDS, XP_TAIL_RATE } = await import('../../src/game/core/growthRate.js')
  check('叠区饱和', '上界分档 = 6 / 10 / 14（Lv1-40 / 41-70 / 71-99）',
    xpSpeedupCap(1) === 6 && xpSpeedupCap(40) === 6 && xpSpeedupCap(41) === 10
    && xpSpeedupCap(70) === 10 && xpSpeedupCap(71) === 14 && xpSpeedupCap(99) === 14,
    [1, 40, 41, 70, 71, 99].map(xpSpeedupCap).join('/'))
  check('叠区饱和', '分档表单调不减（防止有人改成递减/删掉最后一档）',
    XP_SPEEDUP_CAP_BANDS.length === 3 && XP_SPEEDUP_CAP_BANDS.every((b, i, a) => i === 0 || b.cap >= a[i - 1].cap))
  check('叠区饱和', '尾巴系数 = 0.1 且 > 0（为 0 就是硬夹，会让高阶档位与小档位拉平）',
    XP_TAIL_RATE === 0.1 && XP_TAIL_RATE > 0)
  // 不变量①：未达上界**原样通过**（无/单一/中配三档必须逐值不变 —— 只在病灶处咬）
  check('叠区饱和', '未达上界原样通过（×4.3 → ×4.3，低档不受影响）',
    capXpSpeedup(99, 4.3) === 4.3 && capXpSpeedup(1, 5.9) === 5.9)
  // 不变量②：恒 ≥1、非法输入回退 1（与 dampXpStack 同一套口径）
  check('叠区饱和', '恒 ≥1 且非法输入回退 1（0 / 1 / NaN / 负数）',
    capXpSpeedup(99, 1) === 1 && capXpSpeedup(99, 0) === 1 && capXpSpeedup(99, NaN) === 1 && capXpSpeedup(99, -5) === 1)
  // 不变量③：**严格单调**（超界后仍有尾巴 ⇒ 转生 8/9/10 层在经验上仍然有差别）
  {
    const ladder = [8, 9, 10].map((n) => capXpSpeedup(99, (1 + n * 0.2) * 4.5 * 5 * 1.5))
    check('叠区饱和', '超界后**严格单调**（转生 8/9/10 层逐级递增，不是硬夹那种「拉平」）',
      ladder[0] < ladder[1] && ladder[1] < ladder[2], ladder.map((v) => v.toFixed(3)).join(' < '))
  }
  // 不变量④：满配（叠区 76）在最高档只到 14 + (76−14)×0.1 = 20.2 ⇒ 压缩从 59× 收到 ≈20×
  check('叠区饱和', '满配叠区（76）在满级档饱和到 ≈20.2×',
    Math.abs(capXpSpeedup(99, 76) - 20.2) < 0.05, capXpSpeedup(99, 76).toFixed(3))
  // 静态接线：唯一消费点必须**同时**过阻尼与饱和；且必须登记进效果总览
  {
    const sk = stripComments(fs.readFileSync(new URL('../../src/game/skills/Skill.js', import.meta.url), 'utf8'))
    check('叠区饱和', '唯一消费点 `Skill.addXp` 同时过 dampXpStack 与 capXpSpeedup（漏一处即静默失效）',
      /capXpSpeedup\(\s*this\.level\s*,\s*dampXpStack\(/.test(sk))
    const aeSrc = fs.readFileSync(new URL('../../src/game/data/activeEffects.js', import.meta.url), 'utf8')
    check('叠区饱和', '已登记进「效果总览」（玩家自己乘出来的数与实际到账的差额必须说清）',
      aeSrc.includes('xpSpeedupCap') && aeSrc.includes('XP_TAIL_RATE'))
  }
  // 行为断言（真实引擎）：满配 + 满级技能 ⇒ 单次到账被夹在 ≈20×（未夹会是 ≈76×）
  {
    const pf = freshPlayer()
    createSkillInstances(pf)
    pf.skills.foraging.level = 99
    pf.skills.foraging.prestiges = 10
    pf.settings.xpMultiplier = 5
    pf.buffs.xpMult = { mult: 4.5, expiresAt: Date.now() + 1e9 }
    pf.marketBoost = () => ({ gatherXp: 1.5, craftXp: 1.5, combatXp: 1.5, restaurant: 1.5 })
    const inst = getSkillInstance('foraging')
    const got = inst.addCardXp(1000, 1, 99)
    const raw = 1000 * 60 // CARD_XP_SCALE
    check('叠区饱和', '行为断言：满配满级时实际到账被夹在 ≈20× 以内（未夹会 ≈76×）',
      got > 0 && got / raw < 21 && got / raw > 15, `实际 ${(got / raw).toFixed(2)}×`)
  }
}

// ══════════ C54：低目标经验衰减（2026-09-22，用户「鼓励玩家去挂对应等级段的目标」）══════════
// 机制：目标/配方等级 ≤ 参照等级 − 5 ⇒ 卡片经验 ×0.5。参照等级 = min(技能等级, 该技能最高可用目标等级)。
// 唯一出口 = `Skill.addCardXp(base, mult, targetLevel)`（采集/制作/探索/农耕/副业/离线全部经此）。
{
  const { readdirSync, readFileSync } = await import('node:fs')
  const c54 = (rel) => stripComments(readFileSync(new URL(`../../src/${rel}`, import.meta.url), 'utf8'))

  // ── A. 常数与纯函数（growthRate.js）──
  check('低目标衰减', '常数：低 5 级起减半（LOW_TARGET_GAP=5 / LOW_TARGET_XP_MULT=0.5）',
    LOW_TARGET_GAP === 5 && LOW_TARGET_XP_MULT === 0.5, `${LOW_TARGET_GAP} / ${LOW_TARGET_XP_MULT}`)
  check('低目标衰减', '边界：低 4 级不减 / 低 5 级减半 / 低 6 级也减半（「5 级及以上」）',
    targetLevelXpMult(50, 46, 99) === 1 && targetLevelXpMult(50, 45, 99) === 0.5 && targetLevelXpMult(50, 44, 99) === 0.5,
    `${targetLevelXpMult(50, 46, 99)} / ${targetLevelXpMult(50, 45, 99)} / ${targetLevelXpMult(50, 44, 99)}`)
  check('低目标衰减', '参照等级 = min(技能等级, 该技能顶档)：技能 120 而顶档 91 ⇒ 参照 91（顶档不被罚）',
    lowTargetRefLevel(120, 91) === 91 && lowTargetRefLevel(50, 99) === 50 && lowTargetRefLevel(50, null) === 50,
    `${lowTargetRefLevel(120, 91)} / ${lowTargetRefLevel(50, 99)} / ${lowTargetRefLevel(50, null)}`)
  check('低目标衰减', '🔴 空值不误罚（**不是**当成 0 级）：null/undefined/空串/NaN/0/负数 ⇒ 系数 1',
    [null, undefined, '', NaN, 0, -3, 'abc'].every((v) => targetLevelXpMult(50, v, 99) === 1),
    // 踩过的真缺陷：`Number(null) === 0` ⇒ 0 ≤ 参照−5 恒真 ⇒ 离线拿不到目标时反而把经验砍半
    JSON.stringify([null, undefined, '', NaN, 0, -3].map((v) => targetLevelXpMult(50, v, 99))))
  check('低目标衰减', '永不抬高：枚举 1~130 级 × 1~130 级目标，结果只可能是 1 或 0.5',
    (() => {
      const bad = []
      for (let s = 1; s <= 130; s++) for (let t = 1; t <= 130; t++) {
        for (const top of [null, 85, 99, 120]) {
          const v = targetLevelXpMult(s, t, top)
          if (v !== 1 && v !== LOW_TARGET_XP_MULT) bad.push(`${s}/${t}/${top}=${v}`)
        }
      }
      return bad.length === 0
    })())
  check('低目标衰减', '等级可能是字符串（数据里 reqLevel 有字符串形态）⇒ 与数字等价',
    targetLevelXpMult(50, '45', 99) === 0.5 && targetLevelXpMult('50', '46', 99) === 1)

  // ── B. 实例层：参照系是真实顶档，且真实引擎恰好按 0.5 结算 ──
  {
    freshPlayer()
    const rows = []
    for (const inst of getAllSkillInstances()) {
      const list = inst.targets ?? inst.recipes ?? inst.crops ?? null
      if (!Array.isArray(list) || !list.length) continue
      rows.push({ id: inst.id, top: Math.max(...list.map((x) => x.reqLevel)), got: inst.topTargetLevel })
    }
    check('低目标衰减', `每个带目标表的技能都报出真实顶档（≥85 级，共 ${rows.length} 个）`,
      rows.length >= 30 && rows.every((r) => r.got === r.top && r.top >= 85),
      JSON.stringify(rows.filter((r) => r.got !== r.top || r.top < 85)))

    // 真实引擎行为（大 base 避开 Math.floor 噪声）：低目标 0.5×、非低目标 1×、拿不到等级 1×
    const p = freshPlayer()
    const p0 = freshPlayer({ foraging: 50 })
    const fo = getSkillInstance('foraging')
    const gain = (base, lv, inst = fo) => {
      const before = inst.exp
      inst.addCardXp(base, 1, lv)
      return inst.exp - before
    }
    const hi = gain(1000, 50) // 参照 = min(50,99) = 50 ⇒ 目标 50 不减半
    check('低目标衰减', '行为：低目标恰好 0.5×（真实 addCardXp）',
      gain(1000, 45) === Math.round(hi * 0.5) || Math.abs(gain(1000, 45) / hi - 0.5) < 0.005,
      `${gain(1000, 45)} vs ${hi}`)
    check('低目标衰减', '行为：低 4 级仍是 1×（边界没写宽）', gain(1000, 46) === hi, `${gain(1000, 46)} vs ${hi}`)
    check('低目标衰减', '行为：拿不到等级（null）⇒ 1×（离线缺目标时不会误砍）', gain(1000, null) === hi, `${gain(1000, null)} vs ${hi}`)
    // 副业的参照系必须夹住：技能 120 时「能用的最高档」配方仍满经验
    const po = getSkillInstance('pottery')
    p.setSkillState('pottery', { level: 120, exp: totalXpForLevel(120), prestiges: 1 })
    check('低目标衰减', `行为：副业（顶档 ${po.topTargetLevel}）在技能 120 时顶档配方**不被罚**（参照系夹取生效，否则转生后全域减半）`,
      gain(1000, po.topTargetLevel, po) === gain(1000, po.topTargetLevel - 4, po) &&
      po.topTargetLevel > 0 && po.isLowTargetLevel(po.topTargetLevel) === false,
      `top=${po.topTargetLevel} isLow(top)=${po.isLowTargetLevel(po.topTargetLevel)}`)
    check('低目标衰减', '行为：同一技能里「低目标不再是经验/秒最优」（规则真的改变了取舍）',
      (() => {
        // 只比「经验 ÷ 间隔」的相对关系：低档减半后必须慢于顶档
        const list = fo.targets.filter((t) => t.reqLevel <= 50)
        const rate = (t) => (t.xpPerAction * (fo.isLowTargetLevel(t.reqLevel) ? LOW_TARGET_XP_MULT : 1)) / fo.intervalMs(t)
        const bestLow = Math.max(...list.filter((t) => fo.isLowTargetLevel(t.reqLevel)).map(rate))
        const bestHi = Math.max(...list.filter((t) => !fo.isLowTargetLevel(t.reqLevel)).map(rate))
        return bestHi > bestLow
      })())
    // 🔴 2026-09-30 修：参照系 = **玩家此刻能用的最高档**（不是表内最高档）。
    //    内容铺到 99 级以上之后两者不再相等（保鲜表内 120 / Lv99 能用 85；副业 120 / 91），
    //    拿表内最高档当参照会把「已经做到自己能做的最高档」误判成低目标而减半
    //    （实测保鲜 34.9h → 48.0h）。**枚举 9 个等级 × 全部带目标表的技能**逐条验：
    //      ① 参照档 == 表内「reqLevel ≤ 技能等级」的最大档（兜底表内最小档）；
    //      ② 那个档位**永不被罚**（与 LOW_TARGET_NOTE 的承诺一致）；
    //      ③ 但比它低 5 级及以上的**仍然**被罚（规则没被改哑）。
    {
      // ⚠️ 必须用**自己的玩家**：上面 `p0 = freshPlayer({ foraging: 50 })` 之后，`getAllSkillInstances()`
      //    返回的是 **p0 的**实例 —— 往 `p` 上设状态实例不会变（首版就栽在这，报了一串「参照 50≠…」）。
      const p2 = freshPlayer()
      const bad = []
      const LEVELS = [1, 5, 30, 50, 90, 99, 100, 110, 120]
      for (const inst of getAllSkillInstances()) {
        const list = inst.targets ?? inst.recipes ?? inst.crops ?? null
        if (!Array.isArray(list) || !list.length) continue
        const lvs = [...new Set(list.map((x) => Number(x.reqLevel)).filter((v) => Number.isFinite(v)))].sort((a, b) => a - b)
        if (!lvs.length) continue
        for (const lv of LEVELS) {
          p2.setSkillState(inst.id, { level: lv, exp: 0 })
          const top = inst.topUsableTargetLevel
          const expect = Math.max(...lvs.filter((x) => x <= lv).concat([lvs[0]]))
          if (top !== expect) bad.push(`${inst.id}@L${lv}: 参照 ${top}≠${expect}`)
          if (inst.isLowTargetLevel(top)) bad.push(`${inst.id}@L${lv}: 能用的最高档 ${top} 被判低目标`)
          const lower = lvs.filter((x) => x <= top - LOW_TARGET_GAP)
          if (lower.length && !inst.isLowTargetLevel(lower[lower.length - 1])) bad.push(`${inst.id}@L${lv}: 低档 ${lower[lower.length - 1]} 未被罚`)
        }
      }
      check('低目标衰减', `🔴 参照系 = 玩家**能用的最高档**（枚举 ${LEVELS.length} 个等级 × 全部带目标表的技能：档位正确 · 顶档永不被罚 · 低 5 级仍被罚）`,
        bad.length === 0, bad.slice(0, 6).join('; '))
    }
    // 🔴 行为（**结算侧 + 显示侧一起钉**）：内容铺到 99 级以上时，「玩家能用的最高档」在 Lv99 仍拿满经验。
    //    只钉 `isLowTargetLevel`（判定函数）抓不到「结算/显示路径改回表内最高档」——反例 ①/④ 当场证实。
    {
      const p3 = freshPlayer()
      const bad = []
      for (const id of ['preservation', 'pottery', 'weaving', 'woodworking']) {
        const inst = getSkillInstance(id)
        const list = inst.recipes ?? []
        const usable = Math.max(...list.filter((r) => r.reqLevel <= 99).map((r) => r.reqLevel))
        const rU = list.find((r) => r.reqLevel === usable)
        const gain = (lv, target) => { p3.setSkillState(id, { level: lv, exp: 0 }); return inst.addCardXp(1000, 1, target) }
        const full = gain(99, usable)            // 能用的最高档 ⇒ 必须满经验
        const lower = gain(99, usable - LOW_TARGET_GAP) // 比它低 5 级 ⇒ 必须减半
        if (!(full > 0 && Math.abs(full / lower - 2) < 0.02)) bad.push(`${id}: Lv99 做能用最高档(${usable}) 与低 5 级之比 ${lower > 0 ? (full / lower).toFixed(2) : '?'} ≠ 2`)
        // 显示侧（卡片上的「配方效率」）：同一等级下，把 `xpPerCraft` 约掉后剩下的就是低目标系数 ——
        // 「能用的最高档」必须是「最低档」的 2 倍（满经验 vs 减半）。
        // ⚠️ 别直接比两个等级的绝对值：`xpPerCraft` 本身随等级变（实测 Lv85→Lv99 有 +10%），
        //    那样会在**正确实现**上误报（首版就是这么假红了一次）。
        p3.setSkillState(id, { level: 99, exp: 0 })
        const rL = list.reduce((a, b) => ((b.reqLevel ?? 0) < (a.reqLevel ?? 0) ? b : a))
        const rate = (r) => inst.xpPerHour(r) / inst.xpPerCraft(r)
        const ratio = rate(rU) / rate(rL)
        if (!(Math.abs(ratio - 2) < 0.02)) bad.push(`${id}: 效率显示的「最高档 ÷ 最低档」= ${ratio.toFixed(3)} ≠ 2`)
      }
      check('低目标衰减', '🔴 行为：内容铺到 99 级以上时（保鲜 85 / 副业 91），「能用的最高档」在 Lv99 仍拿满经验 —— **结算与显示**都必须同源',
        bad.length === 0, bad.slice(0, 4).join('; '))
    }
    // 精通次数不受影响（规则只碰经验，不碰精通/池/里程碑）
    check('低目标衰减', '只减经验、不动精通：`addCardXp` 里不得出现 addMastery（精通次数仍由各动作 +1）',
      !/addMastery/.test(c54('game/skills/Skill.js')))
    void p
    void p0
  }

  // ── C. 接线（静态，**计数式**：漏一处就是「页面写着满经验、实际减半」）──
  {
    const files = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = new URL(`${e.name}${e.isDirectory() ? '/' : ''}`, dir)
        if (e.isDirectory()) { walk(p); continue }
        if (/\.(js|vue)$/.test(e.name)) files.push([e.name, p])
      }
    }
    walk(new URL('../../src/', import.meta.url))
    const calls = []
    // ⚠️ 参数个数必须**按括号深度**数：第 2 个参数自带括号（`masteryXpMultiplier(this.masteryLevel(t))`），
    //    用 `/addCardXp\(([^)]*)\)/` 这种正则会停在第一个 `)` ⇒ 3 个参数被数成 2 个（第一版就假 FAIL 了）。
    for (const [name, p] of files) {
      const src = stripComments(readFileSync(p, 'utf8'))
      for (const m of src.matchAll(/addCardXp\(/g)) {
        if (name === 'Skill.js') continue // 定义处
        let depth = 1
        let args = 1
        for (let i = m.index + m[0].length; i < src.length && depth > 0; i++) {
          const ch = src[i]
          if (ch === '(' || ch === '[' || ch === '{') depth++
          else if (ch === ')' || ch === ']' || ch === '}') depth--
          else if (ch === ',' && depth === 1) args++
        }
        calls.push({ name, args })
      }
    }
    check('低目标衰减', `接线：src 里 ${calls.length} 个 addCardXp 调用点**全部**传了目标等级（第 3 个参数）`,
      calls.length >= 13 && calls.every((c) => c.args >= 3),
      JSON.stringify(calls.filter((c) => c.args < 3)))
    check('低目标衰减', '离线同口径：bootstrap 的离线结算把实例当前目标的等级传进去（否则脱机练级不减半）',
      /inst\.addCardXp\(r\.exp, r\.xpMult \?\? 1, inst\.currentTarget\?\.reqLevel \?\? null\)/.test(c54('game/bootstrap.js')))
    check('低目标衰减', '战斗不参与（它已按伤害/敌人等级给）：Combat.js 不得出现 addCardXp',
      !/addCardXp/.test(c54('game/combat/Combat.js')))
    // 界面必须看得见（四条列表：采集/制作/探索/农耕），且判定一律走实例出口。
    // 🔴 **必须连 HTML 注释一起剥掉**：守卫第一版只 `stripComments`（管 JS 的 `//`、`/* */`），
    //    而 .vue 模板里的 `<!-- … 经验减半 … -->` 不在它的管辖内 ⇒ 删掉标签后仍为真 ⇒ **假绿**
    //    （反例验证 ⑦ 抓出来的，与 AGENTS「守卫被注释骗过」同源）。所以这里另剥 HTML 注释，
    //    并要求**标签元素本身**在（`.xp-low-chip` 且内容是 `LOW_TARGET_CHIP` 派生的紧凑标签）。
    // ⚠️ 2026-09-23 改位置：标签从**卡片头部**挪到**经验数值旁**（头部窄，徽章会整枚换行、
    //    把同排卡片行高顶得参差不齐 —— 用户截图报的「排版乱七八糟」）。这条断言同步改成认新元素。
    const stripHtml = (s) => s.replace(/<!--[\s\S]*?-->/g, '')
    for (const [rel, label] of [['views/GatheringView.vue', '采集'], ['views/ProductionView.vue', '制作'],
      ['views/ExplorationView.vue', '探索'], ['views/FarmingView.vue', '农耕']]) {
      const src = stripHtml(c54(rel))
      // 标签元素的内容里必须出现 `LOW_TARGET_CHIP`（农耕那页还带一句「低目标经验」前缀，故不写死整串）
      const chip = src.match(/<span[^>]*xp-low-chip[^>]*>[\s\S]*?<\/span>/g) ?? []
      check('低目标衰减', `界面：${label}页有「减半」紧凑标签（.xp-low-chip + LOW_TARGET_CHIP）且判定走 isLowTargetLevel`,
        src.includes('isLowTargetLevel') && chip.some((c) => c.includes('LOW_TARGET_CHIP')),
        chip.length ? chip.join(' | ').slice(0, 120) : '找不到 xp-low-chip 元素')
      // 🔴 标签**不许回到卡片头部**：头部那一格装不下（图片 + 名字），会整枚换行顶乱行高。
      // ⚠️ 这里的 `{0,N}` 上界必须**够大且「抓不到头部算 FAIL」**：第一版写 `{0,400}` 而采集页头部
      //    实测 ≈415 字符 ⇒ 正则失配 ⇒ `!head` 恒真 ⇒ **注入缺陷也照样绿**（反例验证 ⑩ 抓出来的，
      //    与 AGENTS「静默跳过 = 假绿」同源）。改成 1200 + 要求必须抓到。
      if (rel === 'views/FarmingView.vue') {
        // 农耕没有 .gather-card-head（它的列表是 .item-cell 小格）：那里要求标签**独占一行**
        // （格子只有 ~110px，塞进「N 经验」那行会把「90s 生长」挤成两行 —— 实测截图）
        check('低目标衰减', '界面：农耕页的减半标签独占一行（.item-cell-sub；格子太窄，塞进数值行会挤坏同行文字）',
          /<div v-if="isLow\(c\)" class="item-cell-sub"[\s\S]{0,200}?xp-low-chip/.test(src),
          '标签没挂在自己的 .item-cell-sub 行上')
        continue
      }
      // 🔴 标签**不许回到卡片头部**：头部那一格装不下（图片 + 名字），会整枚换行顶乱行高。
      // ⚠️ 判据从「正则切 1200 字符内的 `</div></div>`」改成**按结构切**（2026-09-28）：
      //    探索页把卡片头改成「名字 + 等级 + 右侧掉落条数」三个元素后，头部内部不再是
      //    `<div>…</div></div>` 的形状 ⇒ 旧正则失配。失配本身被记成 FAIL（这点是对的），
      //    但**判据不该依赖头部内部的元素个数** —— 现改为「从头部起点切到紧随其后的第一个兄弟块」。
      const hs = src.indexOf('class="gather-card-head"')
      const he = hs < 0 ? -1 : Math.max(src.indexOf('ex-body', hs), src.indexOf('gather-card-row', hs))
      const head = hs < 0 || he < 0 ? null : [src.slice(hs, he)]
      check('低目标衰减', `界面：${label}页的减半标签**不在卡片头部**（头部窄，会把行高顶乱）`,
        !!head && !/xp-low-chip|badge-warn/.test(head[0]),
        head ? head[0].slice(0, 160) : '没抓到卡片头部（结构变了 —— 这里不能当成通过）')
    }
    // 视图不许手写系数（写死的 0.5 会在调系数时静默与结算脱钩）。
    // 只扫 .vue（技能的 `recipe.xp * 0.5` 是**失败只给半额经验**，另一件事；`FAIL_XP_RATIO` 同理）。
    const hardcoded = []
    for (const [name, p] of files) {
      if (!name.endsWith('.vue')) continue
      const src = stripComments(readFileSync(p, 'utf8'))
      if (/xp[^;\n]*\*\s*0\.5\b/i.test(src)) hardcoded.push(name)
    }
    check('低目标衰减', '视图不许手写 0.5 当经验系数（一律读 LOW_TARGET_XP_MULT，否则调系数时会静默脱钩）',
      hardcoded.length === 0, hardcoded.join('、'))
    check('低目标衰减', '规则写进攻略（玩家能事先看到，不用等经验变少才发现）',
      /低 5 级|低 \$\{LOW_TARGET_GAP\} 级/.test(c54('game/data/guide.js')) && /经验 ×0\.5|经验减半/.test(c54('game/data/guide.js')))
    check('低目标衰减', '规则文案只有一个出口（LOW_TARGET_NOTE 在 growthRate.js，页面读它不手抄）',
      /export const LOW_TARGET_NOTE/.test(c54('game/core/growthRate.js')) &&
      ['views/GatheringView.vue', 'views/ProductionView.vue', 'views/ExplorationView.vue', 'views/FarmingView.vue']
        .every((f) => c54(f).includes('LOW_TARGET_NOTE')))
  }
}

// ══════════ C55：游客 / 试玩角色（2026-09-24，学校要求「三个以上权限角色」）══════════
// 角色矩阵：**游客 < 玩家 < 开发者**。游客 = 免建档试玩：不占存档位、**对本机零写入**、无导出、
// 无开发者面板。写入口的闸门放在 `SaveManager.readOnly`（唯一出口），因为写路径有 6 个 ——
// 散在各处判断必然漏一个（本项目「唯一出口」纪律）。
{
  const { readFileSync } = await import('node:fs')
  const c55 = (rel) => stripComments(readFileSync(new URL(`../../src/${rel}`, import.meta.url), 'utf8'))
  const smSrc = c55('game/core/SaveManager.js')
  const boot = c55('game/bootstrap.js')

  // ── A. 唯一出口：闸门在 SaveManager，写入口全部过它 ──
  check('游客角色', 'SaveManager 有只读闸门（readOnly + _writable 单一判据）',
    /this\.readOnly\s*=\s*false/.test(smSrc) && /_writable\(\)\s*\{[\s\S]{0,90}return\s+!this\.readOnly/.test(smSrc))
  check('游客角色', '🔴 写入口全部过闸门：saveSlot / clearSlot / restoreSnapshot / exportToFile / _snapshotBefore（save 与 clear 走前两者）',
    ['saveSlot(', 'clearSlot(', 'restoreSnapshot(', 'exportToFile(', '_snapshotBefore(']
      .every((fn) => {
        const i = smSrc.indexOf(`  ${fn}`)
        return i >= 0 && smSrc.slice(i, i + 300).includes('_writable()')
      }))
  check('游客角色', '闸门只挡写、不挡读（load / listSlots / listSnapshots 不带闸门 —— 游客是「读了也不写」）',
    !/  loadSlot\(slot\)\s*\{[\s\S]{0,80}_writable/.test(smSrc) && !/  listSlots\(\)\s*\{[\s\S]{0,80}_writable/.test(smSrc))

  // ── B. 启动流程：进游客置位、回普通会话复位 ──
  check('游客角色', 'startGame 支持 guest 且**两态都置位**（进游客打开只读、回普通会话必须关掉，否则残留）',
    /saveManager\.readOnly\s*=\s*guest/.test(boot) && /ui\.guest\s*=\s*guest/.test(boot))
  check('游客角色', '游客走空白档起步（不读任何存档位）',
    /if \(guest\) \{[\s\S]{0,220}player\.\$reset\(\)[\s\S]{0,120}player\.newGame\(\)/.test(boot))
  check('游客角色', 'saveNow 有只读短路（自动存档 / 切后台 / 关页同一条路径）',
    /if \(saveManager\.readOnly\) return/.test(boot))
  check('游客角色', '对外暴露 isGuestSession()（UI 与守卫都读它，不各自判断 readOnly）',
    /export function isGuestSession\(\)/.test(boot) && /return saveManager\.readOnly === true/.test(boot))

  // ── C. 全局偏好键与埋点：最容易漏出去的两条写路径 ──
  const app = c55('App.vue')
  // 写法是 `if (v && !ui.guest) localStorage.setItem(THEME_KEY, v)` —— 判据在 setItem **之前**，
  // 所以断言要抓「整行」，不能写成 `setItem(KEY...)` 之后再找 `!`（第一版就是这么写错的）。
  // 2026-09-25 补 BGM_KEY（启动页 BGM 的开关偏好，同属「这台机器的正式玩家」的偏好）：
  // 🔴 这个键**多一个坑**——它的 watcher 还必须判 `ui.phase === 'game'`，因为启动页阶段 settings 是默认值
  //    （bgmEnabled 默认 false），不加就会每次打开启动页都写下 '0'（既污染偏好又违反「启动页零写入」）。
  const globalPrefWrites = app.match(/[^\n]*localStorage\.setItem\((THEME_KEY|SKIN_KEY|BGM_KEY)[^\n]*/g) || []
  check('游客角色', '🔴 主题 / 皮肤 / 启动页 BGM 三个全局偏好键都不再写（进游戏时这些 watcher 一定会触发一次）',
    globalPrefWrites.length === 3 && globalPrefWrites.every((l) => l.includes('!ui.guest')),
    globalPrefWrites.map((l) => l.trim().slice(0, 90)).join(' ｜ ') || '一个都没抓到（等于三处都不判游客）')
  const bgmWrite = (app.match(/[^\n]*localStorage\.setItem\(BGM_KEY[^\n]*/) ?? [''])[0]
  check('游客角色', '启动页 BGM 的偏好键只在游戏阶段写（否则启动页每开一次就写一个 0）',
    bgmWrite.includes("ui.phase === 'game'") && bgmWrite.includes('!ui.guest'),
    bgmWrite.trim().slice(0, 110) || '没抓到 BGM_KEY 的写入行')
  check('游客角色', '埋点（开发构建）在游客会话下不落盘', /if \(isGuest\(\)\) return/.test(c55('game/dev/telemetry.js')))

  // ── D. 界面三处接线：入口 / 徽章 / 面板禁用 ──
  const splash = c55('components/SplashScreen.vue')
  check('游客角色', '启动页有「免建档试玩」入口且走 startGame({ guest: true })',
    /splash-guest-btn/.test(splash) && /startGame\(\{ guest: true \}\)/.test(splash))
  check('游客角色', '顶栏有「试玩中」徽章（玩家随时知道自己处于哪个角色）',
    /top-nav-guest/.test(app) && /top-nav-guest/.test(c55('styles/main.css')))
  const savePanel = c55('components/SavePanel.vue')
  // 🔴 断言必须**逐个按钮**检查，不能数「出现次数 ≥ N」：第一版写 `>= 6`（实际 7 处），
  //    于是删掉任意一处（反例 ⑥）仍然通过 —— 典型的「断言太弱 = 假绿」。现在抓出存档面板里
  //    每一个 `<button>` 标签，要求**全部**带 `:disabled="ui.guest"`。
  // ⚠️ 锚点是**类名**：2026-09-25 存档面板排版重做（`.slot-grid` → `.sv-list`）时这条断言立刻 FAIL
  //    （抓到 0 个按钮）—— 这正是 `>= 6` 那条下限在起作用，别把它删掉。以后重做该面板记得回来改锚点。
  // 取值区间到 `.sv-foot`（面板底部那行「当前会话」）为止，不再依赖结尾缩进。
  const slotGrid = (savePanel.match(/<div class="sv-list">[\s\S]*?<p class="sv-foot">/) ?? [''])[0]
  const gridBtns = slotGrid.match(/<button[\s\S]*?>/g) ?? []
  check('游客角色', '存档面板：横幅 + 面板里**每一个**写按钮都 disabled（不做静默失效）',
    /guest-notice/.test(savePanel) && gridBtns.length >= 6 && gridBtns.every((b) => b.includes(':disabled="ui.guest"')),
    `抓到 ${gridBtns.length} 个按钮，缺 disabled 的：${gridBtns.filter((b) => !b.includes(':disabled="ui.guest"')).map((b) => b.slice(0, 50)).join(' ｜ ') || '（无）'}`)
  check('游客角色', '开发者面板在游客会话下被拒（统一入口 requestDevEntry 一处判断）',
    /if \(ui\.guest\)/.test(c55('game/dev/devFlag.js')))

  // ── E. 行为断言：真实 SaveManager + localStorage 桩 ──
  {
    const { SaveManager } = await import('../../src/game/core/SaveManager.js')
    const store = new Map()
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      get length() { return store.size },
      key: (i) => [...store.keys()][i] ?? null,
    }
    const sm = new SaveManager({ slot: 0 })
    const dump = { schemaVersion: 1, savedAt: 1, player: { gold: 7 } }
    const fingerprint = () => [...store.keys()].sort().join('|') + '#' + store.size

    sm.readOnly = false
    sm.saveSlot(1, dump)              // 先造一份既有存档（用来验「读得到」与「不会被游客清掉」）
    const withData = fingerprint()
    sm.readOnly = true

    sm.save(dump)
    sm.saveSlot(0, dump)
    sm.saveSlot(1, dump)
    sm.clear()
    sm.clearSlot(1)
    sm.restoreSnapshot(1, 0)
    const exported = sm.exportToFile(dump)
    check('游客角色', '行为：只读下写入口全不生效（存档/快照/清档/回滚一字未动）',
      fingerprint() === withData && exported === false, `${withData} → ${fingerprint()}`)
    check('游客角色', '行为：只读下仍能读档（游客能进游戏，只是不落盘）', sm.loadSlot(1)?.player?.gold === 7)
    check('游客角色', '行为：只读下 clear() 也不会删掉既有档（游客不能间接破坏他人进度）',
      store.has(sm.keyFor(1)))
    // 🔴 反例对照：同一个桩、同一族调用，只读关掉后必须**真的写进去** —— 否则上面那条是恒真的假绿
    sm.readOnly = false
    sm.saveSlot(2, dump)
    check('游客角色', '行为（对照）：只读关掉后同样的调用会写 ⇒ 上面的断言不是恒真',
      store.has(sm.keyFor(2)))
    delete globalThis.localStorage
  }
}

// ══════════ C62：奥义等级门槛 + 副业线奥义（2026-09-27 用户⑧）══════════
// 用户：「美食奥义或许要加入某技能等级要求才能解锁呢？还有美食奥义是否需要扩充？」
// 答复＝两条都做：门槛走**规则模块**（不往冻结条目上加字段）、扩充走**手写扩展模块**（不动生成器产物）。
{
  const { AOJIS } = await import('../../src/game/data/aojis.js')
  const { AOJI_GATE, aojiGateLevel, aojiUnlockedAt, aojiGateText } = await import('../../src/game/data/aojiGates.js')
  const BOOT = ['sharpBlade', 'ironWall', 'harvestBlessing', 'swiftStep', 'ironStomach', 'feastMaster', 'oceanKnowledge', 'godPower', 'harvestMaster', 'combatScholar', 'tasteGuard', 'swiftProwess']
  check('奥义门槛', '扩充后可玩性数据齐备：42 条（32 原有 + 10 副业线），id 唯一',
    AOJIS.length === 42 && new Set(AOJIS.map((a) => a.id)).size === 42, `n=${AOJIS.length}`)
  check('奥义门槛', '每条奥义都有门槛（入门 12 条 = Lv1 不设门槛，其余 ≥ Lv8）',
    AOJIS.every((a) => BOOT.includes(a.id) ? aojiGateLevel(a.id) === 1 : aojiGateLevel(a.id) >= 8) && Object.keys(AOJI_GATE).length === 30,
    `表内 ${Object.keys(AOJI_GATE).length} 条`)
  check('奥义门槛', '门槛随强度递增（同批次内 cost 越大要求越高，且不超过等级上限 120）',
    Math.max(...AOJIS.map((a) => aojiGateLevel(a.id))) <= 120 && AOJIS.filter((a) => a.id.startsWith('aoji2_')).every((a) => aojiGateLevel(a.id) >= 45))
  // 行为：唯一生效点 toggleAoji
  {
    const gp = freshPlayer()
    createSkillInstances(gp)
    const setGas = (lv) => gp.setSkillState('gastronomy', { level: lv, exp: totalXpForLevel(lv) })
    setGas(1)
    const r1 = gp.toggleAoji('aoji2_berserk2')
    check('奥义门槛', '行为：等级不足时 `toggleAoji` 返回**原因字符串**且不入激活表', typeof r1 === 'string' && /需美食知识 Lv81/.test(r1) && gp.gastronomy.active.length === 0, String(r1))
    setGas(81)
    check('奥义门槛', '行为：等级达标后同一条可正常开启', gp.toggleAoji('aoji2_berserk2') === true && gp.gastronomy.active.includes('aoji2_berserk2'))
    check('奥义门槛', '行为：入门 12 条 Lv1 就能开（教程组不受门槛影响）', gp.toggleAoji('godPower') === true)
    // 门槛**只挡开启**；直接写入的非法项由 drainAoji 收走（转生掉级的场景）
    gp.gastronomy.active = ['aoji2_berserk2']
    setGas(1)
    gp.tastePoints = 9999
    gp.drainAoji(1000)
    check('奥义门槛', '行为：等级掉回去（转生）后，场上的不达标奥义被 `drainAoji` 收走',
      gp.gastronomy.active.length === 0, `剩 ${gp.gastronomy.active.join(',') || '无'}`)
  }
  // 副业线：分类、效果键、轴合法性、真进轴
  {
    const { SIDELINE_AXES } = await import('../../src/game/data/sidelineWorks.js')
    const side = AOJIS.filter((a) => a.category === '副业')
    check('奥义门槛', '副业线 10 条：分类「副业」且效果只有 `sideline`（因此不会触发 C61 的「攻击/防御 ⟺ 战斗效果」断言）',
      side.length === 10 && side.every((a) => Object.keys(a.effect).length === 1 && a.effect.sideline), `n=${side.length}`)
    const badAxis = side.flatMap((a) => Object.keys(a.effect.sideline).filter((k) => !SIDELINE_AXES[k]))
    check('奥义门槛', `副业线用的轴 id 全部在 SIDELINE_AXES 里（${Object.keys(SIDELINE_AXES).length} 条轴）`, badAxis.length === 0, badAxis.join(','))
    // 🔴 「轴在表里」≠「有人读它」（2026-09-27 实测踩过）：`decorPct` / `nightMult` 原先的消费方读的是
    //    `sidelineLadderTotal`（只有阶梯那一段），奥义接进合计出口也照样是**买了没效果**。
    //    这条断言因此要求：每条被奥义使用的轴，在**引擎侧**真的有一处以字面量取出它
    //    （显示层 activeEffects.js 不算——那里只是把数读出来给玩家看）。
    {
      const skillSrc = fs.readdirSync(new URL('../../src/game/skills/', import.meta.url))
        .filter((f) => f.endsWith('.js'))
        .map((f) => stripComments(fs.readFileSync(new URL(`../../src/game/skills/${f}`, import.meta.url), 'utf8')))
      const coreSrc = fs.readdirSync(new URL('../../src/game/core/', import.meta.url))
        .filter((f) => f.endsWith('.js'))
        .map((f) => stripComments(fs.readFileSync(new URL(`../../src/game/core/${f}`, import.meta.url), 'utf8')))
      const allSrc = [rdSrc('src/stores/player.js'), ...skillSrc, ...coreSrc].join('\n')
      const unread = [...new Set(side.flatMap((a) => Object.keys(a.effect.sideline)))]
        .filter((k) => !new RegExp(`sidelineEffectTotal\\??\\.?\\(\\s*'${k}'`).test(allSrc))
      check('奥义门槛', '每条副业线奥义用的轴，引擎侧都有一处字面量读取（否则奥义是「买了没效果」的静默失效）',
        unread.length === 0, unread.join(','))
      const eff = rdSrc('src/game/data/activeEffects.js')
      check('奥义门槛', '效果总览的副业行按三段（作品/阶梯/奥义）展示，不再用「合计 − 阶梯」倒推作品',
        /sidelineSegs/.test(eff) && !/sidelineLadderTotal/.test(eff))
    }
    // 行为：开/关各一次，轴数值必须跟着动（显示与结算同源）
    const sp = freshPlayer()
    createSkillInstances(sp)
    sp.setSkillState('gastronomy', { level: 60, exp: totalXpForLevel(60) })
    const before = sp.sidelineEffectTotal('decorPct')
    sp.toggleAoji('aojiSideline_woodcraft')
    const mid = sp.sidelineEffectTotal('decorPct')
    sp.toggleAoji('aojiSideline_woodcraft')
    check('奥义门槛', '行为：副业线奥义真的进 `sidelineEffectTotal` 那条轴（开 +6 / 关回原值）',
      mid === before + 6 && sp.sidelineEffectTotal('decorPct') === before, `${before} → ${mid} → ${sp.sidelineEffectTotal('decorPct')}`)
    const { EFFECT_ROWS } = await import('../../src/game/data/activeEffects.js')
    check('奥义门槛', '效果总览已登记副业线那一行（否则玩家为它付品鉴点却看不到效果）',
      EFFECT_ROWS.some((r) => r.id === 'aojiSideline'))
  }
  // 展示面接线（门槛要看得见，才不是「点了没反应」）
  const gast = rdSrc('src/views/GastronomyView.vue')
  const cpanel = rdSrc('src/components/CombatPanel.vue')
  check('奥义门槛', '两处界面都展示门槛并置灰（美食知识页卡片 / 对决页奥义栏），且都走同一个出口',
    /aojiGateText|gateText/.test(gast) && /lockedGate/.test(gast) && /:disabled="lockedGate/.test(gast) &&
      /aojiUnlockedAt/.test(cpanel) && /lockedAoji/.test(cpanel) && /aojiGateText/.test(cpanel))
  check('奥义门槛', '美食知识页的分类页签含新分类「副业」（否则新分类只在「全部」里可见）',
    /'副业'/.test(gast))
  check('奥义门槛', '门槛文案是单一出口（`aojiGateText`），页面不手写「需美食知识 Lv」',
    !/需美食知识 Lv/.test(gast.replace(/aojiGateLevel/g, '')) || /aojiGateText/.test(gast))
  // 规则说明也走单一出口 + 攻略同步（否则玩家只看到一排灰掉的卡片，不知道门槛是什么）
  const { AOJI_GATE_NOTE } = await import('../../src/game/data/aojiGates.js')
  check('奥义门槛', '规则说明是常数出口 `AOJI_GATE_NOTE`（数字从门槛表派生，不手抄）',
    typeof AOJI_GATE_NOTE === 'string' && /Lv8~44/.test(AOJI_GATE_NOTE) && /副业线/.test(AOJI_GATE_NOTE))
  check('奥义门槛', '美食知识页常驻一行规则（否则玩家看到灰卡片却不知道原因）',
    /AOJI_GATE_NOTE/.test(gast))
  const guideSrc = rdSrc('src/game/data/guide.js')
  check('奥义门槛', '攻略写明门槛规则（玩家能事先看到，不用撞上才发现）',
    /按批次设解锁门槛/.test(guideSrc) && /副业线 Lv8~44/.test(guideSrc))
}

// ══════════ C63：挂机计划搬进底栏（2026-09-27 用户⑩）+ 计划收工按步骤停（用户⑨）══════════
{
  const plan = rdSrc('src/components/PlanPanel.vue')
  const dock = rdSrc('src/components/BottomDock.vue')
  const skillView = rdSrc('src/views/SkillView.vue')
  check('挂机计划', '计划面板独立成组件并挂在底栏（技能页不再有它）',
    /PLAN_SKILLS/.test(plan) && /PlanPanel/.test(dock) && !/plan-card/.test(skillView))
  check('挂机计划', '底栏胶囊含「计划」分区（6 个胶囊：挂机/计划/食灵/奥义/状态/日志）',
    /id: 'plan'/.test(dock) && /dockSection === 'plan'/.test(dock))
  // 行为：计划跑完**按步骤里出现过的技能**停（原先写死 ['gathering','exploration']，漏了 farming）
  {
    const pp = freshPlayer()
    createSkillInstances(pp)
    pp.planClear()
    pp.planAddStep('foraging', pp.getSkillTarget('foraging') ?? 'apple', 'level', 2)
    pp.planAddStep('farming', 'wheat', 'level', 2)
    pp.planToggle()
    pp.setSkillState('foraging', { level: 3, exp: totalXpForLevel(3) })
    pp._tickPlan() // 第 1 步达标 → 进入第 2 步
    pp.setSkillState('farming', { level: 3, exp: totalXpForLevel(3) })
    pp._tickPlan() // 第 2 步达标 → 计划完成
    check('挂机计划', '行为：计划全部完成后，**计划里出现过的技能**都被暂停（农耕也在内）',
      pp.isSkillPaused('farming') === true && pp.isSkillPaused('foraging') === true,
      `foraging=${pp.isSkillPaused('foraging')} farming=${pp.isSkillPaused('farming')}`)
    check('挂机计划', '行为：计划里没出现过的技能不受影响（不是一刀切全停）',
      pp.isSkillPaused('fishing') === false, `fishing=${pp.isSkillPaused('fishing')}`)
  }
}

// ══════════ C64：左栏「大类按钮」+ 主区「左导航 / 右内容」工作区（2026-09-27 用户⑳ 两轮）══════════
// 第一轮做的是「点大类 → 右侧**浮层**列页面」；用户第二轮改口为
// 「点击大类后，右边面板的**左边**显示导航、**右边**显示详细内容」（形态照开发者面板）⇒ 浮层整层撤掉。
{
  const side = rdSrc('src/components/Sidebar.vue')
  const app = rdSrc('src/App.vue')
  const rail = rdSrc('src/components/FeatureRail.vue')
  const css = rdSrc('src/styles/main.css')
  check('主导航', '左上栏只留「大类按钮」这一层入口（`.feature-cat`），页面清单不再由它渲染',
    /class="feature-cat"/.test(side) && !/feature-flyout/.test(side) && !/\.ff-item/.test(side))
  check('主导航', '🔴 浮层那套已彻底移除（否则「浮层」与「主区导航」两套机制并存 = 同一件事两个入口）',
    !/feature-flyout/.test(css) && !/ff-catcher/.test(css) && !/Teleport to="body"/.test(side) && !/flyoutStyle/.test(side))
  check('主导航', '主区是「左导航 + 右内容」两栏：`.main-scroll--rail` + `FeatureRail` 挂在分派链之前',
    // ⚠️ 判据要**连绑定一起钉**：只查 `main-scroll--rail` 这个词的话，把键改名成 `main-scroll--rail-x`
    //    照样命中（反例验证 ② 抓到的假绿 —— 子串匹配骗过了它），改造型就等于没人守
    /'main-scroll--rail':\s*catRailOn/.test(app) && /<FeatureRail v-if="catRailOn"/.test(app) &&
      app.indexOf('<FeatureRail') < app.indexOf("<ShopView v-if=\"ui.activeView === 'shop'\""))
  check('主导航', '导航栏按**当前大类**过滤、点条目走 `ui.setView`（不是自己渲染内容 —— 内容仍归 App.vue 的分派链）',
    /ui\.featureCat/.test(rail) && /function pick\(it\)[\s\S]{0,120}ui\.setView\(it\.view\)/.test(rail) &&
      !/<ShopView|<InventoryView|v-else-if/.test(rail))
  check('主导航', '换到不属于本大类的页面时自动收起（判据是同一个 `groupForView`，与左栏同源）',
    /groupForView\(railGroups, v\)\?\.id !== ui\.featureCat/.test(app) && /ui\.closeFeatureCat\(\)/.test(app))
  check('主导航', '窄屏保留「手风琴 + 磁贴」回退，且两种形态由同一条 940px 断点分开',
    /isNarrow/.test(side) && /class="feature-group-label"/.test(side) && /class="feature-tile"/.test(side) &&
      /max-width: 940px/.test(side) && /max-width: 940px/.test(app) &&
      /matchMedia\('\(max-width: 940px\)'\)/.test(side) && /matchMedia\('\(max-width: 940px\)'\)/.test(app))
  check('主导航', '山海食经（整屏画布页）不挂导航栏，且这条规则**只有一个来源**（`RAIL_HIDDEN_VIEWS`）',
    /RAIL_HIDDEN_VIEWS\.includes\(ui\.activeView\)/.test(app) && /export const RAIL_HIDDEN_VIEWS = \['shanhai'\]/.test(rdSrc('src/stores/ui.js')) &&
      /RAIL_HIDDEN_VIEWS/.test(side))
  check('主导航', '导航栏宽度是单一来源（`--rail-w` / `--rail-w-mini` 两个 token，组件用 var() 读）',
    /--rail-w:\s*168px/.test(css) && /--rail-w-mini:\s*46px/.test(css) &&
      /var\(--rail-w/.test(rail) && /var\(--rail-w-mini/.test(rail))
  // 折成「仅图标」（2026-09-27 用户：「页面清单增加可折叠为仅图标的按钮」）
  check('主导航', '导航栏有「折叠为仅图标」按钮，且折叠态：名字藏起来、宽度走 `--rail-w-mini`',
    /class="fr-btn fr-fold"/.test(rail) && /iconsOnly = !iconsOnly/.test(rail) &&
      /'feature-rail--mini': iconsOnly/.test(rail) &&
      /\.feature-rail--mini \.fr-name[^{]*\{\s*display:\s*none/.test(rail))
  check('主导航', '折叠偏好进存档（`settings.railIcons`，旧档缺键走默认 false）',
    /railIcons: false/.test(rdSrc('src/stores/player.js')) && /settings\?\.railIcons/.test(rail))
  check('主导航', '🔴 左栏按钮的开关语义读「界面真值」`railShown`（只看 featureCat 会在「状态还在、界面没显示」时变成关掉）',
    /ui\.featureCat === g\.id && ui\.railShown/.test(side) && /setRailShown/.test(app) && /railShown: false/.test(rdSrc('src/stores/ui.js')))
  check('主导航', '落地页要挑**挂得住导航**的页（否则在山海食经上点大类会「毫无变化」）',
    /landable/.test(side) && /RAIL_HIDDEN_VIEWS\.includes\(it\.view\)/.test(side))
  check('主导航', '内容列 `min-width: 0`（否则宽表会把两栏一起撑破）',
    /\.main-scroll--rail > :not\(\.feature-rail\)\s*\{[^}]*min-width:\s*0/.test(css))
  // 行为：store 上的开关语义（点第二次收起由 Sidebar 的 toggleCat 负责）
  {
    useUiStore()
    const u = useUiStore()
    u.closeFeatureCat()
    check('主导航', '行为：store 默认收起 → `openFeatureCat(id)` 打开 → `closeFeatureCat()` 收起',
      u.featureCat === null && (u.openFeatureCat('idle'), u.featureCat === 'idle') && (u.closeFeatureCat(), u.featureCat === null))
    const { featureGroups: fg, groupForView } = await import('../../src/game/data/featureGroups.js')
    const groups = fg(null)
    check('主导航', '行为：`groupForView` 能把每个功能页反查回它的大类（导航栏「收起」判据靠它）',
      groups.every((g) => g.items.every((it) => groupForView(groups, it.view)?.id === g.id)) &&
        groupForView(groups, 'skill') === null && groupForView(groups, 'inventory') === null)
  }
}

// ══════════ C65：觅珍「模拟预览」按钮的配色（2026-09-27 用户报「混进了红色」）══════════
// 用户看到的：材料池上面是**青绿**大按钮，底下却挂着一排**红褐**小按钮 —— 因为那排按钮用的是
// 品牌主色（`--primary-strong → --primary-deep`，经典皮肤是红褐），与「池主题」两个色系。
// 现在的口径：模拟按钮**跟池主题走**（`--tlo*`），且按实测取「深档 + 白字」（唯一在五池都 ≥4.5:1 的组合）。
// 这条守卫把两件事一起钉住：① 不许再回到品牌色/写死色值；② 对比度必须真的达标（**拿池卡自己的 token 现算**，
// 不需要浏览器 —— 同 C58 的做法）。
{
  const mij = rdSrc('src/views/MijianView.vue')
  const simRule = mij.slice(mij.indexOf('.gacha-sim .sim-btn {'), mij.indexOf('}', mij.indexOf('.gacha-sim .sim-btn {')))
  check('觅珍配色', '模拟按钮的底色走**池主题**（`--tlo*`），不再用品牌主色、也不再写死色值',
    /background-color:\s*var\(--tlo2/.test(simRule) && /background-image:[^;]*var\(--tlo1/.test(simRule) &&
      !/--primary/.test(simRule) && !/#[0-9a-fA-F]{6}/.test(simRule.replace(/var\([^)]*\)/g, '')))
  check('觅珍配色', '模拟按钮的流光云团也跟池主题（`--sh1/2/d` 读 `--tsh*`）',
    /--sh1:\s*var\(--tsh1/.test(simRule) && /--sh2:\s*var\(--tsh2/.test(simRule) && /--shd:\s*var\(--tshd/.test(simRule))
  // 对比度：白字压「深档渐变」的最坏端 —— 五池都必须 ≥4.5:1（13px 粗体算正文，不是大字号）
  {
    const hex = (h) => { const t = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(t.slice(i, i + 2), 16)) }
    const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
    const pools = []
    for (const m of mij.matchAll(/\.pool-(\w+)\s*\{([\s\S]*?)\}/g)) {
      const g = (k) => (m[2].match(new RegExp(`--${k}:\\s*(#[0-9a-fA-F]{6})`)) ?? [])[1]
      if (g('tlo1') && g('tlo2')) pools.push({ id: m[1], lo1: g('tlo1'), lo2: g('tlo2') })
    }
    const bad = pools
      .map((p) => ({ id: p.id, r: Math.min(ratio(hex(p.lo1), hex('#ffffff')), ratio(hex(p.lo2), hex('#ffffff'))) }))
      .filter((x) => x.r < 4.5)
    check('觅珍配色', `模拟按钮「深档 + 白字」在全部 ${pools.length} 个池都 ≥4.5:1（13px 粗算正文）`,
      pools.length >= 5 && bad.length === 0, bad.map((x) => `${x.id} ${x.r.toFixed(2)}`).join(', '))
  }
}

// ══════════ C66：新增制作内容必须进「被 import 的那张表」（2026-09-27 用户问「检查数据同步」）══════════
// 起因：⑬ 加的 3 条腌制品只并进了**技能实例的入参**（`super(..., [...PRESERVING_RECIPES, ...PICKLE_RECIPES])`），
// 而 `itemSources` / `valueBalance` / `itemBalance` / `recipeBalance` 都是直接 import `PRESERVING_RECIPES` 的
// ⇒ 图鉴不写「腌制制作」来源、产物价值停在占位值、也不参与材料等级校验。
// 顺着这条线还查出一处**既有**缺陷：图鉴来源串用的是**表内原始等级**，而配方卡用 `raiseRecipeLevels` 后的
// **生效等级** —— 68 条对不上（腊肉炒饭：图鉴 Lv22 vs 卡片 Lv25；松露面包 70 vs 75）。
// 这两条都由下面第一条断言兜住：**每条配方产物在来源串里都能找到「同技能 + 同等级」的那一条**。
{
  const { itemSources } = await import('../../src/game/data/itemSources.js')
  const { PRESERVING_RECIPES } = await import('../../src/game/skills/PreservingSkill.js')
  const NAME = { cooking: '烹饪制作', baking: '烘焙制作', preserving: '腌制制作', brewing: '调酒制作', spiceMixing: '调料调配', craftsmithing: '厨具锻造', preservation: '食材保鲜制作' }
  const miss = []
  const wrong = []
  let total = 0
  for (const inst of getAllSkillInstances()) {
    if (!inst.recipes?.length || !NAME[inst.id]) continue
    for (const r of inst.recipes) {
      const out = r.output?.itemId
      if (!out) continue
      total++
      const pool = (itemSources(out) ?? []).filter((x) => x.startsWith(NAME[inst.id]))
      if (!pool.length) { miss.push(`${inst.id}/${r.name}`); continue }
      if (!pool.some((x) => Number(x.match(/Lv(\d+)/)?.[1]) === r.reqLevel)) wrong.push(`${inst.id}/${r.name} 卡片 Lv${r.reqLevel} → ${pool.join('|')}`)
    }
  }
  check('数据同步', `每条配方产物都在图鉴来源串里有「同技能 + 同等级」的那一条（核对 ${total} 条）`,
    total > 1000 && miss.length === 0, `缺来源：${miss.slice(0, 5).join(', ')}`)
  check('数据同步', '图鉴来源串的等级 == 配方卡的**生效**等级（原先用表内原始等级，68 条对不上）',
    wrong.length === 0, wrong.slice(0, 5).join('; '))
  // 新增的 3 条必须在**表本身**里（只在技能实例里 = 上面各种消费方都看不到）
  check('数据同步', '新增腌制品并进了 `PRESERVING_RECIPES` 本身（不是只并进技能实例的入参）',
    ['pickledMushroom', 'pickledLotusRoot', 'driedFungus'].every((id) => PRESERVING_RECIPES.some((r) => r.id === id)))
  // 表内等级 == 生效等级（写低了 raiseRecipeLevels 会悄悄抬，两处各说一个数）
  {
    const pres = getAllSkillInstances().find((i) => i.id === 'preserving')
    const drift = PRESERVING_RECIPES.filter((r) => pres.recipes.find((x) => x.id === r.id)?.reqLevel !== r.reqLevel)
    check('数据同步', '保鲜表里的 `reqLevel` 就是生效等级（写低了会被 `raiseRecipeLevels` 抬走，图鉴与卡片会不一致）',
      drift.length === 0, drift.map((r) => `${r.name} ${r.reqLevel}→${pres.recipes.find((x) => x.id === r.id)?.reqLevel}`).join(', '))
  }
}

// ══════════ C67：美食探索改版（2026-09-27 用户①②③④⑤⑥ 一轮六条）══════════
// 用户口径：卡片展示与其它技能一致 · 接精通档位与精通池 · 每卡独立成功率（上限 90%）·
//   全面调低物品概率 · 初始成功率随等级段递减到 0%（靠精通提高）· 两套专属装备（合计 +5%/+10%，掉率 0.01%）。
// 🔴 冻结数据（200 个目标 / baseSuccess / 掉落表）一个字节没动 —— 下面第一条就是钉这件事。
{
  const { EXPLORATION_TARGETS_ALL } = await import('../../src/game/data/explorationTargets.js')
  const EB = await import('../../src/game/data/explorationBalance.js')
  const EG = await import('../../src/game/data/explorationGear.js')
  const { exploreSuccessChance: diffExplore, exploreLootChance } = await import('../../src/game/data/difficulty.js')
  const { masteryPoolBonus, countForMasteryLevel, masteryIntervalFactor } = await import('../../src/game/core/mastery.js')

  // ① 冻结基线（铁律）：条数、baseSuccess 区间与合计、掉落条数
  // 🔴 2026-09-29：探索目标表现由「生成器 200 条（冻结）」+「手写扩展 10 条（Lv102~120）」组成。
  //    「冻结数据未改」这条判据因此钉在**生成器那 200 条**上（按 id 前缀分组），扩展单独断言 ——
  //    否则加了扩展这条会一直红，而它要守的是「生成器产物没被动过」。
  const GEN = EXPLORATION_TARGETS_ALL.filter((t) => !String(t.id).startsWith('explore_late_'))
  const LATE = EXPLORATION_TARGETS_ALL.filter((t) => String(t.id).startsWith('explore_late_'))
  const bs = GEN.map((t) => t.baseSuccess)
  const loot = GEN.flatMap((t) => t.loot ?? [])
  check('探索改版', '冻结数据未改：生成器 200 个目标 · baseSuccess 0.60~0.85（合计 144.74）· 掉落 700 条',
    GEN.length === 200 && Math.min(...bs) >= 0.6 && Math.max(...bs) <= 0.85 &&
      Math.abs(bs.reduce((a, c) => a + c, 0) - 144.74) < 0.005 && loot.length === 700)

  // ② 段位曲线：段 1 ×1.00、逐段单调不增、段 10 = 0
  const factors = [1, 2, 3, 5, 7, 10].map((b) => EB.exploreBandFactor((b - 1) * 10 + 1))
  check('探索改版', '初始成功率系数：段 1 ×1.00 → 段 10 ×0.00（单调不增，末段归零）',
    Math.abs(factors[0] - 1) < 1e-9 && Math.abs(factors[factors.length - 1]) < 1e-9 &&
      factors.every((v, i) => i === 0 || v <= factors[i - 1] + 1e-9))
  check('探索改版', '段号按 reqLevel 每 10 级一段（1~100 → 段 1~10）',
    EB.exploreBandOf(1) === 1 && EB.exploreBandOf(10) === 1 && EB.exploreBandOf(11) === 2 && EB.exploreBandOf(99) === 10)

  // ③ 上限 90%（不含装备）+ 装备补足剩下的 10%（总不超 100%）
  {
    const t = { baseSuccess: 0.85, reqLevel: 1 }
    const maxed = EB.exploreSuccessChance(t, { masteryLevel: 100, poolSuccessPP: 5, gearPP: 0 })
    const withGear = EB.exploreSuccessChance(t, { masteryLevel: 100, poolSuccessPP: 5, gearPP: 0.1 })
    const over = EB.exploreSuccessChance(t, { masteryLevel: 999, poolSuccessPP: 999, gearPP: 999 })
    // ⚠️ 上限必须与**字面量 0.90** 比，不能拿同一个常量自比自（反例验证 ② 就是这么假绿的：
    //    把 CAP 改成 0.95，`Math.abs(maxed - EXPLORE_SUCCESS_CAP)` 仍然恒等 ⇒ 守卫一点反应都没有）
    check('探索改版', '卡片上限 90%（精通与池都堆满也不超过），装备在**上限之外**相加 ⇒ 满配 100% 封顶',
      Math.abs(EB.EXPLORE_SUCCESS_CAP - 0.9) < 1e-9 &&
      Math.abs(maxed - 0.9) < 1e-9 && withGear > maxed && Math.abs(withGear - 1) < 1e-9 && over === 1)
  }

  // ④ 末段卡片不是死卡：初始 0% 时靠精通能起来（且精通**每次动作**都加，见下一条行为断言）
  {
    const t = EXPLORATION_TARGETS_ALL.find((x) => EB.exploreBandOf(x.reqLevel) === 10)
    const zero = EB.exploreSuccessChance(t, { masteryLevel: 0 })
    const m50 = EB.exploreSuccessChance(t, { masteryLevel: 50 })
    const m100 = EB.exploreSuccessChance(t, { masteryLevel: 100 })
    check('探索改版', `末段（${t.name}）初始 0% → 精通 50 级 ${(m50 * 100).toFixed(0)}% → 100 级 ${(m100 * 100).toFixed(0)}%`,
      Math.abs(zero) < 1e-9 && m50 > 0.25 && m100 > 0.5 && m100 <= EB.EXPLORE_SUCCESS_CAP + 1e-9)
  }

  // ⑤ 行为：成功率 0% 的卡片**也会涨精通**（否则永远练不起来 —— 死卡）
  {
    const p0 = freshPlayer()
    createSkillInstances(p0)
    const ex = getAllSkillInstances().find((s) => s.id === 'exploration')
    const t = ex.targets.find((x) => EB.exploreBandOf(x.reqLevel) === 10)
    const before = ex.mastery[t.id] ?? 0
    const realRandom = Math.random
    Math.random = () => 0.999 // 恒「失败」：成功率 0% 时本来也必失败
    try { for (let i = 0; i < 5; i++) ex.performAction(t) } finally { Math.random = realRandom }
    check('探索改版', '🔴 行为：**失败也计精通次数**（0% 的卡片靠反复尝试把精通练起来，否则是死卡）',
      (ex.mastery[t.id] ?? 0) === before + 5, `${before} → ${ex.mastery[t.id]}`)
  }

  // ⑥ 精通档位与池接线（与采集同一套表）
  {
    const p1 = freshPlayer()
    createSkillInstances(p1)
    const ex = getAllSkillInstances().find((s) => s.id === 'exploration')
    const t = ex.targets[0]
    const base = ex.intervalMs(t)
    ex.mastery[t.id] = countForMasteryLevel(100)
    const fast = ex.intervalMs(t)
    check('探索改版', '精确：间隔随精通档位下降（精通 100 → 基础 ×1/2，且不会慢于基础）',
      Math.abs(base - t.intervalSec * 1000) < 1e-6 && fast < base && Math.abs(fast - t.intervalSec * 1000 * masteryIntervalFactor(100)) < 1e-6)
    const cards = ex.targets.length
    p1.skills.exploration.masteryPool = Math.round(0.99 * 600 * cards)
    check('探索改版', '精通池：池满档时给整个探索技能 +5pp 成功率 / +5pp 双倍（与采集同一张里程碑表）', (() => {
      const b = p1.masteryPoolBonus('exploration')
      return b.successPP === 5 && b.doublePP === 5 && b.xpPct === 5
    })(), JSON.stringify(p1.masteryPoolBonus('exploration')))
    check('探索改版', '池加成的成功率真的进了 successChance（不是只显示）', (() => {
      // ⚠️ 必须挑**中段**目标：首段那张已被精通顶到 90% 上限，池加成会被夹掉（第一版就是这么假失败的）
      const mid = ex.targets.find((x) => EB.exploreBandOf(x.reqLevel) === 6)
      ex.mastery[mid.id] = 0
      p1.skills.exploration.masteryPool = Math.round(0.99 * 600 * cards)
      const withPool = ex.successChance(mid)
      p1.skills.exploration.masteryPool = 0
      const without = ex.successChance(mid)
      return withPool > without
    })())
    check('探索改版', '双倍产出走与采集同一条口径（精通档位 + 池 doublePP，封顶 1）',
      /masteryDoubleChance\(mLevel\) \+ poolPP/.test(rdSrc('src/game/skills/ExplorationSkill.js')) && ex.doubleChance(t) >= 0 && ex.doubleChance(t) <= 1)
  }

  // ⑦ 掉落：物品 ÷4、金币原值
  check('探索改版', '战利品概率收紧到 ÷4（0.3 → 0.075），金币条目仍走原值',
    Math.abs(exploreLootChance(0.3) - 0.075) < 1e-9 && Math.abs(diffExplore(0.72) - 0.72) < 1e-9)

  // ⑧ 专属装备：两套 × 2 件 · 只加探索成功率 · 合计 5/10pp · 掉率 0.01% · 满配补足到 100%
  {
    const items = EG.EXPLORE_GEAR_ITEMS
    const onlyExplore = items.every((it) => Object.keys(it.stats).length === 1 && it.stats.exploreSuccessPP > 0)
    check('探索改版', '专属装备共 4 件（两套 × 2 件），**属性只有** exploreSuccessPP',
      items.length === 4 && onlyExplore && EG.EXPLORE_GEAR_SETS.length === 2)
    check('探索改版', '两套合计 +5pp / +10pp（派生自件数，不手抄）',
      Math.abs(EG.exploreSetTotalPP('flavorTrail') - 5) < 1e-9 && Math.abs(EG.exploreSetTotalPP('relicHunt') - 10) < 1e-9)
    check('探索改版', `掉落率 0.01%（用户指定）`, Math.abs(EG.EXPLORE_GEAR_DROP_CHANCE - 0.0001) < 1e-12)
    check('探索改版', '四件都已并进 ITEMS（`items.js` 的合并行）',
      items.every((it) => !!getItem(it.id)))
    // 行为：穿上两套后 successChance 真的更高（走 equippedStats → gearSuccessPP）
    const p2 = freshPlayer()
    createSkillInstances(p2)
    const ex2 = getAllSkillInstances().find((s) => s.id === 'exploration')
    const t2 = ex2.targets.find((x) => EB.exploreBandOf(x.reqLevel) === 10)
    ex2.mastery[t2.id] = countForMasteryLevel(100)
    const before = ex2.successChance(t2)
    p2.equipment.offhand = 'exploreGearFlavorCompass'
    p2.equipment.body = 'exploreGearFlavorCloak'
    const set1 = ex2.successChance(t2)
    // ⚠️ 换套必须清掉上一套的槽位（第一版忘了清 body ⇒ 两套加成叠在一起、量到 12.5pp）
    p2.equipment.body = null
    p2.equipment.offhand = 'exploreGearRelicLantern'
    p2.equipment.boots = 'exploreGearRelicBoots'
    const set2 = ex2.successChance(t2)
    check('探索改版', '行为：穿第一套 +5pp、第二套 +10pp（装备加成在 90% 上限之外相加）',
      Math.abs(set1 - before - 0.025 * 2) < 1e-6 && Math.abs(set2 - before - 0.05 * 2) < 1e-6,
      `${(before * 100).toFixed(1)}% → ${(set1 * 100).toFixed(1)}% → ${(set2 * 100).toFixed(1)}%`)
    p2.upgrades.exploreGearRelicLantern = 10
    p2.upgrades.exploreGearRelicBoots = 10
    // 🔴 强化免疫必须**单件**测：拿两件（5+5）测的话，强化放大成 20pp 也会被下面的 +10pp 上限夹住
    // ⇒ 断言照样绿（假绿）。只用一件时 5pp vs 10pp 才分得开。
    p2.equipment.body = null
    p2.equipment.boots = null
    p2.equipment.offhand = 'exploreGearRelicLantern'
    p2.upgrades.exploreGearRelicLantern = 10 // 满强化 ×2（若被放大 ⇒ 10pp）
    check('探索改版', '强化不放大专属成功率：单件顶级装备满强化仍然只加 5pp',
      Math.abs(p2.equippedStats.exploreSuccessPP - 5) < 1e-9 &&
      Math.abs(ex2.successChance(t2) - (before + 0.05)) < 1e-6,
      `汇总 ${p2.equippedStats.exploreSuccessPP}pp`)
    p2.equipment.body = 'exploreGearFlavorCloak'
    p2.equipment.boots = 'exploreGearRelicBoots'
    check('探索改版', '两套混穿（原始 12.5pp）汇总与结算都封在 10pp，面板与实际成功率同源',
      Math.abs(p2.equippedStats.exploreSuccessPP - 10) < 1e-9 && Math.abs(ex2.successChance(t2) - set2) < 1e-9)
    const { itemDetailLines } = await import('../../src/game/data/itemDetail.js')
    const detail = itemDetailLines('exploreGearRelicLantern').flat().join(' ')
    const equip = rdSrc('src/views/EquipmentView.vue')
    check('探索改版', '图鉴和装备页均显示中文「美食探索成功率 +5.00%」，不漏内部属性键',
      detail.includes('美食探索成功率 +5.00%') && !detail.includes('exploreSuccessPP') &&
      /exploreSuccessPP/.test(equip) && /STAT_LABEL/.test(equip))
  }

  // ⑨ 离线与在线同源
  {
    const p3 = freshPlayer()
    createSkillInstances(p3)
    const ex3 = getAllSkillInstances().find((s) => s.id === 'exploration')
    const t3 = ex3.targets[0]
    p3.setSkillTarget('exploration', t3.id)
    const off = ex3.computeOffline(3600e3, 1)
    const expect = Math.floor(3600e3 / ex3.intervalMs(t3))
    check('探索改版', '离线走同一个 intervalMs / successChance 出口（间隔随精通缩短也被离线吃到）',
      off != null && off.actions === expect, `actions=${off?.actions} 期望=${expect}`)
    const last = ex3.targets.find((x) => EB.exploreBandOf(x.reqLevel) === 10)
    p3.setSkillState('exploration', { level: 99, exp: totalXpForLevel(99) })
    p3.setSkillTarget('exploration', last.id)
    const preview = ex3.computeOffline(3600e3, 1)
    const before = ex3.mastery[last.id] ?? 0
    const poolBefore = p3.skills.exploration.masteryPool ?? 0
    const report = settleOffline(p3, { pushLog() {} }, 3600e3)
    check('探索改版', '离线 0% 卡片：纯计算不改存档，结算按尝试次数增长卡片精通与技能精通池',
      preview?.exp === 0 && preview?.masteryAttempts > 0 &&
      (ex3.mastery[last.id] ?? 0) > before && (p3.skills.exploration.masteryPool ?? 0) > poolBefore &&
      report?.reports?.some(({ inst }) => inst.id === 'exploration'),
      `${last.name}: ${before}→${ex3.mastery[last.id] ?? 0} 次，池 ${poolBefore}→${p3.skills.exploration.masteryPool ?? 0}`)
    const bonus = p3.masteryPoolBonus('exploration')
    check('探索改版', '探索离线精通结算仍走 addMastery 的广度/池唯一出口',
      bonus && /player\.addMastery\(inst\.id, inst\.currentTarget\.id, r\.masteryAttempts\)/.test(rdSrc('src/game/bootstrap.js')))
    const large = ex3.computeOffline(200_000 * ex3.intervalMs(last), 1)
    const countGear = (items) =>
      Object.entries(items ?? {}).filter(([id]) => id.startsWith('exploreGear')).reduce((n, [, q]) => n + q, 0)
    const gearQty = countGear(large?.items)
    check('探索改版', '离线段整体不与在线口径脱节：装备总件数 == round(探索动作数 × 0.01%)',
      large && gearQty === Math.round(large.actions * EG.EXPLORE_GEAR_DROP_CHANCE),
      `合计 ${gearQty} 件（动作 ${large?.actions}）`)
    // 🔴 必须挑「期望总件数是零头」的规模：6000 次动作 × 0.01% = 0.6 件时，先取整总数 ⇒ 掉 1 件；
    //    逐件写 round(0.6/4)=0 ⇒ 一件都不掉（0 件）。拿 12 件那种整数规模测，两种写法结果相同 ⇒ 假绿。
    const smallActions = 6000
    const small = ex3.computeOffline(smallActions * ex3.intervalMs(last), 1)
    check('探索改版', '离线 0.01% 装备先取整「总件数」再分配（期望 0.6 件 ⇒ 掉 1 件，逐件四舍五入会掉 0 件）',
      countGear(small?.items) === 1 && Math.abs((small?.actions ?? 0) * EG.EXPLORE_GEAR_DROP_CHANCE - 0.6) < 0.02,
      `动作 ${small?.actions} · 期望总件数 ${((small?.actions ?? 0) * EG.EXPLORE_GEAR_DROP_CHANCE).toFixed(2)} · 实掉 ${countGear(small?.items)} 件`)
  }

  // ⑨b 专属装备：**每次探索动作**都可能掉（成功与否都算）· 只从探索出 · 掉落列表里看得见
  {
    // 每次动作恰好 3 次掷骰：装备判定 → 选中哪一件 → 成功率判定（钉死随机，逐次可预测）
    const cycleRandom = (pattern, fn) => {
      const real = Math.random
      let i = 0
      Math.random = () => pattern[i++ % pattern.length]
      try { return fn() } finally { Math.random = real }
    }
    const p4 = freshPlayer()
    createSkillInstances(p4)
    const ex4 = getAllSkillInstances().find((s) => s.id === 'exploration')
    p4.setSkillState('exploration', { level: 99, exp: totalXpForLevel(99) })
    const dead = ex4.targets.find((x) => EB.exploreBandOf(x.reqLevel) === 10)
    p4.setSkillTarget('exploration', dead.id)
    const evs = []
    const onAct = (e) => evs.push(e)
    EventBus.on('skill:action', onAct)
    cycleRandom([0.0, 0.0, 0.999], () => { for (let n = 0; n < 6; n++) ex4.performAction(dead) })
    EventBus.off('skill:action', onAct)
    const first = EG.EXPLORE_GEAR_ITEMS[0]
    check('探索改版', '🔴 行为：末段 0% 的卡片（永远不会成功）也掉得出专属装备 —— 掉率按「动作」而不是「成功」',
      ex4.successChance(dead) === 0 && p4.inventory?.[first.id] === 6,
      `0% 卡片 6 次动作掉了 ${p4.inventory?.[first.id] ?? 0} 件`)
    const failEv = evs.filter((e) => e.outcome === 'explorefail')
    check('探索改版', '失败也掉时**日志里看得见**（explorefail 事件带 extraGain，否则玩家只觉得凭空多了件装备）',
      failEv.length === 6 && failEv.every((e) => typeof e.extraGain === 'string' && e.extraGain.includes('✨')),
      `失败事件 ${failEv.length} 条 · 带装备名 ${failEv.filter((e) => e.extraGain?.includes('✨')).length} 条`)
    // ── 只从探索出：觅珍各池都不许再含这四件（池成员是唯一真身，图鉴来源跟着它走）──
    const stillInPools = []
    for (const pool of MIJIAN_POOLS) {
      const ids = (poolItems(pool.id) ?? []).map((m) => (typeof m === 'string' ? m : m.id))
      for (const g of EG.EXPLORE_GEAR_ITEMS) if (ids.includes(g.id)) stillInPools.push(`${pool.name}:${g.name}`)
    }
    check('探索改版', '探索独占：四件已从觅珍全部池剔除（厨具池/混池/限时池都抽不到）',
      stillInPools.length === 0, stillInPools.join('、'))
    const src = EG.EXPLORE_GEAR_ITEMS.map((g) => itemSources(g.id).join('｜'))
    check('探索改版', '图鉴来源只写「美食探索」，不再把玩家指向抽卡',
      src.every((s) => /美食探索/.test(s) && !/觅珍/.test(s)), src.join(' ／ '))
    // ── 掉落列表里看得见（玩家就是在这一处找它）──
    const view2 = rdSrc('src/views/ExplorationView.vue')
    const lootBlock = view2.slice(view2.indexOf('class="loot-list"'), view2.indexOf('class="loot-list"') + 1400)
    // 🔴 「有这个类名」还不够（反例验证 ⑰ 抓到的假绿）：给那一行挂 `v-if="false"` 让它**永不渲染**，
    //    只查字符串的断言照样绿。所以这里连**那个标签本身**一起钉：不许带任何条件属性。
    const gearTag = (lootBlock.match(/<div[^>]*loot-row--gear[^>]*>/) ?? [''])[0]
    check('探索改版', '卡片掉落列表里有一行专属装备（在 v-for 掉落之后，且**无条件常驻**）',
      /loot-row--gear/.test(lootBlock) && /EXPLORE_GEAR_ITEMS/.test(lootBlock) &&
        lootBlock.indexOf('v-for="(l, i) in t.loot"') < lootBlock.indexOf('loot-row--gear') &&
        gearTag.length > 0 && !/\bv-if\b|\bv-show\b/.test(gearTag),
      `该行 ${/loot-row--gear/.test(lootBlock) ? '在' : '不在'}掉落块内 · 标签 ${gearTag ? '带条件属性' : '未找到'}`)
    check('探索改版', '文案口径统一成「每次探索」（页脚不再写「每次成功探索」）',
      /每次探索 \{\{/.test(view2) && !/每次成功探索/.test(view2))
  }

  // ⑩ 显示同源 + 展示与其它技能一致
  {
    const view = rdSrc('src/views/ExplorationView.vue')
    check('探索改版', '卡片展示与其它技能一致：era-tabs 等级段 + 精通行/精通条 + MasteryPoolBar + 进度条',
      /class="era-tabs"/.test(view) && /<MasteryPoolBar/.test(view) && /class="mastery-bar"/.test(view) && /<ProgressBar/.test(view) &&
        /levelEras\(/.test(view))
    check('探索改版', '视图的成功率/掉落概率全部走实例出口（不手写公式、不裸读数据字段）',
      /instance\.successChance\(/.test(view) && /instance\.lootChance\(/.test(view) &&
        /instance\.initialChance\(/.test(view) && /instance\.masteryProgress\(/.test(view) &&
        !/baseSuccess\s*\*/.test(view) && !/\bl\.chance\b\s*\*/.test(view))
    check('探索改版', '页面写明「上限 90% + 专属装备补足剩下 10%」（玩家不用猜为什么堆不动了）',
      /EXPLORE_CAP_TEXT/.test(view) && /EXPLORE_GEAR_ITEMS/.test(view) && /EXPLORE_GEAR_DROP_CHANCE/.test(view))
  }

  // ⑪ 卡片排版（2026-09-28 用户：「卡片太长了而且很杂」→「一个卡片改成两个卡片大小」；
  //    同日追加：「制作的卡片、食材保鲜的卡片、副业的卡片都是过长，需要同步成美食探索的卡片那样」）
  {
    const view = rdSrc('src/views/ExplorationView.vue')
    const prod = rdSrc('src/views/ProductionView.vue')
    const css = rdSrc('src/styles/main.css')
    // 骨架**单一来源**：宽卡网格与两栏原语只写在 main.css，两个视图只引用类名。
    // ⚠️ `min(400px, 100%)` 是**窄屏不溢出的关键写法** —— 直接写 minmax(400px, 1fr)
    //    在 350px 的容器里会撑出横向滚动条（本项目在别处踩过同类坑）。
    check('探索改版', '宽卡骨架单一来源（main.css 定义 `.gather-grid--wide` / `.card-2col` / `.card-col--right`，含 min(…,100%) 防溢出）',
      /\.gather-grid--wide\s*\{[^}]*repeat\(auto-fill, minmax\(min\(400px, 100%\), 1fr\)\)/.test(css) &&
        /\.card-2col\s*\{[^}]*grid-template-columns/.test(css) &&
        /\.card-2col\s*\{[^}]*grid-template-rows: auto 1fr/.test(css) &&
        /\.card-col--right\s*\{[^}]*border-left: 1px dashed var\(--border\)/.test(css) &&
        /max-width: 720px[\s\S]{0,300}card-2col[\s\S]{0,200}grid-template-columns: minmax\(0, 1fr\)/.test(css) &&
        // 窄屏并栏后**必须去掉那条分隔线**，否则会留一根悬空竖线
        // （2026-09-28 补：反例 ⑳ 注入「删掉这条规则」时，原先没有任何断言会 FAIL —— 属于「注入没被点名」）
        /max-width: 720px[\s\S]{0,500}card-col--right\s*\{[^}]*border-left: 0/.test(css))
    check('探索改版', '两个视图都只**引用**骨架类名，不各自重定义（否则改列宽要改多处）',
      /gather-grid--wide/.test(view) && /card-2col/.test(view) &&
        /gather-grid--wide/.test(prod) && /card-2col/.test(prod) &&
        !/\.gather-grid--wide\s*\{/.test(view) && !/\.gather-grid--wide\s*\{/.test(prod) &&
        !/\.card-2col\s*\{/.test(view) && !/\.card-2col\s*\{/.test(prod))
    // 分隔线必须用能看见的颜色：`--glass-rgb` 是白色玻璃高光，浅色主题下画在白卡片上等于没有
    check('探索改版', '分隔线用 `var(--border)`（不是白色玻璃高光 --glass-rgb）',
      !/1px dashed rgba\(var\(--glass-rgb\)/.test(css + view + prod) &&
        (view.match(/border-(left|top): 1px dashed var\(--border\)/g) ?? []).length >= 1)
    // 制作类卡片（制作/保鲜/副业同属 ProductionView）必须与探索页同一套骨架
    check('探索改版', '制作类卡片同步宽卡两栏（跨栏动作条 + 材料进右栏），不再是一长条竖排',
      /recipe-grid gather-grid--wide/.test(prod) && /card-span/.test(prod) &&
        /card-col--right/.test(prod) && /pc-stats/.test(prod))
    // 精通档位说明：2026-09-28 用户指出探索页缺它（其余技能页都有）
    check('探索改版', '探索页有「精通档位说明」按钮（与采集/制作/厨房笔记共用同一个组件）',
      /<MasteryHelp\s*\/>/.test(view) && /import MasteryHelp from/.test(view))
  }
}

// ══════════ C72：往季赛季件第二条获取路径（2026-09-29）══════════
// 起因：400 件赛季限定 = 40 季 × 10 档 ⇒ **无论计数口径怎么改，集齐都要 560 天真实时间**（努力无法缩短）。
//   对照 Rocky Idle 无日历机制、Melvor 的完成度是纯努力门 ⇒ 这是本作唯一「比参照作更劝退」的设计。
//   故事那边 09-19 已靠「累计次数」去门（需求 8 < 单季容量 10），这里需求 400 > 容量 10×40 ⇒ 只能加第二条路径。
// 口径：只对**往季**、只对**含限定装备的档位**、每档固定金币、买到手记进 `claimed`（不可重复、且推进累计领奖计数）。
{
  const { SEASONS, activeSeasonId, getSeason } = await import('../../src/game/data/seasons.js')
  const SP = await import('../../src/game/data/seasonPast.js')
  const { SEASONS_GEAR } = await import('../../src/game/data/expansion_gear.js')

  // ① 冻结数据未动：每季仍是 10 档 · 点数 20/40/…/200（合计 1100）· 装备件数 9（限定 1 + 套装 8）
  const tierOk = SEASONS.every((s) => (s.tiers?.length ?? 0) === 10 &&
    s.tiers.every((t, i) => t.points === (i + 1) * 20) &&
    s.tiers.reduce((a, t) => a + t.points, 0) === 1100)
  const gearCnt = SEASONS.map((s) => SP.seasonGearIds(s).size)
  check('往季补领', '冻结数据未改：40 季 × 每季 10 档（20…200，合计 1100）· 每季装备 9 件（限定 1 + 套装 8）',
    SEASONS.length === 40 && tierOk && gearCnt.every((n) => n === 9) && SEASONS_GEAR.length === 40,
    `季数 ${SEASONS.length} / 档位结构 ${tierOk} / 装备件数集合 ${[...new Set(gearCnt)].join(',')} / 套装表 ${SEASONS_GEAR.length}`)

  // ② 价格是**唯一出口**（其它文件不许再写这个数字）
  const price = SP.PAST_SEASON_GEAR_PRICE
  const spSrc = fs.readFileSync(new URL('../../src/game/data/seasonPast.js', import.meta.url), 'utf8')
  const literalElsewhere = []
  for (const f of ['src/stores/player.js', 'src/views/SeasonView.vue', 'src/game/data/itemSources.js']) {
    const src = fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
    if (new RegExp(`\\b${price}\\b`).test(src)) literalElsewhere.push(f)
  }
  check('往季补领', '价格单出口：写法只在 seasonPast.js（其余文件一律读常量，不裸写数字）',
    /export const PAST_SEASON_GEAR_PRICE = \d+/.test(spSrc) && literalElsewhere.length === 0,
    literalElsewhere.length ? `裸写价格的文件：${literalElsewhere.join(', ')}` : `价格 ${price}`)

  // ③ 清单口径：只列往季、只列含装备的档、已领/已拥有不列
  const cur = activeSeasonId()
  const past = SEASONS.find((s) => s.id !== cur)
  getSeason(past.id) // 触发 seasonContent 的主题化（tiers 会被就地重算 ⇒ 与游戏内同一份）
  const raw = getSeason(past.id)
  const tiers = SP.seasonGearTiers(raw)
  const noGear = raw.tiers.findIndex((t, i) => !tiers.some((g) => g.index === i))
  const flat = SP.pastSeasonGearToClaim(SEASONS, cur, {})
  check('往季补领', '清单：不含当季 · 档位都是含装备的档 · 覆盖该季全部 9 件（一档可含 2 件）',
    tiers.length >= 1 && flat.every((c) => c.seasonId !== cur) &&
      noGear >= 0 && !tiers.some((t) => t.index === noGear) &&
      new Set(tiers.flatMap((t) => t.itemIds)).size === 9,
    `档位 ${tiers.map((t) => t.index).join(',')} / 非装备档 ${noGear} / 覆盖 ${new Set(tiers.flatMap((t) => t.itemIds)).size}/9`)

  // ④ 行为：买入 / 扣金 / 不可重复 / 记 claimed / 进信箱 / 当季与非装备档被拒
  const p = freshPlayer()
  p.gold = 10_000_000
  const t0 = tiers[0]
  const before = p.gold
  const bought = p.seasonBuyPastTier(past.id, t0.index)
  const dup = p.seasonBuyPastTier(past.id, t0.index) // 重复
  // ⚠️ 「当季」必须拿**当前季含装备的档**去试：拿任一档试会被「非装备档」那条先拒掉 ⇒ 断言为**假绿**
  //    （反例验证时把当季判断删掉、仍拿档 0 试会照样 PASS —— 当前季的档 0 是纯金币档）
  getSeason(cur)
  const curGearTier = SP.seasonGearTiers(getSeason(cur))[0]
  const curTry = p.seasonBuyPastTier(cur, curGearTier.index) // 当季（且是含装备的档）
  const noGearTry = p.seasonBuyPastTier(past.id, noGear) // 非装备档
  const mailOk = (p.mail?.list ?? []).some((m) => /往季补领/.test(m.subject ?? ''))
  const claimedOk = (p.seasons[past.id]?.claimed ?? []).includes(t0.index)
  const listedAfter = p.pastSeasonGearClaims().some((c) => c.seasonId === past.id && c.index === t0.index)
  check('往季补领', '行为：正价买入并精确扣金 · 拒绝重复/当季/非装备档 · 记 claimed · 进信箱 · 买完即从清单消失',
    bought === true && before - p.gold === price && dup === false && curTry === false && noGearTry === false &&
      mailOk && claimedOk && listedAfter === false,
    `买入 ${bought} 扣金 ${before - p.gold} 重复 ${dup} 当季 ${curTry}(档${curGearTier?.index}) 非装备 ${noGearTry} 信箱 ${mailOk} claimed ${claimedOk} 仍在清单 ${listedAfter}`)

  // ⑤ 金币不足被拒（且**分文不扣**）
  const p2 = freshPlayer()
  p2.gold = price - 1
  const poor = p2.seasonBuyPastTier(past.id, t0.index)
  check('往季补领', '金币不足：拒绝且分文不扣',
    poor === false && p2.gold === price - 1 && (p2.seasons[past.id]?.claimed ?? []).length === 0,
    `结果 ${poor} 余额 ${p2.gold} claimed ${(p2.seasons[past.id]?.claimed ?? []).length}`)

  // ⑥ 补领取的档位同样计入「累计领奖次数」（成就/任务那套口径，不是第二套计数）
  const countOf = (pl) => Object.values(pl.seasons ?? {}).reduce((t, s) => t + (s.claimed?.length ?? 0), 0)
  const { ACHIEVEMENTS } = await import('../../src/game/data/achievements.js')
  const { achievementProgress } = await import('../../src/game/data/achievementProgress.js')
  const season5 = ACHIEVEMENTS.find((a) => a.id === 'season5')
  const p3 = freshPlayer()
  p3.gold = 1e9
  const buys = SP.seasonGearTiers(raw).slice(0, 5)
  for (const t of buys) p3.seasonBuyPastTier(past.id, t.index)
  const prog = achievementProgress(p3, season5)
  check('往季补领', '累计口径同源：补领 5 档 ⇒ 成就 check 达成、且进度条读数与 check 同源（不是「有领奖的季数」）',
    countOf(p3) === 5 && season5.check(p3) === true && prog?.cur === 5,
    `计数 ${countOf(p3)} check ${season5.check(p3)} 进度 ${JSON.stringify(prog)}`)

  // ⑦ 全补领：清单清空 + 总花费 = 档数 × 单价（可复算）
  const p4 = freshPlayer()
  p4.gold = 1e9
  let tierTotal = 0
  for (const s of SEASONS) {
    if (s.id === cur) continue
    getSeason(s.id)
    for (const t of SP.seasonGearTiers(s)) { p4.seasonBuyPastTier(s.id, t.index); tierTotal++ }
  }
  const spent = 1e9 - p4.gold
  check('往季补领', '全补领：清单清空 · 总花费 = 档数 × 单价（可复算）· 拿齐全部 39 季 351 件',
    p4.pastSeasonGearClaims().length === 0 && spent === tierTotal * price && tierTotal === 195 &&
      Object.keys(p4.seasons).filter((id) => id !== cur).length === 39,
    `花费 ${spent} = ${tierTotal} 档 × ${price} · 涉及季数 ${Object.keys(p4.seasons).length - 1}`)

  // ⑧ 界面接线：赛季页有补领块 + **按钮真的接到 store**（漏接就是「页面写着能做，实际按不动」）
  // 🔴 反例验证抓到本条首版是**假绿**：原来只查 `seasonBuyPastTier(` 在文件里出现 —— 而函数体里那一处
  //    即使把按钮的 `@click` 换成空函数也**照样在** ⇒ 断言仍绿。现拆成两段：
  //    ① 按钮的 `@click` 必须指向那个 helper；② helper 体内必须调 store 方法。
  //    ⇒ 通用口径：**「界面上要有 X」的静态断言，都要问「把这个元素关掉，断言还会不会绿」。**
  const seasonView = fs.readFileSync(new URL('../../src/views/SeasonView.vue', import.meta.url), 'utf8')
  check('往季补领', '界面接线：赛季页有「往季补领」块 · 按钮 @click 指向 buyPast · helper 体内调 seasonBuyPastTier · 价格读常量不裸写',
    /往季补领/.test(seasonView) && /@click="buyPast\(/.test(seasonView) &&
      /function buyPast\([\s\S]{0,160}?seasonBuyPastTier\(/.test(seasonView) &&
      /PAST_SEASON_GEAR_PRICE/.test(seasonView) && /player\.pastSeasonGearClaims\(\)/.test(seasonView))

  // ⑨ 图鉴来源登记：赛季限定装备必须写明补领这条路（只写「赛季奖励」会把玩家指向不存在的等待）
  const { itemSources } = await import('../../src/game/data/itemSources.js')
  const src0 = itemSources(SEASONS[0].limitedItem) ?? []
  check('往季补领', '图鉴来源写明第二条路径（价格从常量派生）',
    src0.some((s) => /往季/.test(s) && s.includes(String(price))),
    src0.join(' | '))

  // ⑩ 供料可见化（同日）：生产页的「供料」必须走材料成本唯一出口 effIngredients（不是原始 ingredients）
  const prodView = fs.readFileSync(new URL('../../src/views/ProductionView.vue', import.meta.url), 'utf8')
  const playerSrc = fs.readFileSync(new URL('../../src/stores/player.js', import.meta.url), 'utf8')
  const matBlock = playerSrc.match(/materialSecPerCraft\(recipe\)\s*\{[\s\S]{0,400}?\n    \}/)?.[0] ?? ''
  const pp = freshPlayer({ cooking: 40 })
  const { COOKING_RECIPES } = await import('../../src/game/skills/CookingSkill.js')
  const { effIngredients } = await import('../../src/game/data/materialCost.js')
  const rec = COOKING_RECIPES.find((r) => Object.keys(effIngredients(r)).length)
  const hand = Object.entries(effIngredients(rec)).reduce((a, [id, q]) => a + q * pp.gatherSecPerUnit(id), 0)
  check('供料可见化', '生产页有「供料 / 实际周期」两行 · 供料走 materialSecPerCraft · 该函数读 effIngredients（生效用量）· 周期 = max(队列 3s, 供料)',
    /供料/.test(prodView) && /实际周期/.test(prodView) && /materialSecPerCraft/.test(prodView) &&
      /effIngredients/.test(matBlock) &&
      Math.abs(pp.materialSecPerCraft(rec) - hand) < 1 &&
      /Math\.max\(CRAFT_QUEUE_INTERVAL_MS \/ 1000, supplySec\(recipe\)\)/.test(prodView),
    `手算 ${hand.toFixed(0)}s vs 实现 ${pp.materialSecPerCraft(rec)}s`)
}

// ══════════ C73：Lv101-120「补档」接线（2026-09-29 用户授权批）══════════
// 58 件物品 + 13 条采集目标 + 41 条配方的**形状钉**：把「这一批的口径」钉住防回退。
// 数量类基线（目标数/食谱数/材料合计）在各自系统块里已同步；这里钉的是**结构不变量**。
{
  const { LATE_ITEMS, LATE_GATHER, LATE_CROPS, LATE_PROD, LATE_SIDELINE_ROWS } = await import('../../src/game/data/lateGameFood.js')
  const { ITEMS } = await import('../../src/game/data/items.js')
  const { existsSync } = await import('node:fs')
  const { getItem } = await import('../../src/game/data/items.js')
  const { itemImage } = await import('../../src/game/data/itemImage.js')
  const { getAllSkillInstances } = await import('../../src/game/skills/registry.js')
  const { SIDELINE_WORKS, SIDELINE_AXIS_TOTALS, SIDELINE_ITEMS } = await import('../../src/game/data/sidelineWorks.js')

  // ① 58 件全部入 ITEMS 且有图片（56 food + 2 seed；副业产物按 `${key}_${lv}`、木工按语义 id）
  const woodworkIds = ['divineCouch', 'agarwoodAltar']
  const allLate = [
    ...LATE_ITEMS.map((i) => i.id),
    ...LATE_SIDELINE_ROWS.map(([key, lv]) => `${key}_${lv}`),
    ...woodworkIds,
  ]
  const miss = allLate.filter((id) => !ITEMS[id])
  const noImg = allLate.filter((id) => {
    const it = ITEMS[id]
    const p = itemImage(id)
    return !p || !existsSync(new URL(`../../public/${p}`, import.meta.url))
  })
  check('补档', '58 件全部并入 ITEMS 且图片文件真实存在（56 food + 2 seed）',
    allLate.length === 58 && miss.length === 0 && noImg.length === 0,
    `缺物品 ${miss.slice(0, 4).join(',')} / 缺图 ${noImg.slice(0, 4).join(',')}`)

  // ② 每件新**原料** ≥2 条配方消费（图鉴「可用于制作」不许空；产物本身不需要——它们被吃/被做成作品）
  const allRecipes = []
  for (const inst of getAllSkillInstances()) allRecipes.push(...(inst.recipes ?? []))
  const materials = LATE_ITEMS.filter((i) => i.type === 'ingredient')
  const starve = materials.filter((m) => allRecipes.filter((r) => Object.keys(r.ingredients ?? {}).includes(m.id)).length < 2)
  check('补档', '每件新原料都 ≥2 条配方在吃（有产出必须有用途）', starve.length === 0,
    starve.map((m) => `${m.name}(${allRecipes.filter((r) => Object.keys(r.ingredients ?? {}).includes(m.id)).length})`).join('、'))

  // ③ 配方等级与材料等级：全部满足「材料 ≤ 配方 + 5」（含副业追加与木工两件；紫苏玉笋必须 Lv102 ——
  //    它回 108 会把两条 Lv102 副业配方抬到 103，等级口径就漂了）
  const lvlOf = (id) => {
    for (const [skill, arr] of Object.entries(LATE_GATHER)) {
      const hit = arr.find((t) => t.itemId === id)
      if (hit) return hit.reqLevel
    }
    const crop = LATE_CROPS.find((c) => c.itemId === id)
    if (crop) return crop.reqLevel
    const it = getItem(id)
    return it ? Math.round((it.value - 5) / 3.2) : null
  }
  const over = []
  for (const [skill, arr] of Object.entries(LATE_PROD)) {
    for (const r of arr) for (const [mid, q] of Object.entries(r.ingredients)) {
      if (q < 1) continue
      const ml = lvlOf(mid)
      if (ml != null && ml > r.reqLevel + 5) over.push(`${r.id}: ${mid} Lv${ml} > ${r.reqLevel}+5`)
    }
  }
  const yusun = LATE_GATHER.foraging.find((t) => t.itemId === 'late_for_02')
  check('补档', '41 条新配方的材料全部 ≤ 配方+5 · 紫苏玉笋钉在 Lv102（防材料锚把配方抬级）',
    over.length === 0 && yusun?.reqLevel === 102, `${over.slice(0, 3).join('; ')} / 玉笋 Lv${yusun?.reqLevel}`)

  // ④ 技能顶档推进到位（这批的意义就是填 101-120 空档，顶档回落 = 内容被撤）
  const tops = {}
  for (const inst of getAllSkillInstances()) {
    const list = [...(inst.targets ?? []), ...(inst.recipes ?? []), ...(inst.crops ?? [])]
    tops[inst.id] = Math.max(0, ...list.map((x) => x.reqLevel ?? 0))
  }
  const topBad = [
    ['foraging', 112], ['fishing', 112], ['hunting', 112], ['excavation', 112], ['mining', 112], ['woodcutting', 112],
    ['farming', 112], ['cooking', 118], ['baking', 116], ['brewing', 117], ['spiceMixing', 120],
    ['woodworking', 112], ['pottery', 112], ['exchequer', 112], ['candles', 112],
  ].filter(([id, want]) => (tops[id] ?? 0) < want)
  check('补档', '15 个技能的顶档都推进到设计值（采集/农耕 112 · 烹饪 118 · 烘焙 116 · 酿造 117 · 香料 120 · 副业 112）',
    topBad.length === 0, topBad.map(([id, want]) => `${id}=${tops[id]}<${want}`).join(', '))

  // ⑤ 副业轴合计按**实际作品**重算（退回 DEFS rows 口径 = totals 过期、恒等式断言 FAIL）
  const totalsBad = Object.entries(SIDELINE_AXIS_TOTALS).filter(([axis, t]) => {
    const real = Object.values(SIDELINE_WORKS).filter((w) => w.axis === axis).length
    return t.count !== real || t.total !== t.perItem * real
  })
  check('补档', 'SIDELINE_AXIS_TOTALS 与实际作品数一致（恒等式的另一半）', totalsBad.length === 0,
    totalsBad.map(([a, t]) => `${a}:${t.count}`).join(', '))

  // ⑥ 独占口径自动覆盖：30 件副业新产物全在 SIDELINE_ITEMS 里（其类别已在独占清单 ⇒ 五个池自动排除，
  //    这是「展开 SIDELINE_ITEM_CATEGORIES、不抄类别字符串」那条规矩的红利——新产物零改动即被排除）
  const sidelineLate = LATE_SIDELINE_ROWS.map(([key, lv]) => `${key}_${lv}`)
  const notListed = sidelineLate.filter((id) => !SIDELINE_ITEMS.some((s) => s.id === id))
  check('补档', '30 件副业新产物都在 SIDELINE_ITEMS（独占清单按类别生效 ⇒ 觅珍/礼包/商队/自动出售自动排除）',
    notListed.length === 0, notListed.slice(0, 4).join(','))
}

// ══════════ C74：Lv101-120「补档」· **装备线**（2026-09-29 用户授权 + 出图）══════════
// 16 件 = 4 档 × 4 件（武器/身体/头盔/靴子）。这一块钉的是**数值管线**而不是数值本身：
// 手写的 `stats` 只是占位 1，真正的数值由 `itemBalance` 启动时按 center(等级) 覆写 —— 一旦
// 漏登记它的 `G` 索引，顶级装备就会停在 `{attack:1}`，而**页面上看不出异常**（只是数字很小）。
{
  const { LATE_GEAR_ITEMS, LATE_GEAR_RECIPES, LATE_GEAR_IDS } = await import('../../src/game/data/lateGear.js')
  const { ITEMS, getItem } = await import('../../src/game/data/items.js')
  const { itemSources } = await import('../../src/game/data/itemSources.js')
  const { itemImage } = await import('../../src/game/data/itemImage.js')
  const { poolItems } = await import('../../src/game/data/mijianDraws.js')
  const { existsSync } = await import('node:fs')
  const cs = getSkillInstance('craftsmithing')

  // ① 16 件：入 ITEMS · 图存在 · 来源串 · 4 档 × 4 槽
  const missing = []
  for (const it of LATE_GEAR_ITEMS) {
    if (!ITEMS[it.id]) missing.push(`${it.name} 不在 ITEMS`)
    const img = itemImage(it.id)
    if (!img || !existsSync(new URL(`../../public/${img}`, import.meta.url))) missing.push(`${it.name} 缺图`)
    if (!itemSources(it.id)?.length) missing.push(`${it.name} 缺来源`)
  }
  const levels = [...new Set(LATE_GEAR_RECIPES.map((r) => r.reqLevel))].join(',')
  check('补档·装备线', '16 件入 ITEMS · 图片齐备 · 图鉴来源齐备 · 4 档 × 4 槽（Lv104/108/112/116 各 武器/身体/头盔/靴子）',
    LATE_GEAR_ITEMS.length === 16 && missing.length === 0 && levels === '104,108,112,116' &&
      ['weapon', 'body', 'helmet', 'boots'].every((s) => LATE_GEAR_ITEMS.filter((i) => i.slot === s).length === 4),
    missing.slice(0, 4).join('; ') + ` / 等级 ${levels}`)

  // ② 🔴 **数值管线**（这块守卫的核心）：主维度必须已被按等级覆写、且随等级严格递增。
  //    ⚠️ 判据用 `center(等级)` 的**字面公式**算，不 import itemBalance 的 center（那是自比自，
  //    项目里「拿常量自比自」的假绿有先例）。
  const byLv = [...new Set(LATE_GEAR_RECIPES.map((r) => r.reqLevel))].sort((a, b) => a - b)
  const wId = (lv) => LATE_GEAR_ITEMS.find((i) => i.slot === 'weapon' && i.id === `lateGear${lv}Weapon`)?.id
  const weaponAtk = byLv.map((lv) => getItem(wId(lv))?.stats?.attack)
  const cw = (lv) => Math.round((2 + lv * 0.37) * 100) / 100
  check('补档·装备线', '数值被平衡层按等级覆写（不是占位 1）且严格递增：武器攻击 = center(等级) 的字面公式',
    weaponAtk.every((v) => v != null && v > 1) && weaponAtk.every((v, i) => i === 0 || v > weaponAtk[i - 1]) &&
      byLv.every((lv, i) => Math.abs(weaponAtk[i] - cw(lv)) < 0.01),
    `实测 ${weaponAtk.join(' / ')}（期望 ${byLv.map(cw).join(' / ')}）`)

  // ③ 材料：只用本批新料 + 盐矿，且全部 ≤ 配方 + 5
  const bad = []
  for (const r of LATE_GEAR_RECIPES) {
    for (const [mid, q] of Object.entries(r.ingredients)) {
      if (q < 1) continue
      const lv = { late_min_01: 102, late_wood_01: 102, late_min_02: 112, late_wood_02: 112, saltOre: 10 }[mid]
      if (lv == null) bad.push(`${r.id}: 用了非本批材料 ${mid}`)
      else if (lv > r.reqLevel + 5) bad.push(`${r.id}: ${mid} Lv${lv} > ${r.reqLevel}+5`)
    }
  }
  check('补档·装备线', '配方材料只用本批新料 + 盐矿，且全部 ≤ 配方等级 + 5', bad.length === 0, bad.slice(0, 3).join('; '))

  // ④ 锻造实例含这 16 条且**零漂移**（生成器产物 smithSetExt 未被改动）
  const drift = []
  for (const r of LATE_GEAR_RECIPES) {
    const live = cs.recipes.find((x) => x.id === r.id)
    if (!live) { drift.push(`${r.id} 不在锻造实例`); continue }
    if (live.reqLevel !== r.reqLevel) drift.push(`${r.id} 等级 ${r.reqLevel}→${live.reqLevel}`)
    if (JSON.stringify(live.ingredients) !== JSON.stringify(r.ingredients)) drift.push(`${r.id} 材料被改写`)
  }
  check('补档·装备线', '16 条配方进了锻造实例且零漂移（生成器产物 smithSetExt 一个字没动）', drift.length === 0, drift.slice(0, 4).join('; '))

  // ⑤ 觅珍排除（口径同探索专属装备）：顶级装备不该从 500 金/抽里抽出来
  const leaked = []
  for (const pool of ['gear', 'mix', 'limited', 'material', 'food']) {
    for (const x of poolItems(pool)) if (LATE_GEAR_IDS.includes(x.id)) leaked.push(`${pool}:${x.name}`)
  }
  check('补档·装备线', '16 件不进任何觅珍池（否则绕开采矿→伐木→锻造整条链）', leaked.length === 0, leaked.slice(0, 4).join('、'))

  // ⑥ 这 16 件**刻意不属于任何套装**（不带 2/4/6 件加成 ⇒ 不再抬战力推塔）。
  //    名字与赛季套同前缀（天罡/赤霄）纯属主题撞车 ⇒ 孤儿检查里有**显式豁免**（本文件那行带注释）。
  const { EQUIPMENT_SETS } = await import('../../src/game/data/equipSets.js')
  const inSet = LATE_GEAR_IDS.some((id) => EQUIPMENT_SETS.some((s) => s.ids.includes(id)))
  check('补档·装备线', '16 件刻意不属于任何套装（无 2/4/6 件加成），且孤儿检查的豁免是显式登记的',
    !inSet && /if \(LATE_GEAR_IDS\.includes\(id\)\) continue/.test(fs.readFileSync(new URL('./system_test.mjs', import.meta.url), 'utf8')))
}

// ══════════ C75：美食探索 · Lv102-120 扩展（2026-09-29，补档第三条线）══════════
// 10 个目标（Lv102~120 每 2 级一件），战利品**引用已存在物品**（本批的原料与料理）⇒ 不需要新美术。
// 三件事：① 接线（真的并进了共享表、且只并一遍）② 形状（等级/掉落/概率/等级带）
// ③ **段位口径**：段 10 之后系数天然为 0，新目标与段 10 同口径（0% 起步、靠精通 + 专属装备补足）。
{
  const { EXPLORATION_TARGETS_ALL } = await import('../../src/game/data/explorationTargets.js')
  const { LATE_EXPLORE_TARGETS } = await import('../../src/game/data/lateExplore.js')
  const { LATE_GATHER, LATE_CROPS, LATE_PROD, LATE_SEED_SHOP } = await import('../../src/game/data/lateGameFood.js')
  const { LATE_GEAR_RECIPES } = await import('../../src/game/data/lateGear.js')
  const { exploreBandFactor, exploreSuccessChance } = await import('../../src/game/data/explorationBalance.js')
  const { ITEM_LEVEL } = await import('../../src/game/data/combatLoot.js')
  const { itemSources } = await import('../../src/game/data/itemSources.js')
  const { getItem } = await import('../../src/game/data/items.js')

  const late = EXPLORATION_TARGETS_ALL.filter((t) => String(t.id).startsWith('explore_late_'))
  check('补档·探索', `${LATE_EXPLORE_TARGETS.length} 个扩展目标并进共享表（总数 210 = 生成器 200 + 扩展 10）且 id 不重复`,
    EXPLORATION_TARGETS_ALL.length === 210 && late.length === 10 &&
      new Set(EXPLORATION_TARGETS_ALL.map((t) => t.id)).size === 210,
    `总数 ${EXPLORATION_TARGETS_ALL.length} · 扩展 ${late.length}`)

  const lvs = late.map((t) => t.reqLevel).join(',')
  // 🔴 等级判定**必须查得到**（反例 ② 抓到的假绿）：`ITEM_LEVEL` 是**生成器产物**（combatLoot.js，
  //    本批刻意没重跑）⇒ 本批新物品不在里面，若照抄 `if (il != null && …)` 就会**静默跳过**它们。
  //    所以这里：① 先查 ITEM_LEVEL ② 再查本批三张表（采集目标/作物/配方）③ **查不到就算 FAIL**。
  const lvlOf = (id) => {
    if (ITEM_LEVEL[id] != null) return ITEM_LEVEL[id]
    const g = Object.values(LATE_GATHER).flat().find((t) => t.itemId === id)
    if (g) return g.reqLevel
    const crop = LATE_CROPS.find((c) => c.itemId === id)
    if (crop) return crop.reqLevel
    const rec = [...Object.values(LATE_PROD).flat(), ...LATE_GEAR_RECIPES].find((r) => r.output?.itemId === id)
    if (rec) return rec.reqLevel
    const seed = LATE_SEED_SHOP.find((s) => s.itemId === id)
    if (seed) return LATE_CROPS[0].reqLevel // 种子按作物档
    return null
  }
  const bad = []
  for (const t of late) {
    for (const l of t.loot ?? []) {
      if (l.type === 'gold') { if (l.chance !== 0.7) bad.push(`${t.name}: 金币概率 ${l.chance} ≠ 0.7`); continue }
      if (!getItem(l.itemId)) bad.push(`${t.name}: 掉落物 ${l.itemId} 不存在`)
      if (![0.28, 0.35].includes(l.chance)) bad.push(`${t.name}: 概率 ${l.chance} 不在既有取值 {0.28,0.35} 内`)
      const il = lvlOf(l.itemId)
      if (il == null) bad.push(`${t.name}: ${l.itemId} 等级查不到（ITEM_LEVEL 与本批三张表都没有 ⇒ 无法判定是否超纲）`)
      else if (il > t.reqLevel + 5) bad.push(`${t.name}: ${l.itemId} Lv${il} > ${t.reqLevel}+5`)
    }
  }
  check('补档·探索', '扩展目标：Lv102~120 每 2 级一件 · 掉落物存在 · 概率沿用既有 {0.28/0.35/0.7} · 等级带 ≤ 目标+5',
    lvs === '102,104,106,108,110,112,114,116,118,120' && bad.length === 0, bad.slice(0, 4).join('; '))

  // 段位口径：`exploreSuccessChance(目标, 精通等级, 池 pp, 装备 pp)` —— 未练精通必须 0%、满配到 70%
  const bands = late.map((t) => exploreBandFactor(t.reqLevel))
  // ⚠️ 签名是 `(target, ctx)` 而不是位置参数（ctx: {masteryLevel, poolSuccessPP, gearPP}）
  const noGear = late.map((t) => exploreSuccessChance(t, { masteryLevel: 0, poolSuccessPP: 0, gearPP: 0 }))
  // ⚠️ `gearPP` 是**分数**（真实调用点 `ExplorationSkill.gearSuccessPP()` 做的是 `equippedStats.exploreSuccessPP / 100`），
  //    而 `poolSuccessPP` 传的是**百分点**（出口内部 `/100`）—— 两处单位不同是既有设计，照真实调用点传。
  const withGear = late.map((t) => exploreSuccessChance(t, { masteryLevel: 100, poolSuccessPP: 0, gearPP: 0.1 }))
  check('补档·探索', '段位口径不变：Lv102+ 系数恒 0（未练精通时成功率为 0）· 练满精通 + 满专属装备到 70%',
    bands.every((b) => b === 0) && noGear.every((v) => v === 0) && withGear.every((v) => Math.abs(v - 0.7) < 1e-9),
    `系数 ${[...new Set(bands)].join('/')} · 空配 ${[...new Set(noGear)].join('/')} · 满配 ${[...new Set(withGear)].join('/')}`)

  const missSrc = []
  for (const t of late) for (const l of t.loot ?? []) {
    if (l.type === 'gold') continue
    if (!(itemSources(l.itemId) ?? []).some((s) => s.includes('探索') && s.includes(t.name))) missSrc.push(`${t.name}→${l.itemId}`)
  }
  check('补档·探索', '每个扩展掉落物的图鉴来源都写了「探索「目标名」获得」（来源串由表派生，不是手抄）',
    missSrc.length === 0, missSrc.slice(0, 3).join('、'))

  // ⑤ 🔴 消费方接线是**副作用导入** ⇒ 漏接一个消费方不会被行为断言发现（反例 ④ 证实：把
  //    `spoilBalance` 的导入删掉，全套 CI 依然全绿）。所以这里做**静态**断言：
  //    凡是 import 了 `explorationTargets.js` 的 src 文件，都必须同时引用 `lateExplore`。
  //    （生成器自身 `scripts/gen/` 不算——它就是要看未扩展的表。）
  const consumers = []
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = `${dir}/${f.name}`
      if (f.isDirectory()) { if (!/node_modules|\.git/.test(fp)) walk(fp); continue }
      if (!/\.(js|vue|mjs)$/.test(f.name)) continue
      const src = fs.readFileSync(fp, 'utf8')
      if (/from '[^']*explorationTargets\.js'/.test(src)) consumers.push([fp.split('\\').join('/'), /lateExplore/.test(src)])
    }
  }
  walk('src')
  const missingWire = consumers.filter(([, ok]) => !ok).map(([f]) => f)
  check('补档·探索', `${consumers.length} 个消费方都显式导入了扩展模块（副作用导入漏接一处就是「读到的还是 200 条」）`,
    consumers.length >= 3 && missingWire.length === 0, missingWire.join('、'))
}

// ══════════ C76：制作类「练习」动作（2026-09-29，①-C）══════════
// 为什么有它：山海第 8~10 环的门槛是「该线精通总级数 = 卡数 × 100」= 每张卡 3750 次动作，而制作的动作原先只有
// `craft()`（每次扣料）⇒ 精通轴实际被**采集供料**限速（实测供料口径 9658 天 vs 队列口径 130.9 天，×74）。
// 练习把「练」与「做」解耦：不扣料、不产出、不给经验，只按动作次数涨精通 ⇒ 长线回到**动作轴**（不受倍率影响）。
// 五件事：① 语义（四项都不动、只涨精通）② 等级门（与 enqueue 同口径）③ 队列（标记、合并规则、tick 推进）
// ④ 事件（不许发 `skill:action`，否则掉进 bootstrap 的 default 分支刷「获得 X ×0」）⑤ 视图接线（静态）。
{
  setActivePinia(createPinia())
  const pr = usePlayerStore()
  pr.newGame()
  createSkillInstances(pr)
  const { CRAFT_QUEUE_INTERVAL_MS } = await import('../../src/game/skills/ProductionSkill.js') // 队列节奏（练习与之同源）
  const ck = getSkillInstance('cooking')
  const rec = ck.recipes.find((x) => x.reqLevel <= 5) ?? ck.recipes[0]

  // ① 语义：不扣料、不产出、不给经验、精通 +1
  pr.skills.cooking.level = 99
  const mats = Object.keys(rec.ingredients ?? {})
  // 🔴 先把材料**给足**：全为 0 时 `spendItem` 夹在 0（不会变负）⇒「不消耗材料」这条会**假绿**
  //    （反例 ① 就是这么被放过的：注入「练习也扣料」后计数照样不变）。给足料才测得出扣没扣。
  for (const k of mats) pr.inventory[k] = 100
  const snap = () => ({
    mats: mats.map((k) => pr.inventory[k] ?? 0).join(','),
    out: pr.inventory[rec.output.itemId] ?? 0,
    exp: pr.skills.cooking.exp ?? 0,
    m: ck.mastery[rec.id] ?? 0,
  })
  const b = snap()
  const res = ck.practice(rec)
  const a = snap()
  const need = countForMasteryLevel(100)
  check('练习', '返回值是 ok（等级够）', res === 'ok', String(res))
  check('练习', '🔴 不消耗材料（这是它存在的全部意义：把精通轴从资源轴上摘下来）', a.mats === b.mats, `${b.mats} → ${a.mats}`)
  check('练习', '🔴 不产出成品（不产出才不会冲击物价与材料价值链）', a.out === b.out, `${b.out} → ${a.out}`)
  check('练习', '🔴 不给经验（经验会绕过已标定的等级轴）', a.exp === b.exp, `${b.exp} → ${a.exp}`)
  check('练习', '精通 +1（长线靠的就是这个）', a.m === b.m + 1, `${b.m} → ${a.m}`)
  check('练习', '动作计数递增（与 craft 共用 actionsDone，效率展示才有分母）', ck.actionsDone > 0, `actionsDone=${ck.actionsDone}`)

  // ② 等级门：与 enqueue 同口径（否则「练习」会变成绕过配方等级门槛的通道）
  const hi = [...ck.recipes].sort((x, y) => y.reqLevel - x.reqLevel)[0]
  pr.skills.cooking.level = 1
  check('练习', '等级不足的配方被拒（与 enqueue 的 level 校验同口径）', ck.practice(hi) === 'denied', `reqLevel=${hi.reqLevel} · level=1`)
  check('练习', '🔴 不存在的配方被拒（防脏存档里的假 recipe 空转）', ck.practice({ id: 'no_such_recipe', reqLevel: 1 }) === 'denied')

  // ③ 队列：标记、合并规则（同配方不同模式**不许合并**）、tick 真的按练习推进
  pr.skills.cooking.level = 99
  ck.clearQueue()
  const q0 = ck.enqueue(rec, 5, { practice: true })
  check('练习', '入队返回 ok 且条目带 practice 标记', q0.ok && pr.craftQueues.cooking[0].practice === true, JSON.stringify(pr.craftQueues.cooking))
  ck.enqueue(rec, 7, { practice: true })
  check('练习', '同配方同模式的条目会合并（和制作队列一致）', pr.craftQueues.cooking.length === 1 && pr.craftQueues.cooking[0].qty === 12, JSON.stringify(pr.craftQueues.cooking))
  ck.enqueue(rec, 3)
  check('练习', '🔴 同配方但**不同模式**不许合并（合并了会按先入队者的模式跑完全部，显示与结算直接对不上）',
    pr.craftQueues.cooking.length === 2 && pr.craftQueues.cooking[1].practice === undefined, JSON.stringify(pr.craftQueues.cooking))
  const mBefore = ck.mastery[rec.id] ?? 0
  const matBefore = mats.map((k) => pr.inventory[k] ?? 0).join(',')
  ck._queueAccum = 0
  ck.tick(CRAFT_QUEUE_INTERVAL_MS)
  check('练习', 'tick 推进练习条目（qty 递减）', pr.craftQueues.cooking[0].qty === 11, String(pr.craftQueues.cooking[0].qty))
  check('练习', 'tick 期间同样不扣料', mats.map((k) => pr.inventory[k] ?? 0).join(',') === matBefore, mats.map((k) => `${k}:${pr.inventory[k] ?? 0}`).join(' '))
  check('练习', 'tick 真的涨精通（不是只减队列计数）', (ck.mastery[rec.id] ?? 0) === mBefore + 1, `${mBefore} → ${ck.mastery[rec.id] ?? 0}`)
  // 材料不足不影响练习（这正是与 craft 的关键差别：craft 会 paused，practice 不会）
  ck.clearQueue()
  for (const k of mats) pr.inventory[k] = 0
  pr.craftQueues.cooking = []
  ck.enqueue(rec, 3, { practice: true })
  ck._queueAccum = 0
  ck.tick(CRAFT_QUEUE_INTERVAL_MS)
  check('练习', '🔴 材料为 0 也照常推进（craft 在这里会 paused —— 这就是「供料不再是精通瓶颈」的判据）',
    pr.craftQueues.cooking[0]?.qty === 2 && pr.craftQueues.cooking[0]?.paused !== true, JSON.stringify(pr.craftQueues.cooking))
  ck.clearQueue()

  // ④ 事件：练习**不许**发 `skill:action`（bootstrap 的 switch 有个 default 分支会打印「获得 X ×0」，
  //    每 3 秒一行 ⇒ 日志会变成刷屏；而且成就/任务/赛季/奇遇都挂在 skill:action 上）
  const prodSrc = fs.readFileSync('src/game/skills/ProductionSkill.js', 'utf8')
  const practiceBody = prodSrc.slice(prodSrc.indexOf('  practice(recipe) {'), prodSrc.indexOf('/** 当前队列'))
  check('练习', '🔴 不发 `skill:action`（否则掉进日志 switch 的 default 分支刷「获得 X ×0」，并可能被成就/任务/奇遇误计）',
    !/EventBus\.emit\(\s*'skill:action'/.test(practiceBody) && /EventBus\.emit\(\s*'skill:practice'/.test(practiceBody))
  const bootSrc = fs.readFileSync('src/game/bootstrap.js', 'utf8')
  check('练习', '全项目没有任何 `skill:action` 的 outcome 用 practice（同样的原因；要接就接 skill:practice）',
    !/outcome:\s*'practice'/.test(prodSrc) && !/outcome:\s*'practice'/.test(bootSrc))

  // ⑤ 视图接线（静态）：按钮 → openPractice → 弹窗 → practiceAdd(..., { practice: true })
  const viewSrc = fs.readFileSync('src/views/ProductionView.vue', 'utf8')
  check('练习', '卡片上有入口按钮且绑到 openPractice', /@click="openPractice\(r\)"/.test(viewSrc))
  check('练习', '弹窗确认按模式分派到 practiceAdd（漏了这一步按钮就成了摆设）',
    /qtyMode\.value === 'practice'/.test(viewSrc) && /enqueue\(r, n, \{ practice: true \}\)/.test(viewSrc))
  check('练习', '练习不走 canAfford（这正是它与制作的区别；加了就回到「必须囤料才能练」）',
    !/function openPractice\(r\) \{[\s\S]{0,120}?canAfford/.test(viewSrc))
  // 🔴 「练满 = 到精通 100」而不是「到下一档」：线上核验时弹窗写着「练满 8 次」而实际要 3750 次
  //    ⇒ 用了 `masteryProgress()` 那对（「x/y 次」是**到下一档**的进度）。判据两条：
  //    ① 算的是 `countForMasteryLevel(MASTERY_LEVEL_CAP) − 该卡已累计次数`；② **不许**再出现 `prog.needed − prog.current`。
  const practiceLeftBody = viewSrc.slice(viewSrc.indexOf('function practiceLeft('), viewSrc.indexOf('function practiceHours('))
  check('练习', '🔴 弹窗上限 = 到**精通 100** 还差的次数（不是到下一档；用 masteryProgress 会少报几十倍）',
    /countForMasteryLevel\(MASTERY_LEVEL_CAP\)/.test(practiceLeftBody) &&
      !/prog\.needed\s*-\s*prog\.current/.test(practiceLeftBody) &&
      /const cur = props\.instance\.mastery\?\.\[r\.id\]/.test(practiceLeftBody))
  check('练习', '弹窗标题写明「到精通 100 还差 N 次」（文案与上面的口径一致）',
    /到精通 100 还差 \$\{n\} 次/.test(viewSrc))
  check('练习', '队列条目在界面上有区分标记（否则「练习 ×100」与「制作 ×100」长得一样）',
    // ⚠️ 只查 `queue-tag` 文本存在是**假绿**（反例 ⑫ 证实：给标签挂 `v-if="false"` 让它永不渲染，照样全绿；
    //    而 CSS 里也有 `.queue-tag` 这个类名，纯文本匹配更弱）⇒ 连**元素本身**与它的条件一起钉。
    /v-if="e\.practice"[\s\S]{0,40}?class="queue-tag"/.test(viewSrc) && !/v-if="false"[\s\S]{0,40}?queue-tag/.test(viewSrc))
  check('练习', '队列暂停文案按模式分流（练习不可能因材料停 ⇒ 说「材料不足」就是假话）',
    /e\.practice \? '⚠ 等级不足，暂停中' : '⚠ 材料不足，暂停中'/.test(viewSrc))
  const aeSrc = fs.readFileSync('src/game/data/activeEffects.js', 'utf8')
  check('练习', '「制作队列暂停」的效果总览也分流（否则会把练习说成「材料不足」）',
    /practice === true/.test(aeSrc.slice(aeSrc.indexOf("id: 'productionQueue'"), aeSrc.indexOf("id: 'productionQueue'") + 900)))
}

// ══════════ C77：山海「线级门槛缩放」（2026-09-29，②-A）══════════
// 稼穑线的「一张卡」= 3750 次收获 ÷ 地块数 × 生长秒数（10~65 小时），是其它线的 10~20 倍量纲 ⇒
// 不缩放的话全树天花板由它一条线决定（实测 151.2 天 vs 第二名 40.2 天）。缩放表 = { farm: 0.5 }（量出来的，
// 见生成器注释：前 100 张 = 43.2 天，与锻造 40.2 天齐平）。
{
  const { SHANHAI_NODES, SHANHAI_PATHS, SHANHAI_PATH_MASTERY_SCALE } = await import('../../src/game/data/shanhaiTree.js')
  const { shanhaiNodeState, shanhaiPathMasteryMax } = await import('../../src/game/data/shanhaiProgress.js')
  const farmSkill = 'farming'
  // 只取**分支环**（`gap == null`）：汇金（空隙）节点的 `req.skill` 记的是两侧里 a 侧那个，
  // 其中 `稼穑·烹煮` 那 3 个空隙节点的 skill 就是 farming —— 不排除的话会把它们算进来（18 而不是 15）。
  const farmNodes = SHANHAI_NODES.filter((n) => n.gap == null && n.req?.skill === farmSkill && n.ring >= 8)
  const want = { 8: 0.3, 9: 0.4, 10: 0.5 }
  const bad = farmNodes.filter((n) => Math.abs((n.req?.masteryPct ?? 0) - want[n.ring]) > 1e-9)
  check('山海缩放', `稼穑线第 8~10 环的比例 = 基准 × 0.5（${farmNodes.length} 个节点）`, farmNodes.length === 15 && bad.length === 0,
    bad.slice(0, 3).map((n) => `${n.id}:${n.req?.masteryPct}`).join(', '))
  check('山海缩放', '其它 11 条线**不变**（只允许稼穑在表里，防「顺手放松别条线」）',
    Object.keys(SHANHAI_PATH_MASTERY_SCALE).length === 1 && SHANHAI_PATH_MASTERY_SCALE.farm === 0.5,
    JSON.stringify(SHANHAI_PATH_MASTERY_SCALE))
  // 行为断言：精通总级数达到「缩放后的门槛」时该节点真的可点（且未达标时不可点）——
  // 判据取**读取点现算**的 needMastery（`shanhaiNodeState`），不手抄一遍公式。
  // ⚠️ 广度是**派生值 + 模块级缓存**（`_breadthLevelSum`，`newGame()`/`applySave()` 清空）⇒
  //    两次测量之间必须重开一档，否则第二次读到的还是第一次缓存的 total（会得到假绿/假红）。
  const path = SHANHAI_PATHS.find((x) => x.skill === farmSkill)
  const node = SHANHAI_NODES.find((n) => n.path === path.id && n.ring === 10)
  const buildPlayerWithLevels = (total) => {
    setActivePinia(createPinia())
    const pp = usePlayerStore()
    pp.newGame() // 清空广度缓存
    createSkillInstances(pp)
    let left = total
    let i = 0
    pp.skills[farmSkill].mastery = {}
    while (left > 0) {
      const lv = Math.min(100, left)
      pp.skills[farmSkill].mastery[`c${i}`] = countForMasteryLevel(lv)
      left -= lv
      i++
    }
    return pp
  }
  const maxLevels = shanhaiPathMasteryMax(buildPlayerWithLevels(0), path.id)
  const needLevels = Math.ceil(maxLevels * 0.5)
  const under = shanhaiNodeState(node, buildPlayerWithLevels(needLevels - 1), [])
  const over = shanhaiNodeState(node, buildPlayerWithLevels(needLevels), [])
  // 判据用 `reason`：**门槛满足与否只体现在这里**（`can` 还要收集件数/等级，这个合成玩家都没有）⇒
  // 「未达标时缺精通、达标后不再缺精通」正好隔离出精通这一维。
  check('山海缩放', '行为：精通总级数未达缩放后门槛时「精通」出现在缺失清单里、达到后不再出现',
    /精通总级数/.test(String(under.reason)) && !/精通总级数/.test(String(over.reason)),
    `under=${under.reason} · over=${over.reason}`)
  check('山海缩放', '门槛文案里印的是**缩放后**的百分比（玩家看到的 50% 与结算一致）',
    /50%/.test(String(node.desc)) && /50%/.test(String(under.reason ?? '')) && /10,050|10050/.test(String(under.reason ?? '')),
    String(under.reason ?? node.desc).slice(0, 110))
}

// ══════════ C78：制作队列「追赶」+ 日志合并（2026-09-29，B1）══════════
// 起因：`deltaMs` 是真实时间，而浏览器会把后台标签页的定时器降速（Chrome 后台 1s、intensive 时 1min）
// ⇒ 旧写法「每次调用只做 1 次 + 累加器清零」在被降速时慢 20 倍（采集/探索用 while 追赶，没这个问题）。
// 同时：批量/追赶会连做几十~几百次，逐次 pushLog 会把 500 条容量的日志刷爆（一次 999 份 = 999 行）。
{
  setActivePinia(createPinia())
  const pr = usePlayerStore()
  const { useUiStore } = await import('../../src/stores/ui.js')
  const ui = useUiStore()
  pr.newGame()
  createSkillInstances(pr)
  const ck = getSkillInstance('cooking')
  pr.skills.cooking.level = 99
  const rec = ck.recipes.find((x) => x.reqLevel <= 5) ?? ck.recipes[0]
  const { CRAFT_QUEUE_INTERVAL_MS: Q, CRAFT_CATCHUP_MAX: CAP } = await import('../../src/game/skills/ProductionSkill.js')
  const mOf = () => ck.mastery[rec.id] ?? 0
  /** 排一批练习（不耗料，最适合量「做了几次」）+ 清空累积器 */
  const queuePractice = (n) => { ck.clearQueue(); ck._queueAccum = 0; ck.enqueue(rec, n, { practice: true }) }

  check('追赶', `追赶上限 = 300，且与采集那个上限同口径（GatheringSkill 里也是 300）`, CAP === 300 &&
    /guard\+\+ < 300/.test(fs.readFileSync('src/game/skills/GatheringSkill.js', 'utf8')), `CAP=${CAP}`)

  // ① 一次心跳给 90 秒 ⇒ 应把 30 次全部做掉（旧写法只做 1 次）
  queuePractice(50)
  ck.tick(90_000)
  check('追赶', '一次心跳给 90 秒 ⇒ 连做 30 次（旧写法只做 1 次，这就是「后台慢 20 倍」的根因）',
    mOf() === 30, `实际 ${mOf()} 次`)

  // ② 超过上限 ⇒ 只做 CAP 次，且积压清零（与采集同口径：撞上限就丢弃余量，不无限囤积）
  queuePractice(5000)
  const baseCap = mOf() // ⚠️ 精通次数是**累计值**（上面的用例已经加过），必须比增量
  ck.tick(1_200_000) // 20 分钟 ⇒ 理论 400 次
  check('追赶', `积压 20 分钟 ⇒ 只做 ${CAP} 次（上限保护），且不把积压留到下一次心跳`,
    mOf() - baseCap === CAP && ck._queueAccum === 0, `实际 ${mOf() - baseCap} 次 · 余量 ${ck._queueAccum}`)
  ck.tick(3000)
  check('追赶', '撞上限后的下一次心跳不该爆发（余量已清零 ⇒ 正常 3 秒 1 次）', mOf() - baseCap === CAP + 1, `实际 ${mOf() - baseCap}`)

  // ③ 余数必须保留：3.0+3.0+4.5+1.5 秒 应正好 4 次（旧写法每次清零会白丢最多 100ms ⇒ 实际 3.0~3.1s/件）
  queuePractice(10)
  const t0 = mOf()
  ck.tick(Q); ck.tick(Q); ck.tick(Q + 1500); ck.tick(1500)
  check('追赶', '按段扣减、余数保留（4.5 秒 + 1.5 秒 要正好再做 1 次，不能白丢余量）',
    mOf() - t0 === 4, `实际 ${mOf() - t0} 次`)

  // ④ 材料不足：暂停 + **不囤积时间**（否则补料后会一次性爆发几十次）
  //    ⚠️ 两处清零都要测（反例 ⑤ 首版只注入了「暂停中早退」那处 ⇒ 我的用例只 tick 一次、走的是
  //    `denied` 分支 ⇒ 注入无效却全绿）：① denied 那一刻清零 ② 之后**继续暂停**时也不许囤积。
  ck.clearQueue()
  ck._queueAccum = 0
  const mats = Object.keys(rec.ingredients ?? {})
  for (const k of mats) pr.inventory[k] = 0
  ck.enqueue(rec, 5) // 制作（不是练习）⇒ 无料必 denied
  ck.tick(600_000) // 10 分钟积压 + 无料
  const paused = pr.craftQueues.cooking[0]?.paused === true
  const accumAtPause = ck._queueAccum
  check('追赶', '🔴 材料不足停下的那一刻清空积压（否则补料后会一次性爆发几十次）',
    paused && accumAtPause === 0, `paused=${paused} · 余量=${accumAtPause}`)
  ck.tick(600_000) // 仍暂停：再给 10 分钟
  const accumStillPaused = ck._queueAccum
  check('追赶', '🔴 暂停期间继续心跳也不许囤积（第二条防线）', accumStillPaused === 0, `余量=${accumStillPaused}`)
  for (const k of mats) pr.inventory[k] = 999
  ck.resumeQueue()
  ck.tick(Q)
  check('追赶', '恢复后第一次心跳只推进 1 次（5 次的条目应剩 4）', pr.craftQueues.cooking[0]?.qty === 4, String(pr.craftQueues.cooking[0]?.qty))
  ck.clearQueue()

  // ⑤ 日志合并（B1 的另一半）：同键连续 ⇒ 一行且经验累加；换配方 / 超窗口 ⇒ 另起一行
  ui.log = []
  for (let i = 0; i < 12; i++) ui.pushOrMergeLog('烹饪：制作成功 白米饭 ×2', 'gain', 'craft|cooking|r1', { exp: 120 })
  check('日志合并', '同键连续 12 次 ⇒ 只剩 1 行，且经验**累加**（1440 而不是单次 120）',
    ui.log.length === 1 && /连续 ×12/.test(ui.log[0].message) && /\+1440 经验/.test(ui.log[0].message),
    JSON.stringify(ui.log.map((l) => l.message)))
  ui.pushOrMergeLog('烹饪：制作成功 青菜 ×1', 'gain', 'craft|cooking|r2', { exp: 40 })
  check('日志合并', '换配方（键不同）⇒ 另起一行', ui.log.length === 2, String(ui.log.length))
  ui.log = []
  ui.pushOrMergeLog('x', 'info', 'same', { exp: 5, windowMs: 1 })
  await new Promise((r) => setTimeout(r, 25))
  ui.pushOrMergeLog('x', 'info', 'same', { exp: 5, windowMs: 1 })
  check('日志合并', '超出合并窗口 ⇒ 不把很久以前的记录续上（两行）', ui.log.length === 2, String(ui.log.length))
  ui.log = []
  ui.pushLog('普通日志', 'info')
  check('日志合并', '普通日志（不带键）不受影响，仍是原样一行', ui.log.length === 1 && ui.log[0].mergeKey === undefined)
  const bootSrc2 = fs.readFileSync('src/game/bootstrap.js', 'utf8')
  check('日志合并', '🔴 bootstrap 的制作/练习分支走合并出口（退回 pushLog 就会把日志刷爆）',
    /isCraft\b[\s\S]{0,200}pushOrMergeLog/.test(bootSrc2) && /outcome === 'craft' \|\| outcome === 'craftfail'/.test(bootSrc2))
}

// ══════════ C79：农田基础产出件数（2026-09-29，A1）══════════
// 起因：制作线的原料 76%~97% 来自农田（采集只占小头），而农田产能 = 地块数 ÷ 生长秒数、**一块地一轮只出 1 件**
// ⇒ 逐条线实测「供料时间是队列时间的 ×6.3~×36.6（合计 ×15.8）」。把基础件数 1 → 2 ⇒ 农田那一半直接减半。
// ⚠️ 刻意**不动地块数**（那会连带加快农耕自己的精通轴，而它刚按 ×0.5 缩放到与锻造齐平）也**不动 growSec**
//    （`content_sync_audit` 有 growSec 合计 80020 的冻结基线，且它是材料成本系数的输入）。
{
  setActivePinia(createPinia())
  const pr = usePlayerStore()
  pr.newGame()
  createSkillInstances(pr)
  const farm = getSkillInstance('farming')
  pr.skills.farming.level = 99
  // ⚠️ 名字里**不要插值**当前值（`基础件数常数 = ${FARM_BASE_YIELD}`）：被注入时名字会跟着变，
  //    反例脚本按名字点名就点不到（本轮 ① 就是这么漏的）——动态数字放 detail，名字要稳定。
  check('农田产出', '基础件数常数 = 2（>1 才有效；=1 即关掉这条改动）',
    FARM_BASE_YIELD === 2, `实际 ${FARM_BASE_YIELD}`)
  // 行为：走真实 harvest，无肥料、无精通、天气/当季都不加成 ⇒ 正好 FARM_BASE_YIELD 件
  const crop = CROPS.find((c) => c.itemId === 'wheat') ?? CROPS[0]
  pr.inventory[crop.seedId] = 1
  farm.plant(0, crop.seedId)
  pr.farming.plots[0].plantedAt = Date.now() - 3600_000
  pr.weatherEffects = () => ({ farmYield: 1 })
  const before = pr.inventory[crop.itemId] ?? 0
  withRandom([0.99, 0.99, 0.99, 0.99], () => farm.harvest(0))
  const got = (pr.inventory[crop.itemId] ?? 0) - before
  const mult = seasonalCropBonus(getItem(crop.itemId)?.category ?? '')
  check('农田产出', `一次收获实际产出 = ${FARM_BASE_YIELD} × 当季(${mult}) 件（真实 harvest，无肥/无精通）`,
    got === Math.max(1, Math.round(FARM_BASE_YIELD * mult)), `实际 ${got} 件`)
  // 静态：产出式读的是常数而不是字面量 1（有人改回去时立刻响）
  const farmSrc = fs.readFileSync('src/game/skills/FarmingSkill.js', 'utf8')
  check('农田产出', '`harvest()` 的件数式用 FARM_BASE_YIELD（不是字面量 1）',
    /let qty = FARM_BASE_YIELD \+/.test(farmSrc) && !/let qty = 1 \+/.test(farmSrc))
  // 展示同源：农耕卡片的「每次收获期望件数 / 件每分钟」必须也带这个常数
  const viewSrc = fs.readFileSync('src/views/FarmingView.vue', 'utf8')
  check('农田产出', '🔴 农耕页的「期望件数」也读同一个常数（否则卡片写着 1 件、实际 2 件）',
    /const base = FARM_BASE_YIELD \+ masteryYieldBonus/.test(viewSrc) && !/const base = 1 \+ masteryYieldBonus/.test(viewSrc))
}

// ── C80（2026-09-29）：离线基础时长按「最高技能等级」分档 ────────────────────────
// 起因：成长平衡体检量出 **Lv101-120 吃掉 86% 的经验却只有 6% 的内容**（内容/时间 = 0.40）
// ⇒ 末 20 级「最长、也最空」。补内容要美术，这条是**零美术**的补法：每 5 级给一段
// **看得见、每天都能感觉到**的奖励（离线结算窗口 12h → 20h），且**只抬窗口、不动任何数值乘区**
// ⇒ 它是「更方便」而不是「更强」，不会位移任何已标定的时长。
// 见 `docs/成长平衡体检-2026-09-29.md` §8 的方案 1-A。
{
  const off = (lv) => offlineBaseHoursForLevel(lv)
  const AE_SRC = fs.readFileSync(new URL('../../src/game/data/activeEffects.js', import.meta.url), 'utf8')
  check('离线分档', '档位表：等级严格递增、小时数单调不减、终点 20h',
    (() => {
      let prevH = 0
      for (const s of OFFLINE_LEVEL_STEPS) { if (!(s.hours >= prevH)) return false; prevH = s.hours }
      return OFFLINE_LEVEL_STEPS.length === 5
        && OFFLINE_LEVEL_STEPS.every((s, i, a) => i === 0 || s.level > a[i - 1].level)
        && OFFLINE_LEVEL_STEPS[0].level === 100
        && OFFLINE_LEVEL_STEPS[OFFLINE_LEVEL_STEPS.length - 1].hours === 20
    })(), `实际 ${OFFLINE_LEVEL_STEPS.map((s) => `Lv${s.level}:${s.hours}`).join(' ')}`)
  // 🔴 这条是「不是无差别加强」的防线：新档玩家的成长速度必须一字不改
  check('离线分档', '🔴 早期不动：Lv1~99 全部等于 baseHours（新档零加成）',
    (() => { for (let lv = 1; lv <= 99; lv++) if (off(lv) !== OFFLINE_CAP.baseHours) return false; return true })(),
    `Lv50=${off(50)} Lv99=${off(99)} base=${OFFLINE_CAP.baseHours}`)
  check('离线分档', '边界：99=12 / 100=13 / 104=13 / 105=14 / 110=16 / 115=18 / 119=18 / 120=20',
    off(99) === 12 && off(100) === 13 && off(104) === 13 && off(105) === 14 && off(110) === 16
    && off(115) === 18 && off(119) === 18 && off(120) === 20,
    `${off(99)} ${off(100)} ${off(104)} ${off(105)} ${off(110)} ${off(115)} ${off(119)} ${off(120)}`)
  check('离线分档', '全区间单调不减（枚举 1~140）',
    (() => { let prev = 0; for (let lv = 1; lv <= 140; lv++) { const h = off(lv); if (h < prev) return false; prev = h } return true })())
  check('离线分档', '非法输入回退到 baseHours（null / 空串 / NaN / 负数 / 非数字）',
    off(null) === OFFLINE_CAP.baseHours && off('') === OFFLINE_CAP.baseHours && off(NaN) === OFFLINE_CAP.baseHours
    && off(-5) === OFFLINE_CAP.baseHours && off('abc') === OFFLINE_CAP.baseHours && off(undefined) === OFFLINE_CAP.baseHours,
    `${off(null)} ${off('')} ${off(NaN)} ${off(-5)} ${off('abc')}`)
  check('离线分档', '字符串等级按数字处理（存档里是字符串也不误判）', off('120') === 20 && off('105') === 14, `${off('120')} ${off('105')}`)
  // 行为断言：走真实 store，确认唯一出口真的用了派生基础
  check('离线分档', '唯一出口：120 级玩家的 offlineMaxHours = 派生基础 + 三段加成',
    (() => {
      const p = freshPlayer({ foraging: 120 })
      p.offlineBonusH = OFFLINE_CAP.biscuitMaxHours
      const expect = 20 + OFFLINE_CAP.biscuitMaxHours
      return p.offlineBaseHours() === 20 && p.offlineMaxHours() === expect
    })(), (() => { const p = freshPlayer({ foraging: 120 }); return `base=${p.offlineBaseHours()} 总=${p.offlineMaxHours()}` })())
  check('离线分档', '新档（Lv1）的上限与改动前逐值相同（12 + 饼干）',
    (() => {
      const p = freshPlayer()
      p.offlineBonusH = OFFLINE_CAP.biscuitMaxHours
      return p.offlineBaseHours() === OFFLINE_CAP.baseHours && p.offlineMaxHours() === 24
    })(), (() => { const p = freshPlayer(); return `base=${p.offlineBaseHours()} 总=${p.offlineMaxHours()}` })())
  // 🔴 显示同源：效果总览那一行的「基础 N」必须是派生值（写死 12 就是显示/结算不一致）
  // ⚠️ 两个分支都要测：`off()` 把说明放在 **`why`**（`text` 恒为 '—'），`on` 分支才放在 `text`
  //    —— 首版只读 `text` ⇒ 断言在 off 分支上**永远是假绿/假红**（实测就是这么红的）。
  check('离线分档', '🔴 显示同源：效果总览那行的「基础」随等级走（on / off 两个分支都测）',
    (() => {
      const def = EFFECT_ROWS.find((e) => e.id === 'offlineHours')
      if (!def) return false
      const p = freshPlayer({ foraging: 120 })
      const r1 = def.read(p) // 无加成 → off 分支（说明在 why）
      const offShown = `${r1?.text ?? ''} ${r1?.why ?? ''}`
      p.offlineBonusH = OFFLINE_CAP.biscuitMaxHours // 有加成 → on 分支（说明在 text）
      const onShown = String(def.read(p)?.text ?? '')
      return offShown.includes('基础 20') && !offShown.includes('基础 12')
        && onShown.includes('基础 20') && !onShown.includes('基础 12')
    })(), (() => {
      const def = EFFECT_ROWS.find((e) => e.id === 'offlineHours')
      if (!def) return '(没找到效果行)'
      const p = freshPlayer({ foraging: 120 })
      const r1 = def.read(p)
      p.offlineBonusH = OFFLINE_CAP.biscuitMaxHours
      const r2 = def.read(p)
      return `off.why=${String(r1?.why).slice(0, 40)} | on.text=${String(r2?.text).slice(0, 40)}`
    })())
  check('离线分档', '静态：activeEffects 不拿 OFFLINE_CAP.baseHours 当「基础」直接显示',
    !/parts = \[`基础 \$\{OFFLINE_CAP\.baseHours\}`\]/.test(AE_SRC) && /offlineBaseHours\?\.\(\)/.test(AE_SRC))
  // 攻略文案也要跟着（audit_sync 只钉「含 12h/80%」，不改口径就会写成假话）
  check('离线分档', '攻略写明基础随等级抬升（不是写死 12h）',
    /基础随你的最高技能等级抬升/.test(fs.readFileSync('src/game/data/guide.js', 'utf8')))
}

// ── C81（2026-09-30）：食材保鲜 Ⅵ/Ⅶ 阶（成长平衡体检 §9.1 的 5-A / T1）────────────
// 目的：把**全站最疏的一条线**（8 个内容点、末件 Lv85、Lv86→120 空 35 级）铺到 Lv120。
// 🔴 本组的**核心防线是「乘数不许抬」**：Ⅵ/Ⅶ 只加时长 —— 抬乘数会让体检的四档矩阵
//    与「叠区二级饱和」（`XP_SPEEDUP_CAP_BANDS` ×6/×10/×14）的标定一起作废。
{
  const { PRESERVE_TIER_ITEMS } = await import('../../src/game/data/preserveTiers.js')
  const { PRESERVE_TIER_EXT_ITEMS, PRESERVE_TIER_EXT_RECIPES } = await import('../../src/game/data/preserveTiersExt.js')
  const { PRESERVATION_RECIPES } = await import('../../src/game/skills/PreservationSkill.js')

  check('保鲜Ⅵ/Ⅶ', '6 件新物品都在 ITEMS 里（3 系列 × Ⅵ/Ⅶ，id 与名称逐字对上）',
    PRESERVE_TIER_EXT_ITEMS.length === 6 && PRESERVE_TIER_EXT_ITEMS.every((it) => getItem(it.id)?.name === it.name),
    PRESERVE_TIER_EXT_ITEMS.map((x) => x.id).join(','))

  check('保鲜Ⅵ/Ⅶ', '配方等级 = Lv105 / Lv120（把 Lv86→120 那 35 级空白切成两段）',
    PRESERVE_TIER_EXT_RECIPES.length === 6 && PRESERVE_TIER_EXT_RECIPES.every((r, i) => r.reqLevel === (i % 2 === 0 ? 105 : 120)),
    PRESERVE_TIER_EXT_RECIPES.map((r) => r.reqLevel).join(','))

  // 🔴 核心防线：乘数**不许再抬**（Ⅵ/Ⅶ 只能加时长）
  const capXp = PRESERVE_TIER_ITEMS.find((x) => x.id === 'xpTonic5')?.use?.buffXp?.mult
  const capYield = PRESERVE_TIER_ITEMS.find((x) => x.id === 'yieldTonic5')?.use?.buffYield?.mult
  check('保鲜Ⅵ/Ⅶ', `🔴 增益剂的乘数没有抬高（Ⅵ/Ⅶ 都 ≤ Ⅴ 阶的 ×${capXp}；抬了四档矩阵与叠区标定一起作废）`,
    [['xpTonic6', 'buffXp', capXp], ['xpTonic7', 'buffXp', capXp], ['yieldTonic6', 'buffYield', capYield], ['yieldTonic7', 'buffYield', capYield]]
      .every(([id, key, cap]) => (getItem(id)?.use?.[key]?.mult ?? Infinity) <= cap),
    `xp: Ⅴ=${capXp} Ⅵ=${getItem('xpTonic6')?.use?.buffXp?.mult} Ⅶ=${getItem('xpTonic7')?.use?.buffXp?.mult}｜产: Ⅴ=${capYield}`)

  check('保鲜Ⅵ/Ⅶ', '🔴 时长逐阶严格递增（经验/产量 Ⅰ<…<Ⅶ 分钟数；保鲜剂 Ⅰ<…<Ⅶ 刷新毫秒数）',
    (() => {
      const mins = ['xpTonic', 'yieldTonic'].map((s) => [1, 2, 3, 4, 5, 6, 7].map((n) => getItem(`${s}${n}`)?.use?.[s === 'xpTonic' ? 'buffXp' : 'buffYield']?.minutes))
      const spoil = [1, 2, 3, 4, 5, 6, 7].map((n) => getItem(`preservTier${n}`)?.use?.refreshSpoilMs)
      return [...mins, spoil].every((arr) => arr.every((v, i) => i === 0 || v > arr[i - 1]))
    })(),
    (() => { const c = [1, 2, 3, 4, 5, 6, 7].map((n) => getItem(`xpTonic${n}`)?.use?.buffXp?.minutes); return `xp 分钟 ${c.join(' ')}` })())

  check('保鲜Ⅵ/Ⅶ', '材料等级 ≤ 配方等级 + 5（对它们是恒等变换，不会被 raiseRecipeLevels 悄悄改写）',
    PRESERVE_TIER_EXT_RECIPES.every((r) => Object.keys(r.ingredients ?? {}).every((m) => { const lv = materialLevelOf(m); return lv == null || lv <= r.reqLevel + 5 })),
    PRESERVE_TIER_EXT_RECIPES.map((r) => `${r.id}:${Object.keys(r.ingredients ?? {}).join('+')}`).join(' '))

  // 🔴 「只写在数据里、没人用」= 静默失效（pickles.js 的历史前科）：必须并进被消费的那张表
  check('保鲜Ⅵ/Ⅶ', '🔴 新配方并进了 `PRESERVATION_RECIPES` 本身（图鉴来源/价值/材料平衡都读它）',
    PRESERVE_TIER_EXT_RECIPES.every((r) => PRESERVATION_RECIPES.some((x) => x.id === r.id && x.reqLevel === r.reqLevel)),
    `表内 ${PRESERVATION_RECIPES.length} 条`)

  // 行为断言（真实引擎）：Ⅵ 的乘区与时长都要真的生效，且比 Ⅴ 更长
  check('保鲜Ⅵ/Ⅶ', '行为：使用 Ⅵ 得 ×4.5 且时长比 Ⅴ 更长（Ⅴ=195 分 / Ⅵ=260 分）',
    (() => {
      const a = freshPlayer(); a.inventory.xpTonic5 = 1; a.useConsumable('xpTonic5')
      const b = freshPlayer(); b.inventory.xpTonic6 = 1; b.useConsumable('xpTonic6')
      const ra = (a.buffs.xpMult?.expiresAt ?? 0) - Date.now()
      const rb = (b.buffs.xpMult?.expiresAt ?? 0) - Date.now()
      return b.buffs.xpMult?.mult === 4.5 && rb > ra + 60_000
    })())
}

// ── C82（2026-09-30）：挂机产线 Lv105/115 两档（成长平衡体检 §9.1 的 1-A ④ / T2）─────
// 目的：体检量出「材料真实供给 224 天 > 等级轴 19 天」⇒ 后期瓶颈是**供料**。
//   这四类产线**不占并行槽**（与农耕同理），加档是**纯增量供给**。
// 设计口径：优先用**已有物品**（产物/饲料都是已存在物品）；只有灵田的两味「稀有种子」必须新增
//   （既有种子最高 Lv99），而**种子不配图** ⇒ 仍是零美术。
{
  const { SPIRIT_PLANTS } = await import('../../src/game/data/spiritField.js')
  const { MUSHROOM_MEDIA } = await import('../../src/game/data/mushroomHouse.js')
  const { HIVE_MEDIA, hiveMediaLevel } = await import('../../src/game/data/greenhouse.js')
  const { RANCH_ANIMALS } = await import('../../src/game/data/ranch.js')
  const { GOODS_ITEMS } = await import('../../src/game/data/processedGoods.js')
  const { SPIRIT_FIELD_SEEDS, SPIRIT_FIELD_SEED_SHOP } = await import('../../src/game/data/spiritFieldSeeds.js')
  const { SHOP_ITEMS } = await import('../../src/game/data/shop.js')
  const { honeyTierForLevel, HONEY_TIERS } = await import('../../src/game/data/honey.js')

  const newPlants = SPIRIT_PLANTS.filter((p) => p.reqLevel >= 100)
  check('产线末段', '灵田新档：reqLevel 严格递增（85 < 105 < 115），两档',
    newPlants.length === 2 && newPlants[0].reqLevel === 105 && newPlants[1].reqLevel === 115,
    newPlants.map((p) => `${p.id}:Lv${p.reqLevel}`).join(' '))

  const newAnimals = RANCH_ANIMALS.filter((a) => (a.cost ?? 0) >= 100000)
  const newBeds = MUSHROOM_MEDIA.filter((m) => (m.cost ?? 0) >= 60000)
  const newHives = HIVE_MEDIA.slice(-2)
  check('产线末段', '四类都各加了 2 档（灵田 / 牧场 / 菌房 / 蜂箱）',
    newPlants.length === 2 && newAnimals.length === 2 && newBeds.length === 2 && newHives.length === 2,
    `灵田${newPlants.length} 牧场${newAnimals.length} 菌房${newBeds.length} 蜂箱${newHives.length}`)

  check('产线末段', '所有新档的产物 / 饲料 id 都存在（无幽灵物品）',
    [...newPlants.map((p) => [...Object.keys(p.products ?? {}), p.seedId]), ...newAnimals.map((a) => [...Object.keys(a.products ?? {}), ...Object.keys(a.feed ?? {})]), ...newBeds.map((m) => [...Object.keys(m.products ?? {}), ...Object.keys(m.feed ?? {})]), ...newHives.map((h) => [...Object.keys(h.feed ?? {})])]
      .every((ids) => ids.every((id) => !!getItem(id))))

  check('产线末段', '所有新档的周期（hours）都 > 0',
    [...newPlants, ...newAnimals, ...newBeds, ...newHives].every((x) => Number(x.hours) > 0))

  check('产线末段', '牧场新动物各含 ≥1 件加工品（沿用既有断言的同一口径）',
    newAnimals.every((a) => Object.keys(a.products ?? {}).some((id) => GOODS_ITEMS.some((g) => g.id === id))),
    newAnimals.map((a) => a.id).join(','))

  check('产线末段', '蜂箱新档产**最高品**蜂蜜（`hiveMediaLevel` 由饲料作物等级派生，8 品甜）',
    newHives.every((h) => honeyTierForLevel(hiveMediaLevel(h.id)) === HONEY_TIERS.length),
    newHives.map((h) => `${h.id}→${honeyTierForLevel(hiveMediaLevel(h.id))}`).join(' '))

  // 🔴 灵田新档的种子必须「拿得到 + 看得懂」：ITEMS / SEED_MAP（附产）/ 商店 / 图鉴详情 四处齐备
  check('产线末段', '🔴 灵田新种子四处齐备：ITEMS + SEED_MAP（采摘/挖掘附产）+ 商店上架 + 图鉴「种植产物」行',
    SPIRIT_FIELD_SEEDS.every((sd) => !!getItem(sd.id) && sd.type === 'seed')
      && Object.values(SEED_MAP).some((v) => v === 'late_for_03Seed') && Object.values(SEED_MAP).some((v) => v === 'late_exc_02Seed')
      && SPIRIT_FIELD_SEED_SHOP.every((e) => SHOP_ITEMS.some((s) => s.itemId === e.itemId && s.price === e.price))
      && SPIRIT_FIELD_SEEDS.every((sd) => itemDetailLines(sd.id).some((l) => l[0] === '种植产物')),
    SPIRIT_FIELD_SEEDS.map((sd) => sd.id).join(','))

  // 行为断言（真实引擎）：用新种子真的能种下并收获
  check('产线末段', '行为：用新种子在灵田种下并收获（走真实引擎，产 2 件且自动续种）',
    (() => {
      const p = freshPlayer({ foraging: 120 })
      p.inventory.late_for_03Seed = 1
      if (p.spiritPlant(0, 'late_for_03Seed')?.ok !== true) return false
      p.spiritState().plots[0].readyAt = Date.now() - 1
      const r = p.spiritHarvest(0)
      return r?.ok === true && (r.got?.late_for_03 ?? 0) >= 2
    })())

  // 行为断言（真实引擎）：牧场新动物真的会把产物发到背包
  check('产线末段', '行为：牧场新动物（霜甲犀）按周期把产物发到背包',
    (() => {
      const p = freshPlayer({ farming: 120 })
      p.gold = 500000
      p.inventory.late_far_01 = 20
      if (p.ranchBuy(0, 'rhino')?.ok !== true) return false
      p.ranch.pens[0].lastAt = Date.now() - 24 * 3600e3
      p._tickRanch()
      return (p.inventory.late_hun_01 ?? 0) > 0 && (p.inventory.boneBroth ?? 0) > 0
    })())
}

// ── C83（2026-09-30）：副业「同物变体」（成长平衡体检 §7「不足 4」/ T3）────────────────
// 16 支副业各给**最高档产物（基底 Lv112）**加 ·精/·珍/·御（Lv114/117/120）⇒ 48 件。
// 本组钉的是**变体特有**的不变量（数量/加级/命名/图片/作品定义/独占类别/轴收益/价值同源）——
// 全量口径（223 件产物的计数、图片、价值、配方区间）由上面 C33 的既有组覆盖。
{
  const { SIDELINE_ITEMS, SIDELINE_WORKS, SIDELINE_ITEM_CATEGORIES, SIDELINE_RECIPES } = await import('../../src/game/data/sidelineWorks.js')
  const { VARIANT_SPECS, VARIANT_BASE_LEVEL, VARIANT_WOOD } = await import('../../src/game/data/sidelineVariants.js')
  const { WOODWORKING_ITEMS, WOODWORKING_RECIPES } = await import('../../src/game/data/woodworking.js')
  const { effIngredients } = await import('../../src/game/data/materialCost.js')

  const isVariant = (n) => typeof n === 'string' && /·(精|珍|御)$/.test(n)
  const sideV = SIDELINE_ITEMS.filter((it) => isVariant(it.name))
  const woodV = WOODWORKING_ITEMS.filter((it) => isVariant(it.name))

  check('副业变体', '变体共 48 件（15 支 ×3 + 木工 ×3），每件都有图片文件（缺图会被 @error 静默隐藏）',
    sideV.length === 45 && woodV.length === 3 && [...sideV, ...woodV].every((it) => imgExists(it.id)),
    `副业 ${sideV.length} + 木工 ${woodV.length}｜缺图 ${[...sideV, ...woodV].filter((it) => !imgExists(it.id)).map((i) => i.name).join('、')}`)

  check('副业变体', `等级 = 基底 Lv${VARIANT_BASE_LEVEL} +2/+5/+8 ⇒ Lv114/117/120（三档齐全、无第四个后缀）`,
    VARIANT_SPECS.map((v) => `${v.suffix}${VARIANT_BASE_LEVEL + v.delta}`).join(' ') === '·精114 ·珍117 ·御120'
    && Object.values(SIDELINE_RECIPES).flat().filter((r) => isVariant(r.name)).every((r) => [114, 117, 120].includes(r.reqLevel))
    && WOODWORKING_RECIPES.filter((r) => isVariant(r.name)).map((r) => r.reqLevel).join(',') === '114,117,120')

  check('副业变体', '每件变体都有作品定义（进作品面板、吃轴收益），且类别在「副业独占清单」里（5 个消费方自动排除）',
    sideV.every((it) => !!SIDELINE_WORKS[it.id] && SIDELINE_ITEM_CATEGORIES.includes(it.category))
    && woodV.every((it) => SIDELINE_ITEM_CATEGORIES.includes(it.category)),
    sideV.filter((it) => !SIDELINE_WORKS[it.id]).map((i) => i.id).join(','))

  // ⚠️ 不能写成「ingredients 里含 VARIANT_WOOD」——那是**拿常量自比自**（把常量改成错的也照样绿，
  //    反例 ③ 当场抓到这个假绿）。判据改成：变体用的木必须**与基底 Lv112 配方用的那根木材一致**。
  {
    const TIMBER_IDS = new Set([...TIMBERS.map((t) => t.id), 'late_wood_01', 'late_wood_02'])
    const woodOf = (list) => {
      const base = list.find((r) => r.reqLevel === VARIANT_BASE_LEVEL)
      return base ? (Object.keys(base.ingredients ?? {}).find((id) => TIMBER_IDS.has(id)) ?? null) : null
    }
    const badWood = Object.entries(SIDELINE_RECIPES).filter(([, list]) => {
      const w = woodOf(list)
      if (!w) return false
      return list.filter((r) => isVariant(r.name)).some((r) => !(w in (r.ingredients ?? {})))
    }).map(([k]) => k)
    check('副业变体', `变体用的木与基底 Lv${VARIANT_BASE_LEVEL} 配方一致（⇒ 材料 ≤ 配方 + 5，recipeBalance 恒等变换）`,
      badWood.length === 0, badWood.join(','))
  }

  // 行为断言（真实引擎）：变体做成作品的轴收益与基底一致；价值由 valueBalance 锚回材料
  check('副业变体', '行为：做成一件变体作品 ⇒ 该轴 +perItem（陶艺：地窖单槽上限 +1500）',
    (() => {
      const p = freshPlayer()
      const before = p.cellarSlotValueMax()
      p.inventory.pottery_114 = 1
      if (p.craftWork('pottery_114') !== 'ok') return false
      return p.cellarSlotValueMax() - before === 1500
    })())

  check('副业变体', '行为：变体价值 == effIngredients 的材料价值合计（不手写 value，变贵靠材料）',
    (() => {
      applyValueBalance()
      const r = SIDELINE_RECIPES.pottery.find((x) => x.reqLevel === 120)
      if (!r) return false // 变体档位若被改掉，这里要**判失败**而不是抛异常（反例 ① 曾把脚本打崩）
      const want = Math.max(1, Math.round(Object.entries(effIngredients(r)).reduce((a, [id, q]) => a + (ITEMS[id]?.value ?? 0) * q, 0)))
      return ITEMS[r.output.itemId]?.value === want
    })())
}

// ── C84（2026-09-30）：餐厅第六星（成长平衡体检 §7 / T4）──────────────────────────
// 起因：`michelin_scale.mjs` 实测**满配也只有 9,640 分**（五星门槛 8,000）⇒ 五星之后评级系统静止。
// 处置与 2026-09-26「三星→五星」同一套：**先加一个评分来源**（第七维「宴席承办」）把满配推过门槛，
// 再加星；收益按原步长续写，**前五档一个字节不动**。
{
  const { MICHELIN_STARS, MICHELIN_FACTORS, starFromScore } = await import('../../src/game/data/michelin.js')
  const { BRANCHES } = await import('../../src/game/data/branches.js')
  const { RESTAURANT_DECOR } = await import('../../src/game/data/restaurantDecor.js')
  const { REGULARS } = await import('../../src/game/data/regulars.js')

  check('米其林六星', '星级表 7 档（未入榜~六星）：门槛严格递增、收益单调不减',
    MICHELIN_STARS.length === 7
    && MICHELIN_STARS.every((s, i, a) => i === 0 || (s.min > a[i - 1].min && s.incomePct >= a[i - 1].incomePct && s.xpPct >= a[i - 1].xpPct)),
    MICHELIN_STARS.map((s) => `${s.name}≥${s.min}`).join(' '))

  check('米其林六星', '🔴 前五档门槛与收益**逐值未变**（不 120/300/620/3200/8000 · 收 10/20/35/50/65 · 经 0/3/6/9/12）',
    MICHELIN_STARS.slice(0, 6).map((s) => `${s.min}/${s.incomePct}/${s.xpPct}`).join(' ') === '0/0/0 120/10/0 300/20/3 620/35/6 3200/50/9 8000/65/12')

  check('米其林六星', '收益按原步长续写：六星 收入 +80%（+15/档）、经验 +15%（+3/档）',
    MICHELIN_STARS[6].incomePct === 80 && MICHELIN_STARS[6].xpPct === 15)

  check('米其林六星', '新增第七维「宴席承办」（banquets × 25），既有六维的 id/权重一个没动',
    MICHELIN_FACTORS.length === 7 && MICHELIN_FACTORS[6].id === 'banquet' && MICHELIN_FACTORS[6].weight === 25
    && MICHELIN_FACTORS.slice(0, 6).map((f) => `${f.id}:${f.weight}`).join(',') === 'menu:12,decor:0.6,orders:1.2,critic:25,regulars:8,branches:60')

  {
    // 行为断言（真实引擎，口径与 `michelin_scale.mjs` 一致）：满配可达；而**只做满六维**够不到
    const p = freshPlayer()
    const foods = Object.values(ITEMS).filter((i) => i.type === 'food').sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0))
    p.restaurant.menu = foods.slice(0, 12).map((i) => i.id)
    p.restaurant.decor = RESTAURANT_DECOR.map((d) => d.id)
    p.stats.ordersServed = 5000
    p.stats.criticServed = 40
    for (const r of REGULARS) p.regulars[r.id] = { serves: 200 }
    for (const b of BRANCHES) p.branches[b.id] = { open: true, manager: true }
    p.stats.banquets = 0
    const noBanquet = p.michelinScore().score
    p.stats.banquets = 100
    const full = p.michelinScore().score
    check('米其林六星', `行为：满配可达（六维做满 + 100 次宴席 = ${full} ≥ 门槛 ${MICHELIN_STARS[6].min} → 六星），而只做满六维（${noBanquet}）够不到`,
      noBanquet < MICHELIN_STARS[6].min && full >= MICHELIN_STARS[6].min && starFromScore(full).star === 6)
  }
}

// ── C85（2026-09-30）：副业产业链（T6/4-C）+ 出口登记（T6/4-D）─────────────────────
// 4-C：**木工产物**可以投入**其它任何一支**的阶梯（跨线、**半价**）——木工是全部副业的共同前置，
//      它的产物因此有了第二个去处；**半价**保证它不会变成「绕开本职辅料」的捷径。
//      🔴 必须**独立于默认的「投入全部」**（否则玩家点一下会静默花掉自己的木器）。
// 4-D：每支副业的乘区出口都要**登记进「效果总览」**，否则玩家看不到自己在吃什么加成。
{
  const { CHAIN_FROM_SKILL, CHAIN_DISCOUNT, SIDELINE_AXES, SIDELINE_PRODUCTS } = await import('../../src/game/data/sidelineWorks.js')

  check('副业产业链', `常数：只木工跨线（${CHAIN_FROM_SKILL}）、折扣 ∈ (0,1)（现 ${CHAIN_DISCOUNT}）`,
    CHAIN_FROM_SKILL === 'woodworking' && CHAIN_DISCOUNT > 0 && CHAIN_DISCOUNT < 1)

  // 行为：木器投进**别的**线 ⇒ 木器被消耗、按半价计点；而**默认投入全部**不会碰木器
  check('副业产业链', '行为：木器可投入其它线的阶梯（半价计点），而默认「投入全部」绝不消耗木器',
    (() => {
      const p = freshPlayer()
      p.inventory.woodenPlate = 4 // 一件木工产物（木餐盘，Lv31 ⇒ 4 点/件）
      const before0 = p.sidelinePointsOf('pottery')
      const r0 = p.feedSideline('pottery') // 默认：只吃本职产物
      const keptDefault = (p.inventory.woodenPlate ?? 0) === 4 && r0.ok === false
      const r1 = p.feedSideline('pottery', null, { withChain: true })
      const pts = r1.points
      return keptDefault && r1.ok === true && (p.inventory.woodenPlate ?? 0) === 0
        && before0 === 0 && pts === Math.floor(4 * 4 * CHAIN_DISCOUNT)
    })())

  // 行为：反向不成立（别支产物喂不进木工）；木工那条线**只会吃自己的产物**
  check('副业产业链', '行为：反向不成立 —— 陶器喂不进木工阶梯（哪怕传了 withChain）',
    (() => {
      const p = freshPlayer()
      p.inventory.pottery_1 = 3
      const a = p.feedSideline('woodworking', null, { withChain: true })
      return a.ok === false && (p.inventory.pottery_1 ?? 0) === 3
    })())

  // 界面接线：独立按钮（不许并进默认投入那一个按钮）
  check('副业产业链', '🔴 界面有独立入口（独立按钮 + 半价说明），没有并进默认的「投入全部」',
    (() => {
      const src = fs.readFileSync('src/components/SidelineWorkPanel.vue', 'utf8')
      // ⚠️ 要连**元素本身**一起钉（只查 `@click="feedChain"` 的话，给它挂 `v-if="false"` 就永不渲染而断言照样绿
      //    —— 本项目反复踩过这一条，反例 ⑪ 又验证了一次）
      return /<button v-if="chainQty > 0" class="btn btn-sm" @click="feedChain">/.test(src)
        && /feedSideline\(ladder\.value\.skill, null, \{ withChain: true \}\)/.test(src)
    })())

  // 4-D：每条副业轴都要在「效果总览」里被读到（漏一条 = 玩家看不到自己在吃什么加成）
  {
    const ae = fs.readFileSync('src/game/data/activeEffects.js', 'utf8')
    // 三种合法写法：① 直读轴 `sidelineEffectTotal('x')`（含 `?.` 形态）② 段拆分 `sidelineSegs(p, 'x', …)`
    //   ③ 读**该轴唯一的消费方访问器**（下面这张 2 条的白名单：蜡烛的时长、钱庄的金币）
    const ACCESSOR = { nightHours: 'nightMarketExtraHours', goldGainPct: 'goldGainPct' }
    const covered = (axis) =>
      new RegExp(`sidelineEffect(?:Total|Parts)?\\??\\.?\\(\\s*'${axis}'`).test(ae)
      || new RegExp(`sidelineSegs\\(\\s*p\\s*,\\s*'${axis}'`).test(ae)
      || (ACCESSOR[axis] ? new RegExp(`p\\.${ACCESSOR[axis]}\\??\\.?\\(`).test(ae) : false)
    const missing = Object.keys(SIDELINE_AXES).filter((axis) => !covered(axis))
    check('副业出口', `全部 ${Object.keys(SIDELINE_AXES).length} 条副业轴都登记进了「效果总览」`, missing.length === 0, missing.join(','))
  }
}

console.log(`\n══ 结果：通过 ${pass} / 失败 ${fail} ══`)
console.log(`发现缺陷 ${bugs.length} 项（另有代码核查项在报告中）`)
process.exit(fail === 0 ? 0 : 1)