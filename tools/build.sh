#!/bin/sh
# Builds the site: the CSS (Tailwind over the .cajux files), the program (wasm) and the server.
#   tools/build.sh            CAJU=path/to/caju  CAJU_UI=path/to/caju-ui
set -e
cd "$(dirname "$0")/.."
CAJU_UI=${CAJU_UI:-../caju-ui/build/caju-ui}
"$CAJU_UI" gen
npx tailwindcss -i styles/globals.css -o public/site.css --minify 2>/dev/null
"$CAJU_UI" build --ssr server.cajux
