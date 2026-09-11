<script setup>
// 左侧技能导航 — 需求文档 §9.1.1：按类别分组，含等级与经验进度条
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { SKILL_CATEGORIES, SKILL_DEFS } from '../game/data/skills.js'
import { xpProgress } from '../game/core/Experience.js'
import { nameColorOf } from '../game/data/cosmetics.js'
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
  sideTab.value = 'skills' // 选技能时回到技能页签
  player.setActiveSkill(id)
  ui.setView('skill') // 关键：从餐厅/公会/商店/日志等页面切回技能视图
  ui.toggleMobileSkills(false) // 移动端选择技能后收起抽屉
  ui.pushLog(`切换到技能：${SKILL_DEFS[id]?.name}`)
}

// ── 功能页分组（2026-09-10 细分）：非高频功能页从顶栏移入左栏，按玩法角色分成六组 ──
const FEATURE_GROUPS = [
  {
    id: 'today',
    icon: '🗓️',
    name: '今日',
    items: [
      { icon: '🌤', name: '天气运势', view: 'weather' },
      { icon: '🍀', name: '吉祥物', view: 'mascot' },
      { icon: '📋', name: '任务中心', view: 'quests' },
      { icon: '📬', name: '信箱', view: 'mail', badge: () => player.mailUnclaimedCount() },
      { icon: '📈', name: '行情', view: 'market' },
    ],
  },
  {
    id: 'buy',
    icon: '🧺',
    name: '采买与转化',
    items: [
      { icon: '🛒', name: '商店', view: 'shop' },
      { icon: '🍽️', name: '珍馐阁', view: 'deluxe' },
      { icon: '🧪', name: '炼金', view: 'alchemy' },
    ],
  },
  {
    id: 'idle',
    icon: '🌾',
    name: '挂机产线',
    items: [
      { icon: '🚢', name: '采集队', view: 'expedition' },
      { icon: '🌍', name: '产地', view: 'regions' },
      { icon: '🐄', name: '牧场', view: 'ranch' },
      { icon: '🍶', name: '地窖', view: 'cellar' },
      { icon: '🤖', name: '自动化', view: 'automation' },
    ],
  },
  {
    id: 'study',
    icon: '📚',
    name: '研究与收集',
    items: [
      { icon: '📓', name: '厨房笔记', view: 'kitchenNotes' },
      { icon: '📔', name: '风味册', view: 'flavorBook' },
      { icon: '📜', name: '菜系研究', view: 'schools' },
      { icon: '🛡️', name: '装备总览', view: 'gear' },
    ],
  },
  {
    id: 'biz',
    icon: '🥢',
    name: '餐厅经营',
    items: [
      { icon: '⭐', name: '评级', view: 'michelin' },
      { icon: '👨‍🍳', name: '班底', view: 'staff' },
      { icon: '🏬', name: '分店', view: 'branches' },
      { icon: '💹', name: '交易所', view: 'exchange' },
      { icon: '🥂', name: '宴会', view: 'banquet' },
      { icon: '🚚', name: '外卖', view: 'takeout' },
      { icon: '📦', name: '供应商', view: 'suppliers' },
      { icon: '👋', name: '常客', view: 'regulars' },
      { icon: '🍻', name: '厨友', view: 'friends', badge: () => player.friendsVisitableCount() },
      { icon: '🏪', name: '同业榜', view: 'rivals' },
      { icon: '🍱', name: '套餐定食', view: 'setMeals' },
      { icon: '🛋️', name: '餐厅装潢', view: 'decor' },
    ],
  },
  {
    id: 'fight',
    icon: '🎯',
    name: '挑战与休闲',
    items: [
      { icon: '🏅', name: '试炼', view: 'trials' },
      { icon: '⚒️', name: '厨具赛', view: 'gearContest' },
      { icon: '🃏', name: '名厨', view: 'chefChallenge' },
      { icon: '🏯', name: '食神秘境', view: 'realm' },
      { icon: '🎮', name: '小游戏', view: 'minigames' },
    ],
  },
  {
    id: 'record',
    icon: '🗃️',
    name: '记录与回顾',
    items: [
      { icon: '🏁', name: '里程碑', view: 'milestones' },
      { icon: '📰', name: '年鉴', view: 'chronicle' },
      { icon: '📅', name: '赛季回顾', view: 'seasonReview' },
      { icon: '🎖', name: '荣誉殿堂', view: 'honor' },
      // 简写「成就称号」：4 列后瓦片只有 54px，「成就与称号」（5 字）会换行；全称仍用在页面标题与跳转文案里
      { icon: '🥇', name: '成就称号', view: 'achievements' },
      { icon: '🎟️', name: '图鉴兑换', view: 'codexExchange' },
      { icon: '🗂', name: '系统日志', view: 'logs' },
    ],
  },
  {
    id: 'grow',
    icon: '🌱',
    name: '成长与信仰',
    items: [
      { icon: '✨', name: '食灵物语', view: 'spiritStories' },
      { icon: '♻️', name: '传承', view: 'legacy' },
      { icon: '🏛', name: '信仰', view: 'patrons' },
      { icon: '🌗', name: '节庆', view: 'festival' },
    ],
  },
]
// 左栏页签（2026-09-10）：技能 / 功能，一次只显示一栏、各自占满高度
const sideTab = ref('skills')
const FEATURE_VIEWS = FEATURE_GROUPS.flatMap((g) => g.items.map((i) => i.view))
watch(
  () => ui.activeView,
  (v) => {
    if (FEATURE_VIEWS.includes(v)) sideTab.value = 'features'
    else if (v === 'skill') sideTab.value = 'skills'
  },
)

