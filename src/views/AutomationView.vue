<script setup>
// 自动化中心（2026-09-10 新增）— 集中展示全部自动化，并提供三项可解锁自动化（金币）。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { AUTOMATIONS, FREE_AUTOMATIONS, SELL_THRESHOLD_DEFAULT } from '../game/data/automation.js'
import { getSkillDef } from '../game/data/skills.js'
import { getAllSkillInstances } from '../game/skills/registry.js'

const player = usePlayerStore()
const ui = useUiStore()

const PROD_SKILLS = ['cooking', 'baking', 'preserving', 'brewing', 'spiceMixing', 'craftsmithing', 'preservation', 'spiritSummoning']

const cards = computed(() =>
  AUTOMATIONS.map((def) => ({
    def,
    unlocked: player.automationUnlocked(def.id),
  }))
)

const unlockedCount = computed(() => AUTOMATIONS.filter((a) => player.automationUnlocked(a.id)).length)
const sellThreshold = computed(() => player.automation?.sellThreshold ?? SELL_THRESHOLD_DEFAULT)
const autoSold = computed(() => ({ qty: player.stats?.autoSold ?? 0, gold: player.stats?.autoSoldGold ?? 0 }))

/** 常驻配方选择：每个制作技能一个下拉 */
const standbyRows = computed(() =>
  PROD_SKILLS.map((id) => {
    const inst = getAllSkillInstances().find((s) => s.id === id)
    return { id, name: getSkillDef(id)?.name ?? id, recipes: (inst?.recipes ?? []).filter((r) => r.reqLevel <= (player.skills[id]?.level ?? 1)) }
  })
)

function unlock(def) {
  const r = player.automationUnlock(def.id)
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function setThreshold(e) {
  player.setSellThreshold(e.target.value)
}
function setStandby(skillId, recipeId) {
  player.setStandbyRecipe(skillId, recipeId || null)
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'expedition', label: '🚢 采集队' }, { view: 'ranch', label: '🐄 牧场' }, { view: 'cellar', label: '🍶 地窖' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🤖 自动化中心</h2>
        <p class="dim">
          已有自动化一览 + 三项可解锁自动化。解锁后每 5 秒自动执行一次，切页/挂机都生效（离线不结算自动出售）。
        </p>
      </div>
    </header>

    <div class="card status-line">
      <span class="badge badge-on">已解锁 {{ unlockedCount }} / {{ AUTOMATIONS.length }}</span>
      <span class="dim">自动出售累计 <b class="mono">{{ autoSold.qty.toLocaleString() }}</b> 件 · 回收 <b class="mono">{{ autoSold.gold.toLocaleString() }}</b> 金币</span>
    </div>

    <div class="auto-grid">
      <div v-for="c in cards" :key="c.def.id" class="card auto-card">
        <div class="auto-head">
          <span class="auto-icon">{{ c.def.icon }}</span>
          <div>
            <strong>{{ c.def.name }}</strong>
            <div class="dim auto-sub">{{ c.def.desc }}</div>
          </div>
        </div>

        <template v-if="!c.unlocked">
          <button class="btn btn-sm btn-primary" @click="unlock(c.def)">解锁（{{ c.def.cost.toLocaleString() }} 金币）</button>
        </template>

        <template v-else>
          <div class="dim auto-sub">✅ 已解锁</div>

          <!-- 自动出售：阈值设置 -->
          <div v-if="c.def.id === 'sell'" class="auto-config">
            <span class="dim">出售阈值（价值 ≤）</span>
            <input :value="sellThreshold" type="number" min="1" max="9999" class="auto-input" @change="setThreshold" />
            <span class="dim">金币 · 每种保留 1 件</span>
          </div>

          <!-- 自动续队：常驻配方 -->
          <div v-if="c.def.id === 'queue'" class="auto-config-col">
            <div v-for="s in standbyRows" :key="s.id" class="auto-config">
              <span class="dim auto-skill">{{ s.name }}</span>
              <select
                class="auto-select"
                :value="player.automation?.standby?.[s.id] ?? ''"
                @change="setStandby(s.id, $event.target.value)"
              >
                <option value="">（不设）</option>
                <option v-for="r in s.recipes" :key="r.id" :value="r.id">{{ r.name }}（Lv{{ r.reqLevel }}）</option>
              </select>
            </div>
          </div>

          <div v-if="c.def.id === 'claim'" class="dim auto-sub">地窖 / 采集队到期自动领取（产出照常入包）</div>
        </template>
      </div>
    </div>

    <div class="card" style="margin-top: 14px">
      <h3>🧩 已有自动化（免费，随设置/页面开关）</h3>
      <table class="target-table">
        <tbody>
          <tr v-for="f in FREE_AUTOMATIONS" :key="f.id">
            <td class="dim" style="width: 150px">{{ f.icon }} {{ f.name }}</td>
            <td>{{ f.desc }}<span class="dim">（{{ f.where }}）</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.auto-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.auto-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.auto-icon {
  font-size: 22px;
}
.auto-sub {
  font-size: 12px;
  line-height: 1.5;
}
.auto-config {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  flex-wrap: wrap;
}
.auto-config-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.auto-skill {
  width: 56px;
}
.auto-input {
  width: 84px;
  height: 30px;
  padding: 0 8px;
  font-size: 12px;
  text-align: center;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.auto-select {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
}
</style>
