// 觅珍抽卡（2026-09-06）— 材料/食物/厨具三池，金币消费，价值加权随机（纯函数可测）
// 纯新增获取来源（不动任何物品数值）；图鉴三查见 itemSources.js 的「觅珍」来源。
import { ITEMS } from './items.js'
import { itemImage } from './itemImage.js'

export const MIJIAN_POOLS = [
  { id: 'material', name: '材料池', icon: '🧺', desc: '食材/矿物/种子与加工材料', price: 300, kinds: ['ingredient', 'spice'] },
  { id: 'food', name: '食物池', icon: '🍱', desc: '料理/饮品/调料成品', price: 300, kinds: ['food', 'drink'] },
  { id: 'gear', name: '厨具池', icon: '⚔️', desc: '装备（八槽位，稀有度加权，10 抽保底稀有+）', price: 500, kinds: ['equipment'] },
  { id: 'mix', name: '混池', icon: '🎲', desc: '全品类混合（价格低、出货温和）', price: 80, kinds: ['mix'] },
  { id: 'limited', name: '限时池', icon: '🌟', tag: '限时', desc: '全品类大奖池（价格高、极品概率极低，5 抽保底稀有+）', price: 1200, kinds: ['limited'] },
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

// 装备稀有度权重（厨具池）
const QUALITY_WEIGHT = { 普通: 50, 精良: 24, 稀有: 14, 史诗: 7, 传说: 4, 神话: 1 }

/** 池内候选（模块级缓存）
 *  mix：全品类混合（材料/香料/料理/饮品/装备，排除矿物）
 *  limited：全品类大奖池（池大 → 极品概率天然极低；另用 value^1.8 陡加权） */
const POOL_CACHE = {}
function poolItems(poolId) {
  if (POOL_CACHE[poolId]) return POOL_CACHE[poolId]
  const def = MIJIAN_POOLS.find((p) => p.id === poolId)
  const all = Object.values(ITEMS)
  let items
  if (poolId === 'mix' || poolId === 'limited') {
    items = all.filter((it) =>
      ['ingredient', 'spice', 'food', 'drink', 'equipment'].includes(it.type) &&
      !(it.category === 'mineral' || /矿$/.test(it.name))
    )
  } else {
    items = all.filter((it) => def.kinds.includes(it.type) && !(it.category === 'mineral' || /矿$/.test(it.name)))
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
function pickGear(rng, pity) {
  const gear = poolItems('gear')
  if (!gear.length) return null
  let quality
  if (pity >= GEAR_PITY - 1) {
    // 第 10 抽（累计未出稀有 9 次）触发保底
    quality = rng() < 0.15 ? '神话' : rng() < 0.4 ? '传说' : '史诗'
  } else {
    const entries = Object.entries(QUALITY_WEIGHT)
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
  if (poolId === 'gear') return { item: pickGear(rng, pity), boosted: pity >= GEAR_PITY - 1 }
  if (poolId === 'mix') return { item: weightedPick(poolItems('mix'), rng, 0.6), boosted: false }
  if (poolId === 'limited') {
    // 限时池：陡加权（高价值概率极低）+ 5 抽短保底（PITY_LIMITED=5）
    const boosted = pity >= LIMITED_PITY - 1
    let item
    if (boosted) {
      const gear = poolItems('gear')
      const q = rng() < 0.15 ? '神话' : rng() < 0.45 ? '传说' : rng() < 0.9 ? '史诗' : '稀有'
      const cand = gear.filter((it) => it.quality === q)
      item = cand.length ? cand[Math.floor(rng() * cand.length)] : weightedPick(poolItems('limited'), rng, 1.8)
    } else {
      item = weightedPick(poolItems('limited'), rng, 1.8)
    }
    return { item, boosted }
  }
  const items = poolItems(poolId)
  return { item: weightedPick(items, rng), boosted: false }
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
