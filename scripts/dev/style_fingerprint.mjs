// 计算样式指纹工具（开发/验收用，**不进 CI**）
//
// 用途：改 token / 皮肤 / 样式后，证明「原味渲染零差异」或看清「到底哪些元素变了」。
// AGENTS.md 把「逐元素计算样式指纹比对」写成必做验收手法，但此前只有方法没有脚本 —— 这是那个工具。
//
// 依赖 dev server（默认 http://localhost:5173/）：
//   node scripts/dev/style_fingerprint.mjs dump .fingerprint/before.json classic light
//   …改样式…
//   node scripts/dev/style_fingerprint.mjs dump .fingerprint/after.json  classic light
//   node scripts/dev/style_fingerprint.mjs diff .fingerprint/before.json .fingerprint/after.json
//
// ⚠️ **必须做「改后 vs 改后」的对照组**：页面里有过渡/光晕动画（实测 arena 的流派按钮与
//    mijian 的抽卡光晕），同一份代码连跑两次也会有十几处亚像素级差异。判定真回归的办法是：
//     diff before after  ≈  diff after after2   ⇒ 全是噪声，改动零影响
//   只有当 before/after 多出来的差异**不在** after/after2 里，才算真变化。
import fs from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:5173/'
const PROPS = [
  'color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
  'boxShadow', 'textShadow', 'fill', 'stroke', 'backgroundImage', 'outlineColor', 'caretColor', 'textDecorationColor',
]

const [mode, ...rest] = process.argv.slice(2)

if (mode === 'diff') {
  const [a, b] = rest
  const A = JSON.parse(fs.readFileSync(a, 'utf8'))
  const B = JSON.parse(fs.readFileSync(b, 'utf8'))
  const diffs = []
  for (const v of Object.keys(A)) {
    const ea = A[v].out ?? {}
    const eb = B[v]?.out ?? {}
    for (const k of new Set([...Object.keys(ea), ...Object.keys(eb)])) {
      if (!ea[k]) { diffs.push({ v, k, prop: '(新增元素)', from: '', to: '(新)' }); continue }
      if (!eb[k]) { diffs.push({ v, k, prop: '(元素消失)', from: '(有)', to: '' }); continue }
      for (let i = 0; i < PROPS.length; i++) if (ea[k][i] !== eb[k][i]) diffs.push({ v, k, prop: PROPS[i], from: ea[k][i], to: eb[k][i] })
    }
  }
  const countEl = (X) => Object.values(X).reduce((s, v) => s + Object.keys(v.out ?? {}).length, 0)
  console.log(`元素数 A=${countEl(A)} B=${countEl(B)}`)
  console.log(`差异: ${diffs.length}`)
  const byProp = new Map()
  for (const d of diffs) byProp.set(d.prop, (byProp.get(d.prop) ?? 0) + 1)
  for (const [p, n] of [...byProp].sort((x, y) => y[1] - x[1])) console.log(`   ${p}: ${n}`)
  const seen = new Set()
  for (const d of diffs) {
    const key = `${d.v}|${d.prop}|${d.from}→${d.to}`
    if (seen.has(key)) continue
    seen.add(key)
    console.log(`   ${d.v} | ${d.k} | ${d.prop}: ${d.from} → ${d.to}`)
  }
  const va = A[Object.keys(A)[0]]?.vars ?? {}
  const vb = B[Object.keys(B)[0]]?.vars ?? {}
  console.log('CSS 变量 新增:', Object.keys(vb).filter((k) => !(k in va)).join(' ') || '（无）')
  console.log('CSS 变量 变化:', Object.keys(vb).filter((k) => k in va && va[k] !== vb[k]).map((k) => `${k}: ${va[k]}→${vb[k]}`).join(' | ') || '（无）')
  console.log('CSS 变量 删除:', Object.keys(va).filter((k) => !(k in vb)).join(' ') || '（无）')
  process.exit(0)
}

