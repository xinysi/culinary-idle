// 食灵物语（2026-09-10 新增）— 出战食灵按「羁绊等级」解锁心声片段，每段可领一次性奖励。
// 设计约束：不新增物品（奖励用既有物品）、不改动食灵数据（reqLevel/contract/effect 全部只读）；
// 片段文案按食灵的「阶级域」生成（采耕/烹制/饮藏/御对/超凡 五套模板，{name} 代入食灵名）。

/** 可解锁的羁绊等级（与 BOND_DAYS 的 2/6/12/20/30 天对应，取 2/3/4/5 级） */
export const SPIRIT_STORY_STAGES = [2, 3, 4, 5]

export const STAGE_INFO = {
  2: { key: 'first', name: '初见', reward: { gold: 500 } },
  3: { key: 'walk', name: '同行', reward: { gold: 1200, items: { mysterySpice: 1 } } },
  4: { key: 'bond', name: '羁绊', reward: { gold: 2500, items: { energyBiscuit: 1 } } },
  5: { key: 'pact', name: '契约', reward: { gold: 5000, items: { mysterySpice: 2 } } },
}

/** 五个阶级域的心声模板（{name} = 食灵名） */
export const DOMAIN_LINES = {
  采耕: {
    first: '「{name}」在你递出第一份契约食材时钻出来，捧着一片沾露的叶子绕你飞了一圈。',
    walk: '它学会了在你采摘时替你拨开草叶——虽然常把好果子也拨掉，但会红着脸捡回来。',
    bond: '田垄尽头的晚风里，它把攒下的种子一颗颗塞进你掌心：「这些……明年也一起种，好吗？」',
    pact: '它把名字的一半写进了你的契约：「从今往后，你的收成里有我的一份。」',
  },
  烹制: {
    first: '灶火跳动时，「{name}」从蒸汽里探出头，好奇地看你翻动锅铲。',
    walk: '它开始替你尝味道，虽然每次都被烫得直吐舌头，却总能指出差的那一撮盐。',
    bond: '深夜的厨房只剩你们两个。它守在锅边小声数着秒：「再等三息，火候正好。」',
    pact: '它把最得意的一道菜教给了你——那是它生前做给最重要的人吃的味道。',
  },
  饮藏: {
    first: '酒坛封泥裂开一线，「{name}」踮着脚从坛口探出，醉醺醺地朝你行礼。',
    walk: '它学会了分辨年份，趴在你肩上指点：「这坛再放三天，能多出一层桂花香。」',
    bond: '它把第一口新酒让给你，自己只舔了舔杯沿，然后笑得眼睛都弯了。',
    pact: '地窖最深处那坛无名之酒，它说那是它酿的，等一个肯陪它喝完的人。',
  },
  御对: {
    first: '灶台前的刀光里，「{name}」现身时带着一身不服输的劲儿。',
    walk: '它在你每次出手前抢先半步，替你看清对手的破绽——虽然常常抢过头。',
    bond: '输过的那场它记了很久，回来时把一张写着对手弱点的纸塞给你，一句话没说。',
    pact: '「我想站在你这边，一直站到最后一局。」——它说完这句，刀意忽然稳了。',
  },
  超凡: {
    first: '契约纹路亮起时，「{name}」在光里睁开眼，看了你很久，才慢慢点头。',
    walk: '它不太说话，只在你疲惫时把火调小一点，把水续上一点。',
    bond: '你发现它记得每一道你做过的菜——连失败的那几次，它都好好收着。',
    pact: '「凡人会走完一生，食灵会走完无数个一生。这无数个一生里，我只认你这一个灶。」',
  },
}

const DOMAINS = Object.keys(DOMAIN_LINES)

/** 由食灵名解析阶级域（名如「苹果精灵·采耕Ⅰ」）；无法解析时归「超凡」 */
export function domainOf(name) {
  for (const d of DOMAINS) if (String(name ?? '').includes(d)) return d
  return '超凡'
}

/** 某食灵在某羁绊等级的心声文案 */
export function storyLine(spirit, stage) {
  const info = STAGE_INFO[stage]
  if (!info) return ''
  const dom = domainOf(spirit?.name)
  return (DOMAIN_LINES[dom]?.[info.key] ?? '').replaceAll('{name}', spirit?.name ?? '')
}

/** 全部片段的展示顺序（等级升序） */
export const STAGE_ORDER = [...SPIRIT_STORY_STAGES]
