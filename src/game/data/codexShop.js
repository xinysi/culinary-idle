// 图鉴兑换所（2026-09-10 新增）— 给「图鉴收集」补一个兑现出口。
// 设计约束（纯读取层）：
//   ① 只读 player.collected（已有的首次收集标记），不改任何物品数据；
//   ② 货币「图鉴点数」按完成度档位一次性发放——与菜系图谱的「美食见闻（每件 +1）」区分开，避免同一事件发两种货币；
//   ③ 货架只给外观类（称号 / 头像框，不影响数值曲线）与限量收藏道具。

/** 完成度档位 → 一次性发放的点数（累计 210 点） */
export const CODEX_TIERS = [
  { pct: 5, points: 8 },
  { pct: 10, points: 10 },
  { pct: 15, points: 12 },
  { pct: 20, points: 12 },
  { pct: 25, points: 14 },
  { pct: 30, points: 14 },
  { pct: 35, points: 16 },
  { pct: 40, points: 16 },
  { pct: 45, points: 18 },
  { pct: 50, points: 20 },
  { pct: 60, points: 22 },
  { pct: 70, points: 26 },
  { pct: 80, points: 30 },
  { pct: 90, points: 36 },
  { pct: 100, points: 56 },
]

export const CODEX_TIER_TOTAL = CODEX_TIERS.reduce((a, t) => a + t.points, 0)

/** 按完成度算出「累计应发放点数」与「下一档」 */
export function codexPointsFor(pct) {
  let total = 0
  let next = null
  for (const t of CODEX_TIERS) {
    if (pct >= t.pct) total += t.points
    else if (!next) next = t
  }
  return { total, next }
}

/**
 * 货架：{ id, name, icon, kind, cost, desc }
 * kind：'title'（限定称号，进称号注册表）| 'frame'（限定头像框）| 'item'（限量收藏道具）
 */
export const CODEX_REWARDS = [
  { id: 'cx_spice', kind: 'item', icon: '🌶', name: '神秘调料 ×3', cost: 12, items: { mysterySpice: 3 }, desc: '开局就能换到的实用收藏品' },
  { id: 'cx_biscuit', kind: 'item', icon: '🍪', name: '能量饼干 ×5', cost: 20, items: { energyBiscuit: 5 }, desc: '离线收益补充' },
  { id: 'cx_taste', kind: 'item', icon: '👅', name: '品鉴点 ×300', cost: 16, tastePoints: 300, desc: '奥义解锁用' },
  { id: 'cx_frame_dex', kind: 'frame', icon: '🖼️', name: '「典藏」头像框', cost: 24, frame: 'codex', desc: '古籍青描边 + 青玉光晕（图鉴专属）' },
  { id: 'cx_title_scholar', kind: 'title', icon: '🏷️', name: '称号：博物学者', cost: 30, title: '博物学者', desc: '图鉴收集者的第一枚印记（计入荣誉殿堂）' },
  { id: 'cx_frame_omni', kind: 'frame', icon: '🖼️', name: '「全知」头像框', cost: 55, frame: 'codexOmni', desc: '全知金描边 + 三层光晕（图鉴专属）' },
  { id: 'cx_title_omni', kind: 'title', icon: '🏷️', name: '称号：万物皆知', cost: 80, title: '万物皆知', desc: '图鉴收集者的最高印记（计入荣誉殿堂）' },
]

const CODEX_INDEX = new Map(CODEX_REWARDS.map((r) => [r.id, r]))

export function getCodexReward(id) {
  return CODEX_INDEX.get(id) ?? null
}

/** 图鉴专属称号（进称号注册表，图鉴三查/称号唯一性校验会扫到） */
export const CODEX_TITLES = CODEX_REWARDS.filter((r) => r.kind === 'title').map((r) => ({ id: r.id, name: r.title, desc: r.desc }))

