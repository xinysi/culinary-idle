# -*- coding: utf-8 -*-
"""对决敌人「大尺寸角色」提示词生成器（2026-09-20）

为什么要有这个脚本：区域模板只能保证「同区风格一致」，但 22 个敌人共用一段描述会**同质化**
（用户反馈：「外形穿着描述同质化严重」「每个敌人的描述不够详细」）。这里做两件事：
  1. `ROLE`：**逐敌手写**的英文「身份 + 道具」短语（248 条，与 game/data/enemyNames.js 的名字一一对应）；
  2. `VARY`：按稳定哈希给每个敌人分配**体型 / 年龄 / 头饰 / 服装 / 主色 / 神情 / 特征**，
     七个维度各自独立取模 ⇒ 相邻敌人不会撞脸，且同一名字每次生成结果一致（可复现）。

产出（不写进 src/，只是给美术的交付物）：
  · 敌绘提示词.xlsx（保留基础提示词/负面/名字怎么用）+ 新增两张逐敌表
  · 敌绘描述.md（同上内容的纯文本版，Excel 被占用时也能看）
"""
import io, json, os, re, sys
from hashlib import md5

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── 基础提示词（2026-09-20 加了两处：明确「画面里只能有一个角色」）─────────────────
BASE = ("single game character sprite, exactly ONE character in the whole image, {desc}, "
        "standing idle pose, front 3/4 view facing slightly to the left, "
        "full body fully inside the frame with clear empty margin, nothing touching or crossing the edges, "
        "centered, flat pure #FFFFFF background, clean silhouette, "
        "pixel art drawn on a coarse visible grid (64x64 logical pixels), each pixel a flat solid square, integer-scaled up, "
        "no dithering, hard sharp pixel edges, no anti-aliasing, limited color palette, retro 16-bit RPG style, "
        "single light source from upper-left, cel shading with 2-3 tones per material, subtle highlight, "
        "plain simple background, isolated asset, no text")
NEG = ("two characters, multiple characters, crowd, crowd of chefs, companion, sidekick, pet, animal companion, "
       "duplicate figure, clone, mirrored copy, foreground character, background character, extra person, extra head, "
       "multiple poses, turnaround, character sheet, reference sheet, front back side views, sprite sheet, grid lines, "
       "cropped, cut off at edge, cut off feet, cropped head, extra limbs, extra fingers, fused fingers, deformed, "
       "isometric, 45-degree angle, perspective, 3D render, realistic, photo, photography, "
       "drop shadow, cast shadow, reflection, ground plane, floor, vignette, gradient background, off-white background, "
       "paper texture, noise, speckles, motion lines, speed lines, glow, bloom, halo, "
       "blurry, soft edge, anti-aliasing, text, label, logo, signature, watermark, border, frame, messy pixels")
BOSS_BLOCK = ("boss scale, dramatic towering pose, oversized signature prop, heavy silhouette with a strong outline, "
              "ornate uniform with gold trim, dramatic rim light")

# ── 反同质化的七个维度（每维取值都不同，确保相邻敌人不一样）────────────────────
BUILD = ['slight wiry build', 'stocky heavy build', 'tall lanky frame', 'short and round body',
         'broad-shouldered and muscular', 'lean and quick-footed', 'plump and sturdy', 'tall and stiff-backed',
         'small and nimble', 'burly with a barrel chest', 'thin and bony', 'medium height, athletic']
AGE = ['a teenager', 'a young adult in the early twenties', 'a man in his late twenties', 'a middle-aged veteran',
       'a grey-haired elder in the sixties', 'a fresh-faced youth', 'a woman in her thirties', 'a weathered old-timer']
HEAD = ['a white cloth headband', 'a tall pleated chef toque', 'a flat straw hat', 'a bandana tied low on the forehead',
        'a hairnet over short cropped hair', 'a flat work cap', 'a towel wrapped around the head',
        'a hair bun held with chopsticks', 'a shaved head', 'a long ponytail tied back', 'messy curly hair',
        'a side-parted short haircut', 'a heavy fringe over the eyes', 'a topknot with a wooden pin', 'no headwear, bald crown']
GARMENT = ['a crisp double-breasted chef jacket', 'an apron over a rolled-sleeve shirt', 'a navy happi coat',
           'a lab-style chef coat with a chest badge', 'overalls with a waist apron', 'a vest over a stained work shirt',
           'a long robe tucked behind an apron', 'a sporty track jacket with a number bib', 'a wide-sleeved traditional jacket',
           'a torn short-sleeve shirt with a rope belt', 'a knitted cardigan over a stained apron',
           'a sleeveless apron over a tank top', 'a formal white coat with rolled cuffs', 'a layered cloak over work clothes']
EXPR = ['a grumpy scowl', 'a cheerful open grin', 'a focused calm stare', 'a smug smirk',
        'tired half-closed eyes', 'a fierce glare', 'a neutral deadpan face', 'a nervous tight smile',
        'a confident smile with a raised chin', 'an angry frown with gritted teeth', 'a sleepy relaxed look',
        'a wary narrowed gaze']
