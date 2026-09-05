<script setup>
// 存档面板 — 需求文档 §8.2： 存档位 + 导入/导出
import { ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { saveManager } from '../game/bootstrap.js'
import { saveToSlot, loadSlot, deleteSlot, importSaveToSlot, exportSave, currentSlot } from '../game/bootstrap.js'

const player = usePlayerStore()
const ui = useUiStore()

const slots = ref(saveManager.listSlots())
const refresh = () => {
  slots.value = saveManager.listSlots()
  refreshKey.value++
}
const refreshKey = ref(0)
const fileInputs = ref({})
const hardcoreChecked = ref(false) // 新建存档：硬核模式（§4.1/§8.2）

function totalLevelsOf(data) {
  if (!data?.player?.skills) return 0
  return Object.values(data.player.skills).reduce((a, s) => a + (s.level ?? 1), 0)
}
function saveInto(slot) {
  // 硬核模式二次确认（死亡即删档，不可恢复）
  if (!slots.value[slot]?.exists && hardcoreChecked.value) {
    if (!confirm('⚠️ 确定开启【硬核模式】吗？\n\n硬核模式死亡后存档将被删除（不可恢复）！\n建议先备份存档。')) {
      hardcoreChecked.value = false
      return
    }
    player.hardcore = true // 空位新建时应用硬核
  }
  saveToSlot(slot)
  ui.pushLog(`已保存到存档位 ${slot + 1}${player.hardcore ? '（硬核模式）' : ''}`, 'info')
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
function exportCurrent() {
  exportSave()
}
function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}
</script>

<template>
  <div class="modal-backdrop" @click.self="ui.toggleSavePanel(false)">
    <div class="modal">
      <header class="modal-head">
        <h3>存档管理</h3>
        <button class="btn btn-sm" @click="ui.toggleSavePanel(false)">✕</button>
      </header>

      <div class="slot-grid">
        <div v-for="s in slots" :key="s.slot" class="slot-card" :class="{ current: s.slot === currentSlot() }">
          <div class="slot-title">
            存档位 {{ s.slot + 1 }}
            <span v-if="s.slot === currentSlot()" class="badge badge-on">当前</span>
            <span v-else-if="!s.exists" class="dim">（空）</span>
            <span v-if="s.data?.player?.hardcore" class="badge" style="background: var(--bad-soft); color: var(--bad-strong)">☠️ 硬核</span>
          </div>

          <template v-if="s.exists">
            <div class="slot-info">
              <div><strong>{{ s.data.player?.name ?? '美食学徒' }}</strong></div>
              <div class="dim">金币 {{ s.data.player?.gold?.toLocaleString() ?? 0 }} · 总等级 {{ totalLevelsOf(s.data) }}</div>
              <div class="dim mono">存档时间 {{ fmtTime(s.data.savedAt) }}</div>
            </div>
            <div class="slot-actions">
              <button class="btn btn-sm" @click="saveInto(s.slot)">保存</button>
              <button class="btn btn-sm btn-primary" @click="loadFrom(s.slot)">读取</button>
              <button class="btn btn-sm" @click="exportCurrent">导出</button>
              <button class="btn btn-sm btn-danger" @click="removeSlot(s.slot)">删除</button>
            </div>
            <button class="btn btn-sm import-btn" @click="fileInputs[s.slot]?.click()">
              导入 存档文件 到此位
            </button>
            <input
              ref="fileInputs"
              type="file"
              accept=".json,application/json"
              style="display: none"
              :key="refreshKey"
              @change="onImportFile(s.slot, $event)"
            />
          </template>

          <template v-else>
            <div class="slot-info dim">空存档位</div>
            <label class="switch-row" style="font-size: 13px">
              <input type="checkbox" v-model="hardcoreChecked" />
              <span>☠️ 硬核模式（死亡即删档）</span>
            </label>
            <div class="slot-actions" style="margin-top: 6px">
              <button class="btn btn-sm btn-primary" @click="saveInto(s.slot)">在此位新建存档</button>
              <button class="btn btn-sm import-btn" @click="fileInputs[s.slot]?.click()">导入 存档文件 到此位</button>
            </div>
            <input
              ref="fileInputs"
              type="file"
              accept=".json,application/json"
              style="display: none"
              :key="refreshKey"
              @change="onImportFile(s.slot, $event)"
            />
          </template>
        </div>
      </div>

      <p class="dim">当前玩家：{{ player.name }} · 金币 {{ player.gold.toLocaleString() }} · 总等级 {{ player.totalLevels }}</p>
      <p class="dim">提示：读取其他存档位会先自动保存当前进度；导出按钮导出当前存档位。</p>
    </div>
  </div>
</template>
