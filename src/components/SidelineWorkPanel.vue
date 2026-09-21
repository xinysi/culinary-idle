<script setup>
// 副业面板（v2.10.0 作品 / v2.11.0 量产阶梯）——挂在**副业技能页下方**（ProductionView 末尾）。
//
// 两层结构（分工刻意分开）：
//   ① 作品（每件一次、加成大）—— 收集向，10 件。木工**没有这一层**：它的产物直接变成「手工装潢」
//      （走 restaurant.decor），在餐厅装潢页操作，所以木工只显示阶梯。
//   ② 量产阶梯（吃任意产物、按档位计点、加成小但深）—— 量产向，12 档。
//      存在的原因：练到 100 级要 ≈263 万次制作，产物是几十万件，而作品只吃得下 10 件
//      （任何「把具体物件用掉」的设计在这个量级下都等于没设计）。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import {
  SIDELINE_AXES, SIDELINE_SKILL_LIST, SIDELINE_PRODUCTS, SIDELINE_LADDERS,
  LADDER_TIERS, LADDER_AXIS_LABEL,
} from '../game/data/sidelineWorks.js'
import { getItem } from '../game/data/items.js'
import { CRAFTED_DECOR, WOODWORK_ITEMS_DEF } from '../game/data/woodworking.js'
import ItemImg from './ItemImg.vue'

const props = defineProps({
  instance: { type: Object, required: true },
})

const player = usePlayerStore()
const ui = useUiStore()

/** 本技能的作品定义（木工不在本表：它的产物直接变成「手工装潢」，见下面的 isWoodworking 分支） */
const def = computed(() => SIDELINE_SKILL_LIST.find((s) => s.id === props.instance.id) ?? null)
const axis = computed(() => (def.value ? SIDELINE_AXES[def.value.axis] : null))
/** 本技能的阶梯定义（木工也在内） */
const ladder = computed(() => SIDELINE_LADDERS.find((l) => l.skill === props.instance.id) ?? null)
/** 木工：产物 → 「手工装潢」（走 restaurant.decor），动作与另外四支不同（craftDecor 而非 craftWork） */
const isWoodworking = computed(() => props.instance.id === 'woodworking')

/** 作品行的统一形态；木工=手工装潢、其余=各自的轴 */
const rows = computed(() => {
  if (isWoodworking.value) {
    const owned = new Set(player.restaurant?.decor ?? [])
    return CRAFTED_DECOR.map((d) => {
      const itemId = d.craftedFrom.itemId
      const it = getItem(itemId)
      const lv = WOODWORK_ITEMS_DEF.find((x) => x.id === itemId)?.level ?? 1
      return {
        itemId,
        decorId: d.id,
        name: it?.name ?? itemId,
        level: lv,
        amount: d.effect,
        owned: owned.has(d.id),
        have: player.inventory[itemId] ?? 0,
      }
    }).sort((a, b) => a.level - b.level)
  }
  if (!def.value) return []
  const owned = new Set(player.sidelineWorks ?? [])
  return (props.instance.recipes ?? []).map((r) => {
    const itemId = r.output.itemId
    const it = getItem(itemId)
    return {
      itemId,
      name: it?.name ?? r.name,
      level: r.reqLevel,
      amount: axis.value.perItem,
      owned: owned.has(itemId),
      have: player.inventory[itemId] ?? 0,
    }
  }).sort((a, b) => a.level - b.level)
})

/** 作品层的文案（木工是「餐厅收入」，其余取轴定义） */
const workTitle = computed(() => (isWoodworking.value ? '木工作品' : `${def.value?.name}作品`))
const workIcon = computed(() => (isWoodworking.value ? '🪚' : (def.value?.icon ?? '•')))
const workAxisLabel = computed(() => (isWoodworking.value ? '餐厅收入' : axis.value.label))
const amountText = (v) => (isWoodworking.value ? `+${v}%` : axis.value.amountLabel(v))
const workNote = computed(() => (isWoodworking.value
  ? '木材做成木器、木器做成手工装潢——两处都能做（这里就地做，或去「餐厅装潢 → 🪚 手工装潢」），不花金币'
  : def.value.materialNote))

