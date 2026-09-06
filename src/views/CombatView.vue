<script setup>
// 料理对决视图 — 需求文档 §4 / §9.1.2
// 对决风格选择（§4.3）、属性面板（§4.2）、对手区域与 首领（§4.4）、
// 自动回合战斗、战斗日志、道具使用（§4.5：料理/酱料/饮品）
import { computed, ref, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getCombat } from '../game/combat/Combat.js'
import { EventBus } from '../game/core/EventBus.js'
import { STYLE_INFO, STYLE_ADVANTAGE, COMBAT_REGIONS, COMBAT_BOSSES } from '../game/data/combat.js'
import { getItem, itemName } from '../game/data/items.js'
import { sfx } from '../game/core/sound.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()
const combat = getCombat()

const selectedRegion = ref(0)
const persistent = ref(false) // 持久战：胜利后自动挑战下一个对手（区域顺序循环）
const hardMode = ref(false) // 困难模式（2026-09-06）：BOSS 属性 ×1.5 + 首杀额外奖励
const combatLevel = computed(() => player.combatLevel)
const pStats = computed(() => combat?.playerStats() ?? {})
const inFight = computed(() => combat?.inFight ?? false)
// 当前出站食灵的对决加成（§3.3.6）：在对决属性区明显展示
const spiritCombat = computed(() => {
  const e = player.spiritEffects?.() ?? {}
  const style = player.combat?.style
  const styleDmg = (e.styleDmgPct?.[style] ?? 0)
  return {
    dmgPct: (e.dmgPct ?? 0) + styleDmg,
    styleDmg,
    healPerTurn: e.healPerTurnPct ?? 0,
    loseHp: e.loseHpPerTurnPct ?? 0,
    any: ((e.dmgPct ?? 0) + styleDmg + (e.healPerTurnPct ?? 0) + (e.loseHpPerTurnPct ?? 0)) !== 0,
  }
})

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
    turnSpeedSec: combat?.inFight ? (combat.playerStats().speedMs / 1000).toFixed(2) : '0.00',
    log: combat?.log ?? [],
  }
})

const availableFoods = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.type === 'food' && getItem(id).heal)
    .map(([id, q]) => ({ id, qty: q, item: getItem(id) }))
    .sort((a, b) => b.item.heal - a.item.heal)
)

// 回合命中音效（节流 400ms）— battleFrame 已定义
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

// ── 持久战：胜利后自动重新挑战当前敌人 ──
let persistListenerRegistered = false
if (!persistListenerRegistered) {
  persistListenerRegistered = true // 模块级去重
  EventBus.on('combat:end', ({ result }) => {
    if (result === 'win' && persistent.value && combat) {
      setTimeout(() => startNextOpponent(), 500) // 小延迟，让胜利结算/日志先落
    }
  })
}
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
const availableSauces = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.buff)
    .map(([id, q]) => ({ id, qty: q, item: getItem(id) }))
)
const availableDrinks = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.type === 'drink')
    .map(([id, q]) => ({ id, qty: q, item: getItem(id) }))
)

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
function stopFight() {
  combat.stop()
}
// 掉落弹窗：点击敌人/首领卡片查看掉落
const dropModal = ref(null) // { name, drops }
function openDrops(unit) {
  if (!unit?.drops?.length) return
  dropModal.value = { name: unit.name, drops: unit.drops }
}
function closeDrops() {
  dropModal.value = null
}
function useItem(kind, id) {
  if (kind === 'food') combat.useFood(id)
  else if (kind === 'sauce') combat.useSauce(id)
  else if (kind === 'drink') combat.useDrink(id)
  else if (kind === 'spice') combat.useMysterySpice()
}
function setStyle(style) {
  player.setCombatStyle(style)
}

