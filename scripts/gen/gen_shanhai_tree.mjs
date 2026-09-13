// 生成「山海食经」收集科技树 → src/game/data/shanhaiTree.js（勿手改，改后重跑本脚本）
//
// 口径（用户 2026-09-13 拍板 + 同日追加）：
//   · 10 条收集线 × 10 环 × 3 节点 = 300 节点；**纯条件点亮**（不消耗任何资源）
//   · 前 6 环：收集件数 + 技能等级；后 4 环（大后期轴）：**技能满 100 级 / 转生 1 / 5 / 10 次**
//   · 条件只用**已持久化**的玩家状态：该线可收集物品的「已收集件数」+ 该技能等级 + 该技能转生次数
//   · 奖励只用**固定数值**（背包/仓库/冷库格数、离线上限小时、采集每次 +1 件），无任何百分比
// ⚠️ 转生环**不得要求「当前等级 ≥ 100」**：转生会把等级重置为 1+传承（≤20），
//    所以里程碑环只写 `prestige`，等级要求归 0（守卫会拦「转生环又写等级 100」这种写不通的条件）。
//
// 可收集清单与等级取自**真实技能实例**（targets / recipes / CROPS，与游戏同一份数据），
// 因此物品被增删时重跑本脚本即可同步；阈值按各线物品数**按比例**取，保证每条线都可达。
//
// 安全：支持 GEN_OUT_DIR；算出 0 个节点时**直接报错中止、不写文件**（防止静默清空产物）。
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getSkillInstance } from '../../src/game/skills/registry.js'
import { CROPS } from '../../src/game/skills/FarmingSkill.js' // 农耕的作物表是模块级常量（不在实例上）

const __OUT_DIR = process.env.GEN_OUT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '../../src/game/data')
const OUT = join(__OUT_DIR, 'shanhaiTree.js')

/** 10 条收集线：技能 id → 展示信息 + 最高环的额外奖励 */
const PATHS = [
  { id: 'pick', skill: 'foraging', name: '采撷', icon: '🌾', pool: ['🌱', '🍃', '🌿', '🍀', '🌾', '🌳', '🍄', '🌰', '🪴', '🌲'], gather: true },
  { id: 'fish', skill: 'fishing', name: '渔获', icon: '🎣', pool: ['🐟', '🐠', '🦐', '🦀', '🐙', '🐋', '🦑', '🐚', '🦞', '🐳'], gather: true },
  { id: 'hunt', skill: 'hunting', name: '山猎', icon: '🏹', pool: ['🐇', '🦌', '🐗', '🐻', '🦅', '🐉', '🦊', '🐺', '🦉', '🦬'], gather: true },
  { id: 'dig', skill: 'excavation', name: '掘藏', icon: '⛏️', pool: ['🪨', '🔶', '💎', '🪙', '🔷', '🏆', '🧱', '⛰️', '🗿', '👑'], gather: true },
  { id: 'farm', skill: 'farming', name: '稼穑', icon: '🚜', pool: ['🌰', '🥬', '🎃', '🍉', '🌻', '🍇', '🍅', '🥕', '🌽', '🍒'], gather: true },
  { id: 'cook', skill: 'cooking', name: '烹煮', icon: '🍳', pool: ['🍚', '🍜', '🍲', '🥘', '🍱', '🍽️', '🍛', '🥟', '🍢', '🥗'], gather: false },
  { id: 'bake', skill: 'baking', name: '烘焙', icon: '🥖', pool: ['🍞', '🥐', '🥨', '🧁', '🎂', '🥮', '🥯', '🍰', '🧇', '🥞'], gather: false },
  { id: 'brew', skill: 'brewing', name: '酿造', icon: '🍶', pool: ['🍵', '🧃', '🍺', '🍷', '🥂', '🍾', '🍹', '🥤', '🧉', '🍸'], gather: false },
  { id: 'spice', skill: 'spiceMixing', name: '调味', icon: '🧂', pool: ['🧄', '🌶️', '🫚', '🥄', '🫙', '⚗️', '🧊', '🫒', '🥜', '🍋'], gather: false },
  { id: 'smith', skill: 'craftsmithing', name: '锻造', icon: '🔨', pool: ['🔧', '🔩', '⚒️', '🛠️', '⚙️', '🗡️', '🪛', '🔪', '🗜️', '🪚'], gather: false },
]

