<script setup>
// 食灵召唤视图 — 需求文档 §3.3.6：契约制作 + 出战（最多 2 个）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import Pagination from '../components/Pagination.vue'
import { SPIRITS, SPIRIT_SLOTS, SPIRIT_TIER } from '../game/data/spirits.js'
import { getItem } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'
import { getSkillDef } from '../game/data/skills.js'
import { STYLE_INFO } from '../game/data/combat.js'

const props = defineProps({
  instance: { type: Object, required: true },
})
const player = usePlayerStore()
const ui = useUiStore()

function contractFor(spirit) {
  return props.instance.recipes.find((r) => r.output.itemId === spirit.id) ?? null
}
function have(itemId) {
  return player.spirits?.owned?.[itemId] ?? 0
}
function canCraft(spirit) {
  return props.instance.canCraft(contractFor(spirit))
}
function craft(spirit) {
  const r = contractFor(spirit)
  if (r) props.instance.craft(r)
}
function isActive(spiritId) {
  return player.spirits.active.includes(spiritId)
}
function isOwned(spiritId) {
  return (player.spirits?.owned?.[spiritId] ?? 0) > 0 || isActive(spiritId)
}
function toggle(spiritId) {
  const ok = player.setSpiritActive(spiritId, !isActive(spiritId))
  if (!ok) ui.pushLog(isActive(spiritId) ? '出战位已满（最多 2 个）' : '切换失败', 'warn')
}
function effectText(spirit) {
  const e = spirit.effect
  const parts = []
  if (e.xpPct) for (const [k, v] of Object.entries(e.xpPct)) parts.push(`${getSkillDef(k)?.name ?? k}经验 +${v}%`)
  if (e.dmgPct) parts.push(`全对决伤害 +${e.dmgPct}%`)
  if (e.styleDmgPct) for (const [k, v] of Object.entries(e.styleDmgPct)) parts.push(`${STYLE_INFO[k]?.name ?? k}流派伤害 +${v}%`)
  if (e.healPerTurnPct) parts.push(`每回合回复 ${e.healPerTurnPct}% 最大品鉴值`)
  if (e.loseHpPerTurnPct) parts.push(`每回合损失 ${-e.loseHpPerTurnPct}% 最大品鉴值`)
  if (e.fishingAccPct) parts.push(`垂钓成功率 +${e.fishingAccPct}%`)
  if (e.farmYieldBonus) parts.push(`农耕收获 +${e.farmYieldBonus}`)
  return parts.join('，')
}

// 逐条效果（供卡片 chip 展示，类似契约材料）
function effectParts(spirit) {
  const e = spirit.effect
  const parts = []
  if (e.xpPct) for (const [k, v] of Object.entries(e.xpPct)) parts.push(`${getSkillDef(k)?.name ?? k}经验 +${v}%`)
  if (e.dmgPct) parts.push(`全对决伤害 +${e.dmgPct}%`)
  if (e.styleDmgPct) for (const [k, v] of Object.entries(e.styleDmgPct)) parts.push(`${STYLE_INFO[k]?.name ?? k}流派伤害 +${v}%`)
  if (e.healPerTurnPct) parts.push(`每回合回复 ${e.healPerTurnPct}% 最大品鉴值`)
  if (e.loseHpPerTurnPct) parts.push(`每回合损失 ${-e.loseHpPerTurnPct}% 最大品鉴值`)
  if (e.fishingAccPct) parts.push(`垂钓成功率 +${e.fishingAccPct}%`)
  if (e.farmYieldBonus) parts.push(`农耕收获 +${e.farmYieldBonus}`)
  return parts
}

// 食灵阶级编号（1~5）
function spiritTier(spirit) {
  return SPIRIT_TIER[spirit.id] ?? 0
}
function tierLabel(spirit) {
  const t = spiritTier(spirit)
  const name = ['', '采耕', '烹制', '饮藏', '御对', '超凡'][t]
  return t ? `${t}（${name}）` : ''
}

// 展示排序：按召唤等级(reqLevel)升序，同级再按阶级升序，便于浏览
function sortedSpirits() {
  return [...SPIRITS].sort((a, b) => a.reqLevel - b.reqLevel || (SPIRIT_TIER[a.id] ?? 0) - (SPIRIT_TIER[b.id] ?? 0))
}

// 阶级分类 tab（采耕 / 烹制 / 饮藏 / 御对 / 超凡），默认显示采耕
const tierFilter = ref(1)
const TIER_TABS = [
  { id: 1, name: '采耕' },
  { id: 2, name: '烹制' },
  { id: 3, name: '饮藏' },
  { id: 4, name: '御对' },
  { id: 5, name: '超凡' },
]
// 按选中阶级过滤后、再排序
function filteredSpirits() {
  return SPIRITS.filter((s) => spiritTier(s) === tierFilter.value)
    .sort((a, b) => a.reqLevel - b.reqLevel || (SPIRIT_TIER[a.id] ?? 0) - (SPIRIT_TIER[b.id] ?? 0))
}
// 分类计数：该阶级下的精灵数
function tierCount(t) {
  return SPIRITS.filter((s) => spiritTier(s) === t).length
}

