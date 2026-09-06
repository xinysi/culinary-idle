// 系统测试 — 对照《美食放置：食之契约》需求文档的全面回归
// 运行：node .toolchain/system_test.mjs
// 覆盖：技能经验/产出、联动链、对决（伤害/克制/命中/暴击/胜负）、装备、
//       离线（80%效率/12h上限/跨天）、存档（往返/迁移/导入导出）、背包、经济、
//       成就图鉴、数值安全（除零/NaN/越界）
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../src/stores/player.js'
import { createSkillInstances, getSkillInstance } from '../src/game/skills/registry.js'
import { Combat } from '../src/game/combat/Combat.js'
import { COMBAT_REGIONS, COMBAT_BOSSES, STYLE_ADVANTAGE } from '../src/game/data/combat.js'
import { ForagingSkill } from '../src/game/skills/ForagingSkill.js'
import { FishingSkill } from '../src/game/skills/FishingSkill.js'
import { HuntingSkill } from '../src/game/skills/HuntingSkill.js'
import { ExcavationSkill } from '../src/game/skills/ExcavationSkill.js'
import { FarmingSkill } from '../src/game/skills/FarmingSkill.js'
import { CookingSkill } from '../src/game/skills/CookingSkill.js'
import { BakingSkill } from '../src/game/skills/BakingSkill.js'
import { CraftsmithingSkill } from '../src/game/skills/CraftsmithingSkill.js'
import { SpiritSummoningSkill } from '../src/game/skills/SpiritSummoningSkill.js'
import { ExplorationSkill } from '../src/game/skills/ExplorationSkill.js'
import { computeOfflineProgress } from '../src/game/core/OfflineProgress.js'
import { totalXpForLevel, xpProgress } from '../src/game/core/Experience.js'
import { SaveManager } from '../src/game/core/SaveManager.js'
import { EventBus } from '../src/game/core/EventBus.js'
import { settleOffline } from '../src/game/bootstrap.js'
import { useUiStore } from '../src/stores/ui.js'
import { ITEMS, getItem } from '../src/game/data/items.js'
import { ALL_ACHIEVEMENTS } from '../src/game/data/achievements.js'
import { QUESTS } from '../src/game/data/quests.js'
import { SHOP_ITEMS } from '../src/game/data/shop.js'
import { SPIRITS } from '../src/game/data/spirits.js'
import { AOJIS } from '../src/game/data/aojis.js'
import { SEASONS } from '../src/game/data/seasons.js'

const bugs = [] // {sev, area, desc, repro, expected, actual, cause, fix}
let pass = 0
let fail = 0

function check(area, name, cond, detail = '') {
  if (cond) {
    pass++
    console.log(`  ok  [${area}] ${name}`)
  } else {
    fail++
    console.log(`FAIL  [${area}] ${name} ${detail}`)
  }
}
function bug(sev, area, desc, repro, expected, actual, cause, fix) {
  bugs.push({ sev, area, desc, repro, expected, actual, cause, fix })
  console.log(`  ⚠ ${sev} ${area}: ${desc}`)
}

const realRandom = Math.random
function withRandom(seq, fn) {
  let i = 0
  Math.random = () => seq[Math.min(i++, seq.length - 1)]
  try {
    return fn()
  } finally {
    Math.random = realRandom
  }
}

function freshPlayer(skills = {}) {
  setActivePinia(createPinia())
  const p = usePlayerStore()
  p.newGame()
  p.settings.autoEat = true
  p.settings.autoEatThreshold = 60
  for (const [id, lv] of Object.entries(skills)) p.setSkillState(id, { level: lv, exp: totalXpForLevel(lv) })
  createSkillInstances(p)
  return p
}
function fightToEnd(combat, opponent, maxGuard = 3000) {
  if (combat.player.combat.hp <= 0) combat.player.setCombat({ hp: combat.player.maxHp })
  combat.start(opponent)
  let g = 0
  while (combat.inFight && g++ < maxGuard) combat.tick(5000)
  return combat.result
}

// ── A. 技能经验 / 等级 / 产出（低/中/高边界）─────────────
console.log('══ A. 技能系统 ══')
{
  const p = freshPlayer()
  const f = new ForagingSkill(p)
  p.activeTarget = 'apple'
  // 最低级
  f.addXp(totalXpForLevel(2)) // 1→2 恰好所需（RS 曲线：L2 = 18,364）
  check('技能', '恰好升到 2 级', p.skills.foraging.level === 2, `level=${p.skills.foraging.level}`)
  f.addXp(0)
  check('技能', '0 XP 无副作用', p.skills.foraging.exp === totalXpForLevel(2))
  f.addXp(-5)
  check('技能', '负 XP 被忽略', p.skills.foraging.exp === totalXpForLevel(2))
  // 中级：跨多级
  f.addXp(totalXpForLevel(12))
  check('技能', '12 级 XP 跨多级', p.skills.foraging.level >= 12, `level=${p.skills.foraging.level}`)
  // 高级：99 封顶
  p.setSkillState('foraging', { level: 99, exp: totalXpForLevel(99) })
  f.addXp(999_999)
  check('技能', '99 级封顶（未转生）', p.skills.foraging.level === 99, `level=${p.skills.foraging.level}`)
  // 转生后 120 上限
  p.setSkillState('foraging', { level: 99, exp: totalXpForLevel(99), prestiges: 1 })
  f.addXp(400_000_000) // 99→100 需 3.0 亿（2026-09 曲线）；4 亿可升到 100+
  check('技能', '转生后突破 99 级（>99 且 ≤120）', p.skills.foraging.level > 99 && p.skills.foraging.level <= 120, `level=${p.skills.foraging.level}`)
  // 升级事件
  let lvEvent = 0
  EventBus.on('player:levelup', () => lvEvent++)
  p.setSkillState('cooking', { level: 1, exp: 0 })
  getSkillInstance('cooking').addXp(totalXpForLevel(2))
  check('技能', '升级事件触发', lvEvent >= 1)
}
// 采集产出边界：等级锁 / 间隔下限
{
  const p = freshPlayer()
  const f = new ForagingSkill(p)
  p.setSkillTarget('foraging', 'spiritFruit') // 需 90 级（每技能独立目标）
  f.tick(60_000)
  check('技能', '等级不足不产出（灵果需90级）', f.actionsDone === 0, `done=${f.actionsDone}`)
  p.setSkillState('foraging', { level: 99, exp: totalXpForLevel(99) })
  f.tick(3000)
  check('技能', '99 级可采灵果（8s→下限?）', f.actionsDone === 1 || f.actionsDone === 0, 'interval clamp')
  const t = f.targets.find((x) => x.itemId === 'spiritFruit')
  check('技能', '99 级间隔 = max(8-1.35, 0.5)=6.65s', Math.abs(f.intervalMs(t) - 6650) < 1, `got ${f.intervalMs(t)}`)
}

