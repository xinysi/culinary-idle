<script setup>
// 商队线（2026-09-14 新增）— 挂机产线：装载货物出海，按**归队时刻**的行情结算（可能赚也可能亏）。
// 与地窖（固定倍率）、交易所（手动买卖）的区别见 data/caravan.js 的说明。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { CARAVAN_UNLOCK_LEVEL, CARAVAN_CARGO_LIMIT, CARAVAN_LOSS_FLOOR, allCaravanRoutes, caravanRoute, nextCaravanExpandCost } from '../game/data/caravan.js'
import { getItem } from '../game/data/items.js'
import { getSkillDef } from '../game/data/skills.js'
import { exchangeCycleIndex, EXCHANGE_CYCLE_HOURS } from '../game/data/exchange.js'
import ProgressBar from '../components/ProgressBar.vue'
import ItemImg from '../components/ItemImg.vue'
import RelatedPages from '../components/RelatedPages.vue'
import StatusChip from '../components/StatusChip.vue'
import StatusChips from '../components/StatusChips.vue'

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'regions', label: '🌍 产地' },
  { view: 'exchange', label: '💹 交易所' },
  { view: 'expedition', label: '🚢 采集队' },
]

const unlocked = computed(() => player.caravanUnlocked())
const expandCost = computed(() => nextCaravanExpandCost(player.caravanSlots()))
const routes = computed(() => allCaravanRoutes())

/** 每槽的草稿：{ regionId, cargo } */
const draft = ref({})
function d(i) {
  if (!draft.value[i]) draft.value[i] = { regionId: null, cargo: {} }
  return draft.value[i]
}

const slots = computed(() => {
  ui.loopTick
  const now = Date.now()
  const st = player.caravanState()
  return Array.from({ length: player.caravanSlots() }, (_, i) => {
    const slot = st.slots[i] ?? null
    const route = slot ? caravanRoute(slot.regionId) : null
    const total = slot ? (slot.readyAt - slot.startedAt) : 0
    const elapsed = slot ? now - slot.startedAt : 0
    return {
      index: i,
      slot,
      route,
      progress: slot && total > 0 ? Math.min(1, elapsed / total) : 0,
      remainMs: slot ? Math.max(0, slot.readyAt - now) : 0,
      ready: !!slot && now >= slot.readyAt,
      cargoText: slot ? Object.entries(slot.cargo ?? {}).map(([id, q]) => `${getItem(id)?.name ?? id}×${q}`).join('、') : '',
    }
  })
})

/** 可选货表（既有货物类别 + 背包有货），按价值降序 */
const cargoPool = computed(() => {
  ui.loopTick
  return Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && player.caravanCargoOk(id))
    .map(([id, q]) => ({ id, q, item: getItem(id) }))
    .sort((a, b) => (b.item?.value ?? 0) - (a.item?.value ?? 0))
    .slice(0, 40)
})

const stats = computed(() => ({
  trips: player.stats?.caravanTrips ?? 0,
  gold: player.stats?.caravanGold ?? 0,
  cargo: player.stats?.caravanCargoValue ?? 0,
  best: player.stats?.caravanBestProfit ?? 0,
}))

