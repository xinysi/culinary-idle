// 换肤期的目测工具：把真实页面按「皮肤 × 浅/深」跑一遍并截图。
//
// 为什么必须看真实页面：换肤只改 CSS，静态扫不出「撕边压到文字」「遮罩切到文案」「深色下纸白刺眼」
// 这类问题 —— 它们只有在真渲染里才现形（本轮就是靠它发现纸框宽度需要按控件内边距夹取）。
//
// 用法：
//   node scripts/dev/shot_ui_theme.mjs                 # 默认 4 皮肤 × 浅/深 × 5 页
//   node scripts/dev/shot_ui_theme.mjs --views=gathering,combat
//   node scripts/dev/shot_ui_theme.mjs --skins=classic,jade --themes=light
// 产物：docs/ui-mockup/换肤-<皮肤>-<主题>-<页>.png（整页）
import fs from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(root, 'docs/ui-mockup')
const BASE = process.env.UI_BASE || 'http://localhost:5173/'

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split('=')[1] : d
}
// 页面写法：功能页用合法 view key；技能页写 `skill:<技能 id>`（对决/制作都不是 view，
// 它们是技能页 —— 只 setView('combat') 会静默兜底到采摘页，截出来的图完全一样）。
// 合法 view key 见 `src/stores/ui.js` 的 VIEW_KEYS；技能 id 见 `src/game/data/skills.js`。
const VIEWS = arg('views', 'skill:foraging,skill:knife,inventory,shop,logs').split(',').filter(Boolean)
const SKINS = arg('skins', 'classic,jade,ink,amber').split(',').filter(Boolean)
const THEMES = arg('themes', 'light,dark').split(',').filter(Boolean)

/** 进入游戏并灌一份满档数据（照 e2e-layout 的做法：空档很多页是空状态，看不出问题） */
async function enterGame(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await page.locator('.splash-start-btn').click()
  await page.waitForTimeout(300)
  await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
  await page.waitForTimeout(1100)
  await page.evaluate(async () => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
    const player = pinia._s.get('player')
    const items = (await import('/src/game/data/items.js')).ITEMS
    for (const [id, it] of Object.entries(items)) if (it.type !== 'spirit') player.inventory[id] = 999
    player.gold = 1e9
    player.gameCoins = 1e6
    for (const id of Object.keys(player.skills)) { player.skills[id].level = 120; player.skills[id].prestiges = 12 }
    const { ALL_ACHIEVEMENTS } = await import('/src/game/data/achievements.js')
    player.achievements = ALL_ACHIEVEMENTS.map((a) => a.id) // 160 条 ⇒ 15 套皮肤全解锁
    const { REGIONS } = await import('/src/game/data/regions.js')
    for (const r of REGIONS) player.regions[r.id] = true
    const { REGULARS } = await import('/src/game/data/regulars.js')
    for (const r of REGULARS) player.regulars[r.id] = { serves: 99, lastDay: null, giftClaimed: false }
    player.restaurant.level = 10
  })
  await page.waitForTimeout(400)
}

/** 切皮肤 / 主题：走 App 自己那条路（行内变量 + data-theme），不碰存档 */
async function applyLook(page, skin, theme) {
  await page.evaluate(async ({ skin, theme }) => {
    const m = await import('/src/game/data/skins.js')
    m.applySkinToDom(skin, theme)
    if (theme === 'dark') document.documentElement.dataset.theme = 'dark'
    else delete document.documentElement.dataset.theme
  }, { skin, theme })
  await page.waitForTimeout(260)
}

const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })

await enterGame(page)
fs.mkdirSync(OUT, { recursive: true })
let n = 0
for (const skin of SKINS) {
  for (const theme of THEMES) {
    await applyLook(page, skin, theme)
    for (const view of VIEWS) {
      const [kind, id] = view.split(':')
      await page.evaluate(async (p) => {
        const app = document.querySelector('#app').__vue_app__
        const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
        if (p.id) {
          // ⚠️ 技能页要切的是 **player 的 setActiveSkill**（不是 ui 上的字段）——
          //    写成 `ui.activeSkill = id` 不报错、也不生效，截出来的还是上一个技能页。
          pinia._s.get('player').setActiveSkill(p.id)
          pinia._s.get('ui').setView('skill')
        } else {
          pinia._s.get('ui').setView(p.kind)
        }
      }, { kind, id })
      await page.waitForTimeout(460)
      // 奇遇等随机浮层会盖住页面（e2e-layout 也踩过）⇒ 截图前先点掉
      await page.evaluate(() => {
        const bd = document.querySelector('.modal-backdrop')
        if (bd) bd.click()
      })
      await page.waitForTimeout(160)
      const f = join(OUT, `换肤-${skin}-${theme}-${view.replace(/:/g, '-')}.png`)
      await page.screenshot({ path: f })
      n++
    }
  }
}
await b.close()
console.log(`截图 ${n} 张 → ${OUT}`)
if (errs.length) console.log('页面错误:', [...new Set(errs)].slice(0, 4))
