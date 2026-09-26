# -*- coding: utf-8 -*-
"""图片编码口径的**唯一出口**（2026-09-25 图片瘦身时立）。

为什么要有这个文件：立绘/照片/背景的 WebP 档位散在四个脚本里（`optimize_images.py` 是转换器，
`process_enemy_images.py` / `key_patrons.py` / `dealpha_guests.py` 是出图脚本）——一旦某处改了档位，
其余三处就会产出**不一致的画质**；更糟的是出图脚本若仍写 `.png`，而游戏代码只认 `.webp`，
就会变成「图出了、游戏里不显示」的静默失效。统一在这里定义。

⚠️ 改档位前先读 `optimize_images.py` 的文件头（那里记了「按实际显示尺寸比 PSNR」的判据与实测值）。
"""

# 立绘类（512×512 源图，卡片显示 140~176px、餐厅立绘最大 ~315px）：q92 在显示尺寸下 40~48dB
PORTRAIT_Q = 92
# 照片类：先按最长边缩到实际需要的尺寸，再编码（照片在同分辨率下转 WebP 只省约 28%，收益全靠缩图）
PHOTO_Q = 82
PHOTO_MAX = 1600
# 满屏背景（canvas 背景，源 2848×1600）
BG_Q = 82
BG_MAX = 1280


def save_webp(im, path, quality, max_side=None):
    """按上面口径存 WebP：PNG 源保留透明通道、JPG 源走 RGB；`max_side` 是**最长边上限**（只缩不放）。

    返回 (宽, 高)。调用方负责先 `Image.open(...)`；这里会自己做 RGBA/RGB 转换与缩放。
    """
    from PIL import Image  # 局部导入：本模块要被其它脚本 import，别把 PIL 变成硬依赖
    keep_alpha = im.mode in ('RGBA', 'LA', 'P') or 'transparency' in im.info
    im = im.convert('RGBA' if keep_alpha else 'RGB')
    if max_side and max(im.size) > max_side:
        scale = max_side / max(im.size)
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    im.save(path, 'WEBP', quality=quality, method=6)
    return im.size
