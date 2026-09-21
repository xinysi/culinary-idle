<script setup>
// 左侧技能导航 — 需求文档 §9.1.1：按类别分组，含等级与经验进度条
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { SKILL_CATEGORIES, SKILL_DEFS, skillCategoriesOfTab } from '../game/data/skills.js'
import { xpProgress } from '../game/core/Experience.js'
import { nameColorOf } from '../game/data/cosmetics.js'
import ProgressBar from './ProgressBar.vue'
import { featureGroups } from '../game/data/featureGroups.js'

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
// 经验进度：**必须把等级与上限一起传进去**（等级是权威值）。
// 不传等级时 xpProgress 会用 levelFromXp(exp) 反推，而转生后的技能「等级 1+carry、exp 0」，
// 反推只会得到 1 级 —— 条子会按 1 级的口径算、exp 一超过 1→2 的门槛就顶到 100%（2026-09-18 修）。
function xpInfo(id) {
  const st = player.skillState(id)
  const max = player.getMaxLevel ? player.getMaxLevel(id) : 100
  return { st, max, pr: xpProgress(st.exp, max, st.level) }
}
function barProgress(id) {
  return xpInfo(id).pr.progress
}
// 当前经验 / 下一级所需经验（用于按钮内直接显示，不含“经验”二字）
function xpText(id) {
  const { st, max, pr } = xpInfo(id)
  if (st.level >= max) return '已满级'
  return `${pr.current.toLocaleString()} / ${pr.needed.toLocaleString()}`
}
function selectSkill(id) {
  sideTab.value = tabOfSkill(id) // 选副业技能时切到副业页签（2026-09-16）
  player.setActiveSkill(id)
  ui.setView('skill') // 关键：从餐厅/公会/商店/日志等页面切回技能视图
  ui.toggleMobileSkills(false) // 移动端选择技能后收起抽屉
  ui.pushLog(`切换到技能：${SKILL_DEFS[id]?.name}`)
}

// ── 功能页分组（2026-09-10 细分）：清单已抽到 `game/data/featureGroups.js`（「指南」按钮与守卫共用同一份）──
const FEATURE_GROUPS = featureGroups(player)

// 左栏页签（2026-09-10 技能/功能；2026-09-16 加第三页签「副业」），一次只显示一栏、各自占满高度
const sideTab = ref('skills')
const FEATURE_VIEWS = FEATURE_GROUPS.flatMap((g) => g.items.map((i) => i.view))

/**
 * 功能页按进度分级（2026-09-18，留存改进 ⑤）
 * 背景：左栏 55 个磁贴全挂出来 = 新玩家决策瘫痪（同学反馈「内容太多不知从哪下手」+ 实测首屏一屏看不完）。
 * 做法：磁贴可带 `unlock(p)`；**条件一律复用各系统自己的解锁访问器**（地窖 Lv10 / 牧场 Lv15 / 商队 Lv20 …），
 * 不发明新阈值、不动任何冻结数据。没解锁的先收起来（不是永久屏蔽）：
 * 底部「显示全部功能」开关（settings.showAllFeatures，进存档）随时放出来，也保证测试与老玩家不受影响。
 */
const showAllFeatures = computed({
  get: () => !!player.settings?.showAllFeatures,
  set: (v) => { if (player.settings) player.settings.showAllFeatures = !!v },
})
function tileVisible(it) {
  if (showAllFeatures.value) return true
  return !it.unlock || it.unlock(player)
}
/**
 * 分组默认折叠（2026-09-18 用户批准）：左栏 45 个无门槛磁贴一屏铺满是「入口即成本」的最大来源。
 * 折叠后首屏只剩 6 个分组标题 —— 也就是 6 个入口，正好落在「首屏 6~8 个」的目标区间。
 *  - 展开状态存 `settings.sidebarOpen`（数组，进存档）；空数组 = 全折叠（新档即此状态）。
 *  - **当前页所属分组自动算展开**：从别处跳进某个功能页时，它的磁贴必须可见。
 *  - 底部「全部展开 / 全部收起」一键切换。
 */
