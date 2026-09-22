// 模板绑定审计（2026-09-22 立，CI 亦执行）
//
// 背景：用户报「制作的无法使用精通池」。根因是 `ProductionView.vue` 的模板里用了
// `queueHeadId` / `queueHeadName` / `queueHeadCount`，而 `<script setup>` 里**一个都没定义** ——
// Vue 3 把模板里未声明的标识符编译成 `_ctx.xxx`，运行时取到 `undefined`：
// **不报错、不白屏、控制台无警告**，构建也通过 ⇒ 精通池的「补给」按钮永远禁用。
// 同一轮还抓出 `headTitle` / `recipeNoun`（生产页标题与量词静默变空字符串）与
// `CardBattleView` 的 `v-for`/`v-if` 同元素（`id` 变成 `_ctx.id`，占位卡被当真卡渲染）。
//
// 为什么既有守卫全都漏掉了：
//   · `e2e-layout` 收集 `pageerror` + `console.error` —— 但这类缺陷**什么都不抛**；
//   · `e2e-interact` 会点这个按钮 —— 它只是**禁用**，点了也不炸；
//   · `e2e-text` 扫可见文本 —— 渲染成「（全部平铺）」/「8 个」是「合法文本」，扫不出来；
//   · 静态正则扫源码 —— 名字在模板里有、在脚本里没有，正则没法判断「绑定表」。
// ⇒ 唯一可靠判据是**问编译器**：`compileTemplate` 的输出里凡出现 `_ctx.X`，X 就必须在
//   `compileScript` 的 `bindings` 里（或属于 Vue 的全局白名单）。
//
// 本审计钉住五件事：
//   A. **覆盖面**（防假绿）：必须真的扫到全部 .vue（≥ 140 个文件、≥ 130 个含 `<script setup>`）；
//      扫 0 个文件而 PASS 是本项目最讨厌的「假绿守卫」。
//   B. **模板标识符必须已声明**（核心）：每个 `_ctx.X` 都在 bindings 或全局白名单里。
//   C. **`v-if` 不得和 `v-for` 写在同一元素上**：Vue 3 里 `v-if` 优先级更高、在循环作用域**之外**求值，
//      引用循环变量的 `v-if` 会变成 `_ctx.变量`（恒 undefined）。
//   D. **自检（内建反例）**：对合成的「好样本 / 坏样本 / v-if+v-for 样本」跑同一套判定，
//      好样本必须通过、坏样本必须被抓 ⇒ 守卫**每次在 CI 里都被反例验证一遍**，不会因为
//      `bindingMetadata` 传入方式写错而整体退化成恒真。
//   E. **注释不算**：模板里的 `<!-- 举例：_ctx.xxx -->` 必须先剥掉再编译 ——
//      本守卫第一版就是被自己写的注释骗出 `id, xxx` 两个假阳性（AGENTS「静态守卫要剥注释」）。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const fails = []
const ok = []
const check = (name, cond, detail = '') => (cond ? ok.push(name) : fails.push(`${name}${detail ? '  ← ' + detail : ''}`))

// `vue/compiler-sfc` 是 vue 自己的子路径导出（比 `@vue/compiler-sfc` 更稳：后者是传递依赖、
// 靠 npm 扁平化才在顶层）。两者都试，都拿不到就**FAIL**（不许静默跳过 —— 那会变成假绿守卫）。
let sfc = null
for (const spec of ['vue/compiler-sfc', '@vue/compiler-sfc']) {
  try { sfc = await import(spec); break } catch { /* 试下一个 */ }
}
if (!sfc) {
  console.log('══ 模板绑定审计 ══')
  console.log('FAIL  无法加载 vue/compiler-sfc（本审计的判据只能来自编译器，没有它就无法判定）')
  process.exit(1)
}
const { parse, compileScript, compileTemplate } = sfc

// Vue 模板里可直接使用的全局（与 compiler-core 的 GLOBALS_ALLOWED 同源，取其子集）
const GLOBALS = new Set([
  'Infinity', 'undefined', 'NaN', 'isFinite', 'isNaN', 'parseFloat', 'parseInt',
  'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'Math', 'Number',
  'Date', 'Array', 'Object', 'Boolean', 'String', 'RegExp', 'Map', 'Set', 'JSON', 'Intl',
  'BigInt', 'console', 'Error', 'Symbol', 'Promise',
  // 模板内建对象（`$event` 等由编译器生成，有些写法下会成为某个变量的 `_ctx.` 前缀来源）
  '$event', '$slots', '$attrs', '$props', '$emit', '$refs', '$el', '$forceUpdate', '$nextTick', '$options',
])

/** 剥掉模板里的 HTML 注释（注释里出现的 `_ctx.x` 不是代码，见 E） */
const stripHtmlComments = (t) => t.replace(/<!--[\s\S]*?-->/g, '')

