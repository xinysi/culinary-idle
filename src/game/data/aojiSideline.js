// 副业线奥义（2026-09-27 用户⑧「美食奥义是否需要扩充」→ 答「按副业线补」）
//
// 为什么另开一个模块、而不是往 `expansion1.js` / `expansion2.js` 里加：
//   那两份是**生成器产物且已上硬门禁**（`gen_drift_audit` 的 `KNOWN_DRIFT`，重跑会改写冻结层）。
//   新增内容的当代落点是**手写扩展模块**（同 `sidelineWorks.js` / `timbers.js` 那一代），
//   再由 `aojis.js` 底部 push 进主数组 ⇒ 冻结字节一个不动、消费方也看不到多一层。
//
// 🔴 effect 只能用**引擎真读**的键。新增的 `sideline` 键是本次一并接线的第 9 个键：
//   `{ sideline: { [轴 id]: 数值 } }` —— 轴 id 取自 `sidelineWorks.js` 的 `SIDELINE_AXES`，
//   引擎出口是 `player.sidelineEffectTotal(axis)`（与金工作品/量产阶梯**同一条轴**，相加）。
//   数值量级对齐既有来源：单件作品 perItem 1.5~2（%），阶梯每档 0.8~2 ⇒ 一条奥义给 4~6% 属于
//   「抵得上 3 件作品」，但**要按秒付品鉴点**（这是它与作品的本质区别）。
// ⚠️ 分类是新开的 `副业`：`system_test` 的 C61 断言「category ∈ {攻击,防御} ⟺ 有战斗效果字段」，
//   本批 10 条**全部只有 `sideline`**（非战斗）⇒ 落在 `副业` 分类下不会触发那条断言。
export const AOJI_SIDELINE = [
  { id: 'aojiSideline_woodcraft', name: '木器之魂', category: '副业', desc: '木工作品带来的装潢加成 +6%', costPerSec: 0.4, effect: { sideline: { decorPct: 6 } } },
  { id: 'aojiSideline_kiln', name: '窑火长明', category: '副业', desc: '地窖单槽价值上限 +6,000 金币', costPerSec: 0.4, effect: { sideline: { cellarValue: 6000 } } },
  { id: 'aojiSideline_loom', name: '机杼不停', category: '副业', desc: '餐厅小费 +5%', costPerSec: 0.4, effect: { sideline: { tipPct: 5 } } },
  { id: 'aojiSideline_needle', name: '银针细绣', category: '副业', desc: '米其林招牌分 +50', costPerSec: 0.5, effect: { sideline: { michelinScore: 50 } } },
  { id: 'aojiSideline_candle', name: '烛影摇红', category: '副业', desc: '夜市狂潮倍率 +0.06', costPerSec: 0.5, effect: { sideline: { nightMult: 0.06 } } },
  { id: 'aojiSideline_arrow', name: '箭无虚发', category: '副业', desc: '狩猎省箭 +5%', costPerSec: 0.5, effect: { sideline: { huntSavePct: 5 } } },
  { id: 'aojiSideline_net', name: '网罗千鳞', category: '副业', desc: '稀有鱼概率 +0.06%', costPerSec: 0.5, effect: { sideline: { rareFishPP: 0.06 } } },
  { id: 'aojiSideline_incense', name: '香引客来', category: '副业', desc: '食客订单到访提速 +4%', costPerSec: 0.6, effect: { sideline: { orderSpeedPct: 4 } } },
  { id: 'aojiSideline_festive', name: '岁礼盈仓', category: '副业', desc: '节庆加成放大 +4%', costPerSec: 0.6, effect: { sideline: { festivalPct: 4 } } },
  { id: 'aojiSideline_jade', name: '玉润金声', category: '副业', desc: '宝石镶嵌效果 +5%', costPerSec: 0.6, effect: { sideline: { gemPct: 5 } } },
]
