import { test, expect } from '@playwright/test'

// 角色权限守卫（2026-09-25 立）——四档角色（试玩 < 玩家 < **运营调参员** < 开发者）的**行为**断言。
//
// 为什么单独一套（而不是并进 dev_panel_audit）：那个守卫做的是**静态 / 产物**断言
// （B5 三处入口统一走 requestDevEntry、B8 调参页只被 DevEntry 引用、C1 调参页不写冻结数据、
// D2 两个页面同批剥离），system_test 的 C55/C9b 只测「游客零写入」与「调参层默认零影响」——
// **没有一条跑起来验证「登录成运营调参员之后真的开不出开发者页面」**。
// 角色矩阵若只写在注释与文档里，就永远无法证伪「这两个角色其实是一个」这句话。
// 本套就是把它跑出来：每个身份**只能**拿到自己那一页，且调参页里没有任何存档类控件。
//
// ⚠️ 只跑在开发构建（`DEV_PANEL_ENABLED` 为真）——生产构建里这两个页面整块被剥离，
//    连口令哈希都搜不到，属 `dev_panel_audit` 的 D 组负责，不要在这里测。

const BASE = 'http://localhost:5173'
const TUNER = { label: '🎛 运营调参员', name: 'YunYing', pw: 'tuner123456' }
const DEV = { label: '🛠 开发者', name: 'ShiShen', pw: 'msfzslsh' }

async function openGate(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  await page.keyboard.press('Control+Shift+D')
  await expect(page.locator('.dev-gate')).toBeVisible()
}

/** 点角色按钮（应自动预填身份名）→ 填口令 → 登录 */
async function loginAs(page, who) {
  await page.locator('.dev-role-tabs button', { hasText: who.label.replace(/^\S+\s*/, '') }).click()
  await expect(page.locator('.dev-name')).toHaveValue(who.name)
  await page.locator('.dev-pw').fill(who.pw)
  await page.locator('.dev-gate-actions button', { hasText: '登录' }).click()
  await page.waitForTimeout(500)
}

const lastLog = (page) =>
  page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    return pinia._s.get('ui').log.at(-1)?.message ?? ''
  })

test('内部入口：挡板是两角色共用、角色按钮预填身份名、错身份名被拒', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await openGate(page)
  await expect(page.locator('.dev-gate h3')).toContainText('内部入口')
  // 点「运营调参员」⇒ 自动填身份名 + 显示该角色权限说明
  await page.locator('.dev-role-tabs button', { hasText: '运营调参员' }).click()
  await expect(page.locator('.dev-name')).toHaveValue(TUNER.name)
  await expect(page.locator('.dev-role-desc')).toContainText('无任何存档与破坏性操作')
  // 手打错的名字照样拒绝（角色按钮只是预填，不是账号菜单）
  await page.locator('.dev-name').fill('YunYinger')
  await page.locator('.dev-pw').fill(TUNER.pw)
  await page.locator('.dev-gate-actions button', { hasText: '登录' }).click()
  await page.waitForTimeout(400)
  await expect(page.locator('.dev-msg')).toBeVisible()
  await expect(page.locator('.dev-gate')).toBeVisible() // 挡板不关 = 没放进去
  await expect(page.locator('.tunerpage')).toHaveCount(0)
  await expect(page.locator('.devpage')).toHaveCount(0)
  expect(errors, `控制台错误 ${errors.length} 条`).toEqual([])
})

test('运营调参员：只拿到调参页，开发者页不渲染、且页内没有任何存档类操作', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await openGate(page)
  await loginAs(page, TUNER)
  await expect(page.locator('.tunerpage')).toBeVisible()
  await expect(page.locator('.devpage')).toHaveCount(0)
  // 调参页**绝不能**出现存档/注入类控件（这些是开发者页独有的那一层写权限）
  for (const banned of ['一键满配', '存档管理', '清空背包', '物品入库', '存档体检', '快照回滚']) {
    await expect(page.locator('.tunerpage'), `调参页不该出现「${banned}」`).not.toContainText(banned)
  }
  // 它该有的是：三个分区 + 验收线判据（不是「简化版开发者面板」）
  await expect(page.locator('.tp-presets')).toBeVisible()
  expect(errors, `控制台错误 ${errors.length} 条`).toEqual([])
})

test('开发者：只拿到开发者页，调参页不渲染', async ({ page }) => {
  await openGate(page)
  await loginAs(page, DEV)
  await expect(page.locator('.devpage')).toBeVisible()
  await expect(page.locator('.tunerpage')).toHaveCount(0)
})

test('已登录的角色不会串页：收起后热键直开本角色页面、不再问口令', async ({ page }) => {
  await openGate(page)
  await loginAs(page, TUNER)
  await expect(page.locator('.tunerpage')).toBeVisible()
  await page.keyboard.press('Escape') // 收起
  await expect(page.locator('.tunerpage')).toHaveCount(0)
  await page.keyboard.press('Control+Shift+D') // 再开：直接进调参页（不弹挡板）
  await page.waitForTimeout(400)
  await expect(page.locator('.tunerpage')).toBeVisible()
  await expect(page.locator('.dev-gate')).toHaveCount(0)
  await expect(page.locator('.devpage')).toHaveCount(0)
})

test('试玩会话：内部入口直接拒绝（连挡板都不弹），并说明原因', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  await page.locator('.splash-guest-btn').click()
  await page.waitForTimeout(1200)
  await page.keyboard.press('Control+Shift+D')
  await page.waitForTimeout(400)
  await expect(page.locator('.dev-gate')).toHaveCount(0)
  await expect(page.locator('.devpage')).toHaveCount(0)
  await expect(page.locator('.tunerpage')).toHaveCount(0)
  expect(await lastLog(page)).toContain('不能打开内部入口')
})
