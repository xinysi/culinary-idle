import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1920, height: 922 } })
await p.addInitScript(() => localStorage.setItem('culinary-idle.theme', 'dark'))
await p.goto('http://localhost:5173/', { waitUntil: 'load' })
await p.waitForTimeout(500)
await p.locator('.splash-start-btn').click()
await p.waitForTimeout(400)
await p.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await p.waitForTimeout(1000)
await p.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  pinia._s.get('ui').setView('skill')
  pinia._s.get('player').setActiveSkill('foraging')
})
await p.waitForTimeout(900)
await p.locator('.dock-pill[data-sec="idle"]').click()
await p.waitForTimeout(500)

const sels = ['.sidebar.app-sidebar', '.top-nav', '.app-main', '.main-scroll', '.dock', '.dock-panel', '.card', '.gather-card']
const rows = await p.evaluate((list) => {
  const res = []
  for (const sel of list) {
    const el = document.querySelector(sel)
    if (!el) { res.push(sel + ' :: 缺'); continue }
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const bd = ['Top', 'Right', 'Bottom', 'Left'].map((s) => {
      const w = cs['border' + s + 'Width']
      return w === '0px' ? '-' : w + ':' + cs['border' + s + 'Color']
    }).join(' | ')
    const gold = /201, 150, 47|222, 176, 74|110, 79, 33/.test(cs.borderTopColor + cs.boxShadow)
    res.push([sel, cs.position, Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height),
      'border[' + bd + ']', 'shadow[' + (cs.boxShadow === 'none' ? '-' : cs.boxShadow.replace(/\s+/g, ' ').slice(0, 52)) + ']',
      'myGold=' + (gold ? 'Y' : 'N')].join('  '))
  }
  return res
}, sels)
for (const r of rows) console.log(r)
await p.screenshot({ path: 'C:/Users/xin'si/AppData/Local/Temp/chk-borders.png' })
await b.close()
