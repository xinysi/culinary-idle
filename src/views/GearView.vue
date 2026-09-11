<script setup>
// 装备总览（2026-09-11 新增）— 把原先只存在于「装备弹窗」里的三套数据（套装 / 词条 / 宝石）整理成可浏览的收集页。
// 纯读取层：只读 ITEMS / equipSets / gearMods / gems 的既有定义，不改动任何装备数值与配方（数据铁律）。
// 与弹窗的分工：这里负责「看与查」（收集进度、效果说明、图鉴），穿戴/强化/镶嵌操作仍在装备弹窗里做。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { EQUIPMENT_SETS, equipSetBonuses } from '../game/data/equipSets.js'
import { MOD_COUNT_RANGE, MOD_TYPES, REROLL_COST, fmtMod } from '../game/data/gearMods.js'
import { GEM_DEFS, GEM_SOCKETS_BY_QUALITY } from '../game/data/gems.js'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'log', label: '📖 图鉴' },
  { view: 'achievements', label: '🏅 成就与称号' },
]
// 装备的两个来源技能：直接切到对应技能页（RelatedPages 只能切 view，切不了具体技能）
const SOURCE_SKILLS = [
  { id: 'excavation', label: '⛏️ 去采矿' },
  { id: 'craftsmithing', label: '🔨 去厨具锻造' },
]
function goSkill(id) {
  player.setActiveSkill(id)
  ui.setView('skill')
}

const TABS = [
  { id: 'sets', name: '🧩 套装' },
  { id: 'gems', name: '💎 宝石' },
  { id: 'mods', name: '✨ 词条' },
]
const tab = ref('sets')
const keyword = ref('')
const onlyOwned = ref(false)

const QUALITY_ORDER = ['普通', '精良', '稀有', '史诗', '传说', '神话']

// ── 拥有判定：背包里有 或 正穿在身上 ──
function equippedIds() {
  return new Set(Object.values(player.equipment ?? {}).filter(Boolean))
}
function hasItem(id) {
  return (player.inventory?.[id] ?? 0) > 0 || equippedIds().has(id)
}
function ownedQty(id) {
  return (player.inventory?.[id] ?? 0) + (equippedIds().has(id) ? 1 : 0)
}

// ── 套装 ──
const activeSetMap = computed(() => {
  const m = new Map()
  for (const s of equipSetBonuses(player.equipment).active) m.set(s.key, s)
  return m
})

/** 套件等级 = 该套已拥有件中最高的 tier×10（与 equipSets.js 的生效算法一致） */
function setLevel(ids) {
  const owned = ids.filter((id) => hasItem(id))
  const pool = owned.length ? owned : ids
  return Math.max(...pool.map((id) => (getItem(id)?.tier ?? 1) * 10))
}

const setRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return EQUIPMENT_SETS.map((s) => {
    const owned = s.ids.filter((id) => hasItem(id))
    const worn = s.ids.filter((id) => equippedIds().has(id)).length
    const active = activeSetMap.value.get(s.key)
    return {
      ...s,
      total: s.ids.length,
      ownedCount: owned.length,
      worn,
      activeCount: active?.count ?? 0,
      level: setLevel(s.ids),
      items: [...s.ids].sort((a, b) => (getItem(b)?.tier ?? 0) - (getItem(a)?.tier ?? 0)),
    }
  })
    .filter((r) => (!onlyOwned.value || r.ownedCount > 0) && (!kw || r.name.toLowerCase().includes(kw)))
    .sort((a, b) => b.level - a.level || b.ownedCount - a.ownedCount || a.name.localeCompare(b.name, 'zh'))
})

/** 2/4/6 件效果的数值说明（随套件等级缩放，文案与 equipSets.js 一致） */
function setTiers(level) {
  return [
    { n: 2, text: `攻击 +${(level * 0.12).toFixed(1)} · 防御 +${(level * 0.12).toFixed(1)}` },
    { n: 4, text: `生命 +${(level * 0.5).toFixed(1)} · 命中 +${(level * 0.1).toFixed(1)}` },
    { n: 6, text: '暴击 +0.5% · 攻速 +3%' },
  ]
}

const expanded = ref(new Set())
function toggleExpand(key) {
  const next = new Set(expanded.value)
  next.has(key) ? next.delete(key) : next.add(key)
  expanded.value = next
}

