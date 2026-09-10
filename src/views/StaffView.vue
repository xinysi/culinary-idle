<script setup>
// 雇工班底（2026-09-10 新增）— 金币雇工，每小时发工资换餐厅经营加成（欠薪自动停工）。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { STAFF, STAFF_MAX_LEVEL, staffCost, staffWage } from '../game/data/staff.js'

const player = usePlayerStore()
const ui = useUiStore()

const rows = computed(() =>
  STAFF.map((def) => {
    const st = player.staffState(def.id)
    const level = st?.level ?? 0
    const active = player.staffActive(def.id)
    const nextLevel = Math.min(STAFF_MAX_LEVEL, level + 1)
    const cost = staffCost(nextLevel)
    return {
      def,
      level,
      active,
      unpaid: !!st?.unpaid,
      maxed: level >= STAFF_MAX_LEVEL,
      nextLevel,
      cost,
      wage: staffWage(def, level),
      canPay: player.gold >= cost.gold,
      perkNow: level * def.per,
    }
  })
)

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

    <div class="card status-line">
      <span class="badge" :class="{ 'badge-on': wagePerHour > 0 }">在岗 {{ rows.filter((r) => r.active).length }} / {{ STAFF.length }}</span>
      <span class="dim">累计已发工资 <b class="mono">{{ wagesPaid.toLocaleString() }}</b> 金币</span>
      <span class="dim">欠薪会停工（等级保留，补足金币自动复岗）</span>
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

        <div class="staff-actions">
          <button v-if="!r.maxed" class="btn btn-sm" :class="r.canPay ? 'btn-primary' : ''" :disabled="!r.canPay" @click="hire(r)">
            {{ r.level === 0 ? '雇佣' : `升级到 Lv${r.nextLevel}` }}（{{ r.cost.gold.toLocaleString() }} 金币）
          </button>
          <span v-else class="dim staff-sub">✅ 已满级</span>
          <button v-if="r.level > 0" class="btn btn-sm" @click="fire(r)">解雇</button>
        </div>
      </div>
    </div>
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
