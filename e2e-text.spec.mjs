import { test, expect } from '@playwright/test'
import { SKILL_DEFS } from './src/game/data/skills.js'

// 全窗口「前端标记裸露」扫描（2026-09-12 立）— 逐页渲染后，把可见文本里出现 HTML 标签残留 / JS 占位符的地方全部点名。
// 起因：攻略「总览」的富文本 desc 用 {{ }} 插值，把 <b> 当纯文本显示出来（应为 v-html）。
// 覆盖面：左栏全部功能页 + 6 个常用弹窗 + **页内页签行**（.region-tabs / .*-tabs，纯导航、无副作用）——
// ⚠️ 页签必须点开：攻略「总览」藏在页签里，只调 setView('guide') 是扫不到的（第一版本就漏在这里，靠反向验证才发现）。
// 判定为「0 命中」；命中即 FAIL 并逐条打印 页面/元素/文本片段。
// 自检要求：任何一次改动后，请用「把已知正确处改回 {{ }}」的反例确认本扫描仍然会报错（否则等于不设防）。
// 全部 38 个技能页（`skill` 视图只渲染「当时激活的那一个技能」⇒ 不切 activeSkill 就一次都扫不到）。
// ⚠️ 此前这里硬编码的只有**副业 16 支**，于是对决的 6 个 combat 技能页（CombatView）从没被扫过 ——
//    玩家报「对决，敌人的掉落看不到了」（dropModal 漏声明）就是从这个盲区溜出去的。现改为从 SKILL_DEFS 派生。
const SKILL_IDS = Object.keys(SKILL_DEFS)

const VIEWS = [
  // 2026-09-19：厨藏/装备升级为独立页面后加入扫描
  'inventory', 'equipment',
  'skill', 'shop', 'deluxe', 'alchemy', 'expedition', 'regions', 'ranch', 'cellar', 'automation',
  'kitchenNotes', 'flavorBook', 'schools', 'michelin', 'staff', 'branches', 'exchange', 'regulars',
  'trials', 'gearContest', 'minigames', 'festival', 'legacy', 'patrons', 'spiritStories', 'restaurant',
  'guild', 'season', 'arena', 'tower', 'fest', 'mijian', 'stats', 'log', 'guide',
  'milestones', 'chronicle', 'weather', 'mascot', 'banquet', 'takeout', 'suppliers', 'chefChallenge',
  'seasonReview', 'honor', 'codexExchange', 'setMeals', 'rivals', 'gear', 'quests', 'achievements',
  'realm', 'decor', 'mail', 'logs', 'market', 'friends', 'today', 'story', 'cards', 'encounters', 'dao', 'shanhai',
  // 2026-09-14 挂机产线四套
  'caravan', 'mycoField', 'greenhouse',
  // 2026-09-16 效果总览（今日组）
  'effects',
]
// 2026-09-19：厨藏/装备由弹窗升级为独立页面 ⇒ 从弹窗清单移除（它们现在由 VIEWS 轮覆盖）
const MODALS = ['settings', 'save', 'signin', 'guide'] // guide=技能页指南弹窗（2026-09-19 新增）

const PATTERNS = [
  { name: 'HTML 标签残留', re: /<\/?(b|strong|span|br|i|em|code|a|small|u|div|p)\b[^>]*>/i },
  { name: '未渲染的插值', re: /\{\{[^}]{1,40}\}\}/ },
  { name: '未求值的模板串', re: /\$\{[a-zA-Z_$]/ },
  { name: '对象转字符串', re: /\[object Object\]/ },
  { name: 'undefined 泄漏', re: /\bundefined\b/ },
  { name: 'NaN 泄漏', re: /\bNaN\b/ },
  { name: 'HTML 实体残留', re: /&lt;|&gt;/ },
  // markdown 粗体裸奔（2026-09-22 立）：项目**没有**通用 markdown 渲染器，数据或模板里写 `**x**` 会**原样显示给玩家**
  // （当天在塔页说明与战斗面板各写了一次）。静态守卫只扫数据模块，模板文本扫不到 ⇒ 这里补上运行时那一半。
  { name: 'markdown 粗体残留', re: /\*\*[^*\n]{1,40}\*\*/ },
  // 英文标识符裸露（2026-09-13 用户报「很多页面出现 tier」后立）：内部字段名不该出现在界面上
  { name: '英文标识符裸露', re: /(tier|minTier|tierReq|reqLevel|itemId|itemQty|pct|undefined|NaN|foraging|fishing|hunting|excavation|cooking|baking|brewing|preserving|spiceMixing|craftsmithing)/ },
]

