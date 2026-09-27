// 反例验证：奥义门槛 + 副业线奥义（C62/C63/C64）——逐个注入真缺陷 → 跑 system_test → 断言 FAIL 且点名 → 还原。
// 用法：node scripts/dev/verify_c62.mjs     （每例跑一遍 system_test，约 25 秒；共 8 例 ⇒ 约 3.5 分钟）
//
// 为什么这几条值得单独反例验证：
//   ① 副业线奥义走的是「与作品/阶梯同一条轴」的**合计**出口 —— 轴的消费方若只读阶梯那一段，
//      奥义就是**买了没效果**（本轮真的踩到过：decorPct / nightMult）。
//   ② 门槛的**唯一生效点**是 `toggleAoji`，而界面只是展示 —— 把门槛做成「只灰卡片不挡引擎」
//      是本项目最典型的静默失效（玩家能看到锁，却照样开得起来）。
//   ③ C62~C64 三块原先各自引用了一个**别的块里的局部常量 `rd`** ⇒ 抛 ReferenceError、整块断言从未跑过，
//      所以这一次的反例验证同时是在证明「这些断言现在真的在执行」。
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const P = (rel) => join(root, rel)

/** 精确替换（必须恰好 1 处），返回注入了缺陷的源码 */
function inject(rel, from, to) {
  const orig = readFileSync(P(rel), 'utf8')
  const n = orig.split(from).length - 1
  if (n !== 1) throw new Error(`${rel} 锚点匹配 ${n} 次（期望 1）：${from.slice(0, 60)}`)
  writeFileSync(P(rel), orig.replace(from, to), 'utf8')
}

const CASES = [
  {
    name: '① 门槛只挡界面、不挡引擎（toggleAoji 去掉门槛判断）',
    rel: 'src/stores/player.js',
    from: 'if (!aojiUnlockedAt(id, this.skills?.gastronomy?.level ?? 1))',
    to: 'if (false && !aojiUnlockedAt(id, this.skills?.gastronomy?.level ?? 1))',
    expect: '等级不足时 `toggleAoji` 返回**原因字符串**',
  },
  {
    name: '② 掉级后不收回（drainAoji 不再清理不达标的奥义）',
    rel: 'src/stores/player.js',
    from: 'const illegal = active.filter((id) => !aojiUnlockedAt(id, lv))',
    to: 'const illegal = []',
    expect: '等级掉回去（转生）后',
  },
  {
    name: '③ 门槛表漏一条（把某条副业线的门槛删掉 ⇒ 「每条奥义都有门槛」不成立）',
    rel: 'src/game/data/aojiGates.js',
    from: '  aoji2_berserk2: 81,\n',
    to: '',
    expect: '门槛',
  },
  {
    name: '④ 副业线奥义用了不存在的轴（轴 id 写错 ⇒ 静默无效）',
    rel: 'src/game/data/aojiSideline.js',
    from: "{ sideline: { decorPct: 6 } }",
    to: "{ sideline: { decorPctTypo: 6 } }",
    expect: 'SIDELINE_AXES',
  },
  {
    name: '⑤ 轴在表里但没人读（消费方退回只读阶梯 ⇒ 奥义「买了没效果」，本轮真踩到的那个坑）',
    rel: 'src/stores/player.js',
    from: "return NIGHT_MARKET_BASE_MULT + (this.sidelineEffectTotal?.('nightMult') ?? 0)",
    to: "return NIGHT_MARKET_BASE_MULT + (this.sidelineLadderTotal?.('nightMult') ?? 0)",
    expect: '引擎侧都有一处字面量读取',
  },
  {
    name: '⑥ 效果总览退回「合计 − 阶梯」倒推作品（把奥义说成作品）',
    rel: 'src/game/data/activeEffects.js',
    from: "const segs = sidelineSegs(p, 'nightMult', (v) => `+${n1(v)} 倍`)",
    to: 'const segs = `作品 +${p.sidelineLadderTotal?.(\'nightMult\') ?? 0} 倍`',
    expect: '三段（作品/阶梯/奥义）',
  },
  {
    name: '⑦ 计划收工回到写死的两个技能（农耕不被停 ⇒ 用户⑨ 的那条修复被推翻）',
    rel: 'src/stores/player.js',
    from: 'const planned = new Set(st.steps.map((x) => x.skill))',
    to: "const planned = new Set(['gathering', 'exploration'])",
    expect: '计划里出现过的技能',
  },
  {
    name: '⑧ 导航退回「只有手风琴磁贴」（用户⑳ 的大类按钮被推翻）',
    rel: 'src/components/Sidebar.vue',
    from: 'class="feature-cat"',
    to: 'class="feature-cat-disabled"',
    expect: '大类按钮',
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
