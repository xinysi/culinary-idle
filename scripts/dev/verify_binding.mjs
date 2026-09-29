// 反例验证：两条「接线守卫」（event_wiring_audit / effect_binding_audit）真的咬得住吗？
//
// 为什么要有这个脚本（本项目铁律）：**「守卫全绿」不等于「守卫有效」** —— 本项目已经栽过多次
//   （自比自、把元素关掉断言还绿、正则写坏导致 0 命中而恒真）。判据不是「注入成功了」，而是
//   **守卫 FAIL 且点名到那个具体缺陷**（既不能绿，也不能只报「少了 5 个」这种没法定位的提示）。
//
// 用法：node scripts/dev/verify_binding.mjs        # 跑全部 8 个注入
//       node scripts/dev/verify_binding.mjs 3 5    # 只跑指定序号
//
// 每个用例：① 先确认**注入前**守卫是绿的 → ② 注入缺陷 → ③ 跑守卫，要求 **exit≠0 且 stderr/stdout 命中点名正则**
// → ④ 无论结果如何都**原样还原**（内容级还原，不是重新生成，避免编码/换行被改）。
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** 跑一条守卫，返回 { code, out }（⚠️ 必须补 `.mjs` —— 首版漏了扩展名，node 直接 MODULE_NOT_FOUND
 *  退出 1，被我的「注入前必须是绿的」前置检查当成「守卫本来就红」⇒ 8 个用例全被判无效。
 *  教训：**前置检查报「本来就不对」时，先怀疑检查自己**。） */
