<script setup>
// 山海食经（v2.1 新增）— 收集驱动的巨型科技树：**整屏一块画布**。
// 口径（用户 2026-09-13 拍板）：
//   · 10 条收集线 × 10 环 × 3 节点 = 300 节点，中心向外发散（辐射式，复用 DaoTreeGraph 画布）
//     前 6 环＝收集件数 + 技能等级；第 7~10 环＝大后期里程碑（技能 100 级 / 转生 1 / 5 / 10 次）
//   · **纯条件点亮**：该线已收集件数 + 该技能等级达标即可，**不消耗任何资源**
//   · 奖励只有**固定数值**：背包/仓库/冷库格数、离线上限小时、采集每次 +1 件（无任何百分比）
//   · 点亮是两步：点节点 → 再点「确认点亮」；条件不足时**按钮不置灰**，点了给红色失败反馈
// 布局：中间区域整块画布（`.main-scroll--bleed`），工具栏/图例/详情都浮在画布上。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { SHANHAI_PATHS, SHANHAI_RING_COUNT } from '../game/data/shanhaiTree.js'
import { shanhaiGraphLayout } from '../game/data/shanhaiGraph.js'
import { shanhaiPathTotal } from '../game/data/shanhaiProgress.js'
import { itemImage } from '../game/data/itemImage.js'
import { sfx } from '../game/core/sound.js'
import DaoTreeGraph from '../components/DaoTreeGraph.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const graph = shanhaiGraphLayout()

// 节点状态（收集件数 + 技能等级）合进画布节点
const states = computed(() => new Map(player.shanhaiStates().map((n) => [n.id, n])))
const graphNodes = computed(() =>
  graph.nodes.map((n) => {
    const st = states.value.get(n.id) ?? {}
    // ⚠️ 画布组件读的是 `owned`/`can`（厨神之路的字段名），山海食经的状态里叫 `unlocked`
    //   → 必须在这里对齐，否则已点亮的节点会被画成「未达标」（实测踩过一次）。
    return { ...n, ...st, owned: st.unlocked === true, can: st.can === true }
  })
)
const totals = computed(() => {
  const list = [...states.value.values()]
  return { owned: list.filter((n) => n.unlocked).length, total: list.length, can: list.filter((n) => n.can).length }
})
/** 汇金链（相邻两分支之间的金币节点）进度：默认视角下它们在屏幕外，HUD 里给一行进度 */
const ticketTotals = computed(() => {
  const list = [...states.value.values()].filter((n) => n.ticket === true)
  return { owned: list.filter((n) => n.unlocked).length, total: list.length }
})
const goldTotals = computed(() => {
  const list = [...states.value.values()].filter((n) => n.gap != null)
  return { owned: list.filter((n) => n.unlocked).length, total: list.length }
})

// 点节点 → 详情面板（**不改玩法**：点亮仍走 player.shanhaiUnlock）
const picked = ref(null)
const msg = ref('')
const msgBad = ref(false)
const pickedState = computed(() => {
  if (!picked.value) return null
  const st = states.value.get(picked.value.id)
  const gn = graph.nodes.find((n) => n.id === picked.value.id)
  return st ? { ...gn, ...st } : picked.value
})
/** 详情面板图标：优先物品图（与画布一致；用户反馈 emoji 不好看） */
const panelIcon = computed(() => (picked.value?.iconItem ? itemImage(picked.value.iconItem) : null))
/** 该线总可收集数（进度条分母）；汇金节点跨两条线，用它的成对门槛当分母 */
/** 进度类节点（外圈珍券环）：条件看的是「已点亮节点数」 */
const isProgress = computed(() => pickedState.value?.req?.kind === 'progress')
const pathTotal = computed(() => {
  if (!picked.value) return 0
  if (picked.value.gap || picked.value.ticket) return pickedState.value?.need ?? 0
  return shanhaiPathTotal(picked.value.pathId)
})

