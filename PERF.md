# cajulang site: performance, transfer and memory

2026-11-13 · headless Chromium · median of 5 loads · all servers local, production builds.

- **Next.js**: the original site (next start).
- **Caju + Tailwind**: this site before caju style (Tailwind CSS 4, the earlier gzip, no caching headers).
- **Caju + caju style**: this site (caju style with each page's sheet inlined, gzip with dynamic Huffman codes, ETag and immutable versioned files).

## All seven pages

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| First visits: transferred, 7 pages (each with a cold cache) | 3141 KB | 2860 KB | 2534 KB |
| First visits: requests, 7 pages | 222 | 68 | 68 |
| First visits: first contentful paint, average | 92 ms | 95 ms | 100 ms |
| First visits: interactive, average | 208 ms | 142 ms | 148 ms |
| First visits: page JS heap, average | 5.3 MB | 1.2 MB | 1.2 MB |
| Next pages after /en: transferred, 6 pages (warm cache) | 1121 KB | 2542 KB | 710 KB |
| Next pages after /en: requests, 6 pages | 191 | 59 | 59 |
| Next pages after /en: interactive, average | 204 ms | 140 ms | 145 ms |
| HTML as served, 7 pages | 143 KB | 125 KB | 102 KB |
| HTML uncompressed, 7 pages | 1308 KB | 743 KB | 598 KB |
| CSS as served (all files) | 13 KB | 14 KB | 9.4 KB |
| JavaScript as served (the pages' scripts) | 242 KB | 7.6 KB | 6.3 KB |
| Program fetched by the worker (app.wasm), first visit | 0.0 KB | 213 KB | 192 KB |
|   the same on each next page | 0.0 KB | 213 KB | 0.0 KB |

## Slow 4G (150 ms, 1.6 Mbit/s), first visit

### /en

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| First contentful paint | 748 ms | 716 ms | 633 ms |
| Largest contentful paint | 748 ms | 716 ms | 633 ms |
| load event | 1670 ms | 711 ms | 697 ms |
| Interactive | 1736 ms | 2075 ms | 1934 ms |
| Transferred (with the worker's app.wasm) | 370 KB | 318 KB | 285 KB |

### /en/architecture

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| First contentful paint | 812 ms | 728 ms | 692 ms |
| Largest contentful paint | 812 ms | 728 ms | 692 ms |
| load event | 1700 ms | 710 ms | 703 ms |
| Interactive | 1761 ms | 2010 ms | 1880 ms |
| Transferred (with the worker's app.wasm) | 368 KB | 313 KB | 282 KB |

## Server (rendering /en, 32 concurrent, keep-alive, gzip, 3000 requests)

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| Pages per second | 451 | 6844 | 7616 |
| Latency p50 | 67.8 ms | 4.1 ms | 3.6 ms |
| Latency p99 | 108.1 ms | 11.6 ms | 9.5 ms |
| Server memory (RSS) | 166 MB | 44 MB | 50 MB |

## /en

First visit (cold cache):

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| TTFB (first byte) | 6 ms | 2 ms | 2 ms |
| First contentful paint | 112 ms | 115 ms | 117 ms |
| Largest contentful paint | 112 ms | 115 ms | 117 ms |
| DOMContentLoaded | 80 ms | 74 ms | 73 ms |
| load event | 141 ms | 75 ms | 73 ms |
| Interactive (a click answers; playground: compiler ready) | 206 ms | 153 ms | 148 ms |
| Main thread blocked (TBT) | 1 ms | 0 ms | 0 ms |
| Requests | 31 | 8 | 8 |
| Transferred | 370 KB | 105 KB | 94 KB |
|   HTML | 24 KB | 23 KB | 18 KB |
|   CSS | 13 KB | 14 KB | 9.4 KB |
|   JavaScript | 204 KB | 13 KB | 11 KB |
|   WebAssembly | 0.0 KB | 0.0 KB | 0.0 KB |
|   Fonts | 52 KB | 52 KB | 52 KB |
| Page JS heap | 4.8 MB | 1.4 MB | 1.4 MB |
| DOM nodes | 1481 | 1392 | 1394 |

## /en/examples

First visit (cold cache):

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| TTFB (first byte) | 7 ms | 2 ms | 2 ms |
| First contentful paint | 92 ms | 93 ms | 97 ms |
| Largest contentful paint | 92 ms | 93 ms | 97 ms |
| DOMContentLoaded | 33 ms | 65 ms | 68 ms |
| load event | 120 ms | 65 ms | 68 ms |
| Interactive (a click answers; playground: compiler ready) | 189 ms | 145 ms | 157 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms | 0 ms |
| Requests | 31 | 8 | 8 |
| Transferred | 368 KB | 100 KB | 90 KB |
|   HTML | 24 KB | 18 KB | 15 KB |
|   CSS | 13 KB | 14 KB | 9.4 KB |
|   JavaScript | 204 KB | 13 KB | 11 KB |
|   WebAssembly | 0.0 KB | 0.0 KB | 0.0 KB |
|   Fonts | 52 KB | 52 KB | 52 KB |
| Page JS heap | 5.3 MB | 1.1 MB | 1.1 MB |
| DOM nodes | 2666 | 2559 | 2561 |

After /en (warm cache):

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| TTFB (first byte) | 7 ms | 1 ms | 1 ms |
| First contentful paint | 104 ms | 89 ms | 94 ms |
| Largest contentful paint | 104 ms | 89 ms | 94 ms |
| DOMContentLoaded | 31 ms | 62 ms | 64 ms |
| load event | 124 ms | 62 ms | 64 ms |
| Interactive (a click answers; playground: compiler ready) | 193 ms | 139 ms | 147 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms | 0 ms |
| Requests | 31 | 8 | 8 |
| Transferred | 93 KB | 100 KB | 25 KB |
|   HTML | 24 KB | 18 KB | 15 KB |
|   CSS | -0.3 KB | 14 KB | -0.3 KB |
|   JavaScript | -4.2 KB | 13 KB | 9.0 KB |
|   WebAssembly | 0.0 KB | 0.0 KB | 0.0 KB |
|   Fonts | -0.5 KB | 52 KB | -0.6 KB |
| Page JS heap | 5.2 MB | 1.1 MB | 1.1 MB |
| DOM nodes | 2666 | 2559 | 2561 |

## /en/spec

First visit (cold cache):

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| TTFB (first byte) | 7 ms | 2 ms | 2 ms |
| First contentful paint | 100 ms | 99 ms | 111 ms |
| Largest contentful paint | 100 ms | 99 ms | 111 ms |
| DOMContentLoaded | 81 ms | 72 ms | 75 ms |
| load event | 131 ms | 72 ms | 75 ms |
| Interactive (a click answers; playground: compiler ready) | 211 ms | 153 ms | 163 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms | 0 ms |
| Requests | 31 | 8 | 8 |
| Transferred | 373 KB | 111 KB | 98 KB |
|   HTML | 34 KB | 29 KB | 23 KB |
|   CSS | 13 KB | 14 KB | 9.4 KB |
|   JavaScript | 204 KB | 13 KB | 11 KB |
|   WebAssembly | 0.0 KB | 0.0 KB | 0.0 KB |
|   Fonts | 52 KB | 52 KB | 52 KB |
| Page JS heap | 5.6 MB | 1.2 MB | 1.1 MB |
| DOM nodes | 3104 | 2935 | 2937 |

After /en (warm cache):

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| TTFB (first byte) | 7 ms | 1 ms | 1 ms |
| First contentful paint | 100 ms | 98 ms | 106 ms |
| Largest contentful paint | 100 ms | 98 ms | 106 ms |
| DOMContentLoaded | 30 ms | 72 ms | 72 ms |
| load event | 129 ms | 72 ms | 72 ms |
| Interactive (a click answers; playground: compiler ready) | 217 ms | 156 ms | 158 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms | 0 ms |
| Requests | 31 | 8 | 8 |
| Transferred | 98 KB | 111 KB | 33 KB |
|   HTML | 34 KB | 29 KB | 23 KB |
|   CSS | -0.3 KB | 14 KB | -0.3 KB |
|   JavaScript | -4.2 KB | 13 KB | 9.0 KB |
|   WebAssembly | 0.0 KB | 0.0 KB | 0.0 KB |
|   Fonts | -0.5 KB | 52 KB | -0.6 KB |
| Page JS heap | 5.7 MB | 1.1 MB | 1.2 MB |
| DOM nodes | 3104 | 2935 | 2937 |

## /en/mcp

First visit (cold cache):

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| TTFB (first byte) | 5 ms | 2 ms | 2 ms |
| First contentful paint | 92 ms | 90 ms | 97 ms |
| Largest contentful paint | 92 ms | 90 ms | 97 ms |
| DOMContentLoaded | 25 ms | 63 ms | 65 ms |
| load event | 129 ms | 63 ms | 65 ms |
| Interactive (a click answers; playground: compiler ready) | 208 ms | 125 ms | 137 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms | 0 ms |
| Requests | 31 | 8 | 8 |
| Transferred | 366 KB | 96 KB | 87 KB |
|   HTML | 18 KB | 15 KB | 12 KB |
|   CSS | 13 KB | 14 KB | 9.4 KB |
|   JavaScript | 204 KB | 13 KB | 11 KB |
|   WebAssembly | 0.0 KB | 0.0 KB | 0.0 KB |
|   Fonts | 52 KB | 52 KB | 52 KB |
| Page JS heap | 5.4 MB | 1.2 MB | 1.2 MB |
| DOM nodes | 764 | 687 | 689 |

After /en (warm cache):

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| TTFB (first byte) | 5 ms | 1 ms | 1 ms |
| First contentful paint | 92 ms | 87 ms | 91 ms |
| Largest contentful paint | 92 ms | 87 ms | 91 ms |
| DOMContentLoaded | 24 ms | 61 ms | 64 ms |
| load event | 120 ms | 61 ms | 64 ms |
| Interactive (a click answers; playground: compiler ready) | 179 ms | 122 ms | 131 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms | 0 ms |
| Requests | 31 | 8 | 8 |
| Transferred | 91 KB | 96 KB | 23 KB |
|   HTML | 18 KB | 15 KB | 12 KB |
|   CSS | -0.3 KB | 14 KB | -0.3 KB |
|   JavaScript | -4.2 KB | 13 KB | 9.0 KB |
|   WebAssembly | 0.0 KB | 0.0 KB | 0.0 KB |
|   Fonts | -0.5 KB | 52 KB | -0.6 KB |
| Page JS heap | 5.4 MB | 1.2 MB | 1.2 MB |
| DOM nodes | 764 | 687 | 689 |

## /en/architecture

First visit (cold cache):

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| TTFB (first byte) | 5 ms | 2 ms | 2 ms |
| First contentful paint | 104 ms | 112 ms | 113 ms |
| Largest contentful paint | 104 ms | 112 ms | 113 ms |
| DOMContentLoaded | 29 ms | 72 ms | 74 ms |
| load event | 132 ms | 72 ms | 74 ms |
| Interactive (a click answers; playground: compiler ready) | 196 ms | 149 ms | 147 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms | 0 ms |
| Requests | 31 | 8 | 8 |
| Transferred | 368 KB | 100 KB | 91 KB |
|   HTML | 20 KB | 18 KB | 15 KB |
|   CSS | 13 KB | 14 KB | 9.4 KB |
|   JavaScript | 204 KB | 13 KB | 11 KB |
|   WebAssembly | 0.0 KB | 0.0 KB | 0.0 KB |
|   Fonts | 52 KB | 52 KB | 52 KB |
| Page JS heap | 4.9 MB | 1.4 MB | 1.4 MB |
| DOM nodes | 1329 | 1201 | 1203 |

After /en (warm cache):

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| TTFB (first byte) | 5 ms | 1 ms | 1 ms |
| First contentful paint | 104 ms | 118 ms | 101 ms |
| Largest contentful paint | 104 ms | 118 ms | 101 ms |
| DOMContentLoaded | 23 ms | 78 ms | 72 ms |
| load event | 127 ms | 78 ms | 72 ms |
| Interactive (a click answers; playground: compiler ready) | 194 ms | 160 ms | 143 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms | 0 ms |
| Requests | 31 | 8 | 8 |
| Transferred | 93 KB | 100 KB | 26 KB |
|   HTML | 20 KB | 18 KB | 15 KB |
|   CSS | -0.3 KB | 14 KB | -0.3 KB |
|   JavaScript | -4.2 KB | 13 KB | 9.0 KB |
|   WebAssembly | 0.0 KB | 0.0 KB | 0.0 KB |
|   Fonts | -0.5 KB | 52 KB | -0.6 KB |
| Page JS heap | 5.0 MB | 1.4 MB | 1.4 MB |
| DOM nodes | 1329 | 1201 | 1203 |

## /en/brand

First visit (cold cache):

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| TTFB (first byte) | 6 ms | 2 ms | 2 ms |
| First contentful paint | 84 ms | 90 ms | 83 ms |
| Largest contentful paint | 84 ms | 90 ms | 83 ms |
| DOMContentLoaded | 61 ms | 67 ms | 60 ms |
| load event | 118 ms | 67 ms | 60 ms |
| Interactive (a click answers; playground: compiler ready) | 180 ms | 126 ms | 125 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms | 0 ms |
| Requests | 31 | 8 | 8 |
| Transferred | 364 KB | 91 KB | 83 KB |
|   HTML | 14 KB | 9.3 KB | 7.5 KB |
|   CSS | 13 KB | 14 KB | 9.4 KB |
|   JavaScript | 204 KB | 13 KB | 11 KB |
|   WebAssembly | 0.0 KB | 0.0 KB | 0.0 KB |
|   Fonts | 52 KB | 52 KB | 52 KB |
| Page JS heap | 5.5 MB | 1.3 MB | 1.3 MB |
| DOM nodes | 921 | 834 | 836 |

After /en (warm cache):

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| TTFB (first byte) | 5 ms | 1 ms | 1 ms |
| First contentful paint | 80 ms | 86 ms | 85 ms |
| Largest contentful paint | 80 ms | 86 ms | 85 ms |
| DOMContentLoaded | 25 ms | 61 ms | 61 ms |
| load event | 107 ms | 61 ms | 61 ms |
| Interactive (a click answers; playground: compiler ready) | 165 ms | 122 ms | 124 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms | 0 ms |
| Requests | 31 | 8 | 8 |
| Transferred | 90 KB | 91 KB | 18 KB |
|   HTML | 14 KB | 9.3 KB | 7.5 KB |
|   CSS | -0.3 KB | 14 KB | -0.3 KB |
|   JavaScript | -4.2 KB | 13 KB | 9.0 KB |
|   WebAssembly | 0.0 KB | 0.0 KB | 0.0 KB |
|   Fonts | -0.5 KB | 52 KB | -0.6 KB |
| Page JS heap | 5.5 MB | 1.3 MB | 1.3 MB |
| DOM nodes | 921 | 834 | 836 |

## /en/playground

First visit (cold cache):

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| TTFB (first byte) | 5 ms | 2 ms | 2 ms |
| First contentful paint | 60 ms | 69 ms | 79 ms |
| Largest contentful paint | 60 ms | 69 ms | 79 ms |
| DOMContentLoaded | 42 ms | 51 ms | 57 ms |
| load event | 93 ms | 51 ms | 57 ms |
| Interactive (a click answers; playground: compiler ready) | 265 ms | 143 ms | 159 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms | 0 ms |
| Requests | 36 | 13 | 13 |
| Transferred | 931 KB | 765 KB | 649 KB |
|   HTML | 10 KB | 13 KB | 12 KB |
|   CSS | 13 KB | 14 KB | 9.4 KB |
|   JavaScript | 210 KB | 22 KB | 18 KB |
|   WebAssembly | 477 KB | 559 KB | 470 KB |
|   Fonts | 52 KB | 52 KB | 52 KB |
| Page JS heap | 5.3 MB | 1.1 MB | 1.1 MB |
| DOM nodes | 463 | 436 | 438 |

After /en (warm cache):

| | Next.js | Caju + Tailwind | Caju + caju style |
|---|--:|--:|--:|
| TTFB (first byte) | 4 ms | 1 ms | 2 ms |
| First contentful paint | 60 ms | 68 ms | 81 ms |
| Largest contentful paint | 60 ms | 68 ms | 81 ms |
| DOMContentLoaded | 18 ms | 49 ms | 61 ms |
| load event | 95 ms | 49 ms | 61 ms |
| Interactive (a click answers; playground: compiler ready) | 276 ms | 141 ms | 169 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms | 0 ms |
| Requests | 36 | 13 | 13 |
| Transferred | 656 KB | 765 KB | 584 KB |
|   HTML | 10 KB | 13 KB | 12 KB |
|   CSS | -0.3 KB | 14 KB | -0.3 KB |
|   JavaScript | 1.9 KB | 22 KB | 16 KB |
|   WebAssembly | 477 KB | 559 KB | 470 KB |
|   Fonts | -0.5 KB | 52 KB | -0.6 KB |
| Page JS heap | 5.3 MB | 1.1 MB | 1.1 MB |
| DOM nodes | 465 | 436 | 438 |

## Notes

- "Interactive" is when a click first works: React has hydrated (Next.js), or the program has loaded and hydrated in the worker (Caju). On the playground it is when the compiler is ready.
- Caju's program (`app.wasm`) is fetched by its worker, whose requests the browser's log leaves out: the totals of "All seven pages" add it (measured on the server: gzipped, and on the next pages a 304 when there is an ETag), the per-page tables do not.
- Measured with `node tools/perf.mjs`, all servers on the same machine (WSL2), one process each.
