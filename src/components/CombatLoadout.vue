<script setup>
// 战备（2026-09-19 抽出；2026-09-21 用户要求「战备移到战斗屏左上角 + 点击选择自动进食的料理」）——
// 现在是**战斗屏左上角的一枚小胶囊**：常显「自动进食的料理 + 剩余数量」，点开才展开面板
// （选料理 / 开关自动进食 / 调阈值 / 立即吃酱料饮品）。原先它是半行的整卡，占地方又难找。
// 所有会开打的页面共用（对决技能页 / 竞技场 / 通天塔 / 秘境 / 试炼 / 厨神挑战）。
// ⚠️ 料理/酱料/饮品放在这里而不是战斗屏内部：它们**开打前就该能吃**（原先只在战斗中显示，
//    玩家没法先看一眼自己带没带饭）。战斗屏只留神秘调料/能量补给这两样战斗中才用的。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { getCombat } from '../game/combat/Combat.js'
import { getItem } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const combat = getCombat()

const open = ref(false)

const availableFoods = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.type === 'food' && getItem(id)?.heal)
    .map(([id, q]) => ({ id, qty: q, item: getItem(id) }))
    .sort((a, b) => b.item.heal - a.item.heal)
)
const availableSauces = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.buff)
    .map(([id, q]) => ({ id, qty: q, item: getItem(id) }))
)
const availableDrinks = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, q]) => q > 0 && getItem(id)?.type === 'drink')
    .map(([id, q]) => ({ id, qty: q, item: getItem(id) }))
)

// 当前指定的自动进食料理（null = 自动挑回血最高的）
const autoId = computed(() => player.settings.autoEatItem ?? null)
const autoItem = computed(() => (autoId.value ? getItem(autoId.value) : null))
const autoName = computed(() => autoItem.value?.name ?? '自动（回血最高）')
const autoQty = computed(() => (autoId.value ? (player.inventory[autoId.value] ?? 0) : 0))
// ⚠️ 指定品吃光了要说出来，否则玩家会以为「自动进食坏了」——引擎此时会回落到最高回血料理
const autoOut = computed(() => !!autoId.value && autoQty.value <= 0)
const chipTitle = computed(() => {
  if (!player.settings.autoEat) return '自动进食已关闭——点这里打开战备面板'
  if (!autoId.value) return `自动进食：品鉴值 ≤ ${player.settings.autoEatThreshold}% 时自动吃「回血最高」的料理`
  if (autoOut.value) return `自动进食：${autoName.value} 已吃完，暂时回落「回血最高」——点这里换一味`
  return `自动进食：品鉴值 ≤ ${player.settings.autoEatThreshold}% 时自动吃 ${autoName.value}`
})

function pickAuto(id) {
  player.settings.autoEatItem = id
  open.value = false
}
function setAutoEat(on) {
  player.settings.autoEat = on
}
function useItem(kind, id) {
  if (kind === 'food') combat.useFood(id)
  else if (kind === 'sauce') combat.useSauce(id)
  else if (kind === 'drink') combat.useDrink(id)
}
</script>

