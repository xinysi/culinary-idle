<script setup>
// 觅珍抽卡 — 材料/食物/厨具三池（2026-09-06 重排：翻牌揭示版）
// 参考行业通用 gacha 模式：卡背呼吸光 → 逐张 3D 翻转 → 品质光晕/神话金光 → 十连 5×2 网格 + 历史
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { MIJIAN_POOLS, GEAR_PITY, poolPreview } from '../game/data/mijianDraws.js'
import { getItem } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

const activePool = ref('material')
const pool = computed(() => MIJIAN_POOLS.find((p) => p.id === activePool.value))
const isGearPool = computed(() => activePool.value === 'gear')
const pity = computed(() => player.mijianPity())
const bgItems = computed(() => {
  const list = poolPreview(activePool.value, 20)
  return [...list, ...list] // 双份 → translateX(-50%) 无痕循环
})

// 抽卡结果（翻牌揭示序列）：{ id, rare, revealed }
const results = ref([])
const drawing = ref(false)
const allRevealed = computed(() => results.value.length > 0 && results.value.every((r) => r.revealed))

function draw(count) {
  if (drawing.value) return
  const r = player.drawMijian(activePool.value, count)
  if (!r) return
  if (!r.ok) { ui.pushLog(`🎴 觅珍：${r.msg}`, 'warn'); return }
  // 构建翻牌列表（卡背朝上，逐张揭示）
  results.value = r.results
    .filter(Boolean)
    .map((it, i) => ({
      id: it.id,
      rare: it.type === 'equipment' && ['稀有', '史诗', '传说', '神话'].includes(it.quality),
      revealed: false,
      delay: i * 0.13,
    }))
  drawing.value = true
  results.value.forEach((item, i) => {
    setTimeout(() => {
      item.revealed = true
      if (i === results.value.length - 1) drawing.value = false
    }, 380 + i * 130)
  })
  ui.pushLog(`🎴 觅珍：${pool.value.name} ×${count}，获得 ${r.got.length} 件${r.boosted ? '（保底命中 ⭐）' : ''}`, 'gain')
}
function confirmResults() {
  results.value = []
}

const QUALITY_META = {
  普通: { cls: 'q-common', text: '普通' },
  精良: { cls: 'q-fine', text: '精良' },
  稀有: { cls: 'q-rare', text: '稀有' },
  史诗: { cls: 'q-epic', text: '史诗' },
  传说: { cls: 'q-legend', text: '传说' },
  神话: { cls: 'q-myth', text: '神话' },
}
function qMeta(id) {
  const q = getItem(id)?.quality
  return QUALITY_META[q] ?? QUALITY_META['普通']
}
function typeLabel(id) {
  const it = getItem(id)
  if (!it) return ''
  return it.type === 'equipment' ? (it.quality ?? '') : `T${it.tier ?? ''}`
}
</script>

