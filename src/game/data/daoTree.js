// 厨神之路 · 轮回天赋树（v2.0 新增）— 转生专属的长线追求。
//
// 设计口径（只读既有系统，不动固定数据层）：
//   · 货币「轮回印记」由**转生次数**派生（`stats.prestiges` 累计值 − 已投入），**不新增货币存档字段**；
//   · 四路（采撷 / 火工 / 厨武 / 经营）× 三层 × 各 3 节点 = 36 节点；层数有「本路已解锁数」门槛；
//   · 全部效果都是**功能层乘区**（产量/经验/伤害/收入/离线上限/种子掉落…），挂在既有聚合点上，
//     不改任何物品/配方/敌人/赛季等铁律数据；
//   · 唯一新增存档字段：`daoUnlocked: string[]`（已解锁节点 id，懒建、旧档零迁移）。
//
// 平衡口径：单路全解锁 18 印记、四路总计 72 印记。按「每次技能转生 +1 印记」计，
// 全部点满需要 72 次转生（20 技能各有 100 级转生 + 120 级重练）——属**毕业级**长线目标，
// 单路点满（18 次转生）在中期即可望见，保证「转生立刻有回报」。

/** 四条道途 */
export const DAO_PATHS = [
  { id: 'gather', name: '采撷之道', icon: '🌾', desc: '产量、熟练与山野机缘' },
  { id: 'craft', name: '火工之道', icon: '🍳', desc: '制作经验、全技能经验与金币' },
  { id: 'combat', name: '厨武之道', icon: '⚔️', desc: '伤害、品鉴值与暴击' },
  { id: 'business', name: '经营之道', icon: '🏮', desc: '餐厅收入、订单赏金与分店' },
]

/** 层数门槛：进入某层需要「本路已解锁节点数」≥ 该值 */
export const DAO_TIER_REQ = { 1: 0, 2: 2, 3: 5 }

/** 36 个节点：cost = 轮回印记；effect 键由 daoEffectSum 汇总后挂到各聚合点 */
export const DAO_NODES = [
  // ── 采撷之道 ──
  { id: 'g1', path: 'gather', tier: 1, name: '晨露之息', icon: '💧', cost: 1, effect: { yieldPct: 3 }, desc: '采集产量 +3%' },
  { id: 'g2', path: 'gather', tier: 1, name: '田垄熟路', icon: '🛤️', cost: 1, effect: { gatherXpPct: 4 }, desc: '采集类经验 +4%' },
  { id: 'g3', path: 'gather', tier: 1, name: '拾穗之手', icon: '🌾', cost: 1, effect: { seedChancePct: 2 }, desc: '采集掉落种子概率 +2%' },
  { id: 'g4', path: 'gather', tier: 2, name: '山野识途', icon: '🧭', cost: 2, effect: { yieldPct: 5 }, desc: '采集产量 +5%' },
  { id: 'g5', path: 'gather', tier: 2, name: '四时之律', icon: '🍃', cost: 2, effect: { gatherXpPct: 6 }, desc: '采集类经验 +6%' },
  { id: 'g6', path: 'gather', tier: 2, name: '守夜之灯', icon: '🏮', cost: 2, effect: { offlineHours: 2 }, desc: '离线收益时长上限 +2 小时' },
  { id: 'g7', path: 'gather', tier: 3, name: '山海同席', icon: '⛰️', cost: 3, effect: { yieldPct: 8 }, desc: '采集产量 +8%' },
  { id: 'g8', path: 'gather', tier: 3, name: '不辍之耕', icon: '🌱', cost: 3, effect: { gatherXpPct: 10 }, desc: '采集类经验 +10%' },
  { id: 'g9', path: 'gather', tier: 3, name: '万物有时', icon: '🕰️', cost: 3, effect: { offlineHours: 4, seedChancePct: 5 }, desc: '离线上限 +4 小时、种子概率 +5%' },

  // ── 火工之道 ──
  { id: 'c1', path: 'craft', tier: 1, name: '灶前定气', icon: '🔥', cost: 1, effect: { craftXpPct: 4 }, desc: '制作类经验 +4%' },
  { id: 'c2', path: 'craft', tier: 1, name: '寸铁之工', icon: '🔪', cost: 1, effect: { allXpPct: 2 }, desc: '全技能经验 +2%' },
  { id: 'c3', path: 'craft', tier: 1, name: '锱铢必较', icon: '🪙', cost: 1, effect: { goldPct: 2 }, desc: '获得金币 +2%' },
  { id: 'c4', path: 'craft', tier: 2, name: '五味调和', icon: '🧂', cost: 2, effect: { craftXpPct: 6 }, desc: '制作类经验 +6%' },
  { id: 'c5', path: 'craft', tier: 2, name: '融会贯通', icon: '📜', cost: 2, effect: { allXpPct: 3 }, desc: '全技能经验 +3%' },
  { id: 'c6', path: 'craft', tier: 2, name: '生财有道', icon: '💰', cost: 2, effect: { goldPct: 4 }, desc: '获得金币 +4%' },
  { id: 'c7', path: 'craft', tier: 3, name: '炉火纯青', icon: '🏵️', cost: 3, effect: { craftXpPct: 10 }, desc: '制作类经验 +10%' },
  { id: 'c8', path: 'craft', tier: 3, name: '一通百通', icon: '🌐', cost: 3, effect: { allXpPct: 5 }, desc: '全技能经验 +5%' },
  { id: 'c9', path: 'craft', tier: 3, name: '金玉满堂', icon: '🧧', cost: 3, effect: { goldPct: 6 }, desc: '获得金币 +6%' },

  // ── 厨武之道 ──
  { id: 'b1', path: 'combat', tier: 1, name: '刀锋直觉', icon: '🗡️', cost: 1, effect: { dmgPct: 3 }, desc: '对决伤害 +3%' },
  { id: 'b2', path: 'combat', tier: 1, name: '饱食之躯', icon: '🍚', cost: 1, effect: { maxHpPct: 3 }, desc: '最大品鉴值 +3%' },
  { id: 'b3', path: 'combat', tier: 1, name: '目无全牛', icon: '👁️', cost: 1, effect: { critPct: 2 }, desc: '暴击率 +2%' },
  { id: 'b4', path: 'combat', tier: 2, name: '厚味护体', icon: '🛡️', cost: 2, effect: { maxHpPct: 5 }, desc: '最大品鉴值 +5%' },
  { id: 'b5', path: 'combat', tier: 2, name: '寸劲发力', icon: '💥', cost: 2, effect: { dmgPct: 5 }, desc: '对决伤害 +5%' },
  { id: 'b6', path: 'combat', tier: 2, name: '见微知著', icon: '🔍', cost: 2, effect: { critPct: 3 }, desc: '暴击率 +3%' },
  { id: 'b7', path: 'combat', tier: 3, name: '刀过无声', icon: '⚡', cost: 3, effect: { dmgPct: 8 }, desc: '对决伤害 +8%' },
  { id: 'b8', path: 'combat', tier: 3, name: '食气养元', icon: '🌀', cost: 3, effect: { maxHpPct: 8 }, desc: '最大品鉴值 +8%' },
  { id: 'b9', path: 'combat', tier: 3, name: '一击入魂', icon: '🎯', cost: 3, effect: { critPct: 5 }, desc: '暴击率 +5%' },

  // ── 经营之道 ──
  { id: 'm1', path: 'business', tier: 1, name: '和气生财', icon: '🤝', cost: 1, effect: { incomePct: 4 }, desc: '餐厅收入 +4%' },
  { id: 'm2', path: 'business', tier: 1, name: '客似云来', icon: '🚶', cost: 1, effect: { orderGoldPct: 4 }, desc: '食客订单赏金 +4%' },
  { id: 'm3', path: 'business', tier: 1, name: '门面一新', icon: '🏮', cost: 1, effect: { branchPct: 4 }, desc: '分店收入 +4%' },
  { id: 'm4', path: 'business', tier: 2, name: '金字招牌', icon: '🪧', cost: 2, effect: { incomePct: 6 }, desc: '餐厅收入 +6%' },
  { id: 'm5', path: 'business', tier: 2, name: '宾至如归', icon: '🛎️', cost: 2, effect: { orderGoldPct: 6 }, desc: '食客订单赏金 +6%' },
  { id: 'm6', path: 'business', tier: 2, name: '连城之价', icon: '🏬', cost: 2, effect: { branchPct: 6 }, desc: '分店收入 +6%' },
  { id: 'm7', path: 'business', tier: 3, name: '天下知味', icon: '🌏', cost: 3, effect: { incomePct: 10 }, desc: '餐厅收入 +10%' },
  { id: 'm8', path: 'business', tier: 3, name: '一诺千金', icon: '📜', cost: 3, effect: { orderGoldPct: 10 }, desc: '食客订单赏金 +10%' },
  { id: 'm9', path: 'business', tier: 3, name: '四海通达', icon: '🛳️', cost: 3, effect: { branchPct: 10 }, desc: '分店收入 +10%' },
]

