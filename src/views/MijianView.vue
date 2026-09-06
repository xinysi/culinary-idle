<script setup>
// 觅珍抽卡 — 材料/食物/厨具三池（2026-09-06）
// 金币消费；价值加权随机；厨具池 10 抽保底「稀有及以上」
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { MIJIAN_POOLS, GEAR_PITY } from '../game/data/mijianDraws.js'
import { getItem } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

const activePool = ref('material')
const pool = computed(() => MIJIAN_POOLS.find((p) => p.id === activePool.value))
const results = ref([]) // 最近一次抽卡结果 [{id, rare}]
const isGearPool = computed(() => activePool.value === 'gear')
const pity = computed(() => player.mijianPity())

function draw(count) {
  const r = player.drawMijian(activePool.value, count)
  if (!r) return
  if (!r.ok) { ui.pushLog(`🎴 觅珍：${r.msg}`, 'warn'); return }
  results.value = r.results
    .filter(Boolean)
    .map((it) => {
      const rare = it.type === 'equipment' && ['稀有', '史诗', '传说', '神话'].includes(it.quality)
      return { id: it.id, rare }
    })
  ui.pushLog(`🎴 觅珍：${pool.value.name} ×${count}，获得 ${r.got.length} 件${r.boosted ? '（保底命中 ⭐）' : ''}`, 'gain')
}

const QUALITY_TEXT = { 普通: '普通', 精良: '精良', 稀有: '稀有', 史诗: '史诗', 传说: '传说', 神话: '神话' }
function rarityClass(id) {
  const q = getItem(id)?.quality
  return q ? `rarity-${QUALITY_TEXT[q]}` : ''
}
</script>

<template>
  <div class="combat-view">
    <header class="skill-head">
      <div>
        <h2>🎴 觅珍</h2>
        <p class="dim">三种卡池 · 金币抽取 · 价值加权随机；厨具池每 10 抽保底稀有及以上（稀有度按装备品质）</p>
      </div>
      <div class="skill-head-right">
        <div class="season-pts-card">
          <span class="dim">已抽</span>
          <strong class="mono">{{ player.mijian?.stats?.pulls ?? 0 }}</strong>
          <span class="dim">次 · 累计花费 {{ (player.mijian?.stats?.spent ?? 0).toLocaleString() }} 金</span>
        </div>
      </div>
    </header>

    <!-- 池子选择 -->
    <div class="card">
      <div class="region-tabs">
        <button
          v-for="p in MIJIAN_POOLS"
          :key="p.id"
          class="btn btn-sm"
          :class="{ 'btn-primary': activePool === p.id }"
          @click="activePool = p.id"
        >{{ p.icon }} {{ p.name }}（{{ p.price }} 金/抽）</button>
      </div>
      <p class="dim">{{ pool.desc }}</p>
      <template v-if="isGearPool">
        <p class="dim">⭐ 保底进度：{{ pity.current }}/{{ pity.need }}（{{ pity.need - pity.current }} 抽内必出稀有及以上）</p>
      </template>
    </div>

    <!-- 操作与结果 -->
    <div class="card">
      <div class="region-tabs">
        <button class="btn btn-sm btn-primary" :disabled="player.gold < pool.price" @click="draw(1)">🎴 单抽（{{ pool.price }} 金）</button>
        <button class="btn btn-sm btn-primary" :disabled="player.gold < pool.price * 10" @click="draw(10)">🎴🎴 十连（{{ pool.price * 10 }} 金）</button>
        <span class="dim" style="margin-left: auto">持有金币 <span class="mono">{{ player.gold.toLocaleString() }}</span></span>
      </div>

      <div v-if="results.length" class="mijian-results">
        <div
          v-for="(r, i) in results"
          :key="r.id + '-' + i"
          class="mijian-card"
          :class="[rarityClass(r.id), { dazzle: r.rare }]"
          :style="{ animationDelay: (i * 0.05) + 's' }"
        >
          <img v-if="itemImage(r.id)" :src="itemImage(r.id)" class="item-img" @error="$event.target.style.display = 'none'" alt="" />
          <div class="mijian-name">{{ getItem(r.id)?.name }}</div>
          <div class="dim mono" style="font-size: 11px">
            {{ getItem(r.id)?.type === 'equipment' ? (getItem(r.id)?.quality ?? '') : 'T' + (getItem(r.id)?.tier ?? '') }}
          </div>
        </div>
      </div>
      <p v-else class="dim" style="margin-top: 8px">点击「单抽」或「十连」开始觅珍——结果直接进背包。</p>
    </div>
  </div>
</template>

<style scoped>
.mijian-results { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
.mijian-card {
  width: 108px; padding: 10px 8px; text-align: center;
  background: rgba(255, 251, 244, 0.92);
  border: 1px solid rgba(150, 110, 70, 0.28);
  border-radius: 10px;
  animation: mijianIn 0.4s ease-out both;
}
.mijian-card .item-img { width: 44px; height: 44px; object-fit: contain; margin: 0 auto; display: block; }
.mijian-name { font-size: 12px; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mijian-card.rarity-稀有 { border-color: #3b8bb8; }
.mijian-card.rarity-史诗 { border-color: #7b1fa2; }
.mijian-card.rarity-传说 { border-color: #bf7200; }
.mijian-card.rarity-神话 { border-color: #b23a2f; }
.mijian-card.dazzle { box-shadow: 0 0 12px rgba(224, 112, 74, 0.55); }
.mijian-card.rarity-神话 { background: linear-gradient(160deg, rgba(255, 236, 200, 0.95), rgba(255, 214, 160, 0.9)); }
@keyframes mijianIn {
  from { opacity: 0; transform: translateY(8px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
:global([data-theme='dark']) .mijian-card { background: rgba(44, 31, 22, 0.95); color: #f2e6d7; }
</style>
