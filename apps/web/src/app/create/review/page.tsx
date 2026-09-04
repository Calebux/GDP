"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBriefStore } from "@/lib/brief-store";
import { PACK_FORMATS } from "@gdp/core";

export default function ReviewPage() {
  const router = useRouter();
  const { brief } = useBriefStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate concepts");
      }

      router.push(`/packs/${data.packId}`);
    } catch (err: any) {
      setError(err?.message || "Something went wrong while composing your concepts");
      setLoading(false);
    }
  };

  const selectedFormatNames = PACK_FORMATS.filter((f) =>
    brief.requestedFormats.includes(f.id as any)
  ).map((f) => f.name);

  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* Progress Header */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/create/brief"
          className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Edit Details
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-400">Step 3 of 3</span>
          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="w-full h-full bg-amber-400 rounded-full"></div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
          Review Your Brief
        </h1>
        <p className="text-sm text-zinc-400">
          Everything looks ready. Our design engine will evaluate thousands of typography and layout rules to compose three distinct concepts.
        </p>
      </div>

      {/* Review Card */}
      <div className="glass-panel-elevated p-6 space-y-6 mb-8">
        <div className="border-b border-white/5 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Headline &amp; Title</span>
            <span className="pulse-badge text-[10px]">{brief.promotionType}</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            {brief.eventName || brief.title || "Untitled Promotion"}
          </h2>
          {brief.brandName && (
            <p className="text-xs text-amber-400/90 font-medium mt-0.5">by {brief.brandName}</p>
          )}
        </div>

        {/* Offer / Details */}
        {(brief.offer || brief.offerDetail || brief.promoCode) && (
          <div className="border-b border-white/5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {brief.offer && (
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block">The Offer</span>
                <span className="text-sm font-semibold text-white">{brief.offer}</span>
              </div>
            )}
            {brief.offerDetail && (
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block">Offer Details</span>
                <span className="text-sm text-zinc-300">{brief.offerDetail}</span>
              </div>
            )}
            {brief.promoCode && (
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block">Promo Code</span>
                <span className="text-sm font-mono text-amber-400">{brief.promoCode}</span>
              </div>
            )}
          </div>
        )}

        {/* Date, Time, Venue */}
        {(brief.date || brief.time || brief.location) && (
          <div className="border-b border-white/5 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {brief.date && (
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block">Date</span>
                <span className="text-xs text-zinc-200">{brief.date}</span>
              </div>
            )}
            {brief.time && (
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block">Time</span>
                <span className="text-xs text-zinc-200">{brief.time}</span>
              </div>
            )}
            {brief.location && (
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block">Location</span>
                <span className="text-xs text-zinc-200">{brief.location}</span>
              </div>
            )}
          </div>
        )}

        {/* Action & Channels */}
        <div className="border-b border-white/5 pb-4 flex flex-wrap gap-6">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block">Call to Action</span>
            <span className="text-xs text-white font-medium">{brief.CTA || "Join Us"}</span>
          </div>
          {brief.website && (
            <div>
              <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block">Website</span>
              <span className="text-xs text-zinc-300 font-mono">{brief.website}</span>
            </div>
          )}
        </div>

        {/* Formats to generate */}
        <div>
          <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block mb-2">
            Pack Output Formats ({selectedFormatNames.length})
          </span>
          <div className="flex flex-wrap gap-2">
            {selectedFormatNames.map((name, i) => (
              <span
                key={i}
                className="text-xs bg-white/5 border border-white/10 text-zinc-300 px-3 py-1 rounded-md font-medium"
              >
                &bull; {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-xs mb-6">
          {error}
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/create/brief"
          className="btn-secondary flex-1 text-center py-4 font-semibold text-sm"
        >
          Edit Brief
        </Link>
        <button
          type="button"
          id="generate-concepts-button"
          onClick={handleGenerate}
          disabled={loading}
          className="btn-primary flex-2 py-4 text-base font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Generating 3 Concepts...</span>
            </>
          ) : (
            <>
              <span>Generate 3 Concepts</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
