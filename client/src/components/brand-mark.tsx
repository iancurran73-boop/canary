/**
 * client/src/components/brand-mark.tsx
 * ──────────────────────────────────────
 * Renders the tenant logo. Uses config.brand.logoPath for the image.
 * Falls back to a text-based monogram if the path is empty or the image fails.
 */

import config from "@/lib/tenant";

interface BrandMarkProps {
  className?: string;
  /** Passed to BrandMark but unused — kept for legacy call-sites */
  size?: number;
}

export function BrandMark({ className = "h-12 w-auto" }: BrandMarkProps) {
  if (config.brand.logoPath) {
    return (
      <img
        src={config.brand.logoPath}
        alt={config.brand.name}
        className={className}
        onError={(e) => {
          // If the logo image fails to load, fall back to text
          const target = e.currentTarget;
          target.style.display = "none";
          const fallback = document.createElement("span");
          fallback.textContent = config.brand.shortName;
          fallback.className = "font-display font-extrabold text-current";
          target.parentNode?.insertBefore(fallback, target.nextSibling);
        }}
      />
    );
  }
  // SVG paw mark fallback when no logoPath configured
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      aria-label={config.brand.shortName}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Four toe pads */}
      <ellipse cx="18" cy="22" rx="5.5" ry="7" fill="currentColor" />
      <ellipse cx="30" cy="15" rx="5.5" ry="7" fill="currentColor" />
      <ellipse cx="42" cy="15" rx="5.5" ry="7" fill="currentColor" />
      <ellipse cx="54" cy="22" rx="5.5" ry="7" fill="currentColor" />
      {/* Main paw pad */}
      <path
        d="M36 28c-9 0-17 6.5-17 16 0 5.5 4 9 9 9 3 0 5-1.5 8-1.5s5 1.5 8 1.5c5 0 9-3.5 9-9 0-9.5-8-16-17-16z"
        fill="currentColor"
      />
    </svg>
  );
}

// A simplified inline monogram SVG — kept for admin gate and compact contexts
export function BrandMonogram({ className = "h-8 w-8" }: { className?: string }) {
  const initials = config.brand.shortName.slice(0, 2).toUpperCase();
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-label={config.brand.shortName}>
      <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" />
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fill="currentColor"
        fontFamily="sans-serif"
      >
        {initials}
      </text>
    </svg>
  );
}
