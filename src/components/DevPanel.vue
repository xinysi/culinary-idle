<script setup>
// 开发者面板（2026-09-18 立）——**只在包含开发者模式的构建里存在**
//
// 入口（都很隐蔽，避免演示时被随手点开）：
//   · 启动页标题连点 5 下
//   · 任意阶段按 Ctrl + Shift + D
//   · URL 带 `?dev=1`
// 口令校验见 `game/dev/devAuth.js`（**挡板，不是安全边界**；真正的保护是构建期隔离）。
//
// ⚠️ 面板只操作这台机器上的存档，**不改 `src/game/data/*` 的冻结数据**（见 devTools.js 头注）。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { DEV_PANEL_ENABLED, devLogout } from '../game/dev/devFlag.js'
import { DEV_DEFAULT_PASSWORD_HINT } from '../game/dev/devAuth.js'
import * as T from '../game/dev/devTools.js'
import { inspectSave, summarizeInspection } from '../game/dev/saveInspector.js'
import { FIRST_MARKS, readTelemetry, resetTelemetry, exportTelemetryCsv, pushMark } from '../game/dev/telemetry.js'
import { NEWBIE_STEPS, NEWBIE_TOTAL } from '../game/data/newbieChain.js'
import { saveManager, saveNow, deleteSlot, importSaveToSlot } from '../game/bootstrap.js'

const ui = useUiStore()
const player = usePlayerStore()

const tab = ref('runtime')
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

/** 包一层：任何动作抛错都在面板里显示，不让它炸到控制台 */
function run(label, fn) {
  try {
    const msg = fn()
    say(`${label}：${msg ?? 'ok'}`)
  } catch (e) {
    say(`${label} 失败：${e?.message ?? e}`, false)
  }
}

const actions = [
  { id: 'maxOut', label: '⚡ 一键满配', hint: '金币 + 全物品 + 技能满级 + 全解锁（答辩演示用）', fn: () => T.maxOut(player) },
  { id: 'gold', label: '💰 金币 10 亿', hint: '直接赋值（会被存档保留）', fn: () => T.grantGold(player) },
  { id: 'items', label: '📦 全物品入库 ×999', hint: '食灵进食灵阁，不占背包格', fn: () => T.grantAllItems(player) },
  { id: 'skills', label: '🎓 技能满级', hint: '全部技能设为等级上限', fn: () => T.setAllSkillLevels(player) },
  { id: 'unlock', label: '🔓 解锁全部', hint: '成就/图鉴/山海/图谱/道途/产地/常客', fn: () => T.unlockEverything(player) },
  { id: 'locks', label: '▶ 恢复挂机', hint: '清掉暂停与关闭的挂机任务', fn: () => T.clearLocks(player) },
  { id: 'roll', label: '📅 重置当日状态', hint: '每日/周常/挑战/交易所/订单（保留等级与物品）', fn: () => T.rolloverReset(player) },
  { id: 'clear', label: '🗑 清空背包/仓库/冷库', hint: '测试「空背包」界面用', fn: () => T.clearInventory(player), danger: true },
]

function jumpOffline(hours) {
  run('离线跳时', () => {
    const msg = T.offlineJump(player, hours)
    saveNow()
    setTimeout(() => window.location.reload(), 400)
    return `${msg}（即将刷新…）`
  })
}

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

