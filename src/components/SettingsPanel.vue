<script setup>
// 设置面板 — 需求文档 §10.2.3 settings 字段
// 2026-09-13 重构：原来的 15 行平铺列表按用途分成 4 个页签（游玩 / 画面 / 音频 / 角色），
//   每组再收进一张虚线小卡；皮肤选择器改为网格（15 套）。**设置项与绑定一律未改**，只动版式。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { primeAudio, sfx } from '../game/core/sound.js'
import { SKINS, skinUnlocked } from '../game/data/skins.js'

const player = usePlayerStore()
const ui = useUiStore()

const TABS = [
  { id: 'play', icon: '🎮', name: '游玩' },
  { id: 'look', icon: '🎨', name: '画面' },
  { id: 'audio', icon: '🔊', name: '音频' },
  { id: 'account', icon: '👤', name: '角色' },
]
const tab = ref('play')

// 皮肤解锁按成就数（与「成就」系统联动）；点未解锁的给出提示音与日志
const achievementCount = computed(() => (player.achievements ?? []).length)
const unlockedSkins = computed(() => SKINS.filter((s) => skinUnlocked(s.id, achievementCount.value)).length)
function pickSkin(skin) {
  if (!skinUnlocked(skin.id, achievementCount.value)) {
    sfx.error()
    ui.pushLog(`🎨 皮肤「${skin.name}」需 ${skin.need} 项成就解锁（当前 ${achievementCount.value}）`, 'warn')
    return
  }
  player.settings.skin = skin.id
  sfx.tab()
}
const nameDraft = ref(player.name)
const nameMsg = ref('')

function saveName() {
  const r = player.setName(nameDraft.value)
  nameMsg.value = r.ok ? '已保存' : r.msg
}

// 界面缩放（档位 90%-110%，2026-09-06 收窄：主内容排版按 100% 设计，超出安全区间会错乱）
function applyScale(pct) {
  const v = Math.min(1.1, Math.max(0.9, Number(pct) / 100))
  player.settings.uiScale = v
  applyUiScale(v)
}
function applyUiScale(v) {
  const el = document.documentElement
  el.style.zoom = v === 1 ? '' : String(v)
  // 缩放档位标记：110% 网格减一列（与 App.vue 保持一致）
  if (v === 1) delete el.dataset.scale
  else el.dataset.scale = String(Math.round(v * 100))
}
// 打开面板时同步当前缩放
applyUiScale(player.settings.uiScale ?? 1)

// 高清晰模式（2026-09-10）
function applyCrispMode(on) {
  player.settings.crispMode = !!on
  if (on) document.documentElement.dataset.crisp = '1'
  else delete document.documentElement.dataset.crisp
}

// 存档与导入导出（原「存档」面板的入口，集中到设置里方便找）
function openSavePanel() {
  ui.toggleSettingsPanel(false)
  ui.toggleSavePanel(true)
}
</script>

