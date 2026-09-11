<script setup>
// 图鉴面板 — 需求文档 §6（图鉴）+ §13（图鉴卡牌化）
// 图鉴 tab：物品（分类展示全部物品+未获得标记）/ 悬浮详情；首领 / 赛季 / 卡牌对战 + 配方手册 + 故事
// 2026-09-11：成就/称号/主线任务三块已移出为独立页（见 views/AchievementsView.vue、views/QuestsView.vue），
//             本页只在页签栏保留两个跳转按钮
import { bindTip } from '../composables/useFixedTooltip.js'
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem, itemName } from '../game/data/items.js'
import { ITEMS } from '../game/data/items.js'
import {
  cardPoolFrom,
  cardColor as cardColorFor,
  cardStrength as cardStrengthOf,
  simulateBattle,
  settleBattle,
  DIFFICULTIES,
} from '../game/data/cardBattle.js'
import { COMBAT_BOSSES } from '../game/data/combat.js'
import { SEASONS } from '../game/data/seasons.js'
import { getAllSkillInstances } from '../game/skills/registry.js'
import { getSkillDef } from '../game/data/skills.js'
// 传闻/轶事文案（tales_ext ~1.4MB）改为动态加载（2026-09-06 chunk 拆分：图鉴首开不背轶事文案）
import ProgressBar from '../components/ProgressBar.vue'
import ItemDetailModal from '../components/ItemDetailModal.vue'
import ItemImg from '../components/ItemImg.vue'
import { CATEGORY_LABEL, SLOT_LABEL } from '../game/data/itemDetail.js'
import { itemImage } from '../game/data/itemImage.js'
import Pagination from '../components/Pagination.vue'

// 分页状态（每个列表独立页码；行数不同 → 每页数量不同）
const itemPage = ref(1)
const seasonPage = ref(1)
const PAGE = { items: 28, season: 20, cards: 13 } // 卡牌 13 张/页

const player = usePlayerStore()
const ui = useUiStore()
const tab = ref('log')

// 日志页直达（图鉴/卡牌/成就）：导航按钮设置 ui.logInitialTab
// （watch 定义在 sub 声明之后，immediate 执行时 sub 已初始化）

// ── 图鉴子页 ──
const sub = ref('items')
const typeFilter = ref('ingredient') // 默认选中第一个具体分类（「全部」已隐藏，避免默认展示全部）；二级 catFilter 默认 'all'
const catFilter = ref('all') // 二级分类：category 细分
const detailItem = ref(null) // 点击物品 → 详情弹窗
const bossDetail = ref(null) // 点击首领图鉴行 → 详情弹窗
const seasonTip = ref(null) // 赛季图鉴格子点击固定浮框

// immediate：顶栏图标进入时 LogView 是全新挂载（v-else-if 卸载重建），不 immediate 会停在默认「任务」页
// 已独立成页的旧子页：老入口若还传这些值，直接转到对应新页
const MIGRATED_TABS = { quest: 'quests', achieve: 'achievements', title: 'achievements' }
watch(
  () => ui.logInitialTab,
  (t) => {
    if (!t) return
    ui.logInitialTab = null
    if (MIGRATED_TABS[t]) { ui.setView(MIGRATED_TABS[t]); return }
    tab.value = t
    if (t === 'log') sub.value = 'items'
  },
  { immediate: true },
)
// 跳转到独立页面（任务中心 / 成就与称号）
function goPage(v) { ui.setView(v) }

