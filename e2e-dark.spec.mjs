// 深色模式配色体检（常驻守卫）— 逐页扫描对比度 / 硬编码亮底 / 白色边缘
// 判定：① 文字/底色对比度低于 WCAG 阈值 ② 深色下仍「声明亮色底」（R/G/B 均 > 195）
//       ③ 深色下的白色边缘：白描边 alpha ≥ 0.25 或白色高光阴影 alpha ≥ 0.2
// 注意：扫描函数以「真函数」形式传给 page.evaluate —— 不要写成模板字符串！
//       模板字面量会吃掉正则里的反斜杠（`\(` → `(`），曾导致 whiteGlow 检查恒不命中、守卫形同虚设。
import fs from 'node:fs'
import { test, expect } from '@playwright/test'

import { SKINS, skinVars } from './src/game/data/skins.js'

/** 把 token 值转成 [r,g,b]：'217, 90, 56' 或 '#d95a38' */
const toTriplet = (v) => {
  const t = String(v).trim()
  if (!t) return null
  if (t.startsWith('#')) {
    const h = t.slice(1)
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const p = t.split(',').map((x) => parseInt(x, 10))
  return p.length >= 3 && p.every((n) => Number.isFinite(n)) ? p.slice(0, 3) : null
}
/** 某套皮肤（两主题）全部 token 的 RGB 集合 —— 用来判断「这个颜色能否被皮肤自身解释」 */
const skinAllowedRgb = (id) => {
  const out = []
  for (const theme of ['light', 'dark']) for (const v of Object.values(skinVars(id, theme))) {
    const t = toTriplet(v)
    if (t) out.push(t)
  }
  return out
}
const SKIN_ALLOWED = new Map(SKINS.map((s) => [s.id, skinAllowedRgb(s.id)]))

const VIEWS = [
  'skill', 'shop', 'deluxe', 'alchemy', 'expedition', 'regions', 'ranch', 'cellar', 'automation',
  'kitchenNotes', 'flavorBook', 'schools', 'michelin', 'staff', 'branches', 'exchange', 'regulars',
  'trials', 'gearContest', 'minigames', 'festival', 'legacy', 'patrons', 'spiritStories', 'restaurant',
  'guild', 'season', 'arena', 'tower', 'fest', 'mijian', 'stats', 'log', 'guide',
  // 2026-09-10 新增九页（分店主题并入 branches，无需另列）
  'milestones', 'chronicle', 'weather', 'mascot', 'banquet', 'takeout',
  'suppliers', 'chefChallenge', 'seasonReview',
  // 2026-09-10 第四批
  'honor', 'codexExchange', 'setMeals', 'rivals',
  // 2026-09-11 第五批（装备总览 / 任务中心 / 成就与称号）
  'gear', 'quests', 'achievements',
  // 2026-09-11 第六批（食神秘境 / 餐厅装潢，各自从对决页、餐厅页抽出）
  'realm', 'decor',
  // 2026-09-11 第七批（信箱）
  'mail',
  // 2026-09-11 第八批（系统日志 / 行情 / 厨友）
  'logs', 'market', 'friends',
  // 2026-09-11 第九批（今日待办）
  'today',
  // 2026-09-12 第十批（故事与传闻，自图鉴页抽出）
  'story',
  // 2026-09-12 第十一批（卡牌对战，自图鉴页抽出）
  'cards',
  // 2026-09-12 第十二批（奇遇图鉴）
  'encounters', 'dao', 'shanhai',
  // 2026-09-14 挂机产线四套
  'caravan', 'mushroom', 'spiritField', 'greenhouse',
]
const MODALS = ['bag', 'bank', 'equip', 'settings', 'save', 'signin']
// 扫描器盲区白名单：渐变底抽卡按钮、禁用态、条状填充等
const EXEMPT = ['.gacha-btn-top', '.gacha-btn-price', '.gacha-btn-tag', 'b.mono', '.hp-bar', '.mg-']

/** 页面内扫描（真函数） */
function scanPage({ exempt, theme, skin, allowed = [] }) {
  const lum = (r, g, b) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(',').map((x) => parseFloat(x))
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 })
  const effBg = (el) => {
    let cur = el
    const stack = []
    while (cur) {
      const bg = parse(getComputedStyle(cur).backgroundColor)
      if (bg && bg.a > 0) stack.push(bg)
      cur = cur.parentElement
    }
    stack.reverse()
    let base = { r: 26, g: 18, b: 12, a: 1 }
    for (const s of stack) base = blend(s, base)
    return base
  }
  const path = (el) => el.tagName.toLowerCase() + '.' + [...(el.classList || [])].filter((c) => !c.startsWith('data-v')).join('.')
  const bad = []
  const seen = new Set()
  // 2026-09-11：把三块面板/两条栏**本身**也纳入扫描（原来只扫后代 '*'，导致'深色下某面板底色变白'这类问题扫不到）
  const roots = '.app-main, .app-main *, .app-status, .app-status *, .app-sidebar, .app-sidebar *, .top-nav, .top-nav *, .bottom-nav, .bottom-nav *, .modal-backdrop *, .bg *, .mg-shell *'
  let scanned = 0
  for (const el of document.querySelectorAll(roots)) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.3) continue
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) continue
    const key0 = path(el)
    if (exempt.some((e) => key0.startsWith(e) || key0.includes(e))) continue
    scanned++
    // ③ 白色边缘：白描边 / 白色高光阴影
    const bc = parse(cs.borderTopColor)
    if (theme === 'dark' && bc && bc.a >= 0.25 && bc.r > 240 && bc.g > 240 && bc.b > 240 && parseFloat(cs.borderTopWidth) > 0) {
      const k = 'wborder|' + key0 + '|' + cs.borderTopColor
      if (!seen.has(k)) { seen.add(k); bad.push({ kind: 'white-border', sel: key0, detail: cs.borderTopColor }) }
    }
    const sh = cs.boxShadow || ''
    const marker = 'rgba(255, 255, 255, '
    const mi = theme === 'dark' ? sh.indexOf(marker) : -1
    if (mi >= 0) {
      const alpha = parseFloat(sh.slice(mi + marker.length))
      if (alpha >= 0.2) {
        const k = 'wglow|' + key0 + '|' + alpha
        if (!seen.has(k)) { seen.add(k); bad.push({ kind: 'white-glow', sel: key0, detail: marker + alpha + ')' }) }
      }
    }
    // ④ 金色光晕过亮（仅深色：浅色无金光设定）
    const goldMark = 'rgba(232, 180, 95, '
    const goldMark2 = 'rgba(240, 196, 118, '
    for (const mk of (theme === 'dark' ? [goldMark, goldMark2] : [])) {
      const gi = sh.indexOf(mk)
      if (gi < 0) continue
      const ga = parseFloat(sh.slice(gi + mk.length))
      if (ga > 0.35) {
        const k = 'goldglow|' + key0 + '|' + ga
        if (!seen.has(k)) { seen.add(k); bad.push({ kind: 'gold-glow-too-strong', sel: key0, detail: mk + ga + ')' }) }
      }
    }
    // ② 亮色底（仅深色主题：浅色下面板本就是亮的）
    const own = parse(cs.backgroundColor)
    if (theme === 'dark' && own && own.a >= 0.15 && own.r > 195 && own.g > 195 && own.b > 195 && r.width > 24 && r.height > 12) {
      const k = 'bg|' + key0 + '|' + cs.backgroundColor
      if (!seen.has(k)) { seen.add(k); bad.push({ kind: 'light-bg', sel: key0, detail: cs.backgroundColor }) }
    }
    // ⑤ 非原味皮肤不得残留品牌橙（v2.1：皮肤要覆盖整份色板）
    if (skin && skin !== 'classic') {
      const BRAND = [[217, 90, 56], [224, 112, 74], [232, 112, 63], [201, 84, 46], [184, 68, 42], [255, 138, 94], [255, 185, 142], [255, 176, 138], [255, 201, 173], [255, 210, 184]]
      const near = (c, [r0, g0, b0]) => Math.abs(c.r - r0) <= 12 && Math.abs(c.g - g0) <= 12 && Math.abs(c.b - b0) <= 12
      // 残留 = 「像经典橙族」且**无法用本皮肤自己的 token 解释**（番茄红等与品牌橙相近的皮肤色不算）
      const hit = (c) => c && c.a >= 0.12 && BRAND.some((b) => near(c, b)) && !allowed.some((b) => near(c, b))
      // SVG 图元（v2.1 的厨神之路图谱）用 fill/stroke 上色，也要纳入判定
      const isSvg = typeof SVGElement !== 'undefined' && el instanceof SVGElement
      const cands = [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderLeftColor]
      if (isSvg) { cands.push(cs.fill, cs.stroke) }
      for (const v of (cs.backgroundImage || '').match(/rgba?\([^)]+\)/g) || []) cands.push(v)
      const found = cands.map(parse).find(hit)
      if (found) {
        const k = 'orange|' + key0 + '|' + JSON.stringify(found)
        if (!seen.has(k)) { seen.add(k); bad.push({ kind: 'brand-orange', sel: key0, detail: `rgba(${found.r}, ${found.g}, ${found.b}, ${found.a})` }) }
      }
    }

    // ① 对比度
    const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
    const txt = (el.textContent || '').trim()
    if (!hasOwnText || txt.length < 2) continue
    // SVG <text> 的颜色由 fill 决定（color 不参与），否则会把画布文字当黑色误判
    // 纯 emoji 文本（如节点图标）：字形自带颜色，color/fill 与实际观感无关 → 跳过（否则恒误报）
    if (!/[0-9A-Za-z\u4e00-\u9fff\uff10-\uff5e]/.test(txt)) continue
    const svgText = typeof SVGElement !== 'undefined' && el instanceof SVGElement && el.tagName.toLowerCase() === 'text'
    const fgc = parse(svgText ? (cs.fill !== 'none' ? cs.fill : cs.color) : cs.color)
    if (!fgc) continue
    const bg = effBg(el)
    const fg = fgc.a < 1 ? blend(fgc, bg) : fgc
    const L1 = lum(fg.r, fg.g, fg.b), L2 = lum(bg.r, bg.g, bg.b)
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const size = parseFloat(cs.fontSize)
    const bold = parseInt(cs.fontWeight, 10) >= 600
    const min = size >= 18.66 || (bold && size >= 14) ? 3 : 4.5
    if (ratio < min) {
      const k = 'ct|' + key0 + '|' + ratio.toFixed(1)
      if (!seen.has(k)) { seen.add(k); bad.push({ kind: 'contrast', sel: key0, ratio: Math.round(ratio * 100) / 100, color: cs.color, detail: txt.slice(0, 14) }) }
    }
  }
  return { bad, scanned }
}

