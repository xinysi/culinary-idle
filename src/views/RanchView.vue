<script setup>
// 牧场养殖（2026-09-10 新增）— 驯养动物，按周期消耗作物产出蛋/奶/肉（既有食材）。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { RANCH_ANIMALS, RANCH_UNLOCK_LEVEL, RANCH_OFFLINE_CAP_HOURS, getAnimal, nextRanchExpandCost } from '../game/data/ranch.js'
import { getItem } from '../game/data/items.js'
import { getSkillDef } from '../game/data/skills.js'
import ProgressBar from '../components/ProgressBar.vue'
import ItemImg from '../components/ItemImg.vue'

const player = usePlayerStore()
const ui = useUiStore()

const draft = ref({})
function d(i) {
  if (!draft.value[i]) draft.value[i] = RANCH_ANIMALS[0].id
  return draft.value[i]
}

const unlocked = computed(() => player.ranchUnlocked())
const expandCost = computed(() => nextRanchExpandCost(player.ranchPens()))

const pens = computed(() => {
  ui.loopTick
  const now = Date.now()
  const st = player.ranchState()
  return Array.from({ length: player.ranchPens() }, (_, i) => {
    const pen = st.pens[i] ?? null
    const def = pen ? getAnimal(pen.animalId) : null
    const cycleMs = (def?.hours ?? 0) * 3600_000
    const elapsed = pen ? now - (pen.lastAt ?? now) : 0
    const canFeed = def ? Object.entries(def.feed).every(([id, q]) => (player.inventory[id] ?? 0) >= q) : false
    return {
      index: i,
      pen,
      def,
      canFeed,
      progress: def ? Math.min(1, elapsed / cycleMs) : 0,
      remainMs: def ? Math.max(0, cycleMs - elapsed) : 0,
      feedText: def ? Object.entries(def.feed).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') : '',
      productText: def ? Object.entries(def.products).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') : '',
    }
  })
})

const stats = computed(() => player.stats?.ranchCycles ?? 0)

function fmtMs(ms) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${s % 60} 秒`
  return `${s} 秒`
}
function buy(index) {
  const r = player.ranchBuy(index, d(index))
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function remove(index) {
  if (player.ranchRemove(index)) ui.pushLog('已移出该栏动物', 'info')
}
function expand() {
  const r = player.ranchExpand()
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'cellar', label: '🍶 地窖' }, { view: 'automation', label: '🤖 自动化' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🐄 牧场养殖</h2>
        <p class="dim">
          买下动物放进栏位，每隔一个周期自动消耗<b>作物饲料</b>产出<b>蛋 / 奶 / 肉</b>（离线照常结算，单次最多补 {{ RANCH_OFFLINE_CAP_HOURS }} 小时）；
          饲料不足时暂停，补料后继续。
        </p>
      </div>
      <button v-if="unlocked && expandCost != null" class="btn btn-sm" @click="expand">
        🧱 扩建 +1 栏（{{ expandCost.toLocaleString() }} 金币）
      </button>
    </header>

    <div v-if="!unlocked" class="card status-line">
      <span class="badge">🔒 未解锁</span>
      <span class="dim">需 {{ getSkillDef('farming')?.name ?? '农耕' }} Lv{{ RANCH_UNLOCK_LEVEL }} 解锁牧场</span>
    </div>

    <template v-else>
      <div class="card status-line">
        <span class="badge badge-on">栏位 {{ player.ranchPens() }} 个</span>
        <span class="dim">累计产出周期 <b class="mono">{{ stats.toLocaleString() }}</b> 次</span>
      </div>

      <div class="ranch-grid">
        <div v-for="p in pens" :key="p.index" class="card ranch-pen">
          <div class="ranch-head">
            <strong>栏位 {{ p.index + 1 }}</strong>
            <span v-if="p.def" class="dim mono" style="font-size: 12px">{{ p.def.hours }}h / 周期</span>
          </div>

          <template v-if="p.def">
            <div class="ranch-animal">
              <span class="ranch-icon">{{ p.def.icon }}</span>
              <div>
                <div>{{ p.def.name }}</div>
                <div class="dim ranch-sub">饲料：{{ p.feedText }}</div>
              </div>
            </div>
            <ProgressBar :progress="p.progress" />
            <div class="dim ranch-sub mono">下次产出还有 {{ fmtMs(p.remainMs) }}</div>
            <div class="dim ranch-sub">每周期产出：{{ p.productText }}</div>
            <div v-if="!p.canFeed" class="ranch-warn">⚠ 饲料不足（{{ p.feedText }}），已暂停</div>
            <button class="btn btn-sm" @click="remove(p.index)">移出</button>
          </template>

          <template v-else>
            <select v-model="draft[p.index]" class="ranch-select">
              <option v-for="a in RANCH_ANIMALS" :key="a.id" :value="a.id">
                {{ a.icon }} {{ a.name }}（{{ a.cost.toLocaleString() }} 金币 · {{ a.hours }}h）
              </option>
            </select>
            <div v-if="draft[p.index]" class="dim ranch-sub">
              饲料 {{ Object.entries(getAnimal(d(p.index))?.feed ?? {}).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}
              → 产出 {{ Object.entries(getAnimal(d(p.index))?.products ?? {}).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}
            </div>
            <button class="btn btn-sm btn-primary" @click="buy(p.index)">买下并放入</button>
          </template>
        </div>
      </div>

      <div class="card" style="margin-top: 14px">
        <h3>🐾 可驯养动物一览</h3>
        <table class="target-table">
          <tbody>
            <tr v-for="a in RANCH_ANIMALS" :key="a.id">
              <td class="dim" style="width: 120px">{{ a.icon }} {{ a.name }}</td>
              <td class="mono dim" style="width: 110px">{{ a.cost.toLocaleString() }} 金币</td>
              <td class="dim">饲料 {{ Object.entries(a.feed).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}</td>
              <td>→ {{ Object.entries(a.products).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}<span class="dim">（{{ a.hours }} 小时 / 周期）</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.ranch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.ranch-pen {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ranch-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.ranch-animal {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ranch-icon {
  font-size: 24px;
}
.ranch-sub {
  font-size: 12px;
  line-height: 1.5;
}
.ranch-warn {
  font-size: 12px;
  color: var(--warn-strong);
}
.ranch-select {
  width: 100%;
  height: 32px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
}
</style>
