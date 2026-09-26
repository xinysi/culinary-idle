// 线上核验（v2.24.0）—— 只查「只在本版出现的可见特征」，**必须 DOM/资源级**（生产没有 /src 路径）。
//
// 本版四个独有特征（越级重击）：
//   ① 对手详情有「越级风险」行（新档玩家 L1 ⇒ 选一个高级对手就会出现）
//   ② 同一个区域里选 **L1 的对手**时**没有**那一行（证明它真的按等级差派生，而不是无脑显示）
//   ③ 部署的 CSS 里含本版新增的 `.foe-heavy` 规则
//   ④ 上一版的抗性行仍在（回归），且零 console 错误
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2240'
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

// ③ CSS 资源内容检查（生产走 <link>，dev 走 <style>）
const css = await page.evaluate(async () => {
  const links = [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href)
  for (const h of links) {
    const t = await (await fetch(h)).text()
    if (t.includes('foe-heavy') && t.includes('foe-resist')) return { src: h, hit: true, links }
  }
  const inline = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n')
  return { src: 'inline', hit: inline.includes('foe-heavy') && inline.includes('foe-resist'), links }
})
ok(css.hit, '部署的 CSS 含本版新增的 .foe-heavy（以及上一版的 .foe-resist）', css.hit ? '' : JSON.stringify(css.links))

// 进对决页
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  pinia._s.get('ui').setView('skill')
  pinia._s.get('player').activeSkill = 'knife'
})
await page.waitForTimeout(1300)
const pick = async (which) => {
  await page.evaluate((w) => {
    const cards = [...document.querySelectorAll('.monster-card')]
    const el = w === 'last' ? cards[cards.length - 1] : cards[0]
    el?.click?.()
  }, which)
  await page.waitForTimeout(700)
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('.monster-stats > div')].map((d) => d.innerText.replace(/\s+/g, ' ').trim())
    return {
      rows,
      heavy: rows.find((r) => /^越级风险/.test(r)) ?? null,
      resist: rows.find((r) => /^抗性/.test(r)) ?? null,
      lv: rows.find((r) => /^Lv/.test(r)) ?? (document.querySelector('.monster-title .dim')?.innerText ?? ''),
    }
  })
}
// ② 先选 L1 那个（新档玩家也是 L1 ⇒ 不该有风险行）
const first = await pick('first')
ok(first.heavy === null, '同等级/低等级对手**不显示**越级风险（证明它按等级差派生，不是无脑显示）',
  `对手 ${first.lv} · 越级风险行=${first.heavy ?? '无'}`)
// ① 再选最后一个（区域按等级升序 ⇒ 更高级）
const last = await pick('last')
ok(!!last.heavy && /重击/.test(last.heavy) && /一击致命|血量上限/.test(last.heavy),
  '高级对手显示「越级风险」行（本版新增）', `「${last.heavy ?? '未找到'}」`)
// ④ 上一版的抗性行仍在
ok(!!last.resist && /对「(割伤|破防|灼烧)」有抗性|免疫「(割伤|破防|灼烧)」/.test(last.resist),
  '上一版的抗性行仍在（回归）', `「${last.resist ?? '未找到'}」`)

console.log('页面错误：', errs.length ? errs.slice(0, 3) : '无')
ok(errs.length === 0, '零 console / page 错误')
try { await page.screenshot({ path: 'scripts/sim/out/live-v2240.png' }) } catch { /* 目录不存在时忽略 */ }
await b.close()
console.log(bad === 0 ? '\n线上核验通过：v2.24.0 的可见特征全部到位' : `\n有 ${bad} 项不达标`)
process.exit(bad === 0 ? 0 : 1)
