// 验证 dev server 上所有 src 模块都能编译（HTTP 200 且无 Vite 编译错误）
// 注意：需要 dev server 在 5173 运行；root 取脚本上级目录（支持 CI/Windows 任意路径）
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function walk(d) {
  let out = []
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    if (fs.statSync(p).isDirectory()) out = out.concat(walk(p))
    else if (/\.(js|vue)$/.test(f)) out.push(p)
  }
  return out
}

const files = walk(path.join(root, 'src'))

;(async () => {
  const results = await Promise.all(
    files.map(async (f) => {
      const url = 'http://localhost:5173/' + f.replace(/\\/g, '/').slice(root.length + 1)
      const r = await fetch(url)
      const t = await r.text()
      const fail = r.status !== 200 || /Internal Server Error|Transform failed|Pre-transform error/.test(t)
      return { f: f.slice(root.length + 1), s: r.status, err: fail ? t.slice(0, 400) : '' }
    })
  )
  let bad = 0
  for (const { f, s, err } of results) {
    if (err) {
      bad++
      console.log('FAIL', s, f, '=>', err.replace(/\n/g, ' '))
    }
  }

  // 静态渲染风险检查：script setup 内裸引用 prop 名（如 `instance.` 而非 `props.instance.`）
  // 模板中 prop 名可用，但 script 作用域不存在 → 渲染时 ReferenceError → 页面空白
  const fsx = require('fs')
  const vueFiles = files.filter((f) => f.endsWith('.vue'))
  const bareRef = /\binstance\./
  let renderRisk = 0
  for (const f of vueFiles) {
    const src = fsx.readFileSync(f, 'utf-8')
    const m = src.match(/<script setup>([\s\S]*?)<\/script>/)
    if (!m) continue
    const body = m[1]
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
    const lineNo = body.split('\n').findIndex((l) => bareRef.test(l) && !/props\.instance/.test(l))
    if (lineNo >= 0) {
      renderRisk++
      console.log('RENDER-RISK', f.slice(root.length + 1), 'line', lineNo + 1, '=>', body.split('\n')[lineNo].trim())
    }
  }
  if (renderRisk > 0) bad += renderRisk

  console.log(
    bad === 0
      ? `OK: ${results.length} modules compile, no render risks`
      : `${bad} failures / ${results.length}`
  )
})()
