// 反例验证：美食奥义栏（C61）——逐个注入真缺陷 → 跑 system_test → 断言 FAIL 且点名 → 还原。
// 用法：node scripts/dev/verify_c61.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const P = (rel) => join(root, rel)

function inject(rel, from, to) {
  const orig = readFileSync(P(rel), 'utf8')
  const n = orig.split(from).length - 1
  if (n !== 1) throw new Error(`${rel} 锚点匹配 ${n} 次（期望 1）：${from.slice(0, 60)}`)
  writeFileSync(P(rel), orig.replace(from, to), 'utf8')
}

const PANEL = 'src/components/CombatPanel.vue'
const CSS = 'src/styles/main.css'

const CASES = [
  {
    name: '① 分类过滤写漏（只有攻击类 ⇒ 漏掉 12 条防御类）',
    rel: PANEL,
    from: "const COMBAT_CATEGORIES = ['攻击', '防御']", to: "const COMBAT_CATEGORIES = ['攻击']",
    expect: '按 category（攻击/防御）筛',
  },
  {
    name: '② 不过滤（采集类 7 条也塞进来）',
    rel: PANEL,
    from: 'return AOJIS.filter((a) => COMBAT_CATEGORIES.includes(a.category))',
    to: 'return AOJIS.filter(() => true)',
    expect: '不得',
  },
  {
    name: '③ 手写效果文案（不走奥义数据的 desc）',
    rel: PANEL,
    from: '<span v-if="a.on" class="dim aoji-desc">{{ a.desc }}</span>',
    to: '<span v-if="a.on" class="dim aoji-desc">伤害 +10%</span>',
    expect: '文案取自奥义数据',
  },
  {
    name: '④ 在这一栏加开关（制造第二个奥义入口，破坏「同一件事只留一个入口」）',
    rel: PANEL,
    from: 'function goGastronomy() {\n  player.setActiveSkill(\'gastronomy\')',
    to: 'function goGastronomy() {\n  player.gastronomy.active = [...player.gastronomy.active, \'godPower\']\n  player.setActiveSkill(\'gastronomy\')',
    expect: '只读参考',
  },
  {
    name: '⑤ 跳转丢掉 skill 子目标（只 setView ⇒ 会跳到当前在练的技能页）',
    rel: PANEL,
    from: "  player.setActiveSkill('gastronomy')\n  ui.setView('skill')",
    to: "  ui.setView('skill')",
    expect: '带 skill 子目标',
  },
  {
    name: '⑥ 组合框退回 3 列（第三栏宽度凭空消失 ⇒ 新栏被挤成 0 宽）',
    rel: CSS,
    from: '  grid-template-columns: 1fr 1px 1.4fr 1px 1.15fr;',
    to: '  grid-template-columns: 1fr 1px 1.4fr;',
    expect: '5 列网格',
  },
]

const run = () => {
  try {
    return { code: 0, out: execFileSync(process.execPath, ['scripts/ci/system_test.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }) }
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

const backups = new Map()
let okAll = true
for (const c of CASES) {
  if (!backups.has(c.rel)) backups.set(c.rel, readFileSync(P(c.rel), 'utf8'))
  try { inject(c.rel, c.from, c.to) } catch (e) { console.log(`⚠ ${c.name} —— 注入失败：${e.message}`); okAll = false; continue }
  const r = run()
  const hit = r.code !== 0 && r.out.includes('FAIL') && r.out.includes(c.expect)
  console.log(`${hit ? '✅' : '❌'} ${c.name} → ${r.code === 0 ? 'system_test 仍全绿（假绿！）' : 'FAIL'}，点名含「${c.expect}」= ${r.out.includes(c.expect)}`)
  if (!hit) {
    okAll = false
    console.log(r.out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 4).join('\n'))
  }
  writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
}
for (const [rel, content] of backups) writeFileSync(P(rel), content, 'utf8')

const back = run()
const clean = back.code === 0 && /失败 0/.test(back.out)
console.log(`${clean ? '✅' : '❌'} 还原后 system_test 全绿（${(back.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}）`)
console.log(okAll && clean ? `\n反例验证通过：${CASES.length} 个注入缺陷全部被点名，还原后恢复全绿` : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)
