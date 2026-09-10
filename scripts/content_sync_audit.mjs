// 内容同步审计 — 改动后「必须」先跑本脚本，再跑图鉴三查（item_triple_audit.mjs）。
// 覆盖六项：任务 / 成就 / 故事 / 称号 / 统计 / 游玩攻略。
// 运行：node scripts/content_sync_audit.mjs
import fs from 'fs'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../src/stores/player.js'
import { createSkillInstances } from '../src/game/skills/registry.js'
import { ITEMS } from '../src/game/data/items.js'
import { COMBAT_BOSSES } from '../src/game/data/combat.js'
import { ALL_ACHIEVEMENTS } from '../src/game/data/achievements.js'
import { QUESTS } from '../src/game/data/quests.js'
import { DAILY_POOL, WEEKLY_POOL } from '../src/game/data/dailyTasks.js'
import { STORY } from '../src/game/data/story.js'
import { GUIDE_STAGES, GUIDE_OVERVIEW } from '../src/game/data/guide.js'
import { allTitleNames } from '../src/game/data/titles.js'

let fail = 0
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok  ${name}`)
  else {
    fail++
    console.log(`FAIL  ${name} ${detail}`)
  }
}
const read = (p) => fs.readFileSync(p, 'utf8')
/** 递归读取 src 下全部源码（跨文件检查用：事件可能在 bootstrap/技能/视图里触发） */
function readAll(dir) {
  let out = ''
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) out += readAll(p)
    else if (/\.(js|vue|mjs)$/.test(e.name)) out += read(p) + String.fromCharCode(10)
  }
  return out
}
const allSrc = readAll('src')
const playerSrc = read('src/stores/player.js')
const logViewSrc = read('src/views/LogView.vue')
const statsViewSrc = read('src/views/StatsView.vue')
const appSrc = read('src/App.vue')
const sidebarSrc = read('src/components/Sidebar.vue')

// ── 1. 任务：目标 kind 必须有事件或开关处理 ──
{
  const kinds = new Set()
  for (const q of QUESTS) for (const o of q.objectives) kinds.add(o.kind)
  for (const t of [...DAILY_POOL, ...WEEKLY_POOL]) kinds.add(t.kind)
  const unhandled = [...kinds].filter((k) => {
    // 事件链可能写在 bootstrap / 技能 / 视图里（bumpQuest/bumpDaily/bumpSeason/bumpGuild），周期类走 switch
    const byEvent = [`bumpQuest('${k}'`, `bumpQuest("${k}"`, `bumpDaily('${k}'`, `bumpDaily("${k}"`, `bumpSeason('${k}'`, `bumpGuild('${k}'`].some((frag) => allSrc.includes(frag))
    const bySwitch = allSrc.includes(`case '${k}':`) || allSrc.includes(`case "${k}":`)
    return !byEvent && !bySwitch
  })
  check(`任务：全部目标 kind 有处理（${kinds.size} 种）`, unhandled.length === 0, `未处理: ${unhandled.join(',')}`)
  // 任务引用的物品/BOSS 存在
  const badRef = []
  for (const q of QUESTS) for (const o of q.objectives) {
    if (['gather', 'craft', 'harvest'].includes(o.kind) && o.param !== 'any' && !ITEMS[o.param]) badRef.push(`${q.id}:${o.param}`)
    if (o.kind === 'boss' && o.param !== 'any' && !COMBAT_BOSSES.some((b) => b.name === o.param)) badRef.push(`${q.id}:${o.param}`)
  }
  check('任务', '目标引用有效（物品/BOSS）', badRef.length === 0, badRef.slice(0, 5).join('; '))
}

// ── 2. 成就：id 唯一 / 奖励有效 / check 可执行 ──
{
  const ids = ALL_ACHIEVEMENTS.map((a) => a.id)
  check('成就', 'id 唯一', new Set(ids).size === ids.length)
  const badReward = []
  for (const a of ALL_ACHIEVEMENTS) for (const id of Object.keys(a.reward?.items ?? {})) if (!ITEMS[id]) badReward.push(`${a.id}→${id}`)
  check('成就', '奖励物品全部存在', badReward.length === 0, badReward.slice(0, 5).join('; '))
  setActivePinia(createPinia())
  const p = usePlayerStore()
  p.newGame()
  createSkillInstances(p)
  const threw = []
  for (const a of ALL_ACHIEVEMENTS) {
    try {
      const r = a.check(p)
      if (typeof r !== 'boolean') threw.push(`${a.id}(返回 ${typeof r})`)
    } catch (e) {
      threw.push(`${a.id}(${String(e).slice(0, 40)})`)
    }
  }
  check(`成就：全部 check 可执行且返回布尔（${ALL_ACHIEVEMENTS.length} 项）`, threw.length === 0, threw.slice(0, 5).join('; '))
}

// ── 3. 故事：结构完整 + 需求 kind 有 storyCur 分支 ──
{
  const storyKinds = new Set([...logViewSrc.matchAll(/case '([a-zA-Z]+)':/g)].map((m) => m[1]))
  const badReq = []
  for (const ch of STORY) for (const r of ch.requirements ?? []) if (!storyKinds.has(r.kind)) badReq.push(`${ch.chapter}:${r.kind}`)
  check('故事', '章节需求 kind 均有进度分支', badReq.length === 0, badReq.slice(0, 5).join('; '))
  const badPart = []
  for (const ch of STORY) {
    if (!ch.parts?.length) badPart.push(`${ch.chapter}(无段落)`)
    for (const part of ch.parts ?? []) if (!part.title || !part.body) badPart.push(`${ch.chapter}/${part.title ?? '?'}`)
  }
  check(`故事：每章段落标题/正文完整（${STORY.length} 章 ${STORY.reduce((a, c) => a + c.parts.length, 0)} 段）`, badPart.length === 0, badPart.slice(0, 5).join('; '))
}

// ── 4. 称号：全局唯一（成就称号 + 商店称号）──
{
  const names = allTitleNames()
  const dup = names.filter((n, i) => names.indexOf(n) !== i)
  check(`称号：名称全局唯一（${names.length} 个）`, dup.length === 0, `重复: ${[...new Set(dup)].join(',')}`)
  const missing = ALL_ACHIEVEMENTS.filter((a) => a.title && !names.includes(a.title)).map((a) => a.id)
  check('称号', '成就称号均已登记', missing.length === 0, missing.join(','))
}

// ── 5. 统计：StatsView 引用的字段必须真实存在（defaultState 或运行期赋值）──
{
  const keys = new Set([
    ...[...statsViewSrc.matchAll(/player\.stats\?\.([a-zA-Z]+)/g)].map((m) => m[1]),
    ...[...statsViewSrc.matchAll(/player\.stats\.([a-zA-Z]+)/g)].map((m) => m[1]),
  ])
  const statsLine = (playerSrc.match(/stats: \{[^\n]*/) ?? [''])[0]
  const dead = [...keys].filter((k) => {
    if (statsLine.includes(`${k}:`)) return false // defaultState 里有
    const assigned = new RegExp(`stats\\??\\.${k}\\s*(\\+\\+|=(?!=)|\\.push)`).test(allSrc)
    return !assigned
  })
  check(`统计：引用字段均有来源（${keys.size} 个）`, dead.length === 0, `无来源: ${dead.join(',')}`)
  check('统计', '统计页分区/行结构完整', statsViewSrc.includes('const sections = computed') && (statsViewSrc.match(/label:/g) ?? []).length >= 20)
}

// ── 6. 游玩攻略：总览覆盖全部系统 + 六阶段结构 + 导航视图一致 ──
{
  const ovText = JSON.stringify(GUIDE_OVERVIEW)
  const required = [
    '采集技艺', '制作技艺', '料理对决', '转生', '挂机计划',
    '餐厅经营', '装饰', '食客订单', '评论家', '分店', '常客', '地窖', '牧场', '交易所', '商店', '珍馐阁', '炼金', '觅珍',
    '首领', '困难模式', '竞技场', '挑战塔', '秘境', '试炼', '每周挑战', '卡牌',
    '装备', '强化', '词条', '套装', '宝石', '食灵', '奥义', '菜系图谱', '厨房笔记',
    '图鉴', '赛季', '探索', '采集队', '自动化', '任务', '成就', '称号', '统计', '故事',
    '小游戏', '公会', '大赛', '硬核',
    // 2026-09-10 第二批：米其林 / 风味搭配册 / 厨具大赛 / 节庆 / 菜系研究 / 雇工 / 产地 / 传承 / 信仰
    '米其林', '风味搭配', '厨具大赛', '节庆', '菜系研究', '雇工', '产地', '师徒传承', '食神信仰',
  ]
  const miss = required.filter((k) => !ovText.includes(k))
  check(`攻略：总览覆盖全部功能关键词（${required.length} 个）`, miss.length === 0, `未覆盖: ${miss.join(',')}`)
  const badItem = []
  for (const cat of GUIDE_OVERVIEW) for (const it of cat.items) if (!it.icon || !it.name || !it.stage || !it.unlock || !it.desc) badItem.push(it.name ?? '?')
  check(`攻略：总览条目字段完整（${GUIDE_OVERVIEW.reduce((a, c) => a + c.items.length, 0)} 条）`, badItem.length === 0, badItem.join(','))
  const badStage = GUIDE_STAGES.filter((s) => !s.goals?.length || !s.actions?.length || !s.milestones?.length || !s.tips?.length).map((s) => s.id)
  check(`攻略：六阶段结构完整（${GUIDE_STAGES.length} 阶段）`, badStage.length === 0, badStage.join(','))
  // 导航视图 ↔ 视图注册一致（新页面漏注册会在此暴露）
  const navViews = new Set([
    ...[...appSrc.matchAll(/view: '([a-zA-Z]+)'/g)].map((m) => m[1]),
    ...[...sidebarSrc.matchAll(/view: '([a-zA-Z]+)'/g)].map((m) => m[1]),
  ])
  const registered = new Set([...appSrc.matchAll(/ui\.activeView === '([a-zA-Z]+)'/g)].map((m) => m[1]))
  const unregistered = [...navViews].filter((v) => !registered.has(v))
  check(`攻略：导航入口均已注册视图（${navViews.size} 个）`, unregistered.length === 0, `未注册: ${unregistered.join(',')}`)
}

console.log(fail === 0 ? '\nCONTENT SYNC AUDIT PASS（任务/成就/故事/称号/统计/攻略）' : `\n${fail} FAILURES`)
process.exit(fail === 0 ? 0 : 1)
