// 反例验证：模板绑定审计（scripts/ci/template_binding_audit.mjs）
// 逐个注入真缺陷 → 跑审计 → 断言 FAIL 且点名 → 还原 → 末尾断言全绿。
// 用法：node scripts/dev/verify_template_guard.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const TARGET = 'src/views/ProductionView.vue'
const path = join(root, TARGET)
const orig = readFileSync(path, 'utf8')

const runAudit = () => {
  try {
    const out = execFileSync(process.execPath, [join(root, 'scripts/ci/template_binding_audit.mjs')], { cwd: root, encoding: 'utf8' })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

const cases = [
  {
    name: '① 模板用了但未声明的标识符（原缺陷：精通池 queueHeadId 的同类）',
    apply: (s) => s.replace("const headTitle = '配方列表'", "const headTitle_UNUSED = '配方列表'"),
    expect: 'headTitle',
  },
  {
    name: '② v-if 与 v-for 写在同一个元素上（原缺陷：CardBattleView 占位卡）',
    apply: (s) => s.replace('v-for="r in activeSec.list"', 'v-for="r in activeSec.list" v-if="!!r"'),
    expect: 'v-if',
  },
]

let allGood = true
for (const c of cases) {
  const injected = c.apply(orig)
  if (injected === orig) { console.log(`⚠ ${c.name} —— 注入失败（锚点没匹配上），本用例无效`); allGood = false; continue }
  writeFileSync(path, injected, 'utf8')
  const r = runAudit()
  const hit = r.code !== 0 && r.out.includes('FAIL') && r.out.includes(c.expect)
  console.log(`${hit ? '✅' : '❌'} ${c.name} → 审计 ${r.code === 0 ? 'PASS（假绿！）' : 'FAIL'}，点名含「${c.expect}」= ${r.out.includes(c.expect)}`)
  if (!hit) { allGood = false; console.log(r.out.split('\n').filter((l) => l.startsWith('FAIL')).join('\n')) }
  writeFileSync(path, orig, 'utf8')
}

const back = runAudit()
const clean = back.code === 0 && back.out.includes('失败 0')
console.log(`${clean ? '✅' : '❌'} 还原后审计全绿（失败 0）`)
console.log(allGood && clean ? '\n反例验证通过：注入的 2 个缺陷都被点名，还原后恢复全绿' : '\n反例验证失败，请检查上面的输出')
process.exit(allGood && clean ? 0 : 1)
