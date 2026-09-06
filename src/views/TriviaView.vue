<script setup>
// 美食讲堂（2026-09-06 顶部第三页）：每周 10 道食之契约竞答，答对 ≥8 题记一枚「讲堂徽章」
// 题库动态化：从 ITEMS 实时取数值，保证与游戏数据永远同步（不改固定数据）
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem, ITEMS } from '../game/data/items.js'


const player = usePlayerStore()
const ui = useUiStore()

const QPOOL = [
  { q: '烤土豆（T1）的对决回血是多少？', ask: () => getItem('roastPotato')?.heal ?? 14, opts: [6, 14, 20, 30] },
  { q: '「铜刀」需要什么等级？', ask: () => getItem('copperKnife')?.tier ?? 1, opts: [1, 5, 10, 20] },
  { q: '「灵果」的采集等级是？', ask: () => getItem('spiritFruit')?.tier ?? 90, opts: [60, 70, 80, 90] },
  { q: '「松露」的档位是？', ask: () => getItem('truffle')?.tier ?? 80, opts: [40, 60, 80, 99] },
  { q: '小麦种子在杂货铺卖多少金币？（种子售价=value×0.5）', ask: () => Math.round((getItem('wheat')?.value ?? 10) * 0.5), opts: [5, 10, 20, 30] },
  { q: '「米酒」的档位 T 是多少？', ask: () => getItem('riceWine')?.tier ?? 20, opts: [3, 10, 20, 40] },
  { q: '「苹果」采集一次获得几颗？', ask: () => 1, opts: [1, 2, 3, 5] },
  { q: '品鉴力达到多少可以解锁「无尽挑战塔」？', ask: () => 99, opts: [50, 75, 90, 99] },
  { q: '对决中「刀工」克制「？」', ask: () => '摆盘', opts: ['摆盘', '调味', '刀工', '品鉴'] },
  { q: '竞技场镜像对手多久刷新一次？', ask: () => '5 分钟', opts: ['3 分钟', '5 分钟', '10 分钟', '30 分钟'] },
  { q: '「觅珍·厨具池」保底多少抽必出稀有以上？', ask: () => 10, opts: [5, 8, 10, 15] },
  { q: '制作类技能排队自动制作每几秒 1 份？', ask: () => 3, opts: [1, 3, 5, 10] },
  { q: '「能量饼干」离线时长上限提升多少？', ask: () => '4 小时', opts: ['2 小时', '4 小时', '6 小时', '12 小时'] },
  { q: '钓鱼时有概率钓到稀有「金龙鱼」，概率是？', ask: () => '0.5%', opts: ['0.1%', '0.5%', '1%', '5%'] },
  { q: '冰箱（冷库）初始几格？', ask: () => 5, opts: [3, 5, 10, 20] },
]

function weekKey() {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const week = Math.floor((d.getTime() - Date.UTC(now.getFullYear(), 0, 1)) / 604800000) // 每年第几周
  return `${now.getFullYear()}-W${week}`
}

async function newQuiz() {
  const mg = player.minigames.trivia
  const wk = weekKey()
  if (mg.week === wk && mg.answered > 0) return // 当周已答，显示结果
  mg.week = wk
  mg.answered = 0
  mg.correct = 0
  // 每周打乱 10 题
  const shuffled = [...QPOOL].sort(() => Math.random() - 0.5).slice(0, 10)
  quiz.value = shuffled.map((def) => {
    const correct = def.ask()
    const opts = def.opts.includes(correct) ? [...def.opts] : [correct, ...def.opts].slice(0, 4)
    const shuffledOpts = [...opts].sort(() => Math.random() - 0.5)
    return { q: def.q, correct, opts: shuffledOpts, picked: null }
  })
}
const quiz = ref([])
const index = ref(0)
const finished = computed(() => quiz.value.length > 0 && quiz.value.every((x) => x.picked !== null))
const correctCount = computed(() => quiz.value.filter((x) => x.picked === x.correct).length)
const mg = computed(() => player.minigames.trivia)

