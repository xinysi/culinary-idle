// 未使用 import 审计（2026-09-28 立，CI 亦执行）
//
// 背景：2026-09-28 全量体检发现 `.vue` 里有大量**导入了却一次都没用**的符号（首轮实测 32 个），
// 其中几个还是「半成品 UI」的痕迹（`LogView` 的 `bindTip`、`ArenaView`/`TowerView` 的 `STYLE_INFO`）。
// 本项目**没有 eslint**（无 `.eslintrc`、package.json 里也没有 lint 脚本），所以这类噪声没有任何东西在管。
//
// 判据：对每个 `.vue` 的 `<script>` 块解析出 import 的**本地绑定名**，再在整个文件（**剥掉 JS 注释与 HTML 注释**）里
// 数它的出现次数 —— 只出现 1 次（就是 import 那一处）即「未使用」。
//   · 模板也在同一个文件里 ⇒ 组件在模板里用（`<HeatView />`）会被正确算作「用过」，不必另做绑定分析。
//   · 🔴 **必须剥注释**：本项目多次被「注释里提了一句」骗过（`bgm_audit` 恒 FAIL、`.vue` 的 HTML 注释顶掉断言）。
//     剥掉之后，一个只被注释提到的 import 会被判「未使用」—— 这正是想要的结论。
//   · 只扫 `.vue`：`.js` 侧没有模板，且数据模块里的 import 常被当作「再导出/预留」用途，误报率高。
//
// 已知边界（如实记）：名字出现在**字符串字面量**里会被算作「用过」（字符串内容不在剥注释范围内）⇒
// 只会漏报（少删一个），不会误删。**失败方向是安全的**。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { stripComments, stripHtmlComments } from './lib/comments.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const fails = []
const ok = []
const check = (name, cond, detail = '') => (cond ? ok.push(name) : fails.push(`${name}${detail ? '  ← ' + detail : ''}`))

function walk(dir, out = []) {
  for (const e of readdirSync(join(root, dir))) {
    const rel = `${dir}/${e}`
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out)
    else if (e.endsWith('.vue')) out.push(rel)
  }
  return out
}

/** 从 import 语句里取出**本地绑定名** */
function bindingsOf(stmt) {
  const out = []
  const brace = stmt.match(/\{([\s\S]*?)\}/)
  if (brace) {
    for (const part of brace[1].split(',')) {
      const t = part.trim()
      if (!t) continue
      const m = t.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/)
      if (m) out.push(m[2] ?? m[1])
    }
  }
  // 默认导入 / 命名空间导入：`import X from` / `import * as X from` —— 只取 `{` 之前的部分
  const head = stmt.slice(0, brace ? stmt.indexOf('{') : stmt.length)
    .replace(/^import\s+/, '')
    .replace(/\s*from\s*['"][^'"]*['"]\s*;?$/, '')
  const ns = head.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/)
  if (ns) out.push(ns[1])
  else {
    const def = head.match(/^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/)
    if (def) out.push(def[1])
  }
  return out
}

let scanned = 0
const unused = []
/** 供 `scripts/dev/strip_unused_imports.mjs` 复用（**判据只有这一份**，避免「检测」与「删除」两套逻辑漂移） */
export function findUnused() {
  scanned = 0
  unused.length = 0
  for (const f of walk('src')) {
    const raw = readFileSync(join(root, f), 'utf8')
    const scripts = [...raw.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')
    // 计数用「整个文件剥注释」的版本（模板里的使用也算数）
    const counted = stripComments(stripHtmlComments(raw))
    for (const m of scripts.matchAll(/import\s+([\s\S]*?)\s+from\s*['"][^'"]+['"]/g)) {
      for (const name of bindingsOf(m[0])) {
        scanned++
        const hits = counted.match(new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`, 'g'))?.length ?? 0
        if (hits <= 1) unused.push({ file: f, name })
      }
    }
  }
  return { unused, scanned, files: walk('src').length }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) findUnused()

if (isMain) check('A. 没有「导入了却一次没用」的符号（判据：整个文件里出现次数 ≤1）', unused.length === 0,
  unused.length ? `${unused.length} 个：${unused.map((u) => `${u.file} 的 ${u.name}`).join('；')}` : '')
if (isMain) check('B. 扫描器自证：解析到的 import 绑定名 ≥ 400 个（过少说明 script 块/正则没生效，A 会假绿）',
  scanned >= 400, `实际 ${scanned} 个`)

if (isMain) {
  console.log('══ 未使用 import 审计 ══')
  for (const n of ok) console.log('  ok  ' + n)
  for (const n of fails) console.log('FAIL  ' + n)
  console.log(`\n扫描 .vue ${walk('src').length} 个 / import 绑定名 ${scanned} 个`)
  console.log(`通过 ${ok.length} / 失败 ${fails.length}`)
  process.exit(fails.length ? 1 : 0)
}