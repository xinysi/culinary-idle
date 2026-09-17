<script setup>
// 右下角背景音乐播放器（2026-09-17 立；2026-09-18 扩成常驻迷你播放器）
// 玻璃质感胶囊 = 一行常驻控制：[🔊 开关] [⏮ 上一首] [⏸/▶] [⏭ 下一首] [🔂/🔁/🔀 播放模式] [曲名 ▴]；
// 点「曲名」那半向上展开选曲面板（自动 / 13 首 / 音量）。
// 曲目·响度·场景·播放模式的单一来源是 `game/data/bgmTracks.js`；真正播放一律由 `App.vue` 的 `syncBgm()` 执行
// （本组件只改 settings —— bgmTrack/bgmPaused/bgmEnabled/bgmVolume/bgmMode，不直接调 bgm.play）。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { bgm } from '../game/core/sound.js' // 只读 `bgm.current()` 作上一首/下一首的基准（播放仍由 App.vue 的 syncBgm 执行）
import { BGM_TRACKS, BGM_SCENE_LABEL, BGM_MODES, getBgmTrack, getBgmMode, nextBgmMode, nextTrackId, prevTrackId } from '../game/data/bgmTracks.js'

const player = usePlayerStore()
const open = ref(false)

const manualId = computed(() => player.settings?.bgmTrack ?? null)
const isAuto = computed(() => !manualId.value)
const enabled = computed(() => !!player.settings?.bgmEnabled)
const paused = computed(() => enabled.value && !!player.settings?.bgmPaused)
const sounding = computed(() => enabled.value && !paused.value)
const mode = computed(() => getBgmMode(player.settings?.bgmMode))

/** 面板标题上显示「当前在放哪首」：手动选的就是它，否则按场景推一个名字 */
const currentTrack = computed(() => {
  const t = getBgmTrack(manualId.value)
  return t ?? null
})
const currentName = computed(() => {
  if (!enabled.value) return '已关闭'
  if (paused.value) return `已暂停 · ${currentTrack.value?.name ?? '自动'}`
  return currentTrack.value?.name ?? '自动'
})
const currentSceneLabel = computed(() => {
  const t = currentTrack.value
  if (!t) return '跟随场景'
  return t.scene ? BGM_SCENE_LABEL[t.scene] ?? t.desc ?? '' : '变奏曲'
})

function pick(id) {
  player.settings.bgmTrack = id
  player.settings.bgmPaused = false // 点了就放，别让玩家再去找开关
  if (!player.settings.bgmEnabled) player.settings.bgmEnabled = true
}
function setAuto() {
  player.settings.bgmTrack = null
  player.settings.bgmPaused = false
  if (!player.settings.bgmEnabled) player.settings.bgmEnabled = true
}
/** 暂停 / 继续（保留进度：继续时从原位置接着放，不重头） */
function togglePause() {
  if (!player.settings.bgmEnabled) {
    player.settings.bgmEnabled = true // 关着的时候点播放 = 打开并播当前场景
    player.settings.bgmPaused = false
    return
  }
  player.settings.bgmPaused = !player.settings.bgmPaused
}
function toggleEnabled() {
  player.settings.bgmEnabled = !player.settings.bgmEnabled
  if (player.settings.bgmEnabled) player.settings.bgmPaused = false
}
/** 上一首 / 下一首：以「当前这首」为基准在曲库里走一格（随机模式下等于换一首）
 *  自动模式（bgmTrack=null）下按引擎正在播的那首为准；点一下就转为手动选曲（面板里仍可切回「自动」）。 */
