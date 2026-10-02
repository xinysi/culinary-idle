<script setup>
// 运营工作台（2026-10-02：由第四角色「运营调参员」重构为「运营 ops」）——**只在含开发者模式的构建里存在**
//
// 定位（用户 2026-10-02 拍板「3+2」）：两分区，都是**只读 / 会话安全**、无任何存档与破坏性操作。
//   · 📊 运营驾驶舱：聚合本机存档 + 本机埋点，出「进度概览 / 新手漏斗 / 经济水位 / 道具 TopN / 标定对照」，
//     可导出 Markdown / CSV（论文与周报直接可用）。**零写操作**。
//   · 🧪 平衡实验台：沿用原「运营调参」的能力——运行时系数覆盖 + 四条影响链 + 验收线 + 一键情景 +
//     零副作用校验 + 演示脚本。覆盖只活在本页会话内存，刷新即还原。
//
// 🔴 三条红线（机制在 game/data/tuner.js，这里只负责呈现）：
//   ① 只动读取点——数据文件一字不改；② 纯会话内存态——刷新页面即全部还原，不进存档；
//   ③ 默认零操作 = 零影响（system_test/mijian_test 的 C9b 有断言钉住默认零影响 / 覆盖生效 / 夹取 / 复位）。
//   ✳️ 驾驶舱更严：它是**只读契约**（ops_analytics_audit 断言聚合前后 store 逐字段一致）。
import { computed, ref } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { usePlayerStore } from '../stores/player.js'
import { devLogout } from '../game/dev/devFlag.js'
import { sha256Hex } from '../game/dev/hash.js'
import { DIFFICULTY, CHANCE_FLOOR, scaleChance, dropChance, craftSuccessChance, exploreSuccessChance, gatherExtraChance } from '../game/data/difficulty.js'
import { MATERIAL_COST_MULT, materialQty } from '../game/data/materialCost.js'
import { XP_STACK_DAMPING, XP_TAIL_RATE, LOW_TARGET_XP_MULT, LOW_TARGET_GAP, targetLevelXpMult, isLowTarget } from '../game/core/growthRate.js'
import { MASTERY_XP_BONUS_SCALE, masteryXpMultiplier, masteryXpMultiplierRaw } from '../game/core/mastery.js'
import { PRESTIGE_XP_BONUS } from '../game/skills/Skill.js'
import { combatSpeedCapLevel, COMBAT_RESPAWN_SEC, COMBAT_SPEED_BASE_SEC, COMBAT_SPEED_FLOOR_SEC, COMBAT_SPEED_DECAY_PER_LEVEL, OFFLINE_CAP } from '../game/data/caps.js'
import { scaledEnemy } from '../game/data/enemyScaling.js'
import { REFUND_PCT, MIX_BRANCH, SOFT_MAX_P, LIMITED_GEAR_PCT, PITY_RULES, pityRuleOf } from '../game/data/mijianDraws.js'
import { tunerOver, tunerSet, tunerResetKey, tunerResetAll, tunerRawValue, tunerActiveKeys } from '../game/data/tuner.js'
// 🧪 平衡实验台引擎（四条链的每一环 + A/B 对比，唯一真身）
import { projectionGroups, runComparison, currentOverrideMap, LAB_SCENARIOS } from '../game/dev/balanceLab.js'
// 📅 运营日历（只读）
import { collectCalendar, scheduleExport, scheduleMarkdown, todayBoostText, WEEKDAYS } from '../game/dev/opsCalendar.js'
// 📊 驾驶舱（只读）
import { collectDashboard } from '../game/dev/opsAnalytics.js'
import { readTelemetry, FIRST_MARKS } from '../game/dev/telemetry.js'
import { buildMarkdown, buildCsv, downloadText } from '../game/dev/opsReport.js'
import { bandOf, bandRangeText, OPS_CALIBRATION, hoursText } from '../game/dev/opsBenchmarks.js'

const ui = useUiStore()
const player = usePlayerStore()
const ver = ref(0) // 调参模块不是响应式的：每次改动 bump 一次刷新显示
const demo = ref(false) // 演示模式（大字、隐藏滑杆与长表）
const evidence = ref(null) // 零副作用校验结果
const tab = ref('dash') // 'dash' 运营驾驶舱 | 'lab' 平衡实验台 | 'cal' 运营日历
const railMin = ref(false) // 左栏折叠为仅图标
/** 各分区标题（顶部命令条用） */
const TITLES = {
  dash: { t: '运营驾驶舱', s: '本机存档 + 本机埋点聚合 · 纯只读' },
  lab: { t: '平衡实验台', s: '运行时系数覆盖 · 会话内存 · 刷新即还原' },
  cal: { t: '运营日历', s: '限时活动 + 节庆排期 · 只读展示' },
}

