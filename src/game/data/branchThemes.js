// 分店主题（2026-09-10 新增）— 给每家分店选一个「主题」，与菜系研究联动：主题对应学派每级给该店 +6% 时收。
// 设计约束：只读取既有分店与学派状态；主题只是倍率加成，不改动分店既有数值。
export const BRANCH_THEMES = [
  { id: 'sichuan', name: '川味馆', icon: '🌶', school: 's_main', cost: 12000, desc: '红案（主菜）主题：该学派每级 +6% 时收' },
  { id: 'canton', name: '粤式茶楼', icon: '🫖', school: 's_soup', cost: 12000, desc: '汤羹学派主题：该学派每级 +6% 时收' },
  { id: 'jp', name: '和食屋', icon: '🍣', school: 's_staple', cost: 16000, desc: '白案学派主题：该学派每级 +6% 时收' },
  { id: 'fr', name: '法式小馆', icon: '🥐', school: 's_dessert', cost: 20000, desc: '甜点学派主题：该学派每级 +6% 时收' },
  { id: 'bar', name: '小酒馆', icon: '🍺', school: 's_drink', cost: 16000, desc: '酒饮学派主题：该学派每级 +6% 时收' },
  { id: 'cellar', name: '腌酿铺', icon: '🫙', school: 's_pickle', cost: 16000, desc: '腌酿学派主题：该学派每级 +6% 时收' },
]

const THEME_INDEX = new Map(BRANCH_THEMES.map((t) => [t.id, t]))

export function getBranchTheme(id) {
  return THEME_INDEX.get(id) ?? null
}

/** 主题加成倍率：1 + 0.06 × 对应学派等级（未定主题 → 1） */
export const THEME_BONUS_PER_LEVEL = 6

export function themeMult(themeId, schoolLevel) {
  const def = getBranchTheme(themeId)
  if (!def) return 1
  return 1 + (THEME_BONUS_PER_LEVEL * Math.max(0, schoolLevel ?? 0)) / 100
}
