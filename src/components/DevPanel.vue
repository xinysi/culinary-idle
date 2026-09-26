<script setup>
// 开发者页面（2026-09-25 起）——**只在包含开发者模式的构建里存在**
//
// 形态（用户拍板「要独立出来」）：**整页接管**——铺满视口、覆盖在游戏/启动页之上，
//   游戏内与启动页同一形态；「↩ 返回」收起回到原界面。
// 排版参照管理后台/游戏调试台的通行做法（2026-09-25 网上调研）：
//   · 头部控制条 = 标题 + 实时状态 chips（FPS / JS 堆 / tick 速率 / 网络）+ 全局动作
//   · 左侧分区导航（窄屏折叠成横向滚动条），内容区 = 卡片网格（自动流式布局）
//   · 操作分组：一键配置 / 资源 / 物品 / 进度定位 / 系统重置 / 时间与队列（运行时与注入合并）
//   · 页底操作日志（带清空），监控页 = 明细表
// 入口三选一：启动页标题连点 5 下 · Ctrl+Shift+D · URL ?dev=1；登录 = 开发者名 + 口令（devAuth.js）
// （**挡板，不是安全边界**；真正的保护是构建期隔离）。
//
// ⚠️ 页面只操作这台机器上的存档，**不改 `src/game/data/*` 的冻结数据**（见 devTools.js 头注）。
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { DEV_PANEL_ENABLED, devLogout } from '../game/dev/devFlag.js'
import { DEV_DEFAULT_PASSWORD_HINT } from '../game/dev/devAuth.js'
import * as T from '../game/dev/devTools.js'
import * as P from '../game/dev/devProbe.js'
import { inspectSave, summarizeInspection } from '../game/dev/saveInspector.js'
import { FIRST_MARKS, readTelemetry, resetTelemetry, exportTelemetryCsv, pushMark } from '../game/dev/telemetry.js'
import { NEWBIE_STEPS, NEWBIE_TOTAL } from '../game/data/newbieChain.js'
import { saveManager, saveNow, deleteSlot, importSaveToSlot } from '../game/bootstrap.js'

const ui = useUiStore()
const player = usePlayerStore()

const SECTIONS = [
  { id: 'ops', label: '⚙ 运行时 & 注入' },
  { id: 'save', label: '💾 存档管理' },
  { id: 'mark', label: '📊 埋点与漏斗' },
  { id: 'check', label: '🩺 体检' },
  { id: 'monitor', label: '📡 监控' },
]
const section = ref('ops')
const log = ref([])
const inspectRows = ref([])
const fileInput = ref(null)

const inGame = computed(() => ui.phase === 'game')
const slots = computed(() => saveManager.listSlots().map((s) => ({
  ...s,
  sizeKb: s.data ? Math.round(JSON.stringify(s.data).length / 1024) : 0,
  savedAt: s.data?.savedAt ? new Date(s.data.savedAt).toLocaleString() : '—',
  version: s.data?.schemaVersion ?? '—',
  gold: s.data?.player?.gold ?? 0,
})))

function say(text, ok = true) {
  log.value.unshift({ at: new Date().toLocaleTimeString(), text, ok })
  log.value = log.value.slice(0, 40)
}
function clearLog() { log.value = [] }

/** 包一层：任何动作抛错都在页面里显示，不让它炸到控制台 */
function run(label, fn) {
  try {
    const msg = fn()
    say(`${label}：${msg ?? 'ok'}`)
  } catch (e) {
    say(`${label} 失败：${e?.message ?? e}`, false)
  }
}

/** 返回：收起整页，回到游戏/启动页 */
function goBack() {
  ui.showDevPanel = false
}
/** 锁定：清会话登录并收起 */
function lockNow() {
  devLogout()
  ui.showDevPanel = false
}

