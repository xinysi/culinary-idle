// 布局守卫（2026-09-18 立）— 全页面扫描两类「玩家看得见、但既有守卫全绿」的排版缺陷：
//   ① 控件被裁掉：`overflow: hidden` 的盒子里按钮/链接被切到盒外 —— 不只是难看，是**点不到**
//      （overflow:hidden 同时裁剪命中测试）。实测：炼金页固定行高 150px 装不下 192~273px 的卡片，
//      1440px 下 24 张卡里 11 张的「融合」按钮被切、窄屏全部被切，玩家根本没法炼金。
//   ② 文字挤压/逐字竖排：又窄又高的文本元素（宽度不足 2 个行高、高度超过 6 个行高）。
//      实测：390px 下牧场「饲料 玉米×3」竖排 5 行、`.grid-n-6` 强排 6 列把菜名压成竖排。
// 判定用命中测试收尾：元素中心的最顶层若就是它自己，才算「真的可见」→ 排除折叠面板/遮罩下的噪声。
import fs from 'node:fs'
import { SKILL_DEFS } from './src/game/data/skills.js'
import { test, expect } from '@playwright/test'

const src = fs.readFileSync(new URL('./src/stores/ui.js', import.meta.url), 'utf8')
const block = src.slice(src.indexOf('export const VIEW_KEYS = ['), src.indexOf(']', src.indexOf('export const VIEW_KEYS = [')))
const VIEWS = [...block.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1])
// 页面清单 = 全部 view **+ 全部 38 个技能页**。
// ⚠️ `skill` 视图只渲染「当时激活的那一个技能」⇒ 只 `setView('skill')` 是**盲区**：
//    对决的 6 个 combat 技能（CombatView）此前从未被任何页面扫描覆盖，`dropModal` 漏声明因此长期存在。
//    必须逐技能 `setActiveSkill` 再扫（与 e2e-text 对副业 16 支的做法一致，这里扩到全部 38 个）。
const SKILL_IDS = Object.keys(SKILL_DEFS)
/** [{ view, skill? }] —— skill 有值时表示「切到该技能再扫」 */
const PAGES = [
  ...VIEWS.filter((v) => v !== 'skill').map((v) => ({ view: v })),
  ...SKILL_IDS.map((id) => ({ view: 'skill', skill: id })),
]

/** 进入游戏并灌一份「满档」数据（空档很多页是空状态，看不出挤压/裁切） */
async function enterGame(page, viewport) {
  await page.setViewportSize(viewport)
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await page.locator('.splash-start-btn').click()
  await page.waitForTimeout(300)
  await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
  await page.waitForTimeout(1000)
  await page.evaluate(async () => {
    const el = document.querySelector('#app')
    const app = el.__vue_app__
    const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
    const player = pinia._s.get('player')
    const items = (await import('/src/game/data/items.js')).ITEMS
    for (const [id, it] of Object.entries(items)) { if (it.type !== 'spirit') player.inventory[id] = 999 }
    player.gold = 1e9
    player.gameCoins = 1e6
    for (const id of Object.keys(player.skills)) { player.skills[id].level = 120; player.skills[id].prestiges = 12 }
    const { ALL_ACHIEVEMENTS } = await import('/src/game/data/achievements.js')
    player.achievements = ALL_ACHIEVEMENTS.map((a) => a.id)
    const { SHANHAI_NODES } = await import('/src/game/data/shanhaiTree.js')
    player.shanhaiUnlocked = SHANHAI_NODES.map((n) => n.id)
    const { INSIGHT_NODES } = await import('/src/game/data/insightTree.js')
    player.insights = INSIGHT_NODES.map((n) => n.id)
    const { DAO_NODES } = await import('/src/game/data/daoTree.js')
    player.daoUnlocked = DAO_NODES.map((n) => n.id)
    const { REGULARS } = await import('/src/game/data/regulars.js')
    for (const r of REGULARS) player.regulars[r.id] = { serves: 99, lastDay: null, giftClaimed: false }
    const { REGIONS } = await import('/src/game/data/regions.js')
    for (const r of REGIONS) player.regions[r.id] = true
    const { EXPEDITIONS } = await import('/src/game/data/expeditions.js')
    for (const e of EXPEDITIONS) player.expeditions[e.id] = { completions: 9, slots: [{ startedAt: Date.now() - 3600e3, readyAt: Date.now() - 60e3 }] }
    player.restaurant.level = 10
  })
}

