// 小游戏逐局烟雾守卫（2026-09-25 立）——补「玩法内部」这块盲区：
// e2e-interact 只验证「点得动不报错」，不会真的开始一局让游戏循环跑起来。
// 本守卫把 27 款游戏逐款：进大厅 → 选中 → 默认模式开局（有「开始/开局」按钮就点）→ 跑约 2 秒，
// 抓运行期（tick/动画/结算挂载）的 console.error / pageerror。
// ⚠️ 刻意不做「玩到输/玩到赢」：27 款的胜利条件各不相同，自动化对局又脆又难维护；
//    结算路径已由静态审查覆盖（每款 die()/settle() 都进结果面板、无自动重开）。
import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'
const GAME_NAMES = ['火候炉', '讲堂', '2048', '大胃王', '拼图', '连连看', '翻牌', '贪吃蛇', '吃豆人', '消消乐', '笨鸟先飞', '凑凑消', '水果合成', '果了个果', '垂钓渔翁', '切菜大师', '打地鼠', '摆盘', '接汤', '传菜', '方块', '扫雷', '滑冰', '猜菜名', '调味表', '上菜顺序', '汤圆冰壶']

async function enterGame(page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await page.locator('.splash-start-btn').click()
  await page.waitForTimeout(300)
  await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
  await page.waitForTimeout(1200)
}
const dismissModal = (page) => page.evaluate(() => {
  for (const b of document.querySelectorAll('.modal-backdrop')) {
    b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }
})

test('小游戏逐局烟雾：27 款进入+开局+运行无报错', async ({ page }) => {
  test.setTimeout(300000)
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text().slice(0, 140)) })
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message))
  await enterGame(page)
  await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.pinia ?? document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    pinia._s.get('ui').setView('minigames')
  })
  await page.waitForTimeout(800)

  const problems = []
  let done = 0
  // ⚠️ 用页内 el.click() 切换：上一局结束的「结果遮罩」（.xx-mask）会拦截 Playwright 的真点击，
  //    但组件切走时即卸载 ⇒ 程序化点击选中入口即可，无需先去关每一家的结算面板。
  const pickGame = (page, name) => page.evaluate((n) => {
    const el = [...document.querySelectorAll('.mg-pager .mg-entry')].find((b) => (b.textContent || '').trim() === n)
    if (el) { el.click(); return true }
    return false
  }, name)
  const turnPage = (page) => page.evaluate(() => {
    const btns = [...document.querySelectorAll('.mg-page-btn')]
    const b = btns[btns.length - 1]
    if (b && !b.disabled) b.click()
  })
  for (let pageIndex = 0; pageIndex < 4 && done < GAME_NAMES.length; pageIndex++) {
    const names = await page.evaluate(() => [...document.querySelectorAll('.mg-pager .mg-entry')].map((b) => b.textContent.trim()))
    for (const name of names) {
      const before = errs.length
      await dismissModal(page)
      await pickGame(page, name)
      await page.waitForTimeout(700)
      // 有「开始/开局」按钮就点一次（走真实开局路径）
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('.main-scroll button')].find((b) => {
          const t = (b.textContent || '').trim()
          return /开始|开局|GO/.test(t) && t.length <= 8 && b.offsetParent
        })
        if (btn) btn.click()
      })
      await page.waitForTimeout(1600)
      const newErrs = errs.slice(before)
      if (newErrs.length) problems.push(`${name}: ${newErrs[0]}`)
      done++
      // 回大厅默认（下一款从干净的 hub 状态开始）
      await dismissModal(page)
    }
    turnPage(page)
    await page.waitForTimeout(400)
  }
  console.log(`MINIGAME SMOKE: 覆盖 ${done} 款 · 报错 ${problems.length}`)
  if (problems.length) console.log(problems.join('\n').slice(0, 2000))
  expect(done, '应覆盖全部 27 款').toBe(GAME_NAMES.length)
  expect(problems, problems.join('\n')).toEqual([])
})