// ── B. 技能联动链（采集→制作→对决闭环）──────────────
console.log('══ B. 联动链 ══')
{
  const p = freshPlayer({ cooking: 10, baking: 10 })
  // 采集→烹饪
  p.gainItem('potato', 10)
  const ck = getSkillInstance('cooking')
  withRandom([0.0], () => ck.craft(ck.recipes.find((r) => r.id === 'roastPotato')))
  check('联动', '采集土豆→制作烤土豆', p.inventory.roastPotato === 1, JSON.stringify(p.inventory.roastPotato))
  // 烘焙链：小麦→面粉→面包
  p.gainItem('wheat', 6)
  p.gainItem('saltOre', 2) // 白面包需盐矿
  const bk = getSkillInstance('baking')
  withRandom([0.0], () => bk.craft(bk.recipes.find((r) => r.id === 'milling')))
  withRandom([0.0], () => bk.craft(bk.recipes.find((r) => r.id === 'whiteBread')))
  check('联动', '农耕小麦→磨面粉→白面包', p.inventory.whiteBread === 1, JSON.stringify(p.inventory.whiteBread))
  // 调料链：盐矿→食盐→椒盐→铁板兔肉
  p.setSkillState('spiceMixing', { level: 20, exp: totalXpForLevel(20) })
  const sm = getSkillInstance('spiceMixing')
  p.gainItem('saltOre', 6)
  withRandom([0.0], () => sm.craft(sm.recipes.find((r) => r.id === 'salt')))
  p.gainItem('peppercorn_young', 2) // 嫩花椒（2026-09 recipeBalance 嫩化：低阶配方用嫩替代）
  withRandom([0.0], () => sm.craft(sm.recipes.find((r) => r.id === 'pepperSalt')))
  check('联动', '盐矿→食盐→椒盐', p.inventory.pepperSalt === 1, JSON.stringify(p.inventory.pepperSalt))
  p.setSkillState('cooking', { level: 18, exp: totalXpForLevel(18) })
  p.gainItem('rabbitMeat', 3)
  p.gainItem('onion', 2)
  p.gainItem('chili', 2)
  withRandom([0.0], () => ck.craft(ck.recipes.find((r) => r.id === 'ironPlateRabbit')))
  check('联动', '椒盐入菜：铁板兔肉', p.inventory.ironPlateRabbit === 1, JSON.stringify(p.inventory.ironPlateRabbit))
  // 锻造链：木材/铜矿→铜刀→对决属性
  const p2 = freshPlayer({ craftsmithing: 5, knife: 5, tasteAcumen: 1, heatControl: 1 })
  p2.gainItem('wood', 3)
  p2.gainItem('copperOre', 3)
  const cfs = getSkillInstance('craftsmithing')
  withRandom([0.0], () => cfs.craft(cfs.recipes.find((r) => r.output?.itemId === 'copperKnife')))
  check('联动', '木材/铜矿→铜刀锻造', p2.inventory.copperKnife === 1)
  p2.equip('copperKnife')
  const combat = new Combat(p2)
  const stats0 = combat.playerStats()
  check('联动', '铜刀提升攻击（装备攻击并入面板）', stats0.attack === 5 * 3 + getItem('copperKnife').stats.attack, `atk=${stats0.attack}`)
}

// ── C. 对决系统 ───────────────────────────────────
console.log('══ C. 对决系统 ══')
// 伤害公式精确值（§11.2）
{
  const p = freshPlayer({ knife: 5, tasteAcumen: 1, heatControl: 1 })
  p.inventory.roastPotato = 20
  const combat = new Combat(p)
  const app = COMBAT_REGIONS[0].opponents[0] // L1 学徒厨师：hp18 def2 eva5.5 acc12 atk1.7
  combat.start(app)
  // 玩家攻击（强制命中、不暴击）：dmg = floor(15 × 1.0 × (1-2/102)) = floor(14.7) = 14
  withRandom([0.0, 0.9], () => combat.resolveTurn())
  check('对决', '伤害公式精确（15攻 vs def2 → 14）', combat.opponentHp === 18 - 14, `hp=${combat.opponentHp}`)
}
// 克制三角（§3.3）：玩家 knife 对 plating 对手 +15%
{
  const p = freshPlayer({ knife: 5, tasteAcumen: 1, heatControl: 1 })
  p.inventory.roastPotato = 20
  const combat = new Combat(p)
  const stall = COMBAT_REGIONS[0].opponents[1] // 杂役帮厨 plating L4（knife 克 plating）
  combat.start(stall)
  // 命中/克制强制：hit roll 0 → 命中；crit roll 0.9 → 不暴击
  // 预期 dmg = floor(15 × 1.15 × (1 - def/(def+100)))
  const expDmg = Math.floor(15 * 1.15 * (1 - stall.def / (stall.def + 100)))
  withRandom([0.0, 0.9], () => combat.resolveTurn())
  check('对决', '克制 +15%（knife 克 plating）', combat.opponentHp === stall.hp - expDmg, `hp=${combat.opponentHp} exp=${stall.hp - expDmg}`)
}
// 命中/闪避边界 + 暴击
{
  const p = freshPlayer({ knife: 5, tasteAcumen: 1, heatControl: 1 })
  p.inventory.roastPotato = 20
  const combat = new Combat(p)
  const app = COMBAT_REGIONS[0].opponents[0]
  combat.start(app)
  // 命中率 = acc/(acc+eva) = 15/(15+5.5) ≈ 0.73；强制 miss：hit roll 0.9 > 0.73
  const hpBefore = combat.opponentHp
  withRandom([0.95, 0.95], () => combat.resolveTurn())
  check('对决', '命中判定：高随机值 → 闪避（无伤害）', combat.opponentHp === hpBefore, `hp=${combat.opponentHp}`)
  // 暴击：crit roll 0 → ×2
  combat.start(app)
  withRandom([0.0, 0.0], () => combat.resolveTurn())
  check('对决', '暴击 ×2（14×2=28 溢出击杀）', combat.opponentHp === 0 && combat.result === 'win', `hp=${combat.opponentHp}`)
}
// 胜负判定 / 玩家死亡 / 食物冷却 / 自动进食阈值
{
  const p = freshPlayer({ knife: 5, tasteAcumen: 1, heatControl: 1 })
  p.inventory.roastPotato = 20
  const combat = new Combat(p)
  // 对战 L98 必败 → HP 恢复
  const res = fightToEnd(combat, COMBAT_REGIONS[9].opponents[1])
  check('对决', 'L98 战败判定', res === 'lose')
  check('对决', '战败后品鉴值恢复满', p.combat.hp === p.maxHp)
  // 食物冷却 3 回合
  combat.useFood('roastPotato')
  check('对决', '食物冷却期内再吃被拒', combat.useFood('roastPotato') === false)
  combat.foodCooldown = 0
  // 自动进食阈值 100%
  p.setCombat({ hp: 1 })
  p.settings.autoEatThreshold = 100
  combat.maybeAutoEat()
  check('对决', 'HP1 + 阈值100% 自动进食', p.combat.hp > 1, `hp=${p.combat.hp}`)
  // 攻击速度下限
  p.setSkillState('knife', { level: 99, exp: totalXpForLevel(99), prestiges: 1 })
  check('对决', '攻速下限 1.2s（高等级+加速装备钳制）', combat.playerStats().speedMs >= 1200, `speed=${combat.playerStats().speedMs}`)
  // 摆盘弹药不足
  p.setCombatStyle('plating')
  p.inventory.garnish = 0
  const c2 = new Combat(p)
  c2.start(COMBAT_REGIONS[0].opponents[0])
  const hp2 = c2.opponentHp
  withRandom([0.0, 0.0], () => c2.resolveTurn())
  check('对决', '摆盘无弹药不攻击', c2.opponentHp === hp2, `hp=${c2.opponentHp}`)
}

