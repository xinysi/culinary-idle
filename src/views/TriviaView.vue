<script setup>
// 美食讲堂（2026-09-07 v2 改版）：三个类型讲堂同屏（知识/火眼金睛/大厨连线），各自独立答题；≥10/12 得徽章
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
  { q: '小麦种子在杂货铺卖多少金币？（种子售价=value×0.5）', ask: () => Math.round((getItem('wheat')?.value ?? 10) * 0.5), opts: [5, 10, 20, 30] },
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

function buildBox(defs, make) {
  return defs.sort(() => Math.random() - 0.5).slice(0, 4).map(make)
}
function qBox() {
  return buildBox([...QPOOL], (def) => {
    const correct = def.ask()
    const opts = def.opts.includes(correct) ? [...def.opts] : [correct, ...def.opts].slice(0, 4)
    return { q: def.q, correct, opts: [...opts].sort(() => Math.random() - 0.5), picked: null }
  })
}
function cmpBox() {
  return buildBox([...CMP], ([ida, idb, cmp, label]) => {
    const a = getItem(ida)
    const b = getItem(idb)
    const winner = cmp(a, b) >= 0 ? ida : idb
    return { q: `「${a.name}」与「${b.name}」，谁${label}？`, correct: winner, opts: [ida, idb].sort(() => Math.random() - 0.5), picked: null, names: { a: a.name, b: b.name } }
  })
}
function linkBox() {
  return buildBox([...LINK], ([id, q, answer]) => {
    const others = SKILLS_ALL.filter((x) => x !== answer).sort(() => Math.random() - 0.5).slice(0, 3)
    return { q, correct: answer, opts: [answer, ...others].sort(() => Math.random() - 0.5), picked: null }
  })
}

const boxes = ref({
  k: { title: '📖 美食知识', items: qBox(), idx: 0 },
  c: { title: '⚖️ 火眼金睛', items: cmpBox(), idx: 0 },
  l: { title: '🔗 大厨连线', items: linkBox(), idx: 0 },
})
const doneAll = computed(() => Object.values(boxes.value).every((b) => b.items.every((it) => it.picked !== null)))
const correctAll = computed(() => Object.values(boxes.value).flat().filter((x) => x.picked === x.correct).length)

function weekKey() {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const week = Math.floor((d.getTime() - Date.UTC(now.getFullYear(), 0, 1)) / 604800000)
  return `${now.getFullYear()}-W${week}`
}
const mg = computed(() => player.minigames.trivia)
const weekDone = computed(() => mg.value?.week === weekKey() && mg.value?.answered > 0)
const lastCorrect = ref(0)

function pickBox(key, opt) {
  const box = boxes.value[key]
  const cur = box.items[box.idx]
  if (!cur || cur.picked !== null) return
  cur.picked = opt
  const m = mg.value
  m.answered = (m.answered ?? 0) + 1
  if (opt === cur.correct) m.correct = (m.correct ?? 0) + 1
  // 本框答完自动推进/完成
  const next = box.items[box.idx + 1]
  if (next) box.idx++
  if (doneAll.value) settle()
}
function nextBox(key) {
  const box = boxes.value[key]
  if (box.idx < box.items.length - 1 && box.items[box.idx].picked !== null) box.idx++
}
function settle() {
  lastCorrect.value = correctAll.value
  const m = mg.value
  if (!m.badges) m.badges = 0
  if (correctAll.value >= 10) {
    m.badges = (m.badges ?? 0) + 1
    player.gainGold(100)
    ui.pushLog(`📚 美食讲堂：本周答对 ${correctAll.value}/12！徽章 +1（共 ${m.badges} 枚）+100 金币`, 'gain')
  }
  m.week = weekKey()
}
function resetWeek() {
  const m = mg.value
  m.week = weekKey()
  m.answered = 0
  m.correct = 0
  boxes.value = {
    k: { title: '📖 美食知识', items: qBox(), idx: 0 },
    c: { title: '⚖️ 火眼金睛', items: cmpBox(), idx: 0 },
    l: { title: '🔗 大厨连线', items: linkBox(), idx: 0 },
  }
}
const EXCHANGES = [
  { id: 'biscuit', label: '🎁 能量饼干 ×1', cost: 1 },
  { id: 'gold600', label: '💰 金币 600', cost: 1 },
  { id: 'gold1500', label: '💰 金币 1500', cost: 2 },
]
function exchange(item) {
  const m = mg.value
  if ((m.badges ?? 0) < item.cost) return
  m.badges -= item.cost
  if (item.id === 'biscuit') player.gainItem('energyBiscuit', 1)
  else player.gainGold(item.id === 'gold600' ? 600 : 1500)
  ui.pushLog(`📚 讲堂兑换：${item.label}（剩余徽章 ${m.badges}）`, 'gain')
}
function boxProgress(b) {
  let done = 0
  b.items.forEach((it) => { if (it.picked !== null) done++ })
  const right = b.items.filter((it) => it.picked === it.correct).length
  return { done, right }
}
</script>

