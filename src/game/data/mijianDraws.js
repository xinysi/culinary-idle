// 觅珍抽卡（2026-09-06 立；2026-09-22 按用户完整规格重写概率核心）
//
// 规格来源（2026-09-22 用户给的「通用前置规则 + 池子总览表 + 保底状态机」）：
//   · 分支：40% 返金（**固定 20% 抽卡成本**，2026-09-26 由 35% 下调）｜25% 低档物品｜35% 正常抽取（固定权重，不再价值加权）
//   · 双保底：稀有及以上保底 + 神话累计保底，**两套计数相互独立**；神话优先于稀有
//   · 软保底：稀有保底前 10 抽内，稀有+ 概率线性提升（材料/食物池无装备分支 ⇒ 无保底）
//   · 只要扣了金币，无论结果（返金/低档/正常）都计入保底计数
//   · 保底产出**不走进分支 roll**（不会同时返金/给低档）
// 纯新增获取来源（不动任何物品数值）；图鉴三查见 itemSources.js 的「觅珍」来源。
import { tunerOver } from './tuner.js'
import { ITEMS } from './items.js'
import { itemImage } from './itemImage.js'
import { SIDELINE_ITEM_CATEGORIES } from './sidelineWorks.js'

/** 抽卡池一律排除的类别：矿物（不对口径）与**全部副业独占品**（抽卡能出就等于绕过整条技能线） */
const POOL_EXCLUDED_CATEGORIES = ['mineral', ...SIDELINE_ITEM_CATEGORIES]

// ── 概率常量（⚠️ 必须在 MIJIAN_POOLS **之前**：池描述要引用它们，写在后面会 TDZ 报错）──

/** 三档分支（材料/食物池用）：40% 返金 · 25% 低档 · 35% 正常 */
export const BRANCH = { gold: 0.4, cheap: 0.25, normal: 0.35 }
/** 混池专用分支（2026-09-25 用户拍板「混池调低」）：65% 返金 · 25% 低档 · 10% 正常。
 *  🔴 为什么混池要单独一份：混池的「正常」分支是**纯装备**（按品质权重 roll），价值远高于
 *  材料/食物的正常分支（均匀抽）⇒ 用材料/食物那套 35% 正常分支时回收率冲到 51.3%。
 *  正常分支降到 10% 后（当时返金 35%）实测 ≈33.6%；返金再降到 20%（2026-09-26）后 **28.0%**。
 *  ⚠️ 副作用（设计上接受）：混池基础稀有+ 从 2.0% 降到 ≈1.0%，长期稀有+ 主要由双保底（50/300）兜底。
 *  💡 还想再低：`branchOf` 已把这个「正常分支」开成调参键 `mixNormal`（调到 6% ⇒ 回收率 ≈24.7%），
 *     它在**保底触发前**生效（保底产出不走进分支）。公示表与池描述由 `poolOdds()`/`poolDesc()` 自动跟随。 */