/** 环名与门槛比例（收集件数按该线物品总数取比例；技能等级为绝对值） */
const RINGS = [
  { ring: 1, name: '初识', pct: 0.06, level: 0 },
  { ring: 2, name: '渐熟', pct: 0.15, level: 0 },
  { ring: 3, name: '通晓', pct: 0.30, level: 0 },
  { ring: 4, name: '精研', pct: 0.50, level: 20 },
  { ring: 5, name: '大成', pct: 0.70, level: 45 },
  { ring: 6, name: '化境', pct: 0.90, level: 75 },
  // ── 大后期四档（2026-09-13 用户追加）：满级 100 → 转生 1 / 5 / 10 ──
  //   收集门槛沿用第 6 环的 90%（这条线基本收齐），真正的门槛是等级/转生；
  //   转生环**只写 prestige、不写 level**（转生后等级会归 1+传承 ≤20，写 100 会永远够不着）。
  { ring: 7, name: '圆满', pct: 0.90, level: 100 },
  { ring: 8, name: '轮回', pct: 0.90, level: 0, prestige: 1 },
  { ring: 9, name: '历劫', pct: 0.90, level: 0, prestige: 5 },
  { ring: 10, name: '悟道', pct: 0.90, level: 0, prestige: 10 },
]
/** 节点的后缀（按槽位取；前 5 环 3 个，第 6 环起 5 个） */
const SUFFIX = ['录', '谱', '典', '章', '卷']
/**
 * 每环的**节点个数**（用户 2026-09-13 二次反馈：第 6 圈起显得空 → 每环 5 个）。
 * 前 5 环保持 3（收集曲线，节点少而明确）；第 6~10 环（含大后期四档）各 5 个。
 * 角度预算够用：扇区 24° 内铺 5 个 → 步长 6°，第 6 环弦距 = 2·1100·sin3° ≈ 115px（节点直径 ~62px）。
 */
const RING_SLOTS = [3, 3, 3, 3, 3, 5, 5, 5, 5, 5]

/**
 * 平级排序的比较器：**按码位比较，绝不用 `localeCompare`**。
 * ⚠️ 2026-09-13 实测踩坑：`localeCompare` 的结果**依赖运行环境的 locale/ICU**——
 * `'smith_寒铁_legs'.localeCompare('smith_ext2_05')` 在本地（zh-CN）是 −1、按码位却是 +1，
 * 于是同一份数据在本地生成与在 CI（不同 locale）生成会挑中**不同的物品**，`gen_drift_audit` 直接 FAIL（v2.1.0 的 CI 就是这么红的）。
 * 生成器里任何「同键排序」都必须用这个，保证产物**跨环境可复现**。
 */
const cmpId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * 该技能可收集的物品 `[{ id, level }]`（农耕=CROPS 常量、采集=实例 targets、制作=实例 recipes 产物）。
 * `level` 用于**按深度挑图标物品**（环越外 → 该线越珍稀的物品图），所以这里保留等级。
 */
function collectiblesOf(skillId) {
  if (skillId === 'farming') return CROPS.map((c) => ({ id: c.itemId, level: c.reqLevel ?? 1 })).filter((x) => x.id)
  const inst = getSkillInstance(skillId)
  if (!inst) return []
  if (Array.isArray(inst.targets)) return inst.targets.map((t) => ({ id: t.itemId, level: t.reqLevel ?? 1 })).filter((x) => x.id)
  if (Array.isArray(inst.recipes)) return inst.recipes.map((r) => ({ id: r.output?.itemId, level: r.reqLevel ?? 1 })).filter((x) => x.id)
  return []
}

