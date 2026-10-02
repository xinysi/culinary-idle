// 图片/静态资源路径审计（CI 守卫）— 2026-09-17 立
// 背景：用户报「打包的 exe 打开后很多图片都不显示」。根因是**根绝对路径** `/images/…`：
//   dev（vite server 在站点根）与 GitHub Pages（站点在 /culinary-idle/，`/images/…` 错但当时
//   有别的写法掩盖）下看不出问题，而 Electron 打包后页面是
//   `file:///…/resources/app.asar/dist/index.html`，`/images/…` 会解析到**磁盘根**（`file:///D:/images/…`）
//   → 素材全部 404。实测：同一批 URL「相对写法 OK、绝对写法 FAIL」。
// 本审计两条断言：
//   A. `src/**` 与 `index.html` 里**不得出现根绝对的资源 URL**（`/images/…`、`/assets/…`、`/favicon…`）；
//      统一走 `assetUrl()`（`src/game/data/itemImage.js` 导出，唯一出口）或直接写相对路径。
//      模板里的静态 `src="/images/x.png"` 还会被 Vite 当 import 而构建失败 → 必须写
//      `:src="assetUrl('/images/x.png')"`。
//   B. 所有**静态可解析**的资源引用（相对路径字面量 + 目录前缀展开）必须在 `public/` 下真实存在，
//      防止改名/拼错导致运行期静默 404（`@error` 会把图直接隐藏，页面不报错）。
// 运行：node scripts/ci/image_path_audit.mjs
import fs from 'node:fs'
import path from 'node:path'
import { stripComments } from './lib/comments.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
let fail = 0
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok  ${name}`)
  else {
    fail++
    console.log(`FAIL  ${name} ${detail}`)
  }
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      walk(p, out)
    } else if (/\.(vue|js|mjs|css|html)$/.test(e.name)) out.push(p)
  }
  return out
}
const files = [...walk(path.join(ROOT, 'src')), path.join(ROOT, 'index.html')]

/** 剥注释（共用实现，见 ./lib/comments.mjs：认字符串/行注释，不会把 `bgm/*.mp3` 这类当块注释开头）+ HTML 注释 */
function stripForScan(t, isHtml) {
  let s = stripComments(t)
  if (isHtml) s = s.replace(/<!--[\s\S]*?-->/g, '')
  return s
}

/* ── A. 不得出现根绝对资源 URL ── */
const ABS = /['"`](\/(?:images|assets|favicon)[^'"`\n]*)['"`]/g
const absHits = []
for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8')
  const s = stripForScan(raw, f.endsWith('.html'))
  const lines = s.split('\n')
  lines.forEach((l, i) => {
    // 允许出现在 http(s):// 之类绝对 URL 中（本仓库没有，保留以防误报）
    for (const m of l.matchAll(ABS)) {
      if (/https?:\/\//.test(l)) continue
      // 唯一合法形态：包在 assetUrl(...) 里（由它转成文档相对路径）
      if (/assetUrl\(\s*$/.test(l.slice(0, m.index))) continue
      absHits.push(`${path.relative(ROOT, f)}:${i + 1}  ${m[1]}`)
    }
  })
}
check(
  'A. 没有根绝对资源 URL（/images、/assets、/favicon）',
  absHits.length === 0,
  absHits.length ? `\n      ${absHits.slice(0, 12).join('\n      ')}` : ''
)

/* ── A2. assetUrl 单一出口存在且被导出 ── */
const itemImageSrc = fs.readFileSync(path.join(ROOT, 'src/game/data/itemImage.js'), 'utf8')
check('A2. assetUrl() 唯一出口存在（src/game/data/itemImage.js）', /export function assetUrl\(/.test(itemImageSrc))
check(
  'A2. itemImage() 走 assetUrl（不再直接拼路径）',
  /return assetUrl\(`images\/items\//.test(itemImageSrc)
)

