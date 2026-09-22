<script setup>
// 美食探索视图 — 需求文档 §3.4.3：目标选择 / 成功率 / 掉落预览 / 失败惩罚
// 卡片式 UI（复用采集页 gather-card 体系）：按等级分段、可折叠、快速导航。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { getSkillDef } from '../game/data/skills.js'
import { itemImage } from '../game/data/itemImage.js'
import { LOW_TARGET_NOTE, LOW_TARGET_XP_MULT } from '../game/core/growthRate.js'

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
  // 探索中再点当前目标 = 删除挂机任务：停止并隐藏（从右侧“挂机中”列表消失，行恢复默认状态）
  if (isSelected(id) && !skillClosed.value) {
    player.closeIdleTask(props.instance.id)
    ui.pushLog(`已删除${getSkillDef(props.instance.id)?.name}挂机任务（停止并隐藏，重新选择即恢复）`, 'warn')
    return
  }
  player.setSkillTarget(props.instance.id, id) // §3.1 每技能独立目标
  player.reopenIdleTask(props.instance.id) // 重新选择目标 = 恢复挂机框显示
  props.instance.timerMs = 0
  props.instance.cycleStartAt = performance.now() // 重新选择目标：重置本周期起点
}
function lootLine(l) {
  // 概率必须走技能实例的 lootChance（= 难度系数后的实际值；金币条目原样）——
  // 直接读 l.chance 会显示成 28% 而实际按 14% 结算
  const pct = Math.round(props.instance.lootChance(l) * 100)
  return l.type === 'gold' ? `金币 ${l.min}-${l.max}（${pct}%）` : `${getItem(l.itemId)?.name} ×${l.min}-${l.max}（${pct}%）`
}

// ── 分段：按 reqLevel 每 5 级一段（与采集页一致）──
const sections = computed(() => {
  const map = new Map()
  for (const t of props.instance?.targets ?? []) {
    const start = Math.floor((t.reqLevel - 1) / 5) * 5 + 1
    const label = `${start}-${start + 4}`
    if (!map.has(label)) map.set(label, { label, list: [] })
    map.get(label).list.push(t)
  }
  return [...map.entries()]
    .map(([label, v]) => ({ label, list: v.list }))
    .sort((a, b) => parseInt(a.label) - parseInt(b.label))
})
const collapsed = ref(new Set())
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
    <!-- 目标列表（卡片式：按等级分段，可折叠） -->
    <div class="card">
      <h3 class="target-head-row">
        <span>探索目标（按等级分段，点击段标题折叠）</span>
        <!-- 规则常驻（2026-09-22）：低目标经验减半 -->
        <span class="dim low-target-hint" :title="LOW_TARGET_NOTE">低目标经验 ×{{ LOW_TARGET_XP_MULT }}</span>
        <span class="dim target-head-extra">成功率随等级提升，基础成功率见各卡片</span>
      </h3>

      <!-- 分类快速导航 -->
      <div v-if="sections.length > 1" class="quick-nav">
        <span class="dim" style="font-size: 12px">快速跳转：</span>
        <button v-for="sec in sections" :key="sec.label" class="btn btn-sm" @click="scrollToSection(sec.label)">{{ sec.label }}</button>
      </div>

      <div v-for="sec in sections" :key="sec.label" class="gather-section" :id="'sec-' + sec.label">
        <div class="gather-section-title" @click="toggleSection(sec.label)">
          <span class="mono">{{ isOpen(sec.label) ? '−' : '+' }}</span>
          <strong>Lv {{ sec.label }}</strong>
          <span class="dim">{{ sec.list.length }} 个目标</span>
          <span v-if="sec.list.some((t) => isSelected(t.id) && !skillClosed)" class="badge badge-on">当前</span>
        </div>
        <div v-if="isOpen(sec.label)" class="gather-grid">
          <div
            v-for="t in sec.list"
            :key="t.id"
            class="gather-card"
            :class="{ locked: !isUnlocked(t.id), selected: isSelected(t.id) && !skillClosed }"
          >
            <div class="gather-card-head">
              <div>
                <strong>{{ t.name }}</strong><span v-if="!isUnlocked(t.id)" class="lock-flag" title="需 Lv {{ t.reqLevel }} 解锁">🔒</span>
                <span v-if="isLow(t)" class="badge badge-warn" :title="LOW_TARGET_NOTE">⚠ 经验减半</span>
                <div class="dim" style="font-size: 12px">Lv {{ t.reqLevel }} 解锁</div>
              </div>
            </div>
            <div class="gather-card-row">
              <span>基础经验</span>
              <span class="mono">{{ t.xp }}</span>
            </div>
            <div class="gather-card-row">
              <span>间隔</span>
              <span class="mono">{{ t.intervalSec.toFixed(1) }}s</span>
            </div>
            <div class="gather-card-row">
              <span>成功率</span>
              <span class="mono">{{ Math.round(instance.successChance(t) * 100) }}%</span>
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
                  alt=""
                />
                <img
                  v-else-if="l.type === 'item' && itemImage(l.itemId)"
                  :src="itemImage(l.itemId)"
                  class="loot-img"
                  @error="$event.target.style.display = 'none'"
                  alt=""
                />
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
    </div>

    <p class="dim special-note">失败惩罚：损失目标对应金币（金币不足则损失 10% 最大品鉴值）。</p>
  </div>
</template>
