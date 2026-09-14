<script setup>
// 灵圃菌房（v2.3.0）— 由原「菌房」与「灵田」**合并成一页**（用户要求），并新增核心环节「萃露炉」。
//
// 三个区块：① 菇床（吃肥料产菌菇/松茸/茯苓）② 灵圃（种稀有种子产灵植）③ 萃露炉（把菌菇/灵植酿成 8 档菌灵露）。
// 为什么要「萃露」：采集是无限的（灵芝约 15,400 件/天），产线若也产材料就永远没有意义；
// 菌灵露是采集拿不到的**乘区物品**（经验/产量/采集间隔/餐厅收入），于是采集越多 → 精华越多 → 乘区越强。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { MUSHROOM_UNLOCK_LEVEL, MUSHROOM_MEDIA, getMushroomMedia, nextMushroomExpandCost } from '../game/data/mushroomHouse.js'
import { SPIRIT_UNLOCK_LEVEL, SPIRIT_PLANTS, getSpiritPlant, getSpiritPlantBySeed, nextSpiritExpandCost } from '../game/data/spiritField.js'
import { ESSENCE_TIERS, getEssence, essenceCostText, essenceEffectText, nextEssenceExpandCost } from '../game/data/essences.js'
import { IDLE_CAP_HOURS } from '../game/data/caps.js'
import { getItem } from '../game/data/items.js'
import { getSkillDef } from '../game/data/skills.js'
import ProgressBar from '../components/ProgressBar.vue'
import ItemImg from '../components/ItemImg.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'greenhouse', label: '🐝 温室蜂场' },
  { view: 'ranch', label: '🐄 牧场' },
  { view: 'skill', skill: 'foraging', label: '🌾 采摘' },
]

const mushroomDraft = ref({})
const seedDraft = ref({})
const essenceDraft = ref({})
const mOpen = ref(true)
const sOpen = ref(true)
const eOpen = ref(true)

function md(i) {
  if (!mushroomDraft.value[i]) mushroomDraft.value[i] = MUSHROOM_MEDIA[0].id
  return mushroomDraft.value[i]
}
function sd(i) {
  if (seedDraft.value[i] === undefined) seedDraft.value[i] = ''
  return seedDraft.value[i]
}
function ed(i) {
  if (!essenceDraft.value[i]) essenceDraft.value[i] = 'essence1'
  return essenceDraft.value[i]
}

const mushroomUnlocked = computed(() => player.mushroomUnlocked())
const spiritUnlocked = computed(() => player.spiritUnlocked())
const unlocked = computed(() => mushroomUnlocked.value || spiritUnlocked.value)

const mushroomCost = computed(() => nextMushroomExpandCost(player.mushroomBeds()))
const spiritCost = computed(() => nextSpiritExpandCost(player.spiritPlots()))
const essenceCost = computed(() => nextEssenceExpandCost(player.essenceVats()))

/** ① 菇床 */
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
      index: i, bed, def, canFeed,
      progress: def ? Math.min(1, elapsed / cycleMs) : 0,
      remainMs: def ? Math.max(0, cycleMs - elapsed) : 0,
      feedText: def ? Object.entries(def.feed).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') : '',
      productText: def ? Object.entries(def.products).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') : '',
    }
  })
})

/** ② 灵圃 */
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
      index: i, plot, def,
      progress: plot && total > 0 ? Math.min(1, elapsed / total) : 0,
      remainMs: plot ? Math.max(0, plot.readyAt - now) : 0,
      ready: !!plot && now >= plot.readyAt,
      productText: def ? Object.entries(def.products).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') : '',
      seedName: plot ? getItem(plot.seedId)?.name ?? plot.seedId : '',
      seedLeft: plot ? (player.inventory[plot.seedId] ?? 0) : 0,
    }
  })
})

/** ③ 萃露炉 */
const vats = computed(() => {
  ui.loopTick
  const now = Date.now()
  const st = player.essenceState()
  return Array.from({ length: player.essenceVats() }, (_, i) => {
    const vat = st.vats[i] ?? null
    const def = vat ? getEssence(vat.tierId) : null
    const total = vat ? vat.readyAt - vat.startedAt : 0
    const elapsed = vat ? now - vat.startedAt : 0
    return {
      index: i, vat, def,
      progress: vat && total > 0 ? Math.min(1, elapsed / total) : 0,
      remainMs: vat ? Math.max(0, vat.readyAt - now) : 0,
      ready: !!vat && now >= vat.readyAt,
    }
  })
})
/** 每档是否备料齐全 */
const essenceRows = computed(() => {
  ui.loopTick
  return ESSENCE_TIERS.map((e) => {
    const need = { ...e.material, ...e.aux }
    const lack = Object.entries(need).filter(([id, q]) => (player.inventory[id] ?? 0) < q)
    return { ...e, can: lack.length === 0, lackText: lack.map(([id, q]) => `${getItem(id)?.name ?? id}×${q}`).join('、'), costText: essenceCostText(e, (id) => getItem(id)?.name ?? id), effectText: essenceEffectText(e) }
  })
})

