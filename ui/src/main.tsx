import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppearanceProvider } from "./appearance/AppearanceProvider";
import "@mantine/core/styles.css";
import "@blocknote/mantine/style.css";
import "./theme.css";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing");
createRoot(root).render(
  <StrictMode>
    <AppearanceProvider>
      <App />
    </AppearanceProvider>
  </StrictMode>,
);
