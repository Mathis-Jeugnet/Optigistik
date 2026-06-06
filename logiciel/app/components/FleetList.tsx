"use client";

import { MoreVertical, Plus, Eye, Edit2, Trash2, AlertTriangle, X } from "lucide-react";
import { Vehicle, VehicleType, deleteVehicle } from "@/services/fleet";
import { UserRole } from "@/app/context/AuthContext";
import { useState, useEffect } from "react";

interface FleetListProps {
  vehicles: Vehicle[];
  vehicleTypes: VehicleType[];
  onSelectVehicle: (v: Vehicle) => void;
  onAddVehicle: () => void;
  onEditVehicle: (v: Vehicle) => void;
  onDeleteSuccess: () => void;
  userRole: UserRole;
}

export default function FleetList({ vehicles, vehicleTypes, onSelectVehicle, onAddVehicle, onEditVehicle, onDeleteSuccess, userRole }: FleetListProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  // États pour la suppression
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const getTypeName = (typeId: string) => {
    return vehicleTypes.find((t) => t.id === typeId)?.name || "Inconnu";
  };

  const getVehicleStatus = (vehicle: Vehicle) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isExpired = vehicle.inspection_date <= today;

    if (!vehicle.is_active) {
      return { 
        label: vehicle.unavailability_reason || "Indisponible", 
        classes: "bg-gray-200 text-gray-700",
        isBlocked: true
      };
    }
    if (isExpired) {
      return { 
        label: "Expiré", 
        classes: "bg-red-100 text-opti-red",
        isBlocked: true
      };
    }
    return { 
      label: "Actif", 
      classes: "bg-green-100 text-green-700",
      isBlocked: false
    };
  };

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Ignorer si on clique sur le bouton lui-même
      if ((e.target as Element).closest('.action-menu-btn')) return;
      setOpenMenuId(null);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible">
      <div className="p-6 flex items-center justify-between border-b border-gray-50">
        <h2 className="text-xl font-bold text-opti-blue flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-opti-red"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 17h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
          Flotte de Véhicules
        </h2>
        {userRole.toLowerCase() === 'admin' && (
          <button 
            onClick={onAddVehicle}
            className="bg-opti-red hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Ajouter un véhicule
          </button>
        )}
      </div>

      <div className="">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-4 font-bold">Plaque</th>
              <th className="px-6 py-4 font-bold text-center">Statut</th>
              <th className="px-6 py-4 font-bold text-center">Dimensions (L/H)</th>
              <th className="px-6 py-4 font-bold">Motorisation</th>
              <th className="px-6 py-4 font-bold text-center">Type Remorque</th>
              <th className="px-6 py-4 font-bold">Spécialité</th>
              <th className="px-6 py-4 font-bold">Capacité</th>
              <th className="px-6 py-4 font-bold text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => {
              const status = getVehicleStatus(vehicle);
              return (
                <tr 
                  key={vehicle.id} 
                  className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${status.isBlocked ? 'bg-gray-100 opacity-60' : ''}`}
                  onClick={() => onSelectVehicle(vehicle)}
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-opti-blue">{vehicle.name || "Véhicule"}</div>
                    <div className="text-xs text-gray-400 font-medium">{vehicle.plate}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`${status.classes} px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600">{vehicle.dimensions}</td>
                  <td className="px-6 py-4 font-medium text-gray-700">{vehicle.motorization}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-gray-100 text-gray-700 font-bold px-2 py-1 rounded text-xs">
                      {getTypeName(vehicle.typeId)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs font-bold border border-blue-100">
                      {vehicle.specialty || "Standard"}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-700">
                    {vehicle.capacity_palettes} pal.
                  </td>
                  <td className="px-6 py-4 text-center relative">
                    <button 
                      className="action-menu-btn text-gray-400 hover:text-opti-red p-1 rounded-full hover:bg-red-50 transition-colors" 
                      onClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation(); 
                        setOpenMenuId(openMenuId === vehicle.id ? null : vehicle.id); 
                      }}
                    >
                      <MoreVertical className="w-5 h-5 mx-auto" />
                    </button>

                    {openMenuId === vehicle.id && (
                      <div className="absolute right-12 top-4 bg-white border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.1)] rounded-xl py-2 w-48 z-50 text-left overflow-hidden">
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelectVehicle(vehicle); setOpenMenuId(null); }}
                          className="w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 font-medium transition-colors"
                        >
                          <Eye className="w-4 h-4 text-gray-400" /> Voir la fiche
                        </button>
                        
                        {userRole.toLowerCase() === 'admin' && (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); onEditVehicle(vehicle); setOpenMenuId(null); }}
                              className="w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 font-medium transition-colors border-t border-gray-50"
                            >
                              <Edit2 className="w-4 h-4 text-gray-400" /> Modifier
                            </button>
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setVehicleToDelete(vehicle); 
                                setDeleteConfirmText("");
                                setOpenMenuId(null); 
                              }}
                              className="w-full px-4 py-3 text-sm text-opti-red hover:bg-red-50 flex items-center gap-3 font-medium transition-colors border-t border-gray-50"
                            >
                              <Trash2 className="w-4 h-4 text-opti-red" /> Supprimer
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  Aucun véhicule enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de suppression (re-utilisé de FleetDetail) */}
      {vehicleToDelete && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-opti-blue flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-opti-red" />
                Confirmation de suppression
              </h3>
              <button onClick={() => setVehicleToDelete(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer définitivement le véhicule <strong className="text-opti-blue">{vehicleToDelete.name} ({vehicleToDelete.plate})</strong> ? Cette action est irréversible.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Tapez "Confirmer" pour valider :
              </label>
              <input 
                type="text" 
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Confirmer"
                className="w-full border border-gray-300 rounded-lg p-3 text-opti-blue focus:ring-2 focus:ring-opti-red focus:border-opti-red outline-none"
              />
            </div>

            {error && <p className="text-opti-red text-sm mb-4">{error}</p>}

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setVehicleToDelete(null)}
                className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={async () => {
                  if (deleteConfirmText.toLowerCase() === "confirmer") {
                    const success = await deleteVehicle(vehicleToDelete.id);
                    if (success) {
                      setVehicleToDelete(null);
                      onDeleteSuccess();
                    } else {
                      setError("Erreur lors de la suppression.");
                    }
                  }
                }}
                disabled={deleteConfirmText.toLowerCase() !== "confirmer"}
                className="px-4 py-2 bg-opti-red text-white font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
