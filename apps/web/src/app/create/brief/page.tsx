"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBriefStore } from "@/lib/brief-store";
import { PACK_FORMATS, PROMOTION_CATEGORIES } from "@gdp/core";
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
    businessType: brief.businessType || "",
    requestedFormats: (brief.requestedFormats.length > 0
      ? brief.requestedFormats
      : ["ig-portrait", "ig-square", "story", "facebook"]) as FormatId[],
    feeling: brief.feeling || "bold and modern",
  });

  const [describeText, setDescribeText] = useState("");
  const [describing, setDescribing] = useState(false);
  const [describeError, setDescribeError] = useState("");
  const [filledFields, setFilledFields] = useState<string[]>([]);
  const [usedModel, setUsedModel] = useState(false);

  const isChurch = formData.promotionType === "church";

  /**
   * Fill the form from a free-text description. Only non-empty extracted
   * values are applied, so this never blanks something the customer typed.
   */
  const handleDescribe = async () => {
    if (!describeText.trim()) return;
    setDescribing(true);
    setDescribeError("");
    setFilledFields([]);

    try {
      const res = await fetch("/api/brief/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: describeText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read that description");

      setUsedModel(Boolean(data.usedModel));
      const applied: string[] = [];
      setFormData((prev) => {
        const next = { ...prev };
        for (const [key, value] of Object.entries(data.brief as Record<string, string>)) {
          if (typeof value === "string" && value.trim() && key in next) {
            (next as Record<string, unknown>)[key] = value;
            applied.push(key);
          }
        }
        return next;
      });
      setFilledFields(applied);
    } catch (err) {
      setDescribeError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDescribing(false);
    }
  };

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
          className="text-xs font-semibold text-muted hover:text-ink flex items-center gap-1.5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-accent">Step 2 of 3</span>
          <div className="w-24 h-1.5 bg-fill-strong rounded-full overflow-hidden">
            <div className="w-2/3 h-full bg-amber-400 rounded-full"></div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight mb-2">
          Fine-tune the details
        </h1>
        <p className="text-sm text-muted">
          We&apos;ve customized these follow-ups based on your promotion. Optional fields can be skipped.
        </p>
      </div>

      {/* Describe-it-in-your-own-words shortcut. The form stays the source of
          truth — this only pre-fills it, and every value is editable after. */}
      <div className="glass-panel p-5 mb-6 border-accent-border">
        <label
          htmlFor="describe-input"
          className="text-xs font-bold text-muted uppercase tracking-wider block mb-2"
        >
          Or describe it in your own words
          <span className="text-faint normal-case tracking-normal font-medium"> — we&apos;ll fill in what we can</span>
        </label>
        <textarea
          id="describe-input"
          rows={3}
          value={describeText}
          onChange={(e) => {
            setDescribeText(e.target.value);
            if (describeError) setDescribeError("");
          }}
          placeholder="e.g. Cafe Nord is doing bottomless mimosas for $15 at weekend brunch, 11am til 3pm every Saturday and Sunday at 104 Grand Ave"
          className="input-field resize-y"
        />
        <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
          <div className="text-xs min-h-[1rem]">
            {describeError && <span className="text-negative font-medium">{describeError}</span>}
            {!describeError && filledFields.length > 0 && (
              <span className="text-positive font-medium">
                Filled {filledFields.length} field{filledFields.length === 1 ? "" : "s"} — check them below
                {!usedModel && (
                  <span className="text-faint font-normal"> (keyword match; set ANTHROPIC_API_KEY for better results)</span>
                )}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleDescribe}
            disabled={describing || !describeText.trim()}
            className="btn-secondary text-xs py-2 px-4 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {describing ? "Reading..." : "Fill the form"}
          </button>
        </div>
      </div>

      <form onSubmit={handleReview} className="space-y-6">
        {/* Category selector */}
        <div className="glass-panel p-4">
          <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-2">
            Promotion Category <span className="text-accent">&bull; REQUIRED</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PROMOTION_CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat.id}
                onClick={() => setFormData({ ...formData, promotionType: cat.id })}
                className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  formData.promotionType === cat.id
                    ? "bg-accent-surface border-accent text-accent-strong"
                    : "bg-fill border-line text-muted hover:bg-fill-strong"
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
            <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
              {isChurch ? "Event or Service Name" : "Campaign / Promotion Name"}{" "}
              <span className="text-accent">&bull; REQUIRED</span>
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
            <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
              Organization / Brand Name <span className="text-faint">&bull; OPTIONAL</span>
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
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                The Offer / Deal Headline <span className="text-accent">&bull; RECOMMENDED</span>
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
                <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                  Offer Detail <span className="text-faint">&bull; OPTIONAL</span>
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
                <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                  Promo Code <span className="text-faint">&bull; OPTIONAL</span>
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
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                Date <span className="text-faint">&bull; OPTIONAL</span>
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
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                Time <span className="text-faint">&bull; OPTIONAL</span>
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
            <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
              Location / Venue <span className="text-faint">&bull; OPTIONAL</span>
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
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                Call to Action <span className="text-faint">&bull; OPTIONAL</span>
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
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                Website or Social Handle <span className="text-faint">&bull; OPTIONAL</span>
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
          <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-2">
            Target Formats Included in Your Pack <span className="text-accent">&bull; REQUIRED</span>
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
                      ? "bg-accent-surface border-accent-border text-ink"
                      : "bg-fill-soft border-line text-muted hover:bg-fill"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">{format.name}</span>
                    <span className="text-[11px] text-muted mt-0.5">
                      {format.width}&times;{format.height} &bull; {format.description}
                    </span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      selected ? "bg-amber-400 border-accent text-black" : "border-line-strong bg-transparent"
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
