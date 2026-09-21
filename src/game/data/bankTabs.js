// 厨藏面板分类（2026-09-20 用户要求：「给下方左边地方顶部添加面板功能，十块面板，
// 可以手动移动物品到不同面板进行分类，或者下方右边详细说明里选择移到哪个面板」）——
// 仿梅尔沃的仓库面板：**恒 10 块**；第 0 块是「全部」（恒显示所有物品、**不收物品**），其余 9 块可改名字与图标。
//
// 与存档的关系（遵守「新增存档字段必须三处齐备」铁律）：
//   `bankTabs`（10 块的名字/图标）· `itemTabs`（物品 → 面板）· `invDefaultTab`（新物品默认进哪块）
//   三处 = `defaultState` 声明 + `serialize()` 写档 + `applySave` 的 $patch 还原，且读档一律走下面的夹取函数。
import { getItem } from './items.js'

export const BANK_TAB_COUNT = 10

/** 默认 10 块：0 = 全部（固定，不可收物品），1~9 为可自定义面板 */
export const DEFAULT_BANK_TABS = Array.from({ length: BANK_TAB_COUNT }, (_, i) => ({
  name: i === 0 ? '全部' : `面板 ${i + 1}`,
  icon: null, // 物品 id；null 时用序号图标
}))

/** 存档里的面板表 → 可安全渲染的 10 块（块数固定、名字是字符串、图标必须是**存在**的物品） */
export function sanitizeBankTabs(raw) {
  const out = DEFAULT_BANK_TABS.map((t) => ({ ...t }))
  if (!Array.isArray(raw)) return out
  for (let i = 0; i < BANK_TAB_COUNT; i++) {
    const r = raw[i]
    if (!r || typeof r !== 'object') continue
    if (typeof r.name === 'string' && r.name.trim()) out[i].name = r.name.trim().slice(0, 12)
    // 图标是物品 id：不存在的 id 会让 `<img>` 破图（照 sidelineWorks 的过滤写法）
    if (typeof r.icon === 'string' && getItem(r.icon)) out[i].icon = r.icon
  }
  out[0].name = DEFAULT_BANK_TABS[0].name // 「全部」是功能块，名字不给改
  return out
}

/** 面板下标：整数、夹在 [0, BANK_TAB_COUNT) 内（字符串/NaN/越界一律回 0 = 全部） */
export function sanitizeTabIndex(v) {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= 0 && n < BANK_TAB_COUNT ? n : 0
}

/** 物品 → 面板：只保留「存在且 > 0 的物品」与「1~9 的面板」（0 = 未分类，不存） */
export function sanitizeItemTabs(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, v] of Object.entries(raw)) {
    if (!getItem(id)) continue
    const tab = Math.floor(Number(v))
    if (Number.isFinite(tab) && tab > 0 && tab < BANK_TAB_COUNT) out[id] = tab
  }
  return out
}

/** 某个物品属于哪块面板（未分类 → 走默认分类；默认也是 0（全部）时即「只在全部里出现」） */
export function tabOfItem(itemTabs, itemId, defaultTab = 0) {
  const t = itemTabs?.[itemId]
  return Number.isFinite(Number(t)) && Number(t) > 0 ? Number(t) : sanitizeTabIndex(defaultTab)
}
