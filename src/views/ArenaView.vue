<script setup>
// 竞技场（多人对决·本地镜像）— 需求文档 §13（可选扩展）
// 真在线 对战 需要后端；此处挑战「其他玩家」镜像，记录连胜与最佳纪录。
// 挑战榜每 5 分钟随机刷新（名字/数值随机，强度不超过玩家对决等级）
import { bindTip } from '../composables/useFixedTooltip.js'
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getCombat } from '../game/combat/Combat.js'
import CombatPanel from '../components/CombatPanel.vue'
import CombatLog from '../components/CombatLog.vue'
import { EventBus } from '../game/core/EventBus.js'
import { scaledEnemy } from '../game/data/enemyScaling.js'
import { generateArenaOpponents } from '../game/data/arena.js'
import { STYLE_INFO, STYLE_ADVANTAGE } from '../game/data/combat.js'
import { getItem } from '../game/data/items.js'
import { sfx } from '../game/core/sound.js'
import ProgressBar from '../components/ProgressBar.vue'
import DropList from '../components/DropList.vue'

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
// 掉落改为**常驻列表**（2026-09-19，与对决页共用 DropList）：原先点名字弹窗，
// 弹窗 Teleport 到 body，看掉落时既有遮罩、又不好连着几个对手对照着挑。
const selected = ref(null) // { name, drops }
function pickOpponent(o) {
  selected.value = o?.drops?.length ? { name: o.name, drops: o.drops } : null
}
// 道具使用（复用对决页面：料理/酱料/饮品/神秘调料）

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
    // ⚠️ 旧版存档里的榜单没带血量分档 ⇒ 读出来也要过一遍 `scaledEnemy`（幂等，带标记不重复乘）
    return cachedArena.opponents.map(scaledEnemy)
  }
  const st = loadArenaState()
  // 未到期（含页面刷新导致模块缓存丢失）：沿用原对手名单 + 原到期时间 + 已挑战记录，不倒计时重置/不恢复可打
  if (st && st.until > now && Array.isArray(st.opponents) && st.opponents.length) {
    // 校验旧榜单位超限：对手等级超过当前对决等级 → 视为旧规则残留，强制重新生成（封顶）
    if (st.opponents.some((o) => o.level > base)) return regenerateArena(now, base)
    cachedArena = { opponents: st.opponents, until: st.until }
    return st.opponents.map(scaledEnemy)
  }
  // 到期/无记录：重新生成名单，清空已挑战
  return regenerateArena(now, base)
}
// 重新生成榜单（等级封顶 ≤ 当前对决等级）并保存，清空已挑战
function regenerateArena(now, base) {
  // 血量分档（2026-09-22 (c)）：这里生成的一份同时用于**列表显示与开打**，所以两边必然一致
  const opponents = generateArenaOpponents(base).map(scaledEnemy)
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

    <!-- 两栏外壳（2026-09-20 与对决页同步）：左＝战斗区 + 挑战榜，右＝掉落详情 + 装备槽 -->
    <div class="combat-page">
      <div class="combat-page-main">
        <!-- 战斗屏 + 日志/战备 + 风格/属性（与对决页共用同一组件，不再各写一份） -->
        <CombatPanel />

        <div class="card">
          <h3>挑战榜（每 5 分钟刷新 · 下次 {{ countdown }}）</h3>
      <p class="dim" style="margin-bottom: 6px">对手为随机分配的其他玩家镜像，数值随你的对决等级（{{ player.combatLevel }}）提升；胜利获金币/经验/品鉴点，每 5 连胜开宝箱、破纪录额外奖励</p>
      <div class="arena-pick">
        <div class="arena-pick-main">
          <div class="opp-list">
            <div v-for="(o, i) in opponents" :key="o.rank + '-' + o.name" class="opp-row" :class="{ challenged: challenged.has(oppKey(o)), picked: selected?.name === o.name }" @mouseenter="bindTip($event)" @mousemove="bindTip($event)">
              <span style="width: 36px" class="mono">{{ rankBadge(i) }}</span>
              <div class="opp-info">
                <strong v-if="o.drops?.length" style="cursor: pointer" title="点击查看掉落" @click="pickOpponent(o)">{{ o.name }}</strong>
                <strong v-else>{{ o.name }}</strong>
                <span class="dim">等级 {{ o.level }} · {{ o.styleName }}<template v-if="challenged.has(oppKey(o))"> · 已挑战（下次刷新恢复）</template></span>
              </div>
              <div class="opp-stats dim mono">生命值 {{ o.hp }} · 攻 {{ Math.round(o.atk) }} · 防 {{ Math.round(o.def) }}</div>
              <button v-if="!challenged.has(oppKey(o))" class="btn btn-sm btn-primary" :disabled="battleFrame.inFight" @click="startFight(o)">对决</button>
              <button v-else class="btn btn-sm" disabled>已挑战</button>
            </div>
          </div>
        </div>
        <aside class="arena-pick-loot">
          <h4>💧 掉落</h4>
          <DropList :name="selected?.name ?? ''" :drops="selected?.drops ?? []" />
        </aside>
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
      </div>

      <!-- 右栏：战斗日志（2026-09-21 与「装备」互换位置：日志搬到右栏，装备回左栏与战备同屏） -->
      <aside class="combat-page-side">
        <CombatLog />
      </aside>
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
/* 挑战榜：左对手列表 + 右常驻掉落列表（2026-09-19，与对决页同一套布局；掉落组件共用 DropList）。
   窄屏回落成上下堆叠，避免掉落列表把对手行压窄。 */
.arena-pick {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 264px;
  gap: 14px;
  align-items: start;
}
.arena-pick-main {
  min-width: 0;
}
.arena-pick-loot {
  min-width: 0;
  padding-left: 12px;
  border-left: 1px dashed rgba(var(--ink-rgb), 0.35);
}
.arena-pick-loot h4 {
  margin: 0 0 4px;
}
@media (max-width: 900px) {
  .arena-pick {
    grid-template-columns: minmax(0, 1fr);
  }
  .arena-pick-loot {
    padding-left: 0;
    padding-top: 10px;
    border-left: none;
    border-top: 1px dashed rgba(var(--ink-rgb), 0.35);
  }
}
/* 正在查看掉落的那一行 */
.opp-row.picked {
  outline: 1px solid var(--primary);
  outline-offset: -1px;
}
</style>
