<script setup>
// 底部状态胶囊组（2026-09-20 用户要求）——原「顶栏 ⚡ 抽屉」与底栏「挂机中条」合并成**五个独立胶囊**：
//   ⚡挂机动向 · 🐾食灵 · 🍜奥义 · 🧭快捷状态 · 📜事件日志
// 每个胶囊点一下从底栏**向上**弹出自己的面板；同一时刻只展开一个（点另一个自动换）。
//   · 挂机动向：任务列表 + 进度条 + 暂停/继续 + ✕（原底栏条上的那组操作）
//   · 其余四块：复用 `StatusPanel.vue` 的 `:section` 分区渲染（组件逻辑一行未改，只按块取用）
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { useIdleTasks } from '../composables/useIdleTasks.js'
import { getSkillDef } from '../game/data/skills.js'
import { getItem } from '../game/data/items.js'
import { SPIRIT_SLOTS } from '../game/data/spiritTiers.js'
import ProgressBar from './ProgressBar.vue'
import StatusPanel from './StatusPanel.vue'

const player = usePlayerStore()
const ui = useUiStore()
const { runningTasks, parallelLimit } = useIdleTasks()

const activeCount = computed(() => runningTasks.value.filter((t) => t.running).length)
const firstActive = computed(() => runningTasks.value.find((t) => t.active) ?? null)
// 「食灵 / 奥义 / 日志」的角标数量：食灵与 StatusPanel 里那块同源（出战槽位数）
const spiritCount = computed(() => Object.values(player.spirits?.slots ?? {}).filter(Boolean).length)
const aojiCount = computed(() => player.activeAojis?.length ?? 0)
const logCount = computed(() => Math.min(ui.log?.length ?? 0, 99))
/** 有「可领但没领」的东西时给「快捷状态」亮个点（每日任务 / 未领邮件）——原顶栏 ⚡ 那个点的语义 */
const todoDot = computed(() => {
  try {
    return (player.dailyClaimableCount?.() ?? 0) > 0 || (player.mailUnclaimedCount?.() ?? 0) > 0
  } catch {
    return false
  }
})

// 胶囊标签用**短名**（底栏要装 5 个 + 新手横幅，长名会折成两排；完整含义在 title 与面板标题里）
const SECS = [
  { id: 'idle', icon: '⚡', name: '挂机', full: '挂机动向' },
  { id: 'spirit', icon: '🐾', name: '食灵', full: '食灵出战' },
  { id: 'aoji', icon: '🍜', name: '奥义', full: '美食奥义' },
  { id: 'status', icon: '🧭', name: '状态', full: '快捷状态' },
  { id: 'log', icon: '📜', name: '日志', full: '事件日志' },
]
const isOpen = (id) => ui.dockSection === id

function toggleTaskPause(id) {
  const next = !player.isSkillPaused(id)
  player.setSkillPaused(id, next)
  ui.pushLog(next ? `已停止${getSkillDef(id)?.name}（切页不中断，可随时继续）` : `已继续${getSkillDef(id)?.name}`, next ? 'warn' : 'info')
}
function closeTask(id) {
  const name = getSkillDef(id)?.name
  player.closeIdleTask(id)
  ui.pushLog(`已关闭${name}挂机（停止并隐藏；技能页重新选择目标可恢复）`, 'warn')
}
function label(t) {
  return `${getSkillDef(t.id)?.name ?? t.id} · ${getItem(t.target?.itemId)?.name ?? '—'}`
}
function state(t) {
  if (t.paused) return '已暂停'
  if (t.running) return '运行中'
  return '并行位已满'
}
/** 胶囊角标（挂机动向 = 运行数 / 并行上限；其余 = 条目数），为 0 时不显示 */
function badge(id) {
  if (id === 'idle') return runningTasks.value.length ? (parallelLimit.value > 0 ? `${activeCount.value}/${parallelLimit.value}` : String(activeCount.value)) : ''
  if (id === 'spirit') return spiritCount.value ? `${spiritCount.value}/${SPIRIT_SLOTS}` : ''
  if (id === 'aoji') return aojiCount.value ? String(aojiCount.value) : ''
  if (id === 'log') return logCount.value ? String(logCount.value) : ''
  return ''
}
</script>

