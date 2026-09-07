<script setup>
// 每日美食拼图（2026-09-06 逐页重排版：顶部状态条 + 双图并排面板 + 底部控制）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { ITEMS } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'
import { PT_PHOTOS, ptUrl } from '../game/data/ptPhotos.js'

const player = usePlayerStore()
const ui = useUiStore()

const mode = ref('s4')
const MODES = {
  s2: { label: '2×2 入门', size: 2, gold: 40 },
  s3: { label: '3×3 轻松', size: 3, gold: 80 },
  l3: { label: '3×3 限步', size: 3, gold: 120, maxSteps: 80 },
  s4: { label: '4×4 标准', size: 4, gold: 150 },
  l4: { label: '4×4 限步', size: 4, gold: 220, maxSteps: 250 },
  s5: { label: '5×5 大师', size: 5, gold: 250 },
  l5: { label: '5×5 限步', size: 5, gold: 400, maxSteps: 700 },
  s6: { label: '6×6 宗师', size: 6, gold: 450 },
  s7: { label: '7×7 传奇', size: 7, gold: 700 },
  s8: { label: '8×8 史诗', size: 8, gold: 1000 },
}
const SIZE = computed(() => MODES[mode.value].size)
const tiles = ref([])
const moves = ref(0)
const won = ref(false)
const failed = ref(false) // 限步模式步数超限即失败（不结算）

