"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardLayout from "../components/DashboardLayout";
import RoleGuard from "../components/RoleGuard";
import DriversList from "../components/DriversList";
import DriverDetail from "../components/DriverDetail";
import { Driver } from "@/types";
import { useAuth } from "../context/AuthContext";
import { ShieldAlert } from "lucide-react";

type ViewState = "list" | "detail";

export default function ConducteursFlottePage() {
  const { profile, loading: authLoading } = useAuth();
  const [view, setView] = useState<ViewState>("list");
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [listKey, setListKey] = useState(0);
  const pathname = usePathname(); // Hook pour gérer les onglets

  const userRole = profile?.role || 'Lecteur';

  const handleSelectDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    setView("detail");
  };

  const handleBackToList = () => {
    setSelectedDriver(null);
    setView("list");
    setListKey((k) => k + 1);
  };

  return (
    <DashboardLayout>
      <RoleGuard allowedRoles={["Admin", "Gestionnaire", "Lecteur"]}>
      <div className="w-full space-y-6">

        {/* Navigation Tabs Dynamiques (Reliées à /fleet) */}
        {view === "list" && (
          <div className="mb-6 flex gap-8 border-b border-gray-200">
            <Link
              href="/conducteurs-flotte"
              className={`py-2 px-1 transition-all duration-200 ${
                pathname === "/conducteurs-flotte"
                  ? "text-opti-blue border-b-2 border-opti-blue font-bold"
                  : "text-gray-500 hover:text-opti-blue font-medium"
              }`}
            >
              Conducteurs
            </Link>
            
            <Link
              href="/fleet"
              className={`py-2 px-1 transition-all duration-200 ${
                pathname === "/fleet"
                  ? "text-opti-red border-b-2 border-opti-red font-bold"
                  : "text-gray-500 hover:text-opti-red font-medium"
              }`}
            >
              Flotte de véhicules
            </Link>
          </div>
        )}

        {/* Gestion des accès par rôle */}
        {authLoading ? (
          <div className="flex h-[400px] items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-opti-blue"></div>
          </div>
        ) : userRole?.toLowerCase() === 'lecteur' ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <ShieldAlert className="w-10 h-10 text-opti-red" />
            </div>
            <h2 className="text-xl font-bold text-opti-blue mb-2">Accès restreint</h2>
            <p className="text-gray-500 max-w-md text-center leading-relaxed">
              Vous devez demander à un supérieur pour avoir accès à ces informations.
            </p>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            {view === "list" && (
              <DriversList key={listKey} onSelectDriver={handleSelectDriver} />
            )}

            {view === "detail" && selectedDriver && (
              <DriverDetail 
                driver={selectedDriver} 
                onUpdate={(updated) => setSelectedDriver(updated)}
                onBack={handleBackToList}
              />
            )}
          </div>
        )}
      </div>
      </RoleGuard>
    </DashboardLayout>
  );
}