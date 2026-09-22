// 觅珍抽卡（2026-09-06）— 材料/食物/厨具三池，金币消费，价值加权随机（纯函数可测）
// 纯新增获取来源（不动任何物品数值）；图鉴三查见 itemSources.js 的「觅珍」来源。
import { ITEMS } from './items.js'
import { itemImage } from './itemImage.js'
import { SIDELINE_ITEM_CATEGORIES } from './sidelineWorks.js'

/** 抽卡池一律排除的类别：矿物（不对口径）与**全部副业独占品**（抽卡能出就等于绕过整条技能线） */
const POOL_EXCLUDED_CATEGORIES = ['mineral', ...SIDELINE_ITEM_CATEGORIES]

// ── 概率常量（⚠️ 必须在 MIJIAN_POOLS **之前**：池描述里要引用它们，写在后面会 TDZ 报错）──
// 保底抽数（2026-09-22 用户要求：「厨具池和限时池应该 50 抽保底」）——两池同为 50
export const GEAR_PITY = 50
export const LIMITED_PITY = 50

// 装备稀有度权重（**导出**：概率说明面板与守卫都读这一份，别在别处重抄）
// 厨具池：稀有+ ≈ 4%（2026-09-22 用户报「稀有以上概率还是太高」→ 由 12% 下调）
export const QUALITY_WEIGHT = { 普通: 82, 精良: 14, 稀有: 2.7, 史诗: 0.95, 传说: 0.3, 神话: 0.05 }
// 限时池装备权重：稀有+ ≈ 1.5%（由 3% 再下调；配 50 抽保底）
export const LIMITED_QUALITY_WEIGHT = { 普通: 90, 精良: 8.5, 稀有: 1.2, 史诗: 0.24, 传说: 0.05, 神话: 0.01 }
// 保底命中时的品质权重：**以稀有为主**（旧版是「史诗 51% + 传说 34% + 神话 15%」，配 10 抽保底等于
// 每 10 抽白送一件史诗+，与「稀有以上要稀有」相悖；现在保底是兜底、不是奖励档）
export const PITY_QUALITY_WEIGHT = { 稀有: 70, 史诗: 22, 传说: 7, 神话: 1 }
const RARE_UP = ['稀有', '史诗', '传说', '神话']
/** 某张权重表的「稀有及以上」合计百分比（面板/守卫共用；按表内总和归一） */
export function rareUpPct(table = QUALITY_WEIGHT) {
  const total = Object.values(table).reduce((a, b) => a + b, 0)
  const rare = Object.entries(table).filter(([q]) => RARE_UP.includes(q)).reduce((a, [, w]) => a + w, 0)
  return Math.round((rare / total) * 1000) / 10
}
export const GEAR_RARE_PCT = rareUpPct(QUALITY_WEIGHT)
export const LIMITED_RARE_PCT = rareUpPct(LIMITED_QUALITY_WEIGHT)
// 素材/食物池加权幂次（0.85→0.55：拉平价值差，珍品率下降）
const NORMAL_EXP = 0.85
export const NORMAL_EXPONENT = NORMAL_EXP
/** 混池里「出装备」的概率（其余走价值加权素材）—— 提为常量，概率面板与 pickItem 同源 */
export const MIX_GEAR_PCT = 0.08
/** 限时池里「出装备」的概率（其余为美食） */
export const LIMITED_GEAR_PCT = 0.8

export const MIJIAN_POOLS = [
  { id: 'material', name: '材料池', icon: '🧺', desc: '普通食材/香料（无珍品）。55% 返还金币 · 22% 一档低阶材料 · 23% 抽物品', price: 60, kinds: ['ingredient', 'spice'], cap: 50 },
  { id: 'food', name: '食物池', icon: '🍱', desc: '普通料理/饮品（无珍品）。55% 返还金币 · 22% 一档料理 · 23% 抽物品', price: 110, kinds: ['food', 'drink'], cap: 100 },
  { id: 'gear', name: '厨具池', icon: '⚔️', desc: `装备（八槽位，稀有度加权，稀有+ ≈ ${GEAR_RARE_PCT}%，${GEAR_PITY} 抽保底稀有+）`, price: 500, kinds: ['equipment'] },
  { id: 'mix', name: '混池', icon: '🎲', desc: '55% 返还金币 · 22% 一档素材 · 23% 抽物品（其中含少量装备）', price: 80, kinds: ['mix'], cap: 60 },
  { id: 'limited', name: '限时池', icon: '🌟', tag: '限时', desc: `80% 限时装备（极品率极低，稀有+ ≈ ${LIMITED_RARE_PCT}%）+ 20% 美食，${LIMITED_PITY} 抽保底稀有+`, price: 600, kinds: ['limited'], cap: 150 },
]

/** 限时池轮换周期（14 天）；剩余时间用于横幅角标倒计时 */
export const LIMITED_PERIOD_MS = 14 * 24 * 3600_000
export function limitedRemainingMs(now = Date.now()) {
  return LIMITED_PERIOD_MS - (now % LIMITED_PERIOD_MS)
}


