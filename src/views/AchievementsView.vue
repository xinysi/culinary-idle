<script setup>
// 成就与称号（2026-09-11 新增）— 把原先挤在「图鉴 → 成就 / 称号」两个标签里的内容独立成页：
// 成就可按大类筛选、看进度条与奖励；称号按三个来源分组，可直接佩戴/取消佩戴。
// 纯读取 + 两个既有写入（player.title 佩戴称号），不改动任何成就或称号数据（数据铁律）。
import { computed, ref, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { ALL_ACHIEVEMENTS } from '../game/data/achievements.js'
import { ACHIEVEMENT_TITLES, SHOP_TITLES, CODEX_SHOP_TITLES } from '../game/data/titles.js'
import { achievementProgress, achievementNeed } from '../game/data/achievementProgress.js'
import { getItem } from '../game/data/items.js'
import ProgressBar from '../components/ProgressBar.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'quests', label: '📋 任务中心' },
  { view: 'log', label: '📖 图鉴' },
  { view: 'honor', label: '🎖 荣誉殿堂' },
  { view: 'milestones', label: '🗺 里程碑' },
]

const TABS = [
  { id: 'ach', name: '🏅 成就' },
  { id: 'title', name: '🏷 称号' },
]
const tab = ref('ach')

const unlockedIds = computed(() => new Set(player.achievements ?? []))
const PAGE_STEP = 60
const limit = ref(PAGE_STEP)
const category = ref('全部')
const onlyUndone = ref(false)
const keyword = ref('')

const CATEGORIES = computed(() => {
  const seen = []
  for (const a of ALL_ACHIEVEMENTS) if (a.category && !seen.includes(a.category)) seen.push(a.category)
  return ['全部', ...seen]
})
const catCount = computed(() => {
  const m = {}
  for (const a of ALL_ACHIEVEMENTS) m[a.category] = (m[a.category] ?? 0) + 1
  return m
})

const rows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return ALL_ACHIEVEMENTS.map((a) => ({
    a,
    unlocked: unlockedIds.value.has(a.id),
    prog: achievementProgress(player, a),
    need: achievementNeed(a),
  }))
    .filter((r) => {
      if (category.value !== '全部' && r.a.category !== category.value) return false
      if (onlyUndone.value && r.unlocked) return false
      if (kw && !(`${r.a.name}${r.a.desc}`.toLowerCase().includes(kw))) return false
      return true
    })
})
const visible = computed(() => rows.value.slice(0, limit.value))
// 条件一改就回到第一屏，避免"筛完只剩 3 条却还停在原来的显示更多位置"
watch([category, onlyUndone, keyword], () => { limit.value = PAGE_STEP })

function rewardText(reward) {
  const parts = []
  if (reward?.gold) parts.push(`${reward.gold} 金币`)
  if (reward?.items) for (const [id, q] of Object.entries(reward.items)) parts.push(`${getItem(id)?.name ?? id} ×${q}`)
  if (reward?.title) parts.push(`称号「${reward.title}」`)
  return parts.join('、') || '—'
}
function pickCategory(c) {
  category.value = c
}

// ── 称号（只读展示）──
// 2026-09-11：佩戴/取消佩戴**只保留在「荣誉殿堂」一个入口**。此前两页都能改 player.title，
// 状态虽同一份却让人不知道该去哪；称号的被动与荣誉等级本来就在荣誉殿堂，故由它独占。
const TITLE_HOME = 'honor'
function goEquipTitle() {
  ui.setView(TITLE_HOME)
}
const ownedShopTitles = computed(() => SHOP_TITLES.filter((t) => player.shopOwned?.[t.key]).length)
const ownedCodexTitles = computed(() => CODEX_SHOP_TITLES.filter((t) => (player.codexOwned ?? []).includes(t.key)).length)
const ownedAchTitles = computed(() => ACHIEVEMENT_TITLES.filter((t) => unlockedIds.value.has(t.id)).length)
const totalTitles = computed(() => ACHIEVEMENT_TITLES.length + SHOP_TITLES.length + CODEX_SHOP_TITLES.length)
const ownedTitles = computed(() => ownedAchTitles.value + ownedShopTitles.value + ownedCodexTitles.value)

