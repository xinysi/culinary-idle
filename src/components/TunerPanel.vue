<script setup>
// 运营调参页（2026-09-25 第四角色「运营调参员」的页面）——**只在含开发者模式的构建里存在**
//
// 定位（用户拍板）：在**运行时系数层**做在线调参演示，与开发者页面分离：本页**没有任何存档与破坏性操作**。
//
// 🔴 三条红线（机制在 game/data/tuner.js，这里只负责呈现）：
//   ① 只动读取点——数据文件一字不改；② 纯会话内存态——刷新页面即全部还原为基线，不进存档；
//   ③ 默认零操作 = 零影响（system_test C9b 有 20 条断言钉住默认零影响 / 覆盖生效 / 夹取 / 复位）。
//
// 🎓 面向答辩的六件套（2026-09-25 用户「都做」）：
//   ① 验收线：把已做过的 sim 标定（回收率 10~30%、单场时长、经验/时、制作时长）做成**判据**，带内 ✅ / 带外 ⚠️；
//   ② 时间语言：三条链的末环都落在「时长/速率」，老师对「升级时长 ×0.2」有直觉、对「倍率 7.75」没有；
//   ③ 演示脚本：六步动线 + 讲解词 + 观察点，现场 3 分钟照着讲；
//   ④ 深链闭环：每条链一个「去游戏里看 →」，跳到读取同一出口的页面（觅珍公示 / 对决掉落 / 技能页）；
//   ⑤ 零副作用校验：当场算【覆盖生效 + 存档 SHA-256 指纹一致 + 存储字节未增长】三条证据；
//   ⑥ 演示模式：投影仪用大字版（隐藏滑杆与长表，只留预设/验收线/四条链）。
import { computed, ref } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { usePlayerStore } from '../stores/player.js'
import { devLogout } from '../game/dev/devFlag.js'
import { sha256Hex } from '../game/dev/hash.js'
import { DIFFICULTY, CHANCE_FLOOR, scaleChance, dropChance, craftSuccessChance, exploreSuccessChance, gatherExtraChance } from '../game/data/difficulty.js'
import { MATERIAL_COST_MULT, materialQty } from '../game/data/materialCost.js'
import { XP_STACK_DAMPING, LOW_TARGET_XP_MULT, LOW_TARGET_GAP, dampXpStack, targetLevelXpMult, isLowTarget } from '../game/core/growthRate.js'
import { MASTERY_XP_BONUS_SCALE, masteryXpMultiplier, masteryXpMultiplierRaw } from '../game/core/mastery.js'
import { PRESTIGE_XP_BONUS } from '../game/skills/Skill.js'
import { combatTurnIntervalSec, combatSpeedCapLevel, COMBAT_RESPAWN_SEC, COMBAT_SPEED_BASE_SEC, COMBAT_SPEED_FLOOR_SEC, COMBAT_SPEED_DECAY_PER_LEVEL, OFFLINE_CAP } from '../game/data/caps.js'
import { scaledEnemy } from '../game/data/enemyScaling.js'
import { MIJIAN_POOLS, QUALITY_WEIGHT, REFUND_PCT, MIX_BRANCH, SOFT_MAX_P, LIMITED_GEAR_PCT, PITY_RULES, poolItems, cheapTier, refundOf, branchOf, pityRuleOf } from '../game/data/mijianDraws.js'
import { tunerOver, tunerSet, tunerResetKey, tunerResetAll, tunerRawValue, tunerActiveKeys } from '../game/data/tuner.js'

const ui = useUiStore()
const player = usePlayerStore()
const ver = ref(0) // 调参模块不是响应式的：每次改动 bump 一次刷新显示
const demo = ref(false) // 演示模式（大字、隐藏滑杆与长表）
const evidence = ref(null) // 零副作用校验结果

