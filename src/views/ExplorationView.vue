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
import { EXPLORE_GEAR_ITEMS, EXPLORE_GEAR_DROP_CHANCE, EXPLORE_GEAR_SETS } from '../game/data/explorationGear.js'
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
function lootName(l) {
  return l.type === 'gold' ? `金币 ${l.min}-${l.max}` : `${getItem(l.itemId)?.name} ×${l.min}-${l.max}`
}
function lootPct(l) {
  // 概率必须走技能实例的 lootChance（= 难度系数后的实际值；金币原样）——直接读 l.chance 会
  // 显示成 28% 而实际按 7% 结算（2026-09-27 物品系数改为 ÷4 后差距更大）
  return `${(props.instance.lootChance(l) * 100).toFixed(2).replace(/\.?0+$/, '')}%`
}
/** 一行掉落 = 「名称×数量」靠左 + 「概率」靠右（宽卡右栏宽 ~250px，概率右对齐才用得上这块宽度） */
function lootLine(l) {
  return `${lootName(l)}（${lootPct(l)}）`
}
/** 专属装备那一行的悬浮说明：说清「与目标无关」「成败都算」「两套各是哪两件」 */
const GEAR_TIP = `每次探索（成功与否都算）${(EXPLORE_GEAR_DROP_CHANCE * 100).toFixed(3)}% 掉出其中一件，与所打的目标无关；两套共 ${EXPLORE_GEAR_ITEMS.length} 件 —— ${EXPLORE_GEAR_SETS.map((s) => `${s.name}（${s.pieces.map((p) => p.name).join(' / ')}）`).join(' · ')}`

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
/** 精通带来的经验倍率（与采集页同一个出口；挂在「经验」格的数值旁，与采集页一致） */
const masteryXpMult = (t) => masteryXpMultiplier(masteryLevelOf(t))
/** 成功率的来源拆解 —— 2026-09-28 卡片重排后从常驻一行改为**这行的 tooltip**
 *  （原先那行「明细 初始 X% + 精通 Ypp + …」占 18px 且把卡片撑满；信息没丢，只是不再常驻）。 */
