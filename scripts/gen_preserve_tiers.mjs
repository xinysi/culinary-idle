// 生成保鲜/增益剂 5 阶级：3 系列 × 5 阶级 = 15 物品/配方。
// 每系列（保鲜剂/经验增益剂/产量增益剂）× 5 阶级（Ⅰ~Ⅴ），覆盖 1~99 连续等级段。
// 产物：src/game/data/preserveTiers.js（PRESERVE_TIER_ITEMS / PRESERVE_TIER_RECIPES / PRESERV_TIER_META）
// 阶级等级段（同食灵）：Ⅰ=1~19, Ⅱ=20~39, Ⅲ=40~59, Ⅳ=60~79, Ⅴ=80~99。
// 契约材料（食灵阶级规则）：低阶通用 盐矿/稻米，数量随 reqLevel 递增；材料锚≈低阶，满足 balanceRecipeLevels 不抬等级。
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
// 输出路径按脚本自身位置解析，避免「必须在仓库根目录运行」的隐性约束
const __OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/game/data')

const TIERS = [
  { n: 1, roman: 'Ⅰ', lo: 1, hi: 19, req: 5 },
  { n: 2, roman: 'Ⅱ', lo: 20, hi: 39, req: 25 },
  { n: 3, roman: 'Ⅲ', lo: 40, hi: 59, req: 45 },
  { n: 4, roman: 'Ⅳ', lo: 60, hi: 79, req: 65 },
  { n: 5, roman: 'Ⅴ', lo: 80, hi: 99, req: 85 },
]

// 3 系列：id 前缀, 物品名, 分类(category), 数值曲线(按 req 返回), use 字段名
// 数值全部随 reqLevel 严格单调递增
const SERIES = [
  {
    key: 'preserv', itemPrefix: 'preservTier', recipePrefix: 'preservRecipe',
    name: '保鲜剂', category: '保鲜',
    image: 'images/items/tool/保鲜剂.png',
    useKey: 'refreshSpoilMs',
    // 每阶级保鲜天数：Ⅰ=1天 Ⅱ=4天 Ⅲ=9天 Ⅳ=16天 Ⅴ=30天
    val: (req, t) => ({ refreshSpoilMs: t.n * t.n * 24 * 3600 * 1000 }), // 阶级号² 天
  },
  {
    key: 'xp', itemPrefix: 'xpTonic', recipePrefix: 'xpRecipe',
    name: '经验增益剂', category: '增益',
    image: 'images/items/tool/经验增益剂.png',
    useKey: 'buffXp',
    val: (req, t) => ({ buffXp: { mult: [1.2, 2, 2.8, 3.6, 4.5][t.n - 1], minutes: [30, 75, 110, 150, 195][t.n - 1] } }),
  },
  {
    key: 'yield', itemPrefix: 'yieldTonic', recipePrefix: 'yieldRecipe',
    name: '产量增益剂', category: '增益',
    image: 'images/items/tool/产量增益剂.png',
    useKey: 'buffYield',
    val: (req, t) => ({ buffYield: { mult: [1.5, 2.2, 3, 3.8, 4.5][t.n - 1], minutes: [30, 75, 110, 150, 195][t.n - 1] } }),
  },
]

function contract(req) {
  return { saltOre: 3 + Math.floor(req / 8), rice: 5 + Math.floor(req / 5) }
}

const ITEMS = []
const RECIPES = []
const META = {}
let idx = 0
for (const s of SERIES) {
  for (const t of TIERS) {
    idx++
    const itemId = `${s.itemPrefix}${t.n}`
    const recipeId = `${s.recipePrefix}${t.n}`
    const itemName = `${s.name}·${t.roman}`
    const req = t.req
    const use = s.val(req, t)
    const tier = t.n
    const value = Math.round(40 + req * 3) // 交给 valueBalance 再夹
    ITEMS.push({ id: itemId, name: itemName, type: 'consumable', category: 'buff', tier, value, use, image: s.image })
    const chance = Math.max(0.6, 0.9 - (t.n - 1) * 0.06)
    const xp = 25 + req * 13 // 交给 xpBalance 再抬
    RECIPES.push({
      id: recipeId, name: itemName, category: s.category, reqLevel: req, xp,
      successChance: Math.round(chance * 100) / 100,
      ingredients: contract(req), output: { itemId, qty: 1 },
    })
    META[itemId] = { series: s.key, name: s.name, tier: t.n, roman: t.roman, reqLevel: req }
  }
}

const itemsJs = ITEMS.map((it) =>
  `  { id: '${it.id}', name: '${it.name}', type: 'consumable', category: 'buff', tier: ${it.tier}, value: ${it.value}, use: ${JSON.stringify(it.use)}, image: '${it.image}' },`
).join('\n')
const recJs = RECIPES.map((r) =>
  `  { id: '${r.id}', name: '${r.name}', category: '${r.category}', reqLevel: ${r.reqLevel}, xp: ${r.xp}, successChance: ${r.successChance}, ingredients: ${JSON.stringify(r.ingredients)}, output: { itemId: '${r.output.itemId}', qty: 1 } },`
).join('\n')
const metaJs = JSON.stringify(META, null, 1)

const outText = `// 保鲜/增益剂 5 阶级（3 系列 × 5 阶级 = 15）— 生成器 gen_preserve_tiers.mjs 产出，勿手改。
// 每系列（保鲜剂/经验增益剂/产量增益剂）× 5 阶级（Ⅰ~Ⅴ），覆盖 lv 1~99 连续等级段；
// 契约材料用低阶通用 盐矿/稻米（食灵阶级规则），buff 数值随 reqLevel 单调递增。
export const PRESERVE_TIER_ITEMS = [
${itemsJs}
]
export const PRESERVE_TIER_RECIPES = [
${recJs}
]
export const PRESERV_TIER_META = ${metaJs}
`
fs.writeFileSync(join(__OUT_DIR, 'preserveTiers.js'), outText, 'utf-8')
console.log('已生成 preserveTiers.js，物品数:', ITEMS.length, '配方数:', RECIPES.length)
const lv = ITEMS.map((i) => i.id)
console.log('物品:', lv.join(', '))
