// The playground's worker: loads the Caju compiler (WebAssembly, from the release, in /caju/),
// compiles the program and runs it, sending the output as it comes. The page stops a program by
// terminating this worker.
import { loadCaju } from "/caju/caju-browser.mjs"

const dec = new TextDecoder()
let caju = null
const ready = (async () => {
  const [wasm, files] = await Promise.all([fetch("/caju/caju.wasm"), fetch("/caju/caju-files.json").then((r) => r.json())])
  caju = await loadCaju({ wasm, files })
  postMessage({ type: "ready" })
})().catch((e) => postMessage({ type: "fatal", message: String(e && e.message ? e.message : e) }))

// output in batches (one message per write would flood the page)
let buf = ""
let sent = 0
const LIMIT = 1 << 20
let last = 0
// (the program runs without yielding: timers would only fire at the end, so the time is checked here)
const flush = () => {
  last = performance.now()
  if (buf) postMessage({ type: "out", text: buf })
  buf = ""
}
const write = (bytes) => {
  if (sent > LIMIT) return
  const t = dec.decode(bytes, { stream: true })
  sent += t.length
  buf += sent > LIMIT ? t + "\n… (output cut at 1 MB)\n" : t
  if (buf.length > 16384 || performance.now() - last > 50) flush()
}

onmessage = async (e) => {
  const msg = e.data
  if (msg.type !== "run") return
  await ready
  if (!caju) return
  // main.caju and the other files of the program (imported with import "name")
  const files = msg.files || { "main.caju": msg.source }
  const others = {}
  for (const [name, text] of Object.entries(files)) if (name !== "main.caju") others[name] = text
  const c = await caju.compile(files["main.caju"] ?? "", { others })
  postMessage({ type: "compiled", ok: c.ok, errors: c.errors, ms: c.ms })
  if (!c.ok) return
  const t0 = performance.now()
  sent = 0
  last = t0
  let code = 0
  try {
    code = await caju.run(c.wasm, { stdout: write, stderr: write })
  } catch (err) {
    flush()
    const m = String(err && err.message ? err.message : err)
    postMessage({ type: "out", text: /stack|recursion/i.test(m) ? "Runtime error: the program used too much stack.\n" : "Runtime error: " + m + "\n" })
    code = 2
  }
  // the program may write without a line break: flush what is left
  flush()
  postMessage({ type: "exit", code, ms: performance.now() - t0 })
}
