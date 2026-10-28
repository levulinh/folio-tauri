import { defineConfig } from "@playwright/test";

// The real app runs in WKWebView, so WebKit is the only project.
export default defineConfig({
  testDir: "e2e",
  webServer: {
    command: "npm run dev:web",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: "http://localhost:5173" },
  projects: [{ name: "webkit", use: { browserName: "webkit" } }],
});
