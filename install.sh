#!/usr/bin/env bash
# Installs MarkEdit Explorer into the local MarkEdit app container using the
# official extension layout: scripts/<id>.js + an entry in extensions.json.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/dist/markedit-explorer.js"
DEST_DIR="$HOME/Library/Containers/app.cyan.markedit/Data/Documents"
SCRIPTS_DIR="$DEST_DIR/scripts"
FILE="markedit-explorer.js"
ID="markedit-explorer"

if [[ ! -f "$SRC" ]]; then
  echo "✗ 找不到构建产物，请先执行：npm run build" >&2
  exit 1
fi

if pgrep -x MarkEdit >/dev/null 2>&1; then
  echo "⚠️  MarkEdit 正在运行。请先退出 MarkEdit（⌘Q）再安装，避免扩展清单被应用覆盖。" >&2
  exit 1
fi

mkdir -p "$SCRIPTS_DIR"
cp "$SRC" "$SCRIPTS_DIR/$FILE"
SHA="$(shasum -a 256 "$SCRIPTS_DIR/$FILE" | awk '{print $1}')"
VERSION="$(python3 -c "import json; print(json.load(open('$HERE/package.json'))['version'])")"

DEST_DIR="$DEST_DIR" FILE="$FILE" ID="$ID" SHA="$SHA" VERSION="$VERSION" python3 - <<'PY'
import datetime
import json
import os
import pathlib
import shutil

dest = pathlib.Path(os.environ["DEST_DIR"])
manifest = dest / "extensions.json"
data = {}
if manifest.exists():
    shutil.copy2(manifest, manifest.with_suffix(".json.bak"))
    try:
        data = json.loads(manifest.read_text(encoding="utf-8")) or {}
    except (ValueError, OSError):
        data = {}

installed = data.setdefault("installed", [])
if not isinstance(installed, list):
    installed = []
    data["installed"] = installed

entry = {
    "enabled": True,
    "file": os.environ["FILE"],
    "id": os.environ["ID"],
    "installDate": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "sha256": os.environ["SHA"],
    "version": os.environ["VERSION"],
}
for index, existing in enumerate(installed):
    if isinstance(existing, dict) and existing.get("id") == os.environ["ID"]:
        installed[index] = {**existing, **entry}
        break
else:
    installed.append(entry)

manifest.write_text(
    json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    encoding="utf-8",
)
print(f"registered {os.environ['ID']} (sha256 {os.environ['SHA'][:12]}…)")
PY

echo "✓ 已安装到 $SCRIPTS_DIR/$FILE"
echo "✓ 已注册到 $DEST_DIR/extensions.json（原文件备份为 extensions.json.bak）"
echo "现在启动 MarkEdit 即可使用：Extensions ▸ Toggle Explorer，或 ⇧⌘E。"