/** 底部胶囊一共六块（挂机动向 / 食灵 / 奥义 / 快捷状态 / 事件日志），逐块点开 */
const DOCK_SECS = ['idle', 'plan', 'spirit', 'aoji', 'status', 'log'] // 2026-09-27 用户⑩：+plan
async function openDock(page, sec) {
  // ⚠️ 先关掉可能压在上面的浮层：**奇遇弹窗**（`.modal-backdrop`，z-index 50）是随机触发的，
  //    守卫跑满 4 分钟期间很可能正好弹一次，把底部胶囊（z-index 46）盖住 ⇒ Playwright 的真点击
  //    被拦、5 秒超时报「modal-backdrop intercepts pointer events」（实测踩过：以为是自己改坏了）。
  //    点遮罩关闭正是玩家的真实操作，不掩盖任何缺陷。
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('.modal-backdrop')) {
      b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      b.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  await page.locator(`.dock-pill[data-sec="${sec}"]`).click({ timeout: 5000 })
  await page.waitForTimeout(250)
}


/** 展开全部折叠面板，否则面板内的内容扫不到 */
const expandAll = (root = '.main-scroll') => {
  for (const d of document.querySelectorAll(`${root} details`)) d.open = true
  for (const el of document.querySelectorAll(`${root} *`)) {
    if (el.tagName === 'SUMMARY') continue
    const t = (el.textContent || '').trim()
    if ((t === '展开' || t === '更多' || t === '全部展开') && el.offsetParent !== null) {
      try { el.click() } catch { /* 忽略 */ }
    }
  }
}

/** 扫描当前页：返回被裁掉的控件与被挤成竖排的文字 */
const scan = (root = '.main-scroll') => {
  const shown = (el) => el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })
  const clippedAway = (el, r) => {
    let p = el.parentElement
    while (p && p !== document.documentElement) {
      // 整页滚动容器（`.main-scroll`、抽屉里的滚动区）不算「裁切」——
      // 判据不能是「与滚动容器求交」：那样会把视口以下的全部内容当成不可见（实测漏查过 13 处）。
      // `overflow: hidden` 的容器**不是**滚动容器（用户滚不到），必须照旧判为裁切。
      if (!p.classList.contains('main-scroll')) {
        const cs = getComputedStyle(p)
        const clips = ['hidden', 'auto', 'scroll']
        if (clips.includes(cs.overflow) || clips.includes(cs.overflowX) || clips.includes(cs.overflowY)) {
          const vScrollable = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 2
          const hScrollable = (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 2
          const pr = p.getBoundingClientRect()
          const outV = !vScrollable && (r.bottom <= pr.top || r.top >= pr.bottom)
          const outH = !hScrollable && (r.right <= pr.left || r.left >= pr.right)
          if (outV || outH) return true
        }
      }
      p = p.parentElement
    }
    return false
  }
  const cutControl = []
  const squeeze = []
  const text = (el) => (el.textContent || el.value || el.tagName).trim().slice(0, 24)
  for (const el of document.querySelectorAll(`${root} *`)) {
    if (!shown(el)) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue
    const er = el.getBoundingClientRect()
    if (er.width < 1 || er.height < 1) continue
    // ① overflow:hidden 的盒子里，控件被切到盒外
    if (cs.overflow === 'hidden' || cs.overflowY === 'hidden' || cs.overflowX === 'hidden') {
      for (const c of el.querySelectorAll('button, a[href], select, input')) {
        const cr = c.getBoundingClientRect()
        if (cr.width < 1) continue
        // 🔴 2026-09-19 补：控件与这个 overflow:hidden 盒子之间若隔着**可滚动栏**（如装备页
        //    `.equip-pane` 在定高的 `.equip-body` 里），那它是「滚一下就能点到」的，不算被裁。
        //    不排除这一点会整栏误报（实测装备页 20+ 行全是假阳性）。
        let sp = c.parentElement
        let inScroller = false
        while (sp && sp !== el) {
          const ss = getComputedStyle(sp)
          if ((ss.overflowY === 'auto' || ss.overflowY === 'scroll') && sp.scrollHeight > sp.clientHeight + 2) { inScroller = true; break }
          sp = sp.parentElement
        }
        if (inScroller) continue
        const overY = cr.bottom > er.bottom + 2 ? cr.bottom - er.bottom : (cr.top < er.top - 2 ? er.top - cr.top : 0)
        const overX = cr.right > er.right + 2 ? cr.right - er.right : (cr.left < er.left - 2 ? er.left - cr.left : 0)
        if (overY <= 4 && overX <= 4) continue
        const cx = Math.max(er.left + 1, Math.min(cr.left + cr.width / 2, er.right - 1))
        const cy = Math.max(er.top + 1, Math.min(cr.top + cr.height / 2, er.bottom - 1))
        const at = document.elementFromPoint(cx, cy)
        cutControl.push({ ctrl: text(c), box: el.className?.toString?.().slice(0, 40), over: Math.max(overY, overX), clickable: at === c || c.contains(at) })
      }
    }
    // ② 又窄又高的文本（逐字竖排）
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('')
    if (!own || own.length > 12) continue
    if (clippedAway(el, er)) continue
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4
    if (er.height > lh * 6 && er.width < lh * 2) {
      const at = document.elementFromPoint(er.left + er.width / 2, er.top + er.height / 2)
      if (at === el || el.contains(at)) squeeze.push({ text: own.slice(0, 24), w: Math.round(er.width), h: Math.round(er.height) })
    }
  }
  return { cutControl, squeeze }
}

