// 反例验证：C88 组 —— 「末段空档」批（2026-09-30）：把 7 个零内容等级填满。
//   钉住的五条：① 那 7 级每级 ≥2 件内容 · ② 46 件都在 ITEMS 里 · ③ 采集/作物等级落在那一级 ·
//   ④ **每件原料都被成品吃掉**（无孤儿）· ⑤ 4 颗种子真上架 + 进了 SEED_MAP。
// 用法：node scripts/dev/verify_c88.mjs       （全部例）
//      node scripts/dev/verify_c88.mjs 2     （只跑第 2 例；改完锚点小范围复验用）
// ⚠️ 纪律（沿用 verify_c80…c87）：锚点单行优先、多行锚点兼容 CRLF；**绝不并发跑两个反例脚本**；
//    跑完扫注入残留（每例结束都还原，末尾再整体复跑一次确认全绿）。
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

const GAP = 'src/game/data/lateGapFood.js'
const ITEMSJS = 'src/game/data/items.js'
const SHOP = 'src/game/data/shop.js'
const NO_ORPHAN = '全部被 14 条配方吃掉'
const EVERY_LEVEL = '现在每级 ≥2 件内容'
const IN_ITEMS = '都在 ITEMS 里'
const SHOPPED = '都在商店上架清单里'

const CASES = [
  {
    // ① 本批的硬口径：每件原料都要有消费方
    name: '① 一件原料变成孤儿（把它从唯一吃它的配方里删掉）',
    rel: GAP,
    from: "ingredients: { gap_hun_119: 2, gap_far_119: 2, rice: 1 }",
    to: "ingredients: { gap_far_119: 2, rice: 1 }",
    expect: NO_ORPHAN,
  },
  {
    // ② 把一件原料挪到「非空」等级 ⇒ 既破坏「落在那 7 级里」，也削掉某一级的内容数
    name: '② 采集目标等级挪到非空等级（101 → 102）',
    rel: GAP,
    from: "{ itemId: 'gap_for_101', reqLevel: 101, xpPerAction: 604, intervalSec: 8.0 }",
    to: "{ itemId: 'gap_for_101', reqLevel: 102, xpPerAction: 604, intervalSec: 8.0 }",
    // ⚠️ 点名要给**真正会红的那条**：101 挪走一件后该级仍有 ≥2 件（① 照样绿），
    //    红的是「等级全部落在那 7 级里」那一条（③）—— 两条互补，别把点名写串。
    expect: '等级全部落在那 7 级里',
  },
  {
    // ③ 忘了把物品并进 ITEMS（items.js 的合并行）⇒ 46 件全进不去
    name: '③ items.js 漏合并 GAP_ITEMS（物品根本没进游戏）',
    rel: ITEMSJS,
    from: "import { GAP_ITEMS } from './lateGapFood.js'\nfor (const def of GAP_ITEMS) ITEMS[def.id] = def",
    to: "import { GAP_ITEMS } from './lateGapFood.js'\nvoid GAP_ITEMS",
    expect: IN_ITEMS,
  },
  {
    // ④ 种子没上架（shop.js 忘了 push）⇒ 玩家买不到、也就种不出来
    name: '④ shop.js 漏 push GAP_SEED_SHOP（4 颗种子买不到）',
    rel: SHOP,
    from: "import { GAP_SEED_SHOP } from './lateGapFood.js'\nSHOP_ITEMS.push(...GAP_SEED_SHOP)",
    to: "import { GAP_SEED_SHOP } from './lateGapFood.js'\nvoid GAP_SEED_SHOP",
    expect: SHOPPED,
  },
  {
    // ⑤ 种子没进 SEED_MAP ⇒ 采摘/挖掘附产掉不到、也种不出来
    name: '⑤ 一颗种子没进 SEED_MAP（附产掉不到）',
    rel: GAP,
    from: "  gap_far_101: 'gap_far_101Seed',\n",
    to: '',
    expect: SHOPPED,
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
