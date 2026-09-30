"""全库物品图批量入库（2026-09-30）—— 处理 `D:\\迅雷下载\\allnewimg\\<类别中文>\\<物品名>.png` 这一批。

与单批管线的差别：
  · **源图目录是嵌套的**（54 个类别子目录），而管线只吃扁平目录 ⇒ 这里自己走目录树；
  · 每个文件要**对回物品**（按名字；重名时用类别目录消歧），再按 `itemImage()` 算出**该进哪个子目录**
    （food / tool / equipment / seed / spirit）—— 不是盲目全丢进 `items/food/`（那正是上一轮挖空的成因之一）；
  · 统一走 `--bg white`（这批提示词写的就是「纯白背景」）+ 轻度闭运算 3。

用法：
  python scripts/dev/batch_item_images.py --limit 24 --dry-run     # 抽样（去背不写盘）
  python scripts/dev/batch_item_images.py --apply                  # 全量写盘
输出：写盘数 / 跳过数（名字对不上）/ 找不到主体 / **实心 <25%（疑似又画成空心）** / 与旧图的实心度对比。
"""
import argparse
import importlib.util
import json
import os
import sys
import time

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
PIPE = os.path.join(ROOT, 'scripts', 'gen', 'process_item_images.py')
spec = importlib.util.spec_from_file_location('pipe', PIPE)
pipe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipe)

DEFAULT_SRC = r'D:\迅雷下载\allnewimg'
INDEX = os.path.join(ROOT, 'scripts', 'dev', '.items.json')


def read_json(path):
    raw = open(path, 'rb').read()
    return json.loads(raw.decode('utf-16') if raw[:2] in (b'\xff\xfe', b'\xfe\xff') else raw.decode('utf-8'))


