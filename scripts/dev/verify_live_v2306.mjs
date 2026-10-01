// 线上核验（v2.30.6 效果总览补「系统与玩法规则」组）—— 判据：页面上真的能看到美食探索相关的行。
// 反向对照：上一版这一组完全不存在 ⇒ 找不到任何「系统与玩法规则」字样。
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2306'
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
await page.evaluate(() => { document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value.ui.activeView = 'effects' })
await page.waitForTimeout(2500)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('details')].find((x) => (x.textContent || '').includes('各效果的数值公式'))
  if (d) d.open = true
})
await page.waitForTimeout(1000)

let bad = 0
const ok = (c, l, d) => { if (!c) bad++; console.log(`${c ? '✅' : '❌'} ${l}${d ? ' — ' + d : ''}`) }
const r = await page.evaluate(() => {
  const body = document.body.innerText
  const rows = [...document.querySelectorAll('.fx-formula-row')].map((e) => e.textContent.replace(/\s+/g, ' ').trim())
  return {
    total: rows.length,
    hasGroup: body.includes('系统与玩法规则'),
    exploreRows: rows.filter((s) => s.includes('美食探索')).length,
    difficulty: rows.some((s) => s.includes('全局难度系数')),
    tower: rows.some((s) => s.includes('挑战塔')),
    realm: rows.some((s) => s.includes('食神秘境')),
    enemy: rows.some((s) => s.includes('敌人血量分档')),
    sample: rows.find((s) => s.includes('美食探索')) || '(没有美食探索行)',
  }
})
ok(r.hasGroup, '页面上出现了「系统与玩法规则」这一组（上一版完全没有）')
ok(r.exploreRows >= 3, '美食探索相关的行都在（成功率 / 战利品 / 专属装备）', `共 ${r.exploreRows} 条：${r.sample.slice(0, 60)}`)
ok(r.difficulty && r.tower && r.realm && r.enemy, '难度系数 / 挑战塔 / 秘境 / 敌人分档也都补上了',
  `难度 ${r.difficulty} · 塔 ${r.tower} · 秘境 ${r.realm} · 敌人 ${r.enemy}`)
ok(r.total === 112, '公式行总数 112（105 + 本次补的 7 条）', `实际 ${r.total}`)
ok(errs.length === 0, '页面零报错', errs.slice(0, 2).join(' | '))
await b.close()
console.log(bad === 0 ? '\n线上核验通过' : `\n线上核验失败：${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
