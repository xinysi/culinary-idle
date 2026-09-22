<script setup>
// 战斗屏（2026-09-19 参照梅尔沃，从 CombatPanel 抽出成共用组件）——
// **常驻**显示：回合进度横贯 → 左「你」/ 右「对手」对峙 → 战斗中专用的道具 → 停止。
// ⚠️ 战斗日志**不在这里**（2026-09-19 用户要求日志与「战备」并排占半行）→ 见 `CombatLog.vue`。
// 所有会开打的页面共用同一份：对决技能页（CombatPanel）/ 竞技场 / 通天塔 / 秘境 / 厨神试炼 / 厨神挑战。
// ⚠️ 它读全局 `getCombat()` 单例与 player/ui store，**不接受战斗对象作为 prop** ——
//    因为战斗状态本来就存在单例里，传 prop 反而会出现「传进来的和实际在打的不一致」。
import { computed, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getCombat } from '../game/combat/Combat.js'
import { foeEmojiOf } from '../game/data/combatDisplay.js'
import { enemyImage } from '../game/data/enemyImage.js'
import { chefImage, chefEmoji } from '../game/data/chefImage.js'
import { ref } from 'vue'
import { sfx } from '../game/core/sound.js'
import { BISCUIT_HEAL_PCT, BISCUIT_ACC, BISCUIT_SPEED_PCT } from '../game/data/biscuitUse.js'
import ProgressBar from './ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()
const combat = getCombat()

// 战斗帧：依赖全局引擎循环计数（ui.loopTick），每 tick 重算 → 逐帧刷新血条/回合/日志
const battleFrame = computed(() => {
  ui.loopTick
  return {
    inFight: combat?.inFight ?? false,
    result: combat?.result ?? null,
    opponentName: combat?.opponent?.name ?? '',
    opponentHp: combat?.opponentHp ?? 0,
    opponentHpMax: combat?.opponent?.hp ?? 1,
    playerHp: player.combat.hp,
    playerHpMax: player.maxHp, // 与引擎同一口径（store 的 maxHp 已含全部外部 %）
    speedAtCap: combat?.playerStats?.().speedAtCap === true, // 攻速撞硬下限 ⇒ 饼干/奥义的攻速部分无效果
    turn: combat?.turnCount ?? 0,
    turnStartAt: combat?.inFight ? (combat.turnStartAt ?? performance.now()) : 0,
    turnSpeedMs: combat?.inFight ? Math.max(1, combat.playerStats().speedMs) : 0,
    turnSpeedSec: combat?.inFight ? (combat.playerStats().speedMs / 1000).toFixed(1) : '0.0',
    log: combat?.log ?? [],
  }
})

const foeEmoji = computed(() => foeEmojiOf(combat?.opponent))
// 对手立绘（2026-09-21）：有图用图、没图回落 emoji（不会破图）
// ⚠️ 必须依赖 loopTick：`combat` 是模块级单例、换对手时组件不会自动重算
// ⚠️ 立绘加载失败必须**回落到 emoji**，不能只把 <img> 藏起来 —— 那样这一格会变成空白
//   （2026-09-21 实测：玩家形象图还没放进去时，左侧「你」直接空了一块）。
const brokenPics = ref(new Set())
function picError(url) {
  if (url && !brokenPics.value.has(url)) brokenPics.value = new Set(brokenPics.value).add(url)
}
const picOk = (url) => !!url && !brokenPics.value.has(url)

// 玩家形象（2026-09-21）：设置里选了就有图，没放图就回落 emoji；同样依赖 loopTick 才能随设置切换刷新
const mePicture = computed(() => {
  ui.loopTick
  return chefImage(player.settings?.chefAvatar)
})
const meEmoji = computed(() => chefEmoji(player.settings?.chefAvatar))
// 对手立绘：有敌人就用敌人的；**未选对手时用主角形象的镜像**（用户 2026-09-21 要求），
// 所以「镜像」只在这一种情况下生效（真对打时两边不该是同一个人的镜像）。
const foePicture = computed(() => {
  ui.loopTick
  return enemyImage(combat?.opponent) ?? chefImage(player.settings?.chefAvatar)
})
const foeMirrored = computed(() => {
  ui.loopTick
  return !enemyImage(combat?.opponent)
})