function runGuard(guard) {
  try {
    const out = execFileSync(process.execPath, [join('scripts', 'ci', `${guard}.mjs`)], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

/** 内容级注入：锚点必须**恰好命中一次**，否则用例失败（注入失败必须算失败，不能静默跳过） */
function inject(file, from, to) {
  const p = join(ROOT, file)
  const before = readFileSync(p, 'utf8')
  const hits = before.split(from).length - 1
  if (hits !== 1) throw new Error(`锚点在 ${file} 命中 ${hits} 次（必须恰好 1 次）：${from.slice(0, 60)}`)
  writeFileSync(p, before.replace(from, to), 'utf8')
  return () => writeFileSync(p, before, 'utf8') // 还原
}

const NEW_FILE = 'src/game/data/_tmp_verify_store_p.js'

const CASES = [
  {
    n: 1, title: '把外卖并发数改回不存在的 store 方法（本轮修的那个缺陷）',
    guard: 'effect_binding_audit',
    do: () => inject('src/game/data/activeEffects.js',
      '同时可接 ${takeoutConcurrency(lv)} 单',
      '同时可接 ${p.takeoutConcurrency?.() ?? 1} 单'),
    expect: /p\.takeoutConcurrency/,
  },
  {
    n: 2, title: '把冷库满的事件名改回 bank:full（无人发射的旧名）',
    guard: 'event_wiring_audit',
    do: () => inject('src/App.vue', "EventBus.on('cold:full'", "EventBus.on('bank:full'"),
    expect: /bank:full/,
  },
  {
    n: 3, title: '把 telemetry 的首次离线改回 dev:offline（全站无人发射）',
    guard: 'event_wiring_audit',
    do: () => inject('src/game/dev/telemetry.js', "event: 'offline:settled'", "event: 'dev:offline'"),
    expect: /dev:offline/,
  },
  {
    n: 4, title: '在 TowerView 里加一条没人发射的监听（同时验证 .vue 只扫 script 块也扫得到）',
    guard: 'event_wiring_audit',
    do: () => inject('src/views/TowerView.vue',
      "onMounted(() => EventBus.on('combat:end', handleCombatEnd))",
      "onMounted(() => { EventBus.on('combat:end', handleCombatEnd); EventBus.on('tower:advance', () => {}) })"),
    expect: /tower:advance/,
  },
  {
    n: 5, title: '首领登场不再按 isBoss 分流（sfx.boss 会永不响）',
    guard: 'event_wiring_audit',
    do: () => inject('src/App.vue', "({ isBoss } = {}) => { if (on()) (isBoss ? sfx.boss() : sfx.collect()); syncBgm() }",
      "() => { if (on()) sfx.collect(); syncBgm() }"),
    expect: /isBoss/,
  },
  {
    n: 6, title: '把头像日志改回 this.pushLog?.()（player store 上不存在）',
    guard: 'effect_binding_audit',
    do: () => inject('src/stores/player.js',
      "try { useUiStore().pushLog('头像已更新', 'info') } catch { /* ui 未就绪 */ }",
      "this.pushLog?.('头像已更新', 'info')"),
    expect: /pushLog/,
  },
  {
    n: 7, title: '新加一个 p 引用 ≥10 个**不同**成员、却未登记进 STORE_P_FILES 的数据模块（漏审）',
    guard: 'effect_binding_audit',
    do: () => {
      // ⚠️ 必须是 **10 个不同** 的成员名：A2 的阈值口径是「不同成员数」（unique），不是出现次数 ——
      // 因为出现次数分不开（普通数据对象也能到 10~13 次，如 shanhaiGraph 13 次 / guilds 10 次）。
      // 首版这个注入重复用同一个 `p.skills` ⇒ unique=1 ⇒ 守卫不报，我一度误判成守卫假绿。
      const names = ['skills', 'settings', 'gold', 'inventory', 'stats', 'mail', 'quests', 'daily', 'weekly', 'season', 'seasons', 'combat']
      writeFileSync(join(ROOT, NEW_FILE), names.map((n, i) => `export const tmp${i} = (p) => p.${n}\n`).join(''), 'utf8')
      return () => { if (existsSync(join(ROOT, NEW_FILE))) unlinkSync(join(ROOT, NEW_FILE)) }
    },
    expect: /_tmp_verify_store_p\.js/,
  },
  {
    n: 8, title: '把守卫自己的扫描正则改坏（模拟「0 命中 ⇒ 恒真」的假绿）',
    guard: 'event_wiring_audit',
    do: () => inject('scripts/ci/event_wiring_audit.mjs',
      'const RE = /EventBus\\.(on|emit)(\\?\\.)?\\s*\\(\\s*[\'"]',
      'const RE = /EventBusXXX\\.(on|emit)(\\?\\.)?\\s*\\(\\s*[\'"]'),
    expect: /扫描器自证/,
  },
  {
    n: 9, title: 'TowerView 改回裸 setTimeout（自动爬楼的句柄不再被跟踪）',
    guard: 'timer_lifecycle_audit',
    do: () => inject('src/views/TowerView.vue', 'climbTimer = setTimeout(() => {', 'setTimeout(() => {'),
    expect: /句柄未被跟踪/,
  },
  {
    n: 10, title: 'CombatView 改回裸 setTimeout（持久战延时不再走 schedulePersist）',
    guard: 'timer_lifecycle_audit',
    do: () => inject('src/views/CombatView.vue', 'schedulePersist(500)',
      'setTimeout(() => startNextOpponent(), 500)'),
    expect: /句柄未被跟踪/,
  },
  {
    n: 11, title: '给一个 .vue 加一条没人用的 import（未使用 import 守卫）',
    guard: 'unused_import_audit',
    do: () => inject('src/views/TowerView.vue', "import { getCombat } from '../game/combat/Combat.js'",
      "import { getCombat } from '../game/combat/Combat.js'\nimport { computed as tmpUnusedProbe } from 'vue'"),
    expect: /tmpUnusedProbe/,
  },
  {
    n: 12, title: '名单外的页面偷用 10Hz 引擎节拍（UI 节拍守卫 · A 组）',
    guard: 'ui_tick_audit',
    do: () => inject('src/views/SkillView.vue', "import { computed } from 'vue'",
      "import { computed } from 'vue'\nconst _tmpTickProbe = () => ui.loopTick"),
    expect: /SkillView/,
  },
  {
    n: 13, title: '把慢节拍开成 100ms（等于把省下来的又装回去 · UI 节拍守卫 B 组）',
    guard: 'ui_tick_audit',
    do: () => inject('src/views/EffectsView.vue', 'useIntervalTick(1000)', 'useIntervalTick(100)'),
    expect: /100ms/,
  },
]

const picked = process.argv.slice(2).map(Number)
const todo = picked.length ? CASES.filter((c) => picked.includes(c.n)) : CASES

let pass = 0
let fail = 0
console.log('══ 接线守卫反例验证（要求：FAIL **且点名**）══')

for (const c of todo) {
  let restore = null
  let note = ''
  let good = false
  try {
    // ① 注入前必须是绿的（否则「红」说明不了任何问题）
    const before = runGuard(c.guard)
    if (before.code !== 0) {
      note = `注入前 ${c.guard} 就已经是红的 ⇒ 本用例无效（先修守卫）`
    } else {
      restore = c.do()
      const after = runGuard(c.guard)
      const named = c.expect.test(after.out)
      good = after.code !== 0 && named
      note = after.code === 0
        ? '注入后守卫仍然全绿 ⇒ **假绿**'
        : (named ? 'FAIL 且点名' : 'FAIL 但**没点名**到该缺陷 ⇒ 断言没咬住')
    }
  } catch (e) {
    note = `注入失败：${e.message}`
  } finally {
    try { restore?.() } catch (e) { note += `（还原失败：${e.message}）` }
  }
  if (good) { pass++; console.log(`  ok  #${c.n} ${c.title} —— ${note}`) }
  else { fail++; console.log(`FAIL  #${c.n} ${c.title} —— ${note}`) }
}

// 收尾自证：全部还原后三条守卫必须都回到绿
for (const g of ['event_wiring_audit', 'effect_binding_audit', 'timer_lifecycle_audit', 'unused_import_audit', 'ui_tick_audit']) {
  const r = runGuard(g)
  if (r.code === 0) { pass++; console.log(`  ok  收尾：${g} 已还原为绿`) }
  else { fail++; console.log(`FAIL  收尾：${g} 还原后仍红（有文件没还原干净）`) }
}

console.log(`\n反例验证 通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)