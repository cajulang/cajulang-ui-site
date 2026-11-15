#!/bin/sh
# Checks a file of a Caju release against its signature (the .sig next to it on the release), the
# same check as the official installer (install.sh of github.com/cajulang/cajulang): the format
# "caju-release 1", the file's name, its version, its SHA-256 and the Ed25519 signature by the
# Caju release key, verified with openssl. Fails (exit 1) on anything else.
#   tools/caju-verify.sh <file> <file.sig> <name> <version>
set -eu
file=$1
sig=$2
name=$3
version=$4
# the public release key (hex): RELEASE_KEYS in compiler/upgrade.caju and release_keys in install.sh
release_keys="84c9600cb86ae42bc76633f6666e59bc28edb297d6f3d5bf3cbb16378d1dc993"

fail() { echo "caju-verify: $name: $*" >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || fail "openssl is needed to check the signature"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

hex_to_file() {
  printf "$(printf '%s' "$1" | awk 'BEGIN { for (i = 0; i < 16; i++) h[sprintf("%x", i)] = i }
    { s = tolower($0); for (i = 1; i < length(s); i += 2) printf "\\%03o", h[substr(s, i, 1)] * 16 + h[substr(s, i + 1, 1)] }')" > "$2"
}
field() { sed -n "s/^$1 //p" "$sig" | head -n 1; }
is_hex() { printf '%s' "$1" | grep -Eq "^[0-9a-f]{$2}\$"; }

[ "$(sed -n 1p "$sig")" = "caju-release 1" ] || fail "not a caju release signature"
[ "$(field file)" = "$name" ] || fail "the signature is for $(field file), not $name"
[ "$(field version)" = "$version" ] || fail "the signature is for version $(field version), not $version"
[ "$(field sha256)" = "$(sha256sum "$file" | cut -d' ' -f1)" ] || fail "the file does not match its signature (SHA-256 differs)"
key=$(field key)
signature=$(field signature)
is_hex "$key" 64 || fail "malformed key"
is_hex "$signature" 128 || fail "malformed signature"
trusted=""
for k in $release_keys; do [ "$k" = "$key" ] && trusted=1; done
[ -n "$trusted" ] || fail "signed by a key that is not the Caju release key ($key)"

sed '/^signature /,$d' "$sig" > "$tmp/body"
hex_to_file "$signature" "$tmp/sig.bin"
hex_to_file "302a300506032b6570032100$key" "$tmp/key.der"
openssl pkey -pubin -inform DER -in "$tmp/key.der" -out "$tmp/key.pem" 2>/dev/null || fail "openssl cannot read the release key (needs OpenSSL 1.1.1 or newer)"
openssl pkeyutl -verify -pubin -inkey "$tmp/key.pem" -rawin -in "$tmp/body" -sigfile "$tmp/sig.bin" >/dev/null 2>&1 ||
  fail "invalid signature"
echo "caju-verify: $name $version: signature ok"