export const MIX_BRANCH = { gold: 0.65, cheap: 0.25, normal: 0.1 }
export const BRANCH_POOLS = ['material', 'food', 'mix']
/** 唯一出口：任何要读「某池三档分支」的地方（pickItem/poolDesc/poolOdds/守卫）都调它，别直接挑常量 */
export function branchOf(poolId) {
  if (poolId !== 'mix') return BRANCH
  // 运营调参：只放开「正常分支」一个自由度，返金档按 1 − 低档 − 正常 派生（三者恒等于 1）
  const normal = tunerOver('mixNormal', MIX_BRANCH.normal, 0, 1 - MIX_BRANCH.cheap)
  if (normal === MIX_BRANCH.normal) return MIX_BRANCH
  return { gold: 1 - MIX_BRANCH.cheap - normal, cheap: MIX_BRANCH.cheap, normal }
}
/** 返金比例：**固定**抽卡成本的 20%（2026-09-26 由 35% 下调 —— 用户「不能让觅珍回收率太大，不然还是能刷钱」）。
 *  🔴 **别把回收率当「抽卡值不值」来写文案**（2026-09-26 用户订正：「抽卡本来就是付出和赌」）：
 *  玩家买到的是**物品本身与那一把的概率**，返金只是**垫底结果**，不是回本承诺。回收率这条数**唯一的作用**
 *  是当**套利上限**：只要 <100%，就不存在「金币 → 抽卡 → 再卖 → 金币」的闭环。
 *  🔴 为什么下调：**返金档是回收率的唯一大杠杆** ——「低档物品」是池内价值最低 20% 的成员，
 *  按半价折算对回收的贡献 ≈ 0（实测 0.0~0.2 金/抽），所以回收率 = 返金档 + 正常分支两块。
 *  35% 时实测：混池 **37.8%** / 食物 23.2% / 材料 22.6%（厨具 15.0 / 限时 11.3 无返金档，不受影响）。
 *  降到 20% 后：混池 **28.0%** / 食物 17.2% / 材料 16.5% ⇒ **五池全部 ≤30%**（30% 是给套利线留的余量）。
 *  ⚠️ 结构没变：金币**仍是最高频的垫底结果**（材料/食物 40%、混池 65% 的抽次），只是单次金额变小 ——
 *     这正是规格「超高概率的金币、中概率的 1 档」要的形态。
 *  ⚠️ 已排除的旁路（不必再查）：交易所收购价最高 2.4× 价值（倍率 1.6 × 货签 +50%），但 `exchangeSell`
 *     只收当期 6 种**食材类目**货，抽卡产物是装备/材料/熟食 ⇒ 卖不到交易所；券无早期来源（塔 L60+ / 山海 / 道途 / 秘境）。 */
export const REFUND_PCT = 0.20
/** 返金额 = 池价 × 20%，**向下取整**（材料 12 / 食物 22 / 混池 16）。
 *  ⚠️ 金币引擎是整数：`gainGold` 里 `Math.floor(amount * (1+加成))` ⇒ 110 × 20% = 22 恰好整数，
 *     但**出口一律按整数算**（不管基线是不是整数），公示与结算同源
 *     （否则页面上写 38.5、玩家拿到 38，正属本项目最忌的那类不一致）。 */
export function refundOf(price) {
  return Math.floor((Number(price) || 0) * tunerOver('refundPct', REFUND_PCT, 0, 1))
}

// 装备稀有度权重（**导出**：公示面板与守卫都读这一份，别在别处重抄）
// 厨具池 / 混池：稀有+ 4%
export const QUALITY_WEIGHT = { 普通: 82, 精良: 14, 稀有: 2.7, 史诗: 0.95, 传说: 0.3, 神话: 0.05 }
// 限时池装备权重：稀有+ 1.5%
export const LIMITED_QUALITY_WEIGHT = { 普通: 90, 精良: 8.5, 稀有: 1.2, 史诗: 0.24, 传说: 0.05, 神话: 0.01 }
// 保底命中时的品质分布（规格给了**每池不同**的两张表）
export const PITY_QUALITY_MIX = { 稀有: 70, 史诗: 22, 传说: 7, 神话: 1 }
export const PITY_QUALITY_GEAR = { 稀有: 65, 史诗: 24, 传说: 9, 神话: 2 }

export const RARE_UP = ['稀有', '史诗', '传说', '神话']
export const COMMON = ['普通', '精良']
/** 某张权重表的「稀有及以上」占比（0~1；按表内总和归一） */
export function rareUpShare(table = QUALITY_WEIGHT) {
  const total = Object.values(table).reduce((a, b) => a + b, 0) || 1
  const rare = Object.entries(table).filter(([q]) => RARE_UP.includes(q)).reduce((a, [, w]) => a + w, 0)
  return rare / total
}
/** 同上，以百分比表示（公示面板用；留一位小数） */
export function rareUpPct(table = QUALITY_WEIGHT) {
  return Math.round(rareUpShare(table) * 1000) / 10
}
export const GEAR_RARE_PCT = rareUpPct(QUALITY_WEIGHT)
export const LIMITED_RARE_PCT = rareUpPct(LIMITED_QUALITY_WEIGHT)

