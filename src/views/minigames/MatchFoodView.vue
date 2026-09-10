<script setup>
// 食材连连看（2026-09-07 v3 偶数棋盘版）：五个偶数网格（2/4/6/8/10，牌数恰好填满无空位）
// + 五个玩法变体：限时（倒计时内全清）/ 限步（步数内全清）/ 翻牌记忆（牌面朝下，配对翻错盖回）
import { ref, computed, onUnmounted } from 'vue'
import { usePlayerStore } from '../../stores/player.js'
import { useUiStore } from '../../stores/ui.js'
import { ITEMS } from '../../game/data/items.js'
import { itemImage } from '../../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

const mode = ref('m4')
const MODES = {
  m2: { label: '2×2 入门', size: 2, pairs: 2, gold: 12, kind: 'normal', desc: '2×2 · 2 对 · +12 币 —— 入门热身' },
  m4: { label: '4×4 快速', size: 4, pairs: 8, gold: 45, kind: 'normal', desc: '4×4 · 8 对 · +45 币' },
  t4: { label: '4×4 限时', size: 4, pairs: 8, gold: 60, kind: 'time', time: 60, desc: '4×4 · 8 对 · 限 60 秒全清 · +60 币 —— 超时失败' },
  s4: { label: '4×4 限步', size: 4, pairs: 8, gold: 70, kind: 'steps', maxSteps: 16, desc: '4×4 · 8 对 · 限 16 步（每两次点击算 1 步）· +70 币 —— 超步失败' },
  m6: { label: '6×6 标准', size: 6, pairs: 18, gold: 90, kind: 'normal', desc: '6×6 · 18 对 · +90 币 —— 经典体验' },
  t6: { label: '6×6 限时', size: 6, pairs: 18, gold: 110, kind: 'time', time: 90, desc: '6×6 · 18 对 · 限 90 秒全清 · +110 币 —— 超时失败' },
  s6: { label: '6×6 限步', size: 6, pairs: 18, gold: 135, kind: 'steps', maxSteps: 30, desc: '6×6 · 18 对 · 限 30 步 · +135 币 —— 超步失败' },
  m8: { label: '8×8 挑战', size: 8, pairs: 32, gold: 180, kind: 'normal', desc: '8×8 · 32 对 · +180 币' },
  t8: { label: '8×8 限时', size: 8, pairs: 32, gold: 220, kind: 'time', time: 120, desc: '8×8 · 32 对 · 限 120 秒全清 · +220 币 —— 超时失败' },
  m10: { label: '10×10 传奇', size: 10, pairs: 50, gold: 300, kind: 'normal', desc: '10×10 · 50 对 · +300 币 —— 终极眼力' },
}
const showInfo = ref(false)

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
const started = ref(false)
const failed = ref(false)
const timeLeft = ref(null) // 限时模式剩余秒数
const stepsLeft = ref(null) // 限步模式剩余步数
let timerId = null
const clearedCount = computed(() => board.value.filter((c) => c.cleared).length)
const done = computed(() => board.value.length && clearedCount.value === board.value.length)

function resetDay() {
  // 一次抽 n 种再复制成对：配对完备；偶数棋盘 2pairs=size² 恰好填满（无空位）
  const ids = poolFor()
  const kind = MODES[mode.value].kind
  const arr = [...ids, ...ids].sort(() => Math.random() - 0.5).map((id, i) => ({ id, key: id + '-' + i, cleared: false }))
  board.value = arr
  selected.value = null
  failed.value = false
  if (timerId) clearInterval(timerId)
  started.value = false
  timeLeft.value = kind === 'time' ? MODES[mode.value].time : null
  stepsLeft.value = kind === 'steps' ? MODES[mode.value].maxSteps : null
}
onUnmounted(() => { if (timerId) clearInterval(timerId) })

