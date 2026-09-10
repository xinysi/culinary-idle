// 二期扩充 + 新增功能专项测试（竞技场随机/奥义/食灵/赛季任务点/新锻造装备/数值安全/公会/肥料/奖励/签到/强化/装饰）
// 运行：node scripts/ci/system_test2.mjs
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getSkillInstance } from '../../src/game/skills/registry.js'
import { generateArenaOpponents } from '../../src/game/data/arena.js'
import { AOJIS } from '../../src/game/data/aojis.js'
import { SPIRITS } from '../../src/game/data/spiritTiers.js'
import { SEASONS, getSeason, activeSeasonId } from '../../src/game/data/seasons.js'
import { ITEMS } from '../../src/game/data/items.js'
import { COMBAT_BOSSES, COMBAT_REGIONS } from '../../src/game/data/combat.js'
import { totalXpForLevel } from '../../src/game/core/Experience.js'
import { getAllSkillInstances } from '../../src/game/skills/registry.js'
import { GUILDS, GUILD_SHOP } from '../../src/game/data/guilds.js'
import { ITEMS as _ } from '../../src/game/data/items.js'

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

// ── 竞技场随机生成 ──
console.log('══ W. 竞技场 ══')
{
  const a = generateArenaOpponents(50)
  check('竞技场：10 名对手', a.length === 10)
  check('竞技场：名字不重复', new Set(a.map((o) => o.name)).size === 10, a.map((o) => o.name).join(','))
  check('竞技场：排名 1-10 且按等级降序', a.every((o, i) => o.rank === i + 1) && a.every((o, i) => i === 0 || a[i - 1].level >= o.level), a.map((o) => `${o.name}L${o.level}`).join(','))
  check('竞技场：数值随机微调且有限', a.every((o) => Number.isFinite(o.hp) && Number.isFinite(o.atk) && Number.isFinite(o.def) && o.hp > 0))
  // 随机性：两次生成应不同
  const b = generateArenaOpponents(50)
  check('竞技场：两次生成结果不同（随机）', JSON.stringify(a.map((o) => o.hp)) !== JSON.stringify(b.map((o) => o.hp)))
  // 强度随等级提升
  const low = generateArenaOpponents(10)
  const high = generateArenaOpponents(80)
  check('竞技场：对手强度随对决等级提升', high[0].level > low[0].level, `low=${low[0].level} high=${high[0].level}`)
  // isPvp 标记（战绩结算依赖）
  check('竞技场：isPvp 标记齐全', a.every((o) => o.isPvp === true))
}

