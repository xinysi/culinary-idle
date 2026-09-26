<script setup>
// 餐厅经营 — 需求文档 §13（可选扩展）
// 放置经营：菜单放上已制作的料理 → 每小时自动赚金币（离线也赚，80% 效率）
// 2026-09-23：页首加「店铺实景」（components/RestaurantScene.vue）——只读 store 把挂机状态画成 2D 店铺，
//             点店里的食客 = 交付订单，不新增任何数值与存档字段。
// 🔴 排版纪律：**同一信息只出现一次**。实景已经画了菜单/食客/评论家/装潢，所以原来那三块
//    「菜单 6 个通栏下拉(384px) + 食客订单卡片 + 装潢说明卡片」全部退场，只留
//    ① 实景（氛围与点选）② 经营台（菜单与装潢的编辑入口）③ 评论家提交（要挑菜，没法在实景里一键完成）。
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'
import { guestPortrait } from '../game/data/restaurantFaces.js'
import { RESTAURANT_DECOR_BY_ID, DECOR_TOTAL, nextDecorPick } from '../game/data/restaurantDecor.js'
import { catLabel, MAX_ORDERS } from '../game/data/restaurantOrders.js'
import { REGULARS } from '../game/data/regulars.js'
import RestaurantScene from '../components/RestaurantScene.vue'

const player = usePlayerStore()
const ui = useUiStore()

// ── 食客订单（2026-09-06）：1 秒刷新剩余时间（实景里的耐心条也读这个 nowMs）──
const nowMs = ref(Date.now())
let timerId = null
onMounted(() => {
  timerId = setInterval(() => { nowMs.value = Date.now() }, 1000)
})
onUnmounted(() => { if (timerId) clearInterval(timerId) })

// 实景里点「雅座」的评论家 → 滚到下方那张卡片（要提交料理得挑一道，所以不直接在实景里结算）
const criticCard = ref(null)
function scrollToCritic() {
  criticCard.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
// ── 到店食客（画外的数字面板）：画面里只有人 + 头顶的菜图，数字与按钮在这里 ──
const orderRows = computed(() => {
  const slots = player.restaurantSlots ?? 0
  return (player.orders?.list ?? []).map((o, i) => ({
    ...o,
    waiting: i >= slots,                       // 坐不下 ⇒ 门口等位
    enough: (player.inventory?.[o.itemId] ?? 0) >= o.qty,
    remainMin: Math.max(0, Math.ceil((o.expireAt - nowMs.value) / 60000)),
  }))
})
function deliver(o) {
  const r = player.finishOrder(o.id)
  if (r?.ok) ui.pushLog(`🍽 食客「${r.name}」满意而归：+${r.reward} 金币`, 'gain')
  else ui.pushLog(r?.msg ?? '交付失败', 'warn')
}

// ── 客流状态（从实景挪上来）：下一波食客 + 常客，两条挨在一起，视线不用来回跳 ──
const regularMet = computed(() => REGULARS.filter((r) => player.regularUnlocked?.(r.id)).length)
const regularFull = computed(() => regularMet.value >= REGULARS.length)
const nextGuest = computed(() => {
  const list = player.orders?.list ?? []
  if (list.length >= MAX_ORDERS) return '店里已坐满——先给客人上菜'
  const at = player.orders?.nextAt ?? 0
  if (!at) return '随时可能有食客到访'
  const min = Math.ceil((at - nowMs.value) / 60000)
  return min <= 0 ? '食客正在路上' : `下一波食客约 ${min} 分钟`
})

// ── 美食评论家（2026-09-09）：高要求食客 ──
const critic = computed(() => player.criticState().order)
const criticRemainMin = computed(() => (critic.value ? Math.max(0, Math.ceil((critic.value.expireAt - nowMs.value) / 60000)) : 0))
const criticPick = ref(null)
const criticCandidates = computed(() => {
  const o = critic.value
  if (!o) return []
  return Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.type === 'food' && getItem(id).category === o.category && (getItem(id).tier ?? 0) >= o.minTier)
    .map(([id, q]) => ({ id, qty: q, item: getItem(id) }))
    .sort((a, b) => (b.item.tier ?? 0) - (a.item.tier ?? 0))
})
function serveCriticNow() {
  if (!criticPick.value) { ui.pushLog('请先选择一道符合要求的料理', 'warn'); return }
  const r = player.serveCritic(criticPick.value)
  if (!r.ok) ui.pushLog(r.msg ?? '提交失败', 'warn')
  else criticPick.value = null
}

