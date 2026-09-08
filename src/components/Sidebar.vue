<script setup>
// 左侧技能导航 — 需求文档 §9.1.1：按类别分组，含等级与经验进度条
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { SKILL_CATEGORIES, SKILL_DEFS } from '../game/data/skills.js'
import { xpProgress } from '../game/core/Experience.js'
import ProgressBar from './ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()
const avatarInput = ref(null)
// 商店头像框（2026-09-09）：gold / jade / royal
const frameCls = computed(() => {
  const f = player.avatarFrame
  return f ? { ['avatar-frame-' + f]: true } : {}
})

function skillsInCategory(catId) {
  return Object.values(SKILL_DEFS).filter((d) => d.category === catId)
}
function levelOf(id) {
  return player.skillState(id).level
}
function barProgress(id) {
  return xpProgress(player.skillState(id).exp).progress
}
// 当前经验 / 下一级所需经验（用于按钮内直接显示，不含“经验”二字）
function xpText(id) {
  const st = player.skillState(id)
  const max = player.getMaxLevel ? player.getMaxLevel(id) : 100
  const pr = xpProgress(st.exp, max, st.level)
  if (st.level >= max) return '已满级'
  return `${pr.current.toLocaleString()} / ${pr.needed.toLocaleString()}`
}
function selectSkill(id) {
  player.setActiveSkill(id)
  ui.setView('skill') // 关键：从餐厅/公会/商店/日志等页面切回技能视图
  ui.toggleMobileSkills(false) // 移动端选择技能后收起抽屉
  ui.pushLog(`切换到技能：${SKILL_DEFS[id]?.name}`)
}

// 点击头像 → 选择本地图片 → 读为 dataUrl 设为自定义头像
function openAvatarPicker() {
  avatarInput.value?.click()
}
function onAvatarPick(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { ui.pushLog('请选择图片文件', 'warn'); return }
  const reader = new FileReader()
  reader.onload = () => player.setAvatar(reader.result)
  reader.readAsDataURL(file)
  e.target.value = '' // 允许重复选择同一张
}
</script>

<template>
  <aside class="sidebar">
    <!-- 顶部：角色头像 + 名称 + 金币 -->
    <div class="sidebar-header">
      <img
        v-if="player.avatar"
        :src="player.avatar"
        class="avatar avatar-img"
        :class="frameCls"
        alt="头像"
        title="点击更换头像"
        @click="openAvatarPicker"
      />
      <div v-else class="avatar" :class="frameCls" title="点击更换头像" @click="openAvatarPicker">食</div>
      <input ref="avatarInput" type="file" accept="image/*" hidden @change="onAvatarPick" />
      <div class="sidebar-identity">
        <div class="player-name" :style="player.nameColor ? { color: player.nameColor === 'gold' ? '#eab04a' : '#b8c4cc' } : {}">
          {{ player.name }}
          <span v-if="player.hardcore" class="title-badge" style="background: var(--bad-strong)">☠️硬核</span>
          <span v-if="player.title" class="title-badge">{{ player.title }}</span>
        </div>
        <div class="player-gold"><span class="coin"></span>{{ player.gold.toLocaleString() }}</div>
      </div>
    </div>

    <!-- 技能列表（按类别分组，按钮内直接显示等级与经验） -->
    <nav class="skill-nav">
      <template v-for="cat in SKILL_CATEGORIES" :key="cat.id">
        <div class="skill-cat">{{ cat.name }}</div>
        <button
          v-for="def in skillsInCategory(cat.id)"
          :key="def.id"
          class="skill-item"
          :class="{ active: player.activeSkill === def.id }"
          @click="selectSkill(def.id)"
        >
          <div class="skill-item-top">
            <span class="skill-icon">{{ def.icon ?? '•' }}</span>
            <span class="skill-name">{{ def.name }}</span>
            <span class="skill-level">等级 {{ levelOf(def.id) }}</span>
          </div>
          <ProgressBar class="skill-bar" :progress="barProgress(def.id)" />
          <div class="skill-xp dim mono">{{ xpText(def.id) }}</div>
        </button>
      </template>
    </nav>
  </aside>
</template>
