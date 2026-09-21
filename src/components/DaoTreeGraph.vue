<script setup>
// 厨神之路 · 天赋树画布（v2.1）— SVG 单层 transform 的「可平移缩放节点图」。
// 形态：**辐射式科技树**（用户指定「从中心点向四周发散」）——中心是「根」，四条道途 = 四个扇区，
// 层数 = 三圈同心环（**环上不写「第几层」文字**，门槛在悬浮卡/详情卡里）。
// 画布上**只有图标**：节点为圆形徽章、居中标 emoji，不写名称、不画 ✓/＋/✕ 徽标（用户要求）。
// 每条道途的标题（`⚔️ 厨武之道 0/9`）放在**中心附近、自己那条干枝的内圈**，聚焦中心时四条标题都可见。
// 视觉参照《龟龟潜海记 Shelldiver》：支线色描边与连线 + 深底图标水印 + 顶部进度牌匾 + 金边提示卡（成本药丸）+ 右下操作提示。
//   · 拖动空白平移；滚轮以光标为锚点缩放；双指捏合；🔍 聚焦（中心居中）/ ⤢ 全览。
//   · 拖动超过 4px 不再触发点击；`pointerdown` 里**不**立即 setPointerCapture（否则 click 被改派、点不中节点）。
//   · SVG 图元不要写 `fill="var(--x)"`（属性不解析 var()），颜色一律写在 <style> 里。
//   · ⚠️ viewBox 必须与 SVG 的 CSS 高度同源（都取 svgH）：量外层容器（含工具栏）会让内容被拉伸、居中偏移。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { itemImage } from '../game/data/itemImage.js'

/**
 * 节点图标：彩色 emoji 是**位图字形**，直接放进会被缩放的 SVG <text> 里 → 放大即糊（实测 97% 下
 * 🔧/🧄 这些图标一眼可见低分辨率），而且每个节点都要走一次字形光栅化（400 个节点时的重绘大头）。
 * 改为**一次性预渲染成高清位图**（canvas 128px）再用 <image> 引用：
 *   · 每个 emoji 只光栅化一次，之后是纯位图采样 → 拖动/缩放更省
 *   · 128px 的精灵在节点图标（≈20~46px）的任何可读缩放下都清晰（放大到 3× 仍不糊）
 * 缓存是模块级的：厨神之路与山海食经共享同一批 emoji，只渲染一次。
 */
const SPRITE_PX = 128
const SPRITE_FONT = '108px "Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", "EmojiOne Color", sans-serif'
const spriteCache = new Map()
function spriteOf(emoji) {
  const key = String(emoji ?? '')
  if (spriteCache.has(key)) return spriteCache.get(key)
  const c = document.createElement('canvas')
  c.width = c.height = SPRITE_PX
  const g = c.getContext('2d')
  g.font = SPRITE_FONT
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(key, SPRITE_PX / 2, SPRITE_PX / 2 + 4) // +4：emoji 基线略偏下，视觉居中
  const url = c.toDataURL()
  spriteCache.set(key, url)
  return url
}

const props = defineProps({
  nodes: { type: Array, required: true },
  links: { type: Array, required: true },
  sectors: { type: Array, required: true },
  rings: { type: Array, default: () => [] },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  focusX: { type: Number, default: 0 },
  focusY: { type: Number, default: 0 },
  root: { type: Object, default: null },
  trunks: { type: Array, default: () => [] },
  /** 填充模式（整屏画布页用）：wrap 撑满父容器、工具栏浮在画布上、去掉卡片外框 */
  fill: { type: Boolean, default: false },
  /** 「聚焦」的默认缩放（0 = 自动：宽屏 0.9 / 窄屏 0.62）。
   *  节点规模大的树（山海食经 10 环）给 0.55 更合适，否则首屏只能看见最内一两环。 */
  focusScale: { type: Number, default: 0 },
})
const emit = defineEmits(['pick'])

/** 画布底纹水印用的 4 张物品图（原来是 emoji；用户反馈 emoji 不好看 → 统一成物品图，画面里不再有 emoji） */
const MARK_ITEMS = ['apple', 'wheat', 'spiritFruit', 'ironKnife']
const markHref = (i) => itemImage(MARK_ITEMS[i]) ?? ''

