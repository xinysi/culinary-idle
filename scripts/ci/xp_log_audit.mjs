// CI 守卫：经验「显示 / 日志 / 结算」三处同源 + 日志覆盖完整（2026-10-01 用户报障后立）
//
// 起因（用户实测）：「美食探索的经验计算可能存在问题，而且日志也没显示每次获得的经验是多少……
//                   关于日志也是，能看出来覆盖的不全」。
// 查实三处真缺陷（本脚本把三条都钉住）：
//   ① 探索卡片显示的是**作者基数** `t.xp`（245），而实际到账是 ×60 的 **14700** —— 与采集页两套口径；
//   ② 探索的 `skill:action` 事件**丢了 addCardXp 的返回值** ⇒ 日志里没有「+N 经验」（采集/制作都有）；
//   ③ 采矿/伐木走基类 `performAction` 时**没传 outcome**，采摘/施肥也没有专门文案 ⇒ 落到 default，
//      「采矿：获得 铜矿 ×2」把动作感丢了、施肥更被写成「获得 堆肥」（**语义反了**：那是用掉的）。
//
// 三组检查：
//   A 行为：逐支技能驱动一次动作，「事件里的 expGained」必须 == 「经验条真实增量」（漏了/写错都红）
//   B 静态：技能发出的每个 outcome 都在日志 switch 里有专门 case（不落到 default）
//   C 静态：显示经验数值的技能页都必须乘 CARD_XP_SCALE（探索就是从这条漏的）
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const rd = (p) => readFileSync(join(ROOT, p), 'utf8')
let pass = 0, fail = 0
const check = (group, name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  [${group}] ${name}`) }
  else { fail++; console.log(`FAIL  [${group}] ${name}${detail ? ' — ' + detail : ''}`) }
}

// ═══ A 行为：日志经验 == 到账 ═══
setActivePinia(createPinia())
const { usePlayerStore } = await import('../../src/stores/player.js')
const { EventBus } = await import('../../src/game/core/EventBus.js')
const { createSkillInstances, getSkillInstance, getAllSkillInstances } = await import('../../src/game/skills/registry.js')
const { SEED_MAP } = await import('../../src/game/data/farmSeeds.js')
const { SKILL_DEFS } = await import('../../src/game/data/skills.js')

const p = usePlayerStore()
p.newGame()
p.settings.xpMultiplier = 1
p.gainGold(50_000_000)
const LVL = 60
// ⚠️ 先给**所有**技能建状态、再 createSkillInstances：只建 14 支的话实例表里会缺项
//    （`getSkillInstance` 返回 null ⇒ 整个 A 组直接崩，而不是红一条断言）。
for (const id of Object.keys(SKILL_DEFS)) p.setSkillState(id, { level: LVL, exp: p.xpTotalForLevel(LVL) })
createSkillInstances(p)

function oneAction(skillId, drive) {
  const inst = getSkillInstance(skillId)
  if (!inst) throw new Error(`getSkillInstance('${skillId}') 返回 null（实例表：${Object.keys(getAllSkillInstances()).join(',')}）`)
  const evs = []
  const h = (e) => evs.push(e)
  EventBus.on('skill:action', h)
  const before = inst.exp
  const orig = Math.random
  Math.random = () => 0.001
  try { drive(inst) } catch { /* 驱动失败按「无事件」处理 */ }
  Math.random = orig
  EventBus.off('skill:action', h)
  const delta = Math.floor(inst.exp) - Math.floor(before)
  const ev = evs.find((e) => typeof e.expGained === 'number') ?? null
  return { delta, ev }
}

const topTarget = (inst) => [...inst.targets].filter((x) => x.reqLevel <= LVL).sort((a, b) => b.reqLevel - a.reqLevel)[0]
// 从数据派生技能清单（**不手抄 id**：本轮就踩过 `seasoning` 其实不是技能 id，
// 结果整组崩在 null 上而不是红一条断言）
const SKILL_IDS = Object.entries(SKILL_DEFS)
const GATHER_IDS = SKILL_IDS.filter(([id, d]) => d.category === 'gathering' && id !== 'farming').map(([id]) => id)
const PROD_IDS = SKILL_IDS.filter(([, d]) => d.category === 'production').map(([id]) => id)

const CASES = []
for (const id of GATHER_IDS) {
  CASES.push([id, (inst) => {
    const t = topTarget(inst)
    p.setSkillTarget(id, t.itemId ?? t.id)
    if (inst.ammoItemId) p.gainItem(inst.ammoItemId, 100)
    inst.tick((inst.intervalMs(t) || 3000) + 1)
  }])
}
CASES.push(['farming', (inst) => {
  const c = [...inst.crops].filter((x) => x.reqLevel <= LVL).sort((a, b) => b.reqLevel - a.reqLevel)[0]
  const seedId = SEED_MAP[c.itemId]
  p.gainItem(seedId, 5)
  inst.plant(0, seedId)
  p.setPlot(0, { seedId, plantedAt: Date.now() - (inst.growSecOf(c) + 5) * 1000 })
  inst.harvest(0)
}])
CASES.push(['exploration', (inst) => inst.performAction(topTarget(inst))])
for (const id of PROD_IDS) {
  CASES.push([id, (inst) => {
    const r = [...inst.recipes].filter((x) => x.reqLevel <= LVL).sort((a, b) => b.reqLevel - a.reqLevel)[0]
    for (const [iid, q] of Object.entries(r.ingredients ?? {})) p.gainItem(iid, (q ?? 1) * 10)
    inst.craft(r)
  }])
}

const noExp = [], mismatch = []
const observedOutcomes = new Set()
for (const [id, drive] of CASES) {
  const { delta, ev } = oneAction(id, drive)
  if (!ev) { noExp.push(`${id}(无事件)`); continue }
  if (ev.outcome) observedOutcomes.add(ev.outcome)
  if (typeof ev.expGained !== 'number') { if (delta > 0) noExp.push(id); continue }
  if (ev.expGained !== delta) mismatch.push(`${id}: 日志 ${ev.expGained} ≠ 到账 ${delta}`)
}
check('经验日志同源', `${CASES.length} 支技能的动作事件都带了 expGained（漏了日志就不显示经验）`, noExp.length === 0, noExp.join(','))
check('经验日志同源', '事件里的 expGained == 经验条真实增量（显示/日志/结算三处同源）', mismatch.length === 0, mismatch.join(' | '))

// ═══ B 静态：outcome 覆盖 ═══
// ⚠️ 三处都要收：`outcome: 'x'` 字面量 · 三元里的两个字面量 · **`get actionOutcome(){ return 'x' }` 这种 getter**
//    —— 反例验证抓到过：只扫字面量时，采矿/伐木的 `mine`/`chop`（走 getter）根本没被收集 ⇒
//    把 bootstrap 里对应的文案整个删掉，守卫照样全绿（假绿）。
const emitted = new Set(observedOutcomes) // A 组**实测**发出来的（最硬）
for (const f of readdirSync(join(ROOT, 'src/game/skills')).filter((x) => x.endsWith('.js'))) {
  const src = rd('src/game/skills/' + f)
  for (const m of src.matchAll(/outcome:\s*'([a-zA-Z]+)'/g)) emitted.add(m[1])
  for (const m of src.matchAll(/outcome:\s*[^,\n]*\?\s*'([a-zA-Z]+)'\s*:\s*'([a-zA-Z]+)'/g)) { emitted.add(m[1]); emitted.add(m[2]) }
  for (const m of src.matchAll(/actionOutcome[^}]*return\s+'([a-zA-Z]+)'/g)) emitted.add(m[1])
}
const boot = rd('src/game/bootstrap.js')
const cases = new Set([...boot.matchAll(/case '([a-zA-Z]+)':/g)].map((m) => m[1]))
const uncovered = [...emitted].filter((o) => !cases.has(o)).sort()
check('日志覆盖', `技能发出的 ${emitted.size} 个 outcome 都有专门文案（没有落到 default 的）`, uncovered.length === 0, uncovered.join(','))

// ═══ C 静态：显示经验必须乘 CARD_XP_SCALE ═══
// 判据：凡是模板里渲染 `.xp` / `.xpPerAction` 的视图，脚本里必须出现 CARD_XP_SCALE
// 允许清单（其余一律要乘）：`GreenhouseView` 的 `h.xp` 是**蜂蜜/菌灵露自带的经验倍率**
// （`×1.5` 那种道具字段），不是「卡片经验」——与本条要防的 60× 口径无关。
const XP_VIEW_EXEMPT = new Set(['GreenhouseView.vue'])
const views = readdirSync(join(ROOT, 'src/views')).filter((f) => f.endsWith('.vue'))
const naive = []
for (const v of views) {
  if (XP_VIEW_EXEMPT.has(v)) continue
  const src = rd('src/views/' + v)
  const tpl = src.slice(src.indexOf('<template>'))
  // 两种显示形态都要认：`{{ t.xp }}` / `{{ t.xpPerAction }}` 与 `{{ xpOf(t) }}`（名字里带 xp 的函数）。
  // ⚠️ 只认前者的话，探索页把它改成函数调用后**整页会被跳过**——反例验证实测过这种「静默漏检」。
  const direct = /\{\{\s*\w+\.xp(PerAction)?\s*\}\}/.test(tpl)
  // 函数名要认「真的在报经验」的：`xpOf` / `xpPerTime` 这类 ✓；
  // 排除 `expPrice`（经验价格）、`expectCount`（含 "xp" 但不是经验）这类同形误报。
  const fnm = tpl.match(/\{\{\s*((?![eE]xp)\w*[Xx]p\w*)\s*\(/)
  if (!direct && !fnm) continue
  const fn = fnm?.[1]
  // 精确到「**显示那一处**」用的是不是生效值：
  //    · 函数形态 ⇒ 要求**那个函数体里**有乘法（只查整页会假绿：`const base = t.xp * CARD_XP_SCALE`
  //      还在，而 return 被改成 `t.xp` ⇒ 整页仍有乘法、守卫照样全绿）
  //    · 直接渲染字段 ⇒ 要求整页出现乘法
  let scaled = /\*\s*CARD_XP_SCALE/.test(src)
  if (direct && !fn) scaled = /\*\s*CARD_XP_SCALE/.test(src)
  if (fn) {
    const body = new RegExp(`function\\s+${fn}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`).exec(src)
    scaled = body ? /\*\s*CARD_XP_SCALE/.test(body[1]) : false
  }
  if (!scaled) naive.push(v + (fn ? `#${fn}` : ''))
}
check('经验显示同源', '渲染原始 xp 字段的页面都乘了 CARD_XP_SCALE（探索就是从这条漏的）', naive.length === 0, naive.join(','))

console.log(`\n══ xp_log_audit：通过 ${pass} / 失败 ${fail} ══`)
process.exit(fail === 0 ? 0 : 1)
