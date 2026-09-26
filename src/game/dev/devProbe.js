// 开发者工具 · 实时探针与注入（2026-09-25 新增）——服务面板的「📡 实时」「💉 注入」两个页签
//
// ⚠️ 与 devTools.js 同一条纪律：**只读写这台机器上的存档（Pinia store）与本机遥测，
//    绝不写 `src/game/data/*`**（守卫 `scripts/ci/dev_panel_audit.mjs` 的 C1 组会把本文件一并扫掉）。
import { ITEMS, itemName } from '../data/items.js'

/* ── 📡 实时 ─────────────────────────────────────────────────
 * FPS：rAF 计数，按两次采样间隔折算；JS 堆：performance.memory（Chromium 专属，没有则给 null）；
 * 长任务：PerformanceObserver('longtask')，>50ms 的主线程任务；
 * 引擎 tick：外部传入 ui.loopTick 计数器，按间隔差折算成 tick/秒。
 * 面板打开才 start()，关闭/卸载必须 stop()（rAF 与 Observer 不能常驻）。 */
export function createLiveProbe({ getTick = () => 0 } = {}) {
  let rafId = null
  let frames = 0
  let longTasks = 0
  let worstTaskMs = 0
  let obs = null
  const mark = { at: performance.now(), frames: 0, tick: getTick() }

  const onTask = (list) => {
    for (const e of list.getEntries()) {
      longTasks++
      worstTaskMs = Math.max(worstTaskMs, e.duration)
    }
  }
  const raf = () => { frames++; rafId = requestAnimationFrame(raf) }

  function start() {
    if (rafId == null) rafId = requestAnimationFrame(raf)
    if (!obs && 'PerformanceObserver' in window) {
      try {
        obs = new PerformanceObserver(onTask)
        obs.observe({ entryTypes: ['longtask'], buffered: false })
      } catch { obs = null }
    }
  }
  function stop() {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null }
    if (obs) { obs.disconnect(); obs = null }
  }
  /** 两次调用之间隔 ≥500ms 才有意义；返回自上次采样以来的速率与累计值 */
  function snapshot() {
    const now = performance.now()
    const dtSec = (now - mark.at) / 1000
    const tickNow = getTick()
    const out = {
      fps: dtSec > 0 ? Math.round((frames - mark.frames) / dtSec) : 0,
      tickPerSec: dtSec > 0 ? +((tickNow - mark.tick) / dtSec).toFixed(1) : 0,
      longTasks,
      worstTaskMs: Math.round(worstTaskMs),
      heapMb: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      heapLimitMb: performance.memory ? Math.round(performance.memory.jsHeapSizeLimit / 1048576) : null,
      online: navigator.onLine,
      ts: Date.now(),
    }
    mark.at = now
    mark.frames = frames
    mark.tick = tickNow
    return out
  }
  return { start, stop, snapshot }
}

/** localStorage 用量：全部 culinary-idle.* 键按字节排序（utf-16 计），另给总量与最大单键 */
export function collectStorageUsage() {
  const rows = []
  let total = 0
  for (const k of Object.keys(localStorage)) {
    const bytes = (localStorage.getItem(k) || '').length * 2
    total += bytes
    if (k.startsWith('culinary-idle.')) rows.push({ key: k, kb: +(bytes / 1024).toFixed(1) })
  }
  rows.sort((a, b) => b.kb - a.kb)
  return { rows, totalKb: +(total / 1024).toFixed(1), count: rows.length }
}

/** 存储配额（Chromium 支持；拿不到给 null） */
export async function estimateQuota() {
  try {
    if (!navigator.storage?.estimate) return null
    const { usage, quota } = await navigator.storage.estimate()
    return { usedMb: +((usage ?? 0) / 1048576).toFixed(1), quotaMb: Math.round((quota ?? 0) / 1048576) }
  } catch { return null }
}

/* ── 💉 注入 ───────────────────────────────────────────────── */

/** 可直接赋值的资源字段（只碰存档层；id = player store 上的真实路径） */
export const CURRENCY_FIELDS = [
  { id: 'gold', label: '金币' },
  { id: 'gameCoins', label: '游戏币' },
  { id: 'tastePoints', label: '品鉴点' },
  { id: 'mijian.tickets', label: '觅珍券' },
]

