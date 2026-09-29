// 反例验证：制作类「练习」动作（C76）+ 山海「线级门槛缩放」（C77）
// —— 逐个注入真缺陷 → 跑 system_test → 断言 FAIL 且点名 → 还原。
// 用法：node scripts/dev/verify_c76.mjs          （全部例 × ~22 秒）
//      node scripts/dev/verify_c76.mjs 3 5       （只跑指定序号）
// ⚠️ 两条纪律（AGENTS 记过）：锚点单行优先；**绝不要并发跑两个反例脚本**（会互相踩文件留下注入残留）。
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const P = (rel) => join(root, rel)
const CRLF = String.fromCharCode(13, 10)

function injectText(rel, from, to) {
  const orig = readFileSync(P(rel), 'utf8')
  const fold = (t) => (orig.includes(CRLF) ? t.replace(/\n/g, CRLF) : t)
  from = fold(from); to = fold(to)
  const n = orig.split(from).length - 1
  if (n !== 1) throw new Error(`${rel} 锚点匹配 ${n} 次（期望 1）：${from.slice(0, 60)}`)
  writeFileSync(P(rel), orig.replace(from, to), 'utf8')
}

const PS = 'src/game/skills/ProductionSkill.js'
const VIEW = 'src/views/ProductionView.vue'
const AE = 'src/game/data/activeEffects.js'
const GEN = 'scripts/gen/gen_shanhai_tree.mjs'