const step = (dir) => {
  const cur = manualId.value ?? bgm.current() ?? BGM_TRACKS[0].id
  pick(dir > 0 ? nextTrackId(cur, mode.value.id) : prevTrackId(cur, mode.value.id))
}
/** 播放模式：点一下轮流切（单曲循环 → 顺序 → 随机） */
function cycleMode() {
  player.settings.bgmMode = nextBgmMode(mode.value.id)
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
          <button
            class="bgm-hbtn"
            :title="paused ? '继续播放' : '暂停'"
            :disabled="!enabled"
            @click="togglePause()"
          >
            {{ paused ? '▶' : '⏸' }}
          </button>
          <button class="bgm-hbtn" title="收起" @click="open = false">✕</button>
        </div>
        <div class="bgm-list">
          <button class="bgm-row" :class="{ on: isAuto }" @click="setAuto()">
            <span class="bgm-row-ico">{{ isAuto && sounding ? '▶' : isAuto && paused ? '⏸' : '🔀' }}</span>
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
            <span class="bgm-row-ico">{{ manualId === t.id ? (sounding ? '▶' : paused ? '⏸' : '·') : '·' }}</span>
            <span class="bgm-row-name">{{ t.name }}</span>
            <span class="bgm-row-tag dim">{{ t.desc ?? '' }}</span>
          </button>
        </div>
        <div class="bgm-foot">
          <div class="bgm-mode-row">
            <button
              v-for="m in BGM_MODES"
              :key="m.id"
              class="bgm-mode"
              :class="{ on: mode.id === m.id }"
              :title="m.name + '：' + m.desc"
              @click="player.settings.bgmMode = m.id"
            >
              {{ m.icon }} {{ m.name }}
            </button>
          </div>
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

    <!-- 收起态胶囊 = 常驻迷你播放器：[🔊 开关] [⏮] [⏸/▶] [⏭] [模式] [曲名 ▴] -->
    <div class="bgm-pill" :class="{ 'bgm-pill--off': !enabled }">
      <button
        class="bgm-pp"
        :title="enabled ? '关闭背景音乐' : '开启背景音乐'"
        :aria-label="enabled ? '关闭背景音乐' : '开启背景音乐'"
        @click="toggleEnabled()"
      >
        {{ enabled ? '🔊' : '🔇' }}
      </button>
      <button class="bgm-tbtn" title="上一首" aria-label="上一首" @click="step(-1)">⏮</button>
      <button
        class="bgm-tbtn bgm-tbtn--play"
        :title="!enabled ? '播放' : paused ? '继续播放' : '暂停'"
        :aria-label="paused || !enabled ? '播放' : '暂停'"
        @click="togglePause()"
      >
        {{ !enabled || paused ? '▶' : '⏸' }}
      </button>
      <button class="bgm-tbtn" title="下一首" aria-label="下一首" @click="step(1)">⏭</button>
      <button class="bgm-tbtn" :title="mode.name + '：' + mode.desc + '（点击切换）'" aria-label="播放模式" @click="cycleMode()">
        {{ mode.icon }}
      </button>
      <button class="bgm-open" :title="(enabled ? currentName : '背景音乐已关闭') + '（点击展开选曲）'" @click="open = !open">
        <span class="bgm-name">{{ currentName }}</span>
        <span class="bgm-caret">{{ open ? '▾' : '▴' }}</span>
      </button>
    </div>
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
/* 玻璃胶囊（与 .card 同材质：面板色 + blur + 描边）；左侧暂停钮 + 右侧展开钮 */
.bgm-pill {
  display: flex;
  align-items: center;
  max-width: 100%;
  border-radius: 999px;
  background: rgba(var(--panel-rgb), 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  box-shadow: 0 2px 10px rgba(var(--ink-rgb), 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  overflow: hidden;
}
.bgm-pill:hover { border-color: var(--primary); }
.bgm-pill--off { opacity: 0.75; }
.bgm-tbtn {
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  padding: 7px 6px;
}
.bgm-tbtn:hover { background: rgba(var(--primary-rgb), 0.10); }
.bgm-tbtn--play { color: var(--primary); font-size: 13px; }
.bgm-pp, 
.bgm-open {
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}
.bgm-pp {
  padding: 7px 9px 7px 12px;
  border-right: 1px solid var(--border);
  color: var(--primary);
}
.bgm-open { display: flex; align-items: center; gap: 6px; padding: 7px 12px 7px 9px; }
.bgm-pp:hover, .bgm-open:hover { background: rgba(var(--primary-rgb), 0.10); }
.bgm-tbtn:first-of-type { border-left: 1px solid var(--border); }
/* 模式按钮行（面板底部） */
.bgm-mode-row { display: flex; gap: 5px; margin-bottom: 7px; }
.bgm-mode {
  flex: 1;
  padding: 4px 6px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.bgm-mode:hover { border-color: var(--primary); }
.bgm-mode.on { background: rgba(var(--primary-rgb), 0.16); border-color: rgba(var(--primary-rgb), 0.45); color: var(--primary); }
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
.bgm-hbtn {
  border: none;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 5px;
  border-radius: 6px;
}
.bgm-hbtn:hover { background: rgba(var(--primary-rgb), 0.12); }
.bgm-hbtn:disabled { color: var(--muted); cursor: default; }
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
