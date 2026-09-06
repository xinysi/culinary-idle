<script setup>
// 小游戏大厅（2026-09-06）：上方超级大舞台框（默认欢迎/点选后加载游戏）+ 下方游戏入口
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
  { id: 'trivia', emoji: '📚', name: '美食讲堂', comp: TriviaView, desc: '每周 10 题竞答，≥8 题得徽章 +100 金。', record: () => `徽章 ${player.minigames?.trivia?.badges ?? 0} 枚` },
  { id: 'kitchen2048', emoji: '🧩', name: '厨心 2048', comp: Kitchen2048View, desc: '滑动合并，跨档即时 +20 金。', record: () => `最佳 4×4：${player.minigames?.kitchen2048?.best ?? 0} · 3×3：${player.minigames?.kitchen2048?.best3 ?? 0}` },
  { id: 'foodrush', emoji: '🍖', name: '大胃王', comp: FoodRushView, desc: '60 秒连点，暴食×2，档位奖励 40-100 金。', record: () => `最佳 ${player.minigames?.foodrush?.best ?? 0} 碗` },
  { id: 'puzzle', emoji: '🧩', name: '每日美食拼图', comp: PuzzleView, desc: '4×4 华容道复原美食图，完成得能量饼干。', record: () => `累计完成 ${player.minigames?.puzzle?.done ?? 0} 天` },
  { id: 'matchfood', emoji: '🀄', name: '食材连连看', comp: MatchFoodView, desc: '6×6 配对消除，全清得经验 buff。', record: () => `buff 天数 ${player.minigames?.matchfood?.buffed ?? 0}` },
]

const active = ref(null) // null = 大框默认欢迎态
const activeComp = computed(() => GAMES.find((g) => g.id === active.value)?.comp ?? null)
const current = computed(() => GAMES.find((g) => g.id === active.value) ?? null)
</script>

<template>
  <div class="mg-frame mg-shell">
    <!-- 上方：超级大舞台框（默认欢迎 / 点入口后加载对应游戏） -->
    <div class="mg-stage">
      <template v-if="activeComp">
        <button class="btn btn-sm mg-stage-close" @click="active = null">✕ 关闭（回大厅）</button>
        <component :is="activeComp" />
      </template>
      <template v-else>
        <div class="mg-welcome">
          <div class="mg-welcome-emoji">🎮</div>
          <h2>小游戏大厅</h2>
          <p class="dim">下方六款美食主题小游戏——点击任意一款，即在上方大舞台中加载。练手、涨知识、赚金币/饼干/buff。</p>
          <div class="mg-welcome-hints">
            <span v-for="g in GAMES" :key="g.id" class="dim mono">🏆 {{ g.record() }}</span>
          </div>
        </div>
      </template>
    </div>

    <!-- 下方：小游戏入口 -->
    <div class="mg-entry-grid">
      <button
        v-for="g in GAMES"
        :key="g.id"
        class="mg-entry"
        :class="{ 'mg-entry-on': active === g.id }"
        @click="active = active === g.id ? null : g.id"
      >
        <span class="mg-entry-emoji">{{ g.emoji }}</span>
        <span class="mg-entry-name">{{ g.name }}</span>
        <span class="mg-entry-desc">{{ g.desc }}</span>
        <span class="mg-entry-record dim mono">🏆 {{ g.record() }}</span>
      </button>
    </div>
  </div>
</template>
