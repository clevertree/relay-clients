import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import App from './App.tsx'
// wasm loader consolidated in @clevertree/relay-client-shared
import ErrorBoundary from './components/ErrorBoundary'

async function bootstrap() {
    let initError: Error | undefined
    try {
        // Initialize both WASM modules (hook-transpiler + themed-styler) via consolidated loader
        try {
            const {wasmLoader} = await import('@clevertree/relay-client-shared')
            await wasmLoader.initAllWasms()
            // After wasm runtime initialized, attempt to populate default themes from the wasm bundle
            try {
                const shared = await import('@clevertree/relay-client-shared')
                if (shared && typeof shared.ensureDefaultsLoaded === 'function') {
                    await shared.ensureDefaultsLoaded()
                }
            } catch (e) {
                /* ignore */
            }
        } catch (e) {
            console.warn('[main] wasm loader init failed', e)
        }
    } catch (error) {
        initError = error instanceof Error ? error : new Error(String(error))
    }

    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <ErrorBoundary initialError={initError}>
                <App/>
            </ErrorBoundary>
        </StrictMode>,
    )
}

bootstrap()
