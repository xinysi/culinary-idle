<script setup>
// 温室蜂场（2026-09-14 新增）— 挂机产线：**温室 + 蜂场合并一页**（用户指定）。
//   ① 温室：种既有作物种子（任意 CROPS），生长时间 ×0.75；收获作物，并有 10% 概率伴生一瓶蜂蜜，
//      品级由该作物的 reqLevel 决定（honey.js）。
//   ② 蜂箱（原蜂场）：用**花类**做蜜源，短周期稳定产蜜，品级由花的等级决定。
// 蜂蜜的**唯一来源就是本页**（不进掉落/商店/抽卡/交易所）。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { GREENHOUSE_UNLOCK_LEVEL, GREENHOUSE_HONEY_CHANCE, HIVE_MEDIA, getHiveMedia, greenhouseCrop, greenhouseGrowMs, hiveMediaLevel, nextGreenhouseExpandCost, nextHiveExpandCost } from '../game/data/greenhouse.js'
import { IDLE_CAP_HOURS } from '../game/data/caps.js'
import { HONEY_TIERS, honeyTierForLevel } from '../game/data/honey.js'
import { CROPS } from '../game/skills/FarmingSkill.js'
import { getItem } from '../game/data/items.js'
import { getSkillDef } from '../game/data/skills.js'
import ProgressBar from '../components/ProgressBar.vue'
import ItemImg from '../components/ItemImg.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'mycoField', label: '🌿 灵圃菌房' },
  { view: 'skill', skill: 'farming', label: '🌾 农耕' },
  { view: 'ranch', label: '🐄 牧场' },
]

const unlocked = computed(() => player.greenhouseUnlocked())
const expandCost = computed(() => nextGreenhouseExpandCost(player.greenhouseBeds()))
const hiveCost = computed(() => nextHiveExpandCost(player.hiveCount()))

const seedDraft = ref({})
function sd(i) {
  if (seedDraft.value[i] === undefined) seedDraft.value[i] = ''
  return seedDraft.value[i]
}
const mediaDraft = ref({})
function md(i) {
  if (!mediaDraft.value[i]) mediaDraft.value[i] = HIVE_MEDIA[0].id
  return mediaDraft.value[i]
}

/** 背包里的作物种子（可种者在前，按等级升序） */
const ownedSeeds = computed(() => {
  ui.loopTick
  const lv = player.skills?.['farming']?.level ?? 1
  return CROPS.filter((c) => (player.inventory[c.seedId] ?? 0) > 0)
    .map((c) => ({ ...c, qty: player.inventory[c.seedId] ?? 0, ok: lv >= c.reqLevel }))
    .sort((a, b) => a.reqLevel - b.reqLevel)
})

const beds = computed(() => {
  ui.loopTick
  const now = Date.now()
  const st = player.greenhouseState()
  return Array.from({ length: player.greenhouseBeds() }, (_, i) => {
    const bed = st.beds[i] ?? null
    const crop = bed ? greenhouseCrop(bed.seedId) : null
    const growMs = bed ? greenhouseGrowMs(bed.seedId) : 0
    const elapsed = bed ? now - (bed.plantedAt ?? now) : 0
    const tier = crop ? honeyTierForLevel(crop.reqLevel) : 0
    return {
      index: i,
      bed,
      crop,
      progress: growMs > 0 ? Math.min(1, elapsed / growMs) : 0,
      remainMs: growMs > 0 ? Math.max(0, growMs - elapsed) : 0,
      seedName: bed ? getItem(bed.seedId)?.name ?? bed.seedId : '',
      seedLeft: bed ? (player.inventory[bed.seedId] ?? 0) : 0,
      honeyName: tier ? HONEY_TIERS[tier - 1].name : '',
      productName: crop ? getItem(crop.itemId)?.name ?? crop.itemId : '',
    }
  })
})

const hives = computed(() => {
  ui.loopTick
  const now = Date.now()
  const st = player.greenhouseState()
  return Array.from({ length: player.hiveCount() }, (_, i) => {
    const hive = st.hives[i] ?? null
    const def = hive ? getHiveMedia(hive.mediaId) : null
    const cycleMs = (def?.hours ?? 0) * 3600_000
    const elapsed = hive ? now - (hive.lastAt ?? now) : 0
    const tier = def ? honeyTierForLevel(hiveMediaLevel(def.id)) : 0
    const canFeed = def ? Object.entries(def.feed).every(([id, q]) => (player.inventory[id] ?? 0) >= q) : false
    return {
      index: i,
      hive,
      def,
      canFeed,
      progress: def ? Math.min(1, elapsed / cycleMs) : 0,
      remainMs: def ? Math.max(0, cycleMs - elapsed) : 0,
      feedText: def ? Object.entries(def.feed).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') : '',
      honeyName: tier ? HONEY_TIERS[tier - 1].name : '',
      honeyId: tier ? HONEY_TIERS[tier - 1].id : null,
    }
  })
})