// 图鉴图片池（有图食物按中文名排序，按 size² 截取）
const IMG_IDS = Object.values(ITEMS)
  .filter((i) => ['food', 'ingredient'].includes(i.type) && itemImage(i.id))
  .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh'))
  .map((i) => i.id)
  .slice(0, 30)
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
  failed.value = false
}
function checkWin() {
  const total = SIZE.value * SIZE.value
  for (let i = 0; i < total - 1; i++) if (tiles.value[i] !== i + 1) return false
  if (tiles.value[total - 1] !== 0) return false
  return true
}
function tap(i) {
  if (won.value || failed.value) return
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
    if (!mg) player.minigames.puzzle = { day: '', done: 0 }
    mg.day = todayKey()
    mg.done = (mg.done ?? 0) + 1
    // 每次完成得金币（按模式难度，2026-09-07 统一金币奖励）
    const gold = MODES[mode.value].gold
    player.gainGold(gold)
    ui.pushLog(`🧩 拼图完成！+${gold} 金币（累计 ${mg.done} 次）`, 'gain')
  } else if (MODES[mode.value].maxSteps && moves.value >= MODES[mode.value].maxSteps) {
    failed.value = true // 限步超限：本局失败，重新打乱再来
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
// 图片拼图：每日固定一张图（图鉴物品图），左=完整图、右=同图切块
// 图片拼图：每日固定一张照片（public/images/items/pt/ 用户素材），左=完整照片、右=同照片切块
const picIndex = dayHash() % PT_PHOTOS.length
const puzzlePic = computed(() => ptUrl(PT_PHOTOS[picIndex]))
function bgStyle(v) {
  if (!v) return {}
  const size = SIZE.value
  const r = Math.floor((v - 1) / size)
  const c = (v - 1) % size
  return {
    backgroundImage: 'url(' + puzzlePic.value + ')',
    backgroundSize: size * 100 + '% ' + size * 100 + '%',
    backgroundPosition: (c / (size - 1)) * 100 + '% ' + (r / (size - 1)) * 100 + '%',
    backgroundRepeat: 'no-repeat',
  }
}
resetDay()
const cells = computed(() => tiles.value)
</script>

<template>
  <div class="pz-page">
    <div class="pz-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="pz-mode" :class="{ on: mode === key }" @click="mode = key; resetDay()">{{ m.label }}</button>
      <span class="pz-chip" style="margin-left: auto">🏆 累计完成 <b class="mono">{{ doneDays }}</b> 天</span>
      <span class="pz-chip">✅ 累计 <b class="mono">{{ doneDays }}</b> 次</span>
      <span class="pz-chip">🎯 步数 <b class="mono">{{ moves }}</b></span>
    </div>

    <div class="pz-duo">
      <div class="pz-col">
        <div class="pz-label">🎯 完整图（参考）</div>
        <div class="pz-board pz-board-full">
          <img class="pz-fullimg" :src="puzzlePic" alt="" />
        </div>
      </div>
      <div class="pz-col">
        <div class="pz-label">🧩 切割块（点击与空格相邻的碎片滑入）</div>
        <div class="pz-board" :style="{ gridTemplateColumns: 'repeat(' + MODES[mode].size + ', minmax(0, 1fr))' }">
          <div v-for="(v, i) in cells" :key="i" class="pz-cell" :class="{ empty: v === 0 }" :style="bgStyle(v)" @click="tap(i)">
            <span v-if="v" class="pz-num pz-num-big">{{ v }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="pz-keys">
      <button class="pz-reset" @click="resetDay()">重新打乱（当日固定）</button>
    </div>
    <div v-if="won" class="pz-done">🎉 复原完成！+{{ MODES[mode].gold }} 金币</div>
    <div v-if="failed" class="pz-done pz-fail">💦 步数超限！本局未完成 —— 重新打乱再来</div>
    <div class="pz-tip">每天同一张图 · 完成得金币（40~1000 金）· 限步模式超步数即失败 · 共十种模式</div>
  </div>
</template>
<style scoped>
.pz-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.pz-topbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; width: 100%; }
.pz-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.pz-chip.ok { background: rgba(87, 168, 97, 0.16); border-color: var(--good-strong); color: var(--good-strong); }
.pz-duo { display: flex; gap: 22px; justify-content: center; align-items: flex-start; flex-wrap: wrap; }
.pz-col { display: flex; flex-direction: column; gap: 6px; align-items: center; }
/* 完整图：与切割块同尺寸变形（或放大后居中），左列参考 */
.pz-board-full { display: block !important; position: relative; padding: 0; overflow: hidden; }
.pz-fullimg { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
/* 切割块：背景切片（bgStyle 驱动） */
.pz-cell { padding: 0; }
.pz-cell:not(.empty) { background-color: rgba(255, 251, 244, 0.92); background-size: 100% 100%; }
.pz-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.pz-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.pz-label { font-size: 12px; font-weight: 700; color: var(--primary-strong); }
.pz-board {
  width: 450px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
  padding: 8px; border-radius: 14px;
  background: rgba(150, 110, 70, 0.16);
  border: 1px solid rgba(150, 110, 70, 0.3);
  box-shadow: 0 8px 20px rgba(93, 64, 55, 0.14);
}
.pz-cell {
  position: relative; aspect-ratio: 1;
  display: flex; align-items: center; justify-content: center;
  padding: 9px; border-radius: 8px; cursor: pointer; user-select: none;
  background: rgba(255, 251, 244, 0.92); border: 1px solid rgba(150, 110, 70, 0.25);
}
.pz-img { width: 100%; height: 100%; object-fit: contain; } /* 图片固定尺寸：格内撑满按比例居中 */
.pz-num-big { font-size: 12px; font-weight: 800; }
.pz-goal-cell { cursor: default; }
.pz-goal-num { font-size: 20px; color: rgba(90, 62, 40, 0.55); }
.pz-goal-cell { background: rgba(255, 251, 244, 0.5); }
.pz-cell.empty { background: transparent; border-color: transparent; cursor: default; }
.pz-num { position: absolute; right: 6px; bottom: 4px; font-size: 13px; color: var(--muted); font-family: var(--mono); font-weight: 700; }
.pz-keys { display: flex; justify-content: center; }
.pz-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #5b8fd9, #3b6cb0); border: none; }
.pz-done { font-weight: 800; color: var(--good-strong); }
.pz-fail { color: var(--bad-strong); }
.pz-tip { color: var(--muted); font-size: 12px; }
</style>
