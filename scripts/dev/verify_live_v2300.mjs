// 线上核验（v2.30.0 场景背景）—— DOM 级：启动页真的挂了场景图；进游戏后换页时 `.scene-bg-layer` 的 URL 真的变了。
// 判据不依赖具体页面名（脚本自己挑两个页面），并带反向对照（两张页面的 URL 必须不同）。
import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2300'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1600, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push('console: ' + m.text()) })
await page.goto(URL_, { waitUntil: 'load' })
await page.waitForTimeout(2500)

let bad = 0
const ok = (c, l, d) => { if (!c) bad++; console.log(`${c ? '✅' : '❌'} ${l}${d ? ' — ' + d : ''}`) }

// ① 启动页：`.splash-bg` 的行内 background-image 指向场景图，且那张图线上可下
const splashBg = await page.evaluate(() => getComputedStyle(document.querySelector('.splash-bg')).backgroundImage)
ok(/images\/bg\/.+\.webp/.test(splashBg), '启动页挂了场景背景图', splashBg.slice(0, 90))

const grab = async (rel) => {
  const r = await page.request.get(new URL(rel, URL_).href)
  const buf = await r.body()
  return { status: r.status(), mb: createHash('md5').update(buf).digest('hex'), len: buf.length }
}
const localMd5 = (rel) => createHash('md5').update(readFileSync(join(ROOT, 'public', rel))).digest('hex')
const s1 = await grab('images/bg/启动页.webp')
ok(s1.status === 200 && s1.mb === localMd5('images/bg/启动页.webp'), '线上启动页背景 == 本地（证明新背景真的上线了）', `http ${s1.status} ${Math.round(s1.len / 1024)}KB md5 ${s1.mb.slice(0, 8)}`)

// ② 进游戏，切两页，断言场景层 URL 真的跟着换
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(500)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(3000)
const frontUrl = () => page.evaluate(() => {
  const el = document.querySelector('.scene-bg-layer.on')
  return el ? getComputedStyle(el).backgroundImage : ''
})
// ⚠️ 生产构建里 Pinia 的私有字段 `_s`（storeId → store 的映射）会被压缩改名 ⇒ 线上核验**不能**用它。
//    `$pinia.state.value` 的键是 `defineStore('id')` 的字符串 id（压缩不改字符串）⇒ 改它最稳。
// ⚠️ 判据**不能切 view**：视图是 `defineAsyncComponent` 懒加载的，Pages 刚部署时新 chunk 可能还没传播完
//    ⇒ 会切到一张空页（AGENTS 记过的「chunk 404 后一直空白」），把「背景没换」误判成缺陷。
//    改切**激活技能**：同属 `skill` 视图、不触发任何懒加载，纯测背景逻辑。
const setSkill = (s) => page.evaluate((id) => {
  document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value.player.activeSkill = id
}, s)
const setTheme = (t) => page.evaluate((th) => {
  document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value.player.settings.theme = th
}, t)

const a = await frontUrl()
ok(/images\/bg\/.+\.webp/.test(a), '进游戏后有生效的场景背景层', a.slice(0, 90))
await setSkill('cooking')
await page.waitForTimeout(3000)
const c = await frontUrl()
ok(/images\/bg\/.+\.webp/.test(c) && c !== a, '切换技能后背景真的换了（反向对照：两页 URL 不同）',
  `${(a.match(/\/([^/]+)\.webp/) || [])[1] || '?'} → ${(c.match(/\/([^/]+)\.webp/) || [])[1] || '?'}`)

// ③ 深色：切主题后应换成 `_night` 版
await setTheme('dark')
await page.waitForTimeout(3000)
const d = await frontUrl()
ok(/_night\.webp/.test(d) && d !== c, '深色主题换成夜景版（反向对照：与白天不同）', (d.match(/\/([^/]+)\.webp/) || [])[1] || '?')

ok(errs.length === 0, '页面零控制台错误', errs.slice(0, 3).join(' | '))
await b.close()
console.log(bad === 0 ? '\n线上核验通过' : `\n线上核验失败：${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
