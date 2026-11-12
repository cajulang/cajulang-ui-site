// Loading performance of the original site (Next.js, next start) and this one (Caju: ui + web),
// measured the same way in the same headless Chromium, plus the servers' throughput and memory.
//   node tools/perf.mjs [--runs 7]
import { chromium } from "playwright"
import http from "node:http"
import { execSync } from "node:child_process"

const RUNS = Number(process.argv[process.argv.indexOf("--runs") + 1]) || 7
const SITES = { "Next.js (original)": "http://127.0.0.1:3400", "Caju (ui + web)": "http://127.0.0.1:3500" }
const PAGES = ["/en", "/en/examples", "/en/spec", "/en/playground"]
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

const b = await chromium.launch()

async function load(base, path) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"])
  let bytes = 0, requests = 0, js = 0, wasm = 0
  ctx.on("requestfinished", async (r) => {
    const s = await r.sizes().catch(() => null)
    if (!s) return
    // a body compiled while streaming (WebAssembly.compileStreaming) reports 0: use Content-Length
    const res = await r.response().catch(() => null)
    const len = Number((res && res.headers()["content-length"]) || 0)
    if (s.responseBodySize === 0 && len > 0) s.responseBodySize = len
    const n = s.responseBodySize + s.responseHeadersSize
    bytes += n; requests++
    const u = r.url()
    if (/\.m?js(\?|$)/.test(u)) js += s.responseBodySize
    if (/\.wasm(\?|$)/.test(u)) wasm += s.responseBodySize
  })
  await ctx.addInitScript(() => {
    window.__perf = { lcp: 0, tbt: 0, long: 0 }
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime }).observe({ type: "largest-contentful-paint", buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__perf.long++; window.__perf.tbt += Math.max(0, e.duration - 50) } }).observe({ type: "longtask", buffered: true })
  })
  const p = await ctx.newPage()
  await p.goto(base + path, { waitUntil: "load" })
  // interactive: the first copy button answers a click (its label becomes "Copied")
  const interactive = await p.evaluate(async () => {
    // the playground: the compiler is ready (the Run button is enabled)
    if (location.pathname.endsWith("/playground")) {
      for (;;) {
        const run = [...document.querySelectorAll("button")].find((b) => !b.disabled && /^(Run)$/.test(b.textContent.trim()))
        if (run) return performance.now()
        await new Promise((r) => setTimeout(r, 5))
        if (performance.now() > 20000) return -1
      }
    }
    const btn = document.querySelector('button[aria-label^="Copy"]') || document.querySelector('button[aria-label="Language"]')
    const before = btn.getAttribute("aria-label")
    for (;;) {
      btn.click()
      await new Promise((r) => setTimeout(r, 5))
      const now = document.querySelector('button[aria-label^="Copied"]') || (btn.getAttribute("aria-expanded") === "true" ? btn : null)
      if (now || btn.getAttribute("aria-label") !== before) return performance.now()
      if (performance.now() > 20000) return -1
    }
  })
  await p.waitForTimeout(500)
  const m = await p.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0]
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]
    return { ttfb: n.responseStart, fcp: fcp ? fcp.startTime : 0, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, html: n.encodedBodySize, ...window.__perf }
  })
  const cdp = await ctx.newCDPSession(p)
  await cdp.send("Performance.enable")
  const metrics = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]))
  await ctx.close()
  return { ...m, interactive, bytes, requests, js, wasm, heap: metrics.JSHeapUsedSize / 1048576, nodes: metrics.Nodes }
}

const results = {}
for (const [name, base] of Object.entries(SITES)) {
  results[name] = {}
  for (const path of PAGES) {
    await load(base, path) // warm the server
    const runs = []
    for (let i = 0; i < RUNS; i++) runs.push(await load(base, path))
    results[name][path] = Object.fromEntries(Object.keys(runs[0]).map((k) => [k, median(runs.map((r) => r[k]))]))
    process.stdout.write(`${name.padEnd(20)} ${path.padEnd(16)} FCP ${results[name][path].fcp.toFixed(0)} ms  interactive ${results[name][path].interactive.toFixed(0)} ms\n`)
  }
}
await b.close()

// the servers: rendering /en, 32 at a time, with keep-alive
async function throughput(base, path, total = 3000, conc = 32) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: conc })
  const lat = []
  let done = 0
  const one = () => new Promise((res) => {
    const t0 = performance.now()
    http.get(base + path, { agent }, (r) => { r.resume(); r.on("end", () => { lat.push(performance.now() - t0); res() }) })
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

const names = Object.keys(SITES)
const rows = [
  ["TTFB (first byte)", "ttfb", "ms"], ["First contentful paint", "fcp", "ms"], ["Largest contentful paint", "lcp", "ms"],
  ["DOMContentLoaded", "dcl", "ms"], ["load event", "load", "ms"], ["Interactive (a click answers; playground: compiler ready)", "interactive", "ms"],
  ["Main thread blocked (TBT)", "tbt", "ms"], ["Requests", "requests", ""], ["Transferred", "bytes", "KB"],
  ["  JavaScript", "js", "KB"], ["  WebAssembly", "wasm", "KB"], ["  HTML document", "html", "KB"],
  ["Page JS heap", "heap", "MB"], ["DOM nodes", "nodes", ""],
]
const fmt = (v, unit) => unit === "KB" ? (v / 1024).toFixed(0) + " KB" : unit === "ms" ? v.toFixed(0) + " ms" : unit === "MB" ? v.toFixed(1) + " MB" : String(Math.round(v))
let md = `# cajulang site: Next.js vs Caju\n\n${new Date().toISOString().slice(0, 10)} · headless Chromium, cold cache (a new browser context per load), median of ${RUNS} loads · both servers local, production builds (next start / caju-ui build)\n`
for (const path of PAGES) {
  md += `\n## ${path}\n\n| | ${names.join(" | ")} |\n|---|--:|--:|\n`
  for (const [label, k, unit] of rows) md += `| ${label} | ${names.map((n) => fmt(results[n][path][k], unit)).join(" | ")} |\n`
}
md += `\n## Server (rendering /en, 32 concurrent, keep-alive, 3000 requests)\n\n| | ${names.join(" | ")} |\n|---|--:|--:|\n`
md += `| Pages per second | ${names.map((n) => server[n].rps.toFixed(0)).join(" | ")} |\n`
md += `| Latency p50 | ${names.map((n) => server[n].p50.toFixed(1) + " ms").join(" | ")} |\n`
md += `| Latency p99 | ${names.map((n) => server[n].p99.toFixed(1) + " ms").join(" | ")} |\n`
md += `| Server memory (RSS) | ${names.map((n) => server[n].rss.toFixed(0) + " MB").join(" | ")} |\n`
console.log("\n" + md)
import("node:fs").then((fs) => fs.writeFileSync("PERF.md", md))
