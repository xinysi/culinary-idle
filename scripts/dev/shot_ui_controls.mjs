// 换肤期细看：把关键控件**逐个放大截一张**（整页图看不出 12px 的撕边与文字间距）。
// 用法：node scripts/dev/shot_ui_controls.mjs [皮肤] [主题]
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(root, 'docs/ui-mockup')
const SKIN = process.argv[2] || 'classic'
const THEME = process.argv[3] || 'light'

const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(300)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(1100)
await page.evaluate(async () => {
  const app = document.querySelector('#app').__vue_app__
  const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
  const player = pinia._s.get('player')
  const items = (await import('/src/game/data/items.js')).ITEMS
  for (const [id, it] of Object.entries(items)) if (it.type !== 'spirit') player.inventory[id] = 999
  player.gold = 1e9
  for (const id of Object.keys(player.skills)) player.skills[id].level = 120
  const { ALL_ACHIEVEMENTS } = await import('/src/game/data/achievements.js')
  player.achievements = ALL_ACHIEVEMENTS.map((a) => a.id)
})
await page.evaluate(async ({ skin, theme }) => {
  const m = await import('/src/game/data/skins.js')
  m.applySkinToDom(skin, theme)
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
}, { skin: SKIN, theme: THEME })
await page.evaluate(() => {
  const app = document.querySelector('#app').__vue_app__
  const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
  pinia._s.get('player').setActiveSkill('knife')
  pinia._s.get('ui').setView('skill')
})
await page.waitForTimeout(600)

// 目标：控件选择器 + 一张图里的取样元素（多个合成一张，省得逐张看）
// ⚠️ 用 **boundingBox + clip 截图**，不用 element.screenshot：后者对隐藏元素会一直等
//   「element is not visible」直到 30s 超时（`.btn:not(.btn-primary)` 里就有隐藏的）。
const TARGETS = [
  ['风格按钮(印泥)', '.style-btn.btn-primary'],
  ['卡片', '.card'],
  ['普通按钮', '.btn.btn-sm:not(.btn-primary)'],
  ['进度条', '.progress-bar'],
  ['徽章', '.badge'],
  ['页签', '.region-tabs .btn, .era-tab .btn'],
]
const shots = []
for (const [label, sel] of TARGETS) {
  const boxes = await page.evaluate((s) => {
    const out = []
    for (const el of document.querySelectorAll(s)) {
      const r = el.getBoundingClientRect()
      // 只收**完全在视口内**的：视口外的东西夹取后会得到负高度（clip 直接报错）
      if (r.width > 8 && r.height > 4 && r.top >= 0 && r.left >= 0 &&
          r.bottom <= innerHeight && r.right <= innerWidth) out.push({ x: r.x, y: r.y, width: r.width, height: r.height })
      if (out.length >= 3) break
    }
    return out
  }, sel)
  if (!boxes.length) { console.log('缺（或全隐藏/在视口外）:', sel); continue }
  // 把前几个并成一个条带，留 10px 余量
  const x0 = Math.max(0, Math.min(...boxes.map((b) => b.x)) - 10)
  const y0 = Math.max(0, Math.min(...boxes.map((b) => b.y)) - 10)
  const x1 = Math.min(1440, Math.max(...boxes.map((b) => b.x + b.width)) + 10)
  const y1 = Math.min(900, Math.max(...boxes.map((b) => b.y + b.height)) + 10)
  await page.screenshot({
    path: join(OUT, `控件-${SKIN}-${THEME}-${label}.png`),
    clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
  })
  shots.push(`${label}(${boxes.length})`)
}
const scene = await page.locator('.combo-left').first()
if (await scene.count()) await scene.screenshot({ path: join(OUT, `控件-${SKIN}-${THEME}-场景.png`) })
await b.close()
console.log(`皮肤 ${SKIN} · 主题 ${THEME} → 截图 ${shots.length} 张：${shots.join(' / ')}`)
