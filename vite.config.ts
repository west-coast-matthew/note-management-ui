import { resolve } from 'node:path'
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** /mock/<name> → /mock/<name>/ so the artboard opens instead of the SPA fallback. */
function mockTrailingSlash(): Plugin {
  const redirect: Connect.NextHandleFunction = (req, res, next) => {
    const [path, query = ''] = (req.url ?? '').split('?')
    if (/^\/mock\/[\w-]+$/.test(path)) {
      res.statusCode = 302
      res.setHeader('Location', `${path}/${query ? `?${query}` : ''}`)
      res.end()
      return
    }
    next()
  }
  return {
    name: 'mock-trailing-slash',
    configureServer: (server) => void server.middlewares.use(redirect),
    configurePreviewServer: (server) => void server.middlewares.use(redirect),
  }
}

export default defineConfig({
  plugins: [react(), mockTrailingSlash()],
  server: {
    // Listen on IPv4 loopback explicitly; on macOS Vite otherwise binds only to ::1,
    // which makes http://127.0.0.1:5173 (and some browsers' "localhost") fail to connect.
    host: '127.0.0.1',
    port: 5175,
    open: true,
    proxy: {
      // Any request starting with /api goes to the note-management-api server
      '/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
    },
  },
  preview: { host: '127.0.0.1' },
  build: {
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
        // Design artboards — served at /mock/<name>/ in dev and built alongside the app.
        'mock-form-controls': resolve(import.meta.dirname, 'mock/form-controls/index.html'),
        'mock-application-state': resolve(import.meta.dirname, 'mock/application-state/index.html'),
      },
    },
  },
})