/**
 * 只查「残留品牌橙」的扫描器（v2.1）——用于逐皮肤的**浅色**轮次。
 * 浅色下的对比度已由 system_test 的皮肤组（按 token 值算 WCAG）守住，这里只管「皮肤是否真的把品牌橙换掉了」。
 * 注意不要写成模板字符串（会吃掉正则里的反斜杠）。
 */
function scanOrange({ skin, exempt, allowed = [] }) {
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(',').map((x) => parseFloat(x))
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const BRAND = [[217, 90, 56], [224, 112, 74], [232, 112, 63], [201, 84, 46], [184, 68, 42], [255, 138, 94], [255, 185, 142], [255, 176, 138], [255, 201, 173]]
  const near = (c, [r0, g0, b0]) => Math.abs(c.r - r0) <= 12 && Math.abs(c.g - g0) <= 12 && Math.abs(c.b - b0) <= 12
  const hit = (c) => c && c.a >= 0.12 && BRAND.some((b) => near(c, b)) && !allowed.some((b) => near(c, b))
  const roots = '.app-main, .app-main *, .app-status, .app-status *, .app-sidebar, .app-sidebar *, .top-nav, .top-nav *, .bottom-nav, .bottom-nav *, .modal-backdrop *, .bg *, .mg-shell *'
  const bad = []
  const seen = new Set()
  let scanned = 0
  if (skin === 'classic') return { bad, scanned }
  for (const el of document.querySelectorAll(roots)) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.3) continue
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) continue
    const key0 = el.tagName.toLowerCase() + '.' + [...(el.classList || [])].filter((c) => !c.startsWith('data-v')).join('.')
    if (exempt.some((e) => key0.startsWith(e) || key0.includes(e))) continue
    scanned++
    const isSvgEl = typeof SVGElement !== 'undefined' && el instanceof SVGElement
    const cands = [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderLeftColor]
    if (isSvgEl) { cands.push(cs.fill, cs.stroke) }
    for (const v of (cs.backgroundImage || '').match(/rgba?\([^)]+\)/g) || []) cands.push(v)
    const found = cands.map(parse).find(hit)
    if (found) {
      const k = 'orange|' + key0 + '|' + found.r + ',' + found.g + ',' + found.b
      if (!seen.has(k)) { seen.add(k); bad.push({ kind: 'brand-orange', sel: key0, detail: `rgba(${found.r}, ${found.g}, ${found.b}, ${found.a})` }) }
    }
  }
  return { bad, scanned }
}

