<script setup>
// 制作类技能视图 — 需求文档 §3.2：食谱列表 / 材料需求 / 成功率 / 制作按钮
// 烘焙：能量饼干使用（离线加成 §8.1）；厨具锻造：成品可直接穿戴（§5.1）
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem, ITEMS } from '../game/data/items.js'
import { CATEGORY_LABEL } from '../game/data/itemDetail.js'
import { itemImage } from '../game/data/itemImage.js'
import QuantityModal from '../components/QuantityModal.vue'
import ItemImg from '../components/ItemImg.vue'
import RecipeTreeModal from '../components/RecipeTreeModal.vue'

const props = defineProps({
  instance: { type: Object, required: true },
})
const player = usePlayerStore()
const ui = useUiStore()

// 用 computed 而非常量：组件在制作类技能间复用时（烹饪→烘焙→锻造）需响应式跟随 props.instance
const isBaking = computed(() => props.instance.id === 'baking')
const isSmithing = computed(() => props.instance.id === 'craftsmithing')
const isPreservation = computed(() => props.instance.id === 'preservation')

// 保鲜预览：列出所有需要保鲜（带 spoilMs）的食材，用于决定使用保鲜剂（仅保鲜技能）
const showSpoilPreview = ref(false)
const spoilList = computed(() => {
  return Object.values(ITEMS)
    .filter((it) => it.spoilMs != null)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh'))
})
function openSpoilPreview() { showSpoilPreview.value = true }
function closeSpoilPreview() { showSpoilPreview.value = false }

// ── 冷库（§5.4 冻结腐坏倒计时）──
const showColdStore = ref(false)
const coldSelected = ref(null) // 左：已存入冷库的选中项
const depSelected = ref(null) // 右：背包可放入的选中项
const coldList = computed(() =>
  Object.entries(player.coldStorage || {})
    .map(([id, c]) => ({ id, ...c, item: getItem(id) }))
    .filter((c) => c.qty > 0)
    .sort((a, b) => (a.item?.name ?? '').localeCompare(b.item?.name ?? '', 'zh'))
)
const depositableList = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.spoilMs)
    .map(([id, qty]) => ({ id, qty, item: getItem(id) }))
    .sort((a, b) => (a.item?.name ?? '').localeCompare(b.item?.name ?? '', 'zh'))
)
function openColdStore() { showColdStore.value = true; coldSelected.value = null; depSelected.value = null }
function closeColdStore() { showColdStore.value = false }
function selectCold(id) { coldSelected.value = coldSelected.value === id ? null : id; depSelected.value = null }
function selectDep(id) { depSelected.value = depSelected.value === id ? null : id; coldSelected.value = null }
function coldMaxQty() {
  if (coldSelected.value) return player.coldStorage[coldSelected.value]?.qty ?? 0
  if (depSelected.value) return player.inventory[depSelected.value] ?? 0
  return 0
}
// 全部取出（qty=null 表示该物全部数量）
function doWithdraw() {
  const id = coldSelected.value
  if (!id) return
  const q = player.coldStorage[id]?.qty ?? 0
  if (player.withdrawFromColdStorage(id, null)) ui.pushLog(`取出：${getItem(id)?.name} ×${q}（腐坏继续）`, 'info')
  coldSelected.value = null
}
// 全部冻存（qty=null 表示背包该物全部数量）
function doDeposit() {
  const id = depSelected.value
  if (!id) return
  const q = player.inventory[id] ?? 0
  if (player.depositToColdStorage(id, null)) ui.pushLog(`❄️ 冻存：${getItem(id)?.name} ×${q}（腐坏暂停）`, 'info')
  depSelected.value = null
}
function doDepositAll() {
  const n = player.depositAllToColdStorage()
  ui.pushLog(n ? `❄️ 已冻存 ${n} 种腐坏食材` : '背包没有可冻存的腐坏食材（或冷库已满）', n ? 'info' : 'warn')
}
// 冷库冻结状态：显示剩余腐坏时长（冻结期间不消耗）
function coldRemain(c) {
  const h = Math.max(1, Math.ceil((c.remainMs ?? 0) / 3600000))
  return `❄️ 冻结 · ${h}h 后腐坏`
}
// 背包腐坏食材剩余倒计时
function spoilRemain(id) {
  const until = player.spoilage[id]
  if (!until) return ''
  const h = Math.ceil((until - Date.now()) / 3600000)
  return h > 0 ? `⚠ ${h}h 后腐坏` : '⚠ 已腐坏'
}
// 冷库容量扩充（§5.4：每次 +1 格花 1000 金币，上限 100）
const COLD_EXPAND_COST = 1000
function doExpandCold() {
  const r = player.expandColdStorage()
  ui.pushLog(r.ok ? `❄️ ${r.msg}` : r.msg, r.ok ? 'info' : 'warn')
}

