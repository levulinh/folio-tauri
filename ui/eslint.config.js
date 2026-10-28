import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "test-results", "playwright-report", "src/backend/generated"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@tauri-apps/*"],
              message:
                "Only src/backend/tauriBackend.ts and src/platform/** may import @tauri-apps/*.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/backend/tauriBackend.ts", "src/platform/**"],
    rules: { "no-restricted-imports": "off" },
  },
);
