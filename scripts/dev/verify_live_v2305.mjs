// 线上核验（v2.30.5 公式栏重排）—— 判据直接对应本轮两个反馈：
//   ① 「英文混杂」⇒ 105 行的公式/标签/注里**不许有任何英文字母**（反向对照：故意找也应找不到）
//   ② 「文字太多」⇒ 最长公式不超过 34 字
//   ③ 结构 ⇒ 每行都有规则标签（相加/相乘/分段…），且总数仍是 105
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2305'
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
const r = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.fx-formula-row')]
  const texts = rows.map((e) => e.textContent || '')
  const latin = texts.filter((s) => /[A-Za-z]/.test(s))
  const longest = rows.reduce((m, e) => Math.max(m, (e.querySelector('.fx-formula-text')?.textContent || '').length), 0)
  return {
    rows: rows.length,
    tagged: rows.filter((e) => (e.querySelector('.fx-formula-tag')?.textContent || '').trim()).length,
    latinCount: latin.length,
    latinSample: (latin[0] || '').replace(/\s+/g, ' ').slice(0, 60),
    longest,
    sample: (rows[0]?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
  }
})
ok(r.rows === 105 && r.tagged === 105, '105 行都在，且每行都有规则标签', `行 ${r.rows} · 带标签 ${r.tagged}`)
ok(r.latinCount === 0, '公式 / 标签 / 注里没有任何英文字母（本轮反馈之一）', r.latinCount ? `${r.latinCount} 行含英文：${r.latinSample}` : r.sample)
ok(r.longest <= 34, '最长的公式也不超过 34 字（本轮反馈之二：文字太多）', `最长 ${r.longest} 字`)
ok(errs.length === 0, '页面零报错', errs.slice(0, 2).join(' | '))
await b.close()
console.log(bad === 0 ? '\n线上核验通过' : `\n线上核验失败：${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
