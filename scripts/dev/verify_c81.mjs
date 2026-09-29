// 反例验证：C81 食材保鲜 Ⅵ/Ⅶ 阶（体检 §9.1 的 5-A）+ C82 挂机产线 Lv105/115（§9.1 的 1-A ④）
// 用法：node scripts/dev/verify_c81.mjs        （全部例）
//      node scripts/dev/verify_c81.mjs 3 7    （只跑第 3、7 例；改完锚点小范围复验用）
// ⚠️ 纪律（沿用 verify_c80）：锚点**单行优先**、多行锚点要兼容 CRLF；**绝不并发跑两个反例脚本**；
//    跑完 grep 扫注入残留（本脚本每例结束都会还原，末尾还会整体复跑一次两套守卫确认全绿）。
//
// 🔴 判据（本项目反复强调）：
//   · 「注入不进去」（锚点过期）**算失败**，不算通过；
//   · 「注入了、守卫却全绿」= **反例无效**（不是守卫假绿），必须先确认注入本身能改变行为；
//   · 只认 `FAIL` 行里的点名（`ok` 行里也可能含同一个断言名 ⇒ 拿全量文本匹配会假绿）。
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

const EXT = 'src/game/data/preserveTiersExt.js'
const PRES = 'src/game/skills/PreservationSkill.js'
const FIELD = 'src/game/data/spiritField.js'
const SEEDS = 'src/game/data/spiritFieldSeeds.js'
const RANCH = 'src/game/data/ranch.js'
const MYCO = 'src/game/data/mushroomHouse.js'
const GREEN = 'src/game/data/greenhouse.js'

const CASES = [
  // ── A. C81 食材保鲜 Ⅵ/Ⅶ 阶 ────────────────────────────────────────
  {
    name: '① Ⅵ 的增益剂乘数抬到 ×5.5（本组核心防线：乘数不许抬）',
    rel: EXT,
    from: "{ id: 'xpTonic6', name: '经验增益剂·Ⅵ', type: 'consumable', category: 'buff', tier: 6, value: 355, use: { buffXp: { mult: 4.5, minutes: 260 } }, image: 'images/items/tool/经验增益剂.png' },",
    to: "{ id: 'xpTonic6', name: '经验增益剂·Ⅵ', type: 'consumable', category: 'buff', tier: 6, value: 355, use: { buffXp: { mult: 5.5, minutes: 260 } }, image: 'images/items/tool/经验增益剂.png' },",
    expect: '乘数没有抬高',
  },
  {
    name: '② Ⅵ 的时长改得比 Ⅴ 还短（时长不再逐阶递增）',
    rel: EXT,
    from: "{ id: 'xpTonic6', name: '经验增益剂·Ⅵ', type: 'consumable', category: 'buff', tier: 6, value: 355, use: { buffXp: { mult: 4.5, minutes: 260 } }, image: 'images/items/tool/经验增益剂.png' },",
    to: "{ id: 'xpTonic6', name: '经验增益剂·Ⅵ', type: 'consumable', category: 'buff', tier: 6, value: 355, use: { buffXp: { mult: 4.5, minutes: 100 } }, image: 'images/items/tool/经验增益剂.png' },",
    expect: '时长逐阶严格递增',
  },
  {
    name: '③ 配方等级写错（Ⅵ 的 105 → 100，落不进设计档位）',
    rel: EXT,
    from: "{ id: 'preservRecipe6', name: '保鲜剂·Ⅵ', category: '保鲜', reqLevel: 105,",
    to: "{ id: 'preservRecipe6', name: '保鲜剂·Ⅵ', category: '保鲜', reqLevel: 100,",
    expect: '配方等级 = Lv105 / Lv120',
  },
  {
    name: '④ 新配方没并进 PRESERVATION_RECIPES（只写在数据里、没人消费 = 静默失效）',
    rel: PRES,
    from: 'export const PRESERVATION_RECIPES = [...ENTRY_RECIPES, ...FERTILIZER_RECIPES, ...PRESERVE_TIER_RECIPES, ...PRESERVE_TIER_EXT_RECIPES]',
    to: 'export const PRESERVATION_RECIPES = [...ENTRY_RECIPES, ...FERTILIZER_RECIPES, ...PRESERVE_TIER_RECIPES]',
    expect: '并进了',
  },
  // ── B. C82 挂机产线 Lv105/115 ──────────────────────────────────────
  {
    name: '⑤ 灵田新档的 reqLevel 写成 50（不再严格递增）',
    rel: FIELD,
    from: "  { id: 'nineSpirit', seedId: 'late_for_03Seed', name: '九畹灵芝圃', icon: '🍄', hours: 84, products: { late_for_03: 2 }, reqLevel: 105 },",
    to: "  { id: 'nineSpirit', seedId: 'late_for_03Seed', name: '九畹灵芝圃', icon: '🍄', hours: 84, products: { late_for_03: 2 }, reqLevel: 50 },",
    expect: 'reqLevel 严格递增',
  },
  {
    name: '⑥ 新种子没并进 SEED_MAP（灵田要种它，但玩家拿不到）',
    rel: SEEDS,
    from: "  late_exc_02: 'late_exc_02Seed',",
    to: "  late_exc_02: '',",
    expect: '灵田新种子四处齐备',
  },
  {
    name: '⑦ 牧场新动物漏了加工品（既有断言要求每头 ≥1 件）',
    rel: RANCH,
    from: "  { id: 'rhino', name: '霜甲犀', icon: '🦏', cost: 120000, hours: 14, feed: { late_far_01: 2 }, products: { late_hun_01: 2, boneBroth: 1, milk: 1 } },",
    to: "  { id: 'rhino', name: '霜甲犀', icon: '🦏', cost: 120000, hours: 14, feed: { late_far_01: 2 }, products: { late_hun_01: 2, milk: 1 } },",
    expect: '各含 ≥1 件加工品',
  },
  {
    name: '⑧ 菌房新床产物写成幽灵 id',
    rel: MYCO,
    from: '    products: { cloudFungus: 2, bloodFungus: 1 },',
    to: '    products: { ghostFungus: 2, bloodFungus: 1 },',
    expect: '产物 / 饲料 id 都存在',
  },
  {
    name: '⑨ 蜂箱新档周期写成 0（hours 必须 > 0）',
    rel: GREEN,
    from: "  { id: 'lateBean', name: '紫府蜜箱', icon: '🫘', hours: 12, feed: { late_far_02: 2 }, honeyQty: 4 },",
    to: "  { id: 'lateBean', name: '紫府蜜箱', icon: '🫘', hours: 0, feed: { late_far_02: 2 }, honeyQty: 4 },",
    expect: '周期（hours）都 > 0',
  },
  {
    name: '⑩ 四类里少一类（删掉雪鬃牦牛整行）',
    rel: RANCH,
    from: "  { id: 'snowYak', name: '雪鬃牦牛', icon: '🐂', cost: 200000, hours: 18, feed: { late_far_02: 2 }, products: { late_hun_02: 2, cheese: 1, milk: 2 } },\n",
    to: '',
    expect: '四类都各加了 2 档',
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
