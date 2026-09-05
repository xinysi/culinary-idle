// 制作品数值平衡层：让每件制作产物保留“原相对强弱”的 ±30% 梯度，且严格不越级。
// 做法：对每类主维度，按等级分组；组内 value = center(level) × clamp(原值/center, 0.7, 1.3)，
// 然后整组平移使“组最小值 ≥ 前一组最大值”（保证低高级不倒挂、严格单调递增）。
// 组内仍保留 ±30% 差异（名菜略高、简单菜略低）。仅在启动时就地改写 ITEMS 中制作产物效果。
import { ITEMS } from './items.js'
import { COOKING_RECIPES } from '../skills/CookingSkill.js'
import { BAKING_RECIPES } from '../skills/BakingSkill.js'
import { PRESERVING_RECIPES } from '../skills/PreservingSkill.js'
import { BREWING_RECIPES } from '../skills/BrewingSkill.js'
import { SPICE_RECIPES } from '../skills/SpiceMixingSkill.js'
import { SMITHING_RECIPES } from '../skills/CraftsmithingSkill.js'
import { PRESERVATION_RECIPES } from '../skills/PreservationSkill.js'
import { PRODUCTION_EXT, SMITHING_EXT, PRESERVE_EXT } from './expansion1.js'
import { PRODUCTION_EXT2, SMITHING_EXT2, PRESERVE_EXT2 } from './expansion2.js'
import { SMITHING_SET_RECIPES } from './smithSetExt.js'
import { balanceRecipeLevels, raiseRecipeLevels } from '../skills/recipeBalance.js'
import { LEGENDARY_LEVEL } from './combatLoot.js'
import { SEASONS } from './seasons.js'

// 物品 -> 权威制作等级
const levelOf = {}
function indexRecipes(arr, fn) {
  const bal = fn(arr)
  for (const o of arr) {
    const r = bal.find((x) => x.id === o.id) ?? o
    if (r.output?.itemId) {
      const id = r.output.itemId
      if (levelOf[id] == null || r.reqLevel < levelOf[id]) levelOf[id] = r.reqLevel
    }
  }
}
const G = [
  [COOKING_RECIPES, PRODUCTION_EXT.cooking, PRODUCTION_EXT2.cooking, raiseRecipeLevels],
  [BAKING_RECIPES, PRODUCTION_EXT.baking, PRODUCTION_EXT2.baking, raiseRecipeLevels],
  [PRESERVING_RECIPES, PRODUCTION_EXT.preserving, PRODUCTION_EXT2.preserving, raiseRecipeLevels],
  [BREWING_RECIPES, PRODUCTION_EXT.brewing, PRODUCTION_EXT2.brewing, raiseRecipeLevels],
  [SPICE_RECIPES, PRODUCTION_EXT.spiceMixing, PRODUCTION_EXT2.spiceMixing, raiseRecipeLevels],
  [SMITHING_SET_RECIPES, [], [], balanceRecipeLevels],
  [PRESERVATION_RECIPES, PRESERVE_EXT, PRESERVE_EXT2, balanceRecipeLevels],
]
for (const [a, b, c, fn] of G) indexRecipes([...a, ...(b ?? []), ...(c ?? [])], fn)

// 各维度基准 center(level)
const center = {
  weapon: (lv) => 2 + lv * 0.37,
  offhand: (lv) => 1 + lv * 0.37,
  helmet: (lv) => 1 + lv * 0.18,
  body: (lv) => 1 + lv * 0.28,
  amulet: (lv) => 1 + lv * 0.16,
  ring: (lv) => 1 + lv * 0.16,
  healStaple: (lv) => 15 + lv * 3,
  healMain: (lv) => 20 + lv * 3,
  healDessert: (lv) => 15 + lv * 3,
  healSoup: (lv) => 15 + lv * 3,
  healBaking: (lv) => 18 + lv * 3,
  healDrink: (lv) => 15 + lv * 2.5,
  flavor: (lv) => 8 + lv * 0.7,
  buffAtk: (lv) => 2 + lv * 0.1,
}
// 次要辅助属性
const aux = {
  hp: (lv) => 3 + lv * 0.24,
  accuracy: (lv) => 1 + lv * 0.2,
  evasion: (lv) => 1 + lv * 0.2,
  crit: (lv) => Math.min(0.12, 0.01 + lv * 0.0007),
  speed: (lv) => Math.min(0.8, 0.1 + lv * 0.005),
  regen: (lv) => lv * 0.06 + 2,
}

