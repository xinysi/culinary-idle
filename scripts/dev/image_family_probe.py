"""同族对比：把「布/纸/皂/糕」这类**本该实心**的同一族物品排在一起比实心度 —— 明显掉队的多半被挖空。"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'images', 'items')
FAMILIES = {
    '布/衣（编织·刺绣·造纸）': ['棉麻叠布', '亚麻桌布', '布艺窗帘', '锦纹靠垫', '织锦挂毯', '棕丝蓑衣', '云锦织锦',
                                '紫苏罗衣', '九畹云锦', '绣花手帕', '刺绣团扇', '绣花香囊', '刺绣插屏', '龙纹挂旗',
                                '霜林绣卷', '九畹天绣', '宣纸', '麻纸', '纸', '竹纸', '霜果纸镇', '九畹宝笈', '宝钞'],
    '皂（皂作）': ['星陨净皂', '赤霄贡皂', '珍珠皂', '天香净皂', '蜜香皂', '水晶皂'],
    '糕/饼（烘焙）': ['星霜酥', '紫府豆糕', '霜髓薯糕', '霜兔鱼酥', '金稻鳟鱼炊', '桂花糕', '绿豆糕'],
}


def stats(name):
    for sub in ('food', 'tool', 'equipment'):
        p = os.path.join(ROOT, sub, name + '.png')
        if os.path.exists(p):
            a = np.asarray(Image.open(p).convert('RGBA'))[:, :, 3]
            op = a > 8
            n = op.sum()
            if n < 20:
                return None
            er = ndimage.binary_erosion(op, structure=np.ones((3, 3)), iterations=2, border_value=0)
            return n / 4096.0, er.sum() / float(n)
    return None


for fam, names in FAMILIES.items():
    print('\n══ %s ══' % fam)
    print('%-14s %8s %10s' % ('物品', '实心%', '腐蚀后剩%'))
    for n in names:
        s = stats(n)
        if s is None:
            print('%-14s %8s %10s' % (n, '缺图', ''))
            continue
        print('%-14s %7.1f%% %9.1f%%' % (n, s[0] * 100, s[1] * 100))
