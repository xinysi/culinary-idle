<script setup>
// 系统日志（2026-09-11 新增）— 把原先只在右栏显示「最近 8 条」的运行日志做成可检索的独立页。
// 纯读取 ui.log（**会话内**，不入存档）：分类筛选、关键字搜索、复制导出、清空。
import { computed, ref } from 'vue'
import { useUiStore } from '../stores/ui.js'
import RelatedPages from '../components/RelatedPages.vue'

const ui = useUiStore()

const RELATED = [
  { view: 'mail', label: '📬 信箱' },
  { view: 'stats', label: '📊 统计' },
  { view: 'chronicle', label: '📜 年鉴' },
  { view: 'milestones', label: '🗺 里程碑' },
]

// 与 pushLog 的 kind 对应（见 stores/ui.js）
const KINDS = [
  { id: 'all', name: '全部', icon: '🗂' },
  { id: 'info', name: '常规', icon: 'ℹ️' },
  { id: 'gain', name: '获得', icon: '🎁' },
  { id: 'levelup', name: '升级/达成', icon: '⬆️' },
  { id: 'offline', name: '离线', icon: '🌙' },
  { id: 'warn', name: '警告', icon: '⚠️' },
]
const KIND_MAP = Object.fromEntries(KINDS.map((k) => [k.id, k]))
const kindOf = (k) => KIND_MAP[k] ?? { name: k, icon: '•' }

const tab = ref('all')
const keyword = ref('')

const all = computed(() => [...(ui.log ?? [])].reverse()) // 新的在上面
const rows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return all.value.filter((e) => {
    if (tab.value !== 'all' && e.kind !== tab.value) return false
    if (kw && !String(e.message ?? '').toLowerCase().includes(kw)) return false
    return true
  })
})
const countOf = (id) => (id === 'all' ? all.value.length : all.value.filter((e) => e.kind === id).length)

function timeText(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
function dayText(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// 复制当前筛选结果（便于贴给他人排查）
const copied = ref(false)
async function copyVisible() {
  const text = rows.value
    .slice()
    .reverse()
    .map((e) => `[${timeText(e.ts)}] ${e.message}`)
    .join('\n')
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    ui.pushLog(`📋 已复制 ${rows.value.length} 条日志到剪贴板`, 'info')
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    ui.pushLog('复制失败：浏览器未授予剪贴板权限', 'warn')
  }
}
function clearAll() {
  if (!ui.log.length) { ui.pushLog('日志已经是空的', 'warn'); return }
  if (!confirm(`清空全部 ${ui.log.length} 条日志？`)) return
  ui.clearLog()
  ui.pushLog('🗂 日志已清空', 'info')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🗂 系统日志</h2>
        <p class="dim">
          本次会话的运行记录（获得 / 升级 / 离线结算 / 警告等）。右栏只显示最近 8 条，这里可以<b>分类筛选、搜索与复制</b>。
          <b>日志不入存档</b>——刷新页面或重开档会清空，长期记录请看 <b>年鉴</b>。
        </p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">{{ all.length }} 条</div>
        <p class="dim mono">最多保留 500 条</p>
      </div>
    </header>

    <!-- 概览 + 操作 -->
    <div class="card lg-hero">
      <div class="lg-stats">
        <div v-for="k in KINDS.filter((x) => x.id !== 'all')" :key="k.id" class="lg-stat">
          <span class="dim">{{ k.icon }} {{ k.name }}</span>
          <b class="mono">{{ countOf(k.id) }}</b>
        </div>
      </div>
      <div class="lg-actions">
        <button class="btn btn-sm btn-primary" :disabled="!rows.length" @click="copyVisible">
          {{ copied ? '已复制 ✓' : `复制当前 ${rows.length} 条` }}
        </button>
        <button class="btn btn-sm btn-danger" :disabled="!all.length" @click="clearAll">清空日志</button>
      </div>
    </div>

    <!-- 列表 -->
    <div class="card lg-card">
      <div class="lg-filter">
        <button
          v-for="k in KINDS"
          :key="k.id"
          class="btn btn-sm"
          :class="{ 'btn-primary': tab === k.id }"
          @click="tab = k.id"
        >{{ k.icon }} {{ k.name }}（{{ countOf(k.id) }}）</button>
        <input v-model="keyword" class="lg-search" type="text" placeholder="搜索日志内容…" />
        <span class="dim">显示 {{ rows.length }} 条</span>
      </div>

      <div v-if="rows.length" class="lg-list">
        <div v-for="e in rows" :key="e.id" class="lg-row" :class="`lg-${e.kind}`">
          <span class="dim mono lg-time">{{ dayText(e.ts) }} {{ timeText(e.ts) }}</span>
          <span class="lg-kind" :title="kindOf(e.kind).name">{{ kindOf(e.kind).icon }}</span>
          <span class="lg-msg">{{ e.message }}</span>
        </div>
      </div>
      <p v-else class="dim lg-empty">
        {{ all.length ? '没有匹配的日志。' : '本次会话还没有日志。挂机一会儿就会有产出了。' }}
      </p>
    </div>

    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.lg-hero {
  margin-top: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}
.lg-stats {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  flex: 1;
}
.lg-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.lg-stat b {
  font-size: 15px;
}
.lg-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.lg-card {
  margin-top: 12px;
}
.lg-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  margin-bottom: 10px;
}
.lg-search {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-soft);
  color: inherit;
  font-size: 12px;
  min-width: 170px;
}
.lg-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.lg-row {
  display: grid;
  grid-template-columns: 96px 20px 1fr;
  gap: 8px;
  align-items: baseline;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
  line-height: 1.6;
}
.lg-row.lg-warn {
  border-style: solid;
  border-color: rgba(200, 120, 20, 0.45);
}
.lg-row.lg-gain .lg-msg {
  color: var(--good-strong, #2e7d32);
}
.lg-row.lg-levelup .lg-msg {
  font-weight: 600;
}
.lg-time {
  font-size: 11px;
  white-space: nowrap;
}
.lg-kind {
  text-align: center;
}
.lg-msg {
  word-break: break-word;
}
.lg-empty {
  font-size: 12px;
  padding: 6px 0;
}
</style>
