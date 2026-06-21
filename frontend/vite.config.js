// frontend/vite.config.js
//
// Purpose: Vite bundler configuration for the React frontend.
//
// Configuration includes:
//   - React plugin (@vitejs/plugin-react)
//   - Dev server proxy: /api/* → http://localhost:8000 (avoids CORS during local dev)
//   - Dev server proxy: /ws/* → ws://localhost:8000 (WebSocket proxy for local dev)
//   - Build output to: dist/ (served by Vercel as static files)
//
// Dependencies: @vitejs/plugin-react

// --- implementation goes here (Phase 4) ---

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws':  { target: 'ws://localhost:8000', ws: true },
    },
  },
})
