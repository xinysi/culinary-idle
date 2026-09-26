<script setup>
// 装备页（2026-09-19 由弹窗升级为独立页面） — 独立于背包/仓库弹窗
// 三栏：当前穿戴 | 强化框（默认空，点强化才显示）| 背包可穿戴
// 底部：装备总属性汇总 + 选中装备详情 + 快捷引导（去采矿/去锻造）
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { fmtStat } from '../game/data/itemDetail.js'
import { fmtMod, REROLL_COST } from '../game/data/gearMods.js'
import { equipSetBonuses } from '../game/data/equipSets.js'
import { GEM_DEFS, gemDef, socketCountOf } from '../game/data/gems.js'
import { itemImage } from '../game/data/itemImage.js' // 背包可穿戴的卡片图标（唯一出口，别手写路径）

const player = usePlayerStore()
const ui = useUiStore()

const SLOT_NAMES = { weapon: '武器', helmet: '头盔', body: '身体', legs: '腿部', boots: '脚部', offhand: '副手', amulet: '饰品1', ring: '饰品2' }
const EQ_STAT_LABEL = { attack: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', hpBonus: '生命值', speedBonus: '攻速' }

// 背包可穿戴 + 分类筛选
const backpackCat = ref('all')
// 八个槽位分类（2026-09-21 用户：「背包可穿戴分类应该是八个分类」）——
// 原来只有「武器 / 防具 / 饰品」三组，防具把头盔/身体/腿部/脚部四类混在一起，
// 找「副手能装什么」要一件件看。现按**装备的 slot**（= 8 个槽位，见 SLOT_NAMES）分类。
// ⚠️ 槽位清单不另抄一份：直接用 player.equipment 的键序（= EQUIPMENT_SLOTS），
//    守卫断言「分类数 == 槽位数 + 全部」。
const CATS = [{ id: 'all', name: '全部' }, ...Object.entries(SLOT_NAMES).map(([id, name]) => ({ id, name }))]
const equipList = computed(() => {
  let arr = Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.type === 'equipment')
    .map(([id, qty]) => ({ id, qty, item: getItem(id) }))
    .sort((a, b) => (b.item?.tier ?? 0) - (a.item?.tier ?? 0) || (b.item?.value ?? 0) - (a.item?.value ?? 0))
  if (backpackCat.value !== 'all') arr = arr.filter((e) => getItem(e.id)?.slot === backpackCat.value)
  return arr
})

// 装备总属性汇总
const equippedStats = computed(() => player.equippedStats)
const wornCount = computed(() => Object.values(player.equipment).filter(Boolean).length)
const totalUpgrades = computed(() => Object.values(player.upgrades ?? {}).reduce((a, b) => a + (b ?? 0), 0))
const statEntries = computed(() =>
  ['attack', 'accuracy', 'defense', 'evasion', 'critChance', 'hpBonus', 'speedBonus']
    .map((k) => ({ label: EQ_STAT_LABEL[k], value: equippedStats.value[k] ?? 0 }))
    .filter((s) => s.value)
    .map((s) => ({ ...s, value: fmtStat(s.value) }))
)
// 套装效果（2026-09-09）：同套穿戴 2/4/6 件叠加
const activeSets = computed(() => equipSetBonuses(player.equipment).active)
// 宝石镶嵌（2026-09-09）：选中装备的插槽状态 + 背包可用宝石
const selectedSockets = computed(() => {
  const id = selectedEquip.value
  const slot = id ? wornSlotOf(id) : null
  if (!slot) return null
  const rec = player.gemSockets?.[slot]
  return rec && rec.itemId === id ? { slot, gems: rec.gems } : null
})
const ownedGems = computed(() => GEM_DEFS.filter((g) => (player.inventory[g.itemId] ?? 0) > 0))
const gemPick = ref({})
function gemName(id) { return getItem(id)?.name ?? id }
function gemDesc(id) { return gemDef(id)?.desc ?? '' }
function doSocket(slot, index) {
  const gemId = gemPick.value[`${slot}:${index}`]
  if (!gemId) { ui.pushLog('请先选择宝石', 'warn'); return }
  const r = player.socketGem(slot, index, gemId)
  ui.pushLog(r.ok ? `💎 镶嵌 ${gemName(gemId)}（${gemDesc(gemId)}）` : r.msg, r.ok ? 'gain' : 'warn')
}
function doUnsocket(slot, index) {
  const r = player.unsocketGem(slot, index)
  ui.pushLog(r.ok ? `💎 取下 ${gemName(r.itemId)}` : r.msg, r.ok ? 'info' : 'warn')
}

// 选中装备详情（点当前穿戴/背包可穿戴均可选中）
const selectedEquip = ref(null)
function selectEquip(id) { selectedEquip.value = id }

