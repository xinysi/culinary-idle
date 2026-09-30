// 内容同步审计 — 改动后「必须」先跑本脚本，再跑图鉴三查（item_triple_audit.mjs）。
// 覆盖六项：任务 / 成就 / 故事 / 称号 / 统计 / 游玩攻略。
// 运行：node scripts/ci/content_sync_audit.mjs
import fs from 'fs'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getAllSkillInstances } from '../../src/game/skills/registry.js'
import { ITEMS } from '../../src/game/data/items.js'
import { ENCOUNTERS } from '../../src/game/data/encounters.js'
import { COMBAT_BOSSES } from '../../src/game/data/combat.js'
import { ALL_ACHIEVEMENTS } from '../../src/game/data/achievements.js'
import { QUESTS } from '../../src/game/data/quests.js'
import { DAILY_POOL, WEEKLY_POOL } from '../../src/game/data/dailyTasks.js'
import { STORY } from '../../src/game/data/story.js'
import { GUIDE_STAGES, GUIDE_OVERVIEW, guideEntryForView } from '../../src/game/data/guide.js'
import { featureGroups, guideKeywordOf } from '../../src/game/data/featureGroups.js'
import { allTitleNames } from '../../src/game/data/titles.js'

let fail = 0
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok  ${name}`)
  else {
    fail++
    console.log(`FAIL  ${name} ${detail}`)
  }
}
const read = (p) => fs.readFileSync(p, 'utf8')

/**
 * 剔除模板串插值 `${...}`（花括号配对，吃嵌套模板）与 Vue `{{...}}` 插值。
 * ⚠️ 放在**模块级**而不是某个 `{}` 块里：2026-09-27 因为把它定义在一个块内、却在另一个块里调用，
 *   抛 `ReferenceError` 让整段审计没跑完（「守卫没跑」与「守卫全绿」在日志里长得一样）。
 */
function stripInterp(str) {
  let out = ''
  for (let k = 0; k < str.length; k++) {
    if (str[k] === '$' && str[k + 1] === '{') {
      let depth = 1
      k += 2
      while (k < str.length && depth > 0) {
        if (str[k] === '{') depth++
        else if (str[k] === '}') depth--
        k++
      }
      k--
      continue
    }
    out += str[k]
  }
  return out.replace(/\{\{[^}]*\}\}/g, '')
}
/** 列出 src 下全部源码文件（.js/.vue） */
function walkSrc(dir = 'src', out = []) {
  for (const n of fs.readdirSync(dir)) {
    const p = `${dir}/${n}`
    if (fs.statSync(p).isDirectory()) walkSrc(p, out)
    else if (/\.(js|vue)$/.test(n)) out.push(p)
  }
  return out
}


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
  check('任务：目标引用有效（物品/BOSS）', badRef.length === 0, badRef.slice(0, 5).join('; '))
}

// ── 2. 成就：id 唯一 / 奖励有效 / check 可执行 ──
{
  const ids = ALL_ACHIEVEMENTS.map((a) => a.id)
  check('成就：id 唯一', new Set(ids).size === ids.length)
  const badReward = []
  for (const a of ALL_ACHIEVEMENTS) for (const id of Object.keys(a.reward?.items ?? {})) if (!ITEMS[id]) badReward.push(`${a.id}→${id}`)
  check('成就：奖励物品全部存在', badReward.length === 0, badReward.slice(0, 5).join('; '))
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
  // 2026-09-12：storyCur 从 LogView 抽到独立页 StoryView 后，写死文件名会让本检查「找不到分支」而误报。
  // 改为**自己定位**定义它的那个文件——以后再搬家也不会失效（找不到就明确 FAIL）。
  // 2026-09-19：它又从视图搬到了数据层（`src/game/data/story.js` 的 `storyReqCur`，为的是能被守卫做**行为断言**），
  // 故搜索范围从「只搜 src/views」扩到「视图 + 数据层」，并同时接受 storyCur / storyReqCur 两个名字。
  const cands = [
    ...fs.readdirSync('src/views').filter((f) => f.endsWith('.vue')).map((f) => `src/views/${f}`),
    ...fs.readdirSync('src/game/data').filter((f) => f.endsWith('.js')).map((f) => `src/game/data/${f}`),
  ]
  const storyFile = cands.find((p) => /function story(Req)?Cur\b/.test(read(p)))
  check('故事：能定位定义 storyCur/storyReqCur 的文件', !!storyFile, storyFile ? storyFile : '未找到（检查是否改名/删除）')
  const storySrc = storyFile ? read(storyFile) : ''
  const storyKinds = new Set([...storySrc.matchAll(/case '([a-zA-Z]+)':/g)].map((m) => m[1]))
  const badReq = []
  for (const ch of STORY) for (const r of ch.requirements ?? []) if (!storyKinds.has(r.kind)) badReq.push(`${ch.chapter}:${r.kind}`)
  check('故事：章节需求 kind 均有进度分支', badReq.length === 0, badReq.slice(0, 5).join('; '))
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
  check('称号：成就称号均已登记', missing.length === 0, missing.join(','))
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
  check('统计：统计页分区/行结构完整', statsViewSrc.includes('const sections = computed') && (statsViewSrc.match(/label:/g) ?? []).length >= 20)
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
    '里程碑', '年鉴', '天气', '吉祥物', '宴会', '外卖',
    // 2026-09-10 第三批：分店主题 / 供应商合约 / 名厨挑战 / 赛季回顾
    '分店主题', '供应商合约', '名厨挑战', '赛季回顾',
    // 2026-09-10 第四批：荣誉殿堂 / 图鉴兑换所 / 套餐与定食 / 同业竞争榜
    '荣誉殿堂', '图鉴兑换', '套餐', '同业竞争',
    // 2026-09-10 第五批：能量饼干的三用途（离线加时 / 战斗补给 / 回收）
    '能量饼干', '能量补给', '品鉴点',
    // 2026-09-11：信箱 / 厨友 / 行情 / 系统日志
    '信箱', '厨友', '行情', '系统日志', '今日待办', '奇遇图鉴',
    // v2.0：厨神之路（轮回天赋树）
    '厨神之路',
    '山海食经', '轮回印记',
    // 2026-09-14 挂机产线四套（手抄白名单；另有从 Sidebar 派生的那道检查，两者都要过）
    '商队线', '灵圃菌房', '温室蜂场',
    // v2.6.0：效果总览（今日组）
    '效果总览',
    // v2.9.0：副业（独立第三页签，不是功能页，所以派生检查覆盖不到它，必须手抄在这里）
    '副业', '木工', '陶艺', '编织', '刺绣', '蜡烛',
    '制箭', '制网', '香道', '年货', '玉作', '货签', '采掘器具', '造纸', '乐器', '制皂', '钱庄',
  ]
  // ── 2026-09-11 修「守卫自身有盲区」：上面这份白名单是**手抄**的，新系统忘了往里加时这条检查恒真，
  //    等于 PASS 而不设防（本轮就是这么漏掉信箱/厨友的）。因此再叠加一条**从侧栏派生**的检查：
  //    左栏「功能」页签里的每个页面，都必须在攻略总览里找到对应关键词。
  //    关键词默认取磁贴名，个别叫法与攻略用语不同的在 `featureGroups.js` 的 VIEW_GUIDE_KEYWORD 里显式映射。
  //    🔄 2026-09-21：磁贴清单从 Sidebar.vue 抽成 `src/game/data/featureGroups.js`（页面内「指南」按钮与
  //    本检查共用同一份），这里改为**直接 import**，不再正则抽源码。
  const derived = featureGroups(null).flatMap((g) => g.items.map((it) => ({ name: it.name, view: it.view })))
  const derivedMiss = derived
    .filter((d) => !ovText.includes(guideKeywordOf(d.view)))
    .map((d) => `${d.view}(${d.name}→${guideKeywordOf(d.view)})`)
  check(`攻略：左栏全部功能页均有攻略关键词（派生检查 ${derived.length} 页）`, derivedMiss.length === 0, `缺: ${derivedMiss.join(', ')}`)
  // 更强的同源检查（2026-09-21 加）：上面只看「关键词在总览文本里出现过」（可能命中别的条目），
  // 这条要求**逐页真的能解析出条目对象** —— 页面内的「📖 指南」按钮就靠它，解析不到按钮不显示。
  const noEntry = derived.filter((d) => !guideEntryForView(d.view)).map((d) => `${d.view}(${d.name})`)
  check(`攻略：每个功能页都能解析出「指南」条目（页面内按钮的数据源，${derived.length} 页）`,
    noEntry.length === 0, `无条目: ${noEntry.join(', ')}`)
  // 顶栏主页（厨藏 / 图鉴 / 装备 / 统计）**也是玩家心里的「功能页」**：这四页的指南按钮靠
  // `VIEW_GUIDE_KEYWORD` 的映射（不在左栏磁贴里，上面那条派生检查管不到）。2026-09-22 用户报
  // 「没看到变动啊」就是因为它们当时没有按钮 —— 这条断言防止哪天映射被删后**静默消失**。
  const topNavViews = ['inventory', 'log', 'equipment', 'stats']
  const noTopEntry = topNavViews.filter((v) => !guideEntryForView(v))
  check(`攻略：顶栏主页也能解析出「指南」条目（${topNavViews.join(' / ')}）`,
    noTopEntry.length === 0, `无条目: ${noTopEntry.join(', ')}`)
  // 指南按钮**必须带文字**（宽屏下顶栏按钮默认只有 emoji；纯 📘 混在 20 个 emoji 里等于没做）
  const cssSrc = read('src/styles/main.css')
  const hasGuideLabel = /\.top-nav-guide \.nav-btn-text\s*\{\s*display:\s*inline/.test(cssSrc)
    && /<span class="nav-btn-text">指南<\/span>/.test(read('src/App.vue'))
  check('攻略：指南按钮带可见文字（不是只有一个 📘 图标）', hasGuideLabel, '缺少 .top-nav-guide .nav-btn-text 的 display:inline 或按钮里的文字')
  // 接线：顶栏按钮 + 弹窗 + store 状态三处都要在（少一处就是「按钮点了没反应」的静默失效）
  const appSrc2 = read('src/App.vue')
  const uiSrc = read('src/stores/ui.js')
  const wireMiss = []
  if (!/featureGuideEntry/.test(appSrc2) || !/ui\.toggleFeatureGuide\(true\)/.test(appSrc2)) wireMiss.push('App.vue 顶栏按钮')
  if (!/<FeatureGuideModal v-if="ui\.featureGuide"/.test(appSrc2)) wireMiss.push('App.vue 弹窗挂载')
  if (!/featureGuide: false/.test(uiSrc) || !/toggleFeatureGuide\(/.test(uiSrc)) wireMiss.push('ui.js 状态/动作')
  if (!/v-html="entry\.desc"/.test(read('src/components/FeatureGuideModal.vue'))) wireMiss.push('弹窗未用 v-html 渲染富文本 desc')
  check('攻略：功能页「指南」按钮接线齐备（按钮 / 弹窗 / 状态 / v-html）', wireMiss.length === 0, `缺: ${wireMiss.join('、')}`)
  // 2026-09-26 用户⑪：技能页/副业页的指南**并入顶栏那一枚**（原先技能页标题旁还有一个内嵌 📖 指南）
  check('攻略：技能页「指南」并入顶栏同一枚（位置与功能页一致，不再各处一个）',
    !/skill-guide-btn/.test(read('src/views/SkillView.vue')) && /skillGuideEntry/.test(appSrc2) && /toggleSkillGuide/.test(appSrc2),
    '技能页又冒出内嵌指南按钮，或顶栏没有路由到 skillGuides')

  const miss = required.filter((k) => !ovText.includes(k))
  check(`攻略：总览覆盖全部功能关键词（${required.length} 个）`, miss.length === 0, `未覆盖: ${miss.join(',')}`)
  const badItem = []
  for (const cat of GUIDE_OVERVIEW) for (const it of cat.items) if (!it.icon || !it.name || !it.stage || !it.unlock || !it.desc) badItem.push(it.name ?? '?')
  check(`攻略：总览条目字段完整（${GUIDE_OVERVIEW.reduce((a, c) => a + c.items.length, 0)} 条）`, badItem.length === 0, badItem.join(','))
  const badStage = GUIDE_STAGES.filter((s) => !s.goals?.length || !s.actions?.length || !s.milestones?.length || !s.tips?.length).map((s) => s.id)
  check(`攻略：六阶段结构完整（${GUIDE_STAGES.length} 阶段）`, badStage.length === 0, badStage.join(','))
  // 导航视图 ↔ 视图注册一致（新页面漏注册会在此暴露）
  // ⚠️ 左栏「功能」页的入口清单现在住在 featureGroups.js（2026-09-21 抽出去的），别只扫 Sidebar.vue。
  const sideViewList = featureGroups(null).flatMap((g) => g.items.map((it) => it.view))
  const navViews = new Set([
    ...[...appSrc.matchAll(/view: '([a-zA-Z]+)'/g)].map((m) => m[1]),
    ...[...sidebarSrc.matchAll(/view: '([a-zA-Z]+)'/g)].map((m) => m[1]),
    ...sideViewList,
  ])
  const registered = new Set([...appSrc.matchAll(/ui\.activeView === '([a-zA-Z]+)'/g)].map((m) => m[1]))
  const unregistered = [...navViews].filter((v) => !registered.has(v))
  check(`攻略：导航入口均已注册视图（${navViews.size} 个）`, unregistered.length === 0, `未注册: ${unregistered.join(',')}`)

  // 每个功能页都要有「相关页面」跳转条（2026-09-10 补）：把 navViews 落到具体 .vue 文件后逐个检查
  const viewFiles = new Map()
  for (const m of appSrc.matchAll(/const (\w+View) = defineAsyncComponent/g)) viewFiles.set(m[1], m[1])
  const viewTagToName = {}
  for (const m of appSrc.matchAll(/<([A-Za-z0-9]+View)\s+v-else-if="ui\.activeView === '([a-zA-Z]+)'"/g)) viewTagToName[m[2]] = m[1]
  // 只查左栏「功能」页签里的页面（顶栏 7 个高频入口是主功能区，不在此范围）
  const sideViews = [...new Set([...sideViewList, ...[...sidebarSrc.matchAll(/view: '([a-zA-Z]+)'/g)].map((m) => m[1])])]
  const noRel = []
  for (const v of sideViews) {
    const comp = viewTagToName[v]
    if (!comp) continue
    let src = ''
    try { src = read(`src/views/${comp}.vue`) } catch { continue }
    if (!src.includes('<RelatedPages')) noRel.push(v)
  }
  const checked = sideViews.filter((v) => !!viewTagToName[v]).length
  check(`攻略：左栏功能页均含「相关页面」跳转条（${checked} 页）`, noRel.length === 0, `缺跳转条: ${noRel.join(',')}`)
}


// ── 7. check 误用静态扫描（2026-09-10 新增）──
// 背景：三个审计脚本 + 两个测试套件里共有 107 处把「标签」当成了条件——
//   check('分类', '说明文字', 真正的条件)  ← 签名为 (name, cond, detail) 时，第 2 参字符串恒为真
// 后果：这些断言从未生效（图鉴三查 6/8、system_test2 70/77 全是恒真），门禁形同虚设。
// 这里永久拦截：凡签名为 (name, cond, detail) 的脚本，第 2 个顶层实参不得是字符串字面量。
{
  const splitTopLevel = (src, start) => {
    let depth = 0, cur = '', args = [], inStr = null, esc = false
    for (let i = start; i < src.length; i++) {
      const ch = src[i]
      if (inStr) {
        cur += ch
        if (esc) { esc = false; continue }
        if (ch === '\\') { esc = true; continue }
        if (ch === inStr) inStr = null
        continue
      }
      if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; cur += ch; continue }
      if ('([{'.includes(ch)) depth++
      else if (ch === ')' && depth === 0) { args.push(cur.trim()); return args }
      else if (')]}'.includes(ch)) depth--
      if (ch === ',' && depth === 0) { args.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    return args
  }
  const offenders = []
  for (const f of fs.readdirSync('scripts')) {
    if (!f.endsWith('.mjs')) continue
    const src = fs.readFileSync(`scripts/${f}`, 'utf8')
    // 仅检查签名为 (name, cond, ...) 的脚本（system_test.mjs 是 (area, name, cond, detail)，不在此列）
    if (!/const check = \(name, cond/.test(src)) continue
    for (const m of src.matchAll(/(^|\n)[ \t]*check\(/g)) {
      const at = m.index + m[0].length
      const args = splitTopLevel(src, at)
      if (args.length >= 3 && /^\s*(['"`])/.test(args[1] ?? '')) {
        const line = src.slice(0, at).split('\n').length
        offenders.push(`${f}:${line}`)
      }
    }
  }
  check(`脚本：check 无「第 2 参传字符串」误用（扫描 ${fs.readdirSync('scripts').filter((f) => f.endsWith('.mjs')).length} 个脚本）`, offenders.length === 0, `恒真调用: ${offenders.slice(0, 6).join(', ')}`)
}

