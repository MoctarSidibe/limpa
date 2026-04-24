import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  server: { port: 5173 },
  resolve: { dedupe: ['react', 'react-dom'] },
  plugins: [react()],
})
