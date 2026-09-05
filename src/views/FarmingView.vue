<script setup>
// 农耕视图 — 需求文档 §3.1.5：农田格 / 种植 / 生长进度 / 收获
import { reactive, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'
import ProgressBar from '../components/ProgressBar.vue'

const props = defineProps({
  instance: { type: Object, required: true },
})
const player = usePlayerStore()
const ui = useUiStore()

const selections = reactive({})

function remainingSec(i) {
  ui.loopTick // 依赖全局循环计数：每帧重算倒计时（实时刷新）
  const crop = props.instance.plotCrop(i)
  const p = props.instance.plotAt(i)
  if (!crop || !p) return 0
  const remain = crop.growSec * 1000 - (Date.now() - p.plantedAt)
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
      <span class="dim">（每 5 级农耕 +1 块（上限 20）；作物枯萎 3%，施肥可降至 1%/0%）</span>
      <span v-if="instance.harvestableCount" class="badge" style="background: var(--good-soft); color: var(--good-strong)">可收获 {{ instance.harvestableCount }}</span>
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
                <span v-if="instance.plotAt(i - 1).fertilizer" class="badge" style="background: var(--good-soft); color: var(--good-strong); font-size: 10px">
                  {{ instance.plotAt(i - 1).fertilizer === 'richCompost' ? '🌿 肥沃堆肥' : '🌱 堆肥' }}
                </span>
              </div>
              <ProgressBar :progress="plotProgressPct(i - 1)" />
              <div v-if="instance.isMature(i - 1)" class="plot-mature">已成熟！</div>
              <div v-else class="dim mono">剩余 {{ remainingSec(i - 1) }}s · 枯萎 {{ (instance.witherChance(i - 1) * 100).toFixed(0) }}%</div>
              <div v-if="!instance.isMature(i - 1)" class="plot-fert">
                <button
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
            <div class="item-cell-sub" style="font-size: 11px">
              <span class="dim">{{ c.growSec }}s 生长</span>
              <span class="dim">{{ c.xp }} 经验</span>
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
  background: rgba(217, 90, 56, 0.16);
  box-shadow: 0 0 0 2px var(--primary) inset;
}
/* 地块「选择种子」按钮（与 plot-select 视觉一致） */
.plot-select-btn { justify-content: flex-start; }
</style>
