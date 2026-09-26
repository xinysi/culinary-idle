// BG_TILE 方案对比：位图平铺 vs CSS 效果，放进同一个真实页面里按实机尺寸看。
// 用法：node scripts/dev/shot_bg_ab.mjs
//
// 为什么必须铺开看：位图版单看那一张是「一块挺好看的吐司」，铺满页面才发现是
// 一格一格的吐司方阵（深色版更糟：满墙煎蛋）。所以这张对比图左右各铺一整页。
//
// 右下角那两块是 proposal：底色走 `background-color: var(--page)`（15 套皮肤直接改这个变量，
// 这就是规范说的「位图只管颗粒、颜色走 CSS 变量」），上面只叠一张**只有 4~6 个 1×1 像素点**的
// 64×64 SVG，透明底 ⇒ 没有接缝、不占资源、换肤自动跟着变色。
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

// 只画 5 个 1×1 像素点（规范：「每 64px 只有 4~6 个 1 像素点」），其余全透明
const SPECK = (colour) =>
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E" +
  [['7', '13'], ['41', '5'], ['23', '37'], ['55', '29'], ['14', '53']]
    .map(([x, y]) => `%3Crect x='${x}' y='${y}' width='1' height='1' fill='${colour}'/%3E`)
    .join('') +
  '%3C/svg%3E")'

const content = `
  <div style="max-width:520px;">
    <div style="border:8px solid;border-image:url('out/FRAME_CARD@2x.png') 16 fill / 8px stretch;
                box-sizing:border-box;padding:14px 18px;margin-bottom:14px;">
      <div style="font-size:14px;font-weight:700;line-height:20px;">区域 56 · 云梦泽</div>
      <div style="font-size:12px;line-height:18px;">产 番茄 / 稻米 / 河鲜。底纹是页面最底层，
        内容全部压在它上面 —— 所以它必须安静。</div>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:14px;">
      <button style="border:4px solid;border-width:4px;border-style:solid;
        border-image:url('out/FRAME_BTN@2x.png') 8 fill / 4px stretch;box-sizing:border-box;
        width:100px;height:24px;font-size:12px;font-family:inherit;">采集</button>
      <button style="border:4px solid;border-style:solid;
        border-image:url('out/FRAME_BTN_PRIMARY@2x.png') 8 fill / 4px stretch;box-sizing:border-box;
        width:120px;height:32px;font-size:12px;font-family:inherit;">开始烹饪</button>
    </div>
    <div style="font-size:12px;line-height:18px;">
      一段普通正文。底纹如果带边框、带图案，读起来就会一直在跟文字抢注意力；
      颗粒只该是「凑近才看得见」的一层，而不是页面的主角。
    </div>
  </div>`

/** 一页：背景技术不同，内容完全相同。 */
const page = (title, bg_style, dark, node) => `
  <section style="padding:16px 18px 22px;">
    <h3 style="margin:0 0 10px;font-size:14px;">${title}</h3>
    <div style="position:relative;height:300px;overflow:hidden;${bg_style}">
      <div style="position:absolute;inset:0;padding:18px;color:${dark ? '#E8D0A0' : '#2B2622'};">
        ${content}
      </div>
    </div>
  </section>`

const bitmapLight = `background-color:#FBF3E4;background-image:url('out/BG_TILE@2x.png');` +
  `background-repeat:repeat;background-size:64px 64px;image-rendering:pixelated;`
const bitmapDark = `background-color:#1C1410;background-image:url('out/BG_TILE_dark@2x.png');` +
  `background-repeat:repeat;background-size:64px 64px;image-rendering:pixelated;`
const cssLight = `background-color:#FBF3E4;background-image:${SPECK('%23D89868')};` +
  `background-repeat:repeat;background-size:64px 64px;`
const cssDark = `background-color:#1C1410;background-image:${SPECK('%236B5433')};` +
  `background-repeat:repeat;background-size:64px 64px;`

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>BG_TILE 方案对比</title>
<style>body{margin:0;background:#fff;font-family:"Microsoft YaHei",system-ui,sans-serif}</style>
</head><body>
<div style="display:grid;grid-template-columns:1fr 1fr;">
  ${page('① 现行：位图平铺（浅色）', bitmapLight, false)}
  ${page('② 建议：CSS 效果（浅色）', cssLight, false)}
  ${page('③ 现行：位图平铺（深色）', bitmapDark, true)}
  ${page('④ 建议：CSS 效果（深色）', cssDark, true)}
</div>
</body></html>`

const outHtml = join(root, 'docs/ui-pixel/BG底纹_方案对比.html')
writeFileSync(outHtml, html, 'utf8')

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('requestfailed', (r) => errs.push('load fail: ' + r.url()))
await p.goto(pathToFileURL(outHtml).href, { waitUntil: 'load' })
await p.waitForTimeout(600)
await p.screenshot({ path: join(root, 'docs/ui-pixel/BG底纹_方案对比.png'), fullPage: true })
await b.close()
if (errs.length) {
  console.log('页面报错 / 资源加载失败：')
  for (const e of errs.slice(0, 10)) console.log('  -', e)
  process.exit(1)
}
console.log('saved: docs/ui-pixel/BG底纹_方案对比.png（左上/右下=现行位图，右上/右下=建议 CSS）')
