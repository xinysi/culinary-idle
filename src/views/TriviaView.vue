<script setup>
// 美食讲堂（2026-09-07 v3 改版）：十种模式分类（知识/对比/连线 × 规模）· 单面板流式答题 · 顶栏状态胶囊 · 模式说明弹窗
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem, ITEMS } from '../game/data/items.js'

const player = usePlayerStore()
const ui = useUiStore()

const QPOOL = [
  { q: '烤土豆（T1）的对决回血是多少？', ask: () => getItem('roastPotato')?.heal ?? 14, opts: [6, 14, 20, 30] },
  { q: '「铜刀」需要什么等级？', ask: () => getItem('copperKnife')?.tier ?? 1, opts: [1, 5, 10, 20] },
  { q: '「灵果」的采集等级是？', ask: () => getItem('spiritFruit')?.tier ?? 90, opts: [60, 70, 80, 90] },
  { q: '小麦种子在杂货铺卖多少游戏币？（种子售价=value×0.5）', ask: () => Math.round((getItem('wheat')?.value ?? 10) * 0.5), opts: [5, 10, 20, 30] },
  { q: '「米酒」的档位 T 是多少？', ask: () => getItem('riceWine')?.tier ?? 20, opts: [3, 10, 20, 40] },
  { q: '品鉴力达到多少可以解锁「无尽挑战塔」？', ask: () => 99, opts: [50, 75, 90, 99] },
  { q: '对决中「刀工」克制「？」', ask: () => '摆盘', opts: ['摆盘', '调味', '刀工', '品鉴'] },
  { q: '竞技场镜像对手多久刷新一次？', ask: () => '5 分钟', opts: ['3 分钟', '5 分钟', '10 分钟', '30 分钟'] },
  { q: '「觅珍·厨具池」保底多少抽必出稀有以上？', ask: () => 10, opts: [5, 8, 10, 15] },
  { q: '制作类技能排队自动制作每几秒 1 份？', ask: () => 3, opts: [1, 3, 5, 10] },
  { q: '「能量饼干」离线时长上限提升多少？', ask: () => '4 小时', opts: ['2 小时', '4 小时', '6 小时', '12 小时'] },
  { q: '钓鱼时有概率钓到稀有「金龙鱼」，概率是？', ask: () => '0.5%', opts: ['0.1%', '0.5%', '1%', '5%'] },
  { q: '冰箱（冷库）初始几格？', ask: () => 5, opts: [3, 5, 10, 20] },
  { q: '「觅珍·限时池」5 抽保底是什么？', ask: () => '稀有及以上', opts: ['精良', '稀有及以上', '史诗', '传说'] },
]
const CMP = [
  ['roastPotato', 'riceWine', (a, b) => (a.heal ?? 0) - (b.heal ?? 0), '对决回血更高'],
  ['ironKnife', 'copperKnife', (a, b) => (a.stats?.attack ?? 0) - (b.stats?.attack ?? 0), '攻击更高'],
  ['grouperFeast', 'roastPotato', (a, b) => (a.heal ?? 0) - (b.heal ?? 0), '对决回血更高'],
  ['herbalTea', 'mangoWine', (a, b) => (a.flavorEnergy ?? 0) - (b.flavorEnergy ?? 0), '调味能量更高'],
  ['godFeast', 'roastPotato', (a, b) => (a.heal ?? 0) - (b.heal ?? 0), '对决回血更高'],
  ['goldKnife', 'ironKnife', (a, b) => (a.stats?.attack ?? 0) - (b.stats?.attack ?? 0), '攻击更高'],
]
const LINK = [
  ['roastPotato', '马铃薯的烹饪风味名菜，需要哪个技能？', '烹饪'],
  ['steelKnife', '铁器锻打的装备，需要哪个技能？', '厨具锻造'],
  ['riceWine', '谷物酿成的酒，需要哪个技能？', '调酒'],
  ['pickledCabbage', '乳酸发酵的泡菜，需要哪个技能？', '腌制'],
  ['pumpkinPie', '香酥甜点，需要哪个技能？', '烘焙'],
  ['spiritBrew', '食灵一族的佳酿，需要哪类技能？', '食灵召唤'],
]
const SKILLS_ALL = ['采摘', '垂钓', '狩猎', '挖掘', '农耕', '烹饪', '烘焙', '腌制', '调酒', '厨具锻造', '食材保鲜', '美食探索', '食灵召唤']

