<script setup>
// 小游戏（2026-09-06 全面重构）：顶部入口行 + 下方自然流游戏区（与全站普通页面一致）
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
  { id: 'heat', emoji: '🔥', name: '火候炉', comp: HeatView },
  { id: 'trivia', emoji: '📚', name: '美食讲堂', comp: TriviaView },
  { id: 'kitchen2048', emoji: '🧩', name: '厨心 2048', comp: Kitchen2048View },
  { id: 'foodrush', emoji: '🍖', name: '大胃王', comp: FoodRushView },
  { id: 'puzzle', emoji: '🧩', name: '美食拼图', comp: PuzzleView },
  { id: 'matchfood', emoji: '🀄', name: '食材连连看', comp: MatchFoodView },
]

const active = ref('heat') // 默认加载第一游戏
const activeComp = computed(() => GAMES.find((g) => g.id === active.value)?.comp ?? null)
</script>

<template>
  <div class="mg-shell">
    <!-- 顶部入口行 -->
    <div class="mg-entrybar">
      <button
        v-for="g in GAMES"
        :key="g.id"
        class="mg-entry"
        :class="{ 'mg-entry-on': active === g.id }"
        @click="active = g.id"
      >{{ g.emoji }} {{ g.name }}</button>
    </div>
    <!-- 游戏区域：自然流 -->
    <component :is="activeComp" />
  </div>
</template>