// ⚠️ 每个插槽的选择框必须**先有一个空值**，否则显示不出占位文案：
// `gemPick` 里没有这个键时 `v-model` 是 undefined，而空选项的值是 ''，Vue 匹配不上任何 option
// ⇒ `selectedIndex = -1`、框里一片空白（2026-09-18 实测：「选择宝石」四个字从来就没显示过）。
// ⚠️ 必须放在 `selectedEquip` **之后**：`selectedSockets` 引用它，immediate 会在 setup 期间求值，
// 放前面直接抛 `Cannot access 'selectedEquip' before initialization`（本轮踩过）。
watch(selectedSockets, (s) => {
  if (!s) return
  s.gems.forEach((_g, i) => {
    const k = `${s.slot}:${i}`
    if (gemPick.value[k] === undefined) gemPick.value[k] = ''
  })
}, { immediate: true, deep: true })

// 强化
const upgradeTarget = ref(null)
function setUpgradeTarget(id) { upgradeTarget.value = id }
function upgradeCostFor(id) { return player.upgradeCost(id) }
function doUpgrade(id) {
  const r = player.upgradeItem(id)
  ui.pushLog(r.ok ? `⚒️ ${getItem(id)?.name} 强化到 +${r.level}` : r.msg ?? '强化失败', r.ok ? 'gain' : 'warn')
}

function wearFromBag(id) {
  if (player.equip(id)) ui.pushLog(`穿戴了 ${getItem(id)?.name}`, 'gain')
  selectEquip(id)
}
function unequipSlot(slot) {
  if (player.unequip(slot)) ui.pushLog(`卸下 ${getItem(player.equipment[slot])?.name ?? ''}`, 'info')
}
// 快捷跳转：去采矿 / 去锻造（厨具锻造）
function goToSkill(id) {
  player.setActiveSkill(id)
  ui.setView('skill')
}
function itemDetailLines(id) {
  const it = getItem(id)
  if (!it?.stats) return []
  return Object.entries(it.stats).map(([k, v]) => ({ label: EQ_STAT_LABEL[k] ?? k, value: fmtStat(v) }))
}
// 装备词条（2026-09-06；2026-09-18 起按**装备 id** 存）：同一件装备在哪都带着自己那套词条
function modsFor(itemId) {
  if (!itemId) return []
  return player.gearModsOf(itemId)
}
/** 该装备当前穿在哪个槽位（没穿就 null）——洗练按钮要靠它找槽位 */
function wornSlotOf(itemId) {
  for (const [slot, id] of Object.entries(player.equipment)) {
    if (id === itemId) return slot
  }
  return null
}
function doReroll(slot) {
  const r = player.rerollGearMod(slot)
  ui.pushLog(r.ok ? `✨ 洗练完成（-${r.cost} 金币）：${getItem(player.equipment[slot])?.name}` : r.msg ?? '洗练失败', r.ok ? 'gain' : 'warn')
}
</script>

