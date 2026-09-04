"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SmartBrief } from "@gdp/core";
import { extractHeuristically } from "./brief-heuristics";

export const DEFAULT_BRIEF: SmartBrief = {
  promotionType: "promotion",
  title: "",
  description: "",
  objective: "",
  targetAudience: "",
  brandName: "",
  eventName: "",
  date: "",
  time: "",
  location: "",
  offer: "",
  offerDetail: "",
  promoCode: "",
  CTA: "Learn More",
  website: "",
  phone: "",
  email: "",
  socialHandles: "",
  businessType: "",
  brandColors: [],
  requestedFormats: ["ig-portrait", "ig-square", "story", "facebook"],
  additionalInstructions: "",
  styleDirection: "",
  feeling: "bold, modern and high impact",
  images: [],
};

interface BriefState {
  brief: SmartBrief;
  initialQuestionAnswered: boolean;
  updateBrief: (partial: Partial<SmartBrief>) => void;
  setInitialAnswer: (promotion: string) => void;
  resetBrief: () => void;
}

export const useBriefStore = create<BriefState>()(
  persist(
    (set) => ({
      brief: DEFAULT_BRIEF,
      initialQuestionAnswered: false,

      updateBrief: (partial) =>
        set((state) => ({
          brief: { ...state.brief, ...partial },
        })),

      setInitialAnswer: (answer) =>
        set((state) => {
          // Categories must stay within what the picker offers, or a REQUIRED
          // field renders with nothing selected. The trade ("restaurant") goes
          // to businessType, which is what steers the design direction.
          const { promotionType, businessType } = extractHeuristically(answer);

          return {
            brief: {
              ...state.brief,
              title: answer,
              eventName: answer,
              promotionType,
              businessType: businessType || state.brief.businessType,
            },
            initialQuestionAnswered: true,
          };
        }),

      resetBrief: () =>
        set({
          brief: DEFAULT_BRIEF,
          initialQuestionAnswered: false,
        }),
    }),
    {
      name: "gdp-brief-storage",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
