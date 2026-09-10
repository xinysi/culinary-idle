<script setup>
// 里程碑之路（2026-09-10 新增）— 长线目标路线图：一页看清「还剩什么」。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { MILESTONES, milestoneSummary } from '../game/data/milestones.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()
const onlyTodo = ref(false)

const GROUPS = ['成长', '收集', '对战', '经营', '长线']

const rows = computed(() => {
  const list = MILESTONES.map((m) => {
    const raw = Number(m.value(player)) || 0
    const cur = Math.min(m.target, raw)
    return { ...m, cur, raw, done: raw >= m.target, progress: m.target > 0 ? cur / m.target : 0 }
  })
  return onlyTodo.value ? list.filter((r) => !r.done) : list
})

const summary = computed(() => milestoneSummary(player))

/** 跳转到相关页面 */
const JUMP = {
  成长: 'skill',
  收集: 'log',
  对战: 'arena',
  经营: 'restaurant',
  长线: 'guide',
}
function jump(r) {
  const view = JUMP[r.group] ?? 'skill'
  ui.setView(view)
  ui.pushLog(`🗺 里程碑「${r.name}」相关页面：${view === 'log' ? '图鉴/统计' : view}`, 'info')
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'chronicle', label: '📜 年鉴' }, { view: 'seasonReview', label: '📅 赛季回顾' }, { view: 'honor', label: '🎖 荣誉殿堂' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🗺 里程碑之路</h2>
        <p class="dim">
          把全部长线目标排成一条路线图：<b>{{ summary.done }} / {{ summary.total }}</b> 已完成（{{ summary.pct }}%）。
          每项都标了当前进度与达成提示，鼠标悬停看目标详情。
        </p>
      </div>
      <button class="btn btn-sm" :class="{ 'btn-primary': onlyTodo }" @click="onlyTodo = !onlyTodo">
        {{ onlyTodo ? '✓ 只看未完成' : '只看未完成' }}
      </button>
    </header>

    <div class="card status-line">
      <span v-for="g in GROUPS" :key="g" class="badge" :class="{ 'badge-on': (summary.byGroup[g]?.done ?? 0) === (summary.byGroup[g]?.total ?? 0) }">
        {{ g }} {{ summary.byGroup[g]?.done ?? 0 }}/{{ summary.byGroup[g]?.total ?? 0 }}
      </span>
      <span class="dim">共 {{ summary.total }} 项长线目标</span>
    </div>

    <div v-for="g in GROUPS" :key="'sec-' + g" class="ms-section">
      <h3>{{ g }} <span class="dim">（{{ summary.byGroup[g]?.done ?? 0 }}/{{ summary.byGroup[g]?.total ?? 0 }}）</span></h3>
      <div class="ms-grid">
        <div
          v-for="r in rows.filter((x) => x.group === g)"
          :key="r.id"
          class="card ms-card"
          :class="{ done: r.done }"
          :title="r.hint"
          @click="jump(r)"
        >
          <div class="ms-head">
            <span class="ms-icon">{{ r.done ? '✅' : r.icon }}</span>
            <strong>{{ r.name }}</strong>
          </div>
          <ProgressBar :progress="r.progress" />
          <div class="dim ms-sub mono">
            {{ r.raw.toLocaleString() }} / {{ r.target.toLocaleString() }} {{ r.unit }}
            <span v-if="r.done" class="ms-done">已达成</span>
          </div>
          <div class="dim ms-sub">{{ r.hint }}</div>
        </div>
      </div>
    </div>

    <p v-if="!rows.length" class="dim">🎉 全部里程碑已达成——接下来是自由发挥时间。</p>
      <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.ms-section {
  margin-top: 14px;
}
.ms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  margin-top: 8px;
}
.ms-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: transform 0.12s ease, border-color 0.15s ease;
}
.ms-card:hover {
  transform: translateY(-2px);
  border-color: var(--primary);
}
.ms-card.done {
  border-color: var(--good-strong);
}
.ms-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.ms-icon {
  font-size: 18px;
}
.ms-sub {
  font-size: 12px;
  line-height: 1.6;
}
.ms-done {
  margin-left: 8px;
  color: var(--good-strong);
  font-weight: 700;
}
</style>
