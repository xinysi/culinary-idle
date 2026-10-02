// 运营驾驶舱 / 平衡实验台 —— **标定参考区间的唯一来源**（2026-10-02 新角色 ops）
//
// 为什么单开一个文件：这些数字（单场时长、回收率、制作时长、成长时长）此前散在
//   AGENTS.md、OpsPanel 实验台的验收线、若干 sim 文档里。面板要显示"带内 ✅ / 带外 ⚠️"，
//   守卫要断言"页面与判据同源"——两边各抄一份必然漂移。故收敛到这里，谁用谁 import。
//
// ⚠️ 本模块**只放常量与纯函数**，不 import 任何游戏模块（避免成环），也不进存档。

/** 验收线判据（与 scripts/sim/*.mjs 的标定口径同源）——面板的 verdicts 全部读它 */
export const OPS_BANDS = [
  { id: 'ttk', label: '单场时长', lo: 4, hi: 25, unit: 's', note: '对照 Melvor 的「数秒~数十秒」；实测中位 9.9s（含击杀重生，AGENTS 敌人节奏三件套）' },
  { id: 'xpRate', label: '战斗经验 / 时', lo: 100, hi: Infinity, unit: '', note: '以基线为 100；低于 100 = 升级变慢（验收线是「不得劣于基线」）' },
  { id: 'craftTime', label: '制作升级时长', lo: 0, hi: 1, unit: '×', note: '以基线为 ×1；>×1 = 练级变慢（材料限速 ⇒ 时长与用量同比例）' },
  { id: 'recycle', label: '混池回收率', lo: 10, hi: 30, unit: '%', note: '标定带 10~30%（金币返还 + 物品价值×0.5 占池价）；<100% ⇒ 不存在抽卡刷金闭环' },
]

export function bandOf(id) {
  return OPS_BANDS.find((b) => b.id === id) ?? null
}

/** 值是否落在该判据的标定带内（无此判据 → false） */
export function inBand(id, value) {
  const b = bandOf(id)
  if (!b || !Number.isFinite(Number(value))) return false
  return Number(value) >= b.lo && Number(value) <= b.hi
}

/** 标定带的中文区间串（面板 title / 导出报表共用） */
export function bandRangeText(id) {
  const b = bandOf(id)
  if (!b) return ''
  const hi = b.hi === Infinity ? '∞' : fmtNum(b.hi)
  return `标定 ${fmtNum(b.lo)}${b.unit} ~ ${hi}${b.unit}`
}

function fmtNum(v) {
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

/**
 * 「成长时长」参考表（2026-09-28 实测，**限时窗口已桩** 的零加成基准列）。
 * ⚠️ 引用成长时长一律用这张表 —— AGENTS 里那些旧数（垂钓 2.7 天 …）是当时命中了限时窗口的读数。
 * 驾驶舱把它当"标定对照"展示，不参与任何结算。
 */
export const OPS_CALIBRATION = {
  asOf: '2026-09-28',
  gatherHours: 44.1,
  fishingDays: 3.6,
  huntingHours: 44.7,
  excavationHours: 42.3,
  farmingDays: 34.4,
  craftHours: { cooking: 33.7, baking: 31.0, preserving: 31.6, brewing: 34.5, spiceMixing: 31.2, craftsmithing: 36.0 },
  preserveHours: 34.9,
  spiritHours: 21.0,
  exploreDays: 4.0,
  combatDays: 9.1,
  ttkMedianSec: 9.9,
  endgameGoldPerHour: 1_380_000,
  note: '限时窗口已桩的零加成基准；引用成长时长一律用这张表',
}

/** 人性化时长：小时→「Nh」/「N.N 天」 */
export function hoursText(hours) {
  if (!Number.isFinite(hours)) return '—'
  return hours >= 24 ? `${(hours / 24).toFixed(1)} 天` : `${hours.toFixed(1)}h`
}
