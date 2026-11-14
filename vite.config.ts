import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/src/data/")) return "zzz-data";
        }
      }
    }
  },
  worker: {
    format: "es"
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api/enka": {
        target: "https://enka.network",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/enka/, "/api"),
        headers: {
          "User-Agent": "ZZZDamageWorkbench/3.3 (https://github.com/h-void/zzz-dmg-calculator)"
        }
      }
    }
  }
});