const openGroups = computed(() => (Array.isArray(player.settings?.sidebarOpen) ? player.settings.sidebarOpen : []))
function groupOfView(view) {
  return FEATURE_GROUPS.find((g) => g.items.some((i) => i.view === view))?.id ?? null
}
function groupOpen(g) {
  if (openGroups.value.includes(g.id)) return true
  return groupOfView(ui.activeView) === g.id // 当前所在页的分组始终展开
}
function toggleGroup(g) {
  if (!player.settings) return
  const cur = openGroups.value.slice()
  const i = cur.indexOf(g.id)
  if (i >= 0) cur.splice(i, 1)
  else cur.push(g.id)
  player.settings.sidebarOpen = cur
}
const allGroupsOpen = computed(() => FEATURE_GROUPS.every((g) => groupOpen(g)))
function toggleAllGroups() {
  if (!player.settings) return
  player.settings.sidebarOpen = allGroupsOpen.value ? [] : FEATURE_GROUPS.map((g) => g.id)
}
const hiddenFeatureCount = computed(() =>
  FEATURE_GROUPS.reduce((n, g) => n + g.items.filter((it) => !tileVisible(it)).length, 0))
/** 当前激活技能属于哪个页签（副业技能必须落在副业页签，否则点了木工会被切回技能页签） */
function tabOfSkill(skillId) {
  const cat = SKILL_DEFS[skillId]?.category
  return SKILL_CATEGORIES.find((c) => c.id === cat)?.tab ?? 'skill'
}
watch(
  // 同时盯 activeSkill：从搜索/图鉴跳转到「木工」时 activeView 可能本来就是 skill，
  // 只盯 activeView 会漏掉这次切换（页签留在「技能」，木工那一行看不见）。
  [() => ui.activeView, () => player.activeSkill],
  () => {
    if (FEATURE_VIEWS.includes(ui.activeView)) sideTab.value = 'features'
    else if (ui.activeView === 'skill') sideTab.value = tabOfSkill(player.activeSkill)
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

    <!-- 页签：技能 / 功能 / 副业（2026-09-10 前两者；2026-09-16 加副业） -->
    <div class="sidebar-tabs">
      <button class="sidebar-tab" :class="{ active: sideTab === 'skills' }" @click="sideTab = 'skills'">🌾技能</button>
      <button class="sidebar-tab" :class="{ active: sideTab === 'features' }" @click="sideTab = 'features'">🧩功能</button>
      <button class="sidebar-tab" :class="{ active: sideTab === 'side' }" @click="sideTab = 'side'">🪚副业</button>
    </div>

    <!-- 技能列表（按类别分组，按钮内直接显示等级与经验） -->
    <nav v-show="sideTab === 'skills'" class="skill-nav">
      <template v-for="cat in skillCategoriesOfTab('skills')" :key="cat.id">
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

    <!-- 副业列表（与技能页签同构；副业不吃食灵经验、不入山海食经） -->
    <nav v-show="sideTab === 'side'" class="skill-nav">
      <template v-for="cat in skillCategoriesOfTab('side')" :key="cat.id">
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
      <p class="dim side-note">副业把采集原料做成经营侧加成：木器可做成餐厅装潢。</p>
    </nav>

    <!-- 功能页网格（2026-09-10 用户要求：全部展开、方块显示；2026-09-11 实测改一行四个：
         3 列时 45 片要滚 746px、后 3 组全在折叠线下；4 列后 74→54px、需滚降到 146px 且无换行裁切） -->
    <nav v-show="sideTab === 'features'" class="feature-nav">
      <template v-for="g in FEATURE_GROUPS" :key="g.id">
        <button class="feature-group-label" :class="{ open: groupOpen(g) }" @click="toggleGroup(g)">
          <span class="fg-arrow">{{ groupOpen(g) ? '▾' : '▸' }}</span>
          <span>{{ g.icon }} {{ g.name }}</span>
          <span class="fg-count dim">{{ g.items.filter((it) => tileVisible(it)).length }}</span>
        </button>
        <div v-if="groupOpen(g) && g.items.some((it) => tileVisible(it))" class="feature-grid">
          <button
            v-for="it in g.items.filter((it) => tileVisible(it))"
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
      <!-- 未解锁的功能页默认收起：给一个随时放开的口子（也避免「找不到入口」的困惑） -->
      <div v-if="hiddenFeatureCount > 0 || showAllFeatures || !allGroupsOpen" class="feature-hidden">
        <span class="dim">{{ showAllFeatures ? '已显示全部功能' : `已隐藏 ${hiddenFeatureCount} 个未解锁的功能` }}</span>
        <button class="btn btn-sm" @click="showAllFeatures = !showAllFeatures">{{ showAllFeatures ? '只显示已解锁' : '显示全部' }}</button>
        <button class="btn btn-sm" @click="toggleAllGroups()">{{ allGroupsOpen ? '全部收起' : '全部展开' }}</button>
      </div>
    </nav>
  </aside>
</template>
