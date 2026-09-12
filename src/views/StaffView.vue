<script setup>
// 雇工班底（2026-09-10 新增）— 金币雇工，每小时发工资换餐厅经营加成（欠薪自动停工）。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { STAFF, STAFF_MAX_LEVEL, staffCost, staffWage } from '../game/data/staff.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()

/** 在岗且提供「餐厅收入%」的岗位加成合计（掌勺 + 采买；跑堂加的是订单奖励，单列） */
const incomeRolesPct = computed(() =>
  STAFF.filter((d) => player.staffActive(d.id) && /收入/.test(d.desc)).reduce((a, d) => a + (player.staffLevelOf(d.id) ?? 0) * d.per, 0)
)
/** 当前餐厅时收（已含雇工加成） */
const restaurantHourly = computed(() => Math.round(player.restaurantHourlyIncome))
/** 雇工带来的收入增量总量（从时收里反解出加成那一段） */
const staffGainTotal = computed(() => {
  const pct = incomeRolesPct.value
  if (pct <= 0) return 0
  return Math.round(restaurantHourly.value * (pct / (100 + pct)))
})

// ── 岗位横比（2026-09-12 补）──
// 净赚门槛推导：Lv n 时 收益增量 = 收入基数 × per%×n/100，工资 = wage×n
//   → 净赚 ⟺ 收入基数 ≥ wage×100/per（与 n 无关，所以门槛是常数）。
// 另注：跑堂的加成作用于「食客订单奖励」、掌勺/采买作用于「餐厅时收」，门槛口径不同。
const compare = computed(() =>
  STAFF.map((def) => ({
    ...def,
    target: def.id === 'waiter' ? '食客订单奖励' : '餐厅收入',
    threshold: Math.round((def.wage * 100) / def.per),
  }))
)

const rows = computed(() =>
  STAFF.map((def) => {
    const st = player.staffState(def.id)
    const level = st?.level ?? 0
    const active = player.staffActive(def.id)
    const nextLevel = Math.min(STAFF_MAX_LEVEL, level + 1)
    const cost = staffCost(nextLevel)
    const perkNow = level * def.per
    const isIncome = /收入/.test(def.desc)
    // 该岗位分摊到的收入增量（按加成占比），跑堂另算订单奖励
    const gain = active && isIncome && incomeRolesPct.value > 0
      ? Math.round((staffGainTotal.value * perkNow) / incomeRolesPct.value)
      : 0
    const wage = staffWage(def, level)
    // 等级阶梯：每级的加成 / 时薪 / 雇佣累计花费
    const ladder = Array.from({ length: STAFF_MAX_LEVEL }, (_, i) => {
      const lv = i + 1
      return {
        level: lv,
        perk: lv * def.per,
        wage: staffWage(def, lv),
        cost: staffCost(lv).gold,
        current: lv === level,
        reached: lv <= level,
      }
    })
    return {
      def,
      level,
      active,
      unpaid: !!st?.unpaid,
      maxed: level >= STAFF_MAX_LEVEL,
      nextLevel,
      cost,
      wage,
      canPay: player.gold >= cost.gold,
      perkNow,
      isIncome,
      gain,
      // 净收益：收入增量 - 时薪（仅收入型岗位有意义）
      net: isIncome && active ? gain - wage : null,
      ladder,
    }
  })
)
/** 收支平衡点：收入型岗位的净收益合计 */
const netAll = computed(() => rows.value.reduce((a, r) => a + (r.net ?? 0), 0))

const wagePerHour = computed(() => player.staffWagePerHour())
const incomePct = computed(() => player.staffIncomePct())
const orderPct = computed(() => player.staffOrderPct())
const wagesPaid = computed(() => player.stats?.staffWages ?? 0)

