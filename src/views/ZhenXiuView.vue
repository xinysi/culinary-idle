<script setup>
// 珍馐阁 — 高级杂货：按分类售卖所有非装备/非食灵物品（食材/料理/饮品/调料/种子/道具）
// 售价 = 物品价值 × 2.2（出售价 = 价值 ×0.5 → 买卖循环亏损 77%，防止金币刷取）
// 装备与食灵契约不售（保持锻造/召唤玩法价值）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { ITEMS, getItem } from '../game/data/items.js'
import { CATEGORY_LABEL } from '../game/data/itemDetail.js'
import { itemImage } from '../game/data/itemImage.js'
import QuantityModal from '../components/QuantityModal.vue'
import Pagination from '../components/Pagination.vue'

const player = usePlayerStore()
const ui = useUiStore()
const cat = ref('ingredient') // 默认选中第一个具体分类（「全部」已隐藏，避免默认展示全部）
const q = ref('')
const buyTarget = ref(null) // { id, price }
// 分页：每行 6 个 × 每页 4 行 = 24 个
const PAGE_SIZE = 24
const page = ref(1)

const TYPE_LABEL = { ingredient: '食材', food: '料理', drink: '饮品', spice: '调料', seed: '种子', consumable: '道具', equipment: '装备', spirit: '食灵' }
const TYPE_TABS = [
  { id: 'all', name: '全部' },
  { id: 'ingredient', name: '食材' },
  { id: 'food', name: '料理' },
  { id: 'drink', name: '饮品' },
  { id: 'spice', name: '调料' },
  { id: 'seed', name: '种子' },
  { id: 'consumable', name: '道具' },
]

/** 珍馐阁售价：价值 × 2.2（向下取整到 5 的倍数，价格更整洁）*/
function price(id) {
  const it = getItem(id)
  const base = Math.ceil((it?.value ?? 0) * 2.2)
  return Math.max(1, Math.ceil(base / 5) * 5)
}

// 卡片动态样式：是否可负担（金币不足 → locked 置灰）
function canAfford(id) {
  return player.gold >= price(id)
}

const goods = computed(() =>
  Object.entries(ITEMS)
    .filter(([, it]) => it && it.type !== 'equipment' && it.type !== 'spirit')
    .filter(([, it]) => cat.value === 'all' || it.type === cat.value)
    .filter(([id, it]) => !q.value.trim() || it.name.includes(q.value.trim()) || id.includes(q.value.trim().toLowerCase()))
    .sort((a, b) => (getItem(b[0])?.tier ?? 0) - (getItem(a[0])?.tier ?? 0) || (getItem(b[0])?.value ?? 0) - (getItem(a[0])?.value ?? 0))
)
const pages = computed(() => Math.max(1, Math.ceil(goods.value.length / PAGE_SIZE)))
const goodsPaged = computed(() => {
  const p = Math.min(page.value, pages.value)
  const arr = goods.value.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE)
  while (arr.length < PAGE_SIZE) arr.push([undefined, undefined]);
  return arr
})

function count(tabId) {
  if (tabId === 'all') return Object.values(ITEMS).filter((it) => it && it.type !== 'equipment' && it.type !== 'spirit').length
  return Object.values(ITEMS).filter((it) => it && it.type === tabId).length
}

function qualityColor(quality) {
  const map = { 普通: 'var(--muted)', 精良: 'var(--good)', 稀有: 'var(--info)', 史诗: '#9c27b0', 传说: '#ff9800', 神话: '#e91e63' }
  return map[quality] ?? 'var(--muted)'
}

function openBuy(id) {
  const p = price(id)
  if (player.gold < p) return
  buyTarget.value = { id, price: p, max: Math.max(1, Math.floor(player.gold / p)) }
}
function confirmBuy(n) {
  const t = buyTarget.value
  if (!t) return
  for (let i = 0; i < n; i++) {
    if (!player.spendGold(t.price)) break
    player.gainItem(t.id, 1)
  }
  ui.pushLog(`🛍️ 珍馐阁购买 ${getItem(t.id)?.name} ×${n}（${t.price * n} 金币）`, 'info')
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'shop', label: '🛒 商店' }, { view: 'alchemy', label: '🧪 炼金' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🍽️ 珍馐阁</h2>
        <p class="dim">高级杂货：按分类选购食材/料理/饮品/调料/种子/道具（售价 = 价值×2.2；装备与食灵契约需自制）</p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">金币 <span class="mono">{{ player.gold.toLocaleString() }}</span></div>
      </div>
    </header>

    <div class="card">
      <!-- 分类 tab（隐藏「全部」，其余保留） -->
      <div class="region-tabs" style="flex-wrap: wrap">
        <template v-for="t in TYPE_TABS" :key="t.id">
          <button v-if="t.id !== 'all'" class="btn btn-sm" :class="{ 'btn-primary': cat === t.id }" @click="cat = t.id">
            {{ t.name }}（{{ count(t.id) }}）
          </button>
        </template>
        <input v-model="q" class="plot-select" style="margin-left: auto; width: 170px" placeholder="🔍 搜索物品" />
      </div>
      <div class="gather-grid grid-n-6">
        <template v-for="([id, it], ei) in goodsPaged" :key="id ?? 'pad-' + ei">
          <div v-if="id" v-tilt class="gather-card shop-card" :class="{ locked: !canAfford(id), affordable: canAfford(id) }">
          <div class="gather-card-head">
            <img v-if="itemImage(id)" :src="itemImage(id)" class="item-img item-img-sm" @error="$event.target.style.display = 'none'" alt="" />
            <strong>{{ it.name }}</strong>
          </div>
          <div class="gather-card-row">
            <span class="dim">{{ TYPE_LABEL[it.type] ?? CATEGORY_LABEL[it.category] ?? it.category }}</span>
            <span v-if="it.quality" class="dim" :style="{ color: qualityColor(it.quality) }">{{ it.quality }}</span>
          </div>
          <div class="gather-card-row"><span>档位</span><span class="mono">T{{ it.tier }}</span></div>
          <div class="gather-card-row"><span>售价</span><span class="mono">{{ price(id) }} 金币</span></div>
          <div class="gather-card-row"><span>持有</span><span class="mono">{{ player.inventory[id] ?? 0 }}</span></div>
          <button class="btn btn-sm btn-primary" :disabled="player.gold < price(id)" @click="openBuy(id)">购买</button>
          </div>
          <div v-else class="pager-spacer"></div>
        </template>
        <p v-if="!goods.length" class="dim" style="grid-column: 1 / -1">没有匹配的物品</p>
      </div>
      <Pagination :current="Math.min(page, pages)" :pages="pages" @update:current="(p) => page = p" />
    </div>

    <!-- 购买数量选择弹窗 -->
    <QuantityModal
      :show="!!buyTarget"
      :title="buyTarget ? `购买 ${getItem(buyTarget.id)?.name}` : ''"
      :max="buyTarget?.max ?? 1"
      :price-each="buyTarget?.price ?? 0"
      @close="buyTarget = null"
      @confirm="confirmBuy"
    />
    <RelatedPages :links="RELATED" />
</div>
</template>