/** 调参项清单：key 与各数据模块读取点的 tunerOver 参数**必须一致**（含 min/max） */
const ROWS = [
  { group: 'diff', key: 'diffDrop', label: '对决掉落（区域 + 首领）', base: DIFFICULTY.drop, min: CHANCE_FLOOR.drop, max: DIFFICULTY.drop, step: 0.01 },
  { group: 'diff', key: 'diffCraft', label: '制作成功率（全部制作类）', base: DIFFICULTY.craft, min: CHANCE_FLOOR.craft, max: DIFFICULTY.craft, step: 0.01 },
  { group: 'diff', key: 'diffExplore', label: '美食探索成功率', base: DIFFICULTY.explore, min: CHANCE_FLOOR.explore, max: DIFFICULTY.explore, step: 0.01 },
  { group: 'diff', key: 'diffExploreLoot', label: '探索物品战利品', base: DIFFICULTY.exploreLoot, min: CHANCE_FLOOR.exploreLoot, max: DIFFICULTY.exploreLoot, step: 0.01 },
  { group: 'diff', key: 'diffOther', label: '其它概率产出（奇遇/远行队…）', base: DIFFICULTY.other, min: CHANCE_FLOOR.other, max: DIFFICULTY.other, step: 0.01 },
  { group: 'diff', key: 'diffGatherExtra', label: '采集附产（木材/矿石/种子…）', base: DIFFICULTY.gatherExtra, min: CHANCE_FLOOR.gatherExtra, max: DIFFICULTY.gatherExtra, step: 0.01 },
  { group: 'grow', key: 'globalXp', label: '全局经验倍率', base: 1, min: 0, max: 20, step: 0.5 },
  { group: 'grow', key: 'cardXpScale', label: '卡片经验整体缩放', base: 1, min: 0.1, max: 10, step: 0.1 },
  { group: 'grow', key: 'prestigeXpBonus', label: '转生经验加成 / 层', base: PRESTIGE_XP_BONUS, min: 0, max: 1, step: 0.05 },
  { group: 'grow', key: 'materialCost', label: '材料成本倍率', base: MATERIAL_COST_MULT, min: 1, max: 8, step: 0.5 },
  { group: 'grow', key: 'xpDamping', label: '乘法叠区阻尼', base: XP_STACK_DAMPING, min: 0, max: 1, step: 0.05 },
  { group: 'grow', key: 'masteryScale', label: '精通经验强度', base: MASTERY_XP_BONUS_SCALE, min: 0, max: 1, step: 0.05 },
  { group: 'grow', key: 'lowTargetMult', label: '低目标经验衰减', base: LOW_TARGET_XP_MULT, min: 0, max: 1, step: 0.05 },
  { group: 'grow', key: 'lowTargetGap', label: '低目标判定差（级）', base: LOW_TARGET_GAP, min: 1, max: 20, step: 1 },
  { group: 'combat', key: 'enemyHp', label: '敌人血量倍率', base: 1, min: 0.25, max: 4, step: 0.05 },
  { group: 'combat', key: 'respawnSec', label: '击杀重生间隔（秒）', base: COMBAT_RESPAWN_SEC, min: 0, max: 10, step: 0.5 },
  { group: 'combat', key: 'atkSpeedDecay', label: '攻速衰减 / 级', base: COMBAT_SPEED_DECAY_PER_LEVEL, min: 0.004, max: 0.05, step: 0.002 },
  { group: 'combat', key: 'speedFloor', label: '攻速地板（秒）', base: COMBAT_SPEED_FLOOR_SEC, min: 0.4, max: COMBAT_SPEED_BASE_SEC, step: 0.1 },
  { group: 'gacha', key: 'refundPct', label: '返金比例（抽卡成本）', base: REFUND_PCT, min: 0, max: 1, step: 0.01 },
  { group: 'gacha', key: 'mixNormal', label: '混池正常分支（装备）', base: MIX_BRANCH.normal, min: 0, max: 0.75, step: 0.01 },
  { group: 'gacha', key: 'gearPity', label: '厨具/限时池 稀有保底（抽）', base: PITY_RULES.gear.rare, min: 5, max: 120, step: 1 },
  { group: 'gacha', key: 'mixPity', label: '混池 稀有保底（抽）', base: PITY_RULES.mix.rare, min: 5, max: 200, step: 1 },
  { group: 'gacha', key: 'softMaxP', label: '软保底上限概率', base: SOFT_MAX_P, min: 0, max: 1, step: 0.05 },
  { group: 'gacha', key: 'limitedGearPct', label: '限时池出装备率', base: LIMITED_GEAR_PCT, min: 0, max: 1, step: 0.05 },
  { group: 'sys', key: 'offlineHours', label: '离线结算上限（小时）', base: OFFLINE_CAP.baseHours, min: 0.25, max: 72, step: 0.25 },
]
const GROUPS = [
  { id: 'diff', label: '📉 概率难度', note: '只能「更难」或「复原到基线」——不会比基线简单（上限 = 基线值）。' },
  { id: 'grow', label: '🧭 成长与经济', note: '全局/卡片经验作用于所有来源；转生加成经**阻尼乘积**；低目标判定差改的是「差几级算低目标」。' },
  { id: 'combat', label: '⚔️ 战斗节奏', note: '血量乘在分档之后；重生间隔/攻速衰减/攻速地板直接改引擎公式（到顶等级随之移动）。' },
  { id: 'gacha', label: '🎲 觅珍抽卡', note: '返金比例与混池分支影响**回收率**；保底抽数夹在神话保底之前；公示面板与结算同源。' },
  { id: 'sys', label: '⏱ 离线', note: '覆盖「离线结算上限」小时数（整体替换基础 + 饼干 + 道途 + 山海）。' },
]

/** 🎬 一键情景：先清空再套用（预设之间互不残留），点一下就能看连锁后果 */
const PRESETS = [
  {
    id: 'hard', label: '🐢 硬核演示',
    hint: '全部概率压到下限 + 敌人血量 ×1.5 + 材料 ×3 + 重生 3s',
    sets: { diffDrop: CHANCE_FLOOR.drop, diffCraft: CHANCE_FLOOR.craft, diffExplore: CHANCE_FLOOR.explore, diffExploreLoot: CHANCE_FLOOR.exploreLoot, diffOther: CHANCE_FLOOR.other, diffGatherExtra: CHANCE_FLOOR.gatherExtra, enemyHp: 1.5, materialCost: 3, respawnSec: 3 },
  },
  {
    id: 'fast', label: '🚀 爽游演示',
    hint: '全局经验 ×5 + 卡片经验 ×2 + 敌人血量 ×0.5 + 重生 0.5s + 材料 ×1 + 离线上限 48h',
    sets: { globalXp: 5, cardXpScale: 2, enemyHp: 0.5, respawnSec: 0.5, materialCost: 1, offlineHours: 48 },
  },
  {
    id: 'heavy', label: '⚔️ 重战斗演示',
    hint: '敌人血量 ×4 + 重生 5s —— 看「击杀/时」与「经验/时」的非线性下跌',
    sets: { enemyHp: 4, respawnSec: 5 },
  },
  {
    id: 'gacha', label: '🎲 抽卡经济演示',
    hint: '返金降到 10% + 混池正常分支抬到 30% + 软保底 0.3 + 保底 10 抽 —— 看回收率',
    sets: { refundPct: 0.1, mixNormal: 0.3, softMaxP: 0.3, gearPity: 10, mixPity: 20 },
  },
]
function applyPreset(p) {
  tunerResetAll()
  for (const [k, v] of Object.entries(p.sets)) tunerSet(k, v)
  ver.value++
}

