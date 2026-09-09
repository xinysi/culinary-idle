// 成长时长模拟 — 用真实引擎/真实公式测量各技能「满级(99)所需挂机时长」
// 运行：node scripts/growth_sim.mjs（约 3-4 分钟；战斗类逐场跑真实 Combat 引擎）
//
// 方法学（2026-09-09 定，勿改用解析式估算）：
//   · 采集/探索：createSkillInstances 后直接 inst.tick(dt) 驱动真实实例，策略=当前解锁的最高等级目标
//   · 制作：inst.craft(recipe)，按制作队列节奏 3 秒/件计时
//   · 农耕：生长按 Date.now() → 需 monkey-patch 虚拟时钟推进；自动收种由 settings.autoFarm 驱动
//   · 狩猎：需先给足陷阱（弹药不足时 tick 不累积计时）
//   · 解析式建模极易漏掉 addCardXp 的 ×60（CARD_XP_SCALE）与精通倍率，实测偏差可达 60 倍
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../src/stores/player.js'
import { createSkillInstances, getSkillInstance } from '../src/game/skills/registry.js'
import { Combat } from '../src/game/combat/Combat.js'
import { COMBAT_REGIONS, COMBAT_BOSSES } from '../src/game/data/combat.js'
import { SPIRITS } from '../src/game/data/spirits.js'
import { AOJIS } from '../src/game/data/aojis.js'
import { CROPS } from '../src/game/skills/FarmingSkill.js'

setActivePinia(createPinia())
const p = usePlayerStore()
const MAXLV = 99
const COMBAT_SKILLS = ['knife', 'tasteAcumen', 'heatControl']

// 虚拟时钟（农耕等按真实时钟生长）
let SIM_NOW = Date.now()
const REAL_NOW = Date.now
Date.now = () => SIM_NOW

const SCENARIOS = [
  { id: 'base', name: '基准', spirit: 0, bond: 0, aoji: false, guild: null, prestige: 0, tonic: 1, settings: 1, market: null },
  { id: 'normal', name: '常规', spirit: 2, bond: 0, aoji: true, guild: 'sageKitchen', prestige: 0, tonic: 1, settings: 1, market: null },
  { id: 'adv', name: '进阶', spirit: 2, bond: 5, aoji: true, guild: 'sageKitchen', prestige: 1, tonic: 4.5, settings: 1, market: null },
  { id: 'max', name: '满配', spirit: 2, bond: 5, aoji: true, guild: 'sageKitchen', prestige: 10, tonic: 4.5, settings: 10, market: { gatherXp: 1.5, craftXp: 2, combatXp: 2, restaurant: 2 } },
]

function setup(sc, skillId) {
  p.newGame()
  p.settings.xpMultiplier = sc.settings
  p.settings.autoFarm = true
  p.settings.autoEat = true
  p.settings.autoEatThreshold = 60
  if (sc.spirit > 0) {
    const ranked = SPIRITS.filter((s) => (s.effect?.xpPct?.[skillId] ?? 0) > 0)
      .sort((a, b) => b.effect.xpPct[skillId] - a.effect.xpPct[skillId]).slice(0, sc.spirit)
    p.spirits = { active: ranked.map((s) => s.id), owned: Object.fromEntries(ranked.map((s) => [s.id, 1])) }
    if (sc.bond) for (const s of ranked) p.spiritBonds[s.id] = 30 * 86400000
  }
  if (sc.aoji) { const a = AOJIS.find((x) => x.effect?.xpPct > 0); if (a) p.gastronomy = { active: [a.id] } }
  if (sc.guild) p.guild = { id: sc.guild, points: 0, day: null, taskProgress: {} }
  if (sc.prestige) for (const k of [skillId, ...COMBAT_SKILLS]) if (p.skills[k]) p.skills[k] = { ...p.skills[k], prestiges: sc.prestige }
  if (sc.tonic > 1) p.buffs.xpMult = { mult: sc.tonic, expiresAt: REAL_NOW() + 1e12 }
  if (sc.market) p.marketBoost = () => ({ restaurant: 2, ...sc.market })
  createSkillInstances(p)
  p.inventory.trap = 99999999
  p.inventory.roastPotato = 99999
  p.inventory.whiteBread = 99999
  SIM_NOW = REAL_NOW()
}

/** 采集/探索：tick 真实实例（等级变化时才重选目标） */
function driveIdle(skillId, maxDays = 200) {
  const inst = getSkillInstance(skillId)
  let ms = 0, cachedLv = -1
  const cap = maxDays * 86400000
  while ((p.skills[skillId].level ?? 1) < MAXLV && ms < cap) {
    const lv = p.skills[skillId].level ?? 1
    if (lv !== cachedLv) {
      cachedLv = lv
      const t = [...inst.targets].filter((x) => x.reqLevel <= lv).sort((a, b) => b.reqLevel - a.reqLevel)[0]
      if (!t) break
      p.setSkillTarget(skillId, t.itemId ?? t.id)
    }
    inst.tick(10000)
    ms += 10000
    SIM_NOW += 10000
  }
  return ms / 3600000
}

