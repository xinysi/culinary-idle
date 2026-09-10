<script setup>
// 产地与风土（2026-09-10 新增）— 考察产地 + 派驻采集队线路，换取该地特产与产量/稀有率加成。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { REGIONS, postingBonus } from '../game/data/regions.js'
import { EXPEDITIONS } from '../game/data/expeditions.js'
import { getItem } from '../game/data/items.js'

const player = usePlayerStore()
const ui = useUiStore()

const month = computed(() => new Date().getMonth() + 1)
const rows = computed(() =>
  REGIONS.map((def) => {
    const unlocked = player.regionUnlocked(def.id)
    const bonus = postingBonus(def, month.value)
    const postedLines = EXPEDITIONS.filter((l) => player.regionPosting?.[l.id] === def.id).map((l) => l.name)
    return { def, unlocked, bonus, postedLines, inSeason: bonus.inSeason }
  })
)
const lines = computed(() =>
  EXPEDITIONS.map((def) => {
    const post = player.lineRegion(def.id)
    return { def, region: post.def, bonus: post.bonus }
  })
)

function study(r) {
  const res = player.regionStudy(r.def.id)
  if (!res.ok) ui.pushLog(res.msg, 'warn')
}
function setPost(lineId, ev) {
  const res = player.regionPost(lineId, ev.target.value || null)
  if (!res.ok) ui.pushLog(res.msg, 'warn')
}
function boxText(def) {
  return def.box.map((id) => getItem(id)?.name ?? id).join('、')
}

// ── 总览（2026-09-10 补）：考察进度 + 派驻情况 + 各线路加成合计 ──
const summary = computed(() => {
  const unlocked = rows.value.filter((r) => r.unlocked).length
  const posted = lines.value.filter((l) => l.region).length
  const maxQty = rows.value.reduce((a, r) => Math.max(a, r.bonus.qtyPct), 0)
  const maxRare = rows.value.reduce((a, r) => Math.max(a, r.bonus.rarePct), 0)
  const season = rows.value.filter((r) => r.inSeason)
  return {
    unlocked, total: REGIONS.length,
    posted, lineTotal: EXPEDITIONS.length,
    maxQty, maxRare,
    season,
    spent: REGIONS.filter((r) => player.regionUnlocked(r.id)).reduce((a, r) => a + r.cost, 0),
  }
})

// ── 当季日历（2026-09-10 补）：12 个月各自哪些产地当季 ──
const calendar = computed(() =>
  Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const inSeason = REGIONS.filter((r) => (r.seasonMonths ?? []).includes(m))
    return {
      month: m,
      regions: inSeason,
      current: m === month.value,
      hasUnlocked: inSeason.some((r) => player.regionUnlocked(r.id)),
    }
  })
)

