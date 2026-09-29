// UI 节拍审计（2026-09-28 立，CI 亦执行）
//
// 背景：全站一度统一用 `ui.loopTick` 驱动「倒计时/进度实时刷新」，而那是**引擎节拍 10Hz**
// （`GameEngine.js` 的 `TICK_INTERVAL_MS = 100`）。2026-09-26 修厨藏页时实测到：挂在 10Hz 上重算
// 一个 2267 格的列表 = 单次 **35.3ms** ⇒ 每秒烧 353ms 主线程（静置不动也一直掉帧）。
//
// 2026-09-28 把「每 tick 重算」逐个**计时**后（不是凭感觉搬）：
//   · `collectEffects`（效果总览，105 行逐条 read） = **2037 µs/次** ⇒ 10Hz 下 **20 ms/秒** ⇒ 已改 1Hz 慢节拍
//   · 其余全部 1~14 µs（cellarState 4.3 / mushroomState 5.0 / caravanState 3.6 / ranchState 3.6 /
//     realmState 3.7 / expeditionState 7.8 / getRunningIdleSkills 14.1）⇒ 10Hz 下 0.04~0.14 ms/秒，**不值得改**
//   · 战斗类（CombatArena / CombatView / ArenaView / TowerView / CombatPanel / CombatLog / MysticRealmView）
//     是**必须逐帧**的（combat 实例属性非响应式，血量/回合/日志只能靠节拍重算）
//
// 本审计钉三件事：
//   A. **`ui.loopTick` 只能出现在显式名单里**（战斗帧 / 小体量固定控件 / 定义处）——新页面想用会 FAIL，
//      逼人先量一次单次成本再决定（判据与实测数据都写在上面）
//   B. **慢节拍不许开太快**：`useIntervalTick(n)` 的 n 必须 ≥ 500ms（否则等于把省下来的装回去）
//   C. **具体回归点**：效果总览必须走 `useIntervalTick` 且不得再引用 `ui.loopTick`
//
// ⚠️ 量级提醒（写这条守卫时的教训）：我**先猜**过「这些页面大概 0.2~0.5ms，不值得改」，
//    实测是 **2037 µs**（差 4000 倍）。**猜成本是这类判断里最容易错的一步** —— 想加文件进下面名单，
//    请先跑一次 `node -e` 计时（`useIntervalTick.js` 顶部记了做法）。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, stripHtmlComments } from './lib/comments.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const fails = []
const ok = []
const check = (name, cond, detail = '') => (cond ? ok.push(name) : fails.push(`${name}${detail ? '  ← ' + detail : ''}`))

