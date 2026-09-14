// 菌房（2026-09-14 新增）— 「挂机产线」第 7 个系统：**给「肥料」开第二个出口**。
//
// 为什么是肥料：堆肥 / 肥沃堆肥目前只有「施在农耕地块上」一个用途，且施肥是
// 「同种/降级拒绝、更好的可覆盖升级」的语义（FarmingSkill.fertilize），消耗量很有限；
// 杂货铺能买、保鲜技能也能产，于是这条链的下游一直是空的。
//
// 与牧场的分工（结构同构、饲料不同）：
//   · 牧场 = 买动物占栏位，吃**作物饲料**，产蛋/奶/肉；（篱内养殖）
//   · 菌房 = 建菇床占格位，吃**肥料**（堆肥/肥沃堆肥），产菌菇；独立解锁、不看农耕等级。
//
// 设计约束：不新增物品；培养基与产物全是既有物品（蘑菇 / 松茸 / 茯苓），数值按
// 「产物价值 / 肥料成本」对照牧场标定（野鸡 4h 吃玉米×3 → 蛋×2 + 肉×1）。
// 「产物价值 / 肥料成本」对照牧场标定（野鸡 4h 吃玉米×3 → 蛋×2 + 肉×1）。
import { getItem } from './items.js'
export const MUSHROOM_UNLOCK_SKILL = 'foraging'
export const MUSHROOM_UNLOCK_LEVEL = 12

export const MUSHROOM_BASE_BEDS = 1
export const MUSHROOM_MAX_BEDS = 3
export const MUSHROOM_EXPAND_COSTS = [15000, 45000]

/**
 * 培养基：与牧场 RANCH_ANIMALS 同构（hours / feed / products），由 _tickMushroom() 逐周期结算。
 *  · 堆肥（价值 6 / 店内 15 金）：6 小时 → 蘑菇 ×2（价值 48）
 *  · 肥沃堆肥（价值 25 / 店内 60 金）：4 小时 → 蘑菇 ×3 + 松茸 ×1（价值 72 + 140）
 * 高阶菌（木耳 Lv71 / 银耳 Lv75）**刻意不放进来**：它们是采摘高阶产物，放进来会变成
 * 「60 金肥料换 230 价值」的越级产出（对照牧场最高档也只有 30 价值的牛奶）。
 */
export const MUSHROOM_MEDIA = [  // cost = 铺床一次性金币（与牧场买动物同构）
  {
    id: 'compost',
    name: '堆肥菇床',
    icon: '🍄',
    cost: 5000,
    hours: 6,
    feed: { compost: 1 },
    products: { mushroom: 2, excavation_ext_12: 1 },
    desc: '普通堆肥培育，出普通食用菌',
  },
  {
    id: 'richCompost',
    name: '沃肥菇床',
    icon: '🌰',
    cost: 18000,
    hours: 4,
    feed: { richCompost: 1 },
    products: { mushroom: 3, matsutake: 1, lingzhi: 1 },
    desc: '肥沃堆肥培育，周期更短并伴生松茸与灵芝',
  },
]

const MEDIA_INDEX = new Map(MUSHROOM_MEDIA.map((m) => [m.id, m]))

export function getMushroomMedia(id) {
  return MEDIA_INDEX.get(id) ?? null
}

/** 产物文案（UI 复用） */
export function mushroomProductText(def) {
  return Object.entries(def?.products ?? {})
    .map(([id, q]) => `${getItem(id)?.name ?? id}×${q}`)
    .join(' + ')
}

/** 扩建费用（beds 为当前格数；已满返回 null） */
export function nextMushroomExpandCost(beds) {
  return MUSHROOM_EXPAND_COSTS[beds - MUSHROOM_BASE_BEDS] ?? null
}