const stats = computed(() => ({
  mushroom: player.stats?.mushroomCycles ?? 0,
  spirit: player.stats?.spiritHarvests ?? 0,
  essence: player.stats?.essenceBrews ?? 0,
}))

function fmtMs(ms) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${s % 60} 秒`
  return `${s} 秒`
}
function build(index) {
  const r = player.mushroomBuild(index, md(index))
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function removeBed(index) {
  if (player.mushroomRemove(index)) ui.pushLog('已清空该菇床', 'info')
}
function plant(index) {
  const r = player.spiritPlant(index, sd(index))
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  seedDraft.value[index] = ''
}
function harvest(index) {
  const r = player.spiritHarvest(index)
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  const got = Object.entries(r.got).map(([id, q]) => `${getItem(id)?.name ?? id}×${q}`).join('、')
  ui.pushLog(`🌿 灵圃收获：${got}${r.replanted ? '（已自动续种）' : ''}`, 'gain')
}
function takeBack(index) {
  const r = player.spiritTakeBack(index)
  if (!r.ok) ui.pushLog(r.msg, 'warn')
  else ui.pushLog('已撤回并退还种子', 'info')
}
function brew(index) {
  const r = player.essenceBrew(index, ed(index))
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function claim(index) {
  const r = player.essenceClaim(index)
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  ui.pushLog(`🧪 萃露完成：${getItem(r.itemId)?.name ?? r.itemId}`, 'gain')
}
function recall(index) {
  const r = player.essenceTakeBack(index)
  if (!r.ok) ui.pushLog(r.msg, 'warn')
  else ui.pushLog('已撤回，原料原样退回', 'info')
}
function expandMushroom() { const r = player.mushroomExpand(); if (!r.ok) ui.pushLog(r.msg, 'warn') }
function expandSpirit() { const r = player.spiritExpand(); if (!r.ok) ui.pushLog(r.msg, 'warn') }
function expandEssence() { const r = player.essenceExpand(); if (!r.ok) ui.pushLog(r.msg, 'warn') }
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🌿 灵圃菌房</h2>
        <p class="dim">
          菇床吃<b>肥料</b>出菌菇、灵圃种<b>稀有种子</b>出灵植，两条料线都汇入<b>萃露炉</b>——
          酿成 8 档<b>菌灵露</b>（采集<b>拿不到</b>的乘区物品：经验 / 产量 / 采集间隔 / 餐厅收入）。
          离线照常结算，单次最多补 {{ IDLE_CAP_HOURS }} 小时；缺料即停机。
        </p>
      </div>
      <div style="display: flex; gap: 8px; margin-left: auto">
        <button v-if="mushroomUnlocked && mushroomCost != null" class="btn btn-sm" @click="expandMushroom">🍄 菇床 +1（{{ mushroomCost.toLocaleString() }}）</button>
        <button v-if="spiritUnlocked && spiritCost != null" class="btn btn-sm" @click="expandSpirit">🌱 灵圃 +1（{{ spiritCost.toLocaleString() }}）</button>
        <button v-if="unlocked && essenceCost != null" class="btn btn-sm" @click="expandEssence">🧪 萃露炉 +1（{{ essenceCost.toLocaleString() }}）</button>
      </div>
    </header>

    <div v-if="!unlocked" class="card status-line">
      <span class="badge">🔒 未解锁</span>
      <span class="dim">
        菇床需 {{ getSkillDef('foraging')?.name ?? '采摘' }} Lv{{ MUSHROOM_UNLOCK_LEVEL }}；灵圃需 {{ getSkillDef('foraging')?.name ?? '采摘' }} Lv{{ SPIRIT_UNLOCK_LEVEL }}
      </span>
    </div>

    <template v-else>
      <div class="card status-line">
        <span class="badge badge-on">菇床 {{ player.mushroomBeds() }} · 灵圃 {{ player.spiritPlots() }} · 萃露炉 {{ player.essenceVats() }}</span>
        <span class="dim">
          累计：出菇 <b class="mono">{{ stats.mushroom.toLocaleString() }}</b> 轮 ·
          收获 <b class="mono">{{ stats.spirit.toLocaleString() }}</b> 次 ·
          酿露 <b class="mono">{{ stats.essence.toLocaleString() }}</b> 瓶
        </span>
      </div>

      <!-- ① 菇床 -->
      <h3 class="mf-title" @click="mOpen = !mOpen">🍄 菇床 —— 吃肥料出菌菇，供菌灵露 <b>Ⅰ~Ⅳ 档</b>原料{{ mOpen ? '' : '（点击展开）' }}</h3>
      <p v-if="mOpen" class="dim mf-role">
        与灵圃的分工：菇床吃的是<b>杂货铺能买到的肥料</b>，所以它是**唯一不占并行挂机槽、也不占用背包种子**的纯挂机料线——把金币稳定换成菌灵露原料。
      </p>
      <div v-if="mOpen" class="mf-grid">
        <div v-for="b in beds" :key="b.index" class="card mf-cell">
          <div class="mf-head"><strong>菇床 {{ b.index + 1 }}</strong><span v-if="b.def" class="dim mono mf-fs">{{ b.def.hours }}h / 周期</span></div>
          <template v-if="b.def">
            <div class="mf-media"><span class="mf-icon">{{ b.def.icon }}</span><div><div>{{ b.def.name }}</div><div class="dim mf-sub">培养基：{{ b.feedText }}</div></div></div>
            <ProgressBar :progress="b.progress" />
            <div v-if="b.canFeed" class="dim mf-sub mono">下次出菇还有 {{ fmtMs(b.remainMs) }}</div>
            <div class="dim mf-sub">每周期产出：{{ b.productText }}</div>
            <div v-if="!b.canFeed" class="mf-warn">⏸ 已停机：培养基不足（{{ b.feedText }}），备好料才会重新计时</div>
            <button class="btn btn-sm" @click="removeBed(b.index)">清空菇床</button>
          </template>
          <template v-else>
            <select v-model="mushroomDraft[b.index]" class="mf-select">
              <option v-for="m in MUSHROOM_MEDIA" :key="m.id" :value="m.id">{{ m.icon }} {{ m.name }}（{{ (m.cost ?? 0).toLocaleString() }} 金币 · {{ m.hours }}h）</option>
            </select>
            <div v-if="mushroomDraft[b.index]" class="dim mf-sub">
              消耗 {{ Object.entries(getMushroomMedia(md(b.index))?.feed ?? {}).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}
              → {{ Object.entries(getMushroomMedia(md(b.index))?.products ?? {}).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}
            </div>
            <button class="btn btn-sm btn-primary" @click="build(b.index)">铺床并开产</button>
          </template>
        </div>
      </div>

      <!-- ② 灵圃 -->
      <h3 class="mf-title" @click="sOpen = !sOpen">🌱 灵圃 —— 种稀有种子出灵植，供菌灵露 <b>Ⅴ~Ⅷ 档</b>原料{{ sOpen ? '' : '（点击展开）' }}</h3>
      <p v-if="sOpen" class="dim mf-role">
        与菇床的分工：灵圃吃<b>采集掉落的稀有种子</b>，而收获会<b>回收 1 颗同类种子</b> ⇒ <b>一次投入、永久产出</b>；
        它也是唯一能定向稳定拿到高阶灵植（木耳 / 银耳 / 松露 / 龙根 / 灵果）的地方（采集靠概率、还占并行槽）。
      </p>
      <div v-if="sOpen" class="mf-grid">
        <div v-for="p in plots" :key="p.index" class="card mf-cell">
          <div class="mf-head"><strong>灵圃 {{ p.index + 1 }}</strong><span v-if="p.def" class="dim mono mf-fs">{{ p.def.icon }} {{ p.def.name }} · {{ p.def.hours }}h</span></div>
          <template v-if="p.plot">
            <div class="dim mf-sub">种子：{{ p.seedName }}（背包还剩 {{ p.seedLeft }}）</div>
            <ProgressBar :progress="p.progress" />
            <div v-if="!p.ready" class="dim mf-sub mono">成熟还有 {{ fmtMs(p.remainMs) }}</div>
            <div v-else class="mf-ready">✅ 已长成，可收取（并回收 1 颗种子）</div>
            <div class="dim mf-sub">预期产出：{{ p.productText }} + 同类种子×1</div>
            <div class="mf-row">
              <button class="btn btn-sm btn-primary" :disabled="!p.ready" @click="harvest(p.index)">收取</button>
              <button class="btn btn-sm" @click="takeBack(p.index)">撤回（退种子）</button>
            </div>
          </template>
          <template v-else>
            <select v-model="seedDraft[p.index]" class="mf-select">
              <option value="">选择灵植种子…</option>
              <option v-for="s in ownedSeeds" :key="s.seedId" :value="s.seedId" :disabled="!s.ok">
                {{ s.icon }} {{ s.name }}（{{ s.hours }}h · {{ s.qty }} 颗）{{ s.ok ? '' : ` 🔒需采摘 Lv${s.reqLevel}` }}
              </option>
            </select>
            <div v-if="sd(p.index)" class="dim mf-sub">
              {{ getSpiritPlantBySeed(sd(p.index))?.icon }} {{ getSpiritPlantBySeed(sd(p.index))?.name }} →
              {{ Object.entries(getSpiritPlantBySeed(sd(p.index))?.products ?? {}).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}
            </div>
            <button class="btn btn-sm btn-primary" @click="plant(p.index)">种下</button>
          </template>
        </div>
      </div>

      <div v-if="mOpen" class="card mf-table-card">
        <h3>🧫 培养基一览（菇床吃肥料，不占并行槽、不吃种子）</h3>
        <div class="table-scroll">
        <table class="target-table">
          <tbody>
            <tr v-for="m in MUSHROOM_MEDIA" :key="m.id">
              <td class="dim" style="width: 130px">{{ m.icon }} {{ m.name }}</td>
              <td class="mono dim" style="width: 110px">{{ (m.cost ?? 0).toLocaleString() }} 金币</td>
              <td class="dim" style="width: 200px">消耗 {{ Object.entries(m.feed).map(([id, q]) => `${getItem(id)?.name ?? id}×${q}`).join('、') }}</td>
              <td>→ {{ Object.entries(m.products).map(([id, q]) => `${getItem(id)?.name ?? id}×${q}`).join('、') }}<span class="dim">（{{ m.hours }} 小时 / 周期）</span></td>
            </tr>
          </tbody>
        </table>
        </div>
        <p class="dim mf-sub" style="margin-top: 8px">肥料从<b>杂货铺</b>买、或由<b>保鲜</b>技能产出；产出覆盖菌灵露 <b>Ⅰ~Ⅳ 档</b>的主料。</p>
      </div>

      <div v-if="sOpen" class="card mf-table-card">
        <h3>🌱 可种灵植一览（灵圃吃稀有种子，收获回收种子 ⇒ 一次投入、永久产出）</h3>
        <div class="table-scroll">
        <table class="target-table">
          <tbody>
            <tr>
              <th class="dim" style="width: 120px">灵植</th><th class="dim" style="width: 130px">种子</th>
              <th class="dim" style="width: 100px">采摘等级</th><th class="dim" style="width: 80px">周期</th>
              <th>产出</th><th class="dim" style="width: 90px">持有种子</th>
            </tr>
            <tr v-for="sp in SPIRIT_PLANTS" :key="sp.id">
              <td>{{ sp.icon }} {{ sp.name }}</td>
              <td class="dim"><ItemImg :item-id="sp.seedId" size="sm" /> {{ getItem(sp.seedId)?.name ?? sp.seedId }}</td>
              <td class="mono dim">Lv{{ sp.reqLevel }}</td>
              <td class="mono dim">{{ sp.hours }}h</td>
              <td>→ {{ Object.entries(sp.products).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}</td>
              <td class="mono">{{ player.inventory[sp.seedId] ?? 0 }}</td>
            </tr>
          </tbody>
        </table>
        </div>
        <p class="dim mf-sub" style="margin-top: 8px">种子来自<b>采摘/挖掘掉落</b>（10% 概率）与<b>杂货铺</b>；产出覆盖菌灵露 <b>Ⅴ~Ⅷ 档</b>的主料（灵芝另可回 Ⅲ 档）。</p>
      </div>

      <!-- ③ 萃露炉 -->
      <h3 class="mf-title" @click="eOpen = !eOpen">🧪 萃露炉（菌菇 / 灵植 → 菌灵露）{{ eOpen ? '' : '（点击展开）' }}</h3>
      <div v-if="eOpen" class="mf-grid">
        <div v-for="v in vats" :key="v.index" class="card mf-cell">
          <div class="mf-head"><strong>萃露格 {{ v.index + 1 }}</strong><span v-if="v.def" class="dim mono mf-fs">{{ v.def.hours }}h</span></div>
          <template v-if="v.vat">
            <div class="dim mf-sub">{{ v.def?.name }} · {{ v.def ? essenceCostText(v.def, (id) => getItem(id)?.name ?? id) : '' }}</div>
            <ProgressBar :progress="v.progress" />
            <div v-if="!v.ready" class="dim mf-sub mono">出露还有 {{ fmtMs(v.remainMs) }}</div>
            <div v-else class="mf-ready">✅ 已酿成，可收取</div>
            <div v-if="v.def" class="dim mf-sub">效果：{{ essenceEffectText(v.def) }}（{{ v.def.minutes }} 分钟）</div>
            <div class="mf-row">
              <button class="btn btn-sm btn-primary" :disabled="!v.ready" @click="claim(v.index)">收取</button>
              <button class="btn btn-sm" @click="recall(v.index)">撤回（退原料）</button>
            </div>
          </template>
          <template v-else>
            <select v-model="essenceDraft[v.index]" class="mf-select">
              <option v-for="e in essenceRows" :key="e.id" :value="e.id">菌灵露·{{ 'ⅠⅡⅢⅣⅤⅥⅦⅧ'[e.tier - 1] }}（{{ e.hours }}h）</option>
            </select>
            <div v-if="ed(v.index)" class="dim mf-sub">
              投入：{{ essenceRows.find((x) => x.id === ed(v.index))?.costText }}<br>
              产出：{{ essenceRows.find((x) => x.id === ed(v.index))?.effectText }}
            </div>
            <div v-if="ed(v.index) && !essenceRows.find((x) => x.id === ed(v.index))?.can" class="mf-warn">原料不足：{{ essenceRows.find((x) => x.id === ed(v.index))?.lackText }}</div>
            <button class="btn btn-sm btn-primary" :disabled="!essenceRows.find((x) => x.id === ed(v.index))?.can" @click="brew(v.index)">开酿</button>
          </template>
        </div>
      </div>

      <div class="card mf-table-card">
        <h3>🧪 菌灵露 8 档（越靠后越强 · 全是采集拿不到的乘区）</h3>
        <div class="table-scroll">
        <table class="target-table">
          <tbody>
            <tr>
              <th class="dim" style="width: 132px">档位</th><th class="dim" style="width: 130px">主料（等级）</th>
              <th class="dim" style="width: 190px">投入</th><th class="dim" style="width: 70px">周期</th>
              <th>效果</th><th class="dim" style="width: 80px">时长</th><th class="dim" style="width: 70px">持有</th>
            </tr>
            <tr v-for="e in essenceRows" :key="e.id">
              <td style="white-space: nowrap"><ItemImg :item-id="e.id" size="sm" /> {{ e.name }}</td>
              <td class="dim">{{ getItem(e.anchor)?.name }}（Lv{{ e.anchorLv }}）</td>
              <td class="dim mf-fs">{{ e.costText }}</td>
              <td class="mono dim">{{ e.hours }}h</td>
              <td>{{ e.effectText }}</td>
              <td class="mono dim">{{ e.minutes }} 分</td>
              <td class="mono">{{ player.inventory[e.id] ?? 0 }}</td>
            </tr>
          </tbody>
        </table>
        </div>
        <p class="dim mf-sub" style="margin-top: 8px">
          菌灵露是<b>多效增益</b>：一瓶可同时给经验 / 产量 / 采集间隔 / 餐厅收入（按档位逐级解锁后两条）。
          单瓶弱于「两支同阶增益剂叠加」，价值在于把<b>无限的采集产出</b>放大——采集越多，酿露越快。
        </p>
      </div>
    </template>
    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.mf-title { margin: 14px 0 0; font-size: 15px; cursor: pointer; }
.mf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; margin-top: 10px; }
.mf-cell { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.mf-head { display: flex; align-items: baseline; justify-content: space-between; }
.mf-media { display: flex; align-items: center; gap: 10px; }
.mf-icon { font-size: 24px; }
.mf-sub { font-size: 12px; line-height: 1.5; }
.mf-role { font-size: 12px; line-height: 1.6; margin: 6px 0 0; }
.mf-fs { font-size: 12px; }
.mf-ready { font-size: 12px; color: var(--good-strong); }
.mf-warn { font-size: 12px; color: var(--warn-strong); }
.mf-row { display: flex; gap: 8px; flex-wrap: wrap; }
.mf-select {
  width: 100%; height: 32px; padding: 0 8px; font-size: 12px;
  color: var(--text); background: var(--bg-soft); border: 1px solid var(--border); border-radius: 8px;
}
.mf-table-card { margin-top: 14px; padding: 12px 14px; }
</style>
