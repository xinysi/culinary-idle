// 交互守卫（2026-09-18 立）— 逐页点击**所有绑定了 @click 的元素**，抓运行时报错。
//
// 为什么要单独有这一条：既有的 e2e 只点 `<button>`，而项目里大量可点区域是
// `<div class="gather-card" @click="…">` 这种卡片。作者报「对决，敌人的掉落看不到了」——
// 根因就是 `CombatView.vue` 里模板与 `openDrops/closeDrops` 都在用 `dropModal`，
// 而这个 ref **漏了声明** ⇒ 点任何敌人卡立刻抛 `ReferenceError: dropModal is not defined`，
// 掉落弹窗永远打不开。它不报白屏、静态扫描也看不出，只有「真的点一下」才会暴露。
//
// 识别手段：Vue 会在 DOM 元素上挂 `__vnode`，其 `props.onClick` 就是模板里那个处理器
// （实测对决页 1168 个元素里有 120 个带 @click）。按处理器源码去重 ⇒ 每个不同处理器只点一次，
// 既覆盖齐全又不至于点几百下。
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

// 破坏性动作不点：会删档/清空进度，一次点击就可能毁掉后面所有页面的前置状态
const DANGER = /删|重置|转生|清空|卖出|出售|放弃|解雇|拆除|销毁|解散|格式化|导入|全部领取|一键/
const MAX_PER_VIEW = 30 // 每页最多点几个不同处理器（防某个页面处理器特别多导致跑太久）

/** 底部胶囊一共五块（挂机动向 / 食灵 / 奥义 / 快捷状态 / 事件日志），逐块点开。
 *  ⚠️ 别用脚本侧的 `pinia._s.get('ui').toggleDockSection(...)`：实测在本守卫里那读到的 store
 *     与组件渲染用的不是同一个实例（flag 变 true 但 DOM 里一个面板都没有）。 */
const DOCK_SECS = ['idle', 'spirit', 'aoji', 'status', 'log']
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


async function enterGame(page) {
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
    const p = pinia._s.get('player')
    const items = (await import('/src/game/data/items.js')).ITEMS
    for (const [id, it] of Object.entries(items)) { if (it.type !== 'spirit') p.inventory[id] = 999 }
    p.gold = 1e9
    p.gameCoins = 1e6
    for (const id of Object.keys(p.skills)) { p.skills[id].level = 120 }
    const { REGIONS } = await import('/src/game/data/regions.js')
    for (const r of REGIONS) p.regions[r.id] = true
    const { SPIRITS } = await import('/src/game/data/spiritTiers.js')
    for (const s of SPIRITS) p.spirits.owned[s.id] = 1
  })
}

/** 列出本页所有 @click 处理器（按处理器源码去重）。
 *  ⚠️ 这段在浏览器里跑，Node 侧的常量必须当参数传进来（不能直接引用 DANGER） */
const listHandlers = ({ max, danger }) => {
  const DANGER_RE = new RegExp(danger)
  const seen = new Map()
  for (const el of document.querySelectorAll('.main-scroll *')) {
    const v = el.__vnode
    const fn = v?.props?.onClick
    if (typeof fn !== 'function') continue
    const body = String(fn).replace(/\s+/g, ' ').slice(0, 90)
    const label = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)
    const key = body + '|' + el.tagName + '|' + (el.className || '').toString().slice(0, 30)
    if (seen.has(key)) continue
    if (DANGER_RE.test(label)) continue
    if (el.getBoundingClientRect().width < 1) continue
    seen.set(key, { key, label, cls: (el.className || '').toString().slice(0, 40) })
    if (seen.size >= max) break
  }
  return [...seen.values()]
}

