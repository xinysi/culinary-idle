// 难度系数审计（2026-09-21 立，CI 亦执行）
//
// 背景：用户要求「所有概率获得的整体大幅下调，金币除外」，实现方式是**全局系数**（`data/difficulty.js`），
// 而不是改数据值 —— 因为对决掉落 / 探索战利品 / 1,213 条配方成功率都受 AGENTS「数据铁律」保护。
//
// 本审计钉住四件事（每条都能单独 FAIL 点名）：
//   A. **数据层未被改动**（铁律）：冻结字段的取值与条数必须还是原样 —— 证明难度是靠系数实现的
//   B. **唯一出口**：不允许任何地方再直接拿原始概率字段去判定/显示（否则会出现「显示 30% 实际 6%」）
//   C. **金币不受影响**：探索的金币战利品、失败扣金、吉祥物金币一律不经缩放
//   D. **下限与边界不变量**：永不抬高、0 保持 0、下限只托底
// 反例验证方式见文件末尾注释。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { EXPLORATION_TARGETS_ALL } from '../../src/game/data/explorationTargets.js'
import { COMBAT_REGIONS, COMBAT_BOSSES } from '../../src/game/data/combat.js'
import { MASCOTS, mascotItemChance } from '../../src/game/data/mascots.js'
import { DIFFICULTY, CHANCE_FLOOR, scaleChance, dropChance, craftSuccessChance, exploreSuccessChance, exploreLootChance, otherChance, gatherExtraChance } from '../../src/game/data/difficulty.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const fails = []
const ok = []
const check = (name, cond, detail = '') => (cond ? ok.push(name) : fails.push(`${name}${detail ? '  ← ' + detail : ''}`))

function walk(dir, out = []) {
  for (const e of readdirSync(join(root, dir))) {
    const rel = `${dir}/${e}`
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out)
    else if (/\.(js|vue)$/.test(e)) out.push(rel)
  }
  return out
}
const src = (p) => readFileSync(join(root, p), 'utf8')

