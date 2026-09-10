<script setup>
// 名厨挑战（2026-09-10 新增）— 每周一位名厨（按周确定性轮换），固定流派、等级随你对决等级上浮；战胜即拿大奖（每周一次）。
// 对手由 chefOpponent()（opp() 动态生成）产出，与试炼塔/秘境同模式；不触碰对决铁律数据。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getCombat } from '../game/combat/Combat.js'
import { CHEFS, chefForWeek, chefOpponent, chefReward } from '../game/data/chefChallenges.js'
import { STYLE_INFO } from '../game/data/combat.js'
import { getItem } from '../game/data/items.js'
import CombatPanel from '../components/CombatPanel.vue'

const player = usePlayerStore()
const ui = useUiStore()
const combat = getCombat()

const weekNum = Math.floor(Date.now() / (7 * 24 * 3600_000))
const chef = computed(() => chefForWeek(weekNum))
const cleared = computed(() => player.chefClearedThisWeek())
const active = computed(() => player.chefChallenge?.current === chef.value.id)
const oppLevel = computed(() => Math.max(1, Math.min(99, player.combatLevel + (chef.value.levelOffset ?? 4))))
const reward = computed(() => chefReward(chef.value, player.combatLevel))
const wins = computed(() => player.stats?.chefWins ?? 0)

// 下周刷新倒计时（按 epoch 周整点）
const nextWeekMs = computed(() => (weekNum + 1) * 7 * 24 * 3600_000 - Date.now())
const nextWeekText = computed(() => {
  const ms = Math.max(0, nextWeekMs.value)
  const d = Math.floor(ms / 86400_000)
  const h = Math.floor((ms % 86400_000) / 3600_000)
  return `剩 ${d} 天 ${h} 小时`
})

// 本周名厨在名单中的序号（提示轮换）
const nextChef = computed(() => CHEFS[(CHEFS.indexOf(chef.value) + 1) % CHEFS.length])

function start() {
  const c = combat
  if (!c) { ui.pushLog('战斗模块未就绪', 'warn'); return }
  if (c.inFight) { ui.pushLog('战斗进行中，请先结束当前对决', 'warn'); return }
  const ok = player.chefStart()
  if (!ok.ok) { ui.pushLog(ok.msg, 'warn'); return }
  c.start(chefOpponent(chef.value, player.combatLevel))
  ui.pushLog(`🃏 挑战名厨「${chef.value.name}」：${chef.value.say}`, 'info')
}
function abort() {
  if (!active.value) return
  combat?.stop?.()
  player.chefAbort()
  ui.pushLog('已退出名厨挑战', 'info')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🃏 名厨挑战</h2>
        <p class="dim">
          每周一位名厨坐镇：<b>固定流派</b>（按你流派克制关系打法）、对手等级比你对决等级高
          <b>3~9 级</b>（封顶 99）。<b>战胜</b>即通过，每周一次；失败可重复挑战，不限次数。
          本周名厨每周一 00:00（UTC 周）轮换。
        </p>
      </div>
    </header>

    <!-- 对决面板（风格+属性组合框 / 对决框）：与对决页共用 CombatPanel -->
    <CombatPanel />

    <div class="card status-line">
      <span class="badge" :class="cleared ? 'badge-on' : ''">{{ cleared ? '✅ 本周已战胜' : '⏳ 本周未战胜' }}</span>
      <span class="dim">累计战胜名厨 <b class="mono">{{ wins }}</b> 位 · 下一位名厨：{{ nextWeekText }}</span>
    </div>

    <div class="card chef-card" :class="{ done: cleared }">
      <div class="chef-head">
        <span class="chef-icon">{{ chef.icon }}</span>
        <div>
          <strong>{{ chef.name }}</strong>
          <div class="dim chef-sub">
            流派：<b>{{ STYLE_INFO[chef.style].name }}</b> · {{ STYLE_INFO[chef.style].desc }}
          </div>
        </div>
      </div>

      <blockquote class="chef-say">“{{ chef.say }}”</blockquote>

      <div class="chef-row">
        <span class="dim">对手等级</span>
        <span class="mono">Lv{{ oppLevel }}（你 Lv{{ player.combatLevel }} + {{ chef.levelOffset }}）</span>
      </div>
      <div class="chef-row">
        <span class="dim">通过奖励</span>
        <span class="mono">
          {{ reward.gold.toLocaleString() }} 金币<template v-for="(q, id) in reward.items" :key="id"> · {{ getItem(id)?.name ?? id }} ×{{ q }}</template>
        </span>
      </div>
      <div class="chef-row">
        <span class="dim">克制提示</span>
        <span class="dim">
          <template v-if="chef.style === 'knife'">刀工流被<b>调味流</b>克制 —— 用调味流派/调味系料理更省力</template>
          <template v-else-if="chef.style === 'plating'">摆盘流被<b>刀工流</b>克制 —— 用刀工流派/刀工系料理更省力</template>
          <template v-else>调味流被<b>摆盘流</b>克制 —— 用摆盘流派/摆盘系料理更省力</template>
        </span>
      </div>

      <template v-if="cleared">
        <div class="dim chef-sub">✅ 本周已战胜该名厨，下周再来（下一位：{{ nextChef.icon }} {{ nextChef.name }}）</div>
      </template>
      <template v-else>
        <button class="btn btn-sm btn-primary" :disabled="active" @click="start">
          {{ active ? '挑战中…' : '开始挑战' }}
        </button>
        <button v-if="active" class="btn btn-sm" @click="abort">退出挑战</button>
      </template>
    </div>

    <div class="card">
      <div class="chef-h">📋 名厨名录（按周轮换）</div>
      <div class="chef-list">
        <div
          v-for="c in CHEFS"
          :key="c.id"
          class="chef-li"
          :class="{ now: c.id === chef.id }"
        >
          <span class="chef-icon-sm">{{ c.icon }}</span>
          <span class="chef-li-name">{{ c.name }}</span>
          <span class="dim mono">{{ STYLE_INFO[c.style].name }}</span>
          <span class="dim mono">+{{ c.levelOffset }} 级</span>
          <span v-if="c.id === chef.id" class="badge badge-on">本周</span>
        </div>
      </div>
    </div>

    <p class="dim" style="margin-top: 10px">
      提示：名厨沿用你的自动进食/料理策略；开打前记得在<b>班底</b>与<b>信仰</b>页确认加成、备足高回血料理。
    </p>
  </div>
</template>

<style scoped>
.chef-card {
  margin-top: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 620px;
}
.chef-card.done {
  opacity: 0.92;
}
.chef-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.chef-icon {
  font-size: 30px;
}
.chef-icon-sm {
  font-size: 18px;
}
.chef-sub {
  font-size: 12px;
  line-height: 1.5;
}
.chef-say {
  margin: 0;
  padding: 8px 12px;
  font-size: 13px;
  font-style: italic;
  border-left: 3px solid var(--border);
  background: var(--bg-soft);
  border-radius: 0 6px 6px 0;
}
.chef-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}
.chef-h {
  font-weight: 600;
  margin-bottom: 8px;
}
.chef-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.chef-li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px dashed var(--border);
  background: var(--bg-soft);
}
.chef-li.now {
  border-style: solid;
  border-color: var(--accent, #d95a38);
}
.chef-li-name {
  min-width: 84px;
}
</style>
