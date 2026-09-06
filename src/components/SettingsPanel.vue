<script setup>
// 设置面板 — 需求文档 §10.2.3 settings 字段
import { ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { primeAudio } from '../game/core/sound.js'

const player = usePlayerStore()
const ui = useUiStore()
const nameDraft = ref(player.name)
const nameMsg = ref('')

function saveName() {
  const r = player.setName(nameDraft.value)
  nameMsg.value = r.ok ? '已保存' : r.msg
}

// 界面缩放（档位 90%-110%，2026-09-06 收窄：主内容排版按 100% 设计，超出安全区间会错乱）
function applyScale(pct) {
  const v = Math.min(1.1, Math.max(0.9, Number(pct) / 100))
  player.settings.uiScale = v
  applyUiScale(v)
}
function applyUiScale(v) {
  const el = document.documentElement
  el.style.zoom = v === 1 ? '' : String(v)
}
// 打开面板时同步当前缩放
applyUiScale(player.settings.uiScale ?? 1)
</script>

<template>
  <div class="modal-backdrop" @click.self="ui.toggleSettingsPanel(false)">
    <div class="modal">
      <header class="modal-head">
        <h3>设置</h3>
        <button class="btn btn-sm" @click="ui.toggleSettingsPanel(false)">✕</button>
      </header>

      <div class="settings-row">
        <span class="dim">玩家名字</span>
        <input v-model="nameDraft" maxlength="16" style="flex: 1" @keyup.enter="saveName" />
        <button class="btn btn-sm" @click="saveName">保存</button>
        <span v-if="nameMsg" class="dim" style="font-size: 11px">{{ nameMsg }}</span>
      </div>

      <div class="settings-row">
        <label class="switch-row">
          <input type="checkbox" v-model="player.settings.autoEat" />
          <span>对决自动进食（料理回血）</span>
        </label>
      </div>
      <div class="settings-row">
        <span class="dim">自动进食阈值：{{ player.settings.autoEatThreshold }}%</span>
        <input type="range" min="10" max="90" step="10" v-model.number="player.settings.autoEatThreshold" style="flex: 1" />
      </div>
      <div class="settings-row">
        <span class="dim">挂机并行上限：</span>
        <select v-model.number="player.settings.maxParallelIdle" style="flex: 1">
          <option :value="0">无限制（全部已选目标并行）</option>
          <option :value="3">3 个技能并行</option>
          <option :value="2">2 个技能并行</option>
          <option :value="1">1 个技能（文档原版单技能模式）</option>
        </select>
      </div>
      <div class="settings-row">
        <span class="dim">经验倍率：</span>
        <select v-model.number="player.settings.xpMultiplier" style="flex: 1">
          <option :value="1">1×（默认）</option>
          <option :value="10">10×</option>
          <option :value="50">50×</option>
          <option :value="100">100×</option>
          <option :value="250">250×</option>
          <option :value="500">500×</option>
          <option :value="1000">1000×</option>
        </select>
      </div>
      <div class="settings-row">
        <span class="dim">界面缩放：{{ Math.round((player.settings.uiScale ?? 1) * 100) }}%（90%-110%，超出会排版错乱）</span>
        <input
          type="range"
          min="90"
          max="110"
          step="10"
          :value="Math.round((player.settings.uiScale ?? 1) * 100)"
          style="flex: 1"
          @input="applyScale($event.target.value)"
        />
      </div>
      <div class="settings-row">
        <span class="dim">界面主题</span>
        <select v-model="player.settings.theme" style="flex: 1">
          <option value="light">☀️ 亮色（默认）</option>
          <option value="dark">🌙 深色</option>
        </select>
      </div>
      <div class="settings-row">
        <label class="switch-row">
          <input type="checkbox" v-model="player.settings.soundEnabled" @change="player.settings.soundEnabled && primeAudio()" />
          <span>音效</span>
        </label>
      </div>
      <p class="dim">设置随存档保存。</p>
    </div>
  </div>
</template>
