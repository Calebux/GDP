"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";

interface BlindSample {
  sampleId: string;
  previewUrl: string;
  totalSamples: number;
  currentIndex: number;
}

export default function BlindRaterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [queue, setQueue] = useState<BlindSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());

  const [ratings, setRatings] = useState({
    visualQuality: 3,
    professionalism: 3,
    clarity: 3,
    likelihoodToUse: 3,
    willingnessToPayBracket: "1-3" as "0" | "1-3" | "3-5" | "5-10" | "10+",
    qualitativeFeedback: "",
  });

  const loadQueue = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/research/experiment/${token}`);
      if (!res.ok) {
        throw new Error("Unable to load blinded review queue. Invalid or expired rater token.");
      }
      const data = await res.json();
      setQueue(data.queue || []);
      setStartTime(Date.now());
    } catch (err: any) {
      setError(err?.message || "Failed to load research study.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [token]);

  const currentSample = queue[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSample) return;

    setSubmitting(true);
    const durationMs = Date.now() - startTime;

    try {
      const res = await fetch(`/api/research/experiment/${token}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sampleId: currentSample.sampleId,
          rating: {
            ...ratings,
            durationMs,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit rating.");
      }

      // Move to next sample
      setQueue((prev) => prev.slice(1));
      setRatings({
        visualQuality: 3,
        professionalism: 3,
        clarity: 3,
        likelihoodToUse: 3,
        willingnessToPayBracket: "1-3",
        qualitativeFeedback: "",
      });
      setStartTime(Date.now());
    } catch (err: any) {
      alert(err?.message || "Error submitting evaluation.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-zinc-400 text-sm">Loading blinded study design queue...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 glass-panel border-red-500/30 text-center rounded-2xl">
        <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 mx-auto flex items-center justify-center font-bold mb-3">!</div>
        <h2 className="text-lg font-bold text-white mb-1">Study Access Error</h2>
        <p className="text-xs text-zinc-400">{error}</p>
      </div>
    );
  }

  if (!currentSample) {
    return (
      <div className="max-w-lg mx-auto my-20 p-8 glass-panel-elevated border-emerald-500/30 text-center rounded-3xl animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center font-bold text-xl mb-4">✓</div>
        <h1 className="text-2xl font-extrabold text-white mb-2">Evaluation Complete!</h1>
        <p className="text-sm text-zinc-300 mb-6">
          Thank you for providing your expert design critique. Your blind evaluations have been securely recorded for the VQS calibration experiment.
        </p>
        <span className="text-xs font-mono text-zinc-500">Session ID: {token.slice(0, 12)}...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <div>
          <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">Blind Design Evaluation Study</span>
          <h1 className="text-lg font-bold text-white">Sample #{currentSample.currentIndex} of {currentSample.totalSamples}</h1>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono text-zinc-400">Blinded Protocol &bull; No Metadata Shown</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Design Image */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden bg-black/60 border border-white/10 shadow-2xl">
            <Image
              src={currentSample.previewUrl}
              alt="Design Asset Under Evaluation"
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          <p className="text-[11px] text-zinc-500 mt-2 text-center">
            Carefully inspect composition, typographic hierarchy, balance, and commercial polish.
          </p>
        </div>

        {/* Right: Blind Rating Form */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-3xl space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Visual Quality */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-zinc-200">Visual Quality &amp; Aesthetics</label>
                <span className="text-xs font-bold text-amber-400">{ratings.visualQuality} / 5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={ratings.visualQuality}
                onChange={(e) => setRatings({ ...ratings, visualQuality: Number(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>1 (Poor / Defective)</span>
                <span>3 (Acceptable)</span>
                <span>5 (Exceptional Craft)</span>
              </div>
            </div>

            {/* Professionalism */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-zinc-200">Commercial Professionalism</label>
                <span className="text-xs font-bold text-amber-400">{ratings.professionalism} / 5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={ratings.professionalism}
                onChange={(e) => setRatings({ ...ratings, professionalism: Number(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>1 (Amateurish)</span>
                <span>3 (Standard SMB)</span>
                <span>5 (Design Agency Grade)</span>
              </div>
            </div>

            {/* Clarity & Hierarchy */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-zinc-200">Headline Clarity &amp; Hierarchy</label>
                <span className="text-xs font-bold text-amber-400">{ratings.clarity} / 5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={ratings.clarity}
                onChange={(e) => setRatings({ ...ratings, clarity: Number(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>1 (Unreadable / Chaotic)</span>
                <span>5 (Immediate Scannability)</span>
              </div>
            </div>

            {/* Willingness to Pay */}
            <div>
              <label className="text-xs font-semibold text-zinc-200 block mb-1.5">
                Estimated Commercial Value (Willingness to Pay)
              </label>
              <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                {(["0", "1-3", "3-5", "5-10", "10+"] as const).map((bracket) => (
                  <button
                    key={bracket}
                    type="button"
                    onClick={() => setRatings({ ...ratings, willingnessToPayBracket: bracket })}
                    className={`py-2 px-1 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                      ratings.willingnessToPayBracket === bracket
                        ? "border-amber-400 bg-amber-400/10 text-white font-bold"
                        : "border-white/10 text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    {bracket === "0" ? "$0 Free" : bracket === "10+" ? "$10+" : `$${bracket}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Qualitative Feedback */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Specific Critiques or Defects (Optional)
              </label>
              <textarea
                value={ratings.qualitativeFeedback}
                onChange={(e) => setRatings({ ...ratings, qualitativeFeedback: e.target.value })}
                placeholder="e.g. Excessive empty space in bottom left, kerning on headline is loose, colors feel mismatched..."
                rows={2}
                className="input-field text-xs py-2 px-3 text-white placeholder-zinc-500 w-full"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3 text-sm font-bold shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Saving Evaluation..." : "Submit Rating & Next Design →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