// ── 各产地的特产明细（2026-09-10 补）：标注哪些是稀有池成员 ──
function boxDetail(def) {
  return (def.box ?? []).map((id) => {
    const it = getItem(id)
    return { id, name: it?.name ?? id, value: it?.value ?? 0, rarity: it?.rarity }
  })
}
function goExpedition() {
  ui.setView('expedition')
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'expedition', label: '🚢 采集队' }, { view: 'automation', label: '🤖 自动化' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🗺️ 产地与风土</h2>
        <p class="dim">
          五个产地的特产池可与<b>采集队线路</b>结合：先花金币「考察」，再把线路派驻到产地——
          该线路的产出会混入产地特产，产量 +12%~22%、稀有掉落率 +5%~10%；<b>当季产地</b>（按月份轮换）再 ×1.5。
        </p>
      </div>
      <span class="dim mono">当季：{{ rows.filter((r) => r.inSeason).map((r) => r.def.name).join('、') || '无' }}</span>
    </header>

    <!-- 总览（2026-09-10 补） -->
    <div class="card region-hero">
      <div class="region-hero-left">
        <div class="region-hero-num">{{ summary.unlocked }}<span class="dim region-hero-max">/{{ summary.total }}</span></div>
        <div class="dim region-hero-label">已考察产地</div>
      </div>
      <div class="region-hero-right">
        <div class="dim region-sub">
          派驻线路 <b class="mono">{{ summary.posted }}</b> / {{ summary.lineTotal }} 条 ·
          考察累计投入 <b class="mono">{{ summary.spent.toLocaleString() }}</b> 金币 ·
          最高加成 产量 <b class="mono">+{{ summary.maxQty }}%</b> / 稀有 <b class="mono">+{{ summary.maxRare }}%</b>
        </div>
        <div class="region-hero-chips">
          <button
            v-for="r in summary.season"
            :key="r.def.id"
            class="region-chip"
            :class="{ on: r.unlocked }"
            :title="r.unlocked ? '当季 ×1.5 已生效' : '需先考察该产地'"
          >
            {{ r.def.icon }} {{ r.def.name }} 当季 ×1.5{{ r.unlocked ? '' : '（未考察）' }}
          </button>
          <span v-if="!summary.season.length" class="dim region-sub">本月没有处于当季的产地。</span>
        </div>
      </div>
    </div>

    <!-- 当季日历（2026-09-10 补）：提前安排派驻 -->
    <div class="card region-cal">
      <div class="region-cal-h">📅 当季日历（按月份轮换，当季产地加成 ×1.5）</div>
      <div class="region-cal-grid">
        <div v-for="c in calendar" :key="c.month" class="region-cal-cell" :class="{ current: c.current, empty: !c.regions.length }">
          <div class="region-cal-month">{{ c.month }} 月<span v-if="c.current" class="badge badge-on">本月</span></div>
          <div v-if="c.regions.length" class="region-cal-list">
            <span v-for="r in c.regions" :key="r.id" class="region-cal-chip">{{ r.icon }} {{ r.name }}</span>
          </div>
          <div v-else class="dim region-cal-none">无当季产地</div>
        </div>
      </div>
    </div>

    <div class="region-grid">
      <div v-for="r in rows" :key="r.def.id" class="card region-card" :class="{ unlocked: r.unlocked, season: r.inSeason }">
        <div class="region-head">
          <span class="region-icon">{{ r.def.icon }}</span>
          <div>
            <strong>{{ r.def.name }}</strong>
            <div class="dim region-sub">{{ r.def.desc }}</div>
          </div>
          <span v-if="r.inSeason" class="badge badge-on" style="margin-left: auto">当季</span>
        </div>
        <details class="region-box">
          <summary class="dim region-sub">特产池（{{ r.def.box.length }} 种）：{{ boxText(r.def) }}</summary>
          <div class="region-box-list">
            <span v-for="b in boxDetail(r.def)" :key="b.id" class="region-box-item" :title="`价值 ${b.value}`">
              {{ b.name }}<span class="dim mono"> v{{ b.value }}</span>
            </span>
          </div>
        </details>
        <div class="dim region-sub mono">
          派驻加成：产量 +{{ r.bonus.qtyPct }}% · 稀有率 +{{ r.bonus.rarePct }}%
          <template v-if="r.unlocked"> · 当前派驻：{{ r.postedLines.join('、') || '无' }}</template>
        </div>
        <button v-if="!r.unlocked" class="btn btn-sm btn-primary" @click="study(r)">考察（{{ r.def.cost.toLocaleString() }} 金币）</button>
        <div v-else class="dim region-sub">✅ 已考察 · 当季月份：{{ r.def.seasonMonths.map((m) => `${m} 月`).join('、') }}</div>
      </div>
    </div>

    <h3 style="margin-top: 16px">
      采集队派驻
      <button class="btn btn-sm" style="margin-left: 8px" @click="goExpedition">去采集队页</button>
    </h3>
    <div class="card">
      <table class="target-table">
        <tbody>
          <tr v-for="l in lines" :key="l.def.id">
            <td style="width: 130px"><b>{{ l.def.name }}</b></td>
            <td class="dim" style="width: 220px">{{ l.def.desc ?? '' }}</td>
            <td>
              <select :value="player.regionPosting?.[l.def.id] ?? ''" class="region-select" @change="setPost(l.def.id, $event)">
                <option value="">（不派驻）</option>
                <option v-for="r in rows.filter((x) => x.unlocked)" :key="r.def.id" :value="r.def.id">
                  {{ r.def.icon }} {{ r.def.name }}
                </option>
              </select>
            </td>
            <td class="dim mono" style="width: 220px">
              <template v-if="l.region">产量 +{{ l.bonus.qtyPct }}% · 稀有 +{{ l.bonus.rarePct }}%<template v-if="l.bonus.inSeason"> · 当季</template></template>
              <template v-else>未派驻</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.region-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.region-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.region-card.unlocked {
  border-color: var(--primary);
}
.region-card.season {
  box-shadow: 0 0 0 2px var(--primary-soft);
}
.region-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.region-icon {
  font-size: 22px;
}
.region-sub {
  font-size: 12px;
  line-height: 1.6;
}
.region-select {
  width: 100%;
  height: 30px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
}
/* 总览 + 当季日历 + 特产池（2026-09-10 补） */
.region-hero {
  margin-top: 12px;
  padding: 12px 14px;
  display: flex;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
}
.region-hero-left {
  text-align: center;
  min-width: 110px;
}
.region-hero-num {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--accent, #d95a38);
}
.region-hero-max {
  font-size: 14px;
  font-weight: 400;
}
.region-hero-label {
  font-size: 12px;
}
.region-hero-right {
  flex: 1;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.region-hero-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.region-chip {
  font: inherit;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  color: inherit;
  opacity: 0.65;
}
.region-chip.on {
  opacity: 1;
  border-color: var(--accent, #d95a38);
  color: var(--accent, #d95a38);
}
.region-cal {
  margin-top: 12px;
  padding: 12px 14px;
}
.region-cal-h {
  font-weight: 600;
  margin-bottom: 8px;
}
.region-cal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 6px;
}
.region-cal-cell {
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
  font-size: 12px;
  opacity: 0.75;
}
.region-cal-cell.current {
  opacity: 1;
  border-style: solid;
  border-color: var(--accent, #d95a38);
}
.region-cal-cell.empty {
  opacity: 0.5;
}
.region-cal-month {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  margin-bottom: 4px;
}
.region-cal-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.region-cal-chip {
  font-size: 11px;
}
.region-cal-none {
  font-size: 11px;
}
.region-box {
  font-size: 12px;
}
.region-box > summary {
  cursor: pointer;
}
.region-box-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
}
.region-box-item {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
}
</style>