function useItem(kind, id) {
  if (kind === 'spice') combat.useMysterySpice()
  else if (kind === 'biscuit') combat.useEnergyBiscuit()
}
function stopFight() {
  combat.stop()
}

// 回合命中音效（节流 400ms）——跟战斗屏放一起，其它页面共用时也自然有声
let lastHitAt = 0
watch(
  () => battleFrame.value?.turn ?? 0,
  (t, old) => {
    if (t > old && player.settings.soundEnabled && Date.now() - lastHitAt > 400) {
      lastHitAt = Date.now()
      sfx.hit()
    }
  },
)
</script>

<template>
  <div class="card combat-arena" :class="{ live: battleFrame.inFight }">
    <!-- 顶部：左上角「战备」（各页面通过 #corner 传入）+ 回合进度横贯整屏 -->
    <div class="arena-bar">
      <div class="arena-corner"><slot name="corner" /></div>
      <div class="arena-progress">
        <span class="dim arena-turn">{{ battleFrame.inFight || battleFrame.result ? `第 ${battleFrame.turn} 回合` : '待机' }}</span>
        <ProgressBar :start-at="battleFrame.inFight ? battleFrame.turnStartAt : null" :duration-ms="battleFrame.turnSpeedMs" :active="battleFrame.inFight" />
        <span class="dim arena-turn">{{ battleFrame.turnSpeedSec }}s / 回合</span>
      </div>
    </div>

    <!-- 舞台：左「你」 / 中 VS / 右「对手」 -->
    <div class="arena-stage">
      <div class="arena-side">
        <img
          v-if="picOk(mePicture)" :src="mePicture" class="arena-portrait arena-portrait--pic" alt=""
          @error="picError(mePicture)"
        />
        <div v-else class="arena-portrait">{{ meEmoji }}</div>
        <strong class="arena-name">你</strong>
        <span class="mono arena-hp">{{ Math.round(battleFrame.playerHp) }} / {{ Math.round(battleFrame.playerHpMax) }}</span>
        <div class="hp-bar"><div class="hp-fill" :class="{ low: battleFrame.playerHp / battleFrame.playerHpMax < 0.3 }" :style="{ width: Math.max(0, battleFrame.playerHp / battleFrame.playerHpMax * 100) + '%' }"></div></div>
      </div>
      <div class="arena-mid">
        <div class="arena-vs">VS</div>
        <div v-if="battleFrame.result === 'win'" class="combat-result win">🏆 胜利！</div>
        <div v-else-if="battleFrame.result === 'lose'" class="combat-result lose">💀 战败</div>
      </div>
      <div class="arena-side foe" :class="{ empty: !battleFrame.opponentName }">
        <img
          v-if="picOk(foePicture)" :src="foePicture" class="arena-portrait arena-portrait--pic"
          :class="{ 'arena-portrait--mirror': foeMirrored }" alt=""
          @error="picError(foePicture)"
        />
        <div v-else class="arena-portrait">{{ foeEmoji }}</div>
        <strong class="arena-name">{{ battleFrame.opponentName || '未选择对手' }}</strong>
        <span class="mono arena-hp">{{ Math.round(battleFrame.opponentHp) }} / {{ Math.round(battleFrame.opponentHpMax) }}</span>
        <div class="hp-bar opp"><div class="hp-fill opp" :style="{ width: Math.max(0, battleFrame.opponentHp / battleFrame.opponentHpMax * 100) + '%' }"></div></div>
      </div>
    </div>

    <!-- 战斗中专用的道具（料理/酱料/饮品在「战备」卡里常驻，开打前就能吃） -->
    <div v-if="(player.inventory.mysterySpice ?? 0) > 0 || (player.inventory.energyBiscuit ?? 0) > 0" class="item-actions arena-items">
      <div v-if="(player.inventory.mysterySpice ?? 0) > 0" class="item-group">
        <button class="btn btn-sm" @click="useItem('spice')">🪄 神秘调料 ×{{ player.inventory.mysterySpice }}</button>
      </div>
      <div v-if="(player.inventory.energyBiscuit ?? 0) > 0" class="item-group">
        <button class="btn btn-sm" :disabled="combat.biscuitCooldown > 0" @click="useItem('biscuit')">
          🍪 能量补给 ×{{ player.inventory.energyBiscuit }}
          <span v-if="combat.biscuitCooldown > 0" class="dim">（冷却 {{ combat.biscuitCooldown }} 回合）</span>
          <span v-else class="dim">（回血 {{ Math.floor(battleFrame.playerHpMax * BISCUIT_HEAL_PCT) }} · 命中+{{ BISCUIT_ACC }} · 攻速+{{ BISCUIT_SPEED_PCT }}%<template v-if="battleFrame.speedAtCap">，已到上限</template>）</span>
        </button>
      </div>
    </div>

    <div class="arena-foot">
      <span class="dim">{{ battleFrame.inFight ? '自动回合制，无需操作；可随时吃料理/酱料或停止' : '选一个对手点「对决」即可开打' }}</span>
      <button v-if="battleFrame.inFight" class="btn btn-sm" @click="stopFight()">停止对决</button>
    </div>
  </div>
