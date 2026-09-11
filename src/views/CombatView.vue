<script setup>
// 料理对决视图 — 需求文档 §4 / §9.1.2
// 对决风格选择（§4.3）、属性面板（§4.2）、对手区域与 首领（§4.4）、
// 自动回合战斗、战斗日志、道具使用（§4.5：料理/酱料/饮品）
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getCombat } from '../game/combat/Combat.js'
import { EventBus } from '../game/core/EventBus.js'
import { STYLE_ADVANTAGE, COMBAT_REGIONS, COMBAT_BOSSES } from '../game/data/combat.js'
import { getItem, itemName } from '../game/data/items.js'
import CombatPanel from '../components/CombatPanel.vue'

const player = usePlayerStore()
const ui = useUiStore()
const combat = getCombat()

const selectedRegion = ref(0)
const persistent = ref(false) // 持久战：胜利后自动挑战下一个对手（区域顺序循环）
const hardMode = ref(false) // 困难模式（2026-09-06）：BOSS 属性 ×1.5 + 首杀额外奖励
const combatLevel = computed(() => player.combatLevel)
const inFight = computed(() => combat?.inFight ?? false)
// 战斗帧：依赖全局引擎循环计数（ui.loopTick），每 tick 重算 → 对战框逐帧刷新
// （combat 实例属性非响应式，必须包成响应式帧才能实时显示 生命值/回合/日志变化）
const battleFrame = computed(() => {
  ui.loopTick
  return {
    inFight: combat?.inFight ?? false,
    result: combat?.result ?? null,
    opponentName: combat?.opponent?.name ?? '',
    opponentHp: combat?.opponentHp ?? 0,
    opponentHpMax: combat?.opponent?.hp ?? 1,
    playerHp: player.combat.hp,
    playerHpMax: player.maxHp,
    turn: combat?.turnCount ?? 0,
    turnPct: combat?.inFight ? Math.min(1, (combat.turnTimer ?? 0) / Math.max(1, combat.playerStats().speedMs)) : 0,
    turnStartAt: combat?.inFight ? (combat.turnStartAt ?? performance.now()) : 0,
    turnSpeedMs: combat?.inFight ? Math.max(1, combat.playerStats().speedMs) : 0,
    turnSpeedSec: combat?.inFight ? (combat.playerStats().speedMs / 1000).toFixed(1) : '0.0',
    log: combat?.log ?? [],
  }
})

// ── 食神秘境（2026-09-11 独立成页，界面在 views/MysticRealmView.vue）──
// 本页只做两件事：① 顶部状态条（是否进行中 / 历史最佳）② combat:end 的秘境分支——
// 本局开打后若玩家切到对决页，胜利/失败仍需推进或结算，否则本局会卡住。
const realmStat = computed(() => {
  ui.loopTick
  return player.realmState()
})

