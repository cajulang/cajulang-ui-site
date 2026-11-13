// Loading performance, transfer and memory of the original site (Next.js, next start) and of this
// one, measured the same way in the same headless Chromium, plus the servers' throughput and memory.
//   node tools/perf.mjs [--runs 5]
// The sites (each must be running): SITES="Name=http://host:port,Other=..." or the default three:
// the original (3400), this site before caju style (Tailwind CSS, 3600) and this site (3500).
import { chromium } from "playwright"
import http from "node:http"
import zlib from "node:zlib"
import { execSync } from "node:child_process"
import { writeFileSync } from "node:fs"

const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d)
const RUNS = Number(arg("--runs", 5))
const SITES = Object.fromEntries((process.env.SITES || "Next.js=http://127.0.0.1:3400,Caju + Tailwind=http://127.0.0.1:3600,Caju + caju style=http://127.0.0.1:3500").split(",").map((x) => x.split("=")))
const PAGES = ["/en", "/en/examples", "/en/spec", "/en/mcp", "/en/architecture", "/en/brand", "/en/playground"]
// a mobile network (Lighthouse's "slow 4G"): 150 ms, 1.6 Mbit/s down, 750 kbit/s up
const SLOW = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
const names = Object.keys(SITES)

const b = await chromium.launch()

const kind = (u, type) => {
  if (/\.wasm(\?|$)/.test(u)) return "wasm"
  if (/\.m?js(\?|$)/.test(u) || type === "script") return "js"
  if (/\.css(\?|$)/.test(u) || type === "stylesheet") return "css"
  if (/\.woff2?(\?|$)/.test(u) || type === "font") return "font"
  if (type === "document") return "html"
  return "other"
}

// one page in a context: what it transferred, its timings and its memory
async function visit(ctx, url, slow) {
  const t = { bytes: 0, requests: 0, html: 0, css: 0, js: 0, wasm: 0, font: 0, other: 0 }
  const onDone = async (r) => {
    const s = await r.sizes().catch(() => null)
    if (!s) return
    const res = await r.response().catch(() => null)
    let body = s.responseBodySize
    // a body compiled while streaming (WebAssembly.compileStreaming) reports 0: use Content-Length
    const len = Number((res && res.headers()["content-length"]) || 0)
    if (body === 0 && len > 0 && res && res.status() === 200) body = len
    t.bytes += body + s.responseHeadersSize
    t.requests++
    t[kind(r.url(), r.resourceType())] += body
  }
  ctx.on("requestfinished", onDone)
  const p = await ctx.newPage()
  const cdp = await ctx.newCDPSession(p)
  if (slow) {
    await cdp.send("Network.enable")
    await cdp.send("Network.emulateNetworkConditions", SLOW)
  }
  await p.goto(url, { waitUntil: "load", timeout: 120000 })
  // interactive: a copy button (or the language menu) answers a click; the playground: its
  // compiler is ready (the Run button is enabled)
  const interactive = await p.evaluate(async () => {
    if (location.pathname.endsWith("/playground")) {
      for (;;) {
        const run = [...document.querySelectorAll("button")].find((b) => !b.disabled && /^(Run)$/.test(b.textContent.trim()))
        if (run) return performance.now()
        await new Promise((r) => setTimeout(r, 5))
        if (performance.now() > 60000) return -1
      }
    }
    // (the theme toggle on the pages without one: its label changes when it works)
    const btn = document.querySelector('button[aria-label^="Copy"]') || document.querySelector('button[aria-label^="Use "]')
    const before = btn.getAttribute("aria-label")
    for (;;) {
      btn.click()
      await new Promise((r) => setTimeout(r, 5))
      const now = document.querySelector('button[aria-label^="Copied"]') || (btn.getAttribute("aria-expanded") === "true" ? btn : null)
      if (now || btn.getAttribute("aria-label") !== before) return performance.now()
      if (performance.now() > 60000) return -1
    }
  })
  await p.waitForTimeout(slow ? 1500 : 500)
  const m = await p.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0]
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]
    return { ttfb: n.responseStart, fcp: fcp ? fcp.startTime : 0, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, ...window.__perf }
  })
  await cdp.send("Performance.enable")
  const metrics = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]))
  ctx.off("requestfinished", onDone)
  await p.close()
  return { ...m, interactive, ...t, heap: metrics.JSHeapUsedSize / 1048576, nodes: metrics.Nodes }
}