// ── 公会扩展（20 家/需求/buff/商店 20）──
console.log('══ W3. 公会扩展 ══')
{
  check('公会：共 20 家', GUILDS.length === 20, `n=${GUILDS.length}`)
  check('公会：初始 3 家无要求', GUILDS.slice(0, 3).every((g) => !g.requirements))
  check('公会：17 家均有要求且类型齐全', GUILDS.slice(3).every((g) => g.requirements) && ['战斗', '采集', '制作', '辅助'].every((t) => GUILDS.slice(3).some((g) => g.type === t)))
  check('公会：战斗型需求对决等级递增 + buff 递增', (() => {
    const combats = GUILDS.filter((g) => g.type === '战斗').map((g) => [g.requirements?.combatLevel ?? 0, g.passive.dmgPct])
    return combats.every(([l, b], i) => i === 0 || (combats[i - 1][0] < l && combats[i - 1][1] < b))
  })())
  check('公会：公会 id 唯一', new Set(GUILDS.map((g) => g.id)).size === 20)
  // 加入需求校验
  const p = freshPlayer()
  check('公会：低等级加入战斗公会被拒', p.joinGuild('battleAxe') === false)
  // 加入公会要付金币（无要求公会 500 / 有要求按 requirements.gold）——新档只有 100 金币，先补足
  p.gold = 5000
  check('公会：初始公会无需求可加入', p.joinGuild('flame') === true)
  p.leaveGuild()
  for (const id of ['foraging', 'fishing', 'hunting', 'excavation', 'farming']) p.setSkillState(id, { level: 20, exp: totalXpForLevel(20) })
  check('公会：采集总等级 100 满足丰收麦田（需 50）', p.gatherLevels >= 50 && p.joinGuild('harvestField') === true)
  p.leaveGuild()
  // 制作成功率 buff
  const p2 = freshPlayer({ cooking: 30 })
  p2.gold = 5000 // 入会要付金币，新档只有 100
  p2.joinGuild('dessert')
  const cooking = getSkillInstance('cooking')
  const recipe = cooking.recipes.find((r) => r.id === 'roastPotato')
  // 注意：等级差加成会把基础成功率顶到 0.98 封顶，此时 +5% 看不出来。
  // 这里把技能等级压到配方同级的「无等级差」状态，保证有 5% 的余量可观测。
  p2.setSkillState('cooking', { level: recipe.reqLevel, exp: 0 })
  const base = Math.min(recipe.successChance, 0.98)
  const buffed = cooking.successChance(recipe)
  check('公会：制作型 buff 提升成功率 5%', Math.abs(buffed - base - 0.05) < 1e-9, `base=${base} buffed=${buffed}`)
  // 辅助型公会「全技能经验」为数值型 xpPct（2026-09-09 修复：此前按对象下标取值，恒为 0）
  {
    const p3 = freshPlayer({ foraging: 50 })
    const b0 = p3.skills.foraging.exp
    getSkillInstance('foraging').addCardXp(100, 1)
    const noGuild = p3.skills.foraging.exp - b0
    p3.guild = { id: 'sageKitchen', points: 0, day: null, taskProgress: {} } // 辅助型：全技能经验 +9%
    const b1 = p3.skills.foraging.exp
    getSkillInstance('foraging').addCardXp(100, 1)
    const withGuild = p3.skills.foraging.exp - b1
    check('公会：辅助型公会全技能经验 +9% 生效（数值型 xpPct）', Math.abs(withGuild - noGuild * 1.09) < 1, `无公会=${noGuild} 有公会=${withGuild}`)
  }
  // 商店 20 项全部有效
  check('公会商店 24 种且物品全部存在', GUILD_SHOP.length === 24 && GUILD_SHOP.every((s) => !!ITEMS[s.itemId] && s.price > 0), GUILD_SHOP.filter((s) => !ITEMS[s.itemId]).map((s) => s.itemId).join(','))
}

// ── 挂机任务关闭（停止并隐藏，§3.1）──
console.log('══ W2. 挂机关闭 ══')
{
  const p = freshPlayer()
  const fishing = getSkillInstance('fishing')
  p.setSkillTarget('fishing', 'crucian')
  check('关闭：关闭前任务在运行列表', p.getRunningIdleSkills().some((i) => i.id === 'fishing'))
  p.closeIdleTask('fishing')
  check('关闭：关闭 = 暂停 + 隐藏标记', p.isSkillPaused('fishing') === true && p.closedIdleTasks.fishing === true)
  check('关闭：关闭后从运行列表移除', !p.getRunningIdleSkills().some((i) => i.id === 'fishing'))
  // 继续 = 恢复显示
  p.setSkillPaused('fishing', false)
  check('关闭：继续后恢复显示', p.closedIdleTasks.fishing === undefined && p.getRunningIdleSkills().some((i) => i.id === 'fishing'))
  // 重选目标恢复显示
  p.closeIdleTask('fishing')
  p.reopenIdleTask('fishing')
  check('关闭：重选目标恢复显示', p.closedIdleTasks.fishing === undefined)
  // 关闭后不产出（tick 验证）
  const p2 = freshPlayer()
  p2.setSkillTarget('fishing', 'crucian')
  p2.closeIdleTask('fishing')
  const f2 = getSkillInstance('fishing')
  withRandom2(() => p2.tick(10_000))
  check('关闭：关闭后不产出', f2.actionsDone === 0 && (p2.inventory.crucian ?? 0) === 0)
  // 存档往返
  const s = JSON.stringify(p2.serialize())
  const p3 = freshPlayer()
  p3.applySave(JSON.parse(s))
  check('关闭：关闭状态随存档保存', p3.closedIdleTasks.fishing === true && p3.isSkillPaused('fishing'))
}
function withRandom2(fn) {
  const real = Math.random
  Math.random = () => 0.5
  try { return fn() } finally { Math.random = real }
}

