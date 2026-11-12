// The page side of the site: what only the page can do (the theme on <html>, storage, history,
// cookies, the playground's compiler worker), as functions the Caju program calls with ui.call,
// and small behaviors of the playground's editor. The theme logic is next-themes' (the original
// site's): class "light"/"dark" on <html>, localStorage "theme", "system" by default.
(() => {
  const root = document.documentElement
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  const stored = () => { try { return localStorage.getItem("theme") || "system" } catch { return "system" } }
  const apply = (t) => {
    const resolved = t === "system" ? (media.matches ? "dark" : "light") : t
    // disableTransitionOnChange
    const css = document.createElement("style")
    css.appendChild(document.createTextNode("*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"))
    document.head.appendChild(css)
    root.classList.remove("light", "dark")
    root.classList.add(resolved)
    root.style.colorScheme = resolved
    window.getComputedStyle(document.body)
    setTimeout(() => document.head.removeChild(css), 1)
    return resolved
  }
  media.addEventListener("change", () => { if (stored() === "system") apply("system") })

  let worker = null
  window.__UI_FNS__ = {
    theme: () => (root.classList.contains("dark") ? "dark" : "light"),
    setTheme: (t) => { try { localStorage.setItem("theme", t) } catch {} apply(t) },
    storageGet: (key) => { try { return localStorage.getItem(key) ?? "" } catch { return "" } },
    storageSet: (kv) => { const i = kv.indexOf("\n"); try { localStorage.setItem(kv.slice(0, i), kv.slice(i + 1)) } catch {} },
    location: () => location.origin + location.pathname + "\n" + location.hash,
    replaceUrl: (url) => { history.replaceState(null, "", url) },
    copy: (text) => navigator.clipboard.writeText(text).then(() => "ok", () => "no"),
    // the playground's worker (the Caju compiler in WebAssembly): every message comes back as JSON
    pgStart: (_, reply) => {
      if (worker) worker.terminate()
      worker = new Worker("/playground-worker.mjs", { type: "module" })
      worker.onmessage = (e) => reply(JSON.stringify(e.data))
      worker.onerror = () => reply(JSON.stringify({ type: "fatal", message: "" }))
    },
    pgRun: (files) => { if (worker) worker.postMessage({ type: "run", files: JSON.parse(files) }) },
  }

  // the language menu remembers the choice (the server reads the cookie for "/")
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("[data-set-locale]")
    if (a) document.cookie = `NEXT_LOCALE=${a.dataset.setLocale}; path=/; max-age=31536000; samesite=lax`
  }, true)

  // the playground's editor: a textarea over a highlighted copy of its text
  document.addEventListener("scroll", (e) => {
    const ta = e.target
    if (!ta.dataset || ta.dataset.editor === undefined) return
    const pre = ta.previousElementSibling
    if (pre) { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft }
    const gutter = ta.parentElement && ta.parentElement.previousElementSibling
    if (gutter) gutter.scrollTop = ta.scrollTop
  }, true)
  document.addEventListener("keydown", (e) => {
    const ta = e.target
    if (!ta.dataset || ta.dataset.editor === undefined) return
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault()
      ta.dispatchEvent(new CustomEvent("cajurun"))
      return
    }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault()
      const s = ta.selectionStart
      ta.value = ta.value.slice(0, s) + "  " + ta.value.slice(ta.selectionEnd)
      ta.setSelectionRange(s + 2, s + 2)
      ta.dispatchEvent(new Event("input", { bubbles: true }))
    }
  }, true)
  // output panes follow what is written to them
  new MutationObserver(() => {
    for (const el of document.querySelectorAll("[data-autoscroll]")) el.scrollTop = el.scrollHeight
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true })
})()
