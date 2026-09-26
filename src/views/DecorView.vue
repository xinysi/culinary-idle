<script setup>
// 餐厅装潢（2026-09-11 从「餐厅」页的装饰区块抽出为独立页）— 300 件装饰的图鉴式选购：
// 分类进度、总加成、性价比排序，避免在一张长列表里翻找。
// 纯读取 + 调用既有 player.spendGold，不改动任何装饰数值（数据铁律；装饰数据由生成器产出，勿手改）。
// v2.9.0（2026-09-16）：新增「🪚 手工装潢」分区 —— 副业·木工做出木器后，在这里把它做成装潢
// （走 `player.craftDecor`，消耗**物品**而非金币）。手工装潢的数值定义在 `woodworking.js`。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { RESTAURANT_DECOR, DECOR_CATEGORIES, RESTAURANT_DECOR_BY_ID, DECOR_TOTAL, decorPerK as perK, nextDecorPick } from '../game/data/restaurantDecor.js'
import { CRAFTED_DECOR } from '../game/data/woodworking.js'
import { getItem } from '../game/data/items.js'
import Pagination from '../components/Pagination.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'restaurant', label: '🏮 我的餐厅' },
  { view: 'michelin', label: '⭐ 米其林评级' },
  { view: 'branches', label: '🏬 餐厅分店' },
  { view: 'rivals', label: '🏪 同业榜' },
]

const activeCat = ref('all')
const page = ref(1)
const sort = ref('price') // price | value（性价比）
const onlyUnowned = ref(false)
const PAGE_SIZE = 24 // 6 列 × 4 行（整行，便于补满行使翻页按钮位置固定）

const owned = computed(() => new Set(player.restaurant.decor ?? []))
const decorTotalBonus = computed(() => {
  let s = 0
  for (const id of player.restaurant.decor ?? []) s += RESTAURANT_DECOR_BY_ID[id]?.effect ?? 0
  return +s.toFixed(1)
})
const decorList = computed(() => {
  let arr = activeCat.value === 'all' ? RESTAURANT_DECOR : RESTAURANT_DECOR.filter((d) => d.category === activeCat.value)
  if (onlyUnowned.value) arr = arr.filter((d) => !owned.value.has(d.id))
  const copy = [...arr]
  if (sort.value === 'value') copy.sort((a, b) => perK(b.id) - perK(a.id) || a.price - b.price)
  else copy.sort((a, b) => a.price - b.price)
  return copy
})
const decorPages = computed(() => Math.max(1, Math.ceil(decorList.value.length / PAGE_SIZE)))
const currentPage = computed(() => Math.min(page.value, decorPages.value))
const pagedDecor = computed(() => {
  const arr = decorList.value.slice((currentPage.value - 1) * PAGE_SIZE, currentPage.value * PAGE_SIZE)
  while (arr.length < PAGE_SIZE) arr.push({ _pad: true })
  return arr
})
function setCat(c) { activeCat.value = c; page.value = 1 }
function setSort(s) { sort.value = s; page.value = 1 }

/** 下一件最值得买的 —— 口径在 restaurantDecor.js 的 `nextDecorPick`（餐厅页也调它，别各写一遍） */
const nextBest = computed(() => nextDecorPick(player.restaurant.decor ?? [], player.gold))

function ownCount(cat) {
  return (player.restaurant.decor ?? []).filter((id) => {
    const d = RESTAURANT_DECOR_BY_ID[id]
    return cat === 'all' || (d && d.category === cat)
  }).length
}
function catCount(cat) {
  return cat === 'all' ? RESTAURANT_DECOR.length : RESTAURANT_DECOR.filter((d) => d.category === cat).length
}
function buyDecor(d) {
  if (owned.value.has(d.id)) return
  if (!player.spendGold(d.price)) { ui.pushLog('金币不足', 'warn'); return }
  player.restaurant.decor = [...(player.restaurant.decor ?? []), d.id]
  ui.pushLog(`🏮 餐厅装饰：${d.name}（收入 +${d.effect}%）`, 'gain')
}