// ── 双保底（规格「保底状态机」）──
/** 每池的保底上限与保底命中分布；材料/食物池**无装备保底**（不在表里 ⇒ 不存计数） */
export const PITY_RULES = {
  mix: { rare: 50, myth: 300, table: PITY_QUALITY_MIX },
  gear: { rare: 40, myth: 200, table: PITY_QUALITY_GEAR },
  limited: { rare: 40, myth: 200, table: PITY_QUALITY_GEAR },
}
export const PITY_POOLS = Object.keys(PITY_RULES)
export function pityRuleOf(poolId) {
  const r = PITY_RULES[poolId]
  if (!r) return null
  // 运营调参：只放开「稀有保底抽数」；上限夹在神话保底之前（否则稀有保底永不触发）
  const rare = tunerOver(poolId === 'mix' ? 'mixPity' : 'gearPity', r.rare, 5, Math.max(10, r.myth - 1))
  return rare === r.rare ? r : { ...r, rare }
}
/** 软保底窗口：保底前 10 抽线性提升（厨具/限时第 30 抽起，混池第 40 抽起 = 各自 rare - 10） */
export const SOFT_WINDOW = 10
/**
 * 软保底的上限概率（最后一抽前）。
 * 🔴 为什么是 0.9 而不是 1.0：若提升到 100%，则「稀有保底」永远不会触发 ⇒ 规格里那张
 *    **保底命中分布**（稀有 65/史诗 24/传说 9/神话 2）就成了死代码。留 10% 缺口，
 *    硬保底才有意义（限时池因为 20% 美食分支不重置计数，触发率还会明显更高）。
 */
export const SOFT_MAX_P = 0.9
/** 该池平时的品质权重表 */
export function baseTableOf(poolId) {
  return poolId === 'limited' ? LIMITED_QUALITY_WEIGHT : QUALITY_WEIGHT
}
/**
 * 软保底后的稀有+ 概率（不在区间内返回 null = 用原表）。
 * @param rareCount 当前**已累计未出稀有+**的抽数（含本抽，见 drawMijian 的 +1 时机）
 */
export function softRareP(poolId, rareCount) {
  const rule = pityRuleOf(poolId)
  if (!rule) return null
  const start = rule.rare - SOFT_WINDOW
  if (!(rareCount >= start) || rareCount >= rule.rare) return null
  const base = rareUpShare(baseTableOf(poolId))
  const t = (rareCount - start + 1) / SOFT_WINDOW
  return base + (tunerOver('softMaxP', SOFT_MAX_P, 0, 1) - base) * t
}

// 素材/食物池加权幂次（保留给非抽卡的价值加权用法；抽卡已改固定权重）
const NORMAL_EXP = 0.85
export const NORMAL_EXPONENT = NORMAL_EXP
/** 限时池里「出装备」的概率（其余为限定美食） */
export const LIMITED_GEAR_PCT = 0.8