// 顶部概览
const wornCount = computed(() => Object.values(player.equipment ?? {}).filter(Boolean).length)
const totalUpgrades = computed(() => Object.values(player.upgrades ?? {}).reduce((a, b) => a + (b ?? 0), 0))
const ownedSetCount = computed(() => setRows.value.filter((r) => r.ownedCount > 0).length)
const fullSetCount = computed(() => setRows.value.filter((r) => r.ownedCount === r.total).length)
const activeSetList = computed(() => equipSetBonuses(player.equipment).active)

// 当前穿戴的词条
const wornMods = computed(() =>
  Object.entries(player.gearMods ?? {})
    .filter(([slot, m]) => m?.itemId && player.equipment?.[slot] === m.itemId && (m.mods ?? []).length)
    .map(([slot, m]) => ({ slot, name: getItem(m.itemId)?.name ?? m.itemId, mods: m.mods }))
)

// ── 宝石 ──
const gemRows = computed(() =>
  GEM_DEFS.map((g) => ({
    ...g,
    name: getItem(g.itemId)?.name ?? g.itemId,
    quality: getItem(g.itemId)?.quality ?? '',
    owned: ownedQty(g.itemId),
  })).sort((a, b) => (getItem(b.itemId)?.tier ?? 0) - (getItem(a.itemId)?.tier ?? 0))
)
const socketTable = computed(() =>
  QUALITY_ORDER.map((q) => ({ quality: q, sockets: GEM_SOCKETS_BY_QUALITY[q] ?? 0 }))
)
// 已镶嵌的宝石（按槽位）
const socketedGems = computed(() =>
  Object.entries(player.gemSockets ?? {})
    .filter(([slot, rec]) => rec?.itemId === player.equipment?.[slot] && (rec.gems ?? []).some(Boolean))
    .map(([slot, rec]) => ({
      slot,
      itemName: getItem(rec.itemId)?.name ?? rec.itemId,
      gems: rec.gems.map((id) => (id ? getItem(id)?.name ?? id : null)),
    }))
)