// ── 农耕肥料（§3.1.5）──
console.log('══ W4. 农耕肥料 ══')
{
  check('肥料：堆肥/肥沃堆肥物品存在', !!ITEMS.compost && !!ITEMS.richCompost)
  const p = freshPlayer({ farming: 40, preservation: 40 })
  const farm = getSkillInstance('farming')
  const pres = getSkillInstance('preservation')
  check('肥料：保鲜配方含堆肥/肥沃堆肥', pres.recipes.some((r) => r.id === 'compost') && pres.recipes.some((r) => r.id === 'richCompost'))
  // 种植小麦 → 施肥
  p.inventory.wheatSeed = 5
  p.inventory.compost = 3
  p.inventory.richCompost = 2
  check('肥料：种下小麦', farm.plant(0, 'wheatSeed') === true)
  check('肥料：未施肥枯萎概率 3%', Math.abs(farm.witherChance(0) - 0.03) < 1e-9)
  check('肥料：施堆肥成功（消耗 1 个）', farm.fertilize(0, 'compost') === true && p.inventory.compost === 2)
  check('肥料：堆肥后枯萎概率 1%', Math.abs(farm.witherChance(0) - 0.01) < 1e-9, `w=${farm.witherChance(0)}`)
  check('肥料：地块施肥状态持久', farm.plotAt(0).fertilizer === 'compost')
  // 换沃肥（覆盖）
  check('肥料：施沃肥覆盖堆肥', farm.fertilize(0, 'richCompost') === true && p.inventory.richCompost === 1)
  check('肥料：沃肥后枯萎概率 0%', farm.witherChance(0) === 0)
  // 成熟后施肥被拒
  p.setPlot(1, { seedId: 'wheatSeed', plantedAt: Date.now() - 200_000 })
  check('肥料：成熟后施肥被拒', farm.fertilize(1, 'compost') === false)
  // 沃肥收获 +1（无随机扰动：qty = 1 + 0 + 1 = 2）
  // 地块 0 是刚种下的，未成熟 → 收割会失败。这里回拨种植时间使其成熟（与地块 1 的写法一致）
  p.setPlot(0, { seedId: 'wheatSeed', plantedAt: Date.now() - 200_000, fertilizer: 'richCompost' })
  withRandom2(() => {
    const before = p.inventory.wheat ?? 0
    check('肥料：沃肥收获数量 +1', farm.harvest(0) === true && (p.inventory.wheat ?? 0) - before === 2, `wheat ${before}→${p.inventory.wheat}`)
  })
  // 商店售卖
  const { SHOP_ITEMS } = await import('../../src/game/data/shop.js')
  check('肥料：商店可买堆肥/肥沃堆肥', SHOP_ITEMS.some((s) => s.itemId === 'compost') && SHOP_ITEMS.some((s) => s.itemId === 'richCompost'))
  // 枯萎单次判定：成熟后 100 帧只掷一次（random=0.05 > 3% 不枯萎），防止每帧重复判定 100% 枯萎
  const p5 = freshPlayer({ farming: 20 })
  const farm5 = getSkillInstance('farming')
  p5.inventory.wheatSeed = 2
  farm5.plant(0, 'wheatSeed')
  p5.setPlot(0, { seedId: 'wheatSeed', plantedAt: Date.now() - 200_000 }) // 已成熟
  const realRandom = Math.random
  Math.random = () => 0.05 // 单次 5% > 3% → 不枯萎；修复前每帧 5% → 100 帧必枯萎
  for (let i = 0; i < 100; i++) farm5.tick(16)
  Math.random = realRandom
  check('肥料：成熟后多次 tick 只判定一次枯萎（不 100% 枯萎）', !farm5.plotAt(0)?.withered, JSON.stringify(farm5.plotAt(0)))
}

