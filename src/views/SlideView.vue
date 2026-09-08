<script setup>
// 摆盘华容道（2026-09-09 新增，第 18 款）：滑块拼图——点击与空格相邻的菜块滑动
// 两种目标：主菜归位（把 ⭐ 主菜滑到金框格）/ 整盘还原（按编号顺序排好）· 十模式（棋盘 3×3→5×5、目标、步数上限）
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

// ── 图块素材（24 张图鉴食材图，够 5×5 用）──
const POOL = [
  'apple', 'carrot', 'tomato', 'strawberry', 'grape', 'pineapple',
  'mango', 'durian', 'lime', 'watermelon', 'hamimelon', 'winterMelon',
  'banana', 'ume', 'bayberry', 'soybean', 'sesame', 'barley',
  'teaLeaf', 'mint', 'rose', 'chrysanthemum', 'osmanthus', 'jasmine',
]
// 预加载 + 取 URL（模板 :src 需要字符串，不能直接传 Image 对象）
const IMGS = POOL.map((id) => {
  const im = new Image()
  im.src = itemImage(id)
  return im
})
const imgOf = (v) => itemImage(POOL[(v - 1) % POOL.length])

// ── 十模式（棋盘 × 目标类型 × 步数/时限）──
// goal: single/multi = 把 ⭐ 主菜滑到金框格（可多个）；order = 整盘按编号还原
const MODES = {
  m1: { label: '模式1', n: 3, goal: 'single', stars: [1], cells: [4], moves: 10, gold: 30, desc: '3×3 · 主菜归位（1 个目标格）· 10 步内 · +30 币' },
  m2: { label: '模式2', n: 3, goal: 'single', stars: [1], cells: [4], moves: 7, gold: 35, desc: '3×3 · 主菜归位 · 7 步内 · +35 币' },
  m3: { label: '模式3', n: 3, goal: 'order', moves: 28, gold: 75, desc: '3×3 · 整盘还原（按编号 1、2、3…）· 28 步内 · +75 币' },
  m4: { label: '模式4', n: 3, goal: 'order', moves: 26, hideNums: true, gold: 95, desc: '3×3 · 整盘还原 · **隐藏编号**（照预览图靠图案认位）· 26 步内 · +95 币' },
  m5: { label: '模式5', n: 4, goal: 'multi', stars: [1, 2], cells: [0, 15], moves: 20, gold: 55, desc: '4×4 · 双菜归位（2 个 ⭐ 各滑到金框格）· 20 步内 · +55 币' },
  m6: { label: '模式6', n: 4, goal: 'order', moves: 80, gold: 165, desc: '4×4 · 整盘还原 · 80 步内 · +165 币' },
  m7: { label: '模式7', n: 4, goal: 'order', moves: 60, gold: 150, desc: '4×4 · 整盘还原 · 60 步内 · +150 币' },
  m8: { label: '模式8', n: 5, goal: 'multi', stars: [1, 2, 3], cells: [0, 12, 24], moves: 30, gold: 85, desc: '5×5 · 三菜归位（3 个 ⭐ 各就各位）· 30 步内 · +85 币' },
  m9: { label: '模式9', n: 5, goal: 'multi', stars: [1, 2, 3], cells: [0, 12, 24], moves: 24, timeLimit: 120, gold: 105, desc: '5×5 · 三菜归位 · **限时 120 秒** + 24 步 · +105 币' },
  m10: { label: '模式10', n: 4, goal: 'order', moves: 60, timeLimit: 180, gold: 180, desc: '4×4 · 整盘还原 · **限时 180 秒** + 60 步 · +180 币' },
}
const showInfo = ref(false)

// ── 响应式状态 ──
const mode = ref('m1')
const board = ref([])
const moves = ref(0)
const elapsed = ref(0)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const hint = ref('')
const best = computed(() => player.minigames?.slide?.best ?? 0) // 最少步数（通关时记录）
const cfg = computed(() => MODES[mode.value])
const isOrder = computed(() => cfg.value.goal === 'order')
const starSet = computed(() => new Set(cfg.value.stars ?? []))
const cell = computed(() => (cfg.value.n === 3 ? 128 : cfg.value.n === 4 ? 96 : 78))
const gap = 6
const boardPx = computed(() => cfg.value.n * cell.value + (cfg.value.n - 1) * gap)
const movesText = computed(() => `${moves.value}/${cfg.value.moves}`)
const timeText = computed(() => (cfg.value.timeLimit ? `${elapsed.value}/${cfg.value.timeLimit}` : `${elapsed.value}`))

let timerId = null
let elapsedAccum = 0
let lastTs = 0

