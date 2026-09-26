// 渲染「Potion Craft 风」样张（白天 + 夜间两张）。
// 用法：node scripts/dev/shot_potion_mockup.mjs
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const html = join(root, 'docs/ui-mockup/药水工艺样张.html')
const out = join(root, 'docs/ui-mockup')

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
await p.goto(pathToFileURL(html).href, { waitUntil: 'load' })
await p.waitForTimeout(700)
// 物品图是否真的加载出来了（file:// 下路径错会静默变空图）
const imgs = await p.evaluate(() => [...document.querySelectorAll('img')].map((i) => ({ src: i.src.split('/').pop(), ok: i.naturalWidth > 0 })))
console.log('物品图:', imgs.map((i) => `${i.src}:${i.ok ? 'ok' : '失败'}`).join(' '))

await p.screenshot({ path: join(out, '药水工艺样张-白天.png') })
await p.evaluate(() => document.documentElement.setAttribute('data-night', '1'))
await p.waitForTimeout(320)
await p.screenshot({ path: join(out, '药水工艺样张-夜间.png') })
await b.close()
console.log('渲染完成 → docs/ui-mockup/药水工艺样张-{白天,夜间}.png')
if (errs.length) console.log('页面错误:', [...new Set(errs)].slice(0, 3))
