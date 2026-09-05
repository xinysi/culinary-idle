<script setup>
// 背包/仓库弹窗 — §5.4 格子显示 + 选中式操作（数量条/数字输入）+ 右侧详情来源
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { itemSources } from '../game/data/itemSources.js'
import { itemDetailLines } from '../game/data/itemDetail.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()
const tab = ref(ui.bagModalTab)
watch(() => ui.showBagModal, (v) => {
  if (v) {
    tab.value = ui.bagModalTab
    selected.value = null
  }
})

const selected = ref(null) // 选中的 itemId（格子高亮 + 右侧详情 + 底部操作）
const qty = ref(1)
const sortBy = ref('value') // 排序：value 价值 / name 名称 / type 类型 / qty 数量

const SORT_OPTIONS = [
  { id: 'value', name: '按价值' },
  { id: 'type', name: '按类型' },
  { id: 'name', name: '按名称' },
  { id: 'qty', name: '按数量' },
]
const TYPE_ORDER = { food: 1, drink: 2, spice: 3, ingredient: 4, equipment: 5, consumable: 6, seed: 7, spirit: 8 }

function sortList(entries) {
  const s = sortBy.value
  const arr = entries.filter(([, q]) => q > 0)
  if (s === 'name') return arr.sort((a, b) => (getItem(a[0])?.name ?? '').localeCompare(getItem(b[0])?.name ?? '', 'zh'))
  if (s === 'qty') return arr.sort((a, b) => b[1] - a[1] || (getItem(b[0])?.value ?? 0) - (getItem(a[0])?.value ?? 0))
  if (s === 'type') return arr.sort((a, b) => (TYPE_ORDER[getItem(a[0])?.type] ?? 9) - (TYPE_ORDER[getItem(b[0])?.type] ?? 9) || (getItem(b[0])?.tier ?? 0) - (getItem(a[0])?.tier ?? 0))
  return arr.sort((a, b) => (getItem(b[0])?.tier ?? 0) - (getItem(a[0])?.tier ?? 0) || (getItem(b[0])?.value ?? 0) - (getItem(a[0])?.value ?? 0))
}
const bagList = computed(() => sortList(Object.entries(player.inventory)))
const bankList = computed(() => sortList(Object.entries(player.bank)))
const maxQty = computed(() => (selected.value ? (tab.value === 'bag' ? player.inventory[selected.value] ?? 0 : player.bank[selected.value] ?? 0) : 0))

function select(id) {
  selected.value = selected.value === id ? null : id
  qty.value = 1
}
function setQty(v) {
  const n = Math.max(1, Math.min(maxQty.value, Math.floor(Number(v) || 1)))
  qty.value = n
}
function spoilLeft(id) {
  const until = player.spoilage[id]
  if (!until) return null
  const h = Math.ceil((until - Date.now()) / 3600000)
  return h > 0 ? `${h}h 后腐坏` : '已腐坏'
}
function doMoveToBank() {
  if (player.moveToBank(selected.value, qty.value)) ui.pushLog(`存入仓库：${getItem(selected.value)?.name} ×${qty.value}`, 'info')
}
function doMoveToInventory() {
  if (player.moveToInventory(selected.value, qty.value)) ui.pushLog(`取出：${getItem(selected.value)?.name} ×${qty.value}`, 'info')
}
function doSell() {
  if (player.sellItem(selected.value, qty.value)) ui.pushLog(`出售 ${getItem(selected.value)?.name} ×${qty.value}`, 'info')
}

// ── 穿戴装备界面（§5.1）──
const SLOT_NAMES = { weapon: '武器', helmet: '头盔', body: '身体', legs: '腿部', boots: '脚部', offhand: '副手', amulet: '饰品1', ring: '饰品2' }
const equipList = computed(() =>
  sortList(Object.entries(player.inventory).filter(([id]) => getItem(id)?.type === 'equipment'))
)
function wearFromBag(id) {
  if (player.equip(id)) ui.pushLog(`穿戴了 ${getItem(id)?.name}`, 'gain')
}
function unequipSlot(slot) {
  if (player.unequip(slot)) ui.pushLog(`卸下 ${getItem(player.equipment[slot])?.name ?? ''}`, 'info')
}
// 强化（§13）：每级 +10% 属性，上限 5 级（与右侧状态弹窗一致）
function upgradeCostFor(id) { return player.upgradeCost(id) }
function doUpgrade(id) {
  const r = player.upgradeItem(id)
  ui.pushLog(r.ok ? `⚒️ ${getItem(id)?.name} 强化到 +${r.level}` : r.msg ?? '强化失败', r.ok ? 'gain' : 'warn')
}
// 中间强化框：默认空，点击装备“强化”按钮后显示该装备强化信息
const upgradeTarget = ref(null)
function setUpgradeTarget(id) { upgradeTarget.value = id }

</script>