<template>
  <div class="tv-page">
    <div class="tv-topbar">
      <span class="tv-chip" :class="{ ok: weekDone }">{{ weekDone ? '✅ 本周已答' : '📅 本周未开始' }}</span>
      <span class="tv-chip">🎯 总对 <b class="mono">{{ correctAll }}</b>/12</span>
      <span class="tv-chip" style="margin-left: auto"><b class="mono">{{ mg.badges ?? 0 }}</b> 枚徽章</span>
      <button class="tv-chip tv-reset" @click="resetWeek">🔄 重新开始本周</button>
    </div>

    <!-- 三个讲堂同屏 -->
    <div class="tv-grid">
      <div v-for="(box, key) in boxes" :key="key" class="tv-box" :class="'tv-' + key">
        <div class="tv-box-head">
          <span class="tv-box-title">{{ box.title }}</span>
          <span class="mono dim">{{ boxProgress(box).right }}/{{ boxProgress(box).done }}</span>
        </div>
        <template v-if="box.idx < box.items.length">
          <div class="tv-q">{{ box.items[box.idx]?.q }}</div>
          <div class="tv-opts">
            <button
              v-for="o in box.items[box.idx]?.opts"
              :key="o"
              class="tv-opt"
              :class="{
                'tv-right': box.items[box.idx]?.picked != null && o === box.items[box.idx]?.correct,
                'tv-wrong': box.items[box.idx]?.picked === o && o !== box.items[box.idx]?.correct,
              }"
              :disabled="box.items[box.idx]?.picked != null"
              @click="pickBox(key, o)"
            >{{ o === box.items[box.idx]?.opts[0] && box.items[box.idx]?.names ? box.items[box.idx].names.a : o === box.items[box.idx]?.opts[1] && box.items[box.idx]?.names ? box.items[box.idx].names.b : o }}</button>
          </div>
          <button
            v-if="box.items[box.idx]?.picked != null && box.idx < box.items.length - 1"
            class="tv-next"
            @click="nextBox(key)"
          >下一题 →</button>
        </template>
        <div v-else class="tv-flag">✅ 本类完成</div>
      </div>
    </div>

    <div v-if="doneAll" class="tv-result" :class="{ ok: correctAll >= 10 }">
      {{ correctAll >= 10 ? `🏅 通过！徽章 +1（共 ${mg.badges} 枚）` : `本周 ${correctAll}/12 —— 下周再来！` }}
    </div>

    <div class="tv-exchange">
      <span class="tv-exchange-title">🏅 徽章兑换</span>
      <button v-for="it in EXCHANGES" :key="it.id" class="tv-ex" :disabled="(mg.badges ?? 0) < it.cost" @click="exchange(it)">
        {{ it.label }}<span class="tv-ex-cost">{{ it.cost }} 徽章</span>
      </button>
    </div>
    <div class="tv-rules">12 题 = 4 知识 + 4 对比 + 4 连线 · 答对 ≥10 得徽章 +1 + 100 金</div>
  </div>
</template>
<style scoped>
.tv-page { display: flex; flex-direction: column; gap: 12px; }
.tv-topbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tv-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.tv-chip.ok { background: rgba(87, 168, 97, 0.16); border-color: var(--good-strong); color: var(--good-strong); }
.tv-reset { cursor: pointer; border-style: dashed; }
.tv-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; }
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
.tv-rules { color: var(--muted); font-size: 12px; text-align: center; }
</style>
