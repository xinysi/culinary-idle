// 上限常量（**单一来源**，2026-09-13 立）
// 起因：审计发现「背包 100 / 仓库 500 / 冷库 100 / 离线上限 12h」等数值在 17+ 处各自写字面量，
// 任何一处调整都会漏掉别处（典型：商店说「上限 100」而读档夹取、山海食经发放在别处各写一遍）。
// 规矩：**新增/修改任何上限，只改这里**；消费方一律引用本模块。

/**
 * 容量**硬顶**（游戏能到达的最大值）＝ 初始 + 金币购买满 + 山海食经全树满。
 * ⚠️ 这三个数不是随手写的：**任何新增「加容量」的来源都必须回头把这里抬上去**，
 * 否则奖励会撞顶后顺位转投到另一档——玩家看到的是「节点写『背包 +1』，结果仓库涨了」（2026-09-13 用户实测报过）。
 * C23 有守卫断言：`CAP_MAX.x ≥ PAID_CAP_MAX.x + 山海食经全树总量`。
 * 2026-09-16（山海食经 10 线 → 12 线，伐薪/矿脉上线）：全树容量涨到 背包 276 / 仓库 456 / 冷库 70，
 * 故三档硬顶同步抬到 100+276=376 / 500+456=956 / 100+70=170（金币路径上限 `PAID_CAP_MAX` 一个都没动）。
 */
export const CAP_MAX = { inventory: 376, bank: 956, cold: 170 }
/** 容量初始值 */
export const CAP_BASE = { inventory: 20, bank: 100, cold: 5 }
/**
 * **金币购买路径**的天花板（杂货铺扩容 / 冷库付费扩容）——与硬顶刻意分开：
 * 这两条路的价格与节奏是标定过的（+10 格 200 金 / +20 格 150 金 / +1 格 1000 金），
 * 抬硬顶**不得**顺手把金币能买到的地方也抬上去，只能让「商店之外的新来源」（山海食经）落进硬顶的余量里。
 */
export const PAID_CAP_MAX = { inventory: 100, bank: 500, cold: 100 }
// 2026-09-20：**存储合一**（用户要求「只有一个厨藏」）——仓库并入厨藏，容量相加。
// 原「原背包 100 + 原仓库 500 = 600」；同一天用户又要求**商店的厨藏扩容上限提到 2500**
// （「商店的厨藏扩容从600提到2500」）⇒ 这两个常量从此是**独立标定**的，不再等于三档之和。
// ⚠️ 原来的 CAP_*/PAID_CAP_MAX 三档常量**继续保留**：① 山海食经的 220 条 `bankCap` 奖励是**固定数据**，
//    必须还能引用；② `_grantShanhaiCaps` 的账本形状（inventory/bank/cold）也没变。
//    但它们现在只描述「那一档奖励叫什么」，**钱能买多少 / 硬顶多高只看下面两个 STORAGE_***。
export const STORAGE_BASE = CAP_BASE.inventory + CAP_BASE.bank
/** 合并后的厨藏**金币可买到**的上限（2026-09-20 用户要求 600 → 2500；两件扩容商品的价格与增量不变） */
export const STORAGE_PAID_MAX = 2500
/**
 * 合并后的厨藏**硬顶** = 金币路径上限 + 山海食经全树容量奖励。
 * 山海食经全树（12 线，`shanhaiTree.js`，**固定数据**）：`inventoryCap` 合计 276 + `bankCap` 合计 456 = **732**
 * ⇒ 2500 + 732 = **3232**。⚠️ 抬 `STORAGE_PAID_MAX` 时必须**同步抬这里**（C23 有守卫），
 * 否则山海食经的容量奖励会撞顶后被顺位转投/静默吞掉（2026-09-13 用户实测报过「写的背包、加的是仓库」）。
 */
export const STORAGE_MAX = 3232
/** 冷库付费扩容：每次 +1 格的价格（原来在 player.js 与 ProductionView.vue 各写一份） */
export const COLD_EXPAND_COST = 1000

/** 离线收益时长上限：基础 + 三处加成，各有自己的天花板 */
export const OFFLINE_CAP = {
  baseHours: 12,        // DEFAULT_MAX_OFFLINE_MS 的小时数
  biscuitMaxHours: 12,  // 能量饼干叠加上限（+4/块）
  daoMaxHours: 6,       // 厨神之路·采撷之道
  shanhaiMaxHours: 8,   // 山海食经（与 shanhaiProgress.SHANHAI_EFFECT_CAPS.offlineH 一致；12 线：7 条采集线第 6 环各 1h + 采撷终点 1h）
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
 * 地窖**单槽基础价值上限**（2026-09-17，v2.10.0 收进此处）——原本写死在 `cellar.js` 的
 * `CELLAR_MAX_BASE_VALUE = 16000`，现按「上限单一来源」规矩收敛，并区分**基础**与**硬顶**：
 * 副业·陶艺的 10 件陶器每件 +1500 ⇒ 硬顶 31000。
 * ⚠️ 消费方（`cellarPut` 校验 / `CellarView` 的输入夹取、满额估算、文案）一律走
 * `player.cellarSlotValueMax()`（= 基础 + 陶艺已做的量），**别再引用固定值**——
 * 否则玩家做了陶器之后，地窖页仍按 16000 报价，等于奖励没生效（C33 有断言）。
 */
export const CELLAR_SLOT_VALUE_BASE = 16000
/** 硬顶 = 基础 16,000 + 陶艺 10 件作品（+15,000）+ 陶艺量产阶梯 12 档（+9,000） */
export const CELLAR_SLOT_VALUE_MAX = 40000

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

// ── 设置面板「经验倍率」的可选档位（2026-09-21 收口）──────────────────────
//
// 背景：这一项原先是 1/10/50/100/250/500/**1000×** 的玩家可随时切换的下拉。
// 实测（`scripts/sim/xp_multiplier_breakdown.mjs`）它是**单层贡献最大的一项**（×10 档单独就 ×11），
// 与增益剂 ×4.95、转生 ×3.3 相乘后总乘区可达 **×312** —— 于是「采摘 1→99 = 44.2h」这种标定过的时长
// 会被一个下拉框直接抹平（含 ×10 的那档「满配」只要 40 分钟）。
// ⇒ 收成有界的**加速档**（最高 ×5）：让「想快一点」仍是选项，但不再能一键作废整套进度标定。
//
// 🔴 **口径只能有一份**：设置面板的 `<option>` 与 `applySave` 的读档夹取都引用本常量。
//    旧档里存着的 10/50/100/250/500/1000 会在读档时夹到合法档（见 `safeXpMultiplier`），
//    否则老玩家会带着 ×1000 继续跑、而面板上已经没有那个选项（显示与实际不一致）。
export const XP_MULTIPLIER_OPTIONS = [1, 2, 3, 5]

/** 读档用：经验倍率必须落在合法档位内；非法值（含旧档的 1000）夹到**不超过它的最大合法档** */
export function safeXpMultiplier(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  if (XP_MULTIPLIER_OPTIONS.includes(n)) return n
  const below = XP_MULTIPLIER_OPTIONS.filter((x) => x <= n)
  return below.length ? below[below.length - 1] : XP_MULTIPLIER_OPTIONS[0]
}
