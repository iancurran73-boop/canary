/**
 * client/src/components/brand-theme-provider.tsx
 * ───────────────────────────────────────────────
 * Reads brand fonts + colours from useBrand() and applies them at runtime:
 *   - injects/replaces a Google Fonts <link id="brand-fonts"> in <head>
 *   - sets :root CSS variables (--primary, --accent, --background, --foreground)
 *     plus derived (--primary-foreground, --muted, --border)
 *   - sets --font-display and --font-sans
 *
 * This overrides the initial values set from tenant.config in main.tsx once
 * the DB-backed config loads, so brand changes apply without a redeploy.
 */

import { useEffect } from "react";
import { useBrand } from "@/lib/brand";

/** Parse an HSL "H S% L%" string into [h, s, l] numbers. */
function parseHsl(hsl: string): [number, number, number] | null {
  const m = hsl.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return null;
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
}

/** Adjust the lightness of an HSL string, clamped to [0,100]. */
function adjustLightness(hsl: string, delta: number): string {
  const parsed = parseHsl(hsl);
  if (!parsed) return hsl;
  const [h, s, l] = parsed;
  const nl = Math.max(0, Math.min(100, l + delta));
  return `${h} ${s}% ${nl}%`;
}

export function BrandThemeProvider({ children }: { children: React.ReactNode }) {
  const brand = useBrand();

  useEffect(() => {
    const root = document.documentElement;
    const { primary, accent, background, foreground } = brand.colors;

    root.style.setProperty("--primary", primary);
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--background", background);
    root.style.setProperty("--foreground", foreground);

    // Derived tokens.
    const pl = parseHsl(primary);
    root.style.setProperty(
      "--primary-foreground",
      pl && pl[2] < 60 ? "0 0% 100%" : "240 30% 14%"
    );
    root.style.setProperty("--muted", adjustLightness(primary, 35));
    root.style.setProperty("--border", adjustLightness(primary, 30));

    // Fonts.
    root.style.setProperty("--font-display", `'${brand.fonts.display}', sans-serif`);
    root.style.setProperty("--font-sans", `'${brand.fonts.body}', system-ui, sans-serif`);
  }, [
    brand.colors.primary,
    brand.colors.accent,
    brand.colors.background,
    brand.colors.foreground,
    brand.fonts.display,
    brand.fonts.body,
  ]);

  useEffect(() => {
    const display = brand.fonts.display;
    const body = brand.fonts.body;
    const families = Array.from(new Set([display, body]))
      .map((f) => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700;800`)
      .join("&");
    const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;

    let link = document.head.querySelector<HTMLLinkElement>("#brand-fonts");
    if (!link) {
      link = document.createElement("link");
      link.id = "brand-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }, [brand.fonts.display, brand.fonts.body]);

  return <>{children}</>;
}
