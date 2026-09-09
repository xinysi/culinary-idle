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
  s2: { label: '2×2 入门', size: 2, gold: 20, desc: '2×2 · 4 块 · +20 币 —— 入门热身' },
  s3: { label: '3×3 轻松', size: 3, gold: 80, desc: '3×3 · 9 块 · +80 币' },
  l3: { label: '3×3 限步', size: 3, gold: 120, maxSteps: 80, desc: '3×3 · 限 80 步完成 · +120 币 —— 超步即失败' },
  s4: { label: '4×4 标准', size: 4, gold: 150, desc: '4×4 · 16 块 · +150 币 —— 经典体验' },
  l4: { label: '4×4 限步', size: 4, gold: 220, maxSteps: 250, desc: '4×4 · 限 250 步完成 · +220 币 —— 超步即失败' },
  s5: { label: '5×5 大师', size: 5, gold: 250, desc: '5×5 · 25 块 · +250 币' },
  l5: { label: '5×5 限步', size: 5, gold: 400, maxSteps: 700, desc: '5×5 · 限 700 步完成 · +400 币 —— 超步即失败' },
  s6: { label: '6×6 宗师', size: 6, gold: 450, desc: '6×6 · 36 块 · +450 币' },
  s7: { label: '7×7 传奇', size: 7, gold: 700, desc: '7×7 · 49 块 · +700 币' },
  s8: { label: '8×8 史诗', size: 8, gold: 1000, desc: '8×8 · 64 块 · +1000 币 —— 终极挑战' },
}
const showInfo = ref(false)
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
  // 取消当日固定：每次重开随机种子（2026-09-07）
  const rng = mulberry32(Math.floor(Math.random() * 0xffffffff) ^ (size * 7919))
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
  // 取消当日固定：每次随机一张素材照片
  puzzlePic.value = ptUrl(PT_PHOTOS[Math.floor(Math.random() * PT_PHOTOS.length)])
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
    // 每次完成得游戏币（按模式难度，2026-09-07 统一游戏币奖励）
    const gold = MODES[mode.value].gold
    player.gainGameCoins(gold)
    ui.pushLog(`🧩 拼图完成！+${gold} 游戏币（累计 ${mg.done} 次）`, 'gain')
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
// 图片拼图：素材照片每次随机（已取消当日固定），左=完整照片、右=同照片切块
const puzzlePic = ref(null)
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
      <button v-for="(m, key, idx) in MODES" :key="key" class="pz-mode" :class="{ on: mode === key }" @click="mode = key; resetDay()">模式{{ idx + 1 }}</button>
      <span class="pz-chip" style="margin-left: auto">🏆 累计完成 <b class="mono">{{ doneDays }}</b> 天</span>
      <span class="pz-chip">✅ 累计 <b class="mono">{{ doneDays }}</b> 次</span>
      <span class="pz-chip">🎯 步数 <b class="mono">{{ moves }}</b></span>
      <button class="pz-info-btn" @click="showInfo = true">📖 模式说明</button>
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
      <button class="pz-reset" @click="resetDay()">🔄 重置本局</button>
    </div>
        <div v-if="won || failed" class="pz-mask">
      <div class="pz-result">
        <div class="pz-result-head"><b>{{ won ? '🎉 复原完成！' : '💦 步数超限！' }}</b></div>
        <div class="pz-result-score"><span v-if="won" class="pz-gold">+{{ MODES[mode].gold }} 游戏币</span><span v-else>本局未完成</span></div>
        <button class="pz-again" @click="resetDay()">🔄 再来一局</button>
      </div>
      <div v-if="won" class="pz-fire">
        <span v-for="i in 20" :key="i" class="pz-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>
    
    <div v-if="showInfo" class="pz-info-mask" @click.self="showInfo = false">
      <div class="pz-info-box">
        <div class="pz-info-head"><b>🧩 美食拼图 · 十种模式说明</b><button class="pz-info-close" @click="showInfo = false">✕</button></div>
        <div class="pz-info-list">
          <div class="pz-info-row pz-info-rule">通用规则：点击与空格相邻的碎片滑入还原 · 图片与初始乱序每次随机（已取消当日固定）· 限步模式超步即失败、不可继续点击</div>
          <div v-for="(m, key) in MODES" :key="key" class="pz-info-row">
            <b class="pz-info-name">{{ m.label }}</b>
            <span class="pz-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.pz-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.pz-topbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; width: 100%; }
.pz-chip {
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.8);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
}
.pz-chip.ok { background: rgba(87, 168, 97, 0.16); border-color: var(--good-strong); color: var(--good-strong); }
.pz-duo { display: flex; gap: 22px; justify-content: center; align-items: flex-start; flex-wrap: wrap; }
.pz-col { display: flex; flex-direction: column; gap: 6px; align-items: center; }
/* 完整图：与切割块同尺寸变形（或放大后居中），左列参考 */
.pz-board-full { display: block !important; position: relative; padding: 0; overflow: hidden; }
.pz-fullimg { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
/* 切割块：背景切片（bgStyle 驱动） */
.pz-cell { padding: 0; }
.pz-cell:not(.empty) { background-color: rgba(255, 251, 244, 0.92); background-size: 100% 100%; }
.pz-mode {
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  border: 1px dashed rgba(150, 110, 70, 0.4);
  background: rgba(255, 252, 246, 0.8);
  color: var(--muted);
}
.pz-mode.on {
  border-style: solid;
  border-color: var(--primary-strong);
  background: rgba(217, 90, 56, 0.14);
  color: var(--primary-strong);
}
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
.pz-keys {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}
.pz-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #5b8fd9, #3b6cb0); border: none; }
.pz-info-btn {
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #72b864, #589c4b);
  border: none;
}
.pz-tip { color: var(--muted); font-size: 12px; }
.pz-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.pz-info-box {
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
.pz-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.pz-info-close {
  cursor: pointer;
  border: none;
  background: rgba(150, 110, 70, 0.15);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  font-weight: 700;
  color: var(--text);
}
.pz-info-list { display: flex; flex-direction: column; gap: 8px; }
.pz-info-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  background: rgba(255, 251, 244, 0.8);
  border: 1px solid rgba(150, 110, 70, 0.2);
  border-radius: 10px;
  padding: 8px 12px;
}
.pz-info-rule {
  border-color: rgba(88, 156, 75, 0.35);
  background: rgba(114, 184, 100, 0.1);
  color: var(--text);
  font-size: 12.5px;
  display: block;
  line-height: 1.7;
}
.pz-info-name {
  flex: 0 0 82px;
  color: var(--primary-strong);
}
.pz-info-desc {
  flex: 1;
  font-size: 12.5px;
  color: var(--muted);
}

/* ── pz 结算弹窗（2026-09-09 统一）── */
.pz-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.pz-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.pz-result-head { font-size: 18px; }
.pz-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.pz-gold { color: var(--good-strong); font-weight: 800; }
.pz-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.pz-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.pz-spark { position: absolute; font-size: 22px; color: var(--gold); animation: pzSpark 1.1s ease-out forwards; }
@keyframes pzSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
</style>
