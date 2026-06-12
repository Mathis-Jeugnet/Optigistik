"use client";

import AuthForm from "./components/AuthForm";
import AppShell from "./components/AppShell";
import HomeDashboard from "./components/HomeDashboard";
import { useAuth } from "@/app/context/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-opti-blue"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <AppShell>
      <HomeDashboard />
    </AppShell>
  );
}
