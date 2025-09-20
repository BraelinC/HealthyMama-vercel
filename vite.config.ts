import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@shared": path.resolve(__dirname, "shared"),
      },
    },
    root: path.resolve(__dirname, "client"),
    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
    },
    server: {
      host: true,
      hmr: {
        overlay: true,
        // Allow overriding via env if running behind a proxy (e.g., vercel dev)
        host: env.VITE_HMR_HOST || undefined,
        clientPort: env.VITE_HMR_CLIENT_PORT ? Number(env.VITE_HMR_CLIENT_PORT) : undefined,
        protocol: env.VITE_HMR_PROTOCOL || undefined,
      },
      proxy: {
        '/api': {
          // Match the Express+Vite integrated dev server
          target: 'http://localhost:5002',
          changeOrigin: true,
          secure: false,
        }
      }
    }
  };
});
