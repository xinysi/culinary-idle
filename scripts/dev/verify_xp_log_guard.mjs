// 反例验证 xp_log_audit 四个断言都真的咬得住（改坏 → 必须 FAIL → 还原）。
// 用法：node scripts/dev/verify_xp_log_guard.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const cases = [
  ['src/game/skills/ExplorationSkill.js',
    "EventBus.emit('skill:action', { skillId: this.id, itemId: target.id, qty: 1, outcome: 'explore', expGained, timestamp: Date.now()",
    "EventBus.emit('skill:action', { skillId: this.id, itemId: target.id, qty: 1, outcome: 'explore', timestamp: Date.now()",
    '探索事件不带 expGained（= 用户报的日志没经验）'],
  ['src/game/bootstrap.js',
    "case 'chop':",
    "case 'chop_UNUSED':",
    '伐木的日志文案被改名（= outcome 落到 default）'],
  // ③ 复现**历史上真实那次**：模板直接渲染作者基数 `{{ t.xp }}`（探索页原来的写法）。
  //    （不测「函数体里偷偷 return 回原始值」那种：静态正则分辨不出函数内哪一行生效，
  //      硬测会得到一个永远绿或永远红的假断言 —— 那种只能靠 A 组的行为断言。）
  ['src/views/ExplorationView.vue',
    '<span class="mono">{{ xpOf(t) }}',
    '<span class="mono">{{ t.xp }}',
    '探索卡片退回直接渲染 `{{ t.xp }}`（= 少 ×60 的显示与结算不一致）'],
]

let allOk = true
for (const [file, from, to, label] of cases) {
  const path = join(ROOT, file)
  const orig = readFileSync(path, 'utf8')
  if (!orig.includes(from)) { console.log(`⚠️ 锚点没找到（反例无效）：${label}`); allOk = false; continue }
  try {
    writeFileSync(path, orig.replace(from, to), 'utf8')
    let failed = false
    try {
      execFileSync('node', ['scripts/ci/xp_log_audit.mjs'], { cwd: ROOT, stdio: 'pipe' })
    } catch { failed = true }
    console.log(`${failed ? '✅' : '❌'} ${label} → ${failed ? '守卫 FAIL（咬得住）' : '守卫**照样全绿**（假绿！）'}`)
    if (!failed) allOk = false
  } finally {
    writeFileSync(path, orig, 'utf8')
  }
}
const after = execFileSync('node', ['scripts/ci/xp_log_audit.mjs'], { cwd: ROOT, stdio: 'pipe' }).toString()
console.log(after.split('\n').filter((l) => l.includes('══')).join('\n') || '（无汇总行）')
process.exit(allOk ? 0 : 1)
