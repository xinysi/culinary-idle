// 里程碑之路（2026-09-10 新增）— 把散落各处的长线目标聚合成一条带进度的路线图。
// 纯只读聚合：所有进度都从既有 player 字段/数据推导，不新增存档字段、不改动任何固定数据。

/**
 * 里程碑定义：{ id, name, icon, group, target, unit, value(p) -> 当前值, hint }
 * group 用于分组展示：成长 / 收集 / 对战 / 经营 / 长线
 */
export const MILESTONES = [
  // ── 成长 ──
  { id: 'm_totalLevels', group: '成长', icon: '📈', name: '总等级 500', target: 500, unit: '级', hint: '20 技能等级合计', value: (p) => p.totalLevels },
  { id: 'm_skill120', group: '成长', icon: '🔝', name: '单个技能 120 级', target: 120, unit: '级', hint: '转生后上限解锁', value: (p) => Math.max(0, ...Object.values(p.skills ?? {}).map((s) => s.level ?? 1)) },
  { id: 'm_prestige12', group: '成长', icon: '♻️', name: '转生 12 次', target: 12, unit: '次', hint: '每层 +20% 经验', value: (p) => p.stats?.prestiges ?? 0 },
  { id: 'm_school30', group: '成长', icon: '📜', name: '六派研究 30 级', target: 30, unit: '级', hint: '六派各 5 级', value: (p) => p.schoolTotalLevels?.() ?? 0 },
  { id: 'm_insight12', group: '成长', icon: '🗺️', name: '菜系图谱 12 节点', target: 12, unit: '节点', hint: '美食见闻解锁', value: (p) => (p.insights ?? []).length },
  // ── 收集 ──
  { id: 'm_collection100', group: '收集', icon: '📖', name: '图鉴 100%', target: 100, unit: '%', hint: '2210 件物品全收集', value: (p) => Math.floor(p.collectionPct ?? 0) },
  { id: 'm_flavor28', group: '收集', icon: '📔', name: '风味搭配 28 条', target: 28, unit: '条', hint: '食材组合全点亮', value: (p) => Object.keys(p.flavors ?? {}).length },
  { id: 'm_spirit160', group: '收集', icon: '✨', name: '食灵 160 种', target: 160, unit: '种', hint: '食灵阁收集', value: (p) => Object.keys(p.spirits?.owned ?? {}).length },
  { id: 'm_season40', group: '收集', icon: '🎪', name: '40 季全部领奖', target: 40, unit: '季', hint: '时空穿梭者成就', value: (p) => Object.values(p.seasons ?? {}).filter((s) => (s.claimed?.length ?? 0) > 0).length },
  { id: 'm_gearSet81', group: '收集', icon: '🧩', name: '锻造套装 81 套', target: 81, unit: '套', hint: '同名套穿戴 2/4/6 件', value: (p) => p.setBonuses?.length ?? 0 },
  // ── 对战 ──
  { id: 'm_boss28', group: '对战', icon: '👑', name: '击杀 28 首领', target: 28, unit: '位', hint: '含终局首领', value: (p) => (p.stats?.bosses ?? []).length },
  { id: 'm_hardBoss28', group: '对战', icon: '🔥', name: '困难首杀 28 首领', target: 28, unit: '位', hint: '食神之巅成就', value: (p) => (p.stats?.hardBosses ?? []).length },
  { id: 'm_tower100', group: '对战', icon: '🗼', name: '挑战塔 100 层', target: 100, unit: '层', hint: '99 级解锁后无限爬', value: (p) => p.tower?.best ?? 0 },
  { id: 'm_realm60', group: '对战', icon: '🏯', name: '食神秘境 60 层', target: 60, unit: '层', hint: 'Roguelike 上限', value: (p) => p.realm?.best ?? 0 },
  { id: 'm_arena20', group: '对战', icon: '🏆', name: '竞技场 20 连胜', target: 20, unit: '连胜', hint: '每 5 连胜开宝箱', value: (p) => p.stats?.arena?.bestStreak ?? 0 },
  // ── 经营 ──
  { id: 'm_michelin3', group: '经营', icon: '⭐', name: '米其林三星', target: 3, unit: '星', hint: '六维评分 ≥620', value: (p) => p.michelin?.best ?? 0 },
  { id: 'm_branchAll', group: '经营', icon: '🏬', name: '四家分店满店长', target: 4, unit: '家', hint: '连锁帝国成就', value: (p) => ['east', 'west', 'south', 'north'].filter((id) => p.branches?.[id]?.manager).length },
  { id: 'm_regularAll', group: '经营', icon: '📖', name: '8 位常客满好感', target: 8, unit: '位', hint: '每日招待 1 次', value: (p) => Object.values(p.regulars ?? {}).filter((r) => (r?.serves ?? 0) >= 25).length },
  { id: 'm_guildMax', group: '经营', icon: '🤝', name: '公会点数 10000', target: 10000, unit: '点', hint: '每日任务累积', value: (p) => p.guild?.points ?? 0 },
  // ── 长线 ──
  { id: 'm_achievement151', group: '长线', icon: '🏅', name: '成就全清', target: 151, unit: '项', hint: '当前成就总数', value: (p) => (p.achievements ?? []).length },
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
