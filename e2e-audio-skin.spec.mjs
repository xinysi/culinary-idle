import { test, expect } from '@playwright/test'

// v2.1 音频（BGM/音效）与皮肤系统：交互 / 持久化 / BGM 接线
// 关键写法：App 在 dev 下加载的是 `/src/game/core/sound.js?t=<HMR 版本号>`，
//   直接 import('/src/game/core/sound.js') 会拿到**另一个模块实例**（状态永远是空的）。
//   要让断言读到真身，必须从 performance entries 里取 App 实际用过的那个 URL。
test.describe.configure({ timeout: 180000 })

test('皮肤选择器 + 音频设置：交互 / 持久化 / BGM 接线', async ({ page }) => {
  // 无头 Linux CI 若拿不到 Web Audio（AudioContext 不可用），BGM 调度会静默降级 → 断言必然失败。
  // 这里先探测一次：环境不支持就整体跳过（本地 Windows 与支持音频的浏览器照常跑）。
  const hasAudio = await page.evaluate(() => typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined')
  test.skip(!hasAudio, '当前环境无 Web Audio（AudioContext 不可用），跳过音频/BGM 断言')
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto('http://localhost:5173')
  await page.waitForTimeout(600)
  await page.locator('.splash-start-btn').click()
  await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
  await page.waitForTimeout(1200)
  const store = (name) => page.evaluate((n) => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    return pinia._s.get(n)
  }, name)
  void store
  // 先给足成就（解锁全部皮肤）
  await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    pinia._s.get('player').achievements = Array.from({ length: 160 }, (_, i) => 'a' + i) // 15 套皮肤最高门槛 145
  })
  // 打开设置面板 → 切到「画面」页签（设置已重构为 4 个页签，皮肤在画面页）
  await page.evaluate(() => {
    document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui').toggleSettingsPanel(true)
  })
  await page.waitForTimeout(700)
  await page.locator('.settings-tabs .btn', { hasText: '画面' }).first().click()
  await page.waitForTimeout(300)
  const panel = page.locator('.modal, .settings-panel').first()
  const chips = page.locator('.skin-chip')
  // 15 套皮肤（按成就数逐套解锁）：原味 / 青瓷 / 梅子 / 琥珀 / 水墨
  expect(await chips.count()).toBe(15) // v2.1：皮肤扩到 15 套
  // 点「水墨」→ 行内变量应写入（浅色版主色）
  await page.locator('.skin-chip', { hasText: '水墨' }).first().click()
  await page.waitForTimeout(400)
  const r1 = await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    return {
      skin: pinia._s.get('player').settings.skin,
      inline: document.documentElement.style.getPropertyValue('--primary').trim(),
      theme: document.documentElement.dataset.theme ?? 'light',
    }
  })
  expect(r1.skin).toBe('ink')
  expect(r1.inline).toBe('#4a5568')
  expect(r1.theme).toBe('light')
  // 换深色主题 → 换成该皮肤的深色版主色（每套皮肤必须有 varsDark）
  await page.evaluate(() => {
    document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').settings.theme = 'dark'
  })
  await page.waitForTimeout(400)
  const r2 = await page.evaluate(() => ({
    inline: document.documentElement.style.getPropertyValue('--primary').trim(),
    theme: document.documentElement.dataset.theme,
  }))
  expect(r2.theme).toBe('dark')
  expect(r2.inline).toBe('#7d92ac')
  // 锁定态：成就清零后，高级皮肤应显示 🔒 且点击不改皮肤
  await page.evaluate(() => {
    document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').achievements = []
  })
  await page.waitForTimeout(400)
  expect(await page.locator('.skin-chip.locked').count()).toBe(14) // 15 套里除原味外全锁（成就清零）
  await page.locator('.skin-chip', { hasText: '琥珀' }).first().click()
  await page.waitForTimeout(300)
  const r3 = await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    return pinia._s.get('player').settings.skin
  })
  expect(r3).toBe('ink') // 点锁定皮肤不生效，仍是上一次生效的水墨
  // 音频开关与音量：写盘 → 重载 → 原样恢复
  const r4 = await page.evaluate(() => {
    const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
    p.settings.soundEnabled = true
    p.settings.bgmEnabled = true
    p.settings.sfxVolume = 0.35
    p.settings.bgmVolume = 0.15
    const key = Object.keys(localStorage).find((k) => k.startsWith('culinary-idle.save.'))
    // serialize() 返回的就是 player 本体（存档外层包裹由存档模块负责）
    localStorage.setItem(key, JSON.stringify({ player: JSON.parse(JSON.stringify(p.serialize())) }))
    const saved = JSON.parse(localStorage.getItem(key))
    return { bgm: saved.player.settings.bgmEnabled, sfx: saved.player.settings.sfxVolume, music: saved.player.settings.bgmVolume }
  })
  expect(r4.bgm).toBe(true)
  expect(r4.sfx).toBeCloseTo(0.35, 5)
  expect(r4.music).toBeCloseTo(0.15, 5)
  await page.reload()
  await page.waitForTimeout(600)
  await page.locator('.splash-start-btn').click()
  await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
  await page.waitForTimeout(1500)
  const r4b = await page.evaluate(() => {
    const st = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').settings
    return { bgm: st.bgmEnabled, sfx: st.sfxVolume, music: st.bgmVolume, theme: st.theme, skin: st.skin }
  })
  expect(r4b).toEqual({ bgm: true, sfx: 0.35, music: 0.15, theme: 'dark', skin: 'ink' })
  // 设置面板：4 个页签都能打开；「角色」页的存档入口能真的打开存档面板（2026-09-13 重构后新增）
  await page.evaluate(() => {
    document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui').toggleSettingsPanel(true)
  })
  await page.waitForTimeout(500)
  const tabTexts = await page.locator('.settings-tabs .btn').allInnerTexts()
  expect(tabTexts.length).toBe(4)
  for (const t of ['游玩', '画面', '音频', '角色']) {
    await page.locator('.settings-tabs .btn', { hasText: t }).first().click()
    await page.waitForTimeout(200)
    expect(await page.locator('.set-group').count()).toBeGreaterThan(0)
  }
  await page.locator('.settings-modal .btn', { hasText: '存档与导入导出' }).first().click()
  await page.waitForTimeout(500)
  expect(await page.locator('.settings-modal').count()).toBe(0) // 设置面板已关闭
  // 关掉存档面板，回到游戏继续后面的断言
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // BGM 接线：设置开关 → 真的启停；曲目按主题（深色 → 夜曲）
  const r5 = await page.evaluate(async () => {
    const realUrl = performance.getEntriesByType('resource').map((e) => e.name)
      .filter((n) => /\/src\/game\/core\/sound\.js(\?|$)/.test(n)).pop() || '/src/game/core/sound.js'
    const mod = await import(/* @vite-ignore */ realUrl)
    const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
    const snap = () => ({ playing: mod.bgm.playing(), track: mod.bgm.current() })
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const initial = snap() // 读档时 bgmEnabled=true + 深色 → 应已在播夜曲
    p.settings.bgmEnabled = false
    await wait(200)
    const off = snap()
    p.settings.bgmEnabled = true
    await wait(400)
    const on = snap()
    return { tracks: mod.bgm.tracks(), initial, off, on }
  })
  // 2026-09-17：曲库从 3 首合成曲扩到 13 首真实音频（10 场景 + 3 变奏，见 game/data/bgmTracks.js）
  expect(r5.tracks.length).toBeGreaterThanOrEqual(10)
  expect(r5.tracks).toContain('day')
  expect(r5.tracks).toContain('night')
  expect(r5.initial.playing).toBe(true)
  expect(r5.initial.track).toBe('night')
  expect(r5.off.playing).toBe(false) // 关掉 BGM → 调度停
  expect(r5.on.playing).toBe(true)   // 打开 BGM → 调度起
  expect(r5.on.track).toBe('night')
  expect(errors).toEqual([])
  void panel
})
