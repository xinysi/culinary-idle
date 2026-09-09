<script setup>
// 交易所（2026-09-10 新增）— 动态价格：每 4 小时轮换 6 种货物，买低卖高（每日每件限 60）。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { EXCHANGE_UNLOCK_LEVEL, EXCHANGE_CYCLE_HOURS, EXCHANGE_DAILY_LIMIT, exchangeCycleIndex } from '../game/data/exchange.js'
import { getSkillDef } from '../game/data/skills.js'
import { getItem } from '../game/data/items.js'
import ItemImg from '../components/ItemImg.vue'

const player = usePlayerStore()
const ui = useUiStore()

const qty = ref({})
function q(id) {
  if (!qty.value[id]) qty.value[id] = 1
  return qty.value[id]
}

const unlocked = computed(() => player.exchangeUnlocked())
const cycle = computed(() => exchangeCycleIndex())
const nextCycleMs = computed(() => (cycle.value + 1) * EXCHANGE_CYCLE_HOURS * 3600_000 - Date.now())
const goods = computed(() => (unlocked.value ? player.exchangeGoods() : []))

const stats = computed(() => ({ trades: player.stats?.exchangeTrades ?? 0, gold: player.stats?.exchangeGold ?? 0 }))

function fmtMs(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${s % 60} 秒`
  return `${s} 秒`
}
/** 行情标记：倍率相对基准（value） */
function mood(g) {
  const ratio = g.sell / (g.item.value || 1)
  if (ratio >= 1.3) return { text: '📈 高价', cls: 'mood-high' }
  if (ratio <= 0.8) return { text: '📉 低价', cls: 'mood-low' }
  return { text: '➖ 平价', cls: '' }
}
function sell(g) {
  const r = player.exchangeSell(g.item.id, q(g.item.id))
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function buy(g) {
  const r = player.exchangeBuy(g.item.id, q(g.item.id))
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>💹 交易所</h2>
        <p class="dim">
          行情每 <b>{{ EXCHANGE_CYCLE_HOURS }} 小时</b>轮换一批货物：价高时卖出、价低时囤货，买卖价差 35%。
          每日每件限成交 {{ EXCHANGE_DAILY_LIMIT }} 件。
        </p>
      </div>
      <span v-if="unlocked" class="dim mono">距换货 {{ fmtMs(nextCycleMs) }}</span>
    </header>

    <div v-if="!unlocked" class="card status-line">
      <span class="badge">🔒 未解锁</span>
      <span class="dim">需 {{ getSkillDef('spiceMixing')?.name ?? '调料调配' }} Lv{{ EXCHANGE_UNLOCK_LEVEL }} 解锁交易所</span>
    </div>

    <template v-else>
      <div class="card status-line">
        <span class="badge badge-on">本期第 {{ cycle }} 期</span>
        <span class="dim">累计成交 <b class="mono">{{ stats.trades.toLocaleString() }}</b> 件 · 累计流水 <b class="mono">{{ stats.gold.toLocaleString() }}</b> 金币</span>
        <span class="dim">📈 高价卖出 · 📉 低价买入</span>
      </div>

      <div class="ex-grid">
        <div v-for="g in goods" :key="g.item.id" class="card ex-card">
          <div class="ex-head">
            <ItemImg :item-id="g.item.id" size="sm" />
            <div>
              <strong>{{ g.item.name }}</strong>
              <div class="dim ex-sub">基准价值 {{ g.item.value }} · 持有 {{ g.own }}</div>
            </div>
            <span class="ex-mood" :class="mood(g).cls">{{ mood(g).text }}</span>
          </div>

          <div class="ex-prices">
            <div class="ex-price"><span class="dim">收购（卖出）</span><span class="mono gold">{{ g.sell.toLocaleString() }}</span></div>
            <div class="ex-price"><span class="dim">售出（买入）</span><span class="mono">{{ g.buy.toLocaleString() }}</span></div>
          </div>

          <div class="ex-actions">
            <input v-model.number="qty[g.item.id]" type="number" min="1" :max="EXCHANGE_DAILY_LIMIT" class="ex-input" />
            <button class="btn btn-sm btn-primary" :disabled="g.remain <= 0 || g.own <= 0" @click="sell(g)">卖出</button>
            <button class="btn btn-sm" :disabled="g.remain <= 0" @click="buy(g)">买入</button>
          </div>
          <div class="dim ex-sub">今日剩余额度 {{ g.remain }} / {{ EXCHANGE_DAILY_LIMIT }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ex-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.ex-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ex-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ex-mood {
  margin-left: auto;
  font-size: 11px;
  white-space: nowrap;
}
.mood-high {
  color: var(--good-strong);
}
.mood-low {
  color: var(--info);
}
.ex-sub {
  font-size: 11px;
  line-height: 1.5;
}
.ex-prices {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.ex-price {
  display: flex;
  flex-direction: column;
  font-size: 12px;
}
.ex-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ex-input {
  width: 76px;
  height: 30px;
  padding: 0 8px;
  font-size: 12px;
  text-align: center;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
}
</style>
