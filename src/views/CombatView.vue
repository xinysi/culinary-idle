<script setup>
// 料理对决视图 — 需求文档 §4 / §9.1.2
// 对决风格选择（§4.3）、属性面板（§4.2）、对手区域与 首领（§4.4）、
// 自动回合战斗、战斗日志、道具使用（§4.5：料理/酱料/饮品）
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getCombat } from '../game/combat/Combat.js'
import { EventBus } from '../game/core/EventBus.js'
import { STYLE_ADVANTAGE, COMBAT_REGIONS, COMBAT_BOSSES } from '../game/data/combat.js'
import { scaledEnemy, enemyScalingText } from '../game/data/enemyScaling.js'
import { resistText, heavyText } from '../game/data/combatTuning.js' // 战斗深度 v1：抗性 / 越级风险的文案出口
import CombatPanel from '../components/CombatPanel.vue'
import DropList from '../components/DropList.vue'
import CombatLog from '../components/CombatLog.vue'
import { foeEmojiOf } from '../game/data/combatDisplay.js'
import { enemyImage } from '../game/data/enemyImage.js'
// 立绘加载失败 → 回落到 emoji（别留白格）；与 CombatArena 同一套写法
const brokenPics = ref(new Set())
function picError(url) {
  if (url && !brokenPics.value.has(url)) brokenPics.value = new Set(brokenPics.value).add(url)
}
const picOk = (url) => !!url && !brokenPics.value.has(url)

const player = usePlayerStore()
const ui = useUiStore()
const combat = getCombat()

// 「区域 / 首领」两个分类（2026-09-20 用户要求：不再把首领堆在区域列表下面，每次都要往下翻）
const pickTab = ref('region')
const selectedRegion = ref(0)
const regionOpponents = computed(() => {
  // 展示按**等级升序**（数据里的顺序是「基础 2 + 扩充 10 + 扩充二 10」，等级会来回跳；
  // 只影响展示副本，不动原数组——掉落是按原下标分配的）
  // 🔴 同时套一层**血量分档**（2026-09-22 用户「abc 都做」→ (c)）：卡片显示 / 右栏详情 /
  //    开打**共用这一个数组**，所以「显示的血量」与「打起来的血量」不可能不一致
  //    （引擎的 `start()` 还会幂等地再确认一次，双保险）。
  return [...(COMBAT_REGIONS[selectedRegion.value]?.opponents ?? [])].sort((a, b) => a.level - b.level).map(scaledEnemy)
})
const bossesSorted = computed(() => [...COMBAT_BOSSES].sort((a, b) => a.level - b.level).map(scaledEnemy))
/** 当前分类下已解锁的对手数（页签上显示进度用） */
const regionLocked = computed(() => regionOpponents.value.filter((o) => !regionUnlocked(o)).length)
const persistent = ref(false) // 持久战：胜利后自动挑战下一个对手（区域顺序循环）
const hardMode = ref(false) // 困难模式（2026-09-06）：BOSS 属性 ×1.5 + 首杀额外奖励
// 掉落与怪物属性改由**右栏常驻详情**显示（2026-09-19 参照梅尔沃：选中怪物即看它的面板）。
// `selected` 存整个对手对象（含 drops），由「点卡片」写入；切区域自动选中该区第一个，保证右栏不为空。
const selected = ref(null)
function pickOpponent(unit) {
  selected.value = unit ?? null
}
watch(selectedRegion, (i) => pickOpponent(COMBAT_REGIONS[i]?.opponents?.[0]))
const combatLevel = computed(() => player.combatLevel)
const inFight = computed(() => combat?.inFight ?? false)
// 战斗帧：依赖全局引擎循环计数（ui.loopTick），每 tick 重算 → 对战框逐帧刷新
// （combat 实例属性非响应式，必须包成响应式帧才能实时显示 生命值/回合/日志变化）
const battleFrame = computed(() => {
  ui.loopTick
  return {
    inFight: combat?.inFight ?? false,
    result: combat?.result ?? null,
    opponentName: combat?.opponent?.name ?? '',
    opponentHp: combat?.opponentHp ?? 0,
    opponentHpMax: combat?.opponent?.hp ?? 1,
    playerHp: player.combat.hp,
    playerHpMax: player.maxHp,
    turn: combat?.turnCount ?? 0,
    turnPct: combat?.inFight ? Math.min(1, (combat.turnTimer ?? 0) / Math.max(1, combat.playerStats().speedMs)) : 0,
    turnStartAt: combat?.inFight ? (combat.turnStartAt ?? performance.now()) : 0,
    turnSpeedMs: combat?.inFight ? Math.max(1, combat.playerStats().speedMs) : 0,
    turnSpeedSec: combat?.inFight ? (combat.playerStats().speedMs / 1000).toFixed(1) : '0.0',
    log: combat?.log ?? [],
  }
})

