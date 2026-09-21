// 反例验证（临时脚本，跑完即删）：逐一注入缺陷，断言 C53 两组守卫确实会 FAIL。
// 用法：node scripts/dev/verify_c53.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('../../', import.meta.url)
const ROOT_DIR = fileURLToPath(ROOT)
const p = (rel) => new URL(`src/${rel}`, ROOT)
const NODE = fileURLToPath(new URL('wuguan/.toolchain/node/node.exe', ROOT))

const cases = [
  ['A 去掉经验阻尼（改回原始乘积）', 'game/skills/Skill.js',
    'const expMult = dampXpStack(prestigeMult * tonicMult * growthMult * catchup * marketMult)',
    'const expMult = (prestigeMult * tonicMult * growthMult * catchup * marketMult)'],
  ['B 材料系数改成 1（等于没加材料）', 'game/data/materialCost.js',
    'export const MATERIAL_COST_MULT = 2', 'export const MATERIAL_COST_MULT = 1'],
  ['C 副业产物价值读原始数量', 'game/data/valueBalance.js',
    'if (it) it.value = sumOf(effIngredients(r))', 'if (it) it.value = sumOf(r.ingredients)'],
  ['D 制作页材料显示读原始数量', 'views/ProductionView.vue',
    'v-for="(qty, itemId) in effIngredients(r)"', 'v-for="(qty, itemId) in r.ingredients"'],
  ['E 图鉴「可用于制作」读原始数量', 'game/data/itemUses.js',
    'const qty = effIngredients(r)[itemId]', 'const qty = r.ingredients?.[itemId]'],
]

const run = () => {
  try {
    return execFileSync(NODE, ['scripts/ci/system_test.mjs'], { cwd: ROOT_DIR, encoding: 'utf8', maxBuffer: 1 << 28 })
  } catch (e) {
    return (e.stdout ?? '') + (e.stderr ?? '')
  }
}

for (const [name, rel, from, to] of cases) {
  const f = p(rel)
  const orig = readFileSync(f, 'utf8')
  if (!orig.includes(from)) { console.log(`!! ${name}：锚点未找到，跳过`); continue }
  writeFileSync(f, orig.replace(from, to), 'utf8')
  const out = run()
  writeFileSync(f, orig, 'utf8') // 立刻还原
  const fails = out.split('\n').filter((l) => l.startsWith('FAIL'))
  console.log(`\n=== ${name} → FAIL ${fails.length} 条（输出 ${out.length} 字节）`)
  for (const l of fails.slice(0, 6)) console.log('   ' + l.trim().slice(0, 150))
  if (!fails.length) console.log('   🔴 没有 FAIL —— 守卫是假绿！尾部输出：\n' + out.split('\n').slice(-6).join('\n'))
}
