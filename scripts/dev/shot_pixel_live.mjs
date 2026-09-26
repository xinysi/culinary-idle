// 像素美食 UI · **真实游戏**里挂上接入层看一眼（不改仓库一行）。
//
// 和 `shot_pixel_skin.mjs`（手工拼的控件条）的区别：这里跑的是**真 App**——
// 真侧栏 250px、真顶栏、真表格、真 38 个技能页、真弹窗。接入层的风险全在「叠上去之后在真实密度下长什么样」，
// 控件条测不出这一点（比如卡片自带 background 会在撕边外露出一圈方角光晕）。
//
// 做法：**运行时注入** `src/styles/pixel-skin.css` 的 <link>，不动 main.css（那一行由人决定何时加）。
// 顺带断言素材真的加载了 —— 静默 404 会让整层皮「看起来没生效」，那是本项目最讨厌的失效方式。
//
// 用法：node scripts/dev/shot_pixel_live.mjs            # 浅色 + 深色
//       node scripts/dev/shot_pixel_live.mjs --light    # 只浅色
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(root, 'docs', 'ui-pixel', '_check')
const BASE = 'http://localhost:5173/'

async function boot(page, dark) {
  await page.addInitScript((d) => {
    localStorage.setItem('culinary-idle.theme', d ? 'dark' : 'light')
  }, dark)
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(500)
  await page.locator('.splash-start-btn').click()
  await page.waitForTimeout(400)
  await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
  await page.waitForTimeout(900)
  // 注入接入层（用 url 形式，相对路径才会按 CSS 文件的位置解析）
  // `--no-skin`：只截**游戏自带**的浅/深主题（不挂像素套）——改深色 token 时的前后对照用这个
  if (!NO_SKIN) { await page.addStyleTag({ url: '/src/styles/pixel-skin.css' }); await page.waitForTimeout(600) }
}

/** 断言接入层真的生效：抽查一个帧的 border-image，并数一下素材请求失败数 */
async function verify(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.card') || document.querySelector('.main-scroll')
    const st = el ? getComputedStyle(el) : null
    const src = st ? (st.borderImageSource || '') : ''
    return {
      borderImage: /ui-food-pixel/.test(src) ? src.split('/').pop() : '(未生效: ' + src + ')',
      radius: st ? st.borderTopLeftRadius : '',
      pageBg: getComputedStyle(document.body).backgroundColor,
    }
  })
}

async function shot(page, dark, name) {
  const f = join(OUT, `${NO_SKIN ? 'base' : 'live'}-${dark ? 'dark' : 'light'}-${name}.png`)
  await page.screenshot({ path: f })
  console.log('  ', f)
}

const onlyLight = process.argv.includes('--light')
const NO_SKIN = process.argv.includes('--no-skin')
const browser = await chromium.launch()
fs.mkdirSync(OUT, { recursive: true })
for (const dark of onlyLight ? [false] : [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const failed = []
  page.on('requestfailed', (r) => failed.push(r.url()))
  page.on('response', (r) => { if (r.url().includes('ui-food-pixel') && r.status() >= 400) failed.push(r.status() + ' ' + r.url()) })
  console.log(dark ? '— 深色 —' : '— 浅色 —')
  await boot(page, dark)
  const v = await verify(page)
  console.log('   接入层：border-image =', v.borderImage, '· 圆角 =', v.radius, '· 页底 =', v.pageBg)
  await shot(page, dark, '01-首页')

  // 功能页：侧栏「功能」页签下的磁贴
  const sideTab = page.locator('.sidebar-tab', { hasText: '功能' })
  if (await sideTab.count()) {
    await sideTab.first().click()
    await page.waitForTimeout(300)
    // 功能页要先展开分组（e2e 里也是这么做的），否则磁贴是收起的
    for (const t of ['显示全部', '展开全部']) {
      const b = page.locator('.sidebar-tab, .btn, button', { hasText: t })
      if (await b.count()) { await b.first().click(); await page.waitForTimeout(300) }
    }
    for (const [label, tag] of [['商店', '02-商店'], ['图鉴', '03-图鉴'], ['成就', '04-成就'], ['小游戏', '05-小游戏']]) {
      const t = page.locator('.feature-tile', { hasText: label })
      if (await t.count()) {
        await t.first().click()
        await page.waitForTimeout(700)
        await shot(page, dark, tag)
      }
    }
  }
  // 技能页（真实密度最高的一种页）
  const sk = page.locator('.sidebar-tab', { hasText: '技能' })
  if (await sk.count()) {
    await sk.first().click()
    await page.waitForTimeout(300)
    for (const [label, tag] of [['采摘', '06-技能-采摘'], ['烹饪', '07-技能-烹饪']]) {
      const i = page.locator('.skill-item', { hasText: label })
      if (await i.count()) {
        await i.first().click()
        await page.waitForTimeout(700)
        await shot(page, dark, tag)
      }
    }
  }
  if (failed.length) console.log('   ⚠️ 失败请求', failed.length, failed.slice(0, 4))
  else console.log('   ✅ 素材请求零失败')

  // ── 验一个诊断：撕边外侧那圈「方角光晕」是不是**元素自带的 CSS 背景**透出来的 ──
  // 若是，把被挂帧的元素背景改成透明（面由素材的 fill 出）就该消失。这一步只在本页临时注入，不写仓库。
  const HALO_FIX = `
    .card, .gather-card, .panel, .main-scroll, .sidebar.app-sidebar, .sidebar-tab, .top-nav-btn,
    .badge, .btn, .btn-sm, .inv-bartop, .skill-item, .feature-tile, .mg-entry {
      background-color: transparent !important;
      background-image: none !important;
    }`
  if (NO_SKIN) { await ctx.close(); continue }
  await page.addStyleTag({ content: HALO_FIX })
  await page.waitForTimeout(500)
  await shot(page, dark, '09-去光晕后对比')
  await ctx.close()
}
await browser.close()