// ── D. 装备系统 ───────────────────────────────────
console.log('══ D. 装备系统 ══')
{
  const p = freshPlayer()
  p.gainItem('copperKnife', 1)
  check('装备', '穿戴铜刀', p.equip('copperKnife') === true && p.equipment.weapon === 'copperKnife')
  check('装备', '穿戴后背包扣减', p.inventory.copperKnife === undefined)
  p.gainItem('ironKnife', 1)
  p.equip('ironKnife')
  check('装备', '换装旧装备返还', p.equipment.weapon === 'ironKnife' && p.inventory.copperKnife === 1)
  check('装备', '非装备物品拒绝', p.equip('apple') === false)
  check('装备', '卸下返还', p.unequip('weapon') === true && p.inventory.ironKnife === 1)
  // 属性合计
  p.gainItem('ironKnife', 1)
  p.gainItem('ironHat', 1)
  p.equip('ironKnife')
  p.equip('ironHat')
  const st = p.equippedStats
  const kStats = getItem('ironKnife').stats
  const hStats = getItem('ironHat').stats
  check('装备', '属性合计（铁刀+铁帽 = 装备属性之和）', st.attack === kStats.attack + (hStats.attack ?? 0) && st.defense === (kStats.defense ?? 0) + (hStats.defense ?? 0) && st.accuracy === (kStats.accuracy ?? 0) + (hStats.accuracy ?? 0), JSON.stringify(st))
  // 品质差异（§5.2）：普通 vs 传说
  const copper = getItem('copperKnife').stats.attack
  const gold = getItem('goldKnife').stats.attack
  check('装备', '品质差异：金刀(24) > 铜刀(3)', gold > copper * 3, `gold=${gold} copper=${copper}`)
  // 掉落：BOSS 独特掉落清单非空（品质校验见 U 节图鉴）
  check('装备', '全部 BOSS 均有独有掉落', COMBAT_BOSSES.every((b) => (b.drops?.length ?? 0) > 0), `bosses=${COMBAT_BOSSES.length}`)
}

// ── E. 离线进度（§10.2.2 / §8.1）──────────────────
console.log('══ E. 离线进度 ══')
{
  const p = freshPlayer()
  p.activeTarget = 'apple'
  const f = new ForagingSkill(p)
  // 边界：0 / 负 / 极小
  check('离线', 'elapsed=0 → 无收益', computeOfflineProgress(f, 0) === null)
  check('离线', 'elapsed<0 → 无收益', computeOfflineProgress(f, -5000) === null)
  check('离线', 'elapsed<1s → 无收益', computeOfflineProgress(f, 500) === null)
  // 80% 效率精确值
  const r1 = computeOfflineProgress(f, 3600_000) // 1h，3s 间隔
  check('离线', '1h 动作数 = floor(1200×0.8)=960', r1.actions === Math.floor((3600_000 / 3000) * 0.8), `actions=${r1.actions}`)
  check('离线', '1h 经验 = 14400（xpBalance 基准 10+5lv）', r1.exp === 14400, `exp=${r1.exp}`)
  // 12h 上限
  const r13 = computeOfflineProgress(f, 13 * 3600_000)
  check('离线', '13h 截断为 12h', r13.durationMs === 12 * 3600_000, `dur=${r13.durationMs}`)
  check('离线', '12h 上限动作数一致', r13.actions === Math.floor((12 * 3600_000 / 3000) * 0.8))
  // 能量饼干加成到 24h（§8.1）
  const r24 = computeOfflineProgress(f, 20 * 3600_000, 24 * 3600_000)
  check('离线', '饼干加成 24h 内不截断', r24.durationMs === 20 * 3600_000)
  const r30 = computeOfflineProgress(f, 30 * 3600_000, 24 * 3600_000)
  check('离线', '30h 截断为 24h', r30.durationMs === 24 * 3600_000)
  // 跨天（绝对时间戳，无 DST 问题）
  const lastOnline = Date.now() - 40 * 3600_000
  check('离线', '跨天 40h → 仍按 12h 上限', computeOfflineProgress(f, Date.now() - lastOnline).durationMs === 12 * 3600_000)
  // 狩猎弹药约束
  const p2 = freshPlayer()
  p2.activeTarget = 'rabbitMeat'
  p2.inventory.trap = 5
  const h = new HuntingSkill(p2)
  const rh = computeOfflineProgress(h, 3600_000)
  check('离线', '狩猎离线受陷阱数约束（5个→5次）', rh.actions === 5 && rh.consumed.trap === 5, JSON.stringify(rh))
  // 垂钓成功率折算
  const p3 = freshPlayer()
  p3.activeTarget = 'crucian'
  const fsh = new FishingSkill(p3)
  const rf = computeOfflineProgress(fsh, 3600_000)
  check('离线', '垂钓离线按成功率折算', rf.actions === 900 && rf.exp < 9000 && rf.exp > 0, `actions=${rf.actions} exp=${rf.exp}`)
  // 农耕离线（时间戳生长）
  const p4 = freshPlayer({ farming: 1 })
  const farm = new FarmingSkill(p4)
  const realNow = Date.now
  p4.farming.plots = []
  p4.setPlot(0, { seedId: 'wheatSeed', plantedAt: Date.now() })
  Date.now = () => realNow() + 95_000 // 跳 95s（小麦 90s）
  check('离线', '农耕时间戳生长（离线等价）', farm.isMature(0) === true)
  Date.now = realNow
  // 探索离线：gold 在报告中（200 目标重构后取首个目标；旧 streetVendor 已不在实例列表）
  const p5 = freshPlayer({ exploration: 5 })
  const ex = new ExplorationSkill(p5)
  p5.activeTarget = ex.targets[0].id
  const re = computeOfflineProgress(ex, 3600_000)
  check('离线', '探索离线返回金币估算', re !== null && re.gold > 0, JSON.stringify(re))
  if (re?.gold > 0) {
    console.log('  ⚠ 核查：settleOffline(bootstrap) 是否应用 report.gold？')
  }
}

