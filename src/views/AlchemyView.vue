<script setup>
// 炼金 — 物品融合：低阶食材/材料 → 高阶（省探索时间，微亏价值换效率）
// 卡片式展示：按产物类别分段（可折叠），材料图 → 产物图
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { ALCHEMY_RECIPES } from '../game/data/alchemy.js'
import { getItem } from '../game/data/items.js'
import { CATEGORY_LABEL } from '../game/data/itemDetail.js'
import { itemImage } from '../game/data/itemImage.js'
import QuantityModal from '../components/QuantityModal.vue'
import ItemImg from '../components/ItemImg.vue'
import Pagination from '../components/Pagination.vue'

const player = usePlayerStore()
const ui = useUiStore()
const PAGE_SIZE = 24
const page = ref(1)

// 合成表：材料 → 产物（产物价值 ≈ 投入价值，省采集/种植时间）

const sel = ref(null) // 待融合配方
function maxAlchemy(r) {
  let n = 99
  for (const [itemId, qty] of Object.entries(r.in)) {
    n = Math.min(n, Math.floor((player.inventory[itemId] ?? 0) / qty))
  }
  return Math.max(0, n)
}
function open(r) {
  if (maxAlchemy(r) <= 0) return
  sel.value = r
}
function confirmAlchemy(n) {
  const r = sel.value
  if (!r) return
  let ok = 0
  for (let i = 0; i < n; i++) {
    let can = true
    for (const [itemId, qty] of Object.entries(r.in)) {
      if ((player.inventory[itemId] ?? 0) < qty) { can = false; break }
    }
    if (!can) break
    for (const [itemId, qty] of Object.entries(r.in)) player.spendItem(itemId, qty)
    player.gainItem(r.out, 1)
    ok++
  }
  if (ok > 0) {
    ui.pushLog(`🧪 炼金融合 ${getItem(r.out)?.name} ×${ok}`, 'gain')
    // 每日/周常「炼金」任务进度（每融合 1 次计 1 次）+ 故事「炼金体验」计数
    for (let i = 0; i < ok; i++) player.bumpDaily('alchemy', 'any')
    player.stats.alchemyCrafts = (player.stats.alchemyCrafts ?? 0) + ok
  }
}

// 配方名显示：链式配方 name 存英文 id（fishing_ext2_03→fishing_ext2_04），转为中文名
function alchemyName(r) {
  if (r.name.includes('→')) {
    const [src, dst] = r.name.split('→')
    const s = getItem(src)?.name
    const d = getItem(dst)?.name
    if (s && d) return `${s}→${d}`
  }
  return r.name
}

// 区分主材料与附加要求材料：主材料 = 价值贡献最大的那一种；其余全部为附加（可不止一种）。
// 主材料保留图片展示；附加材料用制作页式文字展示（名称+数量，无图片）。
function alchemyInputs(r) {
  const entries = Object.entries(r.in)
  if (entries.length <= 1) {
    return { main: entries.map(([id, qty]) => ({ id, qty })), extras: [] }
  }
  let mainId = null, mainVal = -1
  for (const [id, qty] of entries) {
    const v = (getItem(id)?.value ?? 0) * qty
    if (v > mainVal) { mainVal = v; mainId = id }
  }
  const main = entries.filter(([id]) => id === mainId).map(([id, qty]) => ({ id, qty }))
  const extras = entries.filter(([id]) => id !== mainId).map(([id, qty]) => ({ id, qty }))
  return { main, extras }
}

// ── 卡片式分段：按产物类别分组（可折叠）──
// 细分分类归并到主分类（合并到其它分类段）：粮谷/豆类/种子→蔬菜；香草/香料植物→复合调料
const CAT_MERGE = {
  grain: 'vegetable',
  legume: 'vegetable',
  种植产物: 'vegetable',
  seed: 'vegetable',
  herb: 'seasoning',
  spicePlant: 'seasoning',
}
const CAT_ORDER = ['seafood', 'meat', 'fruit', 'vegetable', 'root', 'mineral', 'fungus', 'pickled', 'seasoning', 'egg', 'supply']
const sections = computed(() => {
  const map = new Map()
  for (const r of ALCHEMY_RECIPES) {
    // 幽灵配方过滤（2026-09-06 图鉴三查）：产物或任一材料不存在于 ITEMS 的配方不可执行，不展示
    if (!getItem(r.out) || Object.keys(r.in ?? {}).some((k) => !getItem(k))) continue
    const it = getItem(r.out)
    const cat = it ? (CAT_MERGE[it.category] ?? it.category) : undefined
    let label = it ? (CATEGORY_LABEL[cat] ?? cat) : '其他'
    if (!map.has(label)) map.set(label, { cat, list: [] })
    map.get(label).list.push(r)
  }
  return [...map.entries()]
    .map(([label, v]) => ({ label, cat: v.cat, list: v.list }))
    .sort((a, b) => {
      const ia = CAT_ORDER.indexOf(a.cat), ib = CAT_ORDER.indexOf(b.cat)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.label.localeCompare(b.label)
    })
})
const collapsed = ref(new Set())
// 默认只展开第一个分类，避免一次性渲染上千条炼金卡导致进页卡顿
if (sections.value.length) {
  for (let i = 1; i < sections.value.length; i++) collapsed.value.add(sections.value[i].label)
}
function toggleSection(label) {
  const s = new Set(collapsed.value)
  if (s.has(label)) s.delete(label)
  else s.add(label)
  collapsed.value = s
}
function isOpen(label) {
  return !collapsed.value.has(label)
}

