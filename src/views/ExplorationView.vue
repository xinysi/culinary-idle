<script setup>
// 美食探索视图 — 需求文档 §3.4.3：目标选择 / 成功率 / 掉落预览 / 失败惩罚
// 卡片式 UI：**与采集/制作页同一套**（2026-09-27 用户①「展示方式采用和其它技能一样的」）——
//   同一批 `.era-tabs` 等级段标签页（10 级一档 + 段名 = 该档最高级目标）、同一批 `.gather-card` 结构、
//   同样的精通行 + 精通进度条 + 顶部的精通池条（MasteryPoolBar）。
import { computed, ref, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { getSkillDef } from '../game/data/skills.js'
import { itemImage } from '../game/data/itemImage.js'
import { LOW_TARGET_NOTE, LOW_TARGET_CHIP } from '../game/core/growthRate.js'
import { levelEras } from '../game/data/levelEras.js'
import { masteryXpMultiplier } from '../game/core/mastery.js'
import { EXPLORE_SUCCESS_CAP, EXPLORE_CAP_TEXT, exploreBandFactor, exploreMasteryPP } from '../game/data/explorationBalance.js'
import { EXPLORE_GEAR_ITEMS, EXPLORE_GEAR_DROP_CHANCE } from '../game/data/explorationGear.js'
import ProgressBar from '../components/ProgressBar.vue'
import MasteryPoolBar from '../components/MasteryPoolBar.vue'

const props = defineProps({
  instance: { type: Object, required: true },
})
const player = usePlayerStore()
const ui = useUiStore()

const skillClosed = computed(() => !!player.closedIdleTasks?.[props.instance.id])

/** 这个目标是否吃「低目标经验减半」——判定走实例的唯一出口（`Skill.isLowTargetLevel`），视图不自己算 */
const isLow = (t) => props.instance.isLowTargetLevel(t.reqLevel)
function isUnlocked(id) {
  const t = props.instance.targets.find((x) => x.id === id)
  return t ? props.instance.level >= t.reqLevel : false
}
function isSelected(id) {
  return (player.getSkillTarget(props.instance.id) ?? player.activeTarget) === id
}
function selectTarget(id) {
  if (isSelected(id) && !skillClosed.value) {
    player.closeIdleTask(props.instance.id)
    ui.pushLog(`已删除${getSkillDef(props.instance.id)?.name}挂机任务（停止并隐藏，重新选择即恢复）`, 'warn')
    return
  }
  player.setSkillTarget(props.instance.id, id)
  player.reopenIdleTask(props.instance.id)
  props.instance.timerMs = 0
  props.instance.cycleStartAt = performance.now()
}
function lootLine(l) {
  // 概率必须走技能实例的 lootChance（= 难度系数后的实际值；金币原样）——直接读 l.chance 会
  // 显示成 28% 而实际按 7% 结算（2026-09-27 物品系数改为 ÷4 后差距更大）
  const pct = (props.instance.lootChance(l) * 100).toFixed(2).replace(/\.?0+$/, '')
  return l.type === 'gold' ? `金币 ${l.min}-${l.max}（${pct}%）` : `${getItem(l.itemId)?.name} ×${l.min}-${l.max}（${pct}%）`
}

// ── 等级段：与采集/制作共用 `levelEras`（10 级一档 + 段名 = 该档最高级目标）──
const sections = computed(() => levelEras(props.instance?.targets ?? [], (t) => t.reqLevel, (t) => t.id))
const selectedEra = ref(null)
watch(sections, (list) => {
  if (!list.length) return
  if (!selectedEra.value || !list.some((s) => s.label === selectedEra.value)) {
    // 默认停在「玩家当前能打到的最高段」——与采集页一致
    const mine = list.filter((s) => props.instance.level >= parseInt(s.label, 10))
    selectedEra.value = (mine.length ? mine[mine.length - 1] : list[0]).label
  }
}, { immediate: true })
const activeSec = computed(() => sections.value.find((s) => s.label === selectedEra.value) ?? null)
function selectEra(label) { selectedEra.value = label }
/** 段名 = 该档最高级目标（`levelEras` 只给 topId，名字从本技能目标表里取，与采集页同口径） */
function eraName(sec) {
  if (!sec) return null
  return props.instance.targets.find((t) => t.id === sec.topId)?.name ?? null
}
const currentTargetId = computed(() => props.instance.currentTarget?.id ?? null)

// ── 成功率的三个来源，分开显示（用户要求「每个卡片独立计算成功率」）──
const masteryLevelOf = (t) => props.instance.masteryLevelOf(t)
const masteryPP = (t) => exploreMasteryPP(masteryLevelOf(t))
const poolPP = computed(() => (player.masteryPoolBonus?.(props.instance.id)?.successPP ?? 0) / 100)
const gearPP = computed(() => props.instance.gearSuccessPP())
const initialPct = (t) => props.instance.initialChance(t)
const finalPct = (t) => props.instance.successChance(t)
/** 装备加成能把卡片顶到多少（同一张卡 + 玩家的装备） */
const capPct = (t) => Math.min(1, Math.min(EXPLORE_SUCCESS_CAP, initialPct(t) + masteryPP(t) + poolPP.value) + gearPP.value)
const bandFactor = (t) => exploreBandFactor(t.reqLevel)
</script>

<template>
  <div>
    <!-- 精通池（技能级共享）——与采集页同一个组件、同一套里程碑 -->
    <MasteryPoolBar
      :skill-id="instance.id"
      :card-key="currentTargetId"
      :card-name="instance.currentTarget?.name ?? ''"
      :card-count="currentTargetId ? (instance.mastery[currentTargetId] ?? 0) : 0"
      mode="gather"
    />

    <div class="card">
      <h3 class="target-head-row">
        <span>探索目标</span>
        <span class="dim low-target-hint" :title="LOW_TARGET_NOTE">低目标经验 ×0.5</span>
        <span class="dim target-head-extra">初始成功率随等级段递减（末段趋 0%），靠精通与专属装备补回</span>
      </h3>

      <!-- 等级段标签页（与采集/制作同款：点段切换，段名 = 该档最高级目标） -->
      <div v-if="sections.length > 1" class="era-tabs">
        <button
          v-for="sec in sections"
          :key="sec.label"
          class="btn btn-sm era-tab"
          :class="{ 'btn-primary': selectedEra === sec.label }"
          @click="selectEra(sec.label)"
        >
          {{ sec.label }}
          <span v-if="eraName(sec)" class="era-tab-name">{{ eraName(sec) }}</span>
        </button>
      </div>
      <div v-if="activeSec" class="era-head">
        <span v-if="eraName(activeSec)" class="era-name" :title="`本档最高级目标：${eraName(activeSec)}`">{{ eraName(activeSec) }}</span>
        <span class="dim">{{ activeSec.list.length }} 个目标</span>
        <span class="dim">段位系数 ×{{ bandFactor(activeSec.list[0]).toFixed(2) }}</span>
        <span v-if="activeSec.list.some((t) => isSelected(t.id) && !skillClosed)" class="badge badge-on">当前</span>
      </div>

      <div v-if="activeSec" class="gather-grid">
        <div
          v-for="t in activeSec.list"
          :key="t.id"
          class="gather-card"
          :class="{ locked: !isUnlocked(t.id), selected: isSelected(t.id) && !skillClosed }"
        >
          <div class="gather-card-head">
            <div>
              <strong>{{ t.name }}</strong><span v-if="!isUnlocked(t.id)" class="lock-flag" title="需 Lv {{ t.reqLevel }} 解锁">🔒</span>
              <div class="dim" style="font-size: 12px">Lv {{ t.reqLevel }} 解锁</div>
            </div>
          </div>
          <div class="gather-card-row">
            <span :title="isLow(t) ? LOW_TARGET_NOTE : ''">基础经验</span>
            <span class="mono" :title="isLow(t) ? LOW_TARGET_NOTE : ''">{{ t.xp }}<span v-if="isLow(t)" class="xp-low-chip" :title="LOW_TARGET_NOTE">{{ LOW_TARGET_CHIP }}</span></span>
          </div>
          <div class="gather-card-row">
            <span>间隔</span>
            <span :class="['mono', masteryLevelOf(t) >= 5 ? 'mastery-hl' : '']">
              {{ (instance.intervalMs(t) / 1000).toFixed(2) }}s<template v-if="instance.intervalMode(t) === 'fixed'"><span class="dim" style="font-size: 11px">&nbsp;· 固定档</span></template>
            </span>
          </div>
          <div class="gather-card-row">
            <span>成功率</span>
            <span class="mono">{{ (finalPct(t) * 100).toFixed(1) }}%<span v-if="capPct(t) > finalPct(t) + 1e-9" class="dim" style="font-size: 11px">&nbsp;· 满精通 {{ (capPct(t) * 100).toFixed(0) }}%</span></span>
          </div>
          <!-- 成功率的来源拆开显示（初始 / 精通 / 池 / 装备）；上限 90% + 装备补足剩下的 10% -->
          <div class="gather-card-row exploit-succ-split">
            <span class="dim" title="初始成功率 = 卡片基础值 × 段位系数（越往后越低，末段趋 0）；上限 90% 不含装备">明细</span>
            <span class="dim mono" style="font-size: 11px">
              初始 {{ (initialPct(t) * 100).toFixed(1) }}% + 精通 {{ (masteryPP(t) * 100).toFixed(0) }}pp<span v-if="poolPP > 0"> + 池 {{ (poolPP * 100).toFixed(0) }}pp</span><span v-if="gearPP > 0"> + 装备 {{ (gearPP * 100).toFixed(1) }}pp</span>
            </span>
          </div>
          <div class="gather-card-row">
            <span>精通</span>
            <span class="mono">{{ masteryLevelOf(t) }} / 100 级<span v-if="masteryLevelOf(t) >= 5" class="mastery-hl">&nbsp;· 经验 ×{{ masteryXpMultiplier(masteryLevelOf(t)) }}</span></span>
          </div>
          <ProgressBar :progress="instance.masteryProgress(t).progress" class="mastery-bar" />
          <div class="dim mono" style="font-size: 12px; text-align: right">
            {{ instance.masteryProgress(t).current }} / {{ instance.masteryProgress(t).needed }} 次
          </div>
          <div class="gather-card-row">
            <span>失败代价</span>
            <span class="mono">{{ t.failGold }} 金币{{ t.failGold > 10 ? '或品鉴值' : '' }}</span>
          </div>
          <div class="gather-card-divider"></div>
          <div class="loot-list">
            <div v-for="(l, i) in t.loot" :key="i" class="loot-row">
              <img
                v-if="l.type === 'gold'"
                :src="'images/coin.png'"
                class="loot-img"
                alt="" loading="lazy" decoding="async" />
              <img
                v-else-if="l.type === 'item' && itemImage(l.itemId)"
                :src="itemImage(l.itemId)"
                class="loot-img"
                @error="$event.target.style.display = 'none'"
                alt="" loading="lazy" decoding="async" />
              <span class="mono loot-text">{{ lootLine(l) }}</span>
            </div>
          </div>
          <button
            class="btn btn-sm"
            :disabled="!isUnlocked(t.id)"
            :class="{ 'btn-primary': isSelected(t.id) && !skillClosed }"
            @click="selectTarget(t.id)"
          >
            {{ isSelected(t.id) && !skillClosed ? '探索中' : '选择' }}
          </button>
        </div>
      </div>
    </div>

    <p class="dim special-note">
      失败惩罚：损失目标对应金币（金币不足则损失 10% 最大品鉴值）。
      卡片成功率上限 {{ EXPLORE_CAP_TEXT }}，其余 {{ 100 - Math.round(EXPLORE_SUCCESS_CAP * 100) }}% 由两套专属装备补足
      （{{ EXPLORE_GEAR_ITEMS.length }} 件，每次成功探索 {{ (EXPLORE_GEAR_DROP_CHANCE * 100).toFixed(3) }}% 掉落）。
    </p>
  </div>
</template>