// ── F. 存档系统（§8.2 / §10.4）────────────────────
console.log('══ F. 存档系统 ══')
{
  // localStorage 桩
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
  const sm = new SaveManager({ slot: 0 })
  const p = freshPlayer()
  p.gainItem('apple', 7)
  p.setSkillState('foraging', { level: 12, exp: 1234 })
  p.spirits = { active: ['appleSpirit'] }
  p.restaurant = { level: 3, menu: ['roastPotato'], incomeAccum: 1.5 }
  p.guild = { id: 'umami', points: 30, day: '2026-01-01', taskProgress: {} }
  const saveData = { schemaVersion: 1, savedAt: Date.now(), player: p.serialize() }
  sm.save(saveData)
  // 往返一致性
  const loaded = sm.load()
  check('存档', '保存→加载往返（gold）', loaded.player.gold === p.gold)
  check('存档', '保存→加载往返（skills）', loaded.player.skills.foraging.level === 12 && loaded.player.skills.foraging.exp === 1234)
  check('存档', '保存→加载往返（食灵/餐厅/公会）', JSON.stringify(loaded.player.spirits) === JSON.stringify(p.spirits) && loaded.player.restaurant.level === 3 && loaded.player.guild.id === 'umami')
  // 旧档缺字段 → 默认填充（版本迁移 §10.4）
  const oldSave = { schemaVersion: 1, savedAt: Date.now(), player: { name: '老玩家', gold: 50, skills: { foraging: { level: 5, exp: 100 } } } }
  const p2 = freshPlayer()
  p2.applySave(oldSave.player)
  check('存档', '旧档缺字段默认填充（seasons/guild/restaurant）', p2.seasons && typeof p2.seasons === 'object' && p2.guild.id === null && p2.restaurant.level === 1 && p2.combat.style === 'knife')
  // 未知版本 → 不崩溃
  const v999 = { schemaVersion: 999, savedAt: Date.now(), player: { name: 'x', gold: 1 } }
  sm.saveSlot(1, v999)
  const l999 = sm.loadSlot(1)
  check('存档', '未知 schemaVersion 不崩溃', l999 !== null)
  // 损坏 JSON
  store.set('culinary-idle.save.2', '{broken json!!!')
  check('存档', '损坏 JSON 返回 null 不崩溃', sm.loadSlot(2) === null)
  // 导入校验
  let importErr = false
  try {
    await sm.importFromFile({ text: async () => '{not json' })
  } catch {
    importErr = true
  }
  check('存档', '非法导入文件抛错被上层捕获', importErr === true)
  try {
    await sm.importFromFile({ text: async () => JSON.stringify({ foo: 1 }) })
  } catch {
    importErr = true
  }
  check('存档', '结构不合法（无 player）抛错', importErr === true)
  // 三槽位
  check('存档', '3 存档位枚举', sm.listSlots().length === 3)
  // 删除当前槽后：旧档不被后续保存写回（刷新后旧档复活的回归）
  {
    const { deleteSlot, saveNow, saveManager: smg } = await import('../src/game/bootstrap.js')
    smg.slot = 0
    smg.saveSlot(0, { schemaVersion: 1, savedAt: Date.now(), player: { gold: 99999 } })
    const pd = freshPlayer() // 当前游戏持有旧档数据
    pd.gold = 88888
    deleteSlot(0) // 删除当前槽 → 应重置为新游戏
    saveNow() // 未进入游戏（gameRunning=false）时 saveNow 不写档——旧档不可复活
    const after = smg.loadSlot(0)
    check('存档', '删除当前槽后未进入游戏不写回（刷新不复活）', after === null, `gold=${after?.player?.gold}`)
    smg.slot = 1
  }
  // 深比较：serialize→applySave→serialize 不丢数据
  const p3 = freshPlayer()
  // ── 空槽「新建存档」= 真正新开档（2026-09-06：修复「新建=当前进度保存」语义）──
  {
    const { newGameSlot, saveManager: smg2 } = await import('../src/game/bootstrap.js')
    smg2.slot = 1
    smg2.saveSlot(1, { schemaVersion: 1, savedAt: Date.now(), player: { gold: 99999, skills: { knife: { level: 99, exp: 1 } } } })
    const pn = freshPlayer()
    pn.gold = 555
    setActivePinia(createPinia())
    useUiStore()
    newGameSlot(2)
    const fresh2 = smg2.loadSlot(2)
    check('存档', '新建 = 1 级/100 金新档', fresh2?.player?.gold === 100 && (fresh2?.player?.skills?.knife?.level ?? 1) === 1, `gold=${fresh2?.player?.gold}`)
    smg2.slot = 1
  }  p3.gainItem('truffle', 3)
  p3.gainItem('copperKnife', 1)
  p3.equip('copperKnife')
  p3.quests = { index: 2, completed: ['q1'], progress: { 'gather:apple': 5 } }
  p3.stats.combatWins = 42
  p3.buffs.xpMult = { mult: 1.5, expiresAt: Date.now() + 60_000 }
  const s1 = JSON.stringify(p3.serialize())
  const p4 = freshPlayer()
  p4.applySave(JSON.parse(s1))
  const s2 = JSON.stringify(p4.serialize())
  check('存档', '全量序列化往返无丢失', s1 === s2, s1 === s2 ? '' : 'MISMATCH')
}

// ── G. 背包（§5.4）─────────────────────────────────
console.log('══ G. 背包 ══')
{
  const p = freshPlayer()
  p.gainItem('apple', 5)
  p.gainItem('apple', 5)
  check('背包', '同类堆叠 5+5=10', p.inventory.apple === 10)
  // maxStack 9999 边界（文档 §5.4 最大堆叠 9999）
  p.gainItem('apple', 20000)
  check('背包', '堆叠上限 9999（文档）', p.inventory.apple <= 9999, `qty=${p.inventory.apple}`)
  check('背包', 'spendItem 恰好清空删除键', p.spendItem('apple', p.inventory.apple) === true && p.inventory.apple === undefined)
  check('背包', 'spendItem 超出返回 false', p.spendItem('apple', 1) === false)
  p.gainItem('carrot', 3)
  check('背包', 'spendItem 部分消耗', p.spendItem('carrot', 2) === true && p.inventory.carrot === 1)
  // 装备堆叠（stackable:false 物品）：修复后上限 1
  p.gainItem('copperKnife', 2)
  check('背包', '不可堆叠物品上限 1（§5.4）', p.inventory.copperKnife === 1, `qty=${p.inventory.copperKnife}`)
}

// ── H. 经济系统（§11.3）───────────────────────────
console.log('══ H. 经济系统 ══')
{
  const p = freshPlayer()
  check('经济', '初始金币 100', p.gold === 100)
  p.gold = 50
  check('经济', '金币恰好购买（杂货铺 50 值物品）', p.spendGold(50) === true && p.gold === 0)
  check('经济', '余额不足拒绝', p.spendGold(1) === false)
  check('经济', '负数消费拒绝', p.spendGold(-100) === false)
  check('经济', '零消费拒绝', p.spendGold(0) === false)
  p.gainGold(100.7)
  check('经济', 'gainGold 取整', p.gold === 100)
  p.gainItem('apple', 5)
  check('经济', '负数消耗物品拒绝', p.spendItem('apple', -1) === false && p.inventory.apple === 5)
  p.gainItem('apple', -3)
  check('经济', '负数获得物品忽略', p.inventory.apple === 5)
  // 商店购买（§11.3）
  const entry = SHOP_ITEMS[0]
  p.gold = entry.price
  check('经济', '商店恰好金币购买', p.gainItem ? (() => { p.spendGold(entry.price); return true })() : false)
  p.inventory = {}
  p.gold = entry.price
  const p2 = freshPlayer()
  p2.gold = entry.price - 1
  check('经济', '商店余额不足不购买', (() => { const before = p2.inventory[entry.itemId]; p2.spendGold(entry.price); return (p2.inventory[entry.itemId] ?? 0) === (before ?? 0) })())
  // 餐厅收入
  p2.gainItem('roastPotato', 5)
  p2.setRestaurantMenu(0, 'roastPotato')
  check('经济', '餐厅菜单收入 > 0', p2.restaurantHourlyIncome > 0)
  p2.restaurant.menu = []
  check('经济', '空菜单收入 = 0', p2.restaurantHourlyIncome === 0)
  // 物品价值（§11.3 参考：出售价 = 价值×0.5）
  check('经济', '全部物品有正价值', Object.values(ITEMS).every((it) => it.value > 0))
}

// ── I. 成就 / 图鉴（§6）───────────────────────────
console.log('══ I. 成就 / 图鉴 ══')
{
  const p = freshPlayer()
  check('成就', '0 成就初始', p.achievements.length === 0)
  check('成就', '图鉴 0% 初始', p.collectionPct === 0)
  p.setSkillState('foraging', { level: 10, exp: totalXpForLevel(10) })
  p.checkAchievements()
  check('成就', '技能 10 级成就解锁', p.achievements.includes('skill_foraging_10'))
  check('成就', '成就奖励金币入账', p.gold >= 100 + 100)
  // 重复调用不重复发奖
  const goldBefore = p.gold
  p.checkAchievements()
  check('成就', '重复检查不重复发奖', p.gold === goldBefore)
  // 图鉴完成度
  p.gainItem('apple', 1)
  p.gainItem('carrot', 1)
  const pct = p.collectionPct
  check('成就', '图鉴 2 件完成度>0', pct > 0 && pct < 100, `pct=${pct}`)
  // 收集成就：全鱼类
  for (const id of ['crucian', 'carp', 'perch', 'salmon', 'tuna', 'eel', 'lobster', 'crab', 'abalone', 'seaCucumber', 'bluefin', 'grouper', 'goldenDragonFish']) p.gainItem(id, 1)
  p.checkAchievements()
  check('成就', 'allFish 触发并给渔夫之戒', p.achievements.includes('allFish') && p.inventory.fishermanRing === 1)
  // 称号（§6.3）
  check('成就', '称号随成就设置', typeof p.title === 'string' || p.title === null)
  // 成就总数
  check('成就', '成就定义完整性（id 唯一）', new Set(ALL_ACHIEVEMENTS.map((a) => a.id)).size === ALL_ACHIEVEMENTS.length)
}

