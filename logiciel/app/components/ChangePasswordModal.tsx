"use client";

import React, { useState } from "react";
import { updatePassword, signOut } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserProfile } from "@/app/context/AuthContext";
import { Lock, ShieldAlert, CheckCircle, LogOut, Eye, EyeOff } from "lucide-react";

interface ChangePasswordModalProps {
  profile: UserProfile;
  onPasswordChanged: () => void;
  onLogout: () => Promise<void>;
}

export default function ChangePasswordModal({ profile, onPasswordChanged, onLogout }: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Critères de sécurité
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== "";

  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError("Veuillez remplir tous les critères de sécurité avant de continuer.");
      return;
    }

    setLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Aucun utilisateur connecté.");

      const token = await currentUser.getIdToken(true);

      // Appeler l'API sécurisée côté serveur pour contourner firestore.rules
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Une erreur est survenue lors de la modification.");
      }

      setSuccess(true);
      
      // Laisser l'animation de succès visible 1.5s avant de lever le bloqueur
      setTimeout(() => {
        onPasswordChanged();
      }, 1500);

    } catch (err: any) {
      console.error("Erreur lors de la modification du mot de passe:", err);
      setError(err.message || "Une erreur est survenue lors de la modification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
        
        {success ? (
          <div className="text-center py-6">
            <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100 animate-bounce">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-opti-blue mb-3">Sécurisation réussie !</h2>
            <p className="text-slate-500">Votre mot de passe a été mis à jour. Vous allez être redirigé vers l'application...</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="bg-red-50 p-3.5 rounded-2xl border border-red-100">
                <Lock className="w-6 h-6 text-opti-red" />
              </div>
              <button 
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-opti-red hover:bg-slate-50 rounded-xl transition-all border border-slate-100 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Déconnexion
              </button>
            </div>

            <h2 className="text-2xl font-bold text-opti-blue mb-2 font-display">Première connexion</h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Pour des raisons de sécurité, vous devez remplacer votre mot de passe temporaire par un mot de passe définitif avant d&apos;accéder à l&apos;application.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nouveau Mot de passe */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nouveau mot de passe</label>
                <input 
                  type={showPassword ? "text" : "password"}
                  required 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full border border-gray-200 rounded-xl p-3 pr-10 text-opti-blue font-medium focus:ring-2 focus:ring-opti-red focus:border-opti-red outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[38px] text-gray-400 hover:text-opti-blue"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Confirmation */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Confirmer le mot de passe</label>
                <input 
                  type="password"
                  required 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full border border-gray-200 rounded-xl p-3 text-opti-blue font-medium focus:ring-2 focus:ring-opti-red focus:border-opti-red outline-none transition-all"
                />
              </div>

              {/* Critères de sécurité */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-2 mt-4">
                <p className="font-bold text-opti-blue mb-1">Critères de sécurité requis :</p>
                <div className="grid grid-cols-1 gap-1.5 font-medium">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${hasMinLength ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                    <span className={hasMinLength ? 'text-green-700' : 'text-slate-500'}>Au moins 8 caractères</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${hasUppercase && hasLowercase ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                    <span className={hasUppercase && hasLowercase ? 'text-green-700' : 'text-slate-500'}>Majuscules & Minuscules</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${hasNumber ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                    <span className={hasNumber ? 'text-green-700' : 'text-slate-500'}>Au moins un chiffre</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${hasSpecialChar ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                    <span className={hasSpecialChar ? 'text-green-700' : 'text-slate-500'}>Au moins un caractère spécial (!@#...)</span>
                  </div>
                  <div className="flex items-center gap-2 border-t border-slate-100 pt-1.5 mt-1">
                    <span className={`w-2 h-2 rounded-full ${passwordsMatch ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                    <span className={passwordsMatch ? 'text-green-700' : 'text-slate-500'}>Les deux mots de passe correspondent</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3.5 bg-red-50 rounded-xl border border-red-100 text-opti-red text-xs font-semibold flex gap-2 items-start">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={!isPasswordValid || loading}
                className="w-full py-3.5 bg-opti-red text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer"
              >
                {loading ? "Sécurisation..." : "Activer mon compte"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