function hire(r) {
  const res = player.staffHire(r.def.id)
  if (!res.ok) ui.pushLog(res.msg, 'warn')
}
function fire(r) {
  if (player.staffFire(r.def.id)) ui.pushLog(`已解雇${r.def.name}`, 'warn')
}
import FoldCard from '../components/FoldCard.vue'
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'restaurant', label: '🏮 餐厅' }, { view: 'michelin', label: '⭐ 评级' }, { view: 'rivals', label: '🏪 同业榜' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>👨‍🍳 雇工班底</h2>
        <p class="dim">
          三种岗位各 5 级：雇佣一次性花费金币，此后<b>每小时发一次工资</b>；金币不足会自动欠薪停工，补足后自动复岗。
          在岗加成：餐厅收入 +{{ incomePct }}%、食客订单奖励 +{{ orderPct }}%。
        </p>
      </div>
      <span v-if="wagePerHour" class="dim mono">时薪合计 {{ wagePerHour.toLocaleString() }} 金币</span>
    </header>


    <FoldCard
      title="📋 岗位横比"
      hint="净赚门槛＝时薪÷加成比例：掌勺 2,750/时、采买 1,500/时、跑堂 1,300"
    >
      <div class="table-scroll">
        <table class="target-table">
          <thead>
            <tr><th>岗位</th><th>加成对象</th><th>每级</th><th>Lv{{ STAFF_MAX_LEVEL }} 合计</th><th>Lv{{ STAFF_MAX_LEVEL }} 时薪</th><th>净赚门槛</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in compare" :key="c.id">
              <td>{{ c.icon }} {{ c.name }}</td>
              <td class="dim">{{ c.target }}</td>
              <td class="mono">+{{ c.per }}%</td>
              <td class="mono">+{{ c.per * STAFF_MAX_LEVEL }}%</td>
              <td class="mono">{{ (c.wage * STAFF_MAX_LEVEL).toLocaleString() }}/时</td>
              <td class="mono" :class="{ 'mastery-hl': true }">{{ c.threshold.toLocaleString() }}/时</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="dim" style="margin: 8px 0 0; font-size: 12px; line-height: 1.6">
        <b>净赚门槛</b>＝工资 ÷ 加成比例（{{ '时薪 × 100 ÷ 每级加成%' }}）：你的收入基数高于它，这个岗位才净赚。
        算出来是<b>与等级无关</b>的常数——升级只是把「净赚金额」等比放大，不会改变"值不值"。
        三个岗位的累计雇佣投入相同（Lv1~{{ STAFF_MAX_LEVEL }} 共 {{ (8000 * (1 + 4 + 9 + 16 + 25)).toLocaleString() }} 金币），
        差别只在门槛：<b>跑堂</b>的门槛按「食客订单奖励额/时」算，<b>掌勺 / 采买</b>按「餐厅时收」算，两者不可直接比大小。
        欠薪会自动停工，雇之前先确认时收撑得住。
      </p>
    </FoldCard>
    <div class="card status-line">
      <span class="badge" :class="{ 'badge-on': wagePerHour > 0 }">在岗 {{ rows.filter((r) => r.active).length }} / {{ STAFF.length }}</span>
      <span class="dim">累计已发工资 <b class="mono">{{ wagesPaid.toLocaleString() }}</b> 金币</span>
      <span class="dim">欠薪会停工（等级保留，补足金币自动复岗）</span>
    </div>

    <!-- 收支核算（2026-09-10 补）：雇工到底赚不赚 -->
    <div class="card staff-econ">
      <div class="staff-econ-main" :class="{ good: netAll >= 0, bad: netAll < 0 }">
        <div class="staff-econ-num">{{ netAll >= 0 ? '+' : '' }}{{ netAll.toLocaleString() }}</div>
        <div class="dim staff-sub">净收益 / 小时（收入增量 − 时薪）</div>
      </div>
      <div class="staff-econ-side">
        <div class="dim staff-sub">在岗雇工带来的餐厅收入增量 <b class="mono">+{{ staffGainTotal.toLocaleString() }}</b> 金币/时（占时收 {{ restaurantHourly > 0 ? Math.round((staffGainTotal / restaurantHourly) * 100) : 0 }}%）</div>
        <div class="dim staff-sub">每小时工资支出 <b class="mono">{{ wagePerHour.toLocaleString() }}</b> 金币 · 当前餐厅时收 <b class="mono">{{ restaurantHourly.toLocaleString() }}</b> 金币</div>
        <div v-if="netAll < 0" class="staff-warn">⚠️ 当前工资支出高于雇工带来的收入增量——升级雇工等级（提高加成）比继续加人更划算。</div>
      </div>
    </div>

    <div class="staff-grid">
      <div v-for="r in rows" :key="r.def.id" class="card staff-card" :class="{ active: r.active, unpaid: r.unpaid }">
        <div class="staff-head">
          <span class="staff-icon">{{ r.def.icon }}</span>
          <div>
            <strong>{{ r.def.name }}</strong>
            <div class="dim staff-sub">{{ r.def.desc }}</div>
          </div>
          <span class="badge" :class="{ 'badge-on': r.active }" style="margin-left: auto">
            {{ r.unpaid ? '欠薪停工' : r.level > 0 ? `在岗 Lv${r.level}` : '未雇佣' }}
          </span>
        </div>

        <div class="dim staff-sub">
          当前加成：+{{ r.perkNow }}%<template v-if="r.level > 0"> · 时薪 {{ r.wage.toLocaleString() }} 金币</template>
        </div>
        <div v-if="r.active && r.isIncome" class="dim staff-sub">
          贡献折算：<b class="mono">+{{ r.gain.toLocaleString() }}</b> 金币/时收入增量，净 <b class="mono" :class="r.net >= 0 ? 'staff-good' : 'staff-bad'">{{ r.net >= 0 ? '+' : '' }}{{ r.net.toLocaleString() }}</b> 金币/时
        </div>
        <div v-else-if="r.active" class="dim staff-sub">该岗位加成作用于<b>食客订单奖励</b>（+{{ r.perkNow }}%），不计入餐厅时收。</div>

        <!-- 等级阶梯（2026-09-10 补）：升到下一级要多少、多给多少 -->
        <details class="staff-ladder">
          <summary class="dim">📈 等级阶梯（Lv1~{{ STAFF_MAX_LEVEL }}）</summary>
          <div class="staff-ladder-list">
            <div
              v-for="l in r.ladder"
              :key="l.level"
              class="staff-ladder-row"
              :class="{ reached: l.reached, current: l.current }"
            >
              <span class="staff-ladder-lv">Lv{{ l.level }}</span>
              <span class="mono staff-ladder-perk">+{{ l.perk }}%</span>
              <span class="dim mono">时薪 {{ l.wage.toLocaleString() }}</span>
              <span class="dim mono">投入 {{ l.cost.toLocaleString() }}</span>
              <span v-if="l.current" class="badge badge-on">当前</span>
            </div>
          </div>
        </details>

        <div class="staff-actions">
          <button v-if="!r.maxed" class="btn btn-sm" :class="r.canPay ? 'btn-primary' : ''" :disabled="!r.canPay" @click="hire(r)">
            {{ r.level === 0 ? '雇佣' : `升级到 Lv${r.nextLevel}` }}（{{ r.cost.gold.toLocaleString() }} 金币）
          </button>
          <span v-else class="dim staff-sub">✅ 已满级</span>
          <button v-if="r.level > 0" class="btn btn-sm" @click="fire(r)">解雇</button>
        </div>
      </div>
    </div>

    <!-- 岗位横比（2026-09-12 补）：三个岗位放在一起看，并算出「净赚门槛」 -->
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.staff-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.staff-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.staff-card.active {
  border-color: var(--primary);
}
.staff-card.unpaid {
  border-color: var(--bad);
}
/* 收支核算 + 阶梯（2026-09-10 补） */
.staff-econ {
  margin-top: 12px;
  padding: 12px 14px;
  display: flex;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
}
.staff-econ-main {
  min-width: 170px;
}
.staff-econ-num {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
}
.staff-econ-main.good .staff-econ-num {
  color: var(--good, #57a861);
}
.staff-econ-main.bad .staff-econ-num {
  color: var(--bad, #d94b3f);
}
.staff-econ-side {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.staff-good {
  color: var(--good, #57a861);
}
.staff-bad {
  color: var(--bad, #d94b3f);
}
.staff-warn {
  font-size: 12px;
  color: var(--warn-strong, #bf7200);
  line-height: 1.6;
}
.staff-ladder {
  font-size: 12px;
}
.staff-ladder > summary {
  cursor: pointer;
  padding: 3px 0;
}
.staff-ladder-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 5px;
}
.staff-ladder-row {
  display: grid;
  grid-template-columns: 44px 52px 1fr 1fr auto;
  align-items: center;
  gap: 6px;
  padding: 3px 7px;
  border-radius: 5px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
  opacity: 0.6;
}
.staff-ladder-row.reached {
  opacity: 1;
  border-style: solid;
}
.staff-ladder-row.current {
  border-color: var(--accent, #d95a38);
}
.staff-ladder-perk {
  color: var(--good, #57a861);
}
.staff-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.staff-icon {
  font-size: 22px;
}
.staff-sub {
  font-size: 12px;
  line-height: 1.6;
}
.staff-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
</style>
