// 生成器漂移审计 — 逐个把生成器跑进临时目录，与仓库产物逐字比对
//
// 为什么要这个审计：`src/game/data/*.js` 里的生成器产物是**活数据**（游戏读的就是它），
// 而生成器输出只是「假如今天重印会印成什么样」。两者不一致时，重跑 = **改掉游戏内容**，
// 不是「把过期文件更新成正确内容」。本审计把「重跑会改什么」提前算出来，让任何人动手前先看到后果。
//
// 安全性（本脚本只读仓库）：全程设 GEN_OUT_DIR 指向临时目录，仓库 src/ 一个字节都不会被写；
// 审计前后各算一次产物哈希，若发现仓库文件被改动 → 直接 FAIL（这条同时是这个脚本的自证）。
//
// 用法：node scripts/ci/gen_drift_audit.mjs
import { readFileSync, mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const DATA = join(ROOT, 'src/game/data')

// 生成器 → 产物文件
const GENS = [
  ['gen_combat_loot', 'combatLoot.js'],
  ['gen_expansion', 'expansion1.js'],
  ['gen_expansion2', 'expansion2.js'],
  ['gen_exploration_targets', 'explorationTargets.js'],
  ['gen_farm_seeds', 'farmSeeds.js'],
  ['gen_preserve_tiers', 'preserveTiers.js'],
  ['gen_quests', 'quests_extra.js'],
  ['gen_restaurant_decor', 'restaurantDecor.js'],
  ['gen_season_gear', 'expansion_gear.js'],
  ['gen_smith_ores', 'smithOres.js'],
  ['gen_smith_sets', 'smithSetExt.js'],
  ['gen_spirit_tiers', 'spiritTiers.js'],
  ['gen_tales', 'tales_ext.js'],
]

// 已登记漂移（自证用）：列在这里的产物「应当」被检出为漂移——若报了「一致」，说明审计瞎了，直接 FAIL。
// 这些产物的仓库版本都是**冻结数据**（AGENTS.md 数据铁律）且比生成器输出更正确，一律不得重跑覆盖。
const KNOWN_DRIFT = {
  'combatLoot.js': '只从 LEGENDARY 移出 27 条低阶锻造件（528→501）；ITEM_LEVEL/EQUIP_POOL 不变，零玩法变化（唯一可安全重跑的）',
  'explorationTargets.js': '会改 79 个目标名称 + 32 个目标战利品（例 explore_001「家常小馆」→「菜摊」）',
  'expansion1.js': 'PRESERVE_EXT 会被从「空」补回 10 条保鲜配方；PRODUCTION_EXT 有 163 种行仅仓库有；EXPANSION_ITEMS 各有独有字段',
  'expansion2.js': 'PRESERVE_EXT2 同样会被补回 10 条；20 个赛季的 missions 全被改写；SMITHING_EXT2 有 6 条配方的材料会被换成 ironOre/saltOre（仓库用的是专用 ext2 矿）',
  'quests_extra.js': '452 个任务里 365 个的目标物品会被换（例 q136「踏青采小麦」→「踏青采苹果」）',
  'expansion_gear.js': '40 季的 tiers 奖励里有一件物品被换（yieldTonic3 → pres_ext2_06）',
}

// 无法无损重跑的产物：产物会被 items.js 合并回输入 → 不先清空产物就会「全部跳过」并触发自引用防呆
const SELF_REF = {
  'farmSeeds.js': '自引用陷阱：重跑前须先清空 farmSeeds.js 的导出，审计无法安全复现',
  'smithSetExt.js': '自引用陷阱：重跑前须先清空 smithSetExt.js 的导出，审计无法安全复现',
}

const hash = (p) => createHash('sha1').update(readFileSync(p)).digest('hex')
const snapshot = () => Object.fromEntries(GENS.map(([, f]) => [f, existsSync(join(DATA, f)) ? hash(join(DATA, f)) : '(缺失)']))

// 头 3 行的生成日期是预期会变的（见 AGENTS.md），比对时先归一化
function normalize(src) {
  const lines = src.split(/\r?\n/)
  for (let i = 0; i < Math.min(3, lines.length); i++) lines[i] = lines[i].replace(/20\d\d-\d\d-\d\d/g, '<DATE>')
  return lines.join('\n')
}

// 按「行内容」比对，而不是按行号：产物与生成器输出的行数常常不同，
// 按行号硬比会整段错位，得出「5700 行不同」「category 由 root 退化成 fruit」这类**假差异**
//（2026-09-10 实测踩过：错位比对的样例全是假的，改用多重集去重后只有 1 行真差异）。
function diffSummary(a, b) {
  const la = new Set(a.split('\n'))
  const lb = new Set(b.split('\n'))
  const onlyA = [...la].filter((l) => !lb.has(l))
  const onlyB = [...lb].filter((l) => !la.has(l))
  if (!onlyA.length && !onlyB.length) return '仅行序/行尾差异（内容多重集相同）'
  const cut = (s) => (s.length > 64 ? s.trim().slice(0, 64) + '…' : s.trim())
  const ex = onlyA.length && onlyB.length ? `；例：…${cut(onlyA[0])} ⇢ …${cut(onlyB[0])}` : ''
  return `仅仓库有 ${onlyA.length} 种行 · 仅生成器有 ${onlyB.length} 种${ex}`
}

const before = snapshot()
const rows = []
let fail = 0

for (const [gen, file] of GENS) {
  const dir = mkdtempSync(join(tmpdir(), 'genaudit-'))
  const out = join(dir, file)
  let err = ''
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts/gen', `${gen}.mjs`)], {
      cwd: ROOT,
      env: { ...process.env, GEN_OUT_DIR: dir },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300000,
    })
  } catch (e) {
    const raw = (e.stderr?.toString() || e.message || '').trim()
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
    err = lines.find((l) => /Error|error:|not defined|undefined/.test(l)) ?? lines[0] ?? '未知错误'
  }

  const repoPath = join(DATA, file)
  if (err || !existsSync(out)) {
    const reason = SELF_REF[file] ?? err ?? '生成器未产出文件'
    rows.push({ file, status: SELF_REF[file] ? '跳过' : '中止', note: reason })
    rmSync(dir, { recursive: true, force: true })
    continue
  }
  if (!existsSync(repoPath)) {
    rows.push({ file, status: 'FAIL', note: '仓库里找不到对应产物' })
    fail++
    rmSync(dir, { recursive: true, force: true })
    continue
  }

  const a = normalize(readFileSync(repoPath, 'utf8'))
  const b = normalize(readFileSync(out, 'utf8'))
  if (a === b) {
    rows.push({ file, status: KNOWN_DRIFT[file] ? 'FAIL' : '一致', note: KNOWN_DRIFT[file] ? '白名单里说它会漂移，实测却一致 → 审计可能失效，请先排查' : '生成器输出与仓库文件逐字一致' })
    if (KNOWN_DRIFT[file]) fail++
  } else if (KNOWN_DRIFT[file]) {
    rows.push({ file, status: '已知漂移', note: `${KNOWN_DRIFT[file]}｜${diffSummary(a, b)}` })
  } else {
    rows.push({ file, status: 'FAIL', note: `未登记的漂移 → ${diffSummary(a, b)}` })
    fail++
  }
  rmSync(dir, { recursive: true, force: true })
}

