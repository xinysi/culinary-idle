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
import ProgressBar from '../components/ProgressBar.vue'

const props = defineProps({
  instance: { type: Object, required: true },
})
const player = usePlayerStore()
const ui = useUiStore()

// 用 computed 而非常量：组件在采集类技能间复用时（垂钓→狩猎）需响应式跟随 props.instance
const isFishing = computed(() => props.instance.id === 'fishing')
const isHunting = computed(() => props.instance.id === 'hunting')
const isExcavation = computed(() => props.instance.id === 'excavation')
const isForagingLike = computed(() => !isFishing.value && !isHunting.value) // 采摘/挖掘（有可种作物目标）

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
// 当前精通档位的保底产量加成（50 级 +1、100 级 +2；0 表示无）
function masteryBatch(t) { return masteryYieldBonus(props.instance.masteryLevel(t)) }
// 卡片显示间隔：精通≥5 级用精通后的实际间隔（秒）；否则用基础间隔
function cardIntervalSec(t) {
  if (props.instance.masteryLevel(t) >= 5) return props.instance.intervalMs(t) / 1000
  return t.intervalSec
}
function isSelected(itemId) {
  return (player.getSkillTarget(props.instance.id) ?? player.activeTarget) === itemId
}
// 技能是否已被关闭（对应状态框不显示，该目标未在挂机）
const skillClosed = computed(() => !!player.closedIdleTasks?.[props.instance.id])
const ammoWarn = ref(false) // 弹药不足提示弹窗
// ── 精通档位说明弹窗（2026-09 新档表）──
const masteryModalOpen = ref(false)
const masteryTiers = [
  { lv: '5 级', xp: '×1.1', dbl: '1%', batch: '—', inv: '减 1/3' },
  { lv: '10 级', xp: '×1.2', dbl: '5%', batch: '—', inv: '减半' },
  { lv: '20 级', xp: '×1.4', dbl: '10%', batch: '—', inv: '固定 3.6s' },
  { lv: '30 级', xp: '×1.6', dbl: '15%', batch: '—', inv: '固定 3.2s' },
  { lv: '40 级', xp: '×1.9', dbl: '20%', batch: '—', inv: '固定 3.0s' },
  { lv: '50 级', xp: '×2.2', dbl: '30%', batch: '+1', inv: '固定 2.8s' },
  { lv: '60 级', xp: '×2.5', dbl: '40%', batch: '+1', inv: '固定 2.6s' },
  { lv: '70 级', xp: '×2.8', dbl: '50%', batch: '+1', inv: '固定 2.4s' },
  { lv: '80 级', xp: '×3.2', dbl: '60%', batch: '+1', inv: '固定 2.2s' },
  { lv: '90 级', xp: '×3.6', dbl: '70%', batch: '+1', inv: '固定 2.1s' },
  { lv: '100 级', xp: '×4', dbl: '80%', batch: '+2', inv: '固定 2.0s' },
]
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

// ── 分段（挖掘按产出类别分组；其余按 reqLevel 每 5 级一段）──
const CAT_SECTION_LABEL = { root: '🥔 根茎食材', mineral: '⛏️ 矿物', fungus: '🍄 菌类' }
const sections = computed(() => {
  const map = new Map()
  for (const t of props.instance?.targets ?? []) {
    let label, kind
    if (isExcavation.value) {
      // 挖掘：食材/矿物/菌类 分开归类
      const it = getItem(t.itemId)
      kind = 'category'
      label = it ? (CAT_SECTION_LABEL[it.category] ?? it.category) : '其他'
    } else {
      const start = Math.floor((t.reqLevel - 1) / 5) * 5 + 1
      kind = 'level'
      label = `${start}-${start + 4}`
    }
    if (!map.has(label)) map.set(label, { kind, list: [] })
    map.get(label).list.push(t)
  }
  // 挖掘组：类别固定顺序（食材→矿物→菌类→其他）；其余按等级升序
  const order = Object.keys(CAT_SECTION_LABEL)
  return [...map.entries()]
    .map(([label, v]) => ({ label, kind: v.kind, list: v.list }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'category' ? -1 : 1
      if (a.kind === 'category') {
        const ia = order.indexOf(a.label), ib = order.indexOf(b.label)
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
      }
      return parseInt(a.label) - parseInt(b.label)
    })
})
const collapsed = ref(new Set(sections.value.map((s) => s.label))) // 默认全部折叠(等级段)
// 技能页(采集/狩猎/垂钓/挖掘)来回切换时 targets/sections 会变化：每次段变化都重置为全折叠，避免漏段带出未折叠
watch(sections, (secs) => { collapsed.value = new Set(secs.map((s) => s.label)) })
function toggleSection(label) {
  const s = new Set(collapsed.value)
  if (s.has(label)) s.delete(label)
  else s.add(label)
  collapsed.value = s
}
function isOpen(label) {
  return !collapsed.value.has(label)
}