function succTip(t) {
  const parts = [
    `初始 ${(initialPct(t) * 100).toFixed(1)}%（基础值 × 段位系数 ${bandFactor(t).toFixed(2)}，越往后越低、末段 0%）`,
    `精通 ${(masteryPP(t) * 100).toFixed(0)}pp`,
  ]
  if (poolPP.value > 0) parts.push(`精通池 ${(poolPP.value * 100).toFixed(0)}pp`)
  if (gearPP.value > 0) parts.push(`专属装备 ${(gearPP.value * 100).toFixed(1)}pp（在上限之外相加）`)
  const cap = `上限 ${EXPLORE_CAP_TEXT}（不含装备）；满精通可达 ${(capPct(t) * 100).toFixed(0)}%`
  return `${parts.join(' + ')} ⇒ ${cap}`
}
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

      <!-- 宽卡网格（2026-09-28 用户：「为什么不能一个卡片改成两个卡片大小呢？现在这样太挤了太小了」）：
           每张卡 = 原两张卡的宽度（≥400px），卡内改**两栏**——左栏数值与精通、右栏掉落，
           底下一整条专属装备。字号/图标全部回到 12px / 24px（不再压缩），高度反而比原来矮。 -->
      <div v-if="activeSec" class="gather-grid gather-grid--wide">
        <div
          v-for="t in activeSec.list"
          :key="t.id"
          class="gather-card"
          :class="{ locked: !isUnlocked(t.id), selected: isSelected(t.id) && !skillClosed }"
        >
          <div class="gather-card-head">
            <div>
              <strong>{{ t.name }}</strong><span v-if="!isUnlocked(t.id)" class="lock-flag" title="需 Lv {{ t.reqLevel }} 解锁">🔒</span>
              <span class="dim ex-lv" :title="isUnlocked(t.id) ? `本档 ${t.reqLevel} 级可探索` : `需 Lv ${t.reqLevel} 解锁`">{{ isUnlocked(t.id) ? `Lv ${t.reqLevel}` : `需 Lv ${t.reqLevel}` }}</span>
            </div>
            <span class="dim ex-loot-count" title="这张卡的战利品条数（含金币）">{{ t.loot.length }} 项掉落</span>
          </div>

          <div class="ex-body">
            <!-- 左栏：数值 2×2 + 精通（列宽 ~230px ⇒ 半格 ~110px，标签与数值贴在一起，不像
                 整栏一行那样被拉成「标签在最左、数值在最右」的两半） -->
            <div class="ex-col">
              <div class="ex-stats">
                <div class="gather-card-row" :title="isLow(t) ? LOW_TARGET_NOTE : ''">
                  <span>经验</span>
                  <span class="mono">{{ t.xp }}<span v-if="masteryLevelOf(t) >= 5" class="mastery-hl">&nbsp;×{{ masteryXpMult(t) }}</span><span v-if="isLow(t)" class="xp-low-chip" :title="LOW_TARGET_NOTE">{{ LOW_TARGET_CHIP }}</span></span>
                </div>
                <div class="gather-card-row">
                  <span>间隔</span>
                  <span :class="['mono', masteryLevelOf(t) >= 5 ? 'mastery-hl' : '']">
                    {{ (instance.intervalMs(t) / 1000).toFixed(2) }}s<template v-if="instance.intervalMode(t) === 'fixed'"><span class="dim ex-tiny">&nbsp;固定</span></template>
                  </span>
                </div>
                <div class="gather-card-row">
                  <span>成功率</span>
                  <span class="mono ex-rate" :title="succTip(t)">{{ (finalPct(t) * 100).toFixed(1) }}%</span>
                </div>
                <div class="gather-card-row" :title="`失败：损失 ${t.failGold} 金币；金币不足则损失 10% 最大品鉴值`">
                  <span>失败</span>
                  <span class="mono">{{ t.failGold }} 金</span>
                </div>
              </div>
              <div class="gather-card-row ex-mastery">
                <span>精通</span>
                <span class="mono">{{ masteryLevelOf(t) }}<span class="dim">/100</span></span>
                <span class="dim mono ex-count">{{ instance.masteryProgress(t).current }}/{{ instance.masteryProgress(t).needed }} 次</span>
              </div>
              <ProgressBar :progress="instance.masteryProgress(t).progress" class="mastery-bar" />
            </div>

            <!-- 右栏：掉落预览（名称靠左、概率靠右 —— 右栏宽约 250px，概率右对齐才用得上这块宽度） -->
            <div class="ex-col ex-col--loot">
              <div class="loot-list">
                <div v-for="(l, i) in t.loot" :key="i" class="loot-row" :title="lootLine(l)">
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
                  <span class="mono loot-text">{{ lootName(l) }}</span>
                  <span class="mono loot-pct" title="实际结算概率（已含难度系数；金币不受系数影响）">{{ lootPct(l) }}</span>
                </div>
              </div>
            </div>

            <!-- 专属装备：**与目标无关**的独立掷骰（每次探索动作 0.01%），横跨两栏整条显示
                 （2026-09-28 用户：「我怎么没看到新装备出现在掉落里」⇒ 必须每张卡都看得到） -->
            <div class="loot-row loot-row--gear" :title="GEAR_TIP">
              <img
                v-for="g in EXPLORE_GEAR_ITEMS"
                :key="g.id"
                :src="itemImage(g.id)"
                class="loot-img loot-img--gear"
                @error="$event.target.style.display = 'none'"
                alt="" loading="lazy" decoding="async" />
              <span class="mono loot-text">专属装备 {{ EXPLORE_GEAR_ITEMS.length }} 件 · {{ (EXPLORE_GEAR_DROP_CHANCE * 100).toFixed(3) }}% 掉落（每次探索、与目标无关）</span>
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
      （{{ EXPLORE_GEAR_ITEMS.length }} 件，每次探索 {{ (EXPLORE_GEAR_DROP_CHANCE * 100).toFixed(3) }}% 掉落，成功与否都算）。
    </p>
  </div>
</template>

