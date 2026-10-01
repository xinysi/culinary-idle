// 背景切换实测：启动页 → 进入游戏 → 逐页截图（含深色夜景），并收控制台错误。
import { chromium } from 'playwright'
import { join } from 'node:path'

const BASE = 'http://localhost:5173'
const OUT = join(process.cwd(), 'public')
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1600, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push('console: ' + m.text()) })

await page.goto(BASE)
await page.waitForTimeout(1500)
await page.screenshot({ path: join(OUT, '.bg-01-splash.png') })

await page.locator('.splash-start-btn').click()
await page.waitForTimeout(400)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(2500)

const ui = (fn, arg) => page.evaluate(([f, a]) => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const s = pinia._s.get(f)
  if (f === 'ui') pinia._s.get('ui').setView(a)
  else return null
}, [fn, arg])

const snap = async (name, ms = 1400) => { await page.waitForTimeout(ms); await page.screenshot({ path: join(OUT, `.bg-${name}.png`) }) }
await snap('02-gather')
for (const [v, n] of [['log', '03-log'], ['shop', '04-shop'], ['shanhai', '05-shanhai'], ['restaurant', '06-restaurant']]) {
  await ui('ui', v)
  await snap(n)
}
// 技能页：切到烹饪（同一个 view 但不同技能 ⇒ 背景应跟着换）
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  pinia._s.get('ui').setView('skill')
  pinia._s.get('player').setActiveSkill('cooking')
})
await snap('07-cooking')
// 深色夜景
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  pinia._s.get('player').settings.theme = 'dark'
})
await snap('08-dark-cooking', 2000)
await page.evaluate(() => { document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').settings.theme = 'light' })
console.log(errs.length ? '控制台错误：\n' + errs.slice(0, 8).join('\n') : '控制台错误：无')
await b.close()
