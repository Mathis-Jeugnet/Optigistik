"use client";

import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white border border-slate-200 p-10 rounded-[32px] shadow-xl text-center max-w-md animate-in fade-in zoom-in duration-300">
        <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Compass className="w-10 h-10 text-opti-blue" />
        </div>
        <p className="text-5xl font-bold text-opti-blue mb-2 font-display">404</p>
        <h2 className="text-2xl font-bold text-opti-blue mb-3">Page introuvable</h2>
        <p className="text-slate-500 mb-8 leading-relaxed">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-8 py-3 bg-opti-blue text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95"
        >
          Retour à l&apos;accueil
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