// ── 图鉴格子墙：分页 + 就地展开详情（收集册式：默认只显大图+名+角标，点格子展开详情）──
const SPIRIT_PAGE_SIZE = 21 // 每页格子数
const spiritPage = ref(1)
const spiritPages = computed(() => Math.max(1, Math.ceil(filteredSpirits().length / SPIRIT_PAGE_SIZE)))
const spiritPaged = computed(() => {
  const p = Math.min(spiritPage.value, spiritPages.value)
  const arr = filteredSpirits().slice((p - 1) * SPIRIT_PAGE_SIZE, p * SPIRIT_PAGE_SIZE)
  while (arr.length < SPIRIT_PAGE_SIZE) arr.push({ _pad: true })
  return arr
})
// ── 主从布局：左侧选格，右侧常驻详情框显示选中食灵 ──
const selectedId = ref(null)
const selectedSpirit = computed(() => SPIRITS.find((s) => s.id === selectedId.value) ?? filteredSpirits()[0] ?? null)
// 羁绊进度（2026-09-06 长线养成：出战天数 → 等级 → 效果 +4%/级）
const bondProg = computed(() => (selectedSpirit.value ? player.bondProgressFor(selectedSpirit.value.id) : null))
function selectSpirit(id) { selectedId.value = id }
</script>

<template>
  <div>
    <div class="card status-line">
      <span class="badge badge-on">出战 {{ player.spirits.active.length }}/{{ SPIRIT_SLOTS }}</span>
      <span class="dim">制作契约 = 召唤食灵；食灵提供被动增益</span>
    </div>

    <div class="card">
      <h3>食灵图鉴（{{ SPIRITS.length }} 种）</h3>
      <div class="region-tabs spirit-class-tabs" style="flex-wrap: wrap">
        <button v-for="t in TIER_TABS" :key="t.id" class="btn btn-sm" :class="{ 'btn-primary': tierFilter === t.id }" @click="tierFilter = t.id; spiritPage = 1">
          {{ t.name }}（{{ tierCount(t.id) }}）
        </button>
      </div>
      <!-- 主从布局：左侧图鉴格子墙(点选)，右侧常驻详情框(默认显示选中食灵) -->
      <div class="spirit-master-detail">
        <div class="spirit-wall-col">
          <div class="spirit-wall">
            <template v-for="(sp, si) in spiritPaged" :key="sp.id ?? 'pad-' + si">
            <div v-if="!sp._pad" class="spirit-cell" :class="{ locked: !isOwned(sp.id), active: isActive(sp.id), selected: selectedId === sp.id }" @click="selectSpirit(sp.id)">
              <img v-if="itemImage(sp.id)" :src="itemImage(sp.id)" class="item-img spirit-cell-img" @error="$event.target.style.display = 'none'" alt="" />
              <div class="spirit-cell-name">{{ sp.name }}</div>
              <div class="spirit-cell-badges">
                <span class="badge badge-tier">{{ tierLabel(sp) }}</span>
                <span v-if="isActive(sp.id)" class="badge badge-on">出战</span>
                <span v-else-if="isOwned(sp.id)" class="badge badge-own">已拥有</span>
                <span v-else class="badge badge-locked">未拥有</span>
              </div>
            </div>
            </template>
          </div>
          <Pagination v-if="filteredSpirits().length > SPIRIT_PAGE_SIZE" :current="spiritPage" :pages="spiritPages" @update:current="(p) => spiritPage = p" />
        </div>
        <div v-if="selectedSpirit" class="spirit-detail-panel" :class="{ active: isActive(selectedSpirit.id) }">
          <div class="spirit-detail-img">
            <img v-if="itemImage(selectedSpirit.id)" :src="itemImage(selectedSpirit.id)" class="item-img spirit-detail-bigimg" @error="$event.target.style.display = 'none'" alt="" />
          </div>
          <div class="spirit-detail-name">
            <span class="item-card-name">{{ selectedSpirit.name }}</span>
            <span class="badge badge-tier">{{ tierLabel(selectedSpirit) }}</span>
            <span v-if="isActive(selectedSpirit.id)" class="badge badge-on">出战</span>
            <span v-else-if="isOwned(selectedSpirit.id)" class="badge badge-own">已拥有</span>
          </div>
          <div class="spirit-detail-grade dim">等级 {{ selectedSpirit.reqLevel }}</div>
          <div v-if="bondProg" class="spirit-detail-grade dim">
            羁绊 <span class="badge badge-on">Lv{{ bondProg.level }}</span>
            <template v-if="bondProg.nextDays !== null">（出战 {{ Math.floor(bondProg.days) }} 天，还差 {{ (bondProg.nextDays - bondProg.days).toFixed(1) }} 天升级，效果 +{{ bondProg.level * 4 }}%）</template>
            <template v-else>（已满级，效果 +20%）</template>
          </div>
          <div class="spirit-detail-divider"></div>
          <div class="spirit-detail-sec dim">
            <span v-for="(e, i) in effectParts(selectedSpirit)" :key="i" class="ing">{{ e }}</span>
          </div>
          <div class="spirit-detail-divider"></div>
          <div class="spirit-detail-sec dim">
            <span v-for="(qty, itemId) in selectedSpirit.contract" :key="itemId" class="ing" :class="{ lacking: have(itemId) < qty }">
              {{ getItem(itemId)?.name }} {{ have(itemId) }}/{{ qty }}
            </span>
          </div>
          <div class="spirit-detail-action">
            <button v-if="!isOwned(selectedSpirit.id)" class="btn btn-sm btn-primary" :disabled="!canCraft(selectedSpirit)" @click="craft(selectedSpirit)">制作契约</button>
            <button v-else-if="!isActive(selectedSpirit.id)" class="btn btn-sm btn-primary" :disabled="player.spirits.active.length >= SPIRIT_SLOTS" @click="toggle(selectedSpirit.id)">召唤出战</button>
            <button v-else class="btn btn-sm" @click="toggle(selectedSpirit.id)">召回</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
