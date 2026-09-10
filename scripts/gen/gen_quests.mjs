// 任务批量生成脚本 — 从游戏数据程序化生成 452 个新任务（q49 起，总计 500）
// 运行：node scripts/gen/gen_quests.mjs
// 产出：src/game/data/quests_extra.js（导出 QUESTS_EXT）
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
// ⚠️ 源码根与产物目录必须分开：这两者原先都由一个 base 兼任（join(__dir,'..','src')），
//    scripts 三分出 scripts/gen/ 后它指向了不存在的 scripts/src，于是 load() 全部失败、
//    生成出来的任务名/描述退回原始 id（2026-09-10 修正）。
const __SRC = join(__dir, '../../src')
const base = process.env.GEN_OUT_DIR ?? join(__SRC, 'game', 'data') // 产物输出目录

// 🔒 冻结数据门禁：本脚本产出属 AGENTS.md 数据铁律的「已固定」层，且实测重跑会改写内容——
// 重跑会换掉 452 个任务中 365 个的目标物品（例 q136「踏青采小麦」→「踏青采苹果」）。
// 默认拒绝写仓库（只拦真实目录；GEN_OUT_DIR 指向别处时放行，供 scripts/ci/gen_drift_audit.mjs 无损比对）。
const __REAL_OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../src/game/data')
if (base === __REAL_OUT_DIR && process.env.ALLOW_FROZEN_REGEN !== '1') {
  console.error('❌ 已中止：本生成器产物属「已固定」冻结数据，重跑会改写已定稿的游戏内容。')
  console.error('   重跑会换掉 452 个任务中 365 个的目标物品（例 q136「踏青采小麦」→「踏青采苹果」）。')
  console.error('   确需重跑（且已获用户批准）才显式放行：ALLOW_FROZEN_REGEN=1')
  console.error('   只想比对漂移（不写仓库）：node scripts/ci/gen_drift_audit.mjs')
  process.exit(1)
}
const d = (p) => join(__SRC, p) // 源码根相对路径（load 用）

async function load(path) {
  try { return await import('file:///' + d(path).replace(/\\/g, '/')) } catch { return null }
}

// 物品中文名（用于生成中文任务名/描述）
let itemName = (id) => id
{
  const m = await load('game/data/items.js')
  if (m?.itemName) itemName = m.itemName
}

// 采集目标收集（itemId, reqLevel）
const TARGETS = []
async function addTargets(mod, arrayName, mapFn) {
  const m = await load(mod)
  if (!m || !m[arrayName]) return
  for (const t of m[arrayName]) {
    // 兼容 { itemId, reqLevel } 与 { itemId, reqLevel, xpPerAction } 等
    TARGETS.push({ itemId: t.itemId, reqLevel: t.reqLevel ?? t.req ?? 1 })
  }
  if (mapFn) for (const t of m[arrayName]) mapFn(t)
}
await addTargets('game/skills/ForagingSkill.js', 'FORAGING_TARGETS')
await addTargets('game/skills/FishingSkill.js', 'FISHING_TARGETS')
await addTargets('game/skills/HuntingSkill.js', 'HUNTING_TARGETS')
await addTargets('game/skills/ExcavationSkill.js', 'EXCAVATION_TARGETS')
await addTargets('game/skills/FarmingSkill.js', 'CROPS')

// 采集扩展
for (const [mod, key] of [['game/data/expansion1.js', 'GATHERING_EXT'], ['game/data/expansion2.js', 'GATHERING_EXT2']]) {
  const m = await load(mod)
  if (!m || !m[key]) continue
  for (const list of Object.values(m[key])) {
    for (const t of list) TARGETS.push({ itemId: t.itemId, reqLevel: t.reqLevel ?? 1 })
  }
}