async function context() {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"])
  await ctx.addInitScript(() => {
    window.__perf = { lcp: 0, tbt: 0 }
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime }).observe({ type: "largest-contentful-paint", buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.tbt += Math.max(0, e.duration - 50) }).observe({ type: "longtask", buffered: true })
  })
  return ctx
}

// a first visit (cold cache): a new context per load
async function cold(base, path, slow) {
  const ctx = await context()
  const r = await visit(ctx, base + path, slow)
  await ctx.close()
  return r
}

// the next page of a visit: the home page first, then this one with the first one's cache
async function warm(base, path) {
  const ctx = await context()
  await visit(ctx, base + "/en", false)
  const r = await visit(ctx, base + path, false)
  await ctx.close()
  return r
}

const med = (runs) => Object.fromEntries(Object.keys(runs[0]).map((k) => [k, median(runs.map((r) => r[k]))]))
const repeat = async (n, f) => { const runs = []; for (let i = 0; i < n; i++) runs.push(await f()); return med(runs) }

const coldR = {}, warmR = {}, slowR = {}
for (const [name, base] of Object.entries(SITES)) {
  coldR[name] = {}; warmR[name] = {}; slowR[name] = {}
  for (const path of PAGES) {
    await cold(base, path, false) // warm the server
    coldR[name][path] = await repeat(RUNS, () => cold(base, path, false))
    if (path !== "/en") warmR[name][path] = await repeat(RUNS, () => warm(base, path))
    const c = coldR[name][path]
    process.stdout.write(`${name.padEnd(18)} ${path.padEnd(18)} FCP ${c.fcp.toFixed(0)} ms  interactive ${c.interactive.toFixed(0)} ms  ${(c.bytes / 1024).toFixed(0)} KB\n`)
  }
  for (const path of ["/en", "/en/architecture"]) {
    slowR[name][path] = await repeat(3, () => cold(base, path, true))
    process.stdout.write(`${name.padEnd(18)} ${path.padEnd(18)} slow 4G: FCP ${slowR[name][path].fcp.toFixed(0)} ms  LCP ${slowR[name][path].lcp.toFixed(0)} ms\n`)
  }
}
await b.close()

