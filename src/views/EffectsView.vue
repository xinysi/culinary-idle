<script setup>
// 效果总览（v2.6.0 立；2026-10-01 按用户要求**重做为「按系统分栏」**）——
// 「此刻正在生效的一切增益 / 效果 / 减益」一页看全。
//
// 🔴 为什么重做（用户原话）：「我还是觉得效果总览页面需要重做一下」「为什么没看到美食探索之类的」。
//    v2.30.x 那版是**两条长清单**（生效列表 + 公式列表）叠在一起，想查某个系统得自己滚；
//    而玩家找东西是按**系统**找的（「美食探索受什么影响」），不是按「乘区赛道」找的。
//    ⇒ 改成**左系统栏 + 右内容**：点一个系统，右边只看它 —— 正生效 / 全部规则与公式 / 还在叠哪些全局效果。
//
// 本页**零新增存档字段、不写任何状态**：全部是对既有 player 接口的只读汇总，逐条登记在
// `src/game/data/activeEffects.js`（那张表是全项目效果来源的唯一清单，`content_sync_audit` 会守着它）。
// ⚠️ 面向玩家的模板里**不要**写源码路径与 CI 术语（2026-09-18 用户报「效果总览暴露了文件路径」）。
import { computed, ref, watchEffect } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { useIntervalTick } from '../composables/useIntervalTick.js'
import { collectEffects, EFFECT_ROWS, EFFECT_SYSTEMS, systemOf, formulaOf } from '../game/data/activeEffects.js'
import { getAllSkillInstances, getSkillInstance } from '../game/skills/registry.js'
import { getCombat } from '../game/combat/Combat.js'
import StatusChips from '../components/StatusChips.vue'
import StatusChip from '../components/StatusChip.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'weather', label: '🌤 天气运势' },
  { view: 'skill', label: '🌾 技能' },
  { view: 'log', label: '📖 图鉴' },
  { view: 'stats', label: '📊 统计' },
]

// 🔴 本页是全站**唯一**实测「每 tick 重算真的贵」的页面（2026-09-28 计时：`collectEffects` **2037 µs/次**）。
//    这里显示的全是**秒级文案**（剩余时长），1Hz 完全够 ⇒ 走 1Hz 慢节拍。
const tick = useIntervalTick(1000)

const data = computed(() => {
  tick.value // 跟随 1Hz 慢节拍刷新剩余时间（只作依赖触发器）
  return collectEffects(player, {
    combat: getCombat(),
    skill: (id) => getSkillInstance(id),
    allSkills: () => getAllSkillInstances(),
  })
})

/** 扁平的「id → 实时状态」表（正生效 / 未生效 + 原因 + 剩余），左栏各处共用同一份 */
const live = computed(() => {
  const m = new Map()
  for (const it of [...data.value.groups, ...data.value.dormant].flatMap((g) => g.items)) m.set(it.id, it)
  return m
})
/** 注册表行 + 实时状态 + 公式，一次拼好（模板只管渲染） */
const rowsOf = (pred) => EFFECT_ROWS.filter(pred).map((r) => {
  const st = live.value.get(r.id) ?? {}
  return { ...r, on: !!st.on, text: st.text ?? '', why: st.why ?? '', left: st.left ?? '', tough: !!st.tough, fx: formulaOf(r.id, player, { skill: (id) => getSkillInstance(id) }) }
})

const SAT = EFFECT_SYSTEMS.map((s) => ({ ...s, n: EFFECT_ROWS.filter((r) => (s.overview ? true : systemOf(r) === s.id)).length }))
const activeSys = ref('all')
const cur = computed(() => SAT.find((s) => s.id === activeSys.value) ?? SAT[0])
/** 左栏每格显示「生效 N / 共 M」——M 是这个系统的登记条数 */
const onCountOf = (s) => rowsOf((r) => (s.overview ? true : systemOf(r) === s.id)).filter((r) => r.on).length

const mine = computed(() => rowsOf((r) => (cur.value.overview ? true : systemOf(r) === cur.value.id)))
const mineOn = computed(() => mine.value.filter((r) => r.on))
const mineOff = computed(() => mine.value.filter((r) => !r.on))
/** 还在叠的全局效果（非全局系统才显示）：它们对所有系统都生效，最容易漏看 */
const globalOn = computed(() => (cur.value.id === 'global' || cur.value.overview ? [] : rowsOf((r) => r.group === 'global').filter((r) => r.on)))