<template>
  <div class="equipment-view">
    <header class="skill-head">
      <div>
        <h2>⚔️ 装备</h2>
        <p class="dim">穿戴 / 强化 / 洗练 / 镶嵌宝石，都在这一页完成。</p>
      </div>
    </header>

      <!-- 版式（2026-09-20 用户给图 p3）：左侧「当前穿戴」竖跨两行；右上两格「强化 / 总属性」；
           其下「装备详情」横跨右上两列；底部整行「背包可穿戴」。 -->
      <div class="equip-body">
        <!-- 左上（竖跨两行）：当前穿戴 -->
        <div class="equip-pane equip-pane--worn">
          <div class="equip-section-title">当前穿戴</div>
          <div
            v-for="(itemId, slot) in player.equipment"
            :key="slot"
            class="equip-row equip-row-equipped"
            :class="{ 'selected': itemId && selectedEquip === itemId }"
            @click="itemId && selectEquip(itemId)"
          >
            <span class="dim">{{ SLOT_NAMES[slot] }}</span>
            <span class="equip-name" :class="{ dim: !itemId }">
              {{ itemId ? getItem(itemId)?.name : '—' }}
              <span v-if="itemId && (player.upgrades[itemId] ?? 0) > 0" class="dim mono" style="font-size: 12px; margin-left: 4px">⚒️+{{ player.upgrades[itemId] }}</span>
            </span>
            <div v-if="itemId && modsFor(itemId).length" class="equip-mod-chips" @click.stop>
              <span v-for="(m, i) in modsFor(itemId)" :key="i" class="mod-chip">{{ fmtMod(m) }}</span>
            </div>
            <button class="btn btn-sm" :disabled="!itemId" @click.stop="itemId && unequipSlot(slot)">卸下</button>
            <button class="btn btn-sm btn-primary" :disabled="!itemId" @click.stop="itemId && setUpgradeTarget(itemId)">强化</button>
          </div>
        </div>

        <!-- 右上左：强化框（默认空，点强化按钮后显示） -->
        <div class="equip-pane equip-pane--upgrade equip-upgrade-pane">
          <div class="equip-section-title">强化</div>
          <template v-if="upgradeTarget">
            <div class="equip-upgrade-name">{{ getItem(upgradeTarget)?.name }}</div>
            <div class="dim" style="font-size: 12px; margin-top: 4px">强化等级：<strong>+{{ player.upgrades[upgradeTarget] ?? 0 }}</strong>/5（每级属性 +10%）</div>
            <div v-if="(player.upgrades[upgradeTarget] ?? 0) < 5" class="dim" style="font-size: 12px; margin-top: 2px">
              费用：{{ upgradeCostFor(upgradeTarget)?.gold }} 金币 + {{ upgradeCostFor(upgradeTarget)?.timberName }}×{{ upgradeCostFor(upgradeTarget)?.qty }} + {{ upgradeCostFor(upgradeTarget)?.oreName }}×{{ upgradeCostFor(upgradeTarget)?.qty }}<span class="dim">（按装备等级取同档木材与矿）</span>
            </div>
            <button class="btn btn-sm btn-primary" :disabled="(player.upgrades[upgradeTarget] ?? 0) >= 5" @click="doUpgrade(upgradeTarget)" style="margin-top: 6px">强化</button>
          </template>
          <p v-else class="dim">点击“强化”按钮查看该装备的强化信息。</p>
        </div>

        <!-- 右上右：当前装备总属性汇总 -->
        <div class="equip-pane equip-pane--stats">
          <div class="equip-section-title">当前装备总属性</div>
          <div class="equip-stat-grid">
            <div v-for="s in statEntries" :key="s.label" class="equip-stat-card">
              <span class="dim equip-stat-label">{{ s.label }}</span>
              <span class="mono equip-stat-val">{{ s.value }}<template v-if="s.label === '暴击'">%</template></span>
            </div>
            <span v-if="!statEntries.length" class="dim" style="grid-column: 1 / -1">未穿戴任何装备</span>
          </div>
          <div class="dim" style="font-size: 12px; margin-top: 8px">已穿戴 {{ wornCount }}/8 槽 · 强化总等级 +{{ totalUpgrades }}</div>
          <div v-if="activeSets.length" style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px">
            <div v-for="s in activeSets" :key="s.key" class="gather-card-row">
              <span><span class="badge badge-on">{{ s.count }} 件</span> {{ s.name }}</span>
              <span class="dim">套件等级 {{ s.level }}</span>
            </div>
          </div>
        </div>

        <!-- 右中（横跨右上两列）：装备详情 -->
        <div class="equip-pane equip-pane--detail">
          <div class="equip-section-title">装备详情</div>
          <template v-if="selectedEquip">
            <div class="equip-detail-head">
              <span class="equip-detail-name">{{ getItem(selectedEquip)?.name }}</span>
              <span v-if="(player.upgrades[selectedEquip] ?? 0) > 0" class="badge" style="background: var(--warn-soft); color: var(--warn-strong); font-size: 12px">⚒️+{{ player.upgrades[selectedEquip] }}</span>
              <span v-if="getItem(selectedEquip)?.quality" class="badge" style="background: var(--sidebar-bg); color: var(--muted); font-size: 12px">{{ getItem(selectedEquip)?.quality }}</span>
            </div>
            <!-- 该件属性：压成一行紧凑标签（原先是 6 行明细，和左边「当前装备总属性」重复，
                 还把「装备详情」撑到 413px ⇒ 页脚预留高度比三栏还高、弹窗上下失衡） -->
            <div class="equip-stat-chips">
              <span v-for="l in itemDetailLines(selectedEquip)" :key="l.label" class="equip-stat-chip">
                <span class="dim">{{ l.label }}</span>
                <span class="mono">{{ l.value }}<template v-if="l.label === '暴击'">%</template></span>
              </span>
              <span v-if="!itemDetailLines(selectedEquip).length" class="dim" style="font-size: 12px">该装备无附加属性</span>
            </div>
            <template v-if="modsFor(selectedEquip).length">
              <div class="dim" style="font-size: 12px; margin-top: 6px">✨ 词条（穿戴中）：</div>
              <div class="equip-mod-chips" style="margin-top: 4px">
                <span v-for="(m, i) in modsFor(selectedEquip)" :key="i" class="mod-chip">{{ fmtMod(m) }}</span>
              </div>
              <button
                v-if="wornSlotOf(selectedEquip)"
                class="btn btn-sm"
                :disabled="player.gold < (REROLL_COST[getItem(selectedEquip)?.quality] ?? REROLL_COST['普通'])"
                @click="doReroll(wornSlotOf(selectedEquip))"
                style="margin-top: 6px"
                :title="`重随词条（费用 ${REROLL_COST[getItem(selectedEquip)?.quality] ?? REROLL_COST['普通']} 金币）`"
              >✨ 洗练（{{ REROLL_COST[getItem(selectedEquip)?.quality] ?? REROLL_COST['普通'] }} 金）</button>
            </template>
            <!-- 宝石镶嵌（2026-09-09）：按品质提供 0~3 个插槽；换装自动退回宝石 -->
            <template v-if="socketCountOf(getItem(selectedEquip)) > 0">
              <div class="dim" style="font-size: 12px; margin-top: 8px">💎 宝石插槽（{{ socketCountOf(getItem(selectedEquip)) }}）</div>
              <template v-if="selectedSockets">
                <div v-for="(g, i) in selectedSockets.gems" :key="i" class="gather-card-row socket-row" style="margin-top: 4px">
                  <span v-if="g" class="mono">{{ gemName(g) }} <span class="dim">{{ gemDesc(g) }}</span></span>
                  <span v-else class="dim">空插槽 {{ i + 1 }}</span>
                  <span class="socket-acts">
                    <button v-if="g" class="btn btn-sm" @click="doUnsocket(selectedSockets.slot, i)">拆卸</button>
                    <template v-else>
                      <select
                        v-model="gemPick[selectedSockets.slot + ':' + i]"
                        class="gem-pick"
                        :title="gemPick[selectedSockets.slot + ':' + i] ? `${gemName(gemPick[selectedSockets.slot + ':' + i])}（${gemDesc(gemPick[selectedSockets.slot + ':' + i])}）` : '选择要镶嵌的宝石'"
                      >
                        <option value="">选择宝石</option>
                        <option v-for="gd in ownedGems" :key="gd.itemId" :value="gd.itemId">
                          {{ getItem(gd.itemId)?.name }}（{{ gd.desc }}）×{{ player.inventory[gd.itemId] }}
                        </option>
                      </select>
                      <button class="btn btn-sm btn-primary" @click="doSocket(selectedSockets.slot, i)">镶嵌</button>
                    </template>
                  </span>
                </div>
              </template>
              <p v-else class="dim" style="font-size: 12px">穿戴后可镶嵌（换装/卸下会自动退回宝石）</p>
            </template>
          </template>
          <p v-else class="dim equip-detail-empty">点击左侧 / 右侧装备<br />查看详情、词条、洗练与宝石插槽</p>
        </div>

        <!-- 底部整行：背包可穿戴（分类筛选；唯一会无限增长的列表 ⇒ 限高内滚） -->
        <div class="equip-pane equip-pane--bag">
          <div class="equip-section-title">背包可穿戴</div>
          <div class="equip-cat-tabs">
            <button v-for="c in CATS" :key="c.id" class="btn btn-sm" :class="{ 'btn-primary': backpackCat === c.id }" @click="backpackCat = c.id">{{ c.name }}</button>
          </div>
          <!-- 卡片式（2026-09-21 用户要求）：一行列表在宽屏上「一列名字 + 右侧一列按钮」很空，
               改成自适应卡片网格（图标 + 名字 + 数量 + 穿戴），与厨藏页的槽位观感一致。 -->
          <div v-if="equipList.length" class="equip-card-grid">
            <div
              v-for="e in equipList"
              :key="e.id"
              class="equip-card"
              :class="{ 'selected': selectedEquip === e.id }"
              :title="e.item?.name"
              @click="selectEquip(e.id)"
            >
              <img v-if="itemImage(e.id)" class="equip-card-img" :src="itemImage(e.id)" alt="" @error="$event.target.style.display = 'none'" loading="lazy" decoding="async" />
              <span class="equip-card-name">{{ e.item?.name }}</span>
              <span class="dim mono equip-card-qty">×{{ e.qty }}</span>
              <button class="btn btn-sm btn-primary" @click.stop="wearFromBag(e.id)">穿戴</button>
            </div>
          </div>
          <template v-if="!equipList.length">
            <p class="dim" style="font-size: 12px">背包中没有该分类的可穿戴装备。</p>
            <div class="equip-guide">
              <button class="btn btn-sm" @click="goToSkill('mining')">⛏️ 去采矿</button>
              <button class="btn btn-sm" @click="goToSkill('woodcutting')">🪓 去伐木</button>
              <button class="btn btn-sm" @click="goToSkill('craftsmithing')">🔨 去锻造</button>
            </div>
          </template>
        </div>
      </div>
  </div>
</template>
