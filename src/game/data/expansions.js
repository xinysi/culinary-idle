// 扩建与升级总表（2026-09-15 新增，v2.4.2）— **所有「花金币扩张/升级」的唯一登记处**。
//
// 起因（用户 2026-09-15）：「农耕这种升级还有功能的扩建等等要不要统一移到商店的容量扩展分类去」。
// 决策：**不把各页按钮搬走**（牧场栏位/温室格/菇床这些扩建与「你在这页干什么」强耦合，搬走要来回跳页），
// 而是抽出这张注册表：
//   · 商店「容量扩展」页签改为**总览面板**，把这 16 项全部列出（分组：存储容量 / 挂机产线设施 / 农耕 / 便利解锁），
//     每项显示「当前值 / 上限 / 下一档价格」，可直接购买，也可一键跳到对应页面；
//   · 各产线页面**保留自己的扩建按钮**（同一批 store 动作，两处入口等价）；
//   · 新增任何「花金币扩张/升级」的东西，**在这张表里登记一行**即可（守卫会静态比对 store 里的
//     `*Expand/upgrade*/automationUnlock` 动作是否都被登记，漏登记即 FAIL）。
//
// ⚠️ **契约：`apply(p)` 全权处理**——自己判断上限、自己扣金币、自己调用 store 动作，返回 `{ ok, msg? }`。
//    别把它写成「调用方扣费」：`expandInventory/expandBank` 是纯动作（不扣费），而 `expandColdStorage`
//    与各产线 `*Expand` 都**内部扣费**，混着用一定会重复扣费或白拿。
//
// 约束：本表只做「登记 + 调用既有动作」，不复制价格/上限——**数值一律从各自数据模块取**（单一来源）。
import { PAID_CAP_MAX, COLD_EXPAND_COST } from './caps.js'
import { RANCH_MAX_PENS, POND_MAX, nextRanchExpandCost, nextPondExpandCost } from './ranch.js'
import { nextCellarExpandCost } from './cellar.js'
import { MUSHROOM_MAX_BEDS, nextMushroomExpandCost } from './mushroomHouse.js'
import { SPIRIT_MAX_PLOTS, nextSpiritExpandCost } from './spiritField.js'
import { ESSENCE_MAX_VATS, nextEssenceExpandCost } from './essences.js'
import { CARAVAN_MAX_SLOTS, nextCaravanExpandCost } from './caravan.js'
import { GREENHOUSE_MAX_BEDS, HIVE_MAX_COUNT, nextGreenhouseExpandCost, nextHiveExpandCost } from './greenhouse.js'
import { TOOL_MAX_LEVEL, nextToolCost, TOOL_TIME_PER_LEVEL } from './farmTools.js'
import { AUTOMATIONS } from './automation.js'

/** 分组（商店面板按此顺序渲染） */
export const EXPANSION_GROUPS = [
  { id: 'storage', name: '存储容量', icon: '🎒' },
  { id: 'idle', name: '挂机产线设施', icon: '🏭' },
  { id: 'farm', name: '农耕', icon: '🌾' },
  { id: 'convenience', name: '便利解锁', icon: '🤖' },
]

/**
 * 登记表。每项：{ id, group, name, icon, view, unit, current(p), max, price(p), apply(p), desc }
 * · `current/max` 用于显示「2 / 4」；`price(p)` 返回下一档价格（满级返回 null）
 * · `apply(p)` 调用既有 store 动作；返回值沿用各动作的 { ok, msg }
 */
