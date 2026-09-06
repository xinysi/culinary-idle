// 玩家状态 — 需求文档 §10.2.3 / §5.4 / §6 / §7.2 / §8
// skills 为 { skillId: { level, exp, mastery: { itemId: level }, prestiges? } }
// inventory / bank 为 { itemId: quantity }
// 食灵出战（§3.3.6）、奥义激活（§3.4.1）、品鉴点数、增益 增益（§3.4.2）、
// 腐坏计时（§5.4）、成就/图鉴/称号（§6）、主线任务进度（§7.2）、统计

import { defineStore } from 'pinia'
import { SKILL_DEFS } from '../game/data/skills.js'
import { totalXpForLevel } from '../game/core/Experience.js'
import { getItem } from '../game/data/items.js'
import { getAllSkillInstances } from '../game/skills/registry.js'
import { STYLE_INFO } from '../game/data/combat.js'
import { getCombat } from '../game/combat/Combat.js'
import { SPIRITS, SPIRIT_SLOTS } from '../game/data/spirits.js'
import { AOJIS } from '../game/data/aojis.js'
import { ALL_ACHIEVEMENTS, collectionTotal } from '../game/data/achievements.js'
import { QUESTS, questObjectiveKey } from '../game/data/quests.js'
import { COMBAT_REGIONS } from '../game/data/combat.js'
import { EventBus } from '../game/core/EventBus.js'
import { masteryLevelFromCount } from '../game/core/mastery.js'
import { MAX_LEVEL, PRESTIGE_MAX_LEVEL } from '../game/skills/Skill.js'
import { getGuild, GUILD_SHOP } from '../game/data/guilds.js'
import { getSeason, activeSeasonId } from '../game/data/seasons.js'
import { RESTAURANT_DECOR_BY_ID } from '../game/data/restaurantDecor.js'
import { dailyTasksFor, weeklyTaskFor, DAILY_BONUS } from '../game/data/dailyTasks.js'
import { towerFloor, towerMilestone, TOWER_UNLOCK_LEVEL } from '../game/data/battleTower.js'
import { festThemeFor, festScore, festAccepts, FEST_MILESTONES, FEST_DAILY_ENTRIES } from '../game/data/cookingFest.js'
import { useUiStore } from './ui.js'

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