/** ④ 深链：跳到读取同一出口的游戏页面（关掉本页 → 切视图 → 需要时切技能页） */
const LINKS = {
  combat: { view: 'skill', skill: 'knife', label: '对决页（掉落列表）' },
  grow: { view: 'skill', skill: 'cooking', label: '烹饪技能页（经验卡片）' },
  craft: { view: 'skill', skill: 'woodworking', label: '木工技能页（配方材料）' },
  gacha: { view: 'mijian', label: '觅珍页（公示面板）' },
}
const LINK_HINT = {
  combat: '（对决页的敌人血量已随调参变化）',
  grow: '（全局经验只在结算时生效，卡片上的基础经验不变）',
  craft: '（配方卡片上的材料数量已随调参变化）',
  gacha: '（已展开概率说明——公示数字就是调参后的值）',
}
function goLook(chainId) {
  const l = LINKS[chainId]
  if (!l) return
  // 启动页阶段没有游戏界面，跳过去也看不到东西（2026-09-25 用户报「点了没生效」的根因之一）
  if (ui.phase !== 'game') return
  const c = chains.value.find((x) => x.id === chainId)
  const changed = c ? c.nodes.filter((n) => n.delta) : []
  const tip = changed.length
    ? changed.slice(-2).map((n) => `${n.label} ${n.baseShow} → ${n.curShow}`).join('，')
    : '尚未调参（当前为基线值）'
  ui.pushLog(`🔍 调参演示 · ${c?.title ?? ''}：${tip}${LINK_HINT[chainId] ?? ''}`, 'info')
  ui.showTunerPanel = false
  if (l.skill) player.setActiveSkill(l.skill)
  ui.setView(l.view)
  if (chainId === 'gacha') ui.toggleMijianOdds(true) // 公示数字藏在折叠弹窗里，自动展开才看得出「生效」
}

/** ⑤ 零副作用校验：当场算三条证据（覆盖确已生效 / 存档指纹一致 / 存储未增长） */
function fingerprint() {
  return {
    save: sha256Hex(JSON.stringify(player.serialize())),
    lsBytes: Object.keys(localStorage).reduce((a, k) => a + k.length + (localStorage.getItem(k) || '').length, 0),
    lsKeys: Object.keys(localStorage).length,
  }
}
function runEvidence() {
  const before = fingerprint()
  const keep = {}
  for (const r of ROWS) keep[r.key] = tunerRawValue(r.key)
  // 施加一组显著覆盖（校验后原样恢复，不动用户已有的调参）
  tunerSet('globalXp', 7)
  tunerSet('enemyHp', 2)
  tunerSet('materialCost', 4)
  const probe = {
    activeCount: tunerActiveKeys().length,
    xp: tunerOver('globalXp', 1, 0, 20),
    enemy: tunerOver('enemyHp', 1, 0.25, 4),
    qty: materialQty(10),
  }
  const after = fingerprint()
  for (const [k, v] of Object.entries(keep)) {
    if (v == null) tunerResetKey(k)
    else tunerSet(k, v)
  }
  ver.value++
  evidence.value = {
    at: new Date().toLocaleTimeString(),
    saveOk: before.save === after.save,
    lsOk: before.lsBytes === after.lsBytes && before.lsKeys === after.lsKeys,
    lsKeys: before.lsKeys,
    lsKb: Math.round(before.lsBytes / 1024),
    hash: before.save.slice(0, 16),
    probe,
  }
}

const activeCount = computed(() => { ver.value; return tunerActiveKeys().length })
function rowsOf(groupId) {
  ver.value
  return ROWS.filter((r) => r.group === groupId).map((r) => ({
    ...r,
    raw: tunerRawValue(r.key),
    eff: tunerOver(r.key, r.base, r.min, r.max),
    modified: tunerRawValue(r.key) != null,
  }))
}
function setVal(row, v) {
  const n = v === '' ? null : Number(v)
  tunerSet(row.key, n == null || !Number.isFinite(n) ? null : n)
  ver.value++
}
function resetKey(row) {
  tunerResetKey(row.key)
  ver.value++
}
function resetAll() {
  tunerResetAll()
  ver.value++
}
function fmt(v) {
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })
}
function pct(v) {
  return (v * 100).toFixed(2).replace(/\.?0+$/, '') + '%'
}
function goBack() {
  ui.showTunerPanel = false
}
function lockNow() {
  devLogout()
  ui.showTunerPanel = false
}

/* ── 影响链小工具 ── */
const dText = (d) => (d > 0 ? '+' : '') + d.toFixed(1) + '%'
function mkNode(label, base, cur, opts = {}) {
  const changed = Number(base) !== Number(cur)
  const d = !changed || !Number(base) ? null : ((Number(cur) - Number(base)) / Number(base)) * 100
  const showNum = (v) => (opts.round ? fmt(Math.round(v)) : fmt(v))
  return {
    label,
    base,
    cur,
    baseShow: opts.baseShow ?? showNum(base) + (opts.unit ?? ''),
    curShow: showNum(cur) + (opts.unit ?? '') + (opts.suffix ?? ''),
    delta: d == null ? null : dText(d),
    dir: d == null ? '' : d > 0 ? 'up' : 'down',
    changed,
  }
}

/** 池回收率（与 scripts/sim/mijian_economy.mjs 同口径）：(金币返还 + 物品价值×0.5) / 池价 */
function recycleOf(poolId, branch, refund) {
  const def = MIJIAN_POOLS.find((p) => p.id === poolId)
  if (!def?.price) return null
  const mean = (arr) => (arr.length ? arr.reduce((a, x) => a + (x.value ?? 0), 0) / arr.length : 0)
  const cheapAvg = mean(cheapTier(poolId))
  let normalAvg
  if (poolId === 'mix') {
    const gear = poolItems('gear')
    const tot = Object.values(QUALITY_WEIGHT).reduce((a, b) => a + b, 0)
    normalAvg = 0
    for (const [q, w] of Object.entries(QUALITY_WEIGHT)) {
      const cand = gear.filter((i) => i.quality === q)
      if (cand.length) normalAvg += (w / tot) * mean(cand)
    }
  } else {
    normalAvg = mean(poolItems(poolId))
  }
  const ev = branch.gold * refund(def.price) + branch.cheap * cheapAvg * 0.5 + branch.normal * normalAvg * 0.5
  return ev / def.price
}

