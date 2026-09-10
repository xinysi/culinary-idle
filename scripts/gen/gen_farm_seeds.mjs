// 生成“农耕种子扩充”数据 → src/game/data/farmSeeds.js（勿手改，改后重跑本脚本）
// 覆盖：所有可采集/可挖掘（采摘 foraging + 挖掘 excavation，含 expansion1/2 与嫩食材）的**非矿物**食材，
// 为每一个生成种子物品 + 农耕作物条目（可种），并提供 itemId→seedId 映射与商店种子条目。
// - 种子不配图片（前端 itemImage 返回空 URL 由 @error 隐藏）。
// - 种子 reqLevel = 对应食材采集 reqLevel；growSec/xp 按等级曲线生成。
// - 种子 value ≈ 食材 value × 0.6；商店价格 ≈ 种子 value × 0.5（与既有 wheatSeed value10/price5 一致量级）。
import { writeFileSync } from 'node:fs'
import { FORAGING_TARGETS } from '../../src/game/skills/ForagingSkill.js'
import { EXCAVATION_TARGETS } from '../../src/game/skills/ExcavationSkill.js'
import { GATHERING_EXT } from '../../src/game/data/expansion1.js'
import { GATHERING_EXT2 } from '../../src/game/data/expansion2.js'
import { FRESH_TARGETS } from '../../src/game/data/freshMats.js'
import { ITEMS } from '../../src/game/data/items.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
// 输出路径按脚本自身位置解析，避免「必须在仓库根目录运行」的隐性约束
const __OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../src/game/data')

// 既有的 15 种手写作物（FarmingSkill 基线），其种子已在 items.js；生成器不读取合并后的 CROPS，
// 避免重跑时把已生成作物当作「已有」导致 FARM_CROPS 清空。
const BASE_CROP_ITEM_IDS = new Set(['wheat', 'rice', 'corn', 'cabbage', 'chili', 'peppercorn', 'eggplant', 'starAnise', 'pumpkin', 'cassia', 'vanilla', 'basil', 'rosemary', 'saffron', 'dragonPepper'])

// 采集/挖掘目标汇总（含核心 + expansion1/2 + 嫩食材）
const collect = []
const push = (arr) => { for (const t of arr) collect.push(t) }
push(FORAGING_TARGETS)
push(EXCAVATION_TARGETS)
push(GATHERING_EXT.foraging ?? [])
push(GATHERING_EXT.excavation ?? [])
push(GATHERING_EXT2.foraging ?? [])
push(GATHERING_EXT2.excavation ?? [])
push(FRESH_TARGETS.foraging ?? [])

const isMineral = (t) => {
  const it = ITEMS[t.itemId]
  const nm = it?.name ?? ''
  return it?.category === 'mineral' || /矿|Ore|fossil/.test(nm) || /矿|Ore|fossil/.test(t.itemId)
}

// 去重并排除矿物
const seen = new Set()
const targets = []
for (const t of collect) {
  if (seen.has(t.itemId) || isMineral(t)) continue
  seen.add(t.itemId)
  targets.push(t)
}
// 按 reqLevel 排序（农耕可种列表按等级展示）
targets.sort((a, b) => a.reqLevel - b.reqLevel)

const seedValue = (itemId) => {
  const it = ITEMS[itemId]
  const v = it?.value ?? 1
  return Math.max(1, Math.round(v * 0.6))
}
const seedPrice = (v) => Math.max(1, Math.round(v * 0.5))
const seedTier = (reqLevel) => Math.max(1, Math.ceil(reqLevel / 10))

const FARM_SEEDS = {}
const FARM_CROPS = []
const SEED_MAP = {}
const SHOP_SEED_ENTRIES = []

// 避免与既有 15 个 CROPS / 既有物品 / 刚生成的重复
const cropSet = BASE_CROP_ITEM_IDS
const itemSet = new Set(Object.keys(ITEMS))

for (const t of targets) {
  const itemId = t.itemId
  const it = ITEMS[itemId]
  if (!it) { console.warn('跳过未知物品', itemId); continue }
  if (cropSet.has(itemId)) { console.warn('已有作物（跳过）', itemId); continue }
  const seedId = `${itemId}Seed`
  if (itemSet.has(seedId)) { console.warn('种子 id 冲突（跳过）', seedId); continue }
  const lv = t.reqLevel
  const growSec = Math.round(90 + lv * 10)
  const xp = Math.round(25 + lv * 7.5)
  const sv = seedValue(itemId)
  const sp = seedPrice(sv)

  FARM_SEEDS[seedId] = {
    id: seedId,
    name: `${it.name}种子`,
    type: 'seed',
    category: '种植产物',
    tier: seedTier(lv),
    value: sv,
    stackable: true,
    maxStack: 9999,
  }
  FARM_CROPS.push({ itemId, seedId, reqLevel: lv, growSec, xp })
  SEED_MAP[itemId] = seedId
  SHOP_SEED_ENTRIES.push({ itemId: seedId, price: sp })
  cropSet.add(itemId)
  itemSet.add(seedId)
}

// ⚠️ 自引用防护（2026-09-10 实测踩坑）：items.js 已合并上次的 FARM_SEEDS，
//    若不清空 src/game/data/farmSeeds.js 就重跑，每个种子 id 都会「已存在」被跳过 → 产物被清空。
if (!Object.keys(FARM_SEEDS).length || !FARM_CROPS.length) {
  console.error('❌ 生成了 0 个种子/作物——极可能是自引用污染：请先把 src/game/data/farmSeeds.js')
  console.error('   的两个导出清空（FARM_SEEDS = {} / FARM_CROPS = []）后再重跑本脚本。已中止，未写出文件。')
  process.exit(1)
}

const out = `// 农耕种子扩充（生成器产出，勿手改）— ${new Date().toISOString().slice(0, 10)}
// 覆盖：所有可采集/可挖掘非矿物食材的种子与农耕作物条目。改后重跑 scripts/gen/gen_farm_seeds.mjs。
export const FARM_SEEDS = ${JSON.stringify(FARM_SEEDS, null, 1)}
export const FARM_CROPS = ${JSON.stringify(FARM_CROPS, null, 1)}
export const SEED_MAP = ${JSON.stringify(SEED_MAP, null, 1)}
export const SHOP_SEED_ENTRIES = ${JSON.stringify(SHOP_SEED_ENTRIES, null, 1)}
`

writeFileSync(join(__OUT_DIR, 'farmSeeds.js'), out, 'utf8')
console.log(`已生成 farmSeeds.js：种子 ${Object.keys(FARM_SEEDS).length}，作物 ${FARM_CROPS.length}，SEED_MAP ${Object.keys(SEED_MAP).length}，商店条目 ${SHOP_SEED_ENTRIES.length}`)