function pick(node) {
  picked.value = node
  msg.value = ''
}
function closePanel() {
  picked.value = null
  msg.value = ''
}
/** 第二步：确认点亮。条件不足**不置灰按钮**，点了给明确失败原因。 */
function light(pk) {
  const r = player.shanhaiUnlock(pk.id)
  if (!r.ok) {
    msgBad.value = true
    msg.value = `点亮失败：${r.msg}`
    sfx.error()
    ui.pushLog(`📖 「${pk.name}」点亮失败：${r.msg}`, 'warn')
    return
  }
  msgBad.value = false
  // 优先展示「实际到账」（容量类可能与节点文案不同：满上限时会顺位转投其它容量）
  msg.value = `已点亮「${pk.name}」· ${r.landed || (r.node.desc.split('→').pop()?.trim() ?? '')}`
  sfx.reward()
  ui.pushLog(`📖 山海食经点亮「${pk.name}」`, 'good')
}
/** 「去收集 ↗」：按条件跳到对应技能页（只切视图，不改任何状态） */
const SKILL_VIEW = { foraging: 'skill', fishing: 'skill', hunting: 'skill', excavation: 'skill', farming: 'farming', cooking: 'skill', baking: 'skill', brewing: 'skill', spiceMixing: 'skill', craftsmithing: 'skill' }
function goCollect(pk) {
  // 汇金节点横跨两条线：跳到第一条线对应的技能页
  const skill = pk.gap ? (pk.gapAskill ?? 'foraging') : SHANHAI_PATHS.find((x) => x.id === pk.pathId)?.skill
  if (skill === 'farming') ui.setView('farming')
  else {
    player.setActiveSkill(skill ?? 'foraging')
    ui.setView('skill')
  }
}

const RELATED = [
  { view: 'log', label: '📖 图鉴' },
  { view: 'achievements', label: '🏅 成就称号' },
  { view: 'stats', label: '📊 统计' },
  { view: 'dao', label: '🛤️ 厨神之路' },
]
const RING_NAME = ['初识', '渐熟', '通晓', '精研', '大成', '化境', '圆满', '轮回', '历劫', '悟道']
const ringName = (t) => RING_NAME[t - 1] ?? `第 ${t} 环`
</script>