/* ── 一键配置 ── */
const actions = [
  { id: 'maxOut', label: '⚡ 一键满配', hint: '金币 + 全物品 + 技能满级 + 全解锁（答辩演示用）', fn: () => T.maxOut(player) },
  { id: 'gold', label: '💰 金币 10 亿', hint: '直接赋值（会被存档保留）', fn: () => T.grantGold(player) },
  { id: 'coins', label: '🪙 游戏币 100 万', hint: '小游戏专有货币，直接赋值', fn: () => T.grantGameCoins(player) },
  { id: 'items', label: '📦 全物品入库 ×999', hint: '食灵进食灵阁，不占背包格', fn: () => T.grantAllItems(player) },
  { id: 'skills', label: '🎓 技能满级', hint: '全部技能设为等级上限', fn: () => T.setAllSkillLevels(player) },
  { id: 'unlock', label: '🔓 解锁全部', hint: '成就/图鉴/山海/图谱/道途/产地/常客', fn: () => T.unlockEverything(player) },
  { id: 'locks', label: '▶ 恢复挂机', hint: '清掉暂停与关闭的挂机任务', fn: () => T.clearLocks(player) },
  { id: 'clear', label: '🗑 清空背包/仓库/冷库', hint: '测试「空背包」界面用', fn: () => T.clearInventory(player), danger: true },
]

/* ── 资源 / 物品 / 进度 / 重置 / 时间（原「注入」页签，2026-09-25 与运行时合并）── */
const currencyId = ref('gold')
const currencyN = ref(1000000)
const itemId = ref('')
const itemQty = ref(99)
const jumpHours = ref(24)
const towerFloor = ref(50)
const restaurantLv = ref(10)

function doSetCurrency() {
  run(`资源赋值 ${currencyId.value}`, () => P.setCurrency(player, currencyId.value, currencyN.value))
}
function doAddCurrency() {
  run(`资源增发 ${currencyId.value}`, () => P.addCurrency(player, currencyId.value, currencyN.value))
}
function doGrantItem() {
  run(`物品入库 ${itemId.value}`, () => P.grantItemById(player, itemId.value, itemQty.value))
}
/** 离线跳时会整页刷新：加一道确认（e2e 交互守卫自动 dismiss 对话框，不会误触） */
function jumpOffline(hours) {
  const h = Math.round((Number(hours) || 0) * 100) / 100
  if (!window.confirm(`离线跳时 ${h} 小时会保存并整页刷新（走真实离线结算），确认？`)) return
  run('离线跳时', () => {
    const msg = T.offlineJump(player, h)
    saveNow()
    setTimeout(() => window.location.reload(), 400)
    return `${msg}（即将刷新…）`
  })
}