// 成就完成度
const completion = computed(() => (unlockedIds.value.size / ALL_ACHIEVEMENTS.length) * 100)
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🏅 成就与称号</h2>
        <p class="dim">
          成就解锁后自动发放奖励；部分成就附带<b>称号</b>，可在此佩戴（展示在左侧栏与主界面名字旁）。
          称号共三个来源：成就解锁、<b>游戏商店</b>购买、<b>图鉴兑换所</b>兑换。
        </p>
      </div>
    </header>

    <div class="card av-hero">
      <div class="av-stat"><span class="dim">成就</span><b class="mono">{{ unlockedIds.size }}/{{ ALL_ACHIEVEMENTS.length }}</b></div>
      <div class="av-stat"><span class="dim">完成度</span><b class="mono">{{ completion.toFixed(1) }}%</b></div>
      <div class="av-stat"><span class="dim">称号</span><b class="mono">{{ ownedTitles }}/{{ totalTitles }}</b></div>
      <div class="av-stat"><span class="dim">当前佩戴</span><b class="mono">{{ player.title || '（无）' }}</b></div>
      <button class="btn btn-sm" title="佩戴/取消佩戴在荣誉殿堂" @click="goEquipTitle">去荣誉殿堂佩戴 ↗</button>
    </div>

    <div class="av-tabs">
      <button v-for="t in TABS" :key="t.id" class="btn btn-sm" :class="{ 'btn-primary': tab === t.id }" @click="tab = t.id">
        {{ t.name }}
      </button>
    </div>

    <!-- ① 成就 -->
    <template v-if="tab === 'ach'">
      <div class="card av-card">
        <div class="av-filter">
          <button
            v-for="c in CATEGORIES"
            :key="c"
            class="btn btn-sm"
            :class="{ 'btn-primary': category === c }"
            @click="pickCategory(c)"
          >{{ c }}（{{ c === '全部' ? ALL_ACHIEVEMENTS.length : catCount[c] ?? 0 }}）</button>
          <label class="av-check"><input v-model="onlyUndone" type="checkbox" /> 只看未完成</label>
          <input v-model="keyword" class="av-search" type="text" placeholder="搜索成就…" />
          <span class="dim">共 {{ rows.length }} 项</span>
        </div>

        <div class="av-grid">
          <div v-for="r in visible" :key="r.a.id" class="av-ach" :class="{ locked: !r.unlocked }">
            <div class="av-ach-head">
              <span class="av-mark">{{ r.unlocked ? '✔' : '○' }}</span>
              <div class="av-ach-title">
                <strong>{{ r.a.name }}</strong>
                <div class="dim av-ach-cat">{{ r.a.category }} · {{ r.a.desc }}</div>
              </div>
            </div>
            <div class="av-ach-foot">
              <span class="dim">奖励：{{ rewardText(r.a.reward) }}</span>
              <span v-if="r.a.title" class="badge">🏷 {{ r.a.title }}</span>
            </div>
            <template v-if="!r.unlocked && r.prog">
              <div class="av-ach-prog">
                <ProgressBar :progress="r.prog.pct / 100" />
                <span class="mono dim">{{ r.prog.cur }}/{{ r.need ?? r.prog.need }}</span>
              </div>
            </template>
          </div>
        </div>
        <p v-if="!rows.length" class="dim">没有匹配的成就。</p>
        <button v-if="rows.length > limit" class="btn btn-sm av-more" @click="limit += PAGE_STEP">
          显示更多（还有 {{ rows.length - limit }} 项）
        </button>
      </div>
    </template>

    <!-- ② 称号 -->
    <template v-else>
      <div class="card av-card">
        <div class="av-h">🏅 成就称号（{{ ownedAchTitles }}/{{ ACHIEVEMENT_TITLES.length }}）</div>
        <p class="dim av-desc">完成对应成就后解锁。<b>佩戴与取消佩戴统一在「荣誉殿堂」</b>（那里同时显示该称号的被动加成与荣誉等级）。</p>
        <div class="av-grid">
          <div
            v-for="t in ACHIEVEMENT_TITLES"
            :key="t.id"
            class="av-title"
            :class="{ locked: !unlockedIds.has(t.id), equipped: player.title === t.name }"
          >
            <div class="av-title-name">
              <strong>{{ t.name }}</strong>
              <span v-if="player.title === t.name" class="badge badge-on">佩戴中</span>
            </div>
            <div class="dim av-title-desc">来自成就「{{ t.achName }}」</div>
          </div>
        </div>
      </div>

      <div class="card av-card">
        <div class="av-h">🛒 商店称号（{{ ownedShopTitles }}/{{ SHOP_TITLES.length }}）</div>
        <p class="dim av-desc">在<b>小游戏 → 游戏商店</b>用游戏币购买。</p>
        <div class="av-grid">
          <div
            v-for="t in SHOP_TITLES"
            :key="t.key"
            class="av-title"
            :class="{ locked: !player.shopOwned?.[t.key], equipped: player.title === t.name }"
          >
            <div class="av-title-name">
              <strong>{{ t.icon }} {{ t.name }}</strong>
              <span v-if="player.title === t.name" class="badge badge-on">佩戴中</span>
            </div>
            <div class="dim av-title-desc">{{ player.shopOwned?.[t.key] ? '已拥有' : `未拥有 · 游戏币 ${t.price.toLocaleString()}` }}</div>
          </div>
        </div>
      </div>

      <div class="card av-card">
        <div class="av-h">📖 图鉴兑换称号（{{ ownedCodexTitles }}/{{ CODEX_SHOP_TITLES.length }}）</div>
        <p class="dim av-desc">在<b>图鉴兑换所</b>兑换获得。</p>
        <div class="av-grid">
          <div
            v-for="t in CODEX_SHOP_TITLES"
            :key="t.key"
            class="av-title"
            :class="{ locked: !(player.codexOwned ?? []).includes(t.key), equipped: player.title === t.name }"
          >
            <div class="av-title-name">
              <strong>{{ t.name }}</strong>
              <span v-if="player.title === t.name" class="badge badge-on">佩戴中</span>
            </div>
            <div class="dim av-title-desc">{{ (player.codexOwned ?? []).includes(t.key) ? '已拥有' : (t.desc || '未拥有 · 图鉴兑换所兑换') }}</div>
          </div>
        </div>
        <p v-if="!CODEX_SHOP_TITLES.length" class="dim">暂无图鉴兑换称号。</p>
      </div>
    </template>

    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.av-hero {
  margin-top: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
}
.av-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.av-stat b {
  font-size: 16px;
}
.av-tabs {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.av-card {
  margin-top: 12px;
}
.av-h {
  font-weight: 600;
}
.av-desc {
  font-size: 12px;
  margin: 4px 0 0;
}
.av-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}
.av-check {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.av-search {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-soft);
  color: inherit;
  font-size: 12px;
  min-width: 140px;
}
.av-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 8px;
  margin-top: 10px;
}
.av-ach,
.av-title {
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
  font-size: 13px;
}
.av-ach.locked,
.av-title.locked {
  opacity: 0.62;
}
.av-title.equipped {
  border-style: solid;
  border-color: var(--accent, #d95a38);
}
.av-ach-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.av-mark {
  color: var(--good-strong, #2e7d32);
  font-size: 14px;
}
.av-ach.locked .av-mark {
  color: var(--muted);
}
.av-ach-title {
  flex: 1;
  min-width: 0;
}
.av-ach-cat {
  font-size: 12px;
  line-height: 1.5;
}
.av-title-name {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.av-title-desc {
  font-size: 12px;
  margin-top: 3px;
}
.av-ach-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  font-size: 12px;
  flex-wrap: wrap;
}
.av-ach-prog {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.av-ach-prog :deep(.progress-wrap),
.av-ach-prog > *:first-child {
  flex: 1;
}
.av-more {
  margin-top: 10px;
}
</style>
