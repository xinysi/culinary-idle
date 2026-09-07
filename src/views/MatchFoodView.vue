<script setup>
// 食材连连看（2026-09-07 十模式版：2×2~11×11 网格尺寸梯度，奖励严格递增；状态行 [最高分/剩余]；模式说明弹窗）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { ITEMS } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

const mode = ref('m6')
const MODES = {
  m2: { label: '2×2 入门', size: 2, pairs: 2, gold: 20, desc: '2×2 · 2 对 · +20 金 —— 入门熟悉' },
  m3: { label: '3×3 新手', size: 3, pairs: 4, gold: 50, desc: '3×3 · 4 对 · +50 金' },
  m4: { label: '4×4 快速', size: 4, pairs: 8, gold: 80, desc: '4×4 · 8 对 · +80 金 —— 手速快节奏' },
  m5: { label: '5×5 进阶', size: 5, pairs: 12, gold: 120, desc: '5×5 · 12 对 · +120 金' },
  m6: { label: '6×6 标准', size: 6, pairs: 18, gold: 150, desc: '6×6 · 18 对 · +150 金 —— 经典体验' },
  m7: { label: '7×7 高手', size: 7, pairs: 24, gold: 260, desc: '7×7 · 24 对 · +260 金' },
  m8: { label: '8×8 挑战', size: 8, pairs: 32, gold: 320, desc: '8×8 · 32 对 · +320 金' },
  m9: { label: '9×9 宗师', size: 9, pairs: 40, gold: 420, desc: '9×9 · 40 对 · +420 金' },
  m10: { label: '10×10 传奇', size: 10, pairs: 50, gold: 550, desc: '10×10 · 50 对 · +550 金' },
  m11: { label: '11×11 史诗', size: 11, pairs: 60, gold: 700, desc: '11×11 · 60 对 · +700 金 —— 终极记忆挑战' },
}
const showInfo = ref(false)
const GRID = computed(() => MODES[mode.value].size)

/* 图片制素材池：全部有图的食物/食材物品（稳定渲染，2026-09-07 替代 emoji 规避字体缺失） */
const IMG_POOL = Object.values(ITEMS)
  .filter((i) => ['ingredient', 'food', 'spice'].includes(i.type) && itemImage(i.id))
  .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh'))
  .map((i) => i.id)
  .slice(0, 64)
function poolFor() {
  // 池内一次随机排序后截取：配对始终完备；即使请求数 > 池也安全返回可用子集（不会死循环/缺对）
  const n = MODES[mode.value].pairs
  return [...IMG_POOL].sort(() => Math.random() - 0.5).slice(0, n)
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
      <button v-for="(m, key) in MODES" :key="key" class="mf-mode" :class="{ on: mode === key }" @click="mode = key; resetDay()">{{ m.label }}</button>
      <span class="mf-chip" style="margin-left: auto">🏆 全清 <b class="mono">{{ buffDays }}</b> 次</span>
      <span class="mf-chip">🀄 剩余 <b class="mono">{{ board.length - clearedCount }}</b></span>
    </div>

    <div class="mf-board" :style="{ gridTemplateColumns: 'repeat(' + MODES[mode].size + ', minmax(0, 1fr))' }">
      <div
        v-for="(c, i) in board"
        :key="c.key"
        class="mf-cell"
        :class="{ cleared: c.cleared, selected: selected === i }"
        @click="tap(i)"
      ><img v-if="!c.cleared" class="mf-img" :src="itemImage(c.id)" @error="$event.target.style.display = 'none'" alt="" /></div>
    </div>

    <div class="mf-keys">
      <button class="mf-reset" @click="resetDay()">重新洗牌</button>
      <button class="mf-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>
    <div v-if="done" class="mf-done">🍽 全清！+{{ MODES[mode].gold }} 金币</div>
    <div v-if="showInfo" class="mf-info-mask" @click.self="showInfo = false">
      <div class="mf-info-box">
        <div class="mf-info-head"><b>🀄 食材连连看 · 十种模式说明</b><button class="mf-info-close" @click="showInfo = false">✕</button></div>
        <div class="mf-info-list">
          <div class="mf-info-row mf-info-rule">通用规则：点两张相同食材消除 · 清空全场得金币 · 换模式/洗牌会重新发牌</div>
          <div v-for="(m, key) in MODES" :key="key" class="mf-info-row">
            <b class="mf-info-name">{{ m.label }}</b>
            <span class="mf-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.mf-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.mf-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.mf-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.mf-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.mf-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.mf-chip.ok { background: rgba(87, 168, 97, 0.16); border-color: var(--good-strong); color: var(--good-strong); }
.mf-board {
  width: min(560px, 94%);
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 7px;
  padding: 14px; border-radius: 18px;
  background: rgba(150, 110, 70, 0.16);
  border: 1px solid rgba(150, 110, 70, 0.3);
  box-shadow: 0 10px 28px rgba(93, 64, 55, 0.14);
}
.mf-cell {
  aspect-ratio: 1;
  display: flex; align-items: center; justify-content: center;
  padding: 6px;
  border-radius: 10px; cursor: pointer; user-select: none;
  background: rgba(255, 251, 244, 0.92); border: 1px solid rgba(150, 110, 70, 0.25);
  transition: transform 0.1s ease;
}
.mf-img { width: 100%; height: 100%; object-fit: contain; } /* 固定尺寸：格内撑满按比例居中 */
.mf-cell:hover { transform: scale(1.05); }
.mf-cell.selected { border-color: var(--gold); box-shadow: 0 0 10px rgba(168, 120, 11, 0.5); }
.mf-cell.cleared { background: rgba(87, 168, 97, 0.12); border-color: rgba(87, 168, 97, 0.3); cursor: default; }
.mf-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.mf-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.mf-info-btn { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.mf-done { font-weight: 800; color: var(--good-strong); }
.mf-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.mf-info-box { width: min(560px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.mf-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.mf-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.mf-info-list { display: flex; flex-direction: column; gap: 8px; }
.mf-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.mf-info-rule { border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; }
.mf-info-name { flex: 0 0 110px; color: var(--primary-strong); }
.mf-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
