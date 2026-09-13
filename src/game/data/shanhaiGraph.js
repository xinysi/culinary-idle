// 山海食经 · 图谱布局（v2.1）— **纯函数**，只读 shanhaiTree.js 算画布几何。
// 形态：辐射式巨树 —— 中心「根」+ **10 个扇区**（收集线）+ **10 圈同心环**（环门槛递进），每环每系 3 节点。
// 与 daoGraph.js 同一套视觉语言（圆形节点、支线色、环导轨、中心根与干枝、顶部牌匾），
// 差别只在规模（10×10×3 = 300 节点，画布 ~3800px，**一屏看不完是设计意图**）。
// 前 6 环＝收集/等级曲线，第 7~10 环＝大后期里程碑（技能 100 级 / 转生 1 / 5 / 10 次）。
// 另有「汇金链」：相邻两分支之间的 12° 空隙里，第 6~10 环各一个金币节点，沿空隙射线由内向外排成一条链；
// 以及外圈「珍券环」：最外侧环绕整圈的 10 个抽卡券节点（每 36°、对准各线射线、闭合成圈）。
import { SHANHAI_PATHS, SHANHAI_NODES, SHANHAI_RING_COUNT, SHANHAI_GAPS, SHANHAI_TICKET_RING } from './shanhaiTree.js'

/** 画布度量（改这里只影响观感，不影响玩法） */
export const SHANHAI_METRICS = {
  r: 28,               // 节点基准半径（实际按环分档：越外圈略大）
  // 角度预算（10 扇区 / 360° = 每系 36°）：**环内 2 段 + 扇区间隙 1 段，三段等宽 12°**
  //   → 环内相邻弦距 = 2R·sin(6°)、跨扇区弦距 = 2R·sin(6°)，都要 ≥ 节点直径 + 净距（≈72px）
  //   → 第 1 环至少 420。外圈按非线性步长拉开（越外越疏，观感更像巨树）
  //   环间步长 ≥ 120（节点直径 + 净距），越外越疏（非线性放大，观感更像巨树）：
  //   120/128/136/144/152/160/168/176/184 —— 第 7~10 环对应大后期四档里程碑
  rings: [420, 540, 668, 804, 948, 1100, 1260, 1428, 1604, 1788],
  spread: 24,          // 每扇区跨度（留 12° 间隙给相邻扇区）
  rootR: 44,
  labelGap: 0,         // 画布上不画名称（纯图标），保留字段以对齐 daoGraph 的接口
  padTop: 26,
  pad: 56,
  jitterR: 5,          // 半径方向确定性抖动（有机感，但别吃掉环间/节点间净距）
  jitterA: 0.7,        // 角度方向抖动（度）
}
/** 10 条收集线在圆周上的中心角（度）：从上开始顺时针排布 */
const SECTOR_CENTERS = Array.from({ length: 10 }, (_, i) => -90 + i * 36)

const RAD = Math.PI / 180
/** 确定性伪随机：同一 id 永远同一个值（布局可复现，截图/守卫都能复现） */
function rand01(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 100000) / 100000
}
const polar = (cx, cy, radius, deg) => ({ x: cx + radius * Math.cos(deg * RAD), y: cy + radius * Math.sin(deg * RAD) })