// ⚡ 并行切片（2026-09-21）：原来「1440px 全部页面」「390px 全部页面」两个 test 各自串行扫 105 页（合计 2.7 分钟）。
//    现在每个视口按页**轮转**切成 `E2E_SLICES`（默认 4）片 + 1 个底部面板 test ⇒ 5 个 test 并行，总时长≈1/4。
//    `E2E_SLICES=1` 退回单进程串行（排查偶发失败时用）。
/** 扫一批页面的排版缺陷 */
async function scanPages(page, viewport, pages) {
  await enterGame(page, viewport)
  const cut = []
  const sq = []
  const errs = []
  let n = 0
  page.on('pageerror', (e) => errs.push(e.message))
  // 🔴 控制台错误（2026-09-22 立）：**Vue 把渲染期抛出的错误交给 `console.error`，不会冒泡到 `pageerror`**
  //   ⇒ 「模板/脚本里引用了未声明的标识符」这类错误对上面那行完全不可见。实测代价：漏写一行
  //   `const ui = useUiStore()`（新加的奥义续航块里用了 `ui.loopTick`）→ `ui is not defined` 让**全部 40 个视图
  //   渲染成空**、对决立绘与技能列表一并消失，而布局守卫与 e2e-interact 都报绿（最后是 e2e-test 偶然点破的）。
  //   排除网络类噪声（图片 404 / favicon / vite 提示），只留真正的脚本错误。
  const consoleErrs = []
  const NOISE = /Failed to load resource|net::ERR|favicon|ERR_ABORTED|\[vite\]/
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) consoleErrs.push(m.text().slice(0, 220)) })
  for (const pg of pages) {
    const v = pg.skill ? `skill:${pg.skill}` : pg.view
    const mark = consoleErrs.length
    await page.evaluate((p) => {
      const el = document.querySelector('#app')
      const app = el.__vue_app__
      const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
      pinia._s.get('ui').setView(p.view)
      if (p.skill) pinia._s.get('player').setActiveSkill(p.skill)
    }, pg)
    await page.waitForTimeout(360)
    await page.evaluate(expandAll)
    await page.waitForTimeout(300)
    const r = await page.evaluate(scan)
    // 记「点不到」的（可点但位置越界的只是视觉溢出，不算硬缺陷）
    for (const x of r.cutControl) if (!x.clickable) cut.push(`${v} · 「${x.ctrl}」被裁 ${x.over}px（${x.box}）`)
    for (const x of r.squeeze) sq.push(`${v} · 「${x.text}」被挤成 ${x.w}×${x.h}（逐字竖排）`)
    for (const msg of consoleErrs.slice(mark)) errs.push(`${v} · 控制台错误：${msg}`)
    n++
  }
  return { cut, sq, errs, n }
}