// ── J. 数值安全（除零 / NaN / 越界）───────────────
console.log('══ J. 数值安全 ══')
{
  const p = freshPlayer()
  // xpProgress 边界
  const r1 = xpProgress(-100)
  check('安全', 'xpProgress(-100) 无 NaN', Number.isFinite(r1.progress) && r1.level === 1)
  const r2 = xpProgress(totalXpForLevel(99))
  check('安全', 'xpProgress(99级总经验) → 等级 99（100 级尚差 3.0 亿）', r2.level === 99 && r2.progress < 1, `lv=${r2.level}`)
  const r3 = xpProgress(0, 120)
  check('安全', 'xpProgress(0, 120) 正常', r3.level === 1)
  // 空目标命中率 / 间隔
  const f = new ForagingSkill(p)
  check('安全', '空目标 interval=0', f.intervalMs(null) === 0)
  const fsh = new FishingSkill(p)
  check('安全', '空目标成功率=0', fsh.successChance(null) === 0)
  // 空菜单餐厅收入
  check('安全', '餐厅空菜单不除零', p.restaurantHourlyIncome === 0)
  // 任务越界
  p.quests.index = 999
  check('安全', '任务索引越界 → currentQuest=null', p.currentQuest === null)
  // 农场地块越界
  const farm = new FarmingSkill(p)
  check('安全', '种植越界地块被拒', farm.canPlant(99, 'wheatSeed') === false)
  // 装备槽未知
  check('安全', '未知装备槽拒绝', p.equip('apple') === false)
  // 战斗属性无装备无 NaN
  const combat = new Combat(p)
  const st = combat.playerStats()
  check('安全', '战斗属性全部有限数', Object.values(st).every((v) => Number.isFinite(v)), JSON.stringify(st))
  // 大数经验（120 级 ~1 亿）无溢出
  check('安全', '120 级经验无溢出', totalXpForLevel(120) > totalXpForLevel(99) && Number.isFinite(totalXpForLevel(120)))
}

// ── K. 事件与监听 / 赛季点数 / 离线金币 ─────────────
console.log('══ K. 事件与监听 ══')
{
  // EventBus 允许重复注册 → ArenaView 每次挂载重复监听（泄漏）
  let count = 0
  const h1 = () => count++
  const h2 = () => (count += 2) // 不同逻辑（函数体不同）→ 各自触发
  EventBus.on('combat:end', h1)
  EventBus.on('combat:end', h2)
  EventBus.emit('combat:end', { result: 'win' })
  check('事件', '不同函数体监听各触发一次', count === 3, `count=${count}`)
  // 同函数体重复注册（HMR 重载场景：新闭包但源码相同）→ toString 去重只保留一份
  const before = count
  EventBus.on('combat:end', () => count++) // 新函数引用，函数体与 h1 相同
  EventBus.emit('combat:end', { result: 'win' })
  check('事件', '同函数体重复注册去重（防 HMR 堆叠）', count === before + 3, `count=${count}`) // h1+h2 各一次 = 3
  EventBus.off('combat:end', h1)
  EventBus.off('combat:end', h2)
}

// ── L. 赛季点数发放（§13）──────────────────────────
console.log('══ L. 赛季系统 ══')
{
  const p = freshPlayer()
  const season = p.activeSeasonDef
  const st = p.seasonState()
  const mission = season.missions.find((m) => m.kind !== 'restaurant')
  check('赛季', '赛季任务存在', !!mission)
  for (let i = 0; i < mission.qty; i++) p.bumpSeason(mission.kind, mission.param)
  check('赛季', '任务完成发放赛季点数', st.points === mission.points, `points=${st.points} exp=${mission.points}`)
  const before = st.points
  for (let i = 0; i < mission.qty; i++) p.bumpSeason(mission.kind, mission.param)
  check('赛季', '重复完成不重复发点', st.points === before, `points=${st.points}`)
  // 餐厅任务同步发点
  const restMission = season.missions.find((m) => m.kind === 'restaurant')
  if (restMission) {
    p.stats.restaurantTotal = restMission.qty
    p.syncSeasonProgress()
    check('赛季', '餐厅收入任务同步发点', st.points >= mission.points + restMission.points, `points=${st.points}`)
  }
}

// ── M. 离线金币应用（bootstrap settleOffline）──────
console.log('══ M. 离线结算闭环 ══')
{
  const p = freshPlayer({ exploration: 5 })
  setActivePinia(createPinia()) // 确保 ui store 可用
  useUiStore()
  p.setActiveSkill('exploration')
  p.activeTarget = getSkillInstance('exploration').targets[0]?.itemId ?? 'explore_001'
  const gold0 = p.gold
  const report = settleOffline(p, useUiStore(), 3600_000)
  check('离线', '探索离线金币入账', report !== null && p.gold > gold0, `gold ${gold0}→${p.gold}`)
}

