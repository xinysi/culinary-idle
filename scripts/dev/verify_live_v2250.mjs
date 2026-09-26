// 线上核验（v2.25.0）—— **DOM/资源级**（生产没有 /src 路径，别 import）。
//
// 本版四个独有特征：
//   ① 对决组合框出现第三栏「美食奥义」，且**只有战斗相关**（25 行；采集类 7 条不在场）
//   ② 「越级风险」文案改成给**绝对点数**（「最高 N 点（你血量上限 M）」）—— 上一版只说百分比
//   ③ 部署的 CSS 里含本版新增的 `.combo-aoji` / `.aoji-row` 规则
//   ④ 零 console / page 错误
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2250'
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

// ③ CSS 资源内容检查
const css = await page.evaluate(async () => {
  const links = [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href)
  for (const h of links) {
    const t = await (await fetch(h)).text()
    if (t.includes('combo-aoji') && t.includes('aoji-row')) return { hit: true, links }
  }
  const inline = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n')
  return { hit: inline.includes('combo-aoji') && inline.includes('aoji-row'), links }
})
ok(css.hit, '部署的 CSS 含本版新增的 .combo-aoji / .aoji-row 规则', css.hit ? '' : JSON.stringify(css.links))

// 进对决页
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  pinia._s.get('ui').setView('skill')
  pinia._s.get('player').setActiveSkill('knife')
})
await page.waitForTimeout(1300)

// ① 第三栏：25 行、两列（攻击/防御）、采集类不在场
const col = await page.evaluate(() => {
  const box = document.querySelector('.combo-aoji')
  if (!box) return null
  const rows = [...box.querySelectorAll('.aoji-row .aoji-name')].map((e) => e.innerText.replace(/^[🟢·]\s*/, '').trim())
  const cols = [...box.querySelectorAll('.aoji-col')].map((c) => c.querySelector('.attr-col-head')?.innerText?.trim())
  // 采集/生产类奥义的代表名字（带「丰收」的都是采集线）：这一栏绝不该出现
  const leaked = rows.filter((t) => /丰收|渔获|矿脉|采伐|播种|拾荒|掘宝/.test(t))
  const grid = getComputedStyle(document.querySelector('.combat-combo')).gridTemplateColumns.split(' ').filter(Boolean)
  return { n: rows.length, cols, leaked, header: box.querySelector('h3')?.innerText?.replace(/\s+/g, ' ').trim(), grid, names: rows.join('、') }
})
// ⚠️ getComputedStyle 返回的是**解析后的像素值**（不是 `1fr 1px …` 简写）⇒ 判据是「5 条轨道 + 中间两条 1px 虚线」
const is5 = (g) => Array.isArray(g) && g.length === 5 && g.filter((t) => t === '1px').length === 2
ok(!!col && col.n === 25 && col.cols.length === 2, '组合框第三栏「美食奥义」有 25 条战斗奥义（攻击/防御两列）',
  col ? `「${col.header}」· 列=${JSON.stringify(col.cols)} · 行=${col.n}` : '找不到 .combo-aoji')
ok(!!col && col.leaked.length === 0, '采集/生产类奥义不在这一栏里（只放战斗相关）',
  col?.leaked?.length ? JSON.stringify(col.leaked) : `零泄漏（抽检：${(col?.names ?? '').slice(0, 22)}…）`)
ok(is5(col?.grid), '组合框渲染成 5 条轨道（真的腾出了第三栏）', col?.grid?.join(' '))

// ② 越级风险文案：选最后一个对手（新档 L1 ⇒ 越级），应给**绝对点数**
const heavy = await page.evaluate(async () => {
  const cards = [...document.querySelectorAll('.monster-card')]
  cards[cards.length - 1]?.click?.()
  await new Promise((s) => setTimeout(s, 800))
  const rows = [...document.querySelectorAll('.monster-stats > div')].map((d) => d.innerText.replace(/\s+/g, ' ').trim())
  return rows.find((r) => /^越级风险/.test(r)) ?? null
})
ok(!!heavy && /最高 \d+ 点（你血量上限 \d+）/.test(heavy), '越级风险文案给绝对点数（本版新增的写法）', `「${heavy ?? '未找到'}」`)
// 🔴 判别本版最硬的一条：上一版这句话是「最高 100% 你的血量上限（可一击致命）」。
//    两者不可能同时成立 —— 「% 你的血量上限」只在 maxHp 拿不到时才会出现，而这版就是修「拿不到/取整」的。
ok(!!heavy && !/% 你的血量上限/.test(heavy) && !/（可一击致命）/.test(heavy),
  '旧文案（百分比 /「可一击致命」）已不在线上', heavy ? '已是新版措辞' : 'n/a')

console.log('页面错误：', errs.length ? errs.slice(0, 3) : '无')
ok(errs.length === 0, '零 console / page 错误')
try { await page.screenshot({ path: 'scripts/sim/out/live-v2250.png' }) } catch { /* 目录不存在时忽略 */ }
await b.close()
console.log(bad === 0 ? '\n线上核验通过：v2.25.0 的可见特征全部到位' : `\n有 ${bad} 项不达标`)
process.exit(bad === 0 ? 0 : 1)
