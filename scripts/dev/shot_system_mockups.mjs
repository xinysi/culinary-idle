// 通用设计系统样张渲染：把同一页（采摘技能页，真实文案与密度）用 4 套「系统气质」渲染出来。
// 用的是**真 daisyUI CSS**（CDN 抓下来存到 docs/ui-mockup/vendor/），不是我自己仿的观感；
// 第 4 套（element）是在 daisyUI 变量层上覆写出一套「Element Plus / Naive UI 那种企业风」的主题。
// 用法：node scripts/dev/shot_system_mockups.mjs
import fs from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const dir = join(root, 'docs/ui-mockup')
const vendor = join(dir, 'vendor')
fs.mkdirSync(vendor, { recursive: true })

const CDN = 'https://cdn.jsdelivr.net/npm/daisyui@4.12.14/dist/full.min.css'
const LOCAL = join(vendor, 'daisyui.css')

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

// ① 先把 CSS 落一份到本地（之后离线也能看样张）
if (!fs.existsSync(LOCAL)) {
  const css = await p.evaluate(async (u) => (await fetch(u)).text(), CDN)
  fs.writeFileSync(LOCAL, css)
  console.log('已缓存 daisyUI CSS →', LOCAL, (css.length / 1024).toFixed(0) + 'KB')
}

const THEMES = [
  ['daisy-light', 'light', 'daisyUI · light（中性干净：白卡 + 细边 + 小阴影）'],
  ['daisy-dark', 'dark', 'daisyUI · dark（同系统深色）'],
  ['daisy-autumn', 'autumn', 'daisyUI · autumn（暖色，最贴美食题材）'],
  ['element-style', 'element', 'Element Plus / Naive 风（企业蓝 + 4px 圆角 + 细边框）'],
]

await p.goto(pathToFileURL(join(dir, '系统样张.html')).href, { waitUntil: 'load' })
// 等 CDN 的样式真的应用上（daisyUI 会给 .btn 设 border-radius）
await p.waitForFunction(() => {
  const el = document.querySelector('.btn')
  return el && parseFloat(getComputedStyle(el).borderRadius) > 0
}, null, { timeout: 20000 })

let n = 0
for (const [file, theme, label] of THEMES) {
  await p.evaluate((t) => { document.documentElement.dataset.theme = t }, theme)
  await p.evaluate((l) => {
    const el = document.getElementById('who')
    if (el) el.textContent = l
  }, label)
  await p.waitForTimeout(320)
  await p.screenshot({ path: join(dir, `系统样张-${file}.png`), fullPage: false })
  n++
}
await b.close()
console.log(`渲染 ${n} 张 → docs/ui-mockup/系统样张-*.png`)