def solid_of(img):
    return sum(1 for p in img.getdata() if p[3] > 8) / float(pipe.OUT_SIZE ** 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=DEFAULT_SRC)
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--limit', type=int, default=0, help='只处理前 N 张（抽样用；0 = 全部）')
    ap.add_argument('--sample', type=int, default=0,
                    help='跨类别等距抽 N 张（`--limit` 只取前 N，会集中在第一个类别里）')
    ap.add_argument('--only', default=None, help='只处理类别目录名含该子串的')
    ap.add_argument('--closing', type=int, default=3)
    ap.add_argument('--report', default=None, help='把「名称/实心度/旧实心度」写成 JSON')
    # ⚠️ 变体（`·良`/`·精`/`·珍`/`·御` 一类）在设计上**共用基底的图**（`it.image` 显式指向基底那张），
    #    ⇒ 它们的源图若照名字直接写，会**覆盖基底自己的图**（2026-09-30 实测踩到）。
    ap.add_argument('--skip-variants', action='store_true', help='跳过「图片文件名 ≠ 物品名」的变体')
    ap.add_argument('--only-shared-bases', action='store_true',
                    help='只处理「图被别的物品共用」的正主（用来把被变体覆盖的基底图还原）')
    args = ap.parse_args()
    pipe.CLOSING = args.closing

    items = read_json(INDEX)
    by_name = {}
    img_count = {}
    for it in items:
        by_name.setdefault(it['name'], []).append(it)
        if it['img']:
            img_count[it['img']] = img_count.get(it['img'], 0) + 1

    jobs, skipped = [], []
    for dirpath, _dirs, files in os.walk(args.src):
        cat = os.path.basename(dirpath)
        if args.only and args.only not in cat:
            continue
        for f in sorted(files):
            if not f.lower().endswith(('.png', '.webp')):
                continue
            name = os.path.splitext(f)[0]
            cands = by_name.get(name, [])
            if not cands:
                skipped.append('%s/%s（物品库里没有这个名字）' % (cat, f))
                continue
            if len(cands) > 1:
                pick = [c for c in cands if c['categoryLabel'] == cat]
                if len(pick) != 1:
                    skipped.append('%s/%s（重名 %d 个、类别对不上）' % (cat, f, len(cands)))
                    continue
                it = pick[0]
            else:
                it = cands[0]
            if not it['img']:
                skipped.append('%s/%s（该物品没有图片路径）' % (cat, f))
                continue
            if args.skip_variants and os.path.splitext(os.path.basename(it['img']))[0] != name:
                skipped.append('%s/%s（变体，共用基底图）' % (cat, f))
                continue
            if args.only_shared_bases and img_count[it['img']] < 2:
                continue
            jobs.append((os.path.join(dirpath, f), name, os.path.join(ROOT, 'public', it['img'])))

    if args.limit:
        jobs = jobs[:args.limit]
    if args.sample and len(jobs) > args.sample:
        step = len(jobs) / float(args.sample)
        jobs = [jobs[int(i * step)] for i in range(args.sample)]
    print('待处理 %d 张 · 跳过 %d 张 %s' % (len(jobs), len(skipped), '【试跑】' if not args.apply else '【写盘】'))
    for s in skipped[:20]:
        print('   ⚠️ ' + s)

    rows, failed = [], []
    for i, (src, name, dst) in enumerate(jobs, 1):
        try:
            sq, side, _dropped = pipe.build(src, 'white')
            if sq is None:
                failed.append('%s（找不到主体）' % name)
                continue
            out = pipe.downsample(sq, 'box')
            new_solid = solid_of(out)
            old_solid = None
            if os.path.exists(dst):
                # ⚠️ 必须显式 close：`Image.open` 是**惰性**的，句柄会一直开着 ⇒
                #    同一路径稍后还要再写时（正主 + 变体共用一个路径）Windows 会报
                #    `[Errno 22] Invalid argument`（2026-09-30 实测：47 张写失败全出在这里）。
                with Image.open(dst) as im:
                    old_solid = solid_of(im.convert('RGBA'))
            rows.append({'name': name, 'solid': new_solid, 'old': old_solid, 'side': int(side)})
            if args.apply:
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                # ⚠️ 间歇性 `OSError: [Errno 22]`（同一路径单独写又完全正常）——
                #    本机有杀软/同步工具会瞬间占住刚写的文件 ⇒ **重试**，别把偶发当成路径问题。
                for attempt in range(4):
                    try:
                        out.save(dst)
                        break
                    except OSError:
                        if attempt == 3:
                            raise
                        time.sleep(0.25)
            if i % 100 == 0 or i == len(jobs):
                print('  … %d/%d' % (i, len(jobs)), flush=True)
        except Exception as e:                     # noqa: BLE001
            failed.append('%s（%s）' % (name, e))
            if os.environ.get('IMG_DEBUG') and len(failed) <= 3:
                import traceback
                print('DEBUG %s src=%s dst=%s' % (name, src, dst))
                traceback.print_exc()

    hollow = sorted([r for r in rows if r['solid'] < 0.25], key=lambda r: r['solid'])
    dropped_pct = [r for r in rows if r['old'] and r['solid'] < r['old'] * 0.75]
    print('完成 %d 张 · 出错 %d · 实心<25%% 的 %d 张' % (len(rows), len(failed), len(hollow)))
    for r in hollow[:15]:
        print('   ⚠️ 偏空 %-14s 新 %.0f%%（旧 %s）' % (r['name'], r['solid'] * 100,
              '%.0f%%' % (r['old'] * 100) if r['old'] else '无'))
    print('比旧图实心度掉 25%% 以上的：%d 张' % len(dropped_pct))
    for r in sorted(dropped_pct, key=lambda r: r['solid'] / max(r['old'], 1))[:10]:
        print('   ⚠️ %-14s 旧 %.0f%% → 新 %.0f%%' % (r['name'], r['old'] * 100, r['solid'] * 100))
    for n in failed[:15]:
        print('   ✗ ' + n)
    if args.report:
        json.dump(rows, open(args.report, 'w', encoding='utf-8'), ensure_ascii=False)
    return 0


if __name__ == '__main__':
    sys.exit(main())
