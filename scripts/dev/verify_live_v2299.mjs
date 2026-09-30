// 线上核验（v2.29.9）—— 只查「只在本版出现的可见特征」，**不比对 chunk 哈希**
// （Pages 用自带 Node 构建，产物哈希与本地不一致；用 `?v=` 穿透 max-age=600）。
//
// 🔴 线上是**打包产物**：**不许 `import('/src/...')`**（生产里没有 /src）。只走 DOM 与 pinia。
//
// 本版特征（填满 7 个零内容等级：Lv101/103/107/109/113/115/119 各 +6 件）：
//   ① 图鉴总数 2706 → **2752**
//   ② 采集页（采摘）抬到 Lv120 ⇒ 出现新目标「霜髓莓」（Lv101）
//   ③ 制作页（烹饪）抬到 Lv120 ⇒ 出现新配方「雪麦鲈鱼汤」（Lv101）
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2299'
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
const setSkill = async (skill, level, view = 'skill') => {
  await page.evaluate(({ skill, level, view }) => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const p = pinia._s.get('player')
    p.skills[skill].level = level
    p.activeSkill = skill
    pinia._s.get('ui').activeView = view
  }, { skill, level, view })
  await page.waitForTimeout(1200)
}
const bodyText = () => page.evaluate(() => document.body.textContent ?? '')

// ① 图鉴总数 2752
await page.evaluate(() => { document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui').activeView = 'log' })
await page.waitForTimeout(1000)
const logText = await bodyText()
ok(/共\s*2752\s*种物品/.test(logText), '① 图鉴总数 = 2752 件（旧版 2706）', (logText.match(/共\s*\d+\s*种物品/) ?? ['未找到'])[0])

// ⚠️ **等级要设成 101 而不是 120**：采集/制作页按等级段分档、默认只展开**玩家等级所在的那一档**
//    ⇒ 设 120 只会展开末档，101 级的新内容根本不在渲染范围里（v2.29.5 的线上核验为此踩过一次）。
// ② 采摘 Lv101 ⇒ 新目标「霜髓莓」（Lv101）出现在页面里
await setSkill('foraging', 101)
const forText = await bodyText()
ok(/霜髓莓/.test(forText), '② 采摘页出现新目标「霜髓莓」（Lv101，本批采集原料）', (forText.match(/霜髓莓/) ?? ['未找到'])[0])

// ③ 烹饪 Lv101 ⇒ 新配方「雪麦鲈鱼汤」（Lv101）出现在页面里
await setSkill('cooking', 101)
const cookText = await bodyText()
ok(/雪麦鲈鱼汤/.test(cookText), '③ 烹饪页出现新配方「雪麦鲈鱼汤」（Lv101，本批成品）', (cookText.match(/雪麦鲈鱼汤/) ?? ['未找到'])[0])

ok(errs.length === 0, '页面零控制台错误', errs.slice(0, 3).join(' | '))

await b.close()
console.log(bad === 0 ? '\n线上核验通过' : `\n线上核验失败：${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
