<script setup>
// 菌房（2026-09-14 新增）— 挂机产线：吃**肥料**（堆肥 / 肥沃堆肥）产菌菇，与牧场同构、饲料不同。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { MUSHROOM_UNLOCK_LEVEL, MUSHROOM_MEDIA, getMushroomMedia, nextMushroomExpandCost } from '../game/data/mushroomHouse.js'
import { IDLE_CAP_HOURS } from '../game/data/caps.js'
import { getItem } from '../game/data/items.js'
import { getSkillDef } from '../game/data/skills.js'
import ProgressBar from '../components/ProgressBar.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'ranch', label: '🐄 牧场' },
  { view: 'automation', label: '🤖 自动化' },
  { view: 'cellar', label: '🍶 地窖' },
]

const draft = ref({})
function d(i) {
  if (!draft.value[i]) draft.value[i] = MUSHROOM_MEDIA[0].id
  return draft.value[i]
}

const unlocked = computed(() => player.mushroomUnlocked())
const expandCost = computed(() => nextMushroomExpandCost(player.mushroomBeds()))

const beds = computed(() => {
  ui.loopTick
  const now = Date.now()
  const st = player.mushroomState()
  return Array.from({ length: player.mushroomBeds() }, (_, i) => {
    const bed = st.beds[i] ?? null
    const def = bed ? getMushroomMedia(bed.mediaId) : null
    const cycleMs = (def?.hours ?? 0) * 3600_000
    const elapsed = bed ? now - (bed.lastAt ?? now) : 0
    const canFeed = def ? Object.entries(def.feed).every(([id, q]) => (player.inventory[id] ?? 0) >= q) : false
    return {
      index: i,
      bed,
      def,
      canFeed,
      progress: def ? Math.min(1, elapsed / cycleMs) : 0,
      remainMs: def ? Math.max(0, cycleMs - elapsed) : 0,
      feedText: def ? Object.entries(def.feed).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') : '',
      productText: def ? Object.entries(def.products).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') : '',
    }
  })
})

const stats = computed(() => player.stats?.mushroomCycles ?? 0)

function fmtMs(ms) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${s % 60} 秒`
  return `${s} 秒`
}
function build(index) {
  const r = player.mushroomBuild(index, d(index))
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function remove(index) {
  if (player.mushroomRemove(index)) ui.pushLog('已清空该菇床', 'info')
}
function expand() {
  const r = player.mushroomExpand()
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🍄 菌房</h2>
        <p class="dim">
          铺一张菇床，每隔一个周期自动消耗<b>肥料</b>产出<b>菌菇</b>（离线照常结算，单次最多补 {{ IDLE_CAP_HOURS }} 小时）；
          肥料不足时暂停，补料后继续。<b>肥沃堆肥</b>周期更短、还能伴生松茸。
        </p>
      </div>
      <button v-if="unlocked && expandCost != null" class="btn btn-sm" @click="expand">
        🧱 扩建 +1 床（{{ expandCost.toLocaleString() }} 金币）
      </button>
    </header>

    <div v-if="!unlocked" class="card status-line">
      <span class="badge">🔒 未解锁</span>
      <span class="dim">需 {{ getSkillDef('foraging')?.name ?? '采摘' }} Lv{{ MUSHROOM_UNLOCK_LEVEL }} 解锁菌房</span>
    </div>

    <template v-else>
      <div class="card status-line">
        <span class="badge badge-on">菇床 {{ player.mushroomBeds() }} 张</span>
        <span class="dim">累计产出周期 <b class="mono">{{ stats.toLocaleString() }}</b> 次 ·
          手上堆肥 <b class="mono">{{ player.inventory.compost ?? 0 }}</b> ·
          沃肥 <b class="mono">{{ player.inventory.richCompost ?? 0 }}</b></span>
      </div>

      <div class="mh-grid">
        <div v-for="b in beds" :key="b.index" class="card mh-bed">
          <div class="mh-head">
            <strong>菇床 {{ b.index + 1 }}</strong>
            <span v-if="b.def" class="dim mono" style="font-size: 12px">{{ b.def.hours }}h / 周期</span>
          </div>

          <template v-if="b.def">
            <div class="mh-media">
              <span class="mh-icon">{{ b.def.icon }}</span>
              <div>
                <div>{{ b.def.name }}</div>
                <div class="dim mh-sub">培养基：{{ b.feedText }}</div>
              </div>
            </div>
            <ProgressBar :progress="b.progress" />
            <div class="dim mh-sub mono">下次出菇还有 {{ fmtMs(b.remainMs) }}</div>
            <div class="dim mh-sub">每周期产出：{{ b.productText }}</div>
            <div v-if="!b.canFeed" class="mh-warn">⚠ 培养基不足（{{ b.feedText }}），已暂停</div>
            <button class="btn btn-sm" @click="remove(b.index)">清空菇床</button>
          </template>

          <template v-else>
            <select v-model="draft[b.index]" class="mh-select">
              <option v-for="m in MUSHROOM_MEDIA" :key="m.id" :value="m.id">
                {{ m.icon }} {{ m.name }}（{{ (m.cost ?? 0).toLocaleString() }} 金币 · {{ m.hours }}h）
              </option>
            </select>
            <div v-if="draft[b.index]" class="dim mh-sub">
              消耗 {{ Object.entries(getMushroomMedia(d(b.index))?.feed ?? {}).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}
              → 产出 {{ Object.entries(getMushroomMedia(d(b.index))?.products ?? {}).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}
            </div>
            <button class="btn btn-sm btn-primary" @click="build(b.index)">铺床并开产</button>
          </template>
        </div>
      </div>

      <div class="card" style="margin-top: 14px">
        <h3>🧫 培养基一览</h3>
        <table class="target-table">
          <tbody>
            <tr v-for="m in MUSHROOM_MEDIA" :key="m.id">
              <td class="dim" style="width: 130px">{{ m.icon }} {{ m.name }}</td>
              <td class="mono dim" style="width: 110px">{{ (m.cost ?? 0).toLocaleString() }} 金币</td>
              <td class="dim">消耗 {{ Object.entries(m.feed).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}</td>
              <td>→ {{ Object.entries(m.products).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}<span class="dim">（{{ m.hours }} 小时 / 周期）</span></td>
            </tr>
          </tbody>
        </table>
        <p class="dim mh-sub" style="margin-top: 8px">
          肥料从<b>杂货铺</b>买或由<b>保鲜</b>技能产出；堆肥施到农田只有一次收益，交给菌房可以反复出菇。
        </p>
      </div>
    </template>
    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.mh-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.mh-bed {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mh-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.mh-media { display: flex; align-items: center; gap: 10px; }
.mh-icon { font-size: 24px; }
.mh-sub { font-size: 12px; line-height: 1.5; }
.mh-warn { font-size: 12px; color: var(--warn-strong); }
.mh-select {
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