/** 图标显示尺寸（原来由 --dtg-icon 的字号决定，现在直接给 <image> 的宽高） */
function iconSize(n) {
  // 0.85：物品图比 emoji 细节多，小缩放下要占满盘面才看得清（原先 0.78 是给 emoji 留白的）
  return Math.max(14, Math.round((n.r ?? 28) * 0.85 * 2) / 2)
}
/**
 * 节点图标：**优先用该节点的物品图**（`iconItem`，见生成器 `iconItemOf`）。
 * 用户 2026-09-13：「emoji 也不好看，不如换成对应技能物品图片里选」——物品图是 32/64px 透明 PNG，
 * 比彩色 emoji 字形更贴合这本「食材图鉴」的气质，而且**没有字形光栅化成本**（连拖动时都不用藏起来）。
 * 没有 `iconItem` 的树（厨神之路的天赋节点）仍走 emoji 位图精灵兜底。
 */
function iconHref(n) {
  const rel = n.iconItem ? itemImage(n.iconItem) : null
  return rel || spriteOf(n.icon)
}

/**
 * ⚠️ 这里曾有一层「交互期冻结」（拖动时隐藏 emoji 图标 + 停掉呼吸动画，松手恢复）。
 * 2026-09-13 图标统一换成**物品图**后它已无必要、而且**有害**：实测同一台机器、
 * 121 个可点亮节点（121 个呼吸动画）下拖动帧时长——
 *   · 无冻结：中位 16.7ms / p95 **16.8ms**（最优）
 *   · 冻结全开：中位 16.7ms / p95 33.3ms（隐藏/恢复 400 张图反而造成重排重绘抖动，**肉眼可见闪烁**）
 * 所以整层删除。代价是：**若将来某棵树又用回 emoji 字形当节点图标**，需要把冻结加回来
 * （emoji 的字形光栅化 + 上百个 opacity 动画是那版最贵的两项，细节见 AGENTS「画布性能」一节）。
 */

const wrap = ref(null)
const svgEl = ref(null)
const vw = ref(0)          // 视口宽 = 容器实测宽（SVG 宽度 100%）
const k = ref(1)
const tx = ref(0)
const ty = ref(0)

// ⚠️ 最小缩放要**低于「全览」所需的比例**，否则最外圈节点永远进不了视野：
// 山海食经扩到 10 环 + 外圈珍券环后画布 ~4224×4276，在 ~980×830 的视口里全览需要 ≈0.19 → 取 0.16。
// （原先 0.28 时，第 10 环就已经在可视半径之外了。）
const MIN_K = 0.16
const MAX_K = 2.6
const clampK = (v) => Math.min(MAX_K, Math.max(MIN_K, v))

/** SVG 的 CSS 高度 = 视口高（与 viewBox 同源）：按内容宽高比取，夹在 360~620 */
const fillH = ref(0) // 填充模式下实测到的画布高度
const svgH = computed(() => {
  if (!vw.value || !props.width) return 440
  return Math.round(Math.min(620, Math.max(360, vw.value * (props.height / props.width) + 8)))
})
/** 视口高：填充模式 = 实测高度；否则 = 按内容宽高比算出的固定高度。
 *  ⚠️ 无论哪种，viewBox 与 SVG 的 CSS 高度**必须同源**（否则内容被拉伸、聚焦偏移）。 */
const vh = computed(() => (props.fill ? fillH.value || svgH.value : svgH.value))

/** 居中到画布坐标 (cx,cy)，并设缩放 */
function centerOn(cx, cy, scale) {
  k.value = clampK(scale)
  tx.value = vw.value / 2 - cx * k.value
  ty.value = vh.value / 2 - cy * k.value
}
/** 全览：整张图收进视野 */
function fit() {
  if (!vw.value) return
  centerOn(props.width / 2, props.height / 2, Math.min(vw.value / props.width, vh.value / props.height) * 0.96)
}
/** 聚焦：**中心「根」居中**（用户要求）——一屏看见中心 + 四条路的标题，再自己往外拖 */
function focus() {
  if (!vw.value) return
  const narrow = vw.value < 620
  // 窄屏一律 0.62（保证节点可点）；宽屏用 focusScale，未给则沿用 0.9
  const scale = narrow ? 0.62 : props.focusScale || 0.9
  centerOn(props.focusX || props.width / 2, props.focusY || props.height / 2, scale)
}
function zoomAt(px, py, factor) {
  const next = clampK(k.value * factor)
  if (next === k.value) return
  tx.value = px - (px - tx.value) * (next / k.value)
  ty.value = py - (py - ty.value) * (next / k.value)
  k.value = next
}
const zoomCenter = (f) => zoomAt(vw.value / 2, vh.value / 2, f)

