import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // read API_PORT from the repo-root .env so the proxy follows the API
  const rootEnv = loadEnv(mode, path.resolve(import.meta.dirname, "../.."), "");
  const apiPort = Number(rootEnv.API_PORT || process.env.API_PORT || 4000);
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": `http://localhost:${apiPort}`,
      },
    },
  };
});