/* ── 💾 存档管理 ── */
function doInspect() {
  inspectRows.value = inspectSave(player)
  const s = summarizeInspection(inspectRows.value)
  say(`存档体检：${s.total - s.bad}/${s.total} 项通过${s.bad ? `，${s.bad} 项异常` : ''}`, s.bad === 0)
}
function doExport(slot) {
  const data = saveManager.loadSlot(slot)
  if (!data) { say(`槽位 ${slot + 1} 是空的，无法导出`, false); return }
  saveManager.exportToFile(data, `culinary-idle-slot${slot + 1}-${Date.now()}.json`)
  say(`已导出槽位 ${slot + 1}`)
}
async function doImport(slot, event) {
  const file = event?.target?.files?.[0]
  if (!file) return
  try {
    await importSaveToSlot(file, slot)
    say(`已导入到槽位 ${slot + 1}（若当前正在玩这一位，请重新进入游戏）`)
  } catch (e) {
    say(`导入失败：${e?.message ?? e}`, false)
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}
function doCopy(from, to) {
  const data = saveManager.loadSlot(from)
  if (!data) { say(`槽位 ${from + 1} 是空的`, false); return }
  saveManager.saveSlot(to, data)
  say(`已把槽位 ${from + 1} 复制到槽位 ${to + 1}`)
}
function doDelete(slot) {
  if (!window.confirm(`确定删除槽位 ${slot + 1} 的存档？此操作不可撤销（快照仍在）。`)) return
  run(`删除槽位 ${slot + 1}`, () => { deleteSlot(slot); return '已删除' })
}
function doSnapshotRestore(slot, idx) {
  if (!window.confirm(`把槽位 ${slot + 1} 回滚到快照 #${idx + 1}？当前进度会被覆盖。`)) return
  run('回滚快照', () => { saveManager.restoreSnapshot(slot, idx); return `槽位 ${slot + 1} → 快照 #${idx + 1}` })
}

/* ── 📊 埋点与漏斗 ── */
const telemetry = computed(() => readTelemetry())
/**
 * 新手漏斗（2026-09-18）：直接读**存档里的** `player.guide`（不是本机 telemetry），
 * 所以它在打包版里也有数据 —— 这正是做用户测试时要的：受试者跑他们的，我读同一份口径。
 */
const funnel = computed(() => {
  const g = player.guide ?? {}
  const claimed = Array.isArray(g.claimed) ? g.claimed : []
  const trace = Array.isArray(g.trace) ? g.trace : []
  const atOf = new Map(trace.map((t) => [t.id, t.at]))
  const rows = NEWBIE_STEPS.map((st, i) => {
    const at = atOf.get(st.id)
    const prev = i > 0 ? atOf.get(NEWBIE_STEPS[i - 1].id) : 0
    return {
      id: st.id,
      no: i + 1,
      label: st.label,
      at: at ?? null,
      gap: at != null && prev != null ? at - prev : null,
      done: claimed.includes(st.id),
    }
  })
  const doneCount = rows.filter((r) => r.done).length
  const first = trace.length ? trace[0].at : null
  const slowest = rows.filter((r) => r.gap != null).sort((a, b) => b.gap - a.gap)[0] ?? null
  const pending = rows.find((r) => !r.done) ?? null
  const sinceStart = g.startedAt ? Date.now() - g.startedAt : null
  return {
    rows,
    doneCount,
    total: NEWBIE_TOTAL,
    first,
    slowest,
    pending,
    pendingFor: pending && g.startedAt ? Date.now() - g.startedAt - (atOf.get(NEWBIE_STEPS[Math.max(0, pending.no - 2)]?.id) ?? 0) : null,
    sinceStart,
    started: !!g.startedAt,
    done: !!g.done,
  }
})
const funnelCsv = computed(() => {
  const f = funnel.value
  const head = `步骤,名称,完成,开局后毫秒,本步耗时毫秒`
  const lines = f.rows.map((r) => `${r.no},"${r.label}",${r.done ? 1 : 0},${r.at ?? ''},${r.gap ?? ''}`)
  return [head, ...lines].join('\n')
})
function copyFunnel() {
  const f = funnel.value
  const summary = `完成 ${f.doneCount}/${f.total} · 首个正反馈 ${f.first == null ? '未达成' : (f.first / 1000).toFixed(1) + ' 秒'} · 最慢一步 ${f.slowest ? f.slowest.label + '（' + (f.slowest.gap / 1000).toFixed(0) + ' 秒）' : '-'}`
  navigator.clipboard?.writeText(funnelCsv.value).then(() => say('新手漏斗已复制（含摘要：' + summary + '）')).catch(() => say('复制失败，请手动选中表格', false))
}
const telemetryRows = computed(() => {
  const t = telemetry.value
  return FIRST_MARKS.map((m) => {
    const at = t.firsts[m.id]
    return { id: m.id, label: m.label, sec: at && t.startedAt ? (at - t.startedAt) / 1000 : null, at }
  })
})
async function copyTelemetry() {
  try {
    await navigator.clipboard.writeText(exportTelemetryCsv())
    say('埋点表已复制到剪贴板（可直接粘进论文表格）')
  } catch (e) {
    say(`复制失败（可手动复制）：${e?.message ?? e}`, false)
  }
}

/* ── 🩺 体检 ── */
function doRoundtrip() {
  const r = P.saveRoundtrip(player)
  say(`存档往返体检：${r.msg}`, r.ok)
}

/* ── 📡 监控 + 头部状态 chips：页面打开期间持续采样（chips 常驻可见，明细表在监控区）── */
const live = ref(null)
const storageInfo = ref(null)
const quotaInfo = ref(null)
let liveTimer = null
let probe = null
function startLive() {
  if (!probe) probe = P.createLiveProbe({ getTick: () => ui.loopTick ?? 0 })
  probe.start()
  live.value = probe.snapshot()
  liveTimer = setInterval(() => { live.value = probe.snapshot() }, 1000)
  storageInfo.value = P.collectStorageUsage()
  P.estimateQuota().then((q) => { quotaInfo.value = q })
}
function stopLive() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null }
  if (probe) probe.stop()
}
onMounted(startLive)
onUnmounted(stopLive)
</script>

