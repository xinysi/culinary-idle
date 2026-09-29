// 反例验证：往季赛季件补领（C72）+ 供料可见化 —— 逐个注入真缺陷 → 跑 system_test → 断言 FAIL 且点名 → 还原。
// 用法：node scripts/dev/verify_c72.mjs            （全 13 例，每次注入跑一遍 system_test ≈ 24 秒 ⇒ 约 5 分钟）
//      node scripts/dev/verify_c72.mjs 4 5         （只跑指定序号，改完锚点小范围复验用）
// ⚠️ 两条纪律（都是踩过的）：
//   ① 锚点一律**单行或短多行**且必须唯一 —— `st.claimed.push(index)` 这类会在别处也出现（匹配 2 次 = 注入失败）；
//   ② **绝不要并发跑两个本脚本**（或与 `parallel_verify` 同时跑）：它们写的是**同一批源文件**，
//      互相 read/restore 会留下「注入未还原」的残留（实测发生一次：`seasonPast.js` 停在 slice(0,1) 那一版）。
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const P = (rel) => join(root, rel)
const CRLF = String.fromCharCode(13, 10)

/** 精确替换（必须恰好 1 处）—— 锚点按**该文件实际的换行**折叠（player.js 是 LF、.vue 是 CRLF） */
function inject(rel, from, to) {
  const orig = readFileSync(P(rel), 'utf8')
  const fold = (t) => (orig.includes(CRLF) ? t.replace(/\n/g, CRLF) : t)
  from = fold(from)
  to = fold(to)
  const n = orig.split(from).length - 1
  if (n !== 1) throw new Error(`${rel} 锚点匹配 ${n} 次（期望 1）：${from.slice(0, 60)}`)
  writeFileSync(P(rel), orig.replace(from, to), 'utf8')
}

