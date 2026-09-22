<script setup>
// 对决面板（2026-09-10 从 CombatView 抽出；2026-09-19 拆分）— 「风格 + 属性两栏」，
// 战斗屏抽成 `CombatArena`（左上角放「战备」`CombatLoadout`）供所有战斗页共用；
// 战斗日志 `CombatLog` 自 2026-09-21 起由各战斗页摆在右栏（与装备槽互换位置）。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getCombat } from '../game/combat/Combat.js'
import { STYLE_INFO, STYLE_ADVANTAGE } from '../game/data/combat.js'
import { bindTip } from '../composables/useFixedTooltip.js'
import CombatArena from './CombatArena.vue'
import CombatLoadout from './CombatLoadout.vue'
import EquipmentSlots from './EquipmentSlots.vue'

const player = usePlayerStore()
const ui = useUiStore()
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
/** 受击减免（%）：奥义等来源的受伤乘区，由引擎统一暴露（`playerStats().damageTakenPct`） */
const takenPct = computed(() => Math.round(pStats.value.damageTakenPct ?? 0))
const critMult = computed(() => combat?.critMultiplier?.() ?? 2)
// 克制加成（+15%）：数值取自引擎 getter，避免界面与伤害公式两套真相
const advPct = computed(() => Math.round(((combat?.advantageMultiplier?.() ?? 1.15) - 1) * 100))
const offense = computed(() => [
  { k: '攻击伤害', v: Math.round(pStats.value.attack ?? 0), hint: '每回合的基础伤害（未计克制/暴击）' },
  { k: '暴击率', v: `${((pStats.value.critChance ?? 0) * 100).toFixed(1)}%`, hint: '命中后按此概率触发暴击' },
  // 「暴击伤害」的显示口径（2026-09-21 用户问「初始就 200% 合理吗」）：引擎里暴击是**伤害 ×2**（常规设计，
  //  配合 5% 暴击率只等于期望 +5% 伤害），但写成「200%」会被读成「额外 +200%」⇒ 改成倍率式「×2（+100%）」。
  { k: '暴击伤害', v: `${Math.round(critMult.value * 10) / 10}×（+${Math.round((critMult.value - 1) * 100)}%）`, hint: '暴击时的伤害倍率：×2 = 打出两倍伤害（不是额外 +200%）' },
  { k: '准确率', v: Math.round(pStats.value.accuracy ?? 0), hint: '与对手闪避对抗，决定命中' },
  { k: '调味能量', v: pStats.value.flavorEnergy ?? 0, hint: '调味流每次冲击消耗 10 点' },
])
const defense = computed(() => [
  { k: '最大品鉴值', v: Math.round(pStats.value.maxHp ?? 0), hint: '生命上限，归零即战败' },
  { k: '防御力', v: Math.round(pStats.value.defense ?? 0), hint: '决定下方的伤害减免' },
  { k: '伤害减免', v: `${(reductionPct.value * 100).toFixed(1)}%`, hint: '由防御力算出的减伤（def/(def+100)）' },
  // 受伤减免（2026-09-22）：奥义「铜墙铁壁」这类**直接按比例减少受击伤害**的加成，与「防御力」是两条独立乘区。
  // 此前界面上完全没有它 ⇒ 激活后防御/减伤数字一动不动，玩家看不出发生了什么（实测确认的显示缺口）。
  ...(takenPct.value > 0
    ? [{ k: '受击减免', v: `-${takenPct.value}%`, hint: '奥义等来源直接按比例减少你受到的伤害（与防御力相乘，不显示在防御力里）' }]
    : []),
  { k: '闪避率', v: Math.round(pStats.value.evasion ?? 0), hint: '与对手准确率对抗，决定是否被打中' },
  // 回合间隔（2026-09-22）：到 1.2s 硬地板时必须写出来 —— 否则玩家点了「攻速 +25%」的奥义却看不出任何变化
  // （地板常量与公式都在 caps.js，这里只读引擎给的结果，不重算）
  {
    k: '回合间隔',
    v: `${(pStats.value.speedMs / 1000).toFixed(1)}s${pStats.value.speedAtCap ? '（已到上限）' : ''}`,
    hint: pStats.value.speedAtCap
      ? `已达 ${(pStats.value.speedFloorMs / 1000).toFixed(1)}s 硬下限：此时的「攻速 +%」加成（奥义/秘境/饼干/宝石）都不会再缩短间隔`
      : '每隔这么久自动打出一回合；下限 1.2s',
  },
])

