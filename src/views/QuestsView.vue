<script setup>
// 任务中心（2026-09-11 新增）— 把原先全挤在「图鉴 → 任务」一个标签里的四套任务拆成独立页：
// 主线 / 每日 / 周常 / 每周挑战，各自带进度与领取入口。
// 纯读取 + 调用既有 store 方法（claimDailyTask / claimWeekly / claimChallenge），不改动任何任务数据。
import { computed, onMounted, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { QUESTS, questObjectiveKey } from '../game/data/quests.js'
import { getItem } from '../game/data/items.js'
import ProgressBar from '../components/ProgressBar.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'achievements', label: '🏅 成就与称号' },
  { view: 'season', label: '🎪 赛季' },
  { view: 'milestones', label: '🗺 里程碑' },
  { view: 'log', label: '📖 图鉴' },
]

const TABS = [
  { id: 'main', name: '📜 主线' },
  { id: 'daily', name: '📅 每日' },
  { id: 'weekly', name: '🏆 周常' },
  { id: 'challenge', name: '⚔️ 每周挑战' },
]
const tab = ref('main')

onMounted(() => {
  player.ensureDailyTasks()
  player.ensureWeeklyTask()
  player.challengeDef() // 触发 ensureWeeklyChallenge
})

function itemName(id) {
  return getItem(id)?.name ?? id
}
function goldOf(base) {
  return Math.floor(base * (1 + (player.combatLevel ?? 1) * 0.3))
}

// ── 主线 ──
const currentQuest = computed(() => player.currentQuest)
const QUEST_INDEX = new Map(QUESTS.map((q, i) => [q.id, i]))
const mainDone = computed(() => player.quests.completed.length)

function questState(q) {
  const done = player.quests.completed.includes(q.id)
  const current = currentQuest.value?.id === q.id
  const idx = QUEST_INDEX.get(q.id) ?? 0
  const prevDone = idx === 0 || player.quests.completed.includes(QUESTS[idx - 1].id)
  return { done, current, locked: !done && !current && !prevDone }
}
function questProgress(q) {
  return q.objectives.map((obj) => {
    const key = questObjectiveKey(obj)
    const cur = player.quests.progress[key] ?? 0
    return { obj, cur, key, done: cur >= obj.qty, pct: Math.min(1, cur / obj.qty) }
  })
}
function objLabel(obj) {
  switch (obj.kind) {
    case 'gather': return `获得 ${itemName(obj.param)}`
    case 'craft': return `制作 ${itemName(obj.param)}`
    case 'harvest': return `收获 ${itemName(obj.param)}`
    case 'combatWin': return '赢得对决'
    case 'boss': return `击败 首领「${obj.param}」`
    case 'explore': return '探索成功'
    case 'skillLevel30': {
      const lv = obj.param === 'any' ? 30 : (Number(obj.param) || 30)
      return `${obj.qty > 1 ? obj.qty + ' 个技能' : '技能'}达到 ${lv} 级`
    }
    case 'gold': return `累计金币 ${obj.qty}`
    case 'collection': return `图鉴收集 ${obj.qty}%`
    case 'seasons': return `赛季领奖 ${obj.qty} 季`
    case 'card': return `卡牌对战胜利 ${obj.qty} 场`
    case 'arena': return `竞技场 ${obj.qty} 连胜`
    case 'restaurant': return `餐厅达到 ${obj.qty} 级`
    case 'gear': return `装备图鉴 ${obj.qty} 件`
    case 'upgrades': return `强化装备 ${obj.qty} 件`
    case 'prestiges': return `转生 ${obj.qty} 次`
    case 'guild': return '加入一个公会'
    default: return obj.kind
  }
}
function rewardText(reward) {
  const parts = []
  if (reward?.gold) parts.push(`${reward.gold} 金币`)
  if (reward?.items) for (const [id, q] of Object.entries(reward.items)) parts.push(`${itemName(id)} ×${q}`)
  return parts.join('、') || '—'
}

