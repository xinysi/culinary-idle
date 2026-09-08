// 端到端流程测试 — Playwright
// 覆盖：启动界面 → 开始游戏 → 选存档 → 进入主界面 → 各菜单/弹窗
import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

test.describe('游戏全流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE)
    await page.waitForTimeout(800)
  })

  test('启动界面显示标题与开始按钮', async ({ page }) => {
    await expect(page.locator('.splash')).toBeVisible()
    await expect(page.locator('.splash-title')).toContainText('美食放置：食之契约')
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

    // 顶部导航分 3 页（2026-09-06）：点击目标按钮前先翻到所在页（最多翻 2 次）
    // 统计/图鉴/攻略已固定到右侧图标钮（title 定位）；其余在翻页页中
    const iconMenus = [['统计', '📊'], ['图鉴', '📖'], ['攻略', '🗺️']]
    const menus = ['商店', '珍馐阁', '炼金', '公会', '赛季', '竞技场', '餐厅', '试炼塔', '大赛', '小游戏']
    for (const m of menus) {
      let clicked = false
      for (let p = 0; p < 3 && !clicked; p++) {
        try {
          await page.locator('.top-nav-btn', { hasText: m }).click({ timeout: 1500 })
          clicked = true
        } catch {
          await page.locator('.top-nav-pager').nth(1).click() // 翻下一页再试
          await page.waitForTimeout(200)
        }
      }
      if (!clicked) throw new Error('菜单未找到: ' + m)
      await page.waitForTimeout(400)
      await expect(page.locator('.main-scroll')).toBeVisible()
    }
    // 小游戏：入口行点击 → 游戏内容视图
    await page.locator('.top-nav-btn', { hasText: '小游戏' }).click()
    await page.waitForTimeout(400)
    for (const g of ['商店', '火候炉', '讲堂', '2048', '大胃王', '拼图', '连连看', '翻牌', '贪吃蛇', '吃豆人', '消消乐', '笨鸟先飞', '凑凑消', '水果合成', '果了个果', '垂钓渔翁']) {
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
    for (const [title, icon] of iconMenus) {
      await page.locator(`.top-nav-btn[title="${title}"]`).click()
      await page.waitForTimeout(400)
      await expect(page.locator('.main-scroll')).toBeVisible()
    }
    // 分页控件可循环翻页（‹ › 按钮存在且可点）
    await page.locator('.top-nav-pager').nth(0).click()
    await expect(page.locator('.top-nav-pagenum')).toBeVisible()
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

    // 设置
    await page.locator('.top-nav-btn', { hasText: '设置' }).click()
    await expect(page.locator('.modal-backdrop')).toBeVisible()
    await page.locator('.modal-backdrop').click({ position: { x: 8, y: 8 } })
    await expect(page.locator('.modal-backdrop')).toHaveCount(0)

    // 存档面板
    await page.locator('.top-nav-btn', { hasText: '存档' }).click()
    await expect(page.locator('.modal-backdrop')).toBeVisible()
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
