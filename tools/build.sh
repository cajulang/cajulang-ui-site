#!/bin/sh
# Builds the site: the program (wasm), the server and the CSS (caju style, from the style.def
# calls of the .cajux files: site_css.caju).
#   tools/build.sh            CAJU=path/to/caju  CAJU_UI=path/to/caju-ui
set -e
cd "$(dirname "$0")/.."
CAJU=${CAJU:-caju}
CAJU_UI=${CAJU_UI:-../caju-ui/build/caju-ui}
"$CAJU_UI" gen
"$CAJU" run site_css.caju
"$CAJU_UI" build --ssr server.cajux
