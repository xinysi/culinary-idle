// 反例验证（临时脚本，跑完可删）：逐一注入缺陷，断言 C45c（战斗×buff 口径收口）确实会 FAIL。
// 用法：wuguan/.toolchain/node/node.exe scripts/dev/verify_c45c.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('../../', import.meta.url)
const ROOT_DIR = fileURLToPath(ROOT)
const p = (rel) => new URL(`src/${rel}`, ROOT)
const NODE = fileURLToPath(new URL('wuguan/.toolchain/node/node.exe', ROOT))

const cases = [
  ['A 战斗侧把 maxHp% 再乘一遍（回到三套口径）', 'game/combat/Combat.js',
    'maxHp: this.player.maxHp, // 唯一口径：外面那一层 % 已在 store 的 getter 里乘过',
    'maxHp: this.player.maxHp * (1 + ((realm?.maxHpPct ?? 0) + (insight.maxHpPct ?? 0) + (dao.maxHpPct ?? 0)) / 100),'],
  ['B store 里把道树 maxHpPct 算两次（回到 ×平方）', 'stores/player.js',
    'const daoPct = (s.daoEffectSumCache ?? daoEffectSum(s.daoUnlocked ?? [])).maxHpPct ?? 0',
    'const daoPct = ((s.daoEffectSumCache ?? daoEffectSum(s.daoUnlocked ?? [])).maxHpPct ?? 0) * 2'],
  ['C 攻速地板写死回字面量（丢掉单一出口）', 'game/combat/Combat.js',
    'speedMs: Math.floor(combatTurnIntervalSec(sl, speedBonus, speedPct) * 1000 * (this.slowTurns > 0 ? 1.5 : 1)),',
    'speedMs: Math.floor(Math.max(1.2, (2.4 - sl * 0.02 - speedBonus) * (1 - speedPct / 100)) * 1000 * (this.slowTurns > 0 ? 1.5 : 1)),'],
  ['D 撞顶标记恒 false（界面无从提示）', 'game/combat/Combat.js',
    'speedAtCap: atCap, // 已在地板上 ⇒ 一切「攻速 +%」当前都是零效果（界面据此提示，别再让玩家白花品鉴点）',
    'speedAtCap: false,'],
  ['E 属性面板删掉「受击减免」行', 'components/CombatPanel.vue',
    '...(takenPct.value > 0\n    ? [{ k: \'受击减免\', v: `-${takenPct.value}%`',
    '...(false\n    ? [{ k: \'受击减免\', v: `-${takenPct.value}%`'],
  ['F 增益行不再把 critChance 换成百分比', 'components/CombatPanel.vue',
    "k === 'critChance' ? Math.round(Number(v) * 100) : v", 'v'],
  ['G 灼烧日志去掉伤害数字', 'game/combat/Combat.js',
    '（每回合损失 ${Math.max(1, Math.floor(o.level * 0.5))} 生命值）', '（每回合损失 生命值）'],
  ['H 饼干改回与酱料共用 buffTurns', 'game/combat/Combat.js',
    "this.addBuff('biscuit', { accuracy: BISCUIT_ACC }, BISCUIT_BUFF_TURNS)",
    "this.addBuff('item', { accuracy: BISCUIT_ACC }, BISCUIT_BUFF_TURNS)"],
  ['I 饼干到期时把整份 buffs 清零（会连酱料一起抹掉）', 'game/combat/Combat.js',
    "      if (this.biscuitTurns === 0) this.expireBuff('biscuit') // 饼干自己的命中/攻速到期（不被酱料延长）",
    "      if (this.biscuitTurns === 0) { this.buffs = { atk: 0, accuracy: 0, defense: 0, evasion: 0, critChance: 0 }; this.biscuitSpeedPct = 0 }"],
  ['J 引擎不再消费 buff.speed（静默无效）', 'game/combat/Combat.js',
    '+ (Number(this.buffs.speed) || 0)', '+ 0'],
  ['L 衰减改回 0.02（到顶回到 L60）', 'game/data/caps.js',
    'export const COMBAT_SPEED_DECAY_PER_LEVEL = 0.016', 'export const COMBAT_SPEED_DECAY_PER_LEVEL = 0.02'],
  ['M 引擎里把曲线写死回字面量', 'game/combat/Combat.js',
    'speedMs: Math.floor(combatTurnIntervalSec(sl, speedBonus, speedPct) * 1000 * (this.slowTurns > 0 ? 1.5 : 1)),',
    'speedMs: Math.floor(Math.max(1.2, (2.4 - sl * 0.02 - speedBonus) * (1 - speedPct / 100)) * 1000 * (this.slowTurns > 0 ? 1.5 : 1)),'],
  ["N 血量分档最高倍率超过经验上限倍率（加血会亏经验）", "game/data/enemyScaling.js",
    "{ maxLevel: 20, mult: 2 }, // 2 回合 → 4 回合左右", "{ maxLevel: 20, mult: 3 }, // 2 回合 → 4 回合左右"],
  ["O 分档写成「就地改传入对象」（破坏冻结数据）", "game/data/enemyScaling.js",
    "return { ...opponent, __scaled: true, hp: Math.max(1, Math.round((opponent.hp ?? 1) * m)), baseHp: opponent.hp, hpMult: m }", "opponent.hp = Math.max(1, Math.round((opponent.hp ?? 1) * m)); return opponent"],
  ["P 后期也加血（L61+ 不再为 1）", "game/data/enemyScaling.js",
    "{ maxLevel: Infinity, mult: 1 }, // L61+ 不动（已经 7~11s，且加血会造墙）", "{ maxLevel: Infinity, mult: 1.5 },"],
  ["Q 经验系数被改（破坏「同等级 = 旧值」的等价性）", "game/data/combatXpCurve.js",
    "return (lv * 9.7 + lv * lv * 0.45) * winXpBoost(lv)", "return (lv * 9.7 + lv * lv * 0.45) * winXpBoost(lv) * 1.3"],
  ["R 经验不再按「期望血量 ×2」封顶（深塔变成唯一练级点）", "game/data/combatXpCurve.js",
    "return Math.min(d, hpCap, levelCap)", "return Math.min(d, hpCap)"],
  ["S 引擎入场不再套分档", "game/combat/Combat.js",
    "const o = scaledEnemy(opponent)", "const o = opponent"],
  ["T 击杀后不设重生间隔", "game/combat/Combat.js",
    "this.respawnUntil = performance.now() + COMBAT_RESPAWN_SEC * 1000", "this.respawnUntil = 0"],
  ["U 失败也设重生间隔（被反杀还罚时间）", "game/combat/Combat.js",
    "this.result = 'lose'", "this.result = 'lose'\n    this.respawnUntil = performance.now() + COMBAT_RESPAWN_SEC * 1000"],
  ["V 区域列表不再套分档（显示与结算分家）", "views/CombatView.vue",
    ".sort((a, b) => a.level - b.level).map(scaledEnemy)", ".sort((a, b) => a.level - b.level)"],
  ["W 页头规则说明被删（变暗改）", "views/CombatView.vue",
    "⚖️ 低等级对手血量已上调（{{ enemyScalingText() }}）", "⚖️ 对手已调整"],
  ['K 给酱料加一个引擎不读的 buff 键', 'game/data/items.js',
    "soySauce: it('soySauce', '酱油', 'ingredient', 'pickled', 2, 30, { buff: { accuracy: 3, duration: 10 } })",
    "soySauce: it('soySauce', '酱油', 'ingredient', 'pickled', 2, 30, { buff: { accuracy: 3, yieldPct: 5, duration: 10 } })"],
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
  // ⚠️ 仓库里**混着 CRLF 与 LF**（`Combat.js` 等老文件是 CRLF，本轮新建的模块是 LF）⇒
  //    多行锚点若不兼容 EOL 就会「锚点未找到、静默跳过」（本轮 U 就这么漏过一次）。
  const eol = orig.includes('\r\n') ? '\r\n' : '\n'
  const fromN = from.replace(/\n/g, eol)
  const toN = to.replace(/\n/g, eol)
  if (!orig.includes(fromN)) { console.log(`\n!! ${name}：锚点未找到，跳过`); bad++; continue }
  writeFileSync(f, orig.replace(fromN, toN), 'utf8')
  const out = run()
  writeFileSync(f, orig, 'utf8') // 立刻还原
  const fails = out.split('\n').filter((l) => l.startsWith('FAIL'))
  console.log(`\n=== ${name} → FAIL ${fails.length} 条`)
  for (const l of fails.slice(0, 4)) console.log('   ' + l.trim().slice(0, 150))
  if (!fails.length) { console.log('   🔴 没有 FAIL —— 守卫是假绿！尾部：\n' + out.split('\n').slice(-5).join('\n')); bad++ }
}
console.log(`\n${bad === 0 ? '✅ 全部反例都被守卫抓住' : `🔴 ${bad} 个反例没被抓住`}`)