/** 🔗 四条影响链——每环由上一环算出（真实公式），末环统一落在「时长 / 速率 / 回收率」 */
const chains = computed(() => {
  ver.value
  const out = []

  // ── 链 A：战斗节奏 ──
  const hpMult = tunerOver('enemyHp', 1, 0.25, 4)
  const respawn = tunerOver('respawnSec', COMBAT_RESPAWN_SEC, 0, 10)
  const ivBase = Math.max(1.2, COMBAT_SPEED_BASE_SEC - 40 * COMBAT_SPEED_DECAY_PER_LEVEL)
  const ivCur = combatTurnIntervalSec(40)
  const roundsBase = 5
  const roundsCur = Math.max(1, Math.round(roundsBase * hpMult))
  const tBase = roundsBase * ivBase
  const tCur = roundsCur * ivCur
  const kBase = 3600 / (tBase + COMBAT_RESPAWN_SEC)
  const kCur = 3600 / (tCur + respawn)
  const ttkBase = tBase + COMBAT_RESPAWN_SEC
  const ttkCur = tCur + respawn
  const xpCur = kCur * Math.min(hpMult, 2)
  out.push({
    id: 'combat',
    title: '⚔️ 战斗节奏链',
    link: LINKS.combat.label,
    note: '参考 L40 对手、5 回合。经验按造成伤害给且单场封顶「期望血量 ×2」——血量超过 ×2 后经验不再涨，只涨时长。',
    nodes: [
      mkNode('敌人血量', 1, hpMult, { baseShow: '×1', curShow: '×' + fmt(hpMult) }),
      mkNode('单场回合', roundsBase, roundsCur, { round: true }),
      mkNode('单场时长（含重生）', ttkBase, ttkCur, { unit: 's' }),
      mkNode('击杀 / 时', kBase, kCur, { round: true }),
      mkNode('战斗经验 / 时', kBase, xpCur, { round: true }),
    ],
  })

  // ── 链 B：成长叠区（末环用时间语言）──
  const g = tunerOver('globalXp', 1, 0, 20)
  const card = tunerOver('cardXpScale', 1, 0.1, 10)
  const stackRef = 10
  const dampBase = 1 + (stackRef - 1) * XP_STACK_DAMPING
  const dampCur = dampXpStack(stackRef)
  const rateBase = dampBase
  const rateCur = card * dampCur * g
  out.push({
    id: 'grow',
    title: '🧭 成长叠区链',
    link: LINKS.grow.label,
    note: '示例：转生 × 增益剂 × 设置 × 追赶 × 市场的乘积为 ×10 时。阻尼只压缩乘积、不改各层档间差距；卡片缩放与全局倍率依次乘上去。',
    nodes: [
      mkNode('卡片经验缩放', 1, card, { baseShow: '×1', curShow: '×' + fmt(card) }),
      mkNode('叠区阻尼后（乘积 ×10）', dampBase, dampCur, { suffix: '×' }),
      mkNode('全局经验倍率', 1, g, { baseShow: '×1', curShow: '×' + fmt(g) }),
      mkNode('经验速率', rateBase, rateCur, { suffix: '×' }),
      mkNode('满级所需时长（相对）', 1, rateBase / rateCur, { baseShow: '×1', suffix: '×' }),
    ],
  })

  // ── 链 C：制作与升级时长 ──
  const mc = tunerOver('materialCost', MATERIAL_COST_MULT, 1, 8)
  const qtyBase = Math.max(1, Math.round(5 * MATERIAL_COST_MULT))
  const qtyCur = materialQty(5)
  out.push({
    id: 'craft',
    title: '🧺 制作与升级时长链',
    link: LINKS.craft.label,
    note: '材料限速（715/715 条配方都是「等材料」而非「等队列」）⇒ 用量涨多少，收料时间与制作类升级时长就涨多少。',
    nodes: [
      mkNode('材料成本倍率', MATERIAL_COST_MULT, mc, { baseShow: '×' + fmt(MATERIAL_COST_MULT), curShow: '×' + fmt(mc) }),
      mkNode('单件用量（5 件基准）', qtyBase, qtyCur),
      mkNode('单件收料时长', 1, qtyCur / qtyBase, { baseShow: '×1', suffix: '×' }),
      mkNode('制作类升级时长', 1, qtyCur / qtyBase, { baseShow: '×1', suffix: '×' }),
    ],
  })

  // ── 链 D：抽卡经济 ──
  const refundBase = Math.floor(80 * REFUND_PCT)
  const refundCur = refundOf(80)
  const recBase = recycleOf('mix', MIX_BRANCH, (p) => Math.floor(p * REFUND_PCT))
  const recCur = recycleOf('mix', branchOf('mix'), refundOf)
  out.push({
    id: 'gacha',
    title: '🎲 抽卡经济链（混池 80 价）',
    link: LINKS.gacha.label,
    note: '回收率 = (金币返还 + 物品价值 ×0.5) ÷ 池价，标定带 10~30%（2026-09-26 由 30~40% 下调：返金 35%→20%）。返金档与正常分支此消彼长：正常分支（装备）越重，回收率越高。',
    nodes: [
      mkNode('返金比例', Math.round(REFUND_PCT * 100), Math.round(tunerOver('refundPct', REFUND_PCT, 0, 1) * 100), { unit: '%' }),
      mkNode('混池返金额', refundBase, refundCur, { unit: '金' }),
      mkNode('混池回收率', Math.round(recBase * 1000) / 10, Math.round(recCur * 1000) / 10, { unit: '%' }),
    ],
  })
  return out
})