const telemetry = computed(() => readTelemetry())
/**
 * 新手漏斗（2026-09-18）：直接读**存档里的** `player.guide`（不是本机 telemetry），
 * 所以它在打包版里也有数据 —— 这正是做用户测试时要的：受试者跑他们的，我读同一份口径。
 * 论文关心的三个数：完成率 / 首个正反馈时刻 / 卡点（哪一步耗时最长、现在卡在哪一步多久）。
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
      gap: at != null && prev != null ? at - prev : null, // 这一步花了多久
      done: claimed.includes(st.id),
    }
  })
  const doneCount = rows.filter((r) => r.done).length
  const first = trace.length ? trace[0].at : null // 首个正反馈（第一次拿到奖励）的时刻
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
</script>

<template>
  <Teleport to="body">
    <div v-if="DEV_PANEL_ENABLED" class="dev-backdrop" @click.self="ui.toggleDevPanel(false)">
      <div class="dev-panel">
        <header class="dev-head">
          <h3>🛠 开发者面板</h3>
          <span class="dev-badge">仅存在于开发构建</span>
          <button class="btn btn-sm" title="锁定（清除本次会话的登录）" @click="devLogout(); ui.toggleDevPanel(false)">🔒 锁定</button>
          <button class="btn btn-sm" @click="ui.toggleDevPanel(false)">✕</button>
        </header>

        <nav class="dev-tabs">
          <button v-for="t in [['runtime', '🎮 运行时'], ['save', '💾 存档'], ['mark', '📊 埋点'], ['check', '🩺 体检']]"
            :key="t[0]" class="btn btn-sm" :class="{ 'btn-primary': tab === t[0] }" @click="tab = t[0]">{{ t[1] }}</button>
        </nav>

        <div class="dev-body">
          <!-- 🎮 运行时 -->
          <template v-if="tab === 'runtime'">
            <p v-if="!inGame" class="dim">运行时工具需要先进入游戏（启动页阶段还没有玩家存档）。</p>
            <template v-else>
              <div class="dev-grid">
                <button v-for="a in actions" :key="a.id" class="btn btn-sm" :class="{ 'btn-danger': a.danger }"
                  :title="a.hint" @click="run(a.label, a.fn)">{{ a.label }}</button>
              </div>
              <div class="dev-row">
                <span class="dim">离线跳时：</span>
                <button v-for="h in [1, 4, 8, 12]" :key="h" class="btn btn-sm" @click="jumpOffline(h)">{{ h }} 小时</button>
                <span class="dim">（走真实离线结算：改完自动刷新）</span>
              </div>
              <div class="dev-row">
                <span class="dim">当前档：</span>
                <span class="mono">金币 {{ player.gold.toLocaleString() }} · 技能总等级 {{ Object.values(player.skills ?? {}).reduce((a, s) => a + (s.level ?? 1), 0) }} · 物品 {{ Object.keys(player.inventory ?? {}).length }} 种</span>
              </div>
            </template>
          </template>

          <!-- 💾 存档 -->
          <template v-else-if="tab === 'save'">
            <div v-for="s in slots" :key="s.slot" class="dev-slot">
              <div class="dev-slot-head">
                <b>槽位 {{ s.slot + 1 }}</b>
                <span v-if="!s.exists" class="dim">（空）</span>
                <span v-else class="dim mono">{{ s.sizeKb }} KB · schema {{ s.version }} · 金币 {{ (s.gold ?? 0).toLocaleString() }}</span>
                <span v-if="s.exists" class="dim">{{ s.savedAt }}</span>
              </div>
              <div class="dev-row">
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
            <p class="dim">导入固定进「槽位 1」；导入前建议先把目标槽导出备份。存档位保存在本机 localStorage（无服务端）。</p>
          </template>

          <!-- 📊 埋点 -->
          <template v-else-if="tab === 'mark'">
            <div class="dev-row">
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
            <p class="dim">这张表就是「新手期正反馈密度」的原始数据：第一次采集/制作/胜利/首领分别发生在开局后多久。只写本机、不联网、不进存档。</p>

            <h4 style="margin-top: 14px">🎯 新手漏斗（读存档，打包版也有数据 —— 用户测试用这张）</h4>
            <div class="dev-row">
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
          <template v-else>
            <div class="dev-row">
              <button class="btn btn-sm btn-primary" :disabled="!inGame" @click="doInspect()">▶ 运行存档体检</button>
              <span class="dim">把 CI 守卫里的「不变量」搬到这份运行时存档上跑：幽灵物品 / NaN 金币 / 越界等级 / 超上限容量 …</span>
            </div>
            <div v-for="(r, i) in inspectRows" :key="i" class="dev-check" :class="{ bad: !r.ok }">
              <span>{{ r.ok ? '✅' : '🔴' }} {{ r.label }}</span>
              <span class="dim mono">{{ r.detail }}</span>
            </div>
          </template>
        </div>

        <footer class="dev-foot">
          <div v-if="log.length" class="dev-log">
            <div v-for="(l, i) in log" :key="i" :class="{ bad: !l.ok }"><span class="dim mono">{{ l.at }}</span> {{ l.text }}</div>
          </div>
          <p class="dim">口令只是挡板；真正的保护是「开发者面板不进生产构建」（要留给打包版请用 <span class="mono">VITE_DEV_PANEL=1 npm run build</span>）。{{ DEV_DEFAULT_PASSWORD_HINT }}</p>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dev-backdrop { position: fixed; inset: 0; z-index: 999; background: rgba(var(--scrim-rgb), 0.55); display: flex; align-items: center; justify-content: center; padding: 16px; }
.dev-panel { width: min(860px, 96vw); max-height: 88vh; display: flex; flex-direction: column; border-radius: 14px; border: 1px solid var(--border); background: rgba(var(--panel-rgb), 0.96); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 12px 40px rgba(var(--ink-rgb), 0.35); overflow: hidden; }
.dev-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px dashed var(--border); }
.dev-head h3 { margin: 0; font-size: 15px; }
.dev-badge { font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px dashed var(--warn); color: var(--warn); }
.dev-head .btn:first-of-type { margin-left: auto; }
.dev-tabs { display: flex; gap: 6px; padding: 8px 12px; border-bottom: 1px dashed var(--border); flex-wrap: wrap; }
.dev-body { padding: 12px; overflow-y: auto; flex: 1; }
.dev-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; margin-bottom: 10px; }
.dev-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 6px 0; font-size: 12px; }
.dev-slot { border: 1px solid var(--border); border-radius: 10px; padding: 8px; margin-bottom: 8px; }
.dev-slot-head { display: flex; align-items: center; gap: 8px; font-size: 12px; flex-wrap: wrap; margin-bottom: 4px; }
.dev-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.dev-table th, .dev-table td { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--border); }
.dev-check { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; padding: 3px 0; border-bottom: 1px dashed rgba(var(--tint-rgb), 0.18); }
.dev-check.bad { color: var(--bad); }
.dev-foot { border-top: 1px dashed var(--border); padding: 8px 12px; max-height: 26vh; overflow-y: auto; }
.dev-log { font-size: 12px; margin-bottom: 4px; }
.dev-log .bad { color: var(--bad); }
.dev-foot p { margin: 0; font-size: 11px; line-height: 1.5; }
</style>
