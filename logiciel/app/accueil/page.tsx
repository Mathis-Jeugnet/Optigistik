"use client";

import AlertsList from "../components/AlertsList";
import MapSection from "../components/MapSection";
import DashboardLayout from "../components/DashboardLayout";
import RoleGuard from "../components/RoleGuard";
import RecentMessagesWidget from "../components/RecentMessagesWidget";

export default function AccueilPage() {
  return (
    <DashboardLayout>
      <RoleGuard allowedRoles={["Admin", "Gestionnaire", "Lecteur"]}>
        <div className="animate-in space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <RecentMessagesWidget />
          <AlertsList alerts={[]} />
        </div>
        <MapSection />
        </div>
      </RoleGuard>
    </DashboardLayout>
  );
}