/** ① 验收线：把已做过的 sim 标定做成判据（带内 ✅ / 带外 ⚠️）——回答「凭什么说这个调法合理」 */
const verdicts = computed(() => {
  ver.value
  const c = chains.value
  const node = (cid, i) => c.find((x) => x.id === cid).nodes[i]
  return [
    {
      id: 'ttk', label: '单场时长', lo: 4, hi: 25, unit: 's', fmt: (v) => fmt(v) + 's',
      value: node('combat', 2).cur, baseValue: node('combat', 2).base, range: ' · 标定 4s ~ 25s（数秒~数十秒）',
      note: '对照 Melvor 的「数秒~数十秒」；实测中位 9.9s（含重生，AGENTS 敌人节奏三件套）',
    },
    {
      id: 'xpRate', label: '战斗经验 / 时', lo: 100, hi: Infinity, unit: '', fmt: (v) => fmt(Math.round(v)),
      value: (node('combat', 4).cur / node('combat', 4).base) * 100, baseValue: 100, range: ' · 标定 ≥ 100 · 不得劣于基线',
      note: '以基线为 100；低于 100 = 升级变慢（验收线是「不得劣于基线」）',
    },
    {
      id: 'craftTime', label: '制作升级时长', lo: 0, hi: 1, unit: '×', fmt: (v) => '×' + fmt(v),
      value: node('craft', 3).cur, baseValue: 1, range: ' · 标定 ≤ ×1 · 不得劣于基线',
      note: '以基线为 ×1；>×1 = 练级变慢（材料限速 ⇒ 时长与用量同比例）',
    },
    {
      id: 'recycle', label: '混池回收率', lo: 10, hi: 30, unit: '%', fmt: (v) => fmt(Math.round(v * 10) / 10) + '%',
      value: node('gacha', 2).cur, baseValue: node('gacha', 2).base, range: ' · 标定带 10% ~ 30%',
      note: '标定带 10~30%（AGENTS 觅珍节：金币返还 + 物品价值×0.5 占池价）。**这条线唯一的作用是当套利上限**：<100% ⇒ 不存在「抽卡→再卖」刷金闭环。它**不是「抽卡值不值」的度量** —— 抽卡是付出与赌，玩家拿的是物品与稀有度，返金只是垫底结果；30% 是留的余量，10% 只是下限。',
    },
  ].map((b) => {
    const ch = b.value !== b.baseValue
    const d = !ch || !b.baseValue ? null : ((b.value - b.baseValue) / b.baseValue) * 100
    return {
      ...b,
      inBand: b.value >= b.lo && b.value <= b.hi,
      changed: ch,
      baseText: b.fmt(b.baseValue),
      curText: b.fmt(b.value),
      delta: d == null ? null : dText(d),
      dir: d == null ? '' : d > 0 ? 'up' : 'down',
    }
  })
})

/** ③ 演示脚本：六步动线 + 讲解词 + 观察点（现场照着讲） */
const SCRIPT = [
  { n: 1, title: '先立边界', act: { type: 'evidence', label: '👉 点「零副作用校验」' }, say: '这个工具只改运行时系数的读取点——不碰数据文件，也不碰存档。', watch: '三条证据全 ✅：覆盖确已生效 / 存档 SHA-256 指纹一致 / 存储字节未增长' },
  { n: 2, title: '更难会怎样', act: { type: 'preset', id: 'hard', label: '👉 点「🐢 硬核演示」' }, say: '把概率、材料、敌人血量三处同时收紧，看时间指标怎么被连锁推高。', watch: '验收线两条转 ⚠️（战斗经验/时 ≈90、制作升级时长 ×3）' },
  { n: 3, title: '加血不是线性', act: { type: 'preset', id: 'heavy', label: '👉 点「⚔️ 重战斗演示」' }, say: '经验按造成的伤害给、单场封顶期望血量两倍——血量 ×4 时击杀 −74%，但经验/时只 −49%。', watch: '战斗链末环 350 → 179（−48.8%）；单场时长冲过验收线到 ~40s' },
    { n: 4, title: '抽卡经济', act: { type: 'preset', id: 'gacha', label: '👉 点「🎲 抽卡经济演示」' }, say: '返金比例与装备分支此消彼长，回收率是两者的合成结果——所以单看一个数会误判。', watch: '抽卡链：返金 16 → 8 金，回收率 27.9% → 38.8%（装备分支抵消了返金损失）⇒ 验收线转 ⚠️（越过 30% 上沿）' },
  { n: 5, title: '闭环到游戏里', act: { type: 'link', id: 'gacha', label: `👉 点「去游戏里看」（${LINKS.gacha.label}）` }, say: '游戏内公示面板读的是同一个出口——调完参，页面上的数字同步变了。', watch: '觅珍页的公示表 = 你刚调的比例（同一个 poolOdds 出口）' },
  { n: 6, title: '还原', act: { type: 'reset', label: '👉 点「♻ 全部重置」' }, say: '全部是会话内存——点重置或刷新页面即回到基线，什么都不调 = 对游戏零影响。', watch: '生效数归零、验收线恢复全 ✅' },
]
function runScriptAct(step) {
  const a = step.act
  if (a.type === 'preset') applyPreset(PRESETS.find((p) => p.id === a.id))
  else if (a.type === 'link') goLook(a.id)
  else if (a.type === 'reset') resetAll()
  else if (a.type === 'evidence') runEvidence()
}

/** 头部速览：三条链的末环收益指标——任何屏幕（含窄屏单列）拖动滑杆时都看得见 */
const heads = computed(() => {
  ver.value
  const c = chains.value
  const combat = c.find((x) => x.id === 'combat')
  const craft = c.find((x) => x.id === 'craft')
  const gacha = c.find((x) => x.id === 'gacha')
  return [
    { label: '单场时长', ...combat.nodes[2] },
    { label: '战斗经验/时', ...combat.nodes[4] },
    { label: '制作升级时长', ...craft.nodes[3] },
    { label: '混池回收率', ...gacha.nodes[2] },
  ].filter((x) => x.baseShow)
})

