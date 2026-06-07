import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import obfuscator from 'rollup-plugin-obfuscator'

export default defineConfig({
  base: '/stock-tools-web/',   // GitHub Pages 子路徑；若用自訂 domain 改回 '/'
  plugins: [
    tailwindcss(),
    react(),
    obfuscator({
      options: {
        compact: true,
        identifierNamesGenerator: 'mangled-shuffled',
        renameGlobals: false,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.5,
        selfDefending: true,
        disableConsoleOutput: false,
      },
    }),
  ],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2, drop_console: false },
      mangle: { toplevel: true },
      format: { comments: false },
    },
    rollupOptions: {
      output: {
        // 所有 chunk 合併成單一檔案，不留下可逆向的 chunk 分割線索
        manualChunks: undefined,
      },
    },
  },
})
