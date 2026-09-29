// 反例验证：C83 副业同物变体（T3）+ C84 餐厅第六星（T4）+ C85 副业产业链/出口登记（T6）
// 用法：node scripts/dev/verify_c83.mjs        （全部例）
//      node scripts/dev/verify_c83.mjs 3 7    （只跑第 3、7 例；改完锚点小范围复验用）
// ⚠️ 纪律（沿用 verify_c80/c81）：锚点**单行优先**、多行锚点兼容 CRLF；**绝不并发跑两个反例脚本**；
//    跑完 grep 扫注入残留（本脚本每例结束都还原，末尾再整体复跑一次确认全绿）。
// 🔴 判据：注入不进去（锚点过期）= **失败**；注入了却「守卫全绿」= **反例无效**；只认 `FAIL` 行里的点名。
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

const VARIANTS = 'src/game/data/sidelineVariants.js'
const MICHELIN = 'src/game/data/michelin.js'
const PLAYER = 'src/stores/player.js'
const AE = 'src/game/data/activeEffects.js'
const PANEL = 'src/components/SidelineWorkPanel.vue'

const CASES = [
  // ── A. C83 副业同物变体 ────────────────────────────────────────────
  {
    name: '① 变体加级写错（·御 +8 改成 +12 ⇒ 落到 Lv124）',
    rel: VARIANTS,
    from: "  { suffix: '·御', delta: 8, woodQty: 8, auxQty: 5 },",
    to: "  { suffix: '·御', delta: 12, woodQty: 8, auxQty: 5 },",
    expect: '等级 = 基底',
  },
  {
    name: '② 变体没登记作品定义（进不了作品面板、也吃不到轴收益）',
    rel: 'src/game/data/sidelineWorks.js',
    from: '    SIDELINE_WORKS[id] = { itemId: id, name: itemName, catLabel: d.catLabel, skill: d.skill, skillName: d.name, axis: d.axis, amount: axis.perItem, level, woodId: VARIANT_WOOD, woodName: null, auxId: baseAuxId, auxQty: v.auxQty, woodQty: v.woodQty }',
    to: '    void 0',
    expect: '每件变体都有作品定义',
  },
  {
    name: '③ 变体用错木（不用基底那一档 ⇒ 材料等级对不上）',
    rel: VARIANTS,
    from: "export const VARIANT_WOOD = 'late_wood_02'",
    to: "export const VARIANT_WOOD = 'wood'",
    expect: '变体用的木与基底',
  },
  // ── B. C84 餐厅第六星 ──────────────────────────────────────────────
  {
    name: '④ 改了前五档的门槛（标定过的部分不许动）',
    rel: MICHELIN,
    from: "  { star: 5, name: '五星', min: 8000,",
    to: "  { star: 5, name: '五星', min: 9000,",
    expect: '前五档门槛与收益',
  },
  {
    name: '⑤ 第七维权重被清零（等于没加评分来源）',
    rel: MICHELIN,
    from: "  { id: 'banquet', label: '宴席承办', weight: 25, hint: '累计完成的宴会承办次数' },",
    to: "  { id: 'banquet', label: '宴席承办', weight: 0, hint: '累计完成的宴会承办次数' },",
    expect: '第七维',
  },
  {
    name: '⑥ 六星门槛设成够不到（99999）',
    rel: MICHELIN,
    from: "  { star: 6, name: '六星', min: 11500,",
    to: "  { star: 6, name: '六星', min: 99999,",
    expect: '满配可达',
  },
  {
    name: '⑦ 六星收益不按步长续写（收入 +70）',
    rel: MICHELIN,
    from: "min: 11500, incomePct: 80, xpPct: 15,",
    to: "min: 11500, incomePct: 70, xpPct: 15,",
    expect: '收益按原步长续写',
  },
  {
    name: '⑧ 第七维挂到别的字段（宴席承办次数读不到 ⇒ 分数不涨）',
    rel: PLAYER,
    from: '        banquet: this.stats?.banquets ?? 0, // 第七维（2026-09-30 T4）：宴席承办次数',
    to: '        banquet: 0,',
    expect: '满配可达',
  },
  // ── C. C85 副业产业链 + 出口登记 ───────────────────────────────────
  {
    name: '⑨ 跨线投料并进默认「投入全部」（玩家点一下会静默花掉木器）',
    rel: PLAYER,
    from: '      if (opts.withChain && skillId !== CHAIN_FROM_SKILL) {',
    to: '      if (skillId !== CHAIN_FROM_SKILL) {',
    expect: '默认「投入全部」绝不消耗木器',
  },
  {
    name: '⑩ 折扣改成 1（跨线全价 = 拿木器绕开本职辅料的捷径）',
    rel: 'src/game/data/sidelineWorks.js',
    from: 'export const CHAIN_DISCOUNT = 0.5',
    to: 'export const CHAIN_DISCOUNT = 1',
    expect: '常数：只木工跨线',
  },
  {
    name: '⑪ 界面少了独立入口（按钮删掉）',
    rel: PANEL,
    from: '        <button v-if="chainQty > 0" class="btn btn-sm" @click="feedChain">',
    to: '        <button v-if="false" class="btn btn-sm" @click="feedChain">',
    expect: '界面有独立入口',
  },
  {
    // ⚠️ 锚点挑「只出现一次」的那条轴（`huntSavePct` 只在制箭那一行的 total 调用里出现）：
    //    换成一个不存在的轴名 ⇒ 该行读 0、走 off 分支（**不抛异常**），而登记检查当场点名。
    name: '⑫ 某条副业轴漏出「效果总览」（玩家看不到自己在吃什么加成）',
    rel: AE,
    from: "      const v = p.sidelineEffectTotal?.('huntSavePct') ?? 0",
    to: "      const v = p.sidelineEffectTotal?.('huntSavePctTYPO') ?? 0",
    expect: '都登记进了',
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