// ── 竞技场奖励（每 5 连胜宝箱 + 破纪录奖励）──
console.log('══ W5. 竞技场奖励 ══')
{
  const p = freshPlayer()
  const gold0 = p.gold
  // 5 连胜 → 宝箱（100×1 金 + 神秘调料）
  // 每场用不同对手名：onArenaEnd 有 300ms 幂等保护（同名同结果同等级会跳过）
  let r = null
  for (let i = 1; i <= 5; i++) r = p.onArenaEnd(true, '镜像A' + i, 30)
  // 5 连胜当次：宝箱 100 金（档位1 ×100）+ 破纪录 200 金 → 合并为 300 金
  check('奖励：5 连胜宝箱（宝箱100 + 破纪录200 = 300 金 + 神秘调料）', r?.kind === 'streak' && r.gold === 300 && r.record === true && (p.inventory.mysterySpice ?? 0) === 1, JSON.stringify(r))
  // 3 连胜破纪录（新档）：200 金 + 能量饼干
  const p2 = freshPlayer()
  const g2 = p2.gold
  let r2 = null
  for (let i = 1; i <= 3; i++) r2 = p2.onArenaEnd(true, '镜像B' + i, 25)
  check('奖励：3 连胜破纪录（+200 金 + 能量饼干）', r2?.kind === 'record' && r2.gold === 200 && (p2.inventory.energyBiscuit ?? 0) === 1 && p2.gold === g2 + 200, JSON.stringify(r2))
  // 10 连胜：宝箱含能量饼干（tier2）
  const p3 = freshPlayer()
  p3.stats.arena = { wins: 0, currentStreak: 0, bestStreak: 0, records: [] }
  let r3 = null
  for (let i = 1; i <= 10; i++) r3 = p3.onArenaEnd(true, '镜像C' + i, 40)
  // 10 连胜当次：宝箱 200 金（档位2 ×100）+ 破纪录 200 金 = 400 金；10 连起宝箱额外给能量饼干
  check('奖励：10 连胜宝箱含能量饼干', r3?.kind === 'streak' && r3.gold === 400 && (p3.inventory.energyBiscuit ?? 0) >= 1, JSON.stringify(r3))
  // 战败重置连胜且无奖励
  const p4 = freshPlayer()
  for (let i = 1; i <= 4; i++) p4.onArenaEnd(true, '镜像D', 20)
  const r4 = p4.onArenaEnd(false, '镜像E', 20)
  check('奖励：战败重置连胜且无奖励', r4 === null && p4.stats.arena.currentStreak === 0)
}

