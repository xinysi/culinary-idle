<script setup>
// 对决面板（2026-09-10 从 CombatView 抽出；2026-09-19 拆分）— 「风格 + 属性两栏」，
// 战斗屏抽成 `CombatArena`（左上角放「战备」`CombatLoadout`）供所有战斗页共用；
// 战斗日志 `CombatLog` 自 2026-09-21 起由各战斗页摆在右栏（与装备槽互换位置）。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { getCombat } from '../game/combat/Combat.js'
import { STYLE_INFO, STYLE_ADVANTAGE } from '../game/data/combat.js'
import { bindTip } from '../composables/useFixedTooltip.js'
import CombatArena from './CombatArena.vue'
import CombatLoadout from './CombatLoadout.vue'
import EquipmentSlots from './EquipmentSlots.vue'

const player = usePlayerStore()
const combat = getCombat()

const STYLES = ['knife', 'plating', 'flavor']
const BUFF_LABEL = { atk: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', speed: '攻速', duration: '持续' }

const combatLevel = computed(() => player.combatLevel)
const pStats = computed(() => combat?.playerStats() ?? {})
const inFight = computed(() => combat?.inFight ?? false)

// ── 属性面板（2026-09-19 参照 Melvor 拆「进攻 / 防御」两栏）──────────────
// 「伤害减免」与「暴击伤害」此前界面上没有、但伤害公式里真实存在（def/(def+100)、暴击 ×2），
// 玩家看不出防御到底减了多少伤。数值一律从引擎的只读 getter 取，不在组件里重算。
const reductionPct = computed(() => combat?.reductionPct?.(pStats.value.defense ?? 0) ?? 0)
const critMult = computed(() => combat?.critMultiplier?.() ?? 2)
// 克制加成（+15%）：数值取自引擎 getter，避免界面与伤害公式两套真相
const advPct = computed(() => Math.round(((combat?.advantageMultiplier?.() ?? 1.15) - 1) * 100))
const offense = computed(() => [
  { k: '攻击伤害', v: Math.round(pStats.value.attack ?? 0), hint: '每回合的基础伤害（未计克制/暴击）' },
  { k: '暴击率', v: `${((pStats.value.critChance ?? 0) * 100).toFixed(1)}%`, hint: '命中后按此概率触发暴击' },
  { k: '暴击伤害', v: `${Math.round(critMult.value * 100)}%`, hint: '暴击时伤害倍率' },
  { k: '准确率', v: Math.round(pStats.value.accuracy ?? 0), hint: '与对手闪避对抗，决定命中' },
  { k: '调味能量', v: pStats.value.flavorEnergy ?? 0, hint: '调味流每次冲击消耗 10 点' },
])
const defense = computed(() => [
  { k: '最大品鉴值', v: Math.round(pStats.value.maxHp ?? 0), hint: '生命上限，归零即战败' },
  { k: '防御力', v: Math.round(pStats.value.defense ?? 0), hint: '决定下方的伤害减免' },
  { k: '伤害减免', v: `${(reductionPct.value * 100).toFixed(1)}%`, hint: '每次受击按此比例减伤' },
  { k: '闪避率', v: Math.round(pStats.value.evasion ?? 0), hint: '与对手准确率对抗，决定是否被打中' },
  { k: '回合间隔', v: `${(pStats.value.speedMs / 1000).toFixed(1)}s`, hint: '每隔这么久自动打出一回合' },
])

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

function setStyle(style) {
  player.setCombatStyle(style)
}
function buffText() {
  const b = combat.buffs ?? {}
  return Object.entries(b).filter(([k]) => k !== 'duration').map(([k, v]) => `${BUFF_LABEL[k] ?? k} +${v}`).join('、') || '—'
}
</script>

<template>
  <div>
    <!-- 战斗屏（与竞技场/通天塔/秘境/试炼共用 CombatArena）；
         「战备」按用户要求摆进战斗屏**左上角**（点开选自动进食的料理） -->
    <CombatArena>
      <template #corner>
        <CombatLoadout />
      </template>
    </CombatArena>

    <!-- 装备槽（2026-09-21 用户要求：与「战斗日志」互换位置 —— 日志去右栏，装备留在左栏）
         八个槽位排成一排（见 EquipmentSlots 的定宽网格） -->
    <EquipmentSlots />

    <!-- 组合框：左「对决风格」（整列按钮）+ 中间虚线 + 右「属性面板」（进攻/防御两栏） -->
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
            <span class="style-adv" :class="{ 'style-adv--cur': player.combat.style === s }">
              克制 {{ STYLE_INFO[STYLE_ADVANTAGE[s]]?.name ?? STYLE_ADVANTAGE[s] }} · 伤害 +{{ advPct }}%
            </span>
          </button>
        </div>
        <!-- 2026-09-20 用户要求：这条说明从右侧「属性面板」挪到**三个风格按钮下方** -->
        <p class="dim style-note">调味冲击每次消耗 10 调味能量；每回合自动回复 +5，战斗中喝果茶/香草茶可大幅恢复（调酒制作）。</p>
      </div>
      <div class="combo-divider"></div>
      <div class="combo-right">
        <h3>属性面板 <span class="dim" style="font-size: 12px">对决等级 {{ combatLevel }}</span></h3>
        <div class="attr-cols">
          <div class="attr-col">
            <h4 class="attr-col-head">进攻</h4>
            <div
              v-for="a in offense"
              :key="a.k"
              class="stat"
              @mouseenter="bindTip($event)"
              @mousemove="bindTip($event)"
            >
              <div class="stat-num mono">{{ a.v }}</div>
              <div class="stat-label">{{ a.k }}</div>
              <div class="tooltip follow-tooltip">{{ a.hint }}</div>
            </div>
          </div>
          <div class="attr-col">
            <h4 class="attr-col-head">防御</h4>
            <div
              v-for="a in defense"
              :key="a.k"
              class="stat"
              @mouseenter="bindTip($event)"
              @mousemove="bindTip($event)"
            >
              <div class="stat-num mono">{{ a.v }}</div>
              <div class="stat-label">{{ a.k }}</div>
              <div class="tooltip follow-tooltip">{{ a.hint }}</div>
            </div>
          </div>
        </div>
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
  </div>
</template>

<style scoped>
/* 属性面板：进攻 / 防御两栏（2026-09-19，参照 Melvor 的属性分区） */
.attr-cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
}
.attr-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.attr-col-head {
  margin: 0;
  padding-bottom: 2px;
  border-bottom: 1px dashed rgba(var(--ink-rgb), 0.35);
  color: var(--primary);
}
.attr-cols .stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}
/* 数值说明改**悬浮显示**（2026-09-19 用户反馈「属性面板的描述太多了」）：
   常显两行小字把面板撑得很长，光标碰到数值/名称才显示。 */
.attr-cols .stat {
  cursor: help;
}
.attr-cols .stat:hover .tooltip {
  display: block;
}
/* 风格按钮：整列 + 「克制 X」标注 */
.style-adv {
  font-size: 12px;
  color: var(--good-strong);
}
.style-adv--cur {
  color: #fff;
  opacity: 0.95;
}
/* 调味能量说明（2026-09-20 从右侧属性面板挪到风格按钮下方） */
.style-note {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
}
@media (max-width: 900px) {
  .attr-cols {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