<template>
  <div class="dock">
    <button
      v-for="s in SECS"
      :key="s.id"
      class="dock-pill"
      :data-sec="s.id"
      :class="{ 'dock-pill--on': isOpen(s.id) }"
      :title="`${s.full}（点击从右下角向上弹出）`"
      :aria-expanded="isOpen(s.id)"
      @click="ui.toggleDockSection(s.id)"
    >
      <span v-if="s.id === 'status'" class="dock-pill-dot" :class="{ 'dot-on': todoDot }" aria-hidden="true"></span>
      <span class="dock-pill-icon">{{ s.icon }}</span>
      <span class="dock-pill-text">{{ s.name }}</span>
      <b v-if="badge(s.id)" class="mono dock-pill-num">{{ badge(s.id) }}</b>
      <!-- 挂机动向带一条迷你进度条（原底栏条的观感；时间戳模式由 rAF 平滑推进，不会「卡卡的」） -->
      <span v-if="s.id === 'idle' && firstActive" class="dock-pill-bar">
        <ProgressBar :start-at="firstActive.cycleStartAt" :duration-ms="firstActive.durationMs" :active="firstActive.active" />
      </span>
      <span class="dock-pill-caret" aria-hidden="true">{{ isOpen(s.id) ? '▾' : '▴' }}</span>
    </button>

    <!-- 点外部关闭（透明层，不改配色） -->
    <div v-if="ui.dockSection" class="dock-catcher" @click="ui.toggleDockSection(null)"></div>

    <!-- 面板：从底栏**向上**弹出；锚在整条底栏（`.head-strips`）上，避免窄屏横向出界 -->
    <div v-if="ui.dockSection" class="dock-panel" role="dialog" :aria-label="SECS.find((x) => x.id === ui.dockSection)?.name">
      <div class="dock-panel-head">
        <strong>{{ SECS.find((x) => x.id === ui.dockSection)?.icon }} {{ SECS.find((x) => x.id === ui.dockSection)?.full }}</strong>
        <span class="dim dock-hint">{{ ui.dockSection === 'idle' ? '每个任务都能暂停 / 继续或关闭' : '与游戏内内容同源，点条目可直接跳转' }}</span>
        <button class="btn btn-sm" title="关闭" @click="ui.toggleDockSection(null)">✕</button>
      </div>
      <div class="dock-panel-body">
        <template v-if="ui.dockSection === 'idle'">
          <template v-if="runningTasks.length">
            <div v-for="t in runningTasks" :key="t.id" class="dock-task" :class="{ paused: t.paused, waiting: !t.running && !t.paused }">
              <span class="dock-task-name">{{ label(t) }}</span>
              <span class="dock-task-bar">
                <ProgressBar :start-at="t.cycleStartAt" :duration-ms="t.durationMs" :active="t.active" />
              </span>
              <span class="dim dock-task-state">{{ state(t) }}</span>
              <button class="btn btn-sm" :title="t.paused ? '继续' : '停止'" @click="toggleTaskPause(t.id)">{{ t.paused ? '▶' : '⏸' }}</button>
              <button class="btn btn-sm" title="关闭（停止并隐藏此任务）" @click="closeTask(t.id)">✕</button>
            </div>
          </template>
          <p v-else class="dim dock-empty">暂无挂机任务 —— 到技能页选个目标开始</p>
        </template>
        <StatusPanel v-else :section="ui.dockSection" class="dock-status" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dock {
  /* 2026-09-20 用户要求：五个胶囊**靠在右下角 BGM 胶囊的左边**（原先挤在底栏里会折成两排）。
     改成与 BGM 播放器同款的 fixed 浮层：同一水平线、同一底边（bottom: 0），右侧留出 BGM 的宽度+间距。
     z-index 40 与 BGM 同级（低于弹窗 50、低于本组件自己的关闭层 41 与面板 42）。 */
  position: fixed;
  /* 2026-09-21：间距从 8px 收到 **5px** —— 与五个胶囊彼此的 gap 一致，整条读起来才是**一排**（用户：
     「BGM 胶囊是不是融合进底栏了」）。值 = 14(BGM 右距) + 227.6(实测 BGM 胶囊宽) + 5(同排间距) ≈ 247。
     ⚠️ 改 BGM 胶囊的横向 padding/字号会让它的宽度变、这里必须跟着改；`e2e-test` 的 BGM 用例 ⑦
     有「第 5 个胶囊与 BGM 胶囊的间距 == 胶囊彼此的间距」行为断言兜住漂移。 */
  right: 247px;
  bottom: 0;
  /* ⚠️ 46 而不是 40：手机底部导航（`.mobile-nav`）是 `fixed; bottom:0; z-index:40` 且在 DOM 里
     排在中间列**之后** ⇒ 同层级下会盖住胶囊（实测 390px 下点胶囊一直等超时）。
     46 高于导航与 BGM 胶囊(40)、低于弹窗(50)；本组件自己的关闭层 41 / 面板 42 仍在胶囊之下，
     所以「面板开着时还能点另一个胶囊」（见 .dock-pill 的 z-index:43）。 */
  z-index: 46;
  display: flex;
  align-items: center;
  gap: 5px;
  max-width: calc(100vw - 40px);
  justify-content: flex-end;
  flex-wrap: wrap;
}
.dock-pill {
  /* ⚠️ 必须抬到点外关闭层之上（层级都在 `.head-strips` 这个 z-index:20 的上下文里）：
     否则面板一旦打开，透明层就盖住胶囊 → **切不了块**（只能先关再开），实测点第二个胶囊会一直等超时。
     43 > 关闭层 41、也 > 面板 42；面板在底栏**上方**弹出，两者不重叠。 */
  position: relative;
  z-index: 43;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  /* 高度与 BGM 胶囊共用同一个 token（2026-09-21 用户要求「BGM 胶囊大小适配成旁边五个胶囊」）：
     两者在右下角排成**一条**胶囊带，高矮必须一致 —— 改高度只改 `main.css` 的 `--dock-pill-h`。 */
  height: var(--dock-pill-h);
  font-size: 12px;
  color: var(--text);
  background: rgba(var(--panel-rgb), 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
}
.dock-pill:hover { border-color: var(--primary); }
.dock-pill--on { border-color: var(--primary); background: rgba(var(--primary-tint-rgb), 0.14); }
.dock-pill-icon { flex: 0 0 auto; }
/* 「有事可做」的点（原顶栏 ⚡ 的点：每日任务可领 / 未领邮件） */
.dock-pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--muted);
  flex: 0 0 auto;
}
.dock-pill-dot.dot-on { background: var(--bad); box-shadow: 0 0 6px var(--bad); }
.dock-pill-text { flex: 0 0 auto; }
.dock-pill-num { flex: 0 0 auto; font-size: 11px; color: var(--text-dim); }
.dock-pill-bar {
  flex: 0 0 auto;
  width: 46px;
  display: flex;
  align-items: center;
}
/* ⚠️ 容器是 flex ⇒ 子组件成 flex 项、按内容算宽（ProgressBar 根会塌成 0 宽，进度条看不见） */
.dock-pill-bar > :deep(.progress-bar) {
  flex: 1 1 auto;
  width: 100%;
}
.dock-pill-caret { flex: 0 0 auto; opacity: 0.6; font-size: 10px; }

