// 量农耕选种子弹窗的格子宽度预算（决定减半标签怎么放才不会挤坏同一行）
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5173'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(BASE)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(1200)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(400)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(1400)
await page.evaluate(async () => {
  const pin = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const p = pin._s.get('player'); const ui = pin._s.get('ui')
  p.setSkillState('farming', { level: 60, exp: 0, prestiges: 0 })
  p.activeSkill = 'farming'; ui.activeView = 'skill'
  await new Promise((s) => setTimeout(s, 400))
})
await page.waitForTimeout(1000)
await page.evaluate(() => {
  const b2 = [...document.querySelectorAll('button')].find((x) => /种植|选种子/.test(x.textContent))
  if (b2) b2.click()
})
await page.waitForTimeout(900)
const info = await page.evaluate(() => {
  const cell = document.querySelector('.seed-crop-grid .item-cell') ?? document.querySelector('.modal-backdrop .item-cell')
  if (!cell) return { err: '找不到种子格子' }
  const subs = [...cell.querySelectorAll('.item-cell-sub')]
  const rect = (el) => { const r = el.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), lines: [...el.children].map((c) => +c.getBoundingClientRect().height.toFixed(1)) } }
  return {
    cell: rect(cell),
    grid: document.querySelector('.seed-crop-grid')?.className,
    cols: getComputedStyle(document.querySelector('.seed-crop-grid')).gridTemplateColumns.split(' ').length,
    subs: subs.map((s) => ({ text: s.textContent.trim().slice(0, 24), ...rect(s), ws: getComputedStyle(s).flexWrap })),
    chip: cell.querySelector('.xp-low-chip') ? rect(cell.querySelector('.xp-low-chip')) : null,
  }
})
console.log(JSON.stringify(info, null, 1))
await b.close()