// ── 指针交互 ──
const pointers = new Map()
let dragMoved = 0
let pinchStart = null
let capturedId = null
const hoverId = ref(null)
const tip = ref(null)

function localPoint(ev) {
  const r = svgEl.value.getBoundingClientRect()
  return { x: ev.clientX - r.left, y: ev.clientY - r.top }
}
function onPointerDown(ev) {
  if (ev.button !== undefined && ev.button !== 0) return
  pointers.set(ev.pointerId, localPoint(ev))
  dragMoved = 0
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: k.value, tx: tx.value, ty: ty.value, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
  }
}
function onPointerMove(ev) {
  if (!pointers.has(ev.pointerId)) return
  const prev = pointers.get(ev.pointerId)
  const now = localPoint(ev)
  pointers.set(ev.pointerId, now)
  if (pointers.size >= 2 && pinchStart) {
    const [a, b] = [...pointers.values()]
    const dist = Math.hypot(a.x - b.x, a.y - b.y)
    const next = clampK(pinchStart.k * (dist / (pinchStart.dist || 1)))
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    tx.value = mid.x - (pinchStart.mid.x - pinchStart.tx) * (next / pinchStart.k)
    ty.value = mid.y - (pinchStart.mid.y - pinchStart.ty) * (next / pinchStart.k)
    k.value = next
    dragMoved = 99
    return
  }
  const dx = now.x - prev.x
  const dy = now.y - prev.y
  dragMoved += Math.abs(dx) + Math.abs(dy)
  if (dragMoved > 4 && capturedId !== ev.pointerId) {
    capturedId = ev.pointerId
    svgEl.value.setPointerCapture?.(ev.pointerId)
  }
  tx.value += dx
  ty.value += dy
}
function onPointerUp(ev) {
  pointers.delete(ev.pointerId)
  if (pointers.size < 2) pinchStart = null
  if (capturedId === ev.pointerId) {
    svgEl.value.releasePointerCapture?.(ev.pointerId)
    capturedId = null
  }
}
function onWheel(ev) {
  const p = localPoint(ev)
  zoomAt(p.x, p.y, ev.deltaY < 0 ? 1.12 : 1 / 1.12)
}

// ── 悬浮提示 ──
function onNodeEnter(n, ev) {
  hoverId.value = n.id
  const r = wrap.value.getBoundingClientRect()
  tip.value = { x: ev.clientX - r.left, y: ev.clientY - r.top, node: n }
}
function onNodeLeave() {
  hoverId.value = null
  tip.value = null
}
function onNodeClick(n) {
  if (dragMoved > 4) return
  emit('pick', nodeState.value.get(n.id) ?? n)
}

