import { defineConfig,loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Phase 2: the dev-server disk API (Google OAuth prototype, local JSON file
// persistence, share-token middleware) is retired. The browser talks to
// Supabase directly (Postgres + Realtime Broadcast + Yjs), so no /api/*
// middleware is needed in dev or preview.
const root=path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({mode})=>{Object.assign(process.env,loadEnv(mode,root,''));return{plugins:[react()]}})
