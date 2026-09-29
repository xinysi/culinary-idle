// 线上核验（v2.29.2）—— 只查「只在本版出现的可见特征」，**不比对 chunk 哈希**
// （Pages 用自带 Node 构建，产物哈希与本地不一致，比哈希会误判成「没部署」；用 `?v=` 穿透 max-age=600）。
//
// 🔴 线上是**打包产物**：**不许 `import('/src/...')`**（生产里没有 /src，实测会直接
//    `Failed to resolve module specifier 'undefined'`）。要读状态只走 pinia（引擎单例不在 pinia 里）。
//
// 本版四个独有特征：
//   ① 挑战塔档位**第 4 档「饕餮」**（低等级时置灰 + 🔒）
//   ② 食神秘境**第 13 档**（低等级时 header 有「🔒 第 N 档需对决 LvX」提示）
//   ③ 效果总览「离线结算上限」的**基础随最高技能等级走**（满级档显示「基础 20」，旧版恒 12）
//   ④ 对决面板写明「另外两个流派各拿 1/3」
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2292'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push('console: ' + m.text()) })
await page.goto(URL_, { waitUntil: 'load' })
await page.waitForTimeout(1500)
await page.locator('.splash-start-btn').click()
await page.waitForTimeout(500)
await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await page.waitForTimeout(2200)

let bad = 0
const ok = (cond, label, detail) => { if (!cond) bad++; console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`) }

// ① 挑战塔：4 个档位按钮，第 4 个（饕餮）在「已解锁塔、但没到 Lv105」时锁定
//    combatLevel = ⌊(品鉴力 + 火候 + 最高风格) / 3⌋（getter，不能直接赋值 ⇒ 抬技能等级）
//    塔本身 Lv60 解锁 ⇒ 取 60：塔页渲染得出来，而饕餮（105）仍是锁的
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const p = pinia._s.get('player')
  p.skills.tasteAcumen.level = 60
  p.skills.heatControl.level = 60
  p.skills.knife.level = 60
  pinia._s.get('ui').activeView = 'tower'
})
await page.waitForTimeout(900)
const tierBtns = page.locator('.tower-tier-row button')
const nTiers = await tierBtns.count()
const lastTier = nTiers ? await tierBtns.nth(nTiers - 1).innerText() : ''
ok(nTiers === 4, '① 挑战塔档位按钮 = 4（本版新增第 4 档「饕餮」，旧版 3）', `实际 ${nTiers}`)
ok(/饕餮/.test(lastTier) && /🔒/.test(lastTier), '① 第 4 档是「饕餮」且在低等级下带 🔒（门槛 = 对决 Lv105）', lastTier.replace(/\n/g, ' '))

// ② 食神秘境：把存档档位顶到 13，低对决等级下应显示「🔒 第 11 档需对决 Lv105」
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const p = pinia._s.get('player')
  p.realm = { active: false, floor: 0, buffs: [], best: 0, pending: null, tier: 13 }
  pinia._s.get('ui').activeView = 'realm'
})
await page.waitForTimeout(900)
const realmHeader = await page.locator('.card').first().innerText()
ok(/第 \d+ 档/.test(realmHeader), '② 秘境页 header 显示「第 N 档」（本版 13 档体系）', (realmHeader.match(/第 \d+ 档[^\n]*/) ?? ['未找到'])[0])
ok(/第 11 档需对决 Lv105/.test(realmHeader), '② 低等级下的锁档提示指向第 11 档（旧版最多提示到第 10 档）', (realmHeader.match(/🔒[^\n]*/) ?? ['未找到'])[0])

// ③ 效果总览：满级档的「离线结算上限」基础 = 20（旧版恒显示 12）
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const p = pinia._s.get('player')
  p.skills.foraging.level = 120
  pinia._s.get('ui').activeView = 'effects'
})
await page.waitForTimeout(900)
// ⚠️ 这一行在**默认收起的 `FoldCard`（`<details>`）**里 ⇒ `innerText` 取不到（折叠 = 不渲染文本），
//    必须用 `textContent`（在 DOM 里，与是否展开无关）。
const offRow = await page.locator('.fx-row', { hasText: '离线结算上限' }).first().evaluate((el) => el.textContent ?? '')
ok(/基础 20/.test(offRow) && !/基础 12/.test(offRow), '③ 满级档（最高技能 120）下「离线结算上限」显示「基础 20」（旧版恒 12）', offRow.replace(/\s+/g, ' ').slice(0, 100))

// ④ 对决面板：副风格经验说明（比例从常数派生）
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  pinia._s.get('player').activeSkill = 'knife'
  pinia._s.get('ui').activeView = 'skill'
})
await page.waitForTimeout(900)
const note = await page.locator('p.style-note', { hasText: '另外两个流派' }).first().innerText().catch(() => '')
ok(/另外两个流派各拿\s*33%/.test(note), '④ 对决面板写明「另外两个流派各拿 33%」（本版新增说明）', note.replace(/\n/g, ' ').slice(0, 90))

ok(errs.length === 0, '页面零控制台错误', errs.slice(0, 3).join(' | '))
console.log(bad === 0 ? '\n线上核验通过' : `\n❌ 有 ${bad} 项不通过`)
await b.close()
process.exit(bad === 0 ? 0 : 1)
