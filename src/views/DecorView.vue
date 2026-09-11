<script setup>
// 餐厅装潢（2026-09-11 从「餐厅」页的装饰区块抽出为独立页）— 300 件装饰的图鉴式选购：
// 分类进度、总加成、性价比排序，避免在一张长列表里翻找。
// 纯读取 + 调用既有 player.spendGold，不改动任何装饰数值（数据铁律；装饰数据由生成器产出，勿手改）。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { RESTAURANT_DECOR, DECOR_CATEGORIES, RESTAURANT_DECOR_BY_ID } from '../game/data/restaurantDecor.js'
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
/** 每 1 万金币买到的加成%（越小越划算），用于性价比排序 */
function perK(id) {
  const d = RESTAURANT_DECOR_BY_ID[id]
  if (!d || !d.price) return 0
  return +((d.effect / d.price) * 10000).toFixed(3)
}

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

/** 下一件最值得买的（未购置里性价比最高且买得起的一件） */
const nextBest = computed(() => {
  const pool = RESTAURANT_DECOR.filter((d) => !owned.value.has(d.id)).sort((a, b) => perK(b.id) - perK(a.id))
  return pool.find((d) => player.gold >= d.price) ?? pool[0] ?? null
})

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
          共 <b>{{ RESTAURANT_DECOR.length }}</b> 件装饰，每件永久提升<b>餐厅收入 %</b>（与餐厅等级、菜单、套餐相乘叠加）。
          已购 {{ owned.size }} 件，当前总加成 <b>+{{ decorTotalBonus }}%</b>。
        </p>
      </div>
    </header>

    <!-- 概览 + 下一件推荐 -->
    <div class="card dv-hero">
      <div class="dv-stats">
        <div class="dv-stat"><span class="dim">已购置</span><b class="mono">{{ owned.size }}/{{ RESTAURANT_DECOR.length }}</b></div>
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

    <!-- 列表 -->
    <div class="card dv-card">
      <div class="dv-toolbar">
        <button class="btn btn-sm" :class="{ 'btn-primary': activeCat === 'all' }" @click="setCat('all')">
          全部 <span class="dim mono">{{ ownCount('all') }}/{{ RESTAURANT_DECOR.length }}</span>
        </button>
        <span class="dv-sep"></span>
        <button class="btn btn-sm" :class="{ 'btn-primary': sort === 'price' }" @click="setSort('price')">按价格</button>
        <button class="btn btn-sm" :class="{ 'btn-primary': sort === 'value' }" @click="setSort('value')">按性价比</button>
        <label class="dv-check"><input v-model="onlyUnowned" type="checkbox" @change="page = 1" /> 只看未购置</label>
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
</style>