export const MIJIAN_POOLS = [
  { id: 'material', name: '材料池', icon: '🧺', price: 60, kinds: ['ingredient', 'spice'], cap: 50 },
  { id: 'food', name: '食物池', icon: '🍱', price: 110, kinds: ['food', 'drink'], cap: 100 },
  { id: 'gear', name: '厨具池', icon: '⚔️', price: 500, kinds: ['equipment'] },
  { id: 'mix', name: '混池', icon: '🎲', price: 80, kinds: ['mix'], cap: 60 },
  { id: 'limited', name: '限时池', icon: '🌟', tag: '限时', price: 600, kinds: ['limited'], cap: 150 },
]
/** 池子一句话描述（**从常量算出来**：改概率时说明自动跟着变，别手抄数字） */
export function poolDesc(poolId) {
  const def = MIJIAN_POOLS.find((p) => p.id === poolId)
  if (!def) return ''
  if (BRANCH_POOLS.includes(poolId)) {
    const lowTxt = poolId === 'mix' ? '一档素材' : poolId === 'material' ? '一档低阶材料' : '一档料理'
    const midTxt = poolId === 'mix' ? '池内素材或装备' : '池内素材'
    const p = (x) => Math.round(x * 100)
    const rule = pityRuleOf(poolId)
    const tail = rule ? `；${rule.rare} 抽稀有保底 / ${rule.myth} 抽神话保底` : '（无装备保底）'
    const br = branchOf(poolId)
    return `${p(br.gold)}% 返 ${refundOf(def.price)} 金 · ${p(br.cheap)}% ${lowTxt} · ${p(br.normal)}% 正常抽取（${midTxt}）${tail}`
  }
  if (poolId === 'gear') {
    const rule = PITY_RULES.gear
    return `装备（八槽位，稀有+ ≈ ${GEAR_RARE_PCT}%；${rule.rare} 抽稀有保底 / ${rule.myth} 抽神话保底）`
  }
  const rule = PITY_RULES.limited
  return `80% 限时装备（稀有+ ≈ ${LIMITED_RARE_PCT}%）+ 20% 限定美食；${rule.rare} 抽稀有保底 / ${rule.myth} 抽神话保底（跨期继承）`
}

/** 限时池轮换周期（14 天）；剩余时间用于横幅角标倒计时 */
export const LIMITED_PERIOD_MS = 14 * 24 * 3600_000
export function limitedRemainingMs(now = Date.now()) {
  return LIMITED_PERIOD_MS - (now % LIMITED_PERIOD_MS)
}

/**
 * 保底计数的**存档结构**：按池分开，每池两个独立计数
 *   `{ mix: {rare, myth}, gear: {rare, myth}, limited: {rare, myth} }`
 * ⚠️ 旧档有三种历史形态，都要迁移（见 `migratePity`）：数字 → `{gear: n, limited: n}` → 本形态。
 */
export const EMPTY_PITY = () => ({ mix: { rare: 0, myth: 0 }, gear: { rare: 0, myth: 0 }, limited: { rare: 0, myth: 0 } })

/** 旧档保底迁移（纯函数，读档/抽卡前都可调） */
export function migratePity(saved) {
  const out = EMPTY_PITY()
  const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0)
  if (typeof saved === 'number') {
    out.gear.rare = num(saved) // 最旧形态：单一数字（当时只有厨具池有保底）
  } else if (saved && typeof saved === 'object') {
    for (const k of ['mix', 'gear', 'limited']) {
      const v = saved[k]
      if (typeof v === 'number') out[k].rare = num(v) // 中间形态 {gear: n, limited: n}
      else if (v && typeof v === 'object') {
        out[k].rare = num(v.rare)
        out[k].myth = num(v.myth)
      }
    }
  }
  return out
}

/** 低档物品池：池内价值最低的 20%（**固定权重 = 均匀**，规格「不再动态计算价值」） */
export function cheapTier(poolId) {
  const items = poolItems(poolId)
  const n = Math.max(1, Math.floor(items.length * 0.2))
  return [...items].sort((x, y) => (x.value ?? 0) - (y.value ?? 0)).slice(0, n)
}

/** 池内候选（模块级缓存）
 *  mix：全品类混合（材料/香料/料理/饮品/装备，排除矿物）
 *  limited：全品类大奖池（池大 → 极品概率天然极低；另用 value^1.8 陡加权） */
const POOL_CACHE = {}
/** ⚠️ 池子按 `value` 筛选（cap），而 `applyValueBalance()` 会改 value —— 所以它在收尾时会调本函数清缓存，
 *  否则「谁先被 import」会决定池子成员（实测：itemSources 先加载 → 缓存住平衡前的筛选结果 →
 *  材料池里混进了平衡后价值 >50 的物品，`system_test` 的「无珍品」断言 FAIL）。 */
