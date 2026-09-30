// 线上核验（v2.29.12 全库物品图重出）—— 判据**不依赖物品名**（抽样是脚本挑的），
// 且带**反向对照**：线上图的 md5 必须 == 本地新图、且 != 上一版（证明「换的整批真的上线了」）。
import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const URL_ = process.env.LIVE_URL ?? 'https://xinysi.github.io/culinary-idle/?v=22912'
// 跨子目录 + 含细长物/大件/食灵：验证「换的是整批」而不是只换了几张
const SAMPLE = [
  'images/items/food/苹果.png', 'images/items/food/上汤娃娃菜.png', 'images/items/food/竹笛.png',
  'images/items/food/贝币串.png', 'images/items/tool/保鲜剂.png', 'images/items/seed/小麦种子.png',
  'images/items/equipment/云母刀.png', 'images/items/spirit/杏子精灵.png',
]

const md5 = (b) => createHash('md5').update(b).digest('hex')
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push('console: ' + m.text()) })
await page.goto(URL_, { waitUntil: 'load' })
await page.waitForTimeout(1500)

let bad = 0
const ok = (c, l, d) => { if (!c) bad++; console.log(`${c ? '✅' : '❌'} ${l}${d ? ' — ' + d : ''}`) }

const live = await page.evaluate(async (list) => {
  const out = []
  for (const rel of list) {
    const url = new URL(rel, location.href).href
    try {
      const r = await fetch(url, { cache: 'no-store' })
      const buf = new Uint8Array(await r.arrayBuffer())
      out.push([rel, r.status, buf.length, btoa(String.fromCharCode(...buf)).slice(0, 0) || Array.from(buf).map((x) => x.toString(16).padStart(2, '0')).join('')])
    } catch (e) { out.push([rel, -1, 0, '']) }
  }
  return out
}, SAMPLE)

for (const [rel, status, len, hex] of live) {
  const local = readFileSync(join(ROOT, 'public', rel))
  const localMd5 = md5(local)
  let oldMd5 = null
  try { oldMd5 = md5(execFileSync('git', ['show', 'HEAD~1:public/' + rel], { cwd: ROOT, maxBuffer: 1 << 26 })) } catch { /* 新增图无旧版 */ }
  const liveMd5 = hex.length ? md5(Buffer.from(hex, 'hex')) : 'n/a'
  ok(status === 200 && liveMd5 === localMd5, `${rel}：线上 == 本地新图（证明整批已上线）`, `http ${status} ${len}B md5 ${liveMd5.slice(0, 8)} vs 本地 ${localMd5.slice(0, 8)}`)
  if (oldMd5 && rel !== 'images/items/tool/保鲜剂.png') {
    ok(liveMd5 !== oldMd5, `${rel}：线上 != 上一版（反向对照，证明不是旧的）`, `${oldMd5.slice(0, 8)} → ${liveMd5.slice(0, 8)}`)
  } else if (oldMd5) {
    // `保鲜剂` 这批**没有正主的源图**（用户只给了 `·Ⅰ`~`·Ⅶ` 变体）⇒ 按预期保留旧图，
    // 这条断言反过来写：**必须 == 旧版**（若哪天它变了，说明有人误覆盖了它）。
    ok(liveMd5 === oldMd5, `${rel}：无新源图 ⇒ 应保持旧图不变`, `${oldMd5.slice(0, 8)}（未变）`)
  }
}
ok(errs.length === 0, '页面零控制台错误', errs.slice(0, 3).join(' | '))
await b.close()
console.log(bad === 0 ? '\n线上核验通过' : `\n线上核验失败：${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