export const usePlayerStore = defineStore('player', {
  state: () => ({
    name: '美食学徒',
    title: null, // 称号（§6.3）
    avatar: null, // 自定义头像（base64 dataUrl，可在设置/头像处上传）
    gold: 100,
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
    spirits: { active: [] }, // 食灵出战列表（§3.3.6，最多 2 个）
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
    upgrades: {}, // 装备强化：{ [itemId]: level }（§13）
    settings: { autoEat: true, autoEatThreshold: 50, soundEnabled: false, maxParallelIdle: 0, uiScale: 1, xpMultiplier: 1 }, // maxParallelIdle：并行挂机上限 0=无限制（§3.1）；uiScale：界面缩放（0.8-1.2）；xpMultiplier：全局经验倍率（1/10/50/100/250/500/1000）
    storyProgress: {}, // 轶事/故事进度：{ `${kind}:${param}`: 次数 }，按具体物品/动作累计（§13）
  }),

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
    /** 已装备属性合计（§5.1/§4.2 来源之一） */
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
        if (item) total += (item.value + (item.heal ?? 0)) * 0.5
      }
      // 装饰加成：按每件装饰自身的收入%累加（各件 effect 随价格从 0.5% 到 3% 递增，无倒挂）
      let decorBonus = 0
      for (const id of s.restaurant?.decor ?? []) {
        const d = RESTAURANT_DECOR_BY_ID[id]
        if (d) decorBonus += (d.effect ?? 1) / 100
      }
      // 顾客好感小费（2026-09-06）：每级 +3%，封顶 20 级（+57%）
      const favorLv = favorLevelFromXp(s.restaurant?.favor?.xp ?? 0)
      const tip = 1 + 0.03 * (favorLv - 1)
      // 夜市狂潮（2026-09-06）：12-20 点餐厅收入 ×2
      const market = this.marketBoost?.() ?? { restaurant: 1, combatXp: 1 }
      return total * (1 + 0.3 * (s.restaurant.level - 1)) * (1 + decorBonus) * tip * market.restaurant
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
      this.$patch({
        name: '美食学徒',
        title: null,
        gold: 100,
        skills: defaultSkills(),
        inventory: {},
        bank: {},
        inventoryCap: 20,
        bankCap: 100,
        hardcore: false,
        pausedSkills: {},
        closedIdleTasks: {},
        equipment: defaultEquipment(),
        activeSkill: 'foraging',
        activeTarget: null,
        skillTargets: {}, // 新档待机：不自动开始挂机，玩家选择目标后开始
        lastOnlineAt: Date.now(),
        farming: { plots: [] },
        offlineBonusH: 0,
        combat: { style: 'knife', hp: 10, flavorEnergy: 50 },
        spirits: { active: [] },
        gastronomy: { active: [] },
        tastePoints: 0,
        buffs: { xpMult: null, yieldMult: null },
        spoilage: {},
        coldStorage: {},
        achievements: [],
        collected: {},
        quests: { index: 0, completed: [], progress: {} },
        stats: { combatWins: 0, combatLosses: 0, bosses: [], explorations: 0, totalGoldEarned: 0, prestiges: 0, restaurantTotal: 0, arena: { wins: 0, currentStreak: 0, bestStreak: 0, records: [] }, cardBattle: { wins: 0, losses: 0 } },
        restaurant: { level: 1, menu: [], incomeAccum: 0 },
        guild: { id: null, points: 0, day: null, taskProgress: {} },
        seasons: {},
        daily: { day: null, streak: 0, tasks: [], claimedAll: false },
        weekly: { week: null, task: null, progress: 0, claimed: false },
        tower: { floor: 1, best: 0, rewarded: [] },
        fest: { month: null, score: 0, entries: [], lastEntryDay: null, todayEntries: 0, rewarded: [] },
        spiritBonds: {},
        hardcoreStats: { days: 0, best: 0, lastDayKey: null },
        guide: { step: 0, done: false },
      })
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
        spirits: { active: Array.isArray(saved.spirits?.active) ? saved.spirits.active : [] },
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
        tower: saved.tower ?? { floor: 1, best: 0, rewarded: [] },
        fest: saved.fest ?? { month: null, score: 0, entries: [], lastEntryDay: null, todayEntries: 0, rewarded: [] },
        spiritBonds: saved.spiritBonds ?? {},
        hardcoreStats: saved.hardcoreStats ?? { days: 0, best: 0 },
        guide: saved.guide ?? { step: 0, done: false },
        lastOnlineAt: saved.lastOnlineAt ?? Date.now(),
      })
    },

    serialize() {
      return {
        name: this.name,
        title: this.title,
        avatar: this.avatar,
        gold: this.gold,
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
        tower: this.tower,
        fest: this.fest,
        spiritBonds: this.spiritBonds,
        hardcoreStats: this.hardcoreStats,
        guide: this.guide,
        lastOnlineAt: this.lastOnlineAt,
      }
    },

    gainGold(amount) {
      const n = Math.floor(amount)
      if (n > 0) {
        this.gold += n
        this.stats.totalGoldEarned += n
      }
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
      return true
    },

    unequip(slot) {
      const itemId = this.equipment[slot]
      if (!itemId) return false
      this.equipment[slot] = null
      this.gainItem(itemId, 1)
      return true
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

    // ── 食灵（§3.3.6）──
    setSpiritActive(spiritId, on) {
      const active = [...this.spirits.active]
      if (on) {
        if (active.includes(spiritId)) return false
        if (active.length >= SPIRIT_SLOTS) return false
        if ((this.inventory[spiritId] ?? 0) < 1) return false
        if (!this.spendItem(spiritId, 1)) return false
        this.spirits.active = [...active, spiritId]
        return true
      }
      if (!active.includes(spiritId)) return false
      this.spirits.active = active.filter((x) => x !== spiritId)
      this.gainItem(spiritId, 1)
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
      this.setSkillState(id, { level: 1, exp: 0, prestiges })
      this.stats.prestiges++
      EventBus.emit('player:prestige', { skillId: id, prestiges })
      return true
    },

    // ── 对决钩子 ──
    onCombatWin(opponent) {
      this.stats.combatWins++
      if (opponent.isBoss && !this.stats.bosses.includes(opponent.name)) {
        this.stats.bosses.push(opponent.name)
      }
      this.gainTastePoints(Math.floor(opponent.level * 1.5)) // 品鉴点数（§3.4.1 来源；乘 1.5 缓解奥义持久消耗）
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
    },
    seasonClaimTier(index) {
      const season = getSeason(activeSeasonId())
      const st = this.seasonState()
      const tier = season?.tiers[index]
      if (!tier || st.claimed.includes(index) || st.points < tier.points) return false
      st.claimed.push(index)
      st.points -= tier.points // 领取奖励扣除对应赛季点（积分兑换语义）
      if (tier.reward?.gold) this.gainGold(tier.reward.gold)
      if (tier.reward?.items) this.gainItems(tier.reward.items)
      EventBus.emit('season:claim', { name: season.name, tier: tier.name ?? `奖励 ${index + 1}` })
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
        if (brokeRecord) a.bestStreak = a.currentStreak
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
      return reward
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
      const t = this.tower ?? { floor: 1, best: 0, rewarded: [] }
      t.best = Math.max(t.best ?? 0, floor)
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

    // ── 夜市狂潮（2026-09-06 限时窗口）：每日 12:00-20:00，餐厅 ×2 + 对决经验 ×1.5 ──
    /** 是否处于夜市窗口（hour 可传参，便于测试；默认取当前本地小时） */
    marketOn(hour = null) {
      const h = hour ?? new Date().getHours()
      return h >= 12 && h < 20
    },
    /** 夜市倍率：{ restaurant, combatXp }（非窗口均为 1） */
    marketBoost(hour = null) {
      return this.marketOn(hour) ? { restaurant: 2, combatXp: 1.5 } : { restaurant: 1, combatXp: 1 }
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
      if (!festAccepts(this.festTheme(), item.category)) return { ok: false, msg: '这道菜不符合本月主题' }
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
      this._tickSpiritBonds(deltaMs) // 食灵羁绊出战时长（2026-09-06）

      // 周期任务：腐坏 / 成就 / 任务同步 / 赛季同步
      this._periodicAccum = (this._periodicAccum ?? 0) + deltaMs
      if (this._periodicAccum >= ACHIEVE_CHECK_MS) {
        this._periodicAccum = 0
        const now = Date.now()
        this.checkSpoilage(now)
        this.checkAchievements()
        this.syncQuestProgress()
        this.syncSeasonProgress()
        this.ensureDailyTasks()
        this.ensureWeeklyTask()
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
