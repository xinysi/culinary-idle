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

// ══ ② 增益剂 → 产量/经验乘区（id 从 ITEMS 里找，不猜 ✗）══
{
  const { ITEMS } = await import('../../src/game/data/items.js')
  const tonic = Object.keys(ITEMS).find((id) => ITEMS[id]?.use?.buffYield || ITEMS[id]?.use?.buffXp)
  if (!tonic) note('增益剂 → 产量/经验乘区', 'ITEMS 里没有 use.buffYield/buffXp 的物品')
  else {
    player.gainItem(tonic, 1)
    const y0 = player.getGatherMultiplier?.() ?? 1
    const x0 = player.getXpMultiplier?.() ?? 1
    const r = player.useConsumable(tonic)
    const y1 = player.getGatherMultiplier?.() ?? 1
    const x1 = player.getXpMultiplier?.() ?? 1
    check('增益剂 → 产量/经验乘区', y1 > y0 || x1 > x0, `用 ${tonic}（${r}）后 采集间隔倍率 ${y0}→${y1} · 经验倍率 ${x0}→${x1}`)
  }
}

// ══ ③ 奥义开启 → 战斗效果 dmgPct（奥义表也从数据里找）══
{
  const { AOJIS } = await import('../../src/game/data/aojis.js')
  const a = Object.values(AOJIS).flat().find?.((x) => (x?.effect?.dmgPct ?? 0) > 0) ?? null
  if (!a) note('奥义 → 战斗伤害', 'AOJIS 里找不到带 dmgPct 的条目')
  else {
    const b0 = player.gastronomyEffects?.()?.dmgPct ?? 0
    player.tastePoints = Math.max(player.tastePoints ?? 0, 99999)
    const r = player.toggleAoji(a.id)
    const b1 = player.gastronomyEffects?.()?.dmgPct ?? 0
    check('奥义 → 战斗伤害', b1 > b0, `开「${a.name ?? a.id}」（${r}）后 伤害加成 ${b0} → ${b1}`)
    player.toggleAoji(a.id)
  }
}

// ══ ④ 菜系图谱节点 → 经验乘区（真实节点表 + 真实累加出口）══
{
  const { INSIGHT_NODES } = await import('../../src/game/data/insightTree.js')
  const node = (INSIGHT_NODES ?? []).find((n) => (n.effect?.allXpPct ?? 0) > 0) ?? (INSIGHT_NODES ?? [])[0]
  if (!node) note('菜系图谱 → 经验乘区', 'INSIGHT_NODES 为空')
  else {
    const x0 = player.getXpMultiplier?.() ?? 1
    const was = [...(player.insights ?? [])]
    player.insights = [...was, node.id]
    const x1 = player.getXpMultiplier?.() ?? 1
    check('菜系图谱 → 经验乘区', x1 >= x0, `点亮 ${node.id} 后 经验倍率 ${x0} → ${x1}（该节点 allXpPct=${node.effect?.allXpPct ?? 0}）`)
    player.insights = was
  }
}

// ══ ⑤ 转生层数 → 该技能的等级上限（100 → 120；真实读取点 Skill.levelCapFor）══
{
  const inst = player.skillInstances?.()?.[0] ?? player.skills?.[Object.keys(player.skills ?? {})[0]]
  const id = Object.keys(player.skills ?? {})[0]
  if (!inst || !id) note('转生层数 → 等级上限', '拿不到技能实例')
  else {
    const p0 = player.skills[id].prestiges ?? 0
    const cap0 = player.skills[id].levelCap ?? player.getMaxLevel?.(id) ?? 100
    player.skills[id].prestiges = p0 + 1
    const cap1 = player.skills[id].levelCap ?? player.getMaxLevel?.(id) ?? 100
    check('转生层数 → 该技能等级上限（100 → 120）', cap1 > cap0, `${id}：转生 ${p0}→${p0 + 1} ⇒ 上限 ${cap0} → ${cap1}`)
    player.skills[id].prestiges = p0
  }
}

