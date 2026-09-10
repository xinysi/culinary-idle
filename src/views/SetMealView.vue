<script setup>
// 套餐与定食（2026-09-10 新增）— 餐厅菜单的「成品侧搭配」：
// 菜单凑齐某套套餐要求的大类即自动生效（多套达标取加成最高的一套），提升餐厅小时收入与外卖单价。
// 纯读取层：只读菜单与既有料理的 category，无新增存档状态。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { SET_MEALS, SET_MEAL_TAKEOUT_RATIO, menuCategoryCount } from '../game/data/setMeals.js'
import { getItem } from '../game/data/items.js'

const player = usePlayerStore()
const ui = useUiStore()

const CAT_NAME = { 主食: '主食', 主菜: '主菜', 汤品: '汤品', 甜点: '甜点', baking: '烘焙' }

const rows = computed(() => player.setMealRows())
const state = computed(() => player.setMealState())
const menu = computed(() => (player.restaurant?.menu ?? []).filter((x) => x))
const cats = computed(() => menuCategoryCount(player.restaurant?.menu ?? []))
const slots = computed(() => player.restaurantSlots)
const hourly = computed(() => player.restaurantHourlyIncome)

// 当前菜单里的菜（按大类分组展示，让玩家看清自己凑了什么）
const menuDishes = computed(() =>
  menu.value.map((id) => {
    const it = getItem(id)
    return { id, name: it?.name ?? id, cat: it?.category ?? '—', catName: CAT_NAME[it?.category] ?? it?.category ?? '—' }
  })
)

// 差一道就齐的套餐（给「最接近的目标」提示）
const nearest = computed(() => {
  const notOk = rows.value.filter((r) => !r.ok)
  if (!notOk.length) return null
  notOk.sort((a, b) => a.missing.length - b.missing.length || b.bonus - a.bonus)
  return notOk[0]
})

const bonus = computed(() => state.value.bonus)
// 套餐带来的时收增量（对比无套餐）
const gain = computed(() => (bonus.value > 0 ? Math.round((hourly.value * bonus.value) / (100 + bonus.value)) : 0))