FEAT = ['flour smudges on one cheek', 'a short stubbly beard', 'thin rimless glasses', 'a spray of freckles',
        'a small scar across one eyebrow', 'a beauty mark under one eye', 'bushy joined eyebrows', 'a single pierced ear',
        'a wooden toothpick at the corner of the mouth', 'a sweatband and dripping sweat', 'a chipped front tooth',
        'burn marks on the forearms', 'a bandaged wrist', 'a grease smear on the nose', 'a mole on the jaw',
        'a braided beard', 'a small tattoo on the neck', 'band-aids on two fingers']
# 每个区域一组主色（同区不同色调，避免整批一个颜色）
ACCENTS = {
    'newbieKitchen': ['cream and warm beige', 'soft sage green', 'faded denim blue', 'warm oatmeal'],
    'streetFood': ['charcoal smoke grey and chili red', 'street-light amber', 'oil-stained brown', 'neon sign pink'],
    'chineseRestaurant': ['crimson and gold', 'deep jade green', 'ink black with red trim', 'porcelain blue and white'],
    'westernRestaurant': ['ivory white and burgundy', 'slate grey and copper', 'deep navy with silver buttons', 'olive and brass'],
    'sushiShop': ['indigo and off-white', 'rice paper beige', 'seaweed dark green', 'salmon orange and charcoal'],
    'dessertWorkshop': ['strawberry pink and cream', 'mint and white chocolate', 'caramel and pastel yellow', 'blueberry violet'],
    'culinaryAcademy': ['chalk-white and navy', 'lecture-hall grey and teal', 'tweed brown', 'sterile mint green'],
    'undergroundKitchen': ['tar black and blood red', 'rust brown and sickly green', 'dim lantern amber', 'bruise purple'],
    'gourmetArena': ['arena gold and white', 'confetti red and blue', 'championship silver', 'spotlight yellow'],
    'abyssKitchen': ['ashen grey and ember orange', 'void violet and bone white', 'deep abyssal teal', 'charcoal with glowing cracks'],
    'boss': ['royal gold and deep crimson', 'midnight blue and gold', 'bone white and royal purple', 'black iron with molten gold'],
}
# 首领不许「小个子/瘦弱」——首领要有压迫感（用户口径：大尺寸角色）
BOSS_BUILD = ['towering heavy build', 'massive broad-shouldered frame', 'hulking and imposing',
              'tall with a dramatic presence', 'wide and immovable stance', 'powerfully built with thick arms']
BOSS_EXPR = ['a commanding glare', 'a cold unreadable stare', 'a theatrical confident smirk',
             'a furious burning gaze', 'a calm, terrifying stillness', 'a triumphant wide grin']
BOSS_BUILD_F = ['tall and regal with a dramatic presence', 'elegant but imposing frame',
               'slim and tall with an imperious stance', 'poised and statuesque, unshakeable']
BOSS_TRAIT = ['a glowing emblem on the chest', 'a cracked porcelain mask pushed to the side',
              'gold trim curling like smoke', 'runes glowing faintly on the apron',
              'a flowing cape of dark fabric', 'a floating ring of small tools behind the shoulders']

# ── 逐敌「身份 + 道具」（与 enemyNames.js 的名字一一对应；键＝中文名）──────────────
ROLE = {}
def R(region, pairs):
    for name, role in pairs:
        ROLE[name] = (region, role)

