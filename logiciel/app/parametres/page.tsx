"use client";

import { useState } from "react";
import { User, Monitor, Check, Mail, Shield, KeyRound } from "lucide-react";
import { useTheme } from "next-themes";
import { sendPasswordResetEmail } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import DashboardLayout from "@/app/components/DashboardLayout";
import { useAuth } from "@/app/context/AuthContext";
import { useA11y } from "@/app/context/A11yContext";

type Tab = "profil" | "interface";

const ROLE_LABELS: Record<string, string> = {
  Admin: "Administrateur",
  Gestionnaire: "Gestionnaire",
  Lecteur: "Lecteur",
  Chauffeur: "Chauffeur",
};

export default function ParametresPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profil");
  const [resetStatus, setResetStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const { profile, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showToolbar, setShowToolbar } = useA11y();

  const handlePasswordReset = async () => {
    const email = user?.email || profile?.email;
    if (!email) return;
    setResetStatus("sending");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetStatus("sent");
    } catch {
      setResetStatus("error");
    }
  };

  const themeOptions = [
    { value: "light", label: "Clair", icon: "☀️", desc: "Interface lumineuse" },
    { value: "dark", label: "Sombre", icon: "🌙", desc: "Interface sombre" },
    { value: "system", label: "Système", icon: "💻", desc: "Suit l'appareil" },
  ];

  return (
    <DashboardLayout>
      <div className="animate-in w-full space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-opti-blue font-display">Paramètres</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez votre profil et l&apos;interface</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-8 border-b border-gray-200">
          {([
            { key: "profil", label: "Profil" },
            { key: "interface", label: "Interface" },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`py-2 px-1 transition-all duration-200 ${
                activeTab === key
                  ? "text-opti-blue border-b-2 border-opti-blue font-bold"
                  : "text-gray-500 hover:text-opti-blue font-medium"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Profil Tab */}
        {activeTab === "profil" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Identité */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-5">
                <User className="w-5 h-5 text-opti-blue" />
                <h2 className="text-lg font-bold text-opti-blue font-display">Identité</h2>
              </div>

              <div className="flex items-center gap-5 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-opti-blue text-2xl font-bold font-display">
                  {profile?.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <p className="text-lg font-bold text-opti-blue font-display">
                    {profile?.name ?? "—"}
                  </p>
                  <p className="text-sm text-gray-500">{profile?.email ?? user?.email ?? "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Adresse e-mail
                  </p>
                  <p className="text-sm font-semibold text-opti-blue flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {profile?.email ?? user?.email ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Rôle
                  </p>
                  <p className="text-sm font-semibold text-opti-blue flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-gray-400" />
                    {ROLE_LABELS[profile?.role ?? ""] ?? profile?.role ?? "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Mot de passe */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-5">
                <KeyRound className="w-5 h-5 text-opti-blue" />
                <h2 className="text-lg font-bold text-opti-blue font-display">Mot de passe</h2>
              </div>

              <p className="text-sm text-gray-500 mb-5">
                Un lien de réinitialisation sera envoyé à votre adresse e-mail.
                Vous pourrez définir un nouveau mot de passe depuis ce lien.
              </p>

              {resetStatus === "sent" ? (
                <div className="flex items-center gap-3 bg-emerald-50 text-emerald-700 rounded-2xl px-4 py-3 text-sm font-medium">
                  <Check className="w-4 h-4 shrink-0" />
                  Lien envoyé à <span className="font-bold">{profile?.email ?? user?.email}</span>
                </div>
              ) : resetStatus === "error" ? (
                <div className="space-y-2">
                  <div className="bg-red-50 text-opti-red rounded-2xl px-4 py-3 text-sm font-medium">
                    Une erreur s&apos;est produite. Veuillez réessayer.
                  </div>
                  <button
                    onClick={() => setResetStatus("idle")}
                    className="text-sm text-gray-500 underline"
                  >
                    Réessayer
                  </button>
                </div>
              ) : (
                <button
                  onClick={handlePasswordReset}
                  disabled={resetStatus === "sending"}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-opti-red hover:bg-opti-red-dark transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {resetStatus === "sending" ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  Envoyer un lien de réinitialisation
                </button>
              )}
            </div>
          </div>
        )}

        {/* Interface Tab */}
        {activeTab === "interface" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Thème */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-5">
                <Monitor className="w-5 h-5 text-opti-blue" />
                <h2 className="text-lg font-bold text-opti-blue font-display">Thème d&apos;affichage</h2>
              </div>

              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                Apparence
              </p>

              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map(({ value, label, icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setTheme(value);
                      const uid = auth.currentUser?.uid;
                      if (uid) updateDoc(doc(db, "users", uid), { "settings.theme": value }).catch(() => {});
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      theme === value
                        ? "border-opti-blue bg-blue-50 dark:border-white/30 dark:bg-white/10"
                        : "border-gray-100 hover:border-gray-200 bg-gray-50"
                    }`}
                  >
                    <span className="text-2xl">{icon}</span>
                    <span className={`text-sm font-bold ${theme === value ? "text-opti-blue" : "text-gray-700"}`}>
                      {label}
                    </span>
                    <span className="text-xs text-gray-400 text-center leading-tight">{desc}</span>
                    {theme === value && (
                      <div className="w-5 h-5 rounded-full bg-opti-blue flex items-center justify-center mt-0.5">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Accessibilité */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-opti-blue">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                <h2 className="text-lg font-bold text-opti-blue font-display">Accessibilité</h2>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div>
                  <p className="text-sm font-semibold text-opti-blue">Bulle d&apos;accessibilité</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Bouton flottant pour ajuster la taille du texte et activer la lecture vocale
                  </p>
                </div>
                <button
                  onClick={() => setShowToolbar(!showToolbar)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ml-6 cursor-pointer ${
                    showToolbar ? "bg-opti-blue" : "bg-gray-200"
                  }`}
                  role="switch"
                  aria-checked={showToolbar}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      showToolbar ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
