// 端到端流程测试 — Playwright
// 覆盖：启动界面 → 开始游戏 → 选存档 → 进入主界面 → 各菜单/弹窗
import { test, expect } from '@playwright/test'
import fs from 'fs'

const BASE = 'http://localhost:5173'

test.describe('游戏全流程', () => {
  // 大厅入口随小游戏数量增长，逐个点完需要更长时间（2026-09-09：18 款 + 商店）
  test.describe.configure({ timeout: 90000 })
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE)
    await page.waitForTimeout(800)
  })

  test('启动界面显示标题与开始按钮', async ({ page }) => {
    await expect(page.locator('.splash')).toBeVisible()
    await expect(page.locator('.splash-title')).toContainText('美食放置：食灵山海')
    await expect(page.locator('.splash-start-btn')).toBeVisible()
    await expect(page.locator('.splash-bg')).toBeVisible()
  })

  test('点击开始游戏 → 弹出选择存档', async ({ page }) => {
    await page.locator('.splash-start-btn').click()
    await expect(page.locator('.start-slot-modal')).toBeVisible()
    await expect(page.locator('.start-slot-modal .slot-card')).toHaveCount(3)
  })

  test('选择新游戏档位 → 进入游戏主界面', async ({ page }) => {
    await page.locator('.splash-start-btn').click()
    // 第1个存档位为空 → 显示"新游戏"
    await expect(page.locator('.start-slot-modal .slot-card').nth(0)).toBeVisible()
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    // 进入主界面
    await expect(page.locator('.app-layout')).toBeVisible()
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('.top-nav')).toBeVisible()
    await expect(page.locator('.app-status')).toBeVisible()
  })

  test('顶部导航各菜单可切换', async ({ page }) => {
    await page.locator('.splash-start-btn').click()
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()

    // 顶部导航（2026-09-10）：只保留 7 个高频入口（不再分页）
    const topMenus = ['餐厅', '公会', '赛季', '竞技场', '试炼塔', '大赛', '觅珍']
    for (const m of topMenus) {
      await page.locator('.top-nav-btn', { hasText: m }).first().click({ timeout: 3000 })
      await page.waitForTimeout(350)
      await expect(page.locator('.main-scroll')).toBeVisible()
    }
    // 其余功能页在左侧栏「功能」折叠分组中（生产与采集 / 经营与挑战）
    const featureGroups = [
      ['生产与采集', ['商店', '珍馐阁', '炼金', '采集队', '牧场', '地窖', '厨房笔记']],
      ['经营与挑战', ['分店', '交易所', '自动化', '常客', '食灵物语', '试炼']],
    ]
    // 左栏页签（2026-09-10）：功能页在「🧩 功能」页签下，方块磁贴一行三个、全部展开
    await page.locator('.sidebar-tab', { hasText: '功能' }).click()
    await page.waitForTimeout(250)
    for (const [, items] of featureGroups) {
      for (const it of items) {
        await page.locator('.feature-tile', { hasText: it }).first().click({ timeout: 3000 })
        await page.waitForTimeout(350)
        await expect(page.locator('.main-scroll')).toBeVisible()
      }
    }
    // 小游戏（经营与挑战组内）：进入后逐个点开游戏入口
    await page.locator('.feature-tile', { hasText: '小游戏' }).first().click()
    await page.waitForTimeout(500)
    for (const g of ['商店', '火候炉', '讲堂', '2048', '大胃王', '拼图', '连连看', '翻牌', '贪吃蛇', '吃豆人', '消消乐', '笨鸟先飞', '凑凑消', '水果合成', '果了个果', '垂钓渔翁', '切菜大师', '打地鼠', '摆盘', '接汤', '传菜', '方块', '扫雷', '滑冰', '猜菜名', '调味表', '上菜顺序', '汤圆冰壶']) {
      // 分页入口（2026-09-09）：目标不在当前页时先翻页（最多 3 次，防死循环）
      for (let guard = 0; guard < 3; guard++) {
        if (await page.locator('.mg-entry', { hasText: g }).count() > 0) break
        await page.locator('.mg-page-btn').last().click() // › 下一页
        await page.waitForTimeout(300)
      }
      await page.locator('.mg-entry', { hasText: g }).click()
      await page.waitForTimeout(700)
      await expect(page.locator('.mg-shell')).toBeVisible()
      await expect(page.locator('.mg-entry-on')).toContainText(g)
    }
    // 右侧固定图标钮（统计/图鉴/攻略）
    const iconMenus = [['统计', '📊'], ['图鉴', '📖'], ['攻略', '🗺️']]
    for (const [title, icon] of iconMenus) {
      await page.locator(`.top-nav-btn[title="${title}"]`).click()
      await page.waitForTimeout(400)
      await expect(page.locator('.main-scroll')).toBeVisible()
    }
  })

  test('背包/设置/存档弹窗可打开并关闭', async ({ page }) => {
    await page.locator('.splash-start-btn').click()
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()

    // 背包
    await page.locator('.top-nav-btn', { hasText: '厨藏' }).click()
    await expect(page.locator('.modal-backdrop')).toBeVisible()
    await page.locator('.modal-backdrop').click({ position: { x: 8, y: 8 } }) // 点遮罩空白处关闭
    await expect(page.locator('.modal-backdrop')).toHaveCount(0)

    // 设置（2026-09-10 起按钮只显示 ⚙️，用 title 定位）
    await page.locator('.top-nav-btn[title="设置"]').click()
    await expect(page.locator('.modal-backdrop')).toBeVisible()
    await page.locator('.modal-backdrop').click({ position: { x: 8, y: 8 } })
    await expect(page.locator('.modal-backdrop')).toHaveCount(0)

    // 存档面板（按钮只显示 💾）
    await page.locator('.top-nav-btn[title="存档"]').click()
    await expect(page.locator('.modal-backdrop')).toBeVisible()
  })

  // 守卫：App.vue 的分派链末尾是 v-else → SkillView，漏注册的 view key 不会报错、
  // 只会静默显示技能页。这里逐 key 切换并捕获 ui.setView 的「未知 key」告警，杜绝静默回退。
  test('全部 view key 均已在 App.vue 注册（无静默回退到技能页）', async ({ page }) => {
    // 从源码取出白名单，避免与此处硬编码的列表脱节
    const src = fs.readFileSync(new URL('./src/stores/ui.js', import.meta.url), 'utf8')
    const block = src.slice(src.indexOf('export const VIEW_KEYS = ['), src.indexOf(']', src.indexOf('export const VIEW_KEYS = [')))
    const keys = [...block.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1])
    expect(keys.length, '未能从 ui.js 解析出 VIEW_KEYS').toBeGreaterThan(40)

    const warns = []
    page.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('未知的 view key')) warns.push(m.text()) })

    await page.locator('.splash-start-btn').click()
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1200)

    const rendered = []
    for (const v of keys) {
      await page.evaluate((vv) => {
        const el = document.querySelector('#app')
        const pinia = el && el.__vue_app__ && el.__vue_app__.config.globalProperties.$pinia
        const ui = pinia && pinia._s.get('ui')
        if (ui) ui.setView(vv)
      }, v)
      await page.waitForTimeout(220)
      // 每个已注册页面都必须渲染出内容（SkillView 兜底页也满足，故用告警而非 DOM 判定回退）
      const hasContent = await page.evaluate(() => document.querySelector('.main-scroll')?.innerText?.trim().length > 20)
      if (!hasContent) rendered.push(v)
    }
    expect(warns, `以下 view key 未在 ui.js 的 VIEW_KEYS 中登记：\n${warns.join('\n')}`).toEqual([])
    expect(rendered, `以下页面切换后内容为空：${rendered.join('、')}`).toEqual([])
  })

  // 守卫：响应式断点的 display 规则曾被「声明在媒体查询之后的基础规则」反向覆盖
  // （`.status-panel`/`.sidebar`/`.mobile-nav` 都是 (0,1,0) 特指度且更靠后）——右栏在手机上照旧占满屏、
  // 底部导航则**任何宽度都不显示**。修法是在媒体查询里加 `.app-layout` 前缀提权，此处逐条断言防回归。
  test('响应式：平板收起右栏、手机单栏 + 底部导航可用', async ({ page }) => {
    const disp = (sel) => page.evaluate((s) => {
      const el = document.querySelector(s)
      return el ? getComputedStyle(el).display : 'MISSING'
    }, sel)

    await page.locator('.splash-start-btn').click()
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)

    // 桌面：三栏齐全、底部导航隐藏
    expect(await disp('.app-sidebar')).toBe('flex')
    expect(await disp('.app-status')).toBe('flex')
    expect(await disp('.mobile-nav')).toBe('none')

    // 平板（<940）：右栏收起、左栏保留
    await page.setViewportSize({ width: 900, height: 900 })
    await page.waitForTimeout(400)
    expect(await disp('.app-status')).toBe('none')
    expect(await disp('.app-sidebar')).toBe('flex')
    // 中区应占满高度（三栏变两栏后不该再被压成半高）
    const h = await page.evaluate(() => Math.round(document.querySelector('.app-main').getBoundingClientRect().height))
    expect(h, '平板下中区应占满高度').toBeGreaterThan(800)

    // 手机（<720）：单栏 + 底部导航出现
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(400)
    expect(await disp('.app-sidebar')).toBe('none')
    expect(await disp('.app-status')).toBe('none')
    expect(await disp('.mobile-nav')).toBe('flex')

    // 底部导航可用：🏠 打开技能抽屉 → 抽屉内 Sidebar 可见 → 选技能后抽屉收起
    await page.locator('.mobile-nav-btn').first().click()
    await page.waitForTimeout(400)
    expect(await disp('.mobile-skills .sidebar'), '抽屉内 Sidebar 应可见').toBe('flex')
    await page.locator('.mobile-skills .skill-item').first().click()
    await page.waitForTimeout(400)
    expect(await page.locator('.mobile-skills').count(), '选完技能抽屉应收起').toBe(0)
  })

  // 守卫：390px 手机下**任何页面都不得横向溢出**（2026-09-12 立）
  // 起因：新增的 7 列对照表与 6 列榜单行把主区撑宽（实测分店 +22px、同业榜 +6px）——
  // 桌面上完全看不出，只有手机才会出现「页面能左右滑」的怪状。宽表请包 `.table-scroll`。
  test('手机 390px：全部页面无横向溢出', async ({ page }) => {
    const src = fs.readFileSync(new URL('./src/stores/ui.js', import.meta.url), 'utf8')
    const block = src.slice(src.indexOf('export const VIEW_KEYS = ['), src.indexOf(']', src.indexOf('export const VIEW_KEYS = [')))
    const keys = [...block.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1])
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(BASE)
    await page.waitForTimeout(600)
    await page.locator('.splash-start-btn').click()
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)
    // 种入代表性数据：空档上多数表格/网格不渲染，会漏掉宽表
    await page.evaluate(() => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      const p = pinia._s.get('player')
      for (const id of Object.keys(p.skills)) p.setSkillState(id, { level: 99, exp: 0 })
      p.gold = 3000000
      p.restaurant = { ...p.restaurant, level: 12, menu: ['roastPotato'] }
      p.branches = { east: { lastAt: Date.now(), manager: true } }
      p.schools = { s_main: { level: 8 } }
      p.regulars = { r_oldman: { serves: 8 } }
      p.inventory.apple = 50
      p.recordMinigame('snake', 12, { unit: '食物' })
    })
    await page.waitForTimeout(400)
    const bad = []
    for (const v of keys) {
      await page.evaluate((vv) => {
        document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui').setView(vv)
      }, v)
      await page.waitForTimeout(260)
      const r = await page.evaluate(() => {
        const main = document.querySelector('.main-scroll')
        return {
          doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          main: main ? main.scrollWidth - main.clientWidth : 0,
        }
      })
      if (r.doc > 2 || r.main > 2) bad.push(`${v}(文档 +${r.doc}px / 主区 +${r.main}px)`)
    }
    expect(bad, `以下页面在 390px 下横向溢出：\n${bad.join('\n')}`).toEqual([])
  })

  test('刷新后仍能看到启动界面（干净会话）', async ({ page }) => {
    // 每次 test 都是干净 context，刷新应仍显示启动界面（无存档时）
    await page.reload()
    await expect(page.locator('.splash')).toBeVisible()
  })

  test('页面无未捕获的控制台错误', async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.locator('.splash-start-btn').click()
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await page.waitForTimeout(1200)
    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toEqual([])
  })

  test('开新游戏后产生持久化存档（localStorage）', async ({ page }) => {
    await page.locator('.splash-start-btn').click()
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    // 稍等自动保存/交互，然后检查 localStorage 中出现存档键
    await page.waitForTimeout(1200)
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('culinary-idle.save')))
    expect(keys.length).toBeGreaterThan(0)
    // 存档内容应为合法 JSON 且含 schemaVersion / player
    const hasSave = await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('culinary-idle.save')) {
          try { const d = JSON.parse(localStorage.getItem(k)); return !!d && !!d.player && !!d.schemaVersion } catch { }
        }
      }
      return false
    })
    expect(hasSave).toBe(true)
  })

  test('从启动界面进入已有存档，存档内容不被覆盖', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForTimeout(600)
    // 写入一个已知存档（slot 0）
    await page.evaluate(() => {
      localStorage.setItem('culinary-idle.save.0', JSON.stringify({ schemaVersion: 1, savedAt: Date.now(), player: { name: '测试英雄', gold: 777 } }))
    })
    await page.reload()
    await page.waitForTimeout(800)
    // 打开选存档弹窗，确认 slot 0 为"已有存档"
    await page.locator('.splash-start-btn').click()
    await expect(page.locator('.start-slot-modal')).toBeVisible()
    await expect(page.locator('.start-slot-modal .slot-card').nth(0)).toContainText('已有存档')
    // 读取该存档进入
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1500)
    // 存档应保留原内容（不被覆盖成因新游戏）
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('culinary-idle.save.0')
      return raw ? JSON.parse(raw) : null
    })
    expect(saved).not.toBeNull()
    expect(saved.player.name).toBe('测试英雄')
    expect(saved.player.gold).toBe(777)
  })
})
