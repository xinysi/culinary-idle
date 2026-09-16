// 木材按档入配方（v2.7.0，2026-09-16）——用户明确授权的一次「固定层」改写，范围**收窄且可审计**。
//
// 背景：装备是严格每 5 级一套（20 套覆盖 Lv1-100），而 365 条锻造配方里**只有 18 条**吃木材、
// 且 **Lv51 以上一条都不吃** —— 于是「75 级装备要用 75 级木材」在既有配方里没有落点。
// 用户批准改写配方材料后，本模块把这条规则**做成可测试的规范化步骤**，而不是手改 176 行产物：
//
// 规则（只动 `ingredients`，**不碰 reqLevel、不碰其它材料、不碰任何数值**）：
//   ① 20 品质套里**已经在用 `木材`（wood）的配方**：`wood` → 该配方等级所在档的木材（数量不变）
//   ② 20 品质套的**砧板**（木器部位，此前 Lv51+ 完全不含木材）：补上同档木材，数量 2~5 按档递增
//   ③ **21 独立矿套**（配方 id 以 `ext-` 开头）与赛季装备：**一律不动**
//   ④ 基础款 `木材`（id `wood`）本身与它的既有用途（采摘附产/炼金/奇遇/公会任务/对决掉落）**一律不动**
//
// 为什么必须是「规范化」而不是手改产物：`smithSetExt.js` 是生成器产物（365 条、约 1.8 万行），
// 手改既有漏改风险、也无法在守卫里断言不变量。本模块让 C28 能直接断言
// 「每条 20 套配方的木材材料 == 该配方等级对应的档位木材，且不再出现 `wood`」。
import { getItem } from './items.js'
import { SMITHING_SET_RECIPES } from './smithSetExt.js'
import { ITEM_LEVEL } from './combatLoot.js'
import { TIMBERS, timberOfLevel } from './timbers.js'

/** 20 品质套 vs 21 独立矿套的判定（与 `itemBalance.js:158-160` 同一口径） */
export function isTwentySetRecipe(r) {
  return !String(r?.id ?? '').startsWith('ext-')
}

/** 砧板：木器部位（高段套装此前不含木材，正是我们要补的那批） */
export function isBoardRecipe(r) {
  return /砧板$/.test(getItem(r?.output?.itemId)?.name ?? '')
}

/** 锅：8 槽的高段套装（钨/锰/钒/萤）没有砧板，用锅作为该档的木器部位（木柄） */
export function isPotRecipe(r) {
  return /锅$/.test(getItem(r?.output?.itemId)?.name ?? '')
}

/** 每档补的木材数量：2/3/4/5（按档递增，与矿的数量阶梯同量级） */
export function timberQtyForLevel(level) {
  const idx = Math.max(0, Math.min(19, Math.floor((Math.max(1, level) - 1) / 5)))
  return 2 + Math.floor(idx / 5)
}

/** 某档（0..19）的 20 套配方 */
function bandRecipes(recipes, idx) {
  const from = idx * 5 + 1
  const to = from + 4
  return recipes.filter((r) => isTwentySetRecipe(r) && r?.ingredients && r.reqLevel >= from && r.reqLevel <= to)
}

/** 档位序号（0..19）：Lv1-5→0 … Lv96-100→19 */
export function bandIndexOf(level) {
  return Math.max(0, Math.min(19, Math.floor((Math.max(1, level) - 1) / 5)))
}

/** 每档的「同档矿」——**从 20 套配方里派生**（不另抄一份映射表，套装改了也不会脱节）。
 *  择优：同名矿（id 以 `Ore` 结尾**且不是盐矿**）> 其它矿物 > 盐矿。
 *  ⚠️ 盐矿刻意排最后：它的 id（`saltOre`）也以 `Ore` 结尾，会顶掉钢矿/银矿等同名矿（实测踩过）。 */
const ORE_SCORE = (id) => (id === 'saltOre' ? 0 : /Ore$/.test(id) ? 2 : 1)
const BAND_ORE = (() => {
  const map = new Map()
  for (const r of SMITHING_SET_RECIPES) {
    if (!isTwentySetRecipe(r)) continue
    const idx = bandIndexOf(r.reqLevel)
    for (const id of Object.keys(r.ingredients ?? {})) {
      if (getItem(id)?.category !== 'mineral') continue
      const prev = map.get(idx)
      if (!prev || ORE_SCORE(id) > ORE_SCORE(prev)) map.set(idx, id)
    }
  }
  return map
})()

/** 某个等级对应的「同档矿」（装备强化按档消耗用；极端情况回落盐矿） */
export function oreOfLevel(level) {
  return BAND_ORE.get(bandIndexOf(level)) ?? 'saltOre'
}

/** 装备的「等级」：**优先取产出它的锻造配方 reqLevel**（那才是游戏里的解锁等级、也是「N 级装备」的口径；
 *  `ITEM_LEVEL` 由战斗掉落生成器按掉落池推导，可能与套的区间差几级——实测琉璃砧板差 3 级）。
 *  退化顺序：配方 reqLevel → `ITEM_LEVEL` → 物品 tier×10。 */
export function equipmentLevelOf(itemId) {
  const r = SMITHING_SET_RECIPES.find((x) => x.output?.itemId === itemId)
  if (r?.reqLevel) return r.reqLevel
  const lv = ITEM_LEVEL?.[itemId]
  if (lv) return lv
  return Math.max(1, (getItem(itemId)?.tier ?? 1) * 10)
}

/** 20 档 (木材, 矿) 配对表——供 UI 文案与守卫断言 */
export const BAND_MATERIALS = TIMBERS.map((t, i) => ({
  band: i,
  from: t.level,
  to: Math.min(100, t.level + 4),
  timber: t.id,
  timberName: t.name,
  ore: BAND_ORE.get(i) ?? 'saltOre',
}))

/**
 * 就地改写 20 品质套配方的木材材料。返回改动统计（供日志与守卫断言）。
 * ⚠️ 必须在 `balanceRecipeLevels()` **之前**调用：先入档位木材，让平衡看到最终材料构成。
 *
 * 两步：① 已在用 `木材` 的配方 → 换成该档木材（数量不变）；
 *       ② **逐档兜底**：某档若还没有任何木材需求，就补它的木器部位（砧板；8 槽高段套没有砧板则用锅）——
 *          这样 20 档**每一档都有同档木材需求**（用户要求「N 级装备要 N 级木材」逐档成立）。
 */
export function retargetTimberMaterials(recipes) {
  let swapped = 0
  let added = 0
  // ① 换档
  for (const r of recipes) {
    if (!r?.ingredients || !isTwentySetRecipe(r)) continue
    const t = timberOfLevel(r.reqLevel)
    if (!t || !r.ingredients.wood) continue
    r.ingredients[t.id] = (r.ingredients[t.id] ?? 0) + r.ingredients.wood
    delete r.ingredients.wood
    swapped++
  }
  // ② 逐档兜底补料
  const timberIds = new Set(TIMBERS.map((t) => t.id))
  for (let idx = 0; idx < 20; idx++) {
    const rows = bandRecipes(recipes, idx)
    if (!rows.length) continue
    if (rows.some((r) => Object.keys(r.ingredients).some((k) => timberIds.has(k)))) continue
    const slot = rows.find(isBoardRecipe) ?? rows.find(isPotRecipe)
    if (!slot) continue
    const t = timberOfLevel(slot.reqLevel)
    slot.ingredients[t.id] = (slot.ingredients[t.id] ?? 0) + timberQtyForLevel(slot.reqLevel)
    added++
  }
  return { swapped, added }
}
