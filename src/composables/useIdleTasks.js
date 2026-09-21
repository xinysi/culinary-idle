// 挂机任务列表（2026-09-19 从 StatusPanel 抽成共用 composable）。
// 状态抽屉的「⚡ 挂机中」块与中间底栏的挂机中条**读同一份数据** —— 抽出来是为了不让两处
// 各自算一遍（那种「同一份状态两套真相」的改动，迟早会出现「底栏显示在跑、抽屉显示暂停」）。
// ⚠️ 依赖 `ui.loopTick`，所以调用方必须在渲染期读它（computed 里读一次即可）。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getAllSkillInstances } from '../game/skills/registry.js'

export function useIdleTasks() {
  const player = usePlayerStore()
  const ui = useUiStore()

  /** 全局挂机任务（含暂停/超限展示；已关闭的不显示；并行上限内才实际运行） */
  const runningTasks = computed(() => {
    ui.loopTick // 每引擎 tick 重算（进度实时）
    const running = new Set(player.getRunningIdleSkills().map((i) => i.id))
    const tasks = []
    for (const inst of getAllSkillInstances()) {
      if (!inst || !['gathering', 'exploration'].includes(inst.type)) continue
      if (player.closedIdleTasks?.[inst.id]) continue
      const t = inst.currentTarget
      if (!t || inst.level < t.reqLevel) continue
      tasks.push({
        id: inst.id,
        inst,
        target: t,
        paused: player.isSkillPaused(inst.id),
        running: running.has(inst.id),
        pct: inst.progressPct,
        spiritXp: player.spiritEffects?.()?.xpPct?.[inst.id] ?? 0,
        durationMs: inst.intervalMs ? inst.intervalMs(t) : 0,
        cycleStartAt: inst.cycleStartAt ?? 0,
        active: running.has(inst.id) && !player.isSkillPaused(inst.id) && !player.closedIdleTasks?.[inst.id],
      })
    }
    return tasks
  })

  const parallelLimit = computed(() => player.settings.maxParallelIdle ?? 0)

  return { runningTasks, parallelLimit }
}