// ── 派生 ──
const nodeState = computed(() => new Map(props.nodes.map((n) => [n.id, n])))
// 兼容两种状态字段名：厨神之路用 owned/unlocked，山海食经用 unlocked/can（v2.1 统一到这里）
const isOwned = (n) => n.owned === true || n.unlocked === true
const nodeClass = (n) => ({ owned: isOwned(n), can: n.can === true && !isOwned(n), locked: !isOwned(n) && n.can !== true })
const sectorStats = computed(() =>
  props.sectors.map((s) => {
    const own = props.nodes.filter((n) => n.pathId === s.id)
    return { ...s, owned: own.filter((n) => n.owned).length, total: own.length }
  })
)
const totals = computed(() => ({ owned: props.nodes.filter((n) => n.owned).length, total: props.nodes.length }))
/** 标题底片尺寸：按字数估宽（中文字 ~13.5px、数字 ~7.6px、图标 ~18px）——不依赖运行时文本测量 */
function titlePill(s) {
  const text = `${s.icon} ${s.name} ${s.owned}/${s.total}`
  const digits = String(`${s.owned}/${s.total}`).length
  const w = 20 + 18 + s.name.length * 13.5 + digits * 7.6 + 6 + 14
  return { text, w, h: 25, x: s.titleAt.x - w / 2, y: s.titleAt.y - 17.5 }
}
const hoverLinks = computed(() => {
  if (!hoverId.value) return null
  const set = new Set()
  for (const l of props.links) if (l.from === hoverId.value || l.to === hoverId.value) set.add(l.from + '>' + l.to)
  return set
})
const linkKey = (l) => l.from + '>' + l.to
function curve(l) {
  const c1x = l.c1x ?? l.x1, c1y = l.c1y ?? (l.y1 + l.y2) / 2
  const c2x = l.c2x ?? l.x2, c2y = l.c2y ?? (l.y1 + l.y2) / 2
  return `M ${l.x1} ${l.y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${l.x2} ${l.y2}`
}
const linkClass = (l) => ({
  main: l.main,
  lit: hoverLinks.value ? hoverLinks.value.has(linkKey(l)) : false,
  dim: hoverLinks.value ? !hoverLinks.value.has(linkKey(l)) : false,
})
/** 通行状态：两头都已解锁 = 实线最亮；只有出发端解锁 = 实线；都没解锁 = 淡虚线 */
function linkState(l) {
  const a = nodeState.value.get(l.from), b = nodeState.value.get(l.to)
  return a?.owned && b?.owned ? 'both' : a?.owned ? 'half' : 'none'
}
const zoomPct = computed(() => Math.round(k.value * 100))

// ── 尺寸测量与首次视图 ──
let ro = null
onMounted(() => {
  const r0 = wrap.value?.getBoundingClientRect()
  if (r0) {
    vw.value = Math.max(240, Math.round(r0.width))
    if (props.fill) fillH.value = Math.max(240, Math.round(r0.height))
  }
  focus()
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      const r = wrap.value?.getBoundingClientRect()
      if (!r) return
      vw.value = Math.max(240, Math.round(r.width))
      if (props.fill) fillH.value = Math.max(240, Math.round(r.height))
    })
    ro.observe(wrap.value)
  }
})
onBeforeUnmount(() => ro?.disconnect?.())
</script>

