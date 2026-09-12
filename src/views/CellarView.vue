<script setup>
// 地窖陈酿（2026-09-10 新增）— 时间型放置线：酒类/腌制品入窖，按档位成熟后领金币。
// 与远行采集队同模型（时间戳驱动、离线照常计时），撤回可无损取回原物。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { CELLAR_TIERS, CELLAR_MAX_QTY, CELLAR_MAX_BASE_VALUE, CELLAR_UNLOCK_LEVEL, CELLAR_BASE_SLOTS, CELLAR_MAX_SLOTS, CELLAR_EXPAND_COSTS, nextCellarExpandCost } from '../game/data/cellar.js'
import { getItem } from '../game/data/items.js'
import { getSkillDef } from '../game/data/skills.js'
import ProgressBar from '../components/ProgressBar.vue'
import ItemImg from '../components/ItemImg.vue'

const player = usePlayerStore()
const ui = useUiStore()

const draft = ref({}) // { [slotIndex]: { itemId, qty, hours } }
function d(index) {
  if (!draft.value[index]) draft.value[index] = { itemId: '', qty: 10, hours: CELLAR_TIERS[0].hours }
  return draft.value[index]
}

/** 背包里可陈酿的物品（酒类/腌制品），按价值降序 */
const ageable = computed(() =>
  Object.keys(player.inventory ?? {})
    .filter((id) => (player.inventory[id] ?? 0) > 0 && player.isAgeable(id))
    .map((id) => ({ id, it: getItem(id), qty: player.inventory[id] }))
    .sort((a, b) => (b.it?.value ?? 0) - (a.it?.value ?? 0))
)

const slots = computed(() => {
  ui.loopTick
  const now = Date.now()
  const st = player.cellarState()
  const total = player.cellarSlots()
  return Array.from({ length: total }, (_, i) => {
    const s = st.slots[i] ?? null
    const totalMs = (s?.hours ?? 0) * 3600_000
    return {
      index: i,
      state: s,
      ready: !!s && now >= s.readyAt,
      remainMs: s ? Math.max(0, s.readyAt - now) : 0,
      progress: s ? Math.min(1, (now - s.startedAt) / totalMs) : 0,
      payout: s ? Math.max(1, Math.round(s.baseValue * s.mult)) : 0,
    }
  })
})

const unlocked = computed(() => player.cellarUnlocked())
const expandCost = computed(() => nextCellarExpandCost(player.cellarSlots()))
const stats = computed(() => ({ rounds: player.stats?.cellarRounds ?? 0, gold: player.stats?.cellarGold ?? 0 }))

