<script setup>
// 食材连连看（2026-09-06 顶部第三页）：6×6 配对消除（18 对知名食材），全清得「满汉全席」buff（经验 +20% 1 小时，每日 1 次）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const GRID = 6
const PAIRS = ['apple', 'potato', 'tomato', 'chili', 'carrot', 'watermelon', 'grape', 'strawberry', 'eggplant', 'mushroom', 'fish', 'shrimp', 'bread', 'noodles', 'dumpling', 'rice', 'pumpkin', 'onion']
const LABEL = { fish: '🐟', shrimp: '🦐', bread: '🍞', noodles: '🍜', dumpling: '🥟', rice: '🍚', pumpkin: '🎃', onion: '🧅' }
const EMOJI = {
  apple: '🍎', potato: '🥔', tomato: '🍅', chili: '🌶️', carrot: '🥕', watermelon: '🍉',
  grape: '🍇', strawberry: '🍓', eggplant: '🍆', mushroom: '🍄', fish: '🐟', shrimp: '🦐',
  bread: '🍞', noodles: '🍜', dumpling: '🥟', rice: '🍚', pumpkin: '🎃', onion: '🧅',
}

const board = ref([]) // [{ id, key, cleared }] 36 格
const selected = ref(null) // 选中格 index
const clearedCount = computed(() => board.value.filter((c) => c.cleared).length)
const done = computed(() => board.value.length && clearedCount.value === board.value.length)

function resetDay() {
  const pool = [...PAIRS, ...PAIRS]
  const arr = pool.sort(() => Math.random() - 0.5).map((id, i) => ({ id, key: id + '-' + i, cleared: false }))
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
  const today = todayKey()
  if (mg.day !== today) mg.day = today
  if ((mg.buffed ?? 0) < 1) {
    player.buffs.xpMult = { mult: 1.2, expiresAt: Date.now() + 3600_000 }
    mg.buffed = (mg.buffed ?? 0) + 1
    ui.pushLog('🍽 食材连连看全清！获得「满汉全席」buff：全部经验 +20%（1 小时）', 'gain')
  } else {
    ui.pushLog('🍽 又全清啦！今日 buff 已领取过，明天再来。', 'info')
  }
}
function todayKey() {
  const t = new Date()
  return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
}
const buffActive = computed(() => {
  const b = player.buffs?.xpMult
  return b && b.mult > 1 && (b.expiresAt ?? 0) > Date.now()
})

resetDay()
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🀄 食材连连看</h2>
        <p class="dim">6×6 食材配对消除——点两张相同的食材即可消除。清空全场得 <b>「满汉全席」buff（经验 +20%，1 小时）</b>，每日 1 次。</p>
      </div>
      <div class="skill-head-right">
        <span class="badge badge-on">还剩 {{ GRID * GRID - clearedCount }}</span>
        <span class="dim mono">{{ buffActive ? '🔥 满汉全席 buff 生效中' : '今日 buff 未领取' }}</span>
      </div>
    </header>

    <div class="card">
      <div class="match-board">
        <div
          v-for="(c, i) in board"
          :key="c.key"
          class="match-cell"
          :class="{ cleared: c.cleared, selected: selected === i }"
          @click="tap(i)"
        >{{ c.cleared ? '' : EMOJI[c.id] ?? LABEL[c.id] ?? '❓' }}</div>
      </div>
      <div class="g2048-controls">
        <button class="btn btn-sm" @click="resetDay()">重新洗牌</button>
      </div>
      <div v-if="done" class="heat-verdict perfect">🍽 全清！{{ buffActive ? '「满汉全席」buff 已生效（+20% 经验 1 小时）' : '每日奖励已领完，明天再来！' }}</div>
    </div>
  </div>
</template>