// 分类快速导航：点击滚动到对应分段
function scrollToSection(label) {
  const el = document.getElementById('sec-' + label)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div>
    <!-- 顶部说明（仿制作页：一行公共说明，替代原“已停止/正在采摘/间隔/已执行/距下次产出”实时状态框；
         挂机的停止/继续与到达进度展示在右侧“挂机中”列表） -->
    <div class="card status-line">
      <span class="dim">
        共 {{ instance.targets.length }} 个{{ isFishing ? '垂钓目标' : isHunting ? '狩猎目标' : isExcavation ? '挖掘目标' : '采集目标' }}
        · {{ isFishing ? '成功率随等级提升（基础 55%），失败得 20% 经验；4.5% 概率稀有金龙鱼' : isHunting ? '1% 双倍产出；野鸡 15% 概率额外掉落野鸡蛋' : isExcavation ? '2% 化石食材（远古食谱原料）+ 50% 铜矿 + 30% 铁矿附带' : '1% 双倍产出（随专精提升）+ 50% 附带木材' }}
        <template v-if="isForagingLike">· 可种作物每次动作 10% 掉落对应种子（矿物目标不掉）</template>
      </span>
      <!-- 弹药提示（狩猎）：放到本框最右侧 -->
      <div v-if="isHunting" class="biscuit-inline" style="margin-left: auto">
        <strong>陷阱（弹药）：</strong>
        <span class="mono">{{ player.inventory.trap ?? 0 }}</span> 个，每次狩猎消耗 1 个
        <button v-if="instance.outOfAmmo" class="btn btn-primary btn-sm" @click="goShop">去商店购买</button>
        <span v-else class="dim">（杂货铺有售：1 金币/个）</span>
      </div>
    </div>

    <!-- 目标列表（卡片式：按等级分段，可折叠）-->
    <div class="card">
      <h3 class="target-head-row">
        <span>目标列表（按等级分段，点击段标题折叠）</span>
        <span class="target-head-extra">
          <button class="btn btn-sm" @click="masteryModalOpen = true">📖 精通档位说明</button>
        </span>
      </h3>

      <!-- 分类快速导航 -->
      <div v-if="sections.length > 1" class="quick-nav">
        <span class="dim" style="font-size: 12px">快速跳转：</span>
        <button v-for="sec in sections" :key="sec.label" class="btn btn-sm" @click="scrollToSection(sec.label)">{{ sec.label }}</button>
      </div>

      <div v-for="sec in sections" :key="sec.label" class="gather-section" :id="'sec-' + sec.label">
        <div class="gather-section-title" @click="toggleSection(sec.label)">
          <span class="mono">{{ isOpen(sec.label) ? '−' : '+' }}</span>
          <strong>{{ sec.kind === 'level' ? `Lv ${sec.label}` : sec.label }}</strong>
          <span class="dim">{{ sec.list.length }} 个目标</span>
          <span v-if="sec.list.some((t) => isSelected(t.itemId) && !skillClosed)" class="badge badge-on">当前</span>
        </div>
        <div v-if="isOpen(sec.label)" class="gather-grid">
          <div
            v-for="t in sec.list"
            :key="t.itemId"
            v-tilt
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
              <span>基础经验</span>
              <span class="mono">{{ t.xpPerAction }}<span v-if="masteryLevelOf(t) >= 5" class="mastery-hl">&nbsp;×{{ masteryMult(t) }}</span></span>
            </div>
            <div class="gather-card-row">
              <span>间隔</span>
              <span :class="['mono', masteryLevelOf(t) >= 5 ? 'mastery-hl' : '']">{{ cardIntervalSec(t).toFixed(1) }}s</span>
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

    <!-- 精通档位说明弹窗 -->
    <div v-if="masteryModalOpen" class="modal-backdrop" @click.self="masteryModalOpen = false">
      <div class="modal">
        <div class="modal-head">
          <h3>📖 卡片精通档位说明</h3>
          <button class="btn btn-sm" @click="masteryModalOpen = false">✕</button>
        </div>
        <p class="dim" style="margin-bottom: 8px">精通等级由该卡片累计采集/制作次数提升；达到对应档位解锁经验、双倍产出、<b>保底产量</b>与间隔加成。</p>
        <table class="target-table">
          <thead>
            <tr><th>精通</th><th>基础经验</th><th>双倍产出</th><th>保底产量</th><th>采集间隔</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in masteryTiers" :key="t.lv">
              <td class="mono">{{ t.lv }}</td>
              <td class="mono">{{ t.xp }}</td>
              <td class="mono">{{ t.dbl }}</td>
              <td class="mono">{{ t.batch }}</td>
              <td class="mono">{{ t.inv }}</td>
            </tr>
          </tbody>
        </table>
        <p class="dim" style="margin-top: 8px">精通低于 5 级：经验 ×1、双倍 1%、无保底产量、间隔不变（基础 1% 双倍）。保底产量为每次动作额外固定产出的数量（50 级 +1、100 级 +2），与双倍可叠加。</p>
        <p class="dim" style="margin-top: 5px">经验倍率与「设置经验倍率」<b>不叠加</b>（取较大）：当精通倍数 &gt; 设置倍率时用精通倍数（精通为独立成长线）；当设置倍率 &gt; 精通倍数（或无精通）时用设置倍率（作用于非精通部分）。</p>
      </div>
    </div>
  </div>
</template>
