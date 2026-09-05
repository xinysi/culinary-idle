<script setup>
// 游玩攻略 — 六阶段攻略（新手/前期/中期/后期/大后期/毕业）
// 按对决等级自动定位当前阶段；可手动切换查看任意阶段
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { GUIDE_STAGES, currentGuideStageId } from '../game/data/guide.js'

const player = usePlayerStore()
const ui = useUiStore()

const currentId = computed(() => currentGuideStageId(player.combatLevel))
const selectedId = ref(currentId.value)
watch(currentId, (id) => {
  selectedId.value = id // 对决等级变化时自动跟随
})

const selected = computed(() => GUIDE_STAGES.find((s) => s.id === selectedId.value) ?? GUIDE_STAGES[0])
</script>

<template>
  <section class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📖 游玩攻略</h2>
        <p class="dim">六阶段攻略 · 按你的对决等级（{{ player.combatLevel }} 级）自动定位；内容对照当前全部游戏数据</p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">
          当前阶段
          <span class="badge badge-on">{{ selected.id === currentId ? selected.icon + ' ' + selected.name : '查看中：' + selected.name }}</span>
        </div>
        <button class="btn btn-sm" @click="ui.setView('skill')">← 返回技能</button>
      </div>
    </header>

    <!-- 阶段切换 -->
    <div class="region-tabs" style="flex-wrap: wrap">
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

    <!-- 阶段内容 -->
    <div class="card">
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
