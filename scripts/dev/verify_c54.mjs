// 反例验证：低目标经验衰减（C54）——逐个注入真缺陷 → 跑 system_test → 断言 FAIL 且点名 → 还原。
// 用法：node scripts/dev/verify_c54.mjs      （每次注入跑一遍 system_test，约 19 秒；共 9 例 ⇒ 约 3 分钟）
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
    name: '① 阈值改 4（低 4 级也减半）',
    rel: 'src/game/core/growthRate.js',
    from: 'export const LOW_TARGET_GAP = 5', to: 'export const LOW_TARGET_GAP = 4',
    expect: '低 4 级不减',
  },
  {
    name: '② 系数改 0.6（不再是减半）',
    rel: 'src/game/core/growthRate.js',
    from: 'export const LOW_TARGET_XP_MULT = 0.5', to: 'export const LOW_TARGET_XP_MULT = 0.6',
    expect: '低 5 级减半',
  },
  {
    name: '③ 去掉参照系夹取（退回「只看技能等级」⇒ 转生后全域减半）',
    rel: 'src/game/core/growthRate.js',
    from: '  return Number.isFinite(t) ? Math.min(s, t) : s', to: '  void t\n  return s',
    expect: '参照等级 = min',
  },
  {
    name: '④ 空值当成 0 级（本轮修掉的真缺陷：Number(null) === 0）',
    rel: 'src/game/core/growthRate.js',
    // ⚠️ 锚点必须去掉 `&& n > 0` 而不是整行判断：只删前面那句 null 判断时 `n > 0` 仍会把它挡成 NaN
    //    （第一版就是删错了地方 → 注入「成功」但守卫依然全绿，属于**反例本身无效**而非守卫假绿）
    from: 'return Number.isFinite(n) && n > 0 ? n : NaN', to: 'return Number.isFinite(n) ? n : NaN',
    expect: '空值不误罚',
  },
  {
    name: '⑤ 唯一出口漏接线（采集动作不传目标等级）',
    rel: 'src/game/skills/GatheringSkill.js',
    from: 'this.addCardXp(target.xpPerAction, masteryXpMultiplier(this.masteryLevel(target)), target.reqLevel)',
    to: 'this.addCardXp(target.xpPerAction, masteryXpMultiplier(this.masteryLevel(target)))',
    expect: '接线',
  },
  {
    name: '⑥ 离线口径漏接线（bootstrap 不传等级 ⇒ 脱机练级不减半）',
    rel: 'src/game/bootstrap.js',
    from: 'inst.addCardXp(r.exp, r.xpMult ?? 1, inst.currentTarget?.reqLevel ?? null)',
    to: 'inst.addCardXp(r.exp, r.xpMult ?? 1)',
    expect: '离线同口径',
  },
  {
    name: '⑦ 界面漏标记（采集页没有减半标签）',
    rel: 'src/views/GatheringView.vue',
    // ⚠️ 锚点**不能带尾随换行**：本仓库的 .vue 是 CRLF，写 `</span>\n` 会匹配 0 次（AGENTS 记过一次）
    // 2026-09-23 起标签是「经验数值旁」的紧凑标签（原先塞在卡片头部的徽章已按用户截图报的排版问题移走）
    from: '<span v-if="isLow(t)" class="xp-low-chip" :title="LOW_TARGET_NOTE">{{ LOW_TARGET_CHIP }}</span>',
    to: '',
    expect: '减半」紧凑标签',
  },
  {
    name: '⑩ 减半标签又跑回卡片头部（会把同排卡片行高顶乱 —— 用户截图报的那个排版问题）',
    rel: 'src/views/GatheringView.vue',
    from: '<div class="dim" style="font-size: 12px">Lv {{ t.reqLevel }} 解锁</div>',
    to: '<span v-if="isLow(t)" class="xp-low-chip">{{ LOW_TARGET_CHIP }}</span><div class="dim" style="font-size: 12px">Lv {{ t.reqLevel }} 解锁</div>',
    expect: '不在卡片头部',
  },
  {
    name: '⑪ 农耕的标签塞进「N 经验」那一行（窄格会把同行「90s 生长」挤成两行）',
    rel: 'src/views/FarmingView.vue',
    from: '<div v-if="isLow(c)" class="item-cell-sub" style="font-size: 12px">',
    to: '<div v-if="isLow(c) && false" class="item-cell-sub" style="font-size: 12px">',
    expect: '独占一行',
  },
  {
    name: '⑧ 显示与结算脱钩（效率不折低目标 ⇒ 卡片数字是实际的两倍）',
    rel: 'src/game/skills/GatheringSkill.js',
    // ⚠️ 锚点必须**单行**：多行锚点里的 `\n` 匹配不到 CRLF 文件（本仓库 .vue/.js 都可能是 CRLF，
    //    AGENTS 记过这个坑；第一版就是多行锚点 ⇒ 匹配 0 次、被当成「跳过」）
    from: 'const lowMult = targetLevelXpMult(this.level, target.reqLevel, this.topTargetLevel)',
    to: 'const lowMult = 1 // 注入缺陷：显示不折低目标',
    expect: '目标效率',
  },
  {
    name: '⑨ 视图手写系数（0.5 写死在页面里）',
    rel: 'src/views/ExplorationView.vue',
    from: 'const isLow = (t) => props.instance.isLowTargetLevel(t.reqLevel)',
    to: 'const isLow = (t) => t.xp * 0.5 < 0 && props.instance.isLowTargetLevel(t.reqLevel)',
    expect: '不许手写 0.5',
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
console.log(okAll && clean ? '\n反例验证通过：${CASES.length} 个注入缺陷全部被点名，还原后恢复全绿' : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)