// 装备槽位中文（锻造页按八槽位分类）
const SLOT_LABEL = { weapon: '武器', offhand: '副手', body: '身体', helmet: '头盔', amulet: '饰品1', ring: '饰品2', legs: '腿部', boots: '脚部' }
const STAT_LABEL = { attack: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', hpBonus: '品鉴值', speedBonus: '攻速' }
const BUFF_LABEL = { atk: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', speed: '攻速', duration: '持续' }

// 成品效果摘要（返回标签数组，模板渲染为一组小圆角标签；无效果显示「原料」）
function outputEffect(itemId) {
  const it = getItem(itemId)
  if (!it) return ['—']
  const parts = []
  if (it.type === 'food') {
    // 料理：统一显示回血（0 也显示）
    parts.push(it.heal ? `回血 ${it.heal}` : '回血 0')
    if (it.regen) parts.push(`持续回血 ${it.regen.perTurn}×${it.regen.turns}`)
  } else if (it.type === 'drink') {
    if (it.heal) parts.push(`回血 ${it.heal}`)
    if (it.flavorEnergy) parts.push(`调味能量 +${it.flavorEnergy}`)
    if (it.buff) {
      for (const [k, v] of Object.entries(it.buff)) {
        if (k !== 'duration') parts.push(`${BUFF_LABEL[k] ?? k} +${v}`)
      }
    }
    if (it.drunk) parts.push('醉酒 -50% 攻速')
  } else if (it.type === 'equipment' && it.stats) {
    for (const [k, v] of Object.entries(it.stats)) parts.push(`${STAT_LABEL[k] ?? k} +${v}`)
  } else if (it.buff) {
    for (const [k, v] of Object.entries(it.buff)) {
      if (k !== 'duration') parts.push(`${BUFF_LABEL[k] ?? k} +${v}`)
    }
  } else if (it.use?.refreshSpoilMs) {
    parts.push(`保鲜 ${Math.round(it.use.refreshSpoilMs / 3600000)} 小时`)
  } else if (it.use?.buffXp) {
    parts.push(`经验 ×${it.use.buffXp.mult}（${it.use.buffXp.minutes} 分钟）`)
  } else if (it.use?.buffYield) {
    parts.push(`产量 ×${it.use.buffYield.mult}（${it.use.buffYield.minutes} 分钟）`)
  } else if (it.offlineBonusH) {
    parts.push(`离线时长 +${it.offlineBonusH} 小时`)
  } else if (it.spoilMs) {
    parts.push(`腐坏 ${it.spoilMs / 3600000} 小时`)
  }
  return parts.length ? parts : ['原料']
}

// 分类：装备按八槽位，其余按食谱分类
function recipeCategory(r) {
  const it = getItem(r.output.itemId)
  if (it?.type === 'equipment' && it.slot) return SLOT_LABEL[it.slot] ?? r.category
  return CATEGORY_LABEL[r.category] ?? r.category
}

function have(itemId) {
  return player.inventory[itemId] ?? 0
}
function need(itemId, qty) {
  return qty
}
function canAfford(recipe) {
  return props.instance.canCraft(recipe)
}
/** 材料能支撑的最大制作次数（上限 50） */
function maxCraft(recipe) {
  let n = 50
  for (const [itemId, qty] of Object.entries(recipe.ingredients)) {
    n = Math.min(n, Math.floor((player.inventory[itemId] ?? 0) / qty))
  }
  return Math.max(0, n)
}
const craftTarget = ref(null) // 待制作配方（弹出数量选择）
function openCraft(r) {
  if (!canAfford(r)) return
  craftTarget.value = r
}
function doCraftBatch(n) {
  if (!craftTarget.value) return
  const r = craftTarget.value
  let ok = 0
  for (let i = 0; i < n; i++) {
    const res = props.instance.craft(r)
    if (res === 'denied') break
    if (res === 'ok') ok++
  }
  if (ok > 0) ui.pushLog(`制作 ${getItem(r.output.itemId)?.name} ×${ok}`, 'info')
}
function useBiscuit() {
  const ok = player.consumeEnergyBiscuit()
  ui.pushLog(ok ? `使用能量饼干：离线时长上限 +4h（当前 +${player.offlineBonusH}h/12h）` : '能量饼干不足或已达上限', ok ? 'info' : 'warn')
}

// ── 制作队列（2026-09-06）：排队自动连续制作，每 3 秒 1 份 ──
const queueList = computed(() =>
  (props.instance.craftQueue ?? []).map((e) => ({
    ...e,
    recipe: props.instance.recipes.find((r) => r.id === e.recipeId),
  }))
)
function queueAdd(r, qty) {
  const res = props.instance.enqueue(r, qty)
  if (res.ok) ui.pushLog(`「${r.name}」×${qty} 已加入制作队列（每 3 秒自动制作 1 次）`, 'info')
  else if (res.reason === 'full') ui.pushLog('制作队列已满（最多 8 项，相同配方自动合并）', 'warn')
}

// ── 配方导航树（2026-09-06）──
const treeRecipe = ref(null)
function openTree(r) {
  treeRecipe.value = { ...r, skillId: props.instance.id }
}
const flashCard = ref(null) // { recipeId }：跳转后高亮闪烁
function sectionLabelOf(reqLevel) {
  const start = Math.floor((reqLevel - 1) / 5) * 5 + 1
  return `${start}-${start + 4}`
}
function goTree(nav) {
  const target = treeRecipe.value
  treeRecipe.value = null
  if (!target || !nav) return
  if (nav.type === 'craft') {
    if (nav.skillId === props.instance.id) {
      // 同技能：「去做」= 展开目标配方所在等级段 + 滚动到该卡 + 闪烁高亮
      const sec = sectionLabelOf(nav.reqLevel ?? target.reqLevel)
      if (!isOpen(sec)) toggleSection(sec)
      scrollToSection(sec)
      flashCard.value = { recipeId: nav.recipeId }
      setTimeout(() => { flashCard.value = null }, 1800)
    } else {
      player.setActiveSkill(nav.skillId)
      ui.setView('skill')
    }
  } else if (nav.type === 'gather') {
    // 去采集：切换到对应采集技能并选中该材料目标
    if (!player.skillTargets) player.skillTargets = {}
    player.skillTargets[nav.skillId] = nav.targetId
    player.setActiveSkill(nav.skillId)
    ui.setView('skill')
  } else if (nav.type === 'farming') {
    player.setActiveSkill('farming')
    ui.setView('skill')
  } else if (nav.type === 'shop') {
    ui.setView('shop')
  }
}

// ── 卡片式分段（按 reqLevel 每 5 级一段，可折叠）──
const sections = computed(() => {
  const map = new Map()
  for (const r of props.instance.recipes) {
    const start = Math.floor((r.reqLevel - 1) / 5) * 5 + 1
    const label = `${start}-${start + 4}`
    if (!map.has(label)) map.set(label, [])
    map.get(label).push(r)
  }
  return [...map.entries()].map(([label, list]) => ({ label, list }))
})
const collapsed = ref(new Set(sections.value.map((s) => s.label))) // 默认全部折叠(等级段)
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
</script>

<template>
  <div>
    <div class="card status-line">
      <span class="dim">共 {{ instance.recipes.length }} 个食谱 · 制作失败消耗材料但获得半额经验 · 成功率随等级提升<template v-if="isPreservation"> · 保鲜 Lv 越高腐坏越慢（每级 +2%，封顶 +100%）</template></span>
      <template v-if="isPreservation">
        <button
          class="btn btn-sm cold-store-btn"
          @click="openColdStore"
        >🧊 冷库</button>
        <button
          class="btn btn-sm spoil-preview-btn"
          @click="openSpoilPreview"
        >🔍 保鲜预览</button>
      </template>
      <!-- 烘焙：能量饼干（放到本框最右侧） -->
      <div v-if="isBaking" class="biscuit-inline" style="margin-left: auto">
        <strong>能量饼干（离线加成）：</strong>
        <span>持有 <span class="mono">{{ player.inventory.energyBiscuit ?? 0 }}</span> 个</span>
        <span class="dim">当前离线时长上限 12h + {{ player.offlineBonusH }}h（最多 +12h）</span>
        <button class="btn btn-sm btn-primary" :disabled="!(player.inventory.energyBiscuit ?? 0) || player.offlineBonusH >= 12" @click="useBiscuit()">
          使用
        </button>
      </div>
    </div>

    <!-- 保鲜预览弹窗：列出需要保鲜的食材 -->
    <div v-if="showSpoilPreview" class="modal-backdrop" @click.self="closeSpoilPreview">
      <div class="modal spoil-modal">
        <div class="modal-head">
          <h3>保鲜预览</h3>
          <button class="btn btn-sm" @click="closeSpoilPreview">✕</button>
        </div>
        <p class="dim" style="margin-bottom: 10px">以下 {{ spoilList.length }} 种荤食会腐坏（越高级越耐放），用保鲜剂可刷新腐坏计时：</p>
        <div class="spoil-list">
          <div v-for="it in spoilList" :key="it.id" class="spoil-item">
            <ItemImg :item-id="it.id" size="sm" />
            <span class="spoil-name">{{ it.name }}</span>
            <span class="dim spoil-cat">{{ it.category }}</span>
            <span class="dim spoil-note">{{ Math.round(it.spoilMs / 3600000) }}h 腐坏</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 冷库弹窗：左=已存入（冻结腐坏），右=背包可放入的腐坏食材 -->
    <div v-if="showColdStore" class="modal-backdrop" @click.self="closeColdStore">
      <div class="modal cold-modal">
        <div class="modal-head">
          <h3>🧊 冷库</h3>
          <button class="btn btn-sm" @click="closeColdStore">✕</button>
        </div>
        <div class="cold-cap-row">
          <span class="dim">冷库容量 <span class="mono">{{ player.coldStorageSlotsUsed }}/{{ player.coldStorageCap }}</span></span>
          <button class="btn btn-sm btn-primary" :disabled="player.coldStorageCap >= 100 || player.gold < COLD_EXPAND_COST" @click="doExpandCold">扩一格（{{ COLD_EXPAND_COST }} 金币）</button>
          <span class="dim" v-if="player.coldStorageCap < 100">最大 100 格</span>
        </div>
        <p class="dim cold-tip">存入即冻结腐坏，取出继续计时；保鲜 Lv 越高腐坏越慢（+2%/级，封顶 +100%）。保鲜剂会刷新背包食材并给冷库续时。</p>
        <div class="cold-body">
          <!-- 左：已存入冷库 -->
          <div class="cold-pane">
            <div class="cold-pane-head"><strong>已存入冷库</strong><span class="dim">（{{ coldList.length }} 种）</span></div>
            <div class="item-grid cold-grid">
              <div v-for="c in coldList" :key="c.id" class="item-cell" :class="{ pinned: coldSelected === c.id }" @click="selectCold(c.id)">
                <div class="item-cell-head">
                  <ItemImg :item-id="c.id" size="sm" />
                  <span class="item-cell-name">{{ c.item?.name }}</span>
                </div>
                <div class="item-cell-sub">
                  <span class="mono">×{{ c.qty }}</span>
                  <span class="spoil-note">❄️ 冻结</span>
                </div>
              </div>
              <p v-if="!coldList.length" class="dim cold-empty">冷库空空如也</p>
            </div>
          </div>
          <!-- 右：背包可放入 -->
          <div class="cold-pane">
            <div class="cold-pane-head"><strong>背包可放入</strong><span class="dim">（{{ depositableList.length }} 种）</span></div>
            <div class="item-grid cold-grid">
              <div v-for="d in depositableList" :key="d.id" class="item-cell" :class="{ pinned: depSelected === d.id }" @click="selectDep(d.id)">
                <div class="item-cell-head">
                  <ItemImg :item-id="d.id" size="sm" />
                  <span class="item-cell-name">{{ d.item?.name }}</span>
                </div>
                <div class="item-cell-sub">
                  <span class="mono">×{{ d.qty }}</span>
                  <span v-if="spoilRemain(d.id)" class="spoil-note">{{ spoilRemain(d.id) }}</span>
                </div>
              </div>
              <p v-if="!depositableList.length" class="dim cold-empty">背包中没有会腐坏的食材</p>
            </div>
          </div>
        </div>
        <!-- 底部操作 -->
        <div class="bag-actions">
          <template v-if="coldSelected">
            <button class="btn btn-sm btn-primary" @click="doWithdraw">全部取出（{{ player.coldStorage[coldSelected]?.qty ?? 0 }}）</button>
            <span class="dim cold-detail">{{ getItem(coldSelected)?.name }} ×{{ player.coldStorage[coldSelected]?.qty ?? 0 }} · {{ coldRemain(player.coldStorage[coldSelected]) }}</span>
          </template>
          <template v-else-if="depSelected">
            <button class="btn btn-sm btn-primary" @click="doDeposit">全部冻存（{{ player.inventory[depSelected] ?? 0 }}）</button>
            <span class="dim cold-detail">{{ getItem(depSelected)?.name }} ×{{ player.inventory[depSelected] ?? 0 }} · {{ spoilRemain(depSelected) }}</span>
          </template>
          <span v-else class="dim">（点击左侧已存食材可全部取出，点击右侧背包食材可全部冻存）</span>
          <button class="btn btn-sm cold-all-frozen" @click="doDepositAll">🍱 一键冻存全部</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>{{ isSmithing ? '锻造配方' : isPreservation ? '保鲜配方' : '食谱' }}（按等级分段，点击段标题折叠）</h3>
      <div v-if="sections.length > 1" class="quick-nav">
        <span class="dim" style="font-size: 12px">快速跳转：</span>
        <button v-for="sec in sections" :key="sec.label" class="btn btn-sm" @click="scrollToSection(sec.label)">{{ sec.label }}</button>
      </div>

      <!-- 制作队列：排队自动制作（材料不足自动暂停，补料后恢复） -->
      <div v-if="queueList.length" class="card queue-card">
        <div class="queue-head">
          <strong>⚙️ 制作队列</strong>
          <span class="dim">每 3 秒自动制作 1 次 · 最多 8 项</span>
          <div style="margin-left: auto; display: flex; gap: 8px">
            <button class="btn btn-sm" :disabled="!(instance.craftQueue?.[0]?.paused)" @click="instance.resumeQueue()">▶ 恢复队头</button>
            <button class="btn btn-sm" @click="instance.clearQueue()">清空</button>
          </div>
        </div>
        <div class="queue-list">
          <div v-for="(e, i) in queueList" :key="i" class="queue-item">
            <span class="queue-name">{{ e.recipe?.name ?? e.recipeId }}</span>
            <span class="mono">×{{ e.qty }}</span>
            <span v-if="e.paused" class="queue-paused">⚠ 材料不足，暂停中</span>
            <button class="btn btn-sm queue-rm" @click="instance.removeQueueEntry(i)">移除</button>
          </div>
        </div>
      </div>
      <div v-for="sec in sections" :key="sec.label" class="gather-section" :id="'sec-' + sec.label">
        <div class="gather-section-title" @click="toggleSection(sec.label)">
          <span class="mono">{{ isOpen(sec.label) ? '▾' : '▸' }}</span>
          <strong>Lv {{ sec.label }}</strong>
          <span class="dim">{{ sec.list.length }} 个配方</span>
          <span v-if="sec.list.some((r) => maxCraft(r) > 0 && canAfford(r))" class="badge badge-on">可制作</span>
        </div>
        <div v-if="isOpen(sec.label)" class="gather-grid recipe-grid">
          <div
            v-for="r in sec.list"
            :key="r.id"
            v-tilt
            class="gather-card"
            :class="{ locked: player.skillState(instance.id).level < r.reqLevel, flash: flashCard?.recipeId === r.id }"
          >
            <div class="gather-card-head">
              <ItemImg :item-id="r.output.itemId" />
              <div>
                <strong>{{ r.name }}</strong>
                <div class="dim" style="font-size: 11px">{{ recipeCategory(r) }} · Lv {{ r.reqLevel }}</div>
              </div>
            </div>
            <div class="gather-card-row effect-row">
              <span class="effect-label">效果</span>
              <span class="effect-tags">
                <span v-for="(t, i) in outputEffect(r.output.itemId)" :key="i" class="effect-chip">{{ t }}</span>
              </span>
            </div>
            <div class="ing-cell gather-card-ing">
              <span
                v-for="(qty, itemId) in r.ingredients"
                :key="itemId"
                class="ing"
                :class="{ lacking: have(itemId) < qty }"
              >
                {{ getItem(itemId)?.name }} <span class="mono">{{ have(itemId) }}/{{ need(itemId, qty) }}</span>
              </span>
            </div>
            <div class="recipe-action">
              <div class="gather-card-row">
                <span>成功率</span>
                <span class="mono">{{ (instance.successChance(r) * 100).toFixed(0) }}%</span>
              </div>
              <div class="queue-btns">
                <button class="btn btn-sm" :disabled="player.skillState(instance.id).level < r.reqLevel" @click="queueAdd(r, 1)" title="加入制作队列 ×1（每 3 秒 1 份，材料不足自动暂停）">⏳×1</button>
                <button class="btn btn-sm" :disabled="player.skillState(instance.id).level < r.reqLevel" @click="queueAdd(r, 10)" title="加入制作队列 ×10（材料不足自动暂停）">⏳×10</button>
                <button class="btn btn-sm" @click="openTree(r)" title="展开配方材料链（来源/持有/跳转）">🌳</button>
                <button class="btn btn-sm btn-primary" :disabled="!canAfford(r) || maxCraft(r) <= 0" @click="openCraft(r)">
                  {{ player.skillState(instance.id).level < r.reqLevel ? `Lv${r.reqLevel} 解锁` : maxCraft(r) > 0 ? '制作' : '材料不足' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 制作数量选择弹窗 -->
    <QuantityModal
      :show="!!craftTarget"
      :title="craftTarget ? `制作 ${craftTarget.name}` : ''"
      :max="craftTarget ? maxCraft(craftTarget) : 1"
      @close="craftTarget = null"
      @confirm="doCraftBatch"
    />
    <RecipeTreeModal v-if="treeRecipe" :recipe="treeRecipe" :player="player" @close="treeRecipe = null" @jump="goTree" />
  </div>
</template>

<style scoped>
/* 制作队列（2026-09-06） */
.queue-card { margin-bottom: 12px; }
.queue-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.queue-list { display: flex; flex-direction: column; gap: 6px; }
.queue-item {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 10px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: rgba(255, 252, 246, 0.7);
}
.queue-item .queue-name { font-weight: 600; }
.queue-item .queue-paused { color: var(--bad-strong); font-size: 12px; font-weight: 700; }
.queue-rm { margin-left: auto; }
.queue-btns { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
/* 配方树「去做」后的卡片高亮闪烁 */
@keyframes recipeFlash {
  0%, 100% { box-shadow: 0 0 0 rgba(217, 138, 43, 0); }
  50% { box-shadow: 0 0 20px rgba(217, 138, 43, 0.85); }
}
.gather-card.flash { animation: recipeFlash 0.8s ease-in-out 2; }
</style>
