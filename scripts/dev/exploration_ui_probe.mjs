// 探针：美食探索页的展示是否与其它技能一致（2026-09-27 用户①）+ 成功率三来源是否都显示
// 用法：先 npm run dev，再 node scripts/dev/exploration_ui_probe.mjs
import { chromium } from 'playwright'
const b = await chromium.launch()
const errs = []
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()) })
await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(700)
await p.locator('.splash-start-btn').click()
await p.waitForTimeout(400)
await p.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await p.waitForTimeout(1000)
// 进「美食探索」（辅助类技能，左栏技能页签里）
const jumped = await p.evaluate(() => {
  const hit = [...document.querySelectorAll('.skill-item, .side-item')].find((e) => e.textContent.includes('美食探索'))
  hit?.click()
  return hit ? hit.textContent.replace(/\s+/g, ' ').trim().slice(0, 24) : null
})
await p.waitForTimeout(1400)
const r = await p.evaluate(() => {
  const eras = [...document.querySelectorAll('.era-tab')].map((e) => e.textContent.replace(/\s+/g, ' ').trim())
  const cards = [...document.querySelectorAll('.gather-card')]
  const first = cards[0]
  const rows = first ? [...first.querySelectorAll('.gather-card-row')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()) : []
  return {
    eras: eras.slice(0, 6),
    eraHead: document.querySelector('.era-head')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    poolBar: !!document.querySelector('.mastery-pool, .pool-bar, [class*=pool]'),
    cardCount: cards.length,
    cardRows: rows,
    hasMasteryBar: !!first?.querySelector('.mastery-bar'),
    lootRows: first ? [...first.querySelectorAll('.loot-row')].map((x) => x.textContent.trim()).slice(0, 4) : [],
    note: document.querySelector('.special-note')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
  }
})
console.log('点到的技能:', jumped)
console.log(JSON.stringify(r, null, 1))
console.log('页面错误:', errs.filter((e) => !/favicon|404/.test(e)).slice(0, 3))
await b.close()