const mode = ref('all12')
const MODES = {
  k6: { label: '知识·入门', spec: { k: 6, c: 0, l: 0 }, pass: 5, gold: 50, desc: '6 知识题 · 答对 ≥5 得徽章 +50 币' },
  k10: { label: '知识·标准', spec: { k: 10, c: 0, l: 0 }, pass: 8, gold: 90, desc: '10 知识题 · ≥8 得徽章 +90 币' },
  k14: { label: '知识·大师', spec: { k: 14, c: 0, l: 0 }, pass: 12, gold: 150, desc: '14 知识题（全库）· ≥12 得徽章 +150 币' },
  c3: { label: '对比·试炼', spec: { k: 0, c: 3, l: 0 }, pass: 3, gold: 40, desc: '3 对比题 · 全对 +40 币' },
  c6: { label: '对比·挑战', spec: { k: 0, c: 6, l: 0 }, pass: 5, gold: 80, desc: '6 对比题 · ≥5 +80 币' },
  l3: { label: '连线·试炼', spec: { k: 0, c: 0, l: 3 }, pass: 3, gold: 40, desc: '3 连线题 · 全对 +40 币' },
  l6: { label: '连线·挑战', spec: { k: 0, c: 0, l: 6 }, pass: 5, gold: 80, desc: '6 连线题 · ≥5 +80 币' },
  all12: { label: '综合·标准', spec: { k: 4, c: 4, l: 4 }, pass: 10, gold: 100, desc: '4 知识+4 对比+4 连线 =12 题 · ≥10 得徽章 +100 币' },
  all15: { label: '综合·进阶', spec: { k: 5, c: 5, l: 5 }, pass: 13, gold: 160, desc: '5+5+5 =15 题 · ≥13 得徽章 +160 币' },
  all18: { label: '综合·大师', spec: { k: 6, c: 6, l: 6 }, pass: 16, gold: 240, desc: '6+6+6 =18 题（对比/连线全库）· ≥16 得徽章 +240 币' },
}
const showInfo = ref(false)

function pickN(pool, n) {
  return [...pool].sort(() => Math.random() - 0.5).slice(0, n)
}
function makeQ(def) {
  const correct = def.ask()
  const opts = def.opts.includes(correct) ? [...def.opts] : [correct, ...def.opts].slice(0, 4)
  return { q: def.q, correct, opts: opts.map((v) => ({ v, label: String(v) })), picked: null }
}
function makeCmp([ida, idb, cmp, label]) {
  const a = getItem(ida)
  const b = getItem(idb)
  const winner = cmp(a, b) >= 0 ? ida : idb
  return { q: `「${a.name}」与「${b.name}」，谁${label}？`, correct: winner, opts: [{ v: ida, label: a.name }, { v: idb, label: b.name }].sort(() => Math.random() - 0.5), picked: null }
}
function makeLink([id, q, answer]) {
  const others = SKILLS_ALL.filter((x) => x !== answer).sort(() => Math.random() - 0.5).slice(0, 3)
  return { q, correct: answer, opts: [answer, ...others].sort(() => Math.random() - 0.5).map((v) => ({ v, label: v })), picked: null }
}
function buildQuestions(spec) {
  const list = [
    ...pickN(QPOOL, spec.k).map(makeQ),
    ...pickN(CMP, spec.c).map(makeCmp),
    ...pickN(LINK, spec.l).map(makeLink),
  ]
  return list.sort(() => Math.random() - 0.5)
}

const qlist = ref([])
const idx = ref(0)
const cur = computed(() => qlist.value[idx.value] ?? null)
const totalQ = computed(() => qlist.value.length)
const answeredN = computed(() => qlist.value.filter((q) => q.picked !== null).length)
const correctAll = computed(() => qlist.value.filter((q) => q.picked === q.correct).length)
const doneAll = computed(() => qlist.value.length > 0 && answeredN.value === qlist.value.length)

