"use client";

import AlertsList from "./AlertsList";
import MapSection from "./MapSection";
import RecentMessagesWidget from "./RecentMessagesWidget";
import { useTrafficAlerts } from "@/hooks/useTrafficAlerts";

// Contenu de la page d'accueil (route `/`). Rendu à l'intérieur de AppShell,
// donc à l'intérieur du MessagingProvider dont dépend RecentMessagesWidget.
export default function HomeDashboard() {
  const { alerts, incidents, isLoading, error } = useTrafficAlerts();

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <RecentMessagesWidget />
        <AlertsList alerts={alerts} isLoading={isLoading} error={error} />
      </div>
      <MapSection trafficIncidents={incidents} />
    </>
  );
}
