import { unifiedBridge } from '@relay/shared'

export function registerThemeStyles(themeName: string, definitions?: Record<string, unknown>) {
    if (!themeName || !definitions) return
    try {
        unifiedBridge.registerTheme(themeName, definitions)
    } catch (e) {
        console.debug('Failed to register theme:', e)
    }
}

export function setThemedStylerDebug(enabled: boolean) {
    try { (global as any).__THEMED_STYLER_DEBUG__ = !!enabled } catch (e) { }
}