/**
 * 每个节点的**图标物品**（用户 2026-09-13：「emoji 也不好看，不如换成对应技能物品图片里选」）。
 * 规则：把该线的可收集物品按等级升序排好，第 r 环取「该环进度分位」附近的物品——
 * 于是**越深的环展示越珍稀的物品图**（内圈是苹果/小麦这类起步食材，外圈是灵果/名菜），
 * 本身就是一条「收集进度」的视觉线索。同环多槽位在分位附近小幅错开，取不到不同物品时允许重复。
 */
const RING_ICON_PCT = [0.04, 0.12, 0.24, 0.36, 0.48, 0.60, 0.70, 0.79, 0.88, 0.96]
function iconItemOf(sorted, ring, slot, slots) {
  if (!sorted.length) return null
  const base = RING_ICON_PCT[ring - 1] ?? 0.9
  const off = (slot - (slots - 1) / 2) * 0.015 // 同环内小幅错开，避免一圈全是同一张图
  const i = Math.round(Math.min(0.999, Math.max(0, base + off)) * (sorted.length - 1))
  return sorted[i].id
}

/**
 * 每环每个节点的奖励（**固定数值，零百分比**）：容量铺底，特殊奖励只给「读得到它」的线。
 * ⚠️ `flatYield` 只有**采集类**（path.gather：采摘/垂钓/狩猎/挖掘/农耕）读得到——它由
 *    `GatheringSkill.yieldBatch()` 与 `FarmingSkill.harvest` 消费；制作类技能没有「每次动作产出件数」，
 *    给它们发 flatYield 就是**发了个读不到的奖励**（历史上第 6 环就是这么处理的 → 制作线改发大额仓库）。
 * ⚠️ `offlineH` 全树只有 6 个名额（`OFFLINE_CAP.shanhaiMaxHours`）：第 6 环 5 条采集线各 1 个（=5），
 *    最后 1 个放在**采撷线的终点**（`pick{10}3`），其余线该槽位发冷库。
 * 前 5 环：背包 +1（1~2 环）/ 仓库 +1（3~5 环）。
 * 第 6~10 环：5 个槽位 = 容量按深度递增 + 特殊奖励。
 */
const RING6_PLUS = {
  6: ['special0', 'special1', 'cold1', 'bank2', 'bag1'],
  7: ['bag2', 'special1', 'cold1', 'bank2', 'bag1'],
  8: ['bag2', 'bank3', 'cold1', 'bank2', 'bag1'],
  9: ['bag3', 'bank4', 'cold1', 'bank3', 'bag2'],
  10: ['bag3', 'bank5', 'lastOffline', 'bank3', 'bag2'],
}
/**
 * 「汇金」链的数额（相邻两分支之间的金币节点，按环递进；用户授权由我定数值）。
 * 标定依据（均为既有数据）：分店 50k→6M（御街总铺 6M / 时收 90k）、名厨挑战单场 ≈12k、
 * 成就头部 10k~260k。故取「第 6 环 6k → 第 10 环 300k」，全树金币合计 ≈ 4.9M
 * ≈ 一座城南分店(400k)的量级×12，对「10 条线全部转生 10 次」这种毕业级投入是合理回报，也不会冲垮经济。
 */
