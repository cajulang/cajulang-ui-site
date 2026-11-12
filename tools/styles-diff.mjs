// Compares the computed style of every element of a page on the original site and on this one,
// in document order, and prints the properties that differ (to chase a pixel difference).
//   node tools/styles-diff.mjs /en/playground [--dark] [--mobile]
import { chromium } from "playwright"
const path = process.argv[2] || "/en"
const dark = process.argv.includes("--dark"), mobile = process.argv.includes("--mobile")
const b = await chromium.launch()
const grab = async (url) => {
  const ctx = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, colorScheme: dark ? "dark" : "light" })
  const p = await ctx.newPage()
  await p.goto(url, { waitUntil: "load" })
  await p.waitForTimeout(1500)
  const r = await p.evaluate(() => {
    const out = []
    for (const el of document.body.querySelectorAll("*")) {
      if (el.closest("script,style,noscript")) continue
      const cs = getComputedStyle(el), o = {}
      for (const k of cs) o[k] = cs.getPropertyValue(k)
      for (const pe of ["::before", "::after", "::marker"]) {
        const ps = getComputedStyle(el, pe)
        o[pe + " content"] = ps.content
      }
      const name = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + " " + (el.textContent || "").trim().slice(0, 30)
      out.push([name, o])
    }
    return out
  })
  await ctx.close()
  return r
}
const [x, y] = [await grab("http://127.0.0.1:3400" + path), await grab("http://127.0.0.1:3500" + path)]
console.log("elements", x.length, y.length)
const count = {}
let shown = 0
const tag = (n) => n.split(" ")[0].replace(/#.*/, "")
for (let i = 0, j = 0; i < x.length && j < y.length; i++, j++) {
  // the documents differ a little (the original's hidden helpers): keep them aligned by tag
  if (x[i][0] !== y[j][0]) {
    if (j + 1 < y.length && x[i][0] === y[j + 1][0]) j++
    else if (i + 1 < x.length && x[i + 1][0] === y[j][0]) i++
    else if (tag(x[i][0]) !== tag(y[j][0])) continue
  }
  for (const k in x[i][1]) {
    if (k.startsWith("--")) continue
    if (x[i][1][k] !== y[j][1][k]) {
      count[k] = (count[k] || 0) + 1
      if (shown < 40) { shown++; console.log(i, x[i][0], "|", k, ":", JSON.stringify(x[i][1][k]), "->", JSON.stringify(y[j][1][k])) }
    }
  }
}
console.log(count)
await b.close()
