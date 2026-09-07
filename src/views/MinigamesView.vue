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
const MemoryView = defineAsyncComponent(() => import('./MemoryView.vue'))
const GameShopView = defineAsyncComponent(() => import('./GameShopView.vue'))
const SnakeView = defineAsyncComponent(() => import('./SnakeView.vue'))
const PacmanView = defineAsyncComponent(() => import('./PacmanView.vue'))
const Match3View = defineAsyncComponent(() => import('./Match3View.vue'))

const GAMES = [
  { id: 'shop', emoji: '🛒', name: '商店', comp: GameShopView },
  { id: 'heat', emoji: '🔥', name: '火候炉', comp: HeatView },
  { id: 'trivia', emoji: '📚', name: '讲堂', comp: TriviaView },
  { id: 'kitchen2048', emoji: '🧩', name: '2048', comp: Kitchen2048View },
  { id: 'foodrush', emoji: '🍖', name: '大胃王', comp: FoodRushView },
  { id: 'puzzle', emoji: '🧩', name: '拼图', comp: PuzzleView },
  { id: 'matchfood', emoji: '🀄', name: '连连看', comp: MatchFoodView },
  { id: 'memory', emoji: '🧠', name: '翻牌', comp: MemoryView },
  { id: 'snake', emoji: '🐍', name: '贪吃蛇', comp: SnakeView },
  { id: 'pacman', emoji: '👻', name: '吃豆人', comp: PacmanView },
  { id: 'match3', emoji: '🍬', name: '消消乐', comp: Match3View },
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
