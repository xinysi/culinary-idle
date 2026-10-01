<script setup>
// 游玩攻略 —— 2026-10-01 用户两次定案：
//   ① 导航改成**平铺胶囊**（原来左侧竖排导航占掉 ~200px，用户：「效果总览和攻略的导航还是显得占空间」）
//   ② 内容重排：原来「行动清单」是 15 条长句连排，用户「太紧凑，玩家看的头疼」
//      ⇒ 每条拆成「一句话标题 + 正文」，卡片之间放开留白；标题由**展示层派生**（截到第一个分隔符），
//        数据里 GUIDE_STAGES 一个字没动。
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
  if (!sel.value.startsWith('stage:')) return // 正在看功能大类时不打断
  sel.value = `stage:${id}`
})

const isAll = computed(() => sel.value === 'all')
const stage = computed(() => (sel.value.startsWith('stage:') ? GUIDE_STAGES.find((s) => s.id === sel.value.slice(6)) : null))
const cat = computed(() => (sel.value.startsWith('cat:') ? GUIDE_OVERVIEW.find((c) => c.id === sel.value.slice(4)) : null))
const overviewCount = computed(() => GUIDE_OVERVIEW.reduce((a, c) => a + c.items.length, 0))
const headNote = computed(() => {
  if (isAll.value) return `全部功能一览（${overviewCount.value} 项）· 作用说明 + 建议游玩阶段`
  if (cat.value) return `${cat.value.items.length} 项 · 作用说明 + 建议游玩阶段`
  return `六阶段攻略 · 按你的对决等级（${player.combatLevel} 级）自动定位；内容对照当前全部游戏数据`
})

/** 把一条行动拆成「一句话标题 + 剩余正文」（纯展示派生，GUIDE_STAGES 一个字没动）。
 *  ⚠️ 首版只取标题、正文仍渲染整条 ⇒ 标题与正文第一句**重复**了一遍，反而更乱（截图一眼看出）。
 *  正文必须是**去掉标题之后**的剩余部分；富文本标记跨在标题里时找不到位置，就整段当正文、不拆。 */
