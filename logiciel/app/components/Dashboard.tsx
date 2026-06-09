"use client";

import { useState } from "react";
import { User } from "firebase/auth";
import Sidebar from "./Sidebar";
import MessagesList from "./MessagesList";
import AlertsList from "./AlertsList";
import MapSection from "./MapSection";
import FleetSection from "../fleet/page";
import { UserProfile } from "../context/AuthContext";
import { useTrafficAlerts } from "@/hooks/useTrafficAlerts";

interface DashboardProps {
  user: User | null;
  profile: UserProfile | null; 
  onLogout: () => void;
}

export default function Dashboard({ user, profile, onLogout }: DashboardProps) { // 3. Récupération ici
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const { alerts, isLoading: alertsLoading, error: alertsError } = useTrafficAlerts();

  return (
    <div className="flex min-h-screen bg-white font-sans">
      <Sidebar
        user={user}
        profile={profile}
        onLogout={onLogout}
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <main className="flex-1 p-8 bg-white h-screen overflow-y-auto">
        {activeTab === "home" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <MessagesList messages={[]} unreadCount={0} />
              <AlertsList alerts={alerts} isLoading={alertsLoading} error={alertsError} />
            </div>
            <MapSection />
          </>
        )}

        {activeTab === "fleet" && (
          <FleetSection />
        )}
        
        {activeTab !== "home" && activeTab !== "fleet" && (
          <div className="flex items-center justify-center h-full text-gray-400">
            En cours de développement...
          </div>
        )}
      </main>
    </div>
  );
}