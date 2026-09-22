// 反例验证（临时脚本，跑完可删）：逐一注入缺陷，断言 C45b（难度档 / 失败代价 / 续航同源）确实会 FAIL。
// 用法：wuguan/.toolchain/node/node.exe scripts/dev/verify_c45b.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('../../', import.meta.url)
const ROOT_DIR = fileURLToPath(ROOT)
const p = (rel) => new URL(`src/${rel}`, ROOT)
const NODE = fileURLToPath(new URL('wuguan/.toolchain/node/node.exe', ROOT))

const cases = [
  ['A 档位倍率写反（精英比极限还难）', 'game/data/battleTower.js',
    "{ id: 'elite', name: '精英', icon: '🔥', mult: 1.5, rewardMult: 1.5",
    "{ id: 'elite', name: '精英', icon: '🔥', mult: 3, rewardMult: 3"],
  ['B 奖励倍率与属性倍率脱钩（更难但不多拿）', 'game/data/battleTower.js',
    "{ id: 'extreme', name: '极限', icon: '💀', mult: 2, rewardMult: 2",
    "{ id: 'extreme', name: '极限', icon: '💀', mult: 2, rewardMult: 1"],
  ['C 叠加档位时**就地改写**冻结对手对象', 'game/data/battleTower.js',
    'return {\n    ...opponent,\n    tierId: t.id,',
    'opponent.hp = Math.round(opponent.hp * t.mult)\n  return {\n    ...opponent,\n    tierId: t.id,'],
  ['D 里程碑物品数量也随档位翻倍（破物品经济）', 'game/data/battleTower.js',
    'const rm = Number(rewardMult) > 0 ? Math.round(Number(rewardMult) * 100) / 100 : 1',
    'const rm = 2'],
  ['E 失败不退层（代价形同虚设）', 'stores/player.js',
    'if ((floor ?? 0) >= TOWER_FLOOR_DROP_FROM) {',
    'if (false) {'],
  ['F 已领判定不按当前档位（换了档不认）', 'stores/player.js',
    'return (t.rewarded ?? []).includes(towerMilestoneKey(floorNum, t.tier ?? \'standard\'))',
    'return (t.rewarded ?? []).includes(floorNum)'],
  ['G 存档不还原档位（三处缺一处）', 'stores/player.js',
    'tier: towerTierOf(t.tier).id, // 脏档回退 standard',
    'tier: \'standard\','],
  ['H 续航面板改用**另一个**费率（显示与结算不同源）', 'stores/player.js',
    'const costPerSec = this.aojiCostPerSec()\n      const points = Math.max(0, this.tastePoints ?? 0)',
    'const costPerSec = (this.gastronomy?.active ?? []).length * 0.1\n      const points = Math.max(0, this.tastePoints ?? 0)'],
  ['I 扣点把小数四舍五入（超前扣费）', 'stores/player.js',
    'const whole = Math.floor(this._aojiAccum)',
    'const whole = Math.round(this._aojiAccum)'],
]

const run = () => {
  try {
    return execFileSync(NODE, ['scripts/ci/system_test.mjs'], { cwd: ROOT_DIR, encoding: 'utf8', maxBuffer: 1 << 28 })
  } catch (e) {
    return (e.stdout ?? '') + (e.stderr ?? '')
  }
}

let bad = 0
for (const [name, rel, from, to] of cases) {
  const f = p(rel)
  const orig = readFileSync(f, 'utf8')
  if (!orig.includes(from)) { console.log(`\n!! ${name}：锚点未找到，跳过`); bad++; continue }
  writeFileSync(f, orig.replace(from, to), 'utf8')
  const out = run()
  writeFileSync(f, orig, 'utf8') // 立刻还原
  const fails = out.split('\n').filter((l) => l.startsWith('FAIL'))
  console.log(`\n=== ${name} → FAIL ${fails.length} 条`)
  for (const l of fails.slice(0, 5)) console.log('   ' + l.trim().slice(0, 140))
  if (!fails.length) { console.log('   🔴 没有 FAIL —— 守卫是假绿！尾部：\n' + out.split('\n').slice(-5).join('\n')); bad++ }
}
console.log(`\n${bad === 0 ? '✅ 全部反例都被守卫抓住' : `🔴 ${bad} 个反例没被抓住`}`)
