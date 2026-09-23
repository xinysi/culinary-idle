// 把 UI 风格样张渲染成 PNG（给用户看 / 选方向用）
// 用法：node scripts/dev/shot_ui_mockup.mjs
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const page_path = join(root, 'docs/ui-mockup/index.html')
const out = join(root, 'docs/ui-mockup/风格样张-6选1.png')

const b = await chromium.launch()
// 宽按 6 列 ×300px + 间距与留白；高按内容自适应（整页截图，别裁掉最后一列）
const p = await b.newPage({ viewport: { width: 2020, height: 900 }, deviceScaleFactor: 2 })
await p.goto(pathToFileURL(page_path).href, { waitUntil: 'load' })
await p.waitForTimeout(600)
await p.screenshot({ path: out, fullPage: true })
const dim = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }))
await b.close()
console.log('saved:', out, `(${dim.w}×${dim.h} CSS px · @2x)`)