/** 从编译产物里抽出所有 `_ctx.X` */
const ctxNames = (code) => [...new Set([...code.matchAll(/_ctx\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))]

/** 核心判定：给定一个 .vue 源码，返回 { unknown, dupAttr, bindings } */
function inspect(file, source) {
  const { descriptor } = parse(source, { filename: file })
  const tpl = descriptor.template
  if (!tpl || !descriptor.scriptSetup) return null
  let script
  try { script = compileScript(descriptor, { id: file }) } catch { return null }
  const tplSrc = stripHtmlComments(tpl.content)
  let code
  try {
    code = compileTemplate({
      source: tplSrc, filename: file, id: file,
      compilerOptions: { bindingMetadata: script.bindings },
    }).code
  } catch { return null }
  const bindings = new Set(Object.keys(script.bindings ?? {}))
  const unknown = ctxNames(code).filter((n) => !bindings.has(n) && !GLOBALS.has(n))
  // C：同一元素上同时出现 v-for 与 v-if（只认标签内的属性位，字符串属性值里出现不算）
  const dupAttr = []
  for (const m of tplSrc.matchAll(/<([a-zA-Z][\w.-]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g)) {
    const attrs = m[2] ?? ''
    if (/(^|\s)v-for\s*=/.test(attrs) && /(^|\s)v-if\s*=/.test(attrs)) dupAttr.push(`<${m[1]}>`)
  }
  return { unknown, dupAttr, bindings }
}

function walk(dir, out = []) {
  for (const e of readdirSync(join(root, dir))) {
    const rel = `${dir}/${e}`
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out)
    else if (e.endsWith('.vue')) out.push(rel)
  }
  return out
}

// ── D. 自检（内建反例）：先证明这套判定真的会 FAIL，再拿它去扫仓库 ──
{
  const good = `<script setup>\nconst n = 1\n</script>\n<template><div>{{ n }}</div></template>`
  const bad = `<script setup>\nconst n = 1\n</script>\n<template><div>{{ n }} {{ headTitle }}</div></template>`
  const loopBad = `<script setup>\nconst list = []\n</script>\n<template><div v-for="(x,i) in list" v-if="!x.pad">{{ x }}</div></template>`
  const commentOnly = `<script setup>\nconst n = 1\n</script>\n<template><!-- 举例：_ctx.zzz --><div>{{ n }}</div></template>`
  const g = inspect('good.vue', good)
  const b = inspect('bad.vue', bad)
  const l = inspect('loopBad.vue', loopBad)
  const c = inspect('commentOnly.vue', commentOnly)
  check('D. 自检：好样本无告警', g && g.unknown.length === 0 && g.dupAttr.length === 0, JSON.stringify(g?.unknown))
  check('D. 自检：未声明标识符被抓', !!b && b.unknown.includes('headTitle'), JSON.stringify(b?.unknown))
  check('D. 自检：v-for + v-if 同元素被抓', !!l && l.dupAttr.length === 1, JSON.stringify(l?.dupAttr))
  check('D. 自检：**注释里的 `_ctx.` 不算**（本守卫第一版的假阳性来源）',
    !!c && c.unknown.length === 0, JSON.stringify(c?.unknown))
}

// ── A/B/C. 扫全部 .vue ──
const files = [...walk('src/views'), ...walk('src/components'), 'src/App.vue']
let parsed = 0
const badFiles = []
for (const f of files) {
  let r = null
  try { r = inspect(f, readFileSync(join(root, f), 'utf8')) } catch { r = null }
  if (!r) continue
  parsed++
  if (r.unknown.length || r.dupAttr.length) badFiles.push({ f, ...r })
}
check('A. 覆盖面：扫描的 .vue 数 ≥ 140（防「扫 0 个文件而 PASS」的假绿）', files.length >= 140, `实际 ${files.length}`)
check('A. 覆盖面：成功解析含 <script setup> 的 .vue ≥ 130', parsed >= 130, `实际 ${parsed}`)
check('B. 模板标识符必须已声明（`_ctx.X` 全部能在 `<script setup>` 绑定或全局白名单里找到）',
  badFiles.every((x) => x.unknown.length === 0),
  badFiles.filter((x) => x.unknown.length).map((x) => `${x.f} → ${x.unknown.join(', ')}`).join(' | '))
check('C. 没有元素把 `v-if` 与 `v-for` 写在同一处（Vue 3 会先求 v-if ⇒ 循环变量恒 undefined）',
  badFiles.every((x) => x.dupAttr.length === 0),
  badFiles.filter((x) => x.dupAttr.length).map((x) => `${x.f} → ${x.dupAttr.join(', ')}`).join(' | '))

// ── 输出 ──
console.log('══ 模板绑定审计（编译器级：模板里用的名字必须真的存在）══')
console.log(`  扫描 ${files.length} 个 .vue（可解析 ${parsed}）`)
for (const n of ok) console.log('  ok  ' + n)
for (const n of fails) console.log('FAIL  ' + n)
console.log(`\n通过 ${ok.length} / 失败 ${fails.length}`)
process.exit(fails.length ? 1 : 0)