R('newbieKitchen', [
    ('灶台学徒', 'a kitchen apprentice scrubbing a wok, soap suds up to the elbows'),
    ('削皮小工', 'a peeler hand beside a mountain of potato skins, peeler in fist'),
    ('淘米丫头', 'a girl apprentice rinsing rice in a wooden tub, sleeves rolled high'),
    ('择菜阿婆', 'an old woman sorting leafy greens into a woven basket'),
    ('打蛋快手', 'a nimble egg-breaker with a bowl of cracked eggs and flying shells'),
    ('切葱童子', 'a young boy chopping spring onions with tears in his eyes'),
    ('烧火小厮', 'a fire-tending boy with a bellows and glowing embers at his feet'),
    ('擀面新人', 'a rookie pressing dough with a long rolling pin, flour to the elbows'),
    ('挑水伙计', 'a water carrier with a shoulder pole and two sloshing buckets'),
    ('油锅新手', 'a nervous novice leaning away from a bubbling oil wok'),
    ('洗锅小工', 'a scullery hand scrubbing a teetering stack of pans'),
    ('米案学徒', 'a rice-station apprentice fluffing steamed rice with a paddle'),
    ('面点小徒', 'a young dough apprentice dusted head to toe in flour'),
    ('蒸笼看火', 'a steamer watcher lifting a bamboo lid with both hands'),
    ('炒勺青工', 'a young wok hand tossing a pan with a burst of flame'),
    ('案板快手', 'a chopping-board speedster with a blurred cleaver'),
    ('汤勺新丁', 'a stock-pot rookie ladling broth into a row of bowls'),
    ('灶下看柴', 'a firewood keeper crouching by the stove mouth, ash on the knees'),
    ('后厨杂役长', 'a head porter with a crate on one shoulder and keys on the belt'),
    ('灶台掌勺', 'the stove master commanding the big wok, wooden spoon raised'),
    ('大锅总管', 'a head cook with a community wok and a ladle like a paddle'),
    ('厨房当家', 'the kitchen matriarch with a cleaver and a ring of keys'),
])
R('streetFood', [
    ('炭火串童', 'a kid fanning charcoal skewers over a makeshift grill'),
    ('糖葫芦小贩', 'a candied-hawthorn vendor with a straw pole of red skewers'),
    ('铁板阿婆', 'an old granny slapping batter onto a hot iron plate'),
    ('煎饼快手', 'a pancake master spreading a crepe with a wooden scraper'),
    ('麻辣烫西施', 'a young woman tending a bubbling skewer pot, steam around her face'),
    ('烤薯老伯', 'an old man guarding a drum of roasted sweet potatoes'),
    ('炸串少侠', 'a young fryer lifting a wire basket of golden skewers'),
    ('豆浆娘子', 'a woman pouring hot soy milk from a tall kettle'),
    ('油条快手', 'a dough-stick fryer stretching two long strands with both hands'),
    ('卤味小哥', 'a braised-food seller lifting a soy-dark duck from a bubbling pot'),
    ('臭豆腐匠', 'a stinky-tofu craftsman beside a hissing fryer and stacked jars'),
    ('凉皮师傅', 'a cold-noodle cutter shaving a wide sheet into neat strips'),
    ('火烧大婶', 'an auntie pulling flatbreads from the mouth of a clay oven'),
    ('烧烤浪人', 'a wandering grill ronin with a long skewer over one shoulder'),
    ('串串香客', 'a skewer-pot regular holding a fistful of cooked sticks'),
    ('炒粉车夫', 'a pushcart cook swinging a wide wok of rice noodles'),
    ('煎包拳师', 'a pan-fried bun boxer slamming a lid over a big iron pan'),
    ('铁板老炮', 'a veteran teppan cook flipping with two spatulas at once'),
    ('夜宵掌灯人', 'a night-stall keeper holding a lantern beside a sizzling pan'),
    ('巷口烤王', 'the alley grill king at a smoking rack with a heavy cleaver'),
    ('夜市巡场', 'a night-market marshal with a whistle and a tasting plate'),
    ('小吃街之王', 'the street-food king with a skewer crown and a whole roast on a spit'),
])
R('chineseRestaurant', [
    ('红案小徒', 'a red-board apprentice cutting raw meat on a round wooden block'),
    ('白案新人', 'a white-board rookie kneading dough on a marble slab'),
    ('剁椒快手', 'a chili chopper with a double cleaver and a basin of red chilies'),
    ('爆炒青工', 'a young stir-fryer with a flame roaring around the wok'),
    ('高汤看火', 'a stock watcher skimming a giant pot of milky white broth'),
    ('炒锅学徒', 'a wok apprentice tossing fried rice under a flaming arc'),
    ('颠勺新手', 'a novice flipper spinning a wok balanced on one fist'),
    ('蒸笼师傅', 'a steamer chef stacking bamboo tiers above his head'),
    ('焦溜快手', 'a quick-hand cook glazing crispy slices in a dark glossy sauce'),
    ('川味小火', 'a Sichuan junior with a wok full of dried chilies and peppercorns'),
    ('粤菜新秀', 'a Cantonese rising star presenting a whole steamed fish'),
    ('鲁菜传人', 'a Shandong inheritor braising a heavy clay pot of pork'),
    ('淮扬刀客', 'a Huaiyang knife artist carving a pattern into a radish'),
    ('爆炒名师', 'a famed stir-fry master with a dragon-shaped flame'),
    ('火候掌勺', 'the heat master holding a wok above precisely judged fire'),
    ('八珍配菜师', 'a plater arranging eight rare ingredients on a lacquer tray'),
    ('砂锅老手', 'a veteran clay-pot cook lifting a bubbling casserole lid'),
    ('满汉席掌案', 'a banquet head cook with a stacked tray and a bronze ladle'),
    ('大灶总管', 'the great-stove superintendent with a huge spoon and a ledger'),
    ('文武双灶', 'a cook running two stoves at once, one hand on each wok'),
    ('一勺定味', 'the taste master tasting from a single spoon, eyes closed'),
    ('中餐宗师', 'a Chinese cuisine grandmaster with a dragon-carved cleaver'),
])
R('westernRestaurant', [
    ('银叉学徒', 'a silver-fork apprentice polishing cutlery with a cloth'),
    ('摆盘见习', 'a plating trainee with tweezers and a sprig of herbs'),
    ('黄油小手', 'a butter-hand apprentice beside a melting block on a board'),
    ('意面新人', 'a rookie pasta maker draped with long fresh ribbons'),
    ('牛排快手', 'a steak hand searing meat on a ribbed cast-iron pan'),
    ('高汤小厨', 'a demi-glace junior skimming a tall copper stock pot'),
    ('冷盘新秀', 'a cold-plate rising star with a terrine and aspic jelly'),
    ('面团学徒', 'a dough apprentice folding laminated pastry on a marble top'),
    ('铜锅妙手', 'a copper-pot virtuoso with a copper saucepan and a whisk'),
    ('慢炖看火', 'a slow-braise watcher beside a heavy lidded casserole'),
    ('红酒调香师', 'a wine-sauce alchemist with a decanter and rosemary sprig'),
    ('鹅肝快手', 'a foie-gras specialist searing a slice with a small torch'),
    ('松露猎人厨', 'a truffle hunter-chef shaving black truffle over a plate'),
    ('炭烤师傅', 'a grill master over glowing charcoal with a long fork'),
    ('铜锅主厨', 'a head chef with a copper brigade pot and a white napkin'),
    ('银匙名厨', 'a famed chef with a silver tasting spoon at the lips'),
    ('米其林新人', 'a starred-restaurant newcomer in a pristine pressed apron'),
    ('白松露掌案', 'the white-truffle station master with a scale and a shaver'),
    ('香气炼金师', 'an aroma alchemist with vials, a burner and a smelling strip'),
    ('三星刀工', 'a three-star knife hand holding a long silvery slicer'),
    ('铁血主厨', 'an iron-fisted head chef with a cleaver and a hard scowl'),
    ('西餐大宗师', 'a western-cuisine grandmaster with a golden whisk'),
])
R('sushiShop', [
    ('醋饭小徒', 'a sushi apprentice fanning vinegared rice with a paper fan'),
    ('磨刀新人', 'a knife-sharpening rookie bent over a water stone'),
    ('玉子烧学徒', 'a tamagoyaki apprentice with a folded omelette and a flat pan'),
    ('竹轮小工', 'a kamaboko handler with a bamboo board and fish cakes'),
    ('海苔快手', 'a nori toasting hand passing sheets over a flame'),
    ('刺身新手', 'a sashimi novice slicing a fish block with a hesitant grip'),
    ('寿司见习', 'a sushi trainee shaping nigiri with wet hands'),
    ('天妇罗新丁', 'a tempura batter hand with long chopsticks and a bubbling pot'),
    ('汤头小僧', 'a soup-stock acolyte with a miso ladle and a steaming bowl'),
    ('握寿司妙手', 'a master nigiri shaper with three pieces lined up'),
    ('鳗鱼快手', 'an eel griller with a lacquered unagi skewer over coals'),
    ('鲷鱼刀客', 'a sea-bream knife duelist with a mirror-finish blade'),
    ('昆布调香师', 'a kelp-umami specialist with a kombu sheet and a cloth'),
    ('铁火卷名手', 'a maki roller with a bamboo mat and a finished nori roll'),
    ('炙烧师傅', 'a torching chef running a flame over a fish slice'),
    ('出汁看火人', 'a dashi watcher beside a stainless pot and a cloth filter'),
    ('板前新星', 'a rising counter chef in a crisp white coat and headband'),
    ('白身鱼刀客', 'a white-fish knife hand holding a long filleting blade'),
    ('怀石掌案', 'a kaiseki course master presenting a lacquered box'),
    ('江户前主厨', 'an edomae head chef pressing a hand-shaped sushi'),
    ('一刀无骨', 'a boneless single-stroke knife master with a razor-thin blade'),
    ('日料大宗匠', 'a Japanese cuisine grand artisan with a pearl-handled knife'),
])
R('dessertWorkshop', [
    ('糖霜小徒', 'a sugar apprentice spooning frosting over a small cake'),
    ('打蛋新人', 'a rookie whisking egg whites in a copper bowl'),
    ('裱花小手', 'a piping-hand apprentice with a bag and a tray of rosettes'),
    ('奶油快手', 'a cream-whipping hand with a chilled whisk and peaky cream'),
    ('果酱小厨', 'a jam junior beside bubbling berry pots and rows of jars'),
    ('烘焙新人', 'a baking rookie pulling a hot tray from the oven'),
    ('巧克力学徒', 'a chocolate apprentice with a tempered bowl and molds'),
    ('慕斯新秀', 'a mousse rising star with a ring mold and a torch'),
    ('酥皮妙手', 'a laminated-pastry virtuoso with a lattice pie top'),
    ('焦糖炼金师', 'a caramel alchemist spinning thin sugar threads'),
    ('舒芙蕾快手', 'a souffle hand carrying a ramekin with careful steps'),
    ('马卡龙巧手', 'a macaron artist holding a tray of pastel shells'),
    ('千层匠人', 'a mille-crepe artisan beside a tall layered cake'),
    ('冰淇淋魔术师', 'an ice-cream magician with a scoop and dry-ice fog'),
    ('塔派名师', 'a tart master with a fluted mold and fresh berries'),
    ('蜜饯老手', 'a candied-fruit veteran with syrup jars and brass tongs'),
    ('糖艺塑形师', 'a sugar sculptor with a blown-sugar figure on a stick'),
    ('拉糖戏法师', 'a pulled-sugar showman with glossy ribbons in both hands'),
    ('蛋糕设计师', 'a cake designer beside a tiered cake and piping tools'),
    ('甜点主厨', 'a pastry head chef torching a creme brulee'),
    ('糖艺宗师', 'a sugar-art grandmaster beside a crystal sugar sculpture'),
    ('甜品工坊之王', 'the dessert workshop king with a giant layered showpiece'),
])
R('culinaryAcademy', [
    ('院系新生', 'a culinary academy freshman holding a textbook and a tray'),
    ('试味助手', 'a tasting assistant with a rack of numbered cups'),
    ('食谱抄录生', 'a recipe-copying student with a thick notebook and a pen'),
    ('实验室小工', 'a lab hand surrounded by beakers of stock and a burner'),
    ('香料研究员', 'a spice researcher with labeled jars and a pestle'),
    ('火候讲师', 'a heat-control lecturer with a thermometer and a pan'),
    ('刀工助教', 'a knife-skills TA with a cutting board and calipers'),
    ('发酵博士生', 'a fermentation PhD student beside bubbling crocks'),
    ('分子料理助研', 'a molecular-gastronomy researcher with a syringe and foam'),
    ('风味分析师', 'a flavor analyst with a tasting wheel and a pipette'),
    ('品评助教', 'a tasting-panel TA holding a stack of score sheets'),
    ('烹调讲师', 'a cooking lecturer demonstrating at a prep counter'),
    ('味觉研究员', 'a taste researcher with a tongue-map chart and vials'),
    ('食材考古家', 'an ingredient archaeologist with a brush and an ancient grain'),
    ('酶解专家', 'an enzymatic-breakdown expert with a reactor flask'),
    ('温度学讲师', 'a thermal-science lecturer with a lab thermometer'),
    ('风味结构师', 'a flavor architect with a layered model of taste'),
    ('学院副教授', 'an associate professor at a lectern with a gavel'),
    ('首席研究员', 'a principal investigator with a clipboard and a lab coat'),
    ('味觉权威', 'the taste authority holding a golden tasting spoon'),
    ('学院评议长', 'the academy council chair with a sealed envelope'),
    ('美食学院院长', 'the culinary academy dean with a ceremonial collar and a cane'),
])
R('undergroundKitchen', [
    ('黑市帮厨', 'a black-market kitchen hand with a crate of illicit roots'),
    ('暗巷二手', 'an alley second-hand dealer with a bag of grey powders'),
    ('走私香料商', 'a smuggled-spice dealer with hidden jars sewn into the coat'),
    ('禁料快手', 'a quick hand slicing forbidden ingredients on a scarred board'),
    ('卖相伪装师', 'a fake-presentation artist with a plastered dish and a brush'),
    ('毒草学徒', 'a poisonous-herb apprentice with thick gloves and a clay pot'),
    ('暗火掌灶', 'a dark-fire stove master with a smoke-blackened face'),
    ('血腥屠户', 'a blood-stained butcher with a heavy cleaver and a meat hook'),
    ('影子配菜人', 'a shadowy prep hand gutting fish in a dark corner'),
    ('禁断腌制师', 'a forbidden-pickling master beside murky bubbling jars'),
    ('黑锅炼金客', 'a black-pot alchemist with a cauldron of tar-like stew'),
    ('腐味调香师', 'a rot-scent perfumer with dangling dried things on the belt'),
    ('断刃刀客', 'a broken-blade knife hand with a chipped cleaver'),
    ('迷香厨师', 'a drugged-aroma cook with a smoking incense brazier'),
    ('无声掌勺', 'a silent stove master with a wrapped face and a ladle'),
    ('暗市宴主', 'a black-market banquet host lifting a covered silver dish'),
    ('毒宴炼丹人', 'a poison-banquet refiner with a drip funnel and vials'),
    ('地下食肆管家', 'the underworld kitchen steward with keys and a whip-cane'),
    ('黑厨长老', 'an elder dark chef with a bone-handled cleaver'),
    ('断魂刀手', 'a soul-severing blade hand with a sword-length knife'),
    ('深渊引路人', 'an abyss guide with a lantern and a hooked bill'),
    ('地下食肆之主', 'the underworld kitchen lord with a bone crown and a giant cleaver'),
])
R('gourmetArena', [
    ('赛场新秀', 'a tournament rookie with a white bib and a clipboard'),
    ('预选赛快手', 'a qualifier speed cook with a stopwatch and a hot pan'),
    ('铜牌挑战者', 'a bronze-medal challenger flexing a heavy skillet'),
    ('铁勺斗士', 'an iron-ladle fighter with the utensil raised like a weapon'),
    ('速度赛好手', 'a speed-round specialist in a frantic stirring motion'),
    ('火候竞速者', 'a heat-timing racer with a flame and a stopwatch'),
    ('味觉竞技人', 'a taste-league competitor holding a numbered tray'),
    ('淘汰赛猛者', 'a knockout-round brawler swinging a heavy pan'),
    ('铜鼎选手', 'a bronze-cauldron contestant with a trophy-like pot'),
    ('银勺斗士', 'a silver-spoon duelist with a polished ladle'),
    ('赛场黑马', 'a dark-horse arena cook with taped wrists and goggles'),
    ('连胜挑战者', 'a winning-streak challenger with a belt of spoons'),
    ('铁人厨斗士', 'an iron-cook athlete with a heavy tray and shoulder strap'),
    ('半决赛常客', 'a semifinal regular in a uniform covered in badges'),
    ('金勺选手', 'a golden-ladle contender holding a shining utensil'),
    ('卫冕挑战者', 'a title challenger with a plaque and a fierce glare'),
    ('决赛常客', 'a finals veteran with a worn lucky towel around the neck'),
    ('冠亚之争者', 'a finalist in a two-way clash pose with twin pans'),
    ('金鼎斗士', 'a golden-cauldron fighter with a harness of medals'),
    ('食神候选人', 'a god-of-cooking candidate with a laurel wreath and a golden spoon'),
    ('前任亚军', 'a former runner-up with a silver medal and a wrapped arm'),
    ('食神大赛冠军', 'the cooking-god champion holding a trophy and a laurel crown'),
])
R('abyssKitchen', [
    ('深渊杂役', 'an abyssal drudge carrying a bucket of black ichor'),
    ('蚀味小徒', 'a corrosive-taste apprentice with dripping acidic gloves'),
    ('灰烬厨手', 'an ash-cook with a coal poker and a burnt-through apron'),
    ('暗潮配菜人', 'a dark-tide prep hand gutting a pale deep-sea fish'),
    ('虚火掌灶', 'a void-flame stove master with purple fire cupped in one palm'),
    ('骨汤煮手', 'a bone-broth boiler beside a skull-decorated pot'),
    ('腐海渔夫', 'a rotting-sea fisherman with a tangled net and a barbed hook'),
    ('深渊摆盘者', 'an abyss plater arranging eye-like garnish on a black plate'),
    ('幽冥调味师', 'a spectral seasoner with floating jars of powder'),
    ('蚀骨刀客', 'a bone-eating blade hand with a jagged knife'),
    ('万味吞噬者', 'a devourer of all flavors wearing a maw-like mask'),
    ('无光掌勺', 'a lightless stove master wreathed in rolling smoke'),
    ('深渊炖煮人', 'an abyssal stew cook beside a huge bubbling cauldron'),
    ('千面厨影', 'a thousand-faced kitchen shade wearing layered masks'),
    ('噬味领主', 'a flavor-devouring lord with a crowned helm of spoons'),
    ('虚空炙烤手', 'a void-torch griller with a flaming skewer'),
    ('永恒汤主', 'the eternal soup lord pouring from an endless ladle'),
    ('深渊食神候补', 'an abyssal god-of-cooking candidate with tentacle ornaments'),
    ('无尽宴主', 'the endless banquet host beside a sprawling platter'),
    ('吞世厨祖', 'the world-devouring kitchen ancestor lifting a planet-sized pot lid'),
    ('深渊执勺者', 'the abyss spoon-bearer with a colossal bone ladle'),
    ('食之深渊主宰', 'the abyss sovereign with a crown of broken plates and a void cleaver'),
])
BOSS_ROLE = [
    ('汤王', 'the soup king with a colossal dripping ladle and a steaming crown'),
    ('砧板王', 'the cutting-board king with a butcher block as a shield and a giant cleaver'),
    ('面条之王', 'the noodle king with an endless noodle rope and a rolling pin taller than himself'),
    ('刀圣', 'the blade saint with two identical long knives crossed'),
    ('白汤圣手', 'the white-broth saint with a milky cauldron and a silver skimmer'),
    ('火锅真君', 'the hotpot sovereign with a boiling twin-pot and a ladle of red oil'),
    ('酒仙', 'the wine immortal with a gourd flask and a flaming pan'),
    ('铁锅将军', 'the iron-wok general with a wok as a shield and a sword-like spatula'),
    ('寿司之神', 'the sushi god holding a perfect nigiri and a pearl-handled knife'),
    ('面神', 'the noodle god pulling a rope of noodles into the air'),
    ('炙烤魔', 'the grilling demon with a flaming skewer and smoking shoulder coals'),
    ('甜品女王', 'the dessert queen on a macaron pedestal with a torch and a sugar scepter'),
    ('蟹皇', 'the crab emperor with a shell crown and a massive claw cracker'),
    ('珍珠皇后', 'the pearl empress with a string of milky pearls and a bubble-tea staff'),
    ('分子料理博士', 'the molecular-gastronomy doctor with syringes, foam and a liquid-nitrogen flask'),
    ('火魔', 'the fire demon shrouded in flame with a burning wok'),
    ('狂乱主厨', 'the mad head chef with wild hair, three knives and a broken plate'),
    ('中华一番', 'the Chinese legend with a dragon cleaver and a glowing wok'),
    ('冰王', 'the ice king with a frozen cleaver and frost breath'),
    ('深渊食客', 'the abyss diner with a void maw and a fork the size of a spear'),
    ('黑暗料理王', 'the dark-cuisine king with a bubbling black cauldron and a bone spoon'),
    ('毒后', 'the poison queen with a fuming teapot and rings of vial corks'),
    ('星辰面点师', 'the star pastry chef with a constellation rolling pin and a galaxy tart'),
    ('混沌厨魔', 'the chaos kitchen demon with mismatched limbs and a melting pot'),
    ('灭世烤箱', 'the world-ending oven with a furnace chest and an iron door shield'),
    ('初代食神', 'the first god of cooking with a worn golden crown and an ancient ladle'),
    ('禁忌食神', 'the forbidden god of cooking with a sealed mask and cursed utensils'),
    ('寰宇食尊', 'the universe cuisine lord with a starfield cloak and a planetary pot'),
]