// 装饰（§13）已独立成页（views/DecorView.vue）：本页只保留总加成数字与入口
const decorTotalBonus = computed(() => {
  let s = 0
  for (const id of player.restaurant.decor ?? []) s += RESTAURANT_DECOR_BY_ID[id]?.effect ?? 0
  return +s.toFixed(1)
})
const decorCount = computed(() => (player.restaurant.decor ?? []).length)
const menuCount = computed(() => (player.restaurant.menu ?? []).filter(Boolean).length)
const menuFull = computed(() => menuCount.value >= player.restaurantSlots)

/** 金币一律整数 + 千分位：金币没有小数，`48139.7` 这种显示只会让人以为是别的量纲 */
const gold = (v) => Math.round(v ?? 0).toLocaleString()

// ── 菜单：菜图 chips + 点一下换菜（原来是 6 个通栏下拉，是页面上最重的块）──
const pickSlot = ref(-1)                 // 正在换哪个菜单位（-1 = 没在换）
const dishOf = (i) => player.restaurant.menu?.[i] ?? null
function togglePick(i) { pickSlot.value = pickSlot.value === i ? -1 : i }
/** 把某道菜放进「正在换的那个菜单位」；传 null = 清空这个菜单位 */
function chooseDish(id) {
  if (pickSlot.value < 0) return
  setMenu(pickSlot.value, id)
  pickSlot.value = -1
}
/** 候选：背包里有的料理；已经占了别的菜单位的标成「已在菜单上」 */
const pickCandidates = computed(() =>
  ownedFoods.value.map((f) => ({
    ...f,
    taken: player.restaurant.menu.includes(f.id) && player.restaurant.menu[pickSlot.value] !== f.id,
  })),
)

/** 装潢卡：下一件买什么、加多少（口径与装潢页的「下一件推荐」同一份） */
const nextDecor = computed(() => nextDecorPick(player.restaurant.decor ?? [], player.gold))
/** 已购装潢的图标（最多 14 个 + 「+N」）—— 用户要求「道具栏要有图标预览」 */
const decorIcons = computed(() => {
  const best = {}
  for (const id of player.restaurant.decor ?? []) {
    const d = RESTAURANT_DECOR_BY_ID[id]
    if (!d) continue
    if (!best[d.category] || (d.effect ?? 0) > (best[d.category].effect ?? 0)) best[d.category] = d
  }
  return Object.values(best).slice(0, 14).map((d) => {
    const nm = String(d.name ?? '')
    const sp = nm.indexOf(' ')
    return { id: d.id, emoji: sp > 0 ? nm.slice(0, sp) : '🏮', label: sp > 0 ? nm.slice(sp + 1) : nm, effect: d.effect ?? 0 }
  })
})

const ownedFoods = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.type === 'food')
    .map(([id]) => ({ id, item: getItem(id) }))
    .sort((a, b) => b.item.value - a.item.value)
)