/** 页内扫描（真函数，序列化后传进浏览器） */
function scanText(pats) {
  const out = []
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n
  while ((n = walk.nextNode())) {
    const t = n.nodeValue
    if (!t || !t.trim()) continue
    for (const p of pats) {
      if (new RegExp(p.re, p.flags ?? '').test(t)) {
        out.push({ pat: p.name, text: t.trim().slice(0, 100), where: n.parentElement?.className || n.parentElement?.tagName, n: document.body.innerText.length })
        break
      }
    }
  }
  return out
}

// 并行切片（2026-09-21）：原来一个 test 串行扫「全部页面 + 副业技能页 + 弹窗」，
// 现在按页切成 `E2E_SLICES`（默认 4）片 + 1 个弹窗/副业 test 并行跑。`E2E_SLICES=1` 退回串行。
test.describe.configure({ timeout: 240000, mode: 'parallel' })

const SLICES = Math.max(1, Number(process.env.E2E_SLICES || 4))

/** 进游戏 + 种入代表性数据（各切片都要） */
async function enterGameText(page) {
  await page.goto('http://localhost:5173')
  await page.waitForTimeout(600)
  await page.locator('.splash-start-btn').click()
  await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
  await expect(page.locator('.app-layout')).toBeVisible()
  await page.waitForTimeout(1000)
  // 种入代表性数据：空档上大量 UI 不渲染，会漏掉数据驱动的文本
  await page.evaluate(() => {
  const pin = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const p = pin._s.get('player')
  const gear = { weapon: 'copperKnife', helmet: 'copperHat', body: 'copperApron', legs: 'smith_铜_legs', boots: 'smith_铜_boots', offhand: 'copperPot', amulet: 'copperBottle', ring: 'smith_铜_ring' }
  for (const [slot, id] of Object.entries(gear)) { p.inventory[id] = 1; p.equipment[slot] = id }
  p.gearMods.copperKnife = { mods: [{ stat: 'goldPct', label: '金币', value: 0.63 }], at: Date.now() } // 词条按装备 id 存
  p.gemSockets.weapon = { itemId: 'copperKnife', gems: ['goldOre'] }
  p.inventory.apple = 50; p.inventory.wheat = 30; p.inventory.mysterySpice = 3
  p.inventory.energyBiscuit = 2; p.inventory.trap = 20
  p.upgrades.copperKnife = 2; p.gold = 250000; p.tastePoints = 500
  p.guild = { id: 'umami', points: 120, day: null, taskProgress: {} }
  p.collected = { ...p.collected, apple: 1, wheat: 1, copperKnife: 1 }
  p.ranch.pens = [{ animalId: 'chicken', lastAt: Date.now() }, null]
  p.branches = { east: { lastAt: Date.now(), manager: true } }
  p.staff = { chef: { level: 2, lastPayAt: Date.now(), unpaid: false } }
  p.regions = { plain: true }; p.regionPosting = { fishery: 'plain' }
  p.schools = { s_main: { level: 2, research: null } }
  p.patron = { active: 'p_stove', levels: { p_stove: 1 }, lastSwitchAt: Date.now() }
  p.gearContest = { week: null, score: 0, rank: 'B', best: 9000, runs: 3 }
  p.michelin = { score: 420, stars: 2, best: 2, lastReviewDay: null }
  p.flavors = { fp_tomato_basil: true, fp_milk_egg: true }
  p.legacy = { carry: { knife: 5 }, apprentice: { level: 12, lastDay: null } }
  p.spirits = { active: ['appleSpirit_1'], owned: { appleSpirit_1: 1 } }
  p.spiritBonds = { appleSpirit_1: 7 * 86400000 }
  p.realm = { active: false, floor: 3, buffs: ['atk10'], best: 12, pending: null }
  p.trials = { t_speed: { clears: 1, best: 80, streak: 0 } }
  p.daily = { day: null, streak: 3, tasks: [], claimedAll: false }
  p.encounters = { seen: { enc_lost_recipe: 2 }, picks: {}, total: 2 }
    p.mail = { list: [{ id: 1, from: '系统', kind: 'overflow', title: '溢出转存', body: '测试', items: { apple: 3 }, claimed: false, read: false, at: Date.now() }], nextId: 2 }
  })
  await page.waitForTimeout(400)
}