/* ═══════════════ 📊 运营驾驶舱（只读） ═══════════════ */
const dash = computed(() => {
  ver.value
  // 只读聚合：不动 player 任何字段（ops_analytics_audit 断言聚合前后逐字段一致）
  return collectDashboard(player, { telemetry: readTelemetry(), marks: FIRST_MARKS })
})
const benchRows = computed(() => [
  { label: '采摘', text: hoursText(OPS_CALIBRATION.gatherHours) },
  { label: '垂钓', text: `${OPS_CALIBRATION.fishingDays} 天` },
  { label: '狩猎', text: hoursText(OPS_CALIBRATION.huntingHours) },
  { label: '挖掘', text: hoursText(OPS_CALIBRATION.excavationHours) },
  { label: '农耕', text: `${OPS_CALIBRATION.farmingDays} 天` },
  { label: '保鲜', text: hoursText(OPS_CALIBRATION.preserveHours) },
  { label: '食灵召唤', text: hoursText(OPS_CALIBRATION.spiritHours) },
  { label: '美食探索', text: `${OPS_CALIBRATION.exploreDays} 天` },
  { label: '战斗三技能', text: `${OPS_CALIBRATION.combatDays} 天` },
])
function exportMd() {
  const ok = downloadText(`ops-snapshot-${Date.now()}.md`, buildMarkdown(dash.value), 'text/markdown')
  ui.pushLog(ok ? '📊 已导出运营快照（Markdown）' : '⚠️ 导出失败（浏览器不支持下载？）', ok ? 'info' : 'warn')
}
function exportCsv() {
  const ok = downloadText(`ops-snapshot-${Date.now()}.csv`, buildCsv(dash.value), 'text/csv')
  ui.pushLog(ok ? '📊 已导出运营快照（CSV）' : '⚠️ 导出失败（浏览器不支持下载？）', ok ? 'info' : 'warn')
}
const fmtN = (v) => Number(v ?? 0).toLocaleString()
const fmtSec = (s) => (s == null ? '—' : s >= 3600 ? `${(s / 3600).toFixed(1)}h` : s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`)
/** KPI 条：第一眼先看这里（数值来源同 dash，不另算） */
const kpis = computed(() => {
  const o = dash.value.overview
  return [
    { ico: '🪙', label: '金币', value: fmtN(o.gold) },
    { ico: '🎯', label: '最高技能', value: `Lv${o.maxLevel}` },
    { ico: '🌀', label: '转生', value: o.prestiges },
    { ico: '🗼', label: '挑战塔', value: `F${o.towerBest}` },
    { ico: '⭐', label: '米其林', value: `${o.michelinStars}★` },
    { ico: '🏅', label: '成就', value: `${o.achievements.count}/${o.achievements.total}` },
    { ico: '📖', label: '图鉴', value: `${o.collected.count}/${o.collected.total}` },
    { ico: '⏱', label: '离线上限', value: `${o.offlineHours}h` },
  ]
})

/* ═══════════════ 📅 运营日历（只读排期） ═══════════════ */
const calendar = computed(() => { ver.value; return collectCalendar() })
const evById = computed(() => Object.fromEntries(calendar.value.marketEvents.map((e) => [e.id, e])))
function exportCalJson() {
  const ok = downloadText(`ops-calendar-${Date.now()}.json`, JSON.stringify(scheduleExport(), null, 2), 'application/json')
  ui.pushLog(ok ? '📅 已导出运营排期（JSON）' : '⚠️ 导出失败（浏览器不支持下载？）', ok ? 'info' : 'warn')
}
function exportCalMd() {
  const ok = downloadText(`ops-calendar-${Date.now()}.md`, scheduleMarkdown(), 'text/markdown')
  ui.pushLog(ok ? '📅 已导出运营排期（Markdown）' : '⚠️ 导出失败（浏览器不支持下载？）', ok ? 'info' : 'warn')
}
const todayText = computed(() => todayBoostText(calendar.value.today))

/* ═══════════════ 🧪 平衡实验台（沿用原·运营调参） ═══════════════ */

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
  // 叠区二级饱和的「尾巴」（2026-09-29）：超界部分仍按此比例计入 ⇒ 调成 0 就是硬夹（高阶档位会与低档拉平，别调 0）
  { group: 'grow', key: 'xpTailRate', label: '叠区饱和尾巴（0=硬夹）', base: XP_TAIL_RATE, min: 0, max: 1, step: 0.01 },
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

/** 🎬 一键情景：先清空再套用（预设之间互不残留）。情景定义来自 balanceLab（唯一真身） */
const PRESETS = LAB_SCENARIOS
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
  ui.showOpsPanel = false
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
  ui.showOpsPanel = false
}
function lockNow() {
  devLogout()
  ui.showOpsPanel = false
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

/** 池回收率已移到 `game/dev/balanceLab.js`（唯一真身，与 scripts/sim/mijian_economy.mjs 同口径） */

/** 🔗 四条影响链——每一环由 `balanceLab` 的投影算出（唯一真身）。末环统一落在「时长 / 速率 / 回收率」 */
const chains = computed(() => {
  ver.value
  const { combat, growth, craft, gacha } = projectionGroups()
  const out = []

  out.push({
    id: 'combat',
    title: '⚔️ 战斗节奏链',
    link: LINKS.combat.label,
    note: '参考 L40 对手、5 回合。经验按造成伤害给且单场封顶「期望血量 ×2」——血量超过 ×2 后经验不再涨，只涨时长。',
    nodes: [
      mkNode('敌人血量', 1, combat.hpMult, { baseShow: '×1', curShow: '×' + fmt(combat.hpMult) }),
      mkNode('单场回合', combat.roundsBase, combat.roundsCur, { round: true }),
      mkNode('单场时长（含重生）', combat.ttkBase, combat.ttkCur, { unit: 's' }),
      mkNode('击杀 / 时', combat.kBase, combat.kCur, { round: true }),
      mkNode('战斗经验 / 时', combat.kBase, combat.xpCur, { round: true }),
    ],
  })

  out.push({
    id: 'grow',
    title: '🧭 成长叠区链',
    link: LINKS.grow.label,
    note: '示例：转生 × 增益剂 × 设置 × 追赶 × 市场的乘积为 ×10 时。阻尼只压缩乘积、不改各层档间差距；卡片缩放与全局倍率依次乘上去。',
    nodes: [
      mkNode('卡片经验缩放', 1, growth.card, { baseShow: '×1', curShow: '×' + fmt(growth.card) }),
      mkNode('叠区阻尼后（乘积 ×10）', growth.dampBase, growth.dampCur, { suffix: '×' }),
      mkNode('全局经验倍率', 1, growth.g, { baseShow: '×1', curShow: '×' + fmt(growth.g) }),
      mkNode('经验速率', growth.rateBase, growth.rateCur, { suffix: '×' }),
      mkNode('满级所需时长（相对）', 1, growth.rateBase / growth.rateCur, { baseShow: '×1', suffix: '×' }),
    ],
  })

  out.push({
    id: 'craft',
    title: '🧺 制作与升级时长链',
    link: LINKS.craft.label,
    note: '材料限速（715/715 条配方都是「等材料」而非「等队列」）⇒ 用量涨多少，收料时间与制作类升级时长就涨多少。',
    nodes: [
      mkNode('材料成本倍率', MATERIAL_COST_MULT, craft.mc, { baseShow: '×' + fmt(MATERIAL_COST_MULT), curShow: '×' + fmt(craft.mc) }),
      mkNode('单件用量（5 件基准）', craft.qtyBase, craft.qtyCur),
      mkNode('单件收料时长', 1, craft.qtyCur / craft.qtyBase, { baseShow: '×1', suffix: '×' }),
      mkNode('制作类升级时长', 1, craft.qtyCur / craft.qtyBase, { baseShow: '×1', suffix: '×' }),
    ],
  })

  out.push({
    id: 'gacha',
    title: '🎲 抽卡经济链（混池 80 价）',
    link: LINKS.gacha.label,
    note: '回收率 = (金币返还 + 物品价值 ×0.5) ÷ 池价，标定带 10~30%（2026-09-26 由 30~40% 下调：返金 35%→20%）。返金档与正常分支此消彼长：正常分支（装备）越重，回收率越高。',
    nodes: [
      mkNode('返金比例', Math.round(REFUND_PCT * 100), Math.round(tunerOver('refundPct', REFUND_PCT, 0, 1) * 100), { unit: '%' }),
      mkNode('混池返金额', gacha.refundBase, gacha.refundCur, { unit: '金' }),
      mkNode('混池回收率', Math.round(gacha.recBase * 1000) / 10, Math.round(gacha.recCur * 1000) / 10, { unit: '%' }),
    ],
  })
  return out
})

/** ① 验收线：判据（lo/hi/区间文案）一律读 opsBenchmarks 的 OPS_BANDS —— 页面不手抄标定值 */
const VERDICT_SPEC = [
  { id: 'ttk', chain: 'combat', node: 2, kind: 'sec' },
  { id: 'xpRate', chain: 'combat', node: 4, kind: 'rate100' },
  { id: 'craftTime', chain: 'craft', node: 3, kind: 'ratio' },
  { id: 'recycle', chain: 'gacha', node: 2, kind: 'pct' },
]
const verdicts = computed(() => {
  ver.value
  const c = chains.value
  const node = (cid, i) => c.find((x) => x.id === cid).nodes[i]
  const mkFmt = (kind) => {
    if (kind === 'sec') return (v) => fmt(v) + 's'
    if (kind === 'rate100') return (v) => fmt(Math.round(v))
    if (kind === 'ratio') return (v) => '×' + fmt(v)
    return (v) => fmt(Math.round(v * 10) / 10) + '%'
  }
  const baseOf = { ttk: (n) => n[2].base, xpRate: () => 100, craftTime: () => 1, recycle: (n) => n[2].base }
  const valOf = {
    ttk: (n) => n[2].cur,
    xpRate: (n) => (n[4].cur / n[4].base) * 100,
    craftTime: (n) => n[3].cur,
    recycle: (n) => n[2].cur,
  }
  return VERDICT_SPEC.map((spec) => {
    const b = bandOf(spec.id)
    const n = c.find((x) => x.id === spec.chain).nodes
    const fmtOf = mkFmt(spec.kind)
    const value = valOf[spec.id](n)
    const baseValue = baseOf[spec.id](n)
    const ch = value !== baseValue
    const d = !ch || !baseValue ? null : ((value - baseValue) / baseValue) * 100
    return {
      id: spec.id,
      label: b.label,
      lo: b.lo,
      hi: b.hi,
      note: b.note,
      range: ' · ' + bandRangeText(spec.id),
      inBand: value >= b.lo && value <= b.hi,
      changed: ch,
      baseText: fmtOf(baseValue),
      curText: fmtOf(value),
      delta: d == null ? null : dText(d),
      dir: d == null ? '' : d > 0 ? 'up' : 'down',
    }
  })
})

/** 🆚 A/B 对比：现状（当前滑杆）→ 选定情景，逐指标出 Δ 与「带内 / 带外」判定。
 *  组 A/B 各在自己的覆盖下算一次、算完即**原样恢复**用户滑杆（balanceLab.runComparison）。 */
const labScenario = ref('heavy')
const compared = ref(null)
const AB_LABEL = { ttk: '单场时长', xpRate: '战斗经验 / 时', craftTime: '制作升级时长', recycle: '混池回收率' }
const AB_FMT = {
  ttk: (v) => fmt(v) + 's',
  xpRate: (v) => fmt(Math.round(v)),
  craftTime: (v) => '×' + fmt(v),
  recycle: (v) => fmt(Math.round(v * 10) / 10) + '%',
}
function runAB() {
  const sc = PRESETS.find((p) => p.id === labScenario.value)
  if (!sc) return
  const { A, B } = runComparison(currentOverrideMap(), sc.sets)
  const rows = Object.keys(AB_LABEL).map((id) => {
    const a = A[id]
    const b = B[id]
    const ch = a !== b
    const d = !ch || !a ? null : ((b - a) / a) * 100
    const bd = bandOf(id)
    return {
      id, label: AB_LABEL[id],
      aText: AB_FMT[id](a), bText: AB_FMT[id](b),
      delta: d == null ? null : dText(d),
      dir: d == null ? '' : d > 0 ? 'up' : 'down',
      changed: ch,
      inBand: b >= bd.lo && b <= bd.hi,
    }
  })
  compared.value = { at: new Date().toLocaleTimeString(), scenario: sc.label, rows }
  ver.value++
  const tip = rows.map((r) => `${r.label} ${r.aText}→${r.bText}${r.delta ? `（${r.delta}）` : ''}`).join('，')
  ui.pushLog(`🆚 A/B 对比（现状 → ${sc.label}）：${tip}`, 'info')
}

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
  <!-- 整页接管（与开发者页面同一形态）：铺满视口，覆盖在游戏/启动页之上。
       外壳 = 左栏分区导航 + 主区命令条 + 单滚动内容（现代控制台骨架，2026-10-02 重排）。 -->
  <div class="opspage" :class="{ 'tp-demo': demo, 'ops-min': railMin }">
    <!-- ── 左栏：分区导航 ── -->
    <aside class="ops-tabs">
      <div class="ops-brand">
        <span class="ops-brand-ico">📊</span>
        <span class="ops-brand-txt"><b>运营工作台</b><em>仅开发构建</em></span>
      </div>
      <nav class="ops-navs">
        <button class="ops-nav" :class="{ on: tab === 'dash' }" @click="tab = 'dash'"><span class="ops-nav-ico">📊</span><span class="ops-nav-txt">运营驾驶舱</span></button>
        <button class="ops-nav" :class="{ on: tab === 'lab' }" @click="tab = 'lab'"><span class="ops-nav-ico">🧪</span><span class="ops-nav-txt">平衡实验台</span></button>
        <button class="ops-nav" :class="{ on: tab === 'cal' }" @click="tab = 'cal'"><span class="ops-nav-ico">📅</span><span class="ops-nav-txt">运营日历</span></button>
      </nav>
      <div class="ops-rail-foot">
        <span class="ops-chip" :class="{ hot: tab === 'lab' && activeCount > 0 }">{{ tab === 'lab' && activeCount > 0 ? `调参 ${activeCount} 项` : '零副作用' }}</span>
        <button class="ops-mini" :title="railMin ? '展开导航' : '折叠为图标'" @click="railMin = !railMin">{{ railMin ? '»' : '«' }}</button>
      </div>
    </aside>

    <!-- ── 主区 ── -->
    <div class="ops-main">
      <!-- 顶部命令条：标题 + 上下文动作（按分区切换） -->
      <header class="ops-topbar">
        <div class="ops-title">
          <h3>{{ TITLES[tab].t }}</h3>
          <span class="dim ops-sub">{{ TITLES[tab].s }}</span>
        </div>
        <div class="ops-actions">
          <span v-if="tab === 'lab'" class="tp-chip" :class="{ hot: activeCount > 0 }">{{ activeCount > 0 ? `生效 ${activeCount} 项` : '基线（零影响）' }}</span>
          <template v-if="tab === 'dash'">
            <button class="btn btn-sm btn-primary" @click="exportMd()">⬇ Markdown</button>
            <button class="btn btn-sm" @click="exportCsv()">⬇ CSV</button>
          </template>
          <template v-else-if="tab === 'cal'">
            <button class="btn btn-sm btn-primary" @click="exportCalMd()">⬇ Markdown</button>
            <button class="btn btn-sm" @click="exportCalJson()">⬇ JSON</button>
          </template>
          <template v-else>
            <button class="btn btn-sm" :class="{ 'btn-primary': demo }" title="投影仪大字版：隐藏滑杆与长表，只留预设 / 验收线 / 影响链" @click="demo = !demo">{{ demo ? '🔎 大字版：开' : '🔎 大字版' }}</button>
            <button class="btn btn-sm" title="当场校验：覆盖生效 + 存档指纹一致 + 存储未增长" @click="runEvidence()">🔍 零副作用校验</button>
          </template>
          <i class="ops-sep" />
          <button class="btn btn-sm" @click="goBack()">↩ 返回</button>
          <button class="btn btn-sm" title="锁定（清除本次会话的登录）" @click="lockNow()">🔒 锁定</button>
        </div>
      </header>

      <div class="ops-scroll">
        <!-- ═══════ 📊 运营驾驶舱 ═══════ -->
        <section v-if="tab === 'dash'" class="ops-pane">
          <!-- KPI 条：第一眼先看这里 -->
          <div class="ops-kpis">
            <div v-for="k in kpis" :key="k.label" class="ops-kpi">
              <span class="ops-kpi-ico">{{ k.ico }}</span>
              <span class="ops-kpi-val">{{ k.value }}</span>
              <span class="ops-kpi-label">{{ k.label }}</span>
            </div>
          </div>

          <div class="ops-2col">
            <!-- 主列：内容节奏（洞察）+ 新手漏斗 -->
            <div class="ops-col-main">
              <div class="ops-sec">
                <div class="ops-sec-h"><b>📅 内容节奏</b><span class="dim">每 10 级段新增内容条目 · 只读数据表</span></div>
                <div class="ops-cad">
                  <div v-for="r in dash.cadence" :key="r.label" class="ops-cad-row" :class="{ thin: r.total < dash.cadenceGaps.mean * 0.5 }">
                    <span class="ops-cad-label mono">{{ r.label }}</span>
                    <span class="ops-cad-bar"><i :style="{ width: ((r.total / (dash.cadenceGaps.max || 1)) * 100).toFixed(1) + '%' }" /></span>
                    <span class="mono">{{ r.total }}<span class="dim">（采{{ r.gather }}·制{{ r.craft }}·农{{ r.farm }}·探{{ r.explore }}）</span></span>
                  </div>
                </div>
                <p class="dim ops-note">口径 = 该段位新增的<b>采集目标 / 制作配方 / 农作物 / 探索目标</b>之和。<b>越往右越薄</b>是关键信号（末段 101–120 密度最低）；最薄三段：{{ dash.cadenceGaps.thinnest.map((x) => x.label).join(' · ') }}。</p>
              </div>

              <div class="ops-sec">
                <div class="ops-sec-h"><b>🧭 新手漏斗</b><span class="dim">{{ dash.funnelProgress.done }}/{{ dash.funnelProgress.total }} · {{ (dash.funnelProgress.pct * 100).toFixed(0) }}%</span></div>
                <div v-for="r in dash.funnel" :key="r.id" class="ops-funnel-row" :class="{ done: r.done }">
                  <span class="ops-dot">{{ r.done ? '✅' : '○' }}</span>
                  <span class="ops-funnel-label">{{ r.label }}</span>
                  <span class="mono dim">{{ r.done ? fmtSec(r.seconds) : '未达成' }}</span>
                </div>
              </div>
            </div>

            <!-- 侧列：经济 / 道具 -->
            <div class="ops-col-side">
              <div class="ops-sec">
                <div class="ops-sec-h"><b>💰 经济水位</b><span class="dim">按小时的可见部分</span></div>
                <div v-if="dash.economy.rows.length" class="ops-econ">
                  <div v-for="r in dash.economy.rows" :key="r.id" class="ops-econ-row">
                    <span class="ops-econ-label">{{ r.label }}</span>
                    <span class="ops-econ-bar"><i :style="{ width: (r.pct * 100).toFixed(1) + '%' }" /></span>
                    <span class="mono">{{ fmtN(r.goldPerHour) }}<span class="dim">/时</span></span>
                  </div>
                </div>
                <p v-else class="dim ops-empty">尚未产生时收（餐厅无菜单 / 无分店）。</p>
                <div class="ops-kv ops-total"><span class="dim">合计</span><b>{{ fmtN(dash.economy.total) }} 金/时</b></div>
                <p class="dim ops-note">金币获取加成 +{{ dash.economy.goldGainPct }}%（钱庄，夹 ≤15%）。地窖/商队/订单是块状收入，刻意不摊成时收。</p>
              </div>

              <div class="ops-sec">
                <div class="ops-sec-h"><b>📦 道具 TopN</b><span class="dim">背包持有量</span></div>
                <div v-for="r in dash.topItems" :key="r.id" class="ops-kv">
                  <span class="dim ops-ellipsis">{{ r.name }}</span>
                  <b>{{ fmtN(r.qty) }} <span class="dim">×{{ fmtN(r.value) }}</span></b>
                </div>
                <p v-if="!dash.topItems.length" class="dim ops-empty">背包为空。</p>
              </div>
            </div>
          </div>

          <div class="ops-sec">
            <div class="ops-sec-h"><b>🎯 标定对照</b><span class="dim">成长时长 · 2026-09-28 实测，限时窗口已桩</span></div>
            <div class="ops-bench">
              <span v-for="b in benchRows" :key="b.label" class="ops-bench-chip"><span class="dim">{{ b.label }}</span> <b>{{ b.text }}</b></span>
              <span class="ops-bench-chip"><span class="dim">单场（中位）</span> <b>{{ OPS_CALIBRATION.ttkMedianSec }}s</b></span>
              <span class="ops-bench-chip"><span class="dim">满配时收</span> <b>{{ fmtN(OPS_CALIBRATION.endgameGoldPerHour) }}/时</b></span>
            </div>
            <p class="dim ops-note">{{ OPS_CALIBRATION.note }}。引用成长时长一律用这张表，别用记忆里的旧数。</p>
          </div>
        </section>

        <!-- ═══════ 📅 运营日历 ═══════ -->
        <section v-else-if="tab === 'cal'" class="ops-pane">
          <!-- 主角：本周排班 -->
          <div class="ops-sec">
            <div class="ops-sec-h"><b>🗓️ 本周限时活动排班</b><span class="dim">格 = 该小时是否有活动；悬停看名字</span></div>
            <div class="ops-cal-grid">
              <div v-for="(row, w) in calendar.grid" :key="w" class="ops-cal-grow">
                <span class="ops-cal-glabel">{{ WEEKDAYS[w] }}</span>
                <span v-for="(ids, h) in row" :key="h" class="ops-cal-cell" :class="{ on: ids.length }" :title="ids.map((id) => evById[id]?.name ?? id).join('、')" />
              </div>
            </div>
            <div class="ops-cal-legend">
              <span v-for="e in calendar.marketEvents" :key="e.id" class="ops-bench-chip"><span class="dim">{{ e.icon }} {{ e.name }}</span> <b>{{ e.desc }}</b></span>
            </div>
          </div>

          <div class="ops-3col">
            <div class="ops-sec">
              <div class="ops-sec-h"><b>☀️ 今日</b><span class="dim">{{ calendar.today.date }} {{ calendar.today.weekday }}</span></div>
              <div class="ops-kv"><span class="dim">命中加成</span><b>{{ todayText }}</b></div>
            </div>
            <div class="ops-sec">
              <div class="ops-sec-h"><b>🎊 本月节庆</b></div>
              <div class="ops-cal-days">
                <span v-for="d in calendar.month" :key="d.day" class="ops-cal-day" :class="{ on: d.festivals.length }" :title="d.festivals.map((f) => f.name + '（' + f.desc + '）').join(' / ')">
                  <span class="mono">{{ d.day }}</span>
                  <span v-if="d.festivals.length" class="ops-cal-fes">{{ d.festivals.map((f) => f.icon).join('') }}</span>
                </span>
              </div>
            </div>
            <div class="ops-sec">
              <div class="ops-sec-h"><b>🔭 未来 14 天</b></div>
              <div v-for="u in calendar.upcoming" :key="u.date" class="ops-kv">
                <span class="dim">{{ u.date }}<span v-if="u.inDays === 0"> · 今天</span></span>
                <b>{{ u.festivals.map((f) => f.icon + f.name).join(' · ') }}</b>
              </div>
              <p v-if="!calendar.upcoming.length" class="dim ops-empty">未来 14 天无节庆。</p>
            </div>
          </div>
        </section>

        <!-- ═══════ 🧪 平衡实验台（操作台：左控制 / 右结果） ═══════ -->
        <section v-else class="ops-pane ops-lab">
          <div class="tp-grid">
            <!-- 左：控制 -->
            <div class="tp-col tp-col-l">
              <div class="tp-presets">
                <span class="dim tp-presets-label">🎬 一键情景</span>
                <button v-for="p in PRESETS" :key="p.id" class="btn btn-sm tp-preset" :title="p.hint" @click="applyPreset(p)">{{ p.label }}</button>
                <button class="btn btn-sm" :disabled="activeCount === 0" @click="resetAll()">♻ 全部重置</button>
              </div>
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

            <!-- 右：结果 / 校验（粘性） -->
            <div class="tp-col tp-col-side">
              <div class="tp-group tp-impact">
                <div class="tp-ab">
                  <span class="dim tp-presets-label">🆚 A/B 对比</span>
                  <span class="dim">现状 →</span>
                  <select v-model="labScenario" class="tp-ab-sel">
                    <option v-for="p in PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
                  </select>
                  <button class="btn btn-sm btn-primary" @click="runAB()">跑对比</button>
                  <span v-if="compared" class="dim">{{ compared.at }}</span>
                  <button v-if="compared" class="btn btn-sm" @click="compared = null">✕</button>
                </div>
                <div v-if="compared" class="tp-ab-table">
                  <div class="tp-ab-row tp-ab-head"><span>指标</span><span>现状</span><span>{{ compared.scenario }}</span><span>Δ</span><span>判定</span></div>
                  <div v-for="r in compared.rows" :key="r.id" class="tp-ab-row" :class="{ hot: r.changed }">
                    <span>{{ r.label }}</span>
                    <span class="mono">{{ r.aText }}</span>
                    <span class="mono"><b>{{ r.bText }}</b></span>
                    <span v-if="r.delta" class="tp-delta" :class="r.dir">{{ r.delta }}</span><span v-else class="dim">—</span>
                    <span :class="r.inBand ? 'ok' : 'bad'">{{ r.inBand ? '✅ 带内' : '⚠️ 带外' }}</span>
                  </div>
                </div>

                <div class="tp-bands">
                  <span class="dim tp-presets-label">🔗 验收线</span>
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
              </div>

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
                ③ 什么都不调 = 对游戏零影响（基线逐字节等价，mijian_test 的 C9b 有断言）。运营角色<b>没有</b>任何存档与破坏性操作——那是开发者（ShiShen）的权限。<br />
                ⚠️ 调参期间游戏内的攻略/说明文案仍按<b>基线</b>描述（它们写的是标定口径），别把它当成 bug。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── 外壳：左栏导航 + 主区（现代控制台骨架，2026-10-02 重排）── */
.opspage { position: fixed; inset: 0; z-index: 999; display: grid; grid-template-columns: 232px minmax(0, 1fr); background: var(--bg); color: var(--text); overflow: hidden; }
.opspage.ops-min { grid-template-columns: 60px minmax(0, 1fr); }

/* 左栏导航 */
.ops-tabs { display: flex; flex-direction: column; min-height: 0; padding: 12px 10px; gap: 4px; border-inline-end: 1px solid var(--border); background: rgba(var(--panel-rgb), 0.55); }
.ops-brand { display: flex; align-items: center; gap: 8px; padding: 4px 6px 12px; margin-bottom: 8px; border-bottom: 1px solid var(--border); }
.ops-brand-ico { font-size: 20px; }
.ops-brand-txt { display: flex; flex-direction: column; line-height: 1.25; }
.ops-brand-txt b { font-size: 13.5px; }
.ops-brand-txt em { font-size: 11px; color: var(--muted); font-style: normal; }
.ops-navs { display: flex; flex-direction: column; gap: 2px; flex: 1; min-height: 0; }
.ops-nav { display: flex; align-items: center; gap: 10px; width: 100%; text-align: start; padding: 9px 10px; border: 0; border-radius: 9px; background: transparent; color: var(--text); font: inherit; font-size: 13px; cursor: pointer; }
.ops-nav:hover { background: rgba(var(--tint-rgb), 0.1); }
.ops-nav.on { background: rgba(var(--primary-rgb), 0.14); color: var(--primary-strong); font-weight: 700; }
.ops-nav-ico { width: 20px; text-align: center; flex: 0 0 auto; font-size: 16px; }
.ops-rail-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 10px; border-top: 1px solid var(--border); }
.ops-chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); white-space: nowrap; }
.ops-chip.hot { color: var(--warn); border-color: rgba(var(--warn-rgb), 0.55); }
.ops-mini { border: 1px solid var(--border); background: transparent; color: var(--muted); border-radius: 7px; width: 26px; height: 26px; cursor: pointer; line-height: 1; }
.ops-mini:hover { color: var(--text); }
/* 折叠态（仅图标） */
.opspage.ops-min .ops-brand-txt, .opspage.ops-min .ops-nav-txt, .opspage.ops-min .ops-chip { display: none; }
.opspage.ops-min .ops-brand, .opspage.ops-min .ops-rail-foot { justify-content: center; }
.opspage.ops-min .ops-nav { justify-content: center; }

/* 主区：命令条 + 单滚动内容 */
.ops-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.ops-topbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 18px; border-bottom: 1px solid var(--border); background: rgba(var(--panel-rgb), 0.6); }
.ops-title { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.ops-title h3 { margin: 0; font-size: 16px; }
.ops-sub { font-size: 11.5px; }
.ops-actions { margin-inline-start: auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ops-sep { width: 1px; height: 18px; background: var(--border); display: inline-block; }

.ops-scroll { flex: 1; overflow-y: auto; padding: 18px; }
.ops-pane { display: flex; flex-direction: column; gap: 24px; }

/* KPI 条：第一眼先看这里 */
.ops-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.ops-kpi { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; background: rgba(var(--panel-rgb), 0.85); min-width: 0; }
.ops-kpi-ico { font-size: 13px; opacity: 0.8; }
.ops-kpi-val { font-size: 20px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ops-kpi-label { font-size: 11.5px; color: var(--muted); }

/* 分栏 */
.ops-2col { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 24px; align-items: start; }
.ops-3col { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; align-items: start; }
.ops-col-main, .ops-col-side { display: flex; flex-direction: column; gap: 24px; min-width: 0; }

/* 区块：用间距 + 表头分组，不套卡片 */
.ops-sec { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.ops-sec-h { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
.ops-sec-h b { font-size: 13.5px; }
.ops-sec-h .dim { font-size: 11.5px; }

/* ── 以下为原有内层元素样式（保留外观）── */
.tp-chip { font-size: 12px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); background: rgba(var(--panel-rgb), 0.7); }
.tp-chip.hot { color: var(--warn); border-color: rgba(var(--warn-rgb), 0.55); }

.tp-presets { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.tp-presets-label { font-size: 12px; }
.tp-preset { border-color: rgba(var(--primary-rgb), 0.5); }

.tp-bands { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.tp-band-chip { display: inline-flex; align-items: baseline; gap: 6px; font-size: 12px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border); background: rgba(var(--panel-rgb), 0.6); }
.tp-band-chip.ok { border-color: rgba(var(--good-rgb), 0.5); }
.tp-band-chip.bad { border-color: rgba(var(--bad-rgb), 0.6); background: rgba(var(--bad-rgb), 0.07); }
.tp-band-chip.bad b { color: var(--bad-strong); }
.tp-band-chip.changed b { font-weight: 700; }

.tp-ab { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tp-ab-sel { padding: 3px 8px; border-radius: 8px; border: 1px solid var(--border); background: rgba(var(--panel-soft-rgb), 0.7); color: var(--text); font-size: 12px; }
.tp-ab-table { margin-top: 8px; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.tp-ab-row { display: grid; grid-template-columns: minmax(0, 1.2fr) 0.8fr 0.8fr 0.7fr 0.8fr; align-items: center; gap: 8px; padding: 4px 10px; font-size: 12px; border-bottom: 1px dashed rgba(var(--tint-rgb), 0.16); }
.tp-ab-row:last-child { border-bottom: 0; }
.tp-ab-head { font-weight: 700; background: rgba(var(--panel-rgb), 0.6); }
.tp-ab-row.hot { background: rgba(var(--warn-rgb), 0.05); }
.tp-ab-row .ok { color: var(--good-strong); }
.tp-ab-row .bad { color: var(--bad-strong); }

.tp-evidence { margin-top: 10px; padding: 8px 12px; border: 1px solid rgba(var(--good-rgb), 0.45); border-radius: 10px; background: rgba(var(--good-rgb), 0.06); font-size: 12px; }
.tp-ev-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tp-ev-head button { margin-left: auto; }
.tp-ev-line { margin-top: 4px; }
.tp-ev-line.ok { color: var(--good-strong); }
.tp-ev-line.bad { color: var(--bad-strong); }
.tp-ev-note { margin-top: 4px; font-size: 11.5px; }
.tp-hint { margin-top: 8px; font-size: 12px; }

.tp-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); gap: 24px; align-items: start; }
.tp-col { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.tp-col-side { position: sticky; top: 0; align-self: start; }

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

.tp-script { border: 1px solid var(--border); border-radius: 12px; padding: 8px 12px; background: rgba(var(--panel-rgb), 0.45); }
.tp-script summary { cursor: pointer; font-size: 13px; font-weight: 700; }
.tp-script-list { margin: 8px 0 0; padding-left: 18px; }
.tp-script-list li { margin-bottom: 8px; font-size: 12px; }
.tp-script-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tp-script-say { margin-top: 2px; }
.tp-script-watch { font-size: 11.5px; }
.tp-foot-note { margin: 0; }

/* 驾驶舱内层 */
.ops-kv { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-size: 12.5px; padding: 3px 0; border-bottom: 1px dashed rgba(var(--tint-rgb), 0.16); }
.ops-kv:last-of-type { border-bottom: 0; }
.ops-kv b { font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.ops-total { margin-top: 6px; border-top: 1px solid var(--border); padding-top: 6px; }
.ops-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ops-funnel-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; padding: 2px 0; opacity: 0.62; }
.ops-funnel-row.done { opacity: 1; }
.ops-funnel-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ops-dot { width: 14px; text-align: center; }
.ops-econ { display: flex; flex-direction: column; gap: 4px; }
.ops-econ-row { display: grid; grid-template-columns: minmax(0, 1fr) 90px auto; align-items: center; gap: 8px; font-size: 12px; }
.ops-econ-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ops-econ-bar { height: 8px; border-radius: 4px; background: rgba(var(--tint-rgb), 0.18); overflow: hidden; }
.ops-econ-bar i { display: block; height: 100%; background: var(--primary); border-radius: 4px; }
.ops-note { font-size: 11.5px; line-height: 1.55; margin: 0; }
.ops-empty { font-size: 12px; margin: 4px 0; }
.ops-bench { display: flex; flex-wrap: wrap; gap: 8px; }
.ops-bench-chip { display: inline-flex; align-items: baseline; gap: 6px; font-size: 12px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border); background: rgba(var(--panel-rgb), 0.6); }
.ops-bench-chip b { font-weight: 700; }

/* 内容节奏 */
.ops-cad { display: flex; flex-direction: column; gap: 3px; }
.ops-cad-row { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; align-items: center; gap: 8px; font-size: 12px; }
.ops-cad-label { font-size: 11.5px; }
.ops-cad-bar { height: 10px; border-radius: 5px; background: rgba(var(--tint-rgb), 0.16); overflow: hidden; }
.ops-cad-bar i { display: block; height: 100%; background: var(--primary); border-radius: 5px; }
.ops-cad-row.thin .ops-cad-bar i { background: var(--warn-strong); }
.ops-cad-row.thin .ops-cad-label { color: var(--warn-strong); font-weight: 700; }

/* 运营日历 */
.ops-cal-grid { display: flex; flex-direction: column; gap: 2px; overflow-x: auto; }
.ops-cal-grow { display: grid; grid-template-columns: 44px repeat(24, minmax(12px, 1fr)); align-items: center; gap: 2px; }
.ops-cal-glabel { font-size: 11px; color: var(--muted); }
.ops-cal-cell { height: 14px; border-radius: 3px; background: rgba(var(--tint-rgb), 0.14); }
.ops-cal-cell.on { background: var(--primary); }
.ops-cal-legend { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.ops-cal-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.ops-cal-day { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 3px 0; border-radius: 6px; border: 1px solid var(--border); font-size: 11px; background: rgba(var(--panel-rgb), 0.5); }
.ops-cal-day.on { border-color: rgba(var(--primary-rgb), 0.6); background: rgba(var(--primary-rgb), 0.1); font-weight: 700; }
.ops-cal-fes { font-size: 11px; }

/* 响应式：主区单列 + 窄屏收窄左栏 */
@media (max-width: 1100px) {
  .ops-2col, .ops-3col, .tp-grid { grid-template-columns: 1fr; }
  .tp-col-side { position: static; }
}
@media (max-width: 720px) {
  .opspage { grid-template-columns: 60px minmax(0, 1fr); }
  .ops-brand-txt, .ops-nav-txt, .ops-rail-foot .ops-chip { display: none; }
  .ops-nav, .ops-brand { justify-content: center; }
  .ops-scroll { padding: 12px; }
}

/* 演示模式（投影仪大字版）—— 放最后，覆盖上面的分栏 */
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