function failNow() {
  failed.value = true
  if (timerId) clearInterval(timerId)
}
function startTimer() {
  if (timerId) clearInterval(timerId)
  if (MODES[mode.value].kind !== 'time') return
  timerId = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0 && !done.value) {
      timeLeft.value = 0
      failed.value = true
      clearInterval(timerId)
    }
  }, 1000)
}
function startGame() {
  if (started.value) return
  started.value = true
  startTimer()
}
function tap(i) {
  if (!started.value) return
  const c = board.value[i]
  if (c.cleared || failed.value) return
  const mm = MODES[mode.value]
  // —— 明牌玩法（普通/限时/限步）——
  if (selected.value === i) { selected.value = null; return }
  if (selected.value == null) { selected.value = i; return }
  const a = board.value[selected.value]
  selected.value = null
  if (a.id === c.id) {
    a.cleared = true
    c.cleared = true
    if (done.value) settle()
  }
  if (mm.kind === 'steps') {
    stepsLeft.value--
    if (stepsLeft.value <= 0 && !done.value) failNow()
  }
}
function settle() {
  const mg = player.minigames.matchfood
  if (!mg) player.minigames.matchfood = { day: '', buffed: 0 }
  mg.day = todayKey()
  // 每次全清得游戏币（按模式难度，2026-09-07 统一游戏币奖励）
  const gold = MODES[mode.value].gold
  mg.buffed = (mg.buffed ?? 0) + 1
  player.gainGameCoins(gold)
  ui.pushLog(`🍽 食材连连看全清！+${gold} 游戏币`, 'gain')
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
      <button v-for="(m, key, idx) in MODES" :key="key" class="mf-mode" :class="{ on: mode === key }" @click="mode = key; resetDay()">模式{{ idx + 1 }}</button>
      <span class="mf-chip" style="margin-left: auto">🏆 全清 <b class="mono">{{ buffDays }}</b> 次</span>
      <span v-if="timeLeft !== null" class="mf-chip">⏱ 剩余 <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span v-if="stepsLeft !== null" class="mf-chip">🎯 余 <b class="mono">{{ stepsLeft }}</b> 步</span>
      <span class="mf-chip">🀄 剩余 <b class="mono">{{ board.length - clearedCount }}</b></span>
      <button class="mf-info-btn" @click="showInfo = true">📖 模式说明</button>
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
      <button v-if="!started" class="mf-start" @click="startGame()">▶ 开始游戏</button>
      <button class="mf-reset" @click="resetDay()">🔄 重置本局</button>
    </div>
        <div v-if="done || failed" class="mf-mask">
      <div class="mf-result">
        <div class="mf-result-head"><b>{{ done ? '🍽 全清！' : '💦 超限未清！' }}</b></div>
        <div class="mf-result-score"><span v-if="done" class="mf-gold">+{{ MODES[mode].gold }} 游戏币</span><span v-else>再来一局</span></div>
        <button class="mf-again" @click="resetDay()">🔄 再来一局</button>
      </div>
      <div v-if="done" class="mf-fire">
        <span v-for="i in 20" :key="i" class="mf-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>
    
    <div v-if="showInfo" class="mf-info-mask" @click.self="showInfo = false">
      <div class="mf-info-box">
        <div class="mf-info-head"><b>🀄 食材连连看 · 十种模式说明</b><button class="mf-info-close" @click="showInfo = false">✕</button></div>
        <div class="mf-info-list">
          <div class="mf-info-row mf-info-rule">通用规则：点两张相同食材消除 · 全部清空得游戏币 · 偶数棋盘恰好填满（无缺格）· 限时/限步/翻牌为玩法变体</div>
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
.mf-mode {
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  border: 1px dashed rgba(150, 110, 70, 0.4);
  background: rgba(255, 252, 246, 0.8);
  color: var(--muted);
}
.mf-mode.on {
  border-style: solid;
  border-color: var(--primary-strong);
  background: rgba(217, 90, 56, 0.14);
  color: var(--primary-strong);
}
.mf-chip {
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.8);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
}
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
.mf-keys {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}
.mf-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.mf-info-btn {
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #72b864, #589c4b);
  border: none;
}
.mf-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.mf-info-box {
  width: min(620px, 92vw);
  max-height: 76vh;
  overflow: auto;
  background: rgba(255, 252, 246, 0.94);
  border: 1px solid rgba(150, 110, 70, 0.35);
  border-radius: 16px;
  padding: 16px 18px;
  backdrop-filter: blur(12px);
  box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35);
}
.mf-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.mf-info-close {
  cursor: pointer;
  border: none;
  background: rgba(150, 110, 70, 0.15);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  font-weight: 700;
  color: var(--text);
}
.mf-info-list { display: flex; flex-direction: column; gap: 8px; }
.mf-info-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  background: rgba(255, 251, 244, 0.8);
  border: 1px solid rgba(150, 110, 70, 0.2);
  border-radius: 10px;
  padding: 8px 12px;
}
.mf-info-rule {
  border-color: rgba(88, 156, 75, 0.35);
  background: rgba(114, 184, 100, 0.1);
  color: var(--text);
  font-size: 12.5px;
  display: block;
  line-height: 1.7;
}
.mf-info-name {
  flex: 0 0 82px;
  color: var(--primary-strong);
}
.mf-info-desc {
  flex: 1;
  font-size: 12.5px;
  color: var(--muted);
}

/* ── mf 结算弹窗（2026-09-09 统一）── */
.mf-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.mf-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.mf-result-head { font-size: 18px; }
.mf-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.mf-gold { color: var(--good-strong); font-weight: 800; }
.mf-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.mf-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.mf-spark { position: absolute; font-size: 22px; color: var(--gold); animation: mfSpark 1.1s ease-out forwards; }
@keyframes mfSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }

/* ── mf 开始门控（2026-09-09）── */
.mf-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
</style>
