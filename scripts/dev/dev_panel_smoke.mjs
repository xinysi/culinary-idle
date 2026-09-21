// 开发者面板端到端冒烟：入口（连点标题）→ 口令挡板 → 面板四页签 → 一键满配 → 体检 → 埋点
//
// 用法（需 dev server 已在 http://localhost:5173 跑着）：
//   node scripts/dev/dev_panel_smoke.mjs
//
// 为什么单独一个脚本、不进 e2e 套件：它会**清 localStorage 并灌满档数据**（一键满配），
// 与其它 e2e 用例抢同一份存档；而开发者面板本身在 `e2e-*` 里也不是玩家功能页（它刻意不进 Sidebar）。
// 截图落在 `.tmp-audit/`（可随时删）。
//
// ⚠️ 这个脚本只在**开发构建**下有意义：生产构建里 DEV_PANEL_ENABLED 静态为 false，
//    连点标题不会有任何反应（这正是预期行为，见 scripts/ci/dev_panel_audit.mjs 的 D 组）。
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const SHOT_DIR = '.tmp-audit'
mkdirSync(SHOT_DIR, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text()) })

const step = (n, s) => console.log(`${n}. ${s}`)

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(1400)
step(1, '启动页已加载')

// ① 标题连点 5 下 → 登录挡板
for (let i = 0; i < 5; i++) { await page.locator('.splash-title').click(); await page.waitForTimeout(60) }
await page.waitForTimeout(300)
const gate = await page.locator('.dev-gate').count()
step(2, `连点标题 5 下后出现登录挡板: ${gate === 1 ? '✅' : '🔴 没出现'}`)

// ② 错口令
await page.locator('.dev-pw').fill('wrong-password')
await page.locator('.dev-gate-actions button', { hasText: '登录' }).click()
await page.waitForTimeout(300)
step(3, `错口令提示: ${(await page.locator('.dev-msg').textContent().catch(() => '')) || '（无）'}`)

// ③ 对口令
await page.locator('.dev-pw').fill('dev123456')
await page.locator('.dev-gate-actions button', { hasText: '登录' }).click()
await page.waitForTimeout(500)
const panel = await page.locator('.dev-panel').count()
step(4, `对口令后打开面板: ${panel === 1 ? '✅' : '🔴 没打开'}`)
await page.screenshot({ path: `${SHOT_DIR}/dev-1-save.png` })

// ④ 页签清单 + 运行时页签（启动页阶段应提示先进入游戏）
const tabs = await page.locator('.dev-tabs button').allTextContents()
step(5, `页签: ${tabs.join(' | ')}`)
await page.locator('.dev-tabs button', { hasText: '运行时' }).click()
await page.waitForTimeout(200)
step(6, `运行时页签（未进游戏）提示: ${(await page.locator('.dev-body p.dim').first().textContent()) || '（无）'}`)

// ⑤ 存档页签内容
await page.locator('.dev-tabs button', { hasText: '存档' }).click()
await page.waitForTimeout(200)
const slotCount = await page.locator('.dev-slot').count()
step(7, `存档页签列出槽位: ${slotCount} 个`)

// ⑥ 进入游戏（关面板 → 开始游戏 → 选新档）
await page.locator('.dev-head button', { hasText: '✕' }).click()
await page.waitForTimeout(200)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(300)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(1500)
step(8, '已进入游戏')

// ⑦ 热键开面板（已登录，不应再问口令）
await page.keyboard.press('Control+Shift+D')
await page.waitForTimeout(500)
step(9, `Ctrl+Shift+D 开面板: ${(await page.locator('.dev-panel').count()) === 1 ? '✅' : '🔴'}`)

// ⑧ 一键满配
const before = await page.evaluate(() => {
  const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
  return { gold: p.gold, items: Object.keys(p.inventory).length, knife: p.skills.knife.level }
})
await page.locator('.dev-tabs button', { hasText: '运行时' }).click()
await page.waitForTimeout(200)
await page.locator('.dev-grid button', { hasText: '一键满配' }).click()
await page.waitForTimeout(600)
const after = await page.evaluate(() => {
  const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
  return { gold: p.gold, items: Object.keys(p.inventory).length, knife: p.skills.knife.level, ach: p.achievements.length, shanhai: p.shanhaiUnlocked.length }
})
step(10, `一键满配: 金币 ${before.gold}→${after.gold} · 物品 ${before.items}→${after.items} · 刀工 ${before.knife}→${after.knife} · 成就 ${after.ach} · 山海 ${after.shanhai}`)
await page.screenshot({ path: `${SHOT_DIR}/dev-2-runtime.png` })

// ⑨ 存档体检（17 项，异常应为 0）
await page.locator('.dev-tabs button', { hasText: '体检' }).click()
await page.waitForTimeout(200)
await page.locator('.dev-body button', { hasText: '运行存档体检' }).click()
await page.waitForTimeout(600)
const checks = await page.locator('.dev-check').allTextContents()
const bad = await page.locator('.dev-check.bad').count()
step(11, `体检 ${checks.length} 项，异常 ${bad} 项`)
checks.slice(0, 4).forEach((c) => console.log('     ', c.replace(/\s+/g, ' ').trim().slice(0, 90)))
await page.screenshot({ path: `${SHOT_DIR}/dev-3-check.png` })

// ⑩ 埋点
await page.locator('.dev-tabs button', { hasText: '埋点' }).click()
await page.waitForTimeout(300)
const markRows = await page.locator('.dev-table tbody tr').count()
step(12, `埋点页签行数: ${markRows}`)
await page.screenshot({ path: `${SHOT_DIR}/dev-4-mark.png` })

console.log('\n控制台错误:', errs.length ? errs.slice(0, 5) : '（无）')
await browser.close()
