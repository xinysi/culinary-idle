<script setup>
// 游玩攻略 —— 2026-10-01 用户选定的排版方案 A：「左导航 + 右内容」（与全站左栏大类导航同一套语言）。
// 改前的问题：8 个页签（总览 + 六阶段）要玩家先猜「我要看的东西在哪个页签里」，
// 而总览是 88 个条目平铺、阶段是 15 条长句平铺（实测页高 1944px，两屏）。
// 现在：左栏 = 六个阶段 + 六个功能大类（各自带条数），右栏只渲染选中项 —— 不再有「页签」这一层。
// 数据一个字没动（GUIDE_STAGES / GUIDE_OVERVIEW 原样读），只改呈现。
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { GUIDE_STAGES, GUIDE_OVERVIEW, currentGuideStageId } from '../game/data/guide.js'

const player = usePlayerStore()
const ui = useUiStore()

const currentId = computed(() => currentGuideStageId(player.combatLevel))
/** 选中项：`stage:<id>` | `cat:<id>` | `all`（键里带前缀，两种导航不会撞车） */
const sel = ref(`stage:${currentId.value}`)
watch(currentId, (id) => {
  // 对决等级变化时自动跟随——但只跟随「正在看某个阶段」的时候，看功能大类时不打断
  if (!sel.value.startsWith('stage:')) return
  sel.value = `stage:${id}`
})

const isAll = computed(() => sel.value === 'all')
const stage = computed(() => (sel.value.startsWith('stage:') ? GUIDE_STAGES.find((s) => s.id === sel.value.slice(6)) : null))
const cat = computed(() => (sel.value.startsWith('cat:') ? GUIDE_OVERVIEW.find((c) => c.id === sel.value.slice(4)) : null))
const overviewCount = computed(() => GUIDE_OVERVIEW.reduce((a, c) => a + c.items.length, 0))
/** 右栏顶部那句说明（随选中项变） */
const headNote = computed(() => {
  if (isAll.value) return `全部功能一览（${overviewCount.value} 项）· 作用说明 + 建议游玩阶段`
  if (cat.value) return `${cat.value.items.length} 项 · 作用说明 + 建议游玩阶段`
  return `六阶段攻略 · 按你的对决等级（${player.combatLevel} 级）自动定位；内容对照当前全部游戏数据`
})
</script>

