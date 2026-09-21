// 等级「时代」分段（2026-09-19）
//
// 起因：用户观察参照作 Rocky Idle「每个技能从 1 级到满级物品很少，但能撑起整段」，问本作能不能也这样、
// 要不要提高等级上限。实测两边（`D:\plays\steams\...\Rocky Idle` 的 `index-*.js` 里逐条抠出 `skillReq`/`time`/`xp`）：
//
//   | | Rocky Idle | 本作 |
//   | --- | --- | --- |
//   | 每技能物品数（采集类） | **9~11 件** | 20~142 件 |
//   | 平均每件跨等级 | **11~14 级** | 1.7~5.0 级 |
//   | 采集内容最深 | Lv105~115（上限 126，尾巴 11~21 级） | Lv99~100（上限 100 / 转生 120，尾巴 20 级） |
//
// 两条关键结论（决定了「不改数值、不改上限」）：
//   ① **梯级本身没问题**：`scripts/sim/target_choice.mjs` 实测同精通天花板 ×8.5~×26.9、
//      「跟等级换」比「蹲最低级」多拿 ×4.0~×9.2（制作侧更陡，×19~×48）。所以「换更高级资源」这条已经成立。
//   ② **内容↔上限的「尾巴比例」已经和 Rocky 一致**：本作 20/120 = 17%，Rocky 11~21/126 = 9~17%。
//      再抬上限只会让尾巴变长到 26/126 = 21% 且**零新内容**（`Lv100 之后：采集目标 99 / 配方 100 / 探索 99 /
//      物品 tier 最大 10，全为 0`），比例反而更差。
//
// 真正缺的是**感知**：本作的目标列表**同时承担了两个职责** ——
//   纵向梯级（Rocky 的采集资源干的）+ 横向配方原料库（Rocky 另有体系承担）。
// 证据：采摘 142 个目标里只有 **59 个不同等级**，同档最多挤了 **15 件**（那些是同档不同食材，不是进度台阶）。
// ⇒ 列表应该按**纵向**读。按 ERA_SPAN 级切一档「时代」、每档用「该档最高级产出」命名，
//   读起来就是 Rocky 那 ~10 档资源结构（它的档数 9~11，本模块的段数同样 ≤ 11），而**数值一行不用改**。
//
// ⚠️ 这是**纯展示层**分组：不改任何 target / recipe / 物品数据，不参与任何数值计算，也不进存档。
// ⚠️ 采集与制作共用这一个实现（两页各写一份的话，改粒度时会只改一处、另一处照旧）。

/** 一个「时代」覆盖的等级跨度。取 10 是为了对齐 Rocky 的「每件资源扛 11~14 级、每技能约 10 档」。 */
export const ERA_SPAN = 10

/** 段标题（不含时代名）——名字由调用方按自己的口径拼（采集显示产出、「制作」显示配方名） */
export function eraLabel(from, to) {
  return `Lv ${from}-${to}`
}

/**
 * 由**单个等级**反查它属于哪个时代段（返回与 `levelEras` 里一致的 label）。
 * 🔴 存在的理由：视图侧有「跳到某个配方/目标所在的段」这类**反向**需求（配方树的「去做」），
 *   它必须与正向分段用**同一个**算法 —— 各写一份的话，改粒度时会只改一处，
 *   另一处算出旧标签 ⇒ `toggleSection(旧标签)` 打不开任何一段、跳转静默失效（本轮就差点这样）。
 */
export function eraLabelOf(level) {
  const lv = Number(level)
  if (!Number.isFinite(lv)) return ''
  const from = Math.floor((lv - 1) / ERA_SPAN) * ERA_SPAN + 1
  return eraLabel(from, from + ERA_SPAN - 1)
}

/**
 * 把「按等级排序的物品/目标/配方」按 ERA_SPAN 级切成时代。
 * @param {Array} items 目标或配方列表（每项要有等级字段）
 * @param {(it:any)=>number} levelOf 取等级
 * @param {(it:any)=>string} idOf 取标识（用于选时代名）
 * @returns {Array<{from:number,to:number,label:string,topId:string,list:Array}>}
 *          按等级升序；空输入返回空数组（不抛错，视图可安全遍历）
 */
export function levelEras(items, levelOf, idOf) {
  const list = Array.isArray(items) ? items : []
  if (!list.length) return []
  const map = new Map()
  for (const it of list) {
    const lv = Number(levelOf(it))
    if (!Number.isFinite(lv)) continue
    const key = Math.floor((lv - 1) / ERA_SPAN) * ERA_SPAN + 1
    if (!map.has(key)) map.set(key, { from: key, to: key + ERA_SPAN - 1, list: [] })
    map.get(key).list.push(it)
  }
  return [...map.values()]
    .sort((a, b) => a.from - b.from)
    .map((sec) => {
      // 时代名 = 该档**最高级**的那件（= 你在这一档里能解锁到的最新资源）。
      // 同等级多件时取先出现的那个（调用方传进来的顺序稳定 ⇒ 分段结果确定、守卫可复现）。
      let top = sec.list[0]
      for (const it of sec.list) if (Number(levelOf(it)) > Number(levelOf(top))) top = it
      return { ...sec, label: eraLabel(sec.from, sec.to), topId: String(idOf(top)), topLevel: Number(levelOf(top)) }
    })
}

/** 时代进度文案：已满级的卡片数 / 总卡片数（横向收集目标；`levelOfCard` 由调用方给，如精通等级） */
export function eraProgress(list, cardLevelOf) {
  const total = list.length
  let done = 0
  for (const it of list) if (Number(cardLevelOf(it)) >= 100) done++
  return { done, total }
}

/** 当前等级落在哪一段（用于「默认只展开当前段」）。
 *  ⚠️ 等级超出最后一段（如 120 级而末段是 111-120 之后）时回退到**最后一段**，
 *     而不是返回 null —— 否则高等级玩家会看到「全部折叠」、反倒找不到自己的段。 */
export function currentEraLabel(sections, level) {
  const secs = Array.isArray(sections) ? sections : []
  if (!secs.length) return null
  const lv = Number(level)
  if (Number.isFinite(lv)) {
    const hit = secs.find((s) => lv >= s.from && lv <= s.to)
    if (hit) return hit.label
    if (lv < secs[0].from) return secs[0].label
  }
  return secs[secs.length - 1].label
}
