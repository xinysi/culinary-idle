<script setup>
// 厨藏页（2026-09-19 由 `InventoryModal` 升级为独立页面；2026-09-20 **存储合一**）——
// 只有一个存储（`player.inventory`），没有仓库、没有入仓/出仓。版式参考梅尔沃的仓库界面：
// 顶部分类标签 + 搜索/排序，中间**高密度格子**，右侧选中物品详情与来源；**点了物品才出操作**。
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { spoilCountdown } from '../game/data/itemDetail.js' // 腐坏倒计时文案（与「物品详情」弹窗共用同一格式）
import { itemImage } from '../game/data/itemImage.js'
import { sfx } from '../game/core/sound.js'
import ItemDetailModal from '../components/ItemDetailModal.vue'

const player = usePlayerStore()
const ui = useUiStore()
// 2026-09-20 存储合一（用户要求「只有一个厨藏的功能」）：`player.inventory` 是**唯一**存储，
// 仓库已并入（见 player.js 的 mergeBankIntoInventory 与 caps.js 的 STORAGE_*）。
// 所以这里不再有「来源」这一维，也没有入仓/出仓这套动作。
// ── 2026-09-19 第二轮（用户：厨藏功能与仓库功能合并为一个 + 参考截图重排）──────────
// 一个**合并列表**：同一样东西在厨藏和仓库都有时，格子上标出两边的数量，
// 选中后右栏分别给出两边的操作（厨藏：使用/卖/存入；仓库：取出）。
const catFilter = ref('all')
const searchQ = ref('')
const CAT_TABS = [
  { id: 'all', name: '全部', icon: '🧺' },
  { id: 'food', name: '料理', icon: '🍲' },
  { id: 'ingredient', name: '原料', icon: '🥕' },
  { id: 'drink', name: '饮品', icon: '🍵' },
  { id: 'spice', name: '香料', icon: '🌶️' },
  { id: 'equipment', name: '装备', icon: '⚔️' },
  { id: 'seed', name: '种子', icon: '🌱' },
  { id: 'consumable', name: '消耗品', icon: '🧪' },
  { id: 'spirit', name: '食灵', icon: '👻' },
  { id: 'other', name: '其它', icon: '📦' },
]
const catOf = (id) => getItem(id)?.type ?? 'other'
const tabFilter = ref(0)      // 当前面板（0 = 全部）
const detailTab = ref('item') // 右侧分类：'item' 物品详情 / 'settings' 设置（2026-09-20 用户要求，仿梅尔沃）
const dragId = ref(null)      // 正在拖动的物品 id（拖到面板页签上即归类）
const dragOverTab = ref(null) // 拖拽时**光标下**的页签（只有它高亮）
let justDragged = false       // 刚拖完，忽略紧随其后的 click
const renameIdx = ref(-1)     // 正在改名的面板下标（双击页签进入）
const renameText = ref('')

/** 面板页签（10 块，见 game/data/bankTabs.js）：第 0 块「全部」固定；每块显示自己有几件 */
const bankTabs = computed(() => {
  const count = {}
  for (const [id, qty] of Object.entries(player.inventory ?? {})) {
    if (!(qty > 0)) continue
    const t = player.bankTabOf(id)
    count[t] = (count[t] ?? 0) + 1
  }
  return (player.bankTabs ?? []).map((t, i) => ({ ...t, i, count: i === 0 ? Object.keys(player.inventory ?? {}).filter((k) => player.inventory[k] > 0).length : (count[i] ?? 0) }))
})

/** 厨藏列表（唯一存储）：按**面板** + 分类 + 搜索过滤，再按当前排序 */
const list = computed(() => {
  const q = searchQ.value.trim()
  const out = []
  for (const [id, qty] of Object.entries(player.inventory ?? {})) {
    if (!(qty > 0)) continue
    // 面板过滤：0 = 全部（所有物品）；其余只显示归属该面板的物品
    if (tabFilter.value !== 0 && player.bankTabOf(id) !== tabFilter.value) continue
    if (catFilter.value !== 'all') {
      const c = catOf(id)
      const known = ['food', 'ingredient', 'drink', 'spice', 'equipment', 'seed', 'consumable', 'spirit']
      if (catFilter.value === 'other' ? known.includes(c) : c !== catFilter.value) continue
    }
    if (q && !(getItem(id)?.name ?? '').includes(q)) continue
    out.push({ id, total: qty })
  }
  return sortList(out)
})
/** 只显示"有货"的分类标签（空标签不占位） */
const catTabsShown = computed(() => {
  const present = new Set()
  for (const id of Object.keys(player.inventory ?? {})) {
    if ((player.inventory?.[id] ?? 0) > 0) present.add(catOf(id))
  }
  return CAT_TABS.filter((t) => t.id === 'all' || (t.id === 'other' ? [...present].some((c) => !['food', 'ingredient', 'drink', 'spice', 'equipment', 'seed', 'consumable', 'spirit'].includes(c)) : present.has(t.id)))
})