// ── 生成：从已解状态随机走合法步（保证可解）──
function buildBoard() {
  const n = cfg.value.n
  const total = n * n
  const b = new Array(total)
  for (let i = 0; i < total - 1; i++) b[i] = i + 1
  b[total - 1] = 0
  // 随机游走打乱（避免原地回退）
  let gapIdx = total - 1
  let prev = -1
  const steps = n * n * 12
  for (let k = 0; k < steps; k++) {
    const nbs = neighbors(gapIdx, n).filter((x) => x !== prev)
    if (!nbs.length) continue
    const pick = nbs[Math.floor(Math.random() * nbs.length)]
    b[gapIdx] = b[pick]
    b[pick] = 0
    prev = gapIdx
    gapIdx = pick
  }
  // 打乱后确保没有 ⭐ 主菜恰好已经在目标格
  const c = cfg.value
  if (c.goal !== 'order') {
    for (let k = 0; k < c.stars.length; k++) {
      const cellIdx = c.cells[k]
      if (b[cellIdx] === c.stars[k]) {
        const nbs = neighbors(cellIdx, c.n)
        if (nbs.length) {
          const pick = nbs[Math.floor(Math.random() * nbs.length)]
          b[cellIdx] = b[pick]
          b[pick] = 0
        }
      }
    }
  }
  return b
}
function neighbors(i, n) {
  const r = Math.floor(i / n)
  const c = i % n
  const out = []
  if (r > 0) out.push(i - n)
  if (r < n - 1) out.push(i + n)
  if (c > 0) out.push(i - 1)
  if (c < n - 1) out.push(i + 1)
  return out
}
function gapIndex() {
  return board.value.indexOf(0)
}

// ── 点击滑动 ──
function tapTile(v) {
  if (!started.value || over.value) return
  const n = cfg.value.n
  const from = board.value.indexOf(v)
  const gi = gapIndex()
  if (from < 0 || gi < 0) return
  if (!neighbors(gi, n).includes(from)) return
  const b = board.value.slice()
  b[gi] = v
  b[from] = 0
  board.value = b
  moves.value++
  beep(520 + (moves.value % 4) * 60, 0.04, 'triangle', 0.05)
  // 每步都检查是否已达成目标
  if (isSolved()) { pass(); return }
  if (moves.value >= cfg.value.moves) settle(false)
}
function isSolved() {
  const c = cfg.value
  const b = board.value
  if (c.goal === 'order') {
    const n = c.n
    for (let i = 0; i < n * n - 1; i++) if (b[i] !== i + 1) return false
    return b[n * n - 1] === 0
  }
  for (let k = 0; k < c.stars.length; k++) if (b[c.cells[k]] !== c.stars[k]) return false
  return true
}

// ── 计时 ──
function startTimer() {
  stopTimer()
  lastTs = performance.now()
  timerId = setInterval(() => {
    const now = performance.now()
    elapsedAccum += (now - lastTs) / 1000
    lastTs = now
    elapsed.value = Math.floor(elapsedAccum)
    // 限时模式超时判负
    if (cfg.value.timeLimit && elapsedAccum >= cfg.value.timeLimit && !over.value) settle(false)
  }, 200)
}
function stopTimer() {
  if (timerId) clearInterval(timerId)
  timerId = null
}

// ── 音效 ──
let soundCtx = null
function beep(freq, dur, type = 'sine', vol = 0.06) {
  if (!player.settings?.soundEnabled) return
  try {
    soundCtx = soundCtx ?? new (window.AudioContext || window.webkitAudioContext)()
    const o = soundCtx.createOscillator()
    const g = soundCtx.createGain()
    o.type = type
    o.frequency.value = freq
    o.connect(g)
    g.connect(soundCtx.destination)
    g.gain.setValueAtTime(vol, soundCtx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, soundCtx.currentTime + dur)
    o.start()
    o.stop(soundCtx.currentTime + dur)
  } catch { /* 无音频环境忽略 */ }
}

