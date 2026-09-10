<script setup>
// 食灵物语（2026-09-10 新增）— 出战食灵按羁绊等级解锁心声片段，每段可领一次性奖励。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { SPIRITS, getSpirit } from '../game/data/spiritTiers.js'
import { SPIRIT_STORY_STAGES, STAGE_INFO, storyLine, domainOf } from '../game/data/spiritStories.js'
import { getItem } from '../game/data/items.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()

const onlyUnclaimed = ref(false)
const onlyActive = ref(false)

/** 已拥有的食灵（食灵阁），按羁绊等级降序 */
const owned = computed(() =>
  Object.keys(player.spirits?.owned ?? {})
    .map((id) => {
      const def = getSpirit(id)
      const bond = player.bondProgressFor(id)
      return { id, def, bond, domain: domainOf(def?.name) }
    })
    .filter((r) => r.def)
    .sort((a, b) => b.bond.level - a.bond.level || (b.bond.days ?? 0) - (a.bond.days ?? 0))
)

const list = computed(() => {
  let arr = owned.value
  if (onlyActive.value) arr = arr.filter((r) => (player.spirits?.active ?? []).includes(r.id))
  if (onlyUnclaimed.value) {
    arr = arr.filter((r) =>
      SPIRIT_STORY_STAGES.some((s) => s <= player.spiritStoryStage(r.id) && !player.spiritStoryClaimed(r.id, s))
    )
  }
  return arr
})

const summary = computed(() => ({
  owned: owned.value.length,
  total: SPIRITS.length,
  unlocked: owned.value.reduce((a, r) => a + SPIRIT_STORY_STAGES.filter((s) => s <= player.spiritStoryStage(r.id)).length, 0),
  claimed: player.stats?.spiritStoryClaims ?? 0,
  pending: player.spiritStoryPending(),
}))

function rewardText(stage) {
  const r = STAGE_INFO[stage]?.reward ?? {}
  const parts = []
  if (r.gold) parts.push(`${r.gold.toLocaleString()} 金币`)
  for (const [id, q] of Object.entries(r.items ?? {})) parts.push(`${getItem(id)?.name ?? id} ×${q}`)
  return parts.join(' + ')
}
function claim(r, stage) {
  const res = player.spiritStoryClaim(r.id, stage)
  if (!res.ok) ui.pushLog(res.msg, 'warn')
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'patrons', label: '🏛 信仰' }, { view: 'codexExchange', label: '📖 图鉴兑换' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>✨ 食灵物语</h2>
        <p class="dim">
          出战食灵按<b>羁绊等级</b>解锁心声片段（Lv2 初见 / Lv3 同行 / Lv4 羁绊 / Lv5 契约），
          每段可领一次性奖励。羁绊靠出战时长累积：2 / 6 / 12 / 20 / 30 天各升 1 级。
        </p>
      </div>
    </header>

    <div class="card status-line">
      <span class="badge badge-on">食灵阁 {{ summary.owned }} / {{ summary.total }}</span>
      <span class="dim">已解锁片段 <b class="mono">{{ summary.unlocked }}</b> · 已领取 <b class="mono">{{ summary.claimed }}</b></span>
      <span v-if="summary.pending" class="badge">🎁 待领取 {{ summary.pending }}</span>
    </div>

    <div class="region-tabs" style="flex-wrap: wrap">
      <button class="btn btn-sm" :class="{ 'btn-primary': onlyUnclaimed }" @click="onlyUnclaimed = !onlyUnclaimed">只看可领取</button>
      <button class="btn btn-sm" :class="{ 'btn-primary': onlyActive }" @click="onlyActive = !onlyActive">只看出战</button>
    </div>

    <p v-if="!list.length" class="dim" style="margin-top: 12px">
      暂无食灵——先到「食灵召唤」缔结契约；出战食灵会随时间累积羁绊。
    </p>

    <div class="story-grid">
      <div v-for="r in list" :key="r.id" class="card story-card">
        <div class="story-head">
          <strong>{{ r.def.name }}</strong>
          <span class="dim mono" style="font-size: 12px">{{ r.domain }} · 羁绊 Lv{{ r.bond.level }}</span>
        </div>
        <ProgressBar :progress="r.bond.level >= 5 ? 1 : Math.min(1, r.bond.days / (r.bond.nextDays || 1))" />
        <div class="dim story-sub mono">
          <template v-if="r.bond.nextDays">出战 {{ Math.floor(r.bond.days) }} 天 · 还差 {{ (r.bond.nextDays - r.bond.days).toFixed(1) }} 天升级</template>
          <template v-else>羁绊已满级</template>
        </div>

        <div v-for="s in SPIRIT_STORY_STAGES" :key="s" class="story-line" :class="{ locked: player.spiritStoryStage(r.id) < s }">
          <div class="story-line-head">
            <span class="dim">{{ STAGE_INFO[s].name }}（羁绊 Lv{{ s }}）</span>
            <button
              v-if="player.spiritStoryStage(r.id) >= s && !player.spiritStoryClaimed(r.id, s)"
              class="btn btn-sm btn-primary"
              @click="claim(r, s)"
            >领取</button>
            <span v-else-if="player.spiritStoryClaimed(r.id, s)" class="dim" style="font-size: 12px">已领取</span>
          </div>
          <p class="story-text">
            {{ player.spiritStoryStage(r.id) >= s ? storyLine(r.def, s) : '🔒 羁绊达标后解锁…' }}
          </p>
          <div v-if="player.spiritStoryStage(r.id) >= s && !player.spiritStoryClaimed(r.id, s)" class="dim story-sub">
            奖励：{{ rewardText(s) }}
          </div>
        </div>
      </div>
    </div>
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.story-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.story-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.story-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.story-sub {
  font-size: 12px;
  line-height: 1.5;
}
.story-line {
  border-top: 1px dashed var(--border);
  padding-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.story-line.locked {
  opacity: 0.65;
}
.story-line-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}
.story-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text);
}
</style>