<template>
  <div class="modal-backdrop" @click.self="ui.toggleBagModal(false)">
    <div class="modal bag-modal">
      <header class="modal-head">
        <h3>背包 / 仓库</h3>
        <button class="btn btn-sm" @click="ui.toggleBagModal(false)">✕</button>
      </header>

      <div class="region-tabs">
        <button class="btn btn-sm" :class="{ 'btn-primary': tab === 'bag' }" @click="tab = 'bag'; selected = null">🧺 厨藏（{{ player.inventorySlotsUsed }}/{{ player.inventoryCap }} 格）</button>
        <button class="btn btn-sm" :class="{ 'btn-primary': tab === 'bank' }" @click="tab = 'bank'; selected = null">📦 仓库（{{ player.bankSlotsUsed }}/{{ player.bankCap }} 格）</button>
        <select v-model="sortBy" class="plot-select" style="margin-left: auto; width: auto">
          <option v-for="o in SORT_OPTIONS" :key="o.id" :value="o.id">{{ o.name }}</option>
        </select>
      </div>

      <div class="bag-body">
        <!-- 厨藏（格子区，点击选中） -->
        <div v-if="tab === 'bag'" class="item-grid bag-grid">
          <div
            v-for="[id, qty2] in bagList"
            :key="id"
            class="item-cell"
            :class="{ pinned: selected === id }"
            @click="select(id)"
          >
            <div class="item-cell-head">
              <img v-if="itemImage(id)" :src="itemImage(id)" class="item-img item-img-sm" @error="$event.target.style.display = 'none'" alt="" />
              <span class="item-cell-name">{{ getItem(id)?.name }}</span>
            </div>
            <div class="item-cell-sub">
              <span class="mono">×{{ qty2 }}</span>
              <span v-if="spoilLeft(id)" class="spoil-note">⚠</span>
            </div>
          </div>
          <p v-if="!bagList.length" class="dim" style="grid-column: 1 / -1">厨藏空空如也</p>
        </div>

        <div v-else class="item-grid bag-grid">
          <div
            v-for="[id, qty2] in bankList"
            :key="id"
            class="item-cell"
            :class="{ pinned: selected === id }"
            @click="select(id)"
          >
            <div class="item-cell-head">
              <img v-if="itemImage(id)" :src="itemImage(id)" class="item-img item-img-sm" @error="$event.target.style.display = 'none'" alt="" />
              <span class="item-cell-name">{{ getItem(id)?.name }}</span>
            </div>
            <div class="item-cell-sub">
              <span class="mono">×{{ qty2 }}</span>
            </div>
          </div>
          <p v-if="!bankList.length" class="dim" style="grid-column: 1 / -1">仓库空空如也（背包物品可存入）</p>
        </div>

        <!-- 右：选中物品详情 + 来源 -->
        <div class="bag-detail">
          <template v-if="selected">
            <div class="tooltip-title">{{ getItem(selected)?.name }} <span class="mono">×{{ tab === 'bag' ? player.inventory[selected] ?? 0 : player.bank[selected] ?? 0 }}</span></div>
            <div v-if="spoilLeft(selected)" class="bag-detail-line warn-text">⚠ {{ spoilLeft(selected) }}</div>
            <table class="target-table item-detail-table">
              <tbody>
                <tr v-for="[label, value] in itemDetailLines(selected)" :key="label">
                  <td class="dim" style="width: 84px; white-space: nowrap">{{ label }}</td>
                  <td>{{ value }}</td>
                </tr>
              </tbody>
            </table>
            <div class="bag-detail-src">
              <span class="dim">获取来源：</span>
              <div v-for="(s, i) in itemSources(selected)" :key="i" class="bag-detail-src-item">· {{ s }}</div>
              <div v-if="!itemSources(selected).length" class="dim">（游戏中探索获取）</div>
            </div>
          </template>
          <p v-else class="dim">点击左侧物品查看详情与来源</p>
        </div>
      </div>

      <!-- 底部固定操作栏（容量扩展旁） -->
      <div class="bag-actions">
        <span class="dim bag-cap-note">容量扩展：杂货铺购买（背包 20→100 格，仓库 100→500 格）</span>
        <template v-if="selected">
          <span class="bag-qty-label mono">×{{ qty }}</span>
          <input
            class="bag-qty-input"
            type="range"
            min="1"
            :max="Math.max(1, maxQty)"
            v-model.number="qty"
          />
          <input class="bag-qty-num" type="number" min="1" :max="maxQty" :value="qty" @change="setQty($event.target.value)" />
          <template v-if="tab === 'bag'">
            <button class="btn btn-sm" @click="doSell">卖 {{ qty }}</button>
            <button class="btn btn-sm btn-primary" @click="doMoveToBank">存入</button>
          </template>
          <button v-else class="btn btn-sm btn-primary" @click="doMoveToInventory">取出 {{ qty }}</button>
        </template>
        <span v-else class="dim">（点击物品后可调整数量并操作）</span>
      </div>
    </div>
  </div>
</template>
