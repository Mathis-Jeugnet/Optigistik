"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";
import { MessagingProvider } from "../context/MessagingContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, logout } = useAuth();
  const router = useRouter();

  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-opti-blue"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <MessagingProvider>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar
          user={user}
          profile={profile}
          onLogout={logout}
          isCollapsed={isCollapsed}
          toggleSidebar={() => setIsCollapsed(!isCollapsed)}
        />
        <main className="flex-1 p-8 h-screen overflow-y-auto">
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </MessagingProvider>
  );
}