const CASES = [
  {
    name: '① 当季也放行（补领变成「无需等轮换」⇒ 赛季点数语义被绕开）',
    rel: 'src/stores/player.js',
    from: 'if (seasonId === activeSeasonId()) return false',
    to: 'if (false) return false',
    expect: '当季',
  },
  {
    name: '② 非装备档也放行（花钱买金币档 = 金币换金币）',
    rel: 'src/stores/player.js',
    from: 'if (!ids.length) return false',
    to: 'if (false) return false',
    expect: '非装备档',
  },
  {
    name: '③ 不扣金币（白拿）',
    rel: 'src/stores/player.js',
    from: 'this.gold -= PAST_SEASON_GEAR_PRICE',
    to: 'this.gold -= 0',
    expect: '精确扣金',
  },
  {
    name: '④ 不记 claimed（可无限重买 + 累计计数不动）',
    rel: 'src/stores/player.js',
    // ⚠️ 锚点写两行才唯一：`st.claimed.push(index)` 在 seasonClaimTier 里也有一处
    from: '      this.gold -= PAST_SEASON_GEAR_PRICE\n      st.claimed.push(index)',
    to: '      this.gold -= PAST_SEASON_GEAR_PRICE\n      void index',
    expect: '买完即从清单消失',
  },
  {
    name: '⑤ 价格裸写（唯一出口破口）',
    rel: 'src/views/SeasonView.vue',
    // ⚠️ 带行首空白才唯一（同一串在说明段里也出现一次）
    from: '              {{ PAST_SEASON_GEAR_PRICE }} 金',
    to: '              50000 金',
    expect: '价格单出口',
  },
  {
    name: '⑥ 清单不排除当季（当季限定件会提前显示成「可补领」）',
    rel: 'src/game/data/seasonPast.js',
    from: 'if (!season || season.id === currentSeasonId) continue',
    to: 'if (!season) continue',
    expect: '不含当季',
  },
  {
    name: '⑦ 清单不排除已领档（买完仍挂在列表里，看着像没生效）',
    rel: 'src/game/data/seasonPast.js',
    from: 'if (claimed.includes(t.index)) continue',
    to: 'if (false) continue',
    expect: '买完即从清单消失',
  },
  {
    name: '⑧ 清单只给首件（一档 2 件时按第二件的名字搜不到）',
    rel: 'src/game/data/seasonPast.js',
    from: 'out.push({ index, itemIds, name: tier.name ?? null })',
    to: 'out.push({ index, itemIds: itemIds.slice(0, 1), name: tier.name ?? null })',
    expect: '覆盖该季全部 9 件',
  },
  {
    name: '⑨ 冻结数据被动过（套装表少一槽 ⇒ 铁律基线断言必须响）',
    rel: 'src/game/data/expansion_gear.js',
    // 选这条锚点是因为它**只改结构、不会让后续断言崩在 undefined 上**（改 `SEASONS.length` 那类会让整块抛异常、
    // 报错里反而没有 FAIL 行 ⇒ 分不清「断言咬住了」还是「脚本炸了」）
    from: '   "summer_gear_weapon",\n',
    to: '',
    expect: '冻结数据未改',
  },
  {
    name: '⑩ 图鉴来源不写第二条路径（把玩家指向「只能等」）',
    rel: 'src/game/data/itemSources.js',
    from: '（或往季每档 ${PAST_SEASON_GEAR_PRICE} 金币补领）',
    to: '',
    expect: '图鉴来源',
  },
  {
    name: '⑪ 界面按钮不接 store（页面写着能做、实际按不动）',
    rel: 'src/views/SeasonView.vue',
    from: '@click="buyPast(c)"',
    to: '@click="() => {}"',
    expect: '界面接线',
  },
  {
    name: '⑫ 成就进度退回「有领奖的季数」（显示与 check 不同源）',
    rel: 'src/game/data/achievementProgress.js',
    from: "else if (a.id.startsWith('season')) cur = Object.values(p.seasons ?? {}).reduce((t, s) => t + (s.claimed?.length ?? 0), 0)",
    to: "else if (a.id.startsWith('season')) cur = Object.values(p.seasons ?? {}).filter((s) => (s.claimed?.length ?? 0) > 0).length",
    expect: '累计口径同源',
  },
  {
    name: '⑬ 供料读原始 ingredients（漏掉材料成本系数 ⇒ 页面少算一半）',
    rel: 'src/stores/player.js',
    from: 'for (const [id, qty] of Object.entries(effIngredients(recipe))) sum += qty * this.gatherSecPerUnit(id)',
    to: 'for (const [id, qty] of Object.entries(recipe.ingredients ?? {})) sum += qty * this.gatherSecPerUnit(id)',
    expect: '供料可见化',
  },
]

const run = () => {
  try {
    return { code: 0, out: execFileSync(process.execPath, ['scripts/ci/system_test.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }) }
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

// 可选：`node scripts/dev/verify_c72.mjs 4 5` 只跑第 4、5 例（与打印的 ④⑤ 对应）
const ONLY = process.argv.slice(2).map(Number).filter((n) => n >= 1)
const PICK = ONLY.length ? CASES.map((c, i) => [c, i + 1]).filter(([, i]) => ONLY.includes(i)) : CASES.map((c, i) => [c, i + 1])

const backups = new Map()
let okAll = true
for (const [c, idx] of PICK) {
  if (!backups.has(c.rel)) backups.set(c.rel, readFileSync(P(c.rel), 'utf8'))
  try { inject(c.rel, c.from, c.to) } catch (e) { console.log(`⚠ ${c.name} —— 注入失败：${e.message}`); okAll = false; continue }
  const r = run()
  const hit = r.code !== 0 && r.out.includes('FAIL') && r.out.includes(c.expect)
  console.log(`${hit ? '✅' : '❌'} ${String(idx).padStart(2)}. ${c.name} → ${r.code === 0 ? 'system_test 仍全绿（假绿！）' : 'FAIL'}，点名含「${c.expect}」= ${r.out.includes(c.expect)}`)
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
console.log(okAll && clean ? `\n反例验证通过：${PICK.length} 个注入缺陷全部被点名，还原后恢复全绿` : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)