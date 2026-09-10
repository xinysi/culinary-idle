// 生成“每套品质 8 槽、集中同一 5 级段”的锻造数据 → src/game/data/smithSetExt.js
// 16 套既有品质按稀有度分配到 16 段；新增 Lv81-100 四段用“命名匹配的高端矿”四套（钨/锰/钒/萤）。
// 材料等级：新增套用获取等级 ≤ 套段的高端矿（低套不用高材）；既有套沿用通用矿（允许高套用低材）。
import { writeFileSync } from 'node:fs'
import { SMITHING_RECIPES } from '../../src/game/skills/CraftsmithingSkill.js'
import { SMITHING_EXT } from '../../src/game/data/expansion1.js'
import { SMITHING_EXT2 } from '../../src/game/data/expansion2.js'
import { ITEMS } from '../../src/game/data/items.js'
import { equipTierFor, equipQualityFor } from '../../src/game/data/equipTierCurve.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
// 输出路径按脚本自身位置解析，避免「必须在仓库根目录运行」的隐性约束
const __OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../src/game/data')

const SLOT_CN = { weapon: '刀', offhand: '锅', body: '围裙', helmet: '厨师帽', amulet: '调味瓶', legs: '腿甲', boots: '靴子', ring: '戒指' }
const OFFSET = { weapon: 0, offhand: 1, body: 2, helmet: 3, amulet: 2, legs: 3, boots: 4, ring: 4 }
const SLOTS = ['weapon', 'offhand', 'body', 'helmet', 'amulet', 'legs', 'boots', 'ring']
// 20 套：既有 1-3（铜/铁/青铜）沿用通用矿；钢→鎏金（段4-16）用各自同名矿（同名矿由 gen_smith_ores.mjs 生成，挖掘可得）；
// 钨/锰/钒/萤（段17-20）用命名匹配的高端矿。矿石获取等级 ≤ 套段末。
const ORE = {
  tungsten: 'excavation_ext2_25', manganese: 'excavation_ext2_27', vanadium: 'excavation_ext2_28', fluorite: 'excavation_ext2_30',
  // 钢→鎏金（段4-16）同名矿（smithOres.js）
  steel: 'steelOre', silver: 'silverOre', mithril: 'mithrilOre', gold: 'goldOre', adamant: 'adamantOre', crystal: 'crystalOre',
  darkiron: 'darkIronOre', coldiron: 'coldIronOre', meteorite: 'meteoriteOre', star: 'starOre', dragonscale: 'dragonScaleOre',
  glass: 'glassOre', gilt: 'giltOre',
}
const SETS = [
  ['铜', 1], ['铁', 2], ['青铜', 3],
  ['钢', 4, ORE.steel], ['银', 5, ORE.silver], ['秘银', 6, ORE.mithril], ['金', 7, ORE.gold],
  ['精金', 8, ORE.adamant], ['水晶', 9, ORE.crystal], ['玄铁', 10, ORE.darkiron], ['寒铁', 11, ORE.coldiron],
  ['陨铁', 12, ORE.meteorite], ['星辰', 13, ORE.star], ['龙鳞', 14, ORE.dragonscale], ['琉璃', 15, ORE.glass],
  ['鎏金', 16, ORE.gilt],
  ['钨', 17, ORE.tungsten], ['锰', 18, ORE.manganese], ['钒', 19, ORE.vanadium], ['萤', 20, ORE.fluorite],
]

const raw = [...SMITHING_RECIPES, ...SMITHING_EXT, ...SMITHING_EXT2]
const base = {}
for (const r of raw) {
  for (const [p] of SETS) if (r.name && r.name.startsWith(p)) { (base[p] ??= []).push(r); break }
}

const outRecipes = []
const outItems = []
// 本脚本产出的生成件 id（smith_{套名}_{槽} / inip{矿名}_{槽}）：重跑时 ITEMS 里已含上次产物，
// 必须从「已用」集合中排除，否则补槽件会被判为「已存在」而静默丢弃（自引用污染，曾丢 168 件）。
const isPrevOutput = (id) => /^smith_/.test(id) || /^inip/.test(id)
// 品牌名牌（非生成件）不可重名；生成件会被本次重新产出，不纳入
const usedNames = new Set(Object.values(ITEMS).filter((i) => !isPrevOutput(i.id)).map((i) => i.name))