const ownedCount = computed(() => rows.value.filter((r) => r.owned).length)
const workOnlyTotal = computed(() => rows.value.filter((r) => r.owned).reduce((a, r) => a + r.amount, 0))
const workMaxTotal = computed(() => rows.value.reduce((a, r) => a + r.amount, 0))

// ── 量产阶梯 ──
const ladderPoints = computed(() => (ladder.value ? player.sidelinePointsOf(ladder.value.skill) : 0))
const ladderTier = computed(() => (ladder.value ? player.sidelineLadderTier(ladder.value.skill) : 0))
const ladderNext = computed(() => (ladder.value ? player.sidelineLadderNext(ladder.value.skill) : null))
const ladderTotal = computed(() => (ladder.value ? player.sidelineLadderTotal(ladder.value.axis) : 0))
const ladderLabel = computed(() => (ladder.value ? LADDER_AXIS_LABEL[ladder.value.axis] : ''))
/** 背包里该支可投入的产物（含每件值多少点） */
const feedRows = computed(() => (ladder.value ? (SIDELINE_PRODUCTS[ladder.value.skill] ?? []).map((p) => ({
  ...p,
  have: player.inventory[p.itemId] ?? 0,
})).filter((x) => x.have > 0) : []))
const feedPts = computed(() => feedRows.value.reduce((a, x) => a + x.have * x.points, 0))
const feedQty = computed(() => feedRows.value.reduce((a, x) => a + x.have, 0))

function craft(row) {
  const res = isWoodworking.value ? player.craftDecor(row.decorId) : player.craftWork(row.itemId)
  if (res === 'denied') ui.pushLog(`背包里没有「${row.name}」——先去上面做一件`, 'warn')
  else if (res === 'bad') ui.pushLog('这个产物不是副业作品', 'warn')
  else if (res === 'owned') ui.pushLog(`「${row.name}」已经做成过了`, 'warn')
}
function feed() {
  const r = player.feedSideline(ladder.value.skill)
  if (!r.ok) {
    ui.pushLog(r.reason === 'empty' ? '背包里没有可投入的产物' : '无法投入', 'warn')
    return
  }
  ui.pushLog(`🏭 ${ladder.value.name}量产阶梯：投入 ${r.fed} 件 → +${r.points} 点${r.tierUp ? `，晋升 ${r.tier} 档！` : ''}`, 'gain')
}
</script>

