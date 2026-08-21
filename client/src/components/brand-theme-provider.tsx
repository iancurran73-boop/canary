/**
 * client/src/components/brand-theme-provider.tsx
 * ───────────────────────────────────────────────
 * Reads brand fonts + colours from useBrand() and applies them at runtime:
 *   - injects/replaces a Google Fonts <link id="brand-fonts"> in <head>
 *   - sets every :root colour token BrandConfig carries (primary/accent/
 *     tertiary + their foregrounds, background/foreground, muted/mutedFg,
 *     border, plus card/sidebar/popover, which read off the same values so
 *     they never drift back to the index.css fallback)
 *   - sets --font-display, --font-sans and --font-serif
 *
 * This overrides the static values index.css/tenant.config ship as a
 * first-paint fallback, once the DB-backed config loads, so brand changes
 * made in Admin > Branding apply without a redeploy.
 */

import { useEffect } from "react";
import { useBrand } from "@/lib/brand";

export function BrandThemeProvider({ children }: { children: React.ReactNode }) {
  const brand = useBrand();

  useEffect(() => {
    const root = document.documentElement;
    const { primary, accent, tertiary, background, foreground, muted, mutedFg, border } = brand.colors;

    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-foreground", brand.colors.primaryFg);
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-foreground", brand.colors.accentFg);
    root.style.setProperty("--background", background);
    root.style.setProperty("--foreground", foreground);
    root.style.setProperty("--muted", muted);
    root.style.setProperty("--muted-foreground", mutedFg);
    root.style.setProperty("--border", border);

    // Surfaces that read off the same tokens rather than a separate
    // hardcoded fallback, so they never drift from the brand colours above.
    root.style.setProperty("--card", muted);
    root.style.setProperty("--card-foreground", foreground);
    root.style.setProperty("--card-border", border);
    root.style.setProperty("--popover", muted);
    root.style.setProperty("--popover-foreground", foreground);
    root.style.setProperty("--popover-border", border);
    root.style.setProperty("--input", border);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--sidebar", background);
    root.style.setProperty("--sidebar-foreground", foreground);
    root.style.setProperty("--sidebar-border", border);
    root.style.setProperty("--sidebar-primary", primary);
    root.style.setProperty("--sidebar-primary-foreground", brand.colors.primaryFg);
    root.style.setProperty("--sidebar-accent", muted);
    root.style.setProperty("--sidebar-accent-foreground", foreground);
    root.style.setProperty("--sidebar-ring", primary);

    if (tertiary) {
      root.style.setProperty("--chart-4", tertiary);
    }

    // Fonts.
    root.style.setProperty("--font-display", `'${brand.fonts.display}', sans-serif`);
    root.style.setProperty("--font-sans", `'${brand.fonts.body}', system-ui, sans-serif`);
    root.style.setProperty("--font-serif", `'${brand.fonts.display}', sans-serif`);

    // Headline accent italic — toggled in Admin > Branding.
    root.style.setProperty("--accent-italic", brand.italicAccent ? "italic" : "normal");
  }, [
    brand.colors.primary,
    brand.colors.primaryFg,
    brand.colors.accent,
    brand.colors.accentFg,
    brand.colors.tertiary,
    brand.colors.background,
    brand.colors.foreground,
    brand.colors.muted,
    brand.colors.mutedFg,
    brand.colors.border,
    brand.fonts.display,
    brand.fonts.body,
    brand.italicAccent,
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
