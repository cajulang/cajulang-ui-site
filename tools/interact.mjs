// The same clicks on both sites, comparing the screen after each step (see compare.mjs).
import { chromium } from "playwright"
const A = "http://127.0.0.1:3400", B = "http://127.0.0.1:3500"
const b = await chromium.launch()

const flows = [
  ["home: copy, theme, language menu", "/en", { width: 1280, height: 900 }, [
    ["copy install command", (p) => p.click('button[aria-label="Copy install command"]'), 300],
    ["theme: dark", (p) => p.click('nav[aria-label="Main"] button[aria-label^="Use dark"]'), 400],
    ["language menu open", (p) => p.click('nav[aria-label="Main"] button[aria-label="Language"]'), 400],
    ["pick Português", (p) => p.click('a[hreflang="pt-BR"]:visible'), 1500],
  ]],
  ["mobile: menu", "/en", { width: 390, height: 844 }, [
    ["sheet open", (p) => p.click('button[aria-label="Open menu"]'), 600],
    ["go to examples", (p) => p.click('[role=dialog] a[href="/en/examples"]'), 1500],
  ]],
  ["mcp: demo and tools", "/en/mcp#demo-h", { width: 1280, height: 900 }, [
    ["next ×3", async (p) => { for (let i = 0; i < 3; i++) await p.click("button:has-text('Next')") }, 400],
    ["tool caju_run", (p) => p.click("button[role=tab]:has-text('caju_run')"), 300],
  ]],
  ["architecture: pipeline, values, gc", "/en/architecture#pipeline", { width: 1280, height: 900 }, [
    ["stage Checker", (p) => p.click("button[aria-pressed]:has-text('Checker')"), 300],
    ["stage Codegen + wasm", async (p) => { await p.click("button[aria-pressed]:has-text('Code generator')"); await p.click("button[role=tab]:has-text('WebAssembly')") }, 300],
    ["values: map", async (p) => { await p.locator("#values").scrollIntoViewIfNeeded(); await p.click("#values button[role=tab]:has-text('Map')") }, 300],
    ["gc: mark", async (p) => { await p.locator("#gc").scrollIntoViewIfNeeded(); await p.click("#gc button:has-text('Mark')") }, 3500],
    ["gc: sweep", (p) => p.click("#gc button:has-text('Sweep')"), 600],
    ["gc: reset + drop", async (p) => { await p.click("#gc button:has-text('Reset')"); await p.click("#gc button:nth-child(3)") }, 600],
  ]],
  ["playground: example, run, files", "/en/playground", { width: 1280, height: 900 }, [
    ["ready", (p) => p.waitForFunction(() => [...document.querySelectorAll("button")].some((x) => x.textContent.trim() === "Run" && !x.disabled)), 200],
    ["example: several files", (p) => p.selectOption("select", "multi"), 400],
    ["run", async (p) => { await p.click("button:has-text('Run')"); await p.waitForFunction(() => document.querySelector("[role=log]").textContent.includes("distance")) }, 300],
    ["add file", async (p) => { await p.click('button[aria-label="New file"]'); await p.fill("form input", "util"); await p.press("form input", "Enter") }, 400],
    ["type in the editor", async (p) => { await p.click("textarea"); await p.keyboard.press("End"); await p.keyboard.type("\nexport fn two() -> int { return 2 }") }, 400],
  ]],
]

const shot = (p) => p.screenshot({ animations: "disabled" })
const diff = async (ctx, a, b) => {
  const p = await ctx.newPage()
  const r = await p.evaluate(async ([a, b]) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = "data:image/png;base64," + s })
    const [x, y] = await Promise.all([load(a), load(b)])
    const w = Math.min(x.width, y.width), h = Math.min(x.height, y.height)
    const c = new OffscreenCanvas(w, h), g = c.getContext("2d")
    g.drawImage(x, 0, 0); const da = g.getImageData(0, 0, w, h).data
    g.clearRect(0, 0, w, h); g.drawImage(y, 0, 0); const db = g.getImageData(0, 0, w, h).data
    let n = 0
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 40) n++
    return (100 * n) / (w * h)
  }, [a.toString("base64"), b.toString("base64")])
  await p.close()
  return r
}

for (const [name, path, viewport, steps] of flows) {
  console.log("# " + name)
  const ctxs = [await b.newContext({ viewport, colorScheme: "light", reducedMotion: "reduce" }), await b.newContext({ viewport, colorScheme: "light", reducedMotion: "reduce" })]
  await Promise.all(ctxs.map((c) => c.grantPermissions(["clipboard-read", "clipboard-write"])))
  const pages = [await ctxs[0].newPage(), await ctxs[1].newPage()]
  await pages[0].goto(A + path); await pages[1].goto(B + path)
  await Promise.all(pages.map((p) => p.waitForTimeout(1500)))
  for (const [label, act, wait] of steps) {
    const res = []
    for (const p of pages) {
      try { await act(p); await p.waitForTimeout(wait); res.push(await shot(p)) } catch (e) { res.push(null); console.log("   ", p === pages[0] ? "original" : "caju", "failed:", e.message.split("\n")[0]) }
    }
    if (res[0] && res[1]) console.log(`   ${label.padEnd(28)} ${(await diff(ctxs[0], res[0], res[1])).toFixed(2)}%   ${pages[0].url().replace(A, "")} | ${pages[1].url().replace(B, "")}`)
  }
  await Promise.all(ctxs.map((c) => c.close()))
}
await b.close()