<template>
  <div class="combat-loadout">
    <button class="loadout-chip" :class="{ off: !player.settings.autoEat, out: autoOut }" :title="chipTitle" @click="open = !open">
      <span class="loadout-chip-icon">🍲</span>
      <span class="loadout-chip-label">战备</span>
      <span class="loadout-chip-name">{{ autoName }}</span>
      <span v-if="autoId" class="mono loadout-chip-qty" :class="{ 'is-out': autoOut }">×{{ autoQty }}</span>
      <span v-else class="loadout-chip-off">关</span>
      <span class="loadout-caret">▾</span>
    </button>

    <div v-if="open" class="loadout-pop">
      <div class="pop-head">
        <strong>战备</strong>
        <label class="pop-auto">
          <input type="checkbox" :checked="player.settings.autoEat" @change="setAutoEat($event.target.checked)" />
          自动进食
        </label>
        <button class="btn btn-sm" @click="open = false">✕</button>
      </div>
      <label class="pop-threshold">
        <span class="dim">品鉴值 ≤ {{ player.settings.autoEatThreshold }}% 时自动吃</span>
        <input type="range" min="10" max="90" step="10" :value="player.settings.autoEatThreshold" @input="player.settings.autoEatThreshold = Number($event.target.value)" />
      </label>

      <div class="pop-sect">
        <span class="pop-sect-title">自动吃哪一味（点一下选它）</span>
        <div class="pop-row" :class="{ on: !autoId }" @click="pickAuto(null)">
          <span class="pop-row-img pop-row-emoji">🔁</span>
          <span class="pop-row-name">自动（回血最高）</span>
          <span class="dim">随时跟着背包里最好的料理走</span>
          <span v-if="!autoId" class="pop-check">✓</span>
        </div>
        <div
          v-for="f in availableFoods"
          :key="f.id"
          class="pop-row"
          :class="{ on: autoId === f.id }"
          :title="`选「${f.item.name}」为自动进食的料理（回血 ${f.item.heal}）`"
          @click="pickAuto(f.id)"
        >
          <img v-if="itemImage(f.id)" class="pop-row-img" :src="itemImage(f.id)" alt="" @error="$event.target.style.display = 'none'" />
          <span class="pop-row-name">{{ f.item.name }}</span>
          <span class="mono dim">+{{ f.item.heal }}</span>
          <span class="mono dim">×{{ f.qty }}</span>
          <span v-if="autoId === f.id" class="pop-check">✓</span>
          <button class="btn btn-sm pop-row-use" title="立刻吃一个（不受冷却时立即生效）" @click.stop="useItem('food', f.id)">吃</button>
        </div>
        <p v-if="!availableFoods.length" class="dim">背包里没有料理 —— 做几道菜再来（战斗中也能吃）。</p>
        <p v-else-if="autoOut" class="dim">⚠️ 选定的料理已吃完，战斗里暂时回落「回血最高」。</p>
      </div>

      <div v-if="availableSauces.length || availableDrinks.length" class="pop-sect">
        <span class="pop-sect-title">立即使用（开打前也能吃）</span>
        <div class="pop-use-row">
          <button v-for="s in availableSauces" :key="s.id" class="btn btn-sm" @click="useItem('sauce', s.id)">
            🌶️ {{ s.item.name }} <span class="mono">×{{ s.qty }}</span>
          </button>
          <button v-for="d in availableDrinks" :key="d.id" class="btn btn-sm" @click="useItem('drink', d.id)">
            🥤 {{ d.item.name }} <span class="mono">×{{ d.qty }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 容器只占「胶囊那么宽」——展开面板是绝对定位浮层，不参与战斗屏排版 */
.combat-loadout {
  position: relative;
  min-width: 0;
}
/* 🔒 胶囊宽度必须恒定（同 BGM 胶囊的教训）：名字与数量都定宽 ——
   不然每吃一次料理 `×N` 从 12 变 11，回合进度条会跟着肉眼可见地抖一下。 */
.loadout-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  font-size: 12px;
  font-family: inherit;
  color: var(--text);
  background: rgba(var(--panel-soft-rgb), 0.9);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
}
.loadout-chip:hover {
  border-color: var(--primary);
}
.loadout-chip.off {
  opacity: 0.72;
}
.loadout-chip-icon {
  flex: 0 0 auto;
}
.loadout-chip-label {
  flex: 0 0 auto;
  color: var(--text-dim);
}
.loadout-chip-name {
  flex: 0 0 auto;
  width: 84px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  color: var(--primary);
}
.loadout-chip-qty {
  flex: 0 0 auto;
  width: 46px;
  text-align: right;
  color: var(--text-dim);
}
.loadout-chip-qty.is-out {
  color: var(--bad-strong);
}
/* 未指定料理时用「自动」替代数量格，保证宽度与其它状态一致 */
.loadout-chip-off {
  flex: 0 0 auto;
  width: 46px;
  text-align: right;
  color: var(--text-dim);
}
.loadout-caret {
  flex: 0 0 auto;
  font-size: 10px;
  color: var(--muted);
}
/* 展开面板：锚在胶囊下方左侧（战备在左上角 ⇒ 不能用 right 锚） */
.loadout-pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 30;
  width: min(340px, 84vw);
  max-height: 62vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  text-align: left;
  background: rgba(var(--panel-soft-rgb), 0.98);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(var(--scrim-rgb), 0.35);
}
.pop-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pop-head strong {
  margin-right: auto;
}
.pop-auto {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-dim);
  cursor: pointer;
}
.pop-threshold {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.pop-threshold input[type='range'] {
  width: 100%;
}
.pop-sect {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.pop-sect-title {
  font-size: 12px;
  color: var(--text-dim);
  border-bottom: 1px dashed rgba(var(--ink-rgb), 0.3);
  padding-bottom: 2px;
}
.pop-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 3px 6px;
  font-size: 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
}
.pop-row:hover {
  background: rgba(var(--primary-tint-rgb), 0.12);
}
.pop-row.on {
  border-color: var(--primary);
  background: rgba(var(--primary-tint-rgb), 0.16);
}
.pop-row-img {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  object-fit: contain;
}
.pop-row-emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}
.pop-row-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pop-check {
  flex: 0 0 auto;
  color: var(--primary);
}
.pop-row-use {
  flex: 0 0 auto;
}
.pop-use-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
/* 窄屏（≤720px）：战斗屏顶行要留宽度给回合进度条 ⇒ 胶囊藏掉「战备」二字、缩短名字格与数量格。
   （实测 390px 下不缩时进度条只剩 ~100px，「回合」这条唯一的进行感就没了。） */
@media (max-width: 720px) {
  .loadout-chip-label {
    display: none;
  }
  .loadout-chip-name {
    width: 62px;
  }
  .loadout-chip-qty,
  .loadout-chip-off {
    width: 34px;
  }
}
</style>
