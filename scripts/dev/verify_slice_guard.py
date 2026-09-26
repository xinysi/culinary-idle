# -*- coding: utf-8 -*-
"""反例验证 `check_slice_safety.py`：**先注入缺陷，再看它会不会 FAIL**。

守卫最怕「恒真」：一条永远 PASS 的检查比没有检查更糟（它会伪装成保障）。
本脚本把一张**合格**素材临时改成「中心区画一块朱红」——也就是 pipeline 本来要清掉的那种病
——跑一次检查，必须 FAIL 并点名；随后逐字节还原。

用法：python scripts/dev/verify_slice_guard.py
"""
import io
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(r"D:\plays\lmew")
UI = ROOT / "public" / "images" / "ui2"
CHECKER = ROOT / "scripts" / "dev" / "check_slice_safety.py"
TARGET = UI / "modal" / "frame_modal_normal_414x512@2x_color.png"


def run_checker():
    r = subprocess.run([sys.executable, str(CHECKER), "--strict"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def main() -> int:
    original = TARGET.read_bytes()
    try:
        code, out = run_checker()
        print("[基线] exit=%d  %s" % (code, out.strip().splitlines()[-1]))
        if code != 0:
            print("❌ 基线就不合格，先修素材再谈反例验证")
            return 1

        # 注入：在中心区正中画一块朱红（模拟「朱印烤进可拉伸边框」这个真实缺陷）
        im = Image.open(io.BytesIO(original)).convert("RGBA")
        w, h = im.size
        for y in range(h // 3, h // 3 + 90):
            for x in range(w // 3, w // 3 + 90):
                im.putpixel((x, y), (166, 55, 31, 255))
        im.save(TARGET)

        code, out = run_checker()
        named = "FRAME_MODAL" in out
        print("[注入缺陷后] exit=%d  点named=%s" % (code, named))
        for line in out.strip().splitlines():
            if line.startswith("❌") or "装饰被拉进中心" in line:
                print("   " + line.strip())
        if code == 0 or not named:
            print("❌ 守卫是假绿：注入缺陷后仍然 PASS / 或没点名到 FRAME_MODAL")
            return 1
        print("✅ 反例验证通过：缺陷被点名，守卫有效")
        return 0
    finally:
        TARGET.write_bytes(original)
        print("[还原] %s 已恢复原字节（%d bytes）" % (TARGET.name, len(original)))


if __name__ == "__main__":
    sys.exit(main())
