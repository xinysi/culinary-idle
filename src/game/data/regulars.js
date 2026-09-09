// 常客名录（2026-09-10 新增）— 餐厅熟客养成：每日招待一位常客的偏好料理，累积好感等级换取长期加成。
// 设计约束：不新增物品、不改动既有料理数据；消耗既有料理，产出金币/好感（+ 满级专属礼物）。
// 每位常客每天可招待 1 次（按本地日期判定），好感等级 0~5，每级「小费 +2%」累加进餐厅收入。

/** 好感等级门槛：升到第 n 级所需的累计招待次数（index = 等级） */
export const REGULAR_LEVEL_REQ = [0, 3, 7, 12, 18, 25]

/** 每位常客：偏好料理类别 + 最低 tier + 单次招待奖励 */
export const REGULARS = [
  { id: 'r_oldman', name: '巷口老伯', icon: '👴', category: '主菜', minTier: 1, gold: 220, unlockLevel: 1 },
  { id: 'r_student', name: '赶考书生', icon: '📚', category: '主食', minTier: 1, gold: 200, unlockLevel: 2 },
  { id: 'r_merchant', name: '行脚商人', icon: '🧳', category: '汤品', minTier: 2, gold: 320, unlockLevel: 4 },
  { id: 'r_singer', name: '戏班名角', icon: '🎭', category: '甜点', minTier: 2, gold: 340, unlockLevel: 6 },
  { id: 'r_general', name: '卸甲将军', icon: '🛡️', category: '主菜', minTier: 3, gold: 460, unlockLevel: 9 },
  { id: 'r_nun', name: '云游尼师', icon: '🪷', category: 'baking', minTier: 3, gold: 420, unlockLevel: 12 },
  { id: 'r_prince', name: '微服公子', icon: '🎋', category: '汤品', minTier: 4, gold: 620, unlockLevel: 16 },
  { id: 'r_master', name: '归隐食家', icon: '🍵', category: '甜点', minTier: 5, gold: 800, unlockLevel: 20 },
]

const REGULAR_INDEX = new Map(REGULARS.map((r) => [r.id, r]))

export function getRegular(id) {
  return REGULAR_INDEX.get(id) ?? null
}

/** 由累计招待次数反推好感等级（0~5） */
export function regularLevelFromServes(serves) {
  const n = Math.max(0, Math.floor(serves ?? 0))
  let lv = 0
  for (let i = 1; i < REGULAR_LEVEL_REQ.length; i++) if (n >= REGULAR_LEVEL_REQ[i]) lv = i
  return lv
}

/** 好感进度：{ level, current, needed, progress } */
export function regularProgress(serves) {
  const n = Math.max(0, Math.floor(serves ?? 0))
  const level = regularLevelFromServes(n)
  if (level >= REGULAR_LEVEL_REQ.length - 1) return { level, current: n, needed: n, progress: 1 }
  const base = REGULAR_LEVEL_REQ[level]
  const next = REGULAR_LEVEL_REQ[level + 1]
  return { level, current: n - base, needed: next - base, progress: Math.min(1, (n - base) / (next - base)) }
}

/** 满级（5 级）奖励：神秘调料 ×1（每位一次，领取后置 claimedGift） */
export const REGULAR_MAX_GIFT = { itemId: 'mysterySpice', qty: 1 }
