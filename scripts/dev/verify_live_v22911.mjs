// 线上核验（v2.29.11）—— 直接抓线上 PNG 量「不透明占比」+「腐蚀后剩余」，不比对 chunk 哈希。
// 本版修的是 5 件「去背挖空」（宣纸/棉麻叠布/贝壳扣/珍珠皂/天香净皂）：
// 空心时这两个数都低得离谱（宣纸 15%/20%、贝壳扣 43%/35%），修好后应回到同族水平（≥60% / ≥75%）。
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=22911'
const ITEMS = [
  ['宣纸', 55, 70], ['棉麻叠布', 60, 70], ['贝壳扣', 60, 70], ['珍珠皂', 65, 72], ['天香净皂', 55, 70],
]
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push('console: ' + m.text()) })
await page.goto(URL_, { waitUntil: 'load' })
await page.waitForTimeout(1200)

let bad = 0
const ok = (c, l, d) => { if (!c) bad++; console.log(`${c ? '✅' : '❌'} ${l}${d ? ' — ' + d : ''}`) }

const res = await page.evaluate(async (names) => {
  const out = []
  for (const name of names) {
    const url = new URL(`images/items/food/${name}.png`, location.href).href
    try {
      const blob = await (await fetch(url, { cache: 'no-store' })).blob()
      const bmp = await createImageBitmap(blob)
      const c = document.createElement('canvas')
      c.width = bmp.width; c.height = bmp.height
      const g = c.getContext('2d')
      g.drawImage(bmp, 0, 0)
      const d = g.getImageData(0, 0, c.width, c.height).data
      const N = c.width * c.height
      const solid = new Array(N)
      let n = 0
      for (let i = 0; i < N; i++) { solid[i] = d[i * 4 + 3] > 8; if (solid[i]) n++ }
      // 腐蚀 2px（在页面里手算：某像素的 5×5 邻域全是不透明才算存活）
      let er = 0
      for (let y = 2; y < c.height - 2; y++) for (let x = 2; x < c.width - 2; x++) {
        let all = true
        for (let dy = -2; dy <= 2 && all; dy++) for (let dx = -2; dx <= 2; dx++) {
          if (!solid[(y + dy) * c.width + (x + dx)]) { all = false; break }
        }
        if (all) er++
      }
      out.push([name, n / N, er / Math.max(1, n), bmp.width, bmp.height])
    } catch (e) { out.push([name, -1, -1, 0, 0]) }
  }
  return out
}, ITEMS.map(([n]) => n))

for (let i = 0; i < ITEMS.length; i++) {
  const [name, solidFloor, erFloor] = ITEMS[i]
  const [, solid, er, w, h] = res[i]
  ok(solid * 100 >= solidFloor && er * 100 >= erFloor,
    `${name}：实心 ≥${solidFloor}% 且腐蚀后剩 ≥${erFloor}%（空心时会远低于此）`,
    `实心 ${(solid * 100).toFixed(1)}% / 腐蚀后剩 ${(er * 100).toFixed(1)}%（${w}×${h}）`)
}
ok(errs.length === 0, '页面零控制台错误', errs.slice(0, 3).join(' | '))
await b.close()
console.log(bad === 0 ? '\n线上核验通过' : `\n线上核验失败：${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
