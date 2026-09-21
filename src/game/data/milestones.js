// 里程碑之路（2026-09-10 新增）— 把散落各处的长线目标聚合成一条带进度的路线图。
// 纯只读聚合：所有进度都从既有 player 字段/数据推导，不新增存档字段、不改动任何固定数据。

import { BRANCHES } from './branches.js'
import { REGULARS } from './regulars.js'
import { COLLECTABLE_SETS } from './setBonuses.js'
// ⚠️ 与 achievements.js 是**循环引用**（它 import 本文件去算「圆满之路」成就）⇒ 成就总数**只能经 getter 延迟读**，
//    绝不能在 MILESTONES 数组字面量里直接算（那会在模块求值期读到未初始化的绑定）。
import { ALL_ACHIEVEMENTS } from './achievements.js'

/**
 * 里程碑定义：{ id, name, icon, group, target, unit, value(p) -> 当前值, hint }
 * group 用于分组展示：成长 / 收集 / 对战 / 经营 / 长线
 *
 * 🔒 **凡是名字里带「全 / 满 / 集齐」的目标，`target` 必须等于该数据的真实总量**（成就总数 / 家数 / 位数 / 套数），
 *    否则玩家会在「58% 就报完成」——历史上就出过这个错（成就 151/262、分店 4/6、常客 8/12、套装 81/43）。
 *    `scripts/ci/audit_sync.mjs` 的「里程碑总量一致」守卫会拦住回归；hint 里的数字也被它核对。
 */
export const MILESTONES = [
  // ── 成长 ──
  { id: 'm_totalLevels', group: '成长', icon: '📈', name: '总等级 500', target: 500, unit: '级', hint: '38 技能等级合计', value: (p) => p.totalLevels },
  { id: 'm_skill120', group: '成长', icon: '🔝', name: '单个技能 120 级', target: 120, unit: '级', hint: '转生后上限解锁', value: (p) => Math.max(0, ...Object.values(p.skills ?? {}).map((s) => s.level ?? 1)) },
  { id: 'm_prestige12', group: '成长', icon: '♻️', name: '转生 12 次', target: 12, unit: '次', hint: '每层 +20% 经验', value: (p) => p.stats?.prestiges ?? 0 },
  { id: 'm_school30', group: '成长', icon: '📜', name: '六派研究 30 级', target: 30, unit: '级', hint: '六派各 5 级', value: (p) => p.schoolTotalLevels?.() ?? 0 },
  { id: 'm_insight12', group: '成长', icon: '🗺️', name: '菜系图谱 12 节点', target: 12, unit: '节点', hint: '美食见闻解锁', value: (p) => (p.insights ?? []).length },
  // ── 收集 ──
  { id: 'm_collection100', group: '收集', icon: '📖', name: '图鉴 100%', target: 100, unit: '%', hint: '全部 2427 件物品收集', value: (p) => Math.floor(p.collectionPct ?? 0) },
  { id: 'm_flavor28', group: '收集', icon: '📔', name: '风味搭配 28 条', target: 28, unit: '条', hint: '食材组合全点亮', value: (p) => Object.keys(p.flavors ?? {}).length },
  { id: 'm_spirit160', group: '收集', icon: '✨', name: '食灵 160 种', target: 160, unit: '种', hint: '食灵阁收集', value: (p) => Object.keys(p.spirits?.owned ?? {}).length },
  { id: 'm_season40', group: '收集', icon: '🎪', name: '40 季全部领奖', target: 40, unit: '季', hint: '时空穿梭者成就', value: (p) => Object.values(p.seasons ?? {}).filter((s) => (s.claimed?.length ?? 0) > 0).length },
  // ⚠️ 原先 target=81（把全部套定义都算上），而 `setBonuses` 只记「**集齐**（图鉴集齐整套）并发过奖」的套 ⇒ 实际上限 43，永远做不完
  { id: 'm_gearSetAll', group: '收集', icon: '🧩', name: '锻造套装全收集', target: COLLECTABLE_SETS.length, unit: '套', hint: '集齐整套即发奖', value: (p) => p.setBonuses?.length ?? 0 },
  // ── 对战 ──
  { id: 'm_boss28', group: '对战', icon: '👑', name: '击杀 28 首领', target: 28, unit: '位', hint: '含终局首领', value: (p) => (p.stats?.bosses ?? []).length },
  { id: 'm_hardBoss28', group: '对战', icon: '🔥', name: '困难首杀 28 首领', target: 28, unit: '位', hint: '食神之巅成就', value: (p) => (p.stats?.hardBosses ?? []).length },
  { id: 'm_tower100', group: '对战', icon: '🗼', name: '挑战塔 100 层', target: 100, unit: '层', hint: '对决 60 解锁后无限爬', value: (p) => p.tower?.best ?? 0 },
  { id: 'm_realm60', group: '对战', icon: '🏯', name: '食神秘境 60 层', target: 60, unit: '层', hint: 'Roguelike 上限', value: (p) => p.realm?.best ?? 0 },
  { id: 'm_arena20', group: '对战', icon: '🏆', name: '竞技场 20 连胜', target: 20, unit: '连胜', hint: '每 5 连胜开宝箱', value: (p) => p.stats?.arena?.bestStreak ?? 0 },
  // ── 经营 ──
  { id: 'm_michelin3', group: '经营', icon: '⭐', name: '米其林三星', target: 3, unit: '星', hint: '六维评分 ≥620', value: (p) => p.michelin?.best ?? 0 },
  { id: 'm_branchAll', group: '经营', icon: '🏬', name: '六家分店满店长', target: BRANCHES.length, unit: '家', hint: '连锁帝国成就', value: (p) => BRANCHES.filter((b) => p.branches?.[b.id]?.manager).length },
  { id: 'm_regularAll', group: '经营', icon: '📖', name: '12 位常客满好感', target: REGULARS.length, unit: '位', hint: '每日招待 1 次', value: (p) => Object.values(p.regulars ?? {}).filter((r) => (r?.serves ?? 0) >= 25).length },
  { id: 'm_guildMax', group: '经营', icon: '🤝', name: '公会点数 10000', target: 10000, unit: '点', hint: '每日任务累积', value: (p) => p.guild?.points ?? 0 },
  // ── 长线 ──
  { id: 'm_achievementAll', group: '长线', icon: '🏅', name: '成就全清', get target() { return ALL_ACHIEVEMENTS.length }, unit: '项', hint: '全部 262 项成就', value: (p) => (p.achievements ?? []).length },
  { id: 'm_endingame', group: '长线', icon: '👑', name: '毕业：禁忌食神', target: 1, unit: '', hint: 'L100 首领', value: (p) => ((p.stats?.bosses ?? []).includes('禁忌食神') ? 1 : 0) },
]