function resetRound() {
  qlist.value = buildQuestions(MODES[mode.value].spec)
  idx.value = 0
}
function resetWeek() {
  const m = mg.value
  m.week = weekKey()
  m.answered = 0
  m.correct = 0
  resetRound()
}
function pickOpt(opt) {
  const q = cur.value
  if (!q || q.picked !== null) return
  q.picked = opt
  const m = mg.value
  m.answered = (m.answered ?? 0) + 1
  if (opt === q.correct) m.correct = (m.correct ?? 0) + 1
  if (doneAll.value) settle()
}
function nextQ() {
  if (idx.value < qlist.value.length - 1 && cur.value.picked !== null) idx.value++
}
function settle() {
  const m = MODES[mode.value]
  const right = correctAll.value
  const mg2 = mg.value
  if (right >= m.pass) {
    mg2.badges = (mg2.badges ?? 0) + 1
    player.gainGameCoins(m.gold)
    ui.pushLog(`📚 美食讲堂：${m.label} 答对 ${right}/${totalQ.value}！徽章 +1（共 ${mg2.badges} 枚）+${m.gold} 游戏币`, 'gain')
  }
  mg2.week = weekKey()
}

function weekKey() {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const week = Math.floor((d.getTime() - Date.UTC(now.getFullYear(), 0, 1)) / 604800000)
  return `${now.getFullYear()}-W${week}`
}
const mg = computed(() => player.minigames.trivia)
const EXCHANGES = [
  { id: 'gold600', label: '游戏币 200', cost: 1 },
  { id: 'gold1500', label: '游戏币 450', cost: 2 },
  { id: 'gold3000', label: '游戏币 800', cost: 3 },
]
function exchange(item) {
  const m = mg.value
  if ((m.badges ?? 0) < item.cost) return
  m.badges -= item.cost
  player.gainGameCoins(item.id === 'gold600' ? 200 : item.id === 'gold1500' ? 450 : 800)
  ui.pushLog(`📚 讲堂兑换：${item.label}（剩余徽章 ${m.badges}）`, 'gain')
}
function switchMode(k) {
  mode.value = k
  resetRound()
}
resetRound()
</script>

<template>
  <div class="tv-page">
    <div class="tv-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="tv-mode" :class="{ on: mode === key }" @click="switchMode(key)">{{ m.label }}</button>
      <span class="tv-chip" style="margin-left: auto"><b class="mono">{{ mg.badges ?? 0 }}</b> 枚徽章</span>
      <button class="tv-chip tv-reset" @click="resetWeek">🔄 重新开始本周</button>
      <span class="tv-chip">🎯 总对 <b class="mono">{{ correctAll }}</b>/{{ totalQ }}</span>
      <button class="tv-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <!-- 单面板流式答题 -->
    <div class="tv-box">
      <div class="tv-box-head">
        <span class="tv-box-title">{{ MODES[mode].label }}（{{ answeredN }}/{{ totalQ }}）</span>
        <span class="mono dim"> ✅ {{ correctAll }} · 达标 {{ MODES[mode].pass }}</span>
      </div>
      <template v-if="cur">
        <div class="tv-q">{{ cur.q }}</div>
        <div class="tv-opts">
          <button
            v-for="o in cur.opts"
            :key="o.v"
            class="tv-opt"
            :class="{
              'tv-right': cur.picked != null && o.v === cur.correct,
              'tv-wrong': cur.picked === o.v && o.v !== cur.correct,
            }"
            :disabled="cur.picked != null"
            @click="pickOpt(o.v)"
          >{{ o.label }}</button>
        </div>
        <button v-if="cur.picked != null && idx < qlist.length - 1" class="tv-next" @click="nextQ">下一题 →</button>
      </template>
      <div v-else class="tv-flag">✅ 本模式完成</div>
    </div>

    <div v-if="doneAll" class="tv-result" :class="{ ok: correctAll >= MODES[mode].pass }">
      {{ correctAll >= MODES[mode].pass ? `🏅 通过！徽章 +1（共 ${mg.badges} 枚）+${MODES[mode].gold} 金` : `${correctAll}/${totalQ} —— 未达标，重新开始本周再来！` }}
    </div>

    <div class="tv-exchange">
      <span class="tv-exchange-title">🏅 徽章兑换</span>
      <button v-for="it in EXCHANGES" :key="it.id" class="tv-ex" :disabled="(mg.badges ?? 0) < it.cost" @click="exchange(it)">
        <img class="coin-ico" src="/images/icon-coin.png" alt="">{{ it.label }}<span class="tv-ex-cost">{{ it.cost }} 徽章</span>
      </button>
    </div>

    <div v-if="showInfo" class="tv-info-mask" @click.self="showInfo = false">
      <div class="tv-info-box">
        <div class="tv-info-head"><b>📚 美食讲堂 · 十种模式说明</b><button class="tv-info-close" @click="showInfo = false">✕</button></div>
        <div class="tv-info-list">
          <div class="tv-info-row tv-info-rule">通用规则：完成模式全部题目后判定 · 达标得徽章+游戏币（可与兑换行换游戏币）· 徽章与本周记录按周重置</div>
          <div v-for="(m, key) in MODES" :key="key" class="tv-info-row">
            <b class="tv-info-name">{{ m.label }}</b>
            <span class="tv-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.tv-page { display: flex; flex-direction: column; gap: 12px; }