function stepParts(s) {
  const raw = String(s ?? '')
  const plain = raw.replace(/<[^>]+>/g, '').replace(/^[\s⚠️]*/, '')
  // ⚠️ 分隔符里要含左括号：不然「开局先选挂机目标开始（如采摘苹果」会把半个括号留在标题里（截图一眼看出）
  const m = plain.match(/^([^：:，。；（(【]{4,24})/)
  if (!m) return { title: '', rest: raw }
  const title = m[1]
  const at = raw.indexOf(title)
  if (at < 0) return { title: '', rest: raw }
  const rest = raw.slice(at + title.length).replace(/^[：:，。；、\s]+/, '')
  return { title, rest: rest || '' }
}
const steps = computed(() => (stage.value?.actions ?? []).map(stepParts))

/** 阶段流程图（2026-10-01 用户要求「参考运营调参员页面那种流程图」）：
 *  形态照 `TunerPanel.vue` 的 `.tp-chain`（一排方框 + `→` 箭头 + 一句脚注），但这里**可点** ——
 *  点某一步会滚到下面那张行动卡并闪一下，把「先做什么」与「怎么做」连起来。
 *  ⚠️ 先只在「新手」上落地（用户要求先看一个阶段的效果再铺开），没登记的阶段不渲染这块。 */
const FLOWS = {
  beginner: {
    title: '核心循环',
    note: '这个游戏的节奏就这四步：挑一个目标挂机 → 拿产出做东西 → 用做出来的东西打赢对决 → 解锁更好的目标。',
    nodes: [
      { label: '① 选目标', to: 0 },
      { label: '② 挂机产出', to: 3 },
      { label: '③ 制作', to: 7 },
      { label: '④ 打赢对决', to: 10 },
    ],
  },
}
const flow = computed(() => FLOWS[stage.value?.id] ?? null)
/** 点流程图某一步 ⇒ 滚到那张行动卡并闪一下（唯一出口，别在模板里各写一份） */
function jumpToStep(i) {
  const el = document.querySelector(`[data-step="${i}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('gd-step-flash')
  setTimeout(() => el.classList.remove('gd-step-flash'), 1200)
}
function stepIcon(i) {
  return ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'][i] ?? `${i + 1}.`
}
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
          当前
          <span class="badge badge-on">{{ stage ? stage.icon + ' ' + stage.name : cat ? cat.icon + ' ' + cat.name : '📋 全部功能' }}</span>
        </div>
        <button class="btn btn-sm" @click="ui.setView('skill')">← 返回技能</button>
      </div>
    </header>

    <!-- 导航 = 平铺胶囊（两行：按进度 / 按功能），不再占一栏宽度 -->
    <div class="gd-chips">
      <span class="gd-cap">按进度</span>
      <button
        v-for="s in GUIDE_STAGES" :key="s.id"
        class="gd-chip" :class="{ on: sel === 'stage:' + s.id }"
        :title="`${s.name} · ${s.range}`"
        @click="sel = 'stage:' + s.id"
      >
        <span>{{ s.icon }}</span><span class="gd-chip-nm">{{ s.name }}</span>
        <span v-if="s.id === currentId" class="gd-now">当前</span>
      </button>
      <span class="gd-cap gd-cap-2">按功能</span>
      <button
        v-for="c in GUIDE_OVERVIEW" :key="c.id"
        class="gd-chip" :class="{ on: sel === 'cat:' + c.id }"
        @click="sel = 'cat:' + c.id"
      >
        <span>{{ c.icon }}</span><span class="gd-chip-nm">{{ c.name }}</span>
        <span class="gd-chip-n dim">{{ c.items.length }}</span>
      </button>
      <button class="gd-chip" :class="{ on: isAll }" @click="sel = 'all'">
        <span>📋</span><span class="gd-chip-nm">全部功能</span>
        <span class="gd-chip-n dim">{{ overviewCount }}</span>
      </button>
    </div>

    <!-- 阶段 -->
    <div v-if="stage" class="gd-stage">
      <div class="card gd-hero">
        <h3>{{ stage.icon }} {{ stage.name }} <span class="dim">（{{ stage.range }}）</span></h3>
        <p class="gd-summary">{{ stage.summary }}</p>
        <ul class="gd-goals">
          <li v-for="(g, i) in stage.goals" :key="i">{{ g }}</li>
        </ul>
      </div>

      <!-- 阶段流程图（借鉴运营调参页的 `.tp-chain`）：一眼看懂「先后」，点一步滚到对应行动卡 -->
      <div v-if="flow" class="card gd-flow">
        <div class="gd-flow-head">
          <h4>🧭 {{ flow.title }}</h4>
          <span class="dim">点任一步，跳到下面的对应做法</span>
        </div>
        <div class="gd-fnodes">
          <template v-for="(n, i) in flow.nodes" :key="i">
            <span v-if="i" class="gd-farrow">→</span>
            <button class="gd-fnode" @click="jumpToStep(n.to)">{{ n.label }}</button>
          </template>
        </div>
        <p class="dim gd-fnote">{{ flow.note }}</p>
      </div>

      <h4 class="gd-sec">📋 行动清单 <span class="dim">按顺序做，遇到卡点再回头看</span></h4>
      <ol class="gd-steps">
        <!-- actions 里带 <b> 富文本 ⇒ 必须 v-html（{{ }} 会把标记当文本显示出来，项目里的老坑） -->
        <li v-for="(a, i) in stage.actions" :key="i" class="gd-step" :data-step="i">
          <span class="gd-step-no">{{ stepIcon(i) }}</span>
          <div class="gd-step-body">
            <div v-if="steps[i]?.title" class="gd-step-title">{{ steps[i].title }}</div>
            <div class="gd-step-text" v-html="steps[i]?.rest || a"></div>
          </div>
        </li>
      </ol>

      <div class="gd-two">
        <div class="card gd-mini">
          <h4>🏁 里程碑 <span class="dim">自评检查点</span></h4>
          <ul class="gd-checks">
            <li v-for="(m, i) in stage.milestones" :key="i"><span class="gd-box">☐</span>{{ m }}</li>
          </ul>
        </div>
        <div class="card gd-mini">
          <h4>💡 提示</h4>
          <ul class="gd-tips">
            <li v-for="(t, i) in stage.tips" :key="i" v-html="t"></li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 单个功能大类 / 全部 -->
    <div v-else class="gd-cats">
      <div v-for="c in isAll ? GUIDE_OVERVIEW : [cat]" :key="c.id" class="card ov-card gd-cat">
        <h3>{{ c.icon }} {{ c.name }} <span class="dim">（{{ c.items.length }} 项）</span></h3>
        <div class="gd-items">
          <div v-for="it in c.items" :key="it.name" class="ov-item gd-item">
            <div class="ov-head">
              <span class="ov-icon">{{ it.icon }}</span>
              <strong class="ov-name">{{ it.name }}</strong>
              <span class="badge badge-on ov-stage">{{ it.stage }}</span>
              <span class="dim ov-unlock">{{ it.unlock }}</span>
            </div>
            <!-- desc 是富文本（带 <b>），必须 v-html -->
            <p class="dim ov-desc" v-html="it.desc"></p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 导航 = 平铺胶囊（用户 2026-10-01：「1 平铺胶囊吧」）。两段用 `gd-cap` 起头，内容自动换行，
   整块吸顶（切到下面看正文时还能一键换阶段）。 */
.gd-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(var(--panel-soft-rgb), 0.45);
  border: 1px solid var(--border);
  border-radius: 9px;
  position: sticky;
  top: 6px;
  z-index: 3;
  backdrop-filter: blur(6px);
}
.gd-cap { flex: 0 0 auto; font-size: 11px; font-weight: 600; color: var(--text-dim); }
.gd-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  font-size: 12px;
  font-family: inherit;
  color: var(--text);
  background: rgba(var(--panel-rgb), 0.75);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
}
.gd-chip:hover { border-color: var(--primary); }
/* 选中态：主色描边 + 加深底色（**文字不换色** —— 主色压主色淡底在浅色主题下对比度不够，
   e2e-dark 的皮肤体检当场抓到过，与项目里「别把品牌色当文字色」是同一条） */
.gd-chip.on {
  border-color: var(--primary-strong);
  box-shadow: inset 0 0 0 1px var(--primary-strong);
  font-weight: 700;
}
.gd-chip-nm { }
.gd-chip-n { font-size: 10px; }
.gd-now { font-size: 10px; padding: 0 4px; border-radius: 4px; color: #fff; background: var(--btn-primary-bg); }

/* ── 内容区：放开留白（用户：「太紧凑，玩家看的头疼」）── */
.gd-stage { margin-top: 12px; display: flex; flex-direction: column; gap: 14px; }
.gd-hero h3 { margin-bottom: 8px; }
.gd-summary { margin: 0 0 10px; color: var(--text-dim); line-height: 1.8; }
.gd-goals { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 7px; line-height: 1.75; }
.gd-sec { margin: 4px 0 0; font-size: 15px; }

/* 阶段流程图（2026-10-01；形态照 TunerPanel 的 `.tp-chain`：一排方框 + 箭头 + 脚注） */
.gd-flow { padding: 14px 16px; }
.gd-flow-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.gd-flow-head h4 { margin: 0; }
.gd-fnodes { display: flex; align-items: stretch; gap: 6px; flex-wrap: wrap; }
.gd-fnode {
  padding: 8px 14px;
  font-size: 13px;
  font-family: inherit;
  font-weight: 600;
  color: var(--text);
  background: rgba(var(--primary-tint-rgb), 0.14);
  border: 1px solid var(--border);
  border-radius: 9px;
  cursor: pointer;
}
.gd-fnode:hover { border-color: var(--primary); background: rgba(var(--primary-tint-rgb), 0.26); }
.gd-farrow { align-self: center; color: var(--muted); font-size: 13px; }
.gd-fnote { margin: 10px 0 0; line-height: 1.7; }
/* 点流程图后目标卡片闪一下（告诉玩家「跳到的是这一条」） */
.gd-step-flash { animation: gd-flash 1.2s ease; }
@keyframes gd-flash {
  0%, 100% { box-shadow: none; }
  30% { box-shadow: 0 0 0 3px rgba(var(--primary-tint-rgb), 0.55); }
}

/* 行动清单排两栏（用户 2026-10-01 选定方案 A）：
   宽屏两列、窄屏回单列。grid 按行填充 ⇒ 阅读顺序是 ①② / ③④，与编号一致。
   `minmax(0, 1fr)` 不能省：直接写 `1fr` 时长内容会把列撑破（项目里的老坑）。 */
.gd-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: start;
}
.gd-step {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(var(--panel-rgb), 0.72);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.gd-step-no { flex: 0 0 auto; width: 22px; font-weight: 700; color: var(--primary-strong); }
.gd-step-body { flex: 1 1 auto; min-width: 0; }
.gd-step-title { font-weight: 600; margin-bottom: 5px; line-height: 1.6; }
.gd-step-text { color: var(--text-dim); line-height: 1.85; font-size: 13px; }

.gd-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.gd-mini h4 { margin: 0 0 10px; }
.gd-checks, .gd-tips { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; line-height: 1.8; }
.gd-box { margin-right: 7px; color: var(--text-dim); }

.gd-cats { margin-top: 12px; display: flex; flex-direction: column; gap: 12px; }
.gd-cat .gd-items { display: flex; flex-direction: column; gap: 12px; }
.gd-item { padding: 9px 0; border-top: 1px dashed var(--border); }
.gd-item:first-child { border-top: none; }
.ov-desc { line-height: 1.8; }

@media (max-width: 1100px) {
  .gd-steps { grid-template-columns: 1fr; }  /* 窄一点就回单列，别把卡片挤成条 */
}

@media (max-width: 940px) {
  .gd-chips { position: static; }
  .gd-two { grid-template-columns: 1fr; }
}
</style>