const selected = ref(null) // 选中的 itemId（格子高亮 + 右侧详情 + 操作）
const hoverId = ref(null)  // 悬停中的格子：数量药丸由「x.xx万」切换成**精确数字**（2026-09-20 用户要求）
const detailItem = ref(null) // 「?」按钮打开的详情弹窗（详细作用 / 可用于制作 / 获取来源），复用图鉴的 ItemDetailModal
const qty = ref(1)
const sortBy = ref('value') // 排序：value 价值 / name 名称 / type 类型 / qty 数量

const SORT_OPTIONS = [
  { id: 'value', name: '按价值' },
  { id: 'type', name: '按类型' },
  { id: 'name', name: '按名称' },
  { id: 'qty', name: '按数量' },
]
const TYPE_ORDER = { food: 1, drink: 2, spice: 3, ingredient: 4, equipment: 5, consumable: 6, seed: 7, spirit: 8 }

/** 兼容两种输入：`[id, qty]` 元组（旧的 bag/bank 列表）与 `{ id, total }` 对象（合并列表） */
function sortList(entries) {
  const s = sortBy.value
  const arr = entries.filter((e) => (Array.isArray(e) ? e[1] : e.total) > 0).map((e) => (Array.isArray(e) ? { id: e[0], total: e[1] } : e))
  if (s === 'name') return arr.sort((a, b) => (getItem(a.id)?.name ?? '').localeCompare(getItem(b.id)?.name ?? '', 'zh'))
  if (s === 'qty') return arr.sort((a, b) => b.total - a.total || (getItem(b.id)?.value ?? 0) - (getItem(a.id)?.value ?? 0))
  if (s === 'type') return arr.sort((a, b) => (TYPE_ORDER[getItem(a.id)?.type] ?? 9) - (TYPE_ORDER[getItem(b.id)?.type] ?? 9) || (getItem(b.id)?.tier ?? 0) - (getItem(a.id)?.tier ?? 0))
  return arr.sort((a, b) => (getItem(b.id)?.tier ?? 0) - (getItem(a.id)?.tier ?? 0) || (getItem(b.id)?.value ?? 0) - (getItem(a.id)?.value ?? 0))
}
const maxQty = computed(() => (selected.value ? (player.inventory[selected.value] ?? 0) : 0))
/** 出售单价（与 `player.sellItem` 同一口径，见 player.js 的 `sellUnitPrice`）—— 面板上的「合计」必须与实际到账一致 */
const unitPrice = computed(() => (selected.value ? player.sellUnitPrice(selected.value) : 0))
const sellTotal = computed(() => unitPrice.value * Math.max(1, Math.min(qty.value, maxQty.value)))

const usableKind = computed(() => (selected.value ? player.usableOf?.(selected.value) : null))

/** 格子上的数量：< 1 万显示**精确数字**，≥ 1 万显示「x.xx万」（悬停时换成精确数字，见模板的 hoverId）。
 *  梅尔沃式槽位（2026-09-20 用户给图）：38.91万 —— 厨藏后期动辄几十万件，长数字会顶破格子。
 *  设置里关掉「数量缩写」后恒显示精确数字（见右侧「设置」页签）。 */
function shortQty(n) {
  if (!(n >= 10000)) return n.toLocaleString()
  return `${(n / 10000).toFixed(2)}万`
}
function qtyLabel(id, total) {
  if (hoverId.value === id || player.settings?.invShortQty === false) return total.toLocaleString()
  return shortQty(total)
}
/** 双击格子（设置里可关）：可用消耗品直接使用、装备直接穿戴，其它物品打开详情弹窗 */
function dblClick(id) {
  if (player.settings?.invDblClick === false) return
  const kind = player.usableOf?.(id)
  if (kind) {
    const r = player.useConsumable(id)
    ui.pushLog(r.ok ? `🧪 ${r.msg}` : r.msg, r.ok ? 'gain' : 'warn')
    if (r.ok) sfx.reward(); else sfx.error()
    if ((player.inventory[id] ?? 0) <= 0) selected.value = null
    return
  }
  if (getItem(id)?.type === 'equipment') {
    if (player.equip(id)) { ui.pushLog(`⚔️ 穿戴了 ${getItem(id)?.name}`, 'gain'); sfx.reward() }
    return
  }
  detailItem.value = id
}

