import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/main.js',
      formats: ['es'],
      fileName: 'main',
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
})
