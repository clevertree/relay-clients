/**
 * In-memory bridge for themed-styler usage.
 * Collected at runtime by web and RN HookRenderers via shared imports.
 */

import { parse as parseYAML } from 'yaml'

type Props = Record<string, any>
type HierNode = { tag: string; classes?: string[] }

const usage = {
  tags: new Set<string>(),
  classes: new Set<string>(),
  tagClasses: new Set<string>(), // encoded as `${tag}|${class}`
}

const themes: Record<string, Record<string, any>> = {}
let currentTheme: string | null = null

export function registerUsage(tag: string, props?: Props, hierarchy?: HierNode[]) {
  const cls = props ? ((props.className || props.class || '') as string) : ''
  const classes = typeof cls === 'string' && cls.trim().length
    ? cls.split(/\s+/).map((c) => c.trim()).filter(Boolean)
    : []

  if (tag) usage.tags.add(tag)
  for (const c of classes) {
    usage.classes.add(c)
    if (tag) usage.tagClasses.add(`${tag}|${c}`)
  }

  // hierarchy parameter is kept for API compatibility but not used for selector generation
}

export function clearUsage() {
  usage.tags.clear()
  usage.classes.clear()
  usage.tagClasses.clear()
}

export function getUsageSnapshot() {
  return {
    tags: Array.from(usage.tags.values()),
    classes: Array.from(usage.classes.values()),
    tagClasses: Array.from(usage.tagClasses.values()),
  }
}

export function registerTheme(name: string, defs?: Record<string, unknown>) {
  themes[name] = defs || {}
  if (!currentTheme) currentTheme = name
  // Expose current themes state globally for wasmEntry's theme list function
  if (typeof globalThis !== 'undefined') {
    ; (globalThis as any).__bridgeGetThemes = () => getThemes()
  }
}

export function setCurrentTheme(name: string) {
  currentTheme = name
  // Expose current themes state globally for wasmEntry's theme list function
  if (typeof globalThis !== 'undefined') {
    ; (globalThis as any).__bridgeGetThemes = () => getThemes()
  }
  // Trigger immediate CSS re-render in web by notifying styleManager lazily
  try {
    // Dynamic import avoids ESM circular dependency at module load
    // and is a no-op on RN where styleManager DOM APIs are not present.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    import('./styleManager').then((m) => {
      try { (m as any).requestRender && (m as any).requestRender() } catch { /* noop */ }
    }).catch(() => { /* ignore */ })
  } catch { /* ignore */ }
}

export function getThemes() { return { themes: { ...themes }, currentTheme } }

export function getThemeList(): Array<{ key: string; name: string }> {
  // If WASM is available, try to get theme list from it
  const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : {}
  if (typeof g.__themedStylerGetThemeList === 'function') {
    try {
      const themeListJson = g.__themedStylerGetThemeList()
      return JSON.parse(themeListJson || '[]')
    } catch (e) {
      console.warn('[themedStylerBridge] Failed to get theme list from WASM:', e)
    }
  }
  
  // Fallback: use in-memory themes registry
  return Object.keys(themes).map((key) => ({
    key,
    name: (themes[key] as any)?.name || key,
  }))
}

