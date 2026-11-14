# cajulang-ui-site

The [cajulang](https://github.com/cajulang/cajulang) website, rebuilt in Caju: the same pages,
the same four languages and the same look as the original Next.js site, written as Caju
components and served by a Caju server.

- [ui](https://github.com/cajulang/ui) renders every page on the server (natively) and the
  browser takes it over (WebAssembly in a worker): the language menu, the theme, the copy buttons,
  the AI demo, the compiler pipeline, the garbage collector demo and the playground run there.
- [web](https://github.com/cajulang/web) routes the requests (the language redirects, the
  pages, the build's files), with each page rendered and gzipped once and then served from memory.
- [caju style](https://github.com/cajulang/caju-style) writes the CSS: each element has one
  class with a readable name (`class={hero_title}` -> `class="hero-title"`), declared with
  Tailwind's utility vocabulary in Caju (`style.def("hero-title", "text-[44px] font-bold ...")`)
  and compiled by Caju, with no Node and no Tailwind (`site_css.caju`, the theme in `theme.caju`).

Every page, in every language, renders pixel for pixel like the original (`tools/compare.mjs`),
and the interactive parts behave the same (`tools/interact.mjs`). Loading and server performance
against the original are in [PERF.md](PERF.md).

## Layout

```
app.cajux            the root: layout + page
core.cajux           shared pieces: header (language menu, theme, mobile menu), footer, hero,
                     code windows, copy buttons, the brand's icon
pages/*.cajux        home, examples, spec, mcp, architecture, brand, playground
theme.caju           the theme for caju style: palette, radii, fonts, variants, base rules
site_css.caju        writes public/site.css from every style.def of the site
styles/fonts.css     the @font-face rules of the original's fonts
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

Needs `caju` (0.6.0), a checkout of [ui](https://github.com/cajulang/ui) next to this one
(`../caju-ui`, with `caju build -o build/caju-ui cmd/caju-ui.caju` run in it) and one of
[caju style](https://github.com/cajulang/caju-style) (`../caju-style`). Node is only for the
comparison tools (Playwright).

```sh
caju pkg install                 # web
tools/fetch-caju.sh              # the compiler for the playground (public/caju)
tools/build.sh                   # the program (wasm), the server and the CSS
./server                         # http://localhost:3000 (PORT)
```

A static copy for a CDN (Vercel): `tools/export.sh` writes `out/`, with every page in every language
rendered by the server (`SITE_EXPORT=out ./server`) and `deploy/vercel.json` (the language
redirects by cookie and `Accept-Language`, the cross-origin isolation the playground needs, the
cache headers). Then `cd out && vercel deploy`.

Development, with hot reload: `../caju-ui/build/caju-ui dev --ssr server.cajux`, and
`caju run site_css.caju` after changing a style (it also warns about utilities it does not know).

## Styles

Each piece of the page declares its styles next to it, as module variables:

```caju
let stat = style.def("stat", "flex flex-col gap-1 border-l-[3px] border-primary px-6 py-5")
let bar_fill = style.def("bar-fill", "h-2.5 rounded-full bg-bar-other")
let bar_fill_caju = style.def("bar-fill-caju", "@bar-fill bg-primary")    # bar-fill, in red

<div class={stat}>...</div>
<div class={style.pick(is_caju, bar_fill_caju, bar_fill)}></div>
```

The shared ones are in `core.cajux` (the `button` family, `card`, `page-width`, `section`, the
code window...); a page composes them with `@name` (`"@card gap-3 rounded-[20px] p-7"`). States
that come from data are data attributes (`data-[tone=ptr]:bg-accent`) rather than more classes.
Each page's styles are in their own sheet (`let SHEET = style.sheet("home")`): `public/site.css`
has the theme, the reset and the shared styles, and the server inlines the page's sheet
(`public/css/<page>.css`) in its `<head>`. `tools/styles-diff.mjs` compares the computed style of
every element with the original's.

## Caching

`site.css` and `site.js` are linked with their version (`?v=<crc>`) and kept for good
(`immutable`), as are the fonts (their names have a hash). Everything else, including the pages and
`app.wasm`, has an ETag, so a page after the first gets `304` for the program instead of
downloading it again. Responses are gzipped by Caju (`../caju-ui/gzip`, dynamic Huffman codes).

`ui` and caju style are imported by path (`../caju-ui/ui`, `../caju-style/style`) until they have
published versions.
