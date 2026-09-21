import { chromium } from '@playwright/test'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(800)
await page.locator('.splash-start-btn').click()
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(1200)
await page.evaluate(async () => {
  const app = document.querySelector('#app').__vue_app__
  const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
  const pl = pinia._s.get('player')
  const { ITEMS } = await import('/src/game/data/items.js')
  pl.newGame(); pl.gold = 50000
  for (const it of Object.values(ITEMS)) if (pl.inventory[it.id] === undefined) pl.inventory[it.id] = 9
  for (const s of Object.keys(pl.skills)) pl.setSkillState(s, { level: 33, exp: 500, prestiges: 1 })
})
for (const [view, skill, tag] of [['skill', 'foraging', 'skill'], ['restaurant', null, 'restaurant'], ['arena', null, 'arena'], ['guild', null, 'guild'], ['inventory', null, 'inventory']]) {
  await page.evaluate((p) => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
    pinia._s.get('ui').setView(p.view)
    if (p.skill) pinia._s.get('player').setActiveSkill(p.skill)
  }, { view, skill })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `.fingerprint/tr_${tag}.png`, clip: { x: 1000, y: 50, width: 440, height: 130 } })
}
await b.close()
console.log('done')
