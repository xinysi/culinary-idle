// 全游戏内容同步审计 — 检查跨系统引用一致性与攻略数值
// 运行：node scripts/ci/audit_sync.mjs
import { readFileSync, readdirSync } from 'node:fs'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const ROOT = fileURLToPath(new URL('../..', import.meta.url))
import { ITEMS, itemName } from '../../src/game/data/items.js'
import { COMBAT_BOSSES, COMBAT_REGIONS, STYLE_INFO, STYLE_ADVANTAGE } from '../../src/game/data/combat.js'
import { SEASONS } from '../../src/game/data/seasons.js'
import { SPIRITS } from '../../src/game/data/spiritTiers.js'
import { ALL_ACHIEVEMENTS } from '../../src/game/data/achievements.js'
import { QUESTS, questObjectiveKey } from '../../src/game/data/quests.js'
import { SHOP_ITEMS } from '../../src/game/data/shop.js'
import { CROPS } from '../../src/game/skills/FarmingSkill.js'
import { GUIDE_STAGES } from '../../src/game/data/guide.js'
import { itemSources } from '../../src/game/data/itemSources.js'

let fail = 0
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok  ${name}`)
  else {
    fail++
    console.log(`FAIL  ${name} ${detail}`)
  }
}

// ── 1. 成就奖励/任务奖励/任务目标 引用存在性 ──
{
  const bad = []
  for (const a of ALL_ACHIEVEMENTS) for (const id of Object.keys(a.reward?.items ?? {})) if (!ITEMS[id]) bad.push(`成就[${a.id}]→${id}`)
  for (const q of QUESTS) for (const id of Object.keys(q.reward?.items ?? {})) if (!ITEMS[id]) bad.push(`任务[${q.id}]→${id}`)
  for (const q of QUESTS) for (const obj of q.objectives) {
    if (['gather', 'craft', 'harvest'].includes(obj.kind) && !ITEMS[obj.param]) bad.push(`任务[${q.id}]目标→${obj.param}`)
    if (obj.kind === 'boss' && !COMBAT_BOSSES.some((b) => b.name === obj.param)) bad.push(`任务[${q.id}]BOSS→${obj.param}`)
  }
  check('引用：成就/任务奖励与目标引用全部有效', bad.length === 0, bad.slice(0, 5).join('; '))
}

// ── 2. 任务 BOSS 目标确实有该 BOSS 名称 ──
{
  const questBosses = QUESTS.flatMap((q) => q.objectives.filter((o) => o.kind === 'boss').map((o) => o.param))
  check('引用：任务引用的 BOSS 全部存在', questBosses.every((n) => COMBAT_BOSSES.some((b) => b.name === n)), questBosses.filter((n) => !COMBAT_BOSSES.some((b) => b.name === n)).join(','))
}

// ── 3. 商店条目引用有效 ──
{
  const bad = SHOP_ITEMS.filter((s) => s.itemId && !ITEMS[s.itemId]).map((s) => s.itemId)
  check('引用：商店物品全部存在', bad.length === 0, bad.join(','))
}

// ── 4. 克制三角完整性：每个风格恰好克制一个、被一个克制 ──
{
  const ok = ['knife', 'plating', 'flavor'].every((s) => STYLE_ADVANTAGE[s] && STYLE_ADVANTAGE[STYLE_ADVANTAGE[s]] !== s && Object.values(STYLE_ADVANTAGE).includes(s))
  check('对决：克制三角完整（刀→摆→调→刀）', ok, JSON.stringify(STYLE_ADVANTAGE))
  // 攻略文本中的克制指引抽查
  const guideText = GUIDE_STAGES.flatMap((s) => [...s.actions, ...s.tips]).join('')
  check('对决：攻略克制指引与数据一致（火锅真君=调味流，用摆盘）', STYLE_INFO[COMBAT_BOSSES.find((b) => b.name === '火锅真君').style].name === '调味流', 'flavor 应克?')
  const b = COMBAT_BOSSES.find((x) => x.name === '火锅真君')
  check('对决：火锅真君被摆盘克制（攻略修正生效）', STYLE_ADVANTAGE.plating === b.style, `plating→${b.style}`)
}

// ── 5. 攻略引用的 BOSS 名存在 ──
{
  const names = new Set(COMBAT_BOSSES.map((b) => b.name))
  const guideText = GUIDE_STAGES.flatMap((s) => [...s.goals, ...s.actions, ...s.milestones, ...s.tips]).join('')
  const mentioned = ['面条之王', '火锅真君', '寿司之神', '甜品女王', '分子料理博士', '中华一番', '黑暗料理王', '初代食神', '混沌厨魔', '禁忌食神']
  const miss = mentioned.filter((n) => !names.has(n))
  check('攻略：攻略提到的 BOSS 全部存在', miss.length === 0, miss.join(','))
  check('攻略：攻略确实提及了上述 BOSS', mentioned.every((n) => guideText.includes(n)), '攻略未提及: ' + mentioned.filter((n) => !guideText.includes(n)).join(','))
}

// ── 6. 攻略物品名抽查（全部存在于物品库）──
{
  const itemNames = new Set(Object.values(ITEMS).map((x) => x.name))
  // 注意：茶饮/保鲜剂 是**分类名**不是物品名；佛跳墙的真实物品名是「佛跳墙（简化版）」
  const probe = ['烤土豆', '白面包', '能量饼干', '苹果汁', '食盐', '椒盐', '酱油', '神秘调料', '玉米饼', '开水白菜', '佛跳墙（简化版）', '铜刀', '金刀', '水晶刀', '陷阱', '盛夏草帽', '苹果', '面粉', '松露', '灵果']
  const miss = probe.filter((n) => !itemNames.has(n))
  check('攻略：攻略提到的物品全部存在', miss.length === 0, `缺失: ${miss.join(',')}`)
}

// ── 7. 攻略数值抽查（与真实机制一致）──
{
  const t = GUIDE_STAGES.flatMap((s) => [...s.actions, ...s.tips]).join('')
  check('攻略：离线 12h/80% 表述', t.includes('12h') && t.includes('80%'))
  check('攻略：能量饼干 +4h 上限 +12h 表述', t.includes('+4h') && t.includes('12h'))
  check('攻略：背包 20 格/100 表述', t.includes('20 格') && t.includes('100'))
  // ⚠️ 转生加成是 +20%（`Skill.js` 的 `PRESTIGE_XP_BONUS = 0.2`）。原断言写「+10%」且靠**强化每级 +10%** 那串字样蒙过去，
  //    等于断言写错了却一直 PASS（守卫自身的口子）——现拆成两条，各查各的。
  // ⚠️ 断言更正（2026-09-19）：转生门槛是 **100 级**（`Skill.js` 的 `MAX_LEVEL = 100`；转生后上限 120）。
  // 旧断言写「99 级」是**过时口径**（历史上上限曾是 99，连代码注释里都残留过「否则 99」），
  // 它此前能通过是因为攻略里另有一句「对决 99 级解锁挑战塔」——而那扇门本轮已按参考作下调到 60，
  // 于是这条断言暴露了：**它一直在检查一个已经不存在的数字**。
  check('攻略：转生 100 级 / +20% / 120 表述', t.includes('100 级') && t.includes('+20%') && t.includes('120'))
  check('攻略：强化 +10% 表述', t.includes('+10%'))
  check('攻略：金刀 74 / 水晶刀 86 表述', t.includes('74') && t.includes('86'), '攻略未提及金刀 74 / 水晶刀 86 的锻造等级')
}

// ── 8. 图鉴来源索引：所有有来源的物品 id 有效 ──
{
  const bad = []
  for (const id of Object.keys(ITEMS)) for (const src of itemSources(id)) if (!ITEMS[id]) bad.push(id)
  check('图鉴：来源索引引用有效', bad.length === 0)
  // 每个物品至少一条来源（除少数特殊）
  const noSrc = Object.keys(ITEMS).filter((id) => itemSources(id).length === 0)
  check(`图鉴：无来源物品仅剩 ${noSrc.length} 个（特殊道具）`, noSrc.length <= 5, noSrc.join(','))
}

// ── 9. 成就阈值与真实内容同步 ──
{
  const bossAll = ALL_ACHIEVEMENTS.find((a) => a.id === 'bossAll')
  check('成就：bossAll 阈值=28（当前 28 BOSS）', bossAll.check({ stats: { bosses: Array(28).fill('x') } }), bossAll.desc)
  const seasonAll = ALL_ACHIEVEMENTS.find((a) => a.id === 'seasonAll')
  const fortySeasons = {}
  for (let i = 0; i < 40; i++) fortySeasons['s' + i] = { claimed: [1] }
  check('成就：seasonAll 阈值=40（当前 40 赛季）', seasonAll.check({ seasons: fortySeasons }), seasonAll.desc)
  // collectionPct 是 Pinia getter，普通对象上没有 → 必须显式给出该字段（此前用假对象导致恒假）
  check(
    '成就：图鉴成就阈值 ≤100 且 collectionPct 上限 100',
    ['log25', 'log50', 'log75', 'log100'].every((id) => {
      const a = ALL_ACHIEVEMENTS.find((x) => x.id === id)
      if (!a) return false
      const all = Object.fromEntries(Object.keys(ITEMS).map((k) => [k, 1]))
      const pct = Math.min(100, (Object.keys(all).length / Object.keys(ITEMS).length) * 100)
      return a.check({ collected: all, seasons: {}, collectionPct: pct }) === true
    }),
  )
}

// ── 存档字段三处一致（defaultState / serialize / applySave，2026-09-18 立）──────────
// 起因：`storyProgress`（轶事/故事进度）**只在 defaultState 里声明**，serialize 与 applySave
// 两边都漏了 —— 于是 3988 条「传闻轶事」的进度**每次刷新归零**，玩家永远解锁不了。
// 这类缺陷不报错、不白屏、既有守卫全绿，只有玩家点进去才发现 → 用源码断言钉住三处键集一致。
{
  const storeSrc = fs.readFileSync(new URL('../../src/stores/player.js', import.meta.url), 'utf8')
  /** 从 fromIdx 之后的第一个 { 开始取配平的 {...} 文本 */
  const braceBlock = (fromIdx) => {
    const i = storeSrc.indexOf('{', fromIdx)
    let d = 0
    for (let j = i; j < storeSrc.length; j++) {
      if (storeSrc[j] === '{') d++
      else if (storeSrc[j] === '}') { d--; if (d === 0) return storeSrc.slice(i, j + 1) }
    }
    return ''
  }
  /** 取某一缩进层级上的顶层 `key:` */
  const keysAt = (text, indent) => {
    const out = []
    const re = new RegExp('^ {' + indent + '}([A-Za-z_$][\\w$]*):')
    for (const ln of text.split('\n')) {
      const m = ln.match(re)
      if (m) out.push(m[1])
    }
    return out
  }
  const defKeys = keysAt(braceBlock(storeSrc.indexOf('const defaultState = () =>')), 4)
  const serKeys = keysAt(braceBlock(storeSrc.indexOf('serialize() {')), 8)
  const patchKeys = keysAt(braceBlock(storeSrc.indexOf('this.$patch({', storeSrc.indexOf('applySave(saved)'))), 8)

  // 豁免：不进存档（派生 / 一次性）；skills 在 applySave 里由局部变量合成后再 patch
  const NO_SAVE = ['todayKey', 'activeTrial', 'activeTrialOpp']
  const NO_PATCH = ['skills']
  const missSer = defKeys.filter((k) => !NO_SAVE.includes(k) && !serKeys.includes(k))
  const missPatch = serKeys.filter((k) => !NO_PATCH.includes(k) && !patchKeys.includes(k))
  const extraPatch = patchKeys.filter((k) => !serKeys.includes(k))
  check(
    '存档：三处字段一致（默认 ' + defKeys.length + ' · 存档 ' + serKeys.length + ' · 还原 ' + patchKeys.length + '）',
    missSer.length === 0 && missPatch.length === 0 && extraPatch.length === 0,
    'serialize 漏字段：' + (missSer.join(',') || '无') + '；applySave 漏还原：' + (missPatch.join(',') || '无') + '；applySave 多余：' + (extraPatch.join(',') || '无'),
  )
}

// ── 7b. 里程碑：凡是「全 / 满 / 集齐」类目标，target 必须等于真实总量 ──
// 起因（2026-09-19 审计）：成就「全清」目标写 151 而实际 262（58% 就报完成）、分店「四家」实际 6 家、常客「八位」实际 12 位、
// 套装目标 81 而实际上限 43（永远做不完）。这类错误玩家只会看到「已完成」，必须由守卫拦住回归。
{
  const { MILESTONES } = await import('../../src/game/data/milestones.js')
  const { ALL_ACHIEVEMENTS, collectionTotal } = await import('../../src/game/data/achievements.js')
  const { BRANCHES } = await import('../../src/game/data/branches.js')
  const { REGULARS } = await import('../../src/game/data/regulars.js')
  const { COLLECTABLE_SETS } = await import('../../src/game/data/setBonuses.js')
  const { SKILL_DEFS } = await import('../../src/game/data/skills.js')
  const TOTALS = {
    m_achievementAll: ALL_ACHIEVEMENTS.length,
    m_branchAll: BRANCHES.length,
    m_regularAll: REGULARS.length,
    m_gearSetAll: COLLECTABLE_SETS.length,
    m_spirit160: Object.keys(SPIRITS).length,
    m_boss28: COMBAT_BOSSES.length,
    m_season40: SEASONS.length,
  }
  const bad = []
  for (const [id, total] of Object.entries(TOTALS)) {
    const m = MILESTONES.find((x) => x.id === id)
    if (!m) { bad.push(`${id} 不存在`); continue }
    if (m.target !== total) bad.push(`${m.name}: target ${m.target} ≠ 实际 ${total}`)
  }
  check('里程碑：全/满类目标 == 真实总量（成就/分店/常客/套装/食灵/首领/赛季）', bad.length === 0, bad.join('; '))

  // hint 里的总量数字也不能飘（改了数据忘了改文案 = 玩家看到过期数字）
  const txt = MILESTONES.map((m) => `${m.name} ${m.hint}`).join(' ')
  const miss = []
  for (const [label, n] of [['成就', ALL_ACHIEVEMENTS.length], ['图鉴', collectionTotal()], ['技能', Object.keys(SKILL_DEFS).length]]) {
    if (!txt.includes(String(n))) miss.push(`${label} ${n}`)
  }
  check('里程碑：文案里的总量数字与数据一致', miss.length === 0, `缺/过期: ${miss.join(', ')}`)
}

// ── README 版本行里的「数据规模」数字与数据一致（2026-09-26 立）─────────────
// 为什么单独立这条：v2.23.0 给效果登记表加了 `fightFoeStatus`（103 → **104** 行），
// 而 README 版本行里的「效果登记表 103 条」**连着两版没人发现** —— 这类漂移没有任何守卫在看，
// 只能靠人肉对着数据数一遍（项目里已经因为同样的原因错过一次「小游戏 27/28」）。
// 判据是「README 写的 == 数据里数的」，只钉**能从一个权威导出直接数出来**的项；
// 数不出来的（如「2427 件物品」，取决于图鉴口径）不在这里钉，免得守卫本身写错。
{
  const readme = fs.readFileSync(`${ROOT}README.md`, 'utf8')
  const versionLine = readme.split('\n').find((l) => l.includes('当前版本：')) ?? ''
  const { EFFECT_ROWS } = await import('../../src/game/data/activeEffects.js')
  const { SKILL_DEFS } = await import('../../src/game/data/skills.js')
  const { SKINS } = await import('../../src/game/data/skins.js')
  const { allTitleNames } = await import('../../src/game/data/titles.js')
  const items = [
    ['效果登记表', EFFECT_ROWS.length, /效果登记表\s*(\d+)\s*条/],
    ['技能', Object.keys(SKILL_DEFS).length, /\*\*(\d+)\s*技能\*\*/],
    ['首领', COMBAT_BOSSES.length, /(\d+)\s*首领/],
    ['赛季', SEASONS.length, /(\d+)\s*赛季/],
    ['成就', ALL_ACHIEVEMENTS.length, /\*\*(\d+)\s*成就\*\*/],
    ['称号', allTitleNames().length, /\*\*(\d+)\s*称号\*\*/],
    ['皮肤', SKINS.length, /\*\*(\d+)\s*皮肤\*\*/],
  ]
  const drift = []
  for (const [label, actual, re] of items) {
    const m = versionLine.match(re)
    if (!m) drift.push(`${label} 未在版本行里出现`)
    else if (Number(m[1]) !== actual) drift.push(`${label}：README 写 ${m[1]}，实际 ${actual}`)
  }
  check('README：版本行的数据规模数字与数据一致（技能/首领/赛季/成就/称号/皮肤/效果登记表）', drift.length === 0, drift.join('; '))
}

// ── README「图鉴补全」行的物品分类数字（2026-09-28 立）──────────────────────
// 起因：2026-09-28 全量体检对照发现这一行写着「配方 1246 / 物品 2430（食材 663 / 装备 736）」，
// 而实际是 **1249 / 2434 / 666 / 740**。上一块（版本行）**钉不到这一行** —— 它是另一行、另一套数字，
// 于是静静地飘了两版（README 是公开仓库首页，在线游玩与 Releases 都指向它）。
// 判据两条：① **分项之和必须等于该行写的总数**（改一个分项忘改总数 ⇒ 立刻 FAIL）
//          ② 总数与 8 个分项逐个 == `ITEMS` 按 `type` 数出来的真实值（**不是**拿 README 自比自）
// ⚠️ 「制作配方 1249 条」不在这里钉：配方条数要建技能实例才数得出（成本高），
//    它的数据基线在 `system_test` 的 `CAL_COUNT`，改配方条数会被那边抓到。
{
  const readme = fs.readFileSync(`${ROOT}README.md`, 'utf8')
  const row = readme.split('\n').find((l) => l.includes('| 图鉴补全 |')) ?? ''
  const items = Object.values(ITEMS)
  const num = (re) => { const m = row.match(re); return m ? Number(m[1]) : NaN }
  const TYPES = [['食材', 'ingredient'], ['调料', 'spice'], ['种子', 'seed'], ['消耗品', 'consumable'], ['料理', 'food'], ['饮品', 'drink'], ['装备', 'equipment'], ['食灵', 'spirit']]
  const total = num(/\*\*物品\s*(\d+)\*\*/)
  const parts = Object.fromEntries(TYPES.map(([k]) => [k, num(new RegExp(`${k}\\s*(\\d+)`))]))
  const drift = []
  if (!row) drift.push('README 里找不到「图鉴补全」行')
  else if (!Object.values(parts).every(Number.isFinite) || !Number.isFinite(total)) drift.push(`数字没解析全：total=${total} ${JSON.stringify(parts)}`)
  else {
    const sum = Object.values(parts).reduce((a, b) => a + b, 0)
    if (sum !== total) drift.push(`分项之和 ${sum} ≠ 该行写的总数 ${total}`)
    if (total !== items.length) drift.push(`物品总数：README 写 ${total}，实际 ${items.length}`)
    for (const [k, t] of TYPES) {
      const actual = items.filter((it) => it.type === t).length
      if (parts[k] !== actual) drift.push(`${k}：README 写 ${parts[k]}，实际 ${actual}`)
    }
  }
  check('README：图鉴补全行的物品分类数字与数据一致（且分项之和 == 总数）', drift.length === 0, drift.join('; '))
}

// ── 游戏内攻略的总量数字同样不能飘（2026-09-27 立，v2.28.1）──────────────────
// 起因：延续性审计时顺手对照，发现 `guide.js` 的攻略概述里写着「成就（262）与称号（122）」，
// 而实际是 **264 / 123** —— README 那行有守卫盯着（上一块），游戏内这一份**没有**，于是它先飘了。
// 判据同 README：从展示文案里抠出数字，与实际数据比（**不是**拿数据自比自）。
{
  const { GUIDE_OVERVIEW } = await import('../../src/game/data/guide.js')
  const { EXPLORATION_TARGETS_ALL } = await import('../../src/game/data/explorationTargets.js')
  const { allTitleNames } = await import('../../src/game/data/titles.js')
  const overview = GUIDE_OVERVIEW.flatMap((c) => c.items ?? []).map((e) => `${e.name}｜${e.desc ?? ''}`).join('\n')
  const pats = [
    ['成就', ALL_ACHIEVEMENTS.length, /成就（(\d+)）/],
    ['称号', allTitleNames().length, /称号（(\d+)）/],
    ['探索目标', EXPLORATION_TARGETS_ALL.length, /美食探索（(\d+)\s*目标）/],
  ]
  const bad = []
  for (const [label, actual, re] of pats) {
    const m = overview.match(re)
    if (!m) bad.push(`${label} 未在攻略概述里出现（或格式变了）`)
    else if (Number(m[1]) !== actual) bad.push(`${label}：攻略写 ${m[1]}，实际 ${actual}`)
  }
  check('攻略：概述里的总量数字（成就/称号/探索目标）与数据一致', bad.length === 0, bad.join('; '))
}

// ── 发布面守卫（2026-09-21 立）：本地内部资料**不得进入仓库** ────────────────
// 本仓库是公开的（在线游玩与 Releases 都靠它），而项目里有一部分资料只在本地保留、不随仓库发布
// （清单见 `.gitignore` 末段）。这条守卫的作用：万一以后被 `git add -A` 误带进来，CI 立刻点名。
// ⚠️ 判据用 `git ls-files`（索引），不看磁盘：那些文件**本来就在本地**（只是不入库）。
{
  const PRIVATE = ['AGENTS.md', 'docs/', 'scripts/sim/', 'scripts/measure/', 'scripts/dev/agents_split.mjs', 'scripts/dev/agents_assemble.mjs', 'scripts/dev/agents_verify.mjs']
  let tracked = []
  try {
    const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n')
    tracked = PRIVATE.filter((p) => files.some((f) => (p.endsWith('/') ? f.startsWith(p) : f === p)))
  } catch {
    tracked = [] // 非 git 环境（解压出来的源码包）⇒ 判不了就跳过，别误报
  }
  check('发布面：本地内部资料未进入仓库', tracked.length === 0,
    `被跟踪了：${tracked.join('、')}（只该留在本地；见 .gitignore 末段）`)
}

// ── CI 守卫**自身**的假绿：3 参 check 的第 2 个实参不得是字符串字面量（2026-09-29 立）────
// 起因：`content_sync_audit` 的 check 签名是 **3 参**（`name, cond, detail`），而 `system_test` 是 **4 参**
//   （`group, name, cond, detail`）。我按后者习惯在本轮新写的断言里写成 `check('山海门槛', '描述', 条件, …)`
//   ⇒ 在 3 参文件里第 2 位收到一个**非空字符串**（恒真）、真条件落到第 3 位被忽略
//   ⇒ **那 12 条断言全是假绿**（其中一条本该抓出「视图漏传门槛参数」的缺陷，结果它「通过」了）。
// 这正是本项目最忌的「假绿守卫」，而且**任何单条断言都不会自知** ⇒ 只能靠一条**扫描守卫源码**的元守卫。
{
  const ciDir = `${ROOT}scripts/ci`
  const bad = []
  for (const f of fs.readdirSync(ciDir).filter((x) => x.endsWith('.mjs'))) {
    const src = fs.readFileSync(`${ciDir}/${f}`, 'utf8')
    const sig = src.match(/const check = \(([^)]*)\)/)
    if (!sig) continue // 自己定义 check 格式的脚本（如自建 runner）不在本判据内
    const arity = sig[1].split(',').map((x) => x.trim()).filter(Boolean).length
    if (arity !== 3) continue // 4 参签名（group, name, cond, detail）另有约定：第 2 参本来就该是名字
    src.split('\n').forEach((l, i) => {
      if (l.trim().startsWith('//') || l.trim().startsWith('*')) return
      if (/check\(\s*(['"`])[^'"`]*\1\s*,\s*['"`]/.test(l)) bad.push(`${f}:${i + 1}`)
    })
  }
  check('CI 守卫自身：3 参 check 的第 2 个实参不得是字符串字面量（会恒真 = 假绿）',
    bad.length === 0, bad.length ? `疑似：${bad.slice(0, 8).join('、')}` : '')
}

