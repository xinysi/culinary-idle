// 厨友（2026-09-11 新增）— 本地镜像的同行 NPC：每日可拜访一次拿点小礼物，并可接一份「帮厨委托」。
//
// 与竞技场/同业榜同路子：这是**纯单机**游戏，没有后端，所以「社交」做成**本地生成的镜像厨友**，
// 不联网、不假装有别的玩家。数值全部读既有物品的 value，**不新增物品、不改动任何固定数据**。
//
// 经济口径（刻意与既有系统对齐，避免另起一套）：
//   · 帮厨委托赏金 = 物品价值 × 数量 × (1.4~2.0)（对照「食客订单」的 ×(1.5~2.2)，略低一档）
//   · 拜访礼物金币 = 基础值 × (1 + 0.25 × 羁绊等级)（对照「吉祥物」的同一公式）
//   · 羁绊只放大**本系统自身**的奖励，不叠加到餐厅/采集/对决等既有乘区——不动已标定的节奏。

/** 羁绊等级门槛（按累计互动次数：拜访 + 委托都算） */
export const FRIEND_BOND_STEPS = [1, 5, 12, 25, 45]

export function friendBondLevel(n) {
  const v = Math.max(0, Math.floor(n ?? 0))
  let lv = 0
  for (const s of FRIEND_BOND_STEPS) if (v >= s) lv++
  return lv
}

export function friendBondProgress(n) {
  const v = Math.max(0, Math.floor(n ?? 0))
  const lv = friendBondLevel(v)
  if (lv >= FRIEND_BOND_STEPS.length) return { level: lv, current: v, needed: v, progress: 1 }
  const base = lv === 0 ? 0 : FRIEND_BOND_STEPS[lv - 1]
  const next = FRIEND_BOND_STEPS[lv]
  return { level: lv, current: v - base, needed: next - base, progress: Math.min(1, (v - base) / (next - base)) }
}

/**
 * 8 位镜像厨友。`pool` 是委托会点到的物品（全部为**现存**低阶食材，保证早期也交得起）；
 * `goldBase` 是每日拜访礼物的基数。
 */
export const FRIENDS = [
  {
    id: 'auntieWang', name: '巷口王婶', icon: '🥟', school: '家常菜', goldBase: 160,
    line: '“灶上炖着汤呢，你来得正好。”',
    pool: ['apple', 'cabbage', 'carrot', 'potato'],
  },
  {
    id: 'noodleBro', name: '面摊小哥', icon: '🍜', school: '面点', goldBase: 180,
    line: '“今天的面醒得刚刚好。”',
    pool: ['wheat', 'flour', 'onion', 'cabbage'],
  },
  {
    id: 'riverUncle', name: '河鲜老刘', icon: '🎣', school: '河鲜', goldBase: 210,
    line: '“早市刚上来的，你看这鳃。”',
    pool: ['crucian', 'crab', 'rice', 'ginger'],
  },
  {
    id: 'missSweet', name: '甜品阿糖', icon: '🍰', school: '甜点', goldBase: 240,
    line: '“糖度要不要再减一点？”',
    pool: ['strawberry', 'grape', 'milk', 'flour'],
  },
  {
    id: 'spiceHu', name: '香料胡叔', icon: '🌶️', school: '调味', goldBase: 260,
    line: '“火候不到，香料就白瞎了。”',
    pool: ['chili', 'garlic', 'ginger', 'soySauce'],
  },
  {
    id: 'grillZhao', name: '烧烤赵哥', icon: '🍢', school: '炙烤', goldBase: 280,
    line: '“炭我烧热了，就等你的料。”',
    pool: ['corn', 'onion', 'tomato', 'mushroom'],
  },
  {
    id: 'veggieLin', name: '蔬食小林', icon: '🥬', school: '蔬食', goldBase: 230,
    line: '“时令的，错过要等一年。”',
    pool: ['tomato', 'cabbage', 'mushroom', 'carrot'],
  },
  {
    id: 'oldChefSun', name: '退役孙师傅', icon: '👨‍🍳', school: '宴席', goldBase: 320,
    line: '“刀要稳，心要静。”',
    pool: ['ironOre', 'saltOre', 'rice', 'grape'],
  },
]

const FRIEND_INDEX = new Map(FRIENDS.map((f) => [f.id, f]))

export function getFriend(id) {
  return FRIEND_INDEX.get(id) ?? null
}

/** 拜访礼物：金币随羁绊等级上浮（与吉祥物同公式） */
export function friendVisitReward(def, bondCount) {
  const lv = friendBondLevel(bondCount)
  return { gold: Math.round((def?.goldBase ?? 0) * (1 + 0.25 * lv)) }
}

/**
 * 生成一份帮厨委托：从该厨友的池子里挑一样（优先背包里已有的，避免玩家交不起）。
 * 赏金口径对照「食客订单」，略低一档。
 * @param {object} def 厨友定义
 * @param {Record<string, number>} inventory 玩家背包
 * @param {number} bondCount 该厨友的累计互动次数（放大赏金）
 * @param {number} itemValueOf (itemId) => number
 * @param {() => number} rng
 */
export function makeFriendOrder(def, inventory, bondCount, itemValueOf, rng = Math.random) {
  const pool = def?.pool ?? []
  if (!pool.length) return null
  const stock = pool.filter((id) => (inventory?.[id] ?? 0) > 0)
  const itemId = (stock.length && rng() < 0.7)
    ? stock[Math.floor(rng() * stock.length)]
    : pool[Math.floor(rng() * pool.length)]
  const qty = 1 + (rng() < 0.35 ? 1 : 0) + (rng() < 0.15 ? 1 : 0)
  const value = itemValueOf(itemId) ?? 0
  const bondLv = friendBondLevel(bondCount)
  const reward = Math.max(20, Math.round(value * qty * (1.4 + rng() * 0.6) * (1 + 0.15 * bondLv)))
  return { itemId, qty, reward }
}
