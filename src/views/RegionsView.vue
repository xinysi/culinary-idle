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
        <div class="dim region-sub">特产：{{ boxText(r.def) }}</div>
        <div class="dim region-sub mono">
          派驻加成：产量 +{{ r.bonus.qtyPct }}% · 稀有率 +{{ r.bonus.rarePct }}%
          <template v-if="r.unlocked"> · 当前派驻：{{ r.postedLines.join('、') || '无' }}</template>
        </div>
        <button v-if="!r.unlocked" class="btn btn-sm btn-primary" @click="study(r)">考察（{{ r.def.cost.toLocaleString() }} 金币）</button>
        <div v-else class="dim region-sub">✅ 已考察 · 当季月份：{{ r.def.seasonMonths.map((m) => `${m} 月`).join('、') }}</div>
      </div>
    </div>

    <h3 style="margin-top: 16px">采集队派驻</h3>
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
</style>
