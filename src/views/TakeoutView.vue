<script setup>
// 外卖业务（2026-09-10 新增）— 餐厅第三条经营线：按小时消耗库存料理换金币。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { TAKEOUT_MAX_LEVEL, TAKEOUT_PRICE_MULT, takeoutConcurrency, takeoutPrice } from '../game/data/takeout.js'
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

/** 菜单料理的可外送库存与单价预览 */
const menuStock = computed(() =>
  (player.restaurant?.menu ?? [])
    .filter((id) => !!getItem(id))
    .map((id) => ({ id, it: getItem(id), qty: player.inventory[id] ?? 0, price: takeoutPrice(getItem(id), level.value) }))
)

function upgrade() {
  const r = player.takeoutUpgrade()
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
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
  </div>
</template>

<style scoped>
.to-empty {
  color: var(--warn-strong);
}
</style>
