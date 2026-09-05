// 技能注册表 — 需求文档 §3：20 个技能，4 大类
// category: gathering(采集) / production(制作) / combat(对决) / support(辅助)
// 等级上限 100（§3），转生后可突破至 120（后续迭代）

export const SKILL_DEFS = {
  // ── 采集类（§3.1）──
  foraging: { id: 'foraging', name: '采摘', category: 'gathering', desc: '从植物上采集水果、蔬菜、坚果等食材' },
  fishing: { id: 'fishing', name: '垂钓', category: 'gathering', desc: '在不同水域钓取鱼类和海鲜' },
  hunting: { id: 'hunting', name: '狩猎', category: 'gathering', desc: '猎取野味和家禽，获得肉类食材' },
  excavation: { id: 'excavation', name: '挖掘', category: 'gathering', desc: '挖掘根茎类食材、食用菌类和矿物盐' },
  farming: { id: 'farming', name: '农耕', category: 'gathering', desc: '种植作物，定时收获' },

  // ── 制作类（§3.2）──
  cooking: { id: 'cooking', name: '烹饪', category: 'production', desc: '核心技能：将食材组合制作成料理' },
  baking: { id: 'baking', name: '烘焙', category: 'production', desc: '制作面包、糕点、饼干等烘焙食品' },
  preserving: { id: 'preserving', name: '腌制', category: 'production', desc: '制作腌菜、酱料、发酵食品' },
  brewing: { id: 'brewing', name: '调酒', category: 'production', desc: '酿造果汁、茶饮和酒类' },
  spiceMixing: { id: 'spiceMixing', name: '调料调配', category: 'production', desc: '调配复合调料和香料' },
  craftsmithing: { id: 'craftsmithing', name: '厨具锻造', category: 'production', desc: '打造厨具装备' },

  // ── 对决类（§3.3）──
  knife: { id: 'knife', name: '刀工', category: 'combat', desc: '近战风格：精准切割伤害' },
  heatControl: { id: 'heatControl', name: '火候掌控', category: 'combat', desc: '防御：减伤率与闪避率' },
  flavorArtistry: { id: 'flavorArtistry', name: '调味艺术', category: 'combat', desc: '魔法风格：调味冲击，消耗调味能量' },
  plating: { id: 'plating', name: '摆盘技巧', category: 'combat', desc: '远程风格：视觉冲击，消耗装饰食材' },
  tasteAcumen: { id: 'tasteAcumen', name: '品鉴力', category: 'combat', desc: '生命值：每级 +10 最大 生命值' },
  spiritSummoning: { id: 'spiritSummoning', name: '食灵召唤', category: 'combat', desc: '召唤食灵协助对决' },

  // ── 辅助类（§3.4）──
  gastronomy: { id: 'gastronomy', name: '美食知识', category: 'support', desc: '激活美食奥义提供被动加成（消耗品鉴点数）' },
  preservation: { id: 'preservation', name: '食材保鲜', category: 'support', desc: '制作保鲜剂和增益剂' },
  exploration: { id: 'exploration', name: '美食探索', category: 'support', desc: '探索美食秘境，偷师学艺' },
}

export const SKILL_CATEGORIES = [
  { id: 'gathering', name: '采集' },
  { id: 'production', name: '制作' },
  { id: 'combat', name: '对决' },
  { id: 'support', name: '辅助' },
]

// 技能图标（emoji）
const SKILL_ICONS = {
  foraging: '🌿', fishing: '🎣', hunting: '🏹', excavation: '⛏️', farming: '🌾',
  cooking: '🍳', baking: '🥖', preserving: '🫙', brewing: '🍷', spiceMixing: '🌶️', craftsmithing: '🔨',
  knife: '🔪', heatControl: '🔥', flavorArtistry: '✨', plating: '🍽️', tasteAcumen: '❤️', spiritSummoning: '👻',
  gastronomy: '📜', preservation: '❄️', exploration: '🕵️',
}
for (const [id, icon] of Object.entries(SKILL_ICONS)) {
  if (SKILL_DEFS[id]) SKILL_DEFS[id].icon = icon
}

export function getSkillDef(id) {
  return SKILL_DEFS[id] ?? null
}
