<script setup>
// 食神秘境（2026-09-11 从「对决」页抽出为独立页）— Roguelike 局内模式：逐层挑战随机对手，
// 每胜一层 3 选 1 临时增益（仅本局生效），阵亡按层数结算奖励。
// 纯读取 + 调用既有 player.realm* / combat 接口，不改动任何对决数据（数据铁律；对手由 opp() 动态生成）。
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getCombat } from '../game/combat/Combat.js'
import { EventBus } from '../game/core/EventBus.js'
import { REALM_BUFFS, realmOpponent, realmOpponentLevel, realmReward } from '../game/data/mysticRealm.js'
import CombatPanel from '../components/CombatPanel.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()
const combat = getCombat()

const RELATED = [
  { view: 'skill', label: '⚔️ 对决技能' },
  { view: 'tower', label: '🗼 试炼塔' },
  { view: 'arena', label: '⚔️ 竞技场' },
  { view: 'trials', label: '🏅 试炼' },
]

// 秘境状态（combat 实例与 realm 存储均非响应式，靠全局 loopTick 逐帧刷新）
const realm = computed(() => {
  ui.loopTick
  const st = player.realmState()
  return { ...st, buffDefs: (st.buffs ?? []).map((id) => REALM_BUFFS.find((b) => b.id === id)).filter(Boolean) }
})

function startRealm() {
  player.realmStart()
  fightRealmFloor()
}
function fightRealmFloor() {
  const st = player.realmState()
  if (!st.active || !combat) return
  if (player.combat.hp <= 0) player.setCombat({ hp: player.maxHp })
  combat.start(realmOpponent(st.floor, player.combatLevel))
}
function pickRealmBuff(id) {
  if (player.realmPickBuff(id)) fightRealmFloor()
}
function abandonRealm() {
  if (!confirm('放弃本次秘境？按当前层数结算奖励，本局增益清零。')) return
  const r = player.realmEnd()
  combat?.stop()
  if (r) ui.pushLog(`🏯 秘境结算：第 ${r.floor} 层，+${r.gold} 金币`, 'gain')
}

// 局内结束：胜则进一层（给 3 选 1），败则结算。与本页挂载/卸载同生命周期，避免叠加监听。
let off = null
onMounted(() => {
  off = EventBus.on('combat:end', ({ result }) => {
    if (!player.realmState().active) return
    if (result === 'win') player.realmAdvance()
    else player.realmEnd()
  })
})
onBeforeUnmount(() => {
  off?.()
  off = null
})

// 下一层对手预览（等级 / 血量上浮），让玩家知道还能撑几层
const nextFloor = computed(() => realm.value.floor)
const nextLevel = computed(() => realmOpponentLevel(nextFloor.value, player.combatLevel))
const nextHpBoost = computed(() => Math.round(nextFloor.value * 6))

