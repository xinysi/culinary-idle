<script setup>
// 每日美食拼图（2026-09-06 逐页重排版：顶部状态条 + 双图并排面板 + 底部控制）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const mode = ref(4)
const SIZE = computed(() => mode.value)
const MODES = {
  3: { label: '3×3 轻松' },
  4: { label: '4×4 标准' },
  5: { label: '5×5 大师' },
}
const tiles = ref([])
const moves = ref(0)
const won = ref(false)

const LABELS = ['🍚', '🥟', '🍜', '🦐', '🥘', '🍣', '🍙', '🍢', '🍡', '🥮', '🍵', '🍥', '🍲', '🍰', '🍪', '🥤', '🍞', '🥧', '🦀', '🐙', '🧁', '🍧', '🍮', '🍤', '🥠', '🥪']
function dayHash() {
  const t = new Date()
  let h = 0
  const s = `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let x = Math.imul(a ^ (a >>> 15), 1 | a)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}
function scrambled() {
  const size = SIZE.value
  const total = size * size
  const arr = Array.from({ length: total }, (_, i) => (i === total - 1 ? 0 : i + 1))
  const rng = mulberry32(dayHash() + size * 7919)
  for (let i = 0; i < 250; i++) {
    const idx = arr.indexOf(0)
    const r = Math.floor(idx / size), c = idx % size
    const options = []
    if (r > 0) options.push(idx - size)
    if (r < size - 1) options.push(idx + size)
    if (c > 0) options.push(idx - 1)
    if (c < size - 1) options.push(idx + 1)
    const pick = options[Math.floor(rng() * options.length)]
    ;[arr[idx], arr[pick]] = [arr[pick], arr[idx]]
  }
  return arr
}
function resetDay() {
  tiles.value = scrambled()
  moves.value = 0
  won.value = false
}
function checkWin() {
  const total = SIZE.value * SIZE.value
  for (let i = 0; i < total - 1; i++) if (tiles.value[i] !== i + 1) return false
  if (tiles.value[total - 1] !== 0) return false
  return true
}
function tap(i) {
  if (won.value) return
  const size = SIZE.value
  const empty = tiles.value.indexOf(0)
  const r = Math.floor(i / size), c = i % size
  const er = Math.floor(empty / size), ec = empty % size
  if (Math.abs(r - er) + Math.abs(c - ec) !== 1) return
  ;[tiles.value[i], tiles.value[empty]] = [tiles.value[empty], tiles.value[i]]
  tiles.value = [...tiles.value]
  moves.value++
  if (checkWin()) {
    won.value = true
    const mg = player.minigames.puzzle
    const today = todayKey()
    if (!mg) player.minigames.puzzle = { day: '', done: 0 }
    if (mg.day !== today) {
      mg.day = today
      mg.done = (mg.done ?? 0) + 1
      player.gainItem('energyBiscuit', 1)
      ui.pushLog('🧩 每日美食拼图完成！+能量饼干 ×1', 'gain')
    }
  }
}
function todayKey() {
  const t = new Date()
  return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
}
const doneToday = computed(() => {
  const mg = player.minigames?.puzzle ?? { day: '', done: 0 }
  return mg.day === todayKey() && (mg.done ?? 0) >= 1
})
const doneDays = computed(() => player.minigames?.puzzle?.done ?? 0)
resetDay()
const cells = computed(() => tiles.value)
</script>

<template>
  <div class="pz-page">
    <div class="pz-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="pz-mode" :class="{ on: mode === key }" @click="mode = Number(key); resetDay()">{{ m.label }}</button>
      <span class="pz-chip" :class="{ ok: doneToday }">{{ doneToday ? '✅ 今日已完成' : '📅 今日未完成' }}</span>
      <span class="pz-chip">🎯 步数 <b class="mono">{{ moves }}</b></span>
      <span class="pz-chip" style="margin-left: auto">🏆 累计完成 <b class="mono">{{ doneDays }}</b> 天</span>
    </div>

    <div class="pz-duo">
      <div class="pz-col">
        <div class="pz-label">🎯 目标图</div>
        <div class="pz-board" :style="{ gridTemplateColumns: 'repeat(' + mode + ', minmax(0, 1fr))' }">
          <div v-for="(lbl, i) in LABELS" :key="'g' + i" class="pz-cell pz-goal-cell">
            {{ lbl }}<span class="pz-num">{{ i + 1 }}</span>
          </div>
        </div>
      </div>
      <div class="pz-col">
        <div class="pz-label">🧩 拼图（点击与空格相邻的碎片）</div>
        <div class="pz-board" :style="{ gridTemplateColumns: 'repeat(' + mode + ', minmax(0, 1fr))' }">
          <div v-for="(v, i) in cells" :key="i" class="pz-cell" :class="{ empty: v === 0 }" @click="tap(i)">
            <template v-if="v">{{ LABELS[v - 1] }}<span class="pz-num">{{ v }}</span></template>
          </div>
        </div>
      </div>
    </div>

    <div class="pz-keys">
      <button class="pz-reset" @click="resetDay()">重新打乱（当日固定）</button>
    </div>
    <div v-if="won" class="pz-done">🎉 复原完成！{{ doneToday ? '奖励今日已领' : '+能量饼干 ×1' }}</div>
    <div class="pz-tip">每天同一张图 · 完成得能量饼干（每日 1 次）</div>
  </div>
</template>
<style scoped>
.pz-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.pz-topbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; width: 100%; }
.pz-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.pz-chip.ok { background: rgba(87, 168, 97, 0.16); border-color: var(--good-strong); color: var(--good-strong); }
.pz-duo { display: flex; gap: 22px; justify-content: center; align-items: flex-start; flex-wrap: wrap; }
.pz-col { display: flex; flex-direction: column; gap: 6px; align-items: center; }
.pz-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.pz-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.pz-label { font-size: 12px; font-weight: 700; color: var(--primary-strong); }
.pz-board {
  width: 300px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;
  padding: 8px; border-radius: 14px;
  background: rgba(150, 110, 70, 0.16);
  border: 1px solid rgba(150, 110, 70, 0.3);
  box-shadow: 0 8px 20px rgba(93, 64, 55, 0.14);
}
.pz-cell {
  position: relative; aspect-ratio: 1;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; border-radius: 8px; cursor: pointer; user-select: none;
  background: rgba(255, 251, 244, 0.92); border: 1px solid rgba(150, 110, 70, 0.25);
}
.pz-goal-cell { cursor: default; }
.pz-cell.empty { background: transparent; border-color: transparent; cursor: default; }
.pz-num { position: absolute; right: 4px; bottom: 2px; font-size: 9px; color: var(--muted); font-family: var(--mono); }
.pz-keys { display: flex; justify-content: center; }
.pz-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #5b8fd9, #3b6cb0); border: none; }
.pz-done { font-weight: 800; color: var(--good-strong); }
.pz-tip { color: var(--muted); font-size: 12px; }
</style>
