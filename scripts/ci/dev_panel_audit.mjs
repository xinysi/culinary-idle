// 开发者面板审计（2026-09-18 立）——**排在 `npm run build` 之后跑**（要读 dist）
//
// 这个面板唯一真正的保护是「**构建期隔离**」：生产构建里 `import.meta.env.DEV === false`
// ⇒ `DEV_PANEL_ENABLED` 是静态 false ⇒ App.vue 里那句 `defineAsyncComponent(() => import('DevEntry.vue'))`
// 会被打包器整块丢弃。**代码不在产物里，玩家就不可能翻出来**（比任何前端口令都可靠）。
//
// 所以本守卫做的是「**双向**」断言：
//   ① 源码里确实有这个面板（否则下面的「产物里没有」是废话 —— 空断言等于不设防）；
//   ② 产物里确实**没有**它（这才是有价值的那一半）。
// 反向验证：`VITE_DEV_PANEL=1 npm run build` 后跑 `node scripts/ci/dev_panel_audit.mjs` 会 FAIL。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DIST = process.env.DIST_DIR ? path.resolve(ROOT, process.env.DIST_DIR) : path.join(ROOT, 'dist')

let pass = 0
let fail = 0
const check = (label, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok  ${label}`) } else { fail++; console.log(`FAIL  ${label}${detail ? '  — ' + detail : ''}`) }
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

/* ── 只在源码里出现、不该进产物的「标记串」（取自面板各文件的面向上方文案/常量） ── */
const MARKERS = ['一键满配', '开发者面板', 'culinary-idle-dev-2026']

console.log('── A. 源码侧：面板确实存在（防「空断言」）──')
const devFiles = [
  'src/game/dev/devFlag.js',
  'src/game/dev/devAuth.js',
  'src/game/dev/devTools.js',
  'src/game/dev/devProbe.js',
  'src/game/dev/saveInspector.js',
  'src/game/dev/telemetry.js',
  'src/game/dev/hash.js',
  'src/components/DevPanel.vue',
  'src/components/TunerPanel.vue',
  'src/components/DevEntry.vue',
]
check('A1. 开发者模块齐备（10 个文件）', devFiles.every((f) => fs.existsSync(path.join(ROOT, f))), devFiles.filter((f) => !fs.existsSync(path.join(ROOT, f))).join(','))
const allSrc = devFiles.map((f) => read(f)).join('\n') + read('src/App.vue') + read('src/components/SplashScreen.vue')
for (const m of MARKERS) {
  check(`A2. 源码里含标记「${m}」`, allSrc.includes(m))
}

console.log('\n── B. 构建期隔离：开关必须是 Vite 能静态替换的精确写法 ──')
const flagSrc = stripCommentsSafe(read('src/game/dev/devFlag.js'))
check('B1. 开关（devFlag.js）用精确的 `import.meta.env.DEV`（可选链会让替换静默失效）',
  /import\.meta\.env\.DEV\b/.test(flagSrc) && !/import\.meta\.env\?\./.test(flagSrc),
  '写成 import.meta.env?.DEV 时 Vite 不会替换 → 开关恒 falsy（2026-09-18 踩过）')
const appSrc = stripCommentsSafe(read('src/App.vue'))
check('B2. App.vue 用 DEV_PANEL_ENABLED 三元门控 DevEntry 的动态 import（否则面板代码会一直打进产物）',
  /DEV_PANEL_ENABLED\s*\?\s*defineAsyncComponent\(\(\)\s*=>\s*import\(/.test(appSrc.replace(/\s+/g, ' ')) ||
  /DEV_PANEL_ENABLED \? defineAsyncComponent\(\(\) => import\(/.test(appSrc.replace(/\s+/g, ' ')))
check('B3. 入口与页面挂在**根级**（整页接管：覆盖在游戏/启动页之上，不嵌进游戏壳）',
  /<\/div>\s*\n\s*<!-- 内部入口与两个页面[\s\S]{0,400}?<DevEntry v-if="DevEntry" \/>/.test(read('src/App.vue')))
check('B6. App.vue 不得引用 DevPanel（页面代码只能经 DevEntry 进入，随 DevEntry 一起被构建剥离）',
  !/DevPanel/.test(read('src/App.vue')), 'App.vue 出现 DevPanel 引用会让面板代码进主包/产物')
check('B7. DevEntry 根级挂载页面本体（ui.showDevPanel 整页接管）',
  /<DevPanel v-if="ui\.showDevPanel" \/>/.test(read('src/components/DevEntry.vue')))
check('B8. TunerPanel 只被 DevEntry 引用（运营调参页与面板同批剥离，App.vue 不得出现）',
  /<TunerPanel v-if="ui\.showTunerPanel" \/>/.test(read('src/components/DevEntry.vue')) && !/TunerPanel/.test(read('src/App.vue')))
check('B4. 启动页入口用连点标题（不放可见按钮）',
  /@click="tapTitle\(\)"/.test(read('src/components/SplashScreen.vue')) && !/dev-entry-btn/.test(allSrc))
check('B5. 已登录不重复问口令（统一走 requestDevEntry）',
  /export function requestDevEntry/.test(flagSrc) &&
  /requestDevEntry\(ui\)/.test(appSrc) && /requestDevEntry\(ui\)/.test(stripCommentsSafe(read('src/components/SplashScreen.vue'))))

console.log('\n── C. 冻结数据：面板只改存档，不改 src/game/data/* ──')
// 「固定数据铁律」的那几层：面板只能读它们来填列表，**不能写**
const DATA_WRITE = /^\s*(ITEMS|SEASONS|COMBAT_REGIONS|COMBAT_BOSSES|AOJIS|SPIRITS|SPIRIT_TIERS|EXPLORATION_TARGETS_ALL|SHANHAI_NODES|DAO_NODES|INSIGHT_NODES|ALL_ACHIEVEMENTS)\s*(\[[^\]]*\]\s*=|\.\s*(push|splice|sort|pop|shift|unshift)\()/m
for (const f of ['src/game/dev/devTools.js', 'src/game/dev/devProbe.js', 'src/game/dev/saveInspector.js', 'src/game/dev/telemetry.js', 'src/components/DevPanel.vue', 'src/components/TunerPanel.vue']) {
  const s = stripCommentsSafe(read(f))
  check(`C1. ${path.basename(f)} 不写冻结数据（无「对数据数组赋值/push」）`, !DATA_WRITE.test(s))
}

console.log('\n── D. 产物侧：面板不进生产构建（本守卫的核心）──')
if (!fs.existsSync(DIST)) {
  check('D0. dist 存在（本审计必须排在 build 之后）', false, `${DIST} 不存在`)
} else {
  const jsFiles = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => f.endsWith('.js'))
  const bundled = jsFiles.map((f) => fs.readFileSync(path.join(DIST, 'assets', f), 'utf8'))
  const joined = bundled.join('\n')
  for (const m of MARKERS) {
    check(`D1. 产物里不含标记「${m}」`, !joined.includes(m))
  }
  check('D2. 产物里没有 DevEntry/DevPanel 的 chunk', !jsFiles.some((f) => /DevEntry|DevPanel/.test(f)), jsFiles.filter((f) => /Dev/.test(f)).join(','))
}

/* 剥注释：本项目约定用 scripts/ci/lib/comments.mjs（三态扫描，不会被行注释里的 /* 骗到） */
function stripCommentsSafe(text) {
  // 这里为了保持零依赖，做一个保守版：只剥行注释与「行首块注释」，足够本审计用
  return text
    .split('\n')
    .map((ln) => ln.replace(/^\s*\/\/.*$/, '').replace(/^\s*\*.*$/, ''))
    .join('\n')
}

console.log(fail ? `\n开发者面板审计：FAIL（${fail} 项 / 共 ${pass + fail}）` : `\n开发者面板审计：PASS（${pass} 项）`)
process.exit(fail ? 1 : 0)