<template>
  <div ref="wrap" class="dtg-wrap" :class="{ 'dtg-wrap--fill': fill }">
    <div class="dtg-toolbar">
      <button class="btn btn-sm" title="放大" @click="zoomCenter(1.2)">＋</button>
      <button class="btn btn-sm" title="缩小" @click="zoomCenter(1 / 1.2)">－</button>
      <button class="btn btn-sm" title="回到中心节点（可读比例）" @click="focus">🔍 聚焦</button>
      <button class="btn btn-sm" title="整棵树收进视野" @click="fit">⤢ 全览</button>
      <span class="dim mono dtg-zoom">{{ zoomPct }}%</span>
      <span class="dtg-keys">
        <span class="dtg-key"><i class="dtg-kb">拖动</i>平移</span>
        <span class="dtg-key"><i class="dtg-kb">滚轮</i>缩放</span>
        <span class="dtg-key"><i class="dtg-kb">点击</i>详情</span>
        <span class="dtg-key"><i class="dtg-kb">悬停</i>看效果</span>
      </span>
    </div>

    <svg
      ref="svgEl"
      class="dtg-svg"
      :style="{ height: fill ? '100%' : svgH + 'px' }"
      :viewBox="`0 0 ${vw} ${svgH}`"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerUp"
      @wheel.prevent="onWheel"
    >
      <defs>
        <pattern id="dtgDots" :width="22" :height="22" patternUnits="userSpaceOnUse">
          <circle cx="1.4" cy="1.4" r="1.2" class="dtg-dot" />
        </pattern>
        <pattern id="dtgMarks" :width="264" :height="184" patternUnits="userSpaceOnUse">
          <image class="dtg-mark" :href="markHref(0)" x="6" y="24" width="56" height="56" />
          <image class="dtg-mark" :href="markHref(1)" x="140" y="104" width="56" height="56" />
          <image class="dtg-mark" :href="markHref(2)" x="46" y="140" width="52" height="52" />
          <image class="dtg-mark" :href="markHref(3)" x="196" y="14" width="60" height="60" />
        </pattern>
      </defs>

      <g :transform="`translate(${tx} ${ty}) scale(${k})`">
        <rect class="dtg-bg" x="0" y="0" :width="width" :height="height" fill="url(#dtgDots)" />
        <rect class="dtg-bg-marks" x="0" y="0" :width="width" :height="height" fill="url(#dtgMarks)" />

        <!-- 顶部牌匾（进度条框）已按用户要求删除（2026-09-13）：进度由各页面自己的 HUD 承担 -->

        <!-- 四条扇区（支线色淡染 + 虚线边界） -->
        <g class="dtg-sectors">
          <path v-for="s in sectorStats" :key="'sec-' + s.id" class="dtg-sector" :class="'lane-' + s.id" :d="s.d" />
        </g>

        <!-- 三条同心环（只画导轨，不写层数文字） -->
        <g class="dtg-rings">
          <circle v-for="r in rings" :key="'ring-' + r.tier" class="dtg-ring-guide" :cx="focusX" :cy="focusY" :r="r.radius" />
        </g>

        <!-- 道途标题 + 进度：放在中心附近、自己那条干枝的内圈（四条干枝之间），带淡色底片胶囊 -->
        <g class="dtg-sector-head">
          <template v-for="s in sectorStats" :key="'sh-' + s.id">
            <rect
              class="dtg-title-pill"
              :class="'lane-' + s.id"
              :x="titlePill(s).x"
              :y="titlePill(s).y"
              :width="titlePill(s).w"
              :height="titlePill(s).h"
              rx="12"
            />
            <text
              class="dtg-sector-title"
              :class="'lane-' + s.id"
              :x="s.titleAt.x"
              :y="s.titleAt.y"
              text-anchor="middle"
            >{{ titlePill(s).text }}</text>
          </template>
        </g>

        <!-- 装饰：中心「根」+ 四条干枝 -->
        <g class="dtg-deco">
          <path v-for="t in trunks" :key="'trunk-' + t.pathId" class="dtg-trunk" :class="'lane-' + t.pathId" :d="t.d" />
          <g v-if="root" class="dtg-root" :transform="`translate(${root.x} ${root.y})`">
            <circle class="dtg-root-halo" :r="root.r + 10" />
            <circle class="dtg-root-plate" :r="root.r" />
            <circle class="dtg-root-ring" :r="root.r - 7" />
            <!-- 根不写名字：身份由页面标题与顶部牌匾表达，腾出位置给四条道途的标题 -->
            <text class="dtg-root-icon" y="9">🛤️</text>
          </g>
        </g>

        <!-- 连线：支线色；内层 → 外层 -->
        <g class="dtg-links">
          <template v-for="l in links" :key="linkKey(l)">
            <path class="dtg-link-rail" :class="[linkClass(l), 'st-' + linkState(l), 'lane-' + l.pathId]" :d="curve(l)" />
            <path class="dtg-link-core" :class="[linkClass(l), 'st-' + linkState(l), 'lane-' + l.pathId]" :d="curve(l)" />
          </template>
        </g>

        <!-- 节点：圆形 + 居中图标（不写名称、不画徽标） -->
        <g
          v-for="n in nodes"
          :key="n.id"
          class="dtg-node"
          :class="[nodeClass(n), 'lane-' + n.pathId]"
          :transform="`translate(${n.cx} ${n.cy})`"
          role="button"
          tabindex="0"
          :aria-label="`${n.name}（${n.pathName}第 ${n.tier} 层，成本 ${n.cost} 枚）`"
          @click="onNodeClick(n)"
          @keydown.enter="onNodeClick(n)"
          @pointerenter="onNodeEnter(n, $event)"
          @pointermove="onNodeEnter(n, $event)"
          @pointerleave="onNodeLeave"
        >
          <circle class="dtg-halo" :r="n.r + 8" />
          <!-- 可解锁：外圈细环（在呼吸光晕之外再给一圈明确轮廓，和「未达条件」一眼分开） -->
          <circle class="dtg-outer" :r="n.r + 5" />
          <circle class="dtg-plate" :r="n.r" />
          <circle class="dtg-frame" :r="n.r" />
          <circle class="dtg-core" :r="n.r - 8" />
          <image
            class="dtg-icon"
            :href="iconHref(n)"
            preserveAspectRatio="xMidYMid meet"
            :x="-iconSize(n) / 2"
            :y="-iconSize(n) / 2"
            :width="iconSize(n)"
            :height="iconSize(n)"
          />
        </g>
      </g>
    </svg>

    <!-- 悬浮提示：金边 + 效果 + 成本药丸 -->
    <div v-if="tip" class="dtg-tipcard" :style="{ left: Math.min(tip.x + 14, vw - 232) + 'px', top: Math.min(tip.y + 12, vh - 120) + 'px' }">
      <div class="dtg-tipcard-head">
        <span>{{ tip.node.icon }} {{ tip.node.name }}</span>
        <span class="dtg-tipcard-lv">{{ tip.node.ring ? '外环' : tip.node.tierReq ? '需 ' + tip.node.tierReq + ' 个' : '无前置' }}</span>
      </div>
      <div class="dim dtg-tipcard-sub">{{ tip.node.pathName }} · {{ tip.node.ring ? `需全树已解锁 ${tip.node.tierReq} 个` : `第 ${tip.node.tier} 层` }}</div>
      <div class="dtg-tipcard-desc">{{ tip.node.desc }}</div>
      <div class="dtg-tipcard-foot">
        <span class="dtg-cost-pill">🪙 {{ tip.node.cost }}</span>
        <span class="dim">{{ tip.node.owned ? '已解锁' : tip.node.can ? '可解锁' : (tip.node.reason ?? '未达条件') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dtg-wrap {
  position: relative;
  margin-top: 12px;
  border: 1px dashed var(--border);
  border-radius: 14px;
  background: rgba(var(--panel-soft-rgb), 0.5);
  overflow: hidden;
}
.dtg-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border-bottom: 1px dashed var(--border);
}
.dtg-zoom {
  font-size: 12px;
  min-width: 42px;
  text-align: right;
}
.dtg-keys {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
}
.dtg-key {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-dim);
}
.dtg-kb {
  padding: 1px 6px;
  border-radius: 6px;
  font-style: normal;
  font-weight: 700;
  color: var(--text);
  background: rgba(var(--panel-rgb), 0.85);
  border: 1px solid var(--border);
}
/* 填充模式（整屏画布页）：撑满父容器、无卡片外框、工具栏浮在画布上 */
.dtg-wrap--fill {
  margin: 0;
  border: 0;
  border-radius: 0;
  background: none;
  height: 100%;
}
.dtg-wrap--fill .dtg-toolbar {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 4; /* 高于 .app-main::after 的金色描边环（z-index:3） */
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(var(--panel-rgb), 0.9);
  padding: 6px 8px;
  max-width: calc(100% - 16px);
}
/* 窄屏：收起「拖动/滚轮/点击/悬停」操作提示，让工具栏只占一行。
   页面自己还有一行同样的提示（如山海食经的「点节点查看条件与奖励（工具栏有操作提示）」），
   而整屏画布的工具栏是 `max-width: calc(100% - 16px)` 的浮层 —— 两行时它会横穿整幅，
   与右上角的进度 HUD（z-index 同为 4）叠在一起（实测 390px 下 HUD 压住「聚焦/全览」按钮）。 */
