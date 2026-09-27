// 反例验证：C64「大类按钮 + 主区左导航/右内容工作区」（2026-09-27 用户⑳ 第二轮）。
// 用法：node scripts/dev/verify_c64.mjs     （每例跑一遍 system_test，约 25 秒；共 7 例 ⇒ 约 3 分钟）
//
// 为什么这一块特别需要反例：它的断言大多是**静态读源码**（「浮层已删」「两栏的类名在」「断点一致」…），
// 而这类断言最容易被**注释**、**顺序**、**名字相近的写法**骗过 —— 每条都注入一次，看它是不是真的会红。
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
    name: '① 浮层借尸还魂（Sidebar 里又出现 feature-flyout 的用法）',
    rel: 'src/components/Sidebar.vue',
    from: '<nav v-show="sideTab === \'features\'" class="feature-nav">',
    to: '<Teleport to="body"><div class="feature-flyout"></div></Teleport>\n    <nav v-show="sideTab === \'features\'" class="feature-nav">',
    expect: '浮层那套已彻底移除',
  },
  {
    name: '② 两栏的类名丢了（主内容区不再加 main-scroll--rail）',
    rel: 'src/App.vue',
    from: "'main-scroll--rail': catRailOn",
    to: "'main-scroll--rail-x': catRailOn",
    expect: '主区是「左导航 + 右内容」两栏',
  },
  {
    name: '③ 导航栏挂到分派链之后（内容在左、导航在右 —— 与用户的「左边显示导航」相反）',
    rel: 'src/App.vue',
    from: '          <FeatureRail v-if="catRailOn" />\n',
    to: '',
    expect: '主区是「左导航 + 右内容」两栏',
  },
  {
    name: '④ 导航栏自己渲染内容（绕过 App.vue 的分派链 ⇒ 会出现两套页面渲染）',
    rel: 'src/components/FeatureRail.vue',
    from: '    <p v-if="!items.length" class="dim fr-empty">',
    to: '    <ShopView v-if="false" />\n    <p v-if="!items.length" class="dim fr-empty">',
    expect: '不是自己渲染内容',
  },
  {
    name: '⑤ 离开本大类不再自动收起（导航栏会长久占位、高亮与内容对不上）',
    rel: 'src/App.vue',
    from: '  if (groupForView(railGroups, v)?.id !== ui.featureCat) ui.closeFeatureCat()',
    to: '  void v',
    expect: '换到不属于本大类的页面时自动收起',
  },
  {
    name: '⑥ 断点两处不一致（Sidebar 940 / App 1200 ⇒ 941~1200px 之间两套形态同时在场）',
    rel: 'src/App.vue',
    from: "const mq = window.matchMedia('(max-width: 940px)')",
    to: "const mq = window.matchMedia('(max-width: 1200px)')",
    expect: '窄屏保留「手风琴 + 磁贴」回退',
  },
  {
    name: '⑦ 山海食经也挂导航栏（整屏画布被分掉 168px）',
    rel: 'src/App.vue',
    from: "!!ui.featureCat && railAvailable.value && ui.activeView !== 'shanhai'",
    to: '!!ui.featureCat && railAvailable.value',
    expect: '山海食经',
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
