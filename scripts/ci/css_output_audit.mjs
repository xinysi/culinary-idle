// CSS 产物审计（CI 守卫，在 `npm run build` 之后跑）— 2026-09-17 立
// 背景：用户报「GitHub 在线版和 exe 的样式跟本地完全不一样，比如窗口透明度」。
// 根因：Vite 8 的 CSS 压缩器（lightningcss）遇到**同时写了标准与前缀**的规则会去重，
//       留下 `-webkit-` 版、删掉标准版；而新版 Chromium 不认 `-webkit-backdrop-filter`
//       ⇒ 构建产物里 `.card`/顶栏/侧栏/弹窗的毛玻璃全部失效（dev 正常，只有线上与 exe 现形）。
// 本审计把「源码里写了的**标准属性**必须原样出现在构建产物里」钉死：
//   对一组「前缀敏感」的标准属性，逐个比较「源码 main.css 的出现次数」与「产物 index CSS 的次数」，
//   产物少于源码即 FAIL（被压缩器删掉了）。已反例验证：把关掉 cssMinify 的配置改回去 → 立刻 FAIL。
// 运行：node scripts/ci/css_output_audit.mjs
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
let fail = 0
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok  ${name}`)
  else {
    fail++
    console.log(`FAIL  ${name} ${detail}`)
  }
}

const distAssets = path.join(ROOT, 'dist/assets')
if (!fs.existsSync(distAssets)) {
  console.log('FAIL  未找到 dist/assets —— 本审计必须在 `npm run build` 之后运行')
  process.exit(1)
}
const indexCss = fs
  .readdirSync(distAssets)
  .filter((f) => f.startsWith('index-') && f.endsWith('.css'))
  .map((f) => fs.readFileSync(path.join(distAssets, f), 'utf8'))
  .join('\n')
const srcCss = fs.readFileSync(path.join(ROOT, 'src/styles/main.css'), 'utf8')

/** 数「标准属性」的出现次数（排除 `-webkit-` / `-moz-` 等前缀形式） */
const countStd = (text, prop) => {
  const re = new RegExp(`(^|[^-a-zA-Z])${prop}\\s*:`, 'g')
  return (text.match(re) || []).length
}
const countPrefixed = (text, prop) => {
  const re = new RegExp(`-webkit-${prop}\\s*:`, 'g')
  return (text.match(re) || []).length
}

// 这些属性的「标准写法」一旦被删，Chromium 会直接不生效（前缀版在新版 Chromium 里是无效声明）
const PROPS = ['backdrop-filter', 'mask', 'mask-image', 'appearance', 'user-select', 'line-clamp', 'text-size-adjust']
const shrunk = []
for (const p of PROPS) {
  const s = countStd(srcCss, p)
  if (s === 0) continue
  const d = countStd(indexCss, p)
  if (d < s) shrunk.push(`${p}: 源码 ${s} 处 → 产物 ${d} 处`)
}
check(
  'A. 源码里的标准 CSS 属性没有被压缩器删掉（main.css → dist index CSS）',
  shrunk.length === 0,
  shrunk.length ? `\n      ${shrunk.join('\n      ')}` : ''
)
// 具体钉住用户报的那一类：毛玻璃
check(
  'B. 产物里保留了标准的 backdrop-filter（毛玻璃）',
  countStd(indexCss, 'backdrop-filter') > 0,
  `产物中标准写法 0 处（只剩 -webkit- ${countPrefixed(indexCss, 'backdrop-filter')} 处 ⇒ Chromium 里全部失效）`
)
// 只留前缀 = Chromium 无效，额外的定向断言
const onlyPrefixed = countStd(indexCss, 'backdrop-filter') === 0 && countPrefixed(indexCss, 'backdrop-filter') > 0
check('B2. 没有「只剩 -webkit- 前缀版」的回退', !onlyPrefixed)
// 构建配置必须保持「不改写 CSS」
const viteCfg = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8')
check('C. vite.config 保持 cssMinify: false（别让压缩器改写作者写的 CSS）', /cssMinify:\s*false/.test(viteCfg))

console.log(fail ? `\nCSS 产物审计：FAIL（${fail} 项）` : '\nCSS 产物审计：PASS')
process.exit(fail ? 1 : 0)