// ── 开局 / 结算 ──
function reset() {
  stopTimer()
  board.value = buildBoard()
  moves.value = 0
  elapsed.value = 0
  elapsedAccum = 0
  over.value = false
  passed.value = false
  started.value = false
  hint.value = '点击「开始游戏」后，点与空格相邻的菜块滑动'
}
function startGame() {
  if (over.value) return
  started.value = true
  startTimer()
  const c = cfg.value
  hint.value = c.goal === 'order'
    ? '按编号顺序把菜块排好（1 在左上，空格在右下）'
    : `把 ${c.stars.length} 个 ⭐ 主菜分别滑到金框格子里`
  beep(880, 0.08)
}
function pass() {
  if (over.value) return
  over.value = true
  passed.value = true
  stopTimer()
  const m = cfg.value
  player.gainGameCoins(m.gold)
  ui.pushLog(`🍽️ 摆盘华容道：${moves.value} 步完成！+${m.gold} 游戏币`, 'gain')
  beep(880, 0.12)
  setTimeout(() => beep(1175, 0.12), 110)
  setTimeout(() => beep(1568, 0.22), 230)
  const mg = player.minigames
  if (!mg.slide) mg.slide = { best: 0 }
  // 最佳 = 同模式最少步数
  mg.slide.best = mg.slide.best && mg.slide.best < moves.value ? mg.slide.best : moves.value
}
function settle(win) {
  if (over.value) return
  over.value = true
  passed.value = false
  stopTimer()
  if (!win) {
    beep(160, 0.3, 'sawtooth')
    ui.pushLog(`🍽️ 摆盘华容道：${cfg.value.timeLimit && elapsedAccum >= cfg.value.timeLimit ? '超时' : cfg.value.moves + ' 步内没排好'}，未达标`, 'warn')
  }
}

onMounted(() => { reset() })
onUnmounted(() => { stopTimer() })
</script>

<template>
  <div class="sl-page">
    <div class="sl-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="sl-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="sl-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeText }}</b> 秒</span>
      <span class="sl-chip">🎯 步数 <b class="mono">{{ movesText }}</b></span>
      <span class="sl-chip">💰 <b class="mono">{{ cfg.gold }}</b> 币</span>
      <span class="sl-chip">🏆 最少步 <b class="mono">{{ best }}</b></span>
      <button class="sl-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <!-- 尺寸 +2 是给 1px 边框留位：绝对定位以 padding box 为基准，否则右下角菜块会溢出边框 -->
    <div class="sl-stage" :style="{ width: (boardPx + 2) + 'px', height: (boardPx + 2) + 'px' }">
      <div
        v-for="(v, i) in board"
        v-show="v !== 0"
        :key="v"
        class="sl-tile"
        :class="{ star: starSet.has(v) }"
        :style="{ left: (i % cfg.n) * (cell + gap) + 'px', top: Math.floor(i / cfg.n) * (cell + gap) + 'px', width: cell + 'px', height: cell + 'px' }"
        @click="tapTile(v)"
      >
        <img :src="imgOf(v)" alt="" @error="$event.target.style.display = 'none'" />
        <span v-if="!cfg.hideNums" class="sl-num">{{ v }}</span>
        <span v-if="starSet.has(v)" class="sl-star">⭐</span>
      </div>
      <!-- 目标格（画在菜块之上，避免被压住看不见） -->
      <div
        v-for="(tc, k) in (cfg.cells || [])"
        :key="'g' + k"
        class="sl-goal-cell"
        :style="{ left: (tc % cfg.n) * (cell + gap) + 'px', top: Math.floor(tc / cfg.n) * (cell + gap) + 'px', width: cell + 'px', height: cell + 'px' }"
      >★</div>
    </div>

    <!-- 目标排列预览（整盘还原模式） -->
    <div v-if="isOrder" class="sl-preview">
      <div class="sl-preview-title">目标排列</div>
      <div class="sl-preview-grid" :style="{ gridTemplateColumns: `repeat(${cfg.n}, 1fr)`, width: (cfg.n * 30 - 4) + 'px' }">
        <div
          v-for="i in cfg.n * cfg.n"
          :key="'p' + i"
          class="sl-preview-cell"
          :class="{ gap: i === cfg.n * cfg.n }"
        >
          <template v-if="i < cfg.n * cfg.n">
            <img :src="imgOf(i)" alt="" @error="$event.target.style.display = 'none'" />
            <span class="sl-preview-num">{{ i }}</span>
          </template>
        </div>
      </div>
    </div>

    <div class="sl-hint">{{ hint }}</div>

    <div class="sl-keys">
      <button v-if="!started" class="sl-start" @click="startGame()">▶ 开始游戏</button>
      <button v-else class="sl-reset" @click="reset()">🔄 重置本局</button>
    </div>

    <!-- 结算弹窗 -->
    <div v-if="over" class="sl-mask">
      <div class="sl-result">
        <div class="sl-result-head"><b>{{ passed ? '🎉 摆盘完成！' : '💦 步数用尽' }}</b></div>
        <div class="sl-result-score">
          <span>用了 <b class="mono">{{ moves }}</b> 步</span>
          <span class="dim">上限 {{ cfg.moves }} 步</span>
          <span class="dim">用时 {{ elapsed }} 秒</span>
          <span v-if="passed" class="sl-gold">+{{ cfg.gold }} 游戏币</span>
        </div>
        <button class="sl-again" @click="reset()">再来一局</button>
      </div>
      <div v-if="passed" class="sl-fire">
        <span v-for="i in 20" :key="i" class="sl-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="sl-info-mask" @click.self="showInfo = false">
      <div class="sl-info-box">
        <div class="sl-info-head"><b>🍽️ 摆盘华容道 · 十模式说明</b><button class="sl-info-close" @click="showInfo = false">✕</button></div>
        <div class="sl-info-list">
          <div class="sl-info-row sl-info-rule">
            玩法：菜块排成方阵，中间留一个空格；<b>点击与空格相邻的菜块</b>即可让它滑进空格。<br />
            <b>四种目标</b>：<b>主菜归位</b>——把带 ⭐ 的主菜滑到金框格（模式 1/2 一个、5 双菜、8/9 三菜）；
            <b>整盘还原</b>——按左上角编号 1、2、3… 依次排好、空格留在右下角（模式 3/6/7/10）；
            <b>隐藏编号</b>——模式 4 不显示编号，靠下方「目标排列」预览图认图案归位；
            <b>限时</b>——模式 9/10 除步数上限外还有时间限制，超时判负。<br />
            每局有<b>步数上限</b>，用完还没排好就判负；开局由「随机合法滑动」打乱，<b>保证一定可解</b>。<br />
            结算：在步数（与时限）内完成即达标发游戏币，并记录同模式的最少步数。
          </div>
          <div v-for="(m, key) in MODES" :key="key" class="sl-info-row">
            <b class="sl-info-name">{{ m.label }}</b>
            <span class="sl-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sl-page { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 4px 0 12px; }