const STYLES = ['knife', 'plating', 'flavor']
const BUFF_LABEL = { atk: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', speed: '攻速', duration: '持续' }
function buffText() {
  const b = combat.buffs ?? {}
  return Object.entries(b).filter(([k]) => k !== 'duration').map(([k, v]) => `${BUFF_LABEL[k] ?? k} +${v}`).join('、') || '—'
}
</script>

<template>
  <div class="combat-view">
    <!-- 组合框：左「对决风格」+ 中间虚线 + 右「属性面板」 -->
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
          <div class="stat"><div class="stat-num mono">{{ pStats.maxHp }}</div><div class="stat-label">最大品鉴值</div></div>
          <div class="stat"><div class="stat-num mono">{{ pStats.attack.toFixed(2) }}</div><div class="stat-label">攻击伤害</div></div>
          <div class="stat"><div class="stat-num mono">{{ pStats.accuracy.toFixed(2) }}</div><div class="stat-label">准确率</div></div>
          <div class="stat"><div class="stat-num mono">{{ pStats.defense.toFixed(2) }}</div><div class="stat-label">防御力</div></div>
          <div class="stat"><div class="stat-num mono">{{ pStats.evasion.toFixed(2) }}</div><div class="stat-label">闪避率</div></div>
          <div class="stat"><div class="stat-num mono">{{ (pStats.critChance * 100).toFixed(2) }}%</div><div class="stat-label">暴击率</div></div>
          <div class="stat"><div class="stat-num mono">{{ (pStats.speedMs / 1000).toFixed(2) }}s</div><div class="stat-label">回合间隔</div></div>
          <div class="stat"><div class="stat-num mono">{{ pStats.flavorEnergy }}</div><div class="stat-label">调味能量</div></div>
        </div>
        <p class="dim" style="margin-top: 4px">调味冲击每次消耗 10 调味能量；每回合自动回复 +5，战斗中喝果茶/香草茶可大幅恢复（调酒制作）。</p>
        <p v-if="spiritCombat.any" class="dim spirit-combat-bonus">
          <span class="badge badge-on">食灵对决加成</span>
          <span v-if="spiritCombat.dmgPct">伤害 +{{ spiritCombat.dmgPct }}%</span>
          <span v-if="spiritCombat.healPerTurn">每回合回血 +{{ spiritCombat.healPerTurn }}%</span>
          <span v-if="spiritCombat.loseHp" class="warn-text">每回合损血 -{{ spiritCombat.loseHp }}%</span>
        </p>
        <p v-if="combat?.buffTurns > 0" class="dim">增益 {{ combat.buffTurns }} 回合：{{ buffText() }}</p>
        <p v-if="combat?.drunkTurns > 0" class="dim warn-text">🥴 醉酒中（命中 -15%）：{{ combat.drunkTurns }} 回合</p>
        <p v-if="player.combat.style === 'plating'" class="dim">🎨 装饰食材：<span class="mono">{{ player.inventory.garnish ?? 0 }}</span>（每次攻击消耗 1 个，杂货铺有售）</p>
      </div>
    </div>

    <!-- 战斗框（常驻：战斗中显示战斗；否则待机提示） -->
    <div class="card combat-battle">
      <template v-if="battleFrame.inFight || battleFrame.result">
        <div class="battle-split">
          <!-- 左半边：战斗 -->
          <div class="battle-left">
            <h3>对决中（第 {{ battleFrame.turn }} 回合）</h3>
            <div class="hp-row">
              <div class="hp-col">
                <div class="hp-label"><strong>你</strong> <span class="mono">{{ battleFrame.playerHp }} / {{ battleFrame.playerHpMax }}</span></div>
                <div class="hp-bar"><div class="hp-fill" :class="{ low: battleFrame.playerHp / battleFrame.playerHpMax < 0.3 }" :style="{ width: Math.max(0, battleFrame.playerHp / battleFrame.playerHpMax * 100) + '%' }"></div></div>
              </div>
              <div class="hp-col">
                <div class="hp-label"><strong>{{ battleFrame.opponentName }}</strong> <span class="mono">{{ battleFrame.opponentHp }} / {{ battleFrame.opponentHpMax }}</span></div>
                <div class="hp-bar opp"><div class="hp-fill opp" :style="{ width: Math.max(0, battleFrame.opponentHp / battleFrame.opponentHpMax * 100) + '%' }"></div></div>
              </div>
            </div>

            <!-- 回合间隔进度条（距下一回合） -->
            <div class="turn-progress">
              <span class="dim">回合间隔 {{ battleFrame.turnSpeedSec }}s</span>
              <ProgressBar :start-at="battleFrame.inFight ? battleFrame.turnStartAt : null" :duration-ms="battleFrame.turnSpeedMs" :active="battleFrame.inFight" />
            </div>

            <!-- 结果 -->
            <div v-if="battleFrame.result === 'win'" class="combat-result win">🏆 胜利！</div>
            <div v-else-if="battleFrame.result === 'lose'" class="combat-result lose">💀 战败</div>

            <!-- 道具使用（§4.5） -->
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
            <button class="btn btn-sm" @click="stopFight()" style="margin-top: auto">停止对决</button>
          </div>

          <div class="battle-divider"></div>

          <!-- 右半边：战斗情况（日志） -->
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
          <span class="dim">选择对手开始料理对决（自动回合制，2.4s/回合）</span>
        </div>
      </template>
    </div>

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
            <span class="dim mono" style="font-size: 11px">Lv{{ o.level }}</span>
          </div>
          <div class="gather-card-row"><span>风格</span><span>{{ o.styleName }}{{ advantageText(player.combat.style, o.style) }}</span></div>
          <div class="gather-card-row"><span>生命值</span><span class="mono">{{ o.hp }}</span></div>
          <div class="gather-card-row"><span>攻击</span><span class="mono">{{ o.atk.toFixed(1) }}</span></div>
          <div class="gather-card-row"><span>防御</span><span class="mono">{{ o.def.toFixed(2) }}</span></div>
          <div class="gather-card-row"><span>命中 / 闪避</span><span class="mono">{{ o.acc.toFixed(2) }} / {{ o.eva.toFixed(2) }}</span></div>
          <div class="gather-card-row"><span>暴击</span><span class="mono">{{ (o.crit * 100).toFixed(2) }}%</span></div>
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
            <span class="dim mono" style="font-size: 11px">Lv{{ b.level }}</span>
          </div>
          <div class="gather-card-row"><span>风格</span><span>{{ b.styleName }}<template v-if="!bossUnlocked(b)">（对决{{ b.level }}级解锁）</template></span></div>
          <div class="gather-card-row"><span>生命值</span><span class="mono">{{ b.hp }}</span></div>
          <div class="gather-card-row"><span>攻击</span><span class="mono">{{ b.atk.toFixed(1) }}</span></div>
          <div class="gather-card-row"><span>防御</span><span class="mono">{{ b.def }}</span></div>
          <div class="gather-card-row"><span>机制</span><span class="dim" style="font-size: 11px">{{ mechText(b) }}</span></div>
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
