// Compares the Caju site with the original, page by page: screenshots (the share of pixels that
// differ) and the visible text. Both must be running:
//   original (cajulang-site): npx next start -p 3400      this site: PORT=3500 ./server
//   node tools/compare.mjs [page ...] [--lang pt] [--mobile] [--full] [--out dir]
import { chromium } from "playwright"
import { mkdirSync, writeFileSync } from "node:fs"

const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)
const pages = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && ["--lang", "--out", "--theme"].includes(args[i - 1])))
const PAGES = pages.length ? pages : ["", "examples", "spec", "mcp", "architecture", "brand", "playground"]
const LANGS = opt("--lang", "en,pt,es,zh").split(",")
const OUT = opt("--out", ".ref/shots")
const theme = opt("--theme", "light")
mkdirSync(OUT, { recursive: true })
const A = "http://127.0.0.1:3400", B = "http://127.0.0.1:3500"
const viewport = flag("--mobile") ? { width: 390, height: 844 } : { width: 1280, height: 900 }

const b = await chromium.launch()
const ctx = await b.newContext({ viewport, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: "reduce" })
const shoot = async (url) => {
  const p = await ctx.newPage()
  await p.goto(url, { waitUntil: "load" })
  await p.evaluate(() => document.fonts.ready)
  await p.waitForTimeout(1200)
  const text = await p.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim())
  const height = await p.evaluate(() => document.documentElement.scrollHeight)
  const png = await p.screenshot({ fullPage: flag_full, animations: "disabled" })
  await p.close()
  return { png, text, height }
}
const flag_full = flag("--full")
const diff = async (a, b) => {
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
    return { pct: (100 * n) / (w * h), size: `${x.width}x${x.height} vs ${y.width}x${y.height}` }
  }, [a.toString("base64"), b.toString("base64")])
  await p.close()
  return r
}
const firstDiff = (a, b) => {
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  return i >= a.length && a.length === b.length ? null : { at: i, original: a.slice(Math.max(0, i - 60), i + 100), caju: b.slice(Math.max(0, i - 60), i + 100) }
}
for (const lang of LANGS) {
  for (const page of PAGES) {
    const path = `/${lang}${page ? "/" + page : ""}`
    const [x, y] = [await shoot(A + path), await shoot(B + path)]
    const d = await diff(x.png, y.png)
    const name = (lang + "_" + (page || "home") + (flag("--mobile") ? "_m" : ""))
    writeFileSync(`${OUT}/${name}.orig.png`, x.png)
    writeFileSync(`${OUT}/${name}.caju.png`, y.png)
    const td = firstDiff(x.text, y.text)
    console.log(`${path.padEnd(18)} pixels ${d.pct.toFixed(2).padStart(6)}%  height ${x.height}/${y.height}  text ${td ? "DIFFERS at " + td.at : "same"}`)
    if (td && flag("--text")) console.log("   original:", JSON.stringify(td.original), "\n   caju:    ", JSON.stringify(td.caju))
  }
}
await b.close()
