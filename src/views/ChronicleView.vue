<script setup>
// 厨师年鉴（2026-09-10 新增）— 个人编年史：首次达成事件按时间线记录。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { CHRONICLE_KINDS, CHRONICLE_KIND_KEYS, groupByDay, fmtChronicleTime } from '../game/data/chronicle.js'

const player = usePlayerStore()
const ui = useUiStore()
const kindFilter = ref('all')

const entries = computed(() => [...(player.chronicle ?? [])].sort((a, b) => b.at - a.at))
const filtered = computed(() => (kindFilter.value === 'all' ? entries.value : entries.value.filter((e) => e.kind === kindFilter.value)))
const days = computed(() => groupByDay(filtered.value))
const kd = (k) => CHRONICLE_KINDS[k] ?? { label: k, icon: '•' }
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📜 厨师年鉴</h2>
        <p class="dim">
          把「首次达成」记进个人编年史：首次击败每位首领、转生、米其林升星、秘境/挑战塔新纪录、竞技场连胜、试炼首通、大赛档位、分店开业、学派满级、食灵物语…
          共 <b class="mono">{{ entries.length }}</b> 条记录。
        </p>
      </div>
      <button class="btn btn-sm btn-primary" @click="ui.toggleShareCard(true)">📸 生成战报</button>
    </header>

    <div class="card status-line">
      <button class="btn btn-sm" :class="{ 'btn-primary': kindFilter === 'all' }" @click="kindFilter = 'all'">全部 {{ entries.length }}</button>
      <button
        v-for="k in CHRONICLE_KIND_KEYS"
        :key="k"
        v-show="player.chronicleCount(k) > 0"
        class="btn btn-sm"
        :class="{ 'btn-primary': kindFilter === k }"
        @click="kindFilter = k"
      >{{ kd(k).icon }} {{ kd(k).label }} {{ player.chronicleCount(k) }}</button>
    </div>

    <p v-if="!filtered.length" class="dim">年鉴还是空白——去打赢第一场首领战、完成第一次转生，这里就会开始记录。</p>

    <div v-for="d in days" :key="d.day" class="card chron-day">
      <div class="chron-day-head">
        <span class="mono">{{ d.day }}</span>
        <span class="dim">{{ d.entries.length }} 条</span>
      </div>
      <div v-for="e in d.entries" :key="e.key" class="chron-row">
        <span class="chron-icon">{{ kd(e.kind).icon }}</span>
        <span class="chron-kind badge">{{ kd(e.kind).label }}</span>
        <span class="chron-text">{{ e.text }}</span>
        <span class="dim mono chron-time">{{ fmtChronicleTime(e.at).slice(11) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chron-day {
  padding: 12px 14px;
  margin-top: 10px;
}
.chron-day-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--border);
}
.chron-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px dashed var(--border);
}
.chron-row:last-child {
  border-bottom: none;
}
.chron-icon {
  font-size: 16px;
}
.chron-kind {
  font-size: 12px;
}
.chron-text {
  flex: 1;
  min-width: 0;
}
.chron-time {
  font-size: 12px;
}
</style>
