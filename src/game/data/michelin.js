// 餐厅米其林评级（2026-09-10 新增）— 把餐厅六个子系统（菜单/装饰/订单/评论家/常客/分店）汇成一个总评分，
// 每个「自然日」评审一次，分数达标升星、滑落掉星（可涨可跌），星级给餐厅收入与全局经验加成。
// 设计约束：只读取既有系统状态，不新增物品、不改动餐厅/装饰既有数值。

/** 解锁条件：餐厅达到该等级 */
export const MICHELIN_UNLOCK_LEVEL = 3

/** 评审维度权重（评分 = 各项加权和，量纲统一为「分」） */
export const MICHELIN_FACTORS = [
  { id: 'menu', label: '菜单成色', weight: 12, hint: '菜单中料理的最高档位之和' },
  { id: 'decor', label: '店面装潢', weight: 0.6, hint: '已购装饰件数' },
  { id: 'orders', label: '出餐口碑', weight: 1.2, hint: '已完成的食客订单数' },
  { id: 'critic', label: '评论家好评', weight: 25, hint: '满足评论家的次数' },
  { id: 'regulars', label: '常客好感', weight: 8, hint: '常客好感等级合计' },
  { id: 'branches', label: '连锁规模', weight: 60, hint: '已开业分店数（含店长加成 ×1.5）' },
]

/** 星级门槛（分数）与收益
 *  🔴 2026-09-26 用户⑮「评级最高只有三星，但餐厅可以一直升级」——实测坐实了这一点：
 *    `michelin_scale.mjs` 量到**中期**（菜单 12 道最高档、120 件装饰、600 单、6 次评论家、6 位常客、1 家分店）
 *    就已经 **2,634 分**（三星门槛 620），**后期 8,960、满配 9,640** —— 三星之后整条评级系统就再也不动了。
 *    现扩到**五星**，门槛按「六维同时推进」标定（不是靠单一维刷）：
 *      四星 3,200 ≈ 菜单近满 + 装饰过半 + 2,000 单 + 10 次评论家 + 常客半数 + 2 家分店；
 *      五星 8,000 ≈ 六维基本做满（装饰 300 件、5,000 单、20 次评论家、常客满级、分店带店长）。
 *    收益按原阶梯的步长续写（收入 +10→+15/级档、经验 +3/档），**不改前面四档**。 */
export const MICHELIN_STARS = [
  { star: 0, name: '未入榜', min: 0, incomePct: 0, xpPct: 0, desc: '继续经营，先把菜单与装潢做起来' },
  { star: 1, name: '一星', min: 120, incomePct: 10, xpPct: 0, desc: '餐厅收入 +10%' },
  { star: 2, name: '二星', min: 300, incomePct: 20, xpPct: 3, desc: '餐厅收入 +20%、全技能经验 +3%' },
  { star: 3, name: '三星', min: 620, incomePct: 35, xpPct: 6, desc: '餐厅收入 +35%、全技能经验 +6%' },
  { star: 4, name: '四星', min: 3200, incomePct: 50, xpPct: 9, desc: '餐厅收入 +50%、全技能经验 +9%' },
  { star: 5, name: '五星', min: 8000, incomePct: 65, xpPct: 12, desc: '餐厅收入 +65%、全技能经验 +12%（六维基本做满才够）' },
]

/** 由分数取星级（返回 MICHELIN_STARS 项） */
export function starFromScore(score) {
  let out = MICHELIN_STARS[0]
  for (const s of MICHELIN_STARS) if (score >= s.min) out = s
  return out
}

/** 距离下一星的差距（已满返回 null） */
export function nextStar(star) {
  return MICHELIN_STARS.find((s) => s.star === star + 1) ?? null
}
