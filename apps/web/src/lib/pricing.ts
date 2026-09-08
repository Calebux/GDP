import type { PricingContext, ProductPlan } from "@gdp/core";

export interface RegionPricingConfig {
  country: string;
  region: PricingContext["region"];
  currency: PricingContext["currency"];
  symbol: string;
  plans: {
    single: {
      name: string;
      price: number; // in minor units
      description: string;
      badge?: string;
    };
    "bundle-5": {
      name: string;
      price: number; // in minor units
      description: string;
      badge?: string;
    };
  };
}

/**
 * Regional pricing catalogue per D-02 & D-06:
 * - Lagos / Nigeria: ₦5,000 (~$3.50) entry, ₦18,000 bundle
 * - US: $19.00 standard entry, $49.00 bundle
 * - UK: £15.00 standard entry, £39.00 bundle
 * - DEFAULT: $2.99 single pack, $9.99 5-pack bundle
 */
export const REGION_CONFIGS: Record<PricingContext["region"], RegionPricingConfig> = {
  NG: {
    country: "Nigeria",
    region: "NG",
    currency: "ngn",
    symbol: "₦",
    plans: {
      single: {
        name: "Single Pack",
        price: 500000, // ₦5,000 (in kobo)
        description: "1 high-resolution promo pack across all formats",
        badge: "Single Use",
      },
      "bundle-5": {
        name: "5-Pack Bundle",
        price: 1800000, // ₦18,000 (in kobo)
        description: "5 promo packs + wallet credits. Save 28%",
        badge: "Best Value",
      },
    },
  },
  US: {
    country: "United States",
    region: "US",
    currency: "usd",
    symbol: "$",
    plans: {
      single: {
        name: "Single Pack",
        price: 1900, // $19.00
        description: "1 high-resolution promo pack across all formats",
        badge: "Single Use",
      },
      "bundle-5": {
        name: "5-Pack Bundle",
        price: 4900, // $49.00
        description: "5 promo packs + wallet credits. Save 48%",
        badge: "Best Value",
      },
    },
  },
  GB: {
    country: "United Kingdom",
    region: "GB",
    currency: "gbp",
    symbol: "£",
    plans: {
      single: {
        name: "Single Pack",
        price: 1500, // £15.00
        description: "1 high-resolution promo pack across all formats",
        badge: "Single Use",
      },
      "bundle-5": {
        name: "5-Pack Bundle",
        price: 3900, // £39.00
        description: "5 promo packs + wallet credits. Save 48%",
        badge: "Best Value",
      },
    },
  },
  DEFAULT: {
    country: "Global",
    region: "DEFAULT",
    currency: "usd",
    symbol: "$",
    plans: {
      single: {
        name: "Single Pack",
        price: 299, // $2.99
        description: "1 high-resolution promo pack across all formats",
        badge: "Single Use",
      },
      "bundle-5": {
        name: "5-Pack Bundle",
        price: 999, // $9.99
        description: "5 promo packs + wallet credits. Save 33%",
        badge: "Best Value",
      },
    },
  },
};

/**
 * Detects visitor pricing context from HTTP request headers.
 * Looks for geo headers from cloud providers / proxies (Vercel, Cloudflare, AWS),
 * or optional query/header override for regional switching.
 */
export function detectPricingContext(headersMap: Headers | Record<string, string | string[] | undefined>): PricingContext {
  const getHeader = (name: string): string => {
    if (typeof (headersMap as Headers).get === "function") {
      return (headersMap as Headers).get(name) || "";
    }
    const val = (headersMap as Record<string, string | string[] | undefined>)[name.toLowerCase()];
    if (Array.isArray(val)) return val[0] || "";
    return val || "";
  };

  const rawCountry = (
    getHeader("x-override-country") ||
    getHeader("x-vercel-ip-country") ||
    getHeader("cf-ipcountry") ||
    getHeader("x-country-code") ||
    getHeader("x-geo-country") ||
    ""
  ).toUpperCase().trim();

  if (rawCountry === "NG" || rawCountry === "NGA") {
    return { country: "NG", region: "NG", currency: "ngn" };
  }
  if (rawCountry === "GB" || rawCountry === "GBR" || rawCountry === "UK") {
    return { country: "GB", region: "GB", currency: "gbp" };
  }
  if (rawCountry === "US" || rawCountry === "USA") {
    return { country: "US", region: "US", currency: "usd" };
  }

  return { country: "DEFAULT", region: "DEFAULT", currency: "usd" };
}

/** Returns all available product plans for a region */
export function getProductPlans(ctx: PricingContext): ProductPlan[] {
  const config = REGION_CONFIGS[ctx.region] || REGION_CONFIGS.DEFAULT;
  return [
    {
      id: "single",
      name: config.plans.single.name,
      credits: 1,
      price: config.plans.single.price,
      currency: config.currency,
      region: config.region,
      description: config.plans.single.description,
      badge: config.plans.single.badge,
    },
    {
      id: "bundle-5",
      name: config.plans["bundle-5"].name,
      credits: 5,
      price: config.plans["bundle-5"].price,
      currency: config.currency,
      region: config.region,
      description: config.plans["bundle-5"].description,
      badge: config.plans["bundle-5"].badge,
    },
  ];
}

/** Resolves a single product plan by ID for a given pricing context */
export function getProductPlan(productId: string, ctx: PricingContext): ProductPlan {
  const plans = getProductPlans(ctx);
  const found = plans.find((p) => p.id === productId);
  if (found) return found;
  // Default to single
  return plans[0]!;
}

/**
 * Formats a monetary amount in minor units (cents/kobo/pence) to a localized currency string.
 * Example: 299, 'usd' => "$2.99"
 * Example: 500000, 'ngn' => "₦5,000"
 */
export function formatMoney(amountMinor: number, currency: string): string {
  const code = currency.toUpperCase();
  const majorUnits = amountMinor / 100;

  try {
    const fractionDigits = code === "NGN" ? 0 : 2;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(majorUnits);
  } catch {
    const symbol = code === "NGN" ? "₦" : code === "GBP" ? "£" : "$";
    return `${symbol}${majorUnits.toFixed(2)}`;
  }
}
