// 线上核验（v2.21.0）：用**只在本版出现的可见特征**验，不比对 chunk 哈希
// （CI 的 checkout 是 LF、本地是 CRLF ⇒ 哈希必然不同，比对哈希会假失败）。
// ① 低目标经验减半：技能页标题行常驻「低目标经验 ×0.5」+ 把等级抬到 60 后低档目标出现「经验减半」徽章
// ② 制作页精通池的补给按钮不再是「先选一个配方」（模板标识符修复的行为证据）
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2110'
const b = await chromium.launch()
const page = await b.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
await page.goto(URL_, { waitUntil: 'load' })
await page.waitForTimeout(1500)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(500)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(2500)

const r = await page.evaluate(async () => {
  const pin = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const p = pin._s.get('player')
  const ui = pin._s.get('ui')
  const out = {}
  // ① 采集页：标题行规则 + 抬高等级后的低目标徽章
  p.setSkillState('foraging', { level: 60, exp: 0, prestiges: 0 })
  ui.activeView = 'skill'
  ui.activeSkill = 'foraging'
  await new Promise((s) => setTimeout(s, 900))
  out.hint = [...document.querySelectorAll('.low-target-hint')].map((e) => e.textContent.trim())
  out.lowBadges = [...document.querySelectorAll('.badge-warn')].map((e) => e.textContent.trim()).filter((t) => t.includes('经验减半'))
  out.badgeCount = out.lowBadges.length
  // ② 制作页：**SkillView 读的是 `player.activeSkill`**（不是 ui.activeSkill —— 用错字段就还停在原页面上，
  //    读到的按钮是采集页的「先选一个目标」，于是断言 `/先选一个配方/` 不成立 ⇒ **假绿**，第一版就这么错了）。
  //    这里给队列塞一个（暂停的）队头 ⇒ 精通池的补给目标应解析成该配方名。
  p.activeSkill = 'cooking'
  ui.activeView = 'skill'
  p.craftQueues = { cooking: [{ recipeId: 'roastPotato', qty: 1, paused: true }] }
  await new Promise((s) => setTimeout(s, 1200))
  out.prodPage = !!document.querySelector('.recipe-grid')
  out.poolButtons = [...document.querySelectorAll('.mastery-pool button')].map((x) => ({ text: x.textContent.trim(), disabled: x.disabled }))
  out.poolText = out.poolButtons.map((x) => x.text).join(' | ')
  return out
})

console.log('线上 URL:', URL_)
console.log('① 标题行规则文案：', JSON.stringify(r.hint))
console.log('① 低目标徽章数：', r.badgeCount, JSON.stringify(r.lowBadges.slice(0, 4)))
console.log('② 在制作页：', r.prodPage, '| 精通池按钮：', JSON.stringify(r.poolButtons))
console.log('页面错误：', errs.length ? errs.slice(0, 3) : '无')
const ok1 = r.hint.some((t) => t.includes('低目标经验')) && r.badgeCount > 0
// 必须**确认在制作页**再判按钮文案（否则又是假绿）
const ok2 = r.prodPage === true && !!r.poolText && !/先选一个配方|先选一个目标/.test(r.poolText)
console.log(`\n${ok1 ? '✅' : '❌'} 低目标经验减半在线上可见（规则行 + 徽章）`)
console.log(`${ok2 ? '✅' : '❌'} 制作页精通池按钮已不再是「先选一个配方」（模板标识符修复生效）`)
await b.close()
process.exit(ok1 && ok2 ? 0 : 1)
