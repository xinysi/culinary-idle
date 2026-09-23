// 线上核验（v2.21.2）：减半标签的位置 + **同排卡片高度是否齐整**（用户报的「排版乱七八糟」是可量化的）
// 量化判据：同一排卡片的高度必须一致（差 < 1px）、卡片头部高度必须一致（徽章折行会把它顶高）。
import { chromium } from 'playwright'
const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2122'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
await page.goto(URL_, { waitUntil: 'load' })
await page.waitForTimeout(1500)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(500)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(2200)

const out = await page.evaluate(async () => {
  const pin = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const p = pin._s.get('player'); const ui = pin._s.get('ui')
  const res = {}
  for (const [sid, tag] of [['foraging', '采集'], ['cooking', '制作'], ['pottery', '副业'], ['exploration', '探索']]) {
    p.setSkillState(sid, { level: 60, exp: 0, prestiges: 0 })
    p.activeSkill = sid; ui.activeView = 'skill'
    await new Promise((s) => setTimeout(s, 700))
    const cards = [...document.querySelectorAll('.gather-grid .gather-card')]
    const top = cards.slice(0, 5)
    const h = top.map((c) => +c.getBoundingClientRect().height.toFixed(1))
    const hh = top.map((c) => {
      const x = c.querySelector('.gather-card-head')
      return x ? +x.getBoundingClientRect().height.toFixed(1) : null
    })
    const chips = [...document.querySelectorAll('.xp-low-chip')]
    const inHead = chips.filter((c) => c.closest('.gather-card-head')).length
    res[tag] = {
      cards: cards.length,
      rowHeights: h,
      headHeights: hh,
      heightSpread: h.length ? +(Math.max(...h) - Math.min(...h)).toFixed(2) : null,
      headSpread: hh.length && hh[0] != null ? +(Math.max(...hh) - Math.min(...hh)).toFixed(2) : null,
      chips: chips.length,
      chipsInHead: inHead,
      chipParentOk: chips.length ? !!chips[0].closest('.gather-card-row') : null,
      ruleLine: document.querySelector('.low-target-hint')?.textContent.trim() ?? null,
    }
  }
  return res
})

let bad = 0
for (const [tag, r] of Object.entries(out)) {
  const uniform = r.heightSpread !== null && r.heightSpread < 1
  const headOk = r.headSpread === null || r.headSpread < 1
  const chipOk = r.chips > 0 && r.chipsInHead === 0 && r.chipParentOk === true
  if (!(uniform && headOk && chipOk)) bad++
  console.log(
    `${uniform && headOk && chipOk ? '✅' : '❌'} ${tag}：卡片数 ${r.cards} · 同排高度差 ${r.heightSpread}px · 头部高度差 ${r.headSpread}px · ` +
    `标签 ${r.chips} 个（在头部里的 ${r.chipsInHead} 个，在 .gather-card-row 里 = ${r.chipParentOk}）· 规则行「${r.ruleLine ?? '无'}」`
  )
}
console.log('页面错误：', errs.length ? errs.slice(0, 2) : '无')
await page.screenshot({ path: 'test-results/live-v2212-foraging.png' })
await b.close()
console.log(bad === 0 ? '\n线上排版核验通过：标签都在经验行、卡片高度齐整' : `\n有 ${bad} 页不达标`)
process.exit(bad === 0 ? 0 : 1)