/** 汇总统计：{ done, total, pct, byGroup } */
export function milestoneSummary(player) {
  let done = 0
  const byGroup = {}
  for (const m of MILESTONES) {
    const cur = Math.min(m.target, Number(m.value(player)) || 0)
    const ok = cur >= m.target
    if (ok) done++
    byGroup[m.group] = byGroup[m.group] ?? { done: 0, total: 0 }
    byGroup[m.group].total++
    if (ok) byGroup[m.group].done++
  }
  return { done, total: MILESTONES.length, pct: Math.round((done / MILESTONES.length) * 100), byGroup }
}

/**
 * 「下一根胡萝卜」：返回**最接近完成**的那条未完成里程碑（按完成度比例取最大）——
 * 供常驻状态条显示「下一个：X · 62%（还差 Y）」（2026-09-18，留存改进 ②）。
 * 设计说明：
 *  - 只挑「已经动过一点」的（cur > 0）：否则刚开局会挑到一条 0% 的长线目标，看着毫无进展感；
 *    若一条都没动过，退回「完成度最高的那条」（≈target 最小的），保证永远有可见目标。
 *  - **不给时间预估**：放置游戏里算 ETA 要知道每条目标的产出速率，而多数目标跨系统，
 *    硬凑一个「约 X 分钟」会是假信息；这里只给真实进度与还差多少。
 * 返回 { m, cur, target, pct, remain }，或 null（全部完成）。
 */
export function nextMilestone(player) {
  const rows = MILESTONES.map((m) => {
    const raw = Number(m.value(player)) || 0
    const cur = Math.max(0, Math.min(m.target, raw))
    return { m, cur, target: m.target, pct: m.target > 0 ? cur / m.target : 0, remain: Math.max(0, m.target - cur) }
  })
  const undone = rows.filter((r) => r.remain > 0)
  if (!undone.length) return null
  const started = undone.filter((r) => r.cur > 0)
  const pick = (started.length ? started : undone).sort((a, b) => b.pct - a.pct || a.remain - b.remain)[0]
  return { ...pick, pct: Math.round(pick.pct * 100) }
}