SETS.forEach(([prefix, seg, ore], idx) => {
  const baseLv = (seg - 1) * 5 + 1
  const existing = base[prefix] ?? []
  const haveSlots = new Set(existing.map((r) => ITEMS[r.output?.itemId]?.slot))
  const allSlots = new Set(SLOTS)
  // 既有件：reqLevel 重设到段内（保留原材料；balance 后删低套高材）
  for (const r of existing) {
    const it = ITEMS[r.output?.itemId]
    const slot = it?.slot
    const lv = Math.min(baseLv + (OFFSET[slot] ?? 0), seg * 5)
    // 灵果(spiritFruit)/松露(truffle) 是较高阶材料（约 90/60 级获取），低中段锻造装备不该用 → 从生成件材料移除，避免超纲
    let ing = Object.fromEntries(Object.entries(r.ingredients ?? {}).filter(([k]) => k !== 'spiritFruit' && k !== 'truffle'))
    // 钢→鎏金等套有同名矿：把通用铁矿石换成该套同名矿（保留盐矿/木材，数量不变）
    if (ore) {
      const ironQty = ing.ironOre
      if (ironQty) {
        delete ing.ironOre
        ing[ore] = (ing[ore] ?? 0) + ironQty
      }
    }
    outRecipes.push({ ...r, ingredients: ing, reqLevel: lv, id: `${prefix}-${slot}-${r.id}` })
  }
  // 补齐/全量生成缺失槽（新套无现有件 → 生成全部；命名=前缀+槽位名，无后缀）
  const missing = [...allSlots].filter((s) => !haveSlots.has(s))
  for (const slot of missing) {
    const lv = Math.min(baseLv + (OFFSET[slot] ?? 0), seg * 5)
    const itemId = `smith_${prefix}_${slot}`
    let name = `${prefix}${SLOT_CN[slot]}`
    if (usedNames.has(name)) name = `${prefix}${SLOT_CN[slot]}（锻）` // 兜底，应不触发
    usedNames.add(name)
    // 材料：新套用命名匹配高端矿；既有套补齐件用通用铁/盐矿（允许高套用低材）
    const ingredients = ore
      ? { [ore]: 2 + Math.floor(seg / 5), saltOre: 1 + Math.floor(seg / 6) }
      : { ironOre: 2 + Math.floor(seg / 3), saltOre: 1 + Math.floor(seg / 6) }
    outRecipes.push({
      id: `smith_set_${prefix}_${slot}`,
      name,
      category: SLOT_CN[slot],
      reqLevel: lv,
      xp: 20 + seg * 8,
      successChance: Math.max(0.6, 0.95 - seg * 0.01),
      ingredients,
      output: { itemId, qty: 1 },
    })
    const stats = slot === 'weapon' || slot === 'ring' ? { attack: 1 } : { defense: 1 }
    outItems.push({
      id: itemId, name, type: 'equipment', category: slot, tier: equipTierFor(lv),
      value: 30 + seg * 30, stackable: false, slot, quality: equipQualityFor(lv), stats,
    })
  }
})

