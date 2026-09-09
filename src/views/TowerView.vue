<script setup>
// 无尽挑战塔 — 对决 99 解锁的毕业长期目标（2026-09-06）
// 与对决页同款体验：风格选择 + 属性面板 + 对决框（血条/回合/道具/日志）
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getCombat } from '../game/combat/Combat.js'
import { EventBus } from '../game/core/EventBus.js'
import { STYLE_INFO } from '../game/data/combat.js'
import { getItem } from '../game/data/items.js'
import { sfx } from '../game/core/sound.js'
import { towerFloorName, towerMilestone, TOWER_UNLOCK_LEVEL } from '../game/data/battleTower.js'
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
const availableFoods = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.type === 'food' && getItem(id).heal)
    .map(([id, q]) => ({ id, qty: q, item: getItem(id) }))
    .sort((a, b) => b.item.heal - a.item.heal)
)
const availableSauces = computed(() =>
  Object.entries(player.inventory).filter(([id, q]) => q > 0 && getItem(id)?.buff).map(([id, q]) => ({ id, qty: q, item: getItem(id) }))
)
const availableDrinks = computed(() =>
  Object.entries(player.inventory).filter(([id, q]) => q > 0 && getItem(id)?.type === 'drink').map(([id, q]) => ({ id, qty: q, item: getItem(id) }))
)

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
function useItem(kind, id) {
  if (kind === 'food') combat.useFood(id)
  else if (kind === 'sauce') combat.useSauce(id)
  else if (kind === 'drink') combat.useDrink(id)
  else if (kind === 'spice') combat.useMysterySpice()
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
    ui.pushLog(`🗼 被第 ${lastFloor.value} 层守塔人击退……可继续挑战`, 'warn')
  }
}
onMounted(() => EventBus.on('combat:end', handleCombatEnd))
onBeforeUnmount(() => { EventBus.off?.('combat:end', handleCombatEnd); fighting.value = false; combat?.stop() })

// 里程碑预览（最近 5 档）
const milestones = computed(() => [1, 2, 3, 4, 5].map((i) => towerMilestone(i * 10)).filter(Boolean))
function fmt(g) { return g.toLocaleString() }
</script>

