<script setup>
// 精通池状态条（2026-09-19）——采集页与制作页共用
//
// 池是什么：每次动作的精通次数有 25% 同时记进**技能级**的池；池在 10/25/50/95% 给**整个技能**
// 发双倍产出/成功率/经验加成，**且只在池 ≥ 阈值时生效**（花掉就失去）；
// 池点数还能 1:1 补给任意卡片。详见 `game/core/mastery.js` 顶部。
//
// 设计要点（改动前先读）：
// 1. **一个数字都不手写**：档位、上限、百分比、下一档差额全从 `player.masteryPoolState()` /
//    `MASTERY_POOL_TIERS` 派生——手抄副本会与函数各自演化（本项目踩过 `gen_tales` 的括号事故）。
// 2. 不给池加进度动画/流光：池会随每次动作小幅变动，动画会让整条框持续抖动（用户明确讨厌抖）。
// 3. 「补给」按钮**把要花掉的量写在按钮上**（`补给 N 次`）——花钱会掉档，玩家必须能事先看见代价。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { MASTERY_POOL_TIERS, MASTERY_POOL_GAIN_RATE, MASTERY_LEVEL_CAP, countForMasteryLevel } from '../game/core/mastery.js'
import ProgressBar from './ProgressBar.vue'

const props = defineProps({
  skillId: { type: String, required: true },
  // 补给目标：采集类传 itemId、制作类传配方 id；为空时按钮禁用并说明原因
  cardKey: { type: String, default: null },
  cardName: { type: String, default: '' },
  mode: { type: String, default: 'gather' }, // gather | craft
  // 该卡当前精通次数（用于算「还差多少才满」）
  cardCount: { type: Number, default: 0 },
})

const player = usePlayerStore()
const ui = useUiStore()
// 详情默认收起：档位表与规则是低频信息（见模板注释）
const expanded = ref(false)

const st = computed(() => player.masteryPoolState(props.skillId))
const pctText = computed(() => `${(st.value.pct * 100).toFixed(1)}%`)
const isCraft = computed(() => props.mode === 'craft')
/** 满精通所需次数——**从函数派生**，绝不手写 3750（本项目的铁律：手抄副本会与函数各自演化） */
const MAX_COUNT = countForMasteryLevel(MASTERY_LEVEL_CAP)
const need = computed(() => Math.max(0, MAX_COUNT - (props.cardCount || 0)))
const canSpend = computed(() => !!props.cardKey && need.value > 0 && st.value.pool > 0)
const willSpend = computed(() => Math.max(0, Math.floor(Math.min(st.value.pool, need.value))))
const tiers = computed(() =>
  MASTERY_POOL_TIERS.map((t) => ({
    ...t,
    pctText: `${Math.round(t.pct * 100)}%`,
    reached: st.value.tierIdx >= 0 && st.value.pct >= t.pct,
  }))
)
const nextText = computed(() => {
  const n = st.value.next
  if (!n) return '已达最高档'
  return `距「${n.tier.name}」还差 ${Math.ceil(n.need)} 点`
})

function doSpend() {
  const moved = player.spendMasteryPool(props.skillId, props.cardKey, willSpend.value)
  if (moved > 0) {
    ui.pushLog(`精通池补给：${props.cardName || props.cardKey} +${moved} 次精通（池余 ${Math.floor(player.skills[props.skillId].masteryPool)}）`, 'info')
  } else {
    ui.pushLog('精通池补给失败：池为空或该卡已满精通', 'warn')
  }
}
</script>

<template>
  <div class="card mastery-pool">
    <!-- 收起态 = 一行（用户 2026-09-19 反馈「技能页上方堆得过多、目标列表被压下去」）：
         池的档位表与说明是**低频信息**，不该常驻占三行。只保留「当前进度 + 距下一档 + 补给」，
         其余收进「详情」。 -->
    <div class="mp-line">
      <strong>🏊 精通池</strong>
      <span class="mono mp-pct">{{ pctText }}</span>
      <!-- 大数值加千位分隔（2026-09-21 用户报「数值显示」）：原先 176400 这种直接数字面上 -->
      <span class="dim mono">{{ Math.floor(st.pool).toLocaleString() }} / {{ st.cap.toLocaleString() }}</span>
      <span v-if="st.tier" class="mp-tier on">{{ Math.round(st.tier.pct * 100) }}% {{ st.tier.name }}</span>
      <span class="dim mp-next">{{ nextText }}</span>
      <button class="btn btn-sm" :disabled="!canSpend" :title="canSpend ? `把池里的 ${willSpend} 点补给「${cardName}」；花掉会让池掉档、加成随之消失` : '需要先选中一个还没满精通的卡片'" @click="doSpend">
        {{ canSpend ? `补给「${cardName}」${willSpend} 次` : (cardKey ? '该卡已满精通' : `先选一个${isCraft ? '配方' : '目标'}`) }}
      </button>
      <button class="btn btn-sm btn-ghost" :title="expanded ? '收起精通池详情' : '展开精通池详情（档位与规则）'" @click="expanded = !expanded">
        {{ expanded ? '收起 ▴' : '详情 ▾' }}
      </button>
    </div>
    <template v-if="expanded">
      <ProgressBar :progress="st.pct" class="mp-bar" />
      <div class="mp-tiers">
        <span
          v-for="t in tiers"
          :key="t.name"
          class="mp-tier"
          :class="{ on: t.reached }"
          :title="`池达到 ${t.pctText} 起（且保持不低于该值）时生效：双倍产出 +${t.doublePP}pp${t.successPP ? ` · 制作成功率 +${t.successPP}pp` : ''}${t.xpPct ? ` · 经验 +${t.xpPct}%` : ''}`"
        >{{ t.pctText }} {{ t.name }}</span>
      </div>
      <div class="dim mp-note">
        每次动作的精通次数有 {{ Math.round(MASTERY_POOL_GAIN_RATE * 100) }}% 也记进该技能的池（上限 = 卡片数 × 每卡额度）。
        池点数可 <b>1:1 补给任意卡片</b>的精通，但<b>花掉会让池掉档、加成随之消失</b>——攒着还是花掉，是取舍。
      </div>
    </template>
  </div>
</template>

<style scoped>
.mastery-pool {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
/* 收起态就一行：flex 行 + 允许折行（窄屏时按钮掉到第二行，不会把数字挤成竖排） */
.mp-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.mp-pct {
  font-weight: 700;
  color: var(--primary);
}
.mp-bar {
  height: 8px;
}
.mp-tiers {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}
.mp-tier {
  border: 1px dashed var(--border);
  border-radius: 999px;
  padding: 0 8px;
  color: var(--muted);
  white-space: nowrap;
}
/* 已达成：实线 + 主色（用 --primary-rgb 三元组做底，跟主题/皮肤走） */
.mp-tier.on {
  border-style: solid;
  border-color: var(--primary);
  color: var(--primary);
  background: rgba(var(--primary-rgb), 0.1);
  font-weight: 600;
}
.mp-next {
  white-space: nowrap;
}
.mp-note {
  font-size: 12px;
  line-height: 1.6;
}
</style>
