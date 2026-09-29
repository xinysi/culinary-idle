// 线上核验（v2.29.3）—— 只查「只在本版出现的可见特征」，**不比对 chunk 哈希**
// （Pages 用自带 Node 构建，产物哈希与本地不一致；用 `?v=` 穿透 max-age=600）。
//
// 🔴 线上是**打包产物**：**不许 `import('/src/...')`**（生产里没有 /src）。只走 DOM 与 pinia。
//
// 本版特征（名字只在 v2.29.3 存在 ⇒ 版本身份明确）：
//   ① 图鉴总数 2516（2508 + 6 保鲜 Ⅵ/Ⅶ + 2 灵田种子）
//   ② 食材保鲜页出现「保鲜剂·Ⅶ」（Ⅵ/Ⅶ = Lv105/Lv120）
//   ③ 灵圃菌房：灵植 8 种（含「九畹灵芝圃」）+ 培养基 4 种（含「九畹菌床」）
//   ④ 牧场：6 种动物（含「霜甲犀」「雪鬃牦牛」）
//   ⑤ 温室蜂场：7 种蜜源（含「霜蜜蜜箱」「紫府蜜箱」）
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2293'
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
// `levels` 用来解锁/抬等级：制作页的**默认展开档**由当前技能等级决定（`currentEraLabel`），
// 而温室页的蜂箱区是**按解锁等级**渲染的 ⇒ 不抬等级只会看到「未解锁」而不是蜜箱列表。
const go = async (view, skill, levels = null) => {
  await page.evaluate(({ view, skill, levels }) => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const p = pinia._s.get('player')
    if (levels) for (const [id, lv] of Object.entries(levels)) p.skills[id].level = lv
    if (skill) p.activeSkill = skill
    pinia._s.get('ui').activeView = view
  }, { view, skill, levels })
  await page.waitForTimeout(1000)
}
// 用 textContent（折叠的 `<details>` 里的文本也在 DOM 里，innerText 会漏）
const bodyText = () => page.evaluate(() => document.body.textContent ?? '')

// ① 图鉴：总物品数
await go('log')
const logText = await bodyText()
ok(/共\s*2516\s*种物品/.test(logText), '① 图鉴总数 = 2516 件（旧版 2508）', (logText.match(/共\s*\d+\s*种物品/) ?? ['未找到'])[0])

// ② 食材保鲜：Ⅶ 阶（把技能抬到 120 ⇒ 默认展开最后一档，Ⅵ/Ⅶ 都渲染出来）
await go('skill', 'preservation', { preservation: 120 })
const presText = await bodyText()
ok(/保鲜剂·Ⅶ/.test(presText) && /经验增益剂·Ⅶ/.test(presText) && /产量增益剂·Ⅶ/.test(presText),
  '② 食材保鲜出现 Ⅰ~Ⅶ 阶（三系列都有「·Ⅶ」）')

// ③ 灵圃菌房：灵植 8 种 + 培养基 4 种
await go('mycoField')
const mycoText = await bodyText()
const spiritRows = await page.locator('.mf-table-card').nth(1).locator('tbody tr').count()
const mediaRows = await page.locator('.mf-table-card').nth(0).locator('tbody tr').count()
ok(/九畹灵芝圃/.test(mycoText) && /无根玉参畦/.test(mycoText), '③ 灵田新增「九畹灵芝圃 / 无根玉参畦」')
ok(spiritRows >= 9 && mediaRows === 4, '③ 灵植表 8 行（+表头）/ 培养基表 4 行', `灵植 tbody=${spiritRows} 培养基 tbody=${mediaRows}`)
ok(/九畹菌床/.test(mycoText) && /云芝沃床/.test(mycoText), '③ 菌房新增「云芝沃床 / 九畹菌床」')

// ④ 牧场：6 种动物
await go('ranch')
const ranchText = await bodyText()
const animalRows = await page.locator('table').first().locator('tbody tr').count()
ok(/霜甲犀/.test(ranchText) && /雪鬃牦牛/.test(ranchText), '④ 牧场新增「霜甲犀 / 雪鬃牦牛」')
ok(animalRows >= 6, '④ 牧场动物表 ≥6 行', `tbody=${animalRows}`)

// ⑤ 温室蜂场：7 种蜜源（温室农耕 Lv20 解锁）
await go('greenhouse', null, { farming: 120 })
const ghText = await bodyText()
ok(/霜蜜蜜箱/.test(ghText) && /紫府蜜箱/.test(ghText), '⑤ 温室新增「霜蜜蜜箱 / 紫府蜜箱」两只蜜箱')

ok(errs.length === 0, '页面零控制台错误', errs.slice(0, 3).join(' | '))
console.log(bad === 0 ? '\n线上核验通过' : `\n❌ 有 ${bad} 项不通过`)
await b.close()
process.exit(bad === 0 ? 0 : 1)