function fmtMs(ms) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${s % 60} 秒`
  return `${s} 秒`
}
function cargoValue(cargo) {
  return player.caravanCargoValue(cargo)
}
function addCargo(i, id) {
  const dft = d(i)
  const v = getItem(id)?.value ?? 0
  const cur = cargoValue(dft.cargo)
  if (cur + v > CARAVAN_CARGO_LIMIT) {
    ui.pushLog(`本金上限 ${CARAVAN_CARGO_LIMIT.toLocaleString()} 金币，装不下了`, 'warn')
    return
  }
  dft.cargo[id] = (dft.cargo[id] ?? 0) + 1
}
function subCargo(i, id) {
  const dft = d(i)
  if (!dft.cargo[id]) return
  dft.cargo[id] -= 1
  if (dft.cargo[id] <= 0) delete dft.cargo[id]
}
function autoLoad(i) {
  d(i).cargo = player.caravanAutoLoad()
  ui.pushLog('已按价值从高到低自动装货', 'info')
}
function clearCargo(i) {
  d(i).cargo = {}
}
function start(i) {
  const dft = d(i)
  if (!dft.regionId) { ui.pushLog('请先选一条商路', 'warn'); return }
  const r = player.caravanStart(i, dft.regionId, dft.cargo)
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  draft.value[i] = { regionId: null, cargo: {} }
}
function claim(i) {
  const r = player.caravanClaim(i)
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  const sign = r.profit >= 0 ? '赚' : '亏'
  ui.pushLog(`🚚 商队归队：本金 ${r.value.toLocaleString()} → 回款 ${r.gold.toLocaleString()} 金币（${sign} ${Math.abs(Math.round(r.profit)).toLocaleString()}）`, r.profit >= 0 ? 'gain' : 'warn')
}
function recall(i) {
  const r = player.caravanRecall(i)
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  ui.pushLog('商队已返航，货物原样退回', 'info')
}
function expand() {
  const r = player.caravanExpand()
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🚚 商队线</h2>
        <p class="dim">
          装载一批货物，沿<b>已考察的产地</b>出海经商：归队时按<b>那一刻的行情</b>结算（每 {{ EXCHANGE_CYCLE_HOURS }} 小时轮换一期），
          行情好就赚、差就亏，最差保底 {{ Math.round(CARAVAN_LOSS_FLOOR * 100) }}% 回款；还会带回产地特产。
        </p>
      </div>
      <button v-if="unlocked && expandCost != null" class="btn btn-sm" @click="expand">
        🧱 扩建 +1 队（{{ expandCost.toLocaleString() }} 金币）
      </button>
    </header>

    <div v-if="!unlocked" class="card status-line">
      <span class="badge">🔒 未解锁</span>
      <span class="dim">需 {{ getSkillDef('spiceMixing')?.name ?? '调料调配' }} Lv{{ CARAVAN_UNLOCK_LEVEL }} 解锁商队线</span>
    </div>

    <template v-else>
      <StatusChips>
      <div class="status-chips-row">
        <StatusChip label="商队" tone="on">{{ player.caravanSlots() }} 支</StatusChip>
        <StatusChip label="出航"><b class="mono">{{ stats.trips.toLocaleString() }}</b> 次</StatusChip>
        <StatusChip label="累计本金"><b class="mono">{{ stats.cargo.toLocaleString() }}</b></StatusChip>
        <StatusChip label="回款"><b class="mono">{{ stats.gold.toLocaleString() }}</b> 金币</StatusChip>
        <StatusChip label="单次最佳" tone="good"><b class="mono">{{ stats.best > 0 ? '+' : '' }}{{ Math.round(stats.best).toLocaleString() }}</b></StatusChip>
      </div>
      </StatusChips>

      <div class="cv-grid">
        <div v-for="s in slots" :key="s.index" class="card cv-slot">
          <div class="cv-head">
            <strong>商队 {{ s.index + 1 }}</strong>
            <span v-if="s.route" class="dim mono" style="font-size: 12px">{{ s.route.icon }} {{ s.route.name }}</span>
          </div>

          <template v-if="s.slot">
            <div class="dim cv-sub">装载：{{ s.cargoText || '（空）' }}</div>
            <div class="dim cv-sub">本金 <b class="mono">{{ s.slot.cargoValue.toLocaleString() }}</b> 金币</div>
            <ProgressBar :progress="s.progress" />
            <div v-if="!s.ready" class="dim cv-sub mono">归队还有 {{ fmtMs(s.remainMs) }}</div>
            <div v-else class="cv-ready">✅ 已归队，等待结算</div>
            <div class="cv-actions">
              <button class="btn btn-sm btn-primary" :disabled="!s.ready" @click="claim(s.index)">归队结算</button>
              <button class="btn btn-sm" @click="recall(s.index)">撤回（退货运）</button>
            </div>
          </template>

          <template v-else>
            <select v-model="d(s.index).regionId" class="cv-select">
              <option :value="null">选择商路…</option>
              <option v-for="r in routes" :key="r.regionId" :value="r.regionId" :disabled="!player.regions?.[r.regionId]">
                {{ r.icon }} {{ r.name }}（{{ r.hours }}h · 系数 ×{{ r.coeff }}{{ r.inSeason ? ' · 当季' : '' }}）{{ player.regions?.[r.regionId] ? '' : ' 🔒未考察' }}
              </option>
            </select>
            <div class="dim cv-sub">
              本金 <b class="mono">{{ cargoValue(d(s.index).cargo).toLocaleString() }}</b> / {{ CARAVAN_CARGO_LIMIT.toLocaleString() }} 金币
            </div>
            <div class="cv-cargo">
              <div v-for="(q, id) in d(s.index).cargo" :key="id" class="cv-cargo-row">
                <ItemImg :item-id="id" size="sm" />
                <span class="cv-cargo-name">{{ getItem(id)?.name ?? id }}</span>
                <span class="mono dim">×{{ q }}</span>
                <button class="btn btn-sm cv-mini" @click="subCargo(s.index, id)">−</button>
              </div>
              <div v-if="!Object.keys(d(s.index).cargo).length" class="dim cv-sub">还没装货——从下面挑，或一键自动装。</div>
            </div>
            <div class="cv-actions">
              <button class="btn btn-sm" @click="autoLoad(s.index)">🪄 自动装货</button>
              <button class="btn btn-sm" @click="clearCargo(s.index)">清空</button>
            </div>
            <div class="cv-pool">
              <button v-for="c in cargoPool" :key="c.id" class="btn btn-sm cv-mini" @click="addCargo(s.index, c.id)">
                {{ c.item?.name ?? c.id }} ×{{ c.q }}<span class="dim">（{{ c.item?.value }}金）</span>
              </button>
              <span v-if="!cargoPool.length" class="dim cv-sub">背包里没有可当货的食材 / 料理 / 饮品 / 调料。</span>
            </div>
            <button class="btn btn-sm btn-primary" @click="start(s.index)">🚚 出发</button>
          </template>
        </div>
      </div>

      <div class="card" style="margin-top: 14px">
        <h3>🗺️ 商路一览（考察产地后开放）</h3>
        <p class="dim cv-sub">行情 = 交易所的确定性价格（每期 [0.60, 1.60]×）——**归队时刻**落在哪一期，就按那一期结算。</p>
        <table class="target-table">
          <tbody>
            <tr>
              <th class="dim">商路</th><th class="dim">耗时</th><th class="dim">系数</th><th class="dim">当季</th><th class="dim">特产池</th><th class="dim">状态</th>
            </tr>
            <tr v-for="r in routes" :key="r.regionId">
              <td>{{ r.icon }} {{ r.name }}</td>
              <td class="mono dim">{{ r.hours }} 小时</td>
              <td class="mono">×{{ r.coeff }}</td>
              <td class="dim">{{ r.inSeason ? '✅ ×1.1' : '—' }}</td>
              <td class="dim cv-sub">{{ r.box.map((id) => getItem(id)?.name ?? id).join('、') }}</td>
              <td class="dim">{{ player.regions?.[r.regionId] ? '已考察' : '🔒 未考察' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.cv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.cv-slot {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cv-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.cv-sub { font-size: 12px; line-height: 1.5; }
.cv-ready { font-size: 12px; color: var(--good-strong); }
.cv-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.cv-select {
  width: 100%;
  height: 32px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.cv-cargo { display: flex; flex-direction: column; gap: 4px; }
.cv-cargo-row { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.cv-cargo-name { flex: 1 1 auto; min-width: 0; }
.cv-mini { height: 24px; padding: 0 8px; font-size: 12px; }
.cv-pool { display: flex; flex-wrap: wrap; gap: 6px; max-height: 120px; overflow-y: auto; }
</style>
