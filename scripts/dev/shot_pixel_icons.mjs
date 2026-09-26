// 像素美食 UI · 图标集（§7，158 个）：按**实机 1:1 css 尺寸**排成验收表。
// 用法：node scripts/dev/shot_pixel_icons.mjs
//
// 两件事在这个尺寸下才看得出来：
//  1. 图标是不是**认得出**（54→27 逻辑像素、18→9 逻辑像素，越小越容易糊成一团）；
//  2. 和它要取代的 **emoji 并排**看 —— 「emoji 与像素画风不搭」正是这套要解决的问题，
//     所以验收表把原 emoji 也印在图标旁边，好坏一眼可比。
// 图标没有深色第二套（§6 只列了 14 件面类件），所以深浅两个底板都要能读 —— 这正是要验的。
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const icons = JSON.parse(readFileSync(join(root, 'docs/ui-pixel/icons.json'), 'utf8'))

const KINDS = ['功能磁贴', '技能', '小游戏', '功能分组头', '通用动作']

const card = (icon, theme) => {
  const [w, h] = icon.css
  const dark = theme === 'dark'
  const ink = dark ? '#E8D0A0' : '#2B2622'
  const muted = dark ? '#8A7A62' : '#8A7A62'
  return `<div style="width:96px;text-align:center;">
    <div style="height:${Math.max(h, 54)}px;display:flex;align-items:flex-end;justify-content:center;">
      <img src="out/${icon.id}@2x.png" width="${w}" height="${h}" alt=""
           style="image-rendering:pixelated;">
    </div>
    <div style="font-size:11px;line-height:14px;color:${ink};margin-top:4px;">${icon.name}</div>
    <div style="font-size:10px;line-height:13px;color:${muted};">
      ${w}×${h}${icon.emoji ? ' · 原 ' + icon.emoji : ''}
    </div>
  </div>`
}

const panel = (theme) => {
  const dark = theme === 'dark'
  const bg = dark ? '#1C1410' : '#FBF3E4'
  const ink = dark ? '#E8D0A0' : '#2B2622'
  const muted = dark ? '#B89A6A' : '#8A7A62'
  return `<section style="background:${bg};color:${ink};padding:18px 22px 26px;">
    <h2 style="margin:0 0 14px;font-size:18px;">${dark ? '深色底板' : '浅色底板'}</h2>
    ${KINDS.map((kind) => {
      const group = icons.filter((i) => i.kind === kind)
      if (!group.length) return ''
      const sizes = [...new Set(group.map((i) => i.css[0]))].join('/')
      return `<h3 style="margin:0 0 10px;font-size:13px;color:${muted};">
        ${kind} · ${group.length} 个 · css ${sizes}px
        ${kind === '通用动作' ? '（§7.6：不做食物隐喻）' : ''}</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px 0;margin-bottom:22px;">
        ${group.map((i) => card(i, theme)).join('')}
      </div>`
    }).join('')}
  </section>`
}

const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>像素美食 UI · 图标集（1:1）</title>
<style>body{margin:0;font-family:"Microsoft YaHei",system-ui,sans-serif}
img{display:block}</style></head><body>
${panel('light')}
${panel('dark')}
</body></html>`

const outHtml = join(root, 'docs/ui-pixel/图标集_1比1.html')
writeFileSync(outHtml, page, 'utf8')

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('requestfailed', (r) => errs.push('load fail: ' + r.url()))
await p.goto(pathToFileURL(outHtml).href, { waitUntil: 'load' })
await p.waitForTimeout(800)
for (const [n, sel] of [['图标集_浅色_1比1.png', 'section:nth-of-type(1)'],
                        ['图标集_深色_1比1.png', 'section:nth-of-type(2)']]) {
  const el = await p.$(sel)
  await el.screenshot({ path: join(root, 'docs/ui-pixel', n) })
  console.log('saved:', n)
}
await b.close()
if (errs.length) {
  console.log('页面报错 / 资源加载失败：')
  for (const e of errs.slice(0, 10)) console.log('  -', e)
  process.exit(1)
}
console.log('ok，图标 ' + icons.length + ' 个')