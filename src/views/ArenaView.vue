<script setup>
// 竞技场（多人对决·本地镜像）— 需求文档 §13（可选扩展）
// 真在线 对战 需要后端；此处挑战「其他玩家」镜像，记录连胜与最佳纪录。
// 挑战榜每 5 分钟随机刷新（名字/数值随机，强度不超过玩家对决等级）
import { bindTip } from '../composables/useFixedTooltip.js'
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getCombat } from '../game/combat/Combat.js'
import { EventBus } from '../game/core/EventBus.js'
import { generateArenaOpponents } from '../game/data/arena.js'
import { STYLE_INFO, STYLE_ADVANTAGE } from '../game/data/combat.js'
import { getItem } from '../game/data/items.js'
import { sfx } from '../game/core/sound.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()
const combat = getCombat()

// ── 竞技场属性面板（复用对决页面的对决风格 + 属性面板组合框逻辑）──
const combatLevel = computed(() => player.combatLevel)
const pStats = computed(() => combat?.playerStats() ?? {})
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
const STYLES = ['knife', 'plating', 'flavor']
const BUFF_LABEL = { atk: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', speed: '攻速', duration: '持续' }
function buffText() {
  const b = combat.buffs ?? {}
  return Object.entries(b).filter(([k]) => k !== 'duration').map(([k, v]) => `${BUFF_LABEL[k] ?? k} +${v}`).join('、') || '—'
}
function setStyle(style) {
  player.setCombatStyle(style)
}
function advantageText(style, oppStyle) {
  if (STYLE_ADVANTAGE[style] === oppStyle) return '（克制）'
  if (STYLE_ADVANTAGE[oppStyle] === style) return '（被克制）'
  return ''
}
// 掉落弹窗：点击对手行名字查看掉落
const dropModal = ref(null) // { name, drops }
function openDrops(o) {
  if (!o?.drops?.length) return
  dropModal.value = { name: o.name, drops: o.drops }
}
function closeDrops() {
  dropModal.value = null
}
// 道具使用（复用对决页面：料理/酱料/饮品/神秘调料）
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
function useItem(kind, id) {
  if (kind === 'food') combat.useFood(id)
  else if (kind === 'sauce') combat.useSauce(id)
  else if (kind === 'drink') combat.useDrink(id)
  else if (kind === 'spice') combat.useMysterySpice()
  else if (kind === 'biscuit') combat.useEnergyBiscuit()
}

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

const REFRESH_MS = 5 * 60 * 1000 // 每 5 分钟刷新
// 竞技场状态持久化到 localStorage：切页/页面刷新都不重置倒计时与「已挑战」，到期才刷新榜单
const ARENA_KEY = 'culinary-idle.arena.state'
function loadArenaState() {
  try { return JSON.parse(localStorage.getItem(ARENA_KEY) || 'null') } catch { return null }
}
function saveArenaState(st) {
  localStorage.setItem(ARENA_KEY, JSON.stringify(st))
}
// 榜单缓存（模块级）：刷新周期内切页/刷新回来榜单不变
let cachedArena = null
function getOpponents() {
  const now = Date.now()
  const base = player.combatLevel
  if (cachedArena && cachedArena.until > now) {
    // 校验缓存对手等级是否超当前对决等级（旧规则残留数据）：超限则强制重新生成
    if (cachedArena.opponents.some((o) => o.level > base)) return regenerateArena(now, base)
    return cachedArena.opponents
  }
  const st = loadArenaState()
  // 未到期（含页面刷新导致模块缓存丢失）：沿用原对手名单 + 原到期时间 + 已挑战记录，不倒计时重置/不恢复可打
  if (st && st.until > now && Array.isArray(st.opponents) && st.opponents.length) {
    // 校验旧榜单位超限：对手等级超过当前对决等级 → 视为旧规则残留，强制重新生成（封顶）
    if (st.opponents.some((o) => o.level > base)) return regenerateArena(now, base)
    cachedArena = { opponents: st.opponents, until: st.until }
    return st.opponents
  }
  // 到期/无记录：重新生成名单，清空已挑战
  return regenerateArena(now, base)
}
// 重新生成榜单（等级封顶 ≤ 当前对决等级）并保存，清空已挑战
function regenerateArena(now, base) {
  const opponents = generateArenaOpponents(base)
  const until = now + REFRESH_MS
  cachedArena = { opponents, until }
  saveArenaState({ until, opponents, challenged: [] })
  return opponents
}
const opponents = ref(getOpponents())
const nextRefresh = ref(cachedArena.until)
// 已挑战过的对手（打过一次后不能再次挑战，等下次刷新恢复）：key = rank + '-' + name；持久化到 localStorage
const savedChallenged = (loadArenaState()?.challenged ?? []).filter((k) => opponents.value.some((o) => `${o.rank}-${o.name}` === k))
const challenged = reactive(new Set(savedChallenged))
const oppKey = (o) => `${o.rank}-${o.name}`
// 每秒 tick：驱动倒计时实时递减（computed 里 Date.now() 非响应式，必须依赖响应的 tick）
const nowTick = ref(Date.now())
let refreshTimer = null

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
function refreshArena() {
  // 战斗中不刷新：防止胜利后按名字找不到对手 → 连胜/纪录丢失
  if (combat?.inFight) return
  opponents.value = generateArenaOpponents(player.combatLevel)
  challenged.clear() // 刷新后新名单恢复可挑战
  const until = Date.now() + REFRESH_MS
  cachedArena = { opponents: opponents.value, until }
  saveArenaState({ until, opponents: opponents.value, challenged: [] }) // 新一轮：清空已挑战并持久化
  nextRefresh.value = until
  ui.pushLog('⚡ 竞技场挑战榜已刷新', 'info')
}
onMounted(() => {
  // 每次挂载注册战斗结束监听（用当前组件 refs），卸载时移除，避免闭包绑定旧组件
  EventBus.on('combat:end', handleCombatEnd)
  // 每秒更新 nowTick（驱动倒计时实时递减）并检查是否到期刷新
  refreshTimer = setInterval(() => {
    nowTick.value = Date.now()
    if (nowTick.value >= nextRefresh.value) refreshArena()
  }, 1000)
})
onBeforeUnmount(() => {
  clearInterval(refreshTimer)
  EventBus.off('combat:end', handleCombatEnd)
})
const countdown = computed(() => {
  const left = Math.max(0, nextRefresh.value - nowTick.value)
  const m = Math.floor(left / 60000)
  const s = Math.floor((left % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
})

function startFight(o) {
  if (player.combat.hp <= 0) player.setCombat({ hp: player.maxHp })
  challenged.add(oppKey(o)) // 打过一次后本名单内不可再次挑战，等下次刷新恢复
  // 持久化已挑战记录：切页/刷新页面不恢复可打，仅到期刷新才清
  const st = loadArenaState()
  if (st) saveArenaState({ ...st, challenged: [...challenged] })
  arenaSettled = false // 新一场战斗开始，允许本场结算一次
  combat.start(o)
}
// 本场竞技场战斗是否已结算（防止 combat:end 被多次消费导致连胜 +2、跳5）
let arenaSettled = false
// 战斗结束后结算连胜/纪录（onMounted 注册、onBeforeUnmount 移除，避免模块级闭包绑定旧组件 refs）
function handleCombatEnd({ result, opponent }) {
  const o = opponents.value.find((x) => x.name === opponent)
  if (o?.isPvp) {
    if (arenaSettled) return // 同一场战斗重复结算：跳过，保证每场只计一次、5连胜宝箱不被跳过
    arenaSettled = true
    const reward = player.onArenaEnd(result === 'win', opponent, o.level)
    if (result === 'win') {
      ui.pushLog(`⚡ 竞技场连胜：${player.stats.arena.currentStreak}`, 'levelup')
      if (reward?.kind === 'streak') ui.pushLog(`🎁 ${reward.streak} 连胜宝箱：+${reward.gold} 金币 + 神秘调料${reward.streak >= 10 ? ' + 能量饼干' : ''}！`, 'gain')
      if (reward?.record) ui.pushLog(`🎁 破纪录奖励：+200 金币 + 能量饼干！`, 'gain')
    }
  }
}

function rankBadge(i) {
  if (i === 0) return '🥇'
  if (i === 1) return '🥈'
  if (i === 2) return '🥉'
  return `#${i + 1}`
}
function fmtDate(ts) {
  return new Date(ts).toLocaleString()
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>⚔️ 料理竞技场</h2>
        <p class="dim">挑战「其他玩家」镜像（真在线 对战 需后端，后续迭代）；对手水平随你的对决等级提升</p>
      </div>
      <div class="skill-head-right" style="text-align: right">
        <div class="xp-num" style="white-space: nowrap">
          连胜 <span class="mono">{{ player.stats.arena.currentStreak }}</span>
          <span class="dim">· 最佳 {{ player.stats.arena.bestStreak }}</span>
        </div>
        <p class="dim" style="text-align: right; margin-top: 4px">总胜场：{{ player.stats.arena.wins }}</p>
      </div>
    </header>

    <!-- 组合框：左「对决风格」+ 中间虚线 + 右「属性面板」（复用对决页面样式） -->
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

    <!-- 战斗框（常驻：战斗中显示战斗；否则待机提示）——复用对决页面样式 -->
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
              <div v-if="(player.inventory.energyBiscuit ?? 0) > 0" class="item-group">
                <button class="btn btn-sm" :disabled="combat.biscuitCooldown > 0" @click="useItem('biscuit')">
                  🍪 能量补给 ×{{ player.inventory.energyBiscuit }}<span v-if="combat.biscuitCooldown > 0" class="dim">（冷却 {{ combat.biscuitCooldown }} 回合）</span>
                </button>
              </div>
            </div>
            <button class="btn btn-sm" @click="combat.stop()" style="margin-top: auto">停止对决</button>
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

    <div class="card">
      <h3>挑战榜（每 5 分钟刷新 · 下次 {{ countdown }}）</h3>
      <p class="dim" style="margin-bottom: 6px">对手为随机分配的其他玩家镜像，数值随你的对决等级（{{ player.combatLevel }}）提升；胜利获金币/经验/品鉴点，每 5 连胜开宝箱、破纪录额外奖励</p>
      <div class="opp-list">
        <div v-for="(o, i) in opponents" :key="o.rank + '-' + o.name" class="opp-row" :class="{ challenged: challenged.has(oppKey(o)) }" @mouseenter="bindTip($event)" @mousemove="bindTip($event)">
          <span style="width: 36px" class="mono">{{ rankBadge(i) }}</span>
          <div class="opp-info">
            <strong v-if="o.drops?.length" style="cursor: pointer" title="点击查看掉落" @click="openDrops(o)">{{ o.name }}</strong>
            <strong v-else>{{ o.name }}</strong>
            <span class="dim">等级 {{ o.level }} · {{ o.styleName }}<template v-if="challenged.has(oppKey(o))"> · 已挑战（下次刷新恢复）</template></span>
          </div>
          <div class="opp-stats dim mono">生命值 {{ o.hp }} · 攻 {{ Math.round(o.atk) }} · 防 {{ Math.round(o.def) }}</div>
          <button v-if="!challenged.has(oppKey(o))" class="btn btn-sm btn-primary" :disabled="battleFrame.inFight" @click="startFight(o)">对决</button>
          <button v-else class="btn btn-sm" disabled>已挑战</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>最佳纪录（最近 5 条）</h3>
      <div v-if="player.stats.arena.records.length" class="opp-list">
        <div v-for="(r, i) in [...player.stats.arena.records].reverse()" :key="i" class="opp-row">
          <span>⚡ 击败 <strong>{{ r.name }}</strong>（等级 {{ r.level }}）</span>
          <span class="dim mono">连胜 {{ r.streak }} · {{ fmtDate(r.date) }}</span>
        </div>
      </div>
      <p v-else class="dim">还没有纪录，去挑战吧！</p>
    </div>

    <!-- 掉落弹窗：点击对手名字查看掉落 -->
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