let _poolVersion = 0
/** 池版本：每次清缓存 +1。图鉴来源登记侧据此判断「需要重新登记」（见 itemSources.js）。 */
export function mijianPoolVersion() {
  return _poolVersion
}

export function resetMijianPoolCache() {
  for (const k of Object.keys(POOL_CACHE)) delete POOL_CACHE[k]
  _materialFoodCache = null
  _poolVersion++
}

export function poolItems(poolId) {
  if (POOL_CACHE[poolId]) return POOL_CACHE[poolId]
  const def = MIJIAN_POOLS.find((p) => p.id === poolId)
  const all = Object.values(ITEMS)
  let items
  if (poolId === 'mix' || poolId === 'limited') {
    items = all.filter((it) =>
      ['ingredient', 'spice', 'food', 'drink', 'equipment'].includes(it.type) &&
      !(POOL_EXCLUDED_CATEGORIES.includes(it.category) || /矿$/.test(it.name))
    )
  } else {
    items = all.filter((it) =>
      def.kinds.includes(it.type) &&
      !(POOL_EXCLUDED_CATEGORIES.includes(it.category) || /矿$/.test(it.name)) &&
      (!def.cap || it.value <= def.cap)
    )
  }
  POOL_CACHE[poolId] = items
  return items
}

/** 均匀取一件（规格：「固定权重」= 不再按价值加权） */
function uniformPick(items, rng = Math.random) {
  if (!items.length) return null
  return items[Math.floor(rng() * items.length)] ?? items[items.length - 1]
}

/** 价值加权随机（保留给非抽卡用途；抽卡已改固定权重） */
function weightedPick(items, rng = Math.random, exponent = 0.85) {
  const weights = items.map((it) => Math.pow(Math.max(1, it.value), exponent))
  let total = 0
  for (const w of weights) total += w
  let roll = rng() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}

/** 按权重表掷一个稀有度（表内和不必正好 100，按总和归一） */
function rollQuality(rng, table) {
  const entries = Object.entries(table)
  const total = entries.reduce((a, [, w]) => a + w, 0) || 1
  let roll = rng() * total
  for (const [q, w] of entries) {
    roll -= w
    if (roll <= 0) return q
  }
  return entries[entries.length - 1][0]
}

/** 把「稀有+」的总占比整体抬到 p（表内 稀有:史诗:传说:神话 的比例不变；普通/精良按剩余比例分摊） */
export function scaleRareShare(table, p) {
  const target = Math.min(1, Math.max(0, p))
  const cur = rareUpShare(table)
  if (cur <= 0 || Math.abs(target - cur) < 1e-9) return table
  const out = {}
  const rareW = Object.entries(table).filter(([q]) => RARE_UP.includes(q)).reduce((a, [, w]) => a + w, 0)
  const comW = Object.entries(table).filter(([q]) => COMMON.includes(q)).reduce((a, [, w]) => a + w, 0)
  for (const q of COMMON) if (table[q] != null) out[q] = comW > 0 ? (table[q] / comW) * (1 - target) : 0
  for (const q of RARE_UP) if (table[q] != null) out[q] = rareW > 0 ? (table[q] / rareW) * target : 0
  return out
}

/** 从装备里按品质取一件（该品质没有装备时退化为按权重取） */
function equipOfQuality(quality, rng) {
  const gear = poolItems('gear')
  const cand = gear.filter((it) => it.quality === quality)
  if (cand.length) return uniformPick(cand, rng)
  return weightedPick(gear, rng)
}

/** 装备分支：软保底区间内用提升后的表，否则用原表 */
function pickEquipBranch(poolId, rng, rareCount) {
  const p = softRareP(poolId, rareCount)
  const table = p == null ? baseTableOf(poolId) : scaleRareShare(baseTableOf(poolId), p)
  return equipOfQuality(rollQuality(rng, table), rng)
}

export function isRareUpItem(item) {
  return !!item?.quality && RARE_UP.includes(item.quality)
}