const GOLD_BY_RING = { 6: 6000, 7: 18000, 8: 48000, 9: 120000, 10: 300000 }
/** 汇金链所在环（第 6~10 环） */
const GOLD_RINGS = [6, 7, 8, 9, 10]
function effectOf(path, ring, slot) {
  if (ring <= 2) return { field: 'inventoryCap', amount: 1, desc: '背包格数 +1' }
  if (ring <= 5) return { field: 'bankCap', amount: 1, desc: '仓库格数 +1' }
  const kind = RING6_PLUS[ring][slot]
  switch (kind) {
    // 第 6 环主槽：采集线给离线上限（用掉 5 个名额），制作线改大额仓库
    case 'special0':
      return path.gather
        ? { field: 'offlineH', amount: 1, desc: '离线收益时长上限 +1 小时' }
        : { field: 'bankCap', amount: 4, desc: '仓库格数 +4' }
    // 第 6/7 环次槽：采集线把「每次动作 +1 件」补到每技能封顶 2；制作线读不到 → 发仓库
    case 'special1':
      return path.gather
        ? { field: 'flatYield', amount: 1, desc: `${path.name}每次动作额外 +1 件` }
        : { field: 'bankCap', amount: 4, desc: '仓库格数 +4' }
    // 第 10 环中间槽：**采撷线终点**承载全树最后 1 小时离线上限，其余线发冷库 +2
    case 'lastOffline':
      return path.id === 'pick'
        ? { field: 'offlineH', amount: 1, desc: '离线收益时长上限 +1 小时（全树最后一小时）' }
        : { field: 'coldStorageCap', amount: 2, desc: '冷库格数 +2' }
    case 'cold1': return { field: 'coldStorageCap', amount: 1, desc: '冷库格数 +1' }
    case 'bag1': return { field: 'inventoryCap', amount: 1, desc: '背包格数 +1' }
    case 'bag2': return { field: 'inventoryCap', amount: 2, desc: '背包格数 +2' }
    case 'bag3': return { field: 'inventoryCap', amount: 3, desc: '背包格数 +3' }
    case 'bank2': return { field: 'bankCap', amount: 2, desc: '仓库格数 +2' }
    case 'bank3': return { field: 'bankCap', amount: 3, desc: '仓库格数 +3' }
    case 'bank4': return { field: 'bankCap', amount: 4, desc: '仓库格数 +4' }
    case 'bank5': return { field: 'bankCap', amount: 5, desc: '仓库格数 +5' }
    default: throw new Error(`未知的槽位奖励类型：${kind}`)
  }
}

/**
 * 「汇金」链（2026-09-13 用户追加，第二版口径）：**相邻两条收集线之间的空隙**里，
 * 从第 6 环起每环一个金币节点 → 10 个空隙 × 5 环 = **50 个金币节点**。
 * 位置上：各分支的节点铺在扇区中心 ±12° 内，两条分支之间留出的 12° 空隙原先全空，
 * 这 50 个节点就沿**空隙射线**（= 两扇区中心角的中线）由内向外排成一条链（用户截图里圈的正是这条线）。
 * 条件上：一个空隙节点同时属于两条线，故取**成对门槛**——
 * `req.skill2` 存在时：`count` = 两条线各自门槛之和（= 两线合计收集件数），
 * 等级与转生取**两条线的较低者**（即「两条线都得到」）。
 */
const GAPS = PATHS.map((p, i) => {
  const q = PATHS[(i + 1) % PATHS.length]
  return { id: `gap${i}`, a: p, b: q, name: `${p.name}·${q.name}`, index: i }
})

/**
 * 外圈「珍券环」（2026-09-13 用户追加，与厨神之路外环同款）：**环绕整棵树一整圈**的 10 个节点
 * （每 36°、对准 10 条线的射线、半径在第 10 环之外），**每个奖励觅珍抽卡券 ×100**。
 * 条件：**已点亮节点数**（不含珍券环自身）——45/90/…/450，最深一个要求把 450 个分支+汇金节点全点亮。
 */
const TICKET_RING = { r: 1980, nodes: 10, name: '珍券环' }
const TICKET_GATES = PATHS.map((_, i) => 45 * (i + 1)) // 45 → 450

// ── 生成 ──
setActivePinia(createPinia())
const player = usePlayerStore()
player.newGame()
createSkillInstances(player)

