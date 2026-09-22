// 反例验证：精通池「禁用原因三分支」的 3 条断言（C49 的 ⑧-b）
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const F = join(root, 'src/components/MasteryPoolBar.vue')
const orig = readFileSync(F, 'utf8')

// 旧写法（两分支：有卡片就说「该卡已满精通」）——这正是线上核验抓到的假话
const OLD = "(!cardKey ? `先选一个${isCraft ? '配方' : '目标'}` : (need <= 0 ? '该卡已满精通' : '精通池是空的'))"
const NEW = "(cardKey ? '该卡已满精通' : `先选一个${isCraft ? '配方' : '目标'}`)"

if (!orig.includes(OLD)) {
  console.log('⚠ 锚点未找到 —— 组件已被改动？')
  process.exit(1)
}
writeFileSync(F, orig.replace(OLD, NEW), 'utf8')
let out = '', code = 0
try {
  out = execFileSync(process.execPath, ['scripts/ci/system_test.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
} catch (e) { code = e.status ?? 1; out = `${e.stdout ?? ''}${e.stderr ?? ''}` }
const fails = out.split('\n').filter((l) => l.startsWith('FAIL') && l.includes('精通池'))
writeFileSync(F, orig, 'utf8')

const back = execFileSync(process.execPath, ['scripts/ci/system_test.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
const clean = /失败 0/.test(back)
console.log(`${code !== 0 && fails.length >= 2 ? '✅' : '❌'} 注入「退回两分支」→ system_test exit=${code}，精通池 FAIL ${fails.length} 条`)
fails.slice(0, 3).forEach((l) => console.log('   ' + l))
console.log(`${clean ? '✅' : '❌'} 还原后全绿（${(back.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}）`)
process.exit(code !== 0 && fails.length >= 2 && clean ? 0 : 1)
