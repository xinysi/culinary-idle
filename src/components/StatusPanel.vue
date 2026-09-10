<script setup>
// 右侧面板 — 需求文档 §9.1.3：角色状态 / 挂机任务 / 装备 / 事件日志
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { getSkillDef } from '../game/data/skills.js'
import { getAllSkillInstances } from '../game/skills/registry.js'
import { SPIRIT_SLOTS } from '../game/data/spiritTiers.js'
import { AOJIS } from '../game/data/aojis.js'
import ProgressBar from './ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()

// ── 快捷状态（§13：当前任务 / 赛季 / 公会）──
import { getSeason, activeSeasonId } from '../game/data/seasons.js'
import { getGuild } from '../game/data/guilds.js'
import { QUESTS } from '../game/data/quests.js'
import { itemName } from '../game/data/items.js'
const currentQuestDef = computed(() => {
  const q = player.currentQuest
  return q ? QUESTS.find((x) => x.id === q.id) ?? null : null
})
const currentSeasonDef = computed(() => getSeason(activeSeasonId()))
const currentSeasonState = computed(() => (player.seasonState ? player.seasonState() : null))
const seasonClaimable = computed(() => {
  const s = currentSeasonState.value
  const se = currentSeasonDef.value
  if (!s || !se) return 0
  return (se.tiers ?? []).filter((t, i) => !s.claimed.includes(i) && s.points >= t.points).length
})
const currentGuild = computed(() => getGuild(player.guild?.id))

// §5.1 装备槽位名称
const SLOT_NAMES = {
  weapon: '武器',
  helmet: '头盔',
  body: '身体',
  legs: '腿部',
  boots: '脚部',
  offhand: '副手',
  amulet: '饰品1',
  ring: '饰品2',
}

