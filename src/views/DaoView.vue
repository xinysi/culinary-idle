<script setup>
// 厨神之路（v2.0 新增）— 转生专属的轮回天赋树。
// 货币「轮回印记」由**转生次数**派生（不新增货币存档字段）：可用 = 累计转生 − 已投入；
// 四路（采撷/火工/厨武/经营）× 三层 × 各 3 节点；层数有「本路已解锁数」门槛。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { DAO_PATHS, DAO_TIER_REQ, DAO_NODES, daoCanUnlock, daoPathCost } from '../game/data/daoTree.js'
import FoldCard from '../components/FoldCard.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const points = computed(() => player.daoPoints())
const spent = computed(() => player.daoSpentPoints())
const unlockedCount = computed(() => (player.daoUnlocked ?? []).length)
const totalCost = computed(() => DAO_NODES.reduce((a, n) => a + n.cost, 0))

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

function unlock(node) {
  const r = player.daoUnlock(node.id)
  if (!r.ok) ui.pushLog(r.msg, 'warn')
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
          </tbody>
        </table>
      </div>
      <p class="dim" style="margin: 8px 0 0; font-size: 12px; line-height: 1.6">
        层数门槛：进入第 2 层需本路**已解锁 2 个**节点，第 3 层需 **5 个**——所以是"沿路推进"而非直接跳点满。
        印记来自转生（每次转生 +1），**解锁只增不减**；点满一条路约需 18 次转生，四路全满 72 次，属毕业级长线目标。
      </p>
    </FoldCard>

    <!-- 四条道途的节点树 -->
    <div class="dao-grid">
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
  background: rgba(217, 90, 56, 0.12);
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
