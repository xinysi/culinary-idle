<script setup>
// 觅珍抽卡 — 材料/食物/厨具三池（2026-09-06 重排：翻牌揭示版）
// 参考行业通用 gacha 模式：卡背呼吸光 → 逐张 3D 翻转 → 品质光晕/神话金光 → 十连 5×2 网格 + 历史
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { MIJIAN_POOLS, GEAR_PITY, LIMITED_PITY, poolPreview, limitedRemainingMs, pickItem } from '../game/data/mijianDraws.js'
import { getItem } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

const activePool = ref('material')
const pool = computed(() => MIJIAN_POOLS.find((p) => p.id === activePool.value))
const isGearPool = computed(() => activePool.value === 'gear')
const isLimitedPool = computed(() => activePool.value === 'limited')
const pity = computed(() => player.mijianPity())
const bgItems = computed(() => {
  const list = poolPreview(activePool.value, 20)
  return [...list, ...list] // 双份 → translateX(-50%) 无痕循环
})

// 抽卡结果（翻牌揭示序列）：{ id, rare, revealed }
const results = ref({ list: [], sim: false })
const drawing = ref(false)
const hasResults = computed(() => results.value.list.length > 0)
const allRevealed = computed(() => results.value.list.length > 0 && results.value.list.every((r) => r.revealed))

