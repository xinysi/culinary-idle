import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 110)))
await page.goto('http://localhost:5173/')
await page.waitForTimeout(900)
await page.getByRole('button', { name: /开始游戏/ }).first().click()
await page.waitForTimeout(600)
const ng = page.getByRole('button', { name: /新游戏/ }).first()
if (await ng.count()) await ng.click(); else await page.getByRole('button', { name: /读取存档/ }).first().click()
await page.waitForTimeout(1600)
for (let k = 0; k < 3; k++) {
  if (await page.getByRole('button', { name: /小游戏/ }).count()) break
  await page.locator('button', { hasText: '›' }).first().click()
  await page.waitForTimeout(350)
}
await page.getByRole('button', { name: /小游戏/ }).first().click()
await page.waitForTimeout(800)
const gotoGame = async (name) => {
  for (let t = 0; t < 5; t++) {
    const e = page.locator('.mg-entry', { hasText: name }).first()
    if (await e.count()) { await e.click(); await page.waitForTimeout(700); return true }
    await page.locator('.mg-page-btn', { hasText: '›' }).first().click()
    await page.waitForTimeout(250)
  }
  return false
}
const HELP = `var findInst = (key) => { const app = document.querySelector('#app').__vue_app__; const found = []; const walk = (v, d) => { if (!v || d > 80 || found.length > 500) return; const i = v.component; if (i && i.setupState && key in i.setupState) found.push(i); if (i) walk(i.subTree, d + 1); const ch = v.children; if (Array.isArray(ch)) ch.forEach((c) => walk(c, d + 1)); else if (ch && typeof ch === 'object') walk(ch, d + 1) }; walk(app._instance.subTree, 0); return found[0] }; var tick = (ms) => new Promise((r) => setTimeout(r, ms));`
// 汤碗躲避
await gotoGame('汤碗躲避')
const r1 = await page.evaluate(async (H) => {
  eval(H)
  const ss = findInst('lives').setupState
  ss.MODES.m1.dur = 16
  document.querySelectorAll('.sd-mode')[0].click(); await tick(300)
  document.querySelector('.sd-start')?.click(); await tick(400)
  const t0 = performance.now()
  while (!ss.over && performance.now() - t0 < 30000) {
    const it = window.__sd && window.__sd.items
    if (it && it.length) {
      // 找最近的威胁，往反方向躲
      let near = null, nd = 1e9
      for (const o of it) { const d = Math.hypot(o.x - ss.bowl.x, o.y - 480); if (d < nd) { nd = d; near = o } }
      if (near) { const away = near.x < ss.bowl.x ? 1 : -1; ss.bowl.x = Math.max(60, Math.min(660, ss.bowl.x + away * 26)) }
    }
    await tick(90)
  }
  return { score: Math.round(ss.score), lives: ss.lives, dodged: ss.dodged, over: ss.over }
}, HELP)
await page.evaluate(() => document.querySelector('[class$="-again"]')?.click())
await page.waitForTimeout(400)
// 叠笼塔
await gotoGame('叠笼塔')
const r2 = await page.evaluate(async (H) => {
  eval(H)
  const ss = findInst('stacked').setupState
  ss.MODES.m1.dur = 16
  document.querySelectorAll('.st-mode')[0].click(); await tick(300)
  document.querySelector('.st-start')?.click(); await tick(400)
  const t0 = performance.now()
  while (!ss.over && performance.now() - t0 < 30000) {
    const bx = window.__st && window.__st.basketX
    if (bx != null && Math.abs(bx - 360) < 16) ss.drop()
    await tick(60)
  }
  return { score: ss.score, lives: ss.lives, stacked: ss.stacked, over: ss.over }
}, HELP)
console.log('汤碗躲避（16 秒）：', JSON.stringify(r1))
console.log('叠笼塔（16 秒）：', JSON.stringify(r2))
console.log('错误：', errors.length ? errors.slice(0, 4) : '无')
await browser.close()