const nodes = []
const pathMeta = []
for (const path of PATHS) {
  const items = collectiblesOf(path.skill)
  if (items.length < 12) throw new Error(`收集线「${path.name}」的可收集物品只有 ${items.length} 个，不足以铺 10 环节点`)
  const sortedByLevel = [...items].sort((a, b) => a.level - b.level || cmpId(a, b))
  for (const R of RINGS) {
    const need = Math.max(3, Math.ceil(items.length * R.pct))
    const slots = RING_SLOTS[R.ring - 1]
    for (let slot = 0; slot < slots; slot++) {
      const eff = effectOf(path, R.ring, slot)
      // 里程碑环：转生环只写 prestige（转生后等级重置为 1+传承，写 level 100 永远够不着）
      const req = { kind: 'codex', skill: path.skill, count: need, level: R.level }
      if (R.prestige) req.prestige = R.prestige
      const gate = [R.prestige ? `${path.name}技能转生 ${R.prestige} 次` : '', R.level ? `${path.name}技能达 ${R.level} 级` : '']
        .filter(Boolean)
        .join('、')
      nodes.push({
        id: `${path.id}${R.ring}${slot + 1}`,
        path: path.id,
        ring: R.ring,
        name: `${path.name}·${R.name}${SUFFIX[slot]}`,
        icon: path.pool[R.ring - 1], // emoji 兜底（画布优先用 iconItem 的物品图）
        iconItem: iconItemOf(sortedByLevel, R.ring, slot, slots),
        req,
        effect: { field: eff.field, amount: eff.amount },
        desc: `${path.name}线收集 ${need} 件${gate ? `、${gate}` : ''} → ${eff.desc}`,
      })
    }
  }
  pathMeta.push({ id: path.id, skill: path.skill, name: path.name, icon: path.icon, desc: `${items.length} 件可收集`, total: items.length })
}

// ── 汇金链（空隙里的金币节点）──
const gapMeta = []
const sortCache = new Map()
for (const g of GAPS) {
  const la = sortCache.get(g.a.id) ?? [...collectiblesOf(g.a.skill)].sort((x, y) => x.level - y.level || cmpId(x, y))
  const lb = sortCache.get(g.b.id) ?? [...collectiblesOf(g.b.skill)].sort((x, y) => x.level - y.level || cmpId(x, y))
  sortCache.set(g.a.id, la)
  sortCache.set(g.b.id, lb)
  const need = (list) => Math.max(3, Math.ceil(list.length * 0.90)) // 第 6 环起各环统一 90%（与分支环一致）
  const count = need(la) + need(lb)
  GOLD_RINGS.forEach((ring, gi) => {
    const R = RINGS[ring - 1]
    const gate = [R.prestige ? `两条线技能均转生 ${R.prestige} 次` : '', R.level ? `两条线技能均达 ${R.level} 级` : ''].filter(Boolean).join('、')
    const amount = GOLD_BY_RING[ring]
    nodes.push({
      id: `${g.id}_${ring}`,
      path: g.id,
      ring,
      gap: g.index,
      name: `${g.name}·汇金${R.name}`,
      // 汇金节点用 🪙 金币图标（**只有一个字形**，位图精灵只光栅化一次；且「金币节点」语义最清楚）；
      // 分支节点才用物品图。想换成物品图的话，给它一个 iconItem 即可（画布两者都支持）。
      icon: '🪙',
      iconItem: null,
      req: { kind: 'codex', skill: g.a.skill, skill2: g.b.skill, count, level: R.level, ...(R.prestige ? { prestige: R.prestige } : {}) },
      effect: { field: 'gold', amount },
      desc: `${g.a.name}线与${g.b.name}线合计收集 ${count} 件${gate ? `、${gate}` : ''} → 金币 +${amount.toLocaleString('en-US')}`,
    })
  })
  gapMeta.push({ id: g.id, a: g.a.id, b: g.b.id, aName: g.a.name, bName: g.b.name, aSkill: g.a.skill, bSkill: g.b.skill, name: g.name, index: g.index })
}

