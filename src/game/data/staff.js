// 雇工班底（2026-09-10 新增）— 餐厅雇工：按小时发工资（金币），换取餐厅经营加成。
// 设计约束：纯金币经济层，不新增物品、不改动餐厅/装饰既有数值；工资付不出时自动停工（效果暂停）。

/** 三种岗位（每级效果见 per）；工资按小时、随等级线性增长 */
export const STAFF = [
  { id: 'chef', name: '掌勺', icon: '👨‍🍳', per: 8, wage: 220, desc: '餐厅收入 +8% / 级' },
  { id: 'waiter', name: '跑堂', icon: '🏃', per: 10, wage: 130, desc: '食客订单奖励 +10% / 级' },
  { id: 'buyer', name: '采买', icon: '🧺', per: 6, wage: 90, desc: '餐厅收入 +6% / 级（兼管采买，降低补给保留金币要求）' },
  { id: 'steward', name: '掌柜', icon: '📒', per: 9, wage: 200, desc: '餐厅收入 +9% / 级（门面与客情，门槛 2,222/时）' },
  { id: 'accountant', name: '账房', icon: '🧮', per: 5, wage: 70, desc: '餐厅收入 +5% / 级（精打细算，最便宜好养）' },
]

const STAFF_INDEX = new Map(STAFF.map((s) => [s.id, s]))

export function getStaff(id) {
  return STAFF_INDEX.get(id) ?? null
}

export const STAFF_MAX_LEVEL = 5

/** 雇佣/升级到第 level 级的一次性花费 */
export function staffCost(level) {
  const lv = Math.max(1, Math.min(STAFF_MAX_LEVEL, Math.round(level)))
  return { gold: 8000 * lv * lv }
}

/** 每小时工资（按当前等级） */
export function staffWage(def, level) {
  return Math.max(0, Math.round((def?.wage ?? 0) * Math.max(0, level ?? 0)))
}
