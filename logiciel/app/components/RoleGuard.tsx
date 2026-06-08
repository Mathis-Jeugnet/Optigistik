"use client";

import { ReactNode } from "react";
import { useAuth } from "@/app/context/AuthContext";
import AccessDenied from "./AccessDenied";

interface RoleGuardProps {
  allowedRoles: string[];
  children: ReactNode;
  // Par défaut, on affiche l'écran <AccessDenied />. Passer `null` pour masquer
  // silencieusement (ex : un lien de menu réservé à certains rôles).
  fallback?: ReactNode;
}

export default function RoleGuard({ allowedRoles, children, fallback }: RoleGuardProps) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[50vh] w-full flex flex-col items-center justify-center gap-3 animate-in fade-in duration-300">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-opti-blue rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-400">Chargement de vos accès...</p>
      </div>
    );
  }

  const userRole = profile?.role;

  // On compare en minuscules des deux côtés pour être 100% sûr
  const isAuthorized = userRole && allowedRoles.some(
    role => role.toLowerCase() === userRole.toLowerCase()
  );

  if (!isAuthorized) {
    return <>{fallback === undefined ? <AccessDenied /> : fallback}</>;
  }

  return <>{children}</>;
}