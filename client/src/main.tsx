/**
 * client/src/main.tsx
 * ────────────────────
 * React entry point. Before rendering:
 *  1. Injects a Google Fonts <link> for the tenant's display and body fonts.
 *  2. Sets document.title from tenant SEO config.
 *
 * Brand colours are NOT seeded here — neutral greyscale defaults ship inline in
 * index.html and BrandThemeProvider applies the real DB values on mount. This
 * avoids a first-paint flash of tenant colours before the DB values load.
 */

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import config from "@/lib/tenant";

// removed: BrandThemeProvider handles this from DB
// Seeding brand colours here caused a flash of tenant colours before the DB
// values loaded. Neutral greyscale defaults now ship inline in index.html, and
// BrandThemeProvider applies the real DB values once the app mounts.

// ── Inject Google Fonts for display and body fonts ──────────────────────────
function injectFonts() {
  const { display, body } = config.brand.fonts;
  const families = Array.from(new Set([display, body]))
    .map((f) => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700;800`)
    .join("&");
  const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  const existing = document.head.querySelector('link[data-tenant-fonts]');
  if (existing) return; // already injected
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.tenantFonts = "1";
  document.head.appendChild(link);

  // Override font CSS vars so Tailwind's font-sans / font-display pick them up
  const root = document.documentElement;
  root.style.setProperty("--font-display", `'${display}', sans-serif`);
  root.style.setProperty("--font-sans", `'${body}', system-ui, sans-serif`);
}

// ── 3. Set document title and favicon ───────────────────────────────────────
function applyMeta() {
  document.title = config.seo.defaultTitle;
  // Favicon
  let favicon = document.head.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (favicon) favicon.href = config.brand.favicon;
}

try {
  injectFonts();
  applyMeta();
} catch (e) {
  console.error("[main] Failed to apply tenant config:", e);
}

// One-time migration: if user lands on a legacy hash route like #/admin,
// rewrite the URL to a clean browser path before mounting the app.
if (window.location.hash.startsWith("#/")) {
  const newPath = window.location.hash.slice(1); // strip leading '#'
  window.history.replaceState(null, "", newPath || "/");
}

createRoot(document.getElementById("root")!).render(<App />);
