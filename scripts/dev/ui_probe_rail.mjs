import { chromium } from 'playwright'
const b = await chromium.launch()
const errs = []
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()) })
await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(600)
await p.locator('.splash-start-btn').click()
await p.waitForTimeout(400)
await p.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await p.waitForTimeout(900)
await p.locator('.sidebar-tab', { hasText: '功能' }).click()
await p.waitForTimeout(200)
const showAll = p.locator('.feature-hidden button', { hasText: '显示全部' })
if (await showAll.count()) { await showAll.click(); await p.waitForTimeout(250) }

const head = () => p.evaluate(() => document.querySelector('.main-scroll h2, .main-scroll h3')?.textContent?.trim()?.slice(0, 24) ?? null)
const railOn = () => p.locator('.main-scroll > .feature-rail').count()

await p.locator('.feature-cat', { hasText: '采买与转化' }).first().click()
await p.waitForTimeout(450)
console.log('① 点大类 → 落地页:', await head(), '| 导航在:', await railOn())
await p.locator('.main-scroll > .feature-rail .fr-item', { hasText: '炼金' }).click()
await p.waitForTimeout(450)
console.log('② 点导航里的炼金 → 内容:', await head(), '| 导航仍在:', await railOn(),
  '| 高亮项:', await p.locator('.main-scroll > .feature-rail .fr-item.on').textContent())
// 切到技能页
await p.locator('.sidebar-tab', { hasText: '技能' }).click()
await p.locator('.skill-item', { hasText: '采摘' }).first().click()
await p.waitForTimeout(450)
console.log('③ 切到技能页 → 导航:', await railOn())
// 再开一次，点第二次收起
await p.locator('.sidebar-tab', { hasText: '功能' }).click()
await p.locator('.feature-cat', { hasText: '采买与转化' }).first().click()
await p.waitForTimeout(350)
const on1 = await railOn()
await p.locator('.feature-cat', { hasText: '采买与转化' }).first().click()
await p.waitForTimeout(300)
console.log('④ 再点同一大类（开关语义）:', on1, '→', await railOn())
// 换另一个大类：导航仍在、内容跟着换
await p.locator('.feature-cat', { hasText: '研究与收集' }).first().click()
await p.waitForTimeout(450)
console.log('⑤ 换大类「研究与收集」→ 内容:', await head(), '| 条目数:', await p.locator('.main-scroll > .feature-rail .fr-item').count())
// 山海食经（整屏画布页）不该挂导航
await p.locator('.main-scroll > .feature-rail .fr-item', { hasText: '山海食经' }).click()
await p.waitForTimeout(600)
console.log('⑥ 进山海食经 → 导航:', await railOn())
// 窄屏
await p.setViewportSize({ width: 390, height: 780 })
await p.waitForTimeout(500)
console.log('⑦ 390px 窄屏 → 大类按钮:', await p.locator('.feature-cat').count(), '| 手风琴:', await p.locator('.feature-group-label').count(), '| 导航栏:', await railOn())
console.log('页面错误:', errs.filter((e) => !/favicon|404/.test(e)).slice(0, 4))
await b.close()