// ── 持久战：胜利后自动重新挑战当前敌人 ──
// 监听随组件挂载注册、卸载解除（避免每次进出对决页叠加一个永不解除的 combat:end 监听）
let persistOff = null
onMounted(() => {
  persistOff = EventBus.on('combat:end', ({ result }) => {
    // 食神秘境（2026-09-09）：秘境局内由 realm 流程接管，不走持久战
    if (player.realmState().active) {
      if (result === 'win') player.realmAdvance()
      else player.realmEnd()
      return
    }
    if (result === 'win' && persistent.value && combat) {
      setTimeout(() => startNextOpponent(), 500) // 小延迟，让胜利结算/日志先落
    }
  })
})
onBeforeUnmount(() => {
  persistOff?.()
  persistOff = null
})
function togglePersistent() {
  persistent.value = !persistent.value
  if (persistent.value) ui.pushLog('⚡ 持久战开启：胜利后自动重新挑战当前敌人', 'info')
  else ui.pushLog('持久战关闭', 'info')
}
function startNextOpponent() {
  if (!persistent.value || !combat) return
  const o = combat?.opponent // 当前选中的敌人（胜利后 opponent 引用保留）
  if (!o) return
  if (player.combat.hp <= 0) player.setCombat({ hp: player.maxHp })
  combat.start(o) // 持续攻击同一个敌人
  ui.pushLog(`⚔️ 持久战：继续挑战 ${o.name}（L${o.level}）`, 'info')
}
function regionUnlocked(r) {
  return combatLevel.value >= r.reqLevel
}
function bossUnlocked(b) {
  return combatLevel.value >= b.level
}
function advantageText(style, oppStyle) {
  if (STYLE_ADVANTAGE[style] === oppStyle) return '（克制）'
  if (STYLE_ADVANTAGE[oppStyle] === style) return '（被克制）'
  return ''
}
function startFight(opponent) {
  if (player.combat.hp <= 0) player.setCombat({ hp: player.maxHp })
  let o = opponent
  // 困难模式（2026-09-06）：BOSS 属性 ×1.5 运行时副本；首杀额外奖励，不占 BOSS 击杀口径
  if (hardMode.value && opponent.isBoss) {
    o = {
      ...opponent,
      isHard: true,
      isBoss: false,
      name: `${opponent.name}·困难`,
      hp: Math.round(opponent.hp * 1.5),
      atk: opponent.atk * 1.5,
      def: Math.round(opponent.def * 1.5),
      eva: opponent.eva + 3,
    }
  }
  combat.start(o)
  ui.pushLog(`⚔️ 对决开始：${o.name}${o.isHard ? '（🔥 困难）' : ''}`, 'info')
}
const MECH_LABEL = { regen: '回血', slowEvery: '降攻速', burn: '灼烧', poison: '中毒', instantKill: '秒杀', randomStyle: '随机风格', phases: '三阶段' }
function mechText(b) {
  const ms = []
  for (const [k, v] of Object.entries(b.mechanic ?? {})) {
    if (k === 'slowEvery') ms.push(`每${v}回合降攻速`)
    else if (MECH_LABEL[k]) ms.push(MECH_LABEL[k])
  }
  if (b.crit && b.crit > 0.04) ms.push(`暴击 ${Math.round(b.crit * 100)}%`)
  if (b.speedMs && b.speedMs < 2400 - b.level * 8 - 50) ms.push(`攻速 ${b.speedMs}ms`)
  return ms.join('、') || '—'
}
function openDrops(unit) {
  if (!unit?.drops?.length) return
  dropModal.value = { name: unit.name, drops: unit.drops }
}
function closeDrops() {
  dropModal.value = null
}
</script>

