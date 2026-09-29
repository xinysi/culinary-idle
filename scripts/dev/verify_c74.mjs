// 反例验证：Lv101-120「补档」装备线（C74）—— 逐个注入真缺陷 → 跑 system_test → 断言 FAIL 且点名 → 还原。
// 用法：node scripts/dev/verify_c74.mjs          （5 例 × ~30 秒 ≈ 3 分钟）
//      node scripts/dev/verify_c74.mjs 2        （只跑指定序号）
// ⚠️ 两条纪律（AGENTS 记过）：锚点尽量单行；**绝不要并发跑两个反例脚本**（会互相踩文件留残留）。
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
  from = fold(from)
  to = fold(to)
  const n = orig.split(from).length - 1
  if (n !== 1) throw new Error(`${rel} 锚点匹配 ${n} 次（期望 1）：${from.slice(0, 60)}`)
  writeFileSync(P(rel), orig.replace(from, to), 'utf8')
}

const IMG = 'public/images/items/equipment/天罡神兵.png'
const IMG_HIDDEN = join(root, '天罡神兵.png.hidden')

const CASES = [
  {
    name: '① 漏登记 itemBalance 的 G 索引（顶级装备停在占位 1 —— 页面看不出异常的那类缺陷）',
    rel: 'src/game/data/itemBalance.js',
    from: "  [LATE_GEAR_RECIPES, [], [], balanceRecipeLevels],\n",
    to: '',
    expect: '数值被平衡层按等级覆写',
  },
  {
    name: '② 配方塞超纲材料（天罡沉香 Lv112 进 Lv104 档 ⇒ 112 > 104+5）',
    rel: 'src/game/data/lateGear.js',
    from: "level: 104, value: 660, wood: 'late_wood_01', ore: 'late_min_01'",
    to: "level: 104, value: 660, wood: 'late_wood_02', ore: 'late_min_01'",
    expect: '材料只用本批新料',
  },
  {
    name: '③ 觅珍池漏排除（顶级装备能 500 金/抽抽出来 = 绕开整条生产链）',
    rel: 'src/game/data/mijianDraws.js',
    from: " || LATE_GEAR_IDS.includes(it.id)",
    to: '',
    expect: '不进任何觅珍池',
  },
  {
    name: '④ 图片缺失（图鉴三查的图片项）',
    file: true,
    setup: () => renameSync(P(IMG), IMG_HIDDEN),
    restore: () => { if (existsSync(IMG_HIDDEN)) renameSync(IMG_HIDDEN, P(IMG)) },
    expect: '图片齐备',
  },
  {
    name: '⑤ 配方没进锻造实例（只并了物品、漏并配方 ⇒ 玩家做不出来）',
    rel: 'src/game/skills/CraftsmithingSkill.js',
    from: "balanceRecipeLevels([...SMITHING_SET_RECIPES, ...LATE_GEAR_RECIPES])",
    to: "balanceRecipeLevels([...SMITHING_SET_RECIPES])",
    expect: '不在锻造实例',
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
  if (c.file) c.setup()
  else {
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