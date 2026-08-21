/**
 * shared/tenant-types.ts
 * ──────────────────────
 * Canonical TypeScript interface for a GeneralBooking tenant configuration.
 * Import TenantConfig wherever you need type-safety against tenant.config.ts.
 *
 * Changes here must be reflected in tenant.config.example.ts and tenant.config.ts.
 */

export interface TenantConfig {
  brand: {
    /** Full venue/business name — used in page titles and headings */
    name: string;
    /** Short name for compact contexts (header, footer tagline) */
    shortName: string;
    /** Hero subheadline / venue tagline */
    tagline: string;
    /** Bare domain (no protocol), e.g. "thesingingcanary.co.uk" */
    domain: string;
    /** Instagram handle WITHOUT the @ sign */
    instagram?: string;
    /** Root-relative path to logo image, e.g. "/img/logo.png" */
    logoPath: string;
    /** Root-relative favicon path, e.g. "/favicon.png" */
    favicon: string;
    colors: {
      /**
       * All colours use "H S% L%" format (NO hsl() wrapper).
       * These values are injected as CSS custom properties at runtime.
       */
      /** Deep primary brand colour — e.g. "285 45% 18%" */
      primary: string;
      /** Foreground text on primary colour */
      primaryFg: string;
      /** Accent / highlight colour — e.g. "280 50% 78%" */
      accent: string;
      /** Foreground text on accent colour */
      accentFg: string;
      /** Third neon pop colour, used sparingly (small badges, hover states) */
      tertiary: string;
      /** Foreground text on tertiary colour */
      tertiaryFg: string;
      /** Page background */
      background: string;
      /** Default foreground text colour */
      foreground: string;
      /** Muted surface colour */
      muted: string;
      /** Muted foreground text */
      mutedFg: string;
      /** Default border colour */
      border: string;
    };
    fonts: {
      /** Google Fonts family name for display/heading text, e.g. "Bungee" */
      display: string;
      /** Google Fonts family name for body text, e.g. "Inter" */
      body: string;
    };
  };

  business: {
    /** Name of the owner / venue contact — used in copy throughout the site */
    ownerName: string;
    /** Phone in E.164 format — used in tel: links, e.g. "+441912221234" */
    phone: string;
    /** Human-readable phone for display, e.g. "+44 191 222 1234" */
    phoneDisplay: string;
    /** Contact email address */
    email: string;
    address: {
      line1: string;
      city: string;
      postcode: string;
      country: string;
    };
    /** Optional Google Maps URL for the "Get directions" link */
    mapsUrl?: string;
  };

  /**
   * Opening hours the function room is bookable, keyed by day-of-week:
   * 0=Sunday … 6=Saturday. Set enabled:false for closed days. This is a
   * display fallback — the DB working_hours table (Admin > Hours) is the
   * real source at runtime.
   */
  hours: {
    [day: number]: {
      enabled: boolean;
      start?: string;   // "HH:MM"
      end?: string;     // "HH:MM"
      note?: string;    // e.g. "By request"
    };
  };

  /**
   * There's one bookable thing — the function room itself — not a list of
   * services. Session length and deposit amount are admin-editable
   * (Admin > Settings); these are just display fallbacks/defaults.
   */
  room: {
    sessionDurationMinutes: number;
    depositAmount: number;
    /** e.g. "as a bar tab on the night" */
    depositRefundDescription: string;
    maxPartySize: number;
  };

  copy: {
    heroTitle: string;
    heroSubtitle: string;
    aboutTitle: string;
    /** Multi-paragraph body — render with whitespace-pre-line or split on "\n\n" */
    aboutBody: string;
    /** Subtitle shown on the /book page header */
    bookingHeroSubtitle: string;
    /** Bullet points shown in the booking CTA section on the homepage */
    homeBullets: string[];
    howItWorksTitle: string;
    howItWorksIntro: string;
    /** Numbered steps shown on the /how-it-works page */
    howItWorksSteps: string[];
  };

  gallery: Array<{
    src: string;
    alt: string;
    category?: string;
  }>;

  payments: {
    /**
     * "mvp" — contact-owner flow (default). SumUp hosted checkout is enabled
     * separately via the admin Payments tab (server-controlled).
     */
    mode: "mvp";
    /** Used in the MVP contact screen — e.g. "24 hours" */
    contactWindow: string;
    /** ISO 4217 currency code, e.g. "GBP" */
    currency: string;
    /** Symbol for display, e.g. "£" */
    currencySymbol: string;
  };

  admin: {
    /**
     * Passcode for the admin portal — compared case-insensitively.
     * Keep this secret; do not commit the real tenant.config.ts to a public repo.
     */
    passcode: string;
  };

  seo: {
    /** Full canonical site URL with protocol, e.g. "https://thesingingcanary.co.uk" */
    siteUrl: string;
    /** Default <title> for pages that don't override it */
    defaultTitle: string;
    /** Default meta description */
    defaultDescription: string;
    /** Root-relative path to the default OG image */
    ogImage: string;
  };
}