function goFeature(item) {
  ui.setView(item.view)
  ui.toggleMobileSkills(false)
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
        <div class="player-name" :style="nameColorOf(player.nameColor) ? { color: nameColorOf(player.nameColor) } : {}">
          {{ player.name }}
          <span v-if="player.hardcore" class="title-badge" style="background: var(--bad-strong)">☠️硬核</span>
          <span v-if="player.title" class="title-badge">{{ player.title }}</span>
        </div>
        <div class="player-gold"><span class="coin"></span>{{ player.gold.toLocaleString() }}</div>
      </div>
    </div>

    <!-- 页签：技能 / 功能（2026-09-10） -->
    <div class="sidebar-tabs">
      <button class="sidebar-tab" :class="{ active: sideTab === 'skills' }" @click="sideTab = 'skills'">🌾 技能</button>
      <button class="sidebar-tab" :class="{ active: sideTab === 'features' }" @click="sideTab = 'features'">🧩 功能</button>
    </div>

    <!-- 技能列表（按类别分组，按钮内直接显示等级与经验） -->
    <nav v-show="sideTab === 'skills'" class="skill-nav">
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

    <!-- 功能页网格（2026-09-10 用户要求：全部展开、方块显示；2026-09-11 实测改一行四个：
         3 列时 45 片要滚 746px、后 3 组全在折叠线下；4 列后 74→54px、需滚降到 146px 且无换行裁切） -->
    <nav v-show="sideTab === 'features'" class="feature-nav">
      <template v-for="g in FEATURE_GROUPS" :key="g.id">
        <div class="feature-group-label">{{ g.icon }} {{ g.name }}</div>
        <div class="feature-grid">
          <button
            v-for="it in g.items"
            :key="it.view"
            class="feature-tile"
            :class="{ active: ui.activeView === it.view }"
            :title="it.badge?.() ? `${it.name}（${it.badge()} 封待领）` : it.name"
            @click="goFeature(it)"
          >
            <span class="feature-icon">{{ it.icon }}</span>
            <span class="feature-name">{{ it.name }}</span>
            <!-- 待领角标（2026-09-11 信箱）：非零才显示 -->
            <span v-if="it.badge?.()" class="feature-badge">{{ it.badge() > 99 ? '99+' : it.badge() }}</span>
          </button>
        </div>
      </template>
    </nav>
  </aside>
</template>