.tv-topbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tv-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.tv-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.tv-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.tv-chip.ok { background: rgba(87, 168, 97, 0.16); border-color: var(--good-strong); color: var(--good-strong); }
.tv-reset { cursor: pointer; border-style: dashed; }
.tv-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.tv-box { background: rgba(255, 252, 246, 0.85); border: 1px solid var(--border); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.tv-box-head { display: flex; align-items: center; justify-content: space-between; }
.tv-box-title { font-weight: 800; font-size: 14px; }
.tv-q { font-size: 14px; font-weight: 700; line-height: 1.5; min-height: 40px; }
.tv-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.tv-opt { padding: 8px; font-size: 12px; font-weight: 700; border-radius: 8px; cursor: pointer; background: rgba(255, 251, 244, 0.9); border: 1px solid rgba(150, 110, 70, 0.3); color: var(--text); }
.tv-opt:disabled { cursor: default; }
.tv-opt.tv-right { background: rgba(87, 168, 97, 0.18); border-color: var(--good-strong); color: var(--good-strong); }
.tv-opt.tv-wrong { background: rgba(217, 75, 63, 0.16); border-color: var(--bad-strong); color: var(--bad-strong); }
.tv-next { align-self: flex-end; padding: 5px 12px; border: none; border-radius: 999px; color: #fff; font-weight: 700; cursor: pointer; background: linear-gradient(135deg, #d95a38, #b8442a); font-size: 12px; }
.tv-flag { text-align: center; color: var(--good-strong); font-weight: 800; padding: 20px 0; }
.tv-result { text-align: center; padding: 12px; border-radius: 12px; font-weight: 800; background: rgba(217, 75, 63, 0.12); color: var(--bad-strong); }
.tv-result.ok { background: rgba(87, 168, 97, 0.15); color: var(--good-strong); }
.tv-exchange { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tv-exchange-title { font-size: 13px; font-weight: 800; color: var(--primary-strong); }
.tv-ex { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; cursor: pointer; background: rgba(255, 251, 244, 0.85); border: 1px solid rgba(150, 110, 70, 0.35); font-weight: 700; font-size: 13px; }
.tv-ex:disabled { opacity: 0.5; cursor: not-allowed; }
.tv-ex-cost { font-size: 11px; color: var(--muted); }
.tv-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.tv-info-box { width: min(560px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.tv-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.tv-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.tv-info-list { display: flex; flex-direction: column; gap: 8px; }
.tv-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.tv-info-rule { border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; }
.tv-info-name { flex: 0 0 104px; color: var(--primary-strong); }
.tv-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
