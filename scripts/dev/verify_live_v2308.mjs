// 线上核验（v2.30.8）—— ① 页面清单在左栏里（不再占主区）② 主区整宽 ③ 难度系数不再显示为「减益」
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2308'
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
// 开一个大类
await page.evaluate(() => { [...document.querySelectorAll('.feature-cat')][0]?.click() })
await page.waitForTimeout(1000)

let bad = 0
const ok = (c, l, d) => { if (!c) bad++; console.log(`${c ? '✅' : '❌'} ${l}${d ? ' — ' + d : ''}`) }
const r = await page.evaluate(() => {
  const rail = document.querySelector('.sidebar-rail')
  const sidebar = document.querySelector('.app-sidebar')
  const main = document.querySelector('.main-scroll')
  const rect = (e) => { const x = e?.getBoundingClientRect(); return x ? { y: Math.round(x.y), w: Math.round(x.width) } : null }
  return {
    inSidebar: !!(rail && sidebar?.contains(rail)),
    inMain: !!(rail && main?.contains(rail)),
    railW: rect(rail)?.w ?? 0, railY: rect(rail)?.y ?? 0,
    mainW: rect(main)?.w ?? 0,
  }
})
ok(r.inSidebar && !r.inMain, '本类页面清单在**左栏**里、不再占主区（本次挪位）', `在左栏 ${r.inSidebar} · 在主区 ${r.inMain}`)
ok(r.railW > 200 && r.railY > 100, '清单铺满左栏宽度、位于大类按钮下方', `宽 ${r.railW} · y ${r.railY}`)
ok(r.mainW > 1200, '主内容区恢复整宽', `主区宽 ${r.mainW}`)

// 效果总览：难度系数那条不该再是「减益」
await page.evaluate(() => { document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value.ui.activeView = 'effects' })
await page.waitForTimeout(2200)
await page.evaluate(() => { [...document.querySelectorAll('.fx-rail-item')].find((e) => e.textContent.includes('其它玩法规则'))?.click() })
await page.waitForTimeout(700)
const fx = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.fx-pane .fx-row')].map((e) => e.textContent.replace(/\s+/g, ' ').trim())
  const d = rows.find((s) => s.includes('全局难度系数')) || ''
  return { row: d, isDebuff: /减益/.test(d), saysFinal: /最终值|已经是/.test(d) }
})
ok(!!fx.row, '右栏能看到「全局难度系数」那条', fx.row.slice(0, 60))
ok(!fx.isDebuff && fx.saysFinal, '它已改成**规则 + 数值口径**（说清「页面显示的就是最终值」），不再装成减益',
  fx.isDebuff ? '仍标着减益' : fx.row.slice(0, 70))
ok(errs.length === 0, '页面零报错', errs.slice(0, 2).join(' | '))
await b.close()
console.log(bad === 0 ? '\n线上核验通过' : `\n线上核验失败：${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
