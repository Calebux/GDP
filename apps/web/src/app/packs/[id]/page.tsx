"use client";

import { useState, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { ConceptPreview, Pack } from "@gdp/core";
import { PACK_FORMATS } from "@gdp/core";
import type { FormatId } from "@gdp/design-schema";

export default function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();

  const [pack, setPack] = useState<Pack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedConcept, setSelectedConcept] = useState<ConceptPreview | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<FormatId[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Fetch pack details
  const loadPack = async () => {
    try {
      const res = await fetch(`/api/packs/${id}`);
      if (!res.ok) throw new Error("Could not find this promo pack");
      const data = await res.json();
      setPack(data.pack);

      if (data.pack.selectedConceptId) {
        const found = data.pack.concepts.find(
          (c: ConceptPreview) => c.id === data.pack.selectedConceptId
        );
        if (found) setSelectedConcept(found);
      }
      if (data.pack.requestedFormats) {
        setSelectedFormats(data.pack.requestedFormats);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load pack");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPack();
  }, [id]);

  // Handle return from checkout (e.g. ?payment=success&session_id=... or ?payment=dev_mock)
  useEffect(() => {
    const payment = searchParams.get("payment");
    const sessionId = searchParams.get("session_id");

    if ((payment === "success" || payment === "dev_mock") && sessionId) {
      setPaymentProcessing(true);
      // Verify payment with server
      fetch(`/api/packs/${id}/payment-status?session_id=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.paid && data.pack) {
            setPack(data.pack);
          }
        })
        .catch(() => {})
        .finally(() => {
          setPaymentProcessing(false);
        });
    }
  }, [id, searchParams]);

  // Poll while packaging
  useEffect(() => {
    if (pack?.status === "packaging") {
      const interval = setInterval(async () => {
        const res = await fetch(`/api/packs/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.pack.status === "packaged") {
            setPack(data.pack);
            clearInterval(interval);
          }
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [pack?.status, id]);

  const handleSelectConcept = async (concept: ConceptPreview) => {
    setActionLoading(true);
    setSelectedConcept(concept);
    try {
      const res = await fetch(`/api/packs/${id}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptId: concept.id,
          requestedFormats: selectedFormats.length > 0 ? selectedFormats : pack?.requestedFormats,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to select concept");
      setPack(data.pack);
    } catch (err: any) {
      setError(err?.message || "Selection failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckout = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/packs/${id}/checkout`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initiate checkout");

      // Redirect to checkout URL
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      setError(err?.message || "Checkout failed");
      setActionLoading(false);
    }
  };

  const toggleFormat = (fId: FormatId) => {
    const next = selectedFormats.includes(fId)
      ? selectedFormats.filter((f) => f !== fId)
      : [...selectedFormats, fId];
    if (next.length > 0) {
      setSelectedFormats(next);
      // Persist selection change
      if (selectedConcept) {
        fetch(`/api/packs/${id}/select`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conceptId: selectedConcept.id, requestedFormats: next }),
        }).catch(() => {});
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6 animate-pulse">
          <svg className="w-8 h-8 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Creating your concepts...</h2>
        <p className="text-zinc-400 text-sm max-w-md">
          Applying 12 layout archetypes, balancing optical typography, and solving geometry with deterministic quality gates.
        </p>
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="max-w-md mx-auto my-12 glass-panel p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
          ✗
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Error</h2>
        <p className="text-sm text-zinc-400 mb-6">{error || "Pack not found"}</p>
        <Link href="/" className="btn-secondary text-xs">
          Start New Promo
        </Link>
      </div>
    );
  }

  const isPackaged = pack.status === "packaged";
  const isPaid = pack.status === "paid" || isPackaged;

  return (
    <div className="pb-16 max-w-5xl mx-auto">
      {/* Title & Info Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="pulse-badge text-[10px]">
              {pack.brief.promotionType || "Promo Pack"}
            </span>
            <span className="text-xs text-zinc-400">&bull; 3 Concepts Composed</span>
            {isPaid && (
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                ✓ UNLOCKED
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {pack.brief.eventName || pack.brief.title || "Your Promo Campaign"}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {isPaid ? (
            <a
              href={`/api/packs/${pack.id}/download`}
              id="download-pack-button"
              className="btn-primary text-sm py-3 px-6 font-bold shadow-emerald-500/20 bg-gradient-to-tr from-emerald-500 to-emerald-400 text-black"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download ZIP Pack
            </a>
          ) : (
            <div className="text-right">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block font-semibold">Free Watermarked Preview</span>
              <span className="text-xs text-amber-400 font-medium">Select a concept to unlock full pack</span>
            </div>
          )}
        </div>
      </div>

      {/* STATE 8 & 9: PAYMENT PROCESSING OR PACKAGING */}
      {paymentProcessing && (
        <div className="glass-panel-elevated p-6 mb-8 border-amber-500/30 text-center animate-pulse">
          <div className="text-amber-400 font-bold mb-1">Verifying Payment...</div>
          <p className="text-xs text-zinc-400">Confirming your transaction and preparing download credentials.</p>
        </div>
      )}

      {pack.status === "packaging" && (
        <div className="glass-panel-elevated p-6 mb-8 border-amber-500/30 text-center">
          <div className="flex items-center justify-center gap-2 text-amber-400 font-bold mb-2">
            <svg className="animate-spin h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            Preparing your design pack...
          </div>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Recomposing approved design across all requested dimensions with unwatermarked full-resolution assets and manifest.json.
          </p>
        </div>
      )}

      {/* STATE 10: READY FOR DOWNLOAD */}
      {isPackaged && (
        <div className="glass-panel-elevated p-6 mb-10 border-emerald-500/30 bg-emerald-950/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-bold">
                ✓
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Your design pack is ready!</h3>
                <p className="text-xs text-zinc-400">
                  Full-resolution, unwatermarked files across all formats + manifest.json
                </p>
              </div>
            </div>
            <a
              href={`/api/packs/${pack.id}/download`}
              className="btn-primary py-3.5 px-8 font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-emerald-500/20 hover:scale-105"
            >
              Download pack.zip
            </a>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex flex-wrap gap-2 text-xs">
            {selectedFormats.map((fId) => {
              const info = PACK_FORMATS.find((pf) => pf.id === fId);
              return (
                <span key={fId} className="bg-white/5 px-2.5 py-1 rounded text-zinc-300 font-mono text-[11px]">
                  {info?.name || fId} ({info?.width}&times;{info?.height})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* STATE 5: CONCEPTS (3 CARDS SIDE-BY-SIDE) */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Choose Your Design Concept</span>
            <span className="text-xs text-zinc-400 font-normal">(Free Watermarked Previews)</span>
          </h2>
          <span className="text-xs text-zinc-400">
            Click any concept to inspect and unlock
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pack.concepts.map((concept, idx) => {
            const isSelected = selectedConcept?.id === concept.id;
            return (
              <div
                key={concept.id}
                onClick={() => handleSelectConcept(concept)}
                className={`glass-panel p-4 rounded-2xl flex flex-col transition-all cursor-pointer relative group ${
                  isSelected
                    ? "border-amber-400 ring-2 ring-amber-400/20 bg-white/[0.04]"
                    : "hover:border-white/20 hover:bg-white/[0.02]"
                }`}
              >
                {/* Concept index & score */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Concept 0{idx + 1}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    VQS {concept.vqs}
                  </span>
                </div>

                {/* Preview Image with non-bypassable server watermark */}
                <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-black/50 border border-white/5 mb-4 group-hover:scale-[1.01] transition-transform">
                  <Image
                    src={concept.previewUrl}
                    alt={concept.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-zinc-400 border border-white/10">
                    Watermarked
                  </div>
                </div>

                {/* Concept Info */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-white mb-1">{concept.title}</h3>
                    <p className="text-xs text-zinc-400 mb-2 line-clamp-2">{concept.description}</p>
                    <span className="inline-block text-[10px] bg-white/5 text-zinc-400 px-2 py-0.5 rounded font-mono">
                      Direction: {concept.visualDirection}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`w-full mt-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                      isSelected
                        ? "bg-amber-400 text-black"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {isSelected ? "✓ Selected" : "Select Concept"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STATE 6 & 7: SELECTED CONCEPT & PAYWALL */}
      {selectedConcept && !isPaid && (
        <div className="glass-panel-elevated p-6 sm:p-8 rounded-3xl border-amber-500/30 mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: Preview */}
            <div className="lg:col-span-5">
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
                <Image
                  src={selectedConcept.previewUrl}
                  alt={selectedConcept.title}
                  fill
                  sizes="400px"
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute bottom-3 left-3 right-3 bg-black/80 backdrop-blur-md p-2 rounded-xl text-center text-xs text-zinc-300 border border-white/10">
                  Preview Quality &bull; Watermark removed on unlock
                </div>
              </div>
            </div>

            {/* Right: Unlock Paywall */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <span className="pulse-badge text-[10px] mb-2">D-03 Paywall &bull; Ready to Export</span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Unlock Your Complete Promo Pack
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  You selected <strong className="text-white">{selectedConcept.title}</strong>. One small fee unlocks all unwatermarked, 300 DPI &amp; web-optimized formats.
                </p>
              </div>

              {/* Formats Checklist */}
              <div>
                <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold block mb-3">
                  Formats Generated in Your Pack:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PACK_FORMATS.map((f) => {
                    const active = selectedFormats.includes(f.id as FormatId);
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleFormat(f.id as FormatId)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                          active
                            ? "bg-amber-500/10 border-amber-500/30 text-white"
                            : "bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/5"
                        }`}
                      >
                        <span className={`text-xs ${active ? "text-amber-400 font-bold" : "text-zinc-600"}`}>
                          {active ? "✓" : "+"}
                        </span>
                        <span className="font-semibold">{f.name}</span>
                        <span className="text-[10px] text-zinc-400 font-mono ml-auto">
                          {f.width}&times;{f.height}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Price & CTA */}
              <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white">$2.99</span>
                    <span className="text-xs text-zinc-400 line-through">$19.00</span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      SINGLE PACK FEE
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    No subscriptions. Lifetime unwatermarked commercial license.
                  </p>
                </div>

                <button
                  type="button"
                  id="unlock-pack-button"
                  onClick={handleCheckout}
                  disabled={actionLoading}
                  className="btn-primary w-full sm:w-auto py-4 px-8 font-bold text-base shadow-amber-500/30 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "Unlock & Download"}
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
