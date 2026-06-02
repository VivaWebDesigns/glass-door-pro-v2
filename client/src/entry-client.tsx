import { hydrateRoot, createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const root = document.getElementById("root")!;

if (import.meta.env.DEV) {
  // Dev mode: body is not server-rendered (CSS is JS-injected, so SSR body
  // causes FOUC). Mount fresh with createRoot.
  createRoot(root).render(<App />);
} else {
  // Production: root already contains server-rendered HTML. Hydrate it.
  hydrateRoot(root, <App />);
}
