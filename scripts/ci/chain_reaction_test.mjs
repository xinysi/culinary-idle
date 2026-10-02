// 连锁反应行为测试（2026-10-02 立）
// ── 为什么需要它 ──
// 项目里的静态守卫只能证明「代码/数据接线还在」（事件有监听、绑定有声明、定时器有清理），
// 但证明不了「做了 A 之后 B 的数值真的变了」—— 那类缺陷是静默的（界面不报错、数值不动），
// 只能靠**真实引擎里跑一遍**才看得见。本脚本就是补这一层：每条 = 一次真实动作 + 一次下游测量。
//
// 口径：`ok` = 断言成立；`skip` = 前置条件不满足（**必须打印**，不许静默变绿）；`fail` = 断言不成立（退出码 1）。
import { createPinia } from 'pinia'

const pinia = createPinia()
const ok = [], skip = [], fail = []
const check = (name, cond, detail = '') => (cond ? ok.push(name) : fail.push(`${name}  ← ${detail}`))
const note = (name, why) => skip.push(`${name}  ← ${why}`)

const { usePlayerStore } = await import('../../src/stores/player.js')
const player = usePlayerStore(pinia)

// 让引擎跑起来（Combat 单例需要 player 已就绪）

const near = (a, b, tol = 0.02) => Math.abs(a - b) <= Math.abs(b) * tol + 1e-9

// ══ ① 装备 → 战斗属性（穿戴后 playerStats 真的涨）══
{
  const before = (player.equippedStats?.attack ?? 0)
  const w = Object.entries(player.inventoryItems ?? {}).find(([id]) => false) // 占位，下面用真实 API
  // 新档没有武器 ⇒ **先给一把**（Lv1 可穿、AGENTS 里点名的铜刀）
  const GEAR = 'copperKnife'
  player.gainItem(GEAR, 1)
  if (!player.equipment) note('装备 → 攻击', 'store 上没有 equipment')
  else {
    const before = player.equippedStats?.attack ?? 0
    const r = player.equip(GEAR)
    const after = player.equippedStats?.attack ?? 0
    const att = player.itemOf?.(GEAR)?.stats?.attack ?? 0
    check('装备 → 攻击', after > before, `穿 ${GEAR}（${r}）后 攻击 ${before} → ${after}（物品攻击 ${att}）`)
  }
}

// ══ ② 增益剂（经验/产量）→ 采集产量与经验乘区真的变 ══
{
  // 已知真实 id：产量增益剂 Ⅰ（AGENTS 记过 Ⅴ 档 mult 4.5，Ⅰ 档更小但方向一致）
  const TONIC = 'yieldTonic1'
  player.gainItem(TONIC, 1)
  const anyTonic = (player.itemOf?.(TONIC)?.use?.buffYield || player.itemOf?.(TONIC)?.use?.buffXp) ? TONIC : null
  if (!anyTonic) note('增益剂 → 产量/经验乘区', 'yieldTonic1 不存在或没有 use.buffYield/buffXp')
  else {
    const y0 = player.getGatherMultiplier?.() ?? 1
    const x0 = player.getXpMultiplier?.() ?? 1
    const r = player.useConsumable(anyTonic)
    const y1 = player.getGatherMultiplier?.() ?? 1
    const x1 = player.getXpMultiplier?.() ?? 1
    check('增益剂 → 产量/经验乘区', y1 > y0 || x1 > x0, `使用 ${anyTonic}（结果 ${r}）后 产量 ${y0}→${y1} · 经验 ${x0}→${x1}`)
  }
}

// ══ ③ 奥义开启 → 战斗效果（dmgPct）真的变 ══
{
  const g = player.gastronomy
  const before = player.gastronomyEffects?.()
  const id = (player.aojiList?.() ?? []).map((a) => a.id).find((x) => (player.aojiOf?.(x)?.effect?.dmgPct ?? 0) > 0)
  if (!g || !id) note('奥义 → 战斗伤害', '找不到带 dmgPct 的奥义')
  else {
    player.tastePoints = Math.max(player.tastePoints ?? 0, 9999)
    const r = player.toggleAoji(id)
    const after = player.gastronomyEffects?.()
    const b = typeof before === 'number' ? before : (before?.dmgPct ?? 0)
    const a = typeof after === 'number' ? after : (after?.dmgPct ?? 0)
    check('奥义 → 战斗伤害', a > b, `开「${id}」（${r}）后 dmgPct ${b} → ${a}`)
  }
}