/** 底部两条常驻提示 + 六个胶囊面板：它们不在 `.main-scroll` 里，只扫 main-scroll 会让那几块无人看管 ⇒ 逐块扫一轮。
 *  ⚠️ 必须**点胶囊**走真实路径，不要用脚本侧的 store 方法：实测在本守卫里读到的 store 与组件渲染用的不是同一个实例
 *  （flag 变 true 但 DOM 里一个面板都没有），于是整轮静默空转、靠 `drCount` 断言才抓出来。 */
async function scanDock(page, viewport) {
  await enterGame(page, viewport)
  const cut = []
  const sq = []
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  // 底部六个胶囊（2026-09-20 用户要求「五个独立的胶囊和弹出面板」）：它们不在 `.main-scroll` 里，
  // 只扫 main-scroll 会让那六块（挂机动向/食灵/奥义/快捷状态/事件日志）的排版缺陷无人看管 ⇒ 逐块扫一轮。
  // ⚠️ 必须**点胶囊**走真实路径，不要用脚本侧的 store 方法：实测在本守卫里那读到的 store 与组件渲染用的
  //    不是同一个实例（flag 变 true 但 DOM 里一个面板都没有），于是整轮静默空转、靠 `drCount` 断言才抓出来。
  // 两条常驻提示（2026-09-19 移到中间列底栏，同样不在 `.main-scroll` 里）→ 先扫一轮
  const st = await page.evaluate(scan, '.head-strips')
  const stCount = await page.evaluate(() => document.querySelectorAll('.head-strips *').length)
  for (const x of st.cutControl) if (!x.clickable) cut.push(`底部提示条 · 「${x.ctrl}」被裁 ${x.over}px（${x.box}）`)
  for (const x of st.squeeze) sq.push(`底部提示条 · 「${x.text}」被挤成 ${x.w}×${x.h}（逐字竖排）`)
  // 六个胶囊各自的面板：逐块点开→展开折叠→扫
  let drCount = 0
  for (const sec of DOCK_SECS) {
    await openDock(page, sec)
    await page.waitForTimeout(280)
    await page.evaluate(expandAll, '.dock-panel')
    await page.waitForTimeout(200)
    const dr = await page.evaluate(scan, '.dock-panel')
    drCount += await page.evaluate(() => document.querySelectorAll('.dock-panel *').length)
    for (const x of dr.cutControl) if (!x.clickable) cut.push(`底部面板(${sec}) · 「${x.ctrl}」被裁 ${x.over}px（${x.box}）`)
    for (const x of dr.squeeze) sq.push(`底部面板(${sec}) · 「${x.text}」被挤成 ${x.w}×${x.h}（逐字竖排）`)
    const cr = await page.evaluate(scan, '.dock-pill')
    for (const x of cr.squeeze) sq.push(`底部胶囊(${sec}) · 「${x.text}」被挤成 ${x.w}×${x.h}（逐字竖排）`)
  }
  await page.locator(`.dock-pill[data-sec="idle"]`).click() // 收起，别影响后续
  await page.waitForTimeout(200)
  return { cut, sq, errs, drCount, stCount }
}

// 66 个视图 × 展开折叠 + 扫描 ≈ 1 分钟/轮 ⇒ 切片后每片几十秒，timeout 给足
test.describe.configure({ timeout: 300000, mode: 'parallel' })

const SLICES = Math.max(1, Number(process.env.E2E_SLICES || 4))
const VIEWPORTS = [
  { width: 1440, height: 900, tag: '1440px' },
  { width: 390, height: 844, tag: '390px' },
]