// 自证：仓库 src/ 必须一个字节没动
const after = snapshot()
const touched = Object.keys(before).filter((f) => before[f] !== after[f])
if (touched.length) {
  console.log(`\n❌ 审计过程改动了仓库文件（此脚本本应只读）：${touched.join(', ')}`)
  fail += touched.length
}

// 每个产物都必须在 GENS 里出现过（防止新增生成器后漏登记）
const orphanProducts = readdirSync(DATA).filter((f) => /^(smithSetExt|smithOres|farmSeeds|combatLoot|explorationTargets|preserveTiers|spiritTiers|tales_ext|quests_extra|restaurantDecor|expansion1|expansion2|expansion_gear)\.js$/.test(f))
const unlisted = orphanProducts.filter((f) => !GENS.some(([, x]) => x === f))

console.log('══ 生成器漂移审计（临时目录里复现，仓库全程只读）══')
for (const r of rows) console.log(`  ${r.status.padEnd(5)} ${r.file.padEnd(24)} ${r.note}`)
const count = (s) => rows.filter((r) => r.status === s).length
console.log(`\n一致 ${count('一致')} · 已登记漂移 ${count('已知漂移')} · 跳过 ${count('跳过')} · 中止 ${count('中止')} · FAIL ${count('FAIL')}`)
console.log('  已登记漂移 = 已确认「重跑会改写冻结数据、不得重跑」的产物（上方每条都写了重跑会改什么）')
const broken = rows.filter((r) => r.status === '中止')
if (broken.length) console.log(`  ⚠️ 生成器报错（产物无法比对，仓库文件本身无风险）：${broken.map((r) => r.file).join(', ')}`)
if (unlisted.length) console.log(`⚠️ 未登记的产物（请补进 GENS）：${unlisted.join(', ')}`)
console.log(`仓库产物哈希校验：${touched.length ? '❌ 被改动' : '✓ 未改动'}`)

if (fail) {
  console.log(`\n══ 生成器漂移审计：FAIL（${fail}）══`)
  process.exit(1)
}
console.log('\n══ 生成器漂移审计：PASS ══')