<template>
  <div class="combat-view mijian-view">
    <header class="skill-head">
      <div>
        <h2>🎴 觅珍</h2>
        <p class="dim">三种卡池 · 金币抽取 · 价值加权随机；厨具池每 10 抽保底稀有及以上</p>
      </div>
      <div class="skill-head-right">
        <div class="season-pts-card">
          <span class="dim">已抽</span>
          <strong class="mono">{{ player.mijian?.stats?.pulls ?? 0 }}</strong>
          <span class="dim">次 · {{ (player.mijian?.stats?.spent ?? 0).toLocaleString() }} 金</span>
        </div>
      </div>
    </header>

    <!-- 池子选择 -->
    <div class="card">
      <div class="region-tabs">
        <button
          v-for="p in MIJIAN_POOLS"
          :key="p.id"
          class="btn btn-sm"
          :class="{ 'btn-primary': activePool === p.id }"
          @click="activePool = p.id"
        >{{ p.icon }} {{ p.name }}（{{ p.price }} 金/抽）</button>
      </div>
      <p class="dim">{{ pool.desc }}</p>
      <template v-if="isGearPool">
        <p class="dim">⭐ 保底进度：{{ pity.current }}/{{ pity.need }}（{{ pity.need - pity.current }} 抽内必出稀有及以上）</p>
      </template>
    </div>

    <!-- 抽卡轮播条：白色背景框，物品图在抽卡按钮上方滚动 -->
    <div class="card mijian-carousel">
      <div class="mijian-bg" aria-hidden="true">
        <div class="mijian-bg-track">
          <img v-for="(b, i) in bgItems" :key="b.id + '-' + i" :src="b.img" alt="" loading="lazy" />
        </div>
      </div>
    </div>

    <!-- 抽卡操作台 -->
    <div class="card gacha-pull">
      <div class="region-tabs">
        <button class="btn btn-primary btn-lg" :disabled="drawing || player.gold < pool.price" @click="draw(1)">🎴 单抽（{{ pool.price }} 金）</button>
        <button class="btn btn-primary btn-lg" :disabled="drawing || player.gold < pool.price * 10" @click="draw(10)">🎴🎴 十连（{{ pool.price * 10 }} 金）</button>
        <span class="dim" style="margin-left: auto">持有金币 <span class="mono">{{ player.gold.toLocaleString() }}</span></span>
      </div>
    </div>

    <!-- 结果揭示（卡背 → 逐张 3D 翻转；品质光晕 / 神话金光；十连 5×2 网格） -->
    <div v-if="results.length" class="card gacha-results">
      <h3>抽卡结果 <span class="dim mono" style="font-size: 12px">{{ results.length }} 张</span></h3>
      <div class="gacha-grid" :class="{ single: results.length === 1 }">
        <div
          v-for="(r, i) in results"
          :key="r.id + '-' + i"
          class="gacha-card"
          :class="[qMeta(r.id).cls, { revealed: r.revealed }]"
          :style="{ animationDelay: r.delay + 's' }"
        >
          <div class="gacha-inner" :style="{ transitionDelay: r.delay + 's' }" :title="getItem(r.id)?.name">
            <!-- 卡背 -->
            <div class="gacha-face gacha-back">
              <span class="gacha-back-mark">觅</span>
              <span class="gacha-back-sub">觅珍</span>
            </div>
            <!-- 卡面 -->
            <div class="gacha-face gacha-front">
              <img v-if="itemImage(r.id)" :src="itemImage(r.id)" class="gacha-img" @error="$event.target.style.display = 'none'" alt="" />
              <div class="gacha-front-name">{{ getItem(r.id)?.name }}</div>
              <div class="gacha-front-sub mono">{{ typeLabel(r.id) }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="gacha-actions">
        <button v-if="allRevealed" class="btn btn-sm btn-primary" @click="confirmResults">确认收下</button>
        <span v-else class="dim">正在揭示……</span>
      </div>
    </div>

    <!-- 历史（最近 5 次） -->
    <div v-if="(player.mijian?.history ?? []).length" class="card gacha-history">
      <h3>最近开箱记录</h3>
      <div class="gacha-history-row">
        <span
          v-for="(h, i) in player.mijian.history"
          :key="'h' + i"
          class="ing"
          :class="h === 'rare' ? 'gacha-hist-rare' : ''"
        >{{ h === 'rare' ? '⭐ 稀有+' : '⚪' }}</span>
        <span class="dim" style="margin-left: 8px; font-size: 12px">⭐=稀有及以上（厨具池保底计数参考）</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 奇偶行布局辅助 */
.gear-note { padding: 0 10px; }

/* ── 轮播条（白色背景框，按钮上方） ── */
.mijian-carousel {
  position: relative;
  overflow: hidden;
  height: 116px;
  display: flex;
  align-items: center;
  background: rgba(255, 252, 246, 0.96);
  margin-bottom: 12px;
}
.mijian-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.mijian-bg-track {
  display: flex; align-items: center; gap: 30px;
  width: max-content; height: 116px;
  animation: mijianScroll 80s linear infinite;
}
.mijian-bg-track img {
  width: 86px; height: 86px;
  object-fit: contain; flex-shrink: 0;
  opacity: 0.92;
}
@keyframes mijianScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .mijian-bg-track { animation: none; } }

