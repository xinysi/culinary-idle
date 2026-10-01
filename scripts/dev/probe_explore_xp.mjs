// 探针：美食探索的经验到底怎么算的（在线 / 离线 / 与采集对照）
// 手法：真实引擎 + 桩掉 Math.random（保证成功与掉落可预测），逐项比对「声明公式 vs 实际到账」。
import { createPinia, setActivePinia } from 'pinia'
setActivePinia(createPinia())
const { usePlayerStore } = await import('../../src/stores/player.js')
const { EventBus } = await import('../../src/game/core/EventBus.js')
const { CARD_XP_SCALE, targetLevelXpMult } = await import('../../src/game/core/growthRate.js')
const { masteryXpMultiplier } = await import('../../src/game/core/mastery.js')
const { createSkillInstances, getSkillInstance } = await import('../../src/game/skills/registry.js')

const p = usePlayerStore()
p.newGame()
p.settings.xpMultiplier = 1
createSkillInstances(p)

const inst = getSkillInstance('exploration')
// 造一个可控状态：等级 50、挑一张 50 级的卡
const t = inst.targets.filter((x) => x.reqLevel <= 50).sort((a, b) => b.reqLevel - a.reqLevel)[0]
p.setSkillState('exploration', { level: 50, exp: p.xpTotalForLevel(50) })
p.setSkillTarget('exploration', t.id)
console.log(`目标 ${t.id} ${t.name} Lv${t.reqLevel} xp=${t.xp} 间隔=${inst.intervalMs(t)}ms`)
console.log(`精通 ${inst.masteryLevelOf(t)} 级 → 倍率 ${masteryXpMultiplier(inst.masteryLevelOf(t))}`)
console.log(`lowTargetMult=${targetLevelXpMult(inst.level, t.reqLevel, inst.topUsableTargetLevel)}`)

// ① 直接调 addCardXp：实际加了多少经验
const before = inst.exp
const ret = inst.addCardXp(t.xp, masteryXpMultiplier(inst.masteryLevelOf(t)), t.reqLevel)
const after = inst.exp
console.log(`\n[直接 addCardXp] 返回 ${ret} · 经验条 ${Math.floor(before)} → ${Math.floor(after)}（差 ${Math.floor(after) - Math.floor(before)}）`)

// ② 走一次 performAction（强制成功、强制掉落命中），看事件里带没带经验
const rand = Math.random
let seeds = [0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001]
Math.random = () => (seeds.length ? seeds.shift() : 0.001)
const evs = []
const off = (e) => evs.push(e)
EventBus.on('skill:action', off)
const e0 = inst.exp
inst.performAction(t)
const e1 = inst.exp
EventBus.off('skill:action', off)
Math.random = rand
console.log(`\n[performAction 成功] 经验条 ${Math.floor(e0)} → ${Math.floor(e1)}（差 ${Math.floor(e1) - Math.floor(e0)}）`)
for (const e of evs) console.log('  事件:', JSON.stringify({ skillId: e.skillId, outcome: e.outcome, qty: e.qty, expGained: e.expGained, extraGain: e.extraGain, penalty: e.penalty }))

// ③ 离线口径：同样的成功次数应拿到与在线同样的经验
const offline = inst.computeOffline(3600_000, 1)
console.log(`\n[离线 1h] actions=${offline.actions} exp=${offline.exp} xpMult=${offline.xpMult}`)
const perAction = offline.actions > 0 ? offline.exp / offline.actions : 0
console.log(`  折算每次尝试 ${perAction.toFixed(2)} 经验（在线每次成功 ${t.xp}·衰减后应再乘 lowMult/pool/scale）`)

// ④ 与采集同口径对照：同一套 addCardXp 输入
const g = getSkillInstance('foraging')
const gt = g.targets[0]
p.setSkillState('foraging', { level: 50, exp: p.xpTotalForLevel(50) })
p.setSkillTarget('foraging', gt.itemId ?? gt.id)
const b2 = g.exp
const r2 = g.addCardXp(gt.xpPerAction, 1, gt.reqLevel)
console.log(`\n[采集对照] 输入 base=${gt.xpPerAction} → 返回 ${r2}（` + `×${(r2 / gt.xpPerAction).toFixed(3)}）；探索输入 ${t.xp} → 返回 ${ret}（×${(ret / t.xp).toFixed(3)}）`)
