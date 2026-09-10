<script setup>
// 常客名录（2026-09-10 新增）— 餐厅熟客：每天招待 1 次偏好料理，好感等级换长期小费加成。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { REGULARS, REGULAR_LEVEL_REQ, regularProgress, regularLevelFromServes, REGULAR_MAX_GIFT } from '../game/data/regulars.js'
import { getItem, itemName } from '../game/data/items.js'
import ProgressBar from '../components/ProgressBar.vue'
import ItemImg from '../components/ItemImg.vue'

const player = usePlayerStore()
const ui = useUiStore()

const pick = ref({}) // { [regularId]: itemId }

function d(id) {
  if (!pick.value[id]) pick.value[id] = ''
  return pick.value[id]
}

/** 背包中符合某常客偏好的料理（类别 + tier 达标） */
function candidates(def) {
  return Object.keys(player.inventory ?? {})
    .filter((id) => {
      const it = getItem(id)
      return it?.type === 'food' && it.category === def.category && (it.tier ?? 0) >= def.minTier && (player.inventory[id] ?? 0) > 0
    })
    .map((id) => ({ id, it: getItem(id), qty: player.inventory[id] }))
    .sort((a, b) => (b.it?.tier ?? 0) - (a.it?.tier ?? 0) || (b.it?.value ?? 0) - (a.it?.value ?? 0))
}

const rows = computed(() =>
  REGULARS.map((def) => {
    const st = player.regularState(def.id)
    const prog = regularProgress(st?.serves ?? 0)
    return {
      def,
      serves: st?.serves ?? 0,
      level: prog.level,
      progress: prog.progress,
      current: prog.current,
      needed: prog.needed,
      unlocked: player.regularUnlocked(def.id),
      servedToday: player.regularServedToday(def.id),
      giftClaimed: !!st?.giftClaimed,
      maxed: prog.level >= REGULAR_LEVEL_REQ.length - 1,
      cands: player.regularUnlocked(def.id) ? candidates(def) : [],
    }
  })
)

const unlockedCount = computed(() => rows.value.filter((r) => r.unlocked).length)
const totalLevels = computed(() => rows.value.reduce((a, r) => a + r.level, 0))
const tipPct = computed(() => player.regularTipPct())

function serve(r) {
  const itemId = d(r.def.id)
  if (!itemId) {
    ui.pushLog(`请先选一道${r.def.category}（tier ≥ ${r.def.minTier}）`, 'warn')
    return
  }
  const res = player.regularServe(r.def.id, itemId)
  if (!res.ok) ui.pushLog(res.msg, 'warn')
  else pick.value[r.def.id] = ''
}
function claimGift(r) {
  const res = player.regularClaimGift(r.def.id)
  if (!res.ok) ui.pushLog(res.msg, 'warn')
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'restaurant', label: '🏮 餐厅' }, { view: 'michelin', label: '⭐ 评级' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📖 常客名录</h2>
        <p class="dim">
          八位常客各有偏好，<b>每天可招待 1 次</b>——消耗 1 件符合偏好（类别 + tier）的料理，换金币与好感；
          好感每级 <b>小费 +2%</b>，满 5 级可领专属谢礼。
        </p>
      </div>
    </header>

    <div class="card status-line">
      <span class="badge badge-on">已解锁 {{ unlockedCount }} / {{ REGULARS.length }}</span>
      <span class="dim">好感总等级 <b class="mono">{{ totalLevels }}</b> · 餐厅小费加成 <b class="mono">+{{ tipPct }}%</b></span>
    </div>

    <div class="regular-grid">
      <div v-for="r in rows" :key="r.def.id" class="card regular-card" :class="{ locked: !r.unlocked }">
        <div class="regular-head">
          <span class="regular-icon">{{ r.def.icon }}</span>
          <div>
            <strong>{{ r.def.name }}</strong>
            <div class="dim regular-sub">偏好：{{ r.def.category }}（tier ≥ {{ r.def.minTier }}）· 招待 +{{ r.def.gold }} 金币</div>
          </div>
        </div>

        <template v-if="!r.unlocked">
          <div class="dim regular-sub">🔒 需餐厅 Lv{{ r.def.unlockLevel }} 解锁</div>
        </template>

        <template v-else>
          <div class="regular-row">
            <span class="dim">好感</span>
            <span class="mono" :class="{ 'mastery-hl': r.level >= 5 }">Lv{{ r.level }} / 5</span>
          </div>
          <ProgressBar :progress="r.progress" />
          <div class="dim regular-sub mono">
            <template v-if="r.maxed">已满好感 · 累计招待 {{ r.serves }} 次</template>
            <template v-else>{{ r.current }} / {{ r.needed }} 次 · 累计 {{ r.serves }}</template>
          </div>

          <div class="regular-actions">
            <select v-model="pick[r.def.id]" class="regular-select" :disabled="r.servedToday">
              <option value="">{{ r.cands.length ? `选择${r.def.category}…` : '背包无符合料理' }}</option>
              <option v-for="c in r.cands" :key="c.id" :value="c.id">{{ c.it?.name }}（tier {{ c.it?.tier }} · 存 {{ c.qty }}）</option>
            </select>
            <button class="btn btn-sm btn-primary" :disabled="r.servedToday || !r.cands.length" @click="serve(r)">
              {{ r.servedToday ? '今日已招待' : '招待' }}
            </button>
          </div>

          <button
            v-if="r.maxed && !r.giftClaimed"
            class="btn btn-sm"
            @click="claimGift(r)"
          >🎁 领取满好感谢礼（{{ itemName(REGULAR_MAX_GIFT.itemId) }} ×{{ REGULAR_MAX_GIFT.qty }}）</button>
          <div v-else-if="r.maxed" class="dim regular-sub">🎁 谢礼已领取</div>
        </template>
      </div>
    </div>
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.regular-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.regular-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.regular-card.locked {
  opacity: 0.6;
}
.regular-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.regular-icon {
  font-size: 24px;
}
.regular-sub {
  font-size: 12px;
  line-height: 1.5;
}
.regular-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}
.regular-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.regular-select {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
}
</style>