for _n, _r in BOSS_ROLE:
    ROLE[_n] = ('boss', _r)

# ── 稳定哈希 → 七维取值（同名字每次一致；相邻敌人必然不同）────────────────────
# 从名字里读「性别 / 年龄段」信号，用来过滤掉自相矛盾的取值
FEMALE = ['丫头', '娘子', '西施', '阿婆', '大婶', '厨娘', '女王', '皇后', '毒后', '主妇', '婆']
MALE = ['小厮', '童子', '少侠', '老伯', '小哥', '厨祖', '仙', '道士', '僧侣', '屠户', '将军', '真君', '之王', '王', '神', '魔', '博士']
YOUNG = ['学徒', '小徒', '新人', '新丁', '见习', '小工', '小厮', '童子', '丫头', '新生', '新手', '青工', '小厨', '助手', '抄录生', '小僧']
ELDER = ['阿婆', '老伯', '长老', '宗师', '大宗师', '大宗匠', '祖', '院长', '评议长', '权威', '老手', '老炮', '掌案', '祖师', '圣手', '圣人']
FEMALE_HEAD = ['a tall pleated chef toque', 'a hairnet over short cropped hair', 'a towel wrapped around the head',
               'a hair bun held with chopsticks', 'a long ponytail tied back', 'messy curly hair',
               'a side-parted short haircut', 'a heavy fringe over the eyes', 'a white cloth headband',
               'a flat straw hat', 'a bandana tied low on the forehead', 'a flat work cap']