/** 点击格子：刚拖完的那一下忽略（避免「拖去归类」被当成点开详情） */
function onSlotClick(id) {
  if (justDragged) return
  select(id)
}
function select(id) {
  selected.value = selected.value === id ? null : id
  qty.value = 1
}
// ── 面板分类（2026-09-20）────────────────────────────────────────────────────
/** 拖拽：格子 → 面板页签（第 0 块「全部」= 移回未分类） */
function dragStart(id, e) {
  dragId.value = id
  justDragged = true
  if (e?.dataTransfer) {
    e.dataTransfer.setData('text/plain', id) // Firefox 需要 setData 才启动拖拽
    e.dataTransfer.effectAllowed = 'move'
  }
}
function dragEnd() {
  dragId.value = null
  dragOverTab.value = null
  // 拖完的那一下 click 不该再选中物品（否则「拖完顺手点开详情」很容易误触）
  setTimeout(() => (justDragged = false), 80)
}
/** 拖拽期间的高亮只给**光标下那一个页签**（原先给所有非当前页签加虚线，满屏虚线很吵） */
function dragOver(i) {
  if (dragId.value) dragOverTab.value = i
}
function dropOnTab(i) {
  if (dragId.value) {
    moveToTab(dragId.value, i)
    dragId.value = null
    dragOverTab.value = null
  }
}
function moveToTab(id, i) {
  if (!id) return
  const ok = player.setItemTab(id, i === 0 ? 0 : i)
  if (ok) ui.pushLog(i === 0 ? `📤 ${getItem(id)?.name} 移出面板（回到未分类）` : `🗂 ${getItem(id)?.name} → ${player.bankTabs[i]?.name ?? '面板'}`, 'info')
  else sfx.error()
}
/** 面板改名：双击页签进入行内编辑（Enter / 失焦提交，Esc 取消） */
function startRename(t) {
  if (t.i === 0) return
  renameIdx.value = t.i
  renameText.value = t.name
}
function commitRename() {
  if (renameIdx.value > 0) player.renameBankTab(renameIdx.value, renameText.value)
  renameIdx.value = -1
}
/** 用选中物品当面板图标（梅尔沃的「将物品设置为仓库面板图标」） */
function setTabIconFromSelected(t) {
  if (!selected.value || t.i === 0) return
  player.setBankTabIcon(t.i, selected.value)
  ui.pushLog(`🖼 面板「${t.name}」图标改为 ${getItem(selected.value)?.name}`, 'info')
}
function clearTab(t) {
  const n = player.clearBankTab(t.i)
  ui.pushLog(n ? `🧹 已把 ${n} 种物品移出「${t.name}」` : '这块面板里没有物品', n ? 'info' : 'warn')
}
/** 数量快选：1 / 10 / 全部（留 1 份，梅尔沃的默认留底）/ 全部 */
function quickQty(n) {
  const m = Math.max(1, maxQty.value)
  if (n === 'all') qty.value = m
  else if (n === 'allButOne') qty.value = Math.max(1, m - 1)
  else qty.value = Math.max(1, Math.min(n, m))
}
function setQty(v) {
  qty.value = Math.max(1, Math.min(Math.max(1, maxQty.value), Math.floor(Number(v) || 1)))
}
// 数量拉条（2026-09-20 用户要求「拉条可以选数量」）——**对数刻度**：厨藏数量动辄上千，
// 线性刻度下 1/10/100 全挤在轨道最左 1% 里、拖不动；对数刻度下 1(=0) · 10(≈33%) · 100(≈66%) · 全部(100%)。
// 滑块位置固定 0~SLIDER_STEPS，与具体数量无关（换物品时轨道长度不会变）。
const SLIDER_STEPS = 1000
const sliderPos = computed(() => {
  const m = Math.max(1, maxQty.value)
  if (m <= 1) return 0
  return Math.round((Math.log(Math.max(1, qty.value)) / Math.log(m)) * SLIDER_STEPS)
})
function setQtyFromSlider(v) {
  const m = Math.max(1, maxQty.value)
  const t = Math.max(0, Math.min(1, Number(v) / SLIDER_STEPS))
  qty.value = Math.max(1, Math.min(m, Math.round(m <= 1 ? 1 : Math.exp(t * Math.log(m)))))
}
// 腐坏倒计时（2026-09-21 用户：「会腐坏的食材应该显示腐坏倒计时」）：
// 原来只报「12h 后腐坏」（取整小时、还是静态值）。现在按 `ui.loopTick` 每秒重算，
// 走「12 小时 30 分后腐坏」这种会自己往下跳的文案（格式见 `itemDetail.js` 的 `spoilCountdown`）。
const spoilTick = computed(() => {
  ui.loopTick
  return Date.now()
})
function spoilLeft(id) {
  const until = player.spoilage[id]
  if (!until) return null
  const cd = spoilCountdown(until, spoilTick.value)
  return cd ? `${cd}后腐坏` : null
}
/** 会腐坏、但此刻不在倒计时里（还没进背包 / 没开计时）→ 显示基础保鲜时长 */
function spoilBase(id) {
  const ms = getItem(id)?.spoilMs
  return ms ? `${ms / 3600000} 小时` : null
}
/** 使用所选数量（Melvor 式：先选数量再执行） */
function doUseMany() {
  if (!selected.value) return
  const n = Math.max(1, Math.min(qty.value, maxQty.value))
  let ok = 0
  for (let i = 0; i < n; i++) {
    const r = player.useConsumable(selected.value)
    if (!r.ok) break
    ok++
  }
  ui.pushLog(ok ? `🧪 ${getItem(selected.value)?.name ?? ''} ×${ok}` : '用不了（数量或条件不足）', ok ? 'gain' : 'warn')
  if (ok) sfx.reward(); else sfx.error()
  if ((player.inventory[selected.value] ?? 0) <= 0) selected.value = null
}
function doSell() {
  if (player.sellItem(selected.value, qty.value)) ui.pushLog(`出售 ${getItem(selected.value)?.name} ×${qty.value}`, 'info')
}
function doSellCommon() {
  const n = player.sellCommonEquipment()
  ui.pushLog(n ? `💰 出售普通/精良装备 ${n} 件` : '没有可出售的低品质装备', n ? 'gain' : 'warn')
}

