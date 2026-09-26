// 一次性：算「把场景里的 muted 小字换成 --text-dim」在 15 皮肤 × 浅深下是否都 ≥4.5
import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:5173/', { waitUntil: 'load' })
await p.waitForTimeout(500)
await p.locator('.splash-start-btn').click()
await p.waitForTimeout(400)
await p.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await p.waitForTimeout(1200)
await p.evaluate(() => {
  const pl = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
  pl.restaurant.level = 8
  pl.restaurant.menu = ['whiteBread', 'roastPotato', 'vegSalad', 'pumpkinPie']
  pl.orders = { list: [], nextAt: Date.now() - 1000 }
  document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui').setView('restaurant')
})
await p.waitForTimeout(2200)

const SKINS = ['classic', 'jade', 'sakura', 'matcha', 'salt', 'indigo', 'plum', 'tomato', 'cinnamon', 'amber', 'maroon', 'truffle', 'perilla', 'turmeric', 'ink']
// 把四个稀有态都造出来：食客订单（含一张料理不足的桌）/ 评论家雅座 / 米其林星 / 各有代表的装潢
await p.evaluate(() => {
  const pl = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
  pl.restaurant.decor = ['decor_124', 'decor_149', 'decor_175', 'decor_200', 'decor_224', 'decor_249', 'decor_274', 'decor_299']
  pl.orders = { list: [], nextAt: Date.now() - 1000 }
  pl.critic = { order: null, nextAt: Date.now() - 1000 }
  pl.michelin.stars = 2
})
for (let i = 0; i < 3; i++) {
  await p.evaluate(() => {
    const pl = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
    pl.orders.nextAt = Date.now() - 1000
  })
  await p.waitForTimeout(1500)
}
await p.evaluate(() => {
  const pl = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
  if (pl.orders.list[0]) { pl.orders.list[0].itemId = 'whiteBread'; pl.orders.list[0].qty = 3 }
  pl.inventory.whiteBread = 0
})

const MEASURE = () => {
  const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number)
  const lum = (c) => { const s = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }); return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2] }
  const blend = (fg, bg) => ({ r: fg[0] * (fg[3] ?? 1) + bg.r * (1 - (fg[3] ?? 1)), g: fg[1] * (fg[3] ?? 1) + bg.g * (1 - (fg[3] ?? 1)), b: fg[2] * (fg[3] ?? 1) + bg.b * (1 - (fg[3] ?? 1)) })
  const effBg = (el) => {   // 与 e2e-dark 同款：把所有祖先带 alpha 的底色**叠加**出来
    const stack = []
    let cur = el
    while (cur) { const q = parse(getComputedStyle(cur).backgroundColor); if (q.length >= 4 && q[3] > 0) stack.push(q); else if (q.length === 3) stack.push([...q, 1]); cur = cur.parentElement }
    stack.reverse()
    let base = { r: 26, g: 18, b: 12 }
    for (const s of stack) base = blend(s, base)
    return base
  }
  // 场景里已经**没有文字**（只有立绘、菜图、耐心条）⇒ 扫的是画外那些「玩家要读」的文案，
  // 重点是守卫扫不到的状态：有客人时的到店食客面板、满菜单、装潢下一件……
  const SEL = ['.restaurant-income', '.restaurant-upgrade-preview', '.restaurant-flow', '.restaurant-section',
    '.guest-name', '.guest-dish', '.guests-empty', '.menu-chip-name', '.menu-chip-rate',
    '.menu-pick-head', '.menu-pick-name', '.menu-pick-rate', '.menu-pick-clear', '.menu-pick-cancel',
    '.restaurant-decor-big', '.restaurant-decor-note', '.restaurant-decor-next', '.restaurant-decor-icons',
    '.restaurant-foot', '.restaurant-rules summary', '.special-note']
  const out = {}
  for (const sel of SEL) {
    const el = document.querySelector(sel)
    if (!el) { out[sel] = 'missing'; continue }
    const cs = getComputedStyle(el)
    const fg = parse(cs.color)
    const bg = effBg(el)
    const f = fg.length >= 4 && fg[3] < 1 ? blend(fg, bg) : { r: fg[0], g: fg[1], b: fg[2] }
    const L1 = lum([f.r, f.g, f.b]), L2 = lum([bg.r, bg.g, bg.b])
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 600
    const min = size >= 18.66 || (bold && size >= 14) ? 3 : 4.5
    out[sel] = +(ratio).toFixed(2)
    out[sel + '@px'] = Math.round(size) + 'px/' + (bold ? 'bold' : 'reg')
    if (ratio < min) out[sel] = out[sel] + '⚠️' + min
  }
  return out
}
for (const theme of ['light', 'dark']) {
  let worst = 99, bads = [], lows = []
  for (const skin of SKINS) {
    await p.evaluate(([th, sk]) => {
      const pl = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
      pl.settings.skin = sk
      if (th === 'dark') document.documentElement.dataset.theme = 'dark'
      else delete document.documentElement.dataset.theme
    }, [theme, skin])
    await p.waitForTimeout(150)
    const r = await p.evaluate(MEASURE)
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'number') {
        if (v < 4.6) lows.push({ skin, sel: k, v, px: r[k + '@px'] })
        worst = Math.min(worst, v)
      }
      else if (String(v).includes('⚠️')) bads.push(`${skin}${k}=${v}`)
    }
  }
  console.log(theme, '15 皮肤最低对比度', worst, bads.length ? '⚠️ ' + bads.join(' ') : '· 无低于阈值')
  console.log('   ' + theme + ' 最低那几处：', JSON.stringify(lows))
}
await b.close()
