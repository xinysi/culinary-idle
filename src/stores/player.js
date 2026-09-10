// 玩家状态 — 需求文档 §10.2.3 / §5.4 / §6 / §7.2 / §8
// skills 为 { skillId: { level, exp, mastery: { itemId: level }, prestiges? } }
// inventory / bank 为 { itemId: quantity }
// 食灵出战（§3.3.6）、奥义激活（§3.4.1）、品鉴点数、增益 增益（§3.4.2）、
// 腐坏计时（§5.4）、成就/图鉴/称号（§6）、主线任务进度（§7.2）、统计

import { defineStore } from 'pinia'
import { SKILL_DEFS } from '../game/data/skills.js'
import { totalXpForLevel } from '../game/core/Experience.js'
import { getItem, ITEMS } from '../game/data/items.js'
import { rollGearMods, REROLL_COST } from '../game/data/gearMods.js'
import { getAllSkillInstances, getSkillInstance } from '../game/skills/registry.js'
import { STYLE_INFO } from '../game/data/combat.js'
import { getCombat } from '../game/combat/Combat.js'
import { SPIRITS, SPIRIT_SLOTS, getSpirit } from '../game/data/spirits.js'
import { SPIRIT_STORY_STAGES, STAGE_INFO } from '../game/data/spiritStories.js'
import { AOJIS } from '../game/data/aojis.js'
import { ALL_ACHIEVEMENTS, collectionTotal } from '../game/data/achievements.js'
import { QUESTS, questObjectiveKey } from '../game/data/quests.js'
import { COMBAT_REGIONS } from '../game/data/combat.js'
import { EventBus } from '../game/core/EventBus.js'
import { masteryLevelFromCount } from '../game/core/mastery.js'
import { countForMasteryLevel } from '../game/core/mastery.js'
import { MAX_LEVEL, PRESTIGE_MAX_LEVEL } from '../game/skills/Skill.js'
import { getGuild, GUILD_SHOP } from '../game/data/guilds.js'
import { getSeason, activeSeasonId } from '../game/data/seasons.js'
import { RESTAURANT_DECOR_BY_ID } from '../game/data/restaurantDecor.js'
import { dailyTasksFor, weeklyTaskFor, DAILY_BONUS } from '../game/data/dailyTasks.js'
import { CHALLENGES, challengeForWeek, getChallenge } from '../game/data/weeklyChallenge.js'
import { REALM_BUFFS, rollRealmChoices, realmReward } from '../game/data/mysticRealm.js'
import { INSIGHT_NODES, insightEffectSum, canUnlockInsight } from '../game/data/insightTree.js'
import { towerFloor, towerMilestone, TOWER_UNLOCK_LEVEL } from '../game/data/battleTower.js'
import { festThemeFor, festScore, festAccepts, FEST_MILESTONES, FEST_DAILY_ENTRIES } from '../game/data/cookingFest.js'
import { COLLECTABLE_SETS, setBonusReward } from '../game/data/setBonuses.js'
import { equipSetBonuses } from '../game/data/equipSets.js'
import { gemDef, socketCountOf, gemsBonus } from '../game/data/gems.js'
import { activeMarketEvents as activeMarketEvents_, aggregateMarketBoost } from '../game/data/marketEvents.js'
import { MIJIAN_POOLS, pickItem, GEAR_PITY, LIMITED_PITY } from '../game/data/mijianDraws.js'
import { useUiStore } from './ui.js'
import { makeOrder, nextOrderDelay, MAX_ORDERS, makeCriticOrder, criticDelay } from '../game/data/restaurantOrders.js'
import { SHOP_ITEMS } from '../game/data/shop.js'
import { EXPEDITIONS, getExpedition, expeditionTier, expeditionYieldMult, expeditionRareBonus } from '../game/data/expeditions.js'
import { REGULARS, getRegular, regularLevelFromServes, REGULAR_LEVEL_REQ, REGULAR_MAX_GIFT } from '../game/data/regulars.js'
import { CHRONICLE_CAP } from '../game/data/chronicle.js'
import { weatherBoost, fortuneForDay, dayKeyOf, weatherForDay } from '../game/data/weather.js'
import { MASCOTS, getMascot, mascotReward, mascotBondLevel, mascotBondProgress } from '../game/data/mascots.js'
import { BANQUET_TIERS, makeBanquetOrder, banquetAvailable } from '../game/data/banquets.js'
import { BRANCH_THEMES, getBranchTheme, themeMult } from '../game/data/branchThemes.js'
import { SUPPLIERS, getSupplier, supplierDailyCost, SUPPLIER_MAX_CONTRACTS, SUPPLIER_TERM_DAYS } from '../game/data/suppliers.js'
import { CHEFS, getChef, chefForWeek, chefOpponent, chefReward } from '../game/data/chefChallenges.js'
import { takeoutLevelFromExp, takeoutPrice, takeoutConcurrency, takeoutUpgradeCost, TAKEOUT_MAX_LEVEL, TAKEOUT_PRICE_MULT } from '../game/data/takeout.js'
import { AUTOMATIONS, getAutomation, SELL_THRESHOLD_DEFAULT, SELL_KEEP, SELL_EXCLUDED_CATEGORIES } from '../game/data/automation.js'
import { FLAVOR_PAIRS, getFlavorPair, matchFlavorPairs } from '../game/data/flavorPairs.js'
import { festivalBoost, upcomingFestivals } from '../game/data/festivals.js'
import { SCHOOLS, getSchool, schoolOfCategory, schoolCost, SCHOOL_MAX_LEVEL, SCHOOL_PERKS } from '../game/data/schools.js'
import { STAFF, getStaff, staffCost, staffWage, STAFF_MAX_LEVEL } from '../game/data/staff.js'
import { REGIONS, getRegion, postingBonus } from '../game/data/regions.js'
import { carryFromLevel, CARRY_MAX, apprenticeOfflineBonus, apprenticeRank, APPRENTICE_MAX_LEVEL } from '../game/data/legacy.js'
import { PATRONS, getPatron, patronCost, patronEffectAt, PATRON_MAX_LEVEL, PATRON_SWITCH_GOLD, PATRON_SWITCH_COOLDOWN_MS } from '../game/data/patrons.js'
import { GEAR_CONTEST_UNLOCK_LEVEL, GEAR_SCORE_WEIGHTS, rankFromScore, contestWeek, themeOfWeek } from '../game/data/gearContest.js'
import { MICHELIN_UNLOCK_LEVEL, MICHELIN_FACTORS, starFromScore, nextStar } from '../game/data/michelin.js'
import { RANCH_UNLOCK_SKILL, RANCH_UNLOCK_LEVEL, RANCH_BASE_PENS, RANCH_MAX_PENS, RANCH_EXPAND_COSTS, RANCH_OFFLINE_CAP_HOURS, RANCH_ANIMALS, getAnimal, nextRanchExpandCost } from '../game/data/ranch.js'
import { BRANCHES, getBranch, branchHourly, BRANCH_UNLOCK_LEVEL, BRANCH_OFFLINE_CAP_HOURS, MANAGER_BONUS } from '../game/data/branches.js'
import { EXCHANGE_UNLOCK_SKILL, EXCHANGE_UNLOCK_LEVEL, EXCHANGE_DAILY_LIMIT, exchangeCycleIndex, pickGoods, sellPriceOf, buyPriceOf } from '../game/data/exchange.js'
import { TRIALS, getTrial, TRIAL_UNLOCK_LEVEL, repeatReward } from '../game/data/trials.js'
import { CELLAR_UNLOCK_SKILL, CELLAR_UNLOCK_LEVEL, CELLAR_BASE_SLOTS, CELLAR_MAX_SLOTS, CELLAR_EXPAND_COSTS, CELLAR_MAX_QTY, CELLAR_MAX_BASE_VALUE, CELLAR_CATEGORIES, cellarTier, cellarPayout, nextCellarExpandCost } from '../game/data/cellar.js'

// 餐厅 1 分钟结算窗口计时（模块级，不序列化进存档）
let _restaurantAccumMs = 0

// 日期辅助（用 setDate 精确减 1 天，自动处理跨月/闰年/夏令时，避免 Date.now()-86400000 的跨日隐患）
function _dateStr(d) { return d.toLocaleDateString('en-CA') } // YYYY-MM-DD
function _todayStr() { return _dateStr(new Date()) }
function _yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return _dateStr(d)
}

// 每日签到奖励（7 天循环，§13）：基准模板。实际奖励物品(增益剂档位)与金币随玩家等级动态分配：
// 见 resolveSignInReward(def, level) 与 store.signInRewardFor(day)。物品 id 均为真实有效物品。
export const SIGN_IN_REWARDS = [
  { goldBase: 100 },
  { item: { kind: 'spice', qty: 1 } }, // 神秘调料
  { goldBase: 200, item: { kind: 'biscuit', qty: 1 } }, // 金币 + 能量饼干
  { item: { kind: 'xpTonic', qty: 1 } }, // 经验增益剂（档位随等级）
  { goldBase: 300 },
  { item: { kind: 'yieldTonic', qty: 1 } }, // 产量增益剂（档位随等级）
  { goldBase: 500, item: { kind: 'biscuit', qty: 2 }, extra: { kind: 'spice', qty: 1 } }, // 丰厚收尾
]

// 增益剂档位：按代表等级选 Ⅰ~Ⅴ（效果与时长递增），等级越高给越高档
function _tonicTier(level) {
  if (level < 20) return 1
  if (level < 40) return 2
  if (level < 60) return 3
  if (level < 80) return 4
  return 5
}
// 解析物品种类 → 具体物品 id（动态选档或固定）
function _resolveItem(kind, qty, tier) {
  const id = { spice: 'mysterySpice', biscuit: 'energyBiscuit', xpTonic: `xpTonic${tier}`, yieldTonic: `yieldTonic${tier}` }[kind]
  return { id, qty }
}
// 把一天的定义解析成 { gold, items }（gold 随等级放大、增益剂随等级选档）
export function resolveSignInReward(def, level) {
  const tier = _tonicTier(level)
  // 仅定义了 goldBase 的天发金币（随等级放大）；纯物品天不发金币
  const gold = def.goldBase ? (def.goldBase + Math.floor(level * 2)) : 0
  const items = {}
  if (def.item) { const r = _resolveItem(def.item.kind, def.item.qty, tier); items[r.id] = (items[r.id] ?? 0) + r.qty }
  if (def.extra) { const r = _resolveItem(def.extra.kind, def.extra.qty, tier); items[r.id] = (items[r.id] ?? 0) + r.qty }
  return { gold, items }
}

const EQUIPMENT_SLOTS = ['weapon', 'helmet', 'body', 'legs', 'boots', 'offhand', 'amulet', 'ring']
const SPOIL_CHECK_MS = 30_000
const ACHIEVE_CHECK_MS = 2_000

// 食灵羁绊（2026-09-06）：各等级所需累计出战天数（1-5 级；0=未解锁）
export const BOND_DAYS = [2, 6, 12, 20, 30]
export function bondLevelOf(ms) {
  const days = (ms ?? 0) / 86400000
  let lv = 0
  for (let i = 0; i < BOND_DAYS.length; i++) {
    if (days >= BOND_DAYS[i]) lv = i + 1
  }
  return lv
}
// 餐厅好感（2026-09-06）：等级需求 xp 曲线（下一级 = 500×L²），小费 +3%/级
export const FAVOR_MAX_LEVEL = 20
export function favorLevelFromXp(xp) {
  let lv = 1
  for (; lv < FAVOR_MAX_LEVEL; lv++) {
    const need = 500 * lv * lv
    if (xp < need) break
  }
  return lv
}

function defaultSkills() {
  const skills = {}
  for (const id of Object.keys(SKILL_DEFS)) {
    skills[id] = { level: 1, exp: 0, mastery: {}, prestiges: 0 }
  }
  return skills
}

function defaultEquipment() {
  const eq = {}
  for (const slot of EQUIPMENT_SLOTS) eq[slot] = null
  return eq
}

const defaultState = () => ({
    name: '美食学徒',
    title: null, // 称号（§6.3）
    avatar: null, // 自定义头像（base64 dataUrl，可在设置/头像处上传）
    gold: 100,
    gameCoins: 0, // 游戏币（2026-09-07 小游戏专有货币：七款小游戏奖励与游戏商店统一结算）
    shopOwned: {}, // 游戏商店一次性商品已购标记（旧档无则默认空）
    nameColor: null, // 名字特效（2026-09-09 商店外观）：gold/silver/null
    skills: defaultSkills(),
    inventory: {}, // { itemId: qty }
    bank: {}, // { itemId: qty }
    inventoryCap: 20, // 背包容量（§5.4：初始 20 格，可扩展至 100）
    bankCap: 100, // 仓库容量（§5.4：初始 100 格，可扩展至 500）
    hardcore: false, // 硬核模式（§4.1/§8.2：死亡即删档）
    pausedSkills: {}, // 手动暂停的挂机技能（§3.1 停止/继续）
    closedIdleTasks: {}, // 挂机框中关闭的任务（停止并隐藏，§3.1）
    equipment: defaultEquipment(),
    activeSkill: 'foraging',
    activeTarget: null,
    skillTargets: {}, // 每技能选择的挂机目标（多技能并行，§3.1）；新档为空 = 待机，由玩家选择目标开始
    lastOnlineAt: Date.now(),
    farming: { plots: [] }, // 农田（§3.1.5）
    offlineBonusH: 0, // 离线时长加成（§8.1），上限 +12h
    combat: { style: 'knife', hp: 10, flavorEnergy: 50 }, // §4
    spirits: { active: [], owned: {} }, // 食灵出战列表（§3.3.6，最多 2 个）；owned=食灵阁（不占背包格，2026-09-06）
    gastronomy: { active: [] }, // 激活中的奥义（§3.4.1）
    tastePoints: 0, // 品鉴点数（对决胜利获得，奥义消耗）
    buffs: { xpMult: null, yieldMult: null }, // 增益剂（§3.4.2）：{mult, expiresAt}
    spoilage: {}, // { itemId: spoilAt }（§5.4 腐坏计时）
    coldStorage: {}, // 冷库（§5.4 冻结腐坏）：{ itemId: { qty, remainMs } }，remainMs 为存入时剩余的腐坏毫秒（冻结期间不消耗）
    coldStorageCap: 5, // 冷库容量（§5.4：初始 5 格，每次扩充 +1 花 1000 金币，上限 100）
    achievements: [], // 已解锁成就 id（§6.1）
    collected: {}, // 图鉴（§6.2）：{ itemId: true }
    quests: { index: 0, completed: [], progress: {} }, // 主线任务（§7.2）
    stats: { combatWins: 0, combatLosses: 0, bosses: [], explorations: 0, totalGoldEarned: 0, prestiges: 0, restaurantTotal: 0, arena: { wins: 0, currentStreak: 0, bestStreak: 0, records: [] }, cardBattle: { wins: 0, losses: 0 } },
    // §13 扩展：餐厅 / 公会 / 赛季 / 竞技场
    restaurant: { level: 1, menu: [], incomeAccum: 0, decor: [] }, // 餐厅经营：菜单为料理 itemId 列表；decor 装饰（§13）
    guild: { id: null, points: 0, day: null, taskProgress: {} }, // 公会：被动+任务+商店
    seasons: {}, // { [seasonId]: { points, claimed: [], missionProgress: {} } }（§13）
    signIn: { lastDate: null, day: 0 }, // 每日签到（§13）：连续签到天数（7 天循环）
    todayKey: _todayStr(), // 当天日期（响应式，跨午夜刷新用；供签到/红点依赖）
    // 每日/周常任务（2026-09-06 长线日活钩子）：daily.tasks 为 [{...模板, progress, claimed}]
    daily: { day: null, streak: 0, tasks: [], claimedAll: false },
    weekly: { week: null, task: null, progress: 0, claimed: false },
    // 每周挑战赛（2026-09-09）：{ week, id, progress, done } + 历史最佳
    challenge: { week: null, id: null, progress: 0, done: false },
    challengeBest: {},
    // 食神秘境（2026-09-09 roguelike 局内模式）：{ active, floor, buffs: [id], best, pending: [def] | null }
    realm: { active: false, floor: 0, buffs: [], best: 0, pending: null },
    // 菜系图谱（2026-09-09 永久天赋树）：已解锁节点 id；货币见 stats.insights
    insights: [],
    // 无尽挑战塔（对决 99 解锁）：floor=当前挑战层，best=已通最高层，rewarded=已发里程碑层
    tower: { floor: 1, best: 0, rewarded: [] },
    // 月度厨艺大赛：month=YYYYMM，score=当月累计分，entries=提交记录，rewarded=已领里程碑序号
    fest: { month: null, score: 0, entries: [], lastEntryDay: null, todayEntries: 0, rewarded: [] },
    // 食灵羁绊（2026-09-06）：{ spiritId: 累计出战毫秒 }；等级=出战天数阈值，放大该食灵效果（不改契约/效果数据）
    spiritBonds: {},
    // 硬核生存统计：当前生存天数（best 为历史最高；死亡即删档清空）
    hardcoreStats: { days: 0, best: 0, lastDayKey: null },
    // 新手引导（2026-09-06）：step=当前步骤（0-4），done=true 后不再显示
    guide: { step: 0, done: false },
    // 锻造套装集齐奖励（2026-09-06）：已发奖套名列表
    setBonuses: [],
    // 觅珍抽卡（2026-09-06）：pity=厨具池距上次「稀有及以上」的累计抽数（保底 10 抽）；history=最近 10 次结果标志
    mijian: { stats: { pulls: 0, spent: 0, gearRare: 0 }, pity: 0, history: [] },
    // 制作队列（2026-09-06）：{ skillId: [{recipeId, qty, paused}] }，3 秒自动制作 1 次
    craftQueues: {},
    // 装备词条（2026-09-06）：{ slot: { itemId, mods: [{stat,label,value}] } }
    gearMods: {},
    // 宝石镶嵌（2026-09-09）：{ slot: { itemId, gems: [gemId|null, ...] } }
    gemSockets: {},
    // 食客订单（2026-09-06）：list=[{id,name,itemId,qty,reward,createdMs,expireAt}]；nextAt=下一单生成时刻
    orders: { list: [], nextAt: 0 },
    // 远行采集队（2026-09-09 长线挂机线）：{ [lineId]: { completions, slots: [null | {startedAt, readyAt}] } }
    expeditions: {},
    cellar: { slots: [], expands: 0 }, // 地窖陈酿（2026-09-10）
    regulars: {}, // 常客名录：{ [id]: { serves, lastDay, giftClaimed } }（2026-09-10）
    spiritStories: {}, // 食灵物语：{ [spiritId]: { [stage]: true } }（2026-09-10）
    automation: { unlocked: {}, sellThreshold: SELL_THRESHOLD_DEFAULT, standby: {} }, // 自动化中心（2026-09-10）
    ranch: { pens: [null, null], expands: 0 }, // 牧场：每栏 { animalId, lastAt } | null（2026-09-10）
    branches: {}, // 餐厅分店：{ [id]: { lastAt, manager } }（2026-09-10）
    michelin: { score: 0, stars: 0, best: 0, lastReviewDay: null }, // 米其林评级（2026-09-10）
    flavors: {}, // 风味搭配册：{ [pairId]: true }（2026-09-10）
    gearContest: { week: null, score: 0, rank: null, best: 0, runs: 0 }, // 厨具大赛（2026-09-10）
    schools: {}, // 菜系研究：{ [schoolId]: { level, research: null | { startedAt, readyAt, toLevel } } }（2026-09-10）
    staff: {}, // 雇工班底：{ [staffId]: { level, lastPayAt, unpaid } }（2026-09-10）
    regions: {}, // 产地：{ [regionId]: true } 已考察（2026-09-10）
    regionPosting: {}, // 采集队派驻：{ [lineId]: regionId }（2026-09-10）
    legacy: { carry: {}, apprentice: { level: 0, lastDay: null } }, // 师徒传承（2026-09-10）
    patron: { active: null, levels: {}, lastSwitchAt: 0 }, // 食神信仰（2026-09-10）
    chronicle: [], // 厨师年鉴：[{ key, at, kind, text }]（2026-09-10）
    mascots: { owned: {}, active: null, pets: {}, lastPetDay: null }, // 吉祥物（2026-09-10）
    banquet: { order: null, done: 0, failed: 0 }, // 宴会承办（2026-09-10）
    takeout: { exp: 0, lastAt: 0, sold: 0, gold: 0 }, // 外卖业务：exp=累计完成单数（2026-09-10）
    branchThemes: {}, // 分店主题：{ [branchId]: themeId }（2026-09-10）
    contracts: {}, // 供应商合约：{ [supplierId]: { startedAt, expiresAt, lastDay, paid } }（2026-09-10）
    chefChallenge: { week: null, cleared: [], current: null }, // 名厨挑战（2026-09-10）
    exchange: { dayKey: null, traded: {} }, // 交易所：{ dayKey, traded: { [itemId]: 已成交件数 } }（2026-09-10）
    trials: {}, // 厨神试炼：{ [trialId]: { clears, best, streak } }（2026-09-10）
    activeTrial: null, // 当前进行的试炼 id（一次性，不持久化）
    // 美食评论家（2026-09-09）：{ order: null | {...}, nextAt }
    critic: { order: null, nextAt: 0 },
    // 挂机计划（2026-09-09）：按顺序挂机，条件满足自动换目标，全部完成自动暂停
    plan: { active: false, index: 0, steps: [] },
    // 小游戏（2026-09-06 顶部第三页）：火候炉/美食讲堂/厨心2048/大胃王
    minigames: {
      heat: { day: 0, streak: 0, bestStreak: 0 },
      trivia: { week: '', answered: 0, correct: 0, badges: 0 },
      kitchen2048: { best: 0 },
      foodrush: { day: 0, best: 0, rewarded: 0 },
      puzzle: { day: '', done: 0 },
      matchfood: { day: '', buffed: 0 },
    },
    upgrades: {}, // 装备强化：{ [itemId]: level }（§13）
    settings: { autoEat: true, autoEatThreshold: 50, autoFarm: true, autoSupply: true, autoSupplyReserve: 2000, crispMode: false, maxParallelIdle: 0, uiScale: 1, xpMultiplier: 1, theme: 'light', heatCraftChallenge: true }, // maxParallelIdle：并行挂机上限 0=无限制（§3.1）；uiScale：界面缩放（0.9-1.1 安全区间，超出排版会错乱）；xpMultiplier：全局经验倍率（1/10/50/100/250/500/1000）；autoFarm：农耕成熟自动收种（2026-09-09，放置化）；autoSupply/autoSupplyReserve：弹药自动补给与保留金币（2026-09-09）
    storyProgress: {}, // 轶事/故事进度：{ `${kind}:${param}`: 次数 }，按具体物品/动作累计（§13）
  })