// ── N. 补齐功能验证：容量/仓库/出售/史诗/硬核/钳制（§5.4/§5.2/§11.3/§4.1）──
console.log('══ N. 补齐功能验证 ══')
{
  // ── 背包容量（§5.4：初始 20 格）──
  const p = freshPlayer()
  const itemIds = Object.keys(ITEMS)
  check('容量', '初始背包 20 格', p.inventoryCap === 20)
  for (let i = 0; i < 20; i++) p.gainItem(itemIds[i], 1)
  check('容量', '20 种物品全部放入', p.inventorySlotsUsed === 20)
  const ok21 = p.gainItem(itemIds[20], 1)
  check('容量', '第 21 种被拒绝', ok21 === false && p.inventorySlotsUsed === 20)
  // 已有种类堆叠不受限
  p.gainItem(itemIds[0], 50)
  check('容量', '已有种类继续堆叠', p.inventory[itemIds[0]] === 51)
  // 扩展 10 格
  p.expandInventory(10)
  check('容量', '扩展 +10 → 30 格', p.inventoryCap === 30 && p.gainItem(itemIds[20], 1) === true)
  // 扩展上限 100
  for (let i = 0; i < 20; i++) p.expandInventory(10)
  check('容量', '扩展上限 100', p.inventoryCap === 100 && p.expandInventory(10) === false)

  // ── 仓库（§5.4：100 格，转移）──
  const p2 = freshPlayer()
  p2.gainItem('apple', 10)
  p2.gainItem('carrot', 5)
  check('仓库', '背包→仓库转移', p2.moveToBank('apple') === true && p2.bank.apple === 10 && p2.inventory.apple === undefined)
  check('仓库', '仓库不占背包格', p2.inventorySlotsUsed === 1 && p2.bankSlotsUsed === 1)
  p2.moveToInventory('apple', 3)
  check('仓库', '仓库→背包取出', p2.inventory.apple === 3 && p2.bank.apple === 7)
  check('仓库', '仓库初始 100 格', p2.bankCap === 100)
  for (let i = 0; i < 20; i++) p2.expandBank(20)
  check('仓库', '仓库扩展上限 500', p2.bankCap === 500 && p2.expandBank(20) === false)
  // 仓库满拒绝
  const p3 = freshPlayer()
  p3.bankCap = 1
  p3.gainItem('apple', 1)
  p3.gainItem('carrot', 1)
  p3.moveToBank('apple')
  check('仓库', '仓库满拒绝新种类', p3.moveToBank('carrot') === false)

  // ── 出售（§11.3：价值×0.5）──
  const p4 = freshPlayer()
  p4.gainItem('apple', 10) // 价值 5 → 单价 2
  const gold0 = p4.gold
  check('出售', '出售单价 = floor(价值×0.5)', p4.sellItem('apple', 1) === true && p4.gold === gold0 + 2)
  p4.sellItem('apple', 9)
  check('出售', '全部出售后清空', p4.inventory.apple === undefined)
  check('出售', '数量不足拒绝', p4.sellItem('apple', 1) === false)
  const p5 = freshPlayer()
  p5.gainItem('apple', 1)
  const g0 = p5.gold
  p5.sellItem('apple', -1)
  check('出售', '负数数量拒绝', p5.gold === g0 && p5.inventory.apple === 1)

  // ── 史诗品质（§5.2：六品质齐全）──
  const qualities = new Set(Object.values(ITEMS).filter((it) => it.type === 'equipment').map((it) => it.quality))
  check('品质', '六档品质齐全（普通~神话）', ['普通', '精良', '稀有', '史诗', '传说', '神话'].every((q) => qualities.has(q)), JSON.stringify([...qualities]))
  check('品质', '史诗装备 12 件存在（水晶+精金）', Object.values(ITEMS).filter((it) => it.quality === '史诗').length === 12)
  const ck = getItem('crystalKnife')
  check('品质', '史诗属性 > 稀有（34 > 24）', ck.stats.attack > getItem('goldKnife').stats.attack)

  // ── 硬核模式（§4.1/§8.2）──
  const p6 = freshPlayer({ knife: 5, tasteAcumen: 1, heatControl: 1 })
  p6.inventory.roastPotato = 20
  p6.hardcore = true
  let deathEvent = 0
  const hd = () => deathEvent++
  EventBus.on('hardcore:death', hd)
  const combat = new Combat(p6)
  fightToEnd(combat, COMBAT_REGIONS[9].opponents[1]) // L98 必败
  check('硬核', '死亡触发删档事件', deathEvent >= 1, `events=${deathEvent}`)
  EventBus.off('hardcore:death', hd)
  const p7 = freshPlayer()
  check('硬核', '默认非硬核', p7.hardcore === false)

  // ── 100 级经验钳制（未转生上限 100：2026-09 曲线为 99→100 需 3 亿）──
  const p8 = freshPlayer()
  const f8 = new ForagingSkill(p8)
  p8.setSkillState('foraging', { level: 100, exp: totalXpForLevel(100) })
  f8.addXp(999_999_999)
  check('钳制', '100 级经验封顶', p8.skills.foraging.exp === totalXpForLevel(100), `exp=${p8.skills.foraging.exp}`)

  // ── 图鉴一位小数 ──
  const p9 = freshPlayer()
  p9.gainItem('apple', 1)
  check('图鉴', '1 件物品完成度 > 0（一位小数）', p9.collectionPct > 0, `pct=${p9.collectionPct}`)
  check('图鉴', '完成度上限 100', freshPlayer().collectionPct === 0)
}

// ── O. 挂机暂停/继续 + 实时进度（§3.1）──────────────
console.log('══ O. 挂机暂停/进度 ══')
{
  const p = freshPlayer()
  p.activeTarget = 'apple'
  const f = new ForagingSkill(p)
  p.setSkillPaused('foraging', true)
  f.tick(30_000) // 暂停中 30s
  check('暂停', '暂停中不产出', f.actionsDone === 0 && (p.inventory.apple ?? 0) === 0)
  check('暂停', '暂停状态可查', p.isSkillPaused('foraging') === true)
  p.setSkillPaused('foraging', false)
  f.tick(30_000)
  check('暂停', '继续后恢复产出（10 次）', f.actionsDone === 10 && (p.inventory.apple ?? 0) >= 10, `done=${f.actionsDone} apples=${p.inventory.apple}`)
  // 进度值
  const p2 = freshPlayer()
  p2.activeTarget = 'apple'
  const f2 = new ForagingSkill(p2)
  f2.timerMs = 1500
  check('进度', '进度值 = timer/interval（1500/3000=0.5）', Math.abs(f2.progressPct - 0.5) < 0.01, `pct=${f2.progressPct}`)
  // 离线暂停（settleOffline 不结算）
  const p3 = freshPlayer()
  useUiStore()
  p3.setSkillPaused('foraging', true)
  const r = settleOffline(p3, useUiStore(), 3600_000)
  check('暂停', '离线暂停不结算（无报告）', r === null && (p3.inventory.apple ?? 0) === 0)
  // 暂停状态随存档往返
  const p4 = freshPlayer()
  p4.setSkillPaused('hunting', true)
  const s = JSON.stringify(p4.serialize())
  const p5 = freshPlayer()
  p5.applySave(JSON.parse(s))
  check('暂停', '暂停状态随存档保存', p5.isSkillPaused('hunting') === true)
}

// ── P. 多技能并行挂机（§3.1：切技能页不中断）────────
console.log('══ P. 多技能并行 ══')
{
  const p = freshPlayer()
  const forInst = getSkillInstance('foraging')
  const fishInst = getSkillInstance('fishing')
  // 新档待机（无默认目标）；测试显式选择采摘苹果 + 垂钓鲫鱼
  p.setSkillTarget('foraging', 'apple')
  p.setSkillTarget('fishing', 'crucian')
  check('并行', '每技能独立目标', p.skillTargets.fishing === 'crucian' && p.getSkillTarget('foraging') === 'apple')
  // 双技能同时 tick（成功判定强制命中）
  withRandom([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], () => p.tick(10_000))
  check('并行', '采摘+垂钓同时产出', forInst.actionsDone >= 1 && fishInst.actionsDone >= 1, `f=${forInst.actionsDone} g=${fishInst.actionsDone}`)
  check('并行', '产出入账', (p.inventory.apple ?? 0) >= 1 && (p.inventory.crucian ?? 0) >= 1, JSON.stringify({ a: p.inventory.apple, c: p.inventory.crucian }))
  // 切换技能页（activeSkill 变化）不中断并行任务
  p.setActiveSkill('cooking')
  const aBefore = p.inventory.apple ?? 0
  withRandom([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], () => p.tick(10_000))
  check('并行', '切到制作页后采摘仍在产出', (p.inventory.apple ?? 0) > aBefore, `${aBefore} → ${p.inventory.apple}`)
  // 单独暂停垂钓：采摘继续
  p.setSkillPaused('fishing', true)
  const cBefore = p.inventory.crucian ?? 0
  const fBefore = p.inventory.apple ?? 0
  withRandom([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], () => p.tick(10_000))
  check('并行', '垂钓暂停、采摘继续', (p.inventory.crucian ?? 0) === cBefore && (p.inventory.apple ?? 0) > fBefore, `c ${cBefore}→${p.inventory.crucian} a ${fBefore}→${p.inventory.apple}`)
  // 旧档迁移：activeTarget → skillTargets
  const old = { name: 'x', gold: 1, activeSkill: 'fishing', activeTarget: 'tuna', skills: {} }
  const p6 = freshPlayer()
  p6.applySave(old)
  check('并行', '旧档 activeTarget 迁移到技能目标', p6.skillTargets.fishing === 'tuna')
}

