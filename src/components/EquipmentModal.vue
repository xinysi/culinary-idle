<script setup>
// 装备（穿戴）弹窗 — 独立于背包/仓库弹窗
// 三栏：当前穿戴 | 强化框（默认空，点强化才显示）| 背包可穿戴
// 底部：装备总属性汇总 + 选中装备详情 + 快捷引导（去采矿/去锻造）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { fmtStat } from '../game/data/itemDetail.js'
import { fmtMod, REROLL_COST } from '../game/data/gearMods.js'

const player = usePlayerStore()
const ui = useUiStore()

const SLOT_NAMES = { weapon: '武器', helmet: '头盔', body: '身体', legs: '腿部', boots: '脚部', offhand: '副手', amulet: '饰品1', ring: '饰品2' }
const EQ_STAT_LABEL = { attack: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', hpBonus: '生命值', speedBonus: '攻速' }
const EQUIP_TYPE = { weapon: '武器', offhand: '武器', helmet: '防具', body: '防具', legs: '防具', boots: '防具', amulet: '饰品', ring: '饰品' }

// 背包可穿戴 + 分类筛选
const backpackCat = ref('全部')
const CATS = ['全部', '武器', '防具', '饰品']
const equipList = computed(() => {
  let arr = Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.type === 'equipment')
    .map(([id, qty]) => ({ id, qty, item: getItem(id) }))
    .sort((a, b) => (b.item?.tier ?? 0) - (a.item?.tier ?? 0) || (b.item?.value ?? 0) - (a.item?.value ?? 0))
  if (backpackCat.value !== '全部') arr = arr.filter((e) => EQUIP_TYPE[getItem(e.id)?.slot] === backpackCat.value)
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

// 选中装备详情（点当前穿戴/背包可穿戴均可选中）
const selectedEquip = ref(null)
function selectEquip(id) { selectedEquip.value = id }

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
  ui.toggleEquipModal(false)
}
function itemDetailLines(id) {
  const it = getItem(id)
  if (!it?.stats) return []
  return Object.entries(it.stats).map(([k, v]) => ({ label: EQ_STAT_LABEL[k] ?? k, value: fmtStat(v) }))
}
// 装备词条（2026-09-06）：按物品 id 查穿戴词条（词条只对穿戴中的同件生效）
function modsFor(itemId) {
  if (!itemId) return []
  for (const m of Object.values(player.gearMods ?? {})) {
    if (m?.itemId === itemId) return m.mods ?? []
  }
  return []
}
function wornSlotOf(itemId) {
  for (const [slot, itemId2] of Object.entries(player.equipment)) {
    if (itemId2 === itemId && player.gearMods?.[slot]?.itemId === itemId) return slot
  }
  return null
}
function doReroll(slot) {
  const r = player.rerollGearMod(slot)
  ui.pushLog(r.ok ? `✨ 洗练完成（-${r.cost} 金币）：${getItem(player.equipment[slot])?.name}` : r.msg ?? '洗练失败', r.ok ? 'gain' : 'warn')
}
function close() { ui.toggleEquipModal(false) }
</script>

<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal bag-modal equip-modal">
      <header class="modal-head">
        <h3>⚔️ 装备</h3>
        <button class="btn btn-sm" @click="close">✕</button>
      </header>

      <div class="equip-body">
        <!-- 左：当前穿戴 -->
        <div class="equip-pane">
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
              <span v-if="itemId && (player.upgrades[itemId] ?? 0) > 0" class="dim mono" style="font-size: 11px; margin-left: 4px">⚒️+{{ player.upgrades[itemId] }}</span>
            </span>
            <button class="btn btn-sm" :disabled="!itemId" @click.stop="itemId && unequipSlot(slot)">卸下</button>
            <button class="btn btn-sm btn-primary" :disabled="!itemId" @click.stop="itemId && setUpgradeTarget(itemId)">强化</button>
            <div v-if="itemId && modsFor(itemId).length" class="equip-mod-chips" @click.stop>
              <span v-for="(m, i) in modsFor(itemId)" :key="i" class="mod-chip">{{ fmtMod(m) }}</span>
            </div>
          </div>
        </div>

        <!-- 中：强化框（默认空，点强化按钮后显示） -->
        <div class="equip-pane equip-upgrade-pane">
          <div class="equip-section-title">强化</div>
          <template v-if="upgradeTarget">
            <div class="equip-upgrade-name">{{ getItem(upgradeTarget)?.name }}</div>
            <div class="dim" style="font-size: 12px; margin-top: 4px">强化等级：<strong>+{{ player.upgrades[upgradeTarget] ?? 0 }}</strong>/5（每级属性 +10%）</div>
            <div v-if="(player.upgrades[upgradeTarget] ?? 0) < 5" class="dim" style="font-size: 12px; margin-top: 2px">
              费用：{{ upgradeCostFor(upgradeTarget)?.gold }} 金币 + 铁矿×{{ upgradeCostFor(upgradeTarget)?.ironOre }} + 盐矿×{{ upgradeCostFor(upgradeTarget)?.saltOre }}
            </div>
            <button class="btn btn-sm btn-primary" :disabled="(player.upgrades[upgradeTarget] ?? 0) >= 5" @click="doUpgrade(upgradeTarget)" style="margin-top: 6px">强化</button>
          </template>
          <p v-else class="dim">点击“强化”按钮查看该装备的强化信息。</p>
        </div>

        <!-- 右：背包可穿戴（分类筛选） -->
        <div class="equip-pane">
          <div class="equip-section-title">背包可穿戴</div>
          <div class="equip-cat-tabs">
            <button v-for="c in CATS" :key="c" class="btn btn-sm" :class="{ 'btn-primary': backpackCat === c }" @click="backpackCat = c">{{ c }}</button>
          </div>
          <div
            v-for="e in equipList"
            :key="e.id"
            class="equip-row"
            :class="{ 'selected': selectedEquip === e.id }"
            @click="selectEquip(e.id)"
          >
            <span>{{ e.item?.name }}</span>
            <span class="dim mono">×{{ e.qty }}</span>
            <button class="btn btn-sm btn-primary" @click.stop="wearFromBag(e.id)">穿戴</button>
          </div>
          <template v-if="!equipList.length">
            <p class="dim" style="font-size: 12px">背包中没有该分类的可穿戴装备。</p>
            <div class="equip-guide">
              <button class="btn btn-sm" @click="goToSkill('excavation')">⛏️ 去采矿</button>
              <button class="btn btn-sm" @click="goToSkill('craftsmithing')">🔨 去锻造</button>
            </div>
          </template>
        </div>
      </div>

      <!-- 底部：总属性汇总 + 选中装备详情 -->
      <div class="equip-footer">
        <div class="equip-footer-col">
          <div class="equip-section-title">当前装备总属性</div>
          <div class="equip-stat-grid">
            <div v-for="s in statEntries" :key="s.label" class="equip-stat-card">
              <span class="dim equip-stat-label">{{ s.label }}</span>
              <span class="mono equip-stat-val">{{ s.value }}<template v-if="s.label === '暴击'">%</template></span>
            </div>
            <span v-if="!statEntries.length" class="dim" style="grid-column: 1 / -1">未穿戴任何装备</span>
          </div>
          <div class="dim" style="font-size: 11px; margin-top: 8px">已穿戴 {{ wornCount }}/8 槽 · 强化总等级 +{{ totalUpgrades }}</div>
        </div>
        <div class="equip-footer-col equip-footer-detail">
          <div class="equip-section-title">装备详情</div>
          <template v-if="selectedEquip">
            <div class="equip-detail-head">
              <span class="equip-detail-name">{{ getItem(selectedEquip)?.name }}</span>
              <span v-if="(player.upgrades[selectedEquip] ?? 0) > 0" class="badge" style="background: var(--warn-soft); color: var(--warn-strong); font-size: 10px">⚒️+{{ player.upgrades[selectedEquip] }}</span>
              <span v-if="getItem(selectedEquip)?.quality" class="badge" style="background: var(--sidebar-bg); color: var(--muted); font-size: 10px">{{ getItem(selectedEquip)?.quality }}</span>
            </div>
            <div class="equip-detail-list">
              <div v-for="l in itemDetailLines(selectedEquip)" :key="l.label" class="equip-detail-row"><span class="dim">{{ l.label }}</span><span class="mono">{{ l.value }}<template v-if="l.label === '暴击'">%</template></span></div>
              <div v-if="!itemDetailLines(selectedEquip).length" class="dim">该装备无附加属性。</div>
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
          </template>
          <p v-else class="dim">点击左侧/右侧装备查看详情。</p>
        </div>
      </div>
    </div>
  </div>
</template>
