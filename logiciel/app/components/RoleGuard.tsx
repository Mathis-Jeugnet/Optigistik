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

  if (loading) return null;

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