// 制作配方输出收集（{ itemId, reqLevel }）
const RECIPES = []
async function addRecipes(mod, arrayName) {
  const m = await load(mod)
  if (!m || !m[arrayName]) return
  for (const r of m[arrayName]) RECIPES.push({ itemId: r.output?.itemId ?? r.itemId, reqLevel: r.reqLevel ?? 1 })
}
await addRecipes('game/skills/CookingSkill.js', 'COOKING_RECIPES')
await addRecipes('game/skills/BakingSkill.js', 'BAKING_RECIPES')
await addRecipes('game/skills/PreservingSkill.js', 'PRESERVING_RECIPES')
await addRecipes('game/skills/BrewingSkill.js', 'BREWING_RECIPES')
await addRecipes('game/skills/SpiceMixingSkill.js', 'SPICE_RECIPES')
await addRecipes('game/skills/CraftsmithingSkill.js', 'SMITHING_RECIPES')
// 制作扩展
for (const [mod, key] of [['game/data/expansion1.js', 'PRODUCTION_EXT'], ['game/data/expansion2.js', 'PRODUCTION_EXT2']]) {
  const m = await load(mod)
  if (!m || !m[key]) continue
  for (const list of Object.values(m[key])) {
    for (const r of list) RECIPES.push({ itemId: r.output?.itemId ?? r.itemId, reqLevel: r.reqLevel ?? 1 })
  }
}
for (const [mod, key] of [['game/data/expansion1.js', 'SMITHING_EXT'], ['game/data/expansion2.js', 'SMITHING_EXT2'], ['game/data/expansion1.js', 'PRESERVE_EXT'], ['game/data/expansion2.js', 'PRESERVE_EXT2']]) {
  const m = await load(mod)
  if (!m || !m[key]) continue
  for (const r of m[key]) RECIPES.push({ itemId: r.output?.itemId ?? r.itemId, reqLevel: r.reqLevel ?? 1 })
}

// BOSS 名称
const BOSSES = []
{
  const m = await load('game/data/combat.js')
  if (m?.COMBAT_BOSSES) for (const b of m.COMBAT_BOSSES) BOSSES.push(b.name)
  const e1 = await load('game/data/expansion1.js')
  if (e1?.BOSS_EXT) for (const b of e1.BOSS_EXT) BOSSES.push(b.name ?? b)
  const e2 = await load('game/data/expansion2.js')
  if (e2?.BOSS_EXT2) for (const b of e2.BOSS_EXT2) BOSSES.push(b.name ?? b)
}

// 生成任务：按类型填充，目标 452（加上已有 48 = 500）
const qtyFor = (lvl) => Math.max(5, Math.min(30, 6 + Math.floor((lvl ?? 1) / 10) * 3))
const tasks = []
let n = 49
function push(kind, param, qty, name, desc, gold) {
  tasks.push({ id: 'q' + n, kind, param, qty, name, desc, gold })
  n++
}
// 1) 采集目标任务
for (const t of TARGETS) {
  if (tasks.length >= 452) break
  push('gather', t.itemId, qtyFor(t.reqLevel), '采集·' + '' , '', 300 + (t.reqLevel ?? 1) * 5)
}
// 2) 制作任务
for (const r of RECIPES) {
  if (tasks.length >= 452) break
  push('craft', r.itemId, 5, '', '', 400 + (r.reqLevel ?? 1) * 6)
}
// 3) boss
for (const b of BOSSES) {
  if (tasks.length >= 452) break
  push('boss', b, 1, '', '', 800)
}
// 4) 状态/技能补足
const statuses = [
  ['gold', 50000], ['gold', 200000], ['gold', 500000], ['collection', 20], ['collection', 40], ['collection', 60], ['collection', 80],
  ['seasons', 3], ['seasons', 6], ['seasons', 10], ['card', 10], ['card', 25], ['arena', 5], ['arena', 10],
  ['restaurant', 5], ['restaurant', 10], ['gear', 50], ['gear', 100], ['gear', 150], ['upgrades', 4], ['upgrades', 8], ['prestiges', 1], ['prestiges', 3], ['guild', 1],
]
const skillLv = [35, 40, 45, 50, 55, 60, 70, 80]
let si = 0
while (tasks.length < 452) {
  if (si < statuses.length) {
    const [kind, target] = statuses[si++]
    push(kind, 'total', target, '', '', 500 + target)
  } else {
    const lv = skillLv[si % skillLv.length]
    si++
    push('skillLevel30', String(lv), 3, '', '', 600 + lv)
  }
}

