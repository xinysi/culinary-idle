// 数据同步探针（2026-09-27 用户问「保鲜预览里没看到新增的？检查数据同步」后立的）
//
// 用途：**新增制作类内容后**跑一遍，确认它真的流到了各处消费方。查三件事：
//   ① 每条配方产物在**图鉴来源串**里都能找到「同技能 + 同等级」的那一条
//      （漏了就说明这条配方只并进了技能实例，没并进被 `itemSources` import 的那张表）；
//   ② 新增的 3 件腌制品在三张表里都在：配方表本身 / 技能实例 / `ITEM_LEVEL`（战斗掉落等级表）；
//   ③ 价值平衡之后，新产物的 value 落在「该等级 ±30% 带」内（不被写死占位值卡住）。
// 用法：node scripts/dev/data_sync_probe.mjs
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getAllSkillInstances } from '../../src/game/skills/registry.js'
import { itemSources } from '../../src/game/data/itemSources.js'
import { ITEM_LEVEL } from '../../src/game/data/combatLoot.js'
import { getItem } from '../../src/game/data/items.js'
import { PRESERVING_RECIPES } from '../../src/game/skills/PreservingSkill.js'
import { applyItemBalance } from '../../src/game/data/itemBalance.js'
import { applyValueBalance } from '../../src/game/data/valueBalance.js'

const NAME = { cooking: '烹饪制作', baking: '烘焙制作', preserving: '腌制制作', brewing: '调酒制作', spiceMixing: '调料调配', craftsmithing: '厨具锻造', preservation: '食材保鲜制作' }
const NEW = ['pickledMushroom', 'pickledLotusRoot', 'driedFungus']

setActivePinia(createPinia())
const p = usePlayerStore()
p.newGame()
createSkillInstances(p)

// ① 图鉴来源串 vs 配方卡等级
let total = 0
const miss = []
const wrong = []
for (const inst of getAllSkillInstances()) {
  if (!inst.recipes?.length || !NAME[inst.id]) continue
  for (const r of inst.recipes) {
    const out = r.output?.itemId
    if (!out) continue
    total++
    const pool = (itemSources(out) ?? []).filter((x) => x.startsWith(NAME[inst.id]))
    if (!pool.length) { miss.push(`${inst.id}/${r.name}`); continue }
    if (!pool.some((x) => Number(x.match(/Lv(\d+)/)?.[1]) === r.reqLevel)) wrong.push(`${inst.id}/${r.name} 卡片 Lv${r.reqLevel} → ${pool.join('|')}`)
  }
}
console.log(`① 图鉴来源：核对 ${total} 条配方产物 · 缺来源 ${miss.length} · 等级不符 ${wrong.length}`)
for (const x of miss.slice(0, 5)) console.log('   缺：', x)
for (const x of wrong.slice(0, 5)) console.log('   等级不符：', x)

// ② 新增 3 件是否三处齐备
const skill = getAllSkillInstances().find((i) => i.id === 'preserving')
const rows = NEW.map((id) => ({
  id,
  配方表: PRESERVING_RECIPES.some((r) => r.output?.itemId === id),
  技能实例: skill.recipes.some((r) => r.output?.itemId === id),
  ITEM_LEVEL: ITEM_LEVEL[id] ?? null,
}))
console.log('② 新增腌制品三处齐备：')
for (const r of rows) console.log('   ', r.id.padEnd(16), JSON.stringify(r))

// ③ 价值落在等级带内
applyItemBalance()
applyValueBalance()
console.log('③ 平衡后的价值（该级曲线 2+等级×2.5，夹 ±30%）：')
for (const id of NEW) {
  const r = skill.recipes.find((x) => x.output?.itemId === id)
  const it = getItem(id)
  const curve = 2 + r.reqLevel * 2.5
  const lo = Math.round(curve * 0.7)
  const hi = Math.round(curve * 1.3)
  const ok = it.value >= lo && it.value <= hi
  console.log(`    ${it.name.padEnd(4)} Lv${String(r.reqLevel).padStart(2)} value=${String(it.value).padStart(3)} 带 ${lo}~${hi} ${ok ? '✅' : '❌ 越界'}`)
}

const bad = miss.length + wrong.length + rows.filter((r) => !r.配方表 || !r.技能实例 || r.ITEM_LEVEL == null).length
console.log(bad === 0 ? '\n数据同步 OK ✅' : `\n数据同步有问题（${bad} 处）❌`)
process.exit(bad === 0 ? 0 : 1)
