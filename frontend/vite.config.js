import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  preview: {
    allowedHosts: ['.replit.dev', 'localhost',]
  },
  server: {
    host: "0.0.0.0",
    proxy: {
      '/api': {
        target: mode === 'development' ? 'http://localhost:3000' : undefined,
        changeOrigin: true,
        secure: false
      }
    }
  }
}))
