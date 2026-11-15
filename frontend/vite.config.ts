import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [react(), ...(process.env.VITEST ? [] : [nodePolyfills({ include: ["buffer", "process", "util", "stream", "events"] })])],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
      // ../shared lives outside this package: make its imports resolve to this package's copies
      snarkjs: path.resolve(__dirname, "node_modules/snarkjs"),
      circomlibjs: path.resolve(__dirname, "node_modules/circomlibjs"),
    },
  },
  server: { fs: { allow: [".."] } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    testTimeout: 30000,
  },
});