/* 透明点外关闭层（盖住整屏，但不改配色） */
.dock-catcher {
  position: fixed;
  inset: 0;
  z-index: 41;
  background: transparent;
}
/* 面板：从底栏**向上**弹出（`bottom: 100%`），右侧留出 BGM 胶囊的位置（与 `.head-strips` 的 padding-right 同源） */
.dock-panel {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 42;
  width: min(520px, calc(100vw - 40px));
  max-height: min(70vh, 620px);
  display: flex;
  flex-direction: column;
  background: rgba(var(--panel-rgb), 0.97);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  border-radius: 12px;
  /* ⚠️ 只留外阴影，**不要** `inset 0 1px 0 rgba(var(--glass-rgb), …)` 这种白色内高光：
     深色体检（e2e-dark）会把它判成「白边/白辉」（计算值就是 rgba(255,255,255,α)），
     而深色主题里 `.card` 的那条是被专门覆盖掉的 —— 新容器别自己又加回来。 */
  box-shadow: 0 8px 28px rgba(var(--scrim-rgb), 0.28);
  overflow: hidden;
}
.dock-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}
.dock-hint {
  font-size: 11px;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dock-panel-body {
  overflow-y: auto;
  padding: 10px 12px;
}
.dock-task {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 4px;
  font-size: 12px;
  min-width: 0;
}
.dock-task.paused { opacity: 0.7; }
.dock-task.waiting { border-style: dashed; }
.dock-task-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dock-task-bar {
  flex: 0 0 auto;
  width: 90px;
  display: flex;
  align-items: center;
}
.dock-task-bar > :deep(.progress-bar) { flex: 1 1 auto; width: 100%; }
.dock-task-state { flex: 0 0 auto; font-size: 11px; }
.dock-empty { font-size: 12px; }
/* 面板里的状态块（原右栏样式是整列卡片，这里去掉卡片底距贴合面板） */
.dock-status :deep(.card) { margin-bottom: 8px; }
/* 窄屏：BGM 胶囊只留图标（宽度收窄到约 136px）⇒ 胶囊组整体右移一点，别压到它 */
/* 手机（≤720）：BGM 胶囊此时只留图标（名字隐藏，宽约 150px）⇒ 本组右距收到 168px，
   实测 390px 下与 BGM 仍有 8px 间隙、自身只占 1 行、不产生横向滚动。
   ⚠️ 721~940 段**不要**改右距：那段 BGM 仍是完整胶囊（228px），改了就会压上去。 */
@media (max-width: 720px) {
  /* 窄屏：BGM 胶囊只留图标（宽 149.6）⇒ 14 + 149.6 + 5 ≈ 169 */
  .dock { right: 169px; }
  /* 窄屏只留图标与角标（一行放得下 5 个） */
  .dock-pill-text, .dock-pill-bar { display: none; }
  /* 再收紧：5 个图标胶囊必须挤进 222px（否则折成两排，底栏上方多出一行） */
  .dock { gap: 4px; }
  .dock-pill { padding: 3px 5px; gap: 3px; }
  .dock-pill-caret { display: none; }
  /* ⚠️ 面板改**视口定位**：手机上胶囊组只占右侧一小段，以它为基准会算到 left=-128（实测）。
     改成左右各留 8px、底边抬到导航(56px)之上。 */
  .dock-panel {
    position: fixed;
    left: 8px;
    right: 8px;
    bottom: 96px;
    width: auto;
    max-height: min(60vh, 520px);
  }
}
</style>
