<script setup>
// 小游戏（2026-09-06 全面重构）：顶部入口行 + 下方自然流游戏区（与全站普通页面一致）
// 2026-09-09：商店入口固定在最左；右侧游戏分类分页（每页 6 个，支持 ‹ › 翻页与自动跟随）
import { ref, computed, watch, defineAsyncComponent, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { EventBus } from '../game/core/EventBus.js'

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
const FlappyBirdView = defineAsyncComponent(() => import('./FlappyBirdView.vue'))
const Match10View = defineAsyncComponent(() => import('./Match10View.vue'))

// 商店固定入口（2026-09-09：商店不参与分页，固定在入口行最左）
const SHOP = { id: 'shop', emoji: '🛒', name: '商店', comp: GameShopView }
const GAMES = [
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
  { id: 'flappy', emoji: '🐦', name: '笨鸟先飞', comp: FlappyBirdView },
  { id: 'match10', emoji: '🧮', name: '凑凑消', comp: Match10View },
]

// 游戏分类分页（每页 6 个；新游戏继续往后排，不会被挤到第二行）
const PAGE_SIZE = 6
const page = ref(0)
const pageCount = computed(() => Math.max(1, Math.ceil(GAMES.length / PAGE_SIZE)))
const pagedGames = computed(() => GAMES.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE))
function turnPage(delta) {
  page.value = (page.value + delta + pageCount.value) % pageCount.value
}

const active = ref('heat') // 默认加载第一游戏
const activeComp = computed(() => {
  if (active.value === SHOP.id) return SHOP.comp
  return GAMES.find((g) => g.id === active.value)?.comp ?? null
})
// 切换游戏时自动翻到其所在页（含「退出」回默认游戏）
watch(active, (id) => {
  const idx = GAMES.findIndex((g) => g.id === id)
  if (idx >= 0) page.value = Math.floor(idx / PAGE_SIZE)
})
// 小游戏「🚪 退出」→ 回到大厅默认游戏
function onBack() { active.value = 'heat' }
onMounted(() => EventBus.on('mg:back', onBack))
onUnmounted(() => EventBus.off('mg:back', onBack))
</script>

<template>
  <div class="mg-shell">
    <!-- 顶部入口行：🛒 商店固定 + 游戏分类分页 -->
    <div class="mg-entrybar">
      <button
        class="mg-entry mg-entry-shop"
        :class="{ 'mg-entry-on': active === SHOP.id }"
        @click="active = SHOP.id"
      >{{ SHOP.emoji }} {{ SHOP.name }}</button>
      <span class="mg-entry-sep"></span>
      <div class="mg-pager">
        <button class="mg-page-btn" :disabled="pageCount <= 1" @click="turnPage(-1)">‹</button>
        <button
          v-for="g in pagedGames"
          :key="g.id"
          class="mg-entry"
          :class="{ 'mg-entry-on': active === g.id }"
          @click="active = g.id"
        >{{ g.emoji }} {{ g.name }}</button>
        <button class="mg-page-btn" :disabled="pageCount <= 1" @click="turnPage(1)">›</button>
        <span class="mg-page-ind mono">{{ page + 1 }}/{{ pageCount }}</span>
      </div>
    </div>
    <!-- 游戏区域：自然流 -->
    <component :is="activeComp" />
  </div>
</template>
