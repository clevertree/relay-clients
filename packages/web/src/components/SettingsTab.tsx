import { useCallback, useEffect, useMemo, useState } from 'react'
import { styleManager, unifiedBridge } from '@clevertree/relay-client-shared'
import { useTranspilerSetting } from '../state/transpilerSettings'
import { TSDiv } from './TSDiv'

export function SettingsTab() {
  const { setting, setSetting } = useTranspilerSetting()

  // Compute description based on two modes only
  const selectedDescription = useMemo(() => {
    if (setting === 'server-only')
      return 'Always use the server /api/transpile endpoint for hooks. Useful for environments where WASM is unavailable.'
    return 'Use the WASM hook transpiler that ships with the web app. Syntax errors are reported directly from the client.'
  }, [setting])

  // classes inspector
  const [search, setSearch] = useState('')
  const [classes, setClasses] = useState<string[]>([])
  const [stylerStatus, setStylerStatus] = useState({
    styleTag: false,
    selectors: 0,
    classes: 0,
    cssPreview: '',
  })

  const collectActiveClasses = () => {
    const set = new Set<string>()
    try {
      const all = document.body.querySelectorAll('*')
      all.forEach((el) => {
        const cls = (el as HTMLElement).className || ''
        if (typeof cls === 'string' && cls.length) {
          cls
            .split(/\s+/)
            .map((c) => c.trim())
            .filter(Boolean)
            .forEach((c) => set.add(c))
        }
      })
    } catch { }
    return Array.from(set).sort()
  }

  const refreshClasses = () => setClasses(collectActiveClasses())
  const refreshStylerStatus = useCallback(() => {
    try {
      const snapshot = unifiedBridge.getUsageSnapshot()
      const tag = document.querySelector('style[data-themed-styler]')
      let preview = tag?.textContent?.trim() || ''
      if (preview.length > 300) {
        preview = `${preview.slice(0, 300)}...`
      }
      setStylerStatus({
        styleTag: !!tag,
        selectors: snapshot.selectors.length,
        classes: snapshot.classes.length,
        cssPreview: preview,
      })
    } catch (e) {
      setStylerStatus((prev) => ({ ...prev, cssPreview: `Error: ${(e as Error)?.message || String(e)}` }))
    }
  }, [])

  useEffect(() => {
    refreshClasses()
    // Optional: observe DOM changes to keep list updated
    const obs = new MutationObserver(() => {
      // lightweight throttle by requestAnimationFrame
      requestAnimationFrame(() => refreshClasses())
    })
    obs.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    refreshStylerStatus()
    const unsub = styleManager.onChange ? styleManager.onChange(refreshStylerStatus) : () => { }
    return () => unsub()
  }, [refreshStylerStatus])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return classes
    return classes.filter((c) => c.toLowerCase().includes(q))
  }, [classes, search])

  const isServer = setting === 'server-only'

  return (
    <TSDiv className="flex-1 overflow-y-auto p-6 space-y-6">
      <TSDiv>
        <TSDiv tag="h1" className="text-2xl font-semibold text-gray-900">Relay settings</TSDiv>
        <TSDiv tag="p" className="text-sm text-gray-500 mt-1">Control how hooks are transpiled.</TSDiv>
      </TSDiv>

      <TSDiv tag="section" className="bg-[var(--bg-surface)] border rounded-lg shadow-sm p-6 space-y-4">
        <TSDiv className="flex items-center justify-between">
          <TSDiv>
            <TSDiv tag="h2" className="text-lg font-semibold text-gray-900">Transpiler</TSDiv>
            <TSDiv tag="p" className="text-sm text-gray-500">Choose between client-side (WASM) and server-side transpilation.</TSDiv>
          </TSDiv>
        </TSDiv>

        <TSDiv className="flex items-center justify-between rounded-lg border p-4">
          <TSDiv>
            <TSDiv tag="p" className="text-base font-medium text-gray-900">{isServer ? 'Server-side transpiler' : 'Client-side hook transpiler'}</TSDiv>
            <TSDiv tag="p" className="text-sm text-gray-500 mt-1">{selectedDescription}</TSDiv>
          </TSDiv>
          <TSDiv tag="label" className="inline-flex items-center cursor-pointer select-none">
            <TSDiv tag="span" className="mr-3 text-sm text-gray-600">Client</TSDiv>
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isServer}
              onChange={(e) => setSetting(e.target.checked ? 'server-only' : 'client-only')}
            />
            <TSDiv className="w-12 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 transition-colors relative">
              <TSDiv className="absolute top-0.5 left-0.5 h-5 w-5 bg-white rounded-full shadow transform transition-transform peer-checked:translate-x-6" />
            </TSDiv>
            <TSDiv tag="span" className="ml-3 text-sm text-gray-600">Server</TSDiv>
          </TSDiv>
        </TSDiv>
      </TSDiv>

      <TSDiv tag="section" className="bg-[var(--bg-surface)] border rounded-lg shadow-sm p-6 space-y-4">
        <TSDiv className="flex items-center justify-between gap-4">
          <TSDiv>
            <TSDiv tag="h2" className="text-lg font-semibold text-gray-900">Active classes</TSDiv>
            <TSDiv tag="p" className="text-sm text-gray-500">Currently applied classes in the UI. Total: {classes.length}</TSDiv>
          </TSDiv>
          <TSDiv className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search classes..."
              className="px-3 py-2 border rounded-lg text-sm bg-[var(--bg-surface)]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <TSDiv
              tag="button"
              type="button"
              onClick={refreshClasses}
              className="px-3 py-2 text-sm border rounded-lg"
            >
              Refresh
            </TSDiv>
          </TSDiv>
        </TSDiv>
        <TSDiv className="max-h-64 overflow-auto border rounded-md">
          <TSDiv tag="ul" className="divide-y divide-[var(--border)]">
            {filtered.map((c) => (
              <TSDiv tag="li" key={c} className="px-3 py-2 font-mono text-xs text-[var(--text)]">{c}</TSDiv>
            ))}
            {filtered.length === 0 && (
              <TSDiv tag="li" className="px-3 py-2 text-sm text-gray-500">No classes match your search.</TSDiv>
            )}
          </TSDiv>
        </TSDiv>
        <TSDiv className="text-xs text-gray-500">Showing {filtered.length} of {classes.length}</TSDiv>
      </TSDiv>

      <TSDiv tag="section" className="bg-[var(--bg-surface)] border rounded-lg shadow-sm p-6 space-y-4">
        <TSDiv className="flex items-center justify-between">
          <TSDiv>
            <TSDiv tag="h2" className="text-lg font-semibold text-gray-900">Themed Styler status</TSDiv>
            <TSDiv tag="p" className="text-sm text-gray-500">Runtime injector visibility and registered classes.</TSDiv>
          </TSDiv>
          <TSDiv
            tag="button"
            type="button"
            onClick={() => {
              styleManager.requestRender()
              refreshStylerStatus()
            }}
            className="px-3 py-2 text-sm border dark:rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Ensure CSS
          </TSDiv>
        </TSDiv>
        <TSDiv className="grid grid-cols-2 gap-4">
          <TSDiv className="space-y-2 text-sm text-gray-600">
            <TSDiv className="flex items-center justify-between text-base font-medium text-gray-900">
              Style tag
              <TSDiv tag="span" className={stylerStatus.styleTag ? 'text-green-600' : 'text-red-500'}>
                {stylerStatus.styleTag ? 'injected' : 'missing'}
              </TSDiv>
            </TSDiv>
            <TSDiv className="text-xs text-gray-500">
              {stylerStatus.selectors} selectors · {stylerStatus.classes} classes registered
            </TSDiv>
          </TSDiv>
          <TSDiv>
            <TSDiv tag="div" className="text-xs font-mono text-[var(--text-code)] bg-[var(--bg-code)] rounded p-2 overflow-auto max-h-40">
              {stylerStatus.cssPreview || 'No CSS generated yet.'}
            </TSDiv>
          </TSDiv>
        </TSDiv>
      </TSDiv>
    </TSDiv>
  )
}
