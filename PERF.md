# cajulang site: Next.js vs Caju

2026-11-12 · headless Chromium, cold cache (a new browser context per load), median of 9 loads · both servers local, production builds (next start / caju-ui build)

## /en

| | Next.js (original) | Caju (ui + web) |
|---|--:|--:|
| TTFB (first byte) | 7 ms | 2 ms |
| First contentful paint | 112 ms | 125 ms |
| Largest contentful paint | 112 ms | 125 ms |
| DOMContentLoaded | 32 ms | 81 ms |
| load event | 136 ms | 81 ms |
| Interactive (a click answers; playground: compiler ready) | 200 ms | 159 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms |
| Requests | 31 | 8 |
| Transferred | 370 KB | 105 KB |
|   JavaScript | 204 KB | 13 KB |
|   WebAssembly | 0 KB | 0 KB |
|   HTML document | 24 KB | 23 KB |
| Page JS heap | 4.8 MB | 1.4 MB |
| DOM nodes | 1481 | 1392 |

## /en/examples

| | Next.js (original) | Caju (ui + web) |
|---|--:|--:|
| TTFB (first byte) | 7 ms | 2 ms |
| First contentful paint | 88 ms | 93 ms |
| Largest contentful paint | 88 ms | 93 ms |
| DOMContentLoaded | 63 ms | 63 ms |
| load event | 118 ms | 63 ms |
| Interactive (a click answers; playground: compiler ready) | 183 ms | 140 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms |
| Requests | 31 | 8 |
| Transferred | 368 KB | 100 KB |
|   JavaScript | 204 KB | 13 KB |
|   WebAssembly | 0 KB | 0 KB |
|   HTML document | 24 KB | 18 KB |
| Page JS heap | 5.3 MB | 1.1 MB |
| DOM nodes | 2666 | 2559 |

## /en/spec

| | Next.js (original) | Caju (ui + web) |
|---|--:|--:|
| TTFB (first byte) | 8 ms | 2 ms |
| First contentful paint | 100 ms | 100 ms |
| Largest contentful paint | 100 ms | 100 ms |
| DOMContentLoaded | 73 ms | 70 ms |
| load event | 127 ms | 70 ms |
| Interactive (a click answers; playground: compiler ready) | 192 ms | 151 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms |
| Requests | 31 | 8 |
| Transferred | 373 KB | 111 KB |
|   JavaScript | 204 KB | 13 KB |
|   WebAssembly | 0 KB | 0 KB |
|   HTML document | 34 KB | 29 KB |
| Page JS heap | 5.7 MB | 1.1 MB |
| DOM nodes | 3104 | 2935 |

## /en/playground

| | Next.js (original) | Caju (ui + web) |
|---|--:|--:|
| TTFB (first byte) | 7 ms | 2 ms |
| First contentful paint | 68 ms | 72 ms |
| Largest contentful paint | 68 ms | 72 ms |
| DOMContentLoaded | 24 ms | 51 ms |
| load event | 100 ms | 51 ms |
| Interactive (a click answers; playground: compiler ready) | 285 ms | 143 ms |
| Main thread blocked (TBT) | 0 ms | 0 ms |
| Requests | 36 | 13 |
| Transferred | 931 KB | 765 KB |
|   JavaScript | 210 KB | 22 KB |
|   WebAssembly | 477 KB | 559 KB |
|   HTML document | 10 KB | 13 KB |
| Page JS heap | 5.3 MB | 1.1 MB |
| DOM nodes | 463 | 436 |

## Server (rendering /en, 32 concurrent, keep-alive, 3000 requests)

| | Next.js (original) | Caju (ui + web) |
|---|--:|--:|
| Pages per second | 437 | 2927 |
| Latency p50 | 69.3 ms | 9.0 ms |
| Latency p99 | 144.4 ms | 32.2 ms |
| Server memory (RSS) | 209 MB | 48 MB |

## Notes

- Caju's "Transferred" leaves out `app.wasm` (213 KB gzipped), which the worker fetches and the
  browser's request log does not show: the home page is about 318 KB in all, against 370 KB.
  Next.js's figure includes the prefetch of the other six pages (`?_rsc=`), which this site does
  not do.
- "Interactive" is when a click first works: React has hydrated (Next.js), or the program has
  loaded and hydrated in the worker (Caju). On the playground it is when the compiler is ready.
- Both servers serve the pages from memory: Next.js prerendered them at build time; the Caju
  server renders and gzips each one on its first request. Next.js compresses with zlib, the Caju
  server with its own gzip (fixed Huffman codes, about 20% larger).
- Measured with `node tools/perf.mjs`, both servers on the same machine (WSL2), one process each.