function walk(dir, out = []) {
  for (const e of readdirSync(join(root, dir))) {
    const rel = `${dir}/${e}`
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out)
    else if (/\.(js|vue)$/.test(e)) out.push(rel)
  }
  return out
}
const read = (p) => {
  let txt = readFileSync(join(root, p), 'utf8')
  if (p.endsWith('.vue')) txt = [...txt.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')
  return stripHtmlComments(stripComments(txt))
}

/** 允许继续挂在 10Hz `ui.loopTick` 上的文件（每条都带理由；新增请先计时） */
const ALLOW = new Map([
  ['src/game/core/GameEngine.js', '定义处：引擎每 tick 递增 loopTick'],
  ['src/stores/ui.js', '定义处：字段声明 + 递增'],
  ['src/components/CombatArena.vue', '战斗帧（血量/回合/日志/回合进度条，必须逐帧）'],
  ['src/components/CombatPanel.vue', '战斗面板（同上）'],
  ['src/components/CombatLog.vue', '战斗日志（同上）'],
  ['src/views/CombatView.vue', '战斗帧'],
  ['src/views/ArenaView.vue', '战斗帧'],
  ['src/views/TowerView.vue', '战斗帧'],
  ['src/views/MysticRealmView.vue', '秘境战斗态（combat 实例与 realm 存储均非响应式）'],
  ['src/components/BottomDock.vue', '挂机中条：固定 5~6 个胶囊，重算成本可忽略'],
  ['src/components/NewbieGuide.vue', '新手引导：一个固定卡片'],
  ['src/components/ItemDetailModal.vue', '物品详情弹窗的腐坏倒计时（单个弹窗）'],
  ['src/components/RestaurantScene.vue', '餐厅 2D 场景：固定数量的立绘'],
  ['src/components/DevPanel.vue', '开发者面板（不进产物）'],
  ['src/composables/useIdleTasks.js', '抽屉/底栏共用的挂机列表：并行上限内才有任务（实测 14 µs 级）'],
  // ── 倒计时类页面：**实测每 tick 重算只有 1~14 µs**（见文件头那张表）⇒ 10Hz 下 0.04~0.14 ms/秒，不值得改。
  //    ⚠️ 别「顺手把它们也搬到 1Hz」：这些页面各自渲染 `ProgressBar`（数值模式，由 Vue 驱动），
  //    降到 1Hz 会让进度条肉眼可见地一格一格跳，而收益是零。要让它们既省又丝滑，得先把那些
  //    `ProgressBar` 改成**绝对时间戳模式**（`start-at`/`duration-ms`，它自己用 rAF 写 transform）——那是另一个改动。
  ['src/views/CellarView.vue', '冷库倒计时（实测 cellarState 4.3 µs）'],
  ['src/views/RanchView.vue', '牧场产出倒计时（ranchState 3.6 µs）'],
  ['src/views/CaravanView.vue', '商队归队倒计时（caravanState 3.6 µs）'],
  ['src/views/SchoolsView.vue', '菜系研究倒计时（纯文案）'],
  ['src/views/BanquetView.vue', '宴会订单倒计时（单个订单）'],
  ['src/views/ExpeditionView.vue', '远行队倒计时（expeditionState 7.8 µs；进度条已走时间戳模式）'],
  ['src/views/MycoFieldView.vue', '菌房/灵田倒计时（mushroomState 5.0 µs）'],
  ['src/views/GreenhouseView.vue', '温室蜂场倒计时（同上量级）'],
  ['src/views/FarmingView.vue', '农田地块倒计时（纯文案 + ProgressBar）'],
  ['src/views/GastronomyView.vue', '只读一个布尔（speedAtCap）：虽然不需要节拍，但离开节拍后该徽章会等到其它原因重渲染才更新，保留'],
])

let total = 0
const offenders = []
for (const f of walk('src')) {
  const txt = read(f)
  const n = (txt.match(/ui\.loopTick/g) ?? []).length
  if (!n) continue
  total += n
  if (!ALLOW.has(f)) offenders.push(`${f}（${n} 处）`)
}

// ── A. 名单之外不许用 loopTick ──
check('A. `ui.loopTick` 只出现在显式名单里（战斗帧 / 小体量控件 / 定义处）',
  offenders.length === 0,
  offenders.length ? `名单外：${offenders.join('、')}。要用请先计时单次成本，再加进 ALLOW 并写明理由` : '')

// ── B. 慢节拍不许开太快 ──
{
  const bad = []
  for (const f of walk('src')) {
    for (const m of read(f).matchAll(/useIntervalTick\(\s*(\d+)/g)) {
      const ms = Number(m[1])
      if (ms < 500) bad.push(`${f} 的 ${ms}ms`)
    }
  }
  check('B. `useIntervalTick(n)` 的间隔 ≥ 500ms（否则等于把省下来的又装回去）', bad.length === 0, bad.join('、'))
}

// ── C. 具体回归点：效果总览（本轮唯一实测真的贵的页面）──
{
  const fx = read('src/views/EffectsView.vue')
  check('C. 效果总览已改 1Hz 慢节拍（`useIntervalTick(1000)`）', /useIntervalTick\(1000\)/.test(fx))
  check('C. 效果总览不再引用 `ui.loopTick`', !/ui\.loopTick/.test(fx))
  const comp = read('src/composables/useIntervalTick.js')
  check('C. 慢节拍原语在卸载时清掉定时器（否则离场后还在跑）',
    /onBeforeUnmount/.test(comp) && /clearInterval\(/.test(comp))
  check('C. 慢节拍原语里记着实测依据（2037 µs 那条），别让下一个人凭感觉重新搬一遍',
    /2037/.test(readFileSync(join(root, 'src/composables/useIntervalTick.js'), 'utf8')))
}

// ── D. 扫描器自证 ──
check('D. 扫描器自证：扫到的 `ui.loopTick` 引用 ≥ 15 处（过少说明剥注释/正则没生效）', total >= 15, `实际 ${total}`)

console.log('══ UI 节拍审计（10Hz 引擎节拍只给该给的人）══')
for (const n of ok) console.log('  ok  ' + n)
for (const n of fails) console.log('FAIL  ' + n)
console.log(`\n名单内文件 ${ALLOW.size} 个 / 实际引用 ${total} 处`)
console.log(`通过 ${ok.length} / 失败 ${fails.length}`)
process.exit(fails.length ? 1 : 0)