/** 点掉弹窗/遮罩，回到干净状态 */
const clearOverlays = () => {
  for (const b of document.querySelectorAll('.modal-backdrop')) {
    b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

// ⚡ 并行切片（2026-09-21）：这一套原先是一个 test 串行扫 105 页、**实测 4.4 分钟**，是全部守卫里最慢的一环。
//    现在按页**轮转**切成 `E2E_SLICES`（默认 4）片，每片是一个独立 test ⇒ 多 worker 并行，总时长≈1/4。
//    每片自带一次 enterGame（各 test 有独立 browser context，互不干扰）。`E2E_SLICES=1` 可退回串行（排查偶发失败用）。
// ⚠️ 切片必须**轮转**（`k % SLICES`）而不是连续切：页面耗时差别极大（对决页 120 个处理器、空页 0 个），
//    轮转才能把重页摊平。
test.describe.configure({ timeout: 600000, mode: 'parallel' })

const SLICES = Math.max(1, Number(process.env.E2E_SLICES || 4))
const pageSlice = (i) => PAGES.filter((_, k) => k % SLICES === i)

/** 逐页点掉该页所有不同的 @click 处理器；返回点击次数，失败写进 failures */
async function clickOnePage(page, pg, failures) {
  let clicks = 0
  {
    const v = pg.skill ? `skill:${pg.skill}` : pg.view
    await page.evaluate((p) => {
      const el = document.querySelector('#app')
      const app = el.__vue_app__
      const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
      pinia._s.get('ui').setView(p.view)
      if (p.skill) pinia._s.get('player').setActiveSkill(p.skill)
    }, pg)
    await page.waitForTimeout(420)

    // ⚠️ 枚举与点击**必须在同一个 evaluate 里完成**：页面每 tick 都在重渲染（战斗帧依赖 ui.loopTick），
    //    「先取 key、再按 key 二次查询」会因 vnode 被替换而匹配不到 —— 实测这样写会**漏点**整页，
    //    变成「假绿守卫」（我第一版就漏掉了 openDrops 那张卡）。
    //    错误在页内用 window 的 error 事件收集（监听器里的未捕获异常不会冒泡给 dispatchEvent 的调用方）。
    const r = await page.evaluate(({ max, danger, root }) => {
      const DANGER_RE = new RegExp(danger)
      const errs = []
      const onErr = (e) => errs.push(String(e.message || e.error || e))
      window.addEventListener('error', onErr)
      window.addEventListener('unhandledrejection', onErr)

      const collect = () => {
        const seen = new Map()
        for (const el of document.querySelectorAll(`${root} *`)) {
          const fn = el.__vnode?.props?.onClick
          if (typeof fn !== 'function') continue
          const label = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)
          if (DANGER_RE.test(label)) continue
          if (el.getBoundingClientRect().width < 1) continue
          const key = String(fn).replace(/\s+/g, ' ').slice(0, 90) + '|' + el.tagName + '|' + (el.className || '').toString().slice(0, 30)
          if (seen.has(key)) continue
          seen.set(key, { el, label, cls: (el.className || '').toString().slice(0, 40) })
          if (seen.size >= max) break
        }
        return [...seen.values()]
      }
      const clearOverlays = () => {
        for (const b of document.querySelectorAll('.modal-backdrop')) {
          b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
          b.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        }
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      }
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

      return (async () => {
        const targets = collect()
        const out = []
        for (const t of targets) {
          errs.length = 0
          t.el.scrollIntoView({ block: 'center' })
          // SVG 元素没有 `.click()`（部分图形节点也绑了 @click）→ 统一派发冒泡 MouseEvent
          t.el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
          await sleep(160)
          // 关掉可能弹出的弹窗，否则后续点击都被遮罩吃掉
          clearOverlays()
          await sleep(90)
          if (errs.length) out.push({ label: t.label || t.cls, cls: t.cls, err: errs.slice(0, 2).join(' / ') })
        }
        window.removeEventListener('error', onErr)
        window.removeEventListener('unhandledrejection', onErr)
        return { clicked: targets.length, failures: out }
      })()
    }, { max: MAX_PER_VIEW, danger: DANGER.source, root: '.main-scroll' })

    clicks += r.clicked
    for (const f of r.failures) failures.push(`${v} · 「${f.label}」(${f.cls})\n      ${f.err}`)
  }
  return clicks
}

for (let i = 0; i < SLICES; i++) {
  const mine = pageSlice(i)
  test(`交互守卫（切片 ${i + 1}/${SLICES}，${mine.length} 页）：点击所有 @click 无运行时报错`, async ({ page }) => {
    const failures = []
    await enterGame(page)
    let totalClicks = 0
    for (const pg of mine) totalClicks += await clickOnePage(page, pg, failures)
    // 下限断言防「这一片的页面一个处理器都没点到 ⇒ 静默绿」
    expect(totalClicks, `切片 ${i + 1} 一次都没点到（整片空转）`).toBeGreaterThan(0)
    expect(failures, `以下交互触发运行时报错：\n${failures.join('\n')}`).toEqual([])
    console.log(`  切片 ${i + 1}/${SLICES}：${mine.length} 页 · 点击 ${totalClicks} 次`)
  })
}

// 底部两条常驻提示 + 五个胶囊面板（它们不在 `.main-scroll` 里，逐页扫扫不到）：
// 独立成一个 test，与上面的页面切片并行跑。
test('交互守卫：底部提示条与五个底部面板里所有 @click 无运行时报错', async ({ page }) => {
  const failures = []
  await enterGame(page)
  let totalClicks = 0

  // 两条常驻提示（2026-09-19 移到中间列底栏，不在 `.main-scroll` 里）：单独点一轮。
  // 两条常驻提示（2026-09-19 移到中间列底栏，不在 `.main-scroll` 里）：单独点一轮。
  // 放在最后 —— 新手横幅的 ✕ 会把它关掉，跑在前面会影响后面页面。
  {
    const st = await page.evaluate(({ max, danger, root }) => {
      const DANGER_RE = new RegExp(danger)
      const errs = []
      const onErr = (e) => errs.push(String(e.message || e.error || e))
      window.addEventListener('error', onErr)
      window.addEventListener('unhandledrejection', onErr)
      const seen = new Map()
      for (const el of document.querySelectorAll(`${root} *`)) {
        const fn = el.__vnode?.props?.onClick
        if (typeof fn !== 'function') continue
        const label = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)
        if (DANGER_RE.test(label)) continue
        if (el.getBoundingClientRect().width < 1) continue
        const key = String(fn).replace(/\s+/g, ' ').slice(0, 90) + '|' + el.tagName
        if (seen.has(key)) continue
        seen.set(key, { el, label, cls: (el.className || '').toString().slice(0, 40) })
        if (seen.size >= max) break
      }
      return (async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
        const out = []
        let n = 0
        for (const t of [...seen.values()]) {
          errs.length = 0
          t.el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
          await sleep(140)
          for (const b of document.querySelectorAll('.modal-backdrop')) {
            b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
            b.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          }
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
          n++
          if (errs.length) out.push({ label: t.label || t.cls, cls: t.cls, err: errs.slice(0, 2).join(' / ') })
        }
        window.removeEventListener('error', onErr)
        window.removeEventListener('unhandledrejection', onErr)
        return { clicked: n, failures: out, seen: seen.size }
      })()
    }, { max: MAX_PER_VIEW, danger: DANGER.source, root: '.head-strips' })
    totalClicks += st.clicked
    for (const f of st.failures) failures.push(`底部提示条 · 「${f.label}」(${f.cls})
      ${f.err}`)
  }

  // 底部五个胶囊（2026-09-20）：它们不在 `.main-scroll` 里，只扫 main-scroll 会让里面的处理器
  // （挂机暂停/停止、快捷状态入口、日志清空…）从此无人点过 ⇒ 逐块单独点一轮。
  // 放在全部页面之后，因为「停止挂机」会改变后续页面的前置状态。
  // ⚠️ 必须点胶囊（原因见 e2e-layout 同处注释：脚本侧拿到的 store 与组件渲染用的不是同一个实例）
  // 逐块点（注释见上）：每块的面板各自跑一遍同一段「点所有 @click」逻辑
  const drAll = []
  for (let si = 0; si < DOCK_SECS.length; si++) {
  await openDock(page, DOCK_SECS[si])
  await page.waitForTimeout(420)
  const dr = await page.evaluate(({ max, danger, root }) => {
    const DANGER_RE = new RegExp(danger)
    const errs = []
    const onErr = (e) => errs.push(String(e.message || e.error || e))
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onErr)
    const out = []
    const seen = new Map()
    for (const el of document.querySelectorAll(`${root} *`)) {
      const fn = el.__vnode?.props?.onClick
      if (typeof fn !== 'function') continue
      const label = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)
      if (DANGER_RE.test(label)) continue
      if (el.getBoundingClientRect().width < 1) continue
      const key = String(fn).replace(/\s+/g, ' ').slice(0, 90) + '|' + el.tagName + '|' + (el.className || '').toString().slice(0, 30)
      if (seen.has(key)) continue
      seen.set(key, { el, label, cls: (el.className || '').toString().slice(0, 40) })
      if (seen.size >= max) break
    }
    return (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      let n = 0
      for (const t of [...seen.values()]) {
        errs.length = 0
        t.el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        await sleep(160)
        for (const b of document.querySelectorAll('.modal-backdrop')) {
          b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
          b.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        }
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        await sleep(90)
        n++
        if (errs.length) out.push({ label: t.label || t.cls, cls: t.cls, err: errs.slice(0, 2).join(' / ') })
      }
      window.removeEventListener('error', onErr)
      window.removeEventListener('unhandledrejection', onErr)
      return { clicked: n, failures: out }
    })()
  }, { max: MAX_PER_VIEW, danger: DANGER.source, root: '.dock-panel' })
  totalClicks += dr.clicked
  drAll.push({ sec: DOCK_SECS[si], clicked: dr.clicked })
  for (const f of dr.failures) failures.push(`底部面板(${DOCK_SECS[si]}) · 「${f.label}」(${f.cls})
      ${f.err}`)
  await openDock(page, DOCK_SECS[si]) // 再点一下收起，避免点外关闭层挡住下一块
  await page.waitForTimeout(150)
  }
  // 断言下限防「面板没渲染 ⇒ 一个都没点到 ⇒ 静默绿」——这正是本守卫最初漏掉 dropModal 的同类假绿。
  // 实测每块都有 1~6 个不同处理器（挂机动向的暂停/继续·关闭、快捷状态各入口、事件日志的清空/折叠…）。
  for (const d of drAll) expect(d.clicked, `底部面板(${d.sec}) 里应点到处理器（为 0 即说明这一轮是空转）`).toBeGreaterThanOrEqual(1)
  expect(drAll.reduce((a, d) => a + d.clicked, 0), '五个底部面板合计应点到多个处理器').toBeGreaterThanOrEqual(6)

  console.log(`  底部提示条 + 五个底部面板 · 实际点击 ${totalClicks} 次（页面部分见各切片）`)
  expect(failures, `以下交互触发运行时报错：\n${failures.join('\n')}`).toEqual([])
})
