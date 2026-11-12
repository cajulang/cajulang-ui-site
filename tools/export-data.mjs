// Writes data/*.json from the original site (cajulang-site): the dictionaries of the four languages
// and the content (examples, benchmarks, architecture, MCP), so the Caju site shows exactly the
// same text. node --experimental-strip-types tools/export-data.mjs [cajulang-site dir]
import { mkdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const site = process.argv[2] || join(here, "../../cajulang-site")
const load = (p) => import(pathToFileURL(join(site, "src", p)).href)
const out = join(here, "../data")
mkdirSync(out, { recursive: true })
const write = (name, v) => writeFileSync(join(out, name), JSON.stringify(v))

for (const l of ["en", "pt", "es", "zh"]) write(`dict-${l}.json`, (await load(`i18n/dictionaries/${l}.ts`))[l])

const { site: info } = await load("lib/site.ts")
const ex = await load("content/examples.ts")
const bench = await load("content/benchmarks.ts")
const arch = await load("content/architecture.ts")
const mcp = await load("content/mcp.ts")
const strip = (m) => Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v !== "function"))
write("content.json", { site: info, examples: strip(ex), bench: strip(bench), arch: strip(arch), mcp: strip(mcp) })
console.log("data/: dict-{en,pt,es,zh}.json, content.json")
