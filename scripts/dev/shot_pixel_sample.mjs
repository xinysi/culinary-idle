// 像素美食 UI · §0 样张：把三个样张件按**实机 1:1 css 尺寸**拼进真实控件里，浅深各一遍。
// 用法：node scripts/dev/shot_pixel_sample.mjs
//
// 为什么必须 1:1 看（规范 §11.2）：像素风在放大图里都好看，破功全发生在实机尺寸 ——
// 边框不是整数逻辑像素、撕边把内容吃进去、深色下描边消失，这些只有 1:1 才看得出来。
// 所以主视图 **1:1**，另附一条 4× 放大带**仅用于核对像素网格**（不作为验收依据）。
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const spec = JSON.parse(readFileSync(join(root, 'docs/ui-pixel/像素美食UI_出图提示词_v1.json'), 'utf8'))
const slot = Object.fromEntries(spec.slots.map((s) => [s.id, s]))

const SAMPLE = ['FRAME_CARD', 'FRAME_BTN', 'FRAME_BTN_PRIMARY', 'FRAME_TAB', 'FRAME_TAB_ON']

/** 生成一个件的 CSS：九宫格件用 border-image，固定件用 background-image。
 *  scale 只用于放大带：九宫格件的 border-width 必须跟着一起放大，否则边框不跟着长。
 *  🔴 url() 用**单引号** —— 这段 CSS 要塞进双引号的 style="" 属性里，双引号会把属性提前截断。 */
const css = (id, theme, scale = 1) => {
  const s = slot[id]
  const file = theme === 'dark' ? `out/${id}_dark@2x.png` : `out/${id}@2x.png`
  if (s.pull && s.slice) {
    // slice 是导出像素，border-image-slice 用 px 时也按位图原始像素算
    const width = (s.slice / 2) * scale // 导出像素 → css px（导出 = css × 2）
    return `border-style:solid;border-width:${width}px;border-image:url('${file}') ${s.slice} fill / ${width}px stretch;image-rendering:pixelated;`
  }
  return `background:url('${file}') center/100% 100% no-repeat;image-rendering:pixelated;`
}

const size = (id) => {
  const [w, h] = slot[id].css
  return `width:${w}px;height:${h}px;`
}

/** 一个件的标签 */
const label = (id) => {
  const s = slot[id]
  const e = s.export
  return `${id} · ${s.cn} · css ${s.css[0]}×${s.css[1]} · 导出 ${e[0]}×${e[1]} · slice ${s.slice}`
}

