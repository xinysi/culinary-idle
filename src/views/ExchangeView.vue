<script setup>
// 交易所（2026-09-10 新增）— 动态价格：每 4 小时轮换 6 种货物，买低卖高（每日每件限 60）。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { EXCHANGE_UNLOCK_LEVEL, EXCHANGE_CYCLE_HOURS, EXCHANGE_DAILY_LIMIT, exchangeCycleIndex, pickGoods, sellPriceOf, buyPriceOf } from '../game/data/exchange.js'
import { getSkillDef } from '../game/data/skills.js'
import { getItem, ITEMS } from '../game/data/items.js'
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
// 期号是「从 1970 年起的 4 小时时间槽编号」（全局统一、保证无服务器也能同时同价），对玩家没意义，
// 所以展示层换成「今天的第几期 + 该期时段」，原始编号只留在 title 里供排查。
function slotInfoFor(cycleIndex) {
  const start = new Date(cycleIndex * EXCHANGE_CYCLE_HOURS * 3600_000)
  const h = start.getHours()
  const pad = (n) => String(n).padStart(2, '0')
  return {
    dayLabel: `${start.getMonth() + 1}/${start.getDate()}`,
    slot: Math.floor(h / EXCHANGE_CYCLE_HOURS) + 1, // 本日第几期（每天 24÷4＝6 期）
    range: `${pad(h)}:00–${pad((h + EXCHANGE_CYCLE_HOURS) % 24)}:00`,
    today: `${new Date().getMonth() + 1}/${new Date().getDate()}`,
  }
}
const cycleWindow = computed(() => slotInfoFor(cycle.value))
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
/** 行情标记：这里的「高/低」指的是**收购价**（你卖出时到手的那笔），不是买入价。
 *  所以高价 = 宜卖出、低价 = 宜买入；文案直接写动作，避免玩家把它读成「买入变贵了」。
 *  另注：买入价恒为收购价 × 1.35，所以「收购价低」同时也是「买入便宜」。 */