// ── dump ──
const OUT = rest[0] ?? '.fingerprint/dump.json'
const SKIN = rest[1] ?? 'classic'
const THEME = rest[2] ?? 'light'
const uiSrc = fs.readFileSync('src/stores/ui.js', 'utf8')
const blk = uiSrc.slice(uiSrc.indexOf('export const VIEW_KEYS = ['), uiSrc.indexOf(']', uiSrc.indexOf('export const VIEW_KEYS = [')))
const VIEWS = [...blk.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1])

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(300)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(1000)
// 灌满档：空档很多页是空状态，扫不到真正的样式
await page.evaluate(async ({ skin, theme }) => {
  const el = document.querySelector('#app')
  const app = el.__vue_app__
  const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
  const p = pinia._s.get('player')
  const items = (await import('/src/game/data/items.js')).ITEMS
  for (const [id, it] of Object.entries(items)) { if (it.type !== 'spirit') p.inventory[id] = 999 }
  p.gold = 1e9
  p.gameCoins = 1e6
  for (const id of Object.keys(p.skills)) { p.skills[id].level = 120; p.skills[id].prestiges = 12 }
  const { ALL_ACHIEVEMENTS } = await import('/src/game/data/achievements.js')
  p.achievements = ALL_ACHIEVEMENTS.map((a) => a.id)
  const { SHANHAI_NODES } = await import('/src/game/data/shanhaiTree.js')
  p.shanhaiUnlocked = SHANHAI_NODES.map((n) => n.id)
  const { INSIGHT_NODES } = await import('/src/game/data/insightTree.js')
  p.insights = INSIGHT_NODES.map((n) => n.id)
  const { DAO_NODES } = await import('/src/game/data/daoTree.js')
  p.daoUnlocked = DAO_NODES.map((n) => n.id)
  const { REGULARS } = await import('/src/game/data/regulars.js')
  for (const r of REGULARS) p.regulars[r.id] = { serves: 99, lastDay: null, giftClaimed: false }
  const { REGIONS } = await import('/src/game/data/regions.js')
  for (const r of REGIONS) p.regions[r.id] = true
  const { EXPEDITIONS } = await import('/src/game/data/expeditions.js')
  for (const e of EXPEDITIONS) p.expeditions[e.id] = { completions: 9, slots: [{ startedAt: Date.now() - 3600e3, readyAt: Date.now() - 60e3 }] }
  p.restaurant.level = 10
  p.tower.floor = 50; p.tower.best = 40
  p.michelin.score = 300; p.michelin.stars = 3
  p.mijian.tickets = 55
  p.settings.skin = skin
  p.settings.theme = theme
  document.documentElement.dataset.theme = theme
  const { applySkinToDom } = await import('/src/game/data/skins.js')
  applySkinToDom?.(skin, theme)
}, { skin: SKIN, theme: THEME })
await page.waitForTimeout(600)

const DUMP = `(() => {
  const PROPS = ${JSON.stringify(PROPS)}
  const path = (el) => {
    const seg = []
    let p = el
    while (p && p !== document.body) { let i = 1, s = p; while ((s = s.previousElementSibling)) i++; seg.unshift(p.tagName.toLowerCase() + ':' + i); p = p.parentElement }
    return seg.join('>')
  }
  const out = {}
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    const vals = PROPS.map((k) => cs[k])
    const interesting = vals.some((v, i) => v && v !== 'rgba(0, 0, 0, 0)' && v !== 'none' && v !== 'normal' && v !== 'rgb(0, 0, 0)' && !(i === 10 && v === 'none'))
    if (!interesting) continue
    out[path(el)] = vals
  }
  const vars = {}
  const rootCs = getComputedStyle(document.documentElement)
  for (const name of Array.from(rootCs)) if (name.startsWith('--')) vars[name] = rootCs.getPropertyValue(name).trim()
  return { out, vars }
})()`

const fp = {}
for (const v of VIEWS) {
  await page.evaluate((vv) => {
    const el = document.querySelector('#app')
    const app = el.__vue_app__
    const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
    pinia._s.get('ui').setView(vv)
  }, v)
  await page.waitForTimeout(360)
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('.main-scroll details')) d.open = true
    for (const el of document.querySelectorAll('.main-scroll *')) {
      if (el.tagName === 'SUMMARY') continue
      const t = (el.textContent || '').trim()
      if (t === '展开' || t === '更多') { try { el.click() } catch { /* 忽略 */ } }
    }
  })
  await page.waitForTimeout(280)
  fp[v] = await page.evaluate(DUMP)
}
const dir = OUT.includes('/') ? OUT.slice(0, OUT.lastIndexOf('/')) : ''
if (dir) fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(fp))
const total = Object.values(fp).reduce((s, v) => s + Object.keys(v.out).length, 0)
console.log(`已写 ${OUT} — 皮肤 ${SKIN} / 主题 ${THEME} · 视图 ${Object.keys(fp).length} · 元素 ${total} · 变量 ${Object.keys(fp[VIEWS[0]].vars).length}`)
await browser.close()