// ── 食神秘境（2026-09-11 独立成页，界面在 views/MysticRealmView.vue）──
// 食神秘境已独立成页（2026-09-11）。本页**只剩一件事**：`combat:end` 的秘境分支——
// 本局开打后若玩家切到对决页，胜利/失败仍需推进或结算，否则本局会卡住。
// （原先这里还有一张「食神秘境」入口卡，2026-09-19 用户要求对决页不要它，已删；秘境走左栏/realm 页。）
// ── 持久战：胜利后自动重新挑战当前敌人 ──
// 监听随组件挂载注册、卸载解除（避免每次进出对决页叠加一个永不解除的 combat:end 监听）
let persistOff = null
onMounted(() => {
  persistOff = EventBus.on('combat:end', ({ result }) => {
    // 食神秘境（2026-09-09）：秘境局内由 realm 流程接管，不走持久战
    if (player.realmState().active) {
      if (result === 'win') player.realmAdvance()
      else player.realmEnd()
      return
    }
    if (result === 'win' && persistent.value && combat) {
      setTimeout(() => startNextOpponent(), 500) // 小延迟，让胜利结算/日志先落
    }
  })
})
onBeforeUnmount(() => {
  persistOff?.()
  persistOff = null
})
function togglePersistent() {
  persistent.value = !persistent.value
  if (persistent.value) ui.pushLog('⚡ 持久战开启：胜利后自动重新挑战当前敌人', 'info')
  else ui.pushLog('持久战关闭', 'info')
}
function startNextOpponent() {
  if (!persistent.value || !combat) return
  // 重生间隔（(b)）：等它走完再开下一场，避免「自动连打」把间隔刷掉
  const wait = combat.respawnLeftMs?.() ?? 0
  if (wait > 0) { setTimeout(() => startNextOpponent(), Math.ceil(wait) + 30); return }
  const o = combat?.opponent // 当前选中的敌人（胜利后 opponent 引用保留）
  if (!o) return
  if (player.combat.hp <= 0) player.setCombat({ hp: player.maxHp })
  combat.start(o) // 持续攻击同一个敌人
  ui.pushLog(`⚔️ 持久战：继续挑战 ${o.name}（L${o.level}）`, 'info')
}
function regionUnlocked(r) {
  return combatLevel.value >= r.reqLevel
}
/** 空手警告里的「去锻造铜刀」：跳到厨具锻造页（与 EquipmentView 的 goToSkill 同一做法） */
function goCraftKnife() {
  player.setActiveSkill('craftsmithing')
  ui.setView('skill')
}
/** 单个对手是否够等级打（扩充对手等级高于区域门槛，卡片上要能一眼看出） */
function oppUnlocked(o) {
  return combatLevel.value >= o.level
}
function bossUnlocked(b) {
  return combatLevel.value >= b.level
}
function advantageText(style, oppStyle) {
  if (STYLE_ADVANTAGE[style] === oppStyle) return '（克制）'
  if (STYLE_ADVANTAGE[oppStyle] === style) return '（被克制）'
  return ''
}
function startFight(opponent) {
  if (player.combat.hp <= 0) player.setCombat({ hp: player.maxHp })
  let o = opponent
  // 困难模式（2026-09-06）：BOSS 属性 ×1.5 运行时副本；首杀额外奖励，不占 BOSS 击杀口径
  // （副本从**已分档**的对手派生，自带 `__scaled` 标记 ⇒ `scaledEnemy` 不会二次缩放）
  if (hardMode.value && opponent.isBoss) {
    o = {
      ...opponent,
      isHard: true,
      isBoss: false,
      name: `${opponent.name}·困难`,
      hp: Math.round(opponent.hp * 1.5),
      atk: opponent.atk * 1.5,
      def: Math.round(opponent.def * 1.5),
      eva: opponent.eva + 3,
    }
  }
  combat.start(o)
  ui.pushLog(`⚔️ 对决开始：${o.name}${o.isHard ? '（🔥 困难）' : ''}`, 'info')
}
const MECH_LABEL = { regen: '回血', slowEvery: '降攻速', burn: '灼烧', poison: '中毒', instantKill: '秒杀', randomStyle: '随机风格', phases: '三阶段' }
function mechText(b) {
  const ms = []
  for (const [k, v] of Object.entries(b.mechanic ?? {})) {
    if (k === 'slowEvery') ms.push(`每${v}回合降攻速`)
    else if (MECH_LABEL[k]) ms.push(MECH_LABEL[k])
  }
  if (b.crit && b.crit > 0.04) ms.push(`暴击 ${Math.round(b.crit * 100)}%`)
  // ⚠️ 不再展示敌人的 `speedMs`：引擎只用**玩家**的攻速驱动回合，敌人的 speedMs 不参与结算
  //    （2026-09-22 实测确认）——展示一个不生效的数值等于虚假承诺。
  return ms.join('、') || '—'
}
/** 抗性文案（战斗深度 v1）——单独一行展示，见模板处的注释（区域对手没有 mechanic，不能挂在机制行上） */
function resistOf(b) {
  return resistText(b)
}
/** 越级风险提示（战斗深度 v1 第 ④ 件）—— 同等级返回 null ⇒ 那一行不出现；文案走 combatTuning 的出口 */
function heavyRisk(b) {
  return b ? heavyText(b.level, player.combatLevel) : null
}
// 初次进页时先选中当前区域的第一个对手（watch 只在「变化」时触发，首次不会触发）
onMounted(() => pickOpponent(COMBAT_REGIONS[selectedRegion.value]?.opponents?.[0]))
</script>

