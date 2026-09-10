// 生成“厨具锻造 × 挖掘”同名矿石 → src/game/data/smithOres.js（勿手改，改后重跑本脚本）
// 覆盖：钢→鎏金（段4-16，等级16-80）各套的“同名矿”，使锻造装备用与自己名字相关的矿制造。
// 每矿一个物品（type=ingredient, category=mineral，被 valueBalance 忽略）+ 一个挖掘目标（等级=套段首级，保证材料≤装备+5）。
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
// 输出路径按脚本自身位置解析，避免「必须在仓库根目录运行」的隐性约束
const __OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/game/data')

// [套前缀, 段号, 英文id, 中文名]
const ORES = [
  ['钢', 4, 'steelOre', '钢矿'],
  ['银', 5, 'silverOre', '银矿'],
  ['秘银', 6, 'mithrilOre', '秘银矿'],
  ['金', 7, 'goldOre', '金矿'],
  ['精金', 8, 'adamantOre', '精金矿'],
  ['水晶', 9, 'crystalOre', '水晶矿'],
  ['玄铁', 10, 'darkIronOre', '玄铁矿'],
  ['寒铁', 11, 'coldIronOre', '寒铁矿'],
  ['陨铁', 12, 'meteoriteOre', '陨铁矿'],
  ['星辰', 13, 'starOre', '星辰矿'],
  ['龙鳞', 14, 'dragonScaleOre', '龙鳞矿'],
  ['琉璃', 15, 'glassOre', '琉璃矿'],
  ['鎏金', 16, 'giltOre', '鎏金矿'],
]

const SMITH_ORES = {}
const SMITH_ORE_TARGETS = []
for (const [prefix, seg, id, name] of ORES) {
  const reqLevel = seg * 5 - 4 // 套段首级：钢16 … 鎏金76
  SMITH_ORES[id] = {
    id,
    name,
    type: 'ingredient',
    category: 'mineral',
    tier: Math.max(1, Math.ceil(reqLevel / 10)),
    value: Math.round(6 + seg * 8), // 矿，valueBalance 忽略，给随段递增的合理值
    stackable: true,
    maxStack: 9999,
  }
  SMITH_ORE_TARGETS.push({
    itemId: id,
    reqLevel,
    xpPerAction: 10 + reqLevel * 5, // 与 xpBalance 基准一致
    intervalSec: Math.round((3 + reqLevel * 0.04) * 10) / 10, // 随等级逐渐变慢
  })
}

const out = `// 厨具锻造同名矿（生成器产出，勿手改）— ${new Date().toISOString().slice(0, 10)}
// 覆盖：钢→鎏金（段4-16，等级16-80）各套同名矿的物品 + 挖掘目标。改后重跑 scripts/gen_smith_ores.mjs。
export const SMITH_ORES = ${JSON.stringify(SMITH_ORES, null, 1)}
export const SMITH_ORE_TARGETS = ${JSON.stringify(SMITH_ORE_TARGETS, null, 1)}
`

writeFileSync(join(__OUT_DIR, 'smithOres.js'), out, 'utf8')
console.log(`已生成 smithOres.js：矿石 ${Object.keys(SMITH_ORES).length}，挖掘目标 ${SMITH_ORE_TARGETS.length}`)
for (const t of SMITH_ORE_TARGETS) console.log(` ${t.itemId} lv${t.reqLevel}`)