// 写入文件（生成中文任务名与描述）
const KIND_CN = {
  gather: '采集', craft: '制作', boss: '击败首领', explore: '探索成功',
  gold: '累计金币', collection: '图鉴收集', seasons: '赛季领奖', card: '卡牌对战胜利',
  arena: '竞技场连胜', restaurant: '餐厅等级', gear: '装备图鉴', upgrades: '强化装备',
  prestiges: '转生次数', guild: '加入公会', skillLevel30: '技能等级',
}
function itemNameCn(fallback) { return typeof itemName === 'function' ? itemName(fallback ?? '') : fallback }
function desc(t) {
  const k = t.kind
  if (k === 'boss') return `击败首领「${t.param}」。`
  if (k === 'skillLevel30') return `${t.qty > 1 ? t.qty + ' 个技能' : '一个技能'}达到 ${Number(t.param) || 30} 级。`
  if (['gold', 'collection', 'seasons', 'card', 'arena', 'restaurant', 'gear', 'upgrades', 'prestiges'].includes(k)) {
    return `${KIND_CN[k]}达到 ${t.qty}${k === 'collection' ? '%' : ''}。`
  }
  if (k === 'guild') return '加入任意公会。'
  if (k === 'craft') return `制作「${itemNameCn(t.param)}」×${t.qty}。`
  return `获得「${itemNameCn(t.param)}」×${t.qty}。`
}

// 雅致任务名模板：{x} 为目标中文名/对手名；按 kind 循环取用，避免"任务·采集·苹果"式呆板命名。
const nameSeq = {}
const CN_NAME = {
  gather: [
    '采撷{x}', '{x}满篮', '山野寻{x}', '{x}之约', '林间拾{x}', '圃中{x}', '循味觅{x}',
    '{x}初撷', '远足集{x}', '筐盈{x}', '露凝{x}', '踏青采{x}', '风物{x}', '拾翠{x}',
    '晨露{x}', '荒径{x}', '幽谷{x}', '秋实{x}', '游园拾{x}',
  ],
  craft: [
    '精制{x}', '{x}初成', '匠心{x}', '炉火煨{x}', '{x}飘香', '掌心{x}', '慢火候{x}', '{x}出炉',
    '调制{x}', '一鼎{x}', '细作{x}', '{x}呈盘', '文火{x}', '醒{x}香', '醇酿{x}', '{x}入味',
    '点染{x}', '{x}逢春', '巧手{x}', '煨{x}记',
  ],
  boss: ['力克「{x}」', '勇战「{x}」', '{x}败北', '鏖战「{x}」', '{x}俯首', '智取「{x}」'],
  skillLevel30: ['技艺新章', '登堂入室', '更上一层', '百尺竿头', '炉火纯青', '日益精进'],
  gold: ['金库满盈', '腰缠万贯', '日进斗金', '富甲一方', '点石成金'],
  collection: ['图鉴渐丰', '博采众长', '见多识广', '蕴藏之乐', '百卉千葩'],
  seasons: ['四季流转', '岁时之礼', '季节馈赠', '光阴之味'],
  card: ['牌局常胜', '对弈之乐', '棋逢对手', '运筹帷幄'],
  arena: ['连胜之路', '技压群雄', '独占鳌头', '势如破竹'],
  restaurant: ['食府兴旺', '宾客盈门', '门庭若市', '生意兴隆'],
  gear: ['武库渐丰', '利器在身', '百炼成钢', '披坚执锐'],
  upgrades: ['淬火之成', '百炼精进', '万锤之炼', '锋芒毕露'],
  prestiges: ['轮回之始', '涅槃重生', '脱胎换骨', '破茧成蝶'],
  explore: ['秘境探索', '踏遍山川', '行万里路', '寻幽访胜'],
}
function questName(t) {
  const k = t.kind
  const list = CN_NAME[k]
  if (!list) return '江湖历练'
  const x = k === 'boss' ? t.param : (k === 'skillLevel30' ? ((Number(t.param) || 30) + '级') : itemNameCn(t.param))
  // 按 kind 各取一个序号，循环模板
  nameSeq[k] = (nameSeq[k] ?? 0) + 1
  const tmpl = list[(nameSeq[k] - 1) % list.length]
  return tmpl.replaceAll('{x}', x)
}
const out = tasks.map((t) => `  {
    id: '${t.id}', name: ${JSON.stringify(questName(t))},
    desc: ${JSON.stringify(desc(t))},
    objectives: [{ kind: '${t.kind}', param: '${t.param}', qty: ${t.qty} }],
    reward: { gold: ${t.gold} },
  },`).join('\n')
const file = `// 程序化生成的任务（q49 起）— 由 scripts/gen/gen_quests.mjs 生成，勿手改\nexport const QUESTS_EXT = [\n${out}\n]\n`
writeFileSync(join(base, 'quests_extra.js'), file, 'utf8')
console.log('生成任务数:', tasks.length, '采集目标:', TARGETS.length, '配方:', RECIPES.length, 'boss:', BOSSES.length)
