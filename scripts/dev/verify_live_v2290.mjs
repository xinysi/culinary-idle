// 线上核验（v2.29.0）——只查「只在本版出现的可见特征」，不比对 chunk 哈希
// （Pages 用自带 Node 构建，产物哈希与本地不一致，比哈希会误判成「没部署」）。
//
// 本版三个独有特征，全部走**真实 UI 路径**（线上是打包产物 ⇒ 不能 import 模块来探针）：
//   ① 制作卡片多了一个「🧪 练习」按钮；点开弹窗的标题/单位是「练习 … 次动作」（本版新增的动作）
//   ② 队列条目带「🧪 练习」标签（本版新增的队列模式）
//   ③ **追赶**：把主线程卡住 15 秒（模拟后台标签页被浏览器降速），放开后一次心跳要追上 ≥4 次；
//      旧版「每次只做 1 次」在这里只会少 1
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2290'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push('console: ' + m.text()) })
await page.goto(URL_, { waitUntil: 'load' })
await page.waitForTimeout(1500)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(500)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(2200)

let bad = 0
const ok = (cond, label, detail) => { if (!cond) bad++; console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`) }

// 切到烹饪页（`player.activeSkill` 才是技能页的真正口径；`ui.activeSkill` 是另一件事）
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const p = pinia._s.get('player')
  p.activeSkill = 'cooking'
  p.skills.cooking.level = 99
  pinia._s.get('ui').activeView = 'skill'
})
await page.waitForTimeout(900)

// ① 练习按钮 → 弹窗口径
const btn = page.locator('.recipe-action button', { hasText: '练习' }).first()
ok((await btn.count()) > 0, '① 制作卡片上有「🧪 练习」按钮（本版新增）')
await btn.click()
await page.waitForTimeout(500)
const modalText = await page.locator('.qty-modal').innerText()
ok(/练习/.test(modalText) && /次动作/.test(modalText), '① 弹窗标题与单位是练习口径（不耗料、不产出、不给经验）', modalText.replace(/\n/g, ' ').slice(0, 60))
// v2.29.1 修的那处口径：上限必须是「到精通 100 还差 N 次」，不是到下一档（后者会写成「还差 8 次」）
ok(/到精通 100 还差 \d+ 次/.test(modalText), '① 弹窗上限的口径 = 到精通 100 还差 N 次（v2.29.1 修正）', (modalText.match(/到精通 100 还差 [\d,]+ 次/) ?? ['未找到'])[0])
await page.locator('.qty-modal .qty-quick button', { hasText: '最大' }).click()
await page.locator('.qty-modal .qty-actions .btn-primary').click()
await page.waitForTimeout(700)

// ② 队列条目带「练习」标签
const q1 = await page.locator('.queue-item').first().innerText()
ok(/练习/.test(q1), '② 队列条目带「🧪 练习」标签（本版新增的队列模式）', q1.replace(/\n/g, ' '))
const n1 = Number((q1.match(/×\s*(\d+)/) ?? [])[1])

// ③ 追赶：卡住主线程 15 秒（≈后台被降速），放开后应一次追上 ≥4 次
await page.evaluate(() => { const t = Date.now(); while (Date.now() - t < 15_000) { /* 阻塞事件循环，引擎的心跳也停 */ } })
await page.waitForTimeout(1500)
const q2 = await page.locator('.queue-item').first().innerText()
const n2 = Number((q2.match(/×\s*(\d+)/) ?? [])[1])
ok(Number.isFinite(n1) && Number.isFinite(n2) && n1 - n2 >= 4,
  '③ 停摆 15 秒后一次追上 ≥4 次（旧版「每次心跳只做 1 次」只会少 1）', `${n1} → ${n2}`)

ok(errs.length === 0, '页面零控制台错误', errs.slice(0, 3).join(' | '))
console.log(bad === 0 ? '\n线上核验通过' : `\n❌ 有 ${bad} 项不通过`)
await b.close()
process.exit(bad === 0 ? 0 : 1)
