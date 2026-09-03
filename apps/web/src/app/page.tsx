"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBriefStore } from "@/lib/brief-store";

export default function EntryPage() {
  const router = useRouter();
  const { brief, setInitialAnswer } = useBriefStore();
  const [input, setInput] = useState(brief.title || "");
  const [error, setError] = useState("");

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
      setError("Please enter what you want to promote to continue");
      return;
    }

    setInitialAnswer(input.trim());
    router.push("/create/brief");
  };

  const suggestions = [
    "Easter Sunday Service",
    "Grand Opening \u2014 20% Off All Orders",
    "Youth Leadership Conference",
    "Weekend Brunch & Live Music",
    "Valentine's Nails & Spa Special",
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] max-w-2xl mx-auto text-center px-4">
      {/* Badge */}
      <div className="pulse-badge mb-6 animate-fade-in">
        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
        <span>Outcome-First Design &bull; D-01</span>
      </div>

      {/* Main Question */}
      <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
        What are you promoting?
      </h1>

      <p className="text-base sm:text-lg text-zinc-400 max-w-lg mx-auto mb-8 font-normal">
        Answer in your own words. The engine will compose three complete, ready-to-use promo concepts for your campaign.
      </p>

      {/* Input Form */}
      <form onSubmit={handleContinue} className="w-full space-y-4">
        <div className="relative">
          <input
            type="text"
            id="initial-promotion-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError("");
            }}
            placeholder="e.g. A church conference, restaurant opening, product launch..."
            className="input-field text-lg py-4 px-5 text-white placeholder-zinc-500 shadow-2xl focus:scale-[1.01]"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm font-medium text-left px-1">
            {error}
          </p>
        )}

        <button
          type="submit"
          id="entry-continue-button"
          className="btn-primary w-full text-lg py-4 font-bold shadow-amber-500/20"
        >
          Continue
          <svg
            className="w-5 h-5 ml-2 -mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </button>
      </form>

      {/* Fast suggestions */}
      <div className="mt-8 text-left w-full">
        <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-3">
          Popular examples to try:
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInput(s);
                setError("");
              }}
              className="text-xs text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 rounded-full px-3.5 py-2 transition-colors cursor-pointer"
            >
              &ldquo;{s}&rdquo;
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
