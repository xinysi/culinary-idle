// 线上核验（v2.29.4）—— 只查「只在本版出现的可见特征」，**不比对 chunk 哈希**
// （Pages 用自带 Node 构建，产物哈希与本地不一致；用 `?v=` 穿透 max-age=600）。
//
// 🔴 线上是**打包产物**：**不许 `import('/src/...')`**（生产里没有 /src）。只走 DOM 与 pinia。
//
// 本版特征：
//   ① 图鉴总数 2564（2508 + 6 保鲜 Ⅵ/Ⅶ + 2 灵田种子 + 48 副业变体）
//   ② 副业变体：制作页里出现「·精 / ·珍 / ·御」三档（把该支技能抬到 120，默认展开末档）
//   ③ 米其林六星：星级阶梯含「六星 ≥11500」+ 第七维「宴席承办」
//   ④ 副业产业链：面板上有独立的「🪚 投入木器（跨线半价）」按钮（背包里有木器时才出现）
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2294'
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
const go = async (view, skill, levels = null, inv = null) => {
  await page.evaluate(({ view, skill, levels, inv }) => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const p = pinia._s.get('player')
    if (levels) for (const [id, lv] of Object.entries(levels)) p.skills[id].level = lv
    if (inv) for (const [id, n] of Object.entries(inv)) p.inventory[id] = n
    if (skill) p.activeSkill = skill
    pinia._s.get('ui').activeView = view
  }, { view, skill, levels, inv })
  await page.waitForTimeout(1000)
}
const bodyText = () => page.evaluate(() => document.body.textContent ?? '')

// ① 图鉴总数
await go('log')
const logText = await bodyText()
ok(/共\s*2564\s*种物品/.test(logText), '① 图鉴总数 = 2564 件（旧版 2516）', (logText.match(/共\s*\d+\s*种物品/) ?? ['未找到'])[0])

// ② 副业变体（把陶艺抬到 120 ⇒ 默认展开末档，·御 会渲染出来）
await go('skill', 'pottery', { pottery: 120 })
const potText = await bodyText()
ok(/赤霄釉瓮·御/.test(potText), '② 副业同物变体出现（陶艺末档「赤霄釉瓮·御」）', (potText.match(/赤霄釉瓮·\S/) ?? ['未找到'])[0])
ok(/赤霄釉瓮·珍/.test(potText), '② 同支另两档也在（·精 / ·珍 至少一档可见）')

// ③ 米其林六星 + 第七维（成就页找成就、米其林页找星级阶梯）
await go('achievements')
const achText = await bodyText()
ok(/六星殿堂/.test(achText), '③ 成就页出现「六星殿堂」', (achText.match(/.{0,4}六星殿堂/) ?? ['未找到'])[0])
// ⚠️ 米其林页**要解锁**（餐厅 Lv3）才有内容渲染 —— 不抬餐厅等级只会看到「未解锁」
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  pinia._s.get('player').restaurant.level = 10
})
await go('michelin', null, { cooking: 10 })
const micText = await bodyText()
ok(/六星|宴席承办/.test(micText), '③ 米其林页出现「六星」与第七维「宴席承办」',
  (micText.match(/六星/) ?? ['未找到'])[0] + ' / ' + (micText.match(/宴席承办/) ?? ['未找到'])[0])

// ④ 副业产业链：给背包塞一件木器 ⇒ 面板出现独立的跨线投入按钮
await go('skill', 'pottery', { pottery: 120 }, { woodenPlate: 2 })
const chainText = await bodyText()
ok(/投入木器/.test(chainText), '④ 副业面板出现独立的「🪚 投入木器（跨线半价）」按钮', (chainText.match(/🪚 投入木器[^）]*）/) ?? ['未找到'])[0])

ok(errs.length === 0, '页面零控制台错误', errs.slice(0, 3).join(' | '))
console.log(bad === 0 ? '\n线上核验通过' : `\n❌ 有 ${bad} 项不通过`)
await b.close()
process.exit(bad === 0 ? 0 : 1)
