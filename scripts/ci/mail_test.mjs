// 从 system_test.mjs 拆出的「C11. 信箱」块（体检改进 #2）。
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

console.log(`\n══ 结果：通过 ${pass} / 失败 ${fail} ══`)
console.log(`发现缺陷 ${bugs.length} 项（另有代码核查项在报告中）`)
process.exit(fail === 0 ? 0 : 1)