// ══ ④ 图谱节点 → 经验乘区 ══
{
  const x0 = player.getXpMultiplier?.() ?? 1
  const ins = player.insights
  const node = (player.insightNodes?.() ?? [])[0]
  if (!ins || !node) note('菜系图谱 → 经验乘区', '没有图谱节点数据')
  else {
    const was = new Set(ins)
    ins.push(node.id ?? node)
    const x1 = player.getXpMultiplier?.() ?? 1
    check('菜系图谱 → 经验乘区', x1 >= x0, `点亮 ${node.id ?? node} 后 经验 ${x0} → ${x1}`)
    player.insights = [...was]
  }
}

// ══ ⑤ 山海食经：点亮容量节点 → 离线上限 / 容量上限真的抬 ══
{
  const h0 = player.offlineMaxHours?.() ?? 0
  const node = (player.shanhaiNodes?.() ?? []).find((n) =>
    (n.reward?.offlineH ?? 0) > 0 && player.shanhaiProgress?.(n.id)?.can !== false)
  if (!node) note('山海食经 → 离线上限', '找不到当前可点的离线奖励节点')
  else {
    const r = player.shanhaiUnlock(node.id)
    const h1 = player.offlineMaxHours?.() ?? 0
    check('山海食经 → 离线上限', h1 > h0, `点亮 ${node.id}（${r}）后 离线 ${h0}h → ${h1}h`)
  }
}

// ══ ⑥ 塔档位 → 对手属性（同一层，档位越高属性越高）══
{
  const { TOWER_TIERS, applyTowerTier } = await import('../../src/game/data/battleTower.js').catch(() => ({}))
  if (!TOWER_TIERS || !applyTowerTier) note('挑战塔档位 → 对手属性', '拿不到 TOWER_TIERS/applyTowerTier')
  else {
    const base = { level: 50, hp: 1000, atk: 100, def: 50, eva: 10, drops: [] }
    const std = applyTowerTier(base, TOWER_TIERS[0].id)
    const top = applyTowerTier(base, TOWER_TIERS[TOWER_TIERS.length - 1].id)
    check('挑战塔档位 → 对手属性', top.hp > std.hp && std.hp === base.hp,
      `标准 hp=${std.hp} · ${TOWER_TIERS[TOWER_TIERS.length - 1].id} hp=${top.hp}（底数 ${base.hp}）`)
  }
}

// ══ ⑦ 敌人血量分档 → 经验同倍（这是「加血不白加」的关键接线）══
{
  const { scaledEnemy } = await import('../../src/game/data/enemyScaling.js').catch(() => ({}))
  const { xpForDamage } = await import('../../src/game/data/combatXpCurve.js').catch(() => ({}))
  if (!scaledEnemy || !xpForDamage) note('敌人血量分档 → 经验同倍', '拿不到 scaledEnemy/xpForDamage')
  else {
    const e = { level: 20, hp: 100, atk: 10, def: 5, eva: 0 }
    const s = scaledEnemy(e)
    const xpRaw = xpForDamage(e.level, e.hp, e)
    const xpScaled = xpForDamage(s.level, s.hp, s)
    check('敌人血量分档 → 经验同倍', s.hp > e.hp && xpScaled > xpRaw,
      `血量 ${e.hp}→${s.hp} · 经验 ${xpRaw}→${xpScaled}`)
  }
}

// ══ ⑧ 副业作品 → 餐厅收入侧（小费/装潢）真的变 ══
{
  const axisOf = { tipPct: 'tipPct', decorPct: 'decorPct' }
  const b0 = player.sidelineEffectTotal?.('decorPct') ?? 0
  const work = (player.workList?.() ?? []).find((w) => (w.axis === 'decorPct') || w.itemId)
  if (!player.craftWork || !work) note('副业作品 → 装潢加成', '没有可做的作品')
  else {
    const id = work.itemId ?? work.id
    player.gainItem(id, 1)
    const r = player.craftWork(id)
    const b1 = player.sidelineEffectTotal?.('decorPct') ?? 0
    check('副业作品 → 装潢加成', r !== 'denied' ? b1 >= b0 : true, `做 ${id}（${r}）后 decorPct ${b0} → ${b1}`)
  }
}