console.log(fail === 0 ? '\nCONTENT SYNC AUDIT PASS（任务/成就/故事/称号/统计/攻略）' : `\n${fail} FAILURES`)
// ── 组件 import 守卫（2026-09-12 立）────────────────────────────
// 模板里用了 PascalCase 组件却没 import → Vue **静默不渲染**（不报错、构建也过）。
// 本轮把对照表改成 <FoldCard> 时 FestView 就漏了 import：页面照常打开、只是那一块凭空消失，
// 是浏览器里量「折叠卡数量」才发现的。这里逐个视图核对「用到的组件都有来源」。
{
  const GLOBALS = new Set(['Teleport', 'Transition', 'TransitionGroup', 'KeepAlive', 'Suspense', 'Component', 'Fragment', 'Text', 'Comment'])
  const missing = []
  let scanned = 0
  for (const d of ['src/views', 'src/views/minigames', 'src/components']) {
    if (!fs.existsSync(d)) continue
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.vue')) continue
      const p = `${d}/${f}`
      const src = read(p)
      const t = src.indexOf('<template>')
      if (t < 0) continue
      const tpl = src.slice(t)
      const script = src.slice(0, t)
      for (const m of tpl.matchAll(/<([A-Z][A-Za-z0-9]+)(?=[\s/>])/g)) {
        const tag = m[1]
        if (GLOBALS.has(tag)) continue
        // 递归组件按文件名自引用（<script setup> 支持），不算缺 import
        if (tag === f.replace(/\.vue$/, '')) continue
        // ⚠️ 必须用 String.raw：普通模板串里 \s 会被吃成 s、\b 被吃成 b，正则会静默失效（本轮踩过）
        const ok = new RegExp(String.raw`import\s+${tag}\b`).test(script)
          || new RegExp(String.raw`const\s+${tag}\s*=`).test(script)
          || new RegExp(String.raw`components\s*:\s*\{[^}]*\b${tag}\b`).test(script)
        if (!ok && !missing.includes(`${p}: <${tag}>`)) missing.push(`${p}: <${tag}>`)
      }
      scanned++
    }
  }
  check(`视图：模板里用到的组件都有来源（扫描 ${scanned} 个 .vue）`, missing.length === 0, missing.slice(0, 8).join(', '))
}

