// 从 system_test.mjs 拆出的「C27. 精通档位说明」块（体检改进 #2）。
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
  check('伐木采矿', `目标数：伐木 ${W.targets.length} / 采矿 ${M.targets.length} / 挖掘 ${E.targets.length}（2026-09-29 补档各 +2；2026-09-30 末段空档给挖掘 +7）`, W.targets.length === 22 && M.targets.length === 45 && E.targets.length === 58, `${W.targets.length}/${M.targets.length}/${E.targets.length}`)
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

console.log(`\n══ 结果：通过 ${pass} / 失败 ${fail} ══`)
console.log(`发现缺陷 ${bugs.length} 项（另有代码核查项在报告中）`)
process.exit(fail === 0 ? 0 : 1)