const CASES = [
  {
    name: '① 练习开始扣料（它存在的意义就是「不扣料」，扣了就退回供料限速）',
    rel: PS,
    from: "    this.actionsDone++\n    this.player.addMastery(this.id, recipe.id, 1)\n    EventBus.emit('skill:practice'",
    to: "    for (const [itemId, qty] of Object.entries(effIngredients(recipe))) { this.player.spendItem(itemId, qty) }\n    this.actionsDone++\n    this.player.addMastery(this.id, recipe.id, 1)\n    EventBus.emit('skill:practice'",
    expect: '不消耗材料',
  },
  {
    name: '② 练习开始产出成品（会冲击物价与材料价值链）',
    rel: PS,
    from: "    this.actionsDone++\n    this.player.addMastery(this.id, recipe.id, 1)\n    EventBus.emit('skill:practice'",
    to: "    this.player.gainItem(recipe.output.itemId, 1)\n    this.actionsDone++\n    this.player.addMastery(this.id, recipe.id, 1)\n    EventBus.emit('skill:practice'",
    expect: '不产出成品',
  },
  {
    name: '③ 练习开始给经验（会绕过已标定的等级轴）',
    rel: PS,
    // ⚠️ 锚点里必须是 `this.addCardXp`（**技能实例**的方法）：写成 `this.player.addCardXp` 会直接
    //    `TypeError: not a function` 崩掉守卫 —— 那是「注入本身无效」，不是守卫抓到了它（首跑就这么错过一次）。
    from: "    this.actionsDone++\n    this.player.addMastery(this.id, recipe.id, 1)\n    EventBus.emit('skill:practice'",
    to: "    this.addCardXp(recipe.xp, 1, recipe.reqLevel)\n    this.actionsDone++\n    this.player.addMastery(this.id, recipe.id, 1)\n    EventBus.emit('skill:practice'",
    expect: '不给经验',
  },
  {
    name: '④ 练习忘了加精通（练了等于白练）',
    rel: PS,
    from: "    this.player.addMastery(this.id, recipe.id, 1)\n    EventBus.emit('skill:practice'",
    to: "    EventBus.emit('skill:practice'",
    expect: '精通 +1',
  },
  {
    name: '⑤ 练习漏了等级校验（变成绕过配方门槛的通道）',
    rel: PS,
    from: "    if (this.level < recipe.reqLevel) return 'denied'\n    this.actionsDone++",
    to: "    this.actionsDone++",
    expect: '等级不足的配方被拒',
  },
  {
    name: '⑥ 队列合并只看配方 id（练习与制作条目会被合并 → 按先入队者的模式跑完全部）',
    rel: PS,
    from: "    if (last && last.recipeId === recipe.id && (last.practice === true) === practice) {",
    to: "    if (last && last.recipeId === recipe.id) {",
    expect: '不同模式',
  },
  {
    name: '⑦ tick 无视练习标记、一律按制作推进（材料不足就会卡住）',
    rel: PS,
    from: "    const res = head.practice === true ? this.practice(recipe) : this.craft(recipe)",
    to: "    const res = this.craft(recipe)",
    expect: '材料为 0 也照常推进',
  },
  {
    name: '⑧ 练习改发 skill:action（会掉进日志 default 分支刷「获得 X ×0」，且被成就/奇遇误计）',
    rel: PS,
    from: "    EventBus.emit('skill:practice', { skillId: this.id, recipeId: recipe.id, timestamp: Date.now() })",
    to: "    EventBus.emit('skill:action', { skillId: this.id, itemId: recipe.output?.itemId, qty: 0, expGained: 0, outcome: 'practice', recipeId: recipe.id, timestamp: Date.now() })",
    expect: '不发 `skill:action`',
  },
  {
    name: '⑨ 卡片上的练习入口被摘掉（守卫必须看见按钮本身）',
    rel: VIEW,
    from: ' @click="openPractice(r)" title="练习',
    to: ' title="练习',
    expect: '卡片上有入口按钮',
  },
  {
    name: '⑩ 弹窗确认不再分派练习（按钮成了摆设：点了只是关掉弹窗）',
    rel: VIEW,
    from: "  if (qtyMode.value === 'practice') {",
    to: "  if (false) {",
    expect: '弹窗确认按模式分派',
  },
  {
    name: '⑪ 练习侧加回 canAfford 限制（回到「必须囤料才能练」）',
    rel: VIEW,
    from: "function openPractice(r) {\n  qtyMode.value = 'practice'",
    to: "function openPractice(r) {\n  if (!canAfford(r)) return\n  qtyMode.value = 'practice'",
    expect: '练习不走 canAfford',
  },
  {
    name: '⑫ 队列条目不再显示练习标签（「练习 ×100」与「制作 ×100」长得一样）',
    rel: VIEW,
    from: '<span v-if="e.practice" class="queue-tag"',
    to: '<span v-if="false" class="queue-tag"',
    expect: '队列条目在界面上有区分标记',
  },
  {
    name: '⑬ 效果总览把练习说成「材料不足」（一句假话）',
    rel: AE,
    from: "        if (q[0]?.practice === true) practiced.push(SKILL_CN[sid] ?? sid)",
    to: "        if (false) practiced.push(SKILL_CN[sid] ?? sid)",
    expect: '效果总览也分流',
  },
  {
    name: '⑭ 生成器只缩分支环、不缩汇金环（空隙节点把门槛顶回未缩放的 100%）',
    rel: GEN,
    from: "    const gPct = R.masteryPct ? pct4(R.masteryPct * Math.min(scaleOf(g.a.id), scaleOf(g.b.id))) : 0",
    to: "    const gPct = R.masteryPct ? pct4(R.masteryPct) : 0",
    expect: '汇金（空隙）节点也按两侧较低者缩放',
  },
  {
    name: '⑮ 缩放幅度被偷偷改大（0.5 → 0.25，等于又放松一档）',
    rel: GEN,
    from: "const PATH_MASTERY_SCALE = { farm: 0.5 }",
    to: "const PATH_MASTERY_SCALE = { farm: 0.25 }",
    expect: '缩放表只含被授权的线',
  },
  {
    name: '⑯ 弹窗上限退回「到下一档」（masteryProgress 那对）⇒ 写着「还差 8 次」实际要 3750 次',
    rel: VIEW,
    // ⚠️ 多行锚点用**单行**写法表达换行（`\n` 是 JS 字符串里的转义，不能被工具写成真换行 —— 本轮踩过）
    from: "  const need = countForMasteryLevel(MASTERY_LEVEL_CAP)\n  const cur = props.instance.mastery?.[r.id] ?? 0",
    to: "  const prog = props.instance.masteryProgress?.(r)\n  const cur = props.instance.mastery?.[r.id] ?? 0",
    expect: '弹窗上限 = 到**精通 100** 还差的次数',
  },
]

