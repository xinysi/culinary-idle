<script setup>
// 杂货铺 — 需求文档 §11.3：购买弹药/种子/容量扩展 + 出售背包物品（价值×0.5）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { SHOP_ITEMS, shopItemName } from '../game/data/shop.js'
import { getItem } from '../game/data/items.js'
import { CATEGORY_LABEL } from '../game/data/itemDetail.js'
import { itemImage } from '../game/data/itemImage.js'
import QuantityModal from '../components/QuantityModal.vue'
import Pagination from '../components/Pagination.vue'

const player = usePlayerStore()
const ui = useUiStore()
const tab = ref('buy')
const cat = ref('ammo') // 默认选中第一个具体分类（「全部」已隐藏，避免默认展示全部）
const q = ref('')
// 分页：每行 6 个 × 每页 4 行 = 24 个
const PAGE_SIZE = 24
const buyPage = ref(1)
const sellPage = ref(1)

// 商店分类（珍馐阁式 type tab）：种子量大，按类别分组 + 名称搜索
const SHOP_TABS = [
  { id: 'all', name: '全部' },
  { id: 'ammo', name: '弹药/原料' },
  { id: 'fertilizer', name: '肥料' },
  { id: 'seed', name: '种子' },
  { id: 'expansion', name: '容量扩展' },
]
function shopCat(entry) {
  if (entry.action) return 'expansion'
  const t = getItem(entry.itemId)?.type
  if (t === 'seed') return 'seed'
  if (entry.itemId === 'compost' || entry.itemId === 'richCompost') return 'fertilizer'
  return 'ammo'
}
const buyList = computed(() =>
  SHOP_ITEMS.filter((s) => cat.value === 'all' || shopCat(s) === cat.value)
    .filter((s) => !q.value.trim() || (getItem(s.itemId)?.name ?? '').includes(q.value.trim()) || (s.itemId ?? '').includes(q.value.trim().toLowerCase()))
)
function buyListCount(tabId) {
  if (tabId === 'all') return SHOP_ITEMS.length
  return SHOP_ITEMS.filter((s) => shopCat(s) === tabId).length
}
// 分页切片与页数（补满到 PAGE_SIZE，避免最后页不满导致底部翻页按钮跳动）
const buyPages = computed(() => Math.max(1, Math.ceil(buyList.value.length / PAGE_SIZE)))
const buyListPaged = computed(() => {
  const p = Math.min(buyPage.value, buyPages.value)
  const arr = buyList.value.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE)
  while (arr.length < PAGE_SIZE) arr.push({ _pad: true })
  return arr
})

// 卡片动态样式：是否可负担/可购买（买不起或容量已满 → locked 置灰）
function canAffordBuy(entry) {
  if (player.gold < entry.price) return false
  if (entry.action === 'inventorySlot' && player.inventoryCap >= 100) return false
  if (entry.action === 'bankSlot' && player.bankCap >= 500) return false
  return true
}

// 数量选择弹窗状态
const qtyTarget = ref(null) // { kind: 'buy'|'sell', entry?, id?, price }
function openBuyQty(entry) {
  if (entry.action) return buy(entry) // 容量扩展直接执行
  qtyTarget.value = { kind: 'buy', entry, price: entry.price, max: Math.max(1, Math.floor(player.gold / entry.price)) }
}
function openSellQty(id, price) {
  qtyTarget.value = { kind: 'sell', id, price, max: player.inventory[id] ?? 0 }
}
function confirmQty(n) {
  const t = qtyTarget.value
  if (!t) return
  if (t.kind === 'buy') {
    for (let i = 0; i < n; i++) {
      if (!player.spendGold(t.entry.price)) break
      player.gainItem(t.entry.itemId, 1)
    }
    ui.pushLog(`购买了 ${shopItemName(t.entry.itemId)} ×${n}（-${t.entry.price * n} 金币）`, 'info')
  } else {
    if (player.sellItem(t.id, n)) ui.pushLog(`出售 ${getItem(t.id)?.name} ×${n}（+${t.price * n} 金币）`, 'info')
  }
}

function buy(entry) {
  if (entry.action === 'inventorySlot') {
    if (!player.spendGold(entry.price)) return
    if (player.expandInventory(10)) ui.pushLog(`背包容量 +10（当前 ${player.inventoryCap}/100）`, 'info')
    else { player.gainGold(entry.price); ui.pushLog('背包已达上限 100 格', 'warn') }
    return
  }
  if (entry.action === 'bankSlot') {
    if (!player.spendGold(entry.price)) return
    if (player.expandBank(20)) ui.pushLog(`仓库容量 +20（当前 ${player.bankCap}/500）`, 'info')
    else { player.gainGold(entry.price); ui.pushLog('仓库已达上限 500 格', 'warn') }
    return
  }
  openBuyQty(entry)
}

// 出售（§11.3：出售价 = 价值 × 0.5）
const sellList = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id))
    .map(([id, qty]) => ({ id, qty, item: getItem(id), price: Math.max(1, Math.floor(getItem(id).value * 0.5)) }))
    .sort((a, b) => b.item.value - a.item.value)
)
function sell(id, qty = 1) {
  if (player.sellItem(id, qty)) ui.pushLog(`出售 ${getItem(id)?.name} ×${qty}（+${Math.max(1, Math.floor(getItem(id).value * 0.5)) * qty} 金币）`, 'info')
}
function sellAll(id) {
  const qty = player.inventory[id] ?? 0
  if (qty > 0) sell(id, qty)
}
// 出售分页
const sellPages = computed(() => Math.max(1, Math.ceil(sellList.value.length / PAGE_SIZE)))
const sellListPaged = computed(() => {
  const p = Math.min(sellPage.value, sellPages.value)
  const arr = sellList.value.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE)
  while (arr.length < PAGE_SIZE) arr.push({ _pad: true })
  return arr
})
</script>

