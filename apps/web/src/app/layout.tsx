import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "GDP \u2014 Your Promo, Everywhere in Two Minutes",
  description: "One question in, a complete finished promo pack out. Multi-format social media designs generated with deterministic quality assurance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col selection:bg-amber-500 selection:text-black">
        {/* Navigation header */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0b0b0f]/80 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-black font-black text-lg shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                G
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white text-base tracking-tight leading-none">
                  GDP
                </span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold mt-0.5">
                  Promo Pack Engine
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Deterministic Layout Engine</span>
              </div>
              <Link
                href="/create"
                className="text-xs font-semibold text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                New Promo
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8 text-center text-xs text-zinc-500">
          <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>&copy; {new Date().getFullYear()} GDP Platform &bull; D-01 Promo Pack Architecture</p>
            <p className="text-zinc-500">
              Professional Graphics &bull; 100% Quality Guaranteed
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
