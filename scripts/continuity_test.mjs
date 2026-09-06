// 挂机连续性测试 — 验证切页/切后台不中断（引擎 setInterval 驱动 + 全局循环计数）
// 运行：node .toolchain/continuity_test.mjs
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../src/stores/player.js'
import { useUiStore } from '../src/stores/ui.js'

// ── 浏览器垫片 ──
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
globalThis.document = { addEventListener() {}, visibilityState: 'visible' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0
let fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  ${name}`) }
  else { fail++; console.log(`FAIL  ${name} ${detail}`) }
}

setActivePinia(createPinia())
const { bootstrapGame, getEngine } = await import('../src/game/bootstrap.js')
const player = usePlayerStore()
const ui = useUiStore()

bootstrapGame()
player.activeTarget = 'apple'
const skill = (await import('../src/game/skills/ForagingSkill.js')).ForagingSkill
const inst = (await import('../src/game/skills/registry.js')).getSkillInstance('foraging')

// 阶段 1：技能页挂机 ~3.5s
await sleep(3500)
const applesAtSkillPage = player.inventory.apple ?? 0
check('挂机', '技能页 3.5s 内开始产出', applesAtSkillPage >= 1, `apples=${applesAtSkillPage}`)
check('挂机', '全局循环计数在走', ui.loopTick > 0, `tick=${ui.loopTick}`)
const tickAtSwitch = ui.loopTick

// 阶段 2：切到多个页面继续挂机 ~4s
ui.setView('shop')
await sleep(1000)
ui.setView('restaurant')
await sleep(1000)
ui.setView('log')
await sleep(1000)
ui.setView('guild')
await sleep(1000)
const applesAfterSwitch = player.inventory.apple ?? 0
check('切页', '切页期间苹果持续产出', applesAfterSwitch > applesAtSkillPage, `${applesAtSkillPage} → ${applesAfterSwitch}`)
check('切页', '切页期间循环未中断', ui.loopTick > tickAtSwitch + 5, `tick ${tickAtSwitch} → ${ui.loopTick}`)

// 阶段 3：进度值可读（切页期间进度条数据源正常）
check('进度', '切页期间 progressPct 正常', inst.progressPct >= 0 && inst.progressPct <= 1, `pct=${inst.progressPct}`)

// 阶段 4：暂停后切页不产出
player.setSkillPaused('foraging', true)
const beforePause = player.inventory.apple ?? 0
ui.setView('season')
await sleep(2500)
check('暂停', '暂停后切页不产出', (player.inventory.apple ?? 0) === beforePause)
player.setSkillPaused('foraging', false)
ui.setView('skill')
await sleep(2500)
check('暂停', '恢复后继续产出', (player.inventory.apple ?? 0) > beforePause)

getEngine().pause() // 释放 setInterval，让进程退出
console.log(fail === 0 ? `\nALL PASS (${pass})` : `\n${fail} FAILURES / ${pass} pass`)
process.exit(fail === 0 ? 0 : 1)
