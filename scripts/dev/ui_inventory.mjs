// 全 UI 控件清单量测（2026-09-23）——「把所有 UI 换掉」的底表数据来源。
//
// 为什么用真实浏览器量而不是我凭印象写：用户要「每个专属的尺寸」。尺寸只能从**跑起来的页面**取，
// 而且要带**满档数据**（空档很多页是空状态、控件根本不渲染）。
// 本脚本逐页（全部 view + 38 个技能页）枚举控件族的元素，记录实测几何与计算样式（圆角/描边/内边距/
// 字号/底色/阴影/状态），按「族 + 尺寸 + 状态」去重后落成 JSON；Excel 由 build_ui_spec_xlsx.mjs 生成。
//
// 用法：node scripts/dev/ui_inventory.mjs   （需 dev server 已起在 5173）
import { chromium } from 'playwright'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { SKILL_DEFS } from '../../src/game/data/skills.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = join(root, 'scripts/dev/ui-inventory.json')
const VIEWPORT = { width: 1440, height: 900 }

// 页面清单：从 ui.js 抽 VIEW_KEYS（与 e2e 守卫同一做法，避免在 node 里 import 浏览器端 store）
const uiSrc = fs.readFileSync(join(root, 'src/stores/ui.js'), 'utf8')
const block = uiSrc.slice(uiSrc.indexOf('export const VIEW_KEYS = ['), uiSrc.indexOf(']', uiSrc.indexOf('export const VIEW_KEYS = [')))
const VIEWS = [...block.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1])
const SKILL_IDS = Object.keys(SKILL_DEFS)

const PAGES = [
  ...VIEWS.filter((v) => v !== 'skill').map((v) => ({ view: v })),
  ...SKILL_IDS.map((id) => ({ view: 'skill', skill: id })),
]

const SEED = async () => {
  const app = document.querySelector('#app').__vue_app__
  const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
  const player = pinia._s.get('player')
  const items = (await import('/src/game/data/items.js')).ITEMS
  for (const [id, it] of Object.entries(items)) if (it.type !== 'spirit') player.inventory[id] = 999
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
  return true
}

// 控件族识别（顺序即优先级：先匹配到的族胜出，避免一个元素被算进两族）
const FAMILIES = [
  ['页签', '.sidebar-tab, .top-nav-btn, .mobile-nav-btn, [class*="-tabs"] > button, [class*="-tab"]:not(.tab-bar), .quick-nav > *'],
  ['进度条', '.progress, [class*="progress"], [class*="bar-fill"], [class*="fill"]:not(.svg-fill), .hp-fill, .mp-bar, input[type="range"]'],
  ['复选框', 'input[type="checkbox"], .ui-check'],
  ['下拉', 'select'],
  ['输入框', 'input[type="text"], input[type="number"], input[type="search"], input:not([type]), textarea'],
  ['图标按钮', 'button.btn-icon, button[class*="icon"], .item-img-btn, button[class*="close"], button:has(> svg)'],
  ['主按钮', 'button.btn-primary, button[class*="btn-primary"]'],
  ['按钮', 'button, .btn, a[class*="btn"]'],
  ['弹窗', '.modal, .modal-card, .modal-body, .modal-backdrop > div, .start-slot-modal, [class*="backdrop"] > div'],
  ['面板', '.dock-panel, .dock-panel-body, .app-sidebar, .main-scroll, .settings-body, .cold-pane, .equip-pane, .sw-ladder, .mp-line'],
  ['卡片', '.card, .item-card, .gather-card, .item-cell, .feature-tile, .fold-card, .guild-shop-card, .mg-info-card, .slot-card, .spirit-card-contract, .opp-row, .equip-row, .order-row, .side-quest, .idle-task'],
  ['徽章', '.badge, .chip, [class*="chip"], [class*="-flag"], .quality-chip, .mastery-hl'],
  ['表格', 'table, .target-table, .spirit-table'],
  ['日志行', '.log-line, .log-item, [class*="log-row"], [class*="log-"] > .row'],
  ['物品图', '.item-img, .skill-icon, .item-cell img, .gather-card-head img'],
  ['区块标题', 'h3, h4, .gather-card-head, .item-cell-head, .sw-head, .queue-head'],
]

const result = { meta: { viewport: VIEWPORT, at: new Date().toISOString(), base: BASE }, pages: [] }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: VIEWPORT })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(400)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(1200)
await page.evaluate(SEED)
await page.waitForTimeout(400)