<template>
  <div class="combat-view">
    <!-- 食神秘境已独立成页（2026-09-11）；本局进行中时这里只给状态与入口 -->
    <div class="card realm-card">
      <div class="realm-head">
        <h3>🏯 食神秘境</h3>
        <span class="dim">逐层挑战随机对手，每胜一层 3 选 1 临时增益（仅本局生效）；阵亡按层数结算奖励</span>
        <div class="realm-head-right">
          <span v-if="realmStat.best" class="dim">历史最佳 {{ realmStat.best }} 层</span>
          <span v-if="realmStat.active" class="badge badge-on">进行中 · 第 {{ realmStat.floor + 1 }} 层</span>
          <button class="btn btn-sm btn-primary" @click="ui.setView('realm')">
            {{ realmStat.active ? '回到秘境' : '进入秘境' }} ↗
          </button>
        </div>
      </div>
    </div>

    <!-- 对决面板（风格+属性组合框 / 对决框）：与厨神试炼页共用 CombatPanel -->
    <CombatPanel />

    <!-- 对手选择（§4.4） -->
    <div class="card">
      <h3 class="target-head-row">
        <span>对决区域</span>
        <button class="btn btn-sm" :class="{ 'btn-primary': persistent }" @click="togglePersistent()">
          {{ persistent ? '⚡ 持久战中（胜利自动续战）' : '持久战' }}
        </button>      </h3>
      <div class="region-tabs">
        <button
          v-for="(r, i) in COMBAT_REGIONS"
          :key="r.id"
          class="btn btn-sm"
          :class="{ 'btn-primary': selectedRegion === i, locked: !regionUnlocked(r) }"
          :disabled="!regionUnlocked(r)"
          @click="selectedRegion = i"
        >
          {{ r.name }}{{ !regionUnlocked(r) ? `（对决${r.reqLevel}级解锁）` : '' }}
        </button>
      </div>
      <div class="gather-grid">
        <div
          v-for="o in COMBAT_REGIONS[selectedRegion].opponents"
          :key="o.id"
          v-tilt
          class="gather-card"
          @click="openDrops(o)"
          style="cursor: pointer"
        >
          <div class="gather-card-head">
            <strong>{{ o.name }}</strong>
            <span class="dim mono" style="font-size: 12px">Lv{{ o.level }}</span>
          </div>
          <div class="gather-card-row"><span>风格</span><span>{{ o.styleName }}{{ advantageText(player.combat.style, o.style) }}</span></div>
          <div class="gather-card-row"><span>生命值</span><span class="mono">{{ o.hp }}</span></div>
          <div class="gather-card-row"><span>攻击</span><span class="mono">{{ Math.round(o.atk) }}</span></div>
          <div class="gather-card-row"><span>防御</span><span class="mono">{{ Math.round(o.def) }}</span></div>
          <div class="gather-card-row"><span>命中 / 闪避</span><span class="mono">{{ Math.round(o.acc) }} / {{ Math.round(o.eva) }}</span></div>
          <div class="gather-card-row"><span>暴击</span><span class="mono">{{ (o.crit * 100).toFixed(1) }}%</span></div>
          <button class="btn btn-sm btn-primary" :disabled="battleFrame.inFight" @click.stop="startFight(o)">对决</button>
        </div>
      </div>

      <h3 style="margin-top: 12px">首领
        <button class="btn btn-sm" :class="{ 'btn-primary': hardMode }" style="margin-left: 8px" @click="hardMode = !hardMode">
          {{ hardMode ? '🔥 困难模式开' : '困难模式' }}
        </button>
      </h3>
      <p class="dim" style="margin: 4px 0 8px">🔥 困难模式：点亮后挑战任一首领，其属性 ×1.5（生命/攻击/防御/闪避）、掉落照常；每个首领的困难首杀额外 +（50+等级×10）金币，不计入普通击杀/赛季任务进度。装备成型后可冲击「食神之巅」成就（28 困难首杀）。</p>
      <div class="gather-grid">
        <div
          v-for="b in COMBAT_BOSSES"
          :key="b.id"
          v-tilt
          class="gather-card boss-card"
          :class="{ locked: !bossUnlocked(b) }"
          @click="openDrops(b)"
          style="cursor: pointer"
        >
          <div class="gather-card-head">
            <strong>👑 {{ b.name }}</strong>
            <span class="dim mono" style="font-size: 12px">Lv{{ b.level }}</span>
          </div>
          <div class="gather-card-row"><span>风格</span><span>{{ b.styleName }}<template v-if="!bossUnlocked(b)">（对决{{ b.level }}级解锁）</template></span></div>
          <div class="gather-card-row"><span>生命值</span><span class="mono">{{ b.hp }}</span></div>
          <div class="gather-card-row"><span>攻击</span><span class="mono">{{ Math.round(b.atk) }}</span></div>
          <div class="gather-card-row"><span>防御</span><span class="mono">{{ b.def }}</span></div>
          <div class="gather-card-row"><span>机制</span><span class="dim" style="font-size: 12px">{{ mechText(b) }}</span></div>
          <button class="btn btn-sm btn-danger" :disabled="battleFrame.inFight || !bossUnlocked(b)" @click.stop="startFight(b)">挑战</button>
        </div>
      </div>
    </div>

    <!-- 掉落弹窗：点击敌人/首领卡片查看掉落 -->
    <Teleport to="body">
      <div v-if="dropModal" class="modal-backdrop" @click.self="closeDrops">
        <div class="modal eq-modal">
          <header class="modal-head">
            <h3>💧 {{ dropModal.name }} · 掉落</h3>
            <button class="btn btn-sm" @click="closeDrops">✕</button>
          </header>
          <div class="item-detail-body">
            <div v-for="(d, di) in dropModal.drops" :key="di" class="drop-line">
              <span>{{ getItem(d.itemId)?.name }}</span>
              <span class="dim mono">{{ Math.round(d.chance * 100) }}%</span>
            </div>
            <p v-if="!dropModal.drops.length" class="dim">该敌人无额外掉落。</p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
