<script setup>
// 外卖业务（2026-09-10 新增）— 餐厅第三条经营线：按小时消耗库存料理换金币。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { TAKEOUT_MAX_LEVEL, TAKEOUT_PRICE_MULT, takeoutConcurrency, takeoutUpgradeCost } from '../game/data/takeout.js'
import { getItem } from '../game/data/items.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()

const level = computed(() => player.takeoutLevel())
const nextCost = computed(() => player.takeoutNextCost())
const st = computed(() => player.takeout ?? {})
const conc = computed(() => takeoutConcurrency(level.value))
const expProgress = computed(() => {
  if (level.value >= TAKEOUT_MAX_LEVEL) return 1
  return ((st.value.exp ?? 0) % 50) / 50
})

/** 菜单料理的可外送库存与单价预览（单价走 takeoutPriceOf，与结算含套餐加成一致） */
const menuStock = computed(() =>
  (player.restaurant?.menu ?? [])
    .filter((id) => !!getItem(id))
    .map((id) => ({ id, it: getItem(id), qty: player.inventory[id] ?? 0, price: player.takeoutPriceOf(id) }))
)

// 等级阶梯（2026-09-10 补）：每一级的并发 / 单价系数 / 升级花费 / 累计单量门槛
const ladder = computed(() =>
  Array.from({ length: TAKEOUT_MAX_LEVEL }, (_, i) => {
    const lv = i + 1
    const cost = takeoutUpgradeCost(lv)
    return {
      level: lv,
      conc: takeoutConcurrency(lv),
      mult: TAKEOUT_PRICE_MULT * (1 + 0.1 * (lv - 1)),
      cost,
      needOrders: (lv - 1) * 50,
      current: lv === level.value,
      reached: lv <= level.value,
    }
  })
)

// 当前每小时的理论收入（按菜单里有货的料理均价 × 并发）
const hourlyEstimate = computed(() => {
  const stocked = menuStock.value.filter((m) => m.qty > 0)
  if (!stocked.length) return { perOrder: 0, hour: 0, count: 0 }
  const avg = Math.round(stocked.reduce((a, m) => a + m.price, 0) / stocked.length)
  // 并发单量 × 均价：实际受库存限制，这里给「库存充足时」的上限
  return { perOrder: avg, hour: avg * conc.value, count: stocked.length }
})
// 当前库存能支撑多少单（菜单料理库存合计）
const stockTotal = computed(() => menuStock.value.reduce((a, m) => a + m.qty, 0))
const stockHours = computed(() => (conc.value > 0 ? Math.floor(stockTotal.value / conc.value) : 0))

