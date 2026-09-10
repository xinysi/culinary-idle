<script setup>
// 宴会承办（2026-09-10 新增）— 限时大订单：交付指定类别料理换大奖。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { BANQUET_TIERS, PORTIONS_PER_TABLE } from '../game/data/banquets.js'
import { getItem } from '../game/data/items.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()

const order = computed(() => player.banquetState().order)
const offer = computed(() => player.banquetOffer())
const ready = computed(() => player.banquetReady())
const st = computed(() => player.banquetState())

const remain = computed(() => {
  ui.loopTick
  if (!order.value) return 0
  return Math.max(0, order.value.expiresAt - Date.now())
})
const progress = computed(() => (order.value ? Math.min(1, ready.value / order.value.need) : 0))

/** 库存中符合要求的料理清单 */
const candidates = computed(() => {
  const o = order.value
  if (!o) return []
  return Object.entries(player.inventory ?? {})
    .map(([id, qty]) => ({ id, qty, it: getItem(id) }))
    .filter((c) => c.it?.type === 'food' && c.it.category === o.cat && (c.it.tier ?? 0) >= o.minTier && c.qty > 0)
    .sort((a, b) => (b.it.tier ?? 0) - (a.it.tier ?? 0))
})

function fmtMs(ms) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分 ${s % 60} 秒`
}
function accept() {
  const r = player.banquetAccept()
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function deliver() {
  const r = player.banquetDeliver()
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function abandon() {
  if (player.banquetAbandon()) ui.pushLog('已放弃本次宴席（无惩罚）', 'warn')
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'restaurant', label: '🏮 餐厅' }, { view: 'takeout', label: '🚚 外卖' }, { view: 'setMeals', label: '🍱 套餐定食' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🍽 宴会承办</h2>
        <p class="dim">
          接一桌大席：按「桌数 × {{ PORTIONS_PER_TABLE }}」交付指定类别、达到 tier 门槛的料理（消耗库存），
          在时限内交付拿大奖（金币 + 神秘调料 + 餐厅好感）；超时自动作废，<b>放弃无惩罚</b>。
        </p>
      </div>
    </header>

    <div class="card status-line">
      <span class="badge badge-on">已承办 {{ st.done ?? 0 }} 场</span>
      <span class="dim">作废 {{ st.failed ?? 0 }} 场 · 单场最多交付 {{ BANQUET_TIERS[3].tables * PORTIONS_PER_TABLE }} 份</span>
    </div>

    <!-- 进行中的订单 -->
    <div v-if="order" class="card banquet-live">
      <div class="banquet-head">
        <h3>{{ order.tierName }} · {{ order.cat }} ×{{ order.need }}</h3>
        <span class="dim mono">剩余 {{ fmtMs(remain) }}</span>
      </div>
      <ProgressBar :progress="progress" />
      <div class="banquet-sub mono" :class="{ ok: ready >= order.need }">
        已备 {{ ready }} / {{ order.need }} 份（tier ≥ {{ order.minTier }}）
      </div>
      <div class="dim banquet-sub">
        奖励：{{ order.gold.toLocaleString() }} 金币<template v-if="order.spice"> + 神秘调料 ×{{ order.spice }}</template> + 餐厅好感
      </div>
      <div v-if="candidates.length" class="banquet-cands">
        <span v-for="c in candidates.slice(0, 10)" :key="c.id" class="badge">{{ c.it.name }} ×{{ c.qty }}</span>
      </div>
      <div class="banquet-actions">
        <button class="btn btn-primary" :disabled="ready < order.need" @click="deliver">交付（{{ ready }}/{{ order.need }}）</button>
        <button class="btn btn-sm" @click="abandon">放弃</button>
      </div>
    </div>

    <!-- 今日候选 -->
    <div v-else class="card banquet-offer">
      <div class="banquet-head">
        <h3>今日席面：{{ offer.tierName }}</h3>
        <span class="dim mono">限时 {{ offer.hours }} 小时</span>
      </div>
      <div class="dim banquet-sub">要求：{{ offer.cat }} ×{{ offer.need }} 份（tier ≥ {{ offer.minTier }}，每桌 {{ PORTIONS_PER_TABLE }} 份）</div>
      <div class="dim banquet-sub">
        奖励：{{ offer.gold.toLocaleString() }} 金币<template v-if="offer.spice"> + 神秘调料 ×{{ offer.spice }}</template> + 餐厅好感 60
      </div>
      <button class="btn btn-primary" @click="accept">接下这桌席</button>
    </div>

    <h3 style="margin-top: 16px">席面规格</h3>
    <div class="card">
      <table class="target-table">
        <tbody>
          <tr v-for="t in BANQUET_TIERS" :key="t.id">
            <td style="width: 100px"><b>{{ t.name }}</b></td>
            <td class="dim mono" style="width: 120px">{{ t.tables }} 桌 / {{ t.tables * PORTIONS_PER_TABLE }} 份</td>
            <td class="dim mono" style="width: 110px">限时 {{ t.hours }}h</td>
            <td class="dim mono" style="width: 90px">tier ≥ {{ t.minTier }}</td>
            <td class="dim">奖励 {{ t.goldBase.toLocaleString() }} 金币<template v-if="t.spice"> + 神秘调料 ×{{ t.spice }}</template></td>
          </tr>
        </tbody>
      </table>
    </div>
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.banquet-live,
.banquet-offer {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.banquet-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.banquet-sub {
  font-size: 13px;
  line-height: 1.7;
}
.banquet-sub.ok {
  color: var(--good-strong);
  font-weight: 700;
}
.banquet-cands {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.banquet-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
</style>
