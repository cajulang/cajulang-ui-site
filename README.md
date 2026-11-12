# cajulang-ui-site

The [cajulang](https://github.com/aecdanjundex/cajulang) website, rebuilt in Caju: the same pages,
the same four languages and the same look as the original Next.js site, written as Caju
components and served by a Caju server.

- [ui](https://github.com/aecdanjundex/ui) renders every page on the server (natively) and the
  browser takes it over (WebAssembly in a worker): the language menu, the theme, the copy buttons,
  the AI demo, the compiler pipeline, the garbage collector demo and the playground run there.
- [web](https://github.com/aecdanjundex/web) routes the requests (the language redirects, the
  pages, the build's files), with each page rendered and gzipped once and then served from memory.
- Tailwind CSS 4 compiles the classes used in the `.cajux` files, with the original's theme
  (`styles/globals.css`) and fonts.

Every page, in every language, renders pixel for pixel like the original (`tools/compare.mjs`),
and the interactive parts behave the same (`tools/interact.mjs`). Loading and server performance
against the original are in [PERF.md](PERF.md).

## Layout

```
app.cajux            the root: layout + page
core.cajux           shared pieces: header (language menu, theme, mobile menu), footer, hero,
                     code windows, copy buttons, the brand's icon
pages/*.cajux        home, examples, spec, mcp, architecture, brand, playground
i18n.caju            language, dictionary, number formatting, rich text
highlight.caju       Caju syntax highlighting (the original's rules)
icons.caju           the Lucide icons the site uses (generated: tools/export-icons.mjs)
main.cajux           the browser: ui.hydrate
server.cajux         the server (web): routes, <head>, redirects, cache, gzip
data/                the original's dictionaries and content (tools/export-data.mjs)
public/site.js       what only the page can do (theme, storage, history, the playground's worker),
                     called from Caju with ui.call
```

## Running it

Needs `caju` (0.5.0), a checkout of [ui](https://github.com/aecdanjundex/ui) next to this one
(`../caju-ui`, with `caju build -o build/caju-ui cmd/caju-ui.caju` run in it) and Node (for the
Tailwind CLI).

```sh
npm install                      # Tailwind CLI
caju pkg install                 # web
tools/fetch-caju.sh              # the compiler for the playground (public/caju)
tools/build.sh                   # CSS, the program (wasm) and the server
./server                         # http://localhost:3000 (PORT)
```

Development, with hot reload: `npx tailwindcss -i styles/globals.css -o public/site.css --watch` and
`../caju-ui/build/caju-ui dev --ssr server.cajux`.

`ui` is imported by path (`../caju-ui/ui`) until it has a published version.
