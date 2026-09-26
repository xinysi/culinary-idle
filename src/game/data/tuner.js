// 运营调参层 —— 第四角色「运营调参员」的核心机制（2026-09-25 新增）
//
// 🔴 三条红线（用户要求「时刻注意对游戏本身的影响」，逐条落实）：
//   ① 只在**读取点**生效——数据文件一个字节不改。与 difficulty/materialCost 的「系数不改数据」
//      哲学同构：本模块只是给这些系数加了一层**会话内内存覆盖**，`over(key, base)` 无覆盖时
//      逐字节返回基线（system_test 有「默认零影响」断言）。
//   ② 纯**会话内存态**——overrides 只活在本模块内存里：不进存档（存档三处齐备不涉及）、
//      不写任何文件、**刷新页面即全部还原为基线**。
//   ③ CI 守卫永远跑在「无覆盖」状态——所有既有基线断言（难度/材料/成长）不受影响。
//
// 用法（读取点）：`tunerOver('key', 基线值, 下限, 上限)` —— 覆盖值会被夹在 [min, max] 内；
// 上限通常 = 基线（难度类「只能更难或复原」，保住 difficulty「永不抬高」的叙事不变量）。
// 面板（TunerPanel.vue）负责提供每项的 label / min / max / 步进，并把基线值从各数据模块读出来显示。
//
// ⚠️ 本模块**不 import 任何游戏模块**（避免成环），基线由调用方传入。

const overrides = Object.create(null) // key -> 覆盖数值（null/缺省 = 用基线）

/** 读取点的唯一出口：有覆盖且合法 → 夹取后的覆盖值；否则逐字返回基线 */
export function tunerOver(key, base, min = -Infinity, max = Infinity) {
  const v = overrides[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) return base
  return Math.min(max, Math.max(min, v))
}

/** 面板写入（存原始值；生效值以 tunerOver 的夹取为准）。value 传 null/undefined = 复原该键 */
export function tunerSet(key, value) {
  if (value == null || !Number.isFinite(Number(value))) delete overrides[key]
  else overrides[key] = Number(value)
}

/** 复原一个键 / 全部键 */
export function tunerResetKey(key) {
  delete overrides[key]
}
export function tunerResetAll() {
  for (const k of Object.keys(overrides)) delete overrides[k]
}

/** 当前生效的覆盖键列表（面板的「生效中」计数与警告条用） */
export function tunerActiveKeys() {
  return Object.keys(overrides)
}

/** 面板显示用：该键的覆盖值（无覆盖 = null） */
export function tunerRawValue(key) {
  const v = overrides[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