</script>

<template>
  <div class="inventory-view">
    <header class="skill-head">
      <div>
        <h2>🧺 厨藏</h2>
        <p class="dim">你的全部物品都在这里 —— 厨藏即是仓库，只有一个存储。</p>
      </div>
    </header>

      <!-- 块①：分类 + 「厨藏空间 x / y 格」+ 搜索/排序/卖装备 **同一行**（加卡背景，2026-09-20 用户要求） -->
      <div class="inv-bartop card">
        <div class="inv-cats">
          <button
            v-for="t in catTabsShown"
            :key="t.id"
            class="btn btn-sm inv-cat"
            :class="{ 'btn-primary': catFilter === t.id }"
            @click="catFilter = t.id"
          >{{ t.icon }} {{ t.name }}</button>
        </div>
        <div class="inv-toolbar">
          <span class="inv-cap dim" title="已用格数 / 厨藏上限">厨藏空间
            <b class="mono">{{ player.inventorySlotsUsed }} / {{ player.inventoryCap }}</b> 格</span>
          <input v-model="searchQ" class="inv-search" type="text" placeholder="搜索物品…" />
          <select v-model="sortBy" class="plot-select" style="width: auto">
            <option v-for="o in SORT_OPTIONS" :key="o.id" :value="o.id">{{ o.name }}</option>
          </select>
          <button class="btn btn-sm" @click="doSellCommon" title="出售全部普通/精良品质装备（半价回收）">💰 卖普通装备</button>
        </div>
      </div>

      <div class="inv-body">
        <!-- 块② 左：面板页签（10 块）+ 槽位格子（加卡背景）
             · 面板页签：**把物品拖到页签上**即归类（拖到第 1 块「全部」= 移回未分类）
             · 双击页签可改名（Enter 提交 / Esc 取消） -->
        <section class="inv-col card">
          <div class="inv-tabs">
            <template v-for="t in bankTabs" :key="t.i">
              <input
                v-if="renameIdx === t.i"
                v-model="renameText"
                class="inv-tab-rename"
                maxlength="12"
                :ref="(el) => el && el.focus()"
                @keydown.enter="commitRename"
                @keydown.esc="renameIdx = -1"
                @blur="commitRename"
              />
              <button
                v-else
                class="inv-tab"
                :class="{
                  'inv-tab--on': tabFilter === t.i,
                  'inv-tab--drop': dragId && t.i !== tabFilter,
                  'inv-tab--over': dragOverTab === t.i && dragId,
                }"
                :title="t.i === 0 ? '全部物品（拖到这里 = 移出面板）' : `${t.name}：${t.count} 种（拖物品到此归类；双击改名）`"
                @click="tabFilter = t.i"
                @dblclick="startRename(t)"
                @dragover.prevent="dragOver(t.i)"
                @dragleave="dragOverTab = null"
                @drop.prevent="dropOnTab(t.i)"
              >
                <img v-if="t.icon && itemImage(t.icon)" :src="itemImage(t.icon)" class="inv-tab-icon" alt="" />
                <span v-else class="inv-tab-seq">{{ t.i === 0 ? '🧺' : t.i }}</span>
                <span class="inv-tab-name">{{ t.name }}</span>
                <span class="inv-tab-count mono">{{ t.count }}</span>
              </button>
            </template>
          </div>
          <!-- 拖拽提示（2026-09-21 用户：「拖动物品的表现形式有点问题，需要优化」）：
               拖动时给一条明确指引，并说明「第 1 块 = 移出面板」 -->
          <div v-if="dragId" class="inv-drag-hint">
            🗂 把「{{ getItem(dragId)?.name }}」拖到上方面板页签即可归类 · 第 1 块「🧺」= 移出面板
          </div>
          <div class="item-grid inv-grid">
            <div
              v-for="e in list"
              :key="e.id"
              class="item-cell inv-slot"
              :class="{ pinned: selected === e.id, 'inv-slot--dragging': dragId === e.id }"
              :title="`${getItem(e.id)?.name} ×${e.total}`"
              draggable="true"
              @dragstart="dragStart(e.id, $event)"
              @dragend="dragEnd"
              @click="onSlotClick(e.id)"
              @dblclick="dblClick(e.id)"
              @mouseenter="hoverId = e.id"
              @mouseleave="hoverId = null"
            >
              <img v-if="itemImage(e.id)" :src="itemImage(e.id)" class="item-img" @error="$event.target.style.display = 'none'" alt="" />
              <span v-if="spoilLeft(e.id)" class="spoil-note" :title="spoilLeft(e.id)">⚠</span>
              <span class="inv-cell-qty mono">{{ qtyLabel(e.id, e.total) }}</span>
            </div>
            <p v-if="!list.length" class="dim" style="grid-column: 1 / -1">
              {{ searchQ || catFilter !== 'all' || tabFilter !== 0 ? '这一面板/分类/关键词下没有物品（可把物品拖到其它面板页签）' : '厨藏空空如也' }}
            </p>
          </div>
        </section>

        <!-- 右：选中物品的详情 + 操作（2026-09-20 按用户给的梅尔沃截图重排）：
             ① 顶部 = 图标 + 名字 + 档位徽章 + 「?」按钮（**详细作用 / 可用于制作 / 获取来源** 全搬进该弹窗）；
             ② 数量 = 数字输入 + 拉条 + 快选（1 / 10 / 全部（留 1 份） / 全部）；
             ③ 出售 = 大按钮 + 底部合计金币（与 `sellItem` 同一口径 `player.sellUnitPrice()`）；
             ④ 可使用物品另起一段「使用 N 个」。 -->
        <!-- 右（块③）：两个分类页签「物品详情 / 设置」（2026-09-20 用户要求，仿梅尔沃的物品面板头部图标页签）。
             物品详情 = 图标/名字/档位 + 「?」弹窗 + 数量 + 出售 + 使用（见下）；
             设置 = 分类设置（图标）/ 仓库设置（三个开关）/ 默认分类 / 批量移入移出。 -->
        <aside class="bag-detail card" :class="{ 'bd--sticky': player.settings?.invStickyDetail !== false }">
          <div class="bd-tabs">
            <button class="bd-tab" :class="{ 'bd-tab--on': detailTab === 'item' }" @click="detailTab = 'item'">📦 物品详情</button>
            <button class="bd-tab" :class="{ 'bd-tab--on': detailTab === 'settings' }" @click="detailTab = 'settings'">⚙️ 设置</button>
          </div>

          <template v-if="detailTab === 'settings'">
            <div class="bd-sect">
              <div class="bd-sect-head"><span>分类设置</span></div>
              <p class="dim bd-hint">
                当前面板：<b>{{ bankTabs[tabFilter]?.name }}</b>
                <template v-if="tabFilter === 0">（「全部」不能设图标 / 收物品，先切到 1~9 号面板）</template>
              </p>
              <div class="inv-acts">
                <button class="btn btn-sm" :disabled="!selected || tabFilter === 0" title="把当前选中物品设为该面板的图标" @click="setTabIconFromSelected(bankTabs[tabFilter])">用选中物品当图标</button>
                <button class="btn btn-sm" :disabled="tabFilter === 0" @click="player.setBankTabIcon(tabFilter, null)">重置图标</button>
                <button class="btn btn-sm" :disabled="tabFilter === 0" @click="startRename(bankTabs[tabFilter])">重命名面板</button>
              </div>
            </div>

            <div class="bd-sect">
              <div class="bd-sect-head"><span>仓库设置</span></div>
              <label class="bd-switch">
                <input type="checkbox" :checked="player.settings?.invDblClick !== false" @change="player.settings.invDblClick = $event.target.checked" />
                <span>双击直接使用 / 穿戴（关掉则双击只开详情弹窗）</span>
              </label>
              <label class="bd-switch">
                <input type="checkbox" :checked="player.settings?.invShortQty !== false" @change="player.settings.invShortQty = $event.target.checked" />
                <span>数量缩写（≥1 万显示「x.xx万」，悬停仍显示精确值）</span>
              </label>
              <label class="bd-switch">
                <input type="checkbox" :checked="player.settings?.invStickyDetail !== false" @change="player.settings.invStickyDetail = $event.target.checked" />
                <span>锁定详情面板（滚动时面板钉在右上角）</span>
              </label>
            </div>

            <div class="bd-sect">
              <div class="bd-sect-head">
                <span>默认分类</span>
                <span class="mono dim">未分类物品算作第 {{ player.invDefaultTab }} 块</span>
              </div>
              <p class="dim bd-hint">新物品与未归类的物品归入该面板（默认第 0 块「全部」= 不归类，只在全部里出现）。</p>
              <select class="plot-select" :value="player.invDefaultTab" @change="player.setInvDefaultTab($event.target.value)">
                <option v-for="t in bankTabs" :key="t.i" :value="t.i">{{ t.i === 0 ? '全部（不归类）' : t.name }}</option>
              </select>
            </div>

            <div class="bd-sect">
              <div class="bd-sect-head"><span>仓库选项</span></div>
              <div class="inv-acts">
                <select class="plot-select" :value="tabFilter" @change="tabFilter = Number($event.target.value)">
                  <option v-for="t in bankTabs" :key="t.i" :value="t.i">{{ t.name }}</option>
                </select>
                <button class="btn btn-sm" :disabled="!selected || tabFilter === 0" @click="moveToTab(selected, tabFilter)">把选中物品移入此面板</button>
                <button class="btn btn-sm" :disabled="tabFilter === 0" @click="clearTab(bankTabs[tabFilter])">清空此面板（物品移出）</button>
              </div>
            </div>
          </template>

          <template v-else-if="selected">
            <div class="bd-head">
              <img v-if="itemImage(selected)" :src="itemImage(selected)" class="bd-icon" @error="$event.target.style.display = 'none'" alt="" />
              <div class="bd-head-main">
                <div class="bd-name">{{ getItem(selected)?.name }}</div>
                <div class="bd-tags">
                  <span v-if="getItem(selected)?.tier" class="badge">{{ getItem(selected)?.tier }} 档</span>
                  <span v-if="getItem(selected)?.quality" class="badge">{{ getItem(selected)?.quality }}</span>
                  <span v-if="spoilLeft(selected)" class="badge warn-text" :title="`保鲜时长 ${spoilBase(selected)}；超时后会腐坏并从背包消失`">⏳ {{ spoilLeft(selected) }}</span>
                  <span v-else-if="spoilBase(selected)" class="badge" :title="`保鲜时长 ${spoilBase(selected)}；放入厨藏后开始倒计时，冷库可续时`">🥶 保鲜 {{ spoilBase(selected) }}</span>
                </div>
              </div>
              <button class="btn btn-sm bd-info" title="详细作用 / 可用于制作 / 获取来源" @click="detailItem = selected">?</button>
            </div>

            <div class="bd-sect">
              <div class="bd-sect-head">
                <span>数量</span>
                <span class="bd-head-right">
                  <input
                    class="bd-num mono"
                    type="number"
                    min="1"
                    :max="maxQty"
                    :value="qty"
                    :disabled="maxQty <= 1"
                    @change="setQty($event.target.value)"
                  />
                  <span class="dim">/ {{ maxQty }}</span>
                </span>
              </div>
              <input
                class="bd-range"
                type="range"
                min="0"
                :max="SLIDER_STEPS"
                :value="sliderPos"
                :disabled="maxQty <= 1"
                :title="`数量 ${qty} / ${maxQty}`"
                @input="setQtyFromSlider($event.target.value)"
              />
              <div class="inv-acts bd-acts">
                <button class="btn btn-sm" :class="{ 'btn-primary': qty === 1 }" @click="quickQty(1)">1</button>
                <button class="btn btn-sm" :class="{ 'btn-primary': qty === 10 }" @click="quickQty(10)">10</button>
                <button class="btn btn-sm" :class="{ 'btn-primary': qty === maxQty - 1 }" @click="quickQty('allButOne')">全部（留 1 份）</button>
                <button class="btn btn-sm" :class="{ 'btn-primary': qty === maxQty }" @click="quickQty('all')">全部</button>
              </div>
            </div>

            <div class="bd-sect">
              <div class="bd-sect-head">
                <span>出售物品</span>
                <span class="mono dim">💰 {{ unitPrice.toLocaleString() }} / 个</span>
              </div>
              <button class="btn btn-primary bd-main" :title="`出售 ${qty} 个`" @click="doSell">出售 {{ qty }} 个</button>
              <div class="bd-total mono">💰 合计 {{ sellTotal.toLocaleString() }} 金币</div>
            </div>

            <div v-if="usableKind" class="bd-sect">
              <button class="btn bd-main" :title="`使用 ${qty} 个`" @click="doUseMany">使用 {{ qty }} 个</button>
              <div class="bd-total dim">{{ usableKind.label }}</div>
            </div>

            <!-- 面板归类（2026-09-20 用户要求：「下方右边详细说明里选择移到哪个面板」） -->
            <div class="bd-sect">
              <div class="bd-sect-head"><span>所在面板</span><span class="mono dim">{{ player.bankTabs[player.bankTabOf(selected)]?.name }}</span></div>
              <select class="plot-select" :value="player.itemTabs?.[selected] ?? 0" @change="moveToTab(selected, Number($event.target.value))">
                <option value="0">未分类（只在「全部」里出现）</option>
                <option v-for="t in bankTabs.slice(1)" :key="t.i" :value="t.i">{{ t.name }}</option>
              </select>
            </div>
          </template>
          <p v-else-if="detailTab === 'item'" class="dim">点击左边任意物品查看详情与操作</p>
        </aside>
      </div>
      <ItemDetailModal v-if="detailItem" :item-id="detailItem" @close="detailItem = null" />
  </div>
