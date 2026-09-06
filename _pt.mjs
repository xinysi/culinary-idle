import { chromium } from '@playwright/test'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } })
page.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 120)))
await page.goto('http://localhost:5173/')
await page.waitForTimeout(1200)
await page.locator('.splash-start-btn').click()
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(2000)
for (let i = 0; i < 2; i++) { await page.locator('.top-nav-pager').nth(1).click(); await page.waitForTimeout(300) }
await page.locator('.top-nav-btn', { hasText: '小游戏' }).click()
await page.waitForTimeout(1500)
await page.locator('.mg-entry', { hasText: '美食拼图' }).click()
await page.waitForTimeout(1500)
const r = await page.evaluate(() => {
  const full = document.querySelector('.pz-fullimg')
  const cell = document.querySelector('.pz-cell:not(.empty)')
  return { fullOk: !!(full && full.complete && full.naturalWidth > 300), cellBg: cell ? getComputedStyle(cell).backgroundImage.slice(0, 70) : null }
})
console.log(JSON.stringify(r))
await page.screenshot({ path: '_pt.png' })
await b.close()
