// 控件主题化守卫（2026-09-25 立）—— 全站表单控件「三遍扫描」：浅色 1440 / 深色 1440 / 浅色 390
//
// 起因：制作数量弹窗（QuantityModal）是裸浏览器控件（默认蓝滑块、白底数字框），用户报「样式没有适配」。
// 排查发现 25 select / 11 number / 5 range / 16 checkbox 散落在主题容器
// （.settings-body/.bgm-vol/.bd-qty，2026-09-14/17/20 三轮各自打过补丁）之外 ⇒ 修法是
// **main.css 的 :where() 零优先级全局基线**（background-color 走 token、accent 走 --primary、
// color-scheme 深浅），一处兜底全站，之后新页面新弹窗的控件自动继承 —— 本守卫钉住「不再出现裸控件」。
//
// 四条检测不变量：
//   ① 深色白岛：深色下控件底色亮度 > 0.72（scoped/hardcoded 白底，!important 类）
//   ② 浅色纯白裸控件：背景 == UA 纯白 rgb(255,255,255)（主题化的底是 rgba(255,252,246,0.9) 系，可区分）
//   ③ 原生 accent：range/checkbox/radio 的 accent-color 是 UA 蓝（说明没走 --primary）
//   ④ 假绿自证（内置反例）：浅色态注入一个内联 `background:#fff` 的 input（内联样式压得过基线），
//      规则②必须把它抓出来 —— 抓不到 = 探针瞎了 = 本守卫假绿，直接 FAIL。
import fs from 'node:fs'
import { SKILL_DEFS } from './src/game/data/skills.js'
import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'
const src = fs.readFileSync(new URL('./src/stores/ui.js', import.meta.url), 'utf8')
const block = src.slice(src.indexOf('export const VIEW_KEYS = ['), src.indexOf(']', src.indexOf('export const VIEW_KEYS = [')))
const VIEWS = [...block.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1])
const PAGES = [...VIEWS.filter((v) => v !== 'skill').map((v) => ({ view: v })), ...Object.keys(SKILL_DEFS).map((id) => ({ view: 'skill', skill: id }))]

// 探针函数体（字符串注入页面执行）：dark 参数控制「深色白岛」与「浅色纯白」两套规则切换。
// ⚠️ 反斜杠层级：本模板串里正则的转义写 **两个反斜杠**（模板求值后剩一个，eval 出的正则才正确）。
const SCAN = `
  (dark) => {
    const lum = (c) => {
      const m = c.match(/rgba?\\(([\\d.]+), ([\\d.]+), ([\\d.]+)/)
      if (!m) return 1
      return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 * ((m[4] ?? 1) === 0 ? 0 : 1) + (m[4] === 0 ? 1 : 0)
    }
    const out = []
    const els = [...document.querySelectorAll('input, select, textarea')]
    for (const el of els) {
      if (el.type === 'hidden' || !el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) continue
      const cs = getComputedStyle(el)
      const bg = cs.backgroundColor
      const accent = cs.accentColor || ''
      const tag = el.tagName.toLowerCase() + (el.type ? '[' + el.type + ']' : '')
      const isDarkPage = document.documentElement.dataset.theme === 'dark'
      let why = null
      if (dark && isDarkPage && lum(bg) > 0.72) why = 'white-island bg=' + bg
      if (!dark && bg === 'rgb(255, 255, 255)' && cs.appearance !== 'none') why = 'unthemed-white'
      if ((el.type === 'range' || el.type === 'checkbox' || el.type === 'radio') && /rgb\\(0, 117, 255\\)|rgb\\(0, 99, 224\\)/.test(accent)) why = 'native-accent ' + accent
      if (why) out.push({ tag, why, cls: (el.className || '').toString().slice(0, 40), id: el.id || '' })
    }
    return out
  }
`

