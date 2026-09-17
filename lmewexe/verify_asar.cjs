// 打包产物自检（发布流程调用）：app.asar 内 dist/images 的文件数必须与源 dist 一致。
// 为什么不用 `asar list` CLI：它要经过 PowerShell/cmd 的参数编码，release 目录名是中文（「美食放置：食灵山海-win32-x64」），
// 实测 PowerShell 5.1 下中文参数会被按 ANSI 读成乱码 → asar 拿到错误路径（或只列出部分）。
// 本脚本用 fs + asar 头部解析，完全不经过 shell 参数编码。
// 用法：node verify_asar.cjs   （cwd = lmewexe）
const fs = require('fs')
const path = require('path')

function readAsarHeader(file) {
  const fd = fs.openSync(file, 'r')
  const head = Buffer.alloc(16)
  fs.readSync(fd, head, 0, 16, 0)
  const jsonSize = head.readUInt32LE(12)
  const hb = Buffer.alloc(jsonSize)
  fs.readSync(fd, hb, 0, jsonSize, 16)
  fs.closeSync(fd)
  return JSON.parse(hb.toString('utf8'))
}
function walk(node, prefix, out) {
  for (const [name, child] of Object.entries(node.files || {})) {
    const p = prefix + '/' + name
    if (child.files) walk(child, p, out)
    else out.push(p)
  }
  return out
}
function countFiles(dir) {
  let n = 0
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(path.join(dir, e.name))
    else n++
  }
  return n
}

const releaseDir = path.join(__dirname, 'release')
const candidates = []
for (const e of fs.readdirSync(releaseDir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue
  const p = path.join(releaseDir, e.name, 'resources', 'app.asar')
  if (fs.existsSync(p)) candidates.push(p)
}
if (!candidates.length) {
  console.error('FAIL 未找到 release/*/resources/app.asar —— 打包步骤没产出？')
  process.exit(1)
}
// release/ 下可能残留历史版本的目录（如改名前的「…食之契约…」）→ 取**最新**的那份
candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
const asar = candidates[0]
const distImages = path.join(__dirname, '..', 'dist', 'images')
const srcCount = countFiles(distImages)
const files = walk(readAsarHeader(asar), '', [])
const asarImages = files.filter((f) => f.startsWith('/dist/images/')).length
console.log(`asar: ${asar}`)
console.log(`dist/images = ${srcCount} ｜ asar 内 = ${asarImages}`)
if (asarImages !== srcCount) {
  console.error(`FAIL 打包漏图：asar 内 ${asarImages} 张，源 dist 有 ${srcCount} 张`)
  process.exit(1)
}
// 顺带钉住「几个曾经的易漏目录」非空（用户报过「很多图片不显示」，这些是最早暴露的地方）
for (const must of ['/dist/images/items/food/', '/dist/images/items/tool/', '/dist/images/items/pt/', '/dist/images/birds/']) {
  const n = files.filter((f) => f.startsWith(must)).length
  if (n === 0) {
    console.error(`FAIL asar 内 ${must} 为空`)
    process.exit(1)
  }
}
console.log('PASS 打包产物图片齐全')
