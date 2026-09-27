// 线上核验（v2.26.0）—— **DOM/资源级**（生产没有 /src 路径，别 import）。
// 本版独有的可见特征：
//   ① 米其林页面星图标是 **5 颗**（改前写死 3 颗）+ 阶梯表里出现「四星/五星」
//   ② 顶栏「指南」按钮在**技能页**也出现（改前技能页只有标题旁的内嵌按钮）
//   ③ 图鉴页只有三个平级页签（图鉴 / 配方手册 / 转生），且**没有**那四个「去别的页 ↗」按钮
//   ④ 左栏分组：今日里有「节庆 / 系统日志」、采买与转化里有「交易所 / 供应商」、**没有**「成长与信仰」组
//   ⑤ 对决页奥义栏含「品鉴点」且点一行能真的开关（🟢 出现/消失）
//   ⑥ 零 console / page 错误
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2260'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push('console: ' + m.text()) })
await page.goto(URL_, { waitUntil: 'load' })
await page.waitForTimeout(1600)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(500)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(2200)

let bad = 0
const ok = (cond, label, detail) => { if (!cond) bad++; console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`) }
const setView = (v) => page.evaluate((vv) => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui').setView(vv), v)

// ④ 左栏分组（侧栏文本）—— 两个坑都在首版踩过：
//    ① 左栏默认停在**技能**页签，功能网格是 `v-show` 隐藏的（`innerText` 读不到 display:none 的内容）⇒ 先切「🧩功能」；
//    ② 功能分组默认**折叠**（`v-if="groupOpen(g)"`）⇒ 再点「全部展开」。
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.sidebar .btn, .sidebar button')].find((b) => /功能/.test(b.innerText) && b.innerText.length <= 6)
  tab?.click()
})
await page.waitForTimeout(400)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.feature-hidden .btn')].find((b) => /全部展开/.test(b.innerText))
  btn?.click()
})
await page.waitForTimeout(600)
const side = await page.evaluate(() => (document.querySelector('.sidebar') ?? document.body).innerText)
ok(/今日/.test(side) && /节庆/.test(side) && /系统日志/.test(side), '左栏「今日」组里有 节庆 / 系统日志（本版搬过来的）', `侧栏文本 ${side.length} 字`)
ok(/采买与转化/.test(side) && /供应商/.test(side), '左栏「采买与转化」组里有 供应商（本版搬过来的）')
ok(!/成长与信仰/.test(side), '左栏不再有「成长与信仰」组（本版整组撤销）')

// ③ 图鉴页只有三个页签、且没有那四个外链按钮
await setView('log')
await page.waitForTimeout(800)
const log = await page.evaluate(() => {
  const first = document.querySelector('.region-tabs') // ⚠️ 只看**第一排**页签：第二排是图鉴的子页签（物品/首领/赛季）
  const tabs = [...(first?.querySelectorAll('.btn') ?? [])].map((b) => b.innerText.replace(/\s+/g, ' ').trim())
  return { tabs, text: (document.querySelector('.main-scroll') ?? document.body).innerText }
})
ok(log.tabs.length === 3 && /图鉴/.test(log.tabs[0]) && /配方手册/.test(log.tabs[1]) && /转生/.test(log.tabs[2]),
  '图鉴页头三个平级页签 = 图鉴 / 配方手册 / 转生（转生已提为大类）', JSON.stringify(log.tabs))
ok(!/任务中心 ↗|成就与称号 ↗|故事与传闻 ↗|卡牌对战 ↗/.test(log.text), '图鉴页不再有那四个「去别的页 ↗」按钮')

// ① 米其林五星（页面要餐厅 Lv3 才渲染，新档是 Lv1 ⇒ 先升级）
await page.evaluate(() => {
  const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
  p.restaurant.level = 5
})
await setView('michelin')
await page.waitForTimeout(900)
const mic = await page.evaluate(() => {
  const stars = document.querySelectorAll('.michelin-stars span').length
  const txt = (document.querySelector('.main-scroll') ?? document.body).innerText
  return { stars, four: /四星/.test(txt), five: /五星/.test(txt) }
})
ok(mic.stars === 5, '米其林页面星图标 5 颗（改前写死 3 颗）', `实得 ${mic.stars} 颗`)
ok(mic.four && mic.five, '阶梯表里出现「四星 / 五星」（本版新增档位）')

// ② 技能页顶栏指南按钮
await setView('skill')
await page.waitForTimeout(700)
const guide = await page.evaluate(() => {
  const btn = document.querySelector('.top-nav-guide')
  return { has: !!btn, text: btn?.innerText?.trim() ?? '', inline: document.querySelectorAll('.skill-guide-btn').length }
})
ok(guide.has && /指南/.test(guide.text), '技能页顶栏出现「指南」按钮（本版统一位置）', `文字「${guide.text}」`)
ok(guide.inline === 0, '技能页不再有内嵌的 .skill-guide-btn（同一个东西只留一处）')

// ⑤ 奥义栏品鉴点 + 可点击开关
await page.evaluate(() => {
  const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
  p.tastePoints = 5000
  p.setActiveSkill('knife')
})
await page.waitForTimeout(900)
const aoji = await page.evaluate(async () => {
  const box = document.querySelector('.combo-aoji')
  if (!box) return null
  const head = box.querySelector('h3')?.innerText?.replace(/\s+/g, ' ').trim()
  const rows = [...box.querySelectorAll('.aoji-row')]
  const off = rows.find((r) => !r.classList.contains('on'))
  const before = off?.innerText?.trim()
  off?.click()
  await new Promise((s) => setTimeout(s, 200))
  const afterOn = off?.classList.contains('on')
  off?.click()
  await new Promise((s) => setTimeout(s, 200))
  return { head, n: rows.length, before, afterOn, afterOff: off?.classList.contains('on') }
})
ok(!!aoji && /品鉴点/.test(aoji.head), '奥义栏表头显示当前品鉴点（本版新增）', `「${aoji?.head ?? '未找到'}」`)
ok(!!aoji && aoji.afterOn === true && aoji.afterOff === false, '点一行能真的开启/关闭奥义（本版新增：此前只读）', `「${aoji?.before ?? ''}」`)

console.log('页面错误：', errs.length ? errs.slice(0, 3) : '无')
ok(errs.length === 0, '零 console / page 错误')
try { await page.screenshot({ path: 'scripts/sim/out/live-v2260.png' }) } catch { /* 目录不存在时忽略 */ }
await b.close()
console.log(bad === 0 ? '\n线上核验通过：v2.26.0 的可见特征全部到位' : `\n有 ${bad} 项不达标`)
process.exit(bad === 0 ? 0 : 1)
