<script setup>
// 无尽挑战塔 — 对决 99 解锁的毕业长期目标（2026-09-06）
// 与对决页同款体验：风格选择 + 属性面板 + 对决框（血条/回合/道具/日志）
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getCombat } from '../game/combat/Combat.js'
import CombatPanel from '../components/CombatPanel.vue'
import CombatLog from '../components/CombatLog.vue'
import { EventBus } from '../game/core/EventBus.js'
import { STYLE_INFO } from '../game/data/combat.js'
import { sfx } from '../game/core/sound.js'
import { towerFloorName, towerMilestone, TOWER_UNLOCK_LEVEL, TOWER_TIERS, TOWER_FLOOR_DROP_FROM } from '../game/data/battleTower.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()
const combat = getCombat()

const fighting = ref(false)
const autoNext = ref(true) // 胜利自动爬下一层
const lastFloor = ref(1)

const STYLES = ['knife', 'plating', 'flavor']
const BUFF_LABEL = { atk: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', speed: '攻速', duration: '持续' }

const floor = computed(() => Math.max(1, player.tower?.floor ?? 1))
const best = computed(() => player.tower?.best ?? 0)
/** 当前难度档（2026-09-22）：标准 / 精英×1.5 / 极限×2 —— 只影响之后的战斗与里程碑奖励 */
const tier = computed(() => player.towerTier())
const unlocked = computed(() => player.towerUnlocked())
const combatLevel = computed(() => player.combatLevel)
const pStats = computed(() => combat?.playerStats() ?? {})
const inFight = computed(() => combat?.inFight ?? false)
const oppPreview = computed(() => (unlocked.value ? player.towerOpp() : null))
// 当前出站食灵的对决加成
const spiritCombat = computed(() => {
  const e = player.spiritEffects?.() ?? {}
  const style = player.combat?.style
  const styleDmg = e.styleDmgPct?.[style] ?? 0
  return {
    dmgPct: (e.dmgPct ?? 0) + styleDmg,
    styleDmg,
    healPerTurn: e.healPerTurnPct ?? 0,
    loseHp: e.loseHpPerTurnPct ?? 0,
    any: ((e.dmgPct ?? 0) + styleDmg + (e.healPerTurnPct ?? 0) + (e.loseHpPerTurnPct ?? 0)) !== 0,
  }
})

// 战斗帧（依赖全局循环计数逐帧刷新，同对决页）
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

// 道具（与对决页同源）

// 命中音效（节流）
let lastHitAt = 0
watch(
  () => battleFrame.value?.turn ?? 0,
  (t, old) => {
    if (t > old && player.settings.soundEnabled && Date.now() - lastHitAt > 400) {
      lastHitAt = Date.now()
      sfx.hit()
    }
  },
)

function setStyle(style) { player.setCombatStyle(style) }
function buffText() {
  const b = combat.buffs ?? {}
  return Object.entries(b).filter(([k]) => k !== 'duration').map(([k, v]) => `${BUFF_LABEL[k] ?? k} +${v}`).join('、') || '—'
}
function startFight() {
  if (fighting.value || !unlocked.value || combat?.inFight) return
  lastFloor.value = floor.value
  const o = player.towerOpp()
  if (player.combat.hp <= 0) player.setCombat({ hp: player.maxHp })
  combat.start(o)
  fighting.value = true
  ui.pushLog(`🗼 挑战 ${towerFloorName(lastFloor.value)}（守塔人 L${o.level}）`, 'info')
}
function stopFight() {
  fighting.value = false
  combat?.stop()
}
function handleCombatEnd({ result }) {
  if (!fighting.value) return
  fighting.value = false
  if (result === 'win') {
    const t = player.onTowerWin(lastFloor.value)
    ui.pushLog(`🗼 通过第 ${lastFloor.value} 层！（已过最高 ${t.best} 层）`, 'levelup')
    if (autoNext.value && unlocked.value) setTimeout(() => { if (!fighting.value && !combat?.inFight) startFight() }, 500)
  } else {
    // 失败代价（2026-09-22）：从第 5 层起**退回上一层**（best 纪录永不回退）
    const r = player.onTowerLose(lastFloor.value)
    ui.pushLog(
      r.dropped
        ? `🗼 被第 ${lastFloor.value} 层守塔人击退 —— 退回第 ${r.floor} 层，重打一次就能再上来`
        : `🗼 被第 ${lastFloor.value} 层守塔人击退……可继续挑战（第 ${TOWER_FLOOR_DROP_FROM} 层起被击退会退一层）`,
      'warn',
    )
  }
}
onMounted(() => EventBus.on('combat:end', handleCombatEnd))
onBeforeUnmount(() => { EventBus.off?.('combat:end', handleCombatEnd); fighting.value = false; combat?.stop() })

// 里程碑预览（最近 5 档）
// 里程碑按**当前档位的奖励倍率**预览（与发奖同一个函数、同一个倍率）
const milestones = computed(() => [1, 2, 3, 4, 5].map((i) => towerMilestone(i * 10, tier.value.rewardMult)).filter(Boolean))
function setTier(id) {
  if (player.tower?.tier === id) return
  const t = player.setTowerTier(id)
  ui.pushLog(`🗼 挑战塔难度档改为「${t.name}」：守塔人属性 ×${t.mult}，里程碑金币与券 ×${t.rewardMult}（已领里程碑按档分别记账）`, 'info')
}
function fmt(g) { return g.toLocaleString() }
</script>

<template>
  <div class="combat-view">
    <header class="skill-head">
      <div>
        <h2>🗼 无尽挑战塔</h2>
        <p class="dim">
          对决等级 {{ TOWER_UNLOCK_LEVEL }} 解锁 · 每 4 层对手 +1 级、属性逐层上浮 · 每 10 层里程碑奖励 · 胜利自动爬楼。
          <b>难度档自选</b>（见下）：标准 / 精英 ×1.5 / 极限 ×2，奖励随档位放大；
          第 {{ TOWER_FLOOR_DROP_FROM }} 层起<b>被击退会退回一层</b>（最高层纪录不回退）。
        </p>
      </div>
    </header>

    <template v-if="unlocked">
      <!-- 两栏外壳（2026-09-20 与对决页同步）：左＝战斗区，右＝详情 + 装备槽 -->
      <div class="combat-page">
        <div class="combat-page-main">
          <!-- 战斗屏 + 日志/战备 + 风格/属性（与对决页共用同一组件，不再各写一份） -->
          <CombatPanel />

      <!-- 难度档（2026-09-22）：把「后期难度」做成玩家自选，而不是全局抬高敌人数值 -->
      <div class="card tower-tiers">
        <div class="tower-tier-row">
          <span class="dim">难度档：</span>
          <button
            v-for="t in TOWER_TIERS"
            :key="t.id"
            class="btn btn-sm"
            :class="{ 'btn-primary': tier.id === t.id }"
            :title="t.desc"
            @click="setTier(t.id)"
          >{{ t.icon }} {{ t.name }}<template v-if="t.mult > 1"> ×{{ t.mult }}</template></button>
          <span class="dim" :title="tier.desc">{{ tier.desc }}</span>
        </div>
        <p class="dim tower-tier-hint">
          档位只改守塔人属性与里程碑倍率，<b>不改你已过的最高层</b>；里程碑按档<b>分别记账</b> ⇒
          用标准档推深度、再用高难档把已经打得过的层按更高倍率领一遍，是后期多拿一份奖励的常规玩法。
          高难档的墙会明显前移（实测满配：标准 ≈F1100、精英 ≈F800、极限 ≈F450），所以别指望在极限档推得比标准更深。
        </p>
      </div>

      <!-- 塔状态条：当前层 / 最高层 / 守塔人 / 挑战按钮 -->
      <div class="card quick-status tower-top">
        <div class="quick-group">
          <div class="quick-group-title">当前层 · {{ towerFloorName(floor) }}</div>
          <div class="quick-group-body">
            <div class="quick-item">
              <span class="quick-item-text">
                第 {{ floor }} 层 · 守塔人 L{{ oppPreview?.level }} · HP {{ fmt(oppPreview?.hp ?? 0) }}
                <template v-if="tier.mult > 1">（{{ tier.icon }} ×{{ tier.mult }} 档已计入）</template>
                · 已过最高 {{ best }} 层
              </span>
              <button v-if="!battleFrame.inFight && !fighting" class="btn btn-sm btn-primary" @click="startFight">⚔️ 挑战</button>
              <button v-else class="btn btn-sm btn-danger" @click="stopFight">停止</button>
              <button class="btn btn-sm" :class="{ 'btn-primary': autoNext }" @click="autoNext = !autoNext">{{ autoNext ? '⚡自动爬楼' : '手动' }}</button>
            </div>
          </div>
        </div>
      </div>

          <!-- 里程碑 -->
      <div class="card">
        <h3>🏅 里程碑（每 10 层一次，跨层自动发放）</h3>
        <div class="tower-milestones">
          <div v-for="m in milestones" :key="m.floor" class="tower-ms" :class="{ got: player.towerMilestoneClaimed(m.floor) }">
            <strong>第 {{ m.floor }} 层</strong>
            <span class="dim">+{{ fmt(m.gold) }} 金<template v-for="(q, id) in m.items" :key="id"> · {{ id === 'energyBiscuit' ? '能量饼干' : '神秘调料' }} ×{{ q }}</template></span>
            <span v-if="player.towerMilestoneClaimed(m.floor)" class="badge badge-on">已领（{{ tier.name }}档）</span>
          </div>
        </div>
            <p class="dim">100 层后进入「厨神之路」与「轮回饕餮殿」，难度继续无限爬升。</p>
          </div>
        </div>

        <!-- 右栏：战斗日志（2026-09-21 与「装备」互换位置：日志搬到右栏，装备回左栏与战备同屏） -->
        <aside class="combat-page-side">
          <CombatLog />
        </aside>
      </div>
    </template>

    <div v-else class="card placeholder">
      <p class="dim">🗼 挑战塔尚未开启——达到对决等级 {{ TOWER_UNLOCK_LEVEL }} 后开放（中后期起的主战场，塔深无限）。</p>
    </div>
  </div>
</template>

<style scoped>
/* 日志与战备并排（与对决页同一版式） */
.combat-bottom {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
@media (max-width: 900px) {
  .combat-bottom {
    grid-template-columns: minmax(0, 1fr);
  }
}
.tower-top { margin-bottom: 0; }
.tower-tiers { padding: 10px 14px; }
.tower-tier-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; }
.tower-tier-hint { margin: 8px 0 0; font-size: 12px; line-height: 1.65; }
.tower-milestones { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin-top: 8px; }
.tower-ms { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; background: rgba(var(--glass-rgb), 0.6); border: 1px solid rgba(var(--primary-tint-rgb), 0.18); font-size: 12px; }
.tower-ms.got { border-color: var(--good); background: rgba(var(--good-rgb), 0.08); }
</style>