<template>
  <section class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📖 游玩攻略</h2>
        <p class="dim">{{ headNote }}</p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">
          当前阶段
          <span class="badge badge-on">{{ stage ? stage.icon + ' ' + stage.name : cat ? cat.icon + ' ' + cat.name : '📋 全部功能' }}</span>
        </div>
        <button class="btn btn-sm" @click="ui.setView('skill')">← 返回技能</button>
      </div>
    </header>

    <div class="gd-body">
      <!-- 左导航：阶段 + 功能大类（与全站「左栏大类 → 页面清单」同一套语言） -->
      <nav class="gd-rail">
        <div class="gd-cap">🕒 按进度</div>
        <button
          v-for="s in GUIDE_STAGES" :key="s.id"
          class="gd-item" :class="{ on: sel === 'stage:' + s.id }"
          @click="sel = 'stage:' + s.id"
        >
          <span class="gd-ic">{{ s.icon }}</span>
          <span class="gd-nm">{{ s.name }}</span>
          <span v-if="s.id === currentId" class="gd-now">当前</span>
          <span class="gd-meta dim">{{ s.range }}</span>
        </button>

        <div class="gd-cap">📚 按功能</div>
        <button
          v-for="c in GUIDE_OVERVIEW" :key="c.id"
          class="gd-item" :class="{ on: sel === 'cat:' + c.id }"
          @click="sel = 'cat:' + c.id"
        >
          <span class="gd-ic">{{ c.icon }}</span>
          <span class="gd-nm">{{ c.name }}</span>
          <span class="gd-meta dim">{{ c.items.length }}</span>
        </button>
        <button class="gd-item" :class="{ on: isAll }" @click="sel = 'all'">
          <span class="gd-ic">📋</span>
          <span class="gd-nm">全部功能</span>
          <span class="gd-meta dim">{{ overviewCount }}</span>
        </button>
      </nav>

      <!-- 右内容 -->
      <div class="gd-pane">
        <!-- 阶段 -->
        <div v-if="stage" class="card gd-stage">
          <h3>{{ stage.icon }} {{ stage.name }} <span class="dim">（{{ stage.range }}）</span></h3>
          <p class="dim" style="margin: 6px 0 10px">{{ stage.summary }}</p>

          <div class="guide-block">
            <h4>🎯 阶段目标</h4>
            <ul class="guide-list">
              <li v-for="(g, i) in stage.goals" :key="i">{{ g }}</li>
            </ul>
          </div>

          <div class="guide-block">
            <h4>📋 行动清单</h4>
            <ol class="guide-list guide-actions">
              <!-- actions / tips 里带 <b> 强调标记（GUIDE_STAGES 的数据是富文本）⇒ 必须 v-html，
                   用 {{ }} 会把标记当纯文本显示出来（2026-09-21 修，与 ov-desc 同理） -->
              <li v-for="(a, i) in stage.actions" :key="i" v-html="a"></li>
            </ol>
          </div>

          <div class="guide-block">
            <h4>🏁 里程碑（自评检查点）</h4>
            <ul class="guide-list guide-milestones">
              <li v-for="(m, i) in stage.milestones" :key="i">☐ {{ m }}</li>
            </ul>
          </div>

          <div class="guide-block">
            <h4>💡 提示</h4>
            <ul class="guide-list guide-tips">
              <li v-for="(t, i) in stage.tips" :key="i" v-html="t"></li>
            </ul>
          </div>
        </div>

        <!-- 单个功能大类 -->
        <div v-else-if="cat" class="card ov-card gd-cat">
          <h3>{{ cat.icon }} {{ cat.name }} <span class="dim">（{{ cat.items.length }} 项）</span></h3>
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

        <!-- 全部功能（六个大类依次排开；88 条一次看全的下场，按需点开） -->
        <template v-else>
          <div v-for="c in GUIDE_OVERVIEW" :key="c.id" class="card ov-card gd-cat">
            <h3>{{ c.icon }} {{ c.name }} <span class="dim">（{{ c.items.length }} 项）</span></h3>
            <div v-for="it in c.items" :key="it.name" class="ov-item">
              <div class="ov-head">
                <span class="ov-icon">{{ it.icon }}</span>
                <strong class="ov-name">{{ it.name }}</strong>
                <span class="badge badge-on ov-stage">{{ it.stage }}</span>
                <span class="dim ov-unlock">{{ it.unlock }}</span>
              </div>
              <p class="dim ov-desc" v-html="it.desc"></p>
            </div>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 左导航 + 右内容（方案 A）。列宽与「仅图标」那套沿用全站的 `--rail-w` 语汇，
   但攻略是**页面内**的两栏（不是 App 的左栏），所以自己一套 `gd-*` 前缀。 */
.gd-body {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin-top: 10px;
}
.gd-rail {
  flex: 0 0 208px;
  width: 208px;
  position: sticky;
  top: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: calc(100vh - 150px);
  overflow-y: auto;
}
.gd-cap {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  padding: 8px 2px 4px;
  letter-spacing: 0.4px;
}
.gd-cap:first-child { padding-top: 2px; }
.gd-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  font-size: 12px;
  font-family: inherit;
  color: var(--text);
  text-align: left;
  background: rgba(var(--panel-soft-rgb), 0.5);
  border: 1px solid var(--border);
  border-radius: 7px;
  cursor: pointer;
}
.gd-item:hover { border-color: var(--primary); }
.gd-item.on { border-color: var(--primary); background: rgba(var(--primary-tint-rgb), 0.18); color: var(--primary-strong); }
.gd-ic { flex: 0 0 auto; }
.gd-nm { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gd-meta { flex: 0 0 auto; font-size: 10px; }
.gd-now {
  flex: 0 0 auto;
  font-size: 10px;
  padding: 0 4px;
  border-radius: 4px;
  color: #fff;
  background: var(--btn-primary-bg);
}
/* 内容列：`min-width: 0` 是必需的（否则宽表/长行会把两栏一起撑破 —— 项目里的老坑） */
.gd-pane { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.gd-stage .guide-block:first-of-type { margin-top: 4px; }

/* 窄屏：左导航折成横向胶囊（与效果总览同一处理） */
@media (max-width: 940px) {
  .gd-body { flex-direction: column; }
  .gd-rail {
    position: static;
    width: 100%;
    flex: 0 0 auto;
    max-height: none;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px;
  }
  .gd-cap { width: 100%; padding: 4px 2px 0; }
  .gd-item { width: auto; }
}
</style>