// ── 外圈「珍券环」（环绕整圈的抽卡券节点）──
PATHS.forEach((path, i) => {
  nodes.push({
    id: `tk${i + 1}`,
    path: 'ticket',
    ring: 11,
    ticket: true,
    group: TICKET_RING.name,
    name: `${path.name}·珍券`,
    icon: '🎟️',
    iconItem: null,
    req: { kind: 'progress', nodes: TICKET_GATES[i] },
    reward: { tickets: 100 },
    desc: `已点亮 ${TICKET_GATES[i]} 个节点 → 觅珍抽卡券 ×100（抽卡时优先抵扣金币）`,
  })
})

if (!nodes.length) {
  console.error('❌ 山海食经生成结果为 0 个节点，已中止且未写文件。')
  process.exit(1)
}

const stamp = new Date().toISOString().slice(0, 10)
const out = `// 山海食经 · 收集科技树（生成器 scripts/gen/gen_shanhai_tree.mjs 产出，${stamp}，勿手改）
//
// 口径：10 条收集线 × 10 环（前 5 环各 3 节点、第 6~10 环各 5 节点）= ${nodes.length} 节点；**纯条件点亮**（不消耗资源）。
// 条件只用已持久化的玩家状态：该线可收集物品的已收集件数 + 该技能等级 + 该技能转生次数（req.kind 恒为 'codex'）。
// 前 6 环＝收集/等级曲线；第 7~10 环＝大后期里程碑（技能 100 级 / 转生 1 / 5 / 10 次）。
// 奖励只用固定数值：inventoryCap / bankCap / coldStorageCap / offlineH / flatYield / gold（无任何百分比）。
// 第 6~10 环**正中间**那个节点 = 金币节点（数额见 GOLD_BY_RING）。
// 节点图标：iconItem（该线该深度位置的物品 id，画布用 public/images/items 的物品图渲染；icon 为 emoji 兜底）。
// 阈值为**按该线物品总数取比例**（${RINGS.map((r) => r.pct).join(' / ')}），物品增删后重跑本脚本即可同步。

export const SHANHAI_PATHS = ${JSON.stringify(pathMeta, null, 2)}

/** 每环的展示名与门槛（文案用；数值门槛已写进各节点 req） */
export const SHANHAI_RINGS = ${JSON.stringify(RINGS.map((r) => ({ ring: r.ring, name: r.name, level: r.level, prestige: r.prestige ?? 0 })), null, 2)}

export const SHANHAI_NODES = ${JSON.stringify(nodes, null, 2)}

/** 外圈「珍券环」的几何与门槛（画布布局与守卫用） */
export const SHANHAI_TICKET_RING = ${JSON.stringify({ ...TICKET_RING, gates: TICKET_GATES })}

/** 汇金链（空隙里的金币节点分组）：{ id, a, b, aName, bName, aSkill, bSkill, name, index } */
export const SHANHAI_GAPS = ${JSON.stringify(gapMeta, null, 2)}

/** 每环的节点个数（画布布局与守卫用；**只统计分支节点**，不含汇金链） */

export const SHANHAI_RING_SLOTS = ${JSON.stringify(RING_SLOTS)}

/** 每系 10 环（画布布局用） */
export const SHANHAI_RING_COUNT = ${RINGS.length}
/** 最高环（第 10 环「悟道」） */
export const SHANHAI_MAIN_RING = ${RINGS.length}
`

mkdirSync(__OUT_DIR, { recursive: true })
writeFileSync(OUT, out)
console.log(`✅ 已生成 ${nodes.length} 个节点 → ${OUT}`)
console.log(`   10 条线：${pathMeta.map((p) => `${p.name}(${p.total})`).join(' · ')}`)
