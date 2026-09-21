// 全游戏内容同步审计 — 检查跨系统引用一致性与攻略数值
// 运行：node scripts/ci/audit_sync.mjs
import fs from 'node:fs'
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

console.log(fail === 0 ? '\nSYNC AUDIT PASS' : `\n${fail} FAILURES`)
process.exit(fail === 0 ? 0 : 1)
