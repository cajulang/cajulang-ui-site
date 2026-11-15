#!/bin/sh
# The build on Vercel (Git deploys): installs Caju with the official installer (the release's
# signature required), builds caju-ui (github.com/cajulang/ui) and fetches caju-style next to the
# repository, both at pinned commits, puts the playground's compiler in public/caju (signature
# checked) and writes out/ with tools/export.sh. vercel.json (root) runs it and serves out/.
#   CAJU_VERSION (default: caju in caju.toml)
# Everything fetched is pinned: the installer by commit and SHA-256, the release by its signature
# (the Caju release key), caju-ui and caju-style by commit, the site's packages by caju.lock.
set -eu
cd "$(dirname "$0")/.."
CAJU_VERSION=${CAJU_VERSION:-$(sed -n 's/^caju = "\(.*\)"$/\1/p' caju.toml)}
# install.sh of github.com/cajulang/cajulang at v0.9.0
INSTALLER_COMMIT=d94aaa66a6c5a0ee158d406e3f21cc7cc3596b31
INSTALLER_SHA256=70099e3481eccbfb489b88e885025d40487df1394b080b5a858767bf2b77cc3f
# ui v0.4.1 and caju-style v0.1.0
UI_COMMIT=d49e2b9d1fb47f673632d40c4e4d2a1254d85057
STYLE_COMMIT=957dbfcfc65ae06d2fdb7784493bc71bb88a4799
REF=$(pwd)/.ref
rm -rf "$REF"
mkdir -p "$REF"

# openssl checks the signatures (installer and tools/caju-verify.sh)
command -v openssl >/dev/null 2>&1 || dnf install -y openssl

# Caju
curl -fsSL --proto '=https' --tlsv1.2 "https://raw.githubusercontent.com/cajulang/cajulang/$INSTALLER_COMMIT/install.sh" -o "$REF/install.sh"
echo "$INSTALLER_SHA256  $REF/install.sh" | sha256sum -c -
CAJU_VERSION="$CAJU_VERSION" CAJU_REQUIRE_SIGNATURE=1 CAJU_HOME="$REF/caju-home" CAJU_BIN_DIR="$REF/bin" sh "$REF/install.sh"
export PATH="$REF/bin:$PATH"
export CAJU="$REF/bin/caju"
[ "$(caju version | sed -n 's/^caju //p')" = "$CAJU_VERSION" ] || { echo "vercel-build: caju is not $CAJU_VERSION" >&2; exit 1; }

# caju-ui and caju-style: the site imports them from sibling folders (../caju-ui, ../caju-style)
fetch_commit() {  # repository url, commit, folder
  rm -rf "$3"
  git init -q "$3"
  git -C "$3" fetch -q --depth 1 "$1" "$2"
  git -C "$3" -c advice.detachedHead=false checkout -q FETCH_HEAD
  [ "$(git -C "$3" rev-parse HEAD)" = "$2" ] || { echo "vercel-build: $1 is not at $2" >&2; exit 1; }
}
UP=$(cd .. && pwd)
fetch_commit https://github.com/cajulang/ui.git "$UI_COMMIT" "$UP/caju-ui"
fetch_commit https://github.com/cajulang/caju-style.git "$STYLE_COMMIT" "$UP/caju-style"
(cd "$UP/caju-ui" && mkdir -p build && caju build -o build/caju-ui cmd/caju-ui.caju)
export CAJU_UI="$UP/caju-ui/build/caju-ui"

# the site's packages (caju.lock)
caju pkg install

# the playground's compiler (public/caju) and the static site (out/)
CAJU_WASM_DIR=/nonexistent CAJU_VERSION="$CAJU_VERSION" sh tools/fetch-caju.sh
tools/export.sh
