<script setup>
// 小游戏（2026-09-06 全面重构）：顶部入口行 + 下方自然流游戏区（与全站普通页面一致）
// 2026-09-09：商店入口固定在最左；右侧游戏分类分页（每页 9 个，支持 ‹ › 翻页与自动跟随）
import { ref, computed, watch, defineAsyncComponent, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { EventBus } from '../game/core/EventBus.js'

const player = usePlayerStore()

const HeatView = defineAsyncComponent(() => import('./minigames/HeatView.vue'))
const TriviaView = defineAsyncComponent(() => import('./minigames/TriviaView.vue'))
const Kitchen2048View = defineAsyncComponent(() => import('./minigames/Kitchen2048View.vue'))
const FoodRushView = defineAsyncComponent(() => import('./minigames/FoodRushView.vue'))
const PuzzleView = defineAsyncComponent(() => import('./minigames/PuzzleView.vue'))
const MatchFoodView = defineAsyncComponent(() => import('./minigames/MatchFoodView.vue'))
const MemoryView = defineAsyncComponent(() => import('./minigames/MemoryView.vue'))
const GameShopView = defineAsyncComponent(() => import('./minigames/GameShopView.vue'))
const SnakeView = defineAsyncComponent(() => import('./minigames/SnakeView.vue'))
const PacmanView = defineAsyncComponent(() => import('./minigames/PacmanView.vue'))
const Match3View = defineAsyncComponent(() => import('./minigames/Match3View.vue'))
const FlappyBirdView = defineAsyncComponent(() => import('./minigames/FlappyBirdView.vue'))
const Match10View = defineAsyncComponent(() => import('./minigames/Match10View.vue'))
const FruitMergeView = defineAsyncComponent(() => import('./minigames/FruitMergeView.vue'))
const FruitStackView = defineAsyncComponent(() => import('./minigames/FruitStackView.vue'))
const FishingView = defineAsyncComponent(() => import('./minigames/FishingView.vue'))
const SliceView = defineAsyncComponent(() => import('./minigames/SliceView.vue'))
const WhackView = defineAsyncComponent(() => import('./minigames/WhackView.vue'))
const SlideView = defineAsyncComponent(() => import('./minigames/SlideView.vue'))
const PipeView = defineAsyncComponent(() => import('./minigames/PipeView.vue'))
const DinerView = defineAsyncComponent(() => import('./minigames/DinerView.vue'))
const TetrisView = defineAsyncComponent(() => import('./minigames/TetrisView.vue'))
const MinesweeperView = defineAsyncComponent(() => import('./minigames/MinesweeperView.vue'))
const IceSlideView = defineAsyncComponent(() => import('./minigames/IceSlideView.vue'))
const GuessDishView = defineAsyncComponent(() => import('./minigames/GuessDishView.vue'))
const SudokuView = defineAsyncComponent(() => import('./minigames/SudokuView.vue'))
const SequenceView = defineAsyncComponent(() => import('./minigames/SequenceView.vue'))
const CurlingView = defineAsyncComponent(() => import('./minigames/CurlingView.vue'))

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
  { id: 'fruitmerge', emoji: '🍉', name: '水果合成', comp: FruitMergeView },
  { id: 'fruitstack', emoji: '🍇', name: '果了个果', comp: FruitStackView },
  { id: 'fishing', emoji: '🎣', name: '垂钓渔翁', comp: FishingView },
  { id: 'slice', emoji: '🔪', name: '切菜大师', comp: SliceView },
  { id: 'whack', emoji: '🌾', name: '打地鼠', comp: WhackView },
  { id: 'slide', emoji: '🍽️', name: '摆盘', comp: SlideView },
  { id: 'pipe', emoji: '🥣', name: '接汤', comp: PipeView },
  { id: 'diner', emoji: '🍱', name: '传菜', comp: DinerView },
  { id: 'tetris', emoji: '🧱', name: '方块', comp: TetrisView },
  { id: 'mines', emoji: '💣', name: '扫雷', comp: MinesweeperView },
  { id: 'ice', emoji: '🧊', name: '滑冰', comp: IceSlideView },
  { id: 'dish', emoji: '🥢', name: '猜菜名', comp: GuessDishView },
  { id: 'sudoku', emoji: '🔢', name: '调味表', comp: SudokuView },
  { id: 'serve', emoji: '🍽️', name: '上菜顺序', comp: SequenceView },
  { id: 'curling', emoji: '🍡', name: '汤圆冰壶', comp: CurlingView },
]

