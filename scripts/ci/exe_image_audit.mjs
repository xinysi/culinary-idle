// 全量图片加载审计（Electron 打开 = exe 的 file:// 解析语义）——**本地发布 exe 前必跑**，不进 CI（CI 无 Electron 运行时）
// ① 静态：把 src 里所有图片 URL 字面量抠出来（含目录前缀展开），逐个探活（相对/绝对两种写法）
// ② 运行时：逐页扫 <img> 与 CSS 背景图，真的去 load 一次再判定损坏
// 用法：node scripts/ci/exe_image_audit.mjs dev      # 用 lmewexe/dist 的 Electron 壳（快）
//       node scripts/ci/exe_image_audit.mjs packaged # 用 release/ 下已打包的 exe（发布前终检）
// 判定：① 逐页真的 load 一次 <img> 与 CSS 背景图，损坏即列 ② 静态清单探活「相对/绝对」两种写法
import { _electron } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const MODE = process.argv[2] || 'dev'
const ROOT = 'D:/plays/lmew'
const DEV_EXE = ROOT + '/lmewexe/node_modules/electron/dist/electron.exe'
const PACKED_EXE = ROOT + '/lmewexe/release/美食放置：食灵山海-win32-x64/美食放置：食灵山海.exe'

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(vue|js|css|html)$/.test(e.name)) out.push(p)
  }
  return out
}
const literal = new Set()
const prefixes = new Set()
for (const f of [...walk(ROOT + '/src'), ROOT + '/index.html']) {
  const t = fs.readFileSync(f, 'utf8')
  for (const m of t.matchAll(/['"`](\/?images\/[^'"`\n]{1,120}?\.(?:png|jpe?g|gif|webp|svg))['"`]/gi)) literal.add(m[1])
  for (const m of t.matchAll(/['"`](\/?(?:images|assets)\/[^'"`\n]{0,80}?\/)['"`]/gi)) prefixes.add(m[1])
  for (const m of t.matchAll(/url\((['"]?)(\/?[^'")]+\.(?:png|jpe?g|gif|webp|svg))\1\)/gi)) literal.add(m[2])
}
const list = new Set(literal)
for (const pre of prefixes) {
  if (pre.includes('${')) continue
  const dir = path.join(ROOT + '/public', pre.replace(/^\//, ''))
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir)) if (/\.(png|jpe?g|gif|webp|svg)$/i.test(f)) list.add(pre + f)
}

const VIEWS = [
  'skill', 'shop', 'deluxe', 'alchemy', 'expedition', 'regions', 'ranch', 'cellar', 'automation',
  'kitchenNotes', 'flavorBook', 'schools', 'michelin', 'staff', 'branches', 'exchange', 'regulars',
  'trials', 'gearContest', 'minigames', 'festival', 'legacy', 'patrons', 'spiritStories', 'restaurant',
  'guild', 'season', 'arena', 'tower', 'fest', 'mijian', 'stats', 'log', 'guide',
  'milestones', 'chronicle', 'weather', 'mascot', 'banquet', 'takeout',
  'suppliers', 'chefChallenge', 'seasonReview', 'honor', 'codexExchange', 'setMeals', 'rivals',
  'gear', 'quests', 'achievements', 'realm', 'decor', 'mail', 'logs', 'market', 'friends',
  'today', 'story', 'cards', 'encounters', 'dao', 'shanhai', 'effects', 'caravan', 'mycoField', 'greenhouse',
]
const MODALS = ['bag', 'bank', 'equip', 'settings', 'save', 'signin']
const SIDELINE = ['woodworking', 'pottery', 'weaving', 'embroidery', 'candles', 'fletching', 'netmaking',
  'incense', 'festivalGoods', 'jadecraft', 'goodsTag', 'miningGear', 'papermaking', 'instrument', 'soapmaking', 'exchequer']

async function scanImages() {
  const out = { seen: 0, broken: [] }
  const urls = []
  for (const im of [...document.querySelectorAll('img')]) {
    const src = im.getAttribute('src')
    if (!src) continue
    out.seen++
    urls.push({ url: src, cls: String(im.className || ''), kind: 'img' })
  }
  for (const el of [...document.querySelectorAll('*')]) {
    const bg = getComputedStyle(el).backgroundImage
    if (!bg || bg === 'none') continue
    for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (!/\.(png|jpe?g|gif|webp|svg)/i.test(m[1])) continue
      out.seen++
      urls.push({ url: m[1], cls: String(el.className || ''), kind: 'bg' })
    }
  }
  const load = (u) =>
    new Promise((res) => {
      const i = new Image()
      i.onload = () => res(i.naturalWidth > 0)
      i.onerror = () => res(false)
      i.src = u
      setTimeout(() => res(false), 3000)
    })
  const results = await Promise.all(urls.map((u) => load(u.url)))
  urls.forEach((u, i) => {
    if (!results[i]) out.broken.push(u)
  })
  return out
}

const app =
  MODE === 'packaged'
    ? await _electron.launch({ executablePath: PACKED_EXE })
    : await _electron.launch({ executablePath: DEV_EXE, args: ['.'], cwd: ROOT + '/lmewexe' })
const page = await app.firstWindow()
await page.waitForTimeout(3000)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(700)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.locator('.app-layout').waitFor({ timeout: 25000 })
await page.waitForTimeout(1500)

const statics = await page.evaluate(async (lst) => {
  const load = (u) =>
    new Promise((res) => {
      const i = new Image()
      i.onload = () => res(i.naturalWidth > 0)
      i.onerror = () => res(false)
      i.src = u
      setTimeout(() => res(false), 3000)
    })
  const out = []
  for (const u of lst) {
    const rel = u.replace(/^\//, '')
    const r = await load(rel)
    const a = u.startsWith('/') ? await load(u) : null
    out.push({ url: u, rel: r, abs: a })
  }
  return out
}, [...list])

const setView = (v, sid) =>
  page.evaluate(
    ([vv, ss]) => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      pinia._s.get('ui').setView(vv)
      if (ss) pinia._s.get('player').setActiveSkill(ss)
    },
    [v, sid]
  )

const seenPages = []
const broken = []
const record = async (name) => {
  const r = await page.evaluate(scanImages)
  seenPages.push({ name, seen: r.seen })
  for (const b of r.broken) broken.push({ page: name, ...b })
}
for (const v of VIEWS) {
  await setView(v)
  await page.waitForTimeout(260)
  await record(v)
}
for (const sid of SIDELINE) {
  await setView('skill', sid)
  await page.waitForTimeout(260)
  await record('sideline:' + sid)
}
for (const m of MODALS) {
  await page.evaluate((mm) => {
    const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui')
    if (mm === 'bag') ui.toggleBagModal(true, 'bag')
    else if (mm === 'bank') ui.toggleBagModal(true, 'bank')
    else if (mm === 'equip') ui.toggleEquipModal(true)
    else if (mm === 'settings') ui.toggleSettingsPanel(true)
    else if (mm === 'save') ui.toggleSavePanel(true)
    else if (mm === 'signin') ui.toggleSignIn(true)
  }, m)
  await page.waitForTimeout(380)
  await record('modal:' + m)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
}

await page.evaluate(() => {
  const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui')
  ui.toggleBagModal(false); ui.toggleEquipModal(false); ui.toggleSettingsPanel(false); ui.toggleSavePanel(false); ui.toggleSignIn(false)
  ui.setView('minigames')
})
await page.waitForTimeout(800)
const pager = page.locator('.mg-pager button, .mg-page-btn, .mg-nav button')
const pagerN = await pager.count()
for (let p = 0; p < Math.max(1, pagerN); p++) {
  if (pagerN) {
    await pager.nth(p).click({ force: true }).catch(() => {})
    await page.waitForTimeout(350)
  }
  const n = await page.locator('.mg-entry').count()
  for (let i = 0; i < n; i++) {
    const label = ((await page.locator('.mg-entry').nth(i).innerText().catch(() => '')) || '').split('\n')[0]
    await page.locator('.mg-entry').nth(i).click({ force: true }).catch(() => {})
    await page.waitForTimeout(800)
    await record('mg:' + label)
  }
}

const byUrl = {}
for (const b of broken) {
  byUrl[b.url] = byUrl[b.url] || { n: 0, pages: new Set(), kind: b.kind }
  byUrl[b.url].n++
  byUrl[b.url].pages.add(b.page)
}
const seenTotal = seenPages.reduce((n, p) => n + p.seen, 0)
console.log('模式:', MODE)
console.log('扫描页面:', seenPages.length, '｜图片引用:', seenTotal, '｜损坏:', broken.length, '｜不同 URL:', Object.keys(byUrl).length)
for (const [u, v] of Object.entries(byUrl).sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  [${v.n} 处 ${v.kind}] ${u.slice(0, 100)}  ← ${[...v.pages].slice(0, 8).join(', ')}`)
}
const relFail = statics.filter((s) => !s.rel)
const absOnly = statics.filter((s) => s.rel && s.abs === false)
console.log(`静态清单 ${statics.length} 条｜相对加载失败 ${relFail.length} 条｜「相对 OK 但绝对 FAIL（exe 里必坏）」${absOnly.length} 条`)
for (const s of relFail.slice(0, 20)) console.log('   相对也失败:', s.url)
for (const s of absOnly.slice(0, 40)) console.log('   绝对路径会坏:', s.url)
await app.close()
