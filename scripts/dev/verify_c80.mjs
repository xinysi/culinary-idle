// 反例验证：C80 离线基础时长按等级分档（2026-09-29）+ 战斗「副风格也在涨经验」的界面说明
// 用法：node scripts/dev/verify_c80.mjs          （全部例；每例跑 system_test 或 content_sync_audit）
//      node scripts/dev/verify_c80.mjs 3
// ⚠️ 纪律（沿用 verify_c79）：锚点单行优先；**绝不并发跑两个反例脚本**；跑完 grep 扫注入残留。
// ⚠️ 本脚本覆盖**两套守卫**：system_test 的 C80 组（离线分档）与 content_sync_audit 的风格经验组（界面说明）。
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const P = (rel) => join(root, rel)
const CRLF = String.fromCharCode(13, 10)

function injectText(rel, from, to) {
  const orig = readFileSync(P(rel), 'utf8')
  const fold = (t) => (orig.includes(CRLF) ? t.replace(/\n/g, CRLF) : t)
  const f = fold(from), t = fold(to)
  const n = orig.split(f).length - 1
  if (n !== 1) throw new Error(`${rel} 锚点匹配 ${n} 次（期望 1）：${from.slice(0, 60)}`)
  writeFileSync(P(rel), orig.replace(f, t), 'utf8')
}

const CAPS = 'src/game/data/caps.js'
const PLAYER = 'src/stores/player.js'
const AE = 'src/game/data/activeEffects.js'
const GUIDE = 'src/game/data/guide.js'
const PANEL = 'src/components/CombatPanel.vue'
const REALM = 'src/game/data/mysticRealm.js'

/** 每条案子跑哪套守卫：'st' = system_test，'cs' = content_sync_audit */
const CASES = [
  // ── A. 离线分档（C80）──────────────────────────────────────────────
  {
    name: '① 分档表被摊平成全 12h（等于把这条改动关掉）',
    guard: 'st', rel: CAPS,
    from: '  { level: 100, hours: 13 },',
    to: '  { level: 100, hours: 12 },',
    expect: '边界：99=12',
  },
  {
    name: '② 无差别加强：早期档也被抬到 20h（新档玩家被一起加速）',
    guard: 'st', rel: CAPS,
    from: '  if (!Number.isFinite(lv) || lv < OFFLINE_LEVEL_STEPS[0].level) return OFFLINE_CAP.baseHours',
    to: '  if (!Number.isFinite(lv)) return OFFLINE_CAP.baseHours\n  if (lv < OFFLINE_LEVEL_STEPS[0].level) return OFFLINE_LEVEL_STEPS[OFFLINE_LEVEL_STEPS.length - 1].hours',
    expect: '早期不动',
  },
  {
    name: '③ 唯一出口退回写死 baseHours（满级玩家仍只补 12h）',
    guard: 'st', rel: PLAYER,
    from: 'return tunerOver(\'offlineHours\', this.offlineBaseHours() + biscuit + dao + shanhai, 0.25, 72)',
    to: 'return tunerOver(\'offlineHours\', OFFLINE_CAP.baseHours + biscuit + dao + shanhai, 0.25, 72)',
    expect: '唯一出口',
  },
  {
    name: '④ 效果总览写死 baseHours（显示 12、结算 20 = 显示与结算不一致）',
    guard: 'st', rel: AE,
    from: '      const base = p.offlineBaseHours?.() ?? OFFLINE_CAP.baseHours',
    to: '      const base = OFFLINE_CAP.baseHours',
    expect: '显示同源',
  },
  {
    // ⚠️ 这条反例的写法很关键：**不能**用「删掉那句早退」来注入 ——
    //    当前实现的 for 循环本身就自然回退（NaN 与 <100 都不命中任何档）⇒ 删早退**打不穿**断言
    //    （首版就是这么写的，探针显示「守卫仍全绿」= 反例无效，不是守卫假绿）。
    //    要打穿必须换成**按下标取档**的写法（很多人会这么写，且正是本项目 Number(null)===0 那类坑的形状）。
    name: '⑤ 换成「按下标取档」的写法（NaN / 0 级会落到最后一档 = 非法输入被抬档）',
    guard: 'st', rel: CAPS,
    from: '  const lv = Number(level)\n  if (!Number.isFinite(lv) || lv < OFFLINE_LEVEL_STEPS[0].level) return OFFLINE_CAP.baseHours\n  let h = OFFLINE_CAP.baseHours\n  for (const s of OFFLINE_LEVEL_STEPS) if (lv >= s.level) h = s.hours\n  return h',
    to: '  const lv = Number(level)\n  const idx = Math.floor((lv - 100) / 5)\n  return (OFFLINE_LEVEL_STEPS[idx] ?? OFFLINE_LEVEL_STEPS[OFFLINE_LEVEL_STEPS.length - 1]).hours',
    expect: '非法输入回退',
  },
  {
    name: '⑥ 攻略文案改回写死「基础 12h」（对新玩家说了假话）',
    guard: 'st', rel: GUIDE,
    from: '基础随你的最高技能等级抬升，满级 20h ⇒ 最高 32h',
    to: '基础固定 12h',
    expect: '攻略写明',
  },
  // ── B. 战斗「副风格也在涨经验」的界面说明（content_sync_audit）──────
  {
    name: '⑦ 界面说明整行删掉（玩家又不知道副风格在涨了）',
    guard: 'cs', rel: PANEL,
    from: '        <p class="dim style-note">用哪个流派，那个流派拿全额经验；另外两个流派各拿 {{ offStylePct }}%（换着练能把三条一起带起来，当前流派的经验一点不少）。</p>\n',
    to: '',
    expect: '对决面板写明',
  },
  {
    name: '⑧ 比例写成字面量 33（分母改成 2 时界面就是假话）',
    guard: 'cs', rel: PANEL,
    from: 'const offStylePct = computed(() => Math.round(100 / STYLE_OFF_XP_DIV))',
    to: 'const offStylePct = computed(() => 33)',
    expect: '对决面板写明',
  },
  {
    name: '⑨ 给那行挂 v-if="false"（文本还在、但永不渲染）',
    guard: 'cs', rel: PANEL,
    from: '<p class="dim style-note">用哪个流派，那个流派拿全额经验',
    to: '<p v-if="false" class="dim style-note">用哪个流派，那个流派拿全额经验',
    expect: '对决面板写明',
  },
  // ── C. 挑战塔第 4 档「饕餮」（Lv105 解锁）──────────────────────────
  {
    name: '⑩ setTowerTier 不查门槛（未达标也能切进饕餮档）',
    guard: 'st', rel: PLAYER,
    from: '      if (!towerTierUnlocked(t.id, this.combatLevel)) return this.towerTier()',
    to: '      if (false) return this.towerTier()',
    expect: '未达标时 setTowerTier 拒绝切换',
  },
  {
    name: '⑪ 结算路径绕过门槛（towerOpp 直读存档字段，未解锁档照样乘进属性）',
    guard: 'st', rel: PLAYER,
    from: '      return applyTowerTier(towerFloor(floor, this.combatLevel), this.towerTier().id)',
    to: '      return applyTowerTier(towerFloor(floor, this.combatLevel), this.tower?.tier ?? \'standard\')',
    expect: '门槛行为',
  },
  {
    name: '⑫ 读档不复核（转生掉级后仍带着饕餮档打）',
    guard: 'st', rel: PLAYER,
    from: '      return towerTierUnlocked(t.id, this.combatLevel) ? t : towerTierOf(\'standard\')',
    to: '      return t',
    expect: '门槛行为',
  },
  // ── D. 食神秘境 11~13 档（Lv105/110/115）──────────────────────────
  {
    name: '⑬ realmTierCapFor 恒返回 10（等于把 11~13 档关掉）',
    guard: 'st', rel: REALM,
    from: '  for (const g of REALM_TIER_GATES) if (Number.isFinite(lv) && lv >= g.level) cap = g.tier',
    to: '  for (const g of REALM_TIER_GATES) if (false) cap = g.tier',
    expect: '门槛：第 11/12/13 档',
  },
  {
    name: '⑭ 升档判定不看门槛（低等级也能把存储档位升进 11）',
    guard: 'st', rel: PLAYER,
    from: '        const cap = realmTierCapFor(this.combatLevel)',
    to: '        const cap = REALM_TIER_MAX',
    expect: '等级不够时不许升进第 11 档',
  },
  {
    name: '⑮ realmTierUnlocked 漏挡 t < 1（Number(null)===0 ⇒ null 被判「已解锁」）',
    guard: 'st', rel: REALM,
    from: '  if (!Number.isFinite(t) || t < 1) return false',
    to: '  if (!Number.isFinite(t)) return false',
    expect: '门槛：第 11/12/13 档',
  },
]