/** 👁 单点对照（不构成链条的直读项） */
/** 👁 单点对照（不构成链条的直读项）：概率产出 / 精通 / 转生 / 攻速 / 保底 / 离线 */
const direct = computed(() => {
  ver.value
  const rows = [
    { label: '敌人掉落 25%', base: scaleChance(0.25, DIFFICULTY.drop, CHANCE_FLOOR.drop), cur: dropChance(0.25), kind: 'pct' },
    { label: '制作成功率 60%', base: scaleChance(0.6, DIFFICULTY.craft, CHANCE_FLOOR.craft), cur: craftSuccessChance(0.6), kind: 'pct' },
    { label: '探索成功率 40%', base: scaleChance(0.4, DIFFICULTY.explore, CHANCE_FLOOR.explore), cur: exploreSuccessChance(0.4), kind: 'pct' },
    { label: '采集附产 50%', base: scaleChance(0.5, DIFFICULTY.gatherExtra, CHANCE_FLOOR.gatherExtra), cur: gatherExtraChance(0.5), kind: 'pct' },
    { label: '精通 Lv100 经验倍率', base: 1 + (masteryXpMultiplierRaw(100) - 1) * MASTERY_XP_BONUS_SCALE, cur: masteryXpMultiplier(100), kind: 'x' },
    { label: '低目标衰减（Lv30 做 Lv20）', base: LOW_TARGET_XP_MULT, cur: targetLevelXpMult(30, 20, 40), kind: 'x' },
    { label: 'Lv26 对 Lv30 算不算低目标', base: isLowTarget(30, 26, 40) ? 1 : 0, cur: isLowTarget(30, 26, 40) ? 1 : 0, kind: 'bool' },
    { label: '转生 1 层经验加成', base: PRESTIGE_XP_BONUS, cur: tunerOver('prestigeXpBonus', PRESTIGE_XP_BONUS, 0, 1), kind: 'pct' },
    { label: '攻速地板', base: COMBAT_SPEED_FLOOR_SEC, cur: tunerOver('speedFloor', COMBAT_SPEED_FLOOR_SEC, 0.4, COMBAT_SPEED_BASE_SEC), kind: 'n', unit: 's' },
    { label: '攻速到顶等级', base: Math.ceil((COMBAT_SPEED_BASE_SEC - COMBAT_SPEED_FLOOR_SEC) / COMBAT_SPEED_DECAY_PER_LEVEL), cur: combatSpeedCapLevel(), kind: 'n' },
    { label: 'L30 敌人血量（基础 100）', base: Math.round(100 * 1.8), cur: scaledEnemy({ level: 30, hp: 100 }).hp, kind: 'n' },
    { label: '厨具/限时 稀有保底（抽）', base: PITY_RULES.gear.rare, cur: pityRuleOf('gear').rare, kind: 'n' },
    { label: '混池 稀有保底（抽）', base: PITY_RULES.mix.rare, cur: pityRuleOf('mix').rare, kind: 'n' },
    { label: '限时池出装备率', base: LIMITED_GEAR_PCT, cur: tunerOver('limitedGearPct', LIMITED_GEAR_PCT, 0, 1), kind: 'pct' },
    { label: '离线结算上限（含加成）', base: OFFLINE_CAP.baseHours, cur: player.offlineMaxHours?.() ?? OFFLINE_CAP.baseHours, kind: 'h' },
  ]
  return rows.map((r) => {
    const nb = Number(r.base)
    const nc = Number(r.cur)
    const changed = String(r.base) !== String(r.cur)
    const d = !changed || !nb ? null : ((nc - nb) / nb) * 100
    const show = (v) =>
      r.kind === 'pct' ? pct(v) : r.kind === 'x' ? '×' + fmt(v) : r.kind === 'bool' ? (v ? '是' : '否') : fmt(v) + (r.unit ?? (r.kind === 'h' ? 'h' : ''))
    return { ...r, baseText: show(r.base), curText: show(r.cur), delta: d == null ? null : dText(d), dir: d == null ? '' : d > 0 ? 'up' : 'down', changed }
  })
})
</script>

