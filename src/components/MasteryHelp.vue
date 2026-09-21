<script setup>
// 精通档位说明（2026-09-16 新增）——「📖 精通档位说明」按钮 + 档位对照表弹窗，**三处共用**：
//   ① 采集技能页（替换原先写死在 GatheringView 里的那份 11 行副本）
//   ② 制作技能页（烹饪/烘焙/腌制/调酒/调料/锻造/保鲜/食灵召唤）
//   ③ 厨房笔记（制作类配方的精专场）
//
// 设计要点（改动前先读）：
// 1. **表从 `mastery.js` 的真实函数派生**（`MASTERY_TIERS`），这里一个数字都不手写——
//    手写副本会与函数各自演化，改平衡时页面照旧显示旧值（本项目真实踩过：`gen_tales` 的括号事故同源）。
//    `system_test` C27 校验派生表与函数逐格一致、且任何视图里不再出现手写档位数字。
// 2. 弹窗用 `<Teleport to="body">`：卡片祖先上有 `backdrop-filter`，`position: fixed` 会被它变成
//    「相对该祖先定位」，弹窗会错位——所以必须传送出卡片树（与项目里其它 modal 同级）。
// 3. `showInterval`：制作类配方没有「采集间隔」，该类页面传 false 少一列，避免误导。
// 4. 文案里的「经验倍率与设置倍率取较大」是既有规则（见 mastery 在 Skill.addXp 的取用），别丢。
import { ref, computed } from 'vue'
import { MASTERY_TIERS, MASTERY_LEVEL_CAP, masteryIntervalText, MASTERY_POOL_TIERS, MASTERY_POOL_PER_CARD, MASTERY_POOL_GAIN_RATE } from '../game/core/mastery.js'

const props = defineProps({
  label: { type: String, default: '📖 精通档位说明' },
  showInterval: { type: Boolean, default: true },
  // 用于文案里点明是「采集」还是「制作」（两类都能吃经验/双倍/保底，只有间隔列不同）
  mode: { type: String, default: 'gather' }, // gather | craft
})

const open = ref(false)
const n = (v) => Number(Number(v).toFixed(2))
const tiers = computed(() =>
  MASTERY_TIERS.map((t) => ({
    lv: `${t.level} 级`,
    xp: `×${n(t.xpMult)}`,
    dbl: `${Math.round(t.double * 100)}%`,
    batch: t.batch ? `+${t.batch}` : '—',
    inv: masteryIntervalText(t),
    raw: t,
  }))
)
const isCraft = computed(() => props.mode === 'craft')
// 精通池的文案也从函数派生（档位百分比、最高档经验加成）——一个数字都不手写
const poolPcts = computed(() => MASTERY_POOL_TIERS.map((t) => `${Math.round(t.pct * 100)}%`).join(' / '))
const poolXpCap = computed(() => MASTERY_POOL_TIERS.at(-1).xpPct)
</script>

<template>
  <button class="btn btn-sm" @click="open = true">{{ label }}</button>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="open = false">
      <div class="modal">
        <div class="modal-head">
          <h3>📖 卡片精通档位说明</h3>
          <button class="btn btn-sm" @click="open = false">✕</button>
        </div>
        <p class="dim" style="margin-bottom: 8px">
          精通等级由该卡片累计{{ isCraft ? '制作' : '采集／制作' }}次数提升（0~{{ MASTERY_LEVEL_CAP }} 级）；
          达到对应档位解锁<b>经验倍率</b>、<b>双倍产出</b>与<b>保底产量</b><template v-if="showInterval">，以及<b>间隔档位</b></template>。
        </p>
        <table class="target-table">
          <thead>
            <tr>
              <th>精通</th>
              <th>基础经验</th>
              <th>双倍产出</th>
              <th>保底产量</th>
              <th v-if="showInterval">采集间隔（≥20 级为上限）</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tiers" :key="t.lv">
              <td class="mono">{{ t.lv }}</td>
              <td class="mono">{{ t.xp }}</td>
              <td class="mono">{{ t.dbl }}</td>
              <td class="mono">{{ t.batch }}</td>
              <td v-if="showInterval" class="mono">{{ t.inv }}</td>
            </tr>
          </tbody>
        </table>
        <p class="dim" style="margin-top: 8px">
          精通低于 5 级：经验 ×1、双倍 0%、无保底产量<template v-if="showInterval">、间隔不变</template>。
          <b>保底产量</b>是每次动作额外固定产出的数量（50 级 +1、{{ MASTERY_LEVEL_CAP }} 级 +2），与双倍几率<b>可叠加</b>；
          制作类卡片的双倍＝一次做出两份，保底＝额外多出一份产物。
        </p>
        <p v-if="showInterval" class="dim" style="margin-top: 5px">
          间隔按<b>基础间隔（可减技能等级 / 工具的 −间隔 加成）</b>乘精通比例：<b>5 级</b>减 1/3、<b>10 级起</b>减半；
          <b>20 级起</b>再与当档<b>固定档值</b>（3.6s → {{ MASTERY_LEVEL_CAP }} 级 2.0s）<b>取更快者</b>——基础间隔长的目标由固定档提速，基础间隔短的目标保持「÷2」，
          所以精通每升一档都只会更快、不会更慢。
        </p>
        <p v-if="isCraft" class="dim" style="margin-top: 5px">
          配方精通的进度与档位可在<b>厨房笔记</b>页逐张查看（含「下一档还差几次」）。
        </p>
        <p class="dim" style="margin-top: 5px">
          经验倍率与「设置经验倍率」<b>不叠加</b>（取较大）：当精通倍数 &gt; 设置倍率时用精通倍数（精通为独立成长线）；
          当设置倍率 &gt; 精通倍数（或无精通）时用设置倍率（作用于非精通部分）。
        </p>
        <h4 style="margin: 12px 0 4px">🏊 精通池（整个技能共享）</h4>
        <p class="dim">
          每次动作的精通次数有 <b>{{ Math.round(MASTERY_POOL_GAIN_RATE * 100) }}%</b> 也记进该技能的<b>池</b>；
          池的上限 = 该技能卡片数 × {{ MASTERY_POOL_PER_CARD }}。池在
          <b>{{ poolPcts }}</b> 触发里程碑，给<b>整个技能</b>加成：双倍产出、制作成功率，
          最高档再加 <b>+{{ poolXpCap }}% 经验</b>。
        </p>
        <p class="dim" style="margin-top: 5px">
          ⚠️ 里程碑<b>只在池不低于该阈值时生效</b>——池点数可以 1:1 补给任意卡片，但花掉就会掉档、加成随之消失。
          所以「攒着吃加成」还是「花掉补一张卡」是一个取舍，这也是它和「点亮即永久」类系统的最大不同。
        </p>
      </div>
    </div>
  </Teleport>
</template>
