#!/usr/bin/env node
import { build, context } from 'esbuild'
import fs from 'fs'
import path from 'path'

const root = path.resolve(path.join(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..'))
const srcDir = path.join(root, 'src')
const outDir = path.join(root, 'dist')
const assetsDir = path.join(outDir, 'assets')

function ensureIndexHtml(jsFile) {
  const htmlPath = path.join(outDir, 'index.html')
  const html = `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <link rel="icon" type="image/png" href="/icon.png" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>client-web (esbuild)</title>\n    <script type="module" crossorigin src="/assets/${jsFile}"></script>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>`
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(htmlPath, html)
}

export async function bundle({ watch = false } = {}) {
  const opts = {
    entryPoints: [path.join(srcDir, 'main.tsx')],
    outdir: assetsDir,
    bundle: true,
    format: 'esm',
    sourcemap: true,
    minify: false,
    target: ['es2020'],
    jsx: 'automatic',
    jsxImportSource: 'react',
    loader: {
      '.png': 'file',
      '.svg': 'file',
      '.css': 'css',
      '.wasm': 'file',
      '.yaml': 'text',
    },
    metafile: true,
    splitting: true,
    logLevel: 'info',
    define: {
      'process.env.NODE_ENV': '\"development\"',
      '__DEV__': 'true',
    },
    plugins: [
      // Resolve absolute `/src/...` imports (used by shared wasmLoader shim) to this package's src directory
      {
        name: 'alias-src-root',
        setup(build) {
          build.onResolve({ filter: /^\/src\// }, args => {
            const rel = args.path.slice('/src/'.length)
            const target = path.join(srcDir, rel)
            // Prefer explicit .ts resolution for our source files
            const withTs = `${target}.ts`
            if (fs.existsSync(withTs)) return { path: withTs }
            if (fs.existsSync(target)) return { path: target }
            return { path: withTs }
          })
        }
      },
      {
        name: 'browser-external-node-module',
        setup(build) {
          build.onResolve({ filter: /^node:module$/ }, args => {
            return { path: args.path, namespace: 'browser-external' }
          })
          build.onLoad({ filter: /.*/, namespace: 'browser-external' }, () => {
            const code = `export function createRequire() { return function() { throw new Error('createRequire is not available in the browser'); }; }`
            return { contents: code, loader: 'js' }
          })
        }
      }
    ],
    // Use a stable entry name for predictable index.html
    entryNames: 'main',
  }
  const result = await build(opts)
  if (watch) {
    const ctx = await context(opts)
    await ctx.watch()
  }
  // Always reference the stable entry name
  ensureIndexHtml('main.js')
  return { jsFile: 'main.js' }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const watch = process.argv.includes('--watch')
  bundle({ watch }).catch(err => {
    console.error('[esbuild] build failed', err)
    process.exit(1)
  })
}