<template>
  <!-- 整页接管（与开发者页面同一形态）：铺满视口，覆盖在游戏/启动页之上 -->
  <div class="tunerpage" :class="{ 'tp-demo': demo }">
    <header class="tp-head">
      <h3>🎛 运营调参</h3>
      <span class="tp-badge">运营调参员 · 仅开发构建</span>
      <span class="tp-chip" :class="{ hot: activeCount > 0 }">
        {{ activeCount > 0 ? `调参生效中：${activeCount} 项` : '全部为基线值（零影响）' }}
      </span>
      <span class="tp-actions">
        <button class="btn btn-sm" :class="{ 'btn-primary': demo }" title="投影仪大字版：隐藏滑杆与长表，只留预设 / 验收线 / 四条链" @click="demo = !demo">{{ demo ? '🔎 演示模式：开' : '🔎 演示模式' }}</button>
        <button class="btn btn-sm" title="当场校验：覆盖生效 + 存档指纹一致 + 存储未增长" @click="runEvidence()">🔍 零副作用校验</button>
        <button class="btn btn-sm" @click="goBack()">↩ 返回</button>
        <button class="btn btn-sm" title="锁定（清除本次会话的登录）" @click="lockNow()">🔒 锁定</button>
      </span>
    </header>

    <!-- 🎬 一键情景 -->
    <div class="tp-presets">
      <span class="dim tp-presets-label">🎬 一键情景：</span>
      <button v-for="p in PRESETS" :key="p.id" class="btn btn-sm tp-preset" :title="p.hint" @click="applyPreset(p)">{{ p.label }}</button>
      <button class="btn btn-sm" :disabled="activeCount === 0" @click="resetAll()">♻ 全部重置</button>
    </div>

    <!-- ① 验收线：标定带判据（带内 ✅ / 带外 ⚠️） -->
    <div class="tp-bands">
      <span class="dim tp-presets-label">🔗 验收线：</span>
      <span v-for="b in verdicts" :key="b.id" class="tp-band-chip" :class="[b.inBand ? 'ok' : 'bad', { changed: b.changed }]" :title="b.note">
        {{ b.inBand ? '✅' : '⚠️' }} {{ b.label }}
        <b v-if="b.changed">{{ b.baseText }} → {{ b.curText }}</b>
        <b v-else>{{ b.curText }}</b>
        <span v-if="b.delta" class="tp-delta" :class="b.dir">{{ b.delta }}</span>
        <span class="dim">{{ b.range }}</span>
      </span>
    </div>

    <div v-if="ui.phase !== 'game'" class="dim tp-hint">
      ⚠️ 当前在启动页：深链「去游戏里看」不可用——先点「↩ 返回」进入游戏，再按 Ctrl+Shift+D 打开本页。
    </div>

    <!-- ⑤ 零副作用校验结果 -->
    <div v-if="evidence" class="tp-evidence">
      <div class="tp-ev-head">
        <b>🔍 零副作用校验</b>
        <span class="dim">（{{ evidence.at }} · 校验期间临时施加 3 项覆盖后已原样恢复）</span>
        <button class="btn btn-sm" title="关闭结果" @click="evidence = null">✕</button>
      </div>
      <div class="tp-ev-line" :class="evidence.probe.activeCount >= 3 ? 'ok' : 'bad'">
        {{ evidence.probe.activeCount >= 3 ? '✅' : '⚠️' }} 覆盖确已生效：生效 {{ evidence.probe.activeCount }} 项（全局经验 ×{{ evidence.probe.xp }} · 敌人血量 ×{{ evidence.probe.enemy }} · 5 件材料用量 {{ evidence.probe.qty }}）
      </div>
      <div class="tp-ev-line" :class="evidence.saveOk ? 'ok' : 'bad'">
        {{ evidence.saveOk ? '✅' : '⚠️' }} 存档指纹一致：SHA-256 {{ evidence.hash }}…（调参未被写进任何存档字段）
      </div>
      <div class="tp-ev-line" :class="evidence.lsOk ? 'ok' : 'bad'">
        {{ evidence.lsOk ? '✅' : '⚠️' }} 存储未增长：localStorage {{ evidence.lsKeys }} 键 / {{ evidence.lsKb }} KB 前后一致
      </div>
      <div class="dim tp-ev-note">⇒ 结论：调参只活在会话内存（模块级覆盖），数据文件与存档零影响；刷新页面即全部还原。</div>
    </div>

    <div class="tp-body">
      <div class="tp-grid">
        <!-- 左：滑杆列（演示模式隐藏） -->
        <div class="tp-col tp-col-l">
          <div v-for="g in GROUPS" :key="g.id" class="tp-group">
            <h4>{{ g.label }}</h4>
            <p class="dim tp-note">{{ g.note }}</p>
            <div v-for="r in rowsOf(g.id)" :key="r.key" class="tp-row" :class="{ mod: r.modified }">
              <div class="tp-row-head">
                <b>{{ r.label }}</b>
                <span class="dim mono">基线 {{ fmt(r.base) }} → 生效 <strong>{{ fmt(r.eff) }}</strong></span>
                <button v-if="r.modified" class="btn btn-sm" @click="resetKey(r)">↩ 复原</button>
              </div>
              <input type="range" :min="r.min" :max="r.max" :step="r.step" :value="r.eff" @input="setVal(r, $event.target.value)" />
            </div>
          </div>
        </div>

        <!-- 右：影响链（粘性）+ 单点对照（演示模式隐藏长表） -->
        <div class="tp-col tp-col-side">
          <div class="tp-group tp-impact">
            <h4>🔗 影响链（基线 → 当前）</h4>
            <div v-for="c in chains" :key="c.id" class="tp-chain" :class="{ hot: c.nodes.some((n) => n.changed) }">
              <div class="tp-chain-title">
                {{ c.title }}
                <button class="btn btn-sm tp-go" :disabled="ui.phase !== 'game'" :title="ui.phase !== 'game' ? '先返回并进入游戏（启动页阶段没有落点）' : `跳到${c.link}`" @click="goLook(c.id)">去游戏里看 →</button>
              </div>
              <div class="tp-chain-nodes">
                <template v-for="(n, i) in c.nodes" :key="n.label">
                  <span v-if="i" class="tp-arrow">→</span>
                  <span class="tp-node" :class="{ hot: n.changed, flat: !n.changed }">
                    <span class="dim tp-node-label">{{ n.label }}</span>
                    <span class="mono tp-node-val">{{ n.baseShow }} → {{ n.curShow }}</span>
                    <span v-if="n.delta" class="tp-delta" :class="n.dir">{{ n.delta }}</span>
                  </span>
                </template>
              </div>
              <p class="dim tp-chain-note">{{ c.note }}</p>
            </div>
          </div>

          <div class="tp-group tp-impact tp-direct-box">
            <h4>📋 单点对照</h4>
            <div class="tp-direct">
              <div v-for="r in direct" :key="r.label" class="tp-direct-item" :class="{ hot: r.changed }">
                <span class="dim">{{ r.label }}</span>
                <span class="mono">{{ r.baseText }} <b>→ {{ r.curText }}</b></span>
                <span v-if="r.delta" class="tp-delta" :class="r.dir">{{ r.delta }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ③ 演示脚本（答辩动线） -->
      <details class="tp-script">
        <summary>🎤 演示脚本（六步动线 · 点开照着讲）</summary>
        <ol class="tp-script-list">
          <li v-for="s in SCRIPT" :key="s.n">
            <div class="tp-script-head">
              <b>{{ s.n }}. {{ s.title }}</b>
              <button class="btn btn-sm" @click="runScriptAct(s)">{{ s.act.label }}</button>
            </div>
            <div class="tp-script-say">讲解：{{ s.say }}</div>
            <div class="dim tp-script-watch">观察：{{ s.watch }}</div>
          </li>
        </ol>
      </details>

      <p class="dim tp-note tp-foot-note">
        三条红线：① 只动<b>运行时系数读取点</b>，数据文件一字不改；② 改动只活在本页会话内存，不进存档、不写文件，刷新即还原；
        ③ 什么都不调 = 对游戏零影响（基线逐字节等价，system_test 有 20 条断言）。调参员角色<b>没有</b>任何存档与破坏性操作——那是开发者（ShiShen）的权限。<br />
        ⚠️ 调参期间游戏内的攻略/说明文案仍按<b>基线</b>描述（它们写的是标定口径），别把它当成 bug。
      </p>
    </div>
  </div>
</template>

<style scoped>
.tunerpage { position: fixed; inset: 0; z-index: 999; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; color: var(--text); }
.tp-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 14px; border-bottom: 1px dashed var(--border); background: rgba(var(--panel-rgb), 0.9); }
.tp-head h3 { margin: 0; font-size: 15px; }
.tp-badge { font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px dashed var(--warn); color: var(--warn); }
.tp-chip { font-size: 12px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); background: rgba(var(--panel-rgb), 0.7); }
.tp-chip.hot { color: var(--warn); border-color: rgba(var(--warn-rgb), 0.55); }
.tp-actions { margin-left: auto; display: flex; gap: 6px; }

