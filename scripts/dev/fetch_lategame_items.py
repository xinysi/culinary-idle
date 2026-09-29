"""抓取 Lv101-120「补档」物品的**源图**到仓库外的暂存目录（不写仓库、不碰 public/）。

为什么单独一个脚本、而不是让 gen_*.py 顺手下载：
  · 生成与「入库」是两步刻意分开的 —— 入库（写 public/images/）要人过目，这一步只把源图攒齐；
  · 源目录在**仓库外**（默认 `D:\\plays\\lmew_art\\lategame-<日期>\\src`），所以这批图在被接线前
    **对游戏零影响**，也不会混进备份或提交。

用法：
    python scripts/dev/fetch_lategame_items.py                        # 58 件全抓
    python scripts/dev/fetch_lategame_items.py --only 霜降香榧
    python scripts/dev/fetch_lategame_items.py --group A
    python scripts/dev/fetch_lategame_items.py --staging D:\\plays\\lmew_art\\batch2 --force
"""

import argparse
import ipaddress
import os
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent                      # 仓库根（用 .parent 链而不是 parents[N]）
sys.path.insert(0, str(HERE))
from gen_lategame_items import ITEMS, RETRY, TAIL, generate, ssl_ctx  # noqa: E402

DEFAULT_STAGING = str(Path("D:/plays/lmew_art") / "lategame-20260929")

# 下载只允许这几家 OSS（生成结果都落在 dashscope 的加速域名下）
ALLOWED_HOST_SUFFIXES = (".aliyuncs.com",)
MAX_BYTES = 8 * 1024 * 1024                    # 源图正常几百 KB~2 MB；上限防被灌大文件


def assert_public_https(url):
    """协议 + 目标主机 + **解析后 IP** 三重校验，逐条就地写清楚（防 SSRF/DNS rebinding）。"""
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https":
        raise RuntimeError("只允许 https，实际 %r" % (parsed.scheme,))
    host = parsed.hostname or ""
    if not any(host == s.lstrip(".") or host.endswith(s) for s in ALLOWED_HOST_SUFFIXES):
        raise RuntimeError("host %r 不在白名单 %s" % (host, ALLOWED_HOST_SUFFIXES))
    for info in socket.getaddrinfo(host, parsed.port or 443, proto=socket.SOCK_STREAM):
        addr = ipaddress.ip_address(info[4][0])
        if (addr.is_private or addr.is_loopback or addr.is_link_local
                or addr.is_reserved or addr.is_multicast):
            raise RuntimeError("host %r 解析到非公网地址 %s" % (host, addr))
    return url


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """拒绝一切重定向：跳转后的地址不会再过上面的三重校验（防跳到内网/元数据服务）。"""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D102
        raise RuntimeError("拒绝重定向 → %s" % (newurl,))


def download_validated(url, timeout=600):
    """三重校验通过后下载，并限制单张大小；返回 bytes。"""
    assert_public_https(url)
    opener = urllib.request.build_opener(_NoRedirect)
    req = urllib.request.Request(url, headers={"User-Agent": "lmew-art/1.0"})
    with opener.open(req, timeout=timeout) as resp:          # noqa: S310 - 上面的三重校验已挡住内网
        final = resp.geturl()
        if final != url:
            assert_public_https(final)
        data = resp.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise RuntimeError("超过 %d 字节上限" % MAX_BYTES)
    if len(data) < 20000:                                     # 正常几百 KB；过小是错误页/缩略图
        raise RuntimeError("图片只有 %d 字节，可疑" % len(data))
    return data


def safe_target(root: Path, name: str) -> Path:
    """把「中文名.png」落到 <root>/src/ 下，并断言结果**确实在 root 内**（包含性校验）。"""
    base = Path(root).resolve()
    target = (base / "src" / (name + ".png")).resolve()
    if base != target and base not in target.parents:
        raise RuntimeError("目标路径逃出暂存目录：%s" % target)
    return target


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--staging", default=DEFAULT_STAGING, help="暂存根目录（仓库外）")
    ap.add_argument("--only", default=None)
    ap.add_argument("--group", default=None, choices=["A", "B", "C", "D", "E"])
    ap.add_argument("--force", action="store_true", help="已存在的也重出")
    ap.add_argument("--variant", choices=["retry"], default=None,
                    help="retry：只抓有 RETRY 变体的件（修正后的描述，见 gen_lategame_items.py 文件头）")
    args = ap.parse_args(argv)

    root = Path(args.staging).resolve()
    # 铁律：这批图在接线前不该进仓库 —— 暂存目录若在仓库内，直接拒绝
    if root == REPO or REPO in root.parents:
        print("❌ 暂存目录不能在仓库内：%s" % root, file=sys.stderr)
        return 2

    picked = [it for it in ITEMS
              if (not args.only or it[0] == args.only) and (not args.group or it[2] == args.group)]
    if args.variant == "retry":
        picked = [it for it in picked if it[0] in RETRY]
        if not picked:
            print("⚠ --variant retry：没有可重出的变体（有变体的是 %s）" % "、".join(RETRY), file=sys.stderr)
            return 1
    if not picked:
        print("❌ --only %r / --group %r 没匹配到任何一件" % (args.only, args.group), file=sys.stderr)
        return 1

    (root / "src").mkdir(parents=True, exist_ok=True)
    print("暂存目录：%s（共 %d 件）" % (root / "src", len(picked)))

    ok, skipped, failed = 0, 0, 0
    for idx, (name, _subdir, _group, desc) in enumerate(picked, 1):
        target = safe_target(root, name)
        if target.exists() and not args.force:
            skipped += 1
            print("[%2d/%d] 跳过（已存在） %s" % (idx, len(picked), name))
            continue
        try:
            desc = RETRY[name] if args.variant == "retry" and name in RETRY else desc
            url, rid = generate(desc + TAIL)
            data = download_validated(url)
            target.write_bytes(data)
            ok += 1
            print("[%2d/%d] ✅ %-10s %6.0f KB  %s" % (idx, len(picked), name, len(data) / 1024.0, rid))
        except Exception as exc:                  # noqa: BLE001 - 逐件报告，不中断余下
            failed += 1
            print("❌ [%2d/%d] %-10s %s" % (idx, len(picked), name, exc), file=sys.stderr)

    print("\n完成：新抓 %d · 跳过 %d · 失败 %d ⇒ %s" % (ok, skipped, failed, root / "src"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())