// 厨神之路 · 图谱布局（v2.1）— **纯函数**，只读 DAO_PATHS / DAO_NODES 算画布几何。
// 形态：**辐射式科技树**（用户指定）——中心是「根」，四条道途 = 四个扇区，层数 = 三圈同心环，由内向外发散。
// 视觉参照《龟龟潜海记 Shelldiver》：菱形节点 + 支线色 + 状态徽标 + 支线色连线 + 顶部进度牌匾。
// 这里只负责「怎么画」，不改任何玩法数据；解锁规则仍在 `player.daoUnlock`（数据铁律：daoTree 只读）。
import { DAO_PATHS, DAO_TIER_REQ, DAO_NODES, DAO_OUTER, DAO_OUTER_NODES } from './daoTree.js'

/** 画布度量（改这里只影响观感，不影响玩法） */
export const GRAPH_METRICS = {
  r: 32,             // 节点基准半径（实际按成本分档 29/32/35）
  rings: [206, 332, 458, 596], // 层 1/2/3 的半径 + 外环「觅珍环」的半径（由内向外）
  spread: 68,        // 每个扇区的角度跨度（度）；四条道途 = 4 个扇区，互不重叠
  centers: [-135, -45, 45, 135], // 四个扇区的中心角（度）：左上/右上/右下/左下
  rootR: 40,         // 中心「根」节点半径
  padTop: 26,
  pad: 46,           // 画布四周留白
  jitterR: 9,        // 半径方向的确定性抖动（有机感，但不散）
  jitterA: 2.6,      // 角度方向的确定性抖动（度）
}

const RAD = Math.PI / 180
const TIER_DESC = {
  1: '无前置',
  2: `需本路 ${DAO_TIER_REQ[2]} 个`,
  3: `需本路 ${DAO_TIER_REQ[3]} 个`,
}

/** 确定性伪随机（同一 id 永远得到同一个 0~1 值）：用于抖动，保证布局可复现（截图/守卫都能复现） */
function rand01(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 100000) / 100000
}

/** 极坐标 → 画布坐标（中心由调用处传入） */
const polar = (cx, cy, radius, deg) => ({ x: cx + radius * Math.cos(deg * RAD), y: cy + radius * Math.sin(deg * RAD) })

/**
 * 整张图：节点（圆心 + 菱形边长 + 朝外的标签锚点）/ 连线 / 扇区 / 环 / 根与干枝 / 牌匾 / 画布尺寸。
 */
