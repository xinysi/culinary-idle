<script setup>
// 杂货铺 — 需求文档 §11.3：购买弹药/种子/容量扩展 + 出售背包物品（价值×0.5）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { SHOP_ITEMS, shopItemName } from '../game/data/shop.js'
import { expansionsByGroup, EXPANSIONS } from '../game/data/expansions.js'
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
  { id: 'expansion', name: '容量与扩建' },
]
function shopCat(entry) {
  if (entry.action) return 'expansion'
  const t = getItem(entry.itemId)?.type
  if (t === 'seed') return 'seed'
  if (entry.itemId === 'compost' || entry.itemId === 'richCompost') return 'fertilizer'
  return 'ammo'
}
// 扩建总览面板（v2.4.2，注册表驱动）：分组 + 每项「当前/上限/下档价」+ 购买 + 去页面
const expansionGroups = computed(() => expansionsByGroup())
function expPrice(e) { return e.price(player) }
function expMaxed(e) { return e.current(player) >= e.max }
function expCanBuy(e) {
  const price = expPrice(e)
  return price != null && player.gold >= price
}
function buyExpansion(e) {
  const r = e.apply(player)
  if (r.ok) ui.pushLog(`🧱 ${e.name}：${r.msg ?? '已升级'}`, 'gain')
  else ui.pushLog(`${e.name}：${r.msg ?? '无法升级'}`, 'warn')
}
/**
 * 一键买满（**只给存储容量组**）：厨藏从 120 买到 2500 要 119 次「+20 格」点击（上限 2026-09-20 由 600 提到 2500），
 * 手动点不现实。其它扩建的价格是递增曲线，一键买满会一次花掉远超预期的金币，故不开这个口子。
 * 循环里同时以「金币不足 / 已到上限 / 数值没变化」三种情况收口，避免死循环。
 */
function expBulk(e) {
  let n = 0
  for (let i = 0; i < 500; i++) {
    const before = e.current(player)
    const r = e.apply(player)
    if (!r.ok || e.current(player) <= before) break
    n++
  }
  ui.pushLog(n ? `🧱 ${e.name}：连买 ${n} 次 → 当前 ${e.current(player)}${e.unit}` : `${e.name}：买不动了（金币不足或已到上限）`, n ? 'gain' : 'warn')
}
function goExpansionPage(e) {
  if (e.view === 'skill' && e.skill) player.setActiveSkill(e.skill)
  ui.setView(e.view)
}

// 商品网格只列**真物品**（扩建类统一在「容量与扩建」页签，见 shop.js 末尾注释）
const buyList = computed(() =>
  SHOP_ITEMS.filter((s) => !s.action).filter((s) => cat.value === 'all' || shopCat(s) === cat.value)
    .filter((s) => !q.value.trim() || (getItem(s.itemId)?.name ?? '').includes(q.value.trim()) || (s.itemId ?? '').includes(q.value.trim().toLowerCase()))
)
function buyListCount(tabId) {
  if (tabId === 'all') return SHOP_ITEMS.length
  // 扩建类商品不在 SHOP_ITEMS 里（它们在 `expansions.js` 的注册表）⇒ 计数必须从这里取，
  // 否则页签一直显示「容量与扩建（0）」而面板里却有 16 行（2026-09-20 存储合一时发现）
  if (tabId === 'expansion') return EXPANSIONS.length
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
  return player.gold >= entry.price
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
  openBuyQty(entry)
}

// 出售（§11.3：出售价 = 价值 × 0.5）
const sellList = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id))
    .map(([id, qty]) => ({ id, qty, item: getItem(id), price: player.sellUnitPrice(id) }))
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
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'deluxe', label: '🍽️ 珍馐阁' }, { view: 'exchange', label: '💹 交易所' }, { view: 'suppliers', label: '🤝 供应商' }]
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
      <!-- 容量与扩建：注册表总览（2026-09-15 v2.4.2；各产线页面仍保留同款按钮，两处入口等价） -->
      <template v-if="cat === 'expansion'">
        <p class="dim" style="margin-bottom: 8px">
          这里汇总可用金币扩张/升级的**全部**项目（存储容量 · 挂机产线设施 · 农具 · 便利解锁）；
          各产线页面上也有同款按钮，两处等价。上限与价格一律取自各自数据模块，不另设一套。
        </p>
        <div v-for="g in expansionGroups" :key="g.id" class="exp-group">
          <h4 class="exp-group-head">{{ g.icon }} {{ g.name }}</h4>
          <div class="exp-rows">
            <div v-for="e in g.rows" :key="e.id" class="card exp-row">
              <div class="exp-main">
                <div class="exp-name">{{ e.icon }} {{ e.name }}</div>
                <!-- expansions.js 的 desc 带 <b> 强调标记 ⇒ 必须 v-html（{{ }} 会显示成纯文本） -->
                <div class="dim exp-desc" v-html="e.desc"></div>
              </div>
              <div class="exp-state mono">
                {{ e.current(player) }}<span class="dim"> / {{ e.max }}{{ e.unit }}</span>
              </div>
              <div class="exp-price mono">
                <span v-if="expMaxed(e)" class="dim">已满级</span>
                <span v-else>{{ expPrice(e)?.toLocaleString() }} 金币</span>
              </div>
              <div class="exp-actions">
                <button class="btn btn-sm btn-primary" :disabled="!expCanBuy(e)" @click="buyExpansion(e)">
                  {{ expMaxed(e) ? '已满级' : '购买' }}
                </button>
                <button v-if="e.group === 'storage'" class="btn btn-sm" title="连续购买直到金币不足或达到上限" @click="expBulk(e)">买满</button>
                <button class="btn btn-sm" @click="goExpansionPage(e)">去页面 ↗</button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="gather-grid grid-n-6">
        <template v-for="(entry, ei) in buyListPaged" :key="entry.itemId ?? entry.action ?? 'pad-' + ei">
          <div v-if="!entry._pad" class="gather-card shop-card" :class="{ locked: !canAffordBuy(entry), affordable: canAffordBuy(entry) }">
          <div class="gather-card-head">
            <img v-if="entry.itemId && itemImage(entry.itemId)" :src="itemImage(entry.itemId)" class="item-img item-img-sm" @error="$event.target.style.display = 'none'" alt="" loading="lazy" decoding="async" />
            <strong>{{ shopItemName(entry.itemId) }}</strong>
          </div>
          <div class="gather-card-row"><span class="dim">{{ entry.desc ?? CATEGORY_LABEL[getItem(entry.itemId)?.category] ?? getItem(entry.itemId)?.category }}</span></div>
          <div class="gather-card-row"><span>价格</span><span class="mono">{{ entry.price }} 金币</span></div>
          <div class="gather-card-row">
            <span>持有</span>
            <span class="mono">{{ player.inventory[entry.itemId] ?? 0 }}</span>
          </div>
          <button
            class="btn btn-sm btn-primary"
            :disabled="!canAffordBuy(entry)"
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
    <RelatedPages :links="RELATED" />
  </section>
</template>
