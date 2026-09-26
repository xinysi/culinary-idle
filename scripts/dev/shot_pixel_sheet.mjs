// 像素美食 UI · 全量 42 件：按**实机 1:1 css 尺寸**排成验收表（浅色 / 深色各一张）。
// 用法：node scripts/dev/shot_pixel_sheet.mjs
//
// 每条都按它自己的**类型**拼装，和接入时的写法一致（§11.3）：
//   · 九宫格件 → `border-image: url() <slice> fill / <slice/2>px stretch`（只动 border-image-*）
//   · 纹理件   → `background-size: 100% 100%`（整条拉伸）
//   · 固定件   → `background-size: 100% 100%`（尺寸固定，不拉伸）
// 主视图一律 **1:1**；另附 4× 放大带只用于核对像素网格（§11.2 明确「不看放大图」做验收）。
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const spec = JSON.parse(readFileSync(join(root, 'docs/ui-pixel/像素美食UI_出图提示词_v1.json'), 'utf8'))
const slots = spec.slots

/** 一个件的 CSS。🔴 url() 用单引号：要塞进双引号的 style="" 属性里，双引号会截断属性。 */
const css = (s, theme, scale = 1) => {
  const dark = theme === 'dark'
  const file = dark && s.dark_variant ? `out/${s.id}_dark@2x.png` : `out/${s.id}@2x.png`
  if (s.pull && s.slice) {
    const width = (s.slice / 2) * scale
    return `border-style:solid;border-width:${width}px;border-image:url('${file}') ${s.slice} fill / ${width}px stretch;`
  }
  return `background:url('${file}') center/100% 100% no-repeat;`
}

const kind = (s) => (s.pull && s.slice ? '九宫格' : (s.export[0] <= 32 && s.export[1] <= 64 ? '固定' : '拉伸'))

const cell = (s, theme) => {
  const [w, h] = s.css
  const dark = theme === 'dark'
  const ink = dark ? '#E8D0A0' : '#2B2622'
  const muted = dark ? '#8A7A62' : '#8A7A62'
  const box = Math.max(w, 150)
  return `<div style="width:${box}px;margin:0 0 16px;">
    <div style="font-size:11px;line-height:14px;color:${muted};margin-bottom:4px;">
      ${s.id} · ${s.cn} · ${w}×${h} · slice ${s.slice || 0} · ${kind(s)}
    </div>
    <div style="${css(s, theme)}width:${w}px;height:${h}px;box-sizing:border-box;image-rendering:pixelated;"></div>
  </div>`
}

const panel = (theme) => {
  const dark = theme === 'dark'
  const bg = dark ? '#1C1410' : '#FBF3E4'
  const ink = dark ? '#E8D0A0' : '#2B2622'
  const muted = dark ? '#B89A6A' : '#8A7A62'
  return `<section style="background:${bg};color:${ink};padding:18px 22px 26px;">
    <h2 style="margin:0 0 4px;font-size:19px;">${dark ? '深色套' : '浅色套'} · 通用件 ${slots.length} 件（1:1）</h2>
    <p style="margin:0 0 18px;font-size:12px;color:${muted};">
      每件按实机 css 尺寸显示；九宫格件已按 <code>border-image … fill / …px stretch</code> 拼装。
      ${dark ? '深色只出 §6 的 14 件，其余沿用浅色件。' : '深色第二套见另一张。'}
    </p>
    <div style="display:flex;flex-wrap:wrap;gap:8px 18px;align-items:flex-start;">
      ${slots.map((s) => cell(s, theme)).join('')}
    </div>
  </section>`
}

const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>像素美食 UI · 全量通用件（1:1）</title>
<style>body{margin:0;font-family:"Microsoft YaHei",system-ui,sans-serif}
code{font-family:Consolas,monospace}div{image-rendering:pixelated}</style></head><body>
${panel('light')}
${panel('dark')}
</body></html>`

const outHtml = join(root, 'docs/ui-pixel/全量_1比1.html')
writeFileSync(outHtml, page, 'utf8')

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('requestfailed', (r) => errs.push('load fail: ' + r.url()))
await p.goto(pathToFileURL(outHtml).href, { waitUntil: 'load' })
await p.waitForTimeout(900)
for (const [name, sel] of [['全量_浅色_1比1.png', 'section:nth-of-type(1)'],
                           ['全量_深色_1比1.png', 'section:nth-of-type(2)']]) {
  const el = await p.$(sel)
  await el.screenshot({ path: join(root, 'docs/ui-pixel', name) })
  console.log('saved:', name)
}
await b.close()
if (errs.length) {
  console.log('页面报错 / 资源加载失败：')
  for (const e of errs.slice(0, 10)) console.log('  -', e)
  process.exit(1)
}
console.log('ok，通用件 %d 件', slots.length)
