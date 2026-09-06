<script setup>
// 美食拼图（2026-09-06 顶部第三页）：每日一张 4×4 华容道（数字碎片拼回世界美食），完成得能量饼干 ×1（每日 1 次）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const SIZE = 4
const tiles = ref([]) // 16 个值 1-15 + 0(空位)，0 = 空
const moves = ref(0)
const won = ref(false)

const LABELS = ['🍚', '🥟', '🍜', '🦐', '🥘', '🍣', '🍙', '🍢', '🍡', '🥮', '🍵', '🥟', '🍲', '🍰', '🍪', '🥤']
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
  // 每日固定种子：从完成态随机移动 250 步（保证可解）
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]
  const rng = mulberry32(dayHash())
  const moves4 = ['up', 'down', 'left', 'right']
  for (let i = 0; i < 250; i++) {
    const idx = arr.indexOf(0)
    const r = Math.floor(idx / SIZE), c = idx % SIZE
    const options = []
    if (r > 0) options.push(idx - SIZE)
    if (r < SIZE - 1) options.push(idx + SIZE)
    if (c > 0) options.push(idx - 1)
    if (c < SIZE - 1) options.push(idx + 1)
    const pick = options[Math.floor(rng() * options.length)]
    ;[arr[idx], arr[pick]] = [arr[pick], arr[idx]]
    void moves4
  }
  return arr
}
function resetDay() {
  tiles.value = scrambled()
  moves.value = 0
  won.value = false
}
function checkWin() {
  for (let i = 0; i < 15; i++) if (tiles.value[i] !== i + 1) return false
  if (tiles.value[15] !== 0) return false
  return true
}
function tap(i) {
  if (won.value) return
  const empty = tiles.value.indexOf(0)
  const r = Math.floor(i / SIZE), c = i % SIZE
  const er = Math.floor(empty / SIZE), ec = empty % SIZE
  if (Math.abs(r - er) + Math.abs(c - ec) !== 1) return
  ;[tiles.value[i], tiles.value[empty]] = [tiles.value[empty], tiles.value[i]]
  moves.value++
  if (checkWin()) {
    won.value = true
    const mg = player.minigames.puzzle
    const today = todayKey()
    if (!mg) player.minigames.puzzle = { day: '', done: 0 }
    if (mg.day !== today) mg.day = today
    if ((mg.done ?? 0) < 1) {
      player.minigames.puzzle.done = (mg.done ?? 0) + 1 // 每日仅计发一次（2026-09-06 修复可无限领取）
      player.gainItem('energyBiscuit', 1)
      ui.pushLog('🧩 每日美食拼图完成！+能量饼干 ×1', 'gain')
    }
  }
  // 防止直接修改引用丢失响应性：用新数组替换
  tiles.value = [...tiles.value]
}
function todayKey() {
  const t = new Date()
  return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
}
const doneToday = computed(() => {
  const mg = player.minigames?.puzzle ?? { day: '', done: 0 }
  return mg.day === todayKey() && (mg.done ?? 0) >= 1
})
resetDay()
const cells = computed(() => tiles.value)
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🧩 每日美食拼图</h2>
        <p class="dim">每天一张 4×4 碎片拼图：<b>点击与空格相邻的碎片</b>，把它滑进空位——把乱序碎片按编号 1→15 复原成下边的「目标图」即完成！完成得 <b>能量饼干 ×1</b>（每日 1 次）。</p>
      </div>
      <div class="skill-head-right">
        <span class="badge" :class="doneToday ? 'badge-on' : ''">{{ doneToday ? '✅ 今日已完成' : '📅 今日未完成' }}</span>
        <span class="dim mono">步数 {{ moves }}</span>
      </div>
    </header>

    <div class="card">
      <div class="puzzle-goal-label">🎯 目标图（右下角编号 = 正确顺序）</div>
      <div class="puzzle-board puzzle-goal">
        <div v-for="(lbl, i) in LABELS" :key="'g' + i" class="puzzle-cell puzzle-goal-cell">
          {{ lbl }}<span class="puzzle-num">{{ i + 1 }}</span>
        </div>
      </div>
      <div class="puzzle-board puzzle-board-play">
        <div
          v-for="(v, i) in cells"
          :key="i"
          class="puzzle-cell"
          :class="{ empty: v === 0 }"
          @click="tap(i)"
        >
          <template v-if="v">{{ LABELS[v - 1] }}<span class="puzzle-num">{{ v }}</span></template>
        </div>
      </div>
      <div class="g2048-controls">
        <button class="btn btn-sm" @click="resetDay()">重新打乱（当日固定）</button>
      </div>
      <div v-if="won" class="heat-verdict perfect">🎉 复原完成！{{ doneToday ? '每日奖励已领取' : '+能量饼干 ×1' }}</div>
    </div>
  </div>
</template>
