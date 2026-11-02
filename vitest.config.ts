/// <reference types="vitest" />
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Node-script tests use node:test; release:check runs all of them as a
    // separate required gate rather than silently omitting them.
    exclude: [...configDefaults.exclude, 'output/**', 'e2e/**', 'e2e-integration/**', 'scripts/**/*.test.mjs'],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
