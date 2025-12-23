import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import mkcert from "vite-plugin-mkcert"
import eslint from "@nabla/vite-plugin-eslint"


export default defineConfig({
  
  base: 'https://10.67.67.241:5174/',

  plugins: [vue(), mkcert(), eslint()],
  
  resolve: {
    alias: {
      
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  server: {
    host: '10.67.67.241',
    https: {}, 
    strictPort: true,
    port: 5174,

    
    proxy: {
      '/api': {
        target: `https://10.67.67.241:3000`, 
        changeOrigin: true, 
        secure: false,      
        rewrite: (path) => path.replace(/^\/api/, ''), 
      },
    },

    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Authorization'
    }
  },

  build: {
    manifest: true,
    rollupOptions: {
      input: "src/main.ts",
    },
    outDir: "../public/vite",
    chunkSizeWarningLimit: 999999999,
  },
})