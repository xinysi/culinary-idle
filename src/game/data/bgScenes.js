// 场景背景图：**当前页面 → 该页的背景图**（2026-10-01 用户提供 105 个场景 × 昼/夜）。
//
// 设计口径（为什么这样写）：
//   · **尽量从数据派生、不手抄名字** —— 左栏功能页的中文名来自 `featureGroups()`，
//     技能名来自 `SKILL_DEFS`，两处的名字与背景图文件名本来就一字不差（105 场景对账实测：
//     技能 38/38 全中、功能页只差 `skill` 与 13 个顶栏页）⇒ 手抄一份清单迟早会与它们漂。
//   · **只有「顶栏那 13 个不在左栏磁贴里的页」与 `skill` 需要手写**（前者没有名字来源，后者要按当前激活技能取）。
//   · 图放在 `public/images/bg/<场景>.webp`（白天）/ `<场景>_night.webp`（夜晚，随主题切换——
//     与既有壁纸「深色换夜景」的既有口径一致）。
//
// ⚠️ 路径一律走 `assetUrl()`：**根绝对路径 `/images/...` 在打包的 exe 里会全坏**
//    （dev / Pages 看不出问题，file:// 下解析到磁盘根 ⇒ 素材 404，且 `ItemImg` 的 @error 会静默隐藏）。
import { assetUrl } from './itemImage.js'
import { featureGroups } from './featureGroups.js'
import { SKILL_DEFS } from './skills.js'

// 顶栏 13 个页面：它们**不在左栏磁贴里** ⇒ 没有名字来源，只能显式映射（键与场景名一一对应，有守卫核）
// ⚠️ `fest` 是顶栏的「🏆大赛」（不是节庆页）——2026-10-01 守卫抓过：写成「节庆」会让 `大赛.webp` 永不显示、
//    而大赛页显示的是节庆图（两张都白画一张）。
export const VIEW_SCENE_EXTRA = {
  stats: '统计', log: '图鉴', restaurant: '餐厅', guild: '公会', season: '赛季',
  arena: '竞技场', tower: '试炼塔', fest: '大赛', mijian: '觅珍', guide: '攻略',
  inventory: '厨藏', equipment: '装备',
}

// 场景别名：页面名在图上**不存在**时改用它（键可以是 view key，也可以是派生出来的场景名）。
// `分店` 这一页没有专属背景（用户那批 105 个场景里没有它）⇒ 回落餐厅。
export const SCENE_FALLBACK = { branches: '餐厅', 分店: '餐厅' }

// 启动页
export const SPLASH_SCENE = '启动页'

// 主题偏好的**全局键**：启动页阶段还没读档，`player.settings.theme` 是默认值 ⇒ 只能读它。
// 放这里是为了「一个键只有一处定义」——`App.vue` 的 applyTheme 也引这个常量。
export const THEME_PREF_KEY = 'culinary-idle.theme'

/** 当前该用夜景版吗（读全局偏好键，读不到就当白天）。启动页与主界面共用这一个判据。 */
export function isNightPref() {
  try { return localStorage.getItem(THEME_PREF_KEY) === 'dark' } catch { return false }
}

let _viewCache = null

/** 左栏磁贴的名字表（`view → 中文名`）。缓存是模块级：它只由静态数据构建，不随存档变。 */
function viewNameOf() {
  if (_viewCache) return _viewCache
  const m = {}
  try {
    for (const g of featureGroups()) for (const it of (g.items ?? g.tiles ?? [])) if (it?.view && it.name) m[it.view] = it.name
  } catch { /* 无存档/纯静态环境下保持为空，回落到下面的显式表 */ }
  _viewCache = m
  return m
}

/** 当前页面该用哪个背景场景。`view==='skill'` 时按当前激活技能取。 */
export function sceneForView(view, activeSkill) {
  if (view === 'skill') {
    const n = SKILL_DEFS?.[activeSkill]?.name
    return (n && SCENE_FALLBACK[n]) || n || SPLASH_SCENE
  }
  const raw = viewNameOf()[view] ?? VIEW_SCENE_EXTRA[view] ?? null
  if (!raw) return SCENE_FALLBACK[view] ?? null
  return SCENE_FALLBACK[raw] ?? raw            // 派生出来的名字也要过一遍别名（分店 → 餐厅）
}

/** 场景 → 背景图 URL（`night` = 深色主题用夜景版）。没有场景时返回 null（调用方保留旧壁纸兜底）。 */
export function bgImageFor(scene, night) {
  if (!scene) return null
  return assetUrl(`/images/bg/${scene}${night ? '_night' : ''}.webp`)
}

/** 场景名清单（只读，给守卫与调试用）：左栏名 + 技能名 + 显式表 + 启动页。 */
export function allSceneNames() {
  const s = new Set([SPLASH_SCENE, ...Object.values(VIEW_SCENE_EXTRA), ...Object.values(SCENE_FALLBACK)])
  try {
    for (const g of featureGroups()) for (const it of (g.items ?? g.tiles ?? [])) if (it?.name) s.add(it.name)
  } catch { /* 见上 */ }
  for (const d of Object.values(SKILL_DEFS ?? {})) if (d?.name) s.add(d.name)
  return [...s]
}
