// 反例验证：C33/C32 扩组 —— 「副业档位加密」（v2.29.7，2026-09-30 用户口径「同样的时长但不枯燥」）
//   钉住的核心不变量：加密档 = **级差 5 的同物 · 与基底同图 · 辅料一致 · 不登记作品 · 能进量产阶梯**，
//   木工的加密档**不进手工装潢**、木器用**自己那一档**木材。
// 用法：node scripts/dev/verify_c87.mjs        （全部例）
//      node scripts/dev/verify_c87.mjs 2      （只跑第 2 例；改完锚点小范围复验用）
// ⚠️ 纪律（沿用 verify_c80/81/83/86）：锚点单行优先、多行锚点兼容 CRLF；**绝不并发跑两个反例脚本**；
//    跑完扫注入残留（本脚本每例结束都还原，末尾再整体复跑一次确认全绿）。
// 🔴 判据：注入不进去（锚点过期）= **失败**；注入了却「守卫全绿」= **反例无效**；只认 FAIL 行里的点名。
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
  const f = fold(from), t = fold(to)
  const n = orig.split(f).length - 1
  if (n !== 1) throw new Error(`${rel} 锚点匹配 ${n} 次（期望 1）：${from.slice(0, 70)}`)
  writeFileSync(P(rel), orig.replace(f, t), 'utf8')
}

const SW = 'src/game/data/sidelineWorks.js'
const WW = 'src/game/data/woodworking.js'
const PANEL = 'src/components/SidelineWorkPanel.vue'
const EXP_DENS = '加密档'          // 加密档核心不变量那条
const EXP_WOOD = '配方等级：基底每 10 级'
const EXP_DECOR = '手工装潢'

const CASES = [
  {
    // ① 最要命的一条：加密档**登记成作品** ⇒ 各轴总量被抬高、硬顶会被顶破
    name: '① 加密档被登记为作品（轴总量被抬高，等于偷偷改了平衡）',
    rel: SW,
    from: '    if (!densified) {\n      SIDELINE_WORKS[id] =',
    to: '    if (true) {\n      SIDELINE_WORKS[id] =',
    expect: EXP_DENS,
  },
  {
    // ② 不写显式 image ⇒ 会去找「陶碗·良.png」（不存在）⇒ 图被 @error 隐藏
    name: '② 加密档不写显式 image（会去找「X·良.png」，图直接消失）',
    rel: SW,
    from: "    if (densified) item.image = `images/items/food/${encodeURIComponent(itemName.slice(0, -DENSIFY_SUFFIX.length))}.png`",
    to: '    if (false) item.image = \'images/items/food/x.png\'',
    expect: EXP_DENS,
  },
  {
    // ③ 木工加密档混进手工装潢 ⇒ 凭空多出 9 件装潢、手工合计与「效果递增」一起被改写
    name: '③ 木工加密档混进手工装潢（凭空多 9 件装潢）',
    rel: WW,
    from: '  ...WOODWORK_ITEMS_DEF.filter((it) => !it.densified).map((it) => ({',
    to: '  ...WOODWORK_ITEMS_DEF.map((it) => ({',
    expect: EXP_DECOR,
  },
  {
    // ④ 木工加密档沿用基底木材 ⇒ 违反「同档木材」不变量
    name: '④ 木工加密档沿用基底那一档木材（违反同档木材不变量）',
    rel: WW,
    from: 'wood: timberOfLevel(lvMid).id, densified: true',
    to: 'densified: true',
    expect: '材料均为同档木材',
  },
  {
    // ⑤ 级差不做成 5 ⇒ 密度口径本身错了（也把配方等级表打歪）
    name: '⑤ 加密档改成 +6 级（密度口径错了）',
    rel: SW,
    from: 'out.push([lv + 5, `${name}${DENSIFY_SUFFIX}`',
    to: 'out.push([lv + 6, `${name}${DENSIFY_SUFFIX}`',
    expect: EXP_DENS,
  },
  {
    // ⑥ 作品数退回按配方数算 ⇒ 面板虚报（「作品 24」而实际只能做 15 件）
    name: '⑥ 作品数退回按配方数算（面板虚报作品件数）',
    rel: SW,
    from: 'for (const s of SIDELINE_SKILL_LIST) s.works = Object.values(SIDELINE_WORKS).filter((w) => w.skill === s.id).length',
    to: 'for (const s of SIDELINE_SKILL_LIST) s.works = SIDELINE_RECIPES[s.id].length',
    expect: '作品数',
  },
  {
    // ⑦ 视图侧那份口径（**线上核验抓到的真缺陷**）：面板直接拿 recipes 当作品表 ⇒ 写「已完成 x/24 件」
    name: '⑦ 作品面板不按 sidelineWorkOf 过滤（面板写「x/24 件」而实际只能做 15 件）',
    rel: PANEL,
    from: '  return (props.instance.recipes ?? []).filter((r) => sidelineWorkOf(r.output.itemId)).map((r) => {',
    to: '  return (props.instance.recipes ?? []).map((r) => {',
    expect: '作品面板只列',
  },
]

const run = () => {
  try {
    return { code: 0, out: execFileSync(process.execPath, ['scripts/ci/system_test.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }) }
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

const ONLY = process.argv.slice(2).map(Number).filter((n) => n >= 1)
const PICK = CASES.map((c, i) => [c, i + 1]).filter(([, i]) => (ONLY.length ? ONLY.includes(i) : true))

const backups = new Map()
let okAll = true
for (const [c, idx] of PICK) {
  if (!backups.has(c.rel)) backups.set(c.rel, readFileSync(P(c.rel), 'utf8'))
  try {
    injectText(c.rel, c.from, c.to)
  } catch (e) {
    console.log(`⚠ ${c.name} —— 注入失败（锚点过期，按失败处理）：${e.message}`)
    okAll = false
    writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
    continue
  }
  const r = run()
  const failLines = r.out.split('\n').filter((l) => l.startsWith('FAIL'))
  const named = failLines.some((l) => l.includes(c.expect))
  const hit = r.code !== 0 && named
  console.log(`${hit ? '✅' : '❌'} ${String(idx).padStart(2)}. ${c.name} → ${r.code === 0 ? '守卫仍全绿（注入没被抓住）' : 'FAIL'}，点名含「${c.expect}」= ${named}`)
  if (!hit) {
    okAll = false
    console.log(failLines.slice(0, 6).join('\n') || '（没有任何 FAIL 行）')
  }
  writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
}

const back = run()
const clean = back.code === 0 && /失败 0/.test(back.out)
console.log(`${clean ? '✅' : '❌'} 还原后 system_test 全绿（${(back.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}）`)
console.log(okAll && clean ? `\n反例验证通过：${PICK.length} 个注入缺陷全部被点名，还原后恢复全绿` : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)