// ── 保留“不归套”的独立饰品/护符配方（名字不以套名开头，否则 gen 会丢失，如紫水晶戒指/锡护符）──
// 同时为每种矿补齐“完整 8 槽”厨具套（刀/锅/砧板/围裙/厨师帽/护符/腿甲/靴子/戒指），沿用现有件命名。
const orphanRaw = raw.filter((r) => !SETS.some(([p]) => r.name?.startsWith(p)))
// 9 件成品槽：weapon/offhand(锅+砧板)/body/helmet/amulet(护符)/legs/boots/ring
const INDIE_SLOTS = [
  ['weapon', '刀', 'weapon'],
  ['offhand', '锅', 'offhand'],
  ['offhand', '砧板', 'offhand'],
  ['body', '围裙', 'body'],
  ['helmet', '厨师帽', 'helmet'],
  ['amulet', '护符', 'amulet'],
  ['legs', '腿甲', 'legs'],
  ['boots', '靴子', 'boots'],
  ['ring', '戒指', 'ring'],
]
const USED_IDS = new Set(Object.keys(ITEMS).filter((id) => !isPrevOutput(id)))
for (const r of orphanRaw) {
  const outIt = ITEMS[r.output?.itemId]
  const existSlot = outIt?.slot ?? 'ring'
  const quality = outIt?.quality ?? '精良'
  // 保留原配方（物品已存在）
  outRecipes.push({ ...r, id: `ext-${r.id}` })
  const oreId = Object.keys(r.ingredients ?? {}).find((k) => k !== 'saltOre')
  if (!oreId) continue
  // 名字头（沿用现有件名词头：紫水晶/锡/石膏…）
  const head = r.name.replace(/戒指$|护符$/, '')
  const stem = r.output.itemId.replace(/Ring$|Amulet$/, '')
  const lv = r.reqLevel
  for (const [slotEn, slotCn, realSlot] of INDIE_SLOTS) {
    // 该矿现有件已占的那槽（戒指/护符）跳过，其余补齐
    if ((existSlot === 'amulet' && slotCn === '护符') || (existSlot === 'ring' && slotCn === '戒指')) continue
    const suffix = slotCn === '砧板' ? 'Board' : slotCn === '锅' ? 'Pot' : slotEn[0].toUpperCase() + slotEn.slice(1)
    const newItemId = `inip${stem}_${suffix}`
    const newName = head + slotCn
    if (usedNames.has(newName) || USED_IDS.has(newItemId)) { console.warn('跳过补槽（已存在/重名）', newName, newItemId); continue }
    usedNames.add(newName)
    USED_IDS.add(newItemId)
    outRecipes.push({
      id: `ext-${newItemId}`,
      name: newName,
      category: slotCn,
      reqLevel: lv,
      xp: r.xp,
      successChance: r.successChance,
      ingredients: { [oreId]: 2, saltOre: 1 },
      output: { itemId: newItemId, qty: 1 },
    })
    outItems.push({
      id: newItemId, name: newName, type: 'equipment', category: realSlot, tier: equipTierFor(lv),
      value: 30 + Math.ceil(lv / 10) * 30, stackable: false, slot: realSlot, quality,
      stats: realSlot === 'weapon' || realSlot === 'offhand' || realSlot === 'ring' ? { attack: 1 } : { defense: 1 },
    })
  }
}

// 头注释必须由生成器写出，否则重跑会被抹掉
// ⚠️ 自引用防护（2026-09-10）：items.js 已合并上次的 SMITHING_SET_ITEMS，
//    不清空 src/game/data/smithSetExt.js 就重跑，全部条目会因「已存在/重名」被跳过。
if (!outRecipes.length || !outItems.length) {
  console.error('❌ 生成了 0 条配方/装备——极可能是自引用污染：请先把 smithSetExt.js 的')
  console.error('   两个导出清空（SMITHING_SET_RECIPES = [] / SMITHING_SET_ITEMS = []）后再重跑。已中止。')
  process.exit(1)
}

const HEADER = `// 厨具锻造品质套 + 独立矿套（生成器产出，勿手改）
// 覆盖：20 品质套 + 21 独立矿套，每套 8 槽（刀/锅/砧板/围裙/厨师帽/调味瓶/腿甲/靴子），
//       21 独立矿套另含手写的戒指/护符，共 9 件。
// 改后重跑：node scripts/gen/gen_smith_sets.mjs
// ⚠️ 重跑前必须先清空本文件的两个导出（置 []）——生成器会 import ITEMS，
//    而 ITEMS 已合并上次的产物，不清空会因「已存在/重名」跳过全部条目（自引用污染）。
`
const recipesJs = `export const SMITHING_SET_RECIPES = ${JSON.stringify(outRecipes, null, 1)}\n`
const itemsJs = `export const SMITHING_SET_ITEMS = ${JSON.stringify(outItems, null, 1)}\n`
writeFileSync(join(__OUT_DIR, 'smithSetExt.js'), HEADER + recipesJs + itemsJs, 'utf8')
console.log(`配方=${outRecipes.length} 物品=${outItems.length}`)
