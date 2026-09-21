<script setup>
// 采集类技能视图 — 需求文档 §3.1：目标列表 / 状态 / 特殊机制展示
// 覆盖：采摘（双倍）、垂钓（成功率/稀有鱼）、狩猎（弹药消耗/野鸡蛋）、挖掘（化石食材）
import { computed, ref, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { getSkillDef } from '../game/data/skills.js'
import { itemImage } from '../game/data/itemImage.js'
import { xpProgress } from '../game/core/Experience.js'
import { masteryXpMultiplier, masteryYieldBonus } from '../game/core/mastery.js'
import { CARD_XP_SCALE } from '../game/skills/Skill.js'
import { levelEras, eraProgress, currentEraLabel } from '../game/data/levelEras.js'
import ProgressBar from '../components/ProgressBar.vue'
import MasteryHelp from '../components/MasteryHelp.vue'
import MasteryPoolBar from '../components/MasteryPoolBar.vue'

const props = defineProps({
  instance: { type: Object, required: true },
})
const player = usePlayerStore()
const ui = useUiStore()

// 用 computed 而非常量：组件在采集类技能间复用时（垂钓→狩猎）需响应式跟随 props.instance
const isFishing = computed(() => props.instance.id === 'fishing')
const isHunting = computed(() => props.instance.id === 'hunting')
const isExcavation = computed(() => props.instance.id === 'excavation')
const isMining = computed(() => props.instance.id === 'mining')
const isWoodcutting = computed(() => props.instance.id === 'woodcutting')
// 只有**采摘与挖掘**的目标里含可种作物（采矿/伐木没有种子），别把种子提示错加到新技能上
const isForagingLike = computed(() => !isFishing.value && !isHunting.value && !isMining.value && !isWoodcutting.value)

// 目标查找表：一次构建，卡片回调不再对 targets 线性查找（O(n²) → O(1)）
const targetMap = computed(() => {
  const m = new Map()
  for (const t of props.instance?.targets ?? []) m.set(t.itemId, t)
  return m
})
function isUnlocked(itemId) {
  const t = targetMap.value.get(itemId)
  return t ? props.instance.level >= t.reqLevel : false
}
function successRate(itemId) {
  const t = targetMap.value.get(itemId)
  return props.instance.successChance?.(t) ?? null
}
// 当前卡片精通等级（供卡片显示精通后数值用）
function masteryLevelOf(t) { return props.instance.masteryLevel(t) }
// 当前精通档位经验倍数（≥5 级才有 >1）
function masteryMult(t) { return masteryXpMultiplier(props.instance.masteryLevel(t)) }
/** 卡片上「经验/次」= **实际进经验条的数**（作者基数 × 全局卡片系数 CARD_XP_SCALE）。
 *  ⚠️ 2026-09-21 用户实测问「新档采苹果怎么一次 900 经验」——因为卡片原先显示的是作者基数 15，
 *     而经验条进的是 15×60=900（`CARD_XP_SCALE`，让 1~99 级曲线对得上）。显示与结算必须同源，
 *     所以这里直接给生效值；作者基数与全局系数的说明放进 tooltip。 */
function xpPerAction(t) { return t.xpPerAction * CARD_XP_SCALE }
const XP_HINT = `一次动作实际获得的技能经验（已计入全局卡片经验系数 ×${CARD_XP_SCALE}，与经验条同一口径）`
// 当前精通档位的保底产量加成（50 级 +1、100 级 +2；0 表示无）
function masteryBatch(t) { return masteryYieldBonus(props.instance.masteryLevel(t)) }
// 卡片显示间隔：精通≥5 级用精通后的实际间隔（秒）；否则用基础间隔
function cardIntervalSec(t) {
  if (props.instance.masteryLevel(t) >= 5) return props.instance.intervalMs(t) / 1000
  return t.intervalSec
}
// 精通 ≥20 级起，间隔按「固定档值」与「基础间隔÷2」取更快者（见 mastery.js）。
// 固定档更快时（典型是基础间隔很长的目标）才标出来，让玩家知道这个数是怎么来的。
function intervalByFixedTier(t) {
  return props.instance.intervalSource?.(t) === 'fixed'
}
// ── 效率（经验/小时）与「当前最优」标记 ────────────────────────────────
// 卡片上原本只有「基础经验」和「间隔」两列，横向比较目标要玩家自己心算「经验÷间隔×精通倍率」，
// 而出结论恰恰是最容易算反的那种（精通倍率只在 ≥5 级显示、间隔还有「固定档取更快者」分支）。
// 实测「跟等级换目标」比「全程蹲最低级卡片」24h 多拿 ×9.2 经验 ⇒ 这个数字必须直接给出来。
const bestTargetId = computed(() => props.instance?.bestUnlockedTarget?.()?.itemId ?? null)
/** 非当前目标相对当前目标的效率提升（0.02 = 快 2%）；≤2% 不提示，免得满屏抖动数字 */
function gainVsCurrent(t) {
  if (!props.instance?.xpPerHour) return null
  const cur = props.instance.currentTarget
  if (!cur || cur.itemId === t.itemId) return null
  const a = props.instance.xpPerHour(t)
  const b = props.instance.xpPerHour(cur)
  if (!(b > 0) || !(a > 0)) return null
  const g = a / b - 1
  return g > 0.02 ? g : null
}
/** 经验/小时的中文紧凑写法（亿/万） */
function fmtRate(n) {
  if (!(n > 0)) return '—'
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)} 亿/时`
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)} 万/时`
  return `${Math.round(n)}/时`
}
function isSelected(itemId) {
  return (player.getSkillTarget(props.instance.id) ?? player.activeTarget) === itemId
}
/** 当前挂机目标（精通池的补给目标）——与「当前」徽标同口径 */
const currentTargetId = computed(() => {
  const id = player.getSkillTarget(props.instance.id) ?? player.activeTarget
  return props.instance.targets.some((t) => t.itemId === id) ? id : (props.instance.currentTarget?.itemId ?? null)
})
// 技能是否已被关闭（对应状态框不显示，该目标未在挂机）
const skillClosed = computed(() => !!player.closedIdleTasks?.[props.instance.id])
const ammoWarn = ref(false) // 弹药不足提示弹窗
function selectTarget(itemId) {
  // 已在采集中的目标再点 = 删除挂机任务：停止并隐藏（从右侧“挂机中”列表消失，卡片恢复默认状态）
  // 注意：脚本里要用 skillClosed.value（computed 在 script 中不自动解包，直接 !skillClosed 恒 false）
  if (isSelected(itemId) && !skillClosed.value) {
    player.closeIdleTask(props.instance.id)
    ui.pushLog(`已删除${getSkillDef(props.instance.id)?.name}挂机任务（停止并隐藏，重新选择即恢复）`, 'warn')
    return
  }
  // 弹药不足时打开游戏内提示弹窗（如狩猎需要陷阱）
  if (props.instance.outOfAmmo) ammoWarn.value = true
  player.setSkillTarget(props.instance.id, itemId) // §3.1 每技能独立目标
  player.reopenIdleTask(props.instance.id) // 重新选择目标 = 恢复挂机框显示
  props.instance.timerMs = 0
  props.instance.cycleStartAt = performance.now() // 重新选择目标：重置本周期起点，进度条从 0 开始
}
function goShop() {
  ui.setView('shop')
}