<template>
  <div class="combat-view">
    <!-- 对战页两栏（2026-09-19 参照梅尔沃，2026-09-20 抽成共享类名供其它战斗页同款使用）：
         左＝选怪 + 战斗屏 + 你的面板；右＝选中怪物的属性与掉落 + 装备槽 -->
    <div class="combat-page">
      <div class="combat-page-main">
        <!-- 战斗屏 + 日志/战备 + 风格/属性（与竞技场/通天塔/秘境/试炼共用同一组件） -->
        <CombatPanel />

        <!-- 对手选择（§4.4）：**两个分类**（区域 / 首领）+ **卡片**
             （2026-09-20 用户要求：① 区域与首领分开切换，不用往下翻找首领；② 敌人与首领都改成卡片） -->
        <div class="card">
          <h3 class="target-head-row">
            <span>{{ pickTab === 'region' ? '对决区域' : '首领挑战' }}</span>
            <span class="pick-tabs">
              <button class="btn btn-sm" :class="{ 'btn-primary': pickTab === 'region' }" @click="pickTab = 'region'">🗺 区域</button>
              <button class="btn btn-sm" :class="{ 'btn-primary': pickTab === 'boss' }" @click="pickTab = 'boss'">👑 首领</button>
            </span>
            <button v-if="pickTab === 'region'" class="btn btn-sm" :class="{ 'btn-primary': persistent }" @click="togglePersistent()">
              {{ persistent ? '⚡ 持久战中（胜利自动续战）' : '持久战' }}
            </button>
            <button v-else class="btn btn-sm" :class="{ 'btn-primary': hardMode }" @click="hardMode = !hardMode">
              {{ hardMode ? '🔥 困难模式开' : '困难模式' }}
            </button>
          </h3>

          <template v-if="pickTab === 'region'">
            <div class="region-tabs">
              <button
                v-for="(r, i) in COMBAT_REGIONS"
                :key="r.id"
                class="btn btn-sm"
                :class="{ 'btn-primary': selectedRegion === i, locked: !regionUnlocked(r) }"
                :disabled="!regionUnlocked(r)"
                @click="selectedRegion = i"
              >{{ r.name }}{{ !regionUnlocked(r) ? `（对决${r.reqLevel}级解锁）` : '' }}</button>
            </div>
            <p class="dim pick-note">
              {{ COMBAT_REGIONS[selectedRegion].desc }} ·
              共 {{ regionOpponents.length }} 位对手<template v-if="regionLocked">（{{ regionLocked }} 位需更高对决等级）</template>
              · 点卡片看右侧详情，点「对决」开打
            </p>
            <!-- 玩法说明（2026-09-22 用户「abc 都做」）：血量分档与重生间隔是**规则**，
                 不写出来就变成暗改（本项目的规矩：显示 = 结算 = 说明） -->
            <p class="dim pick-note scaling-note">
              ⚖️ 低等级对手血量已上调（{{ enemyScalingText() }}）⇒ 同等级一场约 8~12 秒；
              击杀后有 <b>1.5 秒重生间隔</b>（一击秒杀因此不再划算）；对决经验改为<b>按造成的伤害</b>结算
              （打得多、拿得多，溢出伤害不计）。
            </p>
            <!-- 🔴 空手警告（2026-09-26 实测后加）：真新档（100 金 / 0 物品 / 无装备）打第一个敌人
                 「灶台学徒」胜率 **0%**（400 场 0 胜、单场 13 回合 ≈32 秒），而穿上 L1 唯一可穿的
                 「铜刀」后同一场是 **86~100%**、10 回合。也就是说「第一场必败」的唯一原因是没武器 ——
                 这种事必须在**开打前**告诉玩家，否则就是「点进去、输 30 秒、不知道为什么」。 -->
            <p v-if="!player.equipment?.weapon" class="dim pick-note unarmed-warn">
              ⚠️ <b>你还没装备武器</b>：空手 + 没带够料理打对决必败（实测「灶台学徒」胜率 1%、一场 32 秒；
              带 2 份烤土豆也才 45%）。先弄一把刀再来 ——
              <button class="btn btn-sm" @click="goCraftKnife()">🔨 去锻造铜刀</button>
              （松木×4 + 铜矿×4；也可以完成新手目标 ③，会直接送一把）—— 穿上它同一场 100%、单场只要 25 秒
            </p>
            <div class="monster-cards">
              <div
                v-for="o in regionOpponents"
                :key="o.id"
                class="monster-card"
                :class="{ picked: selected?.id === o.id, locked: !oppUnlocked(o) }"
                @click="pickOpponent(o)"
              >
                <img
                  v-if="picOk(enemyImage(o))" :src="enemyImage(o)" class="monster-pic" alt=""
                  :title="o.name" loading="lazy" @error="picError(enemyImage(o))"
                />
                <span v-else class="monster-emoji">{{ foeEmojiOf(o) }}</span>
                <span class="monster-card-name" :title="o.name">{{ o.name }}</span>
                <span class="dim mono monster-card-lv">Lv{{ o.level }}</span>
                <span class="dim monster-card-style">{{ o.styleName }}{{ advantageText(player.combat.style, o.style) }}</span>
                <span class="dim mono monster-card-hp">❤ {{ o.hp }}</span>
                <button
                  class="btn btn-sm btn-primary monster-card-btn"
                  :disabled="battleFrame.inFight || !oppUnlocked(o)"
                  @click.stop="startFight(o)"
                >{{ oppUnlocked(o) ? '对决' : `对决${o.level}级` }}</button>
              </div>
            </div>
          </template>

          <template v-else>
            <p class="dim pick-note">
              🔥 困难模式：点亮后挑战任一首领，属性 ×1.5（生命/攻击/防御/闪避）、掉落照常；
              每个首领的困难首杀额外 +（50+等级×10）金币，不计入普通击杀/赛季任务进度 ⇒ 可冲「食神之巅」成就。
            </p>
            <div class="monster-cards">
              <div
                v-for="b in bossesSorted"
                :key="b.id"
                class="monster-card boss"
                :class="{ picked: selected?.id === b.id, locked: !bossUnlocked(b) }"
                @click="pickOpponent(b)"
              >
                <img
                  v-if="picOk(enemyImage(b))" :src="enemyImage(b)" class="monster-pic monster-pic--boss" alt=""
                  :title="b.name" loading="lazy" @error="picError(enemyImage(b))"
                />
                <span v-else class="monster-emoji">{{ foeEmojiOf(b) }}</span>
                <span class="monster-card-name" :title="b.name">{{ b.name }}</span>
                <span class="dim mono monster-card-lv">Lv{{ b.level }}</span>
                <span class="dim monster-card-style">{{ b.styleName }}</span>
                <span class="dim monster-card-mech" :title="mechText(b)">{{ mechText(b) }}</span>
                <span class="dim mono monster-card-hp">❤ {{ b.hp }}</span>
                <button
                  class="btn btn-sm btn-danger monster-card-btn"
                  :disabled="battleFrame.inFight || !bossUnlocked(b)"
                  @click.stop="startFight(b)"
                >{{ bossUnlocked(b) ? (hardMode ? '🔥 挑战' : '挑战') : `对决${b.level}级` }}</button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 右栏：选中怪物的属性与掉落（梅尔沃的怪物面板）+ 装备槽 -->
      <aside class="combat-page-side">
        <div class="card">
          <h3>怪物详情</h3>
          <template v-if="selected">
            <div class="monster-head">
              <strong>{{ selected.name }}</strong>
              <span class="dim mono">Lv{{ selected.level }}</span>
            </div>
            <div class="monster-stats">
              <div><span>风格</span><span>{{ selected.styleName }}{{ advantageText(player.combat.style, selected.style) }}</span></div>
              <div><span>生命值</span><span class="mono">{{ selected.hp }}</span></div>
              <div><span>攻击</span><span class="mono">{{ Math.round(selected.atk) }}</span></div>
              <div><span>防御</span><span class="mono">{{ Math.round(selected.def) }}</span></div>
              <div><span>命中 / 闪避</span><span class="mono">{{ Math.round(selected.acc) }} / {{ Math.round(selected.eva) }}</span></div>
              <div><span>暴击</span><span class="mono">{{ (selected.crit * 100).toFixed(1) }}%</span></div>
              <div v-if="selected.mechanic"><span>机制</span><span class="dim">{{ mechText(selected) }}</span></div>
              <!-- 战斗深度 v1：抗性**单独一行**，不能塞进上面那条 `v-if="selected.mechanic"` 里 ——
                   区域对手的 mechanic 恒为 null（机制只有首领有），而区域才是玩家练级的常打目标
                   ⇒ 塞进去等于「最需要看抗性的那 220 个敌人反而看不到」。文案走 combatTuning 的出口。 -->
              <div v-if="resistOf(selected)"><span>抗性</span><span class="dim">{{ resistOf(selected) }}</span></div>
              <!-- 越级风险（第 ④ 件）：同等级时为 null ⇒ 这行不出现。它**必须在开打前**看得到，
                   否则「越级会被秒」就成了没有预告的惩罚（Melvor 的公平性正是「最大伤害是已知数」）。 -->
              <div v-if="heavyRisk(selected)"><span>越级风险</span><span class="warn-text">{{ heavyRisk(selected) }}</span></div>
            </div>
            <h4>💧 掉落</h4>
            <!-- 概率走全局难度系数，与引擎里 dropChance(d.chance) 同源；若直接传原始 drops 会「写 30% 实际 6%」 -->
            <DropList :name="selected.name" :drops="selected.drops ?? []" />
          </template>
          <p v-else class="dim">在左侧点一个对手，这里显示它的属性与掉落。</p>
        </div>

        <!-- 战斗日志（2026-09-21 与「装备」互换位置：日志搬到右栏「怪物详情」下面） -->
        <CombatLog />
      </aside>
    </div>
  </div>
