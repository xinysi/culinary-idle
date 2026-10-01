// 线上核验（v2.30.2 探索卡片改名）—— DOM 级：卡片标题应是新名，且**旧名必须消失**（反向对照）。
// ⚠️ 判据不切 view（懒加载 chunk 可能还没传播完）：直接读侧栏「美食探索」技能页的卡片？不行 —— 它是 view。
//    这里用 `skill` 视图内的技能切换（不触发懒加载），再读卡片标题。
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2302'
const NEW_FIRST = ['辣椒摊', '土豆铺', '梨摊', '麋鹿铺']
const OLD_FIRST = ['家常小馆', '根茎铺', '果摊', '肉铺']

const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1600, height: 950 } })
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push(m.text()) })
await page.goto(URL_, { waitUntil: 'load' })
await page.waitForTimeout(2500)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(500)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(3000)
await page.evaluate(() => {
  const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  p.state.value.player.activeSkill = 'exploration'
})
await page.waitForTimeout(2500)

let bad = 0
const ok = (c, l, d) => { if (!c) bad++; console.log(`${c ? '✅' : '❌'} ${l}${d ? ' — ' + d : ''}`) }

const titles = await page.evaluate(() => [...document.querySelectorAll('.gather-card-head, .gather-card')].slice(0, 40).map((e) => (e.textContent || '').slice(0, 60)))
const blob = titles.join('\n')
const hitNew = NEW_FIRST.filter((n) => blob.includes(n))
const hitOld = OLD_FIRST.filter((n) => blob.includes(n))
ok(hitNew.length >= 3, '前几张卡片用的是新名（按掉落取名）', `命中 ${hitNew.join('/')}（共 ${hitNew.length}/4）`)
ok(hitOld.length === 0, '旧名已彻底消失（反向对照：还有旧名说明改名没生效）', hitOld.length ? `残留 ${hitOld.join('/')}` : '无残留')
// 等级段标签页写的是**该段最后一级**的目标名（Lv1-10 段 = Lv10 那两个：柴胡铺 / 鲈鱼档）
const tab = await page.evaluate(() => [...document.querySelectorAll('.era-tab, .level-era')].slice(0, 3).map((e) => e.textContent.trim()).join(' | '))
ok(/柴胡铺|鲈鱼档/.test(tab), '等级段标签页也是新名（同一份数据，标签取该段末级目标）', tab)
ok(errs.length === 0, '页面零控制台错误', errs.slice(0, 2).join(' | '))
await b.close()
console.log(bad === 0 ? '\n线上核验通过' : `\n线上核验失败：${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