// the files as served (gzipped when the server compresses them)
const get = (url) => new Promise((res) => http.get(url, { headers: { "accept-encoding": "gzip" } }, (r) => {
  const chunks = []
  r.on("data", (c) => chunks.push(c))
  r.on("end", () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks) }))
}))
const files = {}
for (const [name, base] of Object.entries(SITES)) {
  let html = 0, htmlRaw = 0
  const assets = new Map()
  for (const path of PAGES) {
    const r = await get(base + path)
    html += r.body.length
    const raw = r.headers["content-encoding"] === "gzip" ? zlib.gunzipSync(r.body) : r.body
    htmlRaw += raw.length
    for (const m of raw.toString().matchAll(/(?:href|src)="(\/[^"]+\.(?:css|js)(?:\?[^"]*)?)"/g)) assets.set(m[1], true)
  }
  let css = 0, js = 0
  for (const a of assets.keys()) {
    const r = await get(base + a)
    if (r.status !== 200) continue
    if (/\.css/.test(a)) css += r.body.length; else js += r.body.length
  }
  // the program a Caju page's worker fetches (the browser's request log leaves out a worker's
  // requests): its size on a first visit, and on the next pages (a 304 when the server sends an
  // ETag; the whole file again otherwise)
  let wasm = 0, wasmAgain = 0
  const w = await get(base + "/__ui/app.wasm")
  if (w.status === 200) {
    wasm = w.body.length
    const tag = w.headers["etag"]
    const again = tag ? await new Promise((res) => http.get(base + "/__ui/app.wasm", { headers: { "accept-encoding": "gzip", "if-none-match": tag } }, (r) => { const c = []; r.on("data", (x) => c.push(x)); r.on("end", () => res({ status: r.statusCode, body: Buffer.concat(c) })) })) : w
    wasmAgain = again.status === 304 ? 0 : again.body.length
  }
  files[name] = { html, htmlRaw, css, js, wasm, wasmAgain }
}

// the servers: rendering /en, 32 at a time, with keep-alive
async function throughput(base, path, total = 3000, conc = 32) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: conc })
  const lat = []
  let done = 0
  const one = () => new Promise((res) => {
    const t0 = performance.now()
    http.get(base + path, { agent, headers: { "accept-encoding": "gzip" } }, (r) => { r.resume(); r.on("end", () => { lat.push(performance.now() - t0); res() }) })
  })
  const t0 = performance.now()
  await Promise.all(Array.from({ length: conc }, async () => { while (done < total) { done++; await one() } }))
  const secs = (performance.now() - t0) / 1000
  agent.destroy()
  lat.sort((a, b) => a - b)
  return { rps: total / secs, p50: lat[Math.floor(lat.length * 0.5)], p99: lat[Math.floor(lat.length * 0.99)] }
}
const rss = (port) => {
  try {
    const pid = execSync(`ss -ltnp | grep ':${port} ' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2`).toString().trim()
    const all = execSync(`ps -o rss= --ppid ${pid} -p ${pid}`).toString().trim().split(/\s+/).map(Number)
    return all.reduce((a, b) => a + b, 0) / 1024
  } catch { return NaN }
}
const server = {}
for (const [name, base] of Object.entries(SITES)) {
  await throughput(base, "/en", 300)
  server[name] = { ...(await throughput(base, "/en")), rss: rss(new URL(base).port) }
}

const fmt = (v, unit) => {
  if (v === undefined || Number.isNaN(v)) return "—"
  if (unit === "KB") return (v / 1024).toFixed(v < 10240 ? 1 : 0) + " KB"
  if (unit === "ms") return v.toFixed(0) + " ms"
  if (unit === "ms1") return v.toFixed(1) + " ms"
  if (unit === "MB") return v.toFixed(1) + " MB"
  if (unit === "MB0") return v.toFixed(0) + " MB"
  return String(Math.round(v))
}
const head = `| | ${names.join(" | ")} |\n|---|${names.map(() => "--:").join("|")}|\n`
const table = (rows, get) => head + rows.map(([label, k, unit]) => `| ${label} | ${names.map((n) => fmt(get(n, k), unit)).join(" | ")} |`).join("\n") + "\n"
const loadRows = [
  ["TTFB (first byte)", "ttfb", "ms"], ["First contentful paint", "fcp", "ms"], ["Largest contentful paint", "lcp", "ms"],
  ["DOMContentLoaded", "dcl", "ms"], ["load event", "load", "ms"], ["Interactive (a click answers; playground: compiler ready)", "interactive", "ms"],
  ["Main thread blocked (TBT)", "tbt", "ms"], ["Requests", "requests", ""], ["Transferred", "bytes", "KB"],
  ["  HTML", "html", "KB"], ["  CSS", "css", "KB"], ["  JavaScript", "js", "KB"], ["  WebAssembly", "wasm", "KB"], ["  Fonts", "font", "KB"],
  ["Page JS heap", "heap", "MB"], ["DOM nodes", "nodes", ""],
]
const sum = (R, n, k) => Object.values(R[n]).reduce((a, r) => a + r[k], 0)
const avg = (R, n, k) => sum(R, n, k) / Object.keys(R[n]).length