<template>
  <div class="skill-view shanhai-view">
    <!-- 整屏画布（工具栏由画布组件在 fill 模式下浮在左上角） -->
    <div class="sh-wrap">
      <DaoTreeGraph
        fill
        :focus-scale="0.55"
        :nodes="graphNodes"
        :links="graph.links"
        :sectors="graph.sectors"
        :rings="graph.rings"
        :width="graph.width"
        :height="graph.height"
        :focus-x="graph.focusX"
        :focus-y="graph.focusY"
        :root="graph.root"
        :trunks="graph.trunks"
        @pick="pick"
      />

      <!-- 右上：总进度 + 图例 -->
      <div class="sh-hud">
        <div class="sh-hud-title">📖 山海食经 · 已点亮 <b class="mono">{{ totals.owned }}</b> / {{ totals.total }}</div>
        <div class="sh-hud-sub">可点亮 <b class="mono">{{ totals.can }}</b> · {{ SHANHAI_PATHS.length }} 线 × {{ SHANHAI_RING_COUNT }} 环 · 纯条件点亮（不消耗资源）</div>
        <div class="sh-hud-sub">🪙 汇金 <b class="mono">{{ goldTotals.owned }}</b> / {{ goldTotals.total }} · 相邻两线之间、第 6 环起 → 金币</div>
        <div class="sh-hud-sub">🎟️ 珍券 <b class="mono">{{ ticketTotals.owned }}</b> / {{ ticketTotals.total }} · 最外圈环绕整圈 → 每节点 100 张觅珍抽卡券</div>
        <div class="sh-legend">
          <span><i class="lg owned"></i>已点亮</span>
          <span><i class="lg can"></i>可点亮</span>
          <span><i class="lg locked"></i>未达标</span>
        </div>
      </div>

      <!-- 右下：节点详情（两步点亮）；未选中时同一位置给一句提示 -->
      <p v-if="!pickedState" class="sh-hint">点节点查看条件与奖励（工具栏有操作提示）</p>
      <div v-if="pickedState" class="sh-panel">
        <div class="sh-panel-head">
          <img
            v-if="panelIcon"
            class="sh-panel-icon"
            :src="panelIcon"
            alt=""
            @error="$event.target.style.visibility = 'hidden'"
          />
          <span v-else class="sh-panel-icon">{{ pickedState.icon }}</span>
          <div class="sh-panel-title">
            <strong>{{ pickedState.name }}</strong>
            <div class="dim sh-panel-sub">
              {{ pickedState.pathIcon }} {{ pickedState.pathName }}{{ pickedState.pair || pickedState.ticket ? '' : '线' }}
              · {{ pickedState.ticket ? '外圈' : ringName(pickedState.tier) }}
            </div>
          </div>
          <button class="btn btn-sm" @click="closePanel">✕</button>
        </div>

        <p class="sh-panel-effect">🎁 {{ pickedState.desc.split('→').pop()?.trim() }}</p>

        <!-- 条件进度：收集件数 + 技能等级 -->
        <div class="sh-req">
          <div class="sh-req-row">
            <span class="dim">{{ isProgress ? '已点亮' : '已收集' }}</span>
            <span class="mono" :class="{ ok: pickedState.have >= pickedState.need }">{{ Math.min(pickedState.have, pickedState.need) }} / {{ pickedState.need }}</span>
            <span class="dim sh-req-tail">{{ pickedState.have >= pickedState.need ? '✓ ' : '' }}{{ isProgress ? `${pickedState.pathName}：全树已点亮节点数` : pickedState.pair ? `${pickedState.pair.join(' + ')} 两线合计` : `${pickedState.pathName}线已收集` }} {{ pickedState.have }} / {{ pathTotal }}{{ isProgress ? ' 个' : ' 件' }}</span>
          </div>
          <div class="sh-bar"><i :style="{ width: Math.min(100, Math.round((pickedState.have / Math.max(1, pickedState.need)) * 100)) + '%' }"></i></div>
          <div v-if="pickedState.needLevel" class="sh-req-row">
            <span class="dim">技能等级</span>
            <span class="mono" :class="{ ok: pickedState.level >= pickedState.needLevel }">{{ pickedState.level }} / {{ pickedState.needLevel }}</span>
          </div>
          <div v-if="pickedState.needLevel" class="sh-bar"><i :style="{ width: Math.min(100, Math.round((pickedState.level / Math.max(1, pickedState.needLevel)) * 100)) + '%' }"></i></div>
          <div v-if="pickedState.needPrestige" class="sh-req-row">
            <span class="dim">转生次数</span>
            <span class="mono" :class="{ ok: pickedState.prestige >= pickedState.needPrestige }">{{ pickedState.prestige }} / {{ pickedState.needPrestige }}</span>
            <span class="dim sh-req-tail">转生要求技能先满 100 级（转生后等级归 1，故里程碑只看转生次数）</span>
          </div>
          <div v-if="pickedState.needPrestige" class="sh-bar"><i :style="{ width: Math.min(100, Math.round((pickedState.prestige / Math.max(1, pickedState.needPrestige)) * 100)) + '%' }"></i></div>
        </div>

        <div class="sh-panel-foot">
          <span v-if="pickedState.unlocked" class="badge">✓ 已点亮</span>
          <span v-else class="dim">{{ pickedState.reason }}</span>
          <button v-if="!pickedState.unlocked" class="btn btn-sm btn-primary" @click="light(pickedState)">确认点亮</button>
          <button v-else-if="!pickedState.ticket" class="btn btn-sm" @click="goCollect(pickedState)">去收集 ↗</button>
        </div>
        <p v-if="msg" class="sh-msg" :class="{ bad: msgBad }">{{ msg }}</p>
      </div>
      <!-- 左下：相关页面（常驻，紧凑；原来放在左上会和画布工具栏重叠，实测踩过） -->
      <div class="sh-related">
        <RelatedPages :links="RELATED" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 整屏画布：根容器撑满 .main-scroll（该页由 .main-scroll--bleed 变成 flex 列） */
