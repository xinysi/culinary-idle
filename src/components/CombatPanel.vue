<script setup>
// 对决面板（2026-09-10 从 CombatView 抽出）— 「风格+属性组合框」+「对决框（血量/回合/道具/日志）」。
// 供对决页与厨神试炼页共用：两处都直接读 player/ui store 与 getCombat() 单例，样式沿用 main.css 全局类。
import { computed, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getCombat } from '../game/combat/Combat.js'
import { STYLE_INFO } from '../game/data/combat.js'
import { getItem } from '../game/data/items.js'
import { sfx } from '../game/core/sound.js'
import ProgressBar from './ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()
const combat = getCombat()

const STYLES = ['knife', 'plating', 'flavor']
const BUFF_LABEL = { atk: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', speed: '攻速', duration: '持续' }

const combatLevel = computed(() => player.combatLevel)
const pStats = computed(() => combat?.playerStats() ?? {})
const inFight = computed(() => combat?.inFight ?? false)

// 当前出站食灵的对决加成（§3.3.6）：在对决属性区明显展示
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

// 战斗帧：依赖全局引擎循环计数（ui.loopTick），每 tick 重算 → 对战框逐帧刷新
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

const availableFoods = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.type === 'food' && getItem(id).heal)
    .map(([id, q]) => ({ id, qty: q, item: getItem(id) }))
    .sort((a, b) => b.item.heal - a.item.heal)
)
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

// 回合命中音效（节流 400ms）
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

function useItem(kind, id) {
  if (kind === 'food') combat.useFood(id)
  else if (kind === 'sauce') combat.useSauce(id)
  else if (kind === 'drink') combat.useDrink(id)
  else if (kind === 'spice') combat.useMysterySpice()
}
function setStyle(style) {
  player.setCombatStyle(style)
}
function stopFight() {
  combat.stop()
}
function buffText() {
  const b = combat.buffs ?? {}
  return Object.entries(b).filter(([k]) => k !== 'duration').map(([k, v]) => `${BUFF_LABEL[k] ?? k} +${v}`).join('、') || '—'
}
</script>

<template>
  <div>
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
          <div class="stat"><div class="stat-num mono">{{ Math.round(pStats.maxHp) }}</div><div class="stat-label">最大品鉴值</div></div>
          <div class="stat"><div class="stat-num mono">{{ Math.round(pStats.attack) }}</div><div class="stat-label">攻击伤害</div></div>
          <div class="stat"><div class="stat-num mono">{{ Math.round(pStats.accuracy) }}</div><div class="stat-label">准确率</div></div>
          <div class="stat"><div class="stat-num mono">{{ Math.round(pStats.defense) }}</div><div class="stat-label">防御力</div></div>
          <div class="stat"><div class="stat-num mono">{{ Math.round(pStats.evasion) }}</div><div class="stat-label">闪避率</div></div>
          <div class="stat"><div class="stat-num mono">{{ (pStats.critChance * 100).toFixed(1) }}%</div><div class="stat-label">暴击率</div></div>
          <div class="stat"><div class="stat-num mono">{{ (pStats.speedMs / 1000).toFixed(1) }}s</div><div class="stat-label">回合间隔</div></div>
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
                <div class="hp-label"><strong>你</strong> <span class="mono">{{ Math.round(battleFrame.playerHp) }} / {{ Math.round(battleFrame.playerHpMax) }}</span></div>
                <div class="hp-bar"><div class="hp-fill" :class="{ low: battleFrame.playerHp / battleFrame.playerHpMax < 0.3 }" :style="{ width: Math.max(0, battleFrame.playerHp / battleFrame.playerHpMax * 100) + '%' }"></div></div>
              </div>
              <div class="hp-col">
                <div class="hp-label"><strong>{{ battleFrame.opponentName }}</strong> <span class="mono">{{ Math.round(battleFrame.opponentHp) }} / {{ Math.round(battleFrame.opponentHpMax) }}</span></div>
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
  </div>
</template>
