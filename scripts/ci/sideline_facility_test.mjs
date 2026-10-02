// 从 system_test.mjs 拆出的「C25. 挂机产线」块（体检改进 #2）。
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

console.log(`\n══ 结果：通过 ${pass} / 失败 ${fail} ══`)
console.log(`发现缺陷 ${bugs.length} 项（另有代码核查项在报告中）`)
process.exit(fail === 0 ? 0 : 1)