/**
 * 抽一次（**纯函数**：计数由调用方维护，见 player.drawMijian 的状态机）。
 * 判定顺序严格按规格：① 神话保底 → ② 稀有+ 保底 → ③ 分支 roll。
 * @param rareCount 含本抽的「连续未出稀有+」计数（调用方已 +1）
 * @param mythCount 含本抽的「连续未出神话」计数（调用方已 +1）
 * @returns {{item?, gold?, cheap?, guaranteed: 'myth'|'rare'|null, isRareUp: boolean, softP: number|null, boosted: boolean}}
 */
export function pickItem(poolId, rng = Math.random, rareCount = 0, mythCount = 0) {
  const rule = pityRuleOf(poolId)
  // ① 神话保底（优先于稀有保底；产出直接结算，不走分支 roll）
  if (rule && mythCount >= rule.myth) {
    const item = equipOfQuality('神话', rng)
    if (item) return { item, guaranteed: 'myth', isRareUp: true, softP: null, boosted: true }
  }
  // ② 稀有及以上保底（按该池的保底分布 roll）
  if (rule && rareCount >= rule.rare) {
    const item = equipOfQuality(rollQuality(rng, rule.table), rng)
    if (item) return { item, guaranteed: 'rare', isRareUp: true, softP: null, boosted: true }
  }
  const softP = softRareP(poolId, rareCount)
  // ③ 分支 roll
  if (BRANCH_POOLS.includes(poolId)) {
    const def = MIJIAN_POOLS.find((p) => p.id === poolId)
    const br = branchOf(poolId)
    const roll = rng()
    if (roll < br.gold) {
      return { gold: refundOf(def?.price), guaranteed: null, isRareUp: false, softP, boosted: false }
    }
    if (roll < br.gold + br.cheap) {
      const item = uniformPick(cheapTier(poolId), rng)
      return { item, cheap: true, guaranteed: null, isRareUp: isRareUpItem(item), softP, boosted: false }
    }
    if (poolId === 'mix') {
      // 混池的 35% 正常分支 = **装备**（按公示表的算法：0.35 × 品质权重 ⇒ 普通装备 28.7%）
      const item = pickEquipBranch('mix', rng, rareCount)
      return { item, guaranteed: null, isRareUp: isRareUpItem(item), softP, boosted: false }
    }
    // 材料/食物：均匀抽一件池内物品（固定权重）
    const item = uniformPick(poolItems(poolId), rng)
    return { item, guaranteed: null, isRareUp: false, softP, boosted: false }
  }
  if (poolId === 'gear') {
    const item = pickEquipBranch('gear', rng, rareCount)
    return { item, guaranteed: null, isRareUp: isRareUpItem(item), softP, boosted: false }
  }
  if (poolId === 'limited') {
    if (rng() < tunerOver('limitedGearPct', LIMITED_GEAR_PCT, 0, 1)) {
      const item = pickEquipBranch('limited', rng, rareCount)
      return { item, guaranteed: null, isRareUp: isRareUpItem(item), softP, boosted: false }
    }
    // 20% 限定美食：**不重置稀有计数**（规格「边界规则 3」）
    const item = uniformPick(materialFoodItems(150), rng)
    return { item, guaranteed: null, isRareUp: false, softP, boosted: false }
  }
  const item = uniformPick(poolItems(poolId), rng)
  return { item, guaranteed: null, isRareUp: isRareUpItem(item), softP, boosted: false }
}

/** 非装备素材缓存（限时池的非装备分支与展示用） */
let _materialFoodCache = null
export function materialFoodItems(cap = Infinity) {
  if (!_materialFoodCache) {
    _materialFoodCache = Object.values(ITEMS).filter((it) =>
      ['ingredient', 'spice', 'food', 'drink'].includes(it.type) &&
      !(POOL_EXCLUDED_CATEGORIES.includes(it.category) || /矿$/.test(it.name))
    )
  }
  return cap === Infinity ? _materialFoodCache : _materialFoodCache.filter((it) => it.value <= cap)
}