// 主线列表：默认只渲染前 30 条，避免一次渲染 500 张卡片
const mainLimit = ref(30)
const mainOnlyUndone = ref(true)
const mainRows = computed(() => {
  const rows = QUESTS.map((q) => ({ q, ...questState(q) }))
  const list = mainOnlyUndone.value ? rows.filter((r) => !r.done) : rows
  return list
})
const mainVisible = computed(() => mainRows.value.slice(0, mainLimit.value))

// ── 每日 ──
const dailyClaimed = computed(() => (player.daily.tasks ?? []).filter((t) => t.claimed).length)
const dailyReady = computed(() => (player.daily.tasks ?? []).filter((t) => !t.claimed && t.progress >= t.qty).length)
function claimDaily(i) {
  const r = player.claimDailyTask(i)
  if (!r) { ui.pushLog('该任务还不能领取', 'warn'); return }
  ui.pushLog(`📅 每日任务领取 +${r.gold.toLocaleString()} 金币`, 'gain')
}

// ── 周常 ──
const weeklyReady = computed(() => player.weekly.task && !player.weekly.claimed && player.weekly.progress >= player.weekly.task.qty)
function claimWeekly() {
  const r = player.claimWeekly()
  if (!r) { ui.pushLog('周常还不能领取', 'warn'); return }
  ui.pushLog(`🏆 周常领取 +${r.gold.toLocaleString()} 金币`, 'gain')
}

// ── 每周挑战 ──
const challengeDef = computed(() => player.challengeDef())
const challengeBest = computed(() => {
  const d = challengeDef.value
  return d ? (player.challengeBest?.[d.id] ?? 0) : 0
})
const challengeReady = computed(() => {
  const d = challengeDef.value
  return !!d && !player.challenge.done && player.challenge.progress >= d.target
})
function claimChallenge() {
  const r = player.claimChallenge()
  if (!r) { ui.pushLog('每周挑战还不能领取', 'warn'); return }
  ui.pushLog(`⚔️ 每周挑战达成 +${r.gold.toLocaleString()} 金币`, 'levelup')
}