let md = `# cajulang site: performance, transfer and memory\n\n`
md += `${new Date().toISOString().slice(0, 10)} · headless Chromium · median of ${RUNS} loads · all servers local, production builds.\n\n`
md += `- **Next.js**: the original site (next start).\n- **Caju + Tailwind**: this site before caju style (Tailwind CSS 4, the earlier gzip, no caching headers).\n- **Caju + caju style**: this site (caju style with each page's sheet inlined, gzip with dynamic Huffman codes, ETag and immutable versioned files).\n\n`
md += `## All seven pages\n\n`
md += table([
  ["First visits: transferred, 7 pages (each with a cold cache)", "bytes", "KB"],
  ["First visits: requests, 7 pages", "requests", ""],
  ["First visits: first contentful paint, average", "fcp", "ms"],
  ["First visits: interactive, average", "interactive", "ms"],
  ["First visits: page JS heap, average", "heap", "MB"],
  ["Next pages after /en: transferred, 6 pages (warm cache)", "warmBytes", "KB"],
  ["Next pages after /en: requests, 6 pages", "warmRequests", ""],
  ["Next pages after /en: interactive, average", "warmInteractive", "ms"],
  ["HTML as served, 7 pages", "html", "KB"], ["HTML uncompressed, 7 pages", "htmlRaw", "KB"],
  ["CSS as served (all files)", "css", "KB"], ["JavaScript as served (the pages' scripts)", "js", "KB"],
  ["Program fetched by the worker (app.wasm), first visit", "wasm", "KB"], ["  the same on each next page", "wasmAgain", "KB"],
], (n, k) => ({
  bytes: () => sum(coldR, n, "bytes") + 7 * files[n].wasm, requests: () => sum(coldR, n, "requests") + (files[n].wasm ? 7 : 0), fcp: () => avg(coldR, n, "fcp"),
  interactive: () => avg(coldR, n, "interactive"), heap: () => avg(coldR, n, "heap"),
  warmBytes: () => sum(warmR, n, "bytes") + 6 * files[n].wasmAgain, warmRequests: () => sum(warmR, n, "requests") + (files[n].wasm ? 6 : 0), warmInteractive: () => avg(warmR, n, "interactive"),
}[k] || (() => files[n][k]))())
md += `\n## Slow 4G (150 ms, 1.6 Mbit/s), first visit\n\n`
for (const path of Object.keys(slowR[names[0]])) {
  md += `### ${path}\n\n` + table([["First contentful paint", "fcp", "ms"], ["Largest contentful paint", "lcp", "ms"], ["load event", "load", "ms"], ["Interactive", "interactive", "ms"], ["Transferred (with the worker's app.wasm)", "bytes", "KB"]], (n, k) => k === "bytes" ? slowR[n][path][k] + files[n].wasm : slowR[n][path][k]) + "\n"
}
md += `## Server (rendering /en, 32 concurrent, keep-alive, gzip, 3000 requests)\n\n`
md += table([["Pages per second", "rps", ""], ["Latency p50", "p50", "ms1"], ["Latency p99", "p99", "ms1"], ["Server memory (RSS)", "rss", "MB0"]], (n, k) => server[n][k])
for (const path of PAGES) {
  md += `\n## ${path}\n\nFirst visit (cold cache):\n\n` + table(loadRows, (n, k) => coldR[n][path][k])
  if (warmR[names[0]][path]) md += `\nAfter /en (warm cache):\n\n` + table(loadRows, (n, k) => warmR[n][path][k])
}
md += `\n## Notes\n\n- "Interactive" is when a click first works: React has hydrated (Next.js), or the program has loaded and hydrated in the worker (Caju). On the playground it is when the compiler is ready.\n- Caju's program (\`app.wasm\`) is fetched by its worker, whose requests the browser's log leaves out: the totals of "All seven pages" add it (measured on the server: gzipped, and on the next pages a 304 when there is an ETag), the per-page tables do not.\n- Measured with \`node tools/perf.mjs\`, all servers on the same machine (WSL2), one process each.\n`
console.log("\n" + md)
writeFileSync("PERF.md", md)