/** 扫一批页面（含页内页签） */
async function scanPagesText(page, pages) {
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await enterGameText(page)
  const found = []
  const scan = async (tag) => {
    const hits = await page.evaluate(scanText, PATTERNS.map((p) => ({ name: p.name, re: p.re.source, flags: p.re.flags })))
    for (const h of hits) found.push({ page: tag, ...h })
  }
  const setView = async (v) => {
    await page.evaluate((vv) => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      pinia._s.get('ui').setView(vv)
    }, v)
    await page.waitForTimeout(260)
  }

  // 逐页扫描；页内的「页签行」（.region-tabs / .*-tabs，纯导航、不产生副作用）也逐个点开再扫一遍，
  // 否则像攻略「总览」这种藏在页签里的富文本根本扫不到（本轮就是这么漏掉用户报的那处的）
  for (const v of pages) {
    await setView(v)
    await scan(v)
    const tabCount = await page.evaluate(() => {
      const rows = document.querySelectorAll('.region-tabs, [class*="-tabs"]')
      let n = 0
      for (const r of rows) for (const b of r.querySelectorAll('button')) { b.dataset.__scanned = '1'; n++ }
      return n
    })
    for (let i = 0; i < tabCount; i++) {
      const ok = await page.evaluate((idx) => {
        const btns = [...document.querySelectorAll('button[data-__scanned]')]
        if (!btns[idx]) return false
        btns[idx].click()
        return true
      }, i)
      if (!ok) break
      await page.waitForTimeout(200)
      await scan(v + '·tab' + i)
    }
  }
  return { found, errors }
}

/** 统一判定：命中或控制台错误即失败 */
function assertNoMarkup(found, errors, label) {
  const uniq = new Map()
  for (const f of found) { const k = f.pat + '|' + f.text; if (!uniq.has(k)) uniq.set(k, f) }
  const lines = [...uniq.values()].map((f) => '[' + f.pat + '] ' + f.page + ' @' + f.where + ' :: ' + f.text)
  if (lines.length) console.log('  ' + label + ' 命中 ' + lines.length + ' 处（明细见断言消息）')
  expect(errors, label + ' 控制台错误 ' + errors.length + ' 条').toEqual([])
  expect(lines, label + ' 发现 ' + lines.length + ' 处前端标记裸露').toEqual([])
}

for (let i = 0; i < SLICES; i++) {
  const mine = VIEWS.filter((_, k) => k % SLICES === i)
  test(`文本标记体检（切片 ${i + 1}/${SLICES}，${mine.length} 页）：无前端标记裸露`, async ({ page }) => {
    const { found, errors } = await scanPagesText(page, mine)
    expect(found, `切片 ${i + 1} 一次都没扫到（空转）`).toBeInstanceOf(Array)
    assertNoMarkup(found, errors, `切片 ${i + 1}`)
  })
}

test('文本标记体检：副业技能页与常用弹窗无前端标记裸露', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  const found = []
  await enterGameText(page)
  const setView = async (v) => {
    await page.evaluate((vv) => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      pinia._s.get('ui').setView(vv)
    }, v)
    await page.waitForTimeout(260)
  }
  const scan = async (tag) => {
    const hits = await page.evaluate(scanText, PATTERNS.map((p2) => ({ name: p2.name, re: p2.re.source, flags: p2.re.flags })))
    for (const h of hits) found.push({ page: tag, ...h })
  }
  // 副业技能页（v2.10.0）：`skill` 视图只会渲染「当时激活的那一个技能」，而副业五支共用一个
  // ProductionView（含新的「作品面板」）——不切 activeSkill 就一次都扫不到。逐个切过去扫。
  for (const sid of SKILL_IDS) {
    await page.evaluate((s) => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      pinia._s.get('ui').setView('skill')
      pinia._s.get('player').setActiveSkill(s)
    }, sid)
    await page.waitForTimeout(260)
    await scan('sideline:' + sid)
  }
  for (const m of MODALS) {
    await page.evaluate((mm) => {
      const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui')
      if (mm === 'settings') ui.toggleSettingsPanel(true)
      else if (mm === 'guide') ui.toggleSkillGuide('foraging')
      else if (mm === 'save') ui.toggleSavePanel(true)
      else if (mm === 'signin') ui.toggleSignIn(true)
    }, m)
    await page.waitForTimeout(400)
    await scan('modal:' + m)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }

  assertNoMarkup(found, errors, '副业技能页 + 弹窗')
})
