#!/bin/sh
# A static copy of the site in out/, for a CDN (Vercel): the build's files, every page in every
# language rendered by the server (SITE_EXPORT), and vercel.json (deploy/vercel.json) with the
# language redirects, the cross-origin isolation the playground needs, the security headers and
# the cache headers. Fails if a page has an inline script the CSP does not allow (tools/check-csp.mjs).
#   tools/export.sh && vercel deploy --prebuilt     (or: vercel deploy out)
#   CAJU=path/to/caju  CAJU_UI=path/to/caju-ui  SKIP_BUILD=1 (reuse dist/ and ./server)
set -e
cd "$(dirname "$0")/.."
[ -n "$SKIP_BUILD" ] || tools/build.sh
rm -rf out
cp -r dist out
rm -f out/index.html out/_headers
SITE_EXPORT=out ./server
cp deploy/vercel.json out/vercel.json
node tools/check-csp.mjs out
echo "out/: $(find out -type f | wc -l) files, $(du -sh out | cut -f1)"