/** 跑**两条守卫**：C76 的断言大部分在 system_test，而生成器那两条（汇金缩放 / 缩放表核准）在
 *  content_sync_audit —— 只跑 system_test 会让那两例「注入成功但全绿」（首跑就是这么误判的）。 */
const runOnce = (script) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [script], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }) }
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}
const run = () => {
  const a = runOnce('scripts/ci/system_test.mjs')
  const b = runOnce('scripts/ci/content_sync_audit.mjs')
  return { code: a.code === 0 && b.code === 0 ? 0 : 1, out: `${a.out}\n${b.out}` }
}

// ⚠️ 生成器那两例（⑭⑮）改的是**生成器源码**，守卫读的是**产物** ⇒ 注入后必须重跑生成器，
//    否则 system_test 读到的还是旧产物（注入成功但全绿 = 反例无效，不是假绿）。
const regenerate = () => {
  try {
    execFileSync(process.execPath, ['scripts/gen/gen_shanhai_tree.mjs'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  } catch (e) {
    return `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
  return ''
}

const ONLY = process.argv.slice(2).map(Number).filter((n) => n >= 1)
const PICK = CASES.map((c, i) => [c, i + 1]).filter(([, i]) => (ONLY.length ? ONLY.includes(i) : true))

const backups = new Map()
const TREE = 'src/game/data/shanhaiTree.js'
let okAll = true
for (const [c, idx] of PICK) {
  if (!backups.has(c.rel)) backups.set(c.rel, readFileSync(P(c.rel), 'utf8'))
  if (c.rel === GEN && !backups.has(TREE)) backups.set(TREE, readFileSync(P(TREE), 'utf8'))
  try {
    injectText(c.rel, c.from, c.to)
    if (c.rel === GEN) {
      const err = regenerate()
      if (err) throw new Error(`重跑生成器失败：${err.slice(0, 200)}`)
    }
  } catch (e) {
    console.log(`⚠ ${c.name} —— 注入失败：${e.message}`)
    okAll = false
    writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
    if (c.rel === GEN) writeFileSync(P(TREE), backups.get(TREE), 'utf8')
    continue
  }
  const r = run()
  // ⚠️ 判据必须是**FAIL 行**里含期望点名：断言通过时也会把名字打在 `ok` 行上，
  //    只 `out.includes(expect)` 会把「注入成功但全绿」误判成命中（首跑 ① 就是这么错的）。
  const failLines = r.out.split('\n').filter((l) => l.startsWith('FAIL'))
  const named = failLines.some((l) => l.includes(c.expect))
  const hit = r.code !== 0 && named
  console.log(`${hit ? '✅' : '❌'} ${String(idx).padStart(2)}. ${c.name} → ${r.code === 0 ? '守卫仍全绿（注入没被抓住）' : 'FAIL'}，FAIL 行点名含「${c.expect}」= ${named}`)
  if (!hit) {
    okAll = false
    console.log(failLines.slice(0, 4).join('\n') || '（没有任何 FAIL 行）')
  }
  writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
  if (c.rel === GEN) { regenerate(); writeFileSync(P(TREE), backups.get(TREE), 'utf8') }
}

const back = run()
const clean = back.code === 0 && /失败 0/.test(back.out)
console.log(`${clean ? '✅' : '❌'} 还原后 system_test 全绿（${(back.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}）`)
console.log(okAll && clean ? `\n反例验证通过：${PICK.length} 个注入缺陷全部被点名，还原后恢复全绿` : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)