/* 🎬 一键情景行 + 🔗 验收线行 */
.tp-presets { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 14px 0; }
.tp-presets-label { font-size: 12px; }
.tp-preset { border-color: rgba(var(--primary-rgb), 0.5); }
.tp-bands { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 14px 0; }
.tp-band-chip { display: inline-flex; align-items: baseline; gap: 6px; font-size: 12px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border); background: rgba(var(--panel-rgb), 0.6); }
.tp-band-chip.ok { border-color: rgba(var(--good-rgb), 0.5); }
.tp-band-chip.bad { border-color: rgba(var(--bad-rgb), 0.6); background: rgba(var(--bad-rgb), 0.07); }
.tp-band-chip.bad b { color: var(--bad-strong); }

/* ⑤ 零副作用校验结果 */
.tp-evidence { margin: 8px 14px 0; padding: 8px 12px; border: 1px solid rgba(var(--good-rgb), 0.45); border-radius: 10px; background: rgba(var(--good-rgb), 0.06); font-size: 12px; }
.tp-ev-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tp-ev-head button { margin-left: auto; }
.tp-ev-line { margin-top: 4px; }
.tp-hint { margin: 8px 14px 0; font-size: 12px; }
.tp-band-chip.changed b { font-weight: 700; }
.tp-ev-line.ok { color: var(--good-strong); }
.tp-ev-line.bad { color: var(--bad-strong); }
.tp-ev-note { margin-top: 4px; font-size: 11.5px; }

/* 头部速览条 */
.tp-heads { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 14px 0; }
.tp-head-chip { display: inline-flex; align-items: baseline; gap: 6px; font-size: 12px; padding: 3px 10px; border-radius: 999px; border: 1px solid rgba(var(--warn-rgb), 0.45); background: rgba(var(--warn-rgb), 0.06); }
.tp-head-chip .dim { font-size: 11px; }
.tp-head-chip b { font-weight: 700; }
.tp-head-chip.up b { color: var(--good-strong); }
.tp-head-chip.down b { color: var(--bad-strong); }
.tp-head-chip.flat { opacity: 0.55; border-color: var(--border); background: rgba(var(--panel-rgb), 0.5); }

.tp-body { flex: 1; overflow-y: auto; padding: 12px 14px; }
.tp-grid { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr); gap: 16px; align-items: start; }
.tp-col { min-width: 0; display: flex; flex-direction: column; gap: 12px; }
.tp-col-side { position: sticky; top: 0; align-self: start; }
@media (max-width: 1100px) {
  .tp-grid { grid-template-columns: 1fr; }
  .tp-col-side { position: static; }
}

.tp-group { margin-bottom: 2px; }
.tp-group h4 { margin: 0 0 4px; font-size: 13.5px; }
.tp-note { font-size: 12px; line-height: 1.6; margin: 0 0 8px; }
.tp-row { border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; margin-bottom: 8px; background: rgba(var(--panel-rgb), 0.55); }
.tp-row.mod { border-color: rgba(var(--warn-rgb), 0.55); }
.tp-row-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; font-size: 13px; }
.tp-row-head .mono { font-size: 12px; }
.tp-row input[type='range'] { width: 100%; accent-color: var(--primary); }

.tp-impact { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; background: rgba(var(--panel-rgb), 0.45); }
.tp-impact h4 { margin: 0 0 8px; }
.tp-chain { border: 1px dashed rgba(var(--tint-rgb), 0.25); border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; }
.tp-chain.hot { border-color: rgba(var(--warn-rgb), 0.5); background: rgba(var(--warn-rgb), 0.05); }
.tp-chain-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12.5px; font-weight: 700; margin-bottom: 6px; }
.tp-go { font-weight: 400; }
.tp-chain-nodes { display: flex; align-items: stretch; gap: 4px; flex-wrap: wrap; }
.tp-arrow { align-self: center; color: var(--muted); font-size: 12px; }
.tp-node { display: flex; flex-direction: column; gap: 1px; padding: 4px 8px; border-radius: 8px; background: rgba(var(--panel-rgb), 0.75); border: 1px solid var(--border); min-width: 0; }
.tp-node.hot { border-color: rgba(var(--warn-rgb), 0.5); }
.tp-node.flat { opacity: 0.5; }
.tp-node-label { font-size: 11px; }
.tp-node-val { font-size: 12px; white-space: nowrap; }
.tp-delta { font-size: 11px; font-weight: 700; }
.tp-delta.up { color: var(--good-strong); }
.tp-delta.down { color: var(--bad-strong); }
.tp-chain-note { font-size: 11px; line-height: 1.55; margin: 6px 0 0; }

.tp-direct { display: flex; flex-direction: column; gap: 2px; }
.tp-direct-item { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 3px 0; border-bottom: 1px dashed rgba(var(--tint-rgb), 0.18); }
.tp-direct-item .dim { flex: 1; min-width: 0; }
.tp-direct-item.hot .mono b { color: var(--warn); }

/* ③ 演示脚本 */
.tp-script { margin-top: 12px; border: 1px solid var(--border); border-radius: 12px; padding: 8px 12px; background: rgba(var(--panel-rgb), 0.45); }
.tp-script summary { cursor: pointer; font-size: 13px; font-weight: 700; }
.tp-script-list { margin: 8px 0 0; padding-left: 18px; }
.tp-script-list li { margin-bottom: 8px; font-size: 12px; }
.tp-script-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tp-script-say { margin-top: 2px; }
.tp-script-watch { font-size: 11.5px; }
.tp-foot-note { margin-top: 12px; }

/* ⑥ 演示模式（投影仪大字版） */
.tp-demo { font-size: 16px; }
.tp-demo .tp-col-l { display: none; }
.tp-demo .tp-direct-box { display: none; }
.tp-demo .tp-grid { grid-template-columns: 1fr; }
.tp-demo .tp-col-side { position: static; }
.tp-demo .tp-impact h4 { font-size: 18px; }
.tp-demo .tp-chain-title { font-size: 16px; }
.tp-demo .tp-node-label { font-size: 13px; }
.tp-demo .tp-node-val { font-size: 15px; }
.tp-demo .tp-delta { font-size: 14px; }
.tp-demo .tp-chain-note { font-size: 13px; }
.tp-demo .tp-band-chip { font-size: 15px; padding: 5px 14px; }
.tp-demo .tp-preset { font-size: 15px; padding: 6px 14px; }
.tp-demo .tp-script-list li { font-size: 14px; }
</style>
