// EventBus 接线审计（2026-09-28 立，CI 亦执行）
//
// 背景：2026-09-28 全量体检抓到 **5 处「有人 listen、全站没人 emit」的死监听** ——
//   App.vue 的 `arena:end` / `tower:advance` / `boss:appear` / `bank:full`，MinigamesView 的 `mg:back`；
//   外加 telemetry 的 `dev:offline` / `dev:prestige` / `dev:season`（走 `EventBus.on(def.event)` 动态订阅，
//   名字写在一张静态表里）。它们的共同特征：**不报错、不崩、也不生效** ——
//   · 三个音效（sfx.tower×2 / sfx.boss）从来没响过；
//   · 按名字本意最该响的那一处（冷库满）因为事件名从 `bank` 改成 `cold` 而漏掉；
//   · 开发者面板的三个里程碑恒定不点亮。
//
// 为什么必须静态守卫：模板绑定守卫（`_ctx.X`）管不到字符串事件名；引擎行为测试也管不到 ——
// **没有监听者时，事件总线上的一次 emit 本身就是合法的空操作**，跑起来毫无异常。
//
// 本审计钉四件事：
//   A. **凡有 on 必有 emit**：每个被监听的事件名，src 内至少要有一处 emit（否则 FAIL 并点名）
//   B. **动态订阅也不放过**：`EventBus.on(def.event)` 这种写法，把同文件里静态表里的名字也纳入 A 的判据
//   C. **关键接线在位**：冷库满（`cold:full`）必须有人听；`combat:start` 的监听必须按 `isBoss` 分流
//   D. **基线不对着名字自比自**：被监听事件数不得骤降（防「把 on 整段删掉 ⇒ 守卫照样全绿」）
//
// ⚠️ 反向不查：**emit 无监听是设计内的**（46 个 hooks —— `caravan:start`/`item:use` 等由调用方直接渲染结果）。
//
// 反例验证：`node scripts/dev/verify_binding.mjs`（把 on 换成没人发射的名字、把 cold:full 改回 bank:full、
//   把 telemetry 的 event 改回 dev:* ⇒ 三条各自 FAIL 并点名）。**几何断言不写「只看总数」** ——
//   每条失败都必须能点名到具体事件名，否则「少了 5 个」这种提示没法定位。
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
    else if (/\.(js|vue|cjs|mjs)$/.test(e)) out.push(rel)
  }
  return out
}
// 🔴 `.vue` **只扫 `<script>` 块**：`stripComments` 的引号状态机是按 JS 写的，而模板/样式里
// 出现一个不成对的引号（属性值、中文文案里的 `'`）就会让它「一直以为自己在字符串里」，
// 把后面的 `<script setup>` **整段当成字符串吞掉** ⇒ 这个文件的事件全看不见（假绿）。
// 先切出脚本块再剥注释，就不受模板/样式影响。多块（`<script>` + `<script setup>`）全取。
const read = (p) => {
  let txt = readFileSync(join(root, p), 'utf8')
  if (p.endsWith('.vue')) {
    txt = [...txt.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')
  }
  return stripComments(stripHtmlComments(txt))
}

const files = walk('src')
const ons = new Map() // event -> Set(文件)
const emits = new Map()
const add = (map, k, f) => { if (!map.has(k)) map.set(k, new Set()); map.get(k).add(f) }

// 🔴 正则必须写成「**可选**的 `?.`」（`(\?\.)?`）。首版写成 `\??\.`（= 可选的 `?` 后面**必须有个点**），
// 于是只认 `EventBus.on.('x'` 这种不存在的写法 ⇒ 一个都没匹配到、ons/emits 全空 ⇒ A 恒真（假绿）。
// 下面 D 组的「解析到底有多少条」就是为这种情况立的：**守卫自己坏掉时，必须有断言先喊**。
const RE = /EventBus\.(on|emit)(\?\.)?\s*\(\s*['"]([^'"]+)['"]/g
let dynamicOn = 0
for (const f of files) {
  const txt = read(f)
  for (const m of txt.matchAll(RE)) {
    if (m[1] === 'on') add(ons, m[3], f)
    else add(emits, m[3], f)
  }
  // `EventBus.on(def.event)` / `EventBus.on(EVENTS[i])` —— 名字不在调用处，统计出来单独处理
  if (/EventBus\.(on)(\?\.)?\s*\(\s*[^'"\s)]/.test(txt)) dynamicOn++
}

// ── B. 动态订阅：把写静态表的那批名字也当「被监听」（本项目只有 telemetry 这么写）──
const telPath = 'src/game/dev/telemetry.js'
const telEvents = [...read(telPath).matchAll(/event:\s*'([^']+)'/g)].map((m) => m[1])
check('B. telemetry 的静态事件表被解析出来了（≥7 条，含 isBoss/首次离线那批）',
  telEvents.length >= 7, `解析到 ${telEvents.length} 条`)
for (const ev of telEvents) add(ons, ev, telPath)
check('B. 动态订阅确实被计入了 on 集合（telemetry 的 FIRST_MARKS 名字都在）',
  telEvents.every((e) => ons.has(e)))

// ── A. 凡有 on 必有 emit ──
{
  const dead = [...ons.keys()].filter((k) => !emits.has(k)).sort()
  check('A. 没有任何「有人 listen、全站没人 emit」的死监听', dead.length === 0,
    dead.length ? `${dead.length} 个：${dead.map((d) => `${d}（听：${[...ons.get(d)].join('、')}）`).join('；')}` : '')
}

// ── C. 关键接线在位（每条都能单独 FAIL）──
{
  const app = read('src/App.vue')
  check('C. 冷库满有声：App.vue 监听 `cold:full`（原来的 `bank:full` 无人发射）',
    /EventBus\.on\(\s*'cold:full'/.test(app) && !/EventBus\.on\(\s*'bank:full'/.test(app))
  check('C. 首领登场按 isBoss 分流（combat:start 的 payload 要带 isBoss，否则 sfx.boss 永不响）',
    /EventBus\.on\(\s*'combat:start',\s*\(\{\s*isBoss\s*\}/.test(app) && /isBoss\s*\?/.test(app))
  // 三条被删掉的历史死监听不许被「顺手加回来」
  for (const gone of ['arena:end', 'tower:advance', 'boss:appear']) {
    check(`C. 已删的历史死监听 ${gone} 没有被加回来`, !ons.has(gone))
  }
  check('C. bootstrap 的 `bank:full` 死监听已删（冷库满由 player.js 自己 pushLog）',
    !/EventBus\.on\(\s*'bank:full'/.test(read('src/game/bootstrap.js')))
}

// ── D. 基线：被监听事件数不得骤降（防「整段 on 被删 ⇒ 上面的 A 恒真」）──
// 口径是「文件数 + 名字数」双基线：只钉名字数会漏掉「同一个事件换个文件听」。
{
  // 🔴 先自证「扫描器真的扫到了东西」：解析出来的条数过少 ⇒ 十有八九是上面的正则/剥注释写坏了，
  // 那种情况下 A 会因为 ons 为空而**恒真**（本项目最忌讳的假绿）。基线取实测值的下沿。
  check('D. 扫描器自证：解析到的 emit 条数 ≥ 100（基线 121；过少说明正则或剥注释坏掉了，A 会假绿）',
    [...emits.values()].reduce((a, s) => a + s.size, 0) >= 100,
    `实际 emit 名字 ${emits.size} 个 / 出现文件 ${[...emits.values()].reduce((a, s) => a + s.size, 0)} 次`)
  const n = ons.size
  check('D. 被监听事件数 ≥ 70（基线 75；骤降说明 on 被整段删了而 A 会假绿）', n >= 70, `实际 ${n}`)
  const listenerFiles = new Set([...ons.values()].flatMap((s) => [...s]))
  // 基线 8 = 实测（App.vue · bootstrap.js · celebrations.js · telemetry.js · ArenaView/CombatView/MysticRealmView/TowerView）。
  // 这条防的是「某个 .vue 的 on 被剥注释吞掉」（8 个文件里少一个就说明扫描面漏了）。
  check('D. 带 EventBus.on 的文件数 ≥ 6（基线 8）', listenerFiles.size >= 6, `实际 ${listenerFiles.size}`)
}

// ── 输出 ──
console.log('══ EventBus 接线审计（凡有 on 必有 emit）══')
for (const n of ok) console.log('  ok  ' + n)
for (const n of fails) console.log('FAIL  ' + n)
console.log(`\n监听事件 ${ons.size} 个 / 发射事件 ${emits.size} 个 / 动态订阅点 ${dynamicOn} 处`)
console.log(`通过 ${ok.length} / 失败 ${fails.length}`)
process.exit(fails.length ? 1 : 0)