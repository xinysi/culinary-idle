// 食客订单（2026-09-06）— 餐厅扩展：食客到访点单，交货得金币 + 好感经验
// 与餐厅菜单联动：从菜单（且背包有成品）抽样；收益为玩家侧奖励，不动料理固定数值。

import { getItem, ITEMS } from './items.js'

export const NAMES = [
  '老饕老王', '顾小姐', '美食同好', '夜市常客', '旅行美食家', '神秘食客',
  '隔壁张姨', '退休大厨', '挑嘴的评论家', '深夜打工人', '远道而来的客人', '半熟美食家',
]
export const ORDER_MIN_MS = 25 * 60_000 // 到访间隔 25-45 分钟
export const ORDER_MAX_MS = 45 * 60_000
export const ORDER_TTL_MS = 60 * 60_000 // 订单有效期 60 分钟
export const MAX_ORDERS = 3

export function nextOrderDelay() {
  return ORDER_MIN_MS + Math.random() * (ORDER_MAX_MS - ORDER_MIN_MS)
}

/**
 * 生成一单：优先菜单中有存货的料理；菜单对料理没存货也允许（玩家可现做）。
 * 赏金 = 料理价值 × 数量 × (1.5~2.2) × (1 + 餐厅等级 × 10%)
 * @returns {object|null} 无菜单可点时返回 null
 */
export function makeOrder(player) {
  const menu = (player.restaurant?.menu ?? []).filter((id) => getItem(id)?.type === 'food')
  if (!menu.length) return null
  const stock = menu.filter((id) => (player.inventory[id] ?? 0) > 0)
  const itemId = (Math.random() < 0.7 && stock.length) ? stock[Math.floor(Math.random() * stock.length)] : menu[Math.floor(Math.random() * menu.length)]
  const item = getItem(itemId)
  const qty = 1 + (Math.random() < 0.3 ? 1 : 0)
  const reward = Math.max(10, Math.round(item.value * qty * (1.5 + Math.random() * 0.7) * (1 + 0.1 * (player.restaurant?.level ?? 1))))
  return {
    id: 'o' + Date.now() + Math.floor(Math.random() * 10000),
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    itemId,
    qty,
    reward,
    createdMs: Date.now(),
    expireAt: Date.now() + ORDER_TTL_MS,
  }
}

// ── 美食评论家（2026-09-09）：稀有高要求食客 ──
// 随机 2~4 小时到访一次，要求「tier ≥ N 的某类料理」，满足给大奖（金币 + 神秘调料 + 好感），
// 60 分钟未满足则离开并留下差评（无惩罚，仅错过奖励）。
export const CRITIC_NAMES = ['美食评论家·老饕', '米其林密探', '食评专栏作家', '御膳房总管', '舌尖巡礼人', '甜点女王']
export const CRITIC_CATS = ['主菜', '汤品', '甜点', 'baking'] // 主食仅 18 种，不参与要求
export const CRITIC_MIN_INTERVAL_MS = 2 * 3600_000
export const CRITIC_MAX_INTERVAL_MS = 4 * 3600_000
export const CRITIC_TTL_MS = 60 * 60_000

/** 某类料理的最高 tier（避免要求超出该类实际存在的最高档） */
function maxTierOf(category) {
  let m = 1
  for (const it of Object.values(ITEMS)) {
    if (it.type === 'food' && it.category === category) m = Math.max(m, it.tier ?? 1)
  }
  return m
}

/** 生成一位评论家的要求：{ name, category, minTier, reward, createdMs, expireAt } */
export function makeCriticOrder(player, rng = Math.random) {
  const name = CRITIC_NAMES[Math.floor(rng() * CRITIC_NAMES.length)]
  const category = CRITIC_CATS[Math.floor(rng() * CRITIC_CATS.length)]
  const lv = player?.combatLevel ?? 1
  const minTier = Math.min(maxTierOf(category), Math.max(3, Math.round(3 + lv * 0.06)))
  return {
    name,
    category,
    minTier,
    reward: 300 + Math.round(lv * 50),
    createdMs: Date.now(),
    expireAt: Date.now() + CRITIC_TTL_MS,
  }
}

/** 下一位评论家的到访间隔 */
export function criticDelay(rng = Math.random) {
  return CRITIC_MIN_INTERVAL_MS + Math.floor(rng() * (CRITIC_MAX_INTERVAL_MS - CRITIC_MIN_INTERVAL_MS))
}
