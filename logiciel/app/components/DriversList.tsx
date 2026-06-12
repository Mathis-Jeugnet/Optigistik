"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { Driver } from "@/types";
import { subscribeToDrivers } from "@/services/drivers";

interface DriversListProps {
  onSelectDriver: (driver: Driver) => void;
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  EN_MISSION: { label: "EN MISSION", bg: "bg-emerald-800", text: "text-white" },
  DISPONIBLE: { label: "DISPONIBLE", bg: "bg-blue-100", text: "text-blue-800" },
  INDISPONIBLE: { label: "INDISPONIBLE", bg: "bg-amber-500", text: "text-white" },
};

export default function DriversList({ onSelectDriver }: DriversListProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToDrivers((data) => {
      setDrivers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const getInitialsColor = (firstName: string) => {
    const colors = ["bg-rose-500", "bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600", "bg-cyan-600"];
    return colors[firstName.charCodeAt(0) % colors.length];
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-opti-blue"></div>
    </div>
  );

  if (drivers.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
          <Users className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500 font-semibold text-sm">Aucun conducteur enregistré. Ajoutez-en un pour commencer.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-5">
        <Users className="w-5 h-5 text-opti-blue" />
        <h2 className="text-lg font-bold text-opti-blue font-display">Liste des Conducteurs</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase">Nom / Prénom</th>
              <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase">Statut</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => (
              <tr 
                key={driver.id} 
                onClick={() => onSelectDriver(driver)}
                className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
              >
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${getInitialsColor(driver.firstName)}`}>
                      {driver.firstName.charAt(0)}{driver.lastName.charAt(0)}
                    </div>
                    <span className="text-sm font-bold text-opti-blue">{driver.lastName.toUpperCase()} {driver.firstName}</span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${statusConfig[driver.status]?.bg} ${statusConfig[driver.status]?.text}`}>
                    {statusConfig[driver.status]?.label || "ACTIF"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}