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
// 胶囊上显示的名字。**不再拼「已暂停 ·」前缀**（2026-09-18 用户要求：那三个字不需要）——
// 暂停态由左侧的 ⏸/▶ 钮本身表达（图标 + title「继续播放」），文字只报「在放哪首」。
const currentName = computed(() => {
  if (!enabled.value) return '已关闭'
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
// 胶囊上的 🔊 已删（2026-09-18 用户要求）；音乐开/关现在只在「设置 → 🔊 音频」页签。
// 这个函数保留：面板与设置都有可能需要「一键开关」，删了反而要重写。
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

    <!-- 收起态胶囊 = 常驻迷你播放器：[⏮] [⏸/▶] [⏭] [模式] [曲名 ▴]
         2026-09-18 用户要求删掉最左的 🔊 开关：音乐开/关改到「设置 → 🔊 音频」页签（那里本来就有）。
         胶囊上只留「听」的操作，开关不再占一格。 -->
    <div class="bgm-pill" :class="{ 'bgm-pill--off': !enabled }">
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
  bottom: 0; /* 2026-09-19 用户要求触底（原先 14px 悬空，压在底栏上沿显得浮着） */
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
  /* ⚠️ stretch 而不是 center：胶囊定高 24px（= 旁边五个功能胶囊的高度，2026-09-21 用户要求
     「BGM 胶囊大小适配为旁边五个胶囊的大小」），子按钮靠 stretch 拉满同高、文字各自居中。
     原先竖 padding 7px ⇒ 33px（窄屏那条 `padding: 7px 10px` 更把它撑到 47px），看起来是两块东西。 */
  align-items: stretch;
  height: var(--dock-pill-h);
  /* 表面与旁边五个功能胶囊**逐项对齐**（2026-09-21 用户：「右边胶囊比左边的小」）——
     单看高度两边都是 24px（矢量与 8 倍栅格都量过），但原先这里是 panel 0.82 + blur14 + 落影 + 顶部内高光，
     而 `.dock-pill` 是 panel 0.72 + blur10 且**没有**落影/高光 ⇒ 亮底上看着比左边发虚、显小。
     现全部取功能胶囊的值（落影与内高光去掉；面板 `.bgm-panel` 仍保留自己的浮层材质）。 */
  max-width: 100%;
  border-radius: 999px;
  background: rgba(var(--panel-rgb), 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  overflow: hidden;
}
.bgm-pill:hover { border-color: var(--primary); }
/* 关闭态**不再整条降透明度**（那会让它比旁边胶囊发虚、显小），改用名字颜色表达「已关闭」 */
.bgm-pill--off .bgm-name { color: var(--muted); }
.bgm-tbtn {
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  /* 竖向 padding 归零、横向保持原值：高度由 `--dock-pill-h` 定死（子项靠 stretch 拉满同高），
     而**横向不能动** —— 一改横向 padding，胶囊宽度就变，`.dock` 的 `right: 250px`（= 14+228+8）随之失效。 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}
.bgm-tbtn:hover { background: rgba(var(--primary-rgb), 0.10); }
/* ⏸ / ▶ 的字形宽度不同（实测 13px 字号下 25px vs 23.2px）⇒ 播放态与暂停态整个胶囊会差 1.8px。
   定宽到「宽的那一档」并居中，两种状态宽度完全一致（播放态观感不变）。 */
.bgm-tbtn--play { color: var(--primary-strong); /* 主色当文字在浅底上不达标 → 深档（2026-09-26）*/ font-size: 13px; flex: 0 0 auto; width: 25px; padding-left: 0; padding-right: 0; }
.bgm-open {
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}
.bgm-open { display: flex; align-items: center; gap: 6px; padding: 0 12px 0 9px; }
.bgm-open:hover { background: rgba(var(--primary-rgb), 0.10); }
/* 胶囊最左一格现在是 ⏮（原先 🔊 的位置，2026-09-18），那条分隔竖线跟着它走 */
.bgm-pill > .bgm-tbtn:first-child { border-left: 1px solid var(--border); }
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
/* ⚠️ 必须是**固定 width**，不能只写 max-width（2026-09-18 用户报「播放器老是变短变长」）：
   原先只有 max-width ⇒ 名字区随内容伸缩（实测「自动」24px / 4 字曲名 48px / 变奏曲名 83px /
   带「已暂停 ·」前缀 130px），整个胶囊因此在 197~275px 之间来回变。
   92px = 最长曲名「灶火慢烹 · 其二」实测 83px + 余量（换平台字体回退更宽时由 ellipsis 兜底，宽度仍恒定）。 */
.bgm-name { width: 92px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
  box-shadow: 0 6px 22px rgba(var(--ink-rgb), 0.26), inset 0 1px 0 rgba(var(--glass-rgb), 0.55);
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
  /* 窄屏也不再靠竖 padding 撑高（那正是「BGM 比旁边胶囊高一截」的另一半原因），只留横向内边距 */
  .bgm-pill { padding: 0 10px; }
  .bgm-panel { width: min(268px, calc(100vw - 24px)); }
}
</style>
