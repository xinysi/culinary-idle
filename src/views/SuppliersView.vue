<script setup>
// 供应商合约（2026-09-10 新增）— 一次性定金签 7 天长约，锁定单价、每日自动到货；金币不足当日不到货、次日再试。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { SUPPLIERS, SUPPLIER_MAX_CONTRACTS, SUPPLIER_TERM_DAYS, SUPPLIER_PRICE_MULT, supplierDailyCost } from '../game/data/suppliers.js'

const player = usePlayerStore()
const ui = useUiStore()

const active = computed(() => player.activeContracts())
const activeCount = computed(() => active.value.length)
const remain = computed(() => SUPPLIER_MAX_CONTRACTS - activeCount.value)

function dayLeft(c) {
  return Math.max(0, Math.ceil(((c.expiresAt ?? 0) - Date.now()) / 86400_000))
}
function row(s) {
  const it = getItem(s.itemId)
  const cost = supplierDailyCost(s, it?.value ?? 0)
  const shopUnit = Math.round((it?.value ?? 0) * 1.6)
  const on = active.value.find((c) => c.def.id === s.id)
  return {
    def: s,
    item: it,
    cost,
    shopCost: shopUnit * s.qty,
    saved: Math.max(0, shopUnit * s.qty - cost),
    on,
    left: on ? dayLeft(on) : 0,
  }
}
// 已签约的排前面，便于一眼看到当前合约
const rows = computed(() =>
  [...SUPPLIERS.map(row)].sort((a, b) => (b.on ? 1 : 0) - (a.on ? 1 : 0))
)

function sign(s) {
  const r = player.signContract(s.id)
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function cancel(s) {
  if (player.cancelContract(s.id)) ui.pushLog(`已与${s.name}解约`, 'warn')
}
function gotoShop() {
  ui.setView('shop')
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'shop', label: '🛒 商店' }, { view: 'exchange', label: '💹 交易所' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🤝 供应商合约</h2>
        <p class="dim">
          交一笔<b>定金</b>签下 <b>{{ SUPPLIER_TERM_DAYS }} 天</b>长约：此后每天自动送货到仓库，货款按
          <b>{{ Math.round(SUPPLIER_PRICE_MULT * 100) }}% 物价</b>结算（比商店买便宜，比自采稍贵）；
          金币不够时当日不到货、次日再试（不累积）。同时最多 <b>{{ SUPPLIER_MAX_CONTRACTS }}</b> 份合约。
        </p>
      </div>
    </header>

    <div class="card status-line">
      <span class="badge badge-on">生效中 {{ activeCount }} / {{ SUPPLIER_MAX_CONTRACTS }}</span>
      <span class="dim">可再签 <b class="mono">{{ remain }}</b> 份 · 累计到货 <b class="mono">{{ (player.stats?.contractDeliveries ?? 0).toLocaleString() }}</b> 次</span>
    </div>

    <div v-if="active.length" class="card">
      <div class="sup-h">📦 生效中的合约</div>
      <div class="sup-active">
        <div v-for="c in active" :key="c.def.id" class="sup-active-row">
          <span class="sup-icon">{{ c.def.icon }}</span>
          <span class="sup-name">{{ c.def.name }}</span>
          <span class="dim mono">{{ c.def.qty }}×{{ getItem(c.def.itemId)?.name ?? c.def.itemId }}/日</span>
          <span class="sup-left">剩余 <b class="mono">{{ dayLeft(c) }}</b> 天</span>
          <span class="dim mono">已付 {{ (c.paid ?? 0).toLocaleString() }}</span>
          <button class="btn btn-sm" @click="cancel(c.def)">解约</button>
        </div>
      </div>
    </div>

    <div class="sup-grid">
      <div v-for="r in rows" :key="r.def.id" class="card sup-card" :class="{ signed: !!r.on }">
        <div class="sup-head">
          <span class="sup-icon">{{ r.def.icon }}</span>
          <div>
            <strong>{{ r.def.name }}</strong>
            <div class="dim sup-sub">{{ r.def.desc }}</div>
          </div>
          <span v-if="r.on" class="badge badge-on">生效中</span>
        </div>

        <div class="sup-row">
          <span class="dim">货物</span>
          <span>{{ r.item?.name ?? r.def.itemId }} × {{ r.def.qty }}/日</span>
        </div>
        <div class="sup-row">
          <span class="dim">货款</span>
          <span class="mono">{{ r.cost.toLocaleString() }} 金币/日</span>
        </div>
        <div class="sup-row">
          <span class="dim">对比商店</span>
          <span class="up mono">省 {{ r.saved.toLocaleString() }} 金币/日</span>
        </div>
        <div class="sup-row">
          <span class="dim">定金</span>
          <span class="mono">{{ r.def.deposit.toLocaleString() }} 金币</span>
        </div>

        <template v-if="r.on">
          <div class="dim sup-sub">✅ 剩余 {{ r.left }} 天，每日自动到货</div>
          <button class="btn btn-sm" @click="cancel(r.def)">解约（定金不退）</button>
        </template>
        <template v-else>
          <button class="btn btn-sm btn-primary" :disabled="remain <= 0" @click="sign(r.def)">
            签约（定金 {{ r.def.deposit.toLocaleString() }}）
          </button>
          <div v-if="remain <= 0" class="dim sup-sub">已达合约上限，先解约一份</div>
        </template>
      </div>
    </div>

    <div class="card status-line">
      <span class="dim">想立即补货？去</span>
      <button class="btn btn-sm" @click="gotoShop">🛒 商店</button>
      <span class="dim">或</span>
      <button class="btn btn-sm" @click="ui.setView('exchange')">💹 交易所</button>
      <span class="dim">看看即时行情。</span>
    </div>
      <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.sup-h {
  font-weight: 600;
  margin-bottom: 8px;
}
.sup-active {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sup-active-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.sup-left {
  font-size: 12px;
  margin-left: auto;
}
.sup-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.sup-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sup-card.signed {
  border-color: var(--accent, #d95a38);
}
.sup-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sup-icon {
  font-size: 22px;
}
.sup-name {
  font-weight: 600;
}
.sup-sub {
  font-size: 12px;
  line-height: 1.5;
}
.sup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}
.up {
  color: var(--good, #57a861);
}
</style>
