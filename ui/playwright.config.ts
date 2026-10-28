import { defineConfig } from "@playwright/test";

// Own port + fake backend: never collides with a developer's `npm run dev` on 5173.
// The real app runs in WKWebView, so WebKit is the only project.
export default defineConfig({
  testDir: "e2e",
  webServer: {
    command: "npm run dev:e2e",
    url: "http://localhost:5199",
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
  },
  use: { baseURL: "http://localhost:5199" },
  projects: [{ name: "webkit", use: { browserName: "webkit" } }],
});
