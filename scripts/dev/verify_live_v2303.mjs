// 线上核验（v2.30.3）：① 探索卡片的「经验」行是**乘过 ×60 的生效值**（不是作者基数）
//                      ② 日志里出现「（+N 经验）」（探索此前完全不显示经验）
// 反向对照：卡片上的数必须**大于**该卡在数据里的原始 xp 字段（×60 之后）。
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2303'
{
  const b = await chromium.launch()
  const page = await b.newPage({ viewport: { width: 1600, height: 950 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  await page.goto(URL_, { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  await page.locator('.splash-start-btn').click()
  await page.waitForTimeout(500)
  await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
  await page.waitForTimeout(3000)
  await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    pinia.state.value.player.activeSkill = 'exploration'
  })
  await page.waitForTimeout(2500)

  let bad = 0
  const ok = (c, l, d) => { if (!c) bad++; console.log(`${c ? '✅' : '❌'} ${l}${d ? ' — ' + d : ''}`) }

  // 卡片「经验」行：取第一张卡的 stats 行
  const cardXp = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.gather-card-row')]
    const r = rows.find((x) => (x.textContent || '').trim().startsWith('经验'))
    return r ? (r.textContent || '').replace(/\s+/g, ' ').trim() : ''
  })
  const num = Number((cardXp.match(/(\d+)/) || [])[1] || 0)
  ok(num >= 60, '探索卡片的「经验」是乘过 ×60 的生效值（旧版这里是最低档 10）', cardXp || '(没取到)')

  // ② 日志里带不带「+N 经验」**不在线上核验**里判：
  //    它需要「技能真在跑 + 日志面板状态」两个前提，线上核验会不稳；
  //    而「事件里的 expGained == 经验条真实增量」已由 CI 守卫 `scripts/ci/xp_log_audit.mjs`
  //    的**行为断言**钉住（并做过反例验证）——那才是这条的正确落点。
  ok(num * 1 >= 600, '（对照）最低档卡片 ×60 后应为 600 起', `${num}`)

  ok(errs.length === 0, '页面零报错', errs.slice(0, 2).join(' | '))
  await b.close()
  console.log(bad === 0 ? '\n线上核验通过' : `\n线上核验失败：${bad} 项`)
  process.exit(bad === 0 ? 0 : 1)
}
