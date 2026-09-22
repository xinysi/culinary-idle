// 排版截图：低目标减半标签改位置后，四个列表页在 1440 / 390 两档宽度下的卡片是否齐整
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5173'
const b = await chromium.launch()
const shots = []
for (const [w, h, tag] of [[1440, 900, 'wide'], [390, 844, 'narrow']]) {
  const page = await b.newPage({ viewport: { width: w, height: h } })
  await page.goto(BASE)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(1200)
  await page.locator('.splash-start-btn').click()
  await page.waitForTimeout(400)
  await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
  await page.waitForTimeout(1500)
  // 抬高等级 ⇒ 出现低目标（徽章应显示）
  await page.evaluate(async () => {
    const pin = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const p = pin._s.get('player')
    for (const id of ['foraging', 'cooking', 'pottery', 'exploration', 'farming']) {
      p.setSkillState(id, { level: 60, exp: 0, prestiges: 0 })
    }
    for (const id of ['potato', 'wheatSeed']) p.inventory[id] = 999
  })
  for (const [skill, name] of [['foraging', '采集-采摘'], ['cooking', '制作-烹饪'], ['pottery', '副业-陶艺'], ['exploration', '探索'], ['farming', '农耕']]) {
    await page.evaluate(async (sid) => {
      const pin = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      const p = pin._s.get('player'); const ui = pin._s.get('ui')
      p.activeSkill = sid
      ui.activeView = sid === 'farming' ? 'skill' : 'skill'
      await new Promise((s) => setTimeout(s, 300))
    }, skill)
    await page.waitForTimeout(1200)
    if (skill === 'farming') {
      // 农耕的作物在「选种子」弹窗里
      await page.evaluate(async () => {
        const btns = [...document.querySelectorAll('button')]
        const b2 = btns.find((x) => /种植|选种子|种子/.test(x.textContent))
        if (b2) b2.click()
      })
      await page.waitForTimeout(900)
    }
    const f = `test-results/shot-${tag}-${skill}.png`
    await page.screenshot({ path: f, fullPage: false })
    shots.push(f)
    if (skill === 'farming') {
      await page.evaluate(async () => {
        const x = document.querySelector('.modal-backdrop .btn')
        if (x) x.click()
      })
      await page.waitForTimeout(400)
    }
  }
  await page.close()
}
await b.close()
console.log(shots.join('\n'))
