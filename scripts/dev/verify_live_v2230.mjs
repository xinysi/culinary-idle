// 线上核验（v2.23.0）——只查「只在本版出现的可见特征」，不比对 chunk 哈希
// （Pages 用自带 Node 构建，产物哈希与本地不一致，比哈希会误判成「没部署」）。
//
// 本版四个独有特征（全部来自「战斗深度 v1」）：
//   ① 对手抗性行 `.foe-resist` 出现，且与引擎出口的文案一致（摆盘流敌 ⇒ 对「割伤」有抗性）
//   ② 战斗屏能画出「对手身上的状态」徽章 `.foe-status-chip`（本版新增的玩家→敌人状态）
//   ③ 效果总览新增「对手身上的状态」行（本版新增的第 104 行）
//   ④ 命中可堆且**封顶**：把词条命中设成 10000，accuracy 必须正好等于 (10+等级)×(1+120/40)
//      —— 旧加法形态会得出 10010 左右，所以这条同时证明「换成了乘区形态」与「上限生效」
import { chromium } from 'playwright'

const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=2230'
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

// ①③④ 都在页面内取：用**带 HMR 查询串**的模块 URL（裸 import 会拿到另一个实例，本项目已知坑）
const probe = await page.evaluate(async () => {
  const res = performance.getEntriesByType('resource').map((e) => e.name)
  const urlOf = (frag) => res.find((n) => n.includes(frag))
  const { getCombat } = await import(urlOf('/src/game/combat/Combat.js'))
  const { opp } = await import(urlOf('/src/game/data/combat.js'))
  const T = await import(urlOf('/src/game/data/combatTuning.js'))
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const p = pinia._s.get('player')
  const ui = pinia._s.get('ui')
  const cb = getCombat()
  const out = {}
  // ④ 命中乘区 + 封顶
  for (const id of ['tasteAcumen', 'heatControl', 'knife', 'plating', 'flavorArtistry']) p.skills[id].level = 60
  const weapon = Object.values((await import(urlOf('/src/game/data/items.js'))).ITEMS).find((i) => i.type === 'equipment' && i.slot === 'weapon')
  p.equipment.weapon = weapon?.id ?? null
  p.gearMods = weapon ? { [weapon.id]: { itemId: weapon.id, mods: [{ stat: 'accuracy', value: 10000 }] } } : {}
  p.combat.style = 'knife'
  out.accCapped = cb.playerStats().accuracy
  out.accExpected = Math.floor((10 + 60) * (1 + T.ACC_GEAR_CAP / T.ACC_GEAR_DIV))
  p.gearMods = {}
  // ① 抗性行：起一场 vs 摆盘流敌人的战斗（被刀工克 ⇒ 抗「割伤」）
  p.inventory.garnish = 9999
  ui.setView('skill')
  p.activeSkill = 'knife'
  await new Promise((s) => setTimeout(s, 700))
  cb.respawnUntil = 0
  // ⚠️ 敌人给「血厚 + 零攻」：血厚是为了别一下打死（否则状态还没读到战斗就结束了），
  //    零攻是为了**别把玩家打死** —— 首版给 999999 血没管攻击，2 秒后玩家阵亡、inFight=false，
  //    于是效果总览那行退回「未生效」被折进折叠卡 ⇒ 页面里根本搜不到（真因不是 UI 坏了）
  cb.start({ ...opp(60, '线上核验对手', 'plating'), hp: 999999, atk: 0 })
  cb.enemyStatus.bleed = 3
  cb.enemyStatus.dBreak = 2
  cb.enemyStatus.burn = 1
  await new Promise((s) => setTimeout(s, 800))
  out.resist = document.querySelector('.foe-resist')?.innerText.trim() ?? null
  out.chips = [...document.querySelectorAll('.foe-status-chip')].map((e) => e.innerText.trim())
  out.resistTextExpected = T.resistText({ style: 'plating' })
  // ③ 效果总览：本版新增的第 104 行「对手身上的状态」——**页面层断言**（渲染出来了 + 真的亮着）
  //    ⚠️ 两个坑：① 不能按「叶子元素」找行名 —— 行名所在的那个 span **还带着子元素**（tag/src），
  //       所以 `children.length === 0` 的扫描必然找不到；用整页 innerText 最稳。
  //       ② 不走模块 import —— `activeEffects.js` 不在 resource 清单里（EffectsView 经其它路径引入）。
  ui.setView('effects')
  await new Promise((s2) => setTimeout(s2, 1200))
  const text = document.body.innerText
  out.effectRow = text.includes('对手身上的状态')
  const i = text.indexOf('对手身上的状态')
  out.effectRowDetail = i >= 0 ? text.slice(i, i + 90).replace(/\s+/g, ' ') : null
  // 「亮着」的判据：同一行块里能看到具体状态名（未生效的行只会写原因，不会写状态名）
  out.effectRowLit = /割伤|破防|灼烧/.test(out.effectRowDetail ?? '')
  return out
})

ok(probe.accCapped === probe.accExpected && probe.accCapped < 1000, '命中换成乘区形态且封顶生效（本版新增）',
  `实到 ${probe.accCapped} · 期望 ${probe.accExpected}（旧加法形态会是 ~10010）`)
// 页面模板会给抗性行加一个装饰前缀（🔸），所以比「包含」而不是「全等」
ok(!!probe.resist && probe.resist.includes(probe.resistTextExpected), '战斗屏画出对手抗性行，且与引擎出口同源',
  `页面「${probe.resist}」· 出口「${probe.resistTextExpected}」`)
ok(probe.chips.length === 3, '战斗屏画出「对手身上的状态」徽章（本版新增）', JSON.stringify(probe.chips))
ok(!!probe.effectRow && probe.effectRowLit, '效果总览有「对手身上的状态」行且真的亮起（本版新增）',
  `页面可见=${probe.effectRow} · 明细「${probe.effectRowDetail}」`)

console.log('页面错误：', errs.length ? errs.slice(0, 3) : '无')
ok(errs.length === 0, '零 console / page 错误')
try { await page.screenshot({ path: 'scripts/sim/out/live-v2230.png' }) } catch { /* 目录不存在时忽略 */ }
await b.close()
console.log(bad === 0 ? '\n线上核验通过：v2.23.0 的四个可见特征全部到位' : `\n有 ${bad} 项不达标`)
process.exit(bad === 0 ? 0 : 1)