.sl-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.sl-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.sl-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.sl-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.sl-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }

.sl-stage { position: relative; border-radius: 16px; background: rgba(120, 84, 50, 0.22); border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); overflow: hidden; }
.sl-goal-cell { position: absolute; display: flex; align-items: center; justify-content: center; border-radius: 12px; border: 2.5px dashed var(--gold); color: var(--gold); font-size: 24px; background: rgba(224, 161, 58, 0.16); pointer-events: none; z-index: 5; text-shadow: 0 1px 3px rgba(90, 60, 10, 0.5); }
.sl-tile { position: absolute; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: rgba(255, 252, 246, 0.92); border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 2px 6px rgba(93, 64, 55, 0.18); cursor: pointer; transition: left 0.14s ease, top 0.14s ease, box-shadow 0.14s; overflow: hidden; }
.sl-tile:hover { box-shadow: 0 4px 12px rgba(184, 68, 42, 0.3); }
.sl-tile.star { border-color: var(--gold); box-shadow: 0 0 0 2px rgba(224, 161, 58, 0.35), 0 2px 6px rgba(93, 64, 55, 0.18); }
.sl-tile img { width: 78%; height: 78%; object-fit: contain; pointer-events: none; }
.sl-num { position: absolute; right: 4px; bottom: 2px; font-size: 11px; font-weight: 800; color: rgba(120, 80, 50, 0.75); }
.sl-star { position: absolute; left: 4px; top: 2px; font-size: 13px; }

.sl-hint { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; min-height: 18px; }
/* 目标排列预览（整盘还原模式） */
.sl-preview { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.sl-preview-title { font-size: 11px; font-weight: 700; color: var(--muted); }
.sl-preview-grid { display: grid; gap: 2px; background: rgba(120, 84, 50, 0.2); padding: 3px; border-radius: 8px; }
.sl-preview-cell { position: relative; aspect-ratio: 1; border-radius: 4px; background: rgba(255, 252, 246, 0.88); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.sl-preview-cell.gap { background: rgba(120, 84, 50, 0.4); }
.sl-preview-cell img { width: 84%; height: 84%; object-fit: contain; }
.sl-preview-num { position: absolute; right: 1px; bottom: 0; font-size: 7px; font-weight: 800; color: rgba(120, 80, 50, 0.85); }
.sl-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.sl-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.sl-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }

.sl-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.sl-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.sl-result-head { font-size: 18px; }
.sl-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.sl-gold { color: var(--good-strong); font-weight: 800; }
.sl-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.sl-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.sl-spark { position: absolute; font-size: 22px; color: var(--gold); animation: slSpark 1.1s ease-out forwards; }
@keyframes slSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }

.sl-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.sl-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.sl-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.sl-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.sl-info-list { display: flex; flex-direction: column; gap: 8px; }
.sl-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.sl-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.sl-info-rule b { color: var(--primary-strong); }
.sl-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.sl-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