<template>
  <div class="combat-view">
    <header class="skill-head">
      <div>
        <h2>🗼 无尽挑战塔</h2>
        <p class="dim">对决等级 {{ TOWER_UNLOCK_LEVEL }} 解锁 · 每 4 层对手 +1 级、属性逐层上浮 · 每 10 层里程碑奖励 · 胜利自动爬楼</p>
      </div>
    </header>

    <template v-if="unlocked">
      <!-- 组合框：左「对决风格」+ 中间虚线 + 右「属性面板」（与对决页同款） -->
      <div class="card combat-combo">
        <div class="combo-left">
          <h3>对决风格</h3>
          <div class="style-row">
            <button
              v-for="s in STYLES"
              :key="s"
              class="btn style-btn"
              :class="{ 'btn-primary': player.combat.style === s }"
              @click="setStyle(s)"
            >
              <strong>{{ STYLE_INFO[s].name }}</strong>
              <span class="dim">{{ STYLE_INFO[s].desc }}</span>
            </button>
          </div>
        </div>
        <div class="combo-divider"></div>
        <div class="combo-right">
          <h3>属性面板</h3>
          <div class="stat-row">
            <div class="stat"><div class="stat-num mono">{{ combatLevel }}</div><div class="stat-label">对决等级</div></div>
            <div class="stat"><div class="stat-num mono">{{ Math.round(pStats.maxHp) }}</div><div class="stat-label">最大品鉴值</div></div>
            <div class="stat"><div class="stat-num mono">{{ Math.round(pStats.attack) }}</div><div class="stat-label">攻击伤害</div></div>
            <div class="stat"><div class="stat-num mono">{{ Math.round(pStats.accuracy) }}</div><div class="stat-label">准确率</div></div>
            <div class="stat"><div class="stat-num mono">{{ Math.round(pStats.defense) }}</div><div class="stat-label">防御力</div></div>
            <div class="stat"><div class="stat-num mono">{{ Math.round(pStats.evasion) }}</div><div class="stat-label">闪避率</div></div>
            <div class="stat"><div class="stat-num mono">{{ (pStats.critChance * 100).toFixed(1) }}%</div><div class="stat-label">暴击率</div></div>
            <div class="stat"><div class="stat-num mono">{{ (pStats.speedMs / 1000).toFixed(1) }}s</div><div class="stat-label">回合间隔</div></div>
            <div class="stat"><div class="stat-num mono">{{ pStats.flavorEnergy }}</div><div class="stat-label">调味能量</div></div>
          </div>
          <p class="dim" style="margin-top: 4px">调味冲击每次消耗 10 调味能量；每回合自动回复 +5。（同对决规则）</p>
          <p v-if="spiritCombat.any" class="dim spirit-combat-bonus">
            <span class="badge badge-on">食灵对决加成</span>
            <span v-if="spiritCombat.dmgPct">伤害 +{{ spiritCombat.dmgPct }}%</span>
            <span v-if="spiritCombat.healPerTurn">每回合回血 +{{ spiritCombat.healPerTurn }}%</span>
            <span v-if="spiritCombat.loseHp" class="warn-text">每回合损血 -{{ spiritCombat.loseHp }}%</span>
          </p>
          <p v-if="combat?.buffTurns > 0" class="dim">增益 {{ combat.buffTurns }} 回合：{{ buffText() }}</p>
          <p v-if="combat?.drunkTurns > 0" class="dim warn-text">🥴 醉酒中（命中 -15%）：{{ combat.drunkTurns }} 回合</p>
        </div>
      </div>

      <!-- 塔状态条：当前层 / 最高层 / 守塔人 / 挑战按钮 -->
      <div class="card quick-status tower-top">
        <div class="quick-group">
          <div class="quick-group-title">当前层 · {{ towerFloorName(floor) }}</div>
          <div class="quick-group-body">
            <div class="quick-item">
              <span class="quick-item-text">
                第 {{ floor }} 层 · 守塔人 L{{ oppPreview?.level }} · HP {{ fmt(oppPreview?.hp ?? 0) }} · 已过最高 {{ best }} 层
              </span>
              <button v-if="!battleFrame.inFight && !fighting" class="btn btn-sm btn-primary" @click="startFight">⚔️ 挑战</button>
              <button v-else class="btn btn-sm btn-danger" @click="stopFight">停止</button>
              <button class="btn btn-sm" :class="{ 'btn-primary': autoNext }" @click="autoNext = !autoNext">{{ autoNext ? '⚡自动爬楼' : '手动' }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 战斗框（与对决页同款：血条 / 回合进度 / 结果 / 道具 / 日志） -->
      <div class="card combat-battle">
        <template v-if="battleFrame.inFight || battleFrame.result">
          <div class="battle-split">
            <div class="battle-left">
              <h3>塔中对决（第 {{ battleFrame.turn }} 回合）</h3>
              <div class="hp-row">
                <div class="hp-col">
                  <div class="hp-label"><strong>你</strong> <span class="mono">{{ Math.round(battleFrame.playerHp) }} / {{ Math.round(battleFrame.playerHpMax) }}</span></div>
                  <div class="hp-bar"><div class="hp-fill" :class="{ low: battleFrame.playerHp / battleFrame.playerHpMax < 0.3 }" :style="{ width: Math.max(0, battleFrame.playerHp / battleFrame.playerHpMax * 100) + '%' }"></div></div>
                </div>
                <div class="hp-col">
                  <div class="hp-label"><strong>{{ battleFrame.opponentName }}</strong> <span class="mono">{{ Math.round(battleFrame.opponentHp) }} / {{ Math.round(battleFrame.opponentHpMax) }}</span></div>
                  <div class="hp-bar opp"><div class="hp-fill opp" :style="{ width: Math.max(0, battleFrame.opponentHp / battleFrame.opponentHpMax * 100) + '%' }"></div></div>
                </div>
              </div>
              <div class="turn-progress">
                <span class="dim">回合间隔 {{ battleFrame.turnSpeedSec }}s</span>
                <ProgressBar :start-at="battleFrame.inFight ? battleFrame.turnStartAt : null" :duration-ms="battleFrame.turnSpeedMs" :active="battleFrame.inFight" />
              </div>
              <div v-if="battleFrame.result === 'win'" class="combat-result win">🏆 通过第 {{ lastFloor }} 层！</div>
              <div v-else-if="battleFrame.result === 'lose'" class="combat-result lose">💀 被守塔人击退</div>
              <div class="item-actions">
                <div v-if="availableFoods.length" class="item-group">
                  <span class="dim">料理（回血）</span>
                  <button v-for="f in availableFoods" :key="f.id" class="btn btn-sm" @click="useItem('food', f.id)">
                    {{ f.item.name }} +{{ f.item.heal }} <span class="mono">×{{ f.qty }}</span>
                  </button>
                </div>
                <div v-if="availableSauces.length" class="item-group">
                  <span class="dim">酱料（增益10回合）</span>
                  <button v-for="s in availableSauces" :key="s.id" class="btn btn-sm" @click="useItem('sauce', s.id)">
                    {{ s.item.name }} <span class="mono">×{{ s.qty }}</span>
                  </button>
                </div>
                <div v-if="availableDrinks.length" class="item-group">
                  <span class="dim">饮品</span>
                  <button v-for="d in availableDrinks" :key="d.id" class="btn btn-sm" @click="useItem('drink', d.id)">
                    {{ d.item.name }} <span class="mono">×{{ d.qty }}</span>
                  </button>
                </div>
                <div v-if="(player.inventory.mysterySpice ?? 0) > 0" class="item-group">
                  <button class="btn btn-sm" @click="useItem('spice')">🪄 神秘调料 ×{{ player.inventory.mysterySpice }}</button>
                </div>
              </div>
            </div>
            <div class="battle-divider"></div>
            <div class="battle-right">
              <h4>战斗情况</h4>
              <div class="battle-log">
                <div v-for="(l, i) in [...battleFrame.log].reverse()" :key="i" :class="`log-${l.kind}`">{{ l.text }}</div>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="combat-idle">
            <span class="badge">待机</span>
            <span class="dim">{{ towerFloorName(floor) }} · 点击上方「挑战」开始（{{ player.settings.autoEat ? '自动进食开' : '自动进食关' }}）</span>
          </div>
        </template>
      </div>

      <!-- 里程碑 -->
      <div class="card">
        <h3>🏅 里程碑（每 10 层一次，跨层自动发放）</h3>
        <div class="tower-milestones">
          <div v-for="m in milestones" :key="m.floor" class="tower-ms" :class="{ got: (player.tower.rewarded ?? []).includes(m.floor) }">
            <strong>第 {{ m.floor }} 层</strong>
            <span class="dim">+{{ fmt(m.gold) }} 金<template v-for="(q, id) in m.items" :key="id"> · {{ id === 'energyBiscuit' ? '能量饼干' : '神秘调料' }} ×{{ q }}</template></span>
            <span v-if="(player.tower.rewarded ?? []).includes(m.floor)" class="badge badge-on">已领</span>
          </div>
        </div>
        <p class="dim">100 层后进入「厨神之路」与「轮回饕餮殿」，难度继续无限爬升。</p>
      </div>
    </template>

    <div v-else class="card placeholder">
      <p class="dim">🗼 挑战塔尚未开启——达到对决等级 {{ TOWER_UNLOCK_LEVEL }} 后开放（转生毕业内容）。</p>
    </div>
  </div>
</template>

<style scoped>
.tower-top { margin-bottom: 0; }
.tower-milestones { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin-top: 8px; }
.tower-ms { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(217, 90, 56, 0.18); font-size: 12px; }
.tower-ms.got { border-color: var(--good); background: rgba(92, 184, 92, 0.08); }
</style>
