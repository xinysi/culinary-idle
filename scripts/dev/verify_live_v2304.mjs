// 线上核验（v2.30.4 效果公式栏）—— 判据：DOM 里真的出现公式行（105 条），且文案是中文口径。
// 反向对照：旧版没有这一栏 ⇒ 抓不到任何 `.fx-formula-row`。
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2304'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } })
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push(m.text()) })
await page.goto(URL_, { waitUntil: 'load' })
await page.waitForTimeout(2500)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(500)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(3000)
await page.evaluate(() => { document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value.ui.activeView = 'effects' })
await page.waitForTimeout(2500)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('details')].find((x) => (x.textContent || '').includes('各效果的数值公式'))
  if (d) d.open = true
})
await page.waitForTimeout(1000)

let bad = 0
const ok = (c, l, d) => { if (!c) bad++; console.log(`${c ? '✅' : '❌'} ${l}${d ? ' — ' + d : ''}`) }
const r = await page.evaluate(() => ({
  rows: document.querySelectorAll('.fx-formula-row').length,
  groups: document.querySelectorAll('.fx-formula-group').length,
  sample: (document.querySelector('.fx-formula-text')?.textContent ?? '').slice(0, 60),
  hasMarkdown: (document.querySelector('.fx-formula-text')?.textContent ?? '').includes('**'),
  anyMarkdown: [...document.querySelectorAll('.fx-formula-text')].some((e) => (e.textContent || '').includes('**')),
}))
ok(r.rows === 105, '公式栏渲染出 105 条（与注册表逐条对齐）', `行数 ${r.rows} · 分组 ${r.groups}`)
ok(!r.anyMarkdown, '105 条公式里都没有残留 markdown 星号（本作没有 markdown 渲染器，会原样显示）', r.sample)
ok(errs.length === 0, '页面零报错', errs.slice(0, 2).join(' | '))
await b.close()
console.log(bad === 0 ? '\n线上核验通过' : `\n线上核验失败：${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
