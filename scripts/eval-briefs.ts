/**
 * The eval set: briefs the engine is regenerated against on every change, so a
 * tweak that helps one poster cannot silently hurt the others (§65).
 *
 * Mostly US small-business promotions (D-17), written the way owners actually
 * type them — offers in the wrong field, missing venues, shouty capitals — plus
 * a church brief so the original vertical does not quietly rot.
 */
export interface EvalBrief {
  slug: string;
  /** Attach a synthetic portrait and/or logo to exercise the photo archetypes. */
  assets?: Array<"portrait" | "logo">;
  brief: Record<string, unknown>;
}

export const EVAL_BRIEFS: EvalBrief[] = [
  {
    slug: "nail-salon",
    brief: {
      organisationName: "Lux Nail Bar",
      eventTitle: "Valentine's Special",
      date: "FEB 1–14",
      location: "Downtown Austin",
      businessType: "nail-salon",
      callToAction: "Book Now",
      extraLines: ["20% off all gel sets"],
      website: "luxnailbar.com",
      socials: "@luxnailbar",
      feeling: "premium and elegant",
    },
  },
  {
    slug: "food-truck",
    brief: {
      organisationName: "Smoke & Salt BBQ",
      eventTitle: "Grand Opening",
      date: "SAT MAR 8",
      time: "11AM – 8PM",
      location: "412 Congress Ave",
      businessType: "food-truck",
      callToAction: "Free brisket sliders",
      website: "smokeandsalt.co",
      socials: "@smokeandsaltbbq",
      feeling: "bold and loud",
    },
  },
  {
    slug: "barber",
    brief: {
      organisationName: "Sharp Cuts",
      eventTitle: "Black Friday",
      date: "NOV 28",
      businessType: "barber",
      callToAction: "$15 cuts all day",
      socials: "@sharpcutsatx",
      feeling: "clean minimal",
    },
  },
  {
    slug: "boutique-code",
    brief: {
      organisationName: "Urban Style Boutique",
      eventTitle: "Weekend Flash Sale",
      offer: "30% OFF STOREWIDE",
      offerDetail: "This Saturday and Sunday only",
      promoCode: "FLASH30",
      date: "OCT 24–25",
      time: "10AM – 8PM",
      location: "Downtown Gallery & Online",
      businessType: "boutique",
      callToAction: "Shop the Sale",
      website: "urbanstyle.co",
      feeling: "modern, bold, energetic",
    },
  },
  {
    slug: "gym-long-name",
    brief: {
      organisationName: "Iron Republic Strength & Conditioning",
      eventTitle: "New Year, New Membership",
      offer: "First month free",
      offerDetail: "No joining fee when you sign up before January 31",
      location: "1800 South Lamar Blvd",
      businessType: "gym",
      callToAction: "Claim your pass",
      website: "ironrepublic.fit",
      feeling: "bold energetic",
    },
  },
  {
    slug: "bakery-minimal",
    brief: {
      organisationName: "Crumb",
      offer: "BOGO croissants",
      businessType: "bakery",
      feeling: "warm and friendly",
    },
  },
  {
    slug: "cafe-event",
    brief: {
      organisationName: "Cafe Nord",
      eventTitle: "Bottomless Mimosa Brunch",
      date: "Every Sat & Sun",
      time: "11AM – 3PM",
      location: "East 6th Street",
      businessType: "restaurant",
      callToAction: "Reserve a table",
      socials: "@cafenord",
      feeling: "relaxed, sunny",
    },
  },
  {
    slug: "plumber-trust",
    brief: {
      organisationName: "Reliable Rooter Plumbing",
      eventTitle: "Spring Maintenance",
      offer: "$49 drain cleaning",
      offerDetail: "Licensed, insured, same-day service",
      businessType: "plumber",
      callToAction: "Call (512) 555-0142",
      website: "reliablerooter.com",
      feeling: "trustworthy professional",
    },
  },
  {
    slug: "pizza-holiday",
    brief: {
      organisationName: "Tony's Pizzeria",
      eventTitle: "Super Bowl Sunday",
      offer: "2 large pizzas for $25",
      promoCode: "GAMEDAY",
      date: "FEB 9",
      businessType: "restaurant",
      callToAction: "Order online",
      website: "tonyspizza.com",
      feeling: "fun, loud",
    },
  },
  {
    slug: "spa-photo",
    assets: ["portrait", "logo"],
    brief: {
      organisationName: "Serenity Day Spa",
      eventTitle: "Mother's Day",
      offer: "Spa day for two — $129",
      date: "MAY 1–11",
      location: "Westlake Hills",
      businessType: "spa",
      callToAction: "Gift it today",
      website: "serenityspa.com",
      feeling: "calm luxurious",
    },
  },
  {
    slug: "trainer-photo",
    assets: ["portrait"],
    brief: {
      organisationName: "Coach Maya Fitness",
      eventTitle: "Summer Shred Bootcamp",
      offer: "6 weeks · $99",
      date: "Starts JUN 2",
      time: "6AM & 6PM",
      location: "Zilker Park",
      people: [{ name: "Maya Torres", title: "Coach" }],
      businessType: "gym",
      callToAction: "Save your spot",
      socials: "@coachmaya",
      feeling: "energetic",
    },
  },
  {
    slug: "church-regression",
    assets: ["portrait", "logo"],
    brief: {
      category: "church",
      subcategory: "sunday-service",
      eventTitle: "Supernatural Increase",
      organisationName: "Grace City Church",
      date: "SEP 13",
      time: "9:00 AM",
      location: "Lekki, Lagos",
      people: [{ name: "Pastor Daniel", title: "" }],
      website: "gracecity.church",
      socials: "@gracecitylagos",
    },
  },
];
