<script setup>
// 厨神之路（v2.0 新增；v2.1 加「图谱」视图）— 转生专属的轮回天赋树。
// 货币「轮回印记」由**转生次数**派生（不新增货币存档字段）：可用 = 累计转生 − 已投入；
// 四路（采撷/火工/厨武/经营）× 三层 × 各 3 节点；层数有「本路已解锁数」门槛。
// 视图有两个页签：🗺 图谱（SVG 可平移缩放的节点图，`components/DaoTreeGraph.vue`）/ 📋 列表（原布局）。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { sfx } from '../game/core/sound.js'
import { DAO_PATHS, DAO_TIER_REQ, DAO_NODES, daoCanUnlock, daoPathCost } from '../game/data/daoTree.js'
import { daoGraphLayout } from '../game/data/daoGraph.js'
import DaoTreeGraph from '../components/DaoTreeGraph.vue'
import FoldCard from '../components/FoldCard.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const points = computed(() => player.daoPoints())
const spent = computed(() => player.daoSpentPoints())
const unlockedCount = computed(() => (player.daoUnlocked ?? []).length)
const totalCost = computed(() => DAO_NODES.reduce((a, n) => a + n.cost, 0))

// 视图页签（图谱 / 列表）
const TABS = [
  { id: 'graph', icon: '🗺', name: '图谱' },
  { id: 'list', icon: '📋', name: '列表' },
]
const tab = ref('graph')

// 每条道途：节点（带状态）+ 进度
const paths = computed(() =>
  DAO_PATHS.map((p) => {
    const nodes = DAO_NODES.filter((n) => n.path === p.id).sort((a, b) => a.tier - b.tier)
    const prog = player.daoPathProgress(p.id)
    return {
      ...p,
      prog,
      tiers: [1, 2, 3].map((tier) => ({
        tier,
        req: DAO_TIER_REQ[tier] ?? 0,
        nodes: nodes.filter((n) => n.tier === tier).map((n) => {
          const owned = (player.daoUnlocked ?? []).includes(n.id)
          const chk = owned ? { ok: false, reason: '已解锁' } : daoCanUnlock(n.id, player.daoUnlocked ?? [], points.value)
          return { ...n, owned, can: chk.ok, reason: chk.reason }
        }),
      })),
    }
  })
)

// 外环「觅珍环」节点（环绕整圈的抽卡券节点）：状态与道途节点同款
const outerNodes = computed(() =>
  DAO_NODES.filter((n) => n.ring).map((n) => {
    const owned = (player.daoUnlocked ?? []).includes(n.id)
    const chk = owned ? { ok: false, reason: '已解锁' } : daoCanUnlock(n.id, player.daoUnlocked ?? [], points.value)
    return { ...n, owned, can: chk.ok, reason: chk.reason }
  })
)
const outerOwned = computed(() => outerNodes.value.filter((n) => n.owned).length)

// 图谱：布局是纯函数（`data/daoGraph.js`），这里只把每个节点的**状态**合进去
const graph = daoGraphLayout()
const nodeState = computed(() => {
  const m = new Map()
  for (const p of paths.value) for (const t of p.tiers) for (const n of t.nodes) m.set(n.id, n)
  return m
})
const graphNodes = computed(() => graph.nodes.map((n) => ({ ...n, ...(nodeState.value.get(n.id) ?? {}) })))

// 点节点 → 详情小卡（不改玩法：解锁仍走 player.daoUnlock）
const picked = ref(null)
const unlockMsg = ref('')
const unlockBad = ref(false)
function pick(node) {
  picked.value = node
  unlockMsg.value = ''
}
const pickedState = computed(() => (picked.value ? nodeState.value.get(picked.value.id) ?? picked.value : null))

/** 第二步：确认解锁。失败时给明确反馈（不置灰按钮，避免「点了没反应」）。 */
function unlock(node) {
  const r = player.daoUnlock(node.id)
  if (!r.ok) {
    unlockBad.value = true
    unlockMsg.value = `解锁失败：${r.msg}`
    sfx.error()
    ui.pushLog(`🛤️ 「${node.name}」解锁失败：${r.msg}`, 'warn')
    return
  }
  unlockBad.value = false
  unlockMsg.value = `已解锁「${node.name}」${r.tickets ? ` · 🎟️ 觅珍抽卡券 +${r.tickets}` : ''}`
  if (r.tickets) ui.pushLog(`🎟️ 厨神之路·觅珍环「${node.name}」：觅珍抽卡券 +${r.tickets}`, 'gain')
  sfx.reward()
}

