import { createRoot } from "react-dom/client";
import App from "./App";
// HMR connection debugging (dev-only; inert in prod builds)
import "./vite-hmr-debug";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