// ── 新功能（§13）：签到/强化/装饰/败场统计/红点 ──
console.log('══ W6. 新功能 ══')
{
  // 签到：连续 7 天循环
  const p = freshPlayer()
  const r1 = p.signInToday()
  // 签到金币 = goldBase + 对决等级×2（新档对决 Lv1 → 100 + 2 = 102），不是固定 100
  check('签到：第 1 天签到 +102 金（100 基准 + Lv1×2）', r1.ok && r1.day === 1 && r1.reward.gold === 102 && p.gold === 202, JSON.stringify(r1))
  check('签到：同日重复签到被拒', p.signInToday().ok === false)
  // 模拟次日连续签到（直接改 lastDate）
  p.signIn = { lastDate: new Date(Date.now() - 86400000).toLocaleDateString('en-CA'), day: 1 }
  const r2 = p.signInToday()
  check('签到：连续第 2 天（神秘调料）', r2.ok && r2.day === 2 && (p.inventory.mysterySpice ?? 0) === 1)
  // 漏签重置
  p.signIn = { lastDate: new Date(Date.now() - 3 * 86400000).toLocaleDateString('en-CA'), day: 6 }
  const r3 = p.signInToday()
  check('签到：漏签重置为第 1 天', r3.ok && r3.day === 1)
  // 7 天循环：第 7 天后回第 1 天
  p.signIn = { lastDate: new Date(Date.now() - 86400000).toLocaleDateString('en-CA'), day: 7 }
  const r7 = p.signInToday()
  check('签到：第 7 天后循环回第 1 天', r7.ok && r7.day === 1)

  // 装备强化
  const p2 = freshPlayer()
  p2.inventory.copperKnife = 1
  p2.inventory.ironOre = 5
  p2.inventory.saltOre = 5
  p2.gold = 100000
  p2.equip('copperKnife')
  const base = p2.equippedStats.attack
  const up = p2.upgradeItem('copperKnife')
  check('强化：强化成功到 +1', up.ok && up.level === 1 && p2.upgrades.copperKnife === 1, JSON.stringify(up))
  check('强化：强化后属性 +10%', Math.abs(p2.equippedStats.attack - base * 1.1) < 0.6, `base=${base} now=${p2.equippedStats.attack}`)
  check('强化：金币不足被拒', (() => {
    const p3 = freshPlayer()
    p3.inventory.copperKnife = 1
    p3.equip('copperKnife')
    return p3.upgradeItem('copperKnife').ok === false
  })())

  // 餐厅装饰收入加成
  const p5 = freshPlayer()
  p5.gold = 100000
  p5.setRestaurantMenu(0, 'roastPotato')
  const inc0 = p5.restaurantHourlyIncome
  p5.restaurant.decor = ['decor_candle', 'decor_table']
  const inc1 = p5.restaurantHourlyIncome
  check('装饰：2 个装饰收入 +6%', Math.abs(inc1 - inc0 * 1.06) < 0.01, `inc0=${inc0} inc1=${inc1}`)

  // 败场统计
  const p6 = freshPlayer()
  p6.onCombatLose()
  check('统计：败场计数', (p6.stats.combatLosses ?? 0) === 1)

  // 红点状态
  const p7 = freshPlayer()
  check('红点：未签到时可签', p7.canSignInToday() === true)
  p7.signInToday()
  check('红点：签到后不可再签', p7.canSignInToday() === false)
  // 存档往返：signIn/upgrades/decor 持久化
  const p8 = freshPlayer()
  p8.signInToday()
  p8.upgrades = { copperKnife: 2 }
  p8.restaurant.decor = ['decor_candle']
  const s8 = JSON.parse(JSON.stringify(p8.serialize()))
  const p9 = freshPlayer()
  p9.applySave(s8)
  check('存档：签到状态随存档保存（刷新后不可再签）', p9.canSignInToday() === false && p9.signIn?.day === 1)
  check('存档：强化/装饰随存档保存', p9.upgrades.copperKnife === 2 && p9.restaurant.decor.includes('decor_candle'))
}

// ── 二期奥义/食灵效果键兼容 ──
console.log('══ X. 奥义/食灵 ══')
{
  const p = freshPlayer()
  check('奥义：28 个奥义结构完整（id/name/costPerSec/effect）', AOJIS.every((a) => typeof a === 'object' && a.id && a.name && Number.isFinite(a.costPerSec) && typeof a.effect === 'object'), AOJIS.filter((a) => !(a && a.id && a.name && Number.isFinite(a.costPerSec))).map((a) => a?.id ?? '非对象').join(','))
  check('奥义：28 个奥义效果键均为支持的键', AOJIS.every((a) => {
    const e = a.effect ?? {}
    const supported = new Set(['dmgPct', 'styleDmgPct', 'defensePct', 'speedPct', 'maxHpBonus', 'yieldPct', 'xpPct', 'healPct'])
    return Object.keys(e).every((k) => supported.has(k))
  }), AOJIS.filter((a) => Object.keys(a.effect ?? {}).some((k) => !['dmgPct', 'styleDmgPct', 'defensePct', 'speedPct', 'maxHpBonus', 'yieldPct', 'xpPct', 'healPct'].includes(k))).map((a) => a.id).join(','))
  check('食灵：32 个食灵结构完整（id/name/effect/level）', SPIRITS.every((s) => s && s.id && s.name && typeof s.effect === 'object'), SPIRITS.filter((s) => !(s && s.id && s.name)).map((s) => s?.id ?? '非对象').join(','))
  check('食灵：32 个食灵效果键均为支持的键', SPIRITS.every((s) => {
    const sup = new Set(['xpPct', 'styleDmgPct', 'dmgPct', 'healPerTurnPct', 'loseHpPerTurnPct', 'fishingAccPct', 'farmYieldBonus'])
    return Object.keys(s.effect ?? {}).every((k) => sup.has(k))
  }), SPIRITS.filter((s) => Object.keys(s.effect ?? {}).some((k) => !['xpPct', 'styleDmgPct', 'dmgPct', 'healPerTurnPct', 'loseHpPerTurnPct', 'fishingAccPct', 'farmYieldBonus'].includes(k))).map((s) => s.id).join(','))
}

