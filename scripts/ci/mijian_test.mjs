// 从 system_test.mjs 拆出的「X. 觅珍抽卡」块（体检改进 #2）。
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
import { XP_STACK_DAMPING, dampXpStack, LOW_TARGET_GAP, LOW_TARGET_XP_MULT, lowTargetRefLevel, targetLevelXpMult, LOW_TARGET_MIN_MULT } from '../../src/game/core/growthRate.js'
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

// ── C9b. 运营调参层（2026-09-25 第四角色，2026-10-02 由「运营调参员」改名「运营 ops」）──
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
      Math.abs(GR.targetLevelXpMult(30, 20, 40) - Math.max(GR.LOW_TARGET_MIN_MULT, 1 - 10 * ((1 - GR.LOW_TARGET_XP_MULT) / GR.LOW_TARGET_GAP))) < 1e-9)  // 差 10 级 ⇒ 公式 0 ⇒ 夹到下限 0.15
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
      check('调参', 'lowTargetGap：差 4 级恒算低目标；滑杆 5→2 后公式给 0、被下限夹到 0.15',
        GR2.isLowTarget(30, 26, 40) === true && (T.tunerSet('lowTargetGap', 2), Math.abs(GR2.targetLevelXpMult(30, 26, 40) - 0.15) < 1e-9))
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
    const panel = fs2.readFileSync(new URL('../../src/components/OpsPanel.vue', import.meta.url), 'utf8')
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
        if (p === 'src/components/OpsPanel.vue') continue
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