export function daoGraphLayout() {
  const M = GRAPH_METRICS
  const R = M.rings
  // 外圈半径 + 节点半径 + 外缘留白（标签已不画在画布上，这里只留出呼吸空间）
  const outerPad = 96
  const cx = M.pad + R[R.length - 1] + M.r + outerPad
  const cy = M.pad + M.padTop + R[R.length - 1] + M.r + outerPad
  const width = cx * 2
  const height = cy * 2

  const nodes = []
  const sectors = DAO_PATHS.map((p, pi) => {
    const centerDeg = M.centers[pi % M.centers.length]
    const own = DAO_NODES.filter((n) => n.path === p.id).sort((a, b) => a.tier - b.tier || String(a.id).localeCompare(String(b.id)))
    own.forEach((n) => {
      const inTier = own.filter((x) => x.tier === n.tier)
      const slot = Math.max(0, inTier.findIndex((x) => x.id === n.id)) // 同层内第几个（0/1/2）
      const r = M.r - 4 + (n.cost ?? 1) * 3
      // 层内展开：−spread/2 … +spread/2；再叠一点确定性抖动（半径与角度各一点，禁随机）
      const step = M.spread / (inTier.length - 1 || 1)
      const deg = centerDeg + (slot - (inTier.length - 1) / 2) * step + (rand01(n.id + 'a') - 0.5) * M.jitterA
      const radius = R[n.tier - 1] + (rand01(n.id + 'r') - 0.5) * M.jitterR
      const pos = polar(cx, cy, radius, deg)
      // 画布上**只画图标**（用户要求）：名称 / 效果 / 成本都放在悬浮提示卡与详情卡里，
      // 所以这里不需要标签锚点，节点就是一枚圆形徽章。
      nodes.push({
        id: n.id, name: n.name, icon: n.icon, cost: n.cost, effect: n.effect, desc: n.desc,
        pathId: p.id, pathName: p.name, pathIcon: p.icon, pathIndex: pi, tier: n.tier,
        tierReq: DAO_TIER_REQ[n.tier] ?? 0, tierDesc: TIER_DESC[n.tier] ?? '',
        r, cx: pos.x, cy: pos.y, x: pos.x - r, y: pos.y - r, deg, radius,
      })
    })
    // 扇区「楔形」路径：内缘弧 → 外缘弧（含两层弧，用两条径向边闭合）
    const a0 = centerDeg - M.spread / 2 - 6
    const a1 = centerDeg + M.spread / 2 + 6
    const rIn = R[0] - M.r - 22
    const rOut = R[R.length - 1] + M.r + 30
    const p1 = polar(cx, cy, rIn, a0), p2 = polar(cx, cy, rIn, a1)
    const p3 = polar(cx, cy, rOut, a1), p4 = polar(cx, cy, rOut, a0)
    return {
      id: p.id, name: p.name, icon: p.icon, desc: p.desc, index: pi, centerDeg,
      // 标题放在**中心「根」附近、自己这条干枝的内圈**（用户要求）：夹在相邻两条干枝之间，
      // 一屏聚焦中心时四条路的标题全都看得见，不用把画布拖到外圈去找。
      titleAt: polar(cx, cy, M.rootR + 78, centerDeg),
      d: `M ${p1.x} ${p1.y} A ${rIn} ${rIn} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rOut} ${rOut} 0 0 0 ${p4.x} ${p4.y} Z`,
    }
  })

  // 环（层）：整圈淡色导轨 + 左侧标签（放在扇区之间的空隙里，不会压到节点）
  // 同心环：只画导轨，**不写「第几层」文字**（用户要求；层门槛在悬浮卡与详情卡里）
  const rings = [1, 2, 3].map((tier) => ({ tier, radius: R[tier - 1] }))

  // 连线：内层节点 → 外层节点（同扇区；同槽位为主边、相邻槽位为副边）
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const links = []
  for (const p of DAO_PATHS) {
    const own = DAO_NODES.filter((n) => n.path === p.id)
    for (let tier = 1; tier < 3; tier++) {
      const from = own.filter((n) => n.tier === tier)
      const to = own.filter((n) => n.tier === tier + 1)
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
          // 控制点沿半径方向略微外推 → 连线自然贴着放射方向弯曲
          links.push({
            from: a.id, to: b.id, pathId: p.id, main: dist === 0, tier,
            x1, y1, x2, y2,
            c1x: x1 + ddx * 0.18, c1y: y1 + ddy * 0.18,
            c2x: x2 - ddx * 0.18, c2y: y2 - ddy * 0.18,
          })
        }
      }
    }
  }

  // ── 外环「觅珍环」（2026-09-13 用户要求）：**环绕整棵树一整圈** ──
  // 12 个节点均匀铺在第 4 圈（半径 596，每 30°，从正上方起顺时针），互相连成**闭合的圈**。
  const OUTER_R = R[R.length - 1]
  DAO_OUTER.forEach((n, i) => {
    const deg = -90 + i * (360 / DAO_OUTER_NODES) + (rand01(n.id + 'a') - 0.5) * M.jitterA
    const radius = OUTER_R + (rand01(n.id + 'r') - 0.5) * M.jitterR
    const pos = polar(cx, cy, radius, deg)
    const r = M.r - 4 + 6 // 与「2 枚印记」档同大小
    nodes.push({
      id: n.id, name: n.name, icon: n.icon, cost: n.cost ?? 0, effect: n.effect, desc: n.desc,
      pathId: 'outer', pathName: '觅珍环', pathIcon: '🎟️', pathIndex: DAO_PATHS.length, tier: n.tier,
      ring: true, reward: n.reward, req: n.req, tierReq: n.req?.daoNodes ?? 0, tierDesc: '全树节点数',
      r, cx: pos.x, cy: pos.y, x: pos.x - r, y: pos.y - r, deg, radius,
    })
  })
  // 闭合圈：i → i+1（含最后一个回到第一个）
  {
    const ringNodes = nodes.filter((n) => n.pathId === 'outer')
    for (let i = 0; i < ringNodes.length; i++) {
      const a = ringNodes[i], b = ringNodes[(i + 1) % ringNodes.length]
      const ddx = b.cx - a.cx, ddy = b.cy - a.cy
      const len = Math.hypot(ddx, ddy) || 1
      const ux = ddx / len, uy = ddy / len
      const x1 = a.cx + ux * (a.r + 3), y1 = a.cy + uy * (a.r + 3)
      const x2 = b.cx - ux * (b.r + 3), y2 = b.cy - uy * (b.r + 3)
      links.push({
        from: a.id, to: b.id, pathId: 'outer', main: true, tier: a.tier, ringLink: true,
        x1, y1, x2, y2,
        c1x: x1 + ddx * 0.18, c1y: y1 + ddy * 0.18,
        c2x: x2 - ddx * 0.18, c2y: y2 - ddy * 0.18,
      })
    }
  }

  // 根（中心）+ 干枝（中心 → 每条路第 1 层三节点的中间那个）
  const root = { x: cx, y: cy, r: M.rootR }
  const trunks = DAO_PATHS.map((p) => {
    const mid = nodes
      .filter((n) => n.pathId === p.id && n.tier === 1)
      .sort((a, b) => Math.abs(a.deg - (M.centers[DAO_PATHS.indexOf(p)] ?? 0)) - Math.abs(b.deg - (M.centers[DAO_PATHS.indexOf(p)] ?? 0)))[0]
    const ux = (mid.cx - cx) / (Math.hypot(mid.cx - cx, mid.cy - cy) || 1)
    const uy = (mid.cy - cy) / (Math.hypot(mid.cx - cx, mid.cy - cy) || 1)
    return { pathId: p.id, d: `M ${cx + ux * (M.rootR + 4)} ${cy + uy * (M.rootR + 4)} L ${mid.cx - ux * (mid.r + 6)} ${mid.cy - uy * (mid.r + 6)}` }
  })

  // 顶部牌匾（进度条框）已按用户要求删除：进度改由页面 HUD/详情卡承担，画布不再压一个横幅
  return { nodes, links, sectors, rings, root, trunks, width, height, focusX: cx, focusY: cy }
}
