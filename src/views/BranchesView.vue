<script setup>
// 餐厅分店（2026-09-10 新增）— 金币开店 → 每小时自动收入；雇店长 +25%；选主题再叠学派加成（2026-09-10）。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { BRANCHES, BRANCH_UNLOCK_LEVEL, BRANCH_OFFLINE_CAP_HOURS, MANAGER_BONUS } from '../game/data/branches.js'
import { BRANCH_THEMES, getBranchTheme, THEME_BONUS_PER_LEVEL } from '../game/data/branchThemes.js'
import { SCHOOLS } from '../game/data/schools.js'

const player = usePlayerStore()
const ui = useUiStore()

const unlocked = computed(() => player.branchUnlocked())
const rows = computed(() =>
  BRANCHES.map((def) => {
    const st = player.branches?.[def.id] ?? null
    const opened = !!st
    const themeId = player.branchThemeOf(def.id)
    const theme = getBranchTheme(themeId)
    return {
      def,
      opened,
      manager: !!st?.manager,
      themeId,
      theme,
      themeMult: opened ? player.branchThemeMult(def.id) : 1,
      hourly: opened ? player.branchHourlyOf(def.id) : def.goldPerHour,
      total: opened ? Math.floor(((Date.now() - (st.lastAt ?? Date.now())) / 3600_000)) : 0,
    }
  })
)
const openCount = computed(() => rows.value.filter((r) => r.opened).length)
const totalHourly = computed(() => rows.value.reduce((a, r) => a + (r.opened ? r.hourly : 0), 0))
const totalGold = computed(() => player.stats?.branchGold ?? 0)
const themedCount = computed(() => rows.value.filter((r) => r.theme).length)

// 主题选择面板（一次只展开一家分店）
const themeFor = ref(null)
function toggleTheme(id) {
  themeFor.value = themeFor.value === id ? null : id
}
function schoolName(id) {
  return SCHOOLS.find((s) => s.id === id)?.name ?? id
}
function schoolLv(id) {
  return player.schoolState(id)?.level ?? 0
}
function pickTheme(branchId, themeId) {
  const r = player.setBranchTheme(branchId, themeId)
  if (!r.ok) ui.pushLog(r.msg, 'warn')
  else themeFor.value = null
}

function open(def) {
  const r = player.branchOpen(def.id)
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function hire(def) {
  const r = player.branchHireManager(def.id)
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🏬 餐厅分店</h2>
        <p class="dim">
          在主店之外开设分店：每家分店<b>每小时自动入账</b>（随餐厅等级 ×(1+10%/级)），雇一位店长再 <b>+{{ Math.round(MANAGER_BONUS * 100) }}%</b>；
          还能给分店定个<b>主题</b>，与该主题对应学派联动——学派每级 <b>+{{ THEME_BONUS_PER_LEVEL }}%</b> 时收；
          离线照常结算（单次最多补 {{ BRANCH_OFFLINE_CAP_HOURS }} 小时）。
        </p>
      </div>
    </header>

    <div v-if="!unlocked" class="card status-line">
      <span class="badge">🔒 未解锁</span>
      <span class="dim">需餐厅 Lv{{ BRANCH_UNLOCK_LEVEL }} 解锁分店</span>
    </div>

    <template v-else>
      <div class="card status-line">
        <span class="badge badge-on">已开业 {{ openCount }} / {{ BRANCHES.length }}</span>
        <span class="badge">🏮 已定主题 {{ themedCount }}</span>
        <span class="dim">合计时收 <b class="mono">{{ totalHourly.toLocaleString() }}</b> 金币/小时 · 累计入账 <b class="mono">{{ totalGold.toLocaleString() }}</b></span>
      </div>

      <div class="branch-grid">
        <div v-for="r in rows" :key="r.def.id" class="card branch-card" :class="{ locked: !r.opened }">
          <div class="branch-head">
            <span class="branch-icon">{{ r.def.icon }}</span>
            <div>
              <strong>{{ r.def.name }}</strong>
              <div class="dim branch-sub">
                开店 {{ r.def.cost.toLocaleString() }} 金币 · 基础 {{ r.def.goldPerHour.toLocaleString() }}/时
              </div>
            </div>
          </div>

          <template v-if="!r.opened">
            <button class="btn btn-sm btn-primary" @click="open(r.def)">开设分店（{{ r.def.cost.toLocaleString() }}）</button>
          </template>

          <template v-else>
            <div class="branch-row">
              <span class="dim">当前时收</span>
              <span class="mono">{{ r.hourly.toLocaleString() }} 金币/时</span>
            </div>
            <div class="dim branch-sub">
              店长：<template v-if="r.manager">已雇佣（+{{ Math.round(MANAGER_BONUS * 100) }}%）</template><template v-else>未雇佣</template>
            </div>
            <button v-if="!r.manager" class="btn btn-sm" @click="hire(r.def)">雇店长（{{ r.def.managerCost.toLocaleString() }}）</button>
            <div v-else class="dim branch-sub">✅ 收入已含店长加成</div>

            <!-- 主题（2026-09-10）：定/换主题，与菜系研究联动加成 -->
            <div class="branch-theme">
              <div class="branch-row">
                <span class="dim">经营主题</span>
                <span v-if="r.theme" class="mono">
                  {{ r.theme.icon }} {{ r.theme.name }} <span class="up">×{{ r.themeMult.toFixed(2) }}</span>
                </span>
                <span v-else class="dim">未定主题</span>
              </div>
              <button class="btn btn-sm" @click="toggleTheme(r.def.id)">
                {{ r.theme ? '更换主题' : '定主题' }}
              </button>

              <div v-if="themeFor === r.def.id" class="theme-panel">
                <button
                  v-for="t in BRANCH_THEMES"
                  :key="t.id"
                  class="theme-opt"
                  :class="{ active: r.themeId === t.id }"
                  :title="t.desc"
                  @click="pickTheme(r.def.id, t.id)"
                >
                  <span class="theme-icon">{{ t.icon }}</span>
                  <span class="theme-name">{{ t.name }}</span>
                  <span class="theme-meta dim">
                    {{ schoolName(t.school) }} Lv{{ schoolLv(t.school) }} ×{{ (1 + (THEME_BONUS_PER_LEVEL * schoolLv(t.school)) / 100).toFixed(2) }}
                  </span>
                  <span class="theme-cost mono">{{ t.cost.toLocaleString() }}</span>
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.branch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.branch-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.branch-card.locked {
  opacity: 0.85;
}
.branch-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.branch-icon {
  font-size: 24px;
}
.branch-sub {
  font-size: 12px;
  line-height: 1.5;
}
.branch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}
.branch-theme {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px dashed var(--border);
  padding-top: 8px;
}
.theme-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}
.theme-opt {
  display: grid;
  grid-template-columns: 20px 1fr auto auto;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  border-radius: 6px;
  border: 1px dashed var(--border);
  background: var(--bg-soft);
  color: inherit;
}
.theme-opt.active {
  border-style: solid;
  border-color: var(--accent, #d95a38);
  color: var(--accent, #d95a38);
}
.theme-meta {
  font-size: 11px;
}
.theme-cost {
  font-size: 11px;
  opacity: 0.85;
}
.up {
  color: var(--good, #5aa469);
}
</style>