// 游戏分类分页（每页 9 个；新游戏继续往后排，不会被挤到第二行）
const PAGE_SIZE = 9
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
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'honor', label: '🎖 荣誉殿堂' }, { view: 'log', label: '📖 图鉴/统计' }]

// ── 记录墙（2026-09-12）────────────────────────────────────────
// 数据源：player.minigames.<id>.records（各游戏结算时写入，见 recordMinigame）。
// 未接入统一记录的少数玩法（如火候炉是「一锅一判」、2048 是逐档发奖）回退到它自己的原生字段，
// 两者都没有就显示「还没玩过」。
const NATIVE = {
  heat: { get: (p) => p.minigames?.heat?.bestStreak, unit: '连胜' },
  kitchen2048: { get: (p) => p.minigames?.kitchen2048?.best, unit: '分' },
  puzzle: { get: (p) => p.minigames?.puzzle?.done, unit: '次' },
}
const wallSummary = computed(() => player.minigameWallSummary())
const wallRows = computed(() =>
  GAMES.map((g) => {
    const rec = player.minigames?.[g.id]?.records ?? null
    const native = NATIVE[g.id]
    const nv = native?.get(player)
    const best = rec?.best ?? (typeof nv === 'number' && nv > 0 ? nv : null)
    const unit = rec?.unit || native?.unit || ''
    const plays = rec?.plays ?? 0
    const hasRec = plays > 0 || best != null
    return {
      id: g.id,
      emoji: g.emoji,
      name: g.name,
      hasRec,
      bestText: best == null ? '—' : `${best}${unit}`,
      playsText: plays > 0 ? `${plays} 局` : (best != null ? '最佳记录' : '还没玩过'),
      title: hasRec ? `${g.name}：最好 ${best == null ? '—' : best + unit} · 累计 ${plays} 局` : `${g.name}：还没玩过`,
    }
  })
)
function select(id) {
  active.value = id
}
</script>

<template>
  <div class="mg-shell">
    <!-- 顶部入口行：🛒 商店固定 + 游戏分类分页 + 翻页控件固定最右 -->
    <div class="mg-entrybar">
      <button
        class="mg-entry mg-entry-shop"
        :class="{ 'mg-entry-on': active === SHOP.id }"
        @click="active = SHOP.id"
      >{{ SHOP.emoji }} {{ SHOP.name }}</button>
      <span class="mg-entry-sep"></span>
      <div class="mg-pager">
        <button
          v-for="g in pagedGames"
          :key="g.id"
          class="mg-entry"
          :class="{ 'mg-entry-on': active === g.id }"
          @click="active = g.id"
        >{{ g.emoji }} {{ g.name }}</button>
      </div>
      <div class="mg-pager-ctrl">
        <button class="mg-page-btn" :disabled="pageCount <= 1" @click="turnPage(-1)">‹</button>
        <span class="mg-page-ind mono">{{ page + 1 }}/{{ pageCount }}</span>
        <button class="mg-page-btn" :disabled="pageCount <= 1" @click="turnPage(1)">›</button>
      </div>
    </div>
    <!-- 游戏区域：自然流 -->
    <component :is="activeComp" />

    <!-- 记录墙（2026-09-12 补）：27 款跨游戏汇总——此前只有 6 款把成绩写进存档，其余关掉页面就没了 -->
    <div class="card mg-wall">
      <h3>
        🏆 记录墙
        <span class="dim mg-wall-sum">
          已玩 <b class="mono">{{ wallSummary.games }}</b>/{{ GAMES.length }} 款 · 累计 <b class="mono">{{ wallSummary.plays }}</b> 局
        </span>
      </h3>
      <div class="mg-wall-grid">
        <button
          v-for="row in wallRows"
          :key="row.id"
          class="mg-wall-item"
          :class="{ 'mg-wall-empty': !row.hasRec, 'mg-wall-on': active === row.id }"
          :title="row.title"
          @click="select(row.id)"
        >
          <span class="mg-wall-emoji">{{ row.emoji }}</span>
          <span class="mg-wall-name">{{ row.name }}</span>
          <span class="mg-wall-best mono">{{ row.bestText }}</span>
          <span class="mg-wall-plays dim">{{ row.playsText }}</span>
        </button>
      </div>
      <p class="dim mg-wall-note">
        每款游戏结算时记录最好一局与局数（步数 / 用时类取最小）；「—」表示该玩法没有分数概念，只计局数。
      </p>
    </div>
    <RelatedPages :links="RELATED" />
</div>
</template>