// 当前出站食灵的对决加成（§3.3.6）：在对决属性区明显展示
// 奥义续航（2026-09-22 用户批准「让难度可见」）：深塔连战里「品鉴点耗尽 → 全部奥义熄灭」
// 是实测到的真实断崖（tower_sim 两次扫描都出现「品鉴点最低 0」），但界面上原本完全看不见。
// 数字与 `drainAoji` **同一个出口**（`player.aojiUpkeep()` → `aojiCostPerSec()`），显示与结算同源。
const aojiKeep = computed(() => {
  ui.loopTick // 逐帧刷新：品鉴点在战斗中也持续下降
  return player.aojiUpkeep()
})

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
  // ⚠️ critChance 的数值是**小数**（0.1 = 10%）⇒ 必须按百分比显示。
  //    原先直接拼 `${v}`，面板写「暴击 +0.1」而神秘调料的日志写「暴击 +10」，同一个效果两种单位。
  return (
    Object.entries(b)
      .filter(([k, v]) => k !== 'duration' && (Number(v) || 0) !== 0) // 0 值不显示（避免「+0」噪声）
      .map(([k, v]) => `${BUFF_LABEL[k] ?? k} +${k === 'critChance' ? Math.round(Number(v) * 100) : v}`)
      .join('、') || '—'
  )
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
        <p v-if="aojiKeep.active.length" class="dim aoji-keep" :class="{ 'aoji-keep--low': aojiKeep.low }">
          <span class="badge badge-on">🌀 奥义续航</span>
          <span>
            品鉴点 <b class="mono">{{ aojiKeep.points.toLocaleString() }}</b>
            · 维持 {{ aojiKeep.active.length }} 个奥义 <b class="mono">-{{ aojiKeep.costPerSec }}/秒</b>
            <template v-if="aojiKeep.secondsLeft != null">
              ⇒ 约还能撑 <b class="mono">{{ aojiKeep.secondsLeft >= 3600 ? (aojiKeep.secondsLeft / 3600).toFixed(1) + ' 小时' : aojiKeep.secondsLeft >= 60 ? Math.floor(aojiKeep.secondsLeft / 60) + ' 分 ' + (aojiKeep.secondsLeft % 60) + ' 秒' : aojiKeep.secondsLeft + ' 秒' }}</b>
            </template>
          </span>
          <span v-if="aojiKeep.low" class="warn-text">⚠️ 快见底了：归零时全部奥义会<b>立刻熄灭</b>（深塔连战最容易在这里翻车）</span>
        </p>
        <p v-if="combat?.buffTurnsLeft?.() > 0" class="dim">增益 {{ combat.buffTurnsLeft() }} 回合：{{ buffText() }}</p>
        <p v-if="combat?.drunkTurns > 0" class="dim warn-text">🥴 醉酒中（命中 -15%）：{{ combat.drunkTurns }} 回合</p>
        <p v-if="player.combat.style === 'plating'" class="dim">🎨 装饰食材：<span class="mono">{{ player.inventory.garnish ?? 0 }}</span>（每次攻击消耗 1 个，杂货铺有售）</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 奥义续航（2026-09-22）：把「深塔里为什么突然打不动」提前告诉玩家 */
.aoji-keep { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; }
.aoji-keep--low { color: var(--warn); }
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
