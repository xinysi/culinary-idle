// 自动化中心（2026-09-10 新增）— 把已有自动化集中展示 + 三项可解锁自动化（金币解锁）。
// 设计约束：只读取/消耗既有物品与状态；自动出售按「价值阈值 + 采集食材」白名单，矿物/化石/材料/补给不参与。

/** 可解锁的自动化（金币一次性解锁） */
export const AUTOMATIONS = [
  {
    id: 'sell',
    name: '自动出售',
    icon: '💰',
    cost: 5000,
    desc: '每 15 秒自动出售背包中「价值 ≤ 阈值」的采集食材（每种保留 1 件），按售价 50% 结算金币',
  },
  {
    id: 'queue',
    name: '自动续队',
    icon: '🔁',
    cost: 8000,
    desc: '制作队列清空时，自动把「常驻配方」重新排 1 项（每个制作技能可各设一个）',
  },
  {
    id: 'claim',
    name: '自动领取',
    icon: '📥',
    cost: 12000,
    desc: '地窖成熟、远行采集队到期时自动领取（产出照常入包/入账）',
  },
]

const AUTOMATION_INDEX = new Map(AUTOMATIONS.map((a) => [a.id, a]))

export function getAutomation(id) {
  return AUTOMATION_INDEX.get(id) ?? null
}

/** 已有的免费自动化（仅展示，随设置面板开关） */
export const FREE_AUTOMATIONS = [
  { id: 'eat', name: '自动进食', icon: '🍽️', where: '设置面板', desc: '对决中血量低于阈值自动吃料理回血' },
  { id: 'farm', name: '自动收种', icon: '🌾', where: '设置面板', desc: '农耕成熟即收获并补种同种种子' },
  { id: 'supply', name: '弹药自动补给', icon: '🏹', where: '设置面板', desc: '陷阱/摆盘食材低于 50 自动买满到 200（保留金币下限）' },
  { id: 'plan', name: '挂机计划', icon: '🗓️', where: '技能页', desc: '按队列自动切换挂机目标，全部完成自动暂停' },
  { id: 'queue', name: '制作队列', icon: '📋', where: '制作页', desc: '排队自动连续制作，材料不足自动暂停' },
]

/** 自动出售：默认阈值与保留件数 */
export const SELL_THRESHOLD_DEFAULT = 30
export const SELL_KEEP = 1
/** 不参与自动出售的类别（矿物/化石/材料/补给——它们是锻造/宝石/肥料的原料） */
export const SELL_EXCLUDED_CATEGORIES = ['mineral', 'fossil', 'material', 'supply']