/* ── 抽卡操作台 ── */
.btn-lg { font-size: 15px; padding: 8px 22px; }
.gacha-pull { margin-bottom: 12px; }

/* ── 翻牌网格（十连 5×2 / 单抽一张） ── */
.gacha-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
  margin-top: 10px;
}
.gacha-grid.single { grid-template-columns: minmax(150px, 190px); justify-content: center; }
.gacha-card { perspective: 700px; }
.gacha-inner {
  position: relative;
  width: 100%; aspect-ratio: 3 / 4;
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.gacha-card.revealed .gacha-inner { transform: rotateY(180deg); }
.gacha-face {
  position: absolute; inset: 0;
  backface-visibility: hidden; -webkit-backface-visibility: hidden;
  border-radius: 10px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 6px; text-align: center;
}
/* 卡背：呼吸光 + 「觅」字 */
.gacha-back {
  background: linear-gradient(150deg, #6b3f2c, #4a2f26);
  border: 2px solid rgba(255, 214, 160, 0.4);
  animation: backGlow 1.8s ease-in-out infinite;
  color: #f5d9a8;
}
.gacha-back-mark { font-size: 34px; font-weight: 800; text-shadow: 0 0 12px rgba(255, 200, 120, 0.6); }
.gacha-back-sub { font-size: 11px; opacity: 0.8; letter-spacing: 3px; }
@keyframes backGlow {
  0%, 100% { box-shadow: 0 0 6px rgba(255, 190, 90, 0.25); }
  50% { box-shadow: 0 0 16px rgba(255, 190, 90, 0.55); }
}
/* 卡面 */
.gacha-front {
  background: #fffdf9;
  border: 2px solid var(--border);
  transform: rotateY(180deg);
}
.gacha-img { width: 56px; height: 56px; object-fit: contain; }
.gacha-front-name { font-size: 12px; font-weight: 600; line-height: 1.2; }
.gacha-front-sub { font-size: 10px; color: var(--muted); }

/* 品质光晕（边框 + 阴影随稀有度增强） */
.gacha-card.q-common .gacha-front { border-color: #b9a993; }
.gacha-card.q-fine .gacha-front { border-color: #6fa8dc; }
.gacha-card.q-rare .gacha-front { border-color: #4a90d9; box-shadow: 0 0 10px rgba(74, 144, 217, 0.45); }
.gacha-card.q-epic .gacha-front { border-color: #7b1fa2; box-shadow: 0 0 12px rgba(123, 31, 162, 0.5); }
.gacha-card.q-legend .gacha-front { border-color: #d98a2b; box-shadow: 0 0 14px rgba(217, 138, 43, 0.6); }
.gacha-card.q-myth .gacha-front {
  border-color: #e0704a;
  box-shadow: 0 0 18px rgba(224, 112, 74, 0.75);
  background: linear-gradient(120deg, #fff8ec, #ffe7c9);
}
.gacha-card.q-myth.revealed .gacha-inner { animation: mythGlow 0.9s ease-out 2; }
@keyframes mythGlow {
  0% { filter: brightness(1); }
  50% { filter: brightness(1.35) saturate(1.3); }
  100% { filter: brightness(1); }
}
.gacha-card.dazzle-note { }

.gacha-actions { margin-top: 12px; text-align: center; }

/* 历史 */
.gacha-history { margin-top: 12px; }
.gacha-history-row { display: flex; align-items: center; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
.gacha-hist-rare { color: #d98a2b; font-weight: 700; }

:global([data-theme='dark']) .mijian-carousel { background: rgba(40, 29, 21, 0.96); }
:global([data-theme='dark']) .mijian-bg-track img { opacity: 0.85; }
:global([data-theme='dark']) .gacha-front { background: #2a1d15; color: #f2e6d7; border-color: #4d3a2b; }
:global([data-theme='dark']) .gacha-front-sub { color: #bfa98f; }
:global([data-theme='dark']) .gacha-back { background: linear-gradient(150deg, #7a4a30, #3a2418); }
@media (max-width: 719px) {
  .gacha-grid { grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 8px; }
}
</style>