</template>

<style scoped>
.combat-arena {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
/* 顶行：左「战备」角 + 右侧回合进度（2026-09-21 战备从半行整卡挪到这里）
   ⚠️ 用 flex 而不是 grid：角上的战备宽度是定的（组件内固定宽），进度条吃掉剩余宽度即可；
   原先的 grid 三列（92/1fr/92）在塞进战备后会把它挤扁。 */
.arena-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}
.arena-corner {
  flex: 0 0 auto;
  min-width: 0;
}
.arena-progress {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.arena-progress > :deep(.progress-bar) {
  flex: 1 1 auto;
  min-width: 0;
}
.arena-turn {
  font-size: 12px;
  white-space: nowrap;
}
.arena-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 88px minmax(0, 1fr);
  align-items: start;
  gap: 10px;
}
.arena-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
}
.arena-side .hp-bar {
  width: 100%;
}
.arena-portrait {
  font-size: 34px;
  line-height: 1.1;
}
/* 立绘（2026-09-21 三轮调整）：64 → 112 → **176**，源图 512×512 ⇒ 0.34× 降采样，原生清晰。
   ⚠️ 不要加 `image-rendering: pixelated`：源图比显示尺寸大（降采样），最近邻会**丢掉 2/3 的像素**
   变成锯齿，正是用户报的「糊糊的」。pixelated 只适合 1:1 或整数倍放大（物品 32px 图那种）。 */
.arena-portrait--pic {
  width: 176px;
  height: 176px;
  object-fit: contain;
  align-self: center;
}
/* 未选对手时右侧显示主角形象的镜像（用户 2026-09-21 要求）。
   ⚠️ 用**独立 `scale` 属性**而不是 `transform: scaleX(-1)`：战斗中的呼吸动画写的是 `transform`，
   两者会互相覆盖（同一属性只有一个赢家）⇒ 镜像会在开打瞬间消失。 */
.arena-portrait--mirror {
  scale: -1 1;
}
.arena-side.foe .arena-portrait {
  filter: drop-shadow(0 0 6px rgba(var(--bad-rgb), 0.35));
}
/* 战斗中：双方头像呼吸，给「正在打」一点动感（待机时静止） */
.combat-arena.live .arena-portrait {
  animation: arena-breathe 1.8s ease-in-out infinite;
}
.arena-side.foe .arena-portrait {
  animation-delay: 0.45s;
}
@keyframes arena-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-3px) scale(1.06); }
}
.arena-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.arena-side.empty {
  opacity: 0.65;
}
.arena-hp {
  font-size: 12px;
}
.arena-mid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-top: 8px;
}
.arena-vs {
  font-weight: 700;
  font-size: 15px;
  color: var(--primary);
  letter-spacing: 1px;
}
.arena-items {
  justify-content: center;
}
.arena-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
@media (max-width: 720px) {
  /* 窄屏：VS 夹在两侧会挤，改成上下（你 / VS / 对手） */
  .arena-stage {
    grid-template-columns: minmax(0, 1fr);
  }
  .arena-mid {
    padding-top: 0;
    flex-direction: row;
    justify-content: center;
    gap: 10px;
  }
  .arena-bar {
    flex-wrap: wrap;
  }
  /* 窄屏先让「x.x s / 回合」让位（同一数字在「属性面板 → 回合间隔」里还能看到） */
  .arena-progress .arena-turn:last-child {
    display: none;
  }
}
</style>