@media (max-width: 720px) {
  .dtg-wrap--fill .dtg-toolbar .dtg-keys { display: none; }
}

.dtg-svg {
  display: block;
  width: 100%;
  touch-action: none;
  cursor: grab;
  user-select: none;
}
.dtg-svg:active {
  cursor: grabbing;
}

/* ── 底纹 ── */
.dtg-bg {
  opacity: 0.5;
}
.dtg-dot {
  fill: rgba(var(--tint-rgb), 0.5);
}
.dtg-bg-marks {
  opacity: 0.055;
}
.dtg-mark {
  font-size: 40px;
}

/* ── 顶部牌匾 ── */
/* 顶部进度牌匾的样式已随牌匾一起删除（2026-09-13 用户要求；两个树都不再需要） */
.dtg-sector {
  fill: var(--lane-accent, var(--primary));
  opacity: 0.05;
  stroke: var(--lane-accent, var(--border));
  stroke-opacity: 0.22;
  stroke-dasharray: 6 7;
}
.dtg-ring-guide {
  fill: none;
  stroke: rgba(var(--tint-rgb), 0.28);
  stroke-dasharray: 4 8;
}
.dtg-title-pill {
  fill: rgba(var(--panel-rgb), 0.78);
  stroke: var(--lane-accent, var(--border));
  stroke-width: 1;
  stroke-opacity: 0.45;
}
.dtg-sector-title {
  fill: var(--lane-accent, var(--text));
  font-size: 13.5px;
  font-weight: 800;
}
/* 路别强调色（既有语义色，两主题都已过对比度体检；是身份色、不随皮肤） */
.lane-gather { --lane-accent: var(--good-strong); }
.lane-craft { --lane-accent: var(--warn-strong); }
.lane-combat { --lane-accent: var(--bad-strong); }
.lane-business { --lane-accent: var(--gold); }
/* 山海食经的「汇金」链：相邻分支之间空隙里的金币节点与连线（金色支线色） */
.lane-gold { --lane-accent: var(--gold); }
/* 厨神之路外环「觅珍环」（抽卡券节点）：用主色，与四条道途的语义色区分开 */
.lane-outer { --lane-accent: var(--primary); }
/* 山海食经外圈「珍券环」（抽卡券节点）：同主色 */
.lane-ticket { --lane-accent: var(--primary); }
/* 山海食经的 10 条收集线：轮换 5 个既有语义色（相邻扇区必不同色，且不新增色板） */
.lane-a0 { --lane-accent: var(--good-strong); }
.lane-a1 { --lane-accent: var(--warn-strong); }
.lane-a2 { --lane-accent: var(--bad-strong); }
.lane-a3 { --lane-accent: var(--gold); }
.lane-a4 { --lane-accent: var(--info); }
.lane-a5 { --lane-accent: var(--good-strong); }
.lane-a6 { --lane-accent: var(--warn-strong); }
.lane-a7 { --lane-accent: var(--bad-strong); }
.lane-a8 { --lane-accent: var(--gold); }
.lane-a9 { --lane-accent: var(--info); }