const REWARD_FLOORS = [1, 3, 5, 10, 15, 20, 30]
const rewardTable = computed(() =>
  REWARD_FLOORS.map((f) => {
    const r = realmReward(f)
    const items = Object.entries(r.items ?? {}).filter(([, q]) => q > 0).map(([id, q]) => `${id === 'mysterySpice' ? '神秘调料' : '能量饼干'} ×${q}`)
    return { floor: f, gold: r.gold, items: items.join('、') || '—' }
  })
)
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🏯 食神秘境</h2>
        <p class="dim">
          Roguelike 式逐层挑战：对手按<b>你的对决等级 + 层数</b>动态生成，每胜一层从 <b>3 项祝福</b>里选 1 项
          （<b>仅本局生效</b>，下局重置），阵亡或主动放弃时按<b>到达层数</b>结算奖励。换页不会中断本局。
        </p>
      </div>
    </header>

    <!-- 本局状态 -->
    <div class="card realm-card">
      <div class="realm-head">
        <h3>{{ realm.active ? `第 ${realm.floor + 1} 层` : '准备进入秘境' }}</h3>
        <span v-if="realm.active" class="dim">当前对手：{{ nextLevel }} 级 · 血量 +{{ nextHpBoost }}%</span>
        <span v-else class="dim">起点对手按你的对决等级生成，每往下一层：对手等级 +1.5、血量 +6%</span>
        <div class="realm-head-right">
          <span v-if="realm.best" class="dim">历史最佳 {{ realm.best }} 层</span>
          <template v-if="realm.active">
            <span class="badge badge-on">已获 {{ realm.buffDefs.length }} 项祝福</span>
            <button class="btn btn-sm btn-danger" @click="abandonRealm()">放弃并结算</button>
          </template>
          <button v-else class="btn btn-sm btn-primary" @click="startRealm()">进入秘境</button>
        </div>
      </div>
      <div v-if="realm.active && realm.buffDefs.length" class="realm-buffs">
        <span v-for="b in realm.buffDefs" :key="b.id" class="mod-chip">{{ b.name }}（{{ b.desc }}）</span>
      </div>
      <p v-if="realm.active" class="dim rz-sub">
        祝福可重复叠加；<b>金玉满堂</b>按金币加成计入本局结算。阵亡即结束本局。
      </p>
    </div>

    <!-- 3 选 1 增益弹窗 -->
    <div v-if="realm.pending?.length" class="modal-backdrop">
      <div class="modal realm-modal">
        <div class="modal-head">
          <h3>🏯 第 {{ realm.floor }} 层通过！选择一项祝福</h3>
        </div>
        <div class="realm-choices">
          <button v-for="b in realm.pending" :key="b.id" class="btn realm-choice" @click="pickRealmBuff(b.id)">
            <strong>{{ b.name }}</strong>
            <span class="dim">{{ b.desc }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 对战框（与对决页/试炼页共用） -->
    <CombatPanel />

    <!-- 祝福池 -->
    <div class="card rz-card">
      <div class="rz-h">🎁 祝福池（{{ REALM_BUFFS.length }} 项 · 每层 3 选 1 · 可叠加）</div>
      <div class="rz-grid">
        <div v-for="b in REALM_BUFFS" :key="b.id" class="rz-buff">
          <strong>{{ b.name }}</strong>
          <span class="dim">{{ b.desc }}</span>
        </div>
      </div>
    </div>

    <!-- 结算阶梯 -->
    <div class="card rz-card">
      <div class="rz-h">🏅 结算奖励（按通过层数）</div>
      <div class="rz-table">
        <div class="rz-th"><span>通过层数</span><span>金币</span><span>额外</span></div>
        <div v-for="r in rewardTable" :key="r.floor" class="rz-tr">
          <span class="mono">通过 {{ r.floor }} 层</span>
          <span class="mono">{{ r.gold.toLocaleString() }}</span>
          <span class="dim">{{ r.items }}</span>
        </div>
      </div>
      <p class="dim rz-sub">金币会再乘上本局的「金玉满堂」加成；神秘调料自第 5 层起、能量饼干自第 10 层起发放。</p>
    </div>

    <!-- 玩法说明 -->
    <div class="card rz-card">
      <div class="rz-h">📖 规则速览</div>
      <ul class="rz-rules">
        <li>对手由 <code>opp()</code> 动态生成（与试炼塔同模式），<b>不占用</b>对决区域与首领的固定数据。</li>
        <li>每层胜利后 <b>3 选 1</b> 祝福，选中即生效并立刻开打下一层。</li>
        <li>祝福<b>只在本局有效</b>，结算或阵亡后全部清零。</li>
        <li>本局中途切到别的页面不会中断（战斗与层数都记在存档里），回到本页继续。</li>
        <li>历史最佳层数会记进<b>年鉴</b>与<b>统计</b>页。</li>
      </ul>
    </div>

    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.rz-sub {
  font-size: 12px;
  line-height: 1.6;
  margin-top: 8px;
}
.rz-card {
  margin-top: 12px;
}
.rz-h {
  font-weight: 600;
}
.rz-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 6px;
  margin-top: 8px;
}
.rz-buff {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  padding: 6px 9px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.rz-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  font-size: 13px;
}
.rz-th,
.rz-tr {
  display: grid;
  grid-template-columns: 100px 1fr 1.4fr;
  gap: 10px;
  align-items: center;
  padding: 5px 8px;
  border-radius: 6px;
}
.rz-th {
  font-size: 12px;
  color: var(--muted);
  border-bottom: 1px dashed var(--border);
}
.rz-tr {
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.rz-rules {
  margin: 8px 0 0;
  padding-left: 20px;
  font-size: 12px;
  line-height: 1.8;
}
</style>
