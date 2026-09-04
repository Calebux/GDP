import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as extractRoute } from "@/app/api/brief/extract/route.js";
import { extractHeuristically } from "@/lib/brief-heuristics.js";
import { smartBriefToDesignBrief } from "@/lib/pack-service.js";
import { SmartBrief } from "@gdp/core";

const extract = (text: string) =>
  extractRoute(
    new NextRequest("http://localhost:3000/api/brief/extract", {
      method: "POST",
      body: JSON.stringify({ text }),
    })
  );

describe("brief extraction", () => {
  describe("category vs business type", () => {
    it("does not read a weekend trading day as a church", () => {
      // "Sunday" and "service" used to trigger the church category, which then
      // blanked businessType and cost the design its visual direction.
      const brief = extractHeuristically(
        "Cafe Nord does bottomless mimosas at weekend brunch, 11am til 3pm every Saturday and Sunday"
      );
      expect(brief.promotionType).toBe("promotion");
      expect(brief.businessType).toBe("restaurant");
    });

    it("still recognises an actual church", () => {
      const brief = extractHeuristically("Grace City Chapel Easter worship service, 9am and 11am");
      expect(brief.promotionType).toBe("church");
      expect(brief.businessType).toBe("");
    });

    it("only ever emits a category the picker offers", () => {
      const samples = [
        "Taco Tuesday at the food truck",
        "Nail salon valentines special",
        "Live concert this Friday night",
        "Something entirely unclassifiable",
      ];
      for (const text of samples) {
        expect(["promotion", "church", "event"]).toContain(extractHeuristically(text).promotionType);
      }
    });
  });

  describe("what it will and will not claim", () => {
    it("leaves fields it cannot source from the text empty", () => {
      const brief = extractHeuristically("Weekend sale");
      expect(brief.date).toBe("");
      expect(brief.time).toBe("");
      expect(brief.location).toBe("");
      expect(brief.brandName).toBe("");
      expect(brief.promoCode).toBe("");
    });

    it("picks up an offer, a promo code and a website when stated", () => {
      const brief = extractHeuristically(
        "Summer flash sale at our boutique, 30% off storewide. Code SUMMER30. urbanstyle.co"
      );
      expect(brief.offer).toBe("30% OFF");
      expect(brief.promoCode).toBe("SUMMER30");
      expect(brief.website).toBe("urbanstyle.co");
    });

    it("produces a headline rather than the whole sentence", () => {
      const brief = extractHeuristically(
        "Summer flash sale, 30% off storewide this weekend only at our downtown boutique on Grand Avenue"
      );
      expect(brief.title.length).toBeLessThanOrEqual(60);
      expect(brief.title).toBe("Summer flash sale");
    });
  });

  describe("businessType reaches the design brief", () => {
    it("routes the extracted trade into the design direction", () => {
      const extracted = extractHeuristically("Cafe Nord weekend brunch, bottomless mimosas");
      const brief = SmartBrief.parse({ title: "Weekend Brunch", ...extracted });
      expect(smartBriefToDesignBrief(brief).businessType).toBe("restaurant");
    });

    it("falls back to promotionType for briefs written before the split", () => {
      const brief = SmartBrief.parse({ title: "Taco Tuesday", promotionType: "restaurant" });
      expect(smartBriefToDesignBrief(brief).businessType).toBe("restaurant");
    });

    it("keeps businessType empty for a church", () => {
      const brief = SmartBrief.parse({ title: "Easter Service", promotionType: "church" });
      expect(smartBriefToDesignBrief(brief).businessType).toBe("");
    });
  });

  describe("the endpoint", () => {
    it("extracts and reports which path produced the result", async () => {
      const res = await extract("Taco Tuesday at La Taqueria, 2-for-1 tacos every Tuesday 5pm to 10pm");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.brief.promotionType).toBe("promotion");
      expect(typeof data.usedModel).toBe("boolean");
    });

    it("rejects empty and oversized input", async () => {
      expect((await extract("   ")).status).toBe(400);
      expect((await extract("x".repeat(4001))).status).toBe(400);
    });
  });
});
