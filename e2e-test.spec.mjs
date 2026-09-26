// 端到端流程测试 — Playwright
// 覆盖：启动界面 → 开始游戏 → 选存档 → 进入主界面 → 各菜单/弹窗
import { test, expect } from '@playwright/test'
import fs from 'fs'
// 「指南」按钮的数据源（Node 侧直接用同一份数据断言渲染结果，避免在测试里手抄文案）
import { guideEntryForView as guideEntryForViewLocal } from './src/game/data/guide.js'
// 觅珍概率：期望值一律取自数据模块（面板/页头文案与它同源，测试不手抄数字）
import { allPoolOdds as allPoolOddsLocal, PITY_RULES } from './src/game/data/mijianDraws.js'

const BASE = 'http://localhost:5173'

test.describe('游戏全流程', () => {
  // 并行 + 时限合一（`configure` 分两次调可能互相覆盖，一次写完最稳）：这 20 条用例各自独立
  // （每条自建 localStorage 前置，Playwright 又给每个 test 独立的 browser context）⇒ 多 worker 并行跑
  // （2026-09-21，实测 2.8 分钟 → 约 1 分钟）。
  // 大厅入口随小游戏数量增长，逐个点完需要更长时间（2026-09-09：18 款 + 商店）
  test.describe.configure({ timeout: 90000, mode: 'parallel' })
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
    // 2026-09-20：状态面板改为**底部胶囊向上弹出**（原来是顶栏 ⚡ 呼出的右侧抽屉）——
    // ① 顶栏那颗 ⚡ 已按用户要求删除；② 默认不渲染面板；③ 点胶囊才出现、且是**向上**弹的浮层；
    // ④ 点外部关闭。
    await expect(page.locator('.top-nav-right button:has-text("状态")')).toHaveCount(0)
    await expect(page.locator('.dock-panel')).toHaveCount(0)
    await expect(page.locator('.dock-panel')).toHaveCount(0)
    // 用户要求：五块 = **五个独立胶囊**（挂机动向 / 食灵 / 奥义 / 快捷状态 / 事件日志）
    await expect(page.locator('.dock-pill')).toHaveCount(5)
    await expect(page.locator('.dock-pill[data-sec="spirit"]')).toBeVisible()
    const pill = page.locator('.dock-pill[data-sec="idle"]')
    await expect(pill).toBeVisible()
    await pill.click()
    await expect(page.locator('.dock-panel')).toBeVisible()
    const panelGeo = await page.evaluate(() => {
      const panel = document.querySelector('.dock-panel')
      const p = panel.getBoundingClientRect()
      const d = document.querySelector('.dock-pill[data-sec="idle"]').getBoundingClientRect()
      return { pos: getComputedStyle(panel).position, 向上: p.bottom <= d.top + 2, 在视口内: p.top >= 0 && p.right <= window.innerWidth + 1 }
    })
    expect(panelGeo.pos, '面板应是绝对定位的浮层').toBe('absolute')
    expect(panelGeo.向上, `面板必须从胶囊**向上**弹出：${JSON.stringify(panelGeo)}`).toBe(true)
    expect(panelGeo.在视口内, `面板不得超出视口：${JSON.stringify(panelGeo)}`).toBe(true)
    await page.locator('.dock-catcher').click({ position: { x: 30, y: 40 } })
    await expect(page.locator('.dock-panel')).toHaveCount(0)
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
    // 2026-09-18 留存改进 ⑤：未解锁的功能页默认收起（新档会少 10 个门槛页），
    // 本用例要点遍全部功能页，所以先按「显示全部」——顺便也就验证了这个开关本身可用。
    const showAllBtn = page.locator('.feature-hidden button', { hasText: '显示全部' })
    if (await showAllBtn.count()) { await showAllBtn.click(); await page.waitForTimeout(300) }
    // 2026-09-18 起左栏「功能」分组**默认折叠**（首屏只留 8 个分组入口，压掉「入口即成本」）。
    // 本用例要点遍全部磁贴，所以再按一次「全部展开」——顺带验证这个开关。
    const expandAllBtn = page.locator('.feature-hidden button', { hasText: '全部展开' })
    if (await expandAllBtn.count()) { await expandAllBtn.click(); await page.waitForTimeout(300) }
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

  // 商店「容量与扩建」：厨藏扩容上限 2500（2026-09-20 用户要求「商店的厨藏扩容从600提到2500」）。
  // 断言「行为」而不是文案：点一次「买满」后容量必须**真的能到 2500**，再买一次不涨（停在商店上限）。
  test('商店：厨藏扩容可以买到 2500 格（买满按钮 + 停在商店上限）', async ({ page }) => {
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(300)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)
    // 备足金币（买到 2500 要 1.8 万金币左右）
    await page.evaluate(async () => {
      const app = document.querySelector('#app').__vue_app__
      const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
      pinia._s.get('player').gold = 5_000_000
      pinia._s.get('ui').setView('shop')
    })
    await page.waitForTimeout(600)
    await page.locator('.region-tabs button', { hasText: '容量与扩建' }).click()
    await page.waitForTimeout(400)
    // 页签计数必须来自注册表（商品表里没有扩建条目，否则恒显示 0）
    await expect(page.locator('.region-tabs button', { hasText: '容量与扩建' })).not.toHaveText(/（0）/)
    const row = page.locator('.exp-row', { hasText: '厨藏扩容' }).first()
    await expect(row).toContainText('/ 2500')
    await row.locator('button', { hasText: '买满' }).click()
    await page.waitForTimeout(800)
    const after = await page.evaluate(() => {
      const app = document.querySelector('#app').__vue_app__
      const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
      return pinia._s.get('player').inventoryCap
    })
    expect(after, '「买满」应把厨藏容量买到商店上限 2500').toBe(2500)
    // 再点一次：停在 2500 不涨（也不报错）
    await row.locator('button', { hasText: '买满' }).click()
    await page.waitForTimeout(400)
    expect(await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').inventoryCap)).toBe(2500)
  })

  // 敌人立绘（2026-09-21）：**行为断言** —— 卡片与战斗屏必须真的加载出图（naturalWidth>0）。
  // 只查 DOM 里有 <img> 是不够的：路径写错、文件不在 dist、@error 隐藏，三种都会「看着有标签、其实没图」。
  test('对决页：敌人卡片与战斗屏都渲染立绘（不是 emoji 兜底）', async ({ page }) => {
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(300)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)
    await page.evaluate(async () => {
      const app = document.querySelector('#app').__vue_app__
      const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
      const p = pinia._s.get('player')
      p.skills.knife.level = 60
      p.setActiveSkill('knife')
      pinia._s.get('ui').setView('skill')
    })
    await page.waitForTimeout(900)
    // ① 区域卡片：把卡片区滚一遍（`loading="lazy"` 的图要进入视口才加载），再断言全部解码
    const loadAllPics = async () => {
      for (let i = 0; i < 8; i++) {
        const done = await page.evaluate(() => {
          const imgs = [...document.querySelectorAll('.monster-card .monster-pic')]
          return imgs.length > 0 && imgs.every((x) => x.naturalWidth > 0)
        })
        if (done) return
        await page.locator('.main-scroll').evaluate((el) => el.scrollBy(0, el.clientHeight * 0.8))
        await page.waitForTimeout(350)
      }
      await page.locator('.main-scroll').evaluate((el) => el.scrollTo(0, 0))
      await page.waitForTimeout(300)
    }
    await loadAllPics()
    const cards = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('.monster-card .monster-pic')]
      return { n: imgs.length, loaded: imgs.filter((i) => i.naturalWidth > 0).length, src: imgs[0]?.getAttribute('src') ?? '' }
    })
    expect(cards.n, '区域卡片应有立绘 img').toBeGreaterThan(1)
    expect(cards.loaded, `有 ${cards.n - cards.loaded} 张立绘没解码出来（src 例：${cards.src}）`).toBe(cards.n)
    // ⚠️ 扩展名是 `.webp`（2026-09-25 图片瘦身：248 张立绘 31.7MB → 6.5MB，分辨率一点没降）。
    //    这条断言的本意是「必须是**相对路径**」（exe 下 file:// 用绝对路径会 404），扩展名只是顺带钉住。
    expect(cards.src, '立绘必须是**相对路径**（exe 下 file:// 用绝对路径会 404）').toMatch(/^images\/enemies\/enemy_[A-Za-z]+_\d\d\.webp$/)
    // ② 首领分类也一样
    await page.locator('.pick-tabs .btn').nth(1).click()
    await page.waitForTimeout(500)
    await loadAllPics()
    const bosses = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('.monster-card .monster-pic')]
      return { n: imgs.length, loaded: imgs.filter((i) => i.naturalWidth > 0).length }
    })
    expect(bosses.n, '首领卡片应有立绘 img').toBeGreaterThan(1)
    expect(bosses.loaded).toBe(bosses.n)
    // ③ 开打：战斗屏右侧的对手立绘要出现（CombatArena 的 .arena-portrait--pic）
    await page.locator('.pick-tabs .btn').nth(0).click()
    await page.waitForTimeout(300)
    await page.locator('.monster-card .btn').first().click()
    await page.waitForTimeout(900)
    const arena = await page.evaluate(() => {
      const img = document.querySelector('.arena-side.foe .arena-portrait--pic')
      return img ? { has: true, loaded: img.naturalWidth > 0, src: img.getAttribute('src') } : { has: false }
    })
    expect(arena.has, '战斗屏对手位应换成立绘').toBe(true)
    expect(arena.loaded, `战斗屏立绘没解码出来：${arena.src}`).toBe(true)
  })

  test('厨藏页 / 设置 / 存档弹窗可打开并关闭', async ({ page }) => {
    await page.locator('.splash-start-btn').click()
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()

    // 厨藏（2026-09-19 由弹窗升级为**独立页面**，且厨藏与仓库同屏合一：不再有 .modal-backdrop）
    await page.locator('.top-nav-btn', { hasText: '厨藏' }).click()
    await expect(page.locator('.inventory-view')).toBeVisible()
    await expect(page.locator('.modal-backdrop')).toHaveCount(0)
    // 存储合一（2026-09-20）：只有一个厨藏 ⇒ 只有一格格子区 + 右侧详情与操作
    await expect(page.locator('.inv-grid')).toHaveCount(1)
    await expect(page.locator('.bag-detail')).toHaveCount(1)
    // 分类与「搜索/排序/卖装备」**同一排、工具组贴最右**（2026-09-20 用户要求「把红框那行移到上面一排最右边」）。
    // ⚠️ 首版用 `margin-left:auto` 做右靠：实测工具组只拿到 374px（内容 384）→ 组内自己折行，
    //    「💰 卖普通装备」被挤到第二排（看起来像两排控件）；改成 `flex:1 1 320px` + `justify-content:flex-end`。
    // 两条断言都要：① 两个子块**在竖向上重叠**（= 同一排，别拿 y 相等判断——两者高度不同、居中后 y 必然不同）；
    //                ② 工具组右缘贴住行右缘；③ 整条栏只有一排高、且组内按钮没被压到折字（折字后高 24→40）。
    const barGeo = await page.evaluate(() => {
      const bar = document.querySelector('.inv-bartop')
      const cs = getComputedStyle(bar)
      const cats = bar.children[0].getBoundingClientRect()
      const tb = bar.children[1].getBoundingClientRect()
      const btn = bar.children[1].querySelector('.btn').getBoundingClientRect()
      const r = bar.getBoundingClientRect()
      // 2026-09-20：这块加了卡背景（`.card` 有 12px 横向内距）⇒ 「贴最右」与「单排高」都要按**内容盒**算，
      // 否则量到的是加了内距的边框盒（实测差 13px / 高 52px），断言会误报。
      return {
        重叠: Math.round(Math.min(cats.bottom, tb.bottom) - Math.max(cats.top, tb.top)),
        组右缘: Math.round(tb.right), 行右缘: Math.round(r.right - parseFloat(cs.paddingRight || 0)),
        行高: Math.round(r.height - parseFloat(cs.paddingTop || 0) - parseFloat(cs.paddingBottom || 0)),
        按钮高: Math.round(btn.height),
      }
    })
    expect(barGeo.重叠, `分类与工具组不在同一排：${JSON.stringify(barGeo)}`).toBeGreaterThan(10)
    expect(Math.abs(barGeo.组右缘 - barGeo.行右缘), `工具组没贴最右：${JSON.stringify(barGeo)}`).toBeLessThanOrEqual(1)
    expect(barGeo.行高, `这一排被折成了多排：${JSON.stringify(barGeo)}`).toBeLessThanOrEqual(40)
    expect(barGeo.按钮高, `工具组内被压到折字：${JSON.stringify(barGeo)}`).toBeLessThanOrEqual(30)
    // 右侧详情（2026-09-20 第二轮：按用户给的梅尔沃截图重排）
    // ① 左列网格与右侧详情框**顶边对齐**（共用类 `.item-grid` 自带 `margin-top:10px`，实测差 10px）；
    // ② 面板结构 = 头（图标 + 名字 + 档位 + 「?」）→ 数量段（数字框 / 拉条 / 快选）→ 出售段（大按钮 + 合计）→ 使用段；
    // ③ 「详细作用 / 可用于制作 / 获取来源」**不再画在面板里**，只在「?」弹窗里（面板里 tables 必须为 0）；
    // ④ 拉条驱动数量（对数刻度，拉到最右 = 持有量），且**合计金币 = 单价 × 数量**（与 `sellItem` 同口径）。
    // 新档背包是空的 ⇒ 先塞三样（可使用的消耗品 / 万级数量 / 普通食材）才有格子可点
    await page.evaluate(async () => {
      const app = document.querySelector('#app').__vue_app__
      const pinia = app.config.pinia ?? app.config.globalProperties.$pinia
      const p = pinia._s.get('player')
      const ITEMS = (await import('/src/game/data/items.js')).ITEMS
      let put = 0
      for (const [id, it] of Object.entries(ITEMS)) {
        if (it.type === 'spirit') continue
        p.inventory[id] = put === 0 ? 999 : put === 1 ? 38910 : 50
        put++
        if (put >= 3) break
      }
      p.inventory.apple = 50
    })
    await page.waitForTimeout(300)
    await page.locator('.inv-grid .item-cell').first().click()
    await expect(page.locator('.bag-detail .bd-range')).toHaveCount(1)
    const detailGeo = await page.evaluate(() => {
      // 2026-09-20：左侧多了「面板页签 + 卡背景」⇒ 与右栏对齐的应是**两张卡**的顶边
      // （格子本身在卡内、页签之下，天然低一截；组件时代那条「格子 vs 详情框」的口径已不适用）
      const grid = document.querySelector('.inv-col')
      const det = document.querySelector('.bag-detail')
      const acts = document.querySelector('.bd-acts')
      const tops = [...acts.children].map((c) => Math.round(c.getBoundingClientRect().top))
      const head = document.querySelector('.bd-head')
      return {
        顶部差: Math.round(grid.getBoundingClientRect().top - det.getBoundingClientRect().top),
        操作行内顶部跨度: Math.max(...tops) - Math.min(...tops),
        使用按钮数: [...document.querySelectorAll('.bag-detail .btn')].filter((b) => b.textContent.trim().startsWith('使用')).length,
        操作容器数: document.querySelectorAll('.bag-detail .inv-acts').length,
        有图标: !!document.querySelector('.bd-head .bd-icon'),
        有信息按钮: !!document.querySelector('.bd-head .bd-info'),
        面板内表格与来源块: document.querySelectorAll('.bag-detail table, .bag-detail .bag-detail-src').length,
        主按钮: det.querySelector('.bd-main')?.textContent.trim(),
        合计: det.querySelector('.bd-total')?.textContent.trim(),
        档位徽章: head?.querySelector('.badge')?.textContent.trim() ?? '',
      }
    })
    expect(detailGeo.顶部差, `左右两张卡顶边没对齐：${JSON.stringify(detailGeo)}`).toBe(0)
    expect(detailGeo.操作行内顶部跨度, `快选没排成一行：${JSON.stringify(detailGeo)}`).toBeLessThanOrEqual(6)
    expect(detailGeo.操作容器数, `快选被拆成了两行：${JSON.stringify(detailGeo)}`).toBe(1)
    expect(detailGeo.使用按钮数, `出现了重复的「使用」按钮：${JSON.stringify(detailGeo)}`).toBeLessThanOrEqual(1)
    expect(detailGeo.有图标 && detailGeo.有信息按钮, `面板头缺图标或「?」按钮：${JSON.stringify(detailGeo)}`).toBe(true)
    expect(detailGeo.面板内表格与来源块, `详情/来源应只在弹窗里，面板里不该再有：${JSON.stringify(detailGeo)}`).toBe(0)
    expect(detailGeo.主按钮, `出售段缺主按钮：${JSON.stringify(detailGeo)}`).toMatch(/^出售 \d+ 个$/)
    expect(detailGeo.合计, `出售段缺合计金币：${JSON.stringify(detailGeo)}`).toMatch(/^💰 合计 [\d,]+ 金币$/)
    // 「?」按钮打开详情弹窗（详细作用 + 可用于制作 + 获取来源三者都在里面）
    await page.locator('.bd-info').click()
    await expect(page.locator('.item-detail-modal')).toBeVisible()
    await expect(page.locator('.item-detail-modal')).toContainText('详细作用')
    await expect(page.locator('.item-detail-modal')).toContainText('获取来源')
    await page.locator('.item-detail-modal .modal-head button').click()
    await expect(page.locator('.item-detail-modal')).toHaveCount(0)
    // 拉条驱动数量：拉到最右 = 全部（数字框与「出售 N 个」都要跟着变），且合计 = 单价 × 数量
    const slider = page.locator('.bag-detail .bd-range')
    const maxQty = await slider.getAttribute('max')
    await page.evaluate((m) => {
      const el = document.querySelector('.bd-range')
      el.value = m
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, maxQty)
    await page.waitForTimeout(200)
    const sellGeo = await page.evaluate(() => {
      const num = document.querySelector('.bd-num')?.value
      const main = document.querySelector('.bd-main')?.textContent.trim()
      const total = document.querySelector('.bd-total')?.textContent.replace(/[^\d]/g, '')
      const price = document.querySelector('.bd-sect-head .mono.dim')?.textContent.replace(/[^\d]/g, '')
      return { num: Number(num), main, total: Number(total), price: Number(price) }
    })
    expect(sellGeo.num, '拉条拖到最右应等于该物品的持有数量').toBeGreaterThan(1)
    expect(sellGeo.main, `主按钮没跟着数量变：${JSON.stringify(sellGeo)}`).toBe(`出售 ${sellGeo.num} 个`)
    expect(sellGeo.total, `合计 ≠ 单价 × 数量：${JSON.stringify(sellGeo)}`).toBe(sellGeo.price * sellGeo.num)
    // 数量药丸：≥1 万显示「x.xx万」、<1 万显示精确数字（悬停时万级换成精确数字）
    // ⚠️ 必须用 **innerText**（只算渲染出来的文字），不能用 textContent：
    //    2026-09-26 起药丸里**同时存在**「缩写」与「精确」两份文案，由 CSS `:hover` 决定显示哪个
    //    （这样悬停不再触发任何 JS/重渲染，修掉了满背包「每划一格掉 2 帧」）——
    //    textContent 会把两份拼成「3.89万38,910」，实测就是这么 FAIL 的。
    const pill = await page.evaluate(() => {
      const pills = [...document.querySelectorAll('.inv-grid .inv-cell-qty')].map((p) => p.innerText.trim())
      return { 万级: pills.find((t) => t.includes('万')) ?? '', 精确: pills.find((t) => /^[\d,]+$/.test(t) && Number(t.replace(/,/g, '')) < 10000) ?? '' }
    })
    expect(pill.万级, `≥1 万应显示「x.xx万」：${JSON.stringify(pill)}`).toMatch(/^\d+\.\d\d万$/)
    expect(pill.精确, `<1 万应显示精确数字：${JSON.stringify(pill)}`).toMatch(/^[\d,]+$/)
    // ⚠️ 定位「万级格子」必须**先取下标**再用 `.nth()`：悬停后可见文案就从「x.xx万」变成精确数字了，
    //    用 `hasText:'万'` 的定位器会在悬停那一刻失效 → 后续 innerText 永远等不到（实测踩过）。
    const wanIdx = await page.evaluate(() => [...document.querySelectorAll('.inv-grid .inv-cell-qty')].findIndex((p) => p.innerText.includes('万')))
    expect(wanIdx, '应有 ≥1 万的物品用于验证「x.xx万」').toBeGreaterThanOrEqual(0)
    const wanCell = page.locator('.inv-grid .item-cell').nth(wanIdx)
    const beforeHover = await wanCell.locator('.inv-cell-qty').innerText()
    await wanCell.hover()
    await page.waitForTimeout(250)
    const afterHover = await page.locator('.inv-grid .item-cell').nth(wanIdx).locator('.inv-cell-qty').innerText()
    expect(afterHover, `悬停应换成精确数字：${beforeHover} → ${afterHover}`).toMatch(/^[\d,]+$/)
    expect(Number(afterHover.replace(/,/g, '')), '悬停后的精确数字要与「x.xx万」同量级').toBeGreaterThan(10000)
    await page.mouse.move(4, 700)
    await page.waitForTimeout(250)
    expect(await page.locator('.inv-grid .item-cell').nth(wanIdx).locator('.inv-cell-qty').innerText(), '移开光标应回到「x.xx万」').toContain('万')
    // 容量文字与工具组同一排、且排在搜索框左边
    const capGeo = await page.evaluate(() => {
      const cap = document.querySelector('.inv-cap')
      const search = document.querySelector('.inv-search')
      if (!cap || !search) return null
      const c = cap.getBoundingClientRect(); const s = search.getBoundingClientRect()
      return { 同一排: Math.abs(c.top + c.height / 2 - (s.top + s.height / 2)) < 12, 在搜索框左边: c.right <= s.left, 文案: cap.textContent.replace(/\s+/g, ' ').trim() }
    })
    expect(capGeo, '容量文字应移进工具行（搜索框左边）').not.toBeNull()
    expect(capGeo.同一排, `容量文字与搜索框不在同一排：${JSON.stringify(capGeo)}`).toBe(true)
    expect(capGeo.在搜索框左边, `容量文字应在搜索框左边：${JSON.stringify(capGeo)}`).toBe(true)
    expect(capGeo.文案).toMatch(/^厨藏空间 \d+ \/ \d+ 格$/)
    // 装备也走页面
    await page.locator('.top-nav-btn', { hasText: '装备' }).click()
    await expect(page.locator('.equipment-view')).toBeVisible()
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
      // ⚠️ 220ms 固定等待会偶发竞态：并行 worker 下个别页（实测 festival）还没渲染完就被判「空」，
      //    整条守卫随机 FAIL。改成「轮询等内容出现、最多 1.5s」，既不放松判据也不留 flaky。
      let hasContent = false
      for (let i = 0; i < 10 && !hasContent; i++) {
        await page.waitForTimeout(i === 0 ? 120 : 150)
        // 每个已注册页面都必须渲染出内容（SkillView 兜底页也满足，故用告警而非 DOM 判定回退）
        hasContent = await page.evaluate(() => document.querySelector('.main-scroll')?.innerText?.trim().length > 20)
      }
      if (!hasContent) rendered.push(v)
    }
    expect(warns, `以下 view key 未在 ui.js 的 VIEW_KEYS 中登记：\n${warns.join('\n')}`).toEqual([])
    expect(rendered, `以下页面切换后内容为空：${rendered.join('、')}`).toEqual([])
  })

  // 守卫：响应式断点的 display 规则曾被「声明在媒体查询之后的基础规则」反向覆盖
  // （`.status-panel`/`.sidebar`/`.mobile-nav` 都是 (0,1,0) 特指度且更靠后）——右栏在手机上照旧占满屏、
  // 底部导航则**任何宽度都不显示**。修法是在媒体查询里加 `.app-layout` 前缀提权，此处逐条断言防回归。
  // 2026-09-19：右栏改抽屉后这条守卫的含义变了 —— 现在要防的是**反向的**回归：
  //   ① 面板必须是**相对底栏的 absolute 浮层**（若基准选错成胶囊那一小段，窄屏会横向出界——实测 left=-136）；
  //   ② 窄屏**不许**再出现 `display:none`（那六块内容在平板/手机上本来就看不到，是本次顺手修的缺陷）。
  test('响应式：抽屉为 fixed 浮层且窄屏也可呼出、手机单栏 + 底部导航可用', async ({ page }) => {
    const disp = (sel) => page.evaluate((s) => {
      const el = document.querySelector(s)
      return el ? getComputedStyle(el).display : 'MISSING'
    }, sel)
    const openDrawer = () => page.locator('.dock-pill[data-sec="idle"]').click()

    await page.locator('.splash-start-btn').click()
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)

    // 桌面：两栏（左栏 + 主内容）+ 底部导航隐藏；底部胶囊常驻、面板默认不渲染
    expect(await disp('.app-sidebar')).toBe('flex')
    expect(await page.locator('.dock-panel').count()).toBe(0)
    expect(await disp('.mobile-nav')).toBe('none')
    expect(await disp('.dock-pill')).not.toBe('MISSING')
    expect(await page.locator('.dock-pill').count(), '五个胶囊应常驻（宽屏）').toBe(5)
    await openDrawer()
    const drawer = await page.evaluate(() => {
      const panel = document.querySelector('.dock-panel')
      const cs = getComputedStyle(panel)
      const r = panel.getBoundingClientRect()
      const d = document.querySelector('.dock-pill[data-sec="idle"]').getBoundingClientRect()
      return { pos: cs.position, z: Number(cs.zIndex), w: Math.round(r.width), 向上: r.bottom <= d.top + 2 }
    })
    expect(drawer.pos, '面板应是 absolute 浮层（相对底栏向上弹）').toBe('absolute')
    expect(drawer.z, '面板 z-index 必须高于内容').toBeGreaterThan(40)
    expect(drawer.向上, '面板必须从胶囊向上弹出').toBe(true)
    expect(drawer.w).toBeGreaterThan(200)

    // 平板（<940）：胶囊**仍可呼出**（此前这里是 display:none，那六块内容玩家看不到）
    await page.setViewportSize({ width: 900, height: 900 })
    await page.waitForTimeout(400)
    expect(await disp('.app-sidebar')).toBe('flex')
    expect(await page.locator('.dock-panel').count(), '平板下面板仍应可呼出').toBe(1)
    // 中区应占满高度
    const h = await page.evaluate(() => Math.round(document.querySelector('.app-main').getBoundingClientRect().height))
    expect(h, '平板下中区应占满高度').toBeGreaterThan(800)
    // ⚠️ 必须关掉：点外关闭层是 fixed inset:0，会挡住底部导航，后续点击会一直重试到超时（本轮实测踩过）
    await page.locator('.dock-catcher').click({ position: { x: 20, y: 20 } })
    expect(await page.locator('.dock-panel').count()).toBe(0)

    // 手机（<720）：单栏 + 底部导航出现
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(400)
    expect(await disp('.app-sidebar')).toBe('none')
    expect(await disp('.mobile-nav')).toBe('flex')
    // 窄屏：底部胶囊常驻在底栏里，点开后面板不得超出视口
    await openDrawer()
    await page.waitForTimeout(300)
    const mw = await page.evaluate(() => {
      const panel = document.querySelector('.dock-panel')
      if (!panel) return null
      const r = panel.getBoundingClientRect()
      return { w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right), pos: getComputedStyle(panel).position }
    })
    expect(mw, '手机下面板应能呼出').not.toBeNull()
    expect(mw.left, '手机下面板左边不得出界').toBeGreaterThanOrEqual(0)
    expect(mw.right, '手机下面板不得超出视口右缘').toBeLessThanOrEqual(391)
    // 手机下面板改成**视口定位**（`position: fixed` + 左右各留 8px）：胶囊组只占右侧一小段，
    // 以它为基准会算到 left=-128（实测），故窄屏换了定位方式——这里接受 absolute / fixed 两种。
    expect(['absolute', 'fixed']).toContain(mw.pos)
    await page.locator('.dock-catcher').click({ position: { x: 20, y: 20 } })
    await page.waitForTimeout(300)

    // 底部导航可用：🏠 打开技能抽屉 → 抽屉内 Sidebar 可见 → 选技能后抽屉收起
    await page.locator('.mobile-nav-btn').first().click()
    await page.waitForTimeout(400)
    expect(await disp('.mobile-skills .sidebar'), '抽屉内 Sidebar 应可见').toBe('flex')
    await page.locator('.mobile-skills .skill-item').first().click()
    await page.waitForTimeout(400)
    expect(await page.locator('.mobile-skills').count(), '选完技能抽屉应收起').toBe(0)
  })

  test('左栏：点任意技能后技能列表仍在（页签 key 不能与侧栏不一致）', async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(300)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await page.waitForTimeout(800)

    // 逐个点技能（含副业五支），每次都要有「某个 nav 可见」——
    // 三个 nav 的 v-show 全为假时左栏会**整个空白**（2026-09-17 用户实测报过：
    // `SKILL_CATEGORIES.tab` 写了单数 'skill'，而侧栏判的是 'skills' ⇒ 点任何技能都清空左栏）
    const ids = await page.evaluate(() => [...document.querySelectorAll('.app-sidebar button.skill-item')].length
      ? Object.keys(document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').skills)
      : [])
    expect(ids.length, '应能取到技能 id 列表').toBeGreaterThan(20)
    for (const id of ids) {
      await page.evaluate((sid) => {
        document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').setActiveSkill(sid)
      }, id)
      await page.waitForTimeout(80)
      const visible = await page.evaluate(() => [...document.querySelectorAll('.app-sidebar nav')].filter((n) => n.offsetParent !== null).length)
      expect(visible, `技能「${id}」激活后左栏应有可见列表（实际 0 个）`).toBeGreaterThan(0)
    }
    expect(errors, `控制台错误：${errors.join(' | ')}`).toEqual([])
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

  // 右下角背景音乐播放器（2026-09-17）：胶囊 → 向上展开选曲 → 真实音频真的在播 → 存档往返
  test('背景音乐播放器：展开选曲 / 真实音频在播 / 响度衰减 / 选曲持久化', async ({ page }) => {
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(1500)
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(500)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1200)

    // ① 胶囊在右下角、默认收起
    const pill = page.locator('.bgm-pill')
    await expect(pill).toBeVisible()
    const vw = page.viewportSize()
    const box = await pill.boundingBox()
    expect(vw.width - (box.x + box.width)).toBeLessThan(40)
    expect(vw.height - (box.y + box.height)).toBeLessThan(40)

    // ② 点胶囊右半（曲名/箭头）向上展开：面板出现在胶囊上方，且列出全部曲目 + 1 行「自动」
    //    2026-09-18 起胶囊是一整条常驻控制（🔊 / ⏮ / ⏸ / ⏭ / 模式 / 曲名），只有「曲名」那半负责展开
    await pill.locator('.bgm-open').click()
    const panel = page.locator('.bgm-panel')
    await expect(panel).toBeVisible()
    const pbox = await panel.boundingBox()
    expect(pbox.y).toBeLessThan(box.y) // 在胶囊之上 = 向上展开
    await expect(page.locator('.bgm-row')).toHaveCount(14)

    // ③ 选一首：真实音频开始播、音量被压成背景级（母带级音频必须衰减）
    await page.locator('.bgm-row', { hasText: '夜市灯火 · 其二' }).click()
    await page.waitForTimeout(1600)
    const st = await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/game/core/sound.js'))
      const { bgm } = await import(/* @vite-ignore */ url)
      const pl = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
      return { current: bgm.current(), playing: bgm.playing(), real: bgm.usingRealAudio(), vol: bgm.realVolume(), track: pl.settings.bgmTrack, count: bgm.playingCount() }
    })
    expect(st.track).toBe('market2')
    expect(st.current).toBe('market2')
    expect(st.real).toBe(true)
    expect(st.playing).toBe(true)
    expect(st.vol).toBeGreaterThan(0)
    expect(st.vol).toBeLessThan(0.4) // 默认音量 0.35 × 0.6 × trim
    expect(st.count).toBe(1)

    // ③b 连切三首：**任意时刻只能有一首在出声**（2026-09-17 用户报「点其它音乐会重叠播放」的回潮守卫）
    for (const name of ['山海晨光', '堂前烟火', '山海盛宴']) {
      await page.locator('.bgm-row', { hasText: name }).click()
      await page.waitForTimeout(1500) // 等 1.2s 交叉淡变走完
      const c = await page.evaluate(async () => {
        const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/game/core/sound.js'))
        const { bgm } = await import(/* @vite-ignore */ url)
        return { count: bgm.playingCount(), cur: bgm.current() }
      })
      expect(c.count).toBe(1)
    }

    // ③c 暂停 / 继续：暂停要真静音、继续要**从原进度**接上（不是重头）
    await page.locator('.bgm-pill .bgm-tbtn--play').click()
    await page.waitForTimeout(1500)
    const pausedSt = await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/game/core/sound.js'))
      const { bgm } = await import(/* @vite-ignore */ url)
      const pl = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
      return { playing: bgm.playing(), count: bgm.playingCount(), pos: bgm.position(), flag: pl.settings.bgmPaused }
    })
    expect(pausedSt.playing).toBe(false)
    expect(pausedSt.count).toBe(0)
    expect(pausedSt.flag).toBe(true)
    expect(pausedSt.pos).toBeGreaterThan(0)
    await page.locator('.bgm-pill .bgm-tbtn--play').click()
    await page.waitForTimeout(1600)
    const resumed = await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/game/core/sound.js'))
      const { bgm } = await import(/* @vite-ignore */ url)
      return { playing: bgm.playing(), count: bgm.playingCount(), pos: bgm.position() }
    })
    expect(resumed.count).toBe(1)
    expect(resumed.pos).toBeGreaterThanOrEqual(pausedSt.pos) // 没被重置回 0

    // ③d 常驻控制条（2026-09-18）：收起态就有 🔊 开关 / 上一首 / 播放暂停 / 下一首 / 播放模式
    await expect(page.locator('.bgm-pill button')).toHaveCount(5) // 2026-09-18 起删掉了最左的 🔊
    await expect(page.locator('.bgm-pill button[aria-label="下一首"]')).toBeVisible()
    await expect(page.locator('.bgm-pill button[aria-label="上一首"]')).toBeVisible()
    await expect(page.locator('.bgm-pill button[aria-label="播放模式"]')).toBeVisible()
    // 🔊 开关已按用户要求从胶囊上删除（改到 设置 → 🔊 音频 页签），这里断言它真的不在胶囊里
    await expect(page.locator('.bgm-pill button[aria-label="关闭背景音乐"]')).toHaveCount(0)

    // ③e ⏭ 走列表下一首、⏮ 回到上一首
    const trackAt = () => page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').settings.bgmTrack)
    const before1 = await trackAt()
    await page.locator('.bgm-pill button[aria-label="下一首"]').click()
    await page.waitForTimeout(1500)
    const after1 = await trackAt()
    expect(after1).not.toBe(before1)
    await page.locator('.bgm-pill button[aria-label="上一首"]').click()
    await page.waitForTimeout(1500)
    expect(await trackAt()).toBe(before1)

    // ③f 播放模式轮换 + 引擎 loop 同步（单曲循环 loop=true；顺序/随机 loop=false）
    const modeState = () =>
      page.evaluate(async () => {
        const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/game/core/sound.js'))
        const { bgm } = await import(/* @vite-ignore */ url)
        const pl = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
        return { setting: pl.settings.bgmMode, engine: bgm.mode(), loop: bgm.looped() }
      })
    expect((await modeState()).setting).toBe('repeat')
    await page.locator('.bgm-pill button[aria-label="播放模式"]').click()
    await page.waitForTimeout(400)
    const seqMode = await modeState()
    expect(seqMode.setting).toBe('sequence')
    expect(seqMode.engine).toBe('sequence')
    expect(seqMode.loop).toBe(false) // 顺序模式不许循环，放完要接下一首

    // ③g 顺序播放：把当前曲推到结尾 → 自动接列表下一首（用引擎的 seek 驱动真实的 ended 事件）
    await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/game/core/sound.js'))
      const { bgm } = await import(/* @vite-ignore */ url)
      bgm.seek(bgm.duration() - 0.3)
    })
    await page.waitForTimeout(3500)
    const advanced = await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/game/core/sound.js'))
      const { bgm } = await import(/* @vite-ignore */ url)
      return { cur: bgm.current(), playing: bgm.playing(), count: bgm.playingCount() }
    })
    expect(advanced.cur).not.toBe(seqMode.setting === 'sequence' ? null : advanced.cur)
    expect(advanced.cur).not.toBe(before1) // 换了一首
    expect(advanced.playing).toBe(true)
    expect(advanced.count).toBe(1)
    // 收拾现场：回到单曲循环，免得后面的「自动」断言受模式影响
    await page.evaluate(() => {
      document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').settings.bgmMode = 'repeat'
    })
    await page.waitForTimeout(300)

    // ④ 点「自动」→ 跟随场景（技能页·采摘 = 主界面白天曲）
    await page.locator('.bgm-row', { hasText: '自动' }).click()
    await page.waitForTimeout(1200)
    const auto = await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/game/core/sound.js'))
      const { bgm } = await import(/* @vite-ignore */ url)
      return bgm.current()
    })
    expect(auto).toBe('day')
    await expect(page.locator('.bgm-panel')).toBeVisible() // 选完不自动收起，方便连续试听

    // ⑤ 手动选曲写进存档：显式存档 → 读档后仍是那首
    await page.locator('.bgm-row', { hasText: '山海盛宴' }).click()
    await page.waitForTimeout(900)
    await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/game/bootstrap.js'))
      const { saveNow } = await import(/* @vite-ignore */ url)
      saveNow()
    })
    await page.waitForTimeout(300)
    const savedTrack = await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith('culinary-idle.save.')) continue
        try {
          const s = JSON.parse(localStorage.getItem(k))
          return s?.player?.settings?.bgmTrack
        } catch { /* 忽略坏档 */ }
      }
      return null
    })
    expect(savedTrack).toBe('boss')

    // ⑥ 胶囊宽度恒定（2026-09-18 用户报「播放器老是变短变长」）：
    //    曲名长短（2 字的「自动」/ 4 字曲名 / 9 字变奏曲名）与播放-暂停态，都不许改变胶囊宽度。
    //    成因备忘：`.bgm-name` 原先只写了 `max-width`（跟着内容伸缩）、⏸/▶ 字形宽度也差 1.8px。
    const pillWidth = async () => Math.round((await pill.boundingBox()).width * 100) / 100
    const setTrack = async (tid) => {
      await page.evaluate((t) => {
        const pl = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
        pl.settings.bgmTrack = t
        pl.settings.bgmEnabled = true
        pl.settings.bgmPaused = false
      }, tid)
      await page.waitForTimeout(260)
    }
    const widths = []
    for (const tid of [null, 'day', 'memory2']) { // 自动(2 字) / 采撷昼日(4 字) / 旧谱余香 · 其二(9 字)
      await setTrack(tid)
      widths.push(await pillWidth())
    }
    await page.locator('.bgm-pill .bgm-tbtn--play').click() // 切到暂停态
    await page.waitForTimeout(300)
    widths.push(await pillWidth())
    expect(Math.max(...widths) - Math.min(...widths), `胶囊宽度随状态变化：${widths.join(' / ')}`).toBeLessThan(0.6)
    // 暂停态不再拼「已暂停 ·」前缀（用户要求那三个字不要），暂停只由 ⏸/▶ 图标表达
    await expect(page.locator('.bgm-pill')).not.toContainText('已暂停')
    await expect(page.locator('.bgm-pill .bgm-name')).toHaveText('旧谱余香 · 其二')
    await page.locator('.bgm-pill .bgm-tbtn--play').click() // 恢复播放
    await page.waitForTimeout(200)

    // ⑦ 高度与旁边五个功能胶囊一致（2026-09-21 用户：「BGM 胶囊是不是融合进底栏了，那大小应该也适配为
    //    旁边五个胶囊的大小」）。原先 BGM 胶囊 33px（竖 padding 7px）、窄屏更被 `padding: 7px 10px`
    //    撑到 47px，而五个胶囊是 24px ⇒ 右下角看起来是**两块**东西。
    //    ⚠️ 只做**行为断言**（量真实高度）：高度来自 `--dock-pill-h` 这个单一 token，写死谁的样式都会被这里抓住。
    const heights = await page.evaluate(() => {
      const pills = [...document.querySelectorAll('.dock-pill')]
      const bgm = document.querySelector('.bgm-pill')
      const box = (el) => {
        const r = el.getBoundingClientRect()
        return { h: Math.round(r.height * 100) / 100, bottom: Math.round(r.bottom * 100) / 100, top: Math.round(r.top * 100) / 100 }
      }
      return { pills: pills.map(box), bgm: box(bgm), token: getComputedStyle(document.documentElement).getPropertyValue('--dock-pill-h').trim() }
    })
    const pillH = heights.pills.map((x) => x.h)
    expect(heights.pills.length, '五个功能胶囊应都在').toBe(5)
    expect(Math.max(...pillH) - Math.min(...pillH), `五个胶囊高度不一致：${pillH.join(' / ')}`).toBeLessThan(0.6)
    expect(heights.bgm.h, `BGM 胶囊 ${heights.bgm.h}px 与功能胶囊 ${pillH[0]}px 不等高（应都等于 --dock-pill-h=${heights.token}）`).toBeCloseTo(pillH[0], 0)
    expect(heights.bgm.h, '--dock-pill-h 与实际高度对不上（有人写死了高度）').toBeCloseTo(Number.parseFloat(heights.token), 0)
    // 间距也必须一致：五个胶囊彼此的 gap 是 5px，BGM 胶囊与第 5 个胶囊的间距**也要是同一个值**，
    // 否则整条读起来是「一排胶囊 + 右边一个东西」（用户 2026-09-21：「是不是融合进底栏了」）。
    // ⚠️ 这条同时兜住 `.dock { right: Npx }` 的漂移：改 BGM 胶囊横向 padding/字号会让它变宽，N 必须跟着改。
    const gaps = await page.evaluate(() => {
      const pills = [...document.querySelectorAll('.dock-pill')].map((x) => x.getBoundingClientRect())
      const cap = document.querySelector('.bgm-pill').getBoundingClientRect()
      return { inner: +(pills[1].left - pills[0].right).toFixed(2), 末到BGM: +(cap.left - pills[pills.length - 1].right).toFixed(2), 溢出: document.documentElement.scrollWidth > window.innerWidth }
    })
    expect(Math.abs(gaps.inner - gaps.末到BGM), `胶囊间距不一致（彼此 ${gaps.inner} vs BGM ${gaps.末到BGM}）—— 应同为 5px`).toBeLessThan(1.6)
    expect(gaps.溢出, '底栏不得横向溢出').toBe(false)
    // 底栏条（左边那条目标条）也必须同高：2026-09-21 用户报「左边目标的条是占满底栏的吗、胶囊没占满」——
    // 实测目标条 35px、胶囊 24px（底边对齐、顶边差 11px）⇒ 现两边同取 `--dock-pill-h`。
    const stripH = await page.evaluate(() => {
      const s = document.querySelector('.head-strips')
      const p2 = document.querySelector('.dock-pill')
      return { strip: +s.getBoundingClientRect().height.toFixed(2), pill: +p2.getBoundingClientRect().height.toFixed(2), bottomDiff: Math.abs(s.getBoundingClientRect().bottom - p2.getBoundingClientRect().bottom).toFixed(2) }
    })
    expect(stripH.strip, `底栏条 ${stripH.strip}px 与胶囊 ${stripH.pill}px 不等高`).toBeCloseTo(stripH.pill, 0)
    expect(Number(stripH.bottomDiff), '底栏条与胶囊的底边不齐').toBeLessThan(1.5)
    // 同一排：底边对齐（两者都是 bottom:0 ⇒ 等高即齐平）
    const bottoms = [...heights.pills.map((x) => x.bottom), heights.bgm.bottom]
    expect(Math.max(...bottoms) - Math.min(...bottoms), `底边不齐：${bottoms.join(' / ')}`).toBeLessThan(1.5)
  })

  // 装备页两个 2026-09-21 用户要求（同一天提的两条）：
  //   ① 「背包可穿戴分类应该是八个分类」 —— 原来只有 武器/防具/饰品 三组（防具把四个槽位混在一起）；
  //   ② 「所有面板应该默认长宽为最大的长宽」 —— 原来 `align-items: start`，各卡按内容高矮参差，
  //      卡片之间露出页面底色（用户截图里那几片空白就是它）。
  test('装备页：八个槽位分类都能筛出对应槽位的装备 + 面板铺满网格区', async ({ page }) => {
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(1400)
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(400)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)
    await page.setViewportSize({ width: 1440, height: 900 })
    // 灌一批覆盖全部 8 个槽位的装备进背包
    await page.evaluate(async () => {
      const ITEMS = (await import('/src/game/data/items.js')).ITEMS
      const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
      const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui')
      for (const key of Object.keys(p.inventory)) delete p.inventory[key]
      const bySlot = {}
      for (const it of Object.values(ITEMS)) {
        if (it.type !== 'equipment' || !it.slot) continue
        bySlot[it.slot] = bySlot[it.slot] ?? []
        if (bySlot[it.slot].length < 3) { bySlot[it.slot].push(it.id); p.inventory[it.id] = 1 }
      }
      p.gold = 50000
      ui.setView('equipment')
    })
    await page.waitForTimeout(600)

    // ① 八个槽位分类（+ 全部）：逐个点过去，列出的件数必须 == 背包里该槽位的件数
    const cat = await page.evaluate(async () => {
      const ITEMS = (await import('/src/game/data/items.js')).ITEMS
      const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
      const btns = [...document.querySelectorAll('.equip-cat-tabs button')]
      const rows = () => [...document.querySelectorAll('.equip-pane--bag .equip-card')].length
      const out = []
      for (let i = 0; i < btns.length; i++) {
        btns[i].click()
        await new Promise((r) => setTimeout(r, 220))
        const slot = i === 0 ? null : Object.keys(p.equipment)[i - 1]
        const expect = Object.entries(p.inventory).filter(([id, q]) => q > 0 && ITEMS[id]?.type === 'equipment' && (!slot || ITEMS[id]?.slot === slot)).length
        out.push({ tab: btns[i].textContent.trim(), slot, listed: rows(), expect })
      }
      return { count: btns.length, slots: Object.keys(p.equipment).length, out }
    })
    expect(cat.slots, '玩家应有 8 个装备槽位').toBe(8)
    expect(cat.count, '分类 = 全部 + 8 个槽位').toBe(9)
    for (const o of cat.out) expect(o.listed, `「${o.tab}」分类列出 ${o.listed} 件，应为 ${o.expect} 件`).toBe(o.expect)
    // 标签要是中文槽位名（不许直出 id）
    expect(cat.out.slice(1).map((o) => o.tab).join('')).not.toMatch(/[a-z]/)

    // ⚠️ 上面那轮分类循环停在最后一个槽位上（饰品2），这里要先点回「全部」再量卡片总数
    await page.evaluate(() => { document.querySelectorAll('.equip-cat-tabs button')[0].click() })
    await page.waitForTimeout(300)

    // ①b 背包可穿戴 = **卡片网格**（2026-09-21 用户：「改成卡片式显示」），且**不许被压扁** ——
    //     上一轮我给 `.equip-pane` 加了 `display:flex; flex-direction:column`（想让内容从顶部排），
    //     结果这份限高内滚的清单一夜之间被压成几像素高、文字叠在一起（定高 flex 列里子项默认会 shrink）。
    const bag = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.equip-card')]
      const tops = [...new Set(cards.map((c) => Math.round(c.getBoundingClientRect().top)))]
      const hs = cards.map((c) => Math.round(c.getBoundingClientRect().height * 10) / 10)
      const names = cards.map((c) => c.querySelector('.equip-card-name')?.textContent.trim())
      return { n: cards.length, rows: tops.length, minH: Math.min(...hs), maxH: Math.max(...hs), imgs: cards.filter((c) => c.querySelector('img')).length, btns: cards.filter((c) => c.querySelector('button')).length, dupNames: names.filter((x, i) => names.indexOf(x) === i).length }
    })
    expect(bag.n, '背包里应有可穿戴装备（>=9 件：8 槽各若干）').toBeGreaterThanOrEqual(9)
    expect(bag.rows, `卡片应排成多行（实测 ${bag.rows} 行）`).toBeGreaterThan(1)
    expect(bag.minH, `有卡片被压扁（最矮 ${bag.minH}px）—— 多半是给容器加了定高 flex 列`).toBeGreaterThan(60)
    expect(Math.abs(bag.maxH - bag.minH), `卡片高度不一致：${bag.minH}~${bag.maxH}`).toBeLessThan(1.5)
    expect(bag.btns, '每张卡片都要有「穿戴」按钮').toBe(bag.n)
    expect(bag.dupNames, '卡片应一一对应（不该有重复渲染）').toBe(bag.n)

    // ①c 「当前穿戴」一行一个槽位（2026-09-21 用户要求）：8 行 8 个不同顶边
    const worn = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.equip-pane--worn .equip-row')]
      const tops = [...new Set(rows.map((r) => Math.round(r.getBoundingClientRect().top)))]
      return { n: rows.length, rows: tops.length }
    })
    expect(worn.n, '当前穿戴应有 8 个槽位行').toBe(8)
    expect(worn.rows, `8 个槽位应各占一行（实测 ${worn.rows} 行）`).toBe(8)

    // ② 面板铺满网格区：`align-items: stretch`，且竖跨两行的「当前穿戴」高度 == 强化 + 装备详情 + 行距
    const geo = await page.evaluate(() => {
      const body = document.querySelector('.equip-body')
      const pane = (c) => document.querySelector(`.equip-pane--${c}`).getBoundingClientRect()
      const cs = getComputedStyle(body)
      return {
        align: cs.alignItems,
        gap: parseFloat(cs.rowGap) || 0,
        worn: pane('worn').height,
        upgrade: pane('upgrade').height,
        detail: pane('detail').height,
        // 同一行的两张卡必须等高（强化 / 总属性）
        stats: pane('stats').height,
      }
    })
    expect(geo.align, '装备页各面板应铺满网格（align-items: stretch）').toBe('stretch')
    expect(Math.abs(geo.upgrade - geo.stats), `同行的「强化」${geo.upgrade} 与「总属性」${geo.stats} 不等高`).toBeLessThan(1.5)
    expect(Math.abs(geo.worn - (geo.upgrade + geo.detail + geo.gap)), `「当前穿戴」${geo.worn} 应等于两行之和 ${geo.upgrade + geo.detail + geo.gap}`).toBeLessThan(2)
  })

  // 装备弹窗高度守卫（2026-09-18 用户报「背包装备过多，背包可穿戴窗口被无限往下伸长」）：
  // 成因是 `.equip-body` 没有夹高度（grid 子项默认 min-height:auto）+ 栏位不滚动 ⇒ 列表 1:1 撑长弹窗、
  // 页脚被顶到视口外（实测 20 件→body 740px、60 件→2060px，而弹窗可视只有 658px）。
  // 断言方式是**行为**而非源码：件数从 5 → 60，body 高度必须不变、弹窗不得溢出、页脚必须留在视口内。
  // 厨藏物品详情：会腐坏的食材要有**倒计时**（2026-09-21 用户要求）。
  // 原先只写「12h 后腐坏」（整点、静态），现在是「1 小时 59 分后腐坏」这种会自己往下跳的文案。
  test('厨藏：会腐坏的食材在物品详情里显示倒计时（且真的在走）', async ({ page }) => {
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(1400)
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(400)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)
    await page.evaluate(async () => {
      const ITEMS = (await import('/src/game/data/items.js')).ITEMS
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      const pl = pinia._s.get('player')
      pl.newGame()
      const spoilable = Object.values(ITEMS).find((i) => i.spoilMs)
      pl.inventory[spoilable.id] = 3
      // 造一个「还剩 59 分 30 秒」的计时 → 秒级文案才能看出它在走
      pl.spoilage[spoilable.id] = Date.now() + 59 * 60 * 1000 + 30000
      window.__spoilName = spoilable.name
      pinia._s.get('ui').setView('inventory')
    })
    await page.waitForTimeout(800)
    await page.evaluate(() => {
      const cell = [...document.querySelectorAll('.inv-grid .item-cell')].find((c) => (c.title || '').includes(window.__spoilName))
      cell?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await page.waitForTimeout(400)
    const t1 = await page.evaluate(() => document.querySelector('.bag-detail')?.textContent ?? '')
    expect(t1, '详情面板应显示腐坏倒计时').toMatch(/后腐坏/)
    expect(t1, `倒计时应是「N 分 N 秒」这种细粒度文案（实测片段：${t1.slice(0, 80)}）`).toMatch(/\d+ 分 \d+ 秒后腐坏/)
    await page.waitForTimeout(1400)
    const t2 = await page.evaluate(() => document.querySelector('.bag-detail')?.textContent ?? '')
    const sec = (t) => Number((t.match(/(\d+) 分 (\d+) 秒后腐坏/) ?? [])[2] ?? -1)
    expect(sec(t2), `倒计时应在走（${sec(t1)} → ${sec(t2)}）`).toBeLessThan(sec(t1))
  })

  // 厨藏拖拽分类（2026-09-21 用户：「拖动物品的表现形式有点问题，需要优化」）：
  // ① 拖动时要有**明确指引**；② 只有**光标下那个页签**高亮（原先所有非当前页签一起变成虚线，很吵）；
  // ③ 松手真的归类；④ 拖完那一下的 click 不许把物品选中（否则拖完顺手弹详情）。
  test('厨藏：拖物品到面板页签的反馈与归类行为', async ({ page }) => {
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(1400)
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(400)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)
    const itemId = await page.evaluate(async () => {
      const ITEMS = (await import('/src/game/data/items.js')).ITEMS
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      const pl = pinia._s.get('player')
      pl.newGame()
      const it = Object.values(ITEMS).find((i) => i.type === 'ingredient')
      pl.inventory[it.id] = 5
      window.__dragItem = it.id
      window.__dragName = it.name
      pinia._s.get('ui').setView('inventory')
      return it.id
    })
    await page.waitForTimeout(800)
    const before = await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').itemTabs?.[window.__dragItem] ?? null)

    // 拖动开始 → 悬停「面板 2」 → 松手。⚠️ 每步之间要**等一拍**：Vue 是异步渲染，
    //    同一个 evaluate 里连续 dispatch 完再查 DOM 会读到还没更新的旧节点（第一版就栽在这）。
    const r = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms))
      const cell = [...document.querySelectorAll('.inv-grid .item-cell')].find((c) => (c.title || '').includes(window.__dragName))
      if (!cell) return { err: '找不到格子' }
      const dt = new DataTransfer()
      cell.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
      await sleep(140)
      const tabs = [...document.querySelectorAll('.inv-tab')]
      const start = {
        提示可见: !!document.querySelector('.inv-drag-hint'),
        被拖格子淡出: document.querySelectorAll('.inv-slot--dragging').length,
        页签数: tabs.length,
      }
      tabs[1].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
      await sleep(140)
      const over = { 高亮页签数: document.querySelectorAll('.inv-tab--over').length, 虚线页签数: document.querySelectorAll('.inv-tab--drop').length }
      return { ...start, ...over }
    })
    expect(r.err, r.err ?? '').toBeUndefined()
    expect(r.提示可见, '拖动时应显示「拖到页签归类」的指引').toBe(true)
    expect(r.被拖格子淡出, '正在拖的格子应淡出').toBe(1)
    expect(r.高亮页签数, '只应高亮光标下那一个页签').toBe(1)

    const after = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms))
      const dt = new DataTransfer()
      ;[...document.querySelectorAll('.inv-tab')][1].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
      await sleep(200)
      // 浏览器在拖拽结束后会补发一次 click，模拟它：
      const cell = [...document.querySelectorAll('.inv-grid .item-cell')].find((c) => (c.title || '').includes(window.__dragName))
      if (cell) cell.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await sleep(160)
      const pl = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
      return { tab: pl.itemTabs?.[window.__dragItem] ?? null, 选中: !!document.querySelector('.inv-grid .item-cell.pinned'), 提示还在: !!document.querySelector('.inv-drag-hint') }
    })
    // ⚠️ 存档里 `itemTabs[id]` 存的是**页签下标**（0 = 全部/未归类，1..9 = 面板 2..10），
    //    界面上显示的名字是「面板 {下标+1}」——所以拖到第 2 个页签存进去的是 1。
    expect(after.tab, `松手后物品应归到「面板 2」（下标 1；原来是 ${before}）`).toBe(1)
    expect(after.选中, '拖完那一下的 click 不该把物品选中').toBe(false)
    expect(after.提示还在, '松手后拖拽提示应消失').toBe(false)
  })

  // 厨藏「设置」页签的三个开关（2026-09-21 用户报「厨藏的设置功能有不生效的」）：
  // 实测第三个「锁定详情面板」是**死开关** —— 模板按 `settings.invStickyDetail` 挂的 `.bd--sticky`
  // 在 CSS 里**一处都没有**，「限高 + 粘住」只写在注释里。现在三条都断言**行为**，不只查绑定。
  test('厨藏：设置页签三个开关都真的生效（数量缩写 / 双击使用 / 锁定详情）', async ({ page }) => {
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(1400)
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(400)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)
    await page.setViewportSize({ width: 1440, height: 900 })
    const usableId = await page.evaluate(async () => {
      const ITEMS = (await import('/src/game/data/items.js')).ITEMS
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      const pl = pinia._s.get('player')
      pl.newGame()
      for (const it of Object.values(ITEMS)) if (it.type === 'ingredient') pl.inventory[it.id] = 12345
      const usable = Object.values(ITEMS).find((i) => i.use && i.type !== 'equipment')
      pl.inventory[usable.id] = 10
      window.__usableId = usable.id
      window.__usableName = usable.name
      pinia._s.get('ui').setView('inventory')
      return usable.id
    })
    await page.waitForTimeout(800)
    const setFlag = (k, v) =>
      page.evaluate(([key, val]) => {
        const pl = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
        pl.settings[key] = val
      }, [k, v])

    // ① 数量缩写：关 → 精确数字；开 → 「x.xx万」
    // ⚠️ 同样必须用 innerText：药丸里两份文案共存（CSS 决定显示哪个），textContent 会拼在一起
    await setFlag('invShortQty', false)
    await page.waitForTimeout(300)
    const full = await page.evaluate(() => [...document.querySelectorAll('.inv-cell-qty')].map((x) => x.innerText.trim()).find((t) => t.includes(',')))
    await setFlag('invShortQty', true)
    await page.waitForTimeout(300)
    const short = await page.evaluate(() => [...document.querySelectorAll('.inv-cell-qty')].map((x) => x.innerText.trim()).find((t) => t.includes('万')))
    expect(full, '关掉「数量缩写」后应显示精确数字（如 12,345）').toMatch(/^[\d,]+$/)
    expect(short, '开着「数量缩写」时应出现「x.xx万」').toMatch(/万$/)

    // ② 锁定详情面板：开 → sticky 且滚动后仍钉着；关 → static
    await setFlag('invStickyDetail', true)
    await page.waitForTimeout(300)
    const stickyOn = await page.evaluate(() => getComputedStyle(document.querySelector('.bag-detail')).position)
    expect(stickyOn, '开着「锁定详情面板」时详情栏应为 sticky').toBe('sticky')
    const pinned = await page.evaluate(async () => {
      const sc = document.querySelector('.main-scroll')
      sc.scrollTop = 400
      await new Promise((r) => setTimeout(r, 320))
      const top = Math.round(document.querySelector('.bag-detail').getBoundingClientRect().top)
      sc.scrollTop = 0
      await new Promise((r) => setTimeout(r, 200))
      return top
    })
    expect(pinned, `滚动 400px 后详情栏应仍钉在顶部附近（实测 top=${pinned}）`).toBeLessThan(140)
    await setFlag('invStickyDetail', false)
    await page.waitForTimeout(300)
    const stickyOff = await page.evaluate(() => getComputedStyle(document.querySelector('.bag-detail')).position)
    expect(stickyOff, '关掉后详情栏应随页面滚动（static）').toBe('static')

    // ③ 双击直接使用：开 → 数量 -1；关 → 不变
    const dblOnce = async () => {
      await page.evaluate(() => {
        const cell = [...document.querySelectorAll('.inv-grid .item-cell')].find((c) => (c.title || '').includes(window.__usableName))
        if (cell) cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      })
      await page.waitForTimeout(320)
      return page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').inventory[window.__usableId])
    }
    await setFlag('invDblClick', true)
    await page.waitForTimeout(260)
    const b1 = await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').inventory[window.__usableId])
    const a1 = await dblOnce()
    expect(a1, `开着「双击直接使用」时双击应消耗 1 件（${b1} → ${a1}）`).toBe(b1 - 1)
    await setFlag('invDblClick', false)
    await page.waitForTimeout(260)
    const b2 = await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').inventory[window.__usableId])
    const a2 = await dblOnce()
    expect(a2, `关掉后双击不该消耗物品（${b2} → ${a2}）`).toBe(b2)
  })

  // 对决页右栏「怪物详情」（2026-09-21 用户报「对决敌人详情显示有问题，错位」）：
  // 这块原先**一条 CSS 都没有** ⇒ `<span>风格</span><span>刀工流</span>` 行内直接连成「风格刀工流」，
  // 「命中 / 闪避12 / 6」两值更糊。现在断言「标签 / 数值」两列各自成列、数值贴右。
  test('对决页：怪物详情的「标签 / 数值」两列对齐（不粘连）', async ({ page }) => {
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(1400)
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(400)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)
    await page.evaluate(() => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      pinia._s.get('ui').setView('combat')
      pinia._s.get('player').setActiveSkill('knife')
    })
    await page.waitForTimeout(700)
    await page.evaluate(() => { const c = [...document.querySelectorAll('.monster-card')]; c[2]?.click() })
    await page.waitForTimeout(600)
    const md = await page.evaluate(() => {
      const side = document.querySelector('.combat-page-side')
      const rows = [...document.querySelectorAll('.monster-stats > div')]
      return {
        行数: rows.length,
        '每行两个 span': rows.every((d) => d.children.length === 2),
        // 标签右缘与数值左缘之间必须有实际间隙（粘连时为 0/负）
        最小间隙: Math.min(...rows.map((d) => { const a = d.children[0].getBoundingClientRect(); const b = d.children[1].getBoundingClientRect(); return Math.round(b.left - a.right) })),
        // 数值右缘要贴到该行右缘（两列布局）
        最大右差: Math.max(...rows.map((d) => Math.round(d.getBoundingClientRect().right - d.children[1].getBoundingClientRect().right))),
      }
    })
    expect(md.行数, '怪物详情应有多行属性').toBeGreaterThanOrEqual(6)
    expect(md['每行两个 span'], '每行应为「标签 + 数值」两个 span').toBe(true)
    expect(md.最小间隙, `标签与数值粘连（最小间隙 ${md.最小间隙}px）`).toBeGreaterThan(8)
    expect(md.最大右差, `数值未右对齐（与行右缘差 ${md.最大右差}px）`).toBeLessThan(3)
  })

  test('装备页：背包可穿戴再多也不撑长弹窗（列表在栏内滚动）', async ({ page }) => {
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(1400)
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(400)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)

    // ⚠️ 所有测量都在**项目主用尺寸 1440×900** 下做：页面版的高度是「视口 − 顶栏」，
    //    在 1280×720 下页脚占掉更多空间、栏位更矮，连 5 件都会出现滚动条（那是矮屏的正常表现）。
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(400)

    // 灌 N 件武器进背包（清空其它物品，保证测的就是这一条列表）
    const setBag = async (n) => {
      await page.evaluate(async (k) => {
        const ITEMS = (await import('/src/game/data/items.js')).ITEMS
        const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
        for (const key of Object.keys(p.inventory)) delete p.inventory[key]
        const eq = Object.values(ITEMS).filter((i) => i.type === 'equipment' && i.slot === 'weapon').slice(0, k)
        for (const it of eq) p.inventory[it.id] = 1
        await new Promise((s) => setTimeout(s, 250))
      }, n)
      await page.waitForTimeout(350)
    }
    const geom = () =>
      page.evaluate(() => {
        const modal = document.querySelector('.equipment-view')
        const body = document.querySelector('.equip-body')
        // 2026-09-20 改成 p3 网格版式：各块有稳定类名，别再按下标取（下标随排版变）
        const bag = document.querySelector('.equip-pane--bag')
        return {
          rows: bag.querySelectorAll('.equip-card').length, // 2026-09-21 起背包是卡片网格（原来是一行一件）
          bodyH: Math.round(body.getBoundingClientRect().height),
          listH: Math.round(bag.getBoundingClientRect().height),
          listScrollable: bag.scrollHeight > bag.clientHeight,
          detailTop: Math.round(document.querySelector('.equip-pane--detail').getBoundingClientRect().top),
          paneScrollable: bag.scrollHeight > bag.clientHeight,
          modalOverflow: modal.scrollHeight - modal.clientHeight,
          vh: window.innerHeight,
        }
      })

    await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui').setView('equipment'))
    await expect(page.locator('.equipment-view')).toBeVisible()

    await setBag(5)
    const few = await geom()
    await setBag(60)
    const many = await geom()

    expect(few.rows).toBe(5)
    expect(many.rows).toBe(60)
    // ① 页面版的等价不变量（弹窗时代的「栏高恒定」已不适用）：列表**到上限就不再加高**，
    //    再多靠**框内滚动**（实测 60 件 688px vs 5 件 537px，差值全部落在上限之内）
    expect(many.listH, `列表高度超过上限（44vh=${Math.round(many.vh * 0.44)}px，实得 ${many.listH}px）`)
      .toBeLessThanOrEqual(Math.round(many.vh * 0.44) + 3)
    expect(many.listScrollable, '件数超上限后应当框内滚动').toBe(true)
    expect(few.listScrollable, '5 件时不该有内部滚动条').toBe(false)
    // ② p3 网格版式下，列表在**最后一整行**，它再长也不会把上面的「强化 / 总属性 / 装备详情」挤走
    //    ⇒ 要守的是「详情块顶边仍在首屏内」（用户实测报过「背包可穿戴多起来就看不到属性和详情」）
    expect(many.detailTop, `详情块被 ${many.rows} 件列表顶到 ${many.detailTop}px（视口 ${many.vh}）`).toBeLessThan(many.vh)
    // ④ 列表确实是在栏位内滚动（不是被裁掉看不见）
    expect(many.paneScrollable).toBe(true)
    expect(few.paneScrollable).toBe(false) // 5 件时不该有滚动条
  })

  // 转生后经验条守卫（2026-09-18 用户报「转生后经验条会变成负数」）：
  // 转生「师徒传承」把等级抬到 1+carry 而 exp 归零 ⇒ xpProgress 原先算 current = exp - 本级基线 = 负数
  // （实测 level=6/exp=0 → -113,528、progress -3.74），侧栏直接显示「-113,528 / 30,372」。
  // ⚠️ 口径已在当天晚些时候改为「传承的等级**连基线经验一起给**」（见 system_test C38 的 ⑥⑦）：
  //    新档转生后 exp = 该等级基线，这里**直接往 store 里塞「等级 6 / exp 0」**模拟的是**旧档/异常态**，
  //    要守的是「即便出现这种不自洽状态，界面也不许显示负数」。旧档在读档时会被 applySave 补到基线。
  test('转生后经验条不为负：侧栏与技能页都显示 0 起步的真实进度', async ({ page }) => {
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(1400)
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(400)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)

    // 造一个「已转生、等级 6、经验 0」的技能（正是 prestigeSkill 的产物状态）
    await page.evaluate(() => {
      const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
      p.setSkillState('knife', { level: 6, exp: 0, prestiges: 1 })
    })
    await page.waitForTimeout(400)

    // ① 侧栏该技能行：不得出现负数，且有「x / y」进度文案
    const row = page.locator('.skill-item', { hasText: '刀工' }).first()
    const rowText = (await row.textContent()).replace(/\s+/g, ' ').trim()
    expect(rowText, `侧栏出现负数经验：${rowText}`).not.toMatch(/-\s*\d/)
    expect(rowText).toContain('等级 6')

    // ② 技能页经验数字：同样不得为负，且进度条填充在 0~1
    await page.evaluate(() => {
      const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
      const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui')
      p.setActiveSkill('knife')
      ui.setView('skill')
    })
    await page.waitForTimeout(500)
    const detail = await page.evaluate(() => {
      const num = document.querySelector('.skill-head-xp-row .xp-num span')
      const fill = document.querySelector('.skill-head-right .progress-bar-fill')
      const lv = document.querySelector('.skill-head-xp-row .xp-level')
      return { num: num?.textContent?.trim() ?? '', level: lv?.textContent?.trim() ?? '', transform: fill ? getComputedStyle(fill).transform : '' }
    })
    expect(detail.num, `技能页出现负数经验：${detail.num}`).not.toMatch(/-\s*\d/)
    expect(detail.level).toContain('等级 6')
    // progress 为 0 ⇒ scaleX(0)，绝不能是负值
    const scale = Number((detail.transform.match(/matrix\(([-\d.]+)/) ?? [])[1] ?? 1)
    expect(scale).toBeGreaterThanOrEqual(0)
    expect(scale).toBeLessThanOrEqual(1)

    // ③ 数学口径：转生态的真实需求 = 从 0 攒到「下一级基线」；攒满即升级（与 Skill.addXp 同源）
    const math = await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/game/core/Experience.js')) || '/src/game/core/Experience.js'
      const { xpProgress, totalXpForLevel } = await import(/* @vite-ignore */ url)
      return {
        zero: xpProgress(0, 120, 6),
        atThreshold: xpProgress(totalXpForLevel(7), 120, 6),
        baseline: xpProgress(totalXpForLevel(6), 120, 6),
      }
    })
    expect(math.zero.current).toBe(0)
    expect(math.zero.progress).toBe(0)
    expect(math.zero.needed).toBeGreaterThan(0)
    expect(math.atThreshold.progress).toBe(1) // 升级判定处刚好满格
    expect(math.baseline.current).toBe(0) // 正常态（exp 正好等于本级基线）行为不变
  })

  // 装备弹窗「详情栏」守卫（2026-09-18 用户报「词条洗练和镶嵌被遮挡」「选择宝石的框没适配」）：
  // ① 弹窗高度只够 header+栏位最小高+页脚最小高时，页脚里最后两条宝石插槽行会落到弹窗可视区外
  //    （实测 top 774/802 > 弹窗底 780）⇒ 装备弹窗单独加高到 min(820px, 92vh)、max-height 覆盖 .modal 的 86vh；
  // ② 宝石选择框原先是裸的原生控件（19px 高、白底 rgb(255,255,255)、灰直角边），现并入统一控件；
  // ③ 空态占位「选择宝石」原先根本不显示（v-model 是 undefined、匹配不上空选项 ⇒ selectedIndex = -1）。
  test('装备页：词条/洗练/镶嵌都在窗内可见 + 宝石选择框已适配', async ({ page }) => {
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(1400)
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(400)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)

    // 造一件「3 插槽 + 有词条」的装备穿上并选中它（详情栏最长的情况）
    const itemName = await page.evaluate(async () => {
      const ITEMS = (await import('/src/game/data/items.js')).ITEMS
      const { socketCountOf, GEM_DEFS } = await import('/src/game/data/gems.js')
      const pin = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      const p = pin._s.get('player')
      const cand = Object.values(ITEMS)
        .filter((i) => i.type === 'equipment' && socketCountOf(i) >= 3)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]
      for (const k of Object.keys(p.inventory)) delete p.inventory[k]
      p.inventory[cand.id] = 1
      for (const g of GEM_DEFS) p.inventory[g.itemId] = 5
      p.equip(cand.id)
      pin._s.get('ui').setView('equipment')
      await new Promise((s) => setTimeout(s, 400))
      const rows = [...document.querySelectorAll('.equip-row-equipped')]
      ;(rows.find((r) => r.textContent.includes(cand.name)) ?? rows[0]).click()
      await new Promise((s) => setTimeout(s, 500))
      return cand.name
    })
    expect(itemName).toBeTruthy()

    // ① 目标尺寸（1440×900，项目的主用尺寸）下：页脚全部控件可见，且详情栏**不需要滚动**
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(400)
    const measure = () =>
      page.evaluate(() => {
        const modal = document.querySelector('.equipment-view')
        const detail = document.querySelector('.equip-pane--detail')
        const mb = { top: 0, bottom: window.innerHeight } // 页面版：判据换成「在视口内」
        const ctrls = [...document.querySelectorAll('.equip-pane--detail button, .equip-pane--detail select')]
        const outside = ctrls
          .map((el) => ({ t: (el.textContent || el.tagName).trim().slice(0, 10), b: el.getBoundingClientRect() }))
          .filter((x) => x.b.top < mb.top - 1 || x.b.bottom > mb.bottom + 1)
          .map((x) => `${x.t}@${Math.round(x.b.top)}-${Math.round(x.b.bottom)}`)
        return {
          count: ctrls.length,
          outside,
          overflow: modal.scrollHeight - modal.clientHeight,
          modalH: Math.round(mb.height),
          vh: window.innerHeight,
          detailNeedScroll: detail.scrollHeight - detail.clientHeight,
        }
      })
    const big = await measure()
    expect(big.count).toBeGreaterThanOrEqual(7) // 洗练 + 3×(选择宝石/镶嵌 或 拆卸)
    expect(big.outside, `页脚控件落在视口外：${big.outside.join(' / ')}（内容高 ${big.modalH}，视口 ${big.vh}）`).toEqual([])
    // 页面版：整页允许滚动（不再要求「内容高 = 可视高」），只要**详情栏**自身不需要滚动即可（见下一条）
    expect(big.detailNeedScroll, `1440×900 下详情栏竟然要滚动（词条/洗练/镶嵌被挡的成因）`).toBeLessThan(3)

    // ①b 矮屏（1280×720）：弹窗仍不得溢出；末尾插槽行必须**可见可达**
    //     （页脚是定高的，矮屏内容可能略微超出详情栏 ⇒ 允许该栏内部滚动，但要能滚到底看见它）
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.waitForTimeout(400)
    const small = await measure()
    // 矮屏：只要求详情栏内容可达（下面那条），页面整体可以滚
    const reachable = await page.evaluate(() => {
      const d = document.querySelector('.equip-pane--detail')
      d.scrollTop = d.scrollHeight // 滚到底
      const rows = [...document.querySelectorAll('.equip-pane--detail .socket-row')]
      const last = rows[rows.length - 1]
      const dr = d.getBoundingClientRect()
      const lr = last.getBoundingClientRect()
      const btn = document.querySelector('.equip-pane--detail .btn') // 洗练按钮
      const br = btn.getBoundingClientRect()
      return {
        lastRowVisible: lr.bottom <= dr.bottom + 1 && lr.top >= dr.top - 1,
        rerollVisible: br.bottom <= dr.bottom + 1 && br.top >= dr.top - 1,
        rows: rows.length,
        scrolled: d.scrollTop,
      }
    })
    expect(reachable.rows).toBe(3)
    expect(reachable.lastRowVisible, '矮屏下滚到底仍看不到第 3 个插槽行').toBe(true)
    expect(reachable.rerollVisible, '矮屏下滚到底仍看不到洗练按钮').toBe(true)
    await page.evaluate(() => { document.querySelector('.equip-pane--detail').scrollTop = 0 })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(300)

    // ② 宝石选择框 = 统一控件材质（高 30 / 圆角 8 / 不是纯白原生底），且宽度够显示完整宝石名
    const sel = await page.evaluate(() => {
      const el = document.querySelector('.equip-pane--detail select.gem-pick')
      if (!el) return null
      const cs = getComputedStyle(el)
      return {
        h: Math.round(el.getBoundingClientRect().height),
        w: Math.round(el.getBoundingClientRect().width),
        radius: cs.borderRadius,
        bg: cs.backgroundColor,
        fontSize: cs.fontSize,
        shown: el.options[el.selectedIndex]?.text ?? '',
        idx: el.selectedIndex,
        optCount: el.options.length,
        // 最长的选项文本宽度（判断 280px 够不够）
        longest: el.options.length ? [...el.options].map((o) => o.text).sort((a, b) => b.length - a.length)[0] : '',
      }
    })
    expect(sel, '找不到宝石选择框').not.toBeNull()
    expect(sel.h).toBe(30) // 统一控件高度（原生是 19px）
    expect(sel.radius).toBe('8px')
    expect(sel.bg).not.toBe('rgb(255, 255, 255)') // 原生白底
    expect(sel.fontSize).toBe('13px')
    expect(sel.idx).toBe(0)
    expect(sel.shown).toBe('选择宝石') // 空态占位必须真的显示（原先 selectedIndex = -1、一片空白）

    // ③ 走通「选宝石 → 镶嵌」：插槽真的被填上
    await page.selectOption('.equip-pane--detail select.gem-pick', 'goldOre')
    await page.locator('.socket-row button', { hasText: '镶嵌' }).first().click()
    await page.waitForTimeout(500)
    const after = await page.evaluate(() => {
      const pin = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      const p = pin._s.get('player')
      const slot = Object.keys(p.gemSockets ?? {}).find((s) => (p.gemSockets[s].gems ?? []).some(Boolean))
      const row = document.querySelector('.socket-row')
      return { slot, gems: slot ? p.gemSockets[slot].gems : null, rowText: row ? row.textContent.replace(/\s+/g, ' ').trim().slice(0, 20) : '' }
    })
    expect(after.slot).toBeTruthy()
    expect(after.gems[0]).toBe('goldOre')
    expect(after.rowText).toContain('拆卸') // 已镶嵌 ⇒ 该行变成「拆卸」
  })

  // 功能页「指南」按钮（2026-09-21 用户报「我看技能都有指南按钮，怎么功能没有？」）
  // 数据源 = 攻略总览里对应该页的那一条（`guide.js` 的 guideEntryForView + `featureGroups.js` 的视图→关键词）。
  // 断言四件事：功能页有 / 技能页与顶栏主页没有 / 点开是**渲染好的富文本** / 关得掉。
  test('「指南」按钮：功能页 + 顶栏主页（厨藏/图鉴/装备/统计）都有且带文字，技能页/攻略页没有，内容 = 攻略里那一条', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(1200)
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(400)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(900)

    const setView = (v) => page.evaluate((vv) => {
      document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui').setView(vv)
    }, v)
    const btn = page.locator('.top-nav-guide')

    // ① 技能页：技能页标题旁自带 📖 指南 ⇒ 顶栏不重复出现
    await setView('skill')
    await page.waitForTimeout(250)
    await expect(page.locator('.skill-guide-btn').first()).toBeVisible()
    await expect(btn).toHaveCount(0)
    // ② 攻略页自己 / 无条目的页 ⇒ 没有指南按钮（2026-09-22：厨藏/装备**已纳入**，见 ③b）
    for (const v of ['guide']) {
      await setView(v)
      await page.waitForTimeout(250)
      await expect(btn, `${v} 不该有指南按钮`).toHaveCount(0)
    }
    // ②b 顶栏主页（厨藏 / 图鉴 / 装备 / 统计）**也要有**（2026-09-22 用户报「没看到变动啊」：
    //     玩家停在厨藏/图鉴/装备/统计时看不到任何变化，因为当时只挂在左栏功能页上）
    // ②c 顶栏第一组那 7 个（TOP_NAV：餐厅/公会/赛季/竞技场/试炼塔/大赛/觅珍）同样要有
    //     （用户第二次报「顶部栏的功能都没有指南」）
    for (const v of ['inventory', 'log', 'equipment', 'stats', 'restaurant', 'guild', 'season', 'arena', 'tower', 'fest', 'mijian']) {
      const entry = guideEntryForViewLocal(v)
      expect(entry, `${v} 应能解析出指南条目`).toBeTruthy()
      await setView(v)
      await page.waitForTimeout(280)
      await expect(btn, `${v}（顶栏功能）应有指南按钮`).toBeVisible()
      await expect(btn).toHaveAttribute('title', `本页指南：${entry.name}`)
    }
    // ②d 按钮**带文字**（宽屏下顶栏按钮默认只有 emoji，只给 📘 等于没做）
    await setView('ranch')
    await page.waitForTimeout(250)
    await expect(btn).toContainText('指南')
    const labelVisible = await page.evaluate(() => {
      const t = document.querySelector('.top-nav-guide .nav-btn-text')
      return t ? getComputedStyle(t).display !== 'none' : false
    })
    expect(labelVisible, '「指南」两个字被 .nav-btn-text 的 display:none 藏起来了').toBe(true)

    // ③ 功能页：按钮出现、title 与弹窗内容都指向**本页对应那一条**（期望值取自数据模块，不手抄）
    const cases = ['ranch', 'michelin', 'legacy', 'codexExchange', 'spiritStories', 'weather', 'caravan', 'festival']
    for (const view of cases) {
      const entry = guideEntryForViewLocal(view)
      expect(entry, `${view} 在攻略里没有条目（按钮由它决定是否显示）`).toBeTruthy()
      await setView(view)
      await page.waitForTimeout(250)
      await expect(btn, `${view} 应有指南按钮`).toBeVisible()
      await expect(btn).toHaveAttribute('title', `本页指南：${entry.name}`)
      await btn.click()
      const modal = page.locator('.feature-guide-modal')
      await expect(modal).toBeVisible()
      await expect(modal.locator('h3')).toContainText(entry.name)
      // 元信息（阶段 / 解锁）也取自同一份攻略数据
      await expect(modal.locator('.fg-pill').nth(0)).toContainText(`阶段：${entry.stage}`)
      await expect(modal.locator('.fg-pill').nth(1)).toContainText(`解锁：${entry.unlock}`)
      // 富文本 desc 必须真渲染：渲染出的 HTML 与**数据本身**对齐（带 `<b>` 的条目必须出现真标签、
      // 不能是 `&lt;b&gt;`；纯文本里不能露出标记 —— 同一类坑 e2e-text 也在扫）
      const html = await modal.locator('.fg-desc').innerHTML()
      const text = await modal.locator('.fg-desc').innerText()
      if (/<b>/.test(entry.desc)) expect(html, `${view} 的 desc 未渲染成 HTML`).toContain('<b>')
      expect(html, `${view} 的 desc 转义了标记`).not.toContain('&lt;')
      expect(text, `${view} 的 desc 把标记当字面量显示了`).not.toContain('<b>')
      expect(text.replace(/\s+/g, '')).toContain(entry.desc.replace(/<[^>]+>/g, '').replace(/\s+/g, '').slice(0, 30))
      await modal.locator('.modal-head button').click()
      await expect(modal).toHaveCount(0)
    }

    // ④ 「去攻略总览」：点了切到攻略页并关闭弹窗
    await setView('ranch')
    await page.waitForTimeout(250)
    await btn.click()
    await page.locator('.fg-link').click()
    await page.waitForTimeout(400)
    await expect(page.locator('.feature-guide-modal')).toHaveCount(0)
    const view = await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui').activeView)
    expect(view).toBe('guide')
  })

  // 觅珍（2026-09-22 用户三连报：稀有+ 概率还是太高 / 厨具池与限时池要 50 抽保底 / 概率得详细讲 /
  // 抽卡结果里得显示金币）。这条用例把「玩家看得见的那部分」钉住，数字一律取自数据模块。
  test('觅珍：公示面板数字与数据一致 + 双保底（40/50 抽 + 神话）+ 抽卡结果显示返还金币', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(1200)
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(400)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(900)

    // 给足金币（抽卡唯一的货币入口是金币）
    const pin = () => page.evaluate(() => {
      const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
      p.gold = 50_000_000
      return p.gold
    })
    expect(await pin()).toBeGreaterThan(1_000_000)
    const ui = (v) => page.evaluate((vv) => {
      document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui').setView(vv)
    }, v)
    await ui('mijian')
    await page.waitForTimeout(600)

    // ① 页头那句与常量同源（旧版写死「每 10 抽保底」；现在写两池的稀有/神话保底抽数）
    const head = await page.locator('.mijian-view .skill-head p').first().innerText()
    expect(head, '页头没写混池的稀有/神话保底').toContain(`${PITY_RULES.mix.rare}/${PITY_RULES.mix.myth}`)
    expect(head, '页头没写厨具/限时的稀有/神话保底').toContain(`${PITY_RULES.gear.rare}/${PITY_RULES.gear.myth}`)
    expect(head, '页头不该再出现「三种卡池」').not.toContain('三种卡池')

    // ② 📊 公示面板：五个池都在，数字与**页面自己那份** poolOdds() 完全一致（面板是渲染数据，不是手写）
    await page.locator('.odds-btn').click()
    const oddsModal = page.locator('.odds-modal')
    await expect(oddsModal).toBeVisible()
    // ⚠️ 必须取页面正在用的那个模块实例（dev 下是 `/src/game/data/mijianDraws.js?t=…`）：
    //    池成员按 value 筛、而 `applyValueBalance()` 会改 value 并清缓存 ⇒ 无查询串重新 import 拿到的是
    //    平衡前那份池子（实测 184 vs 页面里 159），比对会假失败。见 AGENTS「浏览器侧验证坑」。
    const oddsInApp = await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/game/data/mijianDraws.js'))
      const m = await import(/* @vite-ignore */ url)
      return m.allPoolOdds()
    })
    expect(oddsInApp.length).toBe(allPoolOddsLocal().length)
    await expect(oddsModal.locator('.odds-pool')).toHaveCount(oddsInApp.length)
    for (const o of oddsInApp) {
      const sec = oddsModal.locator('.odds-pool', { hasText: o.name })
      await expect(sec, `${o.name} 的池内件数没显示`).toContainText(`池内 ${o.members} 件`)
      if (o.branch) {
        // 三档分支 + 返金额（材料 21 / 食物 38 / 混池 28，都是整数）
        await expect(sec).toContainText(`${o.branch.gold}%`)
        await expect(sec).toContainText(`${o.branch.cheap}%`)
        await expect(sec).toContainText(`${o.branch.normal}%`)
        await expect(sec).toContainText(`返还 ${o.refund.amount} 金币`)
      } else {
        // 装备池：每抽必出装备（限时池另有 80/20 分支）
        await expect(sec).toContainText(o.gearPct ? `${o.gearPct}%` : '每抽必出装备')
      }
      if (o.pity) {
        await expect(sec).toContainText(`稀有保底 ${o.pity.rare} 抽`)
        await expect(sec).toContainText(`神话保底 ${o.pity.myth} 抽`)
        await expect(sec).toContainText(`第 ${o.soft.start} 抽`)
        for (const f of o.final) await expect(sec).toContainText(`${f.pct}%`)
      }
      // 有分支的池：每条分支行都必须是「数字% + 说明」的完整句，不能只有百分号
      // （厨具池那条是「每抽必出装备」的纯说明行，本来就没有数字 → 只对有分支/占比的池查）
      if (o.branch || o.gearPct) {
        for (const li of await sec.locator('.odds-list li').allInnerTexts()) {
          expect(li, `${o.name} 的分支行不完整：${li}`).toMatch(/\d+(\.\d+)?%/)
        }
      }
    }
    await oddsModal.locator('.modal-head button').click()
    await expect(oddsModal).toHaveCount(0)

    // ③ 双保底：厨具池 rare=39 → 下一抽必稀有+；神话保底优先（rare=39 + myth=199 → 出神话，且**只清 myth**）
    const boost = await page.evaluate(() => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      const p = pinia._s.get('player')
      p.mijian = p.mijian ?? {}
      p.mijian.pity = { mix: { rare: 0, myth: 0 }, gear: { rare: 39, myth: 0 }, limited: { rare: 0, myth: 0 } }
      const r = p.drawMijian('gear', 1)
      const afterRare = JSON.parse(JSON.stringify(p.mijian.pity.gear))
      p.mijian.pity.gear = { rare: 39, myth: 199 }
      const r2 = p.drawMijian('gear', 1)
      return {
        rareQ: r.results[0]?.quality, boosted: r.boosted, afterRare,
        mythQ: r2.results[0]?.quality, afterMyth: JSON.parse(JSON.stringify(p.mijian.pity.gear)),
      }
    })
    expect(boost.boosted, '第 40 抽没有触发稀有保底').toBe(true)
    expect(['稀有', '史诗', '传说', '神话'], `保底出的品质是 ${boost.rareQ}`).toContain(boost.rareQ)
    expect(boost.afterRare.rare, '稀有保底命中后 rare 没清零').toBe(0)
    expect(boost.mythQ, '神话保底没有优先于稀有保底').toBe('神话')
    expect(boost.afterMyth.myth, '神话保底命中后 myth 没清零').toBe(0)
    expect(boost.afterMyth.rare, '触发神话保底不该清掉稀有计数').toBeGreaterThan(0)
    // 混池 50 抽 / 限时池 40 抽各自独立
    const mixBoost = await page.evaluate(() => {
      const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
      p.mijian.pity.mix = { rare: 49, myth: 0 }
      p.mijian.pity.limited = { rare: 39, myth: 0 }
      const a = p.drawMijian('mix', 1)
      const b = p.drawMijian('limited', 1)
      return { mix: a.boosted, lim: b.boosted, mixQ: a.results[0]?.quality, limQ: b.results[0]?.quality }
    })
    expect(mixBoost.mix, '混池第 50 抽没触发保底').toBe(true)
    expect(mixBoost.lim, '限时池第 40 抽没触发保底').toBe(true)

    // ④ 抽卡结果里要显示返还金币（用户：「不然还以为出bug了」）：
    //    材料池 40% 返还 ⇒ 百连几乎必有返金卡（100 张全是物品的概率 ≈ 0.6^100）
    await page.locator('.pool-mini', { hasText: '材料池' }).click()
    await page.waitForTimeout(300)
    await page.locator('.gacha-btn-bulk').click()
    await expect(page.locator('.gacha-results .gacha-card')).toHaveCount(100, { timeout: 20000 })
    await page.waitForTimeout(3200) // 等翻牌揭示跑完
    const goldCards = page.locator('.gacha-results .gacha-card', { hasText: '金币' })
    expect(await goldCards.count(), '百连里一张返金卡都没有（返金档没渲染出来）').toBeGreaterThan(0)
    const goldTxt = await goldCards.first().locator('.gacha-front-sub').innerText()
    expect(goldTxt, `返金卡没显示数量：${goldTxt}`).toMatch(/^\+\d+/)
    // 日志里也要写返还了多少金币
    const log = await page.evaluate(() => {
      const uiStore = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui')
      return (uiStore.log ?? []).map((l) => l.message).filter((m) => m.includes('觅珍')).slice(-1)[0] ?? ''
    })
    expect(log, `抽卡日志没提返还金币：${log}`).toContain('返还金币')

    // ⑤ 装备可堆叠（2026-09-22 用户要求）：同款无词条装备按件堆起来 + 上限 100 亿
    const stackInfo = await page.evaluate(() => {
      const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
      p.inventory.copperKnife = 0
      p.gearMods = {}
      p.gainItem('copperKnife', 7)
      const noMods = p.stackCapOf('copperKnife')
      p.gearMods = { copperKnife: { mods: [{ stat: 'attack', value: 1 }], at: Date.now() } }
      return { qty: p.inventory.copperKnife, noMods, withMods: p.stackCapOf('copperKnife') }
    })
    expect(stackInfo.qty, '无词条装备没堆起来').toBe(7)
    expect(stackInfo.noMods, '无词条装备上限不是 100 亿').toBe(10_000_000_000)
    expect(stackInfo.withMods, '有词条装备上限应回到 1').toBe(1)
  })

  // 装备弹窗布局固定（2026-09-18 第二轮用户报「点击装备前和点击后窗口会变化」）：
  // 成因是页脚（总属性/装备详情）高度随选中变化（121 ↔ 424），而三栏是 `flex:1` ⇒ 整窗内部跳 303px。
  // 现在页脚**定高** min(312px, 44vh)（按最长详情算：7 属性 + 3 词条 + 洗练 + 3 插槽行 = 294px + 内距）。
  // 断言：选前 / 选后 / 换选另一件，三栏与页脚的尺寸都必须**一模一样**，且最后一行插槽不被切掉。
  test('装备页：点选装备前后各板块尺寸不变（布局固定）', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(1400)
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(400)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(1000)

    // 装备一件 3 插槽的「神话」并塞 3 条词条（最长详情形态）+ 背包里放几件可穿的
    await page.evaluate(async () => {
      const ITEMS = (await import('/src/game/data/items.js')).ITEMS
      const { socketCountOf, GEM_DEFS } = await import('/src/game/data/gems.js')
      const pin = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      const p = pin._s.get('player')
      const cand = Object.values(ITEMS)
        .filter((i) => i.type === 'equipment' && socketCountOf(i) >= 3)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]
      for (const k of Object.keys(p.inventory)) delete p.inventory[k]
      p.inventory[cand.id] = 1
      for (const g of GEM_DEFS) p.inventory[g.itemId] = 5
      let n = 0
      for (const it of Object.values(ITEMS)) {
        if (n >= 20) break
        if (it.type === 'equipment' && it.slot === 'weapon' && it.id !== cand.id) { p.inventory[it.id] = 1; n++ }
      }
      p.equip(cand.id)
      p.gearMods[cand.id] = {
        mods: [{ stat: 'attack', label: '攻击', value: 9.99 }, { stat: 'defense', label: '防御', value: 9.99 }, { stat: 'hpBonus', label: '生命', value: 99 }],
        at: 1,
      }
      window.__testItem = { id: cand.id, name: cand.name }
      pin._s.get('ui').setView('equipment')
      await new Promise((s) => setTimeout(s, 500))
    })
    await page.waitForTimeout(400)

    const sizes = () =>
      page.evaluate(() => {
        const h = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().height) : -1 }
        const d = document.querySelector('.equip-pane--detail')
        const rows = [...document.querySelectorAll('.equip-pane--detail .socket-row')]
        const dr = d.getBoundingClientRect()
        const m = document.querySelector('.equipment-view')
        return {
          body: h('.equip-body'),
          pane1: h('.equip-pane--worn'),
          pane2: h('.equip-pane--upgrade'),
          pane3: h('.equip-pane--bag'),
          detail: h('.equip-pane--detail'),
          needScroll: d.scrollHeight - d.clientHeight,
          socketRows: rows.length,
          lastSocketVisible: rows.length ? rows[rows.length - 1].getBoundingClientRect().bottom <= dr.bottom + 1 : null,
          modalOverflow: m.scrollHeight - m.clientHeight,
        }
      })

    const before = await sizes()
    // 页面版（2026-09-20 内容驱动）：**列表**尺寸绝不许变（选中详情长高是正常的）；
    // 弹窗时代那条「footer/detail 也必须不变」是给固定 312px 页脚用的，页面版已不适用。
    const keys = ['pane1', 'pane3']

    // ① 选中「当前穿戴」里那件 → 尺寸必须一字不变
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.equip-row-equipped')]
      ;(rows.find((r) => r.textContent.includes(window.__testItem.name)) ?? rows[0]).click()
    })
    await page.waitForTimeout(450)
    const afterSelect = await sizes()
    for (const k of keys) {
      expect(afterSelect[k], `选中后 ${k} 尺寸变了：${before[k]} → ${afterSelect[k]}`).toBe(before[k])
    }

    // ② 详情栏不需要滚动，且最后一行插槽（第 3 个）必须在栏内可见（页面版：详情块自身限高内滚）
    expect(afterSelect.socketRows).toBe(3)
    expect(afterSelect.needScroll, `详情栏需要滚动 ${afterSelect.needScroll}px（最后一行插槽会被切掉）`).toBeLessThan(3)
    expect(afterSelect.lastSocketVisible, '第 3 个宝石插槽行被切在可视区外').toBe(true)
    expect(afterSelect.modalOverflow).toBeLessThan(3)

    // ③ 换选背包里另一件 → 尺寸仍不变
    await page.evaluate(() => {
      const row = [...document.querySelectorAll('.equip-pane--bag .equip-card')][0]
      row && row.click()
    })
    await page.waitForTimeout(400)
    const afterSwitch = await sizes()
    for (const k of keys) {
      expect(afterSwitch[k], `换选装备后 ${k} 尺寸变了：${before[k]} → ${afterSwitch[k]}`).toBe(before[k])
    }
  })

  // 竞技场状态必须**按存档位分键**（2026-09-26 修「切档 → 榜单/已挑战跨档污染」）：
  // 之前是一个全局键 `culinary-idle.arena.state` ⇒ 在 A 档打完的人，到 B 档还显示「已挑战」。
  // 这条行为断言钉住两件事：① 写的是带 `.0` 后缀的键；② **不再写**那个无后缀的全局键。
  test('竞技场状态按存档位分键（不再写全局键）', async ({ page }) => {
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(400)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(900)
    await page.evaluate(() => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      pinia._s.get('ui').setView('arena')
    })
    await page.waitForTimeout(900)
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('arena.state')))
    expect(keys.length, `竞技场状态键一个都没写：${JSON.stringify(keys)}`).toBeGreaterThan(0)
    expect(keys.some((k) => /\.\d+$/.test(k)), `竞技场状态键没带存档位后缀：${JSON.stringify(keys)}`).toBe(true)
    expect(keys, `还在写无后缀的全局键（会跨档污染）：${JSON.stringify(keys)}`).not.toContain('culinary-idle.arena.state')
  })

  // Esc 关闭最上层弹窗（2026-09-26 补；实现是 App.vue 里**一处**全局监听，模拟「点最上层遮罩」，
  // 走的是与鼠标完全相同的关闭路径 —— 所以这条断言同时守住「Esc 与点遮罩行为一致」）。
  test('Esc 关闭最上层弹窗（与点遮罩同路径）', async ({ page }) => {
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(400)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(900)

    // ① 设置弹窗：开 → Esc → 关
    await page.locator('.top-nav-btn[title="设置"]').click()
    await expect(page.locator('.settings-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.settings-modal')).toHaveCount(0)
    await expect(page.locator('.modal-backdrop')).toHaveCount(0)

    // ② 存档弹窗同样（换一个组件，确认不是只有某一个弹窗响应）
    await page.locator('.top-nav-btn[title="存档"]').click()
    await expect(page.locator('.save-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.save-modal')).toHaveCount(0)

    // ③ 没有弹窗时按 Esc 不应报错（页面还活着）
    await page.keyboard.press('Escape')
    await expect(page.locator('.app-layout')).toBeVisible()
  })

  // 断网期间加载失败的图片：**回网后要自愈**（2026-09-26 补；此前只有视图 chunk 有兜底，图片一直空着）。
  // 手法：用 route 把图片请求全部 abort，制造「加载失败」→ 断言确实挂了 → 解除拦截并派发 online →
  //      断言图片自然宽度回到 >0（即真的重新拉到了），且失败的隐藏痕迹被复位。
  test('断网加载失败的图片，回网后自愈（不需要整页刷新）', async ({ page }) => {
    await page.locator('.splash-start-btn').click()
    await page.waitForTimeout(400)
    await page.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
    await expect(page.locator('.app-layout')).toBeVisible()
    await page.waitForTimeout(900)

    // ① 拦掉所有图片（模拟断网），然后进厨藏页触发一批图片请求
    //    ⚠️ 先给背包塞点东西：新档背包是空的 ⇒ 厨藏页一个 `<img>` 都不会渲染（第一版就是这么假失败的）
    await page.route('**/images/**', (route) => route.abort())
    await page.evaluate(() => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      const player = pinia._s.get('player')
      for (const id of ['apple', 'potato', 'carrot', 'rice', 'wheat']) player.gainItem(id, 5)
      pinia._s.get('ui').setView('inventory')
    })
    await page.waitForTimeout(1500)
    const broken = await page.evaluate(() => {
      const imgs = [...document.images]
      return { total: imgs.length, dead: imgs.filter((i) => i.complete && i.naturalWidth === 0).length }
    })
    expect(broken.dead, `没有制造出失败图片（total=${broken.total}）`).toBeGreaterThan(0)

    // ② 恢复网络：解除拦截 + 派发 online（= 浏览器回网时真实发生的事件）
    await page.unroute('**/images/**')
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.waitForTimeout(1500)

    // ③ 原来挂掉的图必须重新加载出来（naturalWidth > 0）
    const after = await page.evaluate(() => {
      const imgs = [...document.images]
      const loaded = imgs.filter((i) => i.naturalWidth > 0)
      const hiddenStill = imgs.filter((i) => i.style.display === 'none' && i.naturalWidth > 0)
      return { loadedVisible: loaded.length, hiddenButLoaded: hiddenStill.length, total: imgs.length }
    })
    expect(after.loadedVisible, `回网后仍没有图片加载成功（total=${after.total}）`).toBeGreaterThan(0)
    // ⚠️ 这条是「改了但没生效」的防线：ItemImg 失败时会给图 `display:none`，
    //    重试若不复位这个痕迹，src 换了、图还是看不见（本项目的经典坑）。
    expect(after.hiddenButLoaded, `有 ${after.hiddenButLoaded} 张图已加载成功却还挂着 display:none`).toBe(0)
  })
})