function pick(opt) {
  const qz = quiz.value[index.value]
  if (!qz || qz.picked !== null) return
  qz.picked = opt
  player.minigames.trivia.answered++
  if (opt === qz.correct) player.minigames.trivia.correct++
  if (finished.value) settle()
}
function next() {
  if (index.value < quiz.value.length - 1) index.value++
}
const lastCorrect = ref(0)
function settle() {
  lastCorrect.value = correctCount.value
  const m = player.minigames.trivia
  if (correctCount.value >= 8) {
    m.badges = (m.badges ?? 0) + 1
    player.gainGold(100)
    ui.pushLog(`📚 美食讲堂：本周答对 ${correctCount.value} 题！徽章 +1（共 ${m.badges} 枚）+100 金币`, 'gain')
  }
}
const pct = computed(() => quiz.value.length ? Math.round((correctCount.value / 10) * 100) : 0)

// 徽章兑换（2026-09-06）：1 徽章 → 能量饼干 ×1 或 金币 600；2 徽章 → 金币 1500
const EXCHANGES = [
  { id: 'biscuit', label: '🎁 能量饼干 ×1', cost: 1 },
  { id: 'gold600', label: '💰 金币 600', cost: 1 },
  { id: 'gold1500', label: '💰 金币 1500', cost: 2 },
]
function exchange(item) {
  const m = player.minigames.trivia
  if ((m.badges ?? 0) < item.cost) return
  m.badges -= item.cost
  if (item.id === 'biscuit') player.gainItem('energyBiscuit', 1)
  else player.gainGold(item.id === 'gold600' ? 600 : 1500)
  ui.pushLog(`📚 讲堂兑换：${item.label}（剩余徽章 ${m.badges}）`, 'gain')
}
</script>

<template>
  <div class="tz-page">
    <div class="tz-progress-row">
      <span class="tz-week">📅 本周 {{ mg.week === weekKey() && mg.answered > 0 ? '已答' : '未开始' }}</span>
      <div class="tz-bar"><div class="tz-bar-fill" :style="{ width: (quiz.length ? Math.min(100, ((index + (quiz[index]?.picked != null ? 1 : 0)) / 10) * 100) : 0) + '%' }"></div></div>
      <span class="tz-score">🎯 {{ correctCount }}/10</span>
      <span class="tz-badges"><b class="mono">{{ mg.badges ?? 0 }}</b> 枚徽章</span>
    </div>

    <div v-if="quiz.length" class="tz-quiz">
      <div class="tz-q">{{ quiz[index]?.q }}</div>
      <div class="tz-opts">
        <button
          v-for="o in quiz[index]?.opts"
          :key="o"
          class="tz-opt"
          :class="{ 'tz-opt-right': quiz[index]?.picked != null && o === quiz[index]?.correct, 'tz-opt-wrong': quiz[index]?.picked === o && o !== quiz[index]?.correct }"
          :disabled="quiz[index]?.picked != null"
          @click="pick(o)"
        >{{ o }}</button>
      </div>
      <button v-if="quiz[index]?.picked != null && !finished" class="tz-next" @click="next">下一题 →</button>
      <div v-if="finished" class="tz-result" :class="{ ok: correctCount >= 8 }">
        {{ correctCount >= 8 ? `🏅 通过！徽章 +1（共 ${mg.badges} 枚）` : `本周 ${correctCount}/10 —— 下周再来！` }}
      </div>
    </div>

    <div v-else class="tz-start">
      <template v-if="mg.week === weekKey() && mg.answered > 0">
        <div class="tz-result" :class="{ ok: lastCorrect >= 8 }">本周成绩 {{ lastCorrect }}/10 · 徽章 {{ mg.badges }} 枚</div>
      </template>
      <button class="tz-big" :disabled="mg.week === weekKey() && mg.answered > 0" @click="newQuiz()">
        {{ mg.week === weekKey() && mg.answered > 0 ? '✅ 本周已答完' : '📚 开始本周竞答（10 题）' }}
      </button>
      <div class="tz-rules">
        <span>📏 每周 10 题</span><span>🏅 答对 ≥8 题 → 徽章 +1 + 100 金</span><span>🔄 徽章可兑换饼干/金币</span>
      </div>
    </div>

    <div class="tz-exchange">
      <span class="tz-exchange-title">🏅 徽章兑换</span>
      <button v-for="it in EXCHANGES" :key="it.id" class="tz-ex" :disabled="(mg.badges ?? 0) < it.cost" @click="exchange(it)">
        {{ it.label }}<span class="tz-ex-cost">{{ it.cost }} 徽章</span>
      </button>
    </div>
  </div>
