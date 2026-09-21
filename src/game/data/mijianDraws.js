// 觅珍抽卡（2026-09-06）— 材料/食物/厨具三池，金币消费，价值加权随机（纯函数可测）
// 纯新增获取来源（不动任何物品数值）；图鉴三查见 itemSources.js 的「觅珍」来源。
import { ITEMS } from './items.js'
import { itemImage } from './itemImage.js'
import { SIDELINE_ITEM_CATEGORIES } from './sidelineWorks.js'

/** 抽卡池一律排除的类别：矿物（不对口径）与**全部副业独占品**（抽卡能出就等于绕过整条技能线） */
const POOL_EXCLUDED_CATEGORIES = ['mineral', ...SIDELINE_ITEM_CATEGORIES]

export const MIJIAN_POOLS = [
  { id: 'material', name: '材料池', icon: '🧺', desc: '普通食材/香料（无珍品）。55% 返还金币 · 22% 一档低阶材料 · 23% 抽物品', price: 60, kinds: ['ingredient', 'spice'], cap: 50 },
  { id: 'food', name: '食物池', icon: '🍱', desc: '普通料理/饮品（无珍品）。55% 返还金币 · 22% 一档料理 · 23% 抽物品', price: 110, kinds: ['food', 'drink'], cap: 100 },
  { id: 'gear', name: '厨具池', icon: '⚔️', desc: '装备（八槽位，稀有度加权，10 抽保底稀有+）', price: 500, kinds: ['equipment'] },
  { id: 'mix', name: '混池', icon: '🎲', desc: '55% 返还金币 · 22% 一档素材 · 23% 抽物品（其中含少量装备）', price: 80, kinds: ['mix'], cap: 60 },
  { id: 'limited', name: '限时池', icon: '🌟', tag: '限时', desc: '80% 限时装备（极品率极低）+ 20% 美食，5 抽保底稀有+', price: 600, kinds: ['limited'], cap: 150 },
]

/** 限时池轮换周期（14 天）；剩余时间用于横幅角标倒计时 */
export const LIMITED_PERIOD_MS = 14 * 24 * 3600_000
export function limitedRemainingMs(now = Date.now()) {
  return LIMITED_PERIOD_MS - (now % LIMITED_PERIOD_MS)
}

// 厨具池保底：累计 10 抽未出「稀有」及以上 → 本次必出
export const GEAR_PITY = 10
// 限时池短保底：5 抽
export const LIMITED_PITY = 5

// 装备稀有度权重（厨具池：稀有+ ≈ 12%）
const QUALITY_WEIGHT = { 普通: 74, 精良: 22, 稀有: 7, 史诗: 3.2, 传说: 1.3, 神话: 0.5 }
// 限时池装备权重（稀有+ ≈ 3%，配 5 抽保底）
const LIMITED_QUALITY_WEIGHT = { 普通: 86, 精良: 12, 稀有: 2, 史诗: 0.75, 传说: 0.2, 神话: 0.08 }
// 素材/食物池加权幂次（0.85→0.55：拉平价值差，珍品率下降）
const NORMAL_EXP = 0.85

/**
 * 垫底档（2026-09-21 用户：「觅珍池子不够严谨，应该有高概率的东西来占用概率，比如超高概率的金币、
 * 中概率的 1 档东西」）——**只给「纯价值加权」的三个池**（材料 / 食物 / 混池）用。
 *
 * 它们原本每次抽都返回一个按 value 加权的随机物品（159 个成员里最高频只有 1.4%），
 * 于是「抽到什么都是差不多的东西」、好货也不稀有。现改为三档：
 *   55% 金币（返还池价的 25%~55%，均值 ≈40%）· 22% 一档（池内价值最低的 20%）· 余 23% 走原路径。
 * ⚠️ 厨具池与限时池**不叠这一层**：它们本来就有垫底结构（品质权重里 普通+精良 = **96% / 97%**）
 *    且带保底，再叠一层会把「5/10 抽保底稀有」的节奏也一起改掉。
 */
