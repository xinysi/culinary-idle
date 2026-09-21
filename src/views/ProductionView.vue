<script setup>
// 制作类技能视图 — 需求文档 §3.2：食谱列表 / 材料需求 / 成功率 / 制作按钮
// 烘焙：能量饼干使用（离线加成 §8.1）；厨具锻造：成品可直接穿戴（§5.1）
import { computed, ref, watch } from 'vue'
import { CAP_MAX, PAID_CAP_MAX, COLD_EXPAND_COST, OFFLINE_CAP } from '../game/data/caps.js'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem, ITEMS } from '../game/data/items.js'
import { CATEGORY_LABEL } from '../game/data/itemDetail.js'
import { itemImage } from '../game/data/itemImage.js'
import QuantityModal from '../components/QuantityModal.vue'
import ItemImg from '../components/ItemImg.vue'
import MasteryHelp from '../components/MasteryHelp.vue'
import MasteryPoolBar from '../components/MasteryPoolBar.vue'
import ProgressBar from '../components/ProgressBar.vue'
import { masteryDoubleChance, masteryXpMultiplier, masteryYieldBonus } from '../game/core/mastery.js'
import { effIngredients } from '../game/data/materialCost.js' // 材料用量唯一出口（与实际扣料同源）
import { levelEras, eraProgress, eraLabelOf, currentEraLabel } from '../game/data/levelEras.js'
import RecipeTreeModal from '../components/RecipeTreeModal.vue'
import HeatChallengeModal from '../components/HeatChallengeModal.vue'
import SidelineWorkPanel from '../components/SidelineWorkPanel.vue'
import { decorOfWoodwork } from '../game/data/woodworking.js'
import { sidelineWorkOf, SIDELINE_AXES, SIDELINE_LADDER_SKILL_IDS, SIDELINE_LADDERS } from '../game/data/sidelineWorks.js'

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
// 冷库容量扩充（§5.4：每次 +1 格花 1000 金币；金币可买到 PAID_CAP_MAX.cold，山海食经再 +10 → 硬顶 CAP_MAX.cold）
// 冷库扩容价格与上限统一来自 data/caps.js（原先这里与 player.js 各写一份，改价必漏一处）
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
  if (!parts.length) {
    // 副业产物没有 buff/use 字段，它的「效果」就是它能换来的经营侧加成：
    // 木器 → 手工装潢（餐厅收入）；陶器/织物/绣品/蜡烛 → 各自的乘区轴（v2.10.0）。
    // 数据驱动：新增副业不必再改本文件。
    const dec = decorOfWoodwork(itemId)
    const work = sidelineWorkOf(itemId)
    if (dec) parts.push(`装潢：餐厅收入 +${dec.effect}%`)
    else if (work) parts.push(`${SIDELINE_AXES[work.axis].label} ${SIDELINE_AXES[work.axis].amountLabel(work.amount)}`)
  }
  return parts.length ? parts : ['原料']
}

// 分类：装备按八槽位，其余按食谱分类
/**
 * 某配方的精通档位信息（与采集类共用 mastery.js 的口径）。
 * ⚠️ 卡片上**只显示「当前」**（等级 / 进度 / x-y 次），不显示「再 N 次到 M 级」——
 *    用户 2026-09-16 明确要求去掉那个后缀（卡片已经够密；升档规划看「📖 精通档位说明」或厨房笔记）。
 *    system_test C27 有反向断言钉住这一点，别再加回来。
 */
function masteryOf(r) {
  const prog = props.instance.masteryProgress?.(r) ?? { level: 0, current: 0, needed: 0, progress: 0 }
  return {
    level: prog.level,
    current: prog.current,
    needed: prog.needed,
    progress: prog.progress,
    xpMult: masteryXpMultiplier(prog.level),
    dbl: masteryDoubleChance(prog.level),
    batch: masteryYieldBonus(prog.level),
  }
}
function recipeCategory(r) {
  const it = getItem(r.output.itemId)
  if (it?.type === 'equipment' && it.slot) return SLOT_LABEL[it.slot] ?? r.category
  return CATEGORY_LABEL[r.category] ?? r.category
}