/** 主题面板：把三个样张件放进真实控件位置，1:1 */
const panel = (theme) => {
  const dark = theme === 'dark'
  const bg = dark ? '#1C1410' : '#FBF3E4'
  const ink = dark ? '#E8D0A0' : '#2B2622'
  const muted = dark ? '#B89A6A' : '#8A7A62'
  const card = css('FRAME_CARD', theme)
  const btn = css('FRAME_BTN', theme)
  const primary = css('FRAME_BTN_PRIMARY', theme)
  const tab = css('FRAME_TAB', theme)
  const tabOn = css('FRAME_TAB_ON', theme)
  const px = 'font-size:12px;line-height:16px;'
  return `
<section style="background:${bg};color:${ink};padding:20px 24px 28px;">
  <h2 style="margin:0 0 4px;font-size:20px;">${dark ? '深色套（_dark）' : '浅色套'}</h2>
  <p style="margin:0 0 20px;font-size:12px;color:${muted}">主视图全部为**实机 1:1 css 尺寸**；文字用 12px / 24px 两档（像素风只在整数倍下不糊）。</p>

  <h3 style="margin:0 0 8px;font-size:14px;color:${muted}">1 · 卡片 ${label('FRAME_CARD')}</h3>
  <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:24px;">
    <div style="${size('FRAME_CARD')}${card}box-sizing:border-box;padding:12px 16px;">
      <div style="font-size:12px;line-height:16px;font-weight:700;">区域 56 · 云梦泽</div>
      <div style="font-size:12px;line-height:16px;">产 番茄 / 稻米 / 河鲜</div>
    </div>
    <div style="${card}box-sizing:border-box;padding:12px 16px;width:320px;height:120px;">
      <div style="font-size:12px;line-height:16px;font-weight:700;">同一个卡片框拉伸到 320×120</div>
      <div style="font-size:12px;line-height:16px;">九宫格四条边各自缩放、中心区整片铺满 —— 这里要看边角有没有被拉糊 / 中心有没有带进装饰。</div>
    </div>
  </div>

  <h3 style="margin:0 0 8px;font-size:14px;color:${muted}">2 · 按钮 ${label('FRAME_BTN')}　＋　${label('FRAME_BTN_PRIMARY')}</h3>
  <div style="display:flex;gap:12px;align-items:center;margin-bottom:24px;">
    <button style="${size('FRAME_BTN')}${btn}${px}color:${ink};font-family:inherit;cursor:pointer;">采集</button>
    <button style="${size('FRAME_BTN')}${btn}${px}color:${ink};font-family:inherit;cursor:pointer;">取消</button>
    <button style="${size('FRAME_BTN_PRIMARY')}${primary}${px}color:${dark ? '#F8E8C8' : '#FFF3E0'};font-family:inherit;cursor:pointer;">开始烹饪</button>
    <button style="${size('FRAME_BTN_PRIMARY')}${primary}${px}color:${dark ? '#F8E8C8' : '#FFF3E0'};font-family:inherit;cursor:pointer;">全部领取</button>
  </div>

  <h3 style="margin:0 0 8px;font-size:14px;color:${muted}">3 · 页签 ${label('FRAME_TAB')}　＋　${label('FRAME_TAB_ON')}</h3>
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:28px;">
    <button style="${size('FRAME_TAB_ON')}${tabOn}${px}color:${dark ? '#F8E8C8' : '#FFF3E0'};font-family:inherit;cursor:pointer;">灶台</button>
    <button style="${size('FRAME_TAB')}${tab}${px}color:${ink};font-family:inherit;cursor:pointer;">食谱</button>
    <button style="${size('FRAME_TAB')}${tab}${px}color:${ink};font-family:inherit;cursor:pointer;">商队</button>
    <button style="${size('FRAME_TAB')}${tab}${px}color:${ink};font-family:inherit;cursor:pointer;">图鉴</button>
  </div>

  <h3 style="margin:0 0 8px;font-size:14px;color:${muted}">4 · 放大 4×（**只看像素网格，不作为验收依据**）</h3>
  <div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;">
    ${SAMPLE.map((id) => {
      const s = slot[id]
      return `<div><div style="font-size:11px;color:${muted};margin-bottom:4px;">${id}</div>
      <div style="${css(id, theme, 2)}width:${s.css[0] * 2}px;height:${s.css[1] * 2}px;"></div></div>`
    }).join('')}
  </div>
</section>`
}

const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>像素美食 UI · §0 样张（1:1）</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family:"Microsoft YaHei",system-ui,sans-serif; }
  /* 像素件一律关圆角、开 pixelated（规范 §11.3） */
  .pix, [class*="FRAME"] { border-radius:0; }
  img, button { image-rendering:pixelated; }
  button { border-radius:0; }
</style></head><body>
${panel('light')}
${panel('dark')}
</body></html>`

const outHtml = join(root, 'docs/ui-pixel/样张_1比1.html')
writeFileSync(outHtml, page, 'utf8')

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('requestfailed', (r) => errs.push('load fail: ' + r.url()))
await p.goto(pathToFileURL(outHtml).href, { waitUntil: 'load' })
await p.waitForTimeout(500)

// 浅色 / 深色各截一张（面板高度自适应）
const shot = async (name, sel) => {
  const el = await p.$(sel)
  const out = join(root, 'docs/ui-pixel', name)
  await el.screenshot({ path: out })
  console.log('saved:', out)
}
await shot('样张_浅色_1比1.png', 'section:nth-of-type(1)')
await shot('样张_深色_1比1.png', 'section:nth-of-type(2)')
await b.close()
if (errs.length) {
  console.log('页面报错 / 资源加载失败：')
  for (const e of errs) console.log('  -', e)
  process.exit(1)
}
console.log('ok，2 张（浅色/深色），件数', SAMPLE.length)
