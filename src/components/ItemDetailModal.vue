<script setup>
// 物品详情弹窗 — 图鉴/背包/仓库点击物品后显示：详细作用 + 获取来源 + 可用于制作
import { computed, ref, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { itemDetailLines, itemSourcesOf } from '../game/data/itemDetail.js'
import { itemUses } from '../game/data/itemUses.js'
import { itemImage } from '../game/data/itemImage.js'

const props = defineProps({
  itemId: { type: String, required: true },
})
const emit = defineEmits(['close'])
const player = usePlayerStore()
const ui = useUiStore()

// 获取来源 → 可跳转界面（按字符串关键词识别）
function jumpForSource(s) {
  if (s.includes('采摘')) return { view: 'skill', skill: 'foraging' }
  if (s.includes('垂钓')) return { view: 'skill', skill: 'fishing' }
  if (s.includes('狩猎')) return { view: 'skill', skill: 'hunting' }
  if (s.includes('挖掘')) return { view: 'skill', skill: 'excavation' }
  if (s.includes('农耕')) return { view: 'skill', skill: 'farming' }
  if (s.includes('烹饪')) return { view: 'skill', skill: 'cooking' }
  if (s.includes('烘焙')) return { view: 'skill', skill: 'baking' }
  if (s.includes('腌制')) return { view: 'skill', skill: 'preserving' }
  if (s.includes('调酒')) return { view: 'skill', skill: 'brewing' }
  if (s.includes('调料') || s.includes('香料')) return { view: 'skill', skill: 'spiceMixing' }
  if (s.includes('锻造')) return { view: 'skill', skill: 'craftsmithing' }
  if (s.includes('保鲜')) return { view: 'skill', skill: 'preservation' }
  if (s.includes('探索')) return { view: 'skill', skill: 'exploration' }
  if (s.includes('商店') || s.includes('购买')) return { view: 'shop' }
  if (s.includes('赛季')) return { view: 'season' }
  if (s.includes('BOSS') || s.includes('首领') || s.includes('击败')) return { view: 'skill', skill: 'knife' }
  if (s.includes('炼金')) return { view: 'alchemy' }
  if (s.includes('成就')) return { view: 'log' }
  if (s.includes('主线任务') || s.includes('任务')) return { view: 'log' }
  if (s.includes('契约') || s.includes('食灵')) return { view: 'skill', skill: 'spiritSummoning' }
  if (s.includes('觅珍') || s.includes('抽卡')) return { view: 'mijian' }
  if (s.includes('竞技场')) return { view: 'arena' }
  return null
}
function jumpSource(s) {
  const t = jumpForSource(s)
  if (!t) return
  if (t.skill) player.activeSkill = t.skill
  if (t.view === 'log') ui.openLogTab('log')
  else ui.setView(t.view)
  emit('close')
}

// 可在弹窗内切换查看其他物品（点击产物/来源物品名）
const innerId = ref(props.itemId)
watch(
  () => props.itemId,
  (v) => (innerId.value = v),
)
function show(id) {
  if (id && getItem(id)) {
    innerId.value = id
    showAllSources.value = false
    showAllUses.value = false
  }
}

const it = computed(() => getItem(innerId.value))
const lines = computed(() => itemDetailLines(innerId.value))
const sources = computed(() => itemSourcesOf(innerId.value))
const uses = computed(() => itemUses(innerId.value))
const owned = computed(() => (player.inventory[innerId.value] ?? 0) + (player.bank[innerId.value] ?? 0) + (player.spirits?.owned?.[innerId.value] ?? 0))
const collected = computed(() => !!player.collected[innerId.value])
// 超长来源/用途折叠：来源/产成过多时默认展开前 N 条，避免弹窗被万能材料（盐/水等）刷屏
const SOURCE_LIMIT = 12
const USE_LIMIT = 12
const showAllSources = ref(false)
const showAllUses = ref(false)
const shownSources = computed(() => (showAllSources.value ? sources.value : sources.value.slice(0, SOURCE_LIMIT)))
const shownUses = computed(() => (showAllUses.value ? uses.value : uses.value.slice(0, USE_LIMIT)))
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal item-detail-modal">
      <header class="modal-head">
        <h3>
          {{ it?.name }}
          <span v-if="it?.quality" class="badge" :style="{ background: 'var(--sidebar-bg)', color: 'var(--text)' }">{{ it.quality }}</span>
          <span v-if="!collected" class="badge" style="background: var(--lock-bg); color: var(--muted)">未获得</span>
          <span v-else class="badge badge-on">已获得 ×{{ owned }}</span>
        </h3>
        <button class="btn btn-sm" @click="emit('close')">✕</button>
      </header>

      <div class="item-detail-body">
        <img v-if="itemImage(innerId)" :src="itemImage(innerId)" class="item-img item-img-lg" @error="$event.target.style.display = 'none'" alt="" />
        <h4>详细作用</h4>
        <table class="target-table item-detail-table">
          <tbody>
            <tr v-for="[label, value] in lines" :key="label">
              <td class="dim" style="width: 90px; white-space: nowrap">{{ label }}</td>
              <td>{{ value }}</td>
            </tr>
          </tbody>
        </table>

        <!-- 可用于制作：该物品作为材料参与的配方（点击产物名查看产物详情）-->
        <h4 v-if="uses.length">可用于制作 <span v-if="uses.length > USE_LIMIT" class="dim" style="font-size:12px">（共 {{ uses.length }} 种，显示前 {{ USE_LIMIT }} 种）</span></h4>
        <ul v-if="uses.length" class="item-detail-src">
          <li v-for="u in shownUses" :key="u.outputId">
            · <a class="link-item" @click="show(u.outputId)">{{ u.name }}</a> ×{{ u.qty }}
          </li>
        </ul>
        <button v-if="uses.length > USE_LIMIT" class="btn btn-sm" @click="showAllUses = !showAllUses">
          {{ showAllUses ? '收起' : `展开全部（${uses.length - USE_LIMIT}）` }}
        </button>

        <h4>获取来源 <span v-if="sources.length > SOURCE_LIMIT" class="dim" style="font-size:12px">（共 {{ sources.length }} 条，显示前 {{ SOURCE_LIMIT }} 条）</span></h4>
        <ul class="item-detail-src">
          <li v-for="(s, i) in shownSources" :key="i">
            <span v-if="jumpForSource(s)" class="src-link" role="button" @click="jumpSource(s)">· {{ s }} ↗</span>
            <template v-else>· {{ s }}</template>
          </li>
          <li v-if="!sources.length" class="dim">（游戏中探索获取）</li>
        </ul>
        <button v-if="sources.length > SOURCE_LIMIT" class="btn btn-sm" @click="showAllSources = !showAllSources">
          {{ showAllSources ? '收起' : `展开全部（${sources.length - SOURCE_LIMIT}）` }}
        </button>
      </div>
    </div>
  </div>
</template>