// ── 效率（经验/小时）与「当前最优」标记（2026-09-19，与采集页同口径）────────
// 卡片上原本只有「经验」一列，玩家要自己乘精通倍率、**还要乘成功率**（失败只得半额），
// 而成功率随等级差每级 +2% 且各配方基础值不同（0.6~0.9）⇒ 心算必错。
// 实测「择优换配方」比「蹲最低级配方」多 ×14.6~×20.7，而「跟着解锁无脑换」只拿到择优的一半到四分之三
// （锻造差 4 倍）—— 因为刚解锁的配方成功率最低，玩家却看不出来。
const bestRecipeId = computed(() => props.instance.bestUnlockedRecipe?.()?.id ?? null)
/** 非当前（队头）配方相对队头的效率提升；≤2% 不提示，免得满屏抖动数字 */
function gainVsHead(r) {
  if (!props.instance?.xpPerHour) return null
  // ⚠️ 直接读存档字段，**不要**用 `instance.craftQueue` getter —— 它在队列缺失时会**写回**
  //    `player.craftQueues[id]`，在渲染期改状态会触发 Vue 的「渲染中修改状态」告警。
  const queue = player.craftQueues?.[props.instance.id]
  const headId = Array.isArray(queue) ? queue[0]?.recipeId : null
  if (!headId || headId === r.id) return null
  const head = props.instance.recipes.find((x) => x.id === headId)
  if (!head) return null
  const a = props.instance.xpPerHour(r)
  const b = props.instance.xpPerHour(head)
  if (!(b > 0) || !(a > 0)) return null
  const g = a / b - 1
  return g > 0.02 ? g : null
}
/** 经验/小时的中文紧凑写法（亿/万） */
function fmtRate(n) {
  if (!(n > 0)) return '—'
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)} 亿/时`
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)} 万/时`
  return `${Math.round(n)}/时`
}

// 成品品质徽章（仅装备有 quality 字段 → 只在锻造卡片显示；配色与图鉴/物品详情一致）
const QUALITY_COLOR = { 普通: 'var(--muted)', 精良: 'var(--good-strong)', 稀有: 'var(--info)', 史诗: '#7b1fa2', 传说: 'var(--warn-strong)', 神话: 'var(--bad-strong)' }
const qualityOf = computed(() => {
  const m = {}
  for (const r of props.instance.recipes) {
    const q = getItem(r.output?.itemId)?.quality
    if (q) m[r.id] = { text: q, color: QUALITY_COLOR[q] ?? 'var(--muted)' }
  }
  return m
})

