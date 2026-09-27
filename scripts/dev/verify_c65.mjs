// 反例验证：C64 的折叠/开关语义 + C65 的觅珍按钮配色（2026-09-27 用户两条反馈）。
// 用法：node scripts/dev/verify_c65.mjs   （每例跑一遍 system_test，约 25 秒；共 6 例 ⇒ 约 3 分钟）
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

const CASES = [
  {
    name: '① 折叠按钮删掉（用户要的功能没了）',
    rel: 'src/components/FeatureRail.vue',
    from: 'class="fr-btn fr-fold"',
    to: 'class="fr-btn fr-fold-x"',
    expect: '折叠为仅图标',
  },
  {
    name: '② 折叠态只改宽度、名字没藏（图标栏里塞着文字会溢出）',
    rel: 'src/components/FeatureRail.vue',
    from: '.feature-rail--mini .fr-name,',
    to: '.feature-rail--zh-name,',
    expect: '名字藏起来',
  },
  {
    name: '③ 折叠偏好不落存档（刷新就弹回展开态）',
    rel: 'src/components/FeatureRail.vue',
    from: "get: () => !!player.settings?.railIcons,",
    to: 'get: () => false,',
    expect: '折叠偏好进存档',
  },
  {
    name: '④ 开关语义退回只看 featureCat（「状态还在、界面没显示」时点一下变成关掉）',
    rel: 'src/components/Sidebar.vue',
    from: 'if (ui.featureCat === g.id && ui.railShown) { ui.closeFeatureCat(); return }',
    to: 'if (ui.featureCat === g.id) { ui.closeFeatureCat(); return }',
    expect: '界面真值',
  },
  {
    name: '⑤ 觅珍模拟按钮退回品牌主色（用户报的「混进红色」原样复现）',
    rel: 'src/views/MijianView.vue',
    from: '  background-color: var(--tlo2, #06483a);',
    to: '  background-color: var(--primary-strong);',
    expect: '池主题',
  },
  {
    name: '⑥ 觅珍按钮改用「亮档 + 深彩字」（好看但五池里有四池对比度不达标）',
    rel: 'src/views/MijianView.vue',
    from: '  background-color: var(--tlo2, #06483a);\n  background-image: linear-gradient(105deg, var(--tlo1, #0a6b55), var(--tlo2, #06483a));',
    to: '  background-color: var(--thi2, #16ad8a);\n  background-image: linear-gradient(105deg, var(--thi1, #35e8c0), var(--thi2, #16ad8a));\n  color: var(--tth, #0b5c4a);',
    expect: '≥4.5:1',
  },
]

function run() {
  try {
    const out = execFileSync(process.execPath, ['scripts/ci/system_test.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') }
  }
}

const backups = new Map()
let okAll = true
console.log('基线下先跑一次（应当全绿）…')
const base = run()
console.log(`${base.code === 0 && /失败 0/.test(base.out) ? '✅' : '❌'} 基线：${(base.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}`)
if (base.code !== 0) okAll = false

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
