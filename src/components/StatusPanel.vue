<script setup>
// 右侧面板 — 需求文档 §9.1.3：角色状态 / 挂机任务 / 装备 / 事件日志
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { useIdleTasks } from '../composables/useIdleTasks.js'
import { getItem } from '../game/data/items.js'
import { getSkillDef } from '../game/data/skills.js'
import { getAllSkillInstances } from '../game/skills/registry.js'
import { SPIRIT_SLOTS } from '../game/data/spiritTiers.js'
import { AOJIS } from '../game/data/aojis.js'
import ProgressBar from './ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()

// 分区渲染（2026-09-20 用户要求：「挂机动向 · 食灵 · 奥义 · 快捷状态 · 事件日志，应该是五个独立的胶囊和弹出面板」）：
// 每个底部胶囊各渲染一个 `<StatusPanel :section="'spirit'|'aoji'|'status'|'log'" />`；
// 不传 `section`（默认空串）= 五块全渲染（兼容旧用法，也方便单独调试）。
const props = defineProps({ section: { type: String, default: '' } })
const show = (sec) => !props.section || props.section === sec

// ── 快捷状态（§13：当前任务 / 赛季 / 公会）──
import { getSeason, activeSeasonId } from '../game/data/seasons.js'
import { getGuild } from '../game/data/guilds.js'
import { QUESTS } from '../game/data/quests.js'
import { itemName } from '../game/data/items.js'
const activeBuffs = computed(() => {
  const now = Date.now()
  const out = []
  // v2.3.0：四条乘区轴（菌灵露/蜂蜜/加工品）。采集间隔是「越小越快」，显示成「−N%」更直观。
  for (const [key, label] of [['xpMult', '经验增益'], ['yieldMult', '产量增益'], ['gatherMult', '采集间隔'], ['restaurantMult', '餐厅收入']]) {
    const b = player.buffs?.[key]
    if (b && now < b.expiresAt) {
      const shown = key === 'gatherMult' ? `−${Math.round((1 - b.mult) * 100)}%` : key === 'restaurantMult' ? `+${Math.round((b.mult - 1) * 100)}%` : `×${b.mult}`
      out.push({ key, label, mult: b.mult, shown, left: Math.max(1, Math.round((b.expiresAt - now) / 60000)) })
    }
  }
  return out
})
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

// ⚠️ 2026-09-20：这里原先还有一套「装备部位换装弹窗」（eqTarget / slotOptions / equipFromSlot /
//    doUpgrade / upgradeCostFor）。装备块在 2026-09-19 升级为独立页面时就从右栏删掉了，
//    但那段代码留了下来 —— `eqTarget` 除了被置 null **从无入口赋值**，即整块不可达。
//    本轮胶囊化后本组件会被实例化 5 次（每个胶囊一份），更不能留 5 份无用 Teleport，故整体删除。
const logCollapsed = ref(false) // 事件日志折叠：折叠时用 v-if 不渲染列表(优化性能)
const recentLog = computed(() => [...ui.log].reverse().slice(0, 8))

// ⚠️ 2026-09-19：挂机任务列表抽到 `composables/useIdleTasks.js` —— 中间底栏的「挂机中条」读同一份，
//    免得两处各算一遍、出现「底栏显示在跑、抽屉显示已暂停」这类两套真相。
const { runningTasks, parallelLimit } = useIdleTasks()
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
  // 快捷状态里的一行摘要：四条乘区轴都要出现（v2.3.0 补采集间隔/餐厅收入）
  const now = Date.now()
  const parts = []
  const xp = player.buffs?.xpMult
  const yl = player.buffs?.yieldMult
  const ga = player.buffs?.gatherMult
  const rs = player.buffs?.restaurantMult
  if (xp && now < xp.expiresAt) parts.push(`经验×${xp.mult}`)
  if (yl && now < yl.expiresAt) parts.push(`产量×${yl.mult}`)
  if (ga && now < ga.expiresAt) parts.push(`采集间隔−${Math.round((1 - ga.mult) * 100)}%`)
  if (rs && now < rs.expiresAt) parts.push(`餐厅+${Math.round((rs.mult - 1) * 100)}%`)
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

    <!-- 「⚡ 挂机动向」块在底部胶囊弹出的面板里（components/BottomDock.vue，2026-09-20 起由它统一承载） -->

    <!-- 食灵出战加成（§3.3.6）：无食灵时常驻显示引导 -->
    <div v-if="show('spirit')" class="card spirit-side">
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
    <div v-if="show('aoji')" class="card aoji-side">
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

    <!-- 生效中的增益剂（2026-09-14：增益剂此前无使用入口也无状态展示）-->
    <div v-if="show('status') && activeBuffs.length" class="card quick-status">
      <h3>🧪 生效中</h3>
      <div v-for="b in activeBuffs" :key="b.key" class="quick-group">
        <div class="quick-row"><span>{{ b.label }}</span><b class="mono">{{ b.shown }}</b></div>
        <div class="dim" style="font-size: 12px">剩 {{ b.left }} 分钟</div>
      </div>
    </div>

    <!-- 快捷状态（§13）-->
    <div v-if="show('status')" class="card quick-status">
      <h3>快捷状态</h3>

      <!-- 信箱（2026-09-11）：只在有未领附件时出现，避免占位 -->
      <div v-if="player.mailUnclaimedCount() > 0" class="quick-group">
        <div class="quick-group-title">信箱</div>
        <div class="quick-group-body">
          <div class="quick-item">
            <span class="quick-item-text">📬 {{ player.mailUnclaimedCount() }} 封待领（溢出转存 / 附件）</span>
            <button class="btn btn-sm" @click="ui.setView('mail')">去查看</button>
          </div>
        </div>
      </div>

      <!-- 每日任务（2026-09-06 长线日活钩子） -->
      <div class="quick-group">
        <div class="quick-group-title">每日任务</div>
        <div class="quick-group-body">
          <div class="quick-item">
            <span class="quick-item-text">{{ player.dailyClaimableCount() }}/{{ player.daily.tasks.length }} 今日完成<template v-if="player.daily.streak > 1">（🔥{{ player.daily.streak }} 天）</template></span>
            <button class="btn btn-sm" @click="ui.setView('quests')">去领取</button>
          </div>
        </div>
      </div>

      <!-- 任务 -->
      <div v-if="currentQuestDef" class="quick-group">
        <div class="quick-group-title">任务</div>
        <div class="quick-group-body">
          <div class="quick-item">
            <span class="quick-item-text">{{ currentQuestDef.name }}</span>
            <button class="btn btn-sm" @click="ui.setView('quests')">查看</button>
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


    <!-- 事件日志 -->
    <div v-if="show('log')" class="card log-card">
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