const stats = computed(() => ({
  cycles: player.stats?.greenhouseCycles ?? 0,
  honey: player.stats?.honeyHarvests ?? 0,
}))

function fmtMs(ms) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${s % 60} 秒`
  return `${s} 秒`
}
function plant(i) {
  const r = player.greenhousePlant(i, sd(i))
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  seedDraft.value[i] = ''
}
function clearBed(i) {
  if (player.greenhouseClear(i)) ui.pushLog('已清空该温室格', 'info')
}
function setHive(i) {
  const r = player.hiveSet(i, md(i))
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function clearHive(i) {
  if (player.hiveClear(i)) ui.pushLog('已移出蜂群', 'info')
}
function expand() {
  const r = player.greenhouseExpand()
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function expandHive() {
  const r = player.hiveExpand()
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🐝 温室蜂场</h2>
        <p class="dim">
          温室里种作物（生长提速 25%），每次收获有 <b>{{ Math.round(GREENHOUSE_HONEY_CHANCE * 100) }}%</b> 概率<b>伴生一瓶蜂蜜</b>，
          品级随作物等级；蜂箱则用<b>花类</b>做蜜源稳定产蜜。<b>蜂蜜只能在这里得到</b>——喝一瓶同时给经验与产量两条乘数。
        </p>
      </div>
      <div style="display: flex; gap: 8px; margin-left: auto">
        <button v-if="unlocked && expandCost != null" class="btn btn-sm" @click="expand">🧱 温室 +1 格（{{ expandCost.toLocaleString() }}）</button>
        <button v-if="unlocked && hiveCost != null" class="btn btn-sm" @click="expandHive">🐝 蜂箱 +1（{{ hiveCost.toLocaleString() }}）</button>
      </div>
    </header>

    <div v-if="!unlocked" class="card status-line">
      <span class="badge">🔒 未解锁</span>
      <span class="dim">需 {{ getSkillDef('farming')?.name ?? '农耕' }} Lv{{ GREENHOUSE_UNLOCK_LEVEL }} 解锁温室蜂场</span>
    </div>

    <template v-else>
      <div class="card status-line">
        <span class="badge badge-on">温室 {{ player.greenhouseBeds() }} 格 · 蜂箱 {{ player.hiveCount() }} 只</span>
        <span class="dim">累计收获 <b class="mono">{{ stats.cycles.toLocaleString() }}</b> 次 ·
          累计得蜜 <b class="mono">{{ stats.honey.toLocaleString() }}</b> 瓶（离线单次最多补 {{ IDLE_CAP_HOURS }} 小时）</span>
      </div>

      <h3 class="gh-title">🌱 温室（作物 + 伴生蜂蜜）</h3>
      <div class="gh-grid">
        <div v-for="b in beds" :key="b.index" class="card gh-bed">
          <div class="gh-head">
            <strong>温室格 {{ b.index + 1 }}</strong>
            <span v-if="b.crop" class="dim mono" style="font-size: 12px">{{ Math.round(greenhouseGrowMs(b.bed.seedId) / 1000) }}s / 轮</span>
          </div>
          <template v-if="b.bed">
            <div class="gh-crop">
              <ItemImg :item-id="b.crop?.itemId ?? b.bed.seedId" size="lg" />
              <div>
                <div>{{ b.seedName }} → {{ b.productName }}</div>
                <div class="dim gh-sub">伴生蜂蜜：{{ b.honeyName }}（{{ Math.round(GREENHOUSE_HONEY_CHANCE * 100) }}%）</div>
              </div>
            </div>
            <ProgressBar :progress="b.progress" />
            <div class="dim gh-sub mono">下次收获还有 {{ fmtMs(b.remainMs) }}</div>
            <div class="dim gh-sub">背包剩余同种种子：{{ b.seedLeft }}（有则收后自动续种）</div>
            <button class="btn btn-sm" @click="clearBed(b.index)">清空</button>
          </template>
          <template v-else>
            <select v-model="seedDraft[b.index]" class="gh-select">
              <option value="">选择作物种子…</option>
              <option v-for="s in ownedSeeds" :key="s.seedId" :value="s.seedId" :disabled="!s.ok">
                {{ getItem(s.itemId)?.name ?? s.itemId }}（Lv{{ s.reqLevel }} · {{ s.qty }} 颗）{{ s.ok ? '' : ' 🔒' }}
              </option>
            </select>
            <div v-if="sd(b.index)" class="dim gh-sub">
              收获 {{ getItem(greenhouseCrop(sd(b.index))?.itemId)?.name }} ·
              伴生蜂蜜最高可达 {{ HONEY_TIERS[honeyTierForLevel(greenhouseCrop(sd(b.index))?.reqLevel ?? 1) - 1].name }}
            </div>
            <button class="btn btn-sm btn-primary" @click="plant(b.index)">种下</button>
          </template>
        </div>
        <div v-if="!ownedSeeds.length" class="card gh-empty dim">背包里没有作物种子——去杂货铺买或采集时掉落。</div>
      </div>

      <h3 class="gh-title">🐝 蜂箱（花类蜜源 → 稳定产蜜）</h3>
      <div class="gh-grid">
        <div v-for="h in hives" :key="h.index" class="card gh-bed">
          <div class="gh-head">
            <strong>蜂箱 {{ h.index + 1 }}</strong>
            <span v-if="h.def" class="dim mono" style="font-size: 12px">{{ h.def.hours }}h / 周期</span>
          </div>
          <template v-if="h.def">
            <div class="gh-crop">
              <span class="gh-icon">{{ h.def.icon }}</span>
              <div>
                <div>{{ h.def.name }}</div>
                <div class="dim gh-sub">蜜源：{{ h.feedText }}</div>
              </div>
            </div>
            <ProgressBar :progress="h.progress" />
            <div v-if="h.canFeed" class="dim gh-sub mono">下次取蜜还有 {{ fmtMs(h.remainMs) }}</div>
            <div class="dim gh-sub">产出：<ItemImg v-if="h.honeyId" :item-id="h.honeyId" size="sm" /> {{ h.honeyName }} ×{{ h.def.honeyQty }}</div>
            <div v-if="!h.canFeed" class="gh-warn">⏸ 已停机：蜜源不足（{{ h.feedText }}），补上花才会重新计时</div>
            <button class="btn btn-sm" @click="clearHive(h.index)">移出蜂群</button>
          </template>
          <template v-else>
            <select v-model="mediaDraft[h.index]" class="gh-select">
              <option v-for="m in HIVE_MEDIA" :key="m.id" :value="m.id">
                {{ m.icon }} {{ m.name }}（{{ m.hours }}h · 产 {{ HONEY_TIERS[honeyTierForLevel(hiveMediaLevel(m.id)) - 1].name }}）
              </option>
            </select>
            <div v-if="md(h.index)" class="dim gh-sub">
              消耗 {{ Object.entries(getHiveMedia(md(h.index))?.feed ?? {}).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、') }}
              → {{ HONEY_TIERS[honeyTierForLevel(hiveMediaLevel(md(h.index))) - 1].name }} ×{{ getHiveMedia(md(h.index))?.honeyQty }}
            </div>
            <button class="btn btn-sm btn-primary" @click="setHive(h.index)">放入蜂群</button>
          </template>
        </div>
      </div>

      <div class="card" style="margin-top: 14px">
        <h3>🍯 蜂蜜一览（8 品级 · 双效增益）</h3>
        <table class="target-table">
          <tbody>
            <tr>
              <th class="dim" style="width: 70px">品级</th><th class="dim" style="width: 110px">名称</th>
              <th class="dim" style="width: 110px">来源等级</th><th class="dim">效果（使用后同时生效）</th>
              <th class="dim" style="width: 110px">时长</th><th class="dim" style="width: 90px">持有</th>
            </tr>
            <tr v-for="h in HONEY_TIERS" :key="h.id">
              <td class="mono dim">{{ h.tier }} 品</td>
              <td><ItemImg :item-id="h.id" size="sm" /> {{ h.name }}</td>
              <td class="mono dim">作物 Lv{{ h.minLevel }}+</td>
              <td>经验 ×{{ h.xp }} + 产量 ×{{ h.yield }} <span class="dim">· {{ h.desc }}</span></td>
              <td class="mono dim">{{ h.minutes }} 分钟</td>
              <td class="mono">{{ player.inventory[h.id] ?? 0 }}</td>
            </tr>
          </tbody>
        </table>
        <p class="dim gh-sub" style="margin-top: 8px">
          蜂蜜是**双效**增益（一次同时给经验与产量两条乘数），单瓶弱于「两支同阶增益剂叠加」，
          但只占一个背包格子；在背包或物品详情里点「使用 1」即可饮用。
        </p>
      </div>
    </template>
    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.gh-title { margin: 14px 0 0; font-size: 15px; }
.gh-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.gh-bed {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gh-empty { padding: 14px; }
.gh-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.gh-crop { display: flex; align-items: center; gap: 10px; }
.gh-icon { font-size: 24px; }
.gh-sub { font-size: 12px; line-height: 1.5; }
.gh-warn { font-size: 12px; color: var(--warn-strong); }
.gh-select {
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
