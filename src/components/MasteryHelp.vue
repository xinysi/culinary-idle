<script setup>
// 精通档位说明（2026-09-16 新增，2026-10-02 重排）——「📖 精通档位说明」按钮 + 档位对照表弹窗，**三处共用**：
//   ① 采集技能页  ② 制作技能页  ③ 厨房笔记
//
// 设计要点（改动前先读）：
// 1. **表从 `mastery.js` 的真实函数派生**（`MASTERY_TIERS`），这里一个数字都不手写——
//    手写副本会与函数各自演化，改平衡时页面照旧显示旧值。`system_test` C27 校验派生表逐格一致。
// 2. 弹窗用 `<Teleport to="body">`：卡片祖先上有 `backdrop-filter`，`position: fixed` 会被它变成
//    「相对该祖先定位」，弹窗会错位——必须传送出卡片树（与项目里其它 modal 同级）。
// 3. `showInterval`：制作类配方没有「采集间隔」，该类页面传 false 少一列，避免误导。
// 4. 文案里的「经验倍率与设置倍率取较大」是既有规则，别丢。
//
// 2026-10-02 排版重做（用户：「卡片精通档位说明的排版需要优化一下」）：
//   改前是 **6 段小字连排** ⇒ 一整面文字墙，四块内容（档位表 / 间隔规则 / 经验规则 / 精通池）混在一起。
//   现按 **小节 + 要点列表** 重排（`mh-*` 私有类）：档位表 → 三列怎么读 → 采集间隔 → 经验倍率 → 精通池。
//   ⚠️ 内容是**原句搬运**（只改分组与排版，不重写措辞）—— 视图里出现手写档位数字会被 C27 判失败。
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
      <div class="modal mh-modal">
        <div class="modal-head">
          <h3>📖 卡片精通档位说明</h3>
          <button class="btn btn-sm" @click="open = false">✕</button>
        </div>

        <p class="dim mh-lead">
          精通等级由该卡片累计{{ isCraft ? '制作' : '采集／制作' }}次数提升（0~{{ MASTERY_LEVEL_CAP }} 级）；
          达到对应档位解锁<b>经验倍率</b>、<b>双倍产出</b>与<b>保底产量</b><template v-if="showInterval">，以及<b>间隔档位</b></template>。
        </p>

        <section class="mh-sec">
          <h4 class="mh-title">📊 档位对照</h4>
          <div class="table-scroll mh-tablewrap">
            <table class="target-table mh-table">
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
          </div>
          <p class="dim mh-foot">
            精通低于 5 级：经验 ×1、双倍 0%、无保底产量<template v-if="showInterval">、间隔不变</template>。
          </p>
        </section>

        <section class="mh-sec">
          <h4 class="mh-title">📌 三列怎么读</h4>
          <ul class="mh-list">
            <li>
              <b>保底产量</b>是每次动作额外固定产出的数量（50 级 +1、{{ MASTERY_LEVEL_CAP }} 级 +2），与双倍几率<b>可叠加</b>。
            </li>
            <li>
              制作类卡片的双倍＝一次做出两份，保底＝额外多出一份产物。
            </li>
            <li>
              经验倍率与「设置经验倍率」<b>不叠加</b>（取较大）：当精通倍数 &gt; 设置倍率时用精通倍数（精通为独立成长线）；
              当设置倍率 &gt; 精通倍数（或无精通）时用设置倍率（作用于非精通部分）。
            </li>
          </ul>
        </section>

        <section v-if="showInterval" class="mh-sec">
          <h4 class="mh-title">⏱ 采集间隔怎么算</h4>
          <ul class="mh-list">
            <li>
              间隔按<b>基础间隔（可减技能等级 / 工具的 −间隔 加成）</b>乘精通比例：<b>5 级</b>减 1/3、<b>10 级起</b>减半。
            </li>
            <li>
              <b>20 级起</b>再与当档<b>固定档值</b>（3.6s → {{ MASTERY_LEVEL_CAP }} 级 2.0s）<b>取更快者</b>
              —— 基础间隔长的目标由固定档提速，基础间隔短的目标保持「÷2」。
            </li>
            <li>所以精通每升一档都只会更快、不会更慢。</li>
          </ul>
        </section>

        <section v-if="isCraft" class="mh-sec">
          <h4 class="mh-title">🍳 逐张查看</h4>
          <p class="dim mh-foot">配方精通的进度与档位可在<b>厨房笔记</b>页逐张查看（含「下一档还差几次」）。</p>
        </section>

        <section class="mh-sec mh-sec--pool">
          <h4 class="mh-title">🏊 精通池（整个技能共享）</h4>
          <ul class="mh-list">
            <li>
              每次动作的精通次数有 <b>{{ Math.round(MASTERY_POOL_GAIN_RATE * 100) }}%</b> 也记进该技能的<b>池</b>；
              池的上限 = 该技能卡片数 × {{ MASTERY_POOL_PER_CARD }}。
            </li>
            <li>
              池在 <b>{{ poolPcts }}</b> 触发里程碑，给<b>整个技能</b>加成：双倍产出、制作成功率，
              最高档再加 <b>+{{ poolXpCap }}% 经验</b>。
            </li>
            <li class="mh-warn">
              ⚠️ 里程碑<b>只在池不低于该阈值时生效</b> —— 池点数可以 1:1 补给任意卡片，但花掉就会掉档、加成随之消失。
              所以「攒着吃加成」还是「花掉补一张卡」是一个取舍，这也是它和「点亮即永久」类系统的最大不同。
            </li>
          </ul>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* 排版（2026-10-02 重做）：小节卡片 + 要点列表；全部走全局 token，深色主题自动跟随。
   ⚠️ 这里只定义 `mh-*` 私有类，**不复用也不改写全局 `.modal` / `.target-table`**（避免影响别的弹窗）。 */
.mh-modal { max-width: 760px; width: min(760px, 94vw); }
.mh-lead { margin: 0 0 12px; line-height: 1.7; }

.mh-sec {
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(var(--panel-rgb), 0.5);
}
.mh-sec--pool { border-color: rgba(var(--primary-rgb), 0.35); }
.mh-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-strong);
}

/* 要点列表：去掉默认缩进，用圆点对齐，行距放宽（原先 6 段小字连排读不动） */
.mh-list { margin: 0; padding-left: 18px; }
.mh-list > li { margin-bottom: 6px; line-height: 1.75; }
.mh-list > li:last-child { margin-bottom: 0; }
.mh-list > li.mh-warn { color: var(--text-dim); }

.mh-foot { margin: 8px 0 0; font-size: 12px; }

/* 档位表：11 行在窄屏会溢出 ⇒ 必须能横向滚（项目约定 .table-scroll） */
.mh-tablewrap { margin-bottom: 0; }
.mh-table { margin: 0; }
.mh-table th, .mh-table td { padding: 4px 8px; white-space: nowrap; text-align: center; }
.mh-table thead th { font-size: 12px; }
.mh-table tbody tr:nth-child(even) { background: rgba(var(--panel-rgb), 0.45); }

@media (max-width: 720px) {
  .mh-sec { padding: 9px 10px; }
  .mh-table th, .mh-table td { padding: 3px 6px; font-size: 12px; }
}
</style>
