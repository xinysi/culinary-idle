// 内容同步审计 — 改动后「必须」先跑本脚本，再跑图鉴三查（item_triple_audit.mjs）。
// 覆盖六项：任务 / 成就 / 故事 / 称号 / 统计 / 游玩攻略。
// 运行：node scripts/ci/content_sync_audit.mjs
import fs from 'fs'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances } from '../../src/game/skills/registry.js'
import { ITEMS } from '../../src/game/data/items.js'
import { COMBAT_BOSSES } from '../../src/game/data/combat.js'
import { ALL_ACHIEVEMENTS } from '../../src/game/data/achievements.js'
import { QUESTS } from '../../src/game/data/quests.js'
import { DAILY_POOL, WEEKLY_POOL } from '../../src/game/data/dailyTasks.js'
import { STORY } from '../../src/game/data/story.js'
import { GUIDE_STAGES, GUIDE_OVERVIEW } from '../../src/game/data/guide.js'
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
  // 改为**自己定位**定义 storyCur 的那个视图文件——以后再搬家也不会失效（找不到就明确 FAIL）。
  const storyFile = fs.readdirSync('src/views').filter((f) => f.endsWith('.vue'))
    .map((f) => `src/views/${f}`).find((p) => read(p).includes('function storyCur'))
  check('故事：能定位定义 storyCur 的视图文件', !!storyFile, storyFile ? storyFile : '未找到（检查是否改名/删除）')
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
  ]
  // ── 2026-09-11 修「守卫自身有盲区」：上面这份白名单是**手抄**的，新系统忘了往里加时这条检查恒真，
  //    等于 PASS 而不设防（本轮就是这么漏掉信箱/厨友的）。因此再叠加一条**从侧栏派生**的检查：
  //    左栏「功能」页签里的每个页面，都必须在攻略总览里找到对应关键词。
  //    关键词默认取磁贴名，个别叫法与攻略用语不同的在此显式映射。
  const VIEW_GUIDE_KEYWORD = {
    weather: '天气', quests: '任务', achievements: '成就',
    flavorBook: '风味搭配', gear: '装备', setMeals: '套餐', rivals: '同业竞争',
    decor: '装饰', gearContest: '厨具大赛', chefChallenge: '名厨挑战', realm: '秘境',
    deluxe: '珍馐阁', michelin: '米其林', legacy: '师徒传承', patrons: '食神信仰',
    codexExchange: '图鉴兑换', festival: '节庆', spiritStories: '食灵',
  }
  const derived = [...new Set([...sidebarSrc.matchAll(/\{ icon: '[^']*', name: '([^']+)', view: '([a-zA-Z]+)'/g)]
    .map((m) => ({ name: m[1], view: m[2] })))]
  const derivedMiss = derived
    .filter((d) => !ovText.includes(VIEW_GUIDE_KEYWORD[d.view] ?? d.name))
    .map((d) => `${d.view}(${d.name}→${VIEW_GUIDE_KEYWORD[d.view] ?? d.name})`)
  check(`攻略：左栏全部功能页均有攻略关键词（派生检查 ${derived.length} 页）`, derivedMiss.length === 0, `缺: ${derivedMiss.join(', ')}`)

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

  // 每个功能页都要有「相关页面」跳转条（2026-09-10 补）：把 navViews 落到具体 .vue 文件后逐个检查
  const viewFiles = new Map()
  for (const m of appSrc.matchAll(/const (\w+View) = defineAsyncComponent/g)) viewFiles.set(m[1], m[1])
  const viewTagToName = {}
  for (const m of appSrc.matchAll(/<([A-Za-z0-9]+View)\s+v-else-if="ui\.activeView === '([a-zA-Z]+)'"/g)) viewTagToName[m[2]] = m[1]
  // 只查左栏「功能」页签里的页面（顶栏 7 个高频入口是主功能区，不在此范围）
  const sideViews = [...new Set([...sidebarSrc.matchAll(/view: '([a-zA-Z]+)'/g)].map((m) => m[1]))]
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
      for (const m of line.matchAll(/(['"`])((?:\\.|(?!\1).){2,}\1)/g)) {
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

// ── 英文标识符裸露（2026-09-13 用户报「很多页面出现 tier」后立；同日补：**模板文本**也要扫）──
// 面向玩家的中文里**不该出现内部字段名**。两处来源都要扫：
//   ① JS/模板里的**字符串字面量**（剔除 `${...}`（花括号配对，吃嵌套模板）与 Vue `{{...}}` 插值）；
//   ② `.vue` 的**模板文本节点**（先按「引号感知」剥掉整段标签与属性，再剥 `{{...}}`）——
//      ⚠️ 第二轮才补上这条：宴会/常客/餐厅/同业榜的 `tier ≥ N`、`最低 tier` 全是**模板静态文本**，
//      只扫字符串字面量会漏（用户就是先在宴会上看到的）。
{
  const IDS = /\b(tier|minTier|tierReq|reqLevel|itemId|itemName|itemQty|qty|pct|skillId|defId|slotId|amount|exp)\b/
  /** 剔除模板串插值（花括号配对计数）与 Vue 插值 */
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

process.exit(fail === 0 ? 0 : 1)
