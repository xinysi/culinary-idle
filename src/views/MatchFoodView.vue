<script setup>
// 食材连连看（2026-09-06 逐页重排版：状态胶囊行 + 居中棋盘面板 + 完成横幅）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const mode = ref(6)
const GRID = computed(() => mode.value)
const MODES = {
  4: { label: '4×4 快速', pairs: 8, gold: 80 },
  6: { label: '6×6 标准', pairs: 18, gold: 150 },
  8: { label: '8×8 挑战', pairs: 32, gold: 250 },
}
const EMOJI_ALL = Array.from('🍎🥔🍅🌶️🥕🍉🍇🍓🍆🍄🐟🦐🍞🍜🥟🍚🎃🧅🍗🥩🫘🥦🍌🍊🍋🫐🥭🍍🥥🍐🍒🥑')
function poolFor() {
  const n = MODES[mode.value].pairs
  const ids = []
  const used = new Set()
  while (ids.length < n) {
    const c = EMOJI_ALL[Math.floor(Math.random() * EMOJI_ALL.length)]
    if (!used.has(c)) { used.add(c); ids.push(c) }
  }
  return ids
}

const board = ref([])
const selected = ref(null)
const clearedCount = computed(() => board.value.filter((c) => c.cleared).length)
const done = computed(() => board.value.length && clearedCount.value === board.value.length)

function resetDay() {
  // 一次抽 n 种再复制成对：配对完备（2026-09-07 修复两次独立取池导致缺对）
  const ids = poolFor()
  const arr = [...ids, ...ids].sort(() => Math.random() - 0.5).map((id, i) => ({ id, key: id + '-' + i, cleared: false }))
  board.value = arr
  selected.value = null
}
function tap(i) {
  if (board.value[i].cleared) return
  if (selected.value === i) { selected.value = null; return }
  if (selected.value == null) { selected.value = i; return }
  const a = board.value[selected.value]
  const b = board.value[i]
  if (a.id === b.id) {
    a.cleared = true
    b.cleared = true
    selected.value = null
    if (done.value) settle()
  } else {
    selected.value = i
  }
}
function settle() {
  const mg = player.minigames.matchfood
  if (!mg) player.minigames.matchfood = { day: '', buffed: 0 }
  mg.day = todayKey()
  // 每次全清得金币（按模式难度，2026-09-07 统一金币奖励）
  const gold = MODES[mode.value].gold
  mg.buffed = (mg.buffed ?? 0) + 1
  player.gainGold(gold)
  ui.pushLog(`🍽 食材连连看全清！+${gold} 金币`, 'gain')
}
function todayKey() {
  const t = new Date()
  return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
}
const buffActive = computed(() => {
  const b = player.buffs?.xpMult
  return b && b.mult > 1 && (b.expiresAt ?? 0) > Date.now()
})
const buffDays = computed(() => player.minigames?.matchfood?.buffed ?? 0)
resetDay()
</script>

<template>
  <div class="mf-page">
    <div class="mf-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="mf-mode" :class="{ on: mode === key }" @click="mode = Number(key); resetDay()">{{ m.label }}</button>
      <span class="mf-chip">🀄 剩余 <b class="mono">{{ board.length - clearedCount }}</b></span>
      <span class="mf-chip" style="margin-left: auto">🏆 全清 <b class="mono">{{ buffDays }}</b> 次</span>
    </div>

    <div class="mf-board" :style="{ gridTemplateColumns: 'repeat(' + mode + ', minmax(0, 1fr))' }">
      <div
        v-for="(c, i) in board"
        :key="c.key"
        class="mf-cell"
        :class="{ cleared: c.cleared, selected: selected === i }"
        @click="tap(i)"
      >{{ c.cleared ? '' : c.id }}</div>
    </div>

    <div class="mf-keys">
      <button class="mf-reset" @click="resetDay()">重新洗牌</button>
    </div>
    <div v-if="done" class="mf-done">🍽 全清！+{{ MODES[mode].gold }} 金币</div>
    <div class="mf-tip">点两张相同食材消除 · 清空全场得金币（按模式：+80/150/250）</div>
  </div>
</template>
<style scoped>
.mf-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.mf-topbar { display: flex; gap: 8px; width: 100%; }
.mf-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.mf-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.mf-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.mf-chip.ok { background: rgba(87, 168, 97, 0.16); border-color: var(--good-strong); color: var(--good-strong); }
.mf-board {
  width: min(420px, 92%);
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 7px;
  padding: 14px; border-radius: 18px;
  background: rgba(150, 110, 70, 0.16);
  border: 1px solid rgba(150, 110, 70, 0.3);
  box-shadow: 0 10px 28px rgba(93, 64, 55, 0.14);
}
.mf-cell {
  aspect-ratio: 1;
  display: flex; align-items: center; justify-content: center; font-size: 28px;
  border-radius: 10px; cursor: pointer; user-select: none;
  background: rgba(255, 251, 244, 0.92); border: 1px solid rgba(150, 110, 70, 0.25);
  transition: transform 0.1s ease;
}
.mf-cell:hover { transform: scale(1.05); }
.mf-cell.selected { border-color: var(--gold); box-shadow: 0 0 10px rgba(168, 120, 11, 0.5); }
.mf-cell.cleared { background: rgba(87, 168, 97, 0.12); border-color: rgba(87, 168, 97, 0.3); cursor: default; }
.mf-keys { display: flex; justify-content: center; }
.mf-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.mf-done { font-weight: 800; color: var(--good-strong); }
.mf-tip { color: var(--muted); font-size: 12px; }
</style>