<style scoped>
/* ── 2026-09-28 卡片重排（用户：「卡片太长了而且很杂，需要重新设计大小和排版」→
      「为什么不能一个卡片改成两个卡片大小呢？现在这样太挤了太小了」）──
   改前单卡 434px 高、214px 宽（同屏 8 列）。现改为**宽卡两栏**：
   · 网格列宽 ≈ 原两张卡（≥400px，同屏 4 列左右）—— 玩家要的是「更大的卡」，不是把内容压小；
   · 卡内左右分栏：左 = 数值与精通，右 = 掉落预览；专属装备横跨两栏；
   · 字号 12px、掉落图标 24px 全部**回到正常尺寸**（上一版试过缩到 11px/16px，实测太挤）。
   实测高度 ≈ 250px（改前 434），且没有一行需要折行。 */

/* 宽卡网格：`min(400px, 100%)` 保证窄屏（<400px）不溢出 —— 直接写 minmax(400px,1fr)
   在 350px 的容器里会撑出横向滚动。 */
.gather-grid--wide {
  grid-template-columns: repeat(auto-fill, minmax(min(400px, 100%), 1fr));
}

/* 卡内两栏：左数值 / 右掉落；专属装备整条横跨（它与目标无关，视觉上不属于任何一栏）。
   两栏之间给一条虚线分隔 —— 没有它时「左栏右对齐的数值」紧挨着「右栏的掉落名」，
   实测读起来像同一行走乱了（2026-09-28 首版就是这么翻车的）。 */
.ex-body {
  display: grid;
  /* 左栏略宽：它是「标签 + 数值」两段（3~4 字标签最容易折行），右栏是「名称 + 概率」两段。
     实测 1fr/1.05fr 时「失败代价」在 114px 的半格里会折成两行（2026-09-28 用户截图报的），
     现在标签收成 2 字 + 左栏给到 1.2fr 双保险。 */
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 4px 14px;
}
.ex-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.ex-col--loot {
  /* ⚠️ 分隔线的颜色**不能**用 `--glass-rgb`（那是白色的玻璃高光）——浅色主题下是白线画在
     白卡片上，实测完全看不见（2026-09-28 首版就踩了）。用全站统一的 `--border`。 */
  border-left: 1px dashed var(--border);
  padding-left: 14px;
}
/* 左栏里 2×2 摆（半格 ~110px）：标签与数值贴在一起，不像整栏一行那样被拉成两半 */
.ex-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 12px;
}
/* 掉落行：名称靠左、概率靠右（占满右栏宽度）。
   ⚠️ 名称段必须可收缩（`flex: 1 1 auto` + `min-width: 0`）——否则卡片被挤到最窄
   （网格下限 400px）时，「名称」与「概率」会直接顶在一起而不是换行。 */
.loot-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}
.loot-pct {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--text-dim);
}
.loot-row--gear {
  grid-column: 1 / -1;
  flex-wrap: wrap;
  row-gap: 2px;
  padding-top: 4px;
  border-top: 1px dashed var(--border);
}
.loot-img--gear {
  width: 20px;
  height: 20px;
}
/* 掉落列表在右栏里仍然一行一条（列宽 ≈ 老卡片，不会挤） */
.loot-list {
  gap: 3px;
}
.loot-text {
  font-size: 12px;
}
/* 成功率是这张卡最该被一眼扫到的数（整轮需求都围绕它）⇒ 加粗一档 */
.ex-rate {
  font-weight: 700;
}
.ex-tiny {
  font-size: 10px;
}
.ex-lv,
.ex-loot-count {
  font-size: 11.5px;
  margin-left: 5px;
}
.ex-loot-count {
  flex: 0 0 auto;
}
/* 精通块推到底部（`margin-top:auto`）：左栏通常比右栏矮一点（掉落行更多），
   贴底后进度条与掉落列表的末行对齐，左栏不会留一块空 */
.ex-mastery {
  margin-top: auto;
  padding-top: 2px;
}
.ex-count {
  flex: 0 0 auto;
  font-size: 11.5px;
}
/* 窄屏（≤720px，与全站同一断点）：两栏并成一栏 —— 分隔线也随之去掉，
   否则会在掉落块左边留一条悬空的竖线 */
@media (max-width: 720px) {
  .ex-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .ex-col--loot {
    border-left: 0;
    padding-left: 0;
  }
}
</style>
