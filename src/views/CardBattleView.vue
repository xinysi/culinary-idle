<script setup>
// 卡牌对战（2026-09-12 从「图鉴」页抽出为独立页）— 收集品卡牌化 + 3v3 自动对战（三档难度）。
// 抽出原因：它是个完整小游戏（与从对决页抽出的「食神秘境」同性质），却挤在「图鉴」的标签里。
// 纯读取 + 复用既有 cardBattle.js（不改任何卡牌数值）；样式全部复用全局类。
import { computed, ref, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem, itemName } from '../game/data/items.js'
import { CATEGORY_LABEL } from '../game/data/itemDetail.js'
import { itemImage } from '../game/data/itemImage.js'
import {
  cardPoolFrom,
  cardColor as cardColorFor,
  cardStrength as cardStrengthOf,
  simulateBattle,
  settleBattle,
  DIFFICULTIES,
} from '../game/data/cardBattle.js'
import ProgressBar from '../components/ProgressBar.vue'
import Pagination from '../components/Pagination.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'log', label: '📖 图鉴' },
  { view: 'achievements', label: '🏅 成就与称号' },
  { view: 'stats', label: '📊 统计' },
  { view: 'minigames', label: '🎮 小游戏' },
]

/** 卡池每页张数（原为 LogView 的 PAGE.cards） */
const CARD_PAGE = 13