/** 池内预览图采样（抽卡背景轮播用）：等距取 count 张「有图片」的物品 */
export function poolPreview(poolId, count = 18) {
  const items = poolItems(poolId).filter((it) => itemImage(it.id))
  if (!items.length) return []
  const step = Math.max(1, Math.floor(items.length / count))
  const out = []
  for (let i = 0; i < items.length; i += step) {
    if (out.length >= count) break
    const img = itemImage(items[i].id)
    if (img) out.push({ id: items[i].id, name: items[i].name, img })
  }
  return out
}

/**
 * 单池公示明细（**唯一数据源**：游戏内「📊 概率说明」直接渲染它，一个数字都不许手抄）。
 * 返回的 `final` 就是规格里那张「单次抽卡最终概率」表：分支概率 × 品质权重。
 */
export function poolOdds(poolId) {
  const def = MIJIAN_POOLS.find((p) => p.id === poolId)
  const rule = pityRuleOf(poolId)
  // 百分比精度：分支/返金这类大数留 1 位；**最终概率表留 4 位**（用户公示表用的是
  // 28.700 / 4.900 / 0.945 / 0.3325 / 0.105 / 0.0175 这种精度，1 位会把 0.3325 压成 0.3）
  const pct1 = (x) => Math.round(x * 10) / 10
  const pct4 = (x) => Math.round(x * 10000) / 10000
  const pct = (x) => pct1(x * 100)
  const out = {
    id: poolId,
    name: def?.name ?? poolId,
    icon: def?.icon ?? '🎴',
    price: def?.price ?? 0,
    members: poolItems(poolId).length,
    desc: poolDesc(poolId),
    branch: null,
    refund: null,
    cheapCount: 0,
    quality: null,
    rarePct: null,
    gearShare: null,
    gearPct: null,
    foodPct: null,
    final: [],
    pity: null,
    soft: null,
  }
  if (BRANCH_POOLS.includes(poolId)) {
    const br = branchOf(poolId)
    out.branch = { gold: pct(br.gold), cheap: pct(br.cheap), normal: pct(br.normal) }
    out.refund = { pct: pct(REFUND_PCT), amount: refundOf(def?.price) }
    out.cheapCount = cheapTier(poolId).length
  }
  if (poolId === 'mix') {
    out.quality = QUALITY_WEIGHT
    out.rarePct = GEAR_RARE_PCT
    out.gearShare = branchOf(poolId).normal // 正常分支整支都是装备（混池 2026-09-25 起 10%）
  } else if (poolId === 'gear') {
    out.quality = QUALITY_WEIGHT
    out.rarePct = GEAR_RARE_PCT
    out.gearShare = 1
  } else if (poolId === 'limited') {
    out.quality = LIMITED_QUALITY_WEIGHT
    out.rarePct = LIMITED_RARE_PCT
    const lg = tunerOver('limitedGearPct', LIMITED_GEAR_PCT, 0, 1)
    out.gearShare = lg
    out.gearPct = pct(lg)
    out.foodPct = pct(1 - lg)
  }
  if (out.quality) {
    const table = out.quality
    const total = Object.values(table).reduce((a, b) => a + b, 0) || 1
    out.final = Object.entries(table).map(([q, w]) => ({
      quality: q === '普通' || q === '精良' ? `${q}装备` : `${q}装备`,
      pct: pct4((w / total) * out.gearShare * 100),
      raw: q,
    }))
  }
  if (rule) {
    out.pity = { rare: rule.rare, myth: rule.myth, table: rule.table, softStart: rule.rare - SOFT_WINDOW, softMaxP: pct(SOFT_MAX_P) }
    out.soft = { start: rule.rare - SOFT_WINDOW, end: rule.rare - 1, maxP: pct(SOFT_MAX_P) }
  }
  return out
}

/** 全部池的明细（概率说明面板一次渲染到底） */
export function allPoolOdds() {
  return MIJIAN_POOLS.map((p) => poolOdds(p.id))
}