// Attempt to populate themes from theme.yaml file.
let _defaults_loaded = false
export async function ensureDefaultsLoaded(): Promise<void> {
  if (_defaults_loaded) return
  _defaults_loaded = true

  console.log('[themedStylerBridge] Loading themes from YAML...')

  try {
    // Fetch and parse the theme YAML file
    const response = await fetch(new URL('./theme.yaml', import.meta.url).href)
    if (!response.ok) {
      console.warn('[themedStylerBridge] Failed to fetch theme.yaml:', response.statusText)
      return
    }
    const yamlText = await response.text()
    const themeConfig = parseYAML(yamlText) as Record<string, unknown>

    if (!themeConfig || !themeConfig.themes) {
      console.warn('[themedStylerBridge] No themes found in theme.yaml')
      return
    }

    // Initialize WASM first (web only)
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        // @ts-ignore - web-only dynamic import
        const shim = await import('/src/wasm/themed_styler.js')
        console.log('[themedStylerBridge] Loaded WASM shim')

        if (typeof (shim as Record<string, unknown>).get_version === 'function') {
          try {
            const getVersion = (shim as Record<string, unknown>).get_version as () => unknown
            const wasmVersion = String(getVersion())
            console.log('[themedStylerBridge] WASM Cargo version:', wasmVersion)
          } catch (e) {
            console.warn('[themedStylerBridge] Could not get WASM version:', e)
          }
        }

        // Initialize WASM
        if (shim && typeof (shim as Record<string, unknown>).default === 'function') {
          try {
            console.log('[themedStylerBridge] Initializing WASM...')
            const initFn = (shim as Record<string, unknown>).default as () => Promise<void>
            await initFn()
          } catch (e) {
            console.log('[themedStylerBridge] WASM already initialized')
          }
        }

        // Get initial empty state
        let state: Record<string, unknown> = {}
        if (typeof (shim as Record<string, unknown>).get_default_state_json === 'function') {
          try {
            const getStateFn = (shim as Record<string, unknown>).get_default_state_json as () => unknown
            const stateJson = String(getStateFn())
            state = JSON.parse(stateJson || '{}')
          } catch (e) {
            console.warn('[themedStylerBridge] Could not get initial state:', e)
          }
        }

        // Register each theme from YAML using the new register_theme_json function
        const registerThemeJsonFn = (shim as Record<string, unknown>).register_theme_json as ((state: string, payload: string) => string) | undefined
        const setThemeJsonFn = (shim as Record<string, unknown>).set_theme_json as ((state: string, theme: string) => string) | undefined

        if (typeof registerThemeJsonFn !== 'function') {
          console.warn('[themedStylerBridge] register_theme_json not found in WASM')
          return
        }

        let currentState = JSON.stringify(state)

        for (const [themeName, themeData] of Object.entries((themeConfig.themes as Record<string, unknown>) || {})) {
          try {
            const themePayload = {
              name: themeName,
              theme: themeData,
            }
            currentState = String(registerThemeJsonFn(currentState, JSON.stringify(themePayload)))
            console.log(`[themedStylerBridge] Registered theme: ${themeName}`)
          } catch (e) {
            console.error(`[themedStylerBridge] Failed to register theme "${themeName}":`, e)
          }
        }

        // Set default theme
        if (themeConfig.default_theme && typeof setThemeJsonFn === 'function') {
          try {
            currentState = String(setThemeJsonFn(currentState, themeConfig.default_theme as string))
            console.log(`[themedStylerBridge] Set default theme: ${themeConfig.default_theme}`)
          } catch (e) {
            console.warn('[themedStylerBridge] Could not set default theme:', e)
          }
        }

        // Parse and register with bridge
        const parsedState = JSON.parse(currentState || '{}') as Record<string, unknown>
        if (parsedState && parsedState.themes) {
          console.log('[themedStylerBridge] Successfully loaded themes:', Object.keys(parsedState.themes as Record<string, unknown>))
          for (const [k, v] of Object.entries(parsedState.themes as Record<string, unknown>)) {
            registerTheme(k, v as Record<string, unknown>)
          }
          if (parsedState.current_theme) setCurrentTheme(parsedState.current_theme as string)
        }
      } catch (e) {
        console.warn('[themedStylerBridge] WASM initialization skipped (likely React Native):', e)
      }
    }
  } catch (e) {
    console.error('[themedStylerBridge] ensureDefaultsLoaded failed:', e)
  }
}

// Placeholder: in future this should call into the themed-styler binary or runtime
export function getCssForWeb(): string {
  // If platform provides a hook, call it
  const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : {}
  if (typeof g.__themedStylerRenderCss === 'function') {
    try { return g.__themedStylerRenderCss(getUsageSnapshot(), getThemes()) } catch (e) { }
  }
  // If running under Node, attempt to call the hook-transpiler CLI to compute CSS
  if ((globalThis as any) && (globalThis as any).process && (globalThis as any).process.versions && (globalThis as any).process.versions.node) {
    try {
      // Use temp file for state JSON
      const _req: any = (globalThis as any).require ? (globalThis as any).require : (eval('require') as any)
      const fs = _req('fs')
      const os = _req('os')
      const cp = _req('child_process')
      const path = _req('path')
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'themed-styler-'))
      const statePath = path.join(tmp, 'state.json')
      const snap = getUsageSnapshot()
      fs.writeFileSync(statePath, JSON.stringify({ themes: getThemes().themes, default_theme: getThemes().currentTheme, current_theme: getThemes().currentTheme, variables: {}, breakpoints: {}, used_tags: snap.tags, used_classes: snap.classes, used_tag_classes: snap.tagClasses }, null, 2))
      // Run cargo run -p hook-transpiler -- style css --file <statePath>
      const repoRoot = path.resolve(((globalThis as any).process && (globalThis as any).process.cwd && (globalThis as any).process.cwd()) || '.')
      const out = cp.execFileSync('cargo', ['run', '--silent', '-p', 'hook-transpiler', '--', 'style', 'css', '--file', statePath], { cwd: repoRoot, encoding: 'utf8' })
      try { fs.rmSync(tmp, { recursive: true, force: true }) } catch (e) { }
      return String(out || '')
    } catch (e) {
      // swallow and fallback to placeholder
    }
  }

  const snap = getUsageSnapshot()
  return `/* themed-styler fallback (no renderer):\nclasses=${JSON.stringify(snap.classes)}\ntags=${JSON.stringify(snap.tags)}\ntagClasses=${JSON.stringify(snap.tagClasses)}\n*/`
}

// RN accessor: placeholder returns empty style object. Later will query real runtime state.
export function getRnStyles(selector: string, classes: string[] = []) {
  // Attempt to call a provided hook if present
  const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : {}
  if (typeof g.__themedStylerGetRn === 'function') {
    const themesState = getThemes()
    try { return g.__themedStylerGetRn(selector, classes, themesState) } catch (e) { }
  }
  return {}
}

export default {
  registerUsage,
  clearUsage,
  getUsageSnapshot,
  registerTheme,
  setCurrentTheme,
  getThemes,
  getThemeList,
  getCssForWeb,
  getRnStyles,
}