</template>


<style scoped>
/* 对手卡片（2026-09-20 用户要求：敌人与首领都从列表改成卡片）——
   自适应网格：一屏能扫完一整个区域（22 张卡 ≈ 4 行），点卡片=看右栏详情、点按钮=开打。 */
/* 怪物详情（右栏）：名字 + Lv 一行，下面「标签 / 数值」两列对齐。
   🔴 2026-09-21 用户报「对决敌人详情显示有问题，错位」—— 这一块**原先一条 CSS 都没有**：
   `<div><span>风格</span><span>刀工流</span></div>` 两个 span 是行内元素，直接连成「风格刀工流」，
   「命中 / 闪避12 / 6」这种两值的更糊。现在用 `justify-content: space-between` 的两列行。 */
.monster-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.monster-head strong {
  font-size: 15px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.monster-stats {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 13px;
}
.monster-stats > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}
/* 左列是标签（固定灰）、右列是数值（靠右、等宽字体）：两列都 `min-width: 0` 防长文本挤压 */
.monster-stats > div > span:first-child {
  flex: 0 0 auto;
  color: var(--text-dim);
}
.monster-stats > div > span:last-child {
  flex: 0 1 auto;
  min-width: 0;
  text-align: right;
  overflow-wrap: anywhere;
}

