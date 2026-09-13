#!/usr/bin/env bash
cd "D:/plays/lmew"
git add -A
git commit -q -F - <<'MSG'
v2.0.0：新增主轴系统「厨神之路 · 轮回天赋树」（功能页 49→50）

口径：不动任何铁律固定数据；唯一新存档字段 daoUnlocked: string[]（懒建、旧档零迁移）。

① 为什么是它：转生此前只给 +20%/层经验与 120 级上限，转生后无事可做是全局最大的结构性空白；
   天赋树把「转生」变成一条有节点的长线成长轴。
② 设计与平衡：货币「轮回印记」完全派生（可用 = stats.prestiges − 已投入，不新增货币字段）；
   四路（采撷/火工/厨武/经营）× 三层 × 各 3 节点 = 36 节点；层数门槛「本路已解锁 ≥2 / ≥5」；
   单路 18 枚、四路共 72 枚 ≈ 72 次转生（毕业级目标，单路中期可见）。
③ 效果全部挂既有聚合点（11 处接线，均为功能层乘区）：采集产量 yieldExtraChance、按类别/全技能经验
   Skill.addXp、对决伤害与暴击与最大品鉴值 Combat.playerStats/playerAttack、餐厅收入、订单赏金、
   分店收入、gainGold 金币、settleOffline 离线时长上限、采摘/挖掘种子掉落概率（在线与离线同口径）。
④ 页面 DaoView.vue：四路节点树（已解锁绿 ✓ / 可解锁橙带成本 / 未达层门槛虚线淡显 + 层门槛与单路进度），
   对照表沿用 FoldCard 折叠在页头下方（收起 45px）。
⑤ 同步：四处登记（VIEW_KEYS / App.vue / 左栏「成长与信仰」磁贴带印记角标 / e2e-dark VIEWS）、
   攻略关键词与总览条目、成就 +2（191 项 / 93 称号：初入道途·问道者、四道同修·四道同修）、
   stats.daoUnlockedTotal、README 与设计文档与 AGENTS（含 11 处接线点清单与 v2.0 路线图）。
⑥ 实测：12 次转生 → 12 枚印记；tier1 各 −1、tier2 −2；直接点第 3 层被门槛拒绝
   （「需本路已解锁 5 个节点（当前 3）」）；效果真实累加（yieldPct 3→8、采集经验 +4%、种子概率 +2%）。
⑦ 回归：vite build + 11 套 CI + 14 项 e2e 全绿（深色体检扫描量 33645 → 35709 元素，新页已纳入）。
⑧ 2.0 路线图剩余项（下一步）：BGM/音效扩充、皮肤系统；备选：连锁餐厅帝国、挂机编排 2.0、PWA 离线。
MSG
echo "--- push ---"
git -c http.proxy= -c https.proxy= push origin main 2>&1 | tail -2
MSG