const run = (guard) => {
  const script = guard === 'cs' ? 'scripts/ci/content_sync_audit.mjs' : 'scripts/ci/system_test.mjs'
  try {
    return { code: 0, out: execFileSync(process.execPath, [script], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }) }
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

const ONLY = process.argv.slice(2).map(Number).filter((n) => n >= 1)
const PICK = CASES.map((c, i) => [c, i + 1]).filter(([, i]) => (ONLY.length ? ONLY.includes(i) : true))

const backups = new Map()
let okAll = true
for (const [c, idx] of PICK) {
  if (!backups.has(c.rel)) backups.set(c.rel, readFileSync(P(c.rel), 'utf8'))
  try {
    injectText(c.rel, c.from, c.to)
  } catch (e) {
    console.log(`⚠ ${c.name} —— 注入失败：${e.message}`)
    okAll = false
    writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
    continue
  }
  const r = run(c.guard)
  // 🔴 只认 FAIL 行（`ok` 行里也可能含同样的名字 ⇒ 首版拿全量文本匹配会假绿）
  const failLines = r.out.split('\n').filter((l) => l.startsWith('FAIL'))
  // 有的缺陷会连带多条 FAIL：只要**点名到该断言名**即算抓住
  const named = failLines.some((l) => l.includes(c.expect))
  const hit = r.code !== 0 && named
  console.log(`${hit ? '✅' : '❌'} ${String(idx).padStart(2)}. [${c.guard}] ${c.name} → ${r.code === 0 ? '守卫仍全绿（注入没被抓住）' : 'FAIL'}，点名含「${c.expect}」= ${named}`)
  if (!hit) {
    okAll = false
    console.log(failLines.slice(0, 5).join('\n') || '（没有任何 FAIL 行）')
  }
  writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
}

const backSt = run('st')
const backCs = run('cs')
const clean = backSt.code === 0 && /失败 0/.test(backSt.out) && backCs.code === 0
console.log(`${clean ? '✅' : '❌'} 还原后两套守卫全绿（system_test ${(backSt.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]} · content_sync_audit exit=${backCs.code}）`)
console.log(okAll && clean ? `\n反例验证通过：${PICK.length} 个注入缺陷全部被点名，还原后恢复全绿` : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)