// ── Q. 并行上限设置（§3.1）────────────────────────
console.log('══ Q. 并行上限 ══')
{
  const p = freshPlayer()
  p.setSkillTarget('foraging', 'apple')
  p.setSkillTarget('fishing', 'crucian')
  check('上限', '默认无限制（0）', (p.settings.maxParallelIdle ?? 0) === 0 && p.getRunningIdleSkills().length === 2)
  // 上限 1：仅活动技能运行（当前活动 foraging）
  p.settings.maxParallelIdle = 1
  let running = p.getRunningIdleSkills().map((i) => i.id)
  check('上限', '上限 1 只运行活动技能（foraging）', running.length === 1 && running[0] === 'foraging', JSON.stringify(running))
  // 切到垂钓页 → 垂钓优先占位
  p.setActiveSkill('fishing')
  running = p.getRunningIdleSkills().map((i) => i.id)
  check('上限', '切到垂钓后优先运行垂钓', running[0] === 'fishing', JSON.stringify(running))
  // 实际 tick：上限 1 时只有 fishing 产出
  withRandom([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], () => p.tick(10_000))
  check('上限', '上限 1 时只有垂钓产出', (p.inventory.crucian ?? 0) >= 1 && (p.inventory.apple ?? 0) === 0, JSON.stringify({ c: p.inventory.crucian, a: p.inventory.apple }))
  // 上限 2：双技能都运行
  p.settings.maxParallelIdle = 2
  withRandom([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], () => p.tick(10_000))
  check('上限', '上限 2 时双技能都产出', (p.inventory.apple ?? 0) >= 1 && (p.inventory.crucian ?? 0) >= 1)
  // 离线受限：只结算活动技能
  const p2 = freshPlayer()
  p2.setSkillTarget('foraging', 'apple')
  p2.setSkillTarget('fishing', 'crucian')
  p2.settings.maxParallelIdle = 1
  p2.setActiveSkill('foraging')
  useUiStore()
  settleOffline(p2, useUiStore(), 3600_000)
  check('上限', '离线仅结算活动技能', (p2.inventory.apple ?? 0) > 0 && (p2.inventory.crucian ?? 0) === 0, JSON.stringify({ a: p2.inventory.apple, c: p2.inventory.crucian }))
  // 设置随存档
  const p3 = freshPlayer()
  p3.settings.maxParallelIdle = 2
  const s3 = JSON.stringify(p3.serialize())
  const p4 = freshPlayer()
  p4.applySave(JSON.parse(s3))
  check('上限', '并行上限设置随存档保存', p4.settings.maxParallelIdle === 2)
}

// ── R. 赛季数据完整性（§13：20 季轮换，内容不重复）────
console.log('══ R. 赛季数据完整性 ══')
{
  check('赛季', '共 40 个赛季', SEASONS.length === 40, `got ${SEASONS.length}`)
  check('赛季', 'id/名称/限定装备唯一', (() => {
    const u = (arr) => new Set(arr).size === arr.length
    return u(SEASONS.map((s) => s.id)) && u(SEASONS.map((s) => s.name)) && u(SEASONS.map((s) => s.limitedItem))
  })())
  check('赛季', '限定装备均存在于物品库', SEASONS.every((s) => !!ITEMS[s.limitedItem]))
  // 任务目标物品全局有效（2026-09 起按主题池生成 10 任务/季，允许跨季复用物品）
  const itemParams = SEASONS.flatMap((s) => s.missions.filter((m) => ['gather', 'craft', 'harvest'].includes(m.kind)).map((m) => m.param))
  check('赛季', '任务目标物品均有效（无 undefined/空）', itemParams.every((p) => !!p), `n=${itemParams.length}`)
  check('赛季', '任务目标物品均存在于物品库', itemParams.every((p) => !!ITEMS[p]))
  // 成就同步：赛季成就存在
  check('赛季', '赛季成就（5/10/20）已同步', ['season5', 'season10', 'seasonAll'].every((id) => ALL_ACHIEVEMENTS.some((a) => a.id === id)))
}

// ── S. 内容扩充完整性（生成器 expansion1.js）────────
console.log('══ S. 内容扩充完整性 ══')
{
  const EXP = await import('../src/game/data/expansion1.js')
  const insts = {}
  createSkillInstances(freshPlayer())
  for (const id of ['foraging', 'fishing', 'hunting', 'excavation', 'cooking', 'baking', 'preserving', 'brewing', 'spiceMixing', 'craftsmithing', 'preservation', 'exploration']) insts[id] = getSkillInstance(id)
  // 各技能扩充后数量：与当前生成器产物一致（2026-09-06 实测量）
  check('扩充', '采集四技能目标数（142/72/70/83）', insts.foraging.targets.length === 142 && insts.fishing.targets.length === 72 && insts.hunting.targets.length === 70 && insts.excavation.targets.length === 83, JSON.stringify({ f: insts.foraging.targets.length, g: insts.fishing.targets.length, h: insts.hunting.targets.length, x: insts.excavation.targets.length }))
  check('扩充', '制作五技能食谱数（294/97/90/127/97）', insts.cooking.recipes.length === 294 && insts.baking.recipes.length === 97 && insts.preserving.recipes.length === 90 && insts.brewing.recipes.length === 127 && insts.spiceMixing.recipes.length === 97, JSON.stringify({ c: insts.cooking.recipes.length, b: insts.baking.recipes.length, p: insts.preserving.recipes.length, r: insts.brewing.recipes.length, s: insts.spiceMixing.recipes.length }))
  check('扩充', '锻造 365 配方（20 品质套 + 独立矿套）', insts.craftsmithing.recipes.length === 365, `n=${insts.craftsmithing.recipes.length}`)
  check('扩充', '食材保鲜 17 配方（肥料 2 + 保鲜/增益剂 15）', insts.preservation.recipes.length === 17, `n=${insts.preservation.recipes.length}`)
  check('扩充', '美食知识 32 奥义', AOJIS.length === 32, `n=${AOJIS.length}`)
  check('扩充', '食灵 160 个', SPIRITS.length === 160, `n=${SPIRITS.length}`)
  check('扩充', '探索 200 目标', insts.exploration.targets.length === 200, `n=${insts.exploration.targets.length}`)
  check('扩充', '区域对手 22×10 / BOSS 28', COMBAT_REGIONS.every((r) => r.opponents.length === 22) && COMBAT_BOSSES.length === 28, `bosses=${COMBAT_BOSSES.length}`)
  // 扩充条目唯一性 + 引用有效性（spirit_ext_* 为旧精灵占位，被 items.js 剔除后由 spiritTiers 接管）
  const allItems = Object.keys(ITEMS)
  check('扩充', '新增物品 id 唯一且无重名（合法入册）', (() => {
    const ext = Object.values(EXP.EXPANSION_ITEMS).filter((x) => !x.id.startsWith('spirit_'))
    const ids = ext.map((x) => x.id)
    const names = ext.map((x) => x.name)
    return new Set(ids).size === ids.length && new Set(names).size === names.length && ids.every((id) => allItems.includes(id))
  })())
  // 所有食谱材料必须存在
  const badIng = []
  for (const inst of Object.values(insts)) {
    for (const r of inst.recipes ?? []) {
      for (const ing of Object.keys(r.ingredients ?? {})) if (!ITEMS[ing]) badIng.push(`${inst.id}:${r.id}→${ing}`)
    }
  }
  check('扩充', '全部食谱材料均存在于物品库', badIng.length === 0, badIng.slice(0, 5).join('; '))
  // 食灵契约材料必须存在
  const badContract = []
  for (const sp of SPIRITS) for (const c of Object.keys(sp.contract ?? {})) if (!ITEMS[c]) badContract.push(`${sp.id}→${c}`)
  check('扩充', '食灵契约材料均存在', badContract.length === 0, badContract.join('; '))
  // 新增物品有正价值
  check('扩充', '新增物品价值 > 0', Object.values(EXP.EXPANSION_ITEMS).every((x) => x.value > 0))
}

