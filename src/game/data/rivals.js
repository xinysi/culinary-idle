// 同业竞争榜（2026-09-10 新增）— 给经营数值一个「对手」，补上游戏缺失的竞争层。
// 设计约束（纯读取层）：
//   ① 玩家分数只由既有数据推导（米其林分 / 菜单 / 装饰 / 分店 / 常客 / 订单 / 累计收入），不改任何既有数值；
//   ② 对手为本地生成的 NPC 餐厅（与竞技场镜像同思路，非铁律敌人），难度按「月」缓慢上浮；
//   ③ 只给正向激励（名次奖励 + 可花钱「推广」），不做收入惩罚——挂机游戏不该有负反馈惩罚。

/** 榜单规模（含玩家） */
export const RIVAL_BOARD_SIZE = 6
/** 对手每月变强的幅度（6%） */
export const RIVAL_MONTH_GROWTH = 0.06
/** 推广（本月分数 +30%）花费 */
export const RIVAL_PROMO_COST = 20000
export const RIVAL_PROMO_BONUS = 30

/** 对手餐厅名单（12 家，按月份确定性轮换 5 家上场） */
export const RIVAL_SHOPS = [
  { id: 'r1', name: '老陈记', icon: '🥘', style: '家常小馆', power: 500 },
  { id: 'r2', name: '金牛角', icon: '🥩', style: '烤肉铺', power: 800 },
  { id: 'r3', name: '五味轩', icon: '🍜', style: '面馆', power: 1300 },
  { id: 'r4', name: '海云楼', icon: '🦐', style: '海鲜楼', power: 2000 },
  { id: 'r5', name: '竹里馆', icon: '🎋', style: '素菜馆', power: 3000 },
  { id: 'r6', name: '醉仙居', icon: '🍶', style: '酒家', power: 4500 },
  { id: 'r7', name: '鼎香园', icon: '🫕', style: '火锅城', power: 6500 },
  { id: 'r8', name: '玉膳堂', icon: '🍲', style: '官府菜', power: 9000 },
  { id: 'r9', name: '云外楼', icon: '🥂', style: '景观餐厅', power: 12000 },
  { id: 'r10', name: '九味坊', icon: '🍛', style: '创意菜', power: 16000 },
  { id: 'r11', name: '天厨阁', icon: '👑', style: '米其林三星', power: 22000 },
  { id: 'r12', name: '无相斋', icon: '🌌', style: '意境料理', power: 30000 },
]

/** 稳定哈希（同输入同输出，跨端一致） */
export function hash32(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

/** 当前月份序号（epoch 月，30 天为一月；从 2026-01 起算） */
export function monthIndexOf(now = Date.now()) {
  const EPOCH = Date.UTC(2026, 0, 1)
  return Math.max(0, Math.floor((now - EPOCH) / (30 * 86400_000)))
}

/** 本月上场对手（轮换 5 家，分数按月份成长） */
export function rivalsOfMonth(monthIndex) {
  const n = RIVAL_SHOPS.length
  const out = []
  for (let i = 0; i < RIVAL_BOARD_SIZE - 1; i++) {
    const shop = RIVAL_SHOPS[(monthIndex * 3 + i * 2) % n]
    const base = shop.power * (1 + RIVAL_MONTH_GROWTH * monthIndex)
    // ±12% 抖动，让每月榜单有变化（确定性）
    const jitter = 0.88 + 0.24 * hash32(`${shop.id}:${monthIndex}`)
    out.push({ ...shop, score: Math.round(base * jitter) })
  }
  return out
}

/** 玩家本月综合分（全部来自既有数据：米其林分/菜单/装饰/分店/常客/订单/累计收入） */
export function playerScoreFrom(p, menuTiers, promo = false) {
  const michelin = p?.michelin?.score ?? 0
  const decor = (p?.restaurant?.decor ?? []).length
  const branches = Object.keys(p?.branches ?? {}).length
  const regulars = Object.values(p?.regulars ?? {}).reduce((a, r) => a + (r?.serves ?? 0), 0)
  const orders = p?.stats?.ordersServed ?? 0
  const income = Math.floor((p?.stats?.restaurantTotal ?? 0) / 5000)
  const raw = michelin * 1 + (menuTiers ?? 0) * 60 + decor * 20 + branches * 120 + regulars * 12 + orders * 2 + income
  return Math.round(raw * (1 + (promo ? RIVAL_PROMO_BONUS : 0) / 100))
}

/** 名次（1 最高）：玩家分与全部对手分比较 */
export function rankOf(playerScore, rivals) {
  return 1 + rivals.filter((r) => r.score > playerScore).length
}

/** 名次档位奖励（金币按玩家分缩放，保证随进度有意义） */
export function rivalReward(rank, playerScore) {
  const s = Math.max(0, playerScore ?? 0)
  if (rank === 1) return { rank, gold: Math.round(2000 + s * 0.5), items: { mysterySpice: 2 }, label: '榜一' }
  if (rank <= 3) return { rank, gold: Math.round(1000 + s * 0.3), items: { mysterySpice: 1 }, label: '前三' }
  return { rank, gold: Math.round(500 + s * 0.15), items: {}, label: '上榜' }
}

/** 名次对应的星标（1~3 星用于展示） */
export function rankStars(rank) {
  if (rank === 1) return 3
  if (rank <= 3) return 2
  return 1
}
