<script setup>
// 效果总览（v2.6.0）— 「此刻正在生效的一切增益 / 效果 / 减益」一页看全。
//
// 为什么需要它：全项目只有 4 个真正的乘区聚合出口（技能经验、采集产量、餐厅时收、对决属性），
// 其余 20 多个来源散装在各技能与各视图里（天气的农田产量只在农耕里读、节庆的采集产量只在采集里读、
// 农耕精通联动只在采集里读…）。玩家因此很难回答「我现在到底吃了哪些加成」。
//
// 本页**零新增存档字段、不写任何状态**：全部是对既有 player 接口的只读汇总，逐条登记在
// `src/game/data/activeEffects.js`（那张表是全项目效果来源的唯一清单，`content_sync_audit` 会守着它）。
// 未生效的来源不隐藏，收进下方「本期未生效」折叠区并给出原因——这样「一个都没漏」是可验证的。
import { computed, watchEffect } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { collectEffects } from '../game/data/activeEffects.js'
import { getAllSkillInstances, getSkillInstance } from '../game/skills/registry.js'
import { getCombat } from '../game/combat/Combat.js'
import StatusChips from '../components/StatusChips.vue'
import StatusChip from '../components/StatusChip.vue'
import FoldCard from '../components/FoldCard.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'weather', label: '🌤 天气运势' },
  { view: 'skill', label: '🌾 技能' },
  { view: 'log', label: '📖 图鉴' },
  { view: 'stats', label: '📊 统计' },
]

const data = computed(() => {
  ui.loopTick // 跟随全局 tick 刷新剩余时间
  return collectEffects(player, {
    combat: getCombat(),
    skill: (id) => getSkillInstance(id),
    allSkills: () => getAllSkillInstances(),
  })
})

/** 减益单独提到最前面：玩家最需要先看到「我正在被扣什么」 */
const debuffs = computed(() => [...data.value.groups, ...data.value.dormant].flatMap((g) => g.items).filter((i) => i.kind === 'debuff' && i.on))

// 记录「历史同时生效最多项数」（纯统计口径，供成就 / 统计页；不产生任何数值加成）
watchEffect(() => player.noteEffectsSeen(data.value.stats.on))