// ── 二期赛季闭环（任务点→奖励领取→存档）──
console.log('══ Y. 二期赛季 ══')
{
  const p = freshPlayer()
  const season = p.activeSeasonDef
  check('赛季：活跃赛季存在', !!season?.id)
  check('赛季：赛季任务点数为正', (season?.missions ?? []).every((m) => m.points > 0))
  p.bumpSeason('gather', 'apple')
  const st = p.seasonState()
  check('赛季：赛季状态初始化', typeof st.missionProgress === 'object' && Array.isArray(st.claimed))
  // 补足点数后领取
  st.points = 99999
  const ok = p.seasonClaimTier(0)
  check('赛季：奖励领取成功', ok === true)
  // 赛季目标物品存在
  for (const m of season?.missions ?? []) {
    if (m.param && !['any'].includes(m.param)) {
      check(`赛季：任务目标 ${m.param} 存在`, !!ITEMS[m.param] || COMBAT_BOSSES.some((b) => b.name === m.param))
    }
  }
}

// ── 二期装备（扩充锻造产物引用/槽位/品质）──
console.log('══ Z. 二期装备 ══')
{
  const p = freshPlayer({ craftsmithing: 99 })
  const smith = getSkillInstance('craftsmithing')
  check('装备：锻造食谱材料均存在', smith.recipes.every((r) => Object.keys(r.ingredients).every((k) => !!ITEMS[k])))
  check('装备：锻造产物均存在于物品库', smith.recipes.every((r) => !!ITEMS[r.output.itemId]))
  const eq = smith.recipes.filter((r) => ITEMS[r.output.itemId]?.type === 'equipment')
  check('装备：装备产物槽位合法', eq.every((r) => ['weapon', 'offhand', 'body', 'helmet', 'amulet', 'ring', 'legs', 'boots'].includes(ITEMS[r.output.itemId].slot)))
}

// ── 全域数值安全（新增内容）──
console.log('══ AA. 全域数值安全 ══')
{
  const p = freshPlayer()
  check('安全：强化费用有限', Number.isFinite(p.upgradeCost('copperKnife')?.gold))
  check('安全：非装备强化返回 null', p.upgradeCost('apple') === null)
  // 注意：增益剂物品 id 带档位后缀（xpTonic1~5 / yieldTonic1~5），没有裸的 xpTonic
  check('安全：签到奖励引用物品存在', ['mysterySpice', 'energyBiscuit', 'xpTonic1', 'xpTonic5', 'yieldTonic1', 'yieldTonic5'].every((id) => !!ITEMS[id]))
  check('安全：炼金产物引用物品存在', ['carrot', 'tomato', 'strawberry', 'grape', 'pineapple', 'mango', 'durian', 'matsutake', 'truffle', 'ironOre', 'pumpkin', 'mysterySpice', 'spiritFruit'].every((id) => !!ITEMS[id]))
}

console.log(fail === 0 ? `\nALL PASS (${pass})` : `\n${fail} FAILURES / ${pass} pass`)
process.exit(fail === 0 ? 0 : 1)
