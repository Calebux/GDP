import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { packRepository } from "@/lib/pack-repository";
import { env } from "@gdp/core";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const share = await packRepository.getPackShareByToken(token);
  if (!share) return { title: "GDP Design Preview" };

  const pack = await packRepository.getPack(share.packId);
  const title = pack?.brief.eventName || pack?.brief.title || "Graphic Design Concept";
  const appUrl = env().APP_URL.replace(/\/$/, "");

  const concept = pack?.concepts.find((c) => c.id === share.conceptId) || pack?.concepts[0];
  const previewImage = concept?.previewUrl.startsWith("http")
    ? concept.previewUrl
    : `${appUrl}${concept?.previewUrl}`;

  return {
    title: `${title} | GDP Design Preview`,
    description: "Designed with the GDP automated design engine.",
    openGraph: {
      title: `${title} — Created with GDP`,
      description: "Check out this automated high-impact promo design concept.",
      images: [
        {
          url: previewImage,
          width: 1080,
          height: 1350,
          alt: title,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Created with GDP`,
      description: "Check out this automated high-impact promo design concept.",
      images: [previewImage],
    },
  };
}

export default async function PublicSharePage({ params }: Props) {
  const { token } = await params;
  const share = await packRepository.getPackShareByToken(token);
  if (!share) notFound();

  const pack = await packRepository.getPack(share.packId);
  if (!pack) notFound();

  const concept = pack.concepts.find((c) => c.id === share.conceptId) || pack.concepts[0];
  if (!concept) notFound();

  await packRepository.incrementShareViews(token);

  const title = pack.brief.eventName || pack.brief.title || "Social Promo Campaign";

  return (
    <div className="min-h-screen py-10 px-4 max-w-4xl mx-auto flex flex-col items-center">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="pulse-badge text-[11px] mb-3">
          <span>Created with GDP &bull; Outcome-First Promo Engine</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto">
          {pack.brief.description || "A complete multi-format promotional campaign design."}
        </p>
      </div>

      {/* Main Preview Card */}
      <div className="w-full max-w-md glass-panel-elevated p-4 rounded-3xl mb-10 shadow-2xl border-white/10">
        <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-black/60 border border-white/10 mb-4">
          <Image
            src={concept.previewUrl}
            alt={concept.title}
            fill
            sizes="(max-width: 768px) 100vw, 500px"
            className="object-cover"
            unoptimized
            priority
          />
          <div className="absolute top-3 right-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-semibold text-zinc-300 border border-white/10">
            Watermarked Preview
          </div>
        </div>

        <div className="px-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-white text-base">{concept.title}</h3>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              VQS {concept.vqs}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mb-3">{concept.description}</p>
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            <span className="bg-white/5 text-zinc-300 px-2 py-0.5 rounded font-mono">
              Direction: {concept.visualDirection}
            </span>
            <span className="bg-white/5 text-zinc-300 px-2 py-0.5 rounded font-mono">
              Category: {pack.brief.promotionType || "Promo"}
            </span>
          </div>
        </div>
      </div>

      {/* Viral Marketing CTA (D-05 Distribution Loop) */}
      <div className="w-full max-w-lg glass-panel p-8 rounded-3xl text-center border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent">
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
          Like this design?
        </h2>
        <p className="text-sm text-zinc-400 mb-6 max-w-sm mx-auto">
          Create your own done-for-you promo pack in under 90 seconds. We recompose your content into 8 social formats.
        </p>
        <Link
          href={`/?ref=${token}`}
          className="btn-primary w-full py-4 text-base font-bold shadow-amber-500/20 block"
        >
          Create Your Own Promo Pack
        </Link>
        <p className="text-[11px] text-zinc-500 mt-3">
          Free watermarked preview &bull; Unlock in all formats starting at $2.99
        </p>
      </div>
    </div>
  );
}