const round2 = (v) => Math.round(v * 100) / 100

// 主维度曲线如何取：装备槽位 -> 属性名 + center 函数
function mainDim(item, lv) {
  if (item.type === 'equipment') {
    const s = item.slot
    // field 后缀加上 slot，保证不同槽位（不同中心曲线/量级）各自分组平衡；应用时解析回 stats.xxx
    if (s === 'weapon') return { field: `stats.attack|${s}`, cur: center.weapon, val: item.stats?.attack }
    if (s === 'offhand') return { field: `stats.defense|${s}`, cur: center.offhand, val: item.stats?.defense }
    if (s === 'helmet') return { field: `stats.defense|${s}`, cur: center.helmet, val: item.stats?.defense }
    if (s === 'body') return { field: `stats.defense|${s}`, cur: center.body, val: item.stats?.defense }
    if (s === 'legs' || s === 'boots') return { field: `stats.defense|${s}`, cur: center.body, val: item.stats?.defense }
    if (s === 'amulet') return { field: `stats.defense|${s}`, cur: center.amulet, val: item.stats?.defense }
    if (s === 'ring') return { field: `stats.attack|${s}`, cur: center.ring, val: item.stats?.attack }
    return null
  }
  if (item.heal != null) {
    let cur
    if (item.category === '主食') cur = center.healStaple
    else if (item.category === '甜品' || item.category === '甜点') cur = center.healDessert
    else if (item.category === '汤品' || item.category === '汤') cur = center.healSoup
    else if (item.category === '烘焙' || item.category === 'bakery') cur = center.healBaking
    else if (item.type === 'drink') cur = center.healDrink
    else cur = center.healMain
    return { field: 'heal', cur, val: item.heal }
  }
  if (item.flavorEnergy != null) return { field: 'flavorEnergy', cur: center.flavor, val: item.flavorEnergy }
  if (item.buff?.atk != null) return { field: 'buff.atk', cur: center.buffAtk, val: item.buff.atk }
  return null
}

// 按 “维度key + 等级” 分组，组内 ±30% 梯度，跨级严格单调（整组平移）
function balanceGroup(entries) {
  // entries: [{ id, lv, field, cur, val }]
  const key = entries[0].field
  const byLv = new Map()
  for (const e of entries) { if (!byLv.has(e.lv)) byLv.set(e.lv, []); byLv.get(e.lv).push(e) }
  const lvs = [...byLv.keys()].sort((a, b) => a - b)
  const out = [] // { id, field, value }
  let prevFloor = 0
  for (const lv of lvs) {
    const group = byLv.get(lv)
    const c = group[0].cur(lv)
    // 组内 base = c × clamp(val/c, .7, 1.3)
    const bases = group.map((e) => c * Math.max(0.7, Math.min(1.3, (e.val ?? c) / c)))
    const shift = Math.max(0, prevFloor - Math.min(...bases))
    const newVals = bases.map((b) => b + shift)
    for (let i = 0; i < group.length; i++) out.push({ id: group[i].id, field: group[i].field, value: round2(newVals[i]) })
    prevFloor = Math.max(...newVals)
  }
  return out
}

