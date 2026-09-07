<script setup>
// 食材翻牌（2026-09-07 独立小游戏，自连连看 4×4 翻牌玩法升级）：牌面朝下记忆配对，翻错 450ms 盖回
// 四模式：4×4 新手 / 6×6 大师 / 4×4 限时 75s / 6×6 限时 120s；最佳=最少翻牌次数完成
import { ref, computed, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { ITEMS } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

const mode = ref('m4')
const MODES = {
  m4: { label: '4×4 新手', size: 4, pairs: 8, gold: 100, kind: 'normal', desc: '4×4 · 8 对 · +100 金 —— 记忆入门' },
  m6: { label: '6×6 大师', size: 6, pairs: 18, gold: 240, kind: 'normal', desc: '6×6 · 18 对 · +240 金' },
  t4: { label: '4×4 限时', size: 4, pairs: 8, gold: 150, kind: 'time', time: 75, desc: '4×4 · 8 对 · 限 75 秒 · +150 金 —— 超时失败' },
  t6: { label: '6×6 限时', size: 6, pairs: 18, gold: 320, kind: 'time', time: 120, desc: '6×6 · 18 对 · 限 120 秒 · +320 金 —— 超时失败' },
}
const showInfo = ref(false)

const IMG_POOL = Object.values(ITEMS)
  .filter((i) => ['ingredient', 'food', 'spice'].includes(i.type) && itemImage(i.id))
  .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh'))
  .map((i) => i.id)
  .slice(0, 64)

const board = ref([])
const memSel = ref(null)
const busy = ref(false)
const failed = ref(false)
const flips = ref(0)
const timeLeft = ref(null)
let timerId = null
const clearedCount = computed(() => board.value.filter((c) => c.cleared).length)
const done = computed(() => board.value.length && clearedCount.value === board.value.length)
const mg = computed(() => player.minigames?.memory ?? {})

function resetDay() {
  const ids = [...IMG_POOL].sort(() => Math.random() - 0.5).slice(0, MODES[mode.value].pairs)
  board.value = [...ids, ...ids].sort(() => Math.random() - 0.5).map((id, i) => ({ id, key: id + '-' + i, cleared: false, face: false }))
  memSel.value = null
  busy.value = false
  failed.value = false
  flips.value = 0
  if (timerId) clearInterval(timerId)
  const mm = MODES[mode.value]
  if (mm.kind === 'time') {
    timeLeft.value = mm.time
    timerId = setInterval(() => {
      timeLeft.value--
      if (timeLeft.value <= 0 && !done.value) {
        timeLeft.value = 0
        failed.value = true
        clearInterval(timerId)
      }
    }, 1000)
  } else timeLeft.value = null
}
onUnmounted(() => { if (timerId) clearInterval(timerId) })

function tap(i) {
  const c = board.value[i]
  if (c.cleared || failed.value || busy.value || c.face) return
  c.face = true
  flips.value++
  if (memSel.value == null) { memSel.value = i; return }
  const a = board.value[memSel.value]
  memSel.value = null
  if (a.id === c.id) {
    a.cleared = true
    c.cleared = true
    if (done.value) settle()
  } else {
    busy.value = true
    setTimeout(() => { a.face = false; c.face = false; busy.value = false }, 450)
  }
}
function settle() {
  const m = player.minigames
  if (!m.memory) m.memory = { best: 0, done: 0, rewarded: 0 }
  m.memory.done = (m.memory.done ?? 0) + 1
  m.memory.rewarded = (m.memory.rewarded ?? 0) + MODES[mode.value].gold
  m.memory.best = m.memory.best ? Math.min(m.memory.best, flips.value) : flips.value
  player.gainGold(MODES[mode.value].gold)
  ui.pushLog(`🧠 食材翻牌完成！${flips.value} 次翻牌 +${MODES[mode.value].gold} 金币`, 'gain')
}
function switchMode(k) {
  mode.value = k
  resetDay()
}
resetDay()
</script>

<template>
  <div class="mm-page">
    <div class="mm-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="mm-mode" :class="{ on: mode === key }" @click="switchMode(key)">{{ m.label }}</button>
      <span class="mm-chip" style="margin-left: auto">🏆 最佳 <b class="mono">{{ mg.best ?? 0 }}</b> 次</span>
      <span v-if="timeLeft !== null" class="mm-chip">⏱ 剩余 <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="mm-chip">🎯 翻 <b class="mono">{{ flips }}</b> 次</span>
      <span class="mm-chip">🀄 剩余 <b class="mono">{{ board.length - clearedCount }}</b></span>
      <button class="mm-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="mm-board" :style="{ gridTemplateColumns: 'repeat(' + MODES[mode].size + ', minmax(0, 1fr))' }">
      <div
        v-for="(c, i) in board"
        :key="c.key"
        class="mm-cell"
        :class="{ cleared: c.cleared, face: c.face }"
        @click="tap(i)"
      ><img v-if="!c.cleared && c.face" class="mm-img" :src="itemImage(c.id)" @error="$event.target.style.display = 'none'" alt="" />
      <span v-if="!c.cleared && !c.face" class="mm-back">❓</span></div>
    </div>

    <div class="mm-keys">
      <button class="mm-reset" @click="resetDay()">重新洗牌</button>
    </div>
    <div v-if="done" class="mm-done">🧠 全部配对！+{{ MODES[mode].gold }} 金币</div>
    <div v-if="failed" class="mm-done mm-fail">💦 超时未清！重新洗牌再来</div>

    <div v-if="showInfo" class="mm-info-mask" @click.self="showInfo = false">
      <div class="mm-info-box">
        <div class="mm-info-head"><b>🧠 食材翻牌 · 模式说明</b><button class="mm-info-close" @click="showInfo = false">✕</button></div>
        <div class="mm-info-list">
          <div class="mm-info-row mm-info-rule">通用规则：所有牌面朝下 ❓，翻开两张相同即消除、不同盖回（记牌挑战记忆力）· 全部配对得金币 · 最佳 = 最少翻牌次数完成</div>
          <div v-for="(m, key) in MODES" :key="key" class="mm-info-row">
            <b class="mm-info-name">{{ m.label }}</b>
            <span class="mm-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.mm-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.mm-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.mm-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.mm-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.mm-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.mm-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.mm-board {
  width: min(560px, 94%);
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px;
  padding: 14px; border-radius: 18px;
  background: rgba(150, 110, 70, 0.16);
  border: 1px solid rgba(150, 110, 70, 0.3);
  box-shadow: 0 10px 28px rgba(93, 64, 55, 0.14);
}
.mm-cell {
  aspect-ratio: 1;
  display: flex; align-items: center; justify-content: center;
  padding: 6px;
  border-radius: 10px; cursor: pointer; user-select: none;
  background: rgba(255, 251, 244, 0.92); border: 1px solid rgba(150, 110, 70, 0.25);
  transition: transform 0.1s ease;
}
.mm-cell:hover { transform: scale(1.05); }
.mm-cell.face { border-color: rgba(88, 156, 75, 0.5); }
.mm-cell.cleared { background: rgba(87, 168, 97, 0.12); border-color: rgba(87, 168, 97, 0.3); cursor: default; }
.mm-img { width: 100%; height: 100%; object-fit: contain; }
.mm-back { font-size: 26px; opacity: 0.55; }
.mm-keys { display: flex; gap: 10px; justify-content: center; }
.mm-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.mm-done { font-weight: 800; color: var(--good-strong); }
.mm-fail { color: var(--bad-strong); }
.mm-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.mm-info-box { width: min(560px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.mm-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.mm-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.mm-info-list { display: flex; flex-direction: column; gap: 8px; }
.mm-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.mm-info-rule { border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; }
.mm-info-name { flex: 0 0 112px; color: var(--primary-strong); }
.mm-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