for (const vp of VIEWPORTS) {
  for (let i = 0; i < SLICES; i++) {
    const mine = PAGES.filter((_, k) => k % SLICES === i)
    test(`布局守卫（${vp.tag} 切片 ${i + 1}/${SLICES}，${mine.length} 页）：无被裁控件/逐字竖排`, async ({ page }) => {
      const { cut, sq, errs, n } = await scanPages(page, vp, mine)
      expect(n, '这一片一页都没扫到（空转）').toBeGreaterThan(0)
      expect(cut, `以下控件被 overflow 裁掉且点不到：\n${cut.join('\n')}`).toEqual([])
      expect(sq, `以下文字被挤成逐字竖排：\n${sq.join('\n')}`).toEqual([])
      expect(errs, '页面抛错：' + errs.join(' / ')).toEqual([])
    })
  }
  test(`布局守卫（${vp.tag}）：底部提示条与六个胶囊面板无被裁控件/逐字竖排`, async ({ page }) => {
    const { cut, sq, errs, drCount, stCount } = await scanDock(page, vp)
    expect(drCount, '五个底部面板合计应有内容（否则这一轮扫描是空转）').toBeGreaterThan(40)
    expect(stCount, '底部提示条应有内容（否则这一轮扫描是空转）').toBeGreaterThan(5)
    expect(cut, `以下控件被 overflow 裁掉且点不到：\n${cut.join('\n')}`).toEqual([])
    expect(sq, `以下文字被挤成逐字竖排：\n${sq.join('\n')}`).toEqual([])
  })
}

// ── 大类工作区（2026-09-27 用户⑳ 第二轮）下的排版：内容列被导航栏分掉 168px + 间距 ──────────
// 为什么单列一条：「点大类 → 主区左导航 + 右内容」会让**内容列比平时窄约 182px**，
// 而上面那条主扫描是 `setView` 直达的（不带导航栏）⇒ 它扫不到这种「只是变窄了」引发的挤压/裁切。
// 做法：按大类逐个点开，再沿着导航栏把该类每一页都点一遍（与玩家真实路径一致）。
const RAIL_CATS = ['今日', '采买与转化', '挂机产线', '研究与收集', '餐厅经营', '挑战与休闲', '记录与回顾']

async function scanRail(page, viewport, cats) {
  await enterGame(page, viewport)
  const cut = []
  const sq = []
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  const consoleErrs = []
  const NOISE = /Failed to load resource|net::ERR|favicon|ERR_ABORTED|\[vite\]/
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) consoleErrs.push(m.text().slice(0, 220)) })
  await page.locator('.sidebar-tab', { hasText: '功能' }).click()
  await page.waitForTimeout(200)
  const showAll = page.locator('.feature-hidden button', { hasText: '显示全部' })
  if (await showAll.count()) { await showAll.click(); await page.waitForTimeout(250) }
  let n = 0
  for (const cat of cats) {
    await page.locator('.feature-cat', { hasText: cat }).first().click()
    await page.waitForTimeout(320)
    const rail = page.locator('.app-sidebar .feature-rail')
    const names = (await rail.locator('.fr-item').allTextContents()).map((t) => t.replace(/[^一-龥]/g, ''))
    for (let i = 0; i < names.length; i++) {
      // 山海食经是**整屏画布页**，设计上就不挂导航栏（`--bleed` 下分掉 168px 会把画布挤变形）
      // ⇒ 它在本轮跳过；它自己的排版由主扫描（`setView('shanhai')`）覆盖。
      if (names[i].includes('山海食经')) continue
      await page.locator('.app-sidebar .feature-rail .fr-item').nth(i).click()
      await page.waitForTimeout(340)
      await page.evaluate(expandAll)
      await page.waitForTimeout(280)
      const mark = consoleErrs.length
      const r = await page.evaluate(scan, '.main-scroll')
      const label = `${cat}/${names[i]}`
      for (const x of r.cutControl) if (!x.clickable) cut.push(`${label} · 「${x.ctrl}」被裁 ${x.over}px（${x.box}）`)
      for (const x of r.squeeze) sq.push(`${label} · 「${x.text}」被挤成 ${x.w}×${x.h}（逐字竖排）`)
      for (const msg of consoleErrs.slice(mark)) errs.push(`${label} · 控制台错误：${msg}`)
      n++
    }
  }
  return { cut, sq, errs, n }
}