export function setCurrency(player, id, n) {
  const v = Math.max(0, Math.floor(Number(n) || 0))
  const seg = id.split('.')
  let obj = player
  for (let i = 0; i < seg.length - 1; i++) {
    obj = obj?.[seg[i]]
    if (!obj || typeof obj !== 'object') return `路径 ${id} 不存在（父级缺失）`
  }
  const leaf = seg[seg.length - 1]
  // 🔴 只拒绝「已是其它类型」的字段：undefined/数值都放行 —— 觅珍券（mijian.tickets）等字段
  //    在新档上**本来就不存在**（拿到第一张券才动态出现），要求「已是数值」会让注入静默不生效
  //    （2026-09-25 用户实测踩过）。
  if (obj[leaf] != null && typeof obj[leaf] !== 'number') return `字段 ${id} 不是数值（是 ${typeof obj[leaf]}）`
  obj[leaf] = v
  return `${id} = ${v.toLocaleString()}`
}

/** 资源增发：在现值上加 n（与 setCurrency 同一条路径校验；现值不存在按 0 起算） */
export function addCurrency(player, id, n) {
  const d = Math.floor(Number(n) || 0)
  const seg = id.split('.')
  let obj = player
  for (let i = 0; i < seg.length - 1; i++) {
    obj = obj?.[seg[i]]
    if (!obj || typeof obj !== 'object') return `路径 ${id} 不存在（父级缺失）`
  }
  const leaf = seg[seg.length - 1]
  const cur = (typeof obj[leaf] === 'number' && Number.isFinite(obj[leaf])) ? obj[leaf] : 0
  obj[leaf] = Math.max(0, cur + d)
  return `${id} ${cur.toLocaleString()} → ${obj[leaf].toLocaleString()}`
}

/** 单件物品入库（食灵走食灵阁）。⚠️ 输入框允许直接打**中文名**：先按 id 查，再按名字精确/包含匹配，
 *  （2026-09-25 用户实测：只认 id 时打「苹果」会报「未知物品」，看起来就是注入不生效） */
export function grantItemById(player, itemId, qty = 99) {
  const n = Math.max(1, Math.floor(Number(qty) || 1))
  let it = ITEMS[itemId]
  let key = itemId
  if (!it) {
    const byName = Object.keys(ITEMS).filter((k) => itemName(k) === itemId)
    const pool = byName.length ? byName : Object.keys(ITEMS).filter((k) => (itemName(k) || '').includes(itemId) && itemId.length >= 2)
    if (pool.length === 0) return `❌ 没有叫「${itemId}」的物品（试试点输入框从下拉列表选 id）`
    key = pool[0]
    it = ITEMS[key]
    if (pool.length > 1) return `❓「${itemId}」匹配到 ${pool.length} 种物品，请从下拉列表里选具体的（如：${pool.slice(0, 3).map((k) => itemName(k)).join('、')}…）`
  }
  if (it.type === 'spirit') {
    player.spirits.owned[key] = (player.spirits.owned[key] ?? 0) + 1
    return `食灵阁 +1：${it.name}`
  }
  player.inventory[key] = (player.inventory[key] ?? 0) + n
  return `入库 ${it.name} ×${n}`
}

export const ALL_ITEM_IDS = Object.keys(ITEMS)
export const itemLabel = (id) => (ITEMS[id] ? `${ITEMS[id].name}（${id}）` : '')

/* 存档「往返稳定性」体检：serialize → JSON → parse 再 stringify，比对是否一致。
 * 抓的是「NaN/Infinity 被 JSON 变 null」「undefined 字段被静默丢弃」这类只有序列化才暴露的问题。
 * 真正的不变量体检（幽灵物品/负数/越界）在「🩺 体检」页签的 saveInspector 里，两者互补。
 * ⚠️ player.serialize() 返回的就是 player 对象本身（SaveManager 再包一层 {schemaVersion, savedAt, player}），
 *    所以这里的顶层键数 = 存档里 player 的字段数。 */
export function saveRoundtrip(player) {
  const data = player.serialize()
  const s1 = JSON.stringify(data)
  const unstable = []
  if (s1.includes('NaN') || s1.includes('Infinity')) unstable.push('串里含 NaN/Infinity')
  let parsed
  try { parsed = JSON.parse(s1) } catch (e) { return { ok: false, msg: `JSON 解析失败：${e.message}` } }
  const s2 = JSON.stringify(parsed)
  if (s1 !== s2) unstable.push(`两次序列化不一致（${s1.length} → ${s2.length} 字符）`)
  const kb = +(s1.length * 2 / 1024).toFixed(1)
  const topKeys = Object.keys(data).length
  return {
    ok: unstable.length === 0,
    msg: `${kb} KB · player 顶层 ${topKeys} 键${unstable.length ? ' · ⚠️ ' + unstable.join('；') : ' · 往返一致'}`,
  }
}