// ── CI 清单必须覆盖 scripts/ci 下的全部守卫（2026-10-02 立）────────────────────
// 起因：ci.yml 是**手写清单**，新加的 chain_reaction_test / save_migration_test 没被写进去
// ⇒ 它们只在本地 run_all.mjs 里跑、GitHub CI 里根本不跑（新脚本绕过旧清单 —— 项目里记过同款坑）。
// 判据从**目录**派生；确实不该进 CI 的显式豁免并写清理由（豁免表本身就是文档）。
{
  const CI_DIR = 'scripts/ci'
  const yml = readFileSync('.github/workflows/ci.yml', 'utf8')
  const EXEMPT = {
    'run_all.mjs': 'CI 里逐个调用它，不需要 CI 再调它',
    'exe_image_audit.mjs': '需要 Electron 运行时，CI 没有（发布流程里本地跑）',
    'dev_panel_audit.mjs': '需要 dist 产物，排在构建之后单独一步',
    'css_output_audit.mjs': '同上（排构建之后）',
  }
  const files = readdirSync(CI_DIR).filter((f) => f.endsWith('.mjs'))
  const missing = files.filter((f) => !EXEMPT[f] && !yml.includes('scripts/ci/' + f))
  check('CI 清单覆盖 scripts/ci 全部守卫（新脚本不许绕过手写清单）', missing.length === 0,
    missing.join(', ') || (files.length - Object.keys(EXEMPT).length) + ' 个已在 CI')
  // 同一类漏网的第二处：e2e 套件清单也是**手写**的（ci.yml 里逐个 `npx playwright test e2e-x.spec.mjs`）
  // ⇒ 新加的 spec 不会自动跑。判据同样从**目录**派生。
  const specs = readdirSync('.').filter((f) => f.endsWith('.spec.mjs'))
  const missSpec = specs.filter((f) => !yml.includes(f))
  check('CI 清单覆盖全部 e2e 套件（新 spec 不许绕过手写清单）', missSpec.length === 0,
    missSpec.join(', ') || specs.length + ' 套已在 CI')
}

console.log(fail === 0 ? '\nSYNC AUDIT PASS' : `\n${fail} FAILURES`)
process.exit(fail === 0 ? 0 : 1)