FEMALE_FEAT = ['flour smudges on one cheek', 'a spray of freckles', 'a beauty mark under one eye', 'a single pierced ear',
               'a sweatband and dripping sweat', 'a mole on the jaw', 'a bandaged wrist', 'band-aids on two fingers',
               'a small scar across one eyebrow', 'a grease smear on the nose']
YOUNG_AGE = ['a fresh-faced youth', 'a teenager', 'a young adult in the early twenties']
YOUNG_FEAT = ['flour smudges on one cheek', 'a spray of freckles', 'a grease smear on the nose',
              'a sweatband and dripping sweat', 'band-aids on two fingers', 'a chipped front tooth',
              'a beauty mark under one eye', 'a bandaged wrist', 'a small scar across one eyebrow', 'a single pierced ear']
ELDER_AGE = ['a grey-haired elder in the sixties', 'a weathered old-timer']
ELDER_BUILD = ['weathered but sturdy', 'stocky heavy build', 'lean and quick-footed', 'broad-shouldered and muscular']
ELDER_BUILD_F = ['plump and sturdy', 'short and round body', 'slight and bent with age', 'tall and stiff-backed']
# 区域里的「之王 / 主宰 / 当家 / 宗师」＝区内压轴，按首领规格给体型与神情（但不追加首领块）
MINI_BOSS = ['之王', '主宰', '当家', '宗师', '大宗师', '大宗匠', '总管', '院长', '至尊', '之主', '大王']