const KIND_TAG = { buff: '增益', debuff: '减益', rule: '规则' }

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
  if (view.startsWith('skill:')) return '去对应技能'
  return '去该页'
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🧿 效果总览</h2>
        <p class="dim">
          把此刻<b>正在生效的增益、效果与减益</b>汇成一页：天气与运势、节庆与限时窗口、喝下的增益剂、
          各系统的被动（食灵 / 公会 / 图谱 / 信仰 / 荣誉 / 厨神之路 / 山海食经）、农田与产线的运转状态，
          以及只在对决里存在的临时状态。<b>本页只做汇总与跳转</b>，不会替你执行任何操作，也不改动任何数据。
        </p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">{{ data.stats.on }} / {{ data.stats.total }} 项</div>
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
        <StatusChip label="本期未生效">{{ data.stats.off }} 项（含原因，见下方折叠区）</StatusChip>
        <StatusChip label="来源登记总数">{{ data.stats.total }} 条（全项目效果清单）</StatusChip>
      </div>
    </StatusChips>

    <!-- 减益优先：被扣的东西放最上面 -->
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

    <!-- 按赛道分组 -->
    <section v-for="g in data.groups" :key="g.id" class="card fx-group">
      <h3>{{ g.icon }} {{ g.name }}<span class="dim fx-count">{{ g.items.filter((i) => i.on).length }} 项生效</span></h3>
      <p class="dim fx-desc">{{ g.desc }}</p>
      <div class="fx-list">
        <div v-for="i in g.items.filter((x) => x.on)" :key="i.id" class="fx-row" :class="{ 'fx-row-bad': i.kind === 'debuff', 'fx-row-rule': i.kind === 'rule' }">
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
    </section>

    <FoldCard
      :title="`🗂 本期未生效的效果来源（${data.stats.off} 项）`"
      :hint="`这 ${data.stats.off} 项此刻没有起作用，每一行都写明了原因——列出它们是为了证明「没有漏掉任何一项」`"
    >
      <div v-for="g in data.dormant" :key="g.id" class="fx-dormant-group">
        <div class="dim fx-dormant-head">{{ g.icon }} {{ g.name }}</div>
        <div class="fx-row fx-row-off" v-for="i in g.items" :key="i.id">
          <span class="fx-icon">{{ i.icon }}</span>
          <span class="fx-body">
            <span class="fx-name">{{ i.name }}<span class="fx-tag fx-tag-off">{{ KIND_TAG[i.kind] }}</span><span class="fx-src dim">· {{ i.src }}</span></span>
            <span class="dim fx-text">{{ i.why || '当前条件未满足' }}</span>
          </span>
          <button v-if="i.view" class="btn btn-sm" @click="open(i)">{{ jumpLabel(i.view) }} ↗</button>
        </div>
      </div>
    </FoldCard>

    <p class="dim fx-note">
      口径说明：①「增益 / 减益」按<b>此刻是否真的在起作用</b>判定（例如增益剂要没过期、天气要有非中性的倍率、
      奥义要激活且品鉴点没耗尽）；②「规则」类是不随状态开关的规律性加成（餐厅等级、当季作物、转生加成等）；
      ③ 对决内的临时状态（酱料 / 醉酒 / 灼烧 / 中毒 / 面之束缚等）只在战斗进行中存在，战斗结束即清空；
      ④ 本页的每一行都登记在 <b>效果注册表</b>（<code>src/game/data/activeEffects.js</code>）里，
      新增任何效果来源都必须在那里加一行，否则内容同步审计会失败——所以这张清单不会悄悄少项。
    </p>

    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.fx-alert {
  margin-top: 12px;
  border-color: var(--bad-soft);
  background: var(--bad-soft);
}
.fx-group {
  margin-top: 12px;
}
.fx-count {
  font-size: 12px;
  font-weight: 400;
  margin-left: 8px;
}
.fx-desc {
  font-size: 12px;
  margin: 2px 0 8px;
}
.fx-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
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
.fx-row-bad {
  border-style: solid;
  border-color: var(--bad-soft);
}
.fx-row-rule {
  opacity: 0.9;
}
.fx-row-off {
  opacity: 0.72;
  border-style: dotted;
}
.fx-icon {
  font-size: 16px;
  text-align: center;
}
.fx-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.fx-name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.fx-tag {
  font-size: 11px;
  font-weight: 400;
  padding: 0 6px;
  border-radius: 6px;
  background: rgba(var(--panel-soft-rgb), 0.72);
  border: 1px solid var(--border);
  color: var(--muted);
}
.fx-tag-buff {
  color: var(--good-strong);
  border-color: var(--good-soft);
  background: var(--good-soft);
}
.fx-tag-debuff {
  color: var(--bad-strong);
  border-color: var(--bad-soft);
  background: var(--bad-soft);
}
.fx-tag-off {
  color: var(--muted);
}
.fx-src {
  font-size: 11px;
  font-weight: 400;
}
.fx-text {
  font-size: 12px;
  line-height: 1.6;
}
.fx-left {
  font-size: 12px;
  text-align: right;
}
.fx-dormant-group {
  margin-bottom: 12px;
}
.fx-dormant-head {
  font-size: 12px;
  margin: 6px 0 4px;
}
.fx-note {
  font-size: 12px;
  line-height: 1.8;
  margin-top: 12px;
}
.fx-note code {
  font-size: 11px;
}
@media (max-width: 720px) {
  .fx-row {
    grid-template-columns: 22px minmax(0, 1fr) 100px;
  }
  .fx-left {
    display: none;
  }
}
</style>
