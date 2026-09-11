<script setup>
// 餐厅经营 — 需求文档 §13（可选扩展）
// 放置经营：菜单放上已制作的料理 → 每小时自动赚金币（离线也赚，80% 效率）
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { RESTAURANT_DECOR, RESTAURANT_DECOR_BY_ID } from '../game/data/restaurantDecor.js'

const player = usePlayerStore()
const ui = useUiStore()

// ── 食客订单（2026-09-06）：1 秒刷新剩余时间 ──
const nowMs = ref(Date.now())
let timerId = null
onMounted(() => {
  timerId = setInterval(() => { nowMs.value = Date.now() }, 1000)
})
onUnmounted(() => { if (timerId) clearInterval(timerId) })
const orderList = computed(() => (player.orders?.list ?? []).map((o) => ({ ...o, remainMin: Math.max(0, Math.ceil((o.expireAt - nowMs.value) / 60000)) })))
function orderHave(o) { return (player.inventory[o.itemId] ?? 0) >= o.qty }
function deliverOrder(o) {
  const r = player.finishOrder(o.id)
  if (r.ok) ui.pushLog(`🍽 食客「${r.name}」满意而归：+${r.reward} 金币`, 'gain')
  else ui.pushLog(r.msg ?? '交付失败', 'warn')
}

// ── 美食评论家（2026-09-09）：高要求食客 ──
const critic = computed(() => player.criticState().order)
const criticRemainMin = computed(() => (critic.value ? Math.max(0, Math.ceil((critic.value.expireAt - nowMs.value) / 60000)) : 0))
const criticPick = ref(null)
const criticCandidates = computed(() => {
  const o = critic.value
  if (!o) return []
  return Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.type === 'food' && getItem(id).category === o.category && (getItem(id).tier ?? 0) >= o.minTier)
    .map(([id, q]) => ({ id, qty: q, item: getItem(id) }))
    .sort((a, b) => (b.item.tier ?? 0) - (a.item.tier ?? 0))
})
function serveCriticNow() {
  if (!criticPick.value) { ui.pushLog('请先选择一道符合要求的料理', 'warn'); return }
  const r = player.serveCritic(criticPick.value)
  if (!r.ok) ui.pushLog(r.msg ?? '提交失败', 'warn')
  else criticPick.value = null
}

// 装饰（§13）已独立成页（views/DecorView.vue）：本页只保留总加成数字与入口
const decorTotalBonus = computed(() => {
  let s = 0
  for (const id of player.restaurant.decor ?? []) s += RESTAURANT_DECOR_BY_ID[id]?.effect ?? 0
  return +s.toFixed(1)
})

const ownedFoods = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.type === 'food')
    .map(([id]) => ({ id, item: getItem(id) }))
    .sort((a, b) => b.item.value - a.item.value)
)

