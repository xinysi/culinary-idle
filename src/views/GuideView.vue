<script setup>
// 游玩攻略 — 六阶段攻略（新手/前期/中期/后期/大后期/毕业）
// 按对决等级自动定位当前阶段；可手动切换查看任意阶段
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { GUIDE_STAGES, GUIDE_OVERVIEW, currentGuideStageId } from '../game/data/guide.js'

const player = usePlayerStore()
const ui = useUiStore()

const currentId = computed(() => currentGuideStageId(player.combatLevel))
const selectedId = ref(currentId.value)
watch(currentId, (id) => {
  if (selectedId.value === 'overview') return // 总览页不被自动跟随打断
  selectedId.value = id // 对决等级变化时自动跟随
})

const selected = computed(() => GUIDE_STAGES.find((s) => s.id === selectedId.value) ?? GUIDE_STAGES[0])
const isOverview = computed(() => selectedId.value === 'overview')
const overviewCount = computed(() => GUIDE_OVERVIEW.reduce((a, c) => a + c.items.length, 0))
</script>

<template>
  <section class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📖 游玩攻略</h2>
        <p class="dim">
          <template v-if="isOverview">全部功能一览（{{ overviewCount }} 项）· 作用说明 + 建议游玩阶段</template>
          <template v-else>六阶段攻略 · 按你的对决等级（{{ player.combatLevel }} 级）自动定位；内容对照当前全部游戏数据</template>
        </p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">
          当前阶段
          <span class="badge badge-on">{{ isOverview ? '📋 总览' : selected.id === currentId ? selected.icon + ' ' + selected.name : '查看中：' + selected.name }}</span>
        </div>
        <button class="btn btn-sm" @click="ui.setView('skill')">← 返回技能</button>
      </div>
    </header>

    <!-- 阶段切换（总览 + 六阶段） -->
    <div class="region-tabs" style="flex-wrap: wrap">
      <button class="btn btn-sm" :class="{ 'btn-primary': isOverview }" @click="selectedId = 'overview'">
        📋 总览
        <span class="dim" style="margin-left: 4px">全部功能</span>
      </button>
      <button
        v-for="s in GUIDE_STAGES"
        :key="s.id"
        class="btn btn-sm"
        :class="{ 'btn-primary': selectedId === s.id }"
        @click="selectedId = s.id"
      >
        {{ s.icon }} {{ s.name }}
        <span class="dim" style="margin-left: 4px">{{ s.range }}</span>
        <span v-if="s.id === currentId" class="badge badge-on" style="margin-left: 4px">当前</span>
      </button>
    </div>

    <!-- 总览内容（2026-09-10）：全部功能一览 + 建议游玩阶段 -->
    <template v-if="isOverview">
      <div class="guide-overview">
      <div v-for="cat in GUIDE_OVERVIEW" :key="cat.id" class="card ov-card">
        <h3>{{ cat.icon }} {{ cat.name }}</h3>
        <div v-for="it in cat.items" :key="it.name" class="ov-item">
          <div class="ov-head">
            <span class="ov-icon">{{ it.icon }}</span>
            <strong class="ov-name">{{ it.name }}</strong>
            <span class="badge badge-on ov-stage">{{ it.stage }}</span>
            <span class="dim ov-unlock">{{ it.unlock }}</span>
          </div>
          <!-- desc 里带 <b> 强调标记（GUIDE_OVERVIEW 的数据就是富文本），必须用 v-html：
               用 {{ }} 插值会把 <b> 当纯文本原样显示出来（2026-09-12 修，与 LogView 转生详解同口径） -->
          <p class="dim ov-desc" v-html="it.desc"></p>
        </div>
      </div>
      </div>
    </template>

    <!-- 阶段内容 -->
    <div v-else class="card">
      <h3>{{ selected.icon }} {{ selected.name }} <span class="dim">（{{ selected.range }}）</span></h3>
      <p class="dim" style="margin: 6px 0 10px">{{ selected.summary }}</p>

      <div class="guide-block">
        <h4>🎯 阶段目标</h4>
        <ul class="guide-list">
          <li v-for="(g, i) in selected.goals" :key="i">{{ g }}</li>
        </ul>
      </div>

      <div class="guide-block">
        <h4>📋 行动清单</h4>
        <ol class="guide-list guide-actions">
          <li v-for="(a, i) in selected.actions" :key="i">{{ a }}</li>
        </ol>
      </div>

      <div class="guide-block">
        <h4>🏁 里程碑（自评检查点）</h4>
        <ul class="guide-list guide-milestones">
          <li v-for="(m, i) in selected.milestones" :key="i">☐ {{ m }}</li>
        </ul>
      </div>

      <div class="guide-block">
        <h4>💡 提示</h4>
        <ul class="guide-list guide-tips">
          <li v-for="(t, i) in selected.tips" :key="i">{{ t }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>
