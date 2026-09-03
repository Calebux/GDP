"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SmartBrief } from "@gdp/core";

export const DEFAULT_BRIEF: SmartBrief = {
  promotionType: "event",
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
          const lower = answer.toLowerCase();
          let promoType = "promotion";
          if (lower.includes("church") || lower.includes("service") || lower.includes("worship") || lower.includes("conference")) {
            promoType = "church";
          } else if (lower.includes("restaurant") || lower.includes("cafe") || lower.includes("food") || lower.includes("bar")) {
            promoType = "restaurant";
          } else if (lower.includes("product") || lower.includes("launch") || lower.includes("sale") || lower.includes("discount")) {
            promoType = "promotion";
          } else if (lower.includes("party") || lower.includes("night") || lower.includes("festival")) {
            promoType = "event";
          }

          return {
            brief: {
              ...state.brief,
              title: answer,
              eventName: answer,
              promotionType: promoType,
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