// ── C9c. 运营驾驶舱（2026-10-02 新角色 ops 的只读聚合层）──────────────────────────
// 🔒 只读契约：聚合前后 player 序列化**逐字段一致**——驾驶舱不得改任何玩家状态。
//    这是"零写操作"的可验证化（比对着代码看强）。用"有内容"的档跑，别只用空档（空档会跳过很多分支）。
{
  const OA = await import('../../src/game/dev/opsAnalytics.js')
  const OB = await import('../../src/game/dev/opsBenchmarks.js')
  const OR = await import('../../src/game/dev/opsReport.js')
  const p = freshPlayer()
  p.gold = 123456
  if (!p.branches) p.branches = {}
  p.branches.east = { manager: false, lastAt: Date.now() }
  p.inventory.apple = 500
  p.restaurant.menu = ['apple']
  const before = JSON.stringify(p.serialize())
  const dash = OA.collectDashboard(p, {
    telemetry: { startedAt: Date.now() - 5000, firsts: { game_started: Date.now() - 5000 } },
    marks: [{ id: 'game_started', label: '开始游戏' }],
  })
  const after = JSON.stringify(p.serialize())
  check('运营', '只读契约：驾驶舱聚合前后存档逐字段一致（零写操作）', before === after)
  check('运营', '概览：读到金币', dash.overview.gold === 123456, `gold=${dash.overview.gold}`)
  check('运营',
    '经济水位：餐厅与分店都进了行',
    dash.economy.rows.some((r) => r.id === 'restaurant') && dash.economy.rows.some((r) => r.id === 'branch:east'),
    `rows=${dash.economy.rows.map((r) => r.id).join(',') || '—'}`)
  check('运营', '道具 TopN：苹果在榜首且数量正确', dash.topItems[0]?.id === 'apple' && dash.topItems[0]?.qty === 500)
  check('运营', '漏斗：达成项带「开局后秒数」', dash.funnel[0]?.done === true && Number.isFinite(dash.funnel[0]?.seconds))
  // 验收线判据（OPS_BANDS）：边界含端、越界为假
  check('运营', '标定带：单场时长 [4,25] 含端、越界为假',
    OB.inBand('ttk', 4) && OB.inBand('ttk', 25) && !OB.inBand('ttk', 3.9) && !OB.inBand('ttk', 25.1))
  // 报表：含区块标题且无 undefined/NaN
  const md = OR.buildMarkdown(dash)
  check('运营', '报表：Markdown 含四个区块标题',
    ['# 运营数据快照', '## 进度概览', '## 新手漏斗', '## 经济水位'].every((s) => md.includes(s)))
  check('运营', '报表：无 undefined / NaN 残留', !/undefined|NaN/.test(md))
  // 静态：面板区间来自 opsBenchmarks（不手抄 lo/hi）；默认分区 = 驾驶舱
  const fs3 = await import('node:fs')
  const panel = fs3.readFileSync(new URL('../../src/components/OpsPanel.vue', import.meta.url), 'utf8')
  check('运营', '面板：验收线区间来自 opsBenchmarks（读 bandOf / bandRangeText）', /bandOf\(/.test(panel) && /bandRangeText\(/.test(panel))
  check('运营', '面板：默认分区 = 驾驶舱 且三分区页签都在', /ref\('dash'\)/.test(panel) && /ops-tabs/.test(panel) && /tab === 'cal'/.test(panel))
  // ── 🧪 平衡实验台引擎（balanceLab）：投影确定性 + A/B 不残留 ──
  const BL = await import('../../src/game/dev/balanceLab.js')
  const T2 = await import('../../src/game/data/tuner.js')
  T2.tunerResetAll()
  try {
    const m1 = BL.projectMetrics()
    const m2 = BL.projectMetrics()
    check('运营', '实验台：无覆盖时投影确定（两次逐值相等）', JSON.stringify(m1) === JSON.stringify(m2))
    check('运营', '实验台：无覆盖时 projectMetrics == baselineMetrics（基线自洽）',
      JSON.stringify(m1) === JSON.stringify(BL.baselineMetrics()))
    const { A, B } = BL.runComparison({}, { enemyHp: 4 })
    check('运营', '实验台：A/B 血量 ×4 ⇒ 单场时长变长、经验/时下降',
      B.ttk > A.ttk && B.xpRate < A.xpRate, `ttk ${A.ttk.toFixed(1)}→${B.ttk.toFixed(1)} · xp ${A.xpRate.toFixed(0)}→${B.xpRate.toFixed(0)}`)
    check('运营', '实验台：A/B 跑完覆盖为空（不残留、不影响引擎）', T2.tunerActiveKeys().length === 0)
    const restored = (() => {
      T2.tunerSet('globalXp', 3)
      BL.withOverrides({ globalXp: 7 }, () => {})
      const ok = T2.tunerRawValue('globalXp') === 3
      T2.tunerResetAll()
      return ok
    })()
    check('运营', '实验台：withOverrides 施加后原样恢复（含调用前已有的覆盖）', restored)
  } finally {
    T2.tunerResetAll()
  }
  const ids = BL.LAB_SCENARIOS.map((s) => s.id)
  check('运营', '实验台：情景 id 唯一', new Set(ids).size === ids.length)
  // 静态：面板不再各算一份链路（链路 + A/B 都走 balanceLab 出口）
  check('运营', '面板：四条链 / A/B 由 balanceLab 驱动（唯一真身）', /projectionGroups\(/.test(panel) && /runComparison\(/.test(panel))
  // ── 📅 内容节奏（只读数据表聚合）──
  const OC = await import('../../src/game/dev/opsCadence.js')
  const cad = OC.contentByBand()
  check('运营', '内容节奏：12 个 10 级段、合计 > 0', cad.length === 12 && cad.reduce((a, r) => a + r.total, 0) > 0, `段数=${cad.length}`)
  check('运营', '内容节奏：末段比首段薄（内容密度下滑）', cad[cad.length - 1].total < cad[0].total, `${cad[0].total} → ${cad[cad.length - 1].total}`)
  check('运营', '内容节奏：含 Lv101-120 的探索目标（lateExplore 副作用生效）', cad.some((r) => r.start >= 101 && r.explore > 0))
  check('运营', '面板：内容节奏卡已接线', /ops-cad/.test(panel))
  // ── 📅 运营日历（只读排期）──
  const OCAL = await import('../../src/game/dev/opsCalendar.js')
  const cal = OCAL.collectCalendar()
  check('运营', '运营日历：周排班 7×24、格内是活动 id 数组', cal.grid.length === 7 && cal.grid.every((r) => r.length === 24 && r.every((c) => Array.isArray(c))))
  check('运营', '运营日历：今日快照含 日期/星期/命中活动', typeof cal.today.date === 'string' && typeof cal.today.weekday === 'string' && Array.isArray(cal.today.market))
  check('运营', '运营日历：本月节庆覆盖整月', cal.month.length >= 28 && cal.month.every((d) => Array.isArray(d.festivals)))
  check('运营', '运营日历：排期表无 undefined / NaN', !/undefined|NaN/.test(OCAL.scheduleMarkdown()))
  check('运营', '面板：运营日历两卡已接线', /ops-cal-grid/.test(panel) && /ops-cal-days/.test(panel))
}

// ── C10. 一键入包（2026-09-06）──

console.log(`\n══ 结果：通过 ${pass} / 失败 ${fail} ══`)
console.log(`发现缺陷 ${bugs.length} 项（另有代码核查项在报告中）`)
process.exit(fail === 0 ? 0 : 1)