<template>
  <!-- 整页接管：游戏内与启动页同一形态，铺满视口（2026-09-25 用户拍板「独立出来」） -->
  <div class="devpage">
    <!-- 头部控制条：标题 + 实时状态 chips + 全局动作 -->
    <header class="dp-head">
      <h3>🛠 开发者面板</h3>
      <span class="dev-badge">仅存在于开发构建</span>
      <span class="dp-chips mono">
        <span class="dp-chip">FPS {{ live?.fps ?? '—' }}</span>
        <span class="dp-chip">堆 {{ live?.heapMb == null ? '—' : live.heapMb + 'MB' }}</span>
        <span class="dp-chip">tick/s {{ live?.tickPerSec ?? '—' }}</span>
        <span class="dp-chip" :class="{ 'dp-chip-bad': live && !live.online }">{{ live == null ? '网络 —' : (live.online ? '在线' : '断网') }}</span>
      </span>
      <span class="dp-head-actions">
        <button class="btn btn-sm" @click="goBack()">↩ 返回</button>
        <button class="btn btn-sm" title="锁定（清除本次会话的登录）" @click="lockNow()">🔒 锁定</button>
      </span>
    </header>

    <div class="dp-body">
      <!-- 分区导航：桌面竖排，窄屏横向滚动 -->
      <nav class="dp-nav">
        <button v-for="s in SECTIONS" :key="s.id" class="dp-nav-btn" :class="{ on: section === s.id }" @click="section = s.id">{{ s.label }}</button>
      </nav>

      <div class="dp-content">
        <!-- ⚙ 运行时 & 注入（合并） -->
        <template v-if="section === 'ops'">
          <p v-if="!inGame" class="dim dp-note">运行时工具需要先进入游戏（启动页阶段还没有玩家存档；「💾 存档管理」不受影响）。</p>
          <div v-else class="dp-cards">
            <div class="dp-card">
              <h4>⚡ 一键配置</h4>
              <div class="dp-btns">
                <button v-for="a in actions" :key="a.id" class="btn btn-sm" :class="{ 'btn-danger': a.danger }" :title="a.hint" @click="run(a.label, a.fn)">{{ a.label }}</button>
              </div>
              <p class="dim dp-card-note">当前档：金币 {{ player.gold.toLocaleString() }} · 技能总等级 {{ Object.values(player.skills ?? {}).reduce((a, s) => a + (s.level ?? 1), 0) }} · 物品 {{ Object.keys(player.inventory ?? {}).length }} 种</p>
            </div>
            <div class="dp-card">
              <h4>💠 资源</h4>
              <div class="dp-row">
                <select v-model="currencyId" class="dev-select">
                  <option v-for="c in P.CURRENCY_FIELDS" :key="c.id" :value="c.id">{{ c.label }}（{{ c.id }}）</option>
                </select>
                <input class="dev-input mono" type="number" min="0" v-model.number="currencyN" />
              </div>
              <div class="dp-row">
                <button class="btn btn-sm" :disabled="!inGame" @click="doSetCurrency()">＝ 设为</button>
                <button class="btn btn-sm" :disabled="!inGame" @click="doAddCurrency()">＋ 加</button>
              </div>
              <p class="dim dp-card-note">取整、负数归 0；觅珍券这类「还没拿到过」的字段也能直接注入。</p>
            </div>
            <div class="dp-card">
              <h4>📦 物品入库</h4>
              <div class="dp-row">
                <input class="dev-input mono" style="flex: 1" list="dev-item-ids" v-model="itemId" placeholder="输入名称或 id（可搜索）" />
                <input class="dev-input mono" type="number" min="1" style="width: 84px" v-model.number="itemQty" />
              </div>
              <div class="dp-row">
                <button class="btn btn-sm" :disabled="!inGame || !itemId" @click="doGrantItem()">📦 入库</button>
                <span class="dim mono">{{ itemId && P.itemLabel(itemId) }}</span>
              </div>
              <datalist id="dev-item-ids">
                <option v-for="id in P.ALL_ITEM_IDS" :key="id" :value="id" />
              </datalist>
              <p class="dim dp-card-note">食灵进食灵阁；只认真实存在的物品，防止造出幽灵条目。</p>
            </div>
            <div class="dp-card">
              <h4>🎯 进度定位</h4>
              <div class="dp-row">
                <input class="dev-input mono" type="number" min="1" style="width: 84px" v-model.number="towerFloor" />
                <button class="btn btn-sm" :disabled="!inGame" @click="run('跳塔层', () => T.setTowerFloor(player, towerFloor))">🗼 塔层</button>
                <input class="dev-input mono" type="number" min="1" max="10" style="width: 84px" v-model.number="restaurantLv" />
                <button class="btn btn-sm" :disabled="!inGame" @click="run('餐厅等级', () => T.setRestaurantLevel(player, restaurantLv))">🏪 餐厅级</button>
              </div>
              <div class="dp-row">
                <button class="btn btn-sm" :disabled="!inGame" @click="run('赛季点数', () => T.addSeasonPoints(player, 1120))">🏅 赛季点数 +1120</button>
              </div>
              <p class="dim dp-card-note">塔层会同步抬 best（只升不降）· 餐厅 1~10 · 赛季 +1120 = 十档总需求。</p>
            </div>
            <div class="dp-card">
              <h4>♻️ 系统重置</h4>
              <div class="dp-btns">
                <button class="btn btn-sm" :disabled="!inGame" title="清空每日/周常/挑战/交易所/订单（保留等级与物品）" @click="run('重置当日状态', () => T.rolloverReset(player))">📅 重置当日状态</button>
                <button class="btn btn-sm" :disabled="!inGame" title="引导链从头走（配合埋点页签的漏斗）" @click="run('重置新手引导', () => T.resetNewbie(player))">🧪 重置新手引导</button>
                <button class="btn btn-sm" :disabled="!inGame" title="双保底计数清零（测保底触发）" @click="run('清觅珍保底', () => T.clearMijianPity(player))">🧭 清觅珍保底</button>
                <button class="btn btn-sm" title="清榜单与挑战记录（按存档位分键存 localStorage：culinary-idle.arena.state.<档>）" @click="run('重置竞技场', () => T.resetArenaState(saveManager.slot ?? 0))">🔄 重置竞技场</button>
              </div>
            </div>
            <div class="dp-card">
              <h4>⏱ 时间与队列</h4>
              <div class="dp-row">
                <span class="dim">离线跳时：</span>
                <button v-for="h in [1, 4, 8, 12]" :key="h" class="btn btn-sm" @click="jumpOffline(h)">{{ h }} 小时</button>
              </div>
              <div class="dp-row">
                <input class="dev-input mono" type="number" min="0.01" step="0.5" style="width: 110px" v-model.number="jumpHours" />
                <button class="btn btn-sm" :disabled="!inGame" @click="jumpOffline(jumpHours)">⏩ 自定义跳时</button>
                <button class="btn btn-sm" :disabled="!inGame" @click="run('队列快进', () => T.boostQueues(player, 60))">⏩ 队列快进 60 分</button>
              </div>
              <p class="dim dp-card-note">跳时走真实离线结算并整页刷新（有确认弹窗）；队列快进等价游戏商店「制作加速器」，材料不足自动暂停。</p>
            </div>
          </div>
        </template>

        <!-- 💾 存档管理 -->
        <template v-else-if="section === 'save'">
          <div v-for="s in slots" :key="s.slot" class="dev-slot">
            <div class="dp-row dp-slot-head">
              <b>槽位 {{ s.slot + 1 }}</b>
              <span v-if="!s.exists" class="dim">（空）</span>
              <span v-else class="dim mono">{{ s.sizeKb }} KB · schema {{ s.version }} · 金币 {{ (s.gold ?? 0).toLocaleString() }}</span>
              <span v-if="s.exists" class="dim">{{ s.savedAt }}</span>
            </div>
            <div class="dp-row">
              <button class="btn btn-sm" :disabled="!s.exists" @click="doExport(s.slot)">⬇ 导出</button>
              <button class="btn btn-sm" @click="fileInput.click()">⬆ 导入</button>
              <button v-for="o in slots.filter((x) => x.slot !== s.slot)" :key="o.slot" class="btn btn-sm"
                :disabled="!s.exists" :title="`把本槽复制到槽位 ${o.slot + 1}`" @click="doCopy(s.slot, o.slot)">→ {{ o.slot + 1 }}</button>
              <button class="btn btn-sm btn-danger" :disabled="!s.exists" @click="doDelete(s.slot)">删除</button>
              <span class="dim">快照 {{ saveManager.listSnapshots(s.slot).length }} 个</span>
              <button v-for="(_, i) in saveManager.listSnapshots(s.slot)" :key="i" class="btn btn-sm"
                @click="doSnapshotRestore(s.slot, i)">↩ #{{ i + 1 }}</button>
            </div>
          </div>
          <input ref="fileInput" type="file" accept="application/json" hidden @change="doImport(0, $event)" />
          <p class="dim dp-note">导入固定进「槽位 1」；导入前建议先把目标槽导出备份。存档位保存在本机 localStorage（无服务端）。</p>
        </template>

        <!-- 📊 埋点与漏斗 -->
        <template v-else-if="section === 'mark'">
          <div class="dp-row">
            <span class="dim">开局于：{{ telemetry.startedAt ? new Date(telemetry.startedAt).toLocaleString() : '（本次还未记录）' }} · 第 {{ telemetry.runNo ?? 1 }} 局</span>
            <button class="btn btn-sm" @click="pushMark('手动打点')">＋ 打点</button>
            <button class="btn btn-sm" @click="copyTelemetry()">⧉ 复制 CSV</button>
            <button class="btn btn-sm btn-danger" @click="resetTelemetry(); say('埋点已重置')">重置</button>
          </div>
          <table class="dev-table">
            <thead><tr><th>标记</th><th>说明</th><th>开局后</th></tr></thead>
            <tbody>
              <tr v-for="r in telemetryRows" :key="r.id">
                <td class="mono">{{ r.id }}</td>
                <td>{{ r.label }}</td>
                <td class="mono">{{ r.sec == null ? '未达成' : r.sec.toFixed(1) + ' 秒' }}</td>
              </tr>
            </tbody>
          </table>
          <p class="dim dp-note">这张表就是「新手期正反馈密度」的原始数据。只写本机、不联网、不进存档。</p>

          <h4 class="dp-h4">🎯 新手漏斗（读存档，打包版也有数据 —— 用户测试用这张）</h4>
          <div class="dp-row">
            <span class="dim">
              完成 <strong>{{ funnel.doneCount }}/{{ funnel.total }}</strong>
              <template v-if="funnel.sinceStart != null"> · 进入游戏后 {{ (funnel.sinceStart / 60000).toFixed(1) }} 分钟</template>
              <template v-if="funnel.first != null"> · 首个正反馈 <strong>{{ (funnel.first / 1000).toFixed(1) }} 秒</strong></template>
              <template v-if="funnel.slowest"> · 最慢一步 {{ funnel.slowest.label }}（{{ (funnel.slowest.gap / 1000).toFixed(0) }} 秒）</template>
              <template v-if="funnel.pending"> · 当前卡在 {{ funnel.pending.label }}</template>
              <template v-if="funnel.done"> · ✅ 已走完</template>
            </span>
            <button class="btn btn-sm" @click="copyFunnel()">⧉ 复制漏斗 CSV</button>
          </div>
          <table class="dev-table">
            <thead><tr><th>#</th><th>目标</th><th>状态</th><th>开局后</th><th>本步耗时</th></tr></thead>
            <tbody>
              <tr v-for="r in funnel.rows" :key="r.id" :class="{ bad: !r.done }">
                <td class="mono">{{ r.no }}</td>
                <td>{{ r.label }}</td>
                <td>{{ r.done ? '✅' : '⏳' }}</td>
                <td class="mono">{{ r.at == null ? '—' : (r.at / 1000).toFixed(1) + ' 秒' }}</td>
                <td class="mono">{{ r.gap == null ? '—' : (r.gap / 1000).toFixed(1) + ' 秒' }}</td>
              </tr>
            </tbody>
          </table>
        </template>

        <!-- 🩺 体检 -->
        <template v-else-if="section === 'check'">
          <div class="dp-row">
            <button class="btn btn-sm btn-primary" :disabled="!inGame" @click="doInspect()">▶ 运行存档体检</button>
            <button class="btn btn-sm" :disabled="!inGame" @click="doRoundtrip()">🔁 存档往返体检</button>
          </div>
          <p class="dim dp-note">体检把 CI 守卫里的「不变量」搬到这份运行时存档上：幽灵物品 / NaN 金币 / 越界等级（转生档上限 120）/ 超上限容量 / 堆叠超限 …。往返体检抓 NaN/丢字段这类「只有序列化才暴露」的问题。</p>
          <div v-for="(r, i) in inspectRows" :key="i" class="dev-check" :class="{ bad: !r.ok }">
            <span>{{ r.ok ? '✅' : '🔴' }} {{ r.label }}</span>
            <span class="dim mono">{{ r.detail }}</span>
          </div>
        </template>

        <!-- 📡 监控 -->
        <template v-else>
          <p class="dim dp-note">采样间隔 1 秒，离开本区自动停止。长任务 = 主线程被单个任务占住 >50ms（自打开起累计）。</p>
          <table class="dev-table">
            <tbody>
              <tr><td>帧率 FPS</td><td class="mono">{{ live?.fps ?? '—' }}</td></tr>
              <tr><td>引擎 tick / 秒</td><td class="mono">{{ live?.tickPerSec ?? '—' }}</td></tr>
              <tr><td>JS 堆</td><td class="mono">{{ live == null ? '—' : (live.heapMb == null ? '（本浏览器不提供）' : `${live.heapMb} MB / 上限 ${live.heapLimitMb} MB`) }}</td></tr>
              <tr><td>长任务</td><td class="mono">{{ live == null ? '—' : `${live.longTasks} 次 · 最长 ${live.worstTaskMs} ms` }}</td></tr>
              <tr><td>网络</td><td class="mono">{{ live == null ? '—' : (live.online ? '在线' : '🔴 断网 —— 没加载过的页面会显示「重新加载」兜底卡，回网且停在该页时自动刷新') }}</td></tr>
              <tr><td>localStorage（culinary-idle.*）</td><td class="mono">{{ storageInfo ? `${storageInfo.count} 键 · 共 ${storageInfo.totalKb} KB` : '—' }}</td></tr>
              <tr><td>存储配额</td><td class="mono">{{ quotaInfo ? `${quotaInfo.usedMb} MB 已用 / 配额 ${quotaInfo.quotaMb} MB` : '—' }}</td></tr>
            </tbody>
          </table>
          <h4 class="dp-h4">最大的几个键（排查「存档越滚越大」）</h4>
          <table class="dev-table">
            <thead><tr><th>键</th><th>大小</th></tr></thead>
            <tbody>
              <tr v-for="r in (storageInfo?.rows ?? []).slice(0, 8)" :key="r.key">
                <td class="mono">{{ r.key }}</td>
                <td class="mono">{{ r.kb }} KB</td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>
    </div>

    <!-- 页底操作日志 -->
    <footer class="dp-foot">
      <div class="dp-row dp-foot-head">
        <b class="dim">操作日志</b>
        <button class="btn btn-sm" @click="clearLog()">清空</button>
      </div>
      <div v-if="log.length" class="dev-log">
        <div v-for="(l, i) in log" :key="i" :class="{ bad: !l.ok }"><span class="dim mono">{{ l.at }}</span> {{ l.text }}</div>
      </div>
      <p class="dim dp-note">口令只是挡板；真正的保护是「开发者页面不进生产构建」（要留给打包版请用 <span class="mono">VITE_DEV_PANEL=1 npm run build</span>）。{{ DEV_DEFAULT_PASSWORD_HINT }}</p>
    </footer>
  </div>
