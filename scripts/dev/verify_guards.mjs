// 反向验证（2026-10-02）：把我这几天加的守卫逐个**故意改坏**，确认它们真的会 FAIL 并点名。
// 项目纪律：注入失败（锚点没命中）**必须算失败** —— 否则「没注入」长得像「守卫有效」。
import fs from 'node:fs'
import { execSync } from 'node:child_process'

const run = (cmd) => {
  try { return { out: execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), code: 0 } }
  catch (e) { return { out: (e.stdout ?? '') + (e.stderr ?? ''), code: e.returnCode ?? 1 } }
}
const results = []
const withRevert = (file, mutate, cmd, expectName, tag) => {
  const orig = fs.readFileSync(file, 'utf8')
  const next = mutate(orig)
  if (next === orig) { results.push(`❌ ${tag}：注入无效（锚点没命中）—— 这本身就算失败`); return }
  fs.writeFileSync(file, next, 'utf8')
  let r
  try { r = run(cmd) } finally { fs.writeFileSync(file, orig, 'utf8') }
  const r2 = run(cmd) // 还原后必须恢复全绿
  const bit = r.code !== 0 && r.out.includes(expectName)
  const back = r2.code === 0
  results.push(`${bit && back ? '✅' : '❌'} ${tag}：注入后 ${r.code !== 0 ? 'FAIL' : '仍绿'}${bit ? ' 且点名「' + expectName + '」' : '（未点名）'} · 还原后 ${back ? '恢复全绿' : '仍红 ✗'}`)
}

// ① 竞技场分键守卫：把「写入走 arenaKey」改成直接写全局键（跨档污染的原始形态）
withRevert('src/views/ArenaView.vue',
  (s) => s.replace("localStorage.setItem(key, JSON.stringify(", "localStorage.setItem(ARENA_KEY_BASE, JSON.stringify("),
  'node scripts/ci/system_test.mjs',
  '状态必须按存档位分键', '竞技场分键守卫')

// ② scripts/ci 元守卫：把 chain_reaction_test 从 ci.yml 里摘掉（模拟「新脚本没写进清单」）
withRevert('.github/workflows/ci.yml',
  (s) => s.replace(/\n\s*node scripts\/ci\/chain_reaction_test\.mjs/, ''),
  'node scripts/ci/audit_sync.mjs',
  'CI 清单覆盖 scripts/ci', 'scripts/ci 元守卫')

// ③ e2e 套件元守卫：把 e2e-roles 从 ci.yml 里摘掉（模拟「新 spec 没写进清单」）
withRevert('.github/workflows/ci.yml',
  (s) => s.replace(/\n\s*npx playwright test e2e-roles\.spec\.mjs/, ''),
  'node scripts/ci/audit_sync.mjs',
  'CI 清单覆盖全部 e2e 套件', 'e2e 套件元守卫')

console.log('══ 反向验证（注入缺陷 → 守卫必须 FAIL 并点名 → 还原后恢复全绿）══')
for (const r of results) console.log('  ' + r)
const bad = results.filter((r) => r.startsWith('❌')).length
console.log(bad ? `\n${bad} 条没咬住 ✗` : '\n三条全部咬住 ✓')
process.exit(bad ? 1 : 0)
