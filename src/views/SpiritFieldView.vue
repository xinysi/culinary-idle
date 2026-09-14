<script setup>
// 灵田（2026-09-14 新增）— 挂机产线：稀有种子 → 长周期 → **定向**产出稀有灵植（灵果/龙根/灵芝/松露）。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { SPIRIT_UNLOCK_LEVEL, SPIRIT_PLANTS, getSpiritPlant, getSpiritPlantBySeed, nextSpiritExpandCost } from '../game/data/spiritField.js'
import { getItem } from '../game/data/items.js'
import { getSkillDef } from '../game/data/skills.js'
import ProgressBar from '../components/ProgressBar.vue'
import ItemImg from '../components/ItemImg.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'regions', label: '🌍 产地' },
  { view: 'ranch', label: '🐄 牧场' },
  { view: 'skill', skill: 'foraging', label: '🌾 采摘' },
]

const unlocked = computed(() => player.spiritUnlocked())
const expandCost = computed(() => nextSpiritExpandCost(player.spiritPlots()))

const seedDraft = ref({})
function sd(i) {
  if (seedDraft.value[i] === undefined) seedDraft.value[i] = ''
  return seedDraft.value[i]
}

/** 背包里可用的灵植种子（按等级升序） */
const ownedSeeds = computed(() => {
  ui.loopTick
  return SPIRIT_PLANTS.filter((p) => (player.inventory[p.seedId] ?? 0) > 0).map((p) => ({
    ...p,
    qty: player.inventory[p.seedId] ?? 0,
    ok: (player.skills?.['foraging']?.level ?? 1) >= p.reqLevel,
  }))
})

const plots = computed(() => {
  ui.loopTick
  const now = Date.now()
  const st = player.spiritState()
  return Array.from({ length: player.spiritPlots() }, (_, i) => {
    const plot = st.plots[i] ?? null
    const def = plot ? getSpiritPlantBySeed(plot.seedId) : null
    const total = plot ? plot.readyAt - plot.plantedAt : 0
    const elapsed = plot ? now - plot.plantedAt : 0
    return {
      index: i,
      plot,
      def,
      progress: plot && total > 0 ? Math.min(1, elapsed / total) : 0,
      remainMs: plot ? Math.max(0, plot.readyAt - now) : 0,
      ready: !!plot && now >= plot.readyAt,
      productText: def ? Object.entries(def.products).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') : '',
      seedName: plot ? getItem(plot.seedId)?.name ?? plot.seedId : '',
      seedLeft: plot ? (player.inventory[plot.seedId] ?? 0) : 0,
    }
  })
})

const stats = computed(() => player.stats?.spiritHarvests ?? 0)