function have(itemId) {
  return player.inventory[itemId] ?? 0
}
function need(itemId, qty) {
  return qty
}
function canAfford(recipe) {
  return props.instance.canCraft(recipe)
}
/** 材料能支撑的最大制作次数（上限 50）——用量走 `effIngredients`（与扣料同源） */
function maxCraft(recipe) {
  let n = 50
  for (const [itemId, qty] of Object.entries(effIngredients(recipe))) {
    n = Math.min(n, Math.floor((player.inventory[itemId] ?? 0) / qty))
  }
  return Math.max(0, n)
}
const craftTarget = ref(null) // 待制作配方（弹出数量选择）
function openCraft(r) {
  if (!canAfford(r)) return
  craftTarget.value = r
}
const heatModal = ref(null) // { recipe, n }
function doCraftBatch(n) {
  if (!craftTarget.value) return
  const r = craftTarget.value
  // 制作时火候挑战（2026-09-06，设置可关）：弹窗定火 → 完美 +30% / 良好 +15% 额外经验
  if (player.settings?.heatCraftChallenge !== false && n <= 10) {
    heatModal.value = { recipe: r, n }
    return
  }
  runCraftBatch(r, n, 0)
}
function onHeatResult(type) {
  const hm = heatModal.value
  heatModal.value = null
  if (!hm) return
  const bonus = type === 'perfect' ? 0.3 : type === 'good' ? 0.15 : 0
  runCraftBatch(hm.recipe, hm.n, bonus, type)
}
function runCraftBatch(r, n, bonus, heatType) {
  let ok = 0
  for (let i = 0; i < n; i++) {
    const res = props.instance.craft(r)
    if (res === 'denied') break
    if (res === 'ok') ok++
  }
  if (bonus > 0 && ok > 0) {
    props.instance.addCardXp(Math.round(r.xp * bonus * ok), 1)
  }
  if (ok > 0) {
    ui.pushLog(`制作 ${getItem(r.output.itemId)?.name} ×${ok}${heatType === 'perfect' ? '（🔥火候完美 +30% 经验）' : heatType === 'good' ? '（火候良好 +15% 经验）' : ''}`, 'info')
  }
}
function useBiscuit() {
  const ok = player.consumeEnergyBiscuit()
  ui.pushLog(ok ? `使用能量饼干：离线时长上限 +4h（饼干加时 ${player.offlineBonusH}/${OFFLINE_CAP.biscuitMaxHours}h · 总离线上限 ${player.offlineMaxHours()}h）` : '能量饼干不足或已达上限', ok ? 'info' : 'warn')
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
// ⚠️ 必须用 `eraLabelOf`（与 `levelEras` 同一个算法）—— 原先这里自己按 5 级算标签，
//    分段粒度改成 10 级「时代」后它会算出旧标签、跳到不存在的段，跳转静默失效
//    （C48 有断言钉住「每个配方等级反查出的标签都是真实存在的段」）。
//    2026-09-19 起跳转动作由「展开折叠段」改成「切标签页」（`selectEra`）。
function sectionLabelOf(reqLevel) {
  return eraLabelOf(reqLevel)
}
function goTree(nav) {
  const target = treeRecipe.value
  treeRecipe.value = null
  if (!target || !nav) return
  if (nav.type === 'craft') {
    if (nav.skillId === props.instance.id) {
      // 同技能：「去做」= **切到目标配方所在等级段**（标签页）+ 闪烁高亮该卡
      selectEra(sectionLabelOf(nav.reqLevel ?? target.reqLevel))
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

// ── 卡片式分段（按「时代」每 10 级一档，可折叠）──
// 副业五支**走平铺**：产物只有 8~10 件，按等级段切十段再默认全部折叠，等于每次进来都看不到东西
// （2026-09-17 用户要求「副业的卡片去掉等级段分类和折叠，因为物品不多」）。
// ⚠️ 2026-09-19 起粒度由 5 级改成 `ERA_SPAN`(10) 级「时代」，与采集页共用 `game/data/levelEras.js`：
//    制作侧的密度和采集一样是「横向多、纵向少」（烹饪 294 个配方跨 100 级），5 级一段会切出 20 段，
//    把纵向梯级读成平铺；10 级一档 + 用**该档最高级配方**命名，读起来才是 ~10 档的梯级结构。
const flatMode = computed(() => SIDELINE_LADDER_SKILL_IDS.includes(props.instance.id))
const sections = computed(() => {
  if (flatMode.value) {
    return [{ label: '全部', era: '', list: [...props.instance.recipes].sort((a, b) => a.reqLevel - b.reqLevel) }]
  }
  return levelEras(props.instance.recipes, (r) => r.reqLevel, (r) => r.id).map((sec) => ({
    label: sec.label,
    // ⚠️ `from`/`to` 必须带走：`currentEraLabel()` 靠它们判断「当前等级在哪一段」，
    //    丢了边界它会匹配不到、**静默回退到最后一段**（实测：1 级玩家进来默认展开的是 Lv91-100）。
    from: sec.from,
    to: sec.to,
    era: getItem(props.instance.recipes.find((r) => r.id === sec.topId)?.output?.itemId)?.name ?? '',
    list: sec.list,
  }))
})
// 等级段 = 顶部**标签页**（2026-09-19 用户第二次澄清后定型）：
//   默认**只显示「当前等级所在的段」的配方**，没有折叠、上面点标签切换。
const eraDefault = () => currentEraLabel(sections.value, props.instance?.level ?? 1)
const selectedEra = ref(flatMode.value ? '全部' : eraDefault())
const activeSec = computed(() => sections.value.find((s) => s.label === selectedEra.value) ?? sections.value[0] ?? null)
function selectEra(label) {
  selectedEra.value = label
}
</script>

<template>
  <div>




    <!-- 精通池（技能级共享）——补给目标 = 制作队列的队头（没有队列就不给补，避免误花） -->
    <MasteryPoolBar
      :skill-id="instance.id"
      :card-key="queueHeadId"
      :card-name="queueHeadName"
      :card-count="queueHeadCount"
      mode="craft"
    />

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
          <button class="btn btn-sm btn-primary" :disabled="player.coldStorageCap >= PAID_CAP_MAX.cold || player.gold < COLD_EXPAND_COST" @click="doExpandCold">扩一格（{{ COLD_EXPAND_COST }} 金币）</button>
          <span class="dim" v-if="player.coldStorageCap < PAID_CAP_MAX.cold">金币可买到 {{ PAID_CAP_MAX.cold }} 格（山海食经还能再往上加）</span>
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
      <h3 class="target-head-row">
        <span>{{ headTitle }}（{{ flatMode ? '全部平铺' : '按等级分段，点上面的段切换' }}）</span>
        <span class="target-head-extra">
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
            <span class="dim">离线时长上限 {{ player.offlineMaxHours() }}h（基础 12 + 饼干 {{ player.offlineBonusH }}/{{ OFFLINE_CAP.biscuitMaxHours }} + 天赋加成）</span>
            <button class="btn btn-sm btn-primary" :disabled="!(player.inventory.energyBiscuit ?? 0) || player.offlineBonusH >= OFFLINE_CAP.biscuitMaxHours" @click="useBiscuit()">
              使用
            </button>
            <!-- 溢出后的两个出口（2026-09-10）：战斗内使用 / 奥义页回收 -->
            <span v-if="player.biscuitOfflineMaxed()" class="dim biscuit-overflow">
              已满上限 → 仍可用于<b>对决中的能量补给</b>，或在<b>美食知识页</b>回收成品鉴点
            </span>
          </div>
          <MasteryHelp mode="craft" :show-interval="false" />
        </span>
      </h3>
      <!-- 等级段标签页（副业是平铺的单一「全部」段，不显示标签栏） -->
      <div v-if="!flatMode && sections.length > 1" class="era-tabs">
        <button
          v-for="sec in sections"
          :key="sec.label"
          class="btn btn-sm era-tab"
          :class="{ 'btn-primary': selectedEra === sec.label }"
          @click="selectEra(sec.label)"
        >
          {{ sec.label }}
          <span v-if="sec.era" class="era-tab-name">{{ sec.era }}</span>
        </button>
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
      <template v-if="activeSec">
        <div v-if="!flatMode" class="era-head">
          <strong>{{ activeSec.label }}</strong>
          <!-- 时代名 = 该档最高级配方的产出名：一眼看出「这一档能做什么新东西」 -->
          <span v-if="activeSec.era" class="era-name" :title="`本档最高级配方：${activeSec.era}`">{{ activeSec.era }}</span>
          <span class="dim">{{ activeSec.list.length }} 个{{ recipeNoun }}</span>
          <span class="dim" title="该档已精通满 100 的配方数 / 该档配方数">精通 {{ eraProgress(activeSec.list, (r) => masteryOf(r).level).done }}/{{ activeSec.list.length }}</span>
          <span v-if="activeSec.list.some((r) => maxCraft(r) > 0 && canAfford(r))" class="badge badge-on">可制作</span>
        </div>
        <div class="gather-grid recipe-grid">
          <div
            v-for="r in activeSec.list"
            :key="r.id"
            class="gather-card"
            :class="{ locked: player.skillState(instance.id).level < r.reqLevel, flash: flashCard?.recipeId === r.id }"
          >
            <div class="gather-card-head">
              <ItemImg :item-id="r.output.itemId" />
              <div>
                <strong>{{ r.name }}</strong>
                <span v-if="qualityOf[r.id]" class="quality-chip" :style="{ color: qualityOf[r.id].color }">{{ qualityOf[r.id].text }}</span>
                <div class="dim" style="font-size: 12px">{{ recipeCategory(r) }} · Lv {{ r.reqLevel }}</div>
              </div>
            </div>
            <div class="gather-card-row">
              <span>经验</span>
              <span class="mono">{{ r.xp }}<span v-if="masteryOf(r).level >= 5" class="mastery-hl">&nbsp;×{{ masteryOf(r).xpMult }}</span></span>
            </div>
            <div class="gather-card-row">
              <span title="按「材料充足、队列每 3 秒出 1 件」算的上限；实际产量还取决于你有没有在挂对应原料（一件成品的采集时间中位约 90 秒）">效率</span>
              <span class="mono" title="材料充足时的上限（3 秒/件）；实际受原料供给限制">{{ fmtRate(instance.xpPerHour(r)) }}</span>
            </div>
            <!-- 「当前最优」独占一行：塞进右侧值里会被挤成竖排（卡片只有两列宽） -->
            <div v-if="r.id === bestRecipeId" class="best-flag">
              ⚡ 最优<template v-if="gainVsHead(r) != null"> · 比队头快 {{ (gainVsHead(r) * 100).toFixed(0) }}%</template>
            </div>
            <div class="gather-card-row">
              <span>精通</span>
              <span class="mono">
                {{ masteryOf(r).level }} / 100 级<span v-if="masteryOf(r).batch" class="mastery-hl">&nbsp;· 保底 +{{ masteryOf(r).batch }}</span>
              </span>
            </div>
            <ProgressBar :progress="masteryOf(r).progress" class="mastery-bar" />
            <div class="dim mono" style="font-size: 12px; text-align: right">
              {{ masteryOf(r).current }} / {{ masteryOf(r).needed }} 次
            </div>
            <div class="gather-card-row effect-row">
              <span class="effect-label">效果</span>
              <span class="effect-tags">
                <span v-for="(t, i) in outputEffect(r.output.itemId)" :key="i" class="effect-chip">{{ t }}</span>
              </span>
            </div>
            <div class="ing-cell gather-card-ing">
              <span
                v-for="(qty, itemId) in effIngredients(r)"
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
                <!-- 未解锁（技能等级 < 配方等级）时 successChance() 会算出负数（基础值 + 负的等级差），
                     显示成「成功率 -41%」纯属误导：这个等级根本做不了它。改为显示解锁要求。 -->
                <span v-if="player.skillState(instance.id).level < r.reqLevel" class="mono dim">Lv{{ r.reqLevel }} 解锁</span>
                <span v-else class="mono">{{ (instance.successChance(r) * 100).toFixed(0) }}%</span>
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
      </template>
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
    <HeatChallengeModal
      v-if="heatModal"
      :title="`🔥 火候挑战 · ${heatModal.recipe?.name}`"
      @result="onHeatResult"
      @close="heatModal = null"
    />
    <!-- 副业作品（v2.10.0）：只有陶艺/编织/刺绣/蜡烛会渲染，其它制作类技能内部 v-if 为假 -->
    <SidelineWorkPanel :instance="instance" />
  </div>
</template>

<style scoped>
.biscuit-overflow {
  font-size: 12px;
  color: var(--warn-strong, var(--warn-strong));
}
/* 制作队列（2026-09-06） */
.queue-card { margin-bottom: 12px; }
.queue-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.queue-list { display: flex; flex-direction: column; gap: 6px; }
.queue-item {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 10px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: rgba(var(--panel-rgb), 0.7);
}
.queue-item .queue-name { font-weight: 600; }
.queue-item .queue-paused { color: var(--bad-strong); font-size: 12px; font-weight: 700; }
.queue-rm { margin-left: auto; }
.queue-btns { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.queue-btns .btn-primary { flex: 1 1 100%; } /* 主「制作」按钮独占整行 */
@media (min-width: 480px) {
  .queue-btns:not(:has(.btn-primary)) { justify-content: flex-start; }
}
/* 配方树「去做」后的卡片高亮闪烁 */
@keyframes recipeFlash {
  0%, 100% { box-shadow: 0 0 0 rgba(var(--amber-strong-rgb), 0); }
  50% { box-shadow: 0 0 20px rgba(var(--amber-strong-rgb), 0.85); }
}
.gather-card.flash { animation: recipeFlash 0.8s ease-in-out 2; }
/* 装备品质徽章（仅锻造卡片；配色与图鉴/物品详情一致） */
.quality-chip {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 7px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  border: 1px solid currentColor;
  border-radius: 999px;
  vertical-align: middle;
  opacity: 0.92;
}
</style>
