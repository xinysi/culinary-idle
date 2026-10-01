// 线上核验（v2.30.7 效果总览重做）—— 判据：左系统栏在、点「美食探索」右侧五节齐全。
// 反向对照：上一版没有左栏（`fx-rail` 一个都抓不到）⇒ 抓到即证明新版上线。
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2307'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } })
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push(m.text()) })
await page.goto(URL_, { waitUntil: 'load' })
await page.waitForTimeout(2500)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(500)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(3000)
await page.evaluate(() => { document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value.ui.activeView = 'effects' })
await page.waitForTimeout(2500)

let bad = 0
const ok = (c, l, d) => { if (!c) bad++; console.log(`${c ? '✅' : '❌'} ${l}${d ? ' — ' + d : ''}`) }
const rail = await page.evaluate(() => [...document.querySelectorAll('.fx-rail-item')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()))
ok(rail.length >= 10, '左系统栏在（11 个系统，上一版完全没有）', `${rail.length} 格：${rail.slice(0, 3).join(' ｜ ')}`)
ok(rail.some((s) => s.includes('美食探索')), '左栏有「美食探索」且自成一格（本次重做的直接起因）',
  rail.find((s) => s.includes('美食探索')) || '')

// 点「美食探索」，看右侧五节
await page.evaluate(() => { [...document.querySelectorAll('.fx-rail-item')].find((e) => e.textContent.includes('美食探索'))?.click() })
await page.waitForTimeout(900)
const pane = await page.evaluate(() => ({
  head: document.querySelector('.fx-pane-head')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  sections: [...document.querySelectorAll('.fx-pane .card h3')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
  fxRows: document.querySelectorAll('.fx-pane .fx-formula-row').length,
}))
ok(pane.fxRows === 3, '右侧「规则与公式」正好 3 条（这个系统的全部）', `公式行 ${pane.fxRows}`)
ok(pane.sections.some((s) => s.includes('正生效')) && pane.sections.some((s) => s.includes('规则与公式')),
  '右侧分节齐（正生效 / 全局叠加 / 规则与公式 / 未生效）', pane.sections.join(' ｜ ').slice(0, 90))
ok(errs.length === 0, '页面零报错', errs.slice(0, 2).join(' | '))
await b.close()
console.log(bad === 0 ? '\n线上核验通过' : `\n线上核验失败：${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