function fmtMs(ms) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${s % 60} 秒`
  return `${s} 秒`
}
function plant(index) {
  const seedId = sd(index)
  if (!seedId) { ui.pushLog('请先选一种灵植种子', 'warn'); return }
  const r = player.spiritPlant(index, seedId)
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  seedDraft.value[index] = ''
}
function harvest(index) {
  const r = player.spiritHarvest(index)
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  const got = Object.entries(r.got).map(([id, q]) => `${getItem(id)?.name ?? id}×${q}`).join('、')
  ui.pushLog(`🌿 灵田收获：${got}${r.replanted ? '（已自动续种）' : ''}`, 'gain')
}
function takeBack(index) {
  const r = player.spiritTakeBack(index)
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  ui.pushLog('已撤回并退还种子', 'info')
}
function expand() {
  const r = player.spiritExpand()
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🌿 灵田</h2>
        <p class="dim">
          种下<b>稀有种子</b>，等一个长周期后<b>定向</b>收获对应灵植（种什么得什么）——灵果 / 龙根 / 灵芝 / 松露
          这些大后期材料，从此不必只靠低概率掉落。到点收取后<b>会自动续种</b>（背包还有同种种子时）。
        </p>
      </div>
      <button v-if="unlocked && expandCost != null" class="btn btn-sm" @click="expand">
        🧱 扩建 +1 格（{{ expandCost.toLocaleString() }} 金币）
      </button>
    </header>

    <div v-if="!unlocked" class="card status-line">
      <span class="badge">🔒 未解锁</span>
      <span class="dim">需 {{ getSkillDef('foraging')?.name ?? '采摘' }} Lv{{ SPIRIT_UNLOCK_LEVEL }} 解锁灵田</span>
    </div>

    <template v-else>
      <div class="card status-line">
        <span class="badge badge-on">灵田 {{ player.spiritPlots() }} 格</span>
        <span class="dim">累计收获 <b class="mono">{{ stats.toLocaleString() }}</b> 次 ·
          手上种子 <b class="mono">{{ ownedSeeds.length }}</b> 种</span>
      </div>

      <div class="sf-grid">
        <div v-for="p in plots" :key="p.index" class="card sf-plot">
          <div class="sf-head">
            <strong>灵田 {{ p.index + 1 }}</strong>
            <span v-if="p.def" class="dim mono" style="font-size: 12px">{{ p.def.icon }} {{ p.def.name }} · {{ p.def.hours }}h</span>
          </div>

          <template v-if="p.plot">
            <div class="dim sf-sub">种子：{{ p.seedName }}（背包还剩 {{ p.seedLeft }}）</div>
            <ProgressBar :progress="p.progress" />
            <div v-if="!p.ready" class="dim sf-sub mono">成熟还有 {{ fmtMs(p.remainMs) }}</div>
            <div v-else class="sf-ready">✅ 已长成，可收取</div>
            <div class="dim sf-sub">预期产出：{{ p.productText }}</div>
            <div class="sf-actions">
              <button class="btn btn-sm btn-primary" :disabled="!p.ready" @click="harvest(p.index)">收取</button>
              <button class="btn btn-sm" @click="takeBack(p.index)">撤回（退种子）</button>
            </div>
          </template>

          <template v-else>
            <select v-model="seedDraft[p.index]" class="sf-select">
              <option value="">选择灵植种子…</option>
              <option v-for="s in ownedSeeds" :key="s.seedId" :value="s.seedId" :disabled="!s.ok">
                {{ s.icon }} {{ s.name }}（{{ s.hours }}h · {{ s.qty }} 颗）{{ s.ok ? '' : ` 🔒需采摘 Lv${s.reqLevel}` }}
              </option>
            </select>
            <div v-if="sd(p.index)" class="dim sf-sub">
              {{ getSpiritPlantBySeed(sd(p.index))?.icon }} {{ getSpiritPlantBySeed(sd(p.index))?.name }} →
              {{ Object.entries(getSpiritPlantBySeed(sd(p.index))?.products ?? {}).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}
            </div>
            <button class="btn btn-sm btn-primary" @click="plant(p.index)">种下</button>
          </template>
        </div>
      </div>

      <div class="card" style="margin-top: 14px">
        <h3>🌱 可种灵植一览</h3>
        <table class="target-table">
          <tbody>
            <tr v-for="s in SPIRIT_PLANTS" :key="s.id">
              <td class="dim" style="width: 120px">{{ s.icon }} {{ s.name }}</td>
              <td class="mono dim" style="width: 120px">{{ getItem(s.seedId)?.name ?? s.seedId }}</td>
              <td class="mono dim" style="width: 90px">采摘 Lv{{ s.reqLevel }}</td>
              <td class="mono dim" style="width: 80px">{{ s.hours }} 小时</td>
              <td>→ {{ Object.entries(s.products).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}
                <span class="dim">（种子：<ItemImg :item-id="s.seedId" size="sm" /> {{ player.inventory[s.seedId] ?? 0 }} 颗）</span></td>
            </tr>
          </tbody>
        </table>
        <p class="dim sf-sub" style="margin-top: 8px">
          种子来自<b>采摘掉落</b>（10% 概率）与<b>杂货铺/珍馐阁</b>购买；灵田产出的是稀有材料，**不是刷钱手段**（金币效率远低于地窖）。
        </p>
      </div>
    </template>
    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.sf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.sf-plot {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sf-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.sf-sub { font-size: 12px; line-height: 1.5; }
.sf-ready { font-size: 12px; color: var(--good-strong); }
.sf-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.sf-select {
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
