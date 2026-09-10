<script setup>
// 吉祥物（2026-09-10 新增）— 买下后每天「蹭一次」领随机奖励，好感等级提升奖励。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { MASCOTS, MASCOT_BOND_STEPS, mascotReward } from '../game/data/mascots.js'
import { getItem } from '../game/data/items.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()

const st = computed(() => player.mascotState())
const pettedToday = computed(() => player.mascotPettedToday())

const rows = computed(() =>
  MASCOTS.map((def) => {
    const owned = !!st.value.owned[def.id]
    const pets = st.value.pets?.[def.id] ?? 0
    const prog = player.mascotBondProgressOf(def.id)
    const preview = mascotReward(def, pets, () => 0) // 只预览保底金币
    return {
      def,
      owned,
      active: st.value.active === def.id,
      pets,
      level: prog.level,
      progress: prog.progress,
      current: prog.current,
      needed: prog.needed,
      maxed: prog.level >= MASCOT_BOND_STEPS.length,
      gold: preview.gold,
      itemText: Object.entries(def.items ?? {}).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、'),
    }
  })
)

function buy(r) {
  const res = player.mascotBuy(r.def.id)
  if (!res.ok) ui.pushLog(res.msg, 'warn')
}
function activate(r) {
  const res = player.mascotActivate(r.def.id)
  if (!res.ok) ui.pushLog(res.msg, 'warn')
}
function pet() {
  const res = player.mascotPet()
  if (!res.ok) ui.pushLog(res.msg, 'warn')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🍀 吉祥物</h2>
        <p class="dim">
          买下吉祥物后可<b>每天蹭一次</b>：给金币（基础 ×（1 + 25% × 好感等级））与概率专属礼物；累计次数升好感（{{ MASCOT_BOND_STEPS.join(' / ') }} 次 → Lv1~5）。
        </p>
      </div>
      <button v-if="st.active" class="btn btn-sm btn-primary" :disabled="pettedToday" @click="pet">
        {{ pettedToday ? '今日已蹭过' : '🐾 蹭一蹭' }}
      </button>
    </header>

    <div class="card status-line">
      <span class="badge" :class="{ 'badge-on': !!st.active }">
        当前：{{ st.active ? (MASCOTS.find((m) => m.id === st.active)?.icon + ' ' + MASCOTS.find((m) => m.id === st.active)?.name) : '无' }}
      </span>
      <span class="dim">已拥有 {{ Object.keys(st.owned).length }} / {{ MASCOTS.length }}</span>
      <span class="dim">累计蹭过 <b class="mono">{{ player.stats?.mascotPets ?? 0 }}</b> 次</span>
    </div>

    <div class="mascot-grid">
      <div v-for="r in rows" :key="r.def.id" class="card mascot-card" :class="{ owned: r.owned, active: r.active }">
        <div class="mascot-head">
          <span class="mascot-icon">{{ r.def.icon }}</span>
          <div>
            <strong>{{ r.def.name }}</strong>
            <div class="dim mascot-sub">{{ r.def.desc }}</div>
          </div>
          <span v-if="r.active" class="badge badge-on" style="margin-left: auto">营业中</span>
        </div>

        <div class="dim mascot-sub">
          基础奖励 {{ r.def.goldBase.toLocaleString() }} 金币<template v-if="r.itemText"> · 概率另给 {{ r.itemText }}</template>
        </div>

        <template v-if="r.owned">
          <div class="mascot-row">
            <span class="dim">好感</span>
            <span class="mono">Lv{{ r.level }} / {{ MASCOT_BOND_STEPS.length }}</span>
          </div>
          <ProgressBar :progress="r.progress" />
          <div class="dim mascot-sub mono">
            <template v-if="r.maxed">已满好感 · 累计蹭过 {{ r.pets }} 次</template>
            <template v-else>{{ r.current }} / {{ r.needed }} 次 · 累计 {{ r.pets }}</template>
          </div>
          <div class="dim mascot-sub">今日可获得 {{ r.gold.toLocaleString() }} 金币</div>
          <button v-if="!r.active" class="btn btn-sm" @click="activate(r)">让它营业</button>
        </template>
        <template v-else>
          <button class="btn btn-sm" :class="player.gold >= r.def.cost ? 'btn-primary' : ''" :disabled="player.gold < r.def.cost" @click="buy(r)">
            购买（{{ r.def.cost.toLocaleString() }} 金币）
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mascot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.mascot-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.mascot-card.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}
.mascot-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mascot-icon {
  font-size: 24px;
}
.mascot-sub {
  font-size: 12px;
  line-height: 1.6;
}
.mascot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}
</style>