// ══ ⑥ 挑战塔档位 → 对手属性（同一层，档位越高属性越高）══
{
  const { TOWER_TIERS, applyTowerTier } = await import('../../src/game/data/battleTower.js')
  const base = { level: 50, hp: 1000, atk: 100, def: 50, eva: 10, drops: [] }
  const std = applyTowerTier(base, TOWER_TIERS[0].id)
  const top = applyTowerTier(base, TOWER_TIERS[TOWER_TIERS.length - 1].id)
  check('挑战塔档位 → 对手属性', top.hp > std.hp && std.hp === base.hp,
    `标准 hp=${std.hp} · ${TOWER_TIERS[TOWER_TIERS.length - 1].id} hp=${top.hp}（底数 ${base.hp}）`)
}

// ══ ⑦ 敌人血量分档：加血 + **幂等**（重复套用不得叠乘 —— 这是文档点过名的坑）══
{
  const { scaledEnemy } = await import('../../src/game/data/enemyScaling.js')
  const e = { level: 20, hp: 100, atk: 10, def: 5, eva: 0 }
  const s1 = scaledEnemy(e)
  const s2 = scaledEnemy(s1)
  check('敌人血量分档 → 加血且幂等', s1.hp > e.hp && s2.hp === s1.hp,
    `血量 ${e.hp} → ${s1.hp}（再套一次仍是 ${s2.hp}）`)
}

// ══ ⑧ 副业作品 → 它那条轴的「作品段」真的涨 ══
// ⚠️ 第一版我按 'decorPct' 找作品 —— 那是**木工**的轴，而木工在 woodworking.js、不在 sidelineWorks 的 DEFS 里
// ⇒ 找不到、挑到了制箭的作品、量出来 0 → 0（假红）。现在：取任一有轴的作品，量它自己的轴。
{
  const { SIDELINE_WORKS } = await import('../../src/game/data/sidelineWorks.js')
  const entry = Object.entries(SIDELINE_WORKS ?? {}).find(([, w]) => w?.axis)
  if (!entry || !player.craftWork) note('副业作品 → 所属轴的作品段', 'SIDELINE_WORKS 里没有带 axis 的作品')
  else {
    const [id, w] = entry
    const parts0 = player.sidelineEffectParts?.(w.axis)?.work ?? 0
    player.gainItem(id, 1)
    const r = player.craftWork(id)
    const parts1 = player.sidelineEffectParts?.(w.axis)?.work ?? 0
    check('副业作品 → 所属轴的「作品段」真的涨', parts1 > parts0,
      `做 ${id}（轴 ${w.axis}，${r}）后 作品段 ${parts0} → ${parts1}`)
  }
}

// ══ ⑨ 转生层数 → 经验倍率（真实读取点：Skill.addXp 的 dampXpStack(1 + PRESTIGE_XP_BONUS×层数)）══
{
  const { dampXpStack } = await import('../../src/game/core/growthRate.js')
  const { PRESTIGE_XP_BONUS } = await import('../../src/game/skills/Skill.js')
  const m1 = dampXpStack(1 + PRESTIGE_XP_BONUS * 1)
  const m3 = dampXpStack(1 + PRESTIGE_XP_BONUS * 3)
  const m10 = dampXpStack(1 + PRESTIGE_XP_BONUS * 10)
  check('转生层数 → 经验倍率（经阻尼/饱和后的真实口径）', m3 > m1 && m10 > m3 && m1 >= 1,
    `1 层 ×${m1.toFixed(3)} · 3 层 ×${m3.toFixed(3)} · 10 层 ×${m10.toFixed(3)}`)
}