export const EXPANSIONS = [
  // ── 存储容量（原有三项，价格与上限取自 caps.js）──
  {
    id: 'inventorySlot', group: 'storage', name: '背包扩容', icon: '🎒', view: 'shop', unit: '格',
    desc: `背包 +10 格（金币可买到 ${PAID_CAP_MAX.inventory} 格；山海食经还能再往上加）`,
    current: (p) => p.inventoryCap, max: PAID_CAP_MAX.inventory,
    price: () => 200,
    apply: (p) => {
      if (p.inventoryCap >= PAID_CAP_MAX.inventory) return { ok: false, msg: `背包已达商店上限 ${PAID_CAP_MAX.inventory} 格（可用山海食经继续扩容）` }
      if (p.gold < 200) return { ok: false, msg: '金币不足（需 200）' }
      p.spendGold(200)
      p.expandInventory(10)
      return { ok: true, msg: `背包容量 +10（当前 ${p.inventoryCap} 格）` }
    },
  },
  {
    id: 'bankSlot', group: 'storage', name: '仓库扩容', icon: '📦', view: 'shop', unit: '格',
    desc: `仓库 +20 格（金币可买到 ${PAID_CAP_MAX.bank} 格；山海食经还能再往上加）`,
    current: (p) => p.bankCap, max: PAID_CAP_MAX.bank,
    price: () => 150,
    apply: (p) => {
      if (p.bankCap >= PAID_CAP_MAX.bank) return { ok: false, msg: `仓库已达商店上限 ${PAID_CAP_MAX.bank} 格（可用山海食经继续扩容）` }
      if (p.gold < 150) return { ok: false, msg: '金币不足（需 150）' }
      p.spendGold(150)
      p.expandBank(20)
      return { ok: true, msg: `仓库容量 +20（当前 ${p.bankCap} 格）` }
    },
  },
  {
    id: 'coldSlot', group: 'storage', name: '冷库扩容', icon: '🧊', view: 'shop', unit: '格',
    desc: `冷库 +1 格（减缓腐坏；金币可买到 ${PAID_CAP_MAX.cold} 格；山海食经还能再往上加）`,
    current: (p) => p.coldStorageCap, max: PAID_CAP_MAX.cold,
    price: () => COLD_EXPAND_COST, apply: (p) => p.expandColdStorage(),
  },

  // ── 挂机产线设施（各自页面上也有同款按钮）──
  {
    id: 'ranchPens', group: 'idle', name: '牧场栏位', icon: '🐄', view: 'ranch', unit: '栏',
    desc: '每个栏位养一头动物，按周期消耗饲料产出蛋/奶/肉',
    current: (p) => p.ranchPens(), max: RANCH_MAX_PENS,
    price: (p) => nextRanchExpandCost(p.ranchPens()), apply: (p) => p.ranchExpand(),
  },
  {
    id: 'pondPens', group: 'idle', name: '网箱', icon: '🐟', view: 'ranch', unit: '箱',
    desc: '每个网箱养一种鱼，吃海苔产出鱼与水产加工品（并入牧场页）',
    current: (p) => p.pondPens(), max: POND_MAX,
    price: (p) => nextPondExpandCost(p.pondPens()), apply: (p) => p.pondExpand(),
  },
  {
    id: 'cellarSlots', group: 'idle', name: '地窖格位', icon: '🍶', view: 'cellar', unit: '格',
    desc: '酒类/腌制品入窖陈酿换金币（12/24/48/96 小时 ×1.5~×4）',
    current: (p) => p.cellarSlots(), max: 9,
    price: (p) => nextCellarExpandCost(p.cellarSlots()), apply: (p) => p.cellarExpand(),
  },
  {
    id: 'mushroomBeds', group: 'idle', name: '菌房菇床', icon: '🍄', view: 'mycoField', unit: '床',
    desc: '吃肥料产菌菇（菌灵露 Ⅰ~Ⅳ 档原料）',
    current: (p) => p.mushroomBeds(), max: MUSHROOM_MAX_BEDS,
    price: (p) => nextMushroomExpandCost(p.mushroomBeds()), apply: (p) => p.mushroomExpand(),
  },
  {
    id: 'spiritPlots', group: 'idle', name: '灵圃', icon: '🌱', view: 'mycoField', unit: '格',
    desc: '种稀有种子产灵植（菌灵露 Ⅴ~Ⅷ 档原料），收获回收种子',
    current: (p) => p.spiritPlots(), max: SPIRIT_MAX_PLOTS,
    price: (p) => nextSpiritExpandCost(p.spiritPlots()), apply: (p) => p.spiritExpand(),
  },
  {
    id: 'essenceVats', group: 'idle', name: '萃露炉', icon: '🧪', view: 'mycoField', unit: '格',
    desc: '把菌菇/灵植酿成 8 档菌灵露（乘区物品）',
    current: (p) => p.essenceVats(), max: ESSENCE_MAX_VATS,
    price: (p) => nextEssenceExpandCost(p.essenceVats()), apply: (p) => p.essenceExpand(),
  },
  {
    id: 'caravanSlots', group: 'idle', name: '商队槽位', icon: '🐫', view: 'caravan', unit: '队',
    desc: '每支商队占一个槽位出海经商，按归队时刻的行情结算',
    current: (p) => p.caravanSlots(), max: CARAVAN_MAX_SLOTS,
    price: (p) => nextCaravanExpandCost(p.caravanSlots()), apply: (p) => p.caravanExpand(),
  },
  {
    id: 'greenhouseBeds', group: 'idle', name: '温室格', icon: '🏡', view: 'greenhouse', unit: '格',
    desc: '种作物提速 25% 且**不受天气影响**，每次收获 10% 概率伴生蜂蜜',
    current: (p) => p.greenhouseBeds(), max: GREENHOUSE_MAX_BEDS,
    price: (p) => nextGreenhouseExpandCost(p.greenhouseBeds()), apply: (p) => p.greenhouseExpand(),
  },
  {
    id: 'hives', group: 'idle', name: '蜂箱', icon: '🐝', view: 'greenhouse', unit: '只',
    desc: '用花类蜜源稳定产蜜（品级由花的等级决定）',
    current: (p) => p.hiveCount(), max: HIVE_MAX_COUNT,
    price: (p) => nextHiveExpandCost(p.hiveCount()), apply: (p) => p.hiveExpand(),
  },

  // ── 农耕 ──
  {
    id: 'farmTool', group: 'farm', name: '农具（灌溉与农机）', icon: '🧰', view: 'skill', skill: 'farming', unit: '级',
    desc: `每级农田生长时间 −${TOOL_TIME_PER_LEVEL * 100}%（最多 −${TOOL_MAX_LEVEL * TOOL_TIME_PER_LEVEL * 100}%）——用金币缩短「等」的时间`,
    current: (p) => p.farmToolLevel(), max: TOOL_MAX_LEVEL,
    price: (p) => nextToolCost(p.farmToolLevel()), apply: (p) => p.upgradeFarmTool(),
  },

  // ── 便利解锁（一次性）──
  ...AUTOMATIONS.map((a) => ({
    id: `auto_${a.id}`, group: 'convenience', name: a.name, icon: a.icon, view: 'automation', unit: '',
    desc: a.desc,
    current: (p) => (p.automation?.unlocked?.[a.id] ? 1 : 0), max: 1,
    price: (p) => (p.automation?.unlocked?.[a.id] ? null : a.cost),
    apply: (p) => p.automationUnlock(a.id),
  })),
]

/** 按分组切好，供商店面板直接渲染 */
export function expansionsByGroup() {
  return EXPANSION_GROUPS.map((g) => ({ ...g, rows: EXPANSIONS.filter((e) => e.group === g.id) })).filter((g) => g.rows.length)
}