def hints(name):
    return {
        'female': any(k in name for k in FEMALE),
        'male': any(k in name for k in MALE),
        'young': any(k in name for k in YOUNG),
        'elder': any(k in name for k in ELDER),
    }

POOLS = [BUILD, AGE, HEAD, GARMENT, EXPR, FEAT]
def pick(pool, name, idx, salt):
    h = int(md5((name + '|' + salt).encode('utf-8')).hexdigest()[:8], 16)
    return pool[(h + idx * 7 + salt.__len__()) % len(pool)]

def describe(name, region_id, idx, is_boss=False):
    role = ROLE[name][1] if name in ROLE else name
    h = hints(name)
    mini = any(k in name for k in MINI_BOSS)
    if is_boss or mini:
        builds = BOSS_BUILD_F if h['female'] else BOSS_BUILD
        exps = BOSS_EXPR
    elif h['elder']:
        builds = ELDER_BUILD_F if h['female'] else ELDER_BUILD
        exps = EXPR
    else:
        builds = BUILD
        exps = EXPR
    heads = FEMALE_HEAD if h['female'] and not h['male'] else HEAD
    feats = (YOUNG_FEAT if h['young'] else (FEMALE_FEAT if h['female'] else FEAT))
    ages = YOUNG_AGE if h['young'] else (ELDER_AGE if h['elder'] else AGE)
    build = pick(builds, name, idx, 'build')
    age = pick(ages, name, idx, 'age')
    if h['female']:  # 「毒后」不该配 "a man in his late twenties"（年龄池里的性别词要跟着换）
        age = age.replace('a man', 'a woman').replace('his', 'her')
    head = pick(heads, name, idx, 'head')
    gown = pick(GARMENT, name, idx, 'gown')
    expr = pick(exps, name, idx, 'expr')
    feat = pick(feats, name, idx, 'feat')
    if is_boss:
        feat = pick(BOSS_TRAIT, name, idx, 'trait')
    accents = ACCENTS.get(region_id) or ACCENTS.get('boss')
    if region_id == 'boss':
        accents = ACCENTS['boss']
    accent = accents[idx % len(accents)]
    personality = (['speaks with an unhurried, absolute authority', 'radiates menace without moving',
                    'looks like the whole room is his kitchen', 'has a stillness that makes others step back'][idx % 4]
                   if is_boss else
                   ['looks experienced and unbothered', 'looks a little out of place', 'radiates quiet pride',
                    'looks ready to argue about seasoning', 'moves with practiced economy',
                    'has an oddly precise posture'][idx % 6])
    parts = [
        f'{role}',
        f'{build}, {age}',
        f'wearing {gown}, {head}, {feat}',
        f'color scheme of {accent}',
        f'{expr}, {personality}',
    ]
    desc = ', '.join(parts)
    if is_boss:
        desc += ', ' + BOSS_BLOCK
    return desc

