<script setup>
// 厨友（2026-09-11 新增）— 本地镜像同行：每日拜访拿点小礼物、接一份帮厨委托。
// 纯单机无后端，所以「社交」做成**本地生成的镜像厨友**（与竞技场/同业榜同思路），不假装有别的玩家。
// 奖励只由本系统自身放大，不叠加到餐厅/采集/对决等既有乘区（见 game/data/friends.js 的口径说明）。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { FRIENDS, FRIEND_BOND_STEPS, friendBondLevel, friendBondProgress } from '../game/data/friends.js'
import { getItem, itemName } from '../game/data/items.js'
import FoldCard from '../components/FoldCard.vue'
import ProgressBar from '../components/ProgressBar.vue'
import RelatedPages from '../components/RelatedPages.vue'

// 羁绊阶梯（0~5 级）：系数与 friends.js 的公式同源——拜访礼物 ×(1+0.25×级)、委托赏金 ×(1+0.15×级)
const bondLadder = computed(() =>
  Array.from({ length: FRIEND_BOND_STEPS.length + 1 }, (_, lv) => ({
    lv,
    total: lv === 0 ? 0 : FRIEND_BOND_STEPS[lv - 1],
    step: lv === 0 ? 0 : FRIEND_BOND_STEPS[lv - 1] - (lv === 1 ? 0 : FRIEND_BOND_STEPS[lv - 2]),
    giftMult: 1 + 0.25 * lv,
    orderMult: 1 + 0.15 * lv,
  }))
)

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'rivals', label: '🏪 同业榜' },
  { view: 'regulars', label: '📖 常客名录' },
  { view: 'restaurant', label: '🏮 我的餐厅' },
  { view: 'mail', label: '📬 信箱' },
]

// 触发委托的当日生成（读 friendOrder 时内部也会 ensure，这里显式调一次让首帧就有数据）
player.ensureFriendOrders()

const board = computed(() =>
  FRIENDS.map((f) => {
    const bond = player.friendBond(f.id)
    const order = player.friendOrder(f.id)
    const visited = player.friendVisitedToday(f.id)
    return {
      ...f,
      bond,
      level: friendBondLevel(bond),
      prog: friendBondProgress(bond),
      order,
      visited,
      have: order ? (player.inventory[order.itemId] ?? 0) : 0,
    }
  })
)
const visitable = computed(() => board.value.filter((b) => !b.visited).length)
const orderable = computed(() => board.value.filter((b) => b.order && b.have >= b.order.qty).length)
const totalBond = computed(() => board.value.reduce((a, b) => a + b.bond, 0))

