// 装备套装效果（2026-09-09 新增）— 同一套装备穿戴 2 / 4 / 6 件 → 叠加属性加成。
// 套件来源（纯读取现有数据，不改动任何铁律数据）：
//   ① 20 品质套（`smithSetExt.js` 配方前缀，非 ext-）② 21 独立矿套（`inip*`）③ 40 赛季套（`limitedItems`）
// 加成随套件等级（穿戴件中最高 tier × 10）缩放，保证低阶套不会压过高阶套。
import { ITEMS } from './items.js'
import { SMITHING_SET_RECIPES } from './smithSetExt.js'
import { SEASONS } from './seasons.js'

/** 触发档位（件数） */
export const SET_TIER_STEPS = [2, 4, 6]

const SLOT_SUFFIXES = ['厨师帽', '调味瓶', '砧板', '围裙', '护符', '戒指', '腿甲', '靴子', '头盔', '项链', '坠子', '耳环', '手镯', '刀', '锅', '环', '衣', '帽', '裤', '甲', '履']

function keyToName(key, ids) {
  const name = ITEMS[ids[0]]?.name ?? key
  for (const s of SLOT_SUFFIXES) if (name.endsWith(s)) return name.slice(0, -s.length) + '套装'
  return name + '套装'
}

/** 全部可触发效果的套装（≥6 件；按 id 前缀/配方前缀分组） */
export const EQUIPMENT_SETS = (() => {
  const out = []
  // ① 20 品质套：按配方 id 前缀分组（`套名-slot-xxx` / `smith_set_套名_slot`）
  const byPrefix = new Map()
  for (const r of SMITHING_SET_RECIPES) {
    const id = r.output?.itemId
    if (!id || !ITEMS[id] || String(r.id).startsWith('ext-')) continue
    const m = String(r.id).match(/^smith_set_([^_]+)_/) || String(r.id).match(/^([^-]+)-[a-z]+-/)
    if (!m) continue
    const key = `quality_${m[1]}`
    if (!byPrefix.has(key)) byPrefix.set(key, { key, name: `${m[1]}套装`, ids: [] })
    byPrefix.get(key).ids.push(id)
  }
  for (const s of byPrefix.values()) {
    s.ids = [...new Set(s.ids)]
    if (s.ids.length >= 6) out.push(s)
  }
  // ② 21 独立矿套（inip{宝石}_*）
  const inip = new Map()
  for (const [id, it] of Object.entries(ITEMS)) {
    const m = id.match(/^(inip[A-Za-z]+)_/)
    if (!m || it.type !== 'equipment') continue
    if (!inip.has(m[1])) inip.set(m[1], [])
    inip.get(m[1]).push(id)
  }
  for (const [key, ids] of inip) if (ids.length >= 6) out.push({ key, name: keyToName(key, ids), ids })
  // ③ 40 赛季套（limitedItems + 限定单件）
  for (const se of SEASONS) {
    const ids = [...(se.limitedItems ?? []), ...(se.limitedItem ? [se.limitedItem] : [])].filter((id) => ITEMS[id])
    if (ids.length >= 6) out.push({ key: `season_${se.id}`, name: `${se.name}限定套`, ids })
  }
  return out
})()

/** 装备 id → 所属套装（模块加载时建索引，运行时 O(1) 查询） */
const ITEM_SET_INDEX = new Map()
for (const set of EQUIPMENT_SETS) for (const id of set.ids) if (!ITEM_SET_INDEX.has(id)) ITEM_SET_INDEX.set(id, set)

/** 查询某件装备所属的套装（无则 null）——图鉴「所属套装」展示用 */
export function equipSetOf(itemId) {
  return ITEM_SET_INDEX.get(itemId) ?? null
}

/**
 * 当前穿戴触发的套装加成。
 * 2 件：攻击/防御 + 0.12×套件等级；4 件：再 + 生命 0.5×等级、命中 0.1×等级；
 * 6 件：再 + 暴击 0.5%、攻速 3%（固定）。
 * @param {Record<string,string|null>} equipment 槽位 → 装备 id
 * @returns {{attack:number, defense:number, hpBonus:number, accuracy:number, critChance:number, speedBonus:number, active:Array}}
 */
export function equipSetBonuses(equipment) {
  const out = { attack: 0, defense: 0, hpBonus: 0, accuracy: 0, critChance: 0, speedBonus: 0, active: [] }
  if (!equipment) return out
  const bySet = new Map()
  for (const id of Object.values(equipment)) {
    if (!id) continue
    const set = ITEM_SET_INDEX.get(id)
    if (!set) continue
    let entry = bySet.get(set.key)
    if (!entry) bySet.set(set.key, (entry = { set, ids: [] }))
    entry.ids.push(id)
  }
  for (const { set, ids } of bySet.values()) {
    const n = ids.length
    if (n < 2) continue
    const level = Math.max(...ids.map((id) => (ITEMS[id]?.tier ?? 1) * 10))
    if (n >= 2) { out.attack += level * 0.12; out.defense += level * 0.12 }
    if (n >= 4) { out.hpBonus += level * 0.5; out.accuracy += level * 0.1 }
    if (n >= 6) { out.critChance += 0.005; out.speedBonus += 0.03 }
    out.active.push({ key: set.key, name: set.name, count: n, level })
  }
  return out
}
