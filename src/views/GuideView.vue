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

/** 把该阶段的行动**重新分组**（2026-10-01 用户：「攻略所有内容都要重新排版」）。
 *  纯派生、不写死下标、数据一个字不改：文案里带页面路径的（`左侧栏 · 挂机产线` 这种）
 *  归到「🧭 功能导览」并按大类再分小节，其余归「🚀 推进主线」—— 六个阶段同时受益。 */
const sectioned = computed(() => {
  const main = []
  const tour = new Map()
  const acts = stage.value?.actions ?? []
  acts.forEach((raw, i) => {
    const m = String(raw).match(/左侧栏\s*·\s*([^「」（）\s，、。；·]{2,6})/)
    if (m) {
      const g = m[1].trim()
      if (!tour.has(g)) tour.set(g, [])
      tour.get(g).push(i)
    } else main.push(i)
  })
  return { main, tour: [...tour.entries()] }
})

/** 功能页分组（88 条不再是一长条）：按数据里本来就有的「建议阶段」字段切成小节。
 *  ⚠️ 用「扁平行 + 行内小节标题」而不是嵌套容器 —— 不动物件嵌套，模板不可能被改坏。 */
const STAGE_ORDER = ['全程', '新手起', '前期起', '中期起', '后期起', '大后期起', '毕业']
function groupByStage(c) {
  const rows = []
  const seen = new Map()
  for (const it of c.items) {
    const key = it.stage ?? '全程'
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key).push(it)
  }
  const keys = [...seen.keys()].sort((a, b) => {
    const ia = STAGE_ORDER.indexOf(a), ib = STAGE_ORDER.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  for (const k of keys) {
    rows.push({ header: `${k}（${seen.get(k).length}）` })
    for (const it of seen.get(k)) rows.push({ item: it })
  }
  return rows
}

/** 阶段流程图（2026-10-01 用户要求「参考运营调参员页面那种流程图」）：
 *  形态照 `TunerPanel.vue` 的 `.tp-chain`（一排方框 + `→` 箭头 + 一句脚注），但这里**可点** ——
 *  点某一步会滚到下面那张行动卡并闪一下，把「先做什么」与「怎么做」连起来。
 *  ⚠️ 先只在「新手」上落地（用户要求先看一个阶段的效果再铺开），没登记的阶段不渲染这块。 */
const FLOWS = {
  beginner: {
    title: '核心循环',
    note: '这个游戏的节奏就这四步：挑一个目标挂机 → 拿产出做东西 → 用做出来的东西打赢对决 → 解锁更好的目标。',
    nodes: [
      { label: '选目标', to: 0 },
      { label: '挂机产出', to: 3 },
      { label: '制作', to: 7 },
      { label: '打赢对决', to: 10 },
    ],
  },
  early: {
    title: '自给自足',
    note: '这一阶段的目标是「尽量不用买」：农耕供食材、调料调出味道、装备换到同档，再往前推三个区域。',
    nodes: [
      { label: '农耕自给', to: 0 },
      { label: '调料与炼金', to: 2 },
      { label: '换上铁装', to: 4 },
      { label: '推进对决', to: 7 },
    ],
  },
  mid: {
    title: '把餐厅做起来',
    note: '中期开始从「自己吃」转向「卖给别人」：餐厅时收、首领节奏、赛季与竞技场三线并行。',
    nodes: [
      { label: '换更高档装备', to: 0 },
      { label: '餐厅经营', to: 6 },
      { label: '首领节奏', to: 14 },
      { label: '赛季与竞技场', to: 21 },
    ],
  },
  late: {
    title: '史诗装与转生',
    note: '后期两条腿走路：装备敲到史诗段、同时开始转生循环（每层 +20% 经验，是长线的主要成长）。',
    nodes: [
      { label: '敲史诗装', to: 0 },
      { label: '推到甜品女王', to: 1 },
      { label: '转生循环', to: 3 },
      { label: '探索与秘境', to: 6 },
    ],
  },
  lategame: {
    title: '四线并进',
    note: '大后期是「挂机产线 + 转生层数 + 挑战塔」一起推：产线供料、转生拉经验、塔检验配置。',
    nodes: [
      { label: '传说毕业装', to: 0 },
      { label: '产线全开', to: 5 },
      { label: '转生多次', to: 3 },
      { label: '无尽挑战塔', to: 20 },
    ],
  },
  endgame: {
    title: '收尾与极限',
    note: '毕业阶段是收尾：终局首领、图鉴与成就全清、然后回挑战塔刷极限深度。',
    nodes: [
      { label: '终局首领', to: 0 },
      { label: '图鉴与成就', to: 3 },
      { label: '赛季与竞技收尾', to: 7 },
      { label: '挑战塔主战场', to: 2 },
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

    <!-- 阶段：左 = 正文（hero / 流程图 / 行动清单），右 = 里程碑与提示（2026-10-02） -->
    <div v-if="stage" class="gd-stage">
      <div class="gd-main">
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
            <span v-if="i" class="gd-fline" aria-hidden="true"></span>
            <button class="gd-fnode" @click="jumpToStep(n.to)">
              <span class="gd-fnum">{{ i + 1 }}</span>
              <span class="gd-flabel">{{ n.label }}</span>
            </button>
          </template>
        </div>
        <p class="dim gd-fnote">{{ flow.note }}</p>
      </div>

      <h4 class="gd-sec">🚀 推进主线 <span class="dim">这一阶段先做这些，按顺序来</span></h4>
      <ol class="gd-steps">
        <li v-for="i in sectioned.main" :key="i" class="gd-step" :data-step="i">
          <span class="gd-step-no">{{ stepIcon(i) }}</span>
          <div class="gd-step-body">
            <div v-if="steps[i]?.title" class="gd-step-title">{{ steps[i].title }}</div>
            <div class="gd-step-text" v-html="steps[i]?.rest || stage.actions[i]"></div>
          </div>
        </li>
      </ol>

      <!-- 功能导览：按文案里写的页面大类自动分小节 -->
      <template v-for="[g, idxs] in sectioned.tour" :key="g">
        <h4 class="gd-sec">🧭 功能导览 · {{ g }} <span class="dim">{{ idxs.length }} 项</span></h4>
        <ol class="gd-steps">
          <li v-for="i in idxs" :key="i" class="gd-step" :data-step="i">
            <span class="gd-step-no">{{ stepIcon(i) }}</span>
            <div class="gd-step-body">
              <div v-if="steps[i]?.title" class="gd-step-title">{{ steps[i].title }}</div>
              <div class="gd-step-text" v-html="steps[i]?.rest || stage.actions[i]"></div>
            </div>
          </li>
        </ol>
      </template>

      </div><!-- /gd-main -->

      <aside class="gd-two">
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
      </aside>
    </div>

    <!-- 单个功能大类 / 全部 -->
    <div v-else class="gd-cats">
      <div v-for="c in isAll ? GUIDE_OVERVIEW : [cat]" :key="c.id" class="card ov-card gd-cat">
        <h3>{{ c.icon }} {{ c.name }} <span class="dim">（{{ c.items.length }} 项 · 按建议阶段分组）</span></h3>
        <div class="gd-items">
          <template v-for="row in groupByStage(c)" :key="row.header ?? row.item.name">
          <div v-if="row.header" class="gd-sghead">{{ row.header }}</div>
          <div v-else class="ov-item gd-item">
            <div class="ov-head">
              <span class="ov-icon">{{ row.item.icon }}</span>
              <strong class="ov-name">{{ row.item.name }}</strong>
              <span class="badge badge-on ov-stage">{{ row.item.stage }}</span>
              <span class="dim ov-unlock">{{ row.item.unlock }}</span>
            </div>
            <!-- desc 是富文本（带 <b>），必须 v-html -->
            <p class="dim ov-desc" v-html="row.item.desc"></p>
          </div>
          </template>
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
/* 两栏工作区（2026-10-02）：左 = 正文（限阅读宽度，别让一行上百字），右 = 里程碑/提示。
   上一版只给整页加了 max-width ⇒ 右边空出一大片（用户：「右边空白你打算怎么办」）—— 空出来的
   宽度本来就该给支撑信息用，而不是留白。 */
.gd-stage {
  margin-top: 12px;
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(300px, 1fr);
  gap: 18px;
  align-items: start;
}
.gd-main { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.gd-hero h3 { margin-bottom: 8px; }
.gd-summary { margin: 0 0 10px; color: var(--text-dim); line-height: 1.8; }
.gd-goals {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.gd-goals li {
  padding: 4px 11px;
  font-size: 12.5px;
  border-radius: 999px;
  background: rgba(var(--panel-soft-rgb), 0.7);
  border: 1px solid var(--border);
}
/* 小节标题：主色横条（原来只是一行粗体字，与正文拉不开层次 ⇒ 页面看着"平"） */
.gd-sec {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 24px 0 8px;
  padding: 9px 14px;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--primary-strong);
  border-radius: 9px;
  background: rgba(var(--primary-tint-rgb), 0.16);
  border-left: 4px solid var(--primary);
}
/* 功能页的阶段小节标题（行内版，不嵌套容器） */
.gd-sghead {
  /* ⚠️ 必须跨两列：不跨的话「前期起 (1)」这类标题只占左栏，而网格会把条目继续往右栏填
     ⇒ 标题与自己的条目错位（截图里一眼看出）。跨列后会强制下一行从第 1 列开始。 */
  grid-column: 1 / -1;
  margin: 14px 0 2px;
  padding-bottom: 5px;
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-strong);
  border-bottom: 1px dashed var(--border);
}
.gd-sghead:first-child { margin-top: 6px; }

/* 阶段流程图（2026-10-01；形态照 TunerPanel 的 `.tp-chain`：一排方框 + 箭头 + 脚注） */
.gd-flow { padding: 16px 18px; background: rgba(var(--primary-tint-rgb), 0.07); }
.gd-flow-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.gd-flow-head h4 { margin: 0; }
.gd-fnodes { display: flex; align-items: center; gap: 0; }
/* 节点：圆形序号在上、名称在下；节点之间是**自动铺满**的连线（flex:1）——
   这样整条流程会撑满卡片宽度，而不是几个小胶囊挤在左边、右边空一大块。 */
.gd-fnode {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  flex: 0 0 auto;
  padding: 4px 6px;
  font-family: inherit;
  background: none;
  border: none;
  cursor: pointer;
}
.gd-fnum {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  background: var(--btn-primary-bg);
  transition: transform 0.15s;
}
.gd-fnode:hover .gd-fnum { transform: scale(1.08); }
.gd-flabel { font-size: 12.5px; font-weight: 600; color: var(--text); white-space: nowrap; }
.gd-fline {
  flex: 1 1 auto;
  height: 2px;
  align-self: center;
  margin-bottom: 22px; /* 对齐圆心的水平线（下面还有名称那一行） */
  background: linear-gradient(90deg, rgba(var(--primary-rgb), 0.42), rgba(var(--primary-rgb), 0.16));
  position: relative;
}
.gd-fline::after {
  content: '›';
  position: absolute;
  right: -3px;
  top: 50%;
  transform: translateY(-54%);
  font-size: 17px;
  font-weight: 700;
  color: var(--primary-strong);
}
.gd-fnote { margin: 10px 0 0; line-height: 1.7; }
/* 点流程图后目标卡片闪一下（告诉玩家「跳到的是这一条」） */
.gd-step-flash { animation: gd-flash 1.2s ease; }
@keyframes gd-flash {
  0%, 100% { box-shadow: none; }
  30% { box-shadow: 0 0 0 3px rgba(var(--primary-tint-rgb), 0.55); }
}

/* ── 行动清单：单栏时间轴（2026-10-02 重做）──
   上一版是两栏卡片网格，卡片高度不等 ⇒ 每行参差不齐，整页像打翻的纸牌（用户：「太丑了」）。
   现在：一条竖轨 + 圆形序号 + 无边框条目 —— 阅读动线自上而下一条，安静、也能快扫。
   窄屏不需要改（本来就是单栏）。 */
.gd-steps {
  list-style: none;
  margin: 0;
  padding: 0 0 0 2px;
  position: relative;
}
.gd-steps::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 20px;
  bottom: 20px;
  width: 3px;
  background: rgba(var(--primary-rgb), 0.38);
}
.gd-step {
  display: flex;
  gap: 13px;
  padding: 9px 0;
  position: relative;
}
.gd-step-no {
  flex: 0 0 auto;
  width: 31px;
  height: 31px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: var(--btn-primary-bg);
  box-shadow: 0 0 0 3px var(--bg); /* 用页面底色把竖轨"切开"，序号才像站在线上 */
  z-index: 1;
}
.gd-step-body { flex: 1 1 auto; min-width: 0; padding-top: 3px; }
.gd-step-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; line-height: 1.55; }
.gd-step-text { color: var(--text-dim); line-height: 1.9; font-size: 13px; }

.gd-two { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 78px; }
.gd-mini h4 { margin: 0 0 10px; }
.gd-checks, .gd-tips { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; line-height: 1.8; }
.gd-box { margin-right: 7px; color: var(--text-dim); }

.gd-cats { margin-top: 12px; display: flex; flex-direction: column; gap: 12px; }
/* 功能页条目本来就短（名字 + 建议阶段 + 一两行说明）⇒ 排两栏正好把宽度用满，
   而不是像上一版那样右侧留一大片空白（用户截图指出）。 */
.gd-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 30px; align-items: start; }
.gd-cat .gd-items { align-items: start; } /* 栏数由 .gd-items 统一管（0,1,0 vs 这条 0,2,0：别在这里再写 display，否则会压掉两栏） */
.gd-item { padding: 11px 0; border-top: 1px dashed var(--border); }
.gd-item .ov-desc { line-height: 1.85; }
.gd-item:first-child { border-top: none; }
.ov-desc { line-height: 1.8; }

@media (max-width: 1100px) {
  /* 两栏在窄屏必须塌回单列 —— 否则右栏的 minmax(300px,1fr) 会把内容挤出屏幕
     （e2e-layout 在 390px 当场抓到「被裁控件/逐字竖排」）。 */
  .gd-stage { grid-template-columns: 1fr; }
  .gd-two { position: static; }
  .gd-items { grid-template-columns: 1fr; }
}

@media (max-width: 940px) {
  .gd-chips { position: static; }
  .gd-two { position: static; }
}
</style>
