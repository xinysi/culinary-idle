<script setup>
// 功能页的**大类导航栏**（2026-09-27 用户⑳ 第二轮：「点击大类后，右边面板的左边显示导航、
// 右边显示详细内容」）—— 形态照开发者面板（`DevPanel.vue` 的 `.dp-nav` + `.dp-content`）：
// 它挂在**主内容区里**（`.main-scroll` 的第一个子元素），与页面内容并排成两栏；
// 左栏是「本大类有哪些页」，右栏就是当前页本身（分派链仍在 App.vue，本组件不渲染内容）。
//
// 为什么抽成组件（而不是像开发者面板那样写在页面模板里）：
//   ① 页面分派链在 App.vue，有 60+ 个 `v-else-if`，把链包一层容器会整块重排、风险大；
//      这里只往 `.main-scroll` 里**插一个前置兄弟**，内容区一个字节不动。
//   ② 「哪些页可见」的过滤（`showAllFeatures` + 各系统的 `unlock`）原先只写在 Sidebar 里，
//      两处各写一遍必然漂移 ⇒ 抽到这里，Sidebar 与它共用同一条判据。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { featureGroups } from '../game/data/featureGroups.js'

const player = usePlayerStore()
const ui = useUiStore()
const GROUPS = featureGroups(player)

const group = computed(() => GROUPS.find((g) => g.id === ui.featureCat) ?? null)
/** 可见页过滤：与左栏磁贴同一条判据（未解锁的默认收起，「显示全部」时全放出来） */
function visible(it) {
  if (player.settings?.showAllFeatures) return true
  return !it.unlock || it.unlock(player)
}
const items = computed(() => (group.value ? group.value.items.filter(visible) : []))
// 折成「仅图标」的窄栏（2026-09-27 用户：「页面清单增加可折叠为仅图标的按钮」）：
// 存 `settings.railIcons`（与 showAllFeatures 同一类界面偏好；settings 是整体序列化的，
// 旧档没有这个键会走默认 false）。
const iconsOnly = computed({
  get: () => !!player.settings?.railIcons,
  set: (v) => { if (player.settings) player.settings.railIcons = !!v },
})

function pick(it) {
  ui.setView(it.view)
  ui.toggleMobileSkills(false)
}
</script>

<template>
  <nav
    v-if="group"
    class="feature-rail"
    :class="{ 'feature-rail--mini': iconsOnly }"
    :aria-label="`${group.name}导航`"
  >
    <div class="fr-head">
      <span class="fr-title">{{ group.icon }} {{ group.name }}</span>
      <button
        class="fr-btn fr-fold"
        :title="iconsOnly ? '展开导航（显示页面名）' : '折叠为仅图标（把宽度让给内容）'"
        :aria-expanded="!iconsOnly"
        @click="iconsOnly = !iconsOnly"
      >{{ iconsOnly ? '»' : '«' }}</button>
      <button class="fr-btn fr-close" title="收起导航（换到别的页也会自动收起）" @click="ui.closeFeatureCat()">✕</button>
    </div>
    <button
      v-for="it in items"
      :key="it.view"
      class="fr-item"
      :class="{ on: ui.activeView === it.view }"
      :title="it.badge?.() ? `${it.name}（${it.badge()} 封待领）` : it.name"
      @click="pick(it)"
    >
      <span class="fr-icon">{{ it.icon }}</span>
      <span class="fr-name">{{ it.name }}</span>
      <span v-if="it.badge?.()" class="fr-badge">{{ it.badge() > 99 ? '99+' : it.badge() }}</span>
    </button>
    <p v-if="!items.length" class="dim fr-empty">这一类暂时没有已解锁的页面（可在左栏点「显示全部」）</p>
  </nav>
</template>

<style scoped>
/* 两栏由 `.main-scroll--rail` 的 flex 决定；这里只负责「自己是那条固定的窄栏」+ 粘住不随页滚。
   宽度用 `--rail-w` 单点定义（折叠态是 `--rail-w-mini`）—— 两个 token 都在 main.css 的 `:root` 里，
   窄屏阈值 940px 与侧栏同时出现，见 App.vue 的 railAvailable。 */
.feature-rail {
  flex: 0 0 var(--rail-w, 168px);
  width: var(--rail-w, 168px);
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: calc(100vh - 190px);
  overflow-y: auto;
}
/* 仅图标态：整条窄栏只剩图标（名字走 `title` 悬浮提示），把宽度还给内容 */
.feature-rail--mini {
  flex: 0 0 var(--rail-w-mini, 46px);
  width: var(--rail-w-mini, 46px);
}
.feature-rail--mini .fr-title,
.feature-rail--mini .fr-name,
.feature-rail--mini .fr-empty { display: none; }
.feature-rail--mini .fr-head { justify-content: center; gap: 3px; padding: 2px 0 8px; }
.feature-rail--mini .fr-item { justify-content: center; padding: 7px 0; }
.fr-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 2px 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-strong);
}
.fr-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fr-btn {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  line-height: 1;
  padding: 0;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: rgba(var(--panel-rgb), 0.7);
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
}
.fr-btn:hover { border-color: var(--primary); color: var(--primary-strong); }
.fr-item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  text-align: left;
  padding: 7px 9px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  /* 折行文字旁有药丸时不许挤压（项目约定） */
  flex-wrap: nowrap;
}
.fr-item:hover { background: rgba(var(--panel-rgb), 0.7); border-color: var(--primary); }
.fr-item.on { background: rgba(var(--primary-tint-rgb), 0.2); border-color: var(--primary); font-weight: 700; }
.fr-icon { flex: 0 0 auto; }
.fr-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fr-badge { flex: 0 0 auto; font-size: 11px; color: var(--bad-strong); }
.fr-empty { margin: 6px 4px; font-size: 12px; line-height: 1.6; }
</style>