export const FILLER = { gold: 0.55, cheap: 0.22 }
/** 金币档的返还区间（占池价比例，下限/上限）—— 定这两个数是为了让总回收率仍落在本系统标定的 30~40% 带内 */
export const FILLER_GOLD_PCT = [0.25, 0.55]
/** 哪些池有垫底档（其余池走各自原有路径） */
export const FILLER_POOLS = ['material', 'food', 'mix']

/** 金币档返还额：池价 × 12%~30%，至少 1 */
export function fillerGoldAmount(price, rng = Math.random) {
  const [a, b] = FILLER_GOLD_PCT
  return Math.max(1, Math.round((price ?? 0) * (a + rng() * (b - a))))
}

/** 「一档」= 池内价值最低的 20% 成员（按件取整，至少 1 件） */
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

/** 价值加权随机（幂次控制稀有度分布：越低越偏普通，越高越陡） */
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

/** 厨具池：先加权选稀有度 → 从该稀有度装备中随机一件
 *  pity：距上次稀有+的抽数（>= GEAR_PITY 必出稀有及以上） */
function pickGear(rng, pity, weightTable = QUALITY_WEIGHT) {
  const gear = poolItems('gear')
  if (!gear.length) return null
  let quality
  if (pity >= GEAR_PITY - 1) {
    // 第 10 抽（累计未出稀有 9 次）触发保底
    quality = rng() < 0.15 ? '神话' : rng() < 0.4 ? '传说' : '史诗'
  } else {
    const entries = Object.entries(weightTable)
    let total = entries.reduce((a, [, w]) => a + w, 0)
    let roll = rng() * total
    for (const [q, w] of entries) {
      roll -= w
      if (roll <= 0) { quality = q; break }
    }
  }
  const cand = gear.filter((it) => it.quality === quality)
  return cand.length ? cand[Math.floor(rng() * cand.length)] : weightedPick(gear, rng)
}

export function pickItem(poolId, rng = Math.random, pity = 0) {
  // 垫底档（材料/食物/混池）：金币 或 一档物品 —— 见 FILLER 的说明
  if (FILLER_POOLS.includes(poolId)) {
    const def = MIJIAN_POOLS.find((p) => p.id === poolId)
    const roll = rng()
    if (roll < FILLER.gold) return { gold: fillerGoldAmount(def?.price, rng), boosted: false }
    if (roll < FILLER.gold + FILLER.cheap) {
      const tier = cheapTier(poolId)
      return { item: tier[Math.min(tier.length - 1, Math.floor(rng() * tier.length))], boosted: false, cheap: true }
    }
  }
  if (poolId === 'gear') return { item: pickGear(rng, pity), boosted: pity >= GEAR_PITY - 1 }
  if (poolId === 'mix') {
    // 混池：8% 概率出装备（低权重表），其余素材（拉平；候选不含装备）
    const item = rng() < 0.08 ? pickGear(rng, 0) : weightedPick(materialFoodItems(60), rng, NORMAL_EXP)
    return { item, boosted: false }
  }
  if (poolId === 'limited') {
    // 限时池：80% 装备（极陡权重表，稀有+ ≈ 3%）+ 20% 美食；5 抽保底
    const boosted = pity >= LIMITED_PITY - 1
    let item
    if (boosted) {
      // 保底触发：强制稀有及以上（复用 pickGear 内部保底档位）
      item = pickGear(rng, GEAR_PITY - 1, LIMITED_QUALITY_WEIGHT)
    } else if (rng() < 0.8) {
      item = pickGear(rng, 0, LIMITED_QUALITY_WEIGHT)
    } else {
      item = weightedPick(materialFoodItems(150), rng, NORMAL_EXP)
    }
    return { item, boosted }
  }
  const items = poolItems(poolId)
  return { item: weightedPick(items, rng, NORMAL_EXP), boosted: false }
}

/** 非装备素材缓存（混池/限时池的非装备分支与展示用） */
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
