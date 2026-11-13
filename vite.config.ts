import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function rumDevEndpoint(): Plugin {
  const handle = (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    const path = req.url?.split('?')[0]
    if (path !== '/rum/trace') {
      next()
      return
    }
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end()
      return
    }
    req.resume()
    res.statusCode = 204
    res.end()
  }
  return {
    name: 'turingmusic-rum-dev-endpoint',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), rumDevEndpoint()],
})
