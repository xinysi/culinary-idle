// 反例验证：Lv101-120「补档」接线（C73）—— 逐个注入真缺陷 → 跑 system_test → 断言 FAIL 且点名 → 还原。
// 用法：node scripts/dev/verify_c73.mjs          （7 例 × ~24 秒 ≈ 3 分钟）
//      node scripts/dev/verify_c73.mjs 3 5       （只跑指定序号）
// ⚠️ 两条纪律（AGENTS 记过）：锚点单行优先；**绝不要并发跑两个反例脚本**（会互相踩文件留下注入残留）。
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
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

/** 图片类注入：把文件挪走（还原时挪回来） */
const IMG = 'public/images/items/food/九畹天香.png'
const IMG_HIDDEN = join(root, '九畹天香.png.hidden')

const CASES = [
  {
    name: '① 紫苏玉笋回 Lv108（材料锚会把两条 Lv102 副业配方抬级）',
    rel: 'src/game/data/lateGameFood.js',
    from: "    { itemId: 'late_for_02', reqLevel: 102, xpPerAction: 620, intervalSec: 8.0 },",
    to: "    { itemId: 'late_for_02', reqLevel: 108, xpPerAction: 700, intervalSec: 8.0 },",
    expect: '紫苏玉笋钉在 Lv102',
  },
  {
    name: '② 山海八珍羹不再吃地髓晶（原料只剩 1 条消费方 = 「有产出无用途」）',
    rel: 'src/game/data/lateGameFood.js',
    from: "ingredients: { late_fish_02: 1, late_for_03: 1, late_exc_01: 1, late_for_02: 1 }",
    to: "ingredients: { late_fish_02: 1, late_for_03: 1, late_for_02: 1 }",
    expect: '每件新原料都 ≥2 条配方在吃',
  },
  {
    name: '③ 九畹天香的图片缺失（图鉴三查的图片项必须响）',
    file: true,
    setup: () => renameSync(P(IMG), IMG_HIDDEN),
    restore: () => { if (existsSync(IMG_HIDDEN)) renameSync(IMG_HIDDEN, P(IMG)) },
    expect: '图片文件真实存在',
  },
  {
    name: '④ 封顶件山海八珍羹降回 Lv98（顶档回落 = 内容被撤）',
    rel: 'src/game/data/lateGameFood.js',
    from: "reqLevel: 118, xp: prodXp(118)",
    to: "reqLevel: 98, xp: prodXp(98)",
    expect: '顶档都推进到设计值',
  },
  {
    name: '⑤ SIDELINE_AXIS_TOTALS 退回 DEFS 行数口径（totals 过期、恒等式断言 FAIL）',
    rel: 'src/game/data/sidelineWorks.js',
    from: "    const mine = Object.values(SIDELINE_WORKS).filter((w) => w.axis === axisKey)\n    return [axisKey, { skill: mine[0]?.skill ?? null, axis: axisKey, perItem: a.perItem, count: mine.length, total: a.perItem * mine.length }]",
    to: "    const ent = Object.entries(DEFS).find(([, d]) => d.axis === axisKey)\n    return [axisKey, { skill: ent ? ent[0] : null, axis: axisKey, perItem: a.perItem, count: ent ? ent[1].rows.length : 0, total: a.perItem * (ent ? ent[1].rows.length : 0) }]",
    expect: 'SIDELINE_AXIS_TOTALS 与实际作品数一致',
  },
  {
    name: '⑥ 陶艺的 2 件新产物被剔出 SIDELINE_ITEMS（独占清单的自动排除就断了一条腿）',
    rel: 'src/game/data/sidelineWorks.js',
    from: "  SIDELINE_ITEMS.push({\n    id,\n    name: itemName,",
    to: "  if (key === 'pottery') continue\n  SIDELINE_ITEMS.push({\n    id,\n    name: itemName,",
    expect: '30 件副业新产物都在 SIDELINE_ITEMS',
  },
  {
    name: '⑦ 龙涎煨汤塞进超纲材料（九畹灵芝 Lv112 > 104+5）',
    rel: 'src/game/data/lateGameFood.js',
    from: "ingredients: { late_fish_01: 2, late_for_01: 1, water: 1 }",
    to: "ingredients: { late_fish_01: 2, late_for_03: 1, water: 1 }",
    expect: '材料全部 ≤ 配方+5',
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
  if (c.file) {
    c.setup()
  } else {
    if (!backups.has(c.rel)) backups.set(c.rel, readFileSync(P(c.rel), 'utf8'))
    try { injectText(c.rel, c.from, c.to) } catch (e) { console.log(`⚠ ${c.name} —— 注入失败：${e.message}`); okAll = false; continue }
  }
  const r = run()
  const hit = r.code !== 0 && r.out.includes('FAIL') && r.out.includes(c.expect)
  console.log(`${hit ? '✅' : '❌'} ${String(idx).padStart(2)}. ${c.name} → ${r.code === 0 ? 'system_test 仍全绿（假绿！）' : 'FAIL'}，点名含「${c.expect}」= ${r.out.includes(c.expect)}`)
  if (!hit) {
    okAll = false
    console.log(r.out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 4).join('\n'))
  }
  if (c.file) c.restore()
  else writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
}
for (const [rel, content] of backups) writeFileSync(P(rel), content, 'utf8')

const back = run()
const clean = back.code === 0 && /失败 0/.test(back.out)
console.log(`${clean ? '✅' : '❌'} 还原后 system_test 全绿（${(back.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}）`)
console.log(okAll && clean ? `\n反例验证通过：${PICK.length} 个注入缺陷全部被点名，还原后恢复全绿` : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)