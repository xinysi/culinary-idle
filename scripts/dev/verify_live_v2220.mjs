// 线上核验（v2.22.0）——只查「只在本版出现的可见特征」，不比对 chunk 哈希
// （Pages 用自带 Node 构建，产物哈希与本地不一致，比哈希会误判成「没部署」）。
//
// 本版四个独有特征：
//   ① 弹窗可 **Esc** 关闭（且与「点遮罩」同一条路径 —— 所以要能关、点遮罩也能关）
//   ② 竞技场状态键带 **存档位后缀**（`culinary-idle.arena.state.0`），且**不再写**无后缀的全局键
//   ③ 浅色下 `.player-gold` 用 **`--gold-strong`**（压深后的金，对比度达标）—— 本版改的
//   ④ 断网失败的图片**回网自愈**（不需要整页刷新）—— 本版新增
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2220'
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

let bad = 0
const ok = (cond, label, detail) => { if (!cond) bad++; console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`) }

// ① Esc 关弹窗（本版新增）
await page.locator('.top-nav-btn[title="设置"]').click()
await page.waitForTimeout(400)
const opened = await page.locator('.settings-modal').count()
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
const afterEsc = await page.locator('.settings-modal').count()
const backdropAfterEsc = await page.locator('.modal-backdrop').count()
ok(opened === 1 && afterEsc === 0 && backdropAfterEsc === 0, '弹窗可 Esc 关闭',
  `开=${opened} 按 Esc 后=${afterEsc} 遮罩残留=${backdropAfterEsc}`)
// 无弹窗时按 Esc 不炸
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
ok(await page.locator('.app-layout').count() === 1, '无弹窗时按 Esc 不报错')

// ② 竞技场状态键按存档位分键（本版新增）
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  pinia._s.get('ui').setView('arena')
})
await page.waitForTimeout(1200)
const arenaKeys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('arena.state')))
ok(arenaKeys.some((k) => /\.\d+$/.test(k)), '竞技场状态键带存档位后缀', JSON.stringify(arenaKeys))
ok(!arenaKeys.includes('culinary-idle.arena.state'), '不再写无后缀全局键（会跨档污染）', JSON.stringify(arenaKeys))

// ③ 浅色下 .player-gold 用压深后的金（本版改）
const gold = await page.evaluate(async () => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const p = pinia._s.get('player')
  p.settings.theme = 'light'
  p.settings.skin = 'classic'
  await new Promise((s) => setTimeout(s, 600))
  const el = document.querySelector('.player-gold')
  const cs = getComputedStyle(el)
  return { color: cs.color, token: getComputedStyle(document.documentElement).getPropertyValue('--gold-strong').trim() }
})
ok(gold.color === 'rgb(138, 98, 9)', '浅色 .player-gold 用 --gold-strong（本版改）',
  `computed=${gold.color} token=${gold.token}`)

// ④ 断网失败的图片回网自愈（本版新增）
await page.route('**/images/**', (r) => r.abort())
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  pinia._s.get('ui').setView('log')  // 图鉴：图最密
})
await page.waitForTimeout(1500)
const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length)
await page.unroute('**/images/**')
await page.evaluate(() => window.dispatchEvent(new Event('online')))
await page.waitForTimeout(2000)
const healed = await page.evaluate(() => {
  const imgs = [...document.images].filter((i) => i.dataset.r || i.src.includes('?r='))
  const gone = [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length
  const stillHidden = [...document.images].filter((i) => getComputedStyle(i).display === 'none' && i.naturalWidth > 0).length
  return { retried: imgs.length, stillBroken: gone, stillHidden }
})
ok(broken > 0 && healed.stillBroken === 0, '断网失败的图片回网自愈',
  `断网时挂掉 ${broken} 张 → 回网后重试 ${healed.retried} 张、仍坏 ${healed.stillBroken} 张、隐藏残留 ${healed.stillHidden}`)

console.log('页面错误：', errs.length ? errs.slice(0, 2) : '无')
try { await page.screenshot({ path: 'test-results/live-v2220.png' }) } catch { /* 目录不存在时忽略 */ }
await b.close()
console.log(bad === 0 ? '\n线上核验通过：v2.22.0 的四个可见特征全部到位' : `\n有 ${bad} 项不达标`)
process.exit(bad === 0 ? 0 : 1)
