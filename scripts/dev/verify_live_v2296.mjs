// 线上核验（v2.29.6）—— 只查「只在本版出现的可见特征」，**不比对 chunk 哈希**
// （Pages 用自带 Node 构建，产物哈希与本地不一致；用 `?v=` 穿透 max-age=600）。
//
// 🔴 线上是**打包产物**：**不许 `import('/src/...')`**（生产里没有 /src）。只走 DOM 与 pinia
//    （pinia 可以取：`#app.__vue_app__.config.globalProperties.$pinia`；技能实例**不行**——
//     它不在 pinia 里，而 import() 在线上根本没有该路径）。
//
// 本版特征（v2.29.6 = 低目标衰减的参照系改为「玩家**能用的**最高档」）：
//   **副业（陶艺）是「平铺」渲染**（不分档、不折叠）⇒ 一页就能看到全部档位，
//   而它的表内最高档是 Lv120、Lv99 能用的是 **Lv91** —— 修前 `min(99,120)=99`
//   会把「已经做到自己能做的最高档」误判成低目标并打上「−50%」标记。
//
// 判据（**不依赖任何物品名**，只用「标记数」随等级的变化）：
//   ① C(91)  = Lv91 时的 `.xp-low-chip` 数（此时 Lv91 就是能用的最高档 ⇒ 必然满经验）
//   ② C(99)  = Lv99 时的同一数 —— **必须等于 C(91)**（修前会多 1：Lv91 那档被罚）
//   ③ C(86)  < C(91) —— 证明这个计数**确实随等级变**（否则 ①② 相等是恒真的假绿）
//   ④ 三次渲染的卡片总数一致（平铺模式与等级无关）
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2296'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push('console: ' + m.text()) })
await page.goto(URL_, { waitUntil: 'load' })
await page.waitForTimeout(1500)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(500)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(2200)

let bad = 0
const ok = (cond, label, detail) => { if (!cond) bad++; console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`) }

const atLevel = async (skill, level) => {
  await page.evaluate(({ skill, level }) => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const p = pinia._s.get('player')
    p.skills[skill].level = level
    p.activeSkill = skill
    pinia._s.get('ui').activeView = 'skill'
  }, { skill, level })
  await page.waitForTimeout(1200)
  return page.evaluate(() => ({
    cards: document.querySelectorAll('.gather-card').length,
    chips: document.querySelectorAll('.gather-card .xp-low-chip').length,
    chipTexts: [...document.querySelectorAll('.gather-card .xp-low-chip')].map((e) => e.textContent.trim()).slice(0, 3),
  }))
}

const c91 = await atLevel('pottery', 91)
const c99 = await atLevel('pottery', 99)
const c86 = await atLevel('pottery', 86)

ok(c91.cards > 8, '前置：副业页是平铺渲染（一页能看到全部档位）', `cards=${c91.cards} chips=${c91.chips} ${c91.chipTexts.join(',')}`)
ok(c99.cards === c91.cards && c86.cards === c91.cards, '④ 三个等级下卡片总数一致（平铺与等级无关）',
  `${c86.cards} / ${c91.cards} / ${c99.cards}`)
ok(c86.chips < c91.chips, '③ 对照：Lv86 的标记数**少于** Lv91（证明这个计数确实随等级变，① 不是恒真）',
  `Lv86=${c86.chips} < Lv91=${c91.chips}`)
ok(c99.chips === c91.chips, '① 陶艺 Lv99 与 Lv91 的标记数**相等** —— 能用的最高档（Lv91）不再被判低目标（修前会多 1）',
  `Lv99=${c99.chips} vs Lv91=${c91.chips}`)

ok(errs.length === 0, '页面零控制台错误', errs.slice(0, 3).join(' | '))

await b.close()
console.log(bad === 0 ? '\n线上核验通过' : `\n线上核验失败：${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