.monster-cards {
  display: grid;
  /* 2026-09-21 两轮放大：148 → 196 → **238**一列；立绘 56 → 96 → **140**。
     源图已统一重出为 256×256（`--size 256`）⇒ 140 显示是 0.55× 缩小，绝对清晰。 */
  grid-template-columns: repeat(auto-fill, minmax(238px, 1fr));
  gap: 8px;
}
.monster-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 10px 10px;
  border: 1px solid rgba(var(--ink-rgb), 0.14);
  border-radius: 10px;
  background: rgba(var(--panel-soft-rgb), 0.5);
  cursor: pointer;
  min-width: 0;
  text-align: center;
}
.monster-card:hover { border-color: var(--primary); }
.monster-card.picked {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary) inset;
}
.monster-card.locked { opacity: 0.6; }
.monster-card.boss { background: rgba(var(--primary-tint-rgb), 0.06); }
.monster-emoji { font-size: 22px; line-height: 1.1; }
/* 立绘（源图 512×512，2026-09-21 起统一）：卡片里固定高，用 object-fit 保证不同比例不变形。
   ⚠️ 不要加 `image-rendering: pixelated`：这是**降采样**（512 → 140~168），最近邻会掉像素出锯齿。 */
.monster-pic {
  width: 100%;
  height: 140px;
  object-fit: contain;
}
.monster-pic--boss { height: 168px; }