function mood(g) {
  const ratio = g.sell / (g.item.value || 1)
  const pct = `${ratio >= 1 ? '+' : ''}${Math.round((ratio - 1) * 100)}%`
  if (ratio >= 1.3) return { text: `📈 收购价 ${pct} · 宜卖出`, cls: 'mood-high' }
  if (ratio <= 0.8) return { text: `📉 收购价 ${pct} · 宜买入`, cls: 'mood-low' }
  return { text: `➖ 平价 ${pct}`, cls: '' }
}
// ── 未来三期货单（纯推算展示：货单与价格都是「期号」的确定性函数，只读交换模块的既有导数）──
const UPCOMING_PERIODS = 3
const upcoming = computed(() => {
  if (!unlocked.value) return []
  const now = Date.now()
  const cur = new Map(goods.value.map((g) => [g.item.id, g.sell]))
  const out = []
  for (let k = 1; k <= UPCOMING_PERIODS; k++) {
    const c = cycle.value + k
    const at = c * EXCHANGE_CYCLE_HOURS * 3600_000
    out.push({
      cycle: c,
      label: ['下一期', '下下期', '第 3 期'][k - 1] ?? `第 ${k} 期`,
      ...slotInfoFor(c),
      at,
      inMs: at - now,
      rows: pickGoods(ITEMS, c).map((it) => {
        const sell = sellPriceOf(it, c)
        const ref = cur.get(it.id) // 本期同货的收购价（若本期也有）
        return {
          item: it,
          sell,
          buy: buyPriceOf(it, c),
          base: it.value ?? 1,
          vsNow: ref ? sell / ref - 1 : null,
        }
      }),
    })
  }
  return out
})
function pct(v) { return `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%` }
function trendOf(row) {
  const r = row.vsNow != null ? row.vsNow : row.sell / row.base - 1
  if (r >= 0.15) return { text: `📈 ${row.vsNow != null ? '较本期 ' : '较基准 '}${pct(r)}`, cls: 'mood-high' }
  if (r <= -0.15) return { text: `📉 ${row.vsNow != null ? '较本期 ' : '较基准 '}${pct(r)}`, cls: 'mood-low' }
  return { text: `➖ ${row.vsNow != null ? '较本期 ' : '较基准 '}${pct(r)}`, cls: '' }
}
// ── 今日成交（玩家自己的额度流水；数据来自 exchange.traded，按天重置）──
const todayTrades = computed(() => {
  // 逐件走 exchangeTradedToday()：它自带「跨天重置」，避免把昨天的成交额算进今天（与 exchangeGoods 同口径）
  return Object.keys(player.exchange?.traded ?? {})
    .map((id) => ({ id, item: getItem(id), n: player.exchangeTradedToday(id) }))
    .filter((x) => x.n > 0)
    .map((x) => ({ ...x, remain: Math.max(0, EXCHANGE_DAILY_LIMIT - x.n) }))
    .sort((a, b) => b.n - a.n)
})
function sell(g) {
  const r = player.exchangeSell(g.item.id, q(g.item.id))
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function buy(g) {
  const r = player.exchangeBuy(g.item.id, q(g.item.id))
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'shop', label: '🛒 商店' }, { view: 'suppliers', label: '🤝 供应商' }, { view: 'rivals', label: '🏪 同业榜' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>💹 交易所</h2>
        <p class="dim">
          行情每 <b>{{ EXCHANGE_CYCLE_HOURS }} 小时</b>轮换一批货物。两个价要分清：
          <b>收购价</b>＝你<b>卖出</b>时到手的金币（随行情在基准价值的 0.6~1.6 倍浮动）；
          <b>买入价</b>＝你<b>买入</b>时付出的金币（恒为当期货收购价的 1.35 倍）。
          所以<b>收购价高就卖、收购价低就囤</b>，每日每件限成交 {{ EXCHANGE_DAILY_LIMIT }} 件。
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
        <span class="badge badge-on" :title="`内部期号 ${cycle}（自 1970 年起的 ${EXCHANGE_CYCLE_HOURS} 小时时间槽，全局统一）`">
          {{ cycleWindow.dayLabel }} 第 {{ cycleWindow.slot }} 期（{{ cycleWindow.range }}）
        </span>
        <span class="dim">累计成交 <b class="mono">{{ stats.trades.toLocaleString() }}</b> 件 · 累计流水 <b class="mono">{{ stats.gold.toLocaleString() }}</b> 金币</span>
        <span class="dim">📈 收购价高 → 宜卖出 · 📉 收购价低 → 宜买入</span>
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
            <div class="ex-price"><span class="dim">收购价 · 卖到手</span><span class="mono gold">{{ g.sell.toLocaleString() }}</span></div>
            <div class="ex-price"><span class="dim">买入价 · 买付出</span><span class="mono">{{ g.buy.toLocaleString() }}</span></div>
          </div>

          <div class="ex-actions">
            <input v-model.number="qty[g.item.id]" type="number" min="1" :max="EXCHANGE_DAILY_LIMIT" class="ex-input" />
            <button class="btn btn-sm btn-primary" :disabled="g.remain <= 0 || g.own <= 0" @click="sell(g)">卖出</button>
            <button class="btn btn-sm" :disabled="g.remain <= 0" @click="buy(g)">买入</button>
          </div>
          <div class="dim ex-sub">今日剩余额度 {{ g.remain }} / {{ EXCHANGE_DAILY_LIMIT }}</div>
        </div>
      </div>

      <!-- 未来三期货单（2026-09-12 补）：货单与价格都是期号的确定性函数，可提前看到该囤什么 / 该等什么 -->
      <div class="card ex-upcoming">
        <h3>🔮 未来三期货单 <span class="dim" style="font-weight: 400; font-size: 12px">每期 {{ EXCHANGE_CYCLE_HOURS }} 小时 · 价格按「期号」确定性推算，不会变</span></h3>
        <div class="ex-periods">
          <div v-for="p in upcoming" :key="p.cycle" class="ex-period">
            <div class="ex-period-head">
              <strong>{{ p.label }}</strong>
              <span class="dim mono">{{ p.range }} · {{ fmtMs(p.inMs) }}后</span>
            </div>
            <ul class="ex-period-list">
              <li v-for="row in p.rows" :key="row.item.id">
                <span class="ex-period-name">{{ row.item.name }}</span>
                <span class="mono gold">{{ row.sell.toLocaleString() }}</span>
                <span class="dim" :class="trendOf(row).cls">{{ trendOf(row).text }}</span>
              </li>
            </ul>
          </div>
        </div>
        <p class="dim ex-note">
          每行第一个数是那期的<b>收购价</b>（你卖出能拿到的金币）；「较本期」是与本期同件货的收购价对比。
          同一件货在低价期囤、高价期出，是这套行情的核心玩法（买卖价差 35%，每日每件限 {{ EXCHANGE_DAILY_LIMIT }} 件）。
        </p>
      </div>

      <!-- 今日成交（2026-09-12 补）：额度流水，避免「还能卖多少」要一件件点开看 -->
      <div class="card ex-today">
        <h3>🧾 今日成交 <span class="dim" style="font-weight: 400; font-size: 12px">每件上限 {{ EXCHANGE_DAILY_LIMIT }} 件 · 跨天重置</span></h3>
        <p v-if="!todayTrades.length" class="dim" style="margin: 4px 0 0">今天还没成交。行情每期都换，看到高价再出手就行。</p>
        <ul v-else class="ex-today-list">
          <li v-for="t in todayTrades" :key="t.id">
            <ItemImg :item-id="t.id" size="sm" />
            <span class="ex-today-name">{{ t.item?.name ?? t.id }}</span>
            <span class="mono">{{ t.n }} 件</span>
            <span class="dim">剩余额度 {{ t.remain }} / {{ EXCHANGE_DAILY_LIMIT }}</span>
          </li>
        </ul>
      </div>
    </template>
    <RelatedPages :links="RELATED" />
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
  font-size: 12px;
  white-space: nowrap;
}
.mood-high {
  color: var(--good-strong);
}
.mood-low {
  color: var(--info);
}
.ex-sub {
  font-size: 12px;
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
/* 未来三期货单 / 今日成交（2026-09-12 补） */
.ex-upcoming,
.ex-today {
  margin-top: 12px;
  padding: 12px 14px;
}
.ex-periods {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px;
  margin-top: 8px;
}
.ex-period {
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 8px 10px;
}
.ex-period-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 4px;
}
.ex-period-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
}
.ex-period-list li {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.ex-period-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ex-note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
}
.ex-today-list {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}
.ex-today-list li {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ex-today-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