/* ── B. 静态引用的资源文件必须存在 ── */
// ⚠️ 2026-10-02：**休眠的样式表不参与「静态引用」检查**。
//    起因：用户删了 public/images/ui-food-pixel/（212 张像素皮肤边框图），因为它只被
//    src/styles/pixel-skin.css 引用，而那个文件**任何地方都没 import**（它头注释自己写着
//    「启用：在 main.css 末尾加一行 @import './pixel-skin.css';」）⇒ 游戏运行时不加载它，
//    那批图确实用不到。旧判据把「休眠样式表里的引用」也算成缺图 ⇒ 会逼着仓库留一堆没人用的素材。
//    判据是**派生**的（不写死文件名）：一个 .css 算「活」当且仅当它的文件名出现在某个非-css 源文件里；
//    main.css 是入口 ⇒ 恒活。
const LIVE_CSS = (() => {
  const cssNames = files.filter((f) => f.endsWith('.css')).map((f) => f.split(/[\\/]/).pop())
  const live = new Set(['main.css'])
  for (const f of files) {
    if (f.endsWith('.css')) continue
    let txt = ''
    try { txt = fs.readFileSync(f, 'utf8') } catch { continue }
    for (const nm of cssNames) if (txt.includes(nm)) live.add(nm)
  }
  return live
})()
const isDeadCss = (f) => f.endsWith('.css') && !LIVE_CSS.has(f.split(/[\\/]/).pop())

const refs = new Set()
const prefixes = new Set()
for (const f of files) {
  if (isDeadCss(f)) continue   // 休眠样式表：跳过（见上）
  const s = stripForScan(fs.readFileSync(f, 'utf8'), f.endsWith('.html'))
  for (const m of s.matchAll(/['"`](\/?images\/[^'"`\n]*?\.(?:png|jpe?g|gif|webp|svg))['"`]/gi)) refs.add(m[1])
  for (const m of s.matchAll(/['"`](\/?images\/[^'"`\n]*?\/)['"`]/gi)) prefixes.add(m[1])
  for (const m of s.matchAll(/url\((['"]?)(\/?[^'")]+\.(?:png|jpe?g|gif|webp|svg))\1\)/gi)) refs.add(m[2])
}
for (const pre of prefixes) {
  if (pre.includes('${')) continue
  const dir = path.join(ROOT, 'public', pre.replace(/^\//, ''))
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir)) if (/\.(png|jpe?g|gif|webp|svg)$/i.test(f)) refs.add(pre + f)
}
const missing = []
const dynamic = []
/** 把一条引用解析成磁盘路径：支持 `images/x.png`、`/images/x.png`、`../../public/images/x.png` */
function resolveAsset(r) {
  let p = r.replace(/^\/+/, '')
  while (p.startsWith('../')) p = p.slice(3)
  if (p.startsWith('public/')) return path.join(ROOT, p)
  return path.join(ROOT, 'public', p)
}
for (const r of refs) {
  if (r.includes('${')) {
    dynamic.push(r)
    continue
  }
  if (!fs.existsSync(resolveAsset(r))) missing.push(r)
}
  // ⚠️ 2026-10-02：**只检查「被 import 的」样式表**里的静态引用。
  //    起因：用户删了 `public/images/ui-food-pixel/`（212 张像素皮肤边框图），因为它只被
  //    `src/styles/pixel-skin.css` 引用，而那个文件**任何地方都没 import**（它自己头注释写着
  //    "启用：在 main.css 末尾加一行 @import"）⇒ 游戏运行时根本不加载它 ⇒ 这批图确实用不到。
  //    旧判据会把「休眠样式表里的引用」也算成"缺图"，从而**逼着仓库留一堆没人用的素材**。

check('B. 静态引用的图片文件都存在（public/ 下）', missing.length === 0, missing.length ? `\n      缺: ${missing.slice(0, 12).join(', ')}` : '')
console.log(`  （静态引用 ${refs.size - dynamic.length} 条；模板插值 ${dynamic.length} 条由运行期拼接，另由 exe 图片审计覆盖：${dynamic.slice(0, 3).join(' ')}${dynamic.length > 3 ? ' …' : ''}）`)

console.log(fail ? `\n图片路径审计：FAIL（${fail} 项）` : '\n图片路径审计：PASS')
process.exit(fail ? 1 : 0)