const TYPE_LABELS = { ingredient: '食材', food: '料理', drink: '饮品', spice: '调料', seed: '种子', consumable: '道具', equipment: '装备', spirit: '食灵' }
// 一级分类（type 大类）；二级分类 = 该大类下的 category 细分（动态生成）
const TYPE_FILTERS = [['all', '全部'], ...Object.entries(TYPE_LABELS)]
const CATEGORY_ORDER = ['root', 'vegetable', 'fruit', 'meat', 'seafood', 'egg', 'fungus', 'mushroom', 'mineral', 'fossil', 'crop', 'grain', 'seasoning', 'material', 'supply', '主菜', '主食', '汤品', '甜点', 'baking', 'pickled', 'preserving', 'juice', 'tea', '茶饮', 'wine', 'sauce', 'buff']
const CAT_FILTERS = computed(() => {
  if (typeFilter.value === 'all') return []
  const cats = new Set()
  for (const it of Object.values(ITEMS)) {
    if (it.type === typeFilter.value && it.category) cats.add(it.category)
    // 食材分类下包含「种植产物」（15 个种子）
    if (typeFilter.value === 'ingredient' && it.type === 'seed' && it.category === '种植产物') cats.add('种植产物')
  }
  return [...cats]
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
    })
    .map((c) => [c, CATEGORY_LABEL[c] ?? SLOT_LABEL[c] ?? c])
})
function selectType(t) {
  typeFilter.value = t
  catFilter.value = 'all'
}
const STAT_LABEL = { attack: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击%', hpBonus: '品鉴值', speedBonus: '攻速' }
const BUFF_LABEL = { atk: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', speed: '攻速', duration: '持续' }
const MECH_LABEL = { regen: '回血', slowEvery: '降攻速', burn: '灼烧', poison: '中毒', instantKill: '秒杀', randomStyle: '随机风格', phases: '三阶段', crit: '高暴击', eva: '高闪避', speedMs: '高攻速' }

// 统计各类型收集数（依赖 player.collected；computed 缓存后每次渲染不再对 ITEMS 全表反复过滤）
const typeStatsList = computed(() => {
  const stats = {}
  for (const [type, label] of Object.entries(TYPE_LABELS)) {
    let total = 0
    let got = 0
    for (const id in ITEMS) {
      if (ITEMS[id].type !== type) continue
      total++
      if (player.collected[id]) got++
    }
    if (!total) continue
    stats[label] = { got, total }
  }
  stats['全部'] = { got: Object.keys(player.collected).length, total: Object.keys(ITEMS).length }
  return stats
})

// 种子 → 种植产物（图鉴「种植产物」子分类显示产物物品：龙息椒种子→龙息椒…）
const SEED_PRODUCT_MAP = {
  wheatSeed: 'wheat', riceSeed: 'rice', cornSeed: 'corn', cabbageSeed: 'cabbage', chiliSeed: 'chili',
  eggplantSeed: 'eggplant', pumpkinSeed: 'pumpkin', peppercornSeed: 'peppercorn', starAniseSeed: 'starAnise',
  cassiaSeed: 'cassia', vanillaSeed: 'vanilla', basilSeed: 'basil', rosemarySeed: 'rosemary',
  saffronSeed: 'saffron', dragonPepperSeed: 'dragonPepper',
}

// 分类物品网格：显示全部（含未获得），按 tier/价值排序
const itemList = computed(() => {
  // 「种植产物」：显示 15 个种子对应的产物物品
  if (catFilter.value === '种植产物') {
    return Object.values(SEED_PRODUCT_MAP).sort(
      (a, b) => (ITEMS[b].tier ?? 0) - (ITEMS[a].tier ?? 0) || (ITEMS[b].value ?? 0) - (ITEMS[a].value ?? 0),
    )
  }
  const ids = Object.keys(ITEMS).filter((id) => {
    const it = ITEMS[id]
    if (typeFilter.value !== 'all' && it.type !== typeFilter.value) return false
    if (catFilter.value !== 'all' && it.category !== catFilter.value) return false
    return true
  })
  return ids.sort((a, b) => (ITEMS[b].tier ?? 0) - (ITEMS[a].tier ?? 0) || (ITEMS[b].value ?? 0) - (ITEMS[a].value ?? 0))
})

// 悬浮/点击详情内容
function qualityBadge(id) {
  const q = getItem(id)?.quality
  const map = { 普通: 'var(--muted)', 精良: 'var(--good-strong)', 稀有: 'var(--info)', 史诗: '#7b1fa2', 传说: 'var(--warn-strong)', 神话: 'var(--bad-strong)' }
  return q ? { text: q, color: map[q] ?? 'var(--muted)' } : null
}
function mechText(b) {
  const ms = []
  for (const [k, v] of Object.entries(b.mechanic ?? {})) {
    if (k === 'slowEvery') ms.push(`每 ${v} 回合降攻速`)
    else if (MECH_LABEL[k]) ms.push(MECH_LABEL[k])
  }
  if (b.crit) ms.push(`暴击 ${Math.round(b.crit * 100)}%`)
  if (b.eva) ms.push(`闪避 ${b.eva}`)
  if (b.speedMs) ms.push(`攻速 ${b.speedMs}ms`)
  return ms.join('、') || '—'
}
function bossStatus(name) {
  return player.stats.bosses.includes(name)
}
function seasonClaimed(s) {
  return player.seasons?.[s.id]?.claimed?.length ?? 0
}

// ── 图鉴卡牌化（§13，2026-09-06 重构：逻辑在 game/data/cardBattle.js，本处仅薄壳）──
const selectedCards = ref([])
const battleResult = ref(null)
const cardDiff = ref('normal') // 难度：休闲/标准/挑战（AI 战力与奖励倍率）
const battleReward = ref(null) // 结算明细 { reward, dailyBonus, firstBonus }
const cardPool = computed(() => cardPoolFrom(player.collected))
// 卡池管理（2026-09-06）：搜索 + 类型筛选 + 分页，防止卡牌过多时全量渲染
const cardQuery = ref('')
const cardCat = ref('all')
const cardPage = ref(1)
const filteredPool = computed(() => {
  const q = cardQuery.value.trim().toLowerCase()
  return cardPool.value.filter((id) => {
    const it = getItem(id)
    if (cardCat.value === 'food' && it?.type !== 'food') return false
    if (cardCat.value === 'equipment' && it?.type !== 'equipment') return false
    if (q && !(it?.name ?? '').toLowerCase().includes(q)) return false
    return true
  })
})
const cardPages = computed(() => Math.max(1, Math.ceil(filteredPool.value.length / PAGE.cards)))
const pagedCards = computed(() => {
  const p = Math.min(cardPage.value, cardPages.value)
  const arr = filteredPool.value.slice((p - 1) * PAGE.cards, p * PAGE.cards)
  while (arr.length < PAGE.cards) arr.push({ _pad: true })
  return arr
})
watch([cardQuery, cardCat], () => { cardPage.value = 1 })
/** 一键最强：自动选择当前筛选结果中战力前 3 */
function pickBest() {
  selectedCards.value = filteredPool.value.slice(0, 3)
}
function cardColor(id) { return cardColorFor(id) }
function cardStrengthText(id) { return Math.round(cardStrengthOf(id)) }
function toggleCard(id) {
  const i = selectedCards.value.indexOf(id)
  if (i >= 0) selectedCards.value.splice(i, 1)
  else if (selectedCards.value.length < 3) selectedCards.value.push(id)
}
function clearSelection() { selectedCards.value = [] }
function doCardBattle() {
  if (!selectedCards.value.length) return
  const result = simulateBattle(selectedCards.value, player.collected, { difficulty: cardDiff.value })
  battleReward.value = settleBattle(player, result, cardDiff.value)
  battleResult.value = result
  selectedCards.value = []
}

// ── 配方手册：每个制作技能内按 reqLevel 每 5 级分段，可折叠；顶部按等级快速跳转 ──
const recipeInstances = computed(() => getAllSkillInstances().filter((x) => x.type === 'production'))
// 大类切换：一次只显示一个制作大类（烹饪/烘焙/腌制…），避免全部配方同时渲染
const currentRecipeCat = ref(player.settings.recipeCat ?? '')
const curRecipe = computed(() => recipeInstances.value.find((i) => i.id === currentRecipeCat.value) ?? recipeInstances.value[0] ?? null)
// 某个大类要默认展开的段：优先当前玩家该技能等级所在的等级段，否则首段
function sectionsToOpen(inst) {
  const secs = recipeSections(inst)
  if (!secs.length) return new Set()
  const lv = player.skillState(inst.id).level
  let hit = secs[0]
  for (const s of secs) {
    const a = Number(s.label.split('-')[0])
    if (lv >= a && lv <= a + 4) { hit = s; break }
  }
  return new Set([inst.id + '|' + hit.label])
}
function selectRecipeCat(id) {
  currentRecipeCat.value = id
  player.settings.recipeCat = id // 记忆本次大类（随存档持久化，切页后仍记住）
  const inst = recipeInstances.value.find((i) => i.id === id)
  if (!inst) return
  const s = new Set(collapsed.value)
  for (const key of sectionsToOpen(inst)) s.delete(key)
  collapsed.value = s
}
// 配方分段缓存：inst.recipes 为静态数据，首次计算后按技能 id 复用（模板中 recipeSections 每段被调用 3 次）
const _recipeSecCache = new Map()
function recipeSections(inst) {
  let secs = _recipeSecCache.get(inst.id)
  if (secs) return secs
  const map = new Map()
  for (const r of inst.recipes) {
    const start = Math.floor((r.reqLevel - 1) / 5) * 5 + 1
    const label = `${start}-${start + 4}`
    if (!map.has(label)) map.set(label, [])
    map.get(label).push(r)
  }
  secs = [...map.entries()].map(([label, list]) => ({ label, list }))
  _recipeSecCache.set(inst.id, secs)
  return secs
}
const recipeLevelNav = computed(() => {
  const set = new Set()
  for (const inst of recipeInstances.value) {
    for (const r of inst.recipes) {
      const start = Math.floor((r.reqLevel - 1) / 5) * 5 + 1
      set.add(`${start}-${start + 4}`)
    }
  }
  return [...set].sort((a, b) => parseInt(a) - parseInt(b))
})
// 折叠键用「技能id|等级段」，避免跨大类同名段互串
const collapsed = ref(new Set())
// 默认：只展开当前大类中玩家等级附近的段，其余全折叠（避免一次渲染上千卡片卡顿）
function defaultCollapsed() {
  const s = new Set()
  const insts = recipeInstances.value
  const cur = curRecipe.value
  const openCur = cur ? sectionsToOpen(cur) : new Set()
  for (const inst of insts) {
    const secs = recipeSections(inst)
    for (const sec of secs) {
      const key = inst.id + '|' + sec.label
      if (!(inst === cur && openCur.has(key))) s.add(key)
    }
  }
  return s
}
collapsed.value = defaultCollapsed()
function toggleSection(instId, label) {
  const key = instId + '|' + label
  const s = new Set(collapsed.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  collapsed.value = s
}
function isOpen(instId, label) {
  return !collapsed.value.has(instId + '|' + label)
}
function scrollToLabel(instId, label) {
  const el = document.getElementById('recipe-sec-' + instId + '-' + label)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}


const SLOT_ZH = { weapon: '武器', helmet: '头盔', body: '身体', legs: '腿甲', boots: '脚部', offhand: '副手', amulet: '饰品1', ring: '饰品2' }
const slotZh = (id) => SLOT_ZH[getItem(id)?.slot] ?? getItem(id)?.slot ?? ''
// 每季装备 = 单件奖励(limitedItem) + 8 件 gear 套(limitedItems)
const seasonGearIds = (s) => [s.limitedItem, ...(s.limitedItems ?? [])].filter(Boolean)

// ── 转生（轮回）详解：条目列表（左圆圈 + 加粗标题 + 灰字正文 + 底部蓝色小标签；描述重点字段主色高亮）──
const prestigeItems = [
  { t: '转生条件——任一技能满 100 级', d: '只要求单个技能等级达到 <b class="hl">100 级</b>即可对该技能转生；转生前上限仍是 100。条件只看该技能，与其它技能、物品、金币、图鉴无关。', tags: ['转生门槛：100 级', '只看单个技能'] },
  { t: '转生按钮——技能页右上角', d: '技能满 <b class="hl">100 级</b>且尚未转生时，技能页右上角出现「✨ 转生（突破 120 级）」主色按钮，点击弹出确认弹窗。', tags: ['技能页', '✨ 转生按钮'] },
  { t: '等级重置——归 1、经验清零', d: '确认转生后该技能<b class="hl">等级重置为 1</b>、<b class="hl">经验清零</b>，重新开始练级。', tags: ['等级 = 1', '经验 = 0'] },
  { t: '转生层数——每技能独立 +1', d: '该技能<b class="hl">转生层数 +1</b>，各技能独立记录；同时<b class="hl">全局转生次数 +1</b>（用于成就/任务/故事/轶事）。', tags: ['转生层数 +1', '全局计数'] },
  { t: '永久经验加成——每层 +20%', d: '每转一层<b class="hl">永久 +20%</b>该技能经验，可叠加（1 转 +20%、2 转 +40%、3 转 +60%…）；与食灵、奥义、公会被动、增益剂、设置全局倍率<b class="hl">乘法叠加</b>。', tags: ['每层 +20%', '乘法叠加'] },
  { t: '等级上限——突破至 120', d: '转生后该技能等级上限由 100 提升到 <b class="hl">120</b>，可继续练到 120 级。', tags: ['转生上限：120 级'] },
  { t: '不受影响——只回炉该技能', d: '转生不清空该技能<b class="hl">专精</b>，也不影响其它技能、物品、金币、图鉴、装备、赛季、餐厅、公会、存档。', tags: ['专精保留', '不绑定其它系统'] },
  { t: '转生后——菜系图谱与见闻全保留', d: '菜系图谱节点、美食见闻、成就/称号、图鉴收集、食灵羁绊、餐厅与赛季进度<b class="hl">全部不受转生影响</b>；只有被转生的那个技能回 1 级。', tags: ['图谱/见闻保留', '成就称号保留'] },
  { t: '转生后——宝石与套装仍在装备上', d: '装备（含<b class="hl">镶嵌的宝石</b>与<b class="hl">套装加成</b>）不随转生重置；宝石在换装/拆卸时自动返还，不会因转生丢失。', tags: ['宝石保留', '套装保留'] },
  { t: '转生后——挂机计划按新等级重判', d: '挂机计划本身不会被清空，但「等级 / 熟练度」达成条件按转生后的新等级重新判定；若计划里排了 100 级条件，转生后会从头再练。建议转生后重排计划。', tags: ['计划不重置', '条件重判'] },
  { t: '转生后——秘境/竞技场对手同步变弱', d: '对决等级 =（品鉴力 + 最高攻击技能 + 火候）/ 3，转生会让它下降，<b class="hl">食神秘境与竞技场镜像对手随之变弱</b>，评论家要求的 tier 也同步降低——转生期反而是刷秘境层数的窗口。', tags: ['对手变弱', '刷秘境窗口'] },
  { t: '转生后——重练到 120', d: '带每层 <b class="hl">+20%</b> 加成从 1 级重练该技能到 <b class="hl">120</b>；可继续转其它技能各自拿 +20% 与上限 120；满 120 挑战封顶内容。', tags: ['重练', '冲 120 级'] },
  { t: '优先转生——刀工 / 品鉴力', d: '优先转对<b class="hl">对决等级</b>影响大的技能（刀工、品鉴力等），更快提升对决战力、解锁更多区域。', tags: ['对决等级', '对决'] },
  { t: '平衡说明——偏肝长线', d: '99→100 级 = <b class="hl">3 亿经验</b>为基准；100→120 级全程约需 <b class="hl">199 亿经验</b>（120 级总经验约 231 亿）。每层 +20% 已缓解，仍属长线目标，建议配合全局经验倍率/增益剂加速。', tags: ['99→100 级 = 3 亿', '100→120 级 ≈ 199 亿'] },
]

// ── 分页切片（任务/成就/图鉴物品/赛季/轶事，补满到 size 使所有页等高 → 底部翻页按钮不跳）──
function pageList(list, pageRef, size) {
  return computed(() => {
    const pages = Math.max(1, Math.ceil(list.length / size))
    const p = Math.min(pageRef.value, pages)
    const arr = list.slice((p - 1) * size, p * size)
    while (arr.length < size) arr.push({ _pad: true })
    return arr
  })
}
const itemPages = computed(() => Math.max(1, Math.ceil(itemList.value.length / PAGE.items)))
const itemPaged = computed(() => {
  const p = Math.min(itemPage.value, itemPages.value)
  const arr = itemList.value.slice((p - 1) * PAGE.items, p * PAGE.items)
  while (arr.length < PAGE.items) arr.push({ _pad: true })
  return arr
})
const seasonPages = computed(() => Math.max(1, Math.ceil(SEASONS.length / PAGE.season)))
const seasonPaged = computed(() => {
  const p = Math.min(seasonPage.value, seasonPages.value)
  const arr = SEASONS.slice((p - 1) * PAGE.season, p * PAGE.season)
  while (arr.length < PAGE.season) arr.push({ _pad: true })
  return arr
})
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📖 图鉴</h2>
        <p class="dim">美食图鉴 · 配方手册 · 卡牌对战 · 故事（任务、成就与称号已独立成页，见上方跳转按钮）</p>
      </div>
    </header>

    <div class="card">
      <!-- 任务/成就/称号已独立成页（2026-09-11），这里只留跳转按钮；其余仍是本页页签 -->
      <div class="region-tabs">
        <button class="btn btn-sm" title="独立页面" @click="goPage('quests')">📋 任务中心 ↗</button>
        <button class="btn btn-sm" title="独立页面" @click="goPage('achievements')">🏅 成就与称号 ↗</button>
        <button class="btn btn-sm" title="独立页面" @click="goPage('story')">📜 故事与传闻 ↗</button>
        <button class="btn btn-sm" :class="{ 'btn-primary': tab === 'log' }" @click="tab = 'log'">图鉴（{{ player.collectionPct }}%）</button>
        <button class="btn btn-sm" :class="{ 'btn-primary': tab === 'cards' }" @click="tab = 'cards'">卡牌对战（{{ player.stats.cardBattle?.wins ?? 0 }}胜/{{ player.stats.cardBattle?.losses ?? 0 }}负）</button>
        <button class="btn btn-sm" :class="{ 'btn-primary': tab === 'recipes' }" @click="tab = 'recipes'">配方手册</button>
      </div>

      <!-- ── 图鉴（§6.2：分类展示全部物品 + 未获得标记 + 悬浮详情；首领/赛季图鉴）── -->
      <template v-if="tab === 'log'">
        <div class="region-tabs">
          <button class="btn btn-sm" :class="{ 'btn-primary': sub === 'items' }" @click="sub = 'items'">物品（{{ player.collectionPct }}%）</button>
          <button class="btn btn-sm" :class="{ 'btn-primary': sub === 'boss' }" @click="sub = 'boss'">首领（{{ player.stats.bosses.length }}/{{ COMBAT_BOSSES.length }}）</button>
          <button class="btn btn-sm" :class="{ 'btn-primary': sub === 'season' }" @click="sub = 'season'">赛季（{{ SEASONS.filter((s) => seasonClaimed(s) > 0).length }}/{{ SEASONS.length }}）</button>
          <button class="btn btn-sm" :class="{ 'btn-primary': sub === 'prestige' }" @click="sub = 'prestige'">转生（{{ player.stats.prestiges ?? 0 }} 次）</button>
        </div>

        <!-- 物品图鉴 -->
        <template v-if="sub === 'items'">
          <div class="card status-line" style="border: none; background: transparent; padding: 0">
            <span class="badge badge-on">完成度 {{ player.collectionPct }}%</span>
            <span class="dim">共 {{ Object.keys(ITEMS).length }} 种物品 · 悬停/点击查看详情与获取来源</span>
          </div>
          <div class="stat-grid">
            <div v-for="(st, label) in typeStatsList" :key="label" class="stat">
              <div class="stat-num mono">{{ st.got }}/{{ st.total }}</div>
              <div class="stat-label">{{ label }}</div>
            </div>
          </div>
          <div class="collection-progress">
            <ProgressBar :progress="player.collectionPct / 100" />
          </div>

          <!-- 分类筛选：一级 type 大类（隐藏「全部」，其余保留） -->
          <div class="region-tabs" style="flex-wrap: wrap; margin-top: 10px">
            <template v-for="[key, label] in TYPE_FILTERS" :key="key">
              <button v-if="key !== 'all'" class="btn btn-sm" :class="{ 'btn-primary': typeFilter === key }" @click="selectType(key)">
                {{ label }}
              </button>
            </template>
          </div>
          <!-- 二级分类：该大类下的细分（隐藏「全部」，其余保留） -->
          <div v-if="CAT_FILTERS.length" class="region-tabs" style="flex-wrap: wrap; margin-top: 6px">
            <template v-for="[key, label] in CAT_FILTERS" :key="key">
              <button v-if="key !== 'all'" class="btn btn-sm" :class="{ 'btn-primary': catFilter === key }" @click="catFilter = key">
                {{ label }}
              </button>
            </template>
          </div>

          <!-- 全部物品网格（未获得置灰显示；点击查看详情弹窗） -->
          <div class="item-grid grid-n-7">
            <template v-for="(id, ii) in itemPaged" :key="id?.id ?? 'pad-' + ii">
            <div
              v-if="!id?._pad"
              class="item-cell"
              :class="{ locked: !player.collected[id] }"
              @click="detailItem = id"
            >
              <div class="item-cell-head">
                <img v-if="itemImage(id)" :src="itemImage(id)" class="item-img item-img-sm" @error="$event.target.style.display = 'none'" alt="" />
                <span class="item-cell-name">{{ getItem(id)?.name }}<span v-if="!player.collected[id]" class="lock-flag" title="尚未获得">🔒</span></span>
              </div>
              <div class="item-cell-sub">
                <span v-if="!player.collected[id]" class="badge" style="background: var(--lock-bg); color: var(--muted); font-size: 12px; padding: 1px 6px">未获得</span>
              </div>
              <div class="dim item-cell-sub">
                <span v-if="qualityBadge(id)" :style="{ color: qualityBadge(id).color }">{{ qualityBadge(id).text }}</span>
                <span v-else>{{ TYPE_LABELS[getItem(id)?.type] ?? getItem(id)?.category ?? '' }}</span>
                <span class="mono">T{{ getItem(id)?.tier }}</span>
              </div>
            </div>
            <div v-else class="pager-spacer"></div>
            </template>
          </div>
          <Pagination v-if="itemList.length > PAGE.items" :current="Math.min(itemPage, itemPages)" :pages="itemPages" @update:current="(p) => itemPage = p" />
        </template>

        <!-- 首领 图鉴 -->
        <template v-else-if="sub === 'boss'">
          <p class="dim" style="margin: 8px 0">击败全部首领 点亮图鉴；首次掉落独有装备（点击行查看详情与掉落）</p>
          <table class="target-table">
            <thead>
              <tr>
                <th>状态</th>
                <th>名称</th>
                <th>等级</th>
                <th>风格</th>
                <th>机制</th>
                <th>独有掉落</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="b in COMBAT_BOSSES"
                :key="b.name"
                :class="{ 'boss-undefeated': !bossStatus(b.name) }"
                style="cursor: pointer"
                @click="bossDetail = b"
              >
                <td>
                  <span v-if="bossStatus(b.name)" class="badge badge-on">已击败</span>
                  <span v-else class="badge" style="background: var(--lock-bg); color: var(--muted)">未击败</span>
                </td>
                <td><strong>{{ b.name }}</strong></td>
                <td class="mono">{{ b.level }}</td>
                <td>{{ b.style === 'knife' ? '刀工' : b.style === 'plating' ? '摆盘' : '调味' }}</td>
                <td class="dim">{{ mechText(b) }}</td>
                <td class="dim">{{ (b.drops ?? []).filter((d) => getItem(d.itemId)?.quality).map((d) => getItem(d.itemId)?.name).join('、') || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </template>

        <!-- 赛季图鉴 -->
        <template v-else-if="sub === 'season'">
          <p class="dim" style="margin: 8px 0">每季 8 个任务 → 赛季宝箱 → 10 档奖励（每季 9 件限定装备：1 件单件奖励 + 8 件 gear 套逐档发放，做完任务可领满全部奖励）；40 天（560 天轮换循环）</p>
          <div class="season-grid grid-n-5">
            <template v-for="(s, si) in seasonPaged" :key="s.id ?? 'pad-' + si">
            <div v-if="!s._pad" class="card season-card" :class="{ locked: seasonClaimed(s) === 0 }">
              <div class="season-card-head">
                <strong>{{ s.name }}</strong>
                <span v-if="seasonClaimed(s) === 0" class="badge" style="background: var(--lock-bg); color: var(--muted)">未完成</span>
                <span v-else class="badge badge-on">已领取 {{ seasonClaimed(s) }}/10</span>
              </div>
              <div class="dim season-card-sub">{{ s.theme }} · 集齐 {{ seasonGearIds(s).filter((id) => player.collected[id]).length }}/{{ seasonGearIds(s).length }}</div>
              <div class="season-gear-list">
                <div v-for="(id, i) in seasonGearIds(s)" :key="id" class="season-gear-row" :class="{ got: player.collected[id] }">
                  <span class="season-gear-slot">{{ i === 0 ? '单件·' : '' }}{{ slotZh(id) }}</span>
                  <span class="season-gear-name">{{ getItem(id)?.name }}</span>
                  <span class="season-gear-flag">{{ player.collected[id] ? '✔' : '○' }}</span>
                </div>
              </div>
            </div>
            <div v-else class="pager-spacer"></div>
            </template>
          </div>
          <Pagination v-if="SEASONS.length > PAGE.season" :current="Math.min(seasonPage, seasonPages)" :pages="seasonPages" @update:current="(p) => seasonPage = p" />
        </template>

        <!-- 转生说明（§3：100 级转生 → 突破 120 级，事无巨细） -->
        <template v-else-if="sub === 'prestige'">
          <div class="prestige-list">
            <div class="dim prestige-count">转生（轮回）详解 · {{ prestigeItems.length }} 条</div>
            <div v-for="item in prestigeItems" :key="item.t" class="prestige-item">
              <span class="prestige-dot"></span>
              <div class="prestige-body">
                <strong class="prestige-title">{{ item.t }}</strong>
                <div class="prestige-desc" v-html="item.d"></div>
                <div v-if="item.tags?.length" class="prestige-tags">
                  <span v-for="tg in item.tags" :key="tg" class="prestige-tag">{{ tg }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>

      <!-- 卡牌对战（§13）：图鉴页直属分类（2026-09-06 重构排版）-->
      <template v-else-if="tab === 'cards'">
          <div class="card-battle-head">
            <h3 style="margin: 0">🂡 卡牌对战</h3>
            <span class="dim">卡池 {{ cardPool.length }} 张 · 已选 <b class="mono cb-count">{{ selectedCards.length }}</b>/3 · 战绩 {{ player.stats.cardBattle?.wins ?? 0 }}胜 {{ player.stats.cardBattle?.losses ?? 0 }}负</span>
            <button v-if="selectedCards.length" class="btn btn-sm" @click="clearSelection">清空选卡</button>
          </div>
          <p class="dim" style="margin: 4px 0 8px">从已收集的料理/装备中<span style="color: var(--primary-strong); font-weight: 700">点选 3 张</span>组成卡组，与 AI 同池对决（3 局 2 胜制）：每局战力 ±12% 浮动；胜得金币（按难度倍率），每日首胜额外 +50，首次胜场额外 +能量饼干。</p>
          <div class="region-tabs" style="flex-wrap: wrap; margin-bottom: 8px">
            <span class="dim" style="align-self: center">难度：</span>
            <button
              v-for="(d, key) in DIFFICULTIES"
              :key="key"
              class="btn btn-sm"
              :class="{ 'btn-primary': cardDiff === key }"
              @click="cardDiff = key"
            >{{ d.label }}（AI ×{{ d.aiMult }} · 奖励 ×{{ d.rewardMult }}）</button>
          </div>
          <div class="cb-filter-bar">
            <input v-model="cardQuery" class="cb-filter-input" type="text" placeholder="🔍 搜索卡牌名称…" />
            <button class="btn btn-sm" :class="{ 'btn-primary': cardCat === 'all' }" @click="cardCat = 'all'">全部</button>
            <button class="btn btn-sm" :class="{ 'btn-primary': cardCat === 'food' }" @click="cardCat = 'food'">🍽 料理</button>
            <button class="btn btn-sm" :class="{ 'btn-primary': cardCat === 'equipment' }" @click="cardCat = 'equipment'">⚒ 装备</button>
            <span class="dim mono" style="margin-left: auto">{{ filteredPool.length }} 张</span>
            <button class="btn btn-sm" title="自动选择战力最高的前 3 张" :disabled="!filteredPool.length" @click="pickBest">✨ 一键最强</button>
          </div>
          <div class="card-grid">
            <div
              v-for="(id, ii) in pagedCards"
              :key="id?.id ?? 'pad-' + ii"
              v-if="!id?._pad"
              class="item-card cb-card"
              :style="{ borderColor: cardColor(id) }"
              :class="{ selected: selectedCards.includes(id) }"
              @click="toggleCard(id)"
            >
              <div class="cb-badges">
                <span class="cb-type">{{ getItem(id)?.type === 'food' ? '🍽 料理' : '⚒ 装备' }}</span>
                <span class="cb-power">⚔ {{ cardStrengthText(id) }}</span>
              </div>
              <img v-if="itemImage(id)" :src="itemImage(id)" class="item-img item-card-img" @error="$event.target.style.display = 'none'" alt="" />
              <div class="item-card-name">{{ getItem(id)?.name }}</div>
              <div class="dim">{{ CATEGORY_LABEL[getItem(id)?.category] ?? getItem(id)?.category ?? '' }}</div>
              <div class="mono dim">T{{ getItem(id)?.tier }}</div>
            </div>
            <p v-if="!cardPool.length" class="dim" style="grid-column: 1 / -1">还没有收集到料理/装备，去制作或获得吧。</p>
            <p v-else-if="!filteredPool.length" class="dim" style="grid-column: 1 / -1">没有符合搜索/筛选的卡牌。</p>
          </div>
          <div style="display: flex; justify-content: center; margin-top: 8px">
            <Pagination v-if="cardPages > 1" :current="Math.min(cardPage, cardPages)" :pages="cardPages" @update:current="(p) => (cardPage = p)" />
          </div>
          <div class="card cb-battle-panel">
            <div class="cb-battle-head">
              <button class="btn btn-sm btn-primary" :disabled="!selectedCards.length" @click="doCardBattle">⚔️ 开始对战</button>
              <span class="dim">当前卡组战力合计 <b class="mono">{{ selectedCards.reduce((a, id) => a + cardStrengthOf(id), 0).toFixed(0) }}</b></span>
            </div>
            <div v-if="battleResult" class="battle-result" :class="{ win: battleResult.won, lose: !battleResult.won }">
              <div class="cb-result-title">
                <template v-if="battleResult.won">
                  🏆 卡牌对决胜利！+{{ battleReward?.reward ?? 50 }} 金币
                  <span v-if="battleReward?.dailyBonus" class="cb-daily-bonus">+ 每日首胜 +{{ battleReward.dailyBonus }}</span>
                  <span v-if="battleReward?.firstBonus" class="cb-first-bonus">🎁 首胜能量饼干 ×1</span>
                </template>
                <template v-else>💀 卡牌对决失败，换几张卡试试</template>
              </div>
              <div class="cb-rounds">
                <div v-for="(r, i) in battleResult.rounds" :key="i" class="cb-round" :class="{ win: r.win, lose: !r.win }">
                  <span class="cb-round-idx">第 {{ i + 1 }} 局</span>
                  <span class="cb-round-cards">
                    {{ r.mine ? itemName(r.mine) : '—' }}（<b class="mono">{{ Math.round(r.ms) }}</b>）
                    <span class="dim">vs</span>
                    {{ r.theirs ? itemName(r.theirs) : '—' }}（<b class="mono">{{ Math.round(r.ts) }}</b>）
                  </span>
                  <span class="cb-round-verdict">{{ r.win ? '✅ 胜' : '❌ 负' }}</span>
                </div>
              </div>
            </div>
            <p v-else class="dim" style="margin: 8px 0 0">选好卡组后点击「开始对战」。</p>
          </div>
        </template>

      <!-- ── 配方手册（§3.2：全部配方一览，含未解锁）── -->
      <template v-else-if="tab === 'recipes'">
        <div class="region-tabs" style="flex-wrap: wrap">
          <button
            v-for="inst in recipeInstances"
            :key="inst.id"
            class="btn btn-sm"
            :class="{ 'btn-primary': curRecipe?.id === inst.id }"
            @click="selectRecipeCat(inst.id)"
          >
            {{ getSkillDef(inst.id)?.name }}（{{ inst.recipes.length }}）
          </button>
        </div>
        <template v-for="inst in [curRecipe]" :key="inst?.id">
          <div v-if="inst" style="margin-bottom: 12px">
            <h3>{{ getSkillDef(inst.id)?.name }}（{{ inst.recipes.length }}）</h3>
          <div class="quick-nav">
            <span class="dim" style="font-size: 12px">快速跳转：</span>
            <button v-for="sec in recipeSections(inst)" :key="sec.label" class="btn btn-sm" @click="scrollToLabel(inst.id, sec.label)">{{ sec.label }}</button>
          </div>
          <div v-for="sec in recipeSections(inst)" :key="'s' + sec.label" class="gather-section" :id="'recipe-sec-' + inst.id + '-' + sec.label">
            <div class="gather-section-title" @click="toggleSection(inst.id, sec.label)">
              <span class="mono">{{ isOpen(inst.id, sec.label) ? '−' : '+' }}</span>
              <strong>Lv {{ sec.label }}</strong>
              <span class="dim">{{ sec.list.length }} 个配方</span>
            </div>
            <div v-if="isOpen(inst.id, sec.label)" class="gather-grid recipe-grid">
              <div
                v-for="r in sec.list"
                :key="r.id"
                v-tilt
                class="gather-card"
                :class="{ locked: player.skillState(inst.id).level < r.reqLevel }"
              >
              <div class="gather-card-head">
                <ItemImg :item-id="r.output.itemId" />
                <div>
                  <strong>{{ r.name }}</strong>
                  <div class="dim" style="font-size: 12px">{{ CATEGORY_LABEL[r.category] ?? r.category }} · Lv {{ r.reqLevel }}</div>
                </div>
              </div>
              <div class="gather-card-row">
                <span>成功率</span>
                <span class="mono">{{ (r.successChance * 100).toFixed(0) }}%</span>
              </div>
              <div class="ing-cell gather-card-ing">
                <span
                  v-for="(qty, itemId) in r.ingredients"
                  :key="itemId"
                  class="ing"
                  style="cursor: pointer"
                  :title="`点击查看 ${itemName(itemId)} 获取来源`"
                  @click="detailItem = itemId"
                >
                  {{ itemName(itemId) }} <span class="mono">×{{ qty }}</span>
                </span>
              </div>
              <div class="gather-card-row">
                <span>产出</span>
                <span class="dim" style="cursor: pointer" :title="`点击查看 ${itemName(r.output.itemId)}`" @click="detailItem = r.output.itemId">
                  {{ itemName(r.output.itemId) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        </div>
        </template>
      </template>

      <!-- ── 故事（§13：线性七章）── -->

    </div>

    <!-- 物品详情弹窗（点击图鉴物品显示） -->
    <ItemDetailModal v-if="detailItem" :item-id="detailItem" @close="detailItem = null" />

    <!-- 首领详情弹窗（点击首领图鉴行显示）-->
    <div v-if="bossDetail" class="modal-backdrop" @click.self="bossDetail = null">
      <div class="modal boss-detail-modal">
        <header class="modal-head">
          <h3>👑 {{ bossDetail.name }}</h3>
          <button class="btn btn-sm" @click="bossDetail = null">✕</button>
        </header>
        <div class="item-detail-body">
          <table class="target-table item-detail-table">
            <tbody>
              <tr><td class="dim" style="width: 90px">等级</td><td>{{ bossDetail.level }}</td></tr>
              <tr><td class="dim">风格</td><td>{{ bossDetail.style === 'knife' ? '刀工' : bossDetail.style === 'plating' ? '摆盘' : '调味' }}</td></tr>
              <tr><td class="dim">生命值</td><td class="mono">{{ bossDetail.hp }}</td></tr>
              <tr><td class="dim">攻击 / 防御</td><td class="mono">{{ Math.round(bossDetail.atk) }} / {{ Math.round(bossDetail.def) }}</td></tr>
              <tr><td class="dim">命中 / 闪避</td><td class="mono">{{ Math.round(bossDetail.acc) }} / {{ Math.round(bossDetail.eva) }}</td></tr>
              <tr><td class="dim">暴击 / 攻速</td><td class="mono">{{ (bossDetail.crit * 100).toFixed(1) }}% / {{ (bossDetail.speedMs / 1000).toFixed(1) }}s</td></tr>
              <tr><td class="dim">机制</td><td>{{ mechText(bossDetail) }}</td></tr>
              <tr><td class="dim">状态</td><td>{{ bossStatus(bossDetail.name) ? '已击败）' : '未击败' }}</td></tr>
            </tbody>
          </table>
          <div style="margin-top: 8px">
            <span class="dim">独有掉落：</span>
            <div v-for="(d, di) in bossDetail.drops ?? []" :key="di" class="tooltip-line">
              <span v-if="qualityBadge(d.itemId)" :style="{ color: qualityBadge(d.itemId).color }">{{ qualityBadge(d.itemId).text }}</span>
              {{ getItem(d.itemId)?.name }} <span class="dim">（{{ Math.round(d.chance * 100) }}%）</span>
              <span v-if="player.collected[d.itemId]" class="badge badge-on">已获得</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── 每日/周常面板（2026-09-06）── */
.daily-panel { margin-bottom: 12px; background: rgba(255, 251, 244, 0.85); }
.daily-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.daily-head strong { font-size: 15px; }
.daily-grid { display: flex; flex-direction: column; gap: 6px; }
.daily-item {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 10px; border-radius: 8px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px dashed rgba(217, 90, 56, 0.25);
}
.daily-item.done { border-color: var(--good); background: rgba(92, 184, 92, 0.08); }
.daily-name { flex: 1; min-width: 0; }
.daily-gold { white-space: nowrap; }
.daily-bonus { margin-top: 8px; font-size: 12px; color: var(--good-strong); }
.weekly-row {
  display: flex; align-items: center; gap: 10px; margin-top: 10px;
  padding: 8px 10px; border-radius: 8px;
  background: rgba(217, 90, 56, 0.06);
  border: 1px solid rgba(217, 90, 56, 0.3);
}
.weekly-row.done { border-color: var(--good); background: rgba(92, 184, 92, 0.08); }
.weekly-row strong { flex: 1; min-width: 0; font-size: 13px; }
/* ── 转生（轮回）详解：条目卡片列表（左圆圈 + 标题 + 正文 + 蓝色小标签） ── */
.prestige-list { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.prestige-count { font-size: 12px; margin-bottom: 2px; }
.prestige-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: rgba(255, 252, 246, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 10px;
  padding: 10px 12px;
}
.prestige-dot {
  width: 12px;
  height: 12px;
  border: 2px solid #9bb7ff;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 3px;
}
.prestige-body { flex: 1; min-width: 0; }
.prestige-title { font-size: 14px; display: block; }
.prestige-desc { font-size: 12px; color: var(--muted); margin-top: 3px; line-height: 1.5; }
.prestige-desc :deep(.hl), .prestige-desc .hl { color: var(--primary); font-weight: 600; }
.prestige-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
.prestige-tag {
  font-size: 12px;
  color: #2e6bd6;
  border: 1px solid #b7cdf3;
  border-radius: 999px;
  padding: 1px 8px;
  background: rgba(46, 107, 214, 0.06);
}
.season-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 10px;
}
.season-card {
  background: rgba(255, 252, 246, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  padding: 10px 12px;
}
.season-card.locked { opacity: 0.82; }
.season-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 13px;
}
.season-card-sub { font-size: 12px; margin: 3px 0 8px; }
.season-gear-list { display: flex; flex-direction: column; gap: 3px; }
.season-gear-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 2px 4px;
  border-bottom: 1px dashed rgba(217, 90, 56, 0.18);
}
.season-gear-row:last-child { border-bottom: none; }
.season-gear-row.got { color: var(--good-strong); }
.season-gear-slot { color: var(--muted); white-space: nowrap; min-width: 58px; font-size: 12px; }
.season-gear-name { flex: 1; }
.season-gear-flag { font-weight: 700; }
</style>
