<script setup>
// 牧场养殖（2026-09-10 新增）— 驯养动物，按周期消耗作物产出蛋/奶/肉（既有食材）。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { RANCH_ANIMALS, RANCH_UNLOCK_LEVEL, getAnimal, nextRanchExpandCost, POND_FISH, POND_BASE, POND_MAX, getPondFish, nextPondExpandCost } from '../game/data/ranch.js'
import { IDLE_CAP_HOURS } from '../game/data/caps.js'
import { getItem } from '../game/data/items.js'
import { getGoods, goodsEffectText } from '../game/data/processedGoods.js'

/** 产物文案：加工品（鸡油/猪油/鱼酱…）额外标注它的增益效果，否则玩家不知道拿到手干嘛用 */
function productLine(products = {}) {
  return Object.entries(products).map(([id, q]) => {
    const g = getGoods(id)
    return `${getItem(id)?.name ?? id} ×${q}${g ? `（${g ? goodsEffectText(g) : ''}）` : ''}`
  }).join('、')
}
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
      productText: def ? productLine(def.products) : '',
    }
  })
})

const stats = computed(() => player.stats?.ranchCycles ?? 0)

// ── 网箱（2026-09-14；并入牧场页）──
const pondDraft = ref({})
function pd(i) {
  if (!pondDraft.value[i]) pondDraft.value[i] = POND_FISH[0].id
  return pondDraft.value[i]
}
const pondCost = computed(() => nextPondExpandCost(player.pondPens()))
const ponds = computed(() => {
  ui.loopTick
  const now = Date.now()
  const st = player.pondState()
  return Array.from({ length: player.pondPens() }, (_, i) => {
    const pond = st.ponds[i] ?? null
    const def = pond ? getPondFish(pond.fishId) : null
    const cycleMs = (def?.hours ?? 0) * 3600_000
    const elapsed = pond ? now - (pond.lastAt ?? now) : 0
    const canFeed = def ? Object.entries(def.feed).every(([id, q]) => (player.inventory[id] ?? 0) >= q) : false
    return {
      index: i, pond, def, canFeed,
      progress: def ? Math.min(1, elapsed / cycleMs) : 0,
      remainMs: def ? Math.max(0, cycleMs - elapsed) : 0,
      feedText: def ? Object.entries(def.feed).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') : '',
      productText: def ? productLine(def.products) : '',
    }
  })
})
const pondStats = computed(() => player.stats?.pondCycles ?? 0)
function buyPond(index) {
  const r = player.pondBuy(index, pd(index))
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function removePond(index) {
  if (player.pondRemove(index)) ui.pushLog('已清空该网箱', 'info')
}
function expandPond() {
  const r = player.pondExpand()
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}

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
import FoldCard from '../components/FoldCard.vue'
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [
  { view: 'cellar', label: '🍶 地窖' },
  { view: 'automation', label: '🤖 自动化' },
  { view: 'mycoField', label: '🌿 灵圃菌房' },
  { view: 'greenhouse', label: '🐝 温室蜂场' },
]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🐄 牧场养殖</h2>
        <p class="dim">
          买下动物放进栏位，每隔一个周期自动消耗<b>作物饲料</b>产出<b>蛋 / 奶 / 肉</b>（离线照常结算，单次最多补 {{ IDLE_CAP_HOURS }} 小时）；
          饲料不足时暂停，补料后继续。
        </p>
      </div>
      <button v-if="unlocked && expandCost != null" class="btn btn-sm" @click="expand">
        🧱 扩建 +1 栏（{{ expandCost.toLocaleString() }} 金币）
      </button>
      <button v-if="unlocked && pondCost != null" class="btn btn-sm" @click="expandPond">
        🧱 扩建 +1 网箱（{{ pondCost.toLocaleString() }} 金币）
      </button>
    </header>

    <FoldCard title="🐾 可驯养动物一览" hint="野鸡 4h 最勤、野牛 12h 单产最高；四种各带一件加工品（鸡油/猪油/羊酪/牛骨高汤）">
      <div class="card" style="margin-top: 14px">
        <h3>🐾 可驯养动物一览</h3>
        <table class="target-table">
          <tbody>
            <tr v-for="a in RANCH_ANIMALS" :key="a.id">
              <td class="dim" style="width: 120px">{{ a.icon }} {{ a.name }}</td>
              <td class="mono dim" style="width: 110px">{{ a.cost.toLocaleString() }} 金币</td>
              <td class="dim">饲料 {{ Object.entries(a.feed).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}</td>
              <td>→ {{ productLine(a.products) }}<span class="dim">（{{ a.hours }} 小时 / 周期）</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </FoldCard>

    <FoldCard title="🐠 可养鱼种一览" hint="鲫鱼 3h 最快、鲍鱼 12h 最贵；都额外产一件水产加工品（鱼酱/鱼子酱/虾油/鲍汁）">
      <div class="card" style="margin-top: 14px">
        <h3>🐠 可养鱼种一览</h3>
        <table class="target-table">
          <tbody>
            <tr v-for="f in POND_FISH" :key="f.id">
              <td class="dim" style="width: 120px">{{ f.icon }} {{ f.name }}</td>
              <td class="mono dim" style="width: 110px">{{ f.cost.toLocaleString() }} 金币</td>
              <td class="dim">饲料 {{ Object.entries(f.feed).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}</td>
              <td>→ {{ productLine(f.products) }}<span class="dim">（{{ f.hours }} 小时 / 周期）</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </FoldCard>

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
            <div v-if="p.canFeed" class="dim ranch-sub mono">下次产出还有 {{ fmtMs(p.remainMs) }}</div>
            <div class="dim ranch-sub">每周期产出：{{ p.productText }}</div>
            <div v-if="!p.canFeed" class="ranch-warn">⏸ 已停机：饲料不足（{{ p.feedText }}），备好料才会重新计时</div>
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
              → 产出 {{ productLine(getAnimal(d(p.index))?.products) }}
            </div>
            <button class="btn btn-sm btn-primary" @click="buy(p.index)">买下并放入</button>
          </template>
        </div>
      </div>

      <h3 style="margin: 16px 0 0; font-size: 15px">🐟 网箱（并入牧场）</h3>
      <div class="card status-line" style="margin-top: 8px">
        <span class="badge badge-on">网箱 {{ player.pondPens() }} 个</span>
        <span class="dim">累计产出周期 <b class="mono">{{ pondStats.toLocaleString() }}</b> 次 · 饲料为<b>海苔</b>（水域可采）</span>
      </div>
      <div class="ranch-grid">
        <div v-for="p in ponds" :key="p.index" class="card ranch-pen">
          <div class="ranch-head">
            <strong>网箱 {{ p.index + 1 }}</strong>
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
            <div v-if="p.canFeed" class="dim ranch-sub mono">下次起网还有 {{ fmtMs(p.remainMs) }}</div>
            <div class="dim ranch-sub">每周期产出：{{ p.productText }}</div>
            <div v-if="!p.canFeed" class="ranch-warn">⚠ 饲料不足（{{ p.feedText }}），已暂停</div>
            <button class="btn btn-sm" @click="removePond(p.index)">清空网箱</button>
          </template>
          <template v-else>
            <select v-model="pondDraft[p.index]" class="ranch-select">
              <option v-for="f in POND_FISH" :key="f.id" :value="f.id">
                {{ f.icon }} {{ f.name }}（{{ f.cost.toLocaleString() }} 金币 · {{ f.hours }}h）
              </option>
            </select>
            <div v-if="pondDraft[p.index]" class="dim ranch-sub">
              饲料 {{ Object.entries(getPondFish(pd(p.index))?.feed ?? {}).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}
              → 产出 {{ productLine(getPondFish(pd(p.index))?.products) }}
            </div>
            <button class="btn btn-sm btn-primary" @click="buyPond(p.index)">投苗并养起</button>
          </template>
        </div>
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