<template>
  <div v-if="def || ladder" class="card sw-card">
    <!-- ① 作品（木工也有：它的产物 → 手工装潢，动作是 craftDecor） -->
    <template v-if="rows.length">
      <div class="sw-head">
        <span class="sw-h">{{ workIcon }} {{ workTitle }}</span>
        <span class="dim">做成后给 <b>{{ workAxisLabel }}</b> 永久加成（每件 {{ amountText(rows[0]?.amount ?? 0) }} 起）</span>
      </div>
      <p class="dim sw-note">
        <!-- materialNote 里带 <b> 强调标记 ⇒ 这一段单独 v-html（其余是普通插值，别一起塞进去） -->
        <span v-html="workNote"></span> · 已完成 <b>{{ ownedCount }}/{{ rows.length }}</b> 件，
        作品合计 <b>{{ amountText(workOnlyTotal) }}</b>（满级 {{ amountText(workMaxTotal) }}）。
      </p>
      <div class="sw-grid">
        <div
          v-for="r in rows"
          :key="r.itemId"
          class="sw-item"
          :class="{ 'sw-done': r.owned, 'sw-can': !r.owned && r.have > 0 }"
        >
          <ItemImg :item-id="r.itemId" />
          <div class="sw-body">
            <div class="sw-name">{{ r.name }} <span class="dim mono">Lv{{ r.level }}</span></div>
            <div class="dim sw-eff">{{ workAxisLabel }} {{ amountText(r.amount) }}</div>
            <button
              v-if="!r.owned"
              class="btn btn-sm"
              :class="r.have > 0 ? 'btn-primary' : ''"
              @click="craft(r)"
            >
              {{ r.have > 0 ? (isWoodworking ? '做成装潢' : '做成作品') : '背包没有' }}
            </button>
            <span v-else class="badge badge-on">已完成</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ② 量产阶梯 -->
    <div v-if="ladder" class="sw-ladder" :class="{ 'sw-ladder--sep': rows.length > 0 }">
      <div class="sw-head">
        <span class="sw-h">🏭 {{ ladder.name }}量产阶梯</span>
        <span class="dim">
          第 <b>{{ ladderTier }}/{{ LADDER_TIERS.length }}</b> 档 · 累计 <b class="mono">{{ ladderPoints.toLocaleString() }}</b> 点
          · 阶梯合计 <b>{{ ladderTotal > 0 ? ladder.unit(ladderTotal) : '—' }}</b>
        </span>
      </div>
      <p class="dim sw-note">
        把多余的产物投进来换永久加成（<b>{{ ladderLabel }}</b>）——<b>按档位计点</b>（Lv1 的 1 点、Lv91 的 10 点），
        每档 <b>{{ ladder.unit(ladder.perTier) }}</b>，共 {{ LADDER_TIERS.length }} 档。
        <template v-if="ladderNext">
          · 距下一档（{{ ladderNext.need.toLocaleString() }} 点）还差 <b class="mono">{{ ladderNext.left.toLocaleString() }}</b> 点
        </template>
        <template v-else>· <b>已满档</b>，多余的产物可去杂货铺半价卖回材料钱</template>
      </p>
      <div class="sw-feed">
        <button class="btn btn-sm" :class="feedQty > 0 ? 'btn-primary' : ''" :disabled="feedQty <= 0" @click="feed">
          {{ feedQty > 0 ? `投入全部（${feedQty} 件 → +${feedPts} 点）` : '背包里没有可投入的产物' }}
        </button>
        <span v-if="feedRows.length" class="dim sw-feed-list">
          {{ feedRows.map((x) => `${x.name}×${x.have}(+${x.points}/件)`).join(' · ') }}
        </span>
      </div>
      <p class="dim sw-foot">
        产物是<b>副业独占品</b>：采集拿不到，商店、抽卡、交易所、商队都不出，也不会被自动出售。
        多做出来的不会浪费——<b>投入阶梯累积</b>，满档后还能去杂货铺「出售」页半价卖回材料钱。
      </p>
    </div>
  </div>
</template>

<style scoped>
.sw-card {
  margin-top: 12px;
  padding: 12px 16px;
}
.sw-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.sw-h {
  font-weight: 600;
  font-size: 15px;
}
.sw-note {
  margin: 6px 0 10px;
  font-size: 12px;
}
.sw-ladder {
  margin-top: 14px;
  padding-top: 12px;
}
/* 只在**上面真有作品层**时才画分隔虚线（木工以前没有作品层 → 只留一条悬空虚线） */
.sw-ladder--sep {
  border-top: 1px dashed var(--border);
}
.sw-feed {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 8px 0;
}
.sw-feed-list {
  font-size: 11px;
}
.sw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 8px;
}
.sw-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: var(--bg-soft);
}
.sw-item.sw-can {
  border-style: solid;
  border-color: rgba(var(--primary-tint-rgb), 0.45);
}
.sw-item.sw-done {
  opacity: 0.75;
}
.sw-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.sw-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sw-eff {
  font-size: 11px;
}
.sw-foot {
  margin: 10px 0 0;
  font-size: 11px;
}
</style>
