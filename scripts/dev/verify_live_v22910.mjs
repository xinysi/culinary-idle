// 线上核验（v2.29.10）—— 只查「只在本版出现的特征」，**不比对 chunk 哈希**
// （Pages 用自带 Node 构建，产物哈希与本地不一致；用 `?v=` 穿透 max-age=600）。
//
// 本版特征：v2.29.9 那 46 张图被去背**挖空**（只剩外壳），本版用
// `--bg white --closing 0` 重跑修好 ⇒ 直接**抓线上的 PNG、量不透明占比**：
// 空心时这个数会低得离谱（雪麦鲈鱼汤只剩一把勺子 ≈ 10%），正常在 45~78% 之间。
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=22910'
// 这 8 张是本版修好的、且**空心时占比极低**的（其余按同类阈值兜底）
const ITEMS = [
  ['雪麦鲈鱼汤', 45], ['霜兔鱼酥', 60], ['雪玉藕', 35], ['白泽霜果', 36],
  ['霜玉薯', 55], ['白泽霜鹿', 55], ['霜鳞鲤', 48], ['九天玉茭种子', 20],
]
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push('console: ' + m.text()) })
await page.goto(URL_, { waitUntil: 'load' })
await page.waitForTimeout(1200)

let bad = 0
const ok = (cond, label, detail) => { if (!cond) bad++; console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`) }

const ratios = await page.evaluate(async (items) => {
  const out = []
  for (const [name, sub] of items) {
    const url = new URL(`images/items/${sub}/${name}.png`, location.href).href
    try {
      const blob = await (await fetch(url, { cache: 'no-store' })).blob()
      const bmp = await createImageBitmap(blob)
      const c = document.createElement('canvas')
      c.width = bmp.width; c.height = bmp.height
      const g = c.getContext('2d')
      g.drawImage(bmp, 0, 0)
      const d = g.getImageData(0, 0, c.width, c.height).data
      let solid = 0
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) solid++
      out.push([name, solid / (c.width * c.height * 1.0), bmp.width, bmp.height])
    } catch (e) {
      out.push([name, -1, 0, 0])
    }
  }
  return out
}, ITEMS.map(([n]) => [n, n.endsWith('种子') ? 'seed' : 'food']))

for (let i = 0; i < ITEMS.length; i++) {
  const [name, floor] = ITEMS[i]
  const [, ratio, w, h] = ratios[i]
  ok(ratio * 100 >= floor, `${name} 不透明占比 ≥ ${floor}%（空心时会远低于此）`,
    `实测 ${(ratio * 100).toFixed(1)}%（${w}×${h}）`)
}

ok(errs.length === 0, '页面零控制台错误', errs.slice(0, 3).join(' | '))
await b.close()
console.log(bad === 0 ? '\n线上核验通过' : `\n线上核验失败：${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