.shanhai-view {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.sh-wrap {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  border-radius: 0;
  overflow: hidden;
}

/* 右上 HUD */
.sh-hud {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 4;
  max-width: min(320px, 56%);
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(var(--panel-rgb), 0.9);
  font-size: 12.5px;
}
.sh-hud-title {
  font-weight: 800;
  color: var(--text);
}
.sh-hud-sub {
  margin-top: 2px;
  color: var(--text-dim);
}
.sh-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 6px;
  color: var(--text-dim);
}
.sh-legend .lg {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
}
.sh-legend .lg.owned {
  background: var(--primary);
  border: 1px solid var(--primary-strong);
}
.sh-legend .lg.can {
  background: rgba(var(--primary-tint-rgb), 0.18);
  border: 1px solid var(--primary);
}
.sh-legend .lg.locked {
  background: var(--lock-bg);
  border: 1px dashed var(--muted);
}

/* 右下详情面板 */
.sh-panel {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 4;
  width: min(340px, 92%);
  padding: 10px 12px;
  border: 2px solid var(--border);
  border-radius: 12px;
  background: rgba(var(--panel-rgb), 0.96);
  box-shadow: 0 10px 26px rgba(var(--scrim-rgb), 0.24);
}
.sh-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sh-panel-icon {
  font-size: 24px;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  object-fit: contain; /* 物品图（32/64px PNG）等比放进方形框 */
}
.sh-panel-title {
  display: flex;
  flex-direction: column;
}
.sh-panel-sub {
  font-size: 11.5px;
}
.sh-panel-head .btn {
  margin-left: auto;
}
.sh-panel-effect {
  margin: 8px 0 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}
.sh-req {
  margin-top: 6px;
}
.sh-req-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12.5px;
}
.sh-req-row .mono {
  font-weight: 800;
  color: var(--bad-strong);
}
.sh-req-row .mono.ok {
  color: var(--good-strong);
}
.sh-req-tail {
  font-size: 11.5px;
  margin-left: auto;
}
.sh-bar {
  height: 5px;
  margin: 3px 0 6px;
  border-radius: 3px;
  background: rgba(var(--tint-rgb), 0.26);
  overflow: hidden;
}
.sh-bar > i {
  display: block;
  height: 100%;
  background: var(--primary);
}
.sh-panel-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--border);
}
.sh-panel-foot .btn {
  margin-left: auto;
  /* 条件不足时左侧会列出「还差 N 件 · 需转生 M 次」两三条原因，
     按钮必须保持单行、不许被挤成两行（实测截过「确认点 / 亮」） */
  flex: 0 0 auto;
  white-space: nowrap;
}
.sh-panel-foot > .dim {
  min-width: 0;
  flex: 1 1 auto;
}
.sh-msg {
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--good-strong);
}
.sh-msg.bad {
  color: var(--bad-strong);
}

/* 底部提示与相关页面 */
.sh-hint {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 4;
  margin: 0;
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: var(--text-dim);
  background: rgba(var(--panel-rgb), 0.85);
  border: 1px solid var(--border);
}
.sh-related {
  position: absolute;
  left: 8px;
  bottom: 8px;
  z-index: 4;
  max-width: 56%;
}
/* 窄屏：底部留给详情卡，隐藏相关页面（内容审计只做静态检查，不受影响） */
@media (max-width: 720px) {
  .sh-related {
    display: none;
  }
}
</style>