/**
 * 垫底档（2026-09-21 用户：「觅珍池子不够严谨，应该有高概率的东西来占用概率，比如超高概率的金币、
 * 中概率的 1 档东西」）——**只给「纯价值加权」的三个池**（材料 / 食物 / 混池）用。
 *
 * 它们原本每次抽都返回一个按 value 加权的随机物品（159 个成员里最高频只有 1.4%），
 * 于是「抽到什么都是差不多的东西」、好货也不稀有。现改为三档：
 *   55% 金币（返还池价的 25%~55%，均值 ≈40%）· 22% 一档（池内价值最低的 20%）· 余 23% 走原路径。
 * ⚠️ 厨具池与限时池**不叠这一层**：它们本来就有垫底结构（品质权重里 普通+精良 = **96% / 98.5%**）
 *    且各自带 50 抽保底，再叠一层会把「50 抽保底稀有」的节奏也一起改掉。
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

/** 按权重表掷一个稀有度（表内和不必正好 100，按总和归一） */
function rollQuality(rng, table) {
  const entries = Object.entries(table)
  const total = entries.reduce((a, [, w]) => a + w, 0)
  let roll = rng() * total
  for (const [q, w] of entries) {
    roll -= w
    if (roll <= 0) return q
  }
  return entries[entries.length - 1][0]
}

/** 厨具池：先加权选稀有度 → 从该稀有度装备中随机一件
 *  @param pity 距上次稀有+的抽数（`>= 保底抽数 - 1` 时本次必出稀有+）
 *  @param weightTable 平时用的品质权重表；保底那一抽改用 PITY_QUALITY_WEIGHT */
function pickGear(rng, pity, weightTable = QUALITY_WEIGHT, pityNeed = GEAR_PITY) {
  const gear = poolItems('gear')
  if (!gear.length) return null
  const quality = pity >= pityNeed - 1 ? rollQuality(rng, PITY_QUALITY_WEIGHT) : rollQuality(rng, weightTable)
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
    // 混池：MIX_GEAR_PCT 概率出装备（低权重表），其余素材（拉平；候选不含装备）
    const item = rng() < MIX_GEAR_PCT ? pickGear(rng, 0) : weightedPick(materialFoodItems(60), rng, NORMAL_EXP)
    return { item, boosted: false }
  }
  if (poolId === 'limited') {
    // 限时池：LIMITED_GEAR_PCT 出装备（陡权重表，稀有+ ≈ 1.5%）+ 其余美食；50 抽保底
    const boosted = pity >= LIMITED_PITY - 1
    let item
    if (boosted) {
      // 保底触发：强制稀有及以上（同一张保底权重表，本池用自己的保底抽数）
      item = pickGear(rng, pity, LIMITED_QUALITY_WEIGHT, LIMITED_PITY)
    } else if (rng() < LIMITED_GEAR_PCT) {
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

/**
 * 各池概率明细（2026-09-22 用户：「尤其是觅珍得详细讲一下各池子概率」）。
 *
 * 🔴 **只读本模块的常量与池成员**——页面绝不能手抄这些数字，否则改权重时说明会变成谎话
 *    （本项目的老毛病：显示与结算不同源）。守卫会断言这里算出来的数与常量一致。
 * @returns {{id,name,icon,price,members,filler,pity,quality,rarePct,extra}}
 */
export function poolOdds(poolId) {
  const def = MIJIAN_POOLS.find((p) => p.id === poolId)
  const r1 = (x) => Math.round(x * 10) / 10 // 百分比留一位小数（0.55*100 = 55.00000000000001 这类浮点尾巴别给玩家看）
  const out = {
    id: poolId,
    name: def?.name ?? poolId,
    icon: def?.icon ?? '🎴',
    price: def?.price ?? 0,
    members: poolItems(poolId).length,
    filler: null,
    quality: null,
    rarePct: null,
    pity: null,
    extra: [],
  }
  if (FILLER_POOLS.includes(poolId)) {
    out.filler = {
      goldPct: r1(FILLER.gold * 100),
      cheapPct: r1(FILLER.cheap * 100),
      drawPct: r1((1 - FILLER.gold - FILLER.cheap) * 100),
      refundLo: r1(FILLER_GOLD_PCT[0] * 100),
      refundHi: r1(FILLER_GOLD_PCT[1] * 100),
      cheapCount: cheapTier(poolId).length,
    }
  }
  if (poolId === 'gear') {
    out.quality = QUALITY_WEIGHT
    out.rarePct = GEAR_RARE_PCT
    out.pity = { need: GEAR_PITY, table: PITY_QUALITY_WEIGHT }
  } else if (poolId === 'limited') {
    out.quality = LIMITED_QUALITY_WEIGHT
    out.rarePct = LIMITED_RARE_PCT
    out.pity = { need: LIMITED_PITY, table: PITY_QUALITY_WEIGHT }
    out.extra.push({ label: '装备', pct: r1(LIMITED_GEAR_PCT * 100) }, { label: '美食', pct: r1((1 - LIMITED_GEAR_PCT) * 100) })
  } else if (poolId === 'mix') {
    // 混池里那 MIX_GEAR_PCT 的装备走厨具池同一张品质表
    out.quality = QUALITY_WEIGHT
    out.rarePct = GEAR_RARE_PCT
    out.extra.push({ label: '装备', pct: r1(MIX_GEAR_PCT * 100) }, { label: '素材', pct: r1((1 - MIX_GEAR_PCT) * 100) })
  } else {
    out.extra.push({ label: '池内物品', pct: 100 })
  }
  return out
}

/** 全部池的明细（概率说明面板一次渲染到底） */
export function allPoolOdds() {
  return MIJIAN_POOLS.map((p) => poolOdds(p.id))
}
