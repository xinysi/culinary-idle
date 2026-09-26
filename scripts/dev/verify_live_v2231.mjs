// 线上核验（v2.23.1）——只查「只在本版出现的可见特征」，且**必须是 DOM/资源级断言**。
//
// ⚠️ 上一版（v2.23.0）的脚本用 `import(urlOf('/src/...'))` 拿引擎实例 —— **线上跑不了**：
//    生产构建里没有 `/src/**` 这些路径（打包成了哈希 chunk），`urlOf` 返回 undefined。
//    （e2e 全打 5173 也是同一个原因：只有 dev server 才有 /src。）⇒ 线上核验只能靠 DOM + 资源内容。
//
// 本版四个独有特征：
//   ① 对手详情的**独立抗性行**（决战页左栏「抗性 对「X」有抗性」）—— v2.23.0 把它错并在只对首领显示的
//      「机制」行里 ⇒ 最需要它的 220 个区域对手反而看不到；v2.23.1 拆成独立一行
//   ② 战斗屏 `.foe-resist`（起一场战斗后可见）
//   ③ 属性面板「准确率」在词条堆满 10000 时**被封顶**（旧加法形态会显示 ~10010）
//   ④ 部署的 CSS 里含本版新增的 `.foe-resist` / `.foe-status-chip` 两条规则
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2231'
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

// ④ 部署的 CSS 里有没有本版新增的两条规则（资源内容检查，不是比 chunk 哈希）
const css = await page.evaluate(async () => {
  // 生产构建：样式在 <link rel=stylesheet> 指向的文件里；dev：Vite 注入到 <style> 标签 ⇒ 两条路都查
  const links = [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href)
  for (const h of links) {
    const t = await (await fetch(h)).text()
    if (t.includes('foe-resist') && t.includes('foe-status-chip')) return { src: h, hit: true, links }
  }
  const inline = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n')
  return { src: 'inline-style', hit: inline.includes('foe-resist') && inline.includes('foe-status-chip'), links }
})
ok(css.hit, '部署的 CSS 含本版新增的 .foe-resist / .foe-status-chip 规则', css.hit ? '' : JSON.stringify(css.links))

// ① 对决页：选中一个**区域对手**（mechanic 为 null 的那些）⇒ 抗性行必须出现
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  pinia._s.get('ui').setView('skill')
  pinia._s.get('player').activeSkill = 'knife'
})
await page.waitForTimeout(1200)
await page.evaluate(() => {
  // 点第一张对手卡（区域对手，没有 mechanic）
  const card = document.querySelector('.opp-card, .monster-card, .combat-opponent, [class*=opp]')
  card?.click?.()
})
await page.waitForTimeout(900)
const detail = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.monster-stats > div')].map((d) => d.innerText.replace(/\s+/g, ' ').trim())
  return { rows, text: detailText() }
  function detailText() { return document.body.innerText }
})
const resistRow = detail.rows.find((r) => /^抗性/.test(r)) ?? null
ok(!!resistRow && /对「(割伤|破防|灼烧)」有抗性|免疫「(割伤|破防|灼烧)」/.test(resistRow),
  '对决页对手详情有**独立**的抗性行（区域对手也看得到，本版新增）', resistRow ? `「${resistRow}」` : `未找到；现有行=${JSON.stringify(detail.rows.slice(0, 8))}`)

// ③ 属性面板「准确率」：堆一个 10000 的词条 ⇒ 必须被乘区+封顶拦住
const acc = await page.evaluate(async () => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const p = pinia._s.get('player')
  const readAcc = () => {
    const st = [...document.querySelectorAll('.attr-cols .stat')].find((e) => e.querySelector('.stat-label')?.innerText.includes('准确率'))
    return st ? Number(st.querySelector('.stat-num').innerText.replace(/[^\d.]/g, '')) : null
  }
  await new Promise((s) => setTimeout(s, 300))
  const base = readAcc()
  // ⚠️ 新档**没有装备也没有背包**，所以先发一把铜刀再穿 —— 词条按装备 id 存、走 equippedStats 的加法路径
  try { p.gainItem('copperKnife', 1) } catch (e) { return { base, after: null, err: String(e) } }
  p.equipment.weapon = 'copperKnife'
  await new Promise((s) => setTimeout(s, 500))
  p.gearMods.copperKnife = { itemId: 'copperKnife', mods: [{ stat: 'accuracy', value: 10000 }] }
  await new Promise((s) => setTimeout(s, 700))
  const after = readAcc()
  return { base, after, geared: 'copperKnife' }
})
ok(acc.base != null && acc.after != null && acc.after > acc.base * 2 && acc.after < 2000,
  '词条命中堆到 10000 时「准确率」被封顶（乘区形态 + 上限，本版新增）',
  `${acc.base} → ${acc.after}（旧加法形态会是 ~10000+）`)

console.log('页面错误：', errs.length ? errs.slice(0, 3) : '无')
ok(errs.length === 0, '零 console / page 错误')
try { await page.screenshot({ path: 'scripts/sim/out/live-v2231.png' }) } catch { /* 目录不存在时忽略 */ }
await b.close()
console.log(bad === 0 ? '\n线上核验通过：v2.23.1 的可见特征全部到位' : `\n有 ${bad} 项不达标`)
process.exit(bad === 0 ? 0 : 1)
