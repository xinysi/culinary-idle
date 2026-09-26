// 像素美食 UI · 接入层预检：把**真实生成的** pixel-skin.css 连同项目现有的 main.css 一起加载，
// 用**真实的控件类名**摆一页，浅深各截一张。
// 用法：node scripts/dev/shot_pixel_skin.mjs
//
// 为什么要连 main.css 一起加载：这一层是**叠加**在既有样式上的，风险全在「叠加后会不会打架」——
// 只单独测新 CSS 是测不出继承、优先级、既有 padding/border 冲突的。
// 这一张过了，才谈得上把 @import 加进 main.css（§11.2 的 1:1 实机验收）。
import { writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

const body = `
<div class="app-layout">
  <div class="app-body" style="padding:24px;">
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:18px;">
      <div class="card" style="width:240px;min-height:80px;padding:12px 16px;">
        <div style="font-size:12px;line-height:16px;font-weight:700;">区域 56 · 云梦泽</div>
        <div style="font-size:12px;line-height:16px;">产 番茄 / 稻米 / 河鲜</div>
      </div>
      <div class="card" style="width:320px;min-height:120px;padding:12px 16px;">
        <div style="font-size:12px;line-height:16px;font-weight:700;">同一张卡片拉伸到 320×120</div>
        <div style="font-size:12px;line-height:16px;">九宫格四条边各自缩放，中心区整片铺满。</div>
      </div>
      <div class="gather-card" style="width:200px;min-height:70px;padding:10px 14px;">
        <div style="font-size:12px;">.gather-card</div>
      </div>
    </div>

    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:18px;">
      <button class="btn btn-sm" style="width:100px;height:24px;font-size:12px;">采集</button>
      <button class="btn btn-sm" style="width:100px;height:24px;font-size:12px;">取消</button>
      <button class="btn btn-primary" style="width:120px;height:32px;font-size:12px;">开始烹饪</button>
      <span class="badge badge-on">×2</span>
      <span class="effect-chip">+10%</span>
      <span class="best-flag">最佳</span>
    </div>

    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:18px;">
      <button class="sidebar-tab active" style="width:75px;height:29px;font-size:11px;">灶台</button>
      <button class="sidebar-tab" style="width:75px;height:29px;font-size:11px;">食谱</button>
      <button class="sidebar-tab" style="width:75px;height:29px;font-size:11px;">商队</button>
      <button class="top-nav-btn" style="width:64px;height:28px;font-size:11px;">竞技场</button>
      <input class="gv-search" type="text" value="搜索食材" style="width:160px;height:26px;font-size:12px;">
      <div class="slot-card" style="width:52px;height:52px;"></div>
      <div class="progress-bar" style="width:200px;height:18px;">
        <div class="progress-bar-fill" style="width:60%;height:100%;"></div>
      </div>
      <span class="ui-check"></span>
    </div>

    <div style="font-size:12px;line-height:18px;max-width:640px;">
      这一段普通正文压在底纹上。底纹是 CSS 效果（<code>--page</code> + 每 64px 五个 1 像素点），
      不是 BG_TILE 位图 —— 换皮肤时底色跟着变，也不会平铺出网格缝。
      类名全部取自实测清单 ui-inventory.json，不是照文档猜的。
    </div>
  </div>
</div>`

const page = (theme) => `<!doctype html><html lang="zh-CN"${theme === 'dark' ? " data-theme='dark'" : ''}>
<head><meta charset="utf-8"><title>像素美食 UI · 接入层预检</title>
<link rel="stylesheet" href="../../src/styles/main.css">
<link rel="stylesheet" href="../../src/styles/pixel-skin.css">
<style>body{margin:0;font-family:"Microsoft YaHei",system-ui,sans-serif}</style>
</head><body>${body}</body></html>`

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1000, height: 620 }, deviceScaleFactor: 2 })

// 把「样式表里引的图有没有 404」也当成失败 —— 路径写错这种错最容易悄悄混过去
const failed = []
p.on('requestfailed', (r) => failed.push(r.url()))
p.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()) })

for (const theme of ['light', 'dark']) {
  const file = join(root, 'docs/ui-pixel', `_skincheck_${theme}.html`)
  writeFileSync(file, page(theme), 'utf8')
  await p.goto(pathToFileURL(file).href, { waitUntil: 'load' })
  await p.waitForTimeout(700)
  const out = join(root, 'docs/ui-pixel', `接入层预检_${theme === 'dark' ? '深色' : '浅色'}.png`)
  await p.screenshot({ path: out })
  console.log('saved:', out)
  // 顺手量一下几个小控件的盒子 —— 「控件被裁 / 文字竖排」的成因全在这几个数字里
  const geom = await p.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const s = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return {
        box: [Math.round(r.width), Math.round(r.height)],
        content: [el.clientWidth, el.clientHeight],
        border: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
        biw: s.borderImageWidth, bs: s.borderStyle, sizing: s.boxSizing,
        pad: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft],
        display: s.display,
      }
    }
    return { card: pick('.card'), tab: pick('.sidebar-tab'), input: pick('.gv-search'),
             slot: pick('.slot-card'), bar: pick('.progress-bar'), tile: pick('.feature-tile') }
  })
  console.log('  几何 →', JSON.stringify(geom, null, 0))

}
await b.close()

if (failed.length) {
  console.log('有资源没加载成：')
  for (const f of [...new Set(failed)].slice(0, 12)) console.log('  -', f)
  process.exit(1)
}
console.log('ok：浅深两版都加载正常，没有 404')
