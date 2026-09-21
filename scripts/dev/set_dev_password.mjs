// 设置开发者面板口令（自动算哈希并改写 src/game/dev/devAuth.js）
//
//   node scripts/dev/set_dev_password.mjs <新口令>
//   node scripts/dev/set_dev_password.mjs --show     # 只看当前配置与默认口令校验
//
// 为什么需要它：`devAuth.js` 里存的是 `sha256(salt:口令)`，手算容易出错。
// 这里复用**和应用完全同一份** `hash.js`，保证算出来的值一定对得上。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256Hex } from '../../src/game/dev/hash.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const FILE = path.join(ROOT, 'src/game/dev/devAuth.js')
const pw = process.argv[2]
const src = fs.readFileSync(FILE, 'utf8')
const saltMatch = src.match(/export const DEV_SALT = '([^']*)'/)
const hashMatch = src.match(/export const DEV_PASS_HASH = '([^']*)'/)
if (!saltMatch || !hashMatch) {
  console.error('🔴 没能在 devAuth.js 里找到 DEV_SALT / DEV_PASS_HASH')
  process.exit(1)
}
const salt = saltMatch[1]

if (!pw || pw === '--show') {
  const known = sha256Hex(`${salt}:dev123456`)
  console.log(`盐           : ${salt}`)
  console.log(`当前哈希     : ${hashMatch[1]}`)
  console.log(`当前口令是默认口令 dev123456 吗: ${known === hashMatch[1] ? '是（建议尽快改掉）' : '否'}`)
  console.log('\n用法: node scripts/dev/set_dev_password.mjs <新口令>')
  process.exit(0)
}
if (pw.length < 6) {
  console.error('🔴 口令至少 6 位（这只是挡板，但太短连挡都挡不住）')
  process.exit(1)
}
const next = sha256Hex(`${salt}:${pw}`)
const out = src.replace(/export const DEV_PASS_HASH = '[^']*'/, `export const DEV_PASS_HASH = '${next}'`)
fs.writeFileSync(FILE, out, 'utf8')
// 自检：改完必须能通过校验（防止写入被静默截断）
const check = fs.readFileSync(FILE, 'utf8').match(/export const DEV_PASS_HASH = '([^']*)'/)[1]
console.log(check === next ? `✅ 口令已更新（哈希 ${next.slice(0, 12)}…）` : '🔴 写入后校验不一致，请检查文件')