const DAO_INDEX = new Map(DAO_NODES.map((n) => [n.id, n]))

export function daoNode(id) {
  return DAO_INDEX.get(id) ?? null
}

/** 某条道途的节点（按层、按定义顺序） */
export function daoNodesOf(pathId) {
  return DAO_NODES.filter((n) => n.path === pathId).sort((a, b) => a.tier - b.tier)
}

/** 已解锁节点集合 → 效果合计 */
export function daoEffectSum(unlocked = []) {
  const eff = { yieldPct: 0, gatherXpPct: 0, craftXpPct: 0, allXpPct: 0, seedChancePct: 0, offlineHours: 0, dmgPct: 0, maxHpPct: 0, critPct: 0, incomePct: 0, orderGoldPct: 0, branchPct: 0, goldPct: 0 }
  for (const id of unlocked) {
    const def = DAO_INDEX.get(id)
    if (!def) continue
    for (const [k, v] of Object.entries(def.effect ?? {})) eff[k] = (eff[k] ?? 0) + v
  }
  return eff
}

/** 已投入的印记总数 */
export function daoSpent(unlocked = []) {
  let n = 0
  for (const id of unlocked) n += DAO_INDEX.get(id)?.cost ?? 0
  return n
}

/**
 * 能否解锁某节点：返回 { ok, reason }
 * 门槛：未解锁 + 本路已达该层「本路已解锁数」要求 + 印记够
 */
export function daoCanUnlock(id, unlocked = [], points = 0) {
  const def = DAO_INDEX.get(id)
  if (!def) return { ok: false, reason: '节点不存在' }
  if (unlocked.includes(id)) return { ok: false, reason: '已解锁' }
  const inPath = DAO_NODES.filter((n) => n.path === def.path && unlocked.includes(n.id)).length
  const need = DAO_TIER_REQ[def.tier] ?? 0
  if (inPath < need) return { ok: false, reason: `需本路已解锁 ${need} 个节点（当前 ${inPath}）` }
  if (points < def.cost) return { ok: false, reason: `需轮回印记 ${def.cost}（当前 ${points}）` }
  return { ok: true }
}

/** 单路总花费（用于展示"点满一条路要多少次转生"） */
export function daoPathCost(pathId) {
  return daoNodesOf(pathId).reduce((a, n) => a + n.cost, 0)
}