/** 整张图：节点 / 连线 / 扇区 / 环 / 根与干枝 / 牌匾 / 画布尺寸 */
export function shanhaiGraphLayout() {
  const M = SHANHAI_METRICS
  const R = M.rings
  const outerR = R[R.length - 1]
  const ticketR = Math.max(outerR, SHANHAI_TICKET_RING.r) // 外圈「珍券环」在最外侧，画布尺寸要算上它
  const cx = M.pad + ticketR + M.r + 48
  const cy = M.pad + M.padTop + ticketR + M.r + 48
  const width = cx * 2
  const height = cy * 2

  const nodes = []
  const branchNodes = SHANHAI_NODES.filter((n) => n.gap == null) // 汇金链单独排（见下）
  const sectors = SHANHAI_PATHS.map((p, pi) => {
    const centerDeg = SECTOR_CENTERS[pi % SECTOR_CENTERS.length]
    const own = branchNodes.filter((n) => n.path === p.id)
    own.forEach((n) => {
      const inRing = own.filter((x) => x.ring === n.ring)
      const slot = Math.max(0, inRing.findIndex((x) => x.id === n.id))
      // 越外圈节点略大（与「层级越高越重要」呼应）；同一环内按槽位展开
      const r = M.r - 2 + Math.round(n.ring / 2)
      const step = M.spread / (inRing.length - 1 || 1)
      const deg = centerDeg + (slot - (inRing.length - 1) / 2) * step + (rand01(n.id + 'a') - 0.5) * M.jitterA
      const radius = R[n.ring - 1] + (rand01(n.id + 'r') - 0.5) * M.jitterR
      const pos = polar(cx, cy, radius, deg)
      nodes.push({
        id: n.id, name: n.name, icon: n.icon, cost: n.req?.count ?? 0, effect: n.effect, desc: n.desc,
        pathId: p.id, pathName: p.name, pathIcon: p.icon, pathIndex: pi, tier: n.ring,
        tierReq: n.req?.level ?? 0, tierDesc: '',
        r, cx: pos.x, cy: pos.y, x: pos.x - r, y: pos.y - r, deg, radius,
      })
    })
    const a0 = centerDeg - M.spread / 2 - 3
    const a1 = centerDeg + M.spread / 2 + 3
    const rIn = R[0] - M.r - 26
    const rOut = outerR + M.r + 34
    const p1 = polar(cx, cy, rIn, a0), p2 = polar(cx, cy, rIn, a1)
    const p3 = polar(cx, cy, rOut, a1), p4 = polar(cx, cy, rOut, a0)
    return {
      id: p.id, name: p.name, icon: p.icon, desc: p.desc, index: pi, centerDeg,
      // 标题放在**中心附近、自己那条干枝上**（用户要求：显示在中心节点几条线的中间之间）——
      // 10 扇区相邻弦距 = 2r·sin(18°) ≈ 0.62r，标题底片宽约 110px → r ≥ 178，取 215 留余量。
      titleAt: polar(cx, cy, 215, centerDeg),
      // 每扇区一个「支线色」类（10 个色轮换 5 个语义色，相邻必不同）
      accent: `lane-a${pi}`,
      d: `M ${p1.x} ${p1.y} A ${rIn} ${rIn} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rOut} ${rOut} 0 0 0 ${p4.x} ${p4.y} Z`,
    }
  })

  // ── 汇金链：相邻两分支**之间**的空隙射线（两扇区中心角的中线 = +18°）──
  // 槽位只有 1 个（每环 1 个节点），所以不做扇区展开，直接落在空隙射线上、由内向外串成一条链。
  const gapResults = SHANHAI_GAPS.map((g, gi) => {
    const gapDeg = SECTOR_CENTERS[gi % SECTOR_CENTERS.length] + 360 / SECTOR_CENTERS.length / 2
    const own = SHANHAI_NODES.filter((n) => n.path === g.id)
    own.forEach((n) => {
      const radius = R[n.ring - 1] + (rand01(n.id + 'r') - 0.5) * M.jitterR
      const pos = polar(cx, cy, radius, gapDeg + (rand01(n.id + 'a') - 0.5) * M.jitterA)
      const r = M.r - 2 + Math.round(n.ring / 2)
      nodes.push({
        id: n.id, name: n.name, icon: n.icon, cost: n.req?.count ?? 0, effect: n.effect, desc: n.desc,
        // pathId 固定为 'gold' —— 画布按 `lane-<pathId>` 上色，`lane-gold` 就是金币支线色（见组件 CSS）
        pathId: 'gold', pathName: g.name, pathIcon: '🪙', pathIndex: 10 + g.index, tier: n.ring,
        gap: true, gapA: g.aName, gapB: g.bName, gapAskill: g.aSkill, gapBskill: g.bSkill,
        iconItem: n.iconItem, tierReq: n.req?.level ?? 0, tierDesc: '',
        r, cx: pos.x, cy: pos.y, x: pos.x - r, y: pos.y - r, deg: gapDeg, radius,
      })
    })
    return { id: g.id, gapDeg }
  })

  // ── 外圈「珍券环」（2026-09-13 用户追加，与厨神之路外环同款）：**环绕整棵树一整圈**的抽卡券节点 ──
  // 10 个节点对准 10 条线的射线（扇区中心角），落在第 10 环之外的半径上，互相连成**闭合的圈**。
  SHANHAI_PATHS.forEach((p, i) => {
    const n = SHANHAI_NODES.find((x) => x.path === 'ticket' && x.name.startsWith(p.name))
    if (!n) return
    const deg = SECTOR_CENTERS[i % SECTOR_CENTERS.length] + (rand01(n.id + 'a') - 0.5) * M.jitterA
    const radius = SHANHAI_TICKET_RING.r + (rand01(n.id + 'r') - 0.5) * M.jitterR
    const pos = polar(cx, cy, radius, deg)
    const r = M.r + 4
    nodes.push({
      id: n.id, name: n.name, icon: n.icon, cost: n.req?.nodes ?? 0, effect: n.effect, desc: n.desc,
      pathId: 'ticket', pathName: SHANHAI_TICKET_RING.name, pathIcon: '🎟️', pathIndex: SHANHAI_PATHS.length, tier: n.ring,
      ticket: true, reward: n.reward, req: n.req, iconItem: null, tierReq: 0, tierDesc: '已点亮节点数',
      r, cx: pos.x, cy: pos.y, x: pos.x - r, y: pos.y - r, deg, radius,
    })
  })
  // 同心环（只画导轨，不写层数文字）
  const rings = R.map((radius, i) => ({ tier: i + 1, radius }))

  // 连线：同扇区内层 → 外层（同槽为主边、相邻槽为副边）
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const links = []
  for (const p of SHANHAI_PATHS) {
    const own = SHANHAI_NODES.filter((n) => n.path === p.id)
    for (let ring = 1; ring < SHANHAI_RING_COUNT; ring++) {
      const from = own.filter((n) => n.ring === ring)
      const to = own.filter((n) => n.ring === ring + 1)
      for (const a of from) {
        const ia = from.findIndex((x) => x.id === a.id)
        for (const b of to) {
          const ib = to.findIndex((x) => x.id === b.id)
          const dist = Math.abs(ia - ib)
          if (dist > 1) continue
          const n1 = byId.get(a.id), n2 = byId.get(b.id)
          const ddx = n2.cx - n1.cx, ddy = n2.cy - n1.cy
          const len = Math.hypot(ddx, ddy) || 1
          const ux = ddx / len, uy = ddy / len
          const x1 = n1.cx + ux * (n1.r + 3), y1 = n1.cy + uy * (n1.r + 3)
          const x2 = n2.cx - ux * (n2.r + 3), y2 = n2.cy - uy * (n2.r + 3)
          links.push({
            from: a.id, to: b.id, pathId: p.id, main: dist === 0, tier: ring,
            x1, y1, x2, y2,
            c1x: x1 + ddx * 0.16, c1y: y1 + ddy * 0.16,
            c2x: x2 - ddx * 0.16, c2y: y2 - ddy * 0.16,
          })
        }
      }
    }
  }

  // 汇金链的连线：同一空隙内 环 r → 环 r+1（沿射线串成一条链，不接分支）
  for (const g of SHANHAI_GAPS) {
    const own = nodes.filter((n) => n.pathId === 'gold' && n.name.startsWith(g.name))
    for (let i = 0; i < own.length - 1; i++) {
      const a = own[i], b = own[i + 1]
      const ddx = b.cx - a.cx, ddy = b.cy - a.cy
      const len = Math.hypot(ddx, ddy) || 1
      const ux = ddx / len, uy = ddy / len
      const x1 = a.cx + ux * (a.r + 3), y1 = a.cy + uy * (a.r + 3)
      const x2 = b.cx - ux * (b.r + 3), y2 = b.cy - uy * (b.r + 3)
      links.push({
        from: a.id, to: b.id, pathId: 'gold', main: true, tier: a.tier, gold: true, x1, y1, x2, y2,
        c1x: x1 + ddx * 0.16, c1y: y1 + ddy * 0.16, c2x: x2 - ddx * 0.16, c2y: y2 - ddy * 0.16,
      })
    }
  }

  {
    const ringNodes = nodes.filter((n) => n.ticket)
    for (let i = 0; i < ringNodes.length; i++) {
      const a = ringNodes[i], b = ringNodes[(i + 1) % ringNodes.length]
      const ddx = b.cx - a.cx, ddy = b.cy - a.cy
      const len = Math.hypot(ddx, ddy) || 1
      const ux = ddx / len, uy = ddy / len
      const x1 = a.cx + ux * (a.r + 3), y1 = a.cy + uy * (a.r + 3)
      const x2 = b.cx - ux * (b.r + 3), y2 = b.cy - uy * (b.r + 3)
      links.push({
        from: a.id, to: b.id, pathId: 'ticket', main: true, tier: a.tier, ringLink: true, x1, y1, x2, y2,
        c1x: x1 + ddx * 0.18, c1y: y1 + ddy * 0.18,
        c2x: x2 - ddx * 0.18, c2y: y2 - ddy * 0.18,
      })
    }
  }

  // 中心根 + 10 条干枝（连到各系第 1 环的中间那颗）
  const root = { x: cx, y: cy, r: M.rootR }
  const trunks = SHANHAI_PATHS.map((p, pi) => {
    const mid = nodes.filter((n) => n.pathId === p.id && n.tier === 1).sort((a, b) => Math.abs(a.deg - SECTOR_CENTERS[pi]) - Math.abs(b.deg - SECTOR_CENTERS[pi]))[0]
    const dx = mid.cx - cx, dy = mid.cy - cy
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len, uy = dy / len
    return { pathId: p.id, d: `M ${cx + ux * (M.rootR + 5)} ${cy + uy * (M.rootR + 5)} L ${mid.cx - ux * (mid.r + 6)} ${mid.cy - uy * (mid.r + 6)}` }
  })

  // 顶部牌匾（进度条框）按用户要求删除：进度由页面右上的 HUD 承担
  return { nodes, links, sectors, rings, root, trunks, ticketRing: SHANHAI_TICKET_RING, width, height, focusX: cx, focusY: cy }
}