// ⚠️ 采集逻辑必须**整个塞进 page.evaluate 的回调里**（浏览器侧执行）；Node 侧不能引用它。
// 这里只保留纯数据（FAMILIES）作为参数传进去。
const COLLECT_FN = function (families) {
  const seen = new Set()
  const claimed = new WeakSet() // ⚠️ 跨族去重：一个元素只能归入**最具体**的那个族
  const out = []
  const val = (el, prop) => getComputedStyle(el)[prop]
  for (const [fam, sel] of families) {
    let els = []
    try { els = [...document.querySelectorAll(sel)] } catch { els = [] }
    let kept = 0
    for (const el of els) {
      if (claimed.has(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) continue
      if (val(el, 'display') === 'none' || val(el, 'visibility') === 'hidden' || +val(el, 'opacity') === 0) continue
      claimed.add(el)
      const cls = [...el.classList].filter((c) => !/^(active|selected|disabled|locked|on|open|flash|dim|mono|hidden)$/.test(c))
      const state = ['active', 'selected', 'locked', 'on', 'disabled', 'open'].filter((s) => el.classList.contains(s) || (s === 'disabled' && el.disabled === true))
      const key = [fam, cls[0] ?? el.tagName, Math.round(r.width / 4) * 4, Math.round(r.height / 4) * 4, state.join('.')].join('|')
      if (seen.has(key)) continue
      seen.add(key)
      kept++
      if (kept > 8) break // 每族每页最多 8 个代表（避免几百个同类按钮刷表）
      const bg = val(el, 'backgroundColor')
      const bgi = val(el, 'backgroundImage')
      out.push({
        family: fam,
        tag: el.tagName.toLowerCase(),
        cls: cls.slice(0, 2).join(' '),
        text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 26),
        w: +r.width.toFixed(1), h: +r.height.toFixed(1),
        radius: val(el, 'borderRadius'),
        pad: `${val(el, 'paddingTop')} ${val(el, 'paddingRight')} ${val(el, 'paddingBottom')} ${val(el, 'paddingLeft')}`,
        font: `${val(el, 'fontSize')}/${val(el, 'fontWeight')}`,
        border: `${val(el, 'borderTopWidth')} ${val(el, 'borderTopStyle')} ${val(el, 'borderTopColor')}`,
        bg: bg === 'rgba(0, 0, 0, 0)' ? '' : bg,
        bgImage: bgi && bgi !== 'none' ? bgi.slice(0, 60) : '',
        shadow: val(el, 'boxShadow') === 'none' ? '' : val(el, 'boxShadow').slice(0, 60),
        glass: val(el, 'backdropFilter') === 'none' ? '' : val(el, 'backdropFilter'),
        state: state.join('.'),
      })
    }
  }
  return out
}

for (const p of PAGES) {
  await page.evaluate(async (arg) => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
    const ui = pinia._s.get('ui'); const pl = pinia._s.get('player')
    if (arg.skill) { pl.activeSkill = arg.skill; ui.setView('skill') } else ui.setView(arg.view)
    await new Promise((s) => setTimeout(s, 260))
  }, p)
  await page.waitForTimeout(420)
  const data = await page.evaluate(([fams, collectSrc]) => {
    // eslint-disable-next-line no-new-func
    const collect = new Function(`return (${collectSrc})`)()
    const layoutEl = document.querySelector('.main-scroll') ?? document.body
    let grid = { cols: null, cardW: null, cardH: null }
    for (const g of ['.gather-grid', '.recipe-grid', '.item-grid', '.grid-equal', '.card-grid', '[class^="grid-n-"]', '[class*="grid grid"]']) {
      const el = document.querySelector(g)
      if (!el) continue
      const cs = getComputedStyle(el)
      const cols = cs.gridTemplateColumns === 'none' ? cs.columnCount : cs.gridTemplateColumns.split(' ').length
      const card = el.firstElementChild
      const cr = card?.getBoundingClientRect()
      grid = { cols, cardW: cr ? +cr.width.toFixed(1) : null, cardH: cr ? +cr.height.toFixed(1) : null }
      break
    }
    return {
      layout: {
        mainW: +layoutEl.getBoundingClientRect().width.toFixed(1),
        grid,
        hasModal: !!document.querySelector('.modal-backdrop'),
        scrollH: Math.round(document.scrollingElement.scrollHeight),
      },
      controls: collect(fams),
    }
  }, [FAMILIES, COLLECT_FN.toString()])
  result.pages.push({ ...p, ...data })
  process.stdout.write(`\r扫描 ${result.pages.length}/${PAGES.length} · ${p.skill ?? p.view}            `)
}

await browser.close()
fs.writeFileSync(OUT, JSON.stringify(result, null, 1), 'utf8')
const total = result.pages.reduce((a, p2) => a + p2.controls.length, 0)
console.log(`\n✅ 落盘 ${OUT}`)
console.log(`页面 ${result.pages.length} · 控件行 ${total}`)
const byFam = {}
for (const p2 of result.pages) for (const c of p2.controls) byFam[c.family] = (byFam[c.family] ?? 0) + 1
console.log('按族统计：', Object.entries(byFam).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '))
