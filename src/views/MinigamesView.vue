<script setup>
// 小游戏大厅 + 选项卡框架（2026-09-06）：顶部固定 tab 框，点游戏即在下方加载（SPA 式），随时切换
import { ref, computed, defineAsyncComponent } from 'vue'
import { usePlayerStore } from '../stores/player.js'

const player = usePlayerStore()

const HeatView = defineAsyncComponent(() => import('./HeatView.vue'))
const TriviaView = defineAsyncComponent(() => import('./TriviaView.vue'))
const Kitchen2048View = defineAsyncComponent(() => import('./Kitchen2048View.vue'))
const FoodRushView = defineAsyncComponent(() => import('./FoodRushView.vue'))
const PuzzleView = defineAsyncComponent(() => import('./PuzzleView.vue'))
const MatchFoodView = defineAsyncComponent(() => import('./MatchFoodView.vue'))

const GAMES = [
  { id: 'heat', emoji: '🔥', name: '火候炉', comp: HeatView, desc: '定火挑战：指针停黄金区，每 5 连完美 +50 金。', record: () => `最佳 ${player.minigames?.heat?.bestStreak ?? 0} 连击` },
  { id: 'trivia', emoji: '📚', name: '美食讲堂', comp: TriviaView, desc: '每周 10 题竞答（答案实时取游戏数据），≥8 题得徽章 +100 金。', record: () => `徽章 ${player.minigames?.trivia?.badges ?? 0} 枚` },
  { id: 'kitchen2048', emoji: '🧩', name: '厨心 2048', comp: Kitchen2048View, desc: '4×4 / 3×3 滑动合并，跨档即时 +20 金。', record: () => `最佳 4×4：${player.minigames?.kitchen2048?.best ?? 0} · 3×3：${player.minigames?.kitchen2048?.best3 ?? 0}` },
  { id: 'foodrush', emoji: '🍖', name: '大胃王', comp: FoodRushView, desc: '60 秒连点干饭，10 连击触发暴食×2，档位奖励 40-100 金。', record: () => `最佳 ${player.minigames?.foodrush?.best ?? 0} 碗` },
  { id: 'puzzle', emoji: '🧩', name: '每日美食拼图', comp: PuzzleView, desc: '4×4 华容道复原美食图，完成得能量饼干（每日 1 次）。', record: () => `累计完成 ${player.minigames?.puzzle?.done ?? 0} 天` },
  { id: 'matchfood', emoji: '🀄', name: '食材连连看', comp: MatchFoodView, desc: '6×6 配对消除，全清得「满汉全席」buff（经验+20% 1 小时）。', record: () => `buff 天数 ${player.minigames?.matchfood?.buffed ?? 0}` },
]

const active = ref(null) // null = 大厅概览
const activeComp = computed(() => GAMES.find((g) => g.id === active.value)?.comp ?? null)
function open(id) {
  active.value = active.value === id ? null : id // 再点一次收起回大厅
}
const current = computed(() => GAMES.find((g) => g.id === active.value) ?? null)
</script>

<template>
  <div class="mg-shell">
    <!-- 顶部固定选项卡框：点哪个游戏就在下方加载 -->
    <div class="card mg-tabs">
      <button class="btn btn-sm mg-tab" :class="{ 'btn-primary': active === null }" @click="active = null">🏠 大厅</button>
      <button
        v-for="g in GAMES"
        :key="g.id"
        class="btn btn-sm mg-tab"
        :class="{ 'btn-primary': active === g.id }"
        @click="open(g.id)"
      >{{ g.emoji }} {{ g.name }}</button>
    </div>

    <!-- 活动区：概览或所选游戏 -->
    <template v-if="activeComp">
      <div class="mg-subhead dim">
        <button class="btn btn-sm" @click="active = null">← 回到大厅</button>
        <span style="margin-left: 8px">{{ current?.emoji }} {{ current?.name }}</span>
      </div>
      <component :is="activeComp" />
    </template>

    <template v-else>
      <header class="skill-head">
        <div>
          <h2>🎮 小游戏</h2>
          <p class="dim">六款美食主题小游戏——练手、涨知识、赚金币/饼干/buff，记录永久保留。点击上方选项卡即可开始。</p>
        </div>
      </header>
      <div class="minigame-grid">
        <div
          v-for="g in GAMES"
          :key="g.id"
          class="minigame-card"
          @click="active = g.id"
        >
          <div class="minigame-emoji">{{ g.emoji }}</div>
          <div class="minigame-name">{{ g.name }}</div>
          <div class="minigame-desc">{{ g.desc }}</div>
          <div class="minigame-record dim mono">🏆 {{ g.record() }}</div>
        </div>
      </div>
    </template>
  </div>
</template>