function setMenu(i, dishId) {
  player.setRestaurantMenu(i, dishId)
}
function upgradeCost() {
  return 150 * player.restaurant.level * player.restaurant.level
}
function hourlyOf(dishId) {
  const item = getItem(dishId)
  if (!item) return 0
  return (item.value + (item.heal ?? 0)) * 0.5 * (1 + 0.3 * (player.restaurant.level - 1))
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🏮 我的餐厅</h2>
        <p class="dim">放置经营：菜单挂上料理即可持续赚金币，离线也在营业（80% 效率）</p>
      </div>
      <div class="skill-head-right restaurant-head-right">
        <div class="xp-num">等级 {{ player.restaurant.level }}</div>
        <p class="dim mono restaurant-head-sub">当前收入 {{ player.restaurantHourlyIncome.toFixed(1) }} 金币/小时</p>
      </div>
    </header>

    <!-- 升级说明框（与其他页面一致的说明框样式） -->
    <div class="card restaurant-upgrade-box">
      <p class="dim restaurant-upgrade-text">升级：收入 +30%/级，每 2 级 +1 菜单位 · 顾客好感（每级小费 +3%）：Lv{{ player.favorLevel() }}</p>
      <button class="btn btn-sm btn-primary" :disabled="player.gold < upgradeCost()" @click="player.upgradeRestaurant()">
        升级餐厅（{{ upgradeCost().toLocaleString() }} 金币）
      </button>
    </div>

    <div class="card">
      <h3>菜单（{{ player.restaurant.menu.filter((x) => x).length }}/{{ player.restaurantSlots }}）</h3>
      <div class="menu-list">
        <div v-for="i in player.restaurantSlots" :key="i - 1" class="opp-row">
          <span class="dim">菜品 {{ i }}</span>
          <select
            class="plot-select"
            :value="player.restaurant.menu[i - 1] ?? ''"
            style="flex: 1"
            @change="setMenu(i - 1, $event.target.value || null)"
          >
            <option value="">（空位）</option>
            <option v-for="f in ownedFoods" :key="f.id" :value="f.id" :disabled="player.restaurant.menu.includes(f.id) && player.restaurant.menu[i - 1] !== f.id">
              {{ f.item.name }}（+{{ hourlyOf(f.id).toFixed(1) }}/时）
            </option>
          </select>
        </div>
      </div>
      <p class="dim special-note">菜单只展示你背包里拥有的料理；累计赚取：{{ (player.stats.restaurantTotal ?? 0).toLocaleString() }} 金币</p>
    </div>

    <!-- 食客订单（2026-09-06）：到访点名料理 → 交货领赏金 -->
    <div class="card">
      <div class="decor-title-row">
        <h3>📋 食客订单</h3>
        <span class="dim mono">当前 {{ orderList.length }}/3 · 食客约 25-45 分钟到访一次 · 订单 60 分钟有效</span>
      </div>
      <div v-if="orderList.length" class="order-list">
        <div v-for="o in orderList" :key="o.id" class="opp-row order-row">
          <span class="order-name">{{ o.name }}</span>
          <span class="order-dish">{{ getItem(o.itemId)?.name }} ×{{ o.qty }}</span>
          <span class="dim">赏金 <b class="mono" style="color: var(--gold)">{{ o.reward.toLocaleString() }}</b> 金</span>
          <span class="dim mono" :class="{ 'order-urgent': o.remainMin <= 10 }">⏳ {{ o.remainMin }} 分</span>
          <button class="btn btn-sm btn-primary" :disabled="!orderHave(o)" @click="deliverOrder(o)">
            {{ orderHave(o) ? '交付' : '料理不足' }}
          </button>
        </div>
      </div>
      <p v-else class="dim" style="margin-top: 4px">暂无食客订单——在菜单中挂上料理，食客会慕名而来；到访后交货可得金币并提升好感。</p>
    </div>

    <!-- 美食评论家（2026-09-09）：随机到访的高要求食客，满足给大奖 -->
    <div v-if="critic" class="card critic-card">
      <div class="decor-title-row">
        <h3>📝 美食评论家到访</h3>
        <span class="dim mono" :class="{ 'order-urgent': criticRemainMin <= 10 }">⏳ 还有 {{ criticRemainMin }} 分钟</span>
      </div>
      <div class="gather-card-row">
        <span><b>{{ critic.name }}</b> 想要一份 <b>tier ≥ {{ critic.minTier }}</b> 的 <b>{{ critic.category }}</b></span>
        <span class="dim">赏金 <b class="mono" style="color: var(--gold)">{{ critic.reward.toLocaleString() }}</b> 金 + 神秘调料 ×1 + 好感 +30</span>
      </div>
      <div v-if="criticCandidates.length" class="critic-row">
        <select v-model="criticPick" style="flex: 1; max-width: 320px">
          <option :value="null">选择一道符合要求的料理</option>
          <option v-for="c in criticCandidates" :key="c.id" :value="c.id">{{ c.item.name }}（tier {{ c.item.tier }}）×{{ c.qty }}</option>
        </select>
        <button class="btn btn-sm btn-primary" @click="serveCriticNow()">提交</button>
      </div>
      <p v-else class="dim" style="font-size: 12px">背包中没有符合要求的料理——去做一道 <b>tier ≥ {{ critic.minTier }}</b> 的{{ critic.category }}再来。</p>
    </div>

    <!-- 餐厅装饰（§13）已独立成页（2026-09-11）：这里只给状态与入口 -->
    <div class="card">
      <div class="decor-title-row">
        <h3>🏮 餐厅装潢（已购 {{ (player.restaurant.decor ?? []).length }}/{{ RESTAURANT_DECOR.length }}）</h3>
        <span class="dim mono">当前总加成 +{{ decorTotalBonus }}%</span>
        <button class="btn btn-sm btn-primary" style="margin-left: auto" @click="ui.setView('decor')">去装潢 ↗</button>
      </div>
      <p class="dim" style="margin: 0">
        装饰按类别选购，每件永久提升餐厅收入 %——分类进度、性价比排序与「下一件推荐」都在装潢页。
      </p>
    </div>
  </div>
</template>

<style scoped>
/* 餐厅头部右区排版（等级 / 当前收入 / 升级按钮 / 说明）——右对齐分块，取消拥挤参差 */
.restaurant-head-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  text-align: right;
}
.restaurant-head-right .xp-num { text-align: right; }
.restaurant-head-sub { margin: 0; text-align: right; }
.restaurant-head-note { margin: 0; text-align: right; line-height: 1.35; color: var(--muted); max-width: 100%; }
.restaurant-head-right .btn { margin-top: 2px; white-space: nowrap; }
/* 升级说明框：与其他页面一致的毛玻璃说明框 */
.restaurant-upgrade-box {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  background: rgba(255, 251, 244, 0.80);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 4px 12px rgba(150, 110, 70, 0.12);
}
.restaurant-upgrade-text { flex: 1; margin: 0; line-height: 1.4; color: var(--muted); }
/* 装饰标题行：标题 + 当前总加成 */
.decor-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.decor-title-row h3 { margin: 0; }
/* 装饰分类 tab */
.decor-cat-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.decor-cat-tabs .btn { white-space: nowrap; }
</style>
