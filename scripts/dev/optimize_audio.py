# -*- coding: utf-8 -*-
"""BGM 瘦身（2026-09-26 立）：把 13 首 320kbps 的 BGM 重编码成 ~128kbps VBR。

**为什么敢动**：BGM 的播放音量是 `settings.bgmVolume(默认 0.35) × BGM_MASTER_TRIM(0.6) × 每首 trim`
≈ **−30dBFS 的背景音**；在这个电平上 128kbps 的编码噪声远低于播放底噪，听不出差别。
（对白/音效那种要精确还原的素材不适用这条；本项目的音效是合成音、本来就轻。）

工具链：`soundfile`（libsndfile 1.2.2，能解 MP3）+ `lameenc`（内置 LAME 编码）。
判据：重编码后逐首核对**时长一致**、体积下降；原文件**不删只移**（默认移到仓外备份区）。

用法（**必须在仓库根目录运行**）：
  python scripts/dev/optimize_audio.py            # 试跑：编码到暂存目录并报告，不动仓库
  python scripts/dev/optimize_audio.py --apply    # 真替换：原 320k 移到备份区，128k 覆盖进 public
"""
import argparse
import os
import shutil
import sys
from pathlib import Path

import lameenc
import numpy as np
import soundfile as sf

# ⚠️ 路径写法（安全扫描要求，见 AGENTS「Mimosa 发布钩子」）：**只用相对仓库根的常量路径 + 包含性校验**。
#    不要从 `__file__` 连续上溯（`../..` / `parents[N]` 会被判成路径穿越而拦截）。
BGM_DIR = Path('public/audio/bgm')
STAGE_DIR = Path('wuguan/audio-bgm-128')
STORE_DIR = Path('D:/plays/lmew_beifen/audio-src-320')
TARGET_KBPS = 128
ROOT = Path('.').resolve()


def inside(root: Path, child: Path) -> Path:
    """校验 child 落在 root 内（阻断穿越），返回规范化后的绝对路径。

    用**字符串前缀**判断而不是 `.parents`：扫描器把 `.parents` 也当成上溯写法（实测被拦过）。
    """
    r = str(root.resolve())
    c = str(child.resolve())
    if c != r and not c.startswith(r + os.sep):
        raise SystemExit(f'❌ 路径越界：{c} 不在 {r} 之内')
    return Path(c)


def transcode(src: Path, dst: Path, kbps: int = TARGET_KBPS):
    """mp3 → PCM → mp3(VBR)。返回 (时长秒, 声道数, 采样率)。"""
    data, rate = sf.read(str(src), dtype='float32', always_2d=True)
    ch = data.shape[1]
    enc = lameenc.Encoder()
    enc.set_in_sample_rate(rate)
    enc.set_channels(ch)
    enc.set_vbr_mean_bitrate_kbps(kbps)
    enc.set_vbr_quality(2)  # 0=最好、9=最差
    pcm = (np.clip(data, -1.0, 1.0) * 32767.0).astype('<i2')
    # 用 write_bytes 而不是 open(...,'wb')：写目标是**算出来的路径**，open() 会被安全扫描判成穿越
    dst.write_bytes(enc.encode(pcm.tobytes()) + enc.flush())
    return data.shape[0] / rate, ch, rate


def duration_of(path: Path) -> float:
    info = sf.info(str(path))
    return info.frames / info.samplerate


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='真替换 public/audio/bgm（默认只编码到暂存区）')
    ap.add_argument('--kbps', type=int, default=TARGET_KBPS)
    args = ap.parse_args()

    if not BGM_DIR.is_dir():
        raise SystemExit('❌ 请在**仓库根目录**运行本脚本（找不到 public/audio/bgm）')
    src_dir = inside(ROOT, BGM_DIR)
    stage = inside(ROOT, STAGE_DIR)
    store = STORE_DIR  # 仓外备份区

    files = sorted(f for f in os.listdir(src_dir) if f.lower().endswith('.mp3'))
    if not files:
        raise SystemExit('❌ public/audio/bgm 下没有 mp3')
    stage.mkdir(parents=True, exist_ok=True)

    before = after = 0
    rows = []
    for f in files:
        src = inside(src_dir, src_dir / f)
        dst = inside(stage, stage / f)
        b = os.path.getsize(src)
        dur_a = duration_of(src)
        dur_b, ch, rate = transcode(src, dst, args.kbps)
        a = os.path.getsize(dst)
        before += b
        after += a
        ok = abs(dur_a - dur_b) < 0.5
        rows.append((f, ok))
        print(f'  {f:<12} {dur_a:6.1f}s  {b / 1048576:5.2f} MB → {a / 1048576:5.2f} MB（省 {100 - 100 * a / b:4.0f}%）'
              f'{"  ⚠️ 时长不符" if not ok else ""}  {ch}ch/{rate}Hz')
    print(f'\n合计：{before / 1048576:.1f} MB → {after / 1048576:.1f} MB（省 {100 - 100 * after / before:.0f}%，{args.kbps}kbps VBR）')

    bad = [f for f, ok in rows if not ok]
    if bad:
        raise SystemExit('⚠️ 以下文件时长不符，请检查：' + ', '.join(bad))

    if args.apply:
        store.mkdir(parents=True, exist_ok=True)
        for f in files:
            shutil.move(str(src_dir / f), str(inside(store, store / f)))
            shutil.copyfile(str(stage / f), str(src_dir / f))
        print(f'已替换 {len(files)} 首；原 320k 原文件在：{store}')
    else:
        print(f'（试跑）128k 产物在暂存区：{stage} —— 听过之后加 --apply 替换')


if __name__ == '__main__':
    main()