function catChipClass(cat) {
  return 'sm-cat sm-cat-' + (CAT_NAME[cat] ?? cat)
}
function goRestaurant() {
  ui.setView('restaurant')
}
function goTakeout() {
  ui.setView('takeout')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🍱 套餐与定食</h2>
        <p class="dim">
          菜单不只是「摆几道好菜」——把不同<b>大类</b>的料理组合起来就能成<b>套餐</b>：
          菜单里凑齐某套要求的大类即<b>自动生效</b>（不用手动领取），多套达标时取<b>加成最高</b>的一套。
          套餐提升<b>餐厅小时收入</b>，外卖单价按 <b>{{ Math.round(SET_MEAL_TAKEOUT_RATIO * 100) }}%</b> 折算同样受益。
        </p>
      </div>
    </header>

    <!-- 当前生效 -->
    <div class="card sm-hero" :class="{ none: !state.meal }">
      <div v-if="state.meal" class="sm-hero-main">
        <span class="sm-hero-icon">{{ state.meal.icon }}</span>
        <div>
          <div class="sm-hero-name">
            当前套餐：<strong>{{ state.meal.name }}</strong>
            <span class="sm-bonus mono">+{{ state.meal.bonus }}%</span>
          </div>
          <div class="dim sm-sub">{{ state.meal.desc }}</div>
          <div class="dim sm-sub">
            需要：<span v-for="c in state.meal.need" :key="c" :class="catChipClass(c)">{{ CAT_NAME[c] ?? c }}</span>
          </div>
        </div>
      </div>
      <div v-else class="sm-hero-main">
        <span class="sm-hero-icon">🍽</span>
        <div>
          <div class="sm-hero-name">当前没有生效的套餐</div>
          <div class="dim sm-sub">去餐厅把菜单换成「有饭有菜」的组合试试——两格菜单凑齐「主食 + 主菜」就能吃到家常套餐 +8%。</div>
        </div>
      </div>
      <div class="sm-hero-side">
        <div class="dim sm-sub">餐厅时收 <b class="mono">{{ Math.round(hourly).toLocaleString() }}</b> 金币/时</div>
        <div v-if="bonus > 0" class="dim sm-sub">其中套餐贡献 <b class="mono sm-gain">+{{ gain.toLocaleString() }}</b> 金币/时</div>
        <div v-if="nearest" class="dim sm-sub">
          最接近的下一套：{{ nearest.icon }} {{ nearest.name }}（还缺
          <span v-for="c in nearest.missing" :key="c" :class="catChipClass(c)">{{ CAT_NAME[c] ?? c }}</span>）
        </div>
      </div>
    </div>

    <!-- 菜单现状 -->
    <div class="card sm-menu-card">
      <div class="sm-h">
        🍽 当前菜单（{{ menu.length }} / {{ slots }} 格）
        <button class="btn btn-sm" style="margin-left: 8px" @click="goRestaurant">去餐厅改菜单</button>
      </div>
      <div v-if="!menu.length" class="dim">菜单是空的——先在餐厅页把背包里的料理摆上菜单。</div>
      <template v-else>
        <div class="sm-menu-list">
          <div v-for="d in menuDishes" :key="d.id" class="sm-dish">
            <span class="sm-dish-name">{{ d.name }}</span>
            <span :class="catChipClass(d.cat)">{{ d.catName }}</span>
          </div>
        </div>
        <div class="sm-cats">
          <span class="dim">菜单大类统计：</span>
          <span v-for="(n, c) in cats" :key="c" :class="catChipClass(c)">{{ CAT_NAME[c] ?? c }} ×{{ n }}</span>
          <span v-if="!Object.keys(cats).length" class="dim">（菜单里没有料理）</span>
        </div>
      </template>
      <p class="dim sm-note">
        提示：同一道菜只占一格、也只算一次；套餐看的是<b>大类的有无</b>，多放同类的菜不会额外加成——把格子留给缺的那一类更划算。
      </p>
    </div>

    <!-- 全部套餐 -->
    <div class="sm-grid">
      <div v-for="r in rows" :key="r.id" class="card sm-card" :class="{ ok: r.ok, active: r.active }">
        <div class="sm-card-head">
          <span class="sm-card-icon">{{ r.icon }}</span>
          <div>
            <strong>{{ r.name }}</strong>
            <div class="dim sm-sub">{{ r.desc }}</div>
          </div>
          <span v-if="r.active" class="badge badge-on">生效中</span>
          <span v-else-if="r.ok" class="badge">已达标</span>
        </div>

        <div class="sm-need">
          <span class="dim">需要</span>
          <span v-for="c in r.need" :key="c" :class="catChipClass(c)" :style="cats[c] ? '' : 'opacity:.45'">
            {{ CAT_NAME[c] ?? c }}
          </span>
        </div>
        <div class="sm-row">
          <span class="dim">加成</span>
          <span class="mono sm-bonus">+{{ r.bonus }}% 餐厅时收</span>
        </div>
        <div class="sm-row">
          <span class="dim">外卖</span>
          <span class="mono">+{{ Math.round(r.bonus * SET_MEAL_TAKEOUT_RATIO * 10) / 10 }}% 单价</span>
        </div>
        <div v-if="!r.ok" class="dim sm-sub">还缺：<span v-for="c in r.missing" :key="c" :class="catChipClass(c)">{{ CAT_NAME[c] ?? c }}</span></div>
        <div v-else class="dim sm-sub">✅ 菜单已满足这套</div>
      </div>
    </div>

    <div class="card status-line">
      <span class="dim">套餐影响外卖单价，去</span>
      <button class="btn btn-sm" @click="goTakeout">🚚 外卖业务</button>
      <span class="dim">看看；餐厅页可调整菜单与装饰。</span>
    </div>
  </div>
</template>

<style scoped>
.sm-h {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.sm-hero {
  margin-top: 12px;
  padding: 14px 16px;
  display: flex;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
}
.sm-hero.none {
  opacity: 0.95;
}
.sm-hero-main {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sm-hero-icon {
  font-size: 32px;
}
.sm-hero-name {
  font-size: 15px;
  margin-bottom: 4px;
}
.sm-hero-side {
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sm-bonus {
  color: var(--good, #57a861);
}
.sm-gain {
  color: var(--good, #57a861);
}
.sm-sub {
  font-size: 12px;
  line-height: 1.6;
}
.sm-menu-card {
  margin-top: 12px;
}
.sm-menu-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0;
}
.sm-dish {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.sm-dish-name {
  font-weight: 600;
}
.sm-cats {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12px;
}
.sm-cat {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--border);
  margin-right: 4px;
}
/* 大类配色走主题变量（亮/深各自成套，深色守卫可校验） */
.sm-cat-主食 { color: var(--gold); border-color: var(--gold); }
.sm-cat-主菜 { color: var(--bad); border-color: var(--bad); }
.sm-cat-汤品 { color: var(--info); border-color: var(--info); }
.sm-cat-甜点 { color: var(--warn); border-color: var(--warn); }
.sm-cat-烘焙 { color: var(--good); border-color: var(--good); }
.sm-note {
  font-size: 12px;
  margin-top: 10px;
  line-height: 1.6;
}
.sm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.sm-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  opacity: 0.82;
}
.sm-card.ok {
  opacity: 1;
  border-style: solid;
}
.sm-card.active {
  border-color: var(--accent, #d95a38);
  box-shadow: 0 0 12px var(--gold-glow, rgba(232, 180, 95, 0.12));
}
.sm-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sm-card-icon {
  font-size: 22px;
}
.sm-need {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  font-size: 12px;
}
.sm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}
</style>
