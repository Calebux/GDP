"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBriefStore } from "@/lib/brief-store";
import { PACK_FORMATS } from "@gdp/core";
import type { FormatId } from "@gdp/design-schema";

export default function SmartBriefPage() {
  const router = useRouter();
  const { brief, updateBrief } = useBriefStore();

  // If user navigated directly here without entering anything, redirect to entry
  useEffect(() => {
    if (!brief.title && !brief.eventName) {
      router.replace("/");
    }
  }, [brief, router]);

  const [formData, setFormData] = useState({
    title: brief.title || brief.eventName || "",
    brandName: brief.brandName || "",
    promotionType: brief.promotionType || "promotion",
    offer: brief.offer || "",
    offerDetail: brief.offerDetail || "",
    promoCode: brief.promoCode || "",
    date: brief.date || "",
    time: brief.time || "",
    location: brief.location || "",
    CTA: brief.CTA || "Join Us",
    website: brief.website || "",
    socialHandles: brief.socialHandles || "",
    requestedFormats: (brief.requestedFormats.length > 0
      ? brief.requestedFormats
      : ["ig-portrait", "ig-square", "story", "facebook"]) as FormatId[],
    feeling: brief.feeling || "bold and modern",
  });

  const isChurch = formData.promotionType === "church";

  const handleFormatToggle = (formatId: FormatId) => {
    setFormData((prev) => {
      const exists = prev.requestedFormats.includes(formatId);
      const next = exists
        ? (prev.requestedFormats.filter((f) => f !== formatId) as FormatId[])
        : [...prev.requestedFormats, formatId];
      // Keep at least one format selected
      return { ...prev, requestedFormats: next.length > 0 ? next : ([formatId] as FormatId[]) };
    });
  };

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    updateBrief(formData);
    router.push("/create/review");
  };

  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* Progress Header */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-400">Step 2 of 3</span>
          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="w-2/3 h-full bg-amber-400 rounded-full"></div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
          Fine-tune the details
        </h1>
        <p className="text-sm text-zinc-400">
          We&apos;ve customized these follow-ups based on your promotion. Optional fields can be skipped.
        </p>
      </div>

      <form onSubmit={handleReview} className="space-y-6">
        {/* Category selector */}
        <div className="glass-panel p-4">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
            Promotion Category <span className="text-amber-400">&bull; REQUIRED</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "promotion", label: "Business Promo" },
              { id: "church", label: "Church & Ministry" },
              { id: "event", label: "Event / Concert" },
            ].map((cat) => (
              <button
                type="button"
                key={cat.id}
                onClick={() => setFormData({ ...formData, promotionType: cat.id })}
                className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  formData.promotionType === cat.id
                    ? "bg-amber-500/20 border-amber-400 text-amber-300"
                    : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Event/Campaign Title */}
        <div className="glass-panel p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
              {isChurch ? "Event or Service Name" : "Campaign / Promotion Name"}{" "}
              <span className="text-amber-400">&bull; REQUIRED</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="input-field"
              placeholder={isChurch ? "e.g. Breakthrough Night 2026" : "e.g. Summer Flash Sale"}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Organization / Brand Name <span className="text-zinc-500">&bull; OPTIONAL</span>
            </label>
            <input
              type="text"
              value={formData.brandName}
              onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
              className="input-field"
              placeholder={isChurch ? "e.g. Grace City Chapel" : "e.g. Urban Kicks Co."}
            />
          </div>
        </div>

        {/* Contextual Offer vs Speakers */}
        {!isChurch ? (
          <div className="glass-panel p-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                The Offer / Deal Headline <span className="text-amber-400">&bull; RECOMMENDED</span>
              </label>
              <input
                type="text"
                value={formData.offer}
                onChange={(e) => setFormData({ ...formData, offer: e.target.value })}
                className="input-field"
                placeholder="e.g. 20% OFF ALL ITEMS or FREE APERITIVO"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Offer Detail <span className="text-zinc-500">&bull; OPTIONAL</span>
                </label>
                <input
                  type="text"
                  value={formData.offerDetail}
                  onChange={(e) => setFormData({ ...formData, offerDetail: e.target.value })}
                  className="input-field"
                  placeholder="e.g. First 50 guests only"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Promo Code <span className="text-zinc-500">&bull; OPTIONAL</span>
                </label>
                <input
                  type="text"
                  value={formData.promoCode}
                  onChange={(e) => setFormData({ ...formData, promoCode: e.target.value })}
                  className="input-field"
                  placeholder="e.g. FLASH20"
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* Date, Time, Location */}
        <div className="glass-panel p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Date <span className="text-zinc-500">&bull; OPTIONAL</span>
              </label>
              <input
                type="text"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="input-field"
                placeholder="e.g. Sunday, Oct 18 or ALL THIS WEEK"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Time <span className="text-zinc-500">&bull; OPTIONAL</span>
              </label>
              <input
                type="text"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="input-field"
                placeholder="e.g. 10:00 AM & 6:00 PM"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Location / Venue <span className="text-zinc-500">&bull; OPTIONAL</span>
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="input-field"
              placeholder="e.g. Main Auditorium / 104 Grand Ave / Live on YouTube"
            />
          </div>
        </div>

        {/* Action & Channels */}
        <div className="glass-panel p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Call to Action <span className="text-zinc-500">&bull; OPTIONAL</span>
              </label>
              <input
                type="text"
                value={formData.CTA}
                onChange={(e) => setFormData({ ...formData, CTA: e.target.value })}
                className="input-field"
                placeholder="e.g. Reserve a Seat, Book Now"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Website or Social Handle <span className="text-zinc-500">&bull; OPTIONAL</span>
              </label>
              <input
                type="text"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="input-field"
                placeholder="e.g. yoursite.com / @handle"
              />
            </div>
          </div>
        </div>

        {/* Requested Formats (D-01 & D-05) */}
        <div className="glass-panel p-5">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
            Target Formats Included in Your Pack <span className="text-amber-400">&bull; REQUIRED</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {PACK_FORMATS.map((format) => {
              const selected = formData.requestedFormats.includes(format.id as FormatId);
              return (
                <div
                  key={format.id}
                  onClick={() => handleFormatToggle(format.id as FormatId)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all select-none ${
                    selected
                      ? "bg-amber-500/10 border-amber-500/40 text-white"
                      : "bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">{format.name}</span>
                    <span className="text-[11px] text-zinc-400 mt-0.5">
                      {format.width}&times;{format.height} &bull; {format.description}
                    </span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      selected ? "bg-amber-400 border-amber-400 text-black" : "border-zinc-600 bg-transparent"
                    }`}
                  >
                    {selected && (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA Button */}
        <div className="pt-2">
          <button
            type="submit"
            id="review-brief-button"
            className="btn-primary w-full text-base py-4 font-bold"
          >
            Review Brief &amp; Generate Concepts
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