export function applyItemBalance() {
  const result = {}
  // 赛季限定装备（传说）：统一按主等级段 Lv75 定级（与传说装备同档 center×1.25 曲线）。
  // 图鉴赛季列表展示的是每季 8 件 gear 套（limitedItems）+ 单件 limitedItem；全部计入。
  const SEASON_ACCENT_POOL = ['crit', 'speed', 'eva', 'acc', 'hp', 'atk', 'def']
  const SEASON_LEVEL = {}
  const SEASON_ACCENT = {}
  {
    let g = 0 // 季序号（0..39），每季一套设备共用同一偏向量 → 跨季互异
    for (const s of SEASONS) {
      const ids = []
      if (s.limitedItem) ids.push(s.limitedItem)
      for (const id of s.limitedItems ?? []) ids.push(id)
      if (!ids.length) { g++; continue }
      // 该季唯一 acc：
      const p = SEASON_ACCENT_POOL[g % SEASON_ACCENT_POOL.length]
      const rest = SEASON_ACCENT_POOL.filter((x) => x !== p)
      const secondary = rest[(g + Math.floor(g / SEASON_ACCENT_POOL.length)) % rest.length]
      const accent = { [p]: 1.3, [secondary]: 0.72 }
      for (const id of ids) {
        SEASON_LEVEL[id] = 75
        SEASON_ACCENT[id] = accent
      }
      g++
    }
  }
  // 传说/神话专属装备：定级为其等效等级（对决 BOSS 档位）
  for (const [id, lvl] of Object.entries({ ...LEGENDARY_LEVEL, ...SEASON_LEVEL })) levelOf[id] = lvl
  const LEGEND_ID = new Set([...Object.keys(LEGENDARY_LEVEL), ...Object.keys(SEASON_LEVEL)])
  // 非装备（食物/饮品/增益剂）主维度走平衡组（保留同级 ±30% 梯度）
  const dims = {}
  for (const [id, item] of Object.entries(ITEMS)) {
    const lv = levelOf[id]
    if (lv == null) continue
    const d = mainDim(item, lv)
    if (!d) continue
    if (item.type === 'equipment') {
      // 装备：每级每槽唯一 → 直接用该槽位 center(等级)，保证随段单调递增、等级差异明确、无平台、无倒挂
      const k = d.field.split('.')[1].split('|')[0]
      const isLegend = LEGEND_ID.has(id)
      const v = round2(d.cur(lv) * (isLegend ? 1.25 : 1)) // 传说/赛季装备略高于同段套装
      result[id] = result[id] || {}
      result[id].stats = result[id].stats || {}
      result[id].stats[k] = v
    } else {
      // 全量对齐：非装备（食物/饮品/增益剂）主维度效果 = 该物品显示等级的基准曲线值 (center)，
      // 不再走 ±30% 梯度分组，保证「显示等级 ↔ 效果」一一对应、随等级单调。（只调数值，不改等级）
      result[id] = result[id] || {}
      const v = round2(d.cur(lv))
      if (d.field === 'heal') result[id].heal = v
      else if (d.field === 'flavorEnergy') result[id].flavorEnergy = v
      else if (d.field === 'buff.atk') result[id].buff = { atk: v }
    }
  }
  // 应用主维度 + 次要辅助属性到 ITEMS
  for (const [id, item] of Object.entries(ITEMS)) {
    const lv = levelOf[id]
    if (lv == null) continue
    const patch = result[id] || {}
    if (item.type === 'equipment') {
      const s = { ...(item.stats ?? {}) }
      if (patch.stats) Object.assign(s, patch.stats)
      if (item.slot) {
        const accent = SEASON_ACCENT[id] ?? {}
        s.hpBonus = round2(aux.hp(lv) * (accent.hp ?? 1))
        s.accuracy = round2(aux.accuracy(lv) * (accent.acc ?? 1))
        s.evasion = round2(aux.evasion(lv) * (accent.eva ?? 1))
        s.critChance = round2(aux.crit(lv) * (accent.crit ?? 1))
        s.speedBonus = round2(aux.speed(lv) * (accent.speed ?? 1))
        // 赛季装备『atk/def』特色：主维度之外的额外攻击/防御（用武器 center×1.25 的一半），形成差异
        if (accent.atk && s.attack == null) s.attack = round2((2 + lv * 0.37) * 1.25 * 0.5)
        if (accent.def && s.defense == null) s.defense = round2((2 + lv * 0.37) * 1.25 * 0.5)
      }
      item.stats = s
    } else {
      if (patch.heal != null) item.heal = patch.heal
      if (patch.flavorEnergy != null) item.flavorEnergy = patch.flavorEnergy
      if (patch.buff) item.buff = { ...(item.buff ?? {}), ...patch.buff }
      if (item.regen?.perTurn != null) item.regen = { perTurn: round2(aux.regen(lv)), turns: item.regen.turns }
    }
  }
}
