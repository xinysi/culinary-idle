<script setup>
// 同业竞争榜（2026-09-10 新增）— 月度榜单：5 家 NPC 餐厅 + 你，比一个综合经营分。
// 纯读取层：玩家分只由既有数据推导，对手是本地生成的 NPC（非铁律敌人），只给正向激励。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { RIVAL_PROMO_COST, RIVAL_PROMO_BONUS, RIVAL_MONTH_GROWTH, RIVAL_BOARD_SIZE } from '../game/data/rivals.js'
import { getItem } from '../game/data/items.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()

const board = computed(() => player.rivalBoard())
// 含自己在内的完整榜单（按分数降序）
const rows = computed(() => {
  const list = [
    { id: 'me', name: player.name, icon: '🏮', style: '你的餐厅', score: board.value.score, me: true },
    ...board.value.rivals.map((r) => ({ ...r, me: false })),
  ]
  list.sort((a, b) => b.score - a.score)
  return list.map((r, i) => ({ ...r, rank: i + 1 }))
})
const top = computed(() => rows.value.find((r) => r.me))
const nextUp = computed(() => {
  // 紧跟在你前面的那家（追赶目标）
  const i = rows.value.findIndex((r) => r.me)
  return i > 0 ? rows.value[i - 1] : null
})
const maxScore = computed(() => Math.max(1, ...rows.value.map((r) => r.score)))

// 分数构成（让玩家知道怎么涨分）
const factors = computed(() => {
  const p = player
  const menuTiers = (p.restaurant?.menu ?? []).reduce((a, id) => a + (getItem(id)?.tier ?? 0), 0)
  return [
    { name: '米其林评分', raw: p.michelin?.score ?? 0, mult: 1 },
    { name: '菜单档次和', raw: menuTiers, mult: 60 },
    { name: '装饰件数', raw: (p.restaurant?.decor ?? []).length, mult: 20 },
    { name: '分店数', raw: Object.keys(p.branches ?? {}).length, mult: 120 },
    { name: '常客招待', raw: Object.values(p.regulars ?? {}).reduce((a, r) => a + (r?.serves ?? 0), 0), mult: 12 },
    { name: '累计订单', raw: p.stats?.ordersServed ?? 0, mult: 2 },
    { name: '累计餐厅收入/5000', raw: Math.floor((p.stats?.restaurantTotal ?? 0) / 5000), mult: 1 },
  ].map((f) => ({ ...f, pts: f.raw * f.mult }))
})