// 分类快速导航：点击滚动到对应分段
function scrollToSection(label) {
  const el = document.getElementById('sec-' + label)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ── 大类切换：一次只显示一个产物类别（避免全部炼金卡同时渲染）＋ 记忆上次类别 ──
const currentAlchemyCat = ref(player.settings.alchemyCat ?? '')
const curCat = computed(() => sections.value.find((s) => s.label === currentAlchemyCat.value) ?? sections.value[0] ?? null)
function selectAlchemyCat(label) {
  currentAlchemyCat.value = label
  player.settings.alchemyCat = label
  page.value = 1
}
// 当前分类配方分页
const secList = computed(() => curCat.value?.list ?? [])
const pages = computed(() => Math.max(1, Math.ceil(secList.value.length / PAGE_SIZE)))
// 配方卡视图：主料/附加/可融合次数每页一次预计算（模板不再对每卡重复调用 3 次函数）
const listPaged = computed(() => {
  const p = Math.min(page.value, pages.value)
  const arr = secList.value.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE)
  while (arr.length < PAGE_SIZE) arr.push({ _pad: true })
  return arr.map((r) => (r._pad ? r : { r, max: maxAlchemy(r), inputs: alchemyInputs(r) }))
})
// 当前分类是否可融合（段标题徽章；只在背包变化时重算，不再每次渲染遍历全段）
const anyCraftable = computed(() => secList.value.some((r) => maxAlchemy(r) > 0))
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🧪 炼金</h2>
        <p class="dim">把低阶食材/材料融合成高阶（{{ ALCHEMY_RECIPES.length }} 条，按产物类别分段，点击段标题折叠）</p>
      </div>
    </header>

    <!-- 大类切换：一次只显示一个产物类别，并记忆上次选择 -->
    <div v-if="sections.length > 1" class="region-tabs" style="flex-wrap: wrap">
      <button
        v-for="sec in sections"
        :key="sec.label"
        class="btn btn-sm"
        :class="{ 'btn-primary': curCat?.label === sec.label }"
        @click="selectAlchemyCat(sec.label)"
      >{{ sec.label }}</button>
    </div>

    <div v-for="sec in [curCat]" :key="sec?.label" class="gather-section" :id="'sec-' + sec.label">
      <div class="gather-section-title">
        <strong>{{ sec.label }}</strong>
        <span class="dim">{{ sec.list.length }} 条配方</span>
        <span v-if="anyCraftable" class="badge badge-on">可融合</span>
      </div>
      <div class="gather-grid grid-n-6 grid-equal">
        <template v-for="(v, ei) in listPaged" :key="v.r?.id ?? 'pad-' + ei">
          <div v-if="!v._pad" v-tilt class="gather-card alchemy-card" :class="{ locked: v.max <= 0 }">
          <div class="alchemy-flow">
            <div class="alchemy-side">
              <template v-for="m in v.inputs.main" :key="m.id">
                <ItemImg :item-id="m.id" class="item-img" />
              </template>
              <div class="alchemy-side-name">
                <span v-for="m in v.inputs.main" :key="m.id">{{ getItem(m.id)?.name }} ×{{ m.qty }}</span>
              </div>
            </div>
            <span class="alchemy-arrow">→</span>
            <div class="alchemy-side">
              <ItemImg :item-id="v.r.out" class="item-img" />
              <div class="alchemy-side-name">{{ getItem(v.r.out)?.name }}</div>
            </div>
          </div>
          <!-- 附加要求材料（可不止一种）：单独一行，在"主料→目标"区域下方，用虚线隔开；制作页式文字展示，不用图片 -->
          <div v-if="v.inputs.extras.length" class="alchemy-extra-row">
            <div class="ing-cell alchemy-extra">
              <span v-for="x in v.inputs.extras" :key="x.id" class="ing"
                :class="{ lacking: (player.inventory[x.id] ?? 0) < x.qty }">
                {{ getItem(x.id)?.name }} <span class="mono">{{ (player.inventory[x.id] ?? 0) }}/{{ x.qty }}</span>
              </span>
            </div>
          </div>
          <!-- 可融合行强制放在融合按钮上方（打包成贴底组） -->
          <div class="alchemy-card-bottom">
            <div class="gather-card-row">
              <span>可融合</span>
              <span class="mono">{{ v.max }}</span>
            </div>
            <button class="btn btn-sm btn-primary" :disabled="v.max <= 0" @click="open(v.r)">融合</button>
          </div>
          </div>
          <div v-else class="pager-spacer"></div>
        </template>
      </div>
      <Pagination :current="Math.min(page, pages)" :pages="pages" @update:current="(p) => page = p" />
    </div>

    <!-- 融合数量选择弹窗 -->
    <QuantityModal
      :show="!!sel"
      :title="sel ? `融合 ${getItem(sel.out)?.name}` : ''"
      :max="sel ? maxAlchemy(sel) : 1"
      @close="sel = null"
      @confirm="confirmAlchemy"
    />
  </div>
</template>

