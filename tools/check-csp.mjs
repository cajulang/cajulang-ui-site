// Checks that every inline script of the exported pages (out/**/*.html) is allowed by the
// Content-Security-Policy (by its SHA-256) of vercel.json, deploy/vercel.json and server.cajux,
// and that the three policies are the same. Run by tools/export.sh: a change to an inline script
// (the theme's, ui's window.__UI__) fails the build instead of breaking the site.
//   node tools/check-csp.mjs [out]
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const out = path.resolve(process.argv[2] ?? path.join(root, "out"))

const fromVercel = (file) => {
  const conf = JSON.parse(fs.readFileSync(file, "utf8"))
  for (const h of conf.headers ?? []) for (const x of h.headers) if (x.key === "Content-Security-Policy") return x.value
  throw new Error(`${file}: no Content-Security-Policy`)
}
const server = fs.readFileSync(path.join(root, "server.cajux"), "utf8").match(/^const CSP = "(.*)"$/m)
if (!server) throw new Error("server.cajux: no const CSP")
const policies = {
  "vercel.json": fromVercel(path.join(root, "vercel.json")),
  "deploy/vercel.json": fromVercel(path.join(root, "deploy", "vercel.json")),
  "server.cajux": server[1],
}
const csp = policies["vercel.json"]
for (const [name, p] of Object.entries(policies)) if (p !== csp) throw new Error(`${name}: the Content-Security-Policy differs from vercel.json's`)

const pages = fs.readdirSync(out, { recursive: true }).filter((f) => f.endsWith(".html"))
const missing = new Set()
let n = 0
for (const f of pages) {
  const html = fs.readFileSync(path.join(out, f), "utf8")
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(attrs) || /type="application\/json"/.test(attrs)) continue
    n++
    const h = `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`
    if (!csp.includes(h)) missing.add(`${h} (${f})`)
  }
}
if (missing.size) {
  console.error(`check-csp: inline scripts not allowed by the Content-Security-Policy:\n  ${[...missing].join("\n  ")}`)
  process.exit(1)
}
console.log(`check-csp: ${n} inline scripts in ${pages.length} pages, all allowed`)