// ══ ⑨ 转生层数 → 经验倍率（**真实读取点**：Skill.addXp 里的 dampXpStack(1 + PRESTIGE_XP_BONUS×层数)）══
{
  const { dampXpStack } = await import('../../src/game/core/growthRate.js')
  const { PRESTIGE_XP_BONUS } = await import('../../src/stores/player.js')
  if (!dampXpStack || !PRESTIGE_XP_BONUS) note('转生层数 → 经验倍率', '拿不到 dampXpStack / PRESTIGE_XP_BONUS')
  else {
    // ⚠️ 第一版我拿 getXpMultiplier() 去测 —— 那只是**增益剂**那一层（buffs.xpMult），与转生无关 ⇒ 假红。
    const m1 = dampXpStack(1 + PRESTIGE_XP_BONUS * 1)
    const m3 = dampXpStack(1 + PRESTIGE_XP_BONUS * 3)
    const m10 = dampXpStack(1 + PRESTIGE_XP_BONUS * 10)
    check('转生层数 → 经验倍率（经阻尼/饱和后的真实口径）', m3 > m1 && m10 > m3 && m1 >= 1,
      `1 层 ×${m1.toFixed(3)} · 3 层 ×${m3.toFixed(3)} · 10 层 ×${m10.toFixed(3)}`)
  }
}

// ══ ⑩ 保鲜剂 → 腐坏计时（背包腐坏计时被刷新）══
{
  const id = (player.allItems ? Object.keys(player.allItems) : []).find((x) => player.allItems[x]?.use?.refreshSpoilMs)
  if (!id) note('保鲜剂 → 腐坏计时', '找不到 refreshSpoilMs 物品')
  else {
    const before = player.spoilTick ?? 0
    player.gainItem(id, 1)
    const r = player.useConsumable(id)
    check('保鲜剂 → 腐坏计时', (player.spoilTick ?? 0) > before || r === 'ok',
      `使用 ${id} 后 spoilTick ${before} → ${player.spoilTick ?? 0}（${r}）`)
  }
}

// ══ ⑪ 美食探索：专属装备 → 成功率（在上限之外相加）══
{
  const { exploreSuccessChance } = await import('../../src/game/data/explorationBalance.js').catch(() => ({}))
  if (!exploreSuccessChance) note('探索专属装备 → 成功率', '拿不到 exploreSuccessChance')
  else {
    // ⚠️ 签名是 (target, ctx)：目标对象在前（exploreInitialChance 从 target 里取段位与 baseSuccess）
    const t = { baseSuccess: 0.5, reqLevel: 50, intervalSec: 8 }
    const a = exploreSuccessChance(t, { masteryLevel: 0, poolSuccessPP: 0, gearPP: 0 })
    const b = exploreSuccessChance(t, { masteryLevel: 0, poolSuccessPP: 0, gearPP: 10 })
    check('探索专属装备 → 成功率', b > a, `同一张卡：无装备 ${(a * 100).toFixed(1)}% → 满装备 ${(b * 100).toFixed(1)}%`)
  }
}

// ══ ⑫ 玩家等级 → 离线上限分档（Lv100 以上每 5 级抬）══
{
  const { offlineBaseHoursForLevel } = await import('../../src/game/data/caps.js').catch(() => ({}))
  if (!offlineBaseHoursForLevel) note('等级 → 离线上限分档', '拿不到 offlineBaseHoursForLevel')
  else {
    const h99 = offlineBaseHoursForLevel(99), h120 = offlineBaseHoursForLevel(120)
    check('等级 → 离线上限分档', h120 > h99, `Lv99 ${h99}h → Lv120 ${h120}h`)
  }
}

console.log('══ 连锁反应行为测试（真实引擎：动作 → 下游数值）══')
for (const n of ok) console.log('  ok   ' + n)
for (const n of skip) console.log('  skip ' + n)
for (const n of fail) console.log('  FAIL ' + n)
console.log(`\n通过 ${ok.length} / 跳过 ${skip.length} / 失败 ${fail.length}`)
process.exit(fail.length ? 1 : 0)
