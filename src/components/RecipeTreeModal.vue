<script setup>
// 配方导航树弹窗（2026-09-06）：成品 → 展开完整材料链（深度 ≤4，防环），材料来源展示 + 跳转制作
import { computed } from 'vue'
import { getItem } from '../game/data/items.js'
import { getAllSkillInstances } from '../game/skills/registry.js'
import RecipeTreeNode from './RecipeTreeNode.vue'

const props = defineProps({
  recipe: { type: Object, required: true }, // 源头配方（含 skillId）
  player: { type: Object, required: true },
})
const emit = defineEmits(['close'])

let RECIPE_INDEX = null
function recipeIndex() {
  if (!RECIPE_INDEX) {
    RECIPE_INDEX = new Map()
    for (const inst of getAllSkillInstances()) {
      if (inst.type !== 'production') continue
      for (const r of inst.recipes) {
        if (!RECIPE_INDEX.has(r.output.itemId)) RECIPE_INDEX.set(r.output.itemId, { recipe: r, skillId: inst.id })
      }
    }
  }
  return RECIPE_INDEX
}

function buildTree(itemId, qty, depth, seen) {
  const entry = recipeIndex().get(itemId)
  const node = { itemId, qty, depth, recipe: null, children: [] }
  if (depth > 4 || seen.has(itemId) || !entry) return node
  node.recipe = { name: entry.recipe.name, skillId: entry.skillId, recipeId: entry.recipe.id, reqLevel: entry.recipe.reqLevel, isSelf: depth === 0 }
  const seen2 = new Set(seen)
  seen2.add(itemId)
  for (const [mid, mqty] of Object.entries(entry.recipe.ingredients)) {
    node.children.push(buildTree(mid, mqty * qty, depth + 1, seen2))
  }
  return node
}

const root = computed(() => {
  if (!props.recipe) return null
  return buildTree(props.recipe.output.itemId, 1, 0, new Set())
})

function jump(nav) {
  emit('jump', nav)
}
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal tree-modal" v-if="root">
      <header class="modal-head">
        <h3>🌳 配方树 · {{ recipe.name }}</h3>
        <button class="btn btn-sm" @click="$emit('close')">✕</button>
      </header>
      <p class="dim" style="margin: 4px 0 10px">成品「{{ getItem(recipe.output.itemId)?.name }}」的材料链（深度 ≤4；点击「去做」跳转对应制作技能）</p>
      <div class="tree-body">
        <ul class="rt-list">
          <RecipeTreeNode :node="root" :player="player" @jump="jump" />
        </ul>
      </div>
    </div>
  </div>
</template>