<template>
  <section class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🛒 商店</h2>
        <p class="dim">购买弹药/种子/肥料/容量扩展；出售背包物品（半价回收）</p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">
          金币 <span class="mono">{{ player.gold.toLocaleString() }}</span>
        </div>
        <button class="btn btn-sm" @click="ui.setView('skill')">← 返回技能</button>
      </div>
    </header>

    <div class="region-tabs">
      <button class="btn btn-sm" :class="{ 'btn-primary': tab === 'buy' }" @click="tab = 'buy'">购买</button>
      <button class="btn btn-sm" :class="{ 'btn-primary': tab === 'sell' }" @click="tab = 'sell'">出售（半价回收）</button>
    </div>

    <!-- 购买 -->
    <div class="card" v-if="tab === 'buy'">
      <!-- 分类 tab（隐藏「全部」，其余保留） -->
      <div class="region-tabs" style="flex-wrap: wrap">
        <template v-for="t in SHOP_TABS" :key="t.id">
          <button v-if="t.id !== 'all'" class="btn btn-sm" :class="{ 'btn-primary': cat === t.id }" @click="cat = t.id">
            {{ t.name }}（{{ buyListCount(t.id) }}）
          </button>
        </template>
        <input v-model="q" class="plot-select" style="margin-left: auto; width: 170px" placeholder="🔍 搜索商品" />
      </div>
      <p class="dim" style="margin-bottom: 8px">种子在「杂货铺 + 珍馐阁」均可购买；部分高级种子也可由采摘/挖掘掉落（10%）</p>
      <div class="gather-grid grid-n-6">
        <template v-for="(entry, ei) in buyListPaged" :key="entry.itemId ?? entry.action ?? 'pad-' + ei">
          <div v-if="!entry._pad" v-tilt class="gather-card shop-card" :class="{ locked: !canAffordBuy(entry), affordable: canAffordBuy(entry) }">
          <div class="gather-card-head">
            <img v-if="entry.itemId && itemImage(entry.itemId)" :src="itemImage(entry.itemId)" class="item-img item-img-sm" @error="$event.target.style.display = 'none'" alt="" />
            <strong>{{ entry.action === 'inventorySlot' ? '🎒 背包扩展' : entry.action === 'bankSlot' ? '📦 仓库扩展' : shopItemName(entry.itemId) }}</strong>
          </div>
          <div class="gather-card-row"><span class="dim">{{ entry.desc ?? CATEGORY_LABEL[getItem(entry.itemId)?.category] ?? getItem(entry.itemId)?.category }}</span></div>
          <div class="gather-card-row"><span>价格</span><span class="mono">{{ entry.price }} 金币</span></div>
          <div class="gather-card-row">
            <span>持有</span>
            <span class="mono">
              <template v-if="entry.action === 'inventorySlot'">{{ player.inventoryCap }}/100</template>
              <template v-else-if="entry.action === 'bankSlot'">{{ player.bankCap }}/500</template>
              <template v-else>{{ player.inventory[entry.itemId] ?? 0 }}</template>
            </span>
          </div>
          <button
            class="btn btn-sm btn-primary"
            :disabled="player.gold < entry.price || (entry.action === 'inventorySlot' && player.inventoryCap >= 100) || (entry.action === 'bankSlot' && player.bankCap >= 500)"
            @click="buy(entry)"
          >
            购买
          </button>
          </div>
          <div v-else class="pager-spacer"></div>
        </template>
        <p v-if="!buyList.length" class="dim" style="grid-column: 1 / -1">没有匹配的商品</p>
      </div>
      <Pagination :current="Math.min(buyPage, buyPages)" :pages="buyPages" @update:current="(p) => buyPage = p" />
    </div>

    <!-- 出售 -->
    <div class="card" v-else>
      <p class="dim" style="margin-bottom: 8px">出售价 = 物品价值 × 0.5；背包占用 {{ player.inventorySlotsUsed }}/{{ player.inventoryCap }} 格</p>
      <div class="gather-grid grid-n-6">
        <template v-for="(s, ei) in sellListPaged" :key="s.id ?? 'pad-' + ei">
          <div v-if="!s._pad" class="gather-card shop-card">
            <div class="gather-card-head">
              <strong>{{ s.item.name }}</strong>
            </div>
            <div class="gather-card-row"><span>持有</span><span class="mono">×{{ s.qty }}</span></div>
            <div class="gather-card-row"><span>单价</span><span class="mono">{{ s.price }} 金币</span></div>
            <button class="btn btn-sm btn-primary" :disabled="s.qty <= 0" @click="openSellQty(s.id, s.price)">卖出</button>
          </div>
          <div v-else class="pager-spacer"></div>
        </template>
        <p v-if="!sellList.length" class="dim" style="grid-column: 1 / -1">背包空空如也</p>
      </div>
      <Pagination :current="Math.min(sellPage, sellPages)" :pages="sellPages" @update:current="(p) => sellPage = p" />
    </div>

    <!-- 数量选择弹窗（购买/卖出） -->
    <QuantityModal
      :show="!!qtyTarget"
      :title="qtyTarget?.kind === 'buy' ? `购买 ${shopItemName(qtyTarget.entry.itemId)}` : qtyTarget ? `出售 ${getItem(qtyTarget.id)?.name}` : ''"
      :max="qtyTarget?.max ?? 1"
      :price-each="qtyTarget?.price ?? 0"
      @close="qtyTarget = null"
      @confirm="confirmQty"
    />
  </section>
</template>
