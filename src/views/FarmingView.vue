<script setup>
// 农耕视图 — 需求文档 §3.1.5：农田格 / 种植 / 生长进度 / 收获
import { computed, reactive, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'
import { DERIVED_MAX } from '../game/data/caps.js'
import { SEASONAL_BONUS, farmSeason, seasonalTip } from '../game/data/farmingSeason.js'
import { TOOL_MAX_LEVEL, TOOL_TIME_PER_LEVEL, nextToolCost } from '../game/data/farmTools.js'
import { PRIME_BASE_CHANCE, PRIME_CROP_ID, PRIME_MAX_CHANCE, PRIME_MIN_LEVEL } from '../game/data/primeCrop.js'
import { masteryDoubleChance, masteryLevelFromCount, masteryYieldBonus } from '../game/core/mastery.js'
import { isHarshWeather } from '../game/data/weather.js'
import ProgressBar from '../components/ProgressBar.vue'

const props = defineProps({
  instance: { type: Object, required: true },
})
const player = usePlayerStore()
const ui = useUiStore()

const selections = reactive({})

/** 精通联动（v2.5.0）：该作物的农耕精通给采集带来的额外产出几率（0 ~ 20%） */
const farmGatherPct = (itemId) => player.farmMasteryGatherChance?.(itemId) ?? 0
/** 精耕作物（农耕独占产物）的附产区间说明 */
const primeRange = `reqLevel ≥ ${PRIME_MIN_LEVEL} 的作物收获时 ${Math.round(PRIME_BASE_CHANCE * 100)}%~${Math.round(PRIME_MAX_CHANCE * 100)}% 附产「精耕作物」（随该作物精通提高）`

/** 本月当季类别（UI 里给作物打「当季」标） */
const seasonCats = computed(() => farmSeason().cats)
const isSeasonal = (cat) => seasonCats.value.includes(cat)
/** 天气对农田产量的一句话（好天气加成 / 坏天气减益）——温室不吃天气，见页面提示 */
const farmWeatherText = computed(() => {
  const m = player.weatherEffects?.().farmYield ?? 1
  if (m === 1) return '×1.00（无影响）'
  return `×${m.toFixed(2)}（${m > 1 ? '+' : ''}${Math.round((m - 1) * 100)}%）`
})

// ── 农具（v2.4.1）：花金币缩短生长时间；顺带把「折合产出」算出来，避免玩家以为农耕没用 ──
const toolLv = computed(() => player.farmToolLevel())
const toolCost = computed(() => nextToolCost(toolLv.value))
const toolTimeText = (growSec) => `${Math.round(growSec * player.farmTimeFactor())}s`
/** 某作物的「每次收获期望件数」（含精通保底批量与双倍；丰沃肥料/山海食经等按未施状态估） */
function expectedPerHarvest(crop) {
  const m = masteryLevelFromCount(props.instance.mastery?.[crop.itemId] ?? 0)
  const base = 1 + masteryYieldBonus(m)
  return base * (1 + masteryDoubleChance(m))
}
/** 全部地块折合「件/分钟」，并与一条满精通采集线（约 30 件/分）做对照 */
const farmRate = computed(() => {
  ui.loopTick
  const perMin = props.instance.plots.reduce((acc, _p, i) => {
    const crop = props.instance.plotCrop(i)
    if (!crop) return acc
    const sec = props.instance.growSecOf(crop)
    if (!sec) return acc
    return acc + (expectedPerHarvest(crop) / sec) * 60
  }, 0)
  const wx = player.weatherEffects?.().farmYield ?? 1
  const total = perMin * wx
  return { perMin: total, lines: total / 30 }
})
function upgradeTool() {
  const r = player.upgradeFarmTool()
  if (r.ok) ui.pushLog(`🧰 农具升到 Lv${r.level}：农田生长时间 −${r.level * TOOL_TIME_PER_LEVEL * 100}%`, 'gain')
  else ui.pushLog(r.msg, 'warn')
}

function remainingSec(i) {
  ui.loopTick // 依赖全局循环计数：每帧重算倒计时（实时刷新）
  const crop = props.instance.plotCrop(i)
  const p = props.instance.plotAt(i)
  if (!crop || !p) return 0
  const remain = props.instance.growSecOf(crop) * 1000 - (Date.now() - p.plantedAt)
  return Math.max(0, Math.ceil(remain / 1000))
}
/** 生长进度（实时）：依据 ui.loopTick 逐帧刷新 */
function plotProgressPct(i) {
  ui.loopTick
  return props.instance.plotProgress(i)
}
function goShop() {
  ui.setView('shop')
}
function harvestAll() {
  const n = props.instance.harvestAll()
  if (n > 0) ui.pushLog(`🌾 一键收获 ${n} 块地块`, 'gain')
}
function plantAll(seedId) {
  const n = props.instance.plantAll(seedId)
  if (n > 0) ui.pushLog(`🌱 种满 ${n} 块空地块`, 'info')
  else ui.pushLog('种子不足或没有空地块', 'warn')
}

// ── 弹窗选种（替代下拉）：点击某地块「选择种子」打开弹窗，点选某种子即设为该地块种子 ──
const seedModalOpen = ref(false)
const seedPickIndex = ref(0)
function openSeedPicker(i) {
  seedPickIndex.value = i
  seedModalOpen.value = true
}
function pickSeed(seedId) {
  selections[seedPickIndex.value] = seedId
  seedModalOpen.value = false
}
function seedName(seedId) {
  return seedId ? (getItem(seedId)?.name ?? seedId) : '未选择种子'
}
</script>

<template>
  <div>
    <div class="card status-line">
      <span class="badge badge-on">农田 {{ instance.plots.filter((p) => p).length }}/{{ instance.maxPlots }}</span>
      <span class="dim">（每 {{ DERIVED_MAX.farmPlotsPerLevels }} 级农耕 +1 块（上限 {{ DERIVED_MAX.farmPlots }}）；作物枯萎 3%，施肥可降至 1%/0%）</span>
      <span v-if="instance.harvestableCount" class="badge" style="background: var(--good-soft); color: var(--good-strong)">可收获 {{ instance.harvestableCount }}</span>
    </div>

    <!-- 农具（v2.4.1）：用金币缩短「等」的时间；折合产出让「农耕值不值」一目了然 -->
    <div class="card status-line">
      <span class="badge badge-on">🧰 农具 Lv{{ toolLv }}/{{ TOOL_MAX_LEVEL }}</span>
      <span class="dim">农田生长时间 <b class="mono">−{{ toolLv * TOOL_TIME_PER_LEVEL * 100 }}%</b>（小麦 {{ toolTimeText(90) }} · 灵果 {{ toolTimeText(990) }}）</span>
      <span class="dim">全部地块折合 ≈ <b class="mono">{{ farmRate.perMin.toFixed(1) }}</b> 件/分 ·
        约 <b class="mono">{{ farmRate.lines.toFixed(1) }}</b> 条满精通采集线（农田不占并行挂机槽）</span>
      <button v-if="toolCost != null" class="btn btn-sm" style="margin-left: auto" @click="upgradeTool">
        🧰 升级农具（{{ toolCost.toLocaleString() }} 金币）
      </button>
      <span v-else class="badge">农具已满级</span>
    </div>

    <!-- 农耕的独占产物（v2.5.0）：把「农耕」与「采摘/挖掘」拉开差异 -->
    <div class="card status-line">
      <span class="badge" style="background: var(--primary-soft); color: var(--primary-deep)">🧺 精耕作物</span>
      <span class="dim">
        {{ primeRange }}——这是<b>农田独有</b>的高级产物（采集/商店/抽奖都拿不到），持有 <b class="mono">{{ player.inventory[PRIME_CROP_ID] ?? 0 }}</b> 件；
        可给<b>萃露炉加料</b>（酿造时间 −40%）或在商店出售。
      </span>
      <span class="dim">精通联动：把某作物种到精通，<b>采集该物品</b>时额外产出几率也随之提高（每 10 级 +2%、上限 +20%）</span>
    </div>

    <!-- 农时（v2.4.0）：当季作物 ×1.5 + 天气对农田的影响；温室不吃天气 ⇒ 坏天气时的避风港 -->
    <div class="card status-line">
      <span class="badge" style="background: var(--primary-soft); color: var(--primary-deep)">🌱 {{ seasonalTip() }}</span>
      <span class="dim">
        今日天气 <b>{{ player.todayWeather().icon }} {{ player.todayWeather().name }}</b>：
        农田产量 <b class="mono">{{ farmWeatherText }}</b>
        <template v-if="isHarshWeather(player.todayWeather())">（⚠️ 恶劣天气——<b>温室不受天气影响</b>，可先种到温室去）</template>
      </span>
    </div>

    <!-- 农田网格 -->
    <div class="card">
      <h3 class="target-head-row">
        <span>农田</span>
        <span class="target-head-extra">
          <button class="btn btn-sm" :disabled="!instance.harvestableCount" @click="harvestAll()">一键收获</button>
        </span>
      </h3>
      <div class="plots-grid">
        <div v-for="i in instance.maxPlots" :key="i - 1" class="plot">
          <!-- 空地 -->
          <template v-if="!instance.plotAt(i - 1)">
            <div class="plot-title dim">空地 {{ i }}</div>
            <template v-if="instance.plantableSeeds.length">
              <button class="btn btn-sm plot-select-btn" @click="openSeedPicker(i - 1)">
                🌱 {{ seedName(selections[i - 1]) }} ▾
              </button>
              <button
                class="btn btn-sm btn-primary"
                :disabled="!selections[i - 1] || !instance.isSeedUnlocked(selections[i - 1]) || !instance.hasSeed(selections[i - 1])"
                @click="instance.plant(i - 1, selections[i - 1])"
              >
                种植
              </button>
              <button class="btn btn-sm" :disabled="!selections[i - 1] || !instance.isSeedUnlocked(selections[i - 1]) || !instance.hasSeed(selections[i - 1])" @click="plantAll(selections[i - 1])">
                种满
              </button>
            </template>
            <div v-else class="plot-empty">
              <span class="dim">没有可种的种子</span>
              <button class="btn btn-sm" @click="goShop">去商店</button>
            </div>
          </template>

          <!-- 已种植 / 枯萎 -->
          <template v-else>
            <div v-if="instance.plotAt(i - 1).withered" class="plot-withered">
              <div class="plot-title">🌾 枯萎</div>
              <button class="btn btn-sm" @click="instance.harvest(i - 1)">清理</button>
            </div>
            <template v-else>
              <div class="plot-title item-label">
                <img v-if="itemImage(instance.plotCrop(i - 1)?.itemId)" :src="itemImage(instance.plotCrop(i - 1)?.itemId)" class="item-img item-img-sm" @error="$event.target.style.display = 'none'" alt="" />
                {{ getItem(instance.plotCrop(i - 1)?.itemId)?.name }}
                <span v-if="instance.plotAt(i - 1).fertilizer" class="badge" style="background: var(--good-soft); color: var(--good-strong); font-size: 12px">
                  {{ instance.plotAt(i - 1).fertilizer === 'richCompost' ? '🌿 肥沃堆肥' : '🌱 堆肥' }}
                </span>
              </div>
              <ProgressBar :progress="plotProgressPct(i - 1)" />
              <div v-if="instance.isMature(i - 1)" class="plot-mature">已成熟！</div>
              <div v-else class="dim mono">剩余 {{ remainingSec(i - 1) }}s · 枯萎 {{ (instance.witherChance(i - 1) * 100).toFixed(0) }}%</div>
              <!-- ⚠️ 已施肥的田不再显示施肥按钮（2026-09-14 用户实测：原先可重复点、每次都扣肥料）。
                   已施肥时改为一句提示；真正的拦截在 FarmingSkill.fertilize 里（防 UI 之外调用）。 -->
              <div v-if="!instance.isMature(i - 1) && instance.plotAt(i - 1).fertilizer !== 'richCompost'" class="plot-fert">
                <!-- 已施「堆肥」后不再显示同种按钮（同种/降级会被拒且白扣料）；「沃肥」仍可覆盖升级 -->
                <button
                  v-if="!instance.plotAt(i - 1).fertilizer"
                  class="btn btn-sm"
                  :disabled="!(player.inventory.compost ?? 0)"
                  @click="instance.fertilize(i - 1, 'compost')"
                >
                  堆肥{{ player.inventory.compost ?? 0 }}
                </button>
                <button
                  class="btn btn-sm"
                  :disabled="!(player.inventory.richCompost ?? 0)"
                  @click="instance.fertilize(i - 1, 'richCompost')"
                >
                  沃肥{{ player.inventory.richCompost ?? 0 }}
                </button>
              </div>
              <div v-else-if="!instance.isMature(i - 1)" class="dim plot-fert-note">本季已施沃肥（最好的一档），等收获后再施</div>
              <button class="btn btn-sm btn-primary" :disabled="!instance.isMature(i - 1)" @click="instance.harvest(i - 1)">
                收获
              </button>
            </template>
          </template>
        </div>
      </div>
    </div>

    <p class="dim special-note">种子在「杂货铺」购买；肥料在「杂货铺」购买或「食材保鲜」制作（堆肥：土豆×2；肥沃堆肥：堆肥×2 + 辣椒×2 + 苹果×3）。作物出售约保本，主要价值在制作链（面粉/料理等）。</p>

    <!-- 选种弹窗：列表样式与背包/仓库(图鉴物品)一致，点选即设为该地块种子 -->
    <div v-if="seedModalOpen" class="modal-backdrop" @click.self="seedModalOpen = false">
      <div class="modal">
        <div class="modal-head">
          <h3>选择种子 · 地块 {{ seedPickIndex + 1 }}</h3>
          <button class="btn btn-sm" @click="seedModalOpen = false">✕</button>
        </div>
        <p v-if="instance.plantableSeeds.length" class="dim" style="margin: 6px 0 0">共 {{ instance.plantableSeeds.length }} 种可种种子，点击选中（未拥有的不显示）。</p>
        <div class="item-grid seed-crop-grid">
          <div
            v-for="c in instance.plantableSeeds"
            :key="c.seedId"
            class="item-cell"
            :class="{ active: selections[seedPickIndex] === c.seedId }"
            @click="pickSeed(c.seedId)"
          >
            <div class="item-cell-head">
              <img v-if="itemImage(c.seedId)" :src="itemImage(c.seedId)" class="item-img item-img-sm" @error="$event.target.style.display = 'none'" alt="" />
              <span class="item-cell-name">{{ getItem(c.seedId)?.name }}</span>
            </div>
            <div class="dim item-cell-sub">
              <span>Lv.{{ c.reqLevel }}</span>
              <span class="mono">×{{ player.inventory[c.seedId] ?? 0 }}</span>
            </div>
            <div class="item-cell-sub" style="font-size: 12px">
              <span class="dim">{{ toolTimeText(c.growSec) }} 生长</span>
              <span class="dim">{{ c.xp }} 经验</span>
            </div>
            <div v-if="farmGatherPct(c.itemId) > 0" class="item-cell-sub" style="font-size: 12px">
              <span class="badge" style="background: var(--good-soft); color: var(--good-strong)">采集 +{{ Math.round(farmGatherPct(c.itemId) * 100) }}%</span>
            </div>
            <div v-if="isSeasonal(getItem(c.itemId)?.category)" class="item-cell-sub" style="font-size: 12px">
              <span class="badge" style="background: var(--primary-soft); color: var(--primary-deep)">当季 ×{{ SEASONAL_BONUS }}</span>
            </div>
          </div>
        </div>
        <p v-if="!instance.plantableSeeds.length" class="dim">没有可种的种子（需已拥有且等级足够，可去商店购买）。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 选种弹窗：复刻背包/仓库图鉴物品网格样式（item-cell），固定 4 列 */
.seed-crop-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  max-height: 320px;
  overflow-y: auto;
  margin-top: 10px;
}
.seed-crop-grid .item-cell.active {
  border-color: var(--primary);
  background: rgba(var(--primary-tint-rgb), 0.16);
  box-shadow: 0 0 0 2px var(--primary) inset;
}
/* 地块「选择种子」按钮（与 plot-select 视觉一致） */
.plot-select-btn { justify-content: flex-start; }
</style>