if (VIEWPORTS[0]) {
  const vp = VIEWPORTS[0] // 只在 1440px 跑：窄屏根本不出现导航栏（那是抽屉 + 手风琴）
  for (let i = 0; i < 2; i++) {
    const mine = RAIL_CATS.filter((_, k) => k % 2 === i)
    test(`布局守卫（1440px 大类工作区 ${i + 1}/2，${mine.length} 类）：带导航栏时无被裁控件/逐字竖排`, async ({ page }) => {
      const { cut, sq, errs, n } = await scanRail(page, vp, mine)
      expect(n, '这一轮一页都没扫到（空转）').toBeGreaterThan(5)
      expect(cut, `以下控件被 overflow 裁掉且点不到：\n${cut.join('\n')}`).toEqual([])
      expect(sq, `以下文字被挤成逐字竖排：\n${sq.join('\n')}`).toEqual([])
      expect(errs, '页面抛错：' + errs.join(' / ')).toEqual([])
    })
  }
}

// ── 美食探索的宽卡排版（2026-09-28 用户两轮反馈：「卡片太长了而且很杂」→「一个卡片改成两个卡片大小」）──
// 为什么单列一条：这一页的问题**全是渲染层面的**，静态守卫抓不到 ——
//   · 「一个卡片改成两张卡宽」= 卡片实际宽度（1440px 下 ≥ 380px，而不是原来那 214px）；
//   · 「文字被挤到第二行」= 统计格折行（上半格 ~110px，4 字标签就放不下）⇒ 逐格量高度；
//   · 两栏必须在同一条基线上且**不重叠**（首版两栏挨在一起，读起来像同一行走乱了）。
for (const vp of VIEWPORTS) {
  test(`布局守卫（${vp.tag}）：美食探索宽卡 —— 卡片够宽、统计行不折行、两栏不重叠`, async ({ page }) => {
    await enterGame(page, vp)
    await page.evaluate(async () => {
      const el = document.querySelector('#app')
      const pinia = el.__vue_app__.config.pinia ?? el.__vue_app__.config.globalProperties.$pinia
      const player = pinia._s.get('player')
      const ui = pinia._s.get('ui')
      // ⚠️ `setActiveSkill` 在 **player** store 上（不在 ui 上 —— 写 `ui.setActiveSkill?.()`
      //    会静默变成 undefined，页面停在原来那个技能页 ⇒ 量到的是采集页的 214px 卡，
      //    断言照样能跑但量的不是探索页）。
      player.setActiveSkill('exploration')
      ui.setView('skill')
    })
    await page.waitForTimeout(700)
    const r = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.gather-card')]
      if (!cards.length) return { n: 0 }
      // 取**掉落条数最少**的那张卡来量（等高网格里它的多余高度最多，最能暴露「装备行悬空」）
      const c = [...cards].sort((a, b) => a.querySelectorAll('.loot-row').length - b.querySelectorAll('.loot-row').length)[0]
      // 折行判据：一行文字的高度不会超过 1.6 个行高（换行就会翻倍）
      const lines = (sel) => [...c.querySelectorAll(sel)].map((e) => {
        const lh = parseFloat(getComputedStyle(e).lineHeight) || 16
        return { t: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 20), h: Math.round(e.getBoundingClientRect().height), lh: Math.round(lh) }
      })
      const wrapped = [...lines('.ex-stats .gather-card-row'), ...lines('.ex-mastery')].filter((x) => x.h > x.lh * 1.6)
      // 两栏骨架用的是共用原语（2026-09-28 抽到 main.css）：左 `.card-col`、右 `.card-col--right`
      const stat = c.querySelector('.card-col:not(.card-col--right)')?.getBoundingClientRect()
      const loot = c.querySelector('.card-col--right')?.getBoundingClientRect()
      // 专属装备那一行：横跨整卡 + **贴住按钮**（用户 2026-09-28：「置底在按钮上方」）。
      // 判据取**掉落条数最少**的那张卡 —— 等高网格里它的多余高度最多，最能暴露「装备行悬空」。
      const gear = c.querySelector('.loot-row--gear')
      const btn = c.querySelector('.btn')
      const gr = gear?.getBoundingClientRect()
      const br = btn?.getBoundingClientRect()
      const cardR = c.getBoundingClientRect()
      const twoCol = loot && stat && loot.left > stat.left
      const stacked = loot && stat && loot.left <= stat.left + 1 // 窄屏并栏
      return {
        n: cards.length,
        cardW: Math.round(cardR.width),
        cardH: Math.round(cardR.height),
        twoCol: !!twoCol,
        stacked: !!stacked,
        overlap: twoCol ? Math.round((loot.left - stat.right) * 10) / 10 : null,
        wrapped: wrapped.map((x) => `${x.t}(${x.h}px/${x.lh})`),
        lootRows: c.querySelectorAll('.loot-row').length,
        gearRow: c.querySelectorAll('.loot-row--gear').length,
        gearW: gr ? Math.round(gr.width) : 0,
        gearToBtn: gr && br ? Math.round(br.top - gr.bottom) : null,
        btnToBottom: br ? Math.round(cardR.bottom - br.bottom) : null,
      }
    })
    expect(r.n, '探索页没有卡片（这一轮空转）').toBeGreaterThan(3)
    // 宽卡：1440px 下每张 ≈ 550px（原来 214px）；窄屏（390px）单栏也是满宽
    expect(r.cardW, `卡片宽度只有 ${r.cardW}px —— 「一张卡改成两张卡大小」没做到（原来 214px）`).toBeGreaterThan(300)
    expect(r.wrapped, `统计行折行了（右上角「失败代价」这类 4 字标签在半格里放不下）：${r.wrapped.join('、')}`).toEqual([])
    expect(r.gearRow, '掉落区里没有专属装备那一行').toBe(1)
    // 横跨整卡（占满卡片内容宽）且**贴住按钮**（间距 = 卡片自身行距；等高网格里多出来的高度
    // 必须落在卡体内部，而不是把装备行与按钮撑开 —— 用户 2026-09-28「置底在按钮上方」）
    expect(r.gearW, `专属装备那一行没有横跨整卡（${r.gearW}px / 卡片 ${r.cardW}px）`).toBeGreaterThan(r.cardW - 40)
    expect(r.gearToBtn, `专属装备那一行没贴住按钮（间距 ${r.gearToBtn}px —— 悬在了半空）`).toBeLessThanOrEqual(10)
    // ⚠️ 只量「装备行 → 按钮」抓不到另一半缺陷：把「吸收多余高度」的责任拿掉时，**按钮会被顶起来**
    //    （实测掉落条数最少的卡片 btnToBottom = 38px，而正常是 11px = 卡片内边距 + 描边）——
    //    所以还要量按钮是否真的贴在卡片底。两个一起量，才等于「装备行与按钮都在底部」。
    expect(r.btnToBottom, `按钮没贴在卡片底（下缘留了 ${r.btnToBottom}px —— 多余高度没被卡体吸收，按钮被顶起来了）`).toBeLessThanOrEqual(14)
    if (vp.width > 940) {
      expect(r.twoCol, '宽屏下卡内应分成两栏（数值 / 掉落）').toBe(true)
      expect(r.overlap, `两栏重叠/贴在一起（间隔 ${r.overlap}px）`).toBeGreaterThan(8)
    } else {
      expect(r.stacked, '窄屏下两栏应并成一栏').toBe(true)
    }
  })
}

