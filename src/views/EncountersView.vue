<script setup>
// 奇遇图鉴（2026-09-11 新增）— 挂机途中随机触发的 8 个「3 选 1（个别 2 选 1）」小事件。
//
// 为什么需要它：奇遇此前**完全不留痕**——挂机时 0.2% 概率弹出、选完即消失，
// 玩家既看不到全貌，也回看不到自己遇过哪些、选过哪支。本页把它变成可回看的图鉴
// （与「信箱」那轮修「离线明细无处回查」是同一类问题）。
//
// 纯记录层：只在触发/选择时累加计数（存档 `player.encounters`），
// **不改变触发概率、不改变任何奖励数值**（奖励仍由 EncounterModal 原路径发放）。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { ENCOUNTERS } from '../game/data/encounters.js'
import { getItem } from '../game/data/items.js'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()

const RELATED = [
  { view: 'today', label: '📌 今日待办' },
  { view: 'stats', label: '📊 统计' },
  { view: 'chronicle', label: '📜 年鉴' },
  { view: 'logs', label: '🗂 系统日志' },
]

/** 挂机动作的触发概率（与 bootstrap 里一致：0.2%，10 秒防抖） */
const TRIGGER_PCT = 0.2

const rows = computed(() =>
  ENCOUNTERS.map((e) => {
    const st = player.encounterStats(e.id)
    return {
      ...e,
      seen: st.seen,
      picks: st.picks,
      pickTotal: st.picks.reduce((a, n) => a + (n ?? 0), 0),
      options: e.choices.length,
    }
  })
)
const seenCount = computed(() => rows.value.filter((r) => r.seen > 0).length)
const totalTriggers = computed(() => player.encounters?.total ?? 0)

/** 金币奖励按对决等级放大（与 EncounterModal 同一公式：×（1 + 等级×20%）） */
function goldOf(effect) {
  if (!effect?.gold) return null
  return Math.floor(effect.gold * (1 + player.combatLevel * 0.2))
}
function rewardText(effect) {
  const parts = []
  const g = goldOf(effect)
  if (g != null) parts.push(`${g.toLocaleString()} 金币`)
  for (const [id, qty] of Object.entries(effect?.items ?? {})) parts.push(`${getItem(id)?.name ?? id} ×${qty}`)
  return parts.join(' · ') || '无奖励'
}
function pickText(r, i) {
  const n = r.picks[i] ?? 0
  return n > 0 ? `选过 ${n} 次` : '还没选过'
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>❓ 奇遇图鉴</h2>
        <p class="dim">
          挂机途中每次采集/制作动作有 <b>{{ TRIGGER_PCT }}%</b> 概率触发一个随机奇遇（10 秒防抖，一次只弹一个），
          弹出后从若干分支里选一支、当场结算奖励。本页把遇到过的奇遇与你的选择<b>记档回看</b>——
          <b>不改触发概率，也不改任何奖励数值</b>。
        </p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">{{ seenCount }}/{{ rows.length }} 已遇到</div>
        <p class="dim mono">累计触发 {{ totalTriggers }} 次</p>
      </div>
    </header>

    <!-- 概览 -->
    <div class="card ec-hero">
      <div class="ec-stat"><span class="dim">奇遇图鉴</span><b class="mono">{{ seenCount }}/{{ rows.length }}</b></div>
      <div class="ec-stat"><span class="dim">累计触发</span><b class="mono">{{ totalTriggers }}</b></div>
      <div class="ec-stat"><span class="dim">触发概率</span><b class="mono">{{ TRIGGER_PCT }}%/动作</b></div>
      <div class="ec-stat"><span class="dim">奖励放大</span><b class="mono">×{{ (1 + player.combatLevel * 0.2).toFixed(1) }}</b></div>
    </div>

    <!-- 图鉴列表 -->
    <div class="card ec-card">
      <div class="ec-list">
        <div v-for="r in rows" :key="r.id" class="ec-item" :class="{ locked: r.seen === 0 }">
          <div class="ec-head">
            <strong class="ec-title">{{ r.seen > 0 ? r.title : '❓ 未知奇遇' }}</strong>
            <span v-if="r.seen > 0" class="badge badge-on">遇过 {{ r.seen }} 次</span>
            <span v-else class="badge">还没遇到过</span>
            <span class="dim ec-opts">{{ r.options }} 个分支</span>
          </div>

          <template v-if="r.seen > 0">
            <p class="dim ec-body">{{ r.body }}</p>
            <div class="ec-choices">
              <div v-for="(c, i) in r.choices" :key="i" class="ec-choice">
                <span class="ec-choice-label">{{ c.label }}</span>
                <span class="dim ec-choice-reward">{{ rewardText(c.effect) }}</span>
                <span class="mono dim ec-choice-pick">{{ pickText(r, i) }}</span>
              </div>
            </div>
            <p class="dim ec-note">奖励在弹出时按当时对决等级即时结算；此处显示的是<b>按当前等级换算</b>的数值。</p>
          </template>
          <p v-else class="dim ec-body">
            还没遇到过。继续挂机采集或制作（每次动作 {{ TRIGGER_PCT }}% 概率），遇到过就会在这里显示完整内容与你的选择记录。
          </p>
        </div>
      </div>
    </div>

    <!-- 说明 -->
    <div class="card ec-card">
      <div class="ec-h">📖 说明</div>
      <ul class="ec-rules">
        <li><b>触发</b>：在线采集/制作动作 <b>{{ TRIGGER_PCT }}%</b> 概率，10 秒内不重复弹出（防抖）；一次只弹一个。</li>
        <li><b>奖励</b>：金币按 <b>×（1 + 对决等级 × 20%）</b> 放大（与弹窗内结算同一公式），物品为固定数量，当场入包。</li>
        <li><b>记录</b>：本页只记录「遇到过几次 / 每支选过几次」，用于回看与收集；<b>不影响触发概率与奖励</b>。</li>
        <li><b>年鉴</b>：首次遇到某个奇遇会在「厨师年鉴」里留一条记录（分类：奇遇）。</li>
      </ul>
    </div>

    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.ec-hero {
  margin-top: 12px;
  padding: 12px 16px;
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
}
.ec-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.ec-stat b {
  font-size: 16px;
}
.ec-card {
  margin-top: 12px;
}
.ec-h {
  font-weight: 600;
}
.ec-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ec-item {
  padding: 9px 11px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.ec-item.locked {
  opacity: 0.72;
}
.ec-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ec-title {
  font-size: 14px;
}
.ec-opts {
  font-size: 12px;
  margin-left: auto;
}
.ec-body {
  font-size: 12px;
  line-height: 1.7;
  margin: 6px 0 0;
  white-space: pre-wrap;
}
.ec-choices {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 7px;
}
.ec-choice {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) 84px;
  gap: 8px;
  align-items: baseline;
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 5px;
  background: rgba(217, 90, 56, 0.06);
  border: 1px dashed var(--border);
}
.ec-choice-label {
  font-weight: 600;
}
.ec-choice-pick {
  text-align: right;
  font-size: 11px;
}
.ec-note {
  font-size: 11px;
  margin-top: 6px;
}
.ec-rules {
  margin: 8px 0 0;
  padding-left: 20px;
  font-size: 12px;
  line-height: 1.85;
}
@media (max-width: 720px) {
  .ec-choice {
    grid-template-columns: minmax(0, 1fr) 84px;
  }
  .ec-choice-reward {
    grid-column: 1 / -1;
  }
}
</style>
