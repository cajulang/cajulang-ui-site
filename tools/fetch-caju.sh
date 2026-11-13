#!/bin/sh
# Puts the Caju compiler for the playground (caju.wasm, the standard library, the browser host)
# in public/caju: from a local build of cajulang (CAJU_WASM_DIR, default ../caju/dist/caju-wasm)
# or, without one, from the latest release.
set -e
cd "$(dirname "$0")/.."
mkdir -p public/caju
DIR=${CAJU_WASM_DIR:-../caju/dist/caju-wasm}
if [ -d "$DIR" ]; then
  cp "$DIR"/caju.wasm "$DIR"/caju-files.json "$DIR"/caju-browser.mjs "$DIR"/caju-host.mjs "$DIR"/VERSION public/caju/
else
  curl -fsSL https://github.com/cajulang/cajulang/releases/latest/download/caju-wasm.tar.gz | tar xz -C public/caju --strip-components=1
fi
echo "public/caju: caju $(cat public/caju/VERSION)"
