// 反例验证：游客 / 试玩角色（C55）——逐个注入真缺陷 → 跑 system_test → 断言 FAIL 且点名 → 还原。
// 用法：node scripts/dev/verify_c55.mjs      （每次注入跑一遍 system_test；共 6 例）
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const P = (rel) => join(root, rel)

/** 精确替换（必须恰好 1 处），返回注入了缺陷的源码 */
function inject(rel, from, to) {
  const orig = readFileSync(P(rel), 'utf8')
  const n = orig.split(from).length - 1
  if (n !== 1) throw new Error(`${rel} 锚点匹配 ${n} 次（期望 1）：${from.slice(0, 60)}`)
  writeFileSync(P(rel), orig.replace(from, to), 'utf8')
}

const CASES = [
  {
    name: '① 唯一出口漏闸门（saveSlot 又会写档 ⇒ 游客能覆盖别人的存档）',
    rel: 'src/game/core/SaveManager.js',
    from: 'if (!this._writable()) return false // 游客会话：静默不写',
    to: 'if (false) return false // 游客会话：静默不写',
    expect: '写入口全不生效',
  },
  {
    name: '② 清档漏闸门（游客能删掉别人的存档位）',
    rel: 'src/game/core/SaveManager.js',
    from: 'if (!this._writable()) return false // 游客会话：不许删档',
    to: 'if (false) return false // 游客会话：不许删档',
    expect: 'clear() 也不会删掉既有档',
  },
  {
    name: '③ 启动流程把只读写死成 false（游客形同虚设）',
    rel: 'src/game/bootstrap.js',
    from: 'saveManager.readOnly = guest',
    to: 'saveManager.readOnly = false',
    expect: '两态都置位',
  },
  {
    name: '④ 全局偏好键漏判游客（进游戏就会写 culinary-idle.skin —— 实测抓过的那条）',
    rel: 'src/App.vue',
    from: "if (player.settings?.skin && !ui.guest)",
    to: "if (player.settings?.skin)",
    expect: '全局偏好键都不再写',
  },
  {
    name: '⑤ 埋点漏判游客（开发构建下游客照写本机数据）',
    rel: 'src/game/dev/telemetry.js',
    from: '  if (isGuest()) return\n',
    to: '',
    expect: '埋点',
  },
  {
    name: '⑥ 存档面板漏禁用（按钮可点、点了没反应 = 静默失效）',
    rel: 'src/components/SavePanel.vue',
    from: 'class="btn btn-sm btn-danger" :disabled="ui.guest"',
    to: 'class="btn btn-sm btn-danger"',
    expect: '写按钮都 disabled',
  },
]

const run = () => {
  try {
    return { code: 0, out: execFileSync(process.execPath, ['scripts/ci/system_test.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }) }
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

const backups = new Map()
let okAll = true
for (const c of CASES) {
  if (!backups.has(c.rel)) backups.set(c.rel, readFileSync(P(c.rel), 'utf8'))
  try { inject(c.rel, c.from, c.to) } catch (e) { console.log(`⚠ ${c.name} —— 注入失败：${e.message}`); okAll = false; continue }
  const r = run()
  const hit = r.code !== 0 && r.out.includes('FAIL') && r.out.includes(c.expect)
  console.log(`${hit ? '✅' : '❌'} ${c.name} → ${r.code === 0 ? 'system_test 仍全绿（假绿！）' : 'FAIL'}，点名含「${c.expect}」= ${r.out.includes(c.expect)}`)
  if (!hit) {
    okAll = false
    console.log(r.out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 4).join('\n'))
  }
  writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
}
for (const [rel, content] of backups) writeFileSync(P(rel), content, 'utf8')

const back = run()
const clean = back.code === 0 && /失败 0/.test(back.out)
console.log(`${clean ? '✅' : '❌'} 还原后 system_test 全绿（${(back.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}）`)
console.log(okAll && clean ? `\n反例验证通过：${CASES.length} 个注入缺陷全部被点名，还原后恢复全绿` : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)
