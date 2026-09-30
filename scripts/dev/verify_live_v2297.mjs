// 线上核验（v2.29.7）—— 只查「只在本版出现的可见特征」，**不比对 chunk 哈希**
// （Pages 用自带 Node 构建，产物哈希与本地不一致；用 `?v=` 穿透 max-age=600）。
//
// 🔴 线上是**打包产物**：**不许 `import('/src/...')`**（生产里没有 /src）。只走 DOM 与 pinia。
//
// 本版特征（副业 16 支档位加密：「·良」142 件，Lv1~91 从 10 级/件 变成 5 级/件）：
//   ① **副业页是平铺渲染**（一页看到全部档位）⇒ 陶艺页上必须能看到「陶碗·良」这类加密档卡片；
//   ② 加密档**不是作品** ⇒ 作品面板的件数仍然是 15（不是 24）——「显示与结算不一致」的常见坑就在这；
//   ③ 图鉴总数 2564 → **2706**（+142 = 15 支各 9 + 木工 9）。
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2297'
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
const bodyText = () => page.evaluate(() => document.body.textContent ?? '')

// ① 副业页（陶艺，平铺）出现加密档「·良」
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const p = pinia._s.get('player')
  p.skills.pottery.level = 60
  p.activeSkill = 'pottery'
  pinia._s.get('ui').activeView = 'skill'
})
await page.waitForTimeout(1200)
const potText = await bodyText()
ok(/陶碗·良/.test(potText), '① 陶艺页出现加密档「陶碗·良」（Lv1~91 已做成 5 级/件）', (potText.match(/陶碗·\S/) ?? ['未找到'])[0])
ok(/陶盘·良/.test(potText), '① 同支其它加密档也在（·良 成对出现，不是孤例）')

// ② 加密档**不是作品**：作品面板的件数仍是 15（若被当成作品会变成 24）
const cardCount = await page.evaluate(() => document.querySelectorAll('.gather-card').length)
ok(cardCount >= 24, '② 陶艺页配方卡 ≥ 24 张（15 作品档 + 9 加密档；平铺渲染）', `cards=${cardCount}`)
// 面板原话是「已完成 x/y 件」（`SidelineWorkPanel.vue`）——y 取 SIDELINE_WORKS 的条数。
// 加密档若被误登记为作品，这里会变成 /24（本版最该防的一处「显示与结算不一致」）。
const workLine = potText.match(/已完成\s*(\d+)\/(\d+)\s*件/)
ok(workLine && workLine[2] === '15', '② 作品件数仍是 **15**（加密档不登记为作品；若变成 24 就是被误登记）',
  workLine ? workLine[0] : '未找到「已完成 x/y 件」')
ok(!/已完成\s*\d+\/24\s*件/.test(potText), '② 反向：面板没有把加密档算进作品（不会出现 /24）')

// ③ 图鉴总数 2706
await page.evaluate(() => { document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui').activeView = 'log' })
await page.waitForTimeout(1000)
const logText = await bodyText()
ok(/共\s*2706\s*种物品/.test(logText), '③ 图鉴总数 = 2706 件（旧版 2564）', (logText.match(/共\s*\d+\s*种物品/) ?? ['未找到'])[0])

ok(errs.length === 0, '页面零控制台错误', errs.slice(0, 3).join(' | '))

await b.close()
console.log(bad === 0 ? '\n线上核验通过' : `\n线上核验失败：${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