</template>

<style scoped>
/* 左：格子（可很长，随页面滚）；右：详情（**限高 + 粘住**）—— 用户报过「详情一多就无限延伸」 */
.inv-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 348px;
  gap: 12px;
  align-items: start;
}
/* 右侧详情面板：**限高 + 粘住**（跟随页面滚动，不随长列表被顶出视野）。
   🔴 2026-09-21 修：这个「限高 + 粘住」只写在注释里、**从来没有任何 CSS 实现** ——
   模板上按 `settings.invStickyDetail` 挂的 `.bd--sticky` 类因此是个**死开关**
   （用户报「厨藏的设置功能有不生效的」，实测就是它：勾不勾都没反应）。
   现在默认就是粘住 + 限高；关掉开关才退回普通块（随页面滚）。 */
.inv-body .bag-detail {
  position: sticky;
  top: 8px;
  max-height: calc(100vh - 150px);
  overflow-y: auto;
}
.inv-body .bag-detail:not(.bd--sticky) {
  position: static;
  max-height: none;
  overflow-y: visible;
}
/* 三块地方的卡背景（2026-09-20 用户要求：「如p1将三块地方添加背景」）：
   ① 顶部工具行 ②（左）面板 + 格子 ③（右）详情。用共用 `.card`，只把外边距交给网格/相邻间距管。 */
