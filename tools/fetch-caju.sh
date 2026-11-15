#!/bin/sh
# Puts the Caju compiler for the playground (caju.wasm, the standard library, the browser host)
# in public/caju: from a local build of cajulang (CAJU_WASM_DIR, default ../caju/dist/caju-wasm)
# or, without one, from the release of the version in caju.toml (CAJU_VERSION overrides it), with
# its signature checked (tools/caju-verify.sh) and only regular files taken from the package.
set -eu
cd "$(dirname "$0")/.."
FILES="caju.wasm caju-files.json caju-browser.mjs caju-host.mjs VERSION"
rm -rf public/caju
mkdir -p public/caju

fail() { echo "fetch-caju: $*" >&2; exit 1; }

# copies the expected files of a folder to public/caju, refusing anything that is not a regular
# file (a symbolic link would make cp copy a file from outside the package)
copy_files() {
  for f in $FILES; do
    { [ -f "$1/$f" ] && [ ! -L "$1/$f" ]; } || fail "$1/$f is not a regular file"
    cp -P "$1/$f" public/caju/
  done
}

DIR=${CAJU_WASM_DIR:-../caju/dist/caju-wasm}
if [ -d "$DIR" ]; then
  copy_files "$DIR"
else
  version=${CAJU_VERSION:-$(sed -n 's/^caju = "\(.*\)"$/\1/p' caju.toml)}
  [ -n "$version" ] || fail "no caju version (caju.toml)"
  asset=caju-wasm.tar.gz
  url="https://github.com/cajulang/cajulang/releases/download/v$version/$asset"
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL --proto '=https' --tlsv1.2 "$url" -o "$tmp/$asset"
  curl -fsSL --proto '=https' --tlsv1.2 "$url.sig" -o "$tmp/$asset.sig"
  sh tools/caju-verify.sh "$tmp/$asset" "$tmp/$asset.sig" "$asset" "$version"
  # before anything is written: every member a regular file or a directory, under caju-wasm/
  bad=$(tar -tvzf "$tmp/$asset" | awk '{ t = substr($1, 1, 1); if (t != "-" && t != "d") print }')
  [ -z "$bad" ] || fail "the package has entries that are not files or directories: $bad"
  bad=$(tar -tzf "$tmp/$asset" | grep -Ev '^caju-wasm/' || true)$(tar -tzf "$tmp/$asset" | grep -E '(^|/)\.\.(/|$)' || true)
  [ -z "$bad" ] || fail "unexpected paths in the package: $bad"
  mkdir "$tmp/x"
  tar -C "$tmp/x" --no-same-owner --no-same-permissions -xzf "$tmp/$asset"
  [ -z "$(find "$tmp/x" ! -type f ! -type d)" ] || fail "the package has entries that are not files or directories"
  copy_files "$tmp/x/caju-wasm"
  [ "$(cat public/caju/VERSION)" = "$version" ] || fail "the package says $(cat public/caju/VERSION), not $version"
fi
echo "public/caju: caju $(cat public/caju/VERSION)"