function setMenu(i, dishId) {
  player.setRestaurantMenu(i, dishId)
}
function upgradeCost() {
  return 150 * player.restaurant.level * player.restaurant.level
}
function hourlyOf(dishId) {
  const item = getItem(dishId)
  if (!item) return 0
  return (item.value + (item.heal ?? 0)) * 0.5 * (1 + 0.3 * (player.restaurant.level - 1))
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🏮 我的餐厅</h2>
        <p class="dim">放置经营：挂上菜单就持续赚金币，离线也营业 · 规则见右上「📘 指南」</p>
      </div>
      <div class="skill-head-right restaurant-head-right">
        <button class="btn btn-sm btn-primary" :disabled="player.gold < upgradeCost()" @click="player.upgradeRestaurant()">
          升级餐厅（{{ gold(upgradeCost()) }} 金币）
        </button>
        <div class="restaurant-head-col">
          <div class="xp-num">等级 {{ player.restaurant.level }}</div>
          <p class="mono restaurant-income">当前收入 {{ gold(player.restaurantHourlyIncome) }} 金币/小时</p>
        </div>
      </div>
    </header>

    <!-- 店铺实景（2026-09-23）：页面的主界面 —— 墙上是菜单与装潢，桌上是食客，点食客即上菜 -->
    <RestaurantScene
      :now-ms="nowMs"
      :flow-text="nextGuest"
      :regular-text="`常客 ${regularMet}/${REGULARS.length}${regularFull ? ' · 已全结识' : ''}`"
      @focus-critic="scrollToCritic"
    />

    <!-- 到店食客（画外的面板）：画面里只画人，数字与按钮在这儿 -->
    <h3 class="restaurant-section">到店的食客<span class="dim"> · 点画里的人也能上菜</span></h3>
    <div class="card guests-card">
      <div v-if="orderRows.length" class="guest-list">
        <div v-for="o in orderRows" :key="o.id" class="guest-row">
          <img v-if="guestPortrait(o.name)" class="guest-face" :src="guestPortrait(o.name)" alt="" @error="$event.target.style.display = 'none'" loading="lazy" decoding="async" />
          <span class="guest-name">{{ o.name }}<span v-if="o.waiting" class="dim">（门口等位）</span></span>
          <span class="guest-dish">
            <img v-if="itemImage(o.itemId)" :src="itemImage(o.itemId)" alt="" @error="$event.target.style.display = 'none'" loading="lazy" decoding="async" />
            <span>{{ getItem(o.itemId)?.name }} ×{{ o.qty }}</span>
          </span>
          <span class="dim">赏金 <b class="mono">{{ gold(o.reward) }}</b> 金币</span>
          <span class="dim mono" :class="{ 'order-urgent': o.remainMin <= 10 }">⏳ {{ o.remainMin }} 分钟</span>
          <button class="btn btn-sm btn-primary guest-serve" :disabled="!o.enough" @click="deliver(o)">
            {{ o.enough ? '上菜' : '料理不足' }}
          </button>
        </div>
      </div>
      <p v-else class="dim guests-empty">
        店里暂时没有食客——把料理挂上菜单，食客就会慕名而来（约 25~45 分钟到访一次，订单 60 分钟内有效）。
      </p>
    </div>

    <!-- 经营台：左＝菜单（紧凑网格），右＝装潢入口；窄屏自动堆叠 -->
    <h3 class="restaurant-section">经营台<span class="dim"> · 菜单与装潢</span></h3>
    <div class="restaurant-ops">
      <div class="card restaurant-menu-card">
        <div class="decor-title-row">
          <h3>菜单（{{ menuCount }}/{{ player.restaurantSlots }}<template v-if="menuFull"> · 已开满</template>）</h3>
          <span v-if="menuFull" class="dim mono">升级餐厅可再解锁菜单位</span>
        </div>
        <div class="menu-chips">
          <button
            v-for="i in player.restaurantSlots"
            :key="i - 1"
            class="menu-chip"
            :class="{ 'is-open': pickSlot === i - 1, 'is-empty': !dishOf(i - 1) }"
            :title="`菜单位 ${i}：点一下换菜`"
            @click="togglePick(i - 1)"
          >
            <img v-if="dishOf(i - 1)" :src="itemImage(dishOf(i - 1))" :alt="getItem(dishOf(i - 1))?.name ?? ''" @error="$event.target.style.display = 'none'" loading="lazy" decoding="async" />
            <span v-else class="menu-chip-plus">＋</span>
            <span class="menu-chip-text">
              <span class="menu-chip-name">{{ dishOf(i - 1) ? getItem(dishOf(i - 1))?.name : '空菜单位' }}</span>
              <span v-if="dishOf(i - 1)" class="menu-chip-rate">{{ gold(hourlyOf(dishOf(i - 1))) }} 金币/小时</span>
              <span v-else class="menu-chip-rate">点一下加菜</span>
            </span>
          </button>
        </div>

        <div v-if="pickSlot >= 0" class="modal-backdrop" @click.self="pickSlot = -1">
          <div class="modal menu-modal">
            <header class="modal-head">
              <h3>换第 {{ pickSlot + 1 }} 个菜单位</h3>
              <button class="btn btn-sm" @click="pickSlot = -1">✕</button>
            </header>
            <p class="dim menu-modal-note">
              背包里有 <b>{{ pickCandidates.length }}</b> 道料理可选；同一道菜只能占一个菜单位，已占位的会置灰。
            </p>
            <div class="menu-pick-list">
              <button
                v-for="f in pickCandidates"
                :key="f.id"
                class="menu-pick-item"
                :disabled="f.taken"
                :title="f.taken ? '已经在别的菜单位上了' : `放进菜品 ${pickSlot + 1}`"
                @click="chooseDish(f.id)"
              >
                <img :src="itemImage(f.id)" alt="" @error="$event.target.style.display = 'none'" loading="lazy" decoding="async" />
                <span class="menu-pick-name">{{ f.item.name }}</span>
                <span class="menu-pick-rate mono">{{ gold(hourlyOf(f.id)) }}/时</span>
              </button>
            </div>
            <div class="menu-modal-foot">
              <button v-if="dishOf(pickSlot)" class="btn btn-sm menu-pick-clear" @click="chooseDish(null)">✕ 清空这个菜单位</button>
              <span v-else />
              <button class="btn btn-sm btn-primary" @click="pickSlot = -1">关闭</button>
            </div>
          </div>
        </div>
        <p class="dim special-note">
          点菜图换菜；同一道菜只能占一个菜单位。收入一律按<b>金币/小时</b>记。
        </p>
      </div>

      <div class="card restaurant-decor-card">
        <div class="decor-title-row">
          <h3>🏮 装潢</h3>
          <span class="dim mono">已购 {{ decorCount }}/{{ DECOR_TOTAL }}</span>
        </div>
        <p class="restaurant-decor-big mono">+{{ decorTotalBonus }}%</p>
        <p v-if="decorIcons.length" class="restaurant-decor-icons">
          <span v-for="d in decorIcons" :key="d.id" :title="`${d.label} · 收入 +${d.effect}%`">{{ d.emoji }}</span>
          <span v-if="decorCount > decorIcons.length" class="dim">+{{ decorCount - decorIcons.length }}</span>
        </p>
        <p class="dim restaurant-decor-note">直接乘在餐厅收入上：<b>收入 = 菜单基础 ×(1 + 装潢) ×其它加成</b>。</p>
        <p v-if="nextDecor" class="dim restaurant-decor-next">
          下一件：<span class="rs-next-icon">{{ String(nextDecor.name).split(' ')[0] }}</span>
          {{ String(nextDecor.name).split(' ').slice(1).join(' ') || nextDecor.name }} · 收入 +{{ nextDecor.effect }}% ·
          <b class="mono">{{ gold(nextDecor.price) }}</b> 金币
        </p>
        <button class="btn btn-sm btn-primary" @click="ui.setView('decor')">去装潢 ↗</button>
      </div>
    </div>

    <!-- 美食评论家（2026-09-09）：随机到访的高要求食客 —— 要挑一道符合要求的菜，所以提交留在这里 -->
    <div v-if="critic" ref="criticCard" class="card critic-card">
      <div class="decor-title-row">
        <h3>📝 美食评论家到访</h3>
        <span class="dim mono" :class="{ 'order-urgent': criticRemainMin <= 10 }">⏳ 还有 {{ criticRemainMin }} 分钟</span>
      </div>
      <div class="gather-card-row">
        <span><b>{{ critic.name }}</b> 想要一份 <b>{{ critic.minTier }} 档以上</b> 的 <b>{{ catLabel(critic.category) }}</b></span>
        <span class="dim">赏金 <b class="mono" style="color: var(--gold)">{{ critic.reward.toLocaleString() }}</b> 金 + 神秘调料 ×1 + 好感 +30</span>
      </div>
      <div v-if="criticCandidates.length" class="critic-row">
        <select v-model="criticPick" class="plot-select critic-select">
          <option :value="null">选择一道符合要求的料理</option>
          <option v-for="c in criticCandidates" :key="c.id" :value="c.id">{{ c.item.name }}（{{ c.item.tier }} 档）×{{ c.qty }}</option>
        </select>
        <button class="btn btn-sm btn-primary" @click="serveCriticNow()">提交</button>
      </div>
      <p v-else class="dim" style="font-size: 12px">背包中没有符合要求的料理——去做一道 <b>{{ critic.minTier }} 档以上</b> 的{{ catLabel(critic.category) }}再来。</p>
    </div>

    <!-- 页脚：全局累计（跟「每小时收入」不是一个量纲，别混在菜单标题里） -->
    <p class="dim restaurant-foot">
      开业至今累计赚取 <b class="mono">{{ gold(player.stats.restaurantTotal) }}</b> 金币 ·
      顾客好感 Lv{{ player.favorLevel() }}（每级小费 +3%）
    </p>
  </div>
</template>

<style scoped>
/* 餐厅头部右区排版（等级 / 当前收入 / 升级按钮 / 真实增幅）——右对齐分块，取消拥挤参差 */
.restaurant-head-right { display: flex; align-items: center; gap: 12px; }
.restaurant-head-col { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; }
.restaurant-head-right .xp-num { text-align: right; }
/* 当前收入：本页的权威数字（场景里不再重复写一遍） */
.restaurant-income { margin: 0; text-align: right; font-size: 15px; font-weight: 800; color: var(--text); }
/* 评论家选菜框：与其它 select 同一套外观（原来是一枚裸控件） */
.critic-select { flex: 1; max-width: 320px; }
/* 到店食客面板：一行一位（画面里只有人，数字都在这里） */
.guests-card { margin-bottom: 14px; }
.guest-list { display: flex; flex-direction: column; gap: 6px; }
.guest-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 5px 10px;
  border-radius: 10px;
  background: rgba(var(--panel-soft-rgb), 0.9);
  border: 1px solid var(--border);
}
.guest-face { width: 40px; height: 40px; object-fit: contain; }
.guest-name { font-size: 13px; font-weight: 700; color: var(--text); min-width: 96px; }
.guest-dish { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text); }
.guest-dish img { width: 26px; height: 26px; object-fit: contain; }
.guest-serve { margin-left: auto; }
.guests-empty { margin: 0; }
/* 装潢图标行 */
.restaurant-decor-icons { margin: 0; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 17px; }
/* 客流：下一波食客 + 常客并排一行（都在这里，实景里不再重复） */
/* 经营台：菜单（左，宽）+ 装潢（右，窄）；窄屏自动堆叠而不是挤压 */
.restaurant-ops {
  display: flex;
  gap: 14px;
  align-items: stretch;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.restaurant-menu-card { flex: 2 1 420px; margin-bottom: 0; }
.restaurant-decor-card {
  flex: 1 1 220px;
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.restaurant-decor-big { font-size: 26px; font-weight: 800; color: var(--gold); margin: 0; }
.restaurant-decor-note { margin: 0; line-height: 1.4; }
.restaurant-decor-card .btn { align-self: flex-start; margin-top: auto; }
/* 菜单：菜图 chips（一屏看完 6 个菜单位各自是谁），点一下展开候选换菜 */
.menu-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.menu-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 168px;
  padding: 6px 12px 6px 6px;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  background: rgba(var(--panel-soft-rgb), 0.95);
  border: 1px solid var(--border);
  transition: transform 0.12s, box-shadow 0.14s, border-color 0.14s;
}
.menu-chip:hover { transform: translateY(-1px); box-shadow: 0 5px 12px rgba(var(--primary-strong-rgb), 0.18); }
.menu-chip.is-open { border-color: var(--primary-strong); box-shadow: 0 0 0 2px rgba(var(--primary-tint-rgb), 0.26); }
.menu-chip.is-empty { border-style: dashed; }
.menu-chip img { width: 38px; height: 38px; object-fit: contain; }
.menu-chip-plus { width: 38px; height: 38px; display: grid; place-items: center; font-size: 20px; color: var(--muted); }
.menu-chip-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.menu-chip-name { font-size: 13px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.menu-chip-rate { font-size: 11px; color: var(--muted); white-space: nowrap; }
/* 候选清单（弹窗内）：菜图 + 名字 + 时收；已占位的置灰 */
.menu-pick-list { display: flex; flex-wrap: wrap; gap: 6px; }
.menu-pick-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  cursor: pointer;
  background: rgba(var(--panel-soft-rgb), 0.95);
  border: 1px solid var(--border);
  transition: transform 0.12s, box-shadow 0.14s;
}
.menu-pick-item:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(var(--primary-strong-rgb), 0.2); }
.menu-pick-item:disabled { opacity: 0.45; cursor: not-allowed; }
.menu-pick-item img { width: 26px; height: 26px; object-fit: contain; }
.menu-pick-name { font-size: 12px; color: var(--text); white-space: nowrap; }
.menu-pick-rate { font-size: 11px; color: var(--muted); }
.menu-pick-clear { color: var(--bad-strong); }
/* 换菜弹窗（项目约定：.modal-backdrop + .modal + .modal-head） */
.menu-modal { width: min(560px, 92vw); display: flex; flex-direction: column; gap: 10px; }
.menu-modal-note { margin: 0; }
.menu-modal-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 2px; }
/* 装饰标题行：标题 + 当前总加成 */
.decor-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.decor-title-row h3 { margin: 0; }
/* 装饰分类 tab */
.decor-cat-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.decor-cat-tabs .btn { white-space: nowrap; }
</style>