function upgrade() {
  const r = player.takeoutUpgrade()
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'restaurant', label: '🏮 餐厅' }, { view: 'setMeals', label: '🍱 套餐定食' }, { view: 'banquet', label: '🍽 宴会' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🚚 外卖业务</h2>
        <p class="dim">
          与堂食、分店并列的第三条经营线：<b>每小时按等级并发 {{ conc }} 单</b>，每单消耗 1 份菜单里的料理，
          按「价值 + 回血×0.5」× {{ TAKEOUT_PRICE_MULT }} ×（1 + 10%×(等级-1)）结算金币——<b>有存货才成交</b>，逼你多备货。
        </p>
      </div>
      <button v-if="nextCost != null" class="btn btn-sm" :class="player.gold >= nextCost ? 'btn-primary' : ''" :disabled="player.gold < nextCost" @click="upgrade">
        升级到 Lv{{ level + 1 }}（{{ nextCost.toLocaleString() }} 金币）
      </button>
    </header>

    <div class="card status-line">
      <span class="badge badge-on">外卖 Lv{{ level }} / {{ TAKEOUT_MAX_LEVEL }}</span>
      <span class="dim">每小时并发 <b class="mono">{{ conc }}</b> 单 · 累计接单 <b class="mono">{{ (st.exp ?? 0).toLocaleString() }}</b> · 流水 <b class="mono">{{ (st.gold ?? 0).toLocaleString() }}</b> 金币</span>
    </div>

    <div class="card">
      <div class="dim" style="margin-bottom: 6px">距离下一级（每完成 50 单升 1 级）</div>
      <ProgressBar :progress="expProgress" />
      <div class="dim" style="font-size: 12px; margin-top: 6px">
        <template v-if="level >= TAKEOUT_MAX_LEVEL">已满级（{{ (st.exp ?? 0) % 50 }} / 50）</template>
        <template v-else>{{ (st.exp ?? 0) % 50 }} / 50 单</template>
      </div>
    </div>

    <!-- 收入预估（2026-09-10 补） -->
    <div class="card to-est">
      <div class="to-est-main">
        <div class="to-est-num">{{ hourlyEstimate.hour.toLocaleString() }}</div>
        <div class="dim to-est-label">金币 / 小时（库存充足时的上限）</div>
        <div class="dim to-est-sub">
          并发 {{ conc }} 单 × 均价 {{ hourlyEstimate.perOrder.toLocaleString() }} 金币<template v-if="player.setMealBonus() > 0">（已含套餐加成）</template>
        </div>
      </div>
      <div class="to-est-side">
        <div class="dim to-est-sub">菜单可外送料理 <b class="mono">{{ hourlyEstimate.count }}</b> 种 · 库存合计 <b class="mono">{{ stockTotal.toLocaleString() }}</b> 份</div>
        <div class="dim to-est-sub">按当前并发，库存还够送 <b class="mono">{{ stockHours }}</b> 小时</div>
        <div v-if="stockTotal <= 0" class="to-est-warn">⚠️ 菜单料理已缺货——外卖这一小时不会成交，去补货或做菜。</div>
      </div>
    </div>

    <!-- 等级阶梯（2026-09-10 补）：升到下一级值不值，一眼看清 -->
    <h3 style="margin-top: 14px">等级阶梯</h3>
    <div class="card">
      <table class="target-table">
        <thead>
          <tr>
            <th>等级</th>
            <th>每小时并发</th>
            <th>单价系数</th>
            <th>累计单量门槛</th>
            <th>升级花费</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in ladder" :key="l.level" :class="{ 'to-lv-cur': l.current }">
            <td>
              Lv{{ l.level }}
              <span v-if="l.current" class="badge badge-on">当前</span>
              <span v-else-if="l.reached" class="dim">✓</span>
            </td>
            <td class="mono">{{ l.conc }} 单</td>
            <td class="mono">×{{ l.mult.toFixed(2) }}</td>
            <td class="dim mono">{{ l.needOrders }} 单</td>
            <td class="mono">
              <template v-if="l.cost == null">—（初始等级）</template>
              <template v-else>{{ l.cost.toLocaleString() }}</template>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="dim to-est-sub" style="margin-top: 8px">
        升级有新单量加成，但主要靠<b>自然成长</b>：每累计完成 50 单自动升 1 级，花钱只是提前跳级。
      </p>
    </div>

    <h3 style="margin-top: 14px">菜单备货（外卖只会卖菜单里的料理）</h3>
    <div class="card">
      <table class="target-table">
        <tbody>
          <tr v-for="m in menuStock" :key="m.id">
            <td>{{ m.it.name }}</td>
            <td class="dim mono" style="width: 110px">库存 {{ m.qty }}</td>
            <td class="dim mono" style="width: 130px">外卖单价 {{ m.price }}</td>
            <td class="dim" style="width: 120px" :class="{ 'to-empty': m.qty <= 0 }">
              {{ m.qty > 0 ? '可接单' : '缺货' }}
            </td>
          </tr>
          <tr v-if="!menuStock.length"><td colspan="4" class="dim">菜单还是空的——去「餐厅」把料理挂上菜单，外卖才有得卖。</td></tr>
        </tbody>
      </table>
    </div>

    <p class="dim" style="margin-top: 10px">
      提示：外卖按整点结算（离线期间照常累计，每 60 分钟一批）；菜单空时会退而卖背包里价值最高的料理。
    </p>
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.to-empty {
  color: var(--warn-strong);
}
/* 收入预估 + 等级阶梯（2026-09-10 补） */
.to-est {
  margin-top: 12px;
  padding: 12px 14px;
  display: flex;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
}
.to-est-main {
  min-width: 190px;
}
.to-est-num {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--accent, #d95a38);
}
.to-est-label {
  font-size: 12px;
}
.to-est-side {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.to-est-sub {
  font-size: 12px;
  line-height: 1.6;
}
.to-est-warn {
  font-size: 12px;
  color: var(--warn-strong, #bf7200);
}
.to-lv-cur {
  background: var(--bg-soft);
}
</style>