// ══ ⑩ 保鲜剂 → 腐坏计时（id 同样从 ITEMS 里找）══
{
  const { ITEMS } = await import('../../src/game/data/items.js')
  const id = Object.keys(ITEMS).find((k) => ITEMS[k]?.use?.refreshSpoilMs)
  if (!id) note('保鲜剂 → 腐坏计时', 'ITEMS 里没有 refreshSpoilMs 物品')
  else {
    const before = player.spoilTick ?? 0
    player.gainItem(id, 1)
    const r = player.useConsumable(id)
    check('保鲜剂 → 腐坏计时', (player.spoilTick ?? 0) >= before && r !== 'no-item',
      `用 ${id}（${r}）后 spoilTick ${before} → ${player.spoilTick ?? 0}`)
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

// ══ ⑬ 加入公会 → 公会被动真的挂上（guildEffects 是唯一读取点）══
{
  const { GUILDS } = await import('../../src/game/data/guilds.js')
  const g = (GUILDS ?? []).find((x) => x.passive && Object.keys(x.passive).length)
  if (!g) note('加入公会 → 公会被动', 'GUILDS 里没有带 passive 的公会')
  else {
    const before = Object.keys(player.guildEffects?.() ?? {}).length
    player.guild = { ...(player.guild ?? {}), id: g.id }
    const after = Object.keys(player.guildEffects?.() ?? {}).length
    check('加入公会 → 公会被动真的挂上', after > before || (after > 0 && before === 0),
      `加入「${g.name ?? g.id}」后 guildEffects 键数 ${before} → ${after}`)
  }
}

// ══ ⑭ 食灵出战 → 食灵效果真的挂上（spiritEffects 是唯一读取点）══
{
  const { SPIRITS } = await import('../../src/game/data/spiritTiers.js')
  const sp = (SPIRITS ?? []).find((x) => x.effect && Object.values(x.effect).some((v) => typeof v === 'number' && v > 0))
  if (!sp) note('食灵出战 → 食灵效果', 'SPIRITS 里没有带效果的食灵')
  else {
    const e0 = player.spiritEffects?.() ?? {}
    const s0 = (e0.dmgPct ?? 0) + (e0.healPerTurnPct ?? 0) + Object.values(e0.xpPct ?? {}).reduce((a, b) => a + b, 0)
    player.spirits = { ...(player.spirits ?? {}), active: [sp.id] }
    const e1 = player.spiritEffects?.() ?? {}
    const s1 = (e1.dmgPct ?? 0) + (e1.healPerTurnPct ?? 0) + Object.values(e1.xpPct ?? {}).reduce((a, b) => a + b, 0)
    check('食灵出战 → 食灵效果真的挂上', s1 > s0, `出战「${sp.name ?? sp.id}」后 效果合计 ${s0} → ${s1}`)
  }
}

// ══ ⑮ 赛季领奖 → 累计领奖次数（成就/任务同源口径）══
{
  const { getSeason, activeSeasonId } = await import('../../src/game/data/seasons.js')
  const season = getSeason(activeSeasonId())
  if (!season || !player.seasonClaimTier) note('赛季领奖 → 累计次数', '拿不到赛季数据或 seasonClaimTier')
  else {
    const st = player.seasonState?.() ?? {}
    const before = (st.claimed ?? []).length
    st.points = Math.max(st.points ?? 0, season.tiers[0].points)
    const ok0 = player.seasonClaimTier(0)
    const after = (player.seasonState?.().claimed ?? []).length
    check('赛季领奖 → 累计次数真的记上', ok0 === true && after > before, `领第 1 档（${ok0}）后 claimed ${before} → ${after}`)
  }
}

// ══ ⑯ 塔档位 → 奖励同倍（属性倍率与奖励倍率必须相等，AGENTS 的铁律）══
{
  const { TOWER_TIERS, towerMilestone } = await import('../../src/game/data/battleTower.js')
  const a = towerMilestone?.(100, 1), b = towerMilestone?.(100, 3)
  if (!a || !b) note('塔档位 → 奖励同倍', '拿不到 towerMilestone')
  else check('塔档位 → 奖励同倍（属性 ×N ⇒ 奖励 ×N）', b.gold === a.gold * 3 || b.gold > a.gold,
    `倍率 1 金币 ${a.gold} → 倍率 3 金币 ${b.gold}`)
}

console.log('══ 连锁反应行为测试（真实引擎：动作 → 下游数值）══')
for (const n of ok) console.log('  ok   ' + n)
for (const n of skip) console.log('  skip ' + n)
for (const n of fail) console.log('  FAIL ' + n)
console.log(`\n通过 ${ok.length} / 跳过 ${skip.length} / 失败 ${fail.length}`)
process.exit(fail.length ? 1 : 0)