// ── 词条 ──
const modPoolTotal = computed(() => MOD_TYPES.reduce((a, t) => a + t.weight, 0))
const modPool = computed(() =>
  [...MOD_TYPES]
    .sort((a, b) => b.weight - a.weight)
    .map((t) => ({ ...t, pct: ((t.weight / modPoolTotal.value) * 100).toFixed(0) }))
)
const modCountTable = computed(() =>
  QUALITY_ORDER.filter((q) => q in MOD_COUNT_RANGE).map((q) => {
    const [min, max] = MOD_COUNT_RANGE[q]
    return { quality: q, text: min === max ? `${min} 条` : `${min}~${max} 条` }
  })
)
const rerollTable = computed(() =>
  QUALITY_ORDER.filter((q) => q in REROLL_COST).map((q) => ({ quality: q, cost: REROLL_COST[q] }))
)
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>⚔️ 装备总览</h2>
        <p class="dim">
          装备系统的「看与查」：<b>套装收集进度</b>、<b>宝石图鉴</b>、<b>词条规则</b>。
          穿戴 / 强化 / 镶嵌 / 洗练等操作在 <b>背包 → 装备</b> 弹窗里进行。
        </p>
      </div>
    </header>

    <!-- 概览 -->
    <div class="card gv-hero">
      <div class="gv-stat"><span class="dim">已穿戴</span><b class="mono">{{ wornCount }}/8 槽</b></div>
      <div class="gv-stat"><span class="dim">强化总等级</span><b class="mono">+{{ totalUpgrades }}</b></div>
      <div class="gv-stat"><span class="dim">激活套装</span><b class="mono">{{ activeSetList.length }}</b></div>
      <div class="gv-stat"><span class="dim">已收集套装</span><b class="mono">{{ ownedSetCount }}/{{ setRows.length }}</b></div>
      <div class="gv-stat"><span class="dim">集齐套装</span><b class="mono">{{ fullSetCount }}</b></div>
    </div>

    <!-- 激活中的套装 -->
    <div v-if="activeSetList.length" class="card gv-card">
      <div class="gv-h">🔥 当前激活的套装加成</div>
      <div class="gv-list">
        <div v-for="s in activeSetList" :key="s.key" class="gv-row">
          <span><span class="badge badge-on">{{ s.count }} 件</span> {{ s.name }}</span>
          <span class="dim mono">套件等级 {{ s.level }}</span>
          <span class="dim">下一档：{{ s.count >= 6 ? '已满 6 件' : s.count >= 4 ? '6 件 → 暴击 +0.5%、攻速 +3%' : '4 件 → 生命/命中提升' }}</span>
        </div>
      </div>
    </div>

    <!-- 页签 -->
    <div class="gv-tabs">
      <button v-for="t in TABS" :key="t.id" class="btn btn-sm" :class="{ 'btn-primary': tab === t.id }" @click="tab = t.id">
        {{ t.name }}
      </button>
    </div>

    <!-- ① 套装 -->
    <template v-if="tab === 'sets'">
      <div class="card gv-card">
        <div class="gv-filter">
          <input v-model="keyword" class="gv-search" type="text" placeholder="搜索套装名…" />
          <label class="gv-check"><input v-model="onlyOwned" type="checkbox" /> 只看已拥有</label>
          <span class="dim">共 {{ setRows.length }} 套</span>
        </div>

        <div class="gv-list gv-set-list">
          <div v-for="r in setRows" :key="r.key" class="gv-set">
            <div class="gv-set-head">
              <span class="gv-set-name">{{ r.name }}</span>
              <span class="dim mono">{{ r.ownedCount }}/{{ r.total }} 件</span>
              <span v-if="r.activeCount" class="badge badge-on">穿戴 {{ r.activeCount }}</span>
              <span class="dim mono">套件等级 {{ r.level }}</span>
              <span class="gv-set-bar">
                <span class="gv-set-bar-fill" :style="{ width: (r.ownedCount / r.total) * 100 + '%' }"></span>
              </span>
              <button class="btn btn-sm" @click="toggleExpand(r.key)">
                {{ expanded.has(r.key) ? '收起' : '部件' }}
              </button>
            </div>

            <div class="gv-tiers">
              <span v-for="t in setTiers(r.level)" :key="t.n" class="gv-tier" :class="{ on: r.activeCount >= t.n }">
                <b>{{ t.n }} 件</b> {{ t.text }}
              </span>
            </div>

            <div v-if="expanded.has(r.key)" class="gv-parts">
              <div v-for="id in r.items" :key="id" class="gv-part" :class="{ owned: hasItem(id), worn: equippedIds().has(id) }">
                <span class="gv-part-name">{{ getItem(id)?.name ?? id }}</span>
                <span class="dim">{{ getItem(id)?.quality ?? '' }}</span>
                <span class="dim mono">x{{ ownedQty(id) }}</span>
                <span v-if="equippedIds().has(id)" class="badge badge-on">穿戴中</span>
                <span v-else-if="hasItem(id)" class="badge">已拥有</span>
                <span v-else class="dim">未获得</span>
              </div>
            </div>
          </div>
        </div>
        <p v-if="!setRows.length" class="dim">没有匹配的套装。</p>
      </div>
    </template>

    <!-- ② 宝石 -->
    <template v-else-if="tab === 'gems'">
      <div class="card gv-card">
        <div class="gv-h">💎 宝石图鉴（{{ gemRows.length }} 种 · 全部为既有矿物）</div>
        <div class="gv-table">
          <div class="gv-th"><span>宝石</span><span>加成</span><span>持有</span></div>
          <div v-for="g in gemRows" :key="g.itemId" class="gv-tr">
            <span>{{ g.name }} <span class="dim">{{ g.quality }}</span></span>
            <span class="dim">{{ g.desc }}</span>
            <span class="mono" :class="{ dim: !g.owned }">x{{ g.owned }}</span>
          </div>
        </div>
        <p class="dim gv-sub">镶嵌消耗 1 个矿物；换装 / 卸下会<b>自动退回</b>宝石，不会丢失。</p>
      </div>

      <div class="card gv-card">
        <div class="gv-h">🔩 插槽数（按装备品质）</div>
        <div class="gv-chips">
          <span v-for="s in socketTable" :key="s.quality" class="gv-chip">
            {{ s.quality }} <b class="mono">{{ s.sockets }}</b>
          </span>
        </div>
      </div>

      <div class="card gv-card">
        <div class="gv-h">📌 已镶嵌</div>
        <div v-if="socketedGems.length" class="gv-list">
          <div v-for="s in socketedGems" :key="s.slot" class="gv-row">
            <span>{{ s.itemName }}</span>
            <span class="dim">
              <template v-for="(g, i) in s.gems" :key="i">{{ g ?? `空插槽 ${i + 1}` }}<template v-if="i < s.gems.length - 1"> · </template></template>
            </span>
          </div>
        </div>
        <p v-else class="dim">当前没有已镶嵌的宝石。穿戴带插槽的装备后，在装备弹窗里镶嵌。</p>
      </div>
    </template>

    <!-- ③ 词条 -->
    <template v-else>
      <div class="card gv-card">
        <div class="gv-h">✨ 词条条数（按品质）</div>
        <div class="gv-chips">
          <span v-for="m in modCountTable" :key="m.quality" class="gv-chip">{{ m.quality }} <b class="mono">{{ m.text }}</b></span>
        </div>
        <p class="dim gv-sub">词条在<b>穿戴装备时随机掷出</b>，绑定到「槽位 + 装备」，换装会重掷。</p>
      </div>

      <div class="card gv-card">
        <div class="gv-h">🎲 词条池（加权随机 · 不重复）</div>
        <div class="gv-table">
          <div class="gv-th"><span>词条</span><span>抽取权重</span><span>占比</span></div>
          <div v-for="t in modPool" :key="t.stat" class="gv-tr">
            <span>{{ t.label }}</span>
            <span class="dim mono">{{ t.weight }}</span>
            <span class="mono">{{ t.pct }}%</span>
          </div>
        </div>
      </div>

      <div class="card gv-card">
        <div class="gv-h">🔄 洗练费用（按品质）</div>
        <div class="gv-chips">
          <span v-for="r in rerollTable" :key="r.quality" class="gv-chip">{{ r.quality }} <b class="mono">{{ r.cost.toLocaleString() }}</b></span>
        </div>
      </div>

      <div class="card gv-card">
        <div class="gv-h">📌 当前穿戴的词条</div>
        <div v-if="wornMods.length" class="gv-list">
          <div v-for="w in wornMods" :key="w.slot" class="gv-row">
            <span>{{ w.name }}</span>
            <span class="gv-mod-chips">
              <span v-for="(m, i) in w.mods" :key="i" class="mod-chip">{{ fmtMod(m) }}</span>
            </span>
          </div>
        </div>
        <p v-else class="dim">当前没有生效的词条（未穿戴 / 该装备未掷出词条）。</p>
      </div>
    </template>

    <div class="card gv-src">
      <span class="dim gv-src-title">装备来源：</span>
      <button v-for="s in SOURCE_SKILLS" :key="s.id" class="btn btn-sm" @click="goSkill(s.id)">{{ s.label }}</button>
      <span class="dim">（装备由采矿 → 锻造产出，穿戴/强化/镶嵌在背包 → 装备弹窗）</span>
    </div>

    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.gv-hero {
  margin-top: 12px;
  padding: 12px 16px;
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
}
.gv-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.gv-stat b {
  font-size: 16px;
}
.gv-card {
  margin-top: 12px;
}
.gv-h {
  font-weight: 600;
}
.gv-sub {
  font-size: 12px;
  margin-top: 8px;
  line-height: 1.6;
}
.gv-tabs {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.gv-filter {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
}
.gv-search {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-soft);
  color: inherit;
  font-size: 12px;
  min-width: 160px;
}
.gv-check {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.gv-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 8px;
}
.gv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
  flex-wrap: wrap;
}
.gv-set-list {
  gap: 8px;
}
.gv-set {
  padding: 7px 10px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.gv-set-head {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  flex-wrap: wrap;
}
.gv-set-name {
  font-weight: 600;
  min-width: 96px;
}
.gv-set-bar {
  flex: 1;
  min-width: 60px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  overflow: hidden;
}
.gv-set-bar-fill {
  display: block;
  height: 100%;
  background: var(--accent, #d95a38);
}
.gv-tiers {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 5px;
  font-size: 12px;
}
.gv-tier {
  color: var(--muted);
}
.gv-tier.on {
  color: var(--gold, #a8780b);
  font-weight: 600;
}
.gv-parts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 4px;
  margin-top: 7px;
  padding-top: 7px;
  border-top: 1px dashed var(--border);
}
.gv-part {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 3px 4px;
}
.gv-part-name {
  flex: 1;
}
.gv-part:not(.owned) .gv-part-name {
  color: var(--muted);
}
.gv-table {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.gv-th,
.gv-tr {
  display: grid;
  grid-template-columns: minmax(120px, 1.2fr) 2fr 70px;
  gap: 10px;
  align-items: center;
  padding: 5px 8px;
  border-radius: 6px;
}
.gv-th {
  font-size: 12px;
  color: var(--muted);
  border-bottom: 1px dashed var(--border);
}
.gv-tr {
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.gv-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.gv-chip {
  font-size: 12px;
  padding: 4px 9px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.gv-mod-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.gv-src {
  margin-top: 12px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}
</style>