.inv-bartop.card,
.inv-col.card,
.bag-detail.card {
  margin-bottom: 0;
  padding: 10px 12px;
}
/* ── 面板页签（10 块，可拖物品进来归类；双击改名）──────────────────────────── */
.inv-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px dashed var(--border);
}
.inv-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 132px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
}
.inv-tab:hover { border-color: var(--primary); }
.inv-tab--on {
  border-color: var(--primary);
  background: rgba(var(--primary-tint-rgb), 0.14);
}
/* 拖动中：可接收的面板给出提示（拖到第 1 块 = 移出面板） */
.inv-tab--drop { border-style: dashed; border-color: var(--primary); }
/* 拖拽中**光标下**那个页签：实线 + 底色，明确「松手就放这里」 */
.inv-tab--over {
  border-style: solid !important;
  border-color: var(--primary) !important;
  background: rgba(var(--primary-tint-rgb), 0.18);
  transform: translateY(-1px);
}
/* 正在被拖的那枚格子淡出（默认拖影是半透明快照，本体再淡一点更有「拿起来了」的感觉） */
.inv-slot--dragging { opacity: 0.35; }
.inv-drag-hint {
  margin: 0 0 8px;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px dashed var(--primary);
  border-radius: 6px;
  color: var(--primary);
  background: rgba(var(--primary-tint-rgb), 0.10);
}
.inv-tab-icon { width: 18px; height: 18px; object-fit: contain; }
.inv-tab-seq {
  min-width: 18px;
  text-align: center;
  font-size: 11px;
  color: var(--text-dim);
}
.inv-tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inv-tab-count { font-size: 11px; color: var(--muted); }
.inv-tab-rename {
  width: 110px;
  height: 26px;
  padding: 0 6px;
  font-size: 12px;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--primary);
  border-radius: 8px;
}
/* ⚠️ `.item-grid`（共用类）自带 `margin-top: 10px` ⇒ 左列格子比右侧详情框低 10px。
   2026-09-20 用户报「物品和详情框顶部没有对齐」就是这 10px（实测详情框 top=179.5 / 格子 top=189.5）。 */
