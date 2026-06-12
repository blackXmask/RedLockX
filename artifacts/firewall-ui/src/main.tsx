import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Configure API base URL for the generated client when provided by Vite.
// If not set, the client will use relative URLs (same-origin).
const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
if (apiBase) setBaseUrl(apiBase.replace(/\/+$/, ""));

createRoot(document.getElementById("root")!).render(<App />);