/** 制作：队列节奏 3 秒/件（材料假定充足） */
function driveCraft(skillId) {
  const inst = getSkillInstance(skillId)
  let crafts = 0
  const cap = 200 * 24 * 1200
  while ((p.skills[skillId].level ?? 1) < MAXLV && crafts < cap) {
    const lv = p.skills[skillId].level ?? 1
    const r = [...inst.recipes].filter((x) => x.reqLevel <= lv).sort((a, b) => b.reqLevel - a.reqLevel)[0]
    if (!r) break
    for (const k of Object.keys(r.ingredients)) p.inventory[k] = 999999
    if (inst.craft(r) === 'denied') break
    crafts++
  }
  return (crafts * 3) / 3600
}

/** 农耕：自动收种（settings.autoFarm） */
function driveFarm() {
  const inst = getSkillInstance('farming')
  let ms = 0
  const cap = 200 * 86400000
  const plantBest = () => {
    const lv = p.skills.farming.level ?? 1
    const c = [...CROPS].filter((x) => x.reqLevel <= lv).sort((a, b) => b.reqLevel - a.reqLevel)[0]
    if (!c) return
    p.inventory[c.seedId] = 999999
    for (let i = 0; i < inst.maxPlots; i++) if (!inst.plotAt(i)) inst.plant(i, c.seedId)
  }
  plantBest()
  while ((p.skills.farming.level ?? 1) < MAXLV && ms < cap) {
    inst.tick(10000)
    ms += 10000
    SIM_NOW += 10000
    if (inst.emptyPlotCount > 0) plantBest()
  }
  return ms / 3600000
}

/** 战斗三技能（刀工/品鉴力/火候）同步满级 */
function driveCombat() {
  const combat = new Combat(p)
  let hours = 0, fights = 0
  while (fights < 400000) {
    const lv = (id) => p.skills[id]?.level ?? 1
    if (COMBAT_SKILLS.every((k) => lv(k) >= MAXLV)) break
    const cl = p.combatLevel
    const boss = COMBAT_BOSSES.find((b) => b.level <= cl && b.level >= cl - 2)
    const opp = boss ?? (() => {
      let best = null
      for (const r of COMBAT_REGIONS) {
        if (r.reqLevel > cl) break
        for (const o of r.opponents) if (o.level <= cl + 5 && (!best || o.level > best.level)) best = o
      }
      return best
    })()
    if (!opp) break
    if (p.combat.hp <= 0) p.setCombat({ hp: p.maxHp })
    const speedMs = combat.playerStats().speedMs
    combat.start(opp)
    let g = 0
    while (combat.inFight && g++ < 5000) combat.tick(5000)
    hours += (combat.turnCount * speedMs) / 3600000
    fights++
  }
  return hours
}

const fmt = (h) => (h >= 200 * 24 ? '未完成' : h < 1 ? `${(h * 60).toFixed(0)}分` : h < 48 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}天`)
const SKILLS = [
  ['foraging', '采摘', () => driveIdle('foraging')],
  ['fishing', '垂钓', () => driveIdle('fishing')],
  ['hunting', '狩猎', () => driveIdle('hunting')],
  ['excavation', '挖掘', () => driveIdle('excavation')],
  ['farming', '农耕', () => driveFarm()],
  ['cooking', '烹饪', () => driveCraft('cooking')],
  ['baking', '烘焙', () => driveCraft('baking')],
  ['preserving', '腌制', () => driveCraft('preserving')],
  ['brewing', '调酒', () => driveCraft('brewing')],
  ['spiceMixing', '调料调配', () => driveCraft('spiceMixing')],
  ['craftsmithing', '厨具锻造', () => driveCraft('craftsmithing')],
  ['preservation', '食材保鲜', () => driveCraft('preservation')],
  ['spiritSummoning', '食灵召唤', () => driveCraft('spiritSummoning')],
  ['exploration', '美食探索', () => driveIdle('exploration')],
  ['combat', '战斗三技能', () => driveCombat()],
]

console.log('技能满级(99)所需挂机时长（真实引擎驱动；材料/种子/陷阱充足；战斗为刀工+品鉴力+火候同步满级）')
console.log('技能'.padEnd(12) + SCENARIOS.map((s) => s.name.padEnd(12)).join(''))
for (const [id, name, fn] of SKILLS) {
  const row = []
  for (const sc of SCENARIOS) {
    setup(sc, id === 'combat' ? 'tasteAcumen' : id)
    row.push(fmt(fn()))
  }
  console.log(name.padEnd(12) + row.map((x) => x.padEnd(12)).join(''))
}
console.log('\n注：美食知识(gastronomy) 随对决胜利积累经验，与战斗三技能同节奏；转生后上限 120 级（累计经验为 100 级的 7.2 倍）。')
