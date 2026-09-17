<script setup>
// 右下角背景音乐播放器（2026-09-17）— 玻璃质感胶囊，点击**向上展开**选曲面板。
// 设计：默认收起（不挡视野）；展开后可从 13 首里任选（含 3 首变奏），或点「自动」跟随场景。
// 曲目/响度/场景映射的单一来源是 `game/data/bgmTracks.js`；播放由 `App.vue` 的 `syncBgm()` 统一执行
// （本组件只改 settings.bgmTrack / bgmEnabled / bgmVolume，不直接调 bgm.play——避免两个调用点打架）。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { BGM_TRACKS, BGM_SCENE_LABEL, getBgmTrack } from '../game/data/bgmTracks.js'

const player = usePlayerStore()
const open = ref(false)

const manualId = computed(() => player.settings?.bgmTrack ?? null)
const isAuto = computed(() => !manualId.value)
const enabled = computed(() => !!player.settings?.bgmEnabled)

/** 面板标题上显示「当前在放哪首」：手动选的就是它，否则按场景推一个名字 */
const currentTrack = computed(() => {
  const t = getBgmTrack(manualId.value)
  return t ?? null
})
const currentName = computed(() => (enabled.value ? currentTrack.value?.name ?? '自动' : '已关闭'))
const currentSceneLabel = computed(() => {
  const t = currentTrack.value
  if (!t) return '跟随场景'
  return t.scene ? BGM_SCENE_LABEL[t.scene] ?? t.desc ?? '' : '变奏曲'
})

function pick(id) {
  player.settings.bgmTrack = id
  if (!player.settings.bgmEnabled) player.settings.bgmEnabled = true // 点了就放，别让玩家再去找开关
}
function setAuto() {
  player.settings.bgmTrack = null
  if (!player.settings.bgmEnabled) player.settings.bgmEnabled = true
}
function toggleEnabled() {
  player.settings.bgmEnabled = !player.settings.bgmEnabled
}
</script>

<template>
  <div class="bgm-player" :class="{ 'bgm-player--open': open }">
    <!-- 展开面板：位于胶囊上方（向上展开） -->
    <transition name="bgm-pop">
      <div v-if="open" class="bgm-panel" @click.stop>
        <div class="bgm-head">
          <span class="bgm-title">🎵 背景音乐</span>
          <span class="bgm-scene dim">{{ currentSceneLabel }}</span>
          <button class="bgm-x" title="收起" @click="open = false">✕</button>
        </div>
        <div class="bgm-list">
          <button class="bgm-row" :class="{ on: isAuto }" @click="setAuto()">
            <span class="bgm-row-ico">🔀</span>
            <span class="bgm-row-name">自动（跟随场景）</span>
            <span class="bgm-row-tag dim">推荐</span>
          </button>
          <button
            v-for="t in BGM_TRACKS"
            :key="t.id"
            class="bgm-row"
            :class="{ on: manualId === t.id }"
            :title="t.desc ?? ''"
            @click="pick(t.id)"
          >
            <span class="bgm-row-ico">{{ manualId === t.id ? '▶' : '·' }}</span>
            <span class="bgm-row-name">{{ t.name }}</span>
            <span class="bgm-row-tag dim">{{ t.desc ?? '' }}</span>
          </button>
        </div>
        <div class="bgm-foot">
          <div class="bgm-vol">
            <span class="dim">音量</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="player.settings.bgmVolume ?? 0.35"
              aria-label="背景音乐音量"
              style="flex: 1"
              @input="player.settings.bgmVolume = Number($event.target.value)"
            />
            <span class="mono dim">{{ Math.round((player.settings.bgmVolume ?? 0.35) * 100) }}%</span>
          </div>
        </div>
      </div>
    </transition>

    <!-- 收起态胶囊（也是展开/收起按钮） -->
    <button class="bgm-pill" :class="{ 'bgm-pill--off': !enabled }" :title="enabled ? '背景音乐：' + currentName + '（点击展开）' : '背景音乐已关闭（点击展开）'" @click="open = !open">
      <span class="bgm-ico" :class="{ 'bgm-ico--play': enabled }">{{ enabled ? '🎵' : '🔇' }}</span>
      <span class="bgm-name">{{ currentName }}</span>
      <span class="bgm-caret">{{ open ? '▾' : '▴' }}</span>
    </button>

    <!-- 静音快捷开关：只在展开时露出，避免收起态太挤 -->
    <button v-if="open" class="bgm-mute" :title="enabled ? '关闭背景音乐' : '开启背景音乐'" @click="toggleEnabled()">
      {{ enabled ? '🔊 开' : '🔇 关' }}
    </button>
  </div>
</template>

<style scoped>
.bgm-player {
  position: fixed;
  right: 14px;
  bottom: 14px;
  z-index: 40; /* 高于内容与侧栏、低于弹窗（弹窗 50/999） */
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  max-width: calc(100vw - 28px);
}
/* 玻璃胶囊（与 .card 同材质：面板色 + blur + 描边） */
.bgm-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(var(--panel-rgb), 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  box-shadow: 0 2px 10px rgba(var(--ink-rgb), 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}
.bgm-pill:hover { border-color: var(--primary); }
.bgm-pill--off { opacity: 0.75; }
.bgm-ico--play { animation: bgm-spin 3.6s linear infinite; display: inline-block; }
@keyframes bgm-spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
.bgm-name { max-width: 108px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bgm-caret { font-size: 10px; color: var(--muted); }

/* 展开面板（向上展开：在胶囊之上，故用 column 顺序 + 出现在 DOM 前） */
.bgm-panel {
  width: min(300px, calc(100vw - 28px));
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: rgba(var(--panel-rgb), 0.88);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  box-shadow: 0 6px 22px rgba(var(--ink-rgb), 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.55);
  overflow: hidden;
}
.bgm-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px 7px;
  border-bottom: 1px dashed var(--border);
}
.bgm-title { font-size: 12px; font-weight: 600; }
.bgm-scene { font-size: 11px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bgm-x {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
}
.bgm-list { max-height: 246px; overflow-y: auto; padding: 4px; }
.bgm-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.bgm-row:hover { background: rgba(var(--primary-rgb), 0.10); }
.bgm-row.on {
  background: rgba(var(--primary-rgb), 0.16);
  border-color: rgba(var(--primary-rgb), 0.45);
  color: var(--primary);
}
.bgm-row-ico { width: 12px; color: var(--primary); flex-shrink: 0; }
.bgm-row-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bgm-row-tag { font-size: 10px; flex-shrink: 0; max-width: 108px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bgm-foot { padding: 7px 10px 9px; border-top: 1px dashed var(--border); }
.bgm-vol { display: flex; align-items: center; gap: 7px; font-size: 11px; }
.bgm-mute {
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(var(--panel-rgb), 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 11px;
  cursor: pointer;
}
.bgm-mute:hover { border-color: var(--primary); }

/* 展开动画：从胶囊处向上"长出来" */
.bgm-pop-enter-active, .bgm-pop-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.bgm-pop-enter-from, .bgm-pop-leave-to { opacity: 0; transform: translateY(10px) scale(0.98); }

/* 窄屏：只留图标与箭头，面板收窄（e2e 会查 390px 无横向溢出） */
@media (max-width: 720px) {
  .bgm-name { display: none; }
  .bgm-pill { padding: 7px 10px; }
  .bgm-panel { width: min(268px, calc(100vw - 24px)); }
}
</style>