def main():
    # 从游戏数据取「名字 / 区域 / 等级 / 建议文件名」，保证与游戏一致
    js = r'''
import('./src/game/data/combat.js').then(m=>{
  const R=m.COMBAT_REGIONS, B=m.COMBAT_BOSSES;
  const out={region:[],boss:[]};
  R.forEach(r=>{
    const order=r.opponents.map((o,i)=>({o,i})).sort((a,b)=>a.o.level-b.o.level||a.i-b.i);
    order.forEach(({o},k)=>out.region.push({region:r.name, regionId:r.id, seq:k+1, name:o.name, level:o.level, file:'enemy_'+r.id+'_'+String(k+1).padStart(2,'0')+'.png'}));
  });
  B.slice().sort((a,b)=>a.level-b.level).forEach((b,i)=>out.boss.push({seq:i+1, name:b.name, level:b.level, file:'boss_'+(b.key??('b'+i))+'.png'}));
  console.log(JSON.stringify(out));
})'''
    import subprocess
    p = subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, shell=False)
    data = json.loads([l for l in p.stdout.splitlines() if l.startswith('{')][-1])

    rows_r, rows_b = [], []
    for i, row in enumerate(data['region']):
        d = describe(row['name'], row['regionId'], i)
        row['desc'] = d
        row['prompt'] = BASE.replace('{desc}', d)
        rows_r.append(row)
    for i, row in enumerate(data['boss']):
        d = describe(row['name'], 'boss', i, is_boss=True)
        row['desc'] = d
        row['prompt'] = BASE.replace('{desc}', d)
        rows_b.append(row)

    # 自检：描述必须两两不同（反同质化），且短描述里出现过的「服装/头饰」组合不重复
    seen = {}
    dup = []
    for row in rows_r + rows_b:
        if row['desc'] in seen:
            dup.append((seen[row['desc']], row['name']))
        seen[row['desc']] = row['name']
    print('条目', len(rows_r) + len(rows_b), '描述唯一', len(seen), '重复', dup[:5])

    with io.open(os.path.join(ROOT, '.enemy_desc.json'), 'w', encoding='utf-8') as f:
        json.dump({'region': rows_r, 'boss': rows_b, 'base': BASE, 'neg': NEG}, f, ensure_ascii=False)
    print('已写 .enemy_desc.json')

if __name__ == '__main__':
    main()