export const usePlayerStore = defineStore('player', {
  state: defaultState,

  getters: {
    skillState: (s) => (id) => s.skills[id] ?? { level: 1, exp: 0, mastery: {}, prestiges: 0 },
    activeSkillState(s) {
      return s.skills[s.activeSkill] ?? { level: 1, exp: 0, mastery: {}, prestiges: 0 }
    },
    /** §3.3.5 品鉴力 生命值：初始 10，每级 +10 + 装备加成 + 奥义「铁胃」 */
    maxHp(s) {
      const level = s.skills.tasteAcumen?.level ?? 1
      const eq = s.equippedStats
      const aoji = s.gastronomyEffects()?.maxHpBonus ?? 0
      return 10 + (level - 1) * 10 + eq.hpBonus + aoji
    },
    totalLevels(s) {
      return Object.values(s.skills).reduce((a, sk) => a + (sk.level ?? 1), 0)
    },
    /** 已装备属性合计（§5.1/§4.2 来源之一）+ 装备词条（玩家侧乘区，2026-09-06） */
    equippedStats(s) {
      const sum = { attack: 0, accuracy: 0, defense: 0, evasion: 0, critChance: 0, hpBonus: 0, speedBonus: 0 }
      for (const itemId of Object.values(s.equipment)) {
        const item = getItem(itemId)
        if (!item?.stats) continue
        const mult = this.upgradeMult(itemId) // 强化加成（§13：每级 +10%）
        for (const [k, v] of Object.entries(item.stats)) {
          const nv = Number(v)
          // 防某个装备字段缺失/非数字导致 NaN 传染到属性面板
          sum[k] = (sum[k] ?? 0) + (Number.isFinite(nv) ? nv : 0) * mult
        }
      }
      // 词条：仅对「仍穿戴同一件」的槽位生效
      for (const [slot, m] of Object.entries(s.gearMods ?? {})) {
        if (!m?.mods?.length || s.equipment[slot] !== m.itemId) continue
        for (const mod of m.mods) {
          sum[mod.stat] = (sum[mod.stat] ?? 0) + (Number(mod.value) || 0)
        }
      }
      // 套装效果（2026-09-09）：同套穿戴 2/4/6 件的叠加加成
      const setB = equipSetBonuses(s.equipment)
      for (const k of ['attack', 'defense', 'hpBonus', 'accuracy', 'critChance', 'speedBonus']) {
        sum[k] = (sum[k] ?? 0) + (setB[k] ?? 0)
      }
      // 宝石镶嵌（2026-09-09）：仅对「仍穿戴同一件」的槽位生效
      for (const [slot, rec] of Object.entries(s.gemSockets ?? {})) {
        if (!rec?.gems?.length || s.equipment[slot] !== rec.itemId) continue
        const gb = gemsBonus(rec.gems)
        for (const [k, v] of Object.entries(gb)) sum[k] = (sum[k] ?? 0) + v
      }
      return sum
    },
    inventoryCount(s) {
      return Object.values(s.inventory).reduce((a, b) => a + b, 0)
    },
    /** 已解锁对决区域数（§4.4 按对决等级） */
    regionsUnlocked(s) {
      return COMBAT_REGIONS.filter((r) => r.reqLevel <= s.combatLevel).length
    },
    /** 某技能当前选择的挂机目标（§3.1 多技能并行；旧档回退 activeTarget） */
    getSkillTarget: (s) => (skillId) => s.skillTargets?.[skillId] ?? (s.activeSkill === skillId ? s.activeTarget : null),
    /** 当前实际运行的挂机技能列表（§3.1 并行上限：活动技能优先，0=无限制） */
    getRunningIdleSkills(s) {
      return () => {
        const limit = s.settings?.maxParallelIdle ?? 0
        const candidates = getAllSkillInstances().filter((inst) => {
          if (!inst || !['gathering', 'exploration'].includes(inst.type)) return false
          const t = inst.currentTarget
          if (!t || inst.level < t.reqLevel) return false
          if (s.pausedSkills?.[inst.id]) return false
          return true
        })
        // 活动技能（正在查看的页）优先占位，其余按 id 稳定排序
        candidates.sort((a, b) => {
          if (a.id === s.activeSkill) return -1
          if (b.id === s.activeSkill) return 1
          return a.id < b.id ? -1 : 1
        })
        return limit > 0 ? candidates.slice(0, limit) : candidates
      }
    },
    /** 对决等级 = 品鉴力/最高攻击技能/火候 的平均（Melvor 式战斗等级，§4.4 门控用） */
    combatLevel(s) {
      const taste = s.skills.tasteAcumen?.level ?? 1
      const heat = s.skills.heatControl?.level ?? 1
      const style = Math.max(s.skills.knife?.level ?? 1, s.skills.plating?.level ?? 1, s.skills.flavorArtistry?.level ?? 1)
      return Math.floor((taste + heat + style) / 3)
    },
    /** 图鉴完成度 %（§6.2，保留一位小数；>0 时最低显示 0.1，避免「已收集但显示 0%」） */
    collectionPct(s) {
      const total = collectionTotal()
      if (total <= 0) return 0
      const got = Object.keys(s.collected).length
      if (got <= 0) return 0
      return Math.min(100, Math.max(0.1, Math.round((got / total) * 1000) / 10))
    },
    /** 背包/仓库占用格数（§5.4：不同物品种类数） */
    inventorySlotsUsed(s) {
      return Object.keys(s.inventory).length
    },
    bankSlotsUsed(s) {
      return Object.keys(s.bank).length
    },
    /** 冷库占用格数（§5.4：不同物品种类数，封顶由 coldStorageCap 限制） */
    coldStorageSlotsUsed(s) {
      return Object.keys(s.coldStorage).length
    },
    /** 食灵被动效果聚合（§3.3.6）— 函数 getter：spiritEffects() */
    spiritEffects(s) {
      return () => {
        const eff = { xpPct: {}, styleDmgPct: {}, dmgPct: 0, healPerTurnPct: 0, loseHpPerTurnPct: 0, fishingAccPct: 0, farmYieldBonus: 0 }
        for (const id of s.spirits?.active ?? []) {
          const sp = SPIRITS.find((x) => x.id === id)
          if (!sp?.effect) continue
          // 羁绊乘区（2026-09-06）：每级 +4% 效果放大（不改 SPIRITS 契约/effect 数据，玩家侧乘法）
          const bond = bondLevelOf(s.spiritBonds?.[id] ?? 0)
          const bondMult = 1 + 0.04 * bond
          const e = sp.effect
          if (e.xpPct) for (const [k, v] of Object.entries(e.xpPct)) eff.xpPct[k] = (eff.xpPct[k] ?? 0) + v * bondMult
          if (e.styleDmgPct) for (const [k, v] of Object.entries(e.styleDmgPct)) eff.styleDmgPct[k] = (eff.styleDmgPct[k] ?? 0) + v * bondMult
          if (e.dmgPct) eff.dmgPct += e.dmgPct * bondMult
          if (e.healPerTurnPct) eff.healPerTurnPct += e.healPerTurnPct * bondMult
          if (e.loseHpPerTurnPct) eff.loseHpPerTurnPct += e.loseHpPerTurnPct * bondMult
          if (e.fishingAccPct) eff.fishingAccPct += e.fishingAccPct * bondMult
          if (e.farmYieldBonus) eff.farmYieldBonus += e.farmYieldBonus * bondMult
        }
        return eff
      }
    },
    /** 奥义效果聚合（§3.4.1）— 函数 getter：gastronomyEffects() */
    gastronomyEffects(s) {
      return () => {
        const eff = { dmgPct: 0, styleDmgPct: {}, defensePct: 0, speedPct: 0, maxHpBonus: 0, yieldPct: 0, xpPct: 0, healPct: 0 }
        for (const id of s.gastronomy?.active ?? []) {
          const a = AOJIS.find((x) => x.id === id)
          if (!a?.effect) continue
          const e = a.effect
          if (e.dmgPct) eff.dmgPct += e.dmgPct
          if (e.styleDmgPct) for (const [k, v] of Object.entries(e.styleDmgPct)) eff.styleDmgPct[k] = (eff.styleDmgPct[k] ?? 0) + v
          if (e.defensePct) eff.defensePct += e.defensePct
          if (e.speedPct) eff.speedPct += e.speedPct
          if (e.maxHpBonus) eff.maxHpBonus += e.maxHpBonus
          if (e.yieldPct) eff.yieldPct += e.yieldPct
          if (e.xpPct) eff.xpPct += e.xpPct
          if (e.healPct) eff.healPct += e.healPct
        }
        return eff
      }
    },
    /** 技能等级上限：转生过 → 120（§3） */
    getMaxLevel: (s) => (id) => ((s.skills[id]?.prestiges ?? 0) > 0 ? PRESTIGE_MAX_LEVEL : MAX_LEVEL),
    /** 增益剂经验倍率（§3.4.2） */
    getXpMultiplier: (s) => () => {
      const b = s.buffs?.xpMult
      return b && Date.now() < b.expiresAt ? b.mult : 1
    },
    /** 增益剂产量倍率 */
    getYieldMultiplier: (s) => () => {
      const b = s.buffs?.yieldMult
      return b && Date.now() < b.expiresAt ? b.mult : 1
    },
    xpTotalForLevel: () => (level) => totalXpForLevel(level),
    /** 当前主线任务（§7.2） */
    currentQuest(s) {
      return QUESTS[s.quests.index] ?? null
    },
    /** 餐厅菜单槽位（§13） */
    restaurantSlots(s) {
      return Math.min(6, 2 + Math.floor((s.restaurant.level - 1) / 2))
    },
    /** 餐厅每小时收入 */
    restaurantHourlyIncome(s) {
      let total = 0
      for (const dishId of s.restaurant?.menu ?? []) {
        const item = getItem(dishId)
        if (!item) continue
        const schoolMult = 1 + (this.schoolIncomePct?.(item.category) ?? 0) / 100 // 菜系研究（2026-09-10）
        total += (item.value + (item.heal ?? 0)) * 0.5 * schoolMult
      }
      // 装饰加成：按每件装饰自身的收入%累加（各件 effect 随价格从 0.5% 到 3% 递增，无倒挂）
      let decorBonus = 0
      for (const id of s.restaurant?.decor ?? []) {
        const d = RESTAURANT_DECOR_BY_ID[id]
        if (d) decorBonus += (d.effect ?? 1) / 100
      }
      // 顾客好感小费（2026-09-06）：每级 +3%，封顶 20 级（+57%）
      const favorLv = favorLevelFromXp(s.restaurant?.favor?.xp ?? 0)
      const tip = (1 + 0.03 * (favorLv - 1)) * (1 + (this.regularTipPct?.() ?? 0) / 100)
      const stars = 1 + (this.michelinIncomePct?.() ?? 0) / 100 // 米其林星级（2026-09-10）
      const staffMult = 1 + (this.staffIncomePct?.() ?? 0) / 100 // 雇工班底（2026-09-10）
      const patronIncome = 1 + (this.patronEffects?.()?.incomePct ?? 0) / 100 // 食神信仰（2026-09-10）
      // 夜市狂潮（2026-09-06）：12-20 点餐厅收入 ×2
      const market = this.marketBoost?.() ?? { restaurant: 1, combatXp: 1 }
      return total * (1 + 0.3 * (s.restaurant.level - 1)) * (1 + decorBonus) * tip * stars * staffMult * patronIncome * market.restaurant
    },
    /** 公会被动效果（§13）— 函数 getter：guildEffects() */
    guildEffects(s) {
      return () => getGuild(s.guild?.id)?.passive ?? {}
    },
    /** 采集技能总等级（公会加入需求，§13） */
    gatherLevels(s) {
      return ['foraging', 'fishing', 'hunting', 'excavation', 'farming'].reduce((a, id) => a + (s.skills[id]?.level ?? 1), 0)
    },
    /** 制作技能总等级（公会加入需求，§13） */
    craftLevels(s) {
      return ['cooking', 'baking', 'preserving', 'brewing', 'spiceMixing', 'craftsmithing'].reduce((a, id) => a + (s.skills[id]?.level ?? 1), 0)
    },
    /** 辅助技能总等级（公会加入需求，§13） */
    supportLevels(s) {
      return ['preservation', 'exploration', 'spiritSummoning', 'gastronomy'].reduce((a, id) => a + (s.skills[id]?.level ?? 1), 0)
    },
    /** 当前活跃赛季定义（§13） */
    activeSeasonDef(s) {
      return getSeason(activeSeasonId())
    },
  },

  actions: {
    newGame() {
      // 全新档：整体重置为默认状态（单一来源 defaultState，防止嵌套字段残留/漂移，2026-09-06）
      this.$state = defaultState()
    },

    applySave(saved) {
      if (!saved) return
      const skills = defaultSkills()
      for (const [id, s] of Object.entries(saved.skills ?? {})) {
        if (skills[id]) skills[id] = { ...skills[id], ...s, mastery: s.mastery ?? {}, prestiges: s.prestiges ?? 0 }
      }
      this.$patch({
        name: saved.name ?? this.name,
        title: saved.title ?? null,
        avatar: saved.avatar ?? null,
        gold: saved.gold ?? 0,
        gameCoins: saved.gameCoins ?? 0,
        shopOwned: saved.shopOwned ?? {},
        nameColor: saved.nameColor ?? null,
        skills,
        inventory: saved.inventory ?? {},
        bank: saved.bank ?? {},
        inventoryCap: Math.min(saved.inventoryCap ?? 20, 100),
        bankCap: Math.min(saved.bankCap ?? 100, 500),
        hardcore: !!saved.hardcore,
        pausedSkills: saved.pausedSkills ?? {},
        closedIdleTasks: saved.closedIdleTasks ?? {},
        equipment: { ...defaultEquipment(), ...(saved.equipment ?? {}) },
        activeSkill: saved.activeSkill && SKILL_DEFS[saved.activeSkill] ? saved.activeSkill : 'foraging',
        activeTarget: saved.activeTarget ?? null,
        skillTargets: saved.skillTargets ?? { [saved.activeSkill ?? 'foraging']: saved.activeTarget ?? 'apple' },
        settings: { ...this.settings, ...(saved.settings ?? {}) },
        farming: { plots: Array.isArray(saved.farming?.plots) ? saved.farming.plots : [] },
        offlineBonusH: Math.min(saved.offlineBonusH ?? 0, 12),
        combat: { ...this.combat, ...(saved.combat ?? {}) },
        spirits: { active: Array.isArray(saved.spirits?.active) ? saved.spirits.active : [], owned: saved.spirits?.owned ?? {} },
        gastronomy: { active: Array.isArray(saved.gastronomy?.active) ? saved.gastronomy.active : [] },
        tastePoints: saved.tastePoints ?? 0,
        buffs: { xpMult: saved.buffs?.xpMult ?? null, yieldMult: saved.buffs?.yieldMult ?? null },
        spoilage: saved.spoilage ?? {},
        coldStorage: saved.coldStorage ?? {},
        coldStorageCap: Math.min(saved.coldStorageCap ?? 5, 100),
        achievements: Array.isArray(saved.achievements) ? saved.achievements : [],
        collected: saved.collected ?? {},
        quests: { index: saved.quests?.index ?? 0, completed: saved.quests?.completed ?? [], progress: saved.quests?.progress ?? {} },
        stats: { ...this.stats, ...(saved.stats ?? {}) },
        restaurant: { level: saved.restaurant?.level ?? 1, menu: saved.restaurant?.menu ?? [], incomeAccum: saved.restaurant?.incomeAccum ?? 0, decor: saved.restaurant?.decor ?? [] },
        guild: { id: saved.guild?.id ?? null, points: saved.guild?.points ?? 0, day: saved.guild?.day ?? null, taskProgress: saved.guild?.taskProgress ?? {} },
        seasons: saved.seasons ?? {},
        signIn: saved.signIn ?? { lastDate: null, day: 0 },
        upgrades: saved.upgrades ?? {},
        daily: saved.daily ?? { day: null, streak: 0, tasks: [], claimedAll: false },
        weekly: saved.weekly ?? { week: null, task: null, progress: 0, claimed: false },
        challenge: saved.challenge ?? { week: null, id: null, progress: 0, done: false },
        challengeBest: saved.challengeBest ?? {},
        realm: saved.realm ?? { active: false, floor: 0, buffs: [], best: 0, pending: null },
        insights: Array.isArray(saved.insights) ? saved.insights : [],
        tower: saved.tower ?? { floor: 1, best: 0, rewarded: [] },
        fest: saved.fest ?? { month: null, score: 0, entries: [], lastEntryDay: null, todayEntries: 0, rewarded: [] },
        spiritBonds: saved.spiritBonds ?? {},
        hardcoreStats: saved.hardcoreStats ?? { days: 0, best: 0 },
        guide: saved.guide ?? { step: 0, done: false },
        setBonuses: saved.setBonuses ?? [],
        mijian: saved.mijian ?? { stats: { pulls: 0, spent: 0, gearRare: 0 }, pity: 0, history: [] },
        craftQueues: saved.craftQueues ?? {}, // 制作队列：{ skillId: [{recipeId, qty, paused}] }
        gearMods: saved.gearMods ?? {}, // 装备词条：{ slot: { itemId, mods } }
        gemSockets: saved.gemSockets ?? {}, // 宝石镶嵌：{ slot: { itemId, gems } }
        orders: saved.orders ?? { list: [], nextAt: 0 }, // 食客订单
        expeditions: saved.expeditions ?? {}, // 远行采集队
        cellar: saved.cellar ?? { slots: [], expands: 0 }, // 地窖陈酿
        regulars: saved.regulars ?? {}, // 常客名录
        spiritStories: saved.spiritStories ?? {}, // 食灵物语
        automation: saved.automation ?? { unlocked: {}, sellThreshold: SELL_THRESHOLD_DEFAULT, standby: {} }, // 自动化中心
        ranch: saved.ranch ?? { pens: [null, null], expands: 0 }, // 牧场
        branches: saved.branches ?? {}, // 餐厅分店
        michelin: saved.michelin ?? { score: 0, stars: 0, best: 0, lastReviewDay: null }, // 米其林评级
        flavors: saved.flavors ?? {}, // 风味搭配册
        gearContest: saved.gearContest ?? { week: null, score: 0, rank: null, best: 0, runs: 0 }, // 厨具大赛
        schools: saved.schools ?? {}, // 菜系研究
        staff: saved.staff ?? {}, // 雇工班底
        regions: saved.regions ?? {}, // 产地考察
        regionPosting: saved.regionPosting ?? {}, // 采集队派驻
        legacy: saved.legacy ?? { carry: {}, apprentice: { level: 0, lastDay: null } }, // 师徒传承
        patron: saved.patron ?? { active: null, levels: {}, lastSwitchAt: 0 }, // 食神信仰
        chronicle: Array.isArray(saved.chronicle) ? saved.chronicle : [], // 厨师年鉴
        mascots: saved.mascots ?? { owned: {}, active: null, pets: {}, lastPetDay: null }, // 吉祥物
        banquet: saved.banquet ?? { order: null, done: 0, failed: 0 }, // 宴会承办
        takeout: saved.takeout ?? { exp: 0, lastAt: 0, sold: 0, gold: 0 }, // 外卖业务
        branchThemes: saved.branchThemes ?? {}, // 分店主题
        contracts: saved.contracts ?? {}, // 供应商合约
        chefChallenge: saved.chefChallenge ?? { week: null, cleared: [], current: null }, // 名厨挑战
        exchange: saved.exchange ?? { dayKey: null, traded: {} }, // 交易所
        trials: saved.trials ?? {}, // 厨神试炼
        critic: saved.critic ?? { order: null, nextAt: 0 }, // 美食评论家
        plan: saved.plan ?? { active: false, index: 0, steps: [] }, // 挂机计划
        minigames: saved.minigames ?? { heat: { day: 0, streak: 0, bestStreak: 0 }, trivia: { week: '', answered: 0, correct: 0, badges: 0 }, kitchen2048: { best: 0 }, foodrush: { day: 0, best: 0, rewarded: 0 }, puzzle: { day: '', done: 0 }, matchfood: { day: '', buffed: 0 } },
        lastOnlineAt: saved.lastOnlineAt ?? Date.now(),
      })
      // 食灵阁迁移（2026-09-06）：旧档背包内的食灵物品移入独立食灵阁（不占背包格）
      const owned = { ...(this.spirits?.owned ?? {}) }
      let migrated = 0
      for (const [itemId, qty] of Object.entries(this.inventory ?? {})) {
        if (getItem(itemId)?.type === 'spirit' && qty > 0) {
          owned[itemId] = (owned[itemId] ?? 0) + qty
          delete this.inventory[itemId]
          migrated += qty
        }
      }
      if (migrated > 0) this.spirits = { ...(this.spirits ?? {}), owned }
      this.syncGemSockets() // 读档后补全镶嵌记录（2026-09-09）
    },

    serialize() {
      return {
        name: this.name,
        title: this.title,
        avatar: this.avatar,
        gold: this.gold,
        gameCoins: this.gameCoins,
        shopOwned: this.shopOwned,
        nameColor: this.nameColor,
        skills: this.skills,
        inventory: this.inventory,
        bank: this.bank,
        inventoryCap: this.inventoryCap,
        bankCap: this.bankCap,
        hardcore: this.hardcore,
        pausedSkills: this.pausedSkills,
        closedIdleTasks: this.closedIdleTasks,
        equipment: this.equipment,
        activeSkill: this.activeSkill,
        activeTarget: this.activeTarget,
        skillTargets: this.skillTargets,
        settings: this.settings,
        farming: this.farming,
        offlineBonusH: this.offlineBonusH,
        combat: this.combat,
        spirits: this.spirits,
        gastronomy: this.gastronomy,
        tastePoints: this.tastePoints,
        buffs: this.buffs,
        spoilage: this.spoilage,
        coldStorage: this.coldStorage,
        coldStorageCap: this.coldStorageCap,
        achievements: this.achievements,
        collected: this.collected,
        quests: this.quests,
        stats: this.stats,
        restaurant: this.restaurant,
        guild: this.guild,
        seasons: this.seasons,
        signIn: this.signIn,
        upgrades: this.upgrades,
        daily: this.daily,
        weekly: this.weekly,
        challenge: this.challenge,
        challengeBest: this.challengeBest,
        realm: this.realm,
        insights: this.insights,
        tower: this.tower,
        fest: this.fest,
        spiritBonds: this.spiritBonds,
        hardcoreStats: this.hardcoreStats,
        guide: this.guide,
        setBonuses: this.setBonuses,
        mijian: this.mijian,
        craftQueues: this.craftQueues,
        gearMods: this.gearMods,
        gemSockets: this.gemSockets,
        orders: this.orders,
        expeditions: this.expeditions,
        cellar: this.cellar,
        regulars: this.regulars,
        spiritStories: this.spiritStories,
        automation: this.automation,
        ranch: this.ranch,
        branches: this.branches,
        michelin: this.michelin,
        flavors: this.flavors,
        gearContest: this.gearContest,
        schools: this.schools,
        staff: this.staff,
        regions: this.regions,
        regionPosting: this.regionPosting,
        legacy: this.legacy,
        patron: this.patron,
        chronicle: this.chronicle,
        mascots: this.mascots,
        banquet: this.banquet,
        takeout: this.takeout,
        branchThemes: this.branchThemes,
        contracts: this.contracts,
        chefChallenge: this.chefChallenge,
        exchange: this.exchange,
        trials: this.trials,
        critic: this.critic,
        plan: this.plan,
        minigames: this.minigames,
        lastOnlineAt: this.lastOnlineAt,
      }
    },

    gainGold(amount) {
      // 装备词条「金币 +%」（仅穿戴着生效）
      const gm = this.equippedStats.goldPct ?? 0
      const n = Math.floor(amount * (1 + gm / 100))
      if (n > 0) {
        this.gold += n
        this.stats.totalGoldEarned += n
      }
    },
    gainGameCoins(amount) {
      // 游戏币（小游戏奖励，无词条加成）
      const n = Math.floor(amount)
      if (n > 0) this.gameCoins += n
    },
    spendGameCoins(amount) {
      // 游戏商店消费（2026-09-07）
      if (this.gameCoins >= amount) {
        this.gameCoins -= amount
        return true
      }
      return false
    },
    /** 游戏商店「制作加速器」：对全部制作类技能队列快进 min 分钟（等价 engine tick，材料不足自动暂停/停止） */
    boostCraftQueues(minutes = 10) {
      const n = Math.round((minutes * 60 * 1000) / 3000) // 每 3 秒 1 份
      let made = 0
      for (const inst of getAllSkillInstances()) {
        if (inst.type !== 'production') continue
        for (let k = 0; k < n; k++) {
          const q = inst.craftQueue
          if (!q || !q.length || q[0]?.paused) break
          const before = q[0].qty
          inst.tick(600_000)
          if (q[0]?.paused) break // 材料不足自动暂停
          if (q[0]?.qty !== before || !q.length) made++
          else break // 无变化（异常保护）
        }
      }
      return made
    },

    spendGold(amount) {
      const cost = Math.floor(amount)
      if (!(cost > 0)) return false // 负数/零消费拒绝（防刷钱）
      if (cost > this.gold) return false
      this.gold -= cost
      return true
    },

    /** 获得物品：入图鉴 + 腐坏计时（§5.4 堆叠刷新）；背包满时拒绝新种类并提示 */
    /** 保鲜被动：保鲜技能等级越高，腐坏越慢（每级 +2%，封顶 +100%）。返回加成后的食材腐坏时长（ms） */
    freshMsFor(item) {
      if (!item?.spoilMs) return 0
      const lv = this.skills?.preservation?.level ?? 1
      const bonus = Math.min(1, (lv - 1) * 0.02)
      return Math.round(item.spoilMs * (1 + bonus))
    },

    gainItem(itemId, qty = 1) {
      if (!(qty > 0)) return false
      const item = getItem(itemId)
      // §5.4 容量：不同物品种类数限制（已有种类不占新格）
      if (!(itemId in this.inventory) && this.inventorySlotsUsed >= this.inventoryCap) {
        EventBus.emit('inventory:full', { itemId })
        return false
      }
      // §5.4 堆叠上限：食材/料理 9999；不可堆叠物品（装备等）上限 1
      const cap = item?.stackable === false ? 1 : item?.maxStack ?? 9999
      const have = this.inventory[itemId] ?? 0
      const add = Math.max(0, Math.min(qty, cap - have))
      if (add > 0) this.inventory[itemId] = have + add
      if (!this.collected[itemId]) this.gainInsight(1) // 菜系图谱：图鉴首次收集 +1（2026-09-09）
      this.collected[itemId] = true
      if (item?.spoilMs) this.spoilage[itemId] = Date.now() + this.freshMsFor(item)
      return add > 0
    },

    gainItems(items) {
      for (const [id, qty] of Object.entries(items)) this.gainItem(id, qty)
    },

    spendItems(items) {
      for (const [id, qty] of Object.entries(items)) this.spendItem(id, qty)
    },

    spendItem(itemId, qty = 1) {
      if (!(qty > 0)) return false // 负数/零消耗拒绝（防刷物品）
      const have = this.inventory[itemId] ?? 0
      if (have < qty) return false
      if (have === qty) {
        delete this.inventory[itemId]
        delete this.spoilage[itemId]
      } else {
        this.inventory[itemId] = have - qty
      }
      return true
    },

    // ── 仓库（§5.4）──
    /** 背包 → 仓库（qty 为 null 时全部） */
    moveToBank(itemId, qty = null) {
      const have = this.inventory[itemId] ?? 0
      const amount = qty === null ? have : Math.min(qty, have)
      if (amount <= 0) return false
      if (!(itemId in this.bank) && this.bankSlotsUsed >= this.bankCap) {
        EventBus.emit('bank:full', { itemId })
        return false
      }
      this.bank[itemId] = (this.bank[itemId] ?? 0) + amount
      this.spendItem(itemId, amount)
      return true
    },
    /** 仓库 → 背包 */
    moveToInventory(itemId, qty = null) {
      const have = this.bank[itemId] ?? 0
      const amount = qty === null ? have : Math.min(qty, have)
      if (amount <= 0) return false
      if (!(itemId in this.inventory) && this.inventorySlotsUsed >= this.inventoryCap) {
        EventBus.emit('inventory:full', { itemId })
        return false
      }
      this.gainItem(itemId, amount)
      if (have === amount) delete this.bank[itemId]
      else this.bank[itemId] = have - amount
      return true
    },

    // ── 冷库（§5.4 冻结腐坏）──
    /** 背包 → 冷库：只能存有腐坏时长的食材，存入即冻结腐坏倒计时（记录剩余时长） */
    depositToColdStorage(itemId, qty = null) {
      const item = getItem(itemId)
      if (!item?.spoilMs) return false // 仅腐坏食材可入冷库
      const have = this.inventory[itemId] ?? 0
      const amount = qty === null ? have : Math.min(qty, have)
      if (amount <= 0) return false
      // 容量判定：新食材需占用一个格子，超出容积则拒绝（可先扩充）
      if (!(itemId in this.coldStorage) && this.coldStorageSlotsUsed >= this.coldStorageCap) return false
      // 冻结：记录存入时剩余的腐坏时长（剩余毫秒，不随现实时间消耗）
      const remainMs = this.spoilage[itemId] ? Math.max(0, this.spoilage[itemId] - Date.now()) : item.spoilMs
      this.spendItem(itemId, amount)
      if (!this.coldStorage[itemId]) this.coldStorage[itemId] = { qty: 0, remainMs }
      this.coldStorage[itemId].qty += amount
      return true
    },
    /** 冷库 → 背包：恢复冻结时的腐坏剩余时长（从暂停处继续计时） */
    withdrawFromColdStorage(itemId, qty = null) {
      const cs = this.coldStorage[itemId]
      if (!cs) return false
      const amount = qty === null ? cs.qty : Math.min(qty, cs.qty)
      if (amount <= 0) return false
      if (!(itemId in this.inventory) && this.inventorySlotsUsed >= this.inventoryCap) {
        EventBus.emit('inventory:full', { itemId })
        return false
      }
      this.inventory[itemId] = (this.inventory[itemId] ?? 0) + amount
      // 恢复腐坏计时（从冻结时的剩余时长继续，而非重置为满时长）
      if (getItem(itemId)?.spoilMs) this.spoilage[itemId] = Date.now() + cs.remainMs
      cs.qty -= amount
      if (cs.qty <= 0) delete this.coldStorage[itemId]
      return true
    },
    /** 一键冻存：把背包所有会腐坏的食材全部存入冷库（受容量限制），返回存入的食材种类数 */
    depositAllToColdStorage() {
      let stored = 0
      for (const id of Object.keys(this.inventory)) {
        if ((this.inventory[id] ?? 0) > 0 && getItem(id)?.spoilMs) {
          if (this.depositToColdStorage(id, null)) stored++
        }
      }
      return stored
    },

    // ── 出售（§11.3：出售价 = 价值 × 0.5）──
    /** 一键入仓：背包内全部可转移物品（非装备/非食灵）存入仓库；返回转移种类数 */
    moveAllToBank() {
      let moved = 0
      for (const id of Object.keys(this.inventory)) {
        const it = getItem(id)
        if (it?.type === 'equipment' || it?.type === 'spirit') continue
        if ((this.inventory[id] ?? 0) > 0 && this.moveToBank(id, null)) moved++
      }
      return moved
    },
    /** 一键入包：仓库全部物品（含装备/食灵）尽可能移回背包；返回移入种类数 */
    moveAllToInventory() {
      let moved = 0
      for (const id of Object.keys(this.bank)) {
        if ((this.bank[id] ?? 0) > 0 && this.moveToInventory(id, null)) moved++
      }
      return moved
    },
    /** 一键出售全部「普通/精良」品质装备（低品质淘汰）；返回出售件数 */
    sellCommonEquipment() {
      let sold = 0
      for (const id of Object.keys(this.inventory)) {
        const it = getItem(id)
        if (it?.type !== 'equipment' || !['普通', '精良'].includes(it.quality)) continue
        const qty = this.inventory[id] ?? 0
        if (qty > 0 && this.sellItem(id, qty)) sold += qty
      }
      return sold
    },
    sellItem(itemId, qty = 1) {
      if (!(qty > 0)) return false
      const have = this.inventory[itemId] ?? 0
      if (have < qty) return false
      const item = getItem(itemId)
      if (!item) return false
      const price = Math.max(1, Math.floor(item.value * 0.5)) * qty
      this.spendItem(itemId, qty)
      this.gainGold(price)
      return true
    },

    // ── 容量扩展（§5.4）──
    expandInventory(n = 10) {
      if (this.inventoryCap >= 100) return false
      this.inventoryCap = Math.min(100, this.inventoryCap + n)
      return true
    },
    expandBank(n = 20) {
      if (this.bankCap >= 500) return false
      this.bankCap = Math.min(500, this.bankCap + n)
      return true
    },
    /** 冷库容量扩充（§5.4）：每次 +1 格花 1000 金币，上限 100 */
    expandColdStorage() {
      if (this.coldStorageCap >= 100) return { ok: false, msg: '冷库已达上限 100 格' }
      const COST = 1000
      if (this.gold < COST) return { ok: false, msg: `金币不足（需 ${COST} 金币）` }
      this.gold -= COST
      this.coldStorageCap = Math.min(100, this.coldStorageCap + 1)
      return { ok: true, msg: `冷库扩容到 ${this.coldStorageCap} 格` }
    },

    setSkillState(id, patch) {
      if (!this.skills[id]) this.skills[id] = { level: 1, exp: 0, mastery: {}, prestiges: 0 }
      this.skills[id] = { ...this.skills[id], ...patch }
    },

    addMastery(skillId, itemId, amount = 1) {
      if (!this.skills[skillId]) this.skills[skillId] = { level: 1, exp: 0, mastery: {}, prestiges: 0 }
      // 采集类技能每次产出都计入轶事「采集·<技能>·<物品>」进度（覆盖各采集子类，含自定义 performAction 的采摘等）
      if (SKILL_DEFS[skillId]?.category === 'gathering' && itemId) this.bumpStory('gather', skillId + ':' + itemId)
      const m = this.skills[skillId].mastery
      const before = masteryLevelFromCount(m[itemId] ?? 0)
      m[itemId] = (m[itemId] ?? 0) + amount
      const after = masteryLevelFromCount(m[itemId])
      if (after > before) {
        EventBus.emit('mastery:levelup', { skillId, itemId, level: after })
      }
    },

    /** 记录轶事/故事的具体进度（按物品/对手/动作累计，不随任务重置） */
    bumpStory(kind, param) {
      if (!param) return
      const key = kind + ':' + param
      this.storyProgress[key] = (this.storyProgress[key] ?? 0) + 1
    },

    setActiveSkill(id) {
      if (SKILL_DEFS[id]) this.activeSkill = id
    },

    /** 设置自定义头像（base64 dataUrl） */
    setAvatar(dataUrl) {
      this.avatar = dataUrl || null
      if (this.avatar) this.pushLog?.('头像已更新', 'info')
    },

    /** 修改玩家昵称 */
    setName(newName) {
      const n = ('' + newName).trim().slice(0, 16)
      if (!n) return { ok: false, msg: '名字不能为空' }
      this.name = n
      return { ok: true }
    },

    setPlot(i, plot) {
      while (this.farming.plots.length <= i) this.farming.plots.push(null)
      this.farming.plots[i] = plot
    },
    clearPlot(i) {
      if (i < this.farming.plots.length) this.farming.plots[i] = null
    },

    equip(itemId) {
      const item = getItem(itemId)
      if (!item || item.type !== 'equipment') return false
      const slot = item.slot
      if (!(slot in this.equipment)) return false
      if (!this.spendItem(itemId, 1)) return false
      const old = this.equipment[slot]
      if (old) this.gainItem(old, 1)
      this.equipment[slot] = itemId
      // 词条：换穿不同装备 → 重新掷词条；同件保留原词条（含洗练结果）
      if (!this.gearMods) this.gearMods = {}
      const cur = this.gearMods[slot]
      if (!cur || cur.itemId !== itemId) {
        this.gearMods[slot] = { itemId, mods: rollGearMods(item) }
      }
      // 宝石插槽（2026-09-09）：同件保留；换件先退回旧宝石，再按新装备品质初始化
      if (!this.gemSockets) this.gemSockets = {}
      const prevSock = this.gemSockets[slot]
      if (prevSock && prevSock.itemId !== itemId) this._returnGemSockets(slot)
      const sockN = socketCountOf(item)
      if (sockN > 0 && !this.gemSockets[slot]) this.gemSockets[slot] = { itemId, gems: new Array(sockN).fill(null) }
      return true
    },

    unequip(slot) {
      const itemId = this.equipment[slot]
      if (!itemId) return false
      this.equipment[slot] = null
      this.gainItem(itemId, 1)
      this._returnGemSockets(slot) // 卸下时退回镶嵌的宝石（不丢失）
      return true
    },

    /** 清空某槽位镶嵌记录并把宝石退回背包（换装/卸下调用） */
    _returnGemSockets(slot) {
      const rec = this.gemSockets?.[slot]
      if (!rec) return
      for (const id of rec.gems ?? []) if (id) this.gainItem(id, 1)
      delete this.gemSockets[slot]
    },

    /** 补全穿戴物状态（读档/旧档后调用）：缺失的词条记录重掷、按品质初始化宝石插槽、槽数不符时截断/补齐 */
    syncGemSockets() {
      if (!this.gemSockets) this.gemSockets = {}
      if (!this.gearMods) this.gearMods = {}
      for (const [slot, itemId] of Object.entries(this.equipment ?? {})) {
        if (!itemId) {
          if (this.gemSockets[slot]) this._returnGemSockets(slot)
          continue
        }
        const item = getItem(itemId)
        // 词条：存档里已穿戴但没有词条记录（旧档/直存）→ 补掷（与 equip() 同口径）
        if (!this.gearMods[slot] || this.gearMods[slot].itemId !== itemId) {
          this.gearMods[slot] = { itemId, mods: rollGearMods(item) }
        }
        const n = socketCountOf(item)
        const rec = this.gemSockets[slot]
        if (n <= 0) {
          if (rec) this._returnGemSockets(slot)
          continue
        }
        if (!rec || rec.itemId !== itemId) {
          if (rec) this._returnGemSockets(slot)
          this.gemSockets[slot] = { itemId, gems: new Array(n).fill(null) }
        } else if (rec.gems.length !== n) {
          rec.gems = rec.gems.slice(0, n)
          while (rec.gems.length < n) rec.gems.push(null)
        }
      }
    },

    /** 镶嵌宝石（消耗 1 个宝石物品；插槽状态与穿戴物绑定） */
    socketGem(slot, index, gemId) {
      const itemId = this.equipment[slot]
      const item = itemId ? getItem(itemId) : null
      if (!item || item.type !== 'equipment') return { ok: false, msg: '该槽位没有穿戴装备' }
      if (!gemDef(gemId)) return { ok: false, msg: '该物品不能作为宝石镶嵌' }
      const rec = this.gemSockets?.[slot]
      if (!rec || rec.itemId !== itemId) return { ok: false, msg: '插槽状态异常（请重新穿戴）' }
      if (!(index >= 0 && index < rec.gems.length)) return { ok: false, msg: '插槽不存在' }
      if (rec.gems[index]) return { ok: false, msg: '该插槽已有宝石' }
      if (!this.spendItem(gemId, 1)) return { ok: false, msg: '没有该宝石' }
      rec.gems[index] = gemId
      this.stats.gemsSocketed = (this.stats.gemsSocketed ?? 0) + 1
      return { ok: true }
    },

    /** 拆卸宝石（返还物品；背包满时拒绝） */
    unsocketGem(slot, index) {
      const rec = this.gemSockets?.[slot]
      const id = rec?.gems?.[index]
      if (!id) return { ok: false, msg: '该插槽为空' }
      if (!this.gainItem(id, 1)) return { ok: false, msg: '背包已满，无法拆卸' }
      rec.gems[index] = null
      return { ok: true, itemId: id }
    },

    /** 装备词条洗练（重随词条数量/类型/数值） */
    rerollGearMod(slot) {
      const itemId = this.equipment[slot]
      const item = itemId ? getItem(itemId) : null
      if (!item || item.type !== 'equipment') return { ok: false, msg: '该槽位没有穿戴装备' }
      const cost = REROLL_COST[item.quality] ?? REROLL_COST['普通']
      if (this.gold < cost) return { ok: false, msg: `洗练需要 ${cost} 金币` }
      this.gold -= cost
      if (!this.gearMods) this.gearMods = {}
      this.gearMods[slot] = { itemId, mods: rollGearMods(item) }
      return { ok: true, cost, mods: this.gearMods[slot].mods }
    },

    consumeEnergyBiscuit() {
      if ((this.inventory.energyBiscuit ?? 0) < 1) return false
      if (this.offlineBonusH >= 12) return false
      this.spendItem('energyBiscuit', 1)
      this.offlineBonusH = Math.min(this.offlineBonusH + 4, 12)
      return true
    },

    /** 通用道具使用（§3.4.2 保鲜剂/增益剂） */
    useItem(itemId) {
      const item = getItem(itemId)
      if (!item?.use) return { ok: false, msg: '无法使用' }
      if ((this.inventory[itemId] ?? 0) < 1) return { ok: false, msg: '数量不足' }
      const u = item.use
      if (u.refreshSpoilMs) {
        this.spendItem(itemId, 1)
        let refreshed = 0
        for (const [id, qty] of Object.entries(this.inventory)) {
          const it = getItem(id)
          if (qty > 0 && it?.spoilMs) {
            // 按各食材自身等级刷新腐坏计时（含保鲜被动加成），越高级越耐放
            this.spoilage[id] = Date.now() + this.freshMsFor(it)
            refreshed++
          }
        }
        // 冷库续时：给冻存食材延长剩余时长（按保鲜剂自身时长追加）
        let coldCount = 0
        for (const cs of Object.values(this.coldStorage)) {
          cs.remainMs += u.refreshSpoilMs
          coldCount++
        }
        return { ok: true, msg: `保鲜剂生效：${refreshed} 种背包食材已刷新，${coldCount} 种冷库食材续时` }
      }
      if (u.buffXp) {
        this.spendItem(itemId, 1)
        this.buffs.xpMult = { mult: u.buffXp.mult, expiresAt: Date.now() + u.buffXp.minutes * 60_000 }
        return { ok: true, msg: `经验增益：${u.buffXp.mult}×，持续 ${u.buffXp.minutes} 分钟` }
      }
      if (u.buffYield) {
        this.spendItem(itemId, 1)
        this.buffs.yieldMult = { mult: u.buffYield.mult, expiresAt: Date.now() + u.buffYield.minutes * 60_000 }
        return { ok: true, msg: `产量增益：${u.buffYield.mult}×，持续 ${u.buffYield.minutes} 分钟` }
      }
      return { ok: false, msg: '未知效果' }
    },

    // ── 食灵（§3.3.6）：食灵阁 owned 不占背包格（2026-09-06）──
    /** 获得食灵（召唤产物直接入食灵阁；图鉴收集照常标记） */
    gainSpirit(spiritId, qty = 1) {
      if (getItem(spiritId)?.type !== 'spirit') return false
      const n = Math.max(1, Math.floor(qty))
      if (!this.spirits?.owned) {
        this.spirits = { active: this.spirits?.active ?? [], owned: {} }
      }
      this.spirits.owned[spiritId] = (this.spirits.owned[spiritId] ?? 0) + n
      this.collected[spiritId] = true
      return true
    },
    setSpiritActive(spiritId, on) {
      const active = [...this.spirits.active]
      if (on) {
        if (active.includes(spiritId)) return false
        if (active.length >= SPIRIT_SLOTS) return false
        if ((this.spirits.owned?.[spiritId] ?? 0) < 1) return false
        this.spirits.owned[spiritId] -= 1
        this.spirits.active = [...active, spiritId]
        return true
      }
      if (!active.includes(spiritId)) return false
      this.spirits.active = active.filter((x) => x !== spiritId)
      if (!this.spirits.owned) this.spirits.owned = {}
      this.spirits.owned[spiritId] = (this.spirits.owned[spiritId] ?? 0) + 1
      return true
    },

    // ── 奥义（§3.4.1）──
    toggleAoji(id) {
      const active = [...this.gastronomy.active]
      if (active.includes(id)) {
        this.gastronomy.active = active.filter((x) => x !== id)
        if (this._aojiActivatedAt) delete this._aojiActivatedAt[id]
        return false
      }
      if (!AOJIS.some((a) => a.id === id)) return false
      this.gastronomy.active = [...active, id]
      // 宽限试用期：记录激活时刻，前 10 秒免费试运行（不扣品鉴点）
      this._aojiActivatedAt = this._aojiActivatedAt ?? {}
      this._aojiActivatedAt[id] = Date.now()
      // 美食知识·使用次数：每次激活奥义计一次（按奥义 id）
      this.bumpStory('support', 'gastronomy:' + id)
      return true
    },

    gainTastePoints(n) {
      if (n > 0) this.tastePoints += Math.floor(n)
    },

    /** 每帧：奥义点数消耗（§3.4.1，每秒结算；激活后 10 秒宽限免费） */
    drainAoji(deltaMs) {
      const active = this.gastronomy.active
      if (!active.length) return
      // 点数归零：立即全部关闭（防止边缘状态不一致）
      if (this.tastePoints <= 0) {
        this.gastronomy.active = []
        return
      }
      const now = Date.now()
      const GRACE = 10000 // 宽限试用期（ms）
      let cost = 0
      for (const id of active) {
        const a = AOJIS.find((x) => x.id === id)
        if (!a) continue
        // 宽限内免费（不扣品鉴点）：让玩家先看效果再决定长期开
        const at = this._aojiActivatedAt?.[id]
        if (at && now - at < GRACE) continue
        cost += a.costPerSec
      }
      if (cost <= 0) return
      this._aojiAccum = (this._aojiAccum ?? 0) + (deltaMs / 1000) * cost
      const whole = Math.floor(this._aojiAccum)
      if (whole > 0) {
        this._aojiAccum -= whole
        this.tastePoints = Math.max(0, this.tastePoints - whole)
        if (this.tastePoints <= 0) {
          this.gastronomy.active = []
          EventBus.emit('gastronomy:off', {})
        }
      }
    },

    // ── 腐坏（§5.4）──
    checkSpoilage(now) {
      for (const [id, spoilAt] of Object.entries(this.spoilage)) {
        if (!(this.inventory[id] ?? 0)) {
          delete this.spoilage[id]
          continue
        }
        if (now >= spoilAt) {
          delete this.inventory[id]
          delete this.spoilage[id]
          EventBus.emit('spoilage:spoil', { itemId: id })
        }
      }
    },

    // ── 成就（§6）──
    checkAchievements() {
      for (const def of ALL_ACHIEVEMENTS) {
        if (this.achievements.includes(def.id)) continue
        if (!def.check(this)) continue
        this.achievements.push(def.id)
        if (def.reward?.gold) this.gainGold(def.reward.gold)
        if (def.reward?.items) this.gainItems(def.reward.items)
        if (def.title && !this.title) this.title = def.title
        this.gainInsight(5) // 菜系图谱：成就解锁 +5（2026-09-09）
        EventBus.emit('achievement:unlock', { id: def.id, name: def.name, reward: def.reward })
      }
    },

    // ── 主线任务（§7.2）──
    bumpQuest(kind, param) {
      const q = this.currentQuest
      if (!q) return
      for (const obj of q.objectives) {
        if (obj.kind === kind && (obj.param === param || obj.param === 'any')) {
          const key = questObjectiveKey(obj)
          this.quests.progress[key] = (this.quests.progress[key] ?? 0) + 1
        }
      }
      this.finishQuestIfReady(q)
    },
    /** 特殊类型目标（skillLevel30 等）在周期检查中同步 */
    syncQuestProgress() {
      const q = this.currentQuest
      if (!q) return
      for (const obj of q.objectives) {
        const key = questObjectiveKey(obj)
        switch (obj.kind) {
          case 'skillLevel30': {
            const lv = obj.param === 'any' ? 30 : (Number(obj.param) || 30)
            this.quests.progress[key] = Object.values(this.skills).filter((s) => (s.level ?? 1) >= lv).length
            break
          }
          case 'gold': this.quests.progress[key] = this.stats?.totalGoldEarned ?? 0; break
          case 'collection': this.quests.progress[key] = this.collectionPct; break
          case 'seasons': this.quests.progress[key] = Object.values(this.seasons ?? {}).filter((s) => (s.claimed?.length ?? 0) > 0).length; break
          case 'card': this.quests.progress[key] = this.stats?.cardBattle?.wins ?? 0; break
          case 'arena': this.quests.progress[key] = this.stats?.arena?.bestStreak ?? 0; break
          case 'restaurant': this.quests.progress[key] = this.restaurant?.level ?? 1; break
          case 'gear': this.quests.progress[key] = Object.keys(this.collected ?? {}).filter((id) => getItem(id)?.type === 'equipment').length; break
          case 'upgrades': this.quests.progress[key] = Object.values(this.upgrades ?? {}).filter((v) => v > 0).length; break
          case 'prestiges': this.quests.progress[key] = this.stats?.prestiges ?? 0; break
          case 'guild': this.quests.progress[key] = this.guild?.id ? 1 : 0; break
          default: break
        }
      }
      this.finishQuestIfReady(q)
    },
    finishQuestIfReady(q) {
      const done = q.objectives.every((obj) => (this.quests.progress[questObjectiveKey(obj)] ?? 0) >= obj.qty)
      if (!done) return
      this.quests.completed.push(q.id)
      this.quests.index++
      this.quests.progress = {}
      if (q.reward?.gold) this.gainGold(q.reward.gold)
      if (q.reward?.items) this.gainItems(q.reward.items)
      EventBus.emit('quest:complete', { id: q.id, name: q.name, reward: q.reward })
    },

    // ── 转生（§3：99 级 → 突破 120）──
    prestigeSkill(id) {
      const skill = this.skills[id]
      if (!skill || (skill.level ?? 1) < MAX_LEVEL) return false
      const prestiges = (skill.prestiges ?? 0) + 1
      // 师徒传承（2026-09-10）：留一手——把本次等级的一部分带进轮回（上限 20 级）
      const carry = carryFromLevel(skill.level)
      if (!this.legacy) this.legacy = { carry: {}, apprentice: { level: 0, lastDay: null } }
      if (!this.legacy.carry) this.legacy.carry = {}
      this.legacy.carry[id] = Math.max(this.legacy.carry[id] ?? 0, carry)
      this.setSkillState(id, { level: 1 + carry, exp: 0, prestiges })
      this.stats.prestiges++
      EventBus.emit('player:prestige', { skillId: id, prestiges, carry })
      return true
    },
    /** 某技能的传承保留等级 */
    legacyCarryOf(id) {
      return this.legacy?.carry?.[id] ?? 0
    },
    /** 徒弟状态 { level, lastDay } */
    apprenticeState() {
      if (!this.legacy) this.legacy = { carry: {}, apprentice: { level: 0, lastDay: null } }
      if (!this.legacy.apprentice) this.legacy.apprentice = { level: 0, lastDay: null }
      return this.legacy.apprentice
    },
    /** 徒弟称号 */
    apprenticeRankName() {
      return apprenticeRank(this.apprenticeState().level).name
    },
    /** 离线收益效率加成（0.8 → 最高 1.0） */
    apprenticeOfflineBonus() {
      return apprenticeOfflineBonus(this.apprenticeState().level)
    },
    /** 每帧：徒弟按自然日成长 */
    _tickApprentice() {
      const st = this.apprenticeState()
      const today = this.todayKey ?? _todayStr()
      if (st.lastDay === today) return
      // 首次记录：只记日期，不补历史天数（避免旧档一进游戏直接满级）
      if (!st.lastDay) { st.lastDay = today; return }
      const prev = new Date(st.lastDay + 'T00:00:00')
      const now = new Date(today + 'T00:00:00')
      const days = Math.max(1, Math.round((now - prev) / 86400000))
      const before = st.level
      st.level = Math.min(APPRENTICE_MAX_LEVEL, st.level + days)
      st.lastDay = today
      if (st.level > before) EventBus.emit('apprentice:grow', { level: st.level, days })
    },

    // ── 对决钩子 ──
    onCombatWin(opponent) {
      this.stats.combatWins++
      if (opponent.isBoss && !this.stats.bosses.includes(opponent.name)) {
        this.stats.bosses.push(opponent.name)
        this.gainInsight(2) // 菜系图谱：首次击败首领 +2（2026-09-09）
      }
      this.gainTastePoints(Math.floor(opponent.level * 1.5)) // 品鉴点数（§3.4.1 来源；乘 1.5 缓解奥义持久消耗）
      // 美食知识（2026-09-09）：原无任何经验来源 → 永久 Lv1（但其等级计入辅助公会入会门槛）。
      // 改为随对决胜利积累（与品鉴力同源，按敌人等级），使其与对决线同步成长。
      getSkillInstance('gastronomy')?.addCardXp(Math.floor(opponent.level * 6))
      this.bumpQuest('combatWin', 'any')
      // 对决·战斗：所有敌人单独计次（含普通对手与首领）
      this.bumpStory('battle', 'battle:' + opponent.name)
      if (opponent.isBoss) {
        this.bumpQuest('boss', opponent.name)
        this.bumpStory('boss', opponent.name)
      }
    },
    onCombatLose() {
      this.stats.combatLosses = (this.stats.combatLosses ?? 0) + 1
    },
    onExplorationSuccess() {
      this.stats.explorations++
      this.bumpQuest('explore', 'any')
      this.bumpStory('support', 'exploration:explore')
    },

    // ── 餐厅经营（§13）──
    setRestaurantMenu(slotIndex, dishId) {
      if (slotIndex >= this.restaurantSlots) return false
      const menu = [...this.restaurant.menu]
      while (menu.length <= slotIndex) menu.push(null)
      if (dishId === null) {
        menu[slotIndex] = null
      } else {
        const item = getItem(dishId)
        if (!item || item.type !== 'food' || (this.inventory[dishId] ?? 0) < 1) return false
        if (menu.includes(dishId)) return false // 一道菜只上一个菜单位
        menu[slotIndex] = dishId
      }
      this.restaurant.menu = menu
      return true
    },
    upgradeRestaurant() {
      const cost = 150 * this.restaurant.level * this.restaurant.level
      if (!this.spendGold(cost)) return false
      this.restaurant.level++
      EventBus.emit('restaurant:upgrade', { level: this.restaurant.level })
      return true
    },
    /** 餐厅收入：每帧累积，按 1 分钟窗口一次性入账（日志记录结算） */
    _tickRestaurant(deltaMs) {
      const hourly = this.restaurantHourlyIncome
      if (hourly <= 0) return
      // 累积该帧收入进 incomeAccum，并累计结算窗口（模块级计时，不序列化）
      _restaurantAccumMs += deltaMs
      this.restaurant.incomeAccum += (hourly / 3600) * (deltaMs / 1000)
      // 达到 1 分钟：一次性入账整数金币，并写事件日志
      if (_restaurantAccumMs >= 60000) {
        _restaurantAccumMs -= 60000
        const whole = Math.floor(this.restaurant.incomeAccum)
        if (whole > 0) {
          this.restaurant.incomeAccum -= whole
          this.gold += whole
          this.stats.restaurantTotal = (this.stats.restaurantTotal ?? 0) + whole
          // 顾客好感（2026-09-06）：每入账 1 金获得 0.02 好感经验，升反馈于小费加成
          const favor = this.restaurant.favor ?? { xp: 0 }
          favor.xp = (favor.xp ?? 0) + whole * 0.02
          this.restaurant.favor = favor
          try { useUiStore().pushLog(`餐厅结算：过去 1 分钟收入 ${whole} 金币`, 'gain') } catch (e) { /* ui 未就绪时忽略日志 */ }
        }
      }
    },

    // ── 食客订单（2026-09-06）：在线生成/过期清理/交付 ──
    _tickOrders(deltaMs) {
      if (!this.orders) this.orders = { list: [], nextAt: 0 }
      const now = Date.now()
      if (this.orders.list.length) {
        const before = this.orders.list.length
        this.orders.list = this.orders.list.filter((o) => o.expireAt > now)
        if (this.orders.list.length < before) {
          try { useUiStore().pushLog('食客订单超时：有食客等不及离开了', 'warn') } catch (e) { /* ignore */ }
        }
      }
      if (this.orders.list.length >= MAX_ORDERS) return
      // 首次进入/旧档：设定下一个到访时刻（避免 nextAt=0 → 进游戏 1 秒内就来单）
      if (this.orders.nextAt <= 0) {
        this.orders.nextAt = now + nextOrderDelay()
        return
      }
      this._orderAccum = (this._orderAccum ?? 0) + deltaMs
      if (this._orderAccum < 1000) return
      this._orderAccum = 0
      if (this.orders.nextAt > now) return
      const order = makeOrder(this)
      if (order) {
        this.orders.list.push(order)
        try { useUiStore().pushLog(`📋 食客「${order.name}」到访：需要 ${getItem(order.itemId)?.name}×${order.qty}，赏金 ${order.reward} 金`, 'info') } catch (e) { /* ignore */ }
      }
      this.orders.nextAt = now + nextOrderDelay()
    },

    /** 交付食客订单：消耗成品料理 → 金币 + 好感经验 */
    finishOrder(orderId) {
      const list = this.orders?.list ?? []
      const idx = list.findIndex((o) => o.id === orderId)
      if (idx < 0) return { ok: false, msg: '订单不存在或已超时' }
      const o = list[idx]
      if ((this.inventory[o.itemId] ?? 0) < o.qty) return { ok: false, msg: `需要 ${getItem(o.itemId)?.name}×${o.qty}` }
      this.spendItem(o.itemId, o.qty)
      list.splice(idx, 1)
      const orderGold = Math.round((o.reward ?? 0) * (1 + this.staffOrderPct?.() / 100)) // 跑堂加成（2026-09-10）
      this.gainGold(orderGold)
      const favor = this.restaurant.favor ?? { xp: 0 }
      favor.xp = (favor.xp ?? 0) + o.reward * 0.05
      this.restaurant.favor = favor
      this.stats.ordersServed = (this.stats.ordersServed ?? 0) + 1 // 米其林「出餐口碑」计数
      return { ok: true, reward: orderGold, name: o.name }
    },

    // ── 公会（§13）──
    joinGuild(id) {
      const g = getGuild(id)
      if (!g || this.guild.id === id) return false
      // 加入需求：战斗=对决等级、采集/制作/辅助=分类总等级 + 金币
      const r = g.requirements
      if (r) {
        if (r.combatLevel && this.combatLevel < r.combatLevel) return false
        if (r.gatherLevel && this.gatherLevels < r.gatherLevel) return false
        if (r.craftLevel && this.craftLevels < r.craftLevel) return false
        if (r.supportLevel && this.supportLevels < r.supportLevel) return false
      }
      if (this.guild.id) {
        // 换会：1000 金币，点数减半
        if (!this.spendGold(1000)) return false
        this.guild.points = Math.floor(this.guild.points / 2)
        this.guild.taskProgress = {}
      } else {
        // 首次加入：无要求公会 500 金币；有要求公会按 requirements.gold
        const fee = r?.gold ?? 500
        if (!this.spendGold(fee)) return false
      }
      this.guild.id = id
      this.guild.day = new Date().toLocaleDateString('en-CA') // 本地日期（避免 UTC 8 点重置）
      EventBus.emit('guild:join', { id, name: g.name })
      return true
    },
    leaveGuild() {
      if (!this.guild.id) return false
      this.guild.id = null
      this.guild.points = 0
      this.guild.taskProgress = {}
      return true
    },
    bumpGuild(kind, param, skillId) {
      const g = getGuild(this.guild.id)
      if (!g) return
      const today = new Date().toLocaleDateString('en-CA') // 本地日期
      if (this.guild.day !== today) {
        this.guild.day = today
        this.guild.taskProgress = {}
      }
      for (const task of g.tasks) {
        let match = false
        if (task.kind === 'skill') {
          match = ['gather', 'craft', 'harvest'].includes(kind) && skillId === task.param
        } else if (task.kind === 'craftEquip') {
          match = kind === 'craftEquip' && (task.param === 'any' || task.param === param)
        } else {
          match = task.kind === kind && (task.param === param || task.param === 'any')
        }
        if (!match) continue
        const key = task.id
        this.guild.taskProgress[key] = (this.guild.taskProgress[key] ?? 0) + 1
        if (this.guild.taskProgress[key] >= task.qty) {
          this.guild.taskProgress[key] = 0 // 可重复完成，每日重置
          this.guild.points += task.reward.points
          if (task.reward.gold) this.gainGold(task.reward.gold)
          EventBus.emit('guild:task', { name: task.name, points: task.reward.points, gold: task.reward.gold })
        }
      }
    },
    guildShopBuy(itemId) {
      const entry = GUILD_SHOP.find((s) => s.itemId === itemId)
      if (!entry || this.guild.points < entry.price) return false
      this.guild.points -= entry.price
      this.gainItem(itemId, 1)
      return true
    },

    // ── 赛季（§13）──
    seasonState() {
      const id = activeSeasonId()
      if (!this.seasons[id]) this.seasons[id] = { points: 0, claimed: [], awarded: [], missionProgress: {} }
      return this.seasons[id]
    },
    bumpSeason(kind, param) {
      const season = getSeason(activeSeasonId())
      if (!season) return
      const st = this.seasonState()
      for (const m of season.missions) {
        if (m.kind === 'restaurant') continue // 由 syncSeasonProgress 同步
        if (m.kind !== kind) continue
        if (m.param !== param && m.param !== 'any') continue
        const key = m.id
        st.missionProgress[key] = Math.min(m.qty, (st.missionProgress[key] ?? 0) + 1)
        if (st.missionProgress[key] >= m.qty) this._awardSeasonMission(st, m)
      }
    },
    syncSeasonProgress() {
      const season = getSeason(activeSeasonId())
      if (!season) return
      const st = this.seasonState()
      for (const m of season.missions) {
        if (m.kind !== 'restaurant') continue
        st.missionProgress[m.id] = Math.min(m.qty, this.stats.restaurantTotal ?? 0)
        if (st.missionProgress[m.id] >= m.qty) this._awardSeasonMission(st, m)
      }
    },
    /** 赛季任务完成：发放一次赛季点数（§13） */
    _awardSeasonMission(st, m) {
      if (st.awarded?.includes(m.id)) return
      if (!st.awarded) st.awarded = []
      st.awarded.push(m.id)
      st.points += m.points
      EventBus.emit('season:mission', { name: m.name, points: m.points })
      // 赛季年鉴（2026-09-10）：本赛季任务全清记一条
      const season = getSeason(activeSeasonId())
      if (season && st.awarded.length >= season.missions.length) {
        this.recordChronicle(`season-all:${season.id}`, 'seasonal', `赛季「${season.name}」全部任务达成`)
      }
    },
    seasonClaimTier(index) {
      const season = getSeason(activeSeasonId())
      const st = this.seasonState()
      const tier = season?.tiers[index]
      if (!tier || st.claimed.includes(index) || st.points < tier.points) return false
      st.claimed.push(index)
      st.points -= tier.points // 领取奖励扣除对应赛季点（积分兑换语义）
      this.gainInsight(3) // 菜系图谱：赛季领档 +3（2026-09-09）
      if (tier.reward?.gold) this.gainGold(tier.reward.gold)
      if (tier.reward?.items) this.gainItems(tier.reward.items)
      EventBus.emit('season:claim', { name: season.name, tier: tier.name ?? `奖励 ${index + 1}` })
      // 赛季年鉴（2026-09-10）：领满全部档位记一条
      if (st.claimed.length >= season.tiers.length) {
        this.recordChronicle(`season-tier:${season.id}`, 'seasonal', `赛季「${season.name}」全部档位领取完毕`)
      }
      return true
    },

    // ── 竞技场（§13）──
    onArenaEnd(win, name, level) {
      // 幂等保护：同一场战斗(同结果+同名+同等级)在 300ms 内重复结算则跳过。
      // 防止 combat:end 事件被重复消费导致「一次成功记两次」/5连胜宝箱被跳过。
      const _key = `${win ? 'W' : 'L'}:${name}:${level}`
      const _now = Date.now()
      if (this._arenaLast && this._arenaLast.key === _key && _now - this._arenaLast.ts < 300) return null
      this._arenaLast = { key: _key, ts: _now }

      const a = this.stats.arena ?? { wins: 0, currentStreak: 0, bestStreak: 0, records: [] }
      let reward = null
      if (win) {
        a.wins++
        a.currentStreak++
        const brokeRecord = a.currentStreak > a.bestStreak
        if (brokeRecord) {
          a.bestStreak = a.currentStreak
          this.recordChronicle('arena:' + a.bestStreak, 'arena', `竞技场连胜纪录刷新：${a.bestStreak} 连胜`)
        }
        a.records.push({ name, level, streak: a.currentStreak, date: Date.now() })
        if (a.records.length > 5) a.records = a.records.slice(-5)

        // 每 5 连胜宝箱：金币（档位 ×100）+ 神秘调料 + 10 连起能量饼干
        if (a.currentStreak % 5 === 0) {
          const tier = a.currentStreak / 5
          const gold = 100 * tier
          this.gold += gold
          this.gainItem('mysterySpice', 1)
          if (tier >= 2) this.gainItem('energyBiscuit', 1)
          reward = { kind: 'streak', streak: a.currentStreak, gold, items: ['mysterySpice', ...(tier >= 2 ? ['energyBiscuit'] : [])] }
          EventBus.emit('arena:reward', reward)
        }
        // 破纪录奖励：金币 200 + 能量饼干（3 连起）——不要覆盖 streak 宝箱信息，两段都保留
        if (brokeRecord && a.currentStreak >= 3) {
          this.gold += 200
          this.gainItem('energyBiscuit', 1)
          const record = { kind: 'record', streak: a.currentStreak, gold: 200, items: ['energyBiscuit'] }
          EventBus.emit('arena:reward', record)
          reward = { ...(reward ?? {}), record: true, gold: (reward?.gold ?? 0) + 200, items: [...(reward?.items ?? []), 'energyBiscuit'] }
        }
      } else {
        a.currentStreak = 0
      }
      this.stats.arena = a
      this.bumpChallenge('arena', a.currentStreak) // 每周挑战赛：连胜（2026-09-09）
      return reward
    },

    // ── 挂机计划（2026-09-09）：按顺序挂机 → 条件满足自动换目标 → 全部完成自动暂停 ──
    planState() {
      if (!this.plan || !Array.isArray(this.plan.steps)) this.plan = { active: false, index: 0, steps: [] }
      return this.plan
    },
    /** 追加一步：{ skill, target, until: 'mastery'|'level', value } */
    planAddStep(skill, target, until, value) {
      const st = this.planState()
      if (!skill || !target) return { ok: false, msg: '请选择技能与目标' }
      st.steps.push({ skill, target, until: until === 'level' ? 'level' : 'mastery', value: Math.max(1, Math.min(100, Number(value) || 100)) })
      return { ok: true }
    },
    planRemoveStep(i) {
      const st = this.planState()
      if (i >= 0 && i < st.steps.length) {
        st.steps.splice(i, 1)
        if (st.index > st.steps.length) st.index = st.steps.length
      }
      return true
    },
    planClear() {
      this.plan = { active: false, index: 0, steps: [] }
      return true
    },
    /** 启用/停用计划（启用时从第一步开始） */
    planToggle() {
      const st = this.planState()
      st.active = !st.active
      if (st.active) {
        st.index = 0
        if (!this._applyPlanStep(st)) st.active = false
      }
      return st.active
    },
    /** 应用第 index 步（设置目标 + 取消暂停 + 切到该技能页） */
    _applyPlanStep(st) {
      const step = st.steps[st.index]
      if (!step) return false
      this.setSkillTarget(step.skill, step.target)
      this.reopenIdleTask(step.skill)
      this.setSkillPaused(step.skill, false)
      this.setActiveSkill(step.skill)
      EventBus.emit('plan:step', { index: st.index, step })
      return true
    },
    /** 每帧：计划推进（条件满足 → 下一步；全部完成 → 暂停全部挂机） */
    _tickPlan() {
      const st = this.planState()
      if (!st.active) return
      const step = st.steps[st.index]
      if (!step) { st.active = false; return }
      const done = (() => {
        if (step.until === 'level') return (this.skills[step.skill]?.level ?? 1) >= step.value
        const inst = getAllSkillInstances().find((x) => x.id === step.skill)
        const count = inst?.mastery?.[step.target] ?? 0
        return count >= countForMasteryLevel(step.value)
      })()
      if (!done) return
      st.index++
      if (st.index >= st.steps.length) {
        st.active = false
        st.index = 0
        for (const inst of getAllSkillInstances()) {
          if (['gathering', 'exploration'].includes(inst.type)) this.setSkillPaused(inst.id, true)
        }
        this.stats.plansDone = (this.stats.plansDone ?? 0) + 1
        EventBus.emit('plan:done', {})
        return
      }
      this._applyPlanStep(st)
    },

    // ── 美食评论家（2026-09-09）：随机到访的高要求食客 ──
    criticState() {
      if (!this.critic) this.critic = { order: null, nextAt: 0 }
      return this.critic
    },
    /** 每帧：到访计时 / 超时离开（在线生成，与食客订单同节奏） */
    _tickCritic(deltaMs) {
      const c = this.criticState()
      const now = Date.now()
      if (c.order && now >= c.order.expireAt) {
        const name = c.order.name
        c.order = null
        try { useUiStore().pushLog(`📝 ${name}等待超时离开了（错过本次大奖）`, 'warn') } catch (e) { /* ignore */ }
        return
      }
      if (c.order) return
      if (c.nextAt <= 0) { c.nextAt = now + criticDelay(); return }
      this._criticAccum = (this._criticAccum ?? 0) + deltaMs
      if (this._criticAccum < 1000) return
      this._criticAccum = 0
      if (now < c.nextAt) return
      c.order = makeCriticOrder(this)
      c.nextAt = now + criticDelay()
      try { useUiStore().pushLog(`📝 美食评论家「${c.order.name}」到访：想要 tier ≥ ${c.order.minTier} 的${c.order.category}`, 'info') } catch (e) { /* ignore */ }
    },
    /** 提交料理给评论家（消耗 1 件，给大奖 + 好感） */
    serveCritic(itemId) {
      const c = this.criticState()
      const o = c.order
      if (!o) return { ok: false, msg: '当前没有评论家到访' }
      const item = getItem(itemId)
      if (!item || item.type !== 'food') return { ok: false, msg: '只能提交料理' }
      if (item.category !== o.category || (item.tier ?? 0) < o.minTier) {
        return { ok: false, msg: `不符合要求（需 tier ≥ ${o.minTier} 的${o.category}）` }
      }
      if ((this.inventory[itemId] ?? 0) < 1) return { ok: false, msg: '数量不足' }
      this.spendItem(itemId, 1)
      this.gainGold(o.reward)
      this.gainItem('mysterySpice', 1)
      const favor = this.restaurant.favor ?? { xp: 0 }
      favor.xp = (favor.xp ?? 0) + 30
      this.restaurant.favor = favor
      const name = o.name
      c.order = null
      this.stats.criticServed = (this.stats.criticServed ?? 0) + 1
      EventBus.emit('critic:served', { name, itemId, reward: o.reward })
      return { ok: true, reward: o.reward }
    },

    // ── 远行采集队（2026-09-09 长线挂机线，参照 Rocky Idle 的 Runs）──
    /** 某线路的运行时状态（惰性初始化 { completions, slots }） */
    expeditionState(lineId) {
      const def = getExpedition(lineId)
      if (!def) return null
      if (!this.expeditions) this.expeditions = {}
      let st = this.expeditions[lineId]
      if (!st || !Array.isArray(st.slots)) st = this.expeditions[lineId] = { completions: 0, slots: def.slots.map(() => null) }
      while (st.slots.length < def.slots.length) st.slots.push(null)
      if (typeof st.completions !== 'number') st.completions = 0
      return st
    },
    /** 线路是否解锁（对应采集技能等级） */
    expeditionUnlocked(lineId) {
      const def = getExpedition(lineId)
      if (!def) return false
      return (this.skills[def.skill]?.level ?? 1) >= def.reqLevel
    },
    /** 槽位是否解锁（线路已解锁 + 技能等级达标） */
    expeditionSlotUnlocked(lineId, index) {
      const def = getExpedition(lineId)
      if (!def || !this.expeditionUnlocked(lineId)) return false
      const slot = def.slots[index]
      return !!slot && (this.skills[def.skill]?.level ?? 1) >= slot.reqLevel
    },
    /** 出发：占用一个空槽位 */
    expeditionStart(lineId, index) {
      const def = getExpedition(lineId)
      const st = this.expeditionState(lineId)
      const slot = def?.slots?.[index]
      if (!def || !st || !slot) return { ok: false, msg: '槽位不存在' }
      if (!this.expeditionSlotUnlocked(lineId, index)) return { ok: false, msg: `需要${SKILL_DEFS[def.skill]?.name ?? def.skill} ${slot.reqLevel} 级` }
      if (st.slots[index]) return { ok: false, msg: '该槽位已在运行' }
      const now = Date.now()
      st.slots[index] = { startedAt: now, readyAt: now + slot.hours * 3600_000 }
      return { ok: true }
    },
    /** 领取：结算产出并自动开始下一轮（未到期返回 null） */
    expeditionClaim(lineId, index) {
      const def = getExpedition(lineId)
      const st = this.expeditionState(lineId)
      const slotDef = def?.slots?.[index]
      const slot = st?.slots?.[index]
      if (!def || !st || !slotDef || !slot) return null
      if (Date.now() < slot.readyAt) return null
      const tier = expeditionTier(st.completions)
      // 产地派驻（2026-09-10）：产量与特产池叠加
      const post = this.lineRegion(lineId)
      const count = Math.max(1, Math.round(slotDef.hours * 5 * expeditionYieldMult(tier) * (1 + (post.bonus?.qtyPct ?? 0) / 100)))
      const box = post.def?.box?.length ? [...slotDef.pool, ...post.def.box] : slotDef.pool
      const gained = {}
      for (let i = 0; i < count; i++) {
        const id = box[Math.floor(Math.random() * box.length)]
        gained[id] = (gained[id] ?? 0) + 1
      }
      const gold = Math.round(slotDef.goldPerHour * slotDef.hours)
      let rare = null
      if (def.rare && Math.random() < def.rare.chance + expeditionRareBonus(tier) + (post.bonus?.rarePct ?? 0) / 100) {
        rare = def.rare.itemId
        gained[rare] = (gained[rare] ?? 0) + 1
      }
      this.gainItems(gained)
      this.gainGold(gold)
      st.completions++
      // 任务/赛季/公会/每日计次（与采集同一条事件链；按产出物逐个计次）
      for (const id of Object.keys(gained)) {
        this.bumpQuest('gather', id)
        this.bumpSeason('gather', id)
        this.bumpGuild('gather', id, def.skill)
        this.bumpDaily('gather', id, def.skill)
      }
      const now = Date.now()
      st.slots[index] = { startedAt: now, readyAt: now + slotDef.hours * 3600_000 } // 自动开始下一轮
      const tierAfter = expeditionTier(st.completions)
      EventBus.emit('expedition:claim', { lineId, name: def.name, gained, gold, rare, tier: tierAfter })
      return { ok: true, gained, gold, rare, tier: tierAfter, nextReadyAt: st.slots[index].readyAt }
    },
    /** 撤回：清空槽位（放弃本轮进度，下一轮需重新出发） */
    expeditionStop(lineId, index) {
      const st = this.expeditionState(lineId)
      if (!st || !st.slots[index]) return false
      st.slots[index] = null
      return true
    },

    // ── 地窖陈酿（2026-09-10 新增时间型放置线）：酒类/腌制品入窖，按档位成熟后领金币 ──
    /** 地窖状态（惰性初始化 { slots: [null | {itemId, qty, baseValue, hours, mult, startedAt, readyAt}] }） */
    cellarState() {
      if (!this.cellar || !Array.isArray(this.cellar.slots)) this.cellar = { slots: [] }
      while (this.cellar.slots.length < this.cellarSlots()) this.cellar.slots.push(null)
      return this.cellar
    },
    /** 已解锁：调酒达到 CELLAR_UNLOCK_LEVEL */
    cellarUnlocked() {
      return (this.skills?.[CELLAR_UNLOCK_SKILL]?.level ?? 1) >= CELLAR_UNLOCK_LEVEL
    },
    /** 当前槽位数（按扩建次数） */
    cellarSlots() {
      const n = Math.max(0, Math.min(CELLAR_EXPAND_COSTS.length, this.cellar?.expands ?? 0))
      return Math.min(CELLAR_MAX_SLOTS, CELLAR_BASE_SLOTS + n * 3)
    },
    /** 扩建下一档（费用递增；已满返回失败） */
    cellarExpand() {
      const expands = this.cellar?.expands ?? 0
      const cost = nextCellarExpandCost(this.cellarSlots())
      if (cost == null) return { ok: false, msg: '地窖已满级' }
      if (this.gold < cost) return { ok: false, msg: `金币不足（需 ${cost.toLocaleString()}）` }
      this.spendGold(cost)
      if (!this.cellar) this.cellar = { slots: [], expands: 0 }
      this.cellar.expands = expands + 1
      this.cellarState()
      EventBus.emit('cellar:expand', { slots: this.cellarSlots(), cost })
      return { ok: true, slots: this.cellarSlots() }
    },
    /** 可陈酿：物品类别属于酒类/腌制品 */
    isAgeable(itemId) {
      const it = getItem(itemId)
      return !!it && CELLAR_CATEGORIES.includes(it.category)
    },
    /** 入窖：扣除物品，占用一个空槽位 */
    cellarPut(index, itemId, qty, hours) {
      const st = this.cellarState()
      if (!this.cellarUnlocked()) return { ok: false, msg: `需调酒 Lv${CELLAR_UNLOCK_LEVEL} 解锁地窖` }
      if (index < 0 || index >= this.cellarSlots()) return { ok: false, msg: '槽位不存在' }
      if (st.slots[index]) return { ok: false, msg: '该槽位已有陈酿' }
      const it = getItem(itemId)
      if (!it || !this.isAgeable(itemId)) return { ok: false, msg: '只有酒类/腌制品可陈酿' }
      const n = Math.floor(Number(qty) || 0)
      if (n < 1 || n > CELLAR_MAX_QTY) return { ok: false, msg: `件数需在 1~${CELLAR_MAX_QTY} 之间` }
      if ((this.inventory[itemId] ?? 0) < n) return { ok: false, msg: '数量不足' }
      const baseValue = (it.value ?? 0) * n
      if (baseValue > CELLAR_MAX_BASE_VALUE) return { ok: false, msg: `单槽价值上限 ${CELLAR_MAX_BASE_VALUE.toLocaleString()}（当前 ${baseValue.toLocaleString()}）` }
      const tier = cellarTier(hours)
      this.spendItem(itemId, n)
      const now = Date.now()
      st.slots[index] = { itemId, qty: n, baseValue, hours: tier.hours, mult: tier.mult, startedAt: now, readyAt: now + tier.hours * 3600_000 }
      return { ok: true }
    },
    /** 领取：成熟后结算金币并清空槽位（未到期返回 null） */
    cellarClaim(index) {
      const st = this.cellarState()
      const slot = st.slots[index]
      if (!slot) return null
      if (Date.now() < slot.readyAt) return null
      const baseGold = cellarPayout(slot.baseValue, slot.mult)
      const gold = Math.round(baseGold * (1 + (this.patronEffects?.()?.cellarPct ?? 0) / 100)) // 食神信仰：窖神（2026-09-10）
      this.gainGold(gold)
      this.stats.cellarRounds = (this.stats.cellarRounds ?? 0) + 1
      this.stats.cellarGold = (this.stats.cellarGold ?? 0) + gold
      st.slots[index] = null
      EventBus.emit('cellar:claim', { itemId: slot.itemId, qty: slot.qty, gold, hours: slot.hours, mult: slot.mult })
      return { ok: true, gold }
    },
    /** 撤回：未到期可取回原物（无损），到期后撤回等同放弃结算（仍取回原物） */
    cellarTakeBack(index) {
      const st = this.cellarState()
      const slot = st.slots[index]
      if (!slot) return false
      this.gainItem(slot.itemId, slot.qty)
      st.slots[index] = null
      return true
    },

    // ── 常客名录（2026-09-10）：餐厅熟客每日招待，好感等级换长期小费加成 ──
    /** 某常客状态（惰性初始化 { serves, lastDay, giftClaimed }） */
    regularState(id) {
      if (!getRegular(id)) return null
      if (!this.regulars) this.regulars = {}
      let st = this.regulars[id]
      if (!st) st = this.regulars[id] = { serves: 0, lastDay: null, giftClaimed: false }
      return st
    },
    /** 是否已解锁（餐厅等级达标） */
    regularUnlocked(id) {
      const def = getRegular(id)
      if (!def) return false
      return (this.restaurant?.level ?? 1) >= def.unlockLevel
    },
    /** 今日是否已招待 */
    regularServedToday(id) {
      const st = this.regularState(id)
      return !!st && st.lastDay === (this.todayKey ?? _todayStr())
    },
    /** 招待：消耗 1 件符合偏好类别且 tier 达标的料理 → 好感次数 +1、金币 + 餐厅好感 */
    regularServe(id, itemId) {
      const def = getRegular(id)
      const st = this.regularState(id)
      if (!def || !st) return { ok: false, msg: '常客不存在' }
      if (!this.regularUnlocked(id)) return { ok: false, msg: `需餐厅 Lv${def.unlockLevel} 解锁` }
      if (this.regularServedToday(id)) return { ok: false, msg: '今日已招待过这位常客（每天 1 次）' }
      const it = getItem(itemId)
      if (!it || it.type !== 'food') return { ok: false, msg: '只能招待料理' }
      if (it.category !== def.category) return { ok: false, msg: `他只爱「${def.category}」` }
      if ((it.tier ?? 0) < def.minTier) return { ok: false, msg: `需 tier ≥ ${def.minTier} 的${def.category}` }
      if ((this.inventory[itemId] ?? 0) < 1) return { ok: false, msg: '数量不足' }
      const beforeLv = regularLevelFromServes(st.serves)
      this.spendItem(itemId, 1)
      this.gainGold(def.gold)
      st.serves++
      st.lastDay = this.todayKey ?? _todayStr()
      // 餐厅好感（与食客订单同源）
      const favor = this.restaurant.favor ?? { xp: 0 }
      favor.xp = (favor.xp ?? 0) + 20
      this.restaurant.favor = favor
      this.stats.regularServes = (this.stats.regularServes ?? 0) + 1
      const afterLv = regularLevelFromServes(st.serves)
      EventBus.emit('regular:serve', { id, name: def.name, itemId, gold: def.gold, level: afterLv, levelUp: afterLv > beforeLv })
      return { ok: true, gold: def.gold, level: afterLv, levelUp: afterLv > beforeLv }
    },
    /** 满级礼物（5 级）：领取神秘调料 ×1（每位一次） */
    regularClaimGift(id) {
      const def = getRegular(id)
      const st = this.regularState(id)
      if (!def || !st) return { ok: false, msg: '常客不存在' }
      if (regularLevelFromServes(st.serves) < REGULAR_LEVEL_REQ.length - 1) return { ok: false, msg: '好感未满级' }
      if (st.giftClaimed) return { ok: false, msg: '已领取过' }
      st.giftClaimed = true
      this.gainItem(REGULAR_MAX_GIFT.itemId, REGULAR_MAX_GIFT.qty)
      EventBus.emit('regular:gift', { id, name: def.name })
      return { ok: true }
    },
    /** 常客小费加成合计（每位好感等级 ×2%） */
    regularTipPct() {
      let pct = 0
      for (const def of REGULARS) {
        const st = this.regulars?.[def.id]
        if (st) pct += regularLevelFromServes(st.serves) * 2
      }
      return pct
    },

    // ── 食灵物语（2026-09-10）：出战食灵按羁绊等级解锁心声片段 + 一次性奖励 ──
    /** 某食灵已解锁的最高片段等级（由羁绊等级决定） */
    spiritStoryStage(spiritId) {
      const lv = this.bondLevelFor(spiritId)
      let stage = 0
      for (const s of SPIRIT_STORY_STAGES) if (lv >= s) stage = s
      return stage
    },
    /** 某片段是否已领取 */
    spiritStoryClaimed(spiritId, stage) {
      return !!this.spiritStories?.[spiritId]?.[stage]
    },
    /** 已解锁且未领取的片段数（红点/统计用） */
    spiritStoryPending() {
      let n = 0
      for (const id of Object.keys(this.spirits?.owned ?? {})) {
        const stage = this.spiritStoryStage(id)
        for (const s of SPIRIT_STORY_STAGES) if (s <= stage && !this.spiritStoryClaimed(id, s)) n++
      }
      return n
    },
    /** 领取某片段奖励（需已解锁 + 未领取） */
    spiritStoryClaim(spiritId, stage) {
      const def = getSpirit(spiritId)
      if (!def) return { ok: false, msg: '食灵不存在' }
      if (!SPIRIT_STORY_STAGES.includes(stage)) return { ok: false, msg: '片段不存在' }
      if (this.spiritStoryStage(spiritId) < stage) return { ok: false, msg: `需羁绊 Lv${stage}（当前 Lv${this.bondLevelFor(spiritId)}）` }
      if (this.spiritStoryClaimed(spiritId, stage)) return { ok: false, msg: '已领取' }
      const info = STAGE_INFO[stage]
      if (!this.spiritStories) this.spiritStories = {}
      if (!this.spiritStories[spiritId]) this.spiritStories[spiritId] = {}
      this.spiritStories[spiritId][stage] = true
      if (info.reward?.gold) this.gainGold(info.reward.gold)
      for (const [id, qty] of Object.entries(info.reward?.items ?? {})) this.gainItem(id, qty)
      this.stats.spiritStoryClaims = (this.stats.spiritStoryClaims ?? 0) + 1
      EventBus.emit('spiritStory:claim', { spiritId, name: def.name, stage, label: info.name })
      return { ok: true, reward: info.reward }
    },

    // ── 自动化中心（2026-09-10）：三项可解锁自动化，统一 5 秒扫一次 ──
    /** 是否已解锁某自动化 */
    automationUnlocked(id) {
      return !!this.automation?.unlocked?.[id]
    },
    /** 解锁（金币一次性） */
    automationUnlock(id) {
      const def = getAutomation(id)
      if (!def) return { ok: false, msg: '自动化不存在' }
      if (!this.automation) this.automation = { unlocked: {}, sellThreshold: SELL_THRESHOLD_DEFAULT, standby: {} }
      if (this.automation.unlocked[id]) return { ok: false, msg: '已解锁' }
      if (this.gold < def.cost) return { ok: false, msg: `金币不足（需 ${def.cost.toLocaleString()}）` }
      this.spendGold(def.cost)
      this.automation.unlocked[id] = true
      EventBus.emit('automation:unlock', { id, name: def.name, cost: def.cost })
      return { ok: true }
    },
    /** 设置自动出售阈值 */
    setSellThreshold(v) {
      if (!this.automation) this.automation = { unlocked: {}, sellThreshold: SELL_THRESHOLD_DEFAULT, standby: {} }
      this.automation.sellThreshold = Math.max(1, Math.min(9999, Math.floor(Number(v) || SELL_THRESHOLD_DEFAULT)))
      return true
    },
    /** 设置某制作技能的「常驻配方」（自动续队用；null 清除） */
    setStandbyRecipe(skillId, recipeId) {
      if (!this.automation) this.automation = { unlocked: {}, sellThreshold: SELL_THRESHOLD_DEFAULT, standby: {} }
      if (!this.automation.standby) this.automation.standby = {}
      if (recipeId) this.automation.standby[skillId] = recipeId
      else delete this.automation.standby[skillId]
      return true
    },
    /** 每帧：自动化推进（5 秒一次） */
    _tickAutomation(deltaMs) {
      if (!this.automation?.unlocked) return
      this._autoAccum = (this._autoAccum ?? 0) + deltaMs
      if (this._autoAccum < 5000) return
      this._autoAccum = 0
      const un = this.automation.unlocked
      if (un.claim) this._autoClaim()
      if (un.sell) this._autoSell()
      if (un.queue) this._autoRefillQueue()
    },
    /** 自动领取：地窖成熟 / 采集队到期 */
    _autoClaim() {
      const st = this.cellarState()
      for (let i = 0; i < this.cellarSlots(); i++) {
        const slot = st.slots[i]
        if (slot && Date.now() >= slot.readyAt) this.cellarClaim(i)
      }
      for (const def of EXPEDITIONS) {
        if (!this.expeditionUnlocked(def.id)) continue
        const es = this.expeditionState(def.id)
        for (let i = 0; i < def.slots.length; i++) {
          const slot = es?.slots?.[i]
          if (slot && Date.now() >= slot.readyAt) this.expeditionClaim(def.id, i)
        }
      }
    },
    /** 自动出售：价值 ≤ 阈值的采集食材（每种保留 SELL_KEEP 件；矿物/化石/材料/补给不参与） */
    _autoSell() {
      const threshold = this.automation?.sellThreshold ?? SELL_THRESHOLD_DEFAULT
      for (const [itemId, qty] of Object.entries({ ...this.inventory })) {
        const it = getItem(itemId)
        if (!it || it.type !== 'ingredient') continue
        if (SELL_EXCLUDED_CATEGORIES.includes(it.category)) continue
        if ((it.value ?? 0) > threshold) continue
        const sell = (qty ?? 0) - SELL_KEEP
        if (sell <= 0) continue
        const gold = Math.floor((it.value ?? 0) * 0.5) * sell
        if (gold <= 0) continue
        this.spendItem(itemId, sell)
        this.gainGold(gold)
        this.stats.autoSold = (this.stats.autoSold ?? 0) + sell
        this.stats.autoSoldGold = (this.stats.autoSoldGold ?? 0) + gold
      }
    },
    /** 自动续队：队列空时把常驻配方补 1 项 */
    _autoRefillQueue() {
      for (const inst of getAllSkillInstances()) {
        if (inst.type !== 'production') continue
        const recipeId = this.automation?.standby?.[inst.id]
        if (!recipeId) continue
        const q = inst.craftQueue
        if (q?.length) continue
        const recipe = inst.recipes?.find((r) => r.id === recipeId)
        if (!recipe) continue
        if (!inst.canCraft?.(recipe)) continue
        inst.enqueue?.(recipe, 1)
      }
    },

    // ── 牧场养殖（2026-09-10）：驯养动物按周期消耗作物产出蛋/奶/肉 ──
    /** 牧场状态（惰性初始化） */
    ranchState() {
      if (!this.ranch || !Array.isArray(this.ranch.pens)) this.ranch = { pens: [], expands: 0 }
      while (this.ranch.pens.length < this.ranchPens()) this.ranch.pens.push(null)
      return this.ranch
    },
    /** 已解锁：农耕达到 RANCH_UNLOCK_LEVEL */
    ranchUnlocked() {
      return (this.skills?.[RANCH_UNLOCK_SKILL]?.level ?? 1) >= RANCH_UNLOCK_LEVEL
    },
    /** 当前栏位数 */
    ranchPens() {
      const n = Math.max(0, Math.min(RANCH_EXPAND_COSTS.length, this.ranch?.expands ?? 0))
      return Math.min(RANCH_MAX_PENS, RANCH_BASE_PENS + n)
    },
    /** 扩建下一栏 */
    ranchExpand() {
      const cost = nextRanchExpandCost(this.ranchPens())
      if (cost == null) return { ok: false, msg: '牧场已满级' }
      if (this.gold < cost) return { ok: false, msg: `金币不足（需 ${cost.toLocaleString()}）` }
      this.spendGold(cost)
      if (!this.ranch) this.ranch = { pens: [], expands: 0 }
      this.ranch.expands = (this.ranch.expands ?? 0) + 1
      this.ranchState()
      EventBus.emit('ranch:expand', { pens: this.ranchPens(), cost })
      return { ok: true, pens: this.ranchPens() }
    },
    /** 购买并放入动物（占用空栏） */
    ranchBuy(index, animalId) {
      const st = this.ranchState()
      if (!this.ranchUnlocked()) return { ok: false, msg: `需农耕 Lv${RANCH_UNLOCK_LEVEL} 解锁牧场` }
      if (index < 0 || index >= this.ranchPens()) return { ok: false, msg: '栏位不存在' }
      if (st.pens[index]) return { ok: false, msg: '该栏已有动物' }
      const def = getAnimal(animalId)
      if (!def) return { ok: false, msg: '动物不存在' }
      if (this.gold < def.cost) return { ok: false, msg: `金币不足（需 ${def.cost.toLocaleString()}）` }
      this.spendGold(def.cost)
      st.pens[index] = { animalId, lastAt: Date.now() }
      EventBus.emit('ranch:buy', { name: def.name, cost: def.cost })
      return { ok: true }
    },
    /** 移出动物（空栏，不退款） */
    ranchRemove(index) {
      const st = this.ranchState()
      if (!st.pens[index]) return false
      st.pens[index] = null
      return true
    },
    /** 每帧：牧场结算（每 5 秒检查；离线按 12 小时上限补算） */
    _tickRanch() {
      const st = this.ranchState()
      if (!this.ranchUnlocked()) return
      const now = Date.now()
      const capMs = RANCH_OFFLINE_CAP_HOURS * 3600_000
      for (const pen of st.pens) {
        if (!pen?.animalId) continue
        const def = getAnimal(pen.animalId)
        if (!def) continue
        const cycleMs = def.hours * 3600_000
        const elapsed = now - (pen.lastAt ?? now)
        if (elapsed < cycleMs) continue
        const maxCycles = Math.max(1, Math.floor(capMs / cycleMs))
        const rawCycles = Math.floor(elapsed / cycleMs)
        const cycles = Math.min(rawCycles, maxCycles)
        let done = 0
        for (let i = 0; i < cycles; i++) {
          const canFeed = Object.entries(def.feed).every(([id, q]) => (this.inventory[id] ?? 0) >= q)
          if (!canFeed) break
          for (const [id, q] of Object.entries(def.feed)) this.spendItem(id, q)
          for (const [id, q] of Object.entries(def.products)) this.gainItem(id, q)
          done++
        }
        if (done > 0) {
          this.stats.ranchCycles = (this.stats.ranchCycles ?? 0) + done
          pen.lastAt = rawCycles > maxCycles ? now : (pen.lastAt ?? now) + done * cycleMs
          EventBus.emit('ranch:produce', { name: def.name, cycles: done, products: def.products })
        } else if (rawCycles > maxCycles) {
          pen.lastAt = now // 无饲料且已超上限：推进时间避免无限堆积
        }
      }
    },

    // ── 餐厅分店（2026-09-10）：金币开店 → 每小时自动收入（可雇店长 +25%）──
    /** 某分店状态（惰性初始化 { lastAt, manager }） */
    branchState(id) {
      if (!getBranch(id)) return null
      if (!this.branches) this.branches = {}
      let st = this.branches[id]
      if (!st) st = this.branches[id] = { lastAt: Date.now(), manager: false }
      return st
    },
    /** 是否已解锁（餐厅等级达标） */
    branchUnlocked() {
      return (this.restaurant?.level ?? 1) >= BRANCH_UNLOCK_LEVEL
    },
    /** 开店 */
    branchOpen(id) {
      const def = getBranch(id)
      if (!def) return { ok: false, msg: '分店不存在' }
      if (!this.branchUnlocked()) return { ok: false, msg: `需餐厅 Lv${BRANCH_UNLOCK_LEVEL} 解锁分店` }
      if (this.branches?.[id]) return { ok: false, msg: '该分店已开业' }
      if (this.gold < def.cost) return { ok: false, msg: `金币不足（需 ${def.cost.toLocaleString()}）` }
      this.spendGold(def.cost)
      if (!this.branches) this.branches = {}
      this.branches[id] = { lastAt: Date.now(), manager: false }
      EventBus.emit('branch:open', { name: def.name, cost: def.cost })
      return { ok: true }
    },
    /** 雇店长（一次性，时收 +25%） */
    branchHireManager(id) {
      const def = getBranch(id)
      const st = this.branchState(id)
      if (!def || !st) return { ok: false, msg: '分店不存在' }
      if (!this.branches?.[id]) return { ok: false, msg: '该分店尚未开业' }
      if (st.manager) return { ok: false, msg: '已雇店长' }
      if (this.gold < def.managerCost) return { ok: false, msg: `金币不足（需 ${def.managerCost.toLocaleString()}）` }
      this.spendGold(def.managerCost)
      st.manager = true
      EventBus.emit('branch:manager', { name: def.name, cost: def.managerCost })
      return { ok: true }
    },
    /** 某分店当前时收 */
    branchHourlyOf(id) {
      const def = getBranch(id)
      const st = this.branches?.[id]
      if (!def || !st) return 0
      const base = branchHourly(def, { manager: st.manager, restaurantLevel: this.restaurant?.level ?? 1 })
      return Math.round(base * (this.branchThemeMult?.(id) ?? 1)) // 主题加成（2026-09-10）
    },
    /** 每帧：分店收入结算（整点入账；离线按 12 小时上限补算） */
    _tickBranches() {
      if (!this.branches) return
      const now = Date.now()
      const capMs = BRANCH_OFFLINE_CAP_HOURS * 3600_000
      for (const def of BRANCHES) {
        const st = this.branches[def.id]
        if (!st) continue
        const elapsed = now - (st.lastAt ?? now)
        const hours = Math.floor(elapsed / 3600_000)
        if (hours < 1) continue
        const capped = elapsed > capMs
        const payHours = capped ? Math.floor(capMs / 3600_000) : hours
        const gold = this.branchHourlyOf(def.id) * payHours
        if (gold > 0) {
          this.gainGold(gold)
          this.stats.branchGold = (this.stats.branchGold ?? 0) + gold
          EventBus.emit('branch:income', { name: def.name, gold, hours: payHours })
        }
        st.lastAt = capped ? now : (st.lastAt ?? now) + payHours * 3600_000
      }
    },

    // ── 交易所（2026-09-10）：动态价格买低卖高，每 4 小时轮换货单 ──
    /** 已解锁：调料调配达到 EXCHANGE_UNLOCK_LEVEL */
    exchangeUnlocked() {
      return (this.skills?.[EXCHANGE_UNLOCK_SKILL]?.level ?? 1) >= EXCHANGE_UNLOCK_LEVEL
    },
    /** 本期货单（含价格与今日已成交数） */
    exchangeGoods() {
      const cycle = exchangeCycleIndex()
      return pickGoods(ITEMS, cycle).map((it) => {
        const traded = this.exchangeTradedToday(it.id)
        return {
          item: it,
          cycle,
          sell: sellPriceOf(it, cycle),
          buy: buyPriceOf(it, cycle),
          traded,
          remain: Math.max(0, EXCHANGE_DAILY_LIMIT - traded),
          own: this.inventory?.[it.id] ?? 0,
        }
      })
    },
    /** 今日某货物已成交件数（跨日自动清零） */
    exchangeTradedToday(itemId) {
      const today = this.todayKey ?? _todayStr()
      if (!this.exchange || this.exchange.dayKey !== today) this.exchange = { dayKey: today, traded: {} }
      return this.exchange.traded?.[itemId] ?? 0
    },
    /** 卖出（玩家按收购价卖出，计入每日限额） */
    exchangeSell(itemId, qty) {
      if (!this.exchangeUnlocked()) return { ok: false, msg: `需调料调配 Lv${EXCHANGE_UNLOCK_LEVEL} 解锁交易所` }
      const goods = this.exchangeGoods().find((g) => g.item.id === itemId)
      if (!goods) return { ok: false, msg: '本期交易所不收这件货' }
      const n = Math.floor(Number(qty) || 0)
      if (n < 1) return { ok: false, msg: '数量不足' }
      if ((this.inventory[itemId] ?? 0) < n) return { ok: false, msg: '库存不足' }
      if (n > goods.remain) return { ok: false, msg: `今日该货剩余额度 ${goods.remain} 件` }
      const gold = goods.sell * n
      this.spendItem(itemId, n)
      this.gainGold(gold)
      this.exchange.traded[itemId] = goods.traded + n
      this.stats.exchangeTrades = (this.stats.exchangeTrades ?? 0) + n
      this.stats.exchangeGold = (this.stats.exchangeGold ?? 0) + gold
      EventBus.emit('exchange:trade', { itemId, qty: n, gold, side: 'sell' })
      return { ok: true, gold }
    },
    /** 买入（按含价差的买入价，计入每日限额） */
    exchangeBuy(itemId, qty) {
      if (!this.exchangeUnlocked()) return { ok: false, msg: `需调料调配 Lv${EXCHANGE_UNLOCK_LEVEL} 解锁交易所` }
      const goods = this.exchangeGoods().find((g) => g.item.id === itemId)
      if (!goods) return { ok: false, msg: '本期交易所没有这件货' }
      const n = Math.floor(Number(qty) || 0)
      if (n < 1) return { ok: false, msg: '数量不足' }
      if (n > goods.remain) return { ok: false, msg: `今日该货剩余额度 ${goods.remain} 件` }
      const cost = goods.buy * n
      if (this.gold < cost) return { ok: false, msg: `金币不足（需 ${cost.toLocaleString()}）` }
      if (!(itemId in this.inventory) && this.inventorySlotsUsed >= this.inventoryCap) return { ok: false, msg: '背包已满（新种类）' }
      this.spendGold(cost)
      this.gainItem(itemId, n)
      this.exchange.traded[itemId] = goods.traded + n
      this.stats.exchangeTrades = (this.stats.exchangeTrades ?? 0) + n
      EventBus.emit('exchange:trade', { itemId, qty: n, gold: cost, side: 'buy' })
      return { ok: true, cost }
    },

    // ── 厨神试炼（2026-09-10）：限制条件挑战，首次通关大奖 ──
    /** 已解锁：对决达到 TRIAL_UNLOCK_LEVEL */
    trialsUnlocked() {
      return this.combatLevel >= TRIAL_UNLOCK_LEVEL
    },
    /** 某试炼状态 { clears, best, streak } */
    trialState(id) {
      if (!this.trials) this.trials = {}
      let st = this.trials[id]
      if (!st) st = this.trials[id] = { clears: 0, best: 0, streak: 0 }
      return st
    },
    /** 开始试炼（标记当前试炼；对手由视图生成） */
    trialStart(id) {
      const def = getTrial(id)
      if (!def) return { ok: false, msg: '试炼不存在' }
      if (!this.trialsUnlocked()) return { ok: false, msg: `需对决 Lv${TRIAL_UNLOCK_LEVEL} 解锁试炼` }
      this.activeTrial = id
      return { ok: true }
    },
    /** 放弃/退出试炼 */
    trialAbort() {
      const id = this.activeTrial
      if (id) {
        const st = this.trialState(id)
        st.streak = 0
      }
      this.activeTrial = null
      return true
    },
    /**
     * 战斗结束回调（由 combat:end 事件驱动）：判定试炼是否达成。
     * info = { result, turns, hpLeft, hpMax }
     * @returns {{ passed:boolean, first:boolean, gold:number, label:string }|null}
     */
    onCombatEndTrial(info) {
      const id = this.activeTrial
      if (!id) return null
      const def = getTrial(id)
      if (!def) { this.activeTrial = null; return null }
      const st = this.trialState(id)
      if (info?.result !== 'win') {
        st.streak = 0
        this.activeTrial = null
        return { passed: false, first: false, gold: 0, label: `${def.name}失败（已退出试炼）` }
      }
      const cond = def.cond ?? { type: 'win', value: 0 }
      const hpPct = info.hpMax > 0 ? (info.hpLeft / info.hpMax) * 100 : 0
      let ok = true
      if (cond.type === 'turns') ok = (info.turns ?? 999) <= cond.value
      else if (cond.type === 'hp') ok = hpPct >= cond.value
      else if (cond.type === 'streak') { st.streak = (st.streak ?? 0) + 1; ok = st.streak >= cond.value }
      if (!ok) {
        if (cond.type === 'streak') return { passed: false, first: false, gold: 0, label: `${def.name}：连胜 ${st.streak}/${cond.value}` }
        this.activeTrial = null
        return { passed: false, first: false, gold: 0, label: `${def.name}未达标（已退出试炼）` }
      }
      const first = (st.clears ?? 0) === 0
      const reward = first ? def.reward : repeatReward(def)
      st.clears = (st.clears ?? 0) + 1
      st.best = Math.max(st.best ?? 0, cond.type === 'turns' ? Math.max(0, 100 - (info.turns ?? 0)) : Math.round(hpPct))
      if (cond.type === 'streak') st.streak = 0
      if (reward.gold) this.gainGold(reward.gold)
      for (const [itemId, qty] of Object.entries(reward.items ?? {})) this.gainItem(itemId, qty)
      this.stats.trialClears = (this.stats.trialClears ?? 0) + 1
      this.activeTrial = null
      EventBus.emit('trial:pass', { id, name: def.name, first, gold: reward.gold ?? 0 })
      return { passed: true, first, gold: reward.gold ?? 0, label: def.name }
    },

    // ── 餐厅米其林评级（2026-09-10）：每日评审一次，按六维评分升/掉星，星级给餐厅收入与全局经验加成 ──
    /** 是否解锁：餐厅等级达标 */
    michelinUnlocked() {
      return (this.restaurant?.level ?? 1) >= MICHELIN_UNLOCK_LEVEL
    },
    /** 米其林评分（六维加权和）：只读既有系统状态 */
    michelinScore() {
      const menuTiers = (this.restaurant?.menu ?? []).reduce((a, id) => a + (getItem(id)?.tier ?? 0), 0)
      let branches = 0
      for (const id of Object.keys(this.branches ?? {})) branches += this.branches[id]?.manager ? 1.5 : 1
      const regulars = REGULARS.reduce((a, r) => a + regularLevelFromServes(this.regulars?.[r.id]?.serves ?? 0), 0)
      const raw = {
        menu: menuTiers,
        decor: this.restaurant?.decor?.length ?? 0,
        orders: this.stats?.ordersServed ?? 0,
        critic: this.stats?.criticServed ?? 0,
        regulars,
        branches,
      }
      let score = 0
      const parts = MICHELIN_FACTORS.map((f) => {
        const v = Math.round((raw[f.id] ?? 0) * f.weight)
        score += v
        return { ...f, raw: raw[f.id] ?? 0, points: v }
      })
      return { score, parts }
    },
    /** 星级收益：餐厅收入 +%，全技能经验 +% */
    michelinIncomePct() {
      return starFromScore(this.michelin?.score ?? 0).incomePct
    },
    michelinXpPct() {
      return starFromScore(this.michelin?.score ?? 0).xpPct
    },
    /** 每帧：跨日评审（每个自然日一次，升/掉星都记日志） */
    _tickMichelin(deltaMs) {
      if (!this.michelinUnlocked()) return
      this._michelinAccum = (this._michelinAccum ?? 0) + deltaMs
      if (this._michelinAccum < 5000) return
      this._michelinAccum = 0
      const today = this.todayKey ?? _todayStr()
      if (!this.michelin) this.michelin = { score: 0, stars: 0, best: 0, lastReviewDay: null }
      if (this.michelin.lastReviewDay === today) return
      this.michelin.lastReviewDay = today
      const { score } = this.michelinScore()
      const star = starFromScore(score).star
      const prev = this.michelin.stars ?? 0
      this.michelin.score = score
      this.michelin.stars = star
      if (star > (this.michelin.best ?? 0)) this.michelin.best = star
      if (star !== prev) {
        EventBus.emit('michelin:review', { stars: star, prev, score })
      }
    },

    // ── 风味搭配册（2026-09-10）：制作成功时检测「食材组合」，首次点亮给一次性奖励 ──
    /** 已发现的搭配 id 列表 */
    flavorFound() {
      return Object.keys(this.flavors ?? {})
    },
    /** 已发现数量 / 总数 */
    flavorProgress() {
      const found = this.flavors ?? {}
      return { found: FLAVOR_PAIRS.filter((p) => found[p.id]).length, total: FLAVOR_PAIRS.length }
    },
    /**
     * 检测并点亮搭配（由 ProductionSkill.craft 在成功时调用）。
     * @param {string[]} ingredientIds 本次配方使用的全部食材 id
     * @returns {Array} 本次新点亮的搭配定义
     */
    discoverFlavors(ingredientIds) {
      if (!this.flavors) this.flavors = {}
      const hits = matchFlavorPairs(ingredientIds)
      const fresh = []
      for (const p of hits) {
        if (this.flavors[p.id]) continue
        this.flavors[p.id] = true
        if (p.reward?.gold) this.gainGold(p.reward.gold)
        for (const [itemId, qty] of Object.entries(p.reward?.items ?? {})) this.gainItem(itemId, qty)
        this.stats.flavorsFound = (this.stats.flavorsFound ?? 0) + 1
        fresh.push(p)
        EventBus.emit('flavor:found', { id: p.id, name: p.name, desc: p.desc, reward: p.reward })
      }
      return fresh
    },

    // ── 厨具大赛（2026-09-10）：每周一届，按全身装备评分取名次档位 ──
    /** 是否解锁：对决等级达标 */
    gearContestUnlocked() {
      return this.combatLevel >= GEAR_CONTEST_UNLOCK_LEVEL
    },
    /** 厨具评分：物品价值 + 属性 + 暴击/攻速 + 词条 + 宝石 + 强化 */
    gearScore() {
      const W = GEAR_SCORE_WEIGHTS
      let score = 0
      const parts = []
      for (const [slot, itemId] of Object.entries(this.equipment ?? {})) {
        if (!itemId) continue
        const it = getItem(itemId)
        if (!it) continue
        let s = (it.value ?? 0) * W.value
        const stats = it.stats ?? {}
        for (const k of ['attack', 'defense', 'accuracy', 'evasion', 'hpBonus']) s += (stats[k] ?? 0) * W.stats
        s += (stats.critChance ?? 0) * 100 * W.crit
        s += (stats.speedBonus ?? 0) * 100 * W.speed
        const mods = this.gearMods?.[slot]?.itemId === itemId ? (this.gearMods[slot].mods?.length ?? 0) : 0
        s += mods * W.mods
        const gems = this.gemSockets?.[slot]?.itemId === itemId ? (this.gemSockets[slot].gems ?? []).filter(Boolean).length : 0
        s += gems * W.gems
        s += (this.upgrades?.[itemId] ?? 0) * W.upgrade
        score += Math.round(s)
        parts.push({ slot, itemId, name: it.name, points: Math.round(s) })
      }
      return { score: Math.round(score), parts, week: contestWeek(), theme: themeOfWeek(contestWeek()) }
    },
    /** 本届是否已参赛 */
    gearContestDoneThisWeek() {
      return this.gearContest?.week === contestWeek()
    },
    /** 参赛：按当前评分取名次并发奖（每周一次） */
    gearContestRun() {
      if (!this.gearContestUnlocked()) return { ok: false, msg: `需对决 Lv${GEAR_CONTEST_UNLOCK_LEVEL} 解锁厨具大赛` }
      const week = contestWeek()
      if (!this.gearContest) this.gearContest = { week: null, score: 0, rank: null, best: 0, runs: 0 }
      if (this.gearContest.week === week) return { ok: false, msg: '本届已参赛（每周一届）' }
      const { score } = this.gearScore()
      const rank = rankFromScore(score)
      this.gearContest.week = week
      this.gearContest.score = score
      this.gearContest.rank = rank.id
      this.gearContest.runs = (this.gearContest.runs ?? 0) + 1
      if (score > (this.gearContest.best ?? 0)) this.gearContest.best = score
      if (rank.gold) this.gainGold(rank.gold)
      for (const [itemId, qty] of Object.entries(rank.items ?? {})) this.gainItem(itemId, qty)
      this.stats.gearContestRuns = (this.stats.gearContestRuns ?? 0) + 1
      EventBus.emit('gearContest:done', { score, rank: rank.id, rankName: rank.name, gold: rank.gold })
      return { ok: true, score, rank }
    },

    // ── 菜系研究（学派）（2026-09-10）：材料 + 真实时间 → 该类料理的永久加成 ──
    /** 某学派状态（惰性初始化 { level, research }） */
    schoolState(id) {
      if (!getSchool(id)) return null
      if (!this.schools) this.schools = {}
      let st = this.schools[id]
      if (!st) st = this.schools[id] = { level: 0, research: null }
      return st
    },
    /** 是否有空闲研究位（同时只能研究一个学派） */
    schoolBusy() {
      for (const s of SCHOOLS) {
        const st = this.schools?.[s.id]
        if (st?.research) return s.id
      }
      return null
    },
    /** 开始研究下一级（消耗材料 + 金币，进入计时） */
    schoolStart(id) {
      const def = getSchool(id)
      const st = this.schoolState(id)
      if (!def || !st) return { ok: false, msg: '学派不存在' }
      if (st.research) return { ok: false, msg: '该学派正在研究中' }
      const busy = this.schoolBusy()
      if (busy) return { ok: false, msg: '同时只能研究一个学派' }
      if ((st.level ?? 0) >= SCHOOL_MAX_LEVEL) return { ok: false, msg: '该学派已研究满级' }
      const toLevel = (st.level ?? 0) + 1
      const cost = schoolCost(def, toLevel)
      if (this.gold < cost.gold) return { ok: false, msg: `金币不足（需 ${cost.gold.toLocaleString()}）` }
      for (const [itemId, qty] of Object.entries(cost.mats)) {
        if ((this.inventory[itemId] ?? 0) < qty) return { ok: false, msg: `${getItem(itemId)?.name ?? itemId} 不足（需 ${qty}）` }
      }
      this.spendGold(cost.gold)
      for (const [itemId, qty] of Object.entries(cost.mats)) this.spendItem(itemId, qty)
      const now = Date.now()
      st.research = { startedAt: now, readyAt: now + cost.hours * 3600_000, toLevel }
      EventBus.emit('school:start', { id, name: def.name, toLevel, hours: cost.hours })
      return { ok: true, readyAt: st.research.readyAt }
    },
    /** 完成研究（到期后领取） */
    schoolClaim(id) {
      const def = getSchool(id)
      const st = this.schoolState(id)
      if (!def || !st) return { ok: false, msg: '学派不存在' }
      const r = st.research
      if (!r) return { ok: false, msg: '当前没有进行中的研究' }
      if (Date.now() < r.readyAt) return { ok: false, msg: '研究尚未完成' }
      st.level = r.toLevel
      st.research = null
      this.stats.schoolLevels = SCHOOLS.reduce((a, s) => a + (this.schools?.[s.id]?.level ?? 0), 0)
      EventBus.emit('school:done', { id, name: def.name, level: st.level })
      return { ok: true, level: st.level }
    },
    /** 取消研究（材料与金币不退还，视为损耗） */
    schoolCancel(id) {
      const st = this.schoolState(id)
      if (!st?.research) return false
      st.research = null
      return true
    },
    /** 全是研究等级合计 */
    schoolTotalLevels() {
      return SCHOOLS.reduce((a, s) => a + (this.schools?.[s.id]?.level ?? 0), 0)
    },
    /** 制作某类配方时的经验加成（%）：该类所属学派每级 +5% */
    schoolCraftXpPct(category) {
      const def = schoolOfCategory(category)
      if (!def) return 0
      return (this.schools?.[def.id]?.level ?? 0) * SCHOOL_PERKS.craftXpPct
    },
    /** 进食某类料理的回血加成（%）：该类所属学派每级 +6% */
    schoolHealPct(category) {
      const def = schoolOfCategory(category)
      if (!def) return 0
      return (this.schools?.[def.id]?.level ?? 0) * SCHOOL_PERKS.healPct
    },
    /** 餐厅收入中某类料理的贡献加成（%）：该类所属学派每级 +8% */
    schoolIncomePct(category) {
      const def = schoolOfCategory(category)
      if (!def) return 0
      return (this.schools?.[def.id]?.level ?? 0) * SCHOOL_PERKS.incomePct
    },

    // ── 雇工班底（2026-09-10）：金币雇工 + 每小时工资，换取餐厅经营加成（欠薪自动停工） ──
    /** 某岗位状态（惰性初始化 { level, lastPayAt, unpaid }） */
    staffState(id) {
      if (!getStaff(id)) return null
      if (!this.staff) this.staff = {}
      let st = this.staff[id]
      if (!st) st = this.staff[id] = { level: 0, lastPayAt: Date.now(), unpaid: false }
      return st
    },
    /** 当前等级（0 = 未雇佣） */
    staffLevelOf(id) {
      return this.staff?.[id]?.level ?? 0
    },
    /** 是否在岗（已雇佣且未欠薪） */
    staffActive(id) {
      const st = this.staff?.[id]
      return !!st && (st.level ?? 0) > 0 && !st.unpaid
    },
    /** 雇工 / 升一级（一次性金币） */
    staffHire(id) {
      const def = getStaff(id)
      const st = this.staffState(id)
      if (!def || !st) return { ok: false, msg: '岗位不存在' }
      if ((st.level ?? 0) >= STAFF_MAX_LEVEL) return { ok: false, msg: '该岗位已满级' }
      const toLevel = (st.level ?? 0) + 1
      const cost = staffCost(toLevel)
      if (this.gold < cost.gold) return { ok: false, msg: `金币不足（需 ${cost.gold.toLocaleString()}）` }
      this.spendGold(cost.gold)
      st.level = toLevel
      st.unpaid = false
      st.lastPayAt = st.lastPayAt ?? Date.now()
      EventBus.emit('staff:hire', { id, name: def.name, level: toLevel, cost: cost.gold })
      return { ok: true, level: toLevel }
    },
    /** 解雇（退还 0，等级清零） */
    staffFire(id) {
      const st = this.staffState(id)
      if (!st || !(st.level > 0)) return false
      st.level = 0
      st.unpaid = false
      return true
    },
    /** 每小时工资合计（在岗人员） */
    staffWagePerHour() {
      let total = 0
      for (const def of STAFF) if (this.staffActive(def.id)) total += staffWage(def, this.staffLevelOf(def.id))
      return total
    },
    /** 在岗加成：餐厅收入%（掌勺 + 采买） */
    staffIncomePct() {
      let pct = 0
      for (const def of STAFF) {
        if (!this.staffActive(def.id)) continue
        if (def.id === 'waiter') continue
        pct += def.per * this.staffLevelOf(def.id)
      }
      return pct
    },
    /** 在岗加成：食客订单奖励%（跑堂） */
    staffOrderPct() {
      if (!this.staffActive('waiter')) return 0
      return getStaff('waiter').per * this.staffLevelOf('waiter')
    },
    /** 每帧：整点发工资（付不出 → 欠薪停工；补足金币后自动复岗） */
    _tickStaff() {
      if (!this.staff) return
      const now = Date.now()
      for (const def of STAFF) {
        const st = this.staff[def.id]
        if (!st || !(st.level > 0)) continue
        const wage = staffWage(def, st.level)
        if (wage <= 0) continue
        const elapsed = now - (st.lastPayAt ?? now)
        const hours = Math.floor(elapsed / 3600_000)
        if (hours < 1) continue
        const due = wage * hours
        if (this.gold >= due) {
          this.spendGold(due)
          this.stats.staffWages = (this.stats.staffWages ?? 0) + due
          st.lastPayAt = (st.lastPayAt ?? now) + hours * 3600_000
          if (st.unpaid) {
            st.unpaid = false
            EventBus.emit('staff:resume', { id: def.id, name: def.name })
          }
        } else {
          st.lastPayAt = now // 欠薪：停工并重置计时，避免无限累积
          if (!st.unpaid) {
            st.unpaid = true
            EventBus.emit('staff:unpaid', { id: def.id, name: def.name, due })
          }
        }
      }
    },

    // ── 产地与风土（2026-09-10）：考察产地 + 派驻采集队，换取该地特产与产量/稀有率加成 ──
    /** 某产地是否已考察 */
    regionUnlocked(id) {
      return !!this.regions?.[id]
    },
    /** 考察产地（一次性金币） */
    regionStudy(id) {
      const def = getRegion(id)
      if (!def) return { ok: false, msg: '产地不存在' }
      if (this.regionUnlocked(id)) return { ok: false, msg: '该产地已考察' }
      if (this.gold < def.cost) return { ok: false, msg: `金币不足（需 ${def.cost.toLocaleString()}）` }
      this.spendGold(def.cost)
      if (!this.regions) this.regions = {}
      this.regions[id] = true
      EventBus.emit('region:study', { id, name: def.name, cost: def.cost })
      return { ok: true }
    },
    /** 派驻：把某条采集队线路派驻到产地（null 取消） */
    regionPost(lineId, regionId) {
      if (!this.regionPosting) this.regionPosting = {}
      if (!regionId) {
        delete this.regionPosting[lineId]
        return { ok: true }
      }
      if (!this.regionUnlocked(regionId)) return { ok: false, msg: '请先考察该产地' }
      if (!getExpedition(lineId)) return { ok: false, msg: '线路不存在' }
      this.regionPosting[lineId] = regionId
      return { ok: true }
    },
    /** 某线路的派驻产地定义与加成 */
    lineRegion(lineId) {
      const regionId = this.regionPosting?.[lineId]
      const def = regionId ? getRegion(regionId) : null
      if (!def) return { def: null, bonus: { qtyPct: 0, rarePct: 0, inSeason: false } }
      return { def, bonus: postingBonus(def, new Date().getMonth() + 1) }
    },
    /** 当前当季产地 id 列表 */
    regionsInSeason() {
      const m = new Date().getMonth() + 1
      return REGIONS.filter((r) => r.seasonMonths.includes(m)).map((r) => r.id)
    },

    // ── 食神信仰（2026-09-10）：八位守护神，同时只信一位；供奉升级永久、切换需金币 + 冷却 ──
    /** 信仰状态（惰性初始化） */
    patronState() {
      if (!this.patron || typeof this.patron !== 'object') this.patron = { active: null, levels: {}, lastSwitchAt: 0 }
      if (!this.patron.levels) this.patron.levels = {}
      return this.patron
    },
    /** 某守护神的信仰等级 */
    patronLevel(id) {
      return this.patron?.levels?.[id] ?? 0
    },
    /** 当前信仰 */
    patronActiveId() {
      return this.patron?.active ?? null
    },
    /** 切换冷却剩余（ms） */
    patronSwitchCdMs() {
      const last = this.patron?.lastSwitchAt ?? 0
      return Math.max(0, last + PATRON_SWITCH_COOLDOWN_MS - Date.now())
    },
    /** 供品升级（永久，可对未信仰的守护神供奉？——仅允许对当前信仰供奉，避免囤积） */
    patronWorship(id) {
      const def = getPatron(id)
      const st = this.patronState()
      if (!def) return { ok: false, msg: '守护神不存在' }
      if (st.active !== id) return { ok: false, msg: '只能向当前信仰的守护神供奉' }
      const lv = this.patronLevel(id)
      if (lv >= PATRON_MAX_LEVEL) return { ok: false, msg: '该守护神已满级' }
      const cost = patronCost(def, lv + 1)
      if (this.gold < cost.gold) return { ok: false, msg: `金币不足（需 ${cost.gold.toLocaleString()}）` }
      for (const [itemId, qty] of Object.entries(cost.mats)) {
        if ((this.inventory[itemId] ?? 0) < qty) return { ok: false, msg: `供品不足：${getItem(itemId)?.name ?? itemId} ×${qty}` }
      }
      this.spendGold(cost.gold)
      for (const [itemId, qty] of Object.entries(cost.mats)) this.spendItem(itemId, qty)
      st.levels[id] = lv + 1
      EventBus.emit('patron:worship', { id, name: def.name, level: lv + 1 })
      return { ok: true, level: lv + 1 }
    },
    /** 切换信仰（金币 + 24h 冷却；目标未信仰过也允许） */
    patronSwitch(id) {
      const def = getPatron(id)
      const st = this.patronState()
      if (!def) return { ok: false, msg: '守护神不存在' }
      if (st.active === id) return { ok: false, msg: '已在信仰该守护神' }
      const cd = this.patronSwitchCdMs()
      if (cd > 0 && st.active) return { ok: false, msg: `切换冷却中（剩 ${Math.ceil(cd / 3600_000)} 小时）` }
      if (this.gold < PATRON_SWITCH_GOLD) return { ok: false, msg: `金币不足（需 ${PATRON_SWITCH_GOLD.toLocaleString()}）` }
      this.spendGold(PATRON_SWITCH_GOLD)
      st.active = id
      st.lastSwitchAt = Date.now()
      EventBus.emit('patron:switch', { id, name: def.name, gold: PATRON_SWITCH_GOLD })
      return { ok: true }
    },
    /** 当前信仰的聚合效果（未信仰或等级 0 → 全 0） */
    patronEffects() {
      const id = this.patronActiveId()
      const def = id ? getPatron(id) : null
      return patronEffectAt(def, def ? this.patronLevel(id) : 0)
    },

    // ── 厨师年鉴（2026-09-10）：首次达成事件的时间线（同 key 只记一次，上限 CHRONICLE_CAP 条） ──
    /** 记录一条年鉴（key 去重；返回是否新记入） */
    recordChronicle(key, kind, text, at = Date.now()) {
      if (!key || !text) return false
      if (!Array.isArray(this.chronicle)) this.chronicle = []
      if (this.chronicle.some((e) => e.key === key)) return false
      this.chronicle.push({ key, kind, text, at })
      if (this.chronicle.length > CHRONICLE_CAP) this.chronicle.splice(0, this.chronicle.length - CHRONICLE_CAP)
      EventBus.emit('chronicle:add', { kind, text })
      return true
    },
    /** 按类别统计条目数 */
    chronicleCount(kind) {
      return (this.chronicle ?? []).filter((e) => e.kind === kind).length
    },

    // ── 天气与运势（2026-09-10）：按自然日确定性抽取，纯日期计算（无存档状态） ──
    /** 今日天气定义 */
    todayWeather() {
      return weatherForDay(this.todayKey ?? dayKeyOf())
    },
    /** 今日天气聚合加成（gatherYield 单独在采集产量处生效） */
    weatherEffects() {
      return weatherBoost(this.todayKey ?? dayKeyOf())
    },
    /** 今日运势：幸运食材 + 宜做三条 */
    todayFortune() {
      const key = this.todayKey ?? dayKeyOf()
      const pool = Object.values(ITEMS).filter((it) => it.type === 'ingredient').map((it) => it.id)
      return fortuneForDay(key, pool)
    },
    /** 某采集目标是否今日幸运食材（产量 +20%） */
    luckyItemBonus(itemId) {
      const f = this.todayFortune()
      return f.luckyItem === itemId ? 0.2 : 0
    },

    // ── 吉祥物（2026-09-10）：购买后可每天「蹭一次」领随机奖励，好感等级提升奖励 ──
    /** 吉祥物状态（惰性初始化） */
    mascotState() {
      if (!this.mascots || typeof this.mascots !== 'object') this.mascots = { owned: {}, active: null, pets: {}, lastPetDay: null }
      if (!this.mascots.owned) this.mascots.owned = {}
      if (!this.mascots.pets) this.mascots.pets = {}
      return this.mascots
    },
    /** 购买吉祥物 */
    mascotBuy(id) {
      const def = getMascot(id)
      const st = this.mascotState()
      if (!def) return { ok: false, msg: '吉祥物不存在' }
      if (st.owned[id]) return { ok: false, msg: '已拥有' }
      if (this.gold < def.cost) return { ok: false, msg: `金币不足（需 ${def.cost.toLocaleString()}）` }
      this.spendGold(def.cost)
      st.owned[id] = true
      if (!st.active) st.active = id
      EventBus.emit('mascot:buy', { id, name: def.name, cost: def.cost })
      return { ok: true }
    },
    /** 切换当前吉祥物（免费） */
    mascotActivate(id) {
      const st = this.mascotState()
      if (!st.owned[id]) return { ok: false, msg: '尚未拥有' }
      st.active = id
      return { ok: true }
    },
    /** 今日是否已蹭过 */
    mascotPettedToday() {
      const st = this.mascotState()
      return st.lastPetDay === (this.todayKey ?? dayKeyOf())
    },
    /** 蹭一蹭（每天一次）：给金币与可能的专属物品，累计次数升好感 */
    mascotPet() {
      const st = this.mascotState()
      const id = st.active
      const def = id ? getMascot(id) : null
      if (!def) return { ok: false, msg: '请先购买并选择一位吉祥物' }
      if (this.mascotPettedToday()) return { ok: false, msg: '今天已经蹭过了，明天再来' }
      const pets = st.pets[id] ?? 0
      const reward = mascotReward(def, pets)
      st.pets[id] = pets + 1
      st.lastPetDay = this.todayKey ?? dayKeyOf()
      this.gainGold(reward.gold)
      for (const [itemId, qty] of Object.entries(reward.items)) this.gainItem(itemId, qty)
      this.stats.mascotPets = (this.stats.mascotPets ?? 0) + 1
      const levelUp = mascotBondLevel(st.pets[id]) > mascotBondLevel(pets)
      EventBus.emit('mascot:pet', { id, name: def.name, gold: reward.gold, items: reward.items, levelUp })
      return { ok: true, reward, levelUp }
    },
    /** 某吉祥物的好感等级 / 进度 */
    mascotBondLevelOf(id) {
      return mascotBondLevel(this.mascotState().pets?.[id] ?? 0)
    },
    mascotBondProgressOf(id) {
      return mascotBondProgress(this.mascotState().pets?.[id] ?? 0)
    },

    // ── 宴会承办（2026-09-10）：限时大订单，一次性交付指定类别料理换大奖 ──
    /** 当前宴席订单（无单时按「今日 + 对决等级」生成候选，需玩家接单） */
    banquetState() {
      if (!this.banquet || typeof this.banquet !== 'object') this.banquet = { order: null, done: 0, failed: 0 }
      return this.banquet
    },
    /** 生成今日候选订单（不落单，仅预览） */
    banquetOffer() {
      return makeBanquetOrder(this.combatLevel, this.todayKey ?? _todayStr())
    },
    /** 接单：写入订单并开始计时 */
    banquetAccept() {
      const st = this.banquetState()
      if (st.order) return { ok: false, msg: '已有进行中的宴席' }
      const offer = this.banquetOffer()
      st.order = { ...offer, acceptedAt: Date.now(), expiresAt: Date.now() + offer.hours * 3600_000 }
      EventBus.emit('banquet:accept', { name: offer.tierName, cat: offer.cat, need: offer.need, hours: offer.hours })
      return { ok: true, order: st.order }
    },
    /** 当前订单可交付份数（库存内符合类别 + tier 的料理） */
    banquetReady() {
      const o = this.banquetState().order
      return o ? banquetAvailable(this, o, ITEMS) : 0
    },
    /** 交付：扣除料理并发奖（需库存达标且在时限内） */
    banquetDeliver() {
      const st = this.banquetState()
      const o = st.order
      if (!o) return { ok: false, msg: '当前没有宴席订单' }
      if (Date.now() > o.expiresAt) return { ok: false, msg: '订单已超时' }
      let left = o.need
      const take = []
      for (const [id, qty] of Object.entries({ ...this.inventory })) {
        if (left <= 0) break
        const it = ITEMS[id]
        if (!it || it.type !== 'food' || it.category !== o.cat || (it.tier ?? 0) < o.minTier) continue
        const use = Math.min(qty, left)
        take.push([id, use]); left -= use
      }
      if (left > 0) return { ok: false, msg: `还差 ${left} 份${o.cat}（tier ≥ ${o.minTier}）` }
      for (const [id, qty] of take) this.spendItem(id, qty)
      this.gainGold(o.gold)
      if (o.spice) this.gainItem('mysterySpice', o.spice)
      const favor = this.restaurant.favor ?? { xp: 0 }
      favor.xp = (favor.xp ?? 0) + 60
      this.restaurant.favor = favor
      st.done = (st.done ?? 0) + 1
      st.order = null
      this.stats.banquets = (this.stats.banquets ?? 0) + 1
      EventBus.emit('banquet:done', { name: o.tierName, gold: o.gold, spice: o.spice })
      return { ok: true, gold: o.gold, spice: o.spice }
    },
    /** 放弃当前订单（不惩罚，仅作废） */
    banquetAbandon() {
      const st = this.banquetState()
      if (!st.order) return false
      st.order = null
      st.failed = (st.failed ?? 0) + 1
      return true
    },
    /** 每帧：超时订单自动作废 */
    _tickBanquet() {
      const st = this.banquetState()
      if (st.order && Date.now() > st.order.expiresAt) {
        st.order = null
        st.failed = (st.failed ?? 0) + 1
        EventBus.emit('banquet:expired', {})
      }
    },

    // ── 外卖业务（2026-09-10）：每小时消耗库存料理换金币（单价高于堂食） ──
    /** 外卖等级（按累计完成单数） */
    takeoutLevel() {
      return takeoutLevelFromExp(this.takeout?.exp ?? 0)
    },
    /** 升级到下一级的花费（满级返回 null） */
    takeoutNextCost() {
      return takeoutUpgradeCost(this.takeoutLevel() + 1)
    },
    /** 手动升级（也随单数自然升级，这里给"花钱加速"的选项） */
    takeoutUpgrade() {
      const cost = this.takeoutNextCost()
      if (cost == null) return { ok: false, msg: '已达最高等级' }
      if (this.gold < cost) return { ok: false, msg: `金币不足（需 ${cost.toLocaleString()}）` }
      this.spendGold(cost)
      if (!this.takeout) this.takeout = { exp: 0, lastAt: 0, sold: 0, gold: 0 }
      this.takeout.exp = this.takeoutLevel() * 50 // 直接补足到下一级门槛
      EventBus.emit('takeout:upgrade', { level: this.takeoutLevel(), cost })
      return { ok: true, level: this.takeoutLevel() }
    },
    /** 每小时外卖结算：按等级并发单量，从菜单料理里挑选有库存的卖出 */
    _tickTakeout(deltaMs) {
      this._takeoutAccum = (this._takeoutAccum ?? 0) + deltaMs
      if (this._takeoutAccum < 60_000) return
      this._takeoutAccum = 0
      const now = Date.now()
      if (!this.takeout) this.takeout = { exp: 0, lastAt: 0, sold: 0, gold: 0 }
      if (!this.takeout.lastAt) { this.takeout.lastAt = now; return }
      const hours = Math.floor((now - this.takeout.lastAt) / 3600_000)
      if (hours < 1) return
      this.takeout.lastAt += hours * 3600_000
      const level = this.takeoutLevel()
      const perHour = takeoutConcurrency(level)
      let sold = 0
      let gold = 0
      for (let h = 0; h < hours; h++) {
        for (let i = 0; i < perHour; i++) {
          const id = this._pickTakeoutDish()
          if (!id) break
          this.spendItem(id, 1)
          const price = takeoutPrice(ITEMS[id], level)
          gold += price
          sold++
        }
      }
      if (sold > 0) {
        this.gainGold(gold)
        this.takeout.exp = (this.takeout.exp ?? 0) + sold
        this.takeout.sold = (this.takeout.sold ?? 0) + sold
        this.takeout.gold = (this.takeout.gold ?? 0) + gold
        this.stats.takeoutSold = (this.stats.takeoutSold ?? 0) + sold
        EventBus.emit('takeout:done', { sold, gold, level: this.takeoutLevel() })
      }
    },
    /** 挑一份可外送的料理（优先菜单里的、库存最多的） */
    _pickTakeoutDish() {
      const menu = (this.restaurant?.menu ?? []).filter((id) => (this.inventory[id] ?? 0) > 0)
      if (menu.length) {
        menu.sort((a, b) => (this.inventory[b] ?? 0) - (this.inventory[a] ?? 0))
        return menu[0]
      }
      // 菜单空时退而求其次：任意库存料理（按价值降序）
      const any = Object.keys(this.inventory).filter((id) => ITEMS[id]?.type === 'food' && this.inventory[id] > 0)
      any.sort((a, b) => (ITEMS[b]?.value ?? 0) - (ITEMS[a]?.value ?? 0))
      return any[0] ?? null
    },

    // ── 分店主题（2026-09-10）：给分店选主题，与菜系研究联动加成时收 ──
    /** 某分店主题 id（无 → null） */
    branchThemeOf(branchId) {
      return this.branchThemes?.[branchId] ?? null
    },
    /** 设置 / 更换分店主题（一次性金币，换主题需重新付费） */
    setBranchTheme(branchId, themeId) {
      const def = getBranchTheme(themeId)
      if (!def) return { ok: false, msg: '主题不存在' }
      if (!this.branches?.[branchId]) return { ok: false, msg: '该分店尚未开业' }
      if (this.branchThemeOf(branchId) === themeId) return { ok: false, msg: '已是该主题' }
      if (this.gold < def.cost) return { ok: false, msg: `金币不足（需 ${def.cost.toLocaleString()}）` }
      this.spendGold(def.cost)
      if (!this.branchThemes) this.branchThemes = {}
      this.branchThemes[branchId] = themeId
      EventBus.emit('branch:theme', { branchId, name: def.name, cost: def.cost })
      return { ok: true }
    },
    /** 某分店的主题加成倍率（= 1 + 6% × 对应学派等级） */
    branchThemeMult(branchId) {
      const themeId = this.branchThemeOf(branchId)
      if (!themeId) return 1
      const def = getBranchTheme(themeId)
      const lv = this.schoolState?.(def.school)?.level ?? 0
      return themeMult(themeId, lv)
    },

    // ── 供应商合约（2026-09-10）：锁价长约，每日自动到货（离线按自然日补算） ──
    /** 当前生效的合约列表 */
    activeContracts() {
      const now = Date.now()
      return Object.entries(this.contracts ?? {})
        .filter(([, c]) => (c?.expiresAt ?? 0) > now)
        .map(([id, c]) => ({ def: getSupplier(id), ...c }))
        .filter((c) => !!c.def)
    },
    /** 签约（一次性定金，期限 7 天） */
    signContract(supplierId) {
      const def = getSupplier(supplierId)
      if (!def) return { ok: false, msg: '供应商不存在' }
      if (this.activeContracts().length >= SUPPLIER_MAX_CONTRACTS) return { ok: false, msg: `最多同时 ${SUPPLIER_MAX_CONTRACTS} 份合约` }
      if (this.activeContracts().some((c) => c.def.id === supplierId)) return { ok: false, msg: '该合约已在生效' }
      if (this.gold < def.deposit) return { ok: false, msg: `金币不足（需 ${def.deposit.toLocaleString()}）` }
      this.spendGold(def.deposit)
      if (!this.contracts) this.contracts = {}
      const now = Date.now()
      this.contracts[supplierId] = { startedAt: now, expiresAt: now + SUPPLIER_TERM_DAYS * 86400_000, lastDay: null, paid: 0 }
      EventBus.emit('supplier:sign', { id: supplierId, name: def.name, deposit: def.deposit, days: SUPPLIER_TERM_DAYS })
      return { ok: true }
    },
    /** 解约（定金不退） */
    cancelContract(supplierId) {
      if (!this.contracts?.[supplierId]) return false
      delete this.contracts[supplierId]
      return true
    },
    /** 每帧：合约按自然日结算（金币够才到货；不够则顺延不累积） */
    _tickContracts() {
      if (!this.contracts) return
      const today = this.todayKey ?? _todayStr()
      const now = Date.now()
      for (const [id, c] of Object.entries(this.contracts)) {
        const def = getSupplier(id)
        if (!def) { delete this.contracts[id]; continue }
        if ((c.expiresAt ?? 0) <= now) {
          delete this.contracts[id]
          EventBus.emit('supplier:expire', { name: def.name })
          continue
        }
        if (c.lastDay === today) continue
        if (!c.lastDay) { c.lastDay = today; continue } // 首日记时不补历史
        const it = getItem(def.itemId)
        const cost = supplierDailyCost(def, it?.value ?? 0)
        if (this.gold < cost) continue // 金币不足：今日不到货，明日再试
        this.spendGold(cost)
        this.gainItem(def.itemId, def.qty)
        c.lastDay = today
        c.paid = (c.paid ?? 0) + cost
        this.stats.contractDeliveries = (this.stats.contractDeliveries ?? 0) + 1
        EventBus.emit('supplier:deliver', { name: def.name, itemId: def.itemId, qty: def.qty, cost })
      }
    },

    // ── 名厨挑战（2026-09-10）：每周一位名厨，固定流派，战胜给大奖 ──
    /** 本周名厨 */
    chefOfWeek() {
      return chefForWeek(Math.floor(Date.now() / (7 * 24 * 3600_000)))
    },
    /** 本周是否已战胜该名厨 */
    chefClearedThisWeek() {
      const c = this.chefChallenge ?? {}
      const week = Math.floor(Date.now() / (7 * 24 * 3600_000))
      return c.week === week && (c.cleared ?? []).includes(this.chefOfWeek().id)
    },
    /** 开始挑战（标记当前名厨，由视图生成对手） */
    chefStart() {
      const def = this.chefOfWeek()
      if (this.chefClearedThisWeek()) return { ok: false, msg: '本周已战胜该名厨' }
      if (!this.chefChallenge) this.chefChallenge = { week: null, cleared: [], current: null }
      this.chefChallenge.current = def.id
      return { ok: true, chef: def }
    },
    /** 放弃当前名厨挑战 */
    chefAbort() {
      if (this.chefChallenge?.current) this.chefChallenge.current = null
    },
    /** 战斗结束回调（由 combat:end 驱动）：胜利则发奖。
     *  opponentName 必须与本周名厨的对手名一致——中途逃跑后再赢别的对手不会误领（2026-09-10）。 */
    onCombatEndChef(result, opponentName) {
      const def = getChef(this.chefChallenge?.current)
      if (!def) return null
      if (opponentName && opponentName !== `${def.icon} ${def.name}`) return null
      if (result !== 'win') { this.chefChallenge.current = null; return { passed: false, name: def.name } }
      const week = Math.floor(Date.now() / (7 * 24 * 3600_000))
      if (this.chefChallenge.week !== week) { this.chefChallenge.week = week; this.chefChallenge.cleared = [] }
      const reward = chefReward(def, this.combatLevel)
      this.gainGold(reward.gold)
      for (const [itemId, qty] of Object.entries(reward.items)) this.gainItem(itemId, qty)
      this.chefChallenge.cleared.push(def.id)
      this.chefChallenge.current = null
      this.stats.chefWins = (this.stats.chefWins ?? 0) + 1
      EventBus.emit('chef:win', { name: def.name, gold: reward.gold })
      return { passed: true, name: def.name, gold: reward.gold }
    },

    /** 自动补给（2026-09-09 放置化）：狩猎陷阱 / 摆盘装饰食材低于阈值时，自动从杂货铺补货（保留金币下限） */
    _tickAutoSupply(deltaMs) {
      if (this.settings?.autoSupply === false) return
      this._supplyAccum = (this._supplyAccum ?? 0) + deltaMs
      if (this._supplyAccum < 5000) return
      this._supplyAccum = 0
      const LOW = 50
      const TARGET = 200
      const reserve = Math.max(0, this.settings?.autoSupplyReserve ?? 2000)
      for (const id of ['trap', 'garnish']) {
        const have = this.inventory[id] ?? 0
        if (have >= LOW) continue
        if (!(id in this.inventory) && this.inventorySlotsUsed >= this.inventoryCap) continue // 背包满且是新种类
        const entry = SHOP_ITEMS.find((s) => s.itemId === id)
        if (!entry) continue
        const affordable = Math.floor((this.gold - reserve) / entry.price)
        if (affordable <= 0) continue
        const want = Math.min(TARGET - have, affordable)
        if (want <= 0) continue
        if (!this.spendGold(entry.price * want)) continue
        this.gainItem(id, want)
        EventBus.emit('supply:auto', { itemId: id, qty: want, cost: entry.price * want })
      }
    },

    setCombat(patch) {
      this.combat = { ...this.combat, ...patch }
    },

    // ── 每日签到（§13）──
    signInToday() {
      const today = this.todayKey ?? _todayStr()
      const s = this.signIn ?? { lastDate: null, day: 0 }
      if (s.lastDate === today) return { ok: false, msg: '今日已签到' }
      // 昨天签过 → 连续 +1（7 天循环）；否则重置为第 1 天
      const day = s.lastDate === _yesterdayStr() ? (s.day % 7) + 1 : 1
      this.signIn = { lastDate: today, day }
      const reward = this.signInRewardFor(day) // 动态领取（随等级）
      if (reward.gold) this.gold += reward.gold
      for (const [itemId, qty] of Object.entries(reward.items ?? {})) this.gainItem(itemId, qty)
      EventBus.emit('signin:claimed', { day, reward })
      // 每日/周常任务「每日签到」进度（需当日任务已生成，先确保一次）
      this.ensureDailyTasks()
      this.bumpDaily('signin', 'any')
      return { ok: true, day, reward }
    },
    canSignInToday() {
      return (this.signIn?.lastDate ?? null) !== (this.todayKey ?? _todayStr())
    },
    // 刷新当天日期（跨午夜时由定时器调用），让签到/红点响应式更新
    refreshToday() {
      this.todayKey = _todayStr()
    },
    // 第 day 天签到奖励（动态）：金币随对决等级放大、增益剂按等级选 Ⅰ~Ⅴ 档
    signInRewardFor(day) {
      const def = SIGN_IN_REWARDS[day - 1] ?? SIGN_IN_REWARDS[0]
      return resolveSignInReward(def, this.combatLevel)
    },

    // ── 每日/周常任务（2026-09-06 长线日活钩子）──
    /** 当前日期序号（YYYYMMDD 数值），周序号（epoch 天数 / 7） */
    _dayNum() { return Number((this.todayKey ?? _todayStr()).replace(/-/g, '')) },
    _weekNum() { return Math.floor(Date.now() / 86400000 / 7) },
    /** 跨日/跨周自动刷新任务（tick 周期检查调用，轻量） */
    ensureDailyTasks() {
      const today = this.todayKey ?? _todayStr()
      if (this.daily.day === today) return
      const prevDone = (this.daily.claimedAll ?? false) && this.daily.day === _yesterdayStr()
      this.daily = {
        day: today,
        streak: prevDone ? (this.daily.streak ?? 0) + 1 : (this.daily.streak ?? 0),
        tasks: dailyTasksFor(this._dayNum()).map((t) => ({ ...t, progress: 0, claimed: false })),
        claimedAll: false,
      }
    },
    ensureWeeklyTask() {
      const wk = this._weekNum()
      if (this.weekly.week === wk) return
      const t = weeklyTaskFor(wk)
      this.weekly = { week: wk, task: t, progress: 0, claimed: false }
    },
    /** 进度累计（与主线任务/赛季/公会同一条事件链调用；param 兼容 'any' 与具体物品/技能 id） */
    bumpDaily(kind, param, skillId) {
      for (const t of this.daily.tasks) {
        if (t.claimed || t.kind !== kind) continue
        if (t.param !== 'any' && t.param !== param && t.param !== skillId) continue
        t.progress = Math.min(t.qty, (t.progress ?? 0) + 1)
      }
      this.bumpWeekly(kind, param, skillId)
      this.bumpChallenge(kind, 1) // 每周挑战赛同步计次（2026-09-09）
    },
    bumpWeekly(kind, param, skillId) {
      const w = this.weekly
      if (!w.task || w.claimed || w.task.kind !== kind) return
      if (w.task.param !== 'any' && w.task.param !== param && w.task.param !== skillId) return
      w.progress = Math.min(w.task.qty, w.progress + 1)
    },
    /** 领单人每日任务（全领完再发礼包） */
    claimDailyTask(idx) {
      this.ensureDailyTasks()
      const t = this.daily.tasks[idx]
      if (!t || t.claimed || t.progress < t.qty) return null
      const gold = Math.floor(t.gold * (1 + this.combatLevel * 0.3))
      this.gainGold(gold)
      t.claimed = true
      EventBus.emit('daily:claim', { name: t.name, gold })
      // 全部领完 → 每日礼包 + 连续天数
      if (this.daily.tasks.every((x) => x.claimed) && !this.daily.claimedAll) {
        this.daily.claimedAll = true
        const bg = Math.floor(DAILY_BONUS.gold * (1 + this.combatLevel * 0.3))
        this.gainGold(bg)
        for (const [id, qty] of Object.entries(DAILY_BONUS.items)) this.gainItem(id, qty)
        EventBus.emit('daily:bonus', { gold: bg, items: DAILY_BONUS.items, streak: this.daily.streak })
      }
      return { gold }
    },
    /** 领周常 */
    claimWeekly() {
      this.ensureWeeklyTask()
      const w = this.weekly
      if (!w.task || w.claimed || w.progress < w.task.qty) return null
      const gold = Math.floor(w.task.gold * (1 + this.combatLevel * 0.3))
      this.gainGold(gold)
      w.claimed = true
      if (w.task.items) for (const [id, qty] of Object.entries(w.task.items)) this.gainItem(id, qty)
      EventBus.emit('weekly:claim', { name: w.task.name, gold })
      return { gold }
    },
    /** 每日/周常是否已完成待领取（供红点/快捷状态） */
    dailyClaimableCount() {
      this.ensureDailyTasks()
      return this.daily.tasks.filter((t) => t.claimed).length
    },

    // ── 菜系图谱（2026-09-09 永久天赋树）──
    /** 美食见闻余额 */
    insightPoints() {
      return this.stats?.insights ?? 0
    },
    /** 获得美食见闻（图鉴首收集 +1 / 成就 +5 / 赛季领档 +3 / 首次击败首领 +2） */
    gainInsight(n) {
      if (!(n > 0)) return 0
      if (!this.stats) this.stats = {}
      this.stats.insights = (this.stats.insights ?? 0) + n
      return this.stats.insights
    },
    /** 已解锁节点的效果合计 */
    insightEffects() {
      return insightEffectSum(this.insights ?? [])
    },
    /** 解锁节点（消耗美食见闻；前置必须已解锁） */
    unlockInsight(id) {
      const chk = canUnlockInsight(id, this.insights ?? [], this.insightPoints())
      if (!chk.ok) return chk
      const def = INSIGHT_NODES.find((n) => n.id === id)
      if (!this.stats) this.stats = {}
      this.stats.insights = (this.stats.insights ?? 0) - def.cost
      this.insights = [...(this.insights ?? []), id]
      EventBus.emit('insight:unlock', { name: def.name, desc: def.desc })
      return { ok: true, node: def }
    },

    // ── 食神秘境（2026-09-09 roguelike 局内模式）──
    realmState() {
      if (!this.realm || !Array.isArray(this.realm.buffs)) this.realm = { active: false, floor: 0, buffs: [], best: 0, pending: null }
      return this.realm
    },
    /** 本局增益聚合（未进入秘境返回 null，避免影响普通对决） */
    realmModifiers() {
      const st = this.realm
      if (!st?.active) return null
      const out = { attackPct: 0, defensePct: 0, maxHpPct: 0, critChance: 0, accuracyPct: 0, evasionPct: 0, speedPct: 0, healPerTurnPct: 0, goldPct: 0 }
      for (const id of st.buffs ?? []) {
        const def = REALM_BUFFS.find((b) => b.id === id)
        if (!def) continue
        for (const [k, v] of Object.entries(def.mod)) out[k] = (out[k] ?? 0) + v
      }
      return out
    },
    realmStart() {
      const st = this.realmState()
      st.active = true
      st.floor = 0
      st.buffs = []
      st.pending = null
      EventBus.emit('realm:start', {})
      return true
    },
    /** 胜一层：层数 +1，并给出 3 选 1 增益 */
    realmAdvance() {
      const st = this.realmState()
      if (!st.active) return null
      st.floor++
      const prevBest = st.best ?? 0
      st.best = Math.max(st.best ?? 0, st.floor)
      if (st.best > prevBest) this.recordChronicle('realm:' + st.best, 'realm', `食神秘境推进到第 ${st.best} 层`)
      st.pending = rollRealmChoices(3)
      EventBus.emit('realm:floor', { floor: st.floor })
      return st.pending
    },
    realmPickBuff(id) {
      const st = this.realmState()
      if (!st.pending?.length) return false
      const def = st.pending.find((b) => b.id === id)
      if (!def) return false
      st.buffs = [...(st.buffs ?? []), def.id]
      st.pending = null
      return true
    },
    /** 结算本局（阵亡或主动放弃）：按层数发奖，增益清零 */
    realmEnd() {
      const st = this.realmState()
      if (!st.active) return null
      const floor = st.floor
      const mult = 1 + (this.realmModifiers()?.goldPct ?? 0) / 100
      const r = realmReward(floor)
      const gold = Math.round(r.gold * mult)
      st.active = false
      st.pending = null
      st.floor = 0
      st.buffs = []
      if (floor > 0) {
        this.gainGold(gold)
        for (const [id, q] of Object.entries(r.items ?? {})) if (q > 0) this.gainItem(id, q)
        EventBus.emit('realm:end', { floor, gold, items: r.items })
      }
      return { floor, gold }
    },

    // ── 每周挑战赛（2026-09-09）：难度型周目标（与产量型周常任务互补）──
    ensureWeeklyChallenge() {
      const wk = this._weekNum()
      if (this.challenge?.week === wk && this.challenge.id) return this.challenge
      const c = challengeForWeek(wk)
      this.challenge = { week: wk, id: c.id, progress: 0, done: false }
      return this.challenge
    },
    challengeDef() {
      this.ensureWeeklyChallenge()
      return getChallenge(this.challenge.id)
    },
    /** 进度累计：数值型（塔层/连胜）取最大值，其余计数累加 */
    bumpChallenge(kind, value = 1) {
      const st = this.ensureWeeklyChallenge()
      const def = getChallenge(st.id)
      if (!def || st.done || def.kind !== kind) return
      if (def.kind === 'tower' || def.kind === 'arena') st.progress = Math.max(st.progress, value)
      else st.progress += 1
      if (!this.challengeBest) this.challengeBest = {}
      this.challengeBest[def.id] = Math.max(this.challengeBest[def.id] ?? 0, st.progress)
    },
    /** 领奖（达成后一次性） */
    claimChallenge() {
      const st = this.ensureWeeklyChallenge()
      const def = getChallenge(st.id)
      if (!def || st.done || st.progress < def.target) return null
      st.done = true
      this.stats.challengesDone = (this.stats.challengesDone ?? 0) + 1
      this.gainGold(def.gold)
      for (const [id, q] of Object.entries(def.items ?? {})) this.gainItem(id, q)
      EventBus.emit('challenge:done', { name: def.name, gold: def.gold })
      return { gold: def.gold }
    },

    // ── 无尽挑战塔（对决 99 解锁，毕业长期线）──
    towerUnlocked() {
      return this.combatLevel >= TOWER_UNLOCK_LEVEL
    },
    /** 当前挑战层对手（动态生成） */
    towerOpp() {
      const floor = Math.max(1, this.tower?.floor ?? 1)
      return towerFloor(floor, this.combatLevel)
    },
    /** 塔层胜利结算：推进层数 + 里程碑一次性奖励 */
    onTowerWin(floor) {
      this.bumpChallenge('tower', floor) // 每周挑战赛：塔层（2026-09-09）
      const t = this.tower ?? { floor: 1, best: 0, rewarded: [] }
      const tPrev = t.best ?? 0
      t.best = Math.max(t.best ?? 0, floor)
      if (t.best > tPrev) this.recordChronicle('tower:' + t.best, 'tower', `无尽挑战塔推进到第 ${t.best} 层`)
      t.floor = floor + 1
      t.rewarded = t.rewarded ?? []
      const m = towerMilestone(floor)
      if (m && !t.rewarded.includes(m.floor)) {
        t.rewarded.push(m.floor)
        this.gainGold(m.gold)
        for (const [id, qty] of Object.entries(m.items ?? {})) this.gainItem(id, qty)
        EventBus.emit('tower:milestone', m)
      }
      this.tower = t
      return t
    },

    // ── 限时窗口活动（2026-09-06 扩展）：夜市/晨集/茶歇/午夜/主厨日，倍率聚合可叠加 ──
    /** 当前命中的活动列表（含跨夜窗口与周日主厨日） */
    activeMarketEvents(hour = null, weekday = null) {
      return activeMarketEvents_(hour, weekday)
    },
    /** 处于活动窗口（兼容旧接口：任一事件命中即 true；专用断言仍可传参） */
    marketOn(hour = null, weekday = null) {
      return activeMarketEvents_(hour, weekday).length > 0
    },
    /** 聚合倍率（命中事件相乘）：{ restaurant, combatXp, gatherXp, craftXp } */
    marketBoost(hour = null, weekday = null) {
      const base = aggregateMarketBoost(hour, weekday)
      if (hour !== null || weekday !== null) return base // 显式传参：纯函数路径（测试/预览）
      const fest = this.festivalBoost?.() ?? { restaurant: 1, gatherXp: 1, craftXp: 1, combatXp: 1 }
      const wx = this.weatherEffects?.() ?? { restaurant: 1, gatherXp: 1, craftXp: 1, combatXp: 1 } // 天气（2026-09-10）
      return {
        ...base,
        restaurant: (base.restaurant ?? 1) * (fest.restaurant ?? 1) * (wx.restaurant ?? 1),
        gatherXp: (base.gatherXp ?? 1) * (fest.gatherXp ?? 1) * (wx.gatherXp ?? 1),
        craftXp: (base.craftXp ?? 1) * (fest.craftXp ?? 1) * (wx.craftXp ?? 1),
        combatXp: (base.combatXp ?? 1) * (fest.combatXp ?? 1) * (wx.combatXp ?? 1),
      }
    },
    /** 今日节庆聚合加成（2026-09-10）：纯日期计算，无存档状态 */
    festivalBoost(now = new Date()) {
      return festivalBoost(now)
    },
    /** 节庆预告（含今天，默认 10 天） */
    festivalUpcoming(days = 10) {
      return upcomingFestivals(new Date(), days)
    },

    // ── 食灵羁绊（2026-09-06 长线养成）──
    /** 某食灵的羁绊等级（按累计出战天数） */
    bondLevelFor(spiritId) {
      return bondLevelOf(this.spiritBonds?.[spiritId] ?? 0)
    },
    /** 羁绊进度：{ level, days, nextDays }（升级所需天数，5 级封顶） */
    bondProgressFor(spiritId) {
      const ms = this.spiritBonds?.[spiritId] ?? 0
      const days = ms / 86400000
      let lv = 0
      for (const d of BOND_DAYS) if (days >= d) lv++
      return { level: lv, days, nextDays: BOND_DAYS[lv] ?? null }
    },
    /** 每帧：出战食灵累计羁绊时长（按实际出战技能全部并行累计） */
    _tickSpiritBonds(deltaMs) {
      const active = this.spirits?.active ?? []
      if (!active.length) return
      for (const id of active) {
        const before = bondLevelOf(this.spiritBonds[id] ?? 0)
        this.spiritBonds[id] = (this.spiritBonds[id] ?? 0) + deltaMs
        const after = bondLevelOf(this.spiritBonds[id])
        if (after > before) EventBus.emit('spirit:bond', { spiritId: id, level: after })
      }
    },

    // ── 硬核生存（2026-09-06）──
    /** 跨日时在 tick 中调用：硬核模式生存天数 +1（死亡即删档清空，best 保留当前段纪录） */
    _tickHardcoreDay() {
      if (!this.hardcore) return
      const h = this.hardcoreStats ?? { days: 0, best: 0, lastDayKey: null }
      const today = this.todayKey ?? _todayStr()
      if (h.lastDayKey === today) return // 同日防重（含重启后首周期）
      h.lastDayKey = today
      h.days = (h.days ?? 0) + 1
      h.best = Math.max(h.best ?? 0, h.days)
      this.hardcoreStats = h
    },
    hardcoreDayCount() {
      return this.hardcoreStats?.best ?? 0
    },

    // ── 锻造套装集齐奖励（2026-09-06）──
    /** 检查全部锻造套收齐 → 一次性发奖；返回本次新集齐的套数 */
    checkSetBonuses() {
      const list = this.setBonuses ?? []
      let awarded = 0
      for (const set of COLLECTABLE_SETS) {
        if (list.includes(set.key)) continue
        // 图鉴收集覆盖整套装备（缺件则跳过）
        if (!set.ids.every((id) => this.collected[id])) continue
        list.push(set.key)
        const r = setBonusReward(set)
        this.gainGold(r.gold)
        this.gainItem('mysterySpice', 1)
        awarded++
        EventBus.emit('set:bonus', { name: set.name, gold: r.gold })
      }
      if (awarded > 0) this.setBonuses = list
      return awarded
    },

    // ── 觅珍抽卡（2026-09-06）──
    /** 抽卡：poolId（material/food/gear）× count 次；扣金币 → 入库 → 返回结果 */
    drawMijian(poolId, count = 1) {
      const def = MIJIAN_POOLS.find((p) => p.id === poolId)
      if (!def || !(count >= 1)) return null
      const cost = def.price * count
      // 商店「觅珍抽卡券」优先抵扣（2026-09-07）：每张抵 1 抽，剩余部分金币结算
      const mjA = this.mijian ?? (this.mijian = { stats: { pulls: 0, spent: 0, gearRare: 0 }, pity: {}, history: [] })
      const useT = Math.min(mjA.tickets ?? 0, count)
      const goldCost = cost - useT * def.price
      if (goldCost > 0 && !this.spendGold(goldCost)) return { ok: false, msg: '金币不足（需 ' + goldCost + '）' }
      if (useT > 0) mjA.tickets = (mjA.tickets ?? 0) - useT
      // 保底计数按池拆分（2026-09-06；兼容旧档数字形态 → 迁移为 { gear, limited }）
      const mj = this.mijian ?? { stats: { pulls: 0, spent: 0, gearRare: 0 }, pity: {}, history: [] }
      if (typeof mj.pity === 'number') mj.pity = { gear: mj.pity, limited: 0 }
      mj.pity = mj.pity ?? { gear: 0, limited: 0 }
      mj.stats = mj.stats ?? { pulls: 0, spent: 0, gearRare: 0 }
      const isGear = poolId === 'gear'
      const isLimited = poolId === 'limited'
      const pityKey = isGear ? 'gear' : isLimited ? 'limited' : null
      const pityNeed = isLimited ? LIMITED_PITY : GEAR_PITY
      const results = []
      let boosted = false
      const isRare = (it) => !!it?.quality && ['稀有', '史诗', '传说', '神话'].includes(it.quality)
      for (let i = 0; i < count; i++) {
        const pv = pityKey ? mj.pity[pityKey] : 0
        const { item, boosted: b } = pickItem(poolId, Math.random, pv)
        if (pityKey) {
          if (isRare(item)) { mj.pity[pityKey] = 0; if (isGear) mj.stats.gearRare++ }
          else mj.pity[pityKey] = Math.min(pv + 1, pityNeed)
        }
        results.push(item)
        if (b) boosted = true
      }
      const got = []
      for (const it of results) {
        if (it && this.gainItem(it.id, 1)) got.push(it.id)
      }
      mj.stats.pulls += count
      mj.stats.spent += cost
      const rareHit = results.some(isRare)
      mj.history = [...(mj.history ?? []), rareHit ? 'rare' : 'common'].slice(-10)
      this.mijian = mj
      EventBus.emit('mijian:draw', { poolId, count, boosted })
      return { ok: true, results, got, boosted }
    },
    /** 保底进度（厨具 N/10 · 限时 N/5） */
    mijianPity() {
      const mj = this.mijian ?? {}
      const pity = typeof mj.pity === 'number' ? { gear: mj.pity, limited: 0 } : (mj.pity ?? { gear: 0, limited: 0 })
      return { current: pity.gear ?? 0, need: GEAR_PITY, limited: pity.limited ?? 0, limitedNeed: LIMITED_PITY }
    },

    // ── 餐厅好感（2026-09-06）──
    favorLevel() {
      return favorLevelFromXp(this.restaurant?.favor?.xp ?? 0)
    },
    festState() {
      const today = _todayStr()
      const month = Number(today.slice(0, 4) + today.slice(5, 7))
      if (this.fest.month !== month) {
        this.fest = { month, score: 0, entries: [], lastEntryDay: null, todayEntries: 0, rewarded: [] }
      } else if (this.fest.lastEntryDay !== today) {
        this.fest.todayEntries = 0
        this.fest.lastEntryDay = today
      }
      return this.fest
    },
    festTheme() {
      return festThemeFor(this.festState().month)
    },
    /** 提交一件料理参赛：扣 1 件 + 计分 + 月度里程碑 */
    festSubmit(itemId) {
      const f = this.festState()
      const item = getItem(itemId)
      if (!item || item.type !== 'food') return { ok: false, msg: '只能提交料理' }
      if (!festAccepts(this.festTheme(), item)) return { ok: false, msg: '这道菜不符合本月主题' }
      if ((this.inventory[itemId] ?? 0) < 1) return { ok: false, msg: '数量不足' }
      if (this.fest.todayEntries >= FEST_DAILY_ENTRIES) return { ok: false, msg: `今日 ${FEST_DAILY_ENTRIES} 次提交已用完` }
      this.spendItem(itemId, 1)
      const score = festScore(item)
      f.todayEntries++
      f.score += score
      f.entries.push({ itemId, score, at: Date.now() })
      if (f.entries.length > 50) f.entries.splice(0, f.entries.length - 50)
      // 月度里程碑（一次性）
      f.rewarded = f.rewarded ?? []
      for (let i = 0; i < FEST_MILESTONES.length; i++) {
        const m = FEST_MILESTONES[i]
        if (f.score >= m.score && !f.rewarded.includes(i)) {
          f.rewarded.push(i)
          this.gainGold(m.gold)
          for (const [id, qty] of Object.entries(m.items ?? {})) this.gainItem(id, qty)
          EventBus.emit('fest:milestone', { index: i, gold: m.gold, items: m.items })
        }
      }
      this.fest = f
      EventBus.emit('fest:submit', { itemId, score })
      return { ok: true, score }
    },

    // ── 装备强化（§13）：每级 +10% 属性，上限 5 级 ──
    upgradeCost(itemId) {
      const it = getItem(itemId)
      if (it?.type !== 'equipment') return null
      const lv = this.upgrades[itemId] ?? 0
      const rank = { 神话: 6, 传说: 5, 史诗: 4, 稀有: 3, 精良: 2, 普通: 1 }[it.quality] ?? 1
      return { gold: 300 + lv * 400 + rank * 200, ironOre: 1 + lv, saltOre: lv + 1, level: lv }
    },
    upgradeItem(itemId) {
      const it = getItem(itemId)
      if (it?.type !== 'equipment') return { ok: false, msg: '不是装备' }
      const cost = this.upgradeCost(itemId)
      if (cost.level >= 5) return { ok: false, msg: '已达最高强化等级' }
      if (this.gold < cost.gold) return { ok: false, msg: '金币不足' }
      if ((this.inventory.ironOre ?? 0) < cost.ironOre || (this.inventory.saltOre ?? 0) < cost.saltOre) return { ok: false, msg: '材料不足（铁矿/盐矿）' }
      this.spendGold(cost.gold)
      this.spendItem('ironOre', cost.ironOre)
      this.spendItem('saltOre', cost.saltOre)
      this.upgrades[itemId] = cost.level + 1
      EventBus.emit('equip:upgrade', { itemId, level: cost.level + 1 })
      return { ok: true, level: cost.level + 1 }
    },
    /** 装备强化加成系数（getter 使用） */
    upgradeMult(itemId) {
      return 1 + ((this.upgrades[itemId] ?? 0) * 0.1)
    },    setCombatStyle(style) {
      if (STYLE_INFO[style]) this.combat = { ...this.combat, style }
    },

    setActiveTarget(itemId) {
      this.activeTarget = itemId
    },

    /** 设置某技能的挂机目标（§3.1 多技能并行） */
    setSkillTarget(skillId, itemId) {
      this.skillTargets[skillId] = itemId
    },

    /** 手动暂停/继续挂机技能（§3.1：停止后不产出，切页不中断） */
    setSkillPaused(skillId, paused) {
      if (paused) this.pausedSkills[skillId] = true
      else {
        delete this.pausedSkills[skillId]
        delete this.closedIdleTasks[skillId] // 继续 = 重新显示在挂机框
      }
    },
    /** 关闭挂机任务：停止并隐藏（§3.1；技能页重新选择目标可恢复） */
    closeIdleTask(skillId) {
      this.pausedSkills[skillId] = true
      this.closedIdleTasks[skillId] = true
    },
    /** 重新显示挂机任务（技能页重新选择目标时调用） */
    reopenIdleTask(skillId) {
      delete this.closedIdleTasks[skillId]
    },
    isSkillPaused(skillId) {
      return !!this.pausedSkills?.[skillId]
    },

    /** 每帧推进：并行上限内的挂机技能 + 其余实例 + 对决 + 奥义消耗 + 周期检查（§10.2.1 / §3.1） */
    tick(deltaMs) {
      if (!(deltaMs > 0)) return
      const running = new Set(this.getRunningIdleSkills().map((i) => i.id))
      for (const inst of getAllSkillInstances()) {
        try {
          // 采集/探索受并行上限约束；农耕（时间戳生长）与其余实例照常
          if ((inst.type === 'gathering' || inst.type === 'exploration') && !running.has(inst.id)) continue
          inst.tick(deltaMs)
        } catch (err) {
          console.error(`[player.tick] ${inst.id} tick error`, err)
        }
      }
      getCombat()?.tick(deltaMs)
      this.drainAoji(deltaMs)
      this._tickRestaurant(deltaMs) // 餐厅放置收入（§13）
      this._tickOrders(deltaMs) // 食客订单（2026-09-06）
      this._tickSpiritBonds(deltaMs) // 食灵羁绊出战时长（2026-09-06）
      this._tickAutoSupply(deltaMs) // 弹药自动补给（2026-09-09）
      this._tickAutomation(deltaMs) // 自动化中心（2026-09-10）
      this._tickRanch() // 牧场养殖（2026-09-10）
      this._tickBranches() // 餐厅分店（2026-09-10）
      this._tickMichelin() // 米其林评级（2026-09-10）
      this._tickStaff() // 雇工班底发薪（2026-09-10）
      this._tickApprentice() // 师徒传承：徒弟成长（2026-09-10）
      this._tickBanquet() // 宴会承办超时检查（2026-09-10）
      this._tickTakeout(deltaMs) // 外卖业务（2026-09-10）
      this._tickContracts() // 供应商合约按日结算（2026-09-10）
      this._tickCritic(deltaMs) // 美食评论家到访（2026-09-09）

      // 周期任务：腐坏 / 成就 / 任务同步 / 赛季同步
      this._periodicAccum = (this._periodicAccum ?? 0) + deltaMs
      if (this._periodicAccum >= ACHIEVE_CHECK_MS) {
        this._periodicAccum = 0
        const now = Date.now()
        this.checkSpoilage(now)
        this.checkAchievements()
        this.checkSetBonuses()
        this.syncQuestProgress()
        this.syncSeasonProgress()
        this._tickPlan() // 挂机计划推进（2026-09-09）
        this.ensureDailyTasks()
        this.ensureWeeklyTask()
        this.ensureWeeklyChallenge() // 每周挑战赛（2026-09-09）
        this._tickHardcoreDay() // 硬核生存天数（跨日 +1，同日防重）
      }

      // 节流更新 lastOnlineAt（5s 一次）
      this._tickAccum = (this._tickAccum ?? 0) + deltaMs
      if (this._tickAccum >= 5_000) {
        this._tickAccum = 0
        this.lastOnlineAt = Date.now()
      }
    },
  },
})