function fmtMs(ms) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${s % 60} 秒`
  return `${s} 秒`
}

function put(index) {
  const dd = d(index)
  const r = player.cellarPut(index, dd.itemId, dd.qty, dd.hours)
  if (!r.ok) ui.pushLog(r.msg, 'warn')
  else ui.pushLog('🍶 已入窖，到期后回来领取', 'info')
}
function claim(index) {
  const r = player.cellarClaim(index)
  if (!r) ui.pushLog('尚未成熟', 'warn')
}
function takeBack(index) {
  if (player.cellarTakeBack(index)) ui.pushLog('已取回原物（无损）', 'info')
}
function expand() {
  const r = player.cellarExpand()
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function maxQtyFor(itemId) {
  const it = getItem(itemId)
  if (!it?.value) return 0
  return Math.min(CELLAR_MAX_QTY, Math.floor(CELLAR_MAX_BASE_VALUE / it.value), player.inventory[itemId] ?? 0)
}
// ── 档位对照表（2026-09-12 补）：把「时长 × 倍率」的三个档位换成可比口径 ──
// 关键结论：**倍率/时长（折算时收）随档位变长而下降**——12h 档时收最高、48h 档最低，
// 所以长档不是「更划算」而是「更省心」（少上线几次）。表里同时给单槽满额出窖，便于横向比较。
const tierRows = computed(() =>
  CELLAR_TIERS.map((t) => ({
    ...t,
    perHour: t.mult / t.hours, // 每小时的倍率（越大越赚）
    maxPayout: Math.round(CELLAR_MAX_BASE_VALUE * t.mult),
  }))
)
const bestPerHour = computed(() => Math.max(...tierRows.value.map((r) => r.perHour)))
// 扩建阶梯：3 格（初始）→ 6 格 → 9 格，费用逐档递增
const expandLadder = computed(() => {
  const rows = [{ slots: CELLAR_BASE_SLOTS, cost: null }]
  CELLAR_EXPAND_COSTS.forEach((cost, i) => rows.push({ slots: CELLAR_BASE_SLOTS + (i + 1) * 3, cost }))
  return rows
})
import FoldCard from '../components/FoldCard.vue'
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'exchange', label: '💹 交易所' }, { view: 'restaurant', label: '🏮 餐厅' }, { view: 'automation', label: '🤖 自动化' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🍶 地窖陈酿</h2>
        <p class="dim">
          把<b>酒类 / 腌制品</b>放入地窖，按档位成熟后出窖换金币（价值 × 倍率，离线照常计时）；
          未成熟也可无损取回。单槽上限 {{ CELLAR_MAX_QTY }} 件、价值上限 {{ CELLAR_MAX_BASE_VALUE.toLocaleString() }}。
        </p>
      </div>
      <button v-if="unlocked && expandCost != null" class="btn btn-sm" @click="expand">
        🧱 扩建 +3 格（{{ expandCost.toLocaleString() }} 金币）
      </button>
    </header>


      <FoldCard
        title="📋 陈酿档位对照表"
        hint="折算时收 12h 0.125/时 > 24h 0.083 > 48h 0.063 —— 越长的档位每小时越低"
      >
        <div class="table-scroll">
        <table class="target-table">
          <thead>
            <tr><th>档位</th><th>成熟时长</th><th>价值倍率</th><th>折算时收</th><th>单槽满额出窖</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in tierRows" :key="t.hours">
              <td class="mono">{{ t.hours }}h</td>
              <td class="mono">{{ t.hours }} 小时</td>
              <td class="mono">×{{ t.mult }}</td>
              <td class="mono" :class="{ 'mastery-hl': t.perHour === bestPerHour }">
                {{ t.perHour.toFixed(3) }}/时<template v-if="t.perHour === bestPerHour"> ← 时收最高</template>
              </td>
              <td class="mono">{{ t.maxPayout.toLocaleString() }} 金币</td>
            </tr>
          </tbody>
        </table>
        </div>
        <p class="dim" style="margin: 8px 0 0; font-size: 12px; line-height: 1.6">
          折算时收 = 倍率 ÷ 时长，所以<b>越长的档位每小时收益越低</b>：12h 档是 48h 档的两倍时收，适合常上线的玩家；
          48h 档总收益更高、只要每天照看一次，适合睡前挂。单槽满额出窖按「价值上限 {{ CELLAR_MAX_BASE_VALUE.toLocaleString() }}」× 倍率估算。
        </p>
        <div class="dim" style="margin-top: 6px; font-size: 12px">
          扩建阶梯：<span v-for="(e, i) in expandLadder" :key="e.slots">
            <template v-if="i"> → </template>
            <b class="mono">{{ e.slots }}</b> 格<template v-if="e.cost">（{{ e.cost.toLocaleString() }} 金币）</template><template v-else>（初始）</template>
          </span>
          （上限 {{ CELLAR_MAX_SLOTS }} 格）
        </div>
      </FoldCard>

    <div v-if="!unlocked" class="card status-line">
      <span class="badge">🔒 未解锁</span>
      <span class="dim">需 {{ getSkillDef('brewing')?.name ?? '调酒' }} Lv{{ CELLAR_UNLOCK_LEVEL }} 解锁地窖</span>
    </div>

    <template v-else>
      <div class="card status-line">
        <span class="badge badge-on">槽位 {{ player.cellarSlots() }} 格</span>
        <span class="dim">累计出窖 <b class="mono">{{ stats.rounds }}</b> 次 · 累计金币 <b class="mono">{{ stats.gold.toLocaleString() }}</b></span>
        <span class="dim">档位：12h ×1.5 / 24h ×2 / 48h ×3 / 96h ×4</span>
      </div>

      <!-- 档位对照表（2026-09-12 补） -->

      <div class="cellar-grid">
        <div v-for="s in slots" :key="s.index" class="card cellar-slot">
          <div class="cellar-head">
            <strong>槽位 {{ s.index + 1 }}</strong>
            <span v-if="s.state" class="dim mono" style="font-size: 12px">{{ s.state.hours }}h ×{{ s.state.mult }}</span>
          </div>

          <template v-if="s.state">
            <div class="cellar-item">
              <ItemImg :item-id="s.state.itemId" size="sm" />
              <span>{{ getItem(s.state.itemId)?.name }} ×{{ s.state.qty }}</span>
            </div>
            <ProgressBar :progress="s.progress" />
            <div class="dim cellar-sub mono">
              <template v-if="s.ready">✅ 已成熟 · 可出窖 <b>+{{ s.payout.toLocaleString() }}</b> 金币</template>
              <template v-else>剩余 {{ fmtMs(s.remainMs) }} · 预计 +{{ s.payout.toLocaleString() }} 金币</template>
            </div>
            <div class="cellar-actions">
              <button class="btn btn-sm btn-primary" :disabled="!s.ready" @click="claim(s.index)">出窖领取</button>
              <button class="btn btn-sm" @click="takeBack(s.index)">取回原物</button>
            </div>
          </template>

          <template v-else>
            <select v-model="d(s.index).itemId" class="cellar-select">
              <option value="">选择酒类/腌制品…</option>
              <option v-for="a in ageable" :key="a.id" :value="a.id">{{ a.it?.name }}（存 {{ a.qty }} · 单价 {{ a.it?.value }}）</option>
            </select>
            <div class="cellar-actions">
              <input v-model.number="d(s.index).qty" type="number" min="1" :max="CELLAR_MAX_QTY" class="cellar-qty" />
              <select v-model.number="d(s.index).hours" class="cellar-select cellar-tier">
                <option v-for="t in CELLAR_TIERS" :key="t.hours" :value="t.hours">{{ t.hours }}h ×{{ t.mult }}</option>
              </select>
              <button class="btn btn-sm btn-primary" :disabled="!d(s.index).itemId" @click="put(s.index)">入窖</button>
            </div>
            <div v-if="d(s.index).itemId" class="dim cellar-sub">
              可放最多 {{ maxQtyFor(d(s.index).itemId) }} 件 · 预计出窖 +{{ Math.round((getItem(d(s.index).itemId)?.value ?? 0) * Math.min(d(s.index).qty || 0, maxQtyFor(d(s.index).itemId)) * (CELLAR_TIERS.find((t) => t.hours === d(s.index).hours)?.mult ?? 1)).toLocaleString() }} 金币
            </div>
            <div v-else class="dim cellar-sub">背包暂无可陈酿物品（酿酒 / 腌制产出）</div>
          </template>
        </div>
      </div>
    </template>
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.cellar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.cellar-slot {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cellar-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.cellar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.cellar-sub {
  font-size: 12px;
  line-height: 1.5;
}
.cellar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cellar-select {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.cellar-tier {
  flex: 0 0 auto;
}
.cellar-qty {
  width: 72px;
  height: 32px;
  padding: 0 8px;
  font-size: 12px;
  text-align: center;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
}
</style>
