// 食客订单（2026-09-06）— 餐厅扩展：食客到访点单，交货得金币 + 好感经验
// 与餐厅菜单联动：从菜单（且背包有成品）抽样；收益为玩家侧奖励，不动料理固定数值。

import { getItem } from './items.js'

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
