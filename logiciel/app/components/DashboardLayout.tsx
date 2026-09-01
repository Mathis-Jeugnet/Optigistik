"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";
import { MessagingProvider } from "../context/MessagingContext";
import { AlertTriangle, X } from "lucide-react";
import TrafficIncidentsPanel from "./TrafficIncidentsPanel";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, logout } = useAuth();
  const router = useRouter();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTrafficPanelOpen, setIsTrafficPanelOpen] = useState(false);

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
      <div className="flex h-screen bg-slate-50 overflow-hidden relative">
        <Sidebar
          user={user}
          profile={profile}
          onLogout={logout}
          isCollapsed={isCollapsed}
          toggleSidebar={() => setIsCollapsed(!isCollapsed)}
        />
        
        <main className="flex-1 min-h-0 min-w-0 p-8 h-screen overflow-y-auto">
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>

        {/* BOUTON FLOTTANT : CENTRE DE TRAFIC */}
        <button
          onClick={() => setIsTrafficPanelOpen(true)}
          className="fixed bottom-8 right-8 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-white text-opti-blue font-bold shadow-xl border border-gray-200 hover:border-opti-red hover:text-opti-red transition-all group"
        >
          <div className="relative">
            <AlertTriangle className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-opti-red opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-opti-red"></span>
            </span>
          </div>
          <span className="hidden group-hover:inline-block">Trafic</span>
        </button>

        {/* PANNEAU LATÉRAL GLISSANT (DRAWER) POUR LES INCIDENTS */}
        <>
          {/* Overlay sombre */}
          {isTrafficPanelOpen && (
            <div 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-opacity"
              onClick={() => setIsTrafficPanelOpen(false)}
            />
          )}

          {/* Panneau */}
          <div 
            className={`fixed top-0 right-0 h-full w-full max-w-md bg-slate-50 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
              isTrafficPanelOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="p-4 flex items-center justify-between border-b border-gray-200 bg-white sticky top-0 z-10">
              <h3 className="font-bold text-opti-blue">Centre de Contrôle</h3>
              <button 
                onClick={() => setIsTrafficPanelOpen(false)}
                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <TrafficIncidentsPanel />
            </div>
          </div>
        </>

      </div>
    </MessagingProvider>
  );
}