.monster-card-name {
  font-weight: 600;
  font-size: 15px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.monster-card-lv { font-size: 12.5px; }
.monster-card-style,
.monster-card-hp,
.monster-card-mech {
  font-size: 11px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.monster-card-btn { margin-top: 5px; width: 100%; }
.pick-tabs { display: inline-flex; gap: 4px; margin-left: 8px; }
.pick-note { font-size: 12px; margin: 4px 0 8px; }
/* 空手警告：必须比普通说明显眼（它是「点进去就输 30 秒」的前置提示）。
   ⚠️ 颜色走 token（`--warn-soft`/`--warn-strong`）而不是硬编码 —— 深色皮肤由 main.css 的深色块给第二套，
   否则深色下就是一坨奶白底压琥珀字（本项目记过的那类不可读组合）。 */
.unarmed-warn {
  background: var(--warn-soft);
  /* ⚠️ 文字用 `--bad-strong`（不是 `--warn-strong`）：后者压 `--warn-soft` 实测只有 3.3:1，
     12px 小字不达标 —— 与 `.top-nav-guest` 同口径，AGENTS 记过这个组合。 */
  color: var(--bad-strong);
  border-left: 3px solid var(--warn-strong);
  padding: 6px 10px;
  border-radius: 4px;
  font-weight: 600;
}
.unarmed-warn .btn { margin: 0 2px; }
@media (max-width: 720px) {
  /* 窄屏：卡片两列（名字短、不再逐字竖排） */
  .monster-cards { grid-template-columns: repeat(auto-fill, minmax(126px, 1fr)); }
}
</style>