</template>

<style scoped>
/* 整页接管：铺满视口（覆盖在游戏/启动页之上），内容列居中 */
.devpage { position: fixed; inset: 0; z-index: 999; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; color: var(--text); }

.dp-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 14px; border-bottom: 1px dashed var(--border); background: rgba(var(--panel-rgb), 0.9); }
.dp-head h3 { margin: 0; font-size: 15px; }
.dev-badge { font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px dashed var(--warn); color: var(--warn); }
.dp-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.dp-chip { font-size: 11px; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--border); background: rgba(var(--panel-rgb), 0.7); }
.dp-chip-bad { color: var(--bad); border-color: rgba(var(--bad-rgb), 0.5); }
.dp-head-actions { margin-left: auto; display: flex; gap: 6px; }

.dp-body { display: flex; gap: 14px; align-items: flex-start; flex: 1; padding: 12px 14px; min-height: 0; overflow-y: auto; }
.dp-nav { display: flex; flex-direction: column; gap: 4px; width: 168px; flex-shrink: 0; position: sticky; top: 0; }
.dp-nav-btn { text-align: left; padding: 8px 12px; border-radius: 10px; border: 1px solid transparent; background: transparent; color: inherit; cursor: pointer; font-size: 13px; white-space: nowrap; }
.dp-nav-btn:hover { background: rgba(var(--panel-rgb), 0.7); }
.dp-nav-btn.on { background: rgba(var(--panel-rgb), 0.9); border-color: var(--border); font-weight: 700; }
.dp-content { flex: 1; min-width: 0; }