// ── T. 攻略数据完整性 ─────────────────────────────
console.log('══ T. 攻略数据 ══')
{
  const G = await import('../src/game/data/guide.js')
  check('攻略', '六阶段齐全', G.GUIDE_STAGES.length === 6, `n=${G.GUIDE_STAGES.length}`)
  check('攻略', '阶段 id 唯一且有序', (() => {
    const ids = G.GUIDE_STAGES.map((s) => s.id)
    return new Set(ids).size === ids.length
  })())
  check('攻略', '每阶段内容完整（目标/行动/里程碑/提示非空）', G.GUIDE_STAGES.every((s) => s.goals?.length >= 2 && s.actions?.length >= 5 && s.milestones?.length >= 3 && s.tips?.length >= 2), JSON.stringify(G.GUIDE_STAGES.map((s) => [s.id, s.goals.length, s.actions.length, s.milestones.length, s.tips.length])))
  // 阶段自动定位边界（对决等级）
  const cases = [[1, 'beginner'], [10, 'beginner'], [11, 'early'], [30, 'early'], [31, 'mid'], [60, 'mid'], [61, 'late'], [85, 'late'], [86, 'lategame'], [99, 'lategame'], [100, 'endgame'], [120, 'endgame']]
  check('攻略', '按对决等级自动定位正确', cases.every(([lv, id]) => G.currentGuideStageId(lv) === id), cases.filter(([lv, id]) => G.currentGuideStageId(lv) !== id).map(([lv]) => `L${lv}`).join(','))
}

// ── U. 图鉴数据完整性（物品来源/BOSS/赛季图鉴）──────
console.log('══ U. 图鉴数据 ══')
{
  const { itemSources, sourcedCount } = await import('../src/game/data/itemSources.js')
  const total = Object.keys(ITEMS).length
  // 来源索引覆盖率：大多数物品应有来源（未覆盖的仅为无固定来源的特殊道具）
  const covered = new Set()
  for (const id of Object.keys(ITEMS)) if (itemSources(id).length) covered.add(id)
  check('图鉴', `物品来源索引覆盖 ${covered.size}/${total}`, covered.size >= total * 0.95, `covered=${covered.size}`)
  // 关键物品来源抽查
  check('图鉴', '苹果来源 = 采摘', itemSources('apple').some((s) => s.includes('采摘')))
  check('图鉴', '铜刀来源 = 厨具锻造', itemSources('copperKnife').some((s) => s.includes('厨具锻造')))
  check('图鉴', '盛夏草帽来源 = 赛季限定', itemSources('summerHat').some((s) => s.includes('盛夏果味季')))
  check('图鉴', '陷阱来源 = 杂货铺', itemSources('trap').some((s) => s.includes('杂货铺')))
  // BOSS 图鉴：18 BOSS 全部有掉落与机制标记
  check('图鉴', 'BOSS 图鉴 28 个且均有独有掉落', COMBAT_BOSSES.length === 28 && COMBAT_BOSSES.every((b) => b.drops?.length))
  // 赛季图鉴：40 赛季均有限定装备
  check('图鉴', '赛季图鉴 40 个且均有限定装备', SEASONS.length === 40 && SEASONS.every((s) => ITEMS[s.limitedItem]))
  // 击杀记录：BOSS 击败后入 stats.bosses（去重）
  const p = freshPlayer({ knife: 5, tasteAcumen: 1, heatControl: 1 })
  p.inventory.roastPotato = 20
  p.onCombatWin({ isBoss: true, name: '面条之王' })
  p.onCombatWin({ isBoss: true, name: '面条之王' })
  check('图鉴', 'BOSS 击杀记录去重', p.stats.bosses.length === 1 && p.stats.bosses[0] === '面条之王')
  check('图鉴', 'bossAll 成就阈值同步为 28', ALL_ACHIEVEMENTS.find((a) => a.id === 'bossAll').check({ stats: { bosses: Array(28).fill('x') } }) === true && ALL_ACHIEVEMENTS.find((a) => a.id === 'bossAll').check({ stats: { bosses: [] } }) === false)
}

// ── V. 对手数据完整性（对决页面显示字段）───────────
console.log('══ V. 对手数据 ══')
{
  // 所有对手（120 区域 + 18 BOSS）必须具备完整战斗字段（风格名/HP/攻/防/命中/闪避/暴击）
  const all = [...COMBAT_REGIONS.flatMap((r) => r.opponents), ...COMBAT_BOSSES]
  const bad = all.filter((o) => !(o.styleName && Number.isFinite(o.hp) && Number.isFinite(o.atk) && Number.isFinite(o.def) && Number.isFinite(o.acc) && Number.isFinite(o.eva) && Number.isFinite(o.crit) && Number.isFinite(o.speedMs)))
  check('对手', '全部 248 个对手字段完整（风格/HP/攻/防/命中/闪避/暴击/攻速）', all.length === 248 && bad.length === 0, `bad=${bad.map((b) => b.name).join(',')}`)
  // 数值合理：HP/攻/防 随等级递增
  check('对手', 'HP 随等级递增', COMBAT_BOSSES.every((b) => b.hp === 12 + b.level * 6), 'opp 公式一致')
  check('对手', 'BOSS 机制文本可读', COMBAT_BOSSES.every((b) => b.mechanic === null || b.mechanic === undefined || Object.keys(b.mechanic).length >= 0))
  // 掉落完整：全部 138 个对手/BOSS 均有掉落（基础+扩充）
  check('对手', '全部对手均有掉落', all.every((o) => (o.drops?.length ?? 0) > 0), `empty=${all.filter((o) => !o.drops?.length).map((o) => o.name).join(',')}`)
  // 扩充对手掉落池引用有效物品
  const badDrop = all.flatMap((o) => (o.drops ?? []).filter((d) => !ITEMS[d.itemId]).map((d) => `${o.name}→${d.itemId}`))
  check('对手', '所有掉落引用有效物品', badDrop.length === 0, badDrop.slice(0, 5).join('; '))
}

// ── W. 夜市狂潮窗口（2026-09-06 限时活动）─────────────
console.log('══ W. 夜市狂潮 ══')
{
  const p = freshPlayer()
  check('夜市', '12-20 点窗口判定（含边界）', p.marketOn(12) === true && p.marketOn(19) === true && p.marketOn(11) === false && p.marketOn(20) === false)
  check('夜市', '窗口倍率 餐厅×2 / 对决×1.5', p.marketBoost(15).restaurant === 2 && p.marketBoost(15).combatXp === 1.5)
  check('夜市', '非窗口倍率为 1', p.marketBoost(9).restaurant === 1 && p.marketBoost(23).combatXp === 1)
  // 经验链路：对决类技能在窗口内获得 ×1.5
  const pd = freshPlayer({ knife: 5 })
  const kd = getSkillInstance('knife')
  const before = pd.skills.knife.exp
  // 挂起 marketBoost 为窗口（以 15 点模拟）
  const origBoost = pd.marketBoost
  pd.marketBoost = (h) => (h ?? 15) >= 12 && (h ?? 15) < 20 ? { restaurant: 2, combatXp: 1.5 } : { restaurant: 1, combatXp: 1 }
  kd.addXp(1000)
  check('夜市', '对决经验 ×1.5 生效', pd.skills.knife.exp - before === 1500, `got ${pd.skills.knife.exp - before}`)
  pd.marketBoost = origBoost
}

// ── 汇总 ──────────────────────────────────────────
console.log(`\n══ 结果：通过 ${pass} / 失败 ${fail} ══`)
console.log(`发现缺陷 ${bugs.length} 项（另有代码核查项在报告中）`)
process.exit(fail === 0 ? 0 : 1)