// ── 文本质量守卫（2026-09-12 立）──────────────────────────────
// 起因：gen_tales 的 **11 个模板丢了 `」`**（其中一个还把 `」` 打成 `】`），产出的 33 条轶事文案
// 括号不配平——这是玩家能直接看到的「错字/少字」，却是靠人工扫描才发现的。
// 这里扫**数据模块里面向玩家的中文串**（不含 .vue：模板片段会误报），查四类硬伤：
//   ① 括号不配平（（）「」《》【】）② 乱码/替换符 ③ 占位符残留（TODO/占位/待补）④ 空串
{
  const BRACKETS = [['（', '）'], ['「', '」'], ['《', '》'], ['【', '】']]
  const MOJI = /锛|鈥|锟斤拷|\uFFFD/
  const PLACE = /TODO|FIXME|占位|待补|待定/
  const bad = []
  const files = fs.readdirSync('src/game/data').filter((f) => f.endsWith('.js'))
  for (const f of files) {
    const lines = read(`src/game/data/${f}`).split('\n')
    lines.forEach((line, i) => {
      // 🔴 **先剔除 `${...}` 插值，再切字符串字面量**（2026-09-27 修，两处都是真踩过的坑）：
      //   ① 插值里写 `(`/`)`（如 `fn(a, (x) => x)`）会让「按括号计数」的判据失衡；
      //   ② 模板串里**再嵌一层反引号**（`总 ${f((x) => `+${x}`)}`）时，下面那条 `(['"`])` 正则会把
      //      外层串**从内层反引号处切断** ⇒ 里外两半各报一次「括号不配平」（纯假阳性，实测报了 3 条）。
      //   先剥插值后外层反引号才正确配对；判据仍是「面向玩家的中文里不该有落单的括号」。
      const lineSafe = stripInterp(line)
      for (const m of lineSafe.matchAll(/(['"`])((?:\\.|(?!\1).){2,}\1)/g)) {
        const body = m[2].slice(0, -1)
        if (!/[\u4e00-\u9fa5]/.test(body)) continue
        const tag = `${f}:${i + 1}`
        if (!body.trim()) bad.push(`${tag} 空串`)
        if (MOJI.test(body)) bad.push(`${tag} 乱码「${body.slice(0, 24)}」`)
        if (PLACE.test(body)) bad.push(`${tag} 占位符「${body.slice(0, 24)}」`)
        for (const [a, b] of BRACKETS) {
          const na = body.split(a).length - 1
          const nb = body.split(b).length - 1
          if (na !== nb) bad.push(`${tag} 括号不配平 ${a}${na}/${b}${nb}「${body.slice(0, 30)}」`)
        }
      }
    })
  }
  check(`文本：数据模块里面向玩家的中文串无「括号不配平/乱码/占位符/空串」（扫描 ${files.length} 个模块）`, bad.length === 0, bad.slice(0, 6).join('; '))
}

// ── markdown 粗体裸露守卫（2026-09-21 立）────────────────────
// 起因：项目**没有通用 markdown 渲染器**（唯一的 `segs()` 只在 SkillGuideModal 里服务 skillGuides.js），
// 所以数据里写 `**粗体**`、渲染点用 `{{ }}` 或 v-html 都会把星号**原样显示给玩家**。
// 实测攻略 / 副业 materialNote / 扩建说明 / 10 个小游戏模式说明共 **66 处**（13 个文件）。
// 正确写法：数据里写 `<b>x</b>` + 渲染点 `v-html`。
// 排除：skillGuides.js（它是唯一走 markdown 解析器的，**故意**保留 `**`）。
// ⚠️ 只认「带中文的字符串字面量」⇒ 注释里的 `**`（代码注释不带引号）天然不会误报；
//    反例验证：把任意一处 `<b>` 改回 `**` → 本项 FAIL 并点名。
{
  const bad = []
  const targets = [
    ...fs.readdirSync('src/game/data').filter((f) => f.endsWith('.js') && f !== 'skillGuides.js').map((f) => `src/game/data/${f}`),
    ...walkSrc('src/views/minigames').filter((f) => f.endsWith('.vue')),
  ]
  for (const p of targets) {
    read(p).split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/(['"`])((?:\\.|(?!\1).){2,}\1)/g)) {
        const body = m[2].slice(0, -1)
        if (!/[\u4e00-\u9fa5]/.test(body)) continue
        if (/\*\*[^*\n]+\*\*/.test(body)) bad.push(`${p}:${i + 1} 「${body.slice(0, 34)}」`)
      }
    })
  }
  check(`文本：面向玩家的中文串里没有 markdown 的 **（会原样显示；改用 <b> + v-html）（扫描 ${targets.length} 个文件）`,
    bad.length === 0, bad.slice(0, 6).join('; '))
}

// ── 英文标识符裸露（2026-09-13 用户报「很多页面出现 tier」后立；同日补：**模板文本**也要扫）──
// 面向玩家的中文里**不该出现内部字段名**。两处来源都要扫：
//   ① JS/模板里的**字符串字面量**（剔除 `${...}`（花括号配对，吃嵌套模板）与 Vue `{{...}}` 插值）；
//   ② `.vue` 的**模板文本节点**（先按「引号感知」剥掉整段标签与属性，再剥 `{{...}}`）——
//      ⚠️ 第二轮才补上这条：宴会/常客/餐厅/同业榜的 `tier ≥ N`、`最低 tier` 全是**模板静态文本**，
//      只扫字符串字面量会漏（用户就是先在宴会上看到的）。
{
  // ⚠️ 这份清单是**手抄**的（历史上的 tier/reqLevel 那批）。2026-09-26 试过改成「全量技能 id + 类别 id 派生」，
  //    结果被 `'铜-weapon-copperKnife'` 这类**数据主键**（含中文因此被当成面向玩家的串）打出一片假阳性 ——
  //    「哪些 id 会漏到界面上」不是能靠词表猜的，改成**两处精确的覆盖断言**（见下面两条 check）更可靠。
  const IDS = /\b(tier|minTier|tierReq|reqLevel|itemId|itemName|itemQty|qty|pct|skillId|defId|slotId|amount|exp|foraging|fishing|hunting|excavation|woodcutting|mining|cooking|baking|brewing|preserving|spiceMixing|craftsmithing|opp\(\))\b/
  // stripInterp 见模块级定义（2026-09-27 上提：块内定义跨块调用会 ReferenceError）
  /** 剥掉模板里的标签与属性（引号感知：属性值里可能有 > 或引号） */
  function stripTags(tpl) {
    let out = ''
    let inTag = false
    let quote = ''
    for (let k = 0; k < tpl.length; k++) {
      const c = tpl[k]
      if (inTag) {
        if (quote) { if (c === quote) quote = '' ; continue }
        if (c === '"' || c === "'") { quote = c; continue }
        if (c === '>') { inTag = false; out += '\u0001' } // 标签结束 → 插一个分隔符（保证行号不变）
        continue
      }
      if (c === '<' && /[a-zA-Z/!]/.test(tpl[k + 1] ?? '')) { inTag = true; continue }
      out += c
    }
    return out
  }
  const bad = []
  let scanned = 0
  for (const f of walkSrc()) {
    const src = read(f)
    const isVue = f.endsWith('.vue')
    // ① 字符串字面量
    src.split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return // 注释不管
      for (const m of line.matchAll(/(['"`])((?:\.|(?!\1).){2,}\1)/g)) {
        const body = m[2].slice(0, -1)
        if (!/[\u4e00-\u9fa5]/.test(body)) continue
        scanned++
        if (IDS.test(stripInterp(body))) bad.push(`${f}:${i + 1} 「${body.slice(0, 40)}」`)
      }
    })
    // ② .vue 模板文本节点
    if (isVue) {
      const tm = src.match(/<template>([\s\S]*?)\n<\/template>/)
      if (tm) {
        stripTags(tm[1]).split('\n').forEach((line, i) => {
          const body = stripInterp(line).trim()
          if (!/[\u4e00-\u9fa5]/.test(body)) return
          scanned++
          if (IDS.test(body)) bad.push(`${f} 模板:${i + 1} 「${body.slice(0, 40)}」`)
        })
      }
    }
  }
  check(`文本：面向玩家的中文里无英文标识符裸露（字符串字面量 + 模板文本，共扫 ${scanned} 条；插值不计）`, bad.length === 0, bad.slice(0, 6).join('; '))

  // ── 物品**类别 id** 不许直接进模板（2026-09-26 用户⑯：「宴会里还有类似 baking 的英文」）──
  // 真凶在常客页：同一张页面里，表格用 `catLabel(r.category)`、卡片却写 `{{ r.def.category }}`
  // ⇒ 露出「偏好：baking（需 3 档以上）」。判据：模板里**裸插值某个 `.category` / `.cat` 字段**即 FAIL
  // （要走 `catLabel()` / `CATEGORY_LABEL[...]` 这类映射；传参、当 key 用不算）。
  {
    const rawCat = []
    // 允许清单：这些 `.category` / `.cat` **不是物品类别 id**（分别是攻略条目类别 / 成就类别 /
    // 奥义类别（本来就是中文的攻击·防御·采集）/ 小游戏商店里手写的中文分组名）
    const ALLOW_RAW_CAT = new Set([
      'FeatureGuideModal.vue|entry.category',
      'AchievementsView.vue|r.a.category',
      'GastronomyView.vue|a.category',
      'GameShopView.vue|g.cat',
    ])
    for (const f of walkSrc()) {
      if (!f.endsWith('.vue')) continue
      // 注释不算（项目里注释常举例字段名；JS 的 // 行与模板的 <!-- --> 都剥掉）
      const src = read(f)
        .replace(/<!--[\s\S]*?-->/g, '')
        .split('\n')
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join('\n')
      const re = /\{\{\s*[\w.?[\]'"]*\.(?:category|cat)\s*\}\}/g
      let m
      while ((m = re.exec(src))) {
        const key = `${f.split('/').pop()}|${m[0].replace(/[{}\s]/g, '')}`
        if (ALLOW_RAW_CAT.has(key)) continue
        rawCat.push(`${f.split('/').pop()}: ${m[0].trim()}`)
      }
    }
    check('文本：模板里没有裸插值物品类别 id（必须过 catLabel/CATEGORY_LABEL）', rawCat.length === 0, rawCat.slice(0, 6).join('; '))
  }

  // ── 标签表必须**覆盖全部 id**（2026-09-26 用户⑯ 抓到的真缺陷就是这个）──
  // `SKILL_LABEL` 漏了 `flavorArtistry`（还留着一个 stale 的 `flavor`——那是流派 id）⇒ 食灵效果文案
  // 落到 `?? k` 兜底，页面上印出「flavorArtistry经验 +7%」。类别同理：`CATEGORY_LABEL` 少一个键，
  // 图鉴/商店/制作页任意一处 `CATEGORY_LABEL[c] ?? c` 都会露英文。
  {
    const { SKILL_DEFS } = await import('../../src/game/data/skills.js')
    const { CATEGORY_LABEL } = await import('../../src/game/data/itemDetail.js')
    const detailSrc = read('src/game/data/itemDetail.js')
    const labelBlock = detailSrc
      .slice(detailSrc.indexOf('const SKILL_LABEL = {'), detailSrc.indexOf('const STYLE_LABEL'))
      .replace(/\/\/.*$/gm, '') // 剥注释：注释里常举例写出键名（本项目已有两次被自己的注释打回）
    const labelKeys = [...labelBlock.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map((m) => m[1])
    const missSkill = Object.keys(SKILL_DEFS).filter((id) => !labelKeys.includes(id))
    const stale = labelKeys.filter((k) => !(k in SKILL_DEFS))
    check('文本：技能中文表覆盖全部技能 id（缺一个就会在界面上露英文 id）', missSkill.length === 0 && stale.length === 0,
      `缺: ${missSkill.join(', ') || '无'} · 多余(stale): ${stale.join(', ') || '无'}`)
    const usedCats = new Set()
    for (const it of Object.values(ITEMS)) if (it.category) usedCats.add(it.category)
    const missCat = [...usedCats].filter((c) => !(c in CATEGORY_LABEL))
    check(`文本：物品类别中文表覆盖全部在用类别（${usedCats.size} 类）`, missCat.length === 0, `缺: ${missCat.join(', ') || '无'}`)
  }
}

// ── 跳转目标必须是已注册视图（2026-09-13 全量走查发现：山海食经「去收集」调了 `setView('farming')`，
//    而 `farming` 既不在 ui.VIEW_KEYS 也没有 App.vue 分支 → 生产环境落到兜底技能页，表现为「点农耕跳到采摘」）──
{
  const keysSrc = read('src/stores/ui.js')
  const keys = ((keysSrc.match(/VIEW_KEYS\s*=\s*\[([\s\S]*?)\]/) ?? ['', ''])[1].match(/'([a-zA-Z]+)'/g) ?? []).map((x) => x.slice(1, -1))
  const bad = []
  for (const f of walkSrc()) {
    read(f).split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
      for (const m of line.matchAll(/(?:setView|go|view)\s*[:(]\s*'([a-zA-Z]{2,})'/g)) {
        if (!keys.includes(m[1])) bad.push(`${f}:${i + 1} 「${m[1]}」`)
      }
    })
  }
  check(`跳转：所有 setView/go/view 目标都已注册（扫描 ${keys.length} 个视图键）`, bad.length === 0, bad.slice(0, 6).join('; '))
}

// ── 引用的 CSS 变量必须有定义（2026-09-14 立）──
// 起因：token 化那轮把 `linear-gradient(#e8703f, #c9542e)` 换成了 `var(--accent)`/`var(--accent-strong)`，
//   但**从未定义这两个变量** → 声明整条失效、按钮背景变透明，而文字还是 #fff → 默认皮肤下白字压白底（用户报「小游戏按钮文字/背景都变白了」）。
// 判定：`var(--x)` 里的 x 必须能在 main.css 里找到定义，或在 src 任意文件里被赋值（`--x:` / `setProperty`）。
{
  const cssPalette = read('src/styles/main.css')
  const defined = new Set((cssPalette.match(/--[a-z0-9-]+\s*:/gi) ?? []).map((x) => x.replace(/\s*:$/, '')))
  const assigned = new Set()
  const used = new Map()
  for (const f of walkSrc()) {
    // 只看代码行：剥掉整行注释与行内 /* ... */ 片段（文档注释里常写 `var(--x)` 作示例）
    const src = read(f).split('\n').map((l) => {
      const t = l.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--')) return ''
      return l.replace(/\/\*[\s\S]*?\*\//g, '')
    }).join('\n')
    for (const m of src.matchAll(/(--[a-z0-9-]+)'?\s*:/gi)) assigned.add(m[1])
    for (const m of src.matchAll(/setProperty\(\s*'([^']+)'/g)) assigned.add(m[1])
    for (const m of src.matchAll(/var\((--[a-z0-9-]+)/gi)) if (!used.has(m[1])) used.set(m[1], f)
  }
  const missing = [...used.entries()].filter(([k]) => !defined.has(k) && !assigned.has(k) && !k.startsWith('--mg-'))
  check(`样式：var() 引用的 CSS 变量都有定义（扫描 ${used.size} 个变量）`, missing.length === 0, missing.slice(0, 6).map(([k, f]) => `${k}（${f}）`).join('; '))
}

// ── 奇遇数据完整性（2026-09-14 扩：**costItem 也要查**）──
// 起因：`rat` 奇遇的 costItem 用了不存在的 `spice`。旧审计只扫 `effect.items`，而 costItem 当时**根本没有消费方**
//   （选了等于白拿），两者叠加让幽灵 id 一直没被发现。现把两处物品引用都纳入校验。
{
  const bad = []
  const ids = new Set()
  for (const e of ENCOUNTERS) {
    if (ids.has(e.id)) bad.push(`${e.id}: id 重复`)
    ids.add(e.id)
    if (!e.title || !e.body) bad.push(`${e.id}: 缺 title/body`)
    if (!Array.isArray(e.choices) || e.choices.length < 2) bad.push(`${e.id}: 分支少于 2 个`)
    for (const c of e.choices ?? []) {
      if (!c.label) bad.push(`${e.id}: 分支缺 label`)
      if (!Number.isFinite(c.effect?.gold)) bad.push(`${e.id}: 分支缺 gold`)
      for (const id of [...Object.keys(c.effect?.items ?? {}), ...Object.keys(c.costItem ?? {})]) {
        if (!ITEMS[id]) bad.push(`${e.id}: 幽灵物品「${id}」`)
      }
    }
  }
  check(`奇遇：${ENCOUNTERS.length} 个事件的 id/title/分支/物品引用都有效（含 costItem）`, bad.length === 0, bad.slice(0, 6).join('; '))
}

// ── 效果总览：注册表完整性（v2.6.0，「一个都不能漏」的技术落点）──
// 背景：全项目只有 4 个真正的乘区聚合出口（Skill.addXp / GatheringSkill.yieldExtraChance /
//   player.restaurantHourlyIncome / Combat.playerStats），其余 20 多个效果来源散装在各技能与视图里。
//   因此「效果总览」页必须逐条登记来源（src/game/data/activeEffects.js），而不是只读那几个出口。
// 本项检查：player.js 里每个**效果型访问器**（*Effects / *Boost / *Multiplier / *Mult / *Pct /
//   *Bonus / *Factor / *Chance / *Modifiers / *Hours）都必须在注册表源码里出现；
//   少数不属于「对玩家的效果」的（如 UI 进度、内部倍率）在此显式豁免并写明理由。
// ⚠️ 新增效果来源却忘了登记 → 这里 FAIL；反过来，把某条注册表行删掉也会 FAIL（双向都拦）。
{
  const playerSrc = read('src/stores/player.js')
  const effSrc = read('src/game/data/activeEffects.js')
  // 豁免：不是「作用于玩家的效果」，故不需要出现在效果总览里（每条都要写清理由）
  const EXEMPT = {
    collectionPct: '图鉴收集百分比：进度口径，不是加成（效果总览不需要展示进度）',
    yieldExtraChance: '采集额外产出几率的**内部聚合函数**，其各来源已在注册表逐条登记',
    marketBoost: '内部聚合出口（活动⊕节庆⊕天气），三者已分别登记，不重复展示合计',
    weatherBoost: '天气定义表的取值函数（按日派生），展示入口是 weatherEffects',
    aggregateMarketBoost: '限时窗口的合计函数，各窗口已逐条登记',
    expeditionRareBonus: '采集队稀有权重：已在「采集队加成」一行内合并展示',
    gemsBonus: '宝石属性：已并入「装备与强化」一行展示',
    upgradeMult: '装备强化倍率：已并入「装备与强化」一行展示',
    themeMult: '分店主题倍率：已并入「分店店长与主题」一行展示',
    toolTimeFactor: '农具时间的纯函数（数据层），展示入口是 farmTimeFactor',
    priceMultiplier: '交易所行情倍率：属于页面内价格，不是玩家增益',
    boostCraftQueues: '商店道具的一次性快进，不是持续效果',
    checkSetBonuses: '套装集齐的一次性发奖判定，属性已并入装备一行',
    setMealMult: '套餐定食的倍率换算函数，展示入口是 setMealBonus',
    favorLevelFromXp: '餐厅好感的等级换算函数，展示入口是「顾客好感小费」一行',
    regularLevelFromServes: '常客等级换算函数，展示入口是 regularTipPct',
    branchHourlyOf: '分店时收的结算入口，加成来源已在「分店店长与主题」登记',
    gainGold: '金币入账出口：其两条加成已在「金币获取加成」登记',
    noteEffectsSeen: '效果总览自身的统计写入，不是效果',
    offlineMaxHours: '离线上限的唯一出口：已在「离线结算上限」登记',
    shanhaiUnlockedTotal: '山海食经点亮数：进度口径',
  }
  const found = new Set()
  for (const m of playerSrc.matchAll(/^\s{2,}([a-zA-Z_$][\w$]*(?:Effects|Boost|Multiplier|Mult|Pct|Bonus|Factor|Chance|Modifiers|Hours))\s*\(/gm)) {
    found.add(m[1])
  }
  const missing = [...found].filter((n) => !effSrc.includes(n) && !EXEMPT[n])
  // 过期豁免 = 该名字在 player.js 里已经彻底不存在了（改名/删除后要顺手清理豁免表）
  const unusedExempt = Object.keys(EXEMPT).filter((n) => !playerSrc.includes(n))
  check(`效果总览：player.js 的 ${found.size} 个效果型访问器都已登记进效果注册表`, missing.length === 0, `漏登记: ${missing.join(', ')}`)
  check('效果总览：豁免表没有过期条目（改名/删除后要同步清理）', unusedExempt.length === 0, `失效豁免: ${unusedExempt.join(', ')}`)
  // 反向断言：注册表行数必须够多（防止有人把表清空后本项恒真）
  const rowCount = (effSrc.match(/\n\s+id: '/g) ?? []).length
  check(`效果总览：注册表登记了 ${rowCount} 条效果行（≥40 才算完整）`, rowCount >= 40, `仅 ${rowCount} 条`)
}

// ── 农耕成长系数：结算 ↔ 展示必须同源（2026-09-28 立，FARM_XP_MULT）──────────────
// 起因：成长曲线体检实测**农耕是全项目最慢的一条线**（基准 46.2 天，次慢的美食探索只有 4.0 天），
// 结构性原因是**间隔**（采摘最高档 intervalSec=8s vs 作物 growSec 最高 1080s = 135×）⇒ 加一个**读取点系数**。
// 🔴 为什么必须成对断言：这类系数最容易只接「结算」漏「展示」——玩家看到卡片写 N 经验、实际到账 2N，
//    正是本项目最忌的「显示与结算不一致」（`materialCost` 的 9 处接线就是为同一件事立的）。
{
  const { FARM_XP_MULT } = await import('../../src/game/data/farmingTuning.js')
  const { CROPS } = await import('../../src/game/skills/FarmingSkill.js')
  const { getSkillInstance } = await import('../../src/game/skills/registry.js')
  const farmSrc = read('src/game/skills/FarmingSkill.js')
  const viewSrc = read('src/views/FarmingView.vue')
  check('农耕系数：常数是 >1 的有限数（=1 即关掉）', Number.isFinite(FARM_XP_MULT) && FARM_XP_MULT > 1, `实际 ${FARM_XP_MULT}`)
  check('农耕系数：结算点用了它（`FarmingSkill` 传给 addCardXp 的 base）', /crop\.xp \* FARM_XP_MULT/.test(farmSrc))
  check('农耕系数：展示点也用了它（否则卡片写 N、实际到账 2N）', /FARM_XP_MULT/.test(viewSrc))
  check('农耕系数：展示式就是「低目标减半 × 系数」的同一算式（不是手抄一个数）',
    /Math\.round\(\(isLow\(c\) \? c\.xp \* LOW_TARGET_XP_MULT : c\.xp\) \* FARM_XP_MULT\)/.test(viewSrc))
  // 冻结数据基线：**只乘不改** —— `xp`/`growSec` 一个字节都不能动。
  // 🔴 2026-09-29 起 CROPS = 生成器产物 FARM_CROPS（199 条，冻结）+ 补档 2 条（lateGameFood.js）：
  //    所以「生成器产物未被改写」的判据要钉在 **FARM_CROPS** 上，CROPS 总量 = 199 + 2。
  const { FARM_CROPS } = await import('../../src/game/data/farmSeeds.js')
  const genXp = FARM_CROPS.reduce((a, c) => a + (c.xp ?? 0), 0)
  const genGrow = FARM_CROPS.reduce((a, c) => a + (c.growSec ?? 0), 0)
  const xpSum = CROPS.reduce((a, c) => a + (c.xp ?? 0), 0)
  const growSum = CROPS.reduce((a, c) => a + (c.growSec ?? 0), 0)
  check('农耕系数：生成器产物 FARM_CROPS 仍 184 条、xp 合计 == 52231（冻结数据未被改写）',
    FARM_CROPS.length === 184 && genXp === 52231, `实际 ${FARM_CROPS.length} 条 / xp ${genXp}`)
  check('农耕系数：生成器产物 growSec 合计 == 80020（**产出一动，材料成本系数与制作类时长口径就失准**）',
    genGrow === 80020, `实际 ${genGrow}`)
  check('农耕系数：CROPS = 生成器 199 + 补档 2 + 末段空档 4 = 205（xp/growSec 合计随之 60691 / 94120）',
    CROPS.length === 205 && xpSum === 60691 && growSum === 94120, `实际 ${CROPS.length} 条 / xp ${xpSum} / grow ${growSum}`)
  // 行为断言（真实引擎）：收获一次，捕获交给 addCardXp 的 base —— 必须等于 `crop.xp × 系数`。
  // 用「捕获 base」而不是「比总经验」：总经验上还叠着 XP 乘区/精通池，比 base 才是**这个系数**的作用点。
  setActivePinia(createPinia())
  const pf = usePlayerStore()
  pf.newGame()
  createSkillInstances(pf)
  const farm = getSkillInstance('farming')
  const crop = CROPS[0]
  pf.inventory[crop.seedId] = 5
  check('农耕系数：能种下第一个作物（行为断言的前置）', farm.plant(0, crop.seedId) === true)
  const plot = farm.plotAt(0)
  if (plot) pf.setPlot(0, { ...plot, plantedAt: Date.now() - 10 * 86400000 }) // 直接催熟，省掉等 100 秒
  let captured = null
  const origAdd = farm.addCardXp.bind(farm)
  farm.addCardXp = (base, mult, lvl) => { if (captured === null) captured = { base, lvl }; return origAdd(base, mult, lvl) }
  const harvested = farm.harvest(0)
  farm.addCardXp = origAdd
  check('农耕系数：收获成功（行为断言的前置）', harvested === true)
  check(`农耕系数：收获传给 addCardXp 的 base == crop.xp × 系数（${crop.xp} × ${FARM_XP_MULT} = ${crop.xp * FARM_XP_MULT}）`,
    captured != null && captured.base === crop.xp * FARM_XP_MULT, captured ? `实际 ${captured.base}` : '没捕获到调用')
}

// ── 山海大后期门槛：**必须是「精通总级数」，不能退回「转生次数」**（2026-09-29 立）──
// 起因：游玩时长被 buff 压缩 —— 转生/等级是**经验轴**（实测满 buff 压 59×），而精通是**动作轴**（压 1.11×）。
// 长线挂动作轴才不会被高配玩家一小时刷完。守卫钉四件事：门槛轴、比例（而不是烘死绝对值）、**没有回退**、
// 以及**线级缩放的作用面**（2026-09-29 追加：稼穑按 0.25 缩放，见生成器的 PATH_MASTERY_SCALE）。
{
  const { SHANHAI_NODES, SHANHAI_RINGS, SHANHAI_PATH_MASTERY_SCALE } = await import('../../src/game/data/shanhaiTree.js')
  const late = SHANHAI_NODES.filter((n) => (n.ring ?? 0) >= 8 && n.path !== 'ticket')
  check('山海门槛', late.length > 0, `第 8~10 环的节点数 = ${late.length}`)
  const badAxis = late.filter((n) => !n.req?.masteryPct)
  check('山海门槛 · 第 8~10 环的门槛轴是**精通总级数**（不是转生次数）', badAxis.length === 0,
    badAxis.length ? `${badAxis.length} 个节点没有 masteryPct，例如 ${badAxis[0].id}` : '')
  const backslide = SHANHAI_NODES.filter((n) => n.req?.prestige)
  check('山海门槛 · 🔴 没有任何节点仍以「转生次数」为门槛（防回退到经验轴）', backslide.length === 0,
    backslide.slice(0, 3).map((n) => n.id).join(', '))
  // 比例 = 基准（60/80/100）× 线级缩放。缩放表**只允许**被授权的线（多了就是悄悄放松了别条线）。
  const { SHANHAI_PATHS } = await import('../../src/game/data/shanhaiTree.js')
  const skillOfPath = Object.fromEntries(SHANHAI_PATHS.map((p) => [p.id, p.skill]))
  const scaleOfSkill = Object.fromEntries(Object.entries(SHANHAI_PATH_MASTERY_SCALE).map(([pid, v]) => [skillOfPath[pid] ?? pid, v]))
  const BASE = { 8: 0.6, 9: 0.8, 10: 1.0 }
  // 分支环按**本线**缩放；汇金（空隙）环按**两侧较低者**（它的门槛是 min(两线卡数)×比例，要求两条线都达到）
  const expectPct = (n) => {
    const sc = n.gap != null
      ? Math.min(scaleOfSkill[n.req?.skill ?? ''] ?? 1, scaleOfSkill[n.req?.skill2 ?? ''] ?? 1)
      : (scaleOfSkill[n.req?.skill ?? ''] ?? 1)
    return BASE[n.ring] * sc
  }
  const badPct = late.filter((n) => Math.abs((n.req?.masteryPct ?? 0) - expectPct(n)) > 1e-9)
  check('山海门槛 · 比例 = 基准 60/80/100% × 线级缩放（缩放表：' +
    (Object.keys(SHANHAI_PATH_MASTERY_SCALE).join(',') || '无') + '）', badPct.length === 0,
    badPct.slice(0, 3).map((n) => `${n.id}:${n.req?.masteryPct}≠${expectPct(n)}`).join(', '))
  check('山海门槛 · 🔴 缩放表只含被授权的线（核准到具体值：稼穑 0.5 —— 它的「一张卡」= 3750 次收获，是别线的 10~20 倍量纲；0.5 是量出来的：前 100 张 = 43.2 天，与第二名锻造 40.2 天齐平）',
    Object.keys(SHANHAI_PATH_MASTERY_SCALE).length === 1 && SHANHAI_PATH_MASTERY_SCALE.farm === 0.5,
    JSON.stringify(SHANHAI_PATH_MASTERY_SCALE))
  // 🔴 空隙（汇金）节点也必须跟着缩放：它的门槛是 min(两线卡数)×比例、且要求**两条线都达到**
  //    ⇒ 不缩的话紧挨稼穑的空隙会把门槛顶回未缩放的 100%（缩放白做）。判据：四舍五入到 4 位后与缩放假设一致。
  const gaps = SHANHAI_NODES.filter((n) => n.gap != null && (n.ring ?? 0) >= 8)
  const gapBad = gaps.filter((n) => {
    const sc = Math.min(scaleOfSkill[n.req?.skill ?? ''] ?? 1, scaleOfSkill[n.req?.skill2 ?? ''] ?? 1)
    return Math.abs((n.req?.masteryPct ?? 0) - BASE[n.ring] * sc) > 1e-9
  })
  check('山海门槛 · 🔴 汇金（空隙）节点也按两侧较低者缩放（否则会把门槛顶回去）', gapBad.length === 0,
    gapBad.slice(0, 3).map((n) => `${n.id}:${n.req?.masteryPct}`).join(', '))
  // 空隙恒不该比任一侧自己那条线的环要求更严（min(卡数)×min(比例) ≤ 卡数ᵃ×比例ᵃ）
  const gapLenient = gaps.every((n) => {
    const sc = Math.min(scaleOfSkill[n.req?.skill ?? ''] ?? 1, scaleOfSkill[n.req?.skill2 ?? ''] ?? 1)
    const scMax = Math.max(scaleOfSkill[n.req?.skill ?? ''] ?? 1, scaleOfSkill[n.req?.skill2 ?? ''] ?? 1)
    return (n.req?.masteryPct ?? 0) <= BASE[n.ring] * scMax + 1e-9
  })
  check('山海门槛 · 空隙要求不高于任一侧自己那条线的环要求（缩放后仍成立）', gapLenient)
  // 绝对值不许烘进数据（否则「卡数」会有第二份真值；加卡片时门槛不会跟着走）
  const baked = late.filter((n) => n.req?.mastery != null || n.req?.masteryTotal != null)
  check('山海门槛 · 数据里**不烘绝对值**（门槛按比例在读取点现算 ⇒ 卡数只有 masteryCardCount 一份真值）',
    baked.length === 0, baked.slice(0, 2).map((n) => n.id).join(', '))
  const ringMeta = SHANHAI_RINGS.filter((r) => r.ring >= 8)
  check('山海门槛 · 环元数据也带 masteryPct（展示/守卫同源）',
    ringMeta.length === 3 && ringMeta.every((r) => r.masteryPct > 0))
}
// ── 精通池上限：凡有卡的技能都必须 > 0（2026-09-29 抓到的洞：农耕卡是 crops，旧口径对它恒返回 0）──
{
  const { masteryPoolCap } = await import('../../src/game/core/mastery.js')
  setActivePinia(createPinia())
  const pm = usePlayerStore()
  pm.newGame()
  createSkillInstances(pm)
  // 🔴 判据必须是「存取器 vs 实例自身卡数」的**两侧对账**。
  //    第一版写的是「有卡但池上限为 0」⇒ 旧写法下农耕卡数是 **0**，被 `n<=0 continue` 直接跳过 ⇒
  //    **永远抓不到它要抓的那个洞**（反例验证当场抓到的假绿）。改成两侧对账后，农耕 0≠199 立刻红。
  const expectedOf = (inst) => inst?.targets?.length ?? inst?.recipes?.length ?? inst?.crops?.length ?? 0
  const mismatch = []
  let withCards = 0
  for (const inst of getAllSkillInstances()) {
    const expected = expectedOf(inst)
    const actual = pm.masteryCardCount?.(inst.id) ?? 0
    if (expected > 0) withCards++
    if (actual !== expected) mismatch.push(`${inst.id}: 存取器 ${actual} ≠ 实例 ${expected}`)
    else if (expected > 0 && !(masteryPoolCap(actual) > 0)) mismatch.push(`${inst.id}: 池上限为 0`)
  }
  // ⚠️ **判据必须放在第 2 个参数**：我第一版把动态文案写成第 2 个参数（`check(名字, 模板串, 条件, 详情)`）⇒
//    条件落到第 3 位被忽略、而第 2 位收到一个非空字符串（恒真）⇒ **断言永远绿**。
//    反例验证当场抓到（注入旧写法时它照样 ok）—— 这就是「4 个参数的 check」这种假绿长什么样。
  check('精通池', mismatch.length === 0, `扫了 ${withCards} 个技能；不一致：${mismatch.slice(0, 4).join('；') || '无'}`)
  check('精通池', pm.masteryCardCount('farming') === 205,
    `农耕卡数 = ${pm.masteryCardCount('farming')}（它的卡是 crops，= 生成器 199 + 补档 2 + 末段空档 4；旧口径恒 0 ⇒ 池一辈子填不满、四档加成全失效）`)
}

// ── 厨神之路门槛：**印记之外必须有「精通总级数」这道地板**（2026-09-29 立）──
// 起因同山海：轮回印记是「转生次数派生」= **经验轴**（实测满 buff 压 59×）⇒ 整条厨神之路对高配玩家等于不存在。
// 精通是动作轴（压 1.11×）⇒ 给每层加一条并列门槛，高配玩家才有一块刷不掉的地板。
{
  const { DAO_TIER_MASTERY, daoCanUnlock } = await import('../../src/game/data/daoTree.js')
  const tiers = Object.values(DAO_TIER_MASTERY)
  check(`厨神门槛 · 门槛表三层齐全且严格递增（${tiers.join(' / ')}）`,
    tiers.length === 3 && tiers.every((v, i) => v > 0 && (i === 0 || v > tiers[i - 1])), JSON.stringify(DAO_TIER_MASTERY))
  // 行为：印记管够但精通为 0 ⇒ 一层节点仍被「精通总级数」挡住（这就是高配玩家的地板）
  const r0 = daoCanUnlock('g1', [], 999, 0)
  check('厨神门槛 · 🔴 印记管够（999）而精通为 0 ⇒ 仍被挡住，且原因点明「精通总级数」',
    r0.ok === false && /精通总级数/.test(r0.reason), r0.reason)
  // 行为：精通达标后这条不再拦（其余门槛可能还挡，所以断言「原因里不再提精通」）
  const r1 = daoCanUnlock('g1', [], 999, DAO_TIER_MASTERY[1])
  check('厨神门槛 · 精通达标（1500）后「精通总级数」这条不再拦', !/精通总级数/.test(r1.reason), r1.reason)
  // 外环（觅珍环）不受影响：它走「全树已解锁数」分支，不吃精通门槛
  const rx = daoCanUnlock('x1', [], 999, 0)
  check('厨神门槛 · 外环觅珍环不受精通门槛影响（仍按「全树已解锁数」判）', /全树已解锁/.test(rx.reason), rx.reason)
  // 静态接线：store 的那个出口必须**真的把精通总级数传进去**（漏传 = 门槛静默失效）
  const pl = read('src/stores/player.js')
  check('厨神门槛 · store 的 `daoCanUnlock` 把 `totalMasteryLevels()` 传进了出口（漏传即静默失效）',
    /daoCanUnlock\(id,\s*this\.daoUnlocked\s*\?\?\s*\[\],\s*this\.daoPoints\(\),\s*this\.totalMasteryLevels\(\)\)/.test(pl))
  // 🔴 **每个调用点都要接上第 4 参**（通用守卫）：
  //    加门槛参数时最容易漏的是**视图侧**——本轮就漏了 `DaoView`（它调 `daoCanUnlock(id, unlocked, points)`
  //    不传精通 ⇒ 界面一律把节点画成「精通 0/N 锁着」而 store 其实放行 = 显示与结算不一致）。
  //    判据：模块级 `daoCanUnlock(` 的调用必须含 `totalMasteryLevels`（store 里那个同名**方法**是包装器，1 参合法）。
  {
    const files = ['src/views/DaoView.vue', 'src/stores/player.js']
    const miss = []
    for (const f of files) {
      const lines = read(f).split('\n')
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]
        if (!l.includes('daoCanUnlock(')) continue
        if (/export function daoCanUnlock/.test(l)) continue   // 出口自身
        if (/daoCanUnlock\(id\)\s*\{/.test(l)) continue        // store 里的包装器**定义**（1 参合法）
        if (/this\.daoCanUnlock\(/.test(l)) continue          // store 内部调自己的包装器（合法：包装器内部已传精通）
        // 取「本行 + 后续两行」当窗口：多行调用（store 内部那处）也覆盖得到。
        // ⚠️ 别用 `\(([^)]*)\)` 抠参数 —— `this.daoPoints()` 的内层括号会把它截断 ⇒ **误报**（本轮踩过）
        const window = lines.slice(i, i + 3).join('\n')
        if (!window.includes('totalMasteryLevels')) miss.push(`${f}:${i + 1}  ${l.trim().slice(0, 70)}`)
      }
    }
    check('厨神门槛 · 所有调用点都接上了精通总级数（漏一处就是显示与结算不一致）',
      miss.length === 0, miss.join('；'))
  }
}

// ── 大后期「满足点」两条零美术的轴（2026-09-29 立）────────────────────────────────
// 起因：体检发现本作内容密度**方向与 Melvor 相反**（Melvor 越后期越密），且 **Lv101-120 没有任何新目标**。
// 补「新物品」要美术，所以先做两条零美术的：
//   ① **等级台阶**（`levelPerks.js`）：82~120 每 2 级一个称号 + 技能页的「下一档」提示（纯收藏、不给数值）
//   ② **副业阶梯扩到 16 档**（`LADDER_TIERS`）：把 91~120 段纳入（原 12 档在练到 100 级前就耗尽）
{
  const { LEVEL_PERKS, LEVEL_PERK_START, LEVEL_PERK_END, levelPerkAt, nextLevelPerk, levelPerksReached } = await import('../../src/game/data/levelPerks.js')
  const { LADDER_TIERS } = await import('../../src/game/data/sidelineWorks.js')
  const { allTitleNames } = await import('../../src/game/data/titles.js')
  // ① 等级台阶表：覆盖 82~120、步长 2、无重复、称号名唯一
  const levels = LEVEL_PERKS.map((p) => p.level)
  check('后期满足点 · 等级台阶覆盖 82~120 且步长 2、共 20 档',
    LEVEL_PERKS.length === 20 && levels[0] === LEVEL_PERK_START && levels[levels.length - 1] === LEVEL_PERK_END
    && levels.every((v, i) => i === 0 || v - levels[i - 1] === 2), `实际 ${levels.length} 档：${levels[0]}~${levels[levels.length - 1]}`)
  check('后期满足点 · 台阶称号名唯一（不与他人重名）',
    new Set(LEVEL_PERKS.map((p) => p.title)).size === LEVEL_PERKS.length)
  check('后期满足点 · 台阶称号已进「全部称号名」出口（称号总量口径同源，audit_sync 的 README 钉也读它）',
    LEVEL_PERKS.every((p) => allTitleNames().includes(p.title)))
  check('后期满足点 · 达成是**派生**的（level >= 档位即算，不需要存档账本）',
    levelPerksReached(LEVEL_PERK_END).length === LEVEL_PERKS.length && levelPerksReached(LEVEL_PERK_START - 1).length === 0
    && levelPerkAt(LEVEL_PERK_START)?.level === LEVEL_PERK_START && levelPerkAt(LEVEL_PERK_START + 1) === null)
  check('后期满足点 · 未满级时「下一档」存在（技能页就是靠它显示「还差几级」）',
    nextLevelPerk(1)?.level === LEVEL_PERK_START && nextLevelPerk(LEVEL_PERK_END) === null)
  // ② 副业阶梯：严格递增 + **末档不许再加深**（2026-09-29 试过扩到 16 档覆盖 91~120，被硬顶挡回：
//    加档按 perTier×档数 等比抬高各轴总量 ⇒ 陶艺的地窖上限顶破 CELLAR_SLOT_VALUE_MAX=40000）
  check('后期满足点 · 副业阶梯仍为 12 档（扩档会等比抬高轴总量、顶破硬顶，见 LADDER_TIERS 的说明）',
    LADDER_TIERS.length === 12 && LADDER_TIERS.every((v, i) => i === 0 || v > LADDER_TIERS[i - 1]),
    `${LADDER_TIERS.length} 档，末档 ${LADDER_TIERS[LADDER_TIERS.length - 1].toLocaleString('en-US')}`)
  // 展示同源：三处消费点都必须读同一个出口
  {
    const sk = read('src/views/SkillView.vue')
    const av = read('src/views/AchievementsView.vue')
    const bs = read('src/game/bootstrap.js')
    check('后期满足点 · 展示同源：技能页用 nextLevelPerk、称号页用 LEVEL_TITLES、升级日志用 levelPerkAt',
      sk.includes('nextLevelPerk') && av.includes('LEVEL_TITLES') && bs.includes('levelPerkAt'))
    const panel = read('src/components/SidelineWorkPanel.vue')
    check('后期满足点 · 副业面板的档数从 LADDER_TIERS.length 派生（不手写 12/16）',
      panel.includes('LADDER_TIERS.length') && !/\d+\s*档<\/b>/.test(panel.replace(/\{\{[^}]*\}\}/g, '')))
  }
}

// ── 风格经验分摊（2026-09-29）：当前风格全额、另两个风格各 1/3 ────────────────────
// 起因：风格经验原先只发给「当前用的那个风格」⇒ 3 个风格技能（刀工/摆盘/调味）**各练一遍**才全满（≈27 天）。
// 参照作 Melvor 是「一场战斗同时升多个战斗技能」⇒ 这份重复是两作的真实结构差，不是设计选择。
// 现在其他风格吃 1/3：**取舍保留**（用哪个流派快 3 倍）· **重复去掉**（全满 ≈16 天）。
{
  const { STYLE_OFF_XP_DIV } = await import('../../src/game/combat/Combat.js')
  const { STYLE_SKILL_IDS, STYLE_INFO } = await import('../../src/game/data/combat.js')
  check('风格经验 · 分摊分母 = 3（另两风格各 1/3）且三个风格技能 id 齐全',
    STYLE_OFF_XP_DIV === 3 && STYLE_SKILL_IDS.length === 3
    && STYLE_SKILL_IDS.every((id) => Object.values(STYLE_INFO).some((s) => s.skillId === id)),
    `${STYLE_OFF_XP_DIV} / ${STYLE_SKILL_IDS.join(',')}`)
  // 静态：三处风格经验写点都必须走 addStyleXp（留一处裸写 = 那条路径不给另外两个风格）
  const cb = read('src/game/combat/Combat.js')
  check('风格经验 · 没有裸写风格技能经验（`getSkillInstance(this.styleSkillId)?.addXp` 必须为空）',
    !/getSkillInstance\(this\.styleSkillId\)\?\.addXp/.test(cb))
  check('风格经验 · 三处写点都在 addStyleXp 里（命中 / 胜场 / 败场）',
    (cb.match(/this\.addStyleXp\(/g) ?? []).length === 3, `实际 ${(cb.match(/this\.addStyleXp\(/g) ?? []).length} 处`)
  // 行为（真实引擎）：同样的 amount 下，当前风格 ≈ 另两个风格的 3 倍
  {
    setActivePinia(createPinia())
    const pc = usePlayerStore()
    pc.newGame()
    createSkillInstances(pc)
    const { Combat } = await import('../../src/game/combat/Combat.js')
    const c = new Combat(pc)
    pc.setCombatStyle('knife')
    const b = { knife: pc.skills.knife.exp, plating: pc.skills.plating.exp, flavorArtistry: pc.skills.flavorArtistry.exp }
    c.addStyleXp(300)
    const d = { knife: pc.skills.knife.exp - b.knife, plating: pc.skills.plating.exp - b.plating, flavorArtistry: pc.skills.flavorArtistry.exp - b.flavorArtistry }
    const ratio = d.knife / Math.max(1, d.plating)
    check('风格经验 · 行为：当前风格 ≈ 另两个风格的 3 倍（实测 3.0~3.3，因为各自还有自己的经验乘区）',
      d.knife > 0 && d.plating > 0 && d.flavorArtistry > 0 && ratio > 2.8 && ratio < 3.4,
      `knife=${d.knife} plating=${d.plating} flavor=${d.flavorArtistry} ratio=${ratio.toFixed(2)}`)
  }
  // 🔴 界面必须把这件事讲出来（2026-09-29）：引擎改了、界面一个字没提 ⇒ 玩家不知道
  //    「换着练能把三条一起带起来」，那份改动等于白做（而且「用哪个流派那个流派快 3 倍」的取舍也没人看得见）。
  //    ⚠️ 断言写成「引用常数」而不是「模板里有 1/3」：后者在分母改成 2 时会变成假话。
  //    ⚠️ 还**连那个元素本身一起钉**（`<p …>用哪个流派…` 中间没有任何指令）——
  //       只查「文本在不在」的话，给那行挂个 `v-if="false"` 就能让它永不渲染而断言照样绿（本项目踩过同款假绿）。
  const cp = read('src/components/CombatPanel.vue')
  check('风格经验 · 对决面板写明「副风格也在涨经验」，且比例从 STYLE_OFF_XP_DIV 派生（不写死）',
    /import \{[^}]*STYLE_OFF_XP_DIV[^}]*\} from/.test(cp)
    && /Math\.round\(100 \/ STYLE_OFF_XP_DIV\)/.test(cp)
    && /<p class="dim style-note">用哪个流派，那个流派拿全额经验；另外两个流派各拿 \{\{ offStylePct \}\}%/.test(cp),
    `import=${/STYLE_OFF_XP_DIV/.test(cp)} 派生=${/Math\.round\(100 \/ STYLE_OFF_XP_DIV\)/.test(cp)} 元素=${/<p class="dim style-note">用哪个流派/.test(cp)}`)
}

process.exit(fail === 0 ? 0 : 1)