/* ── 中心根 / 干枝 ── */
.dtg-trunk {
  fill: none;
  stroke: var(--lane-accent, var(--primary));
  stroke-width: 9;
  stroke-linecap: round;
  opacity: 0.18;
}
.dtg-root {
  pointer-events: none;
}
.dtg-root-halo {
  fill: rgba(var(--primary-tint-rgb), 0.16);
}
.dtg-root-plate {
  fill: var(--primary);
  stroke: var(--primary-strong);
  stroke-width: 3;
}
.dtg-root-ring {
  fill: none;
  stroke: rgba(255, 255, 255, 0.7);
  stroke-width: 2;
}
.dtg-root-icon {
  font-size: 28px;
  text-anchor: middle;
}

/* ── 连线：支线色 ── */
.dtg-link-rail {
  fill: none;
  stroke: var(--lane-accent, var(--border));
  stroke-width: 7;
  stroke-linecap: round;
  opacity: 0.16;
}
.dtg-link-core {
  fill: none;
  stroke: var(--lane-accent, var(--border));
  stroke-width: 2.4;
  stroke-linecap: round;
  opacity: 0.5;
  stroke-dasharray: 7 6;
}
.dtg-link-core.st-half {
  stroke-dasharray: none;
  opacity: 0.85;
}
.dtg-link-rail.st-half {
  opacity: 0.26;
}
.dtg-link-core.st-both {
  stroke-dasharray: none;
  stroke-width: 3;
  opacity: 1;
}
.dtg-link-rail.st-both {
  opacity: 0.32;
}
.dtg-link-core.st-none {
  opacity: 0.28;
}
.dtg-link-core.lit {
  stroke-dasharray: none;
  stroke-width: 3.4;
  opacity: 1;
}
.dtg-link-rail.lit {
  opacity: 0.45;
}
.dtg-links .dim {
  opacity: 0.2;
}

