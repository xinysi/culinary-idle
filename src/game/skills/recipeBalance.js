// 制作配方等级平衡：让产物等级与其材料获取等级匹配。
// 材料锚 = 直接采集/农垦/探索掉落等级 ∪ 其它“配方产物”等级（进阶加工品，如腌制酱料）。
// 食谱类（烹饪/烘焙/腌制/调酒/调料）→ raiseRecipeLevels：把配方等级抬到贴近最高材料锚（不删主料，不断供）。
// 保鲜/锻造 → balanceRecipeLevels：移除超纲高阶材料；若全部材料都超纲则改抬升配方等级（兜底）。
import { FORAGING_TARGETS } from './ForagingSkill.js'
import { FISHING_TARGETS } from './FishingSkill.js'
import { HUNTING_TARGETS } from './HuntingSkill.js'
import { EXCAVATION_TARGETS } from './ExcavationSkill.js'
import { CROPS } from './FarmingSkill.js'
import { GATHERING_EXT, PRODUCTION_EXT, SMITHING_EXT, PRESERVE_EXT, SPIRIT_EXT } from '../data/expansion1.js'
import { GATHERING_EXT2, PRODUCTION_EXT2, SMITHING_EXT2, PRESERVE_EXT2, SPIRIT_EXT2 } from '../data/expansion2.js'
import { SMITHING_SET_RECIPES } from '../data/smithSetExt.js'
import { FRESH_MAP, FRESH_TARGETS } from '../data/freshMats.js'
import { COOKING_RECIPES } from './CookingSkill.js'
import { BAKING_RECIPES } from './BakingSkill.js'
import { PRESERVING_RECIPES } from './PreservingSkill.js'
import { BREWING_RECIPES } from './BrewingSkill.js'
import { SPICE_RECIPES } from './SpiceMixingSkill.js'

// 物品 -> 最低获取等级（直接采集/农垦/探索掉落）
const minLevel = {}
const add = (id, lv) => {
  if (id == null) return
  if (minLevel[id] == null || lv < minLevel[id]) minLevel[id] = lv
}
for (const [arr] of [[FORAGING_TARGETS], [FISHING_TARGETS], [HUNTING_TARGETS], [EXCAVATION_TARGETS]]) {
  for (const t of arr) add(t.itemId, t.reqLevel)
}
for (const s of ['foraging', 'fishing', 'hunting', 'excavation']) {
  for (const t of GATHERING_EXT[s] ?? []) add(t.itemId, t.reqLevel)
  for (const t of GATHERING_EXT2[s] ?? []) add(t.itemId, t.reqLevel)
}
for (const c of CROPS) add(c.itemId, c.reqLevel)
// 注意：探索掉落【不】作为材料锚。探索卡片等级是“探索区难度”，不代表物品真实等级；
// 让探索掉落参与材料锚会让探索数据波动连锁改变食材/制作平衡（不应如此）。材料锚一律以采集/农耕/配方产物为准。
// 配方产物锚（进阶加工品作为材料时，按产出它的配方等级计）
const PROD_ANCHORS = [
  [PRODUCTION_EXT, ['cooking', 'baking', 'preserving', 'brewing', 'spiceMixing']],
  [PRODUCTION_EXT2, ['cooking', 'baking', 'preserving', 'brewing', 'spiceMixing']],
  [PRESERVE_EXT, []], [PRESERVE_EXT2, []],
  [SMITHING_EXT, []], [SMITHING_EXT2, []], [SMITHING_SET_RECIPES, []],
  [SPIRIT_EXT, []], [SPIRIT_EXT2, []],
]
for (const [arrLike, keys] of PROD_ANCHORS) {
  const arrs = keys.length ? keys.map((k) => arrLike?.[k] ?? []).flat() : Array.isArray(arrLike) ? arrLike : Object.values(arrLike ?? {}).flat()
  for (const r of arrs) if (r?.output?.itemId) add(r.output.itemId, r.reqLevel)
}
// 嫩替代食材采集等级
for (const t of FRESH_TARGETS.foraging ?? []) add(t.itemId, t.reqLevel)
// 基础配方产物锚（进阶加工品按产出它的配方 reqLevel 计；此前漏掉基础配方，导致低配方配高材料失衡）。
// 注意：只能在函数内使用（周期依赖——CookingSkill 等反向 import 本模块；顶层访问会因未初始化而崩溃）。
let _baseInited = false
function initBaseAnchors() {
  if (_baseInited) return
  _baseInited = true
  for (const r of [...COOKING_RECIPES, ...BAKING_RECIPES, ...PRESERVING_RECIPES, ...BREWING_RECIPES, ...SPICE_RECIPES]) {
    if (r.output?.itemId) add(r.output.itemId, r.reqLevel)
  }
}

// 把超纲配方里的“高频通用食材”替换为低阶嫩替代（使低等级菜可直接采到低阶食材）
function replaceFresh(r) {
  const mats = { ...(r.ingredients ?? {}) }
  let change = false
  for (const mid of Object.keys(mats)) {
    const young = FRESH_MAP[mid]
    if (!young) continue
    const lv = minLevel[mid]
    if (lv != null && lv > r.reqLevel + THRESHOLD) { mats[young] = mats[mid]; delete mats[mid]; change = true }
  }
  return change ? { ...r, ingredients: mats } : r
}

const THRESHOLD = 5 // 材料获取等级超过产物等级 5 级以上即视为超纲（严格）
const LEVEL_BUFFER = 5 // 抬升时保留的缓冲（材料锚 − 5，保证材料 ≤ 产物+5）

const highestAnchor = (r) => {
  let h = 0
  for (const mid of Object.keys(r.ingredients ?? {})) { const lv = minLevel[mid]; if (lv != null && lv > h) h = lv }
  return h
}

// 食谱类：抬升配方等级到贴近最高材料锚，消除低菜用高料（不删主料，不断供）
export function raiseRecipeLevels(recipes) {
  initBaseAnchors()
  return recipes.map((r) => {
    r = replaceFresh(r)
    const h = highestAnchor(r)
    if (h === 0) return r
    const target = Math.max(r.reqLevel, h - LEVEL_BUFFER)
    if (target <= r.reqLevel) return r
    return { ...r, reqLevel: target }
  })
}

// 保鲜/锻造：移除超纲高阶材料；若全部材料超纲则抬升配方等级（兜底保证匹配）
export function balanceRecipeLevels(recipes) {
  initBaseAnchors()
  return recipes.map((r) => {
    r = replaceFresh(r)
    const drops = []
    for (const [mid] of Object.entries(r.ingredients ?? {})) {
      const lv = minLevel[mid]
      if (lv != null && lv > r.reqLevel + THRESHOLD) drops.push(mid)
    }
    const total = Object.keys(r.ingredients ?? {}).length
    if (drops.length === 0) return r
    if (drops.length < total) {
      const mats = { ...r.ingredients }
      for (const mid of drops) delete mats[mid]
      return { ...r, ingredients: mats }
    }
    // 全部材料超纲：不删（会空），改抬升配方等级到贴近材料
    const target = Math.max(r.reqLevel, highestAnchor(r) - LEVEL_BUFFER)
    return target > r.reqLevel ? { ...r, reqLevel: target } : r
  })
}
