// 像素美食接入层 · 堆叠体检：**哪些元素被挂了帧，它们又套在几个帧里面**。
//
// 为什么要有这个：控件条样张（shot_pixel_skin.mjs）里每个控件都是孤零零一个，
// 而真页面是「面板 → 卡片 → 卡片里的行 → 行里的按钮」多层嵌套 —— 每层都挂帧就成了一摞纸板。
// 这里用真实 DOM 统计：被挂帧的元素总数 / 有帧祖先的元素占比 / 还留着旧 box-shadow 与边框的，
// 并按类名排序 —— 这张表就是「哪几层该撤掉帧」的依据。
//
// 用法：node scripts/dev/audit_pixel_skin_stack.mjs
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const BASE = 'http://localhost:5173/'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(BASE, { waitUntil: 'load' })
await page.waitForTimeout(500)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(400)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(900)
await page.addStyleTag({ url: '/src/styles/pixel-skin.css' })
await page.waitForTimeout(600)

// 走到控件最密的一页
const sk = page.locator('.sidebar-tab', { hasText: '技能' })
if (await sk.count()) { await sk.first().click(); await page.waitForTimeout(300) }
const forage = page.locator('.skill-item', { hasText: '采摘' })
if (await forage.count()) { await forage.first().click(); await page.waitForTimeout(800) }

const data = await page.evaluate(() => {
  const FRAMED = (el) => /ui-food-pixel/.test(getComputedStyle(el).borderImageSource || '')
  const all = [...document.querySelectorAll('*')]
  const rows = []
  for (const el of all) {
    if (!FRAMED(el)) continue
    let anc = 0
    for (let p = el.parentElement; p; p = p.parentElement) if (FRAMED(p)) anc++
    const st = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    rows.push({
      cls: (el.className || el.tagName).toString().trim().split(/\s+/).slice(0, 2).join('.'),
      anc,
      w: Math.round(r.width), h: Math.round(r.height),
      area: Math.round(r.width * r.height),
      shadow: st.boxShadow !== 'none' ? 1 : 0,
      bw: parseFloat(st.borderTopWidth) || 0,
      txt: (el.textContent || '').trim().length,
    })
  }
  return rows
})

const byCls = new Map()
for (const r of data) {
  const k = r.cls
  if (!byCls.has(k)) byCls.set(k, { n: 0, nested: 0, maxAnc: 0, shadow: 0, bw: 0, area: 0, h: [] })
  const a = byCls.get(k)
  a.n++; a.nested += r.anc > 0 ? 1 : 0; a.maxAnc = Math.max(a.maxAnc, r.anc)
  a.shadow += r.shadow; a.bw += r.bw > 0 ? 1 : 0; a.area += r.area; a.h.push(r.h)
}
const rows = [...byCls.entries()].sort((x, y) => y[1].n - x[1].n)
const nestedTotal = data.filter((r) => r.anc > 0).length
console.log(`被挂帧的元素：${data.length} 个，其中**套在别的帧里**的：${nestedTotal} 个` +
  `（${Math.round(100 * nestedTotal / (data.length || 1))}%）`)
const d = (as) => { const i = Math.floor(as.length / 2); return [...as].sort((a, b) => a - b)[i] }
const pad = (v, w) => String(v).padEnd(w)
const padL = (v, w) => String(v).padStart(w)
console.log('\n按类名（n=实例数 · 嵌套=有帧祖先的比例 · 最深=最多套几层 · 旧阴影/旧边框=还留着旧的）')
console.log(pad('类名', 34) + padL('n', 5) + padL('嵌套', 9) + padL('最深', 6) + padL('旧阴影', 8) + padL('旧边框', 8) + padL('高中位', 8))
for (const [k, a] of rows.slice(0, 26)) {
  console.log(pad(k.slice(0, 33), 34) + padL(a.n, 5) + padL(Math.round(100 * a.nested / a.n) + '%', 9) +
    padL(a.maxAnc, 6) + padL(a.shadow, 8) + padL(a.bw, 8) + padL(d(a.h), 8))
}
console.log('\n嵌套最深的 10 个（这就是「一摞纸板」的骨架）：')
for (const r of [...data].sort((x, y) => y.anc - x.anc).slice(0, 10)) {
  console.log('  帧祖先 ' + r.anc + ' 层 · ' + r.cls + ' · ' + r.w + 'x' + r.h)
}
await browser.close()