// 记录「历史同时生效最多项数」（纯统计口径，供成就 / 统计页；不产生任何数值加成）
watchEffect(() => player.noteEffectsSeen(data.value.stats.on))

const KIND_TAG = { buff: '增益', debuff: '减益', rule: '规则' }
const debuffs = computed(() => mineOn.value.filter((r) => r.kind === 'debuff'))

function open(row) {
  if (!row.view) return
  if (row.view.startsWith('skill:')) {
    player.setActiveSkill(row.view.slice(6))
    ui.setView('skill')
    return
  }
  ui.setView(row.view)
}
function jumpLabel(view) {
  if (!view) return ''
  return view.startsWith('skill:') ? '去对应技能' : '去该页'
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🧿 效果总览</h2>
        <p class="dim">
          按<b>系统</b>查：点左边一个系统，右边只看它 —— <b>正生效的加成</b>、<b>全部规则与公式</b>、
          以及还叠着哪些<b>全局效果</b>。<b>本页只做汇总与跳转</b>，不会替你执行任何操作，也不改动任何数据。
        </p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">{{ data.stats.on }} / {{ data.stats.total }} 项生效</div>
        <p class="dim mono">增益 {{ data.stats.onBuff }} · 减益 {{ data.stats.onDebuff }} · 规则 {{ data.stats.onRule }}</p>
      </div>
    </header>

    <StatusChips>
      <div class="status-chips-row">
        <StatusChip label="生效中" tone="on">{{ data.stats.on }} 项</StatusChip>
        <StatusChip label="增益" tone="good">{{ data.stats.onBuff }}</StatusChip>
        <StatusChip label="减益" :tone="data.stats.onDebuff ? 'bad' : ''">{{ data.stats.onDebuff }}</StatusChip>
        <StatusChip label="规律性加成">规则 {{ data.stats.onRule }}</StatusChip>
      </div>
      <div class="status-chips-row">
        <StatusChip label="本期未生效">{{ data.stats.off }} 项（含原因）</StatusChip>
        <StatusChip label="登记总数">{{ data.stats.total }} 条（全项目效果清单）</StatusChip>
      </div>
    </StatusChips>

    <div class="fx-split">
      <!-- 左：系统栏（与「左导航右内容」同一套习惯） -->
      <nav class="fx-rail">
        <button
          v-for="s in SAT"
          :key="s.id"
          class="fx-rail-item"
          :class="{ active: s.id === cur.id }"
          @click="activeSys = s.id"
        >
          <span class="fx-rail-icon">{{ s.icon }}</span>
          <span class="fx-rail-name">{{ s.name }}</span>
          <span class="fx-rail-n">{{ onCountOf(s) }}<i>/{{ s.n }}</i></span>
        </button>
      </nav>

      <!-- 右：内容 -->
      <div class="fx-pane">
        <h3 class="fx-pane-head">
          {{ cur.icon }} {{ cur.name }}
          <span class="dim fx-pane-sub">{{ mineOn.length }} 项生效 · 共登记 {{ mine.length }} 条</span>
        </h3>

        <!-- ① 减益优先（玩家最需要先看到「我正在被扣什么」） -->
        <div v-if="debuffs.length" class="card fx-alert">
          <h3>⚠ 正在生效的减益（{{ debuffs.length }}）</h3>
          <div class="fx-list">
            <div v-for="d in debuffs" :key="d.id" class="fx-row fx-row-bad">
              <span class="fx-icon">{{ d.icon }}</span>
              <span class="fx-body">
                <span class="fx-name">{{ d.name }}<span class="fx-src dim">· {{ d.src }}</span></span>
                <span class="fx-text">{{ d.text }}</span>
              </span>
              <button v-if="d.view" class="btn btn-sm" @click="open(d)">{{ jumpLabel(d.view) }} ↗</button>
            </div>
          </div>
        </div>

        <!-- ② 正生效 -->
        <div class="card">
          <h3>✅ 正生效（{{ mineOn.length }}）<span class="dim fx-hint">数值口径逐条显示；点右侧按钮可跳到对应页面</span></h3>
          <p v-if="!mineOn.length" class="dim fx-empty">这个系统此刻没有任何加成在生效（下面的「规则与公式」仍然成立）。</p>
          <div class="fx-list">
            <div v-for="i in mineOn.filter((x) => x.kind !== 'debuff')" :key="i.id" class="fx-row" :class="{ 'fx-row-rule': i.kind === 'rule', 'fx-row-tough': i.tough }">
              <span class="fx-icon">{{ i.icon }}</span>
              <span class="fx-body">
                <span class="fx-name">
                  {{ i.name }}
                  <span class="fx-tag" :class="`fx-tag-${i.kind}`">{{ KIND_TAG[i.kind] }}</span>
                  <span class="fx-src dim">· {{ i.src }}</span>
                </span>
                <span class="fx-text">{{ i.text }}</span>
              </span>
              <span v-if="i.left" class="dim fx-left">剩 {{ i.left }} 分</span>
              <button v-if="i.view" class="btn btn-sm" @click="open(i)">{{ jumpLabel(i.view) }} ↗</button>
            </div>
          </div>
        </div>

        <!-- ③ 全局也在叠（非全局系统才显示） -->
        <div v-if="globalOn.length" class="card fx-global">
          <h3>🌤 另外还在叠这些全局效果（{{ globalOn.length }}）<span class="dim fx-hint">它们对所有系统都生效</span></h3>
          <div class="fx-list">
            <div v-for="i in globalOn" :key="i.id" class="fx-row">
              <span class="fx-icon">{{ i.icon }}</span>
              <span class="fx-body">
                <span class="fx-name">{{ i.name }}<span class="fx-src dim">· {{ i.src }}</span></span>
                <span class="fx-text">{{ i.text }}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- ④ 全部规则与公式（这个系统怎么算） -->
        <div class="card">
          <h3>🧮 规则与公式（{{ mine.length }}）<span class="dim fx-hint">每条的计算口径；数字取自游戏里的真实常量</span></h3>
          <div class="fx-formula-row" v-for="r in mine" :key="'f' + r.id" :class="{ 'fx-formula-off': !r.on }">
            <span class="fx-formula-name">{{ r.icon }} {{ r.name }}</span>
            <span class="fx-formula-tag">{{ r.fx?.tag }}</span>
            <span class="fx-formula-text">{{ r.fx?.f }}</span>
            <span v-if="r.fx?.note" class="fx-formula-note-inline dim">{{ r.fx.note }}</span>
          </div>
        </div>

        <!-- ⑤ 未生效（含原因，作为「没有漏掉」的证据） -->
        <div v-if="mineOff.length" class="card fx-dormant">
          <h3 class="dim">🗂 本期未生效（{{ mineOff.length }}）<span class="dim fx-hint">每一行都写明原因</span></h3>
          <div class="fx-row fx-row-off" v-for="i in mineOff" :key="i.id">
            <span class="fx-icon">{{ i.icon }}</span>
            <span class="fx-body">
              <span class="fx-name">{{ i.name }}<span class="fx-tag fx-tag-off">{{ KIND_TAG[i.kind] }}</span><span class="fx-src dim">· {{ i.src }}</span></span>
              <span class="dim fx-text">{{ i.why || '当前条件未满足' }}</span>
            </span>
            <button v-if="i.view" class="btn btn-sm" @click="open(i)">{{ jumpLabel(i.view) }} ↗</button>
          </div>
        </div>
      </div>
    </div>

    <p class="dim fx-note">
      说明：①「增益 / 减益」按<b>此刻是否真的在起作用</b>判定（增益剂要没过期、天气要有非中性倍率、奥义要激活且品鉴点没耗尽）；
      ②「规则」类是不随状态开关的规律性加成；③ 对决内的临时状态只在战斗进行中存在，战斗结束即清空；
      ④ 左栏每格写的是「生效 N / 登记 M」——未生效的收在右边最下方并写明原因，所以不会悄悄少项。
    </p>

    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
/* ── 左系统栏 + 右内容（复用「左导航右内容」的观感）── */
.fx-split {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-top: 12px;
}
.fx-rail {
  flex: 0 0 186px;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: calc(100vh - 150px);
  overflow-y: auto;
}
.fx-rail-item {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  font-size: 12.5px;
  text-align: left;
  border-radius: 6px;
  border: 1px dashed var(--border);
  background: var(--bg-soft);
  color: var(--text);
  cursor: pointer;
}
.fx-rail-item:hover { border-color: var(--primary); }
.fx-rail-item.active {
  background: rgba(var(--primary-tint-rgb), 0.18);
  border-style: solid;
  border-color: var(--primary);
  font-weight: 600;
}
.fx-rail-icon { text-align: center; }
.fx-rail-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fx-rail-n { font-size: 11px; color: var(--muted); }
.fx-rail-n i { font-style: normal; opacity: 0.7; }

.fx-pane { flex: 1; min-width: 0; }
.fx-pane-head { margin: 0 0 8px; font-size: 15px; }
.fx-pane-sub { font-size: 12px; font-weight: 400; margin-left: 8px; }
.fx-hint { font-size: 11.5px; font-weight: 400; margin-left: 8px; }
.fx-empty { font-size: 12px; padding: 6px 2px; }

.fx-alert { border-color: var(--bad-soft); background: var(--bad-soft); margin-bottom: 10px; }
.fx-global { margin-top: 10px; border-style: dashed; }
.fx-dormant { margin-top: 10px; }
.fx-list { display: flex; flex-direction: column; gap: 6px; }
.fx-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 66px 106px;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.fx-row-bad { border-style: solid; border-color: var(--bad-soft); }
.fx-row-rule { opacity: 0.9; }
.fx-row-tough { border-color: var(--warn-soft); }
.fx-row-off { opacity: 0.72; border-style: dotted; }
.fx-icon { font-size: 16px; text-align: center; }
.fx-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fx-name { font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.fx-tag {
  font-size: 11px; font-weight: 400; padding: 0 6px; border-radius: 6px;
  background: rgba(var(--panel-soft-rgb), 0.72); border: 1px solid var(--border); color: var(--muted);
}
.fx-tag-buff { color: var(--good-strong); border-color: var(--good-soft); background: var(--good-soft); }
.fx-tag-debuff { color: var(--bad-strong); border-color: var(--bad-soft); background: var(--bad-soft); }
.fx-tag-off { color: var(--muted); }
.fx-src { font-size: 11px; font-weight: 400; }
.fx-text { font-size: 12px; line-height: 1.6; }
.fx-left { font-size: 12px; text-align: right; }

/* ── 规则与公式（紧凑：名称 | 标签 | 公式 | 一句注）── */
.fx-formula-row {
  display: grid;
  grid-template-columns: minmax(120px, 190px) 92px minmax(0, 1fr) minmax(0, 232px);
  align-items: baseline;
  gap: 8px;
  font-size: 12.5px;
  line-height: 1.7;
  padding: 5px 10px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
  margin-bottom: 3px;
}
.fx-formula-off { opacity: 0.62; }
.fx-formula-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fx-formula-tag {
  font-size: 11px; text-align: center; padding: 0 6px; border-radius: 6px;
  background: rgba(var(--panel-soft-rgb), 0.72); border: 1px solid var(--border); color: var(--text); white-space: nowrap;
}
.fx-formula-text { color: var(--text); }
.fx-formula-note-inline { font-size: 11.5px; }

.fx-note { font-size: 12px; line-height: 1.8; margin-top: 12px; }

@media (max-width: 940px) {
  /* 窄屏：系统栏折成横向一排胶囊，内容整宽 */
  .fx-split { flex-direction: column; }
  .fx-rail { flex: none; width: 100%; position: static; flex-direction: row; max-height: none; overflow-x: auto; }
  .fx-rail-item { grid-template-columns: 20px auto auto; flex: 0 0 auto; }
}
@media (max-width: 720px) {
  .fx-row { grid-template-columns: 22px minmax(0, 1fr) 100px; }
  .fx-left { display: none; }
  .fx-formula-row { grid-template-columns: minmax(0, 1fr) 84px; }
  .fx-formula-text, .fx-formula-note-inline { grid-column: 1 / -1; }
}
</style>
