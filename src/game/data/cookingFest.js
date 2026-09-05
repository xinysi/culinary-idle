// 月度厨艺大赛 — 与 14 天赛季错峰的月度主题循环（2026-09-06）
// 主题按月份（年月数字 % 12）轮换；玩家每日 3 次提交机会（消耗 1 件符合主题的料理），
// 按料理 value + tier×5 + heal×0.1 计分；月累计里程碑 1000/3000/6000 发一次性奖励。
// 纯新增层：不动料理数值（value/heal/tier 均读取现有 ITEMS），奖励用现有物品。

export const FEST_THEMES = [
  { id: 'hotpot', name: '火锅季', desc: '热汤沸腾，滚煮百味。提交「汤品/主菜」主题料理。', cats: ['汤品', '主菜'] },
  { id: 'sweets', name: '甜品月', desc: '甜在心头，幸福加倍。提交「甜点/烘焙」主题料理。', cats: ['甜点', 'baking'] },
  { id: 'sea', name: '海鲜节', desc: '浪花拍岸，鲜味无边。提交「海鲜」主题料理。', cats: ['seafood'] },
  { id: 'meat', name: '烤肉狂欢', desc: '炭火与油脂的协奏曲。提交「肉类」主题料理。', cats: ['meat'] },
  { id: 'veg', name: '素食周', desc: '让蔬菜成为主角。提交「蔬菜/根茎/水果」主题料理。', cats: ['vegetable', 'root', 'fruit'] },
  { id: 'noodle', name: '面点风云', desc: '一揉一擀皆是功夫。提交「主食/烘焙」主题料理。', cats: ['主食', 'baking'] },
  { id: 'sour', name: '酸味挑战', desc: '酸爽开胃，万物皆可酸。提交「腌制/酱料」主题料理。', cats: ['pickled', 'sauce'] },
  { id: 'spicy', name: '麻辣江湖', desc: '无辣不欢！提交「腌制/酱料/主菜」主题料理。', cats: ['pickled', 'sauce', '主菜'] },
  { id: 'tea', name: '茶点雅集', desc: '清茶一盏，点心为伴。提交「糕点/饮品」主题料理。', cats: ['甜点', 'baking'] },
  { id: 'legend', name: '传奇食谱', desc: '只有最传说的料理才配得上这个月！提交任何料理。', cats: ['any'] },
  { id: 'kid', name: '儿童套餐', desc: '童趣满满，色香味俱全。提交「甜点/主食/烘焙」主题料理', cats: ['甜点', '主食', 'baking'] },
  { id: 'feast', name: '饕餮盛宴', desc: '年夜饭一般的排场！提交任何料理。', cats: ['any'] },
]

/** 当前主题（按年月 YYYYMM 数值取模，跨月自动轮换） */
export function festThemeFor(yearMonthNum) {
  return FEST_THEMES[Math.max(0, yearMonthNum % FEST_THEMES.length)]
}

/** 主题是否接受该料理（category 匹配；'any' 接受一切） */
export function festAccepts(theme, category) {
  return theme.cats.includes('any') || theme.cats.includes(category)
}

/** 大赛评分：料理 value + tier×5 + heal×0.1（仅读取现有数值，不改动） */
export function festScore(item) {
  return Math.max(1, Math.floor(item.value + (item.tier ?? 0) * 5 + (item.heal ?? 0) * 0.1))
}

/** 月度里程碑：月累计分数达到即一次性发奖 */
export const FEST_MILESTONES = [
  { score: 1000, gold: 500, items: { mysterySpice: 1 } },
  { score: 3000, gold: 1200, items: { energyBiscuit: 1 } },
  { score: 6000, gold: 2500, items: { mysterySpice: 2, energyBiscuit: 1 } },
]

export const FEST_DAILY_ENTRIES = 3 // 每日提交次数