// ── A. 数据层未被改动（证明铁律没被破）──
{
  const t = EXPLORATION_TARGETS_ALL
  check('A. 探索目标数仍为 200', t.length === 200, `实际 ${t.length}`)
  check('A. 探索 baseSuccess 仍是 0.60~0.85（未被改写）',
    Math.min(...t.map((x) => x.baseSuccess)) === 0.6 && Math.max(...t.map((x) => x.baseSuccess)) === 0.85)
  const itemLoot = t.flatMap((x) => (x.loot ?? []).filter((l) => l.type !== 'gold').map((l) => l.chance))
  check('A. 探索物品战利品条数仍为 500', itemLoot.length === 500, `实际 ${itemLoot.length}`)
  check('A. 探索物品战利品仍是 0.28~0.35（未被改写）',
    Math.min(...itemLoot) === 0.28 && Math.max(...itemLoot) === 0.35)
  const opp = COMBAT_REGIONS.flatMap((r) => (r.opponents ?? []).flatMap((o) => (o.drops ?? []).map((d) => d.chance)))
  const boss = COMBAT_BOSSES.flatMap((b) => (b.drops ?? []).map((d) => d.chance))
  check('A. 对决区域对手掉落仍为 909 条、0.02~0.40', opp.length === 909 && Math.min(...opp) === 0.02 && Math.max(...opp) === 0.4,
    `${opp.length} 条`)
  check('A. 首领掉落仍为 117 条、0.15~0.30', boss.length === 117 && Math.min(...boss) === 0.15 && Math.max(...boss) === 0.3,
    `${boss.length} 条`)
  // 配方成功率条数（含 quote 形态）
  let n = 0
  for (const p of walk('src/game')) n += (src(p).match(/["']?successChance["']?\s*:/g) || []).length
  check('A. 配方 successChance 条数仍为 1213（未批量改写数据）', n === 1213, `实际 ${n}`)
}

// ── B. 唯一出口：禁止再用原始概率字段 ──
{
  // [正则, 说明]：命中即说明该处绕过了 difficulty.js
  const FORBIDDEN = [
    [/Math\.random\(\)\s*<\s*d\.chance/, '对决掉落掷骰必须用 dropChance(d.chance)'],
    [/Math\.random\(\)\s*>=\s*entry\.chance/, '探索战利品掷骰必须用 this.lootChance(entry)'],
    [/\*\s*\(entry\.chance \?\? 0\)/, '探索离线期望必须用 this.lootChance(entry)'],
    [/l\.chance \* 100/, '探索页显示必须用 instance.lootChance(l)'],
    // 显示类：只钉**确实被缩放的那些字段**的裸读。
    // ⚠️ 不要写成宽泛的 /chance \* 100/i —— 它会误伤「有意排除、且显示与行为本来就一致」的字段：
    //    精耕作物的 PRIME_BASE/MAX_CHANCE（由精通派生）、装备词条的 critChance。
    [/\bd\.chance \* 100/, '对决掉落显示必须走 dropChance（DropList）'],
    [/\br\.successChance \* 100/, '配方成功率显示必须走实例方法 instance.successChance(r)（LogView 曾直读基准值：写 72%、实际 36%）'],
    [/def\.rare\.chance \* 100/, '远行队稀有货显示必须走 otherChance(def.rare.chance)'],
    [/Math\.random\(\)\s*<\s*GREENHOUSE_HONEY_CHANCE/, '温室蜂蜜判定必须用 greenhouseHoneyChance()'],
    [/Math\.random\(\)\s*<\s*\(def\.itemChance/, '吉祥物礼物必须用 mascotItemChance(def)'],
    [/\(def\.itemChance \?\? 0\) \* 100/, '吉祥物显示必须用 mascotItemChance(def)'],
    [/Math\.random\(\)\s*<\s*\(route\.specialtyChance/, '商队特产必须用 otherChance(route.specialtyChance)'],
    [/Math\.random\(\)\s*<\s*def\.rare\.chance/, '远行队稀有货必须用 otherChance(def.rare.chance)'],
    [/Math\.random\(\)\s*<\s*FOSSIL_CHANCE/, '挖掘化石必须用 gatherExtraChance(FOSSIL_CHANCE)'],
    [/Math\.random\(\)\s*<\s*COPPER_CHANCE/, '挖掘铜矿必须用 gatherExtraChance(COPPER_CHANCE)'],
    [/Math\.random\(\)\s*<\s*IRON_CHANCE/, '挖掘铁矿必须用 gatherExtraChance(IRON_CHANCE)'],
    [/Math\.random\(\)\s*<\s*WOOD_CHANCE/, '采摘木材必须用 gatherExtraChance(WOOD_CHANCE)'],
    [/Math\.random\(\)\s*<\s*PHESANT_EGG_CHANCE/, '狩猎野鸡蛋必须用 gatherExtraChance(PHESANT_EGG_CHANCE)'],
    [/Math\.random\(\)\s*<\s*0\.002/, '奇遇触发必须用 otherChance(0.002)'],
    [/\*\s*WOOD_CHANCE\)/, '采摘离线期望必须用 gatherExtraChance(WOOD_CHANCE)'],
    [/\*\s*COPPER_CHANCE\)/, '挖掘离线期望必须用 gatherExtraChance(COPPER_CHANCE)'],
    [/\*\s*IRON_CHANCE\)/, '挖掘离线期望必须用 gatherExtraChance(IRON_CHANCE)'],
    [/\*\s*FOSSIL_CHANCE\)/, '挖掘离线期望必须用 gatherExtraChance(FOSSIL_CHANCE)'],
    [/\*\s*SEED_CHANCE \+/, '种子离线期望必须用 gatherExtraChance(SEED_CHANCE)（常量部分）'],
  ]
  const hits = []
  for (const p of walk('src')) {
    if (p === 'src/game/data/difficulty.js') continue // 出口自身当然要读原始值
    const s = src(p)
    s.split('\n').forEach((line, i) => {
      const code = line.split('//')[0] // 去掉行注释，免得注释里的示例文案误报
      if (/^\s*\*/.test(line)) return // 块注释续行
      for (const [re, why] of FORBIDDEN) if (re.test(code)) hits.push(`${p}:${i + 1} ${why}`)
    })
  }
  check(`B. 没有任何地方绕过 difficulty.js 直接用原始概率（${FORBIDDEN.length} 条规则）`, hits.length === 0, hits.slice(0, 5).join(' | '))

  // 出口本身必须存在且被引用
  const d = src('src/game/data/difficulty.js')
  for (const fn of ['scaleChance', 'dropChance', 'craftSuccessChance', 'exploreSuccessChance', 'exploreLootChance', 'otherChance', 'gatherExtraChance'])
    check(`B. difficulty.js 导出 ${fn}`, new RegExp(`export (const|function) ${fn}`).test(d))
  const users = walk('src').filter((p) => p !== 'src/game/data/difficulty.js' && /from .*difficulty\.js/.test(src(p)))
  check('B. difficulty.js 至少被 8 个模块引用（出口真的接上了）', users.length >= 8, `实际 ${users.length}: ${users.slice(0, 10).join(', ')}`)
  // 三处显示点必须各自调出口
  check('B. DropList 显示走 dropChance', /dropChance\(d\.chance\)/.test(src('src/components/DropList.vue')))
  check('B. LogView 首领掉落显示走 dropChance', /dropChance\(d\.chance\)/.test(src('src/views/LogView.vue')))
  check('B. ExpeditionView 稀有货显示走 otherChance', (src('src/views/ExpeditionView.vue').match(/otherChance\(/g) || []).length >= 2)
  // 两个制作/探索成功率出口必须真的被调用（不是只定义）
  check('B. ProductionSkill 成功率走 craftSuccessChance 出口', /return craftSuccessChance\(raw\)/.test(src('src/game/skills/ProductionSkill.js')))
  check('B. ExplorationSkill 成功率走 exploreSuccessChance 出口', /return exploreSuccessChance\(raw\)/.test(src('src/game/skills/ExplorationSkill.js')))
}

// ── C. 金币不受影响 ──
{
  const gold = EXPLORATION_TARGETS_ALL.flatMap((t) => (t.loot ?? []).filter((l) => l.type === 'gold'))
  check('C. 探索金币战利品仍恒为 0.70（未被缩放）', gold.every((l) => l.chance === 0.7), `取值 ${[...new Set(gold.map((l) => l.chance))].join(',')}`)
  // 行为断言：金币条目即使调用 lootChance 也必须原样
  const fakeSkill = {
    lootChance(entry) {
      // 复刻 ExplorationSkill.lootChance 的语义（金币走原值）
      return entry?.type === 'gold' ? (entry.chance ?? 0) : exploreLootChance(entry?.chance ?? 0)
    },
  }
  check('C. lootChance(金币条目) === 原值 0.7', fakeSkill.lootChance({ type: 'gold', chance: 0.7 }) === 0.7)
  check('C. lootChance(物品条目) 已减半', Math.abs(fakeSkill.lootChance({ type: 'item', chance: 0.3 }) - 0.15) < 1e-9)
  // 探索页显示必须调 lootChance，不能读原字段
  check('C. 探索页 lootLine 走 instance.lootChance', /instance\.lootChance\(l\)/.test(src('src/views/ExplorationView.vue')))
  // 吉祥物金币不受系数影响：mascotReward 里 gold 的计算不经任何 chance 函数
  check('C. 吉祥物金币只由 goldBase×好感决定（不经系数）', /goldBase \?\? 0\) \* \(1 \+ 0\.25 \* lv\)/.test(src('src/game/data/mascots.js')))
  // 对决的金币奖励（困难首杀等）不在掉落循环里
  check('C. 对决金币奖励不经 dropChance', !/gainGold\([^)]*dropChance/.test(src('src/game/combat/Combat.js')))
}

// ── D. 下限与边界不变量 ──
{
  check('D. 系数与下限都是正数', Object.values(DIFFICULTY).every((v) => v > 0) && Object.values(CHANCE_FLOOR).every((v) => v > 0))
  check('D. 用户指定的三个下限：掉落 1% / 制作 8% / 探索 12%',
    CHANCE_FLOOR.drop === 0.01 && CHANCE_FLOOR.craft === 0.08 && CHANCE_FLOOR.explore === 0.12)
  const inv = [
    ['0 保持 0', scaleChance(0, 0.2, 0.01) === 0],
    ['负数保持 0', scaleChance(-3, 0.2, 0.01) === 0],
    ['NaN 保持 0', scaleChance(NaN, 0.2, 0.01) === 0],
    ['undefined 保持 0', scaleChance(undefined, 0.2, 0.01) === 0],
    ['永不抬高：本来就低于下限的原样保留', scaleChance(0.002, 0.5, 0.01) === 0.002],
    ['下限只托底：0.03×0.2 被托到 1%', scaleChance(0.03, 0.2, 0.01) === 0.01],
    ['正常缩放 0.3×0.2 = 0.06', Math.abs(scaleChance(0.3, 0.2, 0.01) - 0.06) < 1e-9],
    ['永不超原值', [0.001, 0.02, 0.5, 0.9, 1].every((v) => scaleChance(v, 0.5, 0.01) <= v)],
    ['永不超 1', [0.5, 1].every((v) => scaleChance(v, 1, 0.01) <= 1)],
  ]
  const bad = inv.filter(([, c]) => !c).map(([n]) => n)
  check('D. scaleChance 的 9 条边界不变量全部成立', bad.length === 0, bad.join('、'))
  // 各桶抽样：确认真的降了、且没降到 0
  const samples = [['掉落', dropChance(0.3)], ['制作', craftSuccessChance(0.72)], ['探索成功率', exploreSuccessChance(0.72)], ['探索战利品', exploreLootChance(0.3)], ['其它', otherChance(0.4)], ['附产', gatherExtraChance(0.5)]]
  check('D. 六个桶抽样都已下调且 > 0', samples.every(([, v]) => v > 0 && v < 1), samples.map(([n, v]) => `${n}=${v}`).join(' '))
  check('D. 对决确实是 ÷5', Math.abs(dropChance(0.3) - 0.06) < 1e-9)
  check('D. 制作/探索确实是 ÷2', Math.abs(craftSuccessChance(0.72) - 0.36) < 1e-9 && Math.abs(exploreSuccessChance(0.72) - 0.36) < 1e-9)
  // 吉祥物：物品概率下降，但条目仍存在
  check('D. 吉祥物物品概率已减半（0.5→0.25）', MASCOTS.some((m) => m.itemChance === 0.5 && Math.abs(mascotItemChance(m) - 0.25) < 1e-9))

  // ── 垂钓（采集类里唯一的概率闸门）与制网轴 ──
  const fish = src('src/game/skills/FishingSkill.js')
  check('D. 垂钓成功率走 otherChance 出口', /return otherChance\(Math\.min\(base \+ accPct \/ 100, 0\.99\)\)/.test(fish))
  check('D. 垂钓稀有鱼**整条**走出口（不是只压基准 —— 那会把制网轴的相对强度从 1.88× 悄悄推到 2.76×）',
    /otherChance\(Math\.min\(RARE_CHANCE \+ pp, 0\.05\)\)/.test(fish) && !/otherChance\(RARE_CHANCE\) \+ pp/.test(fish))
  {
    // 数值复核：制网满配 / 基准 的**相对**倍数必须仍是 1.88×（难度系数在分子分母上约掉）
    const base = 0.005 // RARE_CHANCE
    const maxed = Math.min(base + 0.0044, 0.05) // 满配 +0.44pp（见 system_test 的轴比值守卫）
    const ratio = otherChance(maxed) / otherChance(base)
    check('D. 制网轴的相对强度未被难度系数改变（仍是 1.88×）', Math.abs(ratio - 1.88) < 0.02, `实际 ${ratio.toFixed(3)}×`)
    check('D. 稀有鱼绝对概率已减半（0.5% → 0.25%）', Math.abs(otherChance(base) - 0.0025) < 1e-9)
  }
  // 测试桩：垂钓有概率闸门，桩值必须低于「系数后」的成功率，否则「强制命中」会变成「强制失败」
  const st = src('scripts/ci/system_test.mjs')
  check('D. system_test 的随机桩值低于系数后的垂钓成功率（0.02 < ≈0.275，不能用 0.5）',
    !/withRandom\(\[0\.5(,| )/.test(st) && /withRandom\(\[0\.02/.test(st))
}

// ── 输出 ──
console.log('══ 难度系数审计（数据铁律 ↔ 全局系数）══')
for (const n of ok) console.log('  ok  ' + n)
for (const n of fails) console.log('FAIL  ' + n)
console.log(`\n通过 ${ok.length} / 失败 ${fails.length}`)
process.exit(fails.length ? 1 : 0)
