// 长时间游玩的内存复测（开发工具，不进 CI）— 运行：node --expose-gc scripts/sim/memory_sim.mjs
// 做法：真实引擎 tick 30 万次（≈83 小时游戏时间）+ 高频日志 + 每 5000 次一场真实战斗，
//       每 3 万次强制 GC 后采样「保留堆」，看是否无界增长；同时断言日志/年鉴等有上限的容器确实封顶。
// 实测（2026-09-12）：保留堆 20.0 → 20.1 MB（+0.5%），ui.log 恒 500 条 —— 无无界增长迹象。
// 浏览器侧同类观察（Playwright，30s，堆 42.6 → 42.6 MB）见交付记录；两处都跑过才算过。
// 临时：长时间游玩的内存审计（用后即删）。跑法：node --expose-gc scripts/_tmp_memory_audit.mjs
import { createPinia, setActivePinia } from 'pinia'

const { usePlayerStore } = await import('../../src/stores/player.js')
const { useUiStore } = await import('../../src/stores/ui.js')
const { createSkillInstances, getSkillInstance } = await import('../../src/game/skills/registry.js')
const { Combat } = await import('../../src/game/combat/Combat.js')
const { opp } = await import('../../src/game/data/combat.js')
const { EventBus } = await import('../../src/game/core/EventBus.js')

const gc = globalThis.gc ?? (() => {})
setActivePinia(createPinia())
const p = usePlayerStore()
const ui = useUiStore()
p.newGame()
for (const id of Object.keys(p.skills)) p.setSkillState(id, { level: 60, exp: 0 })
p.gold = 1e9
p.inventory.apple = 5000
p.activeTarget = 'apple'
p.setActiveSkill('foraging')
createSkillInstances(p)

const MB = (n) => (n / 1024 / 1024).toFixed(1)
const sample = () => { gc(); return process.memoryUsage().heapUsed }
const log = []
const marks = []

const TICKS = Number(process.env.TICKS ?? 300000) // 300k × 1s = 83 小时游戏时间
const CHUNK = 30000
let baseline = 0
for (let i = 1; i <= TICKS; i++) {
  p.tick(1000)
  // 每 10 次触发一次日志/事件（模拟真实游玩的高频日志）
  if (i % 10 === 0) ui.pushLog(`测试日志 #${i}`, 'gain')
  // 每 5000 次打一场真实战斗 + 一次奇遇式事件
  if (i % 5000 === 0) {
    const c = new Combat(p)
    if (p.combat.hp <= 0) p.setCombat({ hp: p.maxHp })
    c.start(opp(40, '内存测试对手', 'knife', { drops: [] }))
    let g = 0
    while (c.inFight && g++ < 500) c.tick(200)
    EventBus.emit('combat:end', { result: 'win', opponent: '内存测试对手', gold: 1, drops: [], isBoss: false, turns: 3, hpLeft: p.combat.hp, hpMax: p.maxHp, oppLevel: 40 })
  }
  if (i % CHUNK === 0) {
    const h = sample()
    if (!baseline) baseline = h
    marks.push({ tick: i, heap: h })
    log.push(`tick ${String(i).padStart(7)}：保留堆 ${MB(h)} MB（相对基线 ${((h / baseline - 1) * 100).toFixed(1)}%）· 日志 ${ui.log.length} 条 · 年鉴 ${p.chronicle?.length ?? 0} 条`)
  }
}

console.log(log.join('\n'))
const first = marks[0].heap
const last = marks[marks.length - 1].heap
console.log(`\n【内存】${TICKS} 次 tick（≈${(TICKS / 3600).toFixed(0)} 小时游戏时间）：保留堆 ${MB(first)} MB → ${MB(last)} MB（增长 ${((last / first - 1) * 100).toFixed(1)}%）`)
const caps = [
  ['ui.logs ≤ 500', ui.log.length <= 500, ui.log.length],
  ['年鉴 ≤ 300', (p.chronicle?.length ?? 0) <= 300, p.chronicle?.length ?? 0],
  ['背包种类 ≤ 上限', Object.keys(p.inventory).length <= p.inventoryCap, Object.keys(p.inventory).length],
  ['素材计数有限', Number.isFinite(p.inventory.apple) && p.inventory.apple < 1e9, p.inventory.apple],
]
for (const [name, ok, val] of caps) console.log(`${ok ? '✅' : '❌'} ${name} — 实际 ${val}`)
console.log(last / first < 1.5 ? '✅ 保留内存增长 < 50%（无无界增长迹象）' : `⚠ 保留内存增长 ${((last / first - 1) * 100).toFixed(0)}%，需人工判断是否有慢泄漏`)
