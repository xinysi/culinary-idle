// 用新图跑一遍界面并截图（新档即可看到采集/制作卡、图鉴、商店的物品图）
// 用法：node scripts/dev/shot_newart.mjs   → 输出到 public/.shot-*.png
import { chromium } from 'playwright'
import { join } from 'node:path'

const BASE = 'http://localhost:5173'
const OUT = join(process.cwd(), 'public')
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1600, height: 950 } })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push('console: ' + m.text()) })

await page.goto(BASE)
await page.waitForTimeout(1200)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(400)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(2500)

const setView = (v) => page.evaluate((view) => {
  const app = document.querySelector('#app').__vue_app__
  const pinia = app.config.globalProperties.$pinia
  const store = pinia.state.value.ui ? pinia._s.get('ui') : null
  if (!store) throw new Error('找不到 ui store')
  store.setView(view)
}, v)

const snap = async (name, ms = 1100) => {
  await page.waitForTimeout(ms)
  await page.screenshot({ path: join(OUT, `.shot-${name}.png`) })
}

const shots = []
await snap('gather')                                          // 采集技能页（默认，卡片里的物品图）
shots.push('gather')
for (const [view, name] of [['log', 'log'], ['shop', 'shop'], ['cook', 'cook']]) {
  try { await setView(view) } catch (e) { console.log('切页失败 ' + view + ': ' + e.message) }
  await snap(name)
  shots.push(name)
}
// 制作技能页（烹饪，卡片 + 材料图标）
await page.evaluate(() => {
  const app = document.querySelector('#app').__vue_app__
  const pinia = app.config.globalProperties.$pinia
  pinia._s.get('ui').setView('skill')
  try { pinia._s.get('player').setActiveSkill('cooking') } catch (e) { /* ignore */ }
})
await snap('cooking')
shots.push('cooking')

console.log('截图：', shots.join(' / '))
console.log(errs.length ? '控制台错误：\n' + errs.slice(0, 8).join('\n') : '控制台错误：无')
await b.close()
