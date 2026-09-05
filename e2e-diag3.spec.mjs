import { test, expect } from '@playwright/test'
const BASE = 'http://localhost:5173'
test('锻造界面效果渲染为 chips', async ({ page }) => {
  await page.goto(BASE)
  await page.waitForTimeout(600)
  await page.locator('.splash-start-btn').click()
  await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
  await expect(page.locator('.app-layout')).toBeVisible()
  await page.locator('.skill-item', { hasText: '厨具锻造' }).click()
  await page.waitForTimeout(900)
  const chips = await page.locator('.effect-chip').count()
  const labels = await page.locator('.effect-label').count()
  console.log('chips =', chips, 'labels =', labels)
  expect(chips).toBeGreaterThan(0)
  expect(labels).toBeGreaterThan(0)
})
