// 上限常量（**单一来源**，2026-09-13 立）
// 起因：审计发现「背包 100 / 仓库 500 / 冷库 100 / 离线上限 12h」等数值在 17+ 处各自写字面量，
// 任何一处调整都会漏掉别处（典型：商店说「上限 100」而读档夹取、山海食经发放在别处各写一遍）。
// 规矩：**新增/修改任何上限，只改这里**；消费方一律引用本模块。

/**
 * 容量**硬顶**（游戏能到达的最大值）＝ 初始 + 金币购买满 + 山海食经全树满。
 * ⚠️ 这三个数不是随手写的：**任何新增「加容量」的来源都必须回头把这里抬上去**，
 * 否则奖励会撞顶后顺位转投到另一档——玩家看到的是「节点写『背包 +1』，结果仓库涨了」（2026-09-13 用户实测报过）。
 * C23 有守卫断言：`CAP_MAX.x ≥ PAID_CAP_MAX.x + 山海食经全树总量`。
 */
export const CAP_MAX = { inventory: 330, bank: 890, cold: 158 }
/** 容量初始值 */
export const CAP_BASE = { inventory: 20, bank: 100, cold: 5 }
/**
 * **金币购买路径**的天花板（杂货铺扩容 / 冷库付费扩容）——与硬顶刻意分开：
 * 这两条路的价格与节奏是标定过的（+10 格 200 金 / +20 格 150 金 / +1 格 1000 金），
 * 抬硬顶**不得**顺手把金币能买到的地方也抬上去，只能让「商店之外的新来源」（山海食经）落进硬顶的余量里。
 */
export const PAID_CAP_MAX = { inventory: 100, bank: 500, cold: 100 }
/** 冷库付费扩容：每次 +1 格的价格（原来在 player.js 与 ProductionView.vue 各写一份） */
export const COLD_EXPAND_COST = 1000

/** 离线收益时长上限：基础 + 三处加成，各有自己的天花板 */
export const OFFLINE_CAP = {
  baseHours: 12,        // DEFAULT_MAX_OFFLINE_MS 的小时数
  biscuitMaxHours: 12,  // 能量饼干叠加上限（+4/块）
  daoMaxHours: 6,       // 厨神之路·采撷之道
  shanhaiMaxHours: 6,   // 山海食经（与 shanhaiProgress.SHANHAI_EFFECT_CAPS.offlineH 一致）
}

/**
 * 随等级派生的上限（原先散落在 getter / 技能里的字面量）：
 * 起步值 + 成长公式 + 硬顶都在这里，getter 只做算术。
 */
export const DERIVED_MAX = {
  restaurantSlots: 6, restaurantSlotsBase: 2, restaurantSlotsPerLevels: 2, // 菜单格：2 + ⌊(餐厅等级−1)/2⌋，上限 6
  farmPlots: 20, farmPlotsBase: 4, farmPlotsPerLevels: 5,                 // 农田：4 + ⌊农耕等级/5⌋，上限 20
}

/**
 * 挂机产线的**单次离线补算上限**（小时）——牧场 / 菌房 / 网箱（并入牧场）/ 餐厅分店同源。
 * 2026-09-14 收敛：此前牧场与分店各写一份 12h 字面量（`RANCH_OFFLINE_CAP_HOURS` /
 * `BRANCH_OFFLINE_CAP_HOURS`），新增同族系统时必然又要抄一遍，故收进这里做单一来源。
 */
export const IDLE_CAP_HOURS = 12

/**
 * 挂机产线的**设施上限**（槽位 / 格数 / 箱数）——新系统一律登记在此，读档夹取与 UI 渲染都读它。
 * 与容量类（CAP_MAX）不同，这些是「建了几个位置」而不是「能装多少件」，故单独一表。
 */
export const FACILITY_MAX = {
  caravanSlots: 3,     // 商队线：1 → 3
  mushroomBeds: 3,     // 菌房：1 → 3
  spiritPlots: 3,      // 灵田：1 → 3
  greenhouseBeds: 6,   // 温室：2 → 6
  hives: 3,            // 蜂箱（原蜂场，并入温室页）：1 → 3
  ponds: 4,            // 网箱（并入牧场）：2 → 4
}

/** 商队线：单个槽位的本金价值上限（按装载物品的 value 合计） */
export const CARAVAN_CARGO_CAP = 30000

/**
 * 读档用安全夹取：非有限数（缺字段 / 字符串 / NaN）回退默认值，负数归 0，超上限夹到上限。
 * ⚠️ 别再用裸 `Math.min(saved.x ?? d, MAX)` —— 存档里若是字符串会得到 NaN，
 * 之后 `used >= NaN` 恒为 false → **上限完全失效**（审计发现）。
 */
export function safeCap(value, fallback, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(Math.trunc(n), max))
}

/** 读档用安全数组截断：非数组回退 []，超长裁到 max */
export function safeList(value, max) {
  if (!Array.isArray(value)) return []
  return max > 0 ? value.slice(0, max) : value
}