function draw(count) {
  if (drawing.value) return
  const r = player.drawMijian(activePool.value, count)
  if (!r) return
  if (!r.ok) { ui.pushLog(`🎴 觅珍：${r.msg}`, 'warn'); return }
  // 构建翻牌列表（卡背朝上，逐张揭示）
  results.value = { list: r.results
    .filter(Boolean)
    .map((it, i) => ({
      id: it.id,
      rare: it.type === 'equipment' && ['稀有', '史诗', '传说', '神话'].includes(it.quality),
      revealed: false,
      delay: i * 0.13,
    })), sim: false }
  // 揭示序列（真实与模拟共用）
  startReveal(results.value.list, count > 20)
  ui.pushLog(`🎴 觅珍：${pool.value.name} ×${count}，获得 ${r.got.length} 件${r.boosted ? '（保底命中 ⭐）' : ''}`, 'gain')
}
function startReveal(list, instant = false) {
  drawing.value = true
  if (instant) {
    list.forEach((item) => { item.revealed = true })
    drawing.value = false
    return
  }
  list.forEach((item, i) => {
    setTimeout(() => {
      item.revealed = true
      if (i === list.length - 1) drawing.value = false
    }, 380 + i * 130)
  })
}
/** 模拟预览：本地生成结果并展示（不扣金币/不入库/不动统计与保底） */
function simulateDraw(count) {
  if (drawing.value) return
  const list = []
  for (let i = 0; i < count; i++) {
    const { item } = pickItem(activePool.value, Math.random, 0)
    if (item) list.push(item)
  }
  results.value = {
    list: list.map((it, i) => ({
      id: it.id,
      rare: !!it.quality && ['稀有', '史诗', '传说', '神话'].includes(it.quality),
      revealed: false,
      delay: i * 0.13,
    })),
    sim: true,
  }
  // results 改为对象后统一解包见模板调整
  startReveal(results.value.list, count > 20)
  ui.pushLog(`👁 模拟预览：${pool.value.name} ×${count}（不消耗金币/物品）`, 'info')
}
function confirmResults() {
  results.value = { list: [], sim: false }
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
const limitedRemaining = computed(() => {
  const ms = limitedRemainingMs()
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  return d > 0 ? d + ' 天 ' + h + ' 时' : h + ' 时'
})
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

    <!-- 卡池切换器：三张池卡，选中金边浮起 -->
    <div class="pool-minis">
      <button
        v-for="p in MIJIAN_POOLS"
        :key="p.id"
        class="pool-mini"
        :class="{ active: activePool === p.id }"
        @click="activePool = p.id"
      >
        <span class="pool-mini-icon">{{ p.icon }}</span>
        <span class="pool-mini-name">{{ p.name }}</span>
        <span class="pool-mini-price">{{ p.price }} 金/抽</span>
      </button>
    </div>

    <!-- 卡池展示横幅：轮播图（两端渐隐）+ 左侧池名徽章 + 右侧保底徽章 -->
    <div class="card pool-banner">
      <div class="mijian-bg" aria-hidden="true">
        <div class="mijian-bg-track">
          <img v-for="(b, i) in bgItems" :key="b.id + '-' + i" :src="b.img" alt="" loading="lazy" />
        </div>
      </div>
      <div class="pool-banner-fade"></div>
      <div class="pool-banner-title">
        <span class="pool-banner-icon">{{ pool.icon }}</span>
        <b>{{ pool.name }}</b>
        <em>{{ pool.desc }}</em>
      </div>
      <div v-if="isGearPool" class="pool-banner-pity">⭐ 保底 {{ pity.current }}/{{ pity.need }}</div>
      <template v-if="isLimitedPool">
        <div class="pool-banner-pity pills">
          <span class="pill">⏳ 剩 {{ limitedRemaining }}</span>
          <span class="pill">⭐ 保底 {{ pity.limited }}/{{ pity.limitedNeed }}</span>
        </div>
      </template>
    </div>

    <!-- 抽卡操作台 -->
    <div class="card gacha-pull">
      <div class="gacha-hold">持有金币 <b class="mono">{{ player.gold.toLocaleString() }}</b></div>
      <div class="gacha-btns">
        <button class="gacha-btn gacha-btn-main" :disabled="drawing || player.gold < pool.price * 10" @click="draw(10)">
          <span class="gacha-btn-top">🎴 十连抽卡 <i class="gacha-btn-tag">10连</i></span>
          <span class="gacha-btn-price">{{ pool.price * 10 }} 金</span>
        </button>
        <button class="gacha-btn gacha-btn-sub" :disabled="drawing || player.gold < pool.price" @click="draw(1)">
          <span class="gacha-btn-top">🎴 单抽</span>
          <span class="gacha-btn-price">{{ pool.price }} 金</span>
        </button>
        <button class="gacha-btn gacha-btn-bulk" :disabled="drawing || player.gold < pool.price * 100" @click="draw(100)">
          <span class="gacha-btn-top">🎴 百连抽卡 <i class="gacha-btn-tag">100连</i></span>
          <span class="gacha-btn-price">{{ pool.price * 100 }} 金</span>
        </button>
      </div>
      <div class="gacha-sim">
        <span class="dim">👁 模拟预览：</span>
        <button class="btn btn-sm" :disabled="drawing" @click="simulateDraw(1)">单抽效果</button>
        <button class="btn btn-sm" :disabled="drawing" @click="simulateDraw(10)">十连效果</button>
        <button class="btn btn-sm" :disabled="drawing" @click="simulateDraw(100)">百连效果</button>
        <span class="dim" style="font-size: 11px">仅展示效果，不消耗金币/物品</span>
      </div>
    </div>

    <!-- 结果揭示（卡背 → 逐张 3D 翻转；品质光晕 / 神话金光；十连 5×2 网格） -->
    <div v-if="hasResults" class="card gacha-results">
      <h3>抽卡结果 <span class="dim mono" style="font-size: 12px">{{ results.list.length }} 张</span><span v-if="results.sim" class="badge badge-on sim-badge">👁 模拟演示</span></h3>
      <div class="gacha-grid" :class="{ single: results.list.length === 1 }">
        <div
          v-for="(r, i) in results.list"
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

/* ── 卡池切换器（选中金边浮起） ── */
.pool-minis { display: flex; gap: 16px; justify-content: center; margin-bottom: 12px; flex-wrap: wrap; }
.pool-mini { flex: 1 1 0; max-width: 300px; }
.pool-mini {
  min-width: 126px;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 10px 14px;
  border-radius: 14px;
  cursor: pointer;
  background: rgba(255, 251, 244, 0.85);
  border: 1px solid rgba(150, 110, 70, 0.28);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.pool-mini:hover { transform: translateY(-2px); }
.pool-mini.active {
  background: #fff7e8;
  border: 2px solid #d98a2b;
  box-shadow: 0 0 14px rgba(217, 138, 43, 0.4);
  transform: translateY(-4px);
}
.pool-mini-icon { font-size: 24px; }
.pool-mini-name { font-size: 13px; font-weight: 700; }
.pool-mini-price { font-size: 11px; color: var(--muted); }

/* ── 卡池展示横幅：轮播（两端渐隐）+ 池名徽章 + 保底徽章 ── */
.pool-banner {
  position: relative;
  overflow: hidden;
  height: 108px;
  margin-bottom: 12px;
  background: rgba(255, 252, 246, 0.96);
}
.mijian-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.mijian-bg-track {
  display: flex; align-items: center; gap: 26px;
  width: max-content; height: 108px;
  animation: mijianScroll 80s linear infinite;
}
.mijian-bg-track img {
  width: 58px; height: 58px;
  object-fit: contain; flex-shrink: 0;
  opacity: 0.6;
}
.pool-banner-fade {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(90deg, rgba(255, 252, 246, 0.96), rgba(255, 252, 246, 0) 16%, rgba(255, 252, 246, 0) 84%, rgba(255, 252, 246, 0.96));
}
.pool-banner-title {
  position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
  display: flex; align-items: center; gap: 8px; z-index: 2;
  background: rgba(255, 252, 246, 0.88);
  border: 1px solid rgba(217, 138, 43, 0.35);
  border-radius: 999px;
  padding: 5px 14px;
  box-shadow: 0 2px 8px rgba(150, 110, 70, 0.15);
}
.pool-banner-icon { font-size: 18px; }
.pool-banner-title b { font-size: 14px; color: var(--primary-strong); }
.pool-banner-title em { font-style: normal; font-size: 11px; color: var(--muted); }
.pool-banner-pity {
  position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
  z-index: 2;
  display: flex; gap: 6px;
}
.pool-banner-pity .pill {
  background: rgba(255, 252, 246, 0.92);
  border: 1px solid rgba(217, 138, 43, 0.45);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px; font-weight: 700;
  color: #8a5a12;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(150, 110, 70, 0.12);
}
:global([data-theme='dark']) .pool-banner-pity .pill { background: rgba(44, 31, 22, 0.92); color: #e8b45f; }
:global([data-theme='dark']) .pool-mini { background: rgba(44, 31, 22, 0.85); border-color: rgba(255, 255, 255, 0.16); color: #e8dccb; }
:global([data-theme='dark']) .pool-mini.active { background: #3a2a18; border-color: #d98a2b; }
:global([data-theme='dark']) .pool-banner { background: rgba(40, 29, 21, 0.96); }
:global([data-theme='dark']) .pool-banner-fade { background: linear-gradient(90deg, rgba(40, 29, 21, 0.96), rgba(40, 29, 21, 0) 16%, rgba(40, 29, 21, 0) 84%, rgba(40, 29, 21, 0.96)); }
:global([data-theme='dark']) .pool-banner-title { background: rgba(40, 29, 21, 0.9); }
:global([data-theme='dark']) .pool-banner-pity { color: #e8b45f; }

@keyframes mijianScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .mijian-bg-track { animation: none; } }

/* ── 抽卡操作台（gacha 按钮：主 CTA 大+金渐变+脉动光；次级小一号深红） ── */
.gacha-hold { text-align: center; color: var(--muted); font-size: 13px; margin-bottom: 12px; }
.gacha-btns { display: flex; gap: 18px; justify-content: center; align-items: stretch; flex-wrap: wrap; }
.gacha-btn {
  position: relative; overflow: hidden; cursor: pointer;
  border: none; border-radius: 16px;
  color: #fff; font-weight: 700;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  padding: 16px 40px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
}
.gacha-btn::after {
  content: ''; position: absolute; top: 0; left: -70%; width: 45%; height: 100%;
  background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.38), transparent);
  animation: gachaSheen 3s ease-in-out infinite;
  pointer-events: none;
}
.gacha-btn:hover { transform: translateY(-2px); }
.gacha-btn:active { transform: translateY(0) scale(0.98); }
.gacha-btn:disabled { filter: grayscale(0.7) brightness(0.72); cursor: not-allowed; transform: none; }
.gacha-btn-main {
  min-width: 300px;
  font-size: 19px;
  background: linear-gradient(135deg, #e2a93f, #c9761c);
  box-shadow: 0 0 22px rgba(226, 169, 63, 0.5);
  animation: gachaPulse 2.2s ease-in-out infinite;
}
.gacha-btn-sub {
  min-width: 210px;
  font-size: 15px;
  background: linear-gradient(135deg, #d95a38, #b8442a);
  box-shadow: 0 4px 14px rgba(184, 68, 42, 0.35);
}
.gacha-btn-tag {
  font-style: normal; font-size: 11px; font-weight: 800;
  background: rgba(255, 245, 224, 0.3); border: 1px solid rgba(255, 245, 224, 0.55);
  border-radius: 999px; padding: 2px 10px; margin-left: 6px; vertical-align: 2px;
}
.gacha-btn-price { font-size: 13px; font-weight: 600; opacity: 0.92; }
@keyframes gachaSheen { 0%, 62% { left: -70%; } 100% { left: 130%; } }
@keyframes gachaPulse {
  0%, 100% { box-shadow: 0 0 16px rgba(226, 169, 63, 0.35); }
  50% { box-shadow: 0 0 30px rgba(226, 169, 63, 0.65); }
}
@media (max-width: 719px) {
  .gacha-btn-main { min-width: 190px; padding: 14px 24px; font-size: 17px; }
  .gacha-btn-sub { min-width: 140px; padding: 12px 18px; }
}

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


/* 装饰翼：按钮两则当前池精选图（静态低透明） */
.gacha-wing { display: flex; gap: 8px; align-items: center; }
.gacha-wing img { width: 40px; height: 40px; object-fit: contain; opacity: 0.45; }
@media (max-width: 719px) { .gacha-wing { display: none; } }

/* 百连按钮（黑金限定风） */
.gacha-btn-bulk {
  min-width: 300px;
  font-size: 16px;
  color: #f2c96b;
  border: 1px solid rgba(226, 169, 63, 0.65);
  background: linear-gradient(120deg, #16130b, #4a3a10 50%, #16130b);
  box-shadow: 0 0 18px rgba(226, 169, 63, 0.35);
}
.gacha-btn-bulk:disabled { filter: grayscale(0.7) brightness(0.72); }
@media (max-width: 719px) {
  .gacha-btn-bulk { min-width: 150px; padding: 12px 16px; }
}

/* 模拟预览行（按钮本身浅绿渐变，样式与上方抽卡大按钮一致） */
.gacha-sim {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; margin-top: 12px; font-size: 12px; flex-wrap: wrap;
}
.gacha-sim .btn-sm {
  position: relative; overflow: hidden;
  flex: 0 0 auto; padding: 8px 22px; font-weight: 700; font-size: 13px;
  color: #fff;
  border: none; border-radius: 12px;
  background: linear-gradient(135deg, #9ad97a, #5fa542);
  box-shadow: 0 3px 10px rgba(95, 165, 66, 0.35);
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
}
.gacha-sim .btn-sm::after {
  content: ''; position: absolute; top: 0; left: -70%; width: 45%; height: 100%;
  background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  animation: simSheen 3s ease-in-out infinite;
  pointer-events: none;
}
.gacha-sim .btn-sm:hover { transform: translateY(-2px); }
.gacha-sim .btn-sm:active { transform: translateY(0) scale(0.97); }
.gacha-sim .btn-sm:disabled { filter: grayscale(0.6) brightness(0.8); }
.sim-badge { margin-left: 8px; }
:global([data-theme='dark']) .gacha-sim .btn-sm { background: linear-gradient(135deg, #6fae52, #4c8a3c); box-shadow: 0 3px 10px rgba(76, 138, 60, 0.4); }
@keyframes simSheen { 0%, 62% { left: -70%; } 100% { left: 130%; } }

</style>