function promote() {
  const r = player.rivalPromote()
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  ui.pushLog(`📣 本月推广已投放（分数 +${RIVAL_PROMO_BONUS}%）`, 'info')
}
function claim() {
  const r = player.rivalClaim()
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  const items = Object.entries(r.reward.items ?? {}).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、')
  ui.pushLog(`🏪 本月同业榜第 ${r.rank} 名（${r.reward.label}）：+${r.reward.gold.toLocaleString()} 金币${items ? `、${items}` : ''}`, 'levelup')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🏪 同业竞争榜</h2>
        <p class="dim">
          每月一张榜单：<b>{{ RIVAL_BOARD_SIZE - 1 }} 家同行</b>与你比一个综合<b>经营分</b>（米其林评分 + 菜单档次 + 装饰 + 分店 + 常客 + 订单 + 累计收入）。
          同行的实力<b>每月上浮 {{ Math.round(RIVAL_MONTH_GROWTH * 100) }}%</b>——不进步就会被追上。名次每月可领一次奖励；
          落后时可花金币投放<b>推广</b>（本月分数 +{{ RIVAL_PROMO_BONUS }}%）冲名次。
        </p>
      </div>
    </header>

    <!-- 我的名次 -->
    <div class="card rv-hero">
      <div class="rv-hero-left">
        <div class="rv-rank">
          <span class="rv-rank-num">#{{ top?.rank }}</span>
          <span class="rv-stars">{{ '★'.repeat(board.stars) }}</span>
        </div>
        <div class="dim">本月名次</div>
      </div>
      <div class="rv-hero-right">
        <div class="rev-bar-label">
          <span class="dim">我的经营分 <b class="mono">{{ board.score.toLocaleString() }}</b></span>
          <span v-if="nextUp" class="mono">追赶 {{ nextUp.icon }} {{ nextUp.name }}（{{ nextUp.score.toLocaleString() }}）</span>
          <span v-else class="mono">已登顶</span>
        </div>
        <ProgressBar :progress="nextUp ? Math.min(1, board.score / nextUp.score) : 1" />
        <div class="rv-actions">
          <button class="btn btn-sm btn-primary" :disabled="board.claimed" @click="claim">
            {{ board.claimed ? '本月已领取' : `领取名次奖励（${board.reward.label}）` }}
          </button>
          <button class="btn btn-sm" :disabled="board.promo" @click="promote">
            {{ board.promo ? '本月已推广' : `投放推广（${RIVAL_PROMO_COST.toLocaleString()} 金币）` }}
          </button>
          <span class="dim rv-sub">
            {{ board.reward.gold.toLocaleString() }} 金币<template v-for="(q, id) in board.reward.items" :key="id"> · {{ getItem(id)?.name ?? id }} ×{{ q }}</template>
          </span>
        </div>
      </div>
    </div>

    <!-- 榜单 -->
    <div class="card rv-board-card">
      <div class="rv-h">📊 本月榜单</div>
      <div class="rv-board">
        <div v-for="r in rows" :key="r.id" class="rv-row" :class="{ me: r.me, top3: r.rank <= 3 }">
          <span class="rv-row-rank mono">{{ r.rank }}</span>
          <span class="rv-row-icon">{{ r.icon }}</span>
          <span class="rv-row-name">{{ r.name }}<span v-if="r.me" class="badge badge-on">我</span></span>
          <span class="dim rv-row-style">{{ r.style }}</span>
          <span class="rv-row-bar"><ProgressBar :progress="r.score / maxScore" /></span>
          <span class="mono rv-row-score">{{ r.score.toLocaleString() }}</span>
        </div>
      </div>
      <p class="dim rv-sub" style="margin-top: 8px">
        同行名字每月轮换；榜单在跨月时自动重置（奖励与推广各每月一次）。
      </p>
    </div>

    <!-- 分数构成 -->
    <div class="card">
      <div class="rv-h">🧮 经营分构成（合计 <b class="mono">{{ board.score.toLocaleString() }}</b><template v-if="board.promo"> · 含推广 +{{ RIVAL_PROMO_BONUS }}%</template>）</div>
      <div class="rv-factors">
        <div v-for="f in factors" :key="f.name" class="rv-factor">
          <span class="dim">{{ f.name }}</span>
          <span class="mono">{{ f.raw.toLocaleString() }} × {{ f.mult }} = <b>{{ f.pts.toLocaleString() }}</b></span>
        </div>
      </div>
      <p class="dim rv-sub" style="margin-top: 8px">
        想冲榜优先做<b>分店</b>（每店 120 分）、<b>菜单</b>（每 tier 60 分）和<b>米其林评分</b>——这三项同时也在提升实际收入。
      </p>
    </div>

    <div class="card status-line">
      <span class="dim">相关页面：</span>
      <button class="btn btn-sm" @click="ui.setView('michelin')">⭐ 米其林评级</button>
      <button class="btn btn-sm" @click="ui.setView('branches')">🏬 餐厅分店</button>
      <button class="btn btn-sm" @click="ui.setView('restaurant')">🏮 餐厅</button>
      <button class="btn btn-sm" @click="ui.setView('setMeals')">🍱 套餐与定食</button>
    </div>
  </div>
</template>

<style scoped>
.rv-hero {
  margin-top: 12px;
  padding: 14px 16px;
  display: flex;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
}
.rv-hero-left {
  text-align: center;
  min-width: 100px;
}
.rv-rank {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.rv-rank-num {
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
  color: var(--accent, #d95a38);
}
.rv-stars {
  font-size: 12px;
  color: var(--gold, #a8780b);
}
.rv-hero-right {
  flex: 1;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rev-bar-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
}
.rv-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.rv-sub {
  font-size: 12px;
  line-height: 1.6;
}
.rv-h {
  font-weight: 600;
}
.rv-board-card {
  margin-top: 12px;
}
.rv-board {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 8px;
}
.rv-row {
  display: grid;
  grid-template-columns: 26px 22px minmax(96px, auto) 1fr 90px 76px;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.rv-row.me {
  border-style: solid;
  border-color: var(--accent, #d95a38);
}
.rv-row.top3 .rv-row-rank {
  color: var(--gold, #a8780b);
  font-weight: 700;
}
.rv-row-rank {
  text-align: center;
}
.rv-row-icon {
  font-size: 16px;
}
.rv-row-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.rv-row-style {
  font-size: 12px;
}
.rv-row-bar {
  min-width: 60px;
}
.rv-row-score {
  text-align: right;
}
.rv-factors {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 6px;
  margin-top: 8px;
}
.rv-factor {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
</style>