// 相关页面
const RELATED = [{ view: 'skill', label: '🌾 技能页' }, { view: 'achievements', label: '🥇 成就称号' }, { view: 'stats', label: '📊 统计' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🛤️ 厨神之路</h2>
        <p class="dim">
          转生专属的天赋树：<b>每完成一次技能转生获得 1 枚「轮回印记」</b>，可在四条道途上解锁节点获得永久加成。
          印记由转生次数派生（不需要额外肝货币），解锁即生效、无需重练。
        </p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">🪙 轮回印记 <b class="mono">{{ points }}</b></div>
        <p class="dim mono">已投入 {{ spent }} · 已解锁 {{ unlockedCount }}/{{ DAO_NODES.length }} 节点</p>
      </div>
    </header>

    <div v-if="points === 0 && unlockedCount === 0" class="card status-line">
      <span class="badge">🔒 尚未转生</span>
      <span class="dim">任意技能练到 <b>100 级</b>后在技能页转生，即可获得第一枚轮回印记（技能页右上角「✨ 转生」按钮）。</span>
    </div>

    <!-- 效果汇总（折叠在页头下方、摘要写结论） -->
    <FoldCard
      title="📋 四条道途一览"
      :hint="`点满一条路需 ${daoPathCost('gather')} 枚印记、四条全满共 ${totalCost} 枚（≈${totalCost} 次转生）`"
    >
      <div class="table-scroll">
        <table class="target-table">
          <thead>
            <tr><th>道途</th><th>主题</th><th>节点数</th><th>单路印记</th><th>我已完成</th><th>点满后总计</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in paths" :key="p.id">
              <td>{{ p.icon }} {{ p.name }}</td>
              <td class="dim">{{ p.desc }}</td>
              <td class="mono">{{ p.prog.total }}</td>
              <td class="mono">{{ p.prog.cost }}</td>
              <td class="mono" :class="{ 'mastery-hl': p.prog.unlocked > 0 }">{{ p.prog.unlocked }} / {{ p.prog.total }}（投入 {{ p.prog.spent }}）</td>
              <td class="dim">{{ p.id === 'gather' ? '产量 +16%、采集经验 +20%、种子概率 +7%、离线上限 +6h' : p.id === 'craft' ? '制作经验 +20%、全技能经验 +10%、金币 +12%' : p.id === 'combat' ? '伤害 +16%、品鉴值 +16%、暴击 +10%' : '餐厅收入 +20%、订单赏金 +20%、分店 +20%' }}</td>
            </tr>
            <tr>
              <td>🎟️ 觅珍环（外环）</td>
              <td class="dim">环绕整圈的抽卡券节点 · 每个 +100 张</td>
              <td class="mono">{{ outerNodes.length }}</td>
              <td class="mono">0</td>
              <td class="mono" :class="{ 'mastery-hl': outerOwned > 0 }">{{ outerOwned }} / {{ outerNodes.length }}</td>
              <td class="dim">觅珍抽卡券 ×{{ outerNodes.length * 100 }}（抽卡时优先抵扣金币）</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="dim" style="margin: 8px 0 0; font-size: 12px; line-height: 1.6">
        层数门槛：进入第 2 层需本路**已解锁 2 个**节点，第 3 层需 **5 个**——所以是"沿路推进"而非直接跳点满。
        印记来自转生（每次转生 +1），**解锁只增不减**；点满一条路约需 18 次转生，四路全满 72 次，属毕业级长线目标。
      </p>
    </FoldCard>

    <!-- 视图切换：🗺 图谱（可拖动缩放的节点图）/ 📋 列表（原布局） -->
    <div class="region-tabs dao-tabs">
      <button
        v-for="t in TABS"
        :key="t.id"
        class="btn btn-sm"
        :class="{ 'btn-primary': tab === t.id }"
        @click="tab = t.id"
      >{{ t.icon }} {{ t.name }}</button>
    </div>

    <!-- 🗺 图谱视图 -->
    <template v-if="tab === 'graph'">
      <DaoTreeGraph
        :nodes="graphNodes"
        :links="graph.links"
        :sectors="graph.sectors"
        :rings="graph.rings"
        :width="graph.width"
        :height="graph.height"
        :focus-x="graph.focusX"
        :focus-y="graph.focusY"
        :root="graph.root"
        :trunks="graph.trunks"
        @pick="pick"
      />
      <div v-if="pickedState" class="card dao-detail">
        <div class="dao-detail-head">
          <span class="dao-icon">{{ pickedState.icon }}</span>
          <div>
            <strong>{{ pickedState.name }}</strong>
            <div class="dim dao-sub">
              {{ pickedState.pathIcon }} {{ pickedState.pathName }} · {{ pickedState.ring ? '外环' : `第 ${pickedState.tier} 层` }}
              <span v-if="pickedState.ring && pickedState.req?.daoNodes">（需全树已解锁 {{ pickedState.req.daoNodes }} 个道途节点）</span>
              <span v-else-if="pickedState.tierReq">（需本路已解锁 {{ pickedState.tierReq }} 个）</span>
              <template v-if="pickedState.cost"> · 成本 <b class="mono">{{ pickedState.cost }}</b> 枚</template>
              <template v-else> · 不消耗轮回印记</template>
            </div>
          </div>
          <button class="btn btn-sm dao-detail-close" @click="picked = null">✕</button>
        </div>
        <p class="dao-detail-desc">{{ pickedState.desc }}</p>
        <p v-if="pickedState.reward?.tickets" class="dim dao-detail-reward">
          🎟️ 奖励：觅珍抽卡券 ×{{ pickedState.reward.tickets }}（解锁即到账，抽卡时优先抵扣金币）
        </p>
        <div class="dao-detail-foot">
          <span v-if="pickedState.owned" class="badge">✓ 已解锁</span>
          <span v-else-if="pickedState.can" class="dim">可解锁（当前印记 {{ points }}）</span>
          <span v-else class="dim">🔒 {{ pickedState.reason }}</span>
          <!-- 两步解锁（用户要求）：点节点 → 再点这里确认。**按钮不置灰**：
               条件不够时也允许点，点了给出「解锁失败」的明确反馈，而不是让人对着灰按钮猜原因。 -->
          <button
            v-if="!pickedState.owned"
            class="btn btn-sm btn-primary dao-unlock-btn"
            @click="unlock(pickedState)"
          >确认解锁{{ pickedState.cost ? `（${pickedState.cost} 枚）` : '' }}</button>
        </div>
        <p v-if="unlockMsg" class="dao-unlock-msg" :class="{ bad: unlockBad }">{{ unlockMsg }}</p>
      </div>
      <p v-else class="dim dao-graph-hint">点任意节点查看效果与解锁条件（确认解锁在下方详情卡）；拖动空白处平移、滚轮或双指缩放。</p>
    </template>

    <!-- 📋 列表视图（原布局，未改动） -->
    <div v-else class="dao-grid">
      <!-- 外环「觅珍环」：环绕整圈的抽卡券节点（无印记消耗，按全树已解锁数递进） -->
      <div class="card dao-path dao-outer-card">
        <div class="dao-path-head">
          <span class="dao-icon">🎟️</span>
          <div>
            <strong>觅珍环（外环）</strong>
            <div class="dim dao-sub">环绕整圈的抽卡券节点 · {{ outerOwned }}/{{ outerNodes.length }} · 每个 +100 张</div>
          </div>
        </div>
        <div class="dao-tier">
          <div class="dim dao-tier-head">门槛 = 全树已解锁的道途节点数（3 → 36，不需要轮回印记）</div>
          <button
            v-for="n in outerNodes"
            :key="n.id"
            class="dao-node"
            :class="{ owned: n.owned, can: !n.owned && n.can }"
            :disabled="n.owned || !n.can"
            :title="n.owned ? '已解锁' : n.can ? '可解锁' : n.reason"
            @click="unlock(n, true)"
          >
            <span class="dao-node-icon">{{ n.icon }}</span>
            <span class="dao-node-name">{{ n.name }}</span>
            <span class="dim dao-node-req">{{ n.owned ? '已解锁' : n.can ? '🎟️×100' : n.reason }}</span>
          </button>
        </div>
      </div>
      <div v-for="p in paths" :key="p.id" class="card dao-path">
        <div class="dao-path-head">
          <span class="dao-icon">{{ p.icon }}</span>
          <div>
            <strong>{{ p.name }}</strong>
            <div class="dim dao-sub">{{ p.desc }} · {{ p.prog.unlocked }}/{{ p.prog.total }}</div>
          </div>
        </div>
        <div v-for="t in p.tiers" :key="t.tier" class="dao-tier">
          <div class="dim dao-tier-head">
            第 {{ t.tier }} 层
            <span v-if="t.req" class="dim">（需本路已解锁 {{ t.req }} 个）</span>
          </div>
          <button
            v-for="n in t.nodes"
            :key="n.id"
            class="dao-node"
            :class="{ owned: n.owned, can: n.can && !n.owned }"
            :disabled="n.owned || !n.can"
            :title="n.owned ? '已解锁' : n.reason"
            @click="unlock(n)"
          >
            <span class="dao-node-icon">{{ n.icon }}</span>
            <span class="dao-node-body">
              <span class="dao-node-name">{{ n.name }}</span>
              <span class="dim dao-node-desc">{{ n.desc }}</span>
            </span>
            <span class="mono dao-node-cost">{{ n.owned ? '✓' : n.cost + ' 枚' }}</span>
          </button>
        </div>
      </div>
    </div>

    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.dao-tabs {
  margin: 12px 0 0;
}
.dao-detail {
  margin-top: 10px;
  padding: 12px 14px;
}
.dao-detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dao-detail-close {
  margin-left: auto;
}
.dao-detail-desc {
  margin: 8px 0 0;
  font-size: 13px;
}
.dao-detail-foot {
  display: flex;
  /* 同提示卡那条教训：原因文字一长会折行，居中会让左侧徽标/右侧按钮看起来错位；
     按钮必须独占一行份、不许被挤窄换行，且保持贴右。 */
  align-items: flex-start;
  gap: 10px;
  margin-top: 10px;
}
.dao-detail-foot > .dim,
.dao-detail-foot > .badge {
  flex: 1 1 auto;
  min-width: 0;
}
.dao-detail-foot > .btn {
  margin-left: auto;
  flex: 0 0 auto;
  white-space: nowrap;
}
.dao-unlock-msg {
  margin: 8px 0 0;
  font-size: 12.5px;
  color: var(--good-strong);
}
.dao-unlock-msg.bad {
  color: var(--bad-strong);
}
.dao-graph-hint {
  margin: 10px 0 0;
  font-size: 12px;
}
.dao-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.dao-path {
  padding: 12px 14px;
}
.dao-path-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.dao-icon {
  font-size: 22px;
}
.dao-sub {
  font-size: 12px;
}
.dao-tier {
  margin-top: 8px;
}
.dao-tier-head {
  font-size: 12px;
  margin-bottom: 4px;
}
.dao-node {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  margin-bottom: 5px;
  text-align: left;
  cursor: pointer;
  border-radius: 8px;
  border: 1px dashed var(--border);
  background: var(--bg-soft);
  color: var(--text);
  opacity: 0.6;
}
.dao-node.can {
  opacity: 1;
  border-style: solid;
  border-color: var(--primary-strong);
  background: rgba(var(--primary-tint-rgb), 0.12);
}
.dao-node.owned {
  opacity: 1;
  border-color: var(--good-strong);
  background: rgba(87, 168, 97, 0.14);
}
.dao-node:disabled {
  cursor: default;
}
.dao-node-icon {
  font-size: 16px;
}
.dao-node-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.dao-node-name {
  font-weight: 700;
  font-size: 13px;
}
.dao-node-desc {
  font-size: 11px;
}
.dao-node-cost {
  font-size: 12px;
  white-space: nowrap;
}
</style>
