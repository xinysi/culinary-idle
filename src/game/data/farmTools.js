// 农具 / 灌溉（2026-09-14 新增，v2.4.1）— 农耕的「缩短等待」成长轴。
//
// 起因（用户 2026-09-14）：「大部分作物在采集可以无限速刷，但是农耕需要等，这怎么办」。
// 量化后的实情（满精通、小麦 90s）：
//   · 20 块地 ≈ 1.20 件/秒（当季 ×1.5 → 1.80）vs 满精通的一条采集线 ≈ 0.50 件/秒 —— **低中阶作物农耕其实不输**，
//     而且农田**不占 0-3 的并行挂机槽**；
//   · 但**高阶作物**（灵果 growSec 990s）每块地 16 分钟才 1 件，而采集 2 秒一件 ⇒ 差距 100~500 倍，
//     这才是「采集能无限速刷、农耕只能干等」的真正来源。
//
// 本模块给农耕补上「用金币缩短等待」的成长轴：农具等级越高，农田**生长时间**越短（最多 −30%）。
// 约束：不改动任何固定数据（作物 growSec 一个字都不动，只乘一个玩家侧的系数）；不需要新物品与图片。
export const TOOL_MAX_LEVEL = 6
/** 每级减少的生长时间比例（5% ⇒ 满级 30%） */
export const TOOL_TIME_PER_LEVEL = 0.05
/** 升到下一级的金币（第 1 级起，与地块数量形成两条投资线：地块数=并行度、农具=速度） */
export const TOOL_COSTS = [50000, 150000, 400000, 1000000, 2500000, 6000000]

/** 该等级的生长时间系数（0.70 ~ 1.00） */
export function toolTimeFactor(level = 0) {
  const lv = Math.max(0, Math.min(TOOL_MAX_LEVEL, Number(level) || 0))
  return 1 - lv * TOOL_TIME_PER_LEVEL
}

/** 升到下一级的费用（满级返回 null） */
export function nextToolCost(level = 0) {
  return TOOL_COSTS[level] ?? null
}

/** 一句人话：当前等级 + 效果 */
export function toolLabel(level = 0, growSec = 90) {
  const lv = Math.max(0, Math.min(TOOL_MAX_LEVEL, Number(level) || 0))
  const eff = Math.round(growSec * toolTimeFactor(lv))
  return lv === 0 ? `${growSec}s（未购置农具）` : `${eff}s（农具 Lv${lv} · −${lv * TOOL_TIME_PER_LEVEL * 100}%）`
}