// ── 以下逻辑与模板自 LogView 原样搬来（2026-09-12）──
const selectedCards = ref([])
const battleResult = ref(null)
const cardDiff = ref('normal') // 难度：休闲/标准/挑战（AI 战力与奖励倍率）
const battleReward = ref(null) // 结算明细 { reward, dailyBonus, firstBonus }
const cardPool = computed(() => cardPoolFrom(player.collected))
// 卡池管理（2026-09-06）：搜索 + 类型筛选 + 分页，防止卡牌过多时全量渲染
const cardQuery = ref('')
const cardCat = ref('all')
const cardPage = ref(1)
const filteredPool = computed(() => {
  const q = cardQuery.value.trim().toLowerCase()
  return cardPool.value.filter((id) => {
    const it = getItem(id)
    if (cardCat.value === 'food' && it?.type !== 'food') return false
    if (cardCat.value === 'equipment' && it?.type !== 'equipment') return false
    if (q && !(it?.name ?? '').toLowerCase().includes(q)) return false
    return true
  })
})
const cardPages = computed(() => Math.max(1, Math.ceil(filteredPool.value.length / CARD_PAGE)))
const pagedCards = computed(() => {
  const p = Math.min(cardPage.value, cardPages.value)
  const arr = filteredPool.value.slice((p - 1) * CARD_PAGE, p * CARD_PAGE)
  while (arr.length < CARD_PAGE) arr.push({ _pad: true })
  return arr
})
watch([cardQuery, cardCat], () => { cardPage.value = 1 })
/** 一键最强：自动选择当前筛选结果中战力前 3 */
function pickBest() {
  selectedCards.value = filteredPool.value.slice(0, 3)
}
function cardColor(id) { return cardColorFor(id) }
function cardStrengthText(id) { return Math.round(cardStrengthOf(id)) }
function toggleCard(id) {
  const i = selectedCards.value.indexOf(id)
  if (i >= 0) selectedCards.value.splice(i, 1)
  else if (selectedCards.value.length < 3) selectedCards.value.push(id)
}
function clearSelection() { selectedCards.value = [] }
function doCardBattle() {
  if (!selectedCards.value.length) return
  const result = simulateBattle(selectedCards.value, player.collected, { difficulty: cardDiff.value })
  battleReward.value = settleBattle(player, result, cardDiff.value)
  battleResult.value = result
  selectedCards.value = []
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🎴 卡牌对战</h2>
        <p class="dim">
          把收集到的物品做成卡牌，选 3 张上阵打一场 3v3 自动对战（三档难度，AI 战力与奖励倍率不同）。
          每日首胜有额外奖励；胜负都记进战绩，可随时换卡再战。卡面颜色与战力取自物品自身品质与数值，<b>不改动任何物品数据</b>。
        </p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">{{ player.stats?.cardBattle?.wins ?? 0 }} 胜 / {{ player.stats?.cardBattle?.losses ?? 0 }} 负</div>
        <p class="dim mono">卡池 {{ cardPool.length }} 张</p>
      </div>
    </header>

    <div class="card">
      <div class="card-battle-head">
        <h3 style="margin: 0">🂡 卡牌对战</h3>
        <span class="dim">卡池 {{ cardPool.length }} 张 · 已选 <b class="mono cb-count">{{ selectedCards.length }}</b>/3 · 战绩 {{ player.stats.cardBattle?.wins ?? 0 }}胜 {{ player.stats.cardBattle?.losses ?? 0 }}负</span>
        <button v-if="selectedCards.length" class="btn btn-sm" @click="clearSelection">清空选卡</button>
      </div>
      <p class="dim" style="margin: 4px 0 8px">从已收集的料理/装备中<span style="color: var(--primary-strong); font-weight: 700">点选 3 张</span>组成卡组，与 AI 同池对决（3 局 2 胜制）：每局战力 ±12% 浮动；胜得金币（按难度倍率），每日首胜额外 +50，首次胜场额外 +能量饼干。</p>
      <div class="region-tabs" style="flex-wrap: wrap; margin-bottom: 8px">
        <span class="dim" style="align-self: center">难度：</span>
        <button
          v-for="(d, key) in DIFFICULTIES"
          :key="key"
          class="btn btn-sm"
          :class="{ 'btn-primary': cardDiff === key }"
          @click="cardDiff = key"
        >{{ d.label }}（AI ×{{ d.aiMult }} · 奖励 ×{{ d.rewardMult }}）</button>
      </div>
      <div class="cb-filter-bar">
        <input v-model="cardQuery" class="cb-filter-input" type="text" placeholder="🔍 搜索卡牌名称…" />
        <button class="btn btn-sm" :class="{ 'btn-primary': cardCat === 'all' }" @click="cardCat = 'all'">全部</button>
        <button class="btn btn-sm" :class="{ 'btn-primary': cardCat === 'food' }" @click="cardCat = 'food'">🍽 料理</button>
        <button class="btn btn-sm" :class="{ 'btn-primary': cardCat === 'equipment' }" @click="cardCat = 'equipment'">⚒ 装备</button>
        <span class="dim mono" style="margin-left: auto">{{ filteredPool.length }} 张</span>
        <button class="btn btn-sm" title="自动选择战力最高的前 3 张" :disabled="!filteredPool.length" @click="pickBest">✨ 一键最强</button>
      </div>
      <div class="card-grid">
        <div
          v-for="(id, ii) in pagedCards"
          :key="id?.id ?? 'pad-' + ii"
          v-if="!id?._pad"
          class="item-card cb-card"
          :style="{ borderColor: cardColor(id) }"
          :class="{ selected: selectedCards.includes(id) }"
          @click="toggleCard(id)"
        >
          <div class="cb-badges">
            <span class="cb-type">{{ getItem(id)?.type === 'food' ? '🍽 料理' : '⚒ 装备' }}</span>
            <span class="cb-power">⚔ {{ cardStrengthText(id) }}</span>
          </div>
          <img v-if="itemImage(id)" :src="itemImage(id)" class="item-img item-card-img" @error="$event.target.style.display = 'none'" alt="" />
          <div class="item-card-name">{{ getItem(id)?.name }}</div>
          <div class="dim">{{ CATEGORY_LABEL[getItem(id)?.category] ?? getItem(id)?.category ?? '' }}</div>
          <div class="mono dim">T{{ getItem(id)?.tier }}</div>
        </div>
        <p v-if="!cardPool.length" class="dim" style="grid-column: 1 / -1">还没有收集到料理/装备，去制作或获得吧。</p>
        <p v-else-if="!filteredPool.length" class="dim" style="grid-column: 1 / -1">没有符合搜索/筛选的卡牌。</p>
      </div>
      <div style="display: flex; justify-content: center; margin-top: 8px">
        <Pagination v-if="cardPages > 1" :current="Math.min(cardPage, cardPages)" :pages="cardPages" @update:current="(p) => (cardPage = p)" />
      </div>
      <div class="card cb-battle-panel">
        <div class="cb-battle-head">
          <button class="btn btn-sm btn-primary" :disabled="!selectedCards.length" @click="doCardBattle">⚔️ 开始对战</button>
          <span class="dim">当前卡组战力合计 <b class="mono">{{ selectedCards.reduce((a, id) => a + cardStrengthOf(id), 0).toFixed(0) }}</b></span>
        </div>
        <div v-if="battleResult" class="battle-result" :class="{ win: battleResult.won, lose: !battleResult.won }">
          <div class="cb-result-title">
            <template v-if="battleResult.won">
              🏆 卡牌对决胜利！+{{ battleReward?.reward ?? 50 }} 金币
              <span v-if="battleReward?.dailyBonus" class="cb-daily-bonus">+ 每日首胜 +{{ battleReward.dailyBonus }}</span>
              <span v-if="battleReward?.firstBonus" class="cb-first-bonus">🎁 首胜能量饼干 ×1</span>
            </template>
            <template v-else>💀 卡牌对决失败，换几张卡试试</template>
          </div>
          <div class="cb-rounds">
            <div v-for="(r, i) in battleResult.rounds" :key="i" class="cb-round" :class="{ win: r.win, lose: !r.win }">
              <span class="cb-round-idx">第 {{ i + 1 }} 局</span>
              <span class="cb-round-cards">
                {{ r.mine ? itemName(r.mine) : '—' }}（<b class="mono">{{ Math.round(r.ms) }}</b>）
                <span class="dim">vs</span>
                {{ r.theirs ? itemName(r.theirs) : '—' }}（<b class="mono">{{ Math.round(r.ts) }}</b>）
              </span>
              <span class="cb-round-verdict">{{ r.win ? '✅ 胜' : '❌ 负' }}</span>
            </div>
          </div>
        </div>
        <p v-else class="dim" style="margin: 8px 0 0">选好卡组后点击「开始对战」。</p>
      </div>
    </div>

    <RelatedPages :links="RELATED" />
  </div>
</template>
