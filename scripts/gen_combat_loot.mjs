// 生成对决掉落定级池：每 5 级段的可用装备池 + 代表性材料池（勿手改 combatLoot.js）
import { writeFileSync } from 'fs'
import { ITEMS } from '../src/game/data/items.js'
import { FORAGING_TARGETS } from '../src/game/skills/ForagingSkill.js'
import { FISHING_TARGETS } from '../src/game/skills/FishingSkill.js'
import { HUNTING_TARGETS } from '../src/game/skills/HuntingSkill.js'
import { EXCAVATION_TARGETS } from '../src/game/skills/ExcavationSkill.js'
import { CROPS } from '../src/game/skills/FarmingSkill.js'
import { COOKING_RECIPES } from '../src/game/skills/CookingSkill.js'
import { BAKING_RECIPES } from '../src/game/skills/BakingSkill.js'
import { PRESERVING_RECIPES } from '../src/game/skills/PreservingSkill.js'
import { BREWING_RECIPES } from '../src/game/skills/BrewingSkill.js'
import { SPICE_RECIPES } from '../src/game/skills/SpiceMixingSkill.js'
import { SMITHING_SET_RECIPES } from '../src/game/data/smithSetExt.js'
import { GATHERING_EXT, PRODUCTION_EXT, SMITHING_EXT, PRESERVE_EXT } from '../src/game/data/expansion1.js'
import { GATHERING_EXT2, PRODUCTION_EXT2, SMITHING_EXT2, PRESERVE_EXT2 } from '../src/game/data/expansion2.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
// 输出路径按脚本自身位置解析，避免「必须在仓库根目录运行」的隐性约束
const __OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/game/data')

const level = {}
const addLv = (id, lv) => { if (id != null && (level[id] == null || lv < level[id])) level[id] = lv }
for (const arr of [FORAGING_TARGETS, FISHING_TARGETS, HUNTING_TARGETS, EXCAVATION_TARGETS]) for (const t of arr) addLv(t.itemId, t.reqLevel)
for (const s of ['foraging','fishing','hunting','excavation']) { for (const t of GATHERING_EXT[s] ?? []) addLv(t.itemId, t.reqLevel); for (const t of GATHERING_EXT2[s] ?? []) addLv(t.itemId, t.reqLevel) }
for (const c of CROPS) addLv(c.itemId, c.reqLevel)
for (const r of [...COOKING_RECIPES, ...BAKING_RECIPES, ...PRESERVING_RECIPES, ...BREWING_RECIPES, ...SPICE_RECIPES]) if (r.output?.itemId) addLv(r.output.itemId, r.reqLevel)
for (const r of SMITHING_SET_RECIPES) if (r?.output?.itemId) addLv(r.output.itemId, r.reqLevel)
for (const arrLike of [SMITHING_EXT, SMITHING_EXT2]) { const arrs = Array.isArray(arrLike) ? arrLike : Object.values(arrLike ?? {}).flat(); for (const r of arrs) if (r?.output?.itemId) addLv(r.output.itemId, r.reqLevel) }
for (const d of [PRODUCTION_EXT, PRODUCTION_EXT2]) for (const arr of Object.values(d ?? {})) for (const r of (arr ?? [])) if (r?.output?.itemId) addLv(r.output.itemId, r.reqLevel)
for (const r of [...PRESERVE_EXT, ...PRESERVE_EXT2]) if (r?.output?.itemId) addLv(r.output.itemId, r.reqLevel)

const isMineral = (id) => { const it = ITEMS[id]; return it?.category === 'mineral' || /Ore|fossil|salt|矿/.test(id) }
const bucket = (lv) => Math.min(100, Math.floor(lv / 5) * 5)

// 装备池：按槽位分组，保证每级每槽有可掉装备
const eq = {}
const mat = {}
for (const [id, lv] of Object.entries(level)) {
  const it = ITEMS[id]
  if (!it) continue
  if (it.type === 'equipment') {
    const b = bucket(lv)
    const slot = it.slot ?? 'weapon'
    ;(eq[b] ??= {})[slot] ??= []
    eq[b][slot].push(id)
  } else if (!isMineral(id) && it.value != null) {
    const b = bucket(lv)
    ;(mat[b] ??= []).push(id)
  }
}
// 材料每段取去重后的代表（按插入序，去重名），最多 12
const MAT_POOL = {}
for (const b of Object.keys(mat).map(Number).sort((a,b)=>a-b)) {
  const ids = mat[b]
  const seen = new Set()
  const pick = []
  for (const id of ids) { const n = ITEMS[id]?.name; if (n && !seen.has(n)) { seen.add(n); pick.push(id) } if (pick.length >= 12) break }
  MAT_POOL[b] = pick
}
const EQUIP_POOL = {}
for (const b of Object.keys(eq).map(Number).sort((a,b)=>a-b)) {
  const s = eq[b]
  const o = {}
  for (const [slot, ids] of Object.entries(s)) o[slot] = ids
  EQUIP_POOL[b] = o
}

const js = (o) => JSON.stringify(o)
const ITEM_LEVEL = {}
const EQUIP_SLOT = {}
const LEGENDARY = []
for (const [id, it] of Object.entries(ITEMS)) {
  if (level[id] != null) ITEM_LEVEL[id] = level[id]
  if (it?.type === 'equipment') {
    EQUIP_SLOT[id] = it.slot
    if (it.quality === '传说' || it.quality === '神话') LEGENDARY.push(id)
  }
}
const LEGENDARY_LEVEL = {
  rollingPin: 60, taijiPot: 55, godKnife: 65, goldenWhisk: 55,
  molecularCooker: 70, eternalKnife: 90, darkPot: 80, godCrown: 95,
}
const file = `// 程序化生成：对决掉落定级池（每 5 级段的可用装备/材料 id）+ 物品等级/槽位索引 — 由 scripts/gen_combat_loot.mjs 生成，勿手改
export const EQUIP_POOL = ${js(EQUIP_POOL)}
export const MAT_POOL = ${js(MAT_POOL)}
export const ITEM_LEVEL = ${js(ITEM_LEVEL)}
export const EQUIP_SLOT = ${js(EQUIP_SLOT)}
export const LEGENDARY = ${js(LEGENDARY)}
export const LEGENDARY_LEVEL = ${js(LEGENDARY_LEVEL)}
`
writeFileSync(join(__OUT_DIR, 'combatLoot.js'), file, 'utf8')
console.log('combatLoot.js 已生成。装备池段数:', Object.keys(EQUIP_POOL).length, ' 材料池段数:', Object.keys(MAT_POOL).length, ' ITEM_LEVEL:', Object.keys(ITEM_LEVEL).length)
