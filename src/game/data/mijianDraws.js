// 觅珍抽卡（2026-09-06）— 材料/食物/厨具三池，金币消费，价值加权随机（纯函数可测）
// 纯新增获取来源（不动任何物品数值）；图鉴三查见 itemSources.js 的「觅珍」来源。
import { ITEMS } from './items.js'

export const MIJIAN_POOLS = [
  { id: 'material', name: '材料池', icon: '🧺', desc: '食材/矿物/种子与加工材料', price: 300, kinds: ['ingredient', 'spice'] },
  { id: 'food', name: '食物池', icon: '🍱', desc: '料理/饮品/调料成品', price: 300, kinds: ['food', 'drink'] },
  { id: 'gear', name: '厨具池', icon: '⚔️', desc: '装备（八槽位，稀有度加权，10 抽保底稀有+）', price: 500, kinds: ['equipment'] },
]

// 厨具池保底：累计 10 抽未出「稀有」及以上 → 本次必出
export const GEAR_PITY = 10

// 装备稀有度权重（厨具池）
const QUALITY_WEIGHT = { 普通: 50, 精良: 24, 稀有: 14, 史诗: 7, 传说: 4, 神话: 1 }

/** 池内候选（模块级缓存：材料/食物/装备）
 *  材料池排除矿物（矿有专属获取链）；食物池含全部料理饮品 */
const POOL_CACHE = {}
function poolItems(poolId) {
  if (POOL_CACHE[poolId]) return POOL_CACHE[poolId]
  const def = MIJIAN_POOLS.find((p) => p.id === poolId)
  const items = Object.values(ITEMS).filter((it) => {
    if (!def.kinds.includes(it.type)) return false
    if (poolId === 'material' && (it.category === 'mineral' || /矿$/.test(it.name))) return false
    return true
  })
  POOL_CACHE[poolId] = items
  return items
}

/** 价值加权随机（0.7~1.3 幂次：低价值物品概率略平，高价值可控稀有） */
function weightedPick(items, rng = Math.random) {
  const weights = items.map((it) => Math.pow(Math.max(1, it.value), 0.85))
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
  const items = poolItems(poolId)
  return { item: weightedPick(items, rng), boosted: false }
}
