import { createLogger } from "@gdp/core";
import { BUSINESS_TYPES, PROMOTION_CATEGORY_IDS } from "@gdp/core";
import { structuredOrFallback } from "@gdp/planner";
import { BriefExtraction, extractHeuristically } from "./brief-heuristics";

const log = createLogger("brief-extractor");

export interface ExtractionResult {
  brief: BriefExtraction;
  /** False when the deterministic fallback produced this. */
  usedModel: boolean;
  model?: string;
}

const SYSTEM = `You turn a small business owner's description of a promotion into structured brief fields.

Rules:
- Extract only what the text states or clearly implies. Never invent a date, price, discount, address, phone number, promo code or brand name.
- Leave a field as an empty string when the text does not give it. An empty field is correct; a plausible guess is not.
- title: the headline of the promotion, not a sentence about it. Keep it short.
- offer: the deal itself, e.g. "20% OFF ALL ITEMS", "2-FOR-1 TACOS". Empty if there is no offer.
- businessType: one of ${BUSINESS_TYPES.join(", ")} — or empty if none fits. Empty for churches.
- promotionType: one of ${PROMOTION_CATEGORY_IDS.join(", ")}.
- feeling: a few words on the tone the design should carry, only if the text suggests one.
- Copy dates and times as the owner wrote them ("Every Sat & Sun", "5PM - 10PM"). Do not normalise or resolve them.`;

export async function extractBrief(text: string): Promise<ExtractionResult> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Describe your promotion first");

  const { value, usedModel, model } = await structuredOrFallback<BriefExtraction>(
    {
      task: "brief",
      system: SYSTEM,
      prompt: trimmed,
      schema: BriefExtraction,
      toolName: "promotion_brief",
      maxTokens: 1024,
      temperature: 0,
    },
    () => extractHeuristically(trimmed),
  );

  log.info("Extracted brief", { usedModel, chars: trimmed.length });
  return { brief: value, usedModel, model };
}
