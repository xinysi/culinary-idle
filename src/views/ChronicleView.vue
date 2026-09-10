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

// ── 总览统计（2026-09-10 补）：把年鉴别做成一条裸时间线 ──
const today = computed(() => player.todayKey ?? '')
const stats = computed(() => {
  const list = entries.value
  const kindsLit = CHRONICLE_KIND_KEYS.filter((k) => (player.chronicleCount?.(k) ?? 0) > 0)
  const monthPrefix = String(today.value).slice(0, 7)
  const thisMonth = list.filter((e) => String(fmtChronicleTime(e.at)).startsWith(monthPrefix)).length
  const dayKeys = [...new Set(list.map((e) => String(fmtChronicleTime(e.at)).slice(0, 10)))].sort()
  return {
    total: list.length,
    kindsLit: kindsLit.length,
    kindsTotal: CHRONICLE_KIND_KEYS.length,
    thisMonth,
    firstDay: dayKeys[0] ?? null,
    lastDay: dayKeys[dayKeys.length - 1] ?? null,
    activeDays: dayKeys.length,
  }
})

// ── 类别 → 对应功能页跳转（2026-09-10 补）：把 12 个类别从死链变成入口 ──
const KIND_JUMP = {
  boss: { view: 'skill', label: '对决', skill: 'knife' },
  prestige: { view: 'skill', label: '转生' },
  michelin: { view: 'michelin', label: '米其林评级' },
  realm: { view: 'skill', label: '秘境', skill: 'knife' },
  tower: { view: 'skill', label: '挑战塔', skill: 'knife' },
  arena: { view: 'arena', label: '竞技场' },
  trial: { view: 'trials', label: '厨神试炼' },
  contest: { view: 'gearContest', label: '厨具大赛' },
  school: { view: 'schools', label: '菜系研究' },
  branch: { view: 'branches', label: '餐厅分店' },
  spirit: { view: 'spiritStories', label: '食灵物语' },
  seasonal: { view: 'seasonReview', label: '赛季回顾' },
}
function jump(kind) {
  const j = KIND_JUMP[kind]
  if (!j) return
  if (j.skill) player.setActiveSkill?.(j.skill)
  ui.setView(j.view)
  ui.pushLog(`📜 年鉴「${kd(kind).label}」相关页面：${j.label}`, 'info')
}
function jumpable(kind) {
  return !!KIND_JUMP[kind]
}

// ── 条目 key 里内嵌的进度值（2026-09-10 补）：如 realm:12 → 第 12 层、arena:5 → 5 连胜 ──
const KEY_PROGRESS = {
  realm: (n) => `第 ${n} 层`,
  tower: (n) => `第 ${n} 层`,
  arena: (n) => `${n} 连胜`,
  prestige: (n) => `第 ${n} 次`,
}
function keyProgress(e) {
  const raw = String(e.key ?? '')
  const idx = raw.indexOf(':')
  if (idx < 0) return null
  const val = raw.slice(idx + 1)
  if (!/^\d+$/.test(val)) return null // 非数字（如 boss 名）不重复展示
  const n = Number(val)
  if (!n) return null
  const fmt = KEY_PROGRESS[e.kind]
  return fmt ? fmt(n) : `#${n}`
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'milestones', label: '🗺 里程碑' }, { view: 'seasonReview', label: '📅 赛季回顾' }, { view: 'honor', label: '🎖 荣誉殿堂' }]
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

    <!-- 总览（2026-09-10 补） -->
    <div class="chron-stats">
      <div class="card chron-stat">
        <div class="chron-stat-num">{{ stats.total }}</div>
        <div class="dim chron-stat-label">累计记录</div>
        <div class="dim chron-stat-sub">跨 {{ stats.activeDays }} 个自然日</div>
      </div>
      <div class="card chron-stat">
        <div class="chron-stat-num">{{ stats.kindsLit }}<span class="dim chron-stat-max">/{{ stats.kindsTotal }}</span></div>
        <div class="dim chron-stat-label">已点亮类别</div>
        <div class="dim chron-stat-sub">每类首次达成即记账</div>
      </div>
      <div class="card chron-stat">
        <div class="chron-stat-num">{{ stats.thisMonth }}</div>
        <div class="dim chron-stat-label">本月新增</div>
        <div class="dim chron-stat-sub">按当前月份统计</div>
      </div>
      <div class="card chron-stat">
        <div class="chron-stat-num chron-stat-day">{{ stats.firstDay ?? '—' }}</div>
        <div class="dim chron-stat-label">最早记录</div>
        <div class="dim chron-stat-sub">最近：{{ stats.lastDay ?? '—' }}</div>
      </div>
    </div>

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
        <button
          class="chron-kind badge chron-kind-btn"
          :class="{ 'chron-kind-link': jumpable(e.kind) }"
          :title="jumpable(e.kind) ? `前往「${KIND_JUMP[e.kind].label}」` : ''"
          :disabled="!jumpable(e.kind)"
          @click="jump(e.kind)"
        >{{ kd(e.kind).label }}</button>
        <span class="chron-text">{{ e.text }}</span>
        <span v-if="keyProgress(e)" class="chron-prog mono">{{ keyProgress(e) }}</span>
        <span class="dim mono chron-time">{{ fmtChronicleTime(e.at).slice(11) }}</span>
      </div>
    </div>
    <RelatedPages :links="RELATED" />
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
/* 总览（2026-09-10 补） */
.chron-stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.chron-stat {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.chron-stat-num {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--accent, #d95a38);
}
.chron-stat-day {
  font-size: 17px;
}
.chron-stat-max {
  font-size: 13px;
  font-weight: 400;
}
.chron-stat-label {
  font-size: 12px;
}
.chron-stat-sub {
  font-size: 11px;
}
/* 类别可跳转（2026-09-10 补） */
.chron-kind-btn {
  cursor: default;
  font: inherit;
  font-size: 11px;
  padding: 1px 7px;
  border: 1px solid var(--border);
  background: var(--bg-soft);
  color: inherit;
}
.chron-kind-btn.chron-kind-link {
  cursor: pointer;
}
.chron-kind-btn.chron-kind-link:hover {
  border-color: var(--accent, #d95a38);
  color: var(--accent, #d95a38);
}
.chron-kind-btn:disabled {
  opacity: 0.9;
}
.chron-prog {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
  white-space: nowrap;
}
</style>
