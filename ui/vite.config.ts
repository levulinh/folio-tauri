import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  clearScreen: false,
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts?(x)"],
    passWithNoTests: true,
  },
});