// ── 分段：按「时代」每 10 级一档（2026-09-19 起，六条采集线统一）────────────
// 改前是「挖掘/采矿/伐木按产出类别分组、其余每 5 级一段」——实测那样有三个问题：
//   ① 采矿 43 件全是 `mineral`、伐木 20 件全是 `material` ⇒ 类别分组退化成「一个巨型段」，
//      默认全折叠时玩家只看到一个「⛏️ 矿物 43 个目标」的标题；
//   ② 采摘 142 个目标只有 59 个不同等级（同档最多 15 件）⇒ 5 级一段会切出 20 个段，
//      把「纵向 59 级台阶」读成了「20 段平铺」，看不到梯级；
//   ③ 与参照作 Rocky Idle 的观感差得远——它是「~10 件资源、每件扛 11~14 级」共约 10 档。
// 现统一按 `ERA_SPAN` 级一档、用**该档最高级产出**当时代名（就是 Rocky 那 ~10 档资源的结构）。
// ⚠️ 纯展示层：不改任何目标数据，不参与计算。分段实现见 `game/data/levelEras.js`（与制作页共用）。
const sections = computed(() => levelEras(props.instance?.targets ?? [], (t) => t.reqLevel, (t) => t.itemId))
/** 时代名（该档最高级产出的物品名）——采不到名字就退回空串，不显示「undefined」 */
function eraName(sec) {
  return getItem(sec.topId)?.name ?? ''
}
/** 该时代的横向完成度：已精通满 100 的卡片 / 该档卡片数（把「同档多件」变成收集目标） */
function eraDone(sec) {
  return eraProgress(sec.list, (t) => props.instance.masteryLevel(t)).done
}
// 等级段 = 顶部**标签页**（2026-09-19 用户第二次澄清后定型）：
//   默认**只显示「当前等级所在的段」的卡片**，没有折叠、上面点标签切换。
//   （前一版做成了「十个段标题 + 只展开当前段」，用户要的不是这个 —— 那样还得滚。）
const eraDefault = () => currentEraLabel(sections.value, props.instance?.level ?? 1)
const selectedEra = ref(eraDefault())
const activeSec = computed(() => sections.value.find((s) => s.label === selectedEra.value) ?? sections.value[0] ?? null)
// 技能页(采集/狩猎/垂钓/挖掘)来回切换时 targets/sections 会变化 → 回到「当前等级段」
watch(sections, () => { selectedEra.value = eraDefault() })
function selectEra(label) {
  selectedEra.value = label
}