// ── 概览 ──
const weeklyDone = computed(() => player.weekly.claimed)
const challengeDone = computed(() => player.challenge.done)
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📋 任务中心</h2>
        <p class="dim">
          四套任务汇在一页：<b>主线</b>（线性推进解锁）、<b>每日</b>（当天刷新、全清送礼包）、
          <b>周常</b>（产量型周目标）、<b>每周挑战</b>（难度型周目标）。主线达成后自动结算，无需手动领取。
        </p>
      </div>
    </header>

    <!-- 概览 -->
    <div class="card qv-hero">
      <div class="qv-stat"><span class="dim">主线进度</span><b class="mono">{{ mainDone }}/{{ QUESTS.length }}</b></div>
      <div class="qv-stat"><span class="dim">每日已领</span><b class="mono">{{ dailyClaimed }}/{{ player.daily.tasks?.length ?? 0 }}</b></div>
      <div class="qv-stat"><span class="dim">连续天数</span><b class="mono">🔥 {{ player.daily.streak ?? 0 }}</b></div>
      <div class="qv-stat"><span class="dim">周常</span><b class="mono">{{ weeklyDone ? '已领取' : weeklyReady ? '可领取' : '进行中' }}</b></div>
      <div class="qv-stat"><span class="dim">每周挑战</span><b class="mono">{{ challengeDone ? '已领取' : challengeReady ? '可领取' : '进行中' }}</b></div>
      <div v-if="dailyReady" class="qv-stat"><span class="dim">每日待领</span><b class="mono qv-hot">{{ dailyReady }} 项</b></div>
    </div>

    <!-- 页签 -->
    <div class="qv-tabs">
      <button v-for="t in TABS" :key="t.id" class="btn btn-sm" :class="{ 'btn-primary': tab === t.id }" @click="tab = t.id">
        {{ t.name }}
      </button>
    </div>

    <!-- ① 主线 -->
    <template v-if="tab === 'main'">
      <div v-if="currentQuest" class="card qv-card">
        <div class="qv-h">🎯 当前任务：{{ currentQuest.name }}</div>
        <p class="dim qv-desc">{{ currentQuest.desc }}</p>
        <div class="qv-objs">
          <div v-for="o in questProgress(currentQuest)" :key="o.key" class="qv-obj">
            <div class="qv-obj-top">
              <span>{{ o.done ? '✅' : '⬜' }} {{ objLabel(o.obj) }}</span>
              <span class="mono dim">{{ Math.min(o.cur, o.obj.qty) }}/{{ o.obj.qty }}</span>
            </div>
            <ProgressBar :progress="o.pct" />
          </div>
        </div>
        <div class="dim qv-sub">奖励：{{ rewardText(currentQuest.reward) }}</div>
      </div>
      <div v-else class="card qv-card">
        <div class="qv-h">🎉 主线已全部完成</div>
        <p class="dim qv-desc">你已走完全部 {{ QUESTS.length }} 条主线任务。</p>
      </div>

      <div class="card qv-card">
        <div class="qv-filter">
          <label class="qv-check"><input v-model="mainOnlyUndone" type="checkbox" /> 只看未完成</label>
          <span class="dim">共 {{ mainRows.length }} 条</span>
          <span v-if="mainRows.length > mainLimit" class="dim">（显示前 {{ mainLimit }} 条）</span>
        </div>
        <div class="qv-list">
          <div
            v-for="r in mainVisible"
            :key="r.q.id"
            class="qv-quest"
            :class="{ done: r.done, current: r.current, locked: r.locked }"
          >
            <div class="qv-quest-head">
              <span class="qv-quest-name">{{ r.q.name }}</span>
              <span v-if="r.done" class="badge badge-on">已完成</span>
              <span v-else-if="r.current" class="badge badge-on">进行中</span>
              <span v-else-if="r.locked" class="badge">未解锁</span>
              <span class="dim qv-quest-reward">{{ rewardText(r.q.reward) }}</span>
            </div>
            <div class="dim qv-quest-desc">{{ r.q.desc }}</div>
          </div>
        </div>
        <button v-if="mainRows.length > mainLimit" class="btn btn-sm qv-more" @click="mainLimit += 30">
          显示更多（还有 {{ mainRows.length - mainLimit }} 条）
        </button>
      </div>
    </template>

    <!-- ② 每日 -->
    <template v-else-if="tab === 'daily'">
      <div class="card qv-card">
        <div class="qv-h">
          📅 今日任务
          <span v-if="player.daily.streak > 1" class="badge badge-on">🔥 连续 {{ player.daily.streak }} 天</span>
        </div>
        <p class="dim qv-desc">每天刷新；全部领完额外发放<b>每日礼包</b>（金币 + 能量饼干）。连续完成会累积天数。</p>
        <div class="qv-grid">
          <div v-for="(t, i) in player.daily.tasks" :key="t.name + i" class="qv-daily" :class="{ done: t.claimed, ready: !t.claimed && t.progress >= t.qty }">
            <div class="qv-obj-top">
              <span>{{ t.name }}</span>
              <span class="mono dim">{{ t.progress }}/{{ t.qty }}</span>
            </div>
            <ProgressBar :progress="Math.min(1, (t.progress ?? 0) / t.qty)" />
            <div class="qv-daily-foot">
              <span class="dim">+{{ goldOf(t.gold).toLocaleString() }} 金币</span>
              <button
                class="btn btn-sm"
                :class="{ 'btn-primary': !t.claimed && t.progress >= t.qty }"
                :disabled="t.claimed || t.progress < t.qty"
                @click="claimDaily(i)"
              >{{ t.claimed ? '已领取' : t.progress >= t.qty ? '领取' : '进行中' }}</button>
            </div>
          </div>
          <p v-if="!player.daily.tasks?.length" class="dim">今日任务尚未生成。</p>
        </div>
        <div v-if="player.daily.claimedAll" class="qv-daily-bonus">🎁 每日礼包已发放——明天再来！</div>
      </div>
    </template>

    <!-- ③ 周常 -->
    <template v-else-if="tab === 'weekly'">
      <div class="card qv-card">
        <div class="qv-h">🏆 本周任务</div>
        <template v-if="player.weekly.task">
          <div class="qv-weekly" :class="{ done: player.weekly.claimed, ready: weeklyReady }">
            <div class="qv-obj-top">
              <span>{{ player.weekly.task.name }}</span>
              <span class="mono dim">{{ player.weekly.progress }}/{{ player.weekly.task.qty }}</span>
            </div>
            <ProgressBar :progress="Math.min(1, player.weekly.progress / player.weekly.task.qty)" />
            <div class="qv-daily-foot">
              <span class="dim">+{{ goldOf(player.weekly.task.gold).toLocaleString() }} 金币<template v-for="(q, id) in player.weekly.task.items" :key="id"> · {{ itemName(id) }} ×{{ q }}</template></span>
              <button class="btn btn-sm" :class="{ 'btn-primary': weeklyReady }" :disabled="player.weekly.claimed || !weeklyReady" @click="claimWeekly">
                {{ player.weekly.claimed ? '已领取' : weeklyReady ? '领取' : '进行中' }}
              </button>
            </div>
          </div>
        </template>
        <p v-else class="dim">本周任务尚未生成。</p>
      </div>
    </template>

    <!-- ④ 每周挑战 -->
    <template v-else>
      <div class="card qv-card">
        <div class="qv-h">⚔️ 本周挑战</div>
        <template v-if="challengeDef">
          <div class="qv-weekly" :class="{ done: player.challenge.done, ready: challengeReady }">
            <div class="qv-obj-top">
              <span>{{ challengeDef.name }}</span>
              <span class="mono dim">{{ player.challenge.progress }}/{{ challengeDef.target }}</span>
            </div>
            <div class="dim qv-desc">{{ challengeDef.desc }}</div>
            <ProgressBar :progress="Math.min(1, player.challenge.progress / challengeDef.target)" />
            <div class="qv-daily-foot">
              <span class="dim">
                +{{ challengeDef.gold.toLocaleString() }} 金币<template v-for="(q, id) in challengeDef.items" :key="id"> · {{ itemName(id) }} ×{{ q }}</template>
                <template v-if="challengeBest"> · 历史最佳 {{ challengeBest }}</template>
              </span>
              <button class="btn btn-sm" :class="{ 'btn-primary': challengeReady }" :disabled="player.challenge.done || !challengeReady" @click="claimChallenge">
                {{ player.challenge.done ? '已领取' : challengeReady ? '领取' : '进行中' }}
              </button>
            </div>
          </div>
        </template>
        <p v-else class="dim">本周挑战尚未生成。</p>
      </div>
    </template>

    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.qv-hero {
  margin-top: 12px;
  padding: 12px 16px;
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
}
.qv-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.qv-stat b {
  font-size: 16px;
}
.qv-hot {
  color: var(--accent, #d95a38);
}
.qv-tabs {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.qv-card {
  margin-top: 12px;
}
.qv-h {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.qv-desc {
  font-size: 12px;
  line-height: 1.6;
  margin: 4px 0 0;
}
.qv-sub {
  font-size: 12px;
  margin-top: 8px;
}
.qv-objs {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 8px;
}
.qv-obj-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}
.qv-filter {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
}
.qv-check {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.qv-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 8px;
}
.qv-quest {
  padding: 6px 9px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.qv-quest.done {
  opacity: 0.62;
}
.qv-quest.current {
  border-style: solid;
  border-color: var(--accent, #d95a38);
}
.qv-quest.locked {
  opacity: 0.5;
}
.qv-quest-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  flex-wrap: wrap;
}
.qv-quest-name {
  font-weight: 600;
}
.qv-quest-reward {
  margin-left: auto;
  font-size: 12px;
}
.qv-quest-desc {
  font-size: 12px;
  margin-top: 2px;
}
.qv-more {
  margin-top: 8px;
}
.qv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 8px;
  margin-top: 8px;
}
.qv-daily,
.qv-weekly {
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.qv-weekly {
  margin-top: 8px;
}
.qv-daily.done,
.qv-weekly.done {
  opacity: 0.62;
}
.qv-daily.ready,
.qv-weekly.ready {
  border-style: solid;
  border-color: var(--accent, #d95a38);
}
.qv-daily-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  font-size: 12px;
  flex-wrap: wrap;
}
.qv-daily-bonus {
  margin-top: 10px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--warn-soft, rgba(200, 150, 20, 0.16));
  color: var(--warn-strong, #a8780b);
}
</style>
