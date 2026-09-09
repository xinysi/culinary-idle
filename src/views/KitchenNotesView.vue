<script setup>
// 厨房笔记（2026-09-10 新增）— 菜谱专精面板：把「制作类技能每张配方独立的精通等级」显式化。
// 数据来源：ProductionSkill.masteryLevel/masteryProgress（player.skills[id].mastery[recipeId]），
// 纯只读展示，不改动任何配方/物品/等级数据。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getAllSkillInstances } from '../game/skills/registry.js'
import { getSkillDef } from '../game/data/skills.js'
import { getItem } from '../game/data/items.js'
import { masteryDoubleChance, masteryXpMultiplier, masteryYieldBonus } from '../game/core/mastery.js'
import ProgressBar from '../components/ProgressBar.vue'
import Pagination from '../components/Pagination.vue'

const player = usePlayerStore()
const ui = useUiStore()

// 制作类技能（含保鲜/食灵召唤——它们的配方同样累计精通）
const PROD_SKILLS = ['cooking', 'baking', 'preserving', 'brewing', 'spiceMixing', 'craftsmithing', 'preservation', 'spiritSummoning']
const PAGE_SIZE = 24

const skillFilter = ref('all') // all | 技能 id
const onlyUnfinished = ref(false) // 只看未满级
const sortBy = ref('mastery') // mastery(精通高→低) | level(配方等级高→低) | progress(进度高→低)
const page = ref(1)

/** 全部配方行（含精通进度与档位效果） */
const rows = computed(() => {
  const out = []
  for (const id of PROD_SKILLS) {
    const inst = getAllSkillInstances().find((s) => s.id === id)
    if (!inst) continue
    const def = getSkillDef(id)
    for (const r of inst.recipes ?? []) {
      const count = inst.masteryCount?.(r) ?? 0
      const prog = inst.masteryProgress?.(r) ?? { level: 0, current: 0, needed: 0, progress: 0 }
      out.push({
        skillId: id,
        skillName: def?.name ?? id,
        recipeId: r.id,
        name: r.name ?? getItem(r.output?.itemId)?.name ?? r.id,
        reqLevel: r.reqLevel,
        outName: getItem(r.output?.itemId)?.name ?? r.output?.itemId ?? '',
        count,
        level: prog.level,
        current: prog.current,
        needed: prog.needed,
        progress: prog.progress,
        xpMult: masteryXpMultiplier(prog.level),
        dbl: masteryDoubleChance(prog.level),
        batch: masteryYieldBonus(prog.level),
        unlocked: (player.skills[id]?.level ?? 1) >= r.reqLevel,
      })
    }
  }
  return out
})

const filtered = computed(() => {
  let list = rows.value
  if (skillFilter.value !== 'all') list = list.filter((r) => r.skillId === skillFilter.value)
  if (onlyUnfinished.value) list = list.filter((r) => r.level < 100)
  const s = sortBy.value
  return [...list].sort((a, b) => {
    if (s === 'level') return b.reqLevel - a.reqLevel || b.level - a.level
    if (s === 'progress') return b.progress - a.progress || b.level - a.level
    return b.level - a.level || b.count - a.count || b.reqLevel - a.reqLevel
  })
})

const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() => {
  const p = Math.min(page.value, pages.value)
  const arr = filtered.value.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE)
  while (arr.length < PAGE_SIZE) arr.push({ _pad: true })
  return arr
})
function setFilter(v) {
  skillFilter.value = v
  page.value = 1
}

/** 总览：满级配方 / 精通≥50 / 累计制作次数 */
const summary = computed(() => {
  const list = rows.value
  return {
    total: list.length,
    maxed: list.filter((r) => r.level >= 100).length,
    half: list.filter((r) => r.level >= 50).length,
    actions: list.reduce((a, r) => a + r.count, 0),
  }
})

