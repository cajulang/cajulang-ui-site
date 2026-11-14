#!/bin/sh
# The build on Vercel (Git deploys): installs Caju (the release, SHA-256 checked), builds caju-ui
# from github.com/cajulang/ui, puts the playground's compiler in public/caju and writes out/
# with tools/export.sh. vercel.json (root) runs it and serves out/.
#   CAJU_VERSION (default 0.5.0)  UI_REF (default main)
set -eu
cd "$(dirname "$0")/.."
CAJU_VERSION=${CAJU_VERSION:-0.5.0}
UI_REF=${UI_REF:-main}
REF=$(pwd)/.ref
mkdir -p "$REF"

# Caju
asset=caju-linux-x86_64.tar.gz
url="https://github.com/cajulang/cajulang/releases/download/v$CAJU_VERSION/$asset"
curl -fsSL "$url" -o "$REF/$asset"
curl -fsSL "$url.sha256" -o "$REF/$asset.sha256"
(cd "$REF" && sha256sum -c "$asset.sha256")
rm -rf "$REF/caju" && mkdir -p "$REF/caju"
tar -C "$REF/caju" -xzf "$REF/$asset" --strip-components=1
export PATH="$REF/caju/bin:$PATH"
export CAJU="$REF/caju/bin/caju"
caju version

# caju-ui
rm -rf "$REF/ui"
git clone --depth 1 --branch "$UI_REF" https://github.com/cajulang/ui.git "$REF/ui"
(cd "$REF/ui" && mkdir -p build && caju build -o build/caju-ui cmd/caju-ui.caju)
export CAJU_UI="$REF/ui/build/caju-ui"

# the site's packages (caju.lock)
caju pkg install

# the playground's compiler (public/caju) and the static site (out/)
CAJU_WASM_DIR=/nonexistent tools/fetch-caju.sh
tools/export.sh
