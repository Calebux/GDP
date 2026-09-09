"use client";

import { useState, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { ConceptPreview, CreditWallet, Pack, PackVersion, ProductPlan } from "@gdp/core";
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

  // D-02: Credit Wallet & Plans
  const [wallet, setWallet] = useState<CreditWallet | null>(null);
  const [plans, setPlans] = useState<ProductPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("single");

  // D-04: Detail Fixer & Versions
  const [versions, setVersions] = useState<PackVersion[]>([]);
  const [editInstruction, setEditInstruction] = useState("");
  const [interpretingEdit, setInterpretingEdit] = useState(false);
  const [pendingPatch, setPendingPatch] = useState<{
    summary: string;
    opsCount: number;
    creditCost: number;
    category?: string;
    isFree?: boolean;
    reason?: string;
  } | null>(null);
  const [applyingEdit, setApplyingEdit] = useState(false);
  const [editSuccessMessage, setEditSuccessMessage] = useState("");

  // D-04: Photo Swapping State
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");

  // D-05: Sharing & Free Export
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load wallet balance
  const loadWallet = async () => {
    try {
      const res = await fetch("/api/wallet");
      if (res.ok) {
        const data = await res.json();
        setWallet(data.wallet);
      }
    } catch {
      // Non-blocking
    }
  };

  // Load regional pricing
  const loadPricing = async () => {
    try {
      const res = await fetch("/api/pricing");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch {
      // Non-blocking
    }
  };

  // Load versions
  const loadVersions = async () => {
    try {
      const res = await fetch(`/api/packs/${id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch {
      // Non-blocking
    }
  };

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
    loadWallet();
    loadPricing();
    loadVersions();
  }, [id]);

  // Handle return from checkout
  useEffect(() => {
    const payment = searchParams.get("payment");
    const sessionId = searchParams.get("session_id");

    if ((payment === "success" || payment === "dev_mock") && sessionId) {
      setPaymentProcessing(true);
      fetch(`/api/packs/${id}/payment-status?session_id=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.paid && data.pack) {
            setPack(data.pack);
            loadWallet();
            loadVersions();
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
            loadVersions();
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

  // Checkout or Credit Unlock
  const handleCheckout = async (planIdToUse?: string) => {
    setActionLoading(true);
    const productId = planIdToUse || selectedPlanId;

    try {
      const res = await fetch(`/api/packs/${id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initiate checkout");

      if (data.unlockedWithCredit) {
        // Unlocked directly via wallet credits
        await loadPack();
        await loadWallet();
        await loadVersions();
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      setError(err?.message || "Checkout failed");
    } finally {
      setActionLoading(false);
    }
  };

  // Detail Fixer: Step 1 - Interpret Edit
  const handleInterpretEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInstruction.trim()) return;

    setInterpretingEdit(true);
    setError("");
    setEditSuccessMessage("");

    try {
      const res = await fetch(`/api/packs/${id}/edits/interpret`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: editInstruction.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not interpret change");

      setPendingPatch({
        summary: data.summary,
        opsCount: data.opsCount,
        category: data.category,
        creditCost: data.creditCost ?? (data.isFree ? 0 : 1),
        isFree: Boolean(data.isFree),
        reason: data.reason,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to interpret edit");
    } finally {
      setInterpretingEdit(false);
    }
  };

  // Detail Fixer: Step 2 - Confirm & Apply Edit
  const handleApplyConfirmedEdit = async () => {
    if (!editInstruction) return;
    setApplyingEdit(true);
    setError("");

    try {
      const res = await fetch(`/api/packs/${id}/edits/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: editInstruction.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply edit");

      setPack(data.pack);
      setPendingPatch(null);
      setEditInstruction("");
      setEditSuccessMessage(`✓ Successfully applied: ${data.summary}`);
      await loadWallet();
      await loadVersions();
    } catch (err: any) {
      setError(err?.message || "Failed to apply edit");
    } finally {
      setApplyingEdit(false);
    }
  };

  // Detail Fixer: Post-Purchase Photo Swap (D-04)
  const handlePhotoSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile) return;

    setPhotoUploading(true);
    setPhotoError("");
    setError("");
    setEditSuccessMessage("");

    try {
      const formData = new FormData();
      formData.append("file", photoFile);

      const res = await fetch(`/api/packs/${id}/assets/swap-photo`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to swap photo");
      }

      setPhotoFile(null);
      setEditSuccessMessage("✓ Photo swapped successfully! New unwatermarked version generated.");
      await loadVersions();
      await loadPack();
    } catch (err: any) {
      setPhotoError(err?.message || "Failed to upload photo");
    } finally {
      setPhotoUploading(false);
    }
  };

  // Restore Older Version
  const handleRestoreVersion = async (versionNumber: number) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/packs/${id}/versions/${versionNumber}/restore`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore version");

      setPack(data.pack);
      setEditSuccessMessage(`✓ Restored from Version ${versionNumber}`);
      await loadVersions();
    } catch (err: any) {
      setError(err?.message || "Failed to restore version");
    } finally {
      setActionLoading(false);
    }
  };

  // Share Preview
  const handleOpenShare = async () => {
    setShareModalOpen(true);
    setShareLoading(true);
    try {
      const res = await fetch(`/api/packs/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptId: selectedConcept?.id }),
      });
      const data = await res.json();
      if (data.shareUrl) {
        setShareUrl(data.shareUrl);
      }
    } catch {
      // Ignore
    } finally {
      setShareLoading(false);
    }
  };

  const copyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const toggleFormat = (fId: FormatId) => {
    const next = selectedFormats.includes(fId)
      ? selectedFormats.filter((f) => f !== fId)
      : [...selectedFormats, fId];
    if (next.length > 0) {
      setSelectedFormats(next);
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

  if (error && !pack) {
    return (
      <div className="max-w-md mx-auto my-12 glass-panel p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
          ✕
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Error</h2>
        <p className="text-sm text-zinc-400 mb-6">{error || "Pack not found"}</p>
        <Link href="/" className="btn-secondary text-xs">
          Start New Promo
        </Link>
      </div>
    );
  }

  const isPackaged = pack?.status === "packaged";
  const isPaid = pack?.status === "paid" || isPackaged;
  const singlePlan = plans.find((p) => p.id === "single") || plans[0];
  const bundlePlan = plans.find((p) => p.id === "bundle-5") || plans[1];

  return (
    <div className="pb-16 max-w-5xl mx-auto">
      {/* Top Bar: Title & Wallet Credit Pill */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="pulse-badge text-[10px]">
              {pack?.brief.promotionType || "Promo Pack"}
            </span>
            <span className="text-xs text-zinc-400">&bull; 3 Concepts Composed</span>
            {isPaid ? (
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                ✓ UNLOCKED
              </span>
            ) : (
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                FREE PREVIEW
              </span>
            )}

            {/* D-02 Wallet Pill */}
            {wallet !== null && (
              <span className="bg-white/5 text-zinc-300 border border-white/10 text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Credits remaining: <strong className="text-white">{wallet.balance}</strong></span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {pack?.brief.eventName || pack?.brief.title || "Your Promo Campaign"}
          </h1>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Share Preview Button (D-05) */}
          <button
            type="button"
            onClick={handleOpenShare}
            className="btn-secondary text-xs py-2.5 px-4 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Preview
          </button>

          {/* Free Export Link (D-05) */}
          {!isPaid && (
            <a
              href={`/api/packs/${pack?.id}/free-export`}
              className="text-xs text-zinc-400 hover:text-white underline underline-offset-4 py-2 px-2"
              download
            >
              Free Export (with GDP credit)
            </a>
          )}

          {isPaid && (
            <a
              href={`/api/packs/${pack?.id}/download`}
              id="download-pack-button"
              className="btn-primary text-xs py-2.5 px-5 font-bold shadow-emerald-500/20 bg-gradient-to-tr from-emerald-500 to-emerald-400 text-black flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Latest ZIP
            </a>
          )}
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400 font-bold ml-4">✕</button>
        </div>
      )}

      {editSuccessMessage && (
        <div className="p-4 mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
          <span>{editSuccessMessage}</span>
          <button onClick={() => setEditSuccessMessage("")} className="text-emerald-400 font-bold ml-4">✕</button>
        </div>
      )}

      {paymentProcessing && (
        <div className="glass-panel-elevated p-6 mb-8 border-amber-500/30 text-center animate-pulse">
          <div className="text-amber-400 font-bold mb-1">Verifying Payment...</div>
          <p className="text-xs text-zinc-400">Confirming transaction and preparing your credits.</p>
        </div>
      )}

      {pack?.status === "packaging" && (
        <div className="glass-panel-elevated p-6 mb-8 border-amber-500/30 text-center">
          <div className="flex items-center justify-center gap-2 text-amber-400 font-bold mb-2">
            <svg className="animate-spin h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            Preparing your multi-format design pack...
          </div>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Recomposing approved design across all requested dimensions with unwatermarked full-resolution assets and manifest.json.
          </p>
        </div>
      )}

      {/* ----------------- POST-PURCHASE EXPERIENCE (D-04 DETAIL FIXER) ----------------- */}
      {isPaid ? (
        <div className="space-y-10">
          {/* Main Unlocked Banner & Download */}
          <div className="glass-panel-elevated p-6 rounded-3xl border-emerald-500/30 bg-emerald-950/20">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl font-bold">
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
                href={`/api/packs/${pack?.id}/download`}
                className="btn-primary py-3 px-6 font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-emerald-500/20"
              >
                Download pack.zip
              </a>
            </div>
          </div>

          {/* Active Version Showcase & Detail Fixer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Current Version Preview */}
            <div className="lg:col-span-5">
              <div className="glass-panel p-4 rounded-3xl border-white/10">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-bold text-white">Active Design</span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {versions.length > 0 ? `v${versions[0]?.versionNumber} Latest` : "v1 Original"}
                  </span>
                </div>
                <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-black/60 border border-white/10 shadow-2xl">
                  {selectedConcept && (
                    <Image
                      src={selectedConcept.previewUrl}
                      alt={selectedConcept.title}
                      fill
                      sizes="450px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 px-1">
                  <span>{selectedConcept?.visualDirection}</span>
                  <span className="text-emerald-400 font-medium">Unwatermarked Export</span>
                </div>
              </div>
            </div>

            {/* Right: D-04 Detail Fixer Input & Controls */}
            <div className="lg:col-span-7 space-y-6">
              <div className="glass-panel-elevated p-6 rounded-3xl border-amber-500/20">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="pulse-badge text-[10px]">D-04 Detail Fixer</span>
                  <span className="text-[11px] text-emerald-400 font-semibold">Text &amp; Date Edits: FREE</span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight mb-1">
                  Need to make a change?
                </h2>
                <p className="text-xs text-zinc-400 mb-4">
                  Text, date, and location fixes are free and unlimited. Structural layout and palette regenerations consume 1 credit.
                </p>

                {/* Edit Form */}
                <form onSubmit={handleInterpretEdit} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      id="detail-fixer-input"
                      value={editInstruction}
                      onChange={(e) => setEditInstruction(e.target.value)}
                      placeholder='e.g. "Change the date to October 12" or "Make the headline larger"'
                      disabled={interpretingEdit || applyingEdit}
                      className="input-field py-3 px-4 text-sm text-white placeholder-zinc-500 shadow-inner w-full"
                    />
                  </div>

                  {/* Suggestion Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Change date to Oct 12",
                      "Update time to 7:00 PM",
                      "Update CTA to Register Now",
                      "Recompose with bolder layout",
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditInstruction(chip)}
                        className="text-[11px] text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 rounded-full px-3 py-1 transition-colors cursor-pointer"
                      >
                        &ldquo;{chip}&rdquo;
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    id="interpret-edit-button"
                    disabled={interpretingEdit || applyingEdit || !editInstruction.trim()}
                    className="btn-primary w-full py-3 text-xs font-bold shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {interpretingEdit ? "Classifying change..." : "Review & Apply Change"}
                  </button>
                </form>

                {/* Step 2: Edit Confirmation Modal / Box */}
                {pendingPatch && (
                  <div className="mt-6 pt-5 border-t border-white/10 animate-fade-in">
                    <div className={`glass-panel p-4 rounded-2xl border space-y-3 ${
                      pendingPatch.isFree ? "border-emerald-400/30 bg-emerald-500/[0.03]" : "border-amber-400/30 bg-amber-500/[0.03]"
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-white">
                          Proposed Changes:
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                          pendingPatch.isFree ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"
                        }`}>
                          {pendingPatch.isFree ? "FREE (0 Credits)" : `Cost: ${pendingPatch.creditCost} Credit`}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-200">
                        ✓ {pendingPatch.summary}
                      </p>
                      {pendingPatch.reason && (
                        <p className="text-[11px] text-zinc-400">
                          Classification: {pendingPatch.reason}
                        </p>
                      )}

                      {!pendingPatch.isFree && wallet && wallet.balance < pendingPatch.creditCost ? (
                        <div className="pt-2">
                          <p className="text-xs text-red-400 font-semibold mb-2">
                            You don&apos;t have enough credits (Balance: {wallet.balance}).
                          </p>
                          <button
                            type="button"
                            onClick={() => handleCheckout("bundle-5")}
                            className="btn-primary w-full py-2.5 text-xs font-bold"
                          >
                            Get 5-Pack Bundle ({bundlePlan ? (bundlePlan as any).formattedPrice || "$9.99" : "$9.99"})
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            type="button"
                            id="confirm-edit-button"
                            onClick={handleApplyConfirmedEdit}
                            disabled={applyingEdit}
                            className={`flex-1 py-2.5 text-xs font-bold cursor-pointer rounded-xl transition-all shadow-lg ${
                              pendingPatch.isFree ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20" : "btn-primary"
                            }`}
                          >
                            {applyingEdit
                              ? "Applying change..."
                              : pendingPatch.isFree
                                ? "Confirm & Apply Change (Free - 0 Credits)"
                                : `Confirm & Regenerate (${pendingPatch.creditCost} Credit)`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingPatch(null)}
                            disabled={applyingEdit}
                            className="btn-secondary py-2.5 px-4 text-xs font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Photo Swap Section (D-04) */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Swap Subject Photo</span>
                      <span className="text-[10px] bg-white/10 text-zinc-300 px-2 py-0.5 rounded">Included Free</span>
                    </h3>
                    <span className="text-[11px] text-zinc-400">PNG, JPG, WebP (&lt;10MB)</span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-4">
                    Replace the subject photo in this pack with a new high-resolution photo.
                  </p>

                  <form onSubmit={handlePhotoSwap} className="space-y-3">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        id="photo-swap-input"
                        onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                        disabled={photoUploading}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 text-xs text-zinc-400 w-full"
                      />
                      <button
                        type="submit"
                        id="photo-swap-submit-button"
                        disabled={photoUploading || !photoFile}
                        className="btn-secondary whitespace-nowrap text-xs py-2 px-5 font-bold cursor-pointer disabled:opacity-40"
                      >
                        {photoUploading ? "Uploading..." : "Upload & Swap Photo"}
                      </button>
                    </div>
                    {photoError && <p className="text-xs text-red-400">{photoError}</p>}
                  </form>
                </div>
              </div>

              {/* Version History Timeline (D-04) */}
              <div className="glass-panel p-6 rounded-3xl border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Version History</span>
                    <span className="text-[10px] text-zinc-400 font-normal">({versions.length} versions)</span>
                  </h3>
                  <span className="text-[10px] text-zinc-500 font-mono">Immutable History</span>
                </div>

                <div className="space-y-3">
                  {versions.map((ver, idx) => (
                    <div
                      key={ver.id}
                      className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-4 transition-colors ${
                        idx === 0
                          ? "bg-white/[0.04] border-white/15 text-white"
                          : "bg-white/[0.01] border-white/5 text-zinc-400"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                          idx === 0 ? "bg-amber-400 text-black" : "bg-white/10 text-zinc-400"
                        }`}>
                          v{ver.versionNumber}
                        </span>
                        <div>
                          <div className="font-semibold text-zinc-200">
                            {ver.label || `Version ${ver.versionNumber}`}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {new Date(ver.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} &bull; {new Date(ver.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleRestoreVersion(ver.versionNumber)}
                            disabled={actionLoading}
                            className="btn-secondary text-[11px] py-1.5 px-3"
                          >
                            Restore
                          </button>
                        )}
                        <a
                          href={ver.downloadUrl || `/api/packs/${pack?.id}/download?version=${ver.versionNumber}`}
                          className="text-[11px] text-amber-400 hover:underline px-2"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ----------------- PRE-PURCHASE EXPERIENCE (D-02 & D-06) ----------------- */
        <div>
          {/* Concept Cards */}
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
              {pack?.concepts.map((concept, idx) => {
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
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                        Concept 0{idx + 1}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        VQS {concept.vqs}
                      </span>
                    </div>

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

          {/* Paywall & Product Plans (D-02 & D-06) */}
          {selectedConcept && (
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

                {/* Right: Bundles & Unlock Checkout */}
                <div className="lg:col-span-7 space-y-6">
                  <div>
                    <span className="pulse-badge text-[10px] mb-2">D-03 Paywall &bull; Ready to Export</span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      Unlock Your Complete Promo Pack
                    </h2>
                    <p className="text-sm text-zinc-400 mt-1">
                      You selected <strong className="text-white">{selectedConcept.title}</strong>. Choose a single pack or save more with a credit bundle.
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

                  {/* D-02 Product Plans Selector */}
                  <div>
                    <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold block mb-3">
                      Choose Your Purchasing Option:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option 1: Single Pack */}
                      <div
                        onClick={() => setSelectedPlanId("single")}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          selectedPlanId === "single"
                            ? "border-amber-400 bg-white/[0.05] ring-2 ring-amber-400/20"
                            : "border-white/10 bg-white/[0.01] hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-white">{singlePlan?.name || "Single Pack"}</span>
                          <span className="text-[10px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded">1 Credit</span>
                        </div>
                        <div className="text-2xl font-black text-white mb-1">
                          {(singlePlan as any)?.formattedPrice || "$2.99"}
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          {singlePlan?.description || "1 high-resolution pack in all formats"}
                        </p>
                      </div>

                      {/* Option 2: 5-Pack Bundle */}
                      <div
                        onClick={() => setSelectedPlanId("bundle-5")}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all relative overflow-hidden ${
                          selectedPlanId === "bundle-5"
                            ? "border-amber-400 bg-white/[0.05] ring-2 ring-amber-400/20"
                            : "border-white/10 bg-white/[0.01] hover:border-white/20"
                        }`}
                      >
                        <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-500 to-teal-400 text-black text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl">
                          Save More
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-white">{bundlePlan?.name || "5-Pack Bundle"}</span>
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold">5 Credits</span>
                        </div>
                        <div className="text-2xl font-black text-white mb-1">
                          {(bundlePlan as any)?.formattedPrice || "$9.99"}
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          {bundlePlan?.description || "5 packs + credits in your wallet"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Checkout CTA */}
                  <div className="pt-4 border-t border-white/5 space-y-3">
                    {/* Instant Unlock via existing credits */}
                    {wallet && wallet.balance >= 1 && (
                      <button
                        type="button"
                        id="unlock-with-credit-button"
                        onClick={() => handleCheckout("wallet_credit")}
                        disabled={actionLoading}
                        className="btn-primary w-full py-3.5 px-6 font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-emerald-500/20 cursor-pointer"
                      >
                        {actionLoading ? "Unlocking..." : `✓ Unlock Pack with 1 Credit (Balance: ${wallet.balance})`}
                      </button>
                    )}

                    <button
                      type="button"
                      id="unlock-pack-button"
                      onClick={() => handleCheckout()}
                      disabled={actionLoading}
                      className="btn-primary w-full py-4 px-8 font-bold text-base shadow-amber-500/30 cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading ? "Processing..." : `Checkout — ${selectedPlanId === "bundle-5" ? (bundlePlan as any)?.formattedPrice || "$9.99" : (singlePlan as any)?.formattedPrice || "$2.99"}`}
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </button>
                    <p className="text-[11px] text-zinc-500 text-center">
                      Instant checkout &bull; Regional pricing detected &bull; No recurring subscription
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Share Modal (D-05) */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-elevated max-w-md w-full p-6 rounded-3xl border-white/20 relative animate-fade-in">
            <button
              onClick={() => setShareModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-white mb-1">Share Concept Preview</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Anyone with this link can view the watermarked concept and inspect the design.
            </p>

            {shareLoading ? (
              <div className="py-6 text-center text-xs text-zinc-400">Generating secure link...</div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-zinc-300 break-all select-all">
                  {shareUrl || `${window.location.origin}/share/preview`}
                </div>
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="btn-primary w-full py-3 text-xs font-bold"
                >
                  {copiedLink ? "✓ Copied Link to Clipboard!" : "Copy Share Link"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