// 装备部位换装：点击槽位 → 列出背包中该槽位装备
const eqTarget = ref(null) // 当前选择的槽位
const QUALITY_RANK = { 神话: 6, 传说: 5, 史诗: 4, 稀有: 3, 精良: 2, 普通: 1 }
const slotOptions = computed(() => {
  if (!eqTarget.value) return []
  return Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.type === 'equipment' && getItem(id)?.slot === eqTarget.value)
    .map(([id, qty]) => ({ id, qty, item: getItem(id) }))
    .sort((a, b) => (QUALITY_RANK[b.item.quality] ?? 0) - (QUALITY_RANK[a.item.quality] ?? 0) || b.item.value - a.item.value)
})
function eqStatsText(it) {
  return Object.entries(it.stats ?? {}).map(([k, v]) => `${EQ_STAT_LABEL[k] ?? k} ${v}`).join('、')
}
const EQ_STAT_LABEL = { attack: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', hpBonus: '生命值', speedBonus: '攻速' }
function equipFromSlot(id) {
  if (player.equip(id)) ui.pushLog(`穿戴了 ${getItem(id)?.name}`, 'gain')
  eqTarget.value = null
}
function upgradeCostFor(itemId) {
  return player.upgradeCost(itemId)
}
function doUpgrade(itemId) {
  const r = player.upgradeItem(itemId)
  ui.pushLog(r.ok ? `⚒️ ${getItem(itemId)?.name} 强化到 +${r.level}` : r.msg ?? '强化失败', r.ok ? 'gain' : 'warn')
}

const logCollapsed = ref(false) // 事件日志折叠：折叠时用 v-if 不渲染列表(优化性能)
const recentLog = computed(() => [...ui.log].reverse().slice(0, 8))

// 全局挂机任务列表（§3.1：含暂停/超限展示；已关闭的任务不显示；并行上限内才实际运行）
const runningTasks = computed(() => {
  ui.loopTick // 依赖全局循环计数：每引擎 tick 重算（进度实时）
  const running = new Set(player.getRunningIdleSkills().map((i) => i.id))
  const tasks = []
  for (const inst of getAllSkillInstances()) {
    if (!inst || !['gathering', 'exploration'].includes(inst.type)) continue
    if (player.closedIdleTasks?.[inst.id]) continue // 关闭的任务不显示
    const t = inst.currentTarget
    if (!t || inst.level < t.reqLevel) continue
    tasks.push({
      id: inst.id,
      inst,
      target: t,
      paused: player.isSkillPaused(inst.id),
      running: running.has(inst.id),
      pct: inst.progressPct,
      // 该任务技能受食灵的经验加成（§3.3.6，%）
      spiritXp: player.spiritEffects?.()?.xpPct?.[inst.id] ?? 0,
      // 时间戳 rAF 用：让挂机进度条不依赖 engine tick（已降到 100ms）→ 无论引擎多慢都丝滑
      durationMs: inst.intervalMs ? inst.intervalMs(t) : 0,
      cycleStartAt: inst.cycleStartAt ?? 0,
      active: running.has(inst.id) && !player.isSkillPaused(inst.id) && !player.closedIdleTasks?.[inst.id],
    })
  }
  return tasks
})
const parallelLimit = computed(() => player.settings.maxParallelIdle ?? 0)
function toggleTaskPause(id) {
  const next = !player.isSkillPaused(id)
  player.setSkillPaused(id, next)
  ui.pushLog(next ? `已停止${getSkillDef(id)?.name}（切页不中断，可随时继续）` : `已继续${getSkillDef(id)?.name}`, next ? 'warn' : 'info')
}
function closeTask(id) {
  player.closeIdleTask(id)
  ui.pushLog(`已关闭${getSkillDef(id)?.name}挂机（停止并隐藏；技能页重新选择目标可恢复）`, 'warn')
}

const activeBuff = computed(() => {
  const parts = []
  const xp = player.buffs?.xpMult
  const yl = player.buffs?.yieldMult
  if (xp && Date.now() < xp.expiresAt) parts.push(`经验×${xp.mult}`)
  if (yl && Date.now() < yl.expiresAt) parts.push(`产量×${yl.mult}`)
  return parts.join('、') || null
})

// 右侧导航「食灵」加成：出站食灵对本技能的经验加成（§3.3.6）
const spiritActiveCount = computed(() => player.spirits?.active?.length ?? 0)
const spiritEff = computed(() => player.spiritEffects?.() ?? {})
const spiritXpPct = computed(() => spiritEff.value.xpPct?.[player.activeSkill] ?? 0)
const spiritSkillName = computed(() => getSkillDef(player.activeSkill)?.name ?? '')

// ── 美食奥义（§3.4.1）：右侧常驻显示已激活奥义 + 消耗 + 快捷关闭 ──
const activeAojis = computed(() =>
  (player.gastronomy?.active ?? []).map((id) => AOJIS.find((a) => a.id === id)).filter(Boolean)
)
const aojiDrain = computed(() => activeAojis.value.reduce((s, a) => s + a.costPerSec, 0))
function closeAoji(id) {
  player.toggleAoji(id)
}
</script>

<template>
  <aside class="status-panel">
    <!-- 角色状态已移至中间底部状态条，此处删除 -->

    <!-- 挂机任务（§3.1 多技能并行，任意页面可见可控；无任务时常驻显示空态）-->
    <div class="card">
      <h3>⚡ 挂机中（{{ runningTasks.length }}{{ parallelLimit > 0 ? `/${parallelLimit}` : '' }}）</h3>
      <template v-if="runningTasks.length">
        <div v-for="task in runningTasks" :key="task.id" class="idle-task" :class="{ 'idle-waiting': !task.running && !task.paused }">
          <div class="stat-line">
            <span class="dim">{{ getSkillDef(task.id)?.name }} · {{ getItem(task.target.itemId)?.name }}</span>
            <span class="mono">×{{ task.inst.actionsDone }}</span>
          </div>
          <div v-if="task.spiritXp > 0" class="dim task-spirit">食灵经验 +{{ task.spiritXp }}%</div>
          <ProgressBar :start-at="task.cycleStartAt" :duration-ms="task.durationMs" :active="task.active" />
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px">
            <span class="dim">{{ task.paused ? '已暂停' : task.running ? '切页不中断' : '并行位已满' }}</span>
            <div style="display: flex; gap: 6px">
              <button v-if="task.paused || task.running" class="btn btn-sm" :class="{ 'btn-primary': task.paused }" @click="toggleTaskPause(task.id)">
                {{ task.paused ? '继续' : '停止' }}
              </button>
              <button class="btn btn-sm" title="关闭（停止并隐藏此任务）" @click="closeTask(task.id)">✕</button>
            </div>
          </div>
        </div>
      </template>
      <p v-else class="dim panel-empty">暂无挂机任务 — 到技能页选择目标开始采集/加工/探索</p>
    </div>

    <!-- 食灵出战加成（§3.3.6）：无食灵时常驻显示引导 -->
    <div class="card spirit-side">
      <template v-if="spiritActiveCount > 0">
        <h3>食灵出战 {{ spiritActiveCount }}/{{ SPIRIT_SLOTS }}</h3>
        <div class="dim" v-if="spiritXpPct > 0">{{ spiritSkillName }}经验 +{{ spiritXpPct }}%（食灵加成）</div>
        <div class="dim" v-else>当前技能无食灵经验加成</div>
      </template>
      <template v-else>
        <h3>食灵出战 0/{{ SPIRIT_SLOTS }}</h3>
        <div class="dim">尚未召唤食灵 — 制作契约并召唤出战可获得加成</div>
      </template>
      <button class="btn btn-sm" style="margin-top: 6px" @click="player.setActiveSkill('spiritSummoning'); ui.setView('skill')">管理食灵</button>
    </div>

    <!-- 美食奥义（§3.4.1）：常驻显示激活状态 + 消耗 + 快捷关闭 -->
    <div class="card aoji-side">
      <h3>美食奥义 {{ activeAojis.length }} 个</h3>
      <template v-if="activeAojis.length">
        <div v-for="a in activeAojis" :key="a.id" class="aoji-row">
          <span class="aoji-name">{{ a.name }}</span>
          <span class="dim mono">{{ a.costPerSec.toFixed(1) }}点/s</span>
          <button class="btn btn-sm" title="关闭奥义" @click="closeAoji(a.id)">关</button>
        </div>
        <div class="dim aoji-total">合计 {{ aojiDrain.toFixed(1) }} 点/s · 剩余 <b class="mono">{{ Math.floor(player.tastePoints) }}</b> 点</div>
      </template>
      <p v-else class="dim panel-empty">未激活奥义 — 到美食知识页激活获得被动加成</p>
      <button class="btn btn-sm" style="margin-top: 6px" @click="player.setActiveSkill('gastronomy'); ui.setView('skill')">管理奥义</button>
    </div>

    <!-- 快捷状态（§13）-->
    <div class="card quick-status">
      <h3>快捷状态</h3>

      <!-- 每日任务（2026-09-06 长线日活钩子） -->
      <div class="quick-group">
        <div class="quick-group-title">每日任务</div>
        <div class="quick-group-body">
          <div class="quick-item">
            <span class="quick-item-text">{{ player.dailyClaimableCount() }}/{{ player.daily.tasks.length }} 今日完成<template v-if="player.daily.streak > 1">（🔥{{ player.daily.streak }} 天）</template></span>
            <button class="btn btn-sm" @click="ui.openLogTab('quest')">去领取</button>
          </div>
        </div>
      </div>

      <!-- 任务 -->
      <div v-if="currentQuestDef" class="quick-group">
        <div class="quick-group-title">任务</div>
        <div class="quick-group-body">
          <div class="quick-item">
            <span class="quick-item-text">{{ currentQuestDef.name }}</span>
            <button class="btn btn-sm" @click="ui.openLogTab('quest')">查看</button>
          </div>
        </div>
      </div>

      <!-- 赛季（与任务之间实线分隔） -->
      <div v-if="currentQuestDef && currentSeasonDef" class="quick-group-sep"></div>
      <div v-if="currentSeasonDef" class="quick-group">
        <div class="quick-group-title">赛季</div>
        <div class="quick-group-body">
          <div class="quick-item">
            <span class="quick-item-text">{{ currentSeasonDef.name }}（可领 {{ seasonClaimable }} 档）</span>
            <button class="btn btn-sm" @click="ui.setView('season')">前往</button>
          </div>
        </div>
      </div>

      <!-- 挑战塔 / 大赛（2026-09-06） -->
      <div v-if="player.combatLevel >= 99" class="quick-group">
        <div class="quick-group-title">毕业挑战</div>
        <div class="quick-group-body">
          <div class="quick-item">
            <span class="quick-item-text">🗼 试炼塔 已过 <b class="mono">{{ player.tower?.best ?? 0 }}</b> 层 · 🏆 大赛 {{ player.fest?.score ?? 0 }} 分</span>
            <button class="btn btn-sm" @click="ui.setView('tower')">塔</button>
            <button class="btn btn-sm" @click="ui.setView('fest')">大赛</button>
          </div>
        </div>
      </div>

      <!-- 公会 -->
      <div v-if="currentSeasonDef && currentGuild" class="quick-group-sep"></div>
      <div v-if="currentGuild" class="quick-group">
        <div class="quick-group-title">公会</div>
        <div class="quick-group-body">
          <div class="quick-item">
            <span class="quick-item-text">{{ currentGuild.name }}</span>
            <button class="btn btn-sm" @click="ui.setView('guild')">前往</button>
          </div>
        </div>
      </div>

      <p v-if="!currentQuestDef && !currentSeasonDef && !currentGuild" class="dim" style="font-size: 12px">
        {{ player.title ? `称号「${player.title}」` : '暂无进行中内容' }}
      </p>
    </div>

    <!-- 装备已移至顶部导航“装备”穿戴弹窗，此处删除 -->

    <!-- 装备选择弹窗（部位换装） -->
    <Teleport to="body">
      <div v-if="eqTarget" class="modal-backdrop" @click.self="eqTarget = null">
        <div class="modal eq-modal">
        <header class="modal-head">
          <h3>{{ SLOT_NAMES[eqTarget] }}装备</h3>
          <button class="btn btn-sm" @click="eqTarget = null">✕</button>
        </header>
        <div class="item-detail-body">
          <div v-if="player.equipment[eqTarget]" class="eq-option current">
            <strong>{{ getItem(player.equipment[eqTarget])?.name }}</strong>
            <span class="dim">（当前穿戴）</span>
            <button class="btn btn-sm" @click="player.unequip(eqTarget); eqTarget = null">卸下</button>
          </div>
          <!-- 强化（§13）：每级 +10% 属性，上限 5 级 -->
          <div v-if="player.equipment[eqTarget]" class="upgrade-box">
            <div class="dim">强化等级：<strong>+{{ player.upgrades[player.equipment[eqTarget]] ?? 0 }}</strong>/5（每级属性 +10%）</div>
            <div v-if="(player.upgrades[player.equipment[eqTarget]] ?? 0) < 5" class="dim" style="font-size: 12px">
              费用：{{ upgradeCostFor(player.equipment[eqTarget])?.gold }} 金币 + 铁矿×{{ upgradeCostFor(player.equipment[eqTarget])?.ironOre }} + 盐矿×{{ upgradeCostFor(player.equipment[eqTarget])?.saltOre }}
            </div>
            <button
              class="btn btn-sm btn-primary"
              :disabled="(player.upgrades[player.equipment[eqTarget]] ?? 0) >= 5"
              @click="doUpgrade(player.equipment[eqTarget])"
            >
              强化
            </button>
            <p class="dim" style="font-size: 12px; margin-top: 4px">💡 建议：强化适合中后期装备（金装/史诗/神话），前期铜铁装收益低、成本高</p>
          </div>
          <div
            v-for="o in slotOptions"
            :key="o.id"
            class="eq-option"
            :class="{ equipped: player.equipment[eqTarget] === o.id }"
            @click="equipFromSlot(o.id)"
          >
            <div>
              <strong>{{ o.item.name }}</strong>
              <span v-if="o.item.quality" class="dim">{{ o.item.quality }}</span>
              <span class="dim mono">×{{ o.qty }}</span>
            </div>
            <div class="dim" style="font-size: 12px">{{ eqStatsText(o.item) }}</div>
          </div>
          <p v-if="!slotOptions.length" class="dim">背包中没有该部位的装备</p>
        </div>
      </div>
    </div>
    </Teleport>

    <!-- 事件日志 -->
    <div class="card log-card">
      <h3>事件日志
        <span class="log-actions">
          <button class="btn btn-sm" @click="ui.clearLog()">清空</button>
          <button class="btn btn-sm" @click="logCollapsed = !logCollapsed">{{ logCollapsed ? '展开' : '收起' }}</button>
        </span>
      </h3>
      <!-- 折叠时不渲染列表（v-if），优化大日志性能 -->
      <ul v-if="!logCollapsed" class="log-list">
        <li v-for="entry in recentLog" :key="entry.id" :class="`log-${entry.kind}`">
          <span class="mono log-ts">{{ new Date(entry.ts).toLocaleTimeString() }}</span>
          <span class="log-msg">{{ entry.message }}</span>
        </li>
      </ul>
    </div>
  </aside>
</template>