// ── 制作类卡片（制作 / 食材保鲜 / 副业同属 ProductionView）：同步成探索页那套宽卡两栏 ──────────
// 用户 2026-09-28：「制作的卡片、食材保鲜的卡片、副业的卡片都是过长，需要同步成美食探索的卡片那样」。
// 改前实测：192px 宽 × 331~424px 高、同屏 8 列；最占地方的是**动作条 87px**（四个按钮折两行）
// 与**材料行 36~69px**（换行）。改后 527×185。这里量三件静态守卫抓不到的事：
// 卡片真的变宽变矮、材料进了右栏（两栏）、四个按钮**一行**放得下、动作条贴卡片底。
for (const vp of VIEWPORTS) {
  for (const skill of ['cooking', 'preservation', 'woodworking']) {
    test(`布局守卫（${vp.tag}）：制作类宽卡 ${skill} —— 卡片变宽变矮、材料进右栏、按钮一行`, async ({ page }) => {
      await enterGame(page, vp)
      await page.evaluate(async (id) => {
        const el = document.querySelector('#app')
        const pinia = el.__vue_app__.config.pinia ?? el.__vue_app__.config.globalProperties.$pinia
        const player = pinia._s.get('player')
        const items = (await import('/src/game/data/items.js')).ITEMS
        for (const [iid, it] of Object.entries(items)) { if (it.type !== 'spirit') player.inventory[iid] = 999 }
        player.setActiveSkill(id)
        pinia._s.get('ui').setView('skill')
      }, skill)
      await page.waitForTimeout(700)
      const r = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.recipe-grid .gather-card')]
        if (!cards.length) return { n: 0 }
        const c = cards[0]
        const cr = c.getBoundingClientRect()
        const rightEl = c.querySelector('.card-col--right')
        const left = c.querySelector('.card-col:not(.card-col--right)')?.getBoundingClientRect()
        const right = rightEl?.getBoundingClientRect()
        const act = c.querySelector('.recipe-action')?.getBoundingClientRect()
        const boxes = [...c.querySelectorAll('.recipe-action .btn')].map((b) => b.getBoundingClientRect())
        // 🔴 判「同一行」必须按**竖向重叠**，不能比 top 是否相等：`.queue-btns` 是 `align-items: center`，
        //    按钮高度随字体度量变（CI 的 runner 缺 emoji/中文字体 ⇒ 高度不同 ⇒ top 不同），
        //    用 top 相等判会在 CI 上把**同一行**误报成两行（实测：各钮宽 [106,106,106,191] 明明铺满一行）。
        //    与项目里那条「比 y 相等判同一排会误报」同源。
        const sorted = [...boxes].sort((a, b) => a.top - b.top)
        let stripes = sorted.length ? 1 : 0
        let curBottom = sorted[0]?.bottom ?? 0
        for (const bx of sorted.slice(1)) {
          if (bx.top >= curBottom - 1) { stripes++; curBottom = bx.bottom } else curBottom = Math.max(curBottom, bx.bottom)
        }
        const btnWs = boxes.map((b) => Math.round(b.width))
        return {
          n: cards.length,
          w: Math.round(cr.width),
          h: Math.round(cr.height),
          twoCol: !!left && !!right && right.left > left.left,
          stacked: !!left && !!right && right.left <= left.left + 1,
          gap: left && right ? Math.round((right.left - left.right) * 10) / 10 : null,
          ingInRight: !!rightEl?.querySelector('.ing-cell, .gather-card-ing'),
          btnRows: stripes,
          btnWs,
          actToBottom: act ? Math.round(cr.bottom - act.bottom) : null,
        }
      })
      expect(r.n, `${skill} 没有配方卡片（这一轮空转）`).toBeGreaterThan(0)
      // 宽卡：1440px 下 ≈527px（原来 192px）；窄屏单栏满宽
      expect(r.w, `卡片宽度只有 ${r.w}px —— 没同步成宽卡（原来 192px）`).toBeGreaterThan(300)
      // 矮：原来 331~424px；宽卡两栏后 1440px 下应 ≤ 260px（390px 单栏下允许更高）
      if (vp.width > 940) {
        expect(r.h, `卡片仍然 ${r.h}px 高 —— 「过长」没解决（原来 331~424px）`).toBeLessThanOrEqual(260)
        expect(r.twoCol, '宽屏下卡内应分成两栏（数值 / 材料）').toBe(true)
        expect(r.gap, `两栏贴在一起（间隔 ${r.gap}px）`).toBeGreaterThan(8)
        expect(r.ingInRight, '材料没有放进右栏').toBe(true)
        expect(r.btnRows, `动作按钮占了 ${r.btnRows} 行（宽卡下应一行放得下四个）· 卡片 ${r.w}px · 各钮宽 ${JSON.stringify(r.btnWs)}`).toBe(1)
      } else {
        expect(r.stacked, '窄屏下两栏应并成一栏').toBe(true)
      }
      expect(r.actToBottom, `动作条没贴卡片底（下缘留 ${r.actToBottom}px）`).toBeLessThanOrEqual(14)
    })
  }
}
