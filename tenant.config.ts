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
      // HSL "H S% L%" — sampled directly from the real logo and venue photo.
      primary: "42 100% 50%",    // canary gold      ~ #ffb100
      primaryFg: "0 0% 8%",
      accent: "330 100% 50%",    // hot pink/magenta ~ #fd007f
      accentFg: "0 0% 8%",
      tertiary: "190 100% 50%",  // neon cyan-blue   ~ #00d4ff
      tertiaryFg: "0 0% 8%",
      background: "240 14% 5%",  // near-black       ~ #0c0c10
      foreground: "44 35% 94%",  // warm off-white   ~ #f5f2ea
      muted: "240 10% 12%",
      mutedFg: "240 5% 65%",
      border: "240 10% 20%",
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
