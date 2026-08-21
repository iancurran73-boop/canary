/**
 * tenant.config.ts
 * ─────────────────────────
 * The Singing Canary — karaoke pub & function room, Newcastle.
 * Forked from the sophiespamperedpaws booking platform.
 * Update the // TBC values below with real details before going live.
 */

import type { TenantConfig } from "./shared/tenant-types";

const config: TenantConfig = {
  brand: {
    name: "The Singing Canary",
    shortName: "The Canary",
    tagline: "Singing · Dancing · Good Times",
    domain: "thesingingcanary.co.uk", // TBC — confirm real domain
    instagram: "", // TBC
    logoPath: "/img/logo.png",
    favicon: "/favicon.png",
    colors: {
      // HSL "H S% L%" — neon bar palette: electric magenta + cyan surge on a
      // deep charcoal/violet base, volt green reserved for sparing highlights.
      primary: "312 100% 50%",   // electric magenta ~ #ff00cc
      primaryFg: "0 0% 0%",
      accent: "180 100% 50%",    // cyan surge       ~ #00ffff
      accentFg: "0 0% 0%",
      tertiary: "111 100% 54%",  // volt green       ~ #39ff14 — use sparingly
      tertiaryFg: "0 0% 0%",
      background: "250 20% 6%",  // deep charcoal    ~ #0d0c12
      foreground: "240 14% 90%", // crisp off-white  ~ #e2e2e9
      muted: "257 41% 12%",      // dark violet surface ~ #19122b
      mutedFg: "257 15% 70%",
      border: "257 30% 22%",
    },
    fonts: {
      // Bungee carries the neon poster/party feel; Inter keeps body copy
      // actually readable against a bold display face.
      display: "Bungee",
      body: "Inter",
    },
  },

  business: {
    ownerName: "The Singing Canary Team", // TBC
    phone: "+440000000000",               // TBC
    phoneDisplay: "TBC",
    email: "hello@thesingingcanary.co.uk", // TBC
    address: {
      line1: "TBC",
      city: "Newcastle upon Tyne",
      postcode: "TBC",
      country: "United Kingdom",
    },
    mapsUrl: "https://maps.google.com/?q=The+Singing+Canary+Newcastle",
  },

  // Thu-Sat evenings — matches the seeded default in server/storage.ts.
  hours: {
    0: { enabled: false },
    1: { enabled: false },
    2: { enabled: false },
    3: { enabled: false },
    4: { enabled: true, start: "19:00", end: "23:00" },
    5: { enabled: true, start: "19:00", end: "23:00" },
    6: { enabled: true, start: "19:00", end: "23:00" },
  },

  room: {
    sessionDurationMinutes: 240, // 4 hours
    depositAmount: 150,
    depositRefundDescription: "as a bar tab on the night",
    maxPartySize: 40,
  },

  copy: {
    heroTitle: "Grab the Mic, Own the Night",
    heroSubtitle:
      "Newcastle's home of karaoke, dancing and good times — book our private function room for birthdays, hen dos, work parties, or just because.",
    aboutTitle: "About The Singing Canary",
    aboutBody:
      "The Singing Canary is Newcastle's home of karaoke, dancing and good times — a neon-lit corner pub where the mic is always live and the good times don't stop.\n\nOur private function room is exclusively yours for the night once booked — no sharing the stage, no queuing for a slot. Just you, your crowd, and a room built for singing your heart out.\n\nWhether it's a birthday, a hen do, a work do, or no occasion at all, we've got the room, the sound system, and the atmosphere. (Update this in the admin Content tab to add your own story.)",
    bookingHeroSubtitle:
      "Pick a date, tell us the occasion, and the room's yours. A £150 deposit secures it — and comes straight back to you as a bar tab on the night.",
    homeBullets: [
      "Exclusive use — the room's yours for the night",
      "£150 deposit — comes back as a bar tab",
      "Newcastle's home of karaoke, dancing & good times",
    ],
    howItWorksTitle: "How Booking Works",
    howItWorksIntro:
      "From picking a date to grabbing the mic — here's exactly what happens.",
    howItWorksSteps: [
      "Pick a date and time that works for you — the room is booked exclusively, so once it's yours, it's yours.",
      "Tell us your party size and the occasion — birthday, hen do, work party, or just because.",
      "Pay a £150 deposit online to lock in your booking.",
      "Turn up on the night — your £150 comes straight back to you as a bar tab.",
      "Grab the mic and get singing. Singing, dancing, good times.",
    ],
  },

  gallery: [
    // Empty — upload photos via the admin Content tab.
  ],

  payments: {
    mode: "mvp",
    contactWindow: "24 hours",
    currency: "GBP",
    currencySymbol: "£",
  },

  admin: {
    // Passcode-only login (case-insensitive). Change this before going live.
    passcode: "CanarySings1",
  },

  seo: {
    siteUrl: "https://thesingingcanary.co.uk",
    defaultTitle: "The Singing Canary · Karaoke & Function Room · Newcastle",
    defaultDescription:
      "Newcastle's home of karaoke, dancing and good times. Book our private function room for birthdays, hen dos, work parties and more — £150 deposit, refunded as a bar tab on the night.",
    ogImage: "/img/logo.png",
  },
};

export default config;
