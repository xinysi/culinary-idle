// 反例验证：C66「新增制作内容必须进被 import 的那张表」+「图鉴来源串等级 == 配方卡生效等级」
// （2026-09-27 用户问「保鲜预览里没看到新增的？检查数据同步」时顺着查出来的两条）。
// 用法：node scripts/dev/verify_c66.mjs   （每例跑一遍 system_test，约 25 秒；共 5 例 ⇒ 约 2.5 分钟）
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
    name: '① 退回「只并进技能实例」（用户报的那个数据同步缺口原样复现）',
    rel: 'src/game/skills/PreservingSkill.js',
    from: 'PRESERVING_RECIPES.push(...PICKLE_RECIPES)',
    to: 'void PICKLE_RECIPES',
    expect: '并进了 `PRESERVING_RECIPES` 本身',
  },
  {
    name: '② 图鉴来源串退回「表内原始等级」（68 条与配方卡对不上）',
    rel: 'src/game/data/itemSources.js',
    from: "  const merged = raiseRecipeLevels([...base, ...(PRODUCTION_EXT[key] ?? []), ...(PRODUCTION_EXT2[key] ?? [])])",
    to: '  const merged = [...base, ...(PRODUCTION_EXT[key] ?? []), ...(PRODUCTION_EXT2[key] ?? [])]',
    expect: '生效**等级',
  },
  {
    name: '③ 新增配方写回过低等级（会被 raiseRecipeLevels 悄悄抬走，两处各说一个数）',
    rel: 'src/game/data/pickles.js',
    from: "reqLevel: 66, xp: 370",
    to: "reqLevel: 52, xp: 370",
    expect: '就是生效等级',
  },
  {
    name: '④ 腌制品从表里被摘掉（等价于新增时漏登记）',
    rel: 'src/game/skills/PreservingSkill.js',
    from: 'PRESERVING_RECIPES.push(...PICKLE_RECIPES)',
    to: 'PRESERVING_RECIPES.push(...PICKLE_RECIPES.filter((r) => r.id !== \'driedFungus\'))',
    expect: '并进了 `PRESERVING_RECIPES` 本身',
  },
  {
    name: '⑤ 保鲜配方整表清空（来源登记归零、基线计数也变 —— 验证这几条断言不是恒真）',
    rel: 'src/game/skills/PreservingSkill.js',
    from: 'PRESERVING_RECIPES.push(...PICKLE_RECIPES)',
    to: 'PRESERVING_RECIPES.length = 0',
    // 这条注入会被好几条断言同时抓到（扩充食谱数 / 材料基线 CAL_COUNT / 数据同步）——
    // 这里钉最贴近本批的那一条，避免「换个断言就看不出来」。
    expect: '并进了 `PRESERVING_RECIPES` 本身',
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
  if (!hit) { okAll = false; console.log(r.out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 4).join('\n')) }
  writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
}
for (const [rel, content] of backups) writeFileSync(P(rel), content, 'utf8')
const back = run()
const clean = back.code === 0 && /失败 0/.test(back.out)
console.log(`${clean ? '✅' : '❌'} 还原后 system_test 全绿（${(back.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}）`)
console.log(okAll && clean ? `\n反例验证通过：${CASES.length} 个注入缺陷全部被点名，还原后恢复全绿` : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)