const skillTabs = computed(() => PROD_SKILLS.map((id) => ({ id, name: getSkillDef(id)?.name ?? id })))
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📓 厨房笔记</h2>
        <p class="dim">
          每张配方都有<b>独立精通</b>（0~100 级，按累计制作次数成长）——等级越高，该配方经验倍率、双倍产出与保底产量越强。
          共 {{ summary.total }} 张配方，累计制作 <b class="mono">{{ summary.actions.toLocaleString() }}</b> 次。
        </p>
      </div>
    </header>

    <div class="card status-line">
      <span class="badge badge-on">满级配方 {{ summary.maxed }}</span>
      <span class="badge">精通 ≥50 级 {{ summary.half }}</span>
      <span class="dim">档位效果：5 级起经验 ×1.1；50 级保底产量 +1；100 级 双倍 80%、保底 +2</span>
    </div>

    <div class="region-tabs" style="flex-wrap: wrap">
      <button class="btn btn-sm" :class="{ 'btn-primary': skillFilter === 'all' }" @click="setFilter('all')">全部</button>
      <button
        v-for="t in skillTabs"
        :key="t.id"
        class="btn btn-sm"
        :class="{ 'btn-primary': skillFilter === t.id }"
        @click="setFilter(t.id)"
      >{{ t.name }}</button>
    </div>

    <div class="region-tabs" style="flex-wrap: wrap; margin-top: 6px">
      <button class="btn btn-sm" :class="{ 'btn-primary': sortBy === 'mastery' }" @click="sortBy = 'mastery'; page = 1">精通高→低</button>
      <button class="btn btn-sm" :class="{ 'btn-primary': sortBy === 'progress' }" @click="sortBy = 'progress'; page = 1">进度高→低</button>
      <button class="btn btn-sm" :class="{ 'btn-primary': sortBy === 'level' }" @click="sortBy = 'level'; page = 1">配方等级高→低</button>
      <button class="btn btn-sm" :class="{ 'btn-primary': onlyUnfinished }" @click="onlyUnfinished = !onlyUnfinished; page = 1">
        {{ onlyUnfinished ? '✓ 只看未满级' : '只看未满级' }}
      </button>
    </div>

    <div class="note-grid">
      <template v-for="(r, i) in paged" :key="r.recipeId ?? 'pad-' + i">
        <div v-if="!r._pad" class="card note-card" :class="{ locked: !r.unlocked }">
          <div class="note-head">
            <strong>{{ r.name }}</strong>
            <span class="dim mono" style="font-size: 11px">{{ r.skillName }} · Lv{{ r.reqLevel }}</span>
          </div>
          <div class="note-row">
            <span class="dim">精通</span>
            <span class="mono" :class="{ 'mastery-hl': r.level >= 50 }">Lv{{ r.level }} / 100</span>
          </div>
          <ProgressBar :progress="r.progress" />
          <div class="dim note-sub mono">
            <template v-if="r.level >= 100">已满级 · 累计 {{ r.count.toLocaleString() }} 次</template>
            <template v-else>{{ r.current }} / {{ r.needed }} 次 · 累计 {{ r.count.toLocaleString() }}</template>
          </div>
          <div class="dim note-sub">
            经验 ×{{ r.xpMult }}<template v-if="r.dbl > 0"> · 双倍 {{ Math.round(r.dbl * 100) }}%</template><template v-if="r.batch > 0"> · 保底 +{{ r.batch }}</template>
          </div>
          <div v-if="!r.unlocked" class="dim note-sub">🔒 需技能 Lv{{ r.reqLevel }}</div>
        </div>
      </template>
    </div>

    <Pagination v-if="pages > 1" :current="Math.min(page, pages)" :pages="pages" @update:current="(p) => (page = p)" />
  </div>
</template>

<style scoped>
.note-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.note-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.note-card.locked {
  opacity: 0.6;
}
.note-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.note-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}
.note-sub {
  font-size: 11px;
  line-height: 1.5;
}
</style>
