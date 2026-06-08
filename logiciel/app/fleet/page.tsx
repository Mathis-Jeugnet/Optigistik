"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import FleetList from "../components/FleetList";
import FleetDetail from "../components/FleetDetail";
import VehicleForm from "../components/VehicleForm";
import FleetAdmin from "../components/FleetAdmin";
// Import de ton layout global qui contient la Sidebar corrigée
import DashboardLayout from "../components/DashboardLayout";
import RoleGuard from "../components/RoleGuard";
import {
  getVehicleTypes, Vehicle, VehicleType, Specialty,
  getSpecialties, subscribeToVehicles, Motorization, getMotorizations
} from "@/services/fleet";
import { useAuth } from "@/app/context/AuthContext";
import { ShieldAlert, Settings } from "lucide-react";

type ViewState = "list" | "detail" | "form" | "admin";

export default function FleetSection() {
  const [view, setView] = useState<ViewState>("list");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const { profile, loading: authLoading } = useAuth();
  const pathname = usePathname();
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [motorizations, setMotorizations] = useState<Motorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const fetchData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setDbError(null);
    try {
      const [fetchedTypes, fetchedSpecialties, fetchedMotors] = await Promise.all([
        getVehicleTypes(),
        getSpecialties(),
        getMotorizations()
      ]);
      setVehicleTypes(fetchedTypes);
      setSpecialties(fetchedSpecialties);
      setMotorizations(fetchedMotors);
    } catch (err: any) {
      setDbError("Erreur chargement config: " + err.message);
    }
    if (showLoader) setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const unsubscribe = subscribeToVehicles(
      (data) => {
        setVehicles(data);
        setLoading(false);
        setDbError(null);
      },
      (err) => {
        setDbError("Erreur Firestore: " + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (profile) fetchData(false);
  }, [profile]);

  useEffect(() => {
    if (selectedVehicle) {
      const updated = vehicles.find(v => v.id === selectedVehicle.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedVehicle)) {
        setSelectedVehicle(updated);
      }
    }
  }, [vehicles]);

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setView("detail");
  };

  const handleAddVehicle = () => {
    setSelectedVehicle(null);
    setView("form");
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setView("form");
  };

  const handleBackToList = () => {
    setSelectedVehicle(null);
    setView("list");
    fetchData(false);
  };

  const handleFormSuccess = () => {
    setView("list");
    fetchData(true);
  };

  const userRole = profile?.role || 'Lecteur';

  return (
    <DashboardLayout>
      <RoleGuard allowedRoles={["Admin", "Gestionnaire", "Lecteur"]}>
      <div className="w-full space-y-6">
        {/* Navigation Tabs Dynamiques */}
        {view === "list" && (
          <div className="mb-6 flex items-center justify-between border-b border-gray-200">
            <div className="flex gap-8">
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

            {userRole.toLowerCase() === 'admin' && (
              <button 
                onClick={() => setView("admin")}
                className="py-1.5 px-3 mb-2 bg-gray-100 text-gray-600 hover:bg-opti-blue hover:text-white rounded-lg transition-all flex items-center gap-2 text-xs font-bold shadow-sm cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                CONFIGURATION
              </button>
            )}
          </div>
        )}

        {/* Gestion des états : Chargement / Accès restreint / Contenu */}
        {(loading || authLoading) ? (
          <div className="flex h-[400px] items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-opti-red"></div>
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
              <FleetList 
                vehicles={vehicles} 
                vehicleTypes={vehicleTypes}
                onSelectVehicle={handleSelectVehicle}
                onAddVehicle={handleAddVehicle}
                onEditVehicle={handleEditVehicle}
                onDeleteSuccess={() => fetchData(false)}
                userRole={userRole}
              />
            )}

            {view === "detail" && selectedVehicle && (
              <FleetDetail 
                vehicle={selectedVehicle}
                vehicleTypes={vehicleTypes}
                onBack={handleBackToList}
                onEdit={() => handleEditVehicle(selectedVehicle)}
                onRefresh={() => fetchData(false)}
                userRole={userRole}
              />
            )}

            {view === "form" && (
              <VehicleForm
                initialData={selectedVehicle}
                vehicleTypes={vehicleTypes}
                specialties={specialties}
                motorizations={motorizations}
                onCancel={handleBackToList}
                onSuccess={handleFormSuccess}
              />
            )}

            {view === "admin" && (
              <div className="space-y-4">
                <button 
                  onClick={handleBackToList}
                  className="flex items-center gap-2 text-gray-500 hover:text-opti-blue transition-colors font-bold text-sm cursor-pointer"
                >
                  ← Retour à la liste
                </button>
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="text-lg font-bold text-opti-blue mb-4">Configuration de la Flotte</h3>
                  <p className="text-gray-500 mb-6">Gérez ici les types de véhicules et les spécialités disponibles.</p>
                  <FleetAdmin 
                    types={vehicleTypes} 
                    specialties={specialties} 
                    motorizations={motorizations}
                    onRefresh={fetchData} 
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </RoleGuard>
    </DashboardLayout>
  );
}