/* ── 节点：圆形，只画图标 ── */
.dtg-node {
  cursor: pointer;
}
/* Chromium 会给可聚焦 SVG 元素画矩形默认焦点框（点一下就是「方形框」）→ 一律屏蔽，键盘导航靠自绘光晕 */
.dtg-node:focus,
.dtg-node:focus-visible {
  outline: none;
}
.dtg-node .dtg-halo {
  fill: rgba(var(--primary-tint-rgb), 0);
  transition: fill 0.18s ease;
}
.dtg-node .dtg-plate {
  fill: var(--lock-bg);
}
.dtg-node .dtg-frame {
  fill: none;
  stroke: var(--lane-accent, var(--muted));
  stroke-width: 3;
  opacity: 0.55;
}
.dtg-node .dtg-core {
  fill: rgba(var(--panel-rgb), 0.5);
}
.dtg-node .dtg-icon {
  /* 位图精灵（见脚本里的 spriteOf）：尺寸由 <image> 的 width/height 给，这里只管可交互与过渡 */
  pointer-events: none;
}
.dtg-node .dtg-outer {
  fill: none;
  stroke: var(--lane-accent, var(--primary));
  stroke-width: 1.6;
  opacity: 0;
  transition: opacity 0.18s ease;
}
.dtg-node.locked {
  /* 0.62 → 0.72：物品图（白盘/米/陶罐这类浅色占多）叠 0.62 后几乎看不清；
     「未达标」的区分仍由**虚线环 + 灰盘**承担，不依赖压暗图标 */
  opacity: 0.72;
}
.dtg-node.locked .dtg-frame {
  stroke-dasharray: 5 4;
}

/* 可解锁：支线色实线环 + 淡彩底 + 呼吸光晕（alpha ≤ 0.18） */
.dtg-node.can .dtg-plate {
  fill: rgba(var(--panel-rgb), 0.85);
}
.dtg-node.can .dtg-frame {
  stroke: var(--lane-accent, var(--primary));
  stroke-width: 3.5;
  opacity: 1;
}
.dtg-node.can .dtg-outer {
  opacity: 0.55;
}
.dtg-node.can .dtg-core {
  fill: rgba(var(--primary-tint-rgb), 0.1);
}
.dtg-node.can .dtg-halo {
  fill: rgba(var(--primary-tint-rgb), 0.16);
  animation: dtgPulse 2.6s ease-in-out infinite;
}
@keyframes dtgPulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
/* 交互期不再做任何「冻结/隐藏」——图标已是物品图（无字形光栅化），实测冻结反而更慢且会闪烁，
   详见脚本顶部那段说明。 */

/* 已解锁：实心主色圆 + 亮描边（实心颜色随皮肤走） */
.dtg-node.owned .dtg-plate {
  fill: var(--primary);
}
.dtg-node.owned .dtg-frame {
  stroke: var(--primary-strong);
  stroke-width: 3.5;
  opacity: 1;
}
.dtg-node.owned .dtg-core {
  fill: rgba(0, 0, 0, 0.12);
}
.dtg-node:hover .dtg-frame {
  stroke-width: 4;
  opacity: 1;
}
.dtg-node:focus-visible .dtg-halo {
  fill: rgba(var(--primary-tint-rgb), 0.2);
}

/* ── 悬浮提示卡 ── */
.dtg-tipcard {
  position: absolute;
  z-index: 5;
  width: 218px;
  padding: 9px 11px;
  border-radius: 10px;
  pointer-events: none;
  background: rgba(var(--panel-rgb), 0.98);
  border: 2px solid var(--border);
  box-shadow: 0 8px 22px rgba(var(--scrim-rgb), 0.26);
}
.dtg-tipcard-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 800;
  color: var(--text);
}
.dtg-tipcard-lv {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--muted);
  white-space: nowrap;
}
.dtg-tipcard-sub {
  font-size: 11.5px;
  margin-top: 2px;
}
.dtg-tipcard-desc {
  font-size: 12.5px;
  margin-top: 5px;
  color: var(--text);
}
.dtg-tipcard-foot {
  display: flex;
  /* ⚠️ 必须 flex-start + 药丸 nowrap：右侧原因文字一长就会折成两行，
     原先 align-items:center 会把左侧药丸压到中间、并且把药丸自身挤窄到「🪙 / 25」上下折行
     （用户实测截图：左边变成一个竖排小圆牌，与右边文字错位）。 */
  align-items: flex-start;
  gap: 8px;
  margin-top: 7px;
  padding-top: 6px;
  border-top: 1px dashed var(--border);
  font-size: 12px;
  line-height: 1.45;
}
.dtg-tipcard-foot > .dtg-cost-pill {
  flex: 0 0 auto;
  white-space: nowrap;
}
.dtg-tipcard-foot > .dim {
  flex: 1 1 auto;
  min-width: 0;
}
.dtg-cost-pill {
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 800;
  color: var(--text);
  background: rgba(var(--primary-tint-rgb), 0.16);
  border: 1px solid var(--border);
}
</style>