.inv-grid { margin-top: 0; }
/* 详情卡的两个分类页签（物品详情 / 设置）——仿梅尔沃物品面板头部的图标页签 */
.bd-tabs {
  display: flex;
  gap: 4px;
  margin: -2px -2px 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--border);
}
.bd-tab {
  flex: 1 1 auto;
  padding: 5px 8px;
  font-size: 12px;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
}
.bd-tab:hover { border-color: var(--primary); }
.bd-tab--on {
  border-color: var(--primary);
  background: rgba(var(--primary-tint-rgb), 0.14);
  color: var(--primary);
}
.bd-hint { font-size: 12px; margin: 4px 0 6px; }
/* 设置页的开关行 */
.bd-switch {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 6px 0;
  font-size: 12px;
  cursor: pointer;
}
.bd-switch input { margin-top: 2px; flex: 0 0 auto; }

/* ── 右侧详情面板（2026-09-20 按用户给的梅尔沃截图重排）─────────────────────────
   头（图标+名字+档位+「?」）→ 数量段（数字框 / 拉条 / 快选）→ 出售段（大按钮 + 合计）→ 使用段 */
.bd-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--border);
}
.bd-icon {
  flex: 0 0 auto;
  width: 52px;
  height: 52px;
  object-fit: contain;
  border-radius: 8px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
}
.bd-head-main { flex: 1 1 auto; min-width: 0; }
.bd-name {
  font-weight: 600;
  font-size: 15px;
  overflow-wrap: anywhere;
}
.bd-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
.bd-info {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  font-weight: 700;
}
.bd-sect { margin-top: 10px; }
.bd-sect-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 13px;
}
.bd-head-right { display: flex; align-items: center; gap: 4px; }
.bd-num {
  width: 74px;
  height: 26px;
  padding: 0 6px;
  text-align: right;
  font-size: 13px;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.bd-range { width: 100%; }
/* 快选一排：按钮竖直居中（`.inv-acts` 只管换行与间距） */
.bd-acts { align-items: center; }
/* 主操作按钮占满整行（梅尔沃的「出售物品」那种分量） */
.bd-main {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 8px 10px;
  font-size: 14px;
}
.bd-total {
  margin-top: 6px;
  text-align: center;
  font-size: 12px;
}
.inv-acts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
@media (max-width: 900px) {
  .inv-body .bag-detail {
    position: static;
    max-height: none;
  }
}
.inv-cap {
  font-size: 12px;
  white-space: nowrap;
}
.inv-cap b { color: var(--text); }
.inv-bartop {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 8px;
}
.inv-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}
/* 工具组吃满这一行的剩余宽度并**右对齐**（2026-09-20 用户要求「移到上面一排最右边」）。
   ⚠️ 不要用 `margin-left:auto` 做这件事：实测它在 wrap 容器里只拿到 374px（内容 384）→ 组内自己折行，
   「💰 卖普通装备」被挤到第二行，看起来像是两排控件。`flex:1 1 320px` + `justify-content:flex-end`
   才是「占满剩余 + 组内右靠」，且窄屏整组换行时也不会抖。 */
