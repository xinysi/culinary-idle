<script setup>
// 存档面板 — 需求文档 §8.2： 存档位 + 导入/导出
// 2026-09-25 排版重做（用户「存档界面需要重做一下排版」）：改前是「位号+名字+三行信息+四个等强度按钮+独占一行的导入按钮」，
//   问题有三：① 主次不分（读取与删除同强度、保存与覆盖保存宽度不一）；② 信息行没有对齐节奏（三行左对齐堆着）；
//   ③ 每张卡高度不一、快照框空旷。现在改为**两段式卡片**：头部（位号徽章 + 名字 + 状态徽章右靠）→ 一行统计 →
//   主操作（读取/保存各占一半）→ 次要操作（导入/导出/删除 收成小号幽灵按钮）。
//   ⚠️ 与启动页「选择存档」弹窗**共用** `.slot-card/.slot-title/.slot-info/.slot-actions` 这套全局类名，
//   本文件改用 `sv-` 前缀（scoped）⇒ 那边一点不受影响；也不要在这里改全局 `.slot-*` 的样式。
import { ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { saveManager } from '../game/bootstrap.js'
import { saveToSlot, loadSlot, deleteSlot, importSaveToSlot, exportSave, currentSlot, newGameSlot } from '../game/bootstrap.js'

const player = usePlayerStore()
const ui = useUiStore()

const slots = ref(saveManager.listSlots())
const refresh = () => {
  slots.value = saveManager.listSlots()
  snapshots.value = saveManager.listSnapshots(currentSlot())
  refreshKey.value++
}
const refreshKey = ref(0)
const fileInputs = ref({})
const hardcoreChecked = ref(false) // 新建存档：硬核模式（§4.1/§8.2）
// 自动快照（2026-09-06 档安全）：写档前自动备份旧档，3 份轮换，可回滚
const snapshots = ref(saveManager.listSnapshots(currentSlot()))
function restoreSnap(idx) {
  if (!confirm(`确定将当前存档位回滚到快照（${fmtTime(snapshots.value.find((s) => s.idx === idx)?.savedAt)}）吗？\n当前进度会被覆盖。`)) return
  if (saveManager.restoreSnapshot(currentSlot(), idx)) {
    ui.pushLog('🛡 已从快照回滚，重新读取后生效', 'info')
    refresh()
  }
}

function totalLevelsOf(data) {
  if (!data?.player?.skills) return 0
  return Object.values(data.player.skills).reduce((a, s) => a + (s.level ?? 1), 0)
}
function saveInto(slot) {
  // 🔴 覆盖保护（2026-09-21 用户实测报出）：点**别的**存档位的「保存」会把那份存档静默覆盖掉。
  //    当前位的「保存」是本分（不拦），往别的位置写一律先确认，并把将被覆盖的那份存档内容摊给玩家看。
  const cur = currentSlot()
  if (slot !== cur) {
    const target = slots.value.find((x) => x.slot === slot)
    const willLose = target?.exists
      ? `\n\n存档位 ${slot + 1} 现有：${target.data?.player?.name ?? '美食学徒'} · 总等级 ${totalLevelsOf(target.data)} · 存于 ${fmtTime(target.data.savedAt)}`
      : `\n\n存档位 ${slot + 1} 目前是空的。`
    if (!confirm(`⚠️ 你要把「当前进度」（存档位 ${cur + 1}）另存到存档位 ${slot + 1}。${willLose}\n\n覆盖后原来的存档无法恢复，确定吗？`)) return
  }
  saveToSlot(slot)
  ui.pushLog(`已保存到存档位 ${slot + 1}${player.hardcore ? '（硬核模式）' : ''}`, 'info')
  refresh()
}
function createNewIn(slot) {
  // 空位新建 = 真正新开档（1 级/100 金），并切换当前会话
  if (hardcoreChecked.value) {
    if (!confirm('⚠️ 确定开启【硬核模式】吗？\n\n硬核模式死亡后存档将被删除（不可恢复）！\n建议先备份存档。')) {
      hardcoreChecked.value = false
      return
    }
  }
  newGameSlot(slot, { hardcore: hardcoreChecked.value })
  hardcoreChecked.value = false
  refresh()
}
function loadFrom(slot) {
  if (loadSlot(slot)) refresh()
}
function removeSlot(slot) {
  if (confirm(`确定删除存档位 ${slot + 1} 吗？此操作不可恢复。`)) {
    deleteSlot(slot)
    refresh()
  }
}
function onImportFile(slot, event) {
  const file = event.target.files?.[0]
  if (!file) return
  importSaveToSlot(file, slot).then(() => refresh())
  event.target.value = ''
}
function exportCurrent(slot) {
  // 「导出」按钮长在某个存档位那一行 ⇒ 就导出**那一位**（此前固定导出当前位，容易导出错的那份）
  exportSave(slot)
}
function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}
/** 卡片里那行统计用的紧凑时间（完整时间挂 title 悬浮提示，别把一整串塞进卡片行） */
function fmtShort(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  const y = d.getFullYear() === new Date().getFullYear() ? '' : `${d.getFullYear()}/`
  return `${y}${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div class="modal-backdrop" @click.self="ui.toggleSavePanel(false)">
    <div class="modal save-modal">
      <header class="modal-head">
        <h3>存档管理</h3>
        <button class="btn btn-sm" @click="ui.toggleSavePanel(false)">✕</button>
      </header>

      <!-- 游客 / 试玩会话（2026-09-24）：明确告知「本面板对你不可用」并说明怎么变成正式玩家。
           只显示横幅、把按钮置灰，**不做静默失效** —— 点了没反应是玩家最讨厌的一种坏体验。 -->
      <div v-if="ui.guest" class="guest-notice">
        🧪 <strong>试玩会话</strong>：不占存档位、不保存进度。要长期玩请刷新页面 → 在启动页选择存档位。
      </div>

      <div class="sv-list">
        <section
          v-for="s in slots"
          :key="s.slot"
          class="sv-slot"
          :class="{ 'sv-slot--cur': !ui.guest && s.slot === currentSlot(), 'sv-slot--empty': !s.exists }"
        >
          <!-- 头部：位号徽章 · 名字 · 状态徽章（右靠）。用 grid 的 `1fr` 中列右靠，不用 margin-left:auto（项目禁用写法） -->
          <header class="sv-head">
            <span class="sv-no">{{ s.slot + 1 }}</span>
            <span class="sv-name">{{ s.exists ? (s.data.player?.name ?? '美食学徒') : '空存档位' }}</span>
            <span class="sv-tags">
              <!-- ⚠️ 游客态**不属于任何存档位** ⇒ 不许给任何一位打「当前」（2026-09-24 实测：原先会
                   在第 1 位上显示「当前」，玩家会以为自己正在玩那个档） -->
              <span v-if="!ui.guest && s.slot === currentSlot()" class="badge badge-on">当前</span>
              <span v-if="s.data?.player?.hardcore" class="badge sv-hardcore">☠️ 硬核</span>
            </span>
          </header>

          <p v-if="s.exists" class="sv-meta" :title="`存档时间 ${fmtTime(s.data.savedAt)}`">
            金币 {{ (s.data.player?.gold ?? 0).toLocaleString() }}<i>·</i>总等级 {{ totalLevelsOf(s.data) }}<i>·</i>存于 {{ fmtShort(s.data.savedAt) }}
          </p>
          <p v-else class="sv-meta sv-meta--empty">在这里开一份新档，或把导出的存档文件导入到此位</p>

          <label v-if="!s.exists" class="switch-row sv-hard">
            <input type="checkbox" v-model="hardcoreChecked" />
            <span>☠️ 硬核模式（死亡即删档）</span>
          </label>

          <!-- 主操作：读取 / 保存（各占一半）；空位则是「在此位新建存档」独占一行 -->
          <div class="sv-acts">
            <template v-if="s.exists">
              <button class="btn btn-sm btn-primary" :disabled="ui.guest" @click="loadFrom(s.slot)">读取</button>
              <button class="btn btn-sm" :disabled="ui.guest" @click="saveInto(s.slot)">
                {{ s.slot === currentSlot() ? '保存' : '覆盖保存' }}
              </button>
            </template>
            <button v-else class="btn btn-sm btn-primary sv-wide" :disabled="ui.guest" @click="createNewIn(s.slot)">
              在此位新建存档
            </button>
          </div>

          <!-- 次要操作：小号幽灵按钮（视觉重量低于上面两个，删除用危险色描边而不是实心红块） -->
          <div class="sv-mini">
            <button class="btn btn-sm sv-ghost" :disabled="ui.guest" @click="fileInputs[s.slot]?.click()">导入存档文件</button>
            <button v-if="s.exists" class="btn btn-sm sv-ghost" :disabled="ui.guest" @click="exportCurrent(s.slot)">导出这份</button>
            <button v-if="s.exists" class="btn btn-sm sv-ghost sv-ghost--danger" :disabled="ui.guest" @click="removeSlot(s.slot)">删除</button>
            <input
              :ref="(el) => { if (el) fileInputs[s.slot] = el }"
              type="file"
              accept=".json,application/json"
              style="display: none"
              :key="refreshKey"
              @change="onImportFile(s.slot, $event)"
            />
          </div>
        </section>
      </div>

      <p class="sv-foot">
        当前会话：{{ player.name }} · 金币 {{ player.gold.toLocaleString() }} · 总等级 {{ player.totalLevels }}
        <span class="dim">· 读取其他存档位会先自动保存当前进度</span>
      </p>

      <!-- 自动快照回滚（2026-09-06 档安全） -->
      <div v-if="snapshots.length" class="sv-snaps">
        <div class="sv-snaps-head">🛡 自动快照 <span class="dim">写档前自动备份 · 5 分钟节流 · 3 份轮换</span></div>
        <div v-for="s in snapshots" :key="s.idx" class="sv-snap-row">
          <span class="mono dim">{{ fmtTime(s.savedAt) }}</span>
          <button class="btn btn-sm sv-ghost" :disabled="ui.guest" @click="restoreSnap(s.idx)">回滚到此快照</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 比默认弹窗宽一点（三张卡 + 一行五个小按钮时 560 会挤），窄屏仍留 6vw 边距 */
.save-modal {
  width: min(600px, 94vw);
}
/* 游客会话横幅：压在弹窗顶部，常年可见（颜色走 warn 语义 token，两套主题都有定义） */
.guest-notice {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--warn-strong);
  background: var(--warn-soft);
  /* ⚠️ 文字用 `--bad-strong` 而不是 `--warn-strong`：后者（浅色 #bf7200）压 `--warn-soft`
     实测只有 3.3:1 —— AGENTS 里记过同一坑（料理不足那行）。语义底仍走 warn，只有文字换深色档。 */
  color: var(--bad-strong);
  font-size: 12.5px;
  line-height: 1.5;
}

.sv-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sv-slot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px 11px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(var(--panel-soft-rgb), 0.86);
}
/* 「当前」：左侧一条主色竖条 + 主色描边（比原来只换描边更一眼可辨，且不靠底色区分） */
.sv-slot--cur {
  border-color: var(--primary);
  box-shadow: inset 3px 0 0 var(--primary);
}
.sv-slot--empty {
  border-style: dashed;
}

.sv-head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
}
.sv-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 700;
  background: rgba(var(--primary-tint-rgb), 0.18);
  color: var(--primary);
}
.sv-name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sv-tags {
  display: inline-flex;
  gap: 6px;
}
.sv-hardcore {
  background: var(--bad-soft);
  color: var(--bad-strong);
}

.sv-meta {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-dim);
}
.sv-meta i {
  font-style: normal;
  opacity: 0.5;
  margin: 0 6px;
}
.sv-meta--empty {
  line-height: 1.45;
}
.sv-hard {
  font-size: 12.5px;
}

/* 主操作：两列等宽（「读取」与「保存」强度分明但尺寸一致，不再一宽一窄） */
.sv-acts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.sv-wide {
  grid-column: 1 / -1;
}
/* 次要操作：小号幽灵按钮一排；不放宽、不抢主操作的位置 */
.sv-mini {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sv-ghost {
  font-size: 12px;
  padding: 4px 10px;
  background: transparent;
  border-color: var(--border);
  color: var(--text-dim);
}
.sv-ghost:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}
.sv-ghost--danger {
  color: var(--bad-strong);
}

.sv-foot {
  margin: 10px 0 0;
  font-size: 12.5px;
  color: var(--text-dim);
}
.sv-snaps {
  margin-top: 10px;
  padding: 9px 11px;
  border: 1px dashed var(--border);
  border-radius: 12px;
}
.sv-snaps-head {
  font-size: 12.5px;
  font-weight: 600;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.sv-snap-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  font-size: 12px;
}

/* 🔴 游客态下**整面板按钮都是禁用的**，而全局 `.btn:disabled { opacity: 0.45 }` 会把主按钮的
   白字一起洗淡 —— 浅色主题下实测只剩 **2.9:1**（「不可用」变成「看不清」）。这里改成实底禁用色：
   可读（--muted 压在面板底上）、又一眼看出点不动。只作用于本弹窗，不动全局禁用态（别的地方在用）。 */
.sv-slot button:disabled {
  opacity: 1;
  background: rgba(var(--panel-raised-rgb), 1);
  color: var(--muted);
  border-color: var(--border);
}
</style>