// ── 手工装潢（v2.9.0）：木器 → 装潢。消耗物品，不花金币 ──
/** 每件手工装潢 + 它所需木器的持有量 / 名称，供卡片显示 */
const craftedRows = computed(() =>
  CRAFTED_DECOR.map((d) => {
    const need = d.craftedFrom
    const it = getItem(need.itemId)
    return {
      ...d,
      needName: it?.name ?? need.itemId,
      needQty: need.qty,
      have: player.inventory[need.itemId] ?? 0,
      owned: owned.value.has(d.id),
    }
  })
)
const craftedOwned = computed(() => craftedRows.value.filter((r) => r.owned).length)
const craftedBonus = computed(() => +craftedRows.value.filter((r) => r.owned).reduce((a, r) => a + r.effect, 0).toFixed(1))
function doCraft(row) {
  const res = player.craftDecor(row.id)
  if (res === 'denied') ui.pushLog(`材料不足：需要「${row.needName}」×${row.needQty}`, 'warn')
  else if (res === 'bad') ui.pushLog('该装潢无法手工制作', 'warn')
  // owned / ok 都已在 player 侧给过日志（ok 会写一条 gain 日志）
}

// 分类进度（含每类已购/总数与合计加成）
const catRows = computed(() =>
  DECOR_CATEGORIES.map((c) => {
    const list = RESTAURANT_DECOR.filter((d) => d.category === c.id)
    const own = list.filter((d) => owned.value.has(d.id))
    return {
      ...c,
      total: list.length,
      owned: own.length,
      bonus: +own.reduce((a, d) => a + d.effect, 0).toFixed(1),
    }
  })
)
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🏮 餐厅装潢</h2>
        <p class="dim">
          共 <b>{{ DECOR_TOTAL }}</b> 件装潢（商店 {{ RESTAURANT_DECOR.length }} 件 + 手工 {{ CRAFTED_DECOR.length }} 件），
          每件永久提升<b>餐厅收入 %</b>（与餐厅等级、菜单、套餐相乘叠加）。
          已购 {{ owned.size }} 件，当前总加成 <b>+{{ decorTotalBonus }}%</b>。
        </p>
        <p class="dim">
          💡 <b>投资优先级</b>：装潢是<b>长期资产</b>（按实测，满 300 件的回本时间约 <b>600 小时</b>餐厅收入），
          而<b>餐厅分店</b>的回本只要<b>十几小时</b>——金币紧张时先开分店、先把菜单与等级做上去，装潢留到金币宽裕再收。
        </p>
      </div>
    </header>

    <!-- 概览 + 下一件推荐 -->
    <div class="card dv-hero">
      <div class="dv-stats">
        <div class="dv-stat"><span class="dim">已购置</span><b class="mono">{{ owned.size }}/{{ DECOR_TOTAL }}</b></div>
        <div class="dv-stat"><span class="dim">总加成</span><b class="mono">+{{ decorTotalBonus }}%</b></div>
        <div class="dv-stat"><span class="dim">当前收入</span><b class="mono">{{ player.restaurantHourlyIncome.toFixed(1) }}/时</b></div>
      </div>
      <div v-if="nextBest" class="dv-next">
        <span class="dim">下一件推荐（性价比最高）：</span>
        <b>{{ nextBest.name }}</b>
        <span class="dim">收入 +{{ nextBest.effect }}% · {{ nextBest.price.toLocaleString() }} 金币</span>
        <button class="btn btn-sm btn-primary" :disabled="player.gold < nextBest.price" @click="buyDecor(nextBest)">
          {{ player.gold >= nextBest.price ? '购买' : '金币不足' }}
        </button>
      </div>
      <p v-else class="dim">🎉 全部装饰已购置完毕。</p>
    </div>

    <!-- 分类进度 -->
    <div class="card dv-card">
      <div class="dv-h">📊 分类进度</div>
      <div class="dv-cats">
        <button
          v-for="c in catRows"
          :key="c.id"
          class="btn btn-sm dv-cat"
          :class="{ 'btn-primary': activeCat === c.id }"
          @click="setCat(c.id)"
        >
          {{ c.label }} <span class="dim mono">{{ c.owned }}/{{ c.total }}</span>
          <span class="dim mono">+{{ c.bonus }}%</span>
        </button>
      </div>
    </div>

    <!-- 手工装潢（v2.9.0，副业·木工）：木器 → 装潢，消耗物品不花金币 -->
    <div class="card dv-card">
      <div class="dv-h">🪚 手工装潢 <span class="dim">（木工做出木器后在此做成装潢，不花金币）</span></div>
      <p class="dim dv-note">
        去左侧「🪚 副业 → 木工」把木材做成木器，再回来做成装潢。
        已做 {{ craftedOwned }}/{{ CRAFTED_DECOR.length }} 件，合计 <b>+{{ craftedBonus }}%</b>。
      </p>
      <div class="guild-shop-grid grid-n-5">
        <div
          v-for="r in craftedRows"
          :key="r.id"
          class="guild-shop-card"
          :class="{ 'guild-locked': r.owned, 'dv-can': !r.owned && r.have >= r.needQty }"
        >
          <div class="guild-shop-name">{{ r.name }}</div>
          <div class="dim guild-shop-price">收入 +{{ r.effect }}%</div>
          <div class="dim dv-need">需 {{ r.needName }} ×{{ r.needQty }}（持有 {{ r.have }}）</div>
          <button
            v-if="!r.owned"
            class="btn btn-sm"
            :class="r.have >= r.needQty ? 'btn-primary' : ''"
            @click="doCraft(r)"
          >
            {{ r.have >= r.needQty ? '做成装潢' : '材料不足' }}
          </button>
          <span v-else class="badge badge-on">已做成</span>
        </div>
      </div>
    </div>

    <!-- 列表 -->
    <div class="card dv-card">
      <div class="dv-toolbar">
        <button class="btn btn-sm" :class="{ 'btn-primary': activeCat === 'all' }" @click="setCat('all')">
          全部 <span class="dim mono">{{ ownCount('all') }}/{{ RESTAURANT_DECOR.length }}</span>
        </button>
        <span class="dv-sep"></span>
        <button class="btn btn-sm" :class="{ 'btn-primary': sort === 'price' }" @click="setSort('price')">按价格</button>
        <button class="btn btn-sm" :class="{ 'btn-primary': sort === 'value' }" @click="setSort('value')">按性价比</button>
        <label class="dv-check"><input v-model="onlyUnowned" type="checkbox" class="ui-check" @change="page = 1" /> 只看未购置</label>
        <span class="dim">共 {{ decorList.length }} 件 · 第 {{ currentPage }}/{{ decorPages }} 页</span>
      </div>

      <div class="guild-shop-grid grid-n-6">
        <template v-for="(d, di) in pagedDecor" :key="d.id ?? 'pad-' + di">
        <div v-if="!d._pad" class="guild-shop-card" :class="{ 'guild-locked': owned.has(d.id) }">
          <div class="guild-shop-name">{{ d.name }}</div>
          <div class="dim guild-shop-price">收入 +{{ d.effect }}% <span class="dim">（{{ perK(d.id) }}%/万金）</span></div>
          <button
            v-if="!owned.has(d.id)"
            class="btn btn-sm btn-primary"
            :disabled="player.gold < d.price"
            @click="buyDecor(d)"
          >
            {{ d.price.toLocaleString() }} 金币
          </button>
          <span v-else class="badge badge-on">已购置</span>
        </div>
        <div v-else class="pager-spacer"></div>
        </template>
      </div>
      <Pagination :current="currentPage" :pages="decorPages" @update:current="(p) => page = p" />
    </div>

    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.dv-hero {
  margin-top: 12px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dv-stats {
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
}
.dv-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.dv-stat b {
  font-size: 16px;
}
.dv-next {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.dv-card {
  margin-top: 12px;
}
.dv-h {
  font-weight: 600;
}
.dv-cats {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.dv-cat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dv-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  font-size: 12px;
}
.dv-sep {
  width: 1px;
  height: 18px;
  background: var(--border);
}
.dv-check {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 12px;
}
/* 手工装潢分区（v2.9.0） */
.dv-note {
  margin: 6px 0 10px;
  font-size: 12px;
}
.dv-need {
  font-size: 11px;
}
.dv-can {
  border-color: rgba(var(--primary-tint-rgb), 0.45);
}
</style>
