<script setup>
// 厨神试炼（2026-09-10 新增）— 限制条件挑战：指定对手 + 达成条件 → 首次通关大奖。
// 对手由 trialOpponent()（opp() 动态生成）产出，与试炼塔/秘境同模式；判定读取 combat:end 附带的回合/血量。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getCombat } from '../game/combat/Combat.js'
import { TRIALS, TRIAL_UNLOCK_LEVEL, trialOpponent } from '../game/data/trials.js'
import { getItem } from '../game/data/items.js'
import CombatPanel from '../components/CombatPanel.vue'

const player = usePlayerStore()
const ui = useUiStore()
const combat = getCombat()

const unlocked = computed(() => player.trialsUnlocked())
const rows = computed(() =>
  TRIALS.map((def) => {
    const st = player.trialState(def.id)
    return {
      def,
      clears: st.clears ?? 0,
      best: st.best ?? 0,
      streak: st.streak ?? 0,
      bestText: bestTextOf(def, st),
      active: player.activeTrial === def.id,
      oppLevel: Math.min(99, player.combatLevel + def.levelOffset),
    }
  })
)
const totalClears = computed(() => player.stats?.trialClears ?? 0)
// 最佳记录：回合制看最少回合、其余看最高剩余品鉴值（未通关/旧档无精确记录时回退到 0~100 综合分）
function bestTextOf(def, st) {
  const clears = st.clears ?? 0
  if (!clears) return '尚未通关'
  if (def.cond.type === 'turns') {
    if (st.bestTurns != null) return `最快 ${st.bestTurns} 回合`
    return st.best > 0 ? `最快约 ${Math.max(1, 100 - st.best)} 回合` : '—'
  }
  if (st.bestHp != null) return `最高剩余 ${st.bestHp}% 品鉴值`
  return st.best > 0 ? `最高剩余约 ${st.best}% 品鉴值` : '—'
}
// 重复通关的金币收益（首通后按 30% 结算）
function repeatGold(def) {
  return Math.round((def.reward.gold ?? 0) * 0.3)
}

function start(r) {
  const c = combat
  if (!c) {
    ui.pushLog('战斗模块未就绪', 'warn')
    return
  }
  if (c.inFight) {
    ui.pushLog('战斗进行中，请先结束当前对决', 'warn')
    return
  }
  const ok = player.trialStart(r.def.id)
  if (!ok.ok) {
    ui.pushLog(ok.msg, 'warn')
    return
  }
  c.start(trialOpponent(r.def, player.combatLevel))
  ui.pushLog(`🏅 ${r.def.name}开始：${r.def.desc}`, 'info')
}
function abort(r) {
  if (!r.active) return
  player.trialAbort()
  ui.pushLog('已退出试炼', 'info')
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'arena', label: '🏆 竞技场' }, { view: 'chefChallenge', label: '🃏 名厨' }, { view: 'gearContest', label: '🃏 厨具赛' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🏅 厨神试炼</h2>
        <p class="dim">
          四条限制挑战：达成条件即通关——<b>首次通关</b>拿大奖，之后重复通关按 30% 金币结算。
          对手等级随你的对决等级水涨船高（封顶 99）。
        </p>
      </div>
    </header>

    <div v-if="!unlocked" class="card status-line">
      <span class="badge">🔒 未解锁</span>
      <span class="dim">需对决 Lv{{ TRIAL_UNLOCK_LEVEL }} 解锁试炼（当前 Lv{{ player.combatLevel }}）</span>
    </div>

    <template v-else>
      <div class="card status-line">
        <span class="badge badge-on">累计通关 {{ totalClears }} 次</span>
        <span class="dim">试炼失败会自动退出（连胜试炼除外，失败即连胜清零）</span>
      </div>

      <!-- 对决面板（风格+属性组合框 / 对决框）：与对决页共用 CombatPanel -->
    <CombatPanel />

    <div class="trial-grid">
        <div v-for="r in rows" :key="r.def.id" class="card trial-card" :class="{ active: r.active }">
          <div class="trial-head">
            <span class="trial-icon">{{ r.def.icon }}</span>
            <div>
              <strong>{{ r.def.name }}</strong>
              <div class="dim trial-sub">{{ r.def.desc }}</div>
            </div>
          </div>

          <div class="dim trial-sub">
            对手 Lv{{ r.oppLevel }} · 通关 {{ r.clears }} 次<template v-if="r.def.cond.type === 'streak'"> · 当前连胜 {{ r.streak }}/{{ r.def.cond.value }}</template>
          </div>
          <div class="trial-best">
            <span class="badge" :class="{ 'badge-on': r.clears > 0 }">🏆 {{ r.bestText }}</span>
            <span v-if="r.clears > 0" class="dim trial-sub">重复通关 +{{ repeatGold(r.def).toLocaleString() }} 金币/次</span>
          </div>
          <div class="dim trial-sub">
            首通奖励：{{ r.def.reward.gold.toLocaleString() }} 金币<template v-for="(q, id) in r.def.reward.items" :key="id"> + {{ getItem(id)?.name ?? id }} ×{{ q }}</template>
          </div>

          <button class="btn btn-sm btn-primary" :disabled="r.active" @click="start(r)">
            {{ r.active ? '进行中…' : '开始试炼' }}
          </button>
          <button v-if="r.active" class="btn btn-sm" @click="abort(r)">退出试炼</button>
        </div>
      </div>

      <p class="dim" style="margin-top: 10px">
        提示：试炼对手沿用你的自动进食/料理策略；速攻与无伤试炼建议带足高回血料理后再来。
      </p>
    </template>
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.trial-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.trial-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.trial-card.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}
.trial-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.trial-icon {
  font-size: 22px;
}
.trial-sub {
  font-size: 12px;
  line-height: 1.5;
}
.trial-best {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