async function scanPass(page, dark, vp, label) {
  await page.setViewportSize(vp)
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  await page.locator('.splash-start-btn').click()
  await page.waitForTimeout(300)
  await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
  await page.waitForTimeout(1200)
  await page.evaluate(async (d) => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
    const player = pinia._s.get('player')
    const { ITEMS } = await import('/src/game/data/items.js')
    for (const [id, it] of Object.entries(ITEMS)) { if (it.type !== 'spirit') player.inventory[id] = 999 }
    for (const id of Object.keys(player.skills)) player.skills[id].level = 40
    if (d) { document.documentElement.dataset.theme = 'dark'; player.settings.theme = 'dark' }
  }, dark)
  const suspects = []
  const mark = (arr, pageName) => arr.forEach((s) => suspects.push({ ...s, page: pageName }))
  for (const pg of PAGES) {
    await page.evaluate((p) => {
      const pinia = document.querySelector('#app').__vue_app__.config.pinia ?? document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      pinia._s.get('ui').setView(p.view)
      if (p.skill) pinia._s.get('player').setActiveSkill(p.skill)
    }, pg)
    await page.waitForTimeout(240)
    await page.evaluate(() => {
      for (const d of document.querySelectorAll('.main-scroll details')) d.open = true
    })
    await page.waitForTimeout(120)
    mark(await page.evaluate('(' + SCAN + ')(' + dark + ')'), pg.skill ? `skill:${pg.skill}` : pg.view)
  }
  // 面板：设置 / 存档（控件最多的两个浮层）
  for (const [toggle, name] of [['toggleSettingsPanel', 'settings'], ['toggleSavePanel', 'save']]) {
    await page.evaluate((t) => {
      const pinia = document.querySelector('#app').__vue_app__.config.pinia ?? document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      pinia._s.get('ui')[t](true)
    }, toggle)
    await page.waitForTimeout(500)
    mark(await page.evaluate('(' + SCAN + ')(' + dark + ')'), 'panel:' + name)
    await page.evaluate((t) => {
      const pinia = document.querySelector('#app').__vue_app__.config.pinia ?? document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      pinia._s.get('ui')[t](false)
    }, toggle)
    await page.waitForTimeout(200)
  }
  return suspects
}

test('控件主题化守卫（三遍：浅色/深色/窄屏 + 假绿自证）', async ({ page }) => {
  test.setTimeout(560000)
  const all = []
  // ── 第一遍：浅色 1440（含内置反例自证）──
  all.push(...(await scanPass(page, false, { width: 1440, height: 900 }, 'light-1440')))
  await page.evaluate(() => {
    const probe = document.createElement('input')
    probe.type = 'text'
    probe.id = '__guard_probe__'
    probe.setAttribute('style', 'background:#fff')
    document.querySelector('.main-scroll').appendChild(probe)
  })
  const caught = (await page.evaluate('(' + SCAN + ')(false)')).some((s) => s.why.includes('unthemed-white'))
  await page.evaluate(() => document.getElementById('__guard_probe__')?.remove())
  expect(caught, '假绿自证失败：注入的内联白底控件没被规则②抓到 ⇒ 探针已失效，本守卫在空转').toBe(true)
  // ── 第二遍：深色 1440 ──
  all.push(...(await scanPass(page, true, { width: 1440, height: 900 }, 'dark-1440')))
  // ── 第三遍：浅色 390 ──
  all.push(...(await scanPass(page, false, { width: 390, height: 844 }, 'light-390')))

  const seen = new Set()
  const uniq = all.filter((s) => { const k = `${s.page}|${s.tag}|${s.why}`; if (seen.has(k)) return false; seen.add(k); return true })
  if (uniq.length) console.log('未适配控件：\n' + uniq.map((s) => `[${s.page}] ${s.tag} cls="${s.cls}" — ${s.why}`).join('\n'))
  expect(uniq, `未主题化控件 ${uniq.length} 处：\n` + uniq.map((s) => `[${s.page}] ${s.tag} — ${s.why}`).join('\n')).toEqual([])
})
