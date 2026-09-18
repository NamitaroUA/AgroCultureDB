// electron.vite.config.ts
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } }
    }
  },
  preload: {
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/preload/index.ts') } }
    }
  },
  renderer: {
    build: {
      rollupOptions: { 
        input: {
           index: resolve(__dirname, 'src/renderer/index.html'),
           tables: resolve(__dirname, 'src/renderer/tables.html') 
          } }
    }
  }
})