.inv-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex: 1 1 320px;
  min-width: 0;
}
/* 组内只有搜索框可被压缩：排序/卖装备被压会「文字折成两行」（实测 390px 下卖装备按钮 24→40px 高） */
.inv-toolbar > *:not(.inv-search) { flex: 0 0 auto; }
.inv-search {
  height: 30px;
  padding: 0 10px;
  font-size: 13px;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
  flex: 0 1 200px;
  min-width: 120px;
}
.inv-grid {
  /* 梅尔沃式槽位（2026-09-20 用户给图后放大到 72px）：一屏约 9 列，图标看得清 */
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  /* 行距比列距大：数量药丸有一半露在格子外（`bottom:-7px`），行距小了会贴上下一行 */
  gap: 16px 6px;
}
.inv-grid .item-cell {
  position: relative;
  overflow: visible; /* 药丸要露到格子外 */
  padding: 6px;
  min-height: 0;
  aspect-ratio: 1;
  border-radius: 10px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}
.inv-grid .item-cell:hover { border-color: var(--primary); }
/* 数量药丸：居中压在格子下边缘（用户参考图的样子）；≥1 万显示「x.xx万」、悬停换成精确数字 */
.inv-cell-qty {
  position: absolute;
  left: 50%;
  bottom: -7px;
  transform: translateX(-50%);
  max-width: calc(100% + 10px);
  padding: 1px 6px;
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
  border-radius: 999px;
  /* ⚠️ 别用 `--card` 当文字色：深色主题下它本身是深色 → 深字压深底。药丸要的是「深底浅字」，
     两个主题都成立 ⇒ 底用 `--scrim-rgb`（浅/深色下都是深调）、字用 `--glass-rgb`（两主题都是浅色）。 */
  color: rgb(var(--glass-rgb));
  background: rgba(var(--scrim-rgb), 0.82);
}
.inv-grid .item-img {
  width: 100%;
  height: 100%;
  max-width: 52px;
  max-height: 52px;
  object-fit: contain;
}
.inv-acts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.inv-src-tag {
  margin-left: auto;
  font-size: 10px;
  white-space: nowrap;
  opacity: 0.85;
}
.inv-act-groups {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  width: 100%;
}
.inv-col { min-width: 0; }
.inv-col-head { margin: 0 0 6px; }
.bag-detail-where { font-size: 12px; margin-bottom: 4px; }
@media (max-width: 1100px) {
  .inv-body { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .inv-body .bag-detail { grid-column: 1 / -1; }
}
@media (max-width: 720px) {
  .inv-body { grid-template-columns: minmax(0, 1fr); }
  .inv-body .bag-detail { grid-column: auto; }
  /* 窄屏：搜索/排序/卖装备**不许组内折行**（折了就是两排控件），让搜索框缩窄来让位 */
  .inv-toolbar { flex-wrap: nowrap; }
  .inv-search { min-width: 88px; }
}
</style>