<template>
  <div class="modal-backdrop" @click.self="ui.toggleSettingsPanel(false)">
    <div class="modal settings-modal">
      <header class="modal-head">
        <h3>设置</h3>
        <button class="btn btn-sm" @click="ui.toggleSettingsPanel(false)">✕</button>
      </header>

      <div class="region-tabs settings-tabs">
        <button
          v-for="t in TABS"
          :key="t.id"
          class="btn btn-sm"
          :class="{ 'btn-primary': tab === t.id }"
          @click="tab = t.id"
        >{{ t.icon }} {{ t.name }}</button>
      </div>

      <div class="settings-body">
        <!-- ── 🎮 游玩 ── -->
        <template v-if="tab === 'play'">
          <section class="set-group">
            <h4>对决与补给</h4>
            <div class="settings-row">
              <label class="switch-row">
                <input type="checkbox" v-model="player.settings.autoEat" />
                <span>对决自动进食（料理回血）</span>
              </label>
            </div>
            <div class="settings-row">
              <span class="dim">自动进食阈值：{{ player.settings.autoEatThreshold }}%</span>
              <input type="range" min="10" max="90" step="10" v-model.number="player.settings.autoEatThreshold" style="flex: 1" />
            </div>
            <div class="settings-row">
              <label class="switch-row">
                <input type="checkbox" v-model="player.settings.autoSupply" />
                <span>自动补给（陷阱/装饰食材低于 50 时自动从杂货铺补到 200）</span>
              </label>
            </div>
            <div class="settings-row">
              <span class="dim">补给保留金币：</span>
              <input type="number" min="0" step="500" v-model.number="player.settings.autoSupplyReserve" style="flex: 1" />
              <span class="dim" style="font-size: 12px">低于该金币不自动购买</span>
            </div>
          </section>

          <section class="set-group">
            <h4>挂机</h4>
            <div class="settings-row">
              <label class="switch-row">
                <input type="checkbox" v-model="player.settings.autoFarm" />
                <span>农耕自动收种（成熟即收获并补种同种种子）</span>
              </label>
            </div>
            <div class="settings-row">
              <span class="dim">挂机并行上限：</span>
              <select v-model.number="player.settings.maxParallelIdle" style="flex: 1">
                <option :value="0">无限制（全部已选目标并行）</option>
                <option :value="3">3 个技能并行</option>
                <option :value="2">2 个技能并行</option>
                <option :value="1">1 个技能（文档原版单技能模式）</option>
              </select>
            </div>
          </section>

          <section class="set-group">
            <h4>成长</h4>
            <div class="settings-row">
              <span class="dim">经验倍率：</span>
              <select v-model.number="player.settings.xpMultiplier" style="flex: 1">
                <option :value="1">1×（默认）</option>
                <option :value="10">10×</option>
                <option :value="50">50×</option>
                <option :value="100">100×</option>
                <option :value="250">250×</option>
                <option :value="500">500×</option>
                <option :value="1000">1000×</option>
              </select>
            </div>
          </section>
        </template>

        <!-- ── 🎨 画面 ── -->
        <template v-else-if="tab === 'look'">
          <section class="set-group">
            <h4>界面主题</h4>
            <div class="settings-row">
              <div class="seg">
                <button class="btn btn-sm" :class="{ 'btn-primary': player.settings.theme !== 'dark' }" @click="player.settings.theme = 'light'">☀️ 亮色</button>
                <button class="btn btn-sm" :class="{ 'btn-primary': player.settings.theme === 'dark' }" @click="player.settings.theme = 'dark'">🌙 深色</button>
              </div>
            </div>
          </section>

          <section class="set-group">
            <h4>
              界面皮肤
              <span class="dim">已解锁 {{ unlockedSkins }} / {{ SKINS.length }} 套 · 当前成就 {{ achievementCount }}</span>
            </h4>
            <div class="skin-picker">
              <button
                v-for="sk in SKINS"
                :key="sk.id"
                class="skin-chip"
                :class="{ on: player.settings.skin === sk.id, locked: !skinUnlocked(sk.id, achievementCount) }"
                :title="skinUnlocked(sk.id, achievementCount) ? sk.desc : `需 ${sk.need} 项成就解锁（当前 ${achievementCount}）`"
                @click="pickSkin(sk)"
              >
                <span class="skin-chip-name">{{ sk.icon }} {{ sk.name }}</span>
                <span v-if="!skinUnlocked(sk.id, achievementCount)" class="dim skin-need">🔒 {{ sk.need }}</span>
              </button>
            </div>
            <p class="dim set-note">皮肤覆盖整份配色（底色 / 面板 / 文字 / 描边），浅色与深色各一版；按成就数逐套解锁。</p>
          </section>

          <section class="set-group">
            <h4>可读性</h4>
            <div class="settings-row">
              <span class="dim">界面缩放：{{ Math.round((player.settings.uiScale ?? 1) * 100) }}%（90%-110%，超出会排版错乱）</span>
              <input
                type="range"
                min="90"
                max="110"
                step="10"
                :value="Math.round((player.settings.uiScale ?? 1) * 100)"
                style="flex: 1"
                @input="applyScale($event.target.value)"
              />
            </div>
            <div class="settings-row">
              <label class="switch-row">
                <input type="checkbox" :checked="player.settings.crispMode" @change="applyCrispMode($event.target.checked)" />
                <span>高清晰模式</span>
              </label>
            </div>
            <p class="dim set-note">关闭毛玻璃模糊、抬高不透明度、加深次要文字——文字更锐利（界面缩放 100% 时效果最好）。</p>
          </section>
        </template>

        <!-- ── 🔊 音频 ── -->
        <template v-else-if="tab === 'audio'">
          <section class="set-group">
            <h4>音效</h4>
            <div class="settings-row">
              <label class="switch-row">
                <input type="checkbox" v-model="player.settings.soundEnabled" @change="player.settings.soundEnabled && primeAudio()" />
                <span>开启音效（点击 / 制作 / 升级 / 胜负 / 奖励提示）</span>
              </label>
            </div>
            <div class="settings-row">
              <span class="dim" style="width: 84px">音效音量</span>
              <input type="range" min="0" max="1" step="0.05" v-model.number="player.settings.sfxVolume" style="flex: 1" />
              <span class="mono dim">{{ Math.round((player.settings.sfxVolume ?? 0.6) * 100) }}%</span>
            </div>
          </section>

          <section class="set-group">
            <h4>背景音乐</h4>
            <div class="settings-row">
              <label class="switch-row">
                <input type="checkbox" v-model="player.settings.bgmEnabled" @change="player.settings.bgmEnabled && primeAudio()" />
                <span>开启背景音乐（3 首：昼 / 夜 / 战斗，按主题与战况自动切换）</span>
              </label>
            </div>
            <div class="settings-row">
              <span class="dim" style="width: 84px">音乐音量</span>
              <input type="range" min="0" max="1" step="0.05" v-model.number="player.settings.bgmVolume" style="flex: 1" />
              <span class="mono dim">{{ Math.round((player.settings.bgmVolume ?? 0.35) * 100) }}%</span>
            </div>
          </section>

          <p class="dim set-note">音效与音乐均由 Web Audio 合成（无音频文件，不占体积）。</p>
        </template>

        <!-- ── 👤 角色 ── -->
        <template v-else>
          <section class="set-group">
            <h4>玩家名字</h4>
            <div class="settings-row">
              <input v-model="nameDraft" maxlength="16" style="flex: 1" @keyup.enter="saveName" />
              <button class="btn btn-sm" @click="saveName">保存</button>
              <span v-if="nameMsg" class="dim" style="font-size: 12px">{{ nameMsg }}</span>
            </div>
          </section>

          <section class="set-group">
            <h4>存档</h4>
            <div class="settings-row">
              <button class="btn btn-sm" @click="openSavePanel">存档与导入导出 ↗</button>
              <span class="dim" style="flex: 1">3 个存档位 · 导入导出 · 防覆盖快照</span>
            </div>
          </section>

          <p class="dim set-note">设置随存档保存；主题与皮肤另存全局键，启动界面也生效。</p>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-modal {
  width: min(600px, 94vw);
}
.settings-tabs {
  margin-bottom: 8px;
}
.settings-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: min(62vh, 540px);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
}
.set-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  background: rgba(var(--panel-soft-rgb), 0.5);
}
.set-group > h4 {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-dim);
}
.set-note {
  margin: 0;
  font-size: 12px;
}
.seg {
  display: flex;
  gap: 6px;
}
.skin-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 6px;
}
.skin-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
  border: 1px dashed var(--border);
  background: var(--bg-soft);
}
.skin-chip-name {
  white-space: nowrap;
}
.skin-chip.on {
  border-style: solid;
  border-color: var(--primary-strong);
  background: rgba(var(--primary-tint-rgb), 0.15);
  font-weight: 700;
}
.skin-chip.locked {
  opacity: 0.6;
}
.skin-need {
  font-size: 11px;
}
</style>
