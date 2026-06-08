"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

interface AccessDeniedProps {
  title?: string;
  message?: string;
}

export default function AccessDenied({
  title = "Accès Privilégié",
  message = "Désolé, vous n'avez pas les droits nécessaires pour accéder à cette zone du système Optigistik.",
}: AccessDeniedProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white border border-slate-200 p-10 rounded-[32px] shadow-xl text-center max-w-md animate-in fade-in zoom-in duration-300">
        <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-10 h-10 text-opti-red" />
        </div>
        <h2 className="text-2xl font-bold text-opti-blue mb-3">{title}</h2>
        <p className="text-slate-500 mb-8 leading-relaxed">{message}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-8 py-3 bg-opti-blue text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
