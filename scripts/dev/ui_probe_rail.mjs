// 探针：功能页大类工作区 + 仅图标折叠 + 觅珍模拟按钮配色（2026-09-27 用户两条反馈）
// 用法：先 npm run dev，再 node scripts/dev/ui_probe_rail.mjs
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
await p.waitForTimeout(900)
await p.locator('.sidebar-tab', { hasText: '功能' }).click()
await p.waitForTimeout(200)
const showAll = p.locator('.feature-hidden button', { hasText: '显示全部' })
if (await showAll.count()) { await showAll.click(); await p.waitForTimeout(250) }

const head = () => p.evaluate(() => document.querySelector('.main-scroll h2, .main-scroll h3')?.textContent?.trim()?.slice(0, 24) ?? null)
const railOn = () => p.locator('.main-scroll > .feature-rail').count()
const railW = () => p.evaluate(() => Math.round(document.querySelector('.main-scroll > .feature-rail')?.getBoundingClientRect().width ?? 0))

await p.locator('.feature-cat', { hasText: '采买与转化' }).first().click()
await p.waitForTimeout(450)
console.log('① 点大类 → 落地页:', await head(), '| 导航在:', await railOn(), '| 宽:', await railW())
await p.locator('.main-scroll > .feature-rail .fr-item', { hasText: '炼金' }).click()
await p.waitForTimeout(450)
console.log('② 点导航里的炼金 → 内容:', await head(), '| 导航仍在:', await railOn(),
  '| 高亮项:', await p.locator('.main-scroll > .feature-rail .fr-item.on').textContent())
await p.locator('.sidebar-tab', { hasText: '技能' }).click()
await p.locator('.skill-item', { hasText: '采摘' }).first().click()
await p.waitForTimeout(450)
console.log('③ 切到技能页 → 导航:', await railOn())
await p.locator('.sidebar-tab', { hasText: '功能' }).click()
await p.locator('.feature-cat', { hasText: '采买与转化' }).first().click()
await p.waitForTimeout(350)
const on1 = await railOn()
await p.locator('.feature-cat', { hasText: '采买与转化' }).first().click()
await p.waitForTimeout(300)
console.log('④ 再点同一大类（开关语义）:', on1, '→', await railOn())
await p.locator('.feature-cat', { hasText: '研究与收集' }).first().click()
await p.waitForTimeout(450)
console.log('⑤ 换大类「研究与收集」→ 内容:', await head(), '| 条目数:', await p.locator('.main-scroll > .feature-rail .fr-item').count())
await p.locator('.main-scroll > .feature-rail .fr-item', { hasText: '山海食经' }).click()
await p.waitForTimeout(600)
console.log('⑥ 进山海食经 → 导航:', await railOn())

// ⑦ 仅图标折叠（用户新要求）
await p.locator('.sidebar-tab', { hasText: '功能' }).click()
await p.locator('.feature-cat', { hasText: '研究与收集' }).first().click()
await p.waitForTimeout(400)
const before = await railW()
await p.locator('.main-scroll > .feature-rail .fr-fold').click()
await p.waitForTimeout(400)
const after = await railW()
const labelShown = await p.evaluate(() => {
  const n = document.querySelector('.main-scroll > .feature-rail .fr-name')
  return n ? getComputedStyle(n).display : 'no-name-el'
})
const titleAttr = await p.evaluate(() => document.querySelector('.main-scroll > .feature-rail .fr-item')?.getAttribute('title'))
console.log('⑦ 折叠为仅图标：宽', before, '→', after, '| 名字 display:', labelShown, '| 悬浮提示:', titleAttr)
console.log('   ↳ 持久化 settings.railIcons =', await p.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  return pinia._s.get('player').settings.railIcons
}))
await p.locator('.main-scroll > .feature-rail .fr-fold').click()
await p.waitForTimeout(350)
console.log('⑧ 再点一次展开：宽', await railW(), '| railIcons =', await p.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  return pinia._s.get('player').settings.railIcons
}))

// ⑨ 觅珍模拟按钮配色（跟池主题、不再红）
await p.locator('.top-nav-btn', { hasText: '觅珍' }).first().click()
await p.waitForTimeout(1200)
const sim = await p.evaluate(() => {
  const btn = document.querySelector('.gacha-sim .sim-btn')
  const big = document.querySelector('.gacha-btn-sub')
  const cs = (el) => { const s = getComputedStyle(el); return { bg: s.backgroundColor, img: s.backgroundImage.slice(0, 80), color: s.color } }
  const pools = [...document.querySelectorAll('.pool-mini')].map((e) => e.className.replace('pool-mini ', ''))
  return { chosen: [...document.querySelectorAll('.pool-mini.active')].map((e) => e.className), sim: cs(btn), big: cs(big), pools }
})
console.log('⑨ 觅珍：当前池', sim.chosen, '\n   模拟按钮', sim.sim, '\n   单抽大按钮', sim.big)
// 换池：食物池的模拟按钮也该跟着变橙
await p.locator('.pool-mini.pool-food').first().click()
await p.waitForTimeout(800)
console.log('⑩ 切到美食池（pool-food）→ 模拟按钮', await p.evaluate(() => {
  const s = getComputedStyle(document.querySelector('.gacha-sim .sim-btn'))
  return { bg: s.backgroundColor, img: s.backgroundImage.slice(0, 80) }
}))
console.log('页面错误:', errs.filter((e) => !/favicon|404/.test(e)).slice(0, 4))
await b.close()