// 时代快速导航：点击滚动到对应分段
</script>

<template>
  <div>
    <!-- 精通池（技能级共享）——补给目标 = 当前选中/挂机的那个目标 -->
    <MasteryPoolBar
      :skill-id="instance.id"
      :card-key="currentTargetId"
      :card-name="getItem(currentTargetId)?.name ?? ''"
      :card-count="currentTargetId ? (instance.mastery[currentTargetId] ?? 0) : 0"
      mode="gather"
    />

    <!-- 目标列表（卡片式：按等级分段，可折叠）-->
    <div class="card">
      <h3 class="target-head-row">
        <span>目标列表（按等级分段，点击段标题折叠）</span>
        <span class="target-head-extra">
          <!-- 狩猎弹药（2026-09-19 用户要求「移到别处」）：从页顶那张说明卡挪到标题行右侧 -->
          <template v-if="isHunting">
            <span class="dim">陷阱（弹药）：</span>
            <span class="mono">{{ player.inventory.trap ?? 0 }}</span>
            <span class="dim">个，每次狩猎消耗 1 个</span>
            <button v-if="instance.outOfAmmo" class="btn btn-primary btn-sm" @click="goShop">去商店购买</button>
            <span v-else class="dim">（杂货铺有售：1 金币/个）</span>
          </template>
          <MasteryHelp />
        </span>
      </h3>

      <!-- 等级段标签页：点上面切段，下面只显示该段的卡片（没有折叠） -->
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
        <!-- 时代名 = 该档最高级产出：一眼看出「这一档能拿到什么新东西」 -->
        <span v-if="eraName(activeSec)" class="era-name" :title="`本档最高级产出：${eraName(activeSec)}`">{{ eraName(activeSec) }}</span>
        <span class="dim">{{ activeSec.list.length }} 个目标</span>
        <span class="dim" :title="`该档已精通满 100 的卡片数 / 该档卡片数`">精通 {{ eraDone(activeSec) }}/{{ activeSec.list.length }}</span>
        <span v-if="activeSec.list.some((t) => isSelected(t.itemId) && !skillClosed)" class="badge badge-on">当前</span>
      </div>
      <div v-if="activeSec" class="gather-grid">
          <div
            v-for="t in activeSec.list"
            :key="t.itemId"
            class="gather-card"
            :class="{ locked: !isUnlocked(t.itemId), selected: isSelected(t.itemId) && !skillClosed }"
          >
            <div class="gather-card-head">
              <img v-if="itemImage(t.itemId)" :src="itemImage(t.itemId)" class="item-img" @error="$event.target.style.display = 'none'" alt="" />
              <div>
                <strong>{{ getItem(t.itemId)?.name }}</strong><span v-if="!isUnlocked(t.itemId)" class="lock-flag" title="需 Lv {{ t.reqLevel }} 解锁">🔒</span>
                <div class="dim" style="font-size: 12px">Lv {{ t.reqLevel }} 解锁</div>
              </div>
            </div>
            <div class="gather-card-row">
              <span :title="XP_HINT">经验/次</span>
              <span class="mono" :title="XP_HINT">{{ xpPerAction(t) }}<span v-if="masteryLevelOf(t) >= 5" class="mastery-hl">&nbsp;×{{ masteryMult(t) }}</span></span>
            </div>
            <div class="gather-card-row">
              <span>间隔</span>
              <span :class="['mono', masteryLevelOf(t) >= 5 ? 'mastery-hl' : '']">
                {{ cardIntervalSec(t).toFixed(1) }}s<template v-if="intervalByFixedTier(t)"
                  ><span class="dim" style="font-size: 11px" title="精通 20 级起按「固定档值」与「基础间隔÷2」取更快者；此处固定档更快">&nbsp;· 固定档</span></template>
              </span>
            </div>
            <div class="gather-card-row">
              <span>效率</span>
              <span class="mono">{{ fmtRate(instance.xpPerHour(t)) }}</span>
            </div>
            <!-- 「当前最优」独占一行：塞进右侧值里会被挤成竖排（窄屏卡片只有两列宽） -->
            <div v-if="t.itemId === bestTargetId" class="best-flag">
              ⚡ 最优<template v-if="gainVsCurrent(t) != null"> · 比当前快 {{ (gainVsCurrent(t) * 100).toFixed(0) }}%</template>
            </div>
            <div v-if="getItem(t.itemId)?.spoilMs" class="gather-card-row">
              <span>腐坏</span>
              <span class="mono spoil-ms">{{ Math.round(getItem(t.itemId).spoilMs / 3600000) }}h</span>
            </div>
            <div class="gather-card-row">
              <span>精通</span>
              <span class="mono">{{ instance.masteryLevel(t) }} / 100 级<span v-if="masteryBatch(t)" class="mastery-hl">&nbsp;· 保底 +{{ masteryBatch(t) }}</span></span>
            </div>
            <ProgressBar :progress="instance.masteryProgress(t).progress" class="mastery-bar" />
            <div class="dim mono" style="font-size: 12px; text-align: right">
              {{ instance.masteryProgress(t).current }} / {{ instance.masteryProgress(t).needed }} 次
            </div>
            <div v-if="isFishing" class="gather-card-row">
              <span>成功率</span>
              <span class="mono">{{ successRate(t.itemId) != null ? (successRate(t.itemId) * 100).toFixed(0) + '%' : '—' }}</span>
            </div>
            <button
              class="btn btn-sm"
              :disabled="!isUnlocked(t.itemId)"
              :class="{ 'btn-primary': isSelected(t.itemId) && !skillClosed }"
              @click="selectTarget(t.itemId)"
            >
              {{ isSelected(t.itemId) && !skillClosed ? '采集中' : '选择' }}
            </button>
          </div>
        </div>
    </div>

    <!-- 弹药不足提示弹窗 -->
    <div v-if="ammoWarn" class="modal-backdrop" @click.self="ammoWarn = false">
      <div class="modal ammo-warn-modal">
        <header class="modal-head">
          <h3>⚠️ 弹药不足</h3>
          <button class="btn btn-sm" @click="ammoWarn = false">✕</button>
        </header>
        <p class="dim" style="margin-bottom: 10px">
          {{ getSkillDef(props.instance.id)?.name }} 需要弹药（如狩猎需要「陷阱」），但背包里不足！
          请到商店购买后再继续采集。
        </p>
        <div style="display: flex; gap: 8px; justify-content: flex-end">
          <button class="btn btn-sm" @click="ammoWarn = false">知道了</button>
          <button class="btn btn-sm btn-primary" @click="goShop(); ammoWarn = false">去商店</button>
        </div>
      </div>
    </div>

  </div>
</template>