</template>
<style scoped>
.tz-page { display: flex; flex-direction: column; gap: 14px; }
.tz-progress-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.tz-week { font-size: 12px; font-weight: 700; color: var(--muted); }
.tz-bar { flex: 1; min-width: 120px; height: 10px; background: rgba(150, 110, 70, 0.2); border-radius: 999px; overflow: hidden; }
.tz-bar-fill { height: 100%; background: linear-gradient(90deg, #eab04a, #f2c35d); border-radius: 999px; transition: width 0.3s ease; }
.tz-score { font-size: 13px; font-weight: 800; }
.tz-badges { font-size: 12px; padding: 4px 12px; border-radius: 999px; background: rgba(217, 138, 43, 0.15); color: var(--warn-strong); font-weight: 700; }
.tz-quiz {
  background: rgba(255, 252, 246, 0.85); border: 1px solid var(--border); border-radius: 18px;
  padding: 22px; display: flex; flex-direction: column; gap: 16px;
}
.tz-q { font-size: 19px; font-weight: 800; line-height: 1.5; }
.tz-opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.tz-opt {
  padding: 14px 12px; font-size: 15px; font-weight: 700; border-radius: 12px; cursor: pointer;
  background: rgba(255, 251, 244, 0.9); border: 1px solid rgba(150, 110, 70, 0.35); color: var(--text);
}
.tz-opt:hover:not(:disabled) { border-color: var(--primary-strong); }
.tz-opt-right { background: rgba(87, 168, 97, 0.18); border-color: var(--good-strong); color: var(--good-strong); }
.tz-opt-wrong { background: rgba(217, 75, 63, 0.16); border-color: var(--bad-strong); color: var(--bad-strong); }
.tz-next { align-self: flex-end; padding: 8px 18px; border: none; border-radius: 999px; color: #fff; font-weight: 700; cursor: pointer; background: linear-gradient(135deg, #d95a38, #b8442a); }
.tz-result { text-align: center; padding: 12px; border-radius: 12px; font-weight: 800; background: rgba(217, 75, 63, 0.12); color: var(--bad-strong); }
.tz-result.ok { background: rgba(87, 168, 97, 0.15); color: var(--good-strong); }
.tz-start { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 10px 0; }
.tz-rules { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; color: var(--muted); font-size: 13px; }
.tz-big {
  padding: 14px 34px; font-size: 16px; font-weight: 800; color: #fff; border: none; border-radius: 999px; cursor: pointer;
  background: linear-gradient(135deg, #eab04a, #d98a2b); box-shadow: 0 4px 14px rgba(217, 138, 43, 0.4);
}
.tz-big:disabled { filter: grayscale(0.6); cursor: not-allowed; }
.tz-exchange { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tz-exchange-title { font-size: 13px; font-weight: 800; color: var(--primary-strong); }
.tz-ex {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 999px; cursor: pointer;
  background: rgba(255, 251, 244, 0.85); border: 1px solid rgba(150, 110, 70, 0.35); font-weight: 700; font-size: 13px;
}
.tz-ex:disabled { opacity: 0.5; cursor: not-allowed; }
.tz-ex-cost { font-size: 11px; color: var(--muted); font-weight: 600; }
</style>