.dp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }
.dp-card { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; background: rgba(var(--panel-rgb), 0.6); }
.dp-card h4 { margin: 0 0 8px; font-size: 13px; }
.dp-card-note { margin: 8px 0 0; font-size: 11px; line-height: 1.5; }
.dp-btns { display: flex; flex-wrap: wrap; gap: 6px; }
.dp-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 6px 0; font-size: 12px; }
.dp-note { font-size: 12px; line-height: 1.6; }
.dp-h4 { margin: 14px 0 6px; }
.dp-slot-head { margin: 0 0 2px; }
.dev-slot { border: 1px solid var(--border); border-radius: 10px; padding: 8px; margin-bottom: 8px; }
.dev-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.dev-table th, .dev-table td { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--border); }
.dev-check { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; padding: 3px 0; border-bottom: 1px dashed rgba(var(--tint-rgb), 0.18); }
.dev-check.bad { color: var(--bad); }
.dev-table .bad td { color: var(--muted); }

.dp-foot { border-top: 1px dashed var(--border); padding: 8px 14px; }
.dp-foot-head { margin: 0 0 4px; }
.dev-log { font-size: 12px; max-height: 22vh; overflow-y: auto; margin-bottom: 4px; }
.dev-log .bad { color: var(--bad); }
.dp-foot .dp-note { margin: 0; font-size: 11px; }

.dev-input { padding: 3px 7px; border: 1px solid var(--border); border-radius: 7px; background: rgba(var(--panel-rgb), 0.9); color: inherit; font-size: 12px; width: 150px; }
.dev-select { padding: 3px 5px; border: 1px solid var(--border); border-radius: 7px; background: rgba(var(--panel-rgb), 0.9); color: inherit; font-size: 12px; }

/* 窄屏：导航折成横向滚动条，卡片单列 */
@media (max-width: 900px) {
  .dp-body { flex-direction: column; }
  .dp-nav { flex-direction: row; overflow-x: auto; width: 100%; position: static; padding-bottom: 4px; }
  .dp-cards { grid-template-columns: 1fr; }
}
</style>
