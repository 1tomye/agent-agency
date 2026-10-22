"""Copy the generated theme (theme/assets) into webview-ui/public/assets.

Copies the characters, floors, wall, office furniture and the office layout.
The build copies webview-ui/public/assets into dist/, so rebuild afterwards.

Undo with git:
  git checkout -- webview-ui/public/assets && git clean -fd webview-ui/public/assets

Usage: python apply_theme.py [repo dir] [--check]   (default: this repository)
"""
import glob
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def plan(repo):
    src = os.path.join(ROOT, "assets")
    dst = os.path.join(repo, "webview-ui", "public", "assets")
    if not os.path.isdir(dst):
        sys.exit(f"{dst} not found - is {repo} the Agent Agency repository?")
    copies = []
    for sub, pattern in (("characters", "char_*.png"), ("floors", "floor_*.png"), ("walls", "wall_*.png")):
        for f in sorted(glob.glob(os.path.join(src, sub, pattern))):
            copies.append((f, os.path.join(dst, sub, os.path.basename(f))))
    for folder in sorted(glob.glob(os.path.join(src, "furniture", "*"))):
        for f in sorted(glob.glob(os.path.join(folder, "*"))):
            copies.append((f, os.path.join(dst, "furniture", os.path.basename(folder), os.path.basename(f))))
    for f in sorted(glob.glob(os.path.join(src, "default-layout-*.json"))):
        copies.append((f, os.path.join(dst, os.path.basename(f))))
    return copies


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")] or [os.path.dirname(ROOT)]
    check = "--check" in sys.argv
    copies = plan(args[0])
    missing = [s for s, _ in copies if not os.path.exists(s)]
    if missing:
        sys.exit("Generate the theme first; missing:\n  " + "\n  ".join(missing))
    for s, d in copies:
        action = "replace" if os.path.exists(d) else "add"
        print(f"{action:<8}{os.path.relpath(d, args[0])}")
        if not check:
            os.makedirs(os.path.dirname(d), exist_ok=True)
            shutil.copyfile(s, d)
    print(f"{'Would copy' if check else 'Copied'} {len(copies)} files.")


if __name__ == "__main__":
    main()