test.describe('深色模式配色体检', () => {
  test.describe.configure({ timeout: 300000 }) // 皮肤扩到 15 套后扫描量上涨

  test('全部页面与弹窗在深色下无对比度/亮底/白边问题', async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto('http://localhost:5173')
    await page.waitForTimeout(700)
    await page.locator('.splash-start-btn').click()
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)
    // 种入代表性数据（2026-09-10）：空档上大量 UI 不渲染（装备总属性/词条/宝石/图鉴已收集/背包物品…）
    await page.evaluate(() => {
      const pin = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      const p = pin._s.get('player')
      const gear = { weapon: 'copperKnife', helmet: 'copperHat', body: 'copperApron', legs: 'smith_铜_legs', boots: 'smith_铜_boots', offhand: 'copperPot', amulet: 'copperBottle', ring: 'smith_铜_ring' }
      for (const [slot, id] of Object.entries(gear)) { p.inventory[id] = 1; p.equipment[slot] = id }
      p.gearMods.weapon = { itemId: 'copperKnife', mods: [{ stat: 'goldPct', label: '金币', value: 0.63 }, { stat: 'hpBonus', label: '生命', value: 24.82 }] }
      p.gemSockets.weapon = { itemId: 'copperKnife', gems: ['goldOre'] }
      p.inventory.apple = 50
      p.inventory.wheat = 30
      p.inventory.mysterySpice = 3
      p.inventory.energyBiscuit = 2
      p.inventory.trap = 20
      p.upgrades.copperKnife = 2
      p.gold = 250000
      p.tastePoints = 500
      p.guild = { id: 'umami', points: 120, day: null, taskProgress: {} }
      p.collected = { ...p.collected, apple: 1, wheat: 1, copperKnife: 1 }
      p.ranch.pens = [{ animalId: 'chicken', lastAt: Date.now() }, null]
      p.branches = { east: { lastAt: Date.now(), manager: true } }
      p.staff = { chef: { level: 2, lastPayAt: Date.now(), unpaid: false } }
      p.regions = { plain: true }
      p.regionPosting = { fishery: 'plain' }
      p.schools = { s_main: { level: 2, research: null } }
      p.patron = { active: 'p_stove', levels: { p_stove: 1 }, lastSwitchAt: Date.now() }
      p.gearContest = { week: null, score: 0, rank: 'B', best: 9000, runs: 3 }
      p.michelin = { score: 420, stars: 2, best: 2, lastReviewDay: null }
      p.flavors = { fp_tomato_basil: true, fp_milk_egg: true }
      p.legacy = { carry: { knife: 5 }, apprentice: { level: 12, lastDay: null } }
      p.spirits = { active: ['appleSpirit_1'], owned: { appleSpirit_1: 1 } }
      p.spiritBonds = { appleSpirit_1: 7 * 86400000 }
      p.realm = { active: false, floor: 3, buffs: ['atk10'], best: 12, pending: null }
      p.stats = { ...p.stats, criticServed: 4, gemsSocketed: 6, challengesDone: 2, plansDone: 1, cellarRounds: 5, cellarGold: 12000, regularServes: 9, spiritStoryClaims: 2, autoSold: 30, autoSoldGold: 900, ranchCycles: 12, branchGold: 5000, exchangeTrades: 14, trialClears: 3, ordersServed: 25, schoolLevels: 2, gearContestRuns: 3, staffWages: 4000, flavorsFound: 2 }
      p.trials = { t_speed: { clears: 1, best: 80, streak: 0 } }
      p.daily = { day: null, streak: 3, tasks: [], claimedAll: false }
      p.settings.crispMode = false
    })
    await page.waitForTimeout(300)
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })

    const bad = []
    let scannedTotal = 0
    // ── 皮肤体检（v2.1）：逐套皮肤再扫一轮代表性页面 ──────────────────────────
    // 皮肤只改主色系（--primary/--primary-strong/--primary-deep），但主色会用在
    // 按钮/选中态/进度条/描边上——**换肤前必须重新量对比度**，否则很容易出现
    // 「深色下主色文字压主色底」这类问题（同侧栏选中行那条教训）。
    const SKIN_IDS = (() => {
      try { return fs.readFileSync(new URL('./src/game/data/skins.js', import.meta.url), 'utf8').match(/id: '([a-z]+)', name:/g).map((x) => x.match(/'([a-z]+)'/)[1]) } catch { return [] }
    })()
    const SKIN_VIEWS = ['skill', 'shop', 'stats', 'restaurant', 'guide'] // 15 套 × 2 主题 × 5 页，控制耗时
    for (const skinTheme of ['light', 'dark']) {
      for (const skin of SKIN_IDS) {
        await page.evaluate(([sid, th]) => {
          const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
          pinia._s.get('player').settings.skin = sid
          pinia._s.get('player').settings.theme = th
          // 同时直接落到 <html>：测试前面若只用 dataset 改过主题，store 值可能没变 → watcher 不触发
          document.documentElement.dataset.theme = th
        }, [skin, skinTheme])
        // 700ms：等 CSS 过渡（0.18~0.25s）走完再扫，否则读到的是「上一套皮肤→本套」的中间色
        await page.waitForTimeout(700)
        for (const v of SKIN_VIEWS) {
          await page.evaluate((vv) => {
            document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui').setView(vv)
          }, v)
          await page.waitForTimeout(240)
          const r = skinTheme === 'light'
            ? await page.evaluate(scanOrange, { skin, exempt: EXEMPT, allowed: SKIN_ALLOWED.get(skin) ?? [] })
            : await page.evaluate(scanPage, { exempt: EXEMPT, theme: skinTheme, skin, allowed: SKIN_ALLOWED.get(skin) ?? [] })
          scannedTotal += r.scanned
          for (const b of r.bad) bad.push({ page: `skin-${skinTheme}:${skin}/${v}`, ...b })
        }
      }
    }
    // 复位主题到深色（后续逐页扫描按深色进行）
    await page.evaluate(() => {
      document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').settings.theme = 'dark'
    })
    await page.waitForTimeout(250)
    // 复位到默认皮肤，避免影响后面的逐页扫描
    await page.evaluate(() => {
      document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').settings.skin = 'classic'
    })
    await page.waitForTimeout(250)
    for (const v of VIEWS) {
      await page.evaluate((vv) => {
        const el = document.querySelector('#app')
        const pinia = el && el.__vue_app__ && el.__vue_app__.config.globalProperties.$pinia
        const ui = pinia && pinia._s.get('ui')
        if (ui) ui.setView(vv)
      }, v)
      await page.waitForTimeout(280)
      const r = await page.evaluate(scanPage, { exempt: EXEMPT, theme: 'dark', skin: 'classic' })
      scannedTotal += r.scanned
      for (const b of r.bad) bad.push({ page: v, ...b })
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
      // 设置面板已分 4 个页签（2026-09-13 重构）：逐页签都扫一遍，别只扫默认页
      const tabCount = m === 'settings' ? await page.locator('.settings-tabs .btn').count() : 0
      for (let ti = 0; ti < Math.max(1, tabCount); ti++) {
        if (tabCount) {
          await page.locator('.settings-tabs .btn').nth(ti).click()
          await page.waitForTimeout(280)
          await page.mouse.move(4, 4)
          await page.waitForTimeout(120)
        }
        const r = await page.evaluate(scanPage, { exempt: EXEMPT, theme: 'dark', skin: 'classic' })
        scannedTotal += r.scanned
        for (const b of r.bad) bad.push({ page: 'modal:' + m + (tabCount ? '#' + ti : ''), ...b })
      }
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    }
    console.log(`扫描元素合计 ${scannedTotal}`)
    if (bad.length) console.log('深色问题明细：\n' + bad.slice(0, 25).map((b) => `  [${b.page}] ${b.kind} ${b.sel} ${b.detail ?? ''}`).join('\n'))
    // 自检：扫描量太小说明页面/数据没渲染出来（守卫本身失效）
    expect(scannedTotal, '扫描元素过少，体检可能没跑起来').toBeGreaterThan(2000)
    expect(bad, `深色模式存在 ${bad.length} 处问题`).toEqual([])
    expect(errors.length, `控制台错误 ${errors.length} 条`).toBe(0)
  })
})