function visit(b) {
  const r = player.visitFriend(b.id)
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  ui.pushLog(`🤝 拜访 ${b.name}：+${r.gold.toLocaleString()} 金币（羁绊 ${r.level} 级）`, 'gain')
}
function deliver(b) {
  const r = player.deliverFriendOrder(b.id)
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  ui.pushLog(`🍱 帮 ${b.name} 备好 ${getItem(r.itemId ?? b.order?.itemId)?.name ?? ''}：+${r.gold.toLocaleString()} 金币`, 'gain')
}
/** 一键拜访所有今天还没拜访的 */
function visitAll() {
  let gold = 0
  let n = 0
  for (const b of board.value) {
    if (b.visited) continue
    const r = player.visitFriend(b.id)
    if (r.ok) { gold += r.gold; n++ }
  }
  ui.pushLog(n ? `🤝 一次串门拜访了 ${n} 位厨友：+${gold.toLocaleString()} 金币` : '今天已经没有可拜访的厨友了', n ? 'gain' : 'warn')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🤝 厨友</h2>
        <p class="dim">
          单机没有真人好友，所以这 {{ FRIENDS.length }} 位是<b>本地生成的镜像同行</b>——各有拿手菜系与脾气。
          每天每人可<b>拜访一次</b>（小礼物 + 羁绊），并可帮他<b>备一份料</b>换赏金。羁绊只放大他们两个自己的礼物与赏金。
        </p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">{{ visitable }} 位可拜访</div>
        <p class="dim mono">累计羁绊 {{ totalBond }} · {{ orderable }} 份委托可交</p>
      </div>
    </header>

    <!-- 羁绊阶梯 + 厨友档案（2026-09-12 补）：系数直接由 friends.js 的公式算（礼物 ×(1+0.25×级)、赏金 ×(1+0.15×级)） -->
    <FoldCard
      title="📋 羁绊阶梯 + 厨友档案"
      hint="羁绊每级：拜访礼物 +25%、委托赏金 +15%；满 5 级各需累计互动 1/5/12/25/45 次"
    >
      <div class="table-scroll">
        <table class="target-table">
          <thead>
            <tr><th>羁绊</th><th>累计互动</th><th>本级还需</th><th>拜访礼物</th><th>委托赏金</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in bondLadder" :key="row.lv">
              <td class="mono">Lv{{ row.lv }}</td>
              <td class="mono">{{ row.total }} 次</td>
              <td class="mono">{{ row.step ? row.step + ' 次' : '—' }}</td>
              <td class="mono">×{{ row.giftMult.toFixed(2) }}</td>
              <td class="mono">×{{ row.orderMult.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="table-scroll" style="margin-top: 10px">
        <table class="target-table">
          <thead>
            <tr><th>厨友</th><th>拿手菜系</th><th>礼物基数</th><th>委托点名池</th></tr>
          </thead>
          <tbody>
            <tr v-for="f in FRIENDS" :key="f.id">
              <td>{{ f.icon }} {{ f.name }}</td>
              <td class="dim">{{ f.school }}</td>
              <td class="mono">{{ f.goldBase }}</td>
              <td class="dim">{{ (f.pool ?? []).map((id) => itemName(id)).join('、') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="dim" style="margin: 8px 0 0; font-size: 12px; line-height: 1.6">
        「累计互动」= 拜访 + 交付委托各算 1 次（每位厨友独立计）。礼物金币 = 礼物基数 × 礼物系数；
        委托赏金 = 物品价值 × 数量 × 随机(1.4~2.0) × 赏金系数，且委托<b>优先点名你背包里已有的料</b>——
        所以「先刷谁」看两件事：他的<b>礼物基数</b>（越高越值得每天串门）与<b>点名池</b>是否是你手上多的料。
      </p>
    </FoldCard>

    <div class="card fr-hero">
      <div class="fr-stat"><span class="dim">今日可拜访</span><b class="mono" :class="{ 'fr-hot': visitable > 0 }">{{ visitable }}/{{ FRIENDS.length }}</b></div>
      <div class="fr-stat"><span class="dim">委托可交</span><b class="mono">{{ orderable }}</b></div>
      <div class="fr-stat"><span class="dim">累计羁绊</span><b class="mono">{{ totalBond }}</b></div>
      <button class="btn btn-sm btn-primary fr-visitall" :disabled="!visitable" @click="visitAll">一键串门（{{ visitable }}）</button>
    </div>

    <div class="card fr-card">
      <div class="fr-grid">
        <div v-for="b in board" :key="b.id" class="fr-item" :class="{ visited: b.visited }">
          <div class="fr-head">
            <span class="fr-icon">{{ b.icon }}</span>
            <div class="fr-title">
              <strong>{{ b.name }}</strong>
              <span class="dim fr-school">{{ b.school }}</span>
            </div>
            <span class="badge" :class="{ 'badge-on': b.level > 0 }">羁绊 {{ b.level }}</span>
          </div>

          <p class="dim fr-line">{{ b.line }}</p>

          <div class="fr-bond">
            <span class="dim fr-bond-label">羁绊进度</span>
            <ProgressBar :progress="b.prog.progress" />
            <span class="mono dim fr-bond-num">{{ b.prog.level >= FRIEND_BOND_STEPS.length ? '满级' : `${b.prog.current}/${b.prog.needed}` }}</span>
          </div>

          <div class="fr-actions">
            <button class="btn btn-sm" :class="{ 'btn-primary': !b.visited }" :disabled="b.visited" @click="visit(b)">
              {{ b.visited ? '今日已拜访' : '拜访' }}
            </button>
          </div>

          <div v-if="b.order" class="fr-order" :class="{ ready: b.have >= b.order.qty }">
            <div class="fr-order-top">
              <span>帮厨委托</span>
              <span class="mono dim">{{ b.have }}/{{ b.order.qty }}</span>
            </div>
            <div class="fr-order-need">
              需要 {{ getItem(b.order.itemId)?.name ?? b.order.itemId }} ×{{ b.order.qty }}
              <span class="dim">（赏金 {{ b.order.reward.toLocaleString() }} 金）</span>
            </div>
            <button class="btn btn-sm" :class="{ 'btn-primary': b.have >= b.order.qty }" :disabled="b.have < b.order.qty" @click="deliver(b)">
              {{ b.have >= b.order.qty ? '交付' : '材料不足' }}
            </button>
          </div>
          <p v-else class="dim fr-done">✓ 今日委托已交付，明天再来</p>
        </div>
      </div>
    </div>

    <div class="card fr-card">
      <div class="fr-h">📖 说明</div>
      <ul class="fr-rules">
        <li><b>羁绊</b>按累计互动次数（拜访 + 交付各算一次）成长：{{ FRIEND_BOND_STEPS.join(' / ' ) }} 次 → 1~5 级，每级让他的拜访礼物与委托赏金 <b>+15~25%</b>。</li>
        <li><b>委托</b>每天刷新一次，只会点名他自己菜系池子里的<b>常见食材</b>（优先你背包里已有的），早期也交得起。</li>
        <li><b>赏金口径</b>与「食客订单」对齐（物品价值 × 数量 × 1.4~2.0），略低一档；不新增物品、不改动任何固定数值。</li>
        <li><b>羁绊不会</b>给餐厅/采集/对决等既有乘区加成——它只放大这两位自己的往来，避免打乱已经标定好的节奏。</li>
      </ul>
    </div>

    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.fr-hero {
  margin-top: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
}
.fr-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.fr-stat b {
  font-size: 16px;
}
.fr-hot {
  color: var(--accent, #d95a38);
}
.fr-visitall {
  margin-left: auto;
}
.fr-card {
  margin-top: 12px;
}
.fr-h {
  font-weight: 600;
}
.fr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.fr-item {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.fr-item.visited {
  opacity: 0.86;
}
.fr-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fr-icon {
  font-size: 22px;
  line-height: 1;
}
.fr-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.fr-school {
  font-size: 11px;
}
.fr-line {
  font-size: 12px;
  margin: 0;
  line-height: 1.6;
}
.fr-bond {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fr-bond-label,
.fr-bond-num {
  font-size: 11px;
  white-space: nowrap;
}
.fr-bond :deep(.progress-wrap),
.fr-bond > *:nth-child(2) {
  flex: 1;
}
.fr-order {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 7px 9px;
  border-radius: 6px;
  background: rgba(217, 90, 56, 0.07);
  border: 1px dashed var(--border);
}
.fr-order.ready {
  border-style: solid;
  border-color: rgba(217, 90, 56, 0.5);
}
.fr-order-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
}
.fr-order-need {
  font-size: 12px;
}
.fr-done {
  font-size: 12px;
  margin: 0;
}
.fr-rules {
  margin: 8px 0 0;
  padding-left: 20px;
  font-size: 12px;
  line-height: 1.85;
}
</style>
