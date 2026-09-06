// Buff 效果全面测试 — 物品 buff/regen/醉酒/食灵/奥义/增益剂/公会被动
// 运行：node .toolchain/buff_test.mjs
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../src/stores/player.js'
import { createSkillInstances, getSkillInstance } from '../src/game/skills/registry.js'
import { getItem, ITEMS } from '../src/game/data/items.js'
import { SPIRITS } from '../src/game/data/spirits.js'
import { AOJIS } from '../src/game/data/aojis.js'
import { GUILDS } from '../src/game/data/guilds.js'
import { Combat } from '../src/game/combat/Combat.js'
import { COMBAT_REGIONS } from '../src/game/data/combat.js'
import { totalXpForLevel } from '../src/game/core/Experience.js'

let pass = 0
let fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  ${name}`) }
  else { fail++; console.log(`FAIL  ${name} ${detail}`) }
}
function freshPlayer(skills = {}) {
  setActivePinia(createPinia())
  const p = usePlayerStore()
  p.newGame()
  for (const [id, lv] of Object.entries(skills)) p.setSkillState(id, { level: lv, exp: totalXpForLevel(lv) })
  createSkillInstances(p)
  return p
}
function startFight(p, name = '学徒厨师') {
  const c = new Combat(p)
  const opp = COMBAT_REGIONS[0].opponents.find((o) => o.name === name) ?? COMBAT_REGIONS[0].opponents[0]
  c.start(opp)
  return c
}

// ── A. 物品 buff 数据完整性 ──
console.log('══ A. 物品 buff 数据 ══')
{
  const SUPPORTED = new Set(['atk', 'accuracy', 'defense', 'evasion', 'critChance', 'speed', 'duration'])
  const bad = []
  const noDur = []
  for (const [id, it] of Object.entries(ITEMS)) {
    if (it.buff) {
      for (const k of Object.keys(it.buff)) if (!SUPPORTED.has(k)) bad.push(`${id}.${k}`)
      if (!(it.buff.duration > 0)) noDur.push(id)
      for (const [k, v] of Object.entries(it.buff)) if (k !== 'duration' && !(v > 0)) bad.push(`${id}.${k}=${v}`)
    }
    if (it.drunk) {
      // 醉酒：布尔或回合数
      if (it.drunk !== true && !(it.drunk > 0)) bad.push(`${id}.drunk=${it.drunk}`)
    }
    if (it.regen) {
      if (!(it.regen.perTurn > 0) || !(it.regen.turns > 0)) bad.push(`${id}.regen=${JSON.stringify(it.regen)}`)
    }
  }
  check('buff 键全部有效且值为正、duration 有效', bad.length === 0 && noDur.length === 0, `bad=${bad.slice(0, 5).join(',')} noDur=${noDur.slice(0, 5).join(',')}`)
  const buffCount = Object.values(ITEMS).filter((x) => x.buff).length
  const regenCount = Object.values(ITEMS).filter((x) => x.regen).length
  const drunkCount = Object.values(ITEMS).filter((x) => x.drunk).length
  console.log(`  带增益物品 ${buffCount} · 持续回血 ${regenCount} · 醉酒 ${drunkCount}`)
}

// ── B. 食灵/奥义/公会被动数据 ══
console.log('══ B. 食灵/奥义/公会 ══')
{
  const SP_SUP = new Set(['xpPct', 'styleDmgPct', 'dmgPct', 'healPerTurnPct', 'loseHpPerTurnPct', 'fishingAccPct', 'farmYieldBonus'])
  const spBad = SPIRITS.filter((s) => Object.keys(s.effect ?? {}).some((k) => !SP_SUP.has(k)))
  check('食灵 32 效果键有效', spBad.length === 0, spBad.map((s) => s.id).join(','))
  const AO_SUP = new Set(['dmgPct', 'styleDmgPct', 'defensePct', 'speedPct', 'maxHpBonus', 'yieldPct', 'xpPct', 'healPct'])
  const aoBad = AOJIS.filter((a) => Object.keys(a.effect ?? {}).some((k) => !AO_SUP.has(k)))
  check('奥义 28 效果键有效', aoBad.length === 0, aoBad.map((a) => a.id).join(','))
  const GU_SUP = new Set(['dmgPct', 'yieldPct', 'craftPct', 'xpPct'])
  const guBad = GUILDS.filter((g) => Object.keys(g.passive ?? {}).some((k) => !GU_SUP.has(k)))
  check('公会 20 被动键有效', guBad.length === 0, guBad.map((g) => g.id).join(','))
}

// ── C. 酱料 buff 战斗中生效 ──
console.log('══ C. 酱料 buff 生效 ══')
{
  // 高配置玩家保证战斗打满 10 回合（低配可能提前战败导致 buff 未跑完）
  const p = freshPlayer({ tasteAcumen: 40, knife: 40, heatControl: 40 })
  p.inventory.soySauce = 5
  // 增益生效验证
  const c = startFight(p)
  check('使用酱料成功', c.useSauce('soySauce') === true)
  check('酱油准确率增益 +3 生效', c.buffs.accuracy === 3, JSON.stringify(c.buffs))
  // 清除逻辑确定性验证：buffTurns 设 1 → 1 回合后归零且 buffs 清空
  // （不依赖完整战斗跑满 10 回合——高配置玩家 3 回合就击杀对手，战斗提前结束）
  c.buffTurns = 1
  c.tick(3000)
  check('增益回合结束后清除（buffTurns→0 且 buffs 归零）', c.buffTurns === 0 && Object.values(c.buffs).every((v) => v === 0), JSON.stringify(c.buffs))
}

// ── D. 醉酒攻速惩罚 ──
console.log('══ D. 醉酒 ══')
{
  const p = freshPlayer({ tasteAcumen: 10 })
  p.inventory.riceWine = 5
  const c = startFight(p)
  c.useDrink('riceWine')
  check('醉酒标记建立（drunkTurns=5）', c.drunkTurns === 5, `drunkTurns=${c.drunkTurns}`)
  const accAfter = c.playerStats().accuracy
  // 醉酒惩罚：准确率 -15%（useDrink 后 accuracy 已打折）
  const c2 = startFight(freshPlayer({ tasteAcumen: 10 }))
  const accBefore = c2.playerStats().accuracy
  check('醉酒中准确率下降（-15%）', accAfter < accBefore, `before=${accBefore} after=${accAfter}`)
  // 5 回合后解除
  for (let i = 0; i < 12; i++) c.tick(3000)
  check('醉酒回合结束后解除', c.drunkTurns === 0)
}

// ── E. 持续回血 regen ──
console.log('══ E. 持续回血 ══')
{
  const p = freshPlayer({ tasteAcumen: 10 })
  p.inventory.whiteBread = 5
  const c = startFight(p)
  const hpBefore = p.combat.hp
  c.useFood('whiteBread')
  check('进食后 regen 建立', c.regenTurns > 0 && c.regenPerTurn > 0, `turns=${c.regenTurns} per=${c.regenPerTurn}`)
  c.tick(3000)
  check('regen 回合回血', p.combat.hp >= hpBefore + c.regenPerTurn - 1, `hp ${hpBefore}→${p.combat.hp}`)
}

// ── F. 增益剂（经验/产量） ──
console.log('══ F. 增益剂 ══')
{
  const p = freshPlayer()
  p.inventory.xpTonic1 = 1
  const ok = p.useItem('xpTonic1')
  check('经验增益剂使用成功', ok.ok === true && ok.msg, JSON.stringify(ok))
  check('经验倍率 ×1.2 生效（Ⅰ阶）', p.buffs.xpMult.mult === 1.2, JSON.stringify(p.buffs.xpMult))
  // 过期
  p.buffs.xpMult.expiresAt = Date.now() - 1000
  const foraging = getSkillInstance('foraging')
  const xpBefore = p.skills.foraging.exp
  foraging.doAction?.()
  check('过期后倍率不再生效', p.skills.foraging.exp - xpBefore < 20)
  // 产量增益剂
  p.inventory.yieldTonic1 = 1
  p.useItem('yieldTonic1')
  check('产量增益剂 ×1.5 生效（Ⅰ阶）', p.buffs.yieldMult.mult === 1.5)
}

// ── G. 公会被动 buff ──
console.log('══ G. 公会被动 ══')
{
  const p = freshPlayer({ tasteAcumen: 20, knife: 20, heatControl: 20 })
  p.gold = 100000
  p.joinGuild('battleAxe') // 战斗型 dmgPct 6，需对决 15 级
  const c = startFight(p)
  // dmgPct 在伤害公式中生效（playerStats.attack 不含公会加成）
  check('战斗公会被动 dmgPct 6 生效', (p.guildEffects?.() ?? {}).dmgPct === 6, JSON.stringify(p.guildEffects?.()))
}

// ── H. 奥义聚合 ──
console.log('══ H. 奥义 ══')
{
  const p = freshPlayer({ tasteAcumen: 20 })
  p.tastePoints = 10000
  p.toggleAoji('sharpBlade') // 刀工伤害 +10%
  p.toggleAoji('feastMaster') // 盛宴之主：料理回血 +50%
  const ge = p.gastronomyEffects()
  check('奥义效果聚合存在', Object.keys(ge).length > 0, JSON.stringify(ge))
  const flatOk = ['dmgPct', 'defensePct', 'speedPct', 'maxHpBonus', 'yieldPct', 'xpPct', 'healPct'].every((k) => Number.isFinite(ge[k]) && ge[k] >= 0)
  const styleOk = Object.entries(ge.styleDmgPct ?? {}).every(([, v]) => Number.isFinite(v) && v >= 0)
  check('奥义聚合值有效（有限且非负）', flatOk && styleOk, JSON.stringify(ge))
  check('激活两个奥义', p.gastronomy.active.length === 2, JSON.stringify(p.gastronomy.active))
  // 清空点数 → 自动关闭（含被动奥义）
  p.tastePoints = 0
  p.drainAoji(100)
  check('点数耗尽奥义全部关闭', p.gastronomy.active.length === 0)
}

// ── I. 数据层：全部带 buff 物品在 itemDetail 可显示（无英文键）──
console.log('══ I. buff 显示标签 ══')
{
  const BUFF_LABEL = { atk: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', speed: '攻速', duration: '持续' }
  const miss = []
  for (const [id, it] of Object.entries(ITEMS)) {
    if (it.buff) for (const k of Object.keys(it.buff)) if (k !== 'duration' && !BUFF_LABEL[k]) miss.push(`${id}.${k}`)
  }
  check('buff 键全有中文标签', miss.length === 0, miss.slice(0, 5).join(','))
}

console.log(fail === 0 ? `\nALL PASS (${pass})` : `\n${fail} FAILURES / ${pass} pass`)
process.exit(fail === 0 ? 